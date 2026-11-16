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
import Popover from '../../components/Popover.vue'
import VirtualList from '../../components/VirtualList.vue'
import PlayerAvatar from '../../components/PlayerAvatar.vue'
import TitlePlate from '../../components/TitlePlate.vue'
import DanBadge from '../../components/DanBadge.vue'
import TimeStack from '../../components/TimeStack.vue'
import SyncPanel from '../../components/SyncPanel.vue'
import SyncButton from '../../components/SyncButton.vue'
import { store, L, toast, resolvedTheme, songTitle, songSub, subLang } from '../../store'
import { prefersReducedMotion, scrollBehavior } from '../../motion'
import { BP } from '../../breakpoints'
import { useQueryState } from '../../routeState'
import {
  songs, songById, chartOf, scoreOf, bestList, laneDays, player, DIMS, CHART_AXES, RANKS, DIFFS, GENRES, UGC_TAGS,
  ratingHistory, dimHistory, goals, threads, users, milestones, EDGE, datasetInfo, fmt, sections,
} from '../../mock/data'

// Design System V1.1：活的规范页。所有样本都直接渲染 tokens.css / base.css / domain.css 与 src/components，
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
  { id: 'ds-voice', t: '模块的视觉表现' },
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
  document.getElementById(id)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
  active.value = id
}

/* ---------------- 颜色：实时读取 ---------------- */
const PRIMS = [
  { key: 'ai', name: '藍 ai', note: '墨色与中性色。所有底、线、字都从这里取。', tokens: [950, 900, 850, 800, 750, 700, 600, 500, 400, 300, 200, 150, 100, 50, 0].map((n) => `ai-${n}`) },
  { key: 'shu', name: '朱 shu', note: '咚。650 是文字级。', tokens: [700, 650, 600, 500, 400, 100].map((n) => `shu-${n}`) },
  { key: 'asagi', name: '浅葱 asagi', note: '咔。', tokens: [700, 600, 500, 400, 100].map((n) => `asagi-${n}`) },
  { key: 'yamabuki', name: '山吹 yamabuki', note: '连打。600 只给非文字的状态点。', tokens: [700, 600, 500, 400, 100].map((n) => `yamabuki-${n}`) },
]
const SEMANTIC_GROUPS = [
  {
    g: '底与线',
    rows: [
      ['bg', '页面底'],
      ['bg-sunk', '凹陷区：分段控件底、骨架、标签底'],
      ['surface', '面板、对话框、输入框'],
      ['surface-2', '行 hover、面板内的次级面、称号牌底'],
      ['line', '分隔线、面板边'],
      ['line-strong', '表头线、分节线'],
      ['ctl-border', '按钮、输入框、选择框、文本域、分段、筛选胶囊的边框（非文字 ≥ 3:1）'],
    ],
  },
  {
    g: '文字',
    rows: [
      ['ink', '标题与正文'],
      ['ink-2', '次要文字'],
      ['ink-3', '说明、占位、刻度、缺失值「—」；在四种底色上都 ≥ 4.5:1'],
      ['ink-on-solid', '实色填充上的文字：主按钮、难度标签、选中的难度切换条'],
    ],
  },
  {
    g: '音符三色',
    rows: [
      ['don', '咚音符、指示、图形、当前页签'],
      ['don-solid', '主按钮填充'],
      ['don-ink', '文字级的朱'],
      ['don-wash', '朱的浅底'],
      ['ka', '咔音符、关注方向、选中的图形'],
      ['ka-ink', '链接、hover 标题'],
      ['ka-wash', '浅葱的浅底'],
      ['roll', '高光、里程碑标记'],
      ['roll-ink', '文字级的山吹'],
      ['roll-wash', '山吹的浅底'],
    ],
  },
  {
    g: '状态',
    rows: [
      ['ok', '上升、成功（文字级）'],
      ['ok-wash', '成功的浅底'],
      ['warn', '提醒文字'],
      ['danger', '下降、错误、破坏性按钮的描边与文字'],
      ['danger-wash', '危险的浅底'],
      ['status-attn', '状态点：需要你做一步、部分成功'],
      ['status-ok', '状态点：成功'],
      ['status-fail', '状态点：失败'],
    ],
  },
  {
    g: '焦点与浮层',
    rows: [
      ['focus-ring', '焦点环的实色环'],
      ['focus-gap', '焦点环与元素之间的间隙（= --surface）'],
      ['toast-bg', 'Toast、图表读数浮签的底'],
      ['toast-ink', 'Toast 上的文字'],
    ],
  },
  {
    g: '音符（谱面带内外通用）',
    rows: [
      ['note-ring', '音符白色内环；实色块上的白色图形'],
      ['note-outline', '音符深色外轮廓；压暗混色'],
      ['note-fc', '全连音符的金色内环'],
    ],
  },
  {
    g: '谱面带（只在 Lane、ChartSheet、EmptyLane 里）',
    rows: [
      ['lane', '谱面带底色，两个主题下都是深色'],
      ['lane-ink', '谱面带上的主文字'],
      ['lane-ink-2', '日期'],
      ['lane-ink-3', '星期、休息日、小节号；含选中列的提亮底'],
      ['lane-line', '轨线、周一小节线'],
      ['lane-measure', '谱面图里更醒目的小节线'],
      ['lane-don', '咚音符'],
      ['lane-ka', '咔音符'],
      ['lane-roll', '连打条'],
      ['lane-fc', '全连音符的金环（= --note-fc）'],
      ['lane-focus', '谱面带上的焦点环（--focus-lane 内描边）'],
      ['lane-ghost', '有游玩但没有新记录的小音符'],
      ['lane-ghost-ring', '上面那颗小音符的内环'],
    ],
  },
]
const SEMANTIC = SEMANTIC_GROUPS.flatMap((g) => g.rows)
const JUDGE_TOKENS = [
  { token: 'judge-good', use: '良（= --don）' },
  { token: 'judge-ok', use: '可（= --ink-3）' },
  { token: 'judge-ng', use: '不可（独立取值）' },
]
const DIFF_KEYS = [1, 2, 3, 4, 5].map((d) => ({ d, token: `diff-${DIFFS[d].key}`, ink: `diff-${DIFFS[d].key}-ink` }))
const CROWN_TOKENS = [
  { v: null, token: 'crown-none' },
  { v: -1, token: null },
  { v: 0, token: 'crown-clear' },
  { v: 1, token: 'crown-fc', ink: 'crown-fc-ink' },
  { v: 2, token: 'crown-dfc', gradient: true },
]
const RANK_TOKENS = [2, 3, 4, 5, 6, 7, 8].map((v) => ({ v, token: `rank-${RANKS[v].key}`, ink: v < 8 ? `rank-${RANKS[v].key}-ink` : null }))
const GENRE_TOKENS = Object.keys(GENRES).map((k) => ({ k, token: `genre-${k}` }))

// D11：对比度检查对（与 src/styles/contrast-check.mjs 同一份清单），在浏览器里用计算后的颜色现算
const tint = (c, p, on = 'surface') => `color-mix(in srgb, var(--${c}) ${p}%, var(--${on}))`
const PAIRS = (() => {
  const out = []
  const add = (group, fg, bg, min = 4.5, bgLabel) =>
    out.push({ group, fg: `var(--${fg})`, bg: bg.startsWith('color-mix') ? bg : `var(--${bg})`, fgLabel: `--${fg}`, bgLabel: bgLabel || `--${bg}`, min })
  for (const ink of ['ink', 'ink-2', 'ink-3']) for (const bg of ['bg', 'bg-sunk', 'surface', 'surface-2']) add('文字三档 × 四种底色', ink, bg)
  for (const bg of ['surface', 'bg', 'don-wash']) add('-ink 文字与它的浅底', 'don-ink', bg)
  for (const bg of ['surface', 'bg', 'ka-wash']) add('-ink 文字与它的浅底', 'ka-ink', bg)
  for (const bg of ['surface', 'roll-wash']) add('-ink 文字与它的浅底', 'roll-ink', bg)
  for (const bg of ['surface', 'ok-wash']) add('-ink 文字与它的浅底', 'ok', bg)
  for (const bg of ['surface', 'danger-wash']) add('-ink 文字与它的浅底', 'danger', bg)
  for (const x of DIFF_KEYS) {
    add('难度文字 --diff-*-ink', x.ink, 'surface')
    add('难度文字 --diff-*-ink', x.ink, tint(x.token, 14), 4.5, `--${x.token} 14% 浅底`)
  }
  add('实色填充上的文字', 'ink-on-solid', 'don-solid')
  for (const x of DIFF_KEYS) add('实色填充上的文字', 'ink-on-solid', x.token)
  add('实色填充上的文字', 'bg', 'ink', 4.5)
  add('实色填充上的文字', 'toast-ink', 'toast-bg')
  for (const x of RANK_TOKENS) if (x.ink) add('评价与王冠文字', x.ink, 'surface')
  add('评价与王冠文字', 'crown-fc-ink', 'surface')
  for (const t of ['lane-ink', 'lane-ink-2', 'lane-ink-3']) add('谱面带文字', t, 'lane')
  add('谱面带文字', 'lane-ink-3', tint('lane-ink', 9, 'lane'), 4.5, '选中列的提亮底')
  add('非文字（≥ 3:1）', 'ctl-border', 'surface', 3)
  add('非文字（≥ 3:1）', 'ctl-border', 'bg', 3)
  add('非文字（≥ 3:1）', 'focus-ring', 'surface', 3)
  add('非文字（≥ 3:1）', 'focus-ring', 'bg-sunk', 3)
  add('非文字（≥ 3:1）', 'focus-gap', 'don-solid', 3, '--don-solid（主按钮）')
  add('非文字（≥ 3:1）', 'lane-focus', 'lane', 3)
  for (const s of ['status-attn', 'status-ok', 'status-fail']) add('非文字（≥ 3:1）', s, 'surface', 3)
  for (const [sel, label] of [
    ['primary', '.btn-primary'],
    ['danger', '.btn-danger'],
    ['tag-don', '.tag-don'],
    ['tag-info', '.tag-info'],
    ['tag-roll', '.tag-roll'],
    ['tag-ok', '.tag-ok'],
    ['tag-danger', '.tag-danger'],
  ])
    out.push({ group: '实测元素（读本页样本的计算样式）', sel: `[data-cr="${sel}"]`, fgLabel: label, bgLabel: '', min: 4.5 })
  return out
})()
const ALL_TOKENS = [
  ...PRIMS.flatMap((g) => g.tokens),
  ...SEMANTIC.map((s) => s[0]),
  ...DIFF_KEYS.flatMap((x) => [x.token, x.ink]),
  ...CROWN_TOKENS.filter((x) => x.token && !x.gradient).flatMap((x) => [x.token, x.ink].filter(Boolean)),
  ...JUDGE_TOKENS.map((x) => x.token),
  ...RANK_TOKENS.flatMap((x) => [x.token, x.ink].filter(Boolean)),
  ...GENRE_TOKENS.map((x) => x.token),
]

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
  contrast.value = PAIRS.map((r) => {
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
      bg = readColor(r.bg)
      fg = readColor(r.fg)
    }
    const ratio = fg && bg ? ratioOf(fg, bg) : null
    return { ...r, ratio, fgHex: toHex(fg), bgHex: toHex(bg), pass: ratio != null && ratio >= r.min }
  })
}
const contrastGroups = computed(() => {
  const out = []
  for (const r of contrast.value) {
    let g = out[out.length - 1]
    if (!g || g.name !== r.group) out.push((g = { name: r.group, rows: [] }))
    g.rows.push(r)
  }
  return out
})
const contrastFails = computed(() => contrast.value.filter((r) => r.ratio != null && !r.pass).length)
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
  vlMo?.disconnect()
})

