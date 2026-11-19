# Stage 3 · 社区

依据：`rework-playbook.md`、Design V1.3 Final（冻结 `5f770a2`，原型 `preview/redesign-v1/`）。分支 `feature/viewer-rework-stage3`。

## 切片 D：社区（论坛）

2026-11-18，基于 `f493816`，未提交、未合并、未部署，版本仍为 `1.15.0`。没有改 `server/api/**`、没有新增接口、没有数据库访问；
`/api/forum/*` 的请求与响应、Flutter 应用不受影响。**隔离验收（Linux）尚未运行**；下面除注明「真实」外都是本机开发自检：
论坛的读写与登录态全部来自拦截的请求，没有任何帖子、回复、点赞、通知或站务状态在任何服务器上被创建、修改或删除。

### 做了什么

- **页面**（地址不变）：`/forum`、`/forum/section/:slug`、`/forum/discussions`、`/forum/thread/:id`、`/forum/new`、`/forum/me`、`/forum/notifications`。
  七个页面都设 `reworkElementPlus: true`；除发帖页（保留 `composerHeader` 自带的吸顶栏）外都设 `hidePageHeader: true`，页面自己的 `<h1>`。
  列表、帖子、通知、我的社区改为 `contentLayout: "wide"`（帖子页内部阅读栏 ≤ 760 px），发帖页保持 `reading`。
- **呈现组件** `components/rework/community/*`（自动注册为 `ReworkCommunity*`）：`Author`（身份）、`ThreadRow`（帖子行）、`ThreadList`（列表与状态）、
  `Columns` / `Boards` / `HomeSide` / `ChartActivity`（社区广场与列表的框架、版块、侧栏）、`ListPage`（版块与全部讨论，脚本从 `components/forum/ThreadListPage.vue` 原样搬来）、
  `ThreadLayout` / `ThreadHead` / `ChartCard` / `Blocks` / `ThreadActions` / `Replies` / `Floor` / `ReplyBox`（帖子页）、`ComposerBar` / `ComposerImages` / `SongPicker`（发帖）、
  `MeHead` / `Moderation`（我的社区）、`NotificationItem`（通知）、`Time`（时间）。页面文件只留取数、读写、状态与 SEO。
- **删除**（全部由上面的组件代替，无其他引用）：`components/forum/{ForumThreadCard,ForumUserBadge,ReadState,CommunityChartActivityCard,ThreadListPage}.vue`。
  `ForumMediaViewer.vue` 保留未改；`ForumSafeImage.vue` 只剩回复框里刚上传的预览在用（见「设计复核后的修改」）；`SongRelatedDiscussions.vue` 的请求未改，列表项改为帖子行（见裁定 9）。
- **纯逻辑** `utils/rework/community.ts`：`COMMUNITY_TABS`、`HOME_FILTERS`、回复窗口（`REPLY_WINDOW = 60`、`replyWindows`、`windowOfPost`）、
  `replyTargetName`（原页面的同名逻辑）、`roleTag`、`threadStates`、关联谱面的标题与链接（链接规则与原来逐字相同）、`activityTitle`、`forumTimeText`、`NOTIFICATION_ICONS`。
- **组合式** `composables/useForumHydratedState.ts`：见「改动的数据代码」。
- **共享件的增量**：`ReworkIcon` 加 reply / heart / heartFilled（实心，点赞后）/ eye / mention / image / send；`rework.css` 加 `.rw-textarea`；
  `utils/forum.ts` 加 `FORUM_UNBOUND_TAIKO_ID`（服务端「未绑定」的原文，组件里不写中文字面量）。
- **外壳**：社区页签改用 `COMMUNITY_TABS`；页签名与各页 `<h1>` 相同：`rework.myPosts` 由「我的帖子 / 自分の投稿」改为「我的社区 / マイコミュニティ」
  （= `forum.myCommunity`，这一页有个人资料、我的帖子与站务台），广场 `<h1>` 用 `rework.community`（「社区 / 広場」），通知页 `<h1>` 用 `rework.notifications`（「通知」）。
  **铃铛**：显示未读数（`useForumNotificationPolling`：原来移动端底栏 `MobileTabBar` 用的 30 秒轮询，Stage 1 换外壳后它不再挂载，红点因此消失过；现在挂在外壳上，
  轮询条件不变——≤ 960 px、页面可见、在线、已登录），通知页确认的数字与广场 payload 的 `unreadNotificationCount` 也写入同一个 `useForumUnreadCount`；
  在通知页时铃铛 `aria-current="page"`。
- **软键盘**（P0）：`layouts/default.vue` 原有的判断（`innerHeight − visualViewport.height > 150` 且焦点在输入控件）不变，同时在 `<html>` 上写 `data-kb` 与
  `--kb-h`（键盘遮住的高度 = `innerHeight − (visualViewport.height + offsetTop)`，只在变化时写），并监听 `visualViewport` 的 `scroll`。
- **文案**：新增 `rework.forum.*`（`thread` / `compose` / `me` / `notifications` / `list` 与少量公用键），中日一一对应。帖子页、发帖页、我的社区、通知页的行内中日表
  （`locale === 'ja' ? {…} : {…}`）全部迁入 locale，文字不变；删去的说明文字见「偏离」。

### 功能对照：`/forum` 社区广场（改前 → 改后）

| 改前 | 改后 |
| --- | --- |
| `<h1>` 社区（`forum.title`），右上铃铛（`home.unreadNotificationCount` 红点）+「发布新帖」 | `<h1>` 为页签名 `rework.community`（中文同为「社区」，日文「広場」）；铃铛在外壳栏（带数字，见上）；「发布新帖」主按钮（手机与标题同一行） |
| 筛选 最新 / 热门 / 攻略 / 精选（`?filter=`，最新不写地址；最新读 `/api/forum/threads?sort=latest&page=1&pageSize=12`，其余取 home payload） | 不变（分段按钮 `aria-pressed`） |
| 筛选行里前 4 个版块链接 | 全部版块：≥ 1100 左栏（8 px 色点用 `--section-<slug>` token、帖子数 `threadCount`），以下为可横滑的一行；首项「全部版块」→ `/forum/discussions` |
| 「最新讨论」+「查看全部」（hot/featured → `sort`，攻略 → `threadType=guide`） | 不变 |
| home 读取失败（最新筛选时另显示）；列表加载骨架、失败 + 重试、空文字 | `ReworkState`：失败 + 同一重试；列表骨架（保持行高）；空 +「发布新帖」 |
| 帖子卡（`ForumThreadCard`） | 帖子行（`ReworkCommunityThreadRow`，见下） |
| 谱面动态：两列卡片、加载骨架、无数据时整块不显示 | 右栏（≥ 1240；以下在列表之后）：同一数据，每条 `DsCover` + `DsDiff`（难度与星级）、体感汇总、标签、首条提示、参与人数，整条链接到 `item.href`；条件不变 |
| — | **新增（接口已有、页面原来不显示）**：home payload 的 `highlightedTags`（每个标签 → `/forum/discussions?keyword=<标签>`）与 `leaderboard`（头像、名字、角色、发帖数与获赞数；没有 Rating / 段位） |
| 滚动位置写入 `sessionStorage` 并在进入时恢复 | 不变（脚本未改） |

