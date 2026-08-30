<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type { ChartUgcModerationHistoryItem, ChartUgcReportQueueItem, UgcOperationsOverview } from "~/types/ugc";
import { formatAdminDateTime } from "~/utils/admin-time";

defineI18nRoute(false);
definePageMeta({ layout: "admin-taiko", middleware: "admin-auth" });
useHead({ title: "UGC 审核" });

const { t } = useI18n();
const apiFetch = useAdminApiFetch();
const windowKey = ref<"24h" | "7d" | "30d" | "all">("all");
const reports = ref<ChartUgcReportQueueItem[]>([]);
const history = ref<ChartUgcModerationHistoryItem[]>([]);
const overview = ref<UgcOperationsOverview | null>(null);
const pending = ref(true);
const actionTipId = ref<string | null>(null);
const errorMessage = ref("");

const load = async () => {
  pending.value = true;
  errorMessage.value = "";
  try {
    const [reportPayload, historyPayload, overviewPayload] = await Promise.all([
      apiFetch<{ items: ChartUgcReportQueueItem[] }>("/api/admin/chart-ugc/reports"),
      apiFetch<{ items: ChartUgcModerationHistoryItem[] }>("/api/admin/chart-ugc/history?limit=100"),
      apiFetch<UgcOperationsOverview>(`/api/admin/chart-ugc/overview?window=${windowKey.value}`)
    ]);
    reports.value = reportPayload.items || [];
    history.value = historyPayload.items || [];
    overview.value = overviewPayload;
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.message || t("adminUgc.loadError");
  } finally {
    pending.value = false;
  }
};

await load();

const moderate = async (item: ChartUgcReportQueueItem, action: "hide" | "restore") => {
  if (action === "hide") {
    try {
      await ElMessageBox.confirm(t("adminUgc.hideConfirm"), t("adminUgc.confirmTitle"), { type: "warning" });
    } catch {
      return;
    }
  }
  let reason = item.reason;
  try {
    const result = await ElMessageBox.prompt(t("adminUgc.reasonPrompt"), t("adminUgc.reasonTitle"), {
      inputValue: item.reason,
      inputPattern: /\S+/,
      inputErrorMessage: t("adminUgc.reasonRequired"),
      confirmButtonText: t("adminUgc.submit"),
      cancelButtonText: t("adminUgc.cancel")
    });
    reason = result.value;
  } catch {
    return;
  }
  actionTipId.value = item.tip.tipId;
  try {
    const response = await apiFetch<{ status: "active" | "hidden" }>("/api/admin/chart-ugc/moderation", {
      method: "POST",
      body: { tipId: item.tip.tipId, action, reason }
    });
    reports.value = reports.value.filter((report) => report.tip.tipId !== item.tip.tipId);
    if (action === "restore") item.tip.status = response.status;
    await load();
    ElMessage.success(action === "hide" ? t("adminUgc.hidden") : t("adminUgc.restored"));
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || t("adminUgc.actionError"));
  } finally {
    actionTipId.value = null;
  }
};

const restoreFromHistory = async (item: ChartUgcModerationHistoryItem) => {
  let reason = t("adminUgc.restoreReason");
  try {
    const result = await ElMessageBox.prompt(t("adminUgc.reasonPrompt"), t("adminUgc.reasonTitle"), {
      inputValue: reason,
      confirmButtonText: t("adminUgc.submit"), cancelButtonText: t("adminUgc.cancel")
    });
    reason = result.value;
  } catch {
    return;
  }
  actionTipId.value = item.targetId;
  try {
    await apiFetch("/api/admin/chart-ugc/moderation", { method: "POST", body: { tipId: item.targetId, action: "restore", reason } });
    await load();
    ElMessage.success(t("adminUgc.restored"));
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || t("adminUgc.actionError"));
  } finally {
    actionTipId.value = null;
  }
};

const visibleReports = computed(() => reports.value);
const metricCards = computed(() => {
  const value = overview.value;
  if (!value) return [];
  return [
    [t("adminUgc.activeCharts"), value.charts.active],
    [t("adminUgc.chartsWithUgc"), value.charts.withAnyUgc],
    [t("adminUgc.difficultyVotes"), value.contributions.difficultyVotes],
    [t("adminUgc.tagVotes"), value.contributions.tagVotes],
    [t("adminUgc.activeTips"), value.contributions.activeTips],
    [t("adminUgc.hiddenTips"), value.contributions.hiddenTips],
    [t("adminUgc.helpful"), value.contributions.helpful],
    [t("adminUgc.pendingReports"), value.contributions.reportsPending]
  ];
});
</script>

