<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    src: string;
    alt?: string;
    fallbackSrc?: string;
    priority?: boolean;
  }>(),
  {
    alt: "",
    fallbackSrc: "/optimized/guide-miku-160.webp",
    priority: false,
  },
);

const currentSrc = ref(props.src || props.fallbackSrc);
const imageElement = ref<HTMLImageElement | null>(null);
const shouldLoad = ref(props.priority);
let visibilityObserver: IntersectionObserver | null = null;

watch(
  () => props.src,
  (value) => {
    currentSrc.value = value || props.fallbackSrc;
  },
  { immediate: true },
);

const handleError = () => {
  if (currentSrc.value !== props.fallbackSrc) {
    currentSrc.value = props.fallbackSrc;
  }
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
  }, { rootMargin: "180px 0px" });
  if (imageElement.value) visibilityObserver.observe(imageElement.value);
});

onBeforeUnmount(() => visibilityObserver?.disconnect());
</script>

<template>
  <img
    ref="imageElement"
    :src="shouldLoad ? currentSrc : undefined"
    :alt="alt"
    :loading="priority ? 'eager' : 'lazy'"
    :fetchpriority="priority ? 'high' : 'low'"
    decoding="async"
    @error="handleError"
  />
</template>
