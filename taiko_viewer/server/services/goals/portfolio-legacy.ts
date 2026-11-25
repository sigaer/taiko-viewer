import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { createError } from 'h3';
import { evaluatorGoal, semanticTarget, targetForBaseline } from './portfolio-domain.ts';
import { same } from '../../../utils/multi-objective/common.ts';
import type { PortfolioGoalV2 } from '../../../types/goal-portfolio.ts';
export async function legacyPortfolioProjection(db: Pick<Pool, 'execute'> | PoolConnection, userId: number, profileId: string, completed = false) {
    const [rows] = await db.execute<RowDataPacket[]>("SELECT CAST(g.id AS CHAR) AS id,g.goal_data FROM web_player_goals g JOIN web_taiko_bindings b ON b.id=g.binding_id AND b.user_id=g.user_id JOIN web_user_accounts u ON u.id=g.user_id WHERE g.user_id=? AND g.binding_id=? AND g.status IN ('active','paused') ORDER BY g.id LIMIT 2", [userId, profileId]);
    const upgrade = () => { throw createError({ statusCode: 409, statusMessage: 'goal-portfolio-upgrade-required' }); };
    if (rows.length > 1)
        upgrade();
    const goal = rows[0] ? JSON.parse(String(rows[0].goal_data)) as PortfolioGoalV2 : null;
    if (goal && (goal.lifecycleStatus !== 'active' || goal.availability.state === 'unknown' || goal.origin.kind !== 'legacy' || goal.baseline.version !== 1 || !goal.target || !same(semanticTarget(goal.target), semanticTarget(targetForBaseline(goal.goalType, goal.baseline.value, goal.baseline.evidenceRefs[0]!)))))
        upgrade();
    if (!completed)
        return goal ? { ...evaluatorGoal(goal), legacyProjection: true as const } : null;
    if (goal)
        return null;
    const [history] = await db.execute<RowDataPacket[]>('SELECT g.goal_data FROM web_player_goals g JOIN web_taiko_bindings b ON b.id=g.binding_id AND b.user_id=g.user_id JOIN web_user_accounts u ON u.id=g.user_id WHERE g.user_id=? AND g.binding_id=? ORDER BY g.id DESC LIMIT 1', [userId, profileId]);
    const recent = history[0] ? JSON.parse(String(history[0].goal_data)) as PortfolioGoalV2 : null;
    return recent?.lifecycleStatus === 'completed' ? { ...evaluatorGoal(recent), legacyProjection: true as const } : null;
}
