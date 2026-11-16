<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import Icon from '../components/Icon.vue'
import SongCell from '../components/SongCell.vue'
import Cover from '../components/Cover.vue'
import Diff from '../components/Diff.vue'
import Crown from '../components/Crown.vue'
import Rank from '../components/Rank.vue'
import Radar from '../components/Radar.vue'
import Sheet from '../components/Sheet.vue'
import EmptyLane from '../components/EmptyLane.vue'
import { songs, scoreOf, CHART_AXES, fmt, fx } from '../mock/data'
import { L, isJa, isReady, songTitle, songSub, subLang, toast } from '../store'

// 每张带定数的谱面一行
const ALL = songs.flatMap((s) => s.charts.filter((c) => c.constant != null).map((c) => ({ key: `${s.id}-${c.d}`, song: s, chart: c, score: scoreOf(s.id, c.d) || null })))

const DIFF_CHIPS = [
  { d: 3, zh: '困难', ja: 'むずかしい', color: 'var(--diff-hard)' },
  { d: 4, zh: '魔王', ja: 'おに', color: 'var(--diff-oni)' },
  { d: 5, zh: '里', ja: '裏', color: 'var(--diff-ura)' },
]
const RANGES = [
  { key: 'a', label: '≥ 13', test: (c) => c >= 13 },
  { key: 'b', label: '12 – 13', test: (c) => c >= 12 && c < 13 },
  { key: 'c', label: '11 – 12', test: (c) => c >= 11 && c < 12 },
  { key: 'd', label: '10 – 11', test: (c) => c >= 10 && c < 11 },
  { key: 'e', label: '< 10', test: (c) => c < 10 },
]

const q = ref('')
const diffs = ref([])
const range = ref(null)
const noFc = ref(false)
const sortKey = ref('constant')
const sortDir = ref(-1)

const numCols = computed(() => [
  { key: 'constant', label: L('主定数', '主定数'), cls: 'main-col' },
  { key: 'c75', label: '75%', cls: 'alt-col' },
  { key: 'c99', label: '99%', cls: 'alt-col' },
  { key: 'notes', label: L('物量', 'ノーツ数'), cls: '' },
  ...CHART_AXES.map((a) => ({ key: a.key, label: L(a.zh, a.ja), cls: 'ab-col', ab: true })),
])
const sortOptions = computed(() => [{ key: 'title', label: L('曲名', '曲名') }, ...numCols.value])

function val(r, k) {
  if (k === 'title') return songTitle(r.song)
  if (k === 'd') return r.chart.d * 100 + r.chart.star
  return k in r.chart.abilities ? r.chart.abilities[k] : r.chart[k]
}
function sortBy(k) {
  if (sortKey.value === k) sortDir.value *= -1
  else {
    sortKey.value = k
    sortDir.value = k === 'title' ? 1 : -1
  }
}
const ariaSort = (k) => (sortKey.value === k ? (sortDir.value === 1 ? 'ascending' : 'descending') : undefined)
const arrow = computed(() => (sortDir.value === 1 ? 'chevU' : 'chevD'))

const rows = computed(() => {
  const kw = q.value.trim().toLowerCase()
  const rg = RANGES.find((x) => x.key === range.value)
  const out = ALL.filter((r) => {
    if (kw && !`${r.song.ja} ${r.song.zh} ${r.song.artist} ${r.song.id}`.toLowerCase().includes(kw)) return false
    if (diffs.value.length && !diffs.value.includes(r.chart.d)) return false
    if (rg && !rg.test(r.chart.constant)) return false
    if (noFc.value && isReady.value && r.score && r.score.crown >= 1) return false
    return true
  })
  const k = sortKey.value
  const dir = sortDir.value
  return out.sort((a, b) => {
    const x = val(a, k)
    const y = val(b, k)
    const c = typeof x === 'string' ? x.localeCompare(y, 'ja') : x - y
    return c * dir || b.chart.constant - a.chart.constant
  })
})
const filtered = computed(() => !!q.value.trim() || diffs.value.length > 0 || range.value != null || noFc.value)
function toggleDiff(d) {
  diffs.value = diffs.value.includes(d) ? diffs.value.filter((x) => x !== d) : [...diffs.value, d]
}
function reset() {
  q.value = ''
  diffs.value = []
  range.value = null
  noFc.value = false
}
function exportCsv() {
  toast(L(`已导出 ${rows.value.length} 行：taiko-constants-v2.csv`, `${rows.value.length} 行を書き出しました：taiko-constants-v2.csv`))
}

