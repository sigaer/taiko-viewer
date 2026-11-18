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

## 切片 A：页面基础件、歌曲详情、定数表

2026-11-18，同一分支，未提交、未合并、未部署，版本仍为 `1.15.0`。没有改 `server/api/**`、没有新增接口、没有数据库访问。
**隔离验收（Linux）尚未运行**；下面除注明「真实」外都是本机开发自检。

### 基础件

- **Element Plus 映射开关**：路由 meta `reworkElementPlus: true` → `components/rework/Shell.vue` 用 `useHead` 在 `<html>`
  上加 `rework-ep`（SSR 首屏即有；当前路由没有这个 meta 时去掉，keepalive 的页面也一样）。`element-plus.css` 的每条规则
  在 `html.ds-preview:root` 与 `html.rework-ep:root` 下各列一遍（特异度不变）；Shell 现在导入 `element-plus.css` 与新的
  `rework.css`。`check-tokens.mjs` 新增 `elementPlusScopeProblems`：只允许这两个作用域，且两组选择器必须完全一致
  （`dsChecks.test.mjs` 有正反例）。本切片打开开关的页面：`/songs/:id`、`/songs/constants`。规则写进了 playbook §3。
  常驻弹层：`el-select` 用 `:persistent="false"`，对话框只在打开期间挂载、页面停用时卸载。
- `components/rework/`：`PageHeader`（页面自己的 `<h1>`，lead / eyebrow / actions 插槽；页面同时设 `hidePageHeader: true`，
  默认布局的 `.page-header` 对旧页面不变）、`Panel`（带标题区块，`plain` 无底面，h2/h3）、`State`（loading 骨架、empty、
  failed + 重试，`role=status` / `role=alert`）、`Gate`（`need = login | binding | null`；`variant = block | row`，row 为一行文字加操作、无卡片与标题；登录带 `redirect`、可选注册；绑定去
  `/account/profile`，与 `AccountToolGate`、`/account/songs` 绑定提示的去向相同）、`Pager` 加按钮模式（没有 `href` 时发
  `select`；曲库仍用链接模式）。`assets/css/ds/rework.css`（`html.viewer-rework` 下）：`.num`、`.rw-btn`（默认 / `--primary`
  / `--ghost` / `--sm`，≥44 px）、`.rw-link`、`.rw-vh`。注意 `.num` 现在对所有外壳页面生效，曲库里 `DsDiff` 的星级数字因此
  用 Barlow Condensed（样张页本来就是这样）。
- `Library.vue` 的四种状态改用 `ReworkState`（小改动：保留 `lib-state` 类、文案与按钮；曲库场景只把 SSR 失败断言的正则
  放宽为允许多个 class）。`AccountToolGate` 未替换（它的页面属于切片 B）。没有加样张页。
- DS 组件加属性：`DsRank` 的 `named`（default / detail 尺寸旁显示评价名称，图对读屏隐藏；`dsRank.test` 新增用例）；
  `DsDiffTabs` 的 `controls`（tab 的 `id` / `aria-controls`，面板用 `aria-labelledby`）。
- 两个页面的呈现在 `components/rework/song/*`、`components/rework/constants/*`，页面文件只留取数、SEO、状态
  （`check-token-collisions` 不允许 `pages/` 直接读 DS token）。文案在 `rework.state / gate / songDetail / constantsTable`
  （`rework.song`、`rework.constants` 已是导航文案，所以没用这两个名字）。

### 歌曲详情 `/songs/:id`：功能对照（改前 → 改后）

