<script setup>
import { computed, nextTick, ref } from 'vue'
import Icon from '../components/Icon.vue'
import DrumDial from '../components/DrumDial.vue'
import LineChart from '../components/LineChart.vue'
import SongCell from '../components/SongCell.vue'
import Cover from '../components/Cover.vue'
import Diff from '../components/Diff.vue'
import Crown from '../components/Crown.vue'
import Rank from '../components/Rank.vue'
import Gate from '../components/Gate.vue'
import Sheet from '../components/Sheet.vue'
import Popover from '../components/Popover.vue'
import { player, DIMS, ratingHistory, bestList, scores, songById, chartOf, milestones, fmt } from '../mock/data'
import { L, isReady, songTitle, toast } from '../store'
import { useQueryState } from '../routeState'
import { isMobile } from '../breakpoints'

// Rating 页：B30 表 / Rating 走势 / 六维。数字全部由成绩数据推出；显示的 Rating 固定为 player.rating。
const RANGES = [30, 90, 180, 365]
const f = useQueryState({
  range: { type: 'number', default: 90, values: RANGES },
  dim: { type: 'string', default: 'all', values: ['all', ...DIMS.map((d) => d.key)] },
})

const points = computed(() =>
  ratingHistory
    .filter((p) => p.daysAgo < f.range)
    .map((p) => {
      const d = new Date(2026, 10, 16 - p.daysAgo)
      return { label: `${d.getMonth() + 1}/${d.getDate()}`, v: p.v, daysAgo: p.daysAgo }
    }),
)
const marks = computed(() => {
  const idx = new Map(points.value.map((p, i) => [p.daysAgo, i]))
  return milestones
    .filter((m) => m.ago > 0 && m.ago < f.range && idx.has(m.ago))
    .map((m) => ({ index: idx.get(m.ago), text: L(m.text, m.textJa) }))
})
const chartLabel = computed(() => {
  const pts = points.value
  if (!pts.length) return ''
  const a = pts[0].v.toFixed(2)
  const b = pts[pts.length - 1].v.toFixed(2)
  return L(`近 ${f.range} 天 Rating 走势：从 ${a} 到 ${b}`, `直近 ${f.range} 日の Rating：${a} から ${b}`)
})

// 按维度看：用谱面能力值相对定数的比例给单曲 RT 加权，取前 30
const AXIS = { stamina: 'stamina', speed: 'handspeed', rhythm: 'rhythm', complex: 'complex' }
function dimWeight(s, key) {
  const c = chartOf(s.songId, s.d)
  if (!c || !c.constant) return 1
  if (key === 'accuracy_power') return 1 + (s.acc - 97) / 100
  if (key === 'big_song') return 1 + ((c.notes ?? 800) - 800) / 4000
  const v = c.abilities?.[AXIS[key]]
  return v != null ? v / c.constant : 1
}
const rows = computed(() => {
  if (f.dim === 'all') return bestList
  const k = f.dim
  return scores
    .map((s) => ({ s, w: s.rt * dimWeight(s, k) }))
    .sort((a, b) => b.w - a.w || a.s.songId - b.s.songId)
    .slice(0, 30)
    .map((x) => x.s)
})
const maxRt = computed(() => Math.max(0.01, ...rows.value.map((r) => r.rt)))
const floor = computed(() => (bestList.length >= 20 ? bestList[19].rt : bestList[bestList.length - 1]?.rt ?? null))
const lo = 10.5
const pct = (v) => Math.max(0, Math.min(100, ((v - lo) / (13.5 - lo)) * 100))
const songLink = (s) => `/songs/${s.songId}?d=${s.d}&from=play`
const dimName = computed(() => {
  const d = DIMS.find((x) => x.key === f.dim)
  return d ? L(d.zh, d.ja) : L('综合', '総合')
})

