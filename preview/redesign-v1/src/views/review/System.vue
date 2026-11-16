<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import Icon from '../../components/Icon.vue'
import Logo from '../../components/Logo.vue'
import Lane from '../../components/Lane.vue'
import DrumDial from '../../components/DrumDial.vue'
import Radar from '../../components/Radar.vue'
import LineChart from '../../components/LineChart.vue'
import DensityStrip from '../../components/DensityStrip.vue'
import Spark from '../../components/Spark.vue'
import ChartSheet from '../../components/ChartSheet.vue'
import Diff from '../../components/Diff.vue'
import Crown from '../../components/Crown.vue'
import Rank from '../../components/Rank.vue'
import Cover from '../../components/Cover.vue'
import SongCell from '../../components/SongCell.vue'
import FactRow from '../../components/FactRow.vue'
import GoalCard from '../../components/GoalCard.vue'
import ThreadRow from '../../components/ThreadRow.vue'
import EmptyLane from '../../components/EmptyLane.vue'
import Gate from '../../components/Gate.vue'
import Sheet from '../../components/Sheet.vue'
import { store, L, toast, resolvedTheme } from '../../store'
import { songs, songById, chartOf, scoreOf, bestList, laneDays, player, DIMS, CHART_AXES, RANKS, CROWNS, DIFFS, GENRES, UGC_TAGS, ratingHistory, dimHistory, goals, threads, fmt } from '../../mock/data'

// Design System V1：活的规范页。所有样本都直接渲染 tokens.css / base.css / domain.css 与 src/components，
// 颜色值与对比度在浏览器里实时读取，换主题后自动重算。

/* ---------------- 页面骨架 ---------------- */
const SECTIONS = [
  { id: 'ds-principles', t: '设计原则' },
  { id: 'ds-color', t: '颜色' },
  { id: 'ds-type', t: '字体与字阶' },
  { id: 'ds-space', t: '间距、圆角、层级' },
  { id: 'ds-layout', t: '布局与栅格' },
  { id: 'ds-base', t: '基础组件' },
  { id: 'ds-domain', t: '业务组件' },
  { id: 'ds-charts', t: '图表与数据展示' },
  { id: 'ds-motion', t: '交互状态与动效' },
  { id: 'ds-a11y', t: '无障碍与国际化' },
  { id: 'ds-mapping', t: '与现有实现的映射' },
]
const THEMES = [
  { v: 'light', t: '浅色' },
  { v: 'dark', t: '深色' },
  { v: 'system', t: '跟随系统' },
]
const LOCALES = [
  { v: 'zh', t: '中文' },
  { v: 'ja', t: '日本語' },
]
const root = ref(null)
const active = ref(SECTIONS[0].id)
function go(id) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  active.value = id
}

/* ---------------- 颜色：实时读取 ---------------- */
const PRIMS = [
  { key: 'ai', name: '藍 ai', note: '墨色与中性色。所有底、线、字都从这里取。', tokens: [950, 900, 850, 800, 750, 700, 600, 500, 400, 300, 200, 150, 100, 50, 0].map((n) => `ai-${n}`) },
  { key: 'shu', name: '朱 shu', note: '咚。', tokens: [700, 600, 500, 400, 100].map((n) => `shu-${n}`) },
  { key: 'asagi', name: '浅葱 asagi', note: '咔。', tokens: [700, 600, 500, 400, 100].map((n) => `asagi-${n}`) },
  { key: 'yamabuki', name: '山吹 yamabuki', note: '连打。', tokens: [700, 500, 400, 100].map((n) => `yamabuki-${n}`) },
]
const SEMANTIC = [
  ['bg', '页面底'],
  ['bg-sunk', '凹陷区：分段控件底、骨架、标签底'],
  ['surface', '面板、对话框、输入框'],
  ['surface-2', '行 hover、面板内的次级面'],
  ['line', '分隔线、面板边'],
  ['line-strong', '控件边框、表头线'],
  ['ink', '标题与正文'],
  ['ink-2', '次要文字'],
  ['ink-3', '说明、占位、图表刻度'],
  ['don', '咚音符、指示、图形、当前页签'],
  ['don-solid', '主按钮填充（白字 ≥ 4.5:1）'],
  ['ink-on-solid', '实色填充上的文字：主按钮、难度标签'],
  ['don-ink', '文字级的朱'],
  ['don-wash', '朱的浅底'],
  ['ka', '焦点环、咔音符、关注方向'],
  ['ka-ink', '链接、hover 标题'],
  ['ka-wash', '浅葱的浅底'],
  ['roll', '高光、里程碑标记'],
  ['roll-ink', '文字级的山吹'],
  ['roll-wash', '山吹的浅底'],
  ['ok', '上升、成功'],
  ['danger', '下降、错误、破坏性按钮的描边与文字'],
  ['lane', '谱面带底色，两个主题下都是深色；也用于 toast'],
  ['lane-ink', '谱面带上的文字；半透明层用 color-mix 从它派生'],
  ['lane-line', '谱面带轨线、周一小节线'],
  ['lane-measure', '谱面图里更醒目的小节线'],
  ['lane-don', '谱面带上的咚音符'],
  ['lane-ka', '谱面带上的咔音符'],
  ['lane-roll', '谱面带上的连打条'],
  ['lane-fc', '全连音符的金色内环'],
  ['lane-ring', '音符白色内环'],
  ['lane-outline', '音符深色外轮廓'],
  ['lane-ghost', '有游玩但没有新记录的小音符'],
  ['lane-ghost-ring', '上面那颗小音符的内环'],
  ['avatar-bg', '默认头像底色'],
]
const JUDGE_TOKENS = [
  { token: 'judge-good', use: '良（= --don）' },
  { token: 'judge-ok', use: '可（= --ink-3）' },
  { token: 'judge-ng', use: '不可（独立取值，不再借用 --diff-ura）' },
]
const DIFF_KEYS = [1, 2, 3, 4, 5].map((d) => ({ d, token: `diff-${DIFFS[d].key}` }))
const CROWN_TOKENS = [
  { v: null, token: 'crown-none' },
  { v: 0, token: 'crown-clear' },
  { v: 1, token: 'crown-fc' },
  { v: 2, token: 'crown-dfc', gradient: true },
]
const RANK_TOKENS = [2, 3, 4, 5, 6, 7, 8].map((v) => ({ v, token: `rank-${RANKS[v].key}` }))
const GENRE_TOKENS = Object.keys(GENRES).map((k) => ({ k, token: `genre-${k}` }))
const CONTRAST = [
  { fg: 'ink', bg: 'surface', use: '正文、标题' },
  { fg: 'ink-2', bg: 'surface', use: '次要文字、.t-small' },
  { fg: 'ink-3', bg: 'surface', use: '.t-caption、占位、刻度' },
  { fg: 'ink-3', bg: 'bg', use: '页面底上的说明文字' },
  { fg: 'don-ink', bg: 'surface', use: '朱色文字' },
  { fg: 'ka-ink', bg: 'surface', use: '链接' },
  { fg: 'roll-ink', bg: 'surface', use: '山吹色文字' },
  { fg: 'ok', bg: 'surface', use: '上升数字 .up' },
  { fg: 'danger', bg: 'surface', use: '错误提示、下降数字 .down' },
  { sel: '[data-cr="primary"]', label: '.btn-primary', use: '主按钮文字 / 底（实测）' },
  { sel: '[data-cr="danger"]', label: '.btn-danger', use: '破坏性按钮文字 / 底（实测）' },
  { sel: '[data-cr="tag-don"]', label: '.tag-don', use: '11px 标签（实测）' },
  { sel: '[data-cr="tag-ok"]', label: '.tag-ok', use: '11px 标签（实测）' },
  { sel: '[data-cr="tag-roll"]', label: '.tag-roll', use: '11px 标签（实测）' },
]
const ALL_TOKENS = [...PRIMS.flatMap((g) => g.tokens), ...SEMANTIC.map((s) => s[0]), ...DIFF_KEYS.map((x) => x.token), ...CROWN_TOKENS.filter((x) => !x.gradient).map((x) => x.token), ...JUDGE_TOKENS.map((x) => x.token), ...RANK_TOKENS.map((x) => x.token), ...GENRE_TOKENS.map((x) => x.token)]

