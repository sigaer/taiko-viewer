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
import PlayerAvatar from '../components/PlayerAvatar.vue'
import TitlePlate from '../components/TitlePlate.vue'
import DanBadge from '../components/DanBadge.vue'
import { player, users, DIMS, laneDays, goals, recommendations, threads, songs, songById, chartOf, events, GENRES, fmt } from '../mock/data'
import { store, L, isReady, songTitle, runSync } from '../store'

// 今日（V1）：一行身份信息 → 上次同步带来的变化（主句）→ Rating ｜ 六维 ｜ 当前目标 → 最近 21 天的谱面带。
const lane = laneDays.slice(-21)
const sel = ref(0)
const day = computed(() => lane.find((d) => d.daysAgo === sel.value) || lane[lane.length - 1])
const axes = computed(() => DIMS.map((d) => ({ key: d.key, label: L(d.zh, d.ja), value: player.dims[d.key], prev: player.dimsPrev[d.key] })))
const focus = computed(() => DIMS.find((d) => d.key === player.focus))
const activeGoal = goals.find((g) => g.status === 'active')
const me = users.mochidon || { name: player.nickname, hue: 12, dan: player.dan }

// 新曲：按上架日期取最新 6 首（字符串比较即可，避免 1,500 次 localeCompare）
const latest = (() => {
  const top = []
  for (const s of songs) {
    if (top.length < 6 || s.openDay > top[top.length - 1].openDay) {
      top.push(s)
      top.sort((a, b) => (a.openDay < b.openDay ? 1 : a.openDay > b.openDay ? -1 : 0))
      if (top.length > 6) top.pop()
    }
  }
  return top
})()
const hot = threads.slice(0, 4)
const streak = (() => {
  let n = 0
  for (let i = laneDays.length - 1; i >= 0 && laneDays[i].played; i--) n++
  return n
})()

const hour = 20
const greet = computed(() => (hour < 11 ? L('早上好', 'おはようございます') : hour < 18 ? L('下午好', 'こんにちは') : L('晚上好', 'こんばんは')))

// 主句：最近一个游玩日的进展；按稀有程度点名一种（新全良 > 新全连 > 练成目标 > 评价升级）
const lastPlayed = [...laneDays].reverse().find((d) => d.played)
const RARE = [
  { type: 'df', zh: (n) => `其中 ${n} 个新全良`, ja: (n) => `うち全良 ${n} 件` },
  { type: 'fc', zh: (n) => `其中 ${n} 个新全连`, ja: (n) => `うちフルコンボ ${n} 件` },
  { type: 'goal-completed', zh: (n) => `其中 ${n} 个目标练成了`, ja: (n) => `うち目標達成 ${n} 件` },
  { type: 'rank-upgrade', zh: (n) => `其中 ${n} 次评价升级`, ja: (n) => `うち評価アップ ${n} 件` },
]
const lead = computed(() => {
  const facts = lastPlayed?.facts || []
  if (!facts.length) return `${greet.value}${L('，', '、')}${player.nickname}`
  const n = facts.length
  const rare = RARE.map((r) => ({ ...r, n: facts.filter((f) => f.type === r.type).length })).find((r) => r.n > 0)
  const zh = `上次同步带来 ${n} 条新进展` + (rare ? `，${rare.zh(rare.n)}。` : '。')
  const ja = `前回の同期で新しい記録が ${n} 件` + (rare ? `、${rare.ja(rare.n)}。` : '。')
  return L(zh, ja)
})

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
// 与同步面板（S3）的三步清单一致
const STEPS = computed(() => [
  { zh: '登录 Viewer', ja: 'Viewer にログイン', done: true },
  { zh: '绑定鼓众广场 ID', ja: '鼓衆広場 ID を連携', done: store.auth === 'empty', to: '/bind', cta: L('去绑定', '連携する') },
  { zh: '第一次同步', ja: '最初の同期', done: false, action: true, cta: L('开始同步', '同期を開始') },
])
const nextStep = computed(() => STEPS.value.find((s) => !s.done))
const songLink = (id, d) => (d ? `/songs/${id}?d=${d}&from=today` : `/songs/${id}?from=today`)
</script>

