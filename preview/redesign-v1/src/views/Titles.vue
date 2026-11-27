<script setup>
import { computed } from 'vue'
import Icon from '../components/Icon.vue'
import Cover from '../components/Cover.vue'
import EmptyLane from '../components/EmptyLane.vue'
import TitlePlate from '../components/TitlePlate.vue'
import { songById, users, normalize } from '../mock/data'
import { TITLE_CATALOG, TITLE_REQ, TITLE_SCOPE } from '../mock/titles'
import { L, isReady, songTitle } from '../store'
import { useQueryState } from '../routeState'

// G8：去掉自造的「稀有 / 限定 / 虹」分类；按正式数据的两个维度分组：达成类型 × 难度范围（mock/titles.js）
const TITLES = TITLE_CATALOG

// R2：关键词、达成类型、难度范围、只看已获得写进地址
const f = useQueryState({
  q: { type: 'string', default: '', debounce: 250 },
  req: { type: 'string', default: '', values: ['', ...TITLE_REQ.map((c) => c.key)] },
  scope: { type: 'string', default: '', values: ['', ...TITLE_SCOPE.map((c) => c.key)] },
  owned: { type: 'boolean', default: false },
})
const REQ_N = Object.fromEntries(TITLE_REQ.map((c) => [c.key, TITLES.filter((t) => t.req === c.key).length]))
const SCOPES = TITLE_SCOPE.filter((c) => TITLES.some((t) => t.scope === c.key))
const SCOPE_N = Object.fromEntries(SCOPES.map((c) => [c.key, TITLES.filter((t) => t.scope === c.key).length]))
const ownedCount = TITLES.filter((t) => t.owned).length
const HAY = new Map(TITLES.map((t) => [t.id, [t.name, t.how].map(normalize).join('|')]))
const list = computed(() => {
  const terms = f.q.trim().split(/\s+/).map(normalize).filter(Boolean)
  return TITLES.filter((t) => {
    if (terms.length && !terms.every((w) => HAY.get(t.id).includes(w))) return false
    if (f.req && t.req !== f.req) return false
    if (f.scope && t.scope !== f.scope) return false
    if (f.owned && isReady.value && !t.owned) return false
    return true
  })
})
const filtered = computed(() => !!f.q.trim() || !!f.req || !!f.scope || f.owned)
function reset() {
  f.q = ''
  f.req = ''
  f.scope = ''
  f.owned = false
}
const reqOf = (k) => TITLE_REQ.find((c) => c.key === k)
const scopeOf = (k) => TITLE_SCOPE.find((c) => c.key === k)

// 别名修改日志：最近 5 条
const ALIAS_LOG = [
  { id: 1, songId: 615, op: 'add', alias: '天狗', by: 'hayate', ago: '2 小时前', agoJa: '2 時間前' },
  { id: 2, songId: 413, op: 'add', alias: 'badapple', by: 'uta', ago: '昨天', agoJa: '昨日' },
  { id: 3, songId: 504, op: 'remove', alias: 'abyss', by: 'sakura', ago: '2 天前', agoJa: '2 日前' },
  { id: 4, songId: 1308, op: 'add', alias: 'gigalo', by: 'kumo', ago: '3 天前', agoJa: '3 日前' },
  { id: 5, songId: 179, op: 'add', alias: '打工两千', by: 'rin', ago: '5 天前', agoJa: '5 日前' },
]
</script>

