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

const copy = computed(() =>
  locale.value === "ja"
    ? {
        forbiddenTitle: "サポート審査画面にアクセスできません",
        forbiddenSubtitle: "現在のアカウントは審査権限を持っていません",
        pendingTitle: "対応中チケット",
        pendingDesc: "`sigaer` のみこのページにアクセスできます。返信はユーザーの登録メールへ直接送信されます。",
        historyTitle: "完了済みチケット",
        historyDesc: "最近クローズしたチケットを表示します。",
        noPending: "対応中のチケットはありません",
        noHistory: "完了済みチケットはありません",
        unknownUser: "不明なユーザー",
        selectTicket: "左のチケットを選択してください",
        threadTitle: "やり取り",
        replyTitle: "返信",
        replyPlaceholder: "ユーザーへの返信内容を入力してください",
        replySubmit: "返信を送信",
        replyClose: "返信して完了",
        closeOnly: "完了にする",
        replySuccess: "返信を送信しました",
        replyQueued: "返信は保存されましたが、ユーザーメール送信に失敗しました",
        replyFailed: "返信送信に失敗しました",
        closeSuccess: "チケットを完了しました",
        closeFailed: "チケット完了処理に失敗しました",
        needReply: "返信内容を入力してください",
        staffLabel: "運営",
        userLabel: "ユーザー",
        unread: "未読",
        statusOpen: "受付中",
        statusClosed: "対応完了"
      }
    : {
        forbiddenTitle: "无权访问工单审批台",
        forbiddenSubtitle: "当前账号不是审批人",
        pendingTitle: "待处理工单",
        pendingDesc: "只有 `sigaer` 可访问此页面。回复会直接发到用户注册邮箱，并显示在工单线程中。",
        historyTitle: "已关闭工单",
        historyDesc: "这里展示最近关闭的工单记录。",
        noPending: "当前没有待处理工单",
        noHistory: "暂无已关闭工单",
        unknownUser: "未知用户",
        selectTicket: "请从左侧选择工单",
        threadTitle: "对话记录",
        replyTitle: "回复用户",
        replyPlaceholder: "输入要给用户的回复内容",
        replySubmit: "发送回复",
        replyClose: "回复并关闭",
        closeOnly: "关闭工单",
        replySuccess: "回复已发送",
        replyQueued: "回复已保存，但用户邮件发送失败",
        replyFailed: "发送回复失败",
        closeSuccess: "工单已关闭",
        closeFailed: "关闭工单失败",
        needReply: "请输入回复内容",
        staffLabel: "站务",
        userLabel: "用户",
        unread: "未读",
        statusOpen: "处理中",
        statusClosed: "已关闭"
      }
);

