<script setup lang="ts">
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

const pageMeta = {
  title: "别名修改日志",
  desc: buildPageDescription("记录太鼓达人国行歌曲别名更新历史。")
};

definePageMeta({
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/alias-log",
  breadcrumbs: [{ label: "别名修改日志", to: "/alias-log" }]
});

useViewerSeo({
  title: pageMeta.title,
  description: pageMeta.desc,
  path: "/alias-log",
  keywords: ["别名日志", "歌曲别名"]
});

// 获取数据
const { data: response, pending, error } = await useFetch<AliasLogResponse>("/api/alias-log");

const logs = computed(() => response.value?.data || []);
const total = computed(() => response.value?.total || 0);

// 格式化时间
const formatTime = (timeStr: string): string => {
  const date = new Date(timeStr);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

// 获取用户显示名称
const getUserDisplay = (log: AliasLogEntry): string => {
  if (log.user_nickname) {
    return `${log.user_nickname} (${log.user_id})`;
  }
  return log.user_id;
};

// 获取群组显示
const getGroupDisplay = (log: AliasLogEntry): string => {
  if (!log.group_id) return "私聊";
  if (log.group_name) {
    return `${log.group_name} (${log.group_id})`;
  }
  return String(log.group_id);
};

// 跳转到歌曲详情
const navigateToSong = (songId: string) => {
  navigateTo(`/songs/${songId}`);
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
              <h3 class="title-text">别名修改日志</h3>
              <p class="subtitle-text">共 {{ total }} 条记录</p>
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
        <el-empty description="加载失败，请稍后重试">
          <el-button type="primary" @click="refreshNuxtData('alias-log')">
            重新加载
          </el-button>
        </el-empty>
      </div>

      <!-- 空数据 -->
      <div v-else-if="logs.length === 0" class="empty-state">
        <el-empty description="暂无别名记录" />
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
          <el-table-column label="时间" width="150" fixed>
            <template #default="{ row }">
              <span class="time-cell">{{ formatTime(row.time) }}</span>
            </template>
          </el-table-column>

          <el-table-column label="歌曲" min-width="200">
            <template #default="{ row }">
              <div class="song-cell" @click="navigateToSong(row.song_id)">
                <span class="song-title">{{ row.song_title }}</span>
                <span class="song-id">ID: {{ row.song_id }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="别名" width="150">
            <template #default="{ row }">
              <el-tag type="warning" effect="light" class="alias-tag">
                {{ row.alias }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column label="操作人" min-width="180">
            <template #default="{ row }">
              <div class="user-cell">
                <el-icon class="user-icon"><User /></el-icon>
                <span class="user-text">{{ getUserDisplay(row) }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="来源" min-width="180">
            <template #default="{ row }">
              <div class="group-cell">
                <el-icon class="group-icon"><ChatDotRound /></el-icon>
                <span class="group-text" :class="{ 'private': !row.group_id }">
                  {{ getGroupDisplay(row) }}
                </span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="操作" width="80" fixed="right">
            <template #default="{ row }">
              <el-button
                link
                type="primary"
                size="small"
                @click="navigateToSong(row.song_id)"
              >
                查看
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
