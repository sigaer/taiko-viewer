<script setup>
import { computed, ref } from 'vue'
import Icon from '../components/Icon.vue'
import ThreadRow from '../components/ThreadRow.vue'
import Cover from '../components/Cover.vue'
import Diff from '../components/Diff.vue'
import EmptyLane from '../components/EmptyLane.vue'
import { sections, threads, users, chartUgc, songById, chartOf, fmt } from '../mock/data'
import { L, songTitle } from '../store'

// 社区广场。桌面三栏：版块 / 帖子流 / 侧栏（榜单、标签、谱面动态）。
// 手机：版块变成横向筛选条，发帖是右下角的悬浮按钮。
const sec = ref('all')
const feed = ref('featured')
const FEEDS = [
  { v: 'featured', zh: '精选', ja: '注目' },
  { v: 'hot', zh: '热门', ja: '人気' },
  { v: 'guides', zh: '最新攻略', ja: '新着攻略' },
  { v: 'latest', zh: '最新', ja: '新着' },
]
const list = computed(() => {
  let l = threads.filter((t) => sec.value === 'all' || t.section === sec.value)
  if (feed.value === 'hot') l = [...l].sort((a, b) => b.likes - a.likes)
  else if (feed.value === 'guides') l = l.filter((t) => t.type === 'guide')
  else if (feed.value === 'featured') l = [...l].sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(b.featured) - Number(a.featured))
  return l
})
const TOP = [
  { u: 'nagi', v: 14.82 },
  { u: 'hayate', v: 14.31 },
  { u: 'rin', v: 13.77 },
  { u: 'mochidon', v: 11.97 },
  { u: 'uta', v: 11.2 },
]
const TAGS = ['全良', '24 分', '十段', '新曲', '手法', '机厅', '读谱', 'TJA']
</script>

<template>
  <div class="page comm">
    <div class="layout">
      <aside class="boards only-desktop">
        <RouterLink to="/community/new" class="btn btn-primary btn-block"><Icon name="edit" :size="16" />{{ L('发布新帖', '新規投稿') }}</RouterLink>
        <nav :aria-label="L('版块', 'カテゴリ')">
          <button class="board" :aria-pressed="sec === 'all'" @click="sec = 'all'"><i class="dot" style="color: var(--ink)" /><span>{{ L('全部讨论', 'すべて') }}</span></button>
          <button v-for="s in sections" :key="s.slug" class="board" :aria-pressed="sec === s.slug" @click="sec = s.slug">
            <i class="dot" :style="{ color: s.color }" /><span>{{ L(s.zh, s.ja) }}</span><b class="num">{{ fmt(s.count) }}</b>
          </button>
        </nav>
      </aside>

      <div class="feed">
        <div class="mboards only-mobile">
          <button class="chip" :aria-pressed="sec === 'all'" @click="sec = 'all'">{{ L('全部', 'すべて') }}</button>
          <button v-for="s in sections" :key="s.slug" class="chip" :aria-pressed="sec === s.slug" @click="sec = s.slug"><i class="dot" :style="{ color: s.color }" />{{ L(s.zh, s.ja) }}</button>
        </div>
        <div class="tabs" role="tablist">
          <button v-for="f in FEEDS" :key="f.v" role="tab" :aria-selected="feed === f.v" @click="feed = f.v">{{ L(f.zh, f.ja) }}</button>
        </div>
        <div v-if="list.length"><ThreadRow v-for="t in list" :key="t.id" :thread="t" /></div>
        <EmptyLane v-else :title="L('这个版块还没有这类帖子', 'この条件の投稿はまだありません')" :text="L('换个排序看看，或者来发第一帖。', '並び順を変えるか、最初の投稿をしてみましょう。')">
          <RouterLink to="/community/new" class="btn btn-primary">{{ L('发布新帖', '新規投稿') }}</RouterLink>
        </EmptyLane>
      </div>

      <aside class="side">
        <section>
          <div class="section-head"><h2 class="t-h3">{{ L('达人榜', 'ランキング') }}</h2><span class="t-caption">Rating</span></div>
          <ol class="top">
            <li v-for="(t, i) in TOP" :key="t.u">
              <span class="num pos">{{ i + 1 }}</span>
              <span class="avatar sm" :style="{ background: `hsl(${users[t.u].hue} 45% 42%)` }">{{ users[t.u].name[0] }}</span>
              <RouterLink :to="`/u/${t.u}`" class="grow truncate">{{ users[t.u].name }}</RouterLink>
              <span class="t-caption">{{ users[t.u].dan }}</span>
              <b class="num">{{ t.v.toFixed(2) }}</b>
            </li>
          </ol>
        </section>
        <section>
          <div class="section-head"><h2 class="t-h3">{{ L('热门标签', '人気のタグ') }}</h2></div>
          <div class="row-wrap"><button v-for="t in TAGS" :key="t" class="chip">{{ t }}</button></div>
        </section>
        <section>
          <div class="section-head"><h2 class="t-h3">{{ L('谱面上的新提示', '譜面への新着ヒント') }}</h2></div>
          <ul class="ugc">
            <li v-for="(t, i) in chartUgc.tips.slice(0, 2)" :key="i">
              <RouterLink to="/songs/615?d=4" class="ugc-song"><Cover :song="songById[615]" size="sm" /><span class="truncate">{{ songTitle(songById[615]) }}</span><Diff :d="4" :star="chartOf(615, 4).star" short /></RouterLink>
              <p>{{ t.text }}</p>
              <span class="t-caption">{{ users[t.author].name }} · {{ t.ago }}</span>
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
.board {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border-radius: var(--r-ctl);
  font-size: var(--fs-14);
  color: var(--ink-2);
  text-align: left;
}
.board span {
  flex: 1;
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
.feed {
  min-width: 0;
}
.side {
  display: flex;
  flex-direction: column;
  gap: 32px;
  position: sticky;
  top: calc(var(--bar-h) + 24px);
}
.side .section-head {
  margin-bottom: 8px;
}
.top li {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
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
  width: 16px;
  color: var(--ink-3);
}
.top li:first-child .pos {
  color: var(--don-ink);
}
.top b {
  width: 44px;
  text-align: right;
  font-size: var(--fs-16);
}
.ugc li {
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.ugc-song {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-13);
  font-weight: 700;
}
.ugc p {
  margin: 6px 0 2px;
  font-size: var(--fs-13);
  color: var(--ink-2);
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
  .mboards {
    display: flex !important;
    gap: 8px;
    margin: 0 calc(var(--gutter) * -1) 6px;
    padding: 2px var(--gutter);
    overflow-x: auto;
    scrollbar-width: none;
  }
  .fab {
    position: fixed;
    right: 16px;
    bottom: calc(var(--tab-h) + 16px + env(safe-area-inset-bottom));
    z-index: 10;
    display: grid !important;
    place-items: center;
    width: 54px;
    height: 54px;
    border-radius: 50%;
    background: var(--ink);
    color: var(--bg);
    box-shadow: var(--shadow-lift);
  }
}
</style>
