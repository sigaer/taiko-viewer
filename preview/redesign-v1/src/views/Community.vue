<script setup>
import { computed, nextTick, watch } from 'vue'
import Icon from '../components/Icon.vue'
import ThreadRow from '../components/ThreadRow.vue'
import Cover from '../components/Cover.vue'
import { isMobile } from '../breakpoints'
import Diff from '../components/Diff.vue'
import EmptyLane from '../components/EmptyLane.vue'
import PlayerAvatar from '../components/PlayerAvatar.vue'
import TitlePlate from '../components/TitlePlate.vue'
import DanBadge from '../components/DanBadge.vue'
import { useQueryState } from '../routeState'
import { searchThreads } from '../search'
import { sections, sectionBySlug, threads, users, leaderboard, chartUgc, songById, chartOf, THREAD_TYPES, fmt } from '../mock/data'
import { L, songTitle, ensureSearch } from '../store'

// 社区广场（V6）：阅读栏 + 头条。桌面三栏：版块 / 帖子流 / 侧栏（≥ 1240）；手机：版块横滑 + 发帖悬浮按钮。
const PAGE = 20
const FEEDS = [
  { v: 'featured', zh: '精选', ja: '注目' },
  { v: 'hot', zh: '热门', ja: '人気' },
  { v: 'guides', zh: '最新攻略', ja: '新着攻略' },
  { v: 'latest', zh: '最新', ja: '新着' },
]
const f = useQueryState({
  section: { type: 'string', default: 'all', values: ['all', ...sections.map((s) => s.slug)] },
  feed: { type: 'string', default: 'featured', values: FEEDS.map((x) => x.v) },
  q: { type: 'string', default: '', debounce: 250 },
  n: { type: 'number', default: PAGE },
})
const query = computed(() => f.q.trim())
// 关键词与命令面板「在社区搜索」同一套匹配（标题、标签、版块、作者）。
// 搜索索引在第一次有关键词时才建立（约 100ms），不压在首次进入页面上（R6：快速切换没有 > 200ms 的长任务）
const matched = computed(() => {
  if (!query.value) return threads
  ensureSearch()
  return searchThreads(query.value, Infinity).items
})
const filtered = computed(() => {
  let l = matched.value
  if (f.section !== 'all') l = l.filter((t) => t.section === f.section)
  if (f.feed === 'guides') l = l.filter((t) => t.type === 'guide')
  else if (f.feed === 'hot') l = [...l].sort((a, b) => b.likes - a.likes)
  else if (f.feed === 'latest') l = [...l].sort((a, b) => (a.daysAgo ?? 0) - (b.daysAgo ?? 0))
  else if (!query.value) l = [...l].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || Number(!!b.featured) - Number(!!a.featured))
  return l
})
const lead = computed(() => (f.feed === 'featured' && !query.value ? filtered.value.find((t) => t.pinned || t.featured) || null : null))
const rest = computed(() => (lead.value ? filtered.value.filter((t) => t !== lead.value) : filtered.value))
const shown = computed(() => rest.value.slice(0, Math.max(PAGE, f.n)))
const remaining = computed(() => rest.value.length - shown.value.length)
// 换版块 / 排序 / 关键词：回到前 20 帖
watch([() => f.section, () => f.feed, query], () => (f.n = PAGE))

const leadSec = computed(() => (lead.value ? sectionBySlug[lead.value.section] : null))
const leadAuthor = computed(() => (lead.value ? users[lead.value.author] : null))
const leadSong = computed(() => (lead.value?.song ? songById[lead.value.song.id] : null))
const leadChart = computed(() => (lead.value?.song ? chartOf(lead.value.song.id, lead.value.song.d) : null))

// 版块帖数：从帖子数据计算，与帖子流的「共 N 帖」一致
const boardCount = computed(() => {
  const c = { all: threads.length }
  for (const t of threads) c[t.section] = (c[t.section] || 0) + 1
  return c
})
const top = leaderboard.slice(0, 8)
const hotTags = (() => {
  const c = new Map()
  for (const t of threads) for (const g of t.tags || []) c.set(g, (c.get(g) || 0) + 1)
  return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, n]) => ({ name, n }))
})()
const TIP_SONG = 615
const TIP_D = 4
const tipSong = songById[TIP_SONG]
const tipChart = chartOf(TIP_SONG, TIP_D)

