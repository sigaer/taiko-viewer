<script setup>
import { computed, ref } from 'vue'
import Icon from '../components/Icon.vue'
import SongCell from '../components/SongCell.vue'
import Diff from '../components/Diff.vue'
import Crown from '../components/Crown.vue'
import Rank from '../components/Rank.vue'
import Gate from '../components/Gate.vue'
import { recommendations, songById, chartOf, scoreOf, DIMS, GOAL_TYPES, player, fmt } from '../mock/data'
import { L, isReady, toast } from '../store'

// 推荐：两种问法 —— 「平常练什么」按当前短板推荐；「冲目标」按离某个评价 / 王冠还差多少排序。
const mode = ref('daily')
const dim = ref('all')
const target = ref('ziya')
const TARGETS = [
  { v: 'goku', zh: '极', ja: '極' },
  { v: 'ziya', zh: '紫雅', ja: '紫雅' },
  { v: 'fenya', zh: '粉雅', ja: '桃雅' },
  { v: 'full_combo', zh: '全连', ja: 'フルコンボ' },
  { v: 'dondaful', zh: '全良', ja: '全良' },
]
const daily = computed(() => recommendations.filter((r) => dim.value === 'all' || r.dim === dim.value))
const chase = computed(() =>
  [
    { songId: 971, d: 4, gap: L('还差 4,280 分', 'あと 4,280 点'), pct: 91 },
    { songId: 345, d: 4, gap: L('还差 6,900 分', 'あと 6,900 点'), pct: 84 },
    { songId: 179, d: 4, gap: L('还差 15,980 分', 'あと 15,980 点'), pct: 71 },
    { songId: 1351, d: 4, gap: L('还差 22,410 分', 'あと 22,410 点'), pct: 58 },
    { songId: 100126, d: 4, gap: L('还差 31,050 分', 'あと 31,050 点'), pct: 44 },
  ].map((x, i) => ({ ...x, pct: Math.max(20, x.pct - TARGETS.findIndex((t) => t.v === target.value) * 3 + i) })),
)
const dimOf = (k) => DIMS.find((d) => d.key === k)
const picked = ref(null)
function setGoal(r, g) {
  picked.value = `${r.songId}-${g}`
  toast(L('已设为这次想练', '今回の練習に設定しました'))
}
</script>

<template>
  <div class="page">
    <Gate v-if="!isReady" :what="L('练习推荐', 'おすすめ')" />
    <template v-else>
      <div class="head">
        <div class="seg big" role="group">
          <button :aria-pressed="mode === 'daily'" @click="mode = 'daily'">{{ L('平常练什么', 'ふだんの練習') }}</button>
          <button :aria-pressed="mode === 'chase'" @click="mode = 'chase'">{{ L('冲一个目标', '目標を狙う') }}</button>
        </div>
        <p v-if="mode === 'daily'" class="t-small">{{ L('按你现在的六维挑的曲子，难度落在能力的 90%–105% 之间。', 'いまの 6 つの力に合わせ、実力の 90〜105% に収まる譜面を選んでいます。') }}</p>
      </div>

      <template v-if="mode === 'daily'">
        <div class="chips">
          <button class="chip" :aria-pressed="dim === 'all'" @click="dim = 'all'">{{ L('全部方向', 'すべて') }}</button>
          <button v-for="d in DIMS" :key="d.key" class="chip" :aria-pressed="dim === d.key" @click="dim = d.key">
            {{ L(d.zh, d.ja) }}<i v-if="d.key === player.focus" class="dot" style="color: var(--ka)" />
          </button>
        </div>
        <ul class="recs">
          <li v-for="r in daily" :key="r.songId" class="rec">
            <RouterLink :to="`/songs/${r.songId}?d=${r.d}`" class="rsong">
              <SongCell :song="songById[r.songId]" size="lg" :sub="r.reason" />
            </RouterLink>
            <div class="rmeta">
              <Diff :d="r.d" :star="chartOf(r.songId, r.d).star" :constant="chartOf(r.songId, r.d).constant" />
              <span class="tag tag-ka">{{ L(dimOf(r.dim).zh, dimOf(r.dim).ja) }}</span>
              <span v-if="r.unplayed" class="tag">{{ L('没打过', '未プレイ') }}</span>
              <template v-else-if="scoreOf(r.songId, r.d)">
                <Crown :v="scoreOf(r.songId, r.d).crown" size="sm" /><Rank :v="scoreOf(r.songId, r.d).rank" />
                <span class="num t-small">{{ fmt(scoreOf(r.songId, r.d).score) }}</span>
              </template>
            </div>
            <div class="fit" :title="L('相对你当前能力的难度', '現在の実力に対する難度')">
              <span class="fitbar"><i class="zone" /><i class="pin" :style="{ left: ((r.fit - 80) / 35) * 100 + '%' }" /></span>
              <span class="num">{{ r.fit }}%</span>
            </div>
            <div class="ract">
              <button v-for="g in r.options" :key="g" class="btn btn-sm" :class="{ 'btn-ink': picked === `${r.songId}-${g}` }" @click="setGoal(r, g)">
                <Icon v-if="picked === `${r.songId}-${g}`" name="check" :size="14" />{{ L(GOAL_TYPES[g].zh, GOAL_TYPES[g].ja) }}
              </button>
            </div>
          </li>
        </ul>
      </template>

      <template v-else>
        <div class="chips">
          <button v-for="t in TARGETS" :key="t.v" class="chip" :aria-pressed="target === t.v" @click="target = t.v">{{ L(t.zh, t.ja) }}</button>
        </div>
        <ul class="recs">
          <li v-for="r in chase" :key="r.songId" class="rec chase">
            <RouterLink :to="`/songs/${r.songId}?d=${r.d}`" class="rsong"><SongCell :song="songById[r.songId]" size="lg" /></RouterLink>
            <div class="rmeta"><Diff :d="r.d" :star="chartOf(r.songId, r.d).star" :constant="chartOf(r.songId, r.d).constant" /></div>
            <div class="prog">
              <span class="pbar"><i :style="{ width: r.pct + '%' }" /></span>
              <span class="t-small"><b>{{ r.gap }}</b></span>
            </div>
            <div class="ract"><button class="btn btn-sm" @click="setGoal(r, 'rank-upgrade')">{{ L('设为想练', '目標にする') }}</button></div>
          </li>
        </ul>
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
  height: 38px;
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
.recs {
  border-top: 1px solid var(--line-strong);
}
.rec {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1.2fr) 150px auto;
  align-items: center;
  gap: 24px;
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
}
.rsong:hover :deep(.t) {
  color: var(--ka-ink);
}
.rsong :deep(.t) {
  font-size: var(--fs-16);
}
.rsong :deep(.s) {
  white-space: normal;
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
  /* 90%–105% 的严格区间 */
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
  box-shadow: inset 0 0 0 2px #fff, 0 0 0 1px var(--ai-900);
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
  background: var(--don);
}
.rec.chase {
  grid-template-columns: minmax(0, 1.4fr) auto minmax(0, 1fr) auto;
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
    margin: 0 calc(var(--gutter) * -1) 8px;
    padding: 0 var(--gutter);
  }
  .seg.big {
    width: 100%;
  }
  .seg.big button {
    flex: 1;
    height: 42px;
  }
  .ract .btn {
    flex: 1;
  }
}
</style>
