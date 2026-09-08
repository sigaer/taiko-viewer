<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import StorySlideShell from "../StorySlideShell.vue";

const props = defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { t, locale } = useI18n();
const formatter = computed(() => new Intl.NumberFormat(locale.value === "ja" ? "ja-JP" : "zh-CN"));
const periods = computed(() => props.summary.timeOfDay?.periods ?? []);
const peakKey = computed(() => props.summary.timeOfDay?.topPeriod ?? "");
const maxCount = computed(() => Math.max(...periods.value.map((period) => period.playCount), 1));
const visualInstances = computed(() => periods.value.flatMap((period, index) => [
  { ...period, angle: index * 30, instance: "a" }, { ...period, angle: index * 30 + 180, instance: "b" }
]));
</script>

<template>
  <StorySlideShell :page-index="pageIndex" :page-total="pageTotal" :eyebrow="summary.copy.timeOfDay.eyebrow" :title="summary.copy.timeOfDay.title" :lead="summary.copy.timeOfDay.body" tone="aurora" :active="active" :reduced-motion="reducedMotion">
    <template #background><img class="time-bg" src="/annual/timeOfDay/background_13.png" alt="" aria-hidden="true"></template>
    <div v-if="summary.timeOfDay" class="time-of-day">
      <div class="wheel-window" aria-label="年度六个时段"><div class="wheel-stage"><div class="wheel-ring" aria-hidden="true" />
        <div v-for="period in visualInstances" :key="`${period.key}-${period.instance}`" class="time-slot" :class="{ peak: period.key === peakKey }" :style="{ '--angle': `${period.angle}deg`, '--strength': `${Math.max(.2, period.playCount / maxCount)}` }"><span>{{ period.label }}</span><small>{{ period.range }}</small><strong>{{ formatter.format(period.playCount) }}</strong></div>
      </div></div>
      <div class="don-window" aria-hidden="true"><img src="/annual/timeOfDay/half_dong_ka.png" alt=""></div>
      <div class="time-summary"><span>{{ t("annualSummary.slides.time.favorite") }}</span><strong>{{ summary.timeOfDay.favoriteHourLabel }}</strong><small>{{ summary.timeOfDay.favoriteSong?.name || summary.timeOfDay.topLabel }}</small></div>
      <div class="time-total"><span>{{ t("annualSummary.slides.overview.plays") }}</span><b>{{ formatter.format(summary.timeOfDay.totalPlays) }}</b></div>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.time-of-day{position:relative;height:100%;min-height:0;overflow:hidden;color:#fff}.time-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.98}.wheel-window{position:absolute;inset:3% 0 8%;overflow:hidden;clip-path:inset(0 0 0 48%);mask-image:linear-gradient(to bottom,transparent 0,#000 8%,#000 92%,transparent 100%);-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 8%,#000 92%,transparent 100%)}.wheel-stage{--radius:min(70vw,310px);position:absolute;left:clamp(-36px,-5vw,-12px);top:50%;width:calc(var(--radius)*2);height:calc(var(--radius)*2);margin-top:calc(var(--radius)*-1);transform-origin:50% 50%;animation:time-wheel 40s linear infinite;will-change:transform}.wheel-ring{position:absolute;inset:0;border:1px solid rgba(255,255,255,.36);border-radius:50%;box-shadow:0 0 0 18px rgba(255,255,255,.04),0 0 0 44px rgba(255,255,255,.04)}.time-slot{position:absolute;left:50%;top:50%;width:clamp(102px,27vw,156px);padding:8px 11px;border-left:1px solid rgba(255,255,255,.45);color:rgba(255,255,255,.72);text-align:left;transform:translate(-50%,-50%) rotate(var(--angle)) translateY(calc(var(--radius)*-.99)) rotate(calc(var(--angle)*-1));transform-origin:center;opacity:calc(.4 + var(--strength)*.35);text-shadow:0 2px 12px rgba(0,0,0,.3)}.time-slot span,.time-slot small,.time-slot strong{display:block}.time-slot span{font-size:clamp(10px,2.2vw,14px);font-weight:600}.time-slot small{font-size:10px;letter-spacing:.08em}.time-slot strong{margin-top:3px;font:700 clamp(1.3rem,5vw,2.8rem)/.92 var(--viewer-display-font);letter-spacing:.02em}.time-slot.peak{color:#fff;opacity:1;border-left:3px solid #fff0b0;text-shadow:0 0 16px rgba(255,235,168,.75)}.time-slot.peak strong{font-size:clamp(1.6rem,6vw,3.3rem)}.don-window{position:absolute;left:clamp(0px,3vw,28px);top:50%;width:min(34vw,155px);height:min(34vw,155px);overflow:hidden;transform:translateY(-50%);border-radius:50%;border:7px solid rgba(255,255,255,.74);box-shadow:0 0 0 12px rgba(255,255,255,.16);background:rgba(255,255,255,.1)}.don-window img{width:200%;height:100%;max-width:none;object-fit:contain;transform:translateX(-50%);animation:don-spin 10s linear infinite;will-change:transform}.time-summary{position:absolute;right:clamp(18px,7vw,74px);bottom:clamp(42px,9vh,90px);display:grid;gap:3px;text-align:right;text-shadow:0 2px 12px rgba(0,0,0,.4)}.time-summary span,.time-summary small{font-size:clamp(11px,2.8vw,15px);font-weight:600}.time-summary strong{font:700 clamp(2.3rem,11vw,5.4rem)/.85 var(--viewer-display-font)}.time-total{position:absolute;right:clamp(18px,7vw,74px);top:14%;display:grid;text-align:right;opacity:.75;text-shadow:0 2px 12px rgba(0,0,0,.35)}.time-total span{font-size:11px}.time-total b{font:700 clamp(1rem,3vw,1.8rem)/1 var(--viewer-display-font)}.story-slide-shell:not(.is-active) .wheel-stage,.story-slide-shell:not(.is-active) .don-window img{animation-play-state:paused}.story-slide-shell.is-reduced .wheel-stage,.story-slide-shell.is-reduced .don-window img{animation:none}
@keyframes time-wheel{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes don-spin{from{transform:translateX(-50%) rotate(0deg)}to{transform:translateX(-50%) rotate(360deg)}}
@media(max-width:720px){.wheel-stage{--radius:min(74vw,280px)}.time-slot{width:104px;padding:6px 8px}.time-slot strong{font-size:1.45rem}.time-slot.peak strong{font-size:1.75rem}.don-window{width:31vw;height:31vw;border-width:5px}.time-summary{right:16px;bottom:34px}.time-total{right:16px;top:12%}}@media(max-height:680px){.wheel-window{inset:0 0 4%}.time-summary{bottom:20px}.time-total{top:10%}}
</style>
