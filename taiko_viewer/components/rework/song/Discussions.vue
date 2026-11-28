<script setup lang="ts">
// Related discussions of the selected chart on the song detail page: components/forum/SongRelatedDiscussions.vue
// (request, links and states unchanged) with the reworked page's tokens. Slice D: each discussion is the community's
// thread row (ReworkCommunityThreadRow, compact), the same as in the forum lists. Redesign v2: a card in the right column.
defineProps<{ songId: number; difficultyType: number }>();
</script>

<template>
  <div class="disc">
    <ForumSongRelatedDiscussions :song-id="songId" :difficulty-type="difficultyType" appearance="song-detail" />
  </div>
</template>

<style scoped>
.disc {
  min-width: 0;
  padding: var(--sp-4) var(--sp-5) var(--sp-5);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
@media (max-width: 767px) {
  .disc {
    padding: var(--sp-3) var(--sp-4) var(--sp-4);
  }
}
.disc :deep(.related-discussions.related-discussions--song-detail) {
  gap: var(--sp-1);
  padding: 0;
  font-family: var(--font-ui);
  color: var(--ink);
}
.disc :deep(.related-discussions--song-detail .related-discussions__head) {
  align-items: center;
  gap: var(--sp-2) var(--sp-4);
  min-height: var(--hit);
}
.disc :deep(.related-discussions--song-detail .related-discussions__title) {
  font-size: var(--fs-18);
  font-weight: 700;
  line-height: var(--lh-snug);
  color: var(--ink);
}
.disc :deep(.related-discussions--song-detail .related-discussions__head a),
.disc :deep(.related-discussions--song-detail > a),
.disc :deep(.related-discussions--song-detail .related-discussions__empty-row a) {
  color: var(--link);
  font-size: var(--fs-14);
}
.disc :deep(.related-discussions--song-detail .related-discussions__loading),
.disc :deep(.related-discussions--song-detail .related-discussions__empty) {
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  color: var(--ink-2);
}
.disc :deep(.related-discussions--song-detail .related-discussions__list) {
  gap: 0;
  border-top: 1px solid var(--line-strong);
}
.disc :deep(.related-discussions--song-detail a:focus-visible) {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
</style>
