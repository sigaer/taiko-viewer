<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import Icon from '../components/Icon.vue'
import SongCell from '../components/SongCell.vue'
import Cover from '../components/Cover.vue'
import Diff from '../components/Diff.vue'
import Crown from '../components/Crown.vue'
import Rank from '../components/Rank.vue'
import Radar from '../components/Radar.vue'
import Sheet from '../components/Sheet.vue'
import EmptyLane from '../components/EmptyLane.vue'
import VirtualList from '../components/VirtualList.vue'
import { songs, scoreOf, CHART_AXES, DIFFS, normalize, fmt, fx } from '../mock/data'
import { L, isReady, songTitle, songSub, subLang, toast, store } from '../store'
import { useQueryState } from '../routeState'
import { useHScroll } from '../hscroll'
import { isMobile, isWide } from '../breakpoints'

// 定数表：每张带定数的谱面一行（一次性展开，之后只做筛选与排序）。
let missing = 0
const HAY = new Map()
const hayOf = (s) => {
  let h = HAY.get(s.id)
  if (h == null) {
    h = [s.zh, s.ja, s.artist, String(s.id), ...(s.aliases || [])].map(normalize).join('\u0001')
    HAY.set(s.id, h)
  }
  return h
}
const ALL = []
for (const s of songs) {
  for (const c of s.charts) {
    if (c.constant == null) {
      missing++
      continue
    }
    ALL.push({
      key: `${s.id}-${c.d}`,
      song: s,
      chart: c,
      // 检索串按曲目懒计算并共用：第一次输入关键词时才规范化，首次进入页面不做 3,000 次规范化
      get hay() {
        return hayOf(s)
      },
    })
  }
}
const MISSING = missing
const BY_KEY = new Map(ALL.map((r) => [r.key, r]))

const DIFF_CHIPS = [
  { d: '3', zh: '困难', ja: 'むずかしい', key: 'hard' },
  { d: '4', zh: '魔王', ja: 'おに', key: 'oni' },
  { d: '5', zh: '里', ja: '裏', key: 'ura' },
]
const RANGES = [
  { key: 'a', label: '≥ 13', test: (c) => c >= 13 },
  { key: 'b', label: '12 – 13', test: (c) => c >= 12 && c < 13 },
  { key: 'c', label: '11 – 12', test: (c) => c >= 11 && c < 12 },
  { key: 'd', label: '10 – 11', test: (c) => c >= 10 && c < 11 },
  { key: 'e', label: '< 10', test: (c) => c < 10 },
]
const SORT_KEYS = ['title', 'd', 'constant', 'c75', 'c99', 'notes', ...CHART_AXES.map((a) => a.key)]

const f = useQueryState({
  q: { type: 'string', default: '', debounce: 250 },
  diff: { type: 'set', default: [], values: DIFF_CHIPS.map((c) => c.d) },
  range: { type: 'string', default: '', values: ['', ...RANGES.map((r) => r.key)] },
  nofc: { type: 'boolean', default: false },
  sort: { type: 'string', default: 'constant', values: SORT_KEYS },
  dir: { type: 'string', default: 'desc', values: ['asc', 'desc'] },
  sel: { type: 'string', default: '' },
})

const numCols = computed(() => [
  { key: 'constant', label: L('主定数', '主定数'), cls: 'main-col' },
  { key: 'c75', label: '75%', cls: 'alt-col' },
  { key: 'c99', label: '99%', cls: 'alt-col' },
  { key: 'notes', label: L('物量', 'ノーツ数'), cls: '' },
  ...CHART_AXES.map((a) => ({ key: a.key, label: L(a.zh, a.ja), cls: 'ab-col', ab: true })),
])
const sortOptions = computed(() => [{ key: 'title', label: L('曲名', '曲名') }, { key: 'd', label: L('难度', '難易度') }, ...numCols.value])

