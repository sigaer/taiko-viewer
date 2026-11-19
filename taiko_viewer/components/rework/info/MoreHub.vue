<script setup lang="ts">
// ReworkInfoMoreHub — /more, the tools entry (slice F; frozen design: Tools.vue entry list). One list of real
// destinations grouped as the shell groups them, each labelled with its page's title; the language switch; the
// product name and version (`meta` slot, the page reads the version). `.more-hub` is kept for the Linux smoke.
import type { PropType } from "vue";

type Group = { key: string; titleKey: string; items: readonly { path: string; labelKey: string }[] };
defineProps({
  groups: { type: Array as PropType<readonly Group[]>, required: true },
  locales: { type: Array as PropType<{ code: string; label: string; path: string }[]>, required: true },
  currentLocale: { type: String, required: true }
});
const { t } = useI18n();
const localePath = useLocalePath();
</script>

<template>
  <div class="more-hub">
    <section v-for="group in groups" :key="group.key" class="mh-group" :aria-labelledby="`more-${group.key}`">
      <h2 :id="`more-${group.key}`" class="mh-title">{{ t(group.titleKey) }}</h2>
      <ul class="mh-list">
        <li v-for="item in group.items" :key="item.path">
          <NuxtLink :to="localePath(item.path)" class="mh-link">
            <span>{{ t(item.labelKey) }}</span>
            <ReworkIcon name="forward" class="mh-chev" />
          </NuxtLink>
        </li>
      </ul>
    </section>
    <section class="mh-group" aria-labelledby="more-language">
      <h2 id="more-language" class="mh-title">{{ t("page.more.language") }}</h2>
      <div class="rw-seg mh-lang">
        <NuxtLink v-for="item in locales" :key="item.code" custom :to="item.path">
          <template #default="{ href, navigate }">
            <a :href="href" :hreflang="item.code" :aria-current="item.code === currentLocale ? 'true' : undefined" @click="navigate">{{ item.label }}</a>
          </template>
        </NuxtLink>
      </div>
    </section>
    <p class="mh-meta"><slot name="meta" /></p>
  </div>
</template>

<style scoped>
.more-hub {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-5);
  align-items: start;
  min-width: 0;
  font-family: var(--font-ui);
  color: var(--ink);
}
.mh-group {
  min-width: 0;
}
.mh-title {
  margin: 0 0 var(--sp-2);
  font-size: var(--fs-13);
  font-weight: 600;
  color: var(--ink-2);
}
.mh-list {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
.mh-list li + li {
  border-top: 1px solid var(--line);
}
.mh-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  min-height: 52px;
  padding: 0 var(--sp-4);
  color: var(--ink);
  font-size: var(--fs-16);
  font-weight: 600;
  text-decoration: none;
}
.mh-link:hover {
  background: var(--bg-sunk);
}
.mh-link:hover span {
  color: var(--link);
}
.mh-link:focus-visible,
.mh-lang a:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}
.mh-list li:first-child .mh-link {
  border-radius: var(--r-panel) var(--r-panel) 0 0;
}
.mh-list li:last-child .mh-link {
  border-radius: 0 0 var(--r-panel) var(--r-panel);
}
.mh-chev {
  width: 18px;
  height: 18px;
  flex: none;
  color: var(--ink-3);
}
.mh-lang a {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
  padding: 0 var(--sp-4);
  border-radius: calc(var(--r-ctl) - 2px);
  color: var(--ink-2);
  font-size: var(--fs-14);
  text-decoration: none;
}
.mh-lang a[aria-current] {
  background: var(--seg-on-bg);
  color: var(--seg-on-ink);
  font-weight: 700;
  box-shadow: 0 0 0 1px var(--seg-on-ring);
}
.mh-meta {
  grid-column: 1 / -1;
  margin: 0;
  font-size: var(--fs-12);
  color: var(--ink-3);
  text-align: center;
}
@media (max-width: 767px) {
  .more-hub {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
