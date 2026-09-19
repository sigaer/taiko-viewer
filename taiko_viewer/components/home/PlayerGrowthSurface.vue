<script setup lang="ts">
import type { RatingDimensionKey } from "~/types/recommendation-intelligence";
import { formatScoreRank } from "~/utils/scoreRank";
import type { GrowthEventFact, GrowthPlanItem, PlayerGrowthOverview } from "~/types/player-growth";
import { GROWTH_DIMENSION_LABELS, GROWTH_DIMENSION_SHORT_LABELS, growthGreetingPeriod } from "~/utils/playerGrowth";
import { difficultyLabelKey } from "~/utils/difficulty";
import { trackViewerEvent } from "~/utils/analytics";

import type { PlayerGoal, GoalType } from "~/types/player-goal";

const props = defineProps<{ overview: PlayerGrowthOverview; displayName: string; pending?: boolean; failed?: boolean }>();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const dimensionLabel = (key: RatingDimensionKey | null) => key ? GROWTH_DIMENSION_LABELS[key][locale.value === "ja" ? "ja" : "zh"] : "";
const dimensionShortLabel = (key: RatingDimensionKey) => GROWTH_DIMENSION_SHORT_LABELS[key][locale.value === "ja" ? "ja" : "zh"];
const greeting = computed(() => t(`home.growth.greeting.${growthGreetingPeriod()}`, { name: props.displayName }));
const focusLabel = computed(() => props.overview.playerState.dataSufficiency === "ready" ? dimensionLabel(props.overview.playerState.priorityDimension) : "");
const balanced = computed(() => props.overview.playerState.dataSufficiency === "ready" && props.overview.playerState.tiedDimensions.length === 6);
const progress = computed(() => props.overview.dailyProgress);
const hasProgress = computed(() => progress.value.attendance === "played");
const eventValue = (fact: GrowthEventFact, value: number | null) => fact.type === "rank-upgrade" ? formatScoreRank(value, locale.value) : Number(value).toLocaleString(locale.value === "ja" ? "ja-JP" : "zh-CN");
const factualChange = (fact: GrowthEventFact) => ["score-pb", "ng-reduced", "combo-improved", "rank-upgrade"].includes(fact.type);
const skillItems = computed(() => props.overview.playerState.skills.filter((item) => Number(item.value) > 0));
const skillAriaLabel = (key: RatingDimensionKey, value: number) => `${dimensionLabel(key)} ${Number(value).toFixed(2)}`;

