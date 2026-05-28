<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from "vue";
import { ElMessage } from "element-plus";
import { buildPageDescription } from "~/utils/seo";

type BindingSummary = {
  id: number;
  taikoId: string;
  isCurrent: boolean;
  verifiedTitle: string | null;
  verifiedTitleplateId: number | null;
  createdAt: string;
  updatedAt: string;
};

type SyncResult = {
  targetId: string;
  label: string;
  ok: boolean;
  statusCode: number;
  message: string;
  receivedBytes: number;
  decompressedBytes: number;
  songCount: number | null;
};

type SyncLog = {
  id: number;
  taikoId: string;
  status: string;
  targetIds: string[];
  results: SyncResult[];
  originalBytes: number;
  compressedBytes: number;
  createdAt: string;
  updatedAt: string;
};

type SyncOverviewPayload = {
  currentBinding: BindingSummary | null;
  hasUserdata: boolean;
  canSyncFromWahlap: boolean;
  targets: Array<{
    id: string;
    label: string;
    description: string;
  }>;
  cooldownRemainingSeconds: number;
  cooldownUntil: string;
  lastSync: SyncLog | null;
};

const { t, locale } = useI18n();
const apiFetch = useViewerApiFetch();
const { formatDateTime } = useViewerDateTime();

definePageMeta({
  middleware: "account-auth",
  pageTitleKey: "account.sync",
  pageDescKey: "page.account.sync.desc",
  navKey: "/account/sync",
  breadcrumbs: [
    { labelKey: "account.title", to: "/account/profile" },
    { labelKey: "account.sync", to: "/account/sync" }
  ]
});

useViewerSeo(() => ({
  title: t("account.sync"),
  description: buildPageDescription(t("page.account.sync.desc")),
  path: "/account/sync"
}));

const selectedTargetIds = ref<string[]>([]);
const submitting = ref(false);
const cooldown = ref(0);
let cooldownTimer: ReturnType<typeof setInterval> | null = null;

const copy = computed(() =>
  locale.value === "ja"
    ? {
        title: "多端同期",
        intro: "ドンダーひろば ID を連携した後、「同期開始」でサーバーが鼓衆広場から最新の `userdata` を取得し、選択した送信先へ圧縮配信します。追加のログイン設定は不要です。送信後は 30 分のクールダウンに入ります。",
        serviceUnavailable: "サーバー側の鼓衆広場アクセス設定が未構成のため、現在同期できません。",
        currentBinding: "現在の連携 ID",
        currentTitle: "現在の称号",
        cooldownStatus: "クールダウン",
        ready: "すぐ同期可能",
        remaining: "残り {seconds}s",
        needBinding: "先にドンダーひろば ID を連携してください",
        targets: "同期先",
        targetsDesc: "選択した送信先に対して、サーバーが鼓衆広場から userdata を取得し、zstd 圧縮して配信します。",
        noTargets: "利用可能な同期先はありません",
        start: "同期開始",
        coolingDown: "クールダウン中 {seconds}s",
        lastSync: "前回の同期",
        lastSyncDesc: "前回リクエストの圧縮サイズと各送信先の結果を表示します。",
        noHistory: "同期履歴はまだありません",
        syncTime: "同期時刻",
        overallStatus: "全体状態",
        compressedSize: "圧縮サイズ",
        compressedRate: "圧縮率",
        success: "成功",
        failed: "失敗",
        decompressed: "展開後",
        songs: "曲数",
        selectTarget: "少なくとも 1 つの同期先を選択してください",
        syncDone: "同期が完了しました",
        syncSuccess: "同期成功、{success}/{total} 件の送信先が完了しました",
        syncPartial: "一部のみ成功、{success}/{total} 件完了{failed}",
        syncFailed: "同期に失敗しました。前回結果を確認してください。"
      }
    : {
        title: "多端同步",
        intro: "绑定鼓众 ID 后，点击「开始同步」会由服务端从鼓众广场拉取最新 userdata，并压缩分发到所选目标；无需额外配置账号密码。提交后进入 30 分钟冷却。",
        serviceUnavailable: "服务端暂未配置鼓众广场访问凭据，暂时无法同步，请联系管理员。",
        currentBinding: "当前绑定 ID",
        currentTitle: "当前称号",
        cooldownStatus: "冷却状态",
        ready: "可立即同步",
        remaining: "剩余 {seconds}s",
        needBinding: "请先绑定鼓众 ID 后再使用多端同步",
        targets: "同步目标",
        targetsDesc: "勾选后，服务端会从鼓众广场拉取 userdata、压缩为 zstd，并分发到对应服务。",
        noTargets: "当前没有可用的同步目标",
        start: "开始同步",
        coolingDown: "冷却中 {seconds}s",
        lastSync: "最近一次同步",
        lastSyncDesc: "展示最近一次同步请求的压缩体积和逐目标返回结果。",
        noHistory: "还没有同步记录",
        syncTime: "同步时间",
        overallStatus: "整体状态",
        compressedSize: "压缩体积",
        compressedRate: "压缩比例",
        success: "成功",
        failed: "失败",
        decompressed: "解压",
        songs: "曲目",
        selectTarget: "请先勾选至少一个同步目标",
        syncDone: "同步已完成",
        syncSuccess: "同步成功，{success}/{total} 个目标已完成",
        syncPartial: "部分同步成功，{success}/{total} 个目标完成{failed}",
        syncFailed: "同步失败，请查看最近一次同步结果"
      }
);

