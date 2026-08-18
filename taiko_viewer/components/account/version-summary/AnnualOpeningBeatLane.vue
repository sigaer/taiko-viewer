<script setup lang="ts">
import OpeningTaikoMascotLoop from "./OpeningTaikoMascotLoop.vue";

withDefaults(defineProps<{ reducedMotion: boolean; active?: boolean; saveData?: boolean }>(), {
  active: false,
  saveData: false
});
</script>

<template>
  <div class="annual-beat-lane" :class="{ 'is-still': reducedMotion || saveData, 'is-active': active }" aria-hidden="true">
    <div class="annual-beat-lane__mascot">
      <OpeningTaikoMascotLoop :active="active" :reduced-motion="reducedMotion" :save-data="saveData" />
    </div>
    <div class="annual-beat-lane__viewport">
      <div class="annual-beat-lane__track">
        <img v-for="copy in 2" :key="copy" src="/track.png" alt="" width="704" height="35" draggable="false" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.annual-beat-lane {
  --mascot-width: clamp(54px, 14vw, 74px);
  position: relative;
  height: 100%;
  min-height: 40px;
  overflow: visible;
  border-top: 2px solid #25212d;
  border-bottom: 2px solid #25212d;
  background: #d9e0e4;
  box-shadow: 0 5px 18px rgba(6, 20, 44, .22);
}
.annual-beat-lane::before,
.annual-beat-lane::after { content: ""; position: absolute; z-index: 2; left: 0; right: 0; height: 1px; background: rgba(255,255,255,.86); pointer-events: none; }
.annual-beat-lane::before { top: 2px; }
.annual-beat-lane::after { bottom: 2px; }
.annual-beat-lane__mascot { position: absolute; z-index: 6; left: 3px; bottom: -17px; width: var(--mascot-width); height: clamp(56px, 12vw, 76px); filter: drop-shadow(0 4px 2px rgba(18,39,52,.2)); }
.annual-beat-lane__viewport { position: absolute; inset: 0 0 0 var(--mascot-width); overflow: hidden; border-left: 2px solid #222833; background: linear-gradient(180deg, transparent 44%, rgba(255,255,255,.55) 48% 53%, transparent 57%); }
.annual-beat-lane__viewport::before { content: ""; position: absolute; z-index: 4; left: 2px; top: 0; bottom: 0; width: 2px; background: #2b3038; box-shadow: 2px 0 rgba(255,255,255,.72); pointer-events: none; }
.annual-beat-lane__track { display: flex; width: max-content; height: 100%; align-items: center; animation: annual-beat-scroll 11.5s linear infinite; animation-play-state: paused; will-change: transform; }
.annual-beat-lane__track img {
  display: block;
  flex: 0 0 704px;
  width: 704px;
  min-width: 704px;
  max-width: none;
  height: 35px;
  object-fit: none;
  image-rendering: auto;
}
.annual-beat-lane.is-active:not(.is-still) .annual-beat-lane__track { animation-play-state: running; }
.annual-beat-lane.is-still .annual-beat-lane__track { animation: none; transform: translate3d(0, 0, 0); }
@keyframes annual-beat-scroll { to { transform: translate3d(-50%, 0, 0); } }
@media (orientation: landscape) and (max-height: 460px) { .annual-beat-lane { --mascot-width: 62px; } .annual-beat-lane__mascot { bottom: -12px; height: 60px; } }
@media (prefers-reduced-motion: reduce) { .annual-beat-lane__track { animation: none !important; } }
</style>
