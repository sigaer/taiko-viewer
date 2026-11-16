<script setup>
import Icon from '../components/Icon.vue'
import DrumDial from '../components/DrumDial.vue'
import Lane from '../components/Lane.vue'
import EmptyLane from '../components/EmptyLane.vue'
import { player, laneDays } from '../mock/data'
import { store, L, isReady, isAuthed, runSync, resolvedTheme } from '../store'

// 「我的」：手机端底栏第五格的落点。桌面端的成绩 / 成长 / 工具 / 账号在这里汇成一页清单，
// 一屏之内能到达任何个人功能，取代旧版的 /my 与 /more 两个枢纽页。
const GROUPS = [
  {
    zh: '成绩', ja: '成績',
    items: [
      { to: '/play', icon: 'play', zh: 'Rating 与最好成绩', ja: 'Rating とベスト' },
      { to: '/play/scores', icon: 'rows', zh: '全部成绩', ja: '全成績' },
      { to: '/play/progress', icon: 'grid', zh: '点灯进度', ja: '進捗' },
      { to: '/play/recommend', icon: 'spark', zh: '练习推荐', ja: 'おすすめ' },
    ],
  },
  {
    zh: '成长', ja: '成長',
    items: [
      { to: '/growth', icon: 'growth', zh: '成长档案', ja: '成長記録' },
      { to: '/growth/weekly', icon: 'calendar', zh: '这一周', ja: '今週' },
      { to: '/growth/goals', icon: 'flag', zh: '目标', ja: '目標', badge: '1' },
      { to: '/annual', icon: 'star', zh: '虹 2026 太鼓回顾', ja: '虹 2026 ふりかえり' },
    ],
  },
  {
    zh: '工具', ja: 'ツール',
    items: [
      { to: '/tools', icon: 'layers', zh: '查配置 · 查物量', ja: '配置・ノーツ数検索' },
      { to: '/tools/rt', icon: 'target', zh: '单曲 RT 计算器', ja: '単曲 RT 計算' },
      { to: '/tools/tja', icon: 'music', zh: 'TJA 定数与谱面图', ja: 'TJA 定数と譜面画像' },
      { to: '/dan', icon: 'trophy', zh: '段位道场', ja: '段位道場' },
    ],
  },
  {
    zh: '账号', ja: 'アカウント',
    items: [
      { to: '/account', icon: 'link', zh: '账号与绑定', ja: 'アカウント連携' },
      { to: '/account/sync', icon: 'sync', zh: '同步', ja: '同期' },
      { to: '/community/me', icon: 'community', zh: '我的社区', ja: 'マイ投稿' },
      { to: '/account/developer', icon: 'code', zh: '开发者', ja: '開発者' },
      { to: '/account/support', icon: 'help', zh: '工单支持', ja: 'サポート' },
      { to: '/account/settings', icon: 'settings', zh: '设置', ja: '設定' },
    ],
  },
]
</script>

