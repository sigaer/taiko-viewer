<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import AnnualScene from "./AnnualScene.vue";
import { narrativeKey, selectNarrative, weekdayHeadlineIndex } from "~/utils/annualNarrative";
import { useAnnualTimeline } from "~/composables/useAnnualTimeline";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  pageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
}>();

type WeekdayRow = { label: string; icon: string; mood: string; count: number; iconCount: number; top: string };
const rootRef = ref<InstanceType<typeof AnnualScene> | null>(null);
const saveData = ref(process.client && Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData));
const motionReduced = computed(() => props.reducedMotion || saveData.value);
useAnnualTimeline(rootRef, toRef(props, "active"), motionReduced, { reenter: "restart" });

const finiteCount = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

const { t } = useI18n();
const weekdayMeta = [
  { icon: "/weekday/002_key.png", top: "18%" },
  { icon: "/weekday/036_key.png", top: "25.7%" },
  { icon: "/weekday/038_key.png", top: "33.4%" },
  { icon: "/weekday/006_key.png", top: "41.1%" },
  { icon: "/weekday/010_key.png", top: "48.8%" },
  { icon: "/weekday/023_key.png", top: "56.5%" },
  { icon: "/weekday/034_key.png", top: "64.2%" }
] as const;
const weekdayMoods = computed(() => weekdayMeta.map((_, index) => t(`annualSummary.slides.weekday.moods.${index}`)));
// The shape of the week (one dominant day, a weekend-heavy week, a working-day week,
// or an even spread) picks the headline; the concrete weekday stays an interpolation.
const narrative = computed(() => selectNarrative("weekday", props.summary));
const narrativeCopy = computed(() => ({
  titleBefore: t(narrativeKey("weekday", narrative.value, "titleBefore")),
  titleAfter: t(narrativeKey("weekday", narrative.value, "titleAfter"))
}));
const activity = computed(() => props.summary.weekdayActivity);
const counts = computed(() => weekdayMeta.map((_, index) => finiteCount(activity.value?.counts?.[index])));
const maxCount = computed(() => Math.max(...counts.value, 1));
const rows = computed<WeekdayRow[]>(() => weekdayMeta.map((meta, index) => {
  const count = counts.value[index];
  const iconCount = count > 0 ? Math.min(6, Math.max(1, Math.round(count / maxCount.value * 6))) : 0;
  return { ...meta, label: labels.value[index], mood: weekdayMoods.value[index], count, iconCount };
}));
const labels = computed(() => activity.value?.labels || weekdayMeta.map((_, index) => t(`annualSummary.slides.weekday.days.${index}`)));
const safeLabel = (value: unknown, fallback: string) => {
  const text = String(value ?? "").trim();
  return text && text !== "undefined" && text !== "null" ? text : fallback;
};
// P2.1: workday 文案断言「工作日」，因此该 archetype 下必须显示周一~周五中最忙的一天。
const headlineDayIndex = computed(() =>
  weekdayHeadlineIndex(narrative.value.archetype, counts.value, activity.value?.topWeekday ?? 0)
);
const topLabel = computed(() => {
  const index = headlineDayIndex.value;
  const provided = activity.value?.topWeekday === index ? activity.value?.topLabel : "";
  return safeLabel(provided, labels.value[index] || "—");
});
const bottomLabel = computed(() => safeLabel(activity.value?.bottomLabel, labels.value[activity.value?.bottomWeekday ?? -1] || "—"));
const workdayTraits = computed(() => rows.value.slice(0, 5).filter((row) => row.count > 0).sort((a, b) => b.count - a.count).slice(0, 3).map((row) => row.mood));
const weekendTraits = computed(() => rows.value.slice(5).filter((row) => row.count > 0).map((row) => row.mood));
const workdayText = computed(() => workdayTraits.value.length ? workdayTraits.value : [t("annualSummary.slides.weekday.idleWorkday")]);
const weekendText = computed(() => weekendTraits.value.length ? weekendTraits.value : [t("annualSummary.slides.weekday.idleWeekend")]);
</script>

<template>
  <AnnualScene ref="rootRef" class="annual-weekday-forest-scene" :active="active" :reduced-motion="motionReduced" mood="weekday-forest" intensity="low" data-visual-style="forest-watercolor-weekday-tracks">
    <template #background><div class="annual-weekday-forest-scene__backdrop" aria-hidden="true"></div></template>
    <div class="annual-weekday-forest-scene__content">
      <header class="annual-weekday-forest-scene__header" data-annual-stage="title">
        <h2>{{ narrativeCopy.titleBefore }}<strong>{{ topLabel }}</strong>{{ narrativeCopy.titleAfter }}</h2>
        <h3><strong>{{ bottomLabel }}</strong>{{ t("annualSummary.slides.weekday.leastSuffix") }}</h3>
      </header>
      <div class="annual-weekday-forest-scene__tracks" :aria-label="t('annualSummary.slides.weekday.tracksLabel')">
        <div v-for="(row, rowIndex) in rows" :key="row.label" class="annual-weekday-forest-scene__row" data-annual-stage="visual" :style="{ top: row.top, '--row-index': rowIndex }" :aria-label="`${row.label}，${row.mood}`">
          <div class="annual-weekday-forest-scene__icons" aria-hidden="true">
            <img v-for="index in row.iconCount" :key="`${row.label}-${index}`" class="annual-weekday-forest-scene__icon" :style="{ '--icon-index': index - 1 }" :src="row.icon" alt="">
          </div>
          <span class="annual-weekday-forest-scene__mood" data-annual-stage="data">{{ row.mood }}</span>
        </div>
      </div>
      <footer class="annual-weekday-forest-scene__summary" data-annual-stage="copy">
        <p>{{ t("annualSummary.slides.weekday.workdaySummary") }}<span v-for="trait in workdayText" :key="trait"><strong>{{ trait }}</strong></span></p>
        <p>{{ t("annualSummary.slides.weekday.weekendSummary") }}<span v-for="trait in weekendText" :key="trait"><strong>{{ trait }}</strong></span></p>
      </footer>
    </div>
  </AnnualScene>
