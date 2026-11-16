<script setup>
import { computed, reactive, ref } from 'vue'
import Icon from '../components/Icon.vue'
import Cover from '../components/Cover.vue'
import Diff from '../components/Diff.vue'
import SongCell from '../components/SongCell.vue'
import Sheet from '../components/Sheet.vue'
import Gate from '../components/Gate.vue'
import EmptyLane from '../components/EmptyLane.vue'
import { goals as seed, recommendations, songById, chartOf, GOAL_TYPES, DIMS, fmt } from '../mock/data'
import { L, isReady, songTitle, toast, runSync, store } from '../store'
import { useQueryState } from '../routeState'

// 目标（V4）：当前目标是一条路径 —— 每次尝试沿横轴排开，终点是目标的判定圈；下面是按日期的练习记录。
// 历史按月分组，带竖向脊线。同一时间只有一个目标。
const goals = reactive(seed.map((g) => ({ ...g, attempts: g.attempts ? g.attempts.map((a) => ({ ...a })) : undefined })))
const active = computed(() => goals.find((g) => g.status === 'active'))
const history = computed(() => goals.filter((g) => g.status !== 'active').sort((a, b) => a.doneAgo - b.doneAgo))

const PAGE = 12
const q = useQueryState({
  f: { type: 'string', default: 'all', values: ['all', 'completed', 'cancelled'] },
  more: { type: 'boolean', default: false },
})
const filtered = computed(() => history.value.filter((g) => q.f === 'all' || g.status === q.f))
const visible = computed(() => (q.more ? filtered.value : filtered.value.slice(0, PAGE)))
const hidden = computed(() => filtered.value.length - visible.value.length)
const counts = computed(() => ({
  completed: history.value.filter((g) => g.status === 'completed').length,
  cancelled: history.value.filter((g) => g.status === 'cancelled').length,
}))
function setFilter(v) {
  q.more = false
  q.f = v
}

