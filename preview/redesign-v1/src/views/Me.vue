<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../components/Icon.vue'
import Lane from '../components/Lane.vue'
import PlayerAvatar from '../components/PlayerAvatar.vue'
import TitlePlate from '../components/TitlePlate.vue'
import DanBadge from '../components/DanBadge.vue'
import { player, users, laneDays, goals, weekly, fmt } from '../mock/data'
import { store, L, isReady, isAuthed, resolvedTheme } from '../store'
import { sync, openSyncPanel } from '../sync'

// 我的（V9）：身份带 → 概览 → 2×2 快捷格 → 分组入口 → 语言与主题 → 退出登录。
const router = useRouter()
const me = users.mochidon || { name: player.nickname, hue: 12, dan: player.dan, rare: false }
const mini = laneDays.slice(-7) // C2：手机「我的」只作概览，显示最近 7 天
const activeGoal = computed(() => goals.find((g) => g.status === 'active'))
const signed = (v) => (v >= 0 ? '+' : '') + v.toFixed(2)

const lastSync = computed(() => {
  if (sync.state === 'running') return L('正在同步…', '同期中…')
  const z = sync.lastSyncLabel.zh
  if (z === '刚刚') return L('刚刚同步', 'たった今同期')
  return L(`上次同步 ${z}`, `前回の同期 ${sync.lastSyncLabel.ja}`)
})

const goalValue = computed(() => {
  const g = activeGoal.value
  if (!g) return null
  if (g.latest?.ng != null && (g.target?.field === 'ng' || g.type === 'fc' || g.type === 'ng-reduced')) return L(`不可 ${g.latest.ng} → 0`, `不可 ${g.latest.ng} → 0`)
  return g.target?.label || null
})
const TILES = computed(() => [
  { to: '/play', icon: 'play', k: 'Rating', v: isReady.value ? player.rating.toFixed(2) : null, num: true },
  { to: '/play/scores', icon: 'rows', k: L('全部成绩', '全成績'), v: isReady.value ? L(`${fmt(player.scoredCharts)} 张`, `${fmt(player.scoredCharts)} 譜面`) : null, num: true },
  { to: '/growth/goals', icon: 'flag', k: L('目标', '目標'), v: isReady.value ? goalValue.value : null },
  { to: '/growth/weekly', icon: 'calendar', k: L('这一周', '今週'), v: isReady.value ? `${signed(weekly.ratingDelta)} Rating` : null, num: true },
])

const GROUPS = [
  {
    zh: '成绩', ja: '成績',
    items: [
      { to: '/play/progress', icon: 'grid', zh: '点灯进度', ja: '進捗' },
      { to: '/play/recommend', icon: 'spark', zh: '练习推荐', ja: 'おすすめ' },
    ],
  },
  {
    zh: '成长', ja: '成長',
    items: [
      { to: '/growth', icon: 'growth', zh: '成长档案', ja: '成長記録' },
      { to: '/annual', icon: 'star', zh: '年度回顾', ja: '年間ふりかえり' },
    ],
  },
  {
    zh: '曲库与工具', ja: '楽曲とツール',
    items: [
      { to: '/dan', icon: 'trophy', zh: '段位道场', ja: '段位道場' },
      { to: '/tools', icon: 'layers', zh: '查配置 · 查物量', ja: '配置・ノーツ数検索' },
      { to: '/tools/rt', icon: 'target', zh: 'RT 计算器', ja: 'RT 計算' },
      { to: '/tools/tja', icon: 'music', zh: 'TJA', ja: 'TJA' },
    ],
  },
  {
    zh: '社区与账号', ja: 'コミュニティとアカウント',
    items: [
      { to: '/community/me', icon: 'community', zh: '我的社区', ja: 'マイ投稿' },
      { to: '/account', icon: 'link', zh: '账号与绑定', ja: 'アカウント連携' },
      { to: '/account/sync', icon: 'sync', zh: '同步设置', ja: '同期設定' },
      { to: '/account/developer', icon: 'code', zh: '开发者', ja: '開発者' },
      { to: '/account/support', icon: 'help', zh: '工单', ja: 'サポート' },
      { to: '/account/settings', icon: 'settings', zh: '设置', ja: '設定' },
    ],
  },
]

function logout() {
  store.auth = 'guest'
  router.push('/')
}
</script>

