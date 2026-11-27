<script setup>
import { computed } from 'vue'
import { L } from '../store'

/**
 * 谱面图占位：用确定性的伪随机把一张谱面画出来（正式环境是 /api/content/songs/:id/chart-image 的 PNG）。
 * 原型里保留它，是为了让版式按真实谱面图的比例和密度来设计。
 * 每行小节数随容器宽度（C3）：每小节 ≥ 150px，取 4 / 2 / 1，容器查询即时重排。
 * props: seed、rows（行数，每行 4 小节的数据量）、density（每小节 0–1）、start（起始小节号）、
 *        label（读屏名称；默认「谱面图，第 a–b 小节」，随语言切换）、
 *        highlight（可选小节号：该小节加山吹色描边与底色，读屏名称里注明；不传时行为不变）
 */
const props = defineProps({
  seed: { type: Number, default: 1 },
  rows: { type: Number, default: 5 },
  density: { type: Array, default: () => [] },
  start: { type: Number, default: 1 },
  label: { type: String, default: '' },
  highlight: { type: Number, default: null },
})
const ariaLabel = computed(() => {
  const a = props.start
  const b = props.start + props.rows * 4 - 1
  const base = props.label || L(`谱面图，第 ${a}–${b} 小节`, `譜面画像：${a}–${b} 小節`)
  const h = props.highlight
  if (h == null || h < a || h > b) return base
  return base + L(`，标出了第 ${h} 小节`, `（${h} 小節目を強調）`)
})
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const sheet = computed(() => {
  const r = rng(props.seed * 7919 + 13)
  const out = []
  for (let row = 0; row < props.rows; row++) {
    const measures = []
    for (let m = 0; m < 4; m++) {
      const idx = row * 4 + m
      const dens = props.density[idx % Math.max(1, props.density.length)] ?? 0.5
      const notes = []
      const roll = r() < 0.06
      for (let s = 0; s < 16; s++) {
        const on = s % 4 === 0 ? r() < 0.55 + dens * 0.4 : s % 2 === 0 ? r() < dens * 0.8 : r() < dens * dens * 0.75
        if (!on || (roll && s > 3 && s < 13)) continue
        notes.push({ s, ka: r() < 0.42, big: s % 8 === 0 && r() < 0.12 })
      }
      measures.push({ no: props.start + idx, notes, roll, hot: dens > 0.72 })
    }
    out.push(measures)
  }
  return out
})
</script>

<template>
  <div class="sheet" role="img" :aria-label="ariaLabel">
    <div v-for="(row, i) in sheet" :key="i" class="line">
      <div v-for="m in row" :key="m.no" class="measure" :class="{ hot: m.hot, mark: highlight != null && m.no === highlight }" :data-measure="m.no">
        <span class="no num">{{ m.no }}</span>
        <i v-if="m.roll" class="rollbar" />
        <i v-for="n in m.notes" :key="n.s" class="n" :class="{ ka: n.ka, big: n.big }" :style="{ left: (n.s / 16) * 100 + '%' }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.sheet {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 14px 12px;
  background: var(--lane);
  border-radius: var(--r-ctl);
}
.line {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.measure {
  position: relative;
  height: 40px;
  border-left: 1px solid var(--lane-measure);
  border-top: 1px solid var(--lane-line);
  border-bottom: 1px solid var(--lane-line);
  background: color-mix(in srgb, var(--lane-ink) 3%, transparent);
}
.measure:last-child {
  border-right: 1px solid var(--lane-measure);
}
.measure.hot {
  background: color-mix(in srgb, var(--lane-don) 10%, transparent);
}
/* 高亮小节：山吹色 2px 描边（在谱面带深底上 ≥ 3:1）+ 浅底色；小节号加粗同色 */
.measure.mark {
  z-index: 1;
  background: color-mix(in srgb, var(--lane-roll, var(--roll)) 18%, transparent);
  box-shadow: 0 0 0 2px var(--lane-roll, var(--roll));
  border-radius: 2px;
}
.measure.mark .no {
  color: var(--lane-roll, var(--roll));
  font-weight: 700;
}
.no {
  position: absolute;
  left: 3px;
  top: -1px;
  font-size: 10px;
  color: var(--lane-ink-3);
  line-height: 1.4;
}
.n {
  position: absolute;
  top: 50%;
  width: 13px;
  height: 13px;
  margin: -6.5px 0 0 2px;
  border-radius: 50%;
  background: var(--lane-don);
  box-shadow: inset 0 0 0 1.5px var(--note-ring), 0 0 0 1px var(--note-outline);
}
.n.ka {
  background: var(--lane-ka);
}
.n.big {
  width: 19px;
  height: 19px;
  margin-top: -9.5px;
  box-shadow: inset 0 0 0 2px var(--note-ring), 0 0 0 1px var(--note-outline);
}
.rollbar {
  position: absolute;
  left: 25%;
  right: 22%;
  top: 50%;
  height: 13px;
  margin-top: -6.5px;
  border-radius: var(--r-note);
  background: var(--lane-roll);
  box-shadow: inset 0 0 0 1.5px var(--note-ring), 0 0 0 1px var(--note-outline);
}
@media (max-width: 767px) {
  .sheet {
    padding: 10px 8px;
    gap: 8px;
  }
  .measure {
    height: 34px;
  }
  .n {
    width: 11px;
    height: 11px;
    margin-top: -5.5px;
  }
  .n.big {
    width: 16px;
    height: 16px;
    margin-top: -8px;
  }
}
/* C3：每小节 ≥ 150px。容器内宽 < 600px 时每行 2 小节，< 300px 时每行 1 小节 */
@container (max-width: 627px) {
  .line {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 8px;
  }
  .measure:nth-child(2n) {
    border-right: 1px solid var(--lane-measure);
  }
}
@container (max-width: 323px) {
  .line {
    grid-template-columns: minmax(0, 1fr);
  }
  .measure {
    border-right: 1px solid var(--lane-measure);
  }
}
</style>
