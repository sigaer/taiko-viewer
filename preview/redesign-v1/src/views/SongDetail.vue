<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
import { songById, DIFFS, GENRES, CHART_AXES, scoreOf, chartUgc, users, threads, GOAL_TYPES, UGC_TAGS, fmt } from '../mock/data'
import { L, isReady, isAuthed, songTitle, songSub, subLang, toast, store } from '../store'

// 歌曲详情。一个难度 = 一个视角：切换难度后，谱面、数据、我的成绩、玩家体感全部跟着换。
// 桌面：左主栏（谱面 / 数据 / 体感 / 讨论）+ 右侧吸顶的「我的成绩」。手机：我的成绩提到最前，底部固定操作条。
const route = useRoute()
const router = useRouter()
const song = computed(() => songById[route.params.id])
const d = ref(4)
watch(
  () => [route.params.id, route.query.d],
  () => {
    const want = Number(route.query.d)
    const s = song.value
    if (!s) return
    d.value = s.charts.some((c) => c.d === want) ? want : s.charts.some((c) => c.d === 4) ? 4 : s.charts.at(-1).d
  },
  { immediate: true },
)
function pick(v) {
  d.value = v
  router.replace({ query: { d: v } })
}
const chart = computed(() => song.value.charts.find((c) => c.d === d.value))
const mine = computed(() => (isReady.value ? scoreOf(song.value.id, d.value) : null))
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

