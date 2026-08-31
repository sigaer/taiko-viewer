<script setup lang="ts">
import type { CommunityChartActivity } from "~/types/ugc";

const props = defineProps<{ item: CommunityChartActivity }>();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const title = computed(() => locale.value === "ja" && props.item.songTitleJp ? props.item.songTitleJp : props.item.songTitle);
const difficultyLabel = computed(() => t(`difficulty.${props.item.difficulty}`));
const summaryLabel = computed(() => props.item.difficultySummary ? t(`ugc.difficulty.summary.${props.item.difficultySummary}`) : "");
const tagLabel = (labelKey: string) => t(labelKey);
</script>

<template>
  <NuxtLink :to="localePath(item.href)" class="chart-activity-card">
    <img :src="item.cover" :alt="title" loading="lazy" />
    <div class="chart-activity-card__body">
      <div class="chart-activity-card__heading">
        <strong>{{ title }}</strong>
        <span>{{ difficultyLabel }}<template v-if="item.level"> · {{ item.level }}{{ t("guide.starSuffix") }}</template></span>
      </div>
      <div class="chart-activity-card__signals">
        <span v-if="summaryLabel" class="signal signal--summary">{{ summaryLabel }}</span>
        <span v-for="tag in item.tags" :key="tag.slug" class="signal">#{{ tagLabel(tag.labelKey) }}</span>
      </div>
      <p v-if="item.tipPreview" class="chart-activity-card__tip">“{{ item.tipPreview.body }}”</p>
      <div class="chart-activity-card__footer">
        <span>{{ t("community.chartActivity.participants", { count: item.participantCount }) }}</span>
        <span>{{ t("community.chartActivity.viewChart") }}</span>
      </div>
    </div>
  </NuxtLink>
</template>

<style scoped>
.chart-activity-card { display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 12px; padding: 12px; border: 1px solid var(--viewer-border); border-radius: 14px; color: var(--viewer-text); background: var(--viewer-surface); text-decoration: none; transition: border-color .18s ease, transform .18s ease; }
.chart-activity-card:hover, .chart-activity-card:focus-visible { border-color: var(--viewer-accent-strong); transform: translateY(-1px); }
.chart-activity-card > img { width: 76px; height: 76px; border-radius: 10px; object-fit: cover; background: var(--viewer-border); }
.chart-activity-card__body { min-width: 0; display: grid; gap: 6px; align-content: center; }
.chart-activity-card__heading { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.chart-activity-card__heading strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; }
.chart-activity-card__heading span, .chart-activity-card__footer { color: var(--viewer-text-muted); font-size: 12px; }
.chart-activity-card__signals { display: flex; flex-wrap: wrap; gap: 5px; }
.signal { padding: 2px 7px; border-radius: 999px; color: var(--viewer-text-muted); background: color-mix(in srgb, var(--viewer-border) 55%, transparent); font-size: 11px; }
.signal--summary { color: var(--viewer-accent-strong); background: color-mix(in srgb, var(--viewer-accent-strong) 12%, transparent); font-weight: 700; }
.chart-activity-card__tip { overflow: hidden; display: -webkit-box; margin: 0; color: var(--viewer-text); font-size: 12px; line-height: 1.45; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }
.chart-activity-card__footer { display: flex; justify-content: space-between; gap: 8px; }
@media (max-width: 560px) { .chart-activity-card { grid-template-columns: 64px minmax(0, 1fr); } .chart-activity-card > img { width: 64px; height: 64px; } .chart-activity-card__heading { display: grid; gap: 2px; } }
</style>
