<script setup lang="ts">
import type { RatingDimensionKey } from "~/types/recommendation-intelligence";
import type { SkillPassportMilestone, SkillPassportPoint, SkillPassportRangeDays, SkillPassportResponse, SkillPassportTrendDimension } from "~/types/player-growth";
import { difficultyLabelKey } from "~/utils/difficulty";
import { GROWTH_DIMENSION_LABELS, GROWTH_DIMENSION_ORDER } from "~/utils/playerGrowth";
import { composeRecommendationCopy, type GrowthVoiceContext } from "~/utils/growthVoice";
import { formatScoreRank } from "~/utils/scoreRank";
import { passportRangeChoices, selectPassportPeriod } from "~/utils/passportPresentation";
import { composePassportMilestoneNarrative } from "~/utils/passportNarrative";
import { resolveViewerError } from "~/utils/viewerError";
import { buildPageDescription } from "~/utils/seo";

const { t, locale } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const apiFetch = useViewerApiFetch();
const bindingGeneration = useState("account-binding-generation", () => 0);
const homeGeneration = useState("account-home-generation", () => 0);
const { accountUser, fetchCurrentUser } = useAccountState();
await fetchCurrentUser();

definePageMeta({
  hidePageHeader: true,
  contentLayout: "wide",
  pageTitleKey: "passport.title",
  pageDescKey: "passport.description",
  navKey: "/my/growth",
  hidePageDescription: true,
  breadcrumbs: [
    { labelKey: "nav.myTaiko", to: "/my" },
    { labelKey: "passport.title", to: "/my/growth" }
  ]
});

useViewerSeo(() => ({ title: t("passport.title"), description: buildPageDescription(t("passport.description")), path: "/my/growth" }));

const ranges: SkillPassportRangeDays[] = [30, 90, 180, 365];
const dimensions: SkillPassportTrendDimension[] = ["rating", ...GROWTH_DIMENSION_ORDER];
const requestedRange = computed(() => ranges.includes(Number(route.query.range) as SkillPassportRangeDays) ? Number(route.query.range) as SkillPassportRangeDays : 90);
const requestedDimension = computed(() => dimensions.includes(String(route.query.dimension) as SkillPassportTrendDimension) ? String(route.query.dimension) as SkillPassportTrendDimension : "rating");

const identity = computed(() => `${accountUser.value?.id || "guest"}:${bindingGeneration.value}:${homeGeneration.value}`);
const guard = useAccountRequestGuard();
const passportKey = `growth-passport:${identity.value}:${useRouter().currentRoute.value.path}`;
const fetchPassport = async (_app: unknown, { signal }: { signal: AbortSignal }) => {
  if (!accountUser.value) return { payload: null, error: "" };
  const context = identity.value, request = guard.capture();
  try {
    const range = requestedRange.value;
    const userId = accountUser.value.id, generation = bindingGeneration.value;
    const payload = await apiFetch<SkillPassportResponse>("/api/account/growth/passport", { signal, query: { range, dimension: requestedDimension.value }, retry: 0 });
    if (!guard.current(request) || context !== identity.value || accountUser.value?.id !== userId || bindingGeneration.value !== generation) return { payload: null, error: "" };
    if (payload.range.requestedDays !== range) throw new Error("passport-range-mismatch");
    return {
      payload,
      error: "", context
    };
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    const message = await resolveViewerError(error, t("passport.loadFailed"), t);
    return guard.current(request) && context === identity.value ? { payload: null, error: message, context } : { payload: null, error: "" };
  }
};

const passportRead = useAsyncData(passportKey, fetchPassport, {
  lazy: true,
  default: () => ({ payload: null, error: "" }),
  dedupe: "cancel"
});
const { data: passportState, pending, status, refresh, clear } = passportRead;
onUnmounted(clear);
useAccountDataRefresh(identity, () => { guard.invalidate(); clear(); }, refresh, [passportRead]);
const passport = computed(() => selectPassportPeriod(passportState.value?.context === identity.value ? passportState.value.payload : null, requestedRange.value));
const pageError = computed(() => passportState.value?.context === identity.value ? passportState.value.error : "");
const selectedDimension = computed(() => requestedDimension.value === "rating" ? "accuracy_power" : requestedDimension.value);

