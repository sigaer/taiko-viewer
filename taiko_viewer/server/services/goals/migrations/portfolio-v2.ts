import type { Connection, RowDataPacket } from 'mysql2/promise';
import type { PlayerGoal } from '../../../../types/player-goal.ts';
import type { PortfolioGoalV2 } from '../../../../types/goal-portfolio.ts';
import type { CatalogAuthoritySnapshot } from '../../../../utils/multi-objective/contracts.ts';
import { prepareAuthority } from '../../../../utils/multi-objective/identity.ts';
import { hash } from '../../../../utils/multi-objective/common.ts';
import { baselineEnvelope, targetForBaseline, sqlTime } from '../portfolio-domain.ts';
import { PORTFOLIO_TABLES, PORTFOLIO_COLUMNS, validateGoalPortfolioSchema } from '../portfolio-schema.ts';
export const MIGRATION_KEY = 'viewer-goal-portfolio-v2-20261125';
export function migrateLegacyGoal(ownerId: string, g: PlayerGoal, catalog: CatalogAuthoritySnapshot, sourceNamespace: string, userOrder: number): PortfolioGoalV2 {
    const resolved = prepareAuthority(catalog).resolve({ namespace: sourceNamespace, sourceId: String(g.songId), difficulty: g.difficultyType, catalogRevision: catalog.catalogRevision, region: 'CN', businessPolicy: 'catalog_display', modelProfile: null });
    const identity = resolved.status === 'RESOLVED' ? resolved.value : null;
    const baseline = baselineEnvelope(ownerId, g.profileId, identity?.chartId || null, g.goalType, g.baseline, `migration:${MIGRATION_KEY}:${g.id}`);
    const target = targetForBaseline(g.goalType, g.baseline, baseline.evidenceRefs[0]!);
    const reasons = [...(!identity ? ['CHART_ID_UNRESOLVED'] : []), ...(!target ? ['TARGET_UNSUPPORTED'] : []), ...(!baseline.binding ? ['BASELINE_EVIDENCE_INSUFFICIENT'] : [])];
    return { id: g.id, goalRevision: '1', profileId: g.profileId, songId: g.songId, canonicalSongId: identity?.canonicalSongId || null, chartId: identity?.chartId || null, identityMappingRef: identity?.identityMappingRef || null, difficultyType: g.difficultyType, goalType: g.goalType, evaluatorVersion: 'goal-evaluator/1', target, targetHash: target ? hash(target) : null, legacyRecord: structuredClone(g), displaySnapshot: { title: g.title, starLevel: g.starLevel }, lifecycleStatus: g.status, availability: { state: g.unavailable ? 'unavailable' : 'unknown', reasonCodes: g.unavailable ? ['LEGACY_UNAVAILABLE'] : ['AVAILABILITY_NOT_RECHECKED'], checkedAt: g.createdAt, catalogRevision: catalog.catalogRevision }, userPriority: 1, userOrder, baseline, latestEvaluation: null, completionEvidence: g.completionEvidence || null, origin: { kind: 'legacy', acceptanceId: null, candidateId: null, decisionId: null, sourceSnapshot: { source: g.source, sourceBasis: g.sourceBasis, sourceMode: g.sourceMode, sourceRank: g.sourceRank, sourceRevision: g.sourceRevision, sourceGeneratedAt: g.sourceGeneratedAt } }, diagnostics: { reasonCodes: reasons, missingEvidence: baseline.binding ? [] : ['baseline.binding'], limitations: [] }, createdAt: g.createdAt, updatedAt: g.completedAt || g.cancelledAt || g.createdAt, pausedAt: null, completedAt: g.completedAt || null, cancelledAt: g.cancelledAt };
}
/** Offline migration: dedicated isolated test connection only, restartable DDL stages, no fake DDL rollback. */
export async function migratePortfolioV2(db: Connection, catalog: CatalogAuthoritySnapshot, { apply = false, afterStage = (_stage: string) => { } } = {}) {
    const [[identity]] = await db.query<RowDataPacket[]>('SELECT DATABASE() AS name');
    if (!String(identity?.name).endsWith('_test'))
        throw new Error('Actual isolated _test database required');
    if (apply && process.env.TAIKO_ALLOW_TEST_DB_MUTATION !== '1')
        throw new Error('Explicit test mutation opt-in required');
    // Authority validation is pure; no production catalog is opened here.
    if (!/^[a-f0-9]{64}$/.test(catalog.catalogRevision) || !Array.isArray(catalog.sourceAliases))
        throw new Error('Frozen Authority required');
    const [markers] = await db.query<RowDataPacket[]>("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='web_goal_schema_revisions'");
    if (markers.length) {
        const [active] = await db.query<RowDataPacket[]>("SELECT revision FROM web_goal_schema_revisions WHERE capability='goal-portfolio'");
        if (active[0]?.revision === 'goal-portfolio/2') {
            await validateGoalPortfolioSchema(db);
            const [[count]] = await db.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM web_player_goals');
            return { migrationKey: MIGRATION_KEY, database: identity!.name, apply, total: Number(count!.n), pending: 0, catalogRevision: catalog.catalogRevision, stages: ['already-active'] };
        }
    }
    const [rows] = await db.query<RowDataPacket[]>('SELECT CAST(g.id AS CHAR) AS id,CAST(g.user_id AS CHAR) AS user_id,CAST(g.binding_id AS CHAR) AS binding_id,g.goal_data,g.status,b.source AS binding_source,b.id AS owner_binding,b.user_id AS binding_owner,b.taiko_id AS binding_account,u.id AS owner_account FROM web_player_goals g LEFT JOIN web_taiko_bindings b ON b.id=g.binding_id LEFT JOIN web_user_accounts u ON u.id=g.user_id ORDER BY g.id');
    // Preflight every legacy record before the first DDL. Invalid JSON/unknown ownership is retained and stops activation.
    const planned: Array<{
        owner: string;
        goal: PortfolioGoalV2;
        baselineHash: string;
        legacyHash: string;
        bindingSource: string;
        bindingAccount: string;
        completionHash: string;
    }> = [];
    const order = new Map<string, number>();
    for (const row of rows) {
        if (!row.owner_account || !row.owner_binding || String(row.binding_owner) !== String(row.user_id))
            throw new Error('Goal ownership mismatch');
        const value = JSON.parse(String(row.goal_data));
        if ('lifecycleStatus' in value) {
            if (value.id !== row.id || value.profileId !== row.binding_id)
                throw new Error('Unrecognized partially migrated record');
            const key = `${row.user_id}:${row.binding_id}`;
            if (value.lifecycleStatus === 'active' || value.lifecycleStatus === 'paused')
                order.set(key, (order.get(key) || 0) + 1);
            continue;
        }
        const g = { ...value, id: String(row.id), profileId: String(row.binding_id) } as PlayerGoal;
        if (!g.baseline || !['active', 'completed', 'cancelled'].includes(g.status) || g.status !== row.status)
            throw new Error('Unrecognized legacy record; no automatic repair');
        const key = `${row.user_id}:${row.binding_id}`, index = order.get(key) || 0;
        if (g.status === 'active')
            order.set(key, index + 1);
        // Hiroba uses the same centrally catalogued source song IDs only with an explicit catalog-id alias.
        const ns = row.binding_source === 'wahlap' ? 'wahlap' : row.binding_source === 'hiroba' ? 'catalog-id' : 'unsupported';
        planned.push({ owner: String(row.user_id), goal: migrateLegacyGoal(String(row.user_id), g, catalog, ns, g.status === 'active' ? index : 0), baselineHash: hash(g.baseline), legacyHash: hash(value), bindingSource:String(row.binding_source),bindingAccount:String(row.binding_account),completionHash: hash(g.completionEvidence || null) });
    }
    const report = { migrationKey: MIGRATION_KEY, database: identity!.name, apply, total: rows.length, pending: planned.length, catalogRevision: catalog.catalogRevision, stages: [] as string[] };
    if (!apply)
        return report;
    const stage = (name: string) => { report.stages.push(name); afterStage(name); };
    const [[locked]] = await db.query<RowDataPacket[]>("SELECT GET_LOCK('viewer-goal-portfolio-v2',0) AS acquired");
    if (Number(locked?.acquired) !== 1)
        throw new Error('Migration already running');
    try {
        for (const sql of PORTFOLIO_TABLES)
            await db.execute(sql);
        stage('schema-expansion-tables');
        const [cols] = await db.query<RowDataPacket[]>("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='web_player_goals'");
        for (const [name, definition] of Object.entries(PORTFOLIO_COLUMNS))
            if (!cols.some(c => c.COLUMN_NAME === name))
                await db.execute(`ALTER TABLE web_player_goals ADD COLUMN ${name} ${definition}`);
        stage('schema-expansion-columns');
        for (const item of planned) {
            const g = item.goal;
            await db.beginTransaction();
            try {
                const [owners] = await db.query<RowDataPacket[]>('SELECT id FROM web_user_accounts WHERE id=? FOR UPDATE',[item.owner]);
                const [bindings] = await db.query<RowDataPacket[]>('SELECT CAST(id AS CHAR) AS id,taiko_id,source FROM web_taiko_bindings WHERE user_id=? ORDER BY is_current DESC,id ASC FOR UPDATE',[item.owner]);
                if(!owners.length || !bindings.some(b=>b.id===g.profileId&&b.source===item.bindingSource&&b.taiko_id===item.bindingAccount)) throw new Error('Goal ownership changed since preflight');
                await db.execute('INSERT IGNORE INTO web_goal_portfolios (user_id,binding_id,revision,updated_at) VALUES (?,?,1,?)', [item.owner, g.profileId, sqlTime(g.updatedAt)]);
                await db.query('SELECT revision FROM web_goal_portfolios WHERE user_id=? AND binding_id=? FOR UPDATE',[item.owner,g.profileId]);
                const [[current]] = await db.query<RowDataPacket[]>('SELECT goal_schema_version,goal_data,status FROM web_player_goals WHERE id=? AND user_id=? AND binding_id=? FOR UPDATE', [g.id,item.owner,g.profileId]);
                if (Number(current?.goal_schema_version) === 2) {
                    await db.commit();
                    continue;
                }
                if(current?.status!==g.lifecycleStatus || hash(JSON.parse(String(current?.goal_data)))!==item.legacyHash)throw new Error('Legacy Goal changed since preflight');
                if (hash(JSON.parse(String(current?.goal_data)).baseline) !== item.baselineHash)
                    throw new Error('Baseline changed since preflight');
                await db.execute('UPDATE web_player_goals SET goal_schema_version=2,goal_revision=1,user_priority=?,user_order=?,availability_state=?,availability_reason_codes=?,availability_checked_at=?,availability_catalog_revision=?,goal_data=? WHERE id=?', [g.userPriority, g.userOrder, g.availability.state, JSON.stringify(g.availability.reasonCodes), sqlTime(g.availability.checkedAt), catalog.catalogRevision, JSON.stringify(g), g.id]);
                await db.execute('INSERT IGNORE INTO web_goal_portfolio_events (event_id,user_id,binding_id,portfolio_revision,goal_id,command_id,event_type,event_payload,created_at) VALUES (?,?,?,1,?,?,?,?,?)', [hash({ migrationKey: MIGRATION_KEY, goalId: g.id }), item.owner, g.profileId, g.id, MIGRATION_KEY, 'legacy_migrated', JSON.stringify({ migrationKey: MIGRATION_KEY, baselineHash: item.baselineHash, completionHash: item.completionHash }), sqlTime(g.updatedAt)]);
                await db.commit();
            }
            catch (e) {
                await db.rollback();
                throw e;
            }
            stage(`legacy-goal:${g.id}`);
        }
        stage('legacy-backfill');
        const [all] = await db.query<RowDataPacket[]>('SELECT CAST(id AS CHAR) AS id,goal_schema_version,goal_data FROM web_player_goals ORDER BY id');
        if (all.length !== rows.length || all.some(r => Number(r.goal_schema_version) !== 2))
            throw new Error('Migration row count/version mismatch');
        for (const row of all) {
            const g = JSON.parse(row.goal_data) as PortfolioGoalV2;
            if (g.id !== row.id)
                throw new Error('Historical identity changed');
            if (g.origin.kind === 'legacy' && (!g.legacyRecord || hash(g.baseline.value) !== hash(g.legacyRecord.baseline) || hash(g.completionEvidence) !== hash(g.legacyRecord.completionEvidence || null)))
                throw new Error('Historical evidence changed');
        }
        stage('integrity-verification');
        const [indexes] = await db.query<RowDataPacket[]>("SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='web_player_goals' AND INDEX_NAME='uniq_goal_active_binding'");
        if (indexes.length)
            await db.execute('ALTER TABLE web_player_goals DROP INDEX uniq_goal_active_binding');
        const [generated] = await db.query<RowDataPacket[]>("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='web_player_goals' AND COLUMN_NAME='active_binding_id'");
        if (generated.length)
            await db.execute('ALTER TABLE web_player_goals DROP COLUMN active_binding_id');
        stage('legacy-constraint-removal');
        await db.execute("INSERT INTO web_goal_schema_revisions (capability,revision,migration_key,updated_at) VALUES ('goal-portfolio','goal-portfolio/2',?,UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE revision=VALUES(revision),migration_key=VALUES(migration_key)", [MIGRATION_KEY]);
        await validateGoalPortfolioSchema(db);
        stage('v2-activated');
        return report;
    }
    finally {
        await db.query("SELECT RELEASE_LOCK('viewer-goal-portfolio-v2')");
    }
}
