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

// Identical slot geometry to the pre-UX-2 implementation: six periods projected
// onto the visible right half of the ring, each one appearing twice so the ring
// reads as continuous.
const wheelSlots = computed(() => periods.value.flatMap((period, index) => [
  { ...period, angle: -75 + index * 30, instance: "a" },
  { ...period, angle: 105 + index * 30, instance: "b" }
]));

// Each slot draws its own half-sector in a shared SVG layer. The wedge is built
// at the slot's own angle and then rotates with the very same 40s / 360deg
// keyframes as the slot, so a wedge always stays the background of its own slot.
const SECTOR_HALF_WIDTH_DEG = 14;
const SECTOR_OUTER = 368;
const SECTOR_INNER = 286;
const sectorPath = (angle: number) => {
  const point = (degrees: number, radius: number) =>
    `${(Math.cos(degrees * Math.PI / 180) * radius).toFixed(2)} ${(Math.sin(degrees * Math.PI / 180) * radius).toFixed(2)}`;
  const start = angle - SECTOR_HALF_WIDTH_DEG;
  const end = angle + SECTOR_HALF_WIDTH_DEG;
  return `M ${point(start, SECTOR_OUTER)} A ${SECTOR_OUTER} ${SECTOR_OUTER} 0 0 1 ${point(end, SECTOR_OUTER)}`
    + ` L ${point(end, SECTOR_INNER)} A ${SECTOR_INNER} ${SECTOR_INNER} 0 0 0 ${point(start, SECTOR_INNER)} Z`;
};

// The centre reel is sized from the real digit count instead of one fixed size,
// so every legal 2-5 digit count stays inside the wheel window.
const countDigits = (value: number) => Math.max(2, Math.min(5, String(Math.abs(Math.round(value))).length));
</script>

<template>
  <AnnualScene ref="sceneRef" class="time-of-day-scene" :active="active" :reduced-motion="reducedMotion" mood="time-blue" intensity="medium">
    <template #background><img class="time-of-day-scene__background" src="/annual/timeOfDay/background_13.png" alt="" aria-hidden="true"></template>
    <div v-if="summary.timeOfDay" class="time-of-day-poster">
      <header class="time-of-day-theme" data-annual-stage="title">
        <p>{{ t("annualSummary.copy.timeOfDay.eyebrow") }}</p>
      </header>
      <div class="time-wheel" aria-label="年度六个时段">
        <div class="time-wheel__outer-dim" aria-hidden="true"></div>
        <div class="time-wheel__rotor" aria-hidden="true">
          <svg class="time-wheel__sectors" viewBox="-400 -400 800 800" aria-hidden="true">
            <g
              v-for="slot in wheelSlots"
              :key="`sector-${slot.key}-${slot.instance}`"
              class="time-wheel__sector-flow"
              :style="{ '--angle': `${slot.angle}deg` }"
            >
              <path class="time-wheel__sector" :class="{ 'is-peak': slot.key === peakKey }" :d="sectorPath(0)" />
            </g>
          </svg>
          <div
            v-for="slot in wheelSlots"
            :key="`${slot.key}-${slot.instance}`"
            class="time-wheel__slot"
            :class="{ 'is-peak': slot.key === peakKey }"
            :style="{ '--angle': `${slot.angle}deg`, '--strength': slot.key === peakKey ? 1 : .82 }"
          >
            <div class="time-wheel__slot-content">
              <strong class="time-wheel__count" :class="`is-digits-${countDigits(slot.playCount)}`">{{ formatter.format(slot.playCount) }}</strong>
              <span>{{ slot.label }} · {{ slot.range }}</span>
            </div>
          </div>
          <div class="time-wheel__don-assembly" aria-hidden="true"><i class="time-wheel__don-shadow"></i><i class="time-wheel__don-backplate"></i><div class="time-wheel__don-window"><img src="/annual/timeOfDay/half_dong_ka.png" alt=""></div></div>
        </div>
      </div>
      <div class="time-of-day-conclusion" data-annual-stage="copy"><span>{{ t("annualSummary.slides.time.favorite") }}</span><strong>{{ summary.timeOfDay.favoriteHourLabel }}</strong></div>
    </div>
  </AnnualScene>
