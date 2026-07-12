<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import StorySlideShell from "../StorySlideShell.vue";

const props = defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { t, locale } = useI18n();
const max = computed(() => Math.max(...(props.summary.timeOfDay?.hourlyCounts || [1]), 1));
const formatter = computed(() => new Intl.NumberFormat(locale.value === "ja" ? "ja-JP" : "zh-CN"));
</script>

<template>
  <StorySlideShell :page-index="pageIndex" :page-total="pageTotal" :eyebrow="summary.copy.timeOfDay.eyebrow" :title="summary.copy.timeOfDay.title" :lead="summary.copy.timeOfDay.body" tone="aurora" :active="active" :reduced-motion="reducedMotion">
    <div v-if="summary.timeOfDay" class="time">
      <div class="clock" data-animate>
        <div class="clock__ticks" aria-hidden="true"><i v-for="(count, hour) in summary.timeOfDay.hourlyCounts" :key="hour" :class="{ peak: hour === summary.timeOfDay.favoriteHour }" :style="{ '--turn': `${hour * 15}deg`, '--size': Math.max(.16, count / max) }"><b></b></i></div>
        <div class="clock__center"><span>{{ t("annualSummary.slides.time.favorite") }}</span><strong>{{ summary.timeOfDay.favoriteHourLabel }}</strong><small>{{ summary.timeOfDay.favoriteSong?.name || summary.timeOfDay.topLabel }}</small></div>
      </div>
      <div class="periods"><article v-for="period in summary.timeOfDay.periods" :key="period.key" :class="{ top: period.key === summary.timeOfDay.topPeriod }" data-animate><span>{{ period.label }} · {{ period.range }}</span><strong>{{ formatter.format(period.playCount) }}</strong></article></div>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.time{height:100%;min-height:0;display:grid;grid-template-columns:minmax(220px,.72fr) 1fr;gap:12px}.clock,.periods article{border:1px solid rgba(57,120,200,.18);border-radius:25px;background:rgba(247,251,255,.84);box-shadow:0 14px 34px rgba(23,54,93,.08)}.clock{position:relative;display:grid;place-items:center;min-height:0}.clock__ticks{position:absolute;width:min(35vh,82%);aspect-ratio:1;border:1px solid rgba(57,120,200,.18);border-radius:50%}.clock__ticks i{position:absolute;inset:0;transform:rotate(var(--turn));display:flex;justify-content:center}.clock__ticks b{display:block;width:3px;height:calc(8% + var(--size)*14%);border-radius:99px;background:linear-gradient(#9bc9ff,#3978c8)}.clock__ticks i.peak b{width:5px;background:#3978c8;box-shadow:0 0 14px rgba(57,120,200,.4)}.clock__center{z-index:1;width:58%;aspect-ratio:1;border:7px solid #3978c8;border-radius:50%;display:grid;place-content:center;padding:8%;text-align:center;background:#fff;box-shadow:inset 0 0 0 5px #e5f1ff,0 14px 32px rgba(23,54,93,.13)}.clock__center span,.clock__center small{color:#5c7697;font-size:10px;overflow-wrap:anywhere}.clock__center strong{margin:5px 0;color:#17365d;font:700 clamp(1rem,2.5vw,1.7rem)/1 var(--viewer-display-font)}.periods{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.periods article{padding:11px;display:grid;align-content:center}.periods article.top{border-color:rgba(57,120,200,.7);background:#f7fbff}.periods span{color:#5c7697;font-size:10px}.periods strong{color:#17365d;font:700 1.25rem/1 var(--viewer-display-font)}
@media(max-width:720px){.time{grid-template-columns:minmax(145px,.8fr) 1fr;gap:6px}.clock,.periods article{border-radius:15px}.clock__ticks{width:min(25vh,88%)}.clock__center{border-width:5px}.clock__center strong{font-size:.85rem}.clock__center span,.clock__center small,.periods span{font-size:10px}.periods{gap:4px}.periods article{padding:6px}.periods strong{font-size:.85rem}}
</style>
