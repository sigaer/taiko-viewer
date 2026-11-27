// 评审用的画面清单：总览页、手机预览框和 QA 脚本（qa/lib/routes.mjs）共用。
// 每项 { path, name, note, auth }；auth 是打开时切换到的登录态（不写 = 保持当前）。
// 带 .js 扩展名：QA 在 Node 里直接 import 这个文件。
import { EDGE } from '../../mock/data.js'

// 边界状态的歌曲 id 在载入时从 EDGE 解析；demo 数据集里没有生成曲时退回到 full 数据集里的固定 id。
const edgeId = (key, fallback) => EDGE[key]?.[0] ?? fallback
const NO_CONSTANT = edgeId('noConstant', 3)
const NO_CHART_IMAGE = edgeId('noChartImage', 6)
const LONG_TITLE = edgeId('longJa', 12)

export const SCREENS = [
  {
    group: '重点状态',
    items: [
      { path: `/songs/${NO_CONSTANT}`, name: '歌曲详情 · 缺定数', note: '定数位显示「—」，其余信息照常', auth: 'ready' },
      { path: `/songs/${NO_CHART_IMAGE}`, name: '歌曲详情 · 没有谱面图', note: '谱面图区域的缺失状态', auth: 'ready' },
      { path: `/songs/${LONG_TITLE}`, name: '歌曲详情 · 长标题', note: '40 字以上的日文曲名与中文译名：主标题完整显示、按字换行，副标题最多两行', auth: 'ready' },
      { path: '/songs?star=10&ura=1&sort=const', name: '曲库 · 带筛选的链接', note: '从地址还原筛选与排序；进详情再返回，筛选与滚动位置还在', auth: 'ready' },
      { path: '/community/t/4017?p=2', name: '帖子 · 60 楼长帖', note: '楼层分页的第 2 页、只看楼主、跳到楼层、楼中楼折叠', auth: 'ready' },
      { path: '/u/hayate', name: '个人主页 · 他人', note: '身份带、称号牌、段位、代表成绩', auth: 'ready' },
      { path: '/account/settings', name: '设置', note: '单栏 760px、页内目录、列表密度对所有表格生效', auth: 'ready' },
      { path: '/states', name: '状态页样例', note: '加载、空、错误、未登录、未绑定、404、离线、确认' },
    ],
  },
  {
    group: '入口与今日',
    items: [
      { path: '/', name: '今日（已同步）', note: '个人驾驶舱：Rating、六维、当前目标、21 天练习谱面', auth: 'ready' },
      { path: '/', name: '今日（游客）', note: '搜索优先的产品入口 + 示例谱面', auth: 'guest' },
      { path: '/', name: '今日（未绑定 / 无成绩）', note: '三步引导：登录 → 绑定 → 同步', auth: 'unbound' },
      { path: '/me', name: '我的（手机枢纽）', note: '手机底栏第五格；一屏到达全部个人功能', auth: 'ready' },
    ],
  },
  {
    group: '曲库',
    items: [
      { path: '/songs', name: '歌曲列表', note: '分面筛选 + 紧凑表格 / 封面视图；手机为列表行 + 筛选抽屉' },
      { path: '/songs/615', name: '歌曲详情', note: '难度即视角：谱面、数据、我的成绩、玩家体感、讨论' },
      { path: '/songs/constants', name: '定数表', note: '可排序的 V2 定数与能力值，右侧检视面板' },
      { path: '/dan', name: '段位道场', note: '段位轨道 + 课题曲 + 合格条件对照' },
      { path: '/guide', name: '谱面攻略', note: '难度 × 星级矩阵取代 50 个叶子的侧栏树' },
      { path: '/titles', name: '称号与别名日志', note: '低频查阅型列表' },
    ],
  },
  {
    group: '成绩',
    items: [
      { path: '/play', name: 'Rating', note: '走势、六维变化、构成 Rating 的成绩（原 B30 / 走势图片）', auth: 'ready' },
      { path: '/play/scores', name: '全部成绩', note: '成绩管理：补录、导入、锁定、删除', auth: 'ready' },
      { path: '/play/progress', name: '点灯进度', note: '按星级 / 定数分组的王冠与评价点灯表', auth: 'ready' },
      { path: '/play/recommend', name: '练习推荐', note: '平常练什么 / 冲一个目标', auth: 'ready' },
    ],
  },
  {
    group: '成长',
    items: [
      { path: '/growth', name: '成长档案', note: '趋势、关注方向的变化、精彩时刻', auth: 'ready' },
      { path: '/growth/weekly', name: '这一周', note: '一句主题 + 七天谱面 + 六个数字', auth: 'ready' },
      { path: '/growth/goals', name: '目标', note: '当前目标、尝试轨迹、换目标、历史（旧版没有独立页面）', auth: 'ready' },
      { path: '/annual', name: '年度回顾入口', note: '桌面给出手机续看入口，手机直接开始', auth: 'ready' },
    ],
  },
  {
    group: '社区',
    items: [
      { path: '/community', name: '社区广场', note: '版块 / 帖子流 / 榜单与谱面动态' },
      { path: '/community/t/4017', name: '帖子详情', note: '阅读行宽 + 关联谱面与我的成绩 + 楼中楼' },
      { path: '/community/new', name: '发布新帖', note: '左写右预览；手机全屏编辑', auth: 'ready' },
      { path: '/community/me', name: '我的社区', note: '我的帖子、回复、收藏、历史、站务操作', auth: 'ready' },
      { path: '/notifications', name: '通知', note: '回复 / 提到我 / 赞 / 系统', auth: 'ready' },
      { path: '/u/mochidon', name: '个人主页', note: '新增提案：对外的玩家名片，公开范围自己决定' },
    ],
  },
  {
    group: '工具',
    items: [
      { path: '/tools', name: '工具', note: '查配置、查物量内联；其余工具入口' },
      { path: '/tools/rt', name: '单曲 RT 计算器', note: '输入良 / 可 / 不可，实时结果与假设推演' },
      { path: '/tools/tja', name: 'TJA 定数与谱面图', note: '上传 → 解析 → 定数与谱面图' },
    ],
  },
  {
    group: '账号与状态',
    items: [
      { path: '/login', name: '登录 / 注册 / 找回密码', note: '表单 + 一条示例谱面', auth: 'guest' },
      { path: '/bind', name: '绑定鼓众广场 ID', note: '从个人档案深处提出来的三步流程', auth: 'unbound' },
      { path: '/account', name: '账号与绑定', note: '把 18 张卡片的旧档案页重组为五个主题', auth: 'ready' },
      { path: '/account/sync', name: '同步', note: '同步目标、历史、网页成绩 token、迁移', auth: 'ready' },
      { path: '/account/settings', name: '设置', note: '外观、语言、标题显示、通知、缓存', auth: 'ready' },
      { path: '/account/developer', name: '开发者', note: '申请状态、token、应用、接口速查', auth: 'ready' },
      { path: '/account/support', name: '工单', note: '主从布局的工单列表与对话', auth: 'ready' },
      { path: '/states', name: '状态页样例', note: '加载、空、错误、未登录、未绑定、404、离线、确认' },
    ],
  },
]

export const AUTH_LABEL = { guest: '游客', unbound: '未绑定', empty: '无成绩', ready: '已同步' }
