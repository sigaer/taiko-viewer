<script setup>
import { computed, ref } from 'vue'
import Gate from '../components/Gate.vue'
import Crown from '../components/Crown.vue'
import { songs, scoreOf, RANKS, DIFFS, player, fmt } from '../mock/data'
import { L, isReady, songTitle } from '../store'

// 进度：把「歌曲进度」图片换成可交互的点灯表。
// 每张谱一个格子，格子颜色 = 王冠，角标 = 评价。按星级或按定数分组。
const group = ref('star')
const show = ref('crown')

const charts = computed(() =>
  songs.flatMap((s) =>
    s.charts
      .filter((c) => c.d >= 4)
      .map((c) => ({ song: s, c, score: scoreOf(s.id, c.d) })),
  ),
)
const groups = computed(() => {
  const m = new Map()
  for (const x of charts.value) {
    const key = group.value === 'star' ? `★${x.c.star}` : x.c.constant == null ? '—' : `${Math.floor(x.c.constant)}.x`
    const order = group.value === 'star' ? x.c.star : (x.c.constant ?? -1)
    if (!m.has(key)) m.set(key, { key, order: Math.floor(order), items: [] })
    m.get(key).items.push(x)
  }
  return [...m.values()]
    .sort((a, b) => b.order - a.order)
    .map((g) => {
      g.items.sort((a, b) => (b.c.constant ?? 0) - (a.c.constant ?? 0))
      const n = g.items.length
      const cnt = (min) => g.items.filter((x) => x.score && x.score.crown >= min).length
      return { ...g, n, clear: cnt(0), fc: cnt(1), dfc: cnt(2) }
    })
})
const crownKey = (s) => (!s ? 'none' : ['played', 'clear', 'fc', 'dfc'][s.crown + 1])
const rankTotal = player.rankCounts.reduce((a, b) => a + b, 0)
const sel = ref(null)
</script>

