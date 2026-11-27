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
// C+ 是最终设计（默认）；A、B 是 Phase A 的历史对照，不再维护
const VARIANTS = [
  ['c', 'C+ 最终', '真实素材 · Viewer Teal（默认）'],
  ['a', 'A 历史', 'V1.2 生成式素材 · Fumen（不再维护）'],
  ['b', 'B 历史', '真实素材 · Fumen（不再维护）'],
]
const OUTCOMES = [
  ['success', '成功'],
  ['partial', '部分成功'],
  ['failed', '失败'],
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
        <span class="field-label">版本</span>
        <div class="seg" role="group" aria-label="版本">
          <button v-for="v in VARIANTS" :key="v[0]" :aria-pressed="store.variant === v[0]" :title="v[2]" @click="store.variant = v[0]">{{ v[1] }}</button>
        </div>
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
      <div class="field">
        <span class="field-label">数据规模</span>
        <div class="seg" role="group" aria-label="数据规模">
          <button :aria-pressed="store.dataset === 'full'" @click="store.dataset = 'full'">真实规模</button>
          <button :aria-pressed="store.dataset === 'demo'" @click="store.dataset = 'demo'">精选 30 首</button>
          <button :aria-pressed="store.dataset === 'real'" @click="store.dataset = 'real'">真实曲目</button>
        </div>
      </div>
      <div class="field">
        <span class="field-label">下一次同步结果</span>
        <div class="seg" role="group" aria-label="下一次同步结果">
          <button v-for="o in OUTCOMES" :key="o[0]" :aria-pressed="store.syncOutcome === o[0]" @click="store.syncOutcome = o[0]">{{ o[1] }}</button>
        </div>
      </div>
      <div class="field">
        <span class="field-label">减少动效</span>
        <div class="seg" role="group" aria-label="减少动效">
          <button :aria-pressed="store.motion === 'system'" @click="store.motion = 'system'">跟随系统</button>
          <button :aria-pressed="store.motion === 'reduce'" @click="store.motion = 'reduce'">开启</button>
        </div>
      </div>
      <div class="field">
        <span class="field-label">列表密度</span>
        <div class="seg" role="group" aria-label="列表密度">
          <button :aria-pressed="store.density === 'comfortable'" @click="store.density = 'comfortable'">宽松</button>
          <button :aria-pressed="store.density === 'compact'" @click="store.density = 'compact'">紧凑</button>
        </div>
      </div>
      <RouterLink to="/review" class="btn btn-sm btn-block"><Icon name="layers" :size="16" />设计总览</RouterLink>
    </div>
    <button v-else class="fab stage" aria-label="原型控制" @click="open = true"><Icon name="settings" :size="16" /><span class="fab-lbl">原型</span></button>
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
  font-size: var(--fs-12);
  font-weight: 700;
  box-shadow: var(--shadow-lift);
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
  background: var(--overlay-bg);
  border-radius: var(--r-panel);
  box-shadow: var(--shadow-pop), 0 0 0 1px var(--overlay-line);
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
    top: max(8px, min(30%, calc(100dvh - 660px)));
  }
  /* C9：手机上把手可见宽度 ≤ 12px，留在 16px 页边距内；可点区域只向屏幕外（左）扩展，不压内容 */
  .fab {
    position: relative;
    justify-content: center;
    width: 12px;
    height: var(--hit);
    padding: 0;
    gap: 0;
    border-radius: 0 var(--r-ctl) var(--r-ctl) 0;
    opacity: 0.55;
  }
  .fab::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    width: 44px;
  }
  .fab::after {
    content: '';
    width: 2px;
    height: 16px;
    border-radius: 1px;
    background: currentColor;
  }
  .fab :deep(svg),
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
