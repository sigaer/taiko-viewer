# Viewer Design System V1.3 · 工程约定（阶段 0）

给开发者看的约定，不进入界面。规格以设计分支 `preview/redesign-v1/docs/04-design-system.md`（V1.3）、`16`、`19`、`22` 为准；任务清单是 `23-phase-0-implementation-tasks.md`。本文写的是这些规格在生产代码里落在哪里、怎么写、怎么检查。

## 1. 阶段 0 的边界

- 现有页面不能有任何可见变化。新 token、Element Plus 映射、字体和共用样式**只在 `html.ds-preview` 下生效**；没有这个类的页面一概拿不到。不能把「样式表只被样张页懒加载」当作隔离手段：客户端从样张页跳走后，样式表仍留在文档里，靠的是作用域选择器。
- 不改现有 `--viewer-*`，不给它们做别名；不改全局 `--el-color-primary`（生产主按钮仍是朱色）。新旧对照见 `viewer-token-mapping.md`（脚本生成），别名在阶段 1 做。
- 不移植原型的路由、store、模拟数据、登录与同步状态机。原型是规格，不是要搬的代码。
- 允许改动的现有文件只有：`nuxt.config.ts`（注册样张路由的钩子）、`package.json` / `package-lock.json`（脚本；发布时的版本号）、`locales/zh.json` / `ja.json`（顶层 `ds` 键）。`app.vue` 不改。其他现有文件一律不改。

## 2. 目录与命名

| 内容 | 位置 |
|---|---|
| token | `assets/css/ds/tokens.css` |
| Element Plus 映射 | `assets/css/ds/element-plus.css` |
| 字体声明 / 字体文件 | `assets/css/ds/fonts.css` / `assets/font/ds/` |
| 共用元素样式（`.ds-root`、`.stage`、`.num`） | `assets/css/ds/base.css` |
| 领域样式（音符、判定等，组件任务按需新建） | `assets/css/ds/domain.css` |
| 组件 | `components/ds/`，自动注册为 `Ds*`（`components/ds/Crown.vue` → `<DsCrown>`）；图表放 `components/ds/charts/` |
| 共享工具 | `utils/ds/`（嵌套目录不会被自动导入，用 `~/utils/ds/xxx` 显式导入；测试里用相对路径加 `.ts`） |
| 样张页 | `ds-samples/`（不在 `pages/` 下） |
| 文案 | `locales/zh.json`、`locales/ja.json` 的顶层 `ds` 键 |
| 测试 | `tests/ds*.test.{mjs,ts}`，`npm run test:ds` |
| 检查与生成脚本 | `scripts/ds/` |
| 小尺寸素材 | `public/icons/rank/{56,80}/`、`public/icons/crown/{36,60,96}/`；字节表 `scripts/ds/spec/small-icons.json` |

## 3. 作用域规则（D0-2、D0-3）

- `assets/css/ds/` 下所有规则都以 `html.ds-preview` 开头：浅色 `html.ds-preview:not([data-theme="dark"])`，深色 `html.ds-preview[data-theme="dark"]`，舞台面 `html.ds-preview .stage`。`tokens.css` 里只有自定义属性，`check-tokens.mjs` 会拒绝 `:root`、元素样式和别的选择器。
- 主题沿用生产的 `html[data-theme]`（`plugins/theme.ts`、`taiko_theme` cookie），不实现「跟随系统」。
- Element Plus 映射写在 `html.ds-preview:root …` 下（特异度 0,2,1 起），保证压过生产 `tokens.css` 的 `html:root`（0,1,1）和 `main.css` 的组件覆盖，与样式表加载顺序无关。弹层（对话框、下拉、Tooltip、消息）挂在 `<body>`，在 `<html>` 之内，所以跟着同一个类走。
- 主色 = 品牌青绿（Role token `--action-bg` 等）；info = 中性（`--ink-2`，浅底 `--bg-sunk`）；success / warning / danger = 状态 token；破坏性按钮是危险色描边。Element Plus 变量里不出现音符色（`--don*`、`--ka*`、`--roll*`）。
- Tooltip（含 `effect="dark"`）、Popover、下拉、对话框、抽屉、消息都按 `04` §5 / §9 走浮层一级：`--overlay-bg` + `--overlay-line`。浮层里的选中行用 `--bg-sunk`。
- `ds-preview` 类只由 `ds-samples/_shared/useDsPreviewScope.ts` 通过 `useHead` 设置：SSR 首屏就有；页面卸载时移除；`<NuxtPage keepalive>` 停用时由 `@unhead/vue` 清空、再激活时恢复。阶段 1 的新外壳接管时，再决定这个类放在哪里。