const dateOf = (ago) => new Date(2026, 10, 16 - ago)
const md = (ago) => {
  const d = dateOf(ago)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
const agoText = (n) => (n === 0 ? L('今天', '今日') : n === 1 ? L('昨天', '昨日') : L(`${n} 天前`, `${n} 日前`))
const months = computed(() => {
  const out = []
  for (const g of visible.value) {
    const d = dateOf(g.doneAgo)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    let m = out[out.length - 1]
    if (!m || m.key !== key) {
      m = { key, label: L(`${d.getFullYear()} 年 ${d.getMonth() + 1} 月`, `${d.getFullYear()}年${d.getMonth() + 1}月`), items: [] }
      out.push(m)
    }
    m.items.push(g)
  }
  return out
})

const song = (g) => songById[g.songId]
const chart = (g) => chartOf(g.songId, g.d)
const DIM_BY = Object.fromEntries(DIMS.map((d) => [d.key, d]))
const dimName = (k) => (DIM_BY[k] ? L(DIM_BY[k].zh, DIM_BY[k].ja) : '')
const typeName = (t) => (GOAL_TYPES[t] ? L(GOAL_TYPES[t].zh, GOAL_TYPES[t].ja) : '')

/* ---------- 路径：横轴 = 日期（设下目标 → 今天），纵向 = 不可数，判定圈在终点 ---------- */
const path = computed(() => {
  const g = active.value
  if (!g?.attempts?.length) return null
  const at = g.attempts
  const span = Math.max(1, g.createdAgo, ...at.map((a) => a.ago))
  const maxV = Math.max(1, g.baseline?.ng ?? 0, ...at.map((a) => a.ng))
  const nodes = at.map((a, i) => ({
    ...a,
    i,
    x: 6 + ((span - a.ago) / span) * 72,
    y: 78 - (a.ng / maxV) * 58,
    last: i === at.length - 1,
  }))
  const target = { x: 94, y: 78 }
  const line = nodes.map((n) => `${n.x},${n.y}`).join(' ')
  const tail = nodes.length ? `${nodes[nodes.length - 1].x},${nodes[nodes.length - 1].y} ${target.x},${target.y}` : ''
  return { nodes, target, line, tail }
})
const targetLabel = computed(() => active.value?.target?.label || typeName(active.value?.type))
const tryText = (a, i) => L(`第 ${i + 1} 次尝试，${md(a.ago)}，不可 ${a.ng}，成绩 ${fmt(a.score)}`, `${i + 1} 回目、${md(a.ago)}、不可 ${a.ng}、スコア ${fmt(a.score)}`)
// 练习记录：每次尝试一行（新 → 旧），不可「之前 → 之后」
const log = computed(() => {
  const g = active.value
  if (!g?.attempts) return []
  return g.attempts
    .map((a, i) => ({ ...a, before: i ? g.attempts[i - 1].ng : g.baseline?.ng !== a.ng ? g.baseline?.ng ?? null : null, i }))
    .reverse()
})

/* ---------- 换目标 / 先放下 ---------- */
const picker = ref(false)
const pick = reactive({ songId: null, type: null })
const dropOpen = ref(false)
function openPicker(songId = null, type = null) {
  pick.songId = songId
  pick.type = type
  picker.value = true
}
function create() {
  const cur = active.value
  if (cur) Object.assign(cur, { status: 'cancelled', doneAgo: 0, evidence: L('换成了新的目标', '新しい目標に変更') })
  const r = recommendations.find((x) => x.songId === pick.songId)
  if (!r) return
  const type = pick.type || r.options[0]
  goals.unshift({ id: 'g' + goals.length + '-' + r.songId, status: 'active', type, songId: r.songId, d: r.d, createdAgo: 0, dim: r.dim, baseline: { ng: 6, score: 940000 }, latest: { ng: 6, score: 940000 }, attempts: [{ ago: 0, ng: 6, score: 940000 }], target: { label: typeName(type) } })
  picker.value = false
  toast(L('新目标已设好。练完同步一次就能看到进展。', '新しい目標を設定しました。プレイ後に同期すると進み具合が見られます。'))
}
function drop() {
  Object.assign(active.value, { status: 'cancelled', doneAgo: 0, evidence: L('先放下了', 'いったん保留') })
  dropOpen.value = false
  toast(L('已放下这个目标，记录还在历史里', '目標を保留にしました。記録は履歴に残ります'), 'info')
}
</script>

<template>
  <div class="page">
    <Gate v-if="!isReady" :what="L('练习目标', '練習目標')" />
    <template v-else>
      <div class="cols">
        <div class="maincol">
          <!-- 当前目标 -->
          <section v-if="active" class="cur" aria-labelledby="cur-h">
            <div class="spread cur-h">
              <h1 id="cur-h" class="t-h2">{{ L('这次想练', '今回の練習') }}</h1>
              <span class="t-caption">{{ active.createdAgo === 0 ? L('今天设下', '今日設定') : L(`${active.createdAgo} 天前设下`, `${active.createdAgo} 日前に設定`) }}</span>
            </div>
            <div class="cur-top">
              <Cover :song="song(active)" size="xl" class="ccover" />
              <div class="grow">
                <p class="gtype">{{ typeName(active.type) }}</p>
                <h2 class="gtitle title-wrap">{{ songTitle(song(active)) }}</h2>
                <div class="row-wrap gmeta">
                  <Diff :d="active.d" :star="chart(active)?.star" :constant="chart(active)?.constant" lg />
                  <span class="tag tag-ka">{{ dimName(active.dim) }}</span>
                </div>
              </div>
            </div>

            <!-- 路径 -->
            <div v-if="path" class="path">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <line x1="2" :y1="path.target.y" x2="98" :y2="path.target.y" class="p-base" />
                <polyline :points="path.line" class="p-line" />
                <polyline :points="path.tail" class="p-tail" />
              </svg>
              <ol class="p-nodes" :aria-label="L('尝试记录', '挑戦の記録')">
                <li v-for="n in path.nodes" :key="n.i" class="p-node" :class="{ last: n.last }" :style="{ left: n.x + '%', top: n.y + '%' }">
                  <span class="sr-only">{{ tryText(n, n.i) }}</span>
                  <b class="num p-v" aria-hidden="true">{{ n.ng }}</b>
                  <i class="note ka" aria-hidden="true" />
                  <span class="t-caption num p-d" aria-hidden="true">{{ md(n.ago) }}</span>
                </li>
                <li class="p-node target" :style="{ left: path.target.x + '%', top: path.target.y + '%' }">
                  <span class="sr-only">{{ L(`目标：${targetLabel}`, `目標：${targetLabel}`) }}</span>
                  <span class="p-v t-caption" aria-hidden="true">{{ L('目标', '目標') }}</span>
                  <i class="ring" aria-hidden="true" />
                  <b class="p-d num" aria-hidden="true">{{ targetLabel }}</b>
                </li>
              </ol>
            </div>

            <!-- 练习记录 -->
            <div class="log">
              <h3 class="t-h3">{{ L('练习记录', '練習の記録') }}</h3>
              <ol>
                <li v-for="a in log" :key="a.i">
                  <span class="lg-d"><b class="num">{{ md(a.ago) }}</b><span class="t-caption">{{ agoText(a.ago) }}</span></span>
                  <span class="lg-c">{{ L('不可', '不可') }} <template v-if="a.before != null"><span class="num">{{ a.before }}</span> → </template><b class="num">{{ a.ng }}</b></span>
                  <span class="lg-s num">{{ fmt(a.score) }}</span>
                </li>
              </ol>
            </div>

            <div class="cur-acts">
              <RouterLink :to="`/songs/${active.songId}?d=${active.d}&from=goals`" class="btn">{{ L('查看谱面', '譜面を見る') }}</RouterLink>
              <button type="button" class="btn btn-primary" :disabled="store.syncing" @click="runSync"><Icon name="sync" :size="16" />{{ L('练后同步', 'プレイ後に同期') }}</button>
              <span class="grow" />
              <button type="button" class="btn btn-ghost" @click="openPicker()">{{ L('换一个目标', '目標を変える') }}</button>
              <button type="button" class="btn btn-ghost" @click="dropOpen = true">{{ L('先放下', '保留にする') }}</button>
            </div>
          </section>

          <section v-else class="panel">
            <EmptyLane :title="L('现在没有在练的目标', '進行中の目標はありません')" :text="L('挑一首歌、定一件小事，比如把不可再压低一点。', '一曲選んで、小さな目標をひとつ決めましょう。')">
              <button type="button" class="btn btn-primary" @click="openPicker()">{{ L('选一个目标', '目標を選ぶ') }}</button>
            </EmptyLane>
          </section>

          <!-- 历史 -->
          <section class="section">
            <div class="section-head">
              <h2 class="t-h2">{{ L('练过的目标', 'これまでの目標') }}</h2>
              <div class="seg" role="group" :aria-label="L('筛选', '絞り込み')">
                <button type="button" :aria-pressed="q.f === 'all'" @click="setFilter('all')">{{ L('全部', 'すべて') }}</button>
                <button type="button" :aria-pressed="q.f === 'completed'" @click="setFilter('completed')">{{ L('练成了', '達成') }} <span class="num">{{ counts.completed }}</span></button>
                <button type="button" :aria-pressed="q.f === 'cancelled'" @click="setFilter('cancelled')">{{ L('放下的', '保留') }} <span class="num">{{ counts.cancelled }}</span></button>
              </div>
            </div>

            <div v-for="m in months" :key="m.key" class="month">
              <h3 class="m-h">{{ m.label }}</h3>
              <ul class="hist">
                <li v-for="g in m.items" :key="g.id">
                  <span class="h-d num">{{ md(g.doneAgo) }}</span>
                  <span class="h-n" aria-hidden="true"><i class="note" :class="g.status === 'completed' ? '' : 'ghost'" /></span>
                  <RouterLink :to="`/songs/${g.songId}?d=${g.d}&from=goals`" class="h-body">
                    <Cover :song="song(g)" />
                    <span class="grow">
                      <b class="title-1l" :title="songTitle(song(g))">{{ songTitle(song(g)) }}</b>
                      <span class="h-meta">
                        <Diff :d="g.d" :star="chart(g)?.star" short />
                        <span class="t-small">{{ typeName(g.type) }}</span>
                      </span>
                      <span class="ev">{{ g.evidence }}</span>
                    </span>
                  </RouterLink>
                  <span class="tag" :class="g.status === 'completed' ? 'tag-ok' : ''">{{ g.status === 'completed' ? L('练成了', '達成') : L('放下了', '保留') }}</span>
                </li>
              </ul>
            </div>
            <p v-if="!months.length" class="t-small empty">{{ L('还没有这类目标。', 'この種類の目標はまだありません。') }}</p>
            <button v-if="hidden > 0" type="button" class="btn btn-ghost more-btn" @click="q.more = true"><Icon name="chevD" :size="16" />{{ L(`更早的 ${hidden} 条`, `以前の ${hidden} 件`) }}</button>
          </section>
        </div>

        <!-- 今天可以练 -->
        <aside class="sidecol">
          <div class="section-head"><h2 class="t-h2">{{ L('今天可以练', '今日の候補') }}</h2><RouterLink to="/play/recommend" class="more">{{ L('全部推荐', 'すべて見る') }}</RouterLink></div>
          <ul class="plan">
            <li v-for="r in recommendations" :key="r.songId">
              <SongCell :song="songById[r.songId]" :sub="L(r.reason, r.reasonJa || r.reason)" />
              <div class="row-wrap popts">
                <button v-for="g in r.options" :key="g" type="button" class="chip" @click="openPicker(r.songId, g)">{{ typeName(g) }}</button>
              </div>
            </li>
          </ul>
        </aside>
      </div>
    </template>

    <Sheet :open="picker" :title="L('这次想练什么', '今回は何を目指す？')" :width="520" @close="picker = false">
      <ul class="pick">
        <li v-for="r in recommendations" :key="r.songId" :class="{ on: pick.songId === r.songId }">
          <button type="button" class="prow" :aria-pressed="pick.songId === r.songId" @click="(pick.songId = r.songId), (pick.type = r.options[0])">
            <i class="note" :class="pick.songId === r.songId ? '' : 'ghost'" aria-hidden="true" />
            <SongCell :song="songById[r.songId]" :sub="dimName(r.dim)" class="grow" />
            <Diff :d="r.d" :star="chartOf(r.songId, r.d)?.star" short />
          </button>
          <div v-if="pick.songId === r.songId" class="row-wrap ptypes" role="group" :aria-label="L('目标类型', '目標の種類')">
            <button v-for="g in r.options" :key="g" type="button" class="chip" :aria-pressed="pick.type === g" @click="pick.type = g">{{ typeName(g) }}</button>
          </div>
        </li>
      </ul>
      <p v-if="active" class="t-small">{{ L('同一时间只保留一个目标，现在的目标会移到历史里。', '目標は同時に 1 つだけ。現在の目標は履歴に移ります。') }}</p>
      <template #foot>
        <button type="button" class="btn" @click="picker = false">{{ L('取消', 'キャンセル') }}</button>
        <button type="button" class="btn btn-primary" :disabled="!pick.songId" @click="create">{{ L('就练这个', 'これにする') }}</button>
      </template>
    </Sheet>

    <Sheet :open="dropOpen" :title="L('先放下这个目标？', 'この目標を保留にしますか？')" :width="420" @close="dropOpen = false">
      <p>{{ L('已有的尝试记录会留在历史里，随时可以再设回来。', 'これまでの挑戦は履歴に残り、いつでも再設定できます。') }}</p>
      <template #foot><button type="button" class="btn" @click="dropOpen = false">{{ L('继续练', '続ける') }}</button><button type="button" class="btn btn-ink" @click="drop">{{ L('先放下', '保留にする') }}</button></template>
    </Sheet>
  </div>
</template>

<style scoped>
.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 56px;
  align-items: start;
}
.maincol {
  min-width: 0;
  font-size: var(--fs-16);
}

