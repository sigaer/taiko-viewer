<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import Gate from '../components/Gate.vue'
import Crown from '../components/Crown.vue'
import Rank from '../components/Rank.vue'
import { songs, scoreOf, RANKS, DIFFS, player, fmt } from '../mock/data'
import { L, isReady, songTitle } from '../store'
import { useQueryState } from '../routeState'
import { isMobile } from '../breakpoints'

// 点灯进度：每张魔王 / 里谱一个格子（格子 = 王冠或评价），按星级或定数分组。
// 规模（M6）：高星级三组默认展开，其余折叠；展开的组进入视口附近才挂载格子，每组先显示 240 张。
const PAGE = 240
const f = useQueryState({
  group: { type: 'string', default: 'star', values: ['star', 'const'] },
  show: { type: 'string', default: 'crown', values: ['crown', 'rank'] },
  open: { type: 'set', default: [] },
})

const charts = songs.flatMap((s) => s.charts.filter((c) => c.d >= 4).map((c) => ({ song: s, c, score: scoreOf(s.id, c.d) || null, key: `${s.id}-${c.d}` })))

const groups = computed(() => {
  const byStar = f.group === 'star'
  const m = new Map()
  for (const x of charts) {
    let key
    let order
    if (byStar) {
      key = `s${x.c.star}`
      order = x.c.star
    } else if (x.c.constant == null) {
      key = 'cn'
      order = -1
    } else {
      order = Math.floor(x.c.constant)
      key = `c${order}`
    }
    let g = m.get(key)
    if (!g) m.set(key, (g = { key, order, items: [], n: 0, clear: 0, fc: 0, dfc: 0 }))
    g.items.push(x)
    g.n++
    const cr = x.score ? x.score.crown : null
    if (cr != null && cr >= 0) g.clear++
    if (cr != null && cr >= 1) g.fc++
    if (cr === 2) g.dfc++
  }
  const list = [...m.values()].sort((a, b) => b.order - a.order)
  for (const g of list) g.items.sort((a, b) => (b.c.constant ?? -1) - (a.c.constant ?? -1) || a.song.id - b.song.id)
  return list
})
const groupName = (g) => (g.key === 'cn' ? L('没有定数', '定数なし') : f.group === 'star' ? `★${g.order}` : `${g.order}.x`)

// 展开状态：地址里没有 open 时用默认（前三组）；全部收起时写成 ['-']
const defaultOpen = computed(() => new Set(groups.value.filter((g) => g.order >= 0).slice(0, 3).map((g) => g.key)))
const openSet = computed(() => (f.open.length ? new Set(f.open.filter((k) => k !== '-')) : defaultOpen.value))
function toggle(key) {
  const next = new Set(openSet.value)
  if (next.has(key)) next.delete(key)
  else {
    next.add(key)
    live.value = new Set([...live.value, key])
  }
  f.open = next.size ? groups.value.filter((g) => next.has(g.key)).map((g) => g.key) : ['-']
}
function setGroup(g) {
  if (f.group === g) return
  Object.assign(f, { group: g, open: [] })
}

// 每组显示多少张（「再显示 240 张」）
const limits = reactive({})
const limitOf = (g) => limits[g.key] || PAGE
function more(g) {
  limits[g.key] = limitOf(g) + PAGE
}

/* ---------- 延迟挂载：展开的组接近视口时才渲染格子 ---------- */
const live = shallowRef(new Set())
function seedLive() {
  const first = groups.value.find((g) => openSet.value.has(g.key))
  live.value = new Set(first ? [first.key] : [])
}
seedLive()
watch(() => f.group, () => {
  for (const k of Object.keys(limits)) delete limits[k]
  seedLive()
})

let io = null
const observed = new Map()
function phRef(key, el) {
  const prev = observed.get(key)
  if (prev === el) return
  if (prev && io) io.unobserve(prev)
  if (el) {
    observed.set(key, el)
    io?.observe(el)
  } else observed.delete(key)
}
function onIo(entries) {
  const add = entries.filter((e) => e.isIntersecting).map((e) => e.target.dataset.key)
  if (add.length) live.value = new Set([...live.value, ...add])
}

