# Taiko Viewer Design V1.3 Final — APPROVED

Taiko Viewer 全站重新设计的高保真原型。Design V1.3 Final 已于 2026-11-17 批准（`docs/22-v1.3-design-freeze.md`），冻结基线为提交 `5f770a2ddd2df970454f85fda09fa73008120b66`。

- **设计阶段结束。** 不再有 V1.4，不再探索品牌方向。原型代码冻结在基线提交上。
- **下一步是分阶段实施**，从阶段 0 的准备开始：`docs/06-migration-plan.md`、`docs/23-phase-0-implementation-tasks.md`。实施前的条件与三项门槛（P0 软键盘避让、P1 王冠不只靠颜色区分、P2 默认头像混合数据复核）见 `docs/06` 与 `docs/12`。
- **批准不包括合并到 main 或部署。** 合并与部署按仓库现有流程另行处理。
- 已接受的例外：歌曲详情 1440 浅色的朱色 / 品牌比例为 0.70（目标 ≤ 0.60），原因是谱面音符的游戏含义；不算达标（`docs/12` RK-54）。

- **默认状态是 C+**：真实游戏素材 + Viewer Teal 品牌色（`docs/19-v1.3-phase-b-decisions.md`）。打开原型看到的就是最终设计。
- **A、B 是历史对照开关**：A = V1.2 的生成式素材与 Fumen 配色；B = 真实素材 + Fumen 配色。Phase B 起不再维护和验收。
- **要原样复现历史状态，用提交**：V1.2 是 `cb8fb5aa`，Phase A 的三版本对照是 `10d069b4`。开关里的 A、B 因为数据修正（G9）已经和历史截图不逐像素一致。

## 边界

- 独立的 Vite + Vue 3 工程（纯 CSS），只使用 `src/mock/` 生成的模拟数据。
- 不引用、不修改 `taiko_viewer/` 生产工程；不连接后端、数据库或任何 API；不改变 API 契约。唯一的外部请求是曲绘图片：只对白名单曲目，只带曲目 ID，从 `static.sakura-bot.cn` 加载。
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
| `#/review/system` | Design System V1.3 活样张；书面规范见 `docs/04-design-system.md` |
| `#/review/assets` | 素材页：难度、王冠、评价、称号牌、曲绘与占位、头像 |
| `#/review/compare` | A / B / C 三版本对照（历史） |
| `#/review/directions` | 三个设计方向（譜面 / 祭 / 帖）的对照（历史） |
| `#/review/device?p=/songs/615` | 手机预览框（390 / 360 / 820） |
| `#/states` | 加载、空、错误、未登录、未绑定、404、离线、同步样张等状态 |

任意页面的地址在 `#` 之前加 `?variant=a|b|c`、`?theme=light|dark`、`?data=full|demo|real`，只对这次加载生效。

## V1.3 做了什么

逐项见 `docs/20-v1.3-phase-b-completion.md`，验收见 `docs/21-v1.3-visual-acceptance.md`。

- **品牌**：Viewer Teal 只表示交互（主按钮、链接、选中、焦点、导航）；音符色只表示游戏数据；咔向蓝偏移；深色主题五级明度（下沉 < 页面 < 卡片 < 分区 ≈ 浮层），浮层单独一级。
- **数据靠排版**：主数字用 `--ink` 与字号层级，不用红色；下降量不用红色；图表里成片的朱色用柔化的 `--don-data`。
- **真实素材**：曲绘（正式站静态域名，白名单曲目）、难度图标、王冠、评价、称号牌、默认头像、完整标志，原样使用；评价与王冠另有小尺寸版本。
- **数据修正**：精选曲里 ID 与曲名对不上的换成真实曲目；默认数据首屏以真实曲绘为主；缺失曲绘清单。
- **去掉没有来源的东西**：段位徽章不显示；没有「稀有称号」；不生成随机头像。

## `public/game`

真实素材目录，共 80 个文件、904,131 字节（约 883 KB）：

- 从正式站 `origin/main` 原样复制 31 个：难度 5、王冠 3、评价 7、称号牌 12、牌面清单 1、头像 2、完整标志 1。来源路径与 md5 见 `public/game/README.md`。
- 小尺寸素材 46 个：评价 `rank/56`、`rank/80`，王冠 `crown/36`、`crown/60`、`crown/96`，每个尺寸有 WebP 与 PNG 两份。由 `qa/tools/gen-small-assets.mjs` 从原图等比缩小，前后字节数在 `small-assets.json`。
- `README.md`、`MISSING.md`（六首没有曲绘的真实曲目）、`small-assets.json`。

