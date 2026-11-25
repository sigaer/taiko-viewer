<script setup lang="ts">
import { computed, ref } from "vue";
import type { EChartsOption } from "echarts";
import type { AdminDashboardPayload } from "~/types/admin";
import {
  formatAdminClock,
  formatAdminDateTime,
  formatAdminMonthDay,
  formatAdminRelativeTime
} from "~/utils/admin-time";

defineI18nRoute(false);

definePageMeta({
  layout: "admin-taiko",
  middleware: "admin-auth"
});

useHead({
  title: "工作台"
});

const apiFetch = useAdminApiFetch();
const loadedAt = useState<number>("admin-taiko-dashboard-loaded-at", () => Date.now());
const { data, pending, error, refresh } = await useLazyAsyncData<AdminDashboardPayload>(
  "admin-taiko-dashboard",
  async () => {
    const payload = await apiFetch<AdminDashboardPayload>("/api/admin/dashboard");
    loadedAt.value = Date.now();
    return payload;
  },
  { server: false, default: () => null as unknown as AdminDashboardPayload }
);

const dashboard = computed(() => data.value);

/* ---------- formatting ---------- */

const DAY_MS = 24 * 60 * 60 * 1000;
const formatCount = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("zh-CN") : "—";
};
const relative = (value: unknown) => formatAdminRelativeTime(value, loadedAt.value);

const palette = {
  primary: "#006c76",
  primaryArea: "rgba(0, 108, 118, 0.08)",
  amber: "#c98a2e",
  ink: "#1b2426",
  secondary: "#5d6b6e",
  grid: "#eef2f2",
  axis: "#d5dddd"
};

/* ---------- header status ---------- */

const trafficStatusPills: Record<string, string> = {
  pending: "访问数据统计中",
  backfilling: "访问数据补录中",
  stale: "访问数据延迟"
};
const trafficReady = computed(() => dashboard.value?.trafficQuality.status === "ready");
const trafficStatusPill = computed(() => {
  const status = dashboard.value?.trafficQuality.status;
  if (!status || status === "ready") return "";
  return trafficStatusPills[status] || "访问数据统计中";
});
const trafficIncomplete = computed(() => {
  const quality = dashboard.value?.trafficQuality;
  return Boolean(quality && !quality.complete24h);
});
const trafficGapTitle = computed(() => {
  const gapAt = dashboard.value?.trafficQuality.gapAt;
  return gapAt ? `缺失时间：${formatAdminDateTime(gapAt)}` : "近 24 小时记录未完整覆盖";
});

/* ---------- key numbers ---------- */

const daily = computed(() => dashboard.value?.trends.daily || []);
const daily14 = computed(() => daily.value.slice(-14));
const daily30 = computed(() => daily.value.slice(-30));

const keyTiles = computed(() => {
  const summary = dashboard.value?.summary;
  if (!summary) return [];
  const ready = trafficReady.value;
  const platform = summary.botCommands24hByPlatform;
  return [
    {
      key: "pv",
      label: "浏览量",
      value: ready ? summary.pagePv24h : "—",
      help: "页面打开次数，已排除识别出的机器访问",
      sub: "",
      accent: "teal" as const,
      color: palette.primary,
      spark: ready ? daily14.value.map((item) => item.pv) : []
    },
    {
      key: "uploads",
      label: "成绩上传",
      value: summary.uploads24h,
      sub: summary.uploads24h > 0 ? `来自 ${formatCount(summary.uploaders24h)} 位玩家` : "",
      help: "",
      accent: "gold" as const,
      color: palette.amber,
      spark: daily14.value.map((item) => item.uploads)
    },
    {
      key: "bot",
      label: "Bot 指令",
      value: summary.botCommands24h,
      help: `QQ 官方 ${formatCount(platform.qqOfficial)} · 其他 ${formatCount(platform.onebotV11)}`,
      sub: "",
      accent: "gold" as const,
      color: palette.amber,
      spark: (dashboard.value?.trends.botHourly || []).map((item) => Number(item.count || 0))
    }
  ];
});

const withinLast30Days = (value: string | null | undefined) => {
  if (!value) return false;
  const time = new Date(value.length === 10 ? `${value}T00:00:00+08:00` : value).getTime();
  return !Number.isNaN(time) && loadedAt.value - time <= 30 * DAY_MS;
};