function onTabKey(e) {
  const keys = FEEDS.map((x) => x.v)
  const i = keys.indexOf(f.feed)
  let j
  if (e.key === 'ArrowRight') j = (i + 1) % keys.length
  else if (e.key === 'ArrowLeft') j = (i - 1 + keys.length) % keys.length
  else if (e.key === 'Home') j = 0
  else if (e.key === 'End') j = keys.length - 1
  else return
  e.preventDefault()
  const list = e.currentTarget
  f.feed = keys[j]
  nextTick(() => list?.querySelectorAll('[role="tab"]')[j]?.focus())
}
function setTag(name) {
  f.q = f.q === name ? '' : name
}
</script>

<template>
  <div class="page comm">
    <div class="layout">
      <aside class="boards only-desktop">
        <RouterLink to="/community/new" class="btn btn-primary btn-block"><Icon name="edit" :size="16" />{{ L('发布新帖', '新規投稿') }}</RouterLink>
        <div role="group" :aria-label="L('版块', 'カテゴリ')" class="board-list">
          <button type="button" class="board" :aria-pressed="f.section === 'all'" @click="f.section = 'all'">
            <i class="dot dot-all" /><span>{{ L('全部讨论', 'すべて') }}</span><b class="num">{{ fmt(boardCount.all) }}</b>
          </button>
          <button v-for="s in sections" :key="s.slug" type="button" class="board" :aria-pressed="f.section === s.slug" @click="f.section = s.slug">
            <i class="dot" :style="{ color: s.color }" /><span>{{ L(s.zh, s.ja) }}</span><b class="num">{{ fmt(boardCount[s.slug] || 0) }}</b>
          </button>
        </div>
      </aside>

      <div class="feed">
        <div class="mboards only-mobile" role="group" :aria-label="L('版块', 'カテゴリ')">
          <button type="button" class="chip" :aria-pressed="f.section === 'all'" @click="f.section = 'all'">{{ L('全部', 'すべて') }}</button>
          <button v-for="s in sections" :key="s.slug" type="button" class="chip" :aria-pressed="f.section === s.slug" @click="f.section = s.slug"><i class="dot" :style="{ color: s.color }" />{{ L(s.zh, s.ja) }}</button>
        </div>

        <div class="searchrow">
          <label class="search">
            <Icon name="search" :size="16" />
            <span class="sr-only">{{ L('搜索帖子', '投稿を検索') }}</span>
            <input v-model="f.q" type="search" enterkeyhint="search" :placeholder="L('搜索标题、标签、版块或作者', 'タイトル・タグ・カテゴリ・投稿者で検索')" />
            <button v-if="f.q" type="button" class="clear hit" :aria-label="L('清除搜索', '検索をクリア')" @click="f.q = ''"><Icon name="close" :size="14" /></button>
          </label>
          <span class="count t-small" aria-live="polite">
            <template v-if="query">{{ L('找到', '') }} <b class="num">{{ fmt(filtered.length) }}</b> {{ L('帖', '件ヒット') }}</template>
            <template v-else>{{ L('共', '全') }} <b class="num">{{ fmt(filtered.length) }}</b> {{ L('帖', '件') }}</template>
          </span>
        </div>

        <div class="tabs" role="tablist" :aria-label="L('排序', '並び順')" @keydown="onTabKey">
          <button v-for="x in FEEDS" :id="`feed-tab-${x.v}`" :key="x.v" type="button" role="tab" :aria-selected="f.feed === x.v" :tabindex="f.feed === x.v ? 0 : -1" aria-controls="feed-panel" @click="f.feed = x.v">{{ L(x.zh, x.ja) }}</button>
        </div>

        <div id="feed-panel" role="tabpanel" :aria-labelledby="`feed-tab-${f.feed}`">
          <!-- 头条：置顶或精选的第一帖 -->
          <article v-if="lead" class="lead">
            <div class="lead-meta">
              <RouterLink :to="{ path: '/community', query: { section: lead.section } }" class="sec"><i class="dot" :style="{ color: leadSec.color }" />{{ L(leadSec.zh, leadSec.ja) }}</RouterLink>
              <span v-if="lead.pinned" class="tag tag-don"><Icon name="pin" :size="12" />{{ L('置顶', '固定') }}</span>
              <span v-if="lead.featured" class="tag tag-roll">{{ L('精华', '注目') }}</span>
              <span v-if="lead.type !== 'discussion'" class="tag">{{ L(THREAD_TYPES[lead.type].zh, THREAD_TYPES[lead.type].ja) }}</span>
            </div>
            <div class="lead-body">
              <div class="grow">
                <h2 class="lead-title title-wrap">
                  <RouterLink :to="`/community/t/${lead.id}`" :title="lead.title">{{ lead.title }}</RouterLink>
                </h2>
                <p class="lead-sum">{{ lead.summary }}</p>
                <div class="lead-author">
                  <PlayerAvatar :user="leadAuthor" :size="44" />
                  <div class="la-text">
                    <div class="la-line">
                      <RouterLink :to="`/u/${lead.author}`" class="an">{{ leadAuthor.name }}</RouterLink>
                      <DanBadge :dan="leadAuthor.dan" />
                    </div>
                    <div class="la-line">
                      <TitlePlate :text="leadAuthor.title" :rare="leadAuthor.rare" />
                      <span class="ago">{{ lead.ago }}</span>
                    </div>
                  </div>
                </div>
                <div class="lead-foot">
                  <span class="stat"><Icon name="reply" :size="14" /><b class="num">{{ fmt(lead.replies) }}</b><span class="sr-only">{{ L('条回复', '件の返信') }}</span></span>
                  <span class="stat"><Icon name="heart" :size="14" /><b class="num">{{ fmt(lead.likes) }}</b><span class="sr-only">{{ L('个赞', 'いいね') }}</span></span>
                  <span class="stat"><Icon name="eye" :size="14" /><b class="num">{{ fmt(lead.views) }}</b><span class="sr-only">{{ L('次浏览', '閲覧') }}</span></span>
                </div>
              </div>
              <RouterLink v-if="leadSong" :to="`/songs/${leadSong.id}?d=${lead.song.d}&from=community`" class="lead-song">
                <Cover :song="leadSong" :size="isMobile ? 'lg' : 'tile'" />
                <span class="ls title-1l" :title="songTitle(leadSong)">{{ songTitle(leadSong) }}</span>
                <Diff :d="lead.song.d" :star="leadChart?.star" short />
              </RouterLink>
            </div>
          </article>

          <div v-if="shown.length" class="list">
            <ThreadRow v-for="t in shown" :key="t.id" :thread="t" />
          </div>

          <div v-if="remaining > 0" class="more">
            <button type="button" class="btn" @click="f.n = shown.length + PAGE">{{ L(`再显示 ${Math.min(PAGE, remaining)} 帖`, `さらに ${Math.min(PAGE, remaining)} 件表示`) }}</button>
            <span class="t-caption">{{ L(`已显示 ${shown.length + (lead ? 1 : 0)} / ${filtered.length}`, `${shown.length + (lead ? 1 : 0)} / ${filtered.length} 件を表示中`) }}</span>
          </div>

          <EmptyLane v-if="!filtered.length && query" :title="L('没有找到相关帖子', '該当する投稿はありません')" :text="L('换个关键词，或者清除搜索看全部帖子。', '別のキーワードを試すか、検索をクリアしてください。')">
            <button type="button" class="btn" @click="f.q = ''">{{ L('清除搜索', '検索をクリア') }}</button>
          </EmptyLane>
          <EmptyLane v-else-if="!filtered.length" :title="L('这个版块还没有这类帖子', 'この条件の投稿はまだありません')" :text="L('换个排序看看，或者来发第一帖。', '並び順を変えるか、最初の投稿をしてみましょう。')">
            <RouterLink to="/community/new" class="btn btn-primary">{{ L('发布新帖', '新規投稿') }}</RouterLink>
          </EmptyLane>
        </div>
      </div>

      <aside class="side">
        <section>
          <div class="section-head"><h2 class="t-h3">{{ L('达人榜', 'ランキング') }}</h2><span class="t-caption">Rating</span></div>
          <ol class="top">
            <li v-for="u in top" :key="u.key">
              <span class="num pos" :class="{ first: u.rank === 1 }">{{ u.rank }}</span>
              <PlayerAvatar :user="u" :size="32" />
              <RouterLink :to="`/u/${u.key}`" class="grow title-1l" :title="u.name">{{ u.name }}</RouterLink>
              <DanBadge :dan="u.dan" />
              <b class="num">{{ u.rating.toFixed(2) }}</b>
            </li>
          </ol>
        </section>
        <section>
          <div class="section-head"><h2 class="t-h3">{{ L('热门标签', '人気のタグ') }}</h2></div>
          <div class="row-wrap">
            <button v-for="t in hotTags" :key="t.name" type="button" class="chip" :aria-pressed="f.q === t.name" @click="setTag(t.name)">{{ t.name }}<span class="num tagn">{{ t.n }}</span></button>
          </div>
        </section>
        <section>
          <div class="section-head"><h2 class="t-h3">{{ L('谱面上的新提示', '譜面への新着ヒント') }}</h2></div>
          <ul class="ugc">
            <li v-for="(t, i) in chartUgc.tips.slice(0, 2)" :key="i">
              <RouterLink :to="`/songs/${TIP_SONG}?d=${TIP_D}&from=community`" class="ugc-song">
                <Cover :song="tipSong" size="sm" /><span class="grow title-1l" :title="songTitle(tipSong)">{{ songTitle(tipSong) }}</span><Diff :d="TIP_D" :star="tipChart?.star" short />
              </RouterLink>
              <p>{{ t.text }}</p>
              <span class="ugc-who t-caption"><PlayerAvatar :user="users[t.author]" :size="24" /><RouterLink :to="`/u/${t.author}`">{{ users[t.author].name }}</RouterLink> · {{ t.ago }}</span>
            </li>
          </ul>
        </section>
      </aside>
    </div>

    <RouterLink to="/community/new" class="fab only-mobile" :aria-label="L('发布新帖', '新規投稿')"><Icon name="edit" :size="22" /></RouterLink>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr) 300px;
  gap: 40px;
  align-items: start;
}
.boards {
  position: sticky;
  top: calc(var(--bar-h) + 24px);
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.board-list {
  display: flex;
  flex-direction: column;
}
.board {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 36px;
  padding: 0 10px;
  border-radius: var(--r-ctl);
  font-size: var(--fs-14);
  color: var(--ink-2);
  text-align: left;
}
.board span {
  flex: 1;
  min-width: 0;
}
.board b {
  font-size: var(--fs-13);
  color: var(--ink-3);
  font-weight: 500;
}
.board:hover {
  background: var(--bg-sunk);
  color: var(--ink);
}
.board[aria-pressed='true'] {
  background: var(--surface);
  box-shadow: inset 0 0 0 1px var(--line-strong);
  color: var(--ink);
  font-weight: 700;
}
/* 选中态的 inset 描边比 :focus-visible 更具体，会盖掉焦点环（D6） */
.board:focus-visible {
  box-shadow: var(--focus);
}
.dot-all {
  color: var(--ink);
}
.feed {
  min-width: 0;
}

/* 搜索 */
.searchrow {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 6px;
}
.search {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  height: var(--ctl-h);
  padding: 0 6px 0 12px;
  border: 1px solid var(--ctl-border);
  border-radius: var(--ctl-radius);
  background: var(--surface);
  color: var(--ink-3);
}
.search:focus-within {
  border-color: var(--ka);
  box-shadow: var(--focus);
}
.search input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  background: none;
  color: var(--ink);
  font-size: var(--fs-14);
}
.search input:focus-visible {
  box-shadow: none;
  outline: none;
}
.search input::placeholder {
  color: var(--ink-3);
}
.search input::-webkit-search-cancel-button {
  display: none;
}
.clear {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: var(--ink-2);
  flex: none;
}
.clear:hover {
  background: var(--bg-sunk);
  color: var(--ink);
}
.count {
  flex: none;
  white-space: nowrap;
  color: var(--ink-2);
}
.count b {
  color: var(--ink);
}

