<script setup lang="ts">
import DsSampleShell from "../_shared/DsSampleShell.vue";
import DsSampleBlock from "../_shared/DsSampleBlock.vue";

defineOptions({ name: "DsSampleRank" });

const values = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const variants = ["default", "detail", "compact", "table"] as const;
const upgrades: Array<[number, number]> = [
  [2, 3],
  [4, 5],
  [5, 7],
  [7, 8],
  [1, 2],
  [0, 4]
];
</script>

<template>
  <DsSampleShell title="rank">
    <DsSampleBlock v-for="variant in variants" :key="variant" :name="`${variant} · 0–8`">
      <div class="ds-s-row" :data-testid="`rank-${variant}`">
        <span v-for="value in values" :key="value" class="ds-s-item">
          <DsRank :value="value" :variant="variant" />
          <code>{{ value }}</code>
        </span>
      </div>
    </DsSampleBlock>
    <DsSampleBlock name="upgrade · previous → new">
      <div class="ds-s-row" data-testid="rank-upgrade">
        <span v-for="[from, to] in upgrades" :key="`${from}-${to}`" class="ds-s-item">
          <DsRank :value="to" :previous="from" variant="upgrade" />
          <code>{{ from }} → {{ to }}</code>
        </span>
      </div>
    </DsSampleBlock>
    <DsSampleBlock name="slotPx 20 (under 24: name only)">
      <div class="ds-s-row" data-testid="rank-text-only">
        <span v-for="value in values" :key="value" class="ds-s-item">
          <DsRank :value="value" :slot-px="20" />
          <code>{{ value }}</code>
        </span>
      </div>
    </DsSampleBlock>
    <DsSampleBlock name="string input / out of range">
      <div class="ds-s-row" data-testid="rank-input">
        <span class="ds-s-item"><DsRank value="6" /><code>"6"</code></span>
        <span class="ds-s-item"><DsRank :value="null" /><code>null</code></span>
        <span class="ds-s-item"><DsRank :value="9" /><code>9</code></span>
      </div>
    </DsSampleBlock>
  </DsSampleShell>
</template>

<style scoped>
.ds-s-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--sp-4) var(--sp-5);
  width: 100%;
}
.ds-s-item {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  min-width: 48px;
}
code {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
</style>
