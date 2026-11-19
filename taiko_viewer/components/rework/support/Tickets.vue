<script setup lang="ts">
// ReworkSupportTickets — "我的工单" of /support: every ticket the API lists (number, category, unread replies,
// title, status, mail delivery, text, time, contact), and per ticket the conversation, opened in place. Open tickets
// take a follow-up message; closed ones say so. Everything is the page's state; this only presents it and reports
// the user's intent (toggle, retry, follow-up, draft text).
import type { PropType } from "vue";
import type { SupportTicket, SupportTicketDetail, SupportTicketMessage } from "~/types/support";

const props = defineProps({
  tickets: { type: Array as PropType<SupportTicket[]>, required: true },
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
  expandedId: { type: Number as PropType<number | null>, default: null },
  loadingDetailId: { type: Number as PropType<number | null>, default: null },
  details: { type: Object as PropType<Record<number, SupportTicketDetail>>, required: true },
  detailErrors: { type: Object as PropType<Record<number, string>>, required: true },
  drafts: { type: Object as PropType<Record<number, string>>, required: true },
  followUpSubmittingId: { type: Number as PropType<number | null>, default: null },
  followUpErrorId: { type: Number as PropType<number | null>, default: null },
  formatTime: { type: Function as PropType<(value: string) => string>, required: true }
});
const emit = defineEmits<{
  retry: [];
  toggle: [id: number];
  retryDetail: [id: number];
  followUp: [id: number];
  updateDraft: [id: number, value: string];
}>();
const { t } = useI18n();
const k = (key: string) => t(`rework.account.support.${key}`);
const mailTone = (status: SupportTicket["mailStatus"]) => (status === "sent" ? "rw-tag--ok" : status === "failed" ? "rs-tag--danger" : "");
const mailLabel = (status: SupportTicket["mailStatus"]) => (status === "sent" ? k("mailSent") : status === "failed" ? k("mailFailed") : k("mailPending"));
const author = (message: SupportTicketMessage) => (message.authorRole === "staff" ? k("staffLabel") : k("userLabel"));
const messages = (id: number) => props.details[id]?.messages || [];
</script>

