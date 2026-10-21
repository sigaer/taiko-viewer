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

const copy = computed(() =>
  locale.value === "ja"
    ? {
        introTitle: "サポートチケット",
        introDesc: "問題報告や機能要望を送信すると、運営へ通知されます。返信は登録メールとこのページの両方で確認でき、ここから追加メッセージも送れます。",
        formTitle: "新しいチケットを送信",
        formDesc: "タイトルと内容を整理して送ると、確認と返信が速くなります。",
        historyTitle: "自分のチケット",
        historyDesc: "対応状況、スレッド履歴、未読返信を確認できます。",
        category: "分類",
        title: "タイトル",
        titlePlaceholder: "例：同期後にプロフィールが更新されない",
        contact: "連絡先",
        contactPlaceholder: "未入力時はアカウントのメールを使用",
        content: "内容",
        contentPlaceholder: "再現手順、発生時間、期待していた結果などをできるだけ具体的に記入してください。",
        submit: "チケット送信",
        needTitle: "チケットタイトルを入力してください",
        needContent: "チケット内容を入力してください",
        submitSuccess: "チケット #{id} を送信しました",
        submitQueued: "チケット #{id} は記録されましたが、メール送信に失敗しました",
        submitFailed: "チケット送信に失敗しました",
        empty: "まだチケットはありません",
        loading: "読み込み中...",
        statusOpen: "受付中",
        statusClosed: "対応完了",
        mailPending: "メール待機中",
        mailSent: "メール送信済み",
        mailFailed: "メール送信失敗",
        submittedAt: "送信日時",
        ticketId: "チケット番号",
        noContact: "未入力",
        unread: "未読返信",
        expand: "詳細を見る",
        collapse: "閉じる",
        threadTitle: "やり取り",
        staffLabel: "運営",
        userLabel: "自分",
        followUp: "追加メッセージ",
        followUpPlaceholder: "追加情報や質問を入力してください",
        followUpSubmit: "メッセージ送信",
        followUpSuccess: "メッセージを送信しました",
        followUpQueued: "メッセージは保存されましたが、運営通知メールの送信に失敗しました",
        followUpFailed: "メッセージ送信に失敗しました",
        closedHint: "このチケットは完了済みです。新しい問題は新規チケットを作成してください。",
        needFollowUp: "メッセージ内容を入力してください"
      }
    : {
        introTitle: "工单支持",
        introDesc: "提交问题反馈或功能建议后，站务会收到通知。回复会同步发到你的注册邮箱，你也可以在这里查看线程并继续沟通。",
        formTitle: "提交新工单",
        formDesc: "把标题、现象和复现步骤写清楚，后续定位会更快。",
        historyTitle: "我的工单",
        historyDesc: "这里会保留最近提交记录、对话线程和未读回复。",
        category: "工单分类",
        title: "工单标题",
        titlePlaceholder: "例如：同步完成后个人资料没有刷新",
        contact: "联系方式",
        contactPlaceholder: "留空则默认使用账号邮箱",
        content: "工单内容",
        contentPlaceholder: "请尽量写明复现步骤、出现时间、当前现象和预期结果。",
        submit: "提交工单",
        needTitle: "请输入工单标题",
        needContent: "请输入工单内容",
        submitSuccess: "工单 #{id} 已提交",
        submitQueued: "工单 #{id} 已记录，但邮件投递失败",
        submitFailed: "提交工单失败",
        empty: "你还没有提交过工单",
        loading: "加载中...",
        statusOpen: "处理中",
        statusClosed: "已关闭",
        mailPending: "待投递",
        mailSent: "已投递",
        mailFailed: "投递失败",
        submittedAt: "提交时间",
        ticketId: "工单编号",
        noContact: "未填写",
        unread: "未读回复",
        expand: "查看详情",
        collapse: "收起",
        threadTitle: "对话记录",
        staffLabel: "站务",
        userLabel: "我",
        followUp: "追加留言",
        followUpPlaceholder: "补充信息或继续提问",
        followUpSubmit: "发送留言",
        followUpSuccess: "留言已发送",
        followUpQueued: "留言已保存，但站务通知邮件发送失败",
        followUpFailed: "发送留言失败",
        closedHint: "此工单已关闭，如有新问题请提交新工单。",
        needFollowUp: "请输入留言内容"
      }
);