| 改前 | 改后 |
| --- | --- |
| SSR 取歌曲详情、谱面 UGC 公共摘要；客户端取个人成绩、UGC 个人状态；旧 id 301 到规范 id | 不变（`useSongDetail` 见「改动的数据代码」） |
| `shelf_status=1` 且没有 `list=removed/available` 时 replace 加 `list=removed` | 不变（只在本实例自己的地址上执行） |
| `?difficulty=` 读入选中难度（加载与地址变化），切换不写地址；无里谱回落魔王；只列存在的难度 | 不变；没有新增地址状态 |
| 加载 el-skeleton；不存在或失败：el-result + 返回列表 | 加载：保持版面的骨架；**不存在**（`song: null`）与**失败**分开，失败 `role=alert` + 重试 + 返回列表 |
| 返回列表（≤960 隐藏），去向 `useLibraryReturn`；外壳栏的返回键（默认布局，同样 `useLibraryReturn`）在所有宽度都显示 | 页内链接删除，只留外壳栏返回键（设计复核：两个返回入口留一个）。差别：外壳的回落只看 `list=`，没有记住的曲库地址、又没有 `list=` 的「其他」歌曲回到 `/songs`（页内链接原来按歌曲上架状态回到 `?shelf=other`）；未上架歌曲页面会自动加 `list=removed`，不受影响 |
| 曲绘 `SongCoverImage`（含回落图；SEO 图回落 1384） | `DsCover`（同曲缩略图 → 原图 → 占位）；SEO 图逻辑不变 |
| 分类、主标题（末尾「(…)」不断行）、另一语言名、BPM / ID / 发布日期；折叠的「歌曲资料」：副标题、实装版本、作曲/演唱 | 全在页头：分类（`--genre-*` 圆点）、上架状态、版本标签、标题、另一语言名（`lang`）、作曲/演唱、BPM、上架日（YYYY-MM-DD）、ID、副标题；缺失为「—」 |
| 难度页签（左右 / Home / End）带星级 | `DsDiffTabs`：图标、名称、星级（随单人/P1/P2）、V2 主定数（困难/魔王/里，其余「—」） |
| 单人 / P1 / P2（有 P1/P2 谱时） | 不变，在「谱面」区标题右侧 |
| 单曲 RT 计算器链接 | 不变，在「谱面数据」区标题右侧 |
| 谱面：难度 + 星级、最大物量（目录 → rating；P1/P2 为「—」）、练习播放器（有 TJA 包，新标签页）、完整谱面 ↗、节选展开/收起、加载/失败、点图开新页 | 全部保留 |
| 下载 TJA+OGG（有包时） | 保留（谱面区操作行） |
| 试听（折叠）：鼓点（分歧变体或基础）+ 静音 + 音量、混音、纯音乐、各自的音源错误 | 保留（`AudioPreview`） |
| 「谱面特征与分析」折叠：V2 定数卡（仅困难/魔王/里；加载；失败重试；75/主/99 + 五项 + 物量；OurTaiko 来源；无数据） | 不再折叠（`05` §3 的依据）：区块开头是主定数（最大）与 75% / 99% / 物量一行；下面一行两个雷达（五项能力 + 六维），≥1100 并排、以下上下排，各带说明行（五项：来源链接；六维：范围与层级）；状态与来源链接保留 |
| 六维雷达（非「其他」或有数据时；范围、层级、数值列表；无数据文案） | 同条件，`DsRadar`（数值标在轴旁，代替单独数值列表），与五项雷达同一行 |
| 我的成绩（登录）：骨架、空、「绑定 ID 无成绩」、分数、王冠文字、良/可/不可、明细（连击、连打、次数、更新日）、「全部成绩 →」 | `MyScore`：`DsCrown` 全名文字（P1）、`DsRank` + 名称、分数、`DsJudgeBar`、连击 / 连打 / 次数 / 最好成绩日、「全部成绩 →」；状态同前。**新增**：其他有成绩的难度一行一条（短名王冠、评价、分数），点击切到那个难度 |
| 未登录：「我的成绩」+ 登录（回到本页本难度） | `ReworkGate`（登录链接，同一 `redirect`）：≥1100 右栏卡片；<1100 不显示右栏，改为谱面区之后的一行（`variant="row"`，无卡片标题与难度徽章），访客在手机上先看到歌曲内容 |
| 推荐目标（登录、`?recommendation=`、所选难度等于 `?difficulty=`） | 不变，在成绩面板内 |
| 谱面讨论（3 条、全部、发帖、空态） | 不变（`ForumSongRelatedDiscussions`；song-detail 外观的标题改为 h2，两处行内中日文案迁到 `rework.songDetail.discussions.*`；DS 外观由 `rework/song/Discussions.vue` 覆盖） |
| 玩家谱面体验：体感分布与投票（单选组、方向键、清除、保存中、不可用、错误）、标签（公共列表、编辑、5 个上限、停用标签、完成）、提示（列表、有帮助、举报与原因、写/改/删、隐藏状态、字数） | 全部保留（`ChartUgc`，脚本未改；选中用 `--vote-on*`，头像 `DsPlayerAvatar`） |
| SEO（标题、描述、canonical、图、关键词、面包屑） | 不变 |

### 定数表 `/songs/constants`：功能对照

