<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from './Icon.vue'
import Logo from './Logo.vue'
import { MODULES, RAIL } from '../router'
import { store, L, isAuthed, runSync, resolvedTheme } from '../store'
import { player, notifications } from '../mock/data'

// 全站框架。
// 桌面：左侧窄轨（一级目的地）+ 顶栏（模块名 · 二级页签 · 全局搜索 · 同步 · 通知 · 账号）。
// 移动：顶部标题栏 + 底部五格，其中正中是「咚」搜索键。
const route = useRoute()
const router = useRouter()
const mod = computed(() => MODULES[route.meta.module])
const tabs = computed(() => (route.meta.detail ? null : mod.value?.tabs))
const unread = computed(() => notifications.filter((n) => n.unread).length)
const menuOpen = ref(false)

const title = computed(() => {
  if (route.meta.module === 'me') return L('我的', 'マイページ')
  return mod.value ? L(mod.value.zh, mod.value.ja) : 'Taiko Viewer'
})
function isActive(key) {
  return route.meta.module === key
}
function tabActive(t) {
  return route.path === t.to
}
function toggleTheme() {
  store.theme = resolvedTheme.value === 'dark' ? 'light' : 'dark'
}
function go(to) {
  menuOpen.value = false
  router.push(to)
}

const MOBILE_TABS = [
  { key: 'today', to: '/', icon: 'today', zh: '今日', ja: '今日' },
  { key: 'songs', to: '/songs', icon: 'library', zh: '曲库', ja: '楽曲' },
  { key: 'search' },
  { key: 'community', to: '/community', icon: 'community', zh: '社区', ja: '広場' },
  { key: 'me', to: '/me', icon: 'user', zh: '我的', ja: 'マイ' },
]
function mobileActive(t) {
  const m = route.meta.module
  if (t.key === 'me') return ['me', 'play', 'growth', 'account', 'tools'].includes(m)
  return m === t.key
}
</script>

