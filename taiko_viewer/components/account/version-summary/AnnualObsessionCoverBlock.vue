<script setup lang="ts">
import AnnualArtworkFallback from "./AnnualArtworkFallback.vue";

defineProps<{
  coverUrl: string;
  songName: string;
}>();
</script>

<template>
  <div class="annual-obsession-cover">
    <el-image
      v-if="coverUrl"
      class="annual-obsession-cover__image"
      :src="coverUrl"
      :alt="songName"
      fit="cover"
    >
      <template #error>
        <AnnualArtworkFallback label="歌曲封面" />
      </template>
    </el-image>
    <AnnualArtworkFallback v-else label="歌曲封面" />
  </div>
</template>

<style scoped>
.annual-obsession-cover {
  position: relative;
  width: var(--obsession-cover-size, clamp(104px, 29vw, 124px));
  aspect-ratio: 1;
  overflow: hidden;
  border: clamp(4px, 1.2vw, 6px) solid #245f36;
  border-radius: 14%;
  background: #dce9bd;
  box-shadow:
    0 9px 20px rgba(13, 46, 24, 0.34),
    0 0 0 1px rgba(255, 255, 255, 0.2) inset;
}

.annual-obsession-cover__image,
.annual-obsession-cover :deep(.el-image),
.annual-obsession-cover :deep(.el-image__wrapper),
.annual-obsession-cover :deep(.el-image__inner),
.annual-obsession-cover :deep(img),
.annual-obsession-cover :deep(.annual-artwork-fallback) {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
}

.annual-obsession-cover__image {
  border-radius: 1%;
}
</style>