| 改前 | 改后 |
| --- | --- |
| SSR 取 `/api/content/v2-constants`（keyword / difficulty / page / pageSize / sortBy / sortOrder），参数变化重取；没有地址参数 | 不变（取数与状态留在页面；没有新增地址状态） |
| 标题、说明段、「共 N 条」、生成时间（原样的 ISO 字符串） | 页头 `<h1>`、「共 N 条」（`role=status`）、生成时间：`<time datetime>`，服务端与水合时为固定的「YYYY-MM-DD HH:mm UTC」，挂载后改为页面语言、访问者时区的日期与时分（水合 0 警告）；说明段删去（实现说明「按本地曲库匹配远端…」，AGENTS 文案规则；SEO 描述不变） |
| 关键词（300 ms 防抖，回第 1 页）、难度下拉 | 搜索框；难度改为分段按钮（`aria-pressed`，带难度图标）；**新增**「清除筛选」 |
| 远端过期 / 部分数据提示 | 保留 |
| 失败 el-empty + 重试；空：表格空文案 | `ReworkState` failed + 重试；空 + 清除筛选 |
| el-table：ID、歌曲名（宽屏固定列）、难度、物量、75/95/99、五项；全部列服务端排序，默认 ID 升序，排序回第 1 页 | 自绘 `<table>`：歌曲（`DsSongCell`）、ID、难度（`DsDiff`）、95%（主）、75%、99%、物量、五项（数值 + 细条）；表头按钮 + `aria-sort`；新列：ID / 曲名 / 难度先升序，数值先降序，同列再点反向。≥1240 全列；1100–1239 去 75/99；768–1099 再去五项；<768 列表行 + 排序下拉与方向键，行内显示当前排序值 |
| 分页：总数、每页 25/50/100、上下页、页码、跳页 | `ReworkPager`（按钮模式）、每页条数（`el-select`，Teleport）、跳至第 N 页 |
| 没有到歌曲详情的链接 | **新增**检视：≥1240 右栏，以下为 `el-dialog`；雷达、75/95/99 刻度、物量与五项；「打开歌曲」（`/songs/:id?difficulty=N`）、「用 RT 计算器」 |
| SEO、面包屑 | 不变 |

### 与原型的偏离与原因

- 详情：曲绘 112 / 72 px（原型 V2 的压缩头部）；页头不放「游玩练习 / 收藏」：练习播放器按难度给出，放在谱面区；收藏没有接口。
  手机没有底部操作条（「想练这首」没有接口，练习入口在谱面区）。<1100 单栏、成绩面板在前（访客在 <1100 时没有这一栏，见上表；原型 768–1239 保留 300 px 侧栏，
  主栏只剩约 350 px，谱面节选太窄）；DOM 中成绩面板在主栏之前，所以宽屏焦点顺序是 页签 → 成绩 → 谱面。页面不再有自己的返回链接（外壳栏返回键）。分析内容不再折叠。
  六维雷达是生产已有的数据，原型没有，放在谱面数据区下部。页签上不显示王冠（`DsDiffTabs` 没有这个形态，由成绩面板「其他难度」代替）。
- 定数表：难度只能单选（API 只接受一个）；没有定数区间、「只看没全连」、CSV 导出（页面可用的接口都没有）。默认排序保持 ID 升序
  （原型主定数降序；保持现有行为）。难度徽章没有星级（V2 行无星级）。曲名是 `song_name`（中文名），日文页面也是，已标 `lang="zh-CN"`。
- 共同：品牌青绿只用于主操作、链接、选中、焦点；分布条与能力细条 `--series-alt`；投票选中 `--vote-on*`。

### 契约缺口（生产没有，界面不放替身）

- 详情：每小节音符密度（`DensityStrip`）、小节定位 `m`、分歧谱面图（图只有单人 / P1 / P2）、连打时间与气球数、别名、收藏、
  准确率、单曲 RT、最好成绩变化曲线、「设为这次想练」（只有带推荐 token 时的目标动作）、讨论的帖子类型 / 作者。
- 定数表：星级、日文曲名、别名 / 艺术家搜索、定数区间筛选、个人王冠与评价列、CSV 导出、无定数谱面数量。

### 改动的数据代码（请重点复核）

- `composables/useSongDetail.ts`：`useViewerApiFetch()` 提到 setup 中调用。原来在 handler 内调用，`refresh()`（新的「失败 → 重试」）
  在 setup 之外执行时取不到 i18n，重试什么都不发。请求与 key 不变。
