<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type { GoalEvaluationResponse } from "~/types/goal-evaluation";
import { formatScoreRank } from "~/utils/scoreRank";
import { buildPageDescription } from "~/utils/seo";
import type { SyncLog, SyncOverviewPayload } from "~/utils/rework/sync";


const { t, locale } = useI18n();
const apiFetch = useViewerApiFetch();
const localePath = useLocalePath();
const route = useRoute();
const { formatDateTime } = useViewerDateTime();

definePageMeta({
  contentLayout: "reading",
  hidePageHeader: true,
  reworkElementPlus: true,
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
const completion = ref<{ status: "success" | "partial" | "failed"; logId?: number } | null>(null);
const goalEvaluation = ref<GoalEvaluationResponse | null>(null);
const evaluatingGoal = ref(false);
// Slice E2: the inline zh / ja tables moved to locales (rework.account.sync.*), same texts. Placeholders ({seconds},
// {success}, ...) are passed through literally, so the handlers' .replace(...) calls are unchanged.
const GOAL_COPY_KEYS = ["title", "completed", "active", "inconclusive", "evaluation-error", "retry", "back", "changed"] as const;
const goalCopy = computed(() => (void locale.value, Object.fromEntries(
  GOAL_COPY_KEYS.map((key) => [key, t(`rework.account.sync.goal.${key}`)])
) as Record<(typeof GOAL_COPY_KEYS)[number], string>));
const goalChange = computed(() => {
  const result = goalEvaluation.value?.recentCompletedGoal?.completionEvidence?.result;
  if (!result || !['score-pb', 'ng-reduced', 'rank-upgrade'].includes(result.goalType)) return '';
  const format = (value: number) => result.goalType === 'rank-upgrade' ? formatScoreRank(value, locale.value) : value.toLocaleString(locale.value === 'ja' ? 'ja-JP' : 'zh-CN');
  return `${t(`home.growth.factLabels.${result.goalType}`)} ${format(result.before)} → ${format(result.after)}`;
});
const importingKinoko = ref(false);
const importingKinokoHistory = ref(false);
const kinokoApiKey = ref("");
const scoreTokenBusy = ref(false);
let scoreTokenDialogOwner: symbol | null = null;
async function openScoreTokenDialog(open: () => Promise<unknown>) {
  const owner = Symbol(); scoreTokenDialogOwner = owner;
  try { return await open(); }
  finally { if (scoreTokenDialogOwner === owner) scoreTokenDialogOwner = null; }
}
const issuedScoreToken = ref("");
// Slice E2 (presentation): the result line of the last request, shown beside its action (the toast stays).
type ActionNotice = { level: "success" | "warning" | "error"; message: string; field?: "key" } | null;
const syncNotice = ref<ActionNotice>(null);
const importNotice = ref<ActionNotice>(null);
const scoreTokenError = ref("");
const cooldown = ref(0);
let cooldownTimer: ReturnType<typeof setInterval> | null = null;

const SYNC_COPY_KEYS = ["title", "serviceUnavailable", "reverifyBinding", "manualSaved", "currentBinding", "currentTitle", "ready", "remaining", "needBinding", "targets", "noTargets", "start", "coolingDown", "lastSync", "noHistory", "syncTime", "overallStatus", "compressedSize", "compressedRate", "success", "failed", "decompressed", "songs", "selectTarget", "syncDone", "syncSuccess", "syncPartial", "syncFailed", "kinokoTitle", "kinokoDesc", "kinokoKey", "kinokoKeyPlaceholder", "kinokoTarget", "kinokoStart", "kinokoHistoryStart", "kinokoHistoryHint", "kinokoNeedKey", "kinokoDone", "kinokoHistoryDone", "scoreTokenTitle", "scoreTokenDesc", "scoreTokenReady", "scoreTokenEmpty", "scoreTokenUnavailable", "scoreTokenManual", "scoreTokenMask", "scoreTokenLastUsed", "scoreTokenNeverUsed", "scoreTokenCreated", "scoreTokenIssue", "scoreTokenRotate", "scoreTokenRevoke", "scoreTokenIssued", "scoreTokenRevoked", "scoreTokenReveal", "scoreTokenCopied", "scoreTokenCopy", "scoreTokenDocs", "scoreTokenConfirmTitle", "scoreTokenConfirm", "confirm", "cancel"] as const;
const SYNC_COPY_PLACEHOLDERS = { seconds: "{seconds}", success: "{success}", total: "{total}", failed: "{failed}", target: "{target}", added: "{added}", updated: "{updated}", unchanged: "{unchanged}", imported: "{imported}", skipped: "{skipped}", files: "{files}" };
const copy = computed(() => (void locale.value, Object.fromEntries(
  SYNC_COPY_KEYS.map((key) => [key, t(`rework.account.sync.${key}`, SYNC_COPY_PLACEHOLDERS)])
) as Record<(typeof SYNC_COPY_KEYS)[number], string>));

const { accountUser } = useAccountState();
const bindingGeneration = useState("account-binding-generation", () => 0);
const { data, pending, error: readError, refresh } = useForumResource<SyncOverviewPayload>(
  "account-sync-overview", () => apiFetch("/api/account/sync/targets"),
  { context: () => String(bindingGeneration.value), enabled: () => Boolean(accountUser.value) }
);
const actionScope = useAccountPageScope(() => {
  if (scoreTokenDialogOwner) { scoreTokenDialogOwner = null; ElMessageBox.close(); }
  completion.value = null; goalEvaluation.value = null; evaluatingGoal.value = false;
  selectedTargetIds.value = []; submitting.value = false; importingKinoko.value = false;
  importingKinokoHistory.value = false; kinokoApiKey.value = ""; scoreTokenBusy.value = false;
  issuedScoreToken.value = ""; startCooldown(0);
  syncNotice.value = null; importNotice.value = null; scoreTokenError.value = "";
}, true);

const overview = computed(() => data.value);
const goalContextChanged = computed(() => route.query.from === 'goal' && typeof route.query.profileId === 'string' &&
  !!overview.value?.currentBinding && route.query.profileId !== String(overview.value.currentBinding.id));
const retryGoalEvaluation = async () => {
  const ticket = actionScope.capture();
  const profileId = String(overview.value?.currentBinding?.id || goalEvaluation.value?.profileId || '');
  if (!actionScope.current(ticket) || evaluatingGoal.value || !profileId || goalContextChanged.value) return;
  evaluatingGoal.value = true;
  try {
    const result = await apiFetch<GoalEvaluationResponse>('/api/account/growth/goal/evaluate-current', { method: 'POST', retry: 0, body: { profileId } });
    if (actionScope.current(ticket) && result.profileId === profileId) goalEvaluation.value = result;
  } catch {
    if (actionScope.current(ticket)) goalEvaluation.value = { profileId, outcome: 'evaluation-error', activeGoal: null, recentCompletedGoal: null };
  } finally { if (actionScope.current(ticket)) evaluatingGoal.value = false; }
};
const completedStatus = computed(() => {
  const current = overview.value;
  if (!current?.currentBinding || !current.hasUserdata) return null;
  const log = current.lastSync;
  if (completion.value) {
    if (completion.value.status === "failed") return null;
    if (completion.value.logId !== undefined &&
      (log?.id !== completion.value.logId || log.taikoId !== current.currentBinding.taikoId)) return null;
    return completion.value.status;
  }
  return log?.taikoId === current.currentBinding.taikoId && log.results.some(result => result.ok) &&
    ["success", "partial"].includes(log.status) ? log.status : null;
});
const showNextSteps = computed(() => Boolean(accountUser.value && completedStatus.value) &&
  !pending.value && !readError.value && !submitting.value && !importingKinoko.value && !importingKinokoHistory.value);
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
      level: "warning" as const,
      message: t("rework.account.sync.noResult")
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
  const ticket = actionScope.capture();
  if (!actionScope.current(ticket)) return;
  if (submitting.value || pending.value || evaluatingGoal.value) return;
  if (goalContextChanged.value) { ElMessage.warning(goalCopy.value.changed); syncNotice.value = { level: "warning", message: goalCopy.value.changed }; return; }
  if (!selectedTargetIds.value.length) {
    ElMessage.warning(copy.value.selectTarget);
    syncNotice.value = { level: "warning", message: copy.value.selectTarget };
    return;
  }
  submitting.value = true;
  syncNotice.value = null;
  goalEvaluation.value = null;
  completion.value = { status: "failed" };
  try {
    const response = await apiFetch<{ log: SyncLog | null; goalEvaluation: GoalEvaluationResponse }>("/api/account/sync", {
      method: "POST",
      body: {
        profileId: String(overview.value?.currentBinding?.id || ""),
        targetIds: selectedTargetIds.value
      }
    });
    if (!actionScope.current(ticket)) return;
    if (response.goalEvaluation?.profileId === String(overview.value?.currentBinding?.id || '')) goalEvaluation.value = response.goalEvaluation;
    const status = response?.log?.status;
    completion.value = { status: status === "success" || status === "partial" ? status : "failed", logId: response?.log?.id };
    const feedback = buildSyncFeedback(response?.log);
    syncNotice.value = feedback;
    if (feedback.level === "success") {
      ElMessage.success(feedback.message);
    } else if (feedback.level === "warning") {
      ElMessage.warning(feedback.message);
    } else {
      ElMessage.error(feedback.message);
    }
    await refresh();
  } catch (error: any) {
    if (!actionScope.current(ticket)) return;
    completion.value = { status: "failed" };
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.syncFailed);
    syncNotice.value = { level: "error", message: error?.data?.statusMessage || error?.message || copy.value.syncFailed };
    await refresh();
  } finally {
    if (actionScope.current(ticket)) submitting.value = false;
  }
};

