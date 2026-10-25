import type {
  ChartDifficultyCode,
  ChartDifficultyVoteValue,
  ChartUgcSummary,
  ViewerChartUgcState
} from "~/types/ugc";
import { trackViewerEvent } from "~/utils/analytics";

type DifficultyQueue = {
  confirmed: ChartDifficultyVoteValue | null;
  desired: ChartDifficultyVoteValue | null;
  running: boolean;
};

type TagQueue = {
  confirmed: string[];
  desired: string[];
  running: boolean;
};

type HelpfulQueue = { desired: boolean; confirmed: boolean; running: boolean };
type TipQueue = { desired: string; confirmed: string; running: boolean };

const sameTags = (left: string[], right: string[]) =>
  left.length === right.length && left.every((slug, index) => slug === right[index]);

const activeTagsFromState = (state: ViewerChartUgcState) =>
  state.tagSelections.filter((tag) => tag.status === "active").map((tag) => tag.slug).sort();

export const useChartUgc = async (
  songId: MaybeRefOrGetter<number>,
  difficultyCode: MaybeRefOrGetter<ChartDifficultyCode>
) => {
  const apiFetch = useViewerApiFetch();
  const localePath = useLocalePath();
  const { accountUser, resolveAccountUser } = useAccountAuthStatus();
  const requestKey = () => `${toValue(songId)}-${toValue(difficultyCode)}`;
  const keyForState = (state: ViewerChartUgcState) => `${state.chart.songId}-${state.chart.difficultyCode}`;

  const publicState = useAsyncData<ChartUgcSummary | null>(
    () => `chart-ugc-public-${requestKey()}`,
    () => apiFetch<ChartUgcSummary>(
      `/api/content/songs/${toValue(songId)}/ugc?difficulty=${toValue(difficultyCode)}`
    ),
    {
      default: () => null,
      watch: [() => toValue(songId), () => toValue(difficultyCode)],
      dedupe: "cancel"
    }
  );

  const privateState = useLazyAsyncData<ViewerChartUgcState | null>(
    () => `chart-ugc-private-${requestKey()}`,
    async () => {
      const user = await resolveAccountUser();
      if (!user || !accountUser.value) return null;
      return apiFetch<ViewerChartUgcState>(
        `/api/account/charts/${toValue(songId)}/${toValue(difficultyCode)}/ugc/me`
      );
    },
    {
      default: () => null,
      server: false,
      watch: [() => toValue(songId), () => toValue(difficultyCode), accountUser],
      dedupe: "cancel"
    }
  );

  const viewerStates = reactive<Record<string, ViewerChartUgcState | null>>({});
  const difficultyQueues = new Map<string, DifficultyQueue>();
  const tagQueues = new Map<string, TagQueue>();
  const helpfulQueues = new Map<string, HelpfulQueue>();
  const tipQueues = new Map<string, TipQueue>();
  const difficultySavingByKey = reactive<Record<string, boolean>>({});
  const tagSavingByKey = reactive<Record<string, boolean>>({});
  const difficultyErrorByKey = reactive<Record<string, string | null>>({});
  const tagErrorByKey = reactive<Record<string, string | null>>({});
  const tipSavingByKey = reactive<Record<string, boolean>>({});
  const tipErrorByKey = reactive<Record<string, string | null>>({});
  const helpfulSavingById = reactive<Record<string, boolean>>({});
  const helpfulErrorById = reactive<Record<string, string | null>>({});
  const reportSavingById = reactive<Record<string, boolean>>({});
  const reportErrorById = reactive<Record<string, string | null>>({});
  const reportSuccessById = reactive<Record<string, boolean>>({});

  const installViewerState = (state: ViewerChartUgcState) => {
    const key = keyForState(state);
    viewerStates[key] = state;
    const difficultyQueue = difficultyQueues.get(key);
    if (!difficultyQueue?.running) {
      difficultyQueues.set(key, {
        confirmed: state.difficultyVote,
        desired: state.difficultyVote,
        running: false
      });
    }
    const tagQueue = tagQueues.get(key);
    if (!tagQueue?.running) {
      const activeTags = activeTagsFromState(state);
      tagQueues.set(key, { confirmed: activeTags, desired: activeTags, running: false });
    }
  };

  watch(privateState.data, (state) => {
    if (state) installViewerState(state);
  }, { immediate: true });

  const viewerState = computed(() => viewerStates[requestKey()] || null);
  const publicSummary = computed(() => publicState.data.value);
  const difficultySaving = computed(() => Boolean(difficultySavingByKey[requestKey()]));
  const tagSaving = computed(() => Boolean(tagSavingByKey[requestKey()]));
  const difficultyError = computed(() => difficultyErrorByKey[requestKey()] || null);
  const tagError = computed(() => tagErrorByKey[requestKey()] || null);
  const interactionUnavailable = computed(() => Boolean(accountUser.value && privateState.error.value));
  const interactionPending = computed(() => Boolean(accountUser.value && !viewerState.value && privateState.pending.value));

  const refreshPublicIfCurrent = async (key: string) => {
    if (requestKey() !== key) return;
    await publicState.refresh();
  };

  const drainTipQueue = async (key: string) => {
    const queue = tipQueues.get(key);
    if (!queue || queue.running) return;
    queue.running = true;
    tipSavingByKey[key] = true;
    tipErrorByKey[key] = null;
    try {
      while (queue.desired !== queue.confirmed) {
        const target = queue.desired;
        const [targetSongId, targetDifficulty] = key.split("-").map(Number);
        try {
          const response = await apiFetch<{ tipId: string; body: string; status: "active" }>(
            '/api/account/charts/' + targetSongId + '/' + targetDifficulty + '/ugc/tip', { method: "PUT", body: { body: target } }
          );
          queue.confirmed = response.body;
          if (requestKey() === key && viewerStates[key]) viewerStates[key] = { ...viewerStates[key]!, tip: response };
          if (queue.desired === target) await refreshPublicIfCurrent(key);
        } catch (error) {
          if (queue.desired === target) {
            queue.desired = queue.confirmed;
            tipErrorByKey[key] = "ugc.tip.saveError";
            throw error;
          }
        }
      }
    } finally {
      queue.running = false;
      tipSavingByKey[key] = false;
    }
  };

  const saveTip = async (body: string) => {
    const user = await resolveAccountUser();
    if (!user) return goToLogin();
    const key = requestKey();
    const confirmed = viewerStates[key]?.tip?.body || "";
    const queue = tipQueues.get(key) || { confirmed, desired: confirmed, running: false };
    tipQueues.set(key, queue);
    queue.desired = body;
    void drainTipQueue(key);
  };

  const deleteTip = async () => {
    const user = await resolveAccountUser();
    if (!user) return goToLogin();
    const key = requestKey();
    tipSavingByKey[key] = true;
    tipErrorByKey[key] = null;
    try {
      const response = await apiFetch<{ tipId: string; status: "deleted" }>(
        '/api/account/charts/' + toValue(songId) + '/' + toValue(difficultyCode) + '/ugc/tip', { method: "DELETE" }
      );
      if (requestKey() === key && viewerStates[key]?.tip) viewerStates[key] = { ...viewerStates[key]!, tip: { ...viewerStates[key]!.tip!, status: "deleted" } };
      await refreshPublicIfCurrent(key);
      return response;
    } catch (error) {
      tipErrorByKey[key] = "ugc.tip.deleteError";
      throw error;
    } finally {
      tipSavingByKey[key] = false;
    }
  };

  const drainHelpfulQueue = async (tipId: string, key: string) => {
    const queue = helpfulQueues.get(tipId);
    if (!queue || queue.running) return;
    queue.running = true;
    helpfulSavingById[tipId] = true;
    helpfulErrorById[tipId] = null;
    try {
      while (queue.desired !== queue.confirmed) {
        const target = queue.desired;
        try {
          const response = await apiFetch<{ tipId: string; enabled: boolean; helpfulCount: number }>(
            '/api/account/chart-tips/' + tipId + '/helpful', { method: "PUT", body: { enabled: target } }
          );
          queue.confirmed = response.enabled;
          if (requestKey() === key && publicState.data.value) {
            publicState.data.value = {
              ...publicState.data.value,
              tips: publicState.data.value.tips.map((tip) => tip.tipId === tipId ? { ...tip, helpfulCount: response.helpfulCount } : tip)
            };
          }
        } catch (error) {
          if (queue.desired === target) {
            queue.desired = queue.confirmed;
            helpfulErrorById[tipId] = "ugc.helpfulError";
            throw error;
          }
        }
      }
      const state = viewerStates[key];
      if (state) viewerStates[key] = { ...state, helpfulTipIds: queue.confirmed ? [...new Set([...state.helpfulTipIds, tipId])] : state.helpfulTipIds.filter((id) => id !== tipId) };
      await refreshPublicIfCurrent(key);
    } finally {
      queue.running = false;
      helpfulSavingById[tipId] = false;
    }
  };

  const setHelpful = async (tipId: string, enabled: boolean) => {
    const user = await resolveAccountUser();
    if (!user) return goToLogin();
    const key = requestKey();
    const state = viewerStates[key];
    const confirmed = Boolean(state?.helpfulTipIds.includes(tipId));
    const queue = helpfulQueues.get(tipId) || { confirmed, desired: confirmed, running: false };
    helpfulQueues.set(tipId, queue);
    queue.desired = enabled;
    if (state) viewerStates[key] = { ...state, helpfulTipIds: enabled ? [...new Set([...state.helpfulTipIds, tipId])] : state.helpfulTipIds.filter((id) => id !== tipId) };
    void drainHelpfulQueue(tipId, key);
  };

  const reportTip = async (tipId: string, reason: string) => {
    const user = await resolveAccountUser();
    if (!user) return goToLogin();
    reportSavingById[tipId] = true;
    reportErrorById[tipId] = null;
    reportSuccessById[tipId] = false;
    try {
      const response = await apiFetch('/api/account/chart-tips/' + tipId + '/reports', { method: "POST", body: { reason } });
      reportSuccessById[tipId] = true;
      return response;
    } catch (error) {
      reportErrorById[tipId] = "ugc.reportError";
      throw error;
    } finally {
      reportSavingById[tipId] = false;
    }
  };

  const drainDifficultyQueue = async (key: string) => {
    const queue = difficultyQueues.get(key);
    if (!queue || queue.running) return;
    queue.running = true;
    difficultySavingByKey[key] = true;
    difficultyErrorByKey[key] = null;
    try {
      while (!Object.is(queue.desired, queue.confirmed)) {
        const target = queue.desired;
        const [targetSongId, targetDifficulty] = key.split("-").map(Number);
        try {
          const response = await apiFetch<ViewerChartUgcState>(
            `/api/account/charts/${targetSongId}/${targetDifficulty}/ugc/difficulty`,
            { method: "PUT", body: { value: target } }
          );
          queue.confirmed = response.difficultyVote;
          viewerStates[key] = { ...response, difficultyVote: queue.desired };
          if (Object.is(queue.desired, target)) {
            await refreshPublicIfCurrent(key);
            trackViewerEvent("ugc_difficulty_submit", { difficulty: targetDifficulty, cleared: target === null });
          }
        } catch {
          if (Object.is(queue.desired, target)) {
            queue.desired = queue.confirmed;
            if (viewerStates[key]) viewerStates[key] = { ...viewerStates[key]!, difficultyVote: queue.confirmed };
            difficultyErrorByKey[key] = "ugc.saveError";
            break;
          }
        }
      }
    } finally {
      queue.running = false;
      difficultySavingByKey[key] = false;
    }
  };

  const drainTagQueue = async (key: string) => {
    const queue = tagQueues.get(key);
    if (!queue || queue.running) return;
    queue.running = true;
    tagSavingByKey[key] = true;
    tagErrorByKey[key] = null;
    try {
      while (!sameTags(queue.desired, queue.confirmed)) {
        const target = [...queue.desired];
        const [targetSongId, targetDifficulty] = key.split("-").map(Number);
        try {
          const response = await apiFetch<ViewerChartUgcState>(
            `/api/account/charts/${targetSongId}/${targetDifficulty}/ugc/tags`,
            { method: "PUT", body: { slugs: target } }
          );
          queue.confirmed = activeTagsFromState(response);
          const optimisticSlugs = [...queue.desired];
          viewerStates[key] = {
            ...response,
            tagSlugs: optimisticSlugs,
            tagSelections: response.tagSelections.filter((tag) => optimisticSlugs.includes(tag.slug))
          };
          if (sameTags(queue.desired, target)) {
            await refreshPublicIfCurrent(key);
            trackViewerEvent("ugc_tag_submit", { difficulty: targetDifficulty, count: target.length });
          }
        } catch {
          if (sameTags(queue.desired, target)) {
            queue.desired = [...queue.confirmed];
            if (viewerStates[key]) {
              const confirmedSet = new Set(queue.confirmed);
              viewerStates[key] = {
                ...viewerStates[key]!,
                tagSlugs: [...queue.confirmed],
                tagSelections: viewerStates[key]!.tagSelections.filter((tag) => confirmedSet.has(tag.slug))
              };
            }
            tagErrorByKey[key] = "ugc.saveError";
            break;
          }
        }
      }
    } finally {
      queue.running = false;
      tagSavingByKey[key] = false;
    }
  };

  const goToLogin = async () => {
    const destination = `${localePath(`/songs/${toValue(songId)}`)}?difficulty=${toValue(difficultyCode)}`;
    await navigateTo({ path: localePath("/account/login"), query: { redirect: destination } });
  };

  const setDifficultyVote = async (value: ChartDifficultyVoteValue | null) => {
    const user = await resolveAccountUser();
    if (!user) return goToLogin();
    const key = requestKey();
    const state = viewerStates[key];
    if (!state) return;
    const queue = difficultyQueues.get(key) || {
      confirmed: state.difficultyVote,
      desired: state.difficultyVote,
      running: false
    };
    difficultyQueues.set(key, queue);
    queue.desired = value;
    viewerStates[key] = { ...state, difficultyVote: value };
    difficultyErrorByKey[key] = null;
    void drainDifficultyQueue(key);
  };

  const setTagSlugs = async (slugs: string[]) => {
    const user = await resolveAccountUser();
    if (!user) return goToLogin();
    const key = requestKey();
    const state = viewerStates[key];
    if (!state) return;
    const normalized = [...new Set(slugs)].sort();
    const queue = tagQueues.get(key) || {
      confirmed: activeTagsFromState(state),
      desired: activeTagsFromState(state),
      running: false
    };
    tagQueues.set(key, queue);
    queue.desired = normalized;
    const available = new Map((publicSummary.value?.availableTags || []).map((tag) => [tag.slug, tag]));
    viewerStates[key] = {
      ...state,
      tagSlugs: normalized,
      tagSelections: normalized.flatMap((slug) => {
        const tag = available.get(slug);
        return tag ? [{ ...tag, status: "active" as const }] : [];
      })
    };
    tagErrorByKey[key] = null;
    void drainTagQueue(key);
  };

  const state = {
    publicState,
    privateState,
    publicSummary,
    viewerState,
    difficultySaving,
    tagSaving,
    difficultyError,
    tagError,
    tipSaving: computed(() => Boolean(tipSavingByKey[requestKey()])),
    tipError: computed(() => tipErrorByKey[requestKey()] || null),
    helpfulSavingById,
    helpfulErrorById,
    reportSavingById,
    reportErrorById,
    reportSuccessById,
    interactionUnavailable,
    interactionPending,
    setDifficultyVote,
    setTagSlugs,
    saveTip,
    deleteTip,
    setHelpful,
    reportTip,
    goToLogin
  };
  // Register Nuxt composables and Vue watchers while setup still owns its
  // context. Awaiting a custom composable does not restore context inside it.
  return { ...state, publicState: await publicState };
};
