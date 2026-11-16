<script setup>
import { computed, ref } from 'vue'
import Icon from '../components/Icon.vue'
import Lane from '../components/Lane.vue'
import DrumDial from '../components/DrumDial.vue'
import Radar from '../components/Radar.vue'
import FactRow from '../components/FactRow.vue'
import GoalCard from '../components/GoalCard.vue'
import ThreadRow from '../components/ThreadRow.vue'
import SongCell from '../components/SongCell.vue'
import Diff from '../components/Diff.vue'
import Cover from '../components/Cover.vue'
import { player, DIMS, laneDays, goals, recommendations, threads, songs, songById, chartOf, events, GOAL_TYPES, GENRES } from '../mock/data'
import { store, L, isReady, songTitle } from '../store'

const sel = ref(0)
const day = computed(() => laneDays.find((d) => d.daysAgo === sel.value))
const axes = computed(() => DIMS.map((d) => ({ key: d.key, label: L(d.zh, d.ja), value: player.dims[d.key], prev: player.dimsPrev[d.key] })))
const focus = computed(() => DIMS.find((d) => d.key === player.focus))
const activeGoal = goals.find((g) => g.status === 'active')
const latest = [...songs].sort((a, b) => b.openDay.localeCompare(a.openDay)).slice(0, 6)
const hot = threads.slice(0, 4)
const streak = computed(() => {
  let n = 0
  for (let i = laneDays.length - 1; i >= 0 && laneDays[i].played; i--) n++
  return n
})
const hour = 20
const greet = computed(() => (hour < 11 ? L('早上好', 'おはようございます') : hour < 18 ? L('下午好', 'こんにちは') : L('晚上好', 'こんばんは')))
function dayLabel(d) {
  if (d.daysAgo === 0) return L('今天', '今日')
  if (d.daysAgo === 1) return L('昨天', '昨日')
  return L(`${d.date.getMonth() + 1} 月 ${d.date.getDate()} 日`, `${d.date.getMonth() + 1}月${d.date.getDate()}日`)
}

const TOOLS = [
  { to: '/tools', icon: 'layers', zh: '查配置', ja: '配置検索', hint: '16 oxxo 180 鬼10' },
  { to: '/tools', icon: 'music', zh: '查物量', ja: 'ノーツ数検索', hint: '765' },
  { to: '/tools/rt', icon: 'target', zh: '单曲 RT 计算', ja: '単曲 RT 計算', hint: '良 / 可 / 不可' },
  { to: '/dan', icon: 'trophy', zh: '段位道场', ja: '段位道場', hint: '虹 2026' },
]
const STEPS = computed(() => [
  { zh: '登录 Viewer 账号', ja: 'ログイン', done: true },
  { zh: '绑定鼓众广场 ID', ja: 'アカウント連携', done: store.auth === 'empty', to: '/bind', cta: L('去绑定', '連携する') },
  { zh: '同步第一份成绩', ja: '最初の同期', done: false, to: '/account/sync', cta: L('开始同步', '同期する') },
])
const nextStep = computed(() => STEPS.value.find((s) => !s.done))
</script>

