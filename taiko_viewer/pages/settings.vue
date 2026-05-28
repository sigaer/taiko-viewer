<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
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

const theme = ref("light");

const applyTheme = (value: string) => {
  if (!process.client) return;
  document.body.classList.toggle("theme-dark", value === "dark");
};

if (process.client) {
  theme.value = localStorage.getItem("taiko_theme") || "light";

  watch(theme, (value) => {
    localStorage.setItem("taiko_theme", value);
    applyTheme(value);
  });

  onMounted(() => {
    applyTheme(theme.value);
  });
}

const cacheItems = computed(() => (process.client ? Object.keys(localStorage) : []));
const cacheSize = computed(() => {
  if (!process.client) return 0;
  let total = 0;
  cacheItems.value.forEach((key) => {
    const value = localStorage.getItem(key) || "";
    total += key.length + value.length;
  });
  return Math.round((total / 1024) * 10) / 10;
});

const clearCache = () => {
  if (!process.client) return;
  localStorage.clear();
};
</script>

<template>
  <div class="page-stack">
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
          <p>{{ copy.shortcutsDesc }}</p>
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

    <el-card class="panel-card">
      <div class="panel-header">
        <div>
          <h3 class="panel-title">
            <span class="section-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z M4 12h2.2l.4-1.4-1.6-1.2 2-3.2 1.8.7 1.1-1.1-.7-1.8 3.2-1.2 1 1.6h1.6l1-1.6 3.2 1.2-.7 1.8 1.1 1.1 1.8-.7 2 3.2-1.6 1.2.4 1.4H20"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            {{ copy.theme }}
          </h3>
          <p>{{ copy.themeDesc }}</p>
        </div>
      </div>
      <div class="setting-row">
        <span>{{ copy.themeMode }}</span>
        <el-switch
          v-model="theme"
          active-value="dark"
          inactive-value="light"
          :active-text="copy.dark"
          :inactive-text="copy.light"
        />
      </div>
    </el-card>

    <el-card class="panel-card">
      <div class="panel-header">
        <div>
          <h3 class="panel-title">
            <span class="section-icon alt" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 7h16M7 12h10M9 17h6"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
              </svg>
            </span>
            {{ copy.cache }}
          </h3>
          <p>{{ copy.cacheDesc }}</p>
        </div>
        <el-button type="danger" plain @click="clearCache">
          <span class="btn-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M7 7l1 12a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l1-12"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
          {{ copy.clearCache }}
        </el-button>
      </div>
      <div class="cache-info">
        <div class="cache-card">
          <div class="cache-label">
            <span class="mini-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </span>
            {{ copy.cacheItems }}
          </div>
          <div class="cache-value">{{ cacheItems.length }}</div>
        </div>
        <div class="cache-card">
          <div class="cache-label">
            <span class="mini-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 18h12M8 14h8M10 10h4"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
              </svg>
            </span>
            {{ copy.cacheSize }}
          </div>
          <div class="cache-value">{{ cacheSize }} KB</div>
        </div>
      </div>
      <el-table :data="cacheItems.map((key) => ({ key }))" border height="240" :empty-text="copy.empty">
        <el-table-column prop="key" :label="copy.cacheKey" />
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.page-stack {
  display: grid;
  gap: 20px;
}

.panel-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.panel-header h3 {
  margin: 0 0 6px;
  font-size: 18px;
}

.panel-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.section-icon {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #9a6d47;
  background: rgba(196, 127, 79, 0.2);
  border-radius: 6px;
}

.section-icon svg {
  width: 14px;
  height: 14px;
}

.section-icon.alt {
  background: rgba(88, 136, 197, 0.2);
  color: #3c6aa6;
}

.panel-header p {
  margin: 0;
  color: #6c5a4b;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  font-size: 14px;
}

.cache-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.tool-links {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.tool-link {
  display: grid;
  gap: 6px;
  padding: 14px;
  border-radius: 16px;
  text-decoration: none;
  color: #3d2f25;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 8px 18px rgba(165, 138, 110, 0.12);
}

.tool-link strong {
  font-size: 15px;
}

.tool-link span {
  color: #6c5a4b;
  line-height: 1.7;
}

.cache-card {
  border-radius: 16px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 8px 18px rgba(165, 138, 110, 0.12);
}

.cache-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #7a6552;
}

.mini-icon {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #9a6d47;
}

.mini-icon svg {
  width: 12px;
  height: 12px;
}

.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-right: 6px;
}

.btn-icon svg {
  width: 14px;
  height: 14px;
}

.cache-value {
  font-size: 20px;
  font-weight: 600;
  margin-top: 4px;
}
</style>
