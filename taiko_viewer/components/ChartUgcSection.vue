<script setup lang="ts">
import { computed } from "vue";
import type { ChartDifficultyVoteValue, ChartUgcSummary } from "~/types/ugc";

const props = defineProps<{
  summary: ChartUgcSummary;
  difficultyLabel: string;
}>();

const { t } = useI18n();
const bucketValues = [-2, -1, 0, 1, 2] as const satisfies readonly ChartDifficultyVoteValue[];
const distributionRows = computed(() => {
  const count = props.summary.difficulty.count;
  return bucketValues
    .map((value) => ({
      value,
      count: props.summary.difficulty.distribution[String(value) as keyof ChartUgcSummary["difficulty"]["distribution"]],
      percentage: count ? Math.round((props.summary.difficulty.distribution[String(value) as keyof ChartUgcSummary["difficulty"]["distribution"]] / count) * 100) : 0
    }))
    .filter((row) => count >= 3 || row.count > 0);
});
const summaryText = computed(() => t(`ugc.difficulty.summary.${props.summary.difficulty.summary}`));
</script>

<template>
  <section class="chart-ugc-section" aria-labelledby="chart-ugc-title">
    <header class="chart-ugc-head">
      <div>
        <span class="chart-ugc-eyebrow">PLAYER NOTES</span>
        <h3 id="chart-ugc-title">{{ t("ugc.sectionTitle") }}</h3>
      </div>
      <span class="chart-ugc-difficulty">{{ difficultyLabel }}</span>
    </header>

    <div class="chart-ugc-grid">
      <section v-if="summary.difficulty.count" class="ugc-panel" aria-labelledby="chart-ugc-difficulty-title">
        <h4 id="chart-ugc-difficulty-title">{{ t("ugc.difficulty.title") }}</h4>
        <p class="ugc-summary-line">
          <strong>{{ summaryText }}</strong>
          <span>{{ t("ugc.difficulty.count", { count: summary.difficulty.count }) }}</span>
          <span v-if="summary.difficulty.verifiedCount">
            {{ t("ugc.difficulty.verifiedCount", { count: summary.difficulty.verifiedCount }) }}
          </span>
        </p>
        <ul class="ugc-distribution" :aria-label="t('ugc.difficulty.distributionLabel')">
          <li v-for="row in distributionRows" :key="row.value">
            <span class="ugc-distribution__label">{{ t(`ugc.difficulty.buckets.${row.value}`) }}</span>
            <span class="ugc-distribution__bar" aria-hidden="true">
              <span :style="{ width: `${row.percentage}%` }"></span>
            </span>
            <strong>{{ t("ugc.difficulty.votes", { count: row.count }) }}</strong>
          </li>
        </ul>
      </section>

      <section v-if="summary.tags.length" class="ugc-panel" aria-labelledby="chart-ugc-tags-title">
        <h4 id="chart-ugc-tags-title">{{ t("ugc.tagsTitle") }}</h4>
        <ul class="ugc-tags">
          <li v-for="tag in summary.tags" :key="tag.slug">
            <span>{{ t(tag.labelKey) }}</span>
            <small>{{ t("ugc.tagVotes", { count: tag.count }) }}</small>
          </li>
        </ul>
      </section>

      <section v-if="summary.tips.length" class="ugc-panel ugc-panel--tips" aria-labelledby="chart-ugc-tips-title">
        <h4 id="chart-ugc-tips-title">{{ t("ugc.tipsTitle") }}</h4>
        <div class="ugc-tips">
          <article v-for="tip in summary.tips" :key="tip.tipId" class="ugc-tip">
            <p>{{ tip.body }}</p>
            <footer>
              <span class="ugc-tip__author">
                <img :src="tip.author.avatarUrl" alt="" width="24" height="24" />
                <span>{{ tip.author.isDeleted ? t("ugc.deletedUser") : tip.author.displayName }}</span>
              </span>
              <span v-if="tip.verifiedPlay" class="ugc-tip__verified">{{ t("ugc.verifiedPlay") }}</span>
              <span>{{ t("ugc.helpfulCount", { count: tip.helpfulCount }) }}</span>
            </footer>
          </article>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.chart-ugc-section {
  margin-top: 28px;
  padding-top: 24px;
  border-top: 1px solid rgba(139, 107, 77, 0.2);
}

