<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import Icon from '../components/Icon.vue'
import SongCell from '../components/SongCell.vue'
import Diff from '../components/Diff.vue'
import Crown from '../components/Crown.vue'
import { danGrades, danCourse, songs, songById, chartOf, scoreOf, player, threadById, fmt } from '../mock/data'
import { store, L, isReady, songTitle } from '../store'
import { useQueryState } from '../routeState'

const VERSIONS = [
  { k: '2026', label: '虹 2026' },
  { k: '2025', label: '2025' },
  { k: '2024', label: '2024' },
  { k: '2023', label: '2023' },
]
// R2：版本与段位写进地址
const qs = useQueryState({
  ver: { type: 'string', default: '2026', values: VERSIONS.map((v) => v.k) },
  grade: { type: 'string', default: danCourse.grade, values: danGrades },
})
const vi = computed(() => Math.max(0, VERSIONS.findIndex((v) => v.k === qs.ver)))
const grade = computed(() => qs.grade)

const gradeJa = (g) => g.replace('级', '級').replace('达', '達')
const gi = computed(() => danGrades.indexOf(grade.value))
const passedIdx = danGrades.indexOf(player.dan)
// 已通过的段位：较低段位为金合格，接近当前段位的为红合格
const stateOf = (i) => (!isReady.value || i > passedIdx ? null : i >= passedIdx - 2 ? 'red' : 'gold')
const grades = computed(() => danGrades.map((g, i) => ({ name: g, label: L(g, gradeJa(g)), state: stateOf(i) })))
const gradeLabel = computed(() => L(grade.value, gradeJa(grade.value)))
const STATE = { red: ['红合格', '赤合格'], gold: ['金合格', '金合格'] }
const stateLabel = (s) => (s ? L(...STATE[s]) : '')

// 课题曲池：按定数从低到高排，其他段位从池里按位置取三首
const POOL = songs.flatMap((s) => s.charts.filter((c) => c.d >= 4 && c.constant != null).map((c) => ({ songId: s.id, d: c.d, combo: c.notes, k: c.constant }))).sort((a, b) => a.k - b.k)
const r10 = (n) => Math.round(n / 10) * 10
const course = computed(() => {
  const i = gi.value
  if (grade.value === danCourse.grade && vi.value === 0) return danCourse
  const base = Math.round((i / (danGrades.length - 1)) * (POOL.length - 5))
  const picks = [0, 2, 4].map((o) => POOL[base + ((o + vi.value) % 5)]).sort((a, b) => a.k - b.k)
  const total = picks.reduce((n, p) => n + p.combo, 0)
  const pass = { good: r10(total * (0.7 + i * 0.012)), ng: Math.max(10, 70 - i * 3), roll: 100 + i * 4 }
  const gold = { good: pass.good + r10(total * 0.045), ng: Math.max(3, Math.round(pass.ng / 3)), roll: pass.roll + 30 }
  const st = vi.value === 0 ? stateOf(i) : null
  const mine = !st ? null : st === 'gold' ? { state: '金合格', good: gold.good + 37, ng: gold.ng - 2, roll: gold.roll + 12 } : { state: '红合格', good: pass.good + 40, ng: pass.ng - 6, roll: pass.roll + 9 }
  return {
    grade: grade.value,
    songs: picks,
    conditions: [
      { k: '魂量表', pass: '100%', gold: '100%' },
      { k: '良', pass: `${fmt(pass.good)} 以上`, gold: `${fmt(gold.good)} 以上` },
      { k: '不可', pass: `少于 ${pass.ng}`, gold: `少于 ${gold.ng}` },
      { k: '连打数', pass: `${pass.roll} 以上`, gold: `${gold.roll} 以上` },
    ],
    mine,
  }
})

const stages = computed(() =>
  course.value.songs.map((s) => ({ ...s, key: `${s.songId}-${s.d}`, song: songById[s.songId], chart: chartOf(s.songId, s.d), score: scoreOf(s.songId, s.d) || null })),
)
const totalCombo = computed(() => stages.value.reduce((n, s) => n + s.combo, 0))
const mine = computed(() => (isReady.value ? course.value.mine : null))