<template>
  <div class="shell">
    <!-- ============ 桌面：左轨 ============ -->
    <nav class="rail" :aria-label="L('主导航', 'メインナビ')">
      <RouterLink to="/" class="brand" aria-label="Taiko Viewer"><Logo :size="38" /></RouterLink>
      <ul class="rail-list">
        <li v-for="key in RAIL" :key="key">
          <RouterLink :to="MODULES[key].to" class="rail-item" :class="{ on: isActive(key) }" :aria-current="isActive(key) ? 'page' : undefined">
            <span class="pill"><Icon :name="MODULES[key].icon" :size="22" /></span>
            <span class="lbl">{{ L(MODULES[key].zh, MODULES[key].ja) }}</span>
          </RouterLink>
        </li>
      </ul>
      <div class="rail-foot">
        <button class="icon-btn" :title="L('切换语言', '言語切替')" @click="store.locale = store.locale === 'zh' ? 'ja' : 'zh'">
          <span class="loc">{{ store.locale === 'zh' ? '中' : '日' }}</span>
        </button>
        <button class="icon-btn" :title="L('切换深浅色', 'テーマ切替')" @click="toggleTheme">
          <Icon :name="resolvedTheme === 'dark' ? 'sun' : 'moon'" />
        </button>
      </div>
    </nav>

    <!-- ============ 顶栏 ============ -->
    <header class="bar">
      <div class="bar-left">
        <RouterLink v-if="route.meta.back" :to="route.meta.back" class="icon-btn back" :aria-label="L('返回', '戻る')"><Icon name="chevL" /></RouterLink>
        <RouterLink v-else to="/" class="only-mobile m-brand" aria-label="Taiko Viewer"><Logo :size="28" /></RouterLink>
        <h1 class="bar-title">{{ title }}</h1>
        <nav v-if="tabs" class="bar-tabs only-desktop" :aria-label="title">
          <RouterLink v-for="t in tabs" :key="t.to" :to="t.to" :class="{ on: tabActive(t) }">{{ L(t.zh, t.ja) }}</RouterLink>
        </nav>
      </div>

      <button class="searchbox only-desktop" @click="store.paletteOpen = true">
        <Icon name="search" :size="18" />
        <span class="grow">{{ L('搜索歌曲、帖子、工具', '楽曲・投稿・ツールを検索') }}</span>
        <kbd>Ctrl K</kbd>
      </button>

      <div class="bar-right">
        <template v-if="store.auth === 'ready'">
          <button class="syncchip only-desktop" :class="{ busy: store.syncing }" :disabled="store.syncing" @click="runSync">
            <Icon name="sync" :size="16" />
            <span>{{ store.syncing ? L('正在同步…', '同期中…') : L(player.lastSync + '同步', player.lastSyncJa + 'に同期') }}</span>
          </button>
        </template>
        <RouterLink v-else-if="store.auth === 'unbound'" to="/bind" class="syncchip warn only-desktop">
          <Icon name="link" :size="16" /><span>{{ L('绑定鼓众广场 ID', 'アカウント連携') }}</span>
        </RouterLink>
        <RouterLink v-else-if="store.auth === 'empty'" to="/account/sync" class="syncchip warn only-desktop">
          <Icon name="sync" :size="16" /><span>{{ L('同步第一份成绩', '最初の同期') }}</span>
        </RouterLink>

        <RouterLink v-if="isAuthed" to="/notifications" class="icon-btn bell" :aria-label="L('通知', '通知')">
          <Icon name="bell" />
          <i v-if="unread" class="badge num">{{ unread }}</i>
        </RouterLink>

        <div v-if="isAuthed" class="acct">
          <button class="avatar-btn" :aria-expanded="menuOpen" aria-haspopup="menu" @click="menuOpen = !menuOpen">
            <span class="avatar" style="background: var(--don)">年</span>
          </button>
          <Transition name="pop">
            <div v-if="menuOpen" class="menu" role="menu" @mouseleave="menuOpen = false">
              <div class="menu-head">
                <b>{{ player.nickname }}</b>
                <span class="t-caption">CN {{ player.taikoIdMasked }}</span>
              </div>
              <button role="menuitem" @click="go('/u/mochidon')"><Icon name="user" :size="18" />{{ L('我的主页', 'プロフィール') }}</button>
              <button role="menuitem" @click="go('/account')"><Icon name="link" :size="18" />{{ L('账号与绑定', 'アカウント連携') }}</button>
              <button role="menuitem" @click="go('/account/sync')"><Icon name="sync" :size="18" />{{ L('同步', '同期') }}</button>
              <button role="menuitem" @click="go('/account/settings')"><Icon name="settings" :size="18" />{{ L('设置', '設定') }}</button>
              <hr class="rule" />
              <button role="menuitem" @click="(store.auth = 'guest'), go('/')"><Icon name="logout" :size="18" />{{ L('退出登录', 'ログアウト') }}</button>
            </div>
          </Transition>
        </div>
        <RouterLink v-else to="/login" class="btn btn-ink btn-sm">{{ L('登录', 'ログイン') }}</RouterLink>
      </div>
    </header>

    <!-- 移动端二级页签 -->
    <nav v-if="tabs" class="m-tabs only-mobile" :aria-label="title">
      <RouterLink v-for="t in tabs" :key="t.to" :to="t.to" :class="{ on: tabActive(t) }">{{ L(t.zh, t.ja) }}</RouterLink>
    </nav>

    <main class="main"><slot /></main>

    <!-- ============ 移动：底部五格 ============ -->
    <nav v-if="!route.meta.bareMobile" class="tabbar" :aria-label="L('主导航', 'メインナビ')">
      <template v-for="t in MOBILE_TABS" :key="t.key">
        <button v-if="t.key === 'search'" class="don-btn" :aria-label="L('搜索', '検索')" @click="store.paletteOpen = true">
          <span class="don-face"><Icon name="search" :size="24" /></span>
        </button>
        <RouterLink v-else :to="t.to" class="tab" :class="{ on: mobileActive(t) }">
          <Icon :name="t.icon" :size="23" />
          <span>{{ L(t.zh, t.ja) }}</span>
          <i v-if="t.key === 'community' && unread && isAuthed" class="tab-dot" />
        </RouterLink>
      </template>
    </nav>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100dvh;
  padding-left: var(--rail-w);
}

