<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from './Icon.vue'
import Logo from './Logo.vue'
import Sheet from './Sheet.vue'
import SyncButton from './SyncButton.vue'
import SyncPanel from './SyncPanel.vue'
import { MODULES, RAIL, backTarget, routeAnnouncement } from '../router'
import { store, L, isAuthed, resolvedTheme, viewport } from '../store'
import { sync, closeSyncPanel } from '../sync'
import { player, users, notifications } from '../mock/data'
import PlayerAvatar from './PlayerAvatar.vue'

// 全站框架。
// 桌面：左侧窄轨（一级目的地）+ 顶栏（模块名 · 二级页签 · 全局搜索 · 同步 · 通知 · 账号）。
// 移动：顶部标题栏（右侧：同步 · 通知）+ 底部五格，其中正中是「咚」搜索键。
const route = useRoute()
const router = useRouter()
const mod = computed(() => MODULES[route.meta.module])
const tabs = computed(() => (route.meta.detail ? null : mod.value?.tabs))
const unread = computed(() => notifications.filter((n) => n.unread).length)
const me = users.mochidon || { name: player.nickname, hue: 12, dan: player.dan }

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

/* ---------- 跳到主要内容 ---------- */
const mainEl = ref(null)
function focusMain() {
  mainEl.value?.focus({ preventScroll: false })
}

/* ---------- 手机底栏（F1）：自带固定底部操作区的详情页（meta.dock）与全屏页（meta.bareMobile）不显示 ---------- */
const showTabbar = computed(() => !route.meta.bareMobile && !route.meta.dock)
const dock = computed(() => !!route.meta.dock)
// 只在手机宽度写根元素属性：根元素上的属性变化会让整页重算样式，桌面上没必要付这笔开销
watch(
  () => [showTabbar.value, viewport.phone],
  ([v, phone]) => {
    const de = document.documentElement
    const want = phone ? (v ? 'on' : 'off') : undefined
    if (de.dataset.tabbar === want) return
    if (want) de.dataset.tabbar = want
    else delete de.dataset.tabbar
  },
  { immediate: true },
)
onBeforeUnmount(() => delete document.documentElement.dataset.tabbar)

/* ---------- 返回（R4） ---------- */
const back = computed(() => (route.meta.back ? backTarget(route) : null))
function onBack(e) {
  if (back.value?.history) {
    e.preventDefault()
    router.back()
  }
}

/* ---------- 账号菜单：Esc 关闭并还原焦点，↑ ↓ 在菜单项间移动，点外面关闭 ---------- */
const menuOpen = ref(false)
const acctEl = ref(null)
const menuBtn = ref(null)
const menuEl = ref(null)
const items = () => [...(menuEl.value?.querySelectorAll('[role="menuitem"]') || [])]
function openMenu(focusLast = false) {
  menuOpen.value = true
  nextTick(() => {
    const list = items()
    ;(focusLast ? list[list.length - 1] : list[0])?.focus()
  })
}
function closeMenu(restore = false) {
  if (!menuOpen.value) return
  menuOpen.value = false
  if (restore) nextTick(() => menuBtn.value?.focus())
}
function onMenuBtnKey(e) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    openMenu(e.key === 'ArrowUp')
  }
}
function onMenuKey(e) {
  const list = items()
  const i = list.indexOf(document.activeElement)
  if (e.key === 'Escape') {
    e.preventDefault()
    closeMenu(true)
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    list[(i + 1) % list.length]?.focus()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    list[(i - 1 + list.length) % list.length]?.focus()
  } else if (e.key === 'Home') {
    e.preventDefault()
    list[0]?.focus()
  } else if (e.key === 'End') {
    e.preventDefault()
    list[list.length - 1]?.focus()
  } else if (e.key === 'Tab') closeMenu(false)
}
function onDocPointer(e) {
  if (acctEl.value && !acctEl.value.contains(e.target)) closeMenu(false)
}
watch(menuOpen, (v) => {
  if (v) document.addEventListener('pointerdown', onDocPointer, true)
  else document.removeEventListener('pointerdown', onDocPointer, true)
})
function go(to) {
  closeMenu(false)
  router.push(to)
}
function logout() {
  closeMenu(false)
  store.auth = 'guest'
  router.push('/')
}

