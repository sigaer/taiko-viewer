<script setup lang="ts">
// Chart image excerpt of the song detail page (was components/song/SongChartPreview.vue; the heading and the
// actions moved to the page). The image is /api/content/songs/:id/chart-image for the difficulty and side. A fixed
// excerpt window starts at the notation, not the duplicate image title; expanding shows the unshifted original.
// No pixels or chart data are changed.
import { nextTick, onMounted, ref, watch } from "vue";

const props = defineProps<{ songId: number; songTitle: string; difficulty: number; side?: string; label: string; star: string }>();
const { t } = useI18n();
const url = computed(() => chartImageUrl(props.songId, props.difficulty, props.side));
const loaded = ref(false);
const failed = ref(false);
const expanded = ref(false);
const imageElement = ref<HTMLImageElement | null>(null);
const resolveCachedImage = () => {
  if (!imageElement.value?.complete) return;
  loaded.value = imageElement.value.naturalWidth > 0;
  failed.value = !loaded.value;
};
// A cached SSR image can finish before hydration installs the load listener.
onMounted(resolveCachedImage);
watch(url, async () => {
  loaded.value = false;
  failed.value = false;
  expanded.value = false;
  await nextTick();
  resolveCachedImage();
});
</script>

<script lang="ts">
/** Same address the page links to as "full chart". */
export const chartImageUrl = (songId: number, difficulty: number, side?: string) =>
  `/api/content/songs/${songId}/chart-image?difficulty=${difficulty}&side=${side || "single"}`;
</script>

<template>
  <div class="sheet-wrap">
    <div class="sheet-head">
      <span>{{ t("rework.songDetail.chart.excerpt") }}</span>
      <button type="button" class="rw-btn rw-btn--ghost rw-btn--sm sheet-toggle" :aria-expanded="expanded" :aria-controls="`chart-sheet-${songId}`" @click="expanded = !expanded">
        {{ expanded ? t("rework.songDetail.chart.collapse") : t("rework.songDetail.chart.expand") }}
      </button>
    </div>
    <div
      :id="`chart-sheet-${songId}`"
      :key="url"
      class="sheet"
      :class="{ 'is-expanded': expanded }"
      tabindex="0"
      role="region"
      :aria-label="t('rework.songDetail.chart.region')"
      :aria-busy="!loaded && !failed"
    >
      <p v-if="!loaded && !failed" class="sheet-state" role="status">{{ t("rework.songDetail.chart.loading") }}</p>
      <p v-if="failed" class="sheet-state" role="status">{{ t("rework.songDetail.chart.failed") }}</p>
      <a v-show="!failed" :href="url" target="_blank" rel="noopener noreferrer" :aria-label="t('rework.songDetail.chart.openNew')">
        <img ref="imageElement" :src="url" :alt="`${songTitle} · ${label} ${star}`" decoding="async" loading="eager" @load="loaded = true" @error="failed = true" />
      </a>
    </div>
  </div>
</template>

<style scoped>
.sheet-wrap {
  min-width: 0;
}
.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-4);
  font-size: var(--fs-13);
  color: var(--ink-3);
}
.sheet {
  position: relative;
  height: 320px;
  overflow-x: auto;
  overflow-y: hidden;
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
  background: var(--surface);
  scrollbar-color: var(--ctl-border) var(--bg-sunk);
}
.sheet.is-expanded {
  height: 560px;
  overflow-y: auto;
}
.sheet a {
  display: block;
  min-width: 680px;
}
.sheet img {
  display: block;
  width: 100%;
  height: auto;
}
.sheet:not(.is-expanded) a {
  position: relative;
  top: -64px;
}
.sheet-state {
  position: sticky;
  left: 0;
  top: 0;
  margin: 0;
  padding: var(--sp-5);
  font-size: var(--fs-14);
  background: var(--surface);
  color: var(--ink-2);
}
.sheet:focus-visible,
.sheet a:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}
@media (max-width: 767px) {
  .sheet {
    height: 168px;
  }
  .sheet.is-expanded {
    height: 560px;
  }
  .sheet:not(.is-expanded) a {
    top: -56px;
  }
}
</style>
