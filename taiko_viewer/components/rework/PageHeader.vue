<script setup lang="ts">
// ReworkPageHeader — the page's own <h1> block on reworked pages.
// A reworked page sets `hidePageHeader: true` in its route meta (the default layout then renders no header of its
// own) and renders this instead; pages that are not reworked keep the layout's header unchanged.
//   lead     slot before the text (a cover)
//   eyebrow  slot above the title (genre, state tags)
//   title    prop, or the `title` slot for richer markup; `titleLang` when it is not in the page language
//   default  slot under the title (facts, summary)
//   actions  slot on the right (stacks under the text below 768 px)
defineProps({
  title: { type: String, default: "" },
  titleLang: { type: String, default: undefined },
  /** the heading can take programmatic focus (after client-side navigation inside the page) */
  focusable: { type: Boolean, default: false }
});
const heading = ref<HTMLElement | null>(null);
defineExpose({ focus: () => heading.value?.focus() });
</script>

<template>
  <header class="rw-head">
    <div v-if="$slots.lead" class="rw-head__lead"><slot name="lead" /></div>
    <div class="rw-head__body">
      <div v-if="$slots.eyebrow" class="rw-head__eyebrow"><slot name="eyebrow" /></div>
      <h1 ref="heading" class="rw-head__title" :lang="titleLang" :tabindex="focusable ? -1 : undefined">
        <slot name="title">{{ title }}</slot>
      </h1>
      <slot />
    </div>
    <div v-if="$slots.actions" class="rw-head__actions"><slot name="actions" /></div>
  </header>
</template>

<style scoped>
.rw-head {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-6);
  min-width: 0;
  font-family: var(--font-ui);
  color: var(--ink);
}
.rw-head__lead {
  flex: none;
}
.rw-head__body {
  flex: 1;
  min-width: 0;
}
.rw-head__eyebrow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px var(--sp-2);
  margin-bottom: 6px;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.rw-head__title {
  margin: 0;
  font-size: clamp(1.375rem, 2.4vw, 2rem);
  font-weight: 800;
  line-height: var(--lh-tight);
  overflow-wrap: anywhere;
  line-break: strict;
  text-wrap: balance;
}
.rw-head__title:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 3px;
  border-radius: var(--r-xs);
}
.rw-head__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  flex: none;
}
@media (max-width: 767px) {
  .rw-head {
    flex-wrap: wrap;
    gap: var(--sp-4);
  }
  .rw-head__body {
    flex-basis: 0;
  }
  .rw-head__actions {
    flex-basis: 100%;
  }
}
</style>