const COND_JA = { 魂量表: '魂ゲージ', 良: '良', 不可: '不可', 连打数: '連打数' }
const MINE_KEY = { 良: 'good', 不可: 'ng', 连打数: 'roll' }
const toNum = (s) => Number(String(s).replace(/[^\d.]/g, ''))
const condRows = computed(() =>
  course.value.conditions.map((c) => {
    const lt = c.pass.includes('少于')
    const pct = c.pass.includes('%')
    const p = toNum(c.pass)
    const g = toNum(c.gold)
    const show = (n) => (pct ? `${n}%` : lt ? L(`少于 ${n}`, `${n} 未満`) : L(`${fmt(n)} 以上`, `${fmt(n)} 以上`))
    const v = !mine.value ? null : pct ? 100 : mine.value[MINE_KEY[c.k]]
    const ok = (t) => v != null && (lt ? v < t : v >= t)
    const state = v == null ? null : ok(g) ? 'gold' : ok(p) ? 'red' : 'fail'
    return { k: c.k, label: L(c.k, COND_JA[c.k]), pass: show(p), gold: show(g), mine: v == null ? null : pct ? `${v}%` : fmt(v), state, gap: state === 'red' ? (lt ? v - g + 1 : g - v) : 0, lt }
  }),
)
const goldGaps = computed(() => condRows.value.filter((r) => r.gap > 0))
const attempts = computed(() => (!mine.value ? 0 : course.value === danCourse ? 4 : 1 + (gi.value % 3)))
const mineState = computed(() => (mine.value ? (mine.value.state === '金合格' ? 'gold' : 'red') : null))

const tips = computed(() => {
  const [a, , c] = stages.value
  const share = Math.round((c.combo / totalCombo.value) * 100)
  const ng = condRows.value.find((r) => r.k === '不可')
  const roll = condRows.value.find((r) => r.k === '连打数')
  const ngLine = toNum(ng.pass)
  const rollLine = toNum(roll.pass)
  return [
    {
      tag: L('不可', '不可'),
      cls: 'tag-don',
      text: L(
        `第 3 首 ${songTitle(c.song)} 有 ${fmt(c.combo)} 个音符，占全程 ${share}%。前两首的不可合计压到 ${Math.max(2, Math.round(ngLine * 0.3))} 个以内，第 3 首才有余量。`,
        `3 曲目「${songTitle(c.song)}」は ${fmt(c.combo)} ノーツで全体の ${share}%。前 2 曲の不可を合計 ${Math.max(2, Math.round(ngLine * 0.3))} 個以内に抑えると余裕が残ります。`,
      ),
    },
    {
      tag: L('良', '良'),
      cls: 'tag-ka',
      text: L(
        `第 1 首 ${songTitle(a.song)} BPM ${a.song.bpm}。开场 8 小节先求良不求快，魂量表到 100% 之前不要换手法。`,
        `1 曲目「${songTitle(a.song)}」は BPM ${a.song.bpm}。最初の 8 小節は良を優先し、魂ゲージが 100% になるまで運指を変えないこと。`,
      ),
    },
    {
      tag: L('连打数', '連打数'),
      cls: 'tag-roll',
      text: L(
        `连打数的红合格线是 ${rollLine}。三首共 9 条黄色连打，每条打到 ${Math.ceil(rollLine / 9)} 下就够，不用在气球上多花力气。`,
        `連打数の赤合格ラインは ${rollLine}。黄色連打は 3 曲で 9 本、1 本あたり ${Math.ceil(rollLine / 9)} 打で届きます。`,
      ),
    },
  ]
})

const dojoThread = threadById[4006]
const LINKS = [
  { to: `/community/t/${dojoThread.id}`, zh: dojoThread.title, ja: dojoThread.title, n: dojoThread.replies },
  { to: '/community', zh: '十段第二首的 12 分交互，大家用什么手法？', ja: '十段 2 曲目の 12 分、みんなの運指は？', n: 28 },
  { to: '/community', zh: '段位道场合格记录登记（虹 2026）', ja: '段位道場 合格報告スレ（虹 2026）', n: 213 },
]

// 段位轨道：把选中的段位滚到中间
const rail = ref(null)
function center() {
  const box = rail.value
  const el = box?.querySelector('[aria-pressed="true"]')
  if (el) box.scrollLeft = el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2
}
onMounted(center)
watch(grade, () => nextTick(center))
</script>

