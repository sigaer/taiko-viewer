<script setup lang="ts">
import type { RatingDimensionKey } from "~/types/recommendation-intelligence";
import type { WeeklyGrowthHighlight, WeeklyGrowthResponse } from "~/types/player-growth";
import { difficultyLabelKey } from "~/utils/difficulty";
import { GROWTH_DIMENSION_LABELS } from "~/utils/playerGrowth";
import { composeWeeklyNarrative, composeRecommendationCopy, type GrowthVoiceContext } from "~/utils/growthVoice";
import { formatScoreRank } from "~/utils/scoreRank";
import { resolveViewerError } from "~/utils/viewerError";
import { buildPageDescription } from "~/utils/seo";

const { t, locale } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const apiFetch = useViewerApiFetch();
const { accountUser, fetchCurrentUser } = useAccountState();
await fetchCurrentUser();

definePageMeta({
  contentLayout: "reading",
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

const bindingGeneration = useState("account-binding-generation", () => 0);
const identity = computed(() => `${accountUser.value?.id || "guest"}:${bindingGeneration.value}`);
const context = computed(() => `${identity.value}:${String(route.query.week || "current")}`);
const guard = useAccountRequestGuard();
const fetchWeekly = async (_app: unknown, { signal }: { signal: AbortSignal }) => {
  const requestedContext = context.value, request = guard.capture();
  if (!accountUser.value) return { payload: null, error: "", context: requestedContext };
  try {
    const week = typeof route.query.week === "string" ? route.query.week : undefined;
    const payload = await apiFetch<WeeklyGrowthResponse>("/api/account/growth/weekly", { signal, query: week ? { week } : undefined, retry: 0 });
    return guard.current(request) && context.value === requestedContext
      ? { payload, error: "", context: requestedContext } : { payload: null, error: "", context: requestedContext };
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    const message = await resolveViewerError(error, t("weekly.loadFailed"), t);
    return { payload: null, error: guard.current(request) && context.value === requestedContext ? message : "", context: requestedContext };
  }
};
const weeklyRead = useAsyncData(`growth-weekly:${accountUser.value?.id || 'guest'}:${route.path}`, fetchWeekly, {
  lazy: true,
  default: () => ({ payload: null, error: "", context: "" }),
  dedupe: "cancel"
});
const { data: weeklyState, pending, status, refresh, clear } = weeklyRead;
useAccountDataRefresh(context, () => { guard.invalidate(); clear(); }, refresh, [weeklyRead]);
onUnmounted(clear);
const retry = () => refresh();
const weekly = computed(() => weeklyState.value?.context === context.value ? weeklyState.value.payload : null);
const pageError = computed(() => weeklyState.value?.context === context.value ? weeklyState.value.error : "");
const dateFormatter = computed(() => new Intl.DateTimeFormat(locale.value === "ja" ? "ja-JP" : "zh-CN", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Shanghai" }));
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
const totalFields = ['distinctCharts', 'pb', 'fc', 'df', 'rankUpgrade', 'completedGoals'] as const;
const recordMethodChanged = computed(() => ['algorithm-mismatch', 'model-mismatch', 'measurement-version-mismatch'].includes(measurement.value?.reason || ''));

</script>

<template>
  <main class="weekly-page">
    <section v-if="!accountUser" class="weekly-state panel-card">
      <p class="weekly-kicker">{{ t("weekly.title") }}</p>
      <h1>{{ t("weekly.guestTitle") }}</h1>
      <NuxtLink :to="localePath('/account/login')" class="weekly-button">{{ t("weekly.login") }}</NuxtLink>
    </section>

    <section v-else-if="(pending || status === 'idle') && !weekly" class="weekly-loading" aria-busy="true" :aria-label="t('weekly.loading')">
      <span v-for="index in 4" :key="index" class="weekly-loading__line shimmer-card"></span>
    </section>

    <section v-else-if="pageError || !weekly" class="weekly-state panel-card" role="alert">
      <h1>{{ t("weekly.loadFailed") }}</h1>
      <p v-if="pageError">{{ pageError }}</p>
      <NuxtLink :to="localePath('/account/profile')">{{ t("growthProfileEntry") }}</NuxtLink>
      <button class="weekly-button" type="button" @click="retry">{{ t("weekly.retry") }}</button>
    </section>

    <template v-else>
      <header class="weekly-hero">
        <div class="weekly-hero__meta">
          <p class="weekly-kicker">{{ t(weekly.week.isCompleteWeek ? "weekly.completeWeek" : "weekly.currentWeek") }}</p>
          <button class="weekly-refresh" type="button" @click="retry">{{ t("weekly.refresh") }}</button>
        </div>
        <time>{{ formatDay(weekly.week.from) }} — {{ formatDay(weekly.week.to) }}</time>
        <div class="weekly-summary" :aria-label="t('weekly.recordedTotals')">
          <dl><div v-for="field in totalFields" :key="field"><dt>{{ t(`weekly.totals.${field}`) }}</dt><dd>{{ weekly.totals[field].toLocaleString(numberLocale) }}</dd></div></dl>
        </div>
        <p class="weekly-theme">{{ themeText }}</p>
        <p v-if="coverageIncomplete" class="weekly-coverage" role="note">{{ t(`weekly.coverage.${weekly.coverage.scoreHistoryState}`) }}</p>
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
              <p class="weekly-highlight__change">{{ highlightChange(highlight) }}</p>
              <NuxtLink :to="localePath({ path: `/songs/${highlight.songId}`, query: { difficulty: String(highlight.difficultyType) } })">
                <strong>{{ highlight.title }}</strong>
              </NuxtLink>
              <span>{{ t(difficultyLabelKey(highlight.difficultyType)) }}</span>
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
        <details v-else-if="recordMethodChanged" class="weekly-coverage"><summary>{{ t('weekly.segmentUpdated') }}</summary><p>{{ t(`weekly.measurementReasons.${measurement.reason}`) }}</p></details>
        <p v-else class="weekly-muted">{{ t(`weekly.measurement.${measurement?.reason || 'insufficient'}`) }}</p>
      </section>

      <section class="weekly-section weekly-next" aria-labelledby="weekly-next-title">
        <h2 id="weekly-next-title">{{ t("weekly.currentAdvice") }}</h2>
        <p v-if="next" class="weekly-next__focus">{{ t(nextCopy.observation.key) }}</p>
        <p v-if="!next || !next.todayPlan.items.length" class="weekly-muted">{{ t("weekly.noAdvice") }}</p>
        <div v-if="next?.todayPlan.items.length" class="weekly-next__songs">
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
.weekly-page { width:100%; display:grid; gap:28px; padding-bottom:32px; }
.weekly-hero { display:grid; gap:12px; }
.weekly-hero__meta,.weekly-section__head { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px; }
.weekly-kicker { margin:0; color:var(--viewer-accent-strong); font-weight:700; font-size:14px; }
.weekly-hero time { font-size:18px; line-height:1.5; font-weight:700; }
.weekly-refresh { min-height:44px; border:1px solid var(--viewer-border); border-radius:8px; padding:0 14px; background:var(--viewer-surface); color:var(--viewer-accent-strong); cursor:pointer; font:inherit; }
.weekly-summary { padding:16px; background:var(--viewer-surface); border-radius:12px; }
.weekly-summary dl { display:flex; flex-wrap:wrap; gap:16px 28px; margin:0; }
.weekly-summary dl > div { display:flex; align-items:baseline; gap:8px; }
.weekly-summary dt { color:var(--viewer-text-muted); font-size:13px; }
.weekly-summary dd { margin:0; font-size:20px; font-weight:700; font-variant-numeric:tabular-nums; }
.weekly-theme { margin:4px 0 0; font-size:21px; line-height:1.55; font-weight:700; text-wrap:pretty; }
.weekly-coverage { margin:0; font-size:13px; line-height:1.65; color:var(--viewer-text-muted); }
.weekly-passport-link { min-height:44px; display:inline-flex; align-items:center; justify-self:start; color:var(--viewer-accent-strong); text-decoration:none; font-size:14px; }
.weekly-section { min-width:0; }
.weekly-section h2 { font-size:19px; line-height:1.5; margin:0 0 12px; }
.weekly-section__head > span { color:var(--viewer-text-muted); font-size:13px; }
.weekly-rhythm { display:grid; }
.weekly-highlight { display:grid; grid-template-columns:48px minmax(0,1fr); gap:12px; align-items:start; padding:16px 0; border-bottom:1px solid var(--viewer-border); }
.weekly-highlight:last-child { border-bottom:0; }
.weekly-highlight__beat { display:none; }
.weekly-highlight__cover,.weekly-highlight__cover :deep(img) { display:block; width:48px; height:48px; border-radius:8px; }
.weekly-highlight__body { min-width:0; display:grid; gap:5px; }
.weekly-highlight__body a { color:var(--viewer-accent-strong); text-decoration:none; overflow-wrap:anywhere; }
.weekly-highlight__body a strong { font-weight:500; font-size:14px; }
.weekly-highlight__body span,.weekly-highlight__body small { font-size:13px; color:var(--viewer-text-muted); }
.weekly-highlight__change { margin:0; font-size:17px; line-height:1.5; font-weight:700; }
.weekly-measurement,.weekly-next { padding-top:24px; border-top:1px solid var(--viewer-border); }
.weekly-measurement__change { display:flex; flex-wrap:wrap; align-items:baseline; gap:10px 16px; margin:16px 0 10px; }
.weekly-measurement__change strong { font-size:22px; font-variant-numeric:tabular-nums; }
.weekly-measurement__change i { color:var(--viewer-text-muted); font-style:normal; }
.weekly-measurement__change small,.weekly-measurement__rating { color:var(--viewer-accent-strong); font-weight:700; }
.weekly-measurement p { line-height:1.65; margin:10px 0 0; }
.weekly-coverage summary { min-height:44px; align-content:center; cursor:pointer; }
.weekly-next__focus { margin:0 0 12px; line-height:1.6; }
.weekly-next__songs { display:grid; gap:8px; }
.weekly-next__songs a { display:grid; grid-template-columns:48px minmax(0,1fr) auto; align-items:center; gap:12px; min-height:64px; padding:8px 0; color:var(--viewer-text); text-decoration:none; }
.weekly-next__songs :deep(img) { width:48px; height:48px; border-radius:8px; }
.weekly-next__songs span { display:grid; gap:4px; min-width:0; overflow-wrap:anywhere; }
.weekly-next__songs small { color:var(--viewer-text-muted); }
.weekly-next__songs i { color:var(--viewer-accent-strong); font-style:normal; }
.weekly-page button:focus-visible,.weekly-page a:focus-visible,.weekly-page summary:focus-visible { outline:2px solid var(--viewer-accent-strong); outline-offset:3px; }
.weekly-muted { color:var(--viewer-text-muted); line-height:1.6; }
.weekly-state { display:grid; justify-items:start; gap:16px; padding:24px; }
.weekly-state h1 { margin:0; font-size:24px; }
.weekly-state p { margin:0; line-height:1.6; }
.weekly-button { min-height:44px; display:inline-flex; align-items:center; padding:0 16px; border:0; border-radius:8px; color:var(--viewer-on-primary); background:var(--viewer-primary); text-decoration:none; font:inherit; cursor:pointer; }
.weekly-loading { display:grid; gap:16px; }
.weekly-loading__line { display:block; height:92px; border-radius:12px; }
@media(max-width:600px) {
 .weekly-summary dl { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px 16px; }
 .weekly-summary dl > div { justify-content:space-between; flex-wrap:wrap; gap:4px; }
 .weekly-summary dt { max-width:calc(100% - 24px); }
 .weekly-measurement__change > span { width:100%; }
 .weekly-hero time { font-size:17px; }
}
</style>
