<script setup lang="ts">
import type { RatingDimensionKey } from "~/types/recommendation-intelligence";
import type { WeeklyGrowthHighlight, WeeklyGrowthResponse } from "~/types/player-growth";
import { difficultyLabelKey } from "~/utils/difficulty";
import { GROWTH_DIMENSION_LABELS } from "~/utils/playerGrowth";
import { composeWeeklyNarrative, composeRecommendationCopy, type GrowthVoiceContext } from "~/utils/growthVoice";
import { formatScoreRank } from "~/utils/scoreRank";
import { buildPageDescription } from "~/utils/seo";

const { t, locale } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const apiFetch = useViewerApiFetch();
const { accountUser, fetchCurrentUser } = useAccountState();
await fetchCurrentUser();

definePageMeta({
  pageTitleKey: "weekly.title",
  pageDescKey: "weekly.description",
  navKey: "/my/weekly",
  hidePageDescription: true,
  breadcrumbs: [
    { labelKey: "nav.myTaiko", to: "/my" },
    { labelKey: "weekly.title", to: "/my/weekly" }
  ]
});

useViewerSeo(() => ({
  title: t("weekly.title"),
  description: buildPageDescription(t("weekly.description")),
  path: "/my/weekly"
}));

const fetchWeekly = async () => {
  if (!accountUser.value) return { payload: null, error: "" };
  try {
    const week = typeof route.query.week === "string" ? route.query.week : undefined;
    return { payload: await apiFetch<WeeklyGrowthResponse>("/api/account/growth/weekly", { query: week ? { week } : undefined }), error: "" };
  } catch {
    return { payload: null, error: t("weekly.loadFailed") };
  }
};

const { data: weeklyState, pending, refresh } = await useAsyncData("growth-weekly", fetchWeekly, {
  default: () => ({ payload: null, error: "" }),
  watch: [() => route.query.week]
});
const retry = () => refresh();
const weekly = computed(() => weeklyState.value?.payload || null);
const pageError = computed(() => weeklyState.value?.error || "");
const dateFormatter = computed(() => new Intl.DateTimeFormat(locale.value === "ja" ? "ja-JP" : "zh-CN", { month: "short", day: "numeric", timeZone: "Asia/Shanghai" }));
const numberLocale = computed(() => locale.value === "ja" ? "ja-JP" : "zh-CN");
const coverageIncomplete = computed(() => weekly.value?.coverage.scoreHistoryState !== "complete");