<template>
  <div class="page me">
    <h1 v-if="isReady" class="sr-only">{{ L('我的', 'マイページ') }}</h1>
    <!-- 身份带 / 下一步 -->
    <RouterLink v-if="isReady" to="/u/mochidon" class="who" :aria-label="L(`${player.nickname} 的主页`, `${player.nickname} のプロフィール`)">
      <PlayerAvatar :user="me" :size="72" />
      <span class="grow who-t">
        <span class="who-name title-wrap-2">{{ player.nickname }}</span>
        <span class="who-meta">
          <TitlePlate :text="player.title" :rare="!!me.rare" />
          <DanBadge :dan="player.dan" />
        </span>
        <span class="t-caption num">CN {{ player.taikoIdMasked }}</span>
      </span>
      <Icon name="chevR" class="go" />
    </RouterLink>

    <section v-else class="next" aria-labelledby="me-next-h">
      <template v-if="store.auth === 'guest'">
        <h1 id="me-next-h" class="t-h2">{{ L('登录后，这里是你的太鼓主页', 'ログインすると、ここがあなたのホームになります') }}</h1>
        <p class="t-small">{{ L('登录并绑定鼓众广场 ID 后，成绩、Rating 和成长记录会自动同步到 Viewer。', 'ログインして鼓衆広場 ID を連携すると、成績・Rating・成長記録が Viewer に同期されます。') }}</p>
        <div class="row-wrap acts">
          <RouterLink to="/login" class="btn btn-primary">{{ L('登录', 'ログイン') }}</RouterLink>
          <RouterLink to="/login?mode=register" class="btn">{{ L('注册', '新規登録') }}</RouterLink>
        </div>
      </template>
      <template v-else>
        <h1 id="me-next-h" class="t-h2">{{ store.auth === 'unbound' ? L('绑定鼓众广场 ID', '鼓衆広場 ID を連携') : L('第一次同步', '最初の同期') }}</h1>
        <ol class="steps">
          <li class="done"><i class="note ka" aria-hidden="true" />{{ L('登录 Viewer', 'Viewer にログイン') }}<span class="sr-only">{{ L('已完成', '完了') }}</span></li>
          <li :class="store.auth === 'unbound' ? 'now' : 'done'" :aria-current="store.auth === 'unbound' ? 'step' : undefined">
            <i class="note" :class="store.auth === 'unbound' ? '' : 'ka'" aria-hidden="true" />{{ L('绑定鼓众广场 ID', '鼓衆広場 ID を連携') }}<span v-if="store.auth !== 'unbound'" class="sr-only">{{ L('已完成', '完了') }}</span>
          </li>
          <li :class="store.auth === 'empty' ? 'now' : ''" :aria-current="store.auth === 'empty' ? 'step' : undefined">
            <i class="note" :class="store.auth === 'empty' ? '' : 'ghost'" aria-hidden="true" />{{ L('第一次同步', '最初の同期') }}
          </li>
        </ol>
        <p v-if="store.auth === 'empty'" class="t-small">{{ L('第一次同步大约需要 10 秒。', '最初の同期は 10 秒ほどかかります。') }}</p>
        <div class="row-wrap acts">
          <RouterLink v-if="store.auth === 'unbound'" to="/bind" class="btn btn-primary">{{ L('去绑定', '連携する') }}</RouterLink>
          <button v-else type="button" class="btn btn-primary" @click="openSyncPanel()"><Icon name="sync" :size="16" />{{ L('开始同步', '同期を開始') }}</button>
        </div>
      </template>
    </section>

    <!-- 概览（只读，不放同步按钮） -->
    <section v-if="isReady" class="glance" :aria-label="L('概览', '概要')">
      <div class="gl-top">
        <div class="gl-r">
          <span class="t-caption">Rating</span>
          <b class="num gl-v">{{ player.rating.toFixed(2) }}</b>
        </div>
        <div class="gl-r">
          <span class="t-caption">{{ L('近 30 天', '直近 30 日') }}</span>
          <b class="num up gl-d">{{ signed(player.ratingDelta30) }}</b>
        </div>
      </div>
      <Lane :days="mini" compact to="/growth" :label="L('最近 7 天的练习', '直近 7 日のプレイ')" />
      <p class="t-caption gl-sync"><Icon name="clock" :size="14" />{{ lastSync }}</p>
    </section>

    <!-- 2×2 快捷格 -->
    <ul class="tiles">
      <li v-for="t in TILES" :key="t.to">
        <RouterLink v-if="t.v != null" :to="t.to" class="tile">
          <span class="tile-k"><Icon :name="t.icon" :size="16" />{{ t.k }}</span>
          <b class="tile-v" :class="{ num: t.num }">{{ t.v }}</b>
        </RouterLink>
        <div v-else class="tile off" aria-disabled="true">
          <span class="tile-k"><Icon :name="t.icon" :size="16" />{{ t.k }}</span>
          <b class="tile-v na">—</b>
        </div>
      </li>
    </ul>

    <!-- 其余入口 -->
    <div class="groups">
      <section v-for="g in GROUPS" :key="g.zh" :aria-labelledby="'me-g-' + g.zh">
        <h2 :id="'me-g-' + g.zh" class="gh">{{ L(g.zh, g.ja) }}</h2>
        <ul class="glist">
          <li v-for="it in g.items" :key="it.to">
            <RouterLink :to="it.to"><Icon :name="it.icon" /><span class="grow">{{ L(it.zh, it.ja) }}</span><Icon name="chevR" :size="16" class="go" /></RouterLink>
          </li>
        </ul>
      </section>
    </div>

    <div class="quick">
      <div class="seg" role="group" :aria-label="L('语言', '言語')">
        <button type="button" :aria-pressed="store.locale === 'zh'" lang="zh-CN" @click="store.locale = 'zh'">简体中文</button>
        <button type="button" :aria-pressed="store.locale === 'ja'" lang="ja" @click="store.locale = 'ja'">日本語</button>
      </div>
      <div class="seg" role="group" :aria-label="L('主题', 'テーマ')">
        <button type="button" :aria-pressed="resolvedTheme === 'light'" :aria-label="L('浅色', 'ライト')" @click="store.theme = 'light'"><Icon name="sun" :size="16" /></button>
        <button type="button" :aria-pressed="resolvedTheme === 'dark'" :aria-label="L('深色', 'ダーク')" @click="store.theme = 'dark'"><Icon name="moon" :size="16" /></button>
      </div>
    </div>

    <button v-if="isAuthed" type="button" class="btn btn-block out" @click="logout"><Icon name="logout" :size="16" />{{ L('退出登录', 'ログアウト') }}</button>
  </div>
