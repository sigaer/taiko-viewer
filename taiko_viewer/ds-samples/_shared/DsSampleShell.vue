<script setup lang="ts">
// Frame for every design-system sample page. Loads the scoped ds stylesheets, sets the ds-preview scope and
// noindex, and offers theme / language switching through production's own mechanisms
// (useViewerTheme → plugins/theme.ts cookie + html[data-theme]; @nuxtjs/i18n switchLocalePath).
// Labels on sample pages are component, token and state names; product copy comes from locales (ds.*).
import "~/assets/css/ds/tokens.css";
import "~/assets/css/ds/fonts.css";
import "~/assets/css/ds/element-plus.css";
import "~/assets/css/ds/base.css";
import { useDsPreviewScope } from "./useDsPreviewScope";

defineProps<{ title: string }>();

useDsPreviewScope();
// The production layouts set <html lang/dir>; sample pages have no layout, so they set it the same way (no SEO links).
const localeHead = useLocaleHead();
useHead(() => ({ htmlAttrs: { lang: localeHead.value.htmlAttrs?.lang, dir: localeHead.value.htmlAttrs?.dir } }));

// Element Plus poppers (select, tooltip, dropdown) teleport persistent nodes to <body>. When a kept-alive sample page
// is later dropped together with its KeepAlive (leaving layout:false for a page with a layout remounts <NuxtPage>),
// Vue throws while unmounting those teleports from the deactivated tree ("Cannot read properties of null (reading
// 'nextSibling')") and the next page's head never updates. So the sample content is unmounted on route leave, while
// it is still active, and mounted again on activation. Sample state resets when you come back; that is intended.
const live = ref(true);
onBeforeRouteLeave(async () => {
  live.value = false;
  await nextTick();
});
onActivated(() => {
  live.value = true;
});

const { t, locale, locales } = useI18n();
const { theme } = useViewerTheme();
const switchLocalePath = useSwitchLocalePath();
const localePath = useLocalePath();
const router = useRouter();

/** Sections registered by ds-samples/routes.ts (one per file in ds-samples/sections/). */
const sections = computed(() => {
  const slugs = new Set<string>();
  for (const route of router.getRoutes()) {
    const slug = route.meta?.dsSample;
    if (typeof slug === "string" && slug) slugs.add(slug);
  }
  return [...slugs].sort();
});
const localeCodes = computed(() => (locales.value as Array<{ code: string }>).map((l) => l.code));
</script>

<template>
  <div class="ds-root ds-sample">
    <header class="ds-sample__bar">
      <NuxtLink class="ds-sample__home" :to="localePath('/_ds')">V1.3</NuxtLink>
      <nav class="ds-sample__nav" aria-label="ds-samples">
        <NuxtLink v-for="slug in sections" :key="slug" :to="localePath(`/_ds/${slug}`)" class="ds-sample__link">{{ slug }}</NuxtLink>
      </nav>
      <div class="ds-sample__tools">
        <el-segmented v-model="theme" :options="[{ label: t('ds.sample.themeLight'), value: 'light' }, { label: t('ds.sample.themeDark'), value: 'dark' }]" :aria-label="t('ds.sample.theme')" data-testid="ds-theme" />
        <NuxtLink
          v-for="code in localeCodes"
          :key="code"
          :to="switchLocalePath(code as 'zh' | 'ja')"
          :aria-current="code === locale ? 'true' : undefined"
          class="ds-sample__lang"
          :data-testid="`ds-lang-${code}`"
        >{{ t(`locale.${code}`) }}</NuxtLink>
      </div>
    </header>
    <main class="ds-sample__main">
      <h1 class="ds-sample__title">{{ title }}</h1>
      <slot v-if="live" />
    </main>
  </div>
</template>

<style scoped>
.ds-sample__bar {
  position: sticky;
  top: 0;
  z-index: var(--z-bar);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3) var(--sp-4);
  padding: var(--sp-2) var(--gutter);
  background: var(--surface);
  border-bottom: 1px solid var(--line);
}
.ds-sample__home {
  font-family: var(--font-num);
  font-weight: 700;
  font-size: var(--fs-18);
  color: var(--ink);
  text-decoration: none;
}
.ds-sample__nav {
  display: flex;
  flex: 1 1 auto;
  gap: var(--sp-1);
  overflow-x: auto;
  min-width: 0;
}
.ds-sample__link,
.ds-sample__lang {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
  padding: 0 var(--sp-3);
  border-radius: var(--r-ctl);
  color: var(--ink-2);
  text-decoration: none;
  white-space: nowrap;
}
.ds-sample__link.router-link-exact-active,
.ds-sample__lang[aria-current="true"] {
  background: var(--selected-bg);
  color: var(--selected-ink);
  font-weight: 600;
}
.ds-sample__tools {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.ds-sample__main {
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--sp-6) var(--gutter) var(--sp-16);
}
.ds-sample__title {
  margin: 0 0 var(--sp-6);
  font-size: var(--fs-28);
  line-height: var(--lh-tight);
}
</style>
