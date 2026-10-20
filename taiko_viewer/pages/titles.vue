<script setup lang="ts">
import { computed } from "vue";
import type { TitleCatalogItem } from "~/types/content";
import { buildPageDescription } from "~/utils/seo";

const { data: titleTableData, pending, error } = await useTitlesContent();

const titles = computed<TitleCatalogItem[]>(() => titleTableData.value?.titles || []);
const { t } = useI18n();

definePageMeta({
  contentLayout: "wide",
  pageTitleKey: "page.titles.title",
  pageDescKey: "page.titles.desc",
  navKey: "/titles",
  breadcrumbs: [{ labelKey: "nav.titles", to: "/titles" }]
});

useViewerSeo(() => ({
  title: t("page.titles.title"),
  description: buildPageDescription(t("page.titles.desc")),
  path: "/titles",
  keywords: [t("page.titles.title"), t("page.titles.keyword")],
  breadcrumbs: [
    { name: t("nav.home"), path: "/" },
    { name: t("nav.titles"), path: "/titles" }
  ]
}));
</script>

<template>
  <div class="titles-page">
    <el-card class="panel-card">
      <template #header>
        <div class="card-header">
          <div class="header-title">
            <span class="header-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3l3 2 3.5-.5.5 3.5 2.5 2.5-2.5 2.5-.5 3.5L15 18l-3 2-3-2-3.5.5-.5-3.5L2 10.5 4.5 8 .5 4.5 4 5l3-2z"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            <div>
              <h3 class="title-text">{{ t("page.titles.title") }}</h3>
              <p class="subtitle-text">{{ t("page.titles.subtitle") }}</p>
            </div>
          </div>
        </div>
      </template>
      
      <el-skeleton v-if="pending" :rows="10" animated />
      <el-alert
        v-else-if="error"
        :title="t('page.titles.loadFailed')"
        type="error"
        :closable="false"
        show-icon
      />
      <div v-else class="table-wrap">
        <table class="wikitable">
          <thead>
            <tr>
              <th>{{ t("page.titles.columns.rarity") }}</th>
              <th>{{ t("page.titles.columns.name") }}</th>
              <th>{{ t("page.titles.columns.condition") }}</th>
              <th>{{ t("page.titles.columns.songs") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="title in titles" :key="title.id || `${title.name}-${title.rarity}-${title.condition}`">
              <td class="rarity-cell">
                <span class="rarity-badge">{{ title.rarity }}</span>
              </td>
              <td class="title-name">{{ title.name }}</td>
              <td>{{ title.condition || "—" }}</td>
              <td class="song-links">
                <template v-if="title.songIds.length">
                  <NuxtLink v-for="songId in title.songIds" :key="songId" :to="`/songs/${songId}`">
                    #{{ songId }}
                  </NuxtLink>
                </template>
                <span v-else>—</span>
              </td>
            </tr>
            <tr v-if="titles.length === 0">
              <td colspan="4" class="empty-cell">{{ t("page.titles.empty") }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.titles-page {
  display: grid;
}

.panel-card {
  border-radius: 16px;
  box-shadow:none;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background:var(--viewer-surface-subtle);
  color:#a36b39;
}

.header-icon svg {
  width: 20px;
  height: 20px;
}

.title-text {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color:var(--viewer-text-muted);
}

.subtitle-text {
  margin: 4px 0 0;
  font-size: 13px;
  color:var(--viewer-text-muted);
}

.table-wrap {
  overflow-x: auto;
}

.wikitable {
  width: 100%;
  min-width: 760px;
  background-color:#f8f9fa;
  color:#202122;
  margin: 0;
  border: 1px solid #a2a9b1;
  border-collapse: collapse;
}

.wikitable > caption {
  font-weight: 700;
}

.wikitable > thead > tr > th,
.wikitable > tbody > tr > td {
  border: 1px solid #a2a9b1;
  padding: 0.6em 0.8em;
  font-size: 14px;
  line-height: 1.5;
}

.wikitable > thead > tr > th {
  background-color:#eaecf0;
  text-align: center;
  font-weight: 600;
  color:var(--viewer-text-muted);
}

.wikitable > tbody > tr > td {
  vertical-align: top;
}

.rarity-cell {
  width: 72px;
  text-align: center;
}

.rarity-badge {
  display: inline-flex;
  min-width: 32px;
  min-height: 26px;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border-radius: 999px;
  background:#fff0df;
  color:#9a5b25;
  font-weight: 700;
}

.title-name {
  min-width: 180px;
  font-weight: 600;
  color:#5f4632;
}

.song-links {
  min-width: 130px;
}

.song-links a {
  display: inline-block;
  margin: 0 10px 4px 0;
}

.empty-cell {
  padding: 32px !important;
  text-align: center;
  color:#8d7968;
}

.wikitable a {
  color:#0645ad;
  text-decoration: none;
}

.wikitable a:hover,
.wikitable a:focus-visible {
  text-decoration: underline;
}

/* 优化表格行hover效果 */
.wikitable > tbody > tr:hover {
  background-color:var(--viewer-surface-subtle);
}

:deep(.el-card__header) {
  border-bottom: 1px solid var(--viewer-surface-subtle);
  padding: 16px 20px;
}

:deep(.el-card__body) {
  padding: 20px;
}
</style>
