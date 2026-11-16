# Taiko Viewer Design V1 —— 譜面 Fumen

Taiko Viewer 全站重新设计的第一版高保真原型（方向名「譜面 Fumen」）。这是一个独立的 Vite + Vue 3 工程，只使用 `src/mock/data.js` 中的示例数据；不引用、不修改 `taiko_viewer/` 生产工程，不连接后端、数据库或任何 API，也不改变现有 API 契约。本目录内的任何内容都不会被部署。

## 运行方式

需要 Node.js 与 npm。所有命令在仓库根目录下执行。

```bash
cd preview/redesign-v1
```

```bash
npm install
```

```bash
npm run dev
```

开发服务器监听 `127.0.0.1:4310`（端口来自 `package.json` 的 `vite --port 4310`，主机来自 `vite.config.js` 的 `server.host`）。`strictPort` 为 `false`，端口被占用时 Vite 会顺延到下一个可用端口，以终端输出为准。评审入口：`http://127.0.0.1:4310/#/review`。

```bash
npm run build
```

产物输出到 `dist/`。`vite.config.js` 设置了 `base: './'`，产物使用相对路径，可放在任意子目录下打开。

```bash
npm run preview
```

在 `4311` 端口预览 `dist/` 的构建结果。

## 评审入口

路由使用 hash 模式，以下地址都接在 `http://127.0.0.1:4310/` 之后。

| 地址 | 内容 |
|---|---|
| `#/review` | 设计总览：全部画面清单（每个画面可用桌面或手机尺寸打开）与文档列表 |
| `#/review/directions` | 三个设计方向（譜面 / 祭 / 帖）的对照 |
| `#/review/system` | Design System 活样张：原则、颜色（实时读取色值并实测文字对比度）、字体、间距 / 圆角 / 层级、布局、基础与业务组件、图表、状态与动效、无障碍与国际化、与现有实现的映射；书面规范见 `docs/04-design-system.md` |
| `#/review/device?p=/songs/615` | 手机预览框：把原型放进 iframe，`p` 参数为要预览的路由；可切换手机 390、小屏 360、平板 820 三种尺寸 |
| `#/states` | 状态页样例：加载、空、错误、未登录、未绑定、404、离线、无权限、表单校验、成功提示、确认删除等 14 种形态 |

### 「原型」控制

进入产品画面后，桌面右下角有一个「原型」按钮（手机上收起为贴在左缘、约 30% 高度处的小侧签，不遮挡底栏），即 `src/components/ProtoPanel.vue`。它只存在于原型中，用来切换：

- **主题**：跟随系统 / 浅色 / 深色。
- **语言**：简体中文 / 日本語。
- **登录态**：四种，见下表。

设置写入 `localStorage`（键 `tv-design-v1`），手机预览框内的 iframe 通过 `storage` 事件与外层保持一致。该按钮在 `#/review*` 页面和 iframe 内不显示；手机预览框自带同样的切换控件。

| 登录态 | 值 | 含义 |
|---|---|---|
| 游客 | `guest` | 未登录。需要成绩的页面显示登录引导 |
| 未绑定 | `unbound` | 已登录，尚未绑定鼓众广场 ID。顶栏显示「绑定鼓众广场 ID」 |
| 无成绩 | `empty` | 已绑定，尚未同步过成绩。顶栏显示「同步第一份成绩」 |
| 已同步 | `ready` | 完整数据态，默认值 |

在总览页点「桌面」或「手机」打开某个画面时，会自动切换到该画面标注的登录态。

## 画面清单

由 `src/views/review/screens.js` 整理。「登录态」列为空表示该画面不强制切换登录态。

