# 阶段 0 验收记录（Design System V1.3 落地生产代码）

> 当前结论：**实现成果获认可，Linux 最终验收阻塞，未通过**。第 1–10 节的历史运行结果仅为 Windows 开发自检；2026-11-17 Linux 尝试在隔离准入阶段返回 75，未启动构建或浏览器，见第 11 节。D0-4 已正式裁定为方案 B。仅批准 Linux 验收，未批准合并 main、生产发布或阶段 1 正式页面替换。

## 1. 环境与范围

| 项 | 值 |
|---|---|
| 分支 | `feature/viewer-ds-phase0`（worktree `.claude/worktrees/viewer-ds-phase0`） |
| 起点 | `origin/main` `f9b39e640061663170b103a926f9b5774c4c8916`（版本 1.14.2） |
| 阶段 0 提交 | `38f70c4` 地基 · `ca15776` ds 测试自动发现 · `e9335fa` 原子组件 · `3eabfa1` 图表（合并为 `460d5fa`） |
| 验证阶段的改动 | 第 8 节末尾列出；与本记录在同一个提交里 |
| 系统 | Windows 11（10.0.26300），Node v22.23.4，npm 10.9.9 |
| 浏览器 | Google Chrome 157.0.8103.79（系统安装版，headless），`playwright-core` 1.61.1 驱动 |
| 服务方式 | `nuxt dev`（端口 3517 / 3518），见 7.1 为什么不是生产服务 |
| 数据库 | 不连接。所有开发服务器都设 `TAIKO_DB_HOST=invalid.invalid`、`METHOD_CALLS_DB_HOST=invalid.invalid`（不可解析的保留域名） |
| 外网 | 现有页面采集与对照（P0-34）时开发服务器加载 `scripts/ds/no-egress.mjs`，拒绝一切非回环的出站连接；浏览器端同时拦截一切非本机请求 |
| 资源 | 同一时间只有一个构建或一个浏览器运行；每轮一个浏览器、最多两个页面、有总时长上限；结束后确认端口释放 |
| 版本号 | 未改（D0-8）；没有执行任何发布步骤 |

## 2. 决定与条件

### 2.1 九项决定

| # | 结论 | 怎么落实 |
|---|---|---|
| D0-1 | A：样张只在开发与显式测试构建里存在 | `nuxt.config.ts` 的 `pages:extend` 钩子调用 `ds-samples/routes.ts`，只在 `NODE_ENV=development` 或 `TAIKO_DS_SAMPLES=1` 时注册 `/_ds`；页面放在 `ds-samples/`，不在 `pages/` 下。正常构建里没有路由与代码（第 5 节） |
| D0-2 | A，加严：新 token 只在 `html.ds-preview` 下生效 | `assets/css/ds/tokens.css` 的每条声明都在 `html.ds-preview…` 下，没有 `:root`；Element Plus 映射、字体使用、共用样式同样限定。`check-tokens.mjs` 拒绝其他选择器。旧 `--viewer-*` 未改、未做别名 |
| D0-3 | A：Element Plus 映射只在样张页；主色 = 品牌青绿；info = 中性 | `assets/css/ds/element-plus.css`，全部 `html.ds-preview:root …`；主色走 `--action-bg`，info 走 `--ink-2` / `--bg-sunk`，没有音符色 |
| D0-4 | 正式 B：中日文系统字体，按需自托管 Barlow / Barlow Condensed；首屏 ≤150 KiB、≤12 请求 | `assets/css/ds/fonts.css` + `assets/font/ds/`（14 个 woff2，约 255 KB，OFL）。A 的对照见 4.3 |
| D0-5 | A：`sharp`，无损 WebP + PNG，保留原图，可重复，带 `--check` | `scripts/ds/generate_small_game_icons.mjs`，46 个文件，`--check` 逐字节一致 |
| D0-6 | 王冠可见文字属性（off / short / full），默认 off | `DsCrown` 的 `text` 属性；短名 `ds.crown.short.*` 是暂定值，阶段 2 定 |
| D0-7 | A：服务端固定默认头像地址当作没有头像 | `utils/ds/avatar.ts` + 测试（常量与两处服务端 `DEFAULT_AVATAR` 一致） |
| D0-8 | 分支如上；暂不改版本号 | 未改版本号；合并与发布另行决定 |
| D0-9 | 按 `23` 建议：做 LineChart、Spark、Radar、DrumDial、DensityStrip、Lane；不做 TimeStack、目标卡尝试轨迹 | 六个图表在 `components/ds/charts/`；DensityStrip 的生产数据来源仍待登记 |

### 2.2 八项工程条件

| # | 条件 | 结果（Windows 开发自检） |
|---|---|---|
| 1 | 进入 / 离开样张页、keepalive 激活 / 停用时正确建立与清理 `ds-preview`；离开后旧页面计算样式回到基线 | `browser-check.mjs` 72/72：客户端进入、SSR 进入、离开、keepalive 往返、样张之间切换、从素材组件页与图表页（cover、diff-tabs、title-plate、lane、line-chart、radar、note-judge）离开，`html` / `body` / Element Plus 探针的计算样式与访问前一致 |
| 2 | 弹层在样张页用新映射，离开后用旧映射 | 同上：对话框（确认在 `#__nuxt` 之外的 `<body>` 下）、下拉、选择器与选中行、Tooltip、消息在浅深两种主题下都取新 token；离开后探针回到生产值 |
| 3 | 正常构建没有样张路由、没有专用代码；不进预缓存、站点地图、`viewerPageRoutePatterns` | 第 5 节 |
| 4 | 不改全局 `--el-color-primary` | 未改；生产主按钮仍是朱色（`browser-check` 在访问前后都断言探针主按钮不是青绿） |
| 5 | scoped `:global(...) .x` 检查；`chart-ugc.vue` 只报告 | `check-scoped-css.mjs`；新代码 0 处；仓库报告只有 `pages/admin/taiko/chart-ugc.vue:212` 一行的 5 个选择器，未修 |
| 6 | 不移植原型的路由、模拟数据、store、登录与同步状态机 | 未移植；样张数据是 `ds-samples/data/atoms.json` 的静态值 |
| 7 | 保留 SSR、i18n、PWA、权限、接口约定 | 样张用生产的主题 cookie、i18n 前缀与 `useHead`；没有新接口；PWA 配置未改 |
| 8 | 验收在 Linux；本机只是开发自检 | 本文全部结果标为 Windows 开发自检；第 9 节为 Linux 手册 |

## 3. 任务清单状态（P0-01 – P0-37）