const formatDay = (day: string) => dateFormatter.value.format(new Date(`${day}T12:00:00+08:00`));
const signed = (value: number | null, digits = 2) => value === null ? "" : `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
const dimensionLabel = (key: RatingDimensionKey) => GROWTH_DIMENSION_LABELS[key][locale.value === "ja" ? "ja" : "zh"];
const focusLabel = (focus: WeeklyGrowthResponse["measurementChange"]["focusTo"]) => {
  if (!focus) return "";
  return focus in GROWTH_DIMENSION_LABELS ? dimensionLabel(focus as RatingDimensionKey) : t(`weekly.focus.${focus}`);
};
const factValue = (highlight: WeeklyGrowthHighlight, value: number | null) => {
  if (value === null) return "";
  if (highlight.primaryType === "rank-upgrade") return formatScoreRank(value, locale.value);
  return value.toLocaleString(numberLocale.value);
};
const highlightChange = (highlight: WeeklyGrowthHighlight) => {
  if (highlight.before === null || highlight.after === null) return t(`weekly.fact.${highlight.primaryType}`);
  return `${t(`weekly.fact.${highlight.primaryType}`)} ${factValue(highlight, highlight.before)} → ${factValue(highlight, highlight.after)}`;
};
const themeText = computed(() => {
  if (!weekly.value) return "";
  return t(composeWeeklyNarrative(weekly.value.theme).key);
});
const measurement = computed(() => weekly.value?.measurementChange || null);
const next = computed(() => weekly.value?.currentNextAction || null);
const businessDate = useState('growth-voice-business-date', () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
const nextCopy = computed(() => composeRecommendationCopy({ profileId: `${accountUser.value?.id}:${weekly.value?.profileId}`, businessDate: businessDate.value, focus: next.value?.focus || null, readiness: !next.value || ['limited', 'insufficient-data'].includes(next.value.focus) ? 'limited' : 'ready', goalState: 'none', activity: 'unknown' } as GrowthVoiceContext));
const recordMethodChanged = computed(() => ['algorithm-mismatch', 'model-mismatch', 'measurement-version-mismatch'].includes(measurement.value?.reason || ''));

</script>

<template>
  <main class="weekly-page">
    <section v-if="!accountUser" class="weekly-state panel-card">
      <p class="weekly-kicker">{{ t("weekly.title") }}</p>
      <h1>{{ t("weekly.guestTitle") }}</h1>
      <NuxtLink :to="localePath('/account/login')" class="weekly-button">{{ t("weekly.login") }}</NuxtLink>
    </section>

    <section v-else-if="pending" class="weekly-loading" aria-busy="true" :aria-label="t('weekly.loading')">
      <span v-for="index in 4" :key="index" class="weekly-loading__line shimmer-card"></span>
    </section>

    <section v-else-if="pageError || !weekly" class="weekly-state panel-card" role="alert">
      <h1>{{ t("weekly.loadFailed") }}</h1>
      <button class="weekly-button" type="button" @click="retry">{{ t("weekly.retry") }}</button>
    </section>

    <template v-else>
      <header class="weekly-hero panel-card">
        <div class="weekly-hero__meta">
          <p class="weekly-kicker">{{ t(weekly.week.isCompleteWeek ? "weekly.completeWeek" : "weekly.currentWeek") }}</p>
          <time>{{ formatDay(weekly.week.from) }} — {{ formatDay(weekly.week.to) }}</time>
        </div>
        <h1>{{ themeText }}</h1>
        <details v-if="coverageIncomplete" class="weekly-coverage"><summary>{{ t("weekly.recordsRange") }}</summary><p>{{ t(`weekly.coverage.${weekly.coverage.scoreHistoryState}`) }}</p></details>
        <NuxtLink :to="localePath('/my/growth')" class="weekly-passport-link">{{ t("weekly.passportEntry") }} <span aria-hidden="true">→</span></NuxtLink>
      </header>

      <section v-if="weekly.highlights.length" class="weekly-section" aria-labelledby="weekly-highlights-title">
        <h2 id="weekly-highlights-title">{{ t("weekly.highlights") }}</h2>
        <div class="weekly-rhythm">
          <article v-for="(highlight, index) in weekly.highlights" :key="highlight.id" class="weekly-highlight">
            <span class="weekly-highlight__beat" aria-hidden="true">{{ index + 1 }}</span>
            <NuxtLink :to="localePath({ path: `/songs/${highlight.songId}`, query: { difficulty: String(highlight.difficultyType) } })" class="weekly-highlight__cover">
              <SongCoverImage :song-id="highlight.songId" :alt="highlight.title" sizes="64px" />
            </NuxtLink>
            <div class="weekly-highlight__body">
              <NuxtLink :to="localePath({ path: `/songs/${highlight.songId}`, query: { difficulty: String(highlight.difficultyType) } })">
                <strong>{{ highlight.title }}</strong>
              </NuxtLink>
              <span>{{ t(difficultyLabelKey(highlight.difficultyType)) }}</span>
              <p>{{ highlightChange(highlight) }}</p>
              <small v-if="highlight.goalCompleted">{{ t("weekly.goalCompleted") }}</small>
            </div>
          </article>
        </div>
      </section>

      <section class="weekly-section weekly-measurement" aria-labelledby="weekly-measurement-title">
        <div class="weekly-section__head">
          <h2 id="weekly-measurement-title">{{ t("weekly.measurement.title") }}</h2>
          <span v-if="measurement?.start && measurement?.end">{{ t(weekly.week.isCompleteWeek ? "weekly.measurement.weekEnd" : "weekly.measurement.now") }}</span>
        </div>
        <template v-if="measurement?.compatible">
          <div v-if="measurement.primaryDimension" class="weekly-measurement__change">
            <span>{{ dimensionLabel(measurement.primaryDimension.key) }}</span>
            <strong>{{ measurement.primaryDimension.before.toFixed(2) }} <i aria-hidden="true">→</i> {{ measurement.primaryDimension.after.toFixed(2) }}</strong>
            <small>{{ signed(measurement.primaryDimension.delta) }}</small>
          </div>
          <p v-if="measurement.ratingDelta !== null" class="weekly-measurement__rating">Rating {{ signed(measurement.ratingDelta) }}</p>
          <p v-if="measurement.focusFrom !== measurement.focusTo">
            {{ t("weekly.measurement.focusChanged", { from: focusLabel(measurement.focusFrom), to: focusLabel(measurement.focusTo) }) }}
          </p>
          <p v-else-if="measurement.focusTo">{{ t("weekly.measurement.focusSame", { focus: focusLabel(measurement.focusTo) }) }}</p>
        </template>
        <details v-else-if="recordMethodChanged" class="weekly-coverage"><summary>{{ t('weekly.segmentUpdated') }}</summary><p>{{ t('weekly.segmentExplanation') }}</p></details>
        <p v-else class="weekly-muted">{{ t(`weekly.measurement.${measurement?.reason || 'insufficient'}`) }}</p>
      </section>

      <section v-if="next" class="weekly-section weekly-next" aria-labelledby="weekly-next-title">
        <h2 id="weekly-next-title">{{ t("weekly.next.title") }}</h2>
        <p class="weekly-next__focus">{{ t(nextCopy.observation.key) }}</p>
        <div v-if="next.todayPlan.items.length" class="weekly-next__songs">
          <NuxtLink
            v-for="item in next.todayPlan.items"
            :key="`${item.songId}-${item.difficultyType}`"
            :to="localePath({ path: `/songs/${item.songId}`, query: { difficulty: String(item.difficultyType) } })"
          >
            <SongCoverImage :song-id="item.songId" :alt="item.title" sizes="48px" />
            <span><strong>{{ item.title }}</strong><small>{{ t(difficultyLabelKey(item.difficultyType)) }}</small></span>
            <i aria-hidden="true">↗</i>
          </NuxtLink>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.weekly-page { width: min(100%, 880px); margin: 0 auto; display: grid; gap: 34px; padding-bottom: 42px; }
.weekly-hero { position: relative; overflow: hidden; padding: clamp(24px, 5vw, 52px); border-radius: 26px; }
.weekly-hero::after { content: ""; position: absolute; right: -44px; bottom: -62px; width: 190px; height: 190px; border: 1px solid rgba(184, 77, 55, .18); border-radius: 50%; box-shadow: 0 0 0 24px rgba(184, 77, 55, .035), 0 0 0 54px rgba(184, 77, 55, .025); pointer-events: none; }
.weekly-hero__meta, .weekly-section__head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
.weekly-kicker { margin: 0; color: var(--viewer-accent-strong); font-size: 12px; font-weight: 800; letter-spacing: .12em; }
.weekly-hero time, .weekly-section__head span { color: var(--viewer-text-muted); font-size: 12px; }
.weekly-hero h1 { text-wrap: balance; position: relative; z-index: 1; max-width: 650px; margin: 36px 0 10px; color: var(--viewer-text); font: 800 clamp(30px, 5vw, 50px)/1.16 var(--viewer-display-font); letter-spacing: -.035em; }
.weekly-coverage summary { min-height: 44px; display: list-item; align-content: center; cursor: pointer; }
.weekly-coverage summary:focus-visible { outline: 2px solid var(--viewer-accent-strong); outline-offset: 3px; }
.weekly-coverage { position: relative; z-index: 1; margin: 20px 0 0; color: var(--viewer-text-muted); font-size: 12px; }
.weekly-passport-link { position: relative; z-index: 1; display: inline-flex; margin-top: 20px; color: var(--viewer-accent-strong); font-size: 13px; font-weight: 800; text-decoration: none; }
.weekly-passport-link:hover, .weekly-passport-link:focus-visible { text-decoration: underline; text-underline-offset: 4px; }
.weekly-section { padding: 0 clamp(4px, 3vw, 26px); }
.weekly-section h2 { margin: 0 0 18px; color: var(--viewer-text); font: 800 21px/1.25 var(--viewer-display-font); }
.weekly-rhythm { position: relative; display: grid; gap: 0; }
.weekly-rhythm::before { content: ""; position: absolute; top: 24px; bottom: 24px; left: 17px; width: 1px; background: linear-gradient(var(--viewer-accent-strong), rgba(184, 77, 55, .12)); }
.weekly-highlight { position: relative; display: grid; grid-template-columns: 35px 64px minmax(0, 1fr); gap: 14px; align-items: center; min-height: 104px; padding: 14px 0; }
.weekly-highlight__beat { z-index: 1; display: grid; width: 35px; height: 35px; place-items: center; border: 1px solid rgba(184, 77, 55, .32); border-radius: 50%; color: var(--viewer-accent-strong); background: var(--viewer-surface); font-size: 11px; font-weight: 800; }
.weekly-highlight__cover, .weekly-highlight__cover :deep(img) { display: block; width: 64px; height: 64px; border-radius: 14px; }
.weekly-highlight__cover { overflow: hidden; box-shadow: 0 7px 20px rgba(69, 44, 30, .12); }
.weekly-highlight__body { min-width: 0; display: grid; gap: 4px; }
.weekly-highlight__body a { min-width: 0; overflow: hidden; color: var(--viewer-text); text-decoration: none; text-overflow: ellipsis; white-space: nowrap; }
.weekly-highlight__body span, .weekly-highlight__body small { color: var(--viewer-text-muted); font-size: 12px; }
.weekly-highlight__body p { margin: 2px 0 0; color: var(--viewer-text); font-weight: 700; }
.weekly-highlight__body small { color: var(--viewer-accent-strong); }
.weekly-measurement { border-top: 1px solid var(--viewer-border); padding-top: 28px; }
.weekly-measurement__change { display: grid; grid-template-columns: minmax(70px, 1fr) auto auto; gap: 16px; align-items: baseline; padding: 18px 0; }
.weekly-measurement__change > span { color: var(--viewer-text-muted); font-weight: 700; }
.weekly-measurement__change strong { color: var(--viewer-text); font: 800 clamp(23px, 4vw, 34px)/1 var(--viewer-display-font); }
.weekly-measurement__change strong i { margin: 0 5px; color: var(--viewer-accent-strong); font-style: normal; font-weight: 400; }
.weekly-measurement__change small, .weekly-measurement__rating { color: var(--viewer-accent-strong); font-weight: 800; }
.weekly-measurement p { margin: 10px 0 0; color: var(--viewer-text-muted); line-height: 1.65; }
.weekly-next { padding-top: 28px; border-top: 1px solid var(--viewer-border); }
.weekly-next__focus { margin: 0 0 18px; color: var(--viewer-text); font: 700 19px/1.5 var(--viewer-display-font); }
.weekly-next__songs { display: grid; gap: 8px; }
.weekly-next__songs a { min-width: 0; display: grid; grid-template-columns: 48px minmax(0, 1fr) auto; gap: 12px; align-items: center; min-height: 64px; padding: 8px 10px; border-radius: 14px; color: var(--viewer-text); text-decoration: none; transition: background .18s ease, transform .18s ease; }
.weekly-next__songs a:hover, .weekly-next__songs a:focus-visible { background: rgba(196, 164, 132, .12); transform: translateX(3px); }
.weekly-next__songs :deep(img) { display: block; width: 48px; height: 48px; border-radius: 10px; }
.weekly-next__songs span { min-width: 0; display: grid; gap: 3px; }
.weekly-next__songs strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.weekly-next__songs small { color: var(--viewer-text-muted); }
.weekly-next__songs i { color: var(--viewer-accent-strong); font-style: normal; }
.weekly-muted { color: var(--viewer-text-muted); }
.weekly-state { display: grid; justify-items: start; gap: 16px; padding: 28px; }
.weekly-state h1 { margin: 0; color: var(--viewer-text); font-size: 24px; }
.weekly-button { min-height: 44px; display: inline-flex; align-items: center; padding: 0 17px; border: 0; border-radius: 12px; color: #fff; background: var(--viewer-accent-strong); text-decoration: none; font: inherit; font-weight: 800; cursor: pointer; }
.weekly-loading { display: grid; gap: 18px; padding: 28px; }
.weekly-loading__line { display: block; height: 92px; border-radius: 18px; }

:global(body.theme-dark .weekly-highlight__beat) { color: #e5a184; background: #241d19; border-color: rgba(229, 161, 132, .68); }
:global(body.theme-dark .weekly-rhythm::before) { background: linear-gradient(#e5a184, rgba(229, 161, 132, .22)); }
:global(body.theme-dark .weekly-hero h1),
:global(body.theme-dark .weekly-section h2),
:global(body.theme-dark .weekly-highlight__body a),
:global(body.theme-dark .weekly-highlight__body p),
:global(body.theme-dark .weekly-measurement__change strong),
:global(body.theme-dark .weekly-next__focus),
:global(body.theme-dark .weekly-next__songs a),
:global(body.theme-dark .weekly-state h1) { color: #f2e7dc; }
:global(body.theme-dark .weekly-hero time),
:global(body.theme-dark .weekly-section__head span),
:global(body.theme-dark .weekly-coverage),
:global(body.theme-dark .weekly-highlight__body span),
:global(body.theme-dark .weekly-measurement p),
:global(body.theme-dark .weekly-next__songs small),
:global(body.theme-dark .weekly-muted) { color: #bfaea0; }
:global(body.theme-dark .weekly-kicker),
:global(body.theme-dark .weekly-highlight__body small),
:global(body.theme-dark .weekly-measurement__change small),
:global(body.theme-dark .weekly-measurement__rating),
:global(body.theme-dark .weekly-next__songs i) { color: #e5a184; }

@media (max-width: 600px) {
  .weekly-page { gap: 27px; }
  .weekly-hero { padding: 24px 20px 30px; border-radius: 20px; }
  .weekly-hero__meta { align-items: flex-start; flex-direction: column; gap: 6px; }
  .weekly-hero h1 { margin-top: 28px; font-size: 32px; }
  .weekly-section { padding-inline: 3px; }
  .weekly-highlight { grid-template-columns: 31px 54px minmax(0, 1fr); gap: 11px; min-height: 91px; }
  .weekly-rhythm::before { left: 15px; }
  .weekly-highlight__beat { width: 31px; height: 31px; }
  .weekly-highlight__cover, .weekly-highlight__cover :deep(img) { width: 54px; height: 54px; border-radius: 12px; }
  .weekly-measurement__change { grid-template-columns: 1fr auto; gap: 8px 12px; }
  .weekly-measurement__change strong { grid-column: 1 / -1; grid-row: 2; justify-self: start; }
  .weekly-measurement__change small { grid-column: 2; grid-row: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .weekly-next__songs a { transition: none; }
}
</style>