const importFromKinoko = async () => {
  const ticket = actionScope.capture();
  if (!actionScope.current(ticket)) return;
  if (importingKinoko.value || importingKinokoHistory.value || pending.value) return;
  if (!kinokoApiKey.value.trim()) {
    ElMessage.warning(copy.value.kinokoNeedKey);
    importNotice.value = { level: "warning", message: copy.value.kinokoNeedKey, field: "key" };
    kinokoForm.value?.focus();
    return;
  }
  importNotice.value = null;
  goalEvaluation.value = null;
  importingKinoko.value = true;
  completion.value = { status: "failed" };
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
    if (!actionScope.current(ticket)) return;
    kinokoApiKey.value = "";
    completion.value = { status: response.partial ? "partial" : "success" };
    if (response.partial) ElMessage.warning(response.message);
    else ElMessage.success(
      copy.value.kinokoDone
        .replace("{added}", String(response.summary.added))
        .replace("{updated}", String(response.summary.updated))
        .replace("{unchanged}", String(response.summary.unchanged))
    );
    importNotice.value = response.partial
      ? { level: "warning", message: String(response.message || "") }
      : { level: "success", message: copy.value.kinokoDone.replace("{added}", String(response.summary.added)).replace("{updated}", String(response.summary.updated)).replace("{unchanged}", String(response.summary.unchanged)) };
    await refresh();
  } catch (error: any) {
    if (!actionScope.current(ticket)) return;
    completion.value = { status: "failed" };
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.syncFailed);
    importNotice.value = { level: "error", message: error?.data?.statusMessage || error?.message || copy.value.syncFailed };
    await refresh();
  } finally {
    if (actionScope.current(ticket)) importingKinoko.value = false;
  }
};

