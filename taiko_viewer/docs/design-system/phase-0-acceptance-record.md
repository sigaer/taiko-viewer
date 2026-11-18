# 阶段 0 验收记录（Design System V1.3 落地生产代码）

> 当前结论：**Schema 前置已解阻；Linux 单元与静态检查通过；最终运行验收仍阻塞，未通过。** 本轮复用 CI 固定提交的 Schema，完整性和两边类型检查通过；原始 main 与阶段 0 的标准构建随后均在 1536 MiB Node 堆限制下于 SSR 转换阶段耗尽堆，未生成 Nitro 入口，详见第 13 节。第 11–12 节保留历史尝试，第 10 节列当前分项状态。D0-4 为正式方案 B。仍未授权合并 main、生产发布或阶段 1 正式页面替换。

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

- Linux 最终运行验收仍未完成。第 13 节确认 Schema 解阻、85/85 单元测试与静态检查通过；当前构建阻塞为两树在 QA 堆限额下的 SSR 堆耗尽，浏览器 QA 未启动（`23` 0-D7）。
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

## 10. 验收清单（`23` §5；截至第 13 节的历史状态）

当前状态以第 14.6 节为准。以下保留 Schema/1536 MiB 构建阻塞时的记录。

三档：**Linux 隔离验证通过** · **仅 Windows 开发自检** · **未验证或阻塞**。本轮新增 Linux 单元与静态检查证据（第 13 节）；浏览器、PWA 与生产形态服务结果不得随之升级。

| 项 | 陈述 | 档 | 依据 |
|---|---|---|---|
| 0-A1 | V1.3 Final 已批准 | Windows 开发自检（文档核对） | `22` 批准栏（设计分支 `b4bd45b` 的提交说明「Design V1.3 Final 获批」） |
| 0-A2 | D0-1/2/3/8 开工前有结论 | Windows 开发自检（文档核对） | 2.1 |
| 0-A3 | 字体方案已定、写明首屏预算 | 决策已确认；运行证据仅 Windows 开发自检 | B；首屏 ≤150 KiB、≤12 请求；Linux 运行验证阻塞，首次正式页面集成复验加载及 FOUT |
| 0-B1 | 新代码不引用 Primitive、不写十六进制色 | Linux 隔离验证通过（静态） | `check-ds-usage.mjs` 0；本轮 `test:ds` / `check:ds`，见 13.4 |
| 0-B2 | 新 token 对比度达标 | Linux 隔离验证通过（静态） | 368/368；本轮 `test:ds` / `check:ds`，见 13.4 |
| 0-B3 | 难度、王冠、评价、判定颜色只在领域 token 与对应组件 | Linux 隔离验证通过（静态） | `check-ds-usage.mjs` 0；本轮 `test:ds` / `check:ds`，见 13.4 |
| 0-B4 | 颜色不单独承载信息；`Crown` 可见文字三模式 | Windows 开发自检 | 原子组件浏览器自检；灰度截图未做 |
| 0-B5 | 王冠换算唯一、与现有判断一致 | Linux 隔离验证通过（单元） | `dsUtils` 测试通过；真实成绩抽样仍未验证（阶段 2），见 13.4 |
| 0-B6 | Element Plus 从新 token 映射、只在样张页 | Windows 开发自检 | 2.2 |
| 0-B7 | 缺失值统一「—」 | Windows 开发自检 | 原子组件与图表样张 |
| 0-B8 | 品牌色只表交互、音符色只表数据 | Linux 静态检查通过；视觉 / 人工证据仍为 Windows | `check-ds-usage.mjs` + 截图；本轮静态证据见 13.4 |
| 0-C1 | 素材与正式站逐字节相同 | Linux 隔离验证通过（文件校验） | `dsAssets`：30 个原图的大小 / MD5 对照冻结 main 清单；未访问线上素材，见 13.4 |
| 0-C2 | 小尺寸素材只缩小、两套格式、无滤镜 | Linux 隔离验证通过（生成与静态检查） | 46 文件与重新渲染字节一致、原图未变；人工看图仍为历史 Windows 复核，见 13.4 |
| 0-C3 | 曲绘失败显示中性占位，屏蔽域名后版面不变 | Windows 开发自检 | 原子组件浏览器自检（屏蔽曲绘域名用例） |
| 0-C4 | 评价 2–8 与 Bot 选图一致 | 未验证 | Bot 源码不在本仓库 |
| 0-C5 | 头像三种状态与服务端默认地址 | Windows 开发自检 | 原子组件浏览器自检 + 测试 |
| 0-C6 | 没有段位徽章与段位数据 | Linux 隔离验证通过（静态） | `check-ds-usage.mjs`；本轮 `test:ds` / `check:ds`，见 13.4 |
| 0-C7 | 新代码只用 `icons/diff/`，旧路径保留 | Linux 隔离验证通过（静态） | `check-ds-usage.mjs`、`dsAssets` 测试；本轮 `test:ds` / `check:ds`，见 13.4 |
| 0-C8 | 称号牌面 / 文字形式符合 `04` §7.7 | Windows 开发自检 | 原子组件样张 |
| 0-D1 | ARIA 与 `04` 一致 | Windows 开发自检 | 原子组件与图表浏览器自检 |
| 0-D2 | 触控目标 ≥ 44×44 | Windows 开发自检 | 原子组件浏览器自检（难度页签） |
| 0-D3 | 减少动效下无淡入与动画 | Windows 开发自检 | 图表检查（Lane）与原子组件检查 |
| 0-D4 | 文案来自 locale、中日对应、无规格语言 | Linux 静态检查通过；视觉 / 人工证据仍为 Windows | `check-ds-copy.mjs` + 4.8；本轮静态证据见 13.4 |
| 0-D5 | 曲名 `lang`、截断带 `title` | Windows 开发自检 | 原子组件浏览器自检（SongCell） |
| 0-D6 | scoped 检查上线、新代码 0、规则写进约定 | Linux 隔离验证通过（静态） | 4、`viewer-ds.md` §4.1；本轮 `test:ds` / `check:ds`，见 13.4 |
| 0-D7 | 浏览器 QA 通过内存隔离脚本运行 | 未验证或阻塞 | Schema 已解阻，但两树标准构建均 SSR 堆耗尽；未启动浏览器，见第 13 节 |
| 0-E1 | 样张页 SSR / 客户端无水合警告与错误、深色首屏不闪 | Windows 开发自检 | 矩阵 457/457（`nuxt dev`） |
| 0-E2 | 样张页按 D0-1 可达，正常构建不可达 | Windows 开发自检 | 第 5 节；生产服务的 404 未在运行中验证 |
| 0-E3 | 预缓存、PWA 清单、`theme-color` 不变 | Windows 开发自检（预缓存不完整） | 第 5 节；7.1 |
| 0-E4 | 现有页面截图与计算样式与基线一致 | Windows 开发自检（18 页） | 4.6 |
| 0-E5 | 现有路由 JS / CSS 依赖与入口 CSS 不变，增量有记录 | Windows 开发自检 | 第 5 节 |
| 0-E6 | 现有页面没有新字体或图片请求 | Windows 开发自检（18 页） | 4.6 |
| 0-E7 | 现有 `test:*` 与 `perf:route-assets` 通过 | 未验证 | 本轮 `test:ds` 85/85、`check:ds` 通过；其他 test:* 未全跑，route-assets 旧问题未改，不能整体判为通过 |
| 0-F1 | 回退演练做过 | 仅 Windows 开发自检（运行部分） | 第 6 节；Linux 源码回退与 main tree 相同，但重建失败，运行回退仍阻塞（12.2） |
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