// 占位高度按当前列数估算，保证页面总高度接近最终高度
const pageEl = ref(null)
const pageW = ref(1100)
function measureW() {
  if (pageEl.value) pageW.value = pageEl.value.clientWidth
}
const cols = computed(() => (isMobile.value ? 3 : Math.max(1, Math.floor((pageW.value + 6) / 118))))
const phHeight = (g) => Math.ceil(Math.min(g.n, limitOf(g)) / cols.value) * 58 - 6 + 'px'

onMounted(() => {
  measureW()
  window.addEventListener('resize', measureW)
  if (typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver(onIo, { rootMargin: '400px 0px' })
    for (const el of observed.values()) io.observe(el)
  } else live.value = new Set(groups.value.map((g) => g.key))
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', measureW)
  io?.disconnect()
  io = null
  observed.clear()
})

/* ---------- 格子 ---------- */
const CROWN_KEY = ['played', 'clear', 'fc', 'dfc']
const cellClass = (x) =>
  f.show === 'crown' ? (x.score ? CROWN_KEY[x.score.crown + 1] : 'none') : ['rk', x.score ? RANKS[x.score.rank]?.key || 'none' : 'none']
const glyph = (x) => {
  const r = x.score && RANKS[x.score.rank]
  return r && r.glyph ? L(r.glyph, r.glyphJa) : ''
}
const link = (x) => `/songs/${x.song.id}?d=${x.c.d}&from=progress`
function peekText(x) {
  const parts = [songTitle(x.song), `${L(DIFFS[x.c.d].zh, DIFFS[x.c.d].ja)} ★${x.c.star}${x.c.constant != null ? ' ' + x.c.constant.toFixed(2) : ''}`]
  if (x.score) {
    parts.push(fmt(x.score.score))
    parts.push(`${L('良', '良')} ${x.score.good} / ${L('可', '可')} ${x.score.ok} / ${L('不可', '不可')} ${x.score.ng}`)
  } else parts.push(L('还没打过', '未プレイ'))
  return parts.join(' · ')
}
const sel = ref(null)

const rankTotal = computed(() => player.rankCounts.reduce((a, b) => a + b, 0))
const rankLabel = computed(() => player.rankCounts.map((n, i) => `${L(RANKS[i + 2].zh, RANKS[i + 2].ja)} ${n}`).join('，'))
</script>

