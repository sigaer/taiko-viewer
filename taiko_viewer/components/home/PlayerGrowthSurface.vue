<script setup lang="ts">
// Signed-in home with personal data (authenticated_ready). The script is the old one: goal choice, replacement,
// cancel, evaluation and the refresh after evaluation, the voice copy, the feedback composition. The presentation is in
// components/rework/today/* (Board, Hello, Profile, Goal, GoalPicker, Plan); RecentGrowth and DailyProgress keep their
// own logic. Classes such as growth-goal, goal-evaluate, growth-plan__choose stay as hooks of the browser checks.
import { composeRecommendationCopy, composeGoalCopy, composeDailyFactCopy, type GrowthVoiceContext } from "~/utils/growthVoice";
import { composeHomeGrowthFeedback } from "~/utils/homeGrowthFeedback";
import { formatScoreRank } from "~/utils/scoreRank";
import type { GrowthEventFact, GrowthPlanItem, PlayerGrowthOverview, RecentGrowthResponse } from "~/types/player-growth";
import { growthGreetingPeriod } from "~/utils/playerGrowth";
import { difficultyLabelKey } from "~/utils/difficulty";
import { trackViewerEvent } from "~/utils/analytics";

import type { PlayerGoal, GoalType } from "~/types/player-goal";

const props = defineProps<{
  overview: PlayerGrowthOverview;
  canExternalSync?: boolean;
  displayName: string;
  titles?: import("~/types/account-title").AccountTitle[];
  avatarUrl?: string;
  pending?: boolean;
  failed?: boolean;
  overviewRefreshing?: boolean;
  overviewRefreshFailed?: boolean;
  identity: string;
  refreshGrowth: (identity: string) => Promise<boolean>;
  recent: RecentGrowthResponse;
  recentPending?: boolean;
  recentFailed?: boolean;
  refreshRecent: () => Promise<boolean>;
  acknowledgeRecent: (token: string) => Promise<void>;
}>();
const { t, locale } = useI18n();
const localePath = useLocalePath();
// Goal options describe goal creation only. Their absence says nothing about
// browsing or recommendation eligibility, and this DTO has no reason code.
const greeting = computed(() => t(`home.growth.greeting.${growthGreetingPeriod()}`, { name: props.displayName }));
const balanced = computed(() => props.overview.playerState.dataSufficiency === "ready" && props.overview.playerState.tiedDimensions.length === 6);
const feedback = computed(() => composeHomeGrowthFeedback(activeGoal.value ? null : recentCompletedGoal.value,
  props.overview.dailyProgress, props.recent, activeGoal.value, props.overview.profileId,
  { daily: !props.pending && !props.failed, recent: Boolean(props.recent.profileId) }));
const progress = computed(() => feedback.value.dailyProgress);
const eventValue = (fact: GrowthEventFact, value: number | null) => fact.type === "rank-upgrade" ? formatScoreRank(value, locale.value) : Number(value).toLocaleString(locale.value === "ja" ? "ja-JP" : "zh-CN");
const voiceContext = computed<GrowthVoiceContext>(() => ({
  profileId: props.identity,
  businessDate: props.overview.dailyProgress.calendarDay,
  focus: balanced.value ? 'balanced' : props.overview.playerState.priorityDimension,
  readiness: props.overview.playerState.dataSufficiency,
  goalState: activeGoal.value ? 'active' : recentCompletedGoal.value ? 'completed' : 'none',
  activity: 'unknown'
}));
const recommendationCopy = computed(() => composeRecommendationCopy(voiceContext.value));
const factText = (fact: GrowthEventFact, songId = 0) => {
  const line = composeDailyFactCopy(fact, { ...voiceContext.value, profileId: `${voiceContext.value.profileId}:${songId}` }, eventValue(fact, fact.after), eventValue(fact, fact.delta));
  return t(line.key, line.params || {});
};
const goalSupportText = (fact: GrowthEventFact) => fact.type === 'score-pb' ? t('home.growth.goalScore', { value: eventValue(fact, fact.after) }) : factText(fact);
// The highlighted dimension on the radar: the priority dimension once the data is ready and not all six are tied.
const profileFocus = computed(() => !balanced.value && props.overview.playerState.dataSufficiency === 'ready' ? props.overview.playerState.priorityDimension : null);