曲绘不在仓库里。

## 原型控制面板

产品画面右下角的「原型」按钮（手机上是左缘的窄把手）即 `src/components/ProtoPanel.vue`，只存在于原型中；`#/review*` 页面与 iframe 内不显示。

| 开关 | 取值 |
|---|---|
| 版本 | C+（默认）/ A、B（历史，标为历史对照） |
| 主题 | 跟随系统 / 浅色 / 深色（`system` / `light` / `dark`） |
| 语言 | 简体中文 / 日本語（`zh` / `ja`） |
| 登录态 | 游客 / 未绑定 / 无成绩 / 已同步（`guest` / `unbound` / `empty` / `ready`，默认 `ready`） |
| 数据 | `full`（默认：50 首真实曲目 + 1,470 首生成曲）/ `demo`（30 首精选）/ `real`（只有 50 首真实曲目），切换后刷新 |
| 下一次同步结果 | 成功 / 部分成功 / 失败（`success` / `partial` / `failed`） |
| 减少动效 | 跟随系统 / 开启（`system` / `reduce`） |
| 列表密度 | 宽松 / 紧凑（`comfortable` / `compact`） |

设置写入 `localStorage['tv-design-v1']`，iframe 通过 `storage` 事件与外层同步。Phase A 期间存下的版本选择不沿用，打开原型一律回到 C+。

## Node 检查

只读、无需浏览器，在本目录下执行：

| 命令 | 内容 |
|---|---|
| `node src/mock/selftest.mjs` | 模拟数据自检：数据集的数量、边界桶、索引一致性、确定性、生成耗时 |
| `node src/search.test.mjs` | 命令面板纯逻辑与每次按键耗时 |
| `node src/sync.test.mjs` | 同步状态机，假计时器 |
| `node src/styles/contrast-check.mjs [--json]` | token 对比度：当前 630 项（fumen 与 teal 的浅、深四套），全部达标；不达标时退出码 1 |
| `node src/assets.test.mjs` | 素材映射：难度、王冠优先级、评价值 ↔ 文件与中日文名称（与正式站 `scoreRank.ts` 一致）、12 张称号牌、每个复制文件的 md5；当前 99 项 |

## 浏览器验收（QA）

`qa/run.mjs` 用系统安装的 Chrome（后备 Edge）经 `playwright-core` 驱动，默认先 `vite build` 再在 4311 端口 `vite preview`。一次一个浏览器，页面并发 ≤ 2，有时长上限，结束时关闭服务器与浏览器。说明与各项检查的局限见 `qa/README.md`。

```bash
npm run qa              # 全部矩阵与套件（node qa/run.mjs --suite all）
npm run qa:quick        # 快速子集（--quick）
npm run qa:curate       # 把关键截图复制到 qa/screenshots 并生成 index.html
node qa/run.mjs --suite checks --only songs-615
node qa/run.mjs --suite flows --flows palette,sync
node qa/run.mjs --suite visual,checks --blocked   # 屏蔽曲绘域名，跑缺失素材用例
node qa/run.mjs --suite perf --variant a          # 性能套件默认测 C+；只有测历史版本 A / B 时才加 --variant
node qa/run.mjs --v13                             # 四个代表页面的定向检查
```

常用参数：`--suite visual|checks|flows|perf|all`（可逗号分隔）、`--quick`、`--only <子串>`、`--flows a,b`、`--base URL`（对已有服务器运行，不构建）、`--no-build`、`--max-minutes 25`、`--concurrency 1|2`；V1.3 新增 `--blocked`、`--variant a|b|c`（只影响性能套件，`full` 与 `demo` 两次都按它跑；默认 `c`，测量前断言根元素的版本属性）、`--v13`。

