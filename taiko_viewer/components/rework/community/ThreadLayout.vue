<script setup lang="ts">
// ReworkCommunityThreadLayout — the thread page's frame. The reading column is at most 760 px; from 1240 px the
// side column (the related chart) sits on the right and stays in view, below that it follows the header.
defineProps({ hasSide: { type: Boolean, default: false } });
</script>

<template>
  <div class="tl" :class="{ 'has-side': hasSide }">
    <div class="tl__head"><slot name="head" /></div>
    <aside v-if="hasSide" class="tl__side"><slot name="side" /></aside>
    <div class="tl__main"><slot /></div>
  </div>
</template>

<style scoped>
.tl {
  display: grid;
  grid-template-columns: minmax(0, 760px);
  grid-template-areas: "head" "side" "main";
  gap: var(--sp-5);
  justify-content: center;
  font-family: var(--font-ui);
}
.tl__head {
  grid-area: head;
  min-width: 0;
}
.tl__side {
  grid-area: side;
  min-width: 0;
}
.tl__main {
  grid-area: main;
  min-width: 0;
}
@media (min-width: 1240px) {
  .tl.has-side {
    grid-template-columns: minmax(0, 760px) 300px;
    grid-template-areas: "head side" "main side";
    grid-template-rows: auto 1fr;
    column-gap: var(--sp-10);
  }
  .tl__side {
    align-self: start;
    position: sticky;
    top: calc(var(--bar-h) + var(--sp-4));
  }
}
</style>
