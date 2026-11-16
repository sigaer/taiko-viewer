<script setup>
import { computed, ref } from 'vue'
import Icon from '../components/Icon.vue'
import SongCell from '../components/SongCell.vue'
import Diff from '../components/Diff.vue'
import Crown from '../components/Crown.vue'
import Rank from '../components/Rank.vue'
import Gate from '../components/Gate.vue'
import { recommendations, songs, scores, songById, chartOf, scoreOf, DIMS, RANKS, GOAL_TYPES, player, fmt } from '../mock/data'
import { L, isReady, toast } from '../store'
import { useQueryState } from '../routeState'

// 推荐：「平常练什么」按六维挑定数落在能力 90%–105% 的谱；「冲一个目标」按离目标的差距排序。
const TARGETS = [
  { v: 'goku', zh: '极', ja: '極', rank: 8 },
  { v: 'ziya', zh: '紫雅', ja: '紫雅', rank: 7 },
  { v: 'fenya', zh: '粉雅', ja: '桃雅', rank: 6 },
  { v: 'full_combo', zh: '全连', ja: 'フルコンボ' },
  { v: 'dondaful', zh: '全良', ja: '全良' },
]
const f = useQueryState({
  mode: { type: 'string', default: 'daily', values: ['daily', 'chase'] },
  dim: { type: 'string', default: 'all', values: ['all', ...DIMS.map((d) => d.key)] },
  target: { type: 'string', default: 'ziya', values: TARGETS.map((t) => t.v) },
})
const dimOf = (k) => DIMS.find((d) => d.key === k)
const keyOf = (r) => `${r.songId}-${r.d}`
const link = (r) => `/songs/${r.songId}?d=${r.d}&from=recommend`

/* ---------- 平常练什么 ---------- */
// 谱面在某个方向上的数值：能力值对应到六维；精度力与大歌力用定数（大歌力按物量修正）
const AXIS = { stamina: 'stamina', speed: 'handspeed', rhythm: 'rhythm', complex: 'complex' }
function dimValue(c, k) {
  if (AXIS[k]) return c.abilities?.[AXIS[k]] ?? c.constant
  if (k === 'big_song') return c.constant + Math.max(-1, Math.min(1, ((c.notes ?? 900) - 900) / 600))
  return c.constant
}
const pool = []
for (const s of songs) for (const c of s.charts) if (c.d >= 4 && c.constant != null) pool.push({ songId: s.id, d: c.d, c })

function optionsFor(sc) {
  if (!sc) return ['played', 'clear']
  if (sc.crown < 0) return ['clear', 'score-pb']
  if (sc.crown === 0) return ['fc', 'ng-reduced']
  if (sc.crown === 1) return ['df', 'rank-upgrade']
  return ['score-pb']
}
const memo = new Map()
function candidates(k, n, skip) {
  const p = player.dims[k]
  if (!memo.has(k)) {
    const lo = p * 0.9
    const hi = p * 1.05
    memo.set(
      k,
      pool
        .filter((x) => x.c.constant >= lo && x.c.constant <= hi)
        .map((x) => ({ ...x, v: dimValue(x.c, k) }))
        .sort((a, b) => Math.abs(a.v - p) - Math.abs(b.v - p) || a.songId - b.songId || a.d - b.d)
        .slice(0, 40),
    )
  }
  const out = []
  for (const x of memo.get(k)) {
    if (out.length >= n) break
    if (skip.has(`${x.songId}-${x.d}`)) continue
    skip.add(`${x.songId}-${x.d}`)
    const sc = scoreOf(x.songId, x.d)
    const dn = dimOf(k)
    out.push({
      songId: x.songId,
      d: x.d,
      dim: k,
      reason: L(`${dn.zh} ${x.v.toFixed(2)} · 定数 ${x.c.constant.toFixed(2)}`, `${dn.ja} ${x.v.toFixed(2)} · 定数 ${x.c.constant.toFixed(2)}`),
      unplayed: !sc,
      fit: Math.round((x.c.constant / p) * 100),
      options: optionsFor(sc),
    })
  }
  return out
}
const daily = computed(() => {
  const hand = recommendations.filter((r) => f.dim === 'all' || r.dim === f.dim).map((r) => ({ ...r, reason: L(r.reason, r.reasonJa || r.reason), unplayed: r.unplayed || !scoreOf(r.songId, r.d) }))
  const skip = new Set(recommendations.map(keyOf))
  const gen = f.dim === 'all' ? DIMS.flatMap((d) => candidates(d.key, 2, skip)) : candidates(f.dim, 12, skip)
  return [...hand, ...gen]
})
const pinLeft = (fit) => Math.max(0, Math.min(100, ((fit - 80) / 35) * 100)) + '%'

