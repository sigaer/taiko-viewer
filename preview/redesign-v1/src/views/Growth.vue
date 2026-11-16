<script setup>
import { computed, ref } from 'vue'
import Icon from '../components/Icon.vue'
import Radar from '../components/Radar.vue'
import LineChart from '../components/LineChart.vue'
import GoalCard from '../components/GoalCard.vue'
import Gate from '../components/Gate.vue'
import Cover from '../components/Cover.vue'
import { player, DIMS, ratingHistory, dimHistory, milestones, goals, songById } from '../mock/data'
import { L, isReady, songTitle } from '../store'

// 成长档案：回答三个问题 —— 我现在在哪、这段时间怎么变的、发生过哪些值得记住的事。
const range = ref(90)
const metric = ref('rating')
const RANGES = [30, 90, 180, 365]

const axes = computed(() => DIMS.map((d) => ({ key: d.key, label: L(d.zh, d.ja), value: player.dims[d.key], prev: dimHistory[d.key][Math.max(0, 25 - Math.round(range.value / 7))] })))
const points = computed(() => {
  const days = Math.min(range.value, 180)
  if (metric.value === 'rating') {
    return ratingHistory
      .filter((p) => p.daysAgo < days)
      .map((p) => {
        const d = new Date(2026, 10, 16 - p.daysAgo)
        return { label: `${d.getMonth() + 1}/${d.getDate()}`, v: p.v, daysAgo: p.daysAgo }
      })
  }
  const arr = dimHistory[metric.value].slice(-Math.max(4, Math.round(days / 7)))
  return arr.map((v, i) => {
    const d = new Date(2026, 10, 16 - (arr.length - 1 - i) * 7)
    return { label: `${d.getMonth() + 1}/${d.getDate()}`, v, daysAgo: (arr.length - 1 - i) * 7 }
  })
})
const marks = computed(() =>
  metric.value !== 'rating'
    ? []
    : milestones
        .filter((m) => m.ago > 0 && m.ago < Math.min(range.value, 180))
        .map((m) => ({ index: points.value.findIndex((p) => p.daysAgo === m.ago), text: m.text }))
        .filter((m) => m.index >= 0),
)
const delta = computed(() => points.value.at(-1).v - points.value[0].v)
const chartLabel = computed(() => {
  const name = metric.value === 'rating' ? 'Rating' : L(DIMS.find((d) => d.key === metric.value).zh, DIMS.find((d) => d.key === metric.value).ja)
  const a = points.value[0].v.toFixed(2)
  const b = points.value.at(-1).v.toFixed(2)
  return L(`近 ${range.value} 天${name}走势：从 ${a} 到 ${b}`, `直近 ${range.value} 日の${name}：${a} から ${b}`)
})
const best = computed(() => [...axes.value].sort((a, b) => b.value - b.prev - (a.value - a.prev))[0])
const focus = computed(() => DIMS.find((d) => d.key === player.focus))

// 关注方向的变化：每一段是一个时期
const FOCUS = [
  { key: 'stamina', w: 22 },
  { key: 'accuracy_power', w: 18 },
  { key: 'balanced', w: 10 },
  { key: 'complex', w: 32 },
  { key: 'speed', w: 18 },
]
const dimName = (k) => (k === 'balanced' ? L('均衡', 'バランス') : L(DIMS.find((d) => d.key === k).zh, DIMS.find((d) => d.key === k).ja))
const activeGoal = goals.find((g) => g.status === 'active')
const when = (n) => (n === 0 ? L('今天', '今日') : L(`${n} 天前`, `${n} 日前`))
const noteOf = (t) => ({ df: 'big dfc', fc: 'big fc', rating: 'ka', dan: 'big roll' })[t]
</script>

