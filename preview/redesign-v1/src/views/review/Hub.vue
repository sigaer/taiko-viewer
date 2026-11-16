<script setup>
import { useRouter } from 'vue-router'
import Logo from '../../components/Logo.vue'
import Icon from '../../components/Icon.vue'
import Lane from '../../components/Lane.vue'
import { SCREENS, AUTH_LABEL } from './screens'
import { store } from '../../store'
import { laneDays, datasetInfo, fmt } from '../../mock/data'

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
// laneDays 按时间先后排列（今天在最后），取最近 21 天
const recentDays = laneDays.slice(-21)
const THEMES = [
  { v: 'light', t: '浅色' },
  { v: 'dark', t: '深色' },
  { v: 'system', t: '跟随系统' },
]
const CHANGES = [
  ['手机同步入口', '顶栏同步按钮用角标表达状态，点开同一个同步面板'],
  ['全局搜索', '曲名、别名、日文、艺术家、配置串、物量都有真实结果'],
  ['路由状态', '筛选、排序、页签写进地址；返回时还原筛选与滚动位置'],
  ['对比度与触控', '文字在每种底色上 ≥ 4.5:1；手机可点区域 ≥ 44px'],
  ['真实规模数据', '上千首歌、几百条成绩与帖子，长列表虚拟滚动'],
  ['四类模块的视觉区分', '查询、成长、社区、账号各有自己的版面语气'],
  ['深色首屏与减少动效', '深色用户首屏不闪白；减少动效时没有循环动画'],
]
const DOCS = [
  ['README.md', '运行方式与目录说明'],
  ['docs/01-product-audit.md', '现有产品的信息架构与设计问题'],
  ['docs/02-design-directions.md', '三个设计方向与取舍'],
  ['docs/03-ia-mapping.md', '新旧信息架构映射与功能覆盖清单'],
  ['docs/04-design-system.md', 'Design System V1 规范'],
  ['docs/05-page-specs.md', '主要页面的设计说明'],
  ['docs/06-migration-plan.md', '实施建议与分阶段迁移方案'],
  ['docs/07-v1.1-design-decisions.md', '设计裁决'],
  ['docs/08-v1.1-fix-record.md', '逐项修复记录'],
  ['docs/09-v1.1-qa-report.md', '浏览器验收报告'],
  ['qa/screenshots/index.html', '关键截图与浅深对照'],
]
</script>

<template>
  <div class="hub">
    <header class="top">
      <Logo :size="34" />
      <b class="grow">Taiko Viewer · Design V1.1</b>
      <div class="seg" role="group" aria-label="主题">
        <button v-for="t in THEMES" :key="t.v" type="button" :aria-pressed="store.theme === t.v" @click="store.theme = t.v">{{ t.t }}</button>
      </div>
    </header>

    <main class="wrap">
      <section class="intro" aria-labelledby="hub-title">
        <div>
          <h1 id="hub-title">把每一次练习，画成一条谱面。</h1>
          <p class="lead">Taiko Viewer 全站重新设计，方向名「<span lang="ja">譜面</span> Fumen」。V1.1 在第一版的基础上按设计裁决逐项修复：同步、搜索、路由状态、对比度与触控、真实规模数据和模块的视觉区分。产品能力全部保留；所有数据都是示例。</p>
          <div class="row-wrap">
            <button type="button" class="btn btn-primary btn-lg" @click="open({ path: '/', auth: 'ready' })"><Icon name="desktop" :size="18" />打开桌面原型</button>
            <button type="button" class="btn btn-lg" @click="phone({ path: '/', auth: 'ready' })"><Icon name="phone" :size="18" />打开手机原型</button>
          </div>
        </div>
        <Lane :days="recentDays" :model-value="0" label="最近 21 天的练习谱面" />
      </section>

      <section aria-labelledby="hub-changes">
        <h2 id="hub-changes">这一版改了什么</h2>
        <ul class="changes">
          <li v-for="c in CHANGES" :key="c[0]"><b>{{ c[0] }}</b><span>{{ c[1] }}</span></li>
        </ul>
        <p class="t-small dataline">
          当前数据：<b>{{ datasetInfo.name }}</b> 数据集 · <span class="num">{{ fmt(datasetInfo.songs) }}</span> 首歌 · <span class="num">{{ fmt(datasetInfo.charts) }}</span> 张谱 · <span class="num">{{ fmt(datasetInfo.scores) }}</span> 条成绩 · <span class="num">{{ fmt(datasetInfo.threads) }}</span> 个帖子 · 生成用时 <span class="num">{{ datasetInfo.generatedMs }}</span> ms
        </p>
      </section>

      <nav class="trio" aria-label="评审页">
        <RouterLink to="/review/directions"><Icon name="layers" :size="22" /><b>三个设计方向</b><span>譜面 / 祭 / 帖，以及为什么选第一个</span></RouterLink>
        <RouterLink to="/review/system"><Icon name="grid" :size="22" /><b>Design System V1.1</b><span>Tokens、组件、图表、动效与模块语气的活样张</span></RouterLink>
        <RouterLink to="/states"><Icon name="info" :size="22" /><b>状态页样例</b><span>加载、空、错误、权限引导</span></RouterLink>
      </nav>

      <section aria-labelledby="hub-screens">
        <h2 id="hub-screens">全部画面</h2>
        <p class="t-small">每个画面都可以用桌面或手机尺寸打开。进入原型后，右下角的「原型」按钮可以切换主题、语言、登录态和数据规模。</p>
        <div v-for="g in SCREENS" :key="g.group" class="grp">
          <h3>{{ g.group }}</h3>
          <ul>
            <li v-for="s in g.items" :key="s.name">
              <div class="grow">
                <b>{{ s.name }}</b>
                <span class="t-small">{{ s.note }}</span>
              </div>
              <span v-if="s.auth" class="tag">{{ AUTH_LABEL[s.auth] }}</span>
              <button type="button" class="btn btn-sm" :aria-label="`${s.name}：桌面`" @click="open(s)"><Icon name="desktop" :size="14" />桌面</button>
              <button type="button" class="btn btn-sm" :aria-label="`${s.name}：手机`" @click="phone(s)"><Icon name="phone" :size="14" />手机</button>
            </li>
          </ul>
        </div>
      </section>

      <section aria-labelledby="hub-docs">
        <h2 id="hub-docs">文档</h2>
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
  background: var(--bg);
}
.top {
  position: sticky;
  top: 0;
  z-index: var(--z-bar);
  display: flex;
  align-items: center;
  gap: 12px;
  height: var(--bar-h);
  padding: 0 var(--gutter);
  background: color-mix(in srgb, var(--bg) 90%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line);
}
.top b {
  min-width: 0;
  font-size: var(--fs-16);
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
.changes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 32px;
  margin-top: 12px;
  border-top: 1px solid var(--line-strong);
}
.changes li {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-14);
}
.changes b {
  flex: none;
  font-weight: 700;
}
.changes span {
  min-width: 0;
  color: var(--ink-2);
}
.dataline {
  margin-top: 14px;
}
.dataline .num {
  color: var(--ink);
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
.trio a:focus-visible {
  border-radius: 0;
  box-shadow: inset 0 0 0 2px var(--focus-ring);
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
  overflow-wrap: anywhere;
}
@media (max-width: 1099px) {
  .changes {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 767px) {
  .top {
    height: var(--bar-h-m);
  }
  .top .seg {
    display: none;
  }
  .wrap {
    padding-top: 28px;
    gap: 40px;
  }
  .changes li {
    flex-direction: column;
    gap: 2px;
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
