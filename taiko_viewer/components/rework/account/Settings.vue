<script setup lang="ts">
// ReworkAccountSettings — /settings (slice E1). Display (theme light / dark — the site's cookie theme, no "follow
// system" — and language, the same mechanisms as the shell's controls), the local cache (count, size, the keys,
// clear) and the shortcuts. State and actions belong to the page.
import type { PropType } from "vue";

defineProps({
  theme: { type: String as PropType<"light" | "dark">, required: true },
  locale: { type: String, required: true },
  languages: { type: Array as PropType<{ code: string; label: string; lang: string; to: string }[]>, required: true },
  cacheItems: { type: Array as PropType<string[]>, required: true },
  cacheSize: { type: Number, required: true },
  shortcuts: { type: Array as PropType<{ to: string; label: string }[]>, required: true }
});
const emit = defineEmits<{ "update:theme": [value: "light" | "dark"]; clearCache: []; toggleDetails: [] }>();
const { t } = useI18n();
const s = (key: string) => t(`rework.account.settings.${key}`);
</script>

<template>
  <div class="rset">
    <ReworkPageHeader :title="t('nav.settings')" />

    <ReworkPanel :title="s('display')" class="settings-theme">
      <div class="rset__row">
        <span id="settings-theme-label" class="rset__label">{{ s("themeMode") }}</span>
        <div class="rw-seg" role="group" aria-labelledby="settings-theme-label">
          <button type="button" :aria-pressed="theme === 'light'" @click="emit('update:theme', 'light')">{{ s("light") }}</button>
          <button type="button" :aria-pressed="theme === 'dark'" @click="emit('update:theme', 'dark')">{{ s("dark") }}</button>
        </div>
      </div>
      <div class="rset__row">
        <span id="settings-language-label" class="rset__label">{{ s("language") }}</span>
        <div class="rw-seg" role="group" aria-labelledby="settings-language-label">
          <NuxtLink v-for="item in languages" :key="item.code" class="rset__lang" :to="item.to" :lang="item.lang" :aria-current="locale === item.code ? 'true' : undefined">{{ item.label }}</NuxtLink>
        </div>
      </div>
    </ReworkPanel>

    <ReworkPanel :title="s('cache')" class="cache-panel">
      <template #actions>
        <button type="button" class="rw-btn rw-btn--sm rw-btn--danger" @click="emit('clearCache')">{{ s("clearCache") }}</button>
      </template>
      <p class="cache-summary">
        <span>{{ s("cacheItems") }} <b class="num">{{ cacheItems.length }}</b></span>
        <span>{{ s("cacheSize") }} <b class="num">{{ cacheSize }}</b> KB</span>
      </p>
      <details class="cache-details" @toggle="emit('toggleDetails')">
        <summary>{{ s("details") }}</summary>
        <ul v-if="cacheItems.length" class="cache-keys" :aria-label="s('cacheKey')">
          <li v-for="key in cacheItems" :key="key"><code>{{ key }}</code></li>
        </ul>
        <p v-else class="cache-empty">{{ s("empty") }}</p>
      </details>
    </ReworkPanel>

    <ReworkPanel :title="s('shortcuts')">
      <ul class="tool-links">
        <li v-for="item in shortcuts" :key="item.to">
          <NuxtLink :to="item.to" class="tool-link"><span>{{ item.label }}</span><ReworkIcon name="forward" /></NuxtLink>
        </li>
      </ul>
    </ReworkPanel>
  </div>
</template>

<style scoped>
.rset {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: var(--sp-6);
  max-width: 760px;
  margin: 0 auto;
  font-family: var(--font-ui);
  color: var(--ink);
}
.rset__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2) var(--sp-4);
  padding: var(--sp-2) 0;
}
.rset__row + .rset__row {
  border-top: 1px solid var(--line);
}
.rset__label {
  font-size: var(--fs-14);
  font-weight: 600;
}
.rset__lang {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
  padding: 0 var(--sp-3);
  border-radius: calc(var(--r-ctl) - 2px);
  color: var(--ink-2);
  font-size: var(--fs-13);
  text-decoration: none;
}
.rset__lang[aria-current="true"] {
  background: var(--seg-on-bg);
  color: var(--seg-on-ink);
  font-weight: 700;
  box-shadow: 0 0 0 1px var(--seg-on-ring);
}
.rset__lang:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
}
.cache-summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-1) var(--sp-5);
  margin: 0 0 var(--sp-2);
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.cache-summary b {
  color: var(--ink);
}
.cache-details summary {
  display: flex;
  align-items: center;
  min-height: var(--hit);
  color: var(--link);
  font-size: var(--fs-14);
  cursor: pointer;
}
.cache-details summary:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
  border-radius: var(--r-xs);
}
.cache-keys {
  max-height: 240px;
  margin: 0;
  padding: var(--sp-2) var(--sp-3);
  overflow: auto;
  list-style: none;
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
}
.cache-keys li {
  padding: 4px 0;
  font-size: var(--fs-13);
  overflow-wrap: anywhere;
}
.cache-empty {
  margin: 0;
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.tool-links {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.tool-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  min-height: var(--hit);
  padding: var(--sp-2) var(--sp-4);
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
  color: var(--ink);
  font-size: var(--fs-14);
  font-weight: 600;
  text-decoration: none;
}
.tool-link:hover {
  background: var(--bg-sunk);
}
.tool-link:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.tool-link svg {
  width: 18px;
  height: 18px;
  color: var(--ink-3);
}
</style>
