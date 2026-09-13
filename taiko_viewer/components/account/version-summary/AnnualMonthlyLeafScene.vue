<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import AnnualArtworkFallback from "./AnnualArtworkFallback.vue";
import AnnualMonthlyLeafItem from "./AnnualMonthlyLeafItem.vue";
import AnnualScene from "./AnnualScene.vue";
import { useAnnualTimeline } from "~/composables/useAnnualTimeline";
import { monthlyLeafLayout } from "~/utils/annualMonthlyLeaf";
import { narrativeKey, selectNarrative } from "~/utils/annualNarrative";
import type { VersionSummaryMonthlyFavorite, VersionSummaryViewModel } from "~/types/account-version-summary";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  pageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
}>();

const rootRef = ref<InstanceType<typeof AnnualScene> | null>(null);
useAnnualTimeline(rootRef, toRef(props, "active"), toRef(props, "reducedMotion"), { reenter: "restart" });
const { t } = useI18n();
const saveData = ref(process.client && Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData));

const finite = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const monthNumber = (item: VersionSummaryMonthlyFavorite) => {
  const raw = String(item.month || "");
  const iso = raw.match(/(?:^|-)(0?[1-9]|1[0-2])(?:$|-)/);
  if (iso) return Number(iso[1]);
  const label = String(item.monthLabel || "").match(/(0?[1-9]|1[0-2])月/);
  return label ? Number(label[1]) : 99;
};

const compactMonthLabel = (item: VersionSummaryMonthlyFavorite) => {
  const supplied = String(item.monthLabel || "").trim();
  const month = supplied.match(/(0?[1-9]|1[0-2])月/);
  if (month) return `${Number(month[1])}月`;
  const parsed = monthNumber(item);
  return parsed >= 1 && parsed <= 12 ? `${parsed}月` : "月";
};

