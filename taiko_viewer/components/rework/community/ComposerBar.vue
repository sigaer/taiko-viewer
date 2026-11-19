<script setup lang="ts">
// ReworkCommunityComposerBar — the composer's own sticky header (the shell hides its bar on this page,
// route meta `composerHeader`): back to the community, the page <h1>, and the publish action.
defineProps({
  title: { type: String, required: true },
  backTo: { type: String, required: true },
  backLabel: { type: String, required: true },
  submitLabel: { type: String, required: true },
  disabled: { type: Boolean, default: false },
  busy: { type: Boolean, default: false }
});
const emit = defineEmits<{ submit: [] }>();
</script>

<template>
  <header class="cbar composer-panel__head">
    <NuxtLink :to="backTo" class="cbar__back composer-back-link"><ReworkIcon name="back" /><span>{{ backLabel }}</span></NuxtLink>
    <h1 class="cbar__title">{{ title }}</h1>
    <button type="button" class="rw-btn rw-btn--primary cbar__go" :disabled="disabled || busy" :aria-busy="busy || undefined" @click="emit('submit')">{{ submitLabel }}</button>
  </header>
</template>

<style scoped>
.cbar {
  position: sticky;
  top: 0;
  z-index: var(--z-bar);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: var(--sp-3);
  min-height: var(--bar-h);
  margin: 0 0 var(--sp-5);
  padding: max(var(--sp-2), env(safe-area-inset-top, 0px)) 0 var(--sp-2);
  border-bottom: 1px solid var(--line);
  background: var(--bg);
  font-family: var(--font-ui);
}
.cbar__back {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: var(--hit);
  padding-right: var(--sp-2);
  color: var(--ink-2);
  font-size: var(--fs-14);
  text-decoration: none;
  border-radius: var(--r-ctl);
}
.cbar__back :deep(svg) {
  width: 18px;
  height: 18px;
}
.cbar__back:hover {
  color: var(--link);
}
.cbar__back:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.cbar__title {
  margin: 0;
  font-size: var(--fs-18);
  font-weight: 700;
  white-space: nowrap;
}
.cbar__go {
  justify-self: end;
  min-width: 88px;
}
@media (max-width: 767px) {
  .cbar {
    min-height: var(--bar-h-m);
  }
  .cbar__title {
    font-size: var(--fs-16);
  }
}
</style>
