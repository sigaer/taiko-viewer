<script setup>
import { computed } from 'vue'
import Cover from './Cover.vue'
import { songTitle, songSub, subLang } from '../store'

/**
 * 歌曲单元：封面 + 主标题（当前语言）+ 副标题（另一语言或补充信息）。全站列表共用。
 * props: song、size（封面尺寸）、sub（自定义副行；不传时为另一语言的曲名，并带正确的 lang）
 * slot sub：追加在副行末尾。
 * 标题单行截断（D14），title 属性给出全文；曲名用正文字体，不用数字字体。
 */
const props = defineProps({
  song: { type: Object, required: true },
  size: { type: String, default: '' },
  sub: { type: String, default: null },
})
const title = computed(() => songTitle(props.song))
const subText = computed(() => props.sub ?? songSub(props.song))
</script>

<template>
  <span class="songcell">
    <Cover :song="song" :size="size" />
    <span class="grow">
      <span class="t title-1l" :title="title">{{ title }}</span>
      <span class="s title-1l" :title="subText || undefined" :lang="sub == null ? subLang : undefined">{{ subText }}<slot name="sub" /></span>
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
.t {
  font-family: var(--font-ui);
  font-variant-numeric: normal;
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
