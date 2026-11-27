<script setup>
import EmptyLane from './EmptyLane.vue'
import { store, L } from '../store'

// 统一的权限引导。旧版有的页面硬跳登录页、有的页面内联提示；这里全部改成同一种：
// 留在原地、说明差哪一步、给出那一步的按钮。
defineProps({ what: { type: String, default: '' } })
</script>

<template>
  <div class="panel gate">
    <EmptyLane v-if="store.auth === 'guest'" :title="L(`登录后查看${what}`, `ログインして${what}を見る`)" :text="L('登录后绑定鼓众广场 ID，同步一次成绩就能看到。', 'ログイン後にアカウントを連携し、一度同期すると表示されます。')">
      <RouterLink to="/login" class="btn btn-primary">{{ L('登录', 'ログイン') }}</RouterLink>
      <RouterLink to="/login?mode=register" class="btn">{{ L('注册', '新規登録') }}</RouterLink>
    </EmptyLane>
    <EmptyLane v-else-if="store.auth === 'unbound'" :title="L('先绑定鼓众广场 ID', 'まずアカウントを連携')" :text="L(`${what}来自你的游戏成绩。绑定只需要改一次游戏内称号。`, `${what}はゲームの成績から作られます。称号を一度変更するだけで連携できます。`)">
      <RouterLink to="/bind" class="btn btn-primary">{{ L('去绑定', '連携する') }}</RouterLink>
    </EmptyLane>
    <EmptyLane v-else :title="L('还没有成绩', 'まだ記録がありません')" :text="L('同步第一份成绩后，这里就会有内容。', '最初の同期が終わると、ここに表示されます。')">
      <RouterLink to="/account/sync" class="btn btn-primary">{{ L('同步成绩', '成績を同期') }}</RouterLink>
    </EmptyLane>
  </div>
</template>

<style scoped>
.gate {
  max-width: 640px;
  margin: 8vh auto 0;
}
</style>
