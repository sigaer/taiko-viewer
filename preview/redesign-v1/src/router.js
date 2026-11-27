import { nextTick, ref, watch } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { store } from './store'

// 新信息架构：6 个一级目的地 + 账号。旧路由 → 新路由的完整映射见 docs/03-ia-mapping.md。
const pages = import.meta.glob('./views/**/*.vue')
const v = (name) => pages[`./views/${name}.vue`]

export const MODULES = {
  today: { zh: '今日', ja: '今日', icon: 'today', to: '/' },
  songs: {
    zh: '曲库', ja: '楽曲', icon: 'library', to: '/songs',
    tabs: [
      { to: '/songs', zh: '歌曲', ja: '楽曲' },
      { to: '/songs/constants', zh: '定数表', ja: '定数表' },
      { to: '/dan', zh: '段位道场', ja: '段位道場' },
      { to: '/guide', zh: '谱面攻略', ja: '譜面攻略' },
      { to: '/titles', zh: '称号', ja: '称号' },
    ],
  },
  play: {
    zh: '成绩', ja: '成績', icon: 'play', to: '/play',
    tabs: [
      { to: '/play', zh: 'Rating', ja: 'Rating' },
      { to: '/play/scores', zh: '全部成绩', ja: '全成績' },
      { to: '/play/progress', zh: '进度', ja: '進捗' },
      { to: '/play/recommend', zh: '推荐', ja: 'おすすめ' },
    ],
  },
  growth: {
    zh: '成长', ja: '成長', icon: 'growth', to: '/growth',
    tabs: [
      { to: '/growth', zh: '成长档案', ja: '成長記録' },
      { to: '/growth/weekly', zh: '这一周', ja: '今週' },
      { to: '/growth/goals', zh: '目标', ja: '目標' },
    ],
  },
  community: {
    zh: '社区', ja: 'コミュニティ', icon: 'community', to: '/community',
    tabs: [
      { to: '/community', zh: '广场', ja: '広場' },
      { to: '/community/me', zh: '我的社区', ja: 'マイ投稿' },
      { to: '/notifications', zh: '通知', ja: '通知' },
    ],
  },
  tools: { zh: '工具', ja: 'ツール', icon: 'tools', to: '/tools' },
  account: {
    zh: '账号', ja: 'アカウント', icon: 'user', to: '/account',
    tabs: [
      { to: '/account', zh: '账号与绑定', ja: 'アカウント連携' },
      { to: '/account/sync', zh: '同步', ja: '同期' },
      { to: '/account/settings', zh: '设置', ja: '設定' },
      { to: '/account/developer', zh: '开发者', ja: '開発者' },
      { to: '/account/support', zh: '工单', ja: 'サポート' },
    ],
  },
}

export const RAIL = ['today', 'songs', 'play', 'growth', 'community', 'tools']