<template>
  <div class="page titles">
    <div class="toolbar">
      <label class="search">
        <Icon name="search" :size="18" />
        <input v-model="f.q" class="input" type="search" :placeholder="L('搜索称号或获得方式', '称号・入手方法で検索')" :aria-label="L('搜索称号', '称号を検索')" />
      </label>
      <p v-if="isReady" class="t-small owned-sum">
        {{ L('已获得', '獲得済み') }} <b class="num">{{ ownedCount }}</b><span class="num faint"> / {{ TITLES.length }}</span>
      </p>
    </div>

    <div class="filters" role="group" :aria-label="L('达成类型', '達成条件')">
      <button class="chip" :aria-pressed="!f.req" @click="f.req = ''">{{ L('全部', 'すべて') }}<span class="num n">{{ TITLES.length }}</span></button>
      <button v-for="c in TITLE_REQ" :key="c.key" class="chip" :aria-pressed="f.req === c.key" @click="f.req = f.req === c.key ? '' : c.key">
        {{ L(c.zh, c.ja) }}<span class="num n">{{ REQ_N[c.key] }}</span>
      </button>
      <template v-if="isReady">
        <span class="sep" aria-hidden="true" />
        <button class="chip" :aria-pressed="f.owned" @click="f.owned = !f.owned">{{ L('只看已获得', '獲得済みのみ') }}</button>
      </template>
    </div>
    <div class="filters scopes" role="group" :aria-label="L('难度范围', '難易度')">
      <button class="chip" :aria-pressed="!f.scope" @click="f.scope = ''">{{ L('所有难度', 'すべての難易度') }}</button>
      <button v-for="c in SCOPES" :key="c.key" class="chip" :aria-pressed="f.scope === c.key" @click="f.scope = f.scope === c.key ? '' : c.key">
        {{ L(c.zh, c.ja) }}<span class="num n">{{ SCOPE_N[c.key] }}</span>
      </button>
    </div>

    <ul v-if="list.length" class="tlist">
      <li v-for="t in list" :key="t.id" :class="{ dim: isReady && !t.owned }">
        <div class="grow">
          <p class="name">
            <TitlePlate :text="t.name" :game="{ name: t.name, plate: t.plate }" form="plate" />
            <span class="tag">{{ L(reqOf(t.req).zh, reqOf(t.req).ja) }} · {{ L(scopeOf(t.scope).zh, scopeOf(t.scope).ja) }}</span>
            <span v-if="isReady && t.using" class="tag tag-info">{{ L('使用中', '使用中') }}</span>
          </p>
          <p class="t-small how">{{ t.how }}</p>
        </div>
        <div class="state">
          <template v-if="isReady">
            <span v-if="t.owned" class="own yes"><Icon name="check" :size="14" />{{ L('已获得', '獲得済み') }}</span>
            <span v-else class="own">{{ L('未获得', '未獲得') }}</span>
          </template>
        </div>
      </li>
    </ul>
    <div v-else class="panel">
      <EmptyLane :title="L('没有符合条件的称号', '条件に合う称号がありません')" compact>
        <button class="btn" @click="reset">{{ L('清除筛选', '条件をクリア') }}</button>
      </EmptyLane>
    </div>
    <p v-if="list.length && filtered" class="t-caption shown">
      {{ L(`显示 ${list.length} / ${TITLES.length} 个称号`, `${TITLES.length} 件中 ${list.length} 件を表示`) }}
      <button class="link" @click="reset">{{ L('清除筛选', '条件をクリア') }}</button>
    </p>

    <section class="section">
      <div class="section-head">
        <h2 class="t-h2">{{ L('别名修改日志', '別名の変更履歴') }}</h2>
        <RouterLink to="/songs" class="more">{{ L('在曲库里搜别名', '楽曲一覧で別名検索') }}</RouterLink>
      </div>
      <ul class="alog">
        <li v-for="a in ALIAS_LOG" :key="a.id">
          <RouterLink :to="`/songs/${a.songId}?from=titles`" class="a-song">
            <Cover :song="songById[a.songId]" size="sm" />
            <span class="title-1l" :title="songTitle(songById[a.songId])">{{ songTitle(songById[a.songId]) }}</span>
          </RouterLink>
          <span class="a-change">
            <span class="tag" :class="{ 'tag-ok': a.op === 'add' }">{{ a.op === 'add' ? L('新增', '追加') : L('移除', '削除') }}</span>
            <b class="title-1l" :class="{ gone: a.op === 'remove' }" :title="a.alias">{{ a.alias }}</b>
          </span>
          <RouterLink :to="`/u/${a.by}`" class="a-by title-1l">{{ users[a.by].name }}</RouterLink>
          <span class="t-caption a-when">{{ L(a.ago, a.agoJa) }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
.owned-sum {
  white-space: nowrap;
}
.owned-sum b {
  font-size: var(--fs-22);
  color: var(--ink);
}
.filters.scopes {
  margin-top: -8px;
}
.filters {
  display: flex;
  align-items: center;
  gap: 8px;
  /* 横滑容器上下留 3px，胶囊的 44px 扩展区不被裁掉（D7 / C10） */
  margin: 11px 0 15px;
  padding: 3px 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.filters::-webkit-scrollbar {
  display: none;
}
.filters > * {
  flex: none;
}
.chip .n {
  font-size: var(--fs-13);
  color: var(--ink-3);
}
.chip[aria-pressed='true'] .n {
  color: inherit;
}
.sep {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--line-strong);
}

/* ---------- 称号：两栏带分隔线的列表 ---------- */
.tlist {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 48px;
  border-top: 1px solid var(--line-strong);
}
.tlist li {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 13px 0;
  border-bottom: 1px solid var(--line);
}
.name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}
.how {
  margin-top: 4px;
}
.state {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex: none;
  padding-top: 2px;
  white-space: nowrap;
}
.own {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.own.yes {
  color: var(--ok);
  font-weight: 700;
}
.shown {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

/* ---------- 别名日志 ---------- */
.alog {
  border-top: 1px solid var(--line-strong);
}
.alog li {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) 140px 84px;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-13);
}
.a-song {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-weight: 700;
}
.a-song:hover,
.a-by:hover {
  color: var(--link);
}
.a-change {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.a-change b {
  font-weight: 500;
}
.a-change .gone {
  color: var(--ink-3);
  text-decoration: line-through;
}
.a-by {
  color: var(--ink-2);
}
.a-when {
  text-align: right;
}

@media (max-width: 1099px) {
  .tlist {
    column-gap: 28px;
  }
}
@media (max-width: 767px) {
  .filters {
    margin: 11px calc(var(--gutter) * -1) 13px;
    padding: 3px var(--gutter);
  }
  .tlist {
    grid-template-columns: minmax(0, 1fr);
  }
  .alog li {
    grid-template-columns: minmax(0, 1fr) auto;
    /* F2：作者名（行内链接）与上方歌曲链接之间留 ≥ 8px（作者名自带上下 4px 点击扩展） */
    gap: 12px 12px;
    padding: 10px 0;
  }
  .a-by {
    grid-column: 1;
  }
}
/* D7：别名日志的歌曲链接是整行的主目标（带封面），手机上不低于 --hit */
@media (max-width: 767px) {
  .a-song {
    min-height: var(--hit);
  }
}
</style>