<template>
  <div class="page me">
    <section v-if="!isAuthed" class="panel">
      <EmptyLane :title="L('登录后，这里是你的太鼓主页', 'ログインすると、ここがあなたのホームになります')" :text="L('成绩、成长档案和目标都会放在这里。', '成績・成長記録・目標がここにまとまります。')">
        <RouterLink to="/login" class="btn btn-primary">{{ L('登录', 'ログイン') }}</RouterLink>
        <RouterLink to="/login?mode=register" class="btn">{{ L('注册', '新規登録') }}</RouterLink>
      </EmptyLane>
    </section>

    <template v-else>
      <header class="who">
        <span class="avatar lg" style="background: var(--don)">年</span>
        <div class="grow">
          <h1 class="t-h1">{{ player.nickname }}</h1>
          <p class="row-wrap t-small"><span class="tag tag-roll">{{ player.title }}</span><span>{{ player.dan }}</span><span class="faint">CN {{ player.taikoIdMasked }}</span></p>
        </div>
        <RouterLink to="/u/mochidon" class="icon-btn" :aria-label="L('我的主页', 'プロフィール')"><Icon name="chevR" /></RouterLink>
      </header>

      <section v-if="isReady" class="panel glance">
        <DrumDial :value="player.rating" :size="112"><b class="num r">{{ player.rating.toFixed(2) }}</b><span class="t-caption">Rating</span></DrumDial>
        <div class="grow gl">
          <Lane :days="laneDays.slice(-10)" compact />
          <button class="btn btn-block" :disabled="store.syncing" @click="runSync">
            <Icon name="sync" :size="16" />{{ store.syncing ? L('正在同步…', '同期中…') : L(`同步成绩 · 上次 ${player.lastSync}`, `成績を同期 · 前回 ${player.lastSyncJa}`) }}
          </button>
        </div>
      </section>
      <RouterLink v-else :to="store.auth === 'unbound' ? '/bind' : '/account/sync'" class="panel todo">
        <i class="note" />
        <span class="grow"><b>{{ store.auth === 'unbound' ? L('绑定鼓众广场 ID', 'アカウントを連携') : L('同步第一份成绩', '最初の同期') }}</b><small>{{ L('完成后就能看到 Rating 和成长档案', '完了すると Rating と成長記録が見られます') }}</small></span>
        <Icon name="chevR" />
      </RouterLink>

      <div class="groups">
        <section v-for="g in GROUPS" :key="g.zh">
          <h2 class="gh">{{ L(g.zh, g.ja) }}</h2>
          <ul class="panel">
            <li v-for="it in g.items" :key="it.to">
              <RouterLink :to="it.to"><Icon :name="it.icon" /><span class="grow">{{ L(it.zh, it.ja) }}</span><b v-if="it.badge" class="num badge">{{ it.badge }}</b><Icon name="chevR" :size="16" class="go" /></RouterLink>
            </li>
          </ul>
        </section>
      </div>

      <div class="quick">
        <div class="seg">
          <button :aria-pressed="store.locale === 'zh'" @click="store.locale = 'zh'">简体中文</button>
          <button :aria-pressed="store.locale === 'ja'" @click="store.locale = 'ja'">日本語</button>
        </div>
        <div class="seg">
          <button :aria-pressed="resolvedTheme === 'light'" @click="store.theme = 'light'"><Icon name="sun" :size="16" /></button>
          <button :aria-pressed="resolvedTheme === 'dark'" @click="store.theme = 'dark'"><Icon name="moon" :size="16" /></button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.me {
  max-width: 980px;
}
.who {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}
.who p {
  margin-top: 6px;
}
.glance {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px;
}
.r {
  font-size: var(--fs-28);
  line-height: 1;
}
.gl {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.todo {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: var(--roll-wash);
  border-color: transparent;
}
.todo .note {
  --n: 20px;
}
.todo b,
.todo small {
  display: block;
}
.todo small {
  font-size: var(--fs-12);
  color: var(--ink-2);
}
.groups {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px 28px;
  margin-top: 28px;
}
.gh {
  margin: 0 0 8px 4px;
  font-size: var(--fs-13);
  font-weight: 500;
  color: var(--ink-3);
}
.groups li + li {
  border-top: 1px solid var(--line);
}
.groups a {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 52px;
  padding: 0 14px 0 16px;
  font-size: var(--fs-16);
  font-weight: 500;
}
.groups a > :first-child {
  color: var(--ink-2);
}
.groups a:hover {
  background: var(--surface-2);
}
.go {
  color: var(--ink-3);
}
.badge {
  display: grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  background: var(--don);
  color: #fff;
  font-size: 13px;
}
.quick {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 32px;
}
@media (max-width: 767px) {
  .groups {
    grid-template-columns: minmax(0, 1fr);
  }
  .glance {
    gap: 14px;
    padding: 14px;
  }
}
</style>
