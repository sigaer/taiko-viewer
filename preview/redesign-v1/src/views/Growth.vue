<script setup>
import { computed } from 'vue'
import Icon from '../components/Icon.vue'
import Radar from '../components/Radar.vue'
import TimeStack from '../components/TimeStack.vue'
import GoalCard from '../components/GoalCard.vue'
import Gate from '../components/Gate.vue'
import { player, DIMS, ratingHistory, dimHistory, milestones, goals, laneDays } from '../mock/data'
import { L, isReady } from '../store'
import { useQueryState } from '../routeState'

// 成长档案（V3）：一条时间轴 —— 指标折线、关注方向带、里程碑音符、练习密度条共用同一条横轴。
const RANGES = [30, 90, 180, 365]
const DIM_KEYS = DIMS.map((d) => d.key)
const q = useQueryState({
  range: { type: 'number', default: 90, values: RANGES },
  metric: { type: 'string', default: 'rating', values: ['rating', ...DIM_KEYS] },
  older: { type: 'boolean', default: false },
})

const DIM_BY = Object.fromEntries(DIMS.map((d) => [d.key, d]))
const dimName = (k) => L(DIM_BY[k].zh, DIM_BY[k].ja)
const dateOf = (ago) => new Date(2026, 10, 16 - ago)
const shortLabel = (ago) => {
  const d = dateOf(ago)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
const fullDate = (ago) => {
  const d = dateOf(ago)
  const y = d.getFullYear() === 2026 ? '' : `${d.getFullYear()}/`
  return `${y}${d.getMonth() + 1}/${d.getDate()}`
}

// 六维是每周一个点（60 周，最后一点 = 今天）；按天数取值时在两周之间线性插值
const WEEKS = 60
function dimAt(key, ago) {
  const arr = dimHistory[key]
  const idx = Math.max(0, Math.min(WEEKS - 1, WEEKS - 1 - ago / 7))
  const i0 = Math.floor(idx)
  const i1 = Math.min(WEEKS - 1, i0 + 1)
  return arr[i0] + (arr[i1] - arr[i0]) * (idx - i0)
}

const metricName = computed(() => (q.metric === 'rating' ? 'Rating' : dimName(q.metric)))
const points = computed(() => {
  const R = q.range
  if (q.metric === 'rating') return ratingHistory.filter((p) => p.daysAgo <= R).map((p) => ({ daysAgo: p.daysAgo, label: shortLabel(p.daysAgo), v: p.v }))
  const arr = dimHistory[q.metric]
  const out = []
  for (let i = 0; i < arr.length; i++) {
    const ago = (arr.length - 1 - i) * 7
    if (ago <= R) out.push({ daysAgo: ago, label: shortLabel(ago), v: arr[i] })
  }
  // 起点对齐到所选范围的第一天，让折线与其他行共用同一段横轴
  if (out.length && out[0].daysAgo < R) out.unshift({ daysAgo: R, label: shortLabel(R), v: Math.round(dimAt(q.metric, R) * 1000) / 1000 })
  return out
})
const first = computed(() => points.value[0])
const last = computed(() => points.value[points.value.length - 1])
const delta = computed(() => last.value.v - first.value.v)
const signed = (v) => (v >= 0 ? '+' : '') + v.toFixed(2)

// 叙述句：所选范围内涨得最多的一项
const best = computed(() => {
  const R = q.range
  return DIM_KEYS.map((k) => ({ key: k, d: player.dims[k] - dimAt(k, R) })).sort((a, b) => b.d - a.d)[0]
})

// 里程碑（共用横轴上的音符）
const msText = (m) => L(m.text, m.textJa)
const known = milestones.filter((m) => m.ago != null)
const marks = computed(() => known.filter((m) => m.ago <= q.range).map((m) => ({ daysAgo: m.ago, type: m.type, text: msText(m) })))

// 关注方向：每 5 周一个时期，取那段时间涨得最少的一项；最后一段是现在的关注方向（确定性推导，相邻相同的合并）
const BANDS = (() => {
  const P = 35
  const raw = []
  for (let p = 0; p * 5 + 5 <= WEEKS - 1; p++) {
    let key = player.focus
    if (p > 0) {
      const a = WEEKS - 1 - 5 * (p + 1)
      const b = WEEKS - 1 - 5 * p
      key = DIM_KEYS.reduce((m, k) => (dimHistory[k][b] - dimHistory[k][a] < dimHistory[m][b] - dimHistory[m][a] ? k : m))
    }
    raw.push({ key, fromDaysAgo: (p + 1) * P, toDaysAgo: p * P, current: p === 0 })
  }
  const merged = []
  for (const b of raw) {
    const prev = merged[merged.length - 1]
    if (prev && prev.key === b.key) prev.fromDaysAgo = b.fromDaysAgo
    else merged.push({ ...b })
  }
  return merged
})()
const bands = computed(() => BANDS.map((b) => ({ ...b, label: dimName(b.key) })))
const days = computed(() => laneDays.filter((d) => d.daysAgo <= q.range))

const stackLabel = computed(() => L(`${metricName.value}，近 ${q.range} 天`, `${metricName.value}、直近 ${q.range} 日`))

// 精彩时刻：范围内的按时间倒序；更早的收起
const inRange = computed(() => known.filter((m) => m.ago <= q.range))
const earlier = computed(() => known.filter((m) => m.ago > q.range))
const NOTE = { df: 'big dfc', fc: 'big fc', rating: 'roll', dan: 'big roll', goal: '' }
const KIND = { df: ['新全良', '全良'], fc: ['新全连', 'フルコンボ'], rating: ['Rating', 'Rating'], dan: ['段位', '段位'], goal: ['目标', '目標'] }
const when = (n) => (n === 0 ? L('今天', '今日') : L(`${n} 天前`, `${n} 日前`))

// 现在的我：现在 vs. 范围起点
const axes = computed(() => DIMS.map((d) => ({ key: d.key, label: L(d.zh, d.ja), value: player.dims[d.key], prev: Math.round(dimAt(d.key, q.range) * 100) / 100 })))
const focus = computed(() => DIM_BY[player.focus])
const activeGoal = goals.find((g) => g.status === 'active')
</script>

<template>
  <div class="page growth">
    <Gate v-if="!isReady" :what="L('成长档案', '成長記録')" />
    <template v-else>
      <h1 class="say title-wrap">
        {{ L(`这 ${q.range} 天，${dimName(best.key)}涨得最多`, `この ${q.range} 日で最も伸びたのは${dimName(best.key)}`) }}
        <b class="num up">{{ signed(best.d) }}</b>{{ L('。', '。') }}
      </h1>

      <div class="cols">
        <div class="maincol">
          <div class="ctl">
            <div class="now">
              <span class="now-k">{{ metricName }}</span>
              <b class="num now-v">{{ last.v.toFixed(2) }}</b>
              <span class="num up now-d">{{ signed(delta) }}</span>
              <span class="t-caption">{{ L(`近 ${q.range} 天`, `直近 ${q.range} 日`) }}</span>
            </div>
            <div class="seg" role="group" :aria-label="L('时间范围', '期間')">
              <button v-for="r in RANGES" :key="r" type="button" :aria-pressed="q.range === r" @click="q.range = r">{{ r }} {{ L('天', '日') }}</button>
            </div>
          </div>
          <div class="mchips" role="group" :aria-label="L('指标', '指標')">
            <button type="button" class="chip" :aria-pressed="q.metric === 'rating'" @click="q.metric = 'rating'">Rating</button>
            <button v-for="d in DIMS" :key="d.key" type="button" class="chip" :aria-pressed="q.metric === d.key" @click="q.metric = d.key">{{ L(d.zh, d.ja) }}</button>
          </div>

          <TimeStack
            class="stack"
            :points="points"
            :marks="marks"
            :bands="bands"
            :days="days"
            :height="200"
            :tone="q.metric === 'rating' ? 'var(--series)' : 'var(--series-alt)'"
            :label="stackLabel"
          />

          <div class="legend">
            <span><i class="sw band" aria-hidden="true" />{{ L('关注方向', '注目する方向') }}</span>
            <span><i class="sw band cur" aria-hidden="true" />{{ L('现在', '現在') }}</span>
            <span><i class="note dfc" aria-hidden="true" />{{ L('全良', '全良') }}</span>
            <span><i class="note fc" aria-hidden="true" />{{ L('全连', 'フルコンボ') }}</span>
            <span><i class="note roll" aria-hidden="true" />{{ L('Rating · 段位', 'Rating・段位') }}</span>
            <span><i class="tick" aria-hidden="true" />{{ L('游玩', 'プレイ') }}</span>
          </div>
          <p class="t-small note-line"><Icon name="info" :size="14" />{{ L('这是当时更值得留意的方向，不代表某项数值下降。', 'その時点で注目したい方向であり、数値が下がったという意味ではありません。') }}</p>

          <section class="section">
            <h2 class="t-h2 sec-h">{{ L('精彩时刻', 'ハイライト') }}</h2>
            <ol v-if="inRange.length" class="spine">
              <li v-for="m in inRange" :key="m.type + m.ago + m.text">
                <span class="sd">
                  <b class="num">{{ fullDate(m.ago) }}</b>
                  <span class="t-caption">{{ when(m.ago) }}</span>
                </span>
                <span class="sn" aria-hidden="true"><i class="note" :class="NOTE[m.type]" /></span>
                <span class="st">
                  <span class="t-caption">{{ L(KIND[m.type][0], KIND[m.type][1]) }}</span>
                  <RouterLink v-if="m.songId" :to="`/songs/${m.songId}?d=${m.d}&from=growth`" class="mtext title-wrap-2" :title="msText(m)">{{ msText(m) }}</RouterLink>
                  <span v-else class="mtext title-wrap-2">{{ msText(m) }}</span>
                </span>
              </li>
            </ol>
            <p v-else class="t-small empty">{{ L(`近 ${q.range} 天还没有新的里程碑。`, `直近 ${q.range} 日のマイルストーンはまだありません。`) }}</p>

            <template v-if="earlier.length">
              <ol v-if="q.older" class="spine older">
                <li v-for="m in earlier" :key="m.type + m.ago + m.text">
                  <span class="sd">
                    <b class="num">{{ fullDate(m.ago) }}</b>
                    <span class="t-caption">{{ when(m.ago) }}</span>
                  </span>
                  <span class="sn" aria-hidden="true"><i class="note" :class="NOTE[m.type]" /></span>
                  <span class="st">
                    <span class="t-caption">{{ L(KIND[m.type][0], KIND[m.type][1]) }}</span>
                    <RouterLink v-if="m.songId" :to="`/songs/${m.songId}?d=${m.d}&from=growth`" class="mtext title-wrap-2" :title="msText(m)">{{ msText(m) }}</RouterLink>
                    <span v-else class="mtext title-wrap-2">{{ msText(m) }}</span>
                  </span>
                </li>
              </ol>
              <button type="button" class="btn btn-ghost more-btn" :aria-expanded="q.older" @click="q.older = !q.older">
                <Icon :name="q.older ? 'chevU' : 'chevD'" :size="16" />{{ q.older ? L('收起更早的', '以前の分を閉じる') : L(`更早的 ${earlier.length} 个`, `以前の ${earlier.length} 件`) }}
              </button>
            </template>
          </section>
        </div>

        <aside class="sidecol">
          <section class="nowme">
            <h2 class="t-h2">{{ L('现在的我', 'いまの自分') }}</h2>
            <Radar :axes="axes" :focus="player.focus" :size="280" :label="L('六维', '6 つの力')" />
            <p class="t-small legend-line">
              <i class="solid" aria-hidden="true" />{{ L('现在', '現在') }}
              <i class="dash" aria-hidden="true" />{{ L(`${q.range} 天前`, `${q.range} 日前`) }}
            </p>
            <p class="focus-say">{{ L('现在更值得留意：', 'いま注目したい方向：') }}<b>{{ L(focus.zh, focus.ja) }}</b></p>
          </section>
          <GoalCard v-if="activeGoal" :goal="activeGoal" />
          <nav class="next" :aria-label="L('想继续的话', '続けるなら')">
            <h2 class="t-h2">{{ L('想继续的话', '続けるなら') }}</h2>
            <RouterLink to="/play/recommend"><Icon name="spark" :size="18" /><span class="grow">{{ L(`按${focus.zh}挑的曲子`, `${focus.ja}向けのおすすめ`) }}</span><Icon name="chevR" :size="16" /></RouterLink>
            <RouterLink to="/growth/weekly"><Icon name="calendar" :size="18" /><span class="grow">{{ L('这一周的回顾', '今週のふりかえり') }}</span><Icon name="chevR" :size="16" /></RouterLink>
            <RouterLink to="/play"><Icon name="play" :size="18" /><span class="grow">{{ L('构成 Rating 的成绩', 'Rating 対象の記録') }}</span><Icon name="chevR" :size="16" /></RouterLink>
          </nav>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.growth {
  font-size: var(--fs-16);
}
.say {
  margin-bottom: var(--sp-8);
  font-size: var(--fs-28);
  font-weight: 900;
  line-height: 1.3;
}
.say .num {
  margin-left: 4px;
}
.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 56px;
  align-items: start;
}
.maincol {
  min-width: 0;
}