const categoryLabels = computed(() =>
  locale.value === "ja"
    ? {
        account: "アカウント",
        sync: "同期",
        forum: "フォーラム",
        data: "データ内容",
        bug: "不具合",
        feature: "機能要望",
        other: "その他"
      }
    : {
        account: "账号问题",
        sync: "同步问题",
        forum: "论坛社区",
        data: "数据内容",
        bug: "站点异常",
        feature: "功能建议",
        other: "其他"
      }
);

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
  <div class="support-review-page">
    <el-card v-if="pending" class="panel-card">
      <el-skeleton :rows="8" animated />
    </el-card>

    <template v-else-if="reviewState?.forbidden">
      <el-result icon="warning" :title="copy.forbiddenTitle" :sub-title="reviewState.message || copy.forbiddenSubtitle" />
    </template>

    <template v-else>
      <div class="review-layout">
        <div class="review-sidebar">
          <el-card class="panel-card">
            <div class="section-title">
              <h2>{{ copy.pendingTitle }}</h2>
              <p>{{ copy.pendingDesc }}</p>
            </div>
            <el-empty v-if="!reviewState?.pending.length" :description="copy.noPending" />
            <div v-else class="ticket-summary-list">
              <button
                v-for="ticket in reviewState.pending"
                :key="ticket.id"
                type="button"
                class="ticket-summary"
                :class="{ active: selectedTicketId === ticket.id }"
                @click="selectTicket(ticket.id)"
              >
                <div class="ticket-summary__head">
                  <strong>#{{ ticket.id }} · {{ ticket.title }}</strong>
                  <el-tag v-if="ticket.hasUnread" size="small" type="danger">{{ copy.unread }}</el-tag>
                </div>
                <p>{{ ticket.user.username || copy.unknownUser }} · {{ ticket.user.email }}</p>
                <p class="ticket-summary__meta">
                  {{ categoryLabels[ticket.category] || ticket.category }} · {{ formatDateTime(ticket.updatedAt) }}
                </p>
              </button>
            </div>
          </el-card>

          <el-card class="panel-card">
            <div class="section-title">
              <h3>{{ copy.historyTitle }}</h3>
              <p>{{ copy.historyDesc }}</p>
            </div>
            <el-empty v-if="!reviewState?.history.length" :description="copy.noHistory" />
            <div v-else class="ticket-summary-list compact">
              <button
                v-for="ticket in reviewState.history"
                :key="ticket.id"
                type="button"
                class="ticket-summary"
                :class="{ active: selectedTicketId === ticket.id }"
                @click="selectTicket(ticket.id)"
              >
                <div class="ticket-summary__head">
                  <strong>#{{ ticket.id }} · {{ ticket.title }}</strong>
                  <el-tag size="small" type="success">{{ copy.statusClosed }}</el-tag>
                </div>
                <p>{{ ticket.user.username || copy.unknownUser }}</p>
              </button>
            </div>
          </el-card>
        </div>

        <el-card class="panel-card review-main">
          <div v-if="!selectedTicketId || !ticketDetail" class="empty-panel">
            {{ copy.selectTicket }}
          </div>
          <template v-else>
            <div v-if="loadingDetail">
              <el-skeleton :rows="6" animated />
            </div>
            <template v-else>
              <div class="detail-head">
                <div>
                  <h2>#{{ ticketDetail.id }} · {{ ticketDetail.title }}</h2>
                  <p>
                    {{ ticketDetail.user?.username || copy.unknownUser }} · {{ ticketDetail.user?.email || "-" }}
                  </p>
                  <p>
                    {{ categoryLabels[ticketDetail.category] || ticketDetail.category }} ·
                    {{ ticketDetail.contact || "-" }}
                  </p>
                </div>
                <el-tag :type="ticketDetail.status === 'closed' ? 'success' : 'warning'">
                  {{ ticketDetail.status === "closed" ? copy.statusClosed : copy.statusOpen }}
                </el-tag>
              </div>

              <div class="thread-block">
                <h3>{{ copy.threadTitle }}</h3>
                <div class="thread-list">
                  <div
                    v-for="message in ticketDetail.messages"
                    :key="`${message.id}-${message.createdAt}`"
                    class="thread-item"
                    :class="message.authorRole === 'staff' ? 'thread-item--staff' : 'thread-item--user'"
                  >
                    <div class="thread-item__head">
                      <strong>{{ getMessageLabel(message) }}</strong>
                      <span>{{ formatDateTime(message.createdAt) }}</span>
                    </div>
                    <p>{{ message.content }}</p>
                  </div>
                </div>
              </div>

              <div v-if="ticketDetail.status === 'open'" class="reply-block">
                <h3>{{ copy.replyTitle }}</h3>
                <el-input
                  v-model="replyContent"
                  type="textarea"
                  :rows="6"
                  resize="vertical"
                  :maxlength="8000"
                  show-word-limit
                  :placeholder="copy.replyPlaceholder"
                />
                <div class="reply-actions">
                  <el-button type="primary" :loading="submitting" @click="submitReply(false)">
                    {{ copy.replySubmit }}
                  </el-button>
                  <el-button type="success" :loading="submitting" @click="submitReply(true)">
                    {{ copy.replyClose }}
                  </el-button>
                  <el-button plain :loading="submitting" @click="closeTicket">
                    {{ copy.closeOnly }}
                  </el-button>
                </div>
              </div>
            </template>
          </template>
        </el-card>
      </div>
    </template>
  </div>
</template>

<style scoped>
.support-review-page {
  display: grid;
  gap: 18px;
}

.review-layout {
  display: grid;
  grid-template-columns: minmax(280px, 0.9fr) minmax(0, 1.4fr);
  gap: 18px;
  align-items: start;
}

.review-sidebar {
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

.ticket-summary-list {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}

.ticket-summary-list.compact .ticket-summary p {
  margin-top: 4px;
}

.ticket-summary {
  width: 100%;
  text-align: left;
  padding: 12px 14px;
  border: 1px solid rgba(171, 141, 110, 0.18);
  border-radius: 14px;
  background:var(--viewer-surface-subtle);
  cursor: pointer;
}

.ticket-summary.active {
  border-color:rgba(196, 127, 79, 0.55);
  background:var(--viewer-surface-subtle);
}

.ticket-summary__head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
}

.ticket-summary p {
  margin: 6px 0 0;
  color:var(--viewer-text-muted);
  font-size: 13px;
}

.ticket-summary__meta {
  font-size: 12px;
}

.review-main {
  min-height: 520px;
}

.empty-panel {
  min-height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
  color:var(--viewer-text-muted);
}

.detail-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.detail-head h2 {
  margin: 0 0 8px;
}

.detail-head p {
  margin: 0 0 4px;
  color:var(--viewer-text-muted);
}

.thread-block,
.reply-block {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.thread-block h3,
.reply-block h3 {
  margin: 0;
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
}

.reply-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

@media (max-width: 960px) {
  .review-layout {
    grid-template-columns: 1fr;
  }
}
</style>