</template>

<style scoped>
.me {
  max-width: 980px;
}

/* ---------- 身份带 ---------- */
.who {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: var(--hit);
  padding: 4px 0 20px;
}
.who-t {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}
.who-name {
  font-size: var(--fs-22);
  font-weight: 900;
  line-height: var(--lh-tight);
}
.who-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  max-width: 100%;
}
.go {
  flex: none;
  color: var(--ink-3);
}
.who:hover .who-name {
  color: var(--ka-ink);
}

/* ---------- 下一步（游客 / 未绑定 / 无成绩） ---------- */
.next {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px 16px;
  margin-bottom: 20px;
  border-radius: var(--r-panel);
  background: var(--roll-wash);
}
.steps li {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 32px;
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.steps li.now {
  color: var(--ink);
  font-weight: 700;
}
.steps .note {
  --n: 14px;
}
.acts {
  margin-top: 4px;
}

/* ---------- 概览 ---------- */
.glance {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
}
.gl-top {
  display: flex;
  align-items: flex-end;
  gap: 28px;
}
.gl-r {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.gl-v {
  font-size: var(--fs-36);
  line-height: 1;
}
.gl-d {
  font-size: var(--fs-18);
  line-height: 1.2;
}
.gl-sync {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ---------- 快捷格 ---------- */
.tiles {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}
.tile {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
  height: 100%;
  min-height: 84px;
  padding: 12px 14px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
}
a.tile:hover {
  border-color: var(--ink-3);
}
.tile-k {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.tile-v {
  font-size: var(--fs-22);
  font-weight: 700;
  line-height: 1.15;
  overflow-wrap: anywhere;
}
.tile-v:not(.num):not(.na) {
  font-size: var(--fs-18);
}
.tile.off {
  background: var(--bg-sunk);
  border-style: dashed;
}

/* ---------- 分组入口 ---------- */
.groups {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px 28px;
  margin-top: 24px;
}
.gh {
  margin: 0 0 6px 4px;
  font-size: var(--fs-13);
  font-weight: 500;
  color: var(--ink-3);
}
.glist {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  overflow: hidden;
}
.glist li + li {
  border-top: 1px solid var(--line);
}
.glist a {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 48px;
  padding: 0 14px 0 16px;
  font-size: var(--fs-16);
  font-weight: 500;
}
.glist a > :first-child {
  color: var(--ink-2);
}
.glist a:hover {
  background: var(--surface-2);
}

/* ---------- 语言 / 主题 / 退出 ---------- */
.quick {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;
}
.out {
  max-width: 360px;
  margin: 20px auto 0;
}
@media (max-width: 767px) {
  .who {
    padding-bottom: 16px;
  }
  .tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .groups {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    margin-top: 20px;
  }
  .glist a {
    min-height: var(--hit);
  }
}
</style>