<template>
  <div class="page">
    <Gate v-if="!isReady" :what="L('点灯进度', '進捗')" />
    <template v-else>
      <div class="top">
        <section class="crowns">
          <div class="cstat"><Crown :v="2" size="lg" /><b class="num">{{ player.crownCounts.dfc }}</b><span>{{ L('全良', '全良') }}</span></div>
          <div class="cstat"><Crown :v="1" size="lg" /><b class="num">{{ player.crownCounts.fc }}</b><span>{{ L('全连', 'フルコンボ') }}</span></div>
          <div class="cstat"><Crown :v="0" size="lg" /><b class="num">{{ player.crownCounts.clear }}</b><span>{{ L('通关', 'クリア') }}</span></div>
        </section>
        <section class="ranks">
          <div class="spread"><h2 class="t-h3">{{ L('评价分布', '評価の分布') }}</h2><span class="t-caption">{{ L(`共 ${fmt(rankTotal)} 张谱`, `全 ${fmt(rankTotal)} 譜面`) }}</span></div>
          <div class="rbar">
            <i v-for="(n, i) in player.rankCounts" :key="i" :class="RANKS[i + 2].key" :style="{ flex: n }" :title="`${RANKS[i + 2].zh} ${n}`" />
          </div>
          <ul class="rlegend">
            <li v-for="(n, i) in player.rankCounts" :key="i"><i class="sw" :class="RANKS[i + 2].key" /><span>{{ L(RANKS[i + 2].zh, RANKS[i + 2].ja) }}</span><b class="num">{{ n }}</b></li>
          </ul>
        </section>
      </div>

      <div class="controls">
        <div class="seg" role="group">
          <button :aria-pressed="group === 'star'" @click="group = 'star'">{{ L('按星级', '★ 別') }}</button>
          <button :aria-pressed="group === 'const'" @click="group = 'const'">{{ L('按定数', '定数別') }}</button>
        </div>
        <div class="seg" role="group">
          <button :aria-pressed="show === 'crown'" @click="show = 'crown'">{{ L('看王冠', '王冠') }}</button>
          <button :aria-pressed="show === 'rank'" @click="show = 'rank'">{{ L('看评价', '評価') }}</button>
        </div>
        <ul class="legend only-desktop">
          <li><i class="cell dfc" />{{ L('全良', '全良') }}</li>
          <li><i class="cell fc" />{{ L('全连', 'フルコンボ') }}</li>
          <li><i class="cell clear" />{{ L('通关', 'クリア') }}</li>
          <li><i class="cell played" />{{ L('未通关', '未クリア') }}</li>
          <li><i class="cell none" />{{ L('没打过', '未プレイ') }}</li>
        </ul>
      </div>

      <section v-for="g in groups" :key="g.key" class="grp">
        <header>
          <h2 class="num gk">{{ g.key }}</h2>
          <div class="gbar" :aria-label="L('完成度', '達成度')">
            <i class="dfc" :style="{ width: (g.dfc / g.n) * 100 + '%' }" />
            <i class="fc" :style="{ width: ((g.fc - g.dfc) / g.n) * 100 + '%' }" />
            <i class="clear" :style="{ width: ((g.clear - g.fc) / g.n) * 100 + '%' }" />
          </div>
          <span class="gn"><b class="num">{{ g.fc }}</b><span class="num"> / {{ g.n }}</span> {{ L('全连', 'フルコンボ') }}</span>
        </header>
        <div class="cells">
          <RouterLink
            v-for="x in g.items"
            :key="x.song.id + '-' + x.c.d"
            :to="`/songs/${x.song.id}?d=${x.c.d}`"
            class="cell big"
            :class="[show === 'crown' ? crownKey(x.score) : 'rk ' + (x.score ? RANKS[x.score.rank].key : 'none'), { ura: x.c.d === 5 }]"
            @mouseenter="sel = x"
            @mouseleave="sel = null"
          >
            <span class="ct truncate">{{ songTitle(x.song) }}</span>
            <span class="cm num">{{ x.c.constant?.toFixed(1) ?? '' }}<em v-if="x.c.d === 5">{{ L(DIFFS[5].short, DIFFS[5].shortJa) }}</em></span>
            <span v-if="show === 'rank' && x.score && RANKS[x.score.rank].glyph" class="cg">{{ L(RANKS[x.score.rank].glyph, RANKS[x.score.rank].glyphJa) }}</span>
          </RouterLink>
        </div>
      </section>

      <Transition name="pop">
        <div v-if="sel" class="peek only-desktop">
          <b>{{ songTitle(sel.song) }}</b>
          <span class="num">{{ sel.score ? fmt(sel.score.score) : L('还没打过', '未プレイ') }}</span>
          <span v-if="sel.score" class="t-caption num">{{ sel.score.good }} / {{ sel.score.ok }} / {{ sel.score.ng }}</span>
        </div>
      </Transition>
    </template>
  </div>
</template>

