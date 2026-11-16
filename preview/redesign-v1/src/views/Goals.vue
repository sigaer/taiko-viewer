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

// 目标：旧版没有独立页面，创建入口散落在首页、推荐、歌曲详情，进展又要去同步页看。
// 这里给它一个家：当前目标 + 每次尝试的轨迹 + 换目标 + 历史。规则仍然是「同一时间只有一个目标」。
const goals = reactive(seed.map((g) => ({ ...g })))
const active = computed(() => goals.find((g) => g.status === 'active'))
const history = computed(() => goals.filter((g) => g.status !== 'active'))
const filter = ref('all')
const shown = computed(() => history.value.filter((g) => filter.value === 'all' || g.status === filter.value))
const picker = ref(false)
const pick = reactive({ songId: null, type: null })
const dropOpen = ref(false)

const song = (g) => songById[g.songId]
const chart = (g) => chartOf(g.songId, g.d)
const dimName = (k) => L(DIMS.find((d) => d.key === k).zh, DIMS.find((d) => d.key === k).ja)
const counts = computed(() => ({
  completed: goals.filter((g) => g.status === 'completed').length,
  cancelled: goals.filter((g) => g.status === 'cancelled').length,
}))
const maxNg = computed(() => Math.max(...(active.value?.attempts.map((a) => a.ng) ?? [1])))

function create() {
  const cur = active.value
  if (cur) Object.assign(cur, { status: 'cancelled', doneAgo: 0, evidence: L('换成了新的目标', '新しい目標に変更') })
  const r = recommendations.find((x) => x.songId === pick.songId)
  goals.unshift({ id: 'g' + Date.now(), status: 'active', type: pick.type, songId: r.songId, d: r.d, createdAgo: 0, dim: r.dim, baseline: { ng: 6, score: 940000 }, latest: { ng: 6, score: 940000 }, attempts: [{ ago: 0, ng: 6, score: 940000 }], target: { label: L(GOAL_TYPES[pick.type].zh, GOAL_TYPES[pick.type].ja) } })
  picker.value = false
  toast(L('新目标已设好。练完同步一次就能看到进展。', '新しい目標を設定しました。'))
}
function drop() {
  Object.assign(active.value, { status: 'cancelled', doneAgo: 0, evidence: L('先放下了', 'いったん保留') })
  dropOpen.value = false
  toast(L('已放下这个目标，记录还在历史里', '目標を保留にしました'), 'info')
}
</script>