<template>
  <div class="ugc-admin-page">
    <div class="admin-toolbar">
      <el-select v-model="windowKey" class="window-select" @change="load">
        <el-option :label="t('adminUgc.allTime')" value="all" />
        <el-option :label="t('adminUgc.last24h')" value="24h" />
        <el-option :label="t('adminUgc.last7d')" value="7d" />
        <el-option :label="t('adminUgc.last30d')" value="30d" />
      </el-select>
      <el-button :loading="pending" @click="load">{{ t("adminUgc.refresh") }}</el-button>
    </div>

    <el-alert v-if="errorMessage" :title="errorMessage" type="error" show-icon />

    <section class="ugc-admin-panel">
      <div class="panel-heading"><h2>{{ t("adminUgc.pendingTitle") }}</h2><span>{{ visibleReports.length }}</span></div>
      <el-empty v-if="!pending && !visibleReports.length" :description="t('adminUgc.emptyQueue')" />
      <el-skeleton v-else-if="pending" :rows="4" animated />
      <div v-else class="report-list">
        <article v-for="item in visibleReports" :key="item.reportId" class="report-item">
          <div class="report-item__body">
            <p class="report-item__tip">{{ item.tip.body }}</p>
            <div class="report-item__meta">
              <span>{{ item.tip.author.isDeleted ? t("ugc.deletedUser") : item.tip.author.displayName }}</span>
              <span v-if="item.tip.verifiedPlay">{{ t("ugc.verifiedPlay") }}</span>
              <span>{{ t("adminUgc.helpfulValue", { count: item.helpfulCount }) }}</span>
              <span>{{ t("adminUgc.reportsValue", { count: item.reportCount }) }}</span>
            </div>
            <div class="report-item__meta">
              <NuxtLink :to="`/songs/${item.tip.chart.songId}`">{{ item.tip.songTitle }}</NuxtLink>
              <span>{{ t("adminUgc.difficultyValue", { value: item.tip.chart.difficultyCode }) }}</span>
              <span>{{ t("adminUgc.reasonValue", { reason: item.reason }) }}</span>
              <span>{{ formatAdminDateTime(item.firstReportAt) }} → {{ formatAdminDateTime(item.latestReportAt) }}</span>
            </div>
          </div>
          <div class="report-item__actions">
            <el-button type="danger" :loading="actionTipId === item.tip.tipId" @click="moderate(item, 'hide')">{{ t("adminUgc.hide") }}</el-button>
            <NuxtLink class="context-link" :to="`/songs/${item.tip.chart.songId}`">{{ t("adminUgc.viewChart") }}</NuxtLink>
          </div>
        </article>
      </div>
    </section>

    <section v-if="overview" class="ugc-admin-panel">
      <div class="panel-heading"><h2>{{ t("adminUgc.overviewTitle") }}</h2><span>{{ overview.window }}</span></div>
      <div class="metric-grid"><div v-for="([label, value]) in metricCards" :key="label" class="metric"><strong>{{ value }}</strong><span>{{ label }}</span></div></div>
      <div class="overview-columns">
        <div><h3>{{ t("adminUgc.qualityTitle") }}</h3><dl class="quality-list"><div><dt>{{ t("adminUgc.verifiedDifficulty") }}</dt><dd>{{ overview.quality.verifiedDifficultyCount }} ({{ Math.round(overview.quality.verifiedDifficultyRatio * 100) }}%)</dd></div><div><dt>{{ t("adminUgc.verifiedTags") }}</dt><dd>{{ overview.quality.verifiedTagCount }} ({{ Math.round(overview.quality.verifiedTagRatio * 100) }}%)</dd></div><div><dt>{{ t("adminUgc.verifiedTips") }}</dt><dd>{{ overview.quality.verifiedTipCount }} ({{ Math.round(overview.quality.verifiedTipRatio * 100) }}%)</dd></div><div><dt>{{ t("adminUgc.avgTags") }}</dt><dd>{{ overview.quality.averageTagsPerContributor }}</dd></div></dl></div>
        <div><h3>{{ t("adminUgc.topCharts") }}</h3><ol class="compact-list"><li v-for="chart in overview.topCharts" :key="chart.chartId"><NuxtLink :to="`/songs/${chart.songId}`">{{ chart.songTitle }}</NuxtLink><span>{{ chart.contributions }}</span></li></ol></div>
      </div>
    </section>

    <section class="ugc-admin-panel">
      <div class="panel-heading"><h2>{{ t("adminUgc.historyTitle") }}</h2><span>{{ history.length }}</span></div>
      <el-empty v-if="!history.length" :description="t('adminUgc.emptyHistory')" />
      <div v-else class="history-list"><div v-for="item in history" :key="item.id" class="history-item"><strong>{{ item.action }}</strong><span>{{ item.targetType }} #{{ item.targetId }}</span><span>{{ item.operatorDeleted ? t("adminUgc.deletedOperator") : item.operatorDisplayName }}</span><span>{{ item.reason || "—" }}</span><time>{{ formatAdminDateTime(item.createdAt) }}</time><el-button v-if="item.targetType === 'tip' && item.action === 'hide'" text type="primary" :loading="actionTipId === item.targetId" @click="restoreFromHistory(item)">{{ t("adminUgc.restore") }}</el-button></div></div>
    </section>
  </div>
