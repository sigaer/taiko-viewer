import { getHeader, createError, type H3Event } from 'h3';
import { getCurrentBindingRow } from '../../internal/account/shared';
import { getAccountDb } from '../../utils/account-db';
import { getGoalSchemaVersion } from './portfolio-schema';
import { legacyPortfolioProjection } from './portfolio-legacy';
/** Explicit read negotiation prevents old clients from silently mistaking multiple Goals for an empty view. */
export async function negotiatePortfolioRead<T extends {
    profileId?: string;
}>(event: H3Event, userId: number, result: T) {
    const db = getAccountDb();
    if (await getGoalSchemaVersion(db) === 1 || getHeader(event, 'x-goal-portfolio-schema') === '2')
        return result;
    const binding = await getCurrentBindingRow(userId);
    if (!binding || result.profileId !== String(binding.id))
        throw createError({ statusCode: 409, statusMessage: 'profile-changed' });
    const activeGoal = await legacyPortfolioProjection(db, userId, String(binding.id));
    const recentCompletedGoal = activeGoal ? null : await legacyPortfolioProjection(db, userId, String(binding.id), true);
    return { ...result, activeGoal, recentCompletedGoal, legacyProjection: true };
}
