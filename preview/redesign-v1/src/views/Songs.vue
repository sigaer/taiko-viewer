<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../components/Icon.vue'
import SongCell from '../components/SongCell.vue'
import Cover from '../components/Cover.vue'
import Crown from '../components/Crown.vue'
import Rank from '../components/Rank.vue'
import Sheet from '../components/Sheet.vue'
import EmptyLane from '../components/EmptyLane.vue'
import VirtualList from '../components/VirtualList.vue'
import { songs, GENRES, DIFFS, scoreOf, chartOf, fmt } from '../mock/data'
import { L, isReady, songTitle, songSub, subLang, store, ensureSearch } from '../store'
import { matchSongIds } from '../search'
import { useHScroll } from '../hscroll'
import { useQueryState } from '../routeState'
import { isMobile, isTablet } from '../breakpoints'

// 曲库：上架状态是筛选条件。桌面 / 平板：左侧分面 + 虚拟滚动表格；手机：搜索 + 横向筛选条 + 虚拟滚动列表，完整筛选进底部抽屉。
// 所有筛选、排序、视图都写进地址（R2）；长列表用 VirtualList，挂载行数 ≤ 60（M6）。
const router = useRouter()

// 上架状态（I8）：第一项「全部」写作 shelf=all；默认「实装歌曲」不写进地址
const SHELF = [
  { v: 'all', zh: '全部', ja: 'すべて' },
  { v: '0', zh: '实装歌曲', ja: '稼働中' },
  { v: '1', zh: '国行未上架', ja: '中国版未収録' },
  { v: '2', zh: '其他歌曲', ja: 'その他' },
]
const STARS = ['10', '9', '8', '7', '6']
const CROWN_F = [
  { v: 'all', zh: '全部', ja: 'すべて' },
  { v: 'unplayed', zh: '没打过', ja: '未プレイ' },
  { v: 'nofc', zh: '还没全连', ja: '未フルコン' },
  { v: 'nodfc', zh: '还没全良', ja: '未全良' },
]
const SORTS = [
  { v: 'open', zh: '上架日期', ja: '収録日', dir: 'desc' },
  { v: 'title', zh: '曲名', ja: '曲名', dir: 'asc' },
  { v: 'const', zh: '魔王定数', ja: 'おに定数', dir: 'desc' },
  { v: 'bpm', zh: 'BPM', ja: 'BPM', dir: 'desc' },
]
const GENRE_KEYS = Object.keys(GENRES)

const f = useQueryState({
  q: { type: 'string', default: '', debounce: 250 },
  shelf: { type: 'string', default: '0', values: SHELF.map((s) => s.v) },
  genre: { type: 'set', default: [], values: GENRE_KEYS },
  star: { type: 'set', default: [], values: STARS },
  ura: { type: 'boolean', default: false },
  crown: { type: 'string', default: 'all', values: CROWN_F.map((c) => c.v) },
  sort: { type: 'string', default: 'open', values: SORTS.map((s) => s.v) },
  dir: { type: 'string', default: 'desc', values: ['asc', 'desc'] },
  view: { type: 'string', default: 'table', values: ['table', 'grid'] },
})
const sheetOpen = ref(false)
// C4：手机与平板（≤1099）用一行常用筛选 + 「筛选」按钮，完整分面放进对话框（平板居中、手机底部抽屉）
const chipFilters = computed(() => isMobile.value || isTablet.value)

// 每首歌只算一次：排序用的数值
const IDX = songs.map((s) => {
  const c4 = chartOf(s.id, 4)
  return {
    s,
    id: s.id,
    shelf: String(s.shelf),
    bpm: parseFloat(String(s.bpm).split('-').pop()) || 0,
    c4: c4?.constant ?? null,
    hasUra: s.levels[4] != null,
  }
})

