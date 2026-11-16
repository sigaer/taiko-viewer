# Taiko Viewer Design V1.1 —— 譜面 Fumen

Taiko Viewer 全站重新设计的高保真原型（方向名「譜面 Fumen」），当前版本 V1.1。

## 边界

- 独立的 Vite + Vue 3 工程（纯 CSS），只使用 `src/mock/` 生成的模拟数据。
- 不引用、不修改 `taiko_viewer/` 生产工程；不连接后端、数据库或任何 API；不改变 API 契约。
- 不参与部署。同步、提交、删除等操作只在前端模拟。
- 管理后台不在范围内；年度回顾只做了入口页。
- 原型里的测试结果（包括 `qa/` 的浏览器验收）都基于模拟数据，**不是生产验收**。

## 运行

需要 Node.js 与 npm。在本目录（`preview/redesign-v1`）下执行：

```bash
npm install
npm run dev
```

开发服务器：`http://127.0.0.1:4310`（`vite.config.js`：`host 127.0.0.1`、`port 4310`、`strictPort: false`，端口被占用时顺延，以终端输出为准）。评审入口：`http://127.0.0.1:4310/#/review`。

生产构建与预览：`npm run build`（输出 `dist/`，`base: './'`）、`npm run preview`（端口 4311）。

## 评审入口

路由为 hash 模式。

| 地址 | 内容 |
|---|---|
| `#/review` | 设计总览：全部画面清单（可按桌面或手机尺寸打开）与文档列表 |
| `#/review/system` | Design System V1.1 活样张：每个样本由 tokens、base、domain 样式与组件源码直接渲染；书面规范见 `docs/04-design-system.md` |
| `#/review/directions` | 三个设计方向（譜面 / 祭 / 帖）的对照 |
| `#/review/device?p=/songs/615` | 手机预览框（390 / 360 / 820） |
| `#/states` | 加载、空、错误、未登录、未绑定、404、离线、同步样张等状态 |

## V1.1 新增与修改

逐项见 `docs/08-v1.1-fix-record.md`，裁决见 `docs/07-v1.1-design-decisions.md`。

- **同步**：全站一个状态机（`src/sync.js`）；手机顶栏同步按钮 + 状态角标；桌面状态条 + 浮层；同一个 `SyncPanel`。
- **全局搜索**：`src/search.js`（规范化、别名、假名互通、拉丁词首匹配）；配置串、物量、帖子、操作、页面；完整键盘与读屏语义；手机全屏。
- **路由状态**：`useQueryState` 把筛选写进地址；返回还原滚动；详情页返回走历史。
- **Design System 修复**：K1–K10 全部处理；控件与浮层 token；`--diff-*-ink` 等文字色；236 项对比度检查；首屏主题不闪；减少动效；缺失值统一「—」。
- **真实规模数据**：`full` 1,520 首 / 880 条成绩 / 240 帖；`demo` 30 首精选曲；14 类边界曲。
- **新组件**：VirtualList、TimeStack、PlayerAvatar、TitlePlate、DanBadge、Popover、SyncPanel、SyncButton。
- **模块视觉**：今日、歌曲详情、成长时间栈、目标、社区头条、帖子分页、个人主页、「我的」、账号类单栏、表格列优先级与密度。
- **截图复核裁定 C1–C14**：平板今日列表、谱面带列宽、谱面图每行小节数、平板曲库筛选、难度文字、详情页曲名等。

## 原型控制面板

产品画面右下角的「原型」按钮（手机上是左缘的窄把手）即 `src/components/ProtoPanel.vue`，只存在于原型中；`#/review*` 页面与 iframe 内不显示。

| 开关 | 取值 |
|---|---|
| 主题 | 跟随系统 / 浅色 / 深色（`system` / `light` / `dark`） |
| 语言 | 简体中文 / 日本語（`zh` / `ja`） |
| 登录态 | 游客 / 未绑定 / 无成绩 / 已同步（`guest` / `unbound` / `empty` / `ready`，默认 `ready`） |
| 数据规模 | 真实规模 / 精选 30 首（`full` / `demo`），切换后刷新；也可用地址参数 `?data=full|demo` |
| 下一次同步结果 | 成功 / 部分成功 / 失败（`success` / `partial` / `failed`） |
| 减少动效 | 跟随系统 / 开启（`system` / `reduce`，开启时根元素 `data-motion="reduce"`） |
| 列表密度 | 宽松 / 紧凑（`comfortable` / `compact`，与设置页同一个值） |

