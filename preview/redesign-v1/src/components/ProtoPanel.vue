<script setup>
import { ref } from 'vue'
import Icon from './Icon.vue'
import { store } from '../store'

// 原型控制面板：只存在于设计原型里，用来切换主题 / 语言 / 登录态，方便评审各种状态。
const open = ref(false)
const AUTH = [
  ['guest', '游客'],
  ['unbound', '未绑定'],
  ['empty', '无成绩'],
  ['ready', '已同步'],
]
</script>

<template>
  <div class="proto" :class="{ open }">
    <div v-if="open" class="card">
      <div class="spread">
        <b>原型控制</b>
        <button class="icon-btn" aria-label="收起" @click="open = false"><Icon name="close" :size="18" /></button>
      </div>
      <div class="field">
        <span class="field-label">主题</span>
        <div class="seg">
          <button v-for="t in [['system', '跟随系统'], ['light', '浅色'], ['dark', '深色']]" :key="t[0]" :aria-pressed="store.theme === t[0]" @click="store.theme = t[0]">{{ t[1] }}</button>
        </div>
      </div>
      <div class="field">
        <span class="field-label">语言</span>
        <div class="seg">
          <button :aria-pressed="store.locale === 'zh'" @click="store.locale = 'zh'">简体中文</button>
          <button :aria-pressed="store.locale === 'ja'" @click="store.locale = 'ja'">日本語</button>
        </div>
      </div>
      <div class="field">
        <span class="field-label">登录态</span>
        <div class="seg">
          <button v-for="a in AUTH" :key="a[0]" :aria-pressed="store.auth === a[0]" @click="store.auth = a[0]">{{ a[1] }}</button>
        </div>
      </div>
      <RouterLink to="/review" class="btn btn-sm btn-block"><Icon name="layers" :size="16" />设计总览</RouterLink>
    </div>
    <button v-else class="fab" aria-label="原型控制" @click="open = true"><Icon name="settings" :size="16" /><span class="fab-lbl">原型</span></button>
  </div>
</template>

<style scoped>
.proto {
  position: fixed;
  z-index: var(--z-proto);
  right: 16px;
  bottom: 16px;
}
.fab {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border-radius: var(--r-note);
  background: var(--lane);
  color: var(--lane-ink);
  font-size: var(--fs-12);
  font-weight: 700;
  box-shadow: var(--shadow-lift);
  opacity: 0.82;
}
.fab:hover {
  opacity: 1;
}
.card {
  width: 300px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 14px 14px;
  background: var(--surface);
  border-radius: var(--r-panel);
  box-shadow: var(--shadow-pop);
}
.seg {
  display: flex;
}
.seg button {
  flex: 1;
  padding: 0 6px;
}
/* 手机：收起时是贴在左缘的小侧签（30% 高度，避开详情页的试听键），不遮挡底栏与页面操作 */
@media (max-width: 767px) {
  .proto {
    right: auto;
    bottom: auto;
    left: 0;
    top: 30%;
  }
  .proto.open {
    left: 8px;
    top: max(8px, min(30%, calc(100dvh - 380px)));
  }
  .fab {
    height: 34px;
    padding: 0 6px 0 5px;
    gap: 0;
    border-radius: 0 var(--r-ctl) var(--r-ctl) 0;
    opacity: 0.55;
  }
  .fab-lbl {
    display: none;
  }
  .card {
    width: min(300px, calc(100vw - 16px));
    max-height: calc(100dvh - 16px);
    overflow-y: auto;
  }
}
</style>
