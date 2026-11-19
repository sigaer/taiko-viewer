<script setup lang="ts">
// ReworkSupportReview — /account/support/review for staff: the open and the recently closed tickets (≥ 1100 px a side
// column, below it a list above the conversation), and the selected ticket: who, category, contact, state, the
// conversation, and for open tickets the reply with its three actions (reply, reply and close, close). The page owns
// selection, loading and every request; while one runs all three actions are disabled, as before.
import type { PropType } from "vue";
import type { SupportReviewDashboard, SupportTicketDetail, SupportTicketMessage } from "~/types/support";

const props = defineProps({
  state: { type: Object as PropType<SupportReviewDashboard | null>, default: null },
  selectedId: { type: Number as PropType<number | null>, default: null },
  detail: { type: Object as PropType<SupportTicketDetail | null>, default: null },
  loadingDetail: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  reply: { type: String, required: true },
  formatTime: { type: Function as PropType<(value: string) => string>, required: true },
  categoryLabel: { type: Function as PropType<(category: string) => string>, required: true }
});
const emit = defineEmits<{ select: [id: number]; reply: []; replyClose: []; close: []; "update:reply": [value: string] }>();
const { t } = useI18n();
const k = (key: string) => t(`rework.account.supportReview.${key}`);
const author = (message: SupportTicketMessage) => (message.authorRole === "staff" ? k("staffLabel") : k("userLabel"));
const heading = ref<HTMLElement | null>(null);
let chosenByUser = false;
function choose(id: number) {
  chosenByUser = true;
  emit("select", id);
}
// After the user picks a ticket, take them to it (below 1100 px the conversation is under the lists).
watch(
  () => [props.detail?.id, props.loadingDetail] as const,
  async ([id, loading]) => {
    if (!id || loading || !chosenByUser) return;
    chosenByUser = false;
    await nextTick();
    const narrow = window.matchMedia("(max-width: 1099px)").matches;
    heading.value?.focus({ preventScroll: !narrow });
    if (narrow) heading.value?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
);
</script>

<template>
  <div class="rsr review-layout">
    <div class="rsr__side review-sidebar">
      <section class="rsr__group" aria-labelledby="support-review-pending">
        <h2 id="support-review-pending" class="rsr__title">{{ k("pendingTitle") }} <span class="rw-count num">{{ state?.pending.length || 0 }}</span></h2>
        <p v-if="!state?.pending.length" class="rsr__empty">{{ k("noPending") }}</p>
        <ul v-else class="rsr__list ticket-summary-list">
          <li v-for="ticket in state.pending" :key="ticket.id">
            <button
              type="button"
              class="rsr__item ticket-summary"
              :class="{ active: selectedId === ticket.id }"
              :aria-current="selectedId === ticket.id ? 'true' : undefined"
              :data-review-ticket="ticket.id"
              @click="choose(ticket.id)"
            >
              <span class="rsr__item-head">
                <strong class="rsr__item-title"><span class="num">#{{ ticket.id }}</span> · {{ ticket.title }}</strong>
                <span v-if="ticket.hasUnread" class="rw-tag rs-tag--danger">{{ k("unread") }}</span>
              </span>
              <span class="rsr__item-line">{{ ticket.user.username || k("unknownUser") }} · {{ ticket.user.email }}</span>
              <span class="rsr__item-line">{{ categoryLabel(ticket.category) }} · {{ formatTime(ticket.updatedAt) }}</span>
            </button>
          </li>
        </ul>
      </section>
      <section class="rsr__group" aria-labelledby="support-review-closed">
        <h2 id="support-review-closed" class="rsr__title">{{ k("historyTitle") }}</h2>
        <p v-if="!state?.history.length" class="rsr__empty">{{ k("noHistory") }}</p>
        <ul v-else class="rsr__list ticket-summary-list compact">
          <li v-for="ticket in state.history" :key="ticket.id">
            <button
              type="button"
              class="rsr__item ticket-summary"
              :class="{ active: selectedId === ticket.id }"
              :aria-current="selectedId === ticket.id ? 'true' : undefined"
              :data-review-ticket="ticket.id"
              @click="choose(ticket.id)"
            >
              <span class="rsr__item-head">
                <strong class="rsr__item-title"><span class="num">#{{ ticket.id }}</span> · {{ ticket.title }}</strong>
                <span class="rw-tag rw-tag--ok">{{ k("statusClosed") }}</span>
              </span>
              <span class="rsr__item-line">{{ ticket.user.username || k("unknownUser") }}</span>
            </button>
          </li>
        </ul>
      </section>
    </div>

    <section class="rsr__main review-main" :aria-label="k('threadTitle')">
      <p v-if="!selectedId || !detail" class="rsr__placeholder empty-panel">{{ k("selectAny") }}</p>
      <ReworkState v-else-if="loadingDetail" kind="loading" :lines="6" />
      <template v-else>
        <header class="rsr__detail-head detail-head">
          <h2 ref="heading" class="rsr__detail-title" tabindex="-1"><span class="num">#{{ detail.id }}</span> · {{ detail.title }}</h2>
          <span class="rw-tag" :class="detail.status === 'closed' ? 'rw-tag--ok' : 'rw-tag--warn'">{{ detail.status === "closed" ? k("statusClosed") : k("statusOpen") }}</span>
        </header>
        <p class="rsr__detail-line">{{ detail.user?.username || k("unknownUser") }} · {{ detail.user?.email || "—" }}</p>
        <p class="rsr__detail-line">{{ categoryLabel(detail.category) }} · {{ detail.contact || "—" }}</p>

        <h3 class="rsr__sub">{{ k("threadTitle") }}</h3>
        <ol class="rsr__messages thread-list">
          <li
            v-for="message in detail.messages"
            :key="`${message.id}-${message.createdAt}`"
            class="rsr__message thread-item"
            :class="message.authorRole === 'staff' ? 'thread-item--staff' : 'thread-item--user'"
          >
            <p class="rsr__message-head">
              <strong>{{ author(message) }}</strong>
              <span>{{ formatTime(message.createdAt) }}</span>
            </p>
            <p class="rsr__message-text">{{ message.content }}</p>
          </li>
        </ol>

        <form v-if="detail.status === 'open'" class="rsr__reply reply-block" novalidate @submit.prevent>
          <label class="rsr__sub" for="support-review-reply">{{ k("replyTitle") }}</label>
          <textarea
            id="support-review-reply"
            class="rw-input rw-textarea rw-input--block"
            rows="6"
            maxlength="8000"
            :value="reply"
            :placeholder="k('replyPlaceholder')"
            aria-describedby="support-review-reply-count"
            @input="emit('update:reply', ($event.target as HTMLTextAreaElement).value)"
          />
          <span id="support-review-reply-count" class="rw-count num rsr__count">{{ reply.length }} / 8000</span>
          <div class="rsr__actions reply-actions" :aria-busy="submitting || undefined">
            <button type="button" class="rw-btn rw-btn--primary" :class="{ 'is-busy': submitting }" :disabled="submitting" data-review-reply @click="emit('reply')">{{ k("replySubmit") }}</button>
            <button type="button" class="rw-btn" :class="{ 'is-busy': submitting }" :disabled="submitting" data-review-reply-close @click="emit('replyClose')">{{ k("replyClose") }}</button>
            <button type="button" class="rw-btn rw-btn--ghost" :class="{ 'is-busy': submitting }" :disabled="submitting" data-review-close @click="emit('close')">{{ k("closeOnly") }}</button>
          </div>
        </form>
      </template>
    </section>
  </div>
</template>

<style scoped>
.rsr {
  display: grid;
  gap: var(--sp-6);
  align-items: start;
  min-width: 0;
  color: var(--ink);
  font-family: var(--font-ui);
}
.rsr__side {
  display: grid;
  gap: var(--sp-5);
  min-width: 0;
}
.rsr__group {
  display: grid;
  gap: var(--sp-2);
  min-width: 0;
}
.rsr__title {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  margin: 0;
  font-size: var(--fs-16);
  font-weight: 700;
}
.rsr__empty,
.rsr__placeholder {
  margin: 0;
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.rsr__placeholder {
  padding: var(--sp-8) var(--sp-4);
  text-align: center;
}
.rsr__list {
  display: grid;
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.rsr__item {
  display: grid;
  gap: 2px;
  width: 100%;
  min-height: var(--hit);
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.rsr__item:hover {
  background: var(--bg-sunk);
}
.rsr__item.active {
  border-color: var(--seg-on-ring);
  box-shadow: inset 3px 0 0 var(--seg-on-ring);
}
.rsr__item:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.rsr__item-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-2);
}
.rsr__item-title {
  min-width: 0;
  font-size: var(--fs-14);
  overflow-wrap: anywhere;
}
.rsr__item-line {
  font-size: var(--fs-13);
  color: var(--ink-2);
  overflow-wrap: anywhere;
}
.rsr__main {
  display: grid;
  gap: var(--sp-3);
  min-width: 0;
  padding: var(--sp-5);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
.rsr__detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-3);
}
.rsr__detail-title {
  margin: 0;
  font-size: var(--fs-18);
  font-weight: 700;
  line-height: var(--lh-snug);
  overflow-wrap: anywhere;
  scroll-margin-top: calc(var(--bar-h) + var(--sp-4));
}
.rsr__detail-title:focus {
  outline: none;
}
.rsr__detail-title:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 3px;
}
.rsr__detail-line {
  margin: 0;
  font-size: var(--fs-14);
  color: var(--ink-2);
  overflow-wrap: anywhere;
}
.rsr__sub {
  margin: var(--sp-2) 0 0;
  font-size: var(--fs-14);
  font-weight: 700;
}
.rsr__messages {
  display: grid;
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.rsr__message {
  min-width: 0;
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
}
.rsr__message.thread-item--staff {
  border-left: 3px solid var(--info-line);
}
.rsr__message-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--sp-1) var(--sp-3);
  margin: 0 0 var(--sp-1);
  font-size: var(--fs-12);
  color: var(--ink-2);
}
.rsr__message-text {
  margin: 0;
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.rsr__reply {
  display: grid;
  gap: var(--sp-2);
  min-width: 0;
}
.rsr__count {
  justify-self: end;
}
.rsr__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
.rs-tag--danger {
  background: var(--danger-wash);
  color: var(--ink);
}
@media (min-width: 1100px) {
  .rsr {
    grid-template-columns: minmax(280px, 0.8fr) minmax(0, 1.4fr);
  }
  .rsr__side {
    position: sticky;
    top: calc(var(--bar-h) + var(--sp-4));
    max-height: calc(100dvh - var(--bar-h) - var(--sp-8));
    overflow-y: auto;
  }
}
@media (max-width: 767px) {
  .rsr__main {
    padding: var(--sp-4);
  }
  .rsr__actions .rw-btn {
    flex: 1 1 100%;
  }
}
</style>
