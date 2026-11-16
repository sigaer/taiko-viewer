<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useDock } from '../dock'
import { useRoute } from 'vue-router'
import Icon from '../components/Icon.vue'
import Cover from '../components/Cover.vue'
import Diff from '../components/Diff.vue'
import Crown from '../components/Crown.vue'
import Rank from '../components/Rank.vue'
import Radar from '../components/Radar.vue'
import ChartSheet from '../components/ChartSheet.vue'
import DensityStrip from '../components/DensityStrip.vue'
import Spark from '../components/Spark.vue'
import Sheet from '../components/Sheet.vue'
import ThreadRow from '../components/ThreadRow.vue'
import EmptyLane from '../components/EmptyLane.vue'
import PlayerAvatar from '../components/PlayerAvatar.vue'
import { songById, DIFFS, GENRES, CHART_AXES, scoreOf, chartUgc, users, threads, GOAL_TYPES, UGC_TAGS, fmt } from '../mock/data'
import { L, isReady, isAuthed, songTitle, songSub, subLang, toast, store, recordRecent } from '../store'
import { useQueryState } from '../routeState'

// 歌曲详情。一个难度 = 一个视角：切换难度后，谱面、数据、我的成绩、玩家体感全部跟着换。
// 桌面：左主栏（谱面 / 数据 / 体感 / 讨论）+ 右侧吸顶的「我的成绩」。手机：我的成绩提到最前，底部固定操作条。
const route = useRoute()
const song = computed(() => songById[route.params.id])
// R1：难度写在地址的 d 里；切换只替换 d，保留 from / q / m 等其余参数。d 缺失或无效时取魔王（没有魔王取最高难度）。
// m：从配置串搜索进来时要定位的小节（P3 / V2）。
const qs = useQueryState({ d: { type: 'number', default: 0 }, m: { type: 'number', default: 0 } })
const d = computed(() => {
  const s = song.value
  if (!s) return 4
  if (s.charts.some((c) => c.d === qs.d)) return qs.d
  return s.charts.some((c) => c.d === 4) ? 4 : s.charts.at(-1).d
})
function pick(v) {
  qs.d = v
}
// P10：记录最近看过的歌
watch(
  () => song.value?.id,
  (id) => id != null && recordRecent(id),
  { immediate: true },
)
const chart = computed(() => song.value.charts.find((c) => c.d === d.value))
const mine = computed(() => (isReady.value ? scoreOf(song.value.id, d.value) : null))
// 其余难度里有成绩的，一行一条，方便对比
const otherMine = computed(() =>
  !isReady.value ? [] : song.value.charts.filter((c) => c.d !== d.value).map((c) => ({ c, sc: scoreOf(song.value.id, c.d) })).filter((x) => x.sc),
)
const axes = computed(() => CHART_AXES.map((a) => ({ key: a.key, label: L(a.zh, a.ja), value: chart.value.abilities[a.key] })))
const side = ref('single')
const branch = ref('master')
const playing = ref(false)
const related = computed(() => threads.filter((t) => t.song?.id === song.value.id).concat(threads.filter((t) => t.song?.id !== song.value.id && t.type === 'guide')).slice(0, 3))
const history = computed(() => {
  if (!mine.value) return []
  const end = mine.value.score
  return [0.93, 0.945, 0.94, 0.962, 0.97, 0.968, 0.984, 0.99, 1].map((k) => Math.round(end * k))
})

// ---------- 头部 ----------
const shelfTag = computed(() => {
  const s = song.value.shelf
  if (s === 0) return { cls: 'tag-ok', text: L('国行实装', '中国版稼働中') }
  if (s === 1) return { cls: '', text: L('国行未上架', '中国版未収録') }
  return { cls: 'tag-info', text: L('其他平台', '他機種') }
})
const aliasText = computed(() => (song.value.aliases || []).join(L('、', '、')))

// ---------- 谱面图：m 定位、展开 ----------
const totalMeasures = computed(() => Math.max(4, chart.value.density?.length || 64))
const expanded = ref(false)
const focusM = computed(() => (qs.m >= 1 && qs.m <= totalMeasures.value ? Math.floor(qs.m) : 0))
const sheetRows = computed(() => (expanded.value ? Math.ceil(totalMeasures.value / 4) : Math.min(5, Math.ceil(totalMeasures.value / 4))))
const sheetStart = computed(() => {
  if (expanded.value || !focusM.value) return 1
  const rowStart = Math.floor((focusM.value - 1) / 4) * 4 + 1
  const lastStart = Math.max(1, Math.floor((totalMeasures.value - sheetRows.value * 4) / 4) * 4 + 1)
  return Math.min(rowStart, lastStart)
})
const sheetDensity = computed(() => (chart.value.density || []).slice(sheetStart.value - 1))
const sheetEnd = computed(() => Math.min(totalMeasures.value, sheetStart.value + sheetRows.value * 4 - 1))
const sheetLabel = computed(() =>
  focusM.value
    ? L(`谱面图，第 ${sheetStart.value}–${sheetEnd.value} 小节，已定位到第 ${focusM.value} 小节`, `譜面画像：${sheetStart.value}–${sheetEnd.value} 小節（${focusM.value} 小節目を表示）`)
    : '',
)
// 同一首歌换难度：收起展开的谱面，位置不跳
watch(d, () => (expanded.value = false))

