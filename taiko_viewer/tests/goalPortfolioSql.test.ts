import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { fixture } from './multi-objective/fixtures.ts';
import { goalBaseline, goalTarget } from '../utils/playerGoal.ts';
import { hash } from '../utils/multi-objective/common.ts';
import { GOAL_TABLE_SQL } from '../server/services/goals/schema.ts';
import { migratePortfolioV2 } from '../server/services/goals/migrations/portfolio-v2.ts';
import { getGoalSchemaVersion, validateGoalPortfolioSchema, rejectLegacyGoalWrite } from '../server/services/goals/portfolio-schema.ts';
import { readPortfolio, executePortfolioCommand, readGoalHistory, readPortfolioRevision, updateGoalEvaluation, readGoal, PortfolioConflict } from '../server/services/goals/portfolio-store.ts';
import { evaluatorGoal, semanticTarget, baselineEnvelope, targetForBaseline } from '../server/services/goals/portfolio-domain.ts';
import { evaluatePortfolioGoal } from '../server/services/goals/portfolio-evaluator.ts';
import type { PlayerGoal } from '../types/player-goal.ts';
import { installPortfolioRuntime } from './fixtures/portfolio-runtime.mjs';
const socket = process.env.TAIKO_PORTFOLIO_TEST_SOCKET;
assert.ok(socket?.includes('/portfolio-mysql/'), 'Dedicated synthetic socket required');
const admin = await mysql.createConnection({ socketPath: socket, user: 'root' });
const name = 'viewer_b42_test';
await admin.query('CREATE DATABASE IF NOT EXISTS viewer_b42_test');
await admin.end();
const db = mysql.createPool({ socketPath: socket, user: 'root', database: name, connectionLimit: 4, supportBigNumbers: true, bigNumberStrings: true, timezone: 'Z' });
const [[identity]] = await db.query<any[]>('SELECT DATABASE() AS name');
assert.equal(identity.name, name);
assert.ok(identity.name.endsWith('_test'));
assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION, '1');
const catalog = fixture(5).context.catalog, t1 = '2026-11-24T00:00:00.000Z', t2 = '2026-11-25T00:00:00.000Z';
const provenance = (n: number) => ({ source: 'wahlap' as const, account: 'fixture-account', topology: '[]', marker: `2026112${n}_080000_000000`, observedAt: n === 4 ? t1 : t2, contentHash: hash(`content-${n}`) });
const raw = { song_no: 1, level: 4, high_score: 900000, good_cnt: 980, ok_cnt: 10, ng_cnt: 10, clear_cnt: 0, full_combo_cnt: 0, dondaful_combo_cnt: 0, best_score_rank: 4 };
const baseline = { ...goalBaseline(raw, hash('S1'), t1), provenance: provenance(4) };
const makeLegacy = (id: string, status: PlayerGoal['status'] = 'active', songId = 1): PlayerGoal => ({ id, profileId: '11', songId, difficultyType: 4, title: 'Synthetic ' + songId, starLevel: 9, goalType: 'score-pb', baselineVersion: 1, baseline: structuredClone(baseline), source: 'today-plan', sourceBasis: 'stamina', sourceMode: 'dimension', sourceRank: 1, sourceRevision: hash('S1'), sourceGeneratedAt: t1, targetData: goalTarget('score-pb'), status, createdAt: t1, cancelledAt: status === 'cancelled' ? t2 : null, ...(status === 'completed' ? { completedAt: t2, completionEvidence: { evaluationVersion: 1, evaluatedAt: t2, observationCapturedAt: t2, observationRevision: hash('S2'), baselineRevision: hash('S1'), source: 'wahlap', provenance: provenance(5), result: { goalType: 'score-pb', before: 900000, after: 910000, delta: 10000, facts: {} } } } : {}), unavailable: false });
const state = { catalog, songs: [1, 2, 3, 4, 5].map(id => ({ id, song_name: 'Synthetic ' + id, level_4: 9 })), scoreReads: 0, snapshot: { current: { songs: [raw] }, revision: hash('S1'), capturedAt: t1, provenance: provenance(4) } };
let cleanup: () => void;
test('B4-2 isolated SQL migration, CAS, evaluation and privacy integration', async (t) => {
    try {
        await db.execute('CREATE TABLE web_user_accounts (id BIGINT UNSIGNED PRIMARY KEY)');
        await db.execute('CREATE TABLE web_taiko_bindings (id BIGINT UNSIGNED PRIMARY KEY,user_id BIGINT UNSIGNED NOT NULL,taiko_id VARCHAR(64),source VARCHAR(24),is_current INT NOT NULL)');
        await db.execute('CREATE TABLE web_song_locks (id BIGINT UNSIGNED PRIMARY KEY,taiko_id VARCHAR(64),song_no INT,level INT,is_locked INT)');
        await db.execute('INSERT INTO web_user_accounts VALUES (1),(2)');
        await db.execute("INSERT INTO web_taiko_bindings VALUES (11,1,'fixture-account','wahlap',1),(22,2,'other','wahlap',1)");
        await db.execute(GOAL_TABLE_SQL);
        for (const goal of [makeLegacy('1'), makeLegacy('2', 'completed'), makeLegacy('3', 'cancelled', 999)])
            await db.execute('INSERT INTO web_player_goals (id,user_id,binding_id,song_id,difficulty_type,goal_type,source,source_mode,source_rank,source_revision,source_generated_at,status,baseline_version,goal_data,created_at,updated_at,completed_at,cancelled_at) VALUES (?,1,11,?,4,?,?,?,1,?,?,?,1,?,?,?,?,?)', [goal.id, goal.songId, goal.goalType, goal.source, goal.sourceMode, goal.sourceRevision, '2026-11-24', goal.status, JSON.stringify(goal), '2026-11-24', '2026-11-24', goal.completedAt ? '2026-11-25' : null, goal.cancelledAt ? '2026-11-25' : null]);
        await t.test('unmigrated V1 keeps its original writer and cancellation behavior', async () => {
            const { mutateGoal, readActiveGoal } = await import('../server/services/goals/store.ts');
            const input = { ...makeLegacy('0'), profileId: '22' };
            const { id, ...newGoal } = input;
            const first = await mutateGoal(db, 2, '22', null, async () => newGoal, { taikoId: 'other', source: 'wahlap' });
            assert.ok(first);
            assert.equal((await readActiveGoal(db, 2, 22))!.id, first.id);
            await mutateGoal(db, 2, '22', first.id, null);
            assert.equal(await readActiveGoal(db, 2, 22), null);
            await db.execute('DELETE FROM web_player_goals WHERE user_id=2');
        });
        const c = await db.getConnection();
        try {
            await t.test('V1 capability and migration dry-run have no writes', async () => { assert.equal(await getGoalSchemaVersion(db), 1); await db.execute('DELETE FROM web_user_accounts WHERE id=1'); await assert.rejects(migratePortfolioV2(c, catalog), /ownership/); await db.execute('INSERT INTO web_user_accounts VALUES (1)'); const report = await migratePortfolioV2(c, catalog); assert.equal(report.pending, 3); assert.equal(await getGoalSchemaVersion(db), 1); });
            await t.test('interrupted DDL is fail-closed and recoverable', async () => {
                await assert.rejects(migratePortfolioV2(c, catalog, { apply: true, afterStage: s => {
                        if (s === 'legacy-goal:1')
                            throw Error('interrupt');
                    } }), /interrupt/);
                await assert.rejects(getGoalSchemaVersion(db), (e: any) => e.statusCode === 503);
            });
            await t.test('recovery preserves all legacy hashes, IDs, source fields and completion evidence', async () => {
                await migratePortfolioV2(c, catalog, { apply: true });
                await validateGoalPortfolioSchema(db);
                assert.equal(await getGoalSchemaVersion(db), 2);
                for (const id of ['1', '2', '3']) {
                    const g = await readGoal(db, 1, '11', id);
                    assert.ok(g);
                    assert.equal(hash(g.baseline.value), hash(baseline));
                    assert.equal(hash(g.completionEvidence), hash(g.legacyRecord!.completionEvidence || null));
                    assert.equal(g.origin.sourceSnapshot!.sourceRevision, hash('S1'));
                }
                const unresolved = await readGoal(db, 1, '11', '3');
                assert.equal(unresolved!.chartId, null);
                assert.equal(unresolved!.availability.state, 'unknown');
                assert.ok(unresolved!.diagnostics.reasonCodes.includes('CHART_ID_UNRESOLVED'));
            });
            await t.test('repeat migration does not change baseline, history or event counts', async () => { const [[before]] = await db.query<any[]>('SELECT COUNT(*) AS n FROM web_goal_portfolio_events'); await migratePortfolioV2(c, catalog, { apply: true }); const [[after]] = await db.query<any[]>('SELECT COUNT(*) AS n FROM web_goal_portfolio_events'); assert.equal(before.n, after.n); assert.equal((await readPortfolio(db, 1, '11')).portfolioRevision, '1'); });
        }
        finally {
            c.release();
        }
        cleanup = installPortfolioRuntime(db, state);
        const { commandPortfolio, getPortfolio, getManualGoalOptions } = await import('../server/services/goals/portfolio-service.ts');
        const { evaluatePortfolio } = await import('../server/services/goals/portfolio-evaluation.ts');
        const makeCommand = async (operations: any[], revision?: string, id = randomUUID()) => ({ profileId: '11', expectedPortfolioRevision: revision ?? await readPortfolioRevision(db, 1, '11'), commandId: id, operations });
        const options = { identity: { taikoId: 'fixture-account', source: 'wahlap' } };
        await t.test('GET empty/owned portfolios is read-only and owner scoped', async () => { const [[before]] = await db.query<any[]>('SELECT COUNT(*) AS n FROM web_goal_portfolio_commands'); const get = await getPortfolio(1, { profileId: '11' }); assert.equal(get.goals.length, 3); const other = await getPortfolio(2, { profileId: '22' }); assert.equal(other.portfolioRevision, '0'); assert.equal(other.goals.length, 0); await assert.rejects(getPortfolio(2, { profileId: '11' }), (e: any) => e.statusCode === 409); const [[after]] = await db.query<any[]>('SELECT COUNT(*) AS n FROM web_goal_portfolio_commands'); assert.equal(before.n, after.n); const [[p]] = await db.query<any[]>('SELECT COUNT(*) AS n FROM web_goal_portfolios WHERE user_id=2'); assert.equal(Number(p.n), 0); });
        await t.test('manual create adds multiple active types without cancelling the old goal', async () => { const menu = await getManualGoalOptions(1, { profileId: '11', songId: '1', difficultyType: '4' }); assert.ok(menu.options.some(o => o.goalType === 'df')); const response = await commandPortfolio(1, await makeCommand(menu.options.filter(o => o.goalType === 'fc' || o.goalType === 'df' || o.goalType === 'ng-reduced').map(o => ({ type: 'create_manual_goal', songId: 1, difficultyType: 4, ...o })))); assert.equal(response.createdGoals.length, 3); assert.equal(response.newPortfolioRevision, '2'); assert.equal((await readPortfolio(db, 1, '11')).goals.length, 4); assert.equal((await readGoal(db, 1, '11', '1'))!.lifecycleStatus, 'active'); });
        await t.test('command replay returns original response, changed payload conflicts', async () => { const g = (await readPortfolio(db, 1, '11')).goals[0]!; const command = await makeCommand([{ type: 'set_goal_priority', goalId: g.id, expectedGoalRevision: g.goalRevision, userPriority: 3 }]); const result = await commandPortfolio(1, command); const replay = await commandPortfolio(1, command); assert.equal(replay.replayed, true); assert.equal(replay.newPortfolioRevision, result.newPortfolioRevision); assert.equal(await readPortfolioRevision(db, 1, '11'), result.newPortfolioRevision); await assert.rejects(commandPortfolio(1, { ...command, operations: [] }), (e: any) => e.statusCode === 409); });
        await t.test('two concurrent commands using one portfolio revision admit exactly one', async () => { const p = await readPortfolio(db, 1, '11'), g = p.goals[0]!; const results = await Promise.allSettled([1, 2].map(n => executePortfolioCommand(db, 1, { profileId: '11', expectedPortfolioRevision: p.portfolioRevision, commandId: randomUUID(), operations: [{ type: 'set_goal_priority', goalId: g.id, expectedGoalRevision: g.goalRevision, userPriority: n }] }, options))); assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(results.filter(r => r.status === 'rejected' && (r.reason as any).statusCode === 409).length, 1); });
        await t.test('partial invalid operation rolls back priority and command/event changes', async () => { const p = await readPortfolio(db, 1, '11'), g = p.goals[0]!; const cmd = await makeCommand([{ type: 'set_goal_priority', goalId: g.id, expectedGoalRevision: g.goalRevision, userPriority: 0 }, { type: 'pause_goal', goalId: '9999', expectedGoalRevision: '1' }]); await assert.rejects(commandPortfolio(1, cmd)); assert.equal((await readGoal(db, 1, '11', g.id))!.userPriority, g.userPriority); assert.equal(await readPortfolioRevision(db, 1, '11'), p.portfolioRevision); });
        await t.test('full reorder and goal CAS are enforced', async () => { const p = await readPortfolio(db, 1, '11'); await assert.rejects(commandPortfolio(1, await makeCommand([{ type: 'reorder_goals', goalIds: [p.goals[0]!.id], expectedGoalRevisions: {} }])), (e: any) => e.statusCode === 422); const ids = p.goals.map(g => g.id).reverse(); await commandPortfolio(1, await makeCommand([{ type: 'reorder_goals', goalIds: ids, expectedGoalRevisions: Object.fromEntries(p.goals.map(g => [g.id, g.goalRevision])) }])); assert.deepEqual((await readPortfolio(db, 1, '11')).goals.map(g => g.id), ids); await assert.rejects(commandPortfolio(1, await makeCommand([{ type: 'pause_goal', goalId: ids[0], expectedGoalRevision: '0' }])), (e: any) => e.statusCode === 409); });
        await t.test('unsupported goal types, V1 token and >100 operations fail 422', async () => { await assert.rejects(commandPortfolio(1, await makeCommand([{ type: 'accept_recommendation', recommendationToken: 'v1-token' }])), (e: any) => e.statusCode === 422); await assert.rejects(commandPortfolio(1, await makeCommand(Array.from({ length: 101 }, () => ({ type: 'accept_recommendation', recommendationToken: 'x' })))), (e: any) => e.statusCode === 422); await assert.rejects(commandPortfolio(1, await makeCommand([{ type: 'create_manual_goal', songId: 1, difficultyType: 4, goalType: 'played', target: {} }])), (e: any) => e.statusCode === 422); });
        await t.test('nonce cannot be consumed under a second command ID', async () => { const p = await readPortfolio(db, 1, '11'); await executePortfolioCommand(db, 1, await makeCommand([]), { ...options, nonce: 'synthetic-nonce' }); await assert.rejects(executePortfolioCommand(db, 1, await makeCommand([]), { ...options, nonce: 'synthetic-nonce' }), (e: any) => e.statusCode === 409); assert.equal(await readPortfolioRevision(db, 1, '11'), p.portfolioRevision); });
        await t.test('pause/resume preserve independent baseline; duplicate target never recaptures it', async () => { let g = (await readPortfolio(db, 1, '11')).goals.find(g => g.goalType === 'fc')!; const before = hash(g.baseline); await commandPortfolio(1, await makeCommand([{ type: 'pause_goal', goalId: g.id, expectedGoalRevision: g.goalRevision }])); g = (await readGoal(db, 1, '11', g.id))!; assert.equal(g.lifecycleStatus, 'paused'); await commandPortfolio(1, await makeCommand([{ type: 'resume_goal', goalId: g.id, expectedGoalRevision: g.goalRevision }])); g = (await readGoal(db, 1, '11', g.id))!; assert.equal(hash(g.baseline), before); state.snapshot = { ...state.snapshot, revision: hash('S2'), capturedAt: t2, provenance: provenance(5), current: { songs: [{ ...raw, high_score: 910000, full_combo_cnt: 1, ng_cnt: null as unknown as number }] } }; const replay = await commandPortfolio(1, await makeCommand([{ type: 'create_manual_goal', songId: 1, difficultyType: 4, goalType: 'fc', target: g.target! }])); assert.deepEqual(replay.existingGoalIds, [g.id]); assert.equal(hash((await readGoal(db, 1, '11', g.id))!.baseline), before); });
        await t.test('batch evaluates independent types; paused skips, inconclusive does not block completion', async () => { let p = await readPortfolio(db, 1, '11'), fc = p.goals.find(g => g.goalType === 'fc')!; await commandPortfolio(1, await makeCommand([{ type: 'pause_goal', goalId: fc.id, expectedGoalRevision: fc.goalRevision }])); p = await readPortfolio(db, 1, '11'); state.scoreReads = 0; const result = await evaluatePortfolio(1, { profileId: '11', expectedPortfolioRevision: p.portfolioRevision, commandId: randomUUID() }); assert.equal(state.scoreReads, 1); assert.equal(result.affectedGoals.length, 3); assert.equal((await readGoal(db, 1, '11', '1'))!.lifecycleStatus, 'completed'); assert.equal((await readGoal(db, 1, '11', fc.id))!.lifecycleStatus, 'paused'); assert.equal((await readPortfolio(db, 1, '11')).goals.find(g => g.goalType === 'df')!.latestEvaluation!.outcome, 'active'); assert.equal(hash((await readGoal(db, 1, '11', '1'))!.baseline.value), hash(baseline)); assert.equal((await readPortfolio(db, 1, '11')).goals.find(g => g.goalType === 'ng-reduced')!.latestEvaluation!.outcome, 'inconclusive'); });
        await t.test('explicit paused evaluation completes without refreshing baseline and replays are no-op', async () => { const p = await readPortfolio(db, 1, '11'), g = p.goals.find(g => g.goalType === 'fc')!; const input = { profileId: '11', expectedPortfolioRevision: p.portfolioRevision, commandId: randomUUID(), goalIds: [g.id], explicitPausedEvaluation: true }; const result = await evaluatePortfolio(1, input); assert.equal(result.affectedGoals.find(x => x.id === g.id)!.lifecycleStatus, 'completed'); assert.equal((await evaluatePortfolio(1, input)).replayed, true); const remaining = (await readPortfolio(db, 1, '11')).goals; const df = remaining.find(g => g.goalType === 'df')!; state.snapshot.capturedAt = '2026-11-25T01:00:00.000Z'; const repeated = await evaluatePortfolio(1, { profileId: '11', expectedPortfolioRevision: result.newPortfolioRevision, commandId: randomUUID(), goalIds: [df.id] }); assert.equal(repeated.affectedGoals.length, 0); assert.equal(repeated.newPortfolioRevision, result.newPortfolioRevision); });
        await t.test('legacy writer and lossy read reject V2; all terminal history remains visible at fixed revision', async () => { await assert.rejects(rejectLegacyGoalWrite(db), (e: any) => e.statusCode === 409); const p = await readPortfolio(db, 1, '11'); const page = await readGoalHistory(db, 1, '11', p.portfolioRevision, undefined, 1); assert.equal(page.goals.length, 1); assert.ok(page.nextCursor); const second = await readGoalHistory(db, 1, '11', p.portfolioRevision, page.nextCursor!, 1); assert.notEqual(second.goals[0]!.id, page.goals[0]!.id); await assert.rejects(readGoalHistory(db, 2, '22', p.portfolioRevision, page.nextCursor!, 1), (e: any) => e.statusCode === 422); const menu = await getManualGoalOptions(1, { profileId: '11', songId: '1', difficultyType: '4' }); const choice = menu.options.find(o => o.goalType === 'score-pb')!; const made = await commandPortfolio(1, await makeCommand([{ type: 'create_manual_goal', songId: 1, difficultyType: 4, ...choice }])); const fresh = made.createdGoals[0]!; await commandPortfolio(1, await makeCommand([{ type: 'cancel_goal', goalId: fresh.id, expectedGoalRevision: fresh.goalRevision }])); assert.ok(!(await readGoalHistory(db, 1, '11', p.portfolioRevision, undefined, 100)).goals.some(g => g.id === fresh.id)); assert.ok((await readGoalHistory(db, 1, '11', await readPortfolioRevision(db, 1, '11'), undefined, 100)).goals.some(g => g.id === fresh.id)); });
        await t.test('unavailable remains paused/active; cancel is terminal and does not remove evidence', async () => { let p = await readPortfolio(db, 1, '11'), g = p.goals[0]!; g.availability.state = 'unavailable'; await db.execute('UPDATE web_player_goals SET goal_data=?,availability_state=? WHERE id=?', [JSON.stringify(g), 'unavailable', g.id]); await commandPortfolio(1, await makeCommand([{ type: 'pause_goal', goalId: g.id, expectedGoalRevision: g.goalRevision }])); g = (await readGoal(db, 1, '11', g.id))!; assert.equal(g.availability.state, 'unavailable'); await commandPortfolio(1, await makeCommand([{ type: 'cancel_goal', goalId: g.id, expectedGoalRevision: g.goalRevision }])); assert.equal((await readGoal(db, 1, '11', g.id))!.lifecycleStatus, 'cancelled'); assert.ok((await readGoal(db, 1, '11', g.id))!.baseline.binding); });
        await t.test('tampered baseline/target and invalid observation revisions cannot complete', async () => {
            const g = (await readPortfolio(db, 1, '11')).goals[0]!;
            const observation = { ownerId: 1, profileId: '11', songId: 1, difficultyType: 4, revision: 'untrusted-revision', capturedAt: t2, provenance: provenance(5), state: baseline };
            assert.equal(evaluatePortfolioGoal(1, g, observation).evaluation.outcome, 'inconclusive');
            const altered = structuredClone(g);
            altered.baseline.value.highScore = 1;
            assert.equal(evaluatePortfolioGoal(1, altered, observation).evaluation.outcome, 'unsupported');
            const targetChanged = structuredClone(g);
            targetChanged.targetHash = hash('different-target');
            assert.equal(evaluatePortfolioGoal(1, targetChanged, observation).evaluation.outcome, 'unsupported');
            assert.equal(hash((await readGoal(db, 1, '11', g.id))!.baseline), hash(g.baseline));
        });
        await t.test('V2 runtime validates actual expanded tables with SELECT-only access', async () => {
            const { schemaRequirement, validateSchemaTables } = await import('../server/utils/account-schema-runtime.ts');
            const { GOAL_V2_TABLE_SQL } = await import('../server/services/goals/schema.ts');
            const { PORTFOLIO_TABLES } = await import('../server/services/goals/portfolio-schema.ts');
            const requirements = [GOAL_V2_TABLE_SQL, ...PORTFOLIO_TABLES].map(schemaRequirement);
            assert.ok(!requirements[0]!.columns.some(c => c.name === 'active_binding_id'));
            const readonly = { query: async (sql: string, params?: unknown) => { assert.match(sql, /^SELECT/); return db.query(sql, params); } };
            await validateSchemaTables(readonly as any, requirements, 'fixture-v2');
        });
        await t.test('maximum 100 nonterminal goals rejects whole oversized transaction', async () => {
            const p = await readPortfolio(db, 1, '11');
            const seed = p.goals[0]!;
            const prepared = new Map();
            const ops = [];
            for (let i = 0; i < 100; i++) {
                const b = { ...baseline, highScore: 1000 + i };
                const frozen = baselineEnvelope('1', '11', seed.chartId, 'score-pb', b);
                const target = targetForBaseline('score-pb', b, frozen.evidenceRefs[0]!)!;
                const g = { ...structuredClone(seed), goalType: 'score-pb', baseline: frozen, target, targetHash: hash(target), lifecycleStatus: 'active' as const };
                prepared.set(i, g);
                ops.push({ type: 'create_manual_goal' as const, songId: 1, difficultyType: 4, goalType: 'score-pb' as const, target });
            }
            await assert.rejects(executePortfolioCommand(db, 1, await makeCommand(ops), { ...options, preparedGoals: prepared }), (e: any) => e.statusCode === 422);
            assert.equal(await readPortfolioRevision(db, 1, '11'), p.portfolioRevision);
            assert.equal((await readPortfolio(db, 1, '11')).goals.length, p.goals.length);
        });
        await t.test('failed evaluation event insert rolls back all goal updates', async () => {
            const p = await readPortfolio(db, 1, '11'), g = p.goals[0]!;
            const update = evaluatePortfolioGoal(1, g, { ownerId: 1, profileId: '11', songId: 1, difficultyType: 4, revision: hash('S3'), capturedAt: t2, provenance: provenance(5), state: baseline });
            const tooLong = 'x'.repeat(129);
            await assert.rejects(updateGoalEvaluation(db, 1, { profileId: '11', expectedPortfolioRevision: p.portfolioRevision, commandId: tooLong }, [update], { ...options, requestHash: hash('rollback-fixture') }));
            assert.equal((await readGoal(db, 1, '11', g.id))!.goalRevision, g.goalRevision);
            assert.equal(await readPortfolioRevision(db, 1, '11'), p.portfolioRevision);
        });
        await t.test('V2 schema capability rejects reintroduced generated column and missing nonce key', async () => {
            await db.execute('ALTER TABLE web_player_goals ADD COLUMN active_binding_id BIGINT GENERATED ALWAYS AS (NULL) STORED');
            await assert.rejects(validateGoalPortfolioSchema(db), (e: any) => e.statusCode === 503);
            await db.execute('ALTER TABLE web_player_goals DROP COLUMN active_binding_id');
            await db.execute('ALTER TABLE web_goal_portfolio_commands DROP INDEX uniq_goal_nonce');
            await assert.rejects(validateGoalPortfolioSchema(db), (e: any) => e.statusCode === 503);
            await db.execute('ALTER TABLE web_goal_portfolio_commands ADD UNIQUE KEY uniq_goal_nonce (user_id,binding_id,nonce)');
            await validateGoalPortfolioSchema(db);
        });
        await t.test('migration guards check actual database and explicit mutation opt-in', async () => {
            const c = await db.getConnection();
            try {
                delete process.env.TAIKO_ALLOW_TEST_DB_MUTATION;
                await assert.rejects(migratePortfolioV2(c, catalog, { apply: true }), /opt-in/);
                process.env.TAIKO_ALLOW_TEST_DB_MUTATION = '1';
                await c.query('USE mysql');
                await assert.rejects(migratePortfolioV2(c, catalog), /isolated/);
            }
            finally {
                await c.query('USE viewer_b42_test');
                c.release();
                process.env.TAIKO_ALLOW_TEST_DB_MUTATION = '1';
            }
        });
        await t.test('authenticated Portfolio HTTP routes enforce allowlists, ownership, headers and legacy upgrade', async () => {
            const { portfolioHttp } = await import('./fixtures/portfolio-http.mjs');
            const { negotiatePortfolioRead } = await import('../server/services/goals/portfolio-read-negotiation.ts');
            const http = await portfolioHttp({ getPortfolio, commandPortfolio, evaluatePortfolio, getManualGoalOptions, db, rejectLegacyGoalWrite, negotiatePortfolioRead });
            const call = async (path: string, method = 'GET', body?: unknown, auth = true) => fetch(http.base + path, { method, headers: { ...(auth ? { Cookie: 'portfolio_test=session' } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
            try {
                for (const [path, method, body, auth, expected] of [
                    ['/api/account/growth/goal-portfolio', 'GET', null, false, 401], ['/api/account/growth/goal-portfolio?profileId=11', 'GET', null, true, 200], ['/api/account/growth/goal-portfolio?ownerId=2', 'GET', null, true, 422], ['/api/account/growth/goal-portfolio?profileId=22', 'GET', null, true, 409],
                    ['/api/account/growth/goal-portfolio/commands', 'POST', { profileId: '11', expectedPortfolioRevision: '0', commandId: 'stale-http', operations: [] }, true, 409], ['/api/account/growth/goal-portfolio/commands', 'POST', { profileId: '11', userId: 2 }, true, 422],
                    ...['', '/preview', '/evaluate', '/evaluate-current'].map(s => ['/api/account/growth/goal' + s, 'POST', {}, true, 409]), ['/api/account/growth/goal', 'DELETE', {}, true, 409]
                ] as any[]) {
                    const response = await call(path, method, body, auth);
                    assert.equal(response.status, expected, `${method} ${path}`);
                    assert.equal(response.headers.get('cache-control'), 'private, no-store');
                    assert.equal(response.headers.get('vary'), 'Cookie');
                    await response.arrayBuffer();
                }
                const legacyRead = await call('/api/account/growth/overview');
                assert.equal(legacyRead.status, 409);
                await legacyRead.arrayBuffer();
                const modernRead = await fetch(http.base + '/api/account/growth/overview', { headers: { Cookie: 'portfolio_test=session', 'X-Goal-Portfolio-Schema': '2' } });
                assert.equal(modernRead.status, 200);
                assert.equal((await modernRead.json()).goalPortfolioVersion, 2);
            }
            finally {
                await http.close();
            }
        });
        await t.test('actual Portfolio Vue UI supports mobile/desktop Chinese/Japanese and CAS conflict refresh', async () => {
            state.snapshot = { current: { songs: [raw] }, revision: hash('S1'), capturedAt: t1, provenance: provenance(4) };
            const { portfolioHttp } = await import('./fixtures/portfolio-http.mjs');
            const { verifyPortfolioBrowser } = await import('./fixtures/portfolio-browser.mjs');
            const { negotiatePortfolioRead } = await import('../server/services/goals/portfolio-read-negotiation.ts');
            const http = await portfolioHttp({ getPortfolio, commandPortfolio, evaluatePortfolio, getManualGoalOptions, db, rejectLegacyGoalWrite, negotiatePortfolioRead });
            try {
                const results = await verifyPortfolioBrowser(http, { outputDir: process.env.QA_EVIDENCE_DIR + '/portfolio-browser', forceConflict: async () => { const p = await readPortfolio(db, 1, '11'), g = p.goals[0]!; await commandPortfolio(1, await makeCommand([{ type: 'set_goal_priority', goalId: g.id, expectedGoalRevision: g.goalRevision, userPriority: g.userPriority === 3 ? 2 : 3 }])); } });
                assert.equal(results.length, 3);
            }
            finally {
                await http.close();
            }
        });
        await t.test('migration rerun after normal V2 evaluation preserves new history', async () => {
            const c = await db.getConnection();
            try {
                const revision = await readPortfolioRevision(db, 1, '11');
                const result = await migratePortfolioV2(c, catalog, { apply: true });
                assert.equal(result.pending, 0);
                assert.equal(await readPortfolioRevision(db, 1, '11'), revision);
            }
            finally {
                c.release();
            }
        });
        await t.test('privacy cleanup removes portfolio commands/events/goals in caller transaction', async () => {
            const { deleteGoalsForBinding } = await import('../server/services/goals/lifecycle.ts');
            const c = await db.getConnection();
            try {
                await c.beginTransaction();
                await deleteGoalsForBinding(c, 11);
                for (const table of ['web_player_goals', 'web_goal_portfolios', 'web_goal_portfolio_commands', 'web_goal_portfolio_events']) {
                    const [[count]] = await c.query<any[]>(`SELECT COUNT(*) AS n FROM ${table} WHERE binding_id=11`);
                    assert.equal(Number(count.n), 0);
                }
                await c.rollback();
                assert.notEqual(await readPortfolioRevision(db, 1, '11'), '0');
                const { deleteGoalsForUser } = await import('../server/services/goals/lifecycle.ts');
                await c.beginTransaction();
                await deleteGoalsForUser(c, 1);
                for (const table of ['web_player_goals', 'web_goal_portfolios', 'web_goal_portfolio_commands', 'web_goal_portfolio_events']) {
                    const [[count]] = await c.query<any[]>(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=1`);
                    assert.equal(Number(count.n), 0);
                }
                await c.rollback();
            }
            finally {
                c.release();
            }
        });
    }
    finally {
        cleanup?.();
        await db.end();
    }
});
