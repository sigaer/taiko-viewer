<script setup>
import { computed, ref } from 'vue'
import Icon from '../components/Icon.vue'
import SongCell from '../components/SongCell.vue'
import Diff from '../components/Diff.vue'
import { songs, users, DIFFS, fmt } from '../mock/data'
import { L } from '../store'

// 难度 × 星级：每格是该等级的攻略篇数，0 表示这个等级不存在或还没有攻略
const ROWS = [
  { d: 1, zh: '简单', ja: 'かんたん', counts: [12, 18, 14, 9, 4, 0, 0, 0, 0, 0] },
  { d: 2, zh: '普通', ja: 'ふつう', counts: [6, 11, 17, 15, 12, 7, 3, 0, 0, 0] },
  { d: 3, zh: '困难', ja: 'むずかしい', counts: [2, 5, 9, 14, 18, 16, 12, 6, 0, 0] },
  { d: 4, zh: '魔王', ja: 'おに', counts: [1, 3, 5, 8, 12, 17, 24, 31, 38, 42] },
  { d: 5, zh: '里', ja: '裏', counts: [0, 0, 0, 2, 3, 5, 8, 14, 19, 27] },
]
const MAX = Math.max(...ROWS.flatMap((r) => r.counts))
const TOTAL = ROWS.reduce((n, r) => n + r.counts.reduce((a, b) => a + b, 0), 0)
const heat = (n) => `${Math.round(7 + (n / MAX) * 27)}%`
const tone = (d) => `var(--diff-${DIFFS[d].key})`

const TIERS = [
  { key: 't1', zh: '最难', ja: '最難', cls: 'tag-don' },
  { key: 't2', zh: '偏难', ja: '難しめ', cls: 'tag-roll' },
  { key: 't3', zh: '中等', ja: '標準', cls: '' },
  { key: 't4', zh: '偏易', ja: '易しめ', cls: 'tag-ka' },
  { key: 't5', zh: '最易', ja: '最易', cls: 'tag-ok' },
]
const TIPS = [
  '后半连续四组 24 分，中间只有一拍休息。第二组改成左手起手，第三组会顺很多。',
  '全程以 16 分为主，难点是第 33 小节的变速。流速开到 1.5 倍以上更容易看清间距。',
  '大音符夹在复合里，先保证节奏不乱，再考虑双手打大音符。',
  '体力曲。前半别用力，最后 12 小节的长复合才是通关线。',
  '12 分和 16 分交替出现，耳朵跟着旋律走比数拍子更稳。',
  '开头 8 小节密度最低，用来确认判定偏移，后面的良率能高不少。',
  '气球和连打衔接很紧，连打打到八成就该收手准备下一个音符。',
  '中段有一段低速，提前记住配置比临场读谱可靠。',
]
const AUTHORS = ['hayate', 'rin', 'nagi', 'kumo', 'uta']

const d = ref(4)
const star = ref(9)
const row = computed(() => ROWS.find((r) => r.d === d.value))
const count = computed(() => row.value.counts[star.value - 1])
const starChips = computed(() => row.value.counts.map((n, i) => ({ n, s: i + 1 })).filter((x) => x.n))

function select(nd, ns) {
  d.value = nd
  star.value = ns
}
function selectDiff(nd) {
  const counts = ROWS.find((r) => r.d === nd).counts
  d.value = nd
  if (!counts[star.value - 1]) star.value = counts.reduce((best, n, i) => (n ? i + 1 : best), 1)
}

const entries = computed(() => {
  const pool = songs.map((s) => ({ song: s, chart: s.charts.find((c) => c.d === d.value) })).filter((x) => x.chart)
  let list = pool.filter((x) => x.chart.star === star.value)
  if (list.length < 3) list = [...pool].sort((a, b) => Math.abs(a.chart.star - star.value) - Math.abs(b.chart.star - star.value) || a.song.id - b.song.id).slice(0, 4)
  const weight = (x) => x.chart.constant ?? x.chart.notes / 100
  list = [...list].sort((a, b) => weight(b) - weight(a)).slice(0, Math.min(8, count.value))
  return list.map((x, i) => {
    const key = AUTHORS[(x.song.id + i) % AUTHORS.length]
    return {
      key: x.song.id,
      song: x.song,
      tier: TIERS[Math.min(4, Math.floor((i / list.length) * 5))],
      tip: TIPS[(x.song.id + d.value) % TIPS.length],
      author: { key, ...users[key] },
      helpful: 12 + ((x.song.id * 7 + star.value * 13) % 180),
    }
  })
})
</script>

