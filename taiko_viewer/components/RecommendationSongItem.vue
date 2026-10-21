<script setup lang="ts">
import { difficultyLabelKey } from '~/utils/difficulty';

defineProps<{
  songId: number;
  title: string;
  difficultyType: number;
  starLevel?: number | null;
  to: string;
}>();
const emit = defineEmits<{ browse: [] }>();
const { t } = useI18n();
</script>

<template>
  <article class="song-row" :data-song-id="songId" :data-difficulty="difficultyType">
    <NuxtLink :to="to" class="song-row__song" @click="emit('browse')">
      <SongCoverImage :song-id="songId" :alt="title" sizes="56px" fit="contain" />
      <span class="song-row__text">
        <strong class="song-row__title">{{ title }}</strong>
        <span class="song-row__meta">
          <span>{{ t(difficultyLabelKey(difficultyType)) }}</span>
          <span v-if="starLevel != null">{{ starLevel }}★</span>
          <slot name="tags" />
        </span>
        <span v-if="$slots.details" class="song-row__details"><slot name="details" /></span>
      </span>
    </NuxtLink>
    <div v-if="$slots.actions" class="song-row__actions"><slot name="actions" /></div>
  </article>
</template>

<style scoped>
.song-row { display:flex; flex-wrap:wrap; align-items:center; gap:12px 16px; min-width:0; padding:18px 0; border-bottom:1px solid var(--viewer-border); }
.song-row__song { display:grid; grid-template-columns:56px minmax(0,1fr); align-items:center; gap:14px; flex:1 1 18rem; min-width:0; min-height:56px; color:var(--viewer-text); text-decoration:none; }
.song-row__song :deep(.song-cover-picture) { width:56px; height:56px; border-radius:7px; overflow:hidden; }
.song-row__text { display:grid; gap:6px; min-width:0; }
.song-row__title { overflow-wrap:anywhere; font-size:16px; font-weight:600; line-height:1.5; }
.song-row__meta { display:flex; flex-wrap:wrap; gap:6px 12px; color:var(--viewer-text-muted); font-size:14px; line-height:1.5; }
.song-row__details { color:var(--viewer-text-muted); font-size:14px; line-height:1.5; font-variant-numeric:tabular-nums; }
.song-row__actions { flex:0 1 auto; min-width:0; max-width:100%; margin-inline-start:auto; color:var(--viewer-text-muted); font-size:14px; line-height:1.5; overflow-wrap:anywhere; }
.song-row__actions :deep([data-song-action]) { min-height:44px; max-width:100%; padding:8px 12px; border:1px solid var(--viewer-border); border-radius:10px; background:var(--viewer-surface); color:var(--viewer-link); font:inherit; cursor:pointer; }
.song-row__actions :deep([data-song-action]:disabled) { opacity:.55; cursor:default; }
.song-row__song:hover .song-row__title { color:var(--viewer-link); }
.song-row__song:focus-visible,.song-row__actions :deep([data-song-action]:focus-visible) { outline:3px solid var(--viewer-link); outline-offset:3px; }
@media(max-width:640px) { .song-row__song { gap:12px; } }
</style>