<template>
  <section class="rst" aria-labelledby="support-history-title">
    <h2 id="support-history-title" class="rst__title">{{ k("historyTitle") }}</h2>
    <ReworkState v-if="error" kind="failed" compact class="entry-read-error" :text="error" @retry="emit('retry')" />
    <ReworkState v-else-if="!tickets.length && loading" kind="loading" compact :lines="3" />
    <p v-else-if="!tickets.length" class="rst__empty">{{ k("empty") }}</p>
    <ul v-else class="rst__list ticket-list">
      <li v-for="ticket in tickets" :key="ticket.id">
        <article class="rst__ticket ticket-card" :aria-labelledby="`support-ticket-${ticket.id}`" :data-ticket-id="ticket.id">
          <p class="rst__meta">
            <span class="num">{{ k("ticketId") }} #{{ ticket.id }}</span>
            <span>{{ t(`rework.account.support.categories.${ticket.category}`) }}</span>
            <span v-if="ticket.hasUnread" class="rw-tag rs-tag--danger">{{ k("unread") }}</span>
          </p>
          <h3 :id="`support-ticket-${ticket.id}`" class="rst__ticket-title">{{ ticket.title }}</h3>
          <p class="rst__tags">
            <span class="rw-tag" :class="ticket.status === 'closed' ? 'rw-tag--ok' : 'rw-tag--warn'">{{ ticket.status === "closed" ? k("statusClosed") : k("statusOpen") }}</span>
            <span class="rw-tag" :class="mailTone(ticket.mailStatus)">{{ mailLabel(ticket.mailStatus) }}</span>
          </p>
          <p class="rst__content ticket-content">{{ ticket.content }}</p>
          <div class="rst__foot">
            <span>{{ k("submittedAt") }} {{ formatTime(ticket.createdAt) }}</span>
            <span class="rst__contact">{{ k("contact") }} {{ ticket.contact || k("noContact") }}</span>
            <button
              type="button"
              class="rw-btn rw-btn--ghost rw-btn--sm rst__toggle"
              :class="{ 'is-busy': loadingDetailId === ticket.id }"
              :disabled="loadingDetailId === ticket.id"
              :aria-expanded="expandedId === ticket.id"
              :aria-controls="`support-thread-${ticket.id}`"
              data-ticket-toggle
              @click="emit('toggle', ticket.id)"
            >
              {{ expandedId === ticket.id ? k("collapse") : k("expand") }}
              <ReworkIcon name="chevron" class="rst__chevron" :class="{ 'is-open': expandedId === ticket.id }" />
            </button>
          </div>

          <div v-if="expandedId === ticket.id" :id="`support-thread-${ticket.id}`" class="rst__thread ticket-thread">
            <h4 class="rst__thread-title">{{ k("threadTitle") }}</h4>
            <ReworkState v-if="loadingDetailId === ticket.id && !details[ticket.id]" kind="loading" compact :lines="2" />
            <ReworkState v-else-if="detailErrors[ticket.id]" kind="failed" compact :title="detailErrors[ticket.id]" @retry="emit('retryDetail', ticket.id)" />
            <ol v-else class="rst__messages thread-list">
              <li
                v-for="message in messages(ticket.id)"
                :key="`${message.id}-${message.createdAt}`"
                class="rst__message thread-item"
                :class="message.authorRole === 'staff' ? 'thread-item--staff' : 'thread-item--user'"
              >
                <p class="rst__message-head">
                  <strong>{{ author(message) }}</strong>
                  <span>{{ formatTime(message.createdAt) }}</span>
                </p>
                <p class="rst__message-text">{{ message.content }}</p>
              </li>
            </ol>

            <form v-if="ticket.status === 'open'" class="rst__reply follow-up-box" novalidate @submit.prevent>
              <label class="rw-field__label" :for="`support-follow-${ticket.id}`">{{ k("followUp") }}</label>
              <textarea
                :id="`support-follow-${ticket.id}`"
                class="rw-input rw-textarea rw-input--block"
                rows="4"
                maxlength="8000"
                :value="drafts[ticket.id] || ''"
                :placeholder="k('followUpPlaceholder')"
                :aria-invalid="followUpErrorId === ticket.id ? 'true' : undefined"
                :aria-describedby="followUpErrorId === ticket.id ? `support-follow-${ticket.id}-error support-follow-${ticket.id}-count` : `support-follow-${ticket.id}-count`"
                @input="emit('updateDraft', ticket.id, ($event.target as HTMLTextAreaElement).value)"
              />
              <p class="rst__reply-foot">
                <span v-if="followUpErrorId === ticket.id" :id="`support-follow-${ticket.id}-error`" class="rw-field__error" role="alert">{{ k("needFollowUp") }}</span>
                <span :id="`support-follow-${ticket.id}-count`" class="rw-count num">{{ (drafts[ticket.id] || "").length }} / 8000</span>
              </p>
              <div class="rst__reply-actions">
                <button
                  type="button"
                  class="rw-btn rw-btn--primary"
                  :class="{ 'is-busy': followUpSubmittingId === ticket.id }"
                  :disabled="followUpSubmittingId === ticket.id"
                  :aria-busy="followUpSubmittingId === ticket.id || undefined"
                  data-follow-up
                  @click="emit('followUp', ticket.id)"
                >
                  {{ k("followUpSubmit") }}
                </button>
              </div>
            </form>
            <p v-else class="rst__closed closed-hint">{{ k("closedHint") }}</p>
          </div>
        </article>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.rst {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  min-width: 0;
  color: var(--ink);
  font-family: var(--font-ui);
}
.rst__title {
  margin: 0;
  font-size: var(--fs-18);
  font-weight: 700;
  line-height: var(--lh-snug);
  min-height: var(--hit);
  display: flex;
  align-items: center;
}
.rst__empty {
  margin: 0;
  padding: var(--sp-6) var(--sp-4);
  border: 1px dashed var(--line-strong);
  border-radius: var(--r-panel);
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.rst__list {
  display: grid;
  gap: var(--sp-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.rst__ticket {
  display: grid;
  gap: var(--sp-2);
  min-width: 0;
  padding: var(--sp-4);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
.rst__meta,
.rst__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-1) var(--sp-3);
  margin: 0;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.rst__tags {
  gap: var(--sp-2);
}
.rst__ticket-title {
  margin: 0;
  font-size: var(--fs-16);
  font-weight: 700;
  line-height: var(--lh-snug);
  overflow-wrap: anywhere;
}
.rst__content {
  margin: 0;
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.rst__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-1) var(--sp-4);
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.rst__contact {
  min-width: 0;
  overflow-wrap: anywhere;
}
.rst__toggle {
  margin-left: auto;
}
.rst__chevron {
  width: 16px;
  height: 16px;
}
.rst__chevron.is-open {
  transform: rotate(180deg);
}
.rst__thread {
  display: grid;
  gap: var(--sp-3);
  padding-top: var(--sp-3);
  border-top: 1px solid var(--line);
  min-width: 0;
}
.rst__thread-title {
  margin: 0;
  font-size: var(--fs-14);
  font-weight: 700;
  color: var(--ink-2);
}
.rst__messages {
  display: grid;
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.rst__message {
  min-width: 0;
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
}
.rst__message.thread-item--staff {
  border-left: 3px solid var(--info-line);
}
.rst__message-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--sp-1) var(--sp-3);
  margin: 0 0 var(--sp-1);
  font-size: var(--fs-12);
  color: var(--ink-2);
}
.rst__message-text {
  margin: 0;
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.rst__reply {
  display: grid;
  gap: var(--sp-2);
  min-width: 0;
}
.rst__reply-foot {
  display: flex;
  justify-content: space-between;
  gap: var(--sp-3);
  margin: 0;
}
.rst__reply-foot .rw-count {
  margin-left: auto;
}
.rst__reply-actions {
  display: flex;
  justify-content: flex-end;
}
.rst__closed {
  margin: 0;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.rs-tag--danger {
  background: var(--danger-wash);
  color: var(--ink);
}
@media (max-width: 767px) {
  .rst__reply-actions .rw-btn {
    flex: 1;
  }
}
</style>