// 关键词匹配与命令面板同一个函数（src/search.js 的 matchSongIds：NFKC、假名互通、拉丁词首规则），
// 所以面板里「在曲库中查看全部 N 首」的 N 与这里 shelf=all 时的行数一致（I8）
// 索引在第一次有关键词时才建立，不压在首次进入页面上（R6）
const matched = computed(() => {
  if (!f.q.trim()) return null
  ensureSearch()
  return matchSongIds(f.q)
})
const toggleSet = (key, v) => (f[key] = f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v])
const activeCount = computed(() => f.genre.length + f.star.length + (f.ura ? 1 : 0) + (f.crown !== 'all' ? 1 : 0))
function clear() {
  f.genre = []
  f.star = []
  f.ura = false
  f.crown = 'all'
  f.q = ''
}

function crownOk(id) {
  if (f.crown === 'all' || !isReady.value) return true
  const sc = scoreOf(id, 4)
  if (f.crown === 'unplayed') return !sc
  if (f.crown === 'nofc') return !sc || sc.crown < 1
  return !sc || sc.crown < 2
}

// 一次遍历：结果 + 上架状态计数（不含上架条件）+ 流派计数（不含流派条件）
const pass = computed(() => {
  const m = matched.value
  const genres = f.genre.length ? new Set(f.genre) : null
  const stars = f.star.length ? new Set(f.star.map(Number)) : null
  const shelfN = { all: 0, 0: 0, 1: 0, 2: 0 }
  const genreN = Object.fromEntries(GENRE_KEYS.map((k) => [k, 0]))
  const out = []
  for (const x of IDX) {
    const s = x.s
    if (m && !m.has(s.id)) continue
    if (stars && !stars.has(s.levels[3]) && !stars.has(s.levels[4])) continue
    if (f.ura && !x.hasUra) continue
    if (!crownOk(s.id)) continue
    const mShelf = f.shelf === 'all' || x.shelf === f.shelf
    const mGenre = !genres || genres.has(s.genre)
    if (mGenre) {
      shelfN[x.shelf] = (shelfN[x.shelf] || 0) + 1
      shelfN.all++
    }
    if (mShelf) genreN[s.genre] = (genreN[s.genre] || 0) + 1
    if (mShelf && mGenre) out.push(x)
  }
  return { out, shelfN, genreN }
})

const collator = computed(() => new Intl.Collator(store.locale === 'ja' ? 'ja' : 'zh'))
const rows = computed(() => {
  const list = [...pass.value.out]
  const k = f.sort
  const dir = f.dir === 'asc' ? 1 : -1
  if (k === 'title') {
    const col = collator.value
    const tt = new Map(list.map((x) => [x.s.id, songTitle(x.s)]))
    list.sort((a, b) => col.compare(tt.get(a.s.id), tt.get(b.s.id)) * dir)
  } else if (k === 'open') list.sort((a, b) => (a.s.openDay < b.s.openDay ? -1 : a.s.openDay > b.s.openDay ? 1 : 0) * dir || a.s.id - b.s.id)
  else {
    // 没有定数的歌总排在最后
    const v = (x) => (k === 'bpm' ? x.bpm : x.c4)
    list.sort((a, b) => {
      const x = v(a)
      const y = v(b)
      if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1
      return (x - y) * dir || a.s.id - b.s.id
    })
  }
  return list
})

function sortBy(key) {
  if (f.sort === key) f.dir = f.dir === 'asc' ? 'desc' : 'asc'
  else {
    f.sort = key
    f.dir = SORTS.find((s) => s.v === key).dir
  }
}
const ariaSort = (key) => (f.sort === key ? (f.dir === 'asc' ? 'ascending' : 'descending') : 'none')
const songLink = (s) => `/songs/${s.id}?from=songs`
const open = (s) => router.push(songLink(s))
function onRowClick(e, s) {
  if (e.target.closest('a, button')) return
  open(s)
}
// 行状态与整行点击挂在 <tr> 上（VirtualList 的 rowClass / rowAttrs，I5），不在每个单元格重复
const rowAttrs = (x) => ({ onClick: (e) => onRowClick(e, x.s) })

// 列表密度（V11 / I10）：虚拟列表的定高行跟随 store.density
const rowH = computed(() => (store.density === 'compact' ? 44 : 56))

// 我的：魔王与里各一组
const mineOf = (s, d) => (s.levels[d - 1] == null ? 'nochart' : scoreOf(s.id, d) || null)

