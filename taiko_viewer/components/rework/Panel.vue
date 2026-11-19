<script setup lang="ts">
// ReworkPanel — a titled section of a reworked page.
//   surface (default)  a raised panel: --surface, 1px --line, --r-panel
//   plain              no surface: a section of the main column, separated from the previous one by spacing
// Title (h2 by default, `level` 3 inside another section), optional `actions` slot on the right of the title.
// The section is labelled by its title; without a title pass `label` for the accessible name.
import type { PropType } from "vue";

const props = defineProps({
  title: { type: String, default: "" },
  level: { type: Number as PropType<2 | 3>, default: 2 },
  plain: { type: Boolean, default: false },
  label: { type: String, default: "" }
});
const id = useId();
const headingTag = computed(() => (props.level === 3 ? "h3" : "h2"));
</script>

<template>
  <section
    class="rw-panel"
    :class="{ 'is-plain': plain }"
    :aria-labelledby="title ? `${id}-title` : undefined"
    :aria-label="!title && label ? label : undefined"
  >
    <div v-if="title || $slots.actions" class="rw-panel__head">
      <component :is="headingTag" v-if="title" :id="`${id}-title`" class="rw-panel__title" :class="`is-h${level}`">{{ title }}</component>
      <div v-if="$slots.actions" class="rw-panel__actions"><slot name="actions" /></div>
    </div>
    <slot />
  </section>
</template>

<style scoped>
.rw-panel {
  min-width: 0;
  padding: var(--sp-4) var(--sp-5) var(--sp-5);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  color: var(--ink);
  font-family: var(--font-ui);
}
.rw-panel.is-plain {
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}
.rw-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--sp-2) var(--sp-4);
  margin-bottom: var(--sp-3);
  min-height: var(--hit);
}
.rw-panel__title {
  margin: 0;
  line-height: var(--lh-snug);
  color: var(--ink);
}
.rw-panel__title.is-h2 {
  font-size: var(--fs-18);
  font-weight: 700;
}
.rw-panel__title.is-h3 {
  font-size: var(--fs-16);
  font-weight: 700;
}
.rw-panel__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2) var(--sp-4);
}
@media (max-width: 767px) {
  .rw-panel {
    padding: var(--sp-3) var(--sp-4) var(--sp-4);
  }
}
</style>
