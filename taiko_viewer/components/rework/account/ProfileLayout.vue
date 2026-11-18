<script setup lang="ts">
// ReworkAccountProfileLayout — /account/profile: the identity header, the section navigation and the sections.
// ≥ 1100 px: a side list (sticky) beside a 760 px column; below: the identity, then a compact row of the same links,
// then the sections. The links are in-page anchors (`#id`): a click scrolls to the section and moves focus to its
// heading without writing the hash, so the page adds no URL state; a #id deep link still lands on the section.
// The current section (aria-current) follows the scroll position.
import type { PropType } from "vue";

const props = defineProps({
  sections: { type: Array as PropType<{ id: string; label: string }[]>, required: true },
  label: { type: String, required: true }
});
const current = ref(props.sections[0]?.id || "");
let observer: IntersectionObserver | null = null;

function go(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  const heading = target.querySelector<HTMLElement>("[data-section-heading]") || target;
  heading.focus({ preventScroll: true });
  current.value = id;
}

function observe() {
  observer?.disconnect();
  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) current.value = visible[0].target.id;
    },
    { rootMargin: "-20% 0px -65% 0px" }
  );
  for (const section of props.sections) {
    const el = document.getElementById(section.id);
    if (el) observer.observe(el);
  }
}

onMounted(() => nextTick(observe));
watch(() => props.sections.map((s) => s.id).join(), () => nextTick(observe));
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div class="ra-profile">
    <div class="ra-profile__ident"><slot name="identity" /></div>
    <nav class="ra-toc" :aria-label="label">
      <ul>
        <li v-for="section in sections" :key="section.id">
          <a :href="`#${section.id}`" :aria-current="current === section.id ? 'true' : undefined" @click.prevent="go(section.id)">{{ section.label }}</a>
        </li>
      </ul>
    </nav>
    <div class="ra-profile__body"><slot /></div>
  </div>
</template>

<style scoped>
.ra-profile {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas: "ident" "toc" "body";
  gap: var(--sp-6);
  max-width: 760px;
  margin: 0 auto;
  font-family: var(--font-ui);
  color: var(--ink);
}
.ra-profile__ident {
  grid-area: ident;
  min-width: 0;
}
.ra-profile__body {
  grid-area: body;
  display: flex;
  flex-direction: column;
  gap: var(--sp-10);
  min-width: 0;
}
.ra-toc {
  grid-area: toc;
  min-width: 0;
}
.ra-toc ul {
  display: flex;
  gap: var(--sp-1);
  margin: 0;
  padding: 0;
  overflow-x: auto;
  list-style: none;
  scrollbar-width: none;
  border-bottom: 1px solid var(--line);
}
.ra-toc a {
  display: flex;
  align-items: center;
  min-height: var(--hit);
  padding: 0 var(--sp-3);
  border-bottom: 2px solid transparent;
  color: var(--ink-2);
  font-size: var(--fs-14);
  white-space: nowrap;
  text-decoration: none;
}
.ra-toc a:hover {
  color: var(--ink);
}
.ra-toc a[aria-current="true"] {
  border-bottom-color: var(--selected-line);
  color: var(--ink);
  font-weight: 700;
}
.ra-toc a:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
  border-radius: var(--r-xs);
}
@media (min-width: 1100px) {
  .ra-profile {
    grid-template-columns: 200px minmax(0, 760px);
    grid-template-areas: "toc ident" "toc body";
    grid-template-rows: auto 1fr;
    column-gap: var(--sp-10);
    max-width: calc(200px + 760px + var(--sp-10));
  }
  .ra-toc {
    position: sticky;
    top: calc(var(--bar-h) + var(--sp-6));
    align-self: start;
  }
  .ra-toc ul {
    flex-direction: column;
    gap: 2px;
    overflow: visible;
    border-bottom: 0;
    border-left: 1px solid var(--line);
  }
  .ra-toc a {
    min-height: var(--hit);
    margin-left: -1px;
    padding: 6px var(--sp-3);
    border-bottom: 0;
    border-left: 2px solid transparent;
    white-space: normal;
  }
  .ra-toc a[aria-current="true"] {
    border-left-color: var(--selected-line);
  }
}
</style>