| 任务 | 状态 | 说明 |
|---|---|---|
| P0-01 基线 | 部分完成 | 采集脚本 `scripts/ds/existing-pages.mjs` 已写；本机在回退演练树（= `f9b39e6`）上采集了 18 个不依赖数据库的页面（4.6）。需要登录或测试库的页面、以及生产形态服务下的基线，要在 Linux 上补 |
| P0-02 约定 | 完成 | `docs/design-system/viewer-ds.md` |
| P0-03 token | 完成 | 4704 个解析值与原型 C+ 级联一致；`04` §2.2–2.5 表格 211 个值一致 |
| P0-04 同名检查 | 完成 | 12 处同名读取全部就近定义 |
| P0-05 对照表 | 完成 | `viewer-token-mapping.md`（脚本生成） |
| P0-06 断点与底部空间 | 完成 | `utils/ds/breakpoints.ts` + 测试 |
| P0-07 对比度 | 完成 | 368 对全部达标 |
| P0-08 Element Plus 映射 | 完成 | 浏览器自检见 2.2 |
| P0-09 字体 | 完成（方案 B） | |
| P0-10 字体实测 | 完成（开发测量） | `/_ds/fonts` + `scripts/ds/font-measure.mjs`，见 4.3；预算已正式确认：首屏 ≤150 KiB、≤12 请求；Linux 测量阻塞 |
| P0-11 素材校验和 | 完成 | 30 个原图字节数 + md5 |
| P0-12 小尺寸素材 | 完成 | 1× / 2× 对照图在 `phase0-artifacts/small-icons/`，待负责人看图 |
| P0-13 王冠换算 | 完成 | 真实成绩抽样比对留到阶段 2（测试库） |
| P0-14 选图工具 | 完成 | |
| P0-15 音符与判定条 | 完成 | 浏览器自检 4.2 |
| P0-16 – P0-24 原子组件 | 完成 | 原子组件代理的浏览器自检 406/407（唯一一项是「屏蔽曲绘域名、390 宽」检查脚本的期望写法问题，截图正常），本轮抽查与矩阵通过 |
| P0-25 图表 | 完成 | 浏览器自检 350/350，见 4.2 |
| P0-26 样张框架 | 完成 | |
| P0-27 样张总览 | 完成 | `/_ds` 按编号分四组；矩阵 457/457，见 4.4 |
| P0-28 scoped 样式检查 | 完成 | 根元素属性样例在浏览器里作用在目标元素上 |
| P0-29 颜色与素材用法 | 完成 | 0 处；图表代理放宽的规则已收窄（第 8 节） |
| P0-30 文案检查 | 完成 | 75 个 `ds.*` 键中日对应；人工审查记录见 4.8 |
| P0-31 SSR 与水合 | 完成（开发自检） | 矩阵：直接打开与客户端跳转都 0 水合警告、0 控制台错误；服务端 HTML 已带主题与作用域 |
| P0-32 i18n | 完成（开发自检） | `/ja/_ds/*` 的 `html lang` 为 `ja-JP`；没有日文回落到中文 |
| P0-33 PWA | 部分完成 | 本机预缓存清单只有 3 项（见 7.1），默认 `globPatterns` 的问题要在 Linux 构建上确认 |
| P0-34 现有页面不变 | 部分完成 | 18 个页面 × 1440 / 390 × 浅 / 深 = 72 个状态与基线一致（4.6）；其余页面要 Linux + 测试库 |
| P0-35 体积与字体增量 | 完成（开发自检） | 第 5 节 |
| P0-36 回退演练 | 完成 | 第 6 节 |
| P0-37 验收记录 | 本文 | 合并与发布未执行，等负责人确认 |

## 4. 各项检查（命令、结果、环境）

所有命令在 `taiko_viewer/` 下运行。

| 检查 | 命令 | 结果 | 环境 |
|---|---|---|---|
| 单元测试与检查脚本正反例 | `npm run test:ds` | 85/85 | Windows 开发自检 |
| 版本号投影（现有） | `npm run test:version` | 通过 | Windows 开发自检 |
| 静态检查总入口 | `npm run check:ds` | 通过 | Windows 开发自检 |
| token 与原型、`04` 对照 | `node scripts/ds/check-tokens.mjs --prototype <redesign-v1>` | 4704 值一致；`04` 211 值一致、13 格为文字说明 | Windows 开发自检 |
| 对比度 | `npm run check:ds-contrast` | 368/368 | Windows 开发自检 |
| scoped 样式 | `npm run check:scoped-css` | 新代码 0；仓库报告 `chart-ugc.vue:212`（5 个选择器） | Windows 开发自检 |
| 颜色与素材用法 | `node scripts/ds/check-ds-usage.mjs` | 0 | Windows 开发自检 |
| 文案 | `node scripts/ds/check-ds-copy.mjs --list` | 0；75 键 | Windows 开发自检 |
| 小尺寸素材可重复 | `node scripts/ds/generate_small_game_icons.mjs --check` | 46 个文件逐字节一致，原图未变 | Windows 开发自检 |
| 作用域 / keepalive / 弹层 | `node scripts/ds/browser-check.mjs --base http://127.0.0.1:3517` | 72/72 | Windows 开发自检（`nuxt dev`） |
| 样张矩阵 | `node scripts/ds/samples-matrix.mjs --base http://127.0.0.1:3517` | 457/457 | Windows 开发自检（`nuxt dev`） |
| 图表样张 | `node scripts/ds/charts-check.mjs http://127.0.0.1:3517 <dir>` | 350/350 | Windows 开发自检（`nuxt dev`） |
| 字体对照 | `node scripts/ds/font-measure.mjs --base … --fontsource <@fontsource-variable 目录> --rounds 3` | 见 4.3 | Windows 开发测量（`nuxt dev`） |
| 现有页面 | `node scripts/ds/existing-pages.mjs capture …` / `compare …` | 72/72 一致，见 4.6 | Windows 开发自检（`nuxt dev`） |
| 构建对比 | `node scripts/ds/build-report.mjs --compare …` | 见第 5 节 | Windows 开发自检 |

### 4.2 图表（P0-25）

`charts-check.mjs`：7 个图表样张 × 浅 / 深 × 中 / 日 × 1440 / 390，检查主题属性、控制台与水合、可访问名称、SVG 文字相撞与裁切、横向溢出；Lane 的单一 Tab 停靠、方向键 + 回车选择、谱面带焦点环；折线悬停读数；减少动效下音符不缩放、无过渡、无动画。第一次运行 342/350，8 项失败全是雷达「维度名」与「数值」两行文字的包围盒在纵向相交 0.8 px（`getBoundingClientRect` 包含整行的上下行距，字形并不接触，截图确认）。判定改为两个方向都超过 2 px 才算相撞后 350/350。没有改图表组件。

截图在 `phase0-artifacts/charts/`（每个图表：中文 1440 / 390、日文 390，浅 / 深）。与原型 `qa/screenshots/v13-final/` 的今日、歌曲、Rating、成长页对照：谱面带的音符、连打条、计数与今天标记，雷达的六维、虚线上期与重点点，折线与 Spark 的品牌色单序列，与原型一致。截图里右下角的计时小条是 Nuxt DevTools（只在 `nuxt dev` 出现）。

### 4.3 字体对照（P0-10，D0-4）

页面 `/_ds/fonts`（中文）与 `/ja/_ds/fonts`（日文），文字量约为今日首屏、曲库一屏、帖子正文一屏。方案 A 的 Noto Sans SC / JP 可变字体（`@fontsource-variable` 5.3.1，SC 约 4.6 MB、JP 约 5.6 MB）**没有加依赖、没有放进仓库**：测量脚本从原型目录已安装的包读取，经本机临时文件服务按需应答 `/_ds-fonts-a/*`；正常构建与测试构建都不含这些文件。每种组合冷缓存 3 轮。`slow` 为 CDP 网络模拟（150 ms 延迟、1.6 Mbit/s）。服务是 `nuxt dev`（未打包），绝对值偏大，只能看相对差别。

