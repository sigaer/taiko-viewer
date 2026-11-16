<script setup>
import { computed, ref } from 'vue'
import Icon from '../components/Icon.vue'
import Cover from '../components/Cover.vue'
import EmptyLane from '../components/EmptyLane.vue'
import { songById, users } from '../mock/data'
import { L, isJa, isReady, songTitle } from '../store'

const CATS = [
  { key: 'dan', zh: '段位', ja: '段位' },
  { key: 'event', zh: '活动', ja: 'イベント' },
  { key: 'achv', zh: '成就', ja: '実績' },
  { key: 'custom', zh: '自定义', ja: 'カスタム' },
]
const RARITY = {
  common: ['普通', 'ノーマル'],
  rare: ['稀有', 'レア'],
  limited: ['期间限定', '期間限定'],
  rainbow: ['虹', '虹'],
}
const TITLES = [
  { id: 1, name: '精度调律师', ja: '精度の調律師', cat: 'achv', rarity: 'rare', owned: true, using: true, how: '累计 100 张谱面取得全良', howJa: '累計 100 譜面で全良を達成' },
  { id: 2, name: '九段', ja: '九段', cat: 'dan', rarity: 'common', owned: true, how: '通过虹 2026 段位道场九段', howJa: '虹 2026 段位道場 九段に合格' },
  { id: 3, name: '十段', ja: '十段', cat: 'dan', rarity: 'rare', owned: false, how: '通过虹 2026 段位道场十段', howJa: '虹 2026 段位道場 十段に合格' },
  { id: 4, name: '达人', ja: '達人', cat: 'dan', rarity: 'rainbow', owned: false, how: '通过虹 2026 段位道场达人', howJa: '虹 2026 段位道場 達人に合格' },
  { id: 5, name: '金合格的证明', ja: '金合格の証', cat: 'dan', rarity: 'rare', owned: true, how: '任意段位取得金合格', howJa: 'いずれかの段位で金合格' },
  { id: 6, name: '全良猎人', ja: '全良ハンター', cat: 'achv', rarity: 'rainbow', owned: false, how: '累计 500 张谱面取得全良', howJa: '累計 500 譜面で全良を達成' },
  { id: 7, name: '连打之鬼', ja: '連打の鬼', cat: 'achv', rarity: 'rare', owned: false, how: '单曲连打数达到 300', howJa: '1 曲で連打数 300 に到達' },
  { id: 8, name: '体力怪兽', ja: '体力モンスター', cat: 'achv', rarity: 'common', owned: true, how: '单日游玩 60 首', howJa: '1 日に 60 曲プレイ' },
  { id: 9, name: '节奏旅人', ja: 'リズムの旅人', cat: 'achv', rarity: 'common', owned: true, how: '游玩过全部 8 个流派的曲目', howJa: '全 8 ジャンルの楽曲をプレイ' },
  { id: 10, name: '太鼓新人', ja: '太鼓ルーキー', cat: 'achv', rarity: 'common', owned: true, how: '完成第一次游玩', howJa: 'はじめてプレイする' },
  { id: 11, name: '2026 秋季挑战者', ja: '2026 秋の挑戦者', cat: 'event', rarity: 'limited', owned: true, how: '参加 2026 秋季线上段位挑战赛', howJa: '2026 秋季オンライン段位チャレンジに参加' },
  { id: 12, name: '虹色的一年', ja: '虹色の一年', cat: 'event', rarity: 'rainbow', owned: false, how: '生成虹 2026 太鼓回顾，12 月 1 日起', howJa: '虹 2026 ふりかえりを作成（12月1日から）' },
  { id: 13, name: '新曲尝鲜', ja: '新曲いちばん乗り', cat: 'event', rarity: 'limited', owned: false, how: '新曲上线 7 天内通关虹 2026 第三期任意一首', howJa: '虹 2026 第 3 弾の新曲を公開 7 日以内にクリア' },
  { id: 14, name: '年糕不加糖', ja: '年糕不加糖', cat: 'custom', rarity: 'common', owned: true, how: '在鼓众广场用称号券自己设定', howJa: '称号チケットで自分で設定' },
]

const q = ref('')
const cat = ref(null)
const ownedOnly = ref(false)
const catCount = (k) => TITLES.filter((t) => t.cat === k).length
const ownedCount = TITLES.filter((t) => t.owned).length
const list = computed(() => {
  const kw = q.value.trim().toLowerCase()
  return TITLES.filter((t) => {
    if (kw && !`${t.name} ${t.ja} ${t.how} ${t.howJa}`.toLowerCase().includes(kw)) return false
    if (cat.value && t.cat !== cat.value) return false
    if (ownedOnly.value && isReady.value && !t.owned) return false
    return true
  })
})
const filtered = computed(() => !!q.value.trim() || cat.value != null || ownedOnly.value)
function reset() {
  q.value = ''
  cat.value = null
  ownedOnly.value = false
}
const catOf = (k) => CATS.find((c) => c.key === k)