/* ---------- 生成图片（与 bot 的四种图片对应） ---------- */
const IMAGES = [
  { key: 'b30', zh: 'B30 表', ja: 'B30 表' },
  { key: 'trend', zh: 'Rating 走势', ja: 'Rating 推移' },
  { key: 'progress', zh: '歌曲进度', ja: '楽曲進捗' },
  { key: 'cloud', zh: '太鼓词云', ja: '太鼓ワードクラウド' },
]
const imgBtn = ref(null)
const menuOpen = ref(false)
const menuEl = ref(null)
const image = ref(null)
const imageName = computed(() => (image.value ? L(image.value.zh, image.value.ja) : ''))
function pickImage(it) {
  menuOpen.value = false
  nextTick(() => (image.value = it))
}
function onMenuKey(e) {
  const items = [...(menuEl.value?.querySelectorAll('[role="menuitem"]') || [])]
  if (!items.length) return
  const i = items.indexOf(document.activeElement)
  let n = -1
  if (e.key === 'ArrowDown') n = (i + 1) % items.length
  else if (e.key === 'ArrowUp') n = (i - 1 + items.length) % items.length
  else if (e.key === 'Home') n = 0
  else if (e.key === 'End') n = items.length - 1
  if (n >= 0) {
    e.preventDefault()
    items[n].focus()
  }
}
function download() {
  const name = `${player.username}-${image.value.key}.png`
  image.value = null
  toast(L(`已保存 ${name}`, `${name} を保存しました`))
}
</script>

