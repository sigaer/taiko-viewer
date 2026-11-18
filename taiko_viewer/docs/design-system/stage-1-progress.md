# Stage 1 · 导航、搜索与曲库

2026-11-18，独立分支 `feature/viewer-rework-stage1`。依据已批准的 V1.3（冻结
`5f770a2ddd2df970454f85fda09fa73008120b66`）及 `06-migration-plan.md`；未合并、未部署。

当前完成 Keepalive 前置修复、导航/搜索首个页面集成切片，以及统一曲库与旧 URL 重定向
切片（见文末「统一曲库」），版本仍为 `1.15.0`（分支未发布，由负责人决定）。这不是整个
Stage 1 完成声明：曲库切片的隔离验收（Linux）尚未运行，歌曲详情与定数表尚未重做。

## 本轮实现

- 默认布局接入六组桌面导航、顶栏页签、五项手机导航及中央搜索按钮；使用当前
  业务 URL，保留中日文、主题、账号真实状态、页面宽度与沉浸/键盘行为。
  发帖页保留自己的吸顶头部，详情页不显示列表页签。预渲染页面首次挂载后
  重新读取真实会话，避免构建时的游客状态覆盖已登录账号入口。
- 搜索接入真实 `/api/content/songs`，160 ms 防抖、取消过期请求、最多展示 8 首；
  API 现有最小分页量为 12，展示层明确截断。页面动作使用现有路由。
- 原生 dialog 的模态焦点、combobox/listbox、方向键/Home/End/Enter、输入法保护、
  Esc 与触发点焦点归还、Ctrl/Cmd K 和非输入区 `/`、移动 visualViewport 适配。
  错误可重试；搜索结果跳转后聚焦主内容。
- `html.viewer-rework` 明确启用既有 V1.3 Token，DS 检查覆盖新组件；旧页面的
  Element Plus 映射未切换。Barlow 按需加载，中日文仍使用系统字体。
- 没有新增后端 API、模拟线上状态或修改年度报告代码。搜索别名排序、最近搜索、
  全部结果与统一曲库联动，以及同步/通知面板的完整形态尚未完成。

## Keepalive 与 Teleport