// 别名修改日志：最近 5 条
const ALIAS_LOG = [
  { id: 1, songId: 615, op: 'add', alias: '天狗', by: 'hayate', ago: '2 小时前', agoJa: '2 時間前' },
  { id: 2, songId: 233, op: 'add', alias: '千本', by: 'uta', ago: '昨天', agoJa: '昨日' },
  { id: 3, songId: 960, op: 'remove', alias: '幽玄', by: 'sakura', ago: '2 天前', agoJa: '2 日前' },
  { id: 4, songId: 512, op: 'add', alias: '骑士之夜', by: 'kumo', ago: '3 天前', agoJa: '3 日前' },
  { id: 5, songId: 179, op: 'add', alias: '打工两千', by: 'rin', ago: '5 天前', agoJa: '5 日前' },
]
</script>

<template>
  <div class="page titles">
    <div class="toolbar">
      <label class="search">
        <Icon name="search" :size="18" />
        <input v-model="q" class="input" type="search" :placeholder="L('搜索称号或获得方式', '称号・入手方法で検索')" :aria-label="L('搜索称号', '称号を検索')" />
      </label>
      <p v-if="isReady" class="t-small owned-sum">
        {{ L('已获得', '獲得済み') }} <b class="num">{{ ownedCount }}</b><span class="num faint"> / {{ TITLES.length }}</span>
      </p>
    </div>

    <div class="filters" role="group" :aria-label="L('筛选', '絞り込み')">
      <button class="chip" :aria-pressed="cat === null" @click="cat = null">{{ L('全部', 'すべて') }}<span class="num n">{{ TITLES.length }}</span></button>
      <button v-for="c in CATS" :key="c.key" class="chip" :aria-pressed="cat === c.key" @click="cat = cat === c.key ? null : c.key">
        {{ L(c.zh, c.ja) }}<span class="num n">{{ catCount(c.key) }}</span>
      </button>
      <template v-if="isReady">
        <span class="sep" aria-hidden="true" />
        <button class="chip" :aria-pressed="ownedOnly" @click="ownedOnly = !ownedOnly">{{ L('只看已获得', '獲得済みのみ') }}</button>
      </template>
    </div>

    <ul v-if="list.length" class="tlist">
      <li v-for="t in list" :key="t.id" :class="{ dim: isReady && !t.owned }">
        <i class="mark" :class="{ rainbow: t.rarity === 'rainbow' }" aria-hidden="true" />
        <div class="grow">
          <p class="name">
            <b>{{ L(t.name, t.ja) }}</b>
            <span class="tag">{{ L(catOf(t.cat).zh, catOf(t.cat).ja) }}</span>
            <span v-if="isReady && t.using" class="tag tag-roll">{{ L('使用中', '使用中') }}</span>
          </p>
          <p class="t-small how">{{ L(t.how, t.howJa) }}</p>
        </div>
        <div class="state">
          <span class="t-caption">{{ L(...RARITY[t.rarity]) }}</span>
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
          <RouterLink :to="`/songs/${a.songId}`" class="a-song">
            <Cover :song="songById[a.songId]" size="sm" />
            <span class="truncate">{{ songTitle(songById[a.songId]) }}</span>
          </RouterLink>
          <span class="a-change">
            <span class="tag" :class="a.op === 'add' ? 'tag-ok' : 'tag-don'">{{ a.op === 'add' ? L('新增', '追加') : L('移除', '削除') }}</span>
            <b :class="{ gone: a.op === 'remove' }">{{ a.alias }}</b>
          </span>
          <RouterLink :to="`/u/${a.by}`" class="a-by truncate">{{ users[a.by].name }}</RouterLink>
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
.filters {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 0 16px;
  padding: 2px 0;
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
  opacity: 0.6;
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
.mark {
  width: 10px;
  height: 10px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--line-strong);
  flex: none;
}
.mark.rainbow {
  background: var(--crown-dfc);
}
.name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}
.name b {
  font-size: var(--fs-16);
  font-weight: 700;
}
.dim .name b {
  color: var(--ink-2);
}
.how {
  margin-top: 2px;
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
  color: var(--ka-ink);
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
    margin: 12px calc(var(--gutter) * -1) 14px;
    padding: 2px var(--gutter);
  }
  .tlist {
    grid-template-columns: minmax(0, 1fr);
  }
  .alog li {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 4px 12px;
    padding: 10px 0;
  }
  .a-by {
    grid-column: 1;
  }
}
</style>
