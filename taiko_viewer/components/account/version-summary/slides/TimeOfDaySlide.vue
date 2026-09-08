<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualScene from "../AnnualScene.vue";
import { useAnnualTimeline } from "~/composables/useAnnualTimeline";

const props = defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { t, locale } = useI18n();
const sceneRef = ref<{ rootEl?: HTMLElement | null } | null>(null);
useAnnualTimeline(sceneRef, toRef(props, "active"), toRef(props, "reducedMotion"));
const formatter = computed(() => new Intl.NumberFormat(locale.value === "ja" ? "ja-JP" : "zh-CN"));
const periods = computed(() => props.summary.timeOfDay?.periods ?? []);
const peakKey = computed(() => props.summary.timeOfDay?.topPeriod ?? "");
const maxCount = computed(() => Math.max(...periods.value.map((period) => period.playCount), 1));
const wheelSlots = computed(() => periods.value.flatMap((period, index) => [
  { ...period, angle: -75 + index * 30, instance: "a" },
  { ...period, angle: 105 + index * 30, instance: "b" }
]));
const sectorPath = (start: number, end: number, outer: number, inner: number) => {
  const point = (angle: number, radius: number) => `${(Math.cos(angle * Math.PI / 180) * radius).toFixed(2)} ${(Math.sin(angle * Math.PI / 180) * radius).toFixed(2)}`;
  return `M ${point(start, outer)} A ${outer} ${outer} 0 0 1 ${point(end, outer)} L ${point(end, inner)} A ${inner} ${inner} 0 0 0 ${point(start, inner)} Z`;
};
const sectors = computed(() => wheelSlots.value.map((slot) => ({ ...slot, path: sectorPath(slot.angle - 14, slot.angle + 14, 368, 286) })));
</script>

<template>
  <AnnualScene ref="sceneRef" class="time-of-day-scene" :active="active" :reduced-motion="reducedMotion" mood="time-blue" intensity="medium">
    <template #background><img class="time-of-day-scene__background" src="/annual/timeOfDay/background_13.png" alt="" aria-hidden="true"></template>
    <div v-if="summary.timeOfDay" class="time-of-day-poster">
      <div class="time-wheel" aria-label="年度六个时段"><div class="time-wheel__rotor">
        <svg class="time-wheel__svg" viewBox="-400 -400 800 800" aria-hidden="true"><path v-for="sector in sectors" :key="`${sector.key}-${sector.instance}`" class="time-wheel__sector" :class="{ 'is-peak': sector.key === peakKey }" :d="sector.path" /><circle cx="0" cy="0" r="368" class="time-wheel__edge" /><circle cx="0" cy="0" r="286" class="time-wheel__edge time-wheel__edge--inner" /></svg>
        <div v-for="slot in wheelSlots" :key="`${slot.key}-${slot.instance}`" class="time-wheel__slot" :class="{ 'is-peak': slot.key === peakKey }" :style="{ '--angle': `${slot.angle}deg`, '--strength': `${Math.max(.72, slot.playCount / maxCount)}` }"><div class="time-wheel__slot-content"><strong>{{ formatter.format(slot.playCount) }}</strong><span>{{ slot.label }} · {{ slot.range }}</span></div></div>
      </div><div class="time-wheel__don-window" aria-hidden="true"><img src="/annual/timeOfDay/half_dong_ka.png" alt=""></div></div>
      <div class="time-of-day-conclusion" data-annual-stage="copy"><span>{{ t("annualSummary.slides.time.favorite") }}</span><strong>{{ summary.timeOfDay.favoriteHourLabel }}</strong></div>
    </div>
  </AnnualScene>
</template>