## 4. 组件写法

- 只引用 Semantic / Role / Domain token，不引用 Primitive（`--ai-*`、`--shu-*`、`--asagi-*`、`--yamabuki-*`），不写十六进制色或 `rgb()` 字面量。例外只有 `assets/css/ds/tokens.css`。
- 表达按钮、链接、选中、导航、焦点、信息时只用 Role token。音符色只表示游戏数据：`--don*`、`--ka*`、`--roll*` 只出现在音符、判定条、图表和谱面带组件与 `domain.css`；`--diff-*`、`--crown-*`、`--rank-*`、`--judge-*` 只出现在对应组件、图表与 `domain.css`。
- 真实素材原样使用：只等比缩小；不对素材用 `filter`、`mix-blend-mode`、`mask`、`opacity`；不在素材上叠加文字或图形。难度图标只用 `/icons/diff/`，不用 `/icons/difficulty/`。不渲染段位。
- 素材路径、换算一律走 `utils/ds/`：`gameAssets.ts`（难度、评价、王冠、称号牌、`smallSrc`）、`crown.ts`（成绩计数 → 王冠状态，全站唯一一处）、`avatar.ts`（服务端默认头像 `https://viewer.sakura-bot.cn/miku.png` 视为没有头像，D0-7）。评价名称从 `utils/scoreRank.ts` 取，难度从 `utils/difficulty.ts` 取，曲绘地址从 `utils/songCover.ts` 取，不另写一份。
- 文案只来自 locale 文件；新组件不写行内双语（`locale === 'ja' ? … : …`、`{ zh, ja }` 字面量）。新键放在 `ds.*` 下，中日一一对应；可以复用现有键（例如 `difficulty.1–5`）。界面上只写名称、状态和必要的说明，不写规格语言或设计理由（`AGENTS.md`「UI Copy and Specification Leakage」）。
- 缺失值统一显示「—」（U+2014）。
- `setup` 里不访问 `window`、`document`；浏览器对象只在 `onMounted` 及之后使用。随视口变化的布局用 CSS 媒体查询（断点 767 / 1099 / 1239，见 `utils/ds/breakpoints.ts`），不用 JS 断点决定渲染结构。现有页面的 720 / 960 等断点不动。
- 图片固定宽高，加载前后不改变布局。可点元素的触控目标 ≥ 44×44（透明扩展区写法）。减少动效时没有淡入和动画。
- 新代码里不出现 `DanBadge` 或段位字段。

### 4.1 scoped 样式与根元素属性（P0-28）

- **不要**在 `<style scoped>` 里写 `:global(<根选择器>) .x { … }`。Vue 只保留 `:global()` 里面的部分，`.x` 被丢掉，规则落到根元素上（`:global(:root[data-kb]) .composer` 编译成 `:root[data-kb]`）。
- 需要随 `<html>` / `<body>` 属性变化的样式，二选一：写在 `assets/css/ds/` 的全局样式表里（仍以 `html.ds-preview` 开头）；或在 scoped 样式里直接写普通选择器加根属性，例如 `html[data-kb] .composer { … }`，编译结果是 `html[data-kb] .composer[data-v-…]`。样张 `/_ds/root-attribute` 是可运行的例子。
- `npm run check:scoped-css` 编译每个 scoped 样式块比对；`components/ds/`、`ds-samples/` 出现即失败，仓库其余部分只出报告。已知的 `pages/admin/taiko/chart-ugc.vue:212` 在报告里，阶段 0 不修。
- 软键盘避让（社区阶段实现）的验收必须包括：查看编译后的样式确认选择器命中；iOS Safari 与 Android Chrome 真机通过。模拟的矮视口不算。

## 5. 字体（D0-4 = B，2026-11-17 正式裁定）