/* ---------- 冲一个目标 ---------- */
const chase = computed(() => {
  const t = TARGETS.find((x) => x.v === f.target) || TARGETS[1]
  const out = []
  for (const s of scores) {
    let gap
    let text
    let pct
    if (t.rank) {
      const min = RANKS[t.rank].min
      if (s.score >= min) continue
      gap = min - s.score
      text = L(`还差 ${fmt(gap)} 分`, `あと ${fmt(gap)} 点`)
      pct = 100 - gap / 1000
    } else if (t.v === 'full_combo') {
      if (s.crown >= 1) continue
      gap = s.ng
      text = L(`还有 ${s.ng} 个不可`, `不可があと ${s.ng}`)
      pct = 100 - gap * 6
    } else {
      if (s.crown === 2) continue
      gap = s.ok + s.ng * 2
      text = s.ng ? L(`还有 ${s.ok} 个可、${s.ng} 个不可`, `可があと ${s.ok}、不可があと ${s.ng}`) : L(`还有 ${s.ok} 个可`, `可があと ${s.ok}`)
      pct = 100 - gap * 3
    }
    out.push({ songId: s.songId, d: s.d, gap, text, pct: Math.round(Math.max(4, Math.min(99, pct))), score: s })
  }
  out.sort((a, b) => a.gap - b.gap || b.score.score - a.score.score || a.songId - b.songId)
  return out.slice(0, 12)
})
const chaseGoal = computed(() => (f.target === 'full_combo' ? 'fc' : f.target === 'dondaful' ? 'df' : 'rank-upgrade'))

const picked = ref(null)
function setGoal(r, g) {
  picked.value = `${keyOf(r)}-${g}`
  toast(L('已设为这次想练', '今回の練習に設定しました'))
}
</script>

