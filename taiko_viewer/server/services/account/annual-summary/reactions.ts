import type { H3Event } from "h3";
import { createError, getQuery, readBody } from "h3";
import { randomUUID } from "node:crypto";
import type { ResultSetHeader } from "mysql2/promise";
import { requireAccountAnnualSummaryUser } from "./access";
import { findOwnerAnnualSummary } from "./repository";
import { syncAnnualReactionToCommunity, type CommunitySyncOutcome } from "./forum-sync";
import { ANNUAL_VERSION_KEY } from "./constants";
import { ensureAccountSchema, getAccountDb, type DbRow } from "~/server/utils/account-db";
import { loadBadgeMap } from "~/server/internal/forum/shared";
import { setPrivateNoStore } from "~/server/utils/cache-policy";
import { createMemoryRateLimiter } from "~/server/utils/rate-limit";
import { toIso } from "~/server/internal/account/shared";

type ReactionRow = { id: string; user_id: number; summary_id: string; version_key: string; content: string; status: string; community_sync_requested: number; community_sync_status: string; forum_thread_id: number | null; client_nonce: string; created_at: Date | string; updated_at: Date | string };
const perSecond = createMemoryRateLimiter({ windowMs: 3000, limit: 1, maxBuckets: 10000, message: "发送过于频繁，请稍后再试" });
const perHour = createMemoryRateLimiter({ windowMs: 60 * 60 * 1000, limit: 60, maxBuckets: 10000, message: "每小时最多发送 60 条感想" });
// Serialize requests from one user so an in-flight retry reaches the nonce
// lookup after the first insert. The unique key remains the cross-worker guard.
const userWrites = new Map<number, Promise<unknown>>();
const serializeUserWrite = async <T>(userId: number, write: () => Promise<T>): Promise<T> => {
  const previous = userWrites.get(userId) || Promise.resolve();
  const pending = previous.catch(() => {}).then(write);
  userWrites.set(userId, pending);
  try { return await pending; }
  finally { if (userWrites.get(userId) === pending) userWrites.delete(userId); }
};
const normalizeReaction = (value: unknown) => {
  if (typeof value !== "string") throw createError({ statusCode: 400, statusMessage: "请输入年度感想" });
  const text = value.replace(/[\r\n]+/g, " ").replace(/\s+/gu, " ").trim();
  if (!text) throw createError({ statusCode: 400, statusMessage: "请输入年度感想" });
  if (Array.from(text).length > 60) throw createError({ statusCode: 400, statusMessage: "年度感想不能超过 60 个字" });
  if (/[<>]/u.test(text)) throw createError({ statusCode: 400, statusMessage: "年度感想仅支持纯文本" });
  return text;
};
const serialize = (row: ReactionRow, badge?: { id: number; username: string; avatarUrl: string }) => ({ id: row.id, status: row.status, content: row.content, createdAt: toIso(row.created_at), author: { userId: row.user_id, username: badge?.username || "未知鼓友", avatarUrl: badge?.avatarUrl || "https://viewer.sakura-bot.cn/miku.png" } });

export const listAnnualReactions = async (event: H3Event) => {
  setPrivateNoStore(event);
  await requireAccountAnnualSummaryUser(event); await ensureAccountSchema("annual");
  const query = getQuery(event); const versionKey = String(query.versionKey || ANNUAL_VERSION_KEY).trim();
  const limit = Math.trunc(Math.min(100, Math.max(1, Number(query.limit || 40) || 40)));
  const [rows] = await getAccountDb().execute<DbRow<ReactionRow>[]>(`SELECT * FROM web_annual_poster_reactions WHERE version_key = ? AND status = 'published' ORDER BY created_at DESC LIMIT ${limit}`, [versionKey]);
  const badges = await loadBadgeMap(rows.map((row) => row.user_id));
  return { items: rows.reverse().map((row) => serialize(row, badges.get(row.user_id))) };
};