const activeTile = computed(() => {
  const summary = dashboard.value?.summary;
  if (!summary) return null;
  const tracked = summary.dauToday !== null && summary.dauToday !== undefined;
  const since = dashboard.value?.dauSince || null;
  const today = tracked ? Number(summary.dauToday) : 0;
  const yesterday = summary.dauYesterday ?? null;
  const delta = tracked && yesterday !== null ? today - yesterday : null;
  return {
    value: tracked ? today : "—",
    delta: delta === null ? "" : `较昨日 ${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${formatCount(Math.abs(delta))}`,
    split: tracked
      ? `已登录 ${formatCount(summary.dauLoggedIn ?? 0)} · 未登录 ${formatCount(summary.dauAnonymous ?? 0)}`
      : "",
    spark: tracked
      ? daily14.value
          .filter((item) => item.activeUsers !== null && item.activeUsers !== undefined)
          .map((item) => Number(item.activeUsers))
      : [],
    sinceNote:
      tracked && since && withinLast30Days(since)
        ? `自 ${formatAdminMonthDay(`${since}T00:00:00+08:00`)} 起统计`
        : ""
  };
});

/* ---------- users ---------- */

const users = computed(() => {
  const summary = dashboard.value?.summary;
  if (!summary) return null;
  const segments = [
    { key: "viewer", label: "仅 Viewer", value: summary.viewerOnlyUsers, color: palette.primary },
    { key: "linked", label: "网站＋Bot", value: summary.linkedUsers, color: palette.amber },
    { key: "bot", label: "仅 Bot", value: summary.botOnlyUsers, color: "#cfd8d8" }
  ];
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  return {
    summary,
    segments: segments.map((item) => ({
      ...item,
      percent: total > 0 ? (item.value / total) * 100 : 0
    }))
  };
});

/* ---------- charts ---------- */

const accessRange = ref<"48h" | "30d">("48h");
const accessRanges = [
  { value: "48h" as const, label: "48 小时" },
  { value: "30d" as const, label: "30 天" }
];

const hourLabel = (label: string) => {
  // label looks like "10-02 01:00"; show the date at midnight, otherwise the hour.
  const [day = "", time = label] = label.split(" ");
  return time === "00:00" && day ? day.replace("-", "/") : time;
};
const dayLabel = (day: string) => day.slice(5).replace("-", "/");

const valueFormatter = (value: unknown) => formatCount(value);

const baseAxisLabel = { color: palette.secondary, fontSize: 11, hideOverlap: true };

const accessOption = computed<EChartsOption>(() => {
  const hourly = accessRange.value === "48h";
  const hourlyRows = dashboard.value?.trends.accessHourly || [];
  const labels = hourly ? hourlyRows.map((item) => hourLabel(item.label)) : daily30.value.map((item) => dayLabel(item.day));
  const lineSeries = (name: string, data: Array<number | string>, extra: Record<string, unknown> = {}) => ({
    name,
    type: "line" as const,
    smooth: true,
    showSymbol: false,
    connectNulls: false,
    data,
    lineStyle: { width: 2 },
    ...extra
  });
  const series = hourly
    ? [
        lineSeries("浏览量", hourlyRows.map((item) => Number(item.pv || 0)), { color: palette.amber }),
        lineSeries("IP 访客", hourlyRows.map((item) => Number(item.uv || 0)), {
          color: palette.primary,
          areaStyle: { color: palette.primaryArea }
        })
      ]
    : [
        lineSeries(
          "活跃用户",
          daily30.value.map((item) => (item.activeUsers === null || item.activeUsers === undefined ? "-" : item.activeUsers)),
          { color: palette.primary, areaStyle: { color: palette.primaryArea } }
        ),
        lineSeries("浏览量", daily30.value.map((item) => Number(item.pv || 0)), { color: palette.amber, yAxisIndex: 1 })
      ];
  const valueAxis = (show = true) => ({
    type: "value" as const,
    minInterval: 1,
    axisLabel: { ...baseAxisLabel },
    splitLine: show ? { lineStyle: { color: palette.grid } } : { show: false }
  });
  return {
    tooltip: {
      trigger: "axis",
      valueFormatter: (value: unknown) => (value === "-" || value === undefined ? "未统计" : formatCount(value))
    },
    legend: {
      top: 0,
      left: 0,
      icon: "roundRect",
      itemWidth: 10,
      itemHeight: 4,
      textStyle: { color: palette.secondary, fontSize: 12 }
    },
    grid: { left: 4, right: 8, bottom: 4, top: 36, containLabel: true },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: labels,
      axisLine: { lineStyle: { color: palette.axis } },
      axisTick: { show: false },
      axisLabel: { ...baseAxisLabel, interval: hourly ? 5 : "auto" }
    },
    yAxis: hourly ? valueAxis() : [valueAxis(), valueAxis(false)],
    series
  } as EChartsOption;
});

