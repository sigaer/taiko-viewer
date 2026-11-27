<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import Logo from '../../components/Logo.vue'
import Icon from '../../components/Icon.vue'
import { resolvedTheme } from '../../store'

// 三版对照（V1.3 Phase A）：评审用，不属于产品。三个 iframe 并排加载同一页面的 A / B / C，
// 地址参数 ?variant=…&theme=…&data=real 写在 # 之前，只作用于该 iframe，不改本地设置。
const route = useRoute()
const router = useRouter()
const PAGES = [
  { k: 'today', t: '今日', r: '/' },
  { k: 'song', t: '歌曲 615', r: '/songs/615' },
  { k: 'scores', t: '全部成绩', r: '/play/scores' },
  { k: 'community', t: '社区', r: '/community' },
]
const VPS = [
  { k: '1440', t: '桌面 1440（缩放）', w: 1440, h: 900 },
  { k: '390', t: '手机 390', w: 390, h: 844 },
  { k: '360', t: '手机 360', w: 360, h: 740 },
]
const VARIANTS = [
  { k: 'a', t: 'A · V1.2 基线（历史）', d: '生成式素材 · Fumen，不再维护' },
  { k: 'b', t: 'B · 真实素材（历史）', d: '真实素材 · Fumen，不再维护' },
  { k: 'c', t: 'C+ · Viewer Teal（最终）', d: '真实素材 · Teal' },
]
const q = (k, list, def) => (list.some((x) => x.k === route.query[k]) ? route.query[k] : def)
const page = computed(() => q('page', PAGES, 'today'))
const vp = computed(() => q('vp', VPS, '1440'))
const theme = computed(() => (route.query.theme === 'dark' || route.query.theme === 'light' ? route.query.theme : resolvedTheme.value))
function set(k, v) {
  router.replace({ query: { ...route.query, [k]: v } })
}
const V = computed(() => VPS.find((x) => x.k === vp.value))
const P = computed(() => PAGES.find((x) => x.k === page.value))
const base = (() => {
  const u = new URL(location.href)
  return u.origin + u.pathname
})()
const src = (v) => `${base}?variant=${v}&theme=${theme.value}&data=real#${P.value.r}`

// 桌面 1440 缩放到列宽
const grid = ref(null)
const colW = ref(400)
let ro = null
onMounted(() => {
  ro = new ResizeObserver(() => {
    const el = grid.value
    if (!el) return
    colW.value = Math.max(200, (el.clientWidth - 2 * 12) / 3)
  })
  if (grid.value) ro.observe(grid.value)
})
onBeforeUnmount(() => ro && ro.disconnect())
const scale = computed(() => Math.min(1, colW.value / V.value.w))
</script>

<template>
  <div class="cmp">
    <header class="top">
      <Logo :size="30" />
      <b class="grow">三版对照（Phase A 历史）· Design V1.3</b>
      <RouterLink to="/review/assets" class="btn btn-sm"><Icon name="grid" :size="14" />素材页</RouterLink>
      <RouterLink to="/review" class="btn btn-sm btn-ghost">设计总览</RouterLink>
    </header>
    <main>
    <div class="bar">
      <div class="seg" role="group" aria-label="页面">
        <button v-for="p in PAGES" :key="p.k" type="button" :aria-pressed="page === p.k" @click="set('page', p.k)">{{ p.t }}</button>
      </div>
      <div class="seg" role="group" aria-label="主题">
        <button type="button" :aria-pressed="theme === 'light'" @click="set('theme', 'light')">浅色</button>
        <button type="button" :aria-pressed="theme === 'dark'" @click="set('theme', 'dark')">深色</button>
      </div>
      <div class="seg" role="group" aria-label="视口">
        <button v-for="v in VPS" :key="v.k" type="button" :aria-pressed="vp === v.k" @click="set('vp', v.k)">{{ v.t }}</button>
      </div>
      <span class="t-caption">数据：real（真实曲号与曲名，其余为模拟数据）；三栏数据完全相同。</span>
    </div>
    <div ref="grid" class="cols">
      <section v-for="v in VARIANTS" :key="v.k" class="col" :aria-label="v.t">
        <div class="col-h"><b>{{ v.t }}</b><span class="t-caption">{{ v.d }}</span><a class="t-caption" :href="src(v.k)" target="_blank" rel="noopener">单独打开</a></div>
        <div class="frame" :style="{ width: V.w * scale + 'px', height: V.h * scale + 'px' }">
          <iframe :key="src(v.k) + V.k" :src="src(v.k)" :title="`${v.t}：${P.t}`" :width="V.w" :height="V.h" :style="{ transform: `scale(${scale})` }" loading="lazy" />
        </div>
      </section>
    </div>
    </main>
  </div>
</template>

<style scoped>
.cmp {
  min-height: 100dvh;
  background: var(--bg);
}
.top {
  display: flex;
  align-items: center;
  gap: 10px;
  height: var(--bar-h);
  padding: 0 var(--gutter);
  border-bottom: 1px solid var(--line);
}
.top b {
  min-width: 0;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  padding: 12px var(--gutter);
}
.cols {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 0 var(--gutter) 40px;
}
.col {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.col-h {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 10px;
}
.frame {
  position: relative;
  overflow: hidden;
  max-width: 100%;
  border: 1px solid var(--line-strong);
  border-radius: var(--r-ctl);
  background: var(--surface);
}
iframe {
  position: absolute;
  left: 0;
  top: 0;
  border: 0;
  transform-origin: 0 0;
}
@media (max-width: 767px) {
  .cols {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