<template>
  <div class="page dan">
    <div class="top">
      <div class="seg" role="group" :aria-label="L('版本', 'バージョン')">
        <button v-for="(v, i) in VERSIONS" :key="v.k" :aria-pressed="vi === i" @click="qs.ver = v.k">{{ v.label }}</button>
      </div>
    </div>

    <div ref="rail" class="rail" role="group" :aria-label="L('选择段位', '段位を選ぶ')">
      <button v-for="g in grades" :key="g.name" class="chip" :aria-pressed="grade === g.name" @click="qs.grade = g.name">
        <span v-if="g.state" class="pass" :class="g.state" role="img" :aria-label="stateLabel(g.state)" />{{ g.label }}
      </button>
    </div>

    <div class="layout">
      <div class="main-col">
        <section class="panel">
          <div class="panel-head">
            <h2 class="t-h2">{{ gradeLabel }}{{ L(' 课题曲', ' 課題曲') }}</h2>
            <span class="t-small">{{ L('共', '合計') }} <b class="num total">{{ fmt(totalCombo) }}</b> {{ L('个音符', 'ノーツ') }}</span>
          </div>
          <ol class="stages">
            <li v-for="(s, i) in stages" :key="s.key" class="dstage">
              <div class="no">
                <b class="num">{{ i + 1 }}</b>
                <span class="t-caption">{{ L(`第 ${i + 1} 首`, `${i + 1} 曲目`) }}</span>
              </div>
              <RouterLink :to="`/songs/${s.song.id}?d=${s.d}&from=dan`" class="stage-song"><SongCell :song="s.song" /></RouterLink>
              <Diff :d="s.d" :star="s.chart.star" :constant="s.chart.constant" short class="stage-diff" />
              <dl class="stage-kv">
                <div>
                  <dt>{{ L('连击', 'コンボ') }}</dt>
                  <dd class="num">{{ fmt(s.combo) }}</dd>
                </div>
                <div>
                  <dt>BPM</dt>
                  <dd class="num">{{ s.song.bpm }}</dd>
                </div>
                <div v-if="isReady" class="best">
                  <dt>{{ L('我的最好', '自己ベスト') }}</dt>
                  <dd v-if="s.score"><Crown :v="s.score.crown" size="sm" /><span class="num">{{ fmt(s.score.score) }}</span></dd>
                  <dd v-else class="na none" :aria-label="L('未游玩', '未プレイ')">—</dd>
                </div>
              </dl>
            </li>
          </ol>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2 class="t-h2">{{ L('合格条件', '合格条件') }}</h2>
            <span v-if="mineState" class="tag" :class="mineState === 'gold' ? 'tag-roll' : 'tag-don'">{{ L('我的最好：', '自己ベスト：') }}{{ stateLabel(mineState) }}</span>
          </div>
          <div class="scroll-x">
            <table class="dt cond">
              <caption class="sr-only">{{ gradeLabel }}{{ L(' 合格条件', ' 合格条件') }}</caption>
              <thead>
                <tr>
                  <th scope="col">{{ L('条件', '条件') }}</th>
                  <th scope="col" class="r"><i class="pass red" aria-hidden="true" />{{ L('红合格', '赤合格') }}</th>
                  <th scope="col" class="r"><i class="pass gold" aria-hidden="true" />{{ L('金合格', '金合格') }}</th>
                  <th v-if="isReady" scope="col" class="r">{{ L('我的最好', '自己ベスト') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in condRows" :key="r.k">
                  <th scope="row" class="ck">{{ r.label }}</th>
                  <td class="r num">{{ r.pass }}</td>
                  <td class="r num">{{ r.gold }}</td>
                  <td v-if="isReady" class="r">
                    <span v-if="r.mine != null" class="res">
                      <b class="num">{{ r.mine }}</b>
                      <span v-if="r.state === 'fail'" class="tag tag-danger"><Icon name="close" :size="12" />{{ L('未达到', '未達') }}</span>
                      <span v-else class="tag" :class="r.state === 'gold' ? 'tag-roll' : 'tag-don'"><Icon name="check" :size="12" />{{ stateLabel(r.state) }}</span>
                    </span>
                    <span v-else class="na">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <div class="section-head"><h2 class="t-h2">{{ L('练习建议', '練習のヒント') }}</h2></div>
          <ul class="tips">
            <li v-for="t in tips" :key="t.tag">
              <span class="tag" :class="t.cls">{{ t.tag }}</span>
              <p>{{ t.text }}</p>
            </li>
          </ul>
        </section>
      </div>

      <aside class="side">
        <section class="panel panel-pad">
          <h2 class="t-h3">{{ L('我的段位', '自分の段位') }}</h2>
          <template v-if="isReady">
            <div class="plate">
              <span class="pass red lg" aria-hidden="true" />
              <b>{{ L(player.dan, gradeJa(player.dan)) }}</b>
              <span class="t-caption">{{ VERSIONS[0].label }}</span>
            </div>
            <dl class="kv">
              <dt>{{ gradeLabel }}{{ L(' 挑战次数', ' 挑戦回数') }}</dt>
              <dd class="num">{{ attempts }}</dd>
              <dt>{{ L('最好结果', '最高結果') }}</dt>
              <dd v-if="mineState"><span class="tag" :class="mineState === 'gold' ? 'tag-roll' : 'tag-don'">{{ stateLabel(mineState) }}</span></dd>
              <dd v-else class="muted">{{ L('还没有挑战', '未挑戦') }}</dd>
              <template v-if="goldGaps.length">
                <dt>{{ L('距离金合格', '金合格まで') }}</dt>
                <dd class="gaps">
                  <span v-for="g in goldGaps" :key="g.k">{{ g.label }} <b class="num">{{ g.lt ? '−' : '+' }}{{ g.gap }}</b></span>
                </dd>
              </template>
            </dl>
          </template>
          <template v-else>
            <p class="t-small gate">{{ store.auth === 'guest' ? L('登录后显示你的段位和每个条件的最好记录。', 'ログインすると段位と条件ごとの自己ベストが表示されます。') : L('同步成绩后显示你的段位和每个条件的最好记录。', '同期すると段位と条件ごとの自己ベストが表示されます。') }}</p>
            <RouterLink :to="store.auth === 'guest' ? '/login' : '/account/sync'" class="btn btn-ink btn-block">{{ store.auth === 'guest' ? L('登录', 'ログイン') : L('去同步', '同期する') }}</RouterLink>
          </template>
        </section>

        <section>
          <div class="section-head">
            <h2 class="t-h3">{{ L('社区里的段位讨论', 'コミュニティの段位トピック') }}</h2>
            <RouterLink to="/community" class="more">{{ L('段位道场版块', '段位道場カテゴリ') }}</RouterLink>
          </div>
          <ul class="links">
            <li v-for="l in LINKS" :key="l.zh">
              <RouterLink :to="l.to">
                <span class="grow title-1l" :title="L(l.zh, l.ja)">{{ L(l.zh, l.ja) }}</span>
                <span class="t-caption replies"><Icon name="reply" :size="14" /><span class="num">{{ l.n }}</span></span>
              </RouterLink>
            </li>
          </ul>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.rail {
  position: relative;
  display: flex;
  gap: 6px;
  /* 横滑的段位条：两端渐隐，不出现被硬切的半个胶囊（同 C2）；左右各让出 16px 给渐隐 */
  margin: 14px -16px 20px;
  padding: 2px 16px 6px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-mask-image: linear-gradient(to right, transparent 0, black 16px, black calc(100% - 16px), transparent 100%);
  mask-image: linear-gradient(to right, transparent 0, black 16px, black calc(100% - 16px), transparent 100%);
}
.rail::-webkit-scrollbar {
  display: none;
}
.rail .chip {
  flex: none;
  font-weight: 500;
}
/* 段位合格标记（不是王冠）：红合格 = 朱，金合格 = 金 */
.pass {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 6px;
  border-radius: 50%;
  flex: none;
  vertical-align: middle;
}
/* .pass.red / .pass.gold 的颜色来自 domain.css（D15：页面不声明王冠色） */
.pass.lg {
  width: 14px;
  height: 14px;
  margin-right: 0;
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 24px;
  align-items: start;
}
.main-col,
.side {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}
.side {
  position: sticky;
  top: calc(var(--bar-h) + 16px);
}
.total {
  font-size: var(--fs-16);
  color: var(--ink);
}

/* ---------- 三首课题曲：有先后顺序 ---------- */
.dstage {
  position: relative;
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
}
.dstage:last-child {
  border-bottom: 0;
}
.no {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.no b {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--surface);
  border: 2px solid var(--ink);
  font-size: var(--fs-18);
  font-weight: 700;
  line-height: 1;
}
.dstage:not(:last-child) .no::after {
  content: '';
  position: absolute;
  left: 51px;
  top: calc(50% + 28px);
  bottom: calc(-50% + 30px);
  width: 2px;
  background: var(--line-strong);
}
.stage-song:hover :deep(.t) {
  color: var(--link);
}
.stage-kv {
  display: flex;
  gap: 20px;
  min-width: 250px;
}
.stage-kv > div {
  display: flex;
  flex-direction: column-reverse;
  min-width: 46px;
}
.stage-kv dt {
  font-size: var(--fs-11);
  color: var(--ink-3);
}
.stage-kv dd {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-18);
  line-height: 1.3;
}
.stage-kv dd.none {
  font-size: var(--fs-13);
  line-height: 1.8;
}

/* ---------- 合格条件 ---------- */
.cond th:first-child,
.cond td:first-child {
  padding-left: 20px;
}
.cond th:last-child,
.cond td:last-child {
  padding-right: 20px;
}
.cond td.num,
.cond td .num {
  font-size: var(--fs-16);
}
.cond th.ck {
  position: static;
  padding: 9px 12px;
  background: none;
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-13);
  font-weight: 700;
  color: var(--ink);
}
.cond tbody tr:last-child th.ck {
  border-bottom: 0;
}
.res {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* ---------- 建议 / 侧栏 ---------- */
.tips {
  border-top: 1px solid var(--line-strong);
}
.tips li {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 12px;
  align-items: baseline;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}
.tips .tag {
  justify-self: start;
}
.tips p {
  max-width: 62em;
  color: var(--ink-2);
}
.plate {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px 0 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
}
.plate b {
  font-size: var(--fs-28);
  font-weight: 900;
  line-height: 1;
}
.plate .t-caption {
  margin-left: auto;
}
.kv .num {
  font-size: var(--fs-16);
}
.gaps {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 2px 10px;
  font-weight: 400;
  color: var(--ink-2);
}
.gaps b {
  color: var(--ink);
}
.gate {
  margin: 10px 0 14px;
}
.side .section-head {
  margin-bottom: 8px;
}
.links {
  border-top: 1px solid var(--line-strong);
}
.links a {
  display: flex;
  min-width: 0;
  min-height: var(--hit); /* D7：列表行 ≥ 44px */
  align-items: flex-start;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-13);
  font-weight: 500;
}
.links a:hover .grow {
  color: var(--link);
}
.replies {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  line-height: 1.7;
}

