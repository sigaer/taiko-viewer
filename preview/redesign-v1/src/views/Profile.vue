<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Icon from '../components/Icon.vue'
import Radar from '../components/Radar.vue'
import Lane from '../components/Lane.vue'
import Crown from '../components/Crown.vue'
import ThreadRow from '../components/ThreadRow.vue'
import SongCell from '../components/SongCell.vue'
import Cover from '../components/Cover.vue'
import Diff from '../components/Diff.vue'
import Rank from '../components/Rank.vue'
import Sheet from '../components/Sheet.vue'
import EmptyLane from '../components/EmptyLane.vue'
import PlayerAvatar from '../components/PlayerAvatar.vue'
import TitlePlate from '../components/TitlePlate.vue'
import DanBadge from '../components/DanBadge.vue'
import { useQueryState } from '../routeState'
import { isMobile } from '../breakpoints'
import { player, users, DIMS, laneDays, threads, bestList, songById, fmt } from '../mock/data'
import { L, songTitle, toast } from '../store'

// 个人主页（V8）。身份带 → 王冠与「极」→ 三首代表成绩 → 页签（最好成绩 / 最近 / 帖子）；右栏六维。
// 任何 users 里的 key 都显示这位玩家的身份；成绩部分沿用同一份 Mock 数据。
const PAGE = 20
const route = useRoute()
const key = String(route.params.name || '')
const u = users[key] || null
const self = key === 'mochidon'

const qs = useQueryState({
  tab: { type: 'string', default: 'scores', values: ['scores', 'recent', 'posts'] },
  n: { type: 'number', default: PAGE },
})
watch(
  () => qs.tab,
  () => (qs.n = PAGE),
)
const TABS = [
  { key: 'scores', zh: '最好成绩', ja: 'ベスト' },
  { key: 'recent', zh: '最近', ja: '最近' },
  { key: 'posts', zh: '帖子', ja: '投稿' },
]
const pub = ref(true)
const showScores = computed(() => !self || pub.value)
const following = ref(false)

