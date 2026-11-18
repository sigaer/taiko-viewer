<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { buildPageDescription } from "~/utils/seo";
import type {
  SupportTicket,
  SupportTicketCategory,
  SupportTicketCreateResponse,
  SupportTicketDetail,
  SupportTicketListResponse,
  SupportTicketMessage
} from "~/types/support";

const { t, locale } = useI18n();
const apiFetch = useViewerApiFetch();
const { accountUser, fetchCurrentUser } = useAccountState();
await fetchCurrentUser();

definePageMeta({
  hidePageHeader: true,
  reworkElementPlus: true,
  middleware: "account-auth",
  pageTitleKey: "nav.support",
  pageDescKey: "page.support.desc",
  navKey: "/support",
  breadcrumbs: [{ labelKey: "nav.support", to: "/support" }]
});

useViewerSeo(() => ({
  title: t("nav.support"),
  description: buildPageDescription(t("page.support.desc")),
  path: "/support"
}));

const form = reactive<{
  category: SupportTicketCategory;
  title: string;
  contact: string;
  content: string;
}>({
  category: "bug",
  title: "",
  contact: accountUser.value?.email || "",
  content: ""
});

watch(
  () => accountUser.value?.email,
  (email) => {
    if (!form.contact && email) {
      form.contact = email;
    }
  },
  { immediate: true }
);

// Slice E2: the inline zh / ja table moved to locales (rework.account.support.*), same texts; placeholders pass through literally.
const SUPPORT_COPY_KEYS = ["introTitle", "introDesc", "formTitle", "historyTitle", "category", "title", "titlePlaceholder", "contact", "contactPlaceholder", "content", "contentPlaceholder", "submit", "needTitle", "needContent", "submitSuccess", "submitQueued", "submitFailed", "empty", "statusOpen", "statusClosed", "mailPending", "mailSent", "mailFailed", "submittedAt", "ticketId", "noContact", "unread", "expand", "collapse", "threadTitle", "staffLabel", "userLabel", "followUp", "followUpPlaceholder", "followUpSubmit", "followUpSuccess", "followUpQueued", "followUpFailed", "closedHint", "needFollowUp"] as const;
const copy = computed(() => (void locale.value, Object.fromEntries(
  SUPPORT_COPY_KEYS.map((key) => [key, t(`rework.account.support.${key}`, { id: "{id}" })])
) as Record<(typeof SUPPORT_COPY_KEYS)[number], string>));

const SUPPORT_CATEGORIES = ["account", "sync", "forum", "data", "bug", "feature", "other"] as const;
const categoryOptions = computed<Array<{ value: SupportTicketCategory; label: string }>>(() =>
  (void locale.value, SUPPORT_CATEGORIES.map((value) => ({ value, label: t(`rework.account.support.categories.${value}`) })))
);

const findCategoryLabel = (category: SupportTicketCategory) =>
  categoryOptions.value.find((item) => item.value === category)?.label || category;

const getStatusLabel = (status: SupportTicket["status"]) =>
  status === "closed" ? copy.value.statusClosed : copy.value.statusOpen;

const getStatusType = (status: SupportTicket["status"]) => (status === "closed" ? "success" : "warning");

const getMailStatusLabel = (status: SupportTicket["mailStatus"]) => {
  if (status === "sent") return copy.value.mailSent;
  if (status === "failed") return copy.value.mailFailed;
  return copy.value.mailPending;
};

const getMailStatusType = (status: SupportTicket["mailStatus"]) => {
  if (status === "sent") return "success";
  if (status === "failed") return "danger";
  return "info";
};

