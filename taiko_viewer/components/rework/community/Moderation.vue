<script setup lang="ts">
// ReworkCommunityModeration — the moderators' console on /forum/me (only rendered for moderator / admin roles):
// the latest threads including hidden ones, each with pin / feature / lock / hide toggles. Only emits; the page posts
// /api/forum/moderation/action exactly as before. Collapsed by default (a <details>, as before); the open state is the
// page's (v-model:open), so it survives the refresh after an action (the console is re-mounted while the home payload
// that carries the role is read again).
import type { PropType } from "vue";
import type { ForumThreadCard } from "~/types/forum";
import { resolveForumSectionTranslation } from "~/utils/forum";

defineProps({
  items: { type: Array as PropType<ForumThreadCard[]>, default: () => [] },
  pending: { type: Boolean, default: false },
  error: { type: String, default: "" },
  busy: { type: Boolean, default: false },
  open: { type: Boolean, default: false }
});
const emit = defineEmits<{ action: [threadId: number, action: string, enabled: boolean]; retry: []; "update:open": [value: boolean] }>();
const { t } = useI18n();
const localePath = useLocalePath();
const sectionName = (thread: ForumThreadCard) => resolveForumSectionTranslation(t, thread.section.slug, thread.section.slug);
</script>

<template>
  <details class="cmod moderation-panel" :open="open" @toggle="emit('update:open', ($event.target as HTMLDetailsElement).open)">
    <summary class="cmod__summary moderation-summary"><ReworkIcon name="chevron" />{{ t("rework.forum.me.moderation") }}</summary>
    <ReworkState v-if="pending" kind="loading" :lines="4" compact />
    <ReworkState v-else-if="error" kind="failed" :text="error" compact @retry="emit('retry')" />
    <ul v-else class="cmod__list moderation-list">
      <li v-for="thread in items" :key="thread.id" class="cmod__item moderation-item">
        <div class="cmod__meta">
          <NuxtLink :to="localePath(`/forum/thread/${thread.id}`)" class="cmod__title">{{ thread.title }}</NuxtLink>
          <span class="cmod__sub">{{ sectionName(thread) }} · {{ thread.author.username }}<template v-if="thread.status === 'hidden'"> · {{ t("rework.forum.hidden") }}</template></span>
        </div>
        <div class="cmod__acts">
          <button type="button" class="rw-btn rw-btn--sm" :aria-pressed="thread.isPinned" :disabled="busy" @click="emit('action', thread.id, 'pin', !thread.isPinned)">{{ thread.isPinned ? t("rework.forum.me.unpin") : t("rework.forum.me.pin") }}</button>
          <button type="button" class="rw-btn rw-btn--sm" :aria-pressed="thread.isFeatured" :disabled="busy" @click="emit('action', thread.id, 'feature', !thread.isFeatured)">{{ thread.isFeatured ? t("rework.forum.me.unfeature") : t("rework.forum.me.feature") }}</button>
          <button type="button" class="rw-btn rw-btn--sm" :aria-pressed="thread.isLocked" :disabled="busy" @click="emit('action', thread.id, 'lock', !thread.isLocked)">{{ thread.isLocked ? t("rework.forum.me.unlock") : t("rework.forum.me.lock") }}</button>
          <button type="button" class="rw-btn rw-btn--sm cmod__danger" :disabled="busy" @click="emit('action', thread.id, 'hide', thread.status === 'published')">{{ thread.status === "published" ? t("rework.forum.me.hide") : t("rework.forum.me.restore") }}</button>
        </div>
      </li>
    </ul>
  </details>
</template>

<style scoped>
.cmod {
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  font-family: var(--font-ui);
  color: var(--ink);
}
.cmod__summary {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  min-height: var(--hit);
  padding: var(--sp-2) var(--sp-4);
  font-size: var(--fs-16);
  font-weight: 700;
  cursor: pointer;
  list-style: none;
}
.cmod__summary::-webkit-details-marker {
  display: none;
}
.cmod__summary :deep(svg) {
  width: 18px;
  height: 18px;
  transform: rotate(-90deg);
}
.cmod[open] .cmod__summary :deep(svg) {
  transform: none;
}
.cmod__summary:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
  border-radius: var(--r-panel);
}
.cmod :deep(.rw-state) {
  padding-inline: var(--sp-4);
}
.cmod__list {
  display: grid;
  margin: 0;
  padding: 0 var(--sp-4) var(--sp-3);
  list-style: none;
}
.cmod__item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2) var(--sp-4);
  padding: var(--sp-3) 0;
  border-top: 1px solid var(--line);
}
.cmod__meta {
  display: grid;
  gap: 2px;
  min-width: 0;
  flex: 1 1 260px;
}
.cmod__title {
  color: var(--ink);
  font-weight: 700;
  text-decoration: none;
  overflow-wrap: anywhere;
}
.cmod__title:hover {
  color: var(--link);
}
.cmod__title:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.cmod__sub {
  font-size: var(--fs-12);
  color: var(--ink-3);
  overflow-wrap: anywhere;
}
.cmod__acts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-1);
}
.cmod__acts [aria-pressed="true"] {
  border-color: var(--selected-line);
  background: var(--selected-bg);
  color: var(--selected-ink);
}
.cmod__danger {
  color: var(--status-fail);
  border-color: var(--status-fail);
}
</style>
