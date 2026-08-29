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

  const publicState = await useAsyncData<ChartUgcSummary | null>(
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
  const difficultySavingByKey = reactive<Record<string, boolean>>({});
  const tagSavingByKey = reactive<Record<string, boolean>>({});
  const difficultyErrorByKey = reactive<Record<string, string | null>>({});
  const tagErrorByKey = reactive<Record<string, string | null>>({});

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

  return {
    publicState,
    privateState,
    publicSummary,
    viewerState,
    difficultySaving,
    tagSaving,
    difficultyError,
    tagError,
    interactionUnavailable,
    interactionPending,
    setDifficultyVote,
    setTagSlugs,
    goToLogin
  };
};