// 选中行：宽屏显示在右侧检视栏，其余尺寸用弹层
const mq = window.matchMedia('(min-width: 1240px)')
const wide = ref(mq.matches)
const onMq = (e) => (wide.value = e.matches)
mq.addEventListener('change', onMq)
onBeforeUnmount(() => mq.removeEventListener('change', onMq))

const selKey = ref(null)
const sheetOpen = ref(false)
const sel = computed(() => rows.value.find((r) => r.key === selKey.value) || rows.value[0] || null)
function pick(r) {
  selKey.value = r.key
  if (!wide.value) sheetOpen.value = true
}
const inspProps = computed(() => (wide.value ? { class: 'insp panel' } : { open: sheetOpen.value, title: L('谱面定数', '譜面の定数'), width: 440 }))

const axes = computed(() => CHART_AXES.map((a) => ({ key: a.key, label: L(a.zh, a.ja), value: sel.value.chart.abilities[a.key] })))
// 三个定数在同一条刻度线上的位置；标签按数值高低分到左上 / 下方 / 右上，保证不重叠
const scale = computed(() => {
  const c = sel.value.chart
  const pts = [
    { key: 'c75', label: '75%', v: c.c75 },
    { key: 'c95', label: '95%', v: c.constant, main: true },
    { key: 'c99', label: '99%', v: c.c99 },
  ]
  const lo = Math.min(...pts.map((p) => p.v))
  const hi = Math.max(...pts.map((p) => p.v))
  const pad = Math.max(0.12, (hi - lo) * 0.3)
  const order = [...pts].sort((a, b) => a.v - b.v)
  return pts.map((p) => ({ ...p, x: ((p.v - lo + pad) / (hi - lo + pad * 2)) * 100, slot: ['lo', 'mid', 'hi'][order.indexOf(p)] }))
})
</script>