<template>
  <div ref="pageEl" class="page">
    <Gate v-if="!isReady" :what="L('点灯进度', '進捗')" />
    <template v-else>
      <div class="top">
        <section class="crowns" :aria-label="L('王冠', '王冠')">
          <div class="cstat"><Crown :v="2" size="lg" /><b class="num">{{ fmt(player.crownCounts.dfc) }}</b><span>{{ L('全良', '全良') }}</span></div>
          <div class="cstat"><Crown :v="1" size="lg" /><b class="num">{{ fmt(player.crownCounts.fc) }}</b><span>{{ L('全连', 'フルコンボ') }}</span></div>
          <div class="cstat"><Crown :v="0" size="lg" /><b class="num">{{ fmt(player.crownCounts.clear) }}</b><span>{{ L('通关', 'クリア') }}</span></div>
        </section>
        <section class="ranks">
          <div class="spread"><h2 class="t-h3">{{ L('评价分布', '評価の分布') }}</h2><span class="t-caption">{{ L(`共 ${fmt(rankTotal)} 张谱`, `全 ${fmt(rankTotal)} 譜面`) }}</span></div>
          <div class="rbar" role="img" :aria-label="rankLabel">
            <i v-for="(n, i) in player.rankCounts" :key="i" class="rk" :class="RANKS[i + 2].key" :style="{ flex: n }" />
          </div>
          <ul class="rlegend">
            <li v-for="(n, i) in player.rankCounts" :key="i"><i class="sw rk" :class="RANKS[i + 2].key" /><span class="lg-rank" aria-hidden="true"><Rank :v="i + 2" :px="24" /></span><span>{{ L(RANKS[i + 2].zh, RANKS[i + 2].ja) }}</span><b class="num">{{ fmt(n) }}</b></li>
          </ul>
        </section>
      </div>

      <div class="controls">
        <div class="seg" role="group" :aria-label="L('分组', 'グループ')">
          <button :aria-pressed="f.group === 'star'" @click="setGroup('star')">{{ L('按星级', '★ 別') }}</button>
          <button :aria-pressed="f.group === 'const'" @click="setGroup('const')">{{ L('按定数', '定数別') }}</button>
        </div>
        <div class="seg" role="group" :aria-label="L('格子显示', '表示')">
          <button :aria-pressed="f.show === 'crown'" @click="f.show = 'crown'">{{ L('看王冠', '王冠') }}</button>
          <button :aria-pressed="f.show === 'rank'" @click="f.show = 'rank'">{{ L('看评价', '評価') }}</button>
        </div>
        <ul v-if="f.show === 'crown'" class="legend only-desktop">
          <!-- C+ G10：格子仍是色块（--crown-*），图例里加真实王冠，色块与王冠对得上 -->
          <li><i class="lamp dfc" /><span class="lg-crown" aria-hidden="true"><Crown :v="2" size="chip" /></span>{{ L('全良', '全良') }}</li>
          <li><i class="lamp fc" /><span class="lg-crown" aria-hidden="true"><Crown :v="1" size="chip" /></span>{{ L('全连', 'フルコンボ') }}</li>
          <li><i class="lamp clear" /><span class="lg-crown" aria-hidden="true"><Crown :v="0" size="chip" /></span>{{ L('通关', 'クリア') }}</li>
          <li><i class="lamp played" />{{ L('未通关', '未クリア') }}</li>
          <li><i class="lamp none" />{{ L('没打过', '未プレイ') }}</li>
        </ul>
      </div>

      <section v-for="g in groups" :key="g.key" class="grp">
        <header>
          <h2 class="gk"><span :class="g.key === 'cn' ? 'gk-none' : 'num'">{{ groupName(g) }}</span></h2>
          <div class="gbar" role="img" :aria-label="L(`全良 ${g.dfc}，全连 ${g.fc}，通关 ${g.clear}，共 ${g.n} 张`, `全良 ${g.dfc}・フルコンボ ${g.fc}・クリア ${g.clear}／全 ${g.n} 譜面`)">
            <i class="lamp dfc" :style="{ width: (g.dfc / g.n) * 100 + '%' }" />
            <i class="lamp fc" :style="{ width: ((g.fc - g.dfc) / g.n) * 100 + '%' }" />
            <i class="lamp clear" :style="{ width: ((g.clear - g.fc) / g.n) * 100 + '%' }" />
          </div>
          <span class="gn"><b class="num">{{ fmt(g.fc) }}</b><span class="num"> / {{ fmt(g.n) }}</span> {{ L('全连', 'フルコンボ') }}</span>
          <button class="btn btn-sm gt" :aria-expanded="openSet.has(g.key)" :aria-controls="`cells-${g.key}`" @click="toggle(g.key)">
            <template v-if="openSet.has(g.key)">{{ L('收起', '閉じる') }}</template>
            <template v-else>{{ L(`展开 ${groupName(g)} · ${fmt(g.n)} 张`, `${groupName(g)} を開く · ${fmt(g.n)} 譜面`) }}</template>
          </button>
        </header>
        <div v-if="openSet.has(g.key)" :id="`cells-${g.key}`">
          <template v-if="live.has(g.key)">
            <div class="cells">
              <RouterLink
                v-for="x in g.items.slice(0, limitOf(g))"
                :key="x.key"
                :to="link(x)"
                class="lamp big"
                :class="cellClass(x)"
                :title="peekText(x)"
                @mouseenter="sel = x"
                @mouseleave="sel = null"
                @focus="sel = x"
                @blur="sel = null"
              >
                <span class="lamp-title">{{ songTitle(x.song) }}</span>
                <span class="lamp-meta">
                  <template v-if="x.c.constant != null">{{ x.c.constant.toFixed(1) }}</template><span v-else class="na">—</span><em v-if="x.c.d === 5">{{ L(DIFFS[5].short, DIFFS[5].shortJa) }}</em>
                </span>
                <span v-if="f.show === 'rank' && glyph(x)" class="lamp-glyph" aria-hidden="true">{{ glyph(x) }}</span>
              </RouterLink>
            </div>
            <p v-if="g.n > limitOf(g)" class="more">
              <button class="btn btn-sm" @click="more(g)">{{ L(`再显示 ${Math.min(PAGE, g.n - limitOf(g))} 张`, `さらに ${Math.min(PAGE, g.n - limitOf(g))} 譜面`) }}</button>
              <span class="t-caption num">{{ fmt(limitOf(g)) }} / {{ fmt(g.n) }}</span>
            </p>
          </template>
          <div v-else :ref="(el) => phRef(g.key, el)" class="ph" :data-key="g.key" :style="{ height: phHeight(g) }" aria-hidden="true" />
        </div>
      </section>

      <Transition name="pop">
        <div v-if="sel" class="peek only-desktop" aria-hidden="true">
          <b>{{ songTitle(sel.song) }}</b>
          <span class="num">{{ sel.score ? fmt(sel.score.score) : L('还没打过', '未プレイ') }}</span>
          <span v-if="sel.score" class="pk-j num">{{ sel.score.good }} / {{ sel.score.ok }} / {{ sel.score.ng }}</span>
        </div>
      </Transition>
    </template>
  </div>
