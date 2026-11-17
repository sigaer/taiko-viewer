<script setup lang="ts">
import DsSampleShell from "../_shared/DsSampleShell.vue";
import DsSampleBlock from "../_shared/DsSampleBlock.vue";
import data from "../data/atoms.json";

defineOptions({ name: "DsSampleTitlePlate" });

const forms = ["plate", "text"] as const;
</script>

<template>
  <DsSampleShell title="title-plate">
    <template v-for="form in forms" :key="form">
      <DsSampleBlock :name="`${form} · slices 0 / 1 / 2 / 41 / 42 / 43 / 59 / 60 / 61`">
        <div class="ds-s-grid" :data-testid="`title-${form}-slices`">
          <span v-for="p in data.plates" :key="p.plate" class="ds-s-item">
            <DsTitlePlate :name="p.name" :plate="p.plate" :form="form" lang="ja" />
            <code>{{ p.plate }}</code>
          </span>
        </div>
      </DsSampleBlock>
      <DsSampleBlock :name="`${form} · custom silver / gold / rainbow`">
        <div class="ds-s-grid" :data-testid="`title-${form}-custom`">
          <span v-for="p in data.customPlates" :key="p.plateStyle" class="ds-s-item">
            <DsTitlePlate :name="p.name" :plate-style="p.plateStyle" :form="form" lang="zh-CN" />
            <code>{{ p.plateStyle }}</code>
          </span>
        </div>
      </DsSampleBlock>
      <DsSampleBlock :name="`${form} · no plate / unmapped plate / long / none`">
        <div class="ds-s-grid" :data-testid="`title-${form}-edge`">
          <span class="ds-s-item">
            <DsTitlePlate :name="data.noPlate.name" :plate="data.noPlate.plate" :form="form" lang="ja" />
            <code>no plate</code>
          </span>
          <span class="ds-s-item">
            <DsTitlePlate :name="data.unmappedPlate.name" :plate="data.unmappedPlate.plate" :form="form" lang="ja" />
            <code>plate {{ data.unmappedPlate.plate }}</code>
          </span>
          <span v-for="p in data.longTitles" :key="p.name" class="ds-s-item ds-s-narrow">
            <DsTitlePlate :name="p.name" :plate="p.plate" :form="form" lang="ja" />
            <code>long · {{ p.plate }}</code>
          </span>
          <span class="ds-s-item">
            <DsTitlePlate :name="null" :plate="2" :form="form" />
            <code>none</code>
          </span>
        </div>
      </DsSampleBlock>
    </template>
  </DsSampleShell>
</template>

<style scoped>
.ds-s-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(232px, 1fr));
  gap: var(--sp-4);
  width: 100%;
}
.ds-s-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--sp-2);
  min-width: 0;
}
.ds-s-narrow {
  max-width: 220px;
}
code {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
</style>