### 帖子行（所有列表与歌曲页的相关讨论）

| 改前（`ForumThreadCard`） | 改后（`ThreadRow`） |
| --- | --- |
| 整卡可点（点链接以外的地方 / 回车打开帖子；内部链接各走各的），`role=link`、`tabindex=0` | 不变（逻辑逐字搬来） |
| 版块彩色胶囊（API 的 `accentColor`）、类型胶囊（含「讨论」）、置顶 / 加精 / 锁帖 | 8 px 版块色点 + 版块名（链接）；类型只在非「讨论」时显示（原型）；置顶 / 加精 / 锁帖 / **已隐藏**（`status: hidden`，版主可见的数据） |
| 标题（链接）、摘要、标签 | 同（标题最多 3 行、摘要 2 行，长串 `overflow-wrap: anywhere`） |
| 关联谱面：`SongCoverImage` + 曲名 + 难度名 · 星级，链接到 `/songs/:id?difficulty=` | 右侧 `DsCover` + 曲名（日文页用日文名，缺失时标 `lang=zh-CN`）+ `DsDiff`（难度图标与星级），链接同前 |
| 封面图（`coverImageUrl`，右侧大图；加载失败时显示 Miku 回落图） | 无关联谱面时右侧缩略图（`ReworkCommunityMedia`，同样的懒加载）；加载中与加载成功时保留 112×84 的框，**加载失败时整个缩略图移除、文字占满宽度**；两者都有时显示谱面（原型：「在聊哪张谱」优先） |
| 作者：`ForumUserBadge`（圆角方形头像、名字、角色胶囊〔含「鼓友」〕、站内称号、游戏称号文字） | `Author`：`DsPlayerAvatar` 24、名字、角色标签（只给版主 / 站务）、游戏称号文字（`DsTitlePlate` text）、站内称号（`DsSiteTitle`） |
| 回复 / 点赞 / 浏览（文字 + 数字） | 图标 + 数字（读屏有名称）；**新增**最后活动日期（`latestPostAt`）；< 768 不显示浏览数 |

### 功能对照：`/forum/section/:slug`、`/forum/discussions`

| 改前（`ForumThreadListPage`） | 改后（`ReworkCommunityListPage`，脚本原样搬来） |
| --- | --- |
| 布局的页头（「论坛版块」/「相关讨论」）+ 内容里的 h2 版块名、说明、帖子数、写新帖 | 一个 `<h1>`（版块名 / 「相关讨论」）、版块说明（仅版块页）、「写新帖」（`/forum/new?section=&songId=&difficulty=` 规则不变）；「共 N 帖」（版块页用 `threadCount`，全部讨论用 `total`，同原规则） |
| 版块读取失败 + 重试 | 在版块栏位置显示失败 + 同一重试 |
| — | **新增**版块栏（同广场；当前版块 `aria-current`；全部讨论且未选版块时标「全部版块」） |
| 排序胶囊 最新 / 热帖（点即生效） | 分段按钮，行为不变 |
| 「筛选」按钮（有效条件数）→ `el-dialog`：关键词、版块（非固定版块时）、排序（含精选）、类型；改动是草稿，「应用筛选」才写地址 | 同样的按钮与条件数 → 页内展开的表单（原生控件，`aria-expanded` / `aria-controls`），同样的四项与「应用筛选」，草稿规则不变；不再有弹层节点 |
| 加载 / 失败（`ForumReadState`）、空（`el-empty`） | 骨架 / 失败 + 重试 / 空（**新增**有条件时「清除筛选」）+ 写新帖 |
| 分页：「第 x / y 页，共 n 条」+ 上一页 / 下一页；超出范围时 replace 到最后一页 | `ReworkPager`（≥ 820 页码，以下「x / y」+ 前后），同一 `pushFilters`；纠正逻辑不变 |

### 功能对照：`/forum/thread/:id` 帖子