const growthOption = computed<EChartsOption>(() => {
  const rows = daily30.value;
  return {
    color: [palette.primary, palette.amber],
    tooltip: {
      trigger: "axis",
      formatter: (params: unknown) => {
        const list = (Array.isArray(params) ? params : [params]) as Array<{
          dataIndex: number;
          marker: string;
          seriesName: string;
          value: unknown;
        }>;
        const index = list[0]?.dataIndex ?? 0;
        const row = rows[index];
        const lines = list.map(
          (item) => `${item.marker}${item.seriesName}　<b>${formatCount(item.value)}</b>`
        );
        if (row) {
          lines.push(`<span style="color:${palette.secondary}">上传玩家　${formatCount(row.uploaders)}</span>`);
          lines.push(`<span style="color:${palette.secondary}">新增绑定　${formatCount(row.newBindings)}</span>`);
        }
        return [row ? row.day.replace(/-/g, "/") : "", ...lines].join("<br/>");
      }
    },
    legend: {
      top: 0,
      left: 0,
      itemWidth: 10,
      itemHeight: 8,
      textStyle: { color: palette.secondary, fontSize: 12 }
    },
    grid: { left: 4, right: 4, bottom: 4, top: 36, containLabel: true },
    xAxis: {
      type: "category",
      data: rows.map((item) => dayLabel(item.day)),
      axisLine: { lineStyle: { color: palette.axis } },
      axisTick: { show: false },
      axisLabel: { ...baseAxisLabel, interval: "auto" }
    },
    yAxis: [
      {
        type: "value",
        minInterval: 1,
        axisLabel: { ...baseAxisLabel },
        splitLine: { lineStyle: { color: palette.grid } }
      },
      {
        type: "value",
        minInterval: 1,
        axisLabel: { ...baseAxisLabel },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: "新用户",
        type: "bar",
        barMaxWidth: 12,
        data: rows.map((item) => item.newUsers),
        itemStyle: { borderRadius: [3, 3, 0, 0] }
      },
      {
        name: "上传",
        type: "line",
        yAxisIndex: 1,
        smooth: true,
        showSymbol: false,
        data: rows.map((item) => item.uploads),
        lineStyle: { width: 2 }
      }
    ]
  };
});

/* ---------- commands ---------- */

const topCommands = computed(() => {
  const rows = (dashboard.value?.topCommands || []).slice(0, 8);
  const max = Math.max(1, ...rows.map((item) => item.count));
  return rows.map((item, index) => ({
    ...item,
    rank: index + 1,
    percent: Math.max(2, (item.count / max) * 100)
  }));
});
const commandSinceNote = computed(() => {
  const since = dashboard.value?.taikoCommandStatsSince;
  return since && withinLast30Days(since) ? `自 ${formatAdminMonthDay(since)} 起统计` : "";
});

/* ---------- recent operations ---------- */

const actionVerbs: Record<string, string> = {
  create: "新增了",
  update: "修改了",
  delete: "删除了",
  read: "查看了",
  login: "登录了",
  grant: "发放了",
  issue: "签发了"
};
const targetTypeLabels: Record<string, string> = {
  "song-alias": "别名",
  "song-alias-log": "别名记录",
  "song-data": "歌曲",
  "song-cover": "封面",
  guide: "谱面攻略",
  "guide-music": "攻略歌曲",
  "guide-difficulty": "谱面攻略",
  "custom-title": "自定义称号",
  "account-title": "称号",
  "title-condition": "称号条件",
  "draw-guess-record": "你画我猜题目",
  backup: "备份",
  "annual-beta": "封闭测试",
  "annual-summary": "年度报告",
  "annual-reaction": "年度报告互动",
  audit: "审计日志",
  dashboard: "工作台",
  auth: "后台"
};

const truncate = (text: string, max = 24) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

const describeTargetKey = (targetType: string, key: string) => {
  const value = String(key || "").trim();
  if (!value || targetType === "auth") return "";
  if (targetType === "song-alias") {
    const alias = value.includes(":") ? value.slice(value.indexOf(":") + 1) : value;
    return `「${truncate(alias)}」`;
  }
  if (targetType === "guide-difficulty" && value.includes(":")) return "";
  if (/^\d+$/.test(value)) return ` #${value}`;
  return `「${truncate(value)}」`;
};