</template>

<style scoped>
.ugc-admin-page { display: grid; gap: 20px; }
.admin-toolbar { display: flex; justify-content: flex-end; gap: 10px; }
.window-select { width: 140px; }
.ugc-admin-panel { padding: 22px; border-radius: 22px; background: rgba(255, 252, 247, .9); box-shadow: 0 12px 28px rgba(111, 83, 46, .08); }
.panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.panel-heading h2 { margin: 0; color: #2b3445; font-size: 20px; }
.panel-heading > span { color: #927048; font-variant-numeric: tabular-nums; }
.report-list, .history-list { display: grid; gap: 12px; }
.report-item { display: flex; justify-content: space-between; gap: 20px; padding: 16px; border: 1px solid rgba(130, 97, 57, .16); border-radius: 15px; background: #fff; }
.report-item__body { min-width: 0; display: grid; gap: 8px; }
.report-item__tip { margin: 0; color: #293445; font-size: 16px; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }
.report-item__meta { display: flex; flex-wrap: wrap; gap: 8px 14px; color: #806d5c; font-size: 12px; }
.report-item__meta a, .context-link { color: #9b5a32; }
.report-item__actions { display: flex; flex: 0 0 auto; align-items: center; gap: 10px; }
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.metric { display: grid; gap: 5px; padding: 14px; border-radius: 14px; background: #f7efe5; }
.metric strong { color: #24344a; font-size: 24px; }
.metric span { color: #806d5c; font-size: 12px; }
.overview-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 22px; }
.overview-columns h3 { margin: 0 0 10px; color: #4d3c2d; font-size: 14px; }
.quality-list { display: grid; gap: 8px; margin: 0; }
.quality-list div { display: flex; justify-content: space-between; gap: 12px; color: #725e4b; font-size: 13px; }
.quality-list dd { margin: 0; font-weight: 700; color: #2f435b; }
.compact-list { display: grid; gap: 8px; margin: 0; padding-left: 20px; color: #725e4b; font-size: 13px; }
.compact-list li { display: flex; justify-content: space-between; gap: 12px; }
.compact-list a { color: #9b5a32; }
.history-item { display: grid; grid-template-columns: 72px 110px minmax(120px, 1fr) minmax(120px, 1.5fr) 180px auto; align-items: center; gap: 10px; padding: 11px 0; border-bottom: 1px solid rgba(130, 97, 57, .1); color: #725e4b; font-size: 12px; }
.history-item strong { color: #9b5a32; text-transform: uppercase; }
.history-item time { color: #958372; }
@media (max-width: 900px) { .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .overview-columns { grid-template-columns: 1fr; } .history-item { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) { .report-item { flex-direction: column; } .report-item__actions { justify-content: flex-start; } .metric-grid { grid-template-columns: 1fr 1fr; } .ugc-admin-panel { padding: 16px; } }
:global(body.theme-dark) .ugc-admin-panel { background: rgba(26, 32, 45, .94); } :global(body.theme-dark) .panel-heading h2, :global(body.theme-dark) .report-item__tip { color: #f2e8dc; } :global(body.theme-dark) .report-item { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.12); } :global(body.theme-dark) .metric { background: rgba(255,255,255,.08); }
</style>