| 改前 | 改后 |
| --- | --- |
| 读取 `/api/forum/threads/:id`（`useForumResource`，按 id 区分）；加载 `el-skeleton`；失败 `ForumReadState` + 重试 | 读取不变；骨架；`ReworkState` failed（服务端文字）+ 同一重试 + 「返回社区」。**修复**：服务端渲染失败时首屏水合不一致（见「改动的数据代码」） |
| 头部：版块胶囊（链接）、置顶 / 加精 / 锁帖、`<h1>` 标题 | 版块色点 + 名（链接）、类型、置顶 / 加精 / 锁帖 / **已隐藏**（版主查看隐藏帖时原来没有任何标记）、`<h1>` |
| 作者（`ForumUserBadge minimal`）、回复数、浏览数、发帖时间（含秒） | `Author` 44：头像、名字、角色、游戏称号牌（`DsTitlePlate` plate，牌面编号在素材表里才用图，否则文字）、站内称号；时间（`<time>`，不含秒）、回复数、浏览数 |
| 关联谱面卡（曲绘、曲名、难度 · 星级、「查看谱面 →」，链接 `/songs/:id?difficulty=#chart-ugc`） | `ChartCard`：`DsCover` lg、曲名（页面语言）、`DsDiff`、「查看谱面」，链接逐字相同；≥ 1240 在右栏并吸顶，以下在头部之后、正文之前 |
| 标签 | 同 |
| 正文：段落（纯文本插值，不解析 HTML）与图片（按钮打开图片查看器，首图优先加载） | 同（`Blocks`）；阅读栏 ≤ 760 px、16 px、行高 1.85 |
| 「点赞主题」（按下状态、计数、加载中）、「回复」（计数，打开回复框） | `ThreadActions`：同两项，点赞后实心心形；请求、回到原滚动位置与焦点回到按钮的逻辑未改 |
| 回复区标题「回复 N」 | 「N 条回复」；回复多于 60 条时显示当前窗口的楼层范围 |
| 回复框：收起为一行 + 发送图标；展开为标题、回复对象或提示语、取消定向、取消、1000 字（计数）、添加图片（n/4，单张 20 MB，最多 4 张）、提示语、图片网格与移除、发布 / 已锁定；< 960 固定在底栏之上 | `ReplyBox`：同样的收起 / 展开、对象、取消定向、取消、1000 字计数、添加图片（n/4）、图片与移除、发布 / 已锁定；提示语两句删去（见偏离）；位置：≥ 768 吸在回复区底部，< 768 固定在底栏之上，软键盘打开时贴在键盘上（P0）。**未登录**：显示「登录后回复」+ 登录（带回本帖）（见偏离） |
| 楼层：头像、名字、角色、称号、楼号、时间；屏蔽作者折叠 + 展开；内容块；点赞 / 回复楼层 | `Floor`：同（头像 32、称号文字），**新增「楼主」标签**（作者 id 相同）；楼中楼左侧竖线缩进（原型） |
| 楼中楼：头像、名字、时间、「回复 @x」、屏蔽折叠、内容块、点赞 / 回复 | 同（头像 24） |
| 没有回复：`el-empty` | `ReworkState` empty |
| 所有楼层与回复一次挂载 | 每次最多挂载 60 条（楼层与楼中楼合计）；超出时分窗口（上下各一个 `ReworkPager`），切换后焦点到回复区标题；一个楼层的回复跨窗口时，下一窗口以「#楼号 作者」续接 |
| 深链 `#reply-<id>`：渲染后定位、居中、聚焦、高亮 1.8 s；不存在时滚到回复区并提示 | 同（逻辑未改），先切到包含该回复的窗口 |
| 图片查看器（`ForumMediaViewer`：对话框、Esc、前后、保持滚动、焦点回到触发处） | 未改 |

### 功能对照：`/forum/new` 发新帖

| 改前 | 改后 |
| --- | --- |
| 中间件 `account-auth`；自带吸顶头（返回社区、「发新帖」、发布），外壳栏隐藏 | 不变（`ComposerBar`） |
| 发布成功：状态行 + 「查看帖子」「再发一帖」；跳转失败提示 | 同（`rw-note`），逻辑未改 |
| 标题（120 字计数；**手机上隐藏**） | 标题（120 字计数）所有宽度都显示（见偏离） |
| 正文 4000 字计数；攻略类型时「加入正文」、段落数、已加入段落（可编辑、移除） | 同（原生 textarea 带计数） |
| 图片：`el-upload`（多选、`http-request` / `before-upload` 不变）、预览、移除、可选说明（details）、上传中状态 | 同，上传控件仍是 `el-upload`，图块为 `ComposerImages` |
| 「更多选项」折叠：版块（`el-select`）、类型、上下文谱面卡、摘要（280）、标签、关联歌曲（搜索 + 结果 + 已选）、难度（`el-select` 可清空）、星级（只读） | 版块（原生 select）与类型（分段）移到最上面常显；关联歌曲（`SongPicker`：搜索、结果带曲绘、已选为 `DsSongCell`+`DsDiff`、难度原生 select 首项「不指定」= 清空、星级只读）常显；上下文谱面直接显示为已选歌曲与难度；摘要与标签仍在「更多选项」里 |
| 歌曲搜索：`{ view: list, shelfStatus: 0, page: 1, pageSize: 8, keyword }` | 改用共享契约 `catalogRequestFor({ q, shelf: "available", sort: "catalog", page: 1 }, 8)` = 同样的参数 + `sort=catalog`（服务端默认值），返回同样的歌曲（服务端把 pageSize 夹到 ≥ 12，前后相同） |
| 校验（没有正文与图片时提示）、服务端拒绝（显示 statusMessage）、限流同样显示、成功跳转新帖子 | 未改（场景逐项核对请求体） |
| 草稿保存、离开提醒 | 原来没有，仍然没有 |

### 功能对照：`/forum/me` 我的社区

| 改前 | 改后 |
| --- | --- |
| 中间件 `account-auth`；读 home、`/api/account/profile`、我的帖子（10 条/页）、版主时读含隐藏的最新 10 帖 | 不变 |
| `ForumUserBadge`（含鼓众 ID）、h2「我的社区」、已绑定 ID / 发帖数 / 未读、两组读取状态、写新帖 / 通知中心 | `<h1>`「我的社区」+ 写新帖 / 通知；身份卡：`Author` 72（头像、名字、角色、称号牌、站内称号）、已绑定 ID（未绑定时「未绑定」）、发帖数、未读；读取中 / 失败 + 重试 |
| 我的帖子：加载 / 失败 / 空（还没发过 / 本页无帖）/ 卡片；上一页 · x / y · 下一页 | `ThreadList` 同样的状态（没发过时多一个「写新帖」）；`ReworkPager` |
| 站务操作台（details）：每帖 置顶 / 加精 / 锁帖 / 隐藏或恢复，成功消息后刷新三组数据，失败消息 | 同（`Moderation`，按钮带 `aria-pressed`，帖子标题可点开）。**修复**：每次操作后刷新 home 时操作台被卸载重挂而自动收起，现在展开状态由页面保存 |

### 功能对照：`/forum/notifications` 通知

| 改前 | 改后 |
| --- | --- |
| 中间件 `account-auth`；分页读取（20 条）、账号 / 页码 / keepalive 守卫、写入锁 | 不变（脚本只改了文案来源） |
| 「未读 x 条，共 y 条」+「全部标记已读」 | `<h1>`「通知」下同一句；按钮在标题右侧 |
| 加载文字；失败 + 重试；空 | 骨架；`ReworkState` failed（同一句）+ 重试；empty |
| 条目：类型胶囊（符号 + 名称）、相对时间（title 为完整时间）、标题、正文两行、箭头；未读左边条；整条为 link / button，Enter / Space | 同；**新增**发出者头像（API 的 `actor`；系统通知无 actor，显示类型图标）、未读圆点与浅底（`--unread-wash`）、读屏「未读」；相对时间在挂载后计算（首屏为日期） |
| 打开：未读先标记已读，同步未读数，跳到帖子（有 postId 时 `#reply-`） | 未改 |
| 分页：上一页 · 第 x / y 页 · 下一页 | `ReworkPager`（同一 `movePage` 守卫） |
| 原型的类型筛选、单条「标为已读」 | 没有做（见契约缺口 / 偏离） |

