<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { buildPageDescription } from "~/utils/seo";

type BindingSummary = {
  id: number;
  taikoId: string;
  isCurrent: boolean;
  verifiedTitle: string | null;
  verifiedTitleplateId: number | null;
  createdAt: string;
  updatedAt: string;
  source: "wahlap" | "hiroba" | "manual";
  displayName: string;
  isManual: boolean;
  canExternalSync: boolean;
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
  scoreTokenAvailable: boolean;
  scoreToken: {
    taikoId: string;
    exists: boolean;
    tokenMask: string | null;
    lastUsedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  } | null;
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
const importingKinoko = ref(false);
const importingKinokoHistory = ref(false);
const kinokoApiKey = ref("");
const scoreTokenBusy = ref(false);
const issuedScoreToken = ref("");
const cooldown = ref(0);
let cooldownTimer: ReturnType<typeof setInterval> | null = null;

const copy = computed(() =>
  locale.value === "ja"
    ? {
        title: "多端同期",
        intro: "ドンダーひろば ID を連携した後、「同期開始」でサーバーが鼓衆広場から最新の `userdata` を取得し、選択した送信先へ圧縮配信します。追加のログイン設定は不要です。送信後は 30 分のクールダウンに入ります。",
        serviceUnavailable: "サーバー側の鼓衆広場アクセス設定が未構成のため、現在同期できません。",
        manualSaved: "手動入力データはすでに中央に保存されています。外部サービスから取得する必要はありません。",
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
        syncFailed: "同期に失敗しました。前回結果を確認してください。",
        kinokoTitle: "菌菌コンソールから移行",
        kinokoDesc: "API キーの既定プレイヤーから、現在の最高成績または完全な成績履歴を同じ ID の連携先へ移行します。キーは保存されません。",
        kinokoKey: "API キー",
        kinokoKeyPlaceholder: "tk_ で始まる API キー",
        kinokoTarget: "移行先：{target}",
        kinokoStart: "成績をワンクリック移行",
        kinokoHistoryStart: "完全な履歴を移行",
        kinokoHistoryHint: "完全履歴には現在の成績も含まれます。初回移行におすすめで、再実行時は既存記録を自動的に除外します。",
        kinokoNeedKey: "API キーを入力してください",
        kinokoDone: "移行完了：追加 {added} 件、更新 {updated} 件、変更なし {unchanged} 件",
        kinokoHistoryDone: "履歴移行完了：新規 {imported} 件、既存 {skipped} 件、スナップショット {files} 個",
        scoreTokenTitle: "Web スコア token",
        scoreTokenDesc: "外部サイトやツールが現在の連携 ID の最新スコア JSON を読み取るための秘密キーです。",
        scoreTokenReady: "発行済み",
        scoreTokenEmpty: "未発行",
        scoreTokenUnavailable: "token サービスに接続できません。しばらくしてからお試しください。",
        scoreTokenManual: "手動アカウントでは Web スコア token を利用できません。",
        scoreTokenMask: "現在の token",
        scoreTokenLastUsed: "最終使用",
        scoreTokenNeverUsed: "未使用",
        scoreTokenCreated: "発行日時",
        scoreTokenIssue: "token を発行",
        scoreTokenRotate: "token を更新",
        scoreTokenRevoke: "token を無効化",
        scoreTokenIssued: "新しい token を発行しました。今すぐ保存してください。",
        scoreTokenRevoked: "token を無効化しました",
        scoreTokenReveal: "この token は今回だけ表示されます。更新または再発行すると確認できません。",
        scoreTokenCopied: "token をコピーしました",
        scoreTokenCopy: "コピー",
        scoreTokenDocs: "利用ガイドと API ドキュメント",
        scoreTokenConfirmTitle: "token を無効化しますか？",
        scoreTokenConfirm: "この token を使用中のすべてのサイトやツールから直ちにアクセスできなくなります。",
        confirm: "無効化",
        cancel: "キャンセル"
      }
    : {
        title: "多端同步",
        intro: "绑定鼓众 ID 后，点击「开始同步」会由服务端从鼓众广场拉取最新 userdata，并压缩分发到所选目标；无需额外配置账号密码。提交后进入 30 分钟冷却。",
        serviceUnavailable: "服务端暂未配置鼓众广场访问凭据，暂时无法同步，请联系管理员。",
        manualSaved: "手动录入内容已经保存在中心，不关联鼓众广场或 Hiroba，无需从外部拉取。",
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
        syncFailed: "同步失败，请查看最近一次同步结果",
        kinokoTitle: "从菌菌控制台迁移",
        kinokoDesc: "使用 API 密钥从默认账号迁移当前最佳成绩或完整成绩历史，只允许写入 ID 相同的当前绑定账号。密钥不会保存。",
        kinokoKey: "API 密钥",
        kinokoKeyPlaceholder: "以 tk_ 开头的 API 密钥",
        kinokoTarget: "迁移目标：{target}",
        kinokoStart: "一键迁移成绩",
        kinokoHistoryStart: "迁移完整历史",
        kinokoHistoryHint: "完整历史包含当前成绩，适合首次迁移；重复执行会自动跳过已有记录。",
        kinokoNeedKey: "请填写 API 密钥",
        kinokoDone: "迁移完成：新增 {added} 条，更新 {updated} 条，{unchanged} 条无需变更",
        kinokoHistoryDone: "历史迁移完成：新增 {imported} 条、跳过已有 {skipped} 条，写入 {files} 个快照",
        scoreTokenTitle: "网页成绩 token",
        scoreTokenDesc: "供第三方网页、工具或服务读取当前绑定 ID 的最新完整成绩 JSON。它等同于成绩读取密码。",
        scoreTokenReady: "已签发",
        scoreTokenEmpty: "未生成",
        scoreTokenUnavailable: "暂时无法连接 token 服务，请稍后重试。",
        scoreTokenManual: "手动账号不支持网页成绩 token。",
        scoreTokenMask: "当前 token",
        scoreTokenLastUsed: "最近使用",
        scoreTokenNeverUsed: "从未使用",
        scoreTokenCreated: "生成时间",
        scoreTokenIssue: "生成 token",
        scoreTokenRotate: "轮换 token",
        scoreTokenRevoke: "撤销 token",
        scoreTokenIssued: "新 token 已生成，请立即保存。",
        scoreTokenRevoked: "token 已撤销",
        scoreTokenReveal: "明文只在本次生成后展示。刷新页面或再次生成后，无法找回当前明文。",
        scoreTokenCopied: "token 已复制",
        scoreTokenCopy: "复制",
        scoreTokenDocs: "用户指南与开发者 API 文档",
        scoreTokenConfirmTitle: "确认撤销 token？",
        scoreTokenConfirm: "所有正在使用此 token 的网页和工具会立即失去访问权限。",
        confirm: "撤销",
        cancel: "取消"
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
      scoreTokenAvailable: false,
      scoreToken: null,
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

const importFromKinoko = async () => {
  if (importingKinoko.value || importingKinokoHistory.value) return;
  if (!kinokoApiKey.value.trim()) {
    ElMessage.warning(copy.value.kinokoNeedKey);
    return;
  }
  importingKinoko.value = true;
  try {
    const response = await apiFetch<{
      partial?: boolean; message?: string;
      summary: { added: number; updated: number; unchanged: number; total: number };
    }>("/api/account/sync/kinoko-import", {
      method: "POST",
      body: {
        apiKey: kinokoApiKey.value.trim()
      }
    });
    kinokoApiKey.value = "";
    if (response.partial) ElMessage.warning(response.message);
    else ElMessage.success(
      copy.value.kinokoDone
        .replace("{added}", String(response.summary.added))
        .replace("{updated}", String(response.summary.updated))
        .replace("{unchanged}", String(response.summary.unchanged))
    );
    await refresh();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.syncFailed);
    await refresh();
  } finally {
    importingKinoko.value = false;
  }
};

const importHistoryFromKinoko = async () => {
  if (importingKinoko.value || importingKinokoHistory.value) return;
  if (!kinokoApiKey.value.trim()) {
    ElMessage.warning(copy.value.kinokoNeedKey);
    return;
  }
  importingKinokoHistory.value = true;
  try {
    const response = await apiFetch<{
      partial?: boolean; message?: string;
      summary: {
        history: { importedRecords: number; skippedRecords: number; snapshotFiles: number };
      };
    }>("/api/account/sync/kinoko-history-import", {
      method: "POST",
      body: {
        apiKey: kinokoApiKey.value.trim()
      }
    });
    kinokoApiKey.value = "";
    if (response.partial) ElMessage.warning(response.message);
    else ElMessage.success(
      copy.value.kinokoHistoryDone
        .replace("{imported}", String(response.summary.history.importedRecords))
        .replace("{skipped}", String(response.summary.history.skippedRecords))
        .replace("{files}", String(response.summary.history.snapshotFiles))
    );
    await refresh();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.syncFailed);
    await refresh();
  } finally {
    importingKinokoHistory.value = false;
  }
};

const manageScoreToken = async (action: "issue" | "revoke") => {
  if (scoreTokenBusy.value) return;
  if (action === "revoke") {
    try {
      await ElMessageBox.confirm(copy.value.scoreTokenConfirm, copy.value.scoreTokenConfirmTitle, {
        confirmButtonText: copy.value.confirm,
        cancelButtonText: copy.value.cancel,
        type: "warning"
      });
    } catch {
      return;
    }
  }

  scoreTokenBusy.value = true;
  try {
    const response = await apiFetch<{
      token: string | null;
      status: SyncOverviewPayload["scoreToken"];
    }>("/api/account/score-token", {
      method: "POST",
      body: { action }
    });
    issuedScoreToken.value = action === "issue" ? String(response.token || "") : "";
    ElMessage.success(action === "issue" ? copy.value.scoreTokenIssued : copy.value.scoreTokenRevoked);
    await refresh();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.scoreTokenUnavailable);
  } finally {
    scoreTokenBusy.value = false;
  }
};