function val(r, k) {
  if (k === 'd') return r.chart.d * 100 + r.chart.star
  return k in r.chart.abilities ? r.chart.abilities[k] : r.chart[k]
}
function sortBy(k) {
  if (f.sort === k) f.dir = f.dir === 'asc' ? 'desc' : 'asc'
  else {
    f.sort = k
    f.dir = k === 'title' ? 'asc' : 'desc'
  }
}
const ariaSort = (k) => (f.sort === k ? (f.dir === 'asc' ? 'ascending' : 'descending') : 'none')
const arrow = computed(() => (f.dir === 'asc' ? 'chevU' : 'chevD'))
const toggleDir = () => (f.dir = f.dir === 'asc' ? 'desc' : 'asc')

const collator = computed(() => new Intl.Collator(store.locale === 'ja' ? 'ja' : 'zh'))
const rows = computed(() => {
  const terms = f.q.trim().split(/\s+/).map(normalize).filter(Boolean)
  const rg = RANGES.find((x) => x.key === f.range)
  const diffs = f.diff.length ? new Set(f.diff.map(Number)) : null
  const nofc = f.nofc && isReady.value
  const out = []
  for (const r of ALL) {
    if (terms.length && !terms.every((w) => r.hay.includes(w))) continue
    if (diffs && !diffs.has(r.chart.d)) continue
    if (rg && !rg.test(r.chart.constant)) continue
    if (nofc) {
      const sc = scoreOf(r.song.id, r.chart.d)
      if (sc && sc.crown >= 1) continue
    }
    out.push(r)
  }
  const k = f.sort
  const dir = f.dir === 'asc' ? 1 : -1
  if (k === 'title') {
    const col = collator.value
    const tt = new Map(out.map((r) => [r.key, songTitle(r.song)]))
    return out.sort((a, b) => col.compare(tt.get(a.key), tt.get(b.key)) * dir || b.chart.constant - a.chart.constant)
  }
  return out.sort((a, b) => (val(a, k) - val(b, k)) * dir || b.chart.constant - a.chart.constant)
})
const filtered = computed(() => !!f.q.trim() || f.diff.length > 0 || !!f.range || f.nofc)
function toggleDiff(d) {
  f.diff = f.diff.includes(d) ? f.diff.filter((x) => x !== d) : [...f.diff, d]
}
function reset() {
  f.q = ''
  f.diff = []
  f.range = ''
  f.nofc = false
}
function exportCsv() {
  toast(L(`已导出 ${fmt(rows.value.length)} 行：taiko-constants-v2.csv`, `${fmt(rows.value.length)} 行を書き出しました：taiko-constants-v2.csv`))
}
const scoreRow = (r) => (isReady.value ? scoreOf(r.song.id, r.chart.d) || null : null)

// ---------- 选中：宽屏是右侧检视栏，其余尺寸是弹层 ----------
const sheetOpen = ref(false)
const sel = computed(() => BY_KEY.get(f.sel) || rows.value[0] || null)
const selScore = computed(() => (sel.value ? scoreRow(sel.value) : null))
function pick(r) {
  f.sel = r.key
  if (!isWide.value) sheetOpen.value = true
}
const isSel = (r) => !!sel.value && sel.value.key === r.key
const inspProps = computed(() => (isWide.value ? { class: 'insp panel', 'aria-label': L('谱面详情', '譜面の詳細') } : { open: sheetOpen.value, title: L('谱面定数', '譜面の定数'), width: 440 }))
watch(isWide, (w) => w && (sheetOpen.value = false))