/* ---------- Rail ---------- */
.rail {
  position: fixed;
  z-index: var(--z-rail);
  inset: 0 auto 0 0;
  width: var(--rail-w);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0 14px;
  background: var(--surface);
  border-right: 1px solid var(--line);
}
.brand {
  display: grid;
  place-items: center;
  height: 44px;
  margin-bottom: 14px;
  border-radius: 50%;
}
.rail-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}
.rail-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 6px 0;
  color: var(--ink-2);
  font-size: var(--fs-12);
  font-weight: 500;
}
.rail-item .lbl {
  max-width: calc(var(--rail-w) - 8px);
  white-space: nowrap;
}
.rail-item:lang(ja) {
  font-size: 11px;
  letter-spacing: -0.02em;
}
.rail-item .pill {
  display: grid;
  place-items: center;
  width: 52px;
  height: 34px;
  border-radius: var(--r-note);
  transition: background var(--dur-1), color var(--dur-1);
}
.rail-item:hover .pill {
  background: var(--bg-sunk);
  color: var(--ink);
}
.rail-item.on {
  color: var(--ink);
  font-weight: 700;
}
.rail-item.on .pill {
  background: var(--ink);
  color: var(--bg);
}
.rail-item:focus-visible {
  box-shadow: none;
}
.rail-item:focus-visible .pill {
  box-shadow: var(--focus);
}
.rail-foot {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.loc {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: 1.5px solid currentColor;
  border-radius: var(--r-xs);
  font-size: var(--fs-12);
  font-weight: 700;
}

/* ---------- Bar ---------- */
.bar {
  position: sticky;
  top: 0;
  z-index: var(--z-bar);
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  height: var(--bar-h);
  padding: 0 var(--gutter);
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: saturate(1.4) blur(14px);
  -webkit-backdrop-filter: saturate(1.4) blur(14px);
  border-bottom: 1px solid var(--line);
}
.bar-left {
  display: flex;
  align-items: center;
  gap: var(--sp-5);
  min-width: 0;
  flex: 1;
  height: 100%;
}
.bar-left .back {
  margin: 0 -12px 0 -10px;
}
.bar-title {
  font-size: var(--fs-18);
  font-weight: 900;
  white-space: nowrap;
}
.bar-tabs {
  display: flex;
  gap: 4px;
  height: 100%;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}
.bar-tabs::-webkit-scrollbar {
  display: none;
}
.bar-tabs a {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0 10px;
  font-size: var(--fs-14);
  font-weight: 500;
  color: var(--ink-2);
  white-space: nowrap;
}
.bar-tabs a:hover {
  color: var(--ink);
}
.bar-tabs a.on {
  color: var(--ink);
  font-weight: 700;
}
.bar-tabs a.on::after {
  content: '';
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: -1px;
  height: 3px;
  border-radius: 3px 3px 0 0;
  background: var(--don);
}
.searchbox {
  display: flex;
  align-items: center;
  gap: 8px;
  width: clamp(200px, 26vw, 360px);
  height: 38px;
  padding: 0 8px 0 12px;
  border-radius: var(--r-note);
  background: var(--surface);
  border: 1px solid var(--line-strong);
  color: var(--ink-3);
  font-size: var(--fs-13);
  text-align: left;
  transition: border-color var(--dur-1);
}
.searchbox:hover {
  border-color: var(--ink-3);
}
.searchbox .grow {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
kbd {
  padding: 2px 7px;
  border-radius: var(--r-note);
  background: var(--bg-sunk);
  font-family: var(--font-num);
  font-size: var(--fs-12);
  font-weight: 600;
  color: var(--ink-2);
  white-space: nowrap;
}
.bar-right {
  display: flex;
  align-items: center;
  gap: 6px;
}
.syncchip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border-radius: var(--r-note);
  font-size: var(--fs-13);
  font-weight: 500;
  color: var(--ink-2);
  white-space: nowrap;
}
.syncchip:hover {
  background: var(--bg-sunk);
  color: var(--ink);
}
.syncchip.busy {
  color: var(--ka-ink);
}
.syncchip.busy :deep(svg) {
  animation: spin 0.9s linear infinite;
}
.syncchip.warn {
  background: var(--roll-wash);
  color: var(--roll-ink);
  font-weight: 700;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.bell {
  position: relative;
}
.badge {
  position: absolute;
  top: 4px;
  right: 3px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--don);
  color: var(--ink-inv);
  font-size: 11px;
  font-style: normal;
  line-height: 16px;
  text-align: center;
  box-shadow: 0 0 0 2px var(--bg);
}
.acct {
  position: relative;
}
.avatar-btn {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
}
.avatar-btn .avatar {
  /* 头像底色是 --don：深色主题下白字对比不足，跟随 --ink-inv */
  color: var(--ink-inv);
}
.menu {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  width: 220px;
  padding: 6px;
  background: var(--surface);
  border-radius: var(--r-panel);
  box-shadow: var(--shadow-pop);
  z-index: 5;
}
.menu-head {
  display: flex;
  flex-direction: column;
  padding: 8px 10px 10px;
}
.menu button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 38px;
  padding: 0 10px;
  border-radius: var(--r-ctl);
  font-size: var(--fs-14);
  color: var(--ink-2);
  text-align: left;
}
.menu button:hover {
  background: var(--bg-sunk);
  color: var(--ink);
}
.menu .rule {
  margin: 6px 0;
}

