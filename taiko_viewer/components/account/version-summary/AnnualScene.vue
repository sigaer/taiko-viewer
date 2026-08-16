<script setup lang="ts">
import { ref } from "vue";

withDefaults(defineProps<{
  active?: boolean;
  reducedMotion?: boolean;
  mood?: string;
  intensity?: "low" | "medium" | "high";
}>(), {
  active: false,
  reducedMotion: false,
  mood: "inherit",
  intensity: "medium"
});

const rootRef = ref<HTMLElement | null>(null);
defineExpose({ rootEl: rootRef });
</script>

<template>
  <section
    ref="rootRef"
    class="annual-scene"
    :class="[`mood-${mood}`, `intensity-${intensity}`, { 'is-active': active, 'is-reduced': reducedMotion }]"
    :data-scene-mood="mood"
    :data-scene-intensity="intensity"
  >
    <div class="annual-scene__layer annual-scene__background" aria-hidden="true"><slot name="background" /></div>
    <div class="annual-scene__layer annual-scene__atmosphere" aria-hidden="true"><slot name="atmosphere" /></div>
    <div class="annual-scene__layer annual-scene__visual"><slot name="visual" /></div>
    <div class="annual-scene__layer annual-scene__data"><slot name="data" /></div>
    <div class="annual-scene__layer annual-scene__copy"><slot name="copy" /></div>
    <div class="annual-scene__content"><slot /></div>
  </section>
</template>

<style scoped>
.annual-scene {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  isolation: isolate;
  background: var(--annual-scene-bg, linear-gradient(145deg, #f7fbff, #e5f1ff));
}

.annual-scene__layer {
  position: absolute;
  inset: 0;
  min-width: 0;
  min-height: 0;
  pointer-events: none;
}

.annual-scene__background { z-index: 0; }
.annual-scene__atmosphere { z-index: 1; }
.annual-scene__visual { z-index: 2; }
.annual-scene__data { z-index: 3; }
.annual-scene__copy { z-index: 4; }
.annual-scene__content { position: relative; z-index: 5; width: 100%; height: 100%; min-height: 0; }

.annual-scene:not(.is-active) :deep(*) {
  animation-play-state: paused !important;
}

.annual-scene.is-reduced :deep(*) {
  scroll-behavior: auto !important;
}

@media (prefers-reduced-motion: reduce) {
  .annual-scene :deep(*) { animation-duration: 1ms !important; animation-iteration-count: 1 !important; }
}
</style>