/* 头条：不加框，用一条粗线与列表分开 */
.lead {
  padding: 22px 0 26px;
  border-bottom: 3px solid var(--ink);
}
.lead-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-bottom: 4px; /* F2：版块链接（带上下 4px 点击扩展）与下面的标题链接之间 ≥ 8px */
  font-size: var(--fs-12);
  color: var(--ink-2);
}
.sec {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
}
.sec:hover {
  color: var(--ka-ink);
}
.lead-body {
  display: flex;
  gap: 28px;
  align-items: flex-start;
  margin-top: 10px;
}
.lead-title {
  font-size: var(--fs-22);
  font-weight: 900;
  line-height: 1.4;
}
.lead-title a:hover {
  color: var(--ka-ink);
}
.lead-sum {
  margin-top: 10px;
  font-size: var(--fs-16);
  line-height: 1.75;
  color: var(--ink-2);
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  overflow: hidden;
}
.lead-author {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  min-width: 0;
}
.la-text {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}
.la-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.an {
  font-weight: 700;
  font-size: var(--fs-14);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.an:hover {
  color: var(--ka-ink);
}
.ago {
  font-size: var(--fs-12);
  color: var(--ink-3);
  white-space: nowrap;
}
.lead-foot {
  display: flex;
  gap: 16px;
  margin-top: 14px;
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.stat b {
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.lead-song {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 112px;
  flex: none;
  text-align: center;
}
.ls {
  width: 100%;
  font-size: var(--fs-12);
  font-weight: 500;
  color: var(--ink-2);
}
.lead-song:hover .ls {
  color: var(--ka-ink);
}
.more {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 0 8px;
  border-top: 1px solid var(--line);
}

/* 右栏 */
.side {
  display: flex;
  flex-direction: column;
  gap: 32px;
  position: sticky;
  top: calc(var(--bar-h) + 24px);
  /* 右栏比视口高时，吸顶会让下半部分（谱面动态）在帖子流滚完之前都够不到：限高并在栏内滚动 */
  max-height: calc(100dvh - var(--bar-h) - 48px);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}
.side .section-head {
  margin-bottom: 8px;
}
.top li {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-14);
}
.top a {
  font-weight: 500;
}
.top a:hover {
  color: var(--ka-ink);
}
.pos {
  width: 18px;
  color: var(--ink-3);
}
.pos.first {
  color: var(--don-ink);
}
.top b {
  width: 44px;
  text-align: right;
  font-size: var(--fs-16);
}
.tagn {
  margin-left: 2px;
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.chip[aria-pressed='true'] .tagn {
  color: inherit;
}
.ugc li {
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}
.ugc-song {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-13);
  font-weight: 700;
}
.ugc-song:hover .grow {
  color: var(--ka-ink);
}
.ugc p {
  margin: 8px 0 6px;
  font-size: var(--fs-14);
  line-height: 1.7;
  color: var(--ink);
}
.ugc-who {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ugc-who a {
  color: var(--ink-2);
  font-weight: 500;
}
.ugc-who a:hover {
  color: var(--ka-ink);
}
@media (max-width: 1239px) {
  .layout {
    grid-template-columns: 190px minmax(0, 1fr);
  }
  .side {
    display: none;
  }
}
@media (max-width: 767px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .comm {
    /* 悬浮发帖按钮不遮住最后一行与「再显示」 */
    padding-bottom: calc(var(--sp-12) + 72px);
  }
  .mboards {
    display: flex !important;
    gap: 8px;
    margin: 0 calc(var(--gutter) * -1) 10px;
    padding: 4px var(--gutter);
    overflow-x: auto;
    scrollbar-width: none;
  }
  .mboards::-webkit-scrollbar {
    display: none;
  }
  .searchrow {
    flex-wrap: wrap;
    gap: 6px 12px;
  }
  .search {
    flex-basis: 100%;
    height: var(--ctl-h-lg);
  }
  .search input {
    font-size: 16px;
  }
  .clear {
    width: 36px;
    height: 36px;
  }
  .lead {
    padding: 16px 0 20px;
  }
  .lead-body {
    flex-direction: column;
    gap: 14px;
  }
  .lead-song {
    flex-direction: row;
    width: 100%;
    text-align: left;
    gap: 12px;
  }
  .lead-song .ls {
    flex: 1;
    width: auto;
    font-size: var(--fs-14);
  }
  .lead-title {
    font-size: var(--fs-18);
  }
  .lead-sum {
    font-size: var(--fs-14);
  }
  .more .btn {
    width: 100%;
  }
  .fab {
    position: fixed;
    right: 16px;
    bottom: calc(var(--shell-bottom) + 16px); /* F1.3 */
    z-index: 10;
    display: grid !important;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--ink);
    color: var(--bg);
    box-shadow: var(--shadow-lift);
  }
}
</style>
