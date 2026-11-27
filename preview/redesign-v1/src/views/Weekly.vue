<script setup>
import { computed } from 'vue'
import Icon from '../components/Icon.vue'
import Lane from '../components/Lane.vue'
import FactRow from '../components/FactRow.vue'
import SongCell from '../components/SongCell.vue'
import Diff from '../components/Diff.vue'
import Gate from '../components/Gate.vue'
import { weeklies, laneDays, DIMS, songById, chartOf, recommendations } from '../mock/data'
import { L, isReady, toast } from '../store'
import { useQueryState } from '../routeState'

// 这一周（V5）：?w=0 是本周，越大越早；谱面、合计、亮点、能力变化、每天的进展都来自所选那一周。
const LAST = weeklies.length - 1
const q = useQueryState({
  w: { type: 'number', default: 0 },
  day: { type: 'number', default: -1 },
})
const wi = computed(() => Math.max(0, Math.min(LAST, Math.round(q.w) || 0)))
const wk = computed(() => weeklies[wi.value])
const week = computed(() => laneDays.filter((d) => d.daysAgo >= wk.value.endAgo && d.daysAgo <= wk.value.startAgo))

function goWeek(n) {
  q.day = -1
  q.w = Math.max(0, Math.min(LAST, n))
}
const sel = computed({
  get: () => (week.value.some((d) => d.daysAgo === q.day) ? q.day : week.value.length ? week.value[week.value.length - 1].daysAgo : -1),
  set: (v) => (q.day = v),
})
const day = computed(() => week.value.find((d) => d.daysAgo === sel.value) || null)

const TOTALS = computed(() => {
  const t = wk.value.totals
  return [
    { k: L('碰过的谱面', 'プレイした譜面'), v: t.distinctCharts },
    { k: L('刷新成绩', '自己ベスト'), v: t.pb, note: '' },
    { k: L('新全连', '新フルコンボ'), v: t.fc, note: 'big fc' },
    { k: L('新全良', '新全良'), v: t.df, note: 'big dfc' },
    { k: L('评价升级', '評価アップ'), v: t.rankUpgrade, note: 'ka' },
    { k: L('练成的目标', '達成した目標'), v: t.completedGoals, note: 'big roll' },
  ]
})
const maxDelta = computed(() => Math.max(0.01, ...Object.values(wk.value.dimDeltas)))
const DIM_BY = Object.fromEntries(DIMS.map((d) => [d.key, d]))
const dimName = (k) => (DIM_BY[k] ? L(DIM_BY[k].zh, DIM_BY[k].ja) : '')
const signed = (v) => (v >= 0 ? '+' : '') + v.toFixed(2)
const noteOf = (t) => (t === 'rank-upgrade' ? 'ka' : t === 'goal-completed' ? 'big roll' : t === 'df' ? 'big dfc' : t === 'fc' ? 'big fc' : 'big')
const rec = recommendations[0]
const recChart = chartOf(rec.songId, rec.d)

function dayLabel(d) {
  if (d.daysAgo === 0) return L('今天', '今日')
  if (d.daysAgo === 1) return L('昨天', '昨日')
  return L(`${d.date.getMonth() + 1} 月 ${d.date.getDate()} 日`, `${d.date.getMonth() + 1}月${d.date.getDate()}日`)
}
</script>

