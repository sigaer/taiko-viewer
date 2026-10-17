import { assertBindingIdentity, captureBindingIdentity } from "../../internal/account/binding-identity";
import { sourceLifecycleFailure } from "../../internal/account/source-lifecycle";
import { PublicationUnavailableError } from "../../infrastructure/taiko-publication/client.ts";
import { withDomainScoreRead } from "../taiko-domain/publication.ts";
import { createError } from "h3";
import type { RowDataPacket } from "mysql2/promise";
import type { GrowthFact, RecentGrowthAcknowledgeResponse, RecentGrowthResponse } from "~/types/player-growth";
import { getAccountDb } from "~/server/utils/account-db";
import { getCurrentBindingRow } from "~/server/internal/account/shared";
import { readGoalSnapshot } from "~/server/services/goals/snapshot";
import { getSongCatalog } from "~/server/services/content";
import { loadGoalFacts } from "~/server/services/growth-history/goals";
import { loadGrowthScoreEvidence, type GrowthObservation } from "~/server/services/growth-history/evidence";
import { deriveProgressForCalendarDays } from "~/utils/dailyProgress";
import { projectScoreFacts, sortGrowthFacts } from "~/utils/growthHistory";
import { canonicalGrowthProjection } from "~/utils/canonicalGrowth.ts";
import { GROWTH_RECENT_ALGORITHM_VERSION, readRecentCursor, readRecentCursorForUpdate, writeRecentCursor } from "./store";
import { recentEligibleObservations, selectRecentObservationWindow } from "./boundary";

const RECENT_FACT_LIMIT = 24;
const RECENT_SCORE_TYPES = new Set(["score-pb", "ng-reduced", "combo-improved", "clear", "fc", "df", "rank-upgrade"]);
const isHexToken = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

const factsForObservations = async (
  userId: number,
  bindingId: number,
  taikoId: string,
  evidence: Awaited<ReturnType<typeof loadGrowthScoreEvidence>>,
  observations: GrowthObservation[]
) => {
  if (!observations.length) return [] as GrowthFact[];
  const revisions = new Set(observations.flatMap(item => [item.revision, item.contentRevision].filter((value): value is string => Boolean(value))));
  const eventDays = [...new Set(observations.flatMap(item => item.eventDays))];
  const db = getAccountDb();
  const [current, catalog, goalFacts] = await Promise.all([
    readGoalSnapshot(taikoId).catch(error => { if (error instanceof PublicationUnavailableError) throw error; return null; }),
    getSongCatalog(),
    loadGoalFacts(db, userId, bindingId, "1970-01-01T00:00:00.000Z", "2100-01-01T00:00:00.000Z").catch(() => [])
  ]);
  const titles = new Map(catalog.map(song => [Number(song.id), song.song_name]));
  const days = current && eventDays.length
    ? deriveProgressForCalendarDays(current.current.songs || [], evidence.snapshots, eventDays, song => titles.get(Number(song.song_no)) || song.song_name || `#${song.song_no}`, current.revision)
    : [];
  const scoreFacts = projectScoreFacts(userId, bindingId, days).filter(fact => RECENT_SCORE_TYPES.has(fact.type) && Boolean(fact.evidence.sourceRevision && revisions.has(fact.evidence.sourceRevision)));
  const completed = goalFacts.filter(fact => Boolean(fact.evidence.sourceRevision && revisions.has(fact.evidence.sourceRevision)));
  return canonicalGrowthProjection(String(userId), String(bindingId), sortGrowthFacts([...scoreFacts, ...completed])).facts;
};

