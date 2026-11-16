<script setup>
import { computed, ref } from 'vue'
import Icon from '../components/Icon.vue'
import Lane from '../components/Lane.vue'
import FactRow from '../components/FactRow.vue'
import SongCell from '../components/SongCell.vue'
import Diff from '../components/Diff.vue'
import Gate from '../components/Gate.vue'
import { weekly, laneDays, DIMS, songById, chartOf, recommendations } from '../mock/data'
import { L, isReady, toast } from '../store'

// 这一周：先给一句话的主题，再用同一条谱面把七天摆出来，然后才是数字。
const week = computed(() => laneDays.slice(-7))
const sel = ref(0)
const day = computed(() => week.value.find((d) => d.daysAgo === sel.value) || week.value.at(-1))
const TOTALS = computed(() => [
  { k: L('碰过的谱面', 'プレイした譜面'), v: weekly.totals.distinctCharts },
  { k: L('刷新成绩', '自己ベスト'), v: weekly.totals.pb, note: '' },
  { k: L('新全连', '新フルコンボ'), v: weekly.totals.fc, note: 'big fc' },
  { k: L('新全良', '新全良'), v: weekly.totals.df, note: 'big dfc' },
  { k: L('评价升级', '評価アップ'), v: weekly.totals.rankUpgrade, note: 'ka' },
  { k: L('练成的目标', '達成した目標'), v: weekly.totals.completedGoals, note: 'big roll' },
])
const maxDelta = Math.max(...Object.values(weekly.dimDeltas))
const dimName = (k) => L(DIMS.find((d) => d.key === k).zh, DIMS.find((d) => d.key === k).ja)
const rec = recommendations[0]
</script>

<template>
  <div class="page">
    <Gate v-if="!isReady" :what="L('每周回顾', '今週のふりかえり')" />
    <template v-else>
      <header class="wk-head">
        <div class="wk-nav">
          <button class="icon-btn" :aria-label="L('上一周', '前の週')"><Icon name="chevL" /></button>
          <span class="num wk-range">{{ weekly.range }}</span>
          <button class="icon-btn" disabled :aria-label="L('下一周', '次の週')"><Icon name="chevR" /></button>
        </div>
        <button class="btn btn-sm" @click="toast(L('本周图片已生成', '今週の画像を作成しました'))"><Icon name="image" :size="14" />{{ L('生成本周图片', '今週の画像を作成') }}</button>
      </header>
      <h1 class="theme">{{ L(weekly.theme.zh, weekly.theme.ja) }}</h1>

      <Lane v-model="sel" :days="week" />

      <ul class="totals">
        <li v-for="t in TOTALS" :key="t.k">
          <b class="num">{{ t.v }}</b>
          <span><i v-if="t.note != null" class="note" :class="t.note" />{{ t.k }}</span>
        </li>
      </ul>

      <div class="cols section">
        <section>
          <div class="section-head"><h2 class="t-h2">{{ L('这一周的亮点', '今週のハイライト') }}</h2></div>
          <ul class="hl">
            <li v-for="h in weekly.highlights" :key="h.text">
              <i class="note" :class="h.type === 'rank-upgrade' ? 'ka' : h.type === 'goal-completed' ? 'big roll' : h.type === 'df' ? 'big dfc' : h.type === 'fc' ? 'big fc' : 'big'" />
              <p>{{ h.text }}</p>
              <RouterLink :to="`/songs/${h.songId}?d=${h.d}`" class="icon-btn" :aria-label="L('查看歌曲', '楽曲を見る')"><Icon name="chevR" :size="18" /></RouterLink>
            </li>
          </ul>

          <div class="section-head" style="margin-top: 36px">
            <h2 class="t-h2">{{ day.daysAgo === 0 ? L('今天', '今日') : `${day.date.getMonth() + 1}/${day.date.getDate()}` }}</h2>
            <span class="t-caption">{{ L('点上面谱面里的某一天切换', '上のレーンで日付を切り替え') }}</span>
          </div>
          <div v-if="day.facts.length" class="ruled"><FactRow v-for="(f, i) in day.facts" :key="i" :fact="f" /></div>
          <p v-else class="t-small">{{ day.played ? L('这天打了几首，没有新的记录。', 'この日は記録更新なし。') : L('这天没有游玩。', 'この日はプレイなし。') }}</p>
        </section>

        <aside>
          <div class="section-head">
            <h2 class="t-h2">{{ L('能力变化', '力の変化') }}</h2>
            <span class="num up big">+{{ weekly.ratingDelta.toFixed(2) }} <small>Rating</small></span>
          </div>
          <ul class="deltas">
            <li v-for="d in DIMS" :key="d.key" :class="{ top: weekly.dimDeltas[d.key] === maxDelta }">
              <span>{{ L(d.zh, d.ja) }}</span>
              <span class="dbar"><i :style="{ width: (weekly.dimDeltas[d.key] / maxDelta) * 100 + '%' }" /></span>
              <b class="num">+{{ weekly.dimDeltas[d.key].toFixed(2) }}</b>
            </li>
          </ul>
          <p class="shift">
            <span class="t-caption">{{ L('关注方向', '注目する方向') }}</span>
            <span class="tag">{{ dimName(weekly.focusFrom) }}</span>
            <Icon name="chevR" :size="14" />
            <span class="tag tag-ka">{{ dimName(weekly.focusTo) }}</span>
          </p>

          <div class="section-head" style="margin-top: 36px"><h2 class="t-h2">{{ L('下周可以试试', '来週の一曲') }}</h2></div>
          <RouterLink :to="`/songs/${rec.songId}?d=${rec.d}`" class="panel nextrec">
            <SongCell :song="songById[rec.songId]" size="lg" :sub="rec.reason" class="grow" />
            <Diff :d="rec.d" :star="chartOf(rec.songId, rec.d).star" :constant="chartOf(rec.songId, rec.d).constant" short />
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
}
.wk-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: -10px;
}
.wk-range {
  font-size: var(--fs-16);
  color: var(--ink-2);
}
.theme {
  margin: 12px 0 24px;
  font-size: clamp(1.5rem, 3.2vw, 2.75rem);
  font-weight: 900;
  line-height: 1.2;
  text-wrap: balance;
}
.totals {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  margin-top: 24px;
  border-bottom: 1px solid var(--line);
}
.totals li {
  display: flex;
  flex-direction: column;
  gap: 4px;
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
  grid-template-columns: 24px 1fr auto;
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
}
.ruled {
  border-top: 1px solid var(--line-strong);
}
.big {
  font-size: var(--fs-22);
}
.big small {
  font-size: var(--fs-12);
  font-family: var(--font-ui);
  color: var(--ink-3);
  font-weight: 500;
}
.deltas li {
  display: grid;
  grid-template-columns: 76px 1fr 48px;
  align-items: center;
  gap: 12px;
  height: 36px;
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
  background: var(--ka);
}
.deltas b {
  text-align: right;
  font-size: var(--fs-16);
  color: var(--ink);
}
.shift {
  display: flex;
  align-items: center;
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
    grid-template-columns: repeat(3, 1fr);
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