## 11. Linux 最终验收首次尝试（2026-11-17，Asia/Shanghai；历史记录）

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


## 12. Linux 最终验收重试（2026-11-17，Asia/Shanghai；Schema 解阻前的历史记录）

### 12.1 当前结论

**未验证或阻塞：标准构建缺少仓库外的 Annual schema，原始 main 和阶段 0 均可复现。最终验收未通过。** 隔离入口现已可用，不能继续把首次维护锁占用当作当前阻塞；本次没有任何产品运行验收项升级为通过。

实施工作树 `/var/tmp/ds-phase0-linux-retry` 从 `4679ad00` 检出（相对审核目标 `3d9a7b8c` 仅有上一轮文档记录），开始时状态与 diff 均为空。回退基线工作树为 `/var/tmp/ds-phase0-linux-basis`。两者均为独立工作树，主工作树已有改动未动。系统仍为 Linux 5.10.0-16-amd64，Node 24.13.0。

所有安装和构建均经过 `scripts/memory/run_qa.sh`，使用 `development.slice/development-qa.slice`、MemoryHigh 2 GiB / MemoryMax 3 GiB、SwapMax 256 MiB、15 分钟上限。未加载 `.env` 或测试/生产库凭据，未连接数据库、未操作用户数据。构建设置两个数据库 host 为 `invalid.invalid` 并加载 `no-egress.mjs`；未启动应用服务。没有执行合并、发布、阶段 1 替换、旧问题修复或版本升级。

D0-4 保持正式方案 B：中日文系统字体，按需自托管 Barlow / Barlow Condensed；首屏 ≤150 KiB、≤12 请求；不引入完整自托管 Noto Sans SC / JP。正式页面首次集成时复验字体加载与 FOUT，本轮未取得 Linux 字体运行证据。

### 12.2 标准构建失败与原始 main 对照

按第 9 节先建立回退树：在审核目标的 detached worktree 依次 `git revert --no-commit 3d9a7b8c`、`git revert --no-commit -m 1 460d5fa4`、`git revert --no-commit e9335faf`、`git revert --no-commit ca157761`、`git revert --no-commit 38f70c4d`。临时 detached 提交为 `97ad21a09d7b7d950d3a9f08de7e03b14adc9963`；其 tree 与原始 main `f9b39e6` 都是 `ef30c8af458f52fd5f3978201900ee27e3b4d949`，`git diff f9b39e6` 为空。**这只证明源码回退一致，不是运行回退通过。**

依赖使用 `npm install --no-save --no-audit --no-fund`（读取现有锁文件，不保存依赖或锁文件改动），成功安装 1189 个包，`nuxt prepare` 成功。基线按手册复用实施树的 `node_modules` 符号链接；两树 `package.json` / `package-lock.json` 未改。

标准命令为 `npm run build`，没有用 `npx nuxt build` 跳过检查。执行入口与日志均保存在 `/var/tmp/ds-phase0/linux-retry-20261117/`：

```sh
bash scripts/memory/run_qa.sh /usr/bin/python3 /var/tmp/ds-phase0/linux-retry-20261117/build-probe.py build-baseline /var/tmp/ds-phase0-linux-basis/taiko_viewer
bash scripts/memory/run_qa.sh /usr/bin/python3 /var/tmp/ds-phase0/linux-retry-20261117/build-probe.py build-final /var/tmp/ds-phase0-linux-retry/taiko_viewer
```

`build-probe.py` 只负责环境隔离参数、调用原始 npm 命令、日志和资源采样，不修改源码或构建步骤。

两树均通过 `prebuild` 的 TJA pinned source 校验，随后在同一行失败并退出 1：

```text
> node ./scripts/generate_annual_types.mjs --check && nuxt build
Error: ENOENT: no such file or directory, open '/var/schemas/annual-summary-v4.schema.json'
.../scripts/generate_annual_types.mjs:16:27
```

脚本还尝试 `/var/tmp/schemas/annual-summary-v4.schema.json`，该位置也不存在。`generate_annual_types.mjs`、隔离 runner 和 vault 在原始 main 与阶段 0 无差异。基线额外出现 `.nuxt/tsconfig.json` 不存在的 prebuild 警告（复用依赖但未单独 prepare），没有阻断 TJA 步骤；最终树已 prepare，仍出现相同 schema 致命错误。因此可确认此独立工作树环境的标准构建前置问题在原始 main 同样存在，不能归因于阶段 0，也不能据此声称其他 Linux 构建步骤通过。

