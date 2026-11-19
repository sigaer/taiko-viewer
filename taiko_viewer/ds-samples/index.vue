<script setup lang="ts">
// P0-27 overview: every registered section, grouped by its file-prefix range.
import DsSampleShell from "./_shared/DsSampleShell.vue";
import { useDsSections } from "./_shared/useDsSections";

defineOptions({ name: "DsSamplesIndex" });
const localePath = useLocalePath();
const { groups } = useDsSections();
</script>

<template>
  <DsSampleShell title="Design System V1.3">
    <div class="ds-index" data-testid="ds-index">
      <section v-for="group in groups" :key="group.id" class="ds-index__group" :aria-labelledby="`ds-group-${group.id}`">
        <h2 :id="`ds-group-${group.id}`" class="ds-index__name">{{ group.id }}</h2>
        <ul class="ds-index__list">
          <li v-for="s in group.sections" :key="s.slug">
            <NuxtLink :to="localePath(`/_ds/${s.slug}`)" :data-testid="`ds-index-${s.slug}`">{{ s.slug }}</NuxtLink>
          </li>
        </ul>
      </section>
    </div>
  </DsSampleShell>
</template>

<style scoped>
.ds-index {
  display: grid;
  gap: var(--sp-6);
}
.ds-index__name {
  margin: 0 0 var(--sp-3);
  font-size: var(--fs-16);
  color: var(--ink-2);
}
.ds-index__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--sp-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.ds-index__list a {
  display: flex;
  align-items: center;
  min-height: var(--hit);
  padding: 0 var(--sp-4);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
  color: var(--link);
  text-decoration: none;
}
</style>
