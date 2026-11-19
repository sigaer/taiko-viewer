<script setup lang="ts">
// One labelled block on a sample page: a component or token group name, then its states.
defineProps<{ name: string }>();
</script>

<template>
  <section class="ds-block" :aria-label="name">
    <h2 class="ds-block__name">{{ name }}</h2>
    <div class="ds-block__body"><slot /></div>
  </section>
</template>

<style scoped>
.ds-block {
  margin: 0 0 var(--sp-8);
  padding: var(--sp-5);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
}
.ds-block__name {
  margin: 0 0 var(--sp-4);
  font-size: var(--fs-16);
  line-height: var(--lh-snug);
  color: var(--ink);
}
.ds-block__body {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-4);
  align-items: flex-start;
}
</style>