依用户要求，在确认对照后停止后续运行验收。没有补造 schema、从生产复制文件、修改脚本、绕过检查或扩大修复范围。恢复前需要明确可用于隔离构建的正式 schema 来源和布置方式，再重新从标准构建开始。

### 12.3 资源与证据

| 任务 | 隔离 run | 退出码 | 工作负载秒数 | cgroup 采样峰值 MiB | 进程树 RSS 合计采样峰值 MiB | OS child max RSS MiB |
|---|---|---:|---:|---:|---:|---:|
| 读取锁文件的依赖安装 | `qa-c5b3281a29d2` | 0 | 38.105 | 1630.78 | 1305.38 | 952.55 |
| 原始 main / 回退树标准构建 | `qa-f948800b9aeb` | 1 | 0.472 | 70.60 | 169.33 | 66.09 |
| 阶段 0 标准构建 | `qa-0faefd8a0520` | 1 | 0.452 | 69.35 | 172.15 | 65.69 |

以上每 20 ms 读取 cgroup `memory.current` 和进程 RSS；采样可能漏掉瞬时峰值，OS 数字来自 `getrusage(RUSAGE_CHILDREN).ru_maxrss`，不是进程树总量。RSS 合计会重复计算共享页；既有共享页的 cgroup 归属也可能不同，两列不直接比较。三项 `memory.events` 的 high/max/oom/oom_kill 最后观测值均为 0。构建数值仅覆盖失败前的短暂 prebuild / schema 检查，**不是完整 Nuxt 构建内存峰值**。runner manifest 确认子进程清理，三个 unit 已 inactive、ControlGroup 为空。

完整证据目录：`/var/tmp/ds-phase0/linux-retry-20261117/`。

- `build-baseline.log` / `build-final.log`：标准构建完整输出；对应 `*-runner.log` 含隔离 run 和指标。
- `install-locked.log`、`install-locked-runner.log`、三个 `*-metrics.json`：有效安装和构建资源记录。
- `build-probe.py`：本次受控执行和采样脚本。
- 持久 runner 证据：`/home/sigaer/taiko/qa-vault/runs/<run>/evidence/manifest.json` 与 `output.log`。
- 随文提交的小型 [retry-summary.json](linux-final-20261117/retry-summary.json) 包含指标、证据路径和 SHA-256；不提交 node_modules、构建输出或日志目录。

另有两次执行准备错误，明确排除出验收：初次安装错误使用 `--package-lock=false`，发现会忽略锁文件后用 vault 的 owner-abort 正式停止（`qa-288acc463347`，原因 `INSTALL_LOCKFILE_POLICY_CORRECTION`，退出 125）；其记录保留于 `install.log` / `install-memory.json`，不得当作依赖安装通过。随后尝试调用主机不存在的 `/usr/bin/time`（`qa-e52db850feb0`，退出 127，npm 未启动）；改用 Python 资源采样后才得到表中有效结果。没有把重跑或主动停止伪记为通过。

### 12.4 分项验收状态

| 项目 | 状态 | 当前证据与限制 |
|---|---|---|
| 隔离入口、依赖安装（前置） | Linux 隔离验证通过 | 真正启动受限 cgroup；有效安装退出 0，锁文件不变；不代表产品通过 |
| 原始 main / 阶段 0 标准构建 | 未验证或阻塞 | 两树均退出 1；缺外部 schema；尚未执行 Nuxt/Nitro build |
| 正常产物路由、依赖/CSS/体积差异 | 仅 Windows 开发自检 | 本次无产物可比，Linux 差异未知，不能写成 0 |
| 测试构建 | 未验证或阻塞 | 未运行 `TAIKO_DS_SAMPLES=1 npm run build` |
| 样张浏览器矩阵、弹层、SSR、水合、图表 | 仅 Windows 开发自检 | 本次没有启动浏览器，无 Linux 结果或截图 |
| 字体加载、预算、FOUT | 仅 Windows 开发自检 | 方案已正式确认；Linux 运行验证未完成 |
| 公开旧页可见行为、截图、请求对照 | 仅 Windows 开发自检 | 历史 18 页 / 72 状态；本次未复采 |
| 登录账号页、社区帖子与通知、个人主页、后台代表页 | 未验证或阻塞 | 未连接测试库，未执行 `SELECT DATABASE()`，未取得认证状态下的行为或响应对照；不能宣称与 main 一致 |
| 生产形态 Nitro、正常产物样张 404 | 未验证或阻塞 | 没有 `.output/server/index.mjs` 或生产形态服务 |
| PWA 预缓存、manifest、theme-color | 仅 Windows 开发自检（不完整） | 历史三项预缓存不升级；Linux 文件类型、条目数、缓存行为与样张排除未验证 |
| `test:ds`、`check:ds` 和其他回归 | 仅 Windows 开发自检 | 本次标准构建阻塞后未继续运行 |
| 回退源码与运行 | 未验证或阻塞（运行部分） | Linux 源码 tree 与 main 一致；重建失败，运行回退仍仅有 Windows 开发自检 |
| 完整构建 / 浏览器内存峰值 | 未验证或阻塞 | 只记录到安装及失败前置步骤；完整构建、浏览器 N/A |
| 合并 main、生产部署、阶段 1 | 未验证或阻塞（未授权） | 未执行 |

本轮无法证明阶段 0 没有改变全部旧站页面的可见行为和请求结果。第 8 节与 11.4 的旧问题继续单独登记：npm 锁文件、Keepalive + Teleport、设置水合、chart-ugc 深色 CSS、route-assets、公开产物中的绝对路径均未修复、未补充 Linux 运行结论。**Keepalive + Teleport 仍必须在阶段 1 替换导航框架前完成针对性修复与回归。** 外部 schema 缺失现在已有 Linux/main 对照证据，Windows Nitro 失败仍未在 Linux 重现或排除。