const { data, pending, refresh } = await useAsyncData<SyncOverviewPayload>(
  "account-sync-overview",
  () => apiFetch("/api/account/sync/targets"),
  {
    default: () => ({
      currentBinding: null,
      hasUserdata: false,
      canSyncFromWahlap: true,
      targets: [],
      cooldownRemainingSeconds: 0,
      cooldownUntil: "",
      lastSync: null
    })
  }
);

const overview = computed(() => data.value);
const compressionRatio = computed(() => {
  const log = overview.value?.lastSync;
  if (!log?.originalBytes) return "";
  return `${((log.compressedBytes / log.originalBytes) * 100).toFixed(1)}%`;
});

const startCooldown = (seconds: number) => {
  cooldown.value = Math.max(0, seconds);
  if (cooldownTimer) clearInterval(cooldownTimer);
  if (cooldown.value <= 0) return;
  cooldownTimer = setInterval(() => {
    cooldown.value -= 1;
    if (cooldown.value <= 0 && cooldownTimer) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
    }
  }, 1000);
};

watch(
  () => overview.value?.cooldownRemainingSeconds || 0,
  (value) => startCooldown(value),
  { immediate: true }
);

onBeforeUnmount(() => {
  if (cooldownTimer) clearInterval(cooldownTimer);
});

const buildSyncFeedback = (log: SyncLog | null | undefined) => {
  if (!log) {
    return {
      level: "success" as const,
      message: copy.value.syncDone
    };
  }
  const successCount = log.results.filter((item) => item.ok).length;
  const totalCount = log.results.length;
  const failedResults = log.results.filter((item) => !item.ok);
  if (log.status === "success") {
    return {
      level: "success" as const,
      message: copy.value.syncSuccess.replace("{success}", String(successCount)).replace("{total}", String(totalCount))
    };
  }
  if (log.status === "partial") {
    const failedLabels = failedResults.map((item) => item.label).filter(Boolean).join("、");
    return {
      level: "warning" as const,
      message: copy.value.syncPartial
        .replace("{success}", String(successCount))
        .replace("{total}", String(totalCount))
        .replace("{failed}", failedLabels ? `，${failedLabels}` : "")
    };
  }
  const failedMessage = failedResults
    .map((item) => `${item.label}：${item.message}`)
    .filter(Boolean)
    .join("；");
  return {
    level: "error" as const,
    message: failedMessage || copy.value.syncFailed
  };
};

