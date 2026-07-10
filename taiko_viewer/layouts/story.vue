<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import ja from "element-plus/es/locale/lang/ja";
import { SITE_TITLE } from "~/utils/seo";

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
  window.gtag("event", "page_view", {
    page_title: document.title,
    page_location: window.location.href,
    page_path: path
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
      <header class="story-shell__chrome">
        <NuxtLink :to="localePath('/')" class="story-shell__brand" :aria-label="`${SITE_TITLE} ${t('nav.home')}`">
          <img src="/logo.png" alt="" class="story-shell__logo" />
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

<style scoped>
.story-shell {
  min-height: 100vh;
  min-height: 100svh;
  position: relative;
  color: #fff6e8;
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
    radial-gradient(circle, rgba(253, 94, 61, 0.26) 0%, rgba(253, 94, 61, 0) 70%),
    radial-gradient(circle at 62% 38%, rgba(255, 208, 96, 0.16) 0%, rgba(255, 208, 96, 0) 58%);
  filter: blur(10px);
}

.story-shell::after {
  width: 52rem;
  height: 52rem;
  right: -20rem;
  bottom: -16rem;
  border-radius: 50%;
  background:
    radial-gradient(circle, rgba(80, 160, 255, 0.18) 0%, rgba(80, 160, 255, 0) 68%),
    radial-gradient(circle at 38% 42%, rgba(255, 129, 80, 0.18) 0%, rgba(255, 129, 80, 0) 54%);
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
  padding: 18px 22px;
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
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(8, 17, 40, 0.48);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(18px);
  box-shadow: 0 16px 40px rgba(4, 10, 28, 0.28);
}

.story-shell__logo {
  width: 42px;
  height: 42px;
  border-radius: 14px;
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
  color: rgba(255, 240, 218, 0.72);
}

.story-shell__locale {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 999px;
  background: rgba(8, 17, 40, 0.48);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(18px);
  box-shadow: 0 16px 40px rgba(4, 10, 28, 0.28);
}

.story-shell__locale-chip {
  min-width: 74px;
  padding: 8px 12px;
  border-radius: 999px;
  text-align: center;
  text-decoration: none;
  color: rgba(255, 240, 218, 0.7);
  font-size: 12px;
  transition:
    background-color 0.25s ease,
    color 0.25s ease,
    transform 0.25s ease;
}

.story-shell__locale-chip.active {
  background: linear-gradient(135deg, rgba(255, 109, 70, 0.88), rgba(255, 184, 92, 0.88));
  color: #fff9f0;
  transform: translateY(-1px);
}

.story-shell__viewport {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  min-height: 100svh;
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
