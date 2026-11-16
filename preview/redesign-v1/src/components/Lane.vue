<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { FACT } from '../mock/data'
import { L } from '../store'

/**
 * 譜面レーン：全站的签名组件。把「哪天打了、打出了什么」画成一条谱面。
 * 朱 = 刷新成绩类；浅葱 = 稳定性提升类；大音符 = 新王冠 / 目标达成；山吹色连打条 = 连续游玩。
 * 时间从左到右，判定圈落在「今天」。
 * props: days（[{ daysAgo, date, played, facts }]，按时间先后）、v-model（选中的 daysAgo）、compact、
 *        label（这组按钮的读屏名称；默认「最近的练习谱面」）
 *        to（只作概览：整条带是一个去这里的链接，每天不可点；C2）
 * 键盘：整条带只占一个 Tab 位；← → 在日期间移动，Home / End 到首尾，Enter / 空格选中。
 * 列宽（C2）：每天可点时 ≥ 44px，概览 ≥ 36px；放不下就横向滚动，默认停在今天，左缘渐隐。
 *   音符直径 ≤ 列宽 − 8px（三档按列宽等比缩小）；列宽 < 40px 时日期只写「日」，月初与今天写全。
 */
const props = defineProps({
  days: { type: Array, required: true },
  modelValue: { type: Number, default: null }, // 选中的 daysAgo
  compact: { type: Boolean, default: false },
  label: { type: String, default: '' },
  to: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const WEEK = ['日', '一', '二', '三', '四', '五', '六']
const WEEK_JA = ['日', '月', '火', '水', '木', '金', '土']

const cols = computed(() =>
  props.days.map((day, i) => {
    const top = [...day.facts].sort((a, b) => FACT[b.type].weight - FACT[a.type].weight)[0]
    const kind = !day.played ? 'rest' : top ? FACT[top.type].note : 'ghost'
    const prev = props.days[i - 1]
    const next = props.days[i + 1]
    return {
      ...day,
      kind,
      top,
      rollL: day.played && prev?.played,
      rollR: day.played && next?.played,
      monday: day.date.getDay() === 1,
      label: `${day.date.getMonth() + 1}/${day.date.getDate()}`,
      dayOnly: String(day.date.getDate()),
      monthStart: day.date.getDate() === 1,
      wd: L(WEEK[day.date.getDay()], WEEK_JA[day.date.getDay()]),
    }
  }),
)

// 列宽由容器宽度与天数算出（C2）；溢出时默认停在最右端（今天），左缘有内容时渐隐。滚动一律即时（D13）。
const el = ref(null)
const avail = ref(0)
const scrolledL = ref(false)
const minCol = computed(() => (props.to ? 36 : 44))
const colW = computed(() => {
  const n = props.days.length || 1
  return Math.max(minCol.value, avail.value ? Math.floor((avail.value / n) * 10) / 10 : minCol.value)
})
// 最大的音符（全良）基准 36px，选中 / 悬停时再放大 1.14 倍：放大后也不超过「列宽 − 8」，按此等比缩小
const noteScale = computed(() => Math.min(1, (colW.value - 8) / (36 * 1.14)))
const narrow = computed(() => colW.value < 40)
const laneStyle = computed(() => ({ '--col-w': colW.value + 'px', '--ns': noteScale.value.toFixed(3) }))
const root = () => el.value?.$el || el.value
function measure() {
  const e = root()
  if (!e) return
  const cs = getComputedStyle(e)
  avail.value = e.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
  onScroll()
}
function onScroll() {
  const e = root()
  if (e) scrolledL.value = e.scrollLeft > 1
}
function toToday() {
  nextTick(() => {
    const e = root()
    if (e) e.scrollLeft = e.scrollWidth
    onScroll()
  })
}
let ro = null
onMounted(() => {
  measure()
  toToday()
  if (typeof ResizeObserver !== 'undefined' && root()) {
    ro = new ResizeObserver(() => {
      measure()
      toToday()
    })
    ro.observe(root())
  }
})
onBeforeUnmount(() => ro?.disconnect())
watch(
  () => props.days,
  () => {
    measure()
    toToday()
  },
)

// 漫游焦点：选中的那天（没有选中时是今天 / 最后一天）可 Tab 到达，其余用方向键
const focusIdx = ref(-1)
const tabIdx = computed(() => {
  if (focusIdx.value >= 0 && focusIdx.value < cols.value.length) return focusIdx.value
  const sel = cols.value.findIndex((c) => c.daysAgo === props.modelValue)
  return sel >= 0 ? sel : cols.value.length - 1
})
function onKey(e) {
  if (props.to) return
  const n = cols.value.length
  if (!n) return
  let i = tabIdx.value
  if (e.key === 'ArrowLeft') i = Math.max(0, i - 1)
  else if (e.key === 'ArrowRight') i = Math.min(n - 1, i + 1)
  else if (e.key === 'Home') i = 0
  else if (e.key === 'End') i = n - 1
  else return
  e.preventDefault()
  focusIdx.value = i
  const btn = root()?.querySelectorAll('.col')[i]
  if (btn) {
    btn.focus({ preventScroll: true })
    btn.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' })
  }
}

function dateText(c) {
  if (c.daysAgo === 0) return L('今天', '今日')
  return narrow.value && !c.monthStart ? c.dayOnly : c.label
}
const overviewName = computed(() => {
  const played = cols.value.filter((c) => c.played).length
  return `${props.label || L('最近的练习谱面', '最近のプレイ譜面')}：${L(`${cols.value.length} 天里打了 ${played} 天`, `${cols.value.length} 日中 ${played} 日プレイ`)}`
})
function aria(c) {
  if (!c.played) return `${c.label} ${L('没有游玩', 'プレイなし')}`
  const facts = c.facts.length ? `${c.facts.length} ${L('条进展', '件の記録')}` : L('有游玩', 'プレイあり')
  return `${c.label} ${facts}`
}
</script>

<template>
  <RouterLink v-if="to" ref="el" :to="to" class="lane on-lane overview" :class="{ compact, narrow, 'fade-l': scrolledL }" :style="laneStyle" :aria-label="overviewName" @scroll.passive="onScroll">
    <span class="track" aria-hidden="true">
      <span v-for="c in cols" :key="c.daysAgo" class="col" :class="{ monday: c.monday, today: c.daysAgo === 0, rest: !c.played }">
        <span class="count num">{{ c.facts.length > 1 ? c.facts.length : '' }}</span>
        <span class="beat">
          <i v-if="c.rollL" class="roll l" />
          <i v-if="c.rollR" class="roll r" />
          <i v-if="c.daysAgo === 0" class="judge-ring" />
          <i v-if="c.kind !== 'rest'" class="n" :class="c.kind" />
          <i v-else class="tick" />
        </span>
        <span class="date"><b class="num">{{ dateText(c) }}</b></span>
      </span>
    </span>
  </RouterLink>
  <div v-else ref="el" class="lane on-lane" :class="{ compact, narrow, 'fade-l': scrolledL }" :style="laneStyle" role="group" :aria-label="label || L('最近的练习谱面', '最近のプレイ譜面')" @keydown="onKey" @scroll.passive="onScroll">
    <div class="track">
      <button
        v-for="(c, i) in cols"
        :key="c.daysAgo"
        class="col"
        :class="{ on: modelValue === c.daysAgo, monday: c.monday, today: c.daysAgo === 0, rest: !c.played }"
        :aria-pressed="modelValue === c.daysAgo"
        :aria-label="aria(c)"
        :tabindex="i === tabIdx ? 0 : -1"
        @focus="focusIdx = i"
        @click="emit('update:modelValue', c.daysAgo)"
      >
        <span class="count num">{{ c.facts.length > 1 ? c.facts.length : '' }}</span>
        <span class="beat">
          <i v-if="c.rollL" class="roll l" />
          <i v-if="c.rollR" class="roll r" />
          <i v-if="c.daysAgo === 0" class="judge-ring" />
          <i v-if="c.kind !== 'rest'" class="n" :class="c.kind" />
          <i v-else class="tick" />
        </span>
        <span class="date">
          <b class="num">{{ dateText(c) }}</b>
          <em v-if="!compact && !narrow">{{ c.wd }}</em>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.lane {
  --band: 60px;
  --col-w: 44px;
  --ns: 1;
  display: block;
  background: var(--lane);
  border-radius: var(--r-panel);
  color: var(--lane-ink);
  padding: 0 6px;
  overflow-x: auto;
  scrollbar-width: none;
}
.lane::-webkit-scrollbar {
  display: none;
}
/* 左缘还有内容：渐隐提示，不出现被硬切的半个标签（C2） */
.lane.fade-l {
  -webkit-mask-image: linear-gradient(to right, transparent 0, black 28px);
  mask-image: linear-gradient(to right, transparent 0, black 28px);
}
.overview {
  text-decoration: none;
}
.overview:focus-visible {
  box-shadow: var(--focus-lane);
}
.track {
  display: flex;
  min-width: max-content;
}
.col {
  position: relative;
  flex: 0 0 var(--col-w);
  min-width: 0;
  display: grid;
  grid-template-rows: 22px var(--band) 40px;
  justify-items: center;
  color: inherit;
  border-radius: 0;
}
.compact .col {
  grid-template-rows: 16px var(--band) 26px;
}
.col.monday::before {
  /* 小节线：每周一 */
  content: '';
  position: absolute;
  left: 0;
  top: 22px;
  height: var(--band);
  width: 1px;
  background: var(--lane-line);
}
.compact .col.monday::before {
  top: 16px;
}
.col:focus-visible {
  box-shadow: var(--focus-lane);
  border-radius: var(--r-ctl);
}
.count {
  align-self: end;
  font-size: var(--fs-12);
  color: var(--lane-ink-2);
}
.beat {
  position: relative;
  width: 100%;
  height: var(--band);
  display: grid;
  place-items: center;
}
/* 谱面带：上下两条轨线 */
.beat::before {
  content: '';
  position: absolute;
  inset: 8px 0;
  border-top: 1px solid var(--lane-line);
  border-bottom: 1px solid var(--lane-line);
  background: color-mix(in srgb, var(--lane-ink) 2.5%, transparent);
}
.col.on .beat::before {
  background: color-mix(in srgb, var(--lane-ink) 9%, transparent);
}
.col:hover .beat::before {
  background: color-mix(in srgb, var(--lane-ink) 6%, transparent);
}
.roll {
  position: absolute;
  top: 50%;
  height: 10px;
  margin-top: -5px;
  width: 50%;
  background: color-mix(in srgb, var(--lane-roll) 62%, transparent);
}
.roll.l {
  left: 0;
}
.roll.r {
  right: 0;
}
.n {
  position: relative;
  width: calc(20px * var(--ns));
  height: calc(20px * var(--ns));
  border-radius: 50%;
  background: var(--lane-don);
  box-shadow: inset 0 0 0 2.5px var(--note-ring), 0 0 0 1.5px var(--note-outline);
  transition: transform var(--dur-2) var(--ease-hit);
}
.col.on .n,
.col:hover .n {
  transform: scale(1.14);
}
/* 减少动效：没有回弹缩放（D13） */
@media (prefers-reduced-motion: reduce) {
  .col.on .n,
  .col:hover .n {
    transform: none;
  }
}
:root[data-motion='reduce'] .col.on .n,
:root[data-motion='reduce'] .col:hover .n {
  transform: none;
}
.n.ka {
  background: var(--lane-ka);
}
.n.ghost {
  width: calc(14px * var(--ns));
  height: calc(14px * var(--ns));
  background: var(--lane-ghost);
  box-shadow: inset 0 0 0 2px var(--lane-ghost-ring), 0 0 0 1.5px var(--note-outline);
}
.n.fc,
.n.dfc,
.n.goal {
  width: calc(30px * var(--ns));
  height: calc(30px * var(--ns));
  box-shadow: inset 0 0 0 3.5px var(--note-ring), 0 0 0 1.5px var(--note-outline);
}
.n.fc {
  box-shadow: inset 0 0 0 3.5px var(--lane-fc), 0 0 0 1.5px var(--note-outline);
}
.n.dfc {
  /* 全良：朱色鼓面 + 白环 + 虹色外环 */
  width: calc(36px * var(--ns));
  height: calc(36px * var(--ns));
  background: radial-gradient(circle closest-side, var(--lane-don) 0 50%, var(--note-ring) 52% 72%, transparent 74%), var(--crown-dfc);
  box-shadow: 0 0 0 1.5px var(--note-outline);
}
.n.goal {
  background: var(--lane-roll);
}
.tick {
  position: relative;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--lane-line);
}
.judge-ring {
  /* 判定圈 */
  position: absolute;
  width: min(46px, var(--col-w));
  height: min(46px, var(--col-w));
  border-radius: 50%;
  border: 2px solid var(--lane-ink-2);
  box-shadow: inset 0 0 0 5px color-mix(in srgb, var(--lane-ink) 8%, transparent);
}
.date {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 6px;
  line-height: 1.2;
}
.date b {
  font-size: var(--fs-12);
  font-weight: 500;
  color: var(--lane-ink-2);
  white-space: nowrap;
}
.date em {
  font-style: normal;
  font-size: var(--fs-11);
  color: var(--lane-ink-3);
}
.col.on .date b,
.col.today .date b {
  color: var(--lane-ink);
  font-weight: 700;
}
/* 休息日：用字重区分（轨道上是小点而不是音符），不靠透明度（D11） */
.col.rest .date b {
  color: var(--lane-ink-3);
  font-weight: 400;
}
</style>