Keepalive 前置修复：NuxtPage 显式 prop 会优先于路由 meta，导致 `keepalive:false`
失效；改用 Nuxt app 默认配置，保留 PracticePlayerPage 排除与普通页面缓存。
隔离真实 Nuxt/Element Plus 浏览器 qa-3a0db8518560 证实修复前不缓存声明失效；
qa-9f98f83f8625 修复后 5 项通过：同布局状态保留、跨布局/head、无布局缓存页的
Teleport 卸载、显式禁止缓存、零生命周期异常。当前 Vue 3.5.43/Nuxt 3.21.11/
Element Plus 2.13.2 未复现历史 Windows nextSibling 异常，不能声称复现并修复了
相同框架异常；未改依赖或删除样张既有保护。测试不连接数据库、使用独立网络。
参考 Nuxt 本地 page.js 的 `props.keepalive ?? route.meta.keepalive` 优先级及
[Vue KeepAlive 生命周期](https://vuejs.org/guide/built-ins/keep-alive)。

## Linux 验证

| 验证 | 结果与证据 run |
| --- | --- |
| Keepalive/Teleport 最小真实 Nuxt 回归 | 5/5，`qa-9f98f83f8625` |
| DS 静态门禁与 Stage 1 契约 | 17/17，`qa-5d5fbe90bc70` |
| 标准 `npm run build`（含 Schema check） | 通过，`qa-27fa158bca03`；159.806 s，Nitro 入口完整，64.6 MB（gzip 23.3 MB） |
| 生产 Nitro 浏览器矩阵 | 20/20，`qa-5092f44ce964`；1440/1280/820/390/360 × zh/ja × light/dark |
| 搜索与导航 | 8 首真实 API 结果、键盘/IME、失败后实际重试、焦点归还/跳转、页签与横向溢出均通过 |
| 登录与发帖兼容 | 私有测试库真实 HTTPS POST 登录/GET 会话、Secure cookie、预渲染页账号入口、桌面/手机发帖头部通过 |
| 字体 B / FOUT | 2 个请求、44,984 bytes；阻塞字体时截图可读，加载前后顶栏/搜索入口/操作区最大尺寸变化 0 px |

构建使用现有 V2 build runner（Vault `qa-db288316b995/evidence/owner-cleanup/qa_vault.py`），
`development.slice/development-build.slice`，Node Heap 4096 MiB、cgroup 4/5 GiB；
0.2 s 实测 cgroup 峰值 4,263,477,248 bytes（3.97 GiB）、进程树 RSS 峰值
4,059,932 KiB，OOM/oom_kill 均为 0。固定 Schema 沿用 Phase 0 已验证文件，
Blob `d1661791fc49f9a2ddfc86da61621139359fcce3`，未改构建检查或年度代码。

浏览器通过仓库 `scripts/memory/run_qa.sh`（2/3 GiB，900 s）执行
`scripts/rework/shell-sql.mjs --allow-test-db-mutation --output=<隔离 Nitro .output>`，
外层 `unshare --net` 仅启用 loopback。沿用空库启动方式，实际验证
`SELECT DATABASE() = viewer1_security_test`、本次私有 datadir 和显式 opt-in；
合成账号/歌曲，不读取或写入生产数据。Chromium 单浏览器、单上下文串行运行；
这些宽度不是实机 iOS/Android 键盘验收。浏览器 runner 未采集峰值，不能把预算
上限当作实测峰值；结束记录确认子进程退出、私有 MySQL 退出、scratch 已回收。

中途失败如实保留：空数据库配置被启动隔离门禁拒绝（未进入页面）；页签测试
误用了 Playwright 不支持的 `current` 过滤器，已改成显式 `aria-current`；
`qa-7351827fab50` 发现预渲染页面仍显示游客入口，补上首次挂载会话刷新后由
`qa-5092f44ce964` 证实修复。PSI 超限时曾返回 `DEFERRED_RESOURCE_BUDGET`，
压力恢复后才继续，没有绕过 runner。已审视桌面/手机深色搜索与字体回退截图。

证据在 `/home/sigaer/taiko/qa-vault/runs/<run>/evidence/`；最终构建完整日志、
指标与实际构建源文件校验保留于 `qa-27fa158bca03/evidence/stage1-delivery/`。
回退：仅回退本轮外壳/搜索集成提交即可恢复旧布局，保留独立 Keepalive 修复
`233ea320`。不需要数据库迁移、服务重启或生产产物切换。

## 统一曲库（第二切片）

`/songs` 与 `/ja/songs` 合并三个旧列表；搜索面板加「查看全部 N 首结果」；旧地址由服务端 302
重定向。没有新增或修改 `server/api/**`、没有改 `server/services/content/songs.ts` 的查询逻辑，
没有新增接口，没有任何数据库访问，版本号未改。

### URL 契约（唯一来源 `utils/rework/catalog.ts`）

- 状态全部在查询里：`q`、`shelf`（`available` 默认 / `removed` / `other` / `all`）、
  `sort`（`open-day-desc` / `catalog`）、`page`（≥ 1 的整数）。非法值回到默认值，加载时不改写地址。
- **默认排序随上架状态变化，这是有意的**：`available` → `open-day-desc`，`removed` / `other` /
  `all` → `catalog`。这样保留了各旧页面的顺序（旧 `/songs/available` 新到旧，另两个按数据顺序，
  旧 `/songs` 重定向到 `available`）。`catalogState` 返回实际生效的排序。
- `catalog` 顺序就是 `getSongCatalog()` 读到的 `song_data.json` 文件顺序（服务端不排序），
  所以界面写作「曲库顺序 / 楽曲データ順」，不写成「按 ID」——本机看不到真实数据文件，
  无法确认它按 ID 排列。`open-day-desc` 写作「最新上架 / 新着順」。
- 规范写法 `catalogQuery(state)` / `catalogLocation(state, localePath)`：只写 q、shelf、sort、page
  四个键且顺序固定，省略默认值（`shelf=available`、`page=1`、空 `q`、等于该上架状态默认值的 `sort`）。
- 界面切换上架状态时保留当前看到的排序（与新状态默认值不同时显式写出）、保留 `q`、页码回到 1；
  改排序或关键词也回到第 1 页。关键词输入 300 ms 防抖后 `router.replace`，输入法组合期间不写；
  上架状态、排序、分页都是真实链接（SSR 输出里有 `href`，产生历史记录）。
- 请求经 `useViewerApiFetch` 到 `/api/content/songs`（`catalogRequest()`，每页 24）。首屏由服务端按地址
  渲染（`useLazyAsyncData`），之后的请求在组件内用 AbortController + 序号丢弃过期响应。
- 页面默认 keepalive：曲库只跟随自己路由（`/songs`、`/ja/songs`）且处于激活状态时的查询；
  从详情返回时状态不变，不重新请求，滚动由路由的 savedPosition 恢复。
- 搜索面板与曲库共用该模块：`songSearchRequest` 仍基于 `catalogRequest`；「查看全部」是
  `catalogLocation({ q, shelf: 'all' })`，因为 `all` 默认 `catalog`，顺序与面板一致。

### 曲库页面

- 结构按冻结的 `Songs.vue`：≥1100 左侧上架状态 / 排序两组、右侧搜索框 + 标题与结果概要 + 表格式行；
  768–1099 两组控件移到列表上方（分段样式）；<768 为列表行。1100–1239 隐藏上架日期列，
  768–1099 再隐藏分类与 BPM 列（与原型列优先级一致）。只有一套行与控件，媒体查询改变布局，
  每页挂载 24 行（上限 60）。与原型不同，桌面「表格」是带网格列的列表（`ul`），不是 `<table>`：
  同一套标记要在手机变成列表行；列名行对读屏隐藏，BPM、上架日期、上架状态在格内带隐藏标签，
  难度徽章自带完整名称。曲名链接的伪元素覆盖整行，整行可点。每页 24 首不需要虚拟滚动。
- 上架状态选项写作「实装 / 未上架 / 其他 / 全部」（日文「実装 / 未収録 / その他 / すべて」），
  与沿用的旧页面标题（实装歌曲 / 国行未上架歌曲 / 其他歌曲 / 全部歌曲）用同一套叫法。
  第一版写的是「上架 / 下架」，设计负责人复核时改掉：旧列表「国行未上架歌曲」包含从未上架的歌曲，
  「下架」不准确，而且选项与标题不该用两套词。
- 行内容只用列表 API 的真实字段：`DsSongCell`（曲绘、页面语言曲名、另一语言名作副标题，
  语言不同处标 `lang`，截断时 `title` 给全文）；分类取 `type`，标签沿用旧列表的中日映射，
  颜色只用已有的 `--genre-*` token；`level_1..5` 中存在的难度用 `DsDiff`（跳过缺失与「-」）；
  BPM；上架日期（`open_day` → `YYYY-MM-DD`）；`shelf=all` 时每行显示自己的上架状态文字。
- `DsDiff` 新增 `showConstant`（默认 `true`，现有用法不变）：曲库传 `false`，不显示「—」定数位，
  无障碍名称里也不读「无定数」——列表 API 没有定数，不放替身。
- 状态：首次加载 24 行骨架；重新请求时保留旧行并盖一层半透明底色、`aria-busy`；关键词无结果
  （清空关键词；非 `all` 时「在全部歌曲中搜索」）；该上架状态无歌曲；请求失败（文字 + 重试，
  重试发出同一请求）；页码超出最后一页（说明 + 回到第 1 页链接，不静默重定向）。
- 结果概要「共 N 首 · 第 x / y 页」用 `role=status` / `aria-live=polite`。分页在底部：≥820 px
  显示前后页与窗口化页码，以下显示前后页与「x / y」；`rel=prev/next`，触控目标 44 px。
  客户端翻页后滚到结果顶部并把焦点移到结果标题。
- 这几处链接用 `NuxtLink custom` 渲染 `<a>`：RouterLink 判断「当前页」时忽略查询，
  会把所有 `/songs?…` 链接都标成 `aria-current="page"`。
- 文案在 `locales/{zh,ja}.json` 的 `rework.library.*`、`rework.viewAll`、`page.songs.all`；
  `rework.catalog` 改为「歌曲列表 / 楽曲一覧」，删除不再使用的 `rework.removed` / `rework.other`。
- SEO：标题与描述沿用 `page.songs.{available,removed,other}`，新增 `page.songs.all`。
  canonical 保留 shelf / sort / page（`useViewerSeo` 新增可选 `query`），去掉 `q`；
  带关键词时 `robots: noindex, follow`。面包屑 JSON-LD 保留路径里的查询。

### 详情链接与返回

- 行链接 `/songs/:id`，当前上架状态为 `removed` / `other` 时加 `list=removed|other`，同旧列表。
- `composables/useLibraryReturn.ts`：曲库在客户端记住本标签页最后的曲库地址（内存 + sessionStorage），
  读取时校验为当前语言的 `/songs` 并重写成规范查询；挂载后才应用，SSR 与水合一致。
  没有记住的地址时回落：`list` / 上架状态 → `/songs?shelf=removed`、`/songs?shelf=other` 或 `/songs`。
- `[id].vue` 只改了 `songListPath`（新地址）、返回链接改用 `useLibraryReturn`、`navKey`；
  `layouts/default.vue` 的详情面包屑与手机返回按钮同样使用它。`ReworkShell` 的 `backPath`
  改为已本地化的 `backHref`（调用方唯一是 default 布局）。

### 旧地址

- `server/middleware/legacy-catalog.ts` 对直接请求返回真实 302 + `Location`；
  `middleware/legacy-catalog.global.ts` 让客户端导航落到同一地址。两者都只调用
  `legacyCatalogLocation`（单元测试覆盖）。本切片用 302，不用 301。
- `/songs/{available,removed,other}` → `/songs?shelf=<该状态>` + 原有全部查询（路径的状态优先于旧查询里的
  `shelf`）；`/songs/available` 不加 `sort`，仍是新到旧。`/songs/v2-constants` → `/songs/constants` + 全部查询。
  保留语言前缀，结尾斜杠同样处理。数字 id 的 `/songs/:id`（含 `list=` 等查询、中日文）与
  `/songs/constants` 不会被重定向。
- `pages/songs/v2-constants.vue` 移为 `pages/songs/constants.vue`，只改了自身路径、`navKey`、SEO 路径与面包屑。
- 删除 `pages/songs/available.vue`、`removed.vue`、`other.vue`、`components/SongListContent.vue`；
  `pages/songs/index.vue` 从重定向页改为曲库。`viewerPageRoutePatterns` 由 `pages/` 自动生成，随之变化。
- 内部链接改到新地址：`GuestHero`、`HomeLatestSongs`、外壳曲库页签（去掉下架 / 其他页签，定数表指向
  `/songs/constants`）、默认布局、详情页、站点地图（`/songs`、`/songs?shelf=removed`、`/songs/constants`，
  `<loc>` 保留查询）、`scripts/performance/{audit,route-assets}.mjs`。
- `components/SidebarNav.vue`、`components/MobileTabBar.vue` 已无任何引用（外壳替代了它们），未改动。

### 其他改动

- `components/rework/Brand.vue`：12 个刻度点坐标改为保留 3 位小数。原来用 `Math.sin/cos` 的完整浮点结果，
  本机 Node 与 Chrome 的最后一位不同，导致每个页面都有一次水合属性不一致警告。
- `scripts/ds/check-scoped-css.mjs`：`components/rework` 加入必须干净的目录（之前只出报告）。
- `tests/songShelvesHttp.test.mjs` 最后一条断言从已删除的 `SongListContent.vue` 改为检查曲库组件的空态。
- `docs/design-system/viewer-token-mapping.md` 重新生成（删除旧列表后，旧 token 的读取计数减少）。
- `utils/rework/catalog.ts` 的分类映射以 API 的中文分类值为键（无引号的对象键）。这是数据值不是界面文案；
  `check-ds-copy` 只检查带引号的字符串，所以不报。界面标签在 `rework.library.genre.*`。

### 契约缺口（真实数据能力未接入，界面不放替身）

- 列表 API 不返回、因此没有显示或提供：定数、个人王冠 / 成绩 / 进度与「我的进度」筛选、
  分类 / 星级 / 难度筛选、按星级 / 定数 / BPM / 曲名排序、别名显示、各上架状态的数量。
- 搜索：别名、艺术家、谱面配置搜索不受支持（API 只匹配曲名、日文名、分类及其别名、id）；
  没有相关度排序（结果按 `catalog` / `open-day-desc`）。
- 搜索面板仍受服务端最小分页 12 限制，前端截断为 8 首。

### 验证（分层，互不替代）

**隔离验收（Linux）尚未运行。** 下面除注明「真实」外都只是本机开发自检，不能当作验收。

| 层级 | 内容 | 结果 |
| --- | --- | --- |
| 静态 / 单元（真实） | `npm run test:ds` | 88/88（含新增的 `DsDiff showConstant` 用例） |
| 静态 / 单元（真实） | `npm run check:ds`（components/rework 现为 scoped-CSS 必须干净目录） | 通过；ds usage 0 findings，ds copy 通过，scoped CSS 设计系统目录 0 处 |
| 静态 / 单元（真实） | `npm run test:version` | 1/1 |
| 静态 / 单元（真实） | `tests/reworkStage1.test.mjs` | 14/14：分上架状态的默认排序、规范写法与往返、切换上架状态保留排序、四个旧路径 × 中日 × 结尾斜杠 × 查询、数字 id 与 `/songs/constants` 不匹配、全部结果地址、分页窗口、额外选项的键盘选择、返回目标校验 |
| 静态 / 单元（真实） | `tests/songShelvesHttp.test.mjs`（真实 H3 处理器 + 合成文件，本机用临时 QA 目录变量运行） | 1/1 |
| 本机真实 HTTP（`nuxt dev`，无 stub） | 旧地址 302 + `Location`：48 个（中日 × 4 路径 × 有无结尾斜杠 × 3 种查询）；不得重定向：9 个（`/songs/1`、带 `list=`、`/ja/songs/2?…`、`/songs/1/`、`/songs/constants`、`/ja/songs/constants`、`/songs`、`/ja/songs`、带查询的 `/songs`） | 57/57 |
| 本机真实 SSR（`nuxt dev`，无 stub） | 数据文件不可读时 `/songs`：服务端渲染出错误态（`role=alert`、无行），浏览器水合 0 警告 0 错误，恢复后「重试」得到第 1 页 | 通过 |
| 本机开发自检：真实 dev API + 合成数据文件 | 宽度 360/390/820/1440 × 浅/深 × 中/日 共 16 组：SSR 曲名 = 水合后曲名、0 水合警告、0 控制台错误、无横向溢出、挂载行 ≤ 60、`aria-current`、概要文字、canonical；分页（rel、焦点到结果标题、滚到结果顶部、最后一页、过期响应不覆盖、超出最后一页）；上架状态 / 排序链接与默认排序、前进后退、分享地址与刷新、非法值不改写地址；关键词防抖 + replace、输入法组合期间不写、无结果、`shelf=all` 带关键词；请求失败与重试（失败由拦截浏览器请求注入）；搜索面板 → 全部结果（1440 / 390）；列表 → 详情 → 返回（筛选、滚动、不重新请求）、keepalive 不响应 `/about` 的查询、详情页自己的返回链接；旧链接（直接请求与客户端导航） | 24/24（最终一次运行；中途运行记录见下） |
| 指示性计时（dev 服务器，非生产） | 筛选 / 排序 ≤ 100 ms、路由切换 ≤ 200 ms、无 > 200 ms 长任务 | 筛选 / 排序 159、90 ms；路由切换 190、173、238 ms；最长任务 132 ms（前一次运行为 160、112 / 178、172、243 / 203 ms）。首个筛选与一次路由切换超出预算，开发模式（未压缩、按需编译）下只作参考，不作结论 |
| 未验证 | 生产 Nitro 产物、Linux 浏览器、真实曲库数据规模、真机触控 / 软键盘、读屏实际播报、Lighthouse | — |

本机自检的数据来源说明：曲库 API 读取 JSON 文件（`getSongCatalog()` → `TAIKO_SONG_DATA_PATH`），不读数据库，
所以本机 `nuxt dev` 可以用合成文件跑真实 API；SSR 也走真实接口。截图文件名前缀 `stubbed-data-selfcheck_`
（合成数据）与 `real-ssr-selfcheck_`。`--stub` 模式另把浏览器的 `/api/content/songs` 请求交给
`serveCatalog()`（服务端语义的移植），文件名前缀 `stubbed-http-selfcheck_`，证据在 `catalog/stub/`：同样 HTTP 57/57、SSR 失败检查通过、场景 24/24
（拦截使路由切换计时变慢：228、457、347 ms，不作参考）。两种模式断言的期望值都来自 `serveCatalog()`，
真实接口模式下全部吻合，说明移植的过滤 / 排序 / 分页语义与服务端一致（仅限这份合成数据）。

本机自检：`node scripts/rework/catalog-selfcheck.mjs --port=3561 --out=<目录> [--stub]`。开发服务器只听
127.0.0.1，`TAIKO_DB_HOST` / `METHOD_CALLS_DB_HOST=invalid.invalid`，`NODE_OPTIONS` 预加载
`scripts/ds/no-egress.mjs`；浏览器为系统 Chrome，一个浏览器、同时最多两个页面（实际一个），非本机源的请求一律中止；
总时限 25 分钟；结束时结束 dev 服务器进程树、关闭浏览器并确认端口空闲。运行前按 Stage 0 的做法把
`vendor/tja*` 按 LF 写回并运行 `prepare_tja_runtime.mjs`，之后 `git checkout -- vendor/` 恢复。
证据（不提交）：`.claude/stage1-artifacts/catalog/`（`stubbed-data-selfcheck.json`、截图、`nuxt-dev.log`）；
`earlier-runs/run1–run3` 保留了之前几次运行（第一次的失败见下）。

第一次运行如实记录：HTTP 57/57，但浏览器场景 0/25、SSR 失败检查未过。原因：①`ReworkBrand` 用
`Math.sin/cos` 的完整浮点值作 SVG 坐标，本机 Node 与 Chrome 末位不同，每页一次水合属性不一致（已改为 3 位小数）；
②RouterLink 忽略查询判断「当前页」，所有 `/songs?…` 链接都带 `aria-current="page"`（改用 `NuxtLink custom`）；
③脚本问题：vue-router 把查询里的空格写成 `+`、fetch 客户端会对 503 自动重试一次、DevTools 浮标遮住手机中央按钮（已修脚本）。

### Linux 隔离验收（尚未运行）

沿用 `shell-sql.mjs` 的全部安全约定（`scripts/memory/run_qa.sh`、vault 持久路径、私有空 MySQL、
`SELECT DATABASE()` 必须以 `_test` 结尾、显式 `--allow-test-db-mutation`、外层仅 loopback 网络、生产 Nitro 产物、
一个浏览器、`finally` 全部关闭）。`shell-sql.mjs` 新增 `--check=catalog`，改为运行 `catalog-check.mjs`；
后者写入同一份合成曲库（`catalog-scenarios.mjs` 的 `buildDataset()`：实装 60、未上架 50、其他 30，中日曲名，
`Lantern` 在各状态都有匹配，`zzqx-none` 无匹配，发售日打乱使两种排序不同），用生产 Nitro 运行同一组场景。

先按 Stage 1 第一切片的方式用 V2 build runner 得到隔离的 Nitro 产物，再在与 `qa-5092f44ce964` 相同的
`unshare --net`（仅 loopback）包装与预算下运行：

```
bash scripts/memory/run_qa.sh /usr/bin/node \
  /home/sigaer/taiko/taiko-forum/taiko_viewer/scripts/rework/shell-sql.mjs \
  --allow-test-db-mutation --output=<隔离 Nitro .output，/var/tmp/ 下> --check=catalog
```

（`node` 与 Nitro 产物路径按 `qa-5092f44ce964` 的实际值替换。）通过标准：`shell-sql.mjs` 标准输出有
`SELECT DATABASE(): viewer1_security_test`、结果 `PASS`；evidence 下 `catalog-result.json`：
`http` 57 项全部通过（302 + 精确 `Location`，不得重定向的 9 项无 `Location`）；`ssrFailure.pass = true`；
场景 24/24（无 `error`、`faults` 为空）；计时与预算对比（筛选 / 排序 ≤ 100 ms、路由切换 ≤ 200 ms、
最长任务 ≤ 200 ms）；截图 `acceptance_*.png`；私有 MySQL 与 Nitro 退出、scratch 回收。

### 设计负责人复核（2026-11-18）

复核方式：读 `utils/rework/catalog.ts`、两个重定向中间件、详情页 / 布局 / SEO / 站点地图的改动；
重跑 `npm run test:ds`（88/88）、`tests/reworkStage1.test.mjs`（14/14）、`npm run test:version`（1/1）、
`npm run check:ds`（通过）；看截图：曲库 1440 浅色、390 深色、日文 390、`shelf=all` 带关键词、无结果、
最后一页、服务端渲染的失败态、搜索面板 390 的「查看全部」。其余截图没有逐张看。
`tests/songShelvesHttp.test.mjs` 不带 QA 目录变量时在本机按设计拒绝运行，我没有重跑它。

- 布局、间距、控件与冻结的 `Songs.vue` 一致；只用了列表接口真实返回的字段，没有替身控件。
- 接受：桌面用带网格列的列表而不是 `<table>`；`catalog` 排序写作「曲库顺序 / 楽曲データ順」；
  `DsDiff` 的 `showConstant`；`Brand.vue` 的坐标取整；`useViewerSeo` 的 `query` / `robots`。
- 复核时改了两处，改动只经过上面的单元测试与静态检查，**没有重跑浏览器自检**：
  - 上架状态选项的中文叫法（见「曲库页面」）。
  - 搜索面板的「N 个结果」原来把「查看全部」这一项也算进去（8 首歌显示成 9 个结果），改为不计入。
- 计时：开发服务器上首个筛选 159 ms、一次路由切换 238 ms，超出预算（100 / 200 ms）。
  开发模式的数字不作结论，但也不能当作达标；以 Linux 上生产产物的实测为准，超出再处理。
- 版本号保持 1.15.0：分支尚未发布，这个版本号已经覆盖整个 Stage 1 相对 `main` 的范围。
- 结论：实现完成，本机自检通过；**隔离验收未运行**，本切片不能记为验收通过。