### 歌曲页「相关讨论」与外壳

- `SongRelatedDiscussions.vue`（歌曲详情的谱面讨论）：请求、链接、空态与「讨论这张谱」不变；每条讨论由「标题 + 回复数 · 难度名」改为帖子行（`ThreadRow` compact：版块、类型、标题、作者头像与名字、日期、回复与点赞、关联谱面的曲绘与难度），与社区列表一致（裁定 9）。
  `rework/song/Discussions.vue` 去掉了针对旧列表项的四条样式。切片 A 的场景仍按 `.related-discussions__list li` 数到 2 条（回归通过）。
- 外壳社区页签：社区 → 我的社区 → 通知；铃铛未读数（见「做了什么」）。

### 三项门槛

**P0 软键盘（回复框与发帖页）——工程检查通过，真机未验证，回复框上线前必须做真机。**

- 规则：`components/rework/community/ReplyBox.vue` 的 scoped 样式里是普通选择器 `html[data-kb] .crb { bottom: var(--kb-h, 0px) }`（< 768 px），没有 `:global(...)`；
  编译结果为 `html[data-kb] .crb[data-v-…]`。`components/rework` 是 `check-scoped-css` 的必须干净目录（`STRICT_DIRS`），`npm run check:scoped-css`：设计系统目录 0 处
  （仓库其余只报告 `pages/admin/taiko/chart-ugc.vue:212` 的 5 条，阶段 0 已记录，未改）。
- 编译检查（真实，单元）：`tests/reworkStage3.test.mjs` 用 `@vue/compiler-sfc` 编译 ReplyBox 的 scoped 样式，断言存在 `html[data-kb] .crb[data-v-p0check] { bottom: var(--kb-h, 0px)`，且没有退化成只剩 `html[data-kb]` 的规则；
  同时核对布局写入 `data-kb` / `--kb-h` 的代码。
- 浏览器断言（开发自检）：`keyboard-reply` 场景在 390×844 读取页面实际加载的样式表，找到含 `[data-kb]` 的规则，确认选择器以 `.crb[data-v-…]` 结尾、给 `<html>` 加 `data-kb` 后 `box.matches(selector)` 为真；
  键盘关闭时回复框下沿贴着底栏上沿；然后把 `visualViewport.height` 桩成 420 并派发 `resize`（焦点在回复框）：布局写入 `data-kb` 与 `--kb-h: 424px`，底栏隐藏，回复框 `bottom` = 424 px、下沿 = 420（键盘上沿），下内边距 8 px（不叠加安全区）；
  恢复后 `data-kb` 去掉，回到底栏之上无残留偏移。`keyboard-composer`（360×740）：同样的桩，发帖页的吸顶栏在顶端、发布按钮可见、正在输入的正文框起点在键盘之上、没有底栏。
- **没有验证的**：真实键盘。headless Chrome 不弹键盘，`visualViewport` 是桩出来的；iOS Safari 上 `visualViewport.offsetTop` 随滚动变化、横竖屏切换、输入法切换与组字、
  Android Chrome 的 `resizes-visual` / `resizes-content` 两种行为都没有在真机上看过。B6.4、B6.8、B12.14 必须在 iOS Safari 与 Android Chrome 真机上通过（记录机型与系统版本），之后回复框才算可上线；
  阈值（沿用原来的 150 px）与 iOS 的计算可能要按真机结果调整。

**P2 头像——混合数据复核做了（拦截数据），待设计负责人看截图。**

- 所有出现人的地方都是 `DsPlayerAvatar`：帖子行与列表（24）、帖子作者（44）、楼层（32）、楼中楼（24）、达人榜（32）、我的社区（72）、通知发出者（32）、外壳账号（未改）。
  有上传头像显示上传图；API 给空值、给服务端固定的 `miku.png` 地址（`utils/ds/avatar.ts` 认作「没有头像」）或图片加载失败时显示 `/default-avatar.svg` 原样，不调色、不加滤镜。旧的 `ForumSafeImage` 头像回落（`guide-miku-160.webp`）不再用于头像。
- 混合数据：fixture 的十位作者轮流是上传（正方形）、上传（160×48 非正方形）、服务端默认地址、空值、404 地址。`avatars` 场景（820）在全部讨论、长帖（多位回复者）、我的社区、通知四页断言：
  每个头像都解码成功、没有一个指向 `miku.png` 或失败地址、默认头像与上传头像都出现；默认头像计算样式 `filter: none`、`opacity: 1`、`mix-blend-mode: normal`。矩阵在帖子、广场、我的社区、通知页也做同样断言。
  截图：`avatars-{list,thread,me,notifications}-intercepted-zh-820-light.png`，以及各页 1440 / 390 截图（上传头像是合成的条纹图）。
- 观感（我的判断，供复核）：默认头像的橙色在一屏多个时仍然最显眼（RK-47 预期），没有为截图改色；非正方形上传图按 `object-fit: cover` 裁成圆形。

**身份（裁定 4）**：没有段位徽章、没有段位数据（单元测试搜索社区组件与页面）；游戏称号 `DsTitlePlate`：帖子作者与我的社区用 plate 形式（编号在素材表里才出牌面，fixture 的 42 有牌面、987654 回落为文字），列表与楼层用 text 形式；站内称号 `DsSiteTitle`；角色只给版主 / 站务标签。

### 与原型或规则的偏离与原因

- **广场**：没有原型的「头条」大卡（置顶 / 精选第一帖）与搜索框（列表 API 有 keyword，但广场原来没有搜索，全部讨论页的筛选里有）；达人榜没有 Rating 与段位，显示发帖数与获赞数（接口只有这些）；
  「谱面上的新提示」用现有的谱面动态（chart-activity）代替。手机发帖不是悬浮按钮，而是标题旁的主按钮（悬浮按钮会和固定底栏、帖子页的回复框竞争底部空间）。
- **帖子页**：右栏只有「这帖讨论的谱面」，没有「我在这张谱上的成绩」（要多一个账号成绩请求，本切片不改读取），也没有原型的「相关帖子」、收藏、复制链接、举报、只看楼主、跳到楼层（生产没有这些接口或原来没有这些操作）。
  回复多时用窗口分页（每窗 ≤ 60）而不是原型的楼层分页（服务端一次返回全部楼层，分页只在前端）。楼中楼全部显示，没有「展开其余 N 条」（深链会落在被折叠的回复上）。
  **未登录时回复框换成「登录后回复」**（原来可以输入，提交后才提示「请先登录后再回复」）；服务端权限不变，登录过期时原来的 401 提示路径仍在。点赞在未登录时仍是原行为（请求后提示登录）。
  回复框在 ≥ 768 吸在回复区底部（原来在回复列表之前、不吸附；原型「回复框吸在底部」）。
  删去两句说明（AGENTS 文案规则）：「分享你的看法或补充攻略。」「支持纯图片回复，最多 4 张」（「添加图片（n/4）」已说明上限）。时间不再显示秒。