const copyIssuedScoreToken = async () => {
  if (!issuedScoreToken.value) return;
  try {
    await navigator.clipboard.writeText(issuedScoreToken.value);
    ElMessage.success(copy.value.scoreTokenCopied);
  } catch {
    ElMessage.error(copy.value.scoreTokenUnavailable);
  }
};
</script>

<template>
  <div class="sync-page">
    <AnnualBetaContinue />
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
            <strong>{{ overview.currentBinding.displayName || overview.currentBinding.taikoId }}</strong>
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
          :type="overview.currentBinding.isManual ? 'info' : 'warning'"
          :closable="false"
          show-icon
          :title="overview.currentBinding.isManual ? copy.manualSaved : copy.serviceUnavailable"
          class="userdata-alert"
        />
      </el-card>

      <el-card class="panel-card score-token-panel">
        <div class="score-token-heading">
          <div class="section-title">
            <h3>{{ copy.scoreTokenTitle }}</h3>
            <p>{{ copy.scoreTokenDesc }}</p>
          </div>
          <NuxtLink class="score-token-docs" to="/docs/score-token">{{ copy.scoreTokenDocs }}</NuxtLink>
        </div>

        <el-alert
          v-if="overview.currentBinding?.isManual"
          type="info"
          :closable="false"
          :title="copy.scoreTokenManual"
          show-icon
          class="userdata-alert"
        />
        <el-alert
          v-else-if="overview.currentBinding && !overview.scoreTokenAvailable"
          type="warning"
          :closable="false"
          :title="copy.scoreTokenUnavailable"
          show-icon
          class="userdata-alert"
        />
        <template v-else>
          <div class="token-status-strip">
            <div>
              <span>{{ copy.scoreTokenMask }}</span>
              <strong class="token-mask">{{ overview.scoreToken?.tokenMask || copy.scoreTokenEmpty }}</strong>
            </div>
            <div>
              <span>{{ copy.scoreTokenCreated }}</span>
              <strong>{{ overview.scoreToken?.createdAt ? formatDateTime(overview.scoreToken.createdAt) : "-" }}</strong>
            </div>
            <div>
              <span>{{ copy.scoreTokenLastUsed }}</span>
              <strong>{{ overview.scoreToken?.lastUsedAt ? formatDateTime(overview.scoreToken.lastUsedAt) : copy.scoreTokenNeverUsed }}</strong>
            </div>
            <el-tag :type="overview.scoreToken?.exists ? 'success' : 'info'" effect="plain">
              {{ overview.scoreToken?.exists ? copy.scoreTokenReady : copy.scoreTokenEmpty }}
            </el-tag>
          </div>

          <div v-if="issuedScoreToken" class="token-reveal" role="status">
            <p>{{ copy.scoreTokenReveal }}</p>
            <div class="token-value-row">
              <code>{{ issuedScoreToken }}</code>
              <el-button type="primary" @click="copyIssuedScoreToken">{{ copy.scoreTokenCopy }}</el-button>
            </div>
          </div>

          <div class="score-token-actions">
            <el-button
              type="primary"
              :loading="scoreTokenBusy"
              :disabled="!overview.currentBinding || !overview.scoreTokenAvailable"
              @click="manageScoreToken('issue')"
            >
              {{ overview.scoreToken?.exists ? copy.scoreTokenRotate : copy.scoreTokenIssue }}
            </el-button>
            <el-button
              v-if="overview.scoreToken?.exists"
              type="danger"
              plain
              :disabled="scoreTokenBusy"
              @click="manageScoreToken('revoke')"
            >
              {{ copy.scoreTokenRevoke }}
            </el-button>
          </div>
        </template>
      </el-card>

      <el-card class="panel-card">
        <div class="section-title">
          <h3>{{ copy.kinokoTitle }}</h3>
          <p>{{ copy.kinokoDesc }}</p>
        </div>
        <el-alert
          v-if="overview.currentBinding"
          type="info"
          :closable="false"
          :title="copy.kinokoTarget.replace('{target}', overview.currentBinding.displayName || overview.currentBinding.taikoId)"
          class="userdata-alert"
        />
        <el-form class="kinoko-form" label-position="top" @submit.prevent="importFromKinoko">
          <el-form-item :label="copy.kinokoKey">
            <el-input
              v-model="kinokoApiKey"
              type="password"
              show-password
              autocomplete="off"
              :placeholder="copy.kinokoKeyPlaceholder"
            />
          </el-form-item>
          <div class="kinoko-actions">
            <el-button
              type="primary"
              native-type="submit"
              :loading="importingKinoko"
              :disabled="!overview.currentBinding || cooldown > 0 || importingKinokoHistory"
            >
              {{ cooldown > 0 ? copy.coolingDown.replace("{seconds}", String(cooldown)) : copy.kinokoStart }}
            </el-button>
            <el-button
              type="success"
              :loading="importingKinokoHistory"
              :disabled="!overview.currentBinding || cooldown > 0 || importingKinoko"
              @click="importHistoryFromKinoko"
            >
              {{ cooldown > 0 ? copy.coolingDown.replace("{seconds}", String(cooldown)) : copy.kinokoHistoryStart }}
            </el-button>
          </div>
        </el-form>
        <p class="kinoko-history-hint">{{ copy.kinokoHistoryHint }}</p>
      </el-card>

      <el-card v-if="!overview.currentBinding?.isManual" class="panel-card">
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

