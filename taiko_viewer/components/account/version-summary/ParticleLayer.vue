<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(defineProps<{
  active?: boolean;
  reducedMotion?: boolean;
  density?: "low" | "medium" | "high";
  palette?: "blue" | "gold" | "rainbow";
}>(), { active: false, reducedMotion: false, density: "medium", palette: "blue" });

const densityCount = { low: 8, medium: 16, high: 24 } as const;
const particles = computed(() => Array.from({ length: props.reducedMotion ? 0 : densityCount[props.density] }, (_, index) => ({
  index,
  x: (index * 47 + 11) % 100,
  y: (index * 29 + 7) % 100,
  size: 3 + (index % 4),
  delay: (index % 9) * -0.45,
  duration: 4.5 + (index % 5) * 1.1
})));
</script>

<template>
  <div class="particle-layer" :class="[`palette-${palette}`, { 'is-active': active, 'is-reduced': reducedMotion }]" aria-hidden="true">
    <i v-for="particle in particles" :key="particle.index" :style="{ left: `${particle.x}%`, top: `${particle.y}%`, width: `${particle.size}px`, height: `${particle.size}px`, animationDelay: `${particle.delay}s`, animationDuration: `${particle.duration}s` }" />
  </div>
</template>

<style scoped>
.particle-layer { position: absolute; inset: 0; overflow: hidden; pointer-events: none; opacity: .7; }
.particle-layer i { position: absolute; display: block; border-radius: 50%; background: #79b8f1; box-shadow: 0 0 12px currentColor; animation: annual-particle-float 5s ease-in-out infinite; animation-play-state: paused; }
.particle-layer.is-active i { animation-play-state: running; }
.palette-gold i { background: #f5cb72; color: #f5cb72; }
.palette-rainbow i:nth-child(3n) { background: #ef7b7b; color: #ef7b7b; }
.palette-rainbow i:nth-child(3n + 1) { background: #f5cb72; color: #f5cb72; }
@keyframes annual-particle-float { 0%,100% { transform: translate3d(0,8px,0) scale(.72); opacity: .2; } 50% { transform: translate3d(8px,-14px,0) scale(1.1); opacity: .86; } }
@media(max-width:720px){.particle-layer i:nth-child(n+13){display:none}}
@media(prefers-reduced-motion:reduce){.particle-layer{display:none}}
</style>