- **发帖页**：版块、类型、关联歌曲从「更多选项」移出常显（原型），摘要与标签仍折叠；**手机显示标题框**（原来 ≤ 960 隐藏了这个选填字段）；没有原型的右侧实时预览、段落块 / 图片块编辑器、存草稿（原来没有草稿，不新增本地存储）、手机底部工具条。
  上下文谱面卡（「正在讨论这张谱 · 魔王 · 9★」）并入已选歌曲（同样的曲名、难度、星级）。
- **通知**：没有原型的类型筛选与单条「标为已读」按钮（接口没有按类型的筛选；单条已读原来只随「打开」发生，不新增写入入口）。
- **我的社区**：没有原型的回复 / 收藏 / 历史 / 关注页签（页面原来只有我的帖子与站务台；这些数据在 `me/summary` 等接口里有一部分，但不属于本页现有功能，记为可选扩展）。
- **列表筛选**：对话框改为页内展开的表单（不留弹层节点，手机上不再是底部抽屉）。
- 页面级标题：广场 / 我的社区 / 通知的 `<h1>` 改为页签名（日文广场「広場」），SEO 标题（`pageTitleKey`）不变。

### 契约缺口（生产没有，界面不放替身）

- 帖子：当前用户在该谱面上的成绩（需另读账号成绩）；收藏的界面接口存在（`favorite.post`）但页面原来没有入口；举报、复制链接、只看楼主、楼层跳转、帖子编辑与删除（生产都没有）；楼层分页参数（服务端一次返回全部）。
- 作者身份：段位、头像色相、稀有称号（RK-10 / RK-46）；楼层里作者的发帖统计。
- 广场：头条位、版块的今日新帖数、标签热度数（`highlightedTags` 只有名字）、达人榜的 Rating。
- 通知：按类型筛选与按类型未读数；通知发出者以外的对象（谱面、目标）。
- 发帖：草稿（服务端与本地都没有）、上传进度、图片块排序。

### 改动的数据代码（请重点复核）

- `composables/useForumHydratedState.ts`（新增）与三处使用（`pages/forum/index.vue`、`pages/forum/thread/[id].vue`、`ListPage.vue`）：服务端渲染失败时（无会话、数据库不可用），
  payload 带着失败但没有数据，客户端在水合**之前**（`onBeforeMount`）就重新发起同一读取并清掉失败，于是首个客户端渲染是「加载中」而服务端是「失败」——原页面同样存在这个水合不一致
  （本切片首轮 SSR 场景复现：class 与节点不一致的 Vue 警告）。现在挂载前沿用服务端的失败呈现，挂载后跟随实际状态；读取、重试、错误文字都没有改。
- `pages/forum/thread/[id].vue`：行内文案表改为 locale（同名键）；新增 `signedIn`、`replyWindowList` / `replyWindowIndex` / `showReplyWindow`（呈现）；深链处理里在定位前先切到包含该回复的窗口（一行）；
  身份切换与帖子切换时窗口回到第一段（`resetPrivateState` 一行）。删去已无人使用的 `getReplyTargetUsername`（搬到 `utils/rework/community.ts` 的 `replyTargetName`）、`renderReplyBlocks`、`isBlockedContentVisible`、`openReplyComposer`、
  未用的 `getSectionName` / `getSongDifficultyLabel` / `formatDateTime`。读写请求、守卫、消息、滚动恢复未改（单元测试逐项核对请求）。
- `pages/forum/new.vue`：文案改为 locale（同名键）；类型选项文字改用 `forum.types.*`（与原表文字相同）；歌曲搜索的 query 改用 `catalogRequestFor`（见对照表）。其余脚本未改。
- `pages/forum/me.vue`：文案改为 locale；新增 `moderationOpen`（操作台展开状态，见上）与 `myThreadsPageCount`。
- `pages/forum/notifications.vue`：文案改为 locale；删去 `typeLabelMap`、`formatNotificationTime`（移到组件）；新增 `selectPage`（调用原 `movePage`）。
- `pages/forum/index.vue`：新增 `setUnreadCount(home.unreadNotificationCount)`（让外壳铃铛跟上）；其余脚本未改。
- `components/rework/community/ListPage.vue`：`ThreadListPage.vue` 的脚本原样搬来，新增 `filterPanelId`、`boardsCurrent`、`clearFilters`（用原 `pushFilters` 写同一套地址参数）。
- `components/rework/Shell.vue`：挂 `useForumNotificationPolling()`（原移动端底栏的轮询，条件不变）。`layouts/default.vue`：写 `data-kb` / `--kb-h`（判断条件不变，加 `scroll` 监听，卸载时清理）。

### 论坛测试基线（ruling 1；不需要数据库与浏览器的测试，逐文件运行）

| 文件 | 改前 | 改后 | 说明 |
| --- | --- | --- | --- |
| `npm run test:forum`（`forumI18n`） | 4/6（2 失败） | 4/6（同 2 条） | 失败的两条是成长文案重复提示（`zh/ja growth copy avoids duplicate prompt labels`），与论坛无关，改前即失败 |
| `communityReadingSurface` | 11/16（失败 2、4、7、9、10） | 11/16（同 5 条） | 改前即失败的 5 条未改（面包屑类名、旧深色模式 token、`data.value = result` 等早已过时的断言）；通过的 11 条中 10 条断言改为跟随搬走的代码（逐条见下） |
| `forumCoreState` | 17/17 | 17/17 | |
| `forumThreadTitle` | 3/3 | 3/3 | |
| `forumNotificationPolling` | 7/7 | 7/7 | |
| `forumCommunityHandlers`（执行页面脚本的函数级工装） | 43/43 | 43/43 | 改动后先是 39/43：工装的 `t` 原样返回键名（2 条比对中日失败文字）、页面导入被剥离后 `catalogRequestFor` 不存在（1 条）、1 条断言模板是 `<div … class="block-list">`；工装改为读真实 locale、提供真实 `catalogRequestFor`，模板断言改为 `<ol …>` 后 43/43 |
| `dsPlayerAvatar`、`oidcConfig`、`authReturnNavigation` | 3/3、3/3、3/3 | 同 | 读论坛相关源码的其他测试 |
| `forumCoreSqlHttp`、`forumCommunitySqlHttp` | 0/1、0/1 | 同 | 需要隔离测试库与 `TAIKO_ALLOW_TEST_DB_MUTATION=1`，本机拒绝运行（环境守卫），Linux 验收运行 |
| `adminTraffic` | 0/1 | 0/1 | 需要 `/var/tmp`（本机不存在；运行后留下的 `taiko_viewer/var/` 已删除） |