.main {
  min-width: 0;
}
.tabbar,
.m-tabs {
  display: none;
}

/* ---------- 平板：保留左轨，收窄 ---------- */
@media (max-width: 1099px) {
  .searchbox {
    width: 38px;
    padding: 0;
    justify-content: center;
  }
  .searchbox .grow,
  .searchbox kbd {
    display: none;
  }
  .syncchip span {
    display: none;
  }
}

/* ---------- 手机 ---------- */
@media (max-width: 767px) {
  .shell {
    padding-left: 0;
    padding-bottom: calc(var(--tab-h) + env(safe-area-inset-bottom));
  }
  .rail {
    display: none;
  }
  .bar {
    height: 52px;
    gap: var(--sp-2);
    padding-right: 8px;
  }
  .bar-left {
    gap: 10px;
  }
  .bar-left .back {
    margin: 0 -6px 0 -12px;
  }
  .m-brand {
    display: grid !important;
    place-items: center;
  }
  .m-tabs {
    position: sticky;
    top: 52px;
    z-index: calc(var(--z-bar) - 1);
    display: flex;
    gap: 2px;
    padding: 0 8px;
    overflow-x: auto;
    scrollbar-width: none;
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--line);
  }
  .m-tabs::-webkit-scrollbar {
    display: none;
  }
  .m-tabs a {
    position: relative;
    padding: 11px 10px 12px;
    font-size: var(--fs-14);
    font-weight: 500;
    color: var(--ink-2);
    white-space: nowrap;
  }
  .m-tabs a.on {
    color: var(--ink);
    font-weight: 700;
  }
  .m-tabs a.on::after {
    content: '';
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: -1px;
    height: 3px;
    border-radius: 3px 3px 0 0;
    background: var(--don);
  }
  .menu {
    position: fixed;
    top: 56px;
    right: 8px;
  }
  .tabbar {
    position: fixed;
    z-index: var(--z-bar);
    inset: auto 0 0 0;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    align-items: center;
    height: calc(var(--tab-h) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: color-mix(in srgb, var(--surface) 94%, transparent);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-top: 1px solid var(--line);
  }
  .tab {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    height: 100%;
    justify-content: center;
    font-size: var(--fs-11);
    font-weight: 500;
    color: var(--ink-3);
  }
  .tab.on {
    color: var(--ink);
    font-weight: 700;
  }
  .tab-dot {
    position: absolute;
    top: 10px;
    left: calc(50% + 8px);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--don);
    box-shadow: 0 0 0 2px var(--surface);
  }
  .don-btn {
    display: grid;
    place-items: center;
    height: 100%;
  }
  .don-face {
    display: grid;
    place-items: center;
    width: 54px;
    height: 54px;
    margin-top: -18px;
    border-radius: 50%;
    background: var(--don);
    color: var(--lane-ring);
    box-shadow: inset 0 0 0 4px color-mix(in srgb, var(--lane-ring) 92%, transparent), 0 0 0 2px var(--lane-outline), var(--shadow-lift);
    transition: transform var(--dur-2) var(--ease-hit);
  }
  .don-btn:active .don-face {
    transform: scale(0.9);
  }
}
</style>