// ---------- 结果集变化时回到列表开头（只在已经滚过列表开头时） ----------
const listStart = ref(null)
watch(
  () => [f.q, f.shelf, f.genre.join(), f.star.join(), f.ura, f.crown, f.sort, f.dir, f.view].join('|'),
  () => {
    nextTick(() => {
      const el = listStart.value
      if (!el) return
      const offset = (isMobile.value ? 52 : 60) + 12
      const y = el.getBoundingClientRect().top + window.scrollY - offset
      if (window.scrollY > y + 1) window.scrollTo({ top: Math.max(0, y), behavior: 'auto' })
    })
  },
)

// ---------- 表格：放不下时首列固定、表格内部横滑，右缘渐隐提示还有内容（I13） ----------
const tableWrap = ref(null)
const tableEl = ref(null)
const { overflow, moreRight } = useHScroll(tableWrap, tableEl)

// ---------- 封面视图：每次 120 首 ----------
const PAGE = 120
const limit = ref(PAGE)
const gridRows = computed(() => rows.value.slice(0, limit.value))
watch(rows, () => (limit.value = PAGE))
const more = () => (limit.value += PAGE)
const sentinel = ref(null)
let io = null
watch(sentinel, (el, old) => {
  if (!io && typeof IntersectionObserver !== 'undefined')
    io = new IntersectionObserver((ents) => ents.some((e) => e.isIntersecting) && limit.value < rows.value.length && more(), { rootMargin: '400px 0px' })
  if (old && io) io.unobserve(old)
  if (el && io) io.observe(el)
})

onBeforeUnmount(() => {
  io?.disconnect()
  io = null
})

const showGrid = computed(() => f.view === 'grid' && !isMobile.value)
const countText = computed(() => L(`${fmt(rows.value.length)} 首`, `${fmt(rows.value.length)} 曲`))
const fx2 = (n) => (n == null ? null : n.toFixed(2))
</script>