const categoryOptions = computed<Array<{ value: SupportTicketCategory; label: string }>>(() => {
  if (locale.value === "ja") {
    return [
      { value: "account", label: "アカウント" },
      { value: "sync", label: "同期" },
      { value: "forum", label: "フォーラム" },
      { value: "data", label: "データ内容" },
      { value: "bug", label: "不具合" },
      { value: "feature", label: "機能要望" },
      { value: "other", label: "その他" }
    ];
  }
  return [
    { value: "account", label: "账号问题" },
    { value: "sync", label: "同步问题" },
    { value: "forum", label: "论坛社区" },
    { value: "data", label: "数据内容" },
    { value: "bug", label: "站点异常" },
    { value: "feature", label: "功能建议" },
    { value: "other", label: "其他" }
  ];
});

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
const expandedTicketId = ref<number | null>(null);
const loadingDetailId = ref<number | null>(null);
const followUpSubmittingId = ref<number | null>(null);
const ticketDetails = ref<Record<number, SupportTicketDetail>>({});
const followUpDrafts = reactive<Record<number, string>>({});

const { data: ticketsData, refresh: refreshTickets, status: ticketsStatus } = await useAsyncData<SupportTicketListResponse>(
  "support-ticket-list",
  () => apiFetch("/api/support/tickets"),
  {
    default: () => ({ items: [] })
  }
);

const tickets = computed(() => ticketsData.value?.items || []);
const loadingTickets = computed(() => ticketsStatus.value === "pending");

const getMessageLabel = (message: SupportTicketMessage) =>
  message.authorRole === "staff" ? copy.value.staffLabel : copy.value.userLabel;

const loadTicketDetail = async (ticketId: number) => {
  loadingDetailId.value = ticketId;
  try {
    const detail = await apiFetch<SupportTicketDetail>(`/api/support/tickets/${ticketId}`);
    ticketDetails.value[ticketId] = detail;
    await refreshTickets();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.followUpFailed);
  } finally {
    loadingDetailId.value = null;
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
    return;
  }

  followUpSubmittingId.value = ticketId;
  try {
    const response = await apiFetch<{ ok: true; ticket: SupportTicketDetail; mailDelivered: boolean }>(
      `/api/support/tickets/${ticketId}/messages`,
      {
        method: "POST",
        body: { content }
      }
    );
    ticketDetails.value[ticketId] = response.ticket;
    followUpDrafts[ticketId] = "";
    if (response.mailDelivered) {
      ElMessage.success(copy.value.followUpSuccess);
    } else {
      ElMessage.warning(copy.value.followUpQueued);
    }
    await refreshTickets();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.followUpFailed);
  } finally {
    followUpSubmittingId.value = null;
  }
};