const importHistoryFromKinoko = async () => {
  const ticket = actionScope.capture();
  if (!actionScope.current(ticket)) return;
  if (importingKinoko.value || importingKinokoHistory.value || pending.value) return;
  if (!kinokoApiKey.value.trim()) {
    ElMessage.warning(copy.value.kinokoNeedKey);
    importNotice.value = { level: "warning", message: copy.value.kinokoNeedKey, field: "key" };
    kinokoForm.value?.focus();
    return;
  }
  importNotice.value = null;
  goalEvaluation.value = null;
  importingKinokoHistory.value = true;
  completion.value = { status: "failed" };
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
    if (!actionScope.current(ticket)) return;
    kinokoApiKey.value = "";
    completion.value = { status: response.partial ? "partial" : "success" };
    if (response.partial) ElMessage.warning(response.message);
    else ElMessage.success(
      copy.value.kinokoHistoryDone
        .replace("{imported}", String(response.summary.history.importedRecords))
        .replace("{skipped}", String(response.summary.history.skippedRecords))
        .replace("{files}", String(response.summary.history.snapshotFiles))
    );
    importNotice.value = response.partial
      ? { level: "warning", message: String(response.message || "") }
      : { level: "success", message: copy.value.kinokoHistoryDone.replace("{imported}", String(response.summary.history.importedRecords)).replace("{skipped}", String(response.summary.history.skippedRecords)).replace("{files}", String(response.summary.history.snapshotFiles)) };
    await refresh();
  } catch (error: any) {
    if (!actionScope.current(ticket)) return;
    completion.value = { status: "failed" };
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.syncFailed);
    importNotice.value = { level: "error", message: error?.data?.statusMessage || error?.message || copy.value.syncFailed };
    await refresh();
  } finally {
    if (actionScope.current(ticket)) importingKinokoHistory.value = false;
  }
};

