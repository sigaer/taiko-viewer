<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Logo from '../../components/Logo.vue'
import Icon from '../../components/Icon.vue'
import { SCREENS, AUTH_LABEL } from './screens'
import { store } from '../../store'

// 手机预览：把原型本身放进一个 390 × 844 的 iframe，媒体查询按真实手机宽度生效。
// 主题 / 语言 / 登录态通过 localStorage 的 storage 事件同步到 iframe 里。
const route = useRoute()
const router = useRouter()
const path = computed(() => route.query.p || '/')
const size = ref('phone')
const SIZES = { phone: [390, 844, '手机 390'], small: [360, 740, '小屏 360'], tablet: [820, 1100, '平板 820'] }
const src = computed(() => `${location.pathname}${location.search}#${path.value}`)
const frame = ref(null)
watch(src, () => frame.value?.contentWindow?.location.replace(src.value))
function go(s) {
  if (s.auth) store.auth = s.auth
  router.replace({ query: { p: s.path } })
}
</script>

<template>
  <div class="dev">
    <aside class="list">
      <RouterLink to="/review" class="back"><Logo :size="28" /><b>设计总览</b></RouterLink>
      <div v-for="g in SCREENS" :key="g.group" class="grp">
        <h2>{{ g.group }}</h2>
        <button v-for="s in g.items" :key="s.name" :aria-pressed="path === s.path && (!s.auth || s.auth === store.auth)" @click="go(s)">{{ s.name }}</button>
      </div>
    </aside>

    <main class="stage">
      <div class="controls">
        <div class="seg"><button v-for="(v, k) in SIZES" :key="k" :aria-pressed="size === k" @click="size = k">{{ v[2] }}</button></div>
        <div class="seg">
          <button :aria-pressed="store.theme === 'light'" @click="store.theme = 'light'"><Icon name="sun" :size="16" /></button>
          <button :aria-pressed="store.theme === 'dark'" @click="store.theme = 'dark'"><Icon name="moon" :size="16" /></button>
        </div>
        <div class="seg">
          <button :aria-pressed="store.locale === 'zh'" @click="store.locale = 'zh'">中文</button>
          <button :aria-pressed="store.locale === 'ja'" @click="store.locale = 'ja'">日本語</button>
        </div>
        <div class="seg"><button v-for="(v, k) in AUTH_LABEL" :key="k" :aria-pressed="store.auth === k" @click="store.auth = k">{{ v }}</button></div>
      </div>
      <div class="phone" :class="size" :style="{ width: SIZES[size][0] + 24 + 'px', height: SIZES[size][1] + 24 + 'px' }">
        <iframe ref="frame" :src="src" :width="SIZES[size][0]" :height="SIZES[size][1]" title="手机预览" />
      </div>
      <p class="t-caption">也可以直接把浏览器窗口缩到 767px 以下，或在手机上打开同一个地址。</p>
    </main>
  </div>
</template>

<style scoped>
.dev {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100dvh;
  background: var(--bg-sunk);
}
.list {
  position: sticky;
  top: 0;
  height: 100dvh;
  overflow-y: auto;
  padding: 16px 12px 40px;
  background: var(--surface);
  border-right: 1px solid var(--line);
}
.back {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px 16px;
}
.grp h2 {
  padding: 14px 8px 4px;
  font-size: var(--fs-12);
  font-weight: 500;
  color: var(--ink-3);
}
.grp button {
  display: block;
  width: 100%;
  padding: 6px 8px;
  border-radius: var(--r-ctl);
  font-size: var(--fs-13);
  color: var(--ink-2);
  text-align: left;
}
.grp button:hover {
  background: var(--bg-sunk);
  color: var(--ink);
}
.grp button[aria-pressed='true'] {
  background: var(--ink);
  color: var(--bg);
  font-weight: 700;
}
.stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 20px 20px 48px;
  min-width: 0;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}
.controls .seg {
  background: var(--surface);
  box-shadow: inset 0 0 0 1px var(--line);
}
.controls .seg button[aria-pressed='true'] {
  background: var(--ink);
  color: var(--bg);
}
.phone {
  padding: 12px;
  border-radius: 46px;
  background: var(--ai-950);
  box-shadow: var(--shadow-pop);
  flex: none;
  max-width: 100%;
}
.phone.tablet {
  border-radius: 30px;
}
iframe {
  display: block;
  border: 0;
  border-radius: 34px;
  background: var(--bg);
  max-width: 100%;
}
.phone.tablet iframe {
  border-radius: 18px;
}
@media (max-width: 900px) {
  .dev {
    grid-template-columns: minmax(0, 1fr);
  }
  .list {
    position: static;
    height: auto;
    display: flex;
    gap: 4px;
    overflow-x: auto;
    padding: 8px;
  }
  .list .grp {
    display: flex;
    gap: 4px;
  }
  .list h2 {
    display: none;
  }
  .grp button {
    white-space: nowrap;
  }
  .back b {
    display: none;
  }
  .back {
    padding: 0 4px;
  }
}
</style>