<template>
  <div class="page">
    <Gate v-if="!isReady" :what="L('练习推荐', 'おすすめ')" />
    <template v-else>
      <div class="head">
        <div class="seg big" role="group" :aria-label="L('推荐方式', 'おすすめの種類')">
          <button :aria-pressed="f.mode === 'daily'" @click="f.mode = 'daily'">{{ L('平常练什么', 'ふだんの練習') }}</button>
          <button :aria-pressed="f.mode === 'chase'" @click="f.mode = 'chase'">{{ L('冲一个目标', '目標を狙う') }}</button>
        </div>
        <p v-if="f.mode === 'daily'" class="t-small">{{ L('定数在你能力的 90%–105%', '定数は実力の 90〜105%') }}</p>
      </div>

      <template v-if="f.mode === 'daily'">
        <div class="chips" role="group" :aria-label="L('能力方向', '能力の方向')">
          <button class="chip" :aria-pressed="f.dim === 'all'" @click="f.dim = 'all'">{{ L('全部方向', 'すべて') }}</button>
          <button v-for="d in DIMS" :key="d.key" class="chip" :aria-pressed="f.dim === d.key" @click="f.dim = d.key">
            {{ L(d.zh, d.ja) }}<template v-if="d.key === player.focus"><i class="dot focus-dot" aria-hidden="true" /><span class="sr-only">{{ L('（当前关注）', '（注目中）') }}</span></template>
          </button>
        </div>
        <ul class="recs">
          <li v-for="r in daily" :key="keyOf(r)" class="rec">
            <RouterLink :to="link(r)" class="rsong">
              <SongCell :song="songById[r.songId]" size="lg" :sub="r.reason" />
            </RouterLink>
            <div class="rmeta">
              <Diff :d="r.d" :star="chartOf(r.songId, r.d)?.star" :constant="chartOf(r.songId, r.d)?.constant" show-missing />
              <span class="tag tag-ka">{{ L(dimOf(r.dim).zh, dimOf(r.dim).ja) }}</span>
              <span v-if="r.unplayed" class="tag">{{ L('没打过', '未プレイ') }}</span>
              <template v-else-if="scoreOf(r.songId, r.d)">
                <Crown :v="scoreOf(r.songId, r.d).crown" size="sm" /><Rank :v="scoreOf(r.songId, r.d).rank" />
                <span class="num t-small">{{ fmt(scoreOf(r.songId, r.d).score) }}</span>
              </template>
            </div>
            <div class="fit" :title="L('定数相对你当前能力的比例', '現在の実力に対する定数の比率')">
              <span class="fitbar" aria-hidden="true"><i class="zone" /><i class="pin" :style="{ left: pinLeft(r.fit) }" /></span>
              <span class="num"><span class="sr-only">{{ L('难度比例', '難度の比率') }} </span>{{ r.fit }}%</span>
            </div>
            <div class="ract">
              <button v-for="g in r.options" :key="g" class="btn btn-sm" :class="{ 'btn-ink': picked === `${keyOf(r)}-${g}` }" :aria-pressed="picked === `${keyOf(r)}-${g}`" @click="setGoal(r, g)">
                <Icon v-if="picked === `${keyOf(r)}-${g}`" name="check" :size="14" />{{ L(GOAL_TYPES[g].zh, GOAL_TYPES[g].ja) }}
              </button>
            </div>
          </li>
        </ul>
      </template>

      <template v-else>
        <div class="chips" role="group" :aria-label="L('目标', '目標')">
          <button v-for="t in TARGETS" :key="t.v" class="chip" :aria-pressed="f.target === t.v" @click="f.target = t.v">{{ L(t.zh, t.ja) }}</button>
        </div>
        <ul v-if="chase.length" class="recs">
          <li v-for="r in chase" :key="keyOf(r)" class="rec chase">
            <RouterLink :to="link(r)" class="rsong"><SongCell :song="songById[r.songId]" size="lg" /></RouterLink>
            <div class="rmeta">
              <Diff :d="r.d" :star="r.score.star" :constant="r.score.constant" show-missing />
              <Crown :v="r.score.crown" size="sm" /><Rank :v="r.score.rank" />
              <span class="num t-small">{{ fmt(r.score.score) }}</span>
            </div>
            <div class="prog">
              <span class="pbar" aria-hidden="true"><i :style="{ width: r.pct + '%' }" /></span>
              <span class="t-small"><b>{{ r.text }}</b></span>
            </div>
            <div class="ract">
              <button class="btn btn-sm" :class="{ 'btn-ink': picked === `${keyOf(r)}-${chaseGoal}` }" :aria-pressed="picked === `${keyOf(r)}-${chaseGoal}`" @click="setGoal(r, chaseGoal)">
                <Icon v-if="picked === `${keyOf(r)}-${chaseGoal}`" name="check" :size="14" />{{ L('设为想练', '目標にする') }}
              </button>
            </div>
          </li>
        </ul>
        <p v-else class="empty t-small">{{ L('已经全部达成这个目标。', 'この目標はすべて達成しています。') }}</p>
      </template>
    </template>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.seg.big button {
  height: var(--ctl-h);
  padding: 0 18px;
  font-size: var(--fs-14);
}
.chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  margin-bottom: 8px;
}
.focus-dot {
  margin-left: 6px;
  color: var(--ka);
}
.recs {
  border-top: 1px solid var(--line-strong);
}
.rec {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1.2fr) 150px auto;
  align-items: center;
  gap: 24px;
  padding: 14px 0;
  border-bottom: 1px solid var(--line);
}
.rsong {
  min-width: 0;
}
.rsong:hover :deep(.t) {
  color: var(--ka-ink);
}
.rsong :deep(.t) {
  font-size: var(--fs-16);
}
.rsong :deep(.s) {
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.rmeta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.fit {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: var(--fs-16);
}
.fitbar {
  position: relative;
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--bg-sunk);
}
.zone {
  /* 90%–105% 的区间（刻度 80%–115%） */
  position: absolute;
  left: 28.5%;
  width: 43%;
  top: 0;
  bottom: 0;
  background: var(--ka-wash);
  border-left: 1px solid var(--ka);
  border-right: 1px solid var(--ka);
}
.pin {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  margin: -6px 0 0 -6px;
  border-radius: 50%;
  background: var(--don);
  box-shadow: inset 0 0 0 2px var(--note-ring), 0 0 0 1px var(--note-outline);
}
.ract {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
.prog {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pbar {
  height: 8px;
  border-radius: var(--r-xs);
  background: var(--bg-sunk);
  overflow: hidden;
}
.pbar i {
  display: block;
  height: 100%;
  border-radius: var(--r-xs);
  background: var(--ka);
}
.rec.chase {
  grid-template-columns: minmax(0, 1.4fr) auto minmax(0, 1fr) auto;
}
.empty {
  padding: 24px 0;
}
@media (max-width: 1099px) {
  .rec,
  .rec.chase {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px 16px;
  }
  .rsong {
    grid-column: 1 / -1;
  }
  .ract {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }
  .fit {
    width: 150px;
  }
}
@media (max-width: 767px) {
  .chips {
    /* D7：上下各留 3px，横滑容器才不会裁掉胶囊的 44px 扩展区（版面位置不变） */
    margin: -3px calc(var(--gutter) * -1) 5px;
    padding: 3px var(--gutter);
  }
  .seg.big {
    width: 100%;
  }
  .seg.big button {
    flex: 1;
    height: var(--hit);
  }
  .rmeta {
    grid-column: 1 / -1;
  }
  .fit,
  .prog {
    grid-column: 1 / -1;
    width: auto;
  }
  .ract .btn {
    flex: 1;
  }
}
</style>