const apiFetch = useViewerApiFetch();
const homeGeneration = useState("account-home-generation", () => 0);
const activeGoal = ref<PlayerGoal | null>(null);
const recentCompletedGoal = ref<PlayerGoal | null>(null);
const evaluationNotice = ref('');
const selected = ref<GrowthPlanItem | null>(null);
const selectedType = ref<GoalType | null>(null);
const busy = ref(false);
const goalError = ref('');
const needsRefresh = ref(false);
const refreshing = ref(false);
const refreshFailed = ref(false);
const choicesDisabled = computed(() => Boolean(busy.value || needsRefresh.value || props.overviewRefreshing || props.overviewRefreshFailed || props.pending || props.failed));
const selector = ref<HTMLDialogElement | null>(null);
let expectedGoalId: string | null = null;
let returnFocus: HTMLElement | null = null;
let mutationGeneration = 0;
let identityGeneration = 0;
watch(homeGeneration, () => { mutationGeneration++; busy.value = false; refreshing.value = false; needsRefresh.value = false; refreshFailed.value = false; selector.value?.close(); selected.value = null; }, { flush: 'sync' });
watch(() => props.identity, () => {
  identityGeneration++; mutationGeneration++; evaluationNotice.value = ''; activeGoal.value = null; recentCompletedGoal.value = null;
  needsRefresh.value = false; refreshing.value = false; refreshFailed.value = false;
  busy.value = false; selector.value?.close(); selected.value = null;
}, { flush: 'sync' });
watch(() => props.overview, overview => {
  mutationGeneration++;
  activeGoal.value = overview.activeGoal || null;
  recentCompletedGoal.value = overview.recentCompletedGoal || null;
  selector.value?.close(); selected.value = null; busy.value = false; goalError.value = '';
}, { immediate: true });
onBeforeUnmount(() => { identityGeneration++; mutationGeneration++; });
const openGoal = (item: GrowthPlanItem) => {
  if (choicesDisabled.value || !item.goalOptions?.length) return;
  if (!selector.value?.open) returnFocus = document.activeElement as HTMLElement;
  selected.value = item; selectedType.value = null; goalError.value = '';
  expectedGoalId = activeGoal.value?.id || null;
  nextTick(() => {
    if (!selector.value?.open) selector.value?.showModal();
    selector.value?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
  });
};
const trapGoalFocus = (event: KeyboardEvent) => {
  if (event.key !== 'Tab' || !selector.value) return;
  const controls = [...selector.value.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]')]
    .filter(el => !(el instanceof HTMLInputElement) || el.type !== 'radio' || el.checked || (!selectedType.value && el === selector.value?.querySelector('input')));
  const first = controls[0], last = controls.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
};
const restoreGoalFocus = () => { if (!selector.value?.open) returnFocus?.focus(); };
const closeGoal = () => { selector.value?.close(); selected.value = null; restoreGoalFocus(); };
const mutate = async (cancel = false) => {
  if (choicesDisabled.value || (!cancel && (!selected.value || !selectedType.value))) return;
  const generation = mutationGeneration;
  busy.value = true; goalError.value = '';
  try {
    const result = await apiFetch<{ activeGoal: PlayerGoal | null; profileId: string }>('/api/account/growth/goal', {
      method: cancel ? 'DELETE' : 'POST',
      body: { profileId: props.overview.profileId, expectedActiveGoalId: cancel ? activeGoal.value?.id || null : expectedGoalId,
        ...(!cancel ? { songId: selected.value!.songId, difficultyType: selected.value!.difficultyType, goalType: selectedType.value, scoreRevision: props.overview.scoreRevision } : {}) }
    });
    if (generation !== mutationGeneration || result.profileId !== props.overview.profileId) return;
    activeGoal.value = result.activeGoal; recentCompletedGoal.value = null; evaluationNotice.value = ''; closeGoal();
  } catch (error) {
    if (generation === mutationGeneration) goalError.value = t(Number((error as { statusCode?: number }).statusCode) === 409 ? 'home.goal.conflict' : 'home.goal.error');
  } finally { if (generation === mutationGeneration) busy.value = false; }
};
const refreshAfterEvaluation = async (identity: string, includeRecent = true) => {
  if (identity !== props.identity || refreshing.value) return;
  const identityRequest = identityGeneration;
  const dataRequest = homeGeneration.value;
  refreshing.value = true; refreshFailed.value = false;
  const [growthResult] = await Promise.allSettled([props.refreshGrowth(identity), includeRecent ? props.refreshRecent() : Promise.resolve(true)]);
  const succeeded = growthResult.status === 'fulfilled' && growthResult.value;
  if (identity !== props.identity || identityRequest !== identityGeneration || dataRequest !== homeGeneration.value) return;
  refreshing.value = false; needsRefresh.value = !succeeded; refreshFailed.value = !succeeded;
};
const evaluate = async () => {
  if (choicesDisabled.value || !activeGoal.value) return;
  const generation = mutationGeneration; const identity = props.identity; busy.value = true; goalError.value = ''; evaluationNotice.value = '';
  try {
    const result = await apiFetch<{profileId:string;activeGoal:PlayerGoal|null;recentCompletedGoal:PlayerGoal|null;outcome:string}>('/api/account/growth/goal/evaluate', {method:'POST',body:{profileId:props.overview.profileId,expectedActiveGoalId:activeGoal.value.id}});
    if (generation !== mutationGeneration || identity !== props.identity || result.profileId !== props.overview.profileId) return;
    activeGoal.value = result.activeGoal; recentCompletedGoal.value = result.recentCompletedGoal;
    needsRefresh.value = true;
    if (result.outcome !== 'completed') evaluationNotice.value = t(composeGoalCopy(result.outcome === 'inconclusive' ? 'inconclusive' : 'unchanged').key);
    await refreshAfterEvaluation(identity);
  } catch { if (generation === mutationGeneration) goalError.value = t('home.goal.error'); }
  finally { if (generation === mutationGeneration) busy.value = false; }
};
const completionChange = computed(() => {
  const result = recentCompletedGoal.value?.completionEvidence?.result;
  if (!result || !['score-pb','ng-reduced','rank-upgrade'].includes(result.goalType)) return '';
  const format = (value:number) => result.goalType === 'rank-upgrade' ? formatScoreRank(value,locale.value) : value.toLocaleString(locale.value === 'ja' ? 'ja-JP' : 'zh-CN');
  return `${t(`home.growth.factLabels.${result.goalType}`)} ${format(result.before)} → ${format(result.after)}`;
});
const completedSupport = computed(() => feedback.value.goalFacts.slice(1).map(goalSupportText));
const completedTypeText = computed(() => recentCompletedGoal.value ? t(`home.goal.completedTypes.${feedback.value.goalType || recentCompletedGoal.value.goalType}`) : '');
const selectedChart = (item: GrowthPlanItem) => activeGoal.value?.songId === item.songId && activeGoal.value?.difficultyType === item.difficultyType;
const replacementItems = computed(() => props.overview.todayPlan.items.filter(item => item.goalOptions?.length && !selectedChart(item)));
const chooseAnother = () => {
  if (choicesDisabled.value) return;
  returnFocus = document.activeElement as HTMLElement;
  selected.value = null; selectedType.value = null; goalError.value = '';
  nextTick(() => selector.value?.showModal());
};

