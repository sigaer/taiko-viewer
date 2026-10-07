<script setup lang="ts">
import type { RatingDimensionKey } from "~/types/recommendation-intelligence";
import type { SkillPassportMilestone, SkillPassportPoint, SkillPassportRangeDays, SkillPassportResponse, SkillPassportTrendDimension } from "~/types/player-growth";
import { difficultyLabelKey } from "~/utils/difficulty";
import { GROWTH_DIMENSION_LABELS, GROWTH_DIMENSION_ORDER } from "~/utils/playerGrowth";
import { composePassportNarrative, composeRecommendationCopy, type GrowthVoiceContext } from "~/utils/growthVoice";
import { formatScoreRank } from "~/utils/scoreRank";
import { passportCoverageSpan, passportRangeChoices, passportTrendStory } from "~/utils/passportPresentation";
import { buildPageDescription } from "~/utils/seo";

const { t, locale } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const apiFetch = useViewerApiFetch();
const nuxtApp = useNuxtApp();
const { accountUser, fetchCurrentUser } = useAccountState();
await fetchCurrentUser();

definePageMeta({
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

const passportKey = `growth-passport:${accountUser.value?.id || 'guest'}:${useRouter().currentRoute.value.path}`;
const fetchPassport = async () => {
  if (!accountUser.value) return { payload: null, error: "" };
  try {
    const range = requestedRange.value;
    const payload = await apiFetch<SkillPassportResponse>("/api/account/growth/passport", { query: { range, dimension: requestedDimension.value }, retry: 0 });
    if (payload.range.requestedDays !== range) throw new Error("passport-range-mismatch");
    return {
      payload,
      error: ""
    };
  } catch {
    return { payload: (nuxtApp.payload.data[passportKey]?.payload || null) as SkillPassportResponse | null, error: t("passport.loadFailed") };
  }
};

const { data: passportState, pending, refresh, clear } = await useAsyncData(passportKey, fetchPassport, {
  default: () => ({ payload: null, error: "" }),
  watch: [requestedRange, () => accountUser.value?.id],
  dedupe: "cancel"
});
onUnmounted(clear);
watch(() => accountUser.value?.id, clear, { flush: "sync" });
const passport = computed(() => passportState.value?.payload || null);
const pageError = computed(() => passportState.value?.error || "");
const selectedDimension = ref<SkillPassportTrendDimension>(requestedDimension.value);
watch(requestedDimension, dimension => { selectedDimension.value = dimension; });
const selectedPointId = ref("");

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
const rangeChoices = computed(() => passportRangeChoices(passportCoverageSpan(passport.value?.coverage)));
const activeRange = computed(() => rangeChoices.value.find(choice => choice.days === (pending.value ? requestedRange.value : passport.value?.range.requestedDays))?.days
  || rangeChoices.value.at(-1)?.days);

const changeRange = async (range: SkillPassportRangeDays) => {
  if (range === requestedRange.value) { if (pageError.value) await refresh(); return; }
  await navigateTo(localePath({ path: "/my/growth", query: { range: String(range), dimension: selectedDimension.value } }));
};
const chooseDimension = (dimension: SkillPassportTrendDimension) => { selectedDimension.value = dimension; };
const retry = () => refresh();

type ChartPoint = SkillPassportPoint & { segmentId: string; segmentIndex: number; value: number };
const pointValue = (point: SkillPassportPoint, dimension: SkillPassportTrendDimension) => dimension === "rating" ? point.rating : point.dimensions[dimension];
const chartSegments = computed(() => (passport.value?.segments || []).map((segment, segmentIndex) => ({
  id: segment.id,
  index: segmentIndex,
  points: segment.points.flatMap(point => {
    const value = pointValue(point, selectedDimension.value);
    return typeof value === "number" && Number.isFinite(value) ? [{ ...point, segmentId: segment.id, segmentIndex, value }] : [];
  })
})).filter(segment => segment.points.length));
const chartPoints = computed(() => chartSegments.value.flatMap(segment => segment.points));
const chartBounds = computed(() => {
  const points = chartPoints.value;
  if (!points.length) return null;
  const values = points.map(point => point.value);
  const days = points.map(point => Date.parse(`${point.day}T00:00:00Z`));
  const rawMin = Math.min(...values), rawMax = Math.max(...values);
  const padding = rawMin === rawMax ? Math.max(Math.abs(rawMin) * .04, .25) : (rawMax - rawMin) * .12;
  return { min: rawMin - padding, max: rawMax + padding, first: Math.min(...days), last: Math.max(...days), rawMin, rawMax };
});
const xFor = (day: string) => {
  const bounds = chartBounds.value;
  if (!bounds || bounds.first === bounds.last) return 360;
  return 46 + ((Date.parse(`${day}T00:00:00Z`) - bounds.first) / (bounds.last - bounds.first)) * 628;
};
const yFor = (value: number) => {
  const bounds = chartBounds.value;
  if (!bounds || bounds.min === bounds.max) return 130;
  return 224 - ((value - bounds.min) / (bounds.max - bounds.min)) * 182;
};
const pathFor = (points: ChartPoint[]) => points.map((point, index) => `${index ? "L" : "M"}${xFor(point.day).toFixed(1)},${yFor(point.value).toFixed(1)}`).join(" ");
const selectPoint = (point: ChartPoint) => { selectedPointId.value = `${point.segmentId}:${point.id}`; };
const selectedPoint = computed(() => chartPoints.value.find(point => `${point.segmentId}:${point.id}` === selectedPointId.value) || chartPoints.value.at(-1) || null);
watch([selectedDimension, passport], () => { selectedPointId.value = ""; });

const chartSummary = computed(() => {
  const points = chartPoints.value;
  if (!points.length) return t("passport.trend.noPoints");
  if (points.length === 1) return t("passport.trend.onePoint", { dimension: trendLabel(selectedDimension.value), day: formatDay(points[0]!.day), value: points[0]!.value.toFixed(2) });
  const first = points[0]!, last = points.at(-1)!;
  return t((passport.value?.segments.length || 0) > 1 ? "passport.trend.summaryBreak" : "passport.trend.summary", { dimension: trendLabel(selectedDimension.value), fromDay: formatDay(first.day), from: first.value.toFixed(2), toDay: formatDay(last.day), to: last.value.toFixed(2) });
});
const currentSkills = computed(() => GROWTH_DIMENSION_ORDER.flatMap(key => {
  const value = passport.value?.current?.dimensions[key];
  return typeof value === "number" && Number.isFinite(value) ? [{ key, value }] : [];
}));
const skillMax = computed(() => Math.max(1, ...currentSkills.value.map(item => item.value)));
const primaryChangeText = computed(() => {
  const story = passportTrendStory(passport.value, selectedDimension.value);
  const dimension = trendLabel(selectedDimension.value);
  const state = !passport.value?.current ? 'new' : story.state === 'accumulating' && (passport.value?.segments.length || 0) > 1 ? 'updated' : story.state === 'changed' ? (story.last.value < story.first.value ? 'down' : 'up') : story.state;
  const line = composePassportNarrative(state, story.state === 'stable' || story.state === 'changed' ? { dimension, value: story.last.value.toFixed(2), from: story.first.value.toFixed(2), to: story.last.value.toFixed(2) } : {});
  return t(line.key, line.params || {});
});
const businessDate = useState('growth-voice-business-date', () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
const passportCopy = computed(() => composeRecommendationCopy({ profileId: `${accountUser.value?.id}:${passport.value?.profileId}`, businessDate: businessDate.value, focus: passport.value?.current?.focus || null, readiness: passport.value?.current?.readiness || 'insufficient', goalState: passport.value?.activeGoal ? 'active' : passport.value?.recentCompletedGoal ? 'completed' : 'none', activity: 'unknown' } as GrowthVoiceContext));
const focusChangeText = computed(() => {
  const change = passport.value?.currentSegmentChange;
  if (!change?.compatible || !change.focusFrom || !change.focusTo || !(change.focusTo in GROWTH_DIMENSION_LABELS)) return "";
  return t(change.focusFrom === change.focusTo ? "passport.focusContinuing" : "passport.focusChanged", { from: focusLabel(change.focusFrom), focus: focusLabel(change.focusTo) });
});
const actualRangeText = computed(() => {
  if (!passport.value?.range.actualFrom || !passport.value.range.actualTo) return "";
  const days = passport.value.segments.reduce((sum, segment) => sum + segment.points.length, 0);
  return t("passport.rangeActual", { days });
});
const coverageText = computed(() => passport.value ? t(`passport.coverage.${passport.value.coverage.recentFactsState}`) : "");
const hasSegmentBreak = computed(() => (passport.value?.segments.length || 0) > 1);
const currentLimited = computed(() => passport.value?.current?.readiness !== "ready");

const milestoneValue = (milestone: SkillPassportMilestone, value: number | null) => {
  if (value === null) return "—";
  if (milestone.primaryType === "rank-upgrade") return formatScoreRank(value, locale.value);
  return Number(value).toLocaleString(numberLocale.value);
};
const milestoneChange = (milestone: SkillPassportMilestone) => {
  if (milestone.primaryType === "goal-completed" || milestone.before === null || milestone.after === null) return t(`passport.fact.${milestone.primaryType}`);
  return `${t(`passport.fact.${milestone.primaryType}`)} ${milestoneValue(milestone, milestone.before)} → ${milestoneValue(milestone, milestone.after)}`;
};
const milestoneDate = (milestone: SkillPassportMilestone) => milestone.day ? formatDay(milestone.day) : milestone.observedAt ? formatCaptured(milestone.observedAt) : "";
</script>

<template>
  <main class="passport-page">
    <section v-if="!accountUser" class="passport-state panel-card">
      <p class="passport-kicker">{{ t("passport.title") }}</p>
      <h1>{{ t("passport.guestTitle") }}</h1>
      <NuxtLink :to="localePath('/account/login')" class="passport-button">{{ t("passport.login") }}</NuxtLink>
    </section>

    <section v-else-if="pending && !passport" class="passport-loading" aria-busy="true" :aria-label="t('passport.loading')">
      <span v-for="index in 4" :key="index" class="passport-loading__line shimmer-card"></span>
    </section>

    <section v-else-if="!passport" class="passport-state panel-card" role="alert">
      <h1>{{ t("passport.loadFailed") }}</h1>
      <button class="passport-button" type="button" @click="retry">{{ t("passport.retry") }}</button>
    </section>

    <template v-else>
      <header class="passport-hero panel-card">
        <div class="passport-hero__topline">
          <div>
            <p class="passport-kicker">{{ t("passport.title") }}</p>
            <h1>{{ t("passport.currentTitle") }}</h1>
          </div>
          <NuxtLink :to="localePath('/my/weekly')" class="passport-weekly-link">{{ t("passport.weeklyEntry") }} <span aria-hidden="true">→</span></NuxtLink>
        </div>
        <p v-if="passport.coverage.measurementFrom" class="passport-recorded">{{ t("passport.recordedSince", { date: formatCaptured(passport.coverage.measurementFrom) }) }}</p>
        <div v-if="passport.current" class="passport-now">
          <div v-if="passport.current.rating !== null" class="passport-rating"><span>Rating</span><strong>{{ passport.current.rating.toFixed(2) }}</strong></div>
          <p class="passport-focus">{{ t(passportCopy.observation.key) }}</p>
        </div>
        <div v-if="currentSkills.length" class="passport-skills" :aria-label="t('passport.skillOverview')">
          <div v-for="skill in currentSkills" :key="skill.key" class="passport-skill">
            <span>{{ dimensionLabel(skill.key) }}</span>
            <i aria-hidden="true"><b :style="{ width: `${Math.max(4, skill.value / skillMax * 100)}%` }"></b></i>
            <strong>{{ skill.value.toFixed(2) }}</strong>
          </div>
        </div>
      </header>

      <section class="passport-section passport-trend" aria-labelledby="passport-trend-title" :aria-busy="pending || undefined">
        <div class="passport-section__head">
          <div><p class="passport-kicker">{{ actualRangeText }}</p><h2 id="passport-trend-title">{{ t("passport.trend.title") }}</h2></div>
        </div>
        <p class="passport-change">{{ primaryChangeText }}</p>
        <p v-if="focusChangeText" class="passport-focus-note">{{ focusChangeText }}</p>
        <div class="passport-controls">
          <div v-if="rangeChoices.length" class="passport-range" role="group" :aria-label="t('passport.rangeLabel')">
            <button v-for="choice in rangeChoices" :key="choice.days" type="button" :data-range="choice.days" :aria-pressed="activeRange === choice.days" @click="changeRange(choice.days)">{{ choice.all ? t('passport.rangeAll') : t("passport.rangeDays", { days: choice.days }) }}</button>
          </div>
          <div class="passport-dimensions" role="group" :aria-label="t('passport.dimensionLabel')">
            <button v-for="dimension in dimensions" :key="dimension" type="button" :aria-pressed="selectedDimension === dimension" @click="chooseDimension(dimension)">{{ trendLabel(dimension) }}</button>
          </div>
        </div>
        <p v-if="pending" class="passport-updating" role="status">{{ t('passport.updating') }}</p>
        <div v-else-if="pageError" class="passport-refresh-error" role="alert"><span>{{ pageError }}</span><button type="button" @click="retry">{{ t('passport.retry') }}</button></div>

        <p v-if="!currentLimited && chartPoints.length <= 1" class="passport-empty">{{ chartSummary }}</p>
        <div v-else-if="!currentLimited" class="passport-chart-wrap">
          <p id="passport-chart-summary" class="passport-chart-summary">{{ chartSummary }}</p>
          <svg class="passport-chart" viewBox="0 0 720 260" role="img" aria-labelledby="passport-trend-title passport-chart-summary">
            <line x1="46" y1="224" x2="674" y2="224" class="passport-chart__axis" />
            <line x1="46" y1="42" x2="674" y2="42" class="passport-chart__guide" />
            <g v-for="segment in chartSegments" :key="segment.id" :class="`passport-chart__segment passport-chart__segment--${segment.index % 3}`">
              <path :d="pathFor(segment.points)" />
              <circle
                v-for="point in segment.points"
                :key="point.id"
                :cx="xFor(point.day)"
                :cy="yFor(point.value)"
                r="7"
                tabindex="0"
                role="button"
                :aria-label="t('passport.trend.pointLabel', { day: formatDay(point.day), dimension: trendLabel(selectedDimension), value: point.value.toFixed(2), focus: focusLabel(point.focus) })"
                @click="selectPoint(point)"
                @focus="selectPoint(point)"
                @keydown.enter.prevent="selectPoint(point)"
                @keydown.space.prevent="selectPoint(point)"
              />
            </g>
            <text x="46" y="22">{{ chartBounds?.rawMax.toFixed(2) }}</text>
            <text x="46" y="252">{{ chartBounds?.rawMin.toFixed(2) }}</text>
          </svg>
          <div v-if="selectedPoint" class="passport-chart-detail" role="status">
            <strong>{{ formatDay(selectedPoint.day) }} · {{ selectedPoint.value.toFixed(2) }}</strong>
            <span>{{ focusLabel(selectedPoint.focus) }}</span>
          </div>
        </div>

        <details v-if="hasSegmentBreak" class="passport-segment-note">
          <summary>{{ t(primaryChangeText === t("passport.segmentUpdated") ? "passport.learnMore" : "passport.segmentUpdated") }}</summary>
          <p>{{ t("passport.segmentExplanation") }}</p>
        </details>
      </section>

      <section v-if="passport.focusTimeline.length" class="passport-section passport-focus-history" aria-labelledby="passport-focus-title">
        <h2 id="passport-focus-title">{{ t("passport.focusTitle") }}</h2>
        <ol>
          <li v-for="run in passport.focusTimeline" :key="run.id" :class="{ 'is-current': run.current }">
            <span aria-hidden="true"></span>
            <div><strong>{{ focusLabel(run.focus) }}</strong><small>{{ formatDay(run.startedAt) }}<template v-if="run.endedAt !== run.startedAt"> — {{ formatDay(run.endedAt) }}</template><template v-if="run.current"> · {{ t("passport.current") }}</template></small></div>
          </li>
        </ol>
      </section>

      <section class="passport-section passport-milestones" aria-labelledby="passport-milestones-title">
        <div class="passport-section__head"><h2 id="passport-milestones-title">{{ t("passport.milestonesTitle") }}</h2><span v-if="passport.milestones.length">{{ t("passport.latestMilestones", { count: passport.milestones.length }) }}</span></div>
        <div v-if="passport.milestones.length" class="passport-milestone-list">
          <article v-for="milestone in passport.milestones" :key="milestone.id" class="passport-milestone">
            <time>{{ milestoneDate(milestone) }}</time>
            <div>
              <NuxtLink v-if="milestone.songId" :to="localePath({ path: `/songs/${milestone.songId}`, query: milestone.difficultyType ? { difficulty: String(milestone.difficultyType) } : undefined })"><strong>{{ milestone.title }}</strong></NuxtLink>
              <strong v-else>{{ milestone.title }}</strong>
              <span v-if="milestone.difficultyType">{{ t(difficultyLabelKey(milestone.difficultyType)) }}</span>
              <p>{{ milestoneChange(milestone) }}</p>
              <small v-if="milestone.goalCompleted">{{ t(milestone.observationOnly ? "passport.goalObserved" : "passport.goalCompleted") }}</small>
            </div>
          </article>
        </div>
        <p v-else class="passport-empty">{{ t("passport.noMilestones") }}</p>
        <details class="passport-segment-note passport-milestone-coverage"><summary>{{ t('passport.recordsRange') }}</summary><p>{{ t('passport.recent90') }} · {{ coverageText }}</p></details>
      </section>

      <section v-if="passport.activeGoal || passport.recentCompletedGoal || passport.currentNextAction" class="passport-section passport-next" aria-labelledby="passport-next-title">
        <h2 id="passport-next-title">{{ t("passport.nextTitle") }}</h2>
        <div v-if="passport.activeGoal" class="passport-goal">
          <span>{{ t("passport.activeGoalTitle") }}</span><strong>{{ passport.activeGoal.title }}</strong><small>{{ t(`home.goal.types.${passport.activeGoal.goalType}`) }}</small>
        </div>
        <div v-else-if="passport.recentCompletedGoal" class="passport-goal">
          <span>{{ t("passport.completedGoalTitle") }}</span><strong>{{ passport.recentCompletedGoal.title }}</strong><small>{{ t(`home.goal.completedTypes.${passport.recentCompletedGoal.goalType}`) }}</small>
        </div>
        <p v-if="passport.currentNextAction" class="passport-next__focus">{{ t(passportCopy.invitation.key) }}</p>
        <div v-if="passport.currentNextAction?.todayPlan.items.length" class="passport-next__songs">
          <NuxtLink v-for="item in passport.currentNextAction.todayPlan.items" :key="`${item.songId}-${item.difficultyType}`" :to="localePath({ path: `/songs/${item.songId}`, query: { difficulty: String(item.difficultyType) } })">
            <SongCoverImage :song-id="item.songId" :alt="item.title" sizes="46px" />
            <span><strong>{{ item.title }}</strong><small>{{ t(difficultyLabelKey(item.difficultyType)) }}</small></span><i aria-hidden="true">↗</i>
          </NuxtLink>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.passport-page { width: min(100%, 1040px); margin: 0 auto; display: grid; gap: clamp(30px, 5vw, 54px); padding-bottom: 52px; }
.passport-hero { position: relative; overflow: hidden; display: grid; gap: 20px; padding: clamp(24px, 5vw, 54px); border-radius: 28px; }
.passport-hero::after { content: ""; position: absolute; right: -90px; top: -100px; width: 270px; height: 270px; border: 1px solid rgba(184,77,55,.19); border-radius: 50%; box-shadow: 0 0 0 28px rgba(184,77,55,.04), 0 0 0 64px rgba(184,77,55,.025); pointer-events: none; }
.passport-hero__topline, .passport-section__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
.passport-kicker { margin: 0 0 7px; color: var(--viewer-accent-strong); font-size: 11px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
.passport-hero h1, .passport-section h2 { margin: 0; color: var(--viewer-text); font-family: var(--viewer-display-font); }
.passport-hero h1 { font-size: clamp(31px, 5vw, 52px); line-height: 1.04; letter-spacing: -.035em; }
.passport-weekly-link { position: relative; z-index: 1; color: var(--viewer-accent-strong); font-size: 13px; font-weight: 800; text-decoration: none; }
.passport-weekly-link:hover, .passport-weekly-link:focus-visible { text-decoration: underline; text-underline-offset: 4px; }
.passport-recorded { margin: 0; color: var(--viewer-text-muted); font-size: 13px; }
.passport-now { display: flex; align-items: flex-end; gap: clamp(20px, 5vw, 52px); }
.passport-rating { display: grid; gap: 3px; }
.passport-rating span { color: var(--viewer-text-muted); font-size: 12px; font-weight: 700; }
.passport-rating strong { color: var(--viewer-text); font: 800 clamp(38px, 6vw, 64px)/.95 var(--viewer-display-font); font-variant-numeric: tabular-nums; }
.passport-focus { max-width: 28ch; margin: 0 0 4px; color: var(--viewer-accent-strong); font: 800 clamp(18px, 2.4vw, 26px)/1.35 var(--viewer-display-font); }
.passport-limited { margin: 0; color: var(--viewer-text-muted); line-height: 1.6; }
.passport-skills { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 28px; padding-top: 20px; border-top: 1px solid var(--viewer-border); }
.passport-skill { display: grid; grid-template-columns: minmax(72px, auto) minmax(50px, 1fr) 44px; align-items: center; gap: 10px; min-width: 0; }
.passport-skill span { overflow: hidden; color: var(--viewer-text-muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.passport-skill i { height: 2px; overflow: hidden; border-radius: 99px; background: rgba(151,105,73,.14); }
.passport-skill b { display: block; height: 100%; border-radius: inherit; background: var(--viewer-accent-strong); }
.passport-skill strong { color: var(--viewer-text); font-size: 13px; font-variant-numeric: tabular-nums; text-align: right; }
.passport-section { min-width: 0; padding: 0 clamp(3px, 3vw, 28px); }
.passport-section h2 { font-size: clamp(22px, 3vw, 30px); line-height: 1.2; }
.passport-section__head > span { color: var(--viewer-text-muted); font-size: 12px; }
.passport-range, .passport-dimensions { display: flex; flex-wrap: wrap; gap: 7px; }
.passport-controls { display: grid; gap: 8px; margin: 18px 0 14px; }
.passport-range button, .passport-dimensions button { min-height: 44px; padding: 0 11px; border: 0; border-bottom: 2px solid transparent; border-radius: 6px 6px 0 0; color: var(--viewer-text-muted); background: transparent; cursor: pointer; font: inherit; font-size: 12px; }
.passport-range button[aria-pressed="true"], .passport-dimensions button[aria-pressed="true"] { border-bottom-color: var(--viewer-accent-strong); color: var(--viewer-accent-strong); font-weight: 700; background: rgba(184,77,55,.04); }
.passport-range button:focus-visible, .passport-dimensions button:focus-visible, .passport-chart circle:focus-visible { outline: 3px solid var(--viewer-accent-strong); outline-offset: 3px; }
.passport-dimensions { gap: 3px; }
.passport-dimensions button { padding-inline: 9px; }
.passport-focus-note, .passport-updating { margin: 8px 0 0; color: var(--viewer-text-muted); font-size: 14px; line-height: 1.6; }
.passport-updating { min-height: 24px; }
.passport-refresh-error { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; color: var(--viewer-text-muted); }
.passport-refresh-error button { min-height: 44px; padding: 0 12px; background: transparent; border: 1px solid var(--viewer-border); border-radius: 8px; color: var(--viewer-accent-strong); cursor: pointer; }
.passport-refresh-error button:focus-visible, .passport-segment-note summary:focus-visible { outline: 3px solid var(--viewer-accent-strong); outline-offset: 3px; }
.passport-chart-wrap { position: relative; overflow: hidden; border-block: 1px solid var(--viewer-border); }
.passport-chart-summary { margin: 16px 0 0; color: var(--viewer-text-muted); font-size: 13px; line-height: 1.55; }
.passport-chart { display: block; width: 100%; min-height: 230px; overflow: visible; }
.passport-chart__axis { stroke: rgba(151,105,73,.28); }
.passport-chart__guide { stroke: rgba(151,105,73,.1); stroke-dasharray: 4 7; }
.passport-chart__segment path { fill: none; stroke: var(--viewer-accent-strong); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.passport-chart__segment--1 path { stroke-dasharray: 9 6; }
.passport-chart__segment--2 path { stroke-dasharray: 2 6; }
.passport-chart circle { fill: var(--viewer-surface); stroke: var(--viewer-accent-strong); stroke-width: 3; cursor: pointer; }
.passport-chart text { fill: var(--viewer-text-muted); font-size: 11px; }
.passport-chart-detail { position: absolute; right: 12px; top: 48px; display: grid; gap: 2px; padding: 9px 12px; border: 1px solid var(--viewer-border); border-radius: 12px; color: var(--viewer-text); background: var(--viewer-surface); box-shadow: 0 8px 24px rgba(69,44,30,.08); font-size: 12px; pointer-events: none; }
.passport-chart-detail span { color: var(--viewer-text-muted); }
.passport-change { margin: 18px 0 0; color: var(--viewer-text); font: 700 17px/1.55 var(--viewer-display-font); }
.passport-segment-note { margin-top: 14px; color: var(--viewer-text-muted); font-size: 12px; }
.passport-segment-note summary { min-height: 44px; display: flex; align-items: center; color: var(--viewer-accent-strong); cursor: pointer; font-weight: 800; }
.passport-segment-note p { margin: 0; line-height: 1.6; }
.passport-focus-history, .passport-milestones, .passport-next { padding-top: 28px; border-top: 1px solid var(--viewer-border); }
.passport-focus-history ol { display: flex; overflow-x: auto; gap: 0; margin: 22px 0 0; padding: 0 0 8px; list-style: none; scrollbar-width: thin; }
.passport-focus-history li { position: relative; flex: 1 0 150px; display: grid; grid-template-columns: 22px 1fr; gap: 8px; }
.passport-focus-history li::before { content: ""; position: absolute; top: 10px; left: 11px; right: -11px; height: 1px; background: var(--viewer-border); }
.passport-focus-history li:last-child::before { right: 100%; }
.passport-focus-history li > span { z-index: 1; width: 20px; height: 20px; box-sizing: border-box; border: 5px solid var(--viewer-surface); border-radius: 50%; background: var(--viewer-text-muted); box-shadow: 0 0 0 1px var(--viewer-border); }
.passport-focus-history li.is-current > span { background: var(--viewer-accent-strong); }
.passport-focus-history li div { display: grid; gap: 4px; }
.passport-focus-history strong { color: var(--viewer-text); font-size: 13px; }
.passport-focus-history small { color: var(--viewer-text-muted); font-size: 11px; }
.passport-milestone-list { position: relative; display: grid; margin-top: 20px; }
.passport-milestone-list::before { content: ""; position: absolute; top: 16px; bottom: 16px; left: 92px; width: 1px; background: var(--viewer-border); }
.passport-milestone { position: relative; display: grid; grid-template-columns: 78px minmax(0, 1fr); gap: 30px; min-height: 86px; padding: 13px 0; }
.passport-milestone::before { content: ""; position: absolute; left: 87px; top: 20px; width: 11px; height: 11px; border: 3px solid var(--viewer-surface); border-radius: 50%; background: var(--viewer-accent-strong); box-shadow: 0 0 0 1px var(--viewer-border); }
.passport-milestone time { color: var(--viewer-text-muted); font-size: 11px; text-align: right; }
.passport-milestone > div { min-width: 0; display: grid; gap: 3px; }
.passport-milestone a { min-width: 0; overflow: hidden; color: var(--viewer-text); text-decoration: none; text-overflow: ellipsis; white-space: nowrap; }
.passport-milestone a:hover, .passport-milestone a:focus-visible { color: var(--viewer-accent-strong); }
.passport-milestone span, .passport-milestone small { color: var(--viewer-text-muted); font-size: 12px; }
.passport-milestone p { margin: 3px 0 0; color: var(--viewer-text); font-weight: 700; }
.passport-milestone small { color: var(--viewer-accent-strong); }
.passport-coverage { margin: 18px 0 0; color: var(--viewer-text-muted); font-size: 12px; }
.passport-empty { display: grid; gap: 6px; margin: 20px 0; color: var(--viewer-text-muted); line-height: 1.6; }
.passport-empty strong { color: var(--viewer-text); font-size: 18px; }
.passport-goal { display: grid; gap: 5px; margin-top: 18px; padding-left: 16px; border-left: 3px solid var(--viewer-accent-strong); }
.passport-goal span, .passport-goal small { color: var(--viewer-text-muted); font-size: 12px; }
.passport-goal strong { color: var(--viewer-text); font-size: 17px; }
.passport-next__focus { margin: 20px 0 10px; color: var(--viewer-text); font: 700 18px/1.5 var(--viewer-display-font); }
.passport-next__songs { display: grid; gap: 7px; }
.passport-next__songs a { display: grid; grid-template-columns: 46px minmax(0, 1fr) auto; align-items: center; gap: 11px; min-height: 62px; padding: 8px; border-radius: 13px; color: var(--viewer-text); text-decoration: none; }
.passport-next__songs a:hover, .passport-next__songs a:focus-visible { background: rgba(196,164,132,.12); }
.passport-next__songs :deep(img) { width: 46px; height: 46px; border-radius: 9px; }
.passport-next__songs span { min-width: 0; display: grid; gap: 2px; }
.passport-next__songs strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.passport-next__songs small { color: var(--viewer-text-muted); }
.passport-next__songs i { color: var(--viewer-accent-strong); font-style: normal; }
.passport-state { display: grid; justify-items: start; gap: 16px; padding: 28px; }
.passport-state h1 { margin: 0; color: var(--viewer-text); font-size: 25px; }
.passport-button { min-height: 44px; display: inline-flex; align-items: center; padding: 0 17px; border: 0; border-radius: 12px; color: #fff; background: var(--viewer-accent-strong); cursor: pointer; text-decoration: none; font: inherit; font-weight: 800; }
.passport-loading { display: grid; gap: 18px; padding: 28px; }
.passport-loading__line { display: block; height: 118px; border-radius: 20px; }
:global(body.theme-dark .passport-hero h1), :global(body.theme-dark .passport-section h2), :global(body.theme-dark .passport-rating strong), :global(body.theme-dark .passport-skill strong), :global(body.theme-dark .passport-change), :global(body.theme-dark .passport-focus-history strong), :global(body.theme-dark .passport-milestone a), :global(body.theme-dark .passport-milestone p), :global(body.theme-dark .passport-goal strong), :global(body.theme-dark .passport-next__focus), :global(body.theme-dark .passport-next__songs a), :global(body.theme-dark .passport-state h1), :global(body.theme-dark .passport-empty strong) { color: #f2e7dc; }
:global(body.theme-dark .passport-recorded), :global(body.theme-dark .passport-rating span), :global(body.theme-dark .passport-skill span), :global(body.theme-dark .passport-chart-summary), :global(body.theme-dark .passport-chart text), :global(body.theme-dark .passport-section__head > span), :global(body.theme-dark .passport-focus-history small), :global(body.theme-dark .passport-milestone time), :global(body.theme-dark .passport-milestone span), :global(body.theme-dark .passport-coverage), :global(body.theme-dark .passport-empty), :global(body.theme-dark .passport-limited), :global(body.theme-dark .passport-next__songs small) { color: #bfaea0; }
:global(body.theme-dark .passport-chart-detail), :global(body.theme-dark .passport-focus-history li > span), :global(body.theme-dark .passport-milestone::before) { background: #241d19; }
:global(body.theme-dark .passport-kicker), :global(body.theme-dark .passport-focus), :global(body.theme-dark .passport-weekly-link), :global(body.theme-dark .passport-milestone small), :global(body.theme-dark .passport-next__songs i) { color: #e5a184; }
:global(body.theme-dark .passport-chart__segment path) { stroke: #e5a184; }
:global(body.theme-dark .passport-chart circle) { fill: #241d19; stroke: #e5a184; }
@media (max-width: 680px) {
  .passport-page { gap: 32px; padding-bottom: 104px; }
  .passport-hero { padding: 24px 20px 30px; border-radius: 21px; }
  .passport-hero__topline, .passport-section__head { align-items: flex-start; flex-direction: column; }
  .passport-now { align-items: flex-start; flex-direction: column; gap: 14px; }
  .passport-skills { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; }
  .passport-skill { grid-template-columns: minmax(0, 1fr) auto; gap: 4px; }
  .passport-skill i { grid-column: 1 / -1; grid-row: 2; }
  .passport-section { padding-inline: 2px; }
  .passport-range { width: 100%; }
  .passport-range button { flex: 1; padding-inline: 8px; }
  .passport-dimensions { padding-bottom: 7px; }
  .passport-chart { min-height: 210px; }
  .passport-chart-detail { top: 54px; }
  .passport-milestone-list::before { left: 70px; }
  .passport-milestone { grid-template-columns: 57px minmax(0, 1fr); gap: 26px; }
  .passport-milestone::before { left: 65px; }
}
@media (prefers-reduced-motion: reduce) { .passport-range button, .passport-dimensions button { scroll-behavior: auto; } }
</style>
