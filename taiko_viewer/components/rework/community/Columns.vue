<script setup lang="ts">
// ReworkCommunityColumns — the frame of the community lists: sections | threads | side.
//   ≥ 1240  three columns (sections 200 px, threads, side 300 px)
//   1100–1239  sections | threads; the side content follows the threads
//   < 1100  one column: the sections as a chip row above the threads, the side content after them
defineProps({ hasSide: { type: Boolean, default: false } });
</script>

<template>
  <div class="cc3" :class="{ 'has-side': hasSide }">
    <div class="cc3__boards"><slot name="boards" /></div>
    <div class="cc3__main"><slot /></div>
    <div v-if="hasSide" class="cc3__side"><slot name="side" /></div>
  </div>
</template>

<style scoped>
.cc3 {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas: "boards" "main" "side";
  gap: var(--sp-5);
  font-family: var(--font-ui);
}
.cc3__boards {
  grid-area: boards;
  min-width: 0;
}
.cc3__main {
  grid-area: main;
  min-width: 0;
}
.cc3__side {
  grid-area: side;
  min-width: 0;
}
@media (min-width: 1100px) {
  .cc3 {
    grid-template-columns: 200px minmax(0, 1fr);
    grid-template-areas: "boards main" "boards side";
    grid-template-rows: auto 1fr;
    column-gap: var(--sp-8);
  }
  .cc3__boards {
    align-self: start;
    position: sticky;
    top: calc(var(--bar-h) + var(--sp-4));
  }
}
@media (min-width: 1240px) {
  .cc3.has-side {
    grid-template-columns: 200px minmax(0, 1fr) 300px;
    grid-template-areas: "boards main side";
    grid-template-rows: auto;
  }
  .cc3__side {
    align-self: start;
  }
}
</style>
