<script setup lang="ts">
import { buildPageDescription } from "~/utils/seo";

const { t } = useI18n();
const localePath = useLocalePath();
const { accountUser, fetchCurrentUser } = useAccountState();
await fetchCurrentUser(true);

definePageMeta({
  pageTitleKey: "nav.myTaiko",
  pageDescKey: "page.myTaiko.desc",
  navKey: "/my",
  hidePageDescription: true,
  breadcrumbs: [{ labelKey: "nav.myTaiko", to: "/my" }]
});

useViewerSeo(() => ({
  title: t("nav.myTaiko"),
  description: buildPageDescription(t("page.myTaiko.desc")),
  path: "/my"
}));

const readModelEnabled = computed(() => accountUser.value?.myTaikoReadModelAccess === true);

const personalLinks = [
  { path: "/my/growth", label: "passport.title" },
  { path: "/my/weekly", label: "weekly.title" },
  { path: "/account/songs", label: "account.songs" },
  { path: "/tools/b30", label: "tools.b30" },
  { path: "/tools/recommend", label: "tools.recommend" },
  { path: "/tools/progress", label: "tools.progress" },
  { path: "/tools/word-cloud", label: "tools.wordCloud" },
  { path: "/account/profile", label: "account.profile" },
  { path: "/account/version-summary", label: "account.versionSummary" }
];
</script>

<template>
  <div class="my-page">
    <section v-if="!accountUser" class="my-intro panel-card">
      <p class="my-intro__eyebrow">{{ t("nav.myTaiko") }}</p>
      <h2>{{ t("page.myTaiko.guestTitle") }}</h2>
      <p>{{ t("page.myTaiko.guestDesc") }}</p>
      <NuxtLink :to="localePath('/account/login')" class="my-cta">{{ t("page.myTaiko.guestCta") }}</NuxtLink>
    </section>
    <section v-else class="my-intro panel-card">
      <p class="my-intro__eyebrow">{{ t("nav.myTaiko") }}</p>
      <h2>{{ t("page.myTaiko.readyTitle", { name: accountUser.username }) }}</h2>
    </section>

    <MyTaikoOverview v-if="readModelEnabled && accountUser" />

    <section class="my-links panel-card">
      <h2>{{ t("page.myTaiko.linksTitle") }}</h2>
      <div class="my-links__grid">
        <NuxtLink v-for="item in personalLinks" :key="item.path" :to="localePath(item.path)" class="my-link">
          {{ t(item.label) }}
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.my-page {
  display: grid;
  gap: 16px;
}

.my-intro,
.my-links {
  padding: 20px;
}

.my-intro__eyebrow {
  margin: 0;
  color: var(--viewer-accent-strong);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.my-intro h2,
.my-links h2 {
  margin: 8px 0;
  color: var(--viewer-text);
  font-size: 22px;
}

.my-intro p:not(.my-intro__eyebrow) {
  margin: 0;
  color: var(--viewer-text-muted);
  line-height: 1.6;
}

.my-cta {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  margin-top: 16px;
  padding: 0 16px;
  border-radius: 12px;
  color: #fff;
  background: var(--viewer-accent-strong);
  text-decoration: none;
  font-weight: 700;
}

.my-links__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.my-link {
  min-height: 46px;
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid var(--viewer-border);
  border-radius: 12px;
  color: var(--viewer-text);
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
}

.my-link:hover,
.my-link:focus-visible {
  border-color: rgba(196, 164, 132, 0.62);
  background: rgba(196, 164, 132, 0.12);
}

@media (max-width: 560px) {
  .my-links__grid {
    grid-template-columns: 1fr;
  }
}
</style>