### 12.5 收尾

本次没有启动开发服务器、Nitro 或浏览器；已核对隔离任务退出。Linux 上没有历史 Windows PID `21500`、端口 `3527` 监听或图表工作树，不能据此断言 Windows 端已经清理。

清理前检查未提交内容与其他进程引用。回退树与原始 main 无差异、无其他进程引用，已用非强制 `git worktree remove` 删除 `/var/tmp/ds-phase0-linux-basis`。实施树暂保留：宿主 `YDService`（PID 3926598，`/usr/local/qcloud/YunJing/YDEyes/YDService`）仍打开本轮 `node_modules` 下 5230 个文件；未停止该服务、未强制删除其仍在读取的目录。这是清理保留项，不是验收通过条件。待引用释放并确认工作树已提交且无其他任务使用后，再非强制移除 `/var/tmp/ds-phase0-linux-retry`。检查依据为 `cleanup-process-check.json`、`cleanup-fd-check.json`；大型依赖未提交。

文档与小型证据提交到 `feature/viewer-ds-phase0` 并推送，停止等待最终审查；原始 main、主工作树已有改动、版本与生产服务均保持原状。


## 13. 恢复 CI Schema 前置与 Linux 隔离复验（2026-11-17，Asia/Shanghai）

### 13.1 结论与范围

**外部 Schema 缺失已解决，不再是当前阻塞。** 用户批准的环境修复完成；未改年度报告算法、生成器、已跟踪类型、业务代码、生产 Schema、内存包装脚本或版本。没有合并 main、部署或阶段 1 工作。

**当前阻塞是标准构建的 Node 堆预算：原始 main 与阶段 0 都完成客户端构建，但在 SSR 转换阶段触及 runner 的 1536 MiB 堆上限，未生成 Nitro 服务入口。** 本次失败在原始 main 同样可复现，不能单独归因于阶段 0；也不能由此证明阶段 0 的全部运行行为没有回归。Linux `test:ds` 85/85 与 `check:ds` 已通过，最终运行验收仍未通过。

### 13.2 Schema 来源、目录与完整性

复用 `.github/workflows/developer-api-batch1.yml` 的现有来源，通过 GitHub 文件工具按**完整固定提交**读取原始字节（base64 解码），没有使用浮动分支：

| 项 | 值 |
|---|---|
| 仓库 | `sigaer/taiko-bot` |
| 提交 | `a632913dfbdbec1d465f8eaccc0bb80c35e25745` |
| 文件 | `taiko_bot/offline/schemas/annual-summary-v4.schema.json` |
| 非空大小 | 17,171 B |
| Git Blob SHA（实际计算，与要求一致） | `d1661791fc49f9a2ddfc86da61621139359fcce3` |
| SHA-256 | `a8ecc11504f4f59c9460e2ca72ac8e330d1aa182df0f7d18936e377fedf33ad1` |
| JSON 解析 | 通过 |

本轮专用 `QA_ROOT=/var/tmp/ds-phase0-schema-20261117`：

```text
<QA_ROOT>/baseline/checkout/     原始 main f9b39e640061663170b103a926f9b5774c4c8916
<QA_ROOT>/final/checkout/        审核后的实施提交 5cf9023ef3ff3cf5b938a2366acfdb70207afaaf
<QA_ROOT>/schemas/annual-summary-v4.schema.json
<QA_ROOT>/evidence/
```

从两边的 `taiko_viewer/` 计算 `../../../schemas/annual-summary-v4.schema.json`，`realpath` 均指向上述同一个文件；核对 device/inode 均为 `65025/386409`。`verify-schema.py` 在隔离 runner 中验证 Git blob（`SHA1("blob " + byteLength + NUL + bytes)`）、JSON、路径和同文件身份，然后逐一运行未经修改的 `node scripts/generate_annual_types.mjs --check`，**两边均退出 0**。类型文件运行前后的 SHA-256 均为 `565f4a5a74faddf169179a961bf21674bf71ec0b18caaf89b71bbc4c4ca7dd61`，没有重新生成或覆盖。

没有创建 `/var/schemas`（收尾确认该目录不存在），没有写生产目录或移动正式服务文件。Schema 和 QA 执行辅助脚本仅留在本轮 QA_ROOT，提交内容只有验收记录与小型证据。

### 13.3 标准构建与 main 对照

所有执行均通过仓库 `scripts/memory/run_qa.sh`，串行进行，没有与本任务其他 QA/构建重叠。依赖按第 9 节的 npm install 路径执行 `npm install --no-save --no-audit --no-fund`；锁文件不变。baseline 在本轮 QA_ROOT 内以符号链接复用 final 的 `node_modules`，因此两边依赖相同，没有引用生产输出或上一轮依赖目录。

实际标准构建命令始终是 `npm run build`，保留 `prebuild` 与 `generate_annual_types.mjs --check`；没有直接运行 `npx nuxt build`。可复现入口：

```sh
bash scripts/memory/run_qa.sh /usr/bin/python3 <QA_ROOT>/run-task.py build-baseline baseline npm run build
bash scripts/memory/run_qa.sh /usr/bin/python3 <QA_ROOT>/run-task.py build-final final npm run build
```

`run-task.py` 仅调用指定命令并采样资源；所有构建与检查设置 `TAIKO_DB_HOST=invalid.invalid`、`METHOD_CALLS_DB_HOST=invalid.invalid`，不加载数据库配置。QA 网络 preload 禁止数据库 socket、非 QA 回环端口及外部出站；只允许预留 QA HTTP 端口 35251/35252，本次未启动服务。日志记录拦截了 Nuxt telemetry。安装阶段仅执行依赖安装，没有连接应用或用户数据库。

两树的 TJA pinned source prebuild、Schema 检查、客户端 Vite 构建均成功；随后均在 `Building server...` / `transforming...` 后报同一错误：

```text
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
```