- 性能预算：搜索面板首键 p95 ≤ 50 ms、热态 p95 ≤ 50 ms，路由切换 p95 ≤ 200 ms，其余沿用 V1.2。
- 原始输出：`qa/out/`，不入库（`.gitignore`）。
- 入库的截图：V1.3 Final 在 `qa/screenshots/v13-final/`；Phase A 对照在 `qa/screenshots/v13/`；V1.2 及更早在 `qa/screenshots/`（含 `compare/`），原样保留，不重拍。
- 最近一次结果（V1.3 Final，C+，`docs/21-v1.3-visual-acceptance.md`）：完整矩阵 378 个用例，错误 0、警告 0；18 个流程全部通过；缺失素材 24 个用例，错误 0、警告 0；5 轮性能全部在预算内（`full` 首键 p95 15.7–22.5 ms、热态 13.3–17.3 ms、路由切换 79.1–100.9 ms）。Phase B 前期写过的一组性能数字实际测的是历史版本 A，已在 `21` §5 更正。V1.2 的结果在 `docs/11-v1.2-quality-report.md`。
- 以上都在模拟数据上完成，不是生产验收。

## 目录

```text
preview/redesign-v1/
├─ index.html          首屏主题与版本脚本、favicon 引用、noindex
├─ public/             favicon.svg；game/（真实素材）
├─ vite.config.js
├─ docs/               设计文档（见下表）
├─ qa/                 浏览器验收脚本、tools/（小尺寸素材生成）、精选截图
└─ src/
   ├─ main.js · App.vue · router.js · store.js · assets.test.mjs
   ├─ sync.js · search.js · routeState.js · motion.js · breakpoints.js
   ├─ sectionNav.js · hscroll.js · focusTrap.js · dock.js
   ├─ styles/          tokens.css · base.css · domain.css · contrast-check.mjs
   ├─ components/      框架、浮层、图表与业务组件；gamemap.js · smallasset.js · lazy.js
   ├─ views/           产品画面（每个路由一个文件）；review/ 为评审页
   └─ mock/            catalog.js · generate.js · data.js · real.js · titles.js · selftest.mjs
```

## 文档

| 文件 | 内容 |
|---|---|
| `docs/01-product-audit.md` | 现有产品的信息架构与设计问题 |
| `docs/02-design-directions.md` | 三个设计方向与取舍 |
| `docs/03-ia-mapping.md` | 新旧信息架构映射与功能覆盖清单 |
| `docs/04-design-system.md` | Design System V1.3 规范 |
| `docs/05-page-specs.md` | 主要页面的设计说明 |
| `docs/06-migration-plan.md` | 分阶段实施方案（已批准从阶段 0 开始，按 V1.3 更新） |
| `docs/07-v1.1-design-decisions.md` | V1.1 设计裁决 |
| `docs/08-v1.1-fix-record.md` | V1.1 与 V1.2 逐项修复记录 |
| `docs/09-v1.1-qa-report.md` | V1.1 真实浏览器验收报告 |
| `docs/10-v1.2-design-decisions.md` | V1.2 设计裁定 |
| `docs/11-v1.2-quality-report.md` | V1.2 质量与性能报告 |
| `docs/12-risks-and-integration-acceptance.md` | 遗留风险登记与正式集成验收清单（含 V1.3 与 P0 / P1 / P2 门槛） |
| `docs/13-design-freeze.md` | V1.2 Design Freeze 决策（历史） |
| `docs/14-v1.3-asset-audit.md` | V1.3 素材盘点与业务映射 |
| `docs/15-v1.3-brand-system.md` | Phase A 品牌配色与使用规则（历史；被 19 修订的以 19 为准） |
| `docs/16-v1.3-component-specs.md` | Phase A 组件规范（历史；被 19 修订的以 19 为准） |
| `docs/17-v1.3-visual-comparison.md` | Phase A 三版本视觉对照（历史） |
| `docs/18-v1.3-design-decision.md` | Phase A 推荐方向与待裁定事项（历史） |
| `docs/19-v1.3-phase-b-decisions.md` | Phase B 裁定（C+，G0–G13、D1–D14） |
| `docs/20-v1.3-phase-b-completion.md` | Phase B 完成记录与验证程度 |
| `docs/21-v1.3-visual-acceptance.md` | V1.3 视觉验收与测试报告 |
| `docs/22-v1.3-design-freeze.md` | V1.3 Final 的 Design Freeze 文档与批准记录 |
| `docs/23-phase-0-implementation-tasks.md` | 阶段 0 实施任务清单 |