<template>
  <div class="page today">
    <!-- ================= 已同步：个人驾驶舱 ================= -->
    <template v-if="isReady">
      <header class="hello">
        <div>
          <h1 class="t-h1">{{ greet }}{{ L('，', '、') }}{{ player.nickname }}</h1>
          <p class="t-small row" style="gap: 8px; margin-top: 6px">
            <span class="tag tag-roll">{{ player.title }}</span>
            <span>{{ player.dan }}</span>
            <span class="faint">CN {{ player.taikoIdMasked }}</span>
          </p>
        </div>
        <RouterLink to="/annual" class="annual">
          <i class="note big roll" />
          <span><b>{{ L('虹 2026 太鼓回顾', '虹 2026 ふりかえり') }}</b><small>{{ L('12 月 1 日开放', '12月1日公開') }}</small></span>
          <Icon name="chevR" :size="16" />
        </RouterLink>
      </header>

      <div class="deck">
        <!-- Rating + 六维 -->
        <section class="panel me">
          <div class="me-rating">
            <DrumDial :value="player.rating" :size="176">
              <span class="t-caption">Rating</span>
              <b class="num big">{{ player.rating.toFixed(2) }}</b>
              <span class="t-caption">/ 15.5</span>
            </DrumDial>
            <dl class="me-kv">
              <div><dt>{{ L('近 30 天', '直近 30 日') }}</dt><dd class="num up">+{{ player.ratingDelta30.toFixed(2) }}</dd></div>
              <div><dt>{{ L('全站位置', '全体順位') }}</dt><dd>{{ player.percentile }}</dd></div>
              <div><dt>{{ L('连续游玩', '連続プレイ') }}</dt><dd><span class="num">{{ streak }}</span> {{ L('天', '日') }}</dd></div>
            </dl>
          </div>
          <div class="me-radar">
            <Radar :axes="axes" :focus="player.focus" :size="300" />
            <p class="t-small focus">
              <i class="dot" style="color: var(--ka)" />
              {{ L('现在更值得留意的方向：', 'いま注目したい方向：') }}<b>{{ L(focus.zh, focus.ja) }}</b>
              <RouterLink to="/growth" class="link">{{ L('成长档案', '成長記録') }}</RouterLink>
            </p>
          </div>
        </section>

        <GoalCard :goal="activeGoal" />
      </div>

      <!-- 譜面レーン -->
      <section class="section">
        <div class="section-head">
          <h2 class="t-h2">{{ L('最近 21 天', '直近 21 日') }}</h2>
          <div class="legend only-desktop">
            <span><i class="note" />{{ L('刷新成绩', '自己ベスト') }}</span>
            <span><i class="note ka" />{{ L('更稳了', '安定度アップ') }}</span>
            <span><i class="note big" style="--n: 16px" />{{ L('新王冠', '新しい王冠') }}</span>
            <span><i class="rollbar" />{{ L('连续游玩', '連続プレイ') }}</span>
          </div>
        </div>
        <Lane v-model="sel" :days="laneDays" />
        <div class="dayfacts">
          <div class="day-head">
            <h3 class="t-h3">{{ dayLabel(day) }}</h3>
            <span v-if="day.played" class="t-small">{{ L(`碰了 ${day.charts} 张谱，${day.facts.length} 条进展`, `${day.charts} 譜面をプレイ、記録 ${day.facts.length} 件`) }}</span>
          </div>
          <div v-if="day.facts.length" class="facts">
            <FactRow v-for="(f, i) in day.facts" :key="i" :fact="f" />
          </div>
          <p v-else-if="day.played" class="t-small rest">{{ L('这天打了几首，没有新的记录。稳住也是练习的一部分。', 'この日は記録更新なし。安定して叩くのも練習のうちです。') }}</p>
          <p v-else class="t-small rest">{{ L('这天没有游玩记录。', 'この日はプレイ記録がありません。') }}</p>
        </div>
      </section>

      <div class="tri section">
        <section>
          <div class="section-head">
            <h2 class="t-h2">{{ L('接下来可以练', '次に練習するなら') }}</h2>
            <RouterLink to="/play/recommend" class="more">{{ L('全部推荐', 'すべて見る') }}</RouterLink>
          </div>
          <ul class="list">
            <li v-for="r in recommendations.slice(0, 4)" :key="r.songId">
              <RouterLink :to="`/songs/${r.songId}?d=${r.d}`" class="rec">
                <SongCell :song="songById[r.songId]" :sub="r.reason" class="grow" />
                <Diff :d="r.d" :star="chartOf(r.songId, r.d).star" :constant="chartOf(r.songId, r.d).constant" short />
              </RouterLink>
            </li>
          </ul>
        </section>
        <section>
          <div class="section-head">
            <h2 class="t-h2">{{ L('社区正在聊', 'コミュニティの話題') }}</h2>
            <RouterLink to="/community" class="more">{{ L('去社区', '広場へ') }}</RouterLink>
          </div>
          <div class="list">
            <ThreadRow v-for="t in hot" :key="t.id" :thread="t" compact />
          </div>
        </section>
        <section>
          <div class="section-head"><h2 class="t-h2">{{ L('活动与新曲', 'イベント・新曲') }}</h2></div>
          <ul class="list ev">
            <li v-for="e in events" :key="e.title">
              <b>{{ e.title }}</b>
              <span class="t-caption">{{ e.range }}</span>
              <span class="tag" :class="e.tag === '报名中' ? 'tag-don' : e.tag === '已上线' ? 'tag-ok' : ''">{{ e.tag }}</span>
            </li>
          </ul>
          <div class="covers">
            <RouterLink v-for="s in latest" :key="s.id" :to="`/songs/${s.id}`" :title="songTitle(s)"><Cover :song="s" size="fill" /></RouterLink>
          </div>
        </section>
      </div>
    </template>

    <!-- ================= 游客 / 未绑定 / 无成绩 ================= -->
    <template v-else>
      <section class="hero">
        <div class="hero-copy">
          <template v-if="store.auth === 'guest'">
            <h1 class="t-display">{{ L('查谱、记分、看见进步，都在这里。', '譜面も、スコアも、成長も、ここひとつで。') }}</h1>
            <p class="lead">{{ L('1,400 多首曲目的定数与谱面图；绑定鼓众广场 ID 后，每次同步都会变成一条自己的练习谱面。', '1,400 曲以上の定数と譜面画像。アカウントを連携すると、同期のたびに自分だけの練習譜面が伸びていきます。') }}</p>
          </template>
          <template v-else>
            <h1 class="t-display">{{ store.auth === 'unbound' ? L('还差两步，就能看到自己的谱面。', 'あと 2 ステップで、自分の譜面が見られます。') : L('还差一步：同步第一份成绩。', 'あと 1 ステップ：最初の同期。') }}</h1>
            <ol class="steps">
              <li v-for="(s, i) in STEPS" :key="i" :class="{ done: s.done, now: s === nextStep }">
                <i class="note" :class="s.done ? 'ka' : s === nextStep ? '' : 'ghost'" />
                <span>{{ L(s.zh, s.ja) }}</span>
                <Icon v-if="s.done" name="check" :size="16" />
              </li>
            </ol>
          </template>

          <button class="hero-search" @click="store.paletteOpen = true">
            <Icon name="search" />
            <span class="grow">{{ L('搜一首歌，比如「千本桜」', '曲名で検索（例：千本桜）') }}</span>
            <kbd class="only-desktop">Ctrl K</kbd>
          </button>
          <div class="row-wrap">
            <RouterLink v-if="store.auth === 'guest'" to="/login" class="btn btn-primary btn-lg">{{ L('登录或注册', 'ログイン・新規登録') }}</RouterLink>
            <RouterLink v-else :to="nextStep.to" class="btn btn-primary btn-lg">{{ nextStep.cta }}</RouterLink>
            <RouterLink to="/songs" class="btn btn-lg">{{ L('浏览曲库', '楽曲一覧を見る') }}</RouterLink>
          </div>
        </div>

        <!-- 示例谱面：让还没登录的人看到「登录之后会得到什么」 -->
        <figure class="hero-demo">
          <figcaption class="t-caption">{{ L('示例：一位玩家最近 21 天的练习', 'サンプル：あるプレイヤーの直近 21 日') }}</figcaption>
          <Lane v-model="sel" :days="laneDays" compact />
          <div class="demo-facts">
            <FactRow v-for="(f, i) in day.facts.slice(0, 3)" :key="i" :fact="f" dense />
            <p v-if="!day.facts.length" class="t-small rest">{{ L('这天没有新的记录。点一个有音符的日子看看。', 'この日は記録なし。音符のある日をタップしてみてください。') }}</p>
          </div>
        </figure>
      </section>

      <section class="section">
        <div class="section-head"><h2 class="t-h2">{{ L('不用登录就能用', 'ログイン不要のツール') }}</h2></div>
        <div class="tools">
          <RouterLink v-for="t in TOOLS" :key="t.zh" :to="t.to" class="tool">
            <Icon :name="t.icon" :size="22" />
            <b>{{ L(t.zh, t.ja) }}</b>
            <span class="num faint">{{ t.hint }}</span>
          </RouterLink>
        </div>
      </section>

      <div class="duo section">
        <section>
          <div class="section-head">
            <h2 class="t-h2">{{ L('最新曲目', '新着楽曲') }}</h2>
            <RouterLink to="/songs" class="more">{{ L('曲库', '楽曲一覧') }}</RouterLink>
          </div>
          <ul class="list">
            <li v-for="s in latest.slice(0, 5)" :key="s.id">
              <RouterLink :to="`/songs/${s.id}`" class="rec">
                <SongCell :song="s" :sub="`${L(GENRES[s.genre].zh, GENRES[s.genre].ja)} · ${s.openDay}`" class="grow" />
                <Diff :d="4" :star="s.levels[3]" :constant="chartOf(s.id, 4).constant" short />
              </RouterLink>
            </li>
          </ul>
        </section>
        <section>
          <div class="section-head">
            <h2 class="t-h2">{{ L('社区精选', 'コミュニティの注目') }}</h2>
            <RouterLink to="/community" class="more">{{ L('去社区', '広場へ') }}</RouterLink>
          </div>
          <div class="list"><ThreadRow v-for="t in hot" :key="t.id" :thread="t" compact /></div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.hello {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: var(--sp-6);
}
.annual {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px 8px 10px;
  border-radius: var(--r-note);
  background: var(--roll-wash);
  color: var(--roll-ink);
}
.annual span {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}
.annual b {
  font-size: var(--fs-13);
}
.annual small {
  font-size: var(--fs-11);
  opacity: 0.8;
}
.deck {
  display: grid;
  grid-template-columns: minmax(0, 1.75fr) minmax(320px, 1fr);
  gap: 20px;
}
.me {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 8px 28px;
  padding: 20px 28px;
}
.me-rating {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}
.me-rating .big {
  font-size: 52px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.01em;
}
.me-kv {
  display: flex;
  gap: 18px;
}
.me-kv div {
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
}
.me-kv dt {
  font-size: var(--fs-11);
  color: var(--ink-3);
}
.me-kv dd {
  font-size: var(--fs-14);
  font-weight: 700;
}
.me-kv .num {
  font-size: var(--fs-18);
}
.me-radar {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}
.focus {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}
.focus b {
  color: var(--ink);
  margin-right: 6px;
}
.legend {
  display: flex;
  gap: 16px;
  font-size: var(--fs-12);
  color: var(--ink-2);
}
.legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.legend .note {
  --n: 12px;
}
.rollbar {
  width: 22px;
  height: 8px;
  border-radius: var(--r-xs);
  background: var(--roll);
}
.dayfacts {
  margin-top: 16px;
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 8px 28px;
  align-items: start;
}
.day-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 10px;
}
.day-head .t-h3 {
  font-size: var(--fs-18);
  font-weight: 900;
}
.facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 40px;
}
.facts > :nth-last-child(2):nth-child(odd) {
  border-bottom: 0;
}
.rest {
  padding: 14px 0;
}
.tri {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 40px;
}
.duo {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 48px;
}
.list {
  border-top: 1px solid var(--line-strong);
}
.rec {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 0;
  border-bottom: 1px solid var(--line);
}
.rec:hover :deep(.t) {
  color: var(--ka-ink);
}
.ev li {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2px 12px;
  padding: 11px 0;
  border-bottom: 1px solid var(--line);
  align-items: center;
}
.ev b {
  font-size: var(--fs-14);
}
.ev .tag {
  grid-row: 1 / 3;
  grid-column: 2;
}
.covers {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  margin-top: 14px;
}
.covers a {
  transition: transform var(--dur-2) var(--ease-out);
}
.covers a:hover {
  transform: translateY(-3px);
}