- 首屏自托管字体预算：≤150 KiB、≤12 个请求。Barlow / Barlow Condensed 按需加载；首次集成正式页面时重新验证字体加载与 FOUT。

- 自托管 Barlow（400 / 500 / 600 / 700）与 Barlow Condensed（500 / 600 / 700），latin + latin-ext 两个 unicode-range 分片，woff2，`font-display: swap`。文件原样取自 `@fontsource/barlow` 5.3.0 与 `@fontsource/barlow-condensed` 5.3.0（npm），SIL Open Font License 1.1，许可文本 `assets/font/ds/OFL-Barlow.txt`、`OFL-Barlow-Condensed.txt`。没有加 npm 依赖。
- 中日文用系统字体。token 的字体栈保持规格原样，`'Noto Sans SC Variable'` / `'Noto Sans JP Variable'` 排在系统字体前面；方案 B 不声明这两个字体，浏览器直接落到系统字体。
- 只有 `ds-samples/_shared/DsSampleShell.vue` 导入 `fonts.css`；正常生产构建里没有这些字体文件，现有页面也不请求它们。
- P0-10 的 A / B 对比页是 `/_ds/fonts`（`?fonts=a` 为方案 A）。方案 A 的 Noto Sans SC / JP 可变字体约 10 MB，没有加依赖、也没有放进仓库：页面在 `?fonts=a` 时链接 `/_ds-fonts-a/fonts-cjk.css`，这个地址应用本身不提供，由 `scripts/ds/font-measure.mjs` 在测量时用请求拦截从仓库外的 `@fontsource-variable` 安装目录应答。不经测量脚本打开时方案 A 退回方案 B。token 不用改。该对照仅保留历史测量用途；本轮正式裁定不引入完整自托管 Noto Sans SC / JP。

## 6. 样张页（D0-1 = A，P0-26）

- 只在 `nuxt dev`（`NODE_ENV=development`）或显式 `TAIKO_DS_SAMPLES=1` 的构建里注册：`nuxt.config.ts` 的 `pages:extend` 钩子调用 `ds-samples/routes.ts`。正常生产构建里既没有路由也没有代码；页面不在 `pages/` 下，所以不进 `viewerPageRoutePatterns`（流量统计）；站点地图是固定列表，也不会收录。`TAIKO_DS_SAMPLES=1` 的测试构建里，样张代码可能进入 Service Worker 预缓存，这类构建不能部署。
- 路由：`/_ds`（`ds-samples/index.vue`）与 `/_ds/<slug>`，日文 `/ja/_ds/...`（i18n 自动加前缀）。页面 `layout: false`（由钩子写进路由 meta），`robots: noindex,nofollow`。
- 主题与语言切换用生产机制：`useViewerTheme()`（cookie + `html[data-theme]`）与 `useSwitchLocalePath()`。
- **组件任务怎么加样张，不改任何共享文件：**
  0. 编号区间决定 `/_ds` 总览里的分组（`ds-samples/_shared/useDsSections.ts`）：10–29 token 与排版，30–69 控件，70–79 素材组件，80–99 音符与图表。
  1. 新建 `ds-samples/sections/<NN>-<slug>.vue`（`NN` 决定排序与分组，`slug` 为小写短横线，例如 `60-crown.vue` → `/_ds/crown`）。重启 `nuxt dev` 后自动注册，并出现在 `/_ds` 索引和顶栏里。
  2. 文件里用 `DsSampleShell`（必用：它负责作用域、样式表、noindex、主题与语言）和 `DsSampleBlock`：

     ```vue
     <script setup lang="ts">
     import DsSampleShell from "../_shared/DsSampleShell.vue";
     import DsSampleBlock from "../_shared/DsSampleBlock.vue";
     defineOptions({ name: "DsSampleCrown" });
     </script>
     <template>
       <DsSampleShell title="crown">
         <DsSampleBlock name="dondaful / full / clear / played / none"> … </DsSampleBlock>
       </DsSampleShell>
     </template>
     ```
  3. 样张上的标签只写组件名、token 名、状态名（ASCII 标识即可），不写说明文字。需要展示中日文字形时，把元素标上 `data-ds-specimen`（文案检查会放过它）。
  4. `DsSampleShell` 在离开路由时卸载样张内容、再激活时重新挂载：Element Plus 的弹层（select、tooltip、dropdown）会在 `<body>` 留下常驻节点，若随停用的 keepalive 页面一起被销毁，Vue 会报 `Cannot read properties of null (reading 'nextSibling')`，下一页的 head 也不会更新。所以样张状态在返回时会重置，这是有意的。
