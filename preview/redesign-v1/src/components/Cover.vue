<script setup>
import { computed } from 'vue'
import { GENRES } from '../mock/data'

const props = defineProps({
  song: { type: Object, required: true },
  size: { type: String, default: '' },
})
// 取曲名第一个有意义的字作为封面字形
const glyph = computed(() => {
  const m = props.song.ja.replace(/[＊*\s「」\-]/g, '')
  return [...m][0] || '♪'
})
</script>

<template>
  <span class="cover" :class="[size, 'v' + (song.id % 3)]" :style="{ '--g': GENRES[song.genre].color, '--h': ((song.id * 37) % 44) - 22 + 'deg' }" lang="ja" aria-hidden="true"><b>{{ glyph }}</b></span>
</template>