<template>
  <div class="page today">
    <!-- ================= 已同步 ================= -->
    <template v-if="isReady">
      <header class="hello">
        <div class="who">
          <PlayerAvatar :user="me" :size="44" />
          <span class="who-name title-1l" :title="player.nickname">{{ player.nickname }}</span>
          <TitlePlate :text="player.title" :game="player.gameTitle ?? null" :site="me.siteTitle" form="text" />
          <DanBadge :dan="player.dan" />
          <span class="t-caption num who-id">CN {{ player.taikoIdMasked }}</span>
        </div>
        <RouterLink to="/annual" class="annual">
          <i class="note roll" aria-hidden="true" />
          <span><b>{{ L('虹 2026 太鼓回顾', '虹 2026 ふりかえり') }}</b><small>{{ L('12 月 1 日开放', '12月1日公開') }}</small></span>
          <Icon name="chevR" :size="16" />
        </RouterLink>
      </header>
      <h1 class="t-h1 lead-line title-wrap">{{ lead }}</h1>

      <div class="deck">
        <div class="me">
          <section class="cell me-rating" :aria-label="L('Rating', 'Rating')">
            <DrumDial :value="player.rating" :size="168">
              <span class="t-caption">Rating</span>
              <b class="num big">{{ player.rating.toFixed(2) }}</b>
              <span class="t-caption">/ 15.5</span>
            </DrumDial>
            <dl class="me-kv">
              <div><dt>{{ L('近 30 天', '直近 30 日') }}</dt><dd class="num up">+{{ player.ratingDelta30.toFixed(2) }}</dd></div>
              <div><dt>{{ L('全站位置', '全体順位') }}</dt><dd>{{ player.percentile }}</dd></div>
              <div><dt>{{ L('连续游玩', '連続プレイ') }}</dt><dd><span class="num">{{ streak }}</span> {{ L('天', '日') }}</dd></div>
            </dl>
          </section>
          <section class="cell me-radar" :aria-label="L('六维', '6 つの力')">
            <Radar :axes="axes" :focus="player.focus" :size="236" :label="L('六维', '6 つの力')" />
            <p class="t-small focus">
              <i class="dot" aria-hidden="true" />
              <span>{{ L('现在更值得留意：', 'いま注目したい方向：') }}<b>{{ L(focus.zh, focus.ja) }}</b></span>
              <RouterLink to="/growth" class="link">{{ L('成长档案', '成長記録') }}</RouterLink>
            </p>
          </section>
        </div>
        <GoalCard v-if="activeGoal" :goal="activeGoal" class="deck-goal" />
      </div>

      <!-- 譜面レーン -->
      <section class="lane-sec">
        <div class="section-head">
          <h2 class="t-h2">{{ L('最近 21 天', '直近 21 日') }}</h2>
          <div class="legend only-desktop" aria-hidden="true">
            <span><i class="note" />{{ L('刷新成绩', '自己ベスト') }}</span>
            <span><i class="note ka" />{{ L('更稳了', '安定度アップ') }}</span>
            <span><i class="note big lg" />{{ L('新王冠', '新しい王冠') }}</span>
            <span><i class="rollbar" />{{ L('连续游玩', '連続プレイ') }}</span>
          </div>
        </div>
        <Lane v-model="sel" :days="lane" :label="L('最近 21 天的练习', '直近 21 日のプレイ')" />
        <div class="dayfacts">
          <div class="day-head">
            <h3 class="t-h3">{{ dayLabel(day) }}</h3>
            <span v-if="day.played" class="t-small">{{ L(`碰了 ${day.charts} 张谱，${day.facts.length} 条进展`, `${day.charts} 譜面をプレイ、記録 ${day.facts.length} 件`) }}</span>
          </div>
          <div v-if="day.facts.length" class="facts">
            <FactRow v-for="(f, i) in day.facts" :key="i" :fact="f" />
          </div>
          <p v-else-if="day.played" class="t-small rest">{{ L('这天打了几首，没有新的记录。', 'この日は記録更新なし。') }}</p>
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
              <RouterLink :to="songLink(r.songId, r.d)" class="rec">
                <SongCell :song="songById[r.songId]" :sub="L(r.reason, r.reasonJa || r.reason)" class="grow" />
                <Diff :d="r.d" :star="chartOf(r.songId, r.d)?.star" :constant="chartOf(r.songId, r.d)?.constant" short />
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
              <b class="title-1l" :title="e.title">{{ e.title }}</b>
              <span class="t-caption num">{{ e.range }}</span>
              <span class="tag" :class="e.tag === '报名中' ? 'tag-don' : e.tag === '已上线' ? 'tag-ok' : ''">{{ e.tag }}</span>
            </li>
          </ul>
          <div class="covers">
            <RouterLink v-for="s in latest" :key="s.id" :to="songLink(s.id)" :title="songTitle(s)" :aria-label="songTitle(s)"><Cover :song="s" size="fill" /></RouterLink>
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
            <p class="lead">{{ L(`${fmt(songs.length)} 首曲目的定数与谱面图；绑定鼓众广场 ID 后，成绩、Rating 和成长记录会同步到这里。`, `${fmt(songs.length)} 曲の定数と譜面画像。鼓衆広場 ID を連携すると、成績・Rating・成長記録がここに同期されます。`) }}</p>
          </template>
          <template v-else>
            <h1 class="t-display">{{ store.auth === 'unbound' ? L('还差两步，就能看到自己的谱面。', 'あと 2 ステップで、自分の譜面が見られます。') : L('还差一步：第一次同步。', 'あと 1 ステップ：最初の同期。') }}</h1>
            <ol class="steps">
              <li v-for="(s, i) in STEPS" :key="i" :class="{ done: s.done, now: s === nextStep }" :aria-current="s === nextStep ? 'step' : undefined">
                <i class="note" :class="s.done ? 'ka' : s === nextStep ? '' : 'ghost'" aria-hidden="true" />
                <span>{{ L(s.zh, s.ja) }}</span>
                <template v-if="s.done"><Icon name="check" :size="16" /><span class="sr-only">{{ L('已完成', '完了') }}</span></template>
              </li>
            </ol>
            <p v-if="store.auth === 'empty'" class="t-small">{{ L('第一次同步大约需要 10 秒。', '最初の同期は 10 秒ほどかかります。') }}</p>
          </template>

          <button type="button" class="hero-search" @click="store.paletteOpen = true">
            <Icon name="search" />
            <span class="grow">{{ L('搜一首歌，比如「天狗囃子」', '曲名で検索（例：天狗囃子）') }}</span>
            <kbd class="only-desktop">Ctrl K</kbd>
          </button>
          <div class="row-wrap">
            <template v-if="store.auth === 'guest'">
              <RouterLink to="/login" class="btn btn-primary btn-lg">{{ L('登录', 'ログイン') }}</RouterLink>
              <RouterLink to="/login?mode=register" class="btn btn-lg">{{ L('注册', '新規登録') }}</RouterLink>
            </template>
            <RouterLink v-else-if="nextStep.to" :to="nextStep.to" class="btn btn-primary btn-lg">{{ nextStep.cta }}</RouterLink>
            <button v-else type="button" class="btn btn-primary btn-lg" :disabled="store.syncing" @click="runSync"><Icon name="sync" :size="16" />{{ store.syncing ? L('正在同步…', '同期中…') : nextStep.cta }}</button>
            <RouterLink to="/songs" class="btn btn-lg">{{ L('浏览曲库', '楽曲一覧を見る') }}</RouterLink>
          </div>
        </div>

        <figure class="hero-demo">
          <figcaption class="t-caption">{{ L('示例：一位玩家最近 21 天的练习', 'サンプル：あるプレイヤーの直近 21 日') }}</figcaption>
          <Lane v-model="sel" :days="lane" compact :label="L('示例：最近 21 天的练习', 'サンプル：直近 21 日のプレイ')" />
          <div class="demo-facts">
            <FactRow v-for="(f, i) in day.facts.slice(0, 3)" :key="i" :fact="f" dense />
            <p v-if="!day.facts.length" class="t-small rest">{{ L('这天没有新的记录。点一个有音符的日子看看。', 'この日は記録なし。音符のある日を選んでみてください。') }}</p>
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
              <RouterLink :to="songLink(s.id)" class="rec">
                <SongCell :song="s" :sub="`${L(GENRES[s.genre].zh, GENRES[s.genre].ja)} · ${s.openDay}`" class="grow" />
                <Diff :d="4" :star="s.levels[3]" :constant="chartOf(s.id, 4)?.constant" short />
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
/* ---------- 身份行 ---------- */
.hello {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  flex-wrap: wrap;
}
.who {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
  min-width: 0;
}
.who-name {
  max-width: 14em;
  font-size: var(--fs-18);
  font-weight: 900;
}
.who-id {
  white-space: nowrap;
}
.annual {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: var(--ctl-h);
  padding: 6px 12px 6px 10px;
  border-radius: var(--r-note);
  background: var(--annual-wash);
  color: var(--annual-ink);
}
.annual span {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}
.annual b {
  font-size: var(--fs-13);
  white-space: nowrap;
}
.annual small {
  font-size: var(--fs-11);
  color: var(--ink-2);
}
.lead-line {
  margin: 14px 0 20px;
}