const recentOperations = computed(() =>
  (dashboard.value?.recentAudits || [])
    .filter((item) => item.action !== "read")
    .slice(0, 6)
    .map((item) => {
      const actor =
        item.actorName && item.actorName !== "system-backup"
          ? item.actorName
          : item.source === "bot"
            ? "Bot"
            : item.source === "system-backup" || item.actorType === "system"
              ? "系统"
              : item.actorId || "未知";
      let sentence: string;
      if (item.targetType === "auth") {
        sentence = item.action === "delete" ? "退出了后台" : item.action === "login" ? "登录了后台" : `${actionVerbs[item.action] || item.action}后台`;
      } else if (item.targetType === "backup" && item.action === "create") {
        sentence = "创建了备份";
      } else {
        const verb = actionVerbs[item.action] || `${item.action} `;
        const target = targetTypeLabels[item.targetType] || item.targetType;
        sentence = `${verb}${target}${describeTargetKey(item.targetType, item.targetKey)}`;
      }
      return {
        id: item.id,
        actor,
        sentence,
        fullKey: item.targetKey,
        relativeTime: relative(item.createdAt),
        absoluteTime: formatAdminDateTime(item.createdAt)
      };
    })
);

/* ---------- system status ---------- */

const trafficStatusLabels: Record<string, string> = {
  ready: "正常",
  pending: "统计中",
  backfilling: "补录中",
  stale: "延迟"
};
const systemStatus = computed(() => {
  const value = dashboard.value;
  if (!value) return null;
  const quality = value.trafficQuality;
  const statusLabel = trafficStatusLabels[quality.status] || "统计中";
  const latestBackup = value.backups[0];
  return {
    trafficText: quality.checkedAt ? `${statusLabel} · ${relative(quality.checkedAt)}` : statusLabel,
    trafficTitle: quality.checkedAt ? formatAdminDateTime(quality.checkedAt) : "",
    trafficOk: quality.status === "ready",
    backupText: latestBackup ? relative(latestBackup.createdAt) : "暂无记录",
    backupTitle: latestBackup ? formatAdminDateTime(latestBackup.createdAt) : "",
    backupCount: value.backups.length,
    machineRequests: trafficReady.value
      ? formatCount(quality.suspected24h + quality.reasons.filter(reason => reason.key === "bot" || reason.key === "probe").reduce((sum, reason) => sum + reason.count, 0))
      : "—",
    ipVisitors: trafficReady.value ? formatCount(value.summary.pageUv24h) : "—",
    suspectDevices:
      value.summary.suspectDevicesToday === null || value.summary.suspectDevicesToday === undefined
        ? ""
        : formatCount(value.summary.suspectDevicesToday),
    windowText: `${formatAdminDateTime(quality.windowStart)} — ${formatAdminDateTime(quality.windowEnd)}`,
    rawRequests: formatCount(quality.rawRequests24h),
    reasons: quality.reasons.filter((reason) => reason.count > 0),
    malformedLines: quality.malformedLines
  };
});
</script>

