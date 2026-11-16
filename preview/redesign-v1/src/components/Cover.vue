<script setup>
import { computed } from 'vue'
import { GENRES } from '../mock/data'

/**
 * Cover —— 生成式封面。
 * size: '' 44px（默认）| 'sm' 32px | 'lg' 72px | 'tile' 96px（头条、代表成绩）| 'xl' 168px | 'fill' 撑满容器
 * 圆角与字形大小见 domain.css 的 .cover 阶梯（D3）。
 */
const props = defineProps({
  song: { type: Object, required: true },
  size: { type: String, default: '', validator: (v) => ['', 'sm', 'lg', 'tile', 'xl', 'fill'].includes(v) },
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