/* ---------- 第一行：Rating ｜ 六维 ｜ 目标 ---------- */
.deck {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(300px, 1fr);
  gap: 20px;
  align-items: stretch;
}
.me {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 8px 24px;
  padding: 16px 24px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
}
.me-rating {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.me-rating .big {
  font-size: var(--fs-48); /* C+ G2：比 Phase A 的 44px 大一档，首页第一屏最大的数字 */
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
  white-space: nowrap;
}
.me-kv dd {
  font-size: var(--fs-14);
  font-weight: 700;
  white-space: nowrap;
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
  gap: 4px 8px;
  text-align: center;
}
.focus .dot {
  color: var(--series-focus);
}
.focus b {
  color: var(--ink);
}
@media (min-width: 1240px) {
  .deck {
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1fr) minmax(320px, 1.1fr);
  }
  .me {
    display: contents;
  }
  /* 三块等高（网格行 stretch）；内容在块内上下居中（I12） */
  .cell {
    display: flex;
    justify-content: center;
    align-items: center;
    min-width: 0;
    padding: 16px 20px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-panel);
  }
  /* Rating：刻度盘约 150px 在左，三项数字竖排在右，整体居中 */
  .me-rating {
    flex-direction: row;
    gap: 24px;
  }
  .me-kv {
    flex-direction: column;
    gap: 14px;
  }
  .me-kv div {
    align-items: flex-start;
  }
  .me-kv .num {
    font-size: var(--fs-22);
  }
  .me-radar {
    justify-content: center;
  }
  .deck-goal {
    min-width: 0;
  }
}

