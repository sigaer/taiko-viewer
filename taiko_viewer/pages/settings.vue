<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { buildPageDescription } from "~/utils/seo";

const { t, locale } = useI18n();
const localePath = useLocalePath();
const { accountUser, fetchCurrentUser } = useAccountState();
await fetchCurrentUser();

definePageMeta({
  pageTitleKey: "nav.settings",
  pageDescKey: "page.settings.desc",
  navKey: "/settings",
  breadcrumbs: [{ labelKey: "nav.settings", to: "/settings" }]
});

useViewerSeo(() => ({
  title: t("nav.settings"),
  description: buildPageDescription(t("page.settings.desc")),
  path: "/settings"
}));

const copy = computed(() =>
  locale.value === "ja"
    ? {
        shortcuts: "ショートカット",
        shortcutsDesc: "コミュニティ、同期、開発者向け機能へすぐ移動できます。",
        forum: "フォーラム",
        forumDesc: "セクション、通知、スレッドの動きを確認します",
        support: "サポートチケット",
        supportDesc: "不具合報告や機能要望を運営メールへ直接送信します",
        sync: "同期",
        syncDesc: "現在の連携 ID の成績 JSON を同期します",
        developer: "開発者権限",
        developerDesc: "申請、審査状態、Token を確認します",
        review: "開発者審査",
        reviewDesc: "審査待ち申請を処理し、開発者 Token を発行します",
        supportReview: "サポート審査",
        supportReviewDesc: "ユーザーのサポートチケットを処理し、返信して完了します",
        theme: "テーマ設定",
        themeDesc: "ライト / ダークテーマを切り替えます。",
        themeMode: "テーマ",
        dark: "ダーク",
        light: "ライト",
        cache: "キャッシュ",
        cacheDesc: "ローカルキャッシュの内容を確認します。",
        clearCache: "キャッシュを削除",
        cacheItems: "キャッシュ件数",
        cacheSize: "推定サイズ",
        empty: "キャッシュはありません",
        cacheKey: "キャッシュキー"
      }
    : {
        shortcuts: "站内快捷入口",
        shortcutsDesc: "这里可以直接进入社区、多端同步和开发者相关功能。",
        forum: "论坛社区",
        forumDesc: "查看版块、通知和帖子动态",
        support: "工单支持",
        supportDesc: "把问题反馈或功能建议提交给站务，并查看对话进度",
        sync: "多端同步",
        syncDesc: "同步当前绑定 ID 的完整成绩 JSON",
        developer: "开发者权限",
        developerDesc: "提交申请、查看审批状态和 Token",
        review: "开发者审批",
        reviewDesc: "处理待审批申请并签发开发者 Token",
        supportReview: "工单审批",
        supportReviewDesc: "处理用户工单、回复问题并关闭已完成工单",
        theme: "主题设置",
        themeDesc: "切换浅色/深色主题。",
        themeMode: "主题模式",
        dark: "深色",
        light: "浅色",
        cache: "缓存文件",
        cacheDesc: "查看本地缓存信息。",
        clearCache: "清空缓存",
        cacheItems: "缓存条目",
        cacheSize: "估算大小",
        empty: "暂无缓存",
        cacheKey: "缓存键"
      }
);

const isDeveloperReviewer = computed(
  () => accountUser.value?.username === "sigaer" && accountUser.value?.email === "1106865024@qq.com"
);

const {theme}=useViewerTheme();

const cacheItems = ref<string[]>([]);
const refreshCacheItems = () => { if (import.meta.client) cacheItems.value = Object.keys(localStorage); };
onMounted(refreshCacheItems);
const cacheSize = computed(() => {
  if (!import.meta.client) return 0;
  const total = cacheItems.value.reduce((size, key) => size + key.length + (localStorage.getItem(key)?.length || 0), 0);
  return Math.round((total / 1024) * 10) / 10;
});
const clearCache = () => {
  if (!import.meta.client) return;
  localStorage.clear();
  refreshCacheItems();
};
</script>

