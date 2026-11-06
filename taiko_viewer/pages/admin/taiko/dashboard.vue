<script setup lang="ts">
import { computed } from "vue";
import type { EChartsOption } from "echarts";
import type { AdminDashboardPayload } from "~/types/admin";
import { formatAdminDateTime } from "~/utils/admin-time";

defineI18nRoute(false);

definePageMeta({
  layout: "admin-taiko",
  middleware: "admin-auth"
});

useHead({
  title: "工作台"
});

const apiFetch = useAdminApiFetch();
const { data, pending, refresh } = await useAsyncData<AdminDashboardPayload>(
  "admin-taiko-dashboard",
  () => apiFetch("/api/admin/dashboard"),
  { default: () => null as unknown as AdminDashboardPayload }
);

const dashboard = computed(() => data.value);
const trafficStatusLabels: Record<string, string> = { pending: '等待统计', stale: '统计更新延迟', backfilling: '历史数据回填中', ready: '已更新' };
const trafficStatus = computed(() => trafficStatusLabels[dashboard.value?.trafficQuality.status || 'pending'] || '等待统计');
const trafficReady = computed(() => dashboard.value?.trafficQuality.status === 'ready');
const taikoCommandSinceText = computed(() => {
  const value = dashboard.value?.taikoCommandStatsSince;
  if (!value) return "新口径已启用，30 天窗口会逐步补满。";
  return `新口径自 ${formatAdminDateTime(value)} 开始累计，30 天窗口会逐步补满。`;
});

const accessOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: "axis" },
  legend: {
    top: 0,
    textStyle: { color: "#6b5d4d" }
  },
  grid: { left: 16, right: 16, bottom: 16, top: 52, containLabel: true },
  xAxis: {
    type: "category",
    data: dashboard.value?.trends.accessHourly.map((item) => item.label) || [],
    axisLabel: { color: "#7b6d5c", rotate: 35 }
  },
  yAxis: {
    type: "value",
    axisLabel: { color: "#7b6d5c" },
    splitLine: { lineStyle: { color: "rgba(148, 125, 87, 0.12)" } }
  },
  series: [
    {
      name: "页面请求 PV",
      type: "line",
      smooth: true,
      symbol: "circle",
      data: dashboard.value?.trends.accessHourly.map((item) => item.pv || 0) || [],
      lineStyle: { color: "#d78f3f", width: 3 },
      itemStyle: { color: "#d78f3f" },
      areaStyle: { color: "rgba(215, 143, 63, 0.18)" }
    },
    {
      name: "独立 IP",
      type: "line",
      smooth: true,
      symbol: "circle",
      data: dashboard.value?.trends.accessHourly.map((item) => item.uv || 0) || [],
      lineStyle: { color: "#1d7688", width: 3 },
      itemStyle: { color: "#1d7688" }
    },
    {
      name: "首页请求",
      type: "bar",
      data: dashboard.value?.trends.accessHourly.map((item) => item.homePv || 0) || [],
      itemStyle: { color: "rgba(85, 56, 141, 0.82)", borderRadius: [6, 6, 0, 0] }
    }
  ]
}));

const growthOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: "axis" },
  legend: {
    top: 0,
    textStyle: { color: "#6b5d4d" }
  },
  grid: { left: 16, right: 16, bottom: 16, top: 52, containLabel: true },
  xAxis: {
    type: "category",
    data: dashboard.value?.trends.daily.map((item) => item.day.slice(5)) || [],
    axisLabel: { color: "#7b6d5c" }
  },
  yAxis: {
    type: "value",
    axisLabel: { color: "#7b6d5c" },
    splitLine: { lineStyle: { color: "rgba(148, 125, 87, 0.12)" } }
  },
  series: [
    {
      name: "新增 viewer 用户",
      type: "bar",
      data: dashboard.value?.trends.daily.map((item) => item.newUsers) || [],
      itemStyle: { color: "#4456ab", borderRadius: [6, 6, 0, 0] }
    },
    {
      name: "新增绑定",
      type: "bar",
      data: dashboard.value?.trends.daily.map((item) => item.newBindings) || [],
      itemStyle: { color: "#b64d6f", borderRadius: [6, 6, 0, 0] }
    },
    {
      name: "上传快照数",
      type: "line",
      smooth: true,
      data: dashboard.value?.trends.daily.map((item) => item.uploads) || [],
      lineStyle: { color: "#0c7b59", width: 3 },
      itemStyle: { color: "#0c7b59" }
    }
  ]
}));

const botOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: "axis" },
  grid: { left: 16, right: 16, bottom: 16, top: 24, containLabel: true },
  xAxis: {
    type: "category",
    data: dashboard.value?.topCommands.map((item) => item.name) || [],
    axisLabel: { color: "#7b6d5c", interval: 0, rotate: 20 }
  },
  yAxis: {
    type: "value",
    axisLabel: { color: "#7b6d5c" },
    splitLine: { lineStyle: { color: "rgba(148, 125, 87, 0.12)" } }
  },
  series: [
    {
      type: "bar",
      data: dashboard.value?.topCommands.map((item) => item.count) || [],
      itemStyle: {
        color: "#d78032",
        borderRadius: [10, 10, 0, 0]
      }
    }
  ]
}));
</script>

<template>
  <div class="admin-page-stack">
    <div class="admin-toolbar">
      <el-button :loading="pending" @click="refresh()">刷新数据</el-button>
    </div>

    <div class="admin-metric-grid" v-if="dashboard">
      <AdminMetricCard label="Viewer 用户数" :value="dashboard.summary.viewerUsers" hint="web_user_accounts" accent="gold" />
      <AdminMetricCard label="Taiko 绑定数" :value="dashboard.summary.taikoBindings" hint="bind ∪ hiroba" accent="teal" />
      <AdminMetricCard label="Wahlap 用户" :value="dashboard.summary.wahlapBindings" hint="国服绑定" accent="indigo" />
      <AdminMetricCard label="海外用户" :value="dashboard.summary.hirobaBindings" hint="hiroba 绑定" accent="gold" />
      <AdminMetricCard label="总用户数" :value="dashboard.summary.totalUsers" hint="绑定实体 + 未绑定 viewer" accent="rose" />
      <AdminMetricCard label="总上传次数" :value="dashboard.summary.totalUploads" hint="userdata 历史快照" accent="indigo" />
      <AdminMetricCard label="24h 上传总量" :value="dashboard.summary.uploads24h" hint="最近 24h 快照文件" />
      <AdminMetricCard label="24h 页面请求 PV / 独立 IP" :value="trafficReady ? `${dashboard.summary.pagePv24h} / ${dashboard.summary.pageUv24h}` : '—'" hint="成功页面请求；IP 在整个窗口内去重" />
      <AdminMetricCard label="24h 首页请求" :value="trafficReady ? dashboard.summary.homePv24h : '—'" hint="首页的有效页面请求" />
      <AdminMetricCard label="24h 疑似自动化请求" :value="trafficReady ? dashboard.trafficQuality.suspected24h : '—'" hint="已从页面请求统计中排除" />
      <AdminMetricCard label="24h 其他排除请求" :value="trafficReady ? dashboard.trafficQuality.excluded24h : '—'" hint="接口、资源、错误响应与已知自动化等" />
      <AdminMetricCard
        label="24h 太鼓指令调用"
        :value="dashboard.summary.botCommands24h"
        :hint="`QQ 官方 ${dashboard.summary.botCommands24hByPlatform.qqOfficial} / OneBot ${dashboard.summary.botCommands24hByPlatform.onebotV11}`"
      />
    </div>

    <section v-if="dashboard" class="admin-card traffic-quality" aria-label="访问统计口径">
      <p role="status"><strong>{{ trafficStatus }}</strong> · 检查时间：{{ dashboard.trafficQuality.checkedAt ? formatAdminDateTime(dashboard.trafficQuality.checkedAt) : '—' }}</p>
      <p>统计窗口：{{ formatAdminDateTime(dashboard.trafficQuality.windowStart) }} — {{ formatAdminDateTime(dashboard.trafficQuality.windowEnd) }}（北京时间）</p>
      <p>按完整分钟统计服务器收到的页面请求，不含站内无刷新跳转。独立 IP 不等于实际人数；疑似自动化仅影响统计，不封禁访问。</p>
      <p v-if="!dashboard.trafficQuality.complete24h">当前日志未完整覆盖此窗口，数据可能不全。</p>
      <p v-if="dashboard.trafficQuality.gapAt">检测到日志缺口：{{ formatAdminDateTime(dashboard.trafficQuality.gapAt) }}</p>
      <p v-if="dashboard.trafficQuality.malformedLines">未能解析的日志：{{ dashboard.trafficQuality.malformedLines }} 条（累计）</p>
      <details>
        <summary>排除原因 · 24h 原始请求 {{ dashboard.trafficQuality.rawRequests24h }}</summary>
        <ul><li v-for="reason in dashboard.trafficQuality.reasons" :key="reason.key">{{ reason.label }}：{{ reason.count }}</li></ul>
      </details>
    </section>

    <el-skeleton v-if="pending && !dashboard" :rows="10" animated />

    <div v-else-if="dashboard" class="admin-chart-grid">
      <AdminChartCard
        title="最近 48 小时访问走势"
        subtitle="有效页面请求、每小时独立 IP 与首页请求；回填期间数据不完整。"
        :option="accessOption"
        :height="340"
      />
      <AdminChartCard
        title="增长与上传趋势"
        subtitle="按日聚合的新增用户、绑定新增和上传快照走势。"
        :option="growthOption"
        :height="340"
      />
      <AdminChartCard
        title="30 天 Top 指令"
        :subtitle="taikoCommandSinceText"
        :option="botOption"
        :height="320"
      />

      <el-card class="admin-panel-card">
        <template #header>
          <div class="admin-panel-card__header">
            <span>最近备份</span>
            <small>每日备份 + 本地写前快照</small>
          </div>
        </template>
        <el-empty v-if="!dashboard.backups.length" description="暂无备份记录" />
        <div v-else class="admin-list">
          <div v-for="item in dashboard.backups" :key="item.path" class="admin-list__item">
            <strong>{{ item.name }}</strong>
            <span>{{ item.category }} · {{ formatAdminDateTime(item.createdAt) }}</span>
            <span class="mono">{{ item.path }}</span>
          </div>
        </div>
      </el-card>

      <el-card class="admin-panel-card">
        <template #header>
          <div class="admin-panel-card__header">
            <span>最近审计动作</span>
            <small>统一来源：admin-web / bot / system-backup</small>
          </div>
        </template>
        <el-empty v-if="!dashboard.recentAudits.length" description="暂无审计记录" />
        <div v-else class="admin-list">
          <div v-for="item in dashboard.recentAudits" :key="item.id" class="admin-list__item">
            <strong>{{ item.action.toUpperCase() }} · {{ item.targetType }}</strong>
            <span>{{ item.actorName || item.actorId || item.source }} · {{ formatAdminDateTime(item.createdAt) }}</span>
            <span class="mono">{{ item.targetKey }}</span>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.traffic-quality {
  padding: 16px 20px;
  border-radius: 16px;
  background: var(--el-bg-color);
  color: var(--el-text-color-regular);
  overflow-wrap: anywhere;
}
.traffic-quality p { margin: 0 0 10px; line-height: 1.6; }
.traffic-quality summary { cursor: pointer; padding: 10px 0; }
.traffic-quality ul { margin: 8px 0; padding-left: 24px; line-height: 1.8; }
.admin-page-stack {
  display: grid;
  gap: 20px;
}

.admin-toolbar {
  display: flex;
  justify-content: flex-end;
}

.admin-metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.admin-chart-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.admin-panel-card {
  border-radius: 24px;
  border: none;
}

.admin-panel-card__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-weight: 700;
}

.admin-panel-card__header small {
  color: #8a7a66;
  font-weight: 400;
}

.admin-list {
  display: grid;
  gap: 12px;
}

.admin-list__item {
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(247, 242, 232, 0.76);
  display: grid;
  gap: 6px;
}

.admin-list__item span {
  color: #6c6050;
  font-size: 13px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  word-break: break-all;
}

@media (max-width: 1180px) {
  .admin-metric-grid,
  .admin-chart-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .admin-metric-grid,
  .admin-chart-grid {
    grid-template-columns: 1fr;
  }
}
</style>