// ---------- 手机底部操作条（F1.3 / F1.4）：高度写进 --dock-h，外壳据此给正文留白 ----------
const mbarEl = ref(null)
useDock(mbarEl)

// ---------- 难度切换条：左右键 ----------
const tabRefs = ref([])
// 横滑的难度条（手机）：当前难度始终滚入可视区（看图复核：360 宽下选中的「魔王」在屏幕外）。只动横向，不动页面
function revealTab() {
  nextTick(() => {
    const i = song.value.charts.findIndex((c) => c.d === d.value)
    const el = tabRefs.value[i]
    const bar = el?.parentElement
    if (!el || !bar || bar.scrollWidth <= bar.clientWidth) return
    const left = el.offsetLeft // .diffbar 是 sticky（定位元素），offsetLeft 相对它
    const right = left + el.offsetWidth
    if (left < bar.scrollLeft) bar.scrollLeft = Math.max(0, left - 16)
    else if (right > bar.scrollLeft + bar.clientWidth - 28) bar.scrollLeft = right - bar.clientWidth + 28
  })
}
watch(d, revealTab)
onMounted(revealTab)
function onTabKey(e, i) {
  const list = song.value.charts
  let j = -1
  if (e.key === 'ArrowRight') j = (i + 1) % list.length
  else if (e.key === 'ArrowLeft') j = (i - 1 + list.length) % list.length
  else if (e.key === 'Home') j = 0
  else if (e.key === 'End') j = list.length - 1
  if (j < 0) return
  e.preventDefault()
  pick(list[j].d)
  nextTick(() => tabRefs.value[j]?.focus())
}

// 玩家体感
const VOTE = computed(() => [L('明显偏易', 'かなり易'), L('偏易', 'やや易'), L('合理', '妥当'), L('偏难', 'やや難'), L('明显偏难', 'かなり難')])
const ugc = reactive({ myVote: null, myTags: new Set(), tagSheet: false, helped: new Set() })
const voteTotal = chartUgc.votes.reduce((a, b) => a + b, 0)
const voteMax = Math.max(...chartUgc.votes)
function vote(i) {
  if (!isAuthed.value) return toast(L('登录后可以投票', 'ログインすると投票できます'), 'info')
  ugc.myVote = ugc.myVote === i ? null : i
}
function toggleTag(t) {
  if (ugc.myTags.has(t)) ugc.myTags.delete(t)
  else if (ugc.myTags.size < 5) ugc.myTags.add(t)
  else toast(L('最多选 5 个标签', 'タグは 5 個まで'), 'info')
}
function toggleHelp(i) {
  if (ugc.helped.has(i)) ugc.helped.delete(i)
  else ugc.helped.add(i)
}

// 设为目标
const goalSheet = ref(false)
const goalType = ref('fc')
const goalOptions = computed(() => {
  const m = mine.value
  if (!m) return ['played', 'clear']
  const out = ['score-pb']
  if (m.ng > 0) out.push('ng-reduced', 'fc')
  if (m.crown === 1) out.push('df')
  if (m.rank < 8) out.push('rank-upgrade')
  return out
})
function setGoal() {
  goalSheet.value = false
  toast(L('已设为这次想练。练完同步一次，就能看到进展。', '今回の練習に設定しました。'))
}
const rtLink = computed(() => `/tools/rt?song=${song.value.id}&d=${d.value}`)
const noConstText = computed(() => L('这个难度还没有定数', 'この難易度はまだ定数がありません'))
const agoText = (n) => (n === 0 ? L('今天', '今日') : L(`${n} 天前`, `${n} 日前`))
</script>