<style scoped>
.top {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 56px;
  align-items: center;
  padding-bottom: 28px;
  border-bottom: 1px solid var(--line);
}
.crowns {
  display: flex;
  gap: 36px;
}
.cstat {
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  column-gap: 10px;
}
.cstat b {
  font-size: var(--fs-36);
  line-height: 1;
}
.cstat span:last-child {
  grid-column: 2;
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.ranks {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.rbar {
  display: flex;
  height: 14px;
  border-radius: var(--r-xs);
  overflow: hidden;
  gap: 2px;
}
.rbar i,
.sw {
  background: var(--c);
}
.iki1 {
  --c: var(--rank-iki1);
}
.iki2 {
  --c: var(--rank-iki2);
}
.iki3 {
  --c: var(--rank-iki3);
}
.miyabi1 {
  --c: var(--rank-miyabi1);
}
.miyabi2 {
  --c: var(--rank-miyabi2);
}
.miyabi3 {
  --c: var(--rank-miyabi3);
}
.kiwami {
  --c: var(--rank-kiwami);
}
.rlegend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  font-size: var(--fs-12);
  color: var(--ink-2);
}
.rlegend li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.rlegend b {
  font-size: var(--fs-14);
  color: var(--ink);
}
.sw {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}
.controls {
  position: sticky;
  top: var(--bar-h);
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 calc(var(--gutter) * -1);
  padding: 12px var(--gutter);
  background: color-mix(in srgb, var(--bg) 92%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.legend {
  display: flex;
  gap: 14px;
  margin-left: auto;
  font-size: var(--fs-12);
  color: var(--ink-2);
}
.legend li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.legend .cell {
  width: 14px;
  height: 14px;
  border-radius: var(--r-xs);
}
.grp {
  margin-top: 20px;
}
.grp header {
  display: grid;
  grid-template-columns: 64px minmax(0, 320px) auto;
  align-items: center;
  gap: 16px;
  margin-bottom: 10px;
}
.gk {
  font-size: var(--fs-28);
  font-weight: 700;
  line-height: 1;
}
.gbar {
  display: flex;
  height: 8px;
  border-radius: var(--r-xs);
  background: var(--bg-sunk);
  overflow: hidden;
}
.gbar .dfc {
  background: var(--crown-dfc);
  background-size: 400px 100%;
}
.gbar .fc {
  background: var(--crown-fc);
}
.gbar .clear {
  background: var(--crown-clear);
}
.gn {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.gn b {
  font-size: var(--fs-18);
  color: var(--ink);
}
.cells {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 6px;
}

/* 点灯格 */
.cell {
  --bd: var(--line-strong);
  --bg2: var(--surface);
  --fg: var(--ink-3);
  display: block;
  border: 1.5px solid var(--bd);
  background: var(--bg2);
  color: var(--fg);
}
.cell.none {
  border-style: dashed;
}
.cell.played {
  --fg: var(--ink-2);
}
.cell.clear {
  --bd: var(--crown-clear);
  --bg2: color-mix(in srgb, var(--crown-clear) 16%, var(--surface));
  --fg: var(--ink);
}
.cell.fc {
  --bd: var(--crown-fc);
  --bg2: color-mix(in srgb, var(--crown-fc) 20%, var(--surface));
  --fg: var(--ink);
}
.cell.dfc {
  border: 2px solid transparent;
  background: linear-gradient(var(--surface), var(--surface)) padding-box, var(--crown-dfc) border-box;
  --fg: var(--ink);
}
.cell.big {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 52px;
  padding: 6px 8px;
  border-radius: 8px;
  transition: transform var(--dur-1);
}
.cell.big.dfc {
  padding: 5.5px 7.5px;
}
.cell.big:hover {
  transform: translateY(-2px);
}
.cell.rk {
  --bd: var(--c, var(--line-strong));
  --bg2: color-mix(in srgb, var(--c, transparent) 14%, var(--surface));
  --fg: var(--ink);
}
.cell.rk.none {
  --fg: var(--ink-3);
}
.ct {
  font-size: var(--fs-12);
  font-weight: 700;
  line-height: 1.2;
}
.cm {
  font-size: var(--fs-13);
  line-height: 1;
  opacity: 0.75;
}
.cm em {
  font-style: normal;
  margin-left: 4px;
  font-family: var(--font-ui);
  font-size: 10px;
  font-weight: 700;
  color: var(--diff-ura);
}
.cg {
  position: absolute;
  right: 6px;
  bottom: 4px;
  font-size: var(--fs-13);
  font-weight: 900;
  color: var(--c);
}
.peek {
  position: fixed;
  right: 24px;
  bottom: 64px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--ai-900);
  color: #fff;
  box-shadow: var(--shadow-pop);
  pointer-events: none;
}
.peek .num {
  font-size: var(--fs-22);
}
.peek .t-caption {
  color: var(--ai-300);
}
@media (max-width: 1099px) {
  .top {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
  }
}
@media (max-width: 767px) {
  .crowns {
    justify-content: space-between;
    gap: 12px;
  }
  .cstat b {
    font-size: var(--fs-28);
  }
  .controls {
    top: 96px;
    overflow-x: auto;
  }
  .grp header {
    grid-template-columns: 56px minmax(0, 1fr) auto;
    gap: 10px;
  }
  .cells {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