<template>
  <div class="page">
    <Gate v-if="!isReady" :what="L('Rating 与最好成绩', 'Rating とベスト')" />
    <template v-else>
      <div class="top">
        <section class="panel rating">
          <div class="rating-l">
            <DrumDial :value="player.rating" :size="164">
              <span class="t-caption">Rating</span>
              <b class="num big">{{ player.rating.toFixed(2) }}</b>
              <span class="t-caption">/ 15.5</span>
            </DrumDial>
            <dl class="mini">
              <div><dt>{{ L('近 30 天', '直近 30 日') }}</dt><dd class="num up">+{{ player.ratingDelta30.toFixed(2) }}</dd></div>
              <div>
                <dt>{{ L('入围线', 'ボーダー') }}</dt>
                <dd v-if="floor != null" class="num">{{ floor.toFixed(2) }}</dd>
                <dd v-else class="na">—</dd>
              </div>
              <div><dt>{{ L('全站位置', '全体順位') }}</dt><dd>{{ player.percentile }}</dd></div>
            </dl>
          </div>
          <div class="rating-r">
            <div class="spread">
              <h2 class="t-h3">{{ L('Rating 走势', 'Rating の推移') }}</h2>
              <div class="seg" role="group" :aria-label="L('时间范围', '期間')">
                <button v-for="r in RANGES" :key="r" :aria-pressed="f.range === r" @click="f.range = r">{{ r }} {{ L('天', '日') }}</button>
              </div>
            </div>
            <LineChart :points="points" :marks="marks" :height="210" :label="chartLabel" />
          </div>
        </section>

        <section class="panel dims">
          <div class="spread">
            <h2 class="t-h3">{{ L('六维', '6 つの力') }}</h2>
            <span class="t-caption">{{ L('30 天前 → 现在', '30 日前 → 現在') }}</span>
          </div>
          <ul>
            <li v-for="d in DIMS" :key="d.key" :class="{ focus: d.key === player.focus }">
              <span class="dn">{{ L(d.zh, d.ja) }}</span>
              <span class="track" aria-hidden="true">
                <i class="seg-line" :style="{ left: pct(player.dimsPrev[d.key]) + '%', width: pct(player.dims[d.key]) - pct(player.dimsPrev[d.key]) + '%' }" />
                <i class="p0" :style="{ left: pct(player.dimsPrev[d.key]) + '%' }" />
                <i class="p1" :style="{ left: pct(player.dims[d.key]) + '%' }" />
              </span>
              <b class="num">{{ player.dims[d.key].toFixed(2) }}</b>
              <span class="num up dd">+{{ (player.dims[d.key] - player.dimsPrev[d.key]).toFixed(2) }}</span>
            </li>
          </ul>
          <div class="spread scale num" aria-hidden="true"><span>{{ lo }}</span><span>12</span><span>13.5</span></div>
        </section>
      </div>

      <section class="section">
        <div class="section-head">
          <h2 class="t-h2">{{ L('构成 Rating 的成绩', 'Rating 対象の記録') }}</h2>
          <button ref="imgBtn" class="btn btn-sm" aria-haspopup="menu" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
            <Icon name="image" :size="14" />{{ L('生成图片', '画像を作成') }}<Icon name="chevD" :size="14" />
          </button>
        </div>
        <div class="dimchips" role="group" :aria-label="L('按能力方向', '能力の方向')">
          <button class="chip" :aria-pressed="f.dim === 'all'" @click="f.dim = 'all'">{{ L('综合', '総合') }}</button>
          <button v-for="d in DIMS" :key="d.key" class="chip" :aria-pressed="f.dim === d.key" @click="f.dim = d.key">{{ L(d.zh, d.ja) }}</button>
        </div>

        <div class="panel only-desktop">
          <table class="dt">
            <caption class="sr-only">{{ L(`构成 Rating 的成绩（${dimName}），按单曲 RT 从高到低`, `Rating 対象の記録（${dimName}）、単曲 RT の高い順`) }}</caption>
            <thead>
              <tr>
                <th scope="col" class="r" style="width: 44px">#</th>
                <th scope="col">{{ L('歌曲', '楽曲') }}</th>
                <th scope="col">{{ L('难度', '難易度') }}</th>
                <th scope="col" class="r">{{ L('成绩', 'スコア') }}</th>
                <th scope="col" class="r c-acc">{{ L('准确率', '精度') }}</th>
                <th scope="col" class="c">{{ L('王冠', '王冠') }}</th>
                <th scope="col" class="c">{{ L('评价', '評価') }}</th>
                <th scope="col" class="c-rt" aria-sort="descending">{{ L('单曲 RT', '単曲 RT') }}</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(s, i) in rows" :key="s.songId + '-' + s.d">
                <tr v-if="i === 20" class="cut"><td colspan="8"><span>{{ L('以上 20 首计入 Rating', '上の 20 件が Rating 対象') }}</span></td></tr>
                <tr class="is-link" :class="{ out: i >= 20 }" @click="$router.push(songLink(s))">
                  <td class="r num idx">{{ i + 1 }}</td>
                  <td class="tcell"><RouterLink :to="songLink(s)" class="slink" @click.stop><SongCell :song="songById[s.songId]" size="sm" /></RouterLink></td>
                  <td><Diff :d="s.d" :star="s.star" :constant="s.constant" short show-missing /></td>
                  <td class="r num sc">{{ fmt(s.score) }}</td>
                  <td class="r num c-acc">{{ s.acc.toFixed(2) }}%</td>
                  <td class="c"><Crown :v="s.crown" /></td>
                  <td class="c"><Rank :v="s.rank" /></td>
                  <td>
                    <span class="rtcell">
                      <b class="num">{{ s.rt.toFixed(2) }}</b>
                      <span class="rtbar" aria-hidden="true"><i :style="{ width: (s.rt / maxRt) * 100 + '%' }" /></span>
                    </span>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <ol class="mlist only-mobile">
          <template v-for="(s, i) in rows" :key="s.songId + '-' + s.d">
            <li v-if="i === 20" class="mcut">{{ L('以上 20 首计入 Rating', '上の 20 件が Rating 対象') }}</li>
            <li>
              <RouterLink :to="songLink(s)" class="mrow" :class="{ out: i >= 20 }">
                <span class="num idx">{{ i + 1 }}</span>
                <Cover :song="songById[s.songId]" />
                <span class="grow">
                  <b class="title-1l mt" :title="songTitle(songById[s.songId])">{{ songTitle(songById[s.songId]) }}</b>
                  <span class="row" style="gap: 8px; margin-top: 4px">
                    <Diff :d="s.d" :star="s.star" :constant="s.constant" short />
                    <Crown :v="s.crown" size="sm" />
                    <span class="num t-caption">{{ fmt(s.score) }}</span>
                  </span>
                </span>
                <b class="num mrt">{{ s.rt.toFixed(2) }}</b>
              </RouterLink>
            </li>
          </template>
        </ol>
      </section>
    </template>

    <!-- 生成图片：选择（桌面菜单 / 手机抽屉） -->
    <Popover v-if="!isMobile" :open="menuOpen" :anchor="imgBtn" placement="bottom-end" :width="200" @close="menuOpen = false">
      <ul ref="menuEl" class="imenu" role="menu" :aria-label="L('生成图片', '画像を作成')" @keydown="onMenuKey">
        <li v-for="it in IMAGES" :key="it.key" role="none">
          <button role="menuitem" class="imenu-item" @click="pickImage(it)"><Icon name="image" :size="16" />{{ L(it.zh, it.ja) }}</button>
        </li>
      </ul>
    </Popover>
    <Sheet v-else :open="menuOpen" :title="L('生成图片', '画像を作成')" @close="menuOpen = false">
      <ul class="imenu" role="menu" :aria-label="L('生成图片', '画像を作成')">
        <li v-for="it in IMAGES" :key="it.key" role="none">
          <button role="menuitem" class="imenu-item" @click="pickImage(it)"><Icon name="image" :size="18" />{{ L(it.zh, it.ja) }}</button>
        </li>
      </ul>
    </Sheet>

    <!-- 生成图片：预览与下载 -->
    <Sheet :open="!!image" :title="imageName" :width="440" @close="image = null">
      <figure v-if="image" class="frame" role="img" :aria-label="L(`${imageName}预览 · ${player.nickname}`, `${imageName}のプレビュー · ${player.nickname}`)">
        <div class="fr-head">
          <b class="title-1l">{{ player.nickname }}</b>
          <span class="num">Rating {{ player.rating.toFixed(2) }}</span>
        </div>
        <p class="fr-name">{{ imageName }}</p>
        <div class="fr-body" :class="image.key" aria-hidden="true">
          <template v-if="image.key === 'b30'"><i v-for="n in 15" :key="n" class="fr-row" /></template>
          <template v-else-if="image.key === 'trend'"><i v-for="n in 12" :key="n" class="fr-bar" :style="{ height: 30 + n * 5 + '%' }" /></template>
          <template v-else-if="image.key === 'progress'"><i v-for="n in 48" :key="n" class="fr-cell" /></template>
          <template v-else><i v-for="n in 14" :key="n" class="fr-word" :style="{ width: 20 + ((n * 37) % 50) + '%' }" /></template>
        </div>
        <p class="fr-foot num">viewer.sakura-bot.cn</p>
      </figure>
      <template #foot>
        <button class="btn" @click="image = null">{{ L('取消', 'キャンセル') }}</button>
        <button class="btn btn-primary" @click="download"><Icon name="download" :size="16" />{{ L('下载 PNG', 'PNG をダウンロード') }}</button>
      </template>
    </Sheet>
  </div>