.chart-ugc-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.chart-ugc-eyebrow {
  color: #9b7459;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.18em;
}

.chart-ugc-head h3 {
  margin: 2px 0 0;
  color: #49382d;
  font-size: 21px;
  line-height: 1.25;
}

.chart-ugc-difficulty {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 5px 10px;
  color: #76533c;
  background: rgba(196, 164, 132, 0.16);
  font-size: 12px;
  font-weight: 750;
}

.chart-ugc-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.ugc-panel {
  min-width: 0;
  border: 1px solid rgba(139, 107, 77, 0.16);
  border-radius: 15px;
  padding: 15px;
  background: rgba(250, 248, 244, 0.82);
}

.ugc-panel--tips {
  grid-column: 1 / -1;
}

.ugc-panel h4 {
  margin: 0 0 11px;
  color: #5a4435;
  font-size: 15px;
}

.ugc-summary-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  margin: 0 0 12px;
  color: #776659;
  font-size: 12px;
}

.ugc-summary-line strong {
  color: #4b382d;
  font-size: 14px;
}

.ugc-distribution,
.ugc-tags {
  margin: 0;
  padding: 0;
  list-style: none;
}

.ugc-distribution {
  display: grid;
  gap: 8px;
}

.ugc-distribution li {
  display: grid;
  grid-template-columns: minmax(72px, auto) minmax(54px, 1fr) auto;
  align-items: center;
  gap: 8px;
  color: #6f5d50;
  font-size: 11px;
}

.ugc-distribution__bar {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(139, 107, 77, 0.12);
}

.ugc-distribution__bar span {
  display: block;
  min-width: 2px;
  height: 100%;
  border-radius: inherit;
  background: #bd7957;
}

.ugc-distribution li strong {
  color: #59483d;
  font-variant-numeric: tabular-nums;
}

.ugc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ugc-tags li {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  border: 1px solid rgba(119, 88, 61, 0.16);
  border-radius: 999px;
  padding: 6px 9px;
  color: #5c4838;
  background: #fff;
  font-size: 12px;
  font-weight: 700;
}

.ugc-tags small {
  color: #8b7767;
  font-size: 10px;
  font-weight: 600;
}

.ugc-tips {
  display: grid;
  gap: 9px;
}

.ugc-tip {
  min-width: 0;
  border-left: 3px solid rgba(189, 121, 87, 0.46);
  padding: 9px 11px;
  background: rgba(255, 255, 255, 0.72);
}

.ugc-tip p {
  margin: 0;
  color: #493a31;
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.ugc-tip footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px 12px;
  margin-top: 8px;
  color: #7b695c;
  font-size: 11px;
}

.ugc-tip__author {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #5d4b3e;
  font-weight: 700;
}

.ugc-tip__author img {
  border-radius: 50%;
  object-fit: cover;
}

.ugc-tip__verified {
  color: #5c7158;
  font-weight: 700;
}

:global(body.theme-dark .chart-ugc-head h3),
:global(body.theme-dark .ugc-panel h4),
:global(body.theme-dark .ugc-summary-line strong),
:global(body.theme-dark .ugc-tip p) {
  color: #f1e6dc;
}

:global(body.theme-dark .ugc-panel) {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.035);
}

:global(body.theme-dark .ugc-tip),
:global(body.theme-dark .ugc-tags li) {
  color: #eadbcf;
  background: rgba(255, 255, 255, 0.055);
}

:global(body.theme-dark .ugc-summary-line),
:global(body.theme-dark .ugc-distribution li),
:global(body.theme-dark .ugc-tip footer),
:global(body.theme-dark .ugc-tip__author),
:global(body.theme-dark .ugc-tags small) {
  color: #cbbbae;
}

@media (max-width: 700px) {
  .chart-ugc-section {
    margin-top: 22px;
    padding-top: 20px;
  }

  .chart-ugc-head {
    align-items: center;
  }

  .chart-ugc-grid {
    grid-template-columns: 1fr;
  }

  .ugc-panel--tips {
    grid-column: auto;
  }

  .ugc-distribution li {
    grid-template-columns: minmax(70px, auto) minmax(40px, 1fr) auto;
  }
}
</style>