<template>
  <div class="page">
    <Gate v-if="!isReady" :what="L('练习目标', '練習目標')" />
    <template v-else>
      <div class="cols">
        <div>
          <!-- 当前目标 -->
          <section v-if="active" class="panel cur">
            <header class="spread">
              <h2 class="t-h3">{{ L('这次想练', '今回の練習') }}</h2>
              <span class="t-caption">{{ active.createdAgo === 0 ? L('今天设下', '今日設定') : L(`${active.createdAgo} 天前设下`, `${active.createdAgo} 日前に設定`) }}</span>
            </header>
            <div class="cur-top">
              <Cover :song="song(active)" size="xl" class="ccover" />
              <div class="grow">
                <p class="gtype">{{ L(GOAL_TYPES[active.type].zh, GOAL_TYPES[active.type].ja) }}</p>
                <h3 class="gtitle">{{ songTitle(song(active)) }}</h3>
                <div class="row-wrap" style="margin-top: 10px">
                  <Diff :d="active.d" :star="chart(active).star" :constant="chart(active).constant" lg />
                  <span class="tag tag-ka">{{ dimName(active.dim) }}</span>
                </div>
              </div>
            </div>

            <!-- 尝试轨迹：柱子越矮，离全连越近 -->
            <div class="tries">
              <div v-for="(a, i) in active.attempts" :key="i" class="try">
                <b class="num">{{ a.ng }}</b>
                <span class="col-bar"><i :style="{ height: (a.ng / maxNg) * 100 + '%' }" :class="{ last: i === active.attempts.length - 1 }" /></span>
                <span class="t-caption">{{ a.ago === 0 ? L('今天', '今日') : a.ago === 1 ? L('昨天', '昨日') : L(`${a.ago} 天前`, `${a.ago} 日前`) }}</span>
                <span class="t-caption num">{{ fmt(a.score) }}</span>
              </div>
              <div class="try goal">
                <b class="num">0</b>
                <span class="col-bar"><i class="ring" /></span>
                <span class="t-caption">{{ L('目标', '目標') }}</span>
                <span class="t-caption">{{ L('不可 0', '不可 0') }}</span>
              </div>
            </div>

            <div class="cur-acts">
              <RouterLink :to="`/songs/${active.songId}?d=${active.d}`" class="btn">{{ L('查看谱面', '譜面を見る') }}</RouterLink>
              <button class="btn btn-primary" :disabled="store.syncing" @click="runSync"><Icon name="sync" :size="16" />{{ L('练后同步', 'プレイ後に同期') }}</button>
              <span class="grow" />
              <button class="btn btn-ghost" @click="picker = true">{{ L('换一个目标', '目標を変える') }}</button>
              <button class="btn btn-ghost" @click="dropOpen = true">{{ L('先放下', '保留にする') }}</button>
            </div>
          </section>

          <section v-else class="panel">
            <EmptyLane :title="L('现在没有在练的目标', '進行中の目標はありません')" :text="L('挑一首歌、定一件小事，比如把不可再压低一点。', '一曲選んで、小さな目標をひとつ決めましょう。')">
              <button class="btn btn-primary" @click="picker = true">{{ L('选一个目标', '目標を選ぶ') }}</button>
            </EmptyLane>
          </section>

          <!-- 历史 -->
          <section class="section">
            <div class="section-head">
              <h2 class="t-h2">{{ L('练过的目标', 'これまでの目標') }}</h2>
              <div class="seg" role="group">
                <button :aria-pressed="filter === 'all'" @click="filter = 'all'">{{ L('全部', 'すべて') }}</button>
                <button :aria-pressed="filter === 'completed'" @click="filter = 'completed'">{{ L('练成了', '達成') }} {{ counts.completed }}</button>
                <button :aria-pressed="filter === 'cancelled'" @click="filter = 'cancelled'">{{ L('放下的', '保留') }} {{ counts.cancelled }}</button>
              </div>
            </div>
            <ul class="hist">
              <li v-for="g in shown" :key="g.id">
                <i class="note" :class="g.status === 'completed' ? 'big roll' : 'ghost'" />
                <Cover :song="song(g)" />
                <div class="grow">
                  <b class="truncate">{{ songTitle(song(g)) }}</b>
                  <span class="row" style="gap: 8px; margin-top: 3px"><Diff :d="g.d" :star="chart(g).star" short /><span class="t-small">{{ L(GOAL_TYPES[g.type].zh, GOAL_TYPES[g.type].ja) }}</span></span>
                </div>
                <span class="ev">{{ g.evidence }}</span>
                <span class="tag" :class="g.status === 'completed' ? 'tag-ok' : ''">{{ g.status === 'completed' ? L('练成了', '達成') : L('放下了', '保留') }}</span>
                <span class="t-caption num when">{{ g.doneAgo === 0 ? L('今天', '今日') : L(`${g.doneAgo} 天前`, `${g.doneAgo} 日前`) }}</span>
              </li>
            </ul>
          </section>
        </div>

        <!-- 今天可以练 -->
        <aside>
          <div class="section-head"><h2 class="t-h2">{{ L('今天可以练', '今日の候補') }}</h2><RouterLink to="/play/recommend" class="more">{{ L('全部推荐', 'すべて見る') }}</RouterLink></div>
          <ul class="plan">
            <li v-for="r in recommendations" :key="r.songId">
              <SongCell :song="songById[r.songId]" :sub="r.reason" />
              <div class="row-wrap popts">
                <button v-for="g in r.options" :key="g" class="chip" @click="(pick.songId = r.songId), (pick.type = g), (picker = true)">{{ L(GOAL_TYPES[g].zh, GOAL_TYPES[g].ja) }}</button>
              </div>
            </li>
          </ul>
        </aside>
      </div>
    </template>

    <Sheet :open="picker" :title="L('这次想练什么', '今回は何を目指す？')" :width="520" @close="picker = false">
      <ul class="pick">
        <li v-for="r in recommendations" :key="r.songId" :class="{ on: pick.songId === r.songId }">
          <button class="prow" @click="(pick.songId = r.songId), (pick.type = r.options[0])">
            <i class="note" :class="pick.songId === r.songId ? '' : 'ghost'" />
            <SongCell :song="songById[r.songId]" :sub="dimName(r.dim)" class="grow" />
            <Diff :d="r.d" :star="chartOf(r.songId, r.d).star" short />
          </button>
          <div v-if="pick.songId === r.songId" class="row-wrap ptypes">
            <button v-for="g in r.options" :key="g" class="chip" :aria-pressed="pick.type === g" @click="pick.type = g">{{ L(GOAL_TYPES[g].zh, GOAL_TYPES[g].ja) }}</button>
          </div>
        </li>
      </ul>
      <p v-if="active" class="t-small">{{ L('同一时间只保留一个目标，现在的目标会移到历史里。', '目標は同時に 1 つだけ。現在の目標は履歴に移ります。') }}</p>
      <template #foot>
        <button class="btn" @click="picker = false">{{ L('取消', 'キャンセル') }}</button>
        <button class="btn btn-primary" :disabled="!pick.songId" @click="create">{{ L('就练这个', 'これにする') }}</button>
      </template>
    </Sheet>

    <Sheet :open="dropOpen" :title="L('先放下这个目标？', 'この目標を保留にしますか？')" :width="420" @close="dropOpen = false">
      <p>{{ L('已有的尝试记录会留在历史里，随时可以再设回来。', 'これまでの挑戦は履歴に残り、いつでも再設定できます。') }}</p>
      <template #foot><button class="btn" @click="dropOpen = false">{{ L('继续练', '続ける') }}</button><button class="btn btn-ink" @click="drop">{{ L('先放下', '保留にする') }}</button></template>
    </Sheet>
  </div>
