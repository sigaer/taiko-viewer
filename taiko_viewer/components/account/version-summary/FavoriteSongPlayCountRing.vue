<script setup lang="ts">
import AnimatedNumber from "./AnimatedNumber.vue";

withDefaults(defineProps<{
  playCount: number;
  active?: boolean;
  reducedMotion?: boolean;
  label: string;
  unit: string;
}>(), {
  active: false,
  reducedMotion: false
});

const emit = defineEmits<{ complete: [] }>();
</script>

<template>
  <div class="favorite-song-count-ring">
    <svg class="favorite-song-count-ring__orbits" viewBox="0 0 160 160" aria-hidden="true">
      <circle class="favorite-song-count-ring__outer" cx="80" cy="80" r="72" />
      <circle class="favorite-song-count-ring__dash" cx="80" cy="80" r="65" />
      <circle class="favorite-song-count-ring__accent" cx="80" cy="80" r="72" pathLength="1" />
      <circle class="favorite-song-count-ring__node" cx="80" cy="8" r="3" />
      <circle class="favorite-song-count-ring__node is-lower" cx="80" cy="152" r="2.5" />
    </svg>

    <div class="favorite-song-count-ring__content">
      <span class="favorite-song-count-ring__label">{{ label }}</span>
      <strong class="favorite-song-count-ring__value">
        <AnimatedNumber
          :value="playCount"
          :active="active"
          :reduced-motion="reducedMotion"
          :delay="1240"
          :duration="760"
          @complete="emit('complete')"
        />
        <em>{{ unit }}</em>
      </strong>
    </div>
  </div>
</template>

<style scoped>
.favorite-song-count-ring {
  position: relative;
  display: grid;
  width: var(--favorite-count-size);
  aspect-ratio: 1;
  place-items: center;
  color: #f9f4e9;
  filter: drop-shadow(0 0 18px rgba(67, 210, 202, 0.12));
}

.favorite-song-count-ring::before {
  content: "";
  position: absolute;
  inset: 13%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(8, 46, 61, 0.72), rgba(2, 17, 34, 0.2) 70%, transparent 72%);
  box-shadow: inset 0 0 30px rgba(55, 203, 198, 0.1);
}

.favorite-song-count-ring__orbits {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.favorite-song-count-ring__outer,
.favorite-song-count-ring__dash,
.favorite-song-count-ring__accent {
  fill: none;
  vector-effect: non-scaling-stroke;
}

.favorite-song-count-ring__outer {
  stroke: rgba(87, 222, 211, 0.88);
  stroke-width: 1.2;
}

.favorite-song-count-ring__dash {
  stroke: rgba(115, 227, 218, 0.62);
  stroke-width: 1;
  stroke-dasharray: 3 4;
}

.favorite-song-count-ring__accent {
  stroke: rgba(248, 215, 126, 0.9);
  stroke-width: 1.25;
  stroke-dasharray: 0.16 0.84;
  stroke-dashoffset: 0.08;
}

.favorite-song-count-ring__node {
  fill: #77e2d9;
  filter: drop-shadow(0 0 4px rgba(84, 222, 211, 0.95));
}

.favorite-song-count-ring__node.is-lower {
  fill: #f8d77e;
}

.favorite-song-count-ring__content {
  position: relative;
  z-index: 1;
  display: grid;
  justify-items: center;
  align-content: center;
  padding: 12px 10px;
  text-align: center;
}

.favorite-song-count-ring__label {
  color: rgba(239, 246, 244, 0.84);
  font: 600 clamp(9px, 2.4vw, 11px)/1.15 var(--viewer-font-family);
  letter-spacing: 0.02em;
}

.favorite-song-count-ring__value {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 5px;
  margin-top: 2px;
  color: #ffe19a;
  font: 900 clamp(2.85rem, 12.6vw, 3.65rem)/0.9 var(--viewer-display-font);
  letter-spacing: -0.035em;
  text-shadow: 0 4px 24px rgba(248, 215, 126, 0.2);
}

.favorite-song-count-ring__value em {
  color: #f8d77e;
  font: 800 clamp(11px, 3.1vw, 14px)/1 var(--viewer-font-family);
  font-style: normal;
  letter-spacing: 0;
}

@media (max-height:820px) and (orientation:portrait) {
  .favorite-song-count-ring__content { padding: 8px; }
  .favorite-song-count-ring__value { font-size: clamp(2.1rem, 9.5vw, 2.5rem); }
  .favorite-song-count-ring__value em { font-size: clamp(10px, 2.8vw, 12px); }
}
</style>
