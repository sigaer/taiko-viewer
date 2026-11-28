<script setup lang="ts">
// ReworkCommunityReplies — the reply section of a thread: heading with the count, the reading tools (只看楼主, jump to
// a floor number), the floors of the current reply window (at most REPLY_WINDOW mounted; windows only appear when a
// thread has more), the empty state, and the reply box in the default slot (last, so it stays at the bottom).
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
  viewerLabel: { type: String, required: true },
  viewerId: { type: Number as PropType<number | null>, default: null },
  locked: { type: Boolean, default: false },
  editingId: { type: Number as PropType<number | null>, default: null },
  ownBusy: { type: Boolean, default: false },
  /** 只看楼主 is on */
  onlyOp: { type: Boolean, default: false },
  /** the thread has floors at all (the tools are shown only then) */
  hasFloors: { type: Boolean, default: false }
});
const emit = defineEmits<{
  window: [index: number];
  like: [id: number, event: MouseEvent];
  reply: [id: number, label: string];
  reveal: [id: number];
  open: [url: string, event: MouseEvent];
  failed: [url: string];
  copy: [id: number];
  edit: [id: number];
  cancelEdit: [];
  save: [id: number, payload: { bodyText: string; images: string[] }];
  remove: [id: number, isFloor: boolean];
  "update:onlyOp": [value: boolean];
  jump: [floor: string];
}>();
const { t } = useI18n();
const current = computed(() => props.windows[Math.min(Math.max(0, props.index), props.windows.length - 1)] || null);
const jumpValue = ref("");
const jumpId = useId();
const submitJump = () => {
  if (jumpValue.value.trim()) emit("jump", jumpValue.value.trim());
};
</script>

<template>
  <section class="cr reply-section" aria-labelledby="replies-title">
    <div class="cr__head">
      <h2 id="replies-title" class="cr__title" tabindex="-1">{{ t("rework.forum.thread.replies", { count }) }}</h2>
      <span v-if="windows.length > 1 && current" class="cr__range num">{{ t("rework.forum.thread.window", { from: current.firstFloor, to: current.lastFloor }) }}</span>
      <div v-if="hasFloors" class="cr__tools">
        <button type="button" class="cr__chip" :aria-pressed="onlyOp" @click="emit('update:onlyOp', !onlyOp)">{{ t("rework.forum.tools.onlyOp") }}</button>
        <form class="cr__jump" @submit.prevent="submitJump">
          <label :for="jumpId" class="rw-vh">{{ t("rework.forum.tools.jumpFloor") }}</label>
          <span class="cr__hash" aria-hidden="true">#</span>
          <input :id="jumpId" v-model="jumpValue" class="cr__floor num" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" enterkeyhint="go" autocomplete="off" :placeholder="t('rework.forum.tools.jumpFloor')" />
          <button type="submit" class="cr__go">{{ t("rework.forum.tools.jump") }}</button>
        </form>
      </div>
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
        :viewer-id="viewerId"
        :locked="locked"
        :editing-id="editingId"
        :own-busy="ownBusy"
        @like="(id, event) => emit('like', id, event)"
        @reply="(id, label) => emit('reply', id, label)"
        @reveal="(id) => emit('reveal', id)"
        @open="(url, event) => emit('open', url, event)"
        @failed="(url) => emit('failed', url)"
        @copy="(id) => emit('copy', id)"
        @edit="(id) => emit('edit', id)"
        @cancel-edit="emit('cancelEdit')"
        @save="(id, payload) => emit('save', id, payload)"
        @remove="(id, isFloor) => emit('remove', id, isFloor)"
      />
    </ol>
    <ReworkState v-else kind="empty" :title="onlyOp ? t('rework.forum.tools.onlyOpEmpty') : t('rework.forum.thread.empty')" compact />
    <ReworkPager v-if="windows.length > 1" class="cr__pager" :page="index + 1" :count="windows.length" @select="(page) => emit('window', page - 1)" />
    <slot />
  </section>
</template>

<style scoped>
.cr {
  display: grid;
  gap: var(--sp-3);
  margin-top: var(--sp-8);
  font-family: var(--font-ui);
  color: var(--ink);
}
.cr__head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-2) var(--sp-3);
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
.cr__tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
  margin-left: auto;
}
.cr__chip {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
  padding: 0 var(--sp-4);
  border: 1px solid var(--line-strong);
  border-radius: var(--r-note);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: var(--fs-13);
  font-weight: 600;
  cursor: pointer;
}
.cr__chip:hover {
  background: var(--bg-sunk);
}
.cr__chip[aria-pressed="true"] {
  border-color: var(--selected-line);
  background: var(--selected-bg);
  color: var(--selected-ink);
  font-weight: 700;
}
.cr__chip:focus-visible,
.cr__go:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.cr__jump {
  display: inline-flex;
  align-items: center;
  height: var(--hit);
  box-sizing: border-box;
  padding-left: var(--sp-3);
  border: 1px solid var(--line-strong);
  border-radius: var(--r-note);
  background: var(--surface);
  overflow: hidden;
}
.cr__jump:focus-within {
  border-color: var(--input-focus-line);
}
.cr__hash {
  font-size: var(--fs-13);
  color: var(--ink-3);
}
.cr__floor {
  width: 4.5em;
  height: 100%;
  padding: 0 var(--sp-1);
  border: 0;
  background: transparent;
  color: var(--ink);
  font-size: var(--fs-16);
}
.cr__floor:focus {
  outline: none;
}
.cr__go {
  height: 100%;
  padding: 0 var(--sp-3);
  border: 0;
  border-left: 1px solid var(--line);
  background: transparent;
  color: var(--link);
  font: inherit;
  font-size: var(--fs-13);
  font-weight: 600;
  cursor: pointer;
}
.cr__go:hover {
  background: var(--bg-sunk);
}
.cr__list {
  display: grid;
  gap: var(--sp-3);
  margin: 0;
  padding: 0;
}
@media (max-width: 767px) {
  .cr__tools {
    width: 100%;
    margin-left: 0;
  }
}
</style>