const submitSync = async () => {
  if (submitting.value) return;
  if (!selectedTargetIds.value.length) {
    ElMessage.warning(copy.value.selectTarget);
    return;
  }
  submitting.value = true;
  try {
    const response = await apiFetch<{ log: SyncLog | null }>("/api/account/sync", {
      method: "POST",
      body: {
        targetIds: selectedTargetIds.value
      }
    });
    const feedback = buildSyncFeedback(response?.log);
    if (feedback.level === "success") {
      ElMessage.success(feedback.message);
    } else if (feedback.level === "warning") {
      ElMessage.warning(feedback.message);
    } else {
      ElMessage.error(feedback.message);
    }
    await refresh();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.syncFailed);
    await refresh();
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div class="sync-page">
    <el-card v-if="pending" class="panel-card">
      <el-skeleton :rows="8" animated />
    </el-card>

    <template v-else>
      <el-card class="panel-card">
        <div class="section-title">
          <h2>{{ copy.title }}</h2>
          <p>{{ copy.intro }}</p>
        </div>
        <div v-if="overview.currentBinding" class="binding-meta">
          <div>
            <span>{{ copy.currentBinding }}</span>
            <strong>{{ overview.currentBinding.taikoId }}</strong>
          </div>
          <div>
            <span>{{ copy.currentTitle }}</span>
            <strong>{{ overview.currentBinding.verifiedTitle || "-" }}</strong>
          </div>
          <div>
            <span>{{ copy.cooldownStatus }}</span>
            <strong>{{ cooldown > 0 ? copy.remaining.replace("{seconds}", String(cooldown)) : copy.ready }}</strong>
          </div>
        </div>
        <el-empty v-else :description="copy.needBinding" />
        <el-alert
          v-if="overview.currentBinding && overview.canSyncFromWahlap === false"
          type="warning"
          :closable="false"
          show-icon
          :title="copy.serviceUnavailable"
          class="userdata-alert"
        />
      </el-card>

      <el-card class="panel-card">
        <div class="section-title">
          <h3>{{ copy.targets }}</h3>
          <p>{{ copy.targetsDesc }}</p>
        </div>
        <el-empty v-if="!overview.targets.length" :description="copy.noTargets" />
        <el-checkbox-group v-else v-model="selectedTargetIds" class="target-list">
          <label v-for="target in overview.targets" :key="target.id" class="target-item">
            <el-checkbox :label="target.id">
              <span class="target-label">{{ target.label }}</span>
            </el-checkbox>
            <p>{{ target.description }}</p>
          </label>
        </el-checkbox-group>
        <el-button
          type="primary"
          :loading="submitting"
          :disabled="!overview.currentBinding || overview.canSyncFromWahlap === false || cooldown > 0 || !overview.targets.length"
          @click="submitSync"
        >
          {{ cooldown > 0 ? copy.coolingDown.replace("{seconds}", String(cooldown)) : copy.start }}
        </el-button>
      </el-card>

      <el-card class="panel-card">
        <div class="section-title">
          <h3>{{ copy.lastSync }}</h3>
          <p>{{ copy.lastSyncDesc }}</p>
        </div>
        <el-empty v-if="!overview.lastSync" :description="copy.noHistory" />
        <template v-else>
          <div class="last-sync-meta">
            <div>
              <span>{{ copy.syncTime }}</span>
              <strong>{{ formatDateTime(overview.lastSync.createdAt) }}</strong>
            </div>
            <div>
              <span>{{ copy.overallStatus }}</span>
              <strong>{{ overview.lastSync.status }}</strong>
            </div>
            <div>
              <span>{{ copy.compressedSize }}</span>
              <strong>{{ overview.lastSync.compressedBytes }} / {{ overview.lastSync.originalBytes }} bytes</strong>
            </div>
            <div>
              <span>{{ copy.compressedRate }}</span>
              <strong>{{ compressionRatio || "-" }}</strong>
            </div>
          </div>
          <div class="result-list">
            <div v-for="result in overview.lastSync.results" :key="`${overview.lastSync.id}-${result.targetId}`" class="result-item">
              <div class="result-item__head">
                <strong>{{ result.label }}</strong>
                <el-tag :type="result.ok ? 'success' : 'danger'" effect="light">
                  {{ result.ok ? copy.success : copy.failed }}
                </el-tag>
              </div>
              <p>HTTP {{ result.statusCode }} · {{ result.message }}</p>
              <p v-if="result.songCount !== null || result.decompressedBytes > 0">
                {{ copy.decompressed }} {{ result.decompressedBytes || "-" }} bytes · {{ copy.songs }} {{ result.songCount ?? "-" }}
              </p>
            </div>
          </div>
        </template>
      </el-card>
    </template>
  </div>
</template>

<style scoped>
.sync-page {
  display: grid;
  gap: 18px;
}

.section-title h2,
.section-title h3 {
  margin: 0;
}

.section-title p {
  margin: 8px 0 0;
  color: #7d6a5a;
  line-height: 1.8;
}

.binding-meta,
.last-sync-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.binding-meta div,
.last-sync-meta div {
  display: grid;
  gap: 4px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(255, 248, 240, 0.82);
}

.binding-meta span,
.last-sync-meta span {
  color: #7d6a5a;
  font-size: 13px;
}

.userdata-alert {
  margin-top: 16px;
}

.target-list {
  display: grid;
  gap: 12px;
  margin: 18px 0;
}

.target-item {
  display: grid;
  gap: 6px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(255, 248, 240, 0.82);
}

.target-item p,
.result-item p {
  margin: 0;
  color: #7d6a5a;
  line-height: 1.7;
}

.target-label {
  font-weight: 600;
}

.result-list {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.result-item {
  padding: 14px;
  border-radius: 14px;
  background: rgba(255, 248, 240, 0.82);
}

.result-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
</style>