</template>

<style scoped>
.top {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(320px, 1fr);
  gap: 20px;
}
.rating {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 28px;
  padding: 20px 24px;
  align-items: center;
}
.rating-l {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}
.big {
  font-size: 48px;
  font-weight: 700;
  line-height: 1;
}
.mini {
  display: flex;
  gap: 16px;
}
.mini div {
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
}
.mini dt {
  font-size: var(--fs-11);
  color: var(--ink-3);
}
.mini dd {
  font-weight: 700;
}
.mini .num {
  font-size: var(--fs-18);
}
.rating-r {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dims {
  padding: 20px 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dims ul {
  display: flex;
  flex-direction: column;
}
.dims li {
  display: grid;
  grid-template-columns: 72px 1fr 48px 44px;
  align-items: center;
  gap: 12px;
  height: 38px;
  font-size: var(--fs-13);
}
.dims li.focus .dn {
  color: var(--ka-ink);
  font-weight: 700;
}
.track {
  position: relative;
  height: 2px;
  background: var(--line-strong);
}
.seg-line {
  position: absolute;
  top: -1px;
  height: 4px;
  background: var(--don);
  border-radius: 2px;
}
.p0,
.p1 {
  position: absolute;
  top: 50%;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.p0 {
  width: 8px;
  height: 8px;
  background: var(--surface);
  border: 2px solid var(--ink-3);
}
.p1 {
  width: 14px;
  height: 14px;
  background: var(--don);
  box-shadow: inset 0 0 0 2px var(--note-ring), 0 0 0 1px var(--note-outline);
}
.dims li.focus .p1 {
  background: var(--ka);
}
.dims li.focus .seg-line {
  background: var(--ka);
}
.dims b {
  font-size: var(--fs-18);
  text-align: right;
}
.dd {
  font-size: var(--fs-13);
}
.scale {
  margin-left: 84px;
  margin-right: 116px;
  font-size: var(--fs-11);
  color: var(--ink-3);
  font-weight: 500;
}
.dimchips {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
  overflow-x: auto;
  scrollbar-width: none;
}
.dt th {
  top: var(--bar-h);
}
.dt th:first-child {
  border-top-left-radius: var(--r-panel);
}
.dt th:last-child {
  border-top-right-radius: var(--r-panel);
}
.tcell {
  max-width: 0;
  width: 30%;
}
.slink {
  display: block;
  min-width: 0;
}
.slink:hover :deep(.t) {
  color: var(--ka-ink);
}
.idx {
  color: var(--ink-3);
  font-size: var(--fs-14);
}
.sc {
  font-size: var(--fs-14);
  font-weight: 700;
}
.rtcell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.rtcell b {
  min-width: 44px;
  font-size: var(--fs-16);
  color: var(--don-ink);
}
.rtbar {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--bg-sunk);
  overflow: hidden;
}
.rtbar i {
  display: block;
  height: 100%;
  background: var(--don);
  border-radius: 3px;
}
tr.out .rtbar i {
  background: var(--ink-3);
}
tr.out td {
  color: var(--ink-2);
}
tr.out .rtcell b {
  color: var(--ink-2);
}
.cut td {
  padding: 0;
  border-bottom: 0;
  background: var(--bg);
}
.cut span {
  display: block;
  padding: 10px 12px;
  font-size: var(--fs-12);
  color: var(--ink-2);
  border-top: 2px solid var(--don);
}
.cut:hover {
  background: none;
}

/* 生成图片 */
.imenu {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.imenu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: var(--ctl-h);
  padding: 0 10px;
  border-radius: var(--ctl-radius);
  font-size: var(--fs-14);
  text-align: left;
  white-space: nowrap;
  color: var(--ink);
}
.imenu-item:hover,
.imenu-item:focus-visible {
  background: var(--bg-sunk);
}
.frame {
  display: flex;
  flex-direction: column;
  gap: 10px;
  aspect-ratio: 3 / 4;
  width: min(100%, 360px);
  margin: 0 auto;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
  background: var(--surface-2);
  overflow: hidden;
}
.fr-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-size: var(--fs-14);
}
.fr-head .num {
  flex: none;
  color: var(--don-ink);
  font-weight: 700;
}
.fr-name {
  font-size: var(--fs-12);
  color: var(--ink-2);
}
.fr-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fr-row {
  display: block;
  height: 12px;
  border-radius: var(--r-xs);
  background: var(--bg-sunk);
}
.fr-body.trend {
  flex-direction: row;
  align-items: flex-end;
}
.fr-bar {
  flex: 1;
  border-radius: var(--r-xs) var(--r-xs) 0 0;
  background: var(--bg-sunk);
}
.fr-body.progress {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  align-content: start;
}
.fr-cell {
  display: block;
  aspect-ratio: 2 / 1;
  border-radius: var(--r-xs);
  border: 1px solid var(--line-strong);
}
.fr-body.cloud {
  flex-direction: row;
  flex-wrap: wrap;
  align-content: center;
  justify-content: center;
}
.fr-word {
  display: block;
  height: 14px;
  border-radius: var(--r-xs);
  background: var(--bg-sunk);
}
.fr-foot {
  font-size: var(--fs-11);
  color: var(--ink-3);
  text-align: right;
}
.c-rt {
  width: 26%;
}
@media (max-width: 1239px) {
  .top {
    grid-template-columns: minmax(0, 1fr);
  }
}
/* 列优先级（V11）：平板先隐藏准确率与 RT 条，把宽度让给曲名（C14 看图复核：820 宽曲名只剩 4 个字） */
@media (max-width: 1099px) {
  .c-acc,
  .rtbar {
    display: none;
  }
  .c-rt {
    width: auto;
  }
}
@media (max-width: 767px) {
  .rating {
    grid-template-columns: minmax(0, 1fr);
    padding: 16px;
    gap: 16px;
  }
  .rating-l {
    flex-direction: row;
    justify-content: center;
    gap: 20px;
  }
  .mini {
    flex-direction: column;
    gap: 8px;
  }
  .mini div {
    align-items: flex-start;
  }
  .dims {
    padding: 16px;
  }
  .dims li {
    grid-template-columns: 64px 1fr 44px 40px;
    gap: 8px;
  }
  .scale {
    margin-left: 72px;
    margin-right: 100px;
  }
  .dimchips {
    /* D7：上下各留 3px，横滑容器才不会裁掉胶囊的 44px 扩展区（版面位置不变） */
    margin: -3px calc(var(--gutter) * -1) 7px;
    padding: 3px var(--gutter);
  }
  .imenu-item {
    min-height: var(--hit);
    font-size: var(--fs-16);
  }
  .mlist {
    display: block !important;
    border-top: 1px solid var(--line-strong);
  }
  .mrow {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: var(--hit);
    padding: 10px 0;
    border-bottom: 1px solid var(--line);
  }
  .mrow .idx {
    width: 20px;
    text-align: right;
  }
  .mt {
    line-height: 1.3;
  }
  .mrt {
    font-size: var(--fs-22);
    color: var(--don-ink);
  }
  .mrow.out .mrt {
    color: var(--ink-3);
  }
  .mcut {
    padding: 8px 0;
    font-size: var(--fs-12);
    color: var(--ink-2);
    border-top: 2px solid var(--don);
    margin-top: -1px;
  }
}
</style>
