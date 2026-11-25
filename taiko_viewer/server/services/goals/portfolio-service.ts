import { createError } from 'h3';
import type { PoolConnection } from 'mysql2/promise';
import { getCurrentBindingRow } from '../../internal/account/shared';
import { getAccountDb } from '../../utils/account-db';
import { captureCatalogAuthority, readCatalogPointerRevision } from '../content/catalogAuthority';
import { getSongCatalog } from '../content';
import { prepareAuthority } from '../../../utils/multi-objective/identity.ts';
import { hash, same } from '../../../utils/multi-objective/common.ts';
import type { CatalogAuthoritySnapshot, Target } from '../../../utils/multi-objective/contracts.ts';
import { goalBaseline, goalOptions } from '../../../utils/playerGoal.ts';
import type { PortfolioCommand, PortfolioGoalV2, PortfolioResponse } from '../../../types/goal-portfolio.ts';
import { readGoalSnapshot } from './snapshot';
import { withDomainScoreRead } from '../taiko-domain/publication.ts';
import { validateGoalPortfolioSchema } from './portfolio-schema.ts';
import { readPortfolio, readGoalHistory, executePortfolioCommand, readCommandReplay, validateCommand, PortfolioConflict } from './portfolio-store.ts';
import { allowed, baselineEnvelope, CREATABLE_GOAL_TYPES, decimal, invalid, semanticTarget, targetForBaseline } from './portfolio-domain.ts';
export async function portfolioBinding(userId: number, profileId?: string) {
    const binding = await getCurrentBindingRow(userId);
    if (!binding || (profileId !== undefined && String(binding.id) !== profileId))
        throw new PortfolioConflict('profile-changed');
    await validateGoalPortfolioSchema(getAccountDb());
    return binding;
}
export async function getPortfolio(userId: number, query: Record<string, unknown> = {}): Promise<PortfolioResponse> {
    allowed(query, ['profileId', 'cursor', 'snapshotRevision', 'limit']);
    if (query.profileId !== undefined && !decimal(query.profileId))
        invalid();
    if (query.limit !== undefined && (typeof query.limit !== 'string' || !/^\d{1,3}$/.test(query.limit)))
        invalid('invalid-portfolio-pagination');
    if (query.cursor !== undefined && (typeof query.cursor !== 'string' || query.cursor.length > 2048))
        invalid();
    const binding = await portfolioBinding(userId, query.profileId as string | undefined), profileId = String(binding.id), c = await getAccountDb().getConnection();
    try {
        await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        await c.query('START TRANSACTION READ ONLY');
        const [[current]] = await c.query<any[]>('SELECT CAST(id AS CHAR) AS id FROM web_taiko_bindings WHERE user_id=? AND is_current=1', [userId]);
        if (String(current?.id) !== profileId)
            throw new PortfolioConflict('profile-changed');
        const portfolio = await readPortfolio(c, userId, profileId);
        const snapshotRevision = query.snapshotRevision === undefined ? portfolio.portfolioRevision : query.snapshotRevision;
        if (!decimal(snapshotRevision) || BigInt(snapshotRevision) > BigInt(portfolio.portfolioRevision))
            invalid('invalid-snapshot-revision');
        if (query.cursor && !query.snapshotRevision)
            invalid('snapshot-revision-required');
        const history = await readGoalHistory(c, userId, profileId, snapshotRevision, query.cursor as string | undefined, query.limit === undefined ? 20 : Number(query.limit));
        await c.commit();
        return { ...portfolio, goals: [...portfolio.goals, ...history.goals], snapshotRevision, pagination: { nextCursor: history.nextCursor }, capabilities: { canCreateGoal: binding.source !== 'manual', creatableGoalTypes: binding.source === 'manual' ? [] : CREATABLE_GOAL_TYPES, acceptRecommendation: false, reasonCodes: ['RECOMMENDATION_V2_PRODUCER_UNAVAILABLE', ...(binding.source === 'manual' ? ['TRUSTED_SCORE_SOURCE_REQUIRED'] : [])] } };
    }
    catch (e) {
        await c.rollback();
        throw e;
    }
    finally {
        c.release();
    }
}
async function freezeManual(userId: number, binding: Awaited<ReturnType<typeof portfolioBinding>>, songId: number, difficultyType: number, context?: {
    snapshot: Awaited<ReturnType<typeof readGoalSnapshot>>;
    captured: Awaited<ReturnType<typeof captureCatalogAuthority>>;
    catalog: Awaited<ReturnType<typeof getSongCatalog>>;
}) {
    if (binding.source === 'manual')
        invalid('trusted-score-source-required');
    let frozen = context;
    if (!frozen) {
        const [snapshot, captured, catalog] = await Promise.all([readGoalSnapshot(binding.taiko_id, true), captureCatalogAuthority(), getSongCatalog()]);
        frozen = { snapshot, captured, catalog };
    }
    const { snapshot, captured, catalog } = frozen;
    if (!snapshot.provenance || snapshot.provenance.account !== binding.taiko_id || snapshot.provenance.source !== binding.source)
        invalid('trusted-score-source-required');
    const authority = captured.data as unknown as CatalogAuthoritySnapshot;
    const ns = binding.source === 'wahlap' ? 'wahlap' : 'catalog-id';
    const resolution = prepareAuthority(authority).resolve({ namespace: ns, sourceId: String(songId), difficulty: difficultyType, catalogRevision: authority.catalogRevision, region: 'CN', businessPolicy: 'cn_current_playable', modelProfile: null });
    if (resolution.status !== 'RESOLVED')
        invalid('chart-id-unresolved');
    const baseline = goalBaseline(snapshot.current.songs?.find(r => Number(r.song_no) === songId && Number(r.level) === difficultyType), snapshot.revision, snapshot.capturedAt);
    baseline.provenance = snapshot.provenance;
    if (!baseline.recordPresent)
        invalid('baseline-record-required');
    const song = catalog.find(s => Number(s.id) === songId);
    if (!song)
        invalid('chart-unavailable');
    return { snapshot, authority, catalogRoot: captured.root, identity: resolution.value, baseline, song };
}
export async function getManualGoalOptions(userId: number, query: Record<string, unknown>) {
    allowed(query, ['profileId', 'songId', 'difficultyType']);
    if (!decimal(query.profileId) || typeof query.songId !== 'string' || typeof query.difficultyType !== 'string' || !Number.isSafeInteger(Number(query.songId)) || Number(query.songId) < 1 || !Number.isInteger(Number(query.difficultyType)) || Number(query.difficultyType) < 1 || Number(query.difficultyType) > 5)
        invalid();
    const binding = await portfolioBinding(userId, query.profileId as string);
    return withDomainScoreRead(binding.taiko_id, async () => {
        const frozen = await freezeManual(userId, binding, Number(query.songId), Number(query.difficultyType));
        const [locks] = await getAccountDb().execute<any[]>('SELECT id FROM web_song_locks WHERE taiko_id=? AND song_no=? AND level=? AND is_locked=1 LIMIT 1', [binding.taiko_id, Number(query.songId), Number(query.difficultyType)]);
        if (locks.length)
            invalid('score-record-locked');
        return { profileId: String(binding.id), songId: Number(query.songId), difficultyType: Number(query.difficultyType), title: frozen.song.song_name, options: goalOptions(frozen.baseline, binding.source).filter(t => t !== 'played').map(goalType => ({ goalType, target: targetForBaseline(goalType, frozen.baseline, 'new') })) };
    });
}
export async function commandPortfolio(userId: number, command: PortfolioCommand) {
    validateCommand(command);
    const binding = await portfolioBinding(userId, command.profileId), db = getAccountDb();
    const replay = await readCommandReplay(db, userId, command.profileId, command.commandId, hash(command));
    if (replay)
        return replay;
    if (command.operations.some(o => o.type === 'accept_recommendation'))
        invalid('recommendation-v2-unavailable');
    const creates = command.operations.filter(o => o.type === 'create_manual_goal');
    const run = async () => {
        const prepared = new Map<number, PortfolioGoalV2>(), frozenSources: Array<{
            songId: number;
            difficultyType: number;
            catalogRevision: string;
            catalogRoot: string;
        }> = [];
        // Freeze each chart once per request; independent Goals receive independent evidence bindings.
        const frozenCharts = new Map<string, Awaited<ReturnType<typeof freezeManual>>>();
        const existingPortfolio = creates.length ? await readPortfolio(db, userId, command.profileId) : null;
        let sourceContext: Parameters<typeof freezeManual>[4];
        for (const [i, op] of command.operations.entries())
            if (op.type === 'create_manual_goal') {
                if (!CREATABLE_GOAL_TYPES.includes(op.goalType))
                    invalid('unsupported-goal-type');
                const existing = existingPortfolio?.goals.find(g => g.songId === op.songId && g.difficultyType === op.difficultyType && g.goalType === op.goalType && same(semanticTarget(g.target), semanticTarget(op.target)));
                if (existing) {
                    prepared.set(i, existing);
                    continue;
                }
                const key = `${op.songId}:${op.difficultyType}`;
                let f = frozenCharts.get(key);
                if (!f) {
                    sourceContext ||= await Promise.all([readGoalSnapshot(binding.taiko_id, true), captureCatalogAuthority(), getSongCatalog()]).then(([snapshot, captured, catalog]) => ({ snapshot, captured, catalog }));
                    f = await freezeManual(userId, binding, op.songId, op.difficultyType, sourceContext);
                    frozenCharts.set(key, f);
                }
                if (!goalOptions(f.baseline, binding.source).includes(op.goalType))
                    invalid('goal-unavailable');
                const baseline = baselineEnvelope(String(userId), command.profileId, f.identity.chartId, op.goalType, f.baseline);
                const target = targetForBaseline(op.goalType, f.baseline, baseline.evidenceRefs[0]!);
                // Explicit target must match the registered evaluator; references are resolver-owned.
                if (!target || !same(semanticTarget(op.target), semanticTarget(target)))
                    invalid('invalid-goal-target');
                const now = new Date().toISOString();
                prepared.set(i, { id: '0', goalRevision: '1', profileId: command.profileId, songId: op.songId, canonicalSongId: f.identity.canonicalSongId, chartId: f.identity.chartId, identityMappingRef: f.identity.identityMappingRef, difficultyType: op.difficultyType, goalType: op.goalType, evaluatorVersion: 'goal-evaluator/1', target, targetHash: hash(target), legacyRecord: null, displaySnapshot: { title: f.song.song_name, starLevel: Number(f.song[`level_${op.difficultyType}` as keyof typeof f.song]) || null }, lifecycleStatus: 'active', availability: { state: 'available', reasonCodes: [], checkedAt: now, catalogRevision: f.authority.catalogRevision }, userPriority: 1, userOrder: 0, baseline, latestEvaluation: null, completionEvidence: null, origin: { kind: 'manual', acceptanceId: null, candidateId: null, decisionId: null, sourceSnapshot: { source: binding.source, sourceRevision: f.snapshot.revision, sourceGeneratedAt: f.snapshot.capturedAt, sourceNamespace: binding.source === 'wahlap' ? 'wahlap' : 'catalog-id' } }, diagnostics: { reasonCodes: [], missingEvidence: [], limitations: ['AGGREGATE_NOT_ATTEMPT'] }, createdAt: now, updatedAt: now, pausedAt: null, completedAt: null, cancelledAt: null });
                frozenSources.push({ songId: op.songId, difficultyType: op.difficultyType, catalogRevision: f.authority.catalogRevision, catalogRoot: f.catalogRoot });
            }
        return executePortfolioCommand(db, userId, command, { identity: { taikoId: binding.taiko_id, source: binding.source }, preparedGoals: prepared, verifyEvidence: async (c: PoolConnection) => {
                for (const f of frozenSources) {
                    if (await readCatalogPointerRevision(f.catalogRoot) !== f.catalogRevision)
                        throw new PortfolioConflict('catalog-changed');
                }
                for (const f of frozenSources) {
                    const [locks] = await c.execute<any[]>('SELECT id FROM web_song_locks WHERE taiko_id=? AND song_no=? AND level=? AND is_locked=1 LIMIT 1', [binding.taiko_id, f.songId, f.difficultyType]);
                    if (locks.length)
                        throw new PortfolioConflict('score-record-locked');
                }
            } });
    };
    return creates.length ? withDomainScoreRead(binding.taiko_id, run) : run();
}
