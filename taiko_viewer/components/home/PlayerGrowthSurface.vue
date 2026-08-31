<script setup lang="ts">
import type { RatingDimensionKey } from "~/types/recommendation-intelligence";
import type { PlayerGrowthOverview } from "~/types/player-growth";
import { GROWTH_DIMENSION_LABELS, GROWTH_DIMENSION_SHORT_LABELS, growthGreetingPeriod } from "~/utils/playerGrowth";
import { difficultyLabelKey } from "~/utils/difficulty";
import { trackViewerEvent } from "~/utils/analytics";

const props = defineProps<{ overview: PlayerGrowthOverview; displayName: string; pending?: boolean; failed?: boolean }>();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const dimensionLabel = (key: RatingDimensionKey | null) => key ? GROWTH_DIMENSION_LABELS[key][locale.value === "ja" ? "ja" : "zh"] : "";
const dimensionShortLabel = (key: RatingDimensionKey) => GROWTH_DIMENSION_SHORT_LABELS[key][locale.value === "ja" ? "ja" : "zh"];
const greeting = computed(() => t(`home.growth.greeting.${growthGreetingPeriod()}`, { name: props.displayName }));
const focusLabel = computed(() => props.overview.playerState.dataSufficiency === "ready" ? dimensionLabel(props.overview.playerState.priorityDimension) : "");
const planReason = computed(() => props.overview.todayPlan.usedFallback ? t("home.growth.planReasonGeneral") : t("home.growth.planReasonDimension", { dimension: focusLabel.value }));
const progress = computed(() => props.overview.dailyProgress);
const hasProgress = computed(() => progress.value.attendance === "played");
const summaryMetrics = computed(() => [
  progress.value.uniqueCharts === null ? null : { value: progress.value.uniqueCharts, label: t("home.growth.uniqueCharts") },
  progress.value.newBestCount === null ? null : { value: progress.value.newBestCount, label: t("home.growth.newBest") },
  progress.value.crownChanges === null ? null : { value: progress.value.crownChanges, label: t("home.growth.crownChanges") }
].filter(Boolean) as Array<{ value: number; label: string }>);
const skillItems = computed(() => props.overview.playerState.skills.filter((item) => Number(item.value) > 0));
const skillAriaLabel = (key: RatingDimensionKey, value: number) => `${dimensionLabel(key)} ${Number(value).toFixed(2)}`;

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
        <div v-if="focusLabel" class="growth-focus__next">
          <span>{{ t("home.growth.nextFocus") }}</span>
          <strong>{{ t("home.growth.nextFocusValue", { dimension: dimensionShortLabel(props.overview.playerState.priorityDimension!) }) }}</strong>
          <small v-if="overview.playerState.tiedDimensions.length > 1">{{ t("home.growth.tieHint") }}</small>
        </div>
        <div v-else class="growth-focus__limited">
          <strong>{{ t("home.growth.limitedTitle") }}</strong>
          <span>{{ t("home.growth.limitedBody") }}</span>
        </div>
        <div v-if="skillItems.length" class="growth-skills" :aria-label="t('home.growth.skillOverview')">
          <div v-for="item in skillItems" :key="item.key" class="growth-skill" :class="{ 'growth-skill--priority': item.key === overview.playerState.priorityDimension }" :aria-label="skillAriaLabel(item.key, item.value)">
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
        <p class="growth-reason">{{ planReason }}</p>
        <div v-if="overview.todayPlan.items.length" class="growth-plan__items">
          <NuxtLink
            v-for="item in overview.todayPlan.items"
            :key="`${item.songId}-${item.difficultyType}`"
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
        </div>
        <p v-else class="growth-empty">{{ t("home.growth.noRecommendation") }}</p>
      </section>

      <section class="growth-progress" aria-labelledby="growth-progress-title">
        <div class="growth-section-head">
          <div>
            <h2 id="growth-progress-title">{{ t("home.growth.progressTitle") }}</h2>
          </div>
        </div>
        <div class="growth-progress__card panel-card">
          <p v-if="!hasProgress" class="growth-empty">{{ progress.attendance === "not_played" ? t("home.growth.noPlay") : t("home.growth.progressUnavailable") }}</p>
          <template v-else>
            <div class="growth-metrics">
              <div v-for="metric in summaryMetrics" :key="metric.label" class="growth-metric"><strong>{{ metric.value }}</strong><span>{{ metric.label }}</span></div>
            </div>
            <div v-if="progress.breakthrough" class="growth-breakthrough">
              <span>{{ t("home.growth.recentBreakthrough") }}</span>
              <strong>{{ progress.breakthrough.title }}</strong>
              <small v-if="progress.breakthrough.scoreDelta">+{{ progress.breakthrough.scoreDelta.toLocaleString() }}</small>
            </div>
          </template>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
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
.growth-metrics { display: flex; flex-wrap: wrap; gap: 10px; }
.growth-metric { min-width: 92px; display: grid; gap: 2px; padding-right: 16px; border-right: 1px solid rgba(151,105,73,.18); }
.growth-metric strong { color: #342922; font: 800 24px/1 var(--viewer-display-font); }
.growth-metric span, .growth-breakthrough span { color: #806b5c; font-size: 11px; }
.growth-breakthrough { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 10px; padding-top: 12px; border-top: 1px solid rgba(151,105,73,.16); }
.growth-breakthrough strong { min-width: 0; overflow: hidden; color: #49382d; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.growth-breakthrough small { color: #b84d37; font-size: 13px; font-weight: 800; }
:global(body.theme-dark .growth-focus) { border-color: rgba(255,255,255,.12); background: linear-gradient(135deg, rgba(46,35,29,.98), rgba(54,38,31,.94)); }
:global(body.theme-dark .growth-plan), :global(body.theme-dark .growth-progress) { border-color: rgba(255,255,255,.12); }
:global(body.theme-dark .growth-focus h1), :global(body.theme-dark .growth-plan h2), :global(body.theme-dark .growth-progress h2), :global(body.theme-dark .growth-rating strong), :global(body.theme-dark .growth-skill strong), :global(body.theme-dark .growth-plan__details strong), :global(body.theme-dark .growth-metric strong), :global(body.theme-dark .growth-breakthrough strong) { color: #f5e7dc; }
:global(body.theme-dark .growth-focus__next strong), :global(body.theme-dark .growth-plan__arrow), :global(body.theme-dark .growth-breakthrough small) { color: #e58b6e; }
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
@media (max-width: 520px) { .growth-surface { padding-inline: 2px; } .growth-focus { padding: 19px; border-radius: 18px; } .growth-focus__topline { flex-direction: column; } .growth-rating { text-align: left; } .growth-breakthrough { grid-template-columns: 1fr auto; } .growth-breakthrough span { grid-column: 1 / -1; } .growth-plan__items { grid-template-columns: 1fr; } .growth-plan__item { padding: 13px 16px; } .growth-progress__card { margin-top: 8px; padding: 19px 16px; } .growth-loading > div { min-height: 130px; padding: 19px; border-radius: 18px; } .growth-loading__plan, .growth-loading__progress { padding: 0; } .growth-loading__focus { min-height: 190px !important; } }
@media (prefers-reduced-motion: reduce) { .growth-plan__item { transition: none; } .growth-plan__item:hover { transform: none; } }
</style>