- 组件自身的文案键：加在 `locales/zh.json` 与 `ja.json` 的 `ds.<组件>.*` 下，两边同时加；`npm run check:ds` 会核对。
- 组件测试：新建 `tests/ds<Component>.test.{ts,mjs}`。`npm run test:ds` 按 `tests/ds*.test.*` 自动找到它，不需要改 `package.json`。

## 7. 检查与脚本

| 命令 | 内容 |
|---|---|
| `npm run test:ds` | 工具函数（断点、王冠、选图、头像）、素材校验和、各检查脚本的正反例 |
| `npm run check:ds` | 下面所有静态检查依次运行，任一失败即失败 |
| `node scripts/ds/check-tokens.mjs [--prototype <redesign-v1>]` | token 文件的结构规则；与提交的 C+ 快照 `scripts/ds/spec/tokens-v1.3-cplus.json` 逐项比对；给出原型目录时，再直接解析原型的级联（teal / authentic）与 `04` §2.2–§2.5 的表格比对，`--write-snapshot` 更新快照 |
| `node scripts/ds/check-token-collisions.mjs` | P0-04 同名读取检查 |
| `npm run check:ds-contrast` | P0-07 对比度（浅、深、舞台面，含 Element Plus 映射用到的配对） |
| `node scripts/ds/token-mapping.mjs [--write]` | P0-05 新旧对照表 `docs/design-system/viewer-token-mapping.md` 是否最新 |
| `npm run check:scoped-css` | P0-28 |
| `node scripts/ds/check-ds-usage.mjs` | P0-29 颜色与素材用法 |
| `node scripts/ds/check-ds-copy.mjs [--list]` | P0-30 文案；`--list` 列出全部 `ds.*` 文字供人工审查 |
| `npm run ds:icons` / `node scripts/ds/generate_small_game_icons.mjs --check [--sheets <dir>]` | P0-12 小尺寸素材：生成、核对（不写文件）、输出 1× / 2× 对照图 |
| `npm run ds:build-report -- --out a.json` / `--compare base.json cur.json [--expect-samples]` | P0-33 / P0-35 构建产物报告与对比（`_nuxt` 字节、各路由 JS / CSS 依赖、入口 CSS、预缓存、web manifest 与 theme-color、注册路由、字体、locale） |
| `npm run ds:browser-check -- --base http://127.0.0.1:<port>` | 浏览器检查：进入 / 离开 / keepalive 往返时的 `ds-preview`、现有页面计算样式前后一致、弹层映射、根属性样例 |
| `node scripts/ds/samples-matrix.mjs --base <url> --out <dir>` | P0-27 / P0-31 / P0-32：全部样张 × 1440 / 820 / 390 / 360 × 浅深 × 中日；控制台、水合、横向溢出、`html lang`、服务端 HTML 的主题与作用域、日文回落到中文 |
| `node scripts/ds/charts-check.mjs <url> <dir>` | 图表样张：可访问名称、SVG 文字相撞与裁切、Lane 键盘、减少动效，并保存截图 |
| `node scripts/ds/font-measure.mjs --base <url> --fontsource <dir>` | P0-10：`/_ds/fonts` 上方案 A / B 的字体请求、字节、到达时间与 FOUT（方案 A 的字体从仓库外的 `@fontsource-variable` 安装目录注入，不进仓库、不进构建） |
| `node scripts/ds/existing-pages.mjs capture --base <url> --out <dir>` / `compare <基线目录> <当前目录>` | P0-01 / P0-34：现有页面截图、关键元素计算样式、字体与图片请求的采集与比对 |

