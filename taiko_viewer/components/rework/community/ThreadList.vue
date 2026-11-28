<script setup lang="ts">
// ReworkCommunityThreadList — a list of threads in one card with its states (ReworkState): loading keeps the rows'
// height, failed shows the read error with retry, empty shows `emptyTitle` and the `empty` slot's actions.
import type { PropType } from "vue";
import type { ForumThreadCard } from "~/types/forum";

defineProps({
  items: { type: Array as PropType<ForumThreadCard[] | null | undefined>, default: null },
  pending: { type: Boolean, default: false },
  error: { type: String, default: "" },
  emptyTitle: { type: String, default: "" },
  compact: { type: Boolean, default: false },
  rows: { type: Number, default: 4 }
});
const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <ReworkState v-if="pending" kind="loading" class="ctl-state">
    <template #skeleton>
      <span v-for="n in rows" :key="n" class="ctl-skel" aria-hidden="true"><i /><i /><i /></span>
    </template>
  </ReworkState>
  <ReworkState v-else-if="error" kind="failed" :text="error" compact @retry="emit('retry')" />
  <div v-else-if="items?.length" class="ctl">
    <ReworkCommunityThreadRow v-for="thread in items" :key="thread.id" :thread="thread" :compact="compact" />
  </div>
  <ReworkState v-else-if="items" kind="empty" :title="emptyTitle" compact><slot name="empty" /></ReworkState>
</template>

<style scoped>
.ctl {
  display: grid;
  padding: 0 var(--sp-5);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
/* the card's edge closes the last row (the row draws its own bottom divider elsewhere, e.g. the song page) */
.ctl > :last-child {
  border-bottom: 0;
}
.ctl-state {
  gap: 0;
  padding: 0 var(--sp-5);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
.ctl-skel {
  display: grid;
  gap: var(--sp-2);
  padding: var(--sp-4) 0;
  border-bottom: 1px solid var(--line);
}
.ctl-skel:last-child {
  border-bottom: 0;
}
@media (max-width: 767px) {
  .ctl,
  .ctl-state {
    padding: 0 var(--sp-4);
  }
}
.ctl-skel i {
  display: block;
  height: 12px;
  width: 30%;
  border-radius: var(--r-xs);
  background: var(--bg-sunk);
}
.ctl-skel i:nth-child(2) {
  height: 16px;
  width: 80%;
}
.ctl-skel i:nth-child(3) {
  width: 55%;
}
</style>