<template>
  <div v-if="!song" class="page">
    <div class="panel">
      <EmptyLane :title="L('没有找到这首歌', 'この楽曲は見つかりません')" :text="L('它可能已被归并到新的曲目编号。', '新しい楽曲 ID に統合された可能性があります。')" tone="error">
        <RouterLink to="/songs" class="btn">{{ L('回到曲库', '楽曲一覧へ') }}</RouterLink>
      </EmptyLane>
    </div>
  </div>

  <div v-else class="page sd">
    <!-- ============ 头部 ============ -->
    <header class="head">
      <Cover :song="song" size="lg" class="hcover" />
      <div class="grow hbody">
        <div class="meta">
          <span class="genre"><i class="dot" :style="{ color: GENRES[song.genre].color }" />{{ L(GENRES[song.genre].zh, GENRES[song.genre].ja) }}</span>
          <span class="tag" :class="shelfTag.cls">{{ shelfTag.text }}</span>
          <span v-if="song.version" class="tag">{{ song.version }}</span>
        </div>
        <h1 class="title">{{ songTitle(song) }}</h1>
        <p v-if="songSub(song)" class="sub title-wrap-2" :lang="subLang" :title="songSub(song)">{{ songSub(song) }}</p>
        <dl class="facts">
          <div class="f-artist">
            <dt>{{ L('艺术家', 'アーティスト') }}</dt>
            <dd v-if="song.artist" class="title-1l" :title="song.artist">{{ song.artist }}</dd>
            <dd v-else class="na">—</dd>
          </div>
          <div><dt>BPM</dt><dd class="num">{{ song.bpm }}</dd></div>
          <div class="f-open"><dt>{{ L('上架', '収録日') }}</dt><dd v-if="song.openDay" class="num">{{ song.openDay }}</dd><dd v-else class="na">—</dd></div>
          <div class="f-id"><dt>ID</dt><dd class="num">{{ song.id }}</dd></div>
        </dl>
        <p v-if="song.aliases && song.aliases.length" class="aliases title-1l" :title="aliasText">{{ L('别名：', '別名：') }}{{ aliasText }}</p>
      </div>
      <div class="head-acts only-desktop">
        <button class="btn btn-ink"><Icon name="playTri" :size="16" />{{ L('游玩练习', '練習プレイ') }}</button>
        <button class="btn" @click="toast(L('已收藏', 'お気に入りに追加'))"><Icon name="bookmark" :size="16" />{{ L('收藏', '保存') }}</button>
      </div>
    </header>

    <!-- ============ 难度切换 ============ -->
    <div class="diffbar" role="tablist" :aria-label="L('难度', '難易度')">
      <button
        v-for="(c, i) in song.charts"
        :key="c.d"
        :ref="(el) => (tabRefs[i] = el)"
        role="tab"
        class="diff-tab"
        :class="DIFFS[c.d].key"
        :aria-selected="d === c.d"
        :tabindex="d === c.d ? 0 : -1"
        @click="pick(c.d)"
        @keydown="onTabKey($event, i)"
      >
        <span class="dn">{{ L(DIFFS[c.d].zh, DIFFS[c.d].ja) }}</span>
        <span class="dshort" aria-hidden="true">{{ L(DIFFS[c.d].short, DIFFS[c.d].shortJa) }}</span>
        <span class="ds num">★{{ c.star }}</span>
        <span v-if="c.constant != null" class="dk num">{{ c.constant.toFixed(2) }}</span>
        <span v-else class="dk na" :aria-label="noConstText">—</span>
        <Crown v-if="isReady && scoreOf(song.id, c.d)" :v="scoreOf(song.id, c.d).crown" size="sm" />
      </button>
    </div>

    <div class="cols">
      <div class="maincol">
        <!-- 手机端把我的成绩放在最前面 -->
        <section class="panel mine only-mobile-flex" :aria-label="L('我的成绩', '自分の記録')">
          <template v-if="mine">
            <div class="mine-top">
              <Crown :v="mine.crown" size="lg" />
              <div>
                <b class="num score">{{ fmt(mine.score) }}</b>
                <span class="t-caption">{{ L('最好成绩', '自己ベスト') }} · <span class="num">{{ mine.acc.toFixed(2) }}%</span></span>
              </div>
              <Rank :v="mine.rank" lg />
            </div>
            <div class="judge" aria-hidden="true">
              <i class="g" :style="{ flex: mine.good }" /><i class="o" :style="{ flex: mine.ok }" /><i class="n" :style="{ flex: mine.ng }" />
            </div>
            <div class="judge-legend">
              <span>{{ L('良', '良') }}<b>{{ mine.good }}</b></span><span>{{ L('可', '可') }}<b>{{ mine.ok }}</b></span><span>{{ L('不可', '不可') }}<b>{{ mine.ng }}</b></span>
            </div>
          </template>
          <template v-else>
            <p class="t-small">{{ isReady ? L('这个难度还没有成绩。', 'この難易度はまだ記録がありません。') : L('登录并同步后，这里会显示你的成绩。', 'ログインして同期すると、ここに記録が表示されます。') }}</p>
            <p v-if="isReady && song.shelf !== 0" class="t-small note">{{ L('国服同步不包含这首歌。', '中国版の同期にはこの楽曲は含まれません。') }}</p>
          </template>
        </section>

        <!-- 谱面 -->
        <section class="block">
          <div class="section-head">
            <h2 class="t-h2">{{ L('谱面', '譜面') }}</h2>
            <div v-if="song.hasChartImage" class="row-wrap">
              <div v-if="chart.branch" class="seg" role="group" :aria-label="L('谱面分歧', '譜面分岐')">
                <button v-for="b in [['normal', L('普通', '普通')], ['expert', L('玄人', '玄人')], ['master', L('达人', '達人')]]" :key="b[0]" :aria-pressed="branch === b[0]" @click="branch = b[0]">{{ b[1] }}</button>
              </div>
              <div class="seg" role="group" :aria-label="L('单人或双人谱', '1人・2人譜面')">
                <button :aria-pressed="side === 'single'" @click="side = 'single'">{{ L('单人', '1人') }}</button>
                <button :aria-pressed="side === 'p1'" @click="side = 'p1'">P1</button>
                <button :aria-pressed="side === 'p2'" @click="side = 'p2'">P2</button>
              </div>
            </div>
          </div>

          <div class="audio">
            <button v-if="song.hasAudio" class="playbtn" :aria-label="playing ? L('暂停试听', '試聴を一時停止') : L('试听', '試聴')" :aria-pressed="playing" @click="playing = !playing">
              <Icon :name="playing ? 'rows' : 'playTri'" :size="18" />
            </button>
            <button v-else class="btn btn-sm noaudio" disabled>{{ L('没有试听', '試聴なし') }}</button>
            <div class="grow">
              <DensityStrip :values="chart.density" :height="40" />
              <div class="spread t-caption axis"><span class="num">1</span><span>{{ L('每小节密度，朱色是难点', '小節ごとの密度（朱色が難所）') }}</span><span class="num">{{ totalMeasures }}</span></div>
            </div>
          </div>

          <template v-if="song.hasChartImage">
            <p v-if="focusM && !expanded" class="locate t-small" role="status"><Icon name="target" :size="14" />{{ L(`已定位到第 ${focusM} 小节`, `${focusM} 小節目を表示しています`) }}</p>
            <ChartSheet
              :seed="song.id + d * 31 + (side === 'p2' ? 5 : 0) + (branch === 'normal' ? 9 : 0)"
              :density="sheetDensity"
              :rows="sheetRows"
              :start="sheetStart"
              :highlight="focusM || null"
              :label="sheetLabel"
            />
            <div class="spread sheet-foot">
              <span class="t-caption">{{ L(`第 ${sheetStart}–${sheetEnd} 小节，共 ${totalMeasures} 小节`, `${sheetStart}–${sheetEnd} 小節 / 全 ${totalMeasures} 小節`) }}</span>
              <div class="row-wrap">
                <button class="btn btn-sm" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? L('收起', '折りたたむ') : L('展开完整谱面', '全体を表示') }}</button>
                <button class="btn btn-sm" @click="toast(L('已开始下载 PNG', 'PNG をダウンロードします'))"><Icon name="download" :size="14" />PNG</button>
              </div>
            </div>
          </template>
          <div v-else class="panel nosheet">
            <EmptyLane compact :title="L('这张谱还没有谱面图', 'この譜面の譜面画像はまだありません')" :text="L('没有可用的 TJA 资源，暂时无法生成。', '利用できる TJA がないため、まだ生成できません。')" />
          </div>
        </section>

        <!-- 数据 -->
        <section class="block">
          <div class="section-head">
            <h2 class="t-h2">{{ L('谱面数据', '譜面データ') }}</h2>
            <RouterLink v-if="chart.constant != null" :to="rtLink" class="more">{{ L('用 RT 计算器算一下', 'RT 計算機で試す') }}</RouterLink>
            <button v-else class="more more-off" disabled :title="noConstText">{{ L('用 RT 计算器算一下', 'RT 計算機で試す') }}<span class="sr-only">{{ L('：', '：') }}{{ noConstText }}</span></button>
          </div>
          <div class="data">
            <div class="consts">
              <template v-if="chart.constant != null">
                <div class="stat main"><div class="v">{{ chart.constant.toFixed(2) }}</div><div class="k">{{ L('主定数（95%）', '主定数（95%）') }}</div></div>
                <div class="stat"><div class="v"><template v-if="chart.c75 != null">{{ chart.c75.toFixed(2) }}</template><span v-else class="na">—</span></div><div class="k">{{ L('75% 定数', '75% 定数') }}</div></div>
                <div class="stat"><div class="v"><template v-if="chart.c99 != null">{{ chart.c99.toFixed(2) }}</template><span v-else class="na">—</span></div><div class="k">{{ L('99% 定数', '99% 定数') }}</div></div>
              </template>
              <p v-else class="noconst"><span class="na">—</span>{{ noConstText }}</p>
              <div class="stat"><div class="v">{{ fmt(chart.notes) }}</div><div class="k">{{ L('物量', 'ノーツ数') }}</div></div>
              <div class="stat"><div class="v">{{ chart.roll }}<small>{{ L('秒', '秒') }}</small></div><div class="k">{{ L('连打时间', '連打時間') }}</div></div>
              <div class="stat"><div class="v">{{ chart.balloon }}</div><div class="k">{{ L('气球', '風船') }}</div></div>
            </div>
            <div class="radarbox">
              <Radar :axes="axes" :domain="[0, 15.5]" :size="260" tone="var(--ka)" :label="L('谱面能力分布', '譜面の能力分布')" />
            </div>
          </div>
        </section>

        <!-- 玩家体感 -->
        <section class="block">
          <div class="section-head">
            <h2 class="t-h2">{{ L('玩家体感', 'プレイヤーの体感') }}</h2>
            <span class="t-caption"><b class="num">{{ voteTotal }}</b> {{ L('人投票', '票') }}</span>
          </div>
          <div class="ugc">
            <div>
              <h3 class="fh">{{ L(`相对 ★${chart.star} 的难度`, `★${chart.star} に対する体感難度`) }}</h3>
              <div class="votes" role="group" :aria-label="L('体感难度投票', '体感難度の投票')">
                <button v-for="(v, i) in chartUgc.votes" :key="i" class="vote" :aria-pressed="ugc.myVote === i" @click="vote(i)">
                  <span class="vbar" aria-hidden="true"><i :style="{ height: (v / voteMax) * 100 + '%' }" /></span>
                  <b class="num">{{ v + (ugc.myVote === i ? 1 : 0) }}</b>
                  <span>{{ VOTE[i] }}</span>
                </button>
              </div>
              <p class="t-small">{{ L('多数人觉得这张谱偏难。', '多くのプレイヤーがやや難しいと感じています。') }}</p>
            </div>
            <div>
              <div class="spread"><h3 class="fh">{{ L('常见标签', 'よく付くタグ') }}</h3><button class="link t-small hit" @click="ugc.tagSheet = true">{{ L('我来标', 'タグを付ける') }}</button></div>
              <ul class="tagbars">
                <li v-for="t in chartUgc.tags" :key="t.name">
                  <span class="tn title-1l" :title="t.name">{{ t.name }}</span>
                  <span class="tb" aria-hidden="true"><i :style="{ width: (t.n / chartUgc.tags[0].n) * 100 + '%' }" /></span>
                  <b class="num">{{ t.n + (ugc.myTags.has(t.name) ? 1 : 0) }}</b>
                </li>
              </ul>
            </div>
          </div>
          <h3 class="fh tips-h">{{ L('玩家提示', 'プレイヤーのヒント') }}</h3>
          <ul class="tips">
            <li v-for="(t, i) in chartUgc.tips" :key="i">
              <PlayerAvatar :user="users[t.author]" :size="24" />
              <div class="grow">
                <p>{{ t.text }}</p>
                <span class="t-caption">{{ users[t.author].name }}<template v-if="t.verified"> · <span class="verified"><Icon name="check" :size="12" />{{ L('已游玩', 'プレイ済み') }}</span></template> · {{ t.ago }}</span>
              </div>
              <button class="help hit" :aria-pressed="ugc.helped.has(i)" :aria-label="L(`有用，${t.helpful + (ugc.helped.has(i) ? 1 : 0)} 人`, `役に立った：${t.helpful + (ugc.helped.has(i) ? 1 : 0)} 人`)" @click="toggleHelp(i)">
                <Icon name="thumb" :size="14" /><b class="num">{{ t.helpful + (ugc.helped.has(i) ? 1 : 0) }}</b>
              </button>
            </li>
          </ul>
          <form class="tipform" @submit.prevent="toast(L('提示已提交，审核通过后显示', 'ヒントを送信しました'))">
            <input class="input" maxlength="120" :aria-label="L('写一条提示', 'ヒントを書く')" :placeholder="isAuthed ? L('写一条 120 字以内的提示', '120 文字以内でヒントを書く') : L('登录后可以写提示', 'ログインするとヒントを書けます')" :disabled="!isAuthed" />
            <button class="btn" :disabled="!isAuthed">{{ L('发布提示', '投稿') }}</button>
          </form>
        </section>

        <!-- 讨论 -->
        <section class="block">
          <div class="section-head">
            <h2 class="t-h2">{{ L('相关讨论', '関連スレッド') }}</h2>
            <RouterLink to="/community/new" class="more">{{ L('发一帖', '投稿する') }}</RouterLink>
          </div>
          <div class="ruled"><ThreadRow v-for="t in related" :key="t.id" :thread="t" compact /></div>
        </section>
      </div>

      <!-- ============ 右栏：我的成绩 ============ -->
      <aside class="sidecol only-desktop">
        <section class="panel myscore" :aria-label="L('我的成绩', '自分の記録')">
          <header class="spread">
            <h2 class="t-h3">{{ L('我的成绩', '自分の記録') }}</h2>
            <Diff :d="d" :star="chart.star" short />
          </header>
          <template v-if="mine">
            <div class="ms-top">
              <Crown :v="mine.crown" size="lg" label />
              <Rank :v="mine.rank" lg label />
            </div>
            <div class="ms-score">
              <b class="num bigscore">{{ fmt(mine.score) }}</b>
              <span class="num acc">{{ mine.acc.toFixed(2) }}%</span>
            </div>
            <div>
              <div class="judge" aria-hidden="true"><i class="g" :style="{ flex: mine.good }" /><i class="o" :style="{ flex: mine.ok }" /><i class="n" :style="{ flex: mine.ng }" /></div>
              <div class="judge-legend">
                <span>{{ L('良', '良') }}<b>{{ mine.good }}</b></span><span>{{ L('可', '可') }}<b>{{ mine.ok }}</b></span><span>{{ L('不可', '不可') }}<b>{{ mine.ng }}</b></span>
              </div>
            </div>
            <dl class="mgrid">
              <div><dt>{{ L('最大连击', '最大コンボ') }}</dt><dd class="num">{{ mine.combo }}<small> / {{ chart.notes }}</small></dd></div>
              <div><dt>{{ L('连打', '連打') }}</dt><dd class="num">{{ mine.roll }}</dd></div>
              <div><dt>{{ L('单曲 RT', '単曲 RT') }}</dt><dd class="num">{{ mine.rt.toFixed(2) }}</dd></div>
              <div><dt>{{ L('游玩次数', 'プレイ回数') }}</dt><dd class="num">{{ mine.plays }}</dd></div>
              <div><dt>{{ L('最好成绩于', '達成日') }}</dt><dd>{{ agoText(mine.daysAgo) }}</dd></div>
              <div class="trend"><dt>{{ L('变化', '推移') }}</dt><dd><Spark :values="history" :w="96" :h="22" tone="var(--don)" /></dd></div>
            </dl>
            <button class="btn btn-primary btn-block" @click="goalSheet = true"><Icon name="flag" :size="16" />{{ L('设为这次想练', '今回の練習に設定') }}</button>
          </template>
          <template v-else-if="isReady">
            <EmptyLane compact :title="L('还没打过这个难度', 'まだプレイしていません')" :text="song.shelf !== 0 ? L('国服同步不包含这首歌。', '中国版の同期にはこの楽曲は含まれません。') : L('打一次再同步，成绩会出现在这里。', '一度プレイして同期すると、ここに表示されます。')">
              <button class="btn btn-primary" @click="goalSheet = true">{{ L('设为这次想练', '今回の練習に設定') }}</button>
            </EmptyLane>
          </template>
          <template v-else>
            <EmptyLane compact :title="L('登录后查看自己的成绩', 'ログインして記録を見る')" :text="L('绑定鼓众广场 ID 并同步，每个难度的王冠和评价都会显示在这里。', 'アカウントを連携して同期すると、難易度ごとの王冠と評価が表示されます。')">
              <RouterLink :to="store.auth === 'guest' ? '/login' : '/bind'" class="btn btn-primary">{{ store.auth === 'guest' ? L('登录', 'ログイン') : L('去绑定', '連携する') }}</RouterLink>
            </EmptyLane>
          </template>

          <ul v-if="otherMine.length" class="others" :aria-label="L('其他难度', '他の難易度')">
            <li v-for="x in otherMine" :key="x.c.d">
              <button class="orow" @click="pick(x.c.d)">
                <Diff :d="x.c.d" :star="x.c.star" short />
                <Crown :v="x.sc.crown" size="sm" />
                <Rank :v="x.sc.rank" />
                <b class="num">{{ fmt(x.sc.score) }}</b>
              </button>
            </li>
          </ul>
        </section>
      </aside>
    </div>

    <!-- 手机底部操作条 -->
    <div ref="mbarEl" class="mbar only-mobile">
      <button class="btn btn-ink grow"><Icon name="playTri" :size="16" />{{ L('游玩练习', '練習プレイ') }}</button>
      <button class="btn btn-primary grow" @click="goalSheet = true"><Icon name="flag" :size="16" />{{ L('想练这首', '練習目標に') }}</button>
    </div>

    <Sheet :open="goalSheet" :title="L('这次想练什么', '今回は何を目指す？')" :width="440" @close="goalSheet = false">
      <div class="gsong"><Cover :song="song" /><span class="grow"><b class="title-1l" :title="songTitle(song)">{{ songTitle(song) }}</b></span><Diff :d="d" :star="chart.star" :constant="chart.constant" short /></div>
      <div class="gopts" role="radiogroup" :aria-label="L('目标', '目標')">
        <button v-for="g in goalOptions" :key="g" class="gopt" role="radio" :aria-checked="goalType === g" @click="goalType = g">
          <i class="note" :class="goalType === g ? '' : 'ghost'" />
          <span>{{ L(GOAL_TYPES[g].zh, GOAL_TYPES[g].ja) }}</span>
        </button>
      </div>
      <p class="t-small">{{ L('同一时间只保留一个目标，设定后会替换当前目标。', '目標は同時に 1 つだけ。設定すると現在の目標と入れ替わります。') }}</p>
      <template #foot>
        <button class="btn" @click="goalSheet = false">{{ L('取消', 'キャンセル') }}</button>
        <button class="btn btn-primary" @click="setGoal">{{ L('就练这个', 'これにする') }}</button>
      </template>
    </Sheet>

    <Sheet :open="ugc.tagSheet" :title="L('这张谱有哪些特点', 'この譜面の特徴')" :width="480" @close="ugc.tagSheet = false">
      <p class="t-small tagcount">{{ L('最多选 5 个。', '5 個まで選べます。') }} <b class="num">{{ ugc.myTags.size }}</b> / 5</p>
      <div class="row-wrap">
        <button v-for="t in UGC_TAGS" :key="t" class="chip" :aria-pressed="ugc.myTags.has(t)" @click="toggleTag(t)">{{ t }}</button>
      </div>
      <template #foot><button class="btn btn-ink" @click="ugc.tagSheet = false">{{ L('完成', '完了') }}</button></template>
    </Sheet>
  </div>
