<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../components/Icon.vue'
import SongCell from '../components/SongCell.vue'
import Cover from '../components/Cover.vue'
import Crown from '../components/Crown.vue'
import Rank from '../components/Rank.vue'
import Sheet from '../components/Sheet.vue'
import EmptyLane from '../components/EmptyLane.vue'
import { songs, GENRES, DIFFS, scoreOf, chartOf } from '../mock/data'
import { L, isReady, songTitle, songSub, subLang } from '../store'

// 曲库：把旧版的「实装 / 未上架 / 其他」三个页面合成一个列表，上架状态变成筛选条件。
// 桌面：左侧分面筛选 + 紧凑表格；手机：搜索 + 横向筛选条 + 列表行，完整筛选进底部抽屉。
const router = useRouter()
const q = ref('')
const f = reactive({ shelf: 0, genres: new Set(), stars: new Set(), ura: false, crown: 'all' })
const sort = reactive({ key: 'open', dir: -1 })
const view = ref('table')
const sheetOpen = ref(false)

const SHELF = [
  { v: 0, zh: '实装歌曲', ja: '稼働中' },
  { v: 1, zh: '国行未上架', ja: '中国版未収録' },
  { v: 2, zh: '其他歌曲', ja: 'その他' },
]
const STARS = [10, 9, 8, 7, 6]
const CROWN_F = [
  { v: 'all', zh: '全部', ja: 'すべて' },
  { v: 'unplayed', zh: '没打过', ja: '未プレイ' },
  { v: 'nofc', zh: '还没全连', ja: '未フルコン' },
  { v: 'nodfc', zh: '还没全良', ja: '未全良' },
]

const shelfCount = (v) => songs.filter((s) => s.shelf === v).length
const genreCount = (g) => songs.filter((s) => s.shelf === f.shelf && s.genre === g).length
function toggle(set, v) {
  set.has(v) ? set.delete(v) : set.add(v)
}
const activeCount = computed(() => f.genres.size + f.stars.size + (f.ura ? 1 : 0) + (f.crown !== 'all' ? 1 : 0))
function clear() {
  f.genres.clear()
  f.stars.clear()
  f.ura = false
  f.crown = 'all'
  q.value = ''
}

const rows = computed(() => {
  const term = q.value.trim().toLowerCase()
  let list = songs.filter((s) => s.shelf === f.shelf)
  if (term) list = list.filter((s) => `${s.ja} ${s.zh} ${s.artist}`.toLowerCase().includes(term))
  if (f.genres.size) list = list.filter((s) => f.genres.has(s.genre))
  if (f.stars.size) list = list.filter((s) => f.stars.has(s.levels[3]) || f.stars.has(s.levels[4]))
  if (f.ura) list = list.filter((s) => s.levels[4] != null)
  if (f.crown !== 'all' && isReady.value) {
    list = list.filter((s) => {
      const sc = scoreOf(s.id, 4)
      if (f.crown === 'unplayed') return !sc
      if (f.crown === 'nofc') return !sc || sc.crown < 1
      return !sc || sc.crown < 2
    })
  }
  const val = (s) => (sort.key === 'open' ? s.openDay : sort.key === 'const' ? (chartOf(s.id, 4)?.constant ?? 0) : sort.key === 'bpm' ? parseFloat(s.bpm.split('-').pop()) : songTitle(s))
  return [...list].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir)
})
function sortBy(key) {
  if (sort.key === key) sort.dir *= -1
  else {
    sort.key = key
    sort.dir = key === 'title' ? 1 : -1
  }
}
const ariaSort = (key) => (sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined)
const open = (s) => router.push(`/songs/${s.id}`)
</script>

