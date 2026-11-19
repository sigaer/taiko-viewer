<script setup lang="ts">
import DsSampleShell from "../_shared/DsSampleShell.vue";
import DsSampleBlock from "../_shared/DsSampleBlock.vue";
import { DS_CROWN_STATES } from "~/utils/ds/crown";

defineOptions({ name: "DsSampleCrown" });

const sizes = ["chip", "table", "sm", "md", "lg", "xl"] as const;
const texts = ["off", "short", "full"] as const;
</script>

<template>
  <DsSampleShell title="crown">
    <DsSampleBlock v-for="size in sizes" :key="size" :name="`${size} · dondaful / full / clear / played / none`">
      <div class="ds-s-row" :data-testid="`crown-${size}`">
        <span v-for="state in DS_CROWN_STATES" :key="state" class="ds-s-item">
          <DsCrown :state="state" :size="size" />
          <code>{{ state }}</code>
        </span>
      </div>
    </DsSampleBlock>
    <DsSampleBlock v-for="text in texts" :key="text" :name="`text: ${text} · sm / md / lg`">
      <div v-for="size in ['sm', 'md', 'lg'] as const" :key="size" class="ds-s-row" :data-testid="`crown-text-${text}-${size}`">
        <code class="ds-s-size">{{ size }}</code>
        <DsCrown v-for="state in DS_CROWN_STATES" :key="state" :state="state" :size="size" :text="text" />
      </div>
    </DsSampleBlock>
  </DsSampleShell>
</template>

<style scoped>
.ds-s-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-4) var(--sp-6);
  width: 100%;
}
.ds-s-item {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  min-width: 64px;
}
code {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.ds-s-size {
  width: 24px;
}
</style>