</template>

<style scoped>
.time-of-day-scene{background:#152949}.time-of-day-scene__background{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.time-of-day-poster{position:absolute;inset:0;color:#fff}
.time-of-day-theme{position:absolute;z-index:6;left:6%;top:max(62px,calc(env(safe-area-inset-top) + 50px));max-width:62%;text-shadow:0 3px 16px rgba(10,24,42,.62)}
.time-of-day-theme p{margin:0;color:rgba(206,230,255,.86);font:700 clamp(10px,2.7vw,13px)/1 var(--viewer-font-family);letter-spacing:.22em}
.time-wheel{--wheel-x:0px;--wheel-y:52%;--wheel-radius:min(88vw,372px);--ring-outer-radius:calc(var(--wheel-radius) * .92);--ring-inner-radius:calc(var(--wheel-radius) * .715);--don-backplate-radius:79px;position:absolute;inset:0;overflow:visible}
.time-wheel__outer-dim{position:absolute;inset:0;z-index:1;pointer-events:none;background:radial-gradient(circle at var(--wheel-x) var(--wheel-y),transparent 0 var(--ring-inner-radius),rgba(0,0,0,.4) calc(var(--ring-inner-radius) + 1px) 100%)}
.time-wheel__rotor{position:absolute;left:calc(var(--wheel-x) - var(--wheel-radius));top:calc(var(--wheel-y) - var(--wheel-radius));width:calc(var(--wheel-radius)*2);height:calc(var(--wheel-radius)*2);overflow:hidden;clip-path:inset(0 0 0 50%);transform-origin:center;will-change:transform;z-index:2}
.time-wheel__slot{position:absolute;left:50%;top:50%;width:180px;text-align:center;transform:translate(-50%,-50%) rotate(var(--angle)) translateX(calc(var(--wheel-radius)*.87));transform-origin:center;animation:time-slot-flow 40s linear normal infinite;opacity:var(--strength);text-shadow:0 3px 15px rgba(10,24,42,.56);z-index:6}
/* The slot's own sector shares the slot's angle state and lives inside the slot,
   so the two always travel together. */
.time-wheel__sectors{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;z-index:0}
.time-wheel__sector{fill:rgba(255,255,255,.19);stroke:rgba(255,255,255,.11);stroke-width:1}
.time-wheel__sector-flow{transform-origin:0 0;animation:time-slot-flow-sector 40s linear normal infinite}
.time-wheel__sector.is-peak{fill:rgba(255,255,255,.29)}
.time-wheel__slot-content{position:relative;z-index:1;transform:rotate(calc(var(--angle) * -1));animation:time-slot-counter 40s linear normal infinite}
.time-wheel__count{display:block;color:#fff;font-variant-numeric:tabular-nums;font-family:var(--viewer-display-font);font-weight:700;line-height:.86;letter-spacing:-.03em;max-width:100%;overflow-wrap:anywhere}
.time-wheel__count.is-digits-2{font-size:clamp(1.55rem,9.5vw,3.1rem)}.time-wheel__count.is-digits-3{font-size:clamp(1.4rem,8.6vw,2.8rem)}.time-wheel__count.is-digits-4{font-size:clamp(1.2rem,7.4vw,2.4rem)}.time-wheel__count.is-digits-5{font-size:clamp(1rem,6vw,2rem)}
.time-wheel__slot.is-peak .time-wheel__count{font-size:clamp(1.7rem,10.6vw,3.5rem);text-shadow:0 0 18px rgba(255,240,184,.52)}
.time-wheel__slot.is-peak .time-wheel__count.is-digits-3{font-size:clamp(1.55rem,9.6vw,3.15rem)}
.time-wheel__slot.is-peak .time-wheel__count.is-digits-4{font-size:clamp(1.35rem,8.3vw,2.7rem)}
.time-wheel__slot.is-peak .time-wheel__count.is-digits-5{font-size:clamp(1.15rem,6.8vw,2.25rem)}
.time-wheel__slot span{display:block;margin-top:6px;color:rgba(255,255,255,.94);font:600 clamp(10px,2.9vw,15px)/1.1 var(--viewer-font-family)}
.time-wheel__don-assembly{position:absolute;left:50%;top:50%;width:160px;height:160px;transform:translate(-50%,-50%);z-index:3}
.time-wheel__don-shadow,.time-wheel__don-backplate,.time-wheel__don-window{position:absolute;inset:50% auto auto 50%;transform:translate(-50%,-50%);border-radius:50%}
.time-wheel__don-shadow{width:calc(var(--ring-inner-radius) * 2);height:calc(var(--ring-inner-radius) * 2);background:radial-gradient(circle,transparent 0 var(--don-backplate-radius),rgba(8,24,35,.18) calc(var(--don-backplate-radius) + 8px),rgba(8,24,35,.06) calc(var(--ring-inner-radius) - 18px),transparent var(--ring-inner-radius));pointer-events:none;z-index:3}
.time-wheel__don-backplate{width:158px;height:158px;background:rgba(255,255,255,.62);z-index:4}
.time-wheel__don-window{width:136px;height:136px;overflow:hidden;clip-path:inset(0 0 0 50%);z-index:5}
.time-wheel__don-window img{position:absolute;left:0;top:0;width:136px;height:136px;max-width:none;object-fit:contain;animation:don-spin 9s linear normal infinite;will-change:transform}
.time-of-day-conclusion{position:absolute;right:7%;bottom:8%;display:flex;align-items:baseline;gap:10px;color:#fff;text-align:right;text-shadow:0 3px 16px rgba(10,24,42,.6)}
.time-of-day-conclusion span{font:700 clamp(13px,3.5vw,18px)/1 var(--viewer-font-family)}.time-of-day-conclusion strong{font:700 clamp(2.4rem,12vw,5rem)/.82 var(--viewer-display-font)}
@keyframes time-slot-flow{from{transform:translate(-50%,-50%) rotate(var(--angle)) translateX(calc(var(--wheel-radius)*.87))}to{transform:translate(-50%,-50%) rotate(calc(var(--angle) + 360deg)) translateX(calc(var(--wheel-radius)*.87))}}@keyframes time-slot-counter{from{transform:rotate(calc(var(--angle) * -1))}to{transform:rotate(calc((var(--angle) + 360deg) * -1))}}@keyframes time-slot-flow-sector{from{transform:rotate(var(--angle))}to{transform:rotate(calc(var(--angle) + 360deg))}}@keyframes don-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.annual-scene:not(.is-active) .time-wheel__slot,.annual-scene:not(.is-active) .time-wheel__slot-content,.annual-scene:not(.is-active) .time-wheel__sector-flow,.annual-scene:not(.is-active) .time-wheel__don-window img{animation-play-state:paused}.annual-scene.is-reduced .time-wheel__slot,.annual-scene.is-reduced .time-wheel__slot-content,.annual-scene.is-reduced .time-wheel__sector-flow,.annual-scene.is-reduced .time-wheel__don-window img{animation:none}
@media(max-width:720px){.time-wheel{--wheel-radius:min(89vw,370px)}.time-wheel__slot{width:145px}.time-wheel__slot span{font-size:12px}.time-wheel__don-assembly{width:160px;height:160px}.time-wheel__don-backplate{width:158px;height:158px}.time-wheel__don-window{width:136px;height:136px}.time-wheel__don-window img{width:136px;height:136px}.time-of-day-conclusion{right:6%;bottom:5%;gap:7px}.time-of-day-conclusion span{font-size:12px}.time-of-day-conclusion strong{font-size:3.3rem}}
@media(max-height:680px){.time-wheel{--wheel-y:51%;--wheel-radius:min(88vw,315px)}.time-wheel__count.is-digits-2{font-size:1.65rem}.time-wheel__count.is-digits-3{font-size:1.5rem}.time-wheel__count.is-digits-4{font-size:1.3rem}.time-wheel__count.is-digits-5{font-size:1.1rem}.time-wheel__slot.is-peak .time-wheel__count{font-size:2rem}.time-of-day-conclusion{bottom:4%}}
</style>
