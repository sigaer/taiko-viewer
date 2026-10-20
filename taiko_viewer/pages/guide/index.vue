<script setup lang="ts">
import { GUIDE_DIFFICULTY_OPTIONS } from "~/utils/guide";
import { buildPageDescription } from "~/utils/seo";

const route = useRoute();
const { t } = useI18n();
const localePath = useLocalePath();
const difficulty = Number(route.query.difficulty || 0);
const level = Number(route.query.level || 0);

if (Number.isInteger(difficulty) && difficulty > 0 && Number.isInteger(level) && level > 0) {
  await navigateTo(localePath(`/guide/${difficulty}/${level}`), { redirectCode: 301 });
}

definePageMeta({
  pageTitleKey: "guide.title",
  pageDescKey: "page.guide.index.desc",
  navKey: "/guide",
  breadcrumbs: [{ labelKey: "guide.title", to: "/guide" }]
});

useViewerSeo(() => ({
  title: t("guide.title"),
  description: buildPageDescription(t("page.guide.index.desc")),
  path: "/guide",
  keywords: [t("guide.title"), t("page.guide.index.keyword")],
  breadcrumbs: [
    { name: t("nav.home"), path: "/" },
    { name: t("guide.title"), path: "/guide" }
  ]
}));
</script>

<template>
  <div class="guide-entry-page">
    <el-card class="panel-card guide-entry-hero">
      <div class="guide-entry-hero__copy">
        <span class="guide-entry-hero__eyebrow">Guide Hub</span>
        <h2>{{ t("page.guide.index.heroTitle") }}</h2>
        <p>{{ t("page.guide.index.heroDesc") }}</p>
      </div>
      <img src="/optimized/guide-makina-160.webp" alt="" class="guide-entry-hero__image" width="160" height="160" decoding="async" />
    </el-card>

    <section class="guide-entry-grid">
      <el-card v-for="group in GUIDE_DIFFICULTY_OPTIONS" :key="group.value" class="panel-card guide-entry-card">
        <div class="guide-entry-card__head">
          <div class="guide-entry-card__title">
            <img :src="group.iconImage" :alt="group.label" class="guide-entry-card__icon" />
            <div>
              <h3>{{ t(`difficulty.${group.value}`) }}</h3>
              <p>{{ t("page.guide.index.levelCount", { count: group.max }) }}</p>
            </div>
          </div>
        </div>
        <div class="guide-entry-card__links">
          <NuxtLink
            v-for="level in group.max"
            :key="`${group.value}-${level}`"
            class="guide-entry-link"
            :to="localePath(`/guide/${group.value}/${level}`)"
          >
            {{ level }}{{ t("guide.starSuffix", "星") }}
          </NuxtLink>
        </div>
      </el-card>
    </section>
  </div>
</template>

<style scoped>
.guide-entry-page {
  display: grid;
  gap: 20px;
}

.guide-entry-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  gap: 18px;
  align-items: center;
  overflow: hidden;
}

.guide-entry-hero__copy {
  display: grid;
  gap: 10px;
}

.guide-entry-hero__eyebrow {
  color:#b55a38;
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.guide-entry-hero__copy h2 {
  margin: 0;
  font-size: 32px;
}

.guide-entry-hero__copy p {
  margin: 0;
  color:#6e5947;
  line-height: 1.8;
}

.guide-entry-hero__image {
  width: 100%;
  max-width: 180px;
  justify-self: end;
}

.guide-entry-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.guide-entry-card {
  display: grid;
  gap: 14px;
}

.guide-entry-card__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.guide-entry-card__title {
  display: flex;
  gap: 12px;
  align-items: center;
}

.guide-entry-card__title h3 {
  margin: 0;
  font-size: 18px;
}

.guide-entry-card__title p {
  margin: 4px 0 0;
  color:#8d745e;
  font-size: 13px;
}

.guide-entry-card__icon {
  width: 42px;
  height: 42px;
  object-fit: contain;
}

.guide-entry-card__links {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.guide-entry-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 68px;
  padding: 9px 14px;
  border-radius: 999px;
  text-decoration: none;
  color:#6b4c34;
  background:var(--viewer-surface-subtle);
  border: 1px solid rgba(185, 137, 95, 0.18);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.guide-entry-link:hover {
  transform: translateY(-1px);
  box-shadow:0 10px 18px rgba(157, 115, 75, 0.12);
}

@media (max-width: 720px) {
  .guide-entry-hero {
    grid-template-columns: 1fr;
  }

  .guide-entry-hero__image {
    justify-self: start;
  }
}
</style>