/* ---------- 同步面板：手机放进抽屉；桌面锚在状态条下（SyncButton 内）；游客在桌面没有状态条，用对话框 ---------- */
const sheetOpen = computed(() => sync.panelOpen && (viewport.phone || store.auth === 'guest'))

/* ---------- 手机二级页签：当前项保持在可视区 ---------- */
const mTabs = ref(null)
function revealTab() {
  const box = mTabs.value
  const on = box?.querySelector('a.on')
  if (!box || !on) return
  const l = on.offsetLeft
  const r = l + on.offsetWidth
  if (l < box.scrollLeft + 8) box.scrollLeft = Math.max(0, l - 24)
  else if (r > box.scrollLeft + box.clientWidth - 8) box.scrollLeft = r - box.clientWidth + 24
}

// 路由切换：关闭菜单与同步面板，页签滚入可视区
watch(
  () => route.path,
  () => {
    closeMenu(false)
    if (sync.panelOpen) closeSyncPanel()
    nextTick(revealTab)
  },
)
watch(mTabs, (el) => el && nextTick(revealTab))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocPointer, true))

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
  <div class="shell" :class="{ dock }">
    <a href="#main" class="skip" @click.prevent="focusMain">{{ L('跳到主要内容', 'メインコンテンツへ移動') }}</a>
    <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">{{ routeAnnouncement }}</div>

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
        <button type="button" class="icon-btn" :aria-label="L('切换语言', '言語切替')" :title="L('切换语言', '言語切替')" @click="store.locale = store.locale === 'zh' ? 'ja' : 'zh'">
          <span class="loc">{{ store.locale === 'zh' ? '中' : '日' }}</span>
        </button>
        <button type="button" class="icon-btn" :aria-label="L('切换深浅色', 'テーマ切替')" :title="L('切换深浅色', 'テーマ切替')" @click="toggleTheme">
          <Icon :name="resolvedTheme === 'dark' ? 'sun' : 'moon'" />
        </button>
      </div>
    </nav>

    <!-- ============ 顶栏 ============ -->
    <header class="bar">
      <div class="bar-left">
        <RouterLink v-if="back" :to="back.to" class="icon-btn back" :aria-label="L('返回', '戻る')" @click="onBack"><Icon name="chevL" /></RouterLink>
        <RouterLink v-else to="/" class="only-mobile m-brand" aria-label="Taiko Viewer"><Logo :size="28" /></RouterLink>
        <h1 class="bar-title">{{ title }}</h1>
        <nav v-if="tabs" class="bar-tabs only-desktop" :aria-label="L(`${title}页签`, `${title}のタブ`)">
          <RouterLink v-for="t in tabs" :key="t.to" :to="t.to" :class="{ on: tabActive(t) }" :aria-current="tabActive(t) ? 'page' : undefined">{{ L(t.zh, t.ja) }}</RouterLink>
        </nav>
      </div>

      <button type="button" class="searchbox only-desktop" :aria-label="L('搜索', '検索')" aria-keyshortcuts="Control+K" @click="store.paletteOpen = true">
        <Icon name="search" :size="18" />
        <span class="grow">{{ L('搜索歌曲、帖子、工具', '楽曲・投稿・ツールを検索') }}</span>
        <kbd>Ctrl K</kbd>
      </button>

      <div class="bar-right">
        <!-- F1.2：没有底栏的手机详情页，搜索放进顶栏（打开与「咚」相同的全屏搜索） -->
        <button v-if="dock" type="button" class="icon-btn only-mobile m-search" :aria-label="L('搜索', '検索')" @click="store.paletteOpen = true"><Icon name="search" /></button>
        <!-- 同步：手机是图标按钮（S2），平板 / 桌面是状态条（S4） -->
        <SyncButton variant="icon" class="only-mobile m-sync" />
        <SyncButton v-if="store.auth !== 'guest'" variant="chip" class="only-desktop" />

        <RouterLink v-if="isAuthed || viewport.phone" to="/notifications" class="icon-btn bell" :aria-label="unread && isAuthed ? L(`通知，${unread} 条未读`, `通知（未読 ${unread} 件）`) : L('通知', '通知')">
          <Icon name="bell" />
          <i v-if="unread && isAuthed" class="badge num" aria-hidden="true">{{ unread }}</i>
        </RouterLink>

        <!-- 账号菜单只在平板 / 桌面；手机的账号入口是底栏「我的」 -->
        <div v-if="isAuthed" ref="acctEl" class="acct only-desktop">
          <button
            ref="menuBtn"
            type="button"
            class="avatar-btn"
            :aria-label="L('账号菜单', 'アカウントメニュー')"
            :aria-expanded="menuOpen"
            aria-haspopup="menu"
            aria-controls="acct-menu"
            @click="menuOpen ? closeMenu(false) : openMenu()"
            @keydown="onMenuBtnKey"
          >
            <PlayerAvatar :user="me" :size="32" />
          </button>
          <Transition name="pop">
            <div v-if="menuOpen" id="acct-menu" ref="menuEl" class="menu" role="menu" :aria-label="player.nickname" @keydown="onMenuKey">
              <div class="menu-head" role="presentation">
                <b>{{ player.nickname }}</b>
                <span class="t-caption">CN {{ player.taikoIdMasked }}</span>
              </div>
              <button type="button" role="menuitem" tabindex="-1" @click="go('/u/mochidon')"><Icon name="user" :size="18" />{{ L('我的主页', 'プロフィール') }}</button>
              <button type="button" role="menuitem" tabindex="-1" @click="go('/account')"><Icon name="link" :size="18" />{{ L('账号与绑定', 'アカウント連携') }}</button>
              <button type="button" role="menuitem" tabindex="-1" @click="go('/account/sync')"><Icon name="sync" :size="18" />{{ L('同步', '同期') }}</button>
              <button type="button" role="menuitem" tabindex="-1" @click="go('/account/settings')"><Icon name="settings" :size="18" />{{ L('设置', '設定') }}</button>
              <hr class="rule" role="separator" />
              <button type="button" role="menuitem" tabindex="-1" @click="logout"><Icon name="logout" :size="18" />{{ L('退出登录', 'ログアウト') }}</button>
            </div>
          </Transition>
        </div>
        <RouterLink v-else to="/login" class="btn btn-ink btn-sm only-desktop">{{ L('登录', 'ログイン') }}</RouterLink>
      </div>
    </header>

    <!-- 移动端二级页签 -->
    <nav v-if="tabs" ref="mTabs" class="m-tabs only-mobile" :aria-label="L(`${title}页签`, `${title}のタブ`)">
      <RouterLink v-for="t in tabs" :key="t.to" :to="t.to" :class="{ on: tabActive(t) }" :aria-current="tabActive(t) ? 'page' : undefined">{{ L(t.zh, t.ja) }}</RouterLink>
    </nav>

    <main id="main" ref="mainEl" class="main" tabindex="-1"><slot /></main>

    <!-- ============ 移动：底部五格 ============ -->
    <nav v-if="showTabbar" class="tabbar" :aria-label="L('底部导航', 'ボトムナビ')">
      <template v-for="t in MOBILE_TABS" :key="t.key">
        <button v-if="t.key === 'search'" type="button" class="don-btn" :aria-label="L('搜索', '検索')" @click="store.paletteOpen = true">
          <span class="don-face"><Icon name="search" :size="24" /></span>
        </button>
        <RouterLink v-else :to="t.to" class="tab" :class="{ on: mobileActive(t) }" :aria-current="mobileActive(t) ? 'page' : undefined">
          <Icon :name="t.icon" :size="23" />
          <span>{{ L(t.zh, t.ja) }}</span>
          <i v-if="t.key === 'community' && unread && isAuthed" class="tab-dot" />
        </RouterLink>
      </template>
    </nav>

    <Sheet :open="sheetOpen" :title="L('同步', '同期')" :width="420" @close="closeSyncPanel">
      <SyncPanel @close="closeSyncPanel" />
    </Sheet>
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
  color: var(--nav-active-text);
  font-weight: 700;
}
.rail-item.on .pill {
  background: var(--nav-active-bg);
  color: var(--nav-active-ink);
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
  background: var(--tab-line);
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
.menu {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  width: 220px;
  padding: var(--overlay-pad-sm);
  background: var(--overlay-bg);
  border-radius: var(--overlay-radius);
  box-shadow: var(--overlay-shadow), 0 0 0 1px var(--overlay-line);
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
.main:focus {
  outline: none;
  box-shadow: none;
}
.skip {
  position: fixed;
  z-index: calc(var(--z-toast) + 1);
  top: 8px;
  left: 8px;
  padding: 10px 16px;
  border-radius: var(--r-ctl);
  background: var(--ink);
  color: var(--bg);
  font-size: var(--fs-14);
  font-weight: 700;
  transform: translateY(calc(-100% - 16px));
}
.skip:focus {
  transform: none;
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
}

/* ---------- 手机 ---------- */
@media (max-width: 767px) {
  .shell {
    padding-left: 0;
    padding-bottom: var(--shell-bottom);
  }
  /* F1.3：有固定底部操作区的详情页，正文底部留出它的实际高度 + 16px，最后一行内容滚到底时完全露出 */
  .shell.dock .main {
    padding-bottom: calc(var(--dock-h) + 16px);
  }
  .rail {
    display: none;
  }
  .bar {
    height: var(--bar-h-m);
    gap: var(--sp-2);
    padding-right: 8px;
  }
  .bar-left {
    gap: 10px;
  }
  .bar-right {
    gap: 0;
    flex: none;
  }
  /* F1.2：返回 · 标题 · 搜索 · 同步 · 通知，三个图标按钮 44×44、间距 ≥ 6px */
  .shell.dock .bar-right {
    gap: 6px;
  }
  /* F1.2：标题单行，放不下时截断，三个图标按钮始终完整可点 */
  .bar-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .m-search {
    display: inline-grid !important;
    place-items: center;
  }
  .bar-right .icon-btn {
    width: 44px;
    height: 44px;
  }
  /* .only-mobile 用 display: revert，按钮要保持图标居中 */
  .m-sync {
    display: inline-grid !important;
  }
  .bar-left .back {
    margin: 0 -6px 0 -12px;
  }
  .m-brand {
    display: grid !important;
    place-items: center;
    /* D7：可点区域 44px；负外边距让 28px 标志保持原位 */
    width: var(--hit);
    height: var(--hit);
    margin: 0 -8px;
  }
  .m-tabs {
    position: sticky;
    top: var(--bar-h-m);
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
    /* D9：二级页签条高 --subtab-h-m（44px），也是可点高度 */
    display: inline-flex;
    align-items: center;
    min-height: var(--subtab-h-m);
    padding: 0 10px;
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
    background: var(--tab-line);
  }
  .menu {
    position: fixed;
    top: calc(var(--bar-h-m) + 4px);
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
    color: var(--nav-active-text);
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
    color: var(--note-ring);
    box-shadow: inset 0 0 0 4px color-mix(in srgb, var(--note-ring) 92%, transparent), 0 0 0 2px var(--note-outline), var(--shadow-lift);
    transition: transform var(--dur-2) var(--ease-hit);
  }
  .don-btn:active .don-face {
    transform: scale(0.9);
  }
}
</style>
