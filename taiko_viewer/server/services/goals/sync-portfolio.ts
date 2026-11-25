import { randomUUID } from 'node:crypto';
import { getAccountDb } from '../../utils/account-db';
import { getGoalSchemaVersion } from './portfolio-schema';
import { readPortfolioRevision, PortfolioConflict } from './portfolio-store';
import { evaluatePortfolio } from './portfolio-evaluation';
import { evaluateCurrentGoalForBinding } from './evaluation';
import type { SyncObservation } from './sync-observation';
export async function evaluateGoalsAfterSync(userId: number, profileId: string, before: SyncObservation | null) {
    const db = getAccountDb();
    if (await getGoalSchemaVersion(db) === 1)
        return evaluateCurrentGoalForBinding(userId, { profileId }, before);
    let result;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            result = await evaluatePortfolio(userId, { profileId, expectedPortfolioRevision: await readPortfolioRevision(db, userId, profileId), commandId: `sync:${randomUUID()}` }, before);
            break;
        }
        catch (error) {
            if (!(error instanceof PortfolioConflict) || !['portfolio-revision', 'goal-revision'].includes(error.data.reason) || attempt === 2)
                throw error;
        }
    }
    if (!result)
        throw new Error('Evaluation retry exhausted');
    return { profileId, outcome: result.affectedGoals.some(g => g.lifecycleStatus === 'completed') ? 'completed' as const : 'active' as const, activeGoal: null, recentCompletedGoal: null, portfolioEvaluation: result };
}
