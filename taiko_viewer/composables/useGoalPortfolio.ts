import type { PortfolioResponse, PortfolioOperation, PortfolioCommand, PortfolioCommandResponse, PortfolioEvaluateRequest } from '~/types/goal-portfolio';
export function useGoalPortfolio(identity: () => string, profileId: () => string) {
    const api = useViewerApiFetch();
    const data = ref<PortfolioResponse | null>(null), loading = ref(false), busy = ref(false), error = ref(''), unavailable = ref(false), legacy = ref(false);
    let generation = 0;
    let lastWrite: {
        url: string;
        body: PortfolioCommand | PortfolioEvaluateRequest;
    } | null = null;
    const status = (e: any) => Number(e?.statusCode || e?.status || e?.response?.status);
    async function refresh(cursor?: string) {
        const g = generation;
        if (!profileId())
            return;
        loading.value = true;
        try {
            const result = await api<PortfolioResponse>('/api/account/growth/goal-portfolio', { query: { profileId: profileId(), ...(cursor ? { cursor, snapshotRevision: data.value!.snapshotRevision } : {}) } });
            if (g !== generation || result.profileId !== profileId())
                return;
            if (cursor && data.value) {
                const existing = new Map(data.value.goals.filter(x => ['completed', 'cancelled'].includes(x.lifecycleStatus)).map(x => [x.id, x]));
                for (const goal of result.goals)
                    existing.set(goal.id, goal);
                data.value = { ...result, goals: [...existing.values()] };
            }
            else
                data.value = result;
            unavailable.value = false;
            legacy.value = false;
        }
        catch (e: any) {
            if (g === generation) {
                legacy.value = e?.data?.data?.code === 'GOAL_PORTFOLIO_NOT_MIGRATED' || e?.data?.statusMessage === 'goal-portfolio-not-migrated';
                unavailable.value = status(e) === 503;
                error.value = 'loadError';
            }
        }
        finally {
            if (g === generation)
                loading.value = false;
        }
    }
    async function send(url: string, body: PortfolioCommand | PortfolioEvaluateRequest) {
        if (busy.value)
            return;
        const g = generation;
        busy.value = true;
        error.value = '';
        lastWrite = { url, body };
        try {
            const response = await api<PortfolioCommandResponse>(url, { method: 'POST', body });
            if (g !== generation)
                return;
            lastWrite = null;
            if (data.value) {
                const goals = new Map(data.value.goals.map(x => [x.id, x]));
                for (const goal of response.affectedGoals)
                    goals.set(goal.id, goal);
                data.value = { ...data.value, portfolioRevision: response.newPortfolioRevision, goals: [...goals.values()] };
            }
            await refresh();
            return response;
        }
        catch (e) {
            if (g === generation) {
                if (status(e) === 409) {
                    lastWrite = null;
                    await refresh();
                    error.value = 'conflict';
                }
                else
                    error.value = 'actionError';
            }
        }
        finally {
            if (g === generation)
                busy.value = false;
        }
    }
    function command(operations: PortfolioOperation[]) {
        if (!data.value)
            return;
        return send('/api/account/growth/goal-portfolio/commands', { profileId: profileId(), expectedPortfolioRevision: data.value.portfolioRevision, commandId: crypto.randomUUID(), operations });
    }
    function evaluate(goalIds?: string[], explicitPausedEvaluation = false) {
        if (!data.value)
            return;
        return send('/api/account/growth/goal-portfolio/evaluate', { profileId: profileId(), expectedPortfolioRevision: data.value.portfolioRevision, commandId: crypto.randomUUID(), ...(goalIds ? { goalIds } : {}), explicitPausedEvaluation });
    }
    const retryWrite = () => lastWrite ? send(lastWrite.url, lastWrite.body) : refresh();
    watch(identity, () => { generation++; data.value = null; error.value = ''; unavailable.value = false; legacy.value = false; lastWrite = null; busy.value = false; void refresh(); }, { immediate: true });
    onBeforeUnmount(() => { generation++; });
    return { data, loading, busy, error, unavailable, legacy, refresh, command, evaluate, retryWrite };
}
