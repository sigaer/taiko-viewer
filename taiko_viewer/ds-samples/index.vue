<script setup lang="ts">
import DsSampleShell from "./_shared/DsSampleShell.vue";

defineOptions({ name: "DsSamplesIndex" });
const router = useRouter();
const localePath = useLocalePath();
const sections = computed(() => {
  const slugs = new Set<string>();
  for (const route of router.getRoutes()) {
    const slug = route.meta?.dsSample;
    if (typeof slug === "string" && slug) slugs.add(slug);
  }
  return [...slugs].sort();
});
</script>

<template>
  <DsSampleShell title="Design System V1.3">
    <ul class="ds-index" data-testid="ds-index">
      <li v-for="slug in sections" :key="slug">
        <NuxtLink :to="localePath(`/_ds/${slug}`)">{{ slug }}</NuxtLink>
      </li>
    </ul>
  </DsSampleShell>
</template>

<style scoped>
.ds-index {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--sp-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.ds-index a {
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
