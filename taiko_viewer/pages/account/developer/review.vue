<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { buildPageDescription } from "~/utils/seo";

type ReviewApplication = {
  id: number;
  replyEmail: string;
  reason: string;
  imageUrls: string[];
  status: string;
  reviewNote: string;
  reviewedAt: string;
  createdAt: string;
  updatedAt: string;
  applicant?: {
    id: number;
    username: string;
    email: string;
  };
  reviewer?: {
    id: number;
    username: string;
    email: string;
  } | null;
};

type ReviewPayload = {
  pending: ReviewApplication[];
  history: ReviewApplication[];
  forbidden?: boolean;
  message?: string;
};

const { t, locale } = useI18n();
const apiFetch = useViewerApiFetch();
const { formatDateTime } = useViewerDateTime();
const processingId = ref<number | null>(null);
let reviewDialogOwner: symbol | null = null;
async function openOwnedReviewDialog<T>(open: () => Promise<T>) {
  const owner = Symbol(); reviewDialogOwner = owner;
  try { return await open(); }
  finally { if (reviewDialogOwner === owner) reviewDialogOwner = null; }
}

definePageMeta({
  contentLayout: "wide",
  middleware: "account-auth",
  pageTitleKey: "account.developerReview",
  pageDescKey: "page.account.developerReview.desc",
  navKey: "/account/developer/review",
  breadcrumbs: [
    { labelKey: "account.title", to: "/account/profile" },
    { labelKey: "account.developer", to: "/account/developer" },
    { labelKey: "account.developerReview", to: "/account/developer/review" }
  ]
});

useViewerSeo(() => ({
  title: t("account.developerReview"),
  description: buildPageDescription(t("page.account.developerReview.desc")),
  path: "/account/developer/review"
}));

const copy = computed(() =>
  locale.value === "ja"
    ? {
        forbiddenTitle: "開発者審査画面にアクセスできません",
        forbiddenSubtitle: "現在のアカウントは審査権限を持っていません",
        pendingTitle: "審査待ち申請",
        pendingDesc: "`sigaer` のみこのページにアクセスできます。承認後は 24 桁の開発者 Token を自動発行します。",
        noPending: "審査待ち申請はありません",
        unknownUser: "不明なユーザー",
        approvePrompt: "審査メモ（任意）を入力できます",
        approveTitle: "申請 #{id} を承認",
        approvePlaceholder: "例：呼び出し頻度に注意してください",
        approve: "承認",
        rejectPrompt: "却下理由を入力してください",
        rejectTitle: "申請 #{id} を却下",
        rejectPlaceholder: "例：用途説明が不足しているため、接続シナリオを補足してください",
        rejectValidation: "却下理由を入力してください",
        reject: "却下",
        successMail: "承認済み。Token を {email} に送信しました",
        successNoMail: "承認済みですがメール送信に失敗しました。今回の Token を手動で控えてください",
        issuedTokenTitle: "審査完了",
        issuedTokenConfirm: "了解",
        issuedTokenMailOk: "メールは申請者に送信済みです。",
        issuedTokenMailFailed: "メール送信に失敗したため、申請者へ手動で共有してください。",
        approveFailed: "承認処理に失敗しました",
        rejected: "申請を却下しました",
        rejectFailed: "却下処理に失敗しました",
        historyTitle: "審査履歴",
        historyDesc: "最近処理した開発者申請をここに残します。",
        noHistory: "審査履歴はありません"
      }
    : {
        forbiddenTitle: "无权访问开发者审批台",
        forbiddenSubtitle: "当前账号不是审批人",
        pendingTitle: "待审批申请",
        pendingDesc: "只有 `sigaer` 可访问此页面。审批通过后将自动签发 24 位开发者 Token。",
        noPending: "当前没有待审批的申请",
        unknownUser: "未知用户",
        approvePrompt: "可填写审批备注（选填）",
        approveTitle: "通过申请 #{id}",
        approvePlaceholder: "例如：请注意控制调用频率",
        approve: "通过",
        rejectPrompt: "请输入不通过理由",
        rejectTitle: "驳回申请 #{id}",
        rejectPlaceholder: "例如：当前用途描述不足，请补充接入场景",
        rejectValidation: "请填写不通过理由",
        reject: "驳回",
        successMail: "审批已通过，Token 已发往 {email}",
        successNoMail: "审批已通过，但邮件发送失败，请手动保存本次签发的 Token",
        issuedTokenTitle: "审批完成",
        issuedTokenConfirm: "知道了",
        issuedTokenMailOk: "邮件已发送给申请人。",
        issuedTokenMailFailed: "邮件发送失败，请你手动转交申请人。",
        approveFailed: "审批通过失败",
        rejected: "申请已驳回",
        rejectFailed: "驳回失败",
        historyTitle: "审批历史",
        historyDesc: "最近处理过的开发者申请会保留在这里。",
        noHistory: "暂无审批历史"
      }
);

