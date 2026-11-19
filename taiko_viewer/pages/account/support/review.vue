<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { buildPageDescription } from "~/utils/seo";
import type { SupportReviewDashboard, SupportTicketDetail, SupportTicketMessage } from "~/types/support";

const route = useRoute();
const { t, locale } = useI18n();
const apiFetch = useViewerApiFetch();
const { formatDateTime } = useViewerDateTime();

const selectedTicketId = ref<number | null>(null);
const replyContent = ref("");
const loadingDetail = ref(false);
const submitting = ref(false);
const ticketDetail = ref<SupportTicketDetail | null>(null);

definePageMeta({
  contentLayout: "wide",
  hidePageHeader: true,
  middleware: "account-auth",
  pageTitleKey: "account.supportReview",
  pageDescKey: "page.account.supportReview.desc",
  navKey: "/account/support/review",
  breadcrumbs: [
    { labelKey: "account.title", to: "/account/profile" },
    { labelKey: "nav.support", to: "/support" },
    { labelKey: "account.supportReview", to: "/account/support/review" }
  ]
});

useViewerSeo(() => ({
  title: t("account.supportReview"),
  description: buildPageDescription(t("page.account.supportReview.desc")),
  path: "/account/support/review"
}));

// Slice E2: the inline zh / ja table moved to locales (rework.account.supportReview.*), same texts; placeholders pass through literally.
const SUPPORT_REVIEW_COPY_KEYS = ["forbiddenTitle", "forbiddenSubtitle", "pendingTitle", "historyTitle", "noPending", "noHistory", "unknownUser", "threadTitle", "replyTitle", "replyPlaceholder", "replySubmit", "replyClose", "closeOnly", "replySuccess", "replyQueued", "replyFailed", "closeSuccess", "closeFailed", "needReply", "staffLabel", "userLabel", "unread", "statusOpen", "statusClosed"] as const;
const copy = computed(() => (void locale.value, Object.fromEntries(
  SUPPORT_REVIEW_COPY_KEYS.map((key) => [key, t(`rework.account.supportReview.${key}`)])
) as Record<(typeof SUPPORT_REVIEW_COPY_KEYS)[number], string>));

const SUPPORT_CATEGORIES = ["account", "sync", "forum", "data", "bug", "feature", "other"] as const;
const categoryLabels = computed(() => (void locale.value, Object.fromEntries(
  SUPPORT_CATEGORIES.map((key) => [key, t(`rework.account.support.categories.${key}`)])
) as Record<string, string>));

const { data, pending, refresh } = await useAsyncData<SupportReviewDashboard & { forbidden?: boolean; message?: string }>(
  "account-support-review",
  async () => {
    try {
      return await apiFetch("/api/account/support/review");
    } catch (error: any) {
      return {
        pending: [],
        history: [],
        forbidden: true,
        message: error?.data?.statusMessage || error?.message || copy.value.forbiddenTitle
      };
    }
  },
  {
    default: () => ({
      pending: [],
      history: []
    })
  }
);

const reviewState = computed(() => data.value);

const getMessageLabel = (message: SupportTicketMessage) =>
  message.authorRole === "staff" ? copy.value.staffLabel : copy.value.userLabel;

const loadTicketDetail = async (ticketId: number) => {
  loadingDetail.value = true;
  try {
    ticketDetail.value = await apiFetch<SupportTicketDetail>(`/api/account/support/review/${ticketId}`);
    selectedTicketId.value = ticketId;
    replyContent.value = "";
    await refresh();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.replyFailed);
  } finally {
    loadingDetail.value = false;
  }
};

const selectTicket = async (ticketId: number) => {
  if (selectedTicketId.value === ticketId && ticketDetail.value) return;
  await loadTicketDetail(ticketId);
};

watch(
  () => route.query.id,
  async (value) => {
    const ticketId = Number(value);
    if (Number.isFinite(ticketId) && ticketId > 0 && !reviewState.value?.forbidden) {
      await loadTicketDetail(ticketId);
    }
  },
  { immediate: true }
);

const submitReply = async (close: boolean) => {
  if (!selectedTicketId.value || submitting.value) return;
  const content = replyContent.value.trim();
  if (!content) {
    ElMessage.warning(copy.value.needReply);
    return;
  }

  submitting.value = true;
  try {
    const response = await apiFetch<{ ok: true; ticket: SupportTicketDetail; mailDelivered: boolean }>(
      `/api/account/support/review/${selectedTicketId.value}/reply`,
      {
        method: "POST",
        body: { content, close }
      }
    );
    ticketDetail.value = response.ticket;
    replyContent.value = "";
    if (response.mailDelivered) {
      ElMessage.success(copy.value.replySuccess);
    } else {
      ElMessage.warning(copy.value.replyQueued);
    }
    await refresh();
    if (close) {
      selectedTicketId.value = null;
      ticketDetail.value = null;
    }
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.replyFailed);
  } finally {
    submitting.value = false;
  }
};

const closeTicket = async () => {
  if (!selectedTicketId.value || submitting.value) return;
  submitting.value = true;
  try {
    const response = await apiFetch<{ ok: true; ticket: SupportTicketDetail }>(
      `/api/account/support/review/${selectedTicketId.value}/close`,
      { method: "POST" }
    );
    ticketDetail.value = response.ticket;
    ElMessage.success(copy.value.closeSuccess);
    selectedTicketId.value = null;
    ticketDetail.value = null;
    await refresh();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.closeFailed);
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div class="support-review-page rw-stack">
    <ReworkPageHeader :title="t('account.supportReview')" />
    <!-- The page re-reads the dashboard after every action (as before); keep the lists and the open ticket on screen
         while it does, and show the loading state only before the first lists arrive. -->
    <ReworkState v-if="pending && !reviewState?.pending.length && !reviewState?.history.length" kind="loading" :lines="6" />
    <ReworkState
      v-else-if="reviewState?.forbidden"
      kind="empty"
      class="review-forbidden"
      :title="copy.forbiddenTitle"
      :text="reviewState.message || copy.forbiddenSubtitle"
    />
    <ReworkSupportReview
      v-else
      v-model:reply="replyContent"
      :state="reviewState"
      :selected-id="selectedTicketId"
      :detail="ticketDetail"
      :loading-detail="loadingDetail"
      :submitting="submitting"
      :format-time="formatDateTime"
      :category-label="(category: string) => categoryLabels[category] || category"
      @select="selectTicket"
      @reply="submitReply(false)"
      @reply-close="submitReply(true)"
      @close="closeTicket"
    />
  </div>
</template>