export const createAnnualReaction = async (event: H3Event, summaryId: string) => {
  setPrivateNoStore(event); const user = await requireAccountAnnualSummaryUser(event);
  const summary = await findOwnerAnnualSummary(summaryId, user.id); if (!summary || summary.version_key !== ANNUAL_VERSION_KEY) throw createError({ statusCode: 404, statusMessage: "年度回顾不存在" });
  const body = (await readBody<{ content?: unknown; syncCommunity?: unknown; clientNonce?: unknown }>(event).catch(() => ({}))) || {};
  const nonce = String(body.clientNonce || "").trim(); if (!/^[0-9a-f-]{16,36}$/iu.test(nonce)) throw createError({ statusCode: 400, statusMessage: "请求标识无效" });
  await ensureAccountSchema("annual"); const db = getAccountDb();
  const selectReaction = async () => {
    const [rows] = await db.execute<DbRow<ReactionRow>[]>("SELECT * FROM web_annual_poster_reactions WHERE user_id = ? AND client_nonce = ? LIMIT 1", [user.id, nonce]);
    return rows[0] || null;
  };
  return serializeUserWrite(user.id, async () => {
    const existing = await selectReaction();
    let inserted = false;
    if (!existing) {
      const content = normalizeReaction(body.content);
      perSecond(event, String(user.id)); perHour(event, String(user.id));
      const id = randomUUID();
      try {
        await db.execute<ResultSetHeader>("INSERT INTO web_annual_poster_reactions (id,user_id,summary_id,version_key,content,status,community_sync_requested,community_sync_status,client_nonce) VALUES (?,?,?,?,?,'published',?, 'skipped', ?)", [id, user.id, summary.id, summary.version_key, content, body.syncCommunity === true ? 1 : 0, nonce]);
        inserted = true;
      } catch (error: any) {
        if (String(error?.code || "") !== "ER_DUP_ENTRY" && Number(error?.errno || 0) !== 1062) throw error;
      }
    }
    const reaction = await selectReaction();
    if (!reaction) throw createError({ statusCode: 500, statusMessage: "感想保存失败" });

    // Only the request that created the reaction owns the Forum side effect, so a
    // same-nonce retry can never create a second thread. A failed or rate-limited
    // sync keeps the reaction and stores its outcome for every later retry.
    let outcome: CommunitySyncOutcome | null = null;
    if (inserted && reaction.community_sync_requested) {
      outcome = await syncAnnualReactionToCommunity({
        event,
        actorUserId: user.id,
        actorUsername: user.username,
        content: reaction.content
      });
      try {
        if (outcome.status === "synced" && outcome.threadId) {
          await db.execute("UPDATE web_annual_poster_reactions SET community_sync_status = 'synced', forum_thread_id = ? WHERE id = ? AND forum_thread_id IS NULL", [outcome.threadId, reaction.id]);
        } else if (outcome.status === "failed") {
          await db.execute("UPDATE web_annual_poster_reactions SET community_sync_status = 'failed' WHERE id = ?", [reaction.id]);
        }
      } catch (error) {
        // Reaction and thread already exist; a failed marker write must not fail the send.
        console.warn("[annual-reaction] community sync marker update failed", reaction.id, error);
      }
    }

    const stored = (await selectReaction()) || reaction;
    const badges = await loadBadgeMap([user.id]);
    const requested = Boolean(stored.community_sync_requested);
    const persisted = stored.community_sync_status === "synced"
      ? "synced"
      : stored.community_sync_status === "failed"
        ? "failed"
        : "skipped";
    const status = outcome?.status || persisted;
    const message = status === "synced"
      ? "感想已发送，已同步到社区"
      : status === "failed"
        ? "感想已发送，社区同步失败。"
        : requested
          ? "感想已发送；社区同步过于频繁，本次仅显示弹幕。"
          : "感想已发送，本次未同步到社区";
    return {
      reaction: serialize(stored, badges.get(user.id)),
      communitySync: {
        requested,
        status,
        reason: status === "skipped" ? (requested ? "rate-limited" : "not-requested") : status,
        threadId: outcome?.threadId ?? stored.forum_thread_id ?? null,
        message
      }
    };
  });
};
