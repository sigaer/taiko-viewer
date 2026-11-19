<script setup lang="ts">
import { ref } from "vue";
import DsSampleShell from "../_shared/DsSampleShell.vue";
import DsSampleBlock from "../_shared/DsSampleBlock.vue";

defineOptions({ name: "DsSampleDiffTabs" });

const four = [
  { difficulty: 1, star: 3, constant: null },
  { difficulty: 2, star: 5, constant: null },
  { difficulty: 3, star: 7, constant: 6.85 },
  { difficulty: 4, star: 10, constant: 10.42 }
];
const five = [...four, { difficulty: 5, star: 10, constant: 9.6 }];
const pickFour = ref<number | string>(4);
const pickFive = ref<number | string>(5);
</script>

<template>
  <DsSampleShell title="diff-tabs">
    <DsSampleBlock name="4 charts">
      <div class="ds-s-wide" data-testid="difftabs-4">
        <DsDiffTabs v-model="pickFour" :charts="four" class="ds-s-tabs" />
        <output class="ds-s-out" data-testid="difftabs-4-value">{{ pickFour }}</output>
      </div>
    </DsSampleBlock>
    <DsSampleBlock name="5 charts">
      <div class="ds-s-wide" data-testid="difftabs-5">
        <DsDiffTabs v-model="pickFive" :charts="five" class="ds-s-tabs" />
        <output class="ds-s-out" data-testid="difftabs-5-value">{{ pickFive }}</output>
      </div>
    </DsSampleBlock>
  </DsSampleShell>
</template>

<style scoped>
.ds-s-wide {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  width: 100%;
  min-width: 0;
}
/* The sample blocks sit on --surface, so the edge fades use it */
.ds-s-tabs {
  --ds-difftabs-fade: var(--surface);
}
.ds-s-out {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
</style>
