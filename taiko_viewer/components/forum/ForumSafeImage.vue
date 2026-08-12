<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    src: string;
    alt?: string;
    fallbackSrc?: string;
  }>(),
  {
    alt: "",
    fallbackSrc: "/miku.png",
  },
);

const currentSrc = ref(props.src || props.fallbackSrc);

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
</script>

<template>
  <img :src="currentSrc" :alt="alt" loading="lazy" decoding="async" @error="handleError" />
</template>