构建子进程退出为 **SIGABRT（Python returncode -6）**；采样辅助脚本将该负值传给退出码后，runner 的退出码为 **250**，不代表成功或 schema 错误。两边 `.output/server/index.mjs` 均不存在，SSR 构建未完成，未到可运行 Nitro 产物阶段。客户端成功只是一项中间结果，未将不完整目录当作生产构建或正式 PWA 证据。

同一 CI 文件为构建设置 `NODE_OPTIONS=--max-old-space-size=4096`，本仓库 QA runner 则固定为 `1536`，cgroup High/Max 为 2/3 GiB。这是本轮实际存在的预算差异。依据 `docs/memory-engineering-guidelines.md` 中 “Heavier work needs a recorded peak and a separately budgeted scope. Never increase limits just to make a test pass.”，本轮没有修改或绕过限额。后续需在独立评估、明确预算的隔离构建范围中重跑标准构建；不能直接把 CI 的 4096 MiB 堆参数塞进现有 3 GiB cgroup，也不能把本次失败峰值视为完整构建所需峰值。

### 13.4 Linux 单元与静态检查

构建失败对照完成后，串行执行了不依赖 Nitro 服务的原有检查；没有新增或修改产品实现来使检查通过：

| 检查 | 状态 | 实际结果 |
|---|---|---|
| `npm run test:ds` | Linux 隔离验证通过 | 85/85，0 失败，0 跳过 |
| `npm run check:ds` | Linux 隔离验证通过 | 总入口退出 0 |
| token 冻结快照 | Linux 隔离验证通过 | 本次默认命令比较 2352 个解析值；没有运行历史额外 `--prototype` 对照，不能把该数量写成 4704 |
| 同名 token | Linux 隔离验证通过 | 12 处读取均在本地定义，不受新 token 影响 |
| 对比度 | Linux 隔离验证通过 | 368/368 |
| token mapping、scoped | Linux 隔离验证通过（新 DS 范围） | mapping 当前；DS 0 处错误；旧 chart-ugc 5 处仍仅报告 |
| 用法与文案 | Linux 隔离验证通过（静态） | 54 个文件 / 0 findings；51 个文件 / 中日各 75 个键 |
| 素材完整性与可重现生成 | Linux 隔离验证通过 | 30 个原图大小和 MD5 对照冻结 main 清单；46 个小图与 fresh render 一致，原图未改 |

这些证据不能代替浏览器的视觉、Teleport、焦点、SSR 水合或交互检查。D0-4 继续为系统中日文字体 + 按需自托管 Barlow / Barlow Condensed，≤150 KiB、≤12 请求，正式页面首次集成复验加载与 FOUT；本轮没有新增字体或做 Linux 字体实测。

### 13.5 资源、产物与证据位置

| 任务 | run ID | 结果 | 时长秒 | cgroup 采样峰值 MiB | 进程树 RSS 合计采样峰值 MiB | OS child max RSS MiB |
|---|---|---|---:|---:|---:|---:|
| Schema 完整性 / 两树类型检查 | `qa-04289dc56bba` | 0 | 见 vault manifest | N/A（该轻量检查未单独采样） | N/A | N/A |
| 依赖安装 | `qa-9b691cfca5ed` | 0 | 38.607 | 1650.55 | 1365.66 | 990.50 |
| main 标准构建 | `qa-c9b8e64c4e40` | SIGABRT | 88.440 | 1911.59 | 1912.54 | 1808.91 |
| final 标准构建 | `qa-5514ea271f82` | SIGABRT | 96.865 | 1935.82 | 1933.31 | 1831.72 |
| `test:ds` | `qa-d94f0b0fd4b8` | 0 | 7.044 | 260.21 | 387.71 | 254.36 |
| `check:ds` | `qa-df1763a8da52` | 0 | 3.415 | 192.57 | 287.05 | 209.80 |

采样间隔 200 ms，可能漏瞬时峰值；OS 数字来自 `getrusage(RUSAGE_CHILDREN).ru_maxrss`，不是整个进程树总和。RSS 合计重复计算共享页，不能与 cgroup 列直接相减推断泄漏。以上五个采样任务的 `memory.events` high/max/oom/oom_kill 最后观测值均为 0；**V8 堆耗尽确实发生，不等于 cgroup OOM kill**。构建失败前峰值不代表完整 Nuxt/Nitro 构建峰值。已关闭 core dump，未产生堆转储。

完整证据在 `<QA_ROOT>/evidence/`：

- `schema-source.json`、`schema-verification.json`、`schema-runner.log`：固定来源、字节校验、两边类型文件不变与退出码。
- `build-baseline.log`、`build-final.log`：未经删改的完整构建输出；对应 `*-metrics.json` / `*-runner.log` 为资源与隔离记录。
- `install-final.log`、`test-ds.log`、`check-ds.log` 及对应 metrics / runner 文件。
- `<QA_ROOT>/verify-schema.py`、`run-task.py`、`network-guard.mjs`：环境检查与受控执行辅助脚本，不是产品代码。
- 持久证据 `/home/sigaer/taiko/qa-vault/runs/<run ID>/evidence/{manifest.json,output.log}`。
- 随文小型 [schema-unblock-summary.json](linux-final-20261117/schema-unblock-summary.json)：源身份、真实结果、资源与证据 SHA-256。

### 13.6 真正剩余的验收项与收尾