<template>
  <div class="page guide">
    <div class="top">
      <p class="t-small">
        <b class="num big">{{ fmt(TOTAL) }}</b> {{ L('篇攻略', '件の攻略') }}
      </p>
      <RouterLink to="/community" class="link">{{ L('社区攻略版块', 'コミュニティの攻略カテゴリ') }}</RouterLink>
    </div>

    <!-- 桌面 / 平板：难度 × 星级 矩阵 -->
    <div class="panel mx-panel only-desktop">
      <table class="mx">
        <thead>
          <tr>
            <th scope="col"><span class="sr-only">{{ L('难度', '難易度') }}</span></th>
            <th v-for="s in 10" :key="s" scope="col" class="num" :class="{ on: star === s }">★{{ s }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in ROWS" :key="r.d" :style="{ '--c': tone(r.d) }">
            <th scope="row" :class="{ on: d === r.d }">
              <span class="diff" :class="DIFFS[r.d].key"><span class="d">{{ L(r.zh, r.ja) }}</span></span>
            </th>
            <td v-for="(n, i) in r.counts" :key="i">
              <button
                class="cell num"
                :disabled="!n"
                :aria-pressed="d === r.d && star === i + 1"
                :aria-label="L(`${r.zh} ★${i + 1}，${n} 篇攻略`, `${r.ja} ★${i + 1}、攻略 ${n} 件`)"
                :style="{ '--a': heat(n) }"
                @click="select(r.d, i + 1)"
              >
                {{ n || '' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 手机：难度分段 + 星级胶囊 -->
    <div class="only-mobile">
      <div class="mctl">
        <div class="scroll-x seg-wrap">
          <div class="seg" role="group" :aria-label="L('难度', '難易度')">
            <button v-for="r in ROWS" :key="r.d" :aria-pressed="d === r.d" @click="selectDiff(r.d)">{{ L(r.zh, r.ja) }}</button>
          </div>
        </div>
        <div class="stars" role="group" :aria-label="L('星级', '★')" :style="{ '--c': tone(d) }">
          <button v-for="c in starChips" :key="c.s" class="chip" :aria-pressed="star === c.s" @click="star = c.s">
            <span class="num s">★{{ c.s }}</span><span class="num n">{{ c.n }}</span>
          </button>
        </div>
      </div>
    </div>

    <section class="list-sec">
      <div class="list-head">
        <h2 class="t-h2 lh">
          <Diff :d="d" :star="star" lg />
          <span><span class="num">{{ count }}</span> {{ L('篇攻略', '件の攻略') }}</span>
        </h2>
        <RouterLink to="/community/new" class="btn btn-sm"><Icon name="edit" :size="16" />{{ L('写攻略', '攻略を書く') }}</RouterLink>
      </div>
      <div class="legend">
        <span class="t-caption">{{ L('同星级内的档位', '同じ★内の難易度帯') }}</span>
        <span v-for="t in TIERS" :key="t.key" class="tag" :class="t.cls">{{ L(t.zh, t.ja) }}</span>
      </div>

      <ul class="glist">
        <li v-for="e in entries" :key="e.key">
          <RouterLink :to="`/songs/${e.song.id}?d=${d}`" class="g-song"><SongCell :song="e.song" /></RouterLink>
          <span class="tag g-tier" :class="e.tier.cls">{{ L(e.tier.zh, e.tier.ja) }}</span>
          <p class="g-tip">{{ e.tip }}</p>
          <span class="g-meta">
            <RouterLink :to="`/u/${e.author.key}`" class="g-author">
              <span class="avatar sm" :style="{ background: `hsl(${e.author.hue} 45% 42%)` }">{{ e.author.name[0] }}</span>
              <span class="truncate">{{ e.author.name }}</span>
            </RouterLink>
            <span class="g-help" :title="L('觉得有用的人数', '役に立った人数')"><Icon name="thumb" :size="14" /><span class="num">{{ e.helpful }}</span></span>
          </span>
        </li>
      </ul>
      <p v-if="count > entries.length" class="foot">
        <RouterLink to="/community" class="link">{{ L(`在社区查看全部 ${count} 篇`, `コミュニティで ${count} 件すべて見る`) }}</RouterLink>
      </p>
    </section>
  </div>
</template>

<style scoped>
.top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.big {
  font-size: var(--fs-22);
  color: var(--ink);
}

/* ---------- 矩阵 ---------- */
.mx-panel {
  padding: 12px 16px 16px;
}
.mx {
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 4px;
}
.mx thead th {
  padding: 2px 0 4px;
  font-size: var(--fs-14);
  font-weight: 600;
  color: var(--ink-3);
  text-align: center;
}
.mx thead th:first-child {
  width: 104px;
}
.mx thead th.on {
  color: var(--ink);
}
.mx tbody th {
  padding-right: 8px;
  text-align: left;
  opacity: 0.72;
}
.mx tbody th.on {
  opacity: 1;
}
.mx td {
  padding: 0;
}
.cell {
  display: grid;
  place-items: center;
  width: 100%;
  height: 44px;
  border-radius: var(--r-ctl);
  background: color-mix(in srgb, var(--c) var(--a), var(--surface));
  font-size: var(--fs-18);
  color: var(--ink);
  transition: box-shadow var(--dur-1), transform var(--dur-1);
}
.cell:hover {
  box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--c) 60%, transparent);
}
.cell:active {
  transform: scale(0.96);
}
.cell[aria-pressed='true'] {
  box-shadow: inset 0 0 0 2.5px var(--c);
  font-weight: 700;
}
.cell:focus-visible {
  box-shadow: inset 0 0 0 2.5px var(--c), var(--focus);
}
.cell:disabled {
  background: transparent;
  cursor: default;
  box-shadow: none;
  transform: none;
}
.cell:disabled::after {
  content: '';
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--line-strong);
}