const axes = computed(() => CHART_AXES.map((a) => ({ key: a.key, label: L(a.zh, a.ja), value: sel.value.chart.abilities[a.key] })))
// 三个定数在同一条刻度线上的位置；标签按数值高低分到左上 / 下方 / 右上，保证不重叠
const scale = computed(() => {
  const c = sel.value.chart
  const pts = [
    { key: 'c75', label: '75%', v: c.c75 ?? c.constant },
    { key: 'c95', label: '95%', v: c.constant, main: true },
    { key: 'c99', label: '99%', v: c.c99 ?? c.constant },
  ]
  const lo = Math.min(...pts.map((p) => p.v))
  const hi = Math.max(...pts.map((p) => p.v))
  const pad = Math.max(0.12, (hi - lo) * 0.3)
  const order = [...pts].sort((a, b) => a.v - b.v)
  return pts.map((p) => ({ ...p, x: ((p.v - lo + pad) / (hi - lo + pad * 2)) * 100, slot: ['lo', 'mid', 'hi'][order.indexOf(p)] }))
})

// ---------- 表格放不下：首列固定、面板内横滑，右缘渐隐提示还有内容（I13） ----------
const tableWrap = ref(null)
const tableEl = ref(null)
const { overflow, moreRight } = useHScroll(tableWrap, tableEl)

// 行状态（选中）与整行点击挂在 <tr> 上（VirtualList rowClass / rowAttrs，I5）
const rowClass = (r) => ({ 'is-link': true, 'is-sel': isSel(r) })
const rowAttrs = (r) => ({ onClick: () => pick(r) })
// 列表密度（I10）：定高行跟随 store.density
const rowH = computed(() => (store.density === 'compact' ? 42 : 52))

// 结果集变化时，若已滚过列表开头则回到列表开头
const listStart = ref(null)
watch(
  () => [f.q, f.diff.join(), f.range, f.nofc, f.sort, f.dir].join('|'),
  () =>
    nextTick(() => {
      const el = listStart.value
      if (!el) return
      const y = el.getBoundingClientRect().top + window.scrollY - (isMobile.value ? 52 : 60) - 12
      if (window.scrollY > y + 1) window.scrollTo({ top: Math.max(0, y), behavior: 'auto' })
    }),
)
const colCount = computed(() => 2 + numCols.value.length + (isReady.value ? 1 : 0))
</script>

