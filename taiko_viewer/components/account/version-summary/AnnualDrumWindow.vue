<script setup lang="ts">
import { ref, watch } from "vue";
import AnnualArtworkFallback from "./AnnualArtworkFallback.vue";

const props = withDefaults(defineProps<{
  imageUrl?: string | null;
  imageAlt?: string;
  fallback?: string;
  fallbackKind?: "don" | "cover";
  size?: "small" | "medium" | "large";
  gold?: boolean;
}>(), {
  imageUrl: null,
  imageAlt: "",
  fallback: "DON",
  fallbackKind: "cover",
  size: "medium",
  gold: false
});

const imageFailed = ref(false);
watch(() => props.imageUrl, () => { imageFailed.value = false; });
</script>

<template>
  <div class="drum-window" :class="[`drum-window--${size}`, { 'drum-window--gold': gold }]">
    <div class="drum-window__rim" aria-hidden="true">
      <i v-for="index in 12" :key="index" :style="{ '--turn': `${index * 30}deg` }"></i>
    </div>
    <div class="drum-window__membrane">
      <slot>
        <img v-if="imageUrl && !imageFailed" :src="imageUrl" :alt="imageAlt" class="drum-window__image" @error="imageFailed = true" />
        <AnnualArtworkFallback v-else :kind="fallbackKind" :label="fallback" :mark="fallbackKind === 'don' ? 'DON' : '2026'" />
      </slot>
    </div>
  </div>
</template>

<style scoped>
.drum-window {
  --drum-size: min(42vh, 360px);
  position: relative;
  width: var(--drum-size);
  max-width: 100%;
  aspect-ratio: 1;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #3978c8;
  box-shadow:
    0 28px 62px rgba(23, 54, 93, 0.2),
    inset 0 0 0 2px rgba(255, 255, 255, 0.52),
    inset 0 0 0 12px rgba(23, 54, 93, 0.12);
}

.drum-window--small { --drum-size: min(28vh, 210px); }
.drum-window--large { --drum-size: min(50vh, 430px); }
.drum-window--gold { background: #3978c8; }

.drum-window__rim {
  position: absolute;
  inset: 0;
  border-radius: inherit;
}

.drum-window__rim i {
  position: absolute;
  inset: 0;
  transform: rotate(var(--turn));
  display: flex;
  justify-content: center;
  padding-top: 3px;
}

.drum-window__rim i::before {
  content: "";
  width: clamp(5px, 2.2%, 9px);
  aspect-ratio: 1;
  border-radius: 50%;
  background: #f7fbff;
  box-shadow: 0 1px 4px rgba(23, 54, 93, 0.22);
}

.drum-window__membrane {
  position: absolute;
  inset: 8.5%;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  color: #17365d;
  background:
    radial-gradient(circle at 38% 28%, rgba(255, 255, 255, 0.98), rgba(247, 251, 255, 0.94) 45%, rgba(229, 241, 255, 0.98));
  border: 2px solid rgba(23, 54, 93, 0.12);
  box-shadow:
    inset 0 0 32px rgba(57, 120, 200, 0.12),
    0 0 0 5px rgba(247, 251, 255, 0.78);
}

.drum-window__image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

@media (max-width: 720px) {
  .drum-window { --drum-size: min(30vh, 42vw, 210px); }
  .drum-window--small { --drum-size: min(24vh, 34vw, 150px); }
  .drum-window--large { --drum-size: min(34vh, 48vw, 230px); }
}
</style>
