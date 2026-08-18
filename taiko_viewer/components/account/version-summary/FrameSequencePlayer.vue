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
  const frameDelay = 1000 / Math.max(1, props.fps);
  let animationFrame = 0;
  let lastTimestamp = 0;
  let cancelled = false;
  const advance = (timestamp: number) => {
    if (cancelled) return;
    if (!lastTimestamp) lastTimestamp = timestamp;
    const elapsed = timestamp - lastTimestamp;
    if (elapsed >= frameDelay) {
      const frameStep = Math.max(1, Math.floor(elapsed / frameDelay));
      if (props.loop) {
        frameIndex.value = (frameIndex.value + frameStep) % frameUrls.value.length;
      } else {
        frameIndex.value = Math.min(frameUrls.value.length - 1, frameIndex.value + frameStep);
      }
      lastTimestamp += frameStep * frameDelay;
    }
    animationFrame = window.requestAnimationFrame(advance);
  };
  const decoded = images.map((image) => (
    typeof image.decode === "function" ? image.decode().catch(() => undefined) : Promise.resolve()
  ));
  void Promise.all(decoded).then(() => {
    if (!cancelled) animationFrame = window.requestAnimationFrame(advance);
  });
  scope.onCleanup(() => {
    cancelled = true;
    window.cancelAnimationFrame(animationFrame);
    images.forEach((image) => { image.src = ""; });
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
  transform: translateZ(0);
}
</style>
