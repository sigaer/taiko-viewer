import { createRouter, createWebHashHistory } from 'vue-router'

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
  { path: '/', component: v('Today'), meta: { module: 'today' } },

  { path: '/songs', component: v('Songs'), meta: { module: 'songs' } },
  { path: '/songs/constants', component: v('Constants'), meta: { module: 'songs' } },
  { path: '/songs/:id', component: v('SongDetail'), meta: { module: 'songs', back: '/songs', detail: true } },
  { path: '/dan', component: v('Dan'), meta: { module: 'songs' } },
  { path: '/guide', component: v('Guide'), meta: { module: 'songs' } },
  { path: '/titles', component: v('Titles'), meta: { module: 'songs' } },

  { path: '/play', component: v('Play'), meta: { module: 'play', gate: true } },
  { path: '/play/scores', component: v('Scores'), meta: { module: 'play', gate: true } },
  { path: '/play/progress', component: v('Progress'), meta: { module: 'play', gate: true } },
  { path: '/play/recommend', component: v('Recommend'), meta: { module: 'play', gate: true } },

  { path: '/growth', component: v('Growth'), meta: { module: 'growth', gate: true } },
  { path: '/growth/weekly', component: v('Weekly'), meta: { module: 'growth', gate: true } },
  { path: '/growth/goals', component: v('Goals'), meta: { module: 'growth', gate: true } },

  { path: '/community', component: v('Community'), meta: { module: 'community' } },
  { path: '/community/t/:id', component: v('Thread'), meta: { module: 'community', back: '/community', detail: true } },
  { path: '/community/new', component: v('Compose'), meta: { module: 'community', back: '/community', detail: true, bareMobile: true } },
  { path: '/community/me', component: v('CommunityMe'), meta: { module: 'community' } },
  { path: '/notifications', component: v('Notifications'), meta: { module: 'community' } },

  { path: '/tools', component: v('Tools'), meta: { module: 'tools' } },
  { path: '/tools/rt', component: v('ToolRt'), meta: { module: 'tools', back: '/tools', detail: true } },
  { path: '/tools/tja', component: v('ToolTja'), meta: { module: 'tools', back: '/tools', detail: true } },
  { path: '/annual', component: v('Annual'), meta: { module: 'growth', back: '/', detail: true } },

  { path: '/me', component: v('Me'), meta: { module: 'me' } },
  { path: '/u/:name', component: v('Profile'), meta: { module: 'community', back: '/community', detail: true } },
  { path: '/account', component: v('Account'), meta: { module: 'account' } },
  { path: '/account/sync', component: v('Sync'), meta: { module: 'account' } },
  { path: '/account/settings', component: v('Settings'), meta: { module: 'account' } },
  { path: '/account/developer', component: v('Developer'), meta: { module: 'account' } },
  { path: '/account/support', component: v('Support'), meta: { module: 'account' } },

  { path: '/login', component: v('Login'), meta: { bare: true } },
  { path: '/bind', component: v('Bind'), meta: { bare: true } },
  { path: '/states', component: v('States'), meta: { module: 'tools', back: '/review', detail: true } },

  // 设计评审入口（不属于产品本身）
  { path: '/review', component: v('review/Hub'), meta: { bare: true } },
  { path: '/review/directions', component: v('review/Directions'), meta: { bare: true } },
  { path: '/review/system', component: v('review/System'), meta: { bare: true } },
  { path: '/review/device', component: v('review/Device'), meta: { bare: true } },

  { path: '/:rest(.*)*', component: v('NotFound'), meta: { module: 'today' } },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(to, from, saved) {
    if (saved) return saved
    if (to.path === from.path) return false
    return { top: 0 }
  },
})