| 项目 | 当前状态 | 原因与证据边界 |
|---|---|---|
| Schema 来源、路径、类型检查 | Linux 隔离验证通过 | 本轮已解决；不再以 Schema 为由停止 |
| 标准构建与 Nitro | 未验证或阻塞 | 两树相同的 SSR 堆耗尽；没有 Nitro 入口 |
| 测试构建、正常 / 测试产物对照、样张路由隔离 | 未验证或阻塞 | 标准构建尚未通过，未执行测试构建，不能使用不完整客户端产物代替 |
| SSR/i18n、Teleport/Token 作用域、组件及图表浏览器矩阵 | 仅 Windows 开发自检 | Linux 未启动服务或浏览器；历史结果不升级 |
| 公开旧页截图、样式、请求与稳定性复采 | 仅 Windows 开发自检 | 本轮无生产形态页面对照；差异未知，不能写成 0 |
| 登录账号、帖子与通知、个人主页、后台代表页 | 未验证或阻塞 | 服务构建未完成；未加载测试库配置或运行 `SELECT DATABASE()`，无真实认证请求证据 |
| PWA 预缓存、manifest、theme-color | 仅 Windows 开发自检（历史不完整） | Linux 没有完整产物或运行证据，条目数/类型/缓存行为未验证 |
| 字体加载、FOUT、首屏预算 | 仅 Windows 开发自检 | 决策已定，Linux 测量待运行环境 |
| 资源文件与 token 等静态检查 | Linux 隔离验证通过 | 范围仅 13.4，不扩大到页面表现 |
| 隔离环境运行回退 | 未验证或阻塞 | 原始 main 的重建同样失败；历史源码回退一致性不能代替运行回退 |

既有 npm 锁文件、Keepalive/Teleport、设置水合、chart-ugc、route-assets 和公开产物绝对路径问题继续单独登记，没有修复或扩大范围；Keepalive + Teleport 仍必须在阶段 1 替换导航框架前完成针对性修复和回归。

六个隔离 unit 均已 inactive、ControlGroup 为空，预留端口 35251/35252 无监听；没有启动开发服务器、Nitro 或浏览器，没有生产数据库访问/写入。两树构建结束后 Git 状态均干净，业务代码、类型文件、包版本和锁文件无变化。

清理前扫描进程 cwd/exe、参数/环境路径、maps 和打开文件，只保存匹配摘要，不输出环境内容；检查无权限错误。上一轮 `/var/tmp/ds-phase0-linux-retry` 已无引用且无未提交内容，已非强制删除；本轮 baseline 亦已非强制删除。final 的依赖仍被宿主 `YDService`（PID 3926598，检查时 1838 个文件）读取，保留 `<QA_ROOT>/final/checkout` 和证据；没有停止该服务、移动其文件或强制清理。实施分支已切换到本轮 final 工作树，后续文档提交推送后停止等待审查。


## 14. Infrastructure V2 后的 Linux 验收恢复（2026-11-17–18）

本节更新当前状态；第 11–13 节保留当时失败事实。基础设施与 Annual 退役在独立
`feature/viewer-engineering-infrastructure-v2` 分支，本设计系统分支只补验收记录，
没有合并基础设施、退役、阶段 1 页面替换，也没有部署。

### 14.1 隔离、身份与标准构建

专用根 `/var/tmp/viewer-task-build-recovery-20261117`，两树分别为
`baseline/checkout`（原始 main `f9b39e640061663170b103a926f9b5774c4c8916`）与
`final/checkout`（Phase 0 `c2510fd0a0e83e08518af3e4cf1cd085af79e9d6`）。
依赖同源，固定 Schema 位于该根 `schemas/annual-summary-v4.schema.json`，
来源 commit `a632913dfbdbec1d465f8eaccc0bb80c35e25745`，blob
`d1661791fc49f9a2ddfc86da61621139359fcce3`，17171 bytes；两边解析与标准命令
的 `generate_annual_types.mjs --check` 均通过，没有覆盖跟踪类型。

使用 V2 候选 `scripts/memory/run_build.sh`，独立网络 namespace，串行执行
未经替换的 `npm run build`；Node heap 4096 MiB，development-build.slice
High/Max 4/5 GiB，保留父级 development.slice 6/8 GiB。没有部署切换或重启。
禁用 core dump，显式测试配置，无生产 DB/外网连接。所有 OOM/high/max 事件为 0。

| 构建 | Run | 秒 | 采样 cgroup 峰值 MiB | 进程树 RSS 峰值 KiB | Nitro |
| --- | --- | ---: | ---: | ---: | --- |
| main | qa-d9a1150668ba | 166.499 | 4074.30 | 4141112 | 64.7 MB，成功 |
| Phase 0 正常 | qa-7303a32507fb | 169.639 | 4071.97 | 4171600 | 64.7 MB，成功 |
| Phase 0 样张 | qa-24652456955f | 179.035 | 4074.22 | 4193140 | 成功 |

峰值是周期采样值，不能当作硬件级瞬时峰值；完整 runner cgroup 记录另存 Vault。
原先 1536 MiB heap 的共享 SSR 失败不再是本轮阻塞；并非无限提高内存上限。

### 14.2 产物对照

正常构建对照通过（qa-3ba569909702）：入口 CSS 均 26916 bytes；页面路由模式
133 个、页面入口 76 个相同。实际 Nitro viewerPageRoutePatterns 均 77 条且完全
一致；原报告脚本未识别当前 Nitro 导出格式返回 null，另行解析实际数组确认。
正常构建没有样张路径/标记。Nuxt 文件均 295 个，总量 5006928 → 5010352 bytes
（+3424，locale 文案）；public 文件 199 → 245（46 个新增小图标）。每路由 JS
有 -6 bytes 的工作树绝对路径长度差，旧绝对路径问题没有修复。

**测试构建对照未通过**（qa-19a84971dd1f）：样张路由 46 个（23×中日），总路由
179，入口 CSS 不变；但报告 6 项旧路由差异，包括 account/profile CSS
62161→58982、account/songs 85236→82057、version-summary 新 el-drawer CSS
218819→222306、tools/progress 新 el-segmented CSS 22515→25839 等。完整失败
保存在 compare-samples 输出；未擅自修改 Phase 0 或把 chunk 重组推断为无影响。

PWA 静态清单两边均 3 个：builds/latest.json、builds/meta/<build-id>.json、
manifest.webmanifest；manifest theme-color 均 #eaf6f5。导航回退被 [/./] denylist
禁用，不能把这些元数据预缓存描述为所有页面离线可用。

### 14.3 浏览器与数据库证据边界