/* ---------- 手机控件 ---------- */
.mctl {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.seg-wrap {
  margin: 0 calc(var(--gutter) * -1);
  padding: 0 var(--gutter);
  scrollbar-width: none;
}
.stars {
  display: flex;
  gap: 6px;
  margin: 0 calc(var(--gutter) * -1);
  padding: 2px var(--gutter);
  overflow-x: auto;
  scrollbar-width: none;
}
.stars::-webkit-scrollbar,
.seg-wrap::-webkit-scrollbar {
  display: none;
}
.stars .chip {
  flex: none;
  height: 40px;
  gap: 6px;
  background: color-mix(in srgb, var(--c) 9%, var(--surface));
  border-color: color-mix(in srgb, var(--c) 30%, var(--line-strong));
}
.stars .s {
  font-size: var(--fs-16);
  color: var(--ink);
}
.stars .n {
  color: var(--ink-3);
}
.stars .chip[aria-pressed='true'] {
  background: var(--ink);
  border-color: var(--ink);
}
.stars .chip[aria-pressed='true'] .s,
.stars .chip[aria-pressed='true'] .n {
  color: var(--bg);
}

/* ---------- 攻略列表 ---------- */
.list-sec {
  margin-top: var(--sp-8);
}
.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.lh {
  display: flex;
  align-items: center;
  gap: 12px;
}
.lh .num {
  font-size: var(--fs-22);
}
.legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 10px 0 12px;
}
.legend .t-caption {
  margin-right: 4px;
}
.glist {
  border-top: 1px solid var(--line-strong);
}
.glist li {
  display: grid;
  grid-template-columns: minmax(200px, 1.1fr) 52px minmax(0, 2fr) 190px;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}
.g-song {
  min-width: 0;
}
.g-song:hover :deep(.t) {
  color: var(--ka-ink);
}
.g-tier {
  justify-self: start;
}
.g-tip {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  font-size: var(--fs-13);
  line-height: 1.55;
  color: var(--ink-2);
}
.g-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.g-author {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.g-author:hover {
  color: var(--ka-ink);
}
.g-help {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
  color: var(--ink-3);
}
.foot {
  padding-top: 14px;
}

@media (max-width: 1099px) {
  .glist li {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px 12px;
  }
  .g-tip,
  .g-meta {
    grid-column: 1 / -1;
  }
}
@media (max-width: 767px) {
  .list-sec {
    margin-top: var(--sp-5);
  }
}
</style>