/* ---------- 当前目标（开放，不加面板框） ---------- */
.cur {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.cur-top {
  display: flex;
  align-items: center;
  gap: 24px;
}
.ccover {
  width: 120px !important;
  font-size: 56px !important;
}
.gtype {
  font-weight: 700;
  color: var(--don-ink);
}
.gtitle {
  font-size: var(--fs-28);
  font-weight: 900;
  line-height: 1.25;
}
.gmeta {
  margin-top: 10px;
}

/* 路径 */
.path {
  position: relative;
  height: 170px;
  margin: 8px 0 4px;
}
.path svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.p-base {
  stroke: var(--line-strong);
  stroke-width: 1;
  stroke-dasharray: 3 4;
  vector-effect: non-scaling-stroke;
}
.p-line {
  fill: none;
  stroke: var(--ka);
  stroke-width: 2.5;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}
.p-tail {
  fill: none;
  stroke: var(--ink-3);
  stroke-width: 1.5;
  stroke-dasharray: 4 5;
  vector-effect: non-scaling-stroke;
}
.p-node {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.p-node .note {
  --n: 16px;
}
.p-node.last .note {
  --n: 22px;
}
.p-v,
.p-d {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
}
.p-v {
  bottom: calc(100% + 4px);
}
.p-d {
  top: calc(100% + 4px);
}
b.p-v {
  font-size: var(--fs-18);
}
.p-node.last b.p-v {
  font-size: var(--fs-22);
}
.ring {
  display: block;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 2.5px solid var(--ink);
  background: var(--bg);
}
.target b.p-d {
  font-size: var(--fs-14);
  color: var(--don-ink);
}
.target .p-v,
.target .p-d {
  left: auto;
  right: 0;
  transform: none;
}

/* 练习记录 */
.log h3 {
  margin-bottom: 6px;
}
.log ol {
  border-top: 1px solid var(--line-strong);
}
.log li {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.lg-d {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.lg-c {
  color: var(--ink-2);
}
.lg-c b {
  color: var(--ink);
}
.lg-s {
  color: var(--ink-2);
}
.cur-acts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* ---------- 历史：按月分组 + 竖向脊线 ---------- */
.month + .month {
  margin-top: 20px;
}
.m-h {
  margin: 0 0 4px;
  font-size: var(--fs-14);
  font-weight: 700;
  color: var(--ink-2);
}
.hist {
  position: relative;
}
.hist::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(48px + 12px + 10px);
  width: 2px;
  margin-left: -1px;
  background: var(--line-strong);
}
.hist li {
  display: grid;
  grid-template-columns: 48px 20px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
}
.h-d {
  font-size: var(--fs-14);
  color: var(--ink-2);
  text-align: right;
}
.h-n {
  display: grid;
  place-items: center;
  height: 20px;
  background: var(--bg);
}
.h-n .note.ghost {
  background: var(--bg);
}
.h-body {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  min-height: var(--hit);
}
.h-body:hover b {
  color: var(--ka-ink);
}
.h-body b {
  font-size: var(--fs-14);
}
.h-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 3px;
}
.ev {
  display: block;
  margin-top: 2px;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.more-btn {
  margin-top: 12px;
}
.empty {
  padding: 12px 0;
}

/* ---------- 今天可以练 ---------- */
.sidecol {
  min-width: 0;
}
.plan {
  border-top: 1px solid var(--line-strong);
}
.plan li {
  padding: 14px 0;
  border-bottom: 1px solid var(--line);
}
.plan :deep(.s) {
  white-space: normal;
}
.popts {
  margin: 10px 0 0 56px;
}
.pick li {
  border-bottom: 1px solid var(--line);
}
.prow {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: var(--hit);
  padding: 10px 0;
  text-align: left;
}
.prow .note {
  --n: 18px;
}
.ptypes {
  padding: 0 0 12px 30px;
}
.pick + p {
  margin-top: 12px;
}
@media (max-width: 1239px) {
  .cols {
    grid-template-columns: minmax(0, 1fr);
    gap: 48px;
  }
}
@media (max-width: 767px) {
  .cur-top {
    gap: 14px;
  }
  .ccover {
    width: 84px !important;
    font-size: 40px !important;
  }
  .gtitle {
    font-size: var(--fs-18);
  }
  .path {
    height: 150px;
  }
  .log li {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .lg-d {
    grid-column: 1 / -1;
  }
  .cur-acts .btn {
    flex: 1 1 40%;
  }
  .cur-acts .grow {
    display: none;
  }
  .hist::before {
    left: calc(40px + 8px + 10px);
  }
  .hist li {
    grid-template-columns: 40px 20px minmax(0, 1fr);
    gap: 8px;
  }
  .hist li > .tag {
    grid-column: 3;
    justify-self: start;
  }
  .popts {
    margin-left: 0;
  }
}
</style>