</template>

<style scoped>
/* ---------- 头部（V2：压缩，封面 112 / 72） ---------- */
.head {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}
.hcover {
  width: 112px;
  font-size: 52px;
  border-radius: var(--r-panel);
}
.hbody {
  min-width: 0;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.genre {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  margin-right: 4px;
}
/* C6：详情页是看完整曲名的地方 —— 主标题不截断，按字自然换行；副标题最多两行（title 带全文） */
.title {
  margin-top: 6px;
  font-size: clamp(1.5rem, 2.4vw, 2.25rem);
  font-weight: 900;
  line-height: 1.18;
  overflow-wrap: anywhere;
  line-break: strict;
  text-wrap: balance;
}
.sub {
  margin-top: 2px;
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.facts {
  display: flex;
  flex-wrap: nowrap;
  align-items: baseline;
  gap: 20px;
  margin-top: 10px;
  min-width: 0;
}
.facts > div {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex: none;
  min-width: 0;
}
.facts > .f-artist {
  flex: 0 1 auto;
}
.facts dt {
  font-size: var(--fs-12);
  color: var(--ink-3);
  white-space: nowrap;
}
.facts dd {
  font-size: var(--fs-14);
  font-weight: 500;
  white-space: nowrap;
}
.aliases {
  margin-top: 4px;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.head-acts {
  display: flex;
  gap: 8px;
  flex: none;
}

/* ---------- 难度切换条（样式来自 domain.css 的 .diff-tab） ---------- */
.diffbar {
  position: sticky;
  top: var(--bar-h);
  z-index: 5;
  display: flex;
  gap: 8px;
  margin: 18px calc(var(--gutter) * -1) 0;
  padding: 8px var(--gutter);
  background: color-mix(in srgb, var(--bg) 92%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line);
  overflow-x: auto;
  scrollbar-width: none;
}
.diffbar::-webkit-scrollbar {
  display: none;
}

.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 40px;
  align-items: start;
  margin-top: 20px;
}
.block + .block {
  margin-top: 44px;
}
.sidecol {
  position: sticky;
  top: calc(var(--bar-h) + 76px);
}
.only-mobile-flex {
  display: none;
}

/* 谱面 */
.audio {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 12px;
}
.playbtn {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--ink);
  color: var(--bg);
  flex: none;
  transition: transform var(--dur-2) var(--ease-hit);
}
.playbtn:active {
  transform: scale(0.9);
}
.noaudio {
  flex: none;
}
.axis {
  margin-top: 4px;
}
.locate {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  color: var(--ka-ink);
  font-weight: 500;
}
.sheet-foot {
  margin-top: 10px;
  flex-wrap: wrap;
}
.nosheet {
  overflow: hidden;
}

/* 数据 */
.more-off {
  color: var(--ink-3);
  cursor: not-allowed;
}
.data {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 24px;
  align-items: center;
}
.consts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 28px 20px;
}
.stat.main .v {
  font-size: var(--fs-48);
  color: var(--don-ink);
}
.stat .v small {
  font-size: var(--fs-14);
  font-weight: 500;
  margin-left: 2px;
  font-family: var(--font-ui);
}
.noconst {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
  font-size: var(--fs-14);
  color: var(--ink-2);
}

