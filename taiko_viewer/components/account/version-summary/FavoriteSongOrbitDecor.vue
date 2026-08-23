<script setup lang="ts">
withDefaults(defineProps<{
  active?: boolean;
  reducedMotion?: boolean;
}>(), {
  active: false,
  reducedMotion: false
});
</script>

<template>
  <div
    class="favorite-song-orbit"
    :class="{ 'is-active': active, 'is-reduced': reducedMotion }"
    aria-hidden="true"
  >
    <div class="favorite-song-orbit__rings" data-annual-stage="visual">
      <i /><i /><i /><i />
    </div>

    <div class="favorite-song-orbit__notes" data-annual-stage="visual">
      <i>♪</i><i>♪</i><i>♪</i><i>♪</i>
    </div>

    <div class="favorite-song-orbit__stars" data-annual-stage="visual">
      <i /><i /><i /><i /><i /><i />
    </div>

    <svg
      class="favorite-song-orbit__guide"
      data-annual-stage="data"
      viewBox="0 0 414 896"
      preserveAspectRatio="none"
    >
      <path
        class="favorite-song-orbit__guide-glow"
        d="M350 411 L350 590 Q350 624 318 624 L282 624"
        pathLength="1"
      />
      <path
        class="favorite-song-orbit__guide-line"
        d="M350 411 L350 590 Q350 624 318 624 L282 624"
        pathLength="1"
      />
      <circle class="favorite-song-orbit__guide-node" cx="350" cy="411" r="2.4" />
      <circle class="favorite-song-orbit__guide-node is-end" cx="282" cy="624" r="3.2" />
    </svg>
  </div>
</template>

<style scoped>
.favorite-song-orbit {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.favorite-song-orbit__rings {
  position: absolute;
  top: var(--favorite-cover-center-y);
  left: 50%;
  width: min(108vw, 500px);
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  border: 1px solid rgba(95, 215, 210, 0.2);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(74, 206, 202, 0.1), transparent 62%);
  box-shadow: 0 0 52px rgba(72, 200, 211, 0.13), inset 0 0 48px rgba(36, 128, 165, 0.08);
}

.favorite-song-orbit__rings::before,
.favorite-song-orbit__rings::after,
.favorite-song-orbit__rings i {
  content: "";
  position: absolute;
  border-radius: 50%;
}

.favorite-song-orbit__rings::before {
  inset: 4.5%;
  border: 1px solid rgba(245, 211, 119, 0.36);
  border-right-color: transparent;
  border-bottom-color: rgba(245, 211, 119, 0.08);
  transform: rotate(-24deg);
  box-shadow: 0 -4px 20px rgba(245, 211, 119, 0.12);
}

.favorite-song-orbit__rings::after {
  inset: 11.5%;
  border: 1px dashed rgba(102, 225, 213, 0.32);
  box-shadow: inset 0 0 30px rgba(50, 177, 197, 0.09);
}

.favorite-song-orbit__rings i {
  inset: calc(18% + var(--orbit-index, 0) * 7.5%);
  border: 1px solid rgba(163, 222, 235, 0.16);
}

.favorite-song-orbit__rings i:nth-child(2) {
  --orbit-index: 1;
  border-style: dashed;
  border-color: rgba(245, 211, 119, 0.2);
}

.favorite-song-orbit__rings i:nth-child(3) {
  --orbit-index: 2;
}

.favorite-song-orbit__rings i:nth-child(4) {
  --orbit-index: 3;
  border-color: rgba(87, 212, 207, 0.24);
}

.favorite-song-orbit__notes i {
  position: absolute;
  color: rgba(91, 217, 207, 0.72);
  font: 700 clamp(1.15rem, 5.5vw, 2rem)/1 var(--viewer-display-font);
  font-style: normal;
  text-shadow: 0 0 12px rgba(64, 211, 205, 0.5);
}

.favorite-song-orbit__notes i:nth-child(1) { top: 20%; left: 10%; color: rgba(245, 211, 119, 0.82); transform: rotate(18deg); }
.favorite-song-orbit__notes i:nth-child(2) { top: 24%; right: 7%; transform: rotate(10deg); }
.favorite-song-orbit__notes i:nth-child(3) { top: 75%; right: 10%; transform: rotate(20deg); }
.favorite-song-orbit__notes i:nth-child(4) { top: 84%; left: 20%; color: rgba(245, 211, 119, 0.52); transform: rotate(-18deg); }

