<script setup lang="ts">
import DsSampleShell from "../_shared/DsSampleShell.vue";
import DsSampleBlock from "../_shared/DsSampleBlock.vue";

defineOptions({ name: "DsSampleDiff" });

const charts = [
  { difficulty: 1, star: 3, constant: null },
  { difficulty: 2, star: 5, constant: null },
  { difficulty: 3, star: 7, constant: 6.85 },
  { difficulty: 4, star: 10, constant: 10.42 },
  { difficulty: 5, star: 10, constant: 9.6 }
];
const sizes = ["md", "lg"] as const;
</script>

<template>
  <DsSampleShell title="diff">
    <template v-for="size in sizes" :key="size">
      <DsSampleBlock :name="`${size} · 1–5 · constant`">
        <div class="ds-s-row" :data-testid="`diff-${size}-constant`">
          <DsDiff v-for="c in charts" :key="c.difficulty" :difficulty="c.difficulty" :star="c.star" :constant="c.constant ?? 8.5" :size="size" />
        </div>
      </DsSampleBlock>
      <DsSampleBlock :name="`${size} · 1–5 · no constant`">
        <div class="ds-s-row" :data-testid="`diff-${size}-none`">
          <DsDiff v-for="c in charts" :key="c.difficulty" :difficulty="c.difficulty" :star="c.star" :size="size" />
        </div>
      </DsSampleBlock>
    </template>
    <DsSampleBlock name="star as string / star missing / constant as string">
      <div class="ds-s-row" data-testid="diff-input">
        <DsDiff difficulty="4" star="9" />
        <DsDiff :difficulty="3" :star="null" />
        <DsDiff :difficulty="4" :star="8" constant="8.10" />
        <DsDiff :difficulty="5" star="" size="lg" />
      </div>
    </DsSampleBlock>
  </DsSampleShell>
</template>

<style scoped>
.ds-s-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3);
  width: 100%;
}
</style>