</template>

<style scoped>
.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 40px;
  align-items: start;
}
.cur {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 24px 24px;
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
.tries {
  display: flex;
  gap: 8px;
  padding: 16px 0 0;
  border-top: 1px solid var(--line);
}
.try {
  flex: 1;
  max-width: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.try b {
  font-size: var(--fs-22);
}
.col-bar {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  height: 84px;
}
.col-bar i {
  width: 44%;
  min-height: 4px;
  border-radius: 6px 6px 0 0;
  background: var(--ink-3);
  opacity: 0.5;
}
.col-bar i.last {
  background: var(--don);
  opacity: 1;
}
.col-bar .ring {
  width: 30px;
  height: 30px;
  min-height: 0;
  border-radius: 50%;
  background: none;
  border: 2px solid var(--ink);
  opacity: 1;
}
.try.goal {
  margin-left: auto;
}
.try.goal b {
  color: var(--don-ink);
}
.cur-acts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.hist {
  border-top: 1px solid var(--line-strong);
}
.hist li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}
.hist .note {
  width: 20px;
  height: 20px;
}
.hist b {
  display: block;
}
.ev {
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.when {
  width: 56px;
  text-align: right;
  font-size: var(--fs-13);
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
  }
}
@media (max-width: 767px) {
  .cur {
    padding: 16px;
  }
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
  .cur-acts .btn {
    flex: 1 1 40%;
  }
  .cur-acts .grow {
    display: none;
  }
  .hist li {
    flex-wrap: wrap;
  }
  .ev {
    order: 5;
    width: 100%;
    padding-left: 88px;
    margin-top: -6px;
  }
}
</style>
