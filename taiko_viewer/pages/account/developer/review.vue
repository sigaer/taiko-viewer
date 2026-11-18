<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { buildPageDescription } from "~/utils/seo";
import type { ReviewApplication, ReviewPayload } from "~/utils/rework/developer";


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
  hidePageHeader: true,
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

// Slice E2: the inline zh / ja table moved to locales (rework.account.developerReview.*), same texts; placeholders pass through literally.
const REVIEW_COPY_KEYS = ["forbiddenTitle", "forbiddenSubtitle", "pendingTitle", "noPending", "unknownUser", "approvePrompt", "approveTitle", "approvePlaceholder", "approve", "rejectPrompt", "rejectTitle", "rejectPlaceholder", "rejectValidation", "reject", "successMail", "successNoMail", "issuedTokenTitle", "issuedTokenConfirm", "issuedTokenMailOk", "issuedTokenMailFailed", "approveFailed", "rejected", "rejectFailed", "historyTitle", "noHistory"] as const;
const copy = computed(() => (void locale.value, Object.fromEntries(
  REVIEW_COPY_KEYS.map((key) => [key, t(`rework.account.developerReview.${key}`, { id: "{id}", email: "{email}" })])
) as Record<(typeof REVIEW_COPY_KEYS)[number], string>));

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
  <div class="developer-review-page rw-stack">
    <ReworkPageHeader :title="t('account.developerReview')" />
    <ReworkState v-if="pending" kind="loading" :lines="6" />
    <ReworkState v-else-if="readError" kind="failed" class="entry-read-error" :text="readError" @retry="refresh" />
    <ReworkState
      v-else-if="reviewState?.forbidden"
      kind="empty"
      class="review-forbidden"
      :title="copy.forbiddenTitle"
      :text="reviewState.message || copy.forbiddenSubtitle"
    />
    <ReworkDeveloperReview
      v-else-if="reviewState"
      :state="reviewState"
      :processing-id="processingId"
      @approve="handleApprove"
      @reject="handleReject"
    />
  </div>
</template>