const submit = async () => {
  if (submitting.value) return;
  if (!form.title.trim()) {
    ElMessage.warning(copy.value.needTitle);
    return;
  }
  if (!form.content.trim()) {
    ElMessage.warning(copy.value.needContent);
    return;
  }

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

    if (response.mailDelivered) {
      ElMessage.success(copy.value.submitSuccess.replace("{id}", String(response.ticket.id)).replace("#{id}", `#${response.ticket.id}`));
    } else {
      ElMessage.warning(copy.value.submitQueued.replace("{id}", String(response.ticket.id)).replace("#{id}", `#${response.ticket.id}`));
    }

    form.title = "";
    form.content = "";
    await refreshTickets();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.submitFailed);
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div class="page-stack">
    <el-card class="hero-card">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">
            <span class="section-icon warm" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5z M5 8l7 5 7-5"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            {{ copy.introTitle }}
          </h2>
          <p>{{ copy.introDesc }}</p>
        </div>
      </div>
    </el-card>

    <div class="support-grid">
      <el-card class="panel-card">
        <div class="panel-header">
          <div>
            <h3 class="panel-title">
              <span class="section-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 5v14 M5 12h14"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>
              </span>
              {{ copy.formTitle }}
            </h3>
            <p>{{ copy.formDesc }}</p>
          </div>
        </div>

        <el-form label-position="top" class="support-form">
          <el-form-item :label="copy.category">
            <el-select v-model="form.category" class="full-width">
              <el-option v-for="item in categoryOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>

          <el-form-item :label="copy.title">
            <el-input v-model="form.title" :placeholder="copy.titlePlaceholder" maxlength="120" show-word-limit />
          </el-form-item>

          <el-form-item :label="copy.contact">
            <el-input v-model="form.contact" :placeholder="copy.contactPlaceholder" maxlength="255" />
          </el-form-item>

          <el-form-item :label="copy.content">
            <el-input
              v-model="form.content"
              type="textarea"
              :rows="8"
              resize="vertical"
              :maxlength="8000"
              show-word-limit
              :placeholder="copy.contentPlaceholder"
            />
          </el-form-item>

          <div class="form-actions">
            <el-button type="primary" :loading="submitting" @click="submit">
              {{ copy.submit }}
            </el-button>
          </div>
        </el-form>
      </el-card>

      <el-card class="panel-card">
        <div class="panel-header">
          <div>
            <h3 class="panel-title">
              <span class="section-icon alt" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 7h12M6 12h12M6 17h8"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>
              </span>
              {{ copy.historyTitle }}
            </h3>
            <p>{{ copy.historyDesc }}</p>
          </div>
        </div>

        <div v-if="!tickets.length" class="empty-state">
          {{ loadingTickets ? copy.loading : copy.empty }}
        </div>

        <div v-else class="ticket-list">
          <article v-for="ticket in tickets" :key="ticket.id" class="ticket-card">
            <div class="ticket-card__top">
              <div class="ticket-card__title-wrap">
                <div class="ticket-card__meta">
                  <span class="ticket-id">{{ copy.ticketId }} #{{ ticket.id }}</span>
                  <span>{{ findCategoryLabel(ticket.category) }}</span>
                  <el-tag v-if="ticket.hasUnread" size="small" type="danger">{{ copy.unread }}</el-tag>
                </div>
                <h4>{{ ticket.title }}</h4>
              </div>
              <div class="ticket-tags">
                <el-tag size="small" :type="getStatusType(ticket.status)">{{ getStatusLabel(ticket.status) }}</el-tag>
                <el-tag size="small" :type="getMailStatusType(ticket.mailStatus)">{{ getMailStatusLabel(ticket.mailStatus) }}</el-tag>
              </div>
            </div>

            <p class="ticket-content">{{ ticket.content }}</p>

            <div class="ticket-card__footer">
              <span>{{ copy.submittedAt }}：{{ formatTicketTime(ticket.createdAt) }}</span>
              <span>{{ copy.contact }}：{{ ticket.contact || copy.noContact }}</span>
              <el-button
                link
                type="primary"
                :loading="loadingDetailId === ticket.id"
                @click="toggleTicket(ticket.id)"
              >
                {{ expandedTicketId === ticket.id ? copy.collapse : copy.expand }}
              </el-button>
            </div>

            <div v-if="expandedTicketId === ticket.id" class="ticket-thread">
              <h5>{{ copy.threadTitle }}</h5>
              <div v-if="loadingDetailId === ticket.id && !ticketDetails[ticket.id]" class="thread-loading">
                {{ copy.loading }}
              </div>
              <div v-else class="thread-list">
                <div
                  v-for="message in ticketDetails[ticket.id]?.messages || []"
                  :key="`${message.id}-${message.createdAt}`"
                  class="thread-item"
                  :class="message.authorRole === 'staff' ? 'thread-item--staff' : 'thread-item--user'"
                >
                  <div class="thread-item__head">
                    <strong>{{ getMessageLabel(message) }}</strong>
                    <span>{{ formatTicketTime(message.createdAt) }}</span>
                  </div>
                  <p>{{ message.content }}</p>
                </div>
              </div>

              <div v-if="ticket.status === 'open'" class="follow-up-box">
                <el-input
                  v-model="followUpDrafts[ticket.id]"
                  type="textarea"
                  :rows="4"
                  resize="vertical"
                  :maxlength="8000"
                  show-word-limit
                  :placeholder="copy.followUpPlaceholder"
                />
                <div class="form-actions">
                  <el-button
                    type="primary"
                    :loading="followUpSubmittingId === ticket.id"
                    @click="submitFollowUp(ticket.id)"
                  >
                    {{ copy.followUpSubmit }}
                  </el-button>
                </div>
              </div>
              <p v-else class="closed-hint">{{ copy.closedHint }}</p>
            </div>
          </article>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.page-stack {
  display: grid;
  gap: 20px;
}

