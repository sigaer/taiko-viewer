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
const fetchPassport = async () => {
  if (!accountUser.value) return { payload: null, error: "" };
  const context = identity.value, request = guard.capture();
  try {
    const range = requestedRange.value;
    const userId = accountUser.value.id, generation = bindingGeneration.value;
    const payload = await apiFetch<SkillPassportResponse>("/api/account/growth/passport", { query: { range, dimension: requestedDimension.value }, retry: 0 });
    if (!guard.current(request) || context !== identity.value || accountUser.value?.id !== userId || bindingGeneration.value !== generation) return { payload: null, error: "" };
    if (payload.range.requestedDays !== range) throw new Error("passport-range-mismatch");
    return {
      payload,
      error: "", context
    };
  } catch (error) {
    const message = await resolveViewerError(error, t("passport.loadFailed"), t);
    return guard.current(request) && context === identity.value ? { payload: null, error: message, context } : { payload: null, error: "" };
  }
};

const { data: passportState, pending, refresh, clear } = await useAsyncData(passportKey, fetchPassport, {
  default: () => ({ payload: null, error: "" }),
  dedupe: "cancel"
});
onUnmounted(clear);
const refreshCurrentData = useAccountDataRefresh(identity, () => { guard.invalidate(); clear(); }, refresh);
if (accountUser.value && passportState.value?.context !== identity.value) refreshCurrentData();
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
const milestoneDate = (milestone: SkillPassportMilestone) => milestone.day ? formatDay(milestone.day) : milestone.observedAt ? formatCaptured(milestone.observedAt) : t("passport.unknownDate");
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
      <p v-if="pageError">{{ pageError }}</p>
      <NuxtLink :to="localePath('/account/profile')">{{ t("growthProfileEntry") }}</NuxtLink>
      <button class="passport-button" type="button" @click="retry">{{ t("passport.retry") }}</button>
    </section>

    <template v-else>
      <header class="passport-hero">
        <div class="passport-hero__topline">
          <div>
            <h1>{{ t("passport.currentTitle") }}</h1>
          </div>
          <NuxtLink :to="localePath('/my/weekly')" class="passport-weekly-link">{{ t("passport.weeklyEntry") }} <span aria-hidden="true">→</span></NuxtLink>
        </div>
        <p v-if="passport.coverage.measurementFrom" class="passport-recorded">{{ t("passport.recordedSince", { date: formatCaptured(passport.coverage.measurementFrom) }) }}</p>
        <div v-if="passport.current" class="passport-now">
          <div class="passport-rating"><span>Rating</span><strong>{{ passport.current.rating === null ? t("passport.noValue") : passport.current.rating.toFixed(2) }}</strong></div>
          <p class="passport-focus">{{ t(passportCopy.observation.key) }}</p>
        </div>
        <p v-if="!passport.current" class="passport-limited">{{ t("passport.noCurrent") }}</p>
        <div class="passport-skills" :aria-label="t('passport.skillOverview')">
          <div v-for="skill in currentSkills" :key="skill.key" class="passport-skill">
            <span>{{ dimensionLabel(skill.key) }}</span>
            <i v-if="skill.value !== null" aria-hidden="true"><b :style="{ width: `${Math.max(4, skill.value / skillMax * 100)}%` }"></b></i>
            <strong :aria-label="skill.value === null ? t('passport.noValue') : undefined">{{ skill.value === null ? t("passport.noValue") : skill.value.toFixed(2) }}</strong>
          </div>
        </div>
      </header>

      <section class="passport-section passport-trend" aria-labelledby="passport-trend-title" :aria-busy="pending || undefined">
        <div class="passport-section__head">
          <h2 id="passport-trend-title">{{ t("passport.trend.title") }}</h2>
        </div>
        <div class="passport-controls">
          <div class="passport-range" role="group" :aria-label="t('passport.rangeLabel')">
            <button v-for="choice in rangeChoices" :key="choice.days" type="button" :data-range="choice.days" :aria-pressed="activeRange === choice.days" @click="changeRange(choice.days)">{{ t("passport.rangeDays", { days: choice.days }) }}</button>
          </div>
        </div>
        <p v-if="pending" class="passport-updating" role="status">{{ t('passport.updating') }}</p>
        <div v-else-if="pageError" class="passport-refresh-error" role="alert"><span>{{ pageError }}</span><button type="button" @click="retry">{{ t('passport.retry') }}</button></div>

        <p class="passport-coverage">{{ t("passport.rangeActual", { range: requestedRange, days: passport.range.measurementDays ?? passport.segments.reduce((sum, segment) => sum + segment.points.length, 0) }) }}</p>
        <div class="passport-metrics">
          <section aria-labelledby="passport-rating-trend">
            <h3 id="passport-rating-trend">{{ t('passport.ratingTrend') }}</h3>
            <PassportMetricChart :segments="passport.segments" dimension="rating" label="Rating" :from="passport.range.from || passport.coverage.recentFactsFrom" :to="passport.range.to || passport.coverage.recentFactsTo" />
          </section>
          <section aria-labelledby="passport-skills-trend">
            <h3 id="passport-skills-trend">{{ t('passport.skillTrend') }}</h3>
            <div class="passport-dimensions" role="group" :aria-label="t('passport.dimensionLabel')">
              <button v-for="dimension in GROWTH_DIMENSION_ORDER" :key="dimension" type="button" :aria-pressed="selectedDimension === dimension" @click="chooseDimension(dimension)">{{ dimensionLabel(dimension) }}</button>
            </div>
            <PassportMetricChart :segments="passport.segments" :dimension="selectedDimension" :label="trendLabel(selectedDimension)" :from="passport.range.from || passport.coverage.recentFactsFrom" :to="passport.range.to || passport.coverage.recentFactsTo" />
          </section>
        </div>
      </section>

      <section class="passport-section passport-milestones" aria-labelledby="passport-milestones-title">
        <div class="passport-section__head"><h2 id="passport-milestones-title">{{ t("passport.milestonesTitle") }}</h2></div>
        <p class="passport-coverage">{{ t("passport.factDates", { from: formatDay(passport.coverage.recentFactsFrom), to: formatDay(passport.coverage.recentFactsTo) }) }}</p>
        <div v-if="passport.milestones.length" id="passport-milestone-list" class="passport-milestone-list">
          <article v-for="milestone in visibleMilestones" :key="milestone.id" class="passport-milestone">
            <time><span v-if="milestone.observationOnly">{{ t('passport.observedDay') }} · </span>{{ milestoneDate(milestone) }}</time>
            <div>
              <p class="passport-milestone-headline">{{ t(narrative(milestone).headline.key, narrative(milestone).headline.params) }}</p>
              <NuxtLink v-if="milestone.songId" :to="localePath({ path: `/songs/${milestone.songId}`, query: milestone.difficultyType ? { difficulty: String(milestone.difficultyType) } : undefined })"><strong>{{ milestone.title }}</strong></NuxtLink>
              <strong v-else>{{ milestone.title }}</strong>
              <span v-if="milestone.difficultyType">{{ t(difficultyLabelKey(milestone.difficultyType)) }}</span>
              <p v-if="narrative(milestone).support.length" class="passport-milestone-evidence">{{ narrative(milestone).support.map(evidenceText).join(' · ') }}</p>
              <details v-if="narrative(milestone).detail.length" class="passport-fact-details"><summary>{{ t('passport.moreEvidence') }}</summary><p v-for="(line, index) in narrative(milestone).detail" :key="index">{{ evidenceText(line) }}</p></details>
              <small v-if="milestone.goalCompleted && !milestone.observationOnly && milestone.primaryType !== 'goal-completed'">{{ t('passport.goalCompleted') }}</small>
            </div>
          </article>
        </div>
        <p v-else class="passport-empty">{{ t("passport.noMilestones") }}</p>
        <button v-if="moreMilestones" type="button" class="passport-more" :aria-expanded="expandedMilestones" aria-controls="passport-milestone-list" @click="expandedMilestones = !expandedMilestones">{{ t(expandedMilestones ? "passport.fewerMilestones" : "passport.moreMilestones") }}</button>
        <p v-if="passport.coverage.recentFactsState !== 'complete'" class="passport-coverage">{{ coverageText }}</p>
      </section>

      <section v-if="passport.focusTimeline.length" class="passport-section passport-focus-history" aria-labelledby="passport-focus-title">
        <h2 id="passport-focus-title">{{ t("passport.focusTitle") }}</h2>
        <details class="passport-fact-details"><summary>{{ t("passport.learnMore") }}</summary><p>{{ t("passport.focusMeaning") }}</p></details>
        <p v-if="focusChangeText" class="passport-focus-note">{{ focusChangeText }}</p>
        <ol>
          <li v-for="run in passport.focusTimeline" :key="run.id" :class="{ 'is-current': run.current }">
            <span aria-hidden="true"></span>
            <div><strong>{{ focusLabel(run.focus) }}</strong><small>{{ formatDay(run.startedAt) }}<template v-if="run.endedAt !== run.startedAt"> — {{ formatDay(run.endedAt) }}</template></small></div>
          </li>
        </ol>
      </section>

      <section v-if="passport.activeGoal || passport.recentCompletedGoal || passport.currentNextAction" class="passport-section passport-next" aria-labelledby="passport-next-title">
        <h2 id="passport-next-title">{{ t("passport.nextTitle") }}</h2>
        <div v-if="passport.activeGoal" class="passport-goal">
          <span>{{ t("passport.activeGoalTitle") }}</span><NuxtLink :to="localePath({ path: `/songs/${passport.activeGoal.songId}`, query: { difficulty: String(passport.activeGoal.difficultyType) } })"><strong>{{ passport.activeGoal.title }}</strong></NuxtLink><small>{{ t(`home.goal.types.${passport.activeGoal.goalType}`) }}</small>
        </div>
        <div v-if="passport.recentCompletedGoal" class="passport-goal">
          <span>{{ t("passport.completedGoalTitle") }}</span><NuxtLink :to="localePath({ path: `/songs/${passport.recentCompletedGoal.songId}`, query: { difficulty: String(passport.recentCompletedGoal.difficultyType) } })"><strong>{{ passport.recentCompletedGoal.title }}</strong></NuxtLink><small>{{ t(`home.goal.completedTypes.${passport.recentCompletedGoal.goalType}`) }}</small>
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
.passport-page { width:100%; display:grid; gap:32px; padding-bottom:32px; }
.passport-hero { display:grid; gap:14px; padding:20px; background:var(--viewer-surface); border-radius:14px; }
.passport-hero__topline,.passport-section__head { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.passport-hero h1,.passport-section h2 { margin:0; font-size:21px; line-height:1.4; color:var(--viewer-text); }
.passport-weekly-link,.passport-goal a { color:var(--viewer-accent-strong); text-decoration:none; }
.passport-weekly-link { min-height:44px; display:inline-flex; align-items:center; font-size:14px; }
.passport-recorded,.passport-coverage { margin:0; font-size:13px; line-height:1.6; color:var(--viewer-text-muted); }
.passport-now { display:flex; gap:24px; align-items:center; flex-wrap:wrap; }
.passport-rating { display:grid; gap:4px; }
.passport-rating span { color:var(--viewer-text-muted); font-size:13px; }
.passport-rating strong { font-size:36px; line-height:1.1; font-variant-numeric:tabular-nums; }
.passport-focus { flex:1; min-width:180px; margin:0; color:var(--viewer-text); line-height:1.6; }
.passport-skills { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px 24px; border-top:1px solid var(--viewer-border); padding-top:14px; }
.passport-skill { display:grid; grid-template-columns:1fr auto; gap:5px 8px; min-width:0; }
.passport-skill span { font-size:13px; color:var(--viewer-text-muted); }
.passport-skill strong { grid-column:2; grid-row:1; font-size:14px; font-variant-numeric:tabular-nums; }
.passport-skill i { grid-column:1/-1; height:3px; background:var(--viewer-surface-subtle); }
.passport-skill b { display:block; height:100%; background:var(--viewer-accent-strong); }
.passport-section { min-width:0; }
.passport-controls { margin:12px 0 8px; }
.passport-range,.passport-dimensions { display:flex; flex-wrap:wrap; gap:4px; }
.passport-range button,.passport-dimensions button { min-height:44px; padding:0 12px; border:0; border-bottom:2px solid transparent; border-radius:6px 6px 0 0; color:var(--viewer-text-muted); background:transparent; cursor:pointer; font:inherit; font-size:14px; }
.passport-range button[aria-pressed=true],.passport-dimensions button[aria-pressed=true] { color:var(--viewer-accent-strong); border-bottom-color:var(--viewer-accent-strong); background:var(--viewer-surface-subtle); font-weight:700; }
.passport-page button:focus-visible,.passport-page a:focus-visible,.passport-page summary:focus-visible { outline:2px solid var(--viewer-accent-strong); outline-offset:3px; }
.passport-metrics { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-top:18px; }
.passport-metrics section { min-width:0; }
.passport-metrics h3 { font-size:16px; margin:0 0 8px; }
.passport-milestones,.passport-focus-history,.passport-next { padding-top:24px; border-top:1px solid var(--viewer-border); }
.passport-milestones .passport-coverage { margin-top:10px; }
.passport-milestone-list { margin-top:12px; }
.passport-milestone { display:grid; grid-template-columns:90px minmax(0,1fr); gap:16px; padding:16px 0; border-bottom:1px solid var(--viewer-border); }
.passport-milestone:last-child { border-bottom:0; }
.passport-milestone time { font-size:12px; line-height:1.6; color:var(--viewer-text-muted); }
.passport-milestone > div { display:grid; gap:5px; min-width:0; }
.passport-milestone-headline { margin:0; font-size:17px; font-weight:700; }
.passport-milestone a { color:var(--viewer-accent-strong); text-decoration:none; overflow-wrap:anywhere; }
.passport-milestone a strong,.passport-milestone > div > strong { font-size:14px; font-weight:500; }
.passport-milestone span,.passport-milestone small,.passport-milestone-evidence { margin:0; font-size:13px; line-height:1.6; color:var(--viewer-text-muted); }
.passport-fact-details { color:var(--viewer-text-muted); font-size:13px; }
.passport-fact-details summary { min-height:44px; align-content:center; cursor:pointer; }
.passport-fact-details p { line-height:1.6; margin:0 0 8px; }
.passport-focus-note { font-size:14px; line-height:1.6; }
.passport-focus-history ol { display:flex; overflow-x:auto; gap:20px; margin:12px 0 0; padding:0 0 8px; list-style:none; }
.passport-focus-history li { flex:0 0 auto; border-left:2px solid var(--viewer-border); padding-left:12px; }
.passport-focus-history li.is-current { border-color:var(--viewer-accent-strong); }
.passport-focus-history li div { display:grid; gap:4px; }
.passport-focus-history strong { font-size:14px; }
.passport-focus-history small { font-size:12px; color:var(--viewer-text-muted); }
.passport-goal { display:grid; gap:5px; margin-top:16px; }
.passport-goal span,.passport-goal small { font-size:13px; color:var(--viewer-text-muted); }
.passport-next__focus { margin:16px 0 8px; font-size:16px; }
.passport-next__songs { display:grid; gap:8px; }
.passport-next__songs a { display:grid; grid-template-columns:46px minmax(0,1fr) auto; align-items:center; gap:12px; min-height:62px; padding:8px 0; color:var(--viewer-text); text-decoration:none; }
.passport-next__songs :deep(img) { width:46px; height:46px; border-radius:8px; }
.passport-next__songs span { display:grid; gap:4px; min-width:0; overflow-wrap:anywhere; }
.passport-next__songs small { color:var(--viewer-text-muted); }
.passport-next__songs i { color:var(--viewer-accent-strong); font-style:normal; }
.passport-more,.passport-refresh-error button { min-height:44px; padding:0 14px; border:1px solid var(--viewer-border); border-radius:8px; background:var(--viewer-surface); color:var(--viewer-accent-strong); cursor:pointer; font:inherit; }
.passport-refresh-error { display:flex; flex-wrap:wrap; align-items:center; gap:12px; color:var(--viewer-danger); }
.passport-state { display:grid; gap:16px; justify-items:start; padding:24px; }
.passport-state h1 { font-size:24px; margin:0; }
.passport-state p { margin:0; line-height:1.6; }
.passport-button { min-height:44px; display:inline-flex; align-items:center; padding:0 16px; border:0; border-radius:8px; background:var(--viewer-primary); color:var(--viewer-on-primary); cursor:pointer; text-decoration:none; font:inherit; }
.passport-loading { display:grid; gap:16px; }
.passport-loading__line { display:block; height:100px; border-radius:12px; }
.passport-empty,.passport-limited,.passport-updating { color:var(--viewer-text-muted); line-height:1.6; }
@media(max-width:760px) {
 .passport-hero { padding:16px; }
 .passport-skills { grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
 .passport-metrics { grid-template-columns:1fr; gap:24px; }
 .passport-metrics section+section { border-top:1px solid var(--viewer-border); padding-top:20px; }
 .passport-range button { flex:1; padding-inline:6px; }
 .passport-dimensions button { padding-inline:9px; }
 .passport-milestone { grid-template-columns:1fr; gap:6px; }
}
</style>