const formatTicketTime = (value: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale.value === "ja" ? "ja-JP" : "zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const submitting = ref(false);
// Slice E2 (presentation): the field the last validation stopped at (the toast stays) and the inputs to focus.
const formError = ref<{ field: "title" | "content"; message: string } | null>(null);
const titleInput = ref<HTMLInputElement | null>(null);
const contentInput = ref<HTMLTextAreaElement | null>(null);
const followUpErrorId = ref<number | null>(null);
const expandedTicketId = ref<number | null>(null);
const loadingDetailId = ref<number | null>(null);
const followUpSubmittingId = ref<number | null>(null);
const ticketDetails = ref<Record<number, SupportTicketDetail>>({});
const followUpDrafts = reactive<Record<number, string>>({});

const { data: ticketsData, refresh: refreshTickets, pending: loadingTickets, error: historyError } = useForumResource<SupportTicketListResponse>(
  "support-ticket-list", () => apiFetch("/api/support/tickets"), { enabled: () => Boolean(accountUser.value) }
);
const tickets = computed(() => ticketsData.value?.items || []);
const detailErrors = ref<Record<number, string>>({});
const actionScope = useAccountPageScope(() => {
  submitting.value = false; expandedTicketId.value = null; loadingDetailId.value = null; followUpSubmittingId.value = null;
  ticketDetails.value = {}; detailErrors.value = {};
  for (const key of Object.keys(followUpDrafts)) delete followUpDrafts[Number(key)];
  form.title = ""; form.content = ""; form.contact = accountUser.value?.email || "";
  formError.value = null; followUpErrorId.value = null;
});

const getMessageLabel = (message: SupportTicketMessage) =>
  message.authorRole === "staff" ? copy.value.staffLabel : copy.value.userLabel;

const loadTicketDetail = async (ticketId: number) => {
  if (loadingDetailId.value === ticketId) return;
  const ticket = actionScope.capture();
  if (!actionScope.current(ticket)) return;
  detailErrors.value[ticketId] = "";
  loadingDetailId.value = ticketId;
  try {
    const detail = await apiFetch<SupportTicketDetail>(`/api/support/tickets/${ticketId}`);
    if (!actionScope.current(ticket)) return;
    ticketDetails.value[ticketId] = detail;
    await refreshTickets();
  } catch (error: any) {
    if (!actionScope.current(ticket)) return;
    detailErrors.value[ticketId] = t("rework.account.support.detailFailed");
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.followUpFailed);
  } finally {
    if (actionScope.current(ticket) && loadingDetailId.value === ticketId) loadingDetailId.value = null;
  }
};

const toggleTicket = async (ticketId: number) => {
  if (expandedTicketId.value === ticketId) {
    expandedTicketId.value = null;
    return;
  }
  expandedTicketId.value = ticketId;
  if (!ticketDetails.value[ticketId]) {
    await loadTicketDetail(ticketId);
  } else {
    await loadTicketDetail(ticketId);
  }
};

const submitFollowUp = async (ticketId: number) => {
  if (followUpSubmittingId.value) return;
  const content = String(followUpDrafts[ticketId] || "").trim();
  if (!content) {
    ElMessage.warning(copy.value.needFollowUp);
    followUpErrorId.value = ticketId;
    return;
  }
  followUpErrorId.value = null;

  const ticket = actionScope.capture();
  if (!actionScope.current(ticket)) return;
  followUpSubmittingId.value = ticketId;
  try {
    const response = await apiFetch<{ ok: true; ticket: SupportTicketDetail; mailDelivered: boolean }>(
      `/api/support/tickets/${ticketId}/messages`,
      {
        method: "POST",
        body: { content }
      }
    );
    if (!actionScope.current(ticket)) return;
    ticketDetails.value[ticketId] = response.ticket;
    followUpDrafts[ticketId] = "";
    if (!actionScope.current(ticket)) return;
    if (response.mailDelivered) {
      ElMessage.success(copy.value.followUpSuccess);
    } else {
      ElMessage.warning(copy.value.followUpQueued);
    }
    await refreshTickets();
  } catch (error: any) {
    if (!actionScope.current(ticket)) return;
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.followUpFailed);
  } finally {
    if (actionScope.current(ticket)) followUpSubmittingId.value = null;
  }
};

const submit = async () => {
  if (submitting.value) return;
  if (!form.title.trim()) {
    ElMessage.warning(copy.value.needTitle);
    formError.value = { field: "title", message: copy.value.needTitle };
    titleInput.value?.focus();
    return;
  }
  if (!form.content.trim()) {
    ElMessage.warning(copy.value.needContent);
    formError.value = { field: "content", message: copy.value.needContent };
    contentInput.value?.focus();
    return;
  }
  formError.value = null;

  const ticket = actionScope.capture();
  if (!actionScope.current(ticket)) return;
  submitting.value = true;
  try {
    const response = await apiFetch<SupportTicketCreateResponse>("/api/support/tickets", {
      method: "POST",
      body: {
        category: form.category,
        title: form.title,
        contact: form.contact,
        content: form.content
      }
    });

    if (!actionScope.current(ticket)) return;
    if (response.mailDelivered) {
      ElMessage.success(copy.value.submitSuccess.replace("{id}", String(response.ticket.id)).replace("#{id}", `#${response.ticket.id}`));
    } else {
      ElMessage.warning(copy.value.submitQueued.replace("{id}", String(response.ticket.id)).replace("#{id}", `#${response.ticket.id}`));
    }

    form.title = "";
    form.content = "";
    await refreshTickets();
  } catch (error: any) {
    if (!actionScope.current(ticket)) return;
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.submitFailed);
  } finally {
    if (actionScope.current(ticket)) submitting.value = false;
  }
};
</script>