const dateFormatter = computed(() => new Intl.DateTimeFormat(locale.value === "ja" ? "ja-JP" : "zh-CN", { month: "short", day: "numeric", timeZone: "Asia/Shanghai" }));
const fullDateFormatter = computed(() => new Intl.DateTimeFormat(locale.value === "ja" ? "ja-JP" : "zh-CN", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Shanghai" }));
const numberLocale = computed(() => locale.value === "ja" ? "ja-JP" : "zh-CN");
const formatDay = (day: string) => dateFormatter.value.format(new Date(`${day}T12:00:00+08:00`));
const formatCaptured = (value: string) => fullDateFormatter.value.format(new Date(value));
const dimensionLabel = (key: RatingDimensionKey) => GROWTH_DIMENSION_LABELS[key][locale.value === "ja" ? "ja" : "zh"];
const trendLabel = (key: SkillPassportTrendDimension) => key === "rating" ? "Rating" : dimensionLabel(key);
const focusLabel = (focus: SkillPassportPoint["focus"] | null) => focus && focus in GROWTH_DIMENSION_LABELS
  ? dimensionLabel(focus as RatingDimensionKey)
  : t(`passport.focus.${focus || "insufficient-data"}`);
const rangeChoices = passportRangeChoices();
const activeRange = requestedRange;

const changeRange = async (range: SkillPassportRangeDays) => {
  if (range === requestedRange.value) { if (pageError.value) await refresh(); return; }
  await navigateTo(localePath({ path: "/my/growth", query: { range: String(range), dimension: requestedDimension.value } }));
};
const chooseDimension = (dimension: SkillPassportTrendDimension) => navigateTo(localePath({ path: "/my/growth", query: { ...route.query, dimension } }));
const retry = () => refresh();

const currentSkills = computed(() => GROWTH_DIMENSION_ORDER.map(key => {
  const value = passport.value?.current?.dimensions[key];
  return { key, value: typeof value === "number" && Number.isFinite(value) ? value : null };
}));
const skillMax = computed(() => Math.max(1, ...currentSkills.value.map(item => item.value ?? 0)));
const businessDate = useState('growth-voice-business-date', () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
const passportCopy = computed(() => composeRecommendationCopy({ profileId: `${accountUser.value?.id}:${passport.value?.profileId}`, businessDate: businessDate.value, focus: passport.value?.current?.focus || null, readiness: passport.value?.current?.readiness || 'insufficient', goalState: passport.value?.activeGoal ? 'active' : passport.value?.recentCompletedGoal ? 'completed' : 'none', activity: 'unknown' } as GrowthVoiceContext));
const focusChangeText = computed(() => {
  const change = passport.value?.currentSegmentChange;
  if (!change?.compatible || !change.focusFrom || !change.focusTo || !(change.focusTo in GROWTH_DIMENSION_LABELS)) return "";
  return t(change.focusFrom === change.focusTo ? "passport.focusContinuing" : "passport.focusChanged", { from: focusLabel(change.focusFrom), focus: focusLabel(change.focusTo) });
});
const coverageText = computed(() => passport.value ? t(`passport.coverage.${passport.value.coverage.recentFactsState}`) : "");
const expandedMilestones = ref(false);
watch([requestedRange, identity], () => { expandedMilestones.value = false; });
const initialMilestones = computed(() => new Set(passport.value?.initialMilestoneIds || passport.value?.milestones.slice(0, 8).map(node => node.id)));
const visibleMilestones = computed(() => passport.value?.milestones.filter(node => expandedMilestones.value || initialMilestones.value.has(node.id)) || []);
const moreMilestones = computed(() => (passport.value?.milestones.length || 0) > initialMilestones.value.size);
const narratives = computed(() => new Map((passport.value?.milestones || []).map(node => [node.id, composePassportMilestoneNarrative(node, (type, value) => type === 'rank-upgrade' ? formatScoreRank(value, locale.value) : value.toLocaleString(numberLocale.value))])));
const narrative = (node: SkillPassportMilestone) => narratives.value.get(node.id)!;
const evidenceText = (line: ReturnType<typeof composePassportMilestoneNarrative>['support'][number]) => t(line.key, { ...line.params, label: t(`passport.fact.${line.params.type}`) });
// Presentation of slice C: the comparable start point drawn dashed on the radar, the highlighted dimension.
const radarStart = computed(() => {
  const change = passport.value?.currentSegmentChange;
  return change?.compatible && change.start ? { dimensions: change.start.dimensions, day: change.start.day } : null;
});
const radarFocus = computed(() => {
  const focus = passport.value?.current?.focus;
  return focus && focus in GROWTH_DIMENSION_LABELS ? focus : null;
});
const milestoneDate = (milestone: SkillPassportMilestone) => milestone.day ? formatDay(milestone.day) : milestone.observedAt ? formatCaptured(milestone.observedAt) : t("passport.unknownDate");
</script>

<template>
  <main class="passport-page gp">
    <ReworkPageHeader :class="{ 'passport-hero': !!passport }" :title="t('passport.title')">
      <p v-if="passport?.coverage.measurementFrom" class="rw-count passport-recorded">{{ t("passport.recordedSince", { date: formatCaptured(passport.coverage.measurementFrom) }) }}</p>
      <template #actions>
        <NuxtLink v-if="accountUser" :to="localePath('/my/weekly')" class="rw-btn passport-weekly-link">{{ t("passport.weeklyEntry") }}</NuxtLink>
      </template>
    </ReworkPageHeader>

    <ReworkGate v-if="!accountUser" class="gp-gate passport-state" need="login" :title="t('passport.guestTitle')" :redirect="localePath('/my/growth')" />

    <ReworkState v-else-if="(pending || status === 'idle') && !passport" kind="loading" class="passport-loading" :title="t('passport.loading')" :lines="6" />

    <ReworkState v-else-if="!passport" kind="failed" class="gp-gate passport-state" :title="t('passport.loadFailed')" :text="pageError" :retry-label="t('passport.retry')" @retry="retry">
      <NuxtLink class="rw-btn rw-btn--ghost" :to="localePath('/account/profile')">{{ t("growthProfileEntry") }}</NuxtLink>
    </ReworkState>

    <div v-else class="gp-cols">
      <div class="gp-main">
        <ReworkPanel class="passport-section passport-trend" :title="t('passport.trend.title')" :aria-busy="pending || undefined">
          <template #actions>
            <div class="rw-seg passport-range" role="group" :aria-label="t('passport.rangeLabel')">
              <button v-for="choice in rangeChoices" :key="choice.days" type="button" :data-range="choice.days" :aria-pressed="activeRange === choice.days" @click="changeRange(choice.days)">{{ t("passport.rangeDays", { days: choice.days }) }}</button>
            </div>
          </template>
          <div class="gp-trend">
            <p v-if="pending" class="rw-note passport-updating" role="status">{{ t("passport.updating") }}</p>
            <ReworkState v-else-if="pageError" kind="failed" compact class="passport-refresh-error" :title="pageError" :retry-label="t('passport.retry')" @retry="retry" />
            <p class="rw-count passport-coverage">{{ t("passport.rangeActual", { range: requestedRange, days: passport.range.measurementDays ?? passport.segments.reduce((sum, segment) => sum + segment.points.length, 0) }) }}</p>
            <ReworkGrowthMetricChart :title="t('passport.ratingTrend')" :segments="passport.segments" dimension="rating" label="Rating" :from="passport.range.from || passport.coverage.recentFactsFrom" :to="passport.range.to || passport.coverage.recentFactsTo" />
            <ReworkGrowthMetricChart :title="t('passport.skillTrend')" :segments="passport.segments" :dimension="selectedDimension" :label="trendLabel(selectedDimension)" :from="passport.range.from || passport.coverage.recentFactsFrom" :to="passport.range.to || passport.coverage.recentFactsTo">
              <template #controls>
                <div class="rw-seg passport-dimensions" role="group" :aria-label="t('passport.dimensionLabel')">
                  <button v-for="dimension in GROWTH_DIMENSION_ORDER" :key="dimension" type="button" :aria-pressed="selectedDimension === dimension" @click="chooseDimension(dimension)">{{ dimensionLabel(dimension) }}</button>
                </div>
              </template>
            </ReworkGrowthMetricChart>
          </div>
        </ReworkPanel>

        <ReworkGrowthMilestones
          :items="visibleMilestones"
          :total="passport.milestones.length"
          :narrative="narrative"
          :evidence-text="evidenceText"
          :date-text="milestoneDate"
          :fact-dates="t('passport.factDates', { from: formatDay(passport.coverage.recentFactsFrom), to: formatDay(passport.coverage.recentFactsTo) })"
          :more="moreMilestones"
          :expanded="expandedMilestones"
          :coverage-note="passport.coverage.recentFactsState !== 'complete' ? coverageText : ''"
          @toggle="expandedMilestones = !expandedMilestones"
        />

        <ReworkGrowthFocus v-if="passport.focusTimeline.length" :runs="passport.focusTimeline" :label="focusLabel" :day="formatDay" :note="focusChangeText" />
      </div>

      <aside class="gp-side">
        <GoalsPortfolio v-if="passport.profileId" :profile-id="passport.profileId" :identity="`${accountUser?.id}:${passport.profileId}`" @completed="retry" />
        <ReworkGrowthNow :current="passport.current" :start="radarStart" :focus="radarFocus" :observation="t(passportCopy.observation.key)" :day-label="formatDay" />
        <ReworkGrowthNext
          v-if="passport.activeGoal || passport.recentCompletedGoal || passport.currentNextAction"
          :active-goal="passport.activeGoal"
          :completed-goal="passport.recentCompletedGoal"
          :invitation="passport.currentNextAction ? t(passportCopy.invitation.key) : ''"
          :items="passport.currentNextAction?.todayPlan.items || []"
        />
      </aside>
    </div>
  </main>
</template>

<style scoped>
.gp { width: 100%; display: grid; gap: 24px; padding-bottom: 32px; min-width: 0; }
.gp-cols { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 40px; align-items: start; }
.gp-main, .gp-side { display: grid; gap: 32px; min-width: 0; }
.gp-main > *, .gp-side > * { min-width: 0; }
.gp-trend { display: grid; gap: 24px; min-width: 0; }
@media (max-width: 1099px) {
  .gp-cols { grid-template-columns: minmax(0, 1fr); gap: 32px; }
  .gp-side { order: -1; }
}
</style>
