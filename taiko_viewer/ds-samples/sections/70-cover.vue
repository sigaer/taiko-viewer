<script setup lang="ts">
import { ref } from "vue";
import DsSampleShell from "../_shared/DsSampleShell.vue";
import DsSampleBlock from "../_shared/DsSampleBlock.vue";
import data from "../data/atoms.json";

defineOptions({ name: "DsSampleCover" });

const sizes = ["sm", "md", "lg", "tile", "xl"] as const;
const swapped = ref(false);
</script>

<template>
  <DsSampleShell title="cover">
    <DsSampleBlock name="loaded · sm / md / lg / tile / xl">
      <figure v-for="size in sizes" :key="size" class="ds-s-cell" :data-testid="`cover-ok-${size}`">
        <DsCover :song-id="data.songs.cover" :size="size" />
        <figcaption>{{ size }}</figcaption>
      </figure>
    </DsSampleBlock>
    <DsSampleBlock name="priority · xl">
      <figure class="ds-s-cell" data-testid="cover-priority">
        <DsCover :song-id="data.songs.alt" size="xl" priority />
        <figcaption>priority</figcaption>
      </figure>
    </DsSampleBlock>
    <DsSampleBlock name="fill">
      <div class="ds-s-fill" data-testid="cover-fill"><DsCover :song-id="data.songs.cover" size="fill" /></div>
      <div class="ds-s-fill" data-testid="cover-fill-missing"><DsCover :song-id="data.songs.missing" size="fill" /></div>
    </DsSampleBlock>
    <DsSampleBlock name="missing (thumbnail → original → placeholder) · sm / md / lg / tile / xl">
      <figure v-for="size in sizes" :key="size" class="ds-s-cell" :data-testid="`cover-missing-${size}`">
        <DsCover :song-id="data.songs.missing" :size="size" />
        <figcaption>{{ size }}</figcaption>
      </figure>
    </DsSampleBlock>
    <DsSampleBlock name="no id">
      <figure class="ds-s-cell" data-testid="cover-none">
        <DsCover :song-id="null" size="lg" />
        <figcaption>null</figcaption>
      </figure>
    </DsSampleBlock>
    <DsSampleBlock name="song change">
      <figure class="ds-s-cell" data-testid="cover-swap">
        <DsCover :song-id="swapped ? data.songs.alt : data.songs.cover" size="tile" />
        <figcaption><el-button size="small" data-testid="cover-swap-btn" @click="swapped = !swapped">swap</el-button></figcaption>
      </figure>
    </DsSampleBlock>
    <div class="ds-s-spacer" aria-hidden="true" />
    <DsSampleBlock name="lazy (below the fold)">
      <figure v-for="size in sizes" :key="size" class="ds-s-cell" :data-testid="`cover-lazy-${size}`">
        <DsCover :song-id="data.songs.alt" :size="size" />
        <figcaption>{{ size }}</figcaption>
      </figure>
    </DsSampleBlock>
  </DsSampleShell>
</template>

<style scoped>
.ds-s-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  margin: 0;
}
.ds-s-cell figcaption {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.ds-s-fill {
  width: 240px;
  max-width: 100%;
}
.ds-s-spacer {
  height: 150vh;
}
</style>