运行使用重建后的 Nitro、系统 Chromium、独立网络 namespace、空白私有 MySQL。
先验证实际 SELECT DATABASE() = viewer1_security_test、私有 datadir，只有显式
mutation opt-in 后才创建合成账号/帖子/通知/称号；没有生产数据拷贝或生产访问。
后台使用本地合成管理 API，不能据此宣称真实管理后端全链路通过。

未改动的 main/Phase 0 Nitro 含旧 owned-QA 路径守卫，因此运行验证使用其原有
隔离 runner/Vault scratch 路径；没有绕过守卫。构建与 V2 并发测试使用新准入。
旧 wrapper 的维护锁只在这些兼容性运行窗口持有；不与构建重叠。

首轮原子检查 71/72，失败为离线远程封面；首次完整矩阵因总时长主动拆分并
通过 owner abort 停止，不能算通过。首个宽屏矩阵 249/273，24 个失败均为
远程 cover/song-cell 图片离线。随后使用明确标记的本地合成 SVG 图片响应
重验样张，API 未 mock，其他外网仍阻断；保留原失败结果。

样张最终结果：宽屏 qa-d62ebf602a50、窄屏 qa-6857d1a6810a 各 273/273，
按检查名去重 457 项全通过。原子组件 qa-90ebbe737ad3 72/72，图表同 run
350/350。使用 Chromium 113.0.5672.126，图表脚本结尾的 Windows 文案为历史
硬编码，真实进程是在本轮 Linux 隔离 unit；没有修改检测断言。

字体只测已裁定 B，没有引入完整 Noto：中/日文各正常/慢速网络各 3 轮，共
12 轮均 6 个请求、135684 bytes（132.5 KiB），满足 ≤150 KiB / ≤12 请求。
FOUT 代理指标最大 1198 ms（字体到达与 FCP 的差，不是人工逐帧视觉测量）。
中日文继续系统字体；首次正式页面集成仍需重新验证实际加载和 FOUT。

旧页首次采集 qa-20c310f3680f 因 Chromium 113 不支持新版 Playwright 遮罩
的 hidePopover 失败，owner abort 退出 125；已保留日志。随后采用已安装、
与 Playwright revision 1228 对应的 Chromium 149.0.7827.55，不改页面/断言。
HTTP 回环采集 qa-c1bae3755364 完成截图，但生产 Secure cookie 未发送，
账号 profile/通知是 401，因此不能记为登录页面通过。随后采用临时本地证书
与 HTTPS 代理，要求实际登录后 auth/me authenticated=true 且 cookie Secure；
不会将 HTTP 首轮误标的 authenticated 截图当作登录证据。

### 14.4 登录旧页、样式与请求对照

HTTPS 采集 main（qa-6c1f697f3ef7）、Phase 0（qa-f72ae1a32301）、同版本复采
（qa-9d104183703e）、回退 main（qa-5702c57202c2）均完成 100 个状态：18 个
公开页 × 两宽度 × 两主题，加 7 个登录页 × 四状态。登录页包含账号资料、成绩、
同步、个人主页、社区帖子、通知、后台 dashboard；实际 Secure 会话与私有测试库
确认，未发生采集错误。后台只覆盖合成管理 API，外部曲库等只覆盖隔离下状态。

main→Phase 0 的 100 个计算样式集合完全一致；auth/me、profile、通知、帖子、
admin/auth/me 五个响应均 200，内容 SHA-256 完全一致。同版本复采和回退也一致。
这只是合成测试数据覆盖范围内的证据，不代表所有业务返回值已穷尽。

**严格截图/原始资源 URL 对照未通过**：qa-61b58539b57f 公开页 27、登录页 6 个
状态报差异；同版本复采 qa-32a7b3530466 仍有 26/6 个；main→回退
qa-9ecee7f8ccce 也有 26/6 个。24 个公开状态包含原有封面 URL 五分钟缓存键
`v=Math.floor(Date.now()/300000)` 的变化；另外有 About 的 1–8 像素差异，
同版本还出现 Forum 34 像素差异。登录页差异集中在后台实时时间戳及帖子浏览次数。
人工检查帖子截图证实计数不同；不能把这些严格断言失败改写为通过。

只去掉已定位的 cover 缓存键后，main→Phase 0 和同版本复采的 100 组字体/图片
请求集合一致；该结果仅作诊断，未修改原验收断言。完整原始失败截图、日志、
请求清单和诊断 JSON 均保留。一个控制台差异只是相同离线/TLS 消息的顺序变化。

| HTTPS 采集 | 采样 cgroup 峰值 bytes | RSS 合计峰值 KiB |
| --- | ---: | ---: |
| main | 1447301120 | 2171148 |
| Phase 0 | 1540878336 | 2139056 |
| Phase 0 复采 | 1441697792 | 2034660 |
| main 回退 | 1582501888 | 2103160 |

采样间隔 500 ms；宿主内核不提供 memory.peak，RSS 合计可能重复计算共享页。
这些运行 OOM/high/max 均为 0。早期样张/原子/字体运行没有记录峰值，只能确认
旧隔离 runner 的硬上限和退出结果，不能从后续运行推算其峰值。

### 14.5 PWA 与隔离回退

qa-d479273600c5 在可信 HTTP 回环 origin 分别启动 main、正常 Phase 0、退役
候选及回退 main，Chromium 149 实际注册 Service Worker，四者均 active，
实际 CacheStorage 均只有上述 3 个预缓存对象。离线 manifest 为 200，离线新导航
无法完成（记录为 0），与原导航 denylist 一致。正常构建样张路径均为 404。
HTTP 检查只验证 PWA；登录检查使用前述 HTTPS，不降低 Secure cookie 策略。

本次 PWA cgroup 采样峰值 866222080 bytes，RSS 1237812 KiB，事件全 0。
第一次因旧维护锁返回 75；确认锁已释放、压力恢复后重试，没有终止其他任务。
自签 HTTPS 下空注册结果保留为测试证书限制，不计通过证据。

