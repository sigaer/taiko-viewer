<script setup lang="ts">
// Reason of a target recommendation: current and target score, the gap, the recommendation index and the
// progress towards the target — the fields of /api/account/recommendation/target, as they are.
import { computed, type PropType } from "vue";
import type { TargetRecommendationItem } from "~/types/recommendation-intelligence";
import { progressShare } from "~/utils/rework/scores";

const props = defineProps({
  item: { type: Object as PropType<TargetRecommendationItem>, required: true },
  targetLabel: { type: String, required: true },
  gap: { type: String, required: true }
});
const { t, locale } = useI18n();
const number = computed(() => new Intl.NumberFormat(locale.value));
const share = computed(() => progressShare(props.item.progressPercent));
</script>

<template>
  <div class="tp">
    <dl class="tp-facts">
      <div><dt>{{ t("rework.recommendTool.current") }}</dt><dd class="num">{{ item.currentScore === null ? t("rework.recommendTool.unplayed") : number.format(item.currentScore) }}</dd></div>
      <div><dt>{{ t("rework.recommendTool.targetScore") }}</dt><dd class="num">{{ item.targetScore === null ? targetLabel : number.format(item.targetScore) }}</dd></div>
      <div><dt>{{ t("rework.recommendTool.gap") }}</dt><dd class="num">{{ gap }}</dd></div>
      <div><dt>{{ t("rework.recommendTool.index") }}</dt><dd class="num">{{ item.targetRecommendationIndex.toFixed(1) }}</dd></div>
    </dl>
    <div class="tp-bar">
      <span class="tp-track" aria-hidden="true"><i :style="{ width: `${share}%` }" /></span>
      <span class="tp-pct">{{ t("rework.recommendTool.progress") }} <b class="num">{{ item.progressPercent.toFixed(1) }}%</b></span>
    </div>
  </div>
</template>

<style scoped>
.tp {
  display: grid;
  gap: var(--sp-2);
}
.tp-facts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-1) var(--sp-5);
  margin: 0;
}
.tp-facts > div {
  display: flex;
  flex-direction: column-reverse;
  min-width: 0;
}
.tp-facts dt {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.tp-facts dd {
  margin: 0;
  font-size: var(--fs-14);
  color: var(--ink);
}
.tp-bar {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}
.tp-track {
  flex: 0 1 220px;
  height: 6px;
  border-radius: 3px;
  background: var(--bg-sunk);
  overflow: hidden;
}
.tp-track i {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: var(--series);
}
.tp-pct {
  font-size: var(--fs-12);
  color: var(--ink-3);
  white-space: nowrap;
}
.tp-pct b {
  font-size: var(--fs-14);
  color: var(--ink);
}
</style>
