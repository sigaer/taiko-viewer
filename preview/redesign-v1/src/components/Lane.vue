<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { FACT } from '../mock/data'
import { L } from '../store'

// 譜面レーン：全站的签名组件。把「哪天打了、打出了什么」画成一条谱面。
// 朱 = 刷新成绩类；浅葱 = 稳定性提升类；大音符 = 新王冠 / 目标达成；山吹色连打条 = 连续游玩。
// 时间从左到右，判定圈落在「今天」。
const props = defineProps({
  days: { type: Array, required: true },
  modelValue: { type: Number, default: null }, // 选中的 daysAgo
  compact: { type: Boolean, default: false },
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
      wd: L(WEEK[day.date.getDay()], WEEK_JA[day.date.getDay()]),
    }
  }),
)

// 溢出时（手机）默认停在最右端，让「今天」和判定圈可见；选中某天不改变滚动位置。
const el = ref(null)
function toToday() {
  nextTick(() => {
    if (el.value) el.value.scrollLeft = el.value.scrollWidth
  })
}
onMounted(toToday)
watch(() => props.days, toToday)

function aria(c) {
  if (!c.played) return `${c.label} ${L('没有游玩', 'プレイなし')}`
  const facts = c.facts.length ? `${c.facts.length} ${L('条进展', '件の記録')}` : L('有游玩', 'プレイあり')
  return `${c.label} ${facts}`
}
</script>

<template>
  <div ref="el" class="lane" :class="{ compact }" role="group" :aria-label="L('最近的练习谱面', '最近のプレイ譜面')">
    <div class="track">
      <button
        v-for="c in cols"
        :key="c.daysAgo"
        class="col"
        :class="{ on: modelValue === c.daysAgo, monday: c.monday, today: c.daysAgo === 0, rest: !c.played }"
        :aria-pressed="modelValue === c.daysAgo"
        :aria-label="aria(c)"
        @click="emit('update:modelValue', c.daysAgo)"
      >
        <span class="count num">{{ c.facts.length > 1 ? c.facts.length : '' }}</span>
        <span class="beat">
          <i v-if="c.rollL" class="roll l" />
          <i v-if="c.rollR" class="roll r" />
          <i v-if="c.daysAgo === 0" class="hit" />
          <i v-if="c.kind !== 'rest'" class="n" :class="c.kind" />
          <i v-else class="tick" />
        </span>
        <span class="date">
          <b class="num">{{ c.daysAgo === 0 ? L('今天', '今日') : c.label }}</b>
          <em v-if="!compact">{{ c.wd }}</em>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.lane {
  --band: 60px;
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
.track {
  display: flex;
  min-width: max-content;
}
.col {
  position: relative;
  flex: 1 0 34px;
  display: grid;
  grid-template-rows: 22px var(--band) 40px;
  justify-items: center;
  color: inherit;
  border-radius: 0;
}
.compact .col {
  grid-template-rows: 16px var(--band) 26px;
  flex-basis: 22px;
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
  box-shadow: inset 0 0 0 2px var(--lane-ka);
  border-radius: var(--r-ctl);
}
.count {
  align-self: end;
  font-size: var(--fs-12);
  color: color-mix(in srgb, var(--lane-ink) 60%, transparent);
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
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--lane-don);
  box-shadow: inset 0 0 0 2.5px var(--lane-ring), 0 0 0 1.5px var(--lane-outline);
  transition: transform var(--dur-2) var(--ease-hit);
}
.col.on .n,
.col:hover .n {
  transform: scale(1.14);
}
.n.ka {
  background: var(--lane-ka);
}
.n.ghost {
  width: 14px;
  height: 14px;
  background: var(--lane-ghost);
  box-shadow: inset 0 0 0 2px var(--lane-ghost-ring), 0 0 0 1.5px var(--lane-outline);
}
.n.fc,
.n.dfc,
.n.goal {
  width: 30px;
  height: 30px;
  box-shadow: inset 0 0 0 3.5px var(--lane-ring), 0 0 0 1.5px var(--lane-outline);
}
.n.fc {
  box-shadow: inset 0 0 0 3.5px var(--lane-fc), 0 0 0 1.5px var(--lane-outline);
}
.n.dfc {
  /* 全良：朱色鼓面 + 白环 + 虹色外环 */
  width: 36px;
  height: 36px;
  background: radial-gradient(circle closest-side, var(--lane-don) 0 50%, var(--lane-ring) 52% 72%, transparent 74%), var(--crown-dfc);
  box-shadow: 0 0 0 1.5px var(--lane-outline);
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
.hit {
  /* 判定圈 */
  position: absolute;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--lane-ink) 75%, transparent);
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
  color: color-mix(in srgb, var(--lane-ink) 72%, transparent);
  white-space: nowrap;
}
.date em {
  font-style: normal;
  font-size: var(--fs-11);
  color: color-mix(in srgb, var(--lane-ink) 40%, transparent);
}
.col.on .date b,
.col.today .date b {
  color: var(--lane-ink);
  font-weight: 700;
}
.col.rest .date b {
  color: color-mix(in srgb, var(--lane-ink) 40%, transparent);
}
</style>