<template>
  <div class="page songs">
    <div class="layout">
      <!-- 分面筛选（桌面） -->
      <aside class="facets only-desktop" :aria-label="L('筛选', '絞り込み')">
        <div class="facet">
          <h2 class="fh">{{ L('上架状态', '収録状況') }}</h2>
          <button v-for="s in SHELF" :key="s.v" class="fopt" :aria-pressed="f.shelf === s.v" @click="f.shelf = s.v">
            <span>{{ L(s.zh, s.ja) }}</span><span class="num">{{ shelfCount(s.v) }}</span>
          </button>
        </div>
        <div class="facet">
          <h2 class="fh">{{ L('流派', 'ジャンル') }}</h2>
          <button v-for="(g, key) in GENRES" :key="key" class="fopt" :aria-pressed="f.genres.has(key)" @click="toggle(f.genres, key)">
            <span class="row" style="gap: 8px"><i class="dot" :style="{ color: g.color }" />{{ L(g.zh, g.ja) }}</span><span class="num">{{ genreCount(key) }}</span>
          </button>
        </div>
        <div class="facet">
          <h2 class="fh">{{ L('魔王星级', 'おに ★') }}</h2>
          <div class="row-wrap">
            <button v-for="s in STARS" :key="s" class="chip" :aria-pressed="f.stars.has(s)" @click="toggle(f.stars, s)">★{{ s }}</button>
          </div>
          <label class="check"><input v-model="f.ura" type="checkbox" />{{ L('只看有里谱的', '裏譜面あり') }}</label>
        </div>
        <div v-if="isReady" class="facet">
          <h2 class="fh">{{ L('我的进度', '自分の進捗') }}</h2>
          <button v-for="c in CROWN_F" :key="c.v" class="fopt" :aria-pressed="f.crown === c.v" @click="f.crown = c.v"><span>{{ L(c.zh, c.ja) }}</span></button>
        </div>
      </aside>

      <div class="main">
        <div class="toolbar">
          <label class="search">
            <Icon name="search" :size="18" />
            <input v-model="q" class="sinput" :placeholder="L('在曲库里找：曲名、译名、艺术家', '曲名・訳名・アーティストで絞り込み')" />
            <button v-if="q" class="icon-btn" :aria-label="L('清空', 'クリア')" @click="q = ''"><Icon name="close" :size="16" /></button>
          </label>
          <span class="count t-small only-desktop"><b class="num">{{ rows.length }}</b> {{ L('首', '曲') }}</span>
          <div class="seg only-desktop" role="group" :aria-label="L('视图', '表示')">
            <button :aria-pressed="view === 'table'" @click="view = 'table'"><Icon name="rows" :size="16" /></button>
            <button :aria-pressed="view === 'grid'" @click="view = 'grid'"><Icon name="grid" :size="16" /></button>
          </div>
        </div>

        <!-- 手机：筛选条 -->
        <div class="mfilters only-mobile">
          <button class="chip" :aria-pressed="activeCount > 0" @click="sheetOpen = true"><Icon name="filter" :size="14" />{{ L('筛选', '絞り込み') }}<b v-if="activeCount" class="num">{{ activeCount }}</b></button>
          <button v-for="s in SHELF" :key="s.v" class="chip" :aria-pressed="f.shelf === s.v" @click="f.shelf = s.v">{{ L(s.zh, s.ja) }}</button>
          <button v-for="s in STARS.slice(0, 3)" :key="s" class="chip" :aria-pressed="f.stars.has(s)" @click="toggle(f.stars, s)">★{{ s }}</button>
        </div>

        <div v-if="!rows.length" class="panel">
          <EmptyLane :title="L('没有符合条件的歌曲', '条件に合う楽曲がありません')" :text="L('换一个关键词，或者放宽筛选条件。', 'キーワードを変えるか、条件をゆるめてみてください。')">
            <button class="btn" @click="clear">{{ L('清除全部筛选', '絞り込みをクリア') }}</button>
          </EmptyLane>
        </div>

        <!-- 桌面：表格 -->
        <div v-else-if="view === 'table'" class="panel tablewrap only-desktop">
          <table class="dt">
            <thead>
              <tr>
                <th :aria-sort="ariaSort('title')"><button @click="sortBy('title')">{{ L('歌曲', '楽曲') }}<Icon v-if="sort.key === 'title'" :name="sort.dir === 1 ? 'chevU' : 'chevD'" :size="12" /></button></th>
                <th>{{ L('流派', 'ジャンル') }}</th>
                <th class="r" :aria-sort="ariaSort('bpm')"><button @click="sortBy('bpm')">BPM<Icon v-if="sort.key === 'bpm'" :name="sort.dir === 1 ? 'chevU' : 'chevD'" :size="12" /></button></th>
                <th v-for="d in 5" :key="d" class="c lv">{{ L(DIFFS[d].short, DIFFS[d].shortJa) }}</th>
                <th class="r" :aria-sort="ariaSort('const')"><button @click="sortBy('const')">{{ L('魔王定数', 'おに定数') }}<Icon v-if="sort.key === 'const'" :name="sort.dir === 1 ? 'chevU' : 'chevD'" :size="12" /></button></th>
                <th v-if="isReady" class="c">{{ L('我的', '自分') }}</th>
                <th class="r" :aria-sort="ariaSort('open')"><button @click="sortBy('open')">{{ L('上架', '収録日') }}<Icon v-if="sort.key === 'open'" :name="sort.dir === 1 ? 'chevU' : 'chevD'" :size="12" /></button></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in rows" :key="s.id" class="is-link" tabindex="0" @click="open(s)" @keydown.enter="open(s)">
                <td class="tcell"><SongCell :song="s" /></td>
                <td><span class="genre"><i class="dot" :style="{ color: GENRES[s.genre].color }" />{{ L(GENRES[s.genre].zh, GENRES[s.genre].ja) }}</span></td>
                <td class="r num">{{ s.bpm }}</td>
                <td v-for="d in 5" :key="d" class="c lv">
                  <span class="star-pip" :class="[DIFFS[d].key, { off: s.levels[d - 1] == null }]">{{ s.levels[d - 1] ?? '–' }}</span>
                </td>
                <td class="r"><b class="num k">{{ chartOf(s.id, 4)?.constant?.toFixed(2) ?? '—' }}</b></td>
                <td v-if="isReady" class="c">
                  <span class="mine">
                    <Crown :v="scoreOf(s.id, 4)?.crown ?? null" />
                    <Rank :v="scoreOf(s.id, 4)?.rank ?? 0" />
                  </span>
                </td>
                <td class="r num faint">{{ s.openDay }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 桌面：封面视图 -->
        <div v-else class="grid only-desktop">
          <RouterLink v-for="s in rows" :key="s.id" :to="`/songs/${s.id}`" class="gitem">
            <Cover :song="s" size="fill" />
            <b class="truncate">{{ songTitle(s) }}</b>
            <span class="row" style="gap: 6px">
              <span class="star-pip">{{ s.levels[3] }}</span>
              <span v-if="s.levels[4] != null" class="star-pip ura">{{ s.levels[4] }}</span>
              <span class="num faint">{{ chartOf(s.id, 4)?.constant?.toFixed(2) }}</span>
            </span>
          </RouterLink>
        </div>

        <!-- 手机：列表行 -->
        <ul v-if="rows.length" class="mlist only-mobile">
          <li v-for="s in rows" :key="s.id">
            <RouterLink :to="`/songs/${s.id}`" class="mrow">
              <Cover :song="s" size="lg" />
              <span class="grow">
                <b class="truncate mt">{{ songTitle(s) }}</b>
                <span class="truncate t-caption" :lang="songSub(s) ? subLang : null">{{ songSub(s) || s.artist }}</span>
                <span class="pips">
                  <span v-for="d in 5" :key="d" class="star-pip" :class="[DIFFS[d].key, { off: s.levels[d - 1] == null }]">{{ s.levels[d - 1] ?? '–' }}</span>
                  <span class="num k">{{ chartOf(s.id, 4)?.constant?.toFixed(2) }}</span>
                </span>
              </span>
              <span v-if="isReady" class="mmine"><Crown :v="scoreOf(s.id, 4)?.crown ?? null" /><Rank :v="scoreOf(s.id, 4)?.rank ?? 0" /></span>
            </RouterLink>
          </li>
        </ul>
      </div>
    </div>

    <Sheet :open="sheetOpen" :title="L('筛选', '絞り込み')" @close="sheetOpen = false">
      <div class="col" style="gap: 20px">
        <div>
          <h3 class="fh">{{ L('流派', 'ジャンル') }}</h3>
          <div class="row-wrap">
            <button v-for="(g, key) in GENRES" :key="key" class="chip" :aria-pressed="f.genres.has(key)" @click="toggle(f.genres, key)"><i class="dot" :style="{ color: g.color }" />{{ L(g.zh, g.ja) }}</button>
          </div>
        </div>
        <div>
          <h3 class="fh">{{ L('魔王星级', 'おに ★') }}</h3>
          <div class="row-wrap">
            <button v-for="s in STARS" :key="s" class="chip" :aria-pressed="f.stars.has(s)" @click="toggle(f.stars, s)">★{{ s }}</button>
            <button class="chip" :aria-pressed="f.ura" @click="f.ura = !f.ura">{{ L('有里谱', '裏あり') }}</button>
          </div>
        </div>
        <div v-if="isReady">
          <h3 class="fh">{{ L('我的进度', '自分の進捗') }}</h3>
          <div class="row-wrap">
            <button v-for="c in CROWN_F" :key="c.v" class="chip" :aria-pressed="f.crown === c.v" @click="f.crown = c.v">{{ L(c.zh, c.ja) }}</button>
          </div>
        </div>
      </div>
      <template #foot>
        <button class="btn" @click="clear">{{ L('清除', 'クリア') }}</button>
        <button class="btn btn-ink" @click="sheetOpen = false">{{ L(`查看 ${rows.length} 首`, `${rows.length} 曲を表示`) }}</button>
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
  width: calc(100% + 16px);
  margin-left: -8px;
  height: 32px;
  padding: 0 8px;
  border-radius: var(--r-ctl);
  font-size: var(--fs-14);
  color: var(--ink-2);
  text-align: left;
}
.fopt:hover {
  background: var(--bg-sunk);
  color: var(--ink);
}
.fopt .num {
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
  opacity: 0.7;
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
  display: flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 4px 0 14px;
  background: var(--surface);
  border: 1px solid var(--line-strong);
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
.sinput:focus-visible {
  box-shadow: none;
}
.count b {
  font-size: var(--fs-18);
  color: var(--ink);
}
.dt th {
  top: var(--bar-h);
}
.dt th:first-child {
  border-top-left-radius: var(--r-panel);
}
.dt th:last-child {
  border-top-right-radius: var(--r-panel);
}
.dt tbody tr:last-child td:first-child {
  border-bottom-left-radius: var(--r-panel);
}
.dt tbody tr:last-child td:last-child {
  border-bottom-right-radius: var(--r-panel);
}
.tcell {
  width: 38%;
  max-width: 0;
}
.lv {
  width: 40px;
  padding-left: 4px !important;
  padding-right: 4px !important;
}
.genre {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ink-2);
  white-space: nowrap;
}
.k {
  font-size: var(--fs-16);
}
.mine {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
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
.gitem :deep(.cover) {
  font-size: 56px;
  border-radius: 12px;
  transition: transform var(--dur-2) var(--ease-out);
}
.gitem:hover :deep(.cover) {
  transform: translateY(-4px);
}

@media (max-width: 1099px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .facets {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 16px 32px;
  }
  .facet {
    min-width: 180px;
  }
}
@media (max-width: 767px) {
  .toolbar {
    margin-bottom: 10px;
  }
  .search {
    height: 46px;
  }
  .sinput {
    font-size: 16px;
  }
  .mfilters {
    display: flex !important;
    gap: 8px;
    margin: 0 calc(var(--gutter) * -1) 8px;
    padding: 2px var(--gutter);
    overflow-x: auto;
    scrollbar-width: none;
  }
  .mfilters::-webkit-scrollbar {
    display: none;
  }
  .mfilters .chip b {
    display: grid;
    place-items: center;
    min-width: 18px;
    height: 18px;
    border-radius: 9px;
    background: var(--don);
    color: #fff;
    font-size: 12px;
  }
  .mlist {
    display: block !important;
  }
  .mrow {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--line);
  }
  .mt {
    display: block;
    font-size: var(--fs-16);
    line-height: 1.3;
  }
  .mrow .t-caption {
    display: block;
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
    font-size: 13px;
  }
  .pips .k {
    margin-left: 6px;
    font-size: var(--fs-14);
    color: var(--ink-2);
  }
  .mmine {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
}
</style>
