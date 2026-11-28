<script setup lang="ts">
// ReworkCommunityCard — the community's card surface (the redesign's card: --surface, 1 px --line, --r-panel).
//   flush  no inner padding (lists whose rows carry their own padding and dividers)
//   as     the element (div by default; section / article when the card is a landmark)
defineProps({
  flush: { type: Boolean, default: false },
  as: { type: String, default: "div" }
});
</script>

<template>
  <component :is="as" class="ccd" :class="{ 'is-flush': flush }"><slot /></component>
</template>

<style scoped>
.ccd {
  min-width: 0;
  padding: var(--sp-5) var(--sp-6);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  font-family: var(--font-ui);
  color: var(--ink);
}
.ccd.is-flush {
  padding: 0;
  overflow: hidden;
}
@media (max-width: 767px) {
  .ccd {
    padding: var(--sp-4);
  }
  .ccd.is-flush {
    padding: 0;
  }
}
</style>