| 网络 | 语言 | 方案 | 字体请求 | 字体传输 KiB | 字体到达 ms | FOUT ms |
|---|---|---|---|---|---|---|
| 不限速 | 中 | B | 12 | 134 | 107–184 | 0 |
| 不限速 | 中 | A | 31 | 1177 | 144–159 | 35–38 |
| 不限速 | 日 | B | 12 | 134 | 184–193 | 0 |
| 不限速 | 日 | A | 46 | 853 | 254–266 | 54–59 |
| 慢速 | 中 | B | 12 | 134 | 3529–3728 | 1557–1724 |
| 慢速 | 中 | A | 31 | 1177 | 16456–16769 | 10598–10620 |
| 慢速 | 日 | B | 12 | 134 | 3728–3738 | 1676–1710 |
| 慢速 | 日 | A | 46 | 853 | 13505–13706 | 7597–7746 |

FOUT = 字体全部到达时间 − 首次内容绘制时间（`font-display: swap`，期间先用回落字体）。方案 B 的 12 个请求是 Barlow 两个分片 × 用到的字重。方案 A 在一屏文字上就多出 19（中）/ 34（日）个分片请求和 0.7–1.0 MB 传输；慢速网络下替换延迟约 8–11 秒。2026-11-17 负责人正式确认首屏自托管字体预算 ≤150 KiB、≤12 个请求；正式页面首次集成时重新验证字体加载和 FOUT，不引入完整自托管 Noto Sans SC / JP。上表仍仅为 Windows 开发测量。

### 4.4 样张总览与矩阵（P0-27 / P0-31 / P0-32）

`/_ds` 列出 22 个样张，按编号分四组：tokens-type 3、controls 3、asset-components 9、notes-charts 7。矩阵：23 个页面（总览 + 22 个样张）× 1440 / 820 / 390 / 360 × 浅 / 深 × 中 / 日 = 368 次直接打开，加 88 次客户端跳转与 1 项总览检查，共 457 项，全部通过：0 控制台错误、0 水合警告、0 页面异常、0 横向溢出；服务端 HTML 已带 `data-theme` 与 `ds-preview`（深色首屏不先出浅色）；`/ja/_ds/*` 的 `html lang` 是 `ja-JP`；页面上没有 `ds.` 键原文，没有中文专有的 `ds.*` 文字出现在日文页面。

发现并修正的两处样张问题：排版样张在 360 宽横向溢出 17 px（字号阶梯里的长串数字、数字层级一行不换行），加了 `overflow-wrap: anywhere` 与 `flex-wrap: wrap`；头像样张故意喂一个不存在的地址来展示退回，浏览器对这一个地址的「Failed to load resource」是预期的，矩阵只放过这一个地址。

### 4.5 作用域与弹层（条件 1、2）

见 2.2。另外记下两点：

- keepalive + Element Plus 弹层：被缓存的样张页里有常驻的弹层节点（select、tooltip、dropdown），当换成有布局的页面导致 `<NuxtPage>` 重建时，Vue 在卸载这些已停用的 Teleport 时报 `Cannot read properties of null (reading 'nextSibling')`，之后 head 不再更新、`ds-preview` 留在下一页。样张壳 `DsSampleShell` 在离开路由时先卸载内容，问题消失（本轮从素材页与图表页离开都覆盖了）。生产代码可能有同样的模式，见第 8 节。
- 浏览器检查里「离开后与访问前一致」对一个探针做了说明性放宽：样张页弹出过消息后，Element Plus 的 `el-message` 样式表才被加载，现有页面上的消息探针从「未加样式」变为「生产映射的成功色」（`--viewer-success-surface`）。脚本只在探针值恰好等于生产值时接受这一变化，其他任何差异都失败。

### 4.6 现有页面不变（P0-01 / P0-34）

基线：回退演练树（第 6 节，内容等于 `f9b39e6`），`nuxt dev` 端口 3518。当前：阶段 0 最终工作树，`nuxt dev` 端口 3517。两边环境相同：数据库地址不可解析、`no-egress.mjs` 拒绝一切出站连接（被拒的目标：`8.138.33.103:4290`、`viewer.sakura-bot.cn:443`、`cdn.ourtaiko.org:443`、`www.bilibili.com:443`、`invalid.invalid:3306`），浏览器拦截非本机请求，减少动效，`viewer_locale=zh`。

覆盖的页面（每页 1440 / 390 × 浅 / 深）：`/`、`/songs`（→ `/songs/available`）、`/songs/available`、`/songs/1`、`/songs/v2-constants`、`/titles`、`/guide`、`/guide/4/10`、`/grade`（→ `/grade/2026/五級`）、`/tools`（→ `/more`）、`/forum`、`/settings`、`/about`、`/more`、`/ja`、`/ja/songs`（→ `/ja/songs/available`）、`/ja/settings`、`/ja/about`。共 72 个状态。没有数据库和数据目录时，这些页面里的列表与数据区显示的是各自的空态或错误态，两边一致。

每个状态比较：最终 URL 与状态码、20 类关键元素的 19 项计算样式与 `html` 属性、已加载字体、字体与图片请求列表、整页截图逐像素。截图里所有 `<img>` 画成实心块（位置与尺寸仍在截图里，加载了哪些图片由请求列表比较）：同一棵树连续采集两次时，本机 Chrome 对缩小显示的照片（首页活动图、关于页头像、侧栏标志）每次光栅化结果略有不同。

结果：

- 方法稳定性：当前树连采两次，72/72 完全一致。
- 基线 vs 当前：第一次对照 71/72 一致，`about__390__dark` 有 1 个像素的蓝色通道差 1（54 → 55）。在基线树上对 `/about` 再采两次，这两次都与当前树完全一致、与第一次基线相差同一个像素，所以这是第一次基线采集的偶发光栅化误差，不是阶段 0 造成的变化。结论：72/72 一致，0 个新字体或图片请求。

没有覆盖、要在 Linux 上用测试库补的页面：需要登录的 `/account/*`、`/my/*`、`/forum/me`、`/forum/notifications`、帖子详情与发帖、`/admin/taiko/*`；以及上面各页在有真实数据（测试库、数据目录）时的列表与详情状态。

### 4.7 小尺寸素材

46 个文件（评价 7 × 56 / 80，王冠 3 × 36 / 60 / 96，各 WebP 与 PNG）；`public/` 增加约 0.3 MB。对照图待负责人看图确认。

### 4.8 文案人工审查

`node scripts/ds/check-ds-copy.mjs --list` 列出的 75 个键逐条看过：都是名称、状态或必要说明（例如「没有曲绘」「未游玩」「暂无数据」），没有规格语言或设计理由。`ds.sample.*` 三个主题标签只用于样张页，但随 locale 文件发给所有用户（几十字节）。`ds.crown.short.*` 是暂定值。

## 5. 构建与体积（P0-33 / P0-35）

构建命令：`node scripts/prepare_tja_runtime.mjs && npx nuxt build`（原因见 7.1）。报告：`node scripts/ds/build-report.mjs --out <json>`；对比：`--compare <基线> <当前> [--expect-samples]`。产物与报告在 `.claude/phase0-artifacts/final/builds/`（不提交）。