.favorite-song-orbit__stars i {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #f5d377;
  box-shadow: 0 0 9px rgba(245, 211, 119, 0.8);
}

.favorite-song-orbit__stars i:nth-child(1) { top: 12%; left: 18%; }
.favorite-song-orbit__stars i:nth-child(2) { top: 16%; right: 19%; width: 2px; height: 2px; }
.favorite-song-orbit__stars i:nth-child(3) { top: 55%; left: 8%; background: #68d8d2; }
.favorite-song-orbit__stars i:nth-child(4) { top: 60%; right: 10%; }
.favorite-song-orbit__stars i:nth-child(5) { top: 83%; right: 23%; width: 2px; height: 2px; background: #68d8d2; }
.favorite-song-orbit__stars i:nth-child(6) { top: 91%; left: 39%; width: 4px; height: 4px; }

.favorite-song-orbit__guide {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.favorite-song-orbit__guide-glow,
.favorite-song-orbit__guide-line {
  fill: none;
  vector-effect: non-scaling-stroke;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.favorite-song-orbit__guide-glow {
  stroke: rgba(245, 211, 119, 0.2);
  stroke-width: 6;
}

.favorite-song-orbit__guide-line {
  stroke: rgba(255, 222, 132, 0.88);
  stroke-width: 1.15;
  stroke-dasharray: 1;
  stroke-dashoffset: 0;
}

.favorite-song-orbit__guide-node {
  fill: #ffe29a;
  filter: drop-shadow(0 0 4px rgba(255, 222, 132, 0.9));
}

.favorite-song-orbit__guide-node.is-end {
  fill: #6ee1d5;
}

.favorite-song-orbit.is-active:not(.is-reduced) .favorite-song-orbit__rings {
  animation: favorite-orbit-arrive 0.9s cubic-bezier(0.18, 0.82, 0.22, 1) 0.12s both;
}

.favorite-song-orbit.is-active:not(.is-reduced) .favorite-song-orbit__rings::after {
  animation: favorite-orbit-turn 4.8s cubic-bezier(0.2, 0.65, 0.25, 1) 0.7s 1 both;
}

.favorite-song-orbit.is-active:not(.is-reduced) .favorite-song-orbit__guide-line {
  animation: favorite-guide-draw 0.72s cubic-bezier(0.22, 0.72, 0.24, 1) 1.08s both;
}

.favorite-song-orbit.is-active:not(.is-reduced) .favorite-song-orbit__guide-node {
  animation: favorite-guide-node 0.42s ease-out 1.54s both;
}

.favorite-song-orbit.is-active:not(.is-reduced) .favorite-song-orbit__notes i {
  animation: favorite-note-arrive 1.7s ease-out calc(0.25s + var(--note-delay, 0s)) 1 both;
}

.favorite-song-orbit__notes i:nth-child(2) { --note-delay: 0.14s; }
.favorite-song-orbit__notes i:nth-child(3) { --note-delay: 0.28s; }
.favorite-song-orbit__notes i:nth-child(4) { --note-delay: 0.42s; }

@keyframes favorite-orbit-arrive {
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.86); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

@keyframes favorite-orbit-turn {
  from { transform: rotate(-24deg); }
  to { transform: rotate(336deg); }
}

@keyframes favorite-guide-draw {
  from { stroke-dashoffset: 1; }
  to { stroke-dashoffset: 0; }
}

@keyframes favorite-guide-node {
  from { opacity: 0; transform: scale(0.3); transform-origin: center; }
  to { opacity: 1; transform: scale(1); transform-origin: center; }
}

@keyframes favorite-note-arrive {
  from { opacity: 0; translate: 0 10px; }
  55% { opacity: 0.9; translate: 0 -4px; }
  to { opacity: 0.66; translate: 0 0; }
}

@media (orientation: landscape) and (max-height: 460px) {
  .favorite-song-orbit__rings { top: 50%; left: 27%; width: min(43vw, 82vh); }
  .favorite-song-orbit__guide { display: none; }
  .favorite-song-orbit__notes i:nth-child(n + 3) { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .favorite-song-orbit * { animation: none !important; }
}
</style>
