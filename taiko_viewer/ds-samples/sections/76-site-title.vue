<script setup lang="ts">
import DsSampleShell from "../_shared/DsSampleShell.vue";
import DsSampleBlock from "../_shared/DsSampleBlock.vue";
import data from "../data/atoms.json";

defineOptions({ name: "DsSampleSiteTitle" });

const plate = data.plates.find((p) => p.plate === 60)!;
</script>

<template>
  <DsSampleShell title="site-title">
    <DsSampleBlock name="site title">
      <div data-testid="site-title-alone"><DsSiteTitle :name="data.siteTitle" /></div>
    </DsSampleBlock>
    <DsSampleBlock name="with plate · wide / narrow (wraps)">
      <div class="ds-s-identity" data-testid="site-title-wide">
        <DsTitlePlate :name="plate.name" :plate="plate.plate" lang="ja" />
        <DsSiteTitle :name="data.siteTitle" />
      </div>
      <div class="ds-s-identity ds-s-narrow" data-testid="site-title-narrow">
        <DsTitlePlate :name="plate.name" :plate="plate.plate" lang="ja" />
        <DsSiteTitle :name="data.siteTitle" />
      </div>
    </DsSampleBlock>
    <DsSampleBlock name="with text form">
      <div class="ds-s-identity" data-testid="site-title-text">
        <DsTitlePlate :name="plate.name" :plate="plate.plate" form="text" lang="ja" />
        <DsSiteTitle :name="data.siteTitle" />
      </div>
    </DsSampleBlock>
  </DsSampleShell>
</template>

<style scoped>
/* The identity row of a profile band: plate and site title side by side, the site title wrapping when narrow. */
.ds-s-identity {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  width: 100%;
  min-width: 0;
}
.ds-s-narrow {
  width: 260px;
  padding: var(--sp-2);
  outline: 1px dashed var(--line);
}
</style>
