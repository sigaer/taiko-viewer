<script setup lang="ts">
import { computed, onMounted, ref, toRef, watch } from "vue";
import { useAnnualTimeline } from "~/composables/useAnnualTimeline";

const props = withDefaults(defineProps<{
  frameCount: number;
  fps?: number;
  active: boolean;
  reducedMotion: boolean;
  saveData?: boolean;
  srcDir: string;
  extension?: string;
  loop?: boolean;
  alt?: string;
}>(), {
  fps: 12,
  saveData: false,
  extension: "png",
  loop: true,
  alt: ""
});

const rootRef = ref<HTMLElement | null>(null);
const frameIndex = ref(0);
const networkSaveData = ref(false);
const frameUrls = computed(() => Array.from(
  { length: Math.max(1, props.frameCount) },
  (_, index) => `${props.srcDir.replace(/\/$/, "")}/${index}.${props.extension}`
));
const staticMode = computed(() => props.reducedMotion || props.saveData || networkSaveData.value);
const currentFrame = computed(() => frameUrls.value[staticMode.value ? 0 : frameIndex.value] || "");

const { onAnnualMotionActive } = useAnnualTimeline(
  rootRef,
  toRef(props, "active"),
  staticMode,
  { reenter: "resume" }
);

onAnnualMotionActive((scope) => {
  const images = frameUrls.value.map((url) => {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    return image;
  });
  const frameDelay = Math.max(16, Math.round(1000 / Math.max(1, props.fps)));
  const timer = scope.setInterval(() => {
    if (!props.loop && frameIndex.value >= frameUrls.value.length - 1) return;
    frameIndex.value = (frameIndex.value + 1) % frameUrls.value.length;
  }, frameDelay);
  scope.onCleanup(() => {
    images.forEach((image) => { image.src = ""; });
    window.clearInterval(timer);
  });
});

watch(staticMode, (reduced) => {
  if (reduced) frameIndex.value = 0;
});

onMounted(() => {
  networkSaveData.value = Boolean(
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
  );
});
</script>

<template>
  <span
    ref="rootRef"
    class="frame-sequence-player"
    :class="{ 'is-active': active, 'is-static': staticMode }"
    aria-hidden="true"
  >
    <img
      v-if="currentFrame"
      class="frame-sequence-player__frame"
      :src="currentFrame"
      :alt="alt"
      draggable="false"
      decoding="async"
    />
  </span>
</template>

<style scoped>
.frame-sequence-player {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.frame-sequence-player__frame {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
}
</style>
