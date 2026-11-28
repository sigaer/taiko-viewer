<script setup lang="ts">
// ReworkCommunityThreadActions — the thread's actions: like (pressed state, count), reply, favourite (pressed state),
// copy the link, and for the author while the thread is open: edit (the edit page) and delete. Only emits; the page
// does the requests and keeps the scroll position and focus as before.
defineProps({
  liked: { type: Boolean, default: false },
  likeCount: { type: Number, default: 0 },
  replyCount: { type: Number, default: 0 },
  busy: { type: Boolean, default: false },
  favorited: { type: Boolean, default: false },
  favoriteBusy: { type: Boolean, default: false },
  /** the edit page of this thread when the signed-in member may edit it; "" otherwise */
  editTo: { type: String, default: "" },
  deleting: { type: Boolean, default: false }
});
const emit = defineEmits<{ like: [event: MouseEvent]; reply: []; favorite: [event: MouseEvent]; copy: []; remove: [] }>();
const { t } = useI18n();
</script>

<template>
  <div class="ta thread-actions" role="group" :aria-label="t('rework.forum.thread.articleActions')">
    <button type="button" class="ta__act" :class="{ 'is-on': liked }" :aria-pressed="liked" :aria-busy="busy || undefined" :disabled="busy" @click="emit('like', $event)">
      <ReworkIcon :name="liked ? 'heartFilled' : 'heart'" /><span>{{ liked ? t("rework.forum.thread.likedThread") : t("rework.forum.thread.likeThread") }}</span><b class="num">{{ likeCount }}</b>
    </button>
    <button type="button" class="ta__act" @click="emit('reply')">
      <ReworkIcon name="reply" /><span>{{ t("rework.forum.thread.replyThread") }}</span><b class="num">{{ replyCount }}</b>
    </button>
    <button type="button" class="ta__act" :class="{ 'is-on': favorited }" :aria-pressed="favorited" :aria-busy="favoriteBusy || undefined" :disabled="favoriteBusy" @click="emit('favorite', $event)">
      <ReworkIcon name="star" /><span>{{ favorited ? t("rework.forum.tools.favorited") : t("rework.forum.tools.favorite") }}</span>
    </button>
    <button type="button" class="ta__act ta__icon" :aria-label="t('rework.forum.tools.copyLink')" :title="t('rework.forum.tools.copyLink')" @click="emit('copy')">
      <ReworkIcon name="link" />
    </button>
    <span v-if="editTo" class="ta__own">
      <NuxtLink :to="editTo" class="ta__act ta__icon" :aria-label="t('rework.forum.tools.edit')" :title="t('rework.forum.tools.edit')"><ReworkIcon name="edit" /></NuxtLink>
      <button type="button" class="ta__act ta__icon is-danger" :aria-label="t('rework.forum.tools.delete')" :title="t('rework.forum.tools.delete')" :disabled="deleting" :aria-busy="deleting || undefined" @click="emit('remove')">
        <ReworkIcon name="trash" />
      </button>
    </span>
  </div>
</template>

<style scoped>
.ta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
  margin-top: var(--sp-6);
  padding-top: var(--sp-4);
  border-top: 1px solid var(--line);
  font-family: var(--font-ui);
}
.ta__own {
  display: inline-flex;
  gap: var(--sp-2);
  margin-left: auto;
}
.ta__act {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  min-height: var(--hit);
  padding: 0 var(--sp-4);
  border: 1px solid var(--line-strong);
  border-radius: var(--r-ctl);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: var(--fs-14);
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}
.ta__icon {
  justify-content: center;
  min-width: var(--hit);
  padding: 0;
}
.ta__act :deep(svg) {
  width: 18px;
  height: 18px;
}
.ta__act:hover {
  background: var(--bg-sunk);
}
.ta__act:active {
  background: var(--selected-bg);
}
.ta__act:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.ta__act.is-on {
  border-color: var(--selected-line);
  background: var(--selected-bg);
  color: var(--selected-ink);
}
.ta__act.is-danger {
  color: var(--danger);
}
.ta__act.is-danger:hover {
  border-color: var(--danger);
  background: var(--danger-wash);
}
.ta__act:disabled {
  cursor: progress;
}
.ta__act b {
  color: inherit;
}
</style>