const trackPlanClick = (songId: number) => trackViewerEvent("home_growth_plan_click", { song_id: songId, source: "growth_overview" });
</script>

<template>
  <section class="growth-surface" aria-labelledby="growth-title">
    <ReworkTodayBoard>
      <template #hello>
        <ReworkTodayHello :greeting="greeting" :name="displayName" :avatar-url="avatarUrl" :titles="titles" :weekly-to="localePath('/my/weekly')" :passport-to="localePath('/my/growth')" />
      </template>
      <template #notice>
        <p v-if="overviewRefreshing && !refreshing" class="rw-note" role="status">{{ t('home.goal.refreshing') }}</p>
        <ReworkState v-else-if="overviewRefreshFailed && !refreshFailed && !refreshing" kind="failed" compact :title="t('home.goal.refreshFailed')" :retry-label="t('home.growth.recent.retry')" @retry="refreshGrowth(identity)" />
        <p v-if="refreshing" class="rw-note" role="status">{{ t('home.goal.refreshing') }}</p>
        <ReworkState v-else-if="refreshFailed" kind="failed" compact :title="t('home.goal.refreshFailed')" :retry-label="t('home.goal.retryRefresh')" @retry="refreshAfterEvaluation(identity, false)" />
        <p v-if="evaluationNotice" class="rw-note" role="status">{{ evaluationNotice }}</p>
        <p v-if="goalError && !selected" class="rw-note goal-error" role="alert">{{ goalError }}</p>
      </template>
      <template v-if="pending" #profile>
        <ReworkState kind="loading" class="growth-loading" :lines="4" />
      </template>
      <template v-else-if="failed" #profile>
        <ReworkState kind="failed" :title="t('home.growth.loadFailed')" :retry-label="t('home.growth.recent.retry')" @retry="refreshGrowth(identity)" />
      </template>
      <template v-else #profile>
        <ReworkTodayProfile :rating="overview.playerState.overallRating" :skills="overview.playerState.skills" :focus="profileFocus" :observation="t(recommendationCopy.observation.key)" />
      </template>
      <template v-if="!pending && !failed && (activeGoal || recentCompletedGoal)" #goal>
        <ReworkTodayGoal
          v-if="activeGoal"
          :goal="activeGoal"
          :heading="t(composeGoalCopy('active').key)"
          :busy="busy"
          :disabled="choicesDisabled"
          :can-external-sync="canExternalSync"
          :profile-id="overview.profileId"
          @evaluate="evaluate"
          @replace="chooseAnother"
          @cancel="mutate(true)"
        />
        <ReworkTodayGoal
          v-else-if="recentCompletedGoal"
          :goal="recentCompletedGoal"
          completed
          :heading="t(composeGoalCopy('completed').key)"
          :change="completionChange"
          :type-text="completedTypeText"
          :support="completedSupport"
          :disabled="choicesDisabled"
          @next="chooseAnother"
        />
      </template>
      <template #recent>
        <HomeRecentGrowth
          appearance="home"
          :recent="recent"
          :facts="feedback.recentFacts"
          :suppressed-count="feedback.recentSuppressedCount"
          :pending="recentPending"
          :failed="recentFailed"
          @presented="acknowledgeRecent"
          @retry="refreshRecent"
        />
      </template>
      <template v-if="!pending && !failed" #daily>
        <HomeDailyProgress :progress="progress" :original="overview.dailyProgress" />
      </template>
      <template v-if="!pending && !failed" #plan>
        <ReworkTodayPlan
          :title="t(recommendationCopy.invitation.key)"
          :items="overview.todayPlan.items"
          :selected="selectedChart"
          :disabled="choicesDisabled"
          :busy="busy"
          @choose="openGoal"
          @browse="trackPlanClick"
        />
      </template>
      <dialog v-if="!pending && !failed" ref="selector" class="rw-dialog goal-dialog" aria-labelledby="goal-dialog-title" @keydown="trapGoalFocus" @cancel.prevent="closeGoal" @close="restoreGoalFocus">
        <ReworkTodayGoalPicker
          v-model:type="selectedType"
          :selected="selected"
          :items="replacementItems"
          :replacing="!!expectedGoalId"
          :busy="busy"
          :disabled="choicesDisabled"
          :error="goalError"
          @pick="openGoal"
          @close="closeGoal"
          @confirm="mutate()"
        />
      </dialog>
    </ReworkTodayBoard>
  </section>
</template>