<template>
  <div class="page consts">
    <div class="toolbar">
      <label class="search">
        <Icon name="search" :size="18" />
        <input v-model="f.q" class="input" type="search" :placeholder="L('曲名、别名、艺术家或 ID', '曲名・別名・アーティスト・ID')" :aria-label="L('搜索谱面', '譜面を検索')" />
      </label>
      <span class="t-small count" role="status"><b class="num">{{ fmt(rows.length) }}</b> {{ L('张谱面', '譜面') }}</span>
      <button class="btn" @click="exportCsv"><Icon name="download" :size="18" />{{ L('导出 CSV', 'CSV を書き出す') }}</button>
    </div>

    <div class="filters scroll-x" role="group" :aria-label="L('筛选', '絞り込み')">
      <button v-for="c in DIFF_CHIPS" :key="c.d" class="chip" :class="'dc-' + c.key" :aria-pressed="f.diff.includes(c.d)" @click="toggleDiff(c.d)">
        <i class="dot dcol" />{{ L(c.zh, c.ja) }}
      </button>
      <span class="sep" aria-hidden="true" />
      <button v-for="r in RANGES" :key="r.key" class="chip num" :aria-pressed="f.range === r.key" :aria-label="L(`定数 ${r.label}`, `定数 ${r.label}`)" @click="f.range = f.range === r.key ? '' : r.key">{{ r.label }}</button>
      <template v-if="isReady">
        <span class="sep" aria-hidden="true" />
        <button class="chip" :aria-pressed="f.nofc" @click="f.nofc = !f.nofc">{{ L('只看我没全连的', '未フルコンボのみ') }}</button>
      </template>
      <button v-if="filtered" class="btn btn-ghost btn-sm" @click="reset">{{ L('清除筛选', '条件をクリア') }}</button>
    </div>

    <div v-if="isMobile" class="msort">
      <select v-model="f.sort" class="select" :aria-label="L('排序方式', '並び替え')">
        <option v-for="o in sortOptions" :key="o.key" :value="o.key">{{ L('按', '') }}{{ o.label }}{{ L('排序', '順') }}</option>
      </select>
      <button class="icon-btn" :aria-label="f.dir === 'asc' ? L('当前升序，改为降序', '昇順（降順に切り替え）') : L('当前降序，改为升序', '降順（昇順に切り替え）')" @click="toggleDir">
        <Icon :name="arrow" />
      </button>
    </div>

    <div ref="listStart" aria-hidden="true" />

    <div class="layout">
      <div class="main-col">
        <template v-if="rows.length">
          <!-- 手机：虚拟滚动列表 -->
          <VirtualList v-if="isMobile" tag="ul" row-tag="li" class="mlist" :items="rows" :row-height="68" key-field="key" v-slot="{ item: r }">
            <button class="mrow" :aria-pressed="isSel(r)" @click="pick(r)">
              <Cover :song="r.song" />
              <span class="grow mbody">
                <span class="mt title-1l" :title="songTitle(r.song)">{{ songTitle(r.song) }}</span>
                <span class="mmeta">
                  <Diff :d="r.chart.d" :star="r.chart.star" short />
                  <!-- C7：个人状态只用 Crown，带可读的文字名称；没打过不显示 -->
                  <Crown v-if="scoreRow(r)" class="mcrown" :v="scoreRow(r).crown" size="sm" label />
                  <span v-if="!['constant', 'title', 'd'].includes(f.sort)" class="t-caption">
                    {{ sortOptions.find((o) => o.key === f.sort).label }} <b class="num">{{ f.sort === 'notes' ? fmt(val(r, f.sort)) : fx(val(r, f.sort)) }}</b>
                  </span>
                </span>
              </span>
              <b class="num mk">{{ fx(r.chart.constant) }}</b>
              <Icon name="chevR" :size="16" />
            </button>
          </VirtualList>

          <!-- 桌面 / 平板：虚拟滚动表格 -->
          <div v-else class="hs" :class="{ 'hs-more': moreRight }">
          <div ref="tableWrap" class="panel tablewrap" :class="{ overflow }">
            <table ref="tableEl" class="dt ctable" :class="{ 'no-mine': !isReady }" :style="{ '--row-h': rowH + 'px' }">
              <caption class="sr-only">{{ L('谱面定数表', '譜面定数表') }} · {{ fmt(rows.length) }}</caption>
              <thead>
                <tr>
                  <th scope="col" class="song" :class="{ 'dt-sticky-col': overflow }" :aria-sort="ariaSort('title')">
                    <button @click="sortBy('title')">{{ L('歌曲', '楽曲') }}<Icon v-if="f.sort === 'title'" :name="arrow" :size="12" /></button>
                  </th>
                  <th scope="col" class="dcol-h" :aria-sort="ariaSort('d')">
                    <button @click="sortBy('d')">{{ L('难度', '難易度') }}<Icon v-if="f.sort === 'd'" :name="arrow" :size="12" /></button>
                  </th>
                  <th v-for="c in numCols" :key="c.key" scope="col" class="r" :class="c.cls" :aria-sort="ariaSort(c.key)">
                    <button @click="sortBy(c.key)">{{ c.label }}<Icon v-if="f.sort === c.key" :name="arrow" :size="12" /></button>
                  </th>
                  <th v-if="isReady" scope="col" class="c">{{ L('我的', '自分') }}</th>
                </tr>
              </thead>
              <VirtualList tag="tbody" row-tag="tr" :items="rows" :row-height="rowH" key-field="key" :colspan="colCount" :row-class="rowClass" :row-attrs="rowAttrs" v-slot="{ item: r }">
                <td class="song" :class="{ 'dt-sticky-col': overflow }">
                  <button class="rowbtn" :aria-pressed="isSel(r)" @click.stop="pick(r)"><SongCell :song="r.song" size="sm" /></button>
                </td>
                <td><Diff :d="r.chart.d" :star="r.chart.star" short /></td>
                <td v-for="c in numCols" :key="c.key" class="r" :class="[c.cls, { sorted: f.sort === c.key }]">
                  <span v-if="c.ab" class="ab">
                    <span class="num">{{ fx(r.chart.abilities[c.key]) }}</span>
                    <span class="ab-bar" aria-hidden="true"><span :style="{ width: (r.chart.abilities[c.key] / 15.5) * 100 + '%' }" /></span>
                  </span>
                  <span v-else-if="r.chart[c.key] == null" class="na">—</span>
                  <span v-else class="num">{{ c.key === 'notes' ? fmt(r.chart.notes) : fx(r.chart[c.key]) }}</span>
                </td>
                <td v-if="isReady" class="c">
                  <span v-if="scoreRow(r)" class="mine"><Crown :v="scoreRow(r).crown" /><Rank :v="scoreRow(r).rank" /></span>
                  <span v-else class="na">—</span>
                </td>
              </VirtualList>
            </table>
          </div>
          </div>
        </template>
        <div v-else class="panel">
          <EmptyLane :title="L('没有符合条件的谱面', '条件に合う譜面がありません')">
            <button class="btn" @click="reset">{{ L('清除筛选', '条件をクリア') }}</button>
          </EmptyLane>
        </div>
        <p v-if="MISSING" class="foot t-small">
          <RouterLink to="/songs" class="link">{{ L(`另有 ${fmt(MISSING)} 张谱暂无定数`, `ほかに定数のない譜面が ${fmt(MISSING)} 件あります`) }}</RouterLink>
        </p>
      </div>

      <component :is="isWide ? 'aside' : Sheet" v-if="sel" v-bind="inspProps" @close="sheetOpen = false">
        <div class="insp-head">
          <Cover :song="sel.song" size="lg" />
          <div class="grow insp-title">
            <h2 class="t-h2 title-wrap" :title="songTitle(sel.song)">{{ songTitle(sel.song) }}</h2>
            <p class="t-caption title-1l" :lang="songSub(sel.song) ? subLang : null" :title="songSub(sel.song) || sel.song.artist || undefined">{{ songSub(sel.song) || sel.song.artist }}</p>
            <Diff :d="sel.chart.d" :star="sel.chart.star" :constant="sel.chart.constant" lg />
          </div>
        </div>

        <div class="insp-radar">
          <Radar :axes="axes" :domain="[0, 15.5]" :size="240" :label="L('谱面能力分布', '譜面の能力分布')" />
        </div>

        <h3 class="t-h3">{{ L('按准确率区分的定数', '精度帯ごとの定数') }}</h3>
        <div class="scale" role="img" :aria-label="`75% ${fx(sel.chart.c75)} / 95% ${fx(sel.chart.constant)} / 99% ${fx(sel.chart.c99)}`">
          <i class="axis" />
          <span v-for="p in scale" :key="p.key" class="tick" :class="[p.slot, { main: p.main }]" :style="{ left: p.x + '%' }">
            <span class="lb"><small>{{ p.label }}</small><b class="num">{{ fx(p.v) }}</b></span>
          </span>
        </div>

        <dl class="kv insp-kv">
          <dt>{{ L('物量', 'ノーツ数') }}</dt>
          <dd class="num">{{ fmt(sel.chart.notes) }}</dd>
          <dt>BPM</dt>
          <dd class="num">{{ sel.song.bpm }}</dd>
          <template v-for="a in CHART_AXES" :key="a.key">
            <dt class="ab-kv">{{ L(a.zh, a.ja) }}</dt>
            <dd class="num ab-kv">{{ fx(sel.chart.abilities[a.key]) }}</dd>
          </template>
          <template v-if="isReady">
            <dt>{{ L('我的成绩', '自分の記録') }}</dt>
            <dd v-if="selScore" class="mine end"><Crown :v="selScore.crown" /><Rank :v="selScore.rank" /><span class="num">{{ fx(selScore.acc) }}%</span></dd>
            <dd v-else class="na">—</dd>
          </template>
        </dl>

        <div class="insp-acts">
          <RouterLink :to="`/songs/${sel.song.id}?d=${sel.chart.d}&from=constants`" class="btn btn-primary">{{ L('打开歌曲', '楽曲を開く') }}</RouterLink>
          <RouterLink :to="`/tools/rt?song=${sel.song.id}&d=${sel.chart.d}`" class="btn">{{ L('用 RT 计算器', 'RT 計算機で開く') }}</RouterLink>
        </div>
      </component>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}