export async function getRecentGrowth(userId: number): Promise<RecentGrowthResponse> {
  const binding = await getCurrentBindingRow(userId);
  if (!binding) throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  const bindingId = Number(binding.id);
  const expected = captureBindingIdentity(binding);
  return withDomainScoreRead(binding.taiko_id, async () => {
    assertBindingIdentity(expected, await getCurrentBindingRow(userId));
    if (binding.source === "manual") {
      return { profileId: String(bindingId), state: "unavailable", observedAt: null, facts: [], totalFacts: 0, boundary: { acknowledgedToken: null, currentToken: null, acknowledgeRequired: false, recovered: false } };
    }
    const [evidence, cursor] = await Promise.all([
      loadGrowthScoreEvidence(binding.taiko_id),
      readRecentCursor(getAccountDb(), userId, bindingId)
    ]);
    const window = selectRecentObservationWindow(evidence.observations, cursor);
    const current = window.current;
    if (!current) {
      assertBindingIdentity(expected, await getCurrentBindingRow(userId));
      return { profileId: String(bindingId), state: "unavailable", observedAt: null, facts: [], totalFacts: 0, boundary: { acknowledgedToken: cursor?.token || null, currentToken: null, acknowledgeRequired: false, recovered: false } };
    }
    const allFacts = await factsForObservations(userId, bindingId, binding.taiko_id, evidence, window.selected);
    const facts = allFacts.slice(-RECENT_FACT_LIMIT).reverse();
    const acknowledgeRequired = window.acknowledgeRequired;
    assertBindingIdentity(expected, await getCurrentBindingRow(userId));
    return {
      profileId: String(bindingId),
      state: acknowledgeRequired ? "new" : "caught-up",
      observedAt: current.observedAt,
      facts,
      totalFacts: allFacts.length,
      boundary: {
        acknowledgedToken: cursor?.token || null,
        currentToken: current.token,
        acknowledgeRequired,
        recovered: window.recovered
      }
    };
  });

}

type AcknowledgeInput = { profileId?: unknown; expectedBoundary?: unknown; acknowledgeToken?: unknown };

export async function acknowledgeRecentGrowth(userId: number, body: AcknowledgeInput): Promise<RecentGrowthAcknowledgeResponse> {
  const profileId = String(body?.profileId || "");
  const expectedBoundary = body?.expectedBoundary === null ? null : String(body?.expectedBoundary || "");
  const acknowledgeToken = String(body?.acknowledgeToken || "");
  if (!/^\d+$/.test(profileId) || (expectedBoundary !== null && !isHexToken(expectedBoundary)) || !isHexToken(acknowledgeToken)) {
    throw createError({ statusCode: 400, statusMessage: "invalid-recent-boundary" });
  }
  const initialBinding = await getCurrentBindingRow(userId);
  if (!initialBinding || String(initialBinding.id) !== profileId || initialBinding.source === "manual") throw createError({ statusCode: 409, statusMessage: "profile-changed" });
  const expected = captureBindingIdentity(initialBinding);
  const db = getAccountDb();
  return withDomainScoreRead(expected.taiko_id, async () => {
    assertBindingIdentity(expected, await getCurrentBindingRow(userId));
    const evidence = await loadGrowthScoreEvidence(expected.taiko_id);
    const current = recentEligibleObservations(evidence.observations).at(-1);
    if (!current || current.token !== acknowledgeToken) throw createError({ statusCode: 409, statusMessage: "recent-boundary-changed" });

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [owners] = await connection.execute<RowDataPacket[]>("SELECT id FROM web_user_accounts WHERE id=? FOR UPDATE", [userId]);
      const [bindings] = await connection.execute<RowDataPacket[]>("SELECT id,taiko_id,source,manual_account_id FROM web_taiko_bindings WHERE user_id=? ORDER BY is_current DESC,id ASC FOR UPDATE", [userId]);
      const binding = bindings[0];
      if (!owners.length) throw createError({ statusCode: 409, statusMessage: "profile-changed" });
      assertBindingIdentity(expected, binding as typeof initialBinding);
      const stored = await readRecentCursorForUpdate(connection, userId, Number(binding.id));
      if (stored?.token === acknowledgeToken && stored.algorithmVersion === GROWTH_RECENT_ALGORITHM_VERSION) {
        await connection.commit();
        return { profileId, acknowledgedToken: acknowledgeToken, acknowledgedAt: stored.observedAt, unchanged: true };
      }
      if ((stored?.token || null) !== expectedBoundary) throw createError({ statusCode: 409, statusMessage: "recent-boundary-changed" });
      await writeRecentCursor(connection, { userId, bindingId: Number(binding.id), token: current.token, observationRevision: current.revision, observedAt: current.observedAt });
      await connection.commit();
      return { profileId, acknowledgedToken: current.token, acknowledgedAt: current.observedAt, unchanged: false };
    } catch (error) {
      try { await connection.rollback(); } catch { connection.destroy(); }
      throw sourceLifecycleFailure(error);
    } finally {
      connection.release();
    }
  }).catch(error => { throw sourceLifecycleFailure(error); });
}