<template>
  <div class="page">
    <Gate v-if="!isReady" :what="L('成长档案', '成長記録')" />
    <template v-else>
      <div class="page-head">
        <p class="say">
          {{ L(`这 ${range} 天，${best.label}涨得最多`, `この ${range} 日で、${best.label}が最も伸びました`) }}
          <b class="num up">+{{ (best.value - best.prev).toFixed(2) }}</b>{{ L('。', '。') }}
        </p>
        <div class="seg" role="group" :aria-label="L('时间范围', '期間')">
          <button v-for="r in RANGES" :key="r" :aria-pressed="range === r" @click="range = r">{{ r }} {{ L('天', '日') }}</button>
        </div>
      </div>

      <div class="cols">
        <div class="maincol">
          <section class="panel chartp">
            <div class="mchips">
              <button class="chip" :aria-pressed="metric === 'rating'" @click="metric = 'rating'">Rating</button>
              <button v-for="d in DIMS" :key="d.key" class="chip" :aria-pressed="metric === d.key" @click="metric = d.key">{{ L(d.zh, d.ja) }}</button>
            </div>
            <div class="now">
              <b class="num">{{ points.at(-1).v.toFixed(2) }}</b>
              <span class="num up">+{{ delta.toFixed(2) }}</span>
              <span class="t-caption">{{ L('刻度 0–15.5', 'スケール 0–15.5') }}</span>
            </div>
            <LineChart :points="points" :marks="marks" :height="260" :tone="metric === 'rating' ? 'var(--don)' : 'var(--ka)'" :label="chartLabel" />
          </section>

          <section class="section">
            <div class="section-head"><h2 class="t-h2">{{ L('关注方向的变化', '注目する方向の移り変わり') }}</h2></div>
            <div class="focusband" role="img" :aria-label="L('关注方向时间线', '注目方向のタイムライン')">
              <div v-for="(f, i) in FOCUS" :key="i" class="fseg" :class="{ cur: i === FOCUS.length - 1, bal: f.key === 'balanced' }" :style="{ flex: f.w }">
                <span>{{ dimName(f.key) }}</span>
              </div>
            </div>
            <div class="spread t-caption num" style="margin-top: 6px"><span>{{ range }} {{ L('天前', '日前') }}</span><span>{{ L('今天', '今日') }}</span></div>
            <p class="t-small note-line"><Icon name="info" :size="14" />{{ L('这是当时更值得留意的方向，不代表某项数值下降。', 'その時点で注目したい方向であり、数値が下がったという意味ではありません。') }}</p>
          </section>

          <section class="section">
            <div class="section-head"><h2 class="t-h2">{{ L('精彩时刻', 'ハイライト') }}</h2></div>
            <ol class="moments">
              <li v-for="m in milestones" :key="m.text">
                <span class="mdate num">{{ when(m.ago) }}</span>
                <i class="note" :class="noteOf(m.type)" />
                <Cover v-if="m.songId" :song="songById[m.songId]" size="sm" />
                <RouterLink v-if="m.songId" :to="`/songs/${m.songId}?d=${m.d}`" class="mtext link-plain">{{ m.songId ? songTitle(songById[m.songId]) + ' ' : '' }}{{ m.type === 'df' ? L('全良', '全良') : L('全连', 'フルコンボ') }}</RouterLink>
                <span v-else class="mtext">{{ m.text }}</span>
              </li>
            </ol>
          </section>
        </div>

        <aside class="sidecol">
          <section class="panel nowme">
            <h2 class="t-h3">{{ L('现在的我', 'いまの自分') }}</h2>
            <Radar :axes="axes" :focus="player.focus" :size="300" />
            <p class="t-small legend-line"><i class="solid" />{{ L('现在', '現在') }}<i class="dash" />{{ range }} {{ L('天前', '日前') }}</p>
            <p class="focus-say">{{ L('想把手再放快一点，可以磨磨', 'もう少し手を速くしたいなら、') }}<b>{{ L(focus.zh, focus.ja) }}</b>{{ L('。', 'を磨いてみましょう。') }}</p>
          </section>
          <GoalCard :goal="activeGoal" />
          <nav class="next">
            <h2 class="t-h3">{{ L('想继续的话', '続けるなら') }}</h2>
            <RouterLink to="/play/recommend"><Icon name="spark" :size="18" />{{ L('看看按高速处理挑的曲子', '高速処理向けのおすすめを見る') }}<Icon name="chevR" :size="16" /></RouterLink>
            <RouterLink to="/growth/weekly"><Icon name="calendar" :size="18" />{{ L('这一周的回顾', '今週のふりかえり') }}<Icon name="chevR" :size="16" /></RouterLink>
            <RouterLink to="/play"><Icon name="play" :size="18" />{{ L('构成 Rating 的成绩', 'Rating 対象の記録') }}<Icon name="chevR" :size="16" /></RouterLink>
          </nav>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.say {
  font-size: var(--fs-22);
  font-weight: 900;
  line-height: 1.35;
}
.say .num {
  font-size: var(--fs-28);
  margin-left: 6px;
}
.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 32px;
  align-items: start;
}
.sidecol {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.chartp {
  padding: 16px 20px 12px;
}
.mchips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}
.now {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 16px 0 4px;
}
.now b {
  font-size: var(--fs-48);
  line-height: 1;
}
.now .up {
  font-size: var(--fs-18);
}
.focusband {
  display: flex;
  gap: 3px;
  height: 44px;
}
.fseg {
  display: flex;
  align-items: center;
  padding: 0 12px;
  min-width: 0;
  border-radius: var(--r-xs);
  background: var(--bg-sunk);
  border: 1px solid var(--line);
  font-size: var(--fs-13);
  font-weight: 500;
  color: var(--ink-2);
}
.fseg span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fseg.bal {
  background: repeating-linear-gradient(-45deg, var(--bg-sunk) 0 6px, transparent 6px 12px);
}
.fseg.cur {
  background: var(--ka);
  border-color: var(--ka);
  color: #fff;
  font-weight: 700;
}
:root[data-theme='dark'] .fseg.cur {
  color: var(--ai-950);
}
.note-line {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
}
.moments {
  position: relative;
  border-top: 1px solid var(--line-strong);
}
.moments li {
  display: grid;
  grid-template-columns: 72px 24px auto 1fr;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  border-bottom: 1px solid var(--line);
}
.moments li .note {
  justify-self: center;
}
.moments li > :nth-child(3):not(.cover) {
  grid-column: 3 / -1;
}
.mdate {
  font-size: var(--fs-14);
  color: var(--ink-3);
}
.mtext {
  font-weight: 700;
}
.link-plain:hover {
  color: var(--ka-ink);
}
.nowme {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 18px 20px 20px;
}
.nowme h2 {
  align-self: flex-start;
}
.legend-line {
  display: flex;
  align-items: center;
  gap: 6px;
}
.legend-line i {
  width: 18px;
  height: 0;
  border-top: 2px solid var(--don);
}
.legend-line i.dash {
  border-top: 2px dashed var(--ink-3);
  margin-left: 12px;
}
.focus-say {
  margin-top: 6px;
  text-align: center;
}
.focus-say b {
  color: var(--ka-ink);
}
.next {
  display: flex;
  flex-direction: column;
}
.next h2 {
  margin-bottom: 8px;
}
.next a {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  border-top: 1px solid var(--line);
  font-weight: 500;
  color: var(--ink-2);
}
.next a:hover {
  color: var(--ink);
}
@media (max-width: 1239px) {
  .cols {
    grid-template-columns: minmax(0, 1fr);
  }
  .sidecol {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .next {
    grid-column: 1 / -1;
  }
}
@media (max-width: 767px) {
  .say {
    font-size: var(--fs-18);
  }
  .seg {
    width: 100%;
  }
  .seg button {
    flex: 1;
    padding: 0 4px;
  }
  .chartp {
    padding: 14px 12px 8px;
  }
  .mchips {
    margin: 0 -12px;
    padding: 0 12px;
  }
  .now b {
    font-size: var(--fs-36);
  }
  .sidecol {
    display: flex;
  }
  .fseg {
    padding: 0 6px;
    font-size: var(--fs-11);
  }
  .moments li {
    grid-template-columns: 60px 24px auto 1fr;
    gap: 8px;
  }
}
</style>