// 玩家体感
const VOTE = [L('明显偏易', 'かなり易'), L('偏易', 'やや易'), L('合理', '妥当'), L('偏难', 'やや難'), L('明显偏难', 'かなり難')]
const ugc = reactive({ myVote: null, myTags: new Set(), tagSheet: false, helped: new Set() })
const voteTotal = chartUgc.votes.reduce((a, b) => a + b, 0)
function vote(i) {
  if (!isAuthed.value) return toast(L('登录后可以投票', 'ログインすると投票できます'), 'info')
  ugc.myVote = ugc.myVote === i ? null : i
}
function toggleTag(t) {
  if (ugc.myTags.has(t)) ugc.myTags.delete(t)
  else if (ugc.myTags.size < 5) ugc.myTags.add(t)
  else toast(L('最多选 5 个标签', 'タグは 5 個まで'), 'info')
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
      <Cover :song="song" size="xl" class="hcover" />
      <div class="grow">
        <div class="row-wrap meta">
          <span class="genre"><i class="dot" :style="{ color: GENRES[song.genre].color }" />{{ L(GENRES[song.genre].zh, GENRES[song.genre].ja) }}</span>
          <span v-if="song.shelf === 0" class="tag tag-ok">{{ L('国行实装', '中国版稼働中') }}</span>
          <span v-else-if="song.shelf === 1" class="tag">{{ L('国行未上架', '中国版未収録') }}</span>
          <span v-else class="tag">{{ L('其他平台', '他機種') }}</span>
          <span class="tag">{{ song.version }}</span>
        </div>
        <h1 class="title">{{ songTitle(song) }}</h1>
        <p v-if="songSub(song)" class="sub" :lang="subLang">{{ songSub(song) }}</p>
        <dl class="facts">
          <div><dt>{{ L('艺术家', 'アーティスト') }}</dt><dd>{{ song.artist }}</dd></div>
          <div><dt>BPM</dt><dd class="num">{{ song.bpm }}</dd></div>
          <div><dt>{{ L('上架', '収録日') }}</dt><dd class="num">{{ song.openDay }}</dd></div>
          <div><dt>ID</dt><dd class="num">{{ song.id }}</dd></div>
        </dl>
      </div>
      <div class="head-acts only-desktop">
        <button class="btn btn-ink"><Icon name="playTri" :size="16" />{{ L('游玩练习', '練習プレイ') }}</button>
        <button class="btn" @click="toast(L('已收藏', 'お気に入りに追加'))"><Icon name="bookmark" :size="16" />{{ L('收藏', '保存') }}</button>
      </div>
    </header>

    <!-- ============ 难度切换 ============ -->
    <div class="diffbar" role="tablist" :aria-label="L('难度', '難易度')">
      <button v-for="c in song.charts" :key="c.d" role="tab" class="dtab" :class="DIFFS[c.d].key" :aria-selected="d === c.d" @click="pick(c.d)">
        <span class="dn">{{ L(DIFFS[c.d].zh, DIFFS[c.d].ja) }}</span>
        <span class="ds num">★{{ c.star }}</span>
        <span v-if="c.constant != null" class="dk num">{{ c.constant.toFixed(2) }}</span>
        <Crown v-if="isReady && scoreOf(song.id, c.d)" :v="scoreOf(song.id, c.d).crown" size="sm" />
      </button>
    </div>

    <div class="cols">
      <div class="maincol">
        <!-- 手机端把我的成绩放在最前面 -->
        <section class="panel mine only-mobile-flex">
          <template v-if="mine">
            <div class="mine-top">
              <Crown :v="mine.crown" size="lg" />
              <div>
                <b class="num score">{{ fmt(mine.score) }}</b>
                <span class="t-caption">{{ L('最好成绩', '自己ベスト') }} · {{ mine.acc.toFixed(2) }}%</span>
              </div>
              <Rank :v="mine.rank" lg />
            </div>
            <div class="judge">
              <i class="g" :style="{ flex: mine.good }" /><i class="o" :style="{ flex: mine.ok }" /><i class="n" :style="{ flex: mine.ng }" />
            </div>
            <div class="judge-legend">
              <span>{{ L('良', '良') }}<b>{{ mine.good }}</b></span><span>{{ L('可', '可') }}<b>{{ mine.ok }}</b></span><span>{{ L('不可', '不可') }}<b>{{ mine.ng }}</b></span>
            </div>
          </template>
          <p v-else class="t-small">{{ isReady ? L('这个难度还没有成绩。', 'この難易度はまだ記録がありません。') : L('登录并同步后，这里会显示你的成绩。', 'ログインして同期すると、ここに記録が表示されます。') }}</p>
        </section>

        <!-- 谱面 -->
        <section class="block">
          <div class="section-head">
            <h2 class="t-h2">{{ L('谱面', '譜面') }}</h2>
            <div class="row-wrap">
              <div v-if="chart.branch" class="seg" role="group">
                <button v-for="b in [['normal', L('普通', '普通')], ['expert', L('玄人', '玄人')], ['master', L('达人', '達人')]]" :key="b[0]" :aria-pressed="branch === b[0]" @click="branch = b[0]">{{ b[1] }}</button>
              </div>
              <div class="seg" role="group">
                <button :aria-pressed="side === 'single'" @click="side = 'single'">{{ L('单人', '1人') }}</button>
                <button :aria-pressed="side === 'p1'" @click="side = 'p1'">P1</button>
                <button :aria-pressed="side === 'p2'" @click="side = 'p2'">P2</button>
              </div>
            </div>
          </div>

          <div class="audio">
            <button class="playbtn" :aria-label="playing ? L('暂停', '一時停止') : L('试听', '試聴')" @click="playing = !playing">
              <Icon :name="playing ? 'rows' : 'playTri'" :size="18" />
            </button>
            <div class="grow">
              <DensityStrip :values="chart.density" :height="44" />
              <div class="spread t-caption axis"><span class="num">1</span><span>{{ L('每小节密度，朱色是难点', '小節ごとの密度（朱色が難所）') }}</span><span class="num">64</span></div>
            </div>
          </div>

          <ChartSheet :seed="song.id + d * 31 + (side === 'p2' ? 5 : 0) + (branch === 'normal' ? 9 : 0)" :density="chart.density" :rows="5" />
          <div class="spread sheet-foot">
            <span class="t-caption">{{ L('第 1–20 小节，共 64 小节', '1–20 小節 / 全 64 小節') }}</span>
            <div class="row-wrap">
              <button class="btn btn-sm">{{ L('展开完整谱面', '全体を表示') }}</button>
              <button class="btn btn-sm" @click="toast(L('已开始下载 PNG', 'PNG をダウンロードします'))"><Icon name="download" :size="14" />PNG</button>
            </div>
          </div>
        </section>

        <!-- 数据 -->
        <section class="block">
          <div class="section-head">
            <h2 class="t-h2">{{ L('谱面数据', '譜面データ') }}</h2>
            <RouterLink to="/tools/rt" class="more">{{ L('用 RT 计算器算一下', 'RT 計算機で試す') }}</RouterLink>
          </div>
          <div class="data">
            <div class="consts">
              <template v-if="chart.constant != null">
                <div class="stat main"><div class="v">{{ chart.constant.toFixed(2) }}</div><div class="k">{{ L('主定数（95%）', '主定数（95%）') }}</div></div>
                <div class="stat"><div class="v">{{ chart.c75.toFixed(2) }}</div><div class="k">{{ L('75% 定数', '75% 定数') }}</div></div>
                <div class="stat"><div class="v">{{ chart.c99.toFixed(2) }}</div><div class="k">{{ L('99% 定数', '99% 定数') }}</div></div>
              </template>
              <p v-else class="t-small nok">{{ L('这个难度暂时没有定数。', 'この難易度の定数はまだありません。') }}</p>
              <div class="stat"><div class="v">{{ fmt(chart.notes) }}</div><div class="k">{{ L('物量', 'ノーツ数') }}</div></div>
              <div class="stat"><div class="v">{{ chart.roll }}<small>{{ L('秒', '秒') }}</small></div><div class="k">{{ L('连打时间', '連打時間') }}</div></div>
              <div class="stat"><div class="v">{{ chart.balloon }}</div><div class="k">{{ L('气球', '風船') }}</div></div>
            </div>
            <div class="radarbox">
              <Radar :axes="axes" :domain="[0, 15.5]" :size="280" tone="var(--ka)" />
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
              <h3 class="fh">{{ L('相对 ★', '★') }}{{ chart.star }}{{ L(' 的难度', ' に対する体感難度') }}</h3>
              <div class="votes">
                <button v-for="(v, i) in chartUgc.votes" :key="i" class="vote" :aria-pressed="ugc.myVote === i" @click="vote(i)">
                  <span class="vbar"><i :style="{ height: (v / Math.max(...chartUgc.votes)) * 100 + '%' }" /></span>
                  <b class="num">{{ v + (ugc.myVote === i ? 1 : 0) }}</b>
                  <span>{{ VOTE[i] }}</span>
                </button>
              </div>
              <p class="t-small">{{ L('多数人觉得这张谱偏难。', '多くのプレイヤーがやや難しいと感じています。') }}</p>
            </div>
            <div>
              <div class="spread"><h3 class="fh">{{ L('常见标签', 'よく付くタグ') }}</h3><button class="link t-small" @click="ugc.tagSheet = true">{{ L('我来标', 'タグを付ける') }}</button></div>
              <ul class="tagbars">
                <li v-for="t in chartUgc.tags" :key="t.name">
                  <span class="tn">{{ t.name }}<i v-if="ugc.myTags.has(t.name)" class="dot" style="color: var(--don)" /></span>
                  <span class="tb"><i :style="{ width: (t.n / chartUgc.tags[0].n) * 100 + '%' }" /></span>
                  <b class="num">{{ t.n + (ugc.myTags.has(t.name) ? 1 : 0) }}</b>
                </li>
              </ul>
            </div>
          </div>
          <h3 class="fh" style="margin-top: 24px">{{ L('玩家提示', 'プレイヤーのヒント') }}</h3>
          <ul class="tips">
            <li v-for="(t, i) in chartUgc.tips" :key="i">
              <span class="avatar sm" :style="{ background: `hsl(${users[t.author].hue} 45% 42%)` }">{{ users[t.author].name[0] }}</span>
              <div class="grow">
                <p>{{ t.text }}</p>
                <span class="t-caption">{{ users[t.author].name }}<template v-if="t.verified"> · <span class="verified"><Icon name="check" :size="12" />{{ L('已游玩', 'プレイ済み') }}</span></template> · {{ t.ago }}</span>
              </div>
              <button class="help" :aria-pressed="ugc.helped.has(i)" @click="ugc.helped.has(i) ? ugc.helped.delete(i) : ugc.helped.add(i)">
                <Icon name="thumb" :size="14" /><b class="num">{{ t.helpful + (ugc.helped.has(i) ? 1 : 0) }}</b>
              </button>
            </li>
          </ul>
          <form class="tipform" @submit.prevent="toast(L('提示已提交，审核通过后显示', 'ヒントを送信しました'))">
            <input class="input" maxlength="120" :placeholder="L('写一条 120 字以内的提示', '120 文字以内でヒントを書く')" :disabled="!isAuthed" />
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
        <section class="panel myscore">
          <header class="spread">
            <h2 class="t-h3">{{ L('我的成绩', '自分の記録') }}</h2>
            <Diff :d="d" :star="chart.star" short />
          </header>
          <template v-if="mine">
            <div class="ms-top">
              <Crown :v="mine.crown" size="lg" label />
              <Rank :v="mine.rank" lg label />
            </div>
            <b class="num bigscore">{{ fmt(mine.score) }}</b>
            <div class="judge"><i class="g" :style="{ flex: mine.good }" /><i class="o" :style="{ flex: mine.ok }" /><i class="n" :style="{ flex: mine.ng }" /></div>
            <div class="judge-legend">
              <span>{{ L('良', '良') }}<b>{{ mine.good }}</b></span><span>{{ L('可', '可') }}<b>{{ mine.ok }}</b></span><span>{{ L('不可', '不可') }}<b>{{ mine.ng }}</b></span>
            </div>
            <dl class="kv">
              <dt>{{ L('准确率', '精度') }}</dt><dd class="num">{{ mine.acc.toFixed(2) }}%</dd>
              <dt>{{ L('最大连击', '最大コンボ') }}</dt><dd class="num">{{ mine.combo }} / {{ chart.notes }}</dd>
              <dt>{{ L('连打', '連打') }}</dt><dd class="num">{{ mine.roll }}</dd>
              <dt>{{ L('单曲 RT', '単曲 RT') }}</dt><dd class="num">{{ mine.rt.toFixed(2) }}</dd>
              <dt>{{ L('游玩次数', 'プレイ回数') }}</dt><dd class="num">{{ mine.plays }}</dd>
              <dt>{{ L('最好成绩于', '達成日') }}</dt><dd>{{ mine.daysAgo === 0 ? L('今天', '今日') : L(`${mine.daysAgo} 天前`, `${mine.daysAgo} 日前`) }}</dd>
            </dl>
            <div class="trend">
              <span class="t-caption">{{ L('最好成绩的变化', '自己ベストの推移') }}</span>
              <Spark :values="history" :w="140" :h="32" tone="var(--don)" />
            </div>
            <button class="btn btn-primary btn-block" @click="goalSheet = true"><Icon name="flag" :size="16" />{{ L('设为这次想练', '今回の練習に設定') }}</button>
          </template>
          <template v-else-if="isReady">
            <EmptyLane compact :title="L('还没打过这个难度', 'まだプレイしていません')" :text="L('打一次再同步，成绩会出现在这里。', '一度プレイして同期すると、ここに表示されます。')">
              <button class="btn btn-primary" @click="goalSheet = true">{{ L('设为这次想练', '今回の練習に設定') }}</button>
            </EmptyLane>
          </template>
          <template v-else>
            <EmptyLane compact :title="L('登录后查看自己的成绩', 'ログインして記録を見る')" :text="L('绑定鼓众广场 ID 并同步，每个难度的王冠和评价都会显示在这里。', 'アカウントを連携して同期すると、難易度ごとの王冠と評価が表示されます。')">
              <RouterLink :to="store.auth === 'guest' ? '/login' : '/bind'" class="btn btn-primary">{{ store.auth === 'guest' ? L('登录', 'ログイン') : L('去绑定', '連携する') }}</RouterLink>
            </EmptyLane>
          </template>
        </section>
      </aside>
    </div>

    <!-- 手机底部操作条 -->
    <div class="mbar only-mobile">
      <button class="btn btn-ink grow"><Icon name="playTri" :size="16" />{{ L('游玩练习', '練習プレイ') }}</button>
      <button class="btn btn-primary grow" @click="goalSheet = true"><Icon name="flag" :size="16" />{{ L('想练这首', '練習目標に') }}</button>
    </div>

    <Sheet :open="goalSheet" :title="L('这次想练什么', '今回は何を目指す？')" :width="440" @close="goalSheet = false">
      <div class="gsong"><Cover :song="song" /><span class="grow"><b class="truncate">{{ songTitle(song) }}</b></span><Diff :d="d" :star="chart.star" :constant="chart.constant" short /></div>
      <div class="gopts" role="radiogroup">
        <button v-for="g in goalOptions" :key="g" class="gopt" role="radio" :aria-checked="goalType === g" @click="goalType = g">
          <i class="note" :class="goalType === g ? '' : 'ghost'" />
          <span>{{ L(GOAL_TYPES[g].zh, GOAL_TYPES[g].ja) }}</span>
        </button>
      </div>
      <p class="t-small">{{ L('同一时间只保留一个目标。设定后，原来的「天狗囃子 全连」会被替换。', '目標は同時に 1 つだけ。設定すると現在の目標と入れ替わります。') }}</p>
      <template #foot>
        <button class="btn" @click="goalSheet = false">{{ L('取消', 'キャンセル') }}</button>
        <button class="btn btn-primary" @click="setGoal">{{ L('就练这个', 'これにする') }}</button>
      </template>
    </Sheet>

    <Sheet :open="ugc.tagSheet" :title="L('这张谱有哪些特点', 'この譜面の特徴')" :width="480" @close="ugc.tagSheet = false">
      <p class="t-small" style="margin-bottom: 12px">{{ L('最多选 5 个。', '5 個まで選べます。') }} <b class="num">{{ ugc.myTags.size }}</b> / 5</p>
      <div class="row-wrap">
        <button v-for="t in UGC_TAGS" :key="t" class="chip" :aria-pressed="ugc.myTags.has(t)" @click="toggleTag(t)">{{ t }}</button>
      </div>
      <template #foot><button class="btn btn-ink" @click="ugc.tagSheet = false">{{ L('完成', '完了') }}</button></template>
    </Sheet>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  gap: 28px;
  align-items: flex-end;
}
.meta {
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
.title {
  margin-top: 10px;
  font-size: clamp(1.75rem, 3vw, 2.75rem);
  font-weight: 900;
  line-height: 1.15;
  text-wrap: balance;
}
.sub {
  margin-top: 4px;
  font-size: var(--fs-16);
  color: var(--ink-2);
}
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 32px;
  margin-top: 16px;
}
.facts div {
  display: flex;
  flex-direction: column;
}
.facts dt {
  font-size: var(--fs-11);
  color: var(--ink-3);
}
.facts dd {
  font-size: var(--fs-14);
  font-weight: 500;
}
.facts dd.num {
  font-size: var(--fs-16);
}
.head-acts {
  display: flex;
  gap: 8px;
  flex: none;
}