<template>
  <div class="dash">
    <div class="dash-head">
      <span v-if="trafficStatusPill" class="dash-pill" role="status">{{ trafficStatusPill }}</span>
      <span v-if="trafficIncomplete" class="dash-pill dash-pill--warn" :title="trafficGapTitle">访问数据不完整</span>
      <span v-if="dashboard" class="dash-head__time">更新于 {{ formatAdminClock(loadedAt) }}</span>
      <button type="button" class="dash-refresh" :disabled="pending" @click="refresh()">
        <svg :class="{ spinning: pending }" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path
            d="M13.5 8a5.5 5.5 0 1 1-1.61-3.89M13.5 2.5v3h-3"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        刷新
      </button>
    </div>

    <p v-if="error" class="dash-empty" role="alert">统计数据加载失败，请重试。</p>
    <el-skeleton v-if="pending && !dashboard" :rows="10" animated />

    <template v-else-if="dashboard">
      <div class="dash-keyrow">
        <section v-if="activeTile" class="dash-section" aria-labelledby="dash-today-title">
          <h2 id="dash-today-title" class="dash-section__title">今日</h2>
          <AdminMetricCard label="活跃用户" :value="activeTile.value" accent="teal" class="dash-tile dash-tile--primary">
            <template #help>
              <el-tooltip content="今日活跃账号与合格访问设备去重；账号活动包含 App 与相关接口请求" placement="top">
                <button type="button" class="dash-help" aria-label="活跃用户：今日活跃账号与合格访问设备去重；账号活动包含 App 与相关接口请求">?</button>
              </el-tooltip>
            </template>
            <span v-if="activeTile.split || activeTile.delta" class="dash-tile__sub">
              <span v-if="activeTile.split">{{ activeTile.split }}</span>
              <span v-if="activeTile.delta" class="dash-tile__delta">{{ activeTile.delta }}</span>
            </span>
            <div class="dash-tile__spark">
              <AdminSparkline v-if="activeTile.spark.length > 1" :values="activeTile.spark" />
            </div>
            <span v-if="activeTile.sinceNote" class="dash-tile__note">{{ activeTile.sinceNote }}</span>
          </AdminMetricCard>
        </section>

      <section class="dash-section" aria-labelledby="dash-24h-title">
        <h2 id="dash-24h-title" class="dash-section__title">近 24 小时</h2>
        <div class="dash-tiles">
          <AdminMetricCard
            v-for="tile in keyTiles"
            :key="tile.key"
            :label="tile.label"
            :value="tile.value"
            :accent="tile.accent"
            class="dash-tile"
          >
            <template v-if="tile.help" #help>
              <el-tooltip :content="tile.help" placement="top">
                <button type="button" class="dash-help" :aria-label="`${tile.label}：${tile.help}`">?</button>
              </el-tooltip>
            </template>
            <span v-if="tile.sub" class="dash-tile__sub">{{ tile.sub }}</span>
            <div class="dash-tile__spark">
              <AdminSparkline v-if="tile.spark.length > 1" :values="tile.spark" :color="tile.color" />
            </div>
          </AdminMetricCard>
        </div>
      </section>
      </div>

      <div class="dash-grid">
        <section v-if="users" class="dash-card dash-users" aria-labelledby="dash-users-title">
          <h3 id="dash-users-title" class="dash-card__title">用户</h3>
          <div class="dash-users__total">
            <span class="dash-users__total-label">总用户</span>
            <strong class="dash-users__total-value">{{ formatCount(users.summary.totalUsers) }}</strong>
          </div>

          <p class="dash-users__note">按 ID 去重，含历史及手动记录；无有效绑定的 Viewer 用户另计。</p>

          <div class="dash-users__bar" role="img" :aria-label="users.segments.map((s) => `${s.label} ${formatCount(s.value)}`).join('，')">
            <span
              v-for="segment in users.segments"
              :key="segment.key"
              :style="{ width: `${segment.percent}%`, background: segment.color }"
            />
          </div>
          <ul class="dash-users__legend">
            <li v-for="segment in users.segments" :key="segment.key">
              <i :style="{ background: segment.color }" />
              {{ segment.label }} <b>{{ formatCount(segment.value) }}</b>
            </li>
          </ul>

          <dl class="dash-stats">
            <div>
              <dt>仅 Viewer · 有绑定 ID · 无有效绑定 ID</dt>
              <dd>{{ formatCount(users.summary.viewerOnlyBoundUsers) }} / {{ formatCount(users.summary.viewerOnlyUnboundUsers) }}</dd>
            </div>
            <div>
              <dt>仅 Bot · 国服 · 海外 · 手动</dt>
              <dd>{{ formatCount(users.summary.botOnlyCnUsers) }} / {{ formatCount(users.summary.botOnlyOverseasUsers) }} / {{ formatCount(users.summary.botOnlyManualUsers) }}</dd>
            </div>
            <div>
              <dt>国服用户 / 海外用户</dt>
              <dd>{{ formatCount(users.summary.cnUsers) }} / {{ formatCount(users.summary.overseasUsers) }}</dd>
            </div>
            <div>
              <dt>手动账号<small>Viewer {{ formatCount(users.summary.viewerManualUsers) }} · Bot {{ formatCount(users.summary.botManualUsers) }}，合计去重</small></dt>
              <dd>{{ formatCount(users.summary.manualUsers) }}</dd>
            </div>
            <div>
              <dt>近 7 天网站活跃</dt>
              <dd>{{ users.summary.wau7d === null || users.summary.wau7d === undefined ? "—" : formatCount(users.summary.wau7d) }}</dd>
            </div>
            <div>
              <dt>近 30 天网站活跃</dt>
              <dd>{{ users.summary.mau30d === null || users.summary.mau30d === undefined ? "—" : formatCount(users.summary.mau30d) }}</dd>
            </div>
            <div>
              <dt>近 7 天网站新增</dt>
              <dd>{{ formatCount(users.summary.recentNewUsers) }}</dd>
            </div>
            <div>
              <dt>累计上传</dt>
              <dd>{{ formatCount(users.summary.totalUploads) }} <small>次</small></dd>
            </div>
          </dl>
        </section>

        <AdminChartCard title="访问趋势" :option="accessOption" :height="280">
          <template #actions>
            <div class="dash-segmented" role="group" aria-label="时间范围">
              <button
                v-for="range in accessRanges"
                :key="range.value"
                type="button"
                :class="{ active: accessRange === range.value }"
                :aria-pressed="accessRange === range.value"
                @click="accessRange = range.value"
              >
                {{ range.label }}
              </button>
            </div>
          </template>
        </AdminChartCard>

        <AdminChartCard title="新增与上传（近 30 天）" :option="growthOption" :height="280" />

        <section class="dash-card" aria-labelledby="dash-commands-title">
          <h3 id="dash-commands-title" class="dash-card__title">热门指令（近 30 天）</h3>
          <p v-if="!topCommands.length" class="dash-empty">暂无记录</p>
          <ol v-else class="dash-commands">
            <li v-for="command in topCommands" :key="command.name">
              <span class="dash-commands__rank">{{ command.rank }}</span>
              <span class="dash-commands__name" :title="command.name">{{ command.name }}</span>
              <span class="dash-commands__bar" aria-hidden="true"><i :style="{ width: `${command.percent}%` }" /></span>
              <span class="dash-commands__count">{{ formatCount(command.count) }}</span>
            </li>
          </ol>
          <p v-if="commandSinceNote" class="dash-footnote">{{ commandSinceNote }}</p>
        </section>

        <section class="dash-card" aria-labelledby="dash-ops-title">
          <header class="dash-card__head">
            <h3 id="dash-ops-title" class="dash-card__title">最近操作</h3>
            <NuxtLink to="/admin/taiko/audit" class="dash-link">查看全部</NuxtLink>
          </header>
          <p v-if="!recentOperations.length" class="dash-empty">暂无记录</p>
          <ul v-else class="dash-ops">
            <li v-for="op in recentOperations" :key="op.id">
              <span class="dash-ops__text" :title="op.fullKey || undefined">
                <b>{{ op.actor }}</b> {{ op.sentence }}
              </span>
              <time class="dash-ops__time" :title="op.absoluteTime">{{ op.relativeTime }}</time>
            </li>
          </ul>
        </section>

        <section v-if="systemStatus" class="dash-card dash-system" aria-labelledby="dash-system-title">
          <h3 id="dash-system-title" class="dash-card__title">系统状态</h3>
          <dl class="dash-stats">
            <div>
              <dt>访问统计</dt>
              <dd :title="systemStatus.trafficTitle || undefined">
                <i class="dash-dot" :class="{ 'dash-dot--warn': !systemStatus.trafficOk }" aria-hidden="true" />
                {{ systemStatus.trafficText }}
              </dd>
            </div>
            <div>
              <dt>最近备份</dt>
              <dd :title="systemStatus.backupTitle || undefined">
                {{ systemStatus.backupText }}
                <small v-if="systemStatus.backupCount">近期 {{ systemStatus.backupCount }} 份</small>
              </dd>
            </div>
            <div>
              <dt>已排除的机器访问 <small>近 24 小时</small></dt>
              <dd>{{ systemStatus.machineRequests }}</dd>
            </div>
            <div>
              <dt>
                按网络地址估算的访客 <small>近 24 小时</small>
              </dt>
              <dd>{{ systemStatus.ipVisitors }}</dd>
            </div>
            <div v-if="systemStatus.suspectDevices">
              <dt>已排除可疑设备 <small>今日</small></dt>
              <dd>{{ systemStatus.suspectDevices }}</dd>
            </div>
          </dl>
          <details class="dash-details">
            <summary>统计说明</summary>
            <div class="dash-details__body">
              <p>统计时段：{{ systemStatus.windowText }}（北京时间）</p>
              <p>活跃用户按北京时间自然日统计，合并活跃账号与合格访问设备并去重。账号活动包含 App 和相关接口请求。</p>
              <p>浏览量只计服务器收到的页面请求，已排除识别出的机器访问。</p>
              <p>原始请求：{{ systemStatus.rawRequests }}</p>
              <ul v-if="systemStatus.reasons.length">
                <li v-for="reason in systemStatus.reasons" :key="reason.key">
                  {{ reason.label }} <b>{{ formatCount(reason.count) }}</b>
                </li>
              </ul>
              <p v-if="systemStatus.malformedLines > 0">无法识别的记录：{{ formatCount(systemStatus.malformedLines) }}</p>
            </div>
          </details>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dash {
  display: grid;
  gap: 20px;
  min-width: 0;
  color: var(--admin-ink, #1b2426);
}

/* header */
.dash-head {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-top: -8px;
}

.dash-head__time {
  color: var(--admin-ink-secondary, #5d6b6e);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.dash-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--admin-primary-soft, #d7ece9);
  color: var(--admin-primary, #006c76);
  font-size: 12px;
  font-weight: 600;
}

.dash-pill--warn {
  background: var(--admin-amber-soft, #f6ead6);
  color: var(--admin-warning, #8a5a12);
  cursor: help;
}

.dash-refresh {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--admin-border, #e3e8e8);
  border-radius: 8px;
  background: var(--admin-surface, #ffffff);
  color: var(--admin-ink, #1b2426);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}

.dash-refresh:hover:not(:disabled),
.dash-refresh:focus-visible {
  border-color: var(--admin-primary, #006c76);
  color: var(--admin-primary, #006c76);
}

.dash-refresh:disabled {
  cursor: progress;
  color: var(--admin-ink-secondary, #5d6b6e);
}

.dash-refresh .spinning {
  animation: dash-spin 0.9s linear infinite;
}

@keyframes dash-spin {
  to {
    transform: rotate(360deg);
  }
}

/* sections */
.dash-section {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.dash-section__title {
  margin: 0;
  color: var(--admin-ink-secondary, #5d6b6e);
  font-size: 13px;
  font-weight: 600;
}

.dash-keyrow {
  display: grid;
  grid-template-columns: minmax(240px, 1.35fr) minmax(0, 3fr);
  gap: 12px;
  align-items: stretch;
}

.dash-keyrow > .dash-section {
  grid-template-rows: auto 1fr;
}

.dash-tiles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.dash-tile--primary {
  height: 100%;
  box-sizing: border-box;
  border-color: #c6e1dd;
  background: #f1f8f7;
}

.dash-tile--primary :deep(.admin-metric-card__value) {
  color: var(--admin-primary, #006c76);
  font-size: clamp(30px, 3.2vw, 40px);
}

.dash-tile__sub {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
  color: var(--admin-ink-secondary, #5d6b6e);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.dash-tile__delta {
  color: var(--admin-ink-muted, #7a8789);
}

.dash-tile__note {
  color: var(--admin-ink-muted, #7a8789);
  font-size: 11px;
}

.dash-tile__spark {
  height: 32px;
  margin-top: 4px;
}

.dash-help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 1px solid var(--admin-border, #e3e8e8);
  border-radius: 999px;
  background: transparent;
  color: var(--admin-ink-muted, #7a8789);
  font: inherit;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  cursor: help;
}

.dash-help:hover,
.dash-help:focus-visible {
  border-color: var(--admin-primary, #006c76);
  color: var(--admin-primary, #006c76);
}

.dash-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: stretch;
}

.dash-card {
  min-width: 0;
  padding: 18px 20px;
  border-radius: var(--admin-radius, 12px);
  border: 1px solid var(--admin-border, #e3e8e8);
  background: var(--admin-surface, #ffffff);
}

.dash-card__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.dash-card__title {
  margin: 0 0 14px;
  font-size: 15px;
  font-weight: 700;
}

.dash-card__head .dash-card__title {
  margin-bottom: 14px;
}

.dash-link {
  color: var(--admin-primary, #006c76);
  font-size: 13px;
  text-decoration: none;
  white-space: nowrap;
}

.dash-link:hover,
.dash-link:focus-visible {
  text-decoration: underline;
}

.dash-empty {
  margin: 0;
  padding: 24px 0;
  color: var(--admin-ink-muted, #7a8789);
  font-size: 13px;
  text-align: center;
}

.dash-footnote {
  margin: 12px 0 0;
  color: var(--admin-ink-muted, #7a8789);
  font-size: 12px;
}

/* users */
.dash-users__note {
  margin: 0 0 16px;
  color: var(--admin-ink-secondary, #5d6b6e);
  font-size: 12px;
  line-height: 1.5;
}
.dash-users__total {
  display: grid;
  gap: 2px;
}

.dash-users__total-label {
  color: var(--admin-ink-secondary, #5d6b6e);
  font-size: 13px;
}

.dash-users__total-value {
  font-size: 36px;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}

.dash-users__bar {
  display: flex;
  height: 8px;
  margin-top: 16px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--admin-surface-subtle, #f7f9f9);
}

.dash-users__bar span {
  display: block;
  height: 100%;
}

.dash-users__bar span + span {
  border-left: 2px solid var(--admin-surface, #ffffff);
}

.dash-users__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin: 8px 0 6px;
  padding: 0;
  list-style: none;
  color: var(--admin-ink-secondary, #5d6b6e);
  font-size: 12px;
}

.dash-users__legend li {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.dash-users__legend i {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.dash-users__legend b {
  color: var(--admin-ink, #1b2426);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* stat list (users + system) */
.dash-stats {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  margin: 8px 0 0;
}

.dash-stats > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid var(--admin-border, #e3e8e8);
}

.dash-stats dt {
  min-width: 0;
  color: var(--admin-ink-secondary, #5d6b6e);
  font-size: 13px;
}

.dash-stats dt small {
  display: block;
  margin-top: 2px;
  color: var(--admin-ink-muted, #7a8789);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.dash-stats dd {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.dash-stats dd small {
  color: var(--admin-ink-muted, #7a8789);
  font-size: 12px;
  font-weight: 400;
}

/* segmented toggle */
.dash-segmented {
  display: inline-flex;
  padding: 2px;
  border-radius: 8px;
  background: var(--admin-surface-subtle, #f7f9f9);
  border: 1px solid var(--admin-border, #e3e8e8);
}

.dash-segmented button {
  padding: 4px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--admin-ink-secondary, #5d6b6e);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.dash-segmented button.active {
  background: var(--admin-surface, #ffffff);
  color: var(--admin-primary, #006c76);
  font-weight: 700;
  box-shadow: 0 1px 2px rgba(27, 36, 38, 0.08);
}

.dash-segmented button:focus-visible {
  outline: 2px solid var(--admin-primary, #006c76);
  outline-offset: -2px;
}

/* commands */
.dash-commands {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dash-commands li {
  display: grid;
  grid-template-columns: 20px minmax(64px, 30%) minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 30px;
  font-size: 13px;
}

.dash-commands__rank {
  color: var(--admin-ink-muted, #7a8789);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.dash-commands li:nth-child(-n + 3) .dash-commands__rank {
  color: var(--admin-primary, #006c76);
  font-weight: 700;
}

.dash-commands__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dash-commands__bar {
  height: 6px;
  border-radius: 999px;
  background: var(--admin-surface-subtle, #f7f9f9);
  overflow: hidden;
}

.dash-commands__bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--admin-primary, #006c76);
  opacity: 0.75;
}

.dash-commands__count {
  min-width: 44px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

/* recent operations */
.dash-ops {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  margin: 0;
  padding: 0;
  list-style: none;
}

.dash-ops li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 0;
  border-top: 1px solid var(--admin-border, #e3e8e8);
  font-size: 13px;
}

.dash-ops li:first-child {
  border-top: 0;
  padding-top: 0;
}

.dash-ops__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--admin-ink-secondary, #5d6b6e);
}

.dash-ops__text b {
  color: var(--admin-ink, #1b2426);
  font-weight: 600;
}

.dash-ops__time {
  flex: 0 0 auto;
  color: var(--admin-ink-muted, #7a8789);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

/* system */
.dash-system .dash-stats {
  margin-top: 0;
}

.dash-system .dash-stats > div:first-child {
  border-top: 0;
  padding-top: 0;
}

.dash-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--admin-primary, #006c76);
  align-self: center;
}

.dash-dot--warn {
  background: var(--admin-amber, #c98a2e);
}

.dash-details {
  margin-top: 4px;
  border-top: 1px solid var(--admin-border, #e3e8e8);
  font-size: 13px;
}

.dash-details summary {
  padding: 10px 0 0;
  color: var(--admin-ink-secondary, #5d6b6e);
  cursor: pointer;
}

.dash-details summary:focus-visible {
  outline: 2px solid var(--admin-primary, #006c76);
  outline-offset: 2px;
}

.dash-details__body {
  padding-top: 8px;
  color: var(--admin-ink-secondary, #5d6b6e);
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.dash-details__body p {
  margin: 0;
}

.dash-details__body ul {
  margin: 4px 0;
  padding-left: 18px;
}

.dash-details__body b {
  color: var(--admin-ink, #1b2426);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* responsive */
@media (max-width: 1100px) {
  .dash-keyrow {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 600px) {
  .dash-tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dash-tiles > :last-child:nth-child(odd) {
    grid-column: 1 / -1;
  }
}

@media (max-width: 900px) {
  .dash-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 600px) {
  .dash-tiles {
    gap: 10px;
  }

  .dash-tile {
    padding: 12px 14px;
  }

  .dash-tile :deep(.admin-metric-card__value) {
    font-size: 22px;
  }

  .dash-card {
    padding: 16px;
  }

  .dash-users__total-value {
    font-size: 30px;
  }
}
</style>