<template>
  <div class="page">
    <Gate v-if="!isReady" :what="L('每周回顾', '今週のふりかえり')" />
    <template v-else>
      <header class="wk-head">
        <div class="wk-nav" role="group" :aria-label="L('切换周', '週の切り替え')">
          <button type="button" class="icon-btn" :disabled="wi >= LAST" :aria-label="L('上一周', '前の週')" @click="goWeek(wi + 1)"><Icon name="chevL" /></button>
          <span class="num wk-range" aria-live="polite">{{ L(wk.range, wk.rangeJa) }}</span>
          <button type="button" class="icon-btn" :disabled="wi <= 0" :aria-label="L('下一周', '次の週')" @click="goWeek(wi - 1)"><Icon name="chevR" /></button>
        </div>
        <button type="button" class="btn btn-sm" @click="toast(L('这一周的图片已生成', '今週の画像を作成しました'))"><Icon name="image" :size="14" />{{ L('生成这一周的图片', '今週の画像を作成') }}</button>
      </header>
      <h1 class="theme title-wrap">{{ L(wk.theme.zh, wk.theme.ja) }}</h1>

      <Lane v-if="week.length" v-model="sel" :days="week" :label="L(`${wk.range} 的练习`, `${wk.rangeJa} のプレイ`)" />
      <p v-else class="t-small">{{ L('这一周没有每日记录。', 'この週の日別記録はありません。') }}</p>

      <ul class="totals">
        <li v-for="t in TOTALS" :key="t.k">
          <b class="num">{{ t.v }}</b>
          <span><i v-if="t.note != null" class="note" :class="t.note" aria-hidden="true" />{{ t.k }}</span>
        </li>
      </ul>

      <div class="cols section">
        <section>
          <div class="section-head"><h2 class="t-h2">{{ L('这一周的亮点', '今週のハイライト') }}</h2></div>
          <ul v-if="wk.highlights.length" class="hl">
            <li v-for="h in wk.highlights" :key="h.text">
              <i class="note" :class="noteOf(h.type)" aria-hidden="true" />
              <p>{{ L(h.text, h.textJa) }}</p>
              <RouterLink :to="`/songs/${h.songId}?d=${h.d}&from=weekly`" class="icon-btn" :aria-label="L(`查看歌曲：${songById[h.songId]?.zh ?? ''}`, `楽曲を見る：${songById[h.songId]?.ja ?? ''}`)"><Icon name="chevR" :size="18" /></RouterLink>
            </li>
          </ul>
          <p v-else class="t-small">{{ L('这一周没有新的记录。', 'この週は記録更新がありません。') }}</p>

          <template v-if="day">
            <div class="section-head day-h">
              <h2 class="t-h2">{{ dayLabel(day) }}</h2>
              <span v-if="day.played" class="t-small">{{ L(`碰了 ${day.charts} 张谱`, `${day.charts} 譜面をプレイ`) }}</span>
            </div>
            <div v-if="day.facts.length" class="ruled"><FactRow v-for="(f, i) in day.facts" :key="i" :fact="f" /></div>
            <p v-else class="t-small">{{ day.played ? L('这天打了几首，没有新的记录。', 'この日は記録更新なし。') : L('这天没有游玩。', 'この日はプレイなし。') }}</p>
          </template>
        </section>

        <aside>
          <div class="section-head">
            <h2 class="t-h2">{{ L('能力变化', '力の変化') }}</h2>
            <span class="num up big">{{ signed(wk.ratingDelta) }} <small>Rating</small></span>
          </div>
          <ul class="deltas">
            <li v-for="d in DIMS" :key="d.key" :class="{ top: wk.dimDeltas[d.key] === maxDelta }">
              <span>{{ L(d.zh, d.ja) }}</span>
              <span class="dbar" aria-hidden="true"><i :style="{ width: (Math.max(0, wk.dimDeltas[d.key]) / maxDelta) * 100 + '%' }" /></span>
              <b class="num">{{ signed(wk.dimDeltas[d.key]) }}</b>
            </li>
          </ul>
          <p class="shift">
            <span class="t-caption">{{ L('关注方向', '注目する方向') }}</span>
            <span class="tag">{{ dimName(wk.focusFrom) }}</span>
            <Icon name="chevR" :size="14" />
            <span class="tag tag-ka">{{ dimName(wk.focusTo) }}</span>
          </p>

          <div class="section-head next-h"><h2 class="t-h2">{{ L('下周可以试试', '来週の一曲') }}</h2></div>
          <RouterLink :to="`/songs/${rec.songId}?d=${rec.d}&from=weekly`" class="panel nextrec">
            <SongCell :song="songById[rec.songId]" size="lg" :sub="L(rec.reason, rec.reasonJa || rec.reason)" class="grow" />
            <Diff :d="rec.d" :star="recChart?.star" :constant="recChart?.constant" short />
          </RouterLink>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.wk-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 12px;
}
.wk-nav {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: -10px;
}
.wk-range {
  font-size: var(--fs-16);
  color: var(--ink-2);
  white-space: nowrap;
}
.theme {
  margin: 12px 0 24px;
  font-size: clamp(1.5rem, 3.2vw, 2.75rem);
  font-weight: 900;
  line-height: 1.2;
}
.totals {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  margin-top: 24px;
  border-bottom: 1px solid var(--line);
}
.totals li {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 4px 0 20px 20px;
  border-left: 1px solid var(--line);
}
.totals li:first-child {
  border-left: 0;
  padding-left: 0;
}
.totals b {
  font-size: var(--fs-48);
  font-weight: 700;
  line-height: 1;
}
.totals span {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.totals .note {
  --n: 12px;
}
.cols {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
  gap: 56px;
}
.hl {
  border-top: 1px solid var(--line-strong);
}
.hl li {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}
.hl .note {
  justify-self: center;
}
.hl p {
  font-size: var(--fs-16);
  font-weight: 500;
  overflow-wrap: anywhere;
}
.day-h,
.next-h {
  margin-top: 36px;
}
.ruled {
  border-top: 1px solid var(--line-strong);
}
.big {
  font-size: var(--fs-22);
  white-space: nowrap;
}
.big small {
  font-size: var(--fs-12);
  font-family: var(--font-ui);
  color: var(--ink-3);
  font-weight: 500;
}
.deltas li {
  display: grid;
  grid-template-columns: minmax(76px, auto) 1fr 52px;
  align-items: center;
  gap: 12px;
  min-height: 36px;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.dbar {
  height: 8px;
  border-radius: var(--r-xs);
  background: var(--bg-sunk);
}
.dbar i {
  display: block;
  height: 100%;
  min-width: 4px;
  border-radius: var(--r-xs);
  background: var(--ink-3);
}
.deltas li.top {
  color: var(--ink);
  font-weight: 700;
}
.deltas li.top .dbar i {
  background: var(--series-focus);
}
.deltas b {
  text-align: right;
  font-size: var(--fs-16);
  color: var(--ink);
}
.shift {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  color: var(--ink-3);
}
.nextrec {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
}
.nextrec :deep(.s) {
  white-space: normal;
}
.nextrec:hover {
  border-color: var(--ink-3);
}
@media (max-width: 1099px) {
  .totals {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    row-gap: 16px;
  }
  .totals li:nth-child(4) {
    border-left: 0;
    padding-left: 0;
  }
  .cols {
    grid-template-columns: minmax(0, 1fr);
    gap: 36px;
  }
}
@media (max-width: 767px) {
  .wk-nav {
    margin-left: -6px;
  }
  .totals b {
    font-size: var(--fs-36);
  }
  .totals li {
    padding: 0 0 16px 12px;
  }
  .hl p {
    font-size: var(--fs-14);
  }
}
</style>