/* 难度切换：一排大按钮，选中的那个被难度色填满 */
.diffbar {
  position: sticky;
  top: var(--bar-h);
  z-index: 5;
  display: flex;
  gap: 8px;
  margin: 28px calc(var(--gutter) * -1) 0;
  padding: 10px var(--gutter);
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
.dtab {
  --c: var(--diff-oni);
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 14px;
  border-radius: var(--r-ctl);
  border: 1.5px solid color-mix(in srgb, var(--c) 45%, var(--line));
  background: var(--surface);
  white-space: nowrap;
  transition: background var(--dur-1), color var(--dur-1);
}
.dtab.easy {
  --c: var(--diff-easy);
}
.dtab.normal {
  --c: var(--diff-normal);
}
.dtab.hard {
  --c: var(--diff-hard);
}
.dtab.ura {
  --c: var(--diff-ura);
}
.dn {
  font-size: var(--fs-13);
  font-weight: 700;
  color: var(--c);
}
.ds {
  font-size: var(--fs-18);
  font-weight: 700;
}
.dk {
  font-size: var(--fs-16);
  color: var(--ink-2);
}
.dtab:hover {
  background: color-mix(in srgb, var(--c) 8%, var(--surface));
}
.dtab[aria-selected='true'] {
  background: var(--c);
  border-color: var(--c);
  color: #fff;
}
:root[data-theme='dark'] .dtab[aria-selected='true'] {
  color: var(--ai-950);
}
.dtab[aria-selected='true'] .dn,
.dtab[aria-selected='true'] .dk {
  color: inherit;
}
.dtab[aria-selected='true'] .dk {
  opacity: 0.85;
}

.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 40px;
  align-items: start;
  margin-top: 28px;
}
.block + .block {
  margin-top: 44px;
}
.sidecol {
  position: sticky;
  top: calc(var(--bar-h) + 80px);
}
.only-mobile-flex {
  display: none;
}

