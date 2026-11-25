import { evaluatePortfolioGoal } from './portfolio-evaluator.ts';
import type { PortfolioEvaluateRequest, PortfolioGoalV2 } from '../../../types/goal-portfolio.ts';
import { goalBaseline } from '../../../utils/playerGoal.ts';
import { hash } from '../../../utils/multi-objective/common.ts';
import { getAccountDb } from '../../utils/account-db';
import { withDomainScoreRead } from '../taiko-domain/publication.ts';
import { readGoalSnapshot } from './snapshot';
import { portfolioBinding } from './portfolio-service';
import { readPortfolio, readGoal, readCommandReplay, updateGoalEvaluation, PortfolioConflict } from './portfolio-store.ts';
import { allowed, decimal, invalid } from './portfolio-domain.ts';
import { hasNewSyncObservation, type SyncObservation } from './sync-observation.ts';
export async function evaluatePortfolio(userId: number, input: PortfolioEvaluateRequest, syncBefore?: SyncObservation | null) {
    allowed(input, ['profileId', 'expectedPortfolioRevision', 'commandId', 'goalIds', 'explicitPausedEvaluation']);
    if (!decimal(input.profileId) || !decimal(input.expectedPortfolioRevision) || typeof input.commandId !== 'string' || !/^[A-Za-z0-9:_-]{1,128}$/.test(input.commandId) || input.explicitPausedEvaluation !== undefined && typeof input.explicitPausedEvaluation !== 'boolean' || input.goalIds !== undefined && (!Array.isArray(input.goalIds) || input.goalIds.length > 100 || new Set(input.goalIds).size !== input.goalIds.length || input.goalIds.some(id => !decimal(id))))
        invalid('invalid-portfolio-evaluation');
    const binding = await portfolioBinding(userId, input.profileId), db = getAccountDb(), requestHash = hash({ action: 'evaluate', ...input });
    const replay = await readCommandReplay(db, userId, input.profileId, input.commandId, requestHash);
    if (replay)
        return replay;
    if (binding.source === 'manual')
        invalid('trusted-score-source-required');
    return withDomainScoreRead(binding.taiko_id, async () => {
        const portfolio = await readPortfolio(db, userId, input.profileId);
        if (portfolio.portfolioRevision !== input.expectedPortfolioRevision)
            throw new PortfolioConflict('portfolio-revision', portfolio.portfolioRevision);
        const chosen = input.goalIds ? [] as PortfolioGoalV2[] : portfolio.goals.filter(g => g.lifecycleStatus === 'active');
        if (input.goalIds)
            for (const id of input.goalIds) {
                const goal = portfolio.goals.find(g => g.id === id) || await readGoal(db, userId, input.profileId, id);
                if (!goal)
                    throw new PortfolioConflict('goal-unavailable', portfolio.portfolioRevision);
                if (goal.lifecycleStatus === 'cancelled')
                    invalid('goal-is-cancelled');
                chosen.push(goal);
            }
        if (chosen.length > 100)
            invalid('goal-evaluation-limit');
        const goals = chosen.filter(g => g.lifecycleStatus === 'active' || input.explicitPausedEvaluation && g.lifecycleStatus === 'paused');
        // Exactly one frozen score read per batch; never under SQL owner/portfolio locks.
        const snapshot = goals.length ? await readGoalSnapshot(binding.taiko_id, true) : null;
        const [locks] = goals.length ? await db.execute<any[]>('SELECT song_no,level FROM web_song_locks WHERE taiko_id=? AND is_locked=1', [binding.taiko_id]) : [[]];
        const locked = new Set(locks.map((r: any) => `${r.song_no}:${r.level}`));
        const updates = goals.map(g => evaluatePortfolioGoal(userId, g, { ownerId: userId, profileId: input.profileId, songId: g.songId!, difficultyType: g.difficultyType!, revision: snapshot!.revision, capturedAt: snapshot!.capturedAt, provenance: locked.has(`${g.songId}:${g.difficultyType}`) || syncBefore !== undefined && !hasNewSyncObservation(syncBefore, snapshot!) ? null : snapshot!.provenance, state: goalBaseline(snapshot!.current.songs?.find(r => Number(r.song_no) === g.songId && Number(r.level) === g.difficultyType), snapshot!.revision, snapshot!.capturedAt) }));
        return updateGoalEvaluation(db, userId, input, updates, { identity: { taikoId: binding.taiko_id, source: binding.source }, requestHash, verifyEvidence: async (c) => {
                if (!snapshot)
                    return;
                const [current] = await c.execute<any[]>('SELECT song_no,level FROM web_song_locks WHERE taiko_id=? AND is_locked=1', [binding.taiko_id]);
                if (hash(current.map(r => `${r.song_no}:${r.level}`).sort()) !== hash([...locked].sort()))
                    throw new PortfolioConflict('score-lock-changed');
            } });
    });
}