| 分组 | 画面 | 路由 | 登录态 | 说明 |
|---|---|---|---|---|
| 入口与今日 | 今日（已同步） | `/` | 已同步 | 个人驾驶舱：Rating、六维、当前目标、21 天练习谱面 |
| 入口与今日 | 今日（游客） | `/` | 游客 | 搜索优先的产品入口 + 示例谱面 |
| 入口与今日 | 今日（未绑定 / 无成绩） | `/` | 未绑定 | 三步引导：登录 → 绑定 → 同步 |
| 入口与今日 | 我的（手机枢纽） | `/me` | 已同步 | 手机底栏第五格；一屏到达全部个人功能 |
| 曲库 | 歌曲列表 | `/songs` | | 分面筛选 + 紧凑表格 / 封面视图；手机为列表行 + 筛选抽屉 |
| 曲库 | 歌曲详情 | `/songs/615` | | 难度即视角：谱面、数据、我的成绩、玩家体感、讨论 |
| 曲库 | 定数表 | `/songs/constants` | | 可排序的 V2 定数与能力值，右侧检视面板 |
| 曲库 | 段位道场 | `/dan` | | 段位轨道 + 课题曲 + 合格条件对照 |
| 曲库 | 谱面攻略 | `/guide` | | 难度 × 星级矩阵取代 50 个叶子的侧栏树 |
| 曲库 | 称号与别名日志 | `/titles` | | 低频查阅型列表 |
| 成绩 | Rating | `/play` | 已同步 | 走势、六维变化、构成 Rating 的成绩（原 B30 / 走势图片） |
| 成绩 | 全部成绩 | `/play/scores` | 已同步 | 成绩管理：补录、导入、锁定、删除 |
| 成绩 | 点灯进度 | `/play/progress` | 已同步 | 按星级 / 定数分组的王冠与评价点灯表 |
| 成绩 | 练习推荐 | `/play/recommend` | 已同步 | 平常练什么 / 冲一个目标 |
| 成长 | 成长档案 | `/growth` | 已同步 | 趋势、关注方向的变化、精彩时刻 |
| 成长 | 这一周 | `/growth/weekly` | 已同步 | 一句主题 + 七天谱面 + 六个数字 |
| 成长 | 目标 | `/growth/goals` | 已同步 | 当前目标、尝试轨迹、换目标、历史（旧版没有独立页面） |
| 成长 | 年度回顾入口 | `/annual` | 已同步 | 桌面给出手机续看入口，手机直接开始 |
| 社区 | 社区广场 | `/community` | | 版块 / 帖子流 / 榜单与谱面动态 |
| 社区 | 帖子详情 | `/community/t/4017` | | 阅读行宽 + 关联谱面与我的成绩 + 楼中楼 |
| 社区 | 发布新帖 | `/community/new` | 已同步 | 左写右预览；手机全屏编辑 |
| 社区 | 我的社区 | `/community/me` | 已同步 | 我的帖子、回复、收藏、历史、站务操作 |
| 社区 | 通知 | `/notifications` | 已同步 | 回复 / 提到我 / 赞 / 系统 |
| 社区 | 个人主页 | `/u/mochidon` | | 新增提案：对外的玩家名片，公开范围自己决定 |
| 工具 | 工具 | `/tools` | | 查配置、查物量内联；其余工具入口 |
| 工具 | 单曲 RT 计算器 | `/tools/rt` | | 输入良 / 可 / 不可，实时结果与假设推演 |
| 工具 | TJA 定数与谱面图 | `/tools/tja` | | 上传 → 解析 → 定数与谱面图 |
| 账号与状态 | 登录 / 注册 / 找回密码 | `/login` | 游客 | 表单 + 一条示例谱面 |
| 账号与状态 | 绑定鼓众广场 ID | `/bind` | 未绑定 | 从个人档案深处提出来的三步流程 |
| 账号与状态 | 账号与绑定 | `/account` | 已同步 | 把 18 张卡片的旧档案页重组为五个主题 |
| 账号与状态 | 同步 | `/account/sync` | 已同步 | 同步目标、历史、网页成绩 token、迁移 |
| 账号与状态 | 设置 | `/account/settings` | 已同步 | 外观、语言、标题显示、通知、缓存 |
| 账号与状态 | 开发者 | `/account/developer` | 已同步 | 申请状态、token、应用、接口速查 |
| 账号与状态 | 工单 | `/account/support` | 已同步 | 主从布局的工单列表与对话 |
| 账号与状态 | 状态页样例 | `/states` | | 加载、空、错误、未登录、未绑定、404、离线、确认 |

