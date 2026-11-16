<script setup>
import { computed, ref } from 'vue'
import Icon from '../components/Icon.vue'
import DrumDial from '../components/DrumDial.vue'
import LineChart from '../components/LineChart.vue'
import SongCell from '../components/SongCell.vue'
import Cover from '../components/Cover.vue'
import Diff from '../components/Diff.vue'
import Crown from '../components/Crown.vue'
import Rank from '../components/Rank.vue'
import Gate from '../components/Gate.vue'
import { player, DIMS, ratingHistory, bestList, songById, milestones, fmt } from '../mock/data'
import { L, isReady, songTitle, toast } from '../store'

// Rating 页：旧版是三张服务端渲染的 PNG（B30 表 / Rating 走势 / 进度）。
// 这里改成原生页面：数字可读、可排序、跟随深浅色；仍保留「生成图片」给需要发群的人。
const range = ref(90)
const points = computed(() =>
  ratingHistory
    .filter((p) => p.daysAgo < range.value)
    .map((p) => {
      const d = new Date(2026, 10, 16 - p.daysAgo)
      return { label: `${d.getMonth() + 1}/${d.getDate()}`, v: p.v, daysAgo: p.daysAgo }
    }),
)
const marks = computed(() =>
  milestones
    .filter((m) => m.ago > 0 && m.ago < range.value)
    .map((m) => ({ index: points.value.findIndex((p) => p.daysAgo === m.ago), text: m.text }))
    .filter((m) => m.index >= 0),
)
const chartLabel = computed(() => {
  const a = points.value[0].v.toFixed(2)
  const b = points.value[points.value.length - 1].v.toFixed(2)
  return L(`近 ${range.value} 天 Rating 走势：从 ${a} 到 ${b}`, `直近 ${range.value} 日の Rating：${a} から ${b}`)
})
const dim = ref('all')
const rows = computed(() => {
  if (dim.value === 'all') return bestList
  // 演示：按维度排序时用谱面能力值微调顺序
  const k = DIMS.findIndex((d) => d.key === dim.value)
  return [...bestList].sort((a, b) => b.rt + ((b.songId * (k + 3)) % 17) / 40 - (a.rt + ((a.songId * (k + 3)) % 17) / 40))
})
const maxRt = computed(() => rows.value[0].rt)
const floor = computed(() => rows.value[19].rt)
const lo = 10.5
const pct = (v) => Math.max(0, Math.min(100, ((v - lo) / (13.5 - lo)) * 100))
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
              <div><dt>{{ L('入围线', 'ボーダー') }}</dt><dd class="num">{{ floor.toFixed(2) }}</dd></div>
              <div><dt>{{ L('全站位置', '全体順位') }}</dt><dd>{{ player.percentile }}</dd></div>
            </dl>
          </div>
          <div class="rating-r">
            <div class="spread">
              <h2 class="t-h3">{{ L('Rating 走势', 'Rating の推移') }}</h2>
              <div class="seg" role="group">
                <button v-for="r in [30, 90, 180]" :key="r" :aria-pressed="range === r" @click="range = r">{{ r }} {{ L('天', '日') }}</button>
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
              <span class="track">
                <i class="seg-line" :style="{ left: pct(player.dimsPrev[d.key]) + '%', width: pct(player.dims[d.key]) - pct(player.dimsPrev[d.key]) + '%' }" />
                <i class="p0" :style="{ left: pct(player.dimsPrev[d.key]) + '%' }" />
                <i class="p1" :style="{ left: pct(player.dims[d.key]) + '%' }" />
              </span>
              <b class="num">{{ player.dims[d.key].toFixed(2) }}</b>
              <span class="num up dd">+{{ (player.dims[d.key] - player.dimsPrev[d.key]).toFixed(2) }}</span>
            </li>
          </ul>
          <div class="spread scale num"><span>{{ lo }}</span><span>12</span><span>13.5</span></div>
        </section>
      </div>

      <section class="section">
        <div class="section-head">
          <h2 class="t-h2">{{ L('构成 Rating 的成绩', 'Rating 対象の記録') }}</h2>
          <button class="btn btn-sm" @click="toast(L('图片已生成，可以长按保存', '画像を生成しました'))"><Icon name="image" :size="14" />{{ L('生成 B30 图片', 'B30 画像を作成') }}</button>
        </div>
        <div class="dimchips">
          <button class="chip" :aria-pressed="dim === 'all'" @click="dim = 'all'">{{ L('综合', '総合') }}</button>
          <button v-for="d in DIMS" :key="d.key" class="chip" :aria-pressed="dim === d.key" @click="dim = d.key">{{ L(d.zh, d.ja) }}</button>
        </div>

        <div class="panel only-desktop">
          <table class="dt">
            <thead>
              <tr>
                <th class="r" style="width: 44px">#</th>
                <th>{{ L('歌曲', '楽曲') }}</th>
                <th>{{ L('难度', '難易度') }}</th>
                <th class="r">{{ L('成绩', 'スコア') }}</th>
                <th class="r">{{ L('准确率', '精度') }}</th>
                <th class="c">{{ L('王冠', '王冠') }}</th>
                <th class="c">{{ L('评价', '評価') }}</th>
                <th style="width: 26%">{{ L('单曲 RT', '単曲 RT') }}</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(s, i) in rows" :key="s.songId + '-' + s.d">
                <tr v-if="i === 20" class="cut"><td colspan="8"><span>{{ L('以上 20 首计入 Rating，以下是最接近入围的成绩', '上の 20 件が Rating 対象。以下はボーダーに近い記録') }}</span></td></tr>
                <tr class="is-link" :class="{ out: i >= 20 }" @click="$router.push(`/songs/${s.songId}?d=${s.d}`)">
                  <td class="r num idx">{{ i + 1 }}</td>
                  <td class="tcell"><SongCell :song="songById[s.songId]" size="sm" /></td>
                  <td><Diff :d="s.d" :star="s.star" :constant="s.constant" short /></td>
                  <td class="r num sc">{{ fmt(s.score) }}</td>
                  <td class="r num">{{ s.acc.toFixed(2) }}%</td>
                  <td class="c"><Crown :v="s.crown" /></td>
                  <td class="c"><Rank :v="s.rank" /></td>
                  <td>
                    <span class="rtcell">
                      <b class="num">{{ s.rt.toFixed(2) }}</b>
                      <span class="rtbar"><i :style="{ width: (s.rt / maxRt) * 100 + '%' }" /></span>
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
              <RouterLink :to="`/songs/${s.songId}?d=${s.d}`" class="mrow" :class="{ out: i >= 20 }">
                <span class="num idx">{{ i + 1 }}</span>
                <Cover :song="songById[s.songId]" />
                <span class="grow">
                  <b class="truncate mt">{{ songTitle(songById[s.songId]) }}</b>
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
  box-shadow: inset 0 0 0 2px #fff, 0 0 0 1px var(--ai-900);
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
.idx {
  color: var(--ink-3);
  font-size: var(--fs-14);
}
.sc {
  font-size: var(--fs-16);
}
.rtcell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.rtcell b {
  width: 44px;
  font-size: var(--fs-18);
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
@media (max-width: 1239px) {
  .top {
    grid-template-columns: minmax(0, 1fr);
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
    margin: 0 calc(var(--gutter) * -1) 10px;
    padding: 0 var(--gutter);
  }
  .mlist {
    display: block !important;
    border-top: 1px solid var(--line-strong);
  }
  .mrow {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px solid var(--line);
  }
  .mrow .idx {
    width: 20px;
    text-align: right;
  }
  .mt {
    display: block;
    line-height: 1.3;
  }
  .mrt {
    font-size: var(--fs-22);
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