浏览器检查、构建、内存相关检查的**验收**必须在 Linux 服务器上用 `scripts/memory/run_qa.sh`、`run_dev.sh`、`run_build.sh` 运行（先读 `docs/memory-engineering-guidelines.md`）；其他环境里跑的只算开发自检。开发服务器不连数据库：自检时可把 `TAIKO_DB_HOST` 设成不可解析的 `invalid.invalid`，保证任何后台任务都连不上库。

## 8. 小尺寸素材（D0-5 = A）

- `sharp` 从原图等比缩小（`lanczos3`），WebP 无损（带透明）+ 同尺寸 PNG；原图不动；输出只由原图、sharp 版本和脚本里固定的参数决定。评价 2–8 → 56 / 80，王冠 clear / full / dondaful → 36 / 60 / 96。难度图标不做缩小版。
- `smallSrc(dir, name, draw)`：1× 取不小于绘制尺寸的最小档，2× 取不小于两倍绘制尺寸的最小档。
- 重新生成后跑 `--check` 与 `npm run test:ds`；素材被改动或重新压缩时测试失败。

## 9. 真实素材原子组件（P0-16 – P0-24）

| 组件 | 输入 | 要点 |
|---|---|---|
| `DsCover` | `songId`、`size`（sm 32 / md 44 / lg 72 / tile 96 / xl 168 / fill）、`priority`、`label` | 同曲缩略图 → 同曲原图（带生产的 `?v=` 绕缓存）→ 占位；不用 `fallbackSongId`。图片地址只在挂载后设置；全站一个 IntersectionObserver（320px）。淡入用盖在图上的底色层渐隐，素材本身不加透明度 |
| `DsCrown` | `state`（`utils/ds/crown.ts`）、`size`（chip / table / sm / md / lg / xl）、`text`（off / short / full，默认 off） | 文字在素材旁边；显示文字时素材对读屏隐藏，短名与全名不同时读屏读全名 |
| `DsRank` | `value` 0–8、`variant`（default / detail / compact / table / upgrade）、`previous`（upgrade）、`slotPx` | 名称取自 `utils/scoreRank.ts` |
| `DsDiff` | `difficulty`、`star`、`constant`、`size`（md / lg） | 星级走 `utils/difficulty.ts` 的 `resolveChartStarLevel` |
| `DsPlayerAvatar` | `src`（avatarUrl）、`size`（24 / 32 / 44 / 72 / 96）、`label` | 服务端默认地址视为没有头像；挂载时检查水合前已失败的图片 |
| `DsTitlePlate` | `name`、`plate`（编号或自定义键）/ `plateStyle`、`form`（plate / text）、`lang` | 只按明确映射取牌面；12px → 10px → 文字形式 |
| `DsSiteTitle` | `name` | 与牌面同排时由父级 `flex-wrap` 换行 |
| `DsDiffTabs` | `charts`、`v-model`（难度 1–5） | 只发出所选难度，不读写地址 |
| `DsSongCell` | `songId`、`title` / `titleLang`、`subtitle` / `subtitleLang`、难度三项、`coverSize` | 与页面语言不同的曲名才加 `lang` |

- **王冠短名是暂定的**：`ds.crown.short.*`（中文两字、日文紧凑写法）只为 D0-6 的「短名」模式先占位，最终文字与排版在阶段 2 设计成绩组件时定。方向：王冠旁加文字，桌面全名、手机短名。
- 组件的纯逻辑（选图、换算、退回顺序）写在各组件的普通 `<script>` 块里并导出，测试通过 `tests/dsHarness.mjs` 编译组件后直接调用；同一个 harness 用 `vue/server-renderer` 与真实 locale 做 SSR 渲染断言。
- 样张数据放在 `ds-samples/data/atoms.json`（曲号与曲名来自 `tests/fixtures/annual-summary.sample.json`，称号来自 `assets/data/title_song_relations.json`；自定义称号是编的），不放进模板或脚本字面量。

## 实施调色（2026-11-18）

切片 G 按设计负责人的裁定调整了 token 的值；**以下取值与冻结原型（`preview/redesign-v1` `b4bd45b`，C+）有意不同**。方向不变：青绿表示交互，音符色表示游戏含义。
只改 token 的值，没有改组件样式；音符、王冠、评价、难度、类型的 token 都没有改；真实素材不动；`.stage` 舞台面不变。
差异的唯一来源是 `scripts/ds/spec/tuning-2026-11-18.json`：`check-tokens.mjs` 的快照是「原型级联 + 这份调整」，`--prototype` 时另外核对「生产文件去掉这份调整 = 原型」以及 `04` §2.2–§2.5 的表格（即调整就是全部差异）。