const routes = [
  { path: '/', component: v('Today'), meta: { title: { zh: '今日', ja: '今日' }, module: 'today' } },

  { path: '/songs', component: v('Songs'), meta: { title: { zh: '曲库', ja: '楽曲' }, module: 'songs' } },
  { path: '/songs/constants', component: v('Constants'), meta: { title: { zh: '定数表', ja: '定数表' }, module: 'songs' } },
  // dock：手机上自带固定底部操作区的详情页，不显示五格底栏，顶栏多一个搜索按钮（F1）
  { path: '/songs/:id', component: v('SongDetail'), meta: { title: { zh: '歌曲详情', ja: '楽曲詳細' }, module: 'songs', back: '/songs', detail: true, dock: true } },
  { path: '/dan', component: v('Dan'), meta: { title: { zh: '段位道场', ja: '段位道場' }, module: 'songs' } },
  { path: '/guide', component: v('Guide'), meta: { title: { zh: '谱面攻略', ja: '譜面攻略' }, module: 'songs' } },
  { path: '/titles', component: v('Titles'), meta: { title: { zh: '称号', ja: '称号' }, module: 'songs' } },

  { path: '/play', component: v('Play'), meta: { title: { zh: 'Rating', ja: 'Rating' }, module: 'play', gate: true } },
  { path: '/play/scores', component: v('Scores'), meta: { title: { zh: '全部成绩', ja: '全成績' }, module: 'play', gate: true } },
  { path: '/play/progress', component: v('Progress'), meta: { title: { zh: '点灯进度', ja: '進捗' }, module: 'play', gate: true } },
  { path: '/play/recommend', component: v('Recommend'), meta: { title: { zh: '推荐', ja: 'おすすめ' }, module: 'play', gate: true } },

  { path: '/growth', component: v('Growth'), meta: { title: { zh: '成长档案', ja: '成長記録' }, module: 'growth', gate: true } },
  { path: '/growth/weekly', component: v('Weekly'), meta: { title: { zh: '这一周', ja: '今週' }, module: 'growth', gate: true } },
  { path: '/growth/goals', component: v('Goals'), meta: { title: { zh: '目标', ja: '目標' }, module: 'growth', gate: true } },

  { path: '/community', component: v('Community'), meta: { title: { zh: '社区广场', ja: 'コミュニティ' }, module: 'community' } },
  { path: '/community/t/:id', component: v('Thread'), meta: { title: { zh: '帖子', ja: '投稿' }, module: 'community', back: '/community', detail: true, dock: true } },
  { path: '/community/new', component: v('Compose'), meta: { title: { zh: '发布新帖', ja: '新規投稿' }, module: 'community', back: '/community', detail: true, bareMobile: true } },
  { path: '/community/me', component: v('CommunityMe'), meta: { title: { zh: '我的社区', ja: 'マイ投稿' }, module: 'community' } },
  { path: '/notifications', component: v('Notifications'), meta: { title: { zh: '通知', ja: '通知' }, module: 'community' } },

  { path: '/tools', component: v('Tools'), meta: { title: { zh: '工具', ja: 'ツール' }, module: 'tools' } },
  { path: '/tools/rt', component: v('ToolRt'), meta: { title: { zh: '单曲 RT 计算器', ja: '単曲 RT 計算機' }, module: 'tools', back: '/tools', detail: true } },
  { path: '/tools/tja', component: v('ToolTja'), meta: { title: { zh: 'TJA 定数与谱面图', ja: 'TJA 定数・譜面画像' }, module: 'tools', back: '/tools', detail: true } },
  { path: '/annual', component: v('Annual'), meta: { title: { zh: '年度回顾', ja: '年間まとめ' }, module: 'growth', back: '/', detail: true } },

  { path: '/me', component: v('Me'), meta: { title: { zh: '我的', ja: 'マイページ' }, module: 'me' } },
  { path: '/u/:name', component: v('Profile'), meta: { title: { zh: '个人主页', ja: 'プロフィール' }, module: 'community', back: '/community', detail: true } },
  { path: '/account', component: v('Account'), meta: { title: { zh: '账号与绑定', ja: 'アカウント連携' }, module: 'account' } },
  { path: '/account/sync', component: v('Sync'), meta: { title: { zh: '同步', ja: '同期' }, module: 'account' } },
  { path: '/account/settings', component: v('Settings'), meta: { title: { zh: '设置', ja: '設定' }, module: 'account' } },
  { path: '/account/developer', component: v('Developer'), meta: { title: { zh: '开发者', ja: '開発者' }, module: 'account' } },
  { path: '/account/support', component: v('Support'), meta: { title: { zh: '工单', ja: 'サポート' }, module: 'account' } },

  { path: '/login', component: v('Login'), meta: { title: { zh: '登录', ja: 'ログイン' }, bare: true } },
  { path: '/bind', component: v('Bind'), meta: { title: { zh: '绑定鼓众广场 ID', ja: 'アカウント連携' }, bare: true } },
  { path: '/states', component: v('States'), meta: { title: { zh: '状态', ja: '状態' }, module: 'tools', back: '/review', detail: true } },

  // 设计评审入口（不属于产品本身）
  { path: '/review', component: v('review/Hub'), meta: { title: { zh: '设计总览', ja: 'デザイン概要' }, bare: true } },
  { path: '/review/directions', component: v('review/Directions'), meta: { title: { zh: '设计方向', ja: 'デザイン方向' }, bare: true } },
  { path: '/review/system', component: v('review/System'), meta: { title: { zh: 'Design System', ja: 'Design System' }, bare: true } },
  { path: '/review/device', component: v('review/Device'), meta: { title: { zh: '手机预览', ja: '端末プレビュー' }, bare: true } },
  { path: '/review/assets', component: v('review/Assets'), meta: { title: { zh: '素材页', ja: '素材' }, bare: true } },
  { path: '/review/compare', component: v('review/Compare'), meta: { title: { zh: '三版对照', ja: '3 案比較' }, bare: true } },

  { path: '/:rest(.*)*', component: v('NotFound'), meta: { title: { zh: '页面不存在', ja: 'ページが見つかりません' }, module: 'today' } },
]

const nextFrame = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)))

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  // R3：后退 / 前进还原滚动位置（等下一帧，列表已按行数撑开高度）；只改查询参数不滚动；新导航与换对象（:id）回到顶部
  async scrollBehavior(to, from, saved) {
    if (saved) {
      await nextFrame()
      return { ...saved, behavior: 'instant' }
    }
    if (to.path === from.path) return false
    return { top: 0, behavior: 'instant' }
  },
})

/** 页面名（用于 document.title 与路由播报）。 */
export function routeTitle(route, locale = store.locale) {
  const t = route.meta?.title
  if (!t) return 'Taiko Viewer'
  return locale === 'ja' ? t.ja : t.zh
}

/**
 * R4：详情页的返回目标。有站内历史时走 history.back()（回到带着筛选的列表），否则回到模块首页 meta.back。
 * 返回 { history: boolean, to: string }；返回按钮用 `to` 作 href，点击时 history 为 true 就 router.back()。
 */
export function backTarget(route) {
  const to = route.meta?.back || '/'
  let back = null
  try {
    back = window.history.state?.back ?? null
  } catch {
    back = null
  }
  return { history: typeof back === 'string' && back.startsWith('/') && back !== route.fullPath, to }
}

/** 路由播报：AppShell 里的 aria-live 区域读这个值（P8 / D6）。 */
export const routeAnnouncement = ref('')

function setDocTitle(route) {
  document.title = route.meta?.title ? `${routeTitle(route)} · Taiko Viewer` : 'Taiko Viewer'
}
router.afterEach((to, from, failure) => {
  if (failure) return
  setDocTitle(to)
  // 首次进入、同一路径只改查询参数（换难度、筛选）时不移动焦点也不播报
  if (!from.matched.length || to.path === from.path) return
  routeAnnouncement.value = ''
  nextTick(() => {
    routeAnnouncement.value = routeTitle(to)
    const main = document.getElementById('main')
    if (main && !main.contains(document.activeElement)) main.focus({ preventScroll: true })
  })
})
watch(
  () => store.locale,
  () => setDocTitle(router.currentRoute.value),
)