@media (max-width: 1239px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .side {
    position: static;
  }
  .dstage {
    grid-template-columns: 64px minmax(0, 1fr) auto;
  }
  .no {
    grid-row: span 2;
  }
  .stage-kv {
    grid-column: 2 / -1;
    min-width: 0;
  }
}
@media (max-width: 767px) {
  .rail {
    position: sticky;
    top: calc(var(--bar-h-m) + var(--subtab-h-m));
    z-index: 10;
    margin: 10px calc(var(--gutter) * -1) 14px;
    padding: 8px var(--gutter);
    background: var(--bg);
    border-bottom: 1px solid var(--line);
  }
  .layout,
  .main-col,
  .side {
    gap: 20px;
  }
  .dstage {
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 10px 12px;
    padding: 14px 16px;
  }
  .no .t-caption {
    display: none;
  }
  .dstage:not(:last-child) .no::after {
    left: 37px;
    top: 58px;
    bottom: -18px;
  }
  .no {
    grid-row: span 3;
    align-self: start;
    padding-top: 4px;
  }
  .stage-diff {
    grid-column: 2;
    justify-self: start;
  }
  .stage-kv {
    grid-column: 2;
    gap: 18px;
  }
  .cond th,
  .cond td {
    padding-left: 8px;
    padding-right: 8px;
  }
  .cond th:first-child,
  .cond td:first-child {
    padding-left: 16px;
  }
  .cond th:last-child,
  .cond td:last-child {
    padding-right: 16px;
  }
  .res {
    gap: 6px;
  }
  .tips li {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }
}
</style>