### 改动的测试断言（逐条）

`tests/communityReadingSurface.test.mjs`（意图不变，指向搬走后的代码）：
1. 广场：`<h1>{{ t("forum.title") }}</h1>` → `<ReworkPageHeader … :title="t('rework.community')">`；其余不变。
2. 帖子文章流：`<h1>{{ detail.title }}</h1>` → `ThreadHead` 的 `ReworkPageHeader :title="thread.title"`；`thread-content → thread-actions → reply-section` 的顺序改为页面里 `thread-content → <ReworkCommunityThreadActions → <ReworkCommunityReplies`，两个组件各自带 `thread-actions` / `reply-section` 类；
   `reply-section__divider` 改为断言回复区上方的唯一分隔线（`.cr` 的 `border-top`）；「回复主题」字样改为查 locale。
3. 回复框：`v-if="!replyExpanded" … reply-box__open` → `v-if="!expanded" … crb__open`；`--thread-nav-offset: calc(66px …)` / `bottom: var(--thread-nav-offset)` → `< 768` 时 `position: fixed; bottom: calc(65px + env(safe-area-inset-bottom, 0px))`；
   **原断言「回复框不是 sticky」反转**：现在 ≥ 768 是 `position: sticky; bottom: 0`（原型「回复框吸在底部」）；新增键盘规则断言；`reply-list` 不滚动改为 `.cr__list`。
4. 回复操作：`setReplyTarget(post.id` / `(reply.id` → 页面 `@reply="setReplyTarget"`，`Floor` 里 `emit('reply', floor.id` / `emit('reply', reply.id`。
5. 操作的图标与状态：`thread-action__icon` / `reply-action__icon` 类、`.thread-action:focus-visible`、`.reply-action:active`、`min-height: 44px` → `ReworkIcon` 心形（按下时实心）、`.ta__act:focus-visible`、`.cf__act:active`、`min-height: var(--hit)`；`aria-pressed` 三处保留。
6. 深链：`:id="reply-${post.id}"` → `Floor` 里 `:id="reply-${floor.id}"`；新增「先切到包含该回复的窗口」；`replyUnavailable` 的中日原文改为查 locale（文字相同）。
7. 图片查看器：`class="thread-image__trigger"` → `Blocks` 的 `cb__trigger` 与页面 `@open="openImageViewer"`；查看器断言不变。
8. 回复列表节奏：`gap: 18px`、`floor-card__actions`、`sub-reply-item` 内边距、`padding-bottom: 24px`、`--thread-composer-height: 64px`（全部是被替换的样式值）→ 楼中楼左侧竖线、楼层分隔线、手机为固定回复框留出 72 px。
9. 整行可点：文件由 `components/forum/ForumThreadCard.vue` 改为 `components/rework/community/ThreadRow.vue`，断言内容不变。
10. 20 MB：`单张图片不能超过 20MB`（new.vue 源码）与 `1枚の画像は20MB以内で選択してください`（帖子页源码）→ 查 locale 同样的文字；新增 `file.size > FORUM_IMAGE_MAX_BYTES`。

`tests/forumCommunityHandlers.test.mjs`：`<div v-if="paragraphBlocks.length" class="block-list">` → `<ol …>`（1 处）。`tests/fixtures/forumHandlerHarness.mjs`：`t()` 读真实 locale（缺失时仍返回键名）、提供 `catalogRequestFor`（页面导入在工装里被剥离）。
新增：`tests/reworkStage3.test.mjs` 11 条。

### 设计复核后的修改（2026-11-18）

失败的图片不再显示别的图片，也不显示浏览器的破图标（与曲绘同一规则；头像不受影响，仍是 `/default-avatar.svg`）：

1. **列表缩略图**：新组件 `ReworkCommunityMedia`（懒加载与 `ForumSafeImage` 相同，进入视口前只有底色框、不渲染没有 `src` 的 `<img>`；挂载时补查水合前已失败的图片），失败时发出 `failed`，
   `ThreadRow` 把缩略图整块移除（`has-media` 去掉，文字占满）；加载中与加载后框固定 112×84，不移动布局。原截图里帖子 6、12 的破图框是懒加载前没有 `src` 的 `<img>`。
2. **正文与回复里的图片**：失败时 `Blocks` 在原位置画占位：`--bg-sunk` 底、虚线 `--line-strong` 边、`ReworkIcon` image、文案 `rework.forum.imageFailed`（「图片无法显示 / 画像を表示できません」），
   `role="img"` 并以该文案为名称；不再是按钮，点击不打开图片查看器；页面把失败的地址从查看器列表里去掉（`failedImageUrls`，只影响呈现）。内容块没有尺寸数据，占位为宽 ≤ 360 px、高 ≥ 120 px。
   不再有任何 Miku 回落图出现在帖子内容里。正文换行行为保持不变（渲染冻结）。
3. 场景 `failed-images`（拦截数据，1440）：帖子 5006 的缩略图 404 → 卡片里没有缩略图、文字区宽度 = 卡片宽度、列表里 0 个无 `src` 或加载失败的 `<img>`，5003 / 5012 的缩略图加载成功且框为 112×84；
   长帖正文第 3 张图与第 6 楼的图 404 → 各一个占位（文字、图标、`role=img`、不在按钮里、没有 `<img>`），其余正文图仍是查看器入口，点击占位不打开查看器，查看器计数为「1 / 3」（失败的两张不计）。
   `reworkStage3` 的内容渲染测试加了这几条源码断言（仍为 11 条测试）。fixture：`MEDIA_FAIL`（404）用于帖子 6 的封面、长帖正文最后一张、第 6 楼一张。

