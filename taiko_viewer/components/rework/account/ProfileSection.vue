<script setup lang="ts">
// ReworkAccountProfileSection — one section of /account/profile: an h2 that the section navigation focuses
// (tabindex -1, data-section-heading), an optional `meta` slot beside it, and the content.
defineProps({
  id: { type: String, required: true },
  title: { type: String, required: true }
});
</script>

<template>
  <section :id="id" class="ra-sec" :aria-labelledby="`${id}-title`">
    <div class="ra-sec__head">
      <h2 :id="`${id}-title`" class="ra-sec__title" tabindex="-1" data-section-heading>{{ title }}</h2>
      <div v-if="$slots.meta" class="ra-sec__meta"><slot name="meta" /></div>
    </div>
    <slot />
  </section>
</template>

<style scoped>
.ra-sec {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  min-width: 0;
  scroll-margin-top: calc(var(--bar-h) + var(--sp-6));
}
.ra-sec__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-2) var(--sp-4);
}
.ra-sec__title {
  margin: 0;
  font-size: var(--fs-18);
  font-weight: 700;
  line-height: var(--lh-snug);
  color: var(--ink);
}
.ra-sec__title:focus {
  outline: none;
}
.ra-sec__title:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 3px;
  border-radius: var(--r-xs);
}
.ra-sec__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-13);
  color: var(--ink-2);
}
</style>
