<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import AnnualArtworkFallback from './AnnualArtworkFallback.vue';
import { ANNUAL_DEFAULT_COVER, resolveAnnualCover } from '~/utils/annualCover';
const props = withDefaults(defineProps<{ src?: string | null; alt?: string }>(), { src: '', alt: '' });
const source = ref(resolveAnnualCover({ coverUrl: props.src }));
const ready = ref(false);
const imageRef = ref<HTMLImageElement | null>(null);
onMounted(() => { if (imageRef.value?.complete && imageRef.value.naturalWidth > 0) ready.value = true; });
const terminal = ref(false);
watch(() => props.src, () => { source.value = resolveAnnualCover({ coverUrl: props.src }); ready.value = false; terminal.value = false; });
const failed = () => {
  ready.value = false;
  if (source.value !== ANNUAL_DEFAULT_COVER) source.value = ANNUAL_DEFAULT_COVER;
  else terminal.value = true;
};
</script>
<template>
  <span class="annual-cover" :data-cover-state="terminal ? 'fallback' : ready ? 'loaded' : 'loading'">
    <AnnualArtworkFallback v-if="!ready" :label="alt" mark="♪" />
    <img ref="imageRef" v-if="!terminal" :key="source" :src="source" :alt="alt" loading="eager" decoding="async" :style="{ opacity: ready ? 1 : 0 }" @load="ready = true" @error="failed">
  </span>
</template>
<style scoped>
.annual-cover{position:relative;display:block;width:100%;height:100%;overflow:hidden;background:#e5f1fb}.annual-cover>img,.annual-cover>:deep(.annual-artwork-fallback){position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
</style>