/* ---------- 谱面带 ---------- */
.lane-sec {
  margin-top: var(--sp-8);
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
  white-space: nowrap;
}
.legend .note {
  --n: 12px;
}
.legend .note.lg {
  --n: 16px;
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

/* ---------- 下方三栏 ---------- */
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
  min-height: var(--hit);
  padding: 11px 0;
  border-bottom: 1px solid var(--line);
}
.rec:hover :deep(.t) {
  color: var(--link);
}
.ev li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
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
  border-radius: var(--r-ctl);
  transition: transform var(--dur-2) var(--ease-out);
}
.covers a:hover {
  transform: translateY(-3px);
}
:root[data-motion='reduce'] .covers a:hover {
  transform: none;
}

/* ---------- 游客 / 未绑定 / 无成绩 ---------- */
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
  min-width: 0;
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
  box-shadow: 4px 4px 0 var(--accent);
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
@media (max-width: 1099px) {
  .deck {
    grid-template-columns: minmax(0, 1fr);
  }
  /* C1：≤1099 标题在上、成绩行单栏通栏；≥1100 才并排、才分两栏 */
  .dayfacts {
    grid-template-columns: minmax(0, 1fr);
  }
  .day-head {
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .facts {
    grid-template-columns: minmax(0, 1fr);
  }
  .facts > :nth-last-child(2):nth-child(odd) {
    border-bottom: 1px solid var(--line);
  }
}
@media (max-width: 767px) {
  .hello {
    align-items: flex-start;
  }
  .annual {
    width: 100%;
    min-height: var(--hit);
  }
  .annual span {
    flex: 1;
  }
  .lead-line {
    margin: 12px 0 16px;
  }
  .me {
    grid-template-columns: minmax(0, 1fr);
    padding: 16px 12px 14px;
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