设置写入 `localStorage['tv-design-v1']`，iframe 通过 `storage` 事件与外层同步。

## Node 检查

只读、无需浏览器，在本目录下执行：

| 命令 | 内容 |
|---|---|
| `node src/mock/selftest.mjs` | 模拟数据自检：两套数据集的数量、边界桶、索引一致性、确定性、生成耗时 |
| `node src/search.test.mjs` | 命令面板纯逻辑（P1–P6）与每次按键耗时 |
| `node src/sync.test.mjs` | 同步状态机（S1），假计时器 |
| `node src/styles/contrast-check.mjs [--json]` | token 对比度（236 项，浅深分别计）；不达标时退出码 1 |

## 浏览器验收（QA）

`qa/run.mjs` 用系统安装的 Chrome（后备 Edge）经 `playwright-core` 驱动，默认先 `vite build` 再在 4311 端口 `vite preview`。一次一个浏览器，页面并发 ≤ 2，有时长上限，结束时关闭服务器与浏览器。说明与各项检查的局限见 `qa/README.md`。

```bash
npm run qa              # 全部矩阵与套件（node qa/run.mjs --suite all）
npm run qa:quick        # 快速子集（--quick）
npm run qa:curate       # 把关键截图复制到 qa/screenshots 并生成 index.html
node qa/run.mjs --suite checks --only songs-615
node qa/run.mjs --suite flows --flows palette,sync
```

常用参数：`--suite visual|checks|flows|perf|all`（可逗号分隔）、`--quick`、`--only <子串>`、`--flows a,b`、`--base URL`（对已有服务器运行，不构建）、`--no-build`、`--max-minutes 25`、`--concurrency 1|2`。

- 原始输出：`qa/out/`（`results.json`、`summary.md`、`run.log`、`shots/`、`flows/`），不入库（`.gitignore`）。
- 入库的精选截图：`qa/screenshots/`，用 `qa/screenshots/index.html` 浏览。
- 最近一次结果：`docs/09-v1.1-qa-report.md`。

## 目录

```text
preview/redesign-v1/
├─ index.html          首屏主题脚本（D10）、noindex
├─ vite.config.js
├─ docs/               设计文档（见下表）
├─ qa/                 浏览器验收脚本、精选截图
└─ src/
   ├─ main.js · App.vue · router.js · store.js
   ├─ sync.js · search.js · routeState.js · motion.js · breakpoints.js
   ├─ sectionNav.js · hscroll.js · focusTrap.js
   ├─ styles/          tokens.css · base.css · domain.css · contrast-check.mjs
   ├─ components/      框架、浮层、图表与业务组件
   ├─ views/           产品画面（每个路由一个文件）；review/ 为评审页
   └─ mock/            catalog.js · generate.js · data.js · selftest.mjs
```

## 文档

| 文件 | 内容 |
|---|---|
| `docs/01-product-audit.md` | 现有产品的信息架构与设计问题 |
| `docs/02-design-directions.md` | 三个设计方向与取舍 |
| `docs/03-ia-mapping.md` | 新旧信息架构映射与功能覆盖清单 |
| `docs/04-design-system.md` | Design System V1.1 规范 |
| `docs/05-page-specs.md` | 主要页面的设计说明 |
| `docs/06-migration-plan.md` | 实施建议与分阶段迁移方案 |
| `docs/07-v1.1-design-decisions.md` | V1.1 设计裁决（S / P / R / D / M / V / Q / C） |
| `docs/08-v1.1-fix-record.md` | V1.1 逐项修复记录与验证级别 |
| `docs/09-v1.1-qa-report.md` | V1.1 真实浏览器验收报告 |