<template>
  <div class="support-page rw-stack">
    <ReworkPageHeader :title="copy.introTitle">
      <p class="rw-lead">{{ copy.introDesc }}</p>
    </ReworkPageHeader>

    <div class="support-grid">
      <ReworkPanel :title="copy.formTitle" class="support-form-panel">
        <form class="support-form" novalidate @submit.prevent>
          <div class="rw-field">
            <label class="rw-field__label" for="support-category">{{ copy.category }}</label>
            <select id="support-category" v-model="form.category" class="rw-select support-input">
              <option v-for="item in categoryOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </div>
          <div class="rw-field">
            <label class="rw-field__label" for="support-title">{{ copy.title }}</label>
            <input
              id="support-title"
              ref="titleInput"
              v-model="form.title"
              class="rw-input rw-input--block"
              maxlength="120"
              :placeholder="copy.titlePlaceholder"
              :aria-invalid="formError?.field === 'title' ? 'true' : undefined"
              :aria-describedby="formError?.field === 'title' ? 'support-title-error support-title-count' : 'support-title-count'"
              @input="formError?.field === 'title' && form.title.trim() && (formError = null)"
            />
            <p class="support-field-foot">
              <span v-if="formError?.field === 'title'" id="support-title-error" class="rw-field__error" role="alert">{{ formError.message }}</span>
              <span id="support-title-count" class="rw-count num">{{ form.title.length }} / 120</span>
            </p>
          </div>
          <div class="rw-field">
            <label class="rw-field__label" for="support-contact">{{ copy.contact }}</label>
            <input id="support-contact" v-model="form.contact" class="rw-input rw-input--block" maxlength="255" :placeholder="copy.contactPlaceholder" />
          </div>
          <div class="rw-field">
            <label class="rw-field__label" for="support-content">{{ copy.content }}</label>
            <textarea
              id="support-content"
              ref="contentInput"
              v-model="form.content"
              class="rw-input rw-textarea rw-input--block"
              rows="8"
              maxlength="8000"
              :placeholder="copy.contentPlaceholder"
              :aria-invalid="formError?.field === 'content' ? 'true' : undefined"
              :aria-describedby="formError?.field === 'content' ? 'support-content-error support-content-count' : 'support-content-count'"
              @input="formError?.field === 'content' && form.content.trim() && (formError = null)"
            />
            <p class="support-field-foot">
              <span v-if="formError?.field === 'content'" id="support-content-error" class="rw-field__error" role="alert">{{ formError.message }}</span>
              <span id="support-content-count" class="rw-count num">{{ form.content.length }} / 8000</span>
            </p>
          </div>
          <div class="support-actions">
            <button
              type="button"
              class="rw-btn rw-btn--primary"
              :class="{ 'is-busy': submitting }"
              :disabled="submitting"
              :aria-busy="submitting || undefined"
              data-support-submit
              @click="submit"
            >
              {{ copy.submit }}
            </button>
          </div>
        </form>
      </ReworkPanel>

      <ReworkSupportTickets
        :tickets="tickets"
        :loading="loadingTickets"
        :error="historyError"
        :expanded-id="expandedTicketId"
        :loading-detail-id="loadingDetailId"
        :details="ticketDetails"
        :detail-errors="detailErrors"
        :drafts="followUpDrafts"
        :follow-up-submitting-id="followUpSubmittingId"
        :follow-up-error-id="followUpErrorId"
        :format-time="formatTicketTime"
        @retry="refreshTickets"
        @toggle="toggleTicket"
        @retry-detail="loadTicketDetail"
        @follow-up="submitFollowUp"
        @update-draft="(id: number, value: string) => { followUpDrafts[id] = value; if (followUpErrorId === id && value.trim()) followUpErrorId = null; }"
      />
    </div>
  </div>
</template>

<style scoped>
.support-grid {
  display: grid;
  gap: 24px;
  align-items: start;
  min-width: 0;
}
.support-form {
  display: grid;
  gap: 16px;
  min-width: 0;
}
.support-input {
  width: 100%;
}
.support-field-foot {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 0;
}
.support-field-foot .rw-count {
  margin-left: auto;
}
@media (min-width: 1100px) {
  .support-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}
@media (max-width: 767px) {
  .support-actions .rw-btn {
    width: 100%;
  }
}
</style>