| token | 主题 | 原值 | 新值 | 原因 |
|---|---|---|---|---|
| `--bg` | 浅 | `#eaf6f5` | `#f0f4f4` | 页面底接近中性（同等明度，极低彩度，仍略偏冷）；素材少的页面不再整页薄荷色 |
| `--bg-sunk` | 浅 | `#def0ee` | `#e4eaea` | 同一低彩度，下沉面与页面底的区分保持 |
| `--surface` | 浅 | `#f9fdfc` | `#ffffff` | 面板与页面底的区分加大 |
| `--surface-2` | 浅 | `#f2f9f8` | `#f7f9f9` | 同上 |
| `--line` | 浅 | `#ccdfdc` | `#d3dcdc` | 白色面板上的分隔线对比由 1.35 升到 1.40 |
| `--action-bg` | 深 | `#86d9dc`（`--brand-primary`） | `#45aeb5` | 深色主题的主按钮低一档，不再是表单页最亮的东西；对 `--surface` 4.76:1 |
| `--action-bg-hover` | 深 | `#a0e3e5`（`--brand-hover`） | `#5cbcc2` | 悬停高一档 |

新增（Semantic / Role 层）：

| token | 浅 | 深 | 用途 |
|---|---|---|---|
| `--chrome-bg` | `#eaf6f5` | `#0c2023` | 外壳顶栏、副页签；等于调色前的 `--bg` |
| `--chrome-surface` | `#f9fdfc` | `#1a383d` | 左侧栏、手机底栏、顶栏搜索框；等于调色前的 `--surface` |
| `--chrome-sunk` | `#def0ee` | `#081619` | 外壳按钮的悬停底；等于调色前的 `--bg-sunk` |
| `--chrome-line` | `#ccdfdc` | `#2f5257` | 外壳的分隔线；等于调色前的 `--line` |
| `--action-bg-active` | `= --action-bg-hover` | `#3a9da4` | 主按钮按下（深色低一档）；Element Plus 的 active 改读它 |
| `--disabled-bg` / `--disabled-ink` / `--disabled-line` | `--bg-sunk` / `--ink-3` / `--line` | `#1f3d42` / `#6b8a8c` / `#2f5257` | 禁用的按钮（`.rw-btn:disabled`、`el-button.is-disabled`）。深色原来是近黑底加亮字，看起来像可用的深色按钮；现在是低对比的底与字（3.13:1，禁用文字不受 1.4.3 约束，检查设 2.5 的下限） |

分隔（亮度比，改前 → 改后）：面板对页面底 1.08 → 1.11，下沉面对页面底 1.07 → 1.10，分隔线对面板 1.35 → 1.40，分隔线对页面底 1.25 → 1.26。

不变：文字、链接、品牌、选中、焦点的 token（深色链接、选中、焦点环仍是 `#86d9dc`）；`--line-strong`；舞台面（`.stage` 里的 `--action-bg*` 仍取舞台的品牌值，`--action-bg-active` 与 `--disabled-*` 在舞台里按舞台值重新声明）。
外壳的框架（左侧栏、顶栏、副页签、手机底栏）改读 `--chrome-*`，所以浅色下框架保持青绿底色，内容区是中性底。

对比度（`contrast-check.mjs`，416 对全部通过）新增的配对：正文三档文字、链接、导航当前项在三种框架底上（≥ 4.5）；焦点环在框架底上（≥ 3）；`--action-ink` 在 `--action-bg-active` 上（≥ 4.5）；
`--action-bg` 对 `--surface` / `--bg` / `--surface-2`（≥ 3，深色 4.76 / 6.40 / 3.68）；禁用文字（≥ 2.5）。

证据（不提交）：主检出 `.claude/stage-artifacts/slice-g/colour/before/`、`after/`：拦截数据的成绩列表、登录后首页、同步、工单，真实的曲库、歌曲详情、登录页，各 1440 / 390 × 浅 / 深。