- `pages/songs/[id].vue`：歌曲 id 固定为本实例的 id（页面 key 本来就含 id），`?difficulty=` 与 `list=removed` 的 watcher 只在地址是
  本实例自己的歌曲时执行（playbook §4「只响应自己路由的变化」）。原来 keepalive 的旧详情实例会跟着新地址的 id 取数（同 key
  双份请求），共享 key 时重试失效。V2 定数请求从 `SongV2Constants.vue` 移到页面（同一地址与 key），页签要用。
- `pages/songs/constants.vue`：关键词回到当前已生效的值时不再起防抖计时器（否则「清除筛选」后计时器会把翻好的页码改回 1）。
- 移入 `components/rework/song/` 并重写呈现、原文件删除：`components/ChartUgcSection.vue`、`components/SongV2Constants.vue`、
  `components/song/SongAudioPreview.vue`、`SongChartPreview.vue`；`SongDifficultyTabs.vue` 删除（`DsDiffTabs` 代替）。
  `components/account/AccountSongScores.vue` 已无引用，但 `dsUtils.test.ts` 读它的源码核对王冠顺序，未删，留给切片 G。

### 验证

| 层级 | 内容 | 结果 |
| --- | --- | --- |
| 静态 / 单元（真实） | `npm run test:ds` | 90/90（新增 Element Plus 作用域正反例、`DsRank named`） |
| 静态 / 单元（真实） | `npm run check:ds` | 通过：tokens + EP 两作用域一致；collisions 无新增；对比度 368/368；token 对照表已重新生成；scoped CSS 设计系统目录 0；ds usage 80 文件 0；ds copy 76 文件 |
| 静态 / 单元（真实） | `npm run test:version`、`tests/reworkStage1.test.mjs` | 1/1、14/14 |
| 静态（真实） | `detail-fixtures.ts` 用 tsc strict 按真实响应类型检查 | 该文件 0 错误（它导入的 composable 因在 Nuxt tsconfig 之外有自动导入全局名报错，与 fixture 无关） |
| 本机真实 HTTP / SSR（`nuxt dev` + 合成文件） | 详情、V2、谱面图（image/png）、TJA 包（application/zip）、定数列表都走真实接口；`/songs/99` → 301 `/songs/100`；歌曲文件损坏时 SSR 渲染失败态、水合 0 警告、恢复后重试成功 | 通过 |
| 本机开发自检（合成文件 + 真实接口） | 详情 16 组（360/390/820/1440 × 浅深 × 中日：SSR h1 = 水合 h1、服务端 HTML 有 `rework-ep`、页签与默认魔王、页签定数、无横向溢出、谱面图加载；访客：≥1100 右栏卡片、<1100 谱面区之后的一行且顺序为 谱面 → 提示 → 数据；两个雷达 ≥1100 同一行、以下上下排）；难度切换（点击、End/Home/←、`?difficulty=5`、无里回落、不写地址）；功能清单逐项；单人/P1/P2、未上架加 `list=removed`、其他无六维、长标题缺字段 360 无溢出；不存在、失败 → 重试中骨架 → 内容；焦点顺序（唯一 tab stop → 登录 → 单人/P1/P2 → 完整谱面 → 展开 → 节选区 → 试听 → RT → 来源 → 讨论，每站有焦点样式）；曲库 → 详情 → 返回（不重新请求）；EP 开关；定数表 16 组（含生成时间：服务端 HTML 为固定 UTC 文本，挂载后为本地时分）+ 功能（筛选、排序、关键词、清除、翻页、跳页、每页条数、检视链接、空、失败重试、过期提示）+ 手机（排序下拉、方向、对话框） | 44/44 + SSR 失败 1/1（`slice-a-selfcheck.json`） |
| 拦截数据的自检（intercepted） | 登录态：服务端渲染游客后，把应用已有的账号状态设为 fixture 用户（与登录写入的状态相同），再客户端导航；成绩面板（王冠全名、评价名称、分数、判定条、明细、其他难度切换）、推荐目标只在请求的难度出现、UGC（投票 PUT、有帮助 PUT、标签编辑器）、相关讨论 2 条；1440 中浅 / 390 中深 / 390 日浅。定数接口失败与过期提示也是拦截 | 通过（含在 44 内） |
| EP 开关（820） | /about 无 `rework-ep` → 定数表有（`--el-color-primary` 为品牌色；探针 `.el-message`、`.el-popper.is-dark`、`.el-select-dropdown` 计算样式改变）；真实 Teleport：每页条数下拉背景 = 映射后的浮层色，检视对话框已映射；离开到 /about：类去掉、样式回到基线、`<body>` 弹层节点与基线相同；keepalive 返回恢复；定数 → 详情保持；→ 曲库去掉 | 通过 |
| 曲库回归（共享文件改动） | `catalog-selfcheck.mjs`（改用共享运行器） | HTTP 57/57、SSR 失败通过、场景 24/24 |
| 指示性计时（dev） | 页签切换 101 ms；路由切换 43 ms；筛选 / 排序 129、142 ms；最长任务 176 ms（设计复核修改后的运行） | 筛选 / 排序超 100 ms 预算；开发模式只作参考 |
| 未验证 | 生产 Nitro、Linux 浏览器、真实数据规模、真实数据库与登录、真机触控、读屏播报、音频实际播放（静态资源域名被拦） | — |

