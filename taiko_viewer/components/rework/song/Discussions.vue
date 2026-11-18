<script setup lang="ts">
// Related discussions of the selected chart on the song detail page: components/forum/SongRelatedDiscussions.vue
// (request, links and states unchanged; the forum area is reworked in slice D) with the reworked page's tokens.
defineProps<{ songId: number; difficultyType: number }>();
</script>

<template>
  <div class="disc">
    <ForumSongRelatedDiscussions :song-id="songId" :difficulty-type="difficultyType" appearance="song-detail" />
  </div>
</template>

<style scoped>
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
.disc :deep(.related-discussions--song-detail a) {
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
.disc :deep(.related-discussions--song-detail .related-discussions__list li a) {
  gap: var(--sp-1);
  padding: var(--sp-3) 0;
  border-bottom: 1px solid var(--line);
}
.disc :deep(.related-discussions--song-detail .related-discussions__list span) {
  color: var(--ink);
  font-size: var(--fs-14);
}
.disc :deep(.related-discussions--song-detail .related-discussions__list a:hover span) {
  color: var(--link);
}
.disc :deep(.related-discussions--song-detail .related-discussions__list small) {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.disc :deep(.related-discussions--song-detail a:focus-visible) {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
</style>
