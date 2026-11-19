<script setup lang="ts">
import { computed } from "vue";
import { buildPageDescription } from "~/utils/seo";

interface AliasLogEntry {
  time: string;
  action: string;
  user_id: string;
  user_nickname?: string;
  group_id?: number;
  group_name?: string;
  song_id: string;
  song_title: string;
  alias: string;
}

interface AliasLogResponse {
  success: boolean;
  data: AliasLogEntry[];
  total: number;
  page?: number;
  pageSize?: number;
}

const { t, locale } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();
const { formatDateTime } = useViewerDateTime();

definePageMeta({
  contentLayout: "wide",
  pageTitleKey: "nav.aliasLog",
  pageDescKey: "page.aliasLog.desc",
  navKey: "/alias-log",
  breadcrumbs: [{ labelKey: "nav.aliasLog", to: "/alias-log" }]
});

useViewerSeo(() => ({
  title: t("nav.aliasLog"),
  description: buildPageDescription(t("page.aliasLog.desc")),
  path: "/alias-log",
  keywords: [t("nav.aliasLog"), locale.value === "ja" ? "楽曲別名" : "歌曲别名"]
}));

const copy = computed(() =>
  locale.value === "ja"
    ? {
        subtitle: "全 {total} 件",
        loadFailed: "読み込みに失敗しました。しばらくしてから再試行してください。",
        reload: "再読み込み",
        empty: "別名変更記録はまだありません",
        time: "時刻",
        song: "楽曲",
        alias: "別名",
        user: "操作ユーザー",
        source: "来源",
        action: "操作",
        view: "見る",
        privateChat: "個別チャット",
        searchPlaceholder: "曲名、ID、別名、ユーザーを検索",
        search: "検索"
      }
    : {
        subtitle: "共 {total} 条记录",
        loadFailed: "加载失败，请稍后重试",
        reload: "重新加载",
        empty: "暂无别名记录",
        time: "时间",
        song: "歌曲",
        alias: "别名",
        user: "操作人",
        source: "来源",
        action: "操作",
        view: "查看",
        privateChat: "私聊",
        searchPlaceholder: "搜索曲名、ID、别名或用户",
        search: "搜索"
      }
);

const page = ref(1);
const pageSize = 20;
const keyword = ref("");
const submittedKeyword = ref("");
const { data: response, pending, error, refresh } = await useAsyncData<AliasLogResponse>(
  () => `alias-log-${page.value}-${submittedKeyword.value}`,
  () => apiFetch("/api/alias-log", {
    query: { page: page.value, pageSize, keyword: submittedKeyword.value || undefined }
  }),
  { watch: [page, submittedKeyword] }
);

const logs = computed(() => response.value?.data || []);
const total = computed(() => response.value?.total || 0);
const submitSearch = () => {
  page.value = 1;
  submittedKeyword.value = keyword.value.trim();
};

const formatTime = (timeStr: string): string => formatDateTime(timeStr);

// 获取用户显示名称
const getUserDisplay = (log: AliasLogEntry): string => {
  if (log.user_nickname) {
    return `${log.user_nickname} (${log.user_id})`;
  }
  return log.user_id;
};

// 获取群组显示
const getGroupDisplay = (log: AliasLogEntry): string => {
  if (!log.group_id) return copy.value.privateChat;
  if (log.group_name) {
    return `${log.group_name} (${log.group_id})`;
  }
  return String(log.group_id);
};

// 跳转到歌曲详情
const navigateToSong = (songId: string) => {
  navigateTo(localePath(`/songs/${songId}`));
};
</script>