重跑 `community-selfcheck.mjs`：**27/27**（新增 `failed-images` 1 组），0 控制台错误、0 水合警告、0 Vue 警告；`portFreeAfter: true`、`browserStoppedAfter: true`；筛选 61 / 49 / 49 ms，最长任务 1735 ms（仍是注入 20 MB 文件的步骤）。截图在 `final-images/`（`forum-failed-thumbnail-…`、`thread-failed-body-image-…`、`thread-failed-reply-image-…`），并已覆盖 `final/` 中的同名与受影响文件。

### 验证

| 层级 | 内容 | 结果 |
| --- | --- | --- |
| 业务测试基线（真实） | 见上表：论坛相关 14 个测试文件改前 / 改后逐文件运行 | 改前改后通过 / 失败数逐文件相同（失败的都是改前即失败或环境守卫）；新增 `reworkStage3` 11/11 |
| 静态 / 单元（真实） | `npm run test:ds`、`npm run check:ds`、`npm run test:version`、`reworkStage1`、`reworkStage2`、`reworkStage3` | 90/90；通过（tokens 2352 值、EP 两作用域、对比度 368/368、token 对照表已重新生成——旧论坛样式删除后 `--viewer-*` 引用数下降、scoped CSS 设计系统目录 0、ds usage 137 文件 0、ds copy 133 文件、小图标 46）；1/1；14/14；19/19；11/11 |
| 静态（真实） | `community-fixtures.ts` 用 tsc strict 按真实类型检查（`ForumThreadCard`、`ForumThreadDetail`、`ForumPostFloor/Reply`、`ForumNotification`、`ForumHomePayload`、`ForumSection`、`ForumUserBadge`、`CommunityChartActivityPayload`、`AccountAuthUser`） | 该文件 0 错误（导入的 composable 在 Nuxt tsconfig 之外有自动导入名报错，同前两个切片）。`/api/account/profile` 没有导出的响应类型，fixture 按 `me.vue` 的局部类型写 |
| P0 编译检查（真实，单元） | ReplyBox scoped 样式编译后 `html[data-kb] .crb[data-v-…]`；没有退化为根选择器；社区组件 0 处 `:global(` | 通过 |
| 本机真实 SSR（`nuxt dev`，无数据库） | 中日各一组：`/forum`、`/forum/discussions`、`/forum/section/score-guides`、`/forum/thread/5001` 服务端 200、HTML 带 `rework-ep`、渲染失败态（论坛读取真实失败）；`/forum/new`、`/forum/me`、`/forum/notifications` 302 到 `/account/login?redirect=<本页>`；浏览器水合 0 警告 0 错误（论坛读取不拦截，客户端重试同样真实失败）；`<h1>` 与页签名相同、页签当前项、铃铛去向；浏览器进入通知页落到登录页 | 2/2 |
| 拦截数据的自检（intercepted） | 矩阵：7 页 × 360/390/820/1440 × 浅/深（中文）+ 日文 390 浅、1440 深 = 10 组 70 页：`rework-ep`、主题、唯一 `<h1>`、无横向溢出、页签当前项 = `<h1>`、长帖挂载 ≤ 60（最大 60）且上下各一个窗口分页、≥ 1240 谱面卡在右栏、正文宽 ≤ 760、头像断言（见 P2）、< 768 回复框下沿贴底栏 | 10/10 |
| 拦截数据的自检（intercepted） | 广场：最新请求参数、12 行、四个筛选写地址与「查看全部」映射、版块栏 10 项与帖子数、标签链接、达人榜 5、谱面动态 3 与链接、铃铛数字来自 home payload、整行点击与回车打开帖子、媒体缩略图；列表失败 + 重试、home 失败、空 + 发帖。列表：版块页 `<h1>`、当前版块、写新帖 query、排序即时生效、筛选是草稿（应用前地址不变、应用后请求含 keyword/threadType/sectionSlug、条件数 2）、翻页 page=2、空 + 清除筛选、page=99 纠正到 3、全部讨论的版块选择、列表失败 + 重试、版块失败 + 重试；手机版块单行、筛选展开无溢出 | 3/3 |
| 拦截数据的自检（intercepted） | 帖子：头部与谱面链接；窗口切换（挂载 ≤ 60、焦点到回复区标题）；深链到后面窗口里的回复（切窗、居中可见、聚焦、高亮）；不存在的回复提示；点赞主题（POST、按下、1235、成功消息、焦点留在按钮）与 401 提示；点赞回复（POST 路径）与 429 提示；回复楼层（对象、焦点进回复框）、取消定向、回复楼中楼；空回复不发送；上传：超 20 MB 不发请求并提示、413 提示、5 张只收 4 张并禁用、移除；发送：500 / 429 提示且草稿保留、成功（请求体 `bodyText`、`parentPostId`、段落 + 3 图、草稿清空、收起）；新楼层把 `<img …>` 当文字显示；屏蔽楼层展开；图片查看器打开、Esc、焦点回到图片；隐藏 + 锁帖（标签、回复框禁用与锁定文字）；无回复无谱面；读取 404 + 重试 | 1/1 |
| 拦截数据的自检（intercepted） | 未登录：回复框为登录提示（带回本帖）、点赞主题与回复各一次 401 提示（2 次被拒请求）、发帖 / 我的社区 / 通知客户端导航落到登录页并带回 | 1/1 |
| 拦截数据的自检（intercepted） | 发帖：版块来自 `?section=`、没有正文的校验提示且不发请求、类型、标题计数、加入正文段落、图片超 20 MB / 两张上传 / 说明 / 移除、歌曲搜索（**真实** `/api/content/songs`，参数 `view=list&page=1&pageSize=8&keyword=合成&sort=catalog&shelfStatus=0`，12 条）、选曲后难度首项「不指定」、选魔王后星级、摘要与标签、400 / 429 提示且字段保留、成功后请求体逐项（版块、类型、标题、locale、摘要、标签拆分、songId / difficultyType / level、段落 + 段落 + 带说明的图片）并跳到新帖子；`?songId=1&difficulty=4` 预选（真实歌曲接口）；手机标题可见、无溢出 | 2/2 |
| 拦截数据的自检（intercepted） | 我的社区：`<h1>`、绑定 ID / 发帖数 / 未读、上传头像、翻页、站务台（隐藏帖标记、置顶与恢复的请求体、403 提示、操作后保持展开）、未绑定 + 无帖 + 普通成员无站务台、两组读取失败与重试。通知：20 条、3 未读、5 条系统通知用类型图标、混合头像、link / button 角色、翻页、打开未读通知（POST `ids:[7000]`、跳到 `#reply-500102`、返回后少一条未读）、键盘 Space、全部已读（POST `{}`、铃铛数字消失）、空、失败 + 重试；手机铃铛 7（轮询 `/api/forum/notifications/unread`）、通知页 `aria-current` | 3/3 |
| 拦截数据的自检（intercepted） | P0 键盘（回复框 390、发帖 360，桩出的 `visualViewport`，见 P0）；P2 头像四页（820）；EP 开关（/about 无 → 六页有 → 图片查看器打开关闭 → 回 /about 去掉、没有查看器节点、`<body>` 子节点不多于基线 + 2 → 返回恢复） | 4/4 |
| 合计 | `community-selfcheck.mjs` 最终一次（设计复核修改后） | **27/27**，0 控制台错误、0 水合警告、0 Vue 警告；`portFreeAfter: true`、`browserStoppedAfter: true` |
| 指示性计时（dev） | 筛选 61 / 50 / 52 ms；路由切换 85–189 ms，进入长帖（60 条挂载）在新开的浏览器页里首次 1076–1279 ms（同一页再次进入 136 ms，开发模式按模块加载组件）；最长任务 1879 ms 出现在注入 20 MB 文件的上传步骤（帖子与发帖场景；只跑矩阵时最长 193 ms） | 开发模式只作参考 |
| 回归（共享文件：Shell、Icon、rework.css、locale、layout） | 改前（本切片动手之前，用当前运行器）：曲库 HTTP 57/57、SSR 失败通过、24/24；切片 A 44/44 + SSR 失败；切片 B 25/25；切片 C 54/54。改后：曲库 HTTP 57/57、SSR 失败通过、24/24；切片 A 44/44 + SSR 失败；切片 B 25/25；切片 C 54/54（全部在最终代码上运行） | 端口与浏览器进程结束后都已释放 |
| 未验证 | 真实数据库与登录、生产 Nitro、Linux 浏览器、真实上传与限流、真机软键盘（P0）、真机触控、读屏播报 | — |

