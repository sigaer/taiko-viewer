import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { createError, H3Error } from 'h3';
import { hash } from '../../../utils/multi-objective/common.ts';
import type { GoalPortfolioV2, PortfolioGoalV2, PortfolioCommand, PortfolioCommandResponse, GoalEvaluationV2 } from '../../../types/goal-portfolio.ts';
import { allowed, decimal, invalid, sameGoalTarget, sqlTime, terminal, verifyBaseline } from './portfolio-domain.ts';
export type PortfolioIdentity = {
    taikoId: string;
    source: string;
};
export class PortfolioConflict extends H3Error {
    statusCode = 409;
    statusMessage = 'goal-portfolio-conflict';
    data: {
        portfolioRevision?: string;
        goalRevision?: string;
        reason: string;
    };
    constructor(reason: string, portfolioRevision?: string, goalRevision?: string) { super(reason); this.data = { reason, portfolioRevision, goalRevision }; }
}
type DB = Pick<Pool, 'execute'>;
const rowGoal = (row: RowDataPacket): PortfolioGoalV2 => {
    const g = JSON.parse(String(row.goal_data));
    if (g.id !== String(row.id) || g.goalRevision !== String(row.goal_revision) || g.lifecycleStatus !== row.status || g.profileId !== String(row.profile_id) || Number(row.goal_schema_version) !== 2 || g.userPriority !== Number(row.user_priority) || g.userOrder !== Number(row.user_order) || g.availability.state !== row.availability_state)
        throw createError({ statusCode: 503, statusMessage: 'goal-portfolio-integrity-error' });
    return g;
};
const goalColumns = 'CAST(id AS CHAR) AS id,CAST(binding_id AS CHAR) AS profile_id,CAST(goal_revision AS CHAR) AS goal_revision,goal_schema_version,user_priority,user_order,availability_state,status,goal_data';
export async function readPortfolioRevision(db: DB, userId: number, profileId: string): Promise<string> { const [rows] = await db.execute<RowDataPacket[]>('SELECT CAST(revision AS CHAR) AS revision FROM web_goal_portfolios WHERE user_id=? AND binding_id=?', [userId, profileId]); return String(rows[0]?.revision || '0'); }
export async function readGoal(db: DB, userId: number, profileId: string, goalId: string) { const [rows] = await db.execute<RowDataPacket[]>(`SELECT ${goalColumns} FROM web_player_goals WHERE user_id=? AND binding_id=? AND id=?`, [userId, profileId, goalId]); return rows[0] ? rowGoal(rows[0]) : null; }
export async function readPortfolio(db: DB, userId: number, profileId: string): Promise<GoalPortfolioV2> {
    const [rows] = await db.execute<RowDataPacket[]>(`SELECT ${goalColumns} FROM web_player_goals WHERE user_id=? AND binding_id=? AND status IN ('active','paused') ORDER BY user_order,id LIMIT 101`, [userId, profileId]);
    if (rows.length > 100)
        throw createError({ statusCode: 503, statusMessage: 'goal-portfolio-limit-integrity-error' });
    const [portfolios] = await db.execute<RowDataPacket[]>('SELECT CAST(revision AS CHAR) AS revision,updated_at FROM web_goal_portfolios WHERE user_id=? AND binding_id=?', [userId, profileId]);
    return { schemaVersion: 2, ownerId: String(userId), profileId, portfolioRevision: String(portfolios[0]?.revision || '0'), updatedAt: portfolios[0] ? new Date(portfolios[0].updated_at).toISOString() : '1970-01-01T00:00:00.000Z', goals: rows.map(rowGoal) };
}
export async function readGoalHistory(db: DB, userId: number, profileId: string, snapshotRevision: string, cursor?: string, limit = 20) {
    if (!decimal(snapshotRevision) || !Number.isInteger(limit) || limit < 1 || limit > 100)
        invalid('invalid-portfolio-pagination');
    let last = '18446744073709551615';
    if (cursor) {
        try {
            const c = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
            if (Object.keys(c).sort().join(',') !== 'last,owner,profile,revision' || c.owner !== String(userId) || c.profile !== profileId || c.revision !== snapshotRevision || !decimal(c.last))
                invalid('invalid-portfolio-cursor');
            last = c.last;
        }
        catch {
            invalid('invalid-portfolio-cursor');
        }
    }
    const [rows] = await db.execute<RowDataPacket[]>(`SELECT ${goalColumns} FROM web_player_goals g WHERE user_id=? AND binding_id=? AND status IN ('completed','cancelled') AND id${cursor ? '<' : '<='}? AND EXISTS (SELECT 1 FROM web_goal_portfolio_events e WHERE e.user_id=g.user_id AND e.binding_id=g.binding_id AND e.goal_id=g.id AND e.portfolio_revision<=? AND e.event_type IN ('completed','cancel_goal','legacy_migrated')) ORDER BY id DESC LIMIT ${limit + 1}`, [userId, profileId, last, snapshotRevision]);
    const page = rows.slice(0, limit).map(rowGoal);
    const nextCursor = rows.length > limit ? Buffer.from(JSON.stringify({ owner: String(userId), profile: profileId, revision: snapshotRevision, last: page.at(-1)!.id })).toString('base64url') : null;
    return { goals: page, nextCursor };
}
export async function readCommandReplay(db: DB, userId: number, profileId: string, commandId: string, requestHash: string) {
    const [rows] = await db.execute<RowDataPacket[]>('SELECT request_hash,response_json FROM web_goal_portfolio_commands WHERE user_id=? AND binding_id=? AND command_id=?', [userId, profileId, commandId]);
    if (!rows.length)
        return null;
    if (rows[0].request_hash !== requestHash)
        throw new PortfolioConflict('command-payload-changed');
    return { ...JSON.parse(String(rows[0].response_json)), replayed: true } as PortfolioCommandResponse;
}
export function validateCommand(command: PortfolioCommand) {
    allowed(command, ['profileId', 'expectedPortfolioRevision', 'commandId', 'operations']);
    if (!decimal(command.profileId) || command.profileId === '0' || !decimal(command.expectedPortfolioRevision) || typeof command.commandId !== 'string' || !/^[A-Za-z0-9:_-]{1,128}$/.test(command.commandId) || !Array.isArray(command.operations) || command.operations.length > 100)
        invalid();
    for (const op of command.operations) {
        if (!op || typeof op !== 'object')
            invalid();
        if (op.type === 'create_manual_goal') {
            allowed(op, ['type', 'songId', 'difficultyType', 'goalType', 'target']);
            if (!Number.isSafeInteger(op.songId) || op.songId < 1 || !Number.isInteger(op.difficultyType) || op.difficultyType < 1 || op.difficultyType > 5 || !op.target)
                invalid();
        }
        else if (op.type === 'accept_recommendation') {
            allowed(op, ['type', 'recommendationToken']);
            if (typeof op.recommendationToken !== 'string')
                invalid();
        }
        else if (op.type === 'reorder_goals') {
            allowed(op, ['type', 'goalIds', 'expectedGoalRevisions']);
            if (!Array.isArray(op.goalIds) || op.goalIds.length > 100 || !op.expectedGoalRevisions || typeof op.expectedGoalRevisions !== 'object' || Array.isArray(op.expectedGoalRevisions))
                invalid();
        }
        else if (['pause_goal', 'resume_goal', 'cancel_goal', 'set_goal_priority'].includes(op.type)) {
            allowed(op, op.type === 'set_goal_priority' ? ['type', 'goalId', 'expectedGoalRevision', 'userPriority'] : ['type', 'goalId', 'expectedGoalRevision']);
            if (!decimal(op.goalId) || !decimal(op.expectedGoalRevision) || ('userPriority' in op && (!Number.isInteger(op.userPriority) || op.userPriority < 0 || op.userPriority > 3)))
                invalid();
        }
        else
            invalid('unsupported-portfolio-operation');
    }
}
type TransactionInput = {
    profileId: string;
    expectedPortfolioRevision: string;
    commandId: string;
};
type Options = {
    identity: PortfolioIdentity;
    nonce?: string;
    verifyEvidence?: (connection: PoolConnection) => Promise<void>;
};
type Mutation = {
    goals: PortfolioGoalV2[];
    changed: Map<string, string>;
    created: PortfolioGoalV2[];
    existing: string[];
    evaluations?: Map<string, GoalEvaluationV2>;
};
async function transact(db: Pool, userId: number, input: TransactionInput, requestHash: string, options: Options, mutate: (state: Mutation, connection: PoolConnection, revision: string) => Promise<void>): Promise<PortfolioCommandResponse> {
    const c = await db.getConnection();
    try {
        await c.beginTransaction();
        const [owners] = await c.execute<RowDataPacket[]>('SELECT id FROM web_user_accounts WHERE id=? FOR UPDATE', [userId]);
        const [bindings] = await c.execute<RowDataPacket[]>('SELECT CAST(id AS CHAR) AS id,taiko_id,source,is_current FROM web_taiko_bindings WHERE user_id=? ORDER BY is_current DESC,id ASC FOR UPDATE', [userId]);
        if (!owners.length || String(bindings[0]?.id) !== input.profileId || Number(bindings[0]?.is_current) !== 1 || bindings[0]?.taiko_id !== options.identity.taikoId || bindings[0]?.source !== options.identity.source)
            throw new PortfolioConflict('profile-changed');
        const [portfolios] = await c.execute<RowDataPacket[]>('SELECT CAST(revision AS CHAR) AS revision FROM web_goal_portfolios WHERE user_id=? AND binding_id=? FOR UPDATE', [userId, input.profileId]);
        const revision = String(portfolios[0]?.revision || '0');
        const [rows] = await c.execute<RowDataPacket[]>(`SELECT ${goalColumns} FROM web_player_goals WHERE user_id=? AND binding_id=? AND status IN ('active','paused') ORDER BY id FOR UPDATE`, [userId, input.profileId]);
        const replay = await readCommandReplay(c, userId, input.profileId, input.commandId, requestHash);
        if (replay) {
            await c.commit();
            return replay;
        }
        if (input.expectedPortfolioRevision !== revision)
            throw new PortfolioConflict('portfolio-revision', revision);
        if (options.nonce) {
            const [used] = await c.execute<RowDataPacket[]>('SELECT command_id FROM web_goal_portfolio_commands WHERE user_id=? AND binding_id=? AND nonce=?', [userId, input.profileId, options.nonce]);
            if (used.length)
                throw new PortfolioConflict('recommendation-nonce-consumed', revision);
        }
        await options.verifyEvidence?.(c);
        const state: Mutation = { goals: rows.map(rowGoal), changed: new Map(), created: [], existing: [] };
        await mutate(state, c, revision);
        const nonterminal = state.goals.filter(g => !terminal(g)).sort((a, b) => a.userOrder - b.userOrder || (BigInt(a.id || '0') < BigInt(b.id || '0') ? -1 : 1));
        if (nonterminal.length > 100)
            invalid('goal-portfolio-limit');
        nonterminal.forEach((g, i) => {
            if (g.userOrder !== i) {
                g.userOrder = i;
                state.changed.set(g.id, state.changed.get(g.id) || 'order_normalized');
            }
        });
        const dirty = state.changed.size > 0 || state.created.length > 0;
        const next = dirty ? (BigInt(revision) + 1n).toString() : revision;
        if (!decimal(next))
            invalid('portfolio-revision-exhausted');
        const now = new Date().toISOString(), time = sqlTime(now);
        // Owner lock serializes lazy creation; GET never creates the row.
        if (!portfolios.length)
            await c.execute('INSERT INTO web_goal_portfolios (user_id,binding_id,revision,updated_at) VALUES (?,?,?,?)', [userId, input.profileId, revision, time]);
        for (const g of state.created) {
            const [inserted] = await c.execute<ResultSetHeader>(`INSERT INTO web_player_goals (user_id,binding_id,song_id,difficulty_type,goal_type,source,source_basis,source_mode,source_rank,source_revision,source_generated_at,status,baseline_version,goal_schema_version,goal_revision,user_priority,user_order,availability_state,availability_reason_codes,availability_checked_at,availability_catalog_revision,goal_data,created_at,updated_at) VALUES (?,?,?,?,?,'manual-goal',NULL,'manual',1,?,?,'active',1,2,1,?,?,?,?,?,?,?,?,?)`, [userId, input.profileId, g.songId, g.difficultyType, g.goalType, g.baseline.sourceRevision, sqlTime(g.baseline.capturedAt), g.userPriority, g.userOrder, g.availability.state, JSON.stringify(g.availability.reasonCodes), sqlTime(g.availability.checkedAt), g.availability.catalogRevision, JSON.stringify(g), time, time]);
            const [[idRow]] = await c.query<RowDataPacket[]>('SELECT CAST(LAST_INSERT_ID() AS CHAR) AS id');
            if (!idRow?.id || !inserted.affectedRows)
                throw new Error('Goal insert failed');
            const old = g.id;
            g.id = String(idRow.id);
            state.changed.delete(old);
            state.changed.set(g.id, 'created');
            g.createdAt = now;
            g.updatedAt = now;
        }
        const affected = state.goals.filter(g => state.changed.has(g.id));
        for (const g of affected) {
            if (!state.created.includes(g)) {
                g.goalRevision = (BigInt(g.goalRevision) + 1n).toString();
                if (!decimal(g.goalRevision))
                    invalid('goal-revision-exhausted');
            }
            g.updatedAt = now;
            await c.execute('UPDATE web_player_goals SET goal_data=?,status=?,goal_revision=?,user_priority=?,user_order=?,availability_state=?,availability_reason_codes=?,availability_checked_at=?,availability_catalog_revision=?,completed_at=?,cancelled_at=?,updated_at=? WHERE id=? AND user_id=? AND binding_id=?', [JSON.stringify(g), g.lifecycleStatus, g.goalRevision, g.userPriority, g.userOrder, g.availability.state, JSON.stringify(g.availability.reasonCodes), sqlTime(g.availability.checkedAt), g.availability.catalogRevision, g.completedAt ? sqlTime(g.completedAt) : null, g.cancelledAt ? sqlTime(g.cancelledAt) : null, time, g.id, userId, input.profileId]);
            const evaluation = state.evaluations?.get(g.id);
            await c.execute('INSERT INTO web_goal_portfolio_events (event_id,user_id,binding_id,portfolio_revision,goal_id,command_id,event_type,event_payload,created_at) VALUES (?,?,?,?,?,?,?,?,?)', [evaluation?.evaluationId || hash({ userId, profileId: input.profileId, commandId: input.commandId, goalId: g.id }), userId, input.profileId, next, g.id, input.commandId, g.lifecycleStatus === 'completed' ? 'completed' : state.changed.get(g.id)!, JSON.stringify(evaluation || { goalRevision: g.goalRevision, lifecycleStatus: g.lifecycleStatus }), time]);
        }
        if (dirty)
            await c.execute('UPDATE web_goal_portfolios SET revision=?,updated_at=? WHERE user_id=? AND binding_id=?', [next, time, userId, input.profileId]);
        const response: PortfolioCommandResponse = { newPortfolioRevision: next, affectedGoals: affected, createdGoals: state.created, updatedGoals: affected.filter(g => !state.created.includes(g)), existingGoalIds: state.existing, diagnostics: [], replayed: false };
        await c.execute('INSERT INTO web_goal_portfolio_commands (user_id,binding_id,command_id,request_hash,nonce,before_revision,after_revision,response_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)', [userId, input.profileId, input.commandId, requestHash, options.nonce || null, revision, next, JSON.stringify(response), time]);
        await c.commit();
        return response;
    }
    catch (error) {
        await c.rollback();
        if ((error as {
            code?: string;
        }).code === 'ER_DUP_ENTRY')
            throw new PortfolioConflict('command-or-nonce-conflict');
        throw error;
    }
    finally {
        c.release();
    }
}
export async function executePortfolioCommand(db: Pool, userId: number, command: PortfolioCommand, options: Options & {
    preparedGoals?: Map<number, PortfolioGoalV2>;
}) {
    validateCommand(command);
    return transact(db, userId, command, hash(command), options, async (state, _c, revision) => {
        const original = new Map(state.goals.map(g => [g.id, g.goalRevision]));
        for (const [index, op] of command.operations.entries()) {
            if (op.type === 'accept_recommendation')
                invalid('recommendation-v2-unavailable');
            if (op.type === 'create_manual_goal') {
                const prepared = options.preparedGoals?.get(index);
                if (!prepared || prepared.profileId !== command.profileId || !prepared.target || !verifyBaseline(prepared, String(userId)))
                    invalid('trusted-baseline-required');
                const existing = state.goals.find(g => !terminal(g) && sameGoalTarget(g, prepared));
                if (existing) {
                    state.existing.push(existing.id);
                    continue;
                }
                const g = structuredClone(prepared);
                g.id = `${0 - index}`;
                g.userOrder = state.goals.filter(g => !terminal(g)).length;
                state.goals.push(g);
                state.created.push(g);
                continue;
            }
            if (op.type === 'reorder_goals') {
                const goals = state.goals.filter(g => !terminal(g));
                if (op.goalIds.length !== goals.length || new Set(op.goalIds).size !== goals.length || op.goalIds.some(id => !decimal(id) || !goals.some(g => g.id === id)) || Object.keys(op.expectedGoalRevisions).sort().join(',') !== op.goalIds.slice().sort().join(','))
                    invalid('reorder-all-nonterminal-goals-required');
                for (const g of goals) {
                    if (op.expectedGoalRevisions[g.id] !== original.get(g.id))
                        throw new PortfolioConflict('goal-revision', revision, g.goalRevision);
                    const order = op.goalIds.indexOf(g.id);
                    if (g.userOrder !== order) {
                        g.userOrder = order;
                        state.changed.set(g.id, 'reorder_goals');
                    }
                }
                continue;
            }
            const g = state.goals.find(g => g.id === op.goalId);
            if (!g)
                throw new PortfolioConflict('goal-unavailable', revision);
            if (op.expectedGoalRevision !== original.get(g.id))
                throw new PortfolioConflict('goal-revision', revision, g.goalRevision);
            if (terminal(g))
                invalid('goal-is-terminal');
            const now = new Date().toISOString();
            if (op.type === 'pause_goal') {
                if (g.lifecycleStatus !== 'active')
                    invalid('goal-not-active');
                g.lifecycleStatus = 'paused';
                g.pausedAt = now;
            }
            if (op.type === 'resume_goal') {
                if (g.lifecycleStatus !== 'paused')
                    invalid('goal-not-paused');
                g.lifecycleStatus = 'active';
                g.pausedAt = null;
            }
            if (op.type === 'cancel_goal') {
                g.lifecycleStatus = 'cancelled';
                g.cancelledAt = now;
            }
            if (op.type === 'set_goal_priority') {
                if (g.userPriority === op.userPriority)
                    continue;
                g.userPriority = op.userPriority;
            }
            state.changed.set(g.id, op.type);
        }
    });
}
export type EvaluationUpdate = {
    goal: PortfolioGoalV2;
    evaluation: GoalEvaluationV2;
    completionEvidence: PortfolioGoalV2['completionEvidence'];
};
export async function updateGoalEvaluation(db: Pool, userId: number, input: TransactionInput, updates: EvaluationUpdate[], options: Options & {
    requestHash: string;
}) {
    if (updates.length > 100)
        invalid('goal-evaluation-limit');
    return transact(db, userId, input, options.requestHash, options, async (state, c, revision) => {
        state.evaluations = new Map();
        for (const u of updates) {
            const g = state.goals.find(g => g.id === u.goal.id);
            if (!g)
                throw new PortfolioConflict('goal-state-changed', revision);
            if (g.goalRevision !== u.goal.goalRevision || hash(g.baseline) !== hash(u.goal.baseline) || g.targetHash !== u.goal.targetHash)
                throw new PortfolioConflict('goal-revision', revision, g.goalRevision);
            const [seen] = await c.execute<RowDataPacket[]>('SELECT event_id FROM web_goal_portfolio_events WHERE event_id=? AND user_id=? AND binding_id=?', [u.evaluation.evaluationId, userId, input.profileId]);
            if (seen.length)
                continue;
            g.latestEvaluation = u.evaluation;
            if (u.evaluation.outcome === 'completed') {
                g.lifecycleStatus = 'completed';
                g.completedAt = u.evaluation.evaluatedAt;
                g.completionEvidence = u.completionEvidence;
            }
            state.changed.set(g.id, 'evaluated');
            state.evaluations.set(g.id, u.evaluation);
        }
    });
}
