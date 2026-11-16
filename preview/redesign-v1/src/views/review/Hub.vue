<script setup>
import { useRouter } from 'vue-router'
import Logo from '../../components/Logo.vue'
import Icon from '../../components/Icon.vue'
import Lane from '../../components/Lane.vue'
import { SCREENS, AUTH_LABEL } from './screens'
import { store } from '../../store'
import { laneDays } from '../../mock/data'

// 设计总览：评审入口。不属于产品本身。
const router = useRouter()
function open(s) {
  if (s.auth) store.auth = s.auth
  router.push(s.path)
}
function phone(s) {
  if (s.auth) store.auth = s.auth
  router.push({ path: '/review/device', query: { p: s.path } })
}
const DOCS = [
  ['README.md', '运行方式与目录说明'],
  ['docs/01-product-audit.md', '现有产品的信息架构与设计问题'],
  ['docs/02-design-directions.md', '三个设计方向与取舍'],
  ['docs/03-ia-mapping.md', '新旧信息架构映射与功能覆盖清单'],
  ['docs/04-design-system.md', 'Design System V1 规范'],
  ['docs/05-page-specs.md', '主要页面的设计说明'],
  ['docs/06-migration-plan.md', '实施建议与分阶段迁移方案'],
]
</script>

<template>
  <div class="hub">
    <header class="top">
      <Logo :size="34" />
      <b class="grow">Taiko Viewer · Design V1</b>
      <div class="seg">
        <button :aria-pressed="store.theme === 'light'" @click="store.theme = 'light'">浅色</button>
        <button :aria-pressed="store.theme === 'dark'" @click="store.theme = 'dark'">深色</button>
        <button :aria-pressed="store.theme === 'system'" @click="store.theme = 'system'">跟随系统</button>
      </div>
    </header>

    <main class="wrap">
      <section class="intro">
        <div>
          <h1>把每一次练习，画成一条谱面。</h1>
          <p class="lead">这是 Taiko Viewer 全站重新设计的第一版提案，方向名「譜面 Fumen」。产品能力全部保留；导航、信息架构、视觉语言和交互方式是重新做的。所有数据都是示例。</p>
          <div class="row-wrap">
            <button class="btn btn-primary btn-lg" @click="open({ path: '/', auth: 'ready' })"><Icon name="desktop" :size="18" />打开桌面原型</button>
            <button class="btn btn-lg" @click="phone({ path: '/', auth: 'ready' })"><Icon name="phone" :size="18" />打开手机原型</button>
          </div>
        </div>
        <Lane :days="laneDays" :model-value="0" />
      </section>

      <nav class="trio">
        <RouterLink to="/review/directions"><Icon name="layers" :size="22" /><b>三个设计方向</b><span>譜面 / 祭 / 帖，以及为什么选第一个</span></RouterLink>
        <RouterLink to="/review/system"><Icon name="grid" :size="22" /><b>Design System V1</b><span>Tokens、组件、图表与动效的活样张</span></RouterLink>
        <RouterLink to="/states"><Icon name="info" :size="22" /><b>状态页样例</b><span>加载、空、错误、权限引导</span></RouterLink>
      </nav>

      <section>
        <h2>全部画面</h2>
        <p class="t-small">每个画面都可以用桌面或手机尺寸打开。进入原型后，右下角的「原型」按钮可以切换主题、语言和登录态。</p>
        <div v-for="g in SCREENS" :key="g.group" class="grp">
          <h3>{{ g.group }}</h3>
          <ul>
            <li v-for="s in g.items" :key="s.name">
              <div class="grow">
                <b>{{ s.name }}</b>
                <span class="t-small">{{ s.note }}</span>
              </div>
              <span v-if="s.auth" class="tag">{{ AUTH_LABEL[s.auth] }}</span>
              <button class="btn btn-sm" @click="open(s)"><Icon name="desktop" :size="14" />桌面</button>
              <button class="btn btn-sm" @click="phone(s)"><Icon name="phone" :size="14" />手机</button>
            </li>
          </ul>
        </div>
      </section>

      <section>
        <h2>文档</h2>
        <p class="t-small">位于 <code>preview/redesign-v1/</code> 目录下。</p>
        <ul class="docs">
          <li v-for="d in DOCS" :key="d[0]"><code>{{ d[0] }}</code><span>{{ d[1] }}</span></li>
        </ul>
      </section>
    </main>
  </div>
</template>

<style scoped>
.hub {
  min-height: 100dvh;
}
.top {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 60px;
  padding: 0 var(--gutter);
  background: color-mix(in srgb, var(--bg) 90%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line);
}
.top b {
  font-size: var(--fs-16);
  font-weight: 900;
}
.wrap {
  max-width: 1120px;
  margin: 0 auto;
  padding: 48px var(--gutter) 96px;
  display: flex;
  flex-direction: column;
  gap: 56px;
}
.intro {
  display: flex;
  flex-direction: column;
  gap: 32px;
}
.intro > div {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 720px;
}
.kicker {
  font-size: var(--fs-14);
  font-weight: 700;
  color: var(--don-ink);
}
h1 {
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 900;
  line-height: 1.15;
  text-wrap: balance;
}
.lead {
  font-size: var(--fs-16);
  color: var(--ink-2);
}
.trio {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  overflow: hidden;
}
.trio a {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 20px 22px;
  border-right: 1px solid var(--line);
  transition: background var(--dur-1);
}
.trio a:last-child {
  border-right: 0;
}
.trio a:hover {
  background: var(--surface-2);
}
.trio b {
  margin-top: 8px;
  font-size: var(--fs-18);
}
.trio span {
  font-size: var(--fs-13);
  color: var(--ink-2);
}
h2 {
  font-size: var(--fs-28);
  font-weight: 900;
  margin-bottom: 6px;
}
.grp {
  margin-top: 28px;
}
h3 {
  padding-bottom: 8px;
  border-bottom: 1px solid var(--line-strong);
  font-size: var(--fs-13);
  font-weight: 500;
  color: var(--ink-3);
}
.grp li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.grp li .grow {
  display: flex;
  align-items: baseline;
  gap: 14px;
  min-width: 0;
}
.grp li b {
  flex: none;
  font-size: var(--fs-16);
}
.docs {
  margin-top: 12px;
  border-top: 1px solid var(--line-strong);
}
.docs li {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 16px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
code {
  font-family: var(--font-num);
  font-size: var(--fs-16);
  font-weight: 600;
}
@media (max-width: 767px) {
  .top .seg {
    display: none;
  }
  .wrap {
    padding-top: 28px;
    gap: 40px;
  }
  .trio {
    grid-template-columns: minmax(0, 1fr);
  }
  .trio a {
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
  .grp li {
    flex-wrap: wrap;
  }
  .grp li .grow {
    flex-direction: column;
    gap: 2px;
    flex-basis: 100%;
  }
  .docs li {
    grid-template-columns: minmax(0, 1fr);
    gap: 2px;
  }
}
</style>
