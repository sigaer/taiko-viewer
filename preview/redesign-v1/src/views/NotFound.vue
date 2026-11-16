<script setup>
import { useRoute } from 'vue-router'
import Icon from '../components/Icon.vue'
import EmptyLane from '../components/EmptyLane.vue'
import { store, L } from '../store'

const route = useRoute()
</script>

<template>
  <div class="page nf">
    <div class="panel">
      <EmptyLane :title="L('这里没有谱面', 'ここに譜面はありません')" :text="L('这个地址没有对应的页面，链接可能已经过期。可以直接搜索曲名、帖子或工具。', 'このアドレスにページはありません。リンクの期限が切れている可能性があります。曲名・投稿・ツールを検索できます。')">
        <button type="button" class="btn btn-primary" @click="store.paletteOpen = true"><Icon name="search" :size="16" />{{ L('打开搜索', '検索を開く') }}</button>
        <RouterLink to="/" class="btn">{{ L('回到今日', '「今日」に戻る') }}</RouterLink>
      </EmptyLane>
      <p class="path">
        <span class="tag num">404</span>
        <code class="num title-1l" :title="route.fullPath">{{ route.path }}</code>
      </p>
    </div>
  </div>
</template>

<style scoped>
.nf {
  max-width: calc(720px + var(--gutter) * 2);
  padding-top: clamp(24px, 9vh, 96px);
}
.path {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;
  padding: 12px 20px;
  border-top: 1px solid var(--line);
  color: var(--ink-2);
}
.path code {
  min-width: 0;
  font-size: var(--fs-13);
}
@media (max-width: 767px) {
  .nf :deep(.acts) {
    width: 100%;
    flex-direction: column;
    gap: 8px;
  }
  .nf :deep(.acts .btn) {
    width: 100%;
  }
}
</style>
