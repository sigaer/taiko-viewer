<script setup lang="ts">
// ReworkCommunityReplies — the reply section of a thread: heading with the count, the floors of the current reply
// window (at most REPLY_WINDOW mounted; windows only appear when a thread has more), the empty state, and the
// reply box in the default slot (last, so it stays at the bottom of the section).
import type { PropType } from "vue";
import type { ReplyWindow } from "~/utils/rework/community";

const props = defineProps({
  count: { type: Number, required: true },
  windows: { type: Array as PropType<ReplyWindow[]>, required: true },
  index: { type: Number, default: 0 },
  opId: { type: Number, default: 0 },
  highlightedId: { type: Number as PropType<number | null>, default: null },
  revealedIds: { type: Array as PropType<number[]>, default: () => [] },
  activeLikeId: { type: Number as PropType<number | null>, default: null },
  viewerLabel: { type: String, required: true }
});
const emit = defineEmits<{
  window: [index: number];
  like: [id: number, event: MouseEvent];
  reply: [id: number, label: string];
  reveal: [id: number];
  open: [url: string, event: MouseEvent];
  failed: [url: string];
}>();
const { t } = useI18n();
const current = computed(() => props.windows[Math.min(Math.max(0, props.index), props.windows.length - 1)] || null);
</script>

<template>
  <section class="cr reply-section" aria-labelledby="replies-title">
    <div class="cr__head">
      <h2 id="replies-title" class="cr__title" tabindex="-1">{{ t("rework.forum.thread.replies", { count }) }}</h2>
      <span v-if="windows.length > 1 && current" class="cr__range num">{{ t("rework.forum.thread.window", { from: current.firstFloor, to: current.lastFloor }) }}</span>
    </div>
    <ReworkPager v-if="windows.length > 1" class="cr__pager" :page="index + 1" :count="windows.length" @select="(page) => emit('window', page - 1)" />
    <ol v-if="current" class="cr__list reply-list">
      <ReworkCommunityFloor
        v-for="entry in current.floors"
        :key="`${entry.floor.id}-${entry.head}`"
        :entry="entry"
        :op-id="opId"
        :highlighted-id="highlightedId"
        :revealed-ids="revealedIds"
        :active-like-id="activeLikeId"
        :viewer-label="viewerLabel"
        @like="(id, event) => emit('like', id, event)"
        @reply="(id, label) => emit('reply', id, label)"
        @reveal="(id) => emit('reveal', id)"
        @open="(url, event) => emit('open', url, event)"
        @failed="(url) => emit('failed', url)"
      />
    </ol>
    <ReworkState v-else kind="empty" :title="t('rework.forum.thread.empty')" compact />
    <ReworkPager v-if="windows.length > 1" class="cr__pager" :page="index + 1" :count="windows.length" @select="(page) => emit('window', page - 1)" />
    <slot />
  </section>
</template>

<style scoped>
.cr {
  display: grid;
  gap: var(--sp-3);
  margin-top: var(--sp-6);
  padding-top: var(--sp-5);
  border-top: 1px solid var(--line-strong);
  font-family: var(--font-ui);
  color: var(--ink);
}
.cr__head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--sp-1) var(--sp-3);
}
.cr__title {
  margin: 0;
  font-size: var(--fs-18);
  font-weight: 700;
  scroll-margin-top: 88px;
}
.cr__title:focus {
  outline: none;
}
.cr__range {
  font-size: var(--fs-13);
  color: var(--ink-3);
}
.cr__list {
  display: grid;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--line);
}
</style>