运行：`node scripts/rework/community-selfcheck.mjs --port=3574 --out=<目录> [--only=<场景前缀,…>]`（共享运行器：127.0.0.1、`TAIKO_DB_HOST=invalid.invalid`、`no-egress.mjs`、
一个系统 Chrome（记录 PID，只结束自己的进程树）、同时一个页面、总时限 40 分钟、`finally` 中关闭并确认端口空闲）。证据（不提交）：主检出 `.claude/stage-artifacts/slice-d/`：
`final/`（`slice-d-selfcheck.json` 与截图已换成 `final-images/` 那一次运行的结果、`nuxt-dev.log`；`*-intercepted-*` 为拦截数据，`ssr-*` 为真实服务端渲染，`*-keyboard-simulated-*` 为桩出的键盘）、`run1/`（修改正文换行之前的一次完整运行，26/26）、
`dev1/`（开发中的分段运行，含 `FAILED-*`：首轮 SSR 场景发现水合不一致、广场媒体缩略图计数写错、长帖 fixture 的楼中楼位置写错、歌曲搜索结果上限（服务端最少 12 条）、站务台读取与操作共用了一个失败键）、
`baseline-before/`、`baseline-after/`（测试输出）、`regression-before/`、`regression-after/`。


### Linux 隔离验收（尚未运行）

在 `shell-sql.mjs` 加 `--check=community`，新建 `community-check.mjs`：沿用 `shell-check.mjs` 的合成账号（`SELECT DATABASE()` 以 `_test` 结尾 + `TAIKO_ALLOW_TEST_DB_MUTATION=1` / `--allow-test-db-mutation`），
真实 HTTPS 登录得到会话；曲库用 `detail-data.mjs` 的 `writeDetailFiles()`。然后用生产 Nitro 运行 `runCommunityScenarios()`，把 `openContext` 的论坛拦截换成真实请求（需要一个「不拦截 `/api/forum/*` 与账号接口」的开关，`state.real` 已覆盖读取，写入与登录态的开关本切片没有写）：
- 测试库里先写入本次运行自己的合成版块帖子、长帖（> 60 条回复，含楼中楼与屏蔽作者）、通知、版主账号；
- **帖子数差值**：运行前后 `SELECT COUNT(*) FROM forum_threads`（以及 `forum_posts`）——除本次运行自己创建并在结束时清理的数据外差值为 0；
- 真实写入：回复、点赞、上传（隔离的媒体目录）、发帖、标记已读、站务操作各一次，在库里可见后清理；限流（429）用测试库的速率配置触发；
- 头像混合数据用真实账号：上传头像、服务端默认 `miku.png`、失效地址，截图 `acceptance_*` 交设计负责人复核（B12.5、B12.15）；
- **真机**：iOS Safari（带 Home 指示条的 iPhone）与 Android Chrome 的回复框与发帖页键盘（B6.4、B6.8、B12.14），记录机型与系统版本；
- 另需在 Linux 上按新结构更新 `tests/fixtures/forumDiscoveryBrowserRuntime.mjs` 与 `scripts/verify_account_titles_browser.mjs`（它们直接导入已删除的 `ForumThreadCard.vue` / `ForumUserBadge.vue` / `ReadState.vue` / `ThreadListPage.vue`，并按 `.forum-thread-card`、`.account-title`、`.floor-card__user`、`.sub-reply-item__head` 找元素；称号现在是 `DsSiteTitle` 的 `.ds-site-title`）。
`community-check.mjs` 与 `--check=community` 本切片没有写。

### 看到但没有改

- 帖子正文段落里的换行被合并（`.thread-content p` 原来就没有 `pre-wrap`），而回复里保留换行；发帖时正文框里的多段文字会显示成一段。渲染冻结，保持原样（单元测试锁住这一点），是否改由负责人决定。
- `useForumResource` 在客户端重新读取时同步清掉服务端带来的失败，是上面水合不一致的根源；本切片只在呈现层处理。
- 每次站务操作后 home 重新读取，`canModerate` 短暂为假（操作台被卸载）；现在展开状态保留了，但会闪一下加载状态。
- `tests/accountEntryState.test.mjs` 本机 22/28（6 条登录重试相关失败），不读论坛代码，属于切片 E 的区域，未改。
- `pages/admin/taiko/chart-ugc.vue:212` 的 `:global(body.theme-dark) …` 5 条（阶段 0 已记录）。
- `ForumSafeImage` 的 Miku 回落图仍用于回复框里刚上传图片的预览（不是帖子内容，本次复核范围之外）。