<style scoped>
.time-of-day-scene{background:#152949}.time-of-day-scene__background{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.time-of-day-poster{position:absolute;inset:0;color:#fff}.time-wheel{--wheel-x:-24px;--wheel-y:52%;--wheel-radius:min(88vw,372px);position:absolute;inset:0;overflow:visible}.time-wheel__rotor{position:absolute;left:calc(var(--wheel-x) - var(--wheel-radius));top:calc(var(--wheel-y) - var(--wheel-radius));width:calc(var(--wheel-radius)*2);height:calc(var(--wheel-radius)*2);overflow:hidden;clip-path:inset(0 0 0 50%);transform-origin:center;animation:time-wheel-rotate 40s linear infinite;will-change:transform}.time-wheel__svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}.time-wheel__sector{fill:rgba(255,255,255,.19);stroke:rgba(255,255,255,.11);stroke-width:1}.time-wheel__sector.is-peak{fill:rgba(255,255,255,.29)}.time-wheel__edge{fill:none;stroke:rgba(255,255,255,.52);stroke-width:2}.time-wheel__edge--inner{stroke:rgba(255,255,255,.2);stroke-width:1}.time-wheel__slot{position:absolute;left:50%;top:50%;width:180px;text-align:center;transform:translate(-50%,-50%) rotate(var(--angle)) translateX(calc(var(--wheel-radius)*.87));transform-origin:center;opacity:var(--strength);text-shadow:0 3px 15px rgba(10,24,42,.56)}.time-wheel__slot-content{transform:rotate(calc(var(--angle) * -1))}.time-wheel__slot strong{display:block;color:#fff;font:700 clamp(2rem,12vw,4rem)/.82 var(--viewer-display-font);letter-spacing:-.03em}.time-wheel__slot span{display:block;margin-top:7px;color:rgba(255,255,255,.94);font:700 clamp(11px,3.5vw,18px)/1.1 var(--viewer-font-family)}.time-wheel__slot.is-peak strong{font-size:clamp(2.6rem,15vw,5rem);text-shadow:0 0 18px rgba(255,240,184,.52)}.time-wheel__don-window{position:absolute;left:var(--wheel-x);top:var(--wheel-y);width:148px;height:148px;overflow:hidden;clip-path:inset(0 0 0 50%);transform:translate(-50%,-50%)}.time-wheel__don-window img{position:absolute;left:0;top:0;width:148px;height:148px;max-width:none;object-fit:contain;animation:don-spin 10s linear infinite;will-change:transform}.time-of-day-conclusion{position:absolute;right:7%;bottom:8%;display:flex;align-items:baseline;gap:10px;color:#fff;text-align:right;text-shadow:0 3px 16px rgba(10,24,42,.6)}.time-of-day-conclusion span{font:700 clamp(13px,3.5vw,18px)/1 var(--viewer-font-family)}.time-of-day-conclusion strong{font:700 clamp(2.4rem,12vw,5rem)/.82 var(--viewer-display-font)}
@keyframes time-wheel-rotate{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes don-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.annual-scene:not(.is-active) .time-wheel__rotor,.annual-scene:not(.is-active) .time-wheel__don-window img{animation-play-state:paused}.annual-scene.is-reduced .time-wheel__rotor,.annual-scene.is-reduced .time-wheel__don-window img{animation:none}
@media(max-width:720px){.time-wheel{--wheel-x:-20px;--wheel-radius:min(89vw,370px)}.time-wheel__slot{width:145px}.time-wheel__slot span{font-size:12px}.time-wheel__don-window{width:180px;height:180px}.time-wheel__don-window img{width:180px;height:180px}.time-of-day-conclusion{right:6%;bottom:5%;gap:7px}.time-of-day-conclusion span{font-size:12px}.time-of-day-conclusion strong{font-size:3.3rem}}@media(max-height:680px){.time-wheel{--wheel-y:51%;--wheel-radius:min(88vw,315px)}.time-wheel__slot strong{font-size:2.1rem}.time-wheel__slot.is-peak strong{font-size:2.6rem}.time-of-day-conclusion{bottom:4%}}
</style>
