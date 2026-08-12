<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import ja from "element-plus/es/locale/lang/ja";
import { SITE_TITLE } from "~/utils/seo";
import { buildAnalyticsRouteTemplate, buildAnonymousPageLocation } from "~/utils/analytics";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const route = useRoute();
const runtimeConfig = useRuntimeConfig();
const { t, locale } = useI18n();
const localeHead = useLocaleHead({ seo: true });
const localePath = useLocalePath();
const switchLocalePath = useSwitchLocalePath();
const googleAnalyticsId = computed(() => String(runtimeConfig.public.googleAnalyticsId || "").trim());
const lastTrackedPath = ref("");
const immersiveStory = useState<boolean>("story-layout-immersive", () => false);
const isPrivateAnnualCanvas = computed(() =>
  /\/(?:account\/version-summary|account\/annual-poster\/)/.test(route.path)
);

useHead(() => ({
  htmlAttrs: localeHead.value.htmlAttrs,
  meta: localeHead.value.meta,
  link: localeHead.value.link.filter((item) => item.rel !== "canonical"),
  bodyAttrs: {
    class: "story-layout-body"
  }
}));

useHead(() => {
  const measurementId = googleAnalyticsId.value;
  if (!measurementId) return {};
  return {
    script: [
      {
        key: "google-analytics-loader",
        async: true,
        src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
      },
      {
        key: "google-analytics-bootstrap",
        children: [
          "window.dataLayer = window.dataLayer || [];",
          "function gtag(){dataLayer.push(arguments);}",
          "window.gtag = window.gtag || gtag;",
          "gtag('js', new Date());",
          `gtag('config', ${JSON.stringify(measurementId)}, { send_page_view: false });`
        ].join("")
      }
    ]
  };
});

const localeOptions = computed(() => [
  { code: "zh", label: t("locale.zh"), path: switchLocalePath("zh") || localePath("/") },
  { code: "ja", label: t("locale.ja"), path: switchLocalePath("ja") || localePath("/") }
]);
const elementLocale = computed(() => (locale.value === "ja" ? ja : zhCn));

const trackGooglePageView = async (path: string) => {
  if (!process.client || !googleAnalyticsId.value) return;
  if (!path || lastTrackedPath.value === path) return;
  await nextTick();
  if (typeof window.gtag !== "function") return;
  const routeTemplate = buildAnalyticsRouteTemplate(path);
  window.gtag("event", "page_view", {
    page_title: document.title,
    page_location: buildAnonymousPageLocation(path),
    page_path: routeTemplate
  });
  lastTrackedPath.value = path;
};

watch(
  () => route.fullPath,
  async (path) => {
    await trackGooglePageView(path);
  }
);

onMounted(() => {
  trackGooglePageView(route.fullPath);
});
</script>

<template>
  <el-config-provider :locale="elementLocale">
    <div class="story-shell">
      <header class="story-shell__chrome" :class="{ 'is-hidden': immersiveStory || isPrivateAnnualCanvas }">
        <NuxtLink :to="localePath('/')" class="story-shell__brand" :aria-label="`${SITE_TITLE} ${t('nav.home')}`">
          <img src="/optimized/logo-168.webp" alt="" class="story-shell__logo" width="70" height="70" decoding="async" />
          <div class="story-shell__brand-copy">
            <strong>{{ SITE_TITLE }}</strong>
            <span>{{ t("account.versionSummary") }}</span>
          </div>
        </NuxtLink>

        <div class="story-shell__locale" :aria-label="t('layout.switchLanguage')">
          <NuxtLink
            v-for="item in localeOptions"
            :key="item.code"
            class="story-shell__locale-chip"
            :class="{ active: item.code === locale }"
            :to="item.path"
          >
            {{ item.label }}
          </NuxtLink>
        </div>
      </header>

      <main class="story-shell__viewport">
        <slot />
      </main>
    </div>
  </el-config-provider>
</template>