<template>
  <div class="alias-log-page">
    <el-card class="panel-card">
      <template #header>
        <div class="card-header">
          <div class="header-title">
            <span class="header-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 6v6l3.5 2 M12 3a9 9 0 1 1-6.36 2.64 M4 4v4h4"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            <div>
              <h3 class="title-text">{{ t("nav.aliasLog") }}</h3>
              <p class="subtitle-text">{{ copy.subtitle.replace("{total}", String(total)) }}</p>
            </div>
          </div>
          <form class="alias-search" @submit.prevent="submitSearch">
            <el-input v-model="keyword" clearable :placeholder="copy.searchPlaceholder" @clear="submitSearch" />
            <el-button native-type="submit" type="primary">{{ copy.search }}</el-button>
          </form>
        </div>
      </template>

      <!-- 加载状态 -->
      <div v-if="pending" class="loading-state">
        <el-skeleton :rows="5" animated />
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="error-state">
        <el-empty :description="copy.loadFailed">
          <el-button type="primary" @click="() => refresh()">{{ copy.reload }}</el-button>
        </el-empty>
      </div>

      <!-- 空数据 -->
      <div v-else-if="logs.length === 0" class="empty-state">
        <el-empty :description="copy.empty" />
      </div>

      <!-- 数据表格 -->
      <div v-else class="table-container">
        <table class="alias-table">
          <thead><tr>
            <th>{{ copy.time }}</th><th>{{ copy.song }}</th><th>{{ copy.alias }}</th>
            <th>{{ copy.user }}</th><th>{{ copy.source }}</th><th>{{ copy.action }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="row in logs" :key="`${row.time}-${row.song_id}-${row.alias}`">
              <td><span class="time-cell">{{ formatTime(row.time) }}</span></td>
              <td>
                <button type="button" class="song-cell" @click="navigateToSong(row.song_id)">
                  <span class="song-title">{{ row.song_title }}</span>
                  <span class="song-id">ID: {{ row.song_id }}</span>
                </button>
              </td>
              <td><span class="alias-tag">{{ row.alias }}</span></td>
              <td><span class="user-text">{{ getUserDisplay(row) }}</span></td>
              <td><span class="group-text" :class="{ private: !row.group_id }">{{ getGroupDisplay(row) }}</span></td>
              <td><button type="button" class="view-button" @click="navigateToSong(row.song_id)">{{ copy.view }}</button></td>
            </tr>
          </tbody>
        </table>
        <el-pagination
          v-if="total > pageSize"
          v-model:current-page="page"
          class="alias-pagination"
          background
          layout="prev, pager, next"
          :page-size="pageSize"
          :total="total"
        />
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.alias-log-page {
  padding: 16px;
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

.alias-search {
  display: flex;
  gap: 8px;
  width: min(420px, 48vw);
}

.alias-pagination {
  justify-content: center;
  margin-top: 20px;
}

@media (max-width: 760px) {
  .card-header {
    align-items: stretch;
    flex-direction: column;
    gap: 14px;
  }

  .alias-search {
    width: 100%;
  }
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
  color:var(--viewer-link);
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

.loading-state,
.error-state,
.empty-state {
  padding: 40px 20px;
}

.table-container {
  padding: 8px 0;
  overflow-x: auto;
}

.alias-table {
  width: 100%;
  min-width: 900px;
  border-collapse: separate;
  border-spacing: 0;
  border: 1px solid var(--viewer-surface-subtle);
  border-radius: 12px;
  overflow: hidden;
}

.alias-table th,
.alias-table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--viewer-surface-subtle);
  text-align: left;
  vertical-align: middle;
}

.alias-table th {
  background:var(--viewer-surface-subtle);
  color:var(--viewer-text-muted);
  font-size: 13px;
  font-weight: 600;
}

.alias-table tbody tr:nth-child(even) { background:var(--viewer-surface); }
.alias-table tbody tr:last-child td { border-bottom: 0; }

.time-cell {
  font-size: 13px;
  color:var(--viewer-text-muted);
  font-family: monospace;
}

.song-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
  transition: opacity 0.2s;
  padding: 0;
  border: 0;
  background:transparent;
  text-align: left;
}

.song-cell:hover {
  opacity: 0.8;
}

.song-title {
  font-weight: 500;
  color:var(--viewer-text-muted);
  font-size: 14px;
}

.song-id {
  font-size: 12px;
  color:var(--viewer-text-muted);
}

.alias-tag {
  display: inline-flex;
  padding: 4px 9px;
  border: 1px solid var(--viewer-border);
  background:var(--viewer-warning-surface);
  color:var(--viewer-warning);
  font-size: 13px;
  border-radius: 8px;
}

.view-button {
  padding: 5px;
  border: 0;
  background:transparent;
  color:var(--el-color-primary);
  cursor: pointer;
}

.user-cell,
.group-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-icon,
.group-icon {
  font-size: 14px;
  color:var(--viewer-text-muted);
}

.user-text,
.group-text {
  font-size: 13px;
  color:var(--viewer-text-muted);
}

.group-text.private {
  color:var(--viewer-text-muted);
  font-style: italic;
}

:deep(.el-card__header) {
  border-bottom: 1px solid var(--viewer-surface-subtle);
  padding: 16px 20px;
}

:deep(.el-card__body) {
  padding: 12px 20px 20px;
}
</style>
