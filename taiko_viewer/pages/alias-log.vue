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
}

const { t, locale } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();
const { formatDateTime } = useViewerDateTime();

definePageMeta({
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
        privateChat: "個別チャット"
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
        privateChat: "私聊"
      }
);

const { data: response, pending, error, refresh } = await useAsyncData<AliasLogResponse>(
  "alias-log",
  () => apiFetch("/api/alias-log")
);

const logs = computed(() => response.value?.data || []);
const total = computed(() => response.value?.total || 0);

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
        </div>
      </template>

      <!-- 加载状态 -->
      <div v-if="pending" class="loading-state">
        <el-skeleton :rows="5" animated />
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="error-state">
        <el-empty :description="copy.loadFailed">
          <el-button type="primary" @click="refresh">{{ copy.reload }}</el-button>
        </el-empty>
      </div>

      <!-- 空数据 -->
      <div v-else-if="logs.length === 0" class="empty-state">
        <el-empty :description="copy.empty" />
      </div>

      <!-- 数据表格 -->
      <div v-else class="table-container">
        <el-table
          :data="logs"
          stripe
          style="width: 100%"
          :header-cell-style="{
            background: '#faf5ef',
            color: '#73573d',
            fontWeight: 600
          }"
        >
          <el-table-column :label="copy.time" width="150" fixed>
            <template #default="{ row }">
              <span class="time-cell">{{ formatTime(row.time) }}</span>
            </template>
          </el-table-column>

          <el-table-column :label="copy.song" min-width="200">
            <template #default="{ row }">
              <div class="song-cell" @click="navigateToSong(row.song_id)">
                <span class="song-title">{{ row.song_title }}</span>
                <span class="song-id">ID: {{ row.song_id }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column :label="copy.alias" width="150">
            <template #default="{ row }">
              <el-tag type="warning" effect="light" class="alias-tag">
                {{ row.alias }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column :label="copy.user" min-width="180">
            <template #default="{ row }">
              <div class="user-cell">
                <el-icon class="user-icon"><User /></el-icon>
                <span class="user-text">{{ getUserDisplay(row) }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column :label="copy.source" min-width="180">
            <template #default="{ row }">
              <div class="group-cell">
                <el-icon class="group-icon"><ChatDotRound /></el-icon>
                <span class="group-text" :class="{ 'private': !row.group_id }">
                  {{ getGroupDisplay(row) }}
                </span>
              </div>
            </template>
          </el-table-column>

          <el-table-column :label="copy.action" width="80" fixed="right">
            <template #default="{ row }">
              <el-button
                link
                type="primary"
                size="small"
                @click="navigateToSong(row.song_id)"
              >
                {{ copy.view }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
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
  box-shadow: 0 8px 24px rgba(160, 120, 86, 0.12);
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
  background: linear-gradient(135deg, rgba(248, 224, 193, 0.85), rgba(255, 244, 230, 0.95));
  color: #a36b39;
}

.header-icon svg {
  width: 20px;
  height: 20px;
}

.title-text {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #73573d;
}

.subtitle-text {
  margin: 4px 0 0;
  font-size: 13px;
  color: #9b7a5c;
}

.loading-state,
.error-state,
.empty-state {
  padding: 40px 20px;
}

.table-container {
  padding: 8px 0;
}

.time-cell {
  font-size: 13px;
  color: #8b6d53;
  font-family: monospace;
}

.song-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.song-cell:hover {
  opacity: 0.8;
}

.song-title {
  font-weight: 500;
  color: #73573d;
  font-size: 14px;
}

.song-id {
  font-size: 12px;
  color: #9b7a5c;
}

.alias-tag {
  font-size: 13px;
  border-radius: 8px;
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
  color: #9b7a5c;
}

.user-text,
.group-text {
  font-size: 13px;
  color: #73573d;
}

.group-text.private {
  color: #9b7a5c;
  font-style: italic;
}

:deep(.el-table) {
  --el-table-border-color: #f0e6dc;
  --el-table-row-hover-bg-color: #faf5ef;
  border-radius: 12px;
  overflow: hidden;
}

:deep(.el-table__row) {
  transition: background-color 0.2s;
}

:deep(.el-card__header) {
  border-bottom: 1px solid #f0e6dc;
  padding: 16px 20px;
}

:deep(.el-card__body) {
  padding: 12px 20px 20px;
}
</style>