/* 谱面 */
.audio {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 14px;
}
.playbtn {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--ink);
  color: var(--bg);
  flex: none;
  transition: transform var(--dur-2) var(--ease-hit);
}
.playbtn:active {
  transform: scale(0.9);
}
.axis {
  margin-top: 4px;
}
.sheet-foot {
  margin-top: 10px;
  flex-wrap: wrap;
}

/* 数据 */
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
.nok {
  grid-column: 1 / -1;
}

/* 体感 */
.fh {
  margin-bottom: 10px;
  font-size: var(--fs-13);
  font-weight: 500;
  color: var(--ink-2);
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
  padding: 8px 2px;
  border-radius: var(--r-ctl);
  font-size: var(--fs-11);
  color: var(--ink-2);
  border: 1px solid transparent;
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
  grid-template-columns: 72px 1fr 32px;
  align-items: center;
  gap: 10px;
  height: 30px;
  font-size: var(--fs-13);
}
.tn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
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
  height: 32px;
  padding: 0 10px;
  border-radius: var(--r-note);
  border: 1px solid var(--line-strong);
  color: var(--ink-2);
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
.ruled {
  border-top: 1px solid var(--line-strong);
}

/* 我的成绩 */
.myscore {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 20px 20px;
}
.ms-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.bigscore {
  font-size: 52px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.01em;
}
.trend {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

/* 目标弹层 */
.gsong {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
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
}
@media (max-width: 767px) {
  .head {
    gap: 14px;
    align-items: flex-start;
  }
  .hcover {
    width: 96px !important;
    font-size: 44px !important;
    border-radius: 12px !important;
  }
  .title {
    margin-top: 6px;
    font-size: var(--fs-22);
  }
  .sub {
    font-size: var(--fs-13);
  }
  .facts {
    gap: 6px 18px;
    margin-top: 10px;
  }
  .facts div:nth-child(n + 3) {
    display: none;
  }
  .diffbar {
    top: 52px;
    margin-top: 16px;
  }
  .dtab {
    height: 46px;
    padding: 0 12px;
    gap: 6px;
  }
  .dtab:not([aria-selected='true']) .dn {
    display: none;
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
  .mbar {
    position: fixed;
    z-index: var(--z-bar);
    left: 0;
    right: 0;
    bottom: calc(var(--tab-h) + env(safe-area-inset-bottom));
    display: flex !important;
    gap: 8px;
    padding: 8px var(--gutter);
    background: color-mix(in srgb, var(--surface) 94%, transparent);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-top: 1px solid var(--line);
  }
  .sd {
    padding-bottom: 140px;
  }
}
</style>
