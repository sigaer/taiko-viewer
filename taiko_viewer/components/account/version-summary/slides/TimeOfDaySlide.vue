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

const SECTOR_STEP_DEG = 30;
const SECTOR_HALF_WIDTH_DEG = 14;
const OUTER_RADIUS = 368;
const INNER_RADIUS = 286;
const LABEL_RADIUS_RATIO = 0.87;

// The semicircle is a fixed stage: only the six items travel along it, and each
// item carries its own half-sector together with its label, so the two can never
// drift apart while the shell itself never rotates away.
const wheelItems = computed(() => periods.value.flatMap((period, index) => [
  { ...period, angle: -75 + index * SECTOR_STEP_DEG, instance: "a" },
  { ...period, angle: 105 + index * SECTOR_STEP_DEG, instance: "b" }
]));

const pointAt = (angle: number, radius: number) =>
  `${(Math.cos(angle * Math.PI / 180) * radius).toFixed(2)} ${(Math.sin(angle * Math.PI / 180) * radius).toFixed(2)}`;
const sectorPath = (angle: number) => {
  const start = angle - SECTOR_HALF_WIDTH_DEG;
  const end = angle + SECTOR_HALF_WIDTH_DEG;
  return `M ${pointAt(start, OUTER_RADIUS)} A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 0 1 ${pointAt(end, OUTER_RADIUS)}`
    + ` L ${pointAt(end, INNER_RADIUS)} A ${INNER_RADIUS} ${INNER_RADIUS} 0 0 0 ${pointAt(start, INNER_RADIUS)} Z`;
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
        <h2>{{ t("annualSummary.slides.time.theme") }}</h2>
      </header>
      <div class="time-wheel" aria-label="年度六个时段">
        <div class="time-wheel__outer-dim" aria-hidden="true"></div>
        <div class="time-wheel__shell" aria-hidden="true"></div>
        <div class="time-wheel__stage" aria-hidden="true">
          <div
            v-for="item in wheelItems"
            :key="`${item.key}-${item.instance}`"
            class="time-wheel__item"
            :class="{ 'is-peak': item.key === peakKey }"
            :style="{ '--slot-angle': `${item.angle}deg`, '--strength': item.key === peakKey ? 1 : .82 }"
          >
            <svg class="time-wheel__item-svg" viewBox="-400 -400 800 800">
              <path class="time-wheel__sector" :class="{ 'is-peak': item.key === peakKey }" :d="sectorPath(item.angle)" />
            </svg>
            <div class="time-wheel__slot">
              <strong class="time-wheel__count" :class="`is-digits-${countDigits(item.playCount)}`">{{ formatter.format(item.playCount) }}</strong>
              <span>{{ item.label }} · {{ item.range }}</span>
            </div>
          </div>
        </div>
        <div class="time-wheel__don-assembly" aria-hidden="true"><i class="time-wheel__don-shadow"></i><i class="time-wheel__don-backplate"></i><div class="time-wheel__don-window"><img src="/annual/timeOfDay/half_dong_ka.png" alt=""></div></div>
      </div>
      <div class="time-of-day-conclusion" data-annual-stage="copy"><span>{{ t("annualSummary.slides.time.favorite") }}</span><strong>{{ summary.timeOfDay.favoriteHourLabel }}</strong></div>
    </div>
  </AnnualScene>
</template>

<style scoped>
.time-of-day-scene{background:#152949}.time-of-day-scene__background{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.time-of-day-poster{position:absolute;inset:0;color:#fff}
.time-of-day-theme{position:absolute;z-index:6;left:6%;top:max(62px,calc(env(safe-area-inset-top) + 50px));max-width:62%;text-shadow:0 3px 16px rgba(10,24,42,.62)}
.time-of-day-theme p{margin:0;color:rgba(206,230,255,.86);font:700 clamp(10px,2.7vw,13px)/1 var(--viewer-font-family);letter-spacing:.22em}
.time-of-day-theme h2{margin:9px 0 0;color:#fff;font:700 clamp(1.12rem,5vw,1.7rem)/1.22 var(--viewer-display-font);letter-spacing:.01em;text-wrap:balance}
.time-wheel{--wheel-x:0px;--wheel-y:52%;--wheel-radius:min(88vw,372px);--ring-outer-radius:calc(var(--wheel-radius) * .92);--ring-inner-radius:calc(var(--wheel-radius) * .715);--don-backplate-radius:79px;position:absolute;inset:0;overflow:visible}
.time-wheel__outer-dim{position:absolute;inset:0;z-index:1;pointer-events:none;background:radial-gradient(circle at var(--wheel-x) var(--wheel-y),transparent 0 var(--ring-inner-radius),rgba(0,0,0,.4) calc(var(--ring-inner-radius) + 1px) 100%)}
/* Fixed shell: the semicircle centre, radius, orientation and clip never change. */
.time-wheel__shell{position:absolute;left:calc(var(--wheel-x) - var(--wheel-radius));top:calc(var(--wheel-y) - var(--wheel-radius));width:calc(var(--wheel-radius)*2);height:calc(var(--wheel-radius)*2);border-radius:50%;border:2px solid rgba(255,255,255,.5);box-shadow:inset 0 0 0 1px rgba(255,255,255,.18),inset 0 0 68px rgba(8,26,46,.28);z-index:2;pointer-events:none}
.time-wheel__stage{position:absolute;left:calc(var(--wheel-x) - var(--wheel-radius));top:calc(var(--wheel-y) - var(--wheel-radius));width:calc(var(--wheel-radius)*2);height:calc(var(--wheel-radius)*2);overflow:hidden;clip-path:inset(0 0 0 50%);z-index:2}
.time-wheel__item{position:absolute;left:50%;top:50%;width:calc(var(--wheel-radius) * 2);height:calc(var(--wheel-radius) * 2);margin:calc(var(--wheel-radius) * -1) 0 0 calc(var(--wheel-radius) * -1);transform-origin:center;opacity:var(--strength);will-change:transform;animation:time-wheel-orbit 40s linear normal infinite}
.time-wheel__item-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.time-wheel__sector{fill:rgba(255,255,255,.19);stroke:rgba(255,255,255,.11);stroke-width:1}
.time-wheel__sector.is-peak{fill:rgba(255,255,255,.29)}
.time-wheel__slot{position:absolute;left:50%;top:50%;width:min(46vw,190px);text-align:center;transform:translate(-50%,-50%) rotate(calc(var(--slot-angle) * -1)) translateX(calc(var(--wheel-radius)*.87));text-shadow:0 3px 15px rgba(10,24,42,.56)}
.time-wheel__count{display:block;color:#fff;font-variant-numeric:tabular-nums;font-family:var(--viewer-display-font);font-weight:700;line-height:.86;letter-spacing:-.03em;max-width:100%;overflow-wrap:anywhere}
.time-wheel__count.is-digits-2{font-size:clamp(1.7rem,10.4vw,3.4rem)}.time-wheel__count.is-digits-3{font-size:clamp(1.45rem,8.9vw,2.95rem)}.time-wheel__count.is-digits-4{font-size:clamp(1.2rem,7.4vw,2.5rem)}.time-wheel__count.is-digits-5{font-size:clamp(1rem,6vw,2.05rem)}
.time-wheel__slot span{display:block;margin-top:6px;color:rgba(255,255,255,.94);font:600 clamp(10px,2.9vw,15px)/1.1 var(--viewer-font-family)}
.time-wheel__item.is-peak .time-wheel__count{text-shadow:0 0 18px rgba(255,240,184,.52)}
.time-wheel__don-assembly{position:absolute;left:50%;top:50%;width:160px;height:160px;transform:translate(-50%,-50%);z-index:3}
.time-wheel__don-shadow,.time-wheel__don-backplate,.time-wheel__don-window{position:absolute;inset:50% auto auto 50%;transform:translate(-50%,-50%);border-radius:50%}
.time-wheel__don-shadow{width:calc(var(--ring-inner-radius) * 2);height:calc(var(--ring-inner-radius) * 2);background:radial-gradient(circle,transparent 0 var(--don-backplate-radius),rgba(8,24,35,.18) calc(var(--don-backplate-radius) + 8px),rgba(8,24,35,.06) calc(var(--ring-inner-radius) - 18px),transparent var(--ring-inner-radius));pointer-events:none;z-index:3}
.time-wheel__don-backplate{width:158px;height:158px;background:rgba(255,255,255,.62);z-index:4}
.time-wheel__don-window{width:136px;height:136px;overflow:hidden;clip-path:inset(0 0 0 50%);z-index:5}
.time-wheel__don-window img{position:absolute;left:0;top:0;width:136px;height:136px;max-width:none;object-fit:contain;animation:don-spin 9s linear normal infinite;will-change:transform}
.time-of-day-conclusion{position:absolute;right:7%;bottom:8%;display:flex;align-items:baseline;gap:10px;color:#fff;text-align:right;text-shadow:0 3px 16px rgba(10,24,42,.6)}
.time-of-day-conclusion span{font:700 clamp(13px,3.5vw,18px)/1 var(--viewer-font-family)}.time-of-day-conclusion strong{font:700 clamp(2.4rem,12vw,5rem)/.82 var(--viewer-display-font)}
/* Each item travels the full circle from its own slot; its sector and label share
   this single angle, so they move as one unit. The shell above never moves. */
@keyframes time-wheel-orbit{from{transform:rotate(var(--slot-angle))}to{transform:rotate(calc(var(--slot-angle) + 360deg))}}
@keyframes don-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.annual-scene:not(.is-active) .time-wheel__item,.annual-scene:not(.is-active) .time-wheel__don-window img{animation-play-state:paused}
.annual-scene.is-reduced .time-wheel__item,.annual-scene.is-reduced .time-wheel__don-window img{animation:none}
@media(max-width:720px){.time-wheel{--wheel-radius:min(89vw,370px)}.time-wheel__slot{width:min(48vw,180px)}.time-wheel__slot span{font-size:12px}.time-wheel__don-assembly{width:160px;height:160px}.time-wheel__don-backplate{width:158px;height:158px}.time-wheel__don-window{width:136px;height:136px}.time-wheel__don-window img{width:136px;height:136px}.time-of-day-conclusion{right:6%;bottom:5%;gap:7px}.time-of-day-conclusion span{font-size:12px}.time-of-day-conclusion strong{font-size:3.3rem}}
@media(max-height:680px){.time-wheel{--wheel-y:51%;--wheel-radius:min(88vw,315px)}.time-wheel__count.is-digits-2{font-size:1.75rem}.time-wheel__count.is-digits-3{font-size:1.55rem}.time-wheel__count.is-digits-4{font-size:1.3rem}.time-wheel__count.is-digits-5{font-size:1.1rem}.time-of-day-conclusion{bottom:4%}}
</style>
