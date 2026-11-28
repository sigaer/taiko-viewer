<script setup lang="ts">
// ReworkCommunityNotificationItem — one notification: unread mark, the actor's avatar (the API's actor; a type icon for
// system notifications without one), type, time, title, body, and whether it opens a thread. The whole row is the
// control, as before (link role when it has a thread, button otherwise; Enter, and Space for buttons); the page marks
// it read and navigates (`open`). An unread one also has "mark read" next to the row (`mark`; a sibling of the row
// control, never nested in it).
import type { PropType } from "vue";
import type { ForumNotification } from "~/types/forum";
import { NOTIFICATION_ICONS } from "~/utils/rework/community";

const props = defineProps({
  item: { type: Object as PropType<ForumNotification>, required: true },
  disabled: { type: Boolean, default: false },
  busy: { type: Boolean, default: false }
});
const emit = defineEmits<{ open: []; mark: [] }>();
const { t } = useI18n();
const typeText = computed(() => {
  switch (props.item.type) {
    case "reply":
      return t("forum.notificationsType.reply");
    case "mention":
      return t("forum.notificationsType.mention");
    case "like":
      return t("forum.notificationsType.like");
    case "system":
      return t("forum.notificationsType.system");
    default:
      return props.item.type;
  }
});
const icon = computed(() => NOTIFICATION_ICONS[props.item.type] || "bell");
const onSpace = (event: KeyboardEvent) => {
  if (props.item.threadId) return;
  event.preventDefault();
  emit("open");
};
</script>

<template>
  <li class="cni-wrap">
    <article
      class="cni notification-card"
      :class="{ unread: !item.isRead }"
      :tabindex="disabled ? -1 : 0"
      :role="item.threadId ? 'link' : 'button'"
      :aria-label="item.title"
      :aria-disabled="disabled || undefined"
      :aria-busy="busy"
      @click="emit('open')"
      @keydown.enter.prevent="emit('open')"
      @keydown.space="onSpace"
    >
      <span class="cni__gut" aria-hidden="true"><i v-if="!item.isRead" class="cni__dot" /></span>
      <DsPlayerAvatar v-if="item.actor" :src="item.actor.avatarUrl" :size="32" />
      <span v-else class="cni__sys" aria-hidden="true"><ReworkIcon :name="icon" /></span>
      <span class="cni__main">
        <span class="cni__meta">
          <span class="cni__type"><ReworkIcon :name="icon" />{{ typeText }}</span>
          <ReworkCommunityTime :value="item.createdAt" mode="relative" />
          <span v-if="!item.isRead" class="rw-vh">{{ t("rework.forum.notifications.unread") }}</span>
        </span>
        <b class="cni__title">{{ item.title }}</b>
        <span v-if="item.body" class="cni__body">{{ item.body }}</span>
      </span>
      <span v-if="item.threadId" class="cni__go" aria-hidden="true"><ReworkIcon name="forward" /></span>
    </article>
    <button v-if="!item.isRead" type="button" class="cni__mark" :disabled="disabled" :aria-label="`${t('rework.forum.notify.markRead')}: ${item.title}`" :title="t('rework.forum.notify.markRead')" @click="emit('mark')">
      <ReworkIcon name="check" />
    </button>
  </li>
</template>

<style scoped>
.cni-wrap {
  display: flex;
  align-items: stretch;
  list-style: none;
  border-bottom: 1px solid var(--line);
}
.cni-wrap:last-child {
  border-bottom: 0;
}
.cni {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: var(--sp-3);
  padding: var(--sp-4) var(--sp-4) var(--sp-4) var(--sp-2);
  font-family: var(--font-ui);
  color: var(--ink);
  cursor: pointer;
}
.cni:hover {
  background: var(--surface-2);
}
.cni:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}
.cni.unread,
.unread + .cni__mark {
  background: var(--unread-wash);
}
.cni__mark {
  flex: none;
  display: grid;
  place-items: center;
  width: var(--hit);
  min-height: var(--hit);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--link);
  cursor: pointer;
}
.cni__mark :deep(svg) {
  width: 18px;
  height: 18px;
}
.cni__mark:hover {
  background: var(--bg-sunk);
}
.cni__mark:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}
.cni__mark:disabled {
  color: var(--ink-3);
  cursor: wait;
}
.cni[aria-disabled="true"] {
  cursor: wait;
}
.cni__gut {
  flex: none;
  display: grid;
  place-items: center;
  width: 12px;
  height: 32px;
}
.cni__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--action-bg);
}
.cni__sys {
  flex: none;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-sunk);
  color: var(--ink-2);
}
.cni__sys :deep(svg) {
  width: 18px;
  height: 18px;
}
.cni__main {
  flex: 1;
  display: grid;
  gap: 4px;
  min-width: 0;
}
.cni__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px var(--sp-3);
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.cni__type {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--ink-2);
  font-weight: 600;
}
.cni__type :deep(svg) {
  width: 14px;
  height: 14px;
}
.cni__title {
  font-size: var(--fs-14);
  line-height: var(--lh-snug);
  overflow-wrap: anywhere;
}
.unread .cni__title {
  font-weight: 800;
}
.cni:not(.unread) .cni__title {
  font-weight: 600;
}
.cni__body {
  font-size: var(--fs-13);
  line-height: 1.5;
  color: var(--ink-2);
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.cni__go {
  flex: none;
  align-self: center;
  color: var(--link);
}
.cni__go :deep(svg) {
  width: 18px;
  height: 18px;
}
</style>