const manageScoreToken = async (action: "issue" | "revoke") => {
  const ticket = actionScope.capture();
  if (!actionScope.current(ticket)) return;
  if (scoreTokenBusy.value || scoreTokenDialogOwner || pending.value) return;
  if (action === "revoke") {
    try {
      await openScoreTokenDialog(() => ElMessageBox.confirm(copy.value.scoreTokenConfirm, copy.value.scoreTokenConfirmTitle, {
        confirmButtonText: copy.value.confirm,
        cancelButtonText: copy.value.cancel,
        type: "warning"
      }));
    } catch {
      return;
    }
  }

  if (!actionScope.current(ticket) || scoreTokenBusy.value) return;
  scoreTokenBusy.value = true;
  scoreTokenError.value = "";
  try {
    const response = await apiFetch<{
      token: string | null;
      status: SyncOverviewPayload["scoreToken"];
    }>("/api/account/score-token", {
      method: "POST",
      body: { action }
    });
    if (!actionScope.current(ticket)) return;
    issuedScoreToken.value = action === "issue" ? String(response.token || "") : "";
    ElMessage.success(action === "issue" ? copy.value.scoreTokenIssued : copy.value.scoreTokenRevoked);
    await refresh();
  } catch (error: any) {
    if (!actionScope.current(ticket)) return;
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.scoreTokenUnavailable);
    scoreTokenError.value = error?.data?.statusMessage || error?.message || copy.value.scoreTokenUnavailable;
  } finally {
    if (actionScope.current(ticket)) scoreTokenBusy.value = false;
  }
};

// Slice E2 (presentation): the key field of the import form (focused when the key is missing) and the last
// result's text for the overview.
const kinokoForm = ref<{ focus: () => void } | null>(null);
const lastFeedback = computed(() => (overview.value?.lastSync ? buildSyncFeedback(overview.value.lastSync) : null));

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
  <div class="sync-page rw-stack">
    <ReworkPageHeader :title="t('account.sync')" />
    <AnnualBetaContinue />
    <ReworkSyncIndicatorSource :overview="overview" :busy="submitting || importingKinoko || importingKinokoHistory" />
    <ReworkSyncGoalResult
      v-if="goalEvaluation || route.query.from === 'goal'"
      :evaluation="goalEvaluation"
      :context-changed="goalContextChanged"
      :evaluating="evaluatingGoal"
      :submitting="submitting"
      :change="goalChange"
      :completed-label="goalEvaluation?.recentCompletedGoal ? t(`home.goal.completedTypes.${goalEvaluation.recentCompletedGoal.goalType}`) : ''"
      @retry="retryGoalEvaluation"
    />

    <ReworkState v-if="pending" kind="loading" :lines="6" />
    <ReworkState v-else-if="readError" kind="failed" class="entry-read-error" :text="readError" @retry="refresh" />
    <template v-else-if="overview">
      <ReworkSyncOverview
        v-if="overview.currentBinding"
        v-model:selected="selectedTargetIds"
        :overview="overview"
        :cooldown="cooldown"
        :pending="pending"
        :submitting="submitting"
        :start-disabled="pending || !overview.currentBinding || overview.canSyncFromWahlap === false || cooldown > 0 || !overview.targets.length"
        :notice="syncNotice"
        :last-feedback="lastFeedback"
        @submit="submitSync"
      />
      <ReworkPanel v-else :label="copy.title">
        <ReworkGate need="binding" :title="copy.needBinding" compact />
      </ReworkPanel>

      <ReworkSyncNextSteps v-if="showNextSteps" :partial="completedStatus === 'partial'" />

      <ReworkSyncLastSync
        :log="overview.lastSync"
        :feedback="overview.lastSync ? buildSyncFeedback(overview.lastSync).message : ''"
        :ratio="compressionRatio"
      />

      <ReworkSyncScoreToken
        :overview="overview"
        :issued="issuedScoreToken"
        :busy="scoreTokenBusy"
        :pending="pending"
        :error="scoreTokenError"
        @issue="manageScoreToken('issue')"
        @revoke="manageScoreToken('revoke')"
        @copy="copyIssuedScoreToken"
      />

      <ReworkSyncKinoko
        ref="kinokoForm"
        v-model:api-key="kinokoApiKey"
        :cooldown="cooldown"
        :pending="pending"
        :importing="importingKinoko"
        :importing-history="importingKinokoHistory"
        :has-binding="Boolean(overview.currentBinding)"
        :target="overview.currentBinding ? overview.currentBinding.displayName || overview.currentBinding.taikoId : ''"
        :notice="importNotice"
        @import="importFromKinoko"
        @import-history="importHistoryFromKinoko"
      />
    </template>
  </div>
</template>