<style src="~/assets/css/story-font.css"></style>

<style scoped>
.story-shell {
  height: 100vh;
  height: 100svh;
  height: 100dvh;
  position: relative;
  color: #17365d;
  background: linear-gradient(145deg, #f7fbff 0%, #e5f1ff 100%);
  overflow: hidden;
}

.story-shell::before,
.story-shell::after {
  content: "";
  position: fixed;
  inset: auto;
  pointer-events: none;
  z-index: 0;
}

.story-shell::before {
  width: 46rem;
  height: 46rem;
  left: -12rem;
  top: -10rem;
  border-radius: 50%;
  background:
    radial-gradient(circle, rgba(57, 120, 200, 0.16) 0%, rgba(57, 120, 200, 0) 70%),
    radial-gradient(circle at 62% 38%, rgba(57, 120, 200, 0.08) 0%, rgba(57, 120, 200, 0) 58%);
  filter: blur(10px);
}

.story-shell::after {
  width: 52rem;
  height: 52rem;
  right: -20rem;
  bottom: -16rem;
  border-radius: 50%;
  background:
    radial-gradient(circle, rgba(57, 120, 200, 0.12) 0%, rgba(57, 120, 200, 0) 68%),
    radial-gradient(circle at 38% 42%, rgba(23, 54, 93, 0.08) 0%, rgba(23, 54, 93, 0) 54%);
  filter: blur(24px);
}

.story-shell__chrome {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  pointer-events: none;
  transition:
    opacity 0.28s ease,
    transform 0.28s ease,
    visibility 0.28s ease;
}

.story-shell__chrome.is-hidden {
  opacity: 0;
  visibility: hidden;
  transform: translateY(-16px);
}

.story-shell__chrome.is-hidden .story-shell__brand,
.story-shell__chrome.is-hidden .story-shell__locale {
  pointer-events: none;
}

.story-shell__brand,
.story-shell__locale {
  pointer-events: auto;
}

.story-shell__brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: inherit;
  padding: 7px 11px;
  border-radius: 999px;
  background: rgba(247, 251, 255, 0.9);
  border: 1px solid rgba(57, 120, 200, 0.16);
  backdrop-filter: blur(18px);
  box-shadow: 0 16px 40px rgba(23, 54, 93, 0.14);
}

.story-shell__logo {
  width: 34px;
  height: 34px;
  border-radius: 11px;
  object-fit: contain;
}

.story-shell__brand-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.story-shell__brand-copy strong {
  font-size: 14px;
  letter-spacing: 0.04em;
}

.story-shell__brand-copy span {
  font-size: 12px;
  color: #7890ab;
}

.story-shell__locale {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 999px;
  background: rgba(247, 251, 255, 0.9);
  border: 1px solid rgba(57, 120, 200, 0.16);
  backdrop-filter: blur(18px);
  box-shadow: 0 16px 40px rgba(23, 54, 93, 0.14);
}

.story-shell__locale-chip {
  min-width: 74px;
  padding: 8px 12px;
  border-radius: 999px;
  text-align: center;
  text-decoration: none;
  color: #7890ab;
  font-size: 12px;
  transition:
    background-color 0.25s ease,
    color 0.25s ease,
    transform 0.25s ease;
}

.story-shell__locale-chip.active {
  background: #3978c8;
  color: #f7fbff;
  transform: translateY(-1px);
}

.story-shell__viewport {
  position: relative;
  z-index: 1;
  height: 100%;
  overflow: hidden;
}

@media (max-width: 720px) {
  .story-shell__chrome {
    padding: 14px;
  }

  .story-shell__brand {
    padding: 8px 10px;
    gap: 10px;
  }

  .story-shell__brand-copy span {
    display: none;
  }

  .story-shell__locale {
    padding: 6px;
    gap: 6px;
  }

  .story-shell__locale-chip {
    min-width: 60px;
    padding: 7px 10px;
    font-size: 11px;
  }
}
</style>