const apiFetch = useViewerApiFetch();
const activeGoal = ref<PlayerGoal | null>(null);
const recentCompletedGoal = ref<PlayerGoal | null>(null);
const evaluationNotice = ref('');
const selected = ref<GrowthPlanItem | null>(null);
const selectedType = ref<GoalType | null>(null);
const busy = ref(false);
const goalError = ref('');
const selector = ref<HTMLDialogElement | null>(null);
let expectedGoalId: string | null = null;
let returnFocus: HTMLElement | null = null;
let mutationGeneration = 0;
watch(() => props.overview, overview => {
  mutationGeneration++;
  activeGoal.value = overview.activeGoal || null;
  recentCompletedGoal.value = overview.recentCompletedGoal || null; evaluationNotice.value = '';
  selector.value?.close(); selected.value = null; busy.value = false; goalError.value = '';
}, { immediate: true });
onBeforeUnmount(() => { mutationGeneration++; });
const openGoal = (item: GrowthPlanItem) => {
  returnFocus = document.activeElement as HTMLElement;
  selected.value = item; selectedType.value = null; goalError.value = '';
  expectedGoalId = activeGoal.value?.id || null;
  nextTick(() => selector.value?.showModal());
};
const trapGoalFocus = (event: KeyboardEvent) => {
  if (event.key !== 'Tab' || !selector.value) return;
  const controls = [...selector.value.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')]
    .filter(el => !(el instanceof HTMLInputElement) || el.type !== 'radio' || el.checked || (!selectedType.value && el === selector.value?.querySelector('input')));
  const first = controls[0], last = controls.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
};
const closeGoal = () => { selector.value?.close(); selected.value = null; returnFocus?.focus(); };
const mutate = async (cancel = false) => {
  if (busy.value || (!cancel && (!selected.value || !selectedType.value))) return;
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
const evaluate = async () => {
  if (busy.value || !activeGoal.value) return;
  const generation = mutationGeneration; busy.value = true; goalError.value = ''; evaluationNotice.value = '';
  try {
    const result = await apiFetch<{profileId:string;activeGoal:PlayerGoal|null;recentCompletedGoal:PlayerGoal|null;outcome:string}>('/api/account/growth/goal/evaluate', {method:'POST',body:{profileId:props.overview.profileId,expectedActiveGoalId:activeGoal.value.id}});
    if (generation !== mutationGeneration || result.profileId !== props.overview.profileId) return;
    activeGoal.value = result.activeGoal; recentCompletedGoal.value = result.recentCompletedGoal;
    if (result.outcome !== 'completed') evaluationNotice.value = t(result.outcome === 'inconclusive' ? 'home.goal.inconclusive' : 'home.goal.unchanged');
  } catch { if (generation === mutationGeneration) goalError.value = t('home.goal.error'); }
  finally { if (generation === mutationGeneration) busy.value = false; }
};
const completionChange = computed(() => {
  const result = recentCompletedGoal.value?.completionEvidence?.result;
  if (!result || !['score-pb','ng-reduced','rank-upgrade'].includes(result.goalType)) return '';
  const format = (value:number) => result.goalType === 'rank-upgrade' ? formatScoreRank(value,locale.value) : value.toLocaleString(locale.value === 'ja' ? 'ja-JP' : 'zh-CN');
  return `${format(result.before)} → ${format(result.after)}`;
});
const chooseAnother = () => document.querySelector<HTMLButtonElement>('.growth-plan__choose:not(:disabled)')?.focus();
const selectedChart = (item: GrowthPlanItem) => activeGoal.value?.songId === item.songId && activeGoal.value?.difficultyType === item.difficultyType;

const trackPlanClick = (songId: number) => trackViewerEvent("home_growth_plan_click", { song_id: songId, source: "growth_overview" });
</script>

<template>
  <section class="growth-surface" aria-labelledby="growth-title">
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
    <el-alert v-else-if="failed" :title="t('home.growth.loadFailed')" type="warning" :closable="false" show-icon />
    <template v-else>
      <header class="growth-focus panel-card">
        <div class="growth-focus__topline">
          <h1 id="growth-title">{{ greeting }}</h1>
          <div v-if="overview.playerState.overallRating !== null" class="growth-rating">
            <span>Rating</span>
            <strong>{{ overview.playerState.overallRating.toFixed(2) }}</strong>
          </div>
        </div>
        <div v-if="focusLabel && !balanced" class="growth-focus__next">
          <strong>{{ t("home.growth.nextFocusValue", { dimension: dimensionShortLabel(props.overview.playerState.priorityDimension!) }) }}</strong>
        </div>
        <div v-else class="growth-focus__limited">
          <strong>{{ t(balanced ? "home.growth.balanced" : "home.growth.limitedTitle") }}</strong>
        </div>
        <div v-if="skillItems.length" class="growth-skills" :aria-label="t('home.growth.skillOverview')">
          <div v-for="item in skillItems" :key="item.key" class="growth-skill" :class="{ 'growth-skill--priority': !balanced && overview.playerState.dataSufficiency === 'ready' && item.key === overview.playerState.priorityDimension }" :aria-label="skillAriaLabel(item.key, item.value)">
            <span :title="dimensionLabel(item.key)">{{ dimensionShortLabel(item.key) }}</span>
            <strong>{{ Number(item.value).toFixed(2) }}</strong>
          </div>
        </div>
      </header>

      <section class="growth-plan" aria-labelledby="growth-plan-title">
        <div class="growth-section-head">
          <div>
            <h2 id="growth-plan-title">{{ t("home.growth.planTitle") }}</h2>
          </div>
        </div>
        <div v-if="overview.todayPlan.items.length" class="growth-plan__items">
          <div v-for="item in overview.todayPlan.items" :key="`${item.songId}-${item.difficultyType}`" class="growth-plan__choice">
          <NuxtLink
            :to="localePath({ path: `/songs/${item.songId}`, query: { difficulty: String(item.difficultyType) } })"
            class="growth-plan__item"
            @click="trackPlanClick(item.songId)"
          >
            <div class="growth-plan__cover"><SongCoverImage :song-id="item.songId" :alt="item.title" sizes="72px" /></div>
            <div class="growth-plan__details">
              <strong>{{ item.title }}</strong>
              <span>{{ t(difficultyLabelKey(item.difficultyType)) }}<template v-if="item.starLevel"> · {{ item.starLevel }}{{ t("guide.starSuffix") }}</template></span>
              <small v-if="item.currentBestScore">{{ item.currentBestScore.toLocaleString() }}</small>
            </div>
            <span class="growth-plan__arrow" aria-hidden="true">↗</span>
          </NuxtLink>
          <button v-if="item.goalOptions?.length" class="growth-plan__choose" :disabled="busy" @click="openGoal(item)">{{ t(selectedChart(item) ? 'home.goal.selected' : 'home.goal.choose') }}</button>
          <span v-else class="growth-plan__unavailable">{{ t('home.goal.noOptions') }}</span>
          </div>
        </div>
        <p v-else class="growth-empty">{{ t("home.growth.noRecommendation") }}</p>
      </section>

      <section v-if="activeGoal" class="growth-goal" aria-labelledby="growth-goal-title" aria-live="polite">
        <h2 id="growth-goal-title">{{ t('home.goal.title') }}</h2>
        <strong>{{ activeGoal.title }}</strong>
        <span>{{ t(difficultyLabelKey(activeGoal.difficultyType)) }}<template v-if="activeGoal.starLevel"> · {{ activeGoal.starLevel }}{{ t('guide.starSuffix') }}</template></span>
        <span>{{ t(`home.goal.types.${activeGoal.goalType}`) }}</span>
        <span v-if="activeGoal.goalType === 'score-pb' && activeGoal.baseline.highScore !== null">{{ t('home.goal.baseline', { value: activeGoal.baseline.highScore.toLocaleString() }) }}</span>
        <span v-if="activeGoal.goalType === 'ng-reduced' && activeGoal.baseline.ngCnt !== null">{{ t('home.goal.baselineNg', { value: activeGoal.baseline.ngCnt }) }}</span>
        <span v-if="activeGoal.goalType === 'rank-upgrade'">{{ t('home.goal.baseline', { value: formatScoreRank(activeGoal.baseline.bestScoreRank, locale) }) }}</span>
        <span v-if="activeGoal.unavailable">{{ t('home.goal.unavailable') }}</span>
        <div class="goal-actions"><button class="goal-evaluate" :disabled="busy" @click="evaluate">{{ t(busy ? 'home.goal.saving' : 'home.goal.evaluate') }}</button><button :disabled="busy" @click="chooseAnother">{{ t('home.goal.replace') }}</button><button :disabled="busy" @click="mutate(true)">{{ t(busy ? 'home.goal.saving' : 'home.goal.cancel') }}</button></div>
      </section>
      <section v-else-if="recentCompletedGoal" class="growth-goal growth-goal--completed panel-card" aria-labelledby="goal-completed-title" aria-live="polite">
        <h2 id="goal-completed-title">{{ t('home.goal.completed') }}</h2>
        <strong>{{ recentCompletedGoal.title }}</strong>
        <span>{{ t(difficultyLabelKey(recentCompletedGoal.difficultyType)) }}<template v-if="recentCompletedGoal.starLevel"> · {{ recentCompletedGoal.starLevel }}{{ t('guide.starSuffix') }}</template></span>
        <span>{{ t(`home.goal.completedTypes.${recentCompletedGoal.goalType}`) }}</span>
        <strong v-if="completionChange">{{ completionChange }}</strong>
        <div class="goal-actions"><button @click="chooseAnother">{{ t('home.goal.chooseNext') }}</button></div>
      </section>
      <p v-if="evaluationNotice" role="status">{{ evaluationNotice }}</p>
      <p v-if="goalError && !selected" role="alert" class="goal-error">{{ goalError }}</p>
      <dialog ref="selector" class="goal-dialog" @keydown="trapGoalFocus" aria-labelledby="goal-dialog-title" @cancel.prevent="closeGoal" @close="returnFocus?.focus()">
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
      <section class="growth-progress" aria-labelledby="growth-progress-title">
        <div class="growth-section-head">
          <div>
            <h2 id="growth-progress-title">{{ t("home.growth.progressTitle") }}</h2>
          </div>
        </div>
        <div class="growth-progress__card panel-card">
          <p v-if="!hasProgress" class="growth-empty">{{ progress.attendance === "not_played" ? t("home.growth.noPlay") : t("home.growth.progressUnavailable") }}</p>
          <template v-else>
            <article v-for="event in progress.events" :key="`${event.songId}:${event.level}`" class="growth-event">
              <h3>{{ t(`home.growth.events.${event.facts[0].type}`) }}</h3>
              <strong class="growth-event__song">{{ event.title }}</strong>
              <span class="growth-summary">{{ t(difficultyLabelKey(event.level)) }}</span>
              <p v-for="fact in event.facts.filter(factualChange)" :key="fact.type" class="growth-event__change">
                <span>{{ t(`home.growth.factLabels.${fact.type}`) }} </span>
                {{ eventValue(fact, fact.before) }} → {{ eventValue(fact, fact.after) }}
                <span v-if="fact.type === 'score-pb'"> (+{{ eventValue(fact, fact.delta) }})</span>
              </p>
            </article>
            <p v-if="progress.uniqueCharts" class="growth-summary">{{ t('home.growth.playedSummary', { count: progress.uniqueCharts }) }}</p>
          </template>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.growth-plan__choice { min-width: 0; display: grid; gap: 4px; }
.growth-plan__choose { justify-self: end; }
.growth-plan__unavailable { padding: 8px; font-size: 12px; color: var(--el-text-color-secondary); }
.growth-goal { display: grid; gap: 7px; max-width: 540px; padding-block: 8px; color: var(--el-text-color-primary); }
.growth-goal--completed { padding: 20px; box-sizing: border-box; }
.growth-goal h2 { margin: 0 0 6px; font: 700 23px/1.2 var(--viewer-display-font); }
.growth-goal > strong { font-size: 18px; overflow-wrap: anywhere; }
.growth-goal > span { font-size: 14px; }
.goal-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
.growth-plan__choose, .goal-actions button { min-height: 44px; padding: 8px 14px; border: 1px solid var(--el-border-color); border-radius: 10px; background: var(--el-bg-color); color: var(--el-text-color-primary); cursor: pointer; font: inherit; }
button:disabled { opacity: .55; cursor: default; }
button:focus-visible, input:focus-visible { outline: 3px solid var(--el-color-primary); outline-offset: 3px; }
.goal-dialog { width: min(440px, calc(100vw - 32px)); max-height: 80dvh; overflow-y: auto; box-sizing: border-box; padding: 22px; border: 1px solid var(--el-border-color); border-radius: 18px; color: var(--el-text-color-primary); background: var(--el-bg-color); }
.goal-dialog::backdrop { background: rgb(0 0 0 / 40%); }
.goal-dialog h2 { margin: 0 0 16px; font-size: 21px; }
.goal-dialog fieldset { border: 0; padding: 0; margin: 12px 0; }
.goal-dialog legend { font-size: 14px; margin-bottom: 8px; }
.goal-dialog label { display: flex; align-items: center; gap: 10px; min-height: 44px; cursor: pointer; }
.goal-dialog input { accent-color: var(--el-color-primary); }
.goal-error { color: var(--el-color-danger); font-size: 14px; }

.growth-surface { --growth-section-gap: clamp(24px, 3vw, 32px); --growth-card-gap: 11px; display: grid; gap: var(--growth-section-gap); }
.growth-focus { border: 1px solid rgba(151,105,73,.18); border-radius: 22px; background: linear-gradient(135deg, rgba(255,252,247,.98), rgba(248,235,225,.92)); box-shadow: 0 16px 34px rgba(104,70,45,.08); }
.growth-focus { padding: clamp(22px, 4vw, 34px); display: grid; gap: 22px; }
.growth-focus__topline, .growth-section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.growth-focus h1, .growth-plan h2, .growth-progress h2 { margin: 0; color: #342922; font-family: var(--viewer-display-font); line-height: 1.1; }
.growth-focus h1 { font-size: clamp(24px, 3.4vw, 36px); }
.growth-plan h2, .growth-progress h2 { font-size: clamp(21px, 2.5vw, 28px); }
.growth-rating { display: grid; gap: 2px; text-align: right; }
.growth-rating span { color: #806b5c; font-size: 11px; font-weight: 700; }
.growth-rating strong { color: #342922; font: 800 28px/1 var(--viewer-display-font); }
.growth-focus__next { display: grid; gap: 5px; padding: 14px 0 2px; border-top: 1px solid rgba(151,105,73,.2); }
.growth-focus__next span { color: #806b5c; font-size: 12px; font-weight: 700; letter-spacing: .04em; }
.growth-focus__next strong { color: #b84d37; font: 800 clamp(22px, 3vw, 30px)/1.15 var(--viewer-display-font); }
.growth-focus__next small { color: #806b5c; font-size: 12px; }
.growth-focus__limited { display: grid; gap: 5px; padding: 14px 0 2px; border-top: 1px solid rgba(151,105,73,.2); color: #806b5c; }
.growth-focus__limited strong { color: #49382d; font-size: 17px; }
.growth-focus__limited span { max-width: 42ch; font-size: 14px; line-height: 1.55; }
.growth-skills { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
.growth-skill { position: relative; display: grid; gap: 3px; padding-top: 8px; border-top: 1px solid rgba(151,105,73,.2); }
.growth-skill span { color: #806b5c; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.growth-skill strong { color: #49382d; font-size: 14px; font-variant-numeric: tabular-nums; }
.growth-skill--priority { border-top-color: rgba(184,77,55,.55); }
.growth-skill--priority::after { content: ""; position: absolute; top: -2px; left: 0; width: 24px; height: 2px; border-radius: 99px; background: #b84d37; }
.growth-skill--priority span, .growth-skill--priority strong { font-weight: 800; }
.growth-plan, .growth-progress { display: grid; gap: 8px; min-width: 0; }
.growth-reason { margin: 0; color: #806b5c; font-size: 13px; line-height: 1.55; }
.growth-plan__items { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--growth-card-gap); margin-top: 8px; }
.growth-plan__item { min-width: 0; display: grid; grid-template-columns: 72px minmax(0, 1fr) auto; align-items: center; gap: 13px; padding: 13px 16px; border: 1px solid rgba(151,105,73,.14); border-radius: 15px; color: inherit; text-decoration: none; background: rgba(255,255,255,.5); transition: transform .18s ease, border-color .18s ease, background .18s ease; }
.growth-plan__item:hover { transform: translateY(-2px); border-color: rgba(184,77,55,.35); background: #fff; }
.growth-plan__item:focus-visible { outline: 3px solid #d18366; outline-offset: 3px; }
.growth-plan__cover { aspect-ratio: 1; overflow: hidden; border-radius: 10px; background: #f2e5da; }
.growth-plan__details { min-width: 0; display: grid; gap: 3px; }
.growth-plan__details strong { overflow: hidden; color: #49382d; font-size: 13px; line-height: 1.3; text-overflow: ellipsis; white-space: nowrap; }
.growth-plan__details span, .growth-plan__details small { color: #a85f3e; font-size: 11px; }
.growth-plan__details small { color: #806b5c; font-variant-numeric: tabular-nums; }
.growth-plan__arrow { color: #b84d37; font-size: 20px; }
.growth-empty { margin: 0; color: #806b5c; font-size: 13px; }
.growth-progress__card { display: grid; gap: 18px; min-width: 0; margin-top: 8px; padding: 19px 16px; border-radius: 18px; }
.growth-event { display: grid; gap: 6px; min-width: 0; color: #49382d; }
.growth-event + .growth-event { border-top: 1px solid rgba(151,105,73,.2); padding-top: 16px; }
.growth-event h3 { margin: 0; font-size: 14px; font-weight: 600; color: #a04430; }
.growth-event__song { font-size: 18px; overflow-wrap: anywhere; }
.growth-event__change { margin: 0; font-size: 16px; line-height: 1.6; font-variant-numeric: tabular-nums; }
.growth-summary { margin: 0; color: #735f50; font-size: 14px; }
:global(body.theme-dark .growth-event) { color: #f5e7dc; }
:global(body.theme-dark .growth-event h3) { color: #eaa58c; }
:global(body.theme-dark .growth-summary), :global(body.theme-dark .growth-empty) { color: #cbb8aa; }
:global(body.theme-dark .growth-focus) { border-color: rgba(255,255,255,.12); background: linear-gradient(135deg, rgba(46,35,29,.98), rgba(54,38,31,.94)); }
:global(body.theme-dark .growth-plan), :global(body.theme-dark .growth-progress) { border-color: rgba(255,255,255,.12); }
:global(body.theme-dark .growth-focus h1), :global(body.theme-dark .growth-plan h2), :global(body.theme-dark .growth-progress h2), :global(body.theme-dark .growth-rating strong), :global(body.theme-dark .growth-skill strong), :global(body.theme-dark .growth-plan__details strong) { color: #f5e7dc; }
:global(body.theme-dark .growth-focus__next strong), :global(body.theme-dark .growth-plan__arrow) { color: #e58b6e; }
:global(body.theme-dark .growth-focus__next), :global(body.theme-dark .growth-focus__limited) { border-color: rgba(255,255,255,.14); }
:global(body.theme-dark .growth-focus__limited strong) { color: #f5e7dc; }
:global(body.theme-dark .growth-skill--priority) { border-top-color: rgba(229,139,110,.65); }
:global(body.theme-dark .growth-skill--priority::after) { background: #e58b6e; }
:global(body.theme-dark .growth-plan__item) { border-color: rgba(255,255,255,.1); background: rgba(48,36,30,.65); }
.growth-loading { display: grid; gap: var(--growth-section-gap); }
.growth-loading > div { display: grid; align-content: start; gap: 14px; min-height: 150px; padding: clamp(22px, 4vw, 34px); border-radius: 22px; }
.growth-loading__focus { min-height: 235px !important; }
.growth-loading__plan, .growth-loading__progress { min-height: 180px !important; padding: 0; background: none; }
.growth-skeleton__line, .growth-skeleton__row { display: block; min-height: 0; border-radius: 6px; background: rgba(151,105,73,.16); }
.growth-skeleton__line--title { width: min(56%, 240px); height: 30px; }
.growth-skeleton__line--rating { width: 92px; height: 26px; margin-left: auto; }
.growth-skeleton__line--focus { width: min(72%, 310px); height: 36px; margin-top: 8px; }
.growth-skeleton__line--skills { width: 100%; height: 42px; margin-top: auto; }
.growth-skeleton__line--section { width: 130px; height: 27px; }
.growth-skeleton__line--progress { width: 78%; height: 58px; margin-top: 10px; }
.growth-skeleton__row { width: 100%; height: 58px; border: 1px solid rgba(151,105,73,.14); border-radius: 15px; }
@media (max-width: 820px) { .growth-skills { grid-template-columns: repeat(3, minmax(0, 1fr)); } .growth-plan__items { grid-template-columns: 1fr; } }
@media (max-width: 520px) { .growth-surface { padding-inline: 2px; } .growth-focus { padding: 19px; border-radius: 18px; } .growth-focus__topline { flex-direction: column; } .growth-rating { text-align: left; } .growth-plan__items { grid-template-columns: 1fr; } .growth-plan__item { padding: 13px 16px; } .growth-progress__card { margin-top: 8px; padding: 19px 16px; } .growth-loading > div { min-height: 130px; padding: 19px; border-radius: 18px; } .growth-loading__plan, .growth-loading__progress { padding: 0; } .growth-loading__focus { min-height: 190px !important; } }
@media (prefers-reduced-motion: reduce) { .growth-plan__item { transition: none; } .growth-plan__item:hover { transform: none; } }
</style>