</template>

<style scoped>
.top {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 56px;
  align-items: center;
  padding-bottom: 28px;
  border-bottom: 1px solid var(--line);
}
.crowns {
  display: flex;
  gap: 36px;
}
.cstat {
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  column-gap: 10px;
}
.cstat b {
  font-size: var(--fs-36);
  line-height: 1;
}
.cstat span:last-child {
  grid-column: 2;
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.ranks {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.rbar {
  display: flex;
  height: 14px;
  border-radius: var(--r-xs);
  overflow: hidden;
  gap: 2px;
}
/* --c 来自 domain.css 的 .rk.<评价键> */
.rbar i,
.sw {
  background: var(--c);
}
.rlegend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  font-size: var(--fs-12);
  color: var(--ink-2);
}
.rlegend li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.rlegend b {
  font-size: var(--fs-14);
  color: var(--ink);
}
.sw {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}
.controls {
  position: sticky;
  top: var(--bar-h);
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 calc(var(--gutter) * -1);
  padding: 12px var(--gutter);
  background: color-mix(in srgb, var(--bg) 92%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.legend {
  display: flex;
  gap: 14px;
  margin-left: auto;
  font-size: var(--fs-12);
  color: var(--ink-2);
}
.lg-crown,
.lg-rank {
  display: inline-flex;
}
.lg-crown:has(.crown) {
  display: none; /* 版本 A：生成式王冠与色块重复，不显示 */
}
.lg-rank:has(.rank) {
  display: none;
}
.legend li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.grp {
  margin-top: 20px;
}
.grp header {
  display: grid;
  grid-template-columns: 96px minmax(0, 320px) auto auto;
  align-items: center;
  gap: 16px;
  margin-bottom: 10px;
}
.gk {
  font-size: var(--fs-28);
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}
.gk-none {
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.gbar {
  display: flex;
  height: 10px;
  border-radius: var(--r-xs);
  background: var(--bg-sunk);
  overflow: hidden;
}
.gbar .lamp {
  display: block;
  width: auto;
  height: 100%;
  border-radius: 0;
}
.gn {
  font-size: var(--fs-12);
  color: var(--ink-3);
  white-space: nowrap;
}
.gn b {
  font-size: var(--fs-18);
  color: var(--ink);
}
.gt {
  justify-self: start;
}
.cells {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 6px;
  content-visibility: auto;
  contain-intrinsic-size: auto 600px;
}
.cells .lamp-meta {
  display: flex;
  align-items: baseline;
}
.ph {
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
}
.more {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
}
.peek {
  position: fixed;
  right: 24px;
  bottom: 64px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  max-width: 320px;
  padding: 10px 14px;
  border-radius: var(--overlay-radius);
  background: var(--toast-bg);
  color: var(--toast-ink);
  box-shadow: var(--overlay-shadow);
  pointer-events: none;
}
.peek b {
  overflow-wrap: anywhere;
}
.peek .num {
  font-size: var(--fs-22);
}
.peek .pk-j {
  font-size: var(--fs-12);
}
@media (max-width: 1099px) {
  .top {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
  }
}
@media (max-width: 767px) {
  .crowns {
    justify-content: space-between;
    gap: 12px;
  }
  .cstat b {
    font-size: var(--fs-28);
  }
  .controls {
    top: calc(var(--bar-h-m) + var(--subtab-h-m));
    gap: 8px;
    overflow-x: auto;
  }
  .grp header {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 8px 10px;
  }
  .gk {
    font-size: var(--fs-22);
  }
  .gt {
    grid-column: 1 / -1;
  }
  .cells {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .cells .lamp.big {
    min-height: var(--hit);
  }
}
</style>