/* 体感 */
.fh {
  margin-bottom: 10px;
  font-size: var(--fs-13);
  font-weight: 500;
  color: var(--ink-2);
}
.tips-h {
  margin-top: 24px;
}
.ugc {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
}
.votes {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  margin-bottom: 10px;
}
.vote {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 0;
  padding: 8px 2px;
  border-radius: var(--r-ctl);
  font-size: var(--fs-11);
  color: var(--ink-2);
  border: 1px solid transparent;
}
.vote > span:last-child {
  max-width: 100%;
  overflow-wrap: anywhere;
  text-align: center;
}
.vote:hover {
  background: var(--bg-sunk);
}
.vote[aria-pressed='true'] {
  border-color: var(--don);
  background: var(--don-wash);
  color: var(--don-ink);
}
.vbar {
  display: flex;
  align-items: flex-end;
  width: 100%;
  height: 56px;
  padding: 0 22%;
}
.vbar i {
  width: 100%;
  min-height: 3px;
  border-radius: 3px 3px 0 0;
  background: var(--ink-3);
}
.vote[aria-pressed='true'] .vbar i {
  background: var(--don);
}
.vote b {
  font-size: var(--fs-16);
  color: var(--ink);
}
.tagbars li {
  display: grid;
  grid-template-columns: 88px 1fr 32px;
  align-items: center;
  gap: 10px;
  height: 30px;
  font-size: var(--fs-13);
}
.tb {
  height: 8px;
  border-radius: var(--r-xs);
  background: var(--bg-sunk);
  overflow: hidden;
}
.tb i {
  display: block;
  height: 100%;
  border-radius: var(--r-xs);
  background: var(--ka);
}
.tagbars b {
  text-align: right;
  font-size: var(--fs-14);
}
.tips li {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--line);
}
.tips p {
  font-size: var(--fs-14);
}
.verified {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--ok);
  font-weight: 500;
}
.help {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  align-self: center;
  height: var(--ctl-h-sm);
  padding: 0 10px;
  border-radius: var(--r-note);
  border: 1px solid var(--ctl-border);
  color: var(--ink-2);
  flex: none;
}
.help[aria-pressed='true'] {
  border-color: var(--ka);
  background: var(--ka-wash);
  color: var(--ka-ink);
}
.tipform {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.tipform .input {
  flex: 1;
  min-width: 0;
}
.ruled {
  border-top: 1px solid var(--line-strong);
}

/* 我的成绩（桌面）：紧凑，1440×900 首屏完整可见 */
.myscore {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px 18px;
}
.ms-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.ms-score {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.bigscore {
  font-size: 40px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.01em;
}
.acc {
  font-size: var(--fs-16);
  color: var(--ink-2);
}
.mgrid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px 12px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}
.mgrid > div {
  display: flex;
  flex-direction: column-reverse;
  min-width: 0;
}
.mgrid dt {
  font-size: var(--fs-11);
  color: var(--ink-3);
  white-space: nowrap;
}
.mgrid dd {
  font-size: var(--fs-16);
  line-height: 1.35;
  white-space: nowrap;
}
.mgrid dd small {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.mgrid dd:not(.num) {
  font-size: var(--fs-14);
  font-weight: 500;
}
.trend dd {
  display: flex;
  align-items: center;
  height: 22px;
}
.others {
  border-top: 1px solid var(--line);
  padding-top: 6px;
}
.orow {
  display: flex;
  align-items: center;
  gap: 8px;
  width: calc(100% + 12px);
  height: 34px;
  padding: 0 6px;
  margin: 0 -6px;
  border-radius: var(--r-ctl);
  text-align: left;
  font-size: var(--fs-14);
}
.orow:hover {
  background: var(--bg-sunk);
}
.orow b {
  margin-left: auto;
}

/* 目标弹层 */
.gsong {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
}
.gsong .grow {
  min-width: 0;
}
.gopts {
  display: flex;
  flex-direction: column;
  margin: 8px 0 12px;
}
.gopt {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 48px;
  padding: 0 8px;
  border-radius: var(--r-ctl);
  font-size: var(--fs-16);
  text-align: left;
}
.gopt:hover {
  background: var(--bg-sunk);
}
.gopt[aria-checked='true'] {
  font-weight: 700;
}
.gopt .note {
  --n: 18px;
}
.tagcount {
  margin-bottom: 12px;
}

@media (max-width: 1239px) {
  .cols {
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 28px;
  }
  .data {
    grid-template-columns: minmax(0, 1fr);
  }
  .radarbox {
    justify-self: center;
  }
  .facts > .f-id {
    display: none;
  }
}
@media (max-width: 1099px) {
  .head-acts {
    flex-direction: column;
  }
  /* 平板主栏只有约 350px：体感投票与常见标签上下排，投票文字不再逐字换行（C14） */
  .ugc {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
  }
}
@media (max-width: 767px) {
  .head {
    gap: 14px;
  }
  .hcover {
    width: 72px;
    font-size: 32px;
    border-radius: calc(var(--r-ctl) + 2px);
  }
  .title {
    margin-top: 4px;
    font-size: var(--fs-22);
  }
  .sub {
    font-size: var(--fs-13);
  }
  .facts {
    gap: 14px;
    margin-top: 6px;
  }
  .facts > .f-open,
  .facts > .f-id {
    display: none;
  }
  .diffbar {
    top: var(--bar-h-m);
    margin-top: 14px;
    /* C5：这一行可横滑，右缘渐隐（留出 28px，不横滑时不压到最后一个难度） */
    padding-right: 28px;
    /* 两端渐隐：滚到当前难度后左端也不出现被硬切的半个标签（左侧留白 = 页边距 16px） */
    -webkit-mask-image: linear-gradient(to right, transparent 0, black 16px, black calc(100% - 24px), transparent 100%);
    mask-image: linear-gradient(to right, transparent 0, black 16px, black calc(100% - 24px), transparent 100%);
  }
  .cols {
    grid-template-columns: minmax(0, 1fr);
    margin-top: 16px;
  }
  .only-mobile-flex {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    margin-bottom: 28px;
  }
  .mine-top {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .mine-top > div {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .score {
    font-size: 36px;
    line-height: 1;
  }
  .note {
    color: var(--ink-2);
  }
  .block + .block {
    margin-top: 36px;
  }
  .consts {
    gap: 20px 12px;
  }
  .stat.main .v {
    font-size: var(--fs-36);
  }
  .ugc {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
  }
  .vote {
    min-height: var(--hit);
  }
  /* F1.4：贴底（此页没有底栏），两个等宽按钮高 44px，上下内边距 12px，内部再加安全区 */
  .mbar {
    position: fixed;
    z-index: var(--z-bar);
    left: 0;
    right: 0;
    bottom: calc(var(--shell-bottom) - env(safe-area-inset-bottom, 0px));
    display: flex !important;
    gap: 8px;
    padding: 12px var(--gutter) calc(12px + env(safe-area-inset-bottom, 0px));
    background: color-mix(in srgb, var(--surface) 94%, transparent);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-top: 1px solid var(--line);
  }
  .mbar .btn {
    flex: 1 1 0;
    min-width: 0;
    height: var(--hit);
    white-space: nowrap;
  }
}
</style>
