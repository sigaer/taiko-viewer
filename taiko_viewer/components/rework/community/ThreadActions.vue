<script setup lang="ts">
// ReworkCommunityThreadActions — like the thread (pressed state, count) and reply to it. Only emits; the page does
// the request and keeps the scroll position and focus as before.
defineProps({
  liked: { type: Boolean, default: false },
  likeCount: { type: Number, default: 0 },
  replyCount: { type: Number, default: 0 },
  busy: { type: Boolean, default: false }
});
const emit = defineEmits<{ like: [event: MouseEvent]; reply: [] }>();
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
  </div>
</template>

<style scoped>
.ta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  margin-top: var(--sp-6);
  font-family: var(--font-ui);
}
.ta__act {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  min-height: var(--hit);
  padding: 0 var(--sp-4);
  border: 1px solid var(--line-strong);
  border-radius: var(--r-note);
  background: var(--surface);
  color: var(--ink-2);
  font: inherit;
  font-size: var(--fs-14);
  font-weight: 600;
  cursor: pointer;
}
.ta__act :deep(svg) {
  width: 18px;
  height: 18px;
}
.ta__act:hover {
  background: var(--bg-sunk);
  color: var(--ink);
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
.ta__act:disabled {
  cursor: progress;
}
.ta__act b {
  color: inherit;
}
</style>