<template>
  <div class="page songs">
    <div class="layout">
      <!-- 分面筛选（桌面 / 平板） -->
      <aside class="facets only-desktop" :aria-label="L('筛选', '絞り込み')">
        <div class="facet" role="group" :aria-label="L('上架状态', '収録状況')">
          <h2 class="fh" aria-hidden="true">{{ L('上架状态', '収録状況') }}</h2>
          <button v-for="s in SHELF" :key="s.v" class="fopt" :aria-pressed="f.shelf === s.v" @click="f.shelf = s.v">
            <span class="title-1l">{{ L(s.zh, s.ja) }}</span><span class="num">{{ fmt(pass.shelfN[s.v] || 0) }}</span>
          </button>
        </div>
        <div class="facet" role="group" :aria-label="L('流派', 'ジャンル')">
          <h2 class="fh" aria-hidden="true">{{ L('流派', 'ジャンル') }}</h2>
          <button v-for="(g, key) in GENRES" :key="key" class="fopt" :aria-pressed="f.genre.includes(key)" @click="toggleSet('genre', key)">
            <span class="fl"><i class="dot" :style="{ color: g.color }" /><span class="title-1l">{{ L(g.zh, g.ja) }}</span></span><span class="num">{{ fmt(pass.genreN[key]) }}</span>
          </button>
        </div>
        <div class="facet" role="group" :aria-label="L('魔王星级', 'おに ★')">
          <h2 class="fh" aria-hidden="true">{{ L('魔王星级', 'おに ★') }}</h2>
          <div class="row-wrap">
            <button v-for="s in STARS" :key="s" class="chip num" :aria-pressed="f.star.includes(s)" @click="toggleSet('star', s)">★{{ s }}</button>
          </div>
          <label class="check"><input v-model="f.ura" type="checkbox" />{{ L('只看有里谱的', '裏譜面あり') }}</label>
        </div>
        <div v-if="isReady" class="facet" role="group" :aria-label="L('我的进度', '自分の進捗')">
          <h2 class="fh" aria-hidden="true">{{ L('我的进度（魔王）', '自分の進捗（おに）') }}</h2>
          <button v-for="c in CROWN_F" :key="c.v" class="fopt" :aria-pressed="f.crown === c.v" @click="f.crown = c.v"><span>{{ L(c.zh, c.ja) }}</span></button>
        </div>
      </aside>

      <div class="main">
        <div class="toolbar">
          <label class="search">
            <Icon name="search" :size="18" />
            <input v-model="f.q" class="sinput" type="search" :aria-label="L('在曲库里搜索', '楽曲を検索')" :placeholder="L('曲名、别名、艺术家或 ID', '曲名・別名・アーティスト・ID')" />
            <button v-if="f.q" class="icon-btn" :aria-label="L('清空关键词', 'キーワードをクリア')" @click="f.q = ''"><Icon name="close" :size="16" /></button>
          </label>
          <span class="count t-small" role="status"><b class="num">{{ fmt(rows.length) }}</b> {{ L('首', '曲') }}</span>
          <div class="seg only-desktop" role="group" :aria-label="L('视图', '表示')">
            <button :aria-pressed="f.view === 'table'" :aria-label="L('表格', 'テーブル')" @click="f.view = 'table'"><Icon name="rows" :size="16" /></button>
            <button :aria-pressed="f.view === 'grid'" :aria-label="L('封面', 'カバー')" @click="f.view = 'grid'"><Icon name="grid" :size="16" /></button>
          </div>
        </div>

        <!-- 手机 / 平板：快捷筛选条 -->
        <div v-if="chipFilters" class="mfilters" role="group" :aria-label="L('快捷筛选', 'クイック絞り込み')">
          <button class="chip" :aria-pressed="activeCount > 0" @click="sheetOpen = true">
            <Icon name="filter" :size="14" />{{ L('筛选', '絞り込み') }}<b v-if="activeCount" class="num badge">{{ activeCount }}</b>
          </button>
          <button v-for="s in SHELF" :key="s.v" class="chip" :aria-pressed="f.shelf === s.v" @click="f.shelf = s.v">{{ L(s.zh, s.ja) }}</button>
          <button v-for="s in STARS.slice(0, 3)" :key="s" class="chip num" :aria-pressed="f.star.includes(s)" @click="toggleSet('star', s)">★{{ s }}</button>
          <button class="chip" :aria-pressed="f.ura" @click="f.ura = !f.ura">{{ L('有里谱', '裏あり') }}</button>
        </div>

        <div ref="listStart" class="list-start" aria-hidden="true" />

        <div v-if="!rows.length" class="panel">
          <EmptyLane :title="L('没有符合条件的歌曲', '条件に合う楽曲がありません')" :text="L('换一个关键词，或者放宽筛选条件。', 'キーワードを変えるか、条件をゆるめてください。')">
            <button class="btn" @click="clear">{{ L('清除全部筛选', '絞り込みをクリア') }}</button>
          </EmptyLane>
        </div>

        <!-- 手机：虚拟滚动列表 -->
        <VirtualList v-else-if="isMobile" tag="ul" row-tag="li" class="mlist" :items="rows" :row-height="88" key-field="id" v-slot="{ item: x }">
          <RouterLink :to="songLink(x.s)" class="mrow">
            <Cover :song="x.s" size="lg" />
            <span class="grow mbody">
              <b class="title-1l mt" :title="songTitle(x.s)">{{ songTitle(x.s) }}</b>
              <span class="title-1l t-caption" :lang="songSub(x.s) ? subLang : null" :title="songSub(x.s) || x.s.artist || undefined">{{ songSub(x.s) || x.s.artist || '' }}</span>
              <span class="pips">
                <span v-for="d in 5" :key="d" class="star-pip" :class="[DIFFS[d].key, { off: x.s.levels[d - 1] == null }]">{{ x.s.levels[d - 1] ?? '' }}</span>
                <b v-if="x.c4 != null" class="num k">{{ fx2(x.c4) }}</b>
                <span v-else class="na k">—</span>
              </span>
            </span>
            <span v-if="isReady" class="mmine">
              <template v-for="d in [4, 5]" :key="d">
                <span v-if="mineOf(x.s, d) !== 'nochart'" class="mm">
                  <span class="sr-only">{{ L(DIFFS[d].zh, DIFFS[d].ja) }}</span>
                  <template v-if="mineOf(x.s, d)"><Crown :v="mineOf(x.s, d).crown" size="sm" /><Rank :v="mineOf(x.s, d).rank" /></template>
                  <span v-else class="na">—</span>
                </span>
              </template>
            </span>
          </RouterLink>
        </VirtualList>

        <!-- 桌面 / 平板：封面视图（每次 120 首） -->
        <template v-else-if="showGrid">
          <ul class="grid">
            <li v-for="x in gridRows" :key="x.s.id">
              <RouterLink :to="songLink(x.s)" class="gitem">
                <Cover :song="x.s" size="fill" />
                <b class="title-1l" :title="songTitle(x.s)">{{ songTitle(x.s) }}</b>
                <span class="gmeta">
                  <span class="star-pip oni">{{ x.s.levels[3] }}</span>
                  <span v-if="x.hasUra" class="star-pip ura">{{ x.s.levels[4] }}</span>
                  <span v-if="x.c4 != null" class="num">{{ fx2(x.c4) }}</span>
                  <span v-else class="na">—</span>
                </span>
              </RouterLink>
            </li>
          </ul>
          <div v-if="limit < rows.length" ref="sentinel" class="more">
            <button class="btn" @click="more">{{ L('再显示 120 首', 'さらに 120 曲表示') }}</button>
            <span class="t-caption">{{ L(`已显示 ${fmt(limit)} / ${fmt(rows.length)}`, `${fmt(rows.length)} 曲中 ${fmt(limit)} 曲を表示`) }}</span>
          </div>
        </template>

        <!-- 桌面 / 平板：虚拟滚动表格 -->
        <div v-else class="hs" :class="{ 'hs-more': moreRight }">
        <div ref="tableWrap" class="panel tablewrap" :class="{ overflow }">
          <table ref="tableEl" class="dt lib" :class="{ 'no-mine': !isReady }" :style="{ '--row-h': rowH + 'px' }">
            <caption class="sr-only">{{ L('曲库', '楽曲一覧') }} · {{ countText }}</caption>
            <thead>
              <tr>
                <th scope="col" class="c-title" :class="{ 'dt-sticky-col': overflow }" :aria-sort="ariaSort('title')">
                  <button @click="sortBy('title')">{{ L('歌曲', '楽曲') }}<Icon v-if="f.sort === 'title'" :name="f.dir === 'asc' ? 'chevU' : 'chevD'" :size="12" /></button>
                </th>
                <th scope="col" class="c-genre">{{ L('流派', 'ジャンル') }}</th>
                <th scope="col" class="r c-bpm" :aria-sort="ariaSort('bpm')">
                  <button @click="sortBy('bpm')">BPM<Icon v-if="f.sort === 'bpm'" :name="f.dir === 'asc' ? 'chevU' : 'chevD'" :size="12" /></button>
                </th>
                <th v-for="d in 5" :key="d" scope="col" class="c lv"><abbr :title="L(DIFFS[d].zh, DIFFS[d].ja)">{{ L(DIFFS[d].short, DIFFS[d].shortJa) }}</abbr></th>
                <th scope="col" class="r c-const" :aria-sort="ariaSort('const')">
                  <button @click="sortBy('const')">{{ L('魔王定数', 'おに定数') }}<Icon v-if="f.sort === 'const'" :name="f.dir === 'asc' ? 'chevU' : 'chevD'" :size="12" /></button>
                </th>
                <th v-if="isReady" scope="col" class="c-mine">
                  <span class="mine-h"><span>{{ L('我的', '自分') }}</span><span class="mh">{{ L('鬼', '鬼') }}</span><span class="mh">{{ L('里', '裏') }}</span></span>
                </th>
                <th scope="col" class="r c-shelf" :aria-sort="ariaSort('open')">
                  <button @click="sortBy('open')">{{ L('上架', '収録日') }}<Icon v-if="f.sort === 'open'" :name="f.dir === 'asc' ? 'chevU' : 'chevD'" :size="12" /></button>
                </th>
              </tr>
            </thead>
            <VirtualList tag="tbody" row-tag="tr" :items="rows" :row-height="rowH" key-field="id" :colspan="isReady ? 11 : 10" row-class="is-link" :row-attrs="rowAttrs" v-slot="{ item: x }">
              <td class="c-title" :class="{ 'dt-sticky-col': overflow }">
                <RouterLink :to="songLink(x.s)" class="rowlink"><SongCell :song="x.s" /></RouterLink>
              </td>
              <td class="c-genre">
                <span class="genre"><i class="dot" :style="{ color: GENRES[x.s.genre].color }" /><span class="title-1l" :title="L(GENRES[x.s.genre].zh, GENRES[x.s.genre].ja)">{{ L(GENRES[x.s.genre].zh, GENRES[x.s.genre].ja) }}</span></span>
              </td>
              <td class="r num c-bpm">{{ x.s.bpm }}</td>
              <td v-for="d in 5" :key="d" class="c lv">
                <span class="star-pip" :class="[DIFFS[d].key, { off: x.s.levels[d - 1] == null }]">{{ x.s.levels[d - 1] ?? '' }}</span>
              </td>
              <td class="r c-const">
                <b v-if="x.c4 != null" class="num k">{{ fx2(x.c4) }}</b>
                <span v-else class="na">—</span>
              </td>
              <td v-if="isReady" class="c-mine">
                <span class="mine">
                  <span v-for="d in [4, 5]" :key="d" class="mslot">
                    <template v-if="mineOf(x.s, d) !== 'nochart'">
                      <span class="sr-only">{{ L(DIFFS[d].zh, DIFFS[d].ja) }}</span>
                      <template v-if="mineOf(x.s, d)"><Crown :v="mineOf(x.s, d).crown" /><Rank :v="mineOf(x.s, d).rank" /></template>
                      <span v-else class="na">—</span>
                    </template>
                  </span>
                </span>
              </td>
              <td class="r num faint c-shelf">{{ x.s.openDay }}</td>
            </VirtualList>
          </table>
        </div>
        </div>
      </div>
    </div>

    <Sheet :open="sheetOpen" :title="L('筛选', '絞り込み')" @close="sheetOpen = false">
      <div class="col sheet-body-gap">
        <div role="group" :aria-label="L('上架状态', '収録状況')">
          <h3 class="fh" aria-hidden="true">{{ L('上架状态', '収録状況') }}</h3>
          <div class="row-wrap">
            <button v-for="s in SHELF" :key="s.v" class="chip" :aria-pressed="f.shelf === s.v" @click="f.shelf = s.v">{{ L(s.zh, s.ja) }}<span class="num n">{{ fmt(pass.shelfN[s.v] || 0) }}</span></button>
          </div>
        </div>
        <div role="group" :aria-label="L('流派', 'ジャンル')">
          <h3 class="fh" aria-hidden="true">{{ L('流派', 'ジャンル') }}</h3>
          <div class="row-wrap">
            <button v-for="(g, key) in GENRES" :key="key" class="chip" :aria-pressed="f.genre.includes(key)" @click="toggleSet('genre', key)">
              <i class="dot" :style="{ color: g.color }" />{{ L(g.zh, g.ja) }}<span class="num n">{{ fmt(pass.genreN[key]) }}</span>
            </button>
          </div>
        </div>
        <div role="group" :aria-label="L('魔王星级', 'おに ★')">
          <h3 class="fh" aria-hidden="true">{{ L('魔王星级', 'おに ★') }}</h3>
          <div class="row-wrap">
            <button v-for="s in STARS" :key="s" class="chip num" :aria-pressed="f.star.includes(s)" @click="toggleSet('star', s)">★{{ s }}</button>
            <button class="chip" :aria-pressed="f.ura" @click="f.ura = !f.ura">{{ L('有里谱', '裏あり') }}</button>
          </div>
        </div>
        <div v-if="isReady" role="group" :aria-label="L('我的进度', '自分の進捗')">
          <h3 class="fh" aria-hidden="true">{{ L('我的进度（魔王）', '自分の進捗（おに）') }}</h3>
          <div class="row-wrap">
            <button v-for="c in CROWN_F" :key="c.v" class="chip" :aria-pressed="f.crown === c.v" @click="f.crown = c.v">{{ L(c.zh, c.ja) }}</button>
          </div>
        </div>
        <div role="group" :aria-label="L('排序', '並び替え')">
          <h3 class="fh" aria-hidden="true">{{ L('排序', '並び替え') }}</h3>
          <div class="row-wrap">
            <button v-for="s in SORTS" :key="s.v" class="chip" :aria-pressed="f.sort === s.v" @click="sortBy(s.v)">
              {{ L(s.zh, s.ja) }}<Icon v-if="f.sort === s.v" :name="f.dir === 'asc' ? 'chevU' : 'chevD'" :size="12" />
            </button>
          </div>
        </div>
      </div>
      <template #foot>
        <button class="btn" @click="clear">{{ L('清除', 'クリア') }}</button>
        <button class="btn btn-ink" @click="sheetOpen = false">{{ L(`查看 ${fmt(rows.length)} 首`, `${fmt(rows.length)} 曲を表示`) }}</button>
      </template>
    </Sheet>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 216px minmax(0, 1fr);
  gap: 32px;
  align-items: start;
}
.facets {
  position: sticky;
  top: calc(var(--bar-h) + 24px);
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.fh {
  margin-bottom: 8px;
  font-size: var(--fs-12);
  font-weight: 500;
  color: var(--ink-3);
}
.fopt {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  width: calc(100% + 16px);
  margin-left: -8px;
  height: 32px;
  padding: 0 8px;
  border-radius: var(--r-ctl);
  font-size: var(--fs-14);
  color: var(--ink-2);
  text-align: left;
}
.fl {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.fopt:hover {
  background: var(--bg-sunk);
  color: var(--ink);
}
.fopt .num {
  flex: none;
  color: var(--ink-3);
  font-size: var(--fs-13);
}
.fopt[aria-pressed='true'] {
  background: var(--ink);
  color: var(--bg);
  font-weight: 700;
}
.fopt[aria-pressed='true'] .num {
  color: inherit;
}
.chip .n {
  margin-left: 2px;
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.chip[aria-pressed='true'] .n {
  color: inherit;
}
.check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: var(--fs-13);
  color: var(--ink-2);
  cursor: pointer;
}
.check input {
  width: 16px;
  height: 16px;
  accent-color: var(--don);
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}
.search {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  height: var(--ctl-h-lg);
  padding: 0 4px 0 14px;
  background: var(--surface);
  border: 1px solid var(--ctl-border);
  border-radius: var(--r-note);
  color: var(--ink-3);
}
.search:focus-within {
  border-color: var(--ka);
  box-shadow: var(--focus);
}
.sinput {
  flex: 1;
  min-width: 0;
  border: 0;
  background: none;
  height: 100%;
  color: var(--ink);
}
.sinput::-webkit-search-cancel-button {
  display: none;
}
.sinput:focus-visible {
  box-shadow: none;
}
.count {
  flex: none;
  white-space: nowrap;
}
.count b {
  font-size: var(--fs-18);
  color: var(--ink);
}
.list-start {
  height: 0;
}

/* ---------- 表格：定高行（--row-h：舒适 56px / 紧凑 44px），分隔线画在单元格内部，保证总高 = 行数 × 行高 ---------- */
.lib {
  font-size: var(--fs-13);
}
.lib td {
  height: var(--row-h, 56px);
  padding-top: 0;
  padding-bottom: 0;
  padding-left: 8px;
  padding-right: 8px;
  border-bottom: 0;
  box-shadow: inset 0 -1px 0 var(--line);
  white-space: nowrap;
}
.lib th {
  top: var(--bar-h);
  padding-left: 8px;
  padding-right: 8px;
}
.lib th:first-child,
.lib td:first-child {
  padding-left: 16px;
}
.lib th:last-child,
.lib td:last-child {
  padding-right: 16px;
}
.lib th:first-child {
  border-top-left-radius: var(--r-panel);
}
.lib th:last-child {
  border-top-right-radius: var(--r-panel);
}
.c-title {
  width: 100%;
  max-width: 0;
}
.rowlink {
  display: block;
  min-width: 0;
  border-radius: var(--r-ctl);
}
.rowlink:hover :deep(.t) {
  color: var(--ka-ink);
}
.c-genre {
  width: 112px;
  max-width: 112px;
}
.c-bpm {
  width: 72px;
}
.lv {
  width: 30px;
  padding-left: 2px !important;
  padding-right: 2px !important;
}
.lv abbr {
  text-decoration: none;
}
.genre {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--ink-2);
}
.k {
  font-size: var(--fs-16);
  color: var(--don-ink);
}
.mine-h {
  display: inline-grid;
  grid-template-columns: auto 48px 48px;
  gap: 6px;
  align-items: center;
}
.mh {
  text-align: center;
}
.mine {
  display: inline-grid;
  grid-template-columns: 48px 48px;
  gap: 6px;
}
.mslot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 22px;
}
.c-mine {
  text-align: right;
}
/* 表格最小宽度 = 其余列 + 歌曲列至少 160px。容器放不下时首列固定、表格在面板内横滑
   （横滑容器里表头只能吸在面板顶部；能放下时表头吸顶窗口） */