<template>
  <div class="page consts">
    <div class="toolbar">
      <label class="search">
        <Icon name="search" :size="18" />
        <input v-model="q" class="input" type="search" :placeholder="L('搜索曲名、曲师或 ID', '曲名・アーティスト・ID で検索')" :aria-label="L('搜索谱面', '譜面を検索')" />
      </label>
      <span class="t-small count"><b class="num">{{ rows.length }}</b> {{ L('张谱面', '譜面') }}</span>
      <button class="btn" @click="exportCsv"><Icon name="download" :size="18" />{{ L('导出 CSV', 'CSV を書き出す') }}</button>
    </div>

    <div class="filters scroll-x" role="group" :aria-label="L('筛选', '絞り込み')">
      <button v-for="c in DIFF_CHIPS" :key="c.d" class="chip" :aria-pressed="diffs.includes(c.d)" @click="toggleDiff(c.d)">
        <i class="dot" :style="{ color: c.color }" />{{ L(c.zh, c.ja) }}
      </button>
      <span class="sep" aria-hidden="true" />
      <button v-for="r in RANGES" :key="r.key" class="chip num" :aria-pressed="range === r.key" @click="range = range === r.key ? null : r.key">{{ r.label }}</button>
      <template v-if="isReady">
        <span class="sep" aria-hidden="true" />
        <button class="chip" :aria-pressed="noFc" @click="noFc = !noFc">{{ L('只看我没全连的', '未フルコンボのみ') }}</button>
      </template>
      <button v-if="filtered" class="btn btn-ghost btn-sm" @click="reset">{{ L('清除筛选', '条件をクリア') }}</button>
    </div>

    <div class="only-mobile">
      <div class="msort">
        <select v-model="sortKey" class="select" :aria-label="L('排序方式', '並び替え')">
          <option v-for="o in sortOptions" :key="o.key" :value="o.key">{{ L('按', '') }}{{ o.label }}{{ L('排序', '順') }}</option>
        </select>
        <button class="icon-btn" :aria-label="sortDir === 1 ? L('当前升序，改为降序', '昇順（降順に切り替え）') : L('当前降序，改为升序', '降順（昇順に切り替え）')" @click="sortDir *= -1">
          <Icon :name="arrow" />
        </button>
      </div>
    </div>

    <div class="layout">
      <div class="main-col">
        <template v-if="rows.length">
          <div class="panel only-desktop">
            <table class="dt ctable">
              <thead>
                <tr>
                  <th class="song" :aria-sort="ariaSort('title')">
                    <button class="song-h" @click="sortBy('title')">{{ L('歌曲', '楽曲') }}<Icon v-if="sortKey === 'title'" :name="arrow" :size="12" /></button>
                  </th>
                  <th :aria-sort="ariaSort('d')">
                    <button @click="sortBy('d')">{{ L('难度', '難易度') }}<Icon v-if="sortKey === 'd'" :name="arrow" :size="12" /></button>
                  </th>
                  <th v-for="c in numCols" :key="c.key" class="r" :class="c.cls" :aria-sort="ariaSort(c.key)">
                    <button @click="sortBy(c.key)">{{ c.label }}<Icon v-if="sortKey === c.key" :name="arrow" :size="12" /></button>
                  </th>
                  <th v-if="isReady" class="c">{{ L('我的成绩', '自分の記録') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in rows" :key="r.key" class="is-link" :class="{ on: sel && sel.key === r.key }" @click="pick(r)">
                  <td class="song">
                    <button class="rowbtn" :aria-pressed="!!sel && sel.key === r.key"><SongCell :song="r.song" size="sm" /></button>
                  </td>
                  <td><Diff :d="r.chart.d" :star="r.chart.star" short /></td>
                  <td v-for="c in numCols" :key="c.key" class="r" :class="[c.cls, { sorted: sortKey === c.key }]">
                    <span v-if="c.ab" class="ab">
                      <span class="num">{{ fx(r.chart.abilities[c.key]) }}</span>
                      <span class="ab-bar"><span :style="{ width: (r.chart.abilities[c.key] / 15.5) * 100 + '%' }" /></span>
                    </span>
                    <span v-else class="num">{{ c.key === 'notes' ? fmt(r.chart.notes) : fx(r.chart[c.key]) }}</span>
                  </td>
                  <td v-if="isReady" class="c">
                    <span v-if="r.score" class="mine"><Crown :v="r.score.crown" /><Rank :v="r.score.rank" /></span>
                    <span v-else class="faint">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="only-mobile">
            <ul class="mlist">
              <li v-for="r in rows" :key="r.key">
                <button class="mrow" @click="pick(r)">
                  <Cover :song="r.song" />
                  <span class="grow">
                    <span class="mt truncate">{{ songTitle(r.song) }}</span>
                    <span class="mmeta">
                      <Diff :d="r.chart.d" :star="r.chart.star" short />
                      <Crown v-if="isReady && r.score" :v="r.score.crown" size="sm" />
                      <span v-if="!['constant', 'title', 'd'].includes(sortKey)" class="t-caption">
                        {{ sortOptions.find((o) => o.key === sortKey).label }} <b class="num">{{ sortKey === 'notes' ? fmt(val(r, sortKey)) : fx(val(r, sortKey)) }}</b>
                      </span>
                    </span>
                  </span>
                  <b class="num mk">{{ fx(r.chart.constant) }}</b>
                  <Icon name="chevR" :size="16" />
                </button>
              </li>
            </ul>
          </div>
        </template>
        <div v-else class="panel">
          <EmptyLane :title="L('没有符合条件的谱面', '条件に合う譜面がありません')">
            <button class="btn" @click="reset">{{ L('清除筛选', '条件をクリア') }}</button>
          </EmptyLane>
        </div>
      </div>

      <component :is="wide ? 'aside' : Sheet" v-if="sel" v-bind="inspProps" @close="sheetOpen = false">
        <div class="insp-head">
          <Cover :song="sel.song" size="lg" />
          <div class="grow">
            <h2 class="t-h2">{{ songTitle(sel.song) }}</h2>
            <p class="t-caption truncate" :lang="songSub(sel.song) ? subLang : null">{{ songSub(sel.song) || sel.song.artist }}</p>
            <Diff :d="sel.chart.d" :star="sel.chart.star" :constant="sel.chart.constant" lg />
          </div>
        </div>

        <div class="insp-radar">
          <Radar :axes="axes" :domain="[0, 15.5]" :size="250" />
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
          <template v-if="isReady">
            <dt>{{ L('我的成绩', '自分の記録') }}</dt>
            <dd v-if="sel.score" class="mine end"><Crown :v="sel.score.crown" /><Rank :v="sel.score.rank" /><span class="num">{{ fx(sel.score.acc) }}%</span></dd>
            <dd v-else class="faint">{{ L('未游玩', '未プレイ') }}</dd>
          </template>
        </dl>

        <div class="insp-acts">
          <RouterLink :to="`/songs/${sel.song.id}?d=${sel.chart.d}`" class="btn btn-primary">{{ L('打开歌曲', '楽曲を開く') }}</RouterLink>
          <RouterLink to="/tools/rt" class="btn">{{ L('用 RT 计算器', 'RT 計算機で開く') }}</RouterLink>
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
  padding: 2px 0;
  scrollbar-width: none;
}
.filters::-webkit-scrollbar {
  display: none;
}
.filters > * {
  flex: none;
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
  gap: 4px;
  margin-bottom: 12px;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

/* ---------- 表格 ---------- */
.ctable th {
  top: var(--bar-h);
  padding-left: 8px;
  padding-right: 8px;
}
.ctable td {
  padding: 6px 8px;
}
.ctable th:first-child {
  padding-left: 16px;
  border-top-left-radius: var(--r-panel);
}
.ctable td:first-child {
  padding-left: 16px;
}
.ctable th:last-child {
  padding-right: 16px;
  border-top-right-radius: var(--r-panel);
}
.ctable td:last-child {
  padding-right: 16px;
}
.ctable th.song {
  width: 100%;
}
.song-h {
  min-width: 168px;
}
.ctable td.song {
  max-width: 0;
}
.rowbtn {
  display: block;
  width: 100%;
  text-align: left;
  border-radius: var(--r-ctl);
}
.ctable tr.on {
  background: color-mix(in srgb, var(--ka) 9%, var(--surface));
}
.ctable tr.on td:first-child {
  box-shadow: inset 3px 0 0 var(--ka);
}
.ctable td .num {
  font-size: var(--fs-16);
  color: var(--ink-2);
}
.ctable td.main-col .num,
.ctable td.sorted .num {
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

@media (min-width: 1240px) {
  .layout {
    grid-template-columns: minmax(0, 1fr) 328px;
  }
}
@media (min-width: 1240px) and (max-width: 1439px) {
  .alt-col {
    display: none;
  }
}
@media (max-width: 1099px) {
  .ab-col {
    display: none;
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
    padding: 2px var(--gutter);
  }
  .mlist {
    border-top: 1px solid var(--line-strong);
  }
  .mrow {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 10px 0;
    border-bottom: 1px solid var(--line);
    text-align: left;
    color: var(--ink-3);
  }
  .mt {
    display: block;
    font-weight: 700;
    color: var(--ink);
  }
  .mmeta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }
  .mmeta b {
    color: var(--ink);
    font-size: var(--fs-14);
  }
  .mk {
    font-size: var(--fs-28);
    font-weight: 700;
    line-height: 1;
    color: var(--ink);
  }
}
</style>