const probe = ref(null)
const hex = reactive({})
const contrast = ref([])
function rgbOf(css) {
  const m = css?.match(/[\d.]+/g)?.map(Number)
  if (!m || m.length < 3) return null
  return css.startsWith('color(') ? m.slice(0, 3).map((v) => Math.round(v * 255)) : m.slice(0, 3)
}
const toHex = (c) => (c ? '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('') : '')
function readColor(value) {
  const el = probe.value
  el.style.color = ''
  el.style.color = value
  return rgbOf(getComputedStyle(el).color)
}
const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
function ratioOf(a, b) {
  const x = lum(a)
  const y = lum(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
function measure() {
  if (!probe.value || !root.value) return
  for (const t of ALL_TOKENS) hex[t] = toHex(readColor(`var(--${t})`))
  contrast.value = CONTRAST.map((r) => {
    let fg
    let bg
    if (r.sel) {
      const el = root.value.querySelector(r.sel)
      if (el) {
        const cs = getComputedStyle(el)
        fg = rgbOf(cs.color)
        bg = rgbOf(cs.backgroundColor)
      }
    } else {
      fg = readColor(`var(--${r.fg})`)
      bg = readColor(`var(--${r.bg})`)
    }
    const ratio = fg && bg ? ratioOf(fg, bg) : null
    return { ...r, ratio, fgHex: toHex(fg), bgHex: toHex(bg), level: ratio == null ? '' : ratio >= 4.5 ? 'aa' : ratio >= 3 ? 'large' : 'fail' }
  })
}
let io
let timer
function remeasure() {
  measure()
  clearTimeout(timer)
  timer = setTimeout(measure, 240) // 按钮等带过渡的元素，等过渡结束后再读一次
}
watch(resolvedTheme, () => nextTick(remeasure), { flush: 'post' })
onMounted(() => {
  remeasure()
  io = new IntersectionObserver(
    (es) => {
      for (const e of es) if (e.isIntersecting) active.value = e.target.id
    },
    { rootMargin: '-15% 0px -75% 0px' },
  )
  root.value.querySelectorAll('section[id]').forEach((s) => io.observe(s))
})
onBeforeUnmount(() => {
  io?.disconnect()
  clearTimeout(timer)
})

/* ---------------- 字体、间距、圆角、层级 ---------------- */
const FONTS = [
  { token: '--font-cjk-sc', stack: 'Noto Sans SC Variable → PingFang SC → HarmonyOS Sans SC → Microsoft YaHei', use: '中文界面、中文曲名' },
  { token: '--font-cjk-jp', stack: 'Noto Sans JP Variable → Hiragino Sans → Yu Gothic UI → Meiryo', use: '日文界面、日文曲名' },
  { token: '--font-ui', stack: 'Barlow → 当前语言的 CJK 字体栈', use: '拉丁字母与全部界面文字' },
  { token: '--font-num', stack: 'Barlow Condensed → Barlow → CJK 字体栈', use: '分数、Rating、定数、计数' },
]
const TYPE_ROLES = [
  { cls: 't-display', size: '--fs-36', m: '手机 --fs-28', w: 900, lh: '--lh-tight · 1.15' },
  { cls: 't-h1', size: '--fs-28', m: '手机 --fs-22', w: 900, lh: '--lh-tight · 1.15' },
  { cls: 't-h2', size: '--fs-18', w: 700, lh: '--lh-snug · 1.35' },
  { cls: 't-h3', size: '--fs-14', w: 700, lh: '--lh-snug · 1.35' },
  { cls: 't-body', size: '--fs-14', w: 400, lh: '--lh-body · 1.6' },
  { cls: 't-small', size: '--fs-13', w: 400, lh: '--lh-body · 1.6' },
  { cls: 't-caption', size: '--fs-12', w: 400, lh: '--lh-body · 1.6' },
]
const FS = [11, 12, 13, 14, 16, 18, 22, 28, 36, 48, 64]
const NUM_SIZES = ['--fs-16', '--fs-22', '--fs-36', '--fs-64']
const SP = [
  { n: 1, px: 4, use: '图标与文字、标签内部' },
  { n: 2, px: 8, use: '同组控件之间（.row-wrap）' },
  { n: 3, px: 12, use: '行内默认间距（.row / .col）' },
  { n: 4, px: 16, use: '面板头上下、手机页边距' },
  { n: 5, px: 20, use: '面板内边距（.panel-pad）' },
  { n: 6, px: 24, use: '页头到内容、页面上边距' },
  { n: 8, px: 32, use: '手机上的分节间距' },
  { n: 10, px: 40, use: '桌面上的分节间距（.section）' },
  { n: 12, px: 48, use: '手机页面底部留白' },
  { n: 16, px: 64, use: '桌面页面底部留白' },
]
const RADII = [
  { token: '--r-xs', px: '6px', use: '标签、星级点、分段控件里的按钮、键帽' },
  { token: '--r-ctl', px: '8px', use: '按钮、输入框、图标按钮（分段控件外框为 +2px）' },
  { token: '--r-panel', px: '14px', use: '面板、对话框、谱面带' },
  { token: '--r-lg', px: '18px', use: '命令面板' },
  { token: '--r-sheet', px: '22px', use: '手机底部抽屉的顶角' },
  { token: '--r-note', px: '999px', use: '音符、胶囊标签、toast、头像' },
]
const ZS = [
  { token: '--z-rail', v: 20, use: '桌面左轨' },
  { token: '--z-bar', v: 30, use: '顶栏、手机底栏' },
  { token: '--z-sheet', v: 60, use: 'Sheet 与遮罩' },
  { token: '--z-palette', v: 80, use: '全局搜索' },
  { token: '--z-toast', v: 90, use: 'toast' },
  { token: '--z-proto', v: 100, use: '原型控制面板，不进入生产' },
]
const BREAKS = [
  { r: '≤ 767', n: '手机', nav: '52px 页头 + 62px 底部五格，正中是「咚」搜索键', body: '单列；侧栏列并入主栏；表格改成列表行', over: '对话框变成底部抽屉；按钮 44px、输入框 46px / 16px 字' },
  { r: '768 – 1099', n: '平板', nav: '保留 84px 左轨；顶栏搜索框和同步按钮收成图标', body: '单列为主；表格隐藏次要列', over: '居中对话框' },
  { r: '1100 – 1239', n: '桌面', nav: '完整顶栏：页签、搜索框、同步状态', body: '侧栏列排到主栏下方或收窄到 300px', over: '居中对话框' },
  { r: '≥ 1240', n: '宽屏', nav: '同上', body: '主栏 + 320–380px 侧栏列并排；内容最宽 1480px', over: '定数表等页面出现常驻详情栏' },
]

/* ---------------- 基础组件演示状态 ---------------- */
const seg = ref('oni')
const tab = ref('scores')
const TABS = [
  { v: 'rating', zh: 'Rating', ja: 'Rating' },
  { v: 'scores', zh: '全部成绩', ja: '全成績' },
  { v: 'progress', zh: '进度', ja: '進捗' },
  { v: 'recommend', zh: '推荐', ja: 'おすすめ' },
]
const chipsOn = ref(['24 分', '后半难'])
function toggleChip(t) {
  const i = chipsOn.value.indexOf(t)
  if (i >= 0) chipsOn.value.splice(i, 1)
  else chipsOn.value.push(t)
}
const sort = reactive({ key: 'rt', dir: 'descending' })
const SORT_COLS = [
  { k: 'score', zh: '成绩', ja: 'スコア' },
  { k: 'acc', zh: '精度', ja: '精度' },
  { k: 'rt', zh: 'RT', ja: 'RT' },
]
function sortBy(k) {
  if (sort.key === k) sort.dir = sort.dir === 'descending' ? 'ascending' : 'descending'
  else Object.assign(sort, { key: k, dir: 'descending' })
}
const tableRows = computed(() => [...bestList.slice(0, 4)].sort((a, b) => (sort.dir === 'ascending' ? a[sort.key] - b[sort.key] : b[sort.key] - a[sort.key])))
const sheetOpen = ref(false)
function confirmDelete() {
  sheetOpen.value = false
  toast(L('已删除这条手动成绩', '手動スコアを削除しました'))
}

/* ---------------- 业务组件样本 ---------------- */
const demoSong = songById[233] // 五个难度齐全
const tengu = songById[615]
const tenguChart = chartOf(615, 4)
const tenguScore = scoreOf(615, 4)
const genreSongs = Object.keys(GENRES).map((g) => songs.find((s) => s.genre === g))
const todayFacts = laneDays.find((d) => d.daysAgo === 0).facts
const factSamples = ['df', 'rank-upgrade', 'ng-reduced'].map((t) => todayFacts.find((f) => f.type === t))
const activeGoal = goals.find((g) => g.status === 'active')
const EMPTY = computed(() => [
  { tone: 'empty', title: L('还没有成绩', 'まだ記録がありません'), text: L('同步第一份成绩后，这里就会有内容。', '最初の同期が終わると表示されます。') },
  { tone: 'error', title: L('没有同步成功', '同期できませんでした'), text: L('鼓众广场暂时没有响应，稍后再试一次。', 'しばらくしてからもう一度お試しください。') },
  { tone: 'loading', title: L('正在读取成绩', '成績を読み込み中'), text: '' },
])

/* ---------------- 图表样本 ---------------- */
const laneSel = ref(0)
const laneDay = computed(() => laneDays.find((d) => d.daysAgo === laneSel.value))
const miniDays = laneDays.slice(-14)
const miniSel = ref(4)
const miniDay = computed(() => miniDays.find((d) => d.daysAgo === miniSel.value))
const dayText = (d) => (d.daysAgo === 0 ? L('今天', '今日') : `${d.date.getMonth() + 1}/${d.date.getDate()}`)
const LEGEND = [
  { cls: '', t: '朱色音符', d: '当天最重要的进展是刷新成绩或首次通关' },
  { cls: 'ka', t: '浅葱音符', d: '评价升级、不可变少、连击更长' },
  { cls: 'big fc', t: '金环大音符 .note.fc', d: '新全连' },
  { cls: 'big dfc', t: '虹环大音符 .note.dfc', d: '新全良' },
  { cls: 'big roll', t: '山吹大音符', d: '练成了一个目标' },
  { cls: 'ghost', t: '空心音符', d: '打了，但没有新记录' },
  { bar: true, t: '山吹连打条', d: '连续两天以上都有游玩' },
]
const dimAxes = computed(() => DIMS.map((d) => ({ key: d.key, label: L(d.zh, d.ja), value: player.dims[d.key], prev: player.dimsPrev[d.key] })))
const chartAxes = computed(() => CHART_AXES.map((a) => ({ key: a.key, label: L(a.zh, a.ja), value: tenguChart.abilities[a.key] })))
const linePoints = ratingHistory.slice(-90).map((p) => {
  const d = new Date(2026, 10, 16 - p.daysAgo)
  return { label: `${d.getMonth() + 1}/${d.getDate()}`, v: p.v, daysAgo: p.daysAgo }
})
const lineMarks = [
  { index: linePoints.findIndex((p) => p.daysAgo === 74), text: '通过九段' },
  { index: linePoints.findIndex((p) => p.daysAgo === 22), text: 'Rating 越过 11.9' },
]
const sparkRating = ratingHistory.slice(-30).map((p) => p.v)
const FORMATS = [
  { k: '分数', rule: '千分位，不缩写成「100 万」', ex: fmt(1004290) },
  { k: 'Rating / 定数 / 六维', rule: '固定 2 位小数', ex: player.rating.toFixed(2) },
  { k: '精度', rule: '2 位小数 + %', ex: tenguScore.acc.toFixed(2) + '%' },
  { k: '变化量', rule: '带正负号，颜色只是补充', ex: '+' + player.ratingDelta30.toFixed(2) },
  { k: '计数', rule: '整数，过千加千分位', ex: fmt(player.plays) },
]

/* ---------------- 状态与动效 ---------------- */
const STATES = [
  { s: '默认', en: 'default', how: '1px --line-strong 边，--surface 底；面板用 --line。' },
  { s: '悬停', en: 'hover', how: '底色到 --surface-2 或 --bg-sunk，边到 --ink-3；可点的标题变 --ka-ink。只变颜色，不位移。' },
  { s: '键盘焦点', en: 'focus-visible', how: '--focus：3px 浅葱环。输入框同时把边换成 --ka。鼠标点击不出现。' },
  { s: '按下', en: 'active', how: 'scale(0.97)，--dur-1。' },
  { s: '禁用', en: 'disabled', how: '透明度 0.5，不响应指针。旁边要有文字说明为什么不可用。' },
  { s: '选中', en: 'selected', how: '分段：--surface 底 + 700 字重；筛选胶囊：--ink 反色；页签：3px --don 下划线；谱面带：该列提亮。' },
  { s: '加载', en: 'loading', how: '有布局时用 .sk 骨架；整块等待用 EmptyLane 的 loading；触发按钮禁用并换成进行中的文案。' },
]
const MOTION = [
  { token: '--dur-1', v: '120ms', use: '颜色、边框、按下' },
  { token: '--dur-2', v: '220ms', use: '浮层出现、音符放大' },
  { token: '--dur-3', v: '420ms', use: '底部抽屉滑入' },
]
const FEEDBACK = [
  { when: '操作完成', how: 'toast：一句话，3.2 秒后自己消失，不抢焦点。' },
  { when: '输入有误', how: '就地提示：字段下方 .field-error，输入框边变 --danger，内容保留。' },
  { when: '删除、解绑等不可撤销的操作', how: 'Sheet 确认：标题说清后果，确认按钮写动词并用 .btn-danger（描边，靠形式而不是色相和主按钮区分）。' },
  { when: '点赞、收藏、投票', how: '乐观切换：立刻变化，失败时回滚并用 toast 说明。' },
]
const played = ref(false)
const fadeOpen = ref(true)
const like = reactive({ on: false, n: 386 })
function toggleLike() {
  like.on = !like.on
  like.n += like.on ? 1 : -1
}

/* ---------------- 无障碍与国际化 ---------------- */
const CHECKS = [
  { t: '触控目标', d: '手机上按钮与图标按钮 44px、输入框 46px、底栏每格 62px 高。.btn-sm（36）、.chip（34）、.seg（36）只用在带 8px 间距的筛选行里。' },
  { t: '焦点可见', d: '--focus 是唯一的焦点样式，只在 :focus-visible 出现；深色谱面带上改用 2px 内描边。' },
  { t: '状态写在 ARIA 上', d: '可切换的用 aria-pressed，页签用 role="tab" + aria-selected，导航当前项用 aria-current，排序列用 aria-sort。选中样式直接挂在这些属性上，视觉和读屏不会不一致。' },
  { t: '图表有文字等价', d: '每张图旁边都有同一份数据的数字；SVG 带 role="img" 和 aria-label（折线写明范围与首尾数值，雷达逐项列出维度和数值）；折线最多 4 条横向参考线；谱面带每一列的 aria-label 写明日期和进展条数。' },
  { t: '颜色不单独承载信息', d: '王冠有形状和文字标签，评价有字形（粹 / 雅 / 极），涨跌有正负号，难度有文字。' },
  { t: '中日字形', d: 'html 的 lang 跟随界面语言；另一种语言的曲名单独标 lang，浏览器才会选对字形。' },
  { t: '文本膨胀', d: '日文标签大约是中文的 1.3 倍。按钮不写死宽度，页签横向滚动，表头允许省略。' },
  { t: '图片里不放文字', d: '图表是 SVG 和 DOM 文字，可选中、可翻译、跟随主题；需要发群的分享图另行生成。' },
  { t: '主题', d: '跟随系统、浅色、深色三档；只切换 Semantic 层，组件不写主题分支。' },
  { t: '减少动效', d: 'prefers-reduced-motion 下，所有过渡、动画和平滑滚动归零。' },
]
const EXPAND = [
  ['练后同步', 'プレイ後に同期'],
  ['设为目标', '目標に設定する'],
  ['全部成绩', 'すべての成績を見る'],
]
const MAPPING = [
  { old: '--viewer-radius: 14px，全站一个圆角', now: '六级圆角：--r-xs 6 / --r-ctl 8 / --r-panel 14 / --r-lg 18 / --r-sheet 22 / --r-note 999', why: '控件、面板、抽屉、音符一眼能分开' },
  { old: '--viewer-primary #bd352f', now: '--don-solid（主按钮填充）、--don（音符与图形）、--don-ink（文字）', why: '填充、图形和文字各自校准对比度' },
  { old: '--viewer-link #006c76', now: '--ka（焦点、选中）与 --ka-ink（链接）', why: '链接、焦点、咔音符是同一个色相' },
  { old: '--viewer-bg #eaf6f5 青绿底', now: '--bg，取自藍色阶', why: '底色退后，音符三色才有位置' },
  { old: '960px 单断点 + 15 个零散断点', now: '767 / 1099 / 1239 三个断点', why: '每个页面在同一宽度换布局' },
  { old: '王冠、评价用纯文字', now: 'Crown / Rank 组件', why: '形状 + 颜色 + 可选文字，表格里也能扫读' },
  { old: 'ECharts、手写 SVG、服务端 PNG 三套图表', now: '统一的 SVG 图表组件；保留的 ECharts 图从 token 生成主题', why: '数字可读、跟随深浅色、手机上不糊' },
  { old: 'Element Plus 变量各处单独覆盖', now: '从 Semantic 层映射：--el-color-primary: var(--don-solid)、--el-bg-color: var(--surface)、--el-border-color: var(--line-strong)、--el-text-color-primary: var(--ink)、--el-border-radius-base: var(--r-ctl)', why: '改一处 token，自研组件和 Element Plus 一起变' },
  { old: '未登录时有的硬跳登录页，有的内联提示', now: 'Gate 组件', why: '留在原地，告诉用户差哪一步' },
]
</script>

<template>
  <div ref="root" class="s-root">
    <i ref="probe" class="s-probe" aria-hidden="true" />

    <header class="s-top">
      <div class="s-top-in">
        <RouterLink to="/review" class="s-brand" aria-label="设计总览">
          <Logo :size="30" />
          <b>Design System V1</b>
        </RouterLink>
        <RouterLink to="/review" class="link s-back"><Icon name="chevL" :size="14" />设计总览</RouterLink>
        <span class="grow" />
        <div class="s-ctl s-ctl-bar">
          <div class="seg" role="group" aria-label="主题">
            <button v-for="t in THEMES" :key="t.v" :aria-pressed="store.theme === t.v" @click="store.theme = t.v">{{ t.t }}</button>
          </div>
          <div class="seg" role="group" aria-label="语言">
            <button v-for="l in LOCALES" :key="l.v" :aria-pressed="store.locale === l.v" @click="store.locale = l.v">{{ l.t }}</button>
          </div>
        </div>
      </div>
      <nav class="s-chips" aria-label="章节">
        <button v-for="s in SECTIONS" :key="s.id" class="chip" :aria-current="active === s.id ? 'true' : undefined" @click="go(s.id)">{{ s.t }}</button>
      </nav>
    </header>

    <div class="s-frame">
      <nav class="s-toc" aria-label="章节">
        <button v-for="(s, i) in SECTIONS" :key="s.id" :aria-current="active === s.id ? 'true' : undefined" @click="go(s.id)">
          <span class="num">{{ String(i + 1).padStart(2, '0') }}</span>{{ s.t }}
        </button>
      </nav>

      <main class="s-doc">
        <header class="s-intro">
          <h1 class="t-display">Design System V1</h1>
          <p class="s-lede">Taiko Viewer「<span lang="ja">譜面</span> Fumen」设计语言的规范。本页的每个样本都由 tokens.css、base.css、domain.css 和组件源码直接渲染，切换主题和语言后看到的就是实际效果。</p>
          <div class="s-ctl s-ctl-page">
            <div class="seg" role="group" aria-label="主题">
              <button v-for="t in THEMES" :key="t.v" :aria-pressed="store.theme === t.v" @click="store.theme = t.v">{{ t.t }}</button>
            </div>
            <div class="seg" role="group" aria-label="语言">
              <button v-for="l in LOCALES" :key="l.v" :aria-pressed="store.locale === l.v" @click="store.locale = l.v">{{ l.t }}</button>
            </div>
          </div>
        </header>

        <!-- ============ 01 设计原则 ============ -->
        <section id="ds-principles" class="s-sec">
          <h2 class="t-h1"><span class="s-n num">01</span>设计原则</h2>
          <ol class="s-principles">
            <li>
              <h3 class="t-h2">音符即数据</h3>
              <p>朱是咚，表示刷新成绩；浅葱是咔，表示稳定性与信息；山吹是连打，表示高光。打过太鼓的人不用学图例就读得懂。</p>
              <div class="row-wrap s-ev">
                <span class="row"><i class="note big" />刷新成绩</span>
                <span class="row"><i class="note big ka" />更稳了 / 信息</span>
                <span class="row"><i class="note big roll" />高光</span>
                <span class="row"><i class="note big fc" />新全连</span>
                <span class="row"><i class="note big dfc" />新全良</span>
              </div>
            </li>
            <li>
              <h3 class="t-h2">一条谱面讲完一段时间</h3>
              <p>Lane 是唯一的签名元素，其余界面保持安静。哪天打了、打出了什么，一眼看完，视线不被装饰分走。</p>
            </li>
            <li>
              <h3 class="t-h2">平面与细线，阴影只属于浮层</h3>
              <p>面板只有 1px 细线。看到阴影，就知道它浮在内容上面、可以关掉，层级不会读错。</p>
            </li>
            <li>
              <h3 class="t-h2">数字与汉字各司其职</h3>
              <p>数字用 Barlow Condensed 等宽数字，汉字用重磅黑体做层级。成绩上下对齐可以逐位比较，标题不靠颜色也分得出主次。</p>
              <div class="s-ev"><span class="num s-evnum">{{ fmt(1004290) }}</span><b class="s-evhan" lang="ja">天狗囃子</b></div>
            </li>
            <li>
              <h3 class="t-h2">查询永远一步可达</h3>
              <p>桌面有顶栏搜索和 Ctrl K，手机是底栏正中的「咚」键。站在机台前单手就能查到一首歌，不用先想它在哪个栏目。</p>
              <div class="s-ev"><button class="btn btn-sm" @click="store.paletteOpen = true"><Icon name="search" :size="14" />打开全局搜索</button></div>
            </li>
          </ol>
        </section>

        <!-- ============ 02 颜色 ============ -->
        <section id="ds-color" class="s-sec">
          <h2 class="t-h1"><span class="s-n num">02</span>颜色</h2>
          <p class="s-lede">三层结构：Primitive 是色阶，Semantic 给它用途，Domain 承载游戏语义。组件只引用后两层，所以换主题只需要改 Semantic 的指向。下面的色值从当前页面实时读取，现在是{{ resolvedTheme === 'dark' ? '深色' : '浅色' }}主题。</p>

          <h3 class="t-h2 s-sub">Primitive</h3>
          <div v-for="g in PRIMS" :key="g.key" class="s-ramp">
            <p class="s-ramp-h"><b>{{ g.name }}</b><span class="t-caption">{{ g.note }}</span></p>
            <ul class="s-sws">
              <li v-for="t in g.tokens" :key="t">
                <i class="s-chip" :style="{ background: `var(--${t})` }" />
                <code>--{{ t }}</code>
                <span class="num">{{ hex[t] }}</span>
              </li>
            </ul>
          </div>

          <h3 class="t-h2 s-sub">Semantic</h3>
          <div class="panel scroll-x">
            <table class="dt s-w560">
              <thead>
                <tr><th style="width: 56px">色块</th><th>Token</th><th>当前值</th><th>用途</th></tr>
              </thead>
              <tbody>
                <tr v-for="s in SEMANTIC" :key="s[0]">
                  <td><i class="s-chip sm" :style="{ background: `var(--${s[0]})` }" /></td>
                  <td><code>--{{ s[0] }}</code></td>
                  <td class="num">{{ hex[s[0]] }}</td>
                  <td>{{ s[1] }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 class="t-h2 s-sub">Domain</h3>
          <div class="s-spec">
            <div class="s-k">难度<small>5 个</small></div>
            <ul class="s-dom">
              <li v-for="x in DIFF_KEYS" :key="x.token">
                <i class="s-chip" :style="{ background: `var(--${x.token})` }" />
                <Diff :d="x.d" :star="demoSong.levels[x.d - 1]" />
                <code>--{{ x.token }}</code><span class="num">{{ hex[x.token] }}</span>
              </li>
            </ul>
          </div>
          <div class="s-spec">
            <div class="s-k">王冠<small>4 个</small></div>
            <ul class="s-dom">
              <li v-for="x in CROWN_TOKENS" :key="x.token">
                <i class="s-chip" :style="{ background: `var(--${x.token})` }" />
                <Crown :v="x.v" label />
                <code>--{{ x.token }}</code><span class="num">{{ x.gradient ? 'conic-gradient' : hex[x.token] }}</span>
              </li>
            </ul>
            <p class="s-guide">未游玩不画王冠形，只画一条 --ink-3 短横线（灰色王冠会被读成银色通关）；--crown-none 保留给进度格等非王冠形的「没打过」。已游玩未通关是空心圆。</p>
          </div>
          <div class="s-spec">
            <div class="s-k">判定<small>3 个</small></div>
            <ul class="s-dom">
              <li v-for="x in JUDGE_TOKENS" :key="x.token">
                <i class="s-chip" :style="{ background: `var(--${x.token})` }" />
                <span class="t-small">{{ x.use }}</span>
                <code>--{{ x.token }}</code><span class="num">{{ hex[x.token] }}</span>
              </li>
            </ul>
          </div>
          <div class="s-spec">
            <div class="s-k">评价<small>7 个</small></div>
            <ul class="s-dom">
              <li v-for="x in RANK_TOKENS" :key="x.token">
                <i class="s-chip" :style="{ background: `var(--${x.token})` }" />
                <Rank :v="x.v" label />
                <code>--{{ x.token }}</code><span class="num">{{ hex[x.token] }}</span>
              </li>
            </ul>
          </div>
          <div class="s-spec">
            <div class="s-k">流派<small>8 个</small></div>
            <ul class="s-dom">
              <li v-for="x in GENRE_TOKENS" :key="x.token">
                <i class="s-chip" :style="{ background: `var(--${x.token})` }" />
                <span class="row s-genre"><i class="dot" :style="{ color: `var(--${x.token})` }" />{{ L(GENRES[x.k].zh, GENRES[x.k].ja) }}</span>
                <code>--{{ x.token }}</code><span class="num">{{ hex[x.token] }}</span>
              </li>
            </ul>
          </div>

          <h3 class="t-h2 s-sub">文字对比度</h3>
          <p class="s-guide">按 WCAG 2 公式用上面读到的色值现算。正文需要 4.5:1；3:1 只够 18px 以上的粗体和图形。</p>
          <div class="panel scroll-x">
            <table class="dt s-w560">
              <thead>
                <tr><th>样本</th><th>前景 / 背景</th><th class="r">对比度</th><th>结论</th><th>用在哪</th></tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in contrast" :key="i">
                  <td><span class="s-cr" :style="{ color: r.fgHex, background: r.bgHex }">咚 Aa 12</span></td>
                  <td>
                    <code v-if="r.sel">{{ r.label }}</code>
                    <template v-else><code>--{{ r.fg }}</code> / <code>--{{ r.bg }}</code></template>
                  </td>
                  <td class="r num s-ratio">{{ r.ratio == null ? '—' : r.ratio.toFixed(2) }}</td>
                  <td>
                    <span v-if="r.level === 'aa'" class="tag tag-ok"><Icon name="check" :size="12" />AA</span>
                    <span v-else-if="r.level === 'large'" class="tag tag-roll">仅大字 / 图形</span>
                    <span v-else-if="r.level === 'fail'" class="tag tag-don">不足</span>
                  </td>
                  <td>{{ r.use }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="s-dd">
            <div><b>用法</b>文字只用带 -ink 的 token 和 --ink 系列；填充用 --don / --ka / --roll；浅底用 -wash。</div>
            <div class="no"><b>不要</b>在组件里直接写 Primitive 色阶或十六进制值；不要把难度色、流派色挪去表示状态。</div>
          </div>
        </section>

        <!-- ============ 03 字体与字阶 ============ -->
        <section id="ds-type" class="s-sec">
          <h2 class="t-h1"><span class="s-n num">03</span>字体与字阶</h2>
          <p class="s-lede">层级靠字重和字号，不靠颜色：900 的黑体标题、700 的小标题、400 的正文。数字单独用一套窄体等宽数字，长分数在表格里占的宽度更小，位数一眼对得齐。</p>

          <div class="panel scroll-x s-gap">
            <table class="dt s-w560">
              <thead>
                <tr><th>Token</th><th>字体栈</th><th>用途</th></tr>
              </thead>
              <tbody>
                <tr v-for="f in FONTS" :key="f.token">
                  <td><code>{{ f.token }}</code></td><td>{{ f.stack }}</td><td>{{ f.use }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 class="t-h2 s-sub">字阶</h3>
          <div class="panel scroll-x">
            <table class="dt s-w680">
              <thead>
                <tr><th>角色</th><th>字号</th><th class="r">字重</th><th>行高</th><th>样本</th></tr>
              </thead>
              <tbody>
                <tr v-for="r in TYPE_ROLES" :key="r.cls">
                  <td><code>.{{ r.cls }}</code></td>
                  <td><code>{{ r.size }}</code><span v-if="r.m" class="t-caption s-m">{{ r.m }}</span></td>
                  <td class="r num">{{ r.w }}</td>
                  <td class="t-caption">{{ r.lh }}</td>
                  <td class="s-sample"><span :class="r.cls">天狗配乐 <span lang="ja">天狗囃子</span> <span class="num">123,456</span></span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="s-guide">字号 token 共 11 级：<span v-for="n in FS" :key="n" class="s-fs"><code>--fs-{{ n }}</code></span>。--fs-48 和 --fs-64 只给页面上唯一的主数字用。</p>

          <h3 class="t-h2 s-sub">数字</h3>
          <div class="s-nums scroll-x">
            <div v-for="s in NUM_SIZES" :key="s" class="s-numrow">
              <code>.num · {{ s }}</code>
              <span class="num" :style="{ fontSize: `var(${s})` }">{{ fmt(1004290) }}</span>
              <span class="num" :style="{ fontSize: `var(${s})` }">{{ player.rating.toFixed(2) }}</span>
              <span class="num" :style="{ fontSize: `var(${s})` }">{{ tenguScore.acc.toFixed(2) }}%</span>
            </div>
          </div>
          <div class="s-dd">
            <div><b>用法</b>所有会被比较的数字都加 .num，表格里右对齐。</div>
            <div class="no"><b>不要</b>用 .num 排句子里的年份、楼层号这类不需要比较的数字；不要给数字加粗到 900。</div>
          </div>

          <h3 class="t-h2 s-sub">中日字形</h3>
          <p class="s-guide">同一个码位，中文和日文的写法不同。日文曲名出现在中文界面里时标 lang="ja"，反过来标 lang="zh-CN"，曲名才是玩家在机台上看到的样子。</p>
          <div class="s-glyphs">
            <div><code>lang="zh-CN"</code><p lang="zh-CN">直 骨 角 天狗囃子</p></div>
            <div><code>lang="ja"</code><p lang="ja">直 骨 角 天狗囃子</p></div>
          </div>
        </section>

        <!-- ============ 04 间距、圆角、层级 ============ -->
        <section id="ds-space" class="s-sec">
          <h2 class="t-h1"><span class="s-n num">04</span>间距、圆角、层级</h2>
          <p class="s-lede">间距以 4px 为基准，只有 10 级；圆角按元素的层级分 6 级；阴影只有 2 种。选项少，页面之间的节奏才一致，用户换一个页面不用重新适应。</p>

          <h3 class="t-h2 s-sub">间距</h3>
          <ul class="s-sp">
            <li v-for="s in SP" :key="s.n">
              <code>--sp-{{ s.n }}</code>
              <span class="num">{{ s.px }}</span>
              <span class="s-sp-bar"><i :style="{ width: `var(--sp-${s.n})` }" /></span>
              <span class="t-small">{{ s.use }}</span>
            </li>
          </ul>

          <h3 class="t-h2 s-sub">圆角</h3>
          <ul class="s-radii">
            <li v-for="r in RADII" :key="r.token">
              <i :style="{ borderRadius: `var(${r.token})` }" />
              <code>{{ r.token }}</code><span class="num">{{ r.px }}</span>
              <span class="t-small">{{ r.use }}</span>
            </li>
          </ul>
          <p class="s-guide">圆角越大，元素离内容越远：控件贴着内容，面板包着内容，抽屉盖在内容上。999 只留给音符和由音符引申出来的胶囊。</p>

          <h3 class="t-h2 s-sub">层级</h3>
          <div class="s-elev">
            <div class="panel"><b>平面</b><code>1px --line</code><span class="t-small">面板、表格、列表。页面上的绝大多数东西。</span></div>
            <div class="panel lift"><b>贴附</b><code>--shadow-lift</code><span class="t-small">贴在内容上方的操作：手机底栏的「咚」键、吸底操作条。</span></div>
            <div class="panel pop"><b>浮层</b><code>--shadow-pop</code><span class="t-small">Sheet、全局搜索、下拉菜单、toast。</span></div>
          </div>
          <div class="s-dd">
            <div><b>用法</b>想让一块内容更突出，用字号、字重或 --surface-2 底。</div>
            <div class="no"><b>不要</b>给面板或卡片加阴影来「提亮」；不要叠两层带边的面板。</div>
          </div>
          <div class="panel scroll-x s-gap">
            <table class="dt">
              <thead>
                <tr><th>Token</th><th class="r">值</th><th>谁在用</th></tr>
              </thead>
              <tbody>
                <tr v-for="z in ZS" :key="z.token">
                  <td><code>{{ z.token }}</code></td><td class="r num">{{ z.v }}</td><td>{{ z.use }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- ============ 05 布局与栅格 ============ -->
        <section id="ds-layout" class="s-sec">
          <h2 class="t-h1"><span class="s-n num">05</span>布局与栅格</h2>
          <p class="s-lede">桌面用窄左轨放一级目的地，把横向空间留给表格和谱面；手机把同样的目的地放到拇指够得到的底栏。全站只有三个断点，每个页面都在同一个宽度换布局。</p>

          <div class="s-frames">
            <figure>
              <div class="scroll-x">
                <div class="s-fd" role="img" aria-label="桌面框架示意：84px 左轨，60px 顶栏，内容区最宽 1480px，右侧可选 320 到 380px 的侧栏列">
                  <div class="s-fd-rail"><i class="note big" /><i /><i /><i /><i /><i /><i /><span>左轨 <b class="num">84</b></span></div>
                  <div class="s-fd-main">
                    <div class="s-fd-bar"><span>顶栏 <b class="num">60</b></span><span>页签 · 搜索 · 同步 · 通知 · 账号</span></div>
                    <div class="s-fd-body">
                      <div class="s-fd-box"><span>内容</span><b class="num">max 1480</b><small>页边距 28</small></div>
                      <div class="s-fd-box side"><span>侧栏列（可选）</span><b class="num">320–380</b></div>
                    </div>
                  </div>
                </div>
              </div>
              <figcaption class="t-caption">桌面与平板</figcaption>
            </figure>
            <figure>
              <div class="s-fm" role="img" aria-label="手机框架示意：52px 页头，内容区，62px 底部五格，正中是咚搜索键">
                <div class="s-fm-head"><span>页头 <b class="num">52</b></span></div>
                <div class="s-fm-body"><span>内容</span><small>页边距 16</small></div>
                <div class="s-fm-tab"><i /><i /><span class="note big" /><i /><i /></div>
                <span class="s-fm-cap">底栏 <b class="num">62</b></span>
              </div>
              <figcaption class="t-caption">手机</figcaption>
            </figure>
          </div>

          <div class="panel scroll-x s-gap">
            <table class="dt s-w680">
              <thead>
                <tr><th>宽度</th><th>名称</th><th>导航</th><th>内容区</th><th>浮层与控件</th></tr>
              </thead>
              <tbody>
                <tr v-for="b in BREAKS" :key="b.r">
                  <td class="num s-nowrap">{{ b.r }}</td><td class="s-nowrap"><b>{{ b.n }}</b></td><td>{{ b.nav }}</td><td>{{ b.body }}</td><td>{{ b.over }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="s-dd">
            <div><b>用法</b>媒体查询只写 max-width: 767px / 1099px / 1239px。侧栏列放「我的成绩」这类需要一直看得到的内容。</div>
            <div class="no"><b>不要</b>为单个页面新增断点；不要在手机上保留横向滚动的宽表格，改成列表行。</div>
          </div>
        </section>

        <!-- ============ 06 基础组件 ============ -->
        <section id="ds-base" class="s-sec">
          <h2 class="t-h1"><span class="s-n num">06</span>基础组件</h2>
          <p class="s-lede">基础组件是 base.css 里的一组类，不带游戏语义。控件高度统一，一行里混排按钮、输入框和分段控件时基线是齐的；手机上自动加高到 44px 以上。</p>

          <div class="s-spec">
            <div class="s-k">按钮<small>.btn</small></div>
            <div class="col">
              <div class="row-wrap">
                <button class="btn btn-primary" data-cr="primary">{{ L('同步成绩', '成績を同期') }}</button>
                <button class="btn btn-ink">{{ L('游玩练习', '練習プレイ') }}</button>
                <button class="btn">{{ L('查看谱面', '譜面を見る') }}</button>
                <button class="btn btn-ghost">{{ L('取消', 'キャンセル') }}</button>
                <button class="btn btn-danger" data-cr="danger"><Icon name="trash" :size="16" />{{ L('删除成绩', '記録を削除') }}</button>
              </div>
              <div class="row-wrap">
                <button class="btn btn-sm">{{ L('小号', '小') }} .btn-sm</button>
                <button class="btn">{{ L('默认', '標準') }}</button>
                <button class="btn btn-lg">{{ L('大号', '大') }} .btn-lg</button>
                <button class="btn btn-primary"><Icon name="sync" :size="16" />{{ L('练后同步', 'プレイ後に同期') }}</button>
                <button class="btn"><Icon name="download" :size="16" />PNG</button>
                <button class="btn btn-primary" disabled>{{ L('正在同步…', '同期中…') }}</button>
                <button class="btn" disabled>{{ L('禁用', '無効') }}</button>
              </div>
              <p class="s-guide">一个视图里只有一个朱色主按钮，填充用 --don-solid（深色主题下文字用 --ink-on-solid）。.btn-ink 给不改变数据的主要动作，.btn-ghost 给取消和次要入口。.btn-danger 是描边按钮：--surface 底、--danger 边和字，只用在删除、解绑等确认按钮上，靠形式而不是色相和主按钮区分。</p>
            </div>
          </div>

          <div class="s-spec">
            <div class="s-k">图标按钮<small>.icon-btn</small></div>
            <div class="col">
              <div class="row-wrap">
                <button class="icon-btn" :aria-label="L('通知', '通知')"><Icon name="bell" /></button>
                <button class="icon-btn" :aria-label="L('收藏', '保存')"><Icon name="bookmark" /></button>
                <button class="icon-btn" :aria-label="L('更多', 'その他')"><Icon name="more" /></button>
                <button class="icon-btn" :aria-label="L('关闭', '閉じる')"><Icon name="close" /></button>
              </div>
              <p class="s-guide">只给含义不会被误读的动作用，并且必须带 aria-label。图标是 24 网格、1.75 描边的自绘线性图标。</p>
            </div>
          </div>

          <div class="s-spec">
            <div class="s-k">输入<small>.field · .input</small></div>
            <div class="col">
              <div class="s-fields">
                <div class="field">
                  <label for="ds-in1">{{ L('鼓众广场 ID', '太鼓番 ID') }}</label>
                  <input id="ds-in1" class="input" :placeholder="L('12 位数字', '12 桁の数字')" />
                </div>
                <div class="field">
                  <label for="ds-in2">{{ L('昵称', 'ニックネーム') }}</label>
                  <input id="ds-in2" class="input" :value="player.nickname" />
                  <span class="field-hint">{{ L('会显示在社区和排行里。', 'コミュニティとランキングに表示されます。') }}</span>
                </div>
                <div class="field">
                  <label for="ds-in3">{{ L('成绩', 'スコア') }}</label>
                  <input id="ds-in3" class="input is-error" value="1,204,290" aria-invalid="true" aria-describedby="ds-in3e" />
                  <span id="ds-in3e" class="field-error">{{ L('成绩不能超过 1,010,000。', 'スコアは 1,010,000 以下です。') }}</span>
                </div>
                <div class="field">
                  <label for="ds-in4">{{ L('数据来源', 'データ元') }}</label>
                  <input id="ds-in4" class="input" value="wahlap" disabled />
                  <span class="field-hint">禁用态目前沿用浏览器默认外观，base.css 待补。</span>
                </div>
                <div class="field">
                  <label for="ds-sel">{{ L('难度', '難易度') }}</label>
                  <select id="ds-sel" class="select">
                    <option v-for="d in [4, 5, 3, 2, 1]" :key="d">{{ L(DIFFS[d].zh, DIFFS[d].ja) }}</option>
                  </select>
                </div>
                <div class="field s-wide">
                  <label for="ds-ta">{{ L('打法心得', '攻略メモ') }}</label>
                  <textarea id="ds-ta" class="textarea" rows="3" :placeholder="L('写给下一个打这张谱的人', '次にこの譜面を叩く人へ')" />
                </div>
              </div>
              <p class="s-guide">标签永远在输入框上方。错误写在字段下面，说明怎样才对，不清空用户已输入的内容。</p>
            </div>
          </div>

          <div class="s-spec">
            <div class="s-k">分段控件<small>.seg</small></div>
            <div class="col">
              <div class="row-wrap">
                <div class="seg" role="group" :aria-label="L('难度', '難易度')">
                  <button v-for="d in [3, 4, 5]" :key="d" :aria-pressed="seg === DIFFS[d].key" @click="seg = DIFFS[d].key">{{ L(DIFFS[d].zh, DIFFS[d].ja) }}</button>
                </div>
                <span class="t-small">当前：{{ seg }}</span>
              </div>
              <p class="s-guide">2 到 4 个互斥的视角，切换后内容立即变化。超过 4 个改用页签或下拉。</p>
            </div>
          </div>

          <div class="s-spec">
            <div class="s-k">页签<small>.tabs</small></div>
            <div class="col">
              <div class="tabs" role="tablist">
                <button v-for="t in TABS" :key="t.v" role="tab" :aria-selected="tab === t.v" @click="tab = t.v">{{ L(t.zh, t.ja) }}</button>
              </div>
              <p class="s-guide">同一模块下的平级页面。放不下时横向滚动，不折行、不收进「更多」。</p>
            </div>
          </div>

          <div class="s-spec">
            <div class="s-k">筛选胶囊<small>.chip</small></div>
            <div class="col">
              <div class="row-wrap">
                <button v-for="t in UGC_TAGS.slice(0, 7)" :key="t" class="chip" :aria-pressed="chipsOn.includes(t)" @click="toggleChip(t)">{{ t }}</button>
              </div>
              <p class="s-guide">可以多选的筛选条件。选中用反色，不用朱色，把朱色留给成绩。</p>
            </div>
          </div>

          <div class="s-spec">
            <div class="s-k">标签<small>.tag · .role</small></div>
            <div class="col">
              <div class="row-wrap">
                <span class="tag">{{ L('攻略', '攻略') }}</span>
                <span class="tag tag-don" data-cr="tag-don"><Icon name="pin" :size="12" />{{ L('置顶', '固定') }}</span>
                <span class="tag tag-ka">{{ L('高速处理', '高速処理') }}</span>
                <span class="tag tag-roll" data-cr="tag-roll">{{ L('精华', '注目') }}</span>
                <span class="tag tag-ok" data-cr="tag-ok">{{ L('国行实装', '中国版稼働中') }}</span>
                <span class="role moderator">{{ L('版主', 'モデレーター') }}</span>
                <span class="role admin">{{ L('站务', '運営') }}</span>
              </div>
              <p class="s-guide">只读的属性，不能点。一行里最多 3 个，再多就说明这一行的信息需要重新排主次。</p>
            </div>
          </div>

          <div class="s-spec top">
            <div class="s-k">数据表<small>.dt</small></div>
            <div class="col">
              <div class="panel scroll-x">
                <table class="dt s-w680">
                  <thead>
                    <tr>
                      <th>{{ L('曲目', '楽曲') }}</th>
                      <th>{{ L('难度', '難易度') }}</th>
                      <th v-for="c in SORT_COLS" :key="c.k" class="r" :aria-sort="sort.key === c.k ? sort.dir : undefined">
                        <button @click="sortBy(c.k)">{{ L(c.zh, c.ja) }}<Icon :name="sort.key !== c.k ? 'sort' : sort.dir === 'descending' ? 'chevD' : 'chevU'" :size="12" /></button>
                      </th>
                      <th class="c">{{ L('王冠', '王冠') }}</th>
                      <th class="c">{{ L('评价', '評価') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="s in tableRows" :key="s.songId + '-' + s.d">
                      <td class="s-songcol"><SongCell :song="songById[s.songId]" size="sm" /></td>
                      <td><Diff :d="s.d" :star="s.star" :constant="s.constant" short /></td>
                      <td class="r num s-score">{{ fmt(s.score) }}</td>
                      <td class="r num">{{ s.acc.toFixed(2) }}%</td>
                      <td class="r num">{{ s.rt.toFixed(2) }}</td>
                      <td class="c"><Crown :v="s.crown" /></td>
                      <td class="c"><Rank :v="s.rank" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p class="s-guide">文字左对齐，数字右对齐，图形居中。表头可排序时是按钮，当前排序列用 aria-sort 标出。手机上不要用它，改成列表行。</p>
            </div>
          </div>

          <div class="s-spec top">
            <div class="s-k">键值、数值<small>.kv · .stat</small></div>
            <div class="s-pair">
              <dl class="kv">
                <dt>BPM</dt><dd class="num">{{ tengu.bpm }}</dd>
                <dt>{{ L('物量', 'ノーツ数') }}</dt><dd class="num">{{ tenguChart.notes }}</dd>
                <dt>{{ L('上架', '収録日') }}</dt><dd class="num">{{ tengu.openDay }}</dd>
                <dt>{{ L('艺术家', 'アーティスト') }}</dt><dd>{{ tengu.artist }}</dd>
              </dl>
              <div class="row s-stats">
                <div class="stat"><div class="v">{{ player.rating.toFixed(2) }}<span class="d up">+{{ player.ratingDelta30.toFixed(2) }}</span></div><div class="k">Rating</div></div>
                <div class="stat"><div class="v">{{ fmt(player.crownCounts.fc) }}</div><div class="k">{{ L('全连', 'フルコンボ') }}</div></div>
                <div class="stat"><div class="v">{{ fmt(player.crownCounts.dfc) }}</div><div class="k">{{ L('全良', '全良') }}</div></div>
              </div>
            </div>
          </div>

          <div class="s-spec">
            <div class="s-k">头像、骨架<small>.avatar · .sk</small></div>
            <div class="s-pair">
              <div class="row">
                <span class="avatar sm" style="background: var(--ka)">云</span>
                <span class="avatar" style="background: var(--don)">年</span>
                <span class="avatar lg">凛</span>
              </div>
              <div class="s-skel" aria-hidden="true">
                <span class="sk s-sk-cover" />
                <span class="col s-sk-lines"><span class="sk" style="width: 62%" /><span class="sk" style="width: 38%" /></span>
                <span class="sk s-sk-num" />
              </div>
            </div>
          </div>

          <div class="s-spec">
            <div class="s-k">弹层、提示、链接<small>Sheet · toast · .link</small></div>
            <div class="col">
              <div class="row-wrap">
                <button class="btn" @click="sheetOpen = true"><Icon name="trash" :size="16" />{{ L('删除手动成绩', '手動スコアを削除') }}</button>
                <button class="btn" @click="toast(L('已设为这次想练', '今回の練習に設定しました'))">toast · ok</button>
                <button class="btn" @click="toast(L('最多选 5 个标签', 'タグは 5 個まで'), 'info')">toast · info</button>
                <a class="link" href="#/review">{{ L('设计总览', 'デザイン概要') }}</a>
              </div>
              <p class="s-guide">Sheet 在桌面是居中对话框，在手机是底部抽屉，内容只写一份。链接用浅葱，hover 才出下划线。</p>
            </div>
          </div>
        </section>

        <!-- ============ 07 业务组件 ============ -->
        <section id="ds-domain" class="s-sec">
          <h2 class="t-h1"><span class="s-n num">07</span>业务组件</h2>
          <p class="s-lede">音符、难度、王冠、评价、封面只在 domain.css 和对应组件里定义一次，这是全站唯一给游戏语义上样式的地方。同一个王冠在曲库、成绩表和帖子里长得一样，玩家认一次就够。</p>

          <div class="s-spec">
            <div class="s-k">音符<small>.note</small></div>
            <ul class="s-notes">
              <li><i class="note" /><b>咚</b><span class="t-small">刷新成绩、完成</span></li>
              <li><i class="note ka" /><b>咔</b><span class="t-small">更稳了、提示信息</span></li>
              <li><i class="note roll" /><b>连打</b><span class="t-small">高光、目标</span></li>
              <li><i class="note big" /><b>大音符</b><span class="t-small">新王冠等里程碑</span></li>
              <li><i class="note ghost" /><b>空心</b><span class="t-small">有游玩但没有新记录、未完成的尝试</span></li>
            </ul>
          </div>

          <div class="s-spec top">
            <div class="s-k">难度<small>Diff · .star-pip</small></div>
            <div class="col">
              <div class="scroll-x">
                <table class="s-matrix">
                  <thead>
                    <tr><th /><th>short</th><th>short + 星级</th><th>全称 + 星级 + 定数</th><th>lg</th><th>.star-pip</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="c in demoSong.charts" :key="c.d">
                      <th>{{ DIFFS[c.d].key }}</th>
                      <td><Diff :d="c.d" short /></td>
                      <td><Diff :d="c.d" :star="c.star" short /></td>
                      <td><Diff :d="c.d" :star="c.star" :constant="c.constant" /></td>
                      <td><Diff :d="c.d" :star="c.star" :constant="c.constant" lg /></td>
                      <td><span class="star-pip" :class="DIFFS[c.d].key">{{ c.star }}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p class="s-guide">三段信息永远按「难度名、星级、定数」的顺序出现；没有定数的谱面不显示第三段。.star-pip 只用在每列已经是一个难度的紧凑表格里。</p>
            </div>
          </div>

          <div class="s-spec">
            <div class="s-k">王冠<small>Crown</small></div>
            <div class="col">
              <div class="row-wrap s-loose">
                <Crown v-for="(v, i) in [null, -1, 0, 1, 2]" :key="i" :v="v" label />
              </div>
              <div class="row-wrap s-loose">
                <Crown :v="2" size="sm" /><Crown :v="2" /><Crown :v="2" size="lg" />
                <span class="t-small">sm · 默认 · lg</span>
              </div>
            </div>
          </div>

          <div class="s-spec">
            <div class="s-k">评价<small>Rank</small></div>
            <div class="col">
              <div class="row-wrap s-loose">
                <Rank v-for="v in [1, 2, 3, 4, 5, 6, 7, 8]" :key="v" :v="v" label />
              </div>
              <div class="row-wrap s-loose"><Rank :v="7" lg /><Rank :v="8" lg /><span class="t-small">lg，用在成绩详情</span></div>
            </div>
          </div>

          <div class="s-spec">
            <div class="s-k">封面<small>Cover</small></div>
            <div class="col">
              <div class="row-wrap s-loose s-end">
                <Cover :song="tengu" size="sm" /><Cover :song="tengu" /><Cover :song="tengu" size="lg" /><Cover :song="tengu" size="xl" />
              </div>
              <div class="row-wrap">
                <Cover v-for="s in genreSongs" :key="s.id" :song="s" />
              </div>
              <p class="s-guide">sm 32 用在紧凑表格，默认 44 用在列表，lg 72 用在卡片，xl 168 用在详情页头。原型里按流派色生成，上线后换成真实封面，尺寸和圆角不变。</p>
            </div>
          </div>

          <div class="s-spec">
            <div class="s-k">歌曲单元<small>SongCell</small></div>
            <div class="s-pair">
              <SongCell :song="tengu" />
              <SongCell :song="songById[100126]" :sub="L('定数 8.54，贴近你现在的手速区间', '定数 8.54、いまの手速に近い')" />
            </div>
          </div>

          <div class="s-spec">
            <div class="s-k">判定条<small>.judge</small></div>
            <div class="s-judge">
              <div class="judge" role="img" :aria-label="`${L('良', '良')} ${tenguScore.good}, ${L('可', '可')} ${tenguScore.ok}, ${L('不可', '不可')} ${tenguScore.ng}`">
                <i class="g" :style="{ flex: tenguScore.good }" /><i class="o" :style="{ flex: tenguScore.ok }" /><i class="n" :style="{ flex: tenguScore.ng }" />
              </div>
              <div class="judge-legend">
                <span>{{ L('良', '良') }}<b>{{ tenguScore.good }}</b></span><span>{{ L('可', '可') }}<b>{{ tenguScore.ok }}</b></span><span>{{ L('不可', '不可') }}<b>{{ tenguScore.ng }}</b></span>
              </div>
            </div>
          </div>

          <div class="s-spec top">
            <div class="s-k">成长事实<small>FactRow</small></div>
            <div class="panel s-rows">
              <FactRow v-for="f in factSamples" :key="f.type" :fact="f" />
            </div>
          </div>

          <div class="s-spec top">
            <div class="s-k">帖子行<small>ThreadRow</small></div>
            <div class="col">
              <div class="panel s-rows"><ThreadRow :thread="threads[1]" /></div>
              <div class="panel s-rows s-narrow"><ThreadRow :thread="threads[3]" compact /><ThreadRow :thread="threads[6]" compact /></div>
            </div>
          </div>

          <div class="s-spec top">
            <div class="s-k">目标卡<small>GoalCard</small></div>
            <div class="s-narrow"><GoalCard :goal="activeGoal" /></div>
          </div>

          <div class="s-spec top">
            <div class="s-k">空、错、等<small>EmptyLane</small></div>
            <div class="s-empties">
              <div v-for="e in EMPTY" :key="e.tone" class="panel">
                <EmptyLane :title="e.title" :text="e.text" :tone="e.tone" compact>
                  <button v-if="e.tone !== 'loading'" class="btn btn-sm">{{ e.tone === 'error' ? L('再试一次', '再試行') : L('同步成绩', '成績を同期') }}</button>
                </EmptyLane>
              </div>
            </div>
          </div>

          <div class="s-spec top">
            <div class="s-k">权限引导<small>Gate</small></div>
            <div class="col">
              <div class="s-gate"><Gate :what="L('成绩', '成績')" /></div>
              <p class="s-guide">未登录、未绑定、未同步都留在原页面，说明差哪一步并给出那一步的按钮。显示哪一种取决于当前登录状态。</p>
            </div>
          </div>

          <div class="s-dd">
            <div><b>用法</b>需要表达难度、王冠、评价时直接放组件；需要新的游戏语义时先加到 domain.css。</div>
            <div class="no"><b>不要</b>在页面的 scoped 样式里重新给这些类上色；不要用文字「全连」「紫雅」代替组件。</div>
          </div>
        </section>

        <!-- ============ 08 图表与数据展示 ============ -->
        <section id="ds-charts" class="s-sec">
          <h2 class="t-h1"><span class="s-n num">08</span>图表与数据展示</h2>
          <p class="s-lede">图表回答一个问题，数字给出准确答案，两者总是一起出现。玩家不需要悬停、不需要辨色，也能读到自己的成绩。</p>

          <h3 class="t-h2 s-sub">Lane</h3>
          <Lane v-model="laneSel" :days="laneDays" />
          <div class="panel s-readout">
            <p class="row-wrap"><b>{{ dayText(laneDay) }}</b><span class="t-small">{{ laneDay.played ? `碰了 ${laneDay.charts} 张谱，${laneDay.facts.length} 条进展` : '这天没有游玩记录' }}</span></p>
            <FactRow v-for="(f, i) in laneDay.facts.slice(0, 3)" :key="laneSel + '-' + i" :fact="f" dense />
          </div>
          <ul class="s-legend">
            <li v-for="l in LEGEND" :key="l.t">
              <i v-if="l.bar" class="s-rollbar" /><i v-else class="note" :class="l.cls" />
              <span><b>{{ l.t }}</b><span class="t-small">{{ l.d }}</span></span>
            </li>
          </ul>
          <p class="s-guide">时间从左到右，判定圈落在今天；竖线是每周一，相当于小节线；音符上方的数字是当天的进展条数。一列只画一个音符，取当天最重要的那条。溢出时（手机）默认滚到最右端的今天。谱面带在两个主题下都是深色，颜色全部来自 --lane-* token（--lane-don / --lane-ka / --lane-roll / --lane-fc / --lane-ring / --lane-outline / --lane-ghost / --lane-measure），半透明层从 --lane-ink 用 color-mix 派生。</p>
          <div class="s-spec">
            <div class="s-k">compact<small>侧栏、个人主页</small></div>
            <div class="col">
              <div class="s-mini"><Lane v-model="miniSel" :days="miniDays" compact /></div>
              <span class="t-small">选中：{{ dayText(miniDay) }}，{{ miniDay.facts.length }} 条进展</span>
            </div>
          </div>

          <h3 class="t-h2 s-sub">DrumDial</h3>
          <div class="row-wrap s-loose">
            <DrumDial :value="player.rating" :size="168">
              <span class="t-caption">Rating</span>
              <b class="num s-dial-v">{{ player.rating.toFixed(2) }}</b>
              <span class="t-caption">/ 15.5</span>
            </DrumDial>
            <DrumDial :value="activeGoal.progress" :max="1" :step="1 / 24" :size="120" tone="ka">
              <b class="num s-dial-v sm">{{ Math.round(activeGoal.progress * 100) }}%</b>
              <span class="t-caption">{{ L('目标进度', '目標の進み') }}</span>
            </DrumDial>
            <p class="s-guide s-fill">鼓面边缘的鋲就是刻度：Rating 每颗 0.5，共 31 颗。中间永远写着准确的数字，刻度只负责「大概到哪了」。</p>
          </div>

          <h3 class="t-h2 s-sub">Radar</h3>
          <div class="s-radars">
            <figure>
              <Radar :axes="dimAxes" :focus="player.focus" :size="300" />
              <figcaption class="t-caption">六维。虚线是 30 天前，浅葱实心点是当前关注方向。量程自动收窄并写在图上。</figcaption>
            </figure>
            <figure>
              <Radar :axes="chartAxes" :domain="[0, 15.5]" :size="280" tone="var(--ka)" />
              <figcaption class="t-caption">谱面五维，固定量程 0–15.5，不同谱面之间可以直接比形状。</figcaption>
            </figure>
          </div>

          <h3 class="t-h2 s-sub">LineChart</h3>
          <div class="panel panel-pad">
            <div class="spread s-linehead">
              <div class="stat"><div class="v">{{ player.rating.toFixed(2) }}<span class="d up">+{{ (linePoints[linePoints.length - 1].v - linePoints[0].v).toFixed(2) }}</span></div><div class="k">Rating · {{ L('近 90 天', '直近 90 日') }}</div></div>
              <span class="row t-small"><i class="dot" style="color: var(--roll)" />{{ L('里程碑', 'マイルストーン') }}</span>
            </div>
            <LineChart :points="linePoints" :marks="lineMarks" :height="210" />
          </div>

          <h3 class="t-h2 s-sub">DensityStrip · Spark · ChartSheet</h3>
          <div class="s-spec">
            <div class="s-k">DensityStrip<small>每小节密度</small></div>
            <div class="col">
              <DensityStrip :values="tenguChart.density" :height="48" />
              <div class="spread t-caption"><span class="num">1</span><span>朱色是难点所在的小节</span><span class="num">64</span></div>
            </div>
          </div>
          <div class="s-spec">
            <div class="s-k">Spark<small>行内趋势</small></div>
            <div class="row-wrap s-loose">
              <span class="row"><Spark :values="sparkRating" /><b class="num s-evnum sm">{{ player.rating.toFixed(2) }}</b></span>
              <span class="row"><Spark :values="dimHistory.speed" tone="var(--ka)" /><b class="num s-evnum sm">{{ player.dims.speed.toFixed(2) }}</b></span>
              <span class="t-small">没有坐标轴，所以右边必须跟着当前值。</span>
            </div>
          </div>
          <div class="s-spec top">
            <div class="s-k">ChartSheet<small>谱面图</small></div>
            <ChartSheet :seed="615" :density="tenguChart.density" :rows="2" />
          </div>

          <h3 class="t-h2 s-sub">规则</h3>
          <ul class="s-rules">
            <li>只有一个序列的图不画图例，标题已经说明了它是什么。</li>
            <li>参考线最多 3 到 4 条，用 --line；数据线 2px 以上。</li>
            <li>图上的每个关键值，在图旁边都能以文字读到。</li>
            <li>颜色不是唯一的信息载体：王冠有形状和标签，评价有字形。</li>
            <li>成绩列右对齐，使用等宽数字。</li>
          </ul>
          <div class="panel scroll-x s-gap">
            <table class="dt">
              <thead>
                <tr><th>数据</th><th>写法</th><th class="r">示例</th></tr>
              </thead>
              <tbody>
                <tr v-for="f in FORMATS" :key="f.k">
                  <td>{{ f.k }}</td><td>{{ f.rule }}</td><td class="r num s-score">{{ f.ex }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- ============ 09 交互状态与动效 ============ -->
        <section id="ds-motion" class="s-sec">
          <h2 class="t-h1"><span class="s-n num">09</span>交互状态与动效</h2>
          <p class="s-lede">每个可交互元素都有同一套状态，用户在任何页面都能预判「这个能点、点了会怎样」。动效只用来回应一次操作或一次状态变化，不做装饰。</p>

          <div class="panel scroll-x s-gap">
            <table class="dt s-w560">
              <thead>
                <tr><th>状态</th><th>处理方式</th></tr>
              </thead>
              <tbody>
                <tr v-for="s in STATES" :key="s.en">
                  <td class="s-nowrap"><b>{{ s.s }}</b> <code>{{ s.en }}</code></td><td>{{ s.how }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="s-spec">
            <div class="s-k">焦点<small>--focus</small></div>
            <div class="col">
              <div class="row-wrap s-loose">
                <button class="btn s-focus">{{ L('查看谱面', '譜面を見る') }}</button>
                <button class="chip s-focus">24 分</button>
                <input class="input s-focus s-focus-in" :value="L('千本樱', '千本桜')" :aria-label="L('示例输入', '入力例')" />
                <a class="link s-focus" href="#/review">{{ L('设计总览', 'デザイン概要') }}</a>
              </div>
              <p class="s-guide">上面四个是把焦点环固定显示出来的样本。在本页按 Tab 键，可以看到它依次落在每个控件上。</p>
            </div>
          </div>

          <h3 class="t-h2 s-sub">动效</h3>
          <div class="s-motion">
            <div class="s-tracks">
              <div v-for="m in MOTION" :key="m.token" class="s-track">
                <code>{{ m.token }}</code><span class="num">{{ m.v }}</span>
                <span class="s-trk" :class="{ on: played }" :style="{ '--d': `var(${m.token})` }"><i /></span>
                <span class="t-small">{{ m.use }}</span>
              </div>
              <div class="s-track">
                <code>--ease-out</code><span class="num">.2, .8, .2, 1</span>
                <span class="s-hit"><i class="note big s-hitnote flat" :class="{ on: played }" /></span>
                <span class="t-small">默认曲线：快出慢停</span>
              </div>
              <div class="s-track">
                <code>--ease-hit</code><span class="num">.3, 1.6, .5, 1</span>
                <span class="s-hit"><i class="note big s-hitnote" :class="{ on: played }" /></span>
                <span class="t-small">击打回弹只用于按下圆形击打物（咚键、播放键、音符）与达成反馈</span>
              </div>
            </div>
            <div class="row-wrap">
              <button class="btn btn-sm" @click="played = !played"><Icon name="playTri" :size="14" />{{ played ? '复位' : '播放' }}</button>
              <button class="btn btn-sm" @click="fadeOpen = !fadeOpen">{{ fadeOpen ? '收起面板' : '展开面板' }}</button>
            </div>
            <div class="s-fadebox">
              <Transition name="pop">
                <div v-if="fadeOpen" class="panel panel-pad s-fade"><b>浮层出现</b><span class="t-small">透明度 + 8px 位移，--dur-2 与 --ease-out；离开用 --dur-1，比出现更快。</span></div>
              </Transition>
            </div>
          </div>
          <ul class="s-rules">
            <li>动效只回应一次操作或一次状态变化；页面加载时不做入场动画。</li>
            <li>--ease-hit：击打回弹只用于按下圆形击打物（咚键、播放键、音符）与达成反馈。</li>
            <li>一个页面最多一个编排过的瞬间，留给新王冠落下的时候。</li>
            <li>prefers-reduced-motion 下所有时长归零，信息不能只靠动效传达。</li>
          </ul>

          <h3 class="t-h2 s-sub">反馈</h3>
          <div class="panel scroll-x">
            <table class="dt s-w560">
              <thead>
                <tr><th>场景</th><th>方式</th></tr>
              </thead>
              <tbody>
                <tr v-for="f in FEEDBACK" :key="f.when">
                  <td><b>{{ f.when }}</b></td><td>{{ f.how }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="row-wrap s-gap">
            <button class="btn s-like" :aria-pressed="like.on" @click="toggleLike"><Icon name="heart" :size="16" /><span class="num">{{ like.n }}</span>{{ like.on ? L('已赞', 'いいね済み') : L('赞', 'いいね') }}</button>
            <button class="btn" @click="toast(L('同步完成：4 条新进展', '同期完了：新しい記録 4 件'))">{{ L('完成后的 toast', '完了時の toast') }}</button>
            <button class="btn" @click="sheetOpen = true">{{ L('破坏性确认', '削除の確認') }}</button>
          </div>
        </section>

        <!-- ============ 10 无障碍与国际化 ============ -->
        <section id="ds-a11y" class="s-sec">
          <h2 class="t-h1"><span class="s-n num">10</span>无障碍与国际化</h2>
          <p class="s-lede">机厅里光线暗、单手操作、中日文混排是常态。下面每一条都是验收项，不是建议。</p>
          <ul class="s-check">
            <li v-for="c in CHECKS" :key="c.t">
              <Icon name="check" :size="16" />
              <b>{{ c.t }}</b>
              <span>{{ c.d }}</span>
            </li>
          </ul>
          <div class="s-spec">
            <div class="s-k">文本膨胀<small>中文 / 日本語</small></div>
            <div class="col">
              <div class="row-wrap" lang="zh-CN">
                <button v-for="(e, i) in EXPAND" :key="i" class="btn" :class="{ 'btn-primary': i === 0 }">{{ e[0] }}</button>
              </div>
              <div class="row-wrap" lang="ja">
                <button v-for="(e, i) in EXPAND" :key="i" class="btn" :class="{ 'btn-primary': i === 0 }">{{ e[1] }}</button>
              </div>
            </div>
          </div>
          <div class="s-spec">
            <div class="s-k">形状冗余<small>去掉颜色也能读</small></div>
            <div class="row-wrap s-loose s-gray">
              <Crown :v="0" label /><Crown :v="1" label /><Crown :v="2" label /><Rank :v="4" label /><Rank :v="7" label /><Rank :v="8" label />
              <span class="num up">+0.31</span><span class="num down">−0.04</span>
            </div>
          </div>
        </section>

        <!-- ============ 11 与现有实现的映射 ============ -->
        <section id="ds-mapping" class="s-sec">
          <h2 class="t-h1"><span class="s-n num">11</span>与现有实现的映射</h2>
          <p class="s-lede">迁移时按这张表逐项替换。Design V1 的 token 可以和现有的 --viewer-* 并存，一个页面一个页面地换。</p>
          <div class="panel scroll-x">
            <table class="dt s-w680">
              <thead>
                <tr><th>现在</th><th>Design V1</th><th>用户得到什么</th></tr>
              </thead>
              <tbody>
                <tr v-for="m in MAPPING" :key="m.old">
                  <td class="s-old">{{ m.old }}</td><td><b>{{ m.now }}</b></td><td>{{ m.why }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>

    <Sheet :open="sheetOpen" :title="L('删除这条手动成绩？', 'この手動スコアを削除しますか？')" :width="440" @close="sheetOpen = false">
      <p>{{ L('删除后，这张谱面会回到上一次同步的成绩，Rating 会重新计算。这个操作不能撤销。', '削除すると前回同期したスコアに戻り、Rating が再計算されます。この操作は取り消せません。') }}</p>
      <template #foot>
        <button class="btn" @click="sheetOpen = false">{{ L('取消', 'キャンセル') }}</button>
        <button class="btn btn-danger" @click="confirmDelete">{{ L('删除', '削除する') }}</button>
      </template>
    </Sheet>
  </div>
</template>

<style scoped>
/* ---------- 页面骨架 ---------- */
.s-root {
  min-height: 100dvh;
  background: var(--bg);
}
.s-probe {
  position: absolute;
  width: 0;
  height: 0;
  visibility: hidden;
}
.s-top {
  position: sticky;
  top: 0;
  z-index: var(--z-bar);
  background: var(--surface);
  border-bottom: 1px solid var(--line);
}
.s-top-in {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  height: var(--bar-h);
  max-width: 1380px;
  margin: 0 auto;
  padding: 0 var(--gutter);
}
.s-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-size: var(--fs-16);
  white-space: nowrap;
}
.s-brand b {
  font-weight: 700;
}
.s-back {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: var(--fs-13);
  white-space: nowrap;
}
.s-ctl {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
.s-ctl-page {
  display: none;
  margin-top: var(--sp-4);
}
.s-chips {
  display: none;
  gap: var(--sp-2);
  padding: 8px var(--gutter);
  overflow-x: auto;
  scrollbar-width: none;
  border-top: 1px solid var(--line);
}
.s-chips::-webkit-scrollbar {
  display: none;
}
.s-chips .chip[aria-current='true'] {
  background: var(--ink);
  border-color: var(--ink);
  color: var(--bg);
}
.s-frame {
  display: grid;
  grid-template-columns: 200px minmax(0, 1080px);
  gap: var(--sp-12);
  max-width: 1380px;
  margin: 0 auto;
  padding: var(--sp-8) var(--gutter) var(--sp-16);
}
.s-toc {
  position: sticky;
  top: calc(var(--bar-h) + var(--sp-6));
  align-self: start;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: calc(100dvh - var(--bar-h) - var(--sp-12));
  overflow-y: auto;
}
.s-toc button {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 7px 10px;
  border-radius: var(--r-ctl);
  font-size: var(--fs-13);
  color: var(--ink-2);
  text-align: left;
}
.s-toc button:hover {
  color: var(--ink);
  background: var(--bg-sunk);
}
.s-toc button[aria-current='true'] {
  background: var(--surface);
  color: var(--ink);
  font-weight: 700;
  box-shadow: inset 0 0 0 1px var(--line);
}
.s-toc .num {
  color: var(--ink-3);
}
.s-toc button[aria-current='true'] .num {
  color: var(--don-ink);
}
.s-doc {
  min-width: 0;
}
.s-sec {
  margin-top: var(--sp-12);
  padding-top: var(--sp-10);
  border-top: 1px solid var(--line-strong);
  scroll-margin-top: calc(var(--bar-h) + var(--sp-4));
}
.s-sec > h2 {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
}
.s-n {
  font-size: var(--fs-18);
  font-weight: 700;
  color: var(--don-ink);
}
.s-lede {
  margin-top: var(--sp-3);
  max-width: 44em;
  font-size: var(--fs-16);
  color: var(--ink-2);
}
.s-sub {
  margin: var(--sp-10) 0 var(--sp-3);
}
.s-guide {
  max-width: 52em;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.s-gap {
  margin-top: var(--sp-5);
}
code {
  padding: 1px 5px;
  border-radius: var(--r-xs);
  background: var(--bg-sunk);
  font-family: var(--font-num);
  font-size: var(--fs-13);
  font-weight: 500;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.s-w560 {
  min-width: 560px;
}
.s-w680 {
  min-width: 680px;
}
.s-nowrap {
  white-space: nowrap;
}

/* ---------- 样本行、用法对照 ---------- */
.s-spec {
  display: grid;
  grid-template-columns: 136px minmax(0, 1fr);
  gap: var(--sp-2) var(--sp-5);
  align-items: center;
  padding: var(--sp-5) 0;
  border-top: 1px solid var(--line);
}
.s-lede + .s-spec,
.s-sub + .s-spec {
  border-top: 0;
  padding-top: var(--sp-2);
}
.s-lede + .s-spec {
  margin-top: var(--sp-5);
}
.s-spec.top {
  align-items: start;
}
.s-k {
  font-size: var(--fs-13);
  font-weight: 700;
}
.s-k small {
  display: block;
  font-size: var(--fs-12);
  font-weight: 400;
  color: var(--ink-3);
}
.s-dd {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-5);
  margin-top: var(--sp-5);
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.s-dd > div {
  padding-left: var(--sp-3);
  border-left: 3px solid var(--ok);
}
.s-dd > .no {
  border-left-color: var(--danger);
}
.s-dd b {
  display: block;
  color: var(--ok);
}
.s-dd .no b {
  color: var(--danger);
}
.s-pair {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-5) var(--sp-10);
}
.s-pair > * {
  flex: 1 1 240px;
  min-width: 0;
  max-width: 380px;
}
.s-loose {
  gap: var(--sp-3) var(--sp-5);
}
.s-end {
  align-items: flex-end;
}
.s-narrow {
  max-width: 440px;
}
.s-fill {
  flex: 1 1 240px;
}
.s-rows {
  padding: 2px var(--sp-5);
}

/* ---------- 01 原则 ---------- */
.s-principles {
  margin-top: var(--sp-5);
  counter-reset: p;
}
.s-principles li {
  position: relative;
  padding: var(--sp-5) 0 var(--sp-5) 52px;
  border-top: 1px solid var(--line);
  counter-increment: p;
}
.s-principles li:first-child {
  border-top: 0;
}
.s-principles li::before {
  content: counter(p);
  position: absolute;
  left: 0;
  top: var(--sp-4);
  font-family: var(--font-num);
  font-size: var(--fs-36);
  font-weight: 700;
  line-height: 1;
  color: var(--line-strong);
}
.s-principles p {
  margin-top: 4px;
  max-width: 46em;
  color: var(--ink-2);
}
.s-ev {
  display: flex;
  align-items: center;
  gap: var(--sp-5);
  margin-top: var(--sp-3);
  font-size: var(--fs-13);
}
.s-ev .row {
  gap: var(--sp-2);
}
.s-evnum {
  font-size: var(--fs-28);
  font-weight: 700;
  line-height: 1;
}
.s-evnum.sm {
  font-size: var(--fs-18);
}
.s-evhan {
  font-size: var(--fs-22);
  font-weight: 900;
}

/* ---------- 02 颜色 ---------- */
.s-ramp {
  margin-top: var(--sp-4);
}
.s-ramp-h {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
  margin-bottom: var(--sp-2);
}
.s-sws {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: var(--sp-3) var(--sp-2);
}
.s-sws li,
.s-dom li {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  min-width: 0;
}
.s-sws .num,
.s-dom .num {
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.s-chip {
  display: block;
  width: 100%;
  height: 40px;
  border-radius: var(--r-ctl);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 14%, transparent);
}
.s-chip.sm {
  width: 32px;
  height: 22px;
}
.s-dom {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: var(--sp-4) var(--sp-3);
}
.s-dom .s-chip {
  height: 24px;
  margin-bottom: 3px;
}
.s-genre {
  gap: 6px;
  font-size: var(--fs-13);
  font-weight: 500;
}
.s-cr {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--r-xs);
  font-size: var(--fs-12);
  font-weight: 500;
  white-space: nowrap;
  box-shadow: inset 0 0 0 1px var(--line);
}
.s-ratio {
  font-size: var(--fs-16);
}

/* ---------- 03 字体 ---------- */
.s-m {
  display: block;
}
.s-sample {
  white-space: nowrap;
}
.s-fs {
  display: inline-block;
  margin-right: 4px;
}
/* 说明文字里的行内代码可以折行，不把页面撑出横向滚动 */
.s-guide code,
.s-lede code,
.s-dd code,
.s-rules code {
  white-space: normal;
  overflow-wrap: anywhere;
}
.s-nums {
  border-top: 1px solid var(--line);
}
.s-numrow {
  display: flex;
  align-items: baseline;
  gap: var(--sp-6);
  padding: var(--sp-3) 0;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}
.s-numrow code {
  flex: none;
  width: 108px;
  background: none;
  padding: 0;
  color: var(--ink-3);
}
.s-numrow .num {
  line-height: 1.1;
}
.s-glyphs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-4);
  margin-top: var(--sp-4);
}
.s-glyphs > div {
  padding: var(--sp-4) var(--sp-5);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  min-width: 0;
}
.s-glyphs p {
  margin-top: var(--sp-2);
  font-size: var(--fs-36);
  font-weight: 900;
  line-height: var(--lh-snug);
}

/* ---------- 04 间距、圆角、层级 ---------- */
.s-sp li {
  display: grid;
  grid-template-columns: 76px 28px 72px minmax(0, 1fr);
  align-items: center;
  gap: var(--sp-3);
  padding: 7px 0;
  border-bottom: 1px solid var(--line);
}
.s-sp code {
  justify-self: start;
}
.s-sp .num {
  text-align: right;
  color: var(--ink-2);
}
.s-sp-bar i {
  display: block;
  height: 14px;
  border-radius: 3px;
  background: var(--ka);
}
.s-radii {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--sp-4);
}
.s-radii li {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.s-radii i {
  display: block;
  width: 100%;
  height: 64px;
  margin-bottom: var(--sp-2);
  background: var(--surface);
  border: 1.5px solid var(--ink);
}
.s-radii .num {
  color: var(--ink-2);
}
.s-radii + .s-guide {
  margin-top: var(--sp-4);
}
.s-elev {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--sp-6);
  padding: var(--sp-2) 0 var(--sp-4);
}
.s-elev .panel {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: var(--sp-5);
}
.s-elev .lift {
  box-shadow: var(--shadow-lift);
}
.s-elev .pop {
  border-color: transparent;
  box-shadow: var(--shadow-pop);
}

/* ---------- 05 布局示意 ---------- */
.s-frames {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 190px;
  gap: var(--sp-6);
  margin-top: var(--sp-6);
}
.s-frames figcaption {
  margin-top: var(--sp-2);
}
.s-fd,
.s-fm {
  height: 300px;
  border: 1px solid var(--line-strong);
  border-radius: var(--r-panel);
  overflow: hidden;
  background: var(--bg);
  font-size: var(--fs-12);
  color: var(--ink-2);
}
.s-fd {
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr);
  min-width: 520px;
}
.s-fd b,
.s-fm b {
  color: var(--ink);
  font-size: var(--fs-14);
}
.s-fd-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  background: var(--surface);
  border-right: 1px solid var(--line);
}
.s-fd-rail i:not(.note) {
  width: 30px;
  height: 18px;
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
}
.s-fd-rail .note {
  margin-bottom: 6px;
}
.s-fd-rail span {
  margin-top: auto;
  text-align: center;
  line-height: 1.3;
}
.s-fd-rail b {
  display: block;
}
.s-fd-main {
  display: grid;
  grid-template-rows: 42px minmax(0, 1fr);
  min-width: 0;
}
.s-fd-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: 0 var(--sp-4);
  background: var(--surface);
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}
.s-fd-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 30%;
  gap: var(--sp-3);
  padding: var(--sp-4);
}
.s-fd-box {
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 2px;
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  text-align: center;
}
.s-fd-box.side {
  border-style: dashed;
  border-color: var(--line-strong);
  background: transparent;
}
.s-fm {
  position: relative;
  display: grid;
  grid-template-rows: 30px minmax(0, 1fr) 38px;
}
.s-fm-head {
  display: flex;
  align-items: center;
  padding: 0 var(--sp-3);
  background: var(--surface);
  border-bottom: 1px solid var(--line);
}
.s-fm-body {
  display: grid;
  place-content: center;
  justify-items: center;
  margin: var(--sp-2);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
.s-fm-tab {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  place-items: center;
  background: var(--surface);
  border-top: 1px solid var(--line);
}
.s-fm-tab i {
  width: 16px;
  height: 16px;
  border-radius: var(--r-xs);
  background: var(--bg-sunk);
}
.s-fm-tab .note {
  --n: 30px;
  margin-top: -14px;
}
.s-fm-cap {
  position: absolute;
  left: var(--sp-3);
  bottom: 46px;
}

/* ---------- 06 基础组件 ---------- */
.s-fields {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--sp-4);
}
.s-wide {
  grid-column: 1 / -1;
  max-width: 460px;
}
.s-songcol {
  max-width: 260px;
}
.s-score {
  font-size: var(--fs-16);
}
.s-stats {
  gap: var(--sp-8);
}
.s-skel {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}
.s-sk-cover {
  width: 44px;
  height: 44px;
  border-radius: var(--r-ctl);
  flex: none;
}
.s-sk-lines {
  flex: 1;
  gap: var(--sp-2);
}
.s-sk-num {
  width: 64px;
  height: 20px;
  flex: none;
}

/* ---------- 07 业务组件 ---------- */
.s-notes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--sp-4);
}
.s-notes li {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  align-items: center;
  gap: 2px var(--sp-2);
}
.s-notes .note {
  justify-self: center;
}
.s-notes .t-small {
  grid-column: 2;
}
.s-matrix {
  width: auto;
  min-width: 560px;
}
.s-matrix th {
  padding: 6px 20px 6px 0;
  font-size: var(--fs-12);
  font-weight: 500;
  color: var(--ink-3);
  text-align: left;
  white-space: nowrap;
}
.s-matrix td {
  padding: 6px 20px 6px 0;
}
.s-judge {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  max-width: 380px;
}
.s-empties {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: var(--sp-4);
}
.s-gate :deep(.gate) {
  margin: 0;
}

/* ---------- 08 图表 ---------- */
.s-readout {
  margin-top: var(--sp-3);
  padding: var(--sp-3) var(--sp-5) 2px;
}
.s-readout > p {
  padding-bottom: var(--sp-2);
}
.s-legend {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: var(--sp-3) var(--sp-5);
  margin: var(--sp-5) 0 var(--sp-4);
}
.s-legend li {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: center;
  gap: var(--sp-2);
}
.s-legend li > i {
  justify-self: center;
}
.s-legend b {
  display: block;
  font-size: var(--fs-13);
}
.s-rollbar {
  width: 26px;
  height: 10px;
  background: color-mix(in srgb, var(--roll) 62%, transparent);
}
.s-mini {
  max-width: 360px;
}
.s-dial-v {
  font-size: var(--fs-36);
  font-weight: 700;
  line-height: 1;
}
.s-dial-v.sm {
  font-size: var(--fs-22);
}
.s-radars {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--sp-6);
}
.s-radars figure {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  min-width: 0;
}
.s-radars figcaption {
  max-width: 30em;
  text-align: center;
}
.s-linehead {
  margin-bottom: var(--sp-3);
  align-items: flex-end;
}
.s-rules {
  display: flex;
  flex-direction: column;
  max-width: 52em;
}
.s-rules li {
  position: relative;
  padding: 9px 0 9px 22px;
  border-bottom: 1px solid var(--line);
}
.s-rules li::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 17px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--don);
}

/* ---------- 09 状态与动效 ---------- */
.s-focus {
  box-shadow: var(--focus);
}
.s-focus-in {
  width: 160px;
  border-color: var(--ka);
}
a.s-focus {
  border-radius: var(--r-ctl);
}
.s-motion {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}
.s-track {
  display: grid;
  grid-template-columns: 92px 84px minmax(80px, 220px) minmax(0, 1fr);
  align-items: center;
  gap: var(--sp-3);
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
}
.s-track code {
  justify-self: start;
}
.s-track .num {
  color: var(--ink-2);
}
.s-trk {
  position: relative;
  height: 22px;
  border-radius: var(--r-note);
  background: var(--bg-sunk);
}
.s-trk i {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--ka);
  transition: left var(--d) var(--ease-out);
}
.s-trk.on i {
  left: calc(100% - 18px);
}
.s-hit {
  display: grid;
  place-items: center;
  justify-self: start;
  width: 44px;
  height: 36px;
}
.s-hitnote {
  transition: transform var(--dur-3) var(--ease-hit);
}
.s-hitnote.flat {
  transition-timing-function: var(--ease-out);
}
.s-hitnote.on {
  transform: scale(1.5);
}
.s-fadebox {
  min-height: 92px;
}
.s-fade {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 440px;
  box-shadow: var(--shadow-pop);
}
.s-like[aria-pressed='true'] {
  border-color: var(--don);
  color: var(--don-ink);
}

/* ---------- 10 清单 ---------- */
.s-check {
  margin-top: var(--sp-5);
}
.s-check li {
  display: grid;
  grid-template-columns: 20px 132px minmax(0, 1fr);
  gap: var(--sp-3);
  align-items: baseline;
  padding: var(--sp-3) 0;
  border-top: 1px solid var(--line);
}
.s-check li > :deep(svg) {
  align-self: center;
  color: var(--ok);
}
.s-check span {
  color: var(--ink-2);
}
.s-check + .s-spec {
  border-top-color: var(--line-strong);
}
.s-gray {
  filter: grayscale(1);
}
.s-old {
  color: var(--ink-2);
}

/* ---------- 响应式 ---------- */
@media (max-width: 1099px) {
  .s-frame {
    grid-template-columns: minmax(0, 1fr);
    padding-top: var(--sp-6);
  }
  .s-toc {
    display: none;
  }
  .s-chips {
    display: flex;
  }
  .s-sec {
    scroll-margin-top: calc(var(--bar-h) + 46px + var(--sp-4));
  }
}
@media (max-width: 767px) {
  .s-top-in {
    height: 52px;
    gap: var(--sp-3);
  }
  .s-ctl-bar {
    display: none;
  }
  .s-ctl-page {
    display: flex;
  }
  .s-sec {
    margin-top: var(--sp-10);
    padding-top: var(--sp-8);
    scroll-margin-top: calc(52px + 52px + var(--sp-3));
  }
  .s-sub {
    margin-top: var(--sp-8);
  }
  .s-spec {
    grid-template-columns: minmax(0, 1fr);
  }
  .s-k small {
    display: inline;
    margin-left: var(--sp-2);
  }
  .s-dd,
  .s-glyphs,
  .s-frames,
  .s-elev {
    grid-template-columns: minmax(0, 1fr);
  }
  .s-frames figure:last-child {
    max-width: 190px;
  }
  .s-glyphs p {
    font-size: var(--fs-28);
  }
  .s-radii {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .s-principles li {
    padding-left: 36px;
  }
  .s-principles li::before {
    font-size: var(--fs-28);
  }
  .s-ev {
    flex-wrap: wrap;
  }
  .s-sp li {
    grid-template-columns: 70px 24px 68px minmax(0, 1fr);
    gap: var(--sp-2);
  }
  .s-track {
    grid-template-columns: 84px minmax(0, 1fr);
  }
  .s-track .s-trk,
  .s-track .s-hit,
  .s-track .t-small {
    grid-column: 1 / -1;
  }
  .s-check li {
    grid-template-columns: 20px minmax(0, 1fr);
  }
  .s-check span {
    grid-column: 2;
  }
  .s-rows {
    padding: 2px var(--sp-4);
  }
}
</style>