.lib {
  min-width: 800px;
}
.lib.no-mine {
  min-width: 690px;
}
.tablewrap.overflow {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.tablewrap.overflow .lib th {
  top: 0;
}
.tablewrap.overflow .c-title {
  min-width: 200px;
  max-width: 200px;
}

/* ---------- 封面视图 ---------- */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: 24px 18px;
}
.gitem {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.gitem b {
  font-size: var(--fs-13);
}
.gmeta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-13);
}
.gitem :deep(.cover) {
  font-size: 56px;
  border-radius: var(--r-panel);
  transition: transform var(--dur-2) var(--ease-out);
}
.gitem:hover :deep(.cover) {
  transform: translateY(-4px);
}
.more {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 0 8px;
}
.sheet-body-gap {
  gap: 20px;
}

/* 列优先级（V11）：1100–1239 隐藏上架；768–1099 再隐藏流派与 BPM */
@media (max-width: 1239px) {
  .c-shelf {
    display: none;
  }
  .lib {
    min-width: 700px;
  }
  .lib.no-mine {
    min-width: 590px;
  }
}
@media (max-width: 1099px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
  /* C4：平板不再把四组分面铺在第一屏，改用快捷筛选条 + 对话框 */
  .facets {
    display: none !important;
  }
  .mfilters {
    display: flex;
    gap: 8px;
    margin: 0 0 8px;
    padding: 4px 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .mfilters::-webkit-scrollbar {
    display: none;
  }
  .mfilters .chip {
    flex: none;
  }
  .badge {
    display: grid;
    place-items: center;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border-radius: 9px;
    background: var(--don-solid); /* D11：白字计数需要 --don-solid（--don 上只有 3.9:1） */
    color: var(--ink-on-solid);
    font-size: var(--fs-12);
  }
  .c-genre,
  .c-bpm {
    display: none;
  }
  .lib {
    min-width: 530px;
  }
  .lib.no-mine {
    min-width: 420px;
  }
}
@media (max-width: 767px) {
  .toolbar {
    gap: 12px;
    margin-bottom: 10px;
  }
  .sinput {
    font-size: 16px;
  }
  .mfilters {
    margin: 0 calc(var(--gutter) * -1) 8px;
    padding: 4px var(--gutter);
  }
  .mlist {
    display: block;
  }
  .mrow {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 100%;
    border-bottom: 1px solid var(--line);
  }
  .mbody {
    min-width: 0;
  }
  .mt {
    font-size: var(--fs-16);
    line-height: 1.3;
  }
  .pips {
    display: flex;
    align-items: center;
    gap: 3px;
    margin-top: 6px;
  }
  .pips .star-pip {
    min-width: 20px;
    height: 20px;
    font-size: var(--fs-13);
  }
  .pips .k {
    margin-left: 6px;
    font-size: var(--fs-14);
  }
  .mmine {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    flex: none;
  }
  .mm {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 22px;
  }
}
</style>