</template>

<style scoped>
.annual-weekday-forest-scene{--forest-ink:#294d3a;--forest-deep:#183c2d;--forest-accent:#4f8060;position:relative;width:100%;height:100vh;height:100svh;height:var(--annual-stage-height,100dvh);overflow:hidden;color:var(--forest-ink);background:#e8ead8}
.annual-weekday-forest-scene__backdrop,.annual-weekday-forest-scene__content{position:absolute;top:0;left:50%;width:max(100%,calc(var(--annual-stage-height,100dvh) * 853 / 1844));height:100%;transform:translateX(-50%)}
.annual-weekday-forest-scene__backdrop{background:url("/weekday/backgorund_12.png") center top/100% 100% no-repeat}
.annual-weekday-forest-scene__content{z-index:1;padding:max(28px,calc(env(safe-area-inset-top) + 18px)) clamp(14px,5vw,28px) max(26px,calc(env(safe-area-inset-bottom) + 22px))}
.annual-weekday-forest-scene__header{position:absolute;top:max(52px,calc(env(safe-area-inset-top) + 42px));left:14%;right:10%;text-align:center;color:var(--forest-deep)}
.annual-weekday-forest-scene__header h2,.annual-weekday-forest-scene__header h3{margin:0;font-family:var(--viewer-display-font);font-weight:700;letter-spacing:.01em;text-wrap:balance}
.annual-weekday-forest-scene__header h2{font-size:clamp(18px,5.3vw,28px);line-height:1.25}.annual-weekday-forest-scene__header h3{margin-top:3px;font-size:clamp(13px,3.7vw,19px);line-height:1.35;font-weight:550}.annual-weekday-forest-scene strong{color:var(--forest-accent)}
.annual-weekday-forest-scene__tracks{position:absolute;inset:0;pointer-events:none}.annual-weekday-forest-scene__row{position:absolute;left:14%;right:5%;display:flex;align-items:center;justify-content:space-between;min-width:0;transform:translateY(-50%)}
.annual-weekday-forest-scene__icons{display:flex;align-items:center;gap:clamp(2px,1vw,6px);width:calc(100% - 69px);min-width:0;overflow:hidden}.annual-weekday-forest-scene__icon{flex:0 0 auto;width:clamp(23px,7.2vw,34px);height:auto;aspect-ratio:1;object-fit:contain;opacity:0;transform:translate3d(-8px,0,0) scale(.82);animation:weekday-icon-in .46s cubic-bezier(.22,.8,.28,1) forwards;animation-delay:calc(.72s + var(--row-index,0) * 70ms + var(--icon-index,0) * 55ms)}
.annual-weekday-forest-scene__mood{flex:0 0 67px;max-width:67px;padding:6px 2px;overflow-wrap:anywhere;color:var(--forest-accent)!important;font-size:clamp(13px,3.6vw,16px);line-height:1.15;text-align:center;text-shadow:0 1px 0 rgba(255,252,236,.8)}
.annual-weekday-forest-scene__summary{position:absolute;top:73%;left:10%;right:10%;display:grid;gap:7px;padding:5px 8px;color:var(--forest-ink);font-size:clamp(12px,3.5vw,16px);line-height:1.45;text-align:center}.annual-weekday-forest-scene__summary p{margin:0;color:var(--forest-ink)!important}.annual-weekday-forest-scene__summary span+span::before{content:" + ";color:var(--forest-ink)}
.annual-weekday-forest-scene.is-reduced .annual-weekday-forest-scene__icon,.annual-weekday-forest-scene:not(.is-active) .annual-weekday-forest-scene__icon{animation:none;opacity:1;transform:none}
@keyframes weekday-icon-in{from{opacity:0;transform:translate3d(-8px,0,0) scale(.82)}to{opacity:1;transform:translate3d(0,0,0) scale(1)}}
@media(max-height:700px){.annual-weekday-forest-scene__header{top:max(42px,calc(env(safe-area-inset-top) + 32px))}}
@media(max-width:370px){.annual-weekday-forest-scene__row{left:13%;right:4%}.annual-weekday-forest-scene__icons{width:calc(100% - 62px);gap:2px}.annual-weekday-forest-scene__mood{flex-basis:60px;max-width:60px;font-size:12px}.annual-weekday-forest-scene__summary{left:8%;right:8%;font-size:11px}}
@media(orientation:landscape) and (min-width:721px){.annual-weekday-forest-scene__backdrop,.annual-weekday-forest-scene__content{height:100%}}
@media(prefers-reduced-motion:reduce){.annual-weekday-forest-scene__icon{animation:none;opacity:1;transform:none}}
</style>