// The season spans a calendar-year boundary (2025-10 → 2026-09), so the vine has
// to follow the season, not the month number: ordering by 1..12 alone would put
// October–December of the opening year behind the following September.
const monthOrderKey = (item: VersionSummaryMonthlyFavorite) => {
  const iso = String(item.month || "").trim().match(/^(\d{4})-(0[1-9]|1[0-2])/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const parsed = monthNumber(item);
  return parsed >= 1 && parsed <= 12 ? `0000-${String(parsed).padStart(2, "0")}` : "9999-99";
};

const items = computed(() => props.summary.monthlyFavorites
  .filter((item) => item?.song && String(item.song.name || "").trim())
  .map((item) => ({ ...item, monthLabel: compactMonthLabel(item) }))
  .sort((a, b) => monthOrderKey(a).localeCompare(monthOrderKey(b))));

// 叶片长度与页脚“游玩最多的月份”必须来自同一个口径：优先月度游玩时长，
// 只有整页都拿不到时长时才退回游玩次数（逐月混用会让两个口径指向不同的月份）。
const usePlayTime = computed(() => items.value.length > 0 && items.value.every((item) => finite(item.estimatedSeconds) > 0));
const leafMetric = (item: VersionSummaryMonthlyFavorite) => usePlayTime.value ? finite(item.estimatedSeconds) : finite(item.playCount);
const topMonth = computed(() => {
  if (!items.value.length) return null;
  return items.value.reduce((best, item) => leafMetric(item) > leafMetric(best) ? item : best);
});

const itemDensity = computed(() => items.value.length > 9 ? "ultra-dense" : items.value.length > 6 ? "dense" : "standard");
const topMonthLabel = computed(() => topMonth.value?.monthLabel || "—");
const motionDisabled = computed(() => props.reducedMotion || saveData.value);

// 叶片几何：先取“最长歌名所需长度”作为共同起点，再按游玩量比例分配剩余长度，
// 游玩最多的月份额外拉长（见 utils/annualMonthlyLeaf.ts）。
const leafLayout = computed(() => monthlyLeafLayout(
  items.value.map((item) => ({ name: String(item.song.name || ""), metric: leafMetric(item) })),
  itemDensity.value !== "standard"
));
// How much of the year has a representative song types the page's narrative, which
// this page renders as its accessible footer pair (the visible wording is baked
// into the artwork, so no text node changes here).
const narrative = computed(() => selectNarrative("monthly", props.summary));
const narrativeCopy = computed(() => ({
  footer1: t(narrativeKey("monthly", narrative.value, "footer1")),
  footer2: t(narrativeKey("monthly", narrative.value, "footer2"))
}));
const isTopMonth = (item: VersionSummaryMonthlyFavorite) => Boolean(
  topMonth.value && topMonth.value.month === item.month && topMonth.value.song.songNo === item.song.songNo
);
</script>

<template>
  <AnnualScene
    ref="rootRef"
    class="annual-monthly-leaf-scene"
    :class="[`density-${itemDensity}`, { 'is-reduced': motionDisabled }]"
    :active="active"
    :reduced-motion="reducedMotion"
    mood="time-blue"
    intensity="low"
    data-visual-style="monthly-leaf-vine"
  >
    <template #background>
      <img class="annual-monthly-leaf-scene__backdrop" src="/monthly/background_11.png" alt="" aria-hidden="true" width="414" height="896">
    </template>

    <div class="annual-monthly-leaf-scene__inner">
      <header class="annual-monthly-leaf-scene__header" data-annual-stage="title">
        <img class="annual-monthly-leaf-scene__title" src="/monthly/title_11.png" alt="月度游玩时长" width="196" height="33">
        <div class="annual-monthly-leaf-scene__subtitle-row">
          <img src="/monthly/grass_left_11.png" alt="" aria-hidden="true" width="22" height="20">
          <img class="annual-monthly-leaf-scene__subtitle" src="/monthly/subtitle_11.png" :alt="t('annualSummary.slides.monthly.subtitleAlt')" width="113" height="13">
          <img src="/monthly/grass_right_11.png" alt="" aria-hidden="true" width="22" height="20">
        </div>
      </header>

      <main v-if="items.length" class="annual-monthly-leaf-scene__timeline" :style="{ '--monthly-count': items.length }" :aria-label="t('annualSummary.slides.monthly.timelineLabel', { count: items.length })">
        <AnnualMonthlyLeafItem
          v-for="(item, index) in items"
          :key="`${item.month}-${item.song.songNo}`"
          :item="item"
          :index="index"
          :compact="itemDensity !== 'standard'"
          :motion-disabled="motionDisabled"
          :leaf-width="leafLayout[index]?.width || 0"
          :leaf-font="leafLayout[index]?.fontPx || 12"
          :is-top="isTopMonth(item)"
        />
      </main>
      <div v-else class="annual-monthly-leaf-scene__empty" data-annual-stage="copy">
        <AnnualArtworkFallback :label="t('annualSummary.slides.monthly.emptyLabel')" />
      </div>

      <footer class="annual-monthly-leaf-scene__summary" data-annual-stage="copy">
        <p><img src="/monthly/text_1_11.png" :alt="narrativeCopy.footer1" width="187" height="22"><strong>{{ topMonthLabel }}</strong></p>
        <img src="/monthly/text_2_11.png" :alt="narrativeCopy.footer2" width="167" height="22">
      </footer>
    </div>
  </AnnualScene>
</template>

<style scoped>
.annual-monthly-leaf-scene{position:relative;width:100%;height:100%;min-height:100vh;min-height:100svh;min-height:100dvh;overflow:hidden;background:#e7f1e4;color:#1d612e}.annual-monthly-leaf-scene__backdrop{position:absolute;left:50%;top:0;width:min(414px,100%);height:100%;transform:translateX(-50%);object-fit:cover;object-position:center;pointer-events:none}.annual-monthly-leaf-scene__inner{position:relative;width:min(414px,100%);height:100%;min-height:100%;margin:0 auto;padding:clamp(10px,3.5vh,32px) max(10px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));box-sizing:border-box}.annual-monthly-leaf-scene__header{position:absolute;top:max(clamp(24px,5.6vh,54px),calc(env(safe-area-inset-top) + 12px));left:0;right:0;display:grid;justify-items:center;gap:clamp(8px,1.5vh,13px);z-index:5}.annual-monthly-leaf-scene__title{display:block;width:min(196px,52vw);height:auto}.annual-monthly-leaf-scene__subtitle-row{display:flex;align-items:center;justify-content:center;gap:clamp(8px,2.2vw,13px);height:22px}.annual-monthly-leaf-scene__subtitle-row>img:first-child,.annual-monthly-leaf-scene__subtitle-row>img:last-child{width:22px;height:20px;object-fit:contain}.annual-monthly-leaf-scene__subtitle{width:min(113px,30vw);height:auto}.annual-monthly-leaf-scene__timeline{position:absolute;top:19%;left:0;right:0;bottom:23%;display:grid;grid-template-rows:repeat(var(--monthly-count, 6), minmax(0,1fr));align-items:stretch;gap:clamp(3px,1vh,9px);padding:0 8px}.annual-monthly-leaf-scene__timeline :deep(.monthly-leaf-item){min-height:0}.annual-monthly-leaf-scene__summary{position:absolute;right:7%;bottom:max(86px,calc(env(safe-area-inset-bottom) + 74px));display:grid;justify-items:end;gap:3px;z-index:5}.annual-monthly-leaf-scene__summary p{display:flex;align-items:end;justify-content:end;gap:4px;margin:0;min-height:25px}.annual-monthly-leaf-scene__summary p img{width:min(187px,48vw);height:auto}.annual-monthly-leaf-scene__summary strong{color:#77b313;font:800 clamp(28px,8.5vw,39px)/.8 var(--viewer-display-font);white-space:nowrap}.annual-monthly-leaf-scene__summary>img{width:min(167px,43vw);height:auto}.annual-monthly-leaf-scene__empty{position:absolute;inset:32% 20% 26%;display:grid;place-items:center;text-align:center}.annual-monthly-leaf-scene.density-dense .annual-monthly-leaf-scene__timeline{top:18%;bottom:22%;gap:1px}.annual-monthly-leaf-scene.density-ultra-dense .annual-monthly-leaf-scene__timeline{top:17%;bottom:21%;gap:0}.annual-monthly-leaf-scene.density-ultra-dense .annual-monthly-leaf-scene__timeline :deep(.monthly-leaf-item__cover){transform:scale(.76)}.annual-monthly-leaf-scene.density-ultra-dense .annual-monthly-leaf-scene__timeline :deep(.monthly-leaf-item__leaf){height:min(34px,100%)}.annual-monthly-leaf-scene.density-ultra-dense .annual-monthly-leaf-scene__summary{transform:scale(.86);transform-origin:right bottom}
@media (min-width:721px){.annual-monthly-leaf-scene__inner{box-shadow:0 0 70px rgba(34,92,48,.08)}}
@media (max-height:700px){.annual-monthly-leaf-scene__header{top:22px;gap:5px}.annual-monthly-leaf-scene__timeline{top:17%;bottom:21%}.annual-monthly-leaf-scene__summary{transform:scale(.8);transform-origin:right bottom}}
@media (prefers-reduced-motion:reduce){.annual-monthly-leaf-scene__timeline :deep(.monthly-leaf-item__leaf>img){animation:none;transform:scaleX(1);will-change:auto}}
</style>