.score-token-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.score-token-docs {
  flex: 0 0 auto;
  color: var(--el-color-primary);
  font-weight: 600;
  text-decoration: none;
}

.score-token-docs:hover {
  text-decoration: underline;
}

.token-status-strip {
  display: grid;
  grid-template-columns: minmax(190px, 1.2fr) repeat(2, minmax(150px, 1fr)) auto;
  align-items: center;
  gap: 12px;
  margin-top: 18px;
  padding: 14px;
  border: 1px solid rgba(151, 119, 91, 0.22);
  border-radius: 8px;
  background: rgba(255, 248, 240, 0.82);
}

.token-status-strip > div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.token-status-strip span {
  color: #7d6a5a;
  font-size: 13px;
}

.token-status-strip strong {
  overflow-wrap: anywhere;
}

.token-mask,
.token-reveal code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0;
}

.token-reveal {
  margin-top: 14px;
  padding: 14px;
  border-left: 4px solid var(--el-color-warning);
  border-radius: 4px;
  background: rgba(253, 246, 236, 0.9);
}

.token-reveal p {
  margin: 0 0 10px;
  color: #7d6a5a;
  line-height: 1.6;
}

.token-value-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.token-value-row code {
  overflow-x: auto;
  padding: 10px 12px;
  border-radius: 6px;
  background: #fff;
  color: #3f332b;
  white-space: nowrap;
}

.score-token-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}

.score-token-actions .el-button {
  margin-left: 0;
}

.target-list {
  display: grid;
  gap: 12px;
  margin: 18px 0;
}

.kinoko-form {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto;
  align-items: end;
  gap: 12px;
  margin-top: 18px;
}

.kinoko-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.kinoko-actions {
  display: flex;
  gap: 8px;
}

.kinoko-actions .el-button {
  margin-left: 0;
}

.kinoko-history-hint {
  margin: 10px 0 0;
  color: #7d6a5a;
  font-size: 13px;
  line-height: 1.6;
}

@media (max-width: 760px) {
  .kinoko-form {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .kinoko-actions {
    display: grid;
  }

  .score-token-heading {
    display: grid;
  }

  .token-status-strip {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .token-status-strip .el-tag {
    justify-self: start;
  }

  .token-value-row,
  .score-token-actions {
    grid-template-columns: 1fr;
    display: grid;
  }
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