## 目录结构

```text
preview/redesign-v1/
├─ index.html              入口 HTML（noindex）
├─ vite.config.js          127.0.0.1:4310，base './'
├─ src/
│  ├─ main.js              引入自托管字体、三份样式表、路由
│  ├─ App.vue              外壳 + 命令面板 + Toast + 原型控制
│  ├─ router.js            信息架构：6 个一级目的地 + 账号，hash 路由
│  ├─ store.js             主题 / 语言 / 登录态、L() 双语、toast、模拟同步
│  ├─ styles/
│  │  ├─ tokens.css        Design Tokens（Primitive → Semantic → Domain）
│  │  ├─ base.css          重置、排版角色、布局辅助、基础组件类
│  │  └─ domain.css        游戏语义视觉：音符、难度、王冠、评价、封面、判定条、角色
│  ├─ components/          全站框架、弹层、图表与业务组件
│  ├─ views/               产品画面（每个路由一个文件）
│  │  └─ review/           评审页：总览、三个方向、Design System、手机预览框、画面清单
│  └─ mock/data.js         示例数据（字段参照仓库真实契约，数值仅作演示）
└─ docs/                   设计文档
```

`docs/` 下计划的文档如下，与 `#/review` 页面的文档列表一致，各自单独撰写：

| 文件 | 内容 |
|---|---|
| `README.md` | 运行方式与目录说明（本文件） |
| `docs/01-product-audit.md` | 现有产品的信息架构与设计问题 |
| `docs/02-design-directions.md` | 三个设计方向与取舍 |
| `docs/03-ia-mapping.md` | 新旧信息架构映射与功能覆盖清单 |
| `docs/04-design-system.md` | Design System V1 规范 |
| `docs/05-page-specs.md` | 主要页面的设计说明 |
| `docs/06-migration-plan.md` | 实施建议与分阶段迁移方案 |

## 技术说明

- **字体自托管**：通过 `@fontsource` 包引入 Noto Sans SC / Noto Sans JP（可变字重）、Barlow（400 / 500 / 600 / 700）、Barlow Condensed（500 / 600 / 700），随构建产物一起输出，不从 Google Fonts 加载任何资源。
- **图表**：Lane、DrumDial、Radar、LineChart、DensityStrip、Spark 都是手写 SVG / CSS 组件，不依赖图表库。
- **封面**：`Cover.vue` 按曲目流派色与曲名首字生成占位封面；生产环境使用封面 CDN（`static.sakura-bot.cn/cover`）。
- **谱面图**：`ChartSheet.vue` 用确定性伪随机生成占位谱面，用于按真实谱面图的比例和密度做版式；生产环境是服务端渲染的谱面图 PNG（`/api/content/songs/:id/chart-image`）。
- **国际化**：原型使用 `store.js` 中的行内 `L(zh, ja)` 函数，不引入 i18n 包；正式实施时替换为 `locales/*.json` 中的键。
- **主题**：由 `store.js` 写入 `<html data-theme>`；「跟随系统」通过 `matchMedia('(prefers-color-scheme: dark)')` 解析为浅色或深色。

## 边界

原型刻意不做以下事情：

- 没有后端：所有数据来自 `src/mock/data.js`，同步、提交、删除等操作只在前端模拟并给出 Toast。
- 没有真实登录：登录态只是「原型」控制里的一个开关。
- 管理后台（`/admin/taiko/*`）不在本次重新设计范围内。
- 年度回顾只重做了入口页（`/annual`），故事播放器本身没有重建。
- 不涉及数据库、API 契约或 `taiko_viewer/` 中的任何文件，也不参与部署。