| 对比 | 结论 | 要点 |
|---|---|---|
| 最终正常构建 vs 基线（`f9b39e6` 导出树） | OK | 没有 `/_ds` 路由；manifest 与服务端产物里没有样张标记；预缓存条目相同（哈希改名除外）；web manifest 与 `theme-color #eaf6f5` 相同；注册路由 133 条相同；`pages/` 文件 76 个相同（`viewerPageRoutePatterns` 的输入）；79 个现有路由与布局的依赖列表、CSS 文件数与字节相同；入口 CSS 26,916 B 不变 |
| 回退演练树 vs 基线 | OK | 内容相同的两棵树，只有路径不同，见下面的 −8 字节 |
| 测试构建（`TAIKO_DS_SAMPLES=1`）vs 回退演练树 | 样张路由存在 | `/_ds` 与 `/ja/_ds` 下 23 个路由（总览 + 22 个样张）。另外 4 个现有路由的 CSS 拆分变了（`el-drawer`、`el-segmented` 的样式被样张页共用后改到共享块里）：只在测试构建里发生，所以测试构建不能部署 |

正常构建里查不到阶段 0 的任何东西：在 `.output/public`、`.output/server` 与 `.nuxt/dist` 里搜索 `components/ds/`、`utils/ds/`、`ds-samples`、`assets/css/ds`、`assets/font/ds`、`barlow`、`Barlow Condensed`、`__ds-missing`（`atoms.json` 里的样张数据）、`DsCrown`、`DsSampleShell`、`ds-preview`、`html.ds-preview`、`smallSrc`、`crownFromCounts` 等，正常构建全部 0 处；同样的搜索在测试构建里能找到（例如 `components/ds/` 在 `.nuxt/dist` 51 处、`ds-preview` 在 `.output/public` 2 处），说明搜索本身有效。正常构建会带上的只有：`locales/*.json` 的 `ds` 键（随语言块下发）与 `public/icons/` 下 46 个小尺寸素材文件（静态文件，不被任何现有页面请求，4.6）。

体积增量（最终正常构建 vs 回退演练树，两棵树路径等长）：

| 项 | 前 | 后 | 差 |
|---|---|---|---|
| `_nuxt` 总计 | 295 个 / 5,006,960 B | 295 个 / 5,010,383 B | +3,423 B（几乎全是语言块） |
| 中文语言块 | 77,317 B | 78,977 B | +1,660 B |
| 日文语言块 | 94,830 B | 96,600 B | +1,770 B |
| 入口 CSS | 26,916 B | 26,916 B | 0 |
| 字体文件 | 1（`TaikoDisplay-latin`） | 1 | 0 |
| `public/` 文件 | 199 | 245 | +46（小尺寸素材，约 0.3 MB） |
| 测试构建 `_nuxt` | — | 374 个 / 5,465,052 B | +458,092 B（样张代码与 Barlow 字体，只在测试构建） |

**现有路由 JS 总量约 −8 字节的原因（上一轮对比）。** 入口块里有两处 i18n 语言文件的**绝对路径**（作为懒加载缓存键，形如 `C:/Users/…/taiko_viewer/i18n/locales/zh.ts` 与 `…/ja.ts`），每个页面都依赖入口块。上一轮的基线树放在 `.claude/phase0-artifacts/baseline-tree/taiko_viewer`，比工作树 `.claude/worktrees/viewer-ds-phase0/taiko_viewer` 长 4 个字符，两处共 8 字节。验证：本轮的回退演练树内容与基线完全相同（树对象同为 `ef30c8a`），放在与工作树等长的路径 `.claude/worktrees/viewer-ds-rollbk/`，它与上一轮基线的对比正好是全部 79 个路由 −8 字节、`_nuxt` 总量 −8 字节，其他全同；在演练树的入口块里能直接搜到 `viewer-ds-rollbk/taiko_viewer/i18n/locales/zh.ts` 与 `ja.ts`。

**等长路径下还剩的小差别。** 最终构建 vs 演练树：7 个路由 JS 差 +5 / −2 / −5 字节（admin 登录、score-token 文档、论坛四页、2024 段位），其余 72 个为 0。原因是行尾：工作树是 Windows 检出（`core.autocrlf=true`，源码为 CRLF），演练树按 LF 检出；`@vitejs/plugin-vue` 在生产构建里用「相对路径 + 源码文本」计算组件的 scoped id（`data-v-xxxxxxxx`），行尾不同 id 就不同（例如 `login.vue` 的 `1852fda6` 与 `6ae52761`），压缩器按字符频率分配短变量名，于是个别块的变量名长短略有变化（`login.vue` 块里 `a as e` 变成 `a`，−5 字节）。id 长度固定，所以 CSS 字节不变。这两类差别都与阶段 0 的改动无关；Linux 上 LF 检出、同一路径构建时应当为 0。

**`useI18n` 的显式导入。** 原子组件写 `import { useI18n } from "vue-i18n"`，图表组件用 Nuxt 自动导入。测试构建里 vue-i18n 只有一份，在入口块里；样张块（例如 `71-crown`、`83-radar`）都从入口块导入，组件被内联在各自的样张块里，所以两种写法拿到的是同一个模块实例、同一个 i18n。运行表现在 `nuxt dev` 下验证过（矩阵：中日文切换、没有原样的 `ds.` 键、没有回落）；测试构建的运行（需要 Nitro 服务端）在本机做不了，记为未验证。

## 6. 回退演练（P0-36）

在不建分支的临时 worktree 上撤销全部阶段 0 提交，记录在 `.claude/phase0-artifacts/final/rollback-drill.log`：

1. `git -c core.autocrlf=false worktree add --detach .claude/worktrees/viewer-ds-rollbk 460d5fa`
2. 按新到旧撤销（合并提交用 `-m 1`，它同时撤销了图表提交 `3eabfa1`）：
   `git revert --no-commit -m 1 460d5fa`、`git revert --no-commit e9335fa`、`git revert --no-commit ca15776`、`git revert --no-commit 38f70c4`，再提交一次（临时提交 `6eef344`，只在这个分离头上）。
3. 核对：`git rev-parse f9b39e6^{tree}` 与 `git rev-parse HEAD^{tree}` 都是 `ef30c8af458f52fd5f3978201900ee27e3b4d949`；`git diff --stat f9b39e6 HEAD` 为空。
4. 构建（同第 5 节的命令）并出报告：与基线对比 `build comparison: OK`，差别只有上面解释的路径 −8 字节。
5. 在这棵树上起 `nuxt dev`（端口 3518）做现有页面基线采集（4.6）。
6. 清理：删除 `node_modules` 连接点（不动目标）、`git worktree remove`；没有创建分支，没有强制操作；临时提交无引用，随 git 垃圾回收消失。

结论：撤销只需要撤销这几个提交；没有数据库、接口或配置文件之外的状态需要回收。发布后的回退仍按 `23` P0-37：撤销提交后重新走部署脚本。

## 7. 没能验证的事

### 7.1 本机的限制