/* ---------- 身份 ---------- */
const roleText = computed(() => (u?.role === 'admin' ? L('站务', '運営') : u?.role === 'moderator' ? L('版主', 'モデレーター') : ''))
const CITIES = [
  ['上海', '上海'], ['北京', '北京'], ['广州', '広州'], ['深圳', '深圳'], ['成都', '成都'], ['杭州', '杭州'], ['南京', '南京'], ['武汉', '武漢'],
]
const seed = [...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
const city = self ? [player.province, player.province] : CITIES[seed % CITIES.length]
const joined = (() => {
  if (self) {
    const [y, m] = player.joined.split('-').map(Number)
    return { y, m }
  }
  return { y: 2022 + (seed % 4), m: 1 + ((seed >> 3) % 12) }
})()

/* ---------- 成绩（同一份 Mock） ---------- */
const cc = player.crownCounts
const kiwami = player.rankCounts[player.rankCounts.length - 1]
const rated = Object.values(users).filter((x) => x.rating != null).sort((a, b) => b.rating - a.rating)
const rating = self ? player.rating : (u?.rating ?? null)
const pct = (() => {
  if (self) return player.percentile.replace('Top ', '')
  const i = u ? rated.indexOf(u) : -1
  return i < 0 ? null : `${Math.max(1, Math.ceil(((i + 1) / rated.length) * 100))}%`
})()
const axes = computed(() => DIMS.map((d) => ({ key: d.key, label: L(d.zh, d.ja), value: player.dims[d.key] })))

const reps = ref(bestList.slice(0, 3))
const swapSlot = ref(-1)
const swapPool = computed(() => bestList.filter((s) => !reps.value.includes(s)))
function swapTo(s) {
  const next = [...reps.value]
  next[swapSlot.value] = s
  reps.value = next
  swapSlot.value = -1
  toast(L('代表成绩已更换', '代表スコアを変更しました'))
}
const best10 = bestList.slice(0, 10)

/* ---------- 最近 30 天 ---------- */
const recentDays = laneDays.slice(-30)
const sel = ref(null)
const recentLine = computed(() => {
  const played = recentDays.filter((d) => d.played).length
  const facts = recentDays.flatMap((d) => d.facts)
  const pb = facts.filter((f) => f.type === 'score-pb').length
  const crowns = facts.filter((f) => f.type === 'fc' || f.type === 'df').length
  const zh = `最近 30 天有 ${played} 天在练，刷新了 ${pb} 次最好成绩${crowns ? `，拿到 ${crowns} 个新王冠` : ''}。`
  const ja = `直近 30 日のうち ${played} 日プレイ。自己ベスト更新 ${pb} 回${crowns ? `、新しい王冠 ${crowns} 個` : ''}。`
  return L(zh, ja)
})
const selDay = computed(() => (sel.value == null ? null : recentDays.find((d) => d.daysAgo === sel.value) || null))

/* ---------- 帖子 ---------- */
const posts = threads.filter((t) => t.author === key)
const postsShown = computed(() => posts.slice(0, Math.max(PAGE, qs.n)))

function onTabKey(e) {
  const keys = TABS.map((t) => t.key)
  const i = keys.indexOf(qs.tab)
  let j
  if (e.key === 'ArrowRight') j = (i + 1) % keys.length
  else if (e.key === 'ArrowLeft') j = (i - 1 + keys.length) % keys.length
  else if (e.key === 'Home') j = 0
  else if (e.key === 'End') j = keys.length - 1
  else return
  e.preventDefault()
  const box = e.currentTarget
  qs.tab = keys[j]
  nextTick(() => box?.querySelectorAll('[role="tab"]')[j]?.focus())
}
</script>

<template>
  <div class="page pf">
    <EmptyLane v-if="!u" :title="L('没有找到这位玩家', 'プレイヤーが見つかりません')" :text="L('检查一下链接，或者回社区里找找。', 'リンクを確認するか、コミュニティで探してください。')">
      <RouterLink to="/community" class="btn btn-primary">{{ L('回到社区广场', 'コミュニティへ') }}</RouterLink>
    </EmptyLane>

    <template v-else>
      <!-- 身份带 -->
      <header class="band stage">
        <PlayerAvatar :user="u" :size="isMobile ? 72 : 96" />
        <div class="grow ident">
          <div class="name-row">
            <h1 class="t-h1 pname title-wrap-2">{{ u.name }}</h1>
            <span v-if="roleText" class="role" :class="u.role">{{ roleText }}</span>
          </div>
          <div class="id-row">
            <TitlePlate :text="u.title" :rare="u.rare" :game="u.gameTitle ?? null" :site="u.siteTitle" form="plate" />
            <DanBadge :dan="u.dan" />
          </div>
          <p class="t-small loc">{{ L(city[0], city[1]) }} · {{ L(`${joined.y} 年 ${joined.m} 月加入`, `${joined.y}年${joined.m}月登録`) }}</p>
        </div>
        <div class="acts">
          <template v-if="self">
            <RouterLink to="/account" class="btn"><Icon name="edit" :size="16" />{{ L('编辑资料', 'プロフィール編集') }}</RouterLink>
            <button type="button" class="btn" @click="toast(L('主页链接已复制', 'リンクをコピーしました'))"><Icon name="link" :size="16" />{{ L('分享', '共有') }}</button>
          </template>
          <template v-else>
            <button type="button" class="btn" :class="following ? '' : 'btn-ink'" :aria-pressed="following" @click="following = !following">{{ following ? L('已关注', 'フォロー中') : L('关注', 'フォロー') }}</button>
            <button type="button" class="icon-btn" :aria-label="L('复制主页链接', 'リンクをコピー')" @click="toast(L('主页链接已复制', 'リンクをコピーしました'))"><Icon name="link" /></button>
          </template>
        </div>
      </header>

      <div v-if="self" class="privacy">
        <Icon name="eye" :size="18" />
        <span class="grow">{{ pub ? L('别人可以看到你的 Rating、六维和最好成绩。', 'Rating・6 つの力・ベスト記録が公開されています。') : L('别人只能看到你的社区身份和帖子。', 'コミュニティでの情報と投稿のみ公開されています。') }}</span>
        <div class="seg" role="group" :aria-label="L('主页公开范围', 'プロフィールの公開範囲')">
          <button type="button" :aria-pressed="pub" @click="pub = true">{{ L('公开成绩', '成績を公開') }}</button>
          <button type="button" :aria-pressed="!pub" @click="pub = false">{{ L('只公开社区身份', '投稿のみ公開') }}</button>
        </div>
      </div>

      <template v-if="showScores">
        <!-- 王冠与「极」 -->
        <dl class="medals">
          <div class="medal"><dt><Crown :v="2" size="lg" />{{ L('全良', '全良') }}</dt><dd class="num">{{ fmt(cc.dfc) }}</dd></div>
          <div class="medal"><dt><Crown :v="1" size="lg" />{{ L('全连', 'フルコンボ') }}</dt><dd class="num">{{ fmt(cc.fc) }}</dd></div>
          <div class="medal"><dt><Crown :v="0" size="lg" />{{ L('通关', 'クリア') }}</dt><dd class="num">{{ fmt(cc.clear) }}</dd></div>
          <div class="medal"><dt><Rank :v="8" />{{ L('极', '極') }}</dt><dd class="num">{{ fmt(kiwami) }}</dd></div>
          <div class="medal rt">
            <dt>Rating</dt>
            <dd>
              <span v-if="rating != null" class="num">{{ rating.toFixed(2) }}</span><span v-else class="na">—</span>
              <span v-if="pct" class="pct">{{ L(`全站前 ${pct}`, `上位 ${pct}`) }}</span>
            </dd>
          </div>
        </dl>

        <!-- 代表成绩 -->
        <section class="reps" aria-labelledby="pf-reps-h">
          <div class="section-head"><h2 id="pf-reps-h" class="t-h2">{{ L('代表成绩', '代表スコア') }}</h2></div>
          <ol class="rep-grid">
            <li v-for="(s, i) in reps" :key="`${s.songId}-${s.d}`" class="rep">
              <RouterLink :to="`/songs/${s.songId}?d=${s.d}&from=community`" class="rep-link">
                <Cover :song="songById[s.songId]" :size="isMobile ? 'lg' : 'tile'" />
                <span class="rep-text">
                  <span class="rep-title title-wrap-2" :title="songTitle(songById[s.songId])">{{ songTitle(songById[s.songId]) }}</span>
                  <Diff :d="s.d" :star="s.star" :constant="s.constant" short />
                  <span class="rep-score"><b class="num">{{ fmt(s.score) }}</b></span>
                  <span class="rep-lamp"><Crown :v="s.crown" /><Rank :v="s.rank" /></span>
                </span>
              </RouterLink>
              <button v-if="self" type="button" class="btn btn-ghost btn-sm swap" @click="swapSlot = i"><Icon name="sync" :size="14" />{{ L('更换', '変更') }}</button>
            </li>
          </ol>
        </section>
      </template>

      <div class="cols" :class="{ single: !showScores }">
        <div class="maincol">
          <template v-if="showScores">
            <div class="tabs" role="tablist" :aria-label="L('主页内容', 'プロフィールの内容')" @keydown="onTabKey">
              <button v-for="t in TABS" :id="`pf-tab-${t.key}`" :key="t.key" type="button" role="tab" :aria-selected="qs.tab === t.key" :tabindex="qs.tab === t.key ? 0 : -1" aria-controls="pf-panel" @click="qs.tab = t.key">{{ L(t.zh, t.ja) }}</button>
            </div>
            <div id="pf-panel" role="tabpanel" :aria-labelledby="`pf-tab-${qs.tab}`">
              <ol v-if="qs.tab === 'scores'" class="best">
                <li v-for="(s, i) in best10" :key="`${s.songId}-${s.d}`">
                  <span class="num pos">{{ i + 1 }}</span>
                  <RouterLink :to="`/songs/${s.songId}?d=${s.d}&from=community`" class="grow"><SongCell :song="songById[s.songId]" /></RouterLink>
                  <Diff :d="s.d" :star="s.star" :constant="s.constant" short class="only-desktop" />
                  <Crown :v="s.crown" /><Rank :v="s.rank" />
                  <b class="num sc">{{ fmt(s.score) }}</b>
                </li>
              </ol>
              <div v-else-if="qs.tab === 'recent'" class="recent">
                <p class="lead-line">{{ recentLine }}</p>
                <Lane v-model="sel" :days="recentDays" :label="L('最近 30 天的练习谱面', '直近 30 日の練習')" />
                <p v-if="selDay" class="t-small" aria-live="polite">
                  {{ L(`${selDay.date.getMonth() + 1} 月 ${selDay.date.getDate()} 日`, `${selDay.date.getMonth() + 1}月${selDay.date.getDate()}日`) }} ·
                  <template v-if="selDay.played">{{ L(`打了 ${selDay.charts} 张谱，${selDay.facts.length} 条进展`, `${selDay.charts} 譜面プレイ、記録 ${selDay.facts.length} 件`) }}</template>
                  <template v-else>{{ L('这天没有打', 'この日はプレイなし') }}</template>
                </p>
              </div>
              <template v-else>
                <div v-if="posts.length" class="ruled"><ThreadRow v-for="t in postsShown" :key="t.id" :thread="t" /></div>
                <EmptyLane v-else compact :title="L('还没有发过帖子', 'まだ投稿はありません')" />
                <div v-if="posts.length > postsShown.length" class="more"><button type="button" class="btn" @click="qs.n = postsShown.length + PAGE">{{ L('再显示 20 帖', 'さらに 20 件表示') }}</button></div>
              </template>
            </div>
          </template>
          <section v-else aria-labelledby="pf-posts-h">
            <div class="section-head"><h2 id="pf-posts-h" class="t-h2">{{ L('帖子', '投稿') }}</h2><span class="t-caption num">{{ posts.length }}</span></div>
            <div v-if="posts.length" class="ruled"><ThreadRow v-for="t in postsShown" :key="t.id" :thread="t" /></div>
            <EmptyLane v-else compact :title="L('还没有发过帖子', 'まだ投稿はありません')" />
            <div v-if="posts.length > postsShown.length" class="more"><button type="button" class="btn" @click="qs.n = postsShown.length + PAGE">{{ L('再显示 20 帖', 'さらに 20 件表示') }}</button></div>
          </section>
        </div>
        <aside v-if="showScores" class="radarp">
          <h2 class="t-h3">{{ L('六维', '6 つの力') }}</h2>
          <Radar :axes="axes" :size="290" :label="L('六维', '6 つの力')" />
        </aside>
      </div>
    </template>

    <Sheet :open="swapSlot >= 0" :title="L('选择代表成绩', '代表スコアを選ぶ')" :width="520" @close="swapSlot = -1">
      <ul class="swaplist">
        <li v-for="s in swapPool" :key="`${s.songId}-${s.d}`">
          <button type="button" class="swapbtn" @click="swapTo(s)">
            <SongCell :song="songById[s.songId]" class="grow" />
            <Diff :d="s.d" :star="s.star" short />
            <Crown :v="s.crown" />
            <b class="num">{{ fmt(s.score) }}</b>
          </button>
        </li>
      </ul>
    </Sheet>
  </div>
</template>

<style scoped>
.pf {
  max-width: 1180px;
}
/* 身份带（V8）：舞台面深藍底（.stage），不放图片 */
.band {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 28px;
  border-radius: var(--r-panel);
}
.ident {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.name-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 10px;
  min-width: 0;
}
.pname {
  min-width: 0;
  line-height: 1.25;
}
.id-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.loc {
  color: var(--ink-2);
}
.acts {
  display: flex;
  gap: 8px;
  flex: none;
}
.privacy {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding: 10px 12px 10px 16px;
  border-radius: var(--r-panel);
  background: var(--ka-wash);
  color: var(--ka-ink);
  font-size: var(--fs-13);
  font-weight: 500;
}

/* 王冠与「极」：大数字 */
.medals {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)) minmax(0, 1.3fr);
  margin: 28px 0 0;
  padding: 20px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.medal {
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
  padding: 0 16px;
  border-left: 1px solid var(--line);
}
.medal:first-child {
  padding-left: 0;
  border-left: 0;
}
.medal dt {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-13);
  color: var(--ink-2);
  white-space: nowrap;
}
.medal dd {
  font-size: var(--fs-36);
  font-weight: 700;
  line-height: 1;
}
.medal.rt dd {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 10px;
}
.medal.rt .num {
  color: var(--don-ink);
}
.pct {
  font-size: var(--fs-13);
  font-weight: 500;
  color: var(--ink-2);
}