/* ---------- 游客首屏 ---------- */
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 56px;
  align-items: center;
  padding: 28px 0 12px;
}
.hero-copy {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.hero-copy .t-display {
  font-size: clamp(1.75rem, 3.4vw, 3rem);
  text-wrap: balance;
}
.lead {
  font-size: var(--fs-16);
  color: var(--ink-2);
  max-width: 34em;
}
.hero-search {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 58px;
  padding: 0 14px 0 18px;
  border-radius: var(--r-note);
  background: var(--surface);
  border: 2px solid var(--ink);
  font-size: var(--fs-16);
  color: var(--ink-3);
  text-align: left;
  transition: box-shadow var(--dur-2);
}
.hero-search:hover {
  box-shadow: 4px 4px 0 var(--don);
}
.hero-search kbd {
  padding: 3px 8px;
  border-radius: var(--r-note);
  background: var(--bg-sunk);
  font-family: var(--font-num);
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.steps {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.steps li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  font-size: var(--fs-16);
  color: var(--ink-3);
}
.steps li.done {
  color: var(--ink-2);
}
.steps li.now {
  color: var(--ink);
  font-weight: 700;
}
.steps .note {
  --n: 18px;
}
.hero-demo {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.demo-facts {
  padding: 4px 16px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  min-height: 190px;
}
.tools {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  overflow: hidden;
}
.tool {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 18px 20px;
  border-right: 1px solid var(--line);
  transition: background var(--dur-1);
}
.tool:last-child {
  border-right: 0;
}
.tool:hover {
  background: var(--surface-2);
}
.tool b {
  margin-top: 6px;
  font-size: var(--fs-16);
}

@media (max-width: 1239px) {
  .deck {
    grid-template-columns: minmax(0, 1fr);
  }
  .tri {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .tri > :last-child {
    grid-column: 1 / -1;
  }
  .hero {
    grid-template-columns: minmax(0, 1fr);
    gap: 32px;
  }
}
@media (max-width: 767px) {
  .annual {
    width: 100%;
  }
  .annual span {
    flex: 1;
  }
  .me {
    grid-template-columns: minmax(0, 1fr);
    padding: 18px 12px 14px;
    gap: 8px;
  }
  .me-rating {
    flex-direction: row;
    justify-content: center;
    gap: 20px;
  }
  .me-kv {
    flex-direction: column;
    gap: 10px;
  }
  .me-kv div {
    align-items: flex-start;
  }
  .dayfacts {
    grid-template-columns: minmax(0, 1fr);
  }
  .day-head {
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
  }
  .facts {
    grid-template-columns: minmax(0, 1fr);
  }
  .facts > :nth-last-child(2):nth-child(odd) {
    border-bottom: 1px solid var(--line);
  }
  .tri,
  .duo {
    grid-template-columns: minmax(0, 1fr);
    gap: 32px;
  }
  .tools {
    grid-template-columns: 1fr 1fr;
  }
  .tool:nth-child(2) {
    border-right: 0;
  }
  .tool:nth-child(-n + 2) {
    border-bottom: 1px solid var(--line);
  }
  .hero {
    padding-top: 8px;
  }
}
</style>
