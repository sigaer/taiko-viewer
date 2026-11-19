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
  hidePageHeader: true,
  contentLayout: "wide",
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
// Presentation of slice C: the range line and the focus sentence (previous / next week: components/rework/weekly/Hero.vue).
const rangeText = computed(() => weekly.value ? t("rework.weeklyPage.range", { from: formatDay(weekly.value.week.from), to: formatDay(weekly.value.week.to) }) : "");
const focusText = computed(() => {
  const m = measurement.value;
  if (!m?.compatible) return "";
  if (m.focusFrom !== m.focusTo) return t("weekly.measurement.focusChanged", { from: focusLabel(m.focusFrom), to: focusLabel(m.focusTo) });
  return m.focusTo ? t("weekly.measurement.focusSame", { focus: focusLabel(m.focusTo) }) : "";
});
const recordMethodChanged = computed(() => ['algorithm-mismatch', 'model-mismatch', 'measurement-version-mismatch'].includes(measurement.value?.reason || ''));

</script>

<template>
  <main class="weekly-page wk">
    <ReworkPageHeader v-if="!weekly || pageError" :title="t('weekly.title')" />

    <ReworkGate v-if="!accountUser" class="weekly-state" need="login" :title="t('weekly.guestTitle')" :redirect="localePath('/my/weekly')" />

    <ReworkState v-else-if="(pending || status === 'idle') && !weekly" kind="loading" class="weekly-loading" :title="t('weekly.loading')" :lines="6" />

    <ReworkState v-else-if="pageError || !weekly" kind="failed" class="weekly-state" :title="t('weekly.loadFailed')" :text="pageError" :retry-label="t('weekly.retry')" @retry="retry">
      <NuxtLink class="rw-btn rw-btn--ghost" :to="localePath('/account/profile')">{{ t("growthProfileEntry") }}</NuxtLink>
    </ReworkState>

    <template v-else>
      <ReworkWeeklyHero
        class="weekly-hero"
        :weekly="weekly"
        :theme="themeText"
        :range-text="rangeText"
        :coverage-note="coverageIncomplete ? t(`weekly.coverage.${weekly.coverage.scoreHistoryState}`) : ''"
        :number-locale="numberLocale"
        @refresh="retry"
      />
      <div class="wk-cols">
        <div class="wk-main">
          <ReworkPanel v-if="weekly.highlights.length" class="weekly-section" plain :title="t('weekly.highlights')">
            <ReworkWeeklyHighlights class="weekly-rhythm" :items="weekly.highlights" :change="highlightChange" />
          </ReworkPanel>
          <ReworkWeeklyChange v-else :change="measurement" :complete-week="weekly.week.isCompleteWeek" :focus-text="focusText" :record-method-changed="recordMethodChanged" />
        </div>
        <aside class="wk-side">
          <ReworkWeeklyChange v-if="weekly.highlights.length" :change="measurement" :complete-week="weekly.week.isCompleteWeek" :focus-text="focusText" :record-method-changed="recordMethodChanged" />
          <ReworkPanel class="weekly-section weekly-next" plain :title="t('weekly.currentAdvice')">
            <p v-if="next" class="rw-count wk-next-say weekly-next__focus">{{ t(nextCopy.observation.key) }}</p>
            <ReworkState v-if="!next || !next.todayPlan.items.length" kind="empty" compact :title="t('weekly.noAdvice')" />
            <ReworkGrowthSongs v-else class="weekly-next__songs" :items="next.todayPlan.items" />
          </ReworkPanel>
          <NuxtLink :to="localePath('/my/growth')" class="rw-btn weekly-passport-link">{{ t("weekly.passportEntry") }}</NuxtLink>
        </aside>
      </div>
    </template>
  </main>
</template>

<style scoped>
.wk { width: 100%; display: grid; gap: 32px; padding-bottom: 32px; min-width: 0; }
.wk-cols { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 48px; align-items: start; }
.wk-main, .wk-side { display: grid; gap: 32px; min-width: 0; align-content: start; }
.wk-main > *, .wk-side > * { min-width: 0; }
.wk-side > .weekly-passport-link { justify-self: start; }
.wk-next-say { margin: 0 0 12px; }
@media (max-width: 1099px) {
  .wk-cols { grid-template-columns: minmax(0, 1fr); gap: 32px; }
}
</style>
