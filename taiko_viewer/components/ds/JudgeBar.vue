<script setup lang="ts">
// Judge bar: 良 / 可 / 不可 (P0-15; 04 §8, §9; 19 G3). A 6px bar (--judge-h) with the legend — name and number —
// under it, so the counts never depend on colour. "Good" is the softened data vermilion (--judge-good = --don-data).
// A zero count draws no segment; all zero (or no counts) leaves the empty track. Missing counts print "—".
import { formatCount, judgeParts } from "~/utils/ds/charts";

const props = defineProps<{
  good: number | null | undefined;
  ok: number | null | undefined;
  ng: number | null | undefined;
}>();

const { t } = useI18n();
const judged = computed(() => judgeParts({ good: props.good, ok: props.ok, ng: props.ng }));
</script>

<template>
  <div class="ds-judge" role="group" :aria-label="t('ds.judgeBar.name')" :data-total="judged.total">
    <div class="ds-judge__bar" aria-hidden="true">
      <template v-for="p in judged.parts" :key="p.key">
        <i v-if="p.share > 0" class="ds-judge__seg" :class="`ds-judge__seg--${p.key}`" :style="{ flexGrow: p.share }" />
      </template>
    </div>
    <dl class="ds-judge__legend">
      <div v-for="p in judged.parts" :key="p.key" class="ds-judge__item">
        <dt>{{ t(`ds.judgeBar.${p.key}`) }}</dt>
        <dd class="num">{{ formatCount(p.count) }}</dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.ds-judge {
  display: grid;
  gap: var(--sp-2);
  min-inline-size: 0;
}
.ds-judge__bar {
  display: flex;
  block-size: var(--judge-h);
  border-radius: var(--r-xs);
  overflow: hidden;
  background: var(--bg-sunk);
}
.ds-judge__seg {
  display: block;
  flex-basis: 0;
  /* a non-zero count stays visible next to a large one (e.g. 1 不可 against 1,500 良) */
  min-inline-size: 2px;
  block-size: 100%;
}
.ds-judge__seg--good {
  background: var(--judge-good);
}
.ds-judge__seg--ok {
  background: var(--judge-ok);
}
.ds-judge__seg--ng {
  background: var(--judge-ng);
}
.ds-judge__legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-1) var(--sp-4);
  margin: 0;
  font-size: var(--fs-12);
  line-height: var(--lh-snug);
  color: var(--ink-2);
}
.ds-judge__item {
  display: inline-flex;
  align-items: baseline;
  gap: var(--sp-1);
}
.ds-judge__item dt,
.ds-judge__item dd {
  margin: 0;
}
.ds-judge__item dd {
  font-size: var(--fs-16);
  font-weight: 700;
  color: var(--ink);
}
</style>
