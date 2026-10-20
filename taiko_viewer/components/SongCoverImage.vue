<script setup lang="ts">
import {
  buildSongCoverOriginalUrl,
  buildSongCoverThumbnailSrcset
} from "~/utils/songCover";

const props = withDefaults(
  defineProps<{
    songId: number;
    alt?: string;
    sizes?: string;
    priority?: boolean;
    fit?: "cover" | "contain";
    fallbackSongId?: number;
  }>(),
  {
    alt: "",
    sizes: "200px",
    priority: false,
    fit: "cover",
    fallbackSongId: 1384
  }
);

const emit = defineEmits<{ error: [event: Event] }>();
const pictureElement = ref<HTMLElement | null>(null);
const webpFailed = ref(false);
const originalFailed = ref(false);
const placeholder = ref(false);
const retryVersion = ref('');
const shouldLoad = ref(props.priority);
let visibilityObserver: IntersectionObserver | null = null;
const activeSongId = computed(() => originalFailed.value ? props.fallbackSongId : props.songId);
const webpSrcset = computed(() => buildSongCoverThumbnailSrcset(activeSongId.value));
const originalSrc = computed(() => buildSongCoverOriginalUrl(activeSongId.value) +
  (retryVersion.value ? `?v=${retryVersion.value}` : ''));

watch(() => [props.songId, props.fallbackSongId], () => {
  webpFailed.value = false;
  originalFailed.value = false;
  placeholder.value = false;
  retryVersion.value = '';
});

const handleError = (event: Event) => {
  if (!webpFailed.value) {
    // Bypass an earlier negative edge/browser cache after a new Bot upload.
    retryVersion.value = String(Math.floor(Date.now() / 300000));
    webpFailed.value = true;
    return;
  }
  if (!originalFailed.value && props.songId !== props.fallbackSongId) {
    originalFailed.value = true;
    return;
  }
  placeholder.value = true;
  emit("error", event);
};

onMounted(() => {
  if (shouldLoad.value) return;
  if (!("IntersectionObserver" in window)) {
    shouldLoad.value = true;
    return;
  }

  visibilityObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    shouldLoad.value = true;
    visibilityObserver?.disconnect();
    visibilityObserver = null;
  }, { rootMargin: "320px 0px" });

  if (pictureElement.value) visibilityObserver.observe(pictureElement.value);
});

onBeforeUnmount(() => visibilityObserver?.disconnect());
</script>

<template>
  <picture ref="pictureElement" class="song-cover-picture">
    <source v-if="shouldLoad && !webpFailed && !placeholder" type="image/webp" :srcset="webpSrcset" :sizes="sizes" />
    <img
      v-if="!placeholder"
      :src="shouldLoad ? originalSrc : undefined"
      :alt="alt"
      width="400"
      height="400"
      :loading="priority ? 'eager' : 'lazy'"
      :fetchpriority="priority ? 'high' : 'low'"
      decoding="async"
      :style="{ objectFit: fit }"
      @error="handleError"
    />
  </picture>
</template>

<style scoped>
.song-cover-picture,
.song-cover-picture img {
  display: block;
  width: 100%;
  height: 100%;
}

.song-cover-picture {
  background:var(--el-fill-color-light, #f5f7fa);
}
</style>