运行：`node scripts/rework/detail-selfcheck.mjs --port=3571 --out=<目录> [--only=<场景前缀,…>]`；曲库
`node scripts/rework/catalog-selfcheck.mjs --port=3561 --out=<目录>`。两者共用 `scripts/rework/selfcheck-runner.mjs`
（127.0.0.1、`TAIKO_DB_HOST=invalid.invalid`、`no-egress.mjs` 预加载、一个系统 Chrome、同时一个页面、总时限、`finally`
结束进程树并确认端口空闲）。本次没有改 `vendor/`（`.tja-runtime` 已存在，运行器直接启动 `nuxi dev`）。
证据（不提交）：主检出 `.claude/stage-artifacts/slice-a/`（`slice-a-selfcheck.json`、截图、`console.txt`、`nuxt-dev.log`；
`catalog-rerun/`；`dialog-rerun/` 是等对话框动画结束后重拍的两张对话框截图，主目录里同名两张拍在动画中途）。目录里两张
`FAILED-*.png` 来自修正场景脚本之前的一次运行（SSR 失败检查改动了歌曲文件时间使 TJA 索引失效——已移到最后；返回曲库后
未等行渲染——已加等待），最终运行没有失败。

### 设计复核后的修改（2026-11-18）

1. 未登录、<1100：「我的成绩」卡片不再排在谱面之前；改为谱面区之后的一行（`ReworkGate` 新增 `variant="row"`，文案与操作仍来自 Gate），
   右栏 <1100 不显示（`DetailFrame` 的 `sideNarrow`）。登录后与桌面右栏不变。
2. 「谱面数据」：主定数与三个数字作为开头一行，两个雷达 ≥1100 并排、各带说明行，以下上下排；显示的数据不变。
3. 页内「返回列表」删除，只留外壳栏返回键（同为 `useLibraryReturn`）；回落差别见功能对照。场景脚本（含曲库的详情返回）改用 `.rework-bar a.back`。
4. 定数表生成时间改为 `<time datetime>`，SSR / 水合固定 UTC 文本，挂载后本地时分。

重新运行：切片 A 44/44 + SSR 失败 1/1；曲库 HTTP 57/57、SSR 失败通过、24/24；`test:ds` 90/90、`check:ds` 通过、`test:version` 1/1、
`reworkStage1` 14/14。替换的截图：`detail-zh-1440-light`（未登录）、`detail-signed-in-intercepted-zh-1440-light`、`detail-zh-390-dark`
（整页；访客一行在整页截图里被固定的底部导航盖住，位置与可见性由场景断言）、`constants-zh-1440-light`。

### Linux 隔离验收（尚未运行）

在 `shell-sql.mjs` 加 `--check=detail`（照 `--check=catalog`），新建 `detail-check.mjs`：在 scratch 写入 `detail-data.mjs` 的
`writeDetailFiles()`（歌曲、rating、分歧音源清单、谱面图、TJA 包与索引缓存、V2 快照；`TAIKO_REPO_ROOT` / `TAIKO_VIEWER_CACHE_DIR`
指向 scratch），用生产 Nitro 运行 `runDetailScenarios()`，最后 `detailSsrFailureCheck()`。私有测试库可用时，登录态改为真实测试账号
（`SELECT DATABASE()` 以 `_test` 结尾 + `--allow-test-db-mutation`，写入合成成绩与 UGC）代替拦截；做不到时保留拦截并标明。
通过标准：场景全部通过、SSR 失败 `pass`、截图 `acceptance_*`、计时与预算对比、私有 MySQL / Nitro 退出、scratch 回收。
`detail-check.mjs` 与 `--check=detail` 本切片没有写。