- `npm run build` 按仓库定义在第一步失败：`generate_annual_types.mjs --check` 读取仓库之外的 `../../schemas/annual-summary-v4.schema.json`。本机构建用 `node scripts/prepare_tja_runtime.mjs && npx nuxt build`，只少了这一步只读检查。
- 本机 Nitro 服务端打包失败（rollup 把 `ali-oss/lib/common/utils/encoder` 解析到 `.ts`），基线与当前一样。客户端构建、预渲染页面、`sw.js` 与 web manifest 都有产出，构建对比用这些；因为没有可运行的生产服务，浏览器检查都在 `nuxt dev` 上做。
- 本机的 Service Worker 预缓存清单只有 3 项（`_nuxt/builds/latest.json`、`builds/meta/<id>.json`、`manifest.webmanifest`），与 Nitro 打包中断有关，不能代表生产。`23` 2.10 的「默认 `globPatterns` 会收进哪些文件」仍未确认。
- Windows 的 `core.autocrlf=true` 让 `vendor/tja*` 的文本变成 CRLF，`prepare_tja_runtime.mjs` 的来源校验失败；构建与开发服务器运行前把这些文件从索引按 LF 写回，结束后用 `git checkout` 恢复。
- 本轮早期的浏览器检查（作用域、矩阵、图表、字体）运行时，开发服务器还没有加 `no-egress.mjs`，只把数据库地址设为不可解析。这些检查只打开 `/_ds/*` 与 `/settings`；当时有没有服务端出站请求没有记录。现有页面的采集与对照两边都在加了守卫之后进行。

### 7.2 记为未验证的项

- Linux 隔离环境下的一切：验收构建、浏览器 QA、内存记录（`23` 0-D7）。
- 生产形态（`nuxt build` 后的 Nitro 服务）下的样张页与现有页面；测试构建里 `useI18n` 显式导入的运行表现（本机只能做构建产物检查，见第 5 节）。
- 需要登录或测试库的现有页面（4.6 列表）。
- 真机：字体观感、软键盘、真实网络下的曲绘与字体。
- Bot 的 `_rank_icon_path` 与评价图对应（B12.4）。
- 王冠 / 评价换算在真实成绩上的抽样（B2.6，阶段 2，测试库）。
- 小尺寸素材 1× / 2× 的人工看图结论。
- 首屏字体预算的 Linux 运行验证（预算已正式确认为 ≤150 KiB、≤12 请求，D0-4 / B1.3）。

## 8. 生产代码里观察到的问题（只记录，未改动）

| 位置 | 现象 | 处理 |
|---|---|---|
| `pages/admin/taiko/chart-ugc.vue:212` | scoped 样式写成 `:global(body.theme-dark) .ugc-admin-panel` 等 5 个选择器，编译后只剩 `body.theme-dark`，深色规则落在 `body` 上 | 观察到，未改动 |
| keepalive + Element Plus Teleport | 被缓存的页面带常驻弹层（select、tooltip、dropdown）时，换到另一个布局会在卸载时报 `nextSibling` 错误，之后 head 不更新。样张壳已规避；生产页面在不同布局之间切换时可能遇到 | 观察到，未改动 |
| `/settings` | 开发模式下有水合不一致（`max-height: 240px` 的 style 不一致），访问样张前就存在 | 观察到，未改动 |
| `package-lock.json` | `npm ci` 失败：`Missing: unplugin@3.7.0 from lock file`；部署脚本用 `npm install`，本机也按此安装（`--no-save`，锁文件未变） | 观察到，未改动 |
| `scripts/generate_annual_types.mjs --check` | 依赖仓库外的 schema 文件，`npm run build` 在没有该文件的环境里第一步失败 | 观察到，未改动 |
| Nitro 打包（Windows） | `ali-oss` 的 `encoder` 被解析到 `.ts` 而失败 | 观察到，未改动 |
| `scripts/performance/route-assets.mjs` | 读取 `.nuxt/dist/server/client.manifest.json`，Nuxt 3.21 产出的是 `client.manifest.mjs`，脚本在当前构建上找不到清单 | 观察到，未改动 |
| 客户端入口块（`@nuxtjs/i18n` 懒加载） | 构建机上语言文件的绝对路径（`…/taiko_viewer/i18n/locales/zh.ts`、`ja.ts`）作为缓存键写进公开的入口 JS；生产构建会暴露服务器上的目录结构，且构建目录变化会改变入口块字节 | 观察到，未改动 |
| 开发服务器的服务端请求 | 渲染首页、曲库等页面时会连 `8.138.33.103:4290`（Bot 接口）、`viewer.sakura-bot.cn`、`cdn.ourtaiko.org`、`www.bilibili.com`；在本地自检时需要隔离 | 观察到，未改动；自检用 `no-egress.mjs` |

与 `23` / `04` 的偏离（已获设计负责人同意或需记录）：Lane 用 HTML 按钮加 CSS 实现，不是纯 SVG（键盘可达与彩虹缘需要），偏离 `23` P0-25 的「纯 SVG」；舞台面上 `--don-data` 解析为 `--don`，这是冻结的原型行为，第一次把判定条放到舞台面的阶段需要复核；默认头像保留圆形裁切；Spark 默认色用品牌序列色；折线面积填充保持原型的 9%；`DsNote` 默认对读屏隐藏；判定条图例只用文字和数字、不加色块。其余偏离见 `viewer-ds.md` 与地基交接记录（`base.css` 第五个样式文件、小尺寸素材字节表放在 `scripts/ds/spec/`、Tooltip 的 dark 效果也走浮层一级）。

本轮在地基上的改动：`check-ds-usage.mjs` 中图表代理放宽的规则从「`Note*.vue` 可用全部 `--crown-*`」收窄为「只有 `components/ds/Note.vue` 可用 `--crown-dfc`」；样张总览分组；字体对照页；排版样张的窄屏换行；新增脚本 `samples-matrix.mjs`、`charts-check.mjs`（取自图表代理准备的脚本，改为相对仓库运行、文字相撞阈值 2 px）、`font-measure.mjs`、`existing-pages.mjs`、`no-egress.mjs`。

## 9. Linux 验收操作手册

前提：在服务器的阶段 0 工作树里（不是生产目录）；先读 `docs/memory-engineering-guidelines.md`；不和部署、其他 QA 重叠；每一步都通过包装脚本运行；产物放 `/var/tmp/ds-phase0/`；不连生产库。下文 `$WT` 为工作树里的 `taiko_viewer` 绝对路径，`$BASE_WT` 为回退树（内容等于 `f9b39e6`，见第 6 节的做法，用 `git worktree add --detach` + `git revert --no-commit`，不建分支）。