回退是在隔离环境重新服务已重建的原始 main，验证登录/API/PWA；结合第 12 节
源码回退 tree 相同的证据，完成运行回退检查。没有切换生产目录或重启生产服务。
回退截图仍有上述严格差异，不能据此声称像素完全一致。

### 14.6 当前验收状态（覆盖第 10 节历史表）

| 项 | 当前档 | 证据与限制 |
| --- | --- | --- |
| 0-A1、0-A2 | 仅 Windows 开发自检 | 原设计批准与开工决策文档核对；不是 Linux 运行项 |
| 0-A3 | Linux 隔离验证通过 | 已裁定 B；12 轮 6 请求/132.5 KiB；正式首次集成需复验 FOUT |
| 0-B1、B2、B3、B5 | Linux 隔离验证通过 | test:ds 85/85，368 对比度；不包含真实成绩抽样 |
| 0-B4 | 未验证或阻塞 | 原子组件文本模式通过；没有完成灰度人工复核 |
| 0-B6、B7 | Linux 隔离验证通过 | 样张矩阵、原子组件和图表；Teleport/token 作用域覆盖 |
| 0-B8 | Linux 隔离验证通过 | 静态领域颜色规则通过；未逐张人工复核全部图像 |
| 0-C1、C2 | Linux 隔离验证通过 | 冻结 main 原素材校验、46 文件重新生成字节一致；人工素材复核仍为 Windows |
| 0-C3、C5、C8 | Linux 隔离验证通过 | 原子组件 72/72；图片使用明确隔离夹具，不宣称真实 CDN 联调 |
| 0-C4 | 未验证或阻塞 | 未核对 Bot 评价选图源码 |
| 0-C6、C7 | Linux 隔离验证通过 | scoped/usage 与 assets 检查 |
| 0-D1、D2、D3、D5 | Linux 隔离验证通过 | 原子组件与图表浏览器断言；没有完整人工读屏审计 |
| 0-D4、D6 | Linux 隔离验证通过 | 51 文案文件/75 key、54 usage 文件；全部规则通过 |
| 0-D7 | Linux 隔离验证通过 | 所有浏览器经过隔离 runner；早期样张峰值未采集，已披露 |
| 0-E1、E2 | Linux 隔离验证通过 | Nitro 样张矩阵 457 项去重通过，正常 Nitro 样张 404 |
| 0-E3 | Linux 隔离验证通过 | 实际 SW/CacheStorage/manifest/离线行为，14.5 |
| 0-E4 | 未验证或阻塞 | 100 组样式相同；严格截图失败，同版本复采也失败，14.4 |
| 0-E5 | 未验证或阻塞 | 正常构建对照通过；测试构建 6 项旧路由 CSS 差异，14.2 |
| 0-E6 | 未验证或阻塞 | 未观察到新增资源；原始 URL 对照因既有缓存键失败，诊断不代替门禁 |
| 0-E7 | 未验证或阻塞 | DS 检查通过；未全跑所有 test:*；route-assets 旧问题保留 |
| 0-F1 | Linux 隔离验证通过 | 源码 tree、重建 main、登录/API/PWA 回退；严格像素相等仍未通过 |
| 0-F2、F3 | 未验证或阻塞 | 本轮没有合并/部署授权，未上线抽查 |

本轮最终静态 run qa-f7f06191dd66：test:ds 85/85、check:ds 通过，保留原 chart-ugc
5 个深色 CSS 旧问题。npm 锁漂移、Keepalive/Teleport、settings 水合、route-assets、
绝对路径继续独立登记；Keepalive + Teleport 必须在阶段 1 导航替换前针对性修复回归。
本次没有扩大 Phase 0 代码范围。**阶段 0 不能标记完整验收通过，停止等待审查。**

### 14.7 证据与清理

持久证据根：`/home/sigaer/taiko/qa-vault/runs/qa-1160a6030e71/evidence/delivery/`。
包含构建日志/指标、build reports、所有成功和失败的浏览器截图/清单、请求对照、
PWA/回退 summary、隔离 harness、固定 Schema 与来源审计。652 文件、70289601
bytes，manifest.json 为逐文件 SHA-256；各 run 的独立 Vault 另保留 runner/SQL 日志。
秘密与临时数据库不进入 Git；本记录只提交摘要和证据定位。

清理结果见本节最后的收尾记录。原 IDE 所在工作树保留；历史未知目录不删除。


收尾：qa-e63d4bd20d1a 先只读复查，qa-1842af427b5e 清理前再次确认 inode、
mtime/ctime、归档 hash、Git HEAD/状态、进程/FD/服务/外部 symlink 引用，
移除本轮 baseline/final 两棵 detached 工作树与重建产物。合计回收 allocated
1234755584 bytes；清理后卷可用 35239546880 bytes。未强制删除、未清理未知
历史目录。原 IDE 工作树保留；main 原有业务数据更新与其他未跟踪目录未动。
本轮登记簿为空，无运行中的 taiko-qa-* 服务，35251/35252 无监听；测试库 daemon
和子进程退出已由各 runner 确认。没有停止 YDService 或生产服务。

基础设施分支已独立推送三个提交：`7a0f024a`（准入/并发）、`53e0c37e`
（临时存储）、`3e674114`（Annual 退役）。源码树与已验证最终树 SHA 完全一致，
压缩 fixup 没有改变测试后的代码。原 Phase 0 分支本次仅提交此验收记录。

推送后 qa-562adb122fbb 再次确认基础设施源码树无未提交改动、HEAD 与已推送
remote tracking 一致、无活动引用，移除该独立工作树与已归档的创建者脚本，
另回收 allocated 235786240 bytes。本轮两次清理共 1470541824 bytes（约
1.37 GiB）；最后卷可用 35471003648 bytes。证据、已推送分支、用户 IDE 工作树
均保留。安装在主机上的旧基础设施入口未替换，推广仍需独立审查；没有合并、
部署、生产重启或阶段 1 工作。