const { accountUser } = useAccountState();
const { data, pending, error: readError, refresh } = useForumResource<ReviewPayload>(
  "account-developer-review", async () => {
    try { return await apiFetch<ReviewPayload>("/api/account/developer/review"); }
    catch (error: any) {
      if (Number(error?.statusCode || error?.status) === 403) return {pending: [], history: [], forbidden: true};
      throw error;
    }
  }, { enabled: () => Boolean(accountUser.value) }
);
const actionScope = useAccountPageScope(() => { processingId.value = null; if (reviewDialogOwner) { reviewDialogOwner = null; ElMessageBox.close(); } });

const reviewState = computed(() => data.value);

const handleApprove = async (application: ReviewApplication) => {
  if (processingId.value || reviewDialogOwner) return;
  const ticket = actionScope.capture();
  if (!actionScope.current(ticket)) return;
  let reviewNote = "";
  try {
    const result = await openOwnedReviewDialog(() => ElMessageBox.prompt(
      copy.value.approvePrompt,
      copy.value.approveTitle.replace("{id}", String(application.id)),
      {
        confirmButtonText: copy.value.approve,
        cancelButtonText: t("common.cancel"),
        inputPlaceholder: copy.value.approvePlaceholder
      }
    ));
    reviewNote = String(result.value || "").trim();
  } catch {
    return;
  }
  if (!actionScope.current(ticket) || processingId.value) return;
  processingId.value = application.id;
  try {
    const result = await apiFetch<{
      issuedToken: string | null;
      mailDelivered: boolean;
    }>("/api/account/developer/review", {
      method: "POST",
      body: {
        applicationId: application.id,
        action: "approve",
        reviewNote
      }
    });
    if (!actionScope.current(ticket)) return;
    const message = result.mailDelivered
      ? copy.value.successMail.replace("{email}", application.replyEmail)
      : copy.value.successNoMail;
    ElMessage.success(message);
    if (result.issuedToken) {
      await openOwnedReviewDialog(() => ElMessageBox.alert(
        `Token: ${result.issuedToken}\n${result.mailDelivered ? copy.value.issuedTokenMailOk : copy.value.issuedTokenMailFailed}`,
        copy.value.issuedTokenTitle,
        {
          confirmButtonText: copy.value.issuedTokenConfirm
        }
      ));
    }
    if (actionScope.current(ticket)) await refresh();
  } catch (error: any) {
    if (!actionScope.current(ticket)) return;
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.approveFailed);
  } finally {
    if (actionScope.current(ticket)) processingId.value = null;
  }
};

const handleReject = async (application: ReviewApplication) => {
  if (processingId.value || reviewDialogOwner) return;
  const ticket = actionScope.capture();
  if (!actionScope.current(ticket)) return;
  let reviewNote = "";
  try {
    const result = await openOwnedReviewDialog(() => ElMessageBox.prompt(
      copy.value.rejectPrompt,
      copy.value.rejectTitle.replace("{id}", String(application.id)),
      {
        confirmButtonText: copy.value.reject,
        cancelButtonText: t("common.cancel"),
        inputPlaceholder: copy.value.rejectPlaceholder,
        inputValidator: (value) => (String(value || "").trim() ? true : copy.value.rejectValidation)
      }
    ));
    reviewNote = String(result.value || "").trim();
  } catch {
    return;
  }
  if (!actionScope.current(ticket) || processingId.value) return;
  processingId.value = application.id;
  try {
    await apiFetch("/api/account/developer/review", {
      method: "POST",
      body: {
        applicationId: application.id,
        action: "reject",
        reviewNote
      }
    });
    if (!actionScope.current(ticket)) return;
    ElMessage.success(copy.value.rejected);
    if (actionScope.current(ticket)) await refresh();
  } catch (error: any) {
    if (!actionScope.current(ticket)) return;
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.rejectFailed);
  } finally {
    if (actionScope.current(ticket)) processingId.value = null;
  }
};
</script>

