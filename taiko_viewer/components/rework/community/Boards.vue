<script setup lang="ts">
// ReworkCommunityBoards — the sections (/api/forum/sections or the home payload): a column with the thread count of
// each section from 1100 px, a row of chips that scrolls sideways below. "All discussions" leads to
// /forum/discussions; `current` marks the section being viewed. The 8 px dot is the only section colour.
import type { PropType } from "vue";
import type { ForumSection } from "~/types/forum";
import { resolveForumSectionTranslation } from "~/utils/forum";

defineProps({
  sections: { type: Array as PropType<ForumSection[]>, default: () => [] },
  /** slug of the section being viewed; "all" on /forum/discussions; "" elsewhere */
  current: { type: String, default: "" }
});
const { t } = useI18n();
const localePath = useLocalePath();
const name = (section: ForumSection) => resolveForumSectionTranslation(t, section.slug, section.name);
const dot = (slug: string) => ({ color: `var(--section-${slug}, var(--ink-3))` });
</script>

<template>
  <nav class="cbd" :aria-label="t('forum.section')">
    <ul class="cbd__list">
      <li>
        <NuxtLink :to="localePath('/forum/discussions')" class="cbd__item" :aria-current="current === 'all' ? 'page' : undefined">
          <i class="cbd__dot is-all" aria-hidden="true" /><span class="cbd__name">{{ t("page.forum.section.allSections") }}</span>
        </NuxtLink>
      </li>
      <li v-for="section in sections" :key="section.id">
        <NuxtLink :to="localePath(`/forum/section/${section.slug}`)" class="cbd__item" :aria-current="current === section.slug ? 'page' : undefined">
          <i class="cbd__dot" :style="dot(section.slug)" aria-hidden="true" /><span class="cbd__name">{{ name(section) }}</span><b class="cbd__n num">{{ section.threadCount }}</b>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.cbd {
  min-width: 0;
  font-family: var(--font-ui);
}
.cbd__list {
  display: flex;
  gap: var(--sp-2);
  margin: 0;
  padding: 4px 4px var(--sp-1);
  list-style: none;
  overflow-x: auto;
  scrollbar-width: none;
}
.cbd__list::-webkit-scrollbar {
  display: none;
}
.cbd__item {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  min-height: var(--hit);
  padding: 0 var(--sp-4);
  border: 1px solid var(--line-strong);
  border-radius: var(--r-note);
  background: var(--surface);
  color: var(--ink-2);
  font-size: var(--fs-14);
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}
.cbd__item:hover {
  background: var(--bg-sunk);
  color: var(--ink);
}
.cbd__item:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.cbd__item[aria-current] {
  border-color: var(--selected-line);
  background: var(--selected-bg);
  color: var(--selected-ink);
  font-weight: 700;
}
.cbd__dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}
.cbd__dot.is-all {
  background: transparent;
  box-shadow: inset 0 0 0 1.5px var(--ink-3);
}
.cbd__n {
  display: none;
}
@media (min-width: 1100px) {
  .cbd__list {
    display: grid;
    gap: 2px;
    padding: var(--sp-2);
    border: 1px solid var(--line);
    border-radius: var(--r-panel);
    background: var(--surface);
    overflow: visible;
  }
  .cbd__item {
    display: flex;
    min-height: var(--hit);
    border: 0;
    border-radius: var(--r-ctl);
    white-space: normal;
  }
  .cbd__name {
    flex: 1;
    min-width: 0;
  }
  .cbd__n {
    display: inline;
    font-size: var(--fs-12);
    color: var(--ink-3);
  }
  .cbd__item[aria-current] .cbd__n {
    color: inherit;
  }
}
</style>