/* ---------------- 字体、间距、圆角、层级 ---------------- */
const FONTS = [
  { token: '--font-cjk-sc', stack: 'Noto Sans SC Variable → PingFang SC → HarmonyOS Sans SC → Microsoft YaHei', use: '中文界面、中文曲名' },
  { token: '--font-cjk-jp', stack: 'Noto Sans JP Variable → Hiragino Sans → Yu Gothic UI → Meiryo', use: '日文界面、日文曲名' },
  { token: '--font-ui', stack: 'Barlow → 当前语言的 CJK 字体栈', use: '拉丁字母与全部界面文字；曲名里的数字也用它' },
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

// D14：用真实的边界数据（demo 数据集里没有生成曲时，退回到曲名最长的一首）
const longestBy = (key) => songs.reduce((a, s) => ((s[key] || '').length > (a[key] || '').length ? s : a), songs[0])
const longSong = songById[EDGE.longJa[0]] || longestBy('ja')
const specialSong = songById[EDGE.special[0]] || songs[0]
const sameSong = songById[EDGE.sameTitle[0]] || songs[0]
const TITLE_SPECS = [
  { k: '长标题', song: longSong },
  { k: '特殊字符', song: specialSong },
  { k: '中日同名', song: sameSong },
]
const TITLE_RULES = [
  '列表与表格里的标题单行截断（.title-1l），title 属性给出全文。',
  '详情页头部与卡片标题用 .title-wrap（最多三行）或 .title-wrap-2（最多两行）：overflow-wrap: anywhere、line-break: strict、text-wrap: balance，超出再截断。',
  '数字永不截断；曲名里的数字用正文字体，不用 .num。',
  '另一种语言的副标题带正确的 lang（中文界面里是 ja，日文界面里是 zh-CN）；中日同名时不重复显示副标题。',
  '日文界面的标签约长 1.3–1.4 倍：按钮不换行，由容器换行或横滑；左轨标签 11px。',
  '＊、～、↑↑、♡、!?、全角括号不改变行高与对齐。',
]

const SP = [
  { n: 1, px: 4, use: '图标与文字、标签内部' },
  { n: 2, px: 8, use: '同组控件之间（.row-wrap）' },
  { n: 3, px: 12, use: '行内默认间距（.row / .col）' },
  { n: 4, px: 16, use: '面板头上下、手机页边距' },
  { n: 5, px: 20, use: '面板内边距（.panel-pad）、--overlay-pad' },
  { n: 6, px: 24, use: '页头到内容、页面上边距' },
  { n: 8, px: 32, use: '手机上的分节间距' },
  { n: 10, px: 40, use: '桌面上的分节间距（.section）' },
  { n: 12, px: 48, use: '手机页面底部留白' },
  { n: 16, px: 64, use: '桌面页面底部留白' },
]
const SIZES = [
  { token: '--ctl-h-xs', px: 28, use: '桌面上的筛选胶囊与分段内钮' },
  { token: '--ctl-h-sm', px: 30, use: '.btn-sm' },
  { token: '--ctl-h', px: 38, use: '按钮、输入框、选择框、图标按钮；手机上筛选胶囊与分段内钮的视觉高度' },
  { token: '--hit', px: 44, use: '手机上的最小可点区域；手机上的 .btn / .btn-sm / .icon-btn、难度切换条' },
  { token: '--ctl-h-lg', px: 46, use: '.btn-lg；手机上的输入框与选择框' },
  { token: '--subtab-h-m', px: 44, use: '手机二级页签条' },
  { token: '--bar-h-m', px: 52, use: '手机顶栏' },
  { token: '--bar-h', px: 60, use: '桌面顶栏' },
  { token: '--tab-h', px: 62, use: '手机底栏' },
]
const CTL_TOKENS = [
  { token: '--ctl-border', v: '颜色', use: '按钮、输入框、选择框、文本域、分段外框、筛选胶囊共用的边框' },
  { token: '--ctl-radius', v: '= --r-ctl', use: '按钮、输入框、选择框、文本域、图标按钮、难度切换条；分段外框为它 + 2px' },
  { token: '--ctl-pad-x', v: '12px', use: '输入框、选择框、文本域、筛选胶囊、分段内钮的左右内边距' },
  { token: '--btn-pad-x', v: '14px', use: '.btn 左右内边距（.btn-sm 用 --btn-pad-x-sm 10px，.btn-lg 用 --btn-pad-x-lg 20px）' },
  { token: '--tag-h', v: '20px', use: '.tag、.role、DanBadge' },
  { token: '--tag-radius', v: '= --r-xs', use: '.tag、DanBadge' },
  { token: '--plate-h', v: '22px', use: 'TitlePlate：称号牌是一块「牌」，有意比标签高' },
]
const OVERLAY_TOKENS = [
  { token: '--overlay-radius', v: '= --r-panel', use: '对话框、命令面板、菜单、浮动面板、Toast' },
  { token: '--overlay-pad', v: '20px', use: '浮层内边距' },
  { token: '--overlay-pad-sm', v: '6px', use: '菜单类浮层（账号菜单）的外框内边距' },
  { token: '--overlay-shadow', v: '= --shadow-pop', use: '所有浮层的阴影' },
  { token: '--r-sheet', v: '22px', use: '手机底部抽屉的顶角' },
]
const RADII = [
  { token: '--r-xs', px: '6px', use: '标签（--tag-radius）、星级点、分段内钮、小封面' },
  { token: '--r-ctl', px: '8px', use: '按钮、输入框（--ctl-radius）、默认封面、命令面板图标格' },
  { token: '--r-panel', px: '14px', use: '面板、谱面带、特大封面；浮层经 --overlay-radius 引用它' },
  { token: '--r-sheet', px: '22px', use: '手机底部抽屉的顶角' },
  { token: '--r-note', px: '999px', use: '音符、筛选胶囊、状态条' },
]
const COVER_LADDER = [
  { size: 'sm', px: 32, r: '--r-xs', use: '紧凑表格' },
  { size: '', px: 44, r: '--r-ctl', use: '列表行' },
  { size: 'lg', px: 72, r: 'calc(--r-ctl + 2px)', use: '卡片、帖子行的关联谱面；手机上的头条与代表成绩' },
  { size: 'tile', px: 96, r: 'calc(--r-ctl + 2px)', use: '社区头条、个人主页的代表成绩（桌面）' },
  { size: 'xl', px: 168, r: '--r-panel', use: '详情页头' },
]
const ZS = [
  { token: '--z-rail', v: 20, use: '桌面左轨' },
  { token: '--z-bar', v: 30, use: '顶栏、手机底栏' },
  { token: '--z-sheet', v: 60, use: 'Sheet 与遮罩、Popover' },
  { token: '--z-palette', v: 80, use: '全局搜索' },
  { token: '--z-toast', v: 90, use: 'Toast' },
  { token: '--z-proto', v: 100, use: '原型控制面板，不进入生产' },
]
const BREAKS = [
  { r: `≤ ${BP.mobile}`, n: '手机', nav: '52px 顶栏（--bar-h-m）：标题、同步、通知，不放头像；62px 底部五格，正中是「咚」搜索键，「我的」是账号入口', body: '单列；侧栏列并入主栏；数据表改成列表行', over: '对话框变成底部抽屉；同步面板在抽屉里；可点区域 ≥ 44px；输入框 46px / 16px 字' },
  { r: `${BP.mobile + 1} – ${BP.tablet}`, n: '平板', nav: '保留 84px 左轨；顶栏同步状态条收成图标', body: '双栏按规则折叠；表格保留为表格，按列优先级隐藏低优先级列', over: '居中对话框' },
  { r: `${BP.tablet + 1} – ${BP.desktop}`, n: '桌面', nav: '完整顶栏：页签、搜索框、同步状态条、通知、账号', body: '侧栏列排到主栏下方或收窄；数据表按列优先级隐藏', over: '居中对话框；同步面板锚在状态条下方' },
  { r: `≥ ${BP.desktop + 1}`, n: '宽屏', nav: '同上', body: '主栏 + 320–380px 侧栏列并排；内容最宽 1480px', over: '定数表等页面出现常驻详情栏' },
]
const COL_PRIORITY = [
  { k: '始终显示', cols: ['曲目（固定首列）', '难度 / 星级', '定数', '我的（魔王与里）'] },
  { k: '空间不够时第三个隐藏', cols: ['次要能力值'] },
  { k: '第二个隐藏', cols: ['流派'] },
  { k: '最先隐藏', cols: ['上架日期'] },
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
// 页签与难度切换条共用的左右方向键（漫游 tabindex）
function arrowNav(e, values, current, set) {
  const i = values.indexOf(current)
  let j = i
  if (e.key === 'ArrowRight') j = (i + 1) % values.length
  else if (e.key === 'ArrowLeft') j = (i - 1 + values.length) % values.length
  else if (e.key === 'Home') j = 0
  else if (e.key === 'End') j = values.length - 1
  else return
  e.preventDefault()
  const box = e.currentTarget
  set(values[j])
  nextTick(() => box?.querySelectorAll('[role="tab"]')[j]?.focus())
}
const chipsOn = ref(['24 分', '后半难'])
function toggleChip(t) {
  chipsOn.value = chipsOn.value.includes(t) ? chipsOn.value.filter((x) => x !== t) : [...chipsOn.value, t]
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
const TAG_TONES = [
  { tone: '中性', cls: 'tag', cr: '', zh: '攻略', ja: '攻略', use: '类型、普通属性' },
  { tone: '信息', cls: 'tag tag-info', cr: 'tag-info', zh: '高速处理', ja: '高速処理', use: '关注方向、提示信息（.tag-ka 是同一个类）' },
  { tone: '高光', cls: 'tag tag-roll', cr: 'tag-roll', zh: '精华', ja: '注目', use: '精华、稀有、需要你做一步' },
  { tone: '成功', cls: 'tag tag-ok', cr: 'tag-ok', zh: '国行实装', ja: '中国版稼働中', use: '已完成、可用、已同步' },
  { tone: '危险', cls: 'tag tag-danger', cr: 'tag-danger', zh: '同步失败', ja: '同期失敗', use: '失败、错误、过期' },
]
const showHit = ref(false)
const popBtn = ref(null)
const popOpen = ref(false)
const popDensity = ref('cozy')

/* ---------------- VirtualList 演示：整个曲库 ---------------- */
const vlOpen = ref(false)
const vlBox = ref(null)
const vlRef = ref(null)
const vlMounted = ref(0)
const VL_ROW = 40
let vlMo = null
watch(vlOpen, async (v) => {
  vlMo?.disconnect()
  vlMo = null
  if (!v) {
    vlMounted.value = 0
    return
  }
  await nextTick()
  const el = vlBox.value
  if (!el) return
  const count = () => (vlMounted.value = el.querySelectorAll('.vl-row').length)
  count()
  vlMo = new MutationObserver(count)
  vlMo.observe(el, { childList: true, subtree: true })
})
function vlJump() {
  vlRef.value?.scrollToIndex(999, 'center')
}

/* ---------------- 业务组件样本 ---------------- */
const demoSong = songById[233] // 五个难度齐全
const tengu = songById[615]
const tenguChart = chartOf(615, 4)
const tenguScore = scoreOf(615, 4)
const genreSongs = Object.keys(GENRES).map((g) => songs.find((s) => s.genre === g)).filter(Boolean)
const todayFacts = laneDays.find((d) => d.daysAgo === 0).facts
const factSamples = ['df', 'rank-upgrade', 'ng-reduced'].map((t) => todayFacts.find((f) => f.type === t)).filter(Boolean)
const activeGoal = goals.find((g) => g.status === 'active')
const EMPTY = computed(() => [
  { tone: 'empty', title: L('还没有成绩', 'まだ記録がありません'), text: L('同步第一份成绩后，这里就会有内容。', '最初の同期が終わると表示されます。') },
  { tone: 'error', title: L('没有同步成功', '同期できませんでした'), text: L('鼓众广场暂时没有响应，稍后再试一次。', 'しばらくしてからもう一度お試しください。') },
  { tone: 'loading', title: L('正在读取成绩', '成績を読み込み中'), text: '' },
])
const dtab = ref(4)
const dtabCharts = demoSong.charts
const missingSong = songById[EDGE.noConstant[0]] || demoSong
const missingChart = missingSong.charts.find((c) => c.constant == null) || missingSong.charts[0]
const LAMP_CROWN = [
  { cls: 'none', zh: '没打过', ja: '未プレイ', how: '虚线框' },
  { cls: 'played', zh: '未通关', ja: '未クリア', how: '实线细框' },
  { cls: 'clear', zh: '通关', ja: 'クリア', how: '银' },
  { cls: 'fc', zh: '全连', ja: 'フルコンボ', how: '金' },
  { cls: 'dfc', zh: '全良', ja: '全良', how: '虹色边' },
]
const LAMP_RANK = [{ key: 'none', zh: '没有评价', ja: '評価なし' }, ...[2, 3, 4, 5, 6, 7, 8].map((v) => ({ key: RANKS[v].key, zh: RANKS[v].zh, ja: RANKS[v].ja }))]
const lampCells = bestList.slice(0, 5).map((s) => ({ s, song: songById[s.songId] }))
const crownKey = (c) => (c == null ? 'none' : c === -1 ? 'played' : c === 0 ? 'clear' : c === 1 ? 'fc' : 'dfc')
const AV_SIZES = [24, 32, 44, 72, 96]
const AV_TIERS = [
  { key: 'tako', t: '低档：级位、初–五段' },
  { key: 'mochidon', t: '中档：六–九段' },
  { key: 'hayate', t: '高档：十段及以上' },
]
  .map((x) => ({ ...x, user: users[x.key] }))
  .filter((x) => x.user)
const DANS = ['三级', '五段', '七段', '九段', '十段', '名人', '达人']
const plateUser = users.mochidon
// V1.1 新增样本：ThreadRow 的预览形态（发帖页右侧用）
const previewThread = computed(() => ({ ...threads[1], id: 0, ago: L('刚刚', 'たった今'), likes: 0, replies: 0, views: 0 }))
// VirtualList rowClass：有里谱的行在左侧画一条细色条（行状态挂在行元素上，不在单元格里各自判断）
const vlRowClass = (item) => (item.levels[4] != null ? 's-vl-ura' : '')
const rareUser = users.hayate
const longThread = threads.reduce((a, t) => (t.title.length > a.title.length ? t : a), threads[0])

// 同步（S2 / S3）：静态对照表引用 SyncPanel 与 store.syncStatus 里的实际文案
const SYNC_SITUATIONS = [
  { k: '游客', force: { auth: 'guest' }, copy: '登录并绑定鼓众广场 ID 后，成绩、Rating 和成长记录会自动同步到 Viewer。', act: '登录（次要：注册）' },
  { k: '未绑定', force: { auth: 'unbound' }, copy: '三步清单：登录 Viewer ✓ → 绑定鼓众广场 ID（当前）→ 第一次同步', act: '去绑定' },
  { k: '已绑定无成绩', force: { auth: 'empty' }, copy: '已绑定的账号 + 「第一次同步大约需要 10 秒。」', act: '开始同步' },
  { k: '空闲', force: { state: 'idle' }, copy: '「上次同步：2 小时前」+ 结果摘要 + 各同步目标的状态', act: '立即同步；链接「同步设置」' },
  { k: '同步中', force: { state: 'running', phase: 1 }, copy: '三个阶段（读取鼓众广场 → 写入 Viewer → 推送到同步目标），当前阶段高亮；「可以关闭面板，同步会继续。」', act: '禁用的「正在同步…」' },
  { k: '成功', force: { state: 'success' }, copy: '「同步完成：4 条新进展，1 个新全良」', act: '看看有什么变化' },
  { k: '部分成功', force: { state: 'partial' }, copy: '「成绩已更新到 Viewer，1 个同步目标没有成功」+ 失败目标与原因', act: '重试失败的目标' },
  { k: '失败', force: { state: 'failed' }, copy: '「没有同步成功：鼓众广场暂时没有响应。已有的数据没有变化。」', act: '重试' },
]
const SYNC_BADGES = [
  { st: '已同步、空闲', kind: 'idle', label: '同步：2 小时前同步', chip: '2 小时前同步' },
  { st: '游客 / 未绑定 / 从未同步', kind: 'need', label: '同步：还没有绑定鼓众广场 ID', chip: '下一步动作，如「绑定鼓众广场 ID」；游客不显示状态条' },
  { st: '同步中', kind: 'running', label: '同步：正在同步，第 2 步，共 3 步', chip: '正在同步… 2/3' },
  { st: '刚刚成功', kind: 'fresh', label: '同步：刚刚同步，4 条新进展', chip: '刚刚同步 · 4 条新进展' },
  { st: '部分成功', kind: 'partial', label: '同步：部分同步，1 个同步目标没有成功', chip: '部分同步（山吹底）' },
  { st: '失败', kind: 'failed', label: '同步：上次同步失败', chip: '同步失败（危险色描边）' },
]

/* ---------------- 图表样本 ---------------- */
const laneWin = laneDays.slice(-28)
const laneSel = ref(0)
const laneDay = computed(() => laneWin.find((d) => d.daysAgo === laneSel.value) || laneWin[laneWin.length - 1])
const miniDays = laneDays.slice(-14)
const miniSel = ref(4)
const miniDay = computed(() => miniDays.find((d) => d.daysAgo === miniSel.value) || miniDays[miniDays.length - 1])
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
const dayLabel = (ago) => {
  const d = new Date(2026, 10, 16 - ago)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
const linePoints = ratingHistory.slice(-90).map((p) => ({ label: dayLabel(p.daysAgo), v: p.v, daysAgo: p.daysAgo }))
const lineMarks = [
  { index: linePoints.findIndex((p) => p.daysAgo === 74), text: '通过九段' },
  { index: linePoints.findIndex((p) => p.daysAgo === 22), text: 'Rating 越过 11.9' },
].filter((m) => m.index >= 0)
const sparkRating = ratingHistory.slice(-30).map((p) => p.v)
const FORMATS = [
  { k: '分数', rule: '千分位，不缩写成「100 万」', ex: fmt(1004290) },
  { k: 'Rating / 定数 / 六维', rule: '固定 2 位小数', ex: player.rating.toFixed(2) },
  { k: '精度', rule: '2 位小数 + %', ex: tenguScore.acc.toFixed(2) + '%' },
  { k: '变化量', rule: '带正负号，颜色只是补充', ex: '+' + player.ratingDelta30.toFixed(2) },
  { k: '计数', rule: '整数，过千加千分位', ex: fmt(player.plays) },
]

// TimeStack：范围写进地址（R2），刷新或分享链接还原同一个视图
const TS_RANGES = [90, 180, 400]
const q = useQueryState({ ts: { type: 'number', default: 180, values: TS_RANGES } })
const focusPrev = DIMS.find((d) => d.key === 'complex')
const focusNow = DIMS.find((d) => d.key === player.focus) || DIMS[2]
function stackData(range) {
  const points = ratingHistory.filter((p) => p.daysAgo < range).map((p) => ({ daysAgo: p.daysAgo, v: p.v, label: dayLabel(p.daysAgo) }))
  const marks = milestones.filter((m) => m.ago != null && m.ago < range).map((m) => ({ daysAgo: m.ago, type: m.type, text: L(m.text, m.textJa) }))
  const bands = [
    { fromDaysAgo: Math.min(range - 1, 160), toDaysAgo: 46, key: focusPrev.key, label: L(focusPrev.zh, focusPrev.ja) },
    { fromDaysAgo: 45, toDaysAgo: 0, key: focusNow.key, label: L(focusNow.zh, focusNow.ja), current: true },
  ].filter((b) => b.fromDaysAgo >= b.toDaysAgo)
  return { points, marks, bands }
}
const stack = computed(() => stackData(q.ts))
const TS_RULES = [
  '四行共用一条横轴：指标折线、关注方向带、里程碑、每日练习；切换范围时一起变化。横轴标签只在底部出现一次。',
  '折线用 --don（可换 tone），≤ 4 条横向参考线；终点是实心点。',
  '关注方向带用浅葱：进行中的一段描边加深。',
  '里程碑是音符：新全良 = 朱面 + 金外环，新全连 = 朱面 + 金环，Rating 与段位 = 山吹，目标达成 = 朱。',
  '每日练习：有游玩画短刻度，有进展画浅葱小音符，没有游玩留空。',
  '一个读数光标贯穿所有行；← → 移动，Home / End 到首尾，读数同时用 aria-live 播报；读屏另有里程碑表。',
]

/* ---------------- 状态与动效 ---------------- */
const STATES = [
  { s: '默认', en: 'default', how: '控件 1px --ctl-border 边、--surface 底；面板用 --line。' },
  { s: '悬停', en: 'hover', how: '底色到 --surface-2 或 --bg-sunk，边到 --ink-2；可点的标题变 --ka-ink。只变颜色，不位移。' },
  { s: '键盘焦点', en: 'focus-visible', how: '--focus：2px --focus-gap 间隙 + 2px --focus-ring 实色环；输入框同时把边换成 --focus-ring；谱面带内改用 --focus-lane 内描边。鼠标点击不出现。' },
  { s: '按下', en: 'active', how: 'scale(0.97)，--dur-1；减少动效时不缩放。' },
  { s: '禁用', en: 'disabled', how: '透明度 0.5，不响应指针。禁用态不受对比度限制，因此不得承载必要信息；旁边要有文字说明为什么不可用。' },
  { s: '选中', en: 'selected', how: '分段：--surface 底 + 700 字重；筛选胶囊：--ink 反色；页签：3px --don 下划线；难度切换条：难度实色底；谱面带：该列提亮。' },
  { s: '弱状态', en: 'not played / rest', how: '没打过、未通关、休息日用字重与形状区分：Crown 未游玩显示「—」、未通关是空心圆、.lamp.none 是虚线框。不降低不透明度。' },
  { s: '加载', en: 'loading', how: '有布局时用 .sk 骨架；整块等待用 EmptyLane 的 loading；触发按钮禁用并换成进行中的文案。' },
]
const MOTION = [
  { token: '--dur-1', v: '120ms', use: '颜色、边框、按下' },
  { token: '--dur-2', v: '220ms', use: '浮层出现、音符放大' },
  { token: '--dur-3', v: '420ms', use: '底部抽屉滑入' },
]
const REDUCE_RULES = [
  '触发条件：系统的 prefers-reduced-motion，或原型开关（根元素 data-motion="reduce"）。两者效果相同。',
  '没有无限循环动画：加载条显示静止的三个音符 + 文字；骨架屏不扫光；同步图标不旋转，改为显示阶段文字与进度点。',
  '没有回弹缩放：.btn 按下与 --ease-hit 不再缩放。',
  '滚动定位不用平滑滚动：scrollIntoView / scrollTo 用 motion.js 的 scrollBehavior()。',
  '所有过渡时长归零；信息不能只靠动效传达。',
]
const hasMotionToggle = 'motion' in store
const ROUTE_RULES = [
  { id: 'R1', t: '切换难度保留上下文', d: '歌曲详情切换难度只替换 d，保留 from、q、m 等其余查询参数。' },
  { id: 'R2', t: '列表状态写进地址', d: '筛选、排序、页签、范围用 useQueryState 与地址同步：默认值不写，关键词 250ms 防抖，router.replace 不堆历史；从地址初始化。' },
  { id: 'R3', t: '返回还原', d: '后退 / 前进恢复滚动位置；只改查询参数不滚动；新导航回到顶部。长列表用 VirtualList，总高度由行数决定，首帧即可还原。' },
  { id: 'R4', t: '返回按钮走历史', d: '有站内历史时 history.back()，回到带着筛选的列表；否则回模块首页。进入歌曲详情的链接带 from=<模块>。' },
  { id: 'R5', t: '同一路由换对象', d: '从一首歌到另一首歌是全新状态并回到顶部；同一首歌换难度就地更新，不跳动。' },
]
const SYNC_FEEDBACK = [
  { when: '手机顶栏同步按钮', how: '44px 图标按钮，状态用角标表达（见 07 · 同步）；aria-label 读出当前状态；点按打开底部抽屉里的同步面板。' },
  { when: '桌面同步状态条', how: '文案随状态变化。空闲时点击直接开始同步；部分成功或失败时点击打开锚在状态条下方的面板看原因。' },
  { when: '同步面板', how: '手机抽屉与桌面浮层是同一个 SyncPanel，内容随「登录态 × 同步状态」变化。' },
  { when: '成功后的 Toast', how: '只在成功且面板没有打开时出现，一句话说清新进展。' },
  { when: '其他入口', how: '目标卡「练后同步」、/account/sync 调用同一个状态机；「我的」只保留一行只读的上次同步信息。' },
]
const FEEDBACK = [
  { when: '操作完成', how: 'Toast：一句话，3.2 秒后自己消失，不抢焦点。' },
  { when: '输入有误', how: '就地提示：字段下方 .field-error，输入框边变 --danger，内容保留。' },
  { when: '删除、解绑等不可撤销的操作', how: 'Sheet 确认：标题说清后果，确认按钮写动词并用 .btn-danger（描边，靠形式而不是色相和主按钮区分）。' },
  { when: '点赞、收藏、投票', how: '乐观切换：立刻变化，失败时回滚并用 Toast 说明。' },
]
const played = ref(false)
const fadeOpen = ref(true)
const like = reactive({ on: false, n: 386 })
function toggleLike() {
  like.on = !like.on
  like.n += like.on ? 1 : -1
}
const SURFACES = ['bg', 'bg-sunk', 'surface', 'surface-2']

/* ---------------- 无障碍与国际化 ---------------- */
const CHECKS = [
  { t: '地标与跳转', d: '每页一个 header、带名称的 nav（主导航、底部导航、页签）和 main#main；页首第一个可聚焦元素是「跳到主要内容」。' },
  { t: '路由播报', d: '路由切换后焦点移到 main，aria-live 区域播报新页面名。' },
  { t: '全局搜索', d: '输入框是 combobox，结果是 listbox / option，aria-activedescendant 指示当前项；打开时焦点进输入框，关闭时回到触发它的元素。' },
  { t: '账号菜单', d: 'role="menu" / menuitem；↑ ↓ Home End 在菜单项间移动，Esc 关闭并把焦点还给菜单按钮。' },
  { t: '页签与分段', d: '页签是 tablist / tab + aria-selected，左右方向键切换；分段控件是带名称的 group，项用 aria-pressed。选中样式直接挂在这些属性上，视觉和读屏不会不一致。' },
  { t: '表格', d: '数据表有视觉隐藏的 caption，th 带 scope；可排序的表头是按钮，并用 aria-sort 标出当前排序列。' },
  { t: '图表', d: 'Lane、ChartSheet、DensityStrip、Radar、LineChart、TimeStack 都有随语言切换的 label；图旁有同一份数据的数字；TimeStack 可用方向键读数，并附读屏用的里程碑表。' },
  { t: '目标卡', d: '尝试轨迹是有序列表，每项带一句读屏文字。' },
  { t: '图标按钮与表单', d: '只有图标的按钮都有 aria-label，同步按钮的名称读出当前状态；表单控件有可见标签或 aria-label。' },
  { t: '焦点环', d: '在 --bg、--bg-sunk、--surface、--surface-2、主按钮和谱面带上都可见（样本见 09）。' },
  { t: '触控', d: '手机上 .btn、.btn-sm、.icon-btn、底栏项、列表行 ≥ 44×44；筛选胶囊与分段内钮视觉 38px，透明扩展区补到 44px，相邻间距 ≥ 6px。正文里的行内链接不受此限。' },
  { t: '颜色不单独承载信息', d: '王冠有形状和文字标签，评价有字形（粹 / 雅 / 极），涨跌有正负号，难度有文字，同步状态有图标与文字。' },
  { t: '中日字形', d: 'html 的 lang 跟随界面语言；另一种语言的曲名单独标 lang（subLang），浏览器才会选对字形。' },
  { t: '文本膨胀', d: '日文标签约为中文的 1.3–1.4 倍：按钮不换行，由容器换行或横滑；页签横向滚动。' },
  { t: '主题', d: '跟随系统、浅色、深色三档；只切换 Semantic 层。index.html 在样式加载前写入 data-theme 与 color-scheme，深色首屏不闪。' },
  { t: '减少动效', d: '无限循环动画、回弹缩放、平滑滚动全部停用（见 09）。' },
]
const EXPAND = [
  ['练后同步', 'プレイ後に同期'],
  ['设为目标', '目標に設定する'],
  ['全部成绩', 'すべての成績を見る'],
]

/* ---------------- 模块的视觉表现（V） ---------------- */
const VOICES = [
  { m: '曲库、成绩', kw: '效率、可比', layout: '表格、分面、吸顶表头、固定首列', type: '13–14px，紧凑行', color: '中性为主；朱只给主定数与 Rating', fumen: '只作为数据编码（星级格、王冠、密度条）' },
  { m: '成长、目标', kw: '时间、过程', layout: '共享一条时间轴；图表开放、不加面板框；纵向留白宽', type: '16px 正文；用叙述句作标题', color: '浅葱 = 过程，山吹 = 里程碑，朱 = 达成', fumen: '谱面带、用音符标里程碑' },
  { m: '社区、个人主页', kw: '身份、内容', layout: '阅读栏、头条、更大的封面与头像', type: '标题 16–22px，行高宽', color: '版块色点；称号牌用山吹', fumen: '不用谱面带；用鼓面头像' },
  { m: '账号、绑定', kw: '清晰、可靠', layout: '单栏 760px、分段标题、状态行、步骤器', type: '14–16px；按钮文案写明后果', color: '中性 + 状态色', fumen: '只有步骤器里的音符' },
]
const voiceRows = bestList.slice(0, 3).map((s) => ({ s, song: songById[s.songId] }))
const miniStack = computed(() => stackData(60))
const miniDelta = computed(() => {
  const p = miniStack.value.points
  return p.length ? p[p.length - 1].v - p[0].v : 0
})
const voiceThread = threads.find((t) => t.song && users[t.author]) || threads[0]
const voiceAuthor = users[voiceThread.author]

const MAPPING = [
  { old: '--viewer-radius: 14px，全站一个圆角', now: '五级圆角：--r-xs 6 / --r-ctl 8 / --r-panel 14 / --r-sheet 22 / --r-note 999；封面按 D3 的阶梯取', why: '控件、面板、抽屉、音符一眼能分开' },
  { old: '--viewer-primary #bd352f', now: '--don-solid（主按钮填充）、--don（音符与图形）、--don-ink（文字）', why: '填充、图形和文字各自校准对比度' },
  { old: '--viewer-link #006c76', now: '--ka（焦点、选中）与 --ka-ink（链接）', why: '链接、焦点、咔音符是同一个色相' },
  { old: '--viewer-bg #eaf6f5 青绿底', now: '--bg，取自藍色阶', why: '底色退后，音符三色才有位置' },
  { old: '960px 单断点 + 15 个零散断点；定数表的 1439 断点', now: '767 / 1099 / 1239 三个断点；数据表按列优先级隐藏列', why: '每个页面在同一宽度换布局' },
  { old: '王冠、评价用纯文字', now: 'Crown / Rank 组件、.lamp 点灯格', why: '形状 + 颜色 + 可选文字，表格里也能扫读' },
  { old: '难度色写在各页面', now: '.diff-tab、.dc-*、Diff；文字用 --diff-*-ink', why: '难度色只有一个来源，文字也够清楚' },
  { old: '「没打过」用降低不透明度表示', now: '字重与形状：「—」（.na）、空心圆、虚线框', why: '暗处和深色主题下也读得出来' },
  { old: '失败提示借用朱色标签', now: '失败、错误用 .tag-danger / --danger；.tag-don 只表示强调', why: '红色不再同时表示「重要」和「出错了」' },
  { old: '.avatar 首字母圆片', now: 'PlayerAvatar（鼓面头像，鼓缘随段位档次）+ TitlePlate + DanBadge', why: '身份在帖子、楼层、榜单、通知里统一' },
  { old: '谱面带外借用 --lane-ring / --lane-outline', now: '--note-ring / --note-outline', why: '--lane-* 只留给谱面带' },
  { old: 'ECharts、手写 SVG、服务端 PNG 三套图表', now: '统一的 SVG 图表组件；成长页用 TimeStack；保留的 ECharts 图从 token 生成主题', why: '数字可读、跟随深浅色、手机上不糊' },
  { old: 'Element Plus 变量各处单独覆盖', now: '从 Semantic 层映射：--el-color-primary: var(--don-solid)、--el-bg-color: var(--surface)、--el-text-color-primary: var(--ink)、--el-border-color: var(--line-strong)', why: '改一处 token，自研组件和 Element Plus 一起变' },
  { old: 'Element Plus 控件尺寸与边框', now: '--el-component-size-small: var(--ctl-h-sm)、--el-component-size: var(--ctl-h)、--el-component-size-large: var(--ctl-h-lg)、--el-input-border-color: var(--ctl-border)、--el-border-radius-base: var(--ctl-radius)', why: '自研控件与 Element Plus 控件同高、同边框，混排时基线对齐' },
  { old: 'Element Plus 对话框、抽屉、弹出框', now: '--el-dialog-border-radius: var(--overlay-radius)、--el-dialog-padding-primary: var(--overlay-pad)、--el-popover-border-radius: var(--overlay-radius)、--el-popover-padding: var(--overlay-pad)、--el-box-shadow: var(--overlay-shadow)', why: '所有浮层同一种圆角、内边距和阴影' },
  { old: '未登录时有的硬跳登录页，有的内联提示', now: 'Gate 组件；同步入口用 SyncPanel', why: '留在原地，告诉用户差哪一步' },
]
</script>

<template>
  <div ref="root" class="s-root">
    <i ref="probe" class="s-probe" aria-hidden="true" />

    <header class="s-top">
      <div class="s-top-in">
        <RouterLink to="/review" class="s-brand" aria-label="设计总览">
          <Logo :size="30" />
          <b>Design System V1.1</b>
        </RouterLink>
        <RouterLink to="/review" class="link s-back"><Icon name="chevL" :size="14" />设计总览</RouterLink>
        <span class="grow" />
        <div class="s-ctl s-ctl-bar">
          <div class="seg" role="group" aria-label="主题">
            <button v-for="t in THEMES" :key="t.v" type="button" :aria-pressed="store.theme === t.v" @click="store.theme = t.v">{{ t.t }}</button>
          </div>
          <div class="seg" role="group" aria-label="语言">
            <button v-for="l in LOCALES" :key="l.v" type="button" :aria-pressed="store.locale === l.v" @click="store.locale = l.v">{{ l.t }}</button>
          </div>
        </div>
      </div>
      <nav class="s-chips" aria-label="章节">
        <button v-for="s in SECTIONS" :key="s.id" type="button" class="chip" :aria-current="active === s.id ? 'true' : undefined" @click="go(s.id)">{{ s.t }}</button>
      </nav>
    </header>

    <div class="s-frame">
      <nav class="s-toc" aria-label="章节">
        <button v-for="(s, i) in SECTIONS" :key="s.id" type="button" :aria-current="active === s.id ? 'true' : undefined" @click="go(s.id)">
          <span class="num">{{ String(i + 1).padStart(2, '0') }}</span>{{ s.t }}
        </button>
      </nav>

      <main class="s-doc">
        <header class="s-intro">
          <h1 class="t-display">Design System V1.1</h1>
          <p class="s-lede">Taiko Viewer「<span lang="ja">譜面</span> Fumen」设计语言的规范。每个样本都由 tokens.css、base.css、domain.css 和组件源码直接渲染，切换主题和语言后看到的就是实际效果。条目后的编号（D11、S2、R3、V6…）对应 docs/07-v1.1-design-decisions.md 的裁决。</p>
          <div class="s-ctl s-ctl-page">
            <div class="seg" role="group" aria-label="主题">
              <button v-for="t in THEMES" :key="t.v" type="button" :aria-pressed="store.theme === t.v" @click="store.theme = t.v">{{ t.t }}</button>
            </div>
            <div class="seg" role="group" aria-label="语言">
              <button v-for="l in LOCALES" :key="l.v" type="button" :aria-pressed="store.locale === l.v" @click="store.locale = l.v">{{ l.t }}</button>
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
              <p>桌面有顶栏搜索、Ctrl K 和 /，手机是底栏正中的「咚」键。站在机台前单手就能查到一首歌，不用先想它在哪个栏目。</p>
              <div class="s-ev"><button type="button" class="btn btn-sm" @click="store.paletteOpen = true"><Icon name="search" :size="14" />打开全局搜索</button></div>
            </li>
            <li>
              <h3 class="t-h2">四类模块，四种语气</h3>
              <p>同一套 token 与组件，查询、成长、社区、账号在版面节奏、字号和「谱面元素出现多少」上有意区分（见 11）。</p>
            </li>
          </ol>
        </section>

        <!-- ============ 02 颜色 ============ -->
        <section id="ds-color" class="s-sec">
          <h2 class="t-h1"><span class="s-n num">02</span>颜色</h2>
          <p class="s-lede">三层结构：Primitive 是色阶，Semantic 给它用途，Domain 承载游戏语义。页面与组件只引用后两层（D1），换主题只需要改 Semantic 的指向。下面的色值从当前页面实时读取，现在是{{ resolvedTheme === 'dark' ? '深色' : '浅色' }}主题。</p>

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
              <caption class="sr-only">Semantic token</caption>
              <thead>
                <tr><th scope="col" style="width: 56px">色块</th><th scope="col">Token</th><th scope="col">当前值</th><th scope="col">用途</th></tr>
              </thead>
              <tbody v-for="g in SEMANTIC_GROUPS" :key="g.g">
                <tr class="s-grp"><th colspan="4" scope="colgroup">{{ g.g }}</th></tr>
                <tr v-for="s in g.rows" :key="s[0]">
                  <td><i class="s-chip sm" :style="{ background: `var(--${s[0]})` }" /></td>
                  <td><code>--{{ s[0] }}</code></td>
                  <td class="num">{{ hex[s[0]] }}</td>
                  <td>{{ s[1] }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="s-guide s-gap">音符的白环与深色轮廓统一用 --note-ring / --note-outline（旧别名 --lane-ring / --lane-outline 与 .avatar、--avatar-* 已删除）。</p>

          <h3 class="t-h2 s-sub">Domain</h3>
          <div class="s-spec">
            <div class="s-k">难度<small>色块 --diff-* · 文字 --diff-*-ink</small></div>
            <ul class="s-dom">
              <li v-for="x in DIFF_KEYS" :key="x.token">
                <span class="s-pairchip"><i class="s-chip" :style="{ background: `var(--${x.token})` }" /><i class="s-chip" :style="{ background: `var(--${x.ink})` }" /></span>
                <Diff :d="x.d" :star="demoSong.levels[x.d - 1]" />
                <code>--{{ x.token }}</code><span class="num">{{ hex[x.token] }}</span>
                <code>--{{ x.ink }}</code><span class="num">{{ hex[x.ink] }}</span>
              </li>
            </ul>
          </div>
          <div class="s-spec">
            <div class="s-k">王冠<small>5 种状态</small></div>
            <ul class="s-dom">
              <li v-for="x in CROWN_TOKENS" :key="String(x.v)">
                <i v-if="x.token" class="s-chip" :style="{ background: `var(--${x.token})` }" />
                <i v-else class="s-chip s-chip-empty" />
                <Crown :v="x.v" label />
                <template v-if="x.token"><code>--{{ x.token }}</code><span class="num">{{ x.gradient ? 'conic-gradient' : hex[x.token] }}</span></template>
                <span v-else class="t-caption">空心圆，--ink-3 描边</span>
                <template v-if="x.ink"><code>--{{ x.ink }}</code><span class="num">{{ hex[x.ink] }}</span></template>
              </li>
            </ul>
            <p class="s-guide">未游玩不画王冠形，显示缺失值「—」（灰色王冠会被读成银色通关）；--crown-none 保留给点灯格等非王冠形的「没打过」。已游玩未通关是空心圆。金色作文字时用 --crown-fc-ink。</p>
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
            <div class="s-k">评价<small>圈 --rank-* · 字 --rank-*-ink</small></div>
            <ul class="s-dom">
              <li v-for="x in RANK_TOKENS" :key="x.token">
                <i class="s-chip" :style="{ background: `var(--${x.token})` }" />
                <Rank :v="x.v" label />
                <code>--{{ x.token }}</code><span class="num">{{ hex[x.token] }}</span>
                <template v-if="x.ink"><code>--{{ x.ink }}</code><span class="num">{{ hex[x.ink] }}</span></template>
              </li>
            </ul>
          </div>
          <div class="s-spec">
            <div class="s-k">流派<small>只作色点与封面底</small></div>
            <ul class="s-dom">
              <li v-for="x in GENRE_TOKENS" :key="x.token">
                <i class="s-chip" :style="{ background: `var(--${x.token})` }" />
                <span class="row s-genre"><i class="dot" :style="{ color: `var(--${x.token})` }" />{{ L(GENRES[x.k].zh, GENRES[x.k].ja) }}</span>
                <code>--{{ x.token }}</code><span class="num">{{ hex[x.token] }}</span>
              </li>
            </ul>
          </div>

          <h3 class="t-h2 s-sub">对比度（D11）</h3>
          <ul class="s-rules">
            <li>正文与小字（&lt; 24px，或 &lt; 18.66px 的粗体）在它所处的每一种底色上 ≥ 4.5:1，浅色与深色都要满足。</li>
            <li>大字 ≥ 3:1。</li>
            <li>非文字界面元素（输入框边界、未选中的分段、图标状态、焦点环、状态点）≥ 3:1。</li>
            <li>禁用态不受此限，但不得承载必要信息。</li>
            <li>没打过、休息日等「弱」状态用字重和形状表达，不靠降低不透明度。</li>
          </ul>
          <p class="s-guide s-gap" role="status">
            当前{{ resolvedTheme === 'dark' ? '深色' : '浅色' }}主题，按 WCAG 2 公式用计算后的颜色现算 {{ contrast.length }} 项：
            <b v-if="contrastFails" class="s-bad">{{ contrastFails }} 项未达标</b><b v-else class="s-good">全部达标</b>。切换主题后自动重算。
          </p>
          <div class="panel scroll-x s-gap">
            <table class="dt s-w620">
              <caption class="sr-only">文字与非文字元素的对比度</caption>
              <thead>
                <tr><th scope="col">样本</th><th scope="col">前景 / 背景</th><th scope="col" class="r">对比度</th><th scope="col" class="r">要求</th><th scope="col">结论</th></tr>
              </thead>
              <tbody v-for="g in contrastGroups" :key="g.name">
                <tr class="s-grp"><th colspan="5" scope="colgroup">{{ g.name }}</th></tr>
                <tr v-for="(r, i) in g.rows" :key="i">
                  <td>
                    <span v-if="r.min < 4.5" class="s-cr ui" :style="{ background: r.bgHex, boxShadow: `inset 0 0 0 3px ${r.fgHex}` }" aria-hidden="true" />
                    <span v-else class="s-cr" :style="{ color: r.fgHex, background: r.bgHex }">咚 Aa 12</span>
                  </td>
                  <td>
                    <code>{{ r.fgLabel }}</code><template v-if="r.bgLabel"> / <code>{{ r.bgLabel }}</code></template>
                  </td>
                  <td class="r num s-ratio">
                    <template v-if="r.ratio != null">{{ r.ratio.toFixed(2) }}</template><span v-else class="na">—</span>
                  </td>
                  <td class="r num">{{ r.min }}:1</td>
                  <td>
                    <span v-if="r.ratio == null" class="na">—</span>
                    <span v-else-if="r.pass" class="tag tag-ok"><Icon name="check" :size="12" />{{ r.min < 4.5 ? '≥ 3:1' : 'AA' }}</span>
                    <span v-else class="tag tag-danger">不足</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="s-dd">
            <div><b>用法</b>文字只用带 -ink 的 token 和 --ink 系列；填充用 --don / --ka / --roll / --diff-*；浅底用 -wash；状态点用 --status-*。</div>
            <div class="no"><b>不要</b>在页面或组件里写 Primitive 色阶或十六进制值（B / C 概念稿除外）；不要把难度色、流派色挪去表示状态；不要用 opacity 把文字调淡。</div>
          </div>
        </section>

        <!-- ============ 03 字体与字阶 ============ -->
        <section id="ds-type" class="s-sec">
          <h2 class="t-h1"><span class="s-n num">03</span>字体与字阶</h2>
          <p class="s-lede">层级靠字重和字号，不靠颜色：900 的黑体标题、700 的小标题、400 的正文。数字单独用一套窄体等宽数字，长分数在表格里占的宽度更小，位数一眼对得齐。</p>

          <div class="panel scroll-x s-gap">
            <table class="dt s-w560">
              <caption class="sr-only">字体栈</caption>
              <thead>
                <tr><th scope="col">Token</th><th scope="col">字体栈</th><th scope="col">用途</th></tr>
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
              <caption class="sr-only">字阶</caption>
              <thead>
                <tr><th scope="col">角色</th><th scope="col">字号</th><th scope="col" class="r">字重</th><th scope="col">行高</th><th scope="col">样本</th></tr>
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
            <div><b>用法</b>所有会被比较的数字都加 .num，表格里右对齐。数字永不截断。</div>
            <div class="no"><b>不要</b>用 .num 排句子里的年份、楼层号这类不需要比较的数字，也不要用它排曲名；不要给数字加粗到 900。</div>
          </div>

          <h3 class="t-h2 s-sub">标题：中日文与长标题（D14）</h3>
          <ul class="s-rules">
            <li v-for="r in TITLE_RULES" :key="r">{{ r }}</li>
          </ul>
          <div class="s-titles">
            <div v-for="x in TITLE_SPECS" :key="x.k" class="s-tspec">
              <p class="s-k">{{ x.k }}<small class="num">#{{ x.song.id }}</small></p>
              <div class="s-tcells">
                <div class="s-tcell">
                  <code>.title-1l · 列表行</code>
                  <div class="s-tbox s-tbox-row">
                    <Cover :song="x.song" size="sm" />
                    <span class="grow">
                      <b class="title-1l" :title="songTitle(x.song)">{{ songTitle(x.song) }}</b>
                      <span v-if="songSub(x.song)" class="title-1l t-caption" :lang="subLang" :title="songSub(x.song)">{{ songSub(x.song) }}</span>
                    </span>
                    <span class="num">{{ chartOf(x.song.id, 4)?.constant?.toFixed(2) ?? '' }}<span v-if="chartOf(x.song.id, 4)?.constant == null" class="na">—</span></span>
                  </div>
                </div>
                <div class="s-tcell">
                  <code>.title-wrap-2 · 卡片</code>
                  <div class="s-tbox">
                    <b class="title-wrap-2 s-tcard">{{ songTitle(x.song) }}</b>
                    <span v-if="songSub(x.song)" class="title-1l t-caption" :lang="subLang">{{ songSub(x.song) }}</span>
                  </div>
                </div>
                <div class="s-tcell">
                  <code>.title-wrap · 详情头部</code>
                  <div class="s-tbox">
                    <b class="title-wrap s-thead">{{ songTitle(x.song) }}</b>
                    <span v-if="songSub(x.song)" class="title-wrap-2 t-small" :lang="subLang">{{ songSub(x.song) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="s-glyphs">
            <div><code>lang="zh-CN" · .title-wrap</code><p class="title-wrap s-tlong" lang="zh-CN">{{ longSong.zh }}</p></div>
            <div><code>lang="ja" · .title-wrap</code><p class="title-wrap s-tlong" lang="ja">{{ longSong.ja }}</p></div>
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
          <p class="s-lede">间距以 4px 为基准，只有 10 级；控件高度 3 级加一个最小可点区域；圆角按元素的层级分 6 级；阴影只有 2 种。选项少，页面之间的节奏才一致。</p>

          <h3 class="t-h2 s-sub">间距</h3>
          <ul class="s-sp">
            <li v-for="s in SP" :key="s.n">
              <code>--sp-{{ s.n }}</code>
              <span class="num">{{ s.px }}</span>
              <span class="s-sp-bar"><i :style="{ width: `var(--sp-${s.n})` }" /></span>
              <span class="t-small">{{ s.use }}</span>
            </li>
          </ul>

          <h3 class="t-h2 s-sub">控件高度与栏高（D9 · D12）</h3>
          <ul class="s-sizes">
            <li v-for="s in SIZES" :key="s.token">
              <span class="s-size-bar" :style="{ height: `var(${s.token})` }" aria-hidden="true" />
              <span class="s-size-t">
                <code>{{ s.token }}</code><span class="num">{{ s.px }}</span>
                <span class="t-small">{{ s.use }}</span>
              </span>
            </li>
          </ul>
          <div class="panel scroll-x s-gap">
            <table class="dt s-w560">
              <caption class="sr-only">控件 token</caption>
              <thead>
                <tr><th scope="col">Token</th><th scope="col">值</th><th scope="col">谁在用</th></tr>
              </thead>
              <tbody>
                <tr v-for="c in CTL_TOKENS" :key="c.token">
                  <td><code>{{ c.token }}</code></td><td class="s-nowrap">{{ c.v }}</td><td>{{ c.use }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 class="t-h2 s-sub">圆角</h3>
          <ul class="s-radii">
            <li v-for="r in RADII" :key="r.token">
              <i :style="{ borderRadius: `var(${r.token})` }" />
              <code>{{ r.token }}</code><span class="num">{{ r.px }}</span>
              <span class="t-small">{{ r.use }}</span>
            </li>
          </ul>
          <p class="s-guide">圆角越大，元素离内容越远：控件贴着内容，面板包着内容，抽屉盖在内容上。999 只留给音符和由音符引申出来的胶囊。</p>

          <div class="s-spec">
            <div class="s-k">封面圆角阶梯<small>D3</small></div>
            <ul class="s-ladder">
              <li v-for="c in COVER_LADDER" :key="c.px">
                <Cover :song="tengu" :size="c.size" />
                <code>{{ c.r }}</code>
                <span class="t-caption"><span class="num">{{ c.px }}</span>px · {{ c.use }}</span>
              </li>
            </ul>
          </div>

          <h3 class="t-h2 s-sub">层级与浮层</h3>
          <div class="s-elev">
            <div class="panel"><b>平面</b><code>1px --line</code><span class="t-small">面板、表格、列表。页面上的绝大多数东西。</span></div>
            <div class="panel lift"><b>贴附</b><code>--shadow-lift</code><span class="t-small">贴在内容上方的操作：手机底栏的「咚」键、吸底操作条。</span></div>
            <div class="s-overlay"><b>浮层</b><code>--overlay-*</code><span class="t-small">对话框、抽屉、命令面板、菜单、Popover、Toast：同一种圆角、内边距和阴影。</span></div>
          </div>
          <div class="panel scroll-x">
            <table class="dt s-w560">
              <caption class="sr-only">浮层 token</caption>
              <thead>
                <tr><th scope="col">Token</th><th scope="col">值</th><th scope="col">谁在用</th></tr>
              </thead>
              <tbody>
                <tr v-for="c in OVERLAY_TOKENS" :key="c.token">
                  <td><code>{{ c.token }}</code></td><td class="s-nowrap">{{ c.v }}</td><td>{{ c.use }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="s-dd">
            <div><b>用法</b>想让一块内容更突出，用字号、字重或 --surface-2 底。</div>
            <div class="no"><b>不要</b>给面板或卡片加阴影来「提亮」；不要叠两层带边的面板；浮层不要自己写圆角和阴影。</div>
          </div>
          <div class="panel scroll-x s-gap">
            <table class="dt">
              <caption class="sr-only">层叠顺序</caption>
              <thead>
                <tr><th scope="col">Token</th><th scope="col" class="r">值</th><th scope="col">谁在用</th></tr>
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
          <p class="s-lede">桌面用窄左轨放一级目的地，把横向空间留给表格和谱面；手机把同样的目的地放到拇指够得到的底栏。全站只有三个断点：{{ BP.mobile }} / {{ BP.tablet }} / {{ BP.desktop }}。</p>

          <div class="s-frames">
            <figure>
              <div class="scroll-x">
                <div class="s-fd" role="img" aria-label="桌面框架示意：84px 左轨，60px 顶栏，内容区最宽 1480px，右侧可选 320 到 380px 的侧栏列">
                  <div class="s-fd-rail"><i class="note big" /><i /><i /><i /><i /><i /><i /><span>左轨 <b class="num">84</b></span></div>
                  <div class="s-fd-main">
                    <div class="s-fd-bar"><span>顶栏 <b class="num">60</b></span><span>页签 · 搜索 · 同步状态条 · 通知 · 账号</span></div>
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
              <div class="s-fm" role="img" aria-label="手机框架示意：52px 顶栏，右侧是同步与通知两个按钮，不放头像；内容区；62px 底部五格，正中是咚搜索键">
                <div class="s-fm-head"><span>顶栏 <b class="num">52</b></span><span class="s-fm-ic"><i class="s-fm-sync" /><i /></span></div>
                <div class="s-fm-body"><span>内容</span><small>页边距 16</small></div>
                <div class="s-fm-tab"><i /><i /><span class="note big" /><i /><i /></div>
                <span class="s-fm-cap">底栏 <b class="num">62</b></span>
              </div>
              <figcaption class="t-caption">手机：顶栏右侧是同步（带状态角标）与通知</figcaption>
            </figure>
          </div>

          <div class="panel scroll-x s-gap">
            <table class="dt s-w680">
              <caption class="sr-only">断点</caption>
              <thead>
                <tr><th scope="col">宽度</th><th scope="col">名称</th><th scope="col">导航</th><th scope="col">内容区</th><th scope="col">浮层与控件</th></tr>
              </thead>
              <tbody>
                <tr v-for="b in BREAKS" :key="b.r">
                  <td class="num s-nowrap">{{ b.r }}</td><td class="s-nowrap"><b>{{ b.n }}</b></td><td>{{ b.nav }}</td><td>{{ b.body }}</td><td>{{ b.over }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="s-spec top">
            <div class="s-k">数据表的列优先级<small>V11</small></div>
            <div class="col">
              <ol class="s-colpri">
                <li v-for="(p, i) in COL_PRIORITY" :key="p.k">
                  <span class="s-colpri-n num">{{ i + 1 }}</span>
                  <span class="s-colpri-k">{{ p.k }}</span>
                  <span class="row-wrap"><span v-for="c in p.cols" :key="c" class="tag" :class="{ 'tag-info': i === 0 }">{{ c }}</span></span>
                </li>
              </ol>
              <p class="s-guide">1280 宽与平板下按优先级从下往上隐藏列；横向仍放不下时首列固定、表格内部横滑。「我的」列同时显示魔王与里。设置里的列表密度对所有表格生效。手机上不用宽表格，改成列表行。</p>
            </div>
          </div>
          <div class="s-dd">
            <div><b>用法</b>媒体查询只写 max-width: {{ BP.mobile }}px / {{ BP.tablet }}px / {{ BP.desktop }}px；脚本里用 breakpoints.js 的 isMobile / isTablet / isWide。</div>
            <div class="no"><b>不要</b>为单个页面新增断点；不要在手机上保留横向滚动的宽表格；不要在手机顶栏再放头像（「我的」已经是账号入口）。</div>
          </div>
        </section>

        <!-- ============ 06 基础组件 ============ -->
        <section id="ds-base" class="s-sec">
          <h2 class="t-h1"><span class="s-n num">06</span>基础组件</h2>
          <p class="s-lede">基础组件是 base.css 里的一组类，不带游戏语义。控件共用 --ctl-* token，一行里混排按钮、输入框、选择框和分段控件时高度与边框一致；手机上可点区域补到 44px 以上。</p>

          <div class="s-spec">
            <div class="s-k">控件 token<small>D12</small></div>
            <div class="col">
              <div class="row-wrap s-ctlrow">
                <button type="button" class="btn">{{ L('查看谱面', '譜面を見る') }}</button>
                <input class="input s-ctl-in" :value="L('千本樱', '千本桜')" :aria-label="L('曲名', '曲名')" />
                <select class="select s-ctl-sel" :aria-label="L('难度', '難易度')">
                  <option v-for="d in [4, 5, 3]" :key="d">{{ L(DIFFS[d].zh, DIFFS[d].ja) }}</option>
                </select>
                <div class="seg" role="group" :aria-label="L('排序', '並び順')">
                  <button type="button" aria-pressed="true">{{ L('定数', '定数') }}</button>
                  <button type="button" aria-pressed="false">{{ L('上架', '収録日') }}</button>
                </div>
                <button type="button" class="chip" aria-pressed="false">{{ L('有里谱', '裏あり') }}</button>
              </div>
              <p class="s-guide">按钮、输入框、选择框、文本域、分段外框和筛选胶囊共用 --ctl-border 与 --ctl-radius（胶囊是 999 圆角，分段外框是 --ctl-radius + 2px）。高度：按钮与输入类 --ctl-h；分段与胶囊在桌面上更矮（--ctl-h-xs），手机上视觉 38px。按钮左右内边距 --btn-pad-x；输入类、胶囊、分段内钮 --ctl-pad-x。</p>
            </div>
          </div>

          <div class="s-spec">
            <div class="s-k">按钮<small>.btn</small></div>
            <div class="col">
              <div class="row-wrap">
                <button type="button" class="btn btn-primary" data-cr="primary">{{ L('同步成绩', '成績を同期') }}</button>
                <button type="button" class="btn btn-ink">{{ L('游玩练习', '練習プレイ') }}</button>
                <button type="button" class="btn">{{ L('查看谱面', '譜面を見る') }}</button>
                <button type="button" class="btn btn-ghost">{{ L('取消', 'キャンセル') }}</button>
              </div>
              <div class="row-wrap">
                <button type="button" class="btn btn-sm">{{ L('小号', '小') }} .btn-sm</button>
                <button type="button" class="btn">{{ L('默认', '標準') }}</button>
                <button type="button" class="btn btn-lg">{{ L('大号', '大') }} .btn-lg</button>
                <button type="button" class="btn btn-primary"><Icon name="sync" :size="16" />{{ L('练后同步', 'プレイ後に同期') }}</button>
                <button type="button" class="btn"><Icon name="download" :size="16" />PNG</button>
                <button type="button" class="btn btn-primary" disabled>{{ L('正在同步…', '同期中…') }}</button>
                <button type="button" class="btn" disabled>{{ L('禁用', '無効') }}</button>
              </div>
              <p class="s-guide">一个视图里只有一个朱色主按钮，填充 --don-solid、文字 --ink-on-solid。.btn-ink 给不改变数据的主要动作，.btn-ghost 给取消和次要入口。按钮文案写明后果。</p>
            </div>
          </div>

          <div class="s-spec top">
            <div class="s-k">破坏性按钮<small>.btn-danger · 确认 Sheet</small></div>
            <div class="col">
              <div class="s-confirm" role="group" aria-labelledby="ds-confirm-t">
                <b id="ds-confirm-t" class="t-h3">{{ L('删除这条手动成绩？', 'この手動スコアを削除しますか？') }}</b>
                <p class="t-small">{{ L('删除后会回到上一次同步的成绩，Rating 会重新计算。这个操作不能撤销。', '前回同期したスコアに戻り、Rating が再計算されます。この操作は取り消せません。') }}</p>
                <div class="s-confirm-foot">
                  <button type="button" class="btn">{{ L('取消', 'キャンセル') }}</button>
                  <button type="button" class="btn btn-danger" data-cr="danger" @click="sheetOpen = true"><Icon name="trash" :size="16" />{{ L('删除', '削除する') }}</button>
                </div>
              </div>
              <p class="s-guide">.btn-danger 是描边按钮（--surface 底、--danger 边和字，hover 时 --danger-wash 底），只出现在确认 Sheet 的底部，紧挨着「取消」。页面上的入口用普通按钮，点了先确认。上面是确认框的静态样张，点「删除」打开真实的 Sheet。</p>
            </div>
          </div>

          <div class="s-spec">
            <div class="s-k">图标按钮<small>.icon-btn</small></div>
            <div class="col">
              <div class="row-wrap">
                <button type="button" class="icon-btn" :aria-label="L('通知', '通知')"><Icon name="bell" /></button>
                <button type="button" class="icon-btn" :aria-label="L('收藏', '保存')"><Icon name="bookmark" /></button>
                <button type="button" class="icon-btn" :aria-label="L('更多', 'その他')"><Icon name="more" /></button>
                <button type="button" class="icon-btn" :aria-label="L('关闭', '閉じる')"><Icon name="close" /></button>
              </div>
              <p class="s-guide">只给含义不会被误读的动作用，并且必须带 aria-label。桌面 38px（--ctl-h），手机 44px（--hit）。</p>
            </div>
          </div>

          <div class="s-spec top">
            <div class="s-k">触控目标<small>D7 · .hit</small></div>
            <div class="col">
              <div class="s-touch" :class="{ show: showHit }">
                <button type="button" class="chip" :aria-pressed="false">24 分</button>
                <button type="button" class="chip" :aria-pressed="true">{{ L('后半难', '後半難') }}</button>
                <div class="seg" role="group" :aria-label="L('难度', '難易度')">
                  <button type="button" aria-pressed="true">{{ L('魔王', 'おに') }}</button>
                  <button type="button" aria-pressed="false">{{ L('里', '裏') }}</button>
                </div>
                <button type="button" class="icon-btn hit s-ib-sm" :aria-label="L('收藏', '保存')"><Icon name="bookmark" :size="16" /></button>
              </div>
              <div class="row-wrap">
                <button type="button" class="btn btn-sm" :aria-pressed="showHit" @click="showHit = !showHit">{{ showHit ? '隐藏可点区域' : '显示可点区域' }}</button>
                <span class="t-small">手机尺寸样本：视觉 <b class="num">38</b>px，可点 <b class="num">44</b>px；最右是 28px 的 .hit 图标按钮。</span>
              </div>
              <p class="s-guide">手机上 .chip 与 .seg 内钮自动加透明扩展区（::after，上下各 3px）；自定义的小控件加 .hit。相邻控件间距 ≥ 6px，扩展区不重叠。虚线是扩展区，实线是视觉边界。</p>
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
                  <input id="ds-in2" class="input" :value="player.nickname" aria-describedby="ds-in2h" />
                  <span id="ds-in2h" class="field-hint">{{ L('会显示在社区和排行里。', 'コミュニティとランキングに表示されます。') }}</span>
                </div>
                <div class="field">
                  <label for="ds-in3">{{ L('成绩', 'スコア') }}</label>
                  <input id="ds-in3" class="input is-error" value="1,204,290" aria-invalid="true" aria-describedby="ds-in3e" />
                  <span id="ds-in3e" class="field-error">{{ L('成绩不能超过 1,010,000。', 'スコアは 1,010,000 以下です。') }}</span>
                </div>
                <div class="field">
                  <label for="ds-sel">{{ L('难度', '難易度') }}</label>
                  <select id="ds-sel" class="select">
                    <option v-for="d in [4, 5, 3, 2, 1]" :key="d">{{ L(DIFFS[d].zh, DIFFS[d].ja) }}</option>
                  </select>
                </div>
                <div class="field">
                  <label for="ds-in4">{{ L('鼓众广场 ID（已绑定）', '太鼓番 ID（連携済み）') }}</label>
                  <input id="ds-in4" class="input" value="4829 •••• 0662" disabled />
                </div>
                <div class="field s-wide">
                  <label for="ds-ta">{{ L('打法心得', '攻略メモ') }}</label>
                  <textarea id="ds-ta" class="textarea" rows="3" :placeholder="L('写给下一个打这张谱的人', '次にこの譜面を叩く人へ')" />
                </div>
              </div>
              <p class="s-guide">标签永远在输入框上方。边框 --ctl-border（≥ 3:1），聚焦时换成 --focus-ring 并出焦点环；占位文字 --ink-3。错误写在字段下面，说明怎样才对，不清空用户已输入的内容。手机上输入框 46px、16px 字。禁用态（:disabled 或 aria-disabled="true"）：--bg-sunk 底、--ink-3 字、--line 边框、禁止光标；禁用态不承载必要信息。</p>
            </div>
          </div>

          <div class="s-spec">
            <div class="s-k">分段控件<small>.seg</small></div>
            <div class="col">
              <div class="row-wrap">
                <div class="seg" role="group" :aria-label="L('难度', '難易度')">
                  <button v-for="d in [3, 4, 5]" :key="d" type="button" :aria-pressed="seg === DIFFS[d].key" @click="seg = DIFFS[d].key">{{ L(DIFFS[d].zh, DIFFS[d].ja) }}</button>
                </div>
                <span class="t-small">当前：{{ seg }}</span>
              </div>
              <p class="s-guide">2 到 4 个互斥的视角，切换后内容立即变化。带名称的 role="group"，项用 aria-pressed。超过 4 个改用页签或下拉。</p>
            </div>
          </div>

          <div class="s-spec">
            <div class="s-k">页签<small>.tabs</small></div>
            <div class="col">
              <div class="tabs" role="tablist" :aria-label="L('成绩', '成績')" @keydown="arrowNav($event, TABS.map((t) => t.v), tab, (v) => (tab = v))">
                <button v-for="t in TABS" :key="t.v" type="button" role="tab" :aria-selected="tab === t.v" :tabindex="tab === t.v ? 0 : -1" @click="tab = t.v">{{ L(t.zh, t.ja) }}</button>
              </div>
              <p class="s-guide">同一模块下的平级页面。tablist / tab + aria-selected，左右方向键切换（漫游 tabindex）。放不下时横向滚动，不折行、不收进「更多」。</p>
            </div>
          </div>

          <div class="s-spec">
            <div class="s-k">筛选胶囊<small>.chip</small></div>
            <div class="col">
              <div class="row-wrap">
                <button v-for="t in UGC_TAGS.slice(0, 7)" :key="t" type="button" class="chip" :aria-pressed="chipsOn.includes(t)" @click="toggleChip(t)">{{ t }}</button>
              </div>
              <p class="s-guide">可以多选的筛选条件。选中用反色，不用朱色，把朱色留给成绩。</p>
            </div>
          </div>

          <div class="s-spec top">
            <div class="s-k">标签<small>.tag · 五种色调</small></div>
            <div class="col">
              <div class="panel scroll-x">
                <table class="dt">
                  <caption class="sr-only">标签色调</caption>
                  <thead>
                    <tr><th scope="col">色调</th><th scope="col">类</th><th scope="col">样本</th><th scope="col">用于</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="t in TAG_TONES" :key="t.tone">
                      <td class="s-nowrap"><b>{{ t.tone }}</b></td>
                      <td><code>.{{ t.cls.split(' ').join('.') }}</code></td>
                      <td><span :class="t.cls" :data-cr="t.cr || undefined">{{ L(t.zh, t.ja) }}</span></td>
                      <td>{{ t.use }}</td>
                    </tr>
                    <tr>
                      <td class="s-nowrap"><b>强调</b></td>
                      <td><code>.tag.tag-don</code></td>
                      <td><span class="tag tag-don" data-cr="tag-don"><Icon name="pin" :size="12" />{{ L('置顶', '固定') }}</span></td>
                      <td>主操作相关、置顶。<b>永远不表示失败</b>，失败用危险色调。</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="row-wrap">
                <span class="role moderator">{{ L('版主', 'モデレーター') }}</span>
                <span class="role admin">{{ L('站务', '運営') }}</span>
                <span class="t-small">社区角色 .role，只出现在作者名旁。</span>
              </div>
              <p class="s-guide">标签是只读属性，不能点；高 --tag-h、圆角 --tag-radius。一行里最多 3 个，再多就说明这一行的信息需要重新排主次。</p>
            </div>
          </div>

          <div class="s-spec top">
            <div class="s-k">缺失值<small>.na · D8</small></div>
            <div class="col">
              <div class="row-wrap s-loose">
                <span class="s-na"><span class="t-caption">定数</span><span class="na">—</span></span>
                <span class="s-na"><span class="t-caption">成绩</span><span class="na">—</span></span>
                <span class="s-na"><span class="t-caption">Diff showMissing</span><Diff :d="missingChart.d" :star="missingChart.star" show-missing /></span>
                <span class="s-na"><span class="t-caption">未游玩王冠</span><Crown :v="null" /></span>
                <span class="s-na"><span class="t-caption">没有评价</span><Rank :v="0" /></span>
                <span class="s-na"><span class="t-caption">没有这个难度</span><span class="star-pip off ura">—</span></span>
              </div>
              <p class="s-guide">缺失值统一写「—」（U+2014），用 .na 上 --ink-3、正文字体、400 字重。不用 -、–、N/A、0 代替。组件自带的缺失态（Crown、Rank、.star-pip.off、Diff showMissing）不用另加。</p>
            </div>
          </div>

          <div class="s-spec top">
            <div class="s-k">数据表<small>.dt</small></div>
            <div class="col">
              <div class="panel scroll-x">
                <table class="dt s-w680">
                  <caption class="sr-only">{{ L('最佳成绩示例，可按成绩、精度、RT 排序', 'ベスト成績の例') }}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{{ L('曲目', '楽曲') }}</th>
                      <th scope="col">{{ L('难度', '難易度') }}</th>
                      <th v-for="c in SORT_COLS" :key="c.k" scope="col" class="r" :aria-sort="sort.key === c.k ? sort.dir : undefined">
                        <button type="button" @click="sortBy(c.k)">{{ L(c.zh, c.ja) }}<Icon :name="sort.key !== c.k ? 'sort' : sort.dir === 'descending' ? 'chevD' : 'chevU'" :size="12" /></button>
                      </th>
                      <th scope="col" class="c">{{ L('王冠', '王冠') }}</th>
                      <th scope="col" class="c">{{ L('评价', '評価') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="s in tableRows" :key="s.songId + '-' + s.d">
                      <td class="s-songcol"><SongCell :song="songById[s.songId]" size="sm" /></td>
                      <td><Diff :d="s.d" :star="s.star" :constant="s.constant" short show-missing /></td>
                      <td class="r num s-score">{{ fmt(s.score) }}</td>
                      <td class="r num">{{ s.acc.toFixed(2) }}%</td>
                      <td class="r num">{{ s.rt.toFixed(2) }}</td>
                      <td class="c"><Crown :v="s.crown" /></td>
                      <td class="c"><Rank :v="s.rank" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p class="s-guide">文字左对齐，数字右对齐，图形居中。有视觉隐藏的 caption，th 带 scope；可排序的表头是按钮，当前排序列用 aria-sort 标出。手机上不用它，改成列表行。</p>
            </div>
          </div>

          <div class="s-spec top">
            <div class="s-k">长列表<small>VirtualList · M6</small></div>
            <div class="col">
              <div class="row-wrap">
                <button type="button" class="btn btn-sm" :aria-expanded="vlOpen" aria-controls="ds-vl" @click="vlOpen = !vlOpen">
                  <Icon :name="vlOpen ? 'chevU' : 'chevD'" :size="14" />{{ vlOpen ? '收起' : `展开全部 ${fmt(songs.length)} 首` }}
                </button>
                <span class="t-small">总高度 = {{ fmt(songs.length) }} × {{ VL_ROW }}px = <b class="num">{{ fmt(songs.length * VL_ROW) }}</b>px</span>
              </div>
              <div v-if="vlOpen" id="ds-vl" class="s-vl">
                <div class="s-vl-bar" role="status">
                  <span>已挂载 <b class="num">{{ vlMounted }}</b> 行 / 共 <b class="num">{{ fmt(songs.length) }}</b> 首</span>
                  <span class="row-wrap">
                    <button type="button" class="btn btn-sm" @click="vlJump">跳到第 1,000 首</button>
                    <button type="button" class="btn btn-sm" @click="vlOpen = false">收起</button>
                  </span>
                </div>
                <div ref="vlBox" class="s-vl-list">
                  <VirtualList ref="vlRef" :items="songs" :row-height="VL_ROW" key-field="id" :row-class="vlRowClass">
                    <template #default="{ item, index }">
                      <span class="num s-vl-i">{{ index + 1 }}</span>
                      <span class="title-1l grow" :title="songTitle(item)">{{ songTitle(item) }}</span>
                      <span class="num s-vl-star"><template v-if="item.levels[3] != null">★{{ item.levels[3] }}</template><span v-else class="na">—</span></span>
                    </template>
                  </VirtualList>
                </div>
              </div>
              <p class="s-guide">跟随窗口滚动的定高行虚拟列表：只挂载可视区上下各 8 行，曲库与成绩同时挂载的行 ≤ 60。总高度由行数决定，后退时首帧就能还原滚动位置（R3）。表格模式用 tag="tbody" row-tag="tr"。行状态（选中、当前、可点的整行）用 rowClass / rowAttrs 挂到行元素上——上面有里谱的行带左侧色条就是 rowClass；曲库、成绩、定数表都这样做，不在每个单元格里重复判断。</p>
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
            <div class="s-k">骨架<small>.sk</small></div>
            <div class="s-skel" aria-hidden="true">
              <span class="sk s-sk-cover" />
              <span class="col s-sk-lines"><span class="sk" style="width: 62%" /><span class="sk" style="width: 38%" /></span>
              <span class="sk s-sk-num" />
            </div>
          </div>

          <div class="s-spec">
            <div class="s-k">弹层、提示、链接<small>Sheet · Popover · Toast · .link</small></div>
            <div class="col">
              <div class="row-wrap">
                <button type="button" class="btn" @click="sheetOpen = true"><Icon name="trash" :size="16" />{{ L('删除手动成绩', '手動スコアを削除') }}</button>
                <button ref="popBtn" type="button" class="btn" aria-haspopup="dialog" :aria-expanded="popOpen" @click="popOpen = !popOpen"><Icon name="settings" :size="16" />{{ L('显示选项', '表示オプション') }}</button>
                <button type="button" class="btn" @click="toast(L('已设为这次想练', '今回の練習に設定しました'))">Toast · ok</button>
                <button type="button" class="btn" @click="toast(L('最多选 5 个标签', 'タグは 5 個まで'), 'info')">Toast · info</button>
                <a class="link" href="#/review">{{ L('设计总览', 'デザイン概要') }}</a>
              </div>
              <p class="s-guide">Sheet 在桌面是居中对话框，在手机是底部抽屉，内容只写一份。Popover 锚在触发元素旁，只用于桌面（手机用 Sheet）；Esc 或点外面关闭，焦点还给触发元素。三者都用 --overlay-* token。链接用 --ka-ink，hover 才出下划线。</p>
            </div>
          </div>
        </section>

        <!-- ============ 07 业务组件 ============ -->
        <section id="ds-domain" class="s-sec">
          <h2 class="t-h1"><span class="s-n num">07</span>业务组件</h2>
          <p class="s-lede">音符、难度、王冠、评价、点灯格、封面只在 domain.css 和对应组件里定义一次（D2 / D15），页面不得自己给这些语义配色。同一个王冠在曲库、成绩表和帖子里长得一样，玩家认一次就够。</p>

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
                  <caption class="sr-only">Diff 的几种写法</caption>
                  <thead>
                    <tr><th scope="col"><span class="sr-only">难度</span></th><th scope="col">short</th><th scope="col">short + 星级</th><th scope="col">全称 + 星级 + 定数</th><th scope="col">lg</th><th scope="col">.star-pip</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="c in demoSong.charts" :key="c.d">
                      <th scope="row">{{ DIFFS[c.d].key }}</th>
                      <td><Diff :d="c.d" short /></td>
                      <td><Diff :d="c.d" :star="c.star" short /></td>
                      <td><Diff :d="c.d" :star="c.star" :constant="c.constant" show-missing /></td>
                      <td><Diff :d="c.d" :star="c.star" :constant="c.constant" lg /></td>
                      <td><span class="star-pip" :class="DIFFS[c.d].key">{{ c.star }}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p class="s-guide">三段信息永远按「难度名、星级、定数」的顺序出现。没有定数时默认不显示第三段；需要列对齐的地方加 showMissing，显示「—」并读出「没有定数」。.star-pip 只用在每列已经是一个难度的紧凑表格里。</p>
            </div>
          </div>

          <div class="s-spec top">
            <div class="s-k">难度切换条<small>.diff-tab · D2</small></div>
            <div class="col">
              <div class="s-dtabs" role="tablist" :aria-label="L('难度', '難易度')" @keydown="arrowNav($event, dtabCharts.map((c) => c.d), dtab, (v) => (dtab = v))">
                <button
                  v-for="c in dtabCharts"
                  :key="c.d"
                  type="button"
                  role="tab"
                  class="diff-tab"
                  :class="DIFFS[c.d].key"
                  :aria-selected="dtab === c.d"
                  :tabindex="dtab === c.d ? 0 : -1"
                  @click="dtab = c.d"
                >
                  <span class="dn">{{ L(DIFFS[c.d].zh, DIFFS[c.d].ja) }}</span>
                  <span class="ds num">★{{ c.star }}</span>
                  <span class="dk num"><template v-if="c.constant != null">{{ c.constant.toFixed(2) }}</template><span v-else class="na">—</span></span>
                  <Crown :v="scoreOf(demoSong.id, c.d)?.crown ?? null" size="sm" />
                </button>
              </div>
              <p class="s-guide">歌曲详情的难度即视角：选中项是难度实色底 + --ink-on-solid 字，未选中项是难度色描边。高 --hit；手机上 46px，未选中的项只显示星级与定数。切换只替换地址里的 d（R1）。</p>
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
                <Crown :v="null" size="sm" /><Crown :v="null" /><Crown :v="null" size="lg" />
                <span class="t-small">sm · 默认 · lg</span>
              </div>
              <p class="s-guide">未游玩显示「—」，未通关是空心圆，靠形状区分，不降低不透明度。</p>
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

          <div class="s-spec top">
            <div class="s-k">点灯格<small>.lamp</small></div>
            <div class="col">
              <p class="t-small">王冠模式</p>
              <ul class="s-lamps">
                <li v-for="l in LAMP_CROWN" :key="l.cls"><i class="lamp" :class="l.cls" /><span>{{ L(l.zh, l.ja) }}</span><span class="t-caption">{{ l.how }}</span></li>
              </ul>
              <div class="s-lampgrid">
                <div v-for="c in lampCells" :key="c.s.songId + '-' + c.s.d" class="lamp big" :class="crownKey(c.s.crown)">
                  <span class="lamp-title" :title="songTitle(c.song)">{{ songTitle(c.song) }}</span>
                  <span class="lamp-meta">★{{ c.s.star }}<em v-if="c.s.d === 5">{{ L('里', '裏') }}</em></span>
                </div>
                <div class="lamp big none">
                  <span class="lamp-title" :title="songTitle(tengu)">{{ songTitle(tengu) }}</span>
                  <span class="lamp-meta">★{{ tenguChart.star }}</span>
                </div>
              </div>
              <p class="t-small">评价模式</p>
              <ul class="s-lamps">
                <li v-for="l in LAMP_RANK" :key="l.key"><i class="lamp rk" :class="l.key" /><span>{{ L(l.zh, l.ja) }}</span></li>
              </ul>
              <div class="s-lampgrid">
                <div v-for="c in lampCells" :key="'r' + c.s.songId + '-' + c.s.d" class="lamp big rk" :class="RANKS[c.s.rank]?.key || 'none'">
                  <span class="lamp-title" :title="songTitle(c.song)">{{ songTitle(c.song) }}</span>
                  <span class="lamp-meta">★{{ c.s.star }}<em v-if="c.s.d === 5">{{ L('里', '裏') }}</em></span>
                  <span v-if="RANKS[c.s.rank]?.glyph" class="lamp-glyph" aria-hidden="true">{{ L(RANKS[c.s.rank].glyph, RANKS[c.s.rank].glyphJa) }}</span>
                </div>
              </div>
              <p class="s-guide">「没打过」是虚线框，「未通关」是实线细框，都不靠透明度。评价模式里描边与浅底来自评价色，字形用 --rank-*-ink。点灯进度首屏挂载的格子 ≤ 400（低星级分组默认折叠）。</p>
            </div>
          </div>

          <div class="s-spec">
            <div class="s-k">封面<small>Cover</small></div>
            <div class="col">
              <div class="row-wrap">
                <Cover v-for="s in genreSongs" :key="s.id" :song="s" />
              </div>
              <p class="s-guide">尺寸与圆角见 04 的封面阶梯。原型里按流派色生成，上线后换成真实封面，尺寸和圆角不变。</p>
            </div>
          </div>

          <div class="s-spec">
            <div class="s-k">歌曲单元<small>SongCell</small></div>
            <div class="s-pair">
              <SongCell :song="tengu" />
              <SongCell :song="longSong" />
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

          <h3 class="t-h2 s-sub">身份原子（V6）</h3>
          <div class="s-spec top">
            <div class="s-k">鼓面头像<small>PlayerAvatar · 尺寸 × 段位档次</small></div>
            <div class="col">
              <div v-for="t in AV_TIERS" :key="t.key" class="s-avrow">
                <span class="s-avk"><b>{{ t.user.name }}</b><DanBadge :dan="t.user.dan" /><span class="t-caption">{{ t.t }}</span></span>
                <span class="s-avs">
                  <span v-for="s in AV_SIZES" :key="s" class="s-av"><PlayerAvatar :user="t.user" :size="s" /><span class="t-caption num">{{ s }}</span></span>
                </span>
              </div>
              <p class="s-guide">鼓缘颜色随段位档次：低档中性（--ctl-border）、中档浅葱、高档山吹；鼓面色由色相算出，保证白色首字 ≥ 4.5:1。≥ 72px 时鼓缘上有一圈鋲。24 用在紧凑行，32 帖子行，44 楼层与帖子作者区，72 我的，96 个人主页。旁边总有昵称，所以头像默认对读屏隐藏。</p>
            </div>
          </div>
          <div class="s-spec">
            <div class="s-k">称号牌<small>TitlePlate</small></div>
            <div class="row-wrap s-loose">
              <TitlePlate v-if="plateUser" :text="plateUser.title" />
              <TitlePlate v-if="rareUser" :text="rareUser.title" rare />
              <span class="t-small">普通 · 稀有（山吹）；过长时截断，title 给出全文</span>
            </div>
          </div>
          <div class="s-spec">
            <div class="s-k">段位<small>DanBadge</small></div>
            <div class="row-wrap">
              <DanBadge v-for="d in DANS" :key="d" :dan="d" />
              <span class="t-small">没有段位时不渲染</span>
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
              <div class="panel s-rows"><ThreadRow :thread="threads[1]" /><ThreadRow :thread="longThread" /></div>
              <div class="panel s-rows s-narrow"><ThreadRow :thread="threads[3]" compact /><ThreadRow :thread="threads[6]" compact /></div>
              <p class="s-guide">先是作者（32px 鼓面头像 + 昵称 + 段位），再是版块、标签、标题与摘要；关联谱面在右侧。标题最多三行（紧凑形态两行）。紧凑形态把作者缩到底部一行。</p>
            </div>
          </div>

          <div class="s-spec top">
            <div class="s-k">目标卡<small>GoalCard</small></div>
            <div class="s-narrow"><GoalCard v-if="activeGoal" :goal="activeGoal" /></div>
          </div>

          <div class="s-spec top">
            <div class="s-k">空、错、等<small>EmptyLane</small></div>
            <div class="s-empties">
              <div v-for="e in EMPTY" :key="e.tone" class="panel">
                <EmptyLane :title="e.title" :text="e.text" :tone="e.tone" compact>
                  <button v-if="e.tone !== 'loading'" type="button" class="btn btn-sm">{{ e.tone === 'error' ? L('再试一次', '再試行') : L('同步成绩', '成績を同期') }}</button>
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

          <h3 class="t-h2 s-sub">舞台面、大封面与版块色（V1.1）</h3>
          <div class="s-spec top">
            <div class="s-k">舞台面<small>.stage</small></div>
            <div class="col">
              <div class="stage s-stage">
                <PlayerAvatar v-if="plateUser" :user="plateUser" :size="72" />
                <div class="col s-stage-id">
                  <b class="t-h2">{{ plateUser?.name }}</b>
                  <span class="row-wrap"><TitlePlate v-if="rareUser" :text="rareUser.title" rare /><TitlePlate v-if="plateUser" :text="plateUser.title" /><DanBadge :dan="plateUser?.dan" /><span class="tag">{{ L('标签', 'タグ') }}</span></span>
                  <span class="row-wrap"><button type="button" class="btn btn-sm">{{ L('关注', 'フォロー') }}</button><button type="button" class="btn btn-sm btn-ghost">{{ L('分享', '共有') }}</button><button type="button" class="link t-small">{{ L('链接', 'リンク') }}</button></span>
                </div>
              </div>
              <p class="s-guide">两套主题里都是深藍底（--stage-bg，与谱面带同一色族）。.stage 在局部重映射 --ink / --ink-2 / --ink-3 / --line / --surface / --ctl-border / --ka-ink / --roll-* 与焦点环，称号牌、段位、标签、链接、按钮放进去不用改色。用于个人主页身份带与年度回顾手机封面；谱面带本身仍用 .on-lane。</p>
            </div>
          </div>
          <div class="s-spec top">
            <div class="s-k">大封面<small>.cover.tile · 96px</small></div>
            <div class="row-wrap s-loose">
              <Cover :song="tengu" size="tile" />
              <span class="t-small">圆角 --r-ctl + 2px，字形 42px。社区头条与个人主页的代表成绩用它；手机上退到 .lg（72px）。</span>
            </div>
          </div>
          <div class="s-spec top">
            <div class="s-k">帖子行预览<small>ThreadRow preview</small></div>
            <div class="col">
              <div class="panel s-rows s-narrow"><ThreadRow :thread="previewThread" preview /></div>
              <p class="s-guide">preview 渲染为不可交互的 div：版式与列表里完全一样，没有链接、没有悬停。发帖页右侧「在列表里的样子」用它。</p>
            </div>
          </div>
          <div class="s-spec top">
            <div class="s-k">版块色<small>--section-*</small></div>
            <div class="col">
              <div class="row-wrap s-loose">
                <span v-for="sec in sections" :key="sec.slug" class="chip"><i class="dot" :style="{ color: sec.color }" />{{ L(sec.zh, sec.ja) }}<code class="t-caption">--section-{{ sec.slug }}</code></span>
              </div>
              <p class="s-guide">只作色点 / 色条，不作文字；每个色在 --surface 与 --bg 上 ≥ 3:1（浅色与深色），由 contrast-check.mjs 检查。数据里的 section.color 写作 var(--section-*)。</p>
            </div>
          </div>

          <h3 class="t-h2 s-sub">同步（S1–S4）</h3>
          <div class="s-spec top">
            <div class="s-k">手机同步按钮<small>S2 · 状态角标</small></div>
            <div class="panel scroll-x">
              <table class="dt s-w680">
                <caption class="sr-only">同步按钮在各状态下的图标、角标与可访问名称</caption>
                <thead>
                  <tr><th scope="col">状态</th><th scope="col">手机按钮</th><th scope="col">aria-label</th><th scope="col">桌面状态条（S4）</th></tr>
                </thead>
                <tbody>
                  <tr v-for="b in SYNC_BADGES" :key="b.st">
                    <td class="s-nowrap"><b>{{ b.st }}</b></td>
                    <td><SyncButton :force="{ kind: b.kind, phase: 1, still: true }" /></td>
                    <td class="t-small">{{ b.label }}</td>
                    <td class="t-small">{{ b.chip }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <p class="s-guide">山吹点 = 需要你做一步或部分成功（--status-attn），危险色点 = 失败（--status-fail）。同步中图标旋转；减少动效时静止，底部显示三颗进度点（上表画的是这个形态）。刚刚成功显示对勾，约 2.5 秒后回到空闲。</p>

          <div class="s-spec top">
            <div class="s-k">同步面板<small>SyncPanel · S3</small></div>
            <div class="col">
              <div class="panel scroll-x">
                <table class="dt s-w680">
                  <caption class="sr-only">同步面板的八种情形</caption>
                  <thead>
                    <tr><th scope="col">情形</th><th scope="col">面板内容</th><th scope="col">主按钮</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="s in SYNC_SITUATIONS" :key="s.k">
                      <td class="s-nowrap"><b>{{ s.k }}</b></td><td>{{ s.copy }}</td><td>{{ s.act }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p class="s-guide">下面八块是真实的 SyncPanel，用 force 指定情形渲染：不读也不改全站的登录态与同步状态，按钮只展示不执行。</p>
              <div class="s-sp-grid">
                <figure v-for="sp in SYNC_SITUATIONS" :key="sp.k" class="s-sp-box">
                  <SyncPanel :force="sp.force" />
                  <figcaption class="t-caption">{{ sp.k }}</figcaption>
                </figure>
              </div>
            </div>
          </div>

          <div class="s-dd">
            <div><b>用法</b>需要表达难度、王冠、评价、身份时直接放组件或 domain 类；自定义元素要难度色时加 .dc-*，取 --c / --c-ink。</div>
            <div class="no"><b>不要</b>在页面的 scoped 样式里重新给这些类上色；不要用文字「全连」「紫雅」代替组件；不要再用 .avatar。</div>
          </div>
        </section>

        <!-- ============ 08 图表与数据展示 ============ -->
        <section id="ds-charts" class="s-sec">
          <h2 class="t-h1"><span class="s-n num">08</span>图表与数据展示</h2>
          <p class="s-lede">图表回答一个问题，数字给出准确答案，两者总是一起出现。玩家不需要悬停、不需要辨色，也能读到自己的成绩。</p>

          <h3 class="t-h2 s-sub">Lane</h3>
          <Lane v-model="laneSel" :days="laneWin" :label="L('最近 28 天的练习谱面', '直近 28 日のプレイ譜面')" />
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
          <p class="s-guide">时间从左到右，判定圈落在今天；竖线是每周一，相当于小节线；音符上方的数字是当天的进展条数。一列只画一个音符，取当天最重要的那条。laneDays 按时间先后排列（今天在最后），取尾部作为显示窗口；溢出时默认停在最右端的今天。谱面带在两个主题下都是深色：音符用 --lane-don / --lane-ka / --lane-roll / --lane-fc，环与轮廓用 --note-ring / --note-outline，日期用 --lane-ink-2，星期与休息日用 --lane-ink-3（都 ≥ 4.5:1），焦点用 --focus-lane 内描边。整条带只占一个 Tab 位，← → 移动。</p>
          <div class="s-spec">
            <div class="s-k">compact<small>侧栏、个人主页</small></div>
            <div class="col">
              <div class="s-mini"><Lane v-model="miniSel" :days="miniDays" compact :label="L('最近 14 天', '直近 14 日')" /></div>
              <span class="t-small">选中：{{ dayText(miniDay) }}，{{ miniDay.facts.length }} 条进展</span>
            </div>
          </div>

          <h3 class="t-h2 s-sub">TimeStack · 时间栈（V3）</h3>
          <div class="row-wrap s-tshead">
            <div class="seg" role="group" aria-label="时间范围">
              <button v-for="r in TS_RANGES" :key="r" type="button" :aria-pressed="q.ts === r" @click="q.ts = r">{{ r }} 天</button>
            </div>
            <span class="t-small">范围写在地址里（?ts=），刷新后还原。</span>
          </div>
          <div class="s-ts">
            <TimeStack :points="stack.points" :marks="stack.marks" :bands="stack.bands" :days="laneDays" :label="L(`Rating 近 ${q.ts} 天`, `Rating 直近 ${q.ts} 日`)" />
          </div>
          <ul class="s-rules">
            <li v-for="r in TS_RULES" :key="r">{{ r }}</li>
            <li><b>成长模块里的图表是开放的，不加面板框</b>；四行共用的横轴就是版面的骨架，纵向留白宽。</li>
          </ul>

          <h3 class="t-h2 s-sub">DrumDial</h3>
          <div class="row-wrap s-loose">
            <DrumDial :value="player.rating" :size="168">
              <span class="t-caption">Rating</span>
              <b class="num s-dial-v">{{ player.rating.toFixed(2) }}</b>
              <span class="t-caption">/ 15.5</span>
            </DrumDial>
            <DrumDial v-if="activeGoal" :value="activeGoal.progress" :max="1" :step="1 / 24" :size="120" tone="ka">
              <b class="num s-dial-v sm">{{ Math.round(activeGoal.progress * 100) }}%</b>
              <span class="t-caption">{{ L('目标进度', '目標の進み') }}</span>
            </DrumDial>
            <p class="s-guide s-fill">鼓面边缘的鋲就是刻度：Rating 每颗 0.5，共 31 颗。中间永远写着准确的数字，刻度只负责「大概到哪了」。</p>
          </div>

          <h3 class="t-h2 s-sub">Radar</h3>
          <div class="s-radars">
            <figure>
              <Radar :axes="dimAxes" :focus="player.focus" :size="300" :label="L('六维', '6 つの力')" />
              <figcaption class="t-caption">六维。虚线是 30 天前，浅葱实心点是当前关注方向。量程自动收窄并写在图上。</figcaption>
            </figure>
            <figure>
              <Radar :axes="chartAxes" :domain="[0, 15.5]" :size="280" tone="var(--ka)" :label="L('谱面五维', '譜面の 5 要素')" />
              <figcaption class="t-caption">谱面五维，固定量程 0–15.5，不同谱面之间可以直接比形状。</figcaption>
            </figure>
          </div>

          <h3 class="t-h2 s-sub">LineChart</h3>
          <div class="panel panel-pad">
            <div class="spread s-linehead">
              <div class="stat"><div class="v">{{ player.rating.toFixed(2) }}<span class="d up">+{{ (linePoints[linePoints.length - 1].v - linePoints[0].v).toFixed(2) }}</span></div><div class="k">Rating · {{ L('近 90 天', '直近 90 日') }}</div></div>
              <span class="row t-small"><i class="note roll" />{{ L('里程碑', 'マイルストーン') }}</span>
            </div>
            <LineChart :points="linePoints" :marks="lineMarks" :height="210" />
          </div>
          <p class="s-guide s-gap">单一序列、单独出现在查询类页面（如 Rating）时用 LineChart；多行共享时间轴的成长图用 TimeStack。</p>

          <h3 class="t-h2 s-sub">DensityStrip · Spark · ChartSheet</h3>
          <div class="s-spec">
            <div class="s-k">DensityStrip<small>每小节密度</small></div>
            <div class="col">
              <DensityStrip :values="tenguChart.density" :height="48" />
              <div class="spread t-caption"><span class="num">1</span><span>朱色是难点所在的小节</span><span class="num">{{ tenguChart.density.length }}</span></div>
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
            <li>参考线最多 3 到 4 条，用 --line；数据线 2px 以上。坐标轴文字 --ink-3（≥ 4.5:1）。</li>
            <li>图上的每个关键值，在图旁边都能以文字读到；每个图表组件都有随语言切换的 label。</li>
            <li>颜色不是唯一的信息载体：王冠有形状和标签，评价有字形。</li>
            <li>成绩列右对齐，使用等宽数字。</li>
          </ul>
          <div class="panel scroll-x s-gap">
            <table class="dt">
              <caption class="sr-only">数字格式</caption>
              <thead>
                <tr><th scope="col">数据</th><th scope="col">写法</th><th scope="col" class="r">示例</th></tr>
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
              <caption class="sr-only">交互状态</caption>
              <thead>
                <tr><th scope="col">状态</th><th scope="col">处理方式</th></tr>
              </thead>
              <tbody>
                <tr v-for="s in STATES" :key="s.en">
                  <td class="s-nowrap"><b>{{ s.s }}</b> <code>{{ s.en }}</code></td><td>{{ s.how }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="s-spec top">
            <div class="s-k">焦点<small>--focus · 每种底色</small></div>
            <div class="col">
              <div class="s-surfs" aria-hidden="true">
                <div v-for="s in SURFACES" :key="s" class="s-surf" :class="'on-' + s">
                  <code>--{{ s }}</code>
                  <span class="row-wrap">
                    <span class="btn btn-sm s-focus">{{ L('查看', '見る') }}</span>
                    <span class="btn btn-sm btn-primary s-focus">{{ L('同步', '同期') }}</span>
                    <span class="chip s-focus">24 分</span>
                  </span>
                </div>
                <div class="s-surf s-surf-lane">
                  <code>谱面带 .on-lane</code>
                  <div class="s-lanefocus"><Lane :days="miniDays.slice(-7)" compact :model-value="null" :label="L('焦点样本', 'フォーカス例')" /></div>
                </div>
              </div>
              <p class="s-guide">上面是把焦点环固定显示出来的样本：2px --focus-gap 间隙 + 2px --focus-ring 实色环，主按钮这类实色块靠间隙与环分开；谱面带上改用 --focus-lane 内描边（今天那一列）。在本页按 Tab 键，可以看到它依次落在每个控件上。</p>
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
              <button type="button" class="btn btn-sm" @click="played = !played"><Icon name="playTri" :size="14" />{{ played ? '复位' : '播放' }}</button>
              <button type="button" class="btn btn-sm" :aria-expanded="fadeOpen" @click="fadeOpen = !fadeOpen">{{ fadeOpen ? '收起面板' : '展开面板' }}</button>
            </div>
            <div class="s-fadebox">
              <Transition name="pop">
                <div v-if="fadeOpen" class="s-overlay s-fade"><b>浮层出现</b><span class="t-small">透明度 + 8px 位移，--dur-2 与 --ease-out；离开用 --dur-1，比出现更快。</span></div>
              </Transition>
            </div>
          </div>
          <ul class="s-rules">
            <li>动效只回应一次操作或一次状态变化；页面加载与路由切换不做转场。</li>
            <li>--ease-hit：击打回弹只用于按下圆形击打物与达成反馈，不用于容器。</li>
            <li>一个页面最多一个编排过的瞬间，留给新王冠落下的时候。</li>
          </ul>

          <div class="s-spec top">
            <div class="s-k">减少动效<small>D13</small></div>
            <div class="col">
              <div class="row-wrap">
                <div v-if="hasMotionToggle" class="seg" role="group" aria-label="动效">
                  <button type="button" :aria-pressed="store.motion !== 'reduce'" @click="store.motion = 'system'">跟随系统</button>
                  <button type="button" :aria-pressed="store.motion === 'reduce'" @click="store.motion = 'reduce'">减少动效</button>
                </div>
                <span class="tag" :class="prefersReducedMotion ? 'tag-info' : ''">{{ prefersReducedMotion ? '当前：减少动效' : '当前：正常动效' }}</span>
                <span v-if="prefersReducedMotion && store.motion !== 'reduce'" class="t-small">系统设置已开启减少动效。</span>
              </div>
              <div class="s-empties">
                <div class="panel">
                  <EmptyLane tone="loading" compact :title="L('正在读取成绩', '成績を読み込み中')" :text="prefersReducedMotion ? '静止的三个音符' : '音符流过判定圈'" />
                </div>
                <div class="panel panel-pad s-skel-box" aria-hidden="true">
                  <div class="s-skel">
                    <span class="sk s-sk-cover" />
                    <span class="col s-sk-lines"><span class="sk" style="width: 62%" /><span class="sk" style="width: 38%" /></span>
                  </div>
                  <span class="t-caption">{{ prefersReducedMotion ? '骨架不扫光' : '骨架扫光' }}</span>
                </div>
              </div>
              <ul class="s-rules">
                <li v-for="r in REDUCE_RULES" :key="r">{{ r }}</li>
              </ul>
            </div>
          </div>

          <h3 class="t-h2 s-sub">路由状态（R1–R5）</h3>
          <div class="panel scroll-x">
            <table class="dt s-w560">
              <caption class="sr-only">路由状态规则</caption>
              <thead>
                <tr><th scope="col">编号</th><th scope="col">规则</th><th scope="col">做法</th></tr>
              </thead>
              <tbody>
                <tr v-for="r in ROUTE_RULES" :key="r.id">
                  <td class="num">{{ r.id }}</td><td class="s-nowrap"><b>{{ r.t }}</b></td><td>{{ r.d }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 class="t-h2 s-sub">同步反馈（S）</h3>
          <div class="panel scroll-x">
            <table class="dt s-w560">
              <caption class="sr-only">同步反馈</caption>
              <thead>
                <tr><th scope="col">入口</th><th scope="col">方式</th></tr>
              </thead>
              <tbody>
                <tr v-for="f in SYNC_FEEDBACK" :key="f.when">
                  <td class="s-nowrap"><b>{{ f.when }}</b></td><td>{{ f.how }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 class="t-h2 s-sub">反馈</h3>
          <div class="panel scroll-x">
            <table class="dt s-w560">
              <caption class="sr-only">操作反馈</caption>
              <thead>
                <tr><th scope="col">场景</th><th scope="col">方式</th></tr>
              </thead>
              <tbody>
                <tr v-for="f in FEEDBACK" :key="f.when">
                  <td><b>{{ f.when }}</b></td><td>{{ f.how }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="row-wrap s-gap">
            <button type="button" class="btn s-like" :aria-pressed="like.on" @click="toggleLike"><Icon name="heart" :size="16" /><span class="num">{{ like.n }}</span>{{ like.on ? L('已赞', 'いいね済み') : L('赞', 'いいね') }}</button>
            <button type="button" class="btn" @click="toast(L('同步完成：4 条新进展', '同期完了：新しい記録 4 件'))">{{ L('完成后的 Toast', '完了時の Toast') }}</button>
            <button type="button" class="btn" @click="sheetOpen = true">{{ L('破坏性确认', '削除の確認') }}</button>
          </div>
        </section>

        <!-- ============ 10 无障碍与国际化 ============ -->
        <section id="ds-a11y" class="s-sec">
          <h2 class="t-h1"><span class="s-n num">10</span>无障碍与国际化</h2>
          <p class="s-lede">机厅里光线暗、单手操作、中日文混排是常态。下面每一条都是已经实现的验收项（D6 · D7 · D10 · D13 · D14）。</p>
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
                <button v-for="(e, i) in EXPAND" :key="i" type="button" class="btn" :class="{ 'btn-primary': i === 0 }">{{ e[0] }}</button>
              </div>
              <div class="row-wrap" lang="ja">
                <button v-for="(e, i) in EXPAND" :key="i" type="button" class="btn" :class="{ 'btn-primary': i === 0 }">{{ e[1] }}</button>
              </div>
            </div>
          </div>
          <div class="s-spec">
            <div class="s-k">形状冗余<small>去掉颜色也能读</small></div>
            <div class="row-wrap s-loose s-gray">
              <Crown :v="null" label /><Crown :v="-1" label /><Crown :v="0" label /><Crown :v="1" label /><Crown :v="2" label /><Rank :v="4" label /><Rank :v="7" label /><Rank :v="8" label />
              <span class="num up">+0.31</span><span class="num down">−0.04</span>
            </div>
          </div>
        </section>

        <!-- ============ 11 模块的视觉表现 ============ -->
        <section id="ds-voice" class="s-sec">
          <h2 class="t-h1"><span class="s-n num">11</span>模块的视觉表现</h2>
          <p class="s-lede">同一套 token 与组件，四类模块在版面节奏、字号用法和「谱面元素出现多少」上有意区分（V）。用户从曲库走到社区，能感到换了一种场合，但认得出是同一个产品。</p>
          <div class="panel scroll-x">
            <table class="dt s-w760">
              <caption class="sr-only">四类模块的视觉对照</caption>
              <thead>
                <tr><th scope="col">模块</th><th scope="col">关键词</th><th scope="col">版面</th><th scope="col">文字与密度</th><th scope="col">颜色角色</th><th scope="col">谱面元素</th></tr>
              </thead>
              <tbody>
                <tr v-for="v in VOICES" :key="v.m">
                  <th scope="row" class="s-voice-m">{{ v.m }}</th><td class="s-nowrap">{{ v.kw }}</td><td>{{ v.layout }}</td><td>{{ v.type }}</td><td>{{ v.color }}</td><td>{{ v.fumen }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="s-voices">
            <article class="s-voice">
              <p class="s-voice-k">{{ VOICES[0].m }}<small>{{ VOICES[0].kw }}</small></p>
              <div class="panel scroll-x">
                <table class="dt dt-compact">
                  <caption class="sr-only">{{ L('最佳成绩', 'ベスト成績') }}</caption>
                  <thead>
                    <tr><th scope="col">{{ L('曲目', '楽曲') }}</th><th scope="col">{{ L('难度', '難易度') }}</th><th scope="col" class="c">{{ L('王冠', '王冠') }}</th><th scope="col" class="r">{{ L('成绩', 'スコア') }}</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="r in voiceRows" :key="r.s.songId + '-' + r.s.d">
                      <td class="s-vtitle"><span class="title-1l" :title="songTitle(r.song)">{{ songTitle(r.song) }}</span></td>
                      <td><Diff :d="r.s.d" :star="r.s.star" :constant="r.s.constant" short show-missing /></td>
                      <td class="c"><Crown :v="r.s.crown" size="sm" /></td>
                      <td class="r num">{{ fmt(r.s.score) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>

            <article class="s-voice">
              <p class="s-voice-k">{{ VOICES[1].m }}<small>{{ VOICES[1].kw }}</small></p>
              <p class="s-voice-lead">{{ L(`近 60 天 Rating ${miniDelta >= 0 ? '上升' : '变化'} ${(miniDelta >= 0 ? '+' : '') + miniDelta.toFixed(2)}，路过 ${miniStack.marks.length} 个里程碑。`, `直近 60 日で Rating ${(miniDelta >= 0 ? '+' : '') + miniDelta.toFixed(2)}、マイルストーン ${miniStack.marks.length} 件。`) }}</p>
              <TimeStack :points="miniStack.points" :marks="miniStack.marks" :bands="miniStack.bands" :days="laneDays" :height="90" :label="L('Rating 近 60 天', 'Rating 直近 60 日')" />
            </article>

            <article class="s-voice">
              <p class="s-voice-k">{{ VOICES[2].m }}<small>{{ VOICES[2].kw }}</small></p>
              <div v-if="voiceAuthor" class="s-ident">
                <PlayerAvatar :user="voiceAuthor" :size="44" />
                <span class="s-ident-t">
                  <b>{{ voiceAuthor.name }}</b>
                  <span class="row-wrap"><TitlePlate v-if="voiceAuthor.title && voiceAuthor.title !== '—'" :text="voiceAuthor.title" :rare="voiceAuthor.rare" /><DanBadge :dan="voiceAuthor.dan" /></span>
                </span>
              </div>
              <ThreadRow :thread="voiceThread" />
            </article>

            <article class="s-voice">
              <p class="s-voice-k">{{ VOICES[3].m }}<small>{{ VOICES[3].kw }}</small></p>
              <ol class="s-stepper">
                <li class="done"><i class="note ka" /><span>{{ L('登录 Viewer', 'Viewer にログイン') }}</span><Icon name="check" :size="16" class="s-ok" /></li>
                <li class="now" aria-current="step"><i class="note" /><span>{{ L('绑定鼓众广场 ID', '鼓衆広場 ID を連携') }}</span></li>
                <li><i class="note ghost" /><span>{{ L('第一次同步', '最初の同期') }}</span></li>
              </ol>
              <ul class="s-status">
                <li><span class="grow">{{ L('鼓众广场 ID', '鼓衆広場 ID') }}</span><span class="s-st ok"><Icon name="check" :size="14" />{{ L('已绑定', '連携済み') }}</span></li>
                <li><span class="grow">{{ L('菌菌控制台', 'Kinoko コンソール') }}</span><span class="s-st bad"><Icon name="warn" :size="14" />{{ L('API key 已过期', 'API キー期限切れ') }}</span></li>
              </ul>
              <button type="button" class="btn">{{ L('更新 API key 后重试', 'API キーを更新して再試行') }}</button>
            </article>
          </div>
        </section>

        <!-- ============ 12 与现有实现的映射 ============ -->
        <section id="ds-mapping" class="s-sec">
          <h2 class="t-h1"><span class="s-n num">12</span>与现有实现的映射</h2>
          <p class="s-lede">迁移时按这张表逐项替换。Design V1.1 的 token 可以和现有的 --viewer-* 并存，一个页面一个页面地换。</p>
          <div class="panel scroll-x">
            <table class="dt s-w680">
              <caption class="sr-only">现有实现与 Design V1.1 的对应</caption>
              <thead>
                <tr><th scope="col">现在</th><th scope="col">Design V1.1</th><th scope="col">用户得到什么</th></tr>
              </thead>
              <tbody>
                <tr v-for="m in MAPPING" :key="m.old">
                  <td class="s-old">{{ m.old }}</td><td class="s-now"><b>{{ m.now }}</b></td><td>{{ m.why }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="s-guide s-gap">数据规模：{{ datasetInfo.name }} 数据集，{{ fmt(datasetInfo.songs) }} 首歌、{{ fmt(datasetInfo.charts) }} 张谱、{{ fmt(datasetInfo.scores) }} 条成绩、{{ fmt(datasetInfo.threads) }} 个帖子。</p>
        </section>
      </main>
    </div>

    <Popover :open="popOpen" :anchor="popBtn" :label="L('显示选项', '表示オプション')" :width="280" @close="popOpen = false">
      <div class="col s-popc">
        <b class="t-h3">{{ L('列表密度', 'リストの密度') }}</b>
        <div class="seg" role="group" :aria-label="L('列表密度', 'リストの密度')">
          <button type="button" :aria-pressed="popDensity === 'cozy'" @click="popDensity = 'cozy'">{{ L('舒适', '標準') }}</button>
          <button type="button" :aria-pressed="popDensity === 'compact'" @click="popDensity = 'compact'">{{ L('紧凑', 'コンパクト') }}</button>
        </div>
        <button type="button" class="btn btn-sm" @click="popOpen = false">{{ L('完成', '完了') }}</button>
      </div>
    </Popover>

    <Sheet :open="sheetOpen" :title="L('删除这条手动成绩？', 'この手動スコアを削除しますか？')" :width="440" @close="sheetOpen = false">
      <p>{{ L('删除后，这张谱面会回到上一次同步的成绩，Rating 会重新计算。这个操作不能撤销。', '削除すると前回同期したスコアに戻り、Rating が再計算されます。この操作は取り消せません。') }}</p>
      <template #foot>
        <button type="button" class="btn" @click="sheetOpen = false">{{ L('取消', 'キャンセル') }}</button>
        <button type="button" class="btn btn-danger" @click="confirmDelete">{{ L('删除', '削除する') }}</button>
      </template>
    </Sheet>
  </div>
</template>

<style scoped>
/* ---------- 页面骨架 ---------- */
.s-root {
  --s-head: var(--bar-h);
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
  min-height: var(--hit);
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
  scroll-margin-top: calc(var(--s-head) + var(--sp-4));
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
.s-w620 {
  min-width: 620px;
}
.s-w680 {
  min-width: 680px;
}
.s-w760 {
  min-width: 760px;
}
.s-nowrap {
  white-space: nowrap;
}
.s-good {
  color: var(--ok);
}
.s-bad {
  color: var(--danger);
}
/* 分组表头行 */
.dt .s-grp th {
  position: static;
  padding-top: 14px;
  background: var(--surface-2);
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-12);
  font-weight: 700;
  color: var(--ink-2);
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
  color: var(--ctl-border);
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
  flex-wrap: wrap;
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
.s-chip-empty {
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--line-strong);
}
.s-pairchip {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 3px;
  width: 100%;
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
.s-cr.ui {
  width: 56px;
  height: 22px;
  padding: 0;
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
.s-rules code,
.s-ladder code,
.s-sizes code,
.s-tcell code,
.s-glyphs code,
.s-surf code {
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
.s-glyphs p.s-tlong {
  font-size: var(--fs-22);
}
.s-titles {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
  margin-top: var(--sp-5);
}
.s-tspec .s-k {
  margin-bottom: var(--sp-2);
}
.s-tspec .s-k small {
  display: inline;
  margin-left: var(--sp-2);
}
.s-tcells {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--sp-4);
}
.s-tcell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
}
.s-tbox {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
  background: var(--surface);
  min-width: 0;
}
.s-tbox-row {
  flex-direction: row;
  align-items: center;
  gap: 10px;
}
.s-tbox-row .grow {
  display: flex;
  flex-direction: column;
}
.s-tbox-row .grow b {
  font-size: var(--fs-14);
}
.s-tcard {
  font-size: var(--fs-16);
  line-height: 1.4;
}
.s-thead {
  font-size: var(--fs-22);
  font-weight: 900;
  line-height: 1.3;
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
.s-sizes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--sp-3) var(--sp-5);
}
.s-sizes li {
  display: flex;
  align-items: flex-end;
  gap: var(--sp-3);
  min-width: 0;
}
.s-size-bar {
  flex: none;
  width: 44px;
  border-radius: var(--r-xs);
  background: var(--ka-wash);
  box-shadow: inset 0 0 0 1.5px var(--ka);
}
.s-size-t {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
}
.s-size-t .num {
  color: var(--ink-2);
}
.s-radii {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
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
.s-ladder {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--sp-4) var(--sp-6);
}
.s-ladder li {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
}
.s-elev {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--sp-6);
  padding: var(--sp-2) 0 var(--sp-5);
}
.s-elev > div {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: var(--sp-5);
}
.s-elev .lift {
  box-shadow: var(--shadow-lift);
}
.s-overlay {
  background: var(--surface);
  border-radius: var(--overlay-radius);
  padding: var(--overlay-pad);
  box-shadow: var(--overlay-shadow);
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
  justify-content: space-between;
  padding: 0 var(--sp-3);
  background: var(--surface);
  border-bottom: 1px solid var(--line);
}
.s-fm-ic {
  display: flex;
  gap: 6px;
}
.s-fm-ic i {
  position: relative;
  width: 16px;
  height: 16px;
  border-radius: var(--r-xs);
  background: var(--bg-sunk);
}
.s-fm-sync::after {
  content: '';
  position: absolute;
  top: -2px;
  right: -2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--status-attn);
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
.s-colpri {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--line);
}
.s-colpri li {
  display: grid;
  grid-template-columns: 24px 150px minmax(0, 1fr);
  align-items: center;
  gap: var(--sp-3);
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
}
.s-colpri-n {
  color: var(--ink-3);
}
.s-colpri-k {
  font-size: var(--fs-13);
  font-weight: 700;
}

/* ---------- 06 基础组件 ---------- */
.s-ctlrow .s-ctl-in {
  width: 150px;
}
.s-ctlrow .s-ctl-sel {
  width: 120px;
}
.s-confirm {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 440px;
  padding: var(--overlay-pad);
  background: var(--surface);
  border-radius: var(--overlay-radius);
  box-shadow: var(--overlay-shadow);
}
.s-confirm-foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--sp-2);
  margin-top: var(--sp-2);
}
.s-touch {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-3) 0;
}
/* 样本按手机尺寸画（所有宽度下都一样），便于在桌面上评审 */
.s-touch .chip {
  height: var(--ctl-h);
  padding: 0 13px;
}
.s-touch .seg button {
  height: var(--ctl-h);
}
.s-touch .chip::after,
.s-touch .seg button::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: var(--hit);
  transform: translateY(-50%);
}
.s-touch .s-ib-sm {
  width: 28px;
  height: 28px;
}
.s-touch.show .chip,
.s-touch.show .seg button,
.s-touch.show .s-ib-sm {
  outline: 1px solid var(--ka);
  outline-offset: 0;
}
.s-touch.show .chip::after,
.s-touch.show .seg button::after,
.s-touch.show .hit::after {
  outline: 1.5px dashed var(--ka-ink);
  outline-offset: -1px;
  background: color-mix(in srgb, var(--ka) 10%, transparent);
}
.s-fields {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--sp-4);
}
.s-wide {
  grid-column: 1 / -1;
  max-width: 460px;
}
.s-na {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
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
  min-width: 0;
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
.s-vl {
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
.s-vl-bar {
  position: sticky;
  top: var(--s-head);
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2) var(--sp-4);
  padding: 8px var(--sp-4);
  background: var(--surface-2);
  border-bottom: 1px solid var(--line-strong);
  border-radius: var(--r-panel) var(--r-panel) 0 0;
  font-size: var(--fs-13);
}
.s-vl-list {
  padding: 0 var(--sp-4);
}
.s-vl-list :deep(.s-vl-ura) {
  box-shadow: inset 3px 0 0 var(--diff-ura);
}
.s-stage {
  display: flex;
  align-items: center;
  gap: var(--sp-5);
  padding: var(--sp-5) var(--sp-6);
  border-radius: var(--r-panel);
}
.s-stage-id {
  gap: var(--sp-2);
  min-width: 0;
}
.s-vl-list :deep(.vl-row) {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-13);
}
.s-vl-i {
  flex: none;
  width: 44px;
  color: var(--ink-3);
}
.s-vl-star {
  flex: none;
  min-width: 36px;
  text-align: right;
}
.s-popc {
  gap: var(--sp-3);
  align-items: flex-start;
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
.s-dtabs {
  display: flex;
  gap: var(--sp-2);
  overflow-x: auto;
  padding: 4px;
  margin: -4px;
  scrollbar-width: none;
}
.s-dtabs::-webkit-scrollbar {
  display: none;
}
.s-judge {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  max-width: 380px;
}
.s-lamps {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2) var(--sp-5);
}
.s-lamps li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-13);
}
.s-lampgrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 6px;
  max-width: 820px;
}
.s-avrow {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding-bottom: var(--sp-3);
  border-bottom: 1px solid var(--line);
}
.s-avk {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px var(--sp-2);
  font-size: var(--fs-13);
}
.s-avs {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--sp-3);
}
.s-av {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.s-empties {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: var(--sp-4);
}
.s-gate :deep(.gate) {
  margin: 0;
}
.s-sp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--sp-5);
  align-items: start;
}
.s-sp-box {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--overlay-pad);
  background: var(--surface);
  border-radius: var(--overlay-radius);
  box-shadow: var(--overlay-shadow);
  min-width: 0;
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
.s-tshead {
  margin-bottom: var(--sp-4);
}
.s-ts {
  padding: var(--sp-2) 0 var(--sp-5);
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
.s-surfs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--sp-3);
}
.s-surf {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--sp-3);
  padding: var(--sp-4);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  min-width: 0;
}
.s-surf .row-wrap {
  gap: 10px;
}
.on-bg {
  background: var(--bg);
}
.on-bg-sunk {
  background: var(--bg-sunk);
}
.on-surface {
  background: var(--surface);
}
.on-surface-2 {
  background: var(--surface-2);
}
.s-surf-lane {
  background: var(--surface);
}
.s-lanefocus {
  width: 100%;
  min-width: 0;
}
.s-lanefocus :deep(.col.today) {
  box-shadow: var(--focus-lane);
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
:root[data-motion='reduce'] .s-hitnote.on {
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  .s-hitnote.on {
    transform: none;
  }
}
.s-fadebox {
  min-height: 92px;
}
.s-fade {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 440px;
}
.s-skel-box {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--sp-3);
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

/* ---------- 11 模块的视觉表现 ---------- */
.s-voice-m {
  position: static;
  font-size: var(--fs-13);
  font-weight: 700;
  color: var(--ink);
  background: transparent;
  border-bottom: 1px solid var(--line);
}
.s-voices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-8) var(--sp-6);
  margin-top: var(--sp-8);
}
.s-voice {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  min-width: 0;
}
.s-voice-k {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  padding-bottom: var(--sp-2);
  border-bottom: 1px solid var(--line-strong);
  font-size: var(--fs-14);
  font-weight: 700;
}
.s-voice-k small {
  font-size: var(--fs-12);
  font-weight: 400;
  color: var(--ink-3);
}
.s-vtitle {
  max-width: 180px;
}
.s-voice-lead {
  font-size: var(--fs-16);
  line-height: var(--lh-body);
}
.s-ident {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-width: 0;
}
.s-ident-t {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.s-ident-t b {
  font-size: var(--fs-16);
}
.s-stepper {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.s-stepper li {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.s-stepper li.now {
  color: var(--ink);
  font-weight: 700;
}
.s-ok {
  color: var(--ok);
}
.s-status {
  border-top: 1px solid var(--line);
}
.s-status li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px var(--sp-3);
  min-height: 44px;
  padding: 6px 0;
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-14);
}
.s-st {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fs-13);
  font-weight: 500;
}
.s-st.ok {
  color: var(--ok);
}
.s-st.bad {
  color: var(--danger);
}
.s-voice > .btn {
  align-self: flex-start;
}

/* ---------- 12 映射 ---------- */
.s-old {
  color: var(--ink-2);
}
.s-now b {
  font-weight: 500;
  overflow-wrap: anywhere;
}

/* ---------- 响应式 ---------- */
@media (max-width: 1099px) {
  .s-root {
    --s-head: calc(var(--bar-h) + 46px);
  }
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
  .s-tcells {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .s-voices {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 767px) {
  .s-root {
    --s-head: calc(var(--bar-h-m) + 54px);
  }
  .s-top-in {
    height: var(--bar-h-m);
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
  .s-elev,
  .s-tcells {
    grid-template-columns: minmax(0, 1fr);
  }
  .s-frames figure:last-child {
    max-width: 190px;
  }
  .s-glyphs p {
    font-size: var(--fs-28);
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
  .s-colpri li {
    grid-template-columns: 24px minmax(0, 1fr);
  }
  .s-colpri li > .row-wrap {
    grid-column: 2;
  }
  .s-rows {
    padding: 2px var(--sp-4);
  }
  .s-ctlrow .s-ctl-in,
  .s-ctlrow .s-ctl-sel {
    width: 100%;
  }
  .s-vl-i {
    width: 36px;
  }
  .s-toc button,
  .s-back {
    min-height: var(--hit);
  }
}
</style>