<template>
  <div class="developer-review-page">
    <el-card v-if="pending" class="panel-card">
      <el-skeleton :rows="8" animated />
    </el-card>

    <div v-else-if="readError" role="alert" class="panel-card entry-read-error">
      <p>{{ readError }}</p><el-button @click="refresh">{{ t('common.retry') }}</el-button>
    </div>
    <template v-else-if="reviewState?.forbidden">
      <el-result icon="warning" :title="copy.forbiddenTitle" :sub-title="reviewState.message || copy.forbiddenSubtitle" />
    </template>

    <template v-else-if="reviewState">
      <el-card class="panel-card">
        <div class="section-title">
          <h2>{{ copy.pendingTitle }}</h2>
          <p>{{ copy.pendingDesc }}</p>
        </div>
        <el-empty v-if="!reviewState.pending.length" :description="copy.noPending" />
        <div v-else class="application-list">
          <article v-for="application in reviewState.pending" :key="application.id" class="application-item">
            <div class="application-item__head">
              <div>
                <strong>#{{ application.id }} · {{ application.applicant?.username || copy.unknownUser }}</strong>
                <p>{{ application.applicant?.email || "-" }} · {{ application.replyEmail }}</p>
              </div>
              <span>{{ formatDateTime(application.createdAt) }}</span>
            </div>
            <p class="application-item__reason">{{ application.reason }}</p>
            <div v-if="application.imageUrls.length" class="image-preview-grid">
              <a
                v-for="url in application.imageUrls"
                :key="url"
                :href="url"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img :src="url" alt="开发者申请截图" />
              </a>
            </div>
            <div class="application-item__actions">
              <el-button
                type="success"
                :loading="processingId === application.id"
                @click="handleApprove(application)"
              >
                {{ copy.approve }}
              </el-button>
              <el-button
                type="danger"
                plain
                :loading="processingId === application.id"
                @click="handleReject(application)"
              >
                {{ copy.reject }}
              </el-button>
            </div>
          </article>
        </div>
      </el-card>

      <el-card class="panel-card">
        <div class="section-title">
          <h3>{{ copy.historyTitle }}</h3>
          <p>{{ copy.historyDesc }}</p>
        </div>
        <el-empty v-if="!reviewState.history.length" :description="copy.noHistory" />
        <div v-else class="history-list">
          <div v-for="item in reviewState.history" :key="item.id" class="history-item">
            <div class="history-item__head">
              <strong>#{{ item.id }} · {{ item.applicant?.username || copy.unknownUser }}</strong>
              <span>{{ item.status }}</span>
            </div>
            <p>{{ item.replyEmail }}</p>
            <p v-if="item.reviewNote" class="history-item__note">{{ item.reviewNote }}</p>
          </div>
        </div>
      </el-card>
    </template>
  </div>
</template>

<style scoped>
.developer-review-page {
  display: grid;
  gap: 18px;
}

.section-title h2,
.section-title h3 {
  margin: 0;
}

.section-title p {
  margin: 8px 0 0;
  color:var(--viewer-text-muted);
  line-height: 1.8;
}

.application-list,
.history-list {
  display: grid;
  gap: 14px;
  margin-top: 18px;
}

.application-item,
.history-item {
  padding: 14px;
  border-radius: 14px;
  background:var(--viewer-surface-subtle);
}

.application-item__head,
.history-item__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.application-item__head p,
.history-item p {
  margin: 6px 0 0;
  color:var(--viewer-text-muted);
}

.application-item__reason,
.history-item__note {
  margin: 12px 0 0;
  line-height: 1.8;
  white-space: pre-wrap;
}

.image-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.image-preview-grid a {
  display: block;
}

.image-preview-grid img {
  width: 100%;
  border-radius: 12px;
  display: block;
}

.application-item__actions {
  display: flex;
  gap: 12px;
  margin-top: 14px;
}
</style>
