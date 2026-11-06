<script setup lang="ts">
import type { RatingDimensionKey } from "~/types/recommendation-intelligence";
import { composeRecommendationCopy, composeGoalCopy, composeDailyFactCopy, type GrowthVoiceContext } from "~/utils/growthVoice";
import { composeHomeGrowthFeedback } from "~/utils/homeGrowthFeedback";
import { formatScoreRank } from "~/utils/scoreRank";
import type { GrowthEventFact, GrowthPlanItem, PlayerGrowthOverview, RecentGrowthResponse } from "~/types/player-growth";
import { GROWTH_DIMENSION_LABELS, GROWTH_DIMENSION_SHORT_LABELS, growthGreetingPeriod } from "~/utils/playerGrowth";
import { difficultyLabelKey } from "~/utils/difficulty";
import { trackViewerEvent } from "~/utils/analytics";

import type { PlayerGoal, GoalType } from "~/types/player-goal";

const props = defineProps<{
  overview: PlayerGrowthOverview;
  canExternalSync?: boolean;
  displayName: string;
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
const goalCopy = computed(() => locale.value === 'ja'
  ? { choose: '目標に設定' }
  : { choose: '设为目标' });
const replacementCopy = computed(() => locale.value === 'ja'
  ? { title: '次の楽曲を選ぶ', empty: '現在のおすすめに、ほかに目標を設定できる楽曲はありません。', more: 'ほかのおすすめを見る' }
  : { title: '选择另一首歌', empty: '当前推荐中没有其他可设为目标的歌曲。', more: '查看更多推荐' });
const dimensionLabel = (key: RatingDimensionKey | null) => key ? GROWTH_DIMENSION_LABELS[key][locale.value === "ja" ? "ja" : "zh"] : "";
const dimensionShortLabel = (key: RatingDimensionKey) => GROWTH_DIMENSION_SHORT_LABELS[key][locale.value === "ja" ? "ja" : "zh"];
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
const skillItems = computed(() => props.overview.playerState.skills.filter((item) => Number(item.value) > 0));
const skillAriaLabel = (key: RatingDimensionKey, value: number) => `${dimensionLabel(key)} ${Number(value).toFixed(2)}`;

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
    <header class="growth-focus">
      <div class="growth-focus__topline">
        <h1 id="growth-title">{{ greeting }}</h1>
        <div class="growth-focus__aside">
          <nav class="growth-story-links" :aria-label="t('home.growth.storyLinks')">
            <NuxtLink :to="localePath('/my/weekly')" class="growth-weekly-link">{{ t('home.growth.weeklyEntry') }}</NuxtLink>
            <NuxtLink :to="localePath('/my/growth')" class="growth-weekly-link">{{ t('home.growth.passportEntry') }} <span aria-hidden="true">→</span></NuxtLink>
          </nav>
        </div>
      </div>
      <details v-if="!pending && !failed" class="growth-ability">
        <summary><span v-if="overview.playerState.overallRating !== null">Rating <strong>{{ overview.playerState.overallRating.toFixed(2) }}</strong><span aria-hidden="true"> · </span></span>{{ locale === 'ja' ? '能力の詳細' : '能力详情' }}</summary>
        <div class="growth-focus__observation">
          <p>{{ t(recommendationCopy.observation.key) }}</p>
        </div>
        <div v-if="skillItems.length" class="growth-skills" :aria-label="t('home.growth.skillOverview')">
          <div v-for="item in skillItems" :key="item.key" class="growth-skill" :class="{ 'growth-skill--priority': !balanced && overview.playerState.dataSufficiency === 'ready' && item.key === overview.playerState.priorityDimension }" :aria-label="skillAriaLabel(item.key, item.value)">
            <span :title="dimensionLabel(item.key)">{{ dimensionShortLabel(item.key) }}</span>
            <strong>{{ Number(item.value).toFixed(2) }}</strong>
          </div>
        </div>
      </details>
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
    </header>
    <p v-if="overviewRefreshing && !refreshing" role="status">{{ t('home.goal.refreshing') }}</p>
    <div v-else-if="overviewRefreshFailed && !refreshFailed && !refreshing" class="goal-actions" role="alert"><span>{{ t('home.goal.refreshFailed') }}</span><button type="button" @click="refreshGrowth(identity)">{{ t('home.growth.recent.retry') }}</button></div>
    <div v-if="pending" class="growth-loading" aria-busy="true">
      <div class="growth-loading__focus shimmer-card">
        <span class="growth-skeleton__line growth-skeleton__line--title"></span>
        <span class="growth-skeleton__line growth-skeleton__line--rating"></span>
        <span class="growth-skeleton__line growth-skeleton__line--focus"></span>
        <span class="growth-skeleton__line growth-skeleton__line--skills"></span>
      </div>
      <div class="growth-loading__plan shimmer-card">
        <span class="growth-skeleton__line growth-skeleton__line--section"></span>
        <span class="growth-skeleton__row shimmer-card"></span>
        <span class="growth-skeleton__row shimmer-card"></span>
        <span class="growth-skeleton__row shimmer-card"></span>
      </div>
      <div class="growth-loading__progress shimmer-card">
        <span class="growth-skeleton__line growth-skeleton__line--section"></span>
        <span class="growth-skeleton__line growth-skeleton__line--progress shimmer-card"></span>
      </div>
    </div>
    <div v-else-if="failed" class="goal-actions" role="alert"><span>{{ t('home.growth.loadFailed') }}</span><button type="button" @click="refreshGrowth(identity)">{{ t('home.growth.recent.retry') }}</button></div>
    <template v-else>
      <section v-if="activeGoal" id="current-goal" class="growth-goal" aria-labelledby="growth-goal-title" aria-live="polite">
        <h2 id="growth-goal-title">{{ t(composeGoalCopy('active').key) }}</h2>
        <strong>{{ activeGoal.title }}</strong>
        <span>{{ t(difficultyLabelKey(activeGoal.difficultyType)) }}<template v-if="activeGoal.starLevel"> · {{ activeGoal.starLevel }}{{ t('guide.starSuffix') }}</template></span>
        <span>{{ t(`home.goal.types.${activeGoal.goalType}`) }}</span>
        <span v-if="activeGoal.goalType === 'score-pb' && activeGoal.baseline.highScore !== null">{{ t('home.goal.baseline', { value: activeGoal.baseline.highScore.toLocaleString() }) }}</span>
        <span v-if="activeGoal.goalType === 'ng-reduced' && activeGoal.baseline.ngCnt !== null">{{ t('home.goal.baselineNg', { value: activeGoal.baseline.ngCnt }) }}</span>
        <span v-if="activeGoal.goalType === 'rank-upgrade'">{{ t('home.goal.baseline', { value: formatScoreRank(activeGoal.baseline.bestScoreRank, locale) }) }}</span>
        <span v-if="activeGoal.unavailable">{{ t('home.goal.unavailable') }}</span>
        <div class="goal-actions">
          <NuxtLink :to="localePath({ path: `/songs/${activeGoal.songId}`, query: { difficulty: String(activeGoal.difficultyType) } })">{{ locale === 'ja' ? '譜面を見る' : '查看谱面' }}</NuxtLink>
          <NuxtLink v-if="canExternalSync" :to="localePath({ path: '/account/sync', query: { profileId: overview.profileId, from: 'goal' } })">{{ locale === 'ja' ? '練習後に同期' : '练后同步' }}</NuxtLink>
        </div>
        <div class="goal-actions"><button class="goal-evaluate" :disabled="choicesDisabled" @click="evaluate">{{ t(busy ? 'home.goal.saving' : 'home.goal.evaluate') }}</button><button :disabled="choicesDisabled" @click="chooseAnother">{{ t('home.goal.replace') }}</button><button :disabled="choicesDisabled" @click="mutate(true)">{{ t(busy ? 'home.goal.saving' : 'home.goal.cancel') }}</button></div>
      </section>
      <section v-else-if="recentCompletedGoal" id="current-goal" class="growth-goal growth-goal--completed panel-card" aria-labelledby="goal-completed-title" aria-live="polite">
        <h2 id="goal-completed-title">{{ t(composeGoalCopy('completed').key) }}</h2>
        <strong>{{ recentCompletedGoal.title }}</strong>
        <span>{{ t(difficultyLabelKey(recentCompletedGoal.difficultyType)) }}<template v-if="recentCompletedGoal.starLevel"> · {{ recentCompletedGoal.starLevel }}{{ t('guide.starSuffix') }}</template></span>
        <span v-if="!completionChange">{{ t(`home.goal.completedTypes.${feedback.goalType || recentCompletedGoal.goalType}`) }}</span>
        <strong v-if="completionChange">{{ completionChange }}</strong>
        <p v-for="fact in feedback.goalFacts.slice(1)" :key="fact.type" class="growth-goal__support">{{ goalSupportText(fact) }}</p>
        <div class="goal-actions"><button :disabled="choicesDisabled" @click="chooseAnother">{{ t('home.goal.chooseNext') }}</button></div>
      </section>
    </template>


    <template v-if="!pending && !failed">

      <section class="growth-plan" aria-labelledby="growth-plan-title">
        <div class="growth-section-head">
          <div>
            <h2 id="growth-plan-title">{{ t(recommendationCopy.invitation.key) }}</h2>
          </div>
        </div>
        <div v-if="overview.todayPlan.items.length" class="growth-plan__items">
          <RecommendationSongItem v-for="item in overview.todayPlan.items" :key="`${item.songId}-${item.difficultyType}`"
            class="growth-plan__choice" :song-id="item.songId" :title="item.title" :difficulty-type="item.difficultyType" :star-level="item.starLevel"
            :to="localePath({ path: `/songs/${item.songId}`, query: { difficulty: String(item.difficultyType) } })" @browse="trackPlanClick(item.songId)">
            <template v-if="item.currentBestScore != null" #details>{{ item.currentBestScore.toLocaleString() }}</template>
            <template v-if="item.goalOptions?.length" #actions>
              <button data-song-action class="growth-plan__choose" :disabled="choicesDisabled" :aria-busy="busy" @click="openGoal(item)">{{ selectedChart(item) ? t('home.goal.selected') : goalCopy.choose }}</button>
            </template>
          </RecommendationSongItem>
        </div>
        <p v-else class="growth-empty">{{ t("home.growth.noRecommendation") }}</p>
      </section>

      <HomeDailyProgress :progress="progress" :original="overview.dailyProgress" />


      <p v-if="refreshing" role="status">{{ t('home.goal.refreshing') }}</p>
      <div v-else-if="refreshFailed" class="goal-actions" role="alert"><span>{{ t('home.goal.refreshFailed') }}</span><button @click="refreshAfterEvaluation(identity, false)">{{ t('home.goal.retryRefresh') }}</button></div>
      <p v-if="evaluationNotice" role="status">{{ evaluationNotice }}</p>
      <p v-if="goalError && !selected" role="alert" class="goal-error">{{ goalError }}</p>
      <dialog ref="selector" class="goal-dialog" @keydown="trapGoalFocus" aria-labelledby="goal-dialog-title" @cancel.prevent="closeGoal" @close="restoreGoalFocus">
        <template v-if="!selected">
          <h2 id="goal-dialog-title">{{ replacementCopy.title }}</h2>
          <div v-if="replacementItems.length" class="goal-replacements">
            <button v-for="item in replacementItems" :key="`${item.songId}-${item.difficultyType}`" type="button" :disabled="choicesDisabled" @click="openGoal(item)">
              <strong>{{ item.title }}</strong>
              <span>{{ t(difficultyLabelKey(item.difficultyType)) }}<template v-if="item.starLevel"> · {{ item.starLevel }}{{ t('guide.starSuffix') }}</template></span>
            </button>
          </div>
          <p v-else role="status">{{ replacementCopy.empty }}</p>
          <div class="goal-actions">
            <button type="button" @click="closeGoal">{{ t('home.goal.cancel') }}</button>
            <NuxtLink :to="localePath('/tools/recommend')" @click="closeGoal">{{ replacementCopy.more }}</NuxtLink>
          </div>
        </template>
        <template v-if="selected">
          <h2 id="goal-dialog-title">{{ t(expectedGoalId ? 'home.goal.replaceConfirm' : 'home.goal.question') }}</h2>
          <strong>{{ selected.title }}</strong>
          <p>{{ t(difficultyLabelKey(selected.difficultyType)) }}<template v-if="selected.starLevel"> · {{ selected.starLevel }}{{ t('guide.starSuffix') }}</template></p>
          <fieldset :disabled="busy" aria-labelledby="goal-dialog-title"><legend v-if="expectedGoalId">{{ t('home.goal.question') }}</legend>
            <label v-for="option in selected.goalOptions" :key="option"><input v-model="selectedType" type="radio" name="goal-type" :value="option">{{ t(`home.goal.types.${option}`) }}</label>
          </fieldset>
          <p v-if="goalError" role="alert" class="goal-error">{{ goalError }}</p>
          <div class="goal-actions"><button @click="closeGoal">{{ t('home.goal.cancel') }}</button><button :disabled="busy || !selectedType" :aria-busy="busy" @click="mutate()">{{ t(busy ? 'home.goal.saving' : 'home.goal.confirm') }}</button></div>
        </template>
      </dialog>

    </template>
  </section>
</template>

<style scoped>
.growth-ability summary { min-height: 44px; align-content: center; color: var(--viewer-link); font-size: 14px; cursor: pointer; }
.growth-ability summary strong { font-weight: 600; color: var(--viewer-text); font-variant-numeric: tabular-nums; }
.growth-ability summary:focus-visible { outline: 3px solid var(--viewer-link); outline-offset: 2px; }

.growth-goal { display: grid; gap: 7px; max-width: 540px; padding-block: 8px; color:var(--el-text-color-primary); }
.growth-goal--completed { max-width: none; padding: 20px 24px; border-left: 3px solid var(--viewer-accent-strong); box-sizing: border-box; }
.growth-goal__support { margin: 0; color:var(--viewer-text-muted); font-size: 14px; line-height: 1.5; }
.growth-goal h2 { margin: 0 0 6px; font: 700 23px/1.2 var(--viewer-display-font); }
.growth-goal > strong { font-size: 18px; overflow-wrap: anywhere; }
.growth-goal > span { font-size: 14px; }
.goal-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
.goal-actions button, .goal-actions > a { display: inline-flex; align-items: center; text-decoration: none; min-height: 44px; padding: 8px 14px; border: 1px solid var(--el-border-color); border-radius: 10px; background:var(--el-bg-color); color:var(--el-text-color-primary); cursor: pointer; font: inherit; }
button:disabled { opacity: .55; cursor: default; }
button:focus-visible, input:focus-visible, .goal-actions a:focus-visible { outline: 3px solid var(--el-color-primary); outline-offset: 3px; }
.goal-dialog { width: min(440px, calc(100vw - 32px)); max-height: 80dvh; overflow-y: auto; box-sizing: border-box; padding: 22px; border: 1px solid var(--el-border-color); border-radius: 18px; color:var(--el-text-color-primary); background:var(--el-bg-color); }
.goal-dialog::backdrop { background:var(--viewer-overlay); }
.goal-dialog h2 { margin: 0 0 16px; font-size: 21px; }
.goal-dialog fieldset { border: 0; padding: 0; margin: 12px 0; }
.goal-dialog legend { font-size: 14px; margin-bottom: 8px; }
.goal-dialog label { display: flex; align-items: center; gap: 10px; min-height: 44px; cursor: pointer; }
.goal-dialog input { accent-color:var(--el-color-primary); }
.goal-replacements { display: grid; gap: 8px; }
.goal-replacements button { display: grid; gap: 6px; min-height: 44px; padding: 12px; text-align: start; overflow-wrap: anywhere; border: 1px solid var(--el-border-color); border-radius: 10px; background: var(--el-bg-color); color: var(--el-text-color-primary); cursor: pointer; font: inherit; }
.goal-replacements span { font-size: 14px; color: var(--viewer-text-muted); }
.goal-dialog .goal-actions a { display: inline-flex; align-items: center; min-height: 44px; color: var(--viewer-link); }
.goal-error { color:var(--el-color-danger); font-size: 14px; }

.growth-surface { --growth-section-gap: clamp(24px, 3vw, 32px); --growth-card-gap: 11px; display: grid; min-width: 0; gap: var(--growth-section-gap); }
.growth-focus { min-width: 0; }
.growth-focus { display: grid; gap: 8px; }
.growth-focus__topline, .growth-section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.growth-focus__aside { display: grid; justify-items: end; gap: 8px; }
.growth-weekly-link { color:var(--viewer-link); font-size: 13px; font-weight: 500; text-decoration: none; }
.growth-story-links { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px 14px; }
.growth-weekly-link:hover, .growth-weekly-link:focus-visible { text-decoration: underline; text-underline-offset: 4px; }
.growth-focus h1, .growth-plan h2 { margin: 0; color:var(--viewer-text); font-family: var(--viewer-display-font); line-height: 1.1; }
.growth-focus h1 { min-width: 0; overflow-wrap: anywhere; font-size: clamp(24px, 2.8vw, 30px); }
.growth-plan h2 { font-size: clamp(21px, 2.5vw, 28px); }
.growth-rating { display: grid; gap: 2px; text-align: right; }
.growth-rating span { color:var(--viewer-text-muted); font-size: 11px; font-weight: 700; }
.growth-rating strong { color:var(--viewer-text); font: 800 28px/1 var(--viewer-display-font); }
.growth-focus__observation p { margin: 0; color:var(--viewer-text); font-size: clamp(16px, 2vw, 19px); line-height: 1.6; overflow-wrap: anywhere; }
.growth-focus__observation { margin-block: 12px; }
.growth-skills { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
.growth-skill { position: relative; display: grid; gap: 3px; padding-top: 8px; border-top: 1px solid var(--viewer-border); }
.growth-skill span { color:var(--viewer-text-muted); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.growth-skill strong { color:var(--viewer-text); font-size: 14px; font-variant-numeric: tabular-nums; }
.growth-skill--priority { border-top-color:var(--viewer-border); }
.growth-skill--priority::after { content: ""; position: absolute; top: -2px; left: 0; width: 24px; height: 2px; border-radius: 99px; background:var(--viewer-primary); }
.growth-skill--priority span, .growth-skill--priority strong { font-weight: 800; }
.growth-plan { display: grid; gap: 8px; min-width: 0; }
.growth-reason { margin: 0; color:var(--viewer-text-muted); font-size: 13px; line-height: 1.55; }
.growth-plan__items { display:grid; grid-template-columns:1fr; gap:0; margin-top:8px; }
.growth-empty { margin: 0; color:var(--viewer-text-muted); font-size: 13px; }
:global(body.theme-dark .growth-empty) { color:var(--viewer-text-muted); }

:global(body.theme-dark .growth-plan) { border-color:var(--viewer-border); }
:global(body.theme-dark .growth-focus h1), :global(body.theme-dark .growth-plan h2), :global(body.theme-dark .growth-rating strong), :global(body.theme-dark .growth-skill strong) { color:var(--viewer-text); }
:global(body.theme-dark .growth-weekly-link) { color:var(--viewer-link); }
:global(body.theme-dark .growth-skill--priority) { border-top-color:var(--viewer-border); }
:global(body.theme-dark .growth-skill--priority::after) { background:var(--viewer-primary); }
.growth-loading { display: grid; gap: var(--growth-section-gap); }
.growth-loading > div { display: grid; align-content: start; gap: 14px; min-height: 150px; padding: clamp(22px, 4vw, 34px); border-radius: 22px; }
.growth-loading__focus { min-height: 235px !important; }
.growth-loading__plan, .growth-loading__progress { min-height: 180px !important; padding: 0; background:none; }
.growth-skeleton__line, .growth-skeleton__row { display: block; min-height: 0; border-radius: 6px; background:var(--viewer-border); }
.growth-skeleton__line--title { width: min(56%, 240px); height: 30px; }
.growth-skeleton__line--rating { width: 92px; height: 26px; margin-left: auto; }
.growth-skeleton__line--focus { width: min(72%, 310px); height: 36px; margin-top: 8px; }
.growth-skeleton__line--skills { width: 100%; height: 42px; margin-top: auto; }
.growth-skeleton__line--section { width: 130px; height: 27px; }
.growth-skeleton__line--progress { width: 78%; height: 58px; margin-top: 10px; }
.growth-skeleton__row { width: 100%; height: 58px; border: 1px solid var(--viewer-border); border-radius: 15px; }
@media (max-width: 820px) { .growth-skills { grid-template-columns: repeat(3, minmax(0, 1fr)); } .growth-plan__items { grid-template-columns: 1fr; } }
@media (max-width: 520px) { .growth-surface { padding-inline: 2px; } .growth-focus__topline { flex-direction: column; } .growth-focus__aside { justify-items: start; } .growth-rating { text-align: left; justify-self: start; } .growth-plan__items { grid-template-columns: 1fr; } .growth-loading > div { min-height: 130px; padding: 19px; border-radius: 18px; } .growth-loading__plan, .growth-loading__progress { padding: 0; } .growth-loading__focus { min-height: 190px !important; } }

</style>