.support-grid {
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
}

.panel-header h2,
.panel-header h3 {
  margin: 0 0 6px;
}

.panel-header p {
  margin: 0;
  color:var(--viewer-text-muted);
}

.panel-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.section-icon {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color:var(--viewer-link);
  background:var(--viewer-surface-subtle);
  border-radius: 6px;
}

.section-icon svg {
  width: 14px;
  height: 14px;
}

.section-icon.alt {
  background:var(--viewer-surface-subtle);
  color:var(--viewer-link);
}

.section-icon.warm {
  background:var(--viewer-surface-subtle);
  color:var(--viewer-warning);
}

.hero-card {
  background:var(--viewer-surface-subtle);
}

.support-form {
  margin-top: 10px;
}

.full-width {
  width: 100%;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

.ticket-list {
  display: grid;
  gap: 14px;
  margin-top: 10px;
}

.ticket-card {
  padding: 16px;
  border-radius: 18px;
  background:var(--viewer-surface-subtle);
  box-shadow:0 10px 24px var(--viewer-shadow);
  display: grid;
  gap: 12px;
}

.ticket-card__top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.ticket-card__title-wrap {
  min-width: 0;
}

.ticket-card__title-wrap h4 {
  margin: 6px 0 0;
  font-size: 16px;
  line-height: 1.45;
}

.ticket-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
  color:var(--viewer-text-muted);
}

.ticket-id {
  font-weight: 600;
  color:var(--viewer-warning);
}

.ticket-tags {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ticket-content {
  margin: 0;
  color:var(--viewer-text);
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.ticket-card__footer {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  font-size: 12px;
  color:var(--viewer-text-muted);
}

.empty-state {
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  border: 1px dashed var(--viewer-border);
  color:var(--viewer-text-muted);
  background:var(--viewer-surface-subtle);
}

.ticket-thread {
  padding-top: 8px;
  border-top: 1px solid var(--viewer-border);
  display: grid;
  gap: 12px;
}

.ticket-thread h5 {
  margin: 0;
  font-size: 14px;
  color:var(--viewer-text-muted);
}

.thread-loading {
  color:var(--viewer-text-muted);
  font-size: 13px;
}

.thread-list {
  display: grid;
  gap: 10px;
}

.thread-item {
  padding: 12px 14px;
  border-radius: 14px;
  background:var(--viewer-surface-subtle);
}

.thread-item--staff {
  background:var(--viewer-surface-subtle);
}

.thread-item--user {
  background:var(--viewer-surface-subtle);
}

.thread-item__head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color:var(--viewer-text-muted);
  margin-bottom: 8px;
}

.thread-item p {
  margin: 0;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.follow-up-box {
  display: grid;
  gap: 12px;
}

.closed-hint {
  margin: 0;
  font-size: 13px;
  color:var(--viewer-text-muted);
}

@media (max-width: 960px) {
  .support-grid {
    grid-template-columns: 1fr;
  }

  .ticket-card__top {
    flex-direction: column;
  }
}
</style>