/* 代表成绩 */
.reps {
  margin-top: 28px;
}
.rep-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}
.rep {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding-top: 14px;
  border-top: 3px solid var(--ink);
}
.rep-link {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  min-width: 0;
  flex: 1; /* F5.1：三张卡片等高（网格行拉伸），「更换」贴卡片底部 */
}
.rep-link:hover .rep-title {
  color: var(--ka-ink);
}
.rep-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
}
.rep-title {
  font-size: var(--fs-16);
  font-weight: 700;
  line-height: 1.4;
}
.rep-score b {
  font-size: var(--fs-22);
}
.rep-lamp {
  display: flex;
  align-items: center;
  gap: 8px;
}
.swap {
  align-self: flex-start;
  margin-top: auto;
}

.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 40px;
  align-items: start;
  margin-top: 28px;
}
.cols.single {
  grid-template-columns: minmax(0, 1fr);
}
.maincol {
  min-width: 0;
}
.best li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.best .grow {
  min-width: 0;
}
.pos {
  width: 20px;
  color: var(--ink-3);
}
.sc {
  width: 92px;
  text-align: right;
  font-size: var(--fs-18);
}
.recent {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 16px;
}
.lead-line {
  font-size: var(--fs-16);
  line-height: 1.7;
}
.more {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}
.radarp {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 18px 16px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
}
.radarp h2 {
  align-self: flex-start;
}
.swaplist {
  display: flex;
  flex-direction: column;
}
.swapbtn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: var(--hit);
  padding: 8px 4px;
  border-radius: var(--r-ctl);
  text-align: left;
}
.swapbtn:hover {
  background: var(--bg-sunk);
}
@media (max-width: 1099px) {
  .cols {
    grid-template-columns: minmax(0, 1fr);
  }
  .medals {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    row-gap: 18px;
  }
  .medal.rt {
    grid-column: 1 / -1;
    padding-left: 0;
    border-left: 0;
  }
  .rep-grid {
    gap: 16px;
  }
  .rep-link {
    flex-direction: column;
  }
}
@media (max-width: 767px) {
  .band {
    flex-wrap: wrap;
    gap: 14px;
    padding: 18px 16px;
  }
  .acts {
    width: 100%;
  }
  .acts .btn {
    flex: 1;
  }
  /* F5.2：说明文字在上，分段控件在下通栏 */
  .privacy {
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .privacy .seg {
    flex-basis: 100%;
    display: flex;
  }
  .privacy .seg button {
    flex: 1 1 0;
    min-width: 0;
  }
  /* F5.2：Rating 第一行通栏，下面 2×2（全良 / 全连 / 通关 / 极） */
  .medals {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .medal.rt {
    order: -1;
    grid-column: 1 / -1;
  }
  .medal {
    padding: 0;
    border-left: 0;
  }
  .medal dd {
    font-size: var(--fs-28);
  }
  .rep-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .rep-link {
    flex-direction: row;
  }
  .sc {
    width: auto;
    font-size: var(--fs-16);
  }
}
</style>
