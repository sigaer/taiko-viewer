<script setup>
import Cover from './Cover.vue'
import { songTitle, songSub, subLang } from '../store'

// 歌曲单元：封面 + 主标题（当前语言）+ 副标题（另一语言或补充信息）。全站列表共用。
defineProps({
  song: { type: Object, required: true },
  size: { type: String, default: '' },
  sub: { type: String, default: null },
})
</script>

<template>
  <span class="songcell">
    <Cover :song="song" :size="size" />
    <span class="grow">
      <span class="t truncate">{{ songTitle(song) }}</span>
      <span class="s truncate" :lang="sub == null ? subLang : undefined">{{ sub ?? songSub(song) }}<slot name="sub" /></span>
    </span>
  </span>
</template>

<style scoped>
.songcell {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.t,
.s {
  display: block;
}
.t {
  font-weight: 700;
  font-size: var(--fs-14);
  line-height: 1.35;
  color: var(--ink);
}
.s {
  font-size: var(--fs-12);
  color: var(--ink-3);
  line-height: 1.4;
  min-height: 1em;
}
</style>