/* ---------- 指标与范围 ---------- */
.ctl {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px 16px;
}
.now {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 10px;
}
.now-k {
  font-size: var(--fs-16);
  font-weight: 700;
  color: var(--ink-2);
}
.now-v {
  font-size: var(--fs-48);
  line-height: 1;
}
.now-d {
  font-size: var(--fs-18);
}
.mchips {
  display: flex;
  gap: 8px;
  margin: 16px 0 20px;
  overflow-x: auto;
  scrollbar-width: none;
}
.mchips::-webkit-scrollbar {
  display: none;
}
.stack {
  margin-top: 8px;
}

/* ---------- 图例 ---------- */
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin-top: 12px;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.legend .note {
  --n: 12px;
}
.sw {
  width: 22px;
  height: 12px;
  border-radius: var(--r-xs);
}
.sw.band {
  background: var(--series-band-bg);
  border: 1px solid var(--series-band-line);
}
.sw.band.cur {
  background: var(--series-band-cur);
}
.tick {
  width: 2px;
  height: 10px;
  border-radius: 1px;
  background: var(--ink-3);
}
.note-line {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

/* ---------- 精彩时刻：时间在前的竖向脊线 ---------- */
.sec-h {
  margin-bottom: 16px;
}
.spine {
  position: relative;
}
.spine::before {
  content: '';
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: calc(112px + 16px + 14px);
  width: 2px;
  margin-left: -1px;
  background: var(--line-strong);
}
.spine li {
  position: relative;
  display: grid;
  grid-template-columns: 112px 28px minmax(0, 1fr);
  align-items: start;
  gap: 0 16px;
  padding: 12px 0;
}
.sd {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding-top: 2px;
  text-align: right;
}
.sd b {
  font-size: var(--fs-16);
}
.sn {
  display: grid;
  place-items: center;
  height: 28px;
  background: var(--bg);
}
.st {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.mtext {
  font-size: var(--fs-16);
  font-weight: 700;
  line-height: 1.4;
}
a.mtext:hover {
  color: var(--link);
  text-decoration: underline;
}
.older {
  margin-top: 0;
}
.more-btn {
  margin-top: 8px;
  margin-left: calc(112px + 16px + 28px + 16px);
}
.empty {
  padding: 8px 0 12px;
}

/* ---------- 右栏 ---------- */
.sidecol {
  display: flex;
  flex-direction: column;
  gap: 32px;
  min-width: 0;
}
.nowme {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
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
  border-top: 2px solid var(--series);
}
.legend-line i.dash {
  border-top: 2px dashed var(--ink-3);
  margin-left: 12px;
}
.focus-say {
  margin-top: 4px;
  text-align: center;
}
.focus-say b {
  color: var(--series-focus-ink);
}
.next {
  display: flex;
  flex-direction: column;
}
.next h2 {
  margin-bottom: 8px;
}
.next a {
  display: flex;
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
    gap: 48px;
  }
  .sidecol {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 32px;
  }
  .next {
    grid-column: 1 / -1;
  }
}
@media (max-width: 767px) {
  .say {
    margin-bottom: var(--sp-6);
    font-size: var(--fs-22);
  }
  .ctl .seg {
    width: 100%;
  }
  .ctl .seg button {
    flex: 1;
    padding: 0 4px;
  }
  .now-v {
    font-size: var(--fs-36);
  }
  .mchips {
    /* D7：上下各留 3px，横滑容器才不会裁掉胶囊的 44px 扩展区（版面位置不变） */
    margin: 11px calc(var(--gutter) * -1) 13px;
    padding: 3px var(--gutter);
  }
  .sidecol {
    display: flex;
  }
  .spine::before {
    left: calc(76px + 12px + 12px);
  }
  .spine li {
    grid-template-columns: 76px 24px minmax(0, 1fr);
    gap: 0 12px;
  }
  .sd b {
    font-size: var(--fs-14);
  }
  .mtext {
    font-size: var(--fs-14);
  }
  .more-btn {
    margin-left: 0;
  }
}
/* F2：里程碑标题链接是这一行的主目标，手机上点击高度 ≥ 44px */
@media (max-width: 767px) {
  a.mtext {
    min-height: var(--hit);
  }
}
</style>