1. 安装：`cd $WT && npm install`（与部署脚本一致；不要 `npm ci`，见第 8 节）。基线树用同一个 `node_modules`（符号链接）或单独安装。
2. 基线构建：`bash scripts/memory/run_build.sh` 只用于标准部署构建，验收构建用 `bash scripts/memory/run_qa.sh /usr/bin/env bash -c 'cd $BASE_WT && npm run build'`。预期：成功，产出 `.output/server/index.mjs`。然后 `bash scripts/memory/run_qa.sh $(command -v node) $WT/scripts/ds/build-report.mjs --root $BASE_WT --out /var/tmp/ds-phase0/report-baseline.json`。
3. 最终构建：同上，对 `$WT` 运行 `npm run build`（不设 `TAIKO_DS_SAMPLES`），报告写到 `report-final.json`。预期：成功。
4. 构建对比：`node $WT/scripts/ds/build-report.mjs --compare /var/tmp/ds-phase0/report-baseline.json /var/tmp/ds-phase0/report-final.json`。预期：`build comparison: OK`；没有 `/_ds` 路由、manifest 与服务端产物里没有样张标记；预缓存条目只有哈希改名；web manifest 与 `theme-color #eaf6f5` 不变；`viewerPageRoutePatterns` 相同（Linux 上有 Nitro 产物，可以直接读到）；现有路由依赖列表与 CSS 字节不变；入口 CSS 字节不变。记下预缓存条目数与 `globPatterns` 实际收进的文件类型（回答 `23` 2.10）。
5. 测试构建：`TAIKO_DS_SAMPLES=1 npm run build`（在 `run_qa.sh` 下），报告写 `report-samples.json`，`--compare … --expect-samples`。预期：出现 `/_ds` 与 `/ja/_ds` 下 23 个路由；这个构建不能部署。
6. 样张页浏览器检查：用 `bash scripts/memory/run_dev.sh` 起开发服务器（或用第 5 步的测试构建 `node .output/server/index.mjs`，端口避开 3000、4310），环境变量 `TAIKO_DB_HOST=invalid.invalid`、`NODE_OPTIONS=--import $WT/scripts/ds/no-egress.mjs`。然后依次（不并行）：
   - `bash scripts/memory/run_qa.sh $(command -v node) $WT/scripts/ds/browser-check.mjs --base http://127.0.0.1:<port> --browser <chromium 路径> --out /var/tmp/ds-phase0/browser-check`，预期全部通过；
   - `… samples-matrix.mjs --base … --out /var/tmp/ds-phase0/matrix`，预期全部通过；
   - `… charts-check.mjs http://127.0.0.1:<port> /var/tmp/ds-phase0/charts`，预期全部通过；
   - 字体：`… font-measure.mjs --base … --fontsource <已安装的 @fontsource-variable 目录，不在仓库内> --rounds 3 --out /var/tmp/ds-phase0/fonts`。
   浏览器：所有脚本默认用系统 Chrome 渠道；Linux 上设环境变量 `DS_BROWSER=/usr/bin/chromium`（`browser-check.mjs` 也接受 `--browser`）。
7. 现有页面：在同一服务方式下分别起基线树与最终树（一次一个），各采集一次：`… existing-pages.mjs capture --base http://127.0.0.1:<port> --out /var/tmp/ds-phase0/pages-<baseline|final>`；最终树再采一次验证方法稳定；`… existing-pages.mjs compare <baseline> <final>`。预期：全部一致。需要登录的页面：只在测试库可用时加 `--pages <列表文件>`；测试库必须满足 `SELECT DATABASE()` 以 `_test` 结尾，只读，不需要 `TAIKO_ALLOW_TEST_DB_MUTATION`；不复制生产数据；任何生产写入都是阻塞问题。
8. 静态检查与测试：`npm run test:ds`、`npm run check:ds`（可直接运行，不需要浏览器）。
9. 每一步结束：确认开发服务器与浏览器进程退出、端口释放；记录 cgroup 峰值与时长（`run_qa.sh` 的输出）。
10. 结果写回本文：把对应项从「Windows 开发自检」改为「已在 Linux 隔离环境验证」，附命令输出位置。

## 10. 验收清单（`23` §5）

三档：**已在 Linux 隔离环境验证**（目前没有任何一项）· **Windows 开发自检** · **未验证**。

| 项 | 陈述 | 档 | 依据 |
|---|---|---|---|
| 0-A1 | V1.3 Final 已批准 | Windows 开发自检（文档核对） | `22` 批准栏（设计分支 `b4bd45b` 的提交说明「Design V1.3 Final 获批」） |
| 0-A2 | D0-1/2/3/8 开工前有结论 | Windows 开发自检（文档核对） | 2.1 |
| 0-A3 | 字体方案已定、写明首屏预算 | 决策已确认；运行证据仅 Windows 开发自检 | B；首屏 ≤150 KiB、≤12 请求；Linux 运行验证阻塞，首次正式页面集成复验加载及 FOUT |
| 0-B1 | 新代码不引用 Primitive、不写十六进制色 | Windows 开发自检 | `check-ds-usage.mjs` 0 |
| 0-B2 | 新 token 对比度达标 | Windows 开发自检 | 368/368 |
| 0-B3 | 难度、王冠、评价、判定颜色只在领域 token 与对应组件 | Windows 开发自检 | `check-ds-usage.mjs` 0 |
| 0-B4 | 颜色不单独承载信息；`Crown` 可见文字三模式 | Windows 开发自检 | 原子组件浏览器自检；灰度截图未做 |
| 0-B5 | 王冠换算唯一、与现有判断一致 | Windows 开发自检 | `dsUtils` 测试；真实抽样未验证（阶段 2） |
| 0-B6 | Element Plus 从新 token 映射、只在样张页 | Windows 开发自检 | 2.2 |
| 0-B7 | 缺失值统一「—」 | Windows 开发自检 | 原子组件与图表样张 |
| 0-B8 | 品牌色只表交互、音符色只表数据 | Windows 开发自检 | `check-ds-usage.mjs` + 截图 |
| 0-C1 | 素材与正式站逐字节相同 | Windows 开发自检 | `dsAssets` 测试 |
| 0-C2 | 小尺寸素材只缩小、两套格式、无滤镜 | 仅 Windows 开发自检 | `--check`、`check-ds-usage.mjs`；设计负责人已完成看图（见后文），Linux 未验证 |
| 0-C3 | 曲绘失败显示中性占位，屏蔽域名后版面不变 | Windows 开发自检 | 原子组件浏览器自检（屏蔽曲绘域名用例） |
| 0-C4 | 评价 2–8 与 Bot 选图一致 | 未验证 | Bot 源码不在本仓库 |
| 0-C5 | 头像三种状态与服务端默认地址 | Windows 开发自检 | 原子组件浏览器自检 + 测试 |
| 0-C6 | 没有段位徽章与段位数据 | Windows 开发自检 | `check-ds-usage.mjs` |
| 0-C7 | 新代码只用 `icons/diff/`，旧路径保留 | Windows 开发自检 | `check-ds-usage.mjs`、`dsAssets` 测试 |
| 0-C8 | 称号牌面 / 文字形式符合 `04` §7.7 | Windows 开发自检 | 原子组件样张 |
| 0-D1 | ARIA 与 `04` 一致 | Windows 开发自检 | 原子组件与图表浏览器自检 |
| 0-D2 | 触控目标 ≥ 44×44 | Windows 开发自检 | 原子组件浏览器自检（难度页签） |
| 0-D3 | 减少动效下无淡入与动画 | Windows 开发自检 | 图表检查（Lane）与原子组件检查 |
| 0-D4 | 文案来自 locale、中日对应、无规格语言 | Windows 开发自检 | `check-ds-copy.mjs` + 4.8 |
| 0-D5 | 曲名 `lang`、截断带 `title` | Windows 开发自检 | 原子组件浏览器自检（SongCell） |
| 0-D6 | scoped 检查上线、新代码 0、规则写进约定 | Windows 开发自检 | 4、`viewer-ds.md` §4.1 |
| 0-D7 | 浏览器 QA 通过内存隔离脚本运行 | 未验证或阻塞 | Linux runner 准入返回 75（其他 QA 占用维护锁），未启动浏览器，见第 11 节 |
| 0-E1 | 样张页 SSR / 客户端无水合警告与错误、深色首屏不闪 | Windows 开发自检 | 矩阵 457/457（`nuxt dev`） |
| 0-E2 | 样张页按 D0-1 可达，正常构建不可达 | Windows 开发自检 | 第 5 节；生产服务的 404 未在运行中验证 |
| 0-E3 | 预缓存、PWA 清单、`theme-color` 不变 | Windows 开发自检（预缓存不完整） | 第 5 节；7.1 |
| 0-E4 | 现有页面截图与计算样式与基线一致 | Windows 开发自检（18 页） | 4.6 |
| 0-E5 | 现有路由 JS / CSS 依赖与入口 CSS 不变，增量有记录 | Windows 开发自检 | 第 5 节 |
| 0-E6 | 现有页面没有新字体或图片请求 | Windows 开发自检（18 页） | 4.6 |
| 0-E7 | 现有 `test:*` 与 `perf:route-assets` 通过 | 未验证 | 本轮只跑了 `test:version`、`difficultyPresentation`；`perf:route-assets` 读取的清单名已不存在（第 8 节） |
| 0-F1 | 回退演练做过 | Windows 开发自检 | 第 6 节 |
| 0-F2 | 合并与发布得到确认、只用部署脚本 | 未验证或阻塞（未授权） | 本轮明确禁止合并 main 与生产发布 |
| 0-F3 | 上线后正式站抽查无变化 | 未验证 | 尚未发布 |