.search {
  position: relative;
  flex: 1;
  max-width: 380px;
}
.search svg {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--ink-3);
  pointer-events: none;
}
.search .input {
  padding-left: 38px;
}
.count {
  margin-left: auto;
  white-space: nowrap;
}
.count b {
  font-size: var(--fs-16);
  color: var(--ink);
}
.filters {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 0 16px;
  padding: 4px 0;
  scrollbar-width: none;
}
.filters::-webkit-scrollbar {
  display: none;
}
.filters > * {
  flex: none;
}
.dcol {
  color: var(--c);
}
.sep {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--line-strong);
}
.chip.num {
  font-size: var(--fs-14);
}
.msort {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
}
.msort .select {
  flex: 1;
  min-width: 0;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}
.foot {
  margin-top: 14px;
}

/* ---------- 表格：定高行（--row-h：舒适 52px / 紧凑 42px），分隔线画在单元格内部 ---------- */
.ctable th {
  top: var(--bar-h);
  padding-left: 8px;
  padding-right: 8px;
}
.ctable td {
  height: var(--row-h, 52px);
  padding: 0 8px;
  border-bottom: 0;
  box-shadow: inset 0 -1px 0 var(--line);
  white-space: nowrap;
}
.ctable th:first-child,
.ctable td:first-child {
  padding-left: 16px;
}
.ctable th:first-child {
  border-top-left-radius: var(--r-panel);
}
.ctable th:last-child,
.ctable td:last-child {
  padding-right: 16px;
}
.ctable th:last-child {
  border-top-right-radius: var(--r-panel);
}
.ctable .song {
  width: 100%;
  max-width: 0;
}
.rowbtn {
  display: block;
  width: 100%;
  text-align: left;
  border-radius: var(--r-ctl);
}
.ctable tr.is-sel td {
  background: color-mix(in srgb, var(--ka) 9%, var(--surface));
}
.ctable tr.is-sel td.song {
  box-shadow: inset 3px 0 0 var(--ka), inset 0 -1px 0 var(--line);
}
.ctable td .num {
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.ctable td.main-col .num {
  font-size: var(--fs-16);
  color: var(--don-ink);
  font-weight: 700;
}
.ctable td.sorted:not(.main-col) .num {
  color: var(--ink);
  font-weight: 700;
}
.ab {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  width: 40px;
  line-height: 1.2;
}
.ab-bar {
  display: block;
  width: 100%;
  height: 3px;
  border-radius: 2px;
  background: var(--bg-sunk);
  overflow: hidden;
}
.ab-bar span {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: var(--ka);
}
.mine {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.mine.end {
  justify-content: flex-end;
}
/* 最小宽度 = 其余列 + 歌曲列至少 160px；放不下时首列固定、面板内横滑 */
.ctable {
  min-width: 860px;
}
.ctable.no-mine {
  min-width: 780px;
}
.tablewrap.overflow {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.tablewrap.overflow .ctable th {
  top: 0;
}
.tablewrap.overflow .song {
  min-width: 200px;
  max-width: 200px;
}
.tablewrap.overflow tr.is-sel td.song {
  background: color-mix(in srgb, var(--ka) 9%, var(--surface));
  box-shadow: inset 3px 0 0 var(--ka), inset -1px 0 0 var(--line-strong), inset 0 -1px 0 var(--line);
}

/* ---------- 检视栏 ---------- */
.insp {
  position: sticky;
  top: calc(var(--bar-h) + 16px);
  max-height: calc(100dvh - var(--bar-h) - 32px);
  padding: 20px;
  overflow-y: auto;
}
.insp-head {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}
.insp-title {
  min-width: 0;
}
.insp-head .t-caption {
  margin: 2px 0 8px;
}
.insp-radar {
  display: grid;
  place-items: center;
  margin: 8px 0 4px;
}
.scale {
  position: relative;
  height: 104px;
  margin-top: 6px;
}
.axis {
  position: absolute;
  left: 0;
  right: 0;
  top: 50px;
  height: 2px;
  border-radius: 1px;
  background: var(--line-strong);
}
.tick {
  position: absolute;
  top: 0;
  width: 0;
  height: 100%;
}
.tick::before {
  content: '';
  position: absolute;
  left: -1px;
  top: 40px;
  width: 2px;
  height: 22px;
  border-radius: 1px;
  background: var(--ink-3);
}
.tick.main::before {
  left: -1.5px;
  width: 3px;
  background: var(--don);
}
.lb {
  position: absolute;
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  white-space: nowrap;
}
.lb small {
  font-size: var(--fs-11);
  color: var(--ink-3);
}
.lb b {
  font-size: var(--fs-18);
}
.tick.main .lb b {
  color: var(--don-ink);
}
.tick.lo .lb {
  right: 7px;
  top: 4px;
  align-items: flex-end;
}
.tick.hi .lb {
  left: 7px;
  top: 4px;
}
.tick.mid .lb {
  left: 0;
  top: 66px;
  transform: translateX(-50%);
  align-items: center;
}
.insp-kv {
  margin-top: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}
.insp-kv .num {
  font-size: var(--fs-16);
}
.insp-acts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 18px;
}

/* 列优先级（V11）：≥1240 全部；1100–1239 隐藏 75% / 99%；768–1099 再隐藏五项能力值（检视栏里仍有） */
@media (min-width: 1240px) {
  .layout {
    grid-template-columns: minmax(0, 1fr) 328px;
  }
}
@media (max-width: 1239px) {
  .alt-col {
    display: none;
  }
  .ctable {
    min-width: 740px;
  }
  .ctable.no-mine {
    min-width: 660px;
  }
}
@media (max-width: 1099px) {
  .ab-col {
    display: none;
  }
  .ctable {
    min-width: 470px;
  }
  .ctable.no-mine {
    min-width: 390px;
  }
}

/* ---------- 手机：专用列表行 ---------- */
@media (max-width: 767px) {
  .toolbar {
    flex-wrap: wrap;
  }
  .search {
    flex: 1 0 100%;
    max-width: none;
  }
  .count {
    margin-left: 0;
    margin-right: auto;
  }
  .filters {
    margin: 12px calc(var(--gutter) * -1);
    padding: 4px var(--gutter);
  }
  .mlist {
    display: block;
    border-top: 1px solid var(--line-strong);
  }
  .mrow {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    height: 100%;
    border-bottom: 1px solid var(--line);
    text-align: left;
    color: var(--ink-3);
  }
  .mrow[aria-pressed='true'] {
    background: color-mix(in srgb, var(--ka) 9%, var(--surface));
  }
  .mbody {
    min-width: 0;
  }
  .mt {
    font-weight: 700;
    color: var(--ink);
  }
  .mmeta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }
  .mmeta :deep(.mcrown) {
    gap: 4px;
    white-space: nowrap;
  }
  .mmeta :deep(.mcrown .crown-label) {
    font-size: var(--fs-12);
    color: var(--ink-2);
  }
  .mmeta b {
    color: var(--ink);
    font-size: var(--fs-14);
  }
  .mk {
    font-size: var(--fs-28);
    font-weight: 700;
    line-height: 1;
    color: var(--don-ink);
  }
}
</style>