<template>
  <div class="page-stack">
    <section class="settings-theme setting-row" aria-labelledby="theme-title">
      <h2 id="theme-title">{{ copy.theme }}</h2>
      <el-switch v-model="theme" active-value="dark" inactive-value="light" :active-text="copy.dark" :inactive-text="copy.light" :aria-label="copy.themeMode" />
    </section>
    <el-card class="panel-card cache-panel">
      <div class="panel-header">
        <div>
          <h2>{{ copy.cache }}</h2>
          <p class="cache-summary">{{ copy.cacheItems }} {{ cacheItems.length }} · {{ copy.cacheSize }} {{ cacheSize }} KB</p>
        </div>
        <el-button type="danger" plain @click="clearCache">{{ copy.clearCache }}</el-button>
      </div>
      <details class="cache-details" @toggle="refreshCacheItems">
        <summary>{{ locale === 'ja' ? 'キャッシュの詳細' : '查看缓存明细' }}</summary>
        <el-table :data="cacheItems.map((key) => ({ key }))" border max-height="240" :empty-text="copy.empty">
          <el-table-column prop="key" :label="copy.cacheKey" />
        </el-table>
      </details>
    </el-card>
    <el-card class="panel-card">
      <div class="panel-header">
        <div>
          <h3 class="panel-title">
            <span class="section-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 6h6v6H4z M14 6h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            {{ copy.shortcuts }}
          </h3>
        </div>
      </div>
      <div class="tool-links">
        <NuxtLink :to="localePath('/forum')" class="tool-link">
          <strong>{{ copy.forum }}</strong>
          <span>{{ copy.forumDesc }}</span>
        </NuxtLink>
        <NuxtLink :to="localePath('/support')" class="tool-link">
          <strong>{{ copy.support }}</strong>
          <span>{{ copy.supportDesc }}</span>
        </NuxtLink>
        <NuxtLink :to="localePath('/account/sync')" class="tool-link">
          <strong>{{ copy.sync }}</strong>
          <span>{{ copy.syncDesc }}</span>
        </NuxtLink>
        <NuxtLink :to="localePath('/account/developer')" class="tool-link">
          <strong>{{ copy.developer }}</strong>
          <span>{{ copy.developerDesc }}</span>
        </NuxtLink>
        <NuxtLink v-if="isDeveloperReviewer" :to="localePath('/account/developer/review')" class="tool-link">
          <strong>{{ copy.review }}</strong>
          <span>{{ copy.reviewDesc }}</span>
        </NuxtLink>
        <NuxtLink v-if="isDeveloperReviewer" :to="localePath('/account/support/review')" class="tool-link">
          <strong>{{ copy.supportReview }}</strong>
          <span>{{ copy.supportReviewDesc }}</span>
        </NuxtLink>
      </div>
    </el-card>
  </div>
</template>
<style scoped>
.page-stack { display: grid; gap: 20px; }
.setting-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.setting-row h2, .panel-header h2, .panel-header h3 { margin: 0; font-size: 18px; font-weight: 600; }
.panel-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 12px; }
.cache-summary { margin: 8px 0 0; color: var(--viewer-text-muted); font-size: 14px; }
.cache-details summary { min-height: 44px; align-content: center; cursor: pointer; color: var(--viewer-link); font-size: 14px; }
.cache-details summary:focus-visible { outline: 3px solid var(--viewer-link); outline-offset: 2px; }
.panel-title { display: inline-flex; align-items: center; gap: 8px; }
.section-icon { display: inline-flex; width: 20px; height: 20px; color: var(--viewer-text-muted); }
.section-icon svg { width: 20px; height: 20px; }
.tool-links { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.tool-link { display: grid; gap: 6px; padding: 14px; border-radius: 10px; text-decoration: none; color: var(--viewer-text); background: var(--viewer-surface-subtle); }
.tool-link strong { font-size: 15px; font-weight: 600; }
.tool-link span { color: var(--viewer-text-muted); line-height: 1.7; }
</style>