## 设计负责人复核

复核日期 2026-11-17。复核方式：读本记录全文；在工作树上重跑 `npm run test:ds`（85/85）与 `npm run check:ds`（通过）；核对相对 `origin/main` 被修改的现有文件只有 `nuxt.config.ts`、`package.json`、`locales/zh.json`、`locales/ja.json`，版本号未改；逐张看截图。以下结论与本记录其余部分一样，属于 Windows 开发自检层面，不是验收。

### 结论

- 停止条件没有触发。18 个不依赖数据库的现有页面共 72 个状态与基线一致；正常构建里查不到阶段 0 的路由与代码。在本机能覆盖的范围内，没有发现现有页面有可见变化。
- 这不等于「已保证旧页面没有变化」。需要登录或测试库的页面、生产形态的服务、完整的预缓存清单都还没有在 Linux 隔离环境里验证（7.2）。在第 9 节的手册执行完之前，阶段 0 的状态是「实现完成，待 Linux 验收」，不是「验收通过」。

### 看过的截图

- 图表（`phase0-artifacts/charts/`）：Lane 中文 1440 浅色、日文 390 深色；Radar 中文 390 深色；LineChart 中文 1440 深色；音符与判定条中文 1440 浅色；DrumDial 中文 390 浅色；DensityStrip 中文 1440 浅色；Spark 中文 390 深色。其余组合没有逐张看，依据是 `charts-check.mjs` 的 350 项。
- 原子组件（上一轮）：评价、王冠、称号牌。
- 小尺寸素材（`phase0-artifacts/small-icons/`）：评价 1× 与 2×、王冠 1×。

与冻结的原型对照：谱面带的音符、连打条、每日计数与今天标记，雷达的上期虚线与重点点，折线和 Spark 的品牌色单序列，圆鼓的铆钉圈，判定条的三段配色，都与原型一致。空态、单点、缺失值（「—」）、越界值的样张都有，版面没有破。

### 小尺寸素材（0-C2 的看图部分）

通过。评价 56 px 与王冠 36 px 在浅色、深色底上轮廓和颜色都清楚，WebP 与 PNG 看不出差别，没有滤镜或重新上色的痕迹。评价图在 56 px 时字形细节（粋 / 雅 / 極）已接近辨认下限，所以冻结规则里「评价图旁必须带名称文字」在正式页面上不能省。

### 对验证代理几处判断的裁定

- 雷达文字相撞的判定阈值改为两个方向都超过 2 px：接受。包围盒包含行距，截图上字形没有接触。
- 浏览器检查对消息探针的放宽：接受。只在值恰好等于生产值时放过，其余差异仍然失败。
- `check-ds-usage.mjs` 的规则收窄：接受，这是把放宽的规则改回原意。

### 记下的设计细节（不阻塞阶段 0，在组件第一次进入正式页面的阶段处理）

| 组件 | 现象 | 处理 |
|---|---|---|
| LineChart | x 轴日期标签间隔不均：30 个点时大多隔 2 天，中间有一处隔 3 天（10/31 → 11/3） | 阶段 2 接入 Rating 走势时改为整数步长、末端对齐，并按真实日期范围定标签策略 |
| LineChart | y 轴大数没有千分位（`1500000`），判定条的数字有（`1,234,567`）；最大值约 108 万时上限取到 150 万 | 同上，与分数轴的真实取值范围一起定 |
| Spark | `muted` 与默认色在深色主题下差别很小 | 第一次用到 `muted` 时在真实页面上确认，必要时调整所用的 token |
| DsRank | 56 px 时字形接近辨认下限 | 维持「必须带名称文字」，阶段 2 在成绩列表上复核 |

### 字体（D0-4）

实测支持方案 B：一屏文字上，A 比 B 多 19（中）/ 34（日）个请求和 0.7–1.0 MB 传输，慢速网络下字体替换晚 6–9 秒。建议定稿为 B，并把首屏自托管字体的预算定为传输不超过 150 KiB、请求不超过 12 个（即本次样张页的实测上限），第一个正式页面接入时按实际用到的字重再收紧。此为当时建议；项目负责人随后在本轮 Linux 最终验收指令中正式确认方案 B 与上述预算，0-A3 的决策条件已满足，Linux 运行证据仍未补齐。

### 关于出站请求的补充

- 数据库：本机没有 `.env`，`nuxt.config.ts` 里 `dbHost` 在没有环境变量时为空字符串，机器上没有任何数据库凭据；阶段 0 的全部自检都没有连接生产数据库的条件。
- 其他出站：7.1 最后一条属实，并且同样适用于地基、原子组件两轮自检用的开发服务器（当时还没有 `no-egress.mjs`）。那些运行打开过样张页和少数现有页面，开发服务器可能以匿名访客的方式向正式站的公开只读接口发过请求，没有留下记录。今后本地自检一律加载 `no-egress.mjs`，Linux 手册第 6、7 步已写明。

### 仍然开着的事

7.2 的全部条目；第 8 节的生产观察项（都没有改）；端口 3527 上图表代理遗留的开发服务器进程（PID 21500）与 `viewer-ds-phase0-charts` 工作树的清理，等项目负责人处理。合并 `main` 与发布不在本次授权内。


## 11. Linux 最终验收尝试（2026-11-17，Asia/Shanghai）

### 11.1 结论与授权

**未验证或阻塞：维护锁被其他 QA 占用，停止验收执行。没有任何产品验收项可标为「Linux 隔离验证通过」。** 工程实现认可不等于最终验收通过，也不能证明登录页面和生产形态服务的行为、请求结果未改变。

- 审核目标：`3d9a7b8c7804026a1c52c24a271bcb4d2920a82d`；实施分支 `feature/viewer-ds-phase0`；原始 main：`f9b39e640061663170b103a926f9b5774c4c8916`。
- 独立工作树：`/var/tmp/ds-phase0-linux-final`，从审核目标检出；开始时 `git status --short`、`git diff` 为空。
- 主机：Linux `5.10.0-16-amd64 x86_64`，PID 1 为 systemd；Node 路径为 `/www/server/nvm/versions/node/v24.13.0/bin/node`。有 Linux 入口，但本轮没有可用的隔离执行窗口。
- 已读本记录第 9 节、`AGENTS.md`、`docs/memory-engineering-guidelines.md`。不修改隔离脚本，不使用无隔离服务替代，不抢锁、不停止其他任务。
- 本轮未加载数据库配置、未连接任何数据库、未操作用户数据；未启动应用、浏览器或安装脚本。测试库可用性与 `SELECT DATABASE()` 尚未验证，不能把登录页面标为通过。
- D0-4 正式采用 B；完整自托管 Noto Sans SC / JP 不再引入；首屏自托管字体 ≤150 KiB、≤12 请求。首次正式页面集成必须重新验证加载和 FOUT。
- 本轮只修改验收记录与工程约定，不改产品代码、版本号或历史问题。禁止合并 main、部署生产、阶段 1 页面替换。

### 11.2 准入失败与 main 对照

在实施工作树执行 `bash scripts/memory/run_qa.sh /usr/bin/true`，退出 **75**，唯一输出：

```text
Another bounded QA task is running
```

随后在原始 main 工作目录执行同一准入探针，仍退出 **75**、同一输出。两个版本的 `scripts/memory/run_qa.sh` 和 `qa_vault.py` 无差异。这仅证明**准入阻塞在 main 同样可复现**，不是标准构建失败复现；本轮没有运行任何 `npm run build`，不得推断 schema、Nitro 或其他已知构建问题的 Linux 结果。

18:34（UTC+08:00）只读检查发现其他任务的 `taiko-qa-5134059c70f5.service` 为 `active/running`，18:30:48 启动，主 PID `1757694`，cgroup 为 `/development.slice/development-qa.slice/taiko-qa-5134059c70f5.service`，最长运行时间 15 分钟。本轮未干预该任务。runner 在创建本轮 transient service / QA vault 记录前即拒绝，因此无本轮内存峰值、OOM 事件或工作负载时长；这些数据是 **N/A（未运行）**，不是 0。

### 11.3 分项证据状态

| 第 9 节步骤 / 项目 | 状态 | 本轮结果与证据边界 |
|---|---|---|
| Linux 隔离产品验收通过项 | 无 | 准入失败，不声明任何通过项 |
| 1 安装 | 未验证或阻塞 | 未执行 `npm install`，锁文件未改 |
| 2 原始 main / 回退基线标准构建 | 未验证或阻塞 | 未启动；没有构建日志或 `.output/server/index.mjs` |
| 3 最终标准构建 | 未验证或阻塞 | 未启动；没有构建报告 |
| 4 基线差异、路由依赖与 CSS 字节 | 仅 Windows 开发自检 | 历史第 5 节；Linux 未构建，差异未知，不能写 0 |
| 4 PWA 预缓存 / manifest / theme-color | 仅 Windows 开发自检（不完整） | 历史 3 项预缓存不代表 Linux；文件类型、条目数、样张排除及实际缓存行为未验证 |
| 5 测试构建与样张路由 | 未验证或阻塞 | 未启动 `TAIKO_DS_SAMPLES=1 npm run build` |
| 6 作用域、弹层、浏览器矩阵、图表 | 仅 Windows 开发自检 | 历史 72/72、457/457、350/350；本轮无浏览器结果或截图 |
| 6 字体加载、FOUT、预算 | 仅 Windows 开发自检 | 决策已确认；历史测量不升级为 Linux 实测 |
| 7 公开旧页面截图、样式与请求 | 仅 Windows 开发自检 | 历史 18 页 / 72 状态；Linux 稳定性复采与基线对照未运行 |
| 7 需登录账号页 `/account/*` | 未验证或阻塞 | 没有测试库身份验证、请求或截图证据 |
| 7 社区帖子、发帖、`/forum/me`、通知 | 未验证或阻塞 | 没有测试数据下的行为与请求对照 |
| 7 个人主页 `/my/*` | 未验证或阻塞 | 没有测试身份下的行为与请求对照 |
| 7 后台代表页 `/admin/taiko/*` | 未验证或阻塞 | 没有测试权限下的行为与请求对照 |
| 生产形态 Nitro、正常构建样张 404 | 未验证或阻塞 | 未启动 Nitro；不能用开发服务代替 |
| 8 `test:ds` / `check:ds` 与其他回归 | 仅 Windows 开发自检 | 本轮未执行测试；历史结果保持原等级 |
| 回退演练与重建、重启后对照 | 仅 Windows 开发自检 | 本轮未创建回退树；历史第 6 节不能代替 Linux 回退验证 |
| 9 内存峰值、时长、OOM | 未验证或阻塞 | 本轮 workload 未启动，N/A；不引用其他任务数据 |
| main 合并、生产发布、线上抽查 | 未验证或阻塞（未授权） | 本轮未执行 |

证据目录：`/var/tmp/ds-phase0/linux-final-20261117/`。`admission.log` 与 `admission-main.log` 为原始拒绝日志；`other-qa-status.txt` 为不含命令参数或环境变量的其他任务状态；`legacy-listener.txt`、`legacy-pid.txt`、`worktrees-before-cleanup.txt` 为清理前检查。构建日志、浏览器报告、PWA 报告与内存报告均未生成，原因如上。小型准入证据副本见 `linux-final-20261117/admission.txt`（随文提交）；不提交日志目录、大型产物或生产数据。

### 11.4 已知旧问题单独登记

| 问题 | 本轮处理与 main 复现状态 |
|---|---|
| npm 锁文件不一致 | 不修；Linux 安装未运行，main 的 Linux 复现未验证 |
| Keepalive + Teleport 异常 | 不纳入阶段 0 修复；**阶段 1 替换导航框架前必须完成针对性修复和回归**；Linux/main 运行复现未验证 |
| 设置页面水合问题 | 不修；历史 Windows 观察，Linux/main 未验证 |
| chart-ugc 深色 CSS | 不修；保留第 8 节记录，Linux 页面行为未验证 |
| route-assets 不兼容当前 Nuxt 产物 | 不修；Linux 产物未生成，未运行 main 对照 |
| 构建结果中的绝对路径 | 不修；Linux 构建未运行，不能确认路径差异大小 |
| 外部 Annual schema、Windows Nitro 失败 | 保留第 7/8 节历史记录；未绕过标准构建，Linux/main 未验证 |

恢复验收需要空闲的仓库隔离 runner 窗口；从第 9 节步骤 1 开始，先做原始 main 标准构建，再做最终构建。标准构建如失败，应先报告具体失败及原始 main 复现证据，不跳过检查或扩大修复范围。登录页还需仅含测试数据的测试库，以及实际 `SELECT DATABASE()` 以 `_test` 结尾的只读证明；任何测试数据写入必须先满足仓库显式 mutation opt-in 要求。

### 11.5 清理与交付

本轮没有启动开发服务器、Nitro 或浏览器，故无本轮服务需停止。历史 Windows PID `21500` 在当前 Linux 主机不存在，端口 `3527` 无监听；当前 Git 工作树列表不存在 `viewer-ds-phase0-charts`。这不能证明 Windows 主机上的进程或工作树已清理；不对同号 PID、其他任务工作树或服务执行删除/终止。

验收文档提交并推送实施分支后，核对本轮工作树无未提交改动、无进程使用，再以非强制 `git worktree remove` 清理本轮工作树；证据目录保留供最终审查。主工作树已有的关系数据生成时间更新、`docs/random-dan/` 与 `scripts/dojo/` 保留原样。
