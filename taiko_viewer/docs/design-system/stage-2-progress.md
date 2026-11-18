# Stage 2 · 成绩与成长

依据：`rework-playbook.md`、Design V1.3 Final（冻结 `5f770a2`，原型 `preview/redesign-v1/`）。分支 `feature/viewer-rework-stage2`。

## 切片 B：玩家的成绩页

2026-11-18，基于 `b41c2e7`，未提交、未合并、未部署，版本仍为 `1.15.0`。没有改 `server/api/**`、没有新增接口、没有数据库访问。
**隔离验收（Linux）尚未运行**；下面除注明「真实」外都是本机开发自检，登录后的内容全部来自拦截的请求。

### 做了什么

- **页面**：`/account/songs`（全部成绩）、`/my`（我的太鼓）、`/tools/b30`、`/tools/trend`、`/tools/progress`、`/tools/recommend`。地址不变。
  六个页面都设 `hidePageHeader: true` 与 `reworkElementPlus: true`，页面自己的 `<h1>`（`ReworkPageHeader`；`/my` 为读屏可见的 `<h1>`，
  视觉上由身份带开头，同原型）。`/my/growth`、`/my/weekly` 未动（切片 C）。
- **呈现组件**（`components/rework/scores/*`、`components/rework/my/Hub.vue`）：`List`（全部成绩）、`ImageResult`（服务端图片的结果区）、
  `ReadState`（个人成绩读取失败的三种呈现）、`RecommendRow`、`TargetProgress`、`ReworkMyHub`。页面文件只留取数、状态与 SEO。
- **共享件的增量**（切片 A 的基础件没有重写）：`assets/css/ds/rework.css` 加表单件 `.rw-stack / .rw-form / .rw-field / .rw-input /
  .rw-select / .rw-seg / .rw-check` 与 `.rw-count / .rw-note / .rw-result-image`（都在 `html.viewer-rework` 下，原生控件，不留弹层节点）；
  `ReworkIcon` 加 lock / edit / trash / chevron / plus / upload / download / open。
- **纯逻辑** `utils/rework/scores.ts`：读取失败的分类（`400 + 绑定` → 绑定提示，`404` → 还没有成绩数据，其余 → 失败重试；依据
  `server/services/account/{personal,charts,progress}.ts` 的现有响应）、行窗口（每次挂载 ≤ 50 行）、日期与曲名（页面语言在前，另一语言作副标题并标
  `lang`）、推荐理由的比例与刻度、`PLAY_TABS`。
- **外壳页签**（`Shell.vue` 的 `play` 组改用 `PLAY_TABS`）：全部成绩 → B30 表 → Rating 走势 → 歌曲进度 → 推荐歌曲，五个都是现有地址。
  原来只有「成绩 / 点灯进度 / 推荐」三个，B30 与走势页上没有当前页签。页签名与各页 `<h1>` 相同：`rework.scores` 改为「全部成绩 / 全成績」，
  `rework.progress` 由「点灯进度」改为「歌曲进度 / 楽曲進捗」（这一页是进度图片，没有点灯格子），`rework.recommend` 改为「推荐歌曲 /
  おすすめ楽曲」，新增 `rework.b30`、`rework.trend`（取 `tools.*` 的同名文字）。
- **四个工具页的门槛**：`AccountToolGate` → `ReworkGate`（登录、注册、登录后回到本页）。`/tools/word-cloud` 仍用 `AccountToolGate`（切片 F）。
- **文案**：新增 `rework.scoreList / ratingDims / imageTool / b30Tool / trendTool / progressTool / recommendTool`（中日一一对应）。
  这六个页面模板与脚本里的行内中日文案（`locale === 'ja' ? … : …`）全部迁入 locale。编辑与导入对话框本身的文案没有动（见「看到但没改」）。

### 功能对照：`/account/songs` 全部成绩（改前 → 改后）

| 改前 | 改后 |
| --- | --- |
| 中间件 `account-auth`：未登录时 302 到登录页并带 `redirect` | 不变（真实 HTTP 检查） |
| 读 `/api/account/bindings`、`/api/account/songs`（page / pageSize / keyword / level）、`/api/content/songs`；身份与同步代数守卫、keepalive 挂起与恢复 | 不变（脚本未改逻辑；`tests/accountSongsUi.test.mjs` 15/15） |
| 绑定切换 `el-select`（手动账号带「手动录入」）、来源标签、来源说明 | 原生 `select`（同样的禁用条件与 POST），来源标签与一行说明保留在页头 |
| 读取失败：`el-alert` + 重试 | `ReworkState` failed + 重试；重试期间显示骨架 |
| 歌曲目录读取失败：`el-alert` + 重试 | 页头下一行提示 + 重试（只影响详情链接与新增对话框的选歌） |
| 加载：一行文字 | 骨架（8 行） |
| 没有绑定：`el-empty` +「前往个人档案」（仅在成绩读取没有报错时；未绑定时成绩接口 400，实际看到的是红色错误提示） | `ReworkGate` binding（去 `/account/profile`），未绑定时总是这一种 |
| 关键词 + 「搜索」、难度下拉（可清空，改变即应用） | 搜索框 + 「搜索」、难度分段（全部 + 五个难度，带难度图标，点选即应用，规则同前）；**新增**有筛选时的「清除筛选」 |
| 「总记录数 N」 | 「共 N 条」（`role=status`） |
| 「新增成绩」「导入成绩」 | 页头右侧两个次要按钮，禁用条件不变 |
| `el-table`：曲名（目录内的链接到 `/songs/:id?difficulty=`；自定义曲名不链）、日文名、已下架 / 手动收录 / 手动录入标签、难度名、分数、良/可/不可 + 连打/连击、评价名、最大物量、更新时间、锁定开关（非手动）、编辑 / 删除（手动） | 表格（≥ 768）：`DsSongCell`（曲绘、页面语言曲名、另一语言名）、标签（已下架、手动收录、**已锁定**）、`DsDiff`（难度 + 星级）、分数、**`DsCrown`**（由 `crownFromCounts` 换算；≥ 1100 全名、以下短名）、`DsRank` + 名称、`DsJudgeBar`（≥ 1100）、更新日期（≥ 1240）、行内锁定 / 编辑 / 删除（≥ 1100）、「详情」展开。详情行：判定条、连击、连打、最大物量、**游玩 / 过关 / 全连 / 全良次数**、更新时间、ID、锁定开关、编辑、删除、打开歌曲页。每行「手动录入」标签删去（页头已写明当前是手动账号） |
| 手机：卡片 + 折叠详情（判定、连打/连击、物量、更新时间、锁定、编辑、删除） | 手机页首压缩：绑定选择与来源标签同一行、说明行缩小；「导入成绩 / 新增成绩」同一行；难度筛选为一行横向滚动（不换行，选中项滚入可见区，页面不横向溢出）；390×844 下第一行成绩在屏幕上半部。手机行：曲绘与曲名 + 分数；难度、良/可/不可（< 375 隐藏）、王冠短名、评价图标 + 名称；详情展开同桌面 |
| 分页：总数、每页 25/50/100、页码；改每页条数时停在当前页（超出时落到最后一页） | `ReworkPager`（按钮模式）+ 每页条数（原生 `select`），换条数的行为相同；**100 条/页时分两段各 50 行挂载**（「第 1–50 条 / 第 51–100 条」） |
| 编辑 / 新增 / 导入对话框（`AccountSongEditorDialog`、`AccountScoreImportDialog`）、删除前 `ElMessageBox` 确认、各条成功 / 失败消息 | 组件与请求不变；对话框只在打开期间挂载，离开页面（keepalive 停用）时关闭；消息文字移入 locale；编辑对话框标题行加了间距 |
| 筛选无结果：表格空文字 | 「没有符合条件的成绩」+ 清除筛选；没有任何成绩：「还没有成绩记录」+ 导入 / 新增 |

### 功能对照：`/my` 我的太鼓

| 改前 | 改后 |
| --- | --- |
| 进入时重新确认会话（预渲染页的游客缓存）；加载文字；失败文字 + 重试 | 同样的确认；骨架；`ReworkState` failed + 同一重试。**修复**：客户端在水合前就发起的确认让首屏从游客变成加载中，原页面每次都有水合不一致；现在首次渲染沿用服务端的会话，挂载后再跟随实际状态 |
| 游客：默认头像 +「登录」链接（无 `redirect`） | `ReworkGate` login（「登录后查看你的太鼓数据」，登录带回 `/my`，另有注册） |
| 入口名称：「成绩管理」「每周回顾」等 | 与所打开页面的标题一致：`/account/songs` →「全部成绩」（`rework.scoreList.title`），`/my/weekly` →「这一周 / この一週間」（该页自己的 `weekly.title`）；其余入口本来就与页面标题相同（多端同步、成长档案、推荐歌曲、B30 表、Rating 走势、歌曲进度、太鼓词云、年度回顾） |
| 登录：头像（失败退回默认头像）、用户名、站内称号、「个人档案」，链接到 `/account/profile` | 身份带：`DsPlayerAvatar`（服务端默认地址视为无头像）、用户名、`AccountTitleBadges`、「个人档案」 |
| 两组入口（常用：多端同步〔登录后〕、成绩管理、成长档案、推荐歌曲；数据与工具：每周回顾、B30、走势、歌曲进度、词云）+ 年度入口（有权限时） | 不变（同一份 `linkGroups` / `annualLink`），改为两列列表（手机一列） |

### 功能对照：`/tools/b30`、`/tools/trend`、`/tools/progress`

| 改前 | 改后 |
| --- | --- |
| `AccountToolGate`：未登录提示 + 登录 / 注册（登录不带回本页） | `ReworkGate` login（带回本页）+ 注册；服务端首屏即为该提示（真实 SSR） |
| B30：Top N（1–50）、单维（6 项，可空）、动态原点、生成；结果标题与概要；点图在新标签打开；等待 / 条件已改 / 加载文字；错误 `el-alert` | 同样的参数（N 用数字框，越界时不能提交；单维为分段；动态原点为复选框）；结果在 `ImageResult` 面板：概要、**查看原图**、**保存图片**（同一个 blob，不再请求）；等待、条件已改、生成中（占位保持高度）；失败按含义呈现：未绑定 → `ReworkGate` binding，没有成绩数据 → 空状态 +「多端同步」，其他 → 失败 + 重试（重新提交同一条件） |
| 走势：点数 N、最大天数、维度（7 项，可空）、柱状图、显示全部点、生成；提示行「对应 taikotrend …」；图片 | 参数相同（越界不能提交）；提示行删去（只是命令对照）；结果、保存、状态同上 |
| 进度：类型分段（段位 / 定数 / 星级 / 全良难度）；选项读取中 / 失败 + 重试；段位：版本 + 段位（可搜索下拉）；定数：口径分段 + 定数（可搜索）；星级；全良难度（可搜索）；无可选项提示；读到选项后自动生成；生成 / 刷新；上一页 / 下一页 + 页码；保存图片（`taiko-progress.png`）；点图新标签 | 全部保留；下拉改为原生 `select`（没有输入过滤，原生的键入跳转仍可用）；翻页在结果面板标题右侧 |

三个页面的图片仍由原接口生成（`/api/account/charts/{b30,trend}`、`/api/account/progress/image`），请求参数与先前逐项相同（`tests/reworkStage2.test.mjs` 核对源码）。

### 功能对照：`/tools/recommend`

| 改前 | 改后 |
| --- | --- |
| 内容宽度：标准（居中、较窄，与同组其他页面左缘差约 90 px） | 与同组四页相同的宽版（`contentLayout: "wide"`），标题、控件与结果面板与其他页签左对齐 |
| 两个模式页签（`role=tab`，没有对应的 tabpanel） | 分段按钮（`aria-pressed`），两个区块各带名称 |
| 普通：数量 N；折叠的「推荐设置」（维度 7 项、同时生成图片）及其摘要；「查看推荐」 | 数量、维度、生成图片都直接可见（不再折叠），摘要放在结果标题右侧；数量越界不能提交 |
| 失败：通用错误提示 | `ReadState`：未绑定 / 没有数据 / 失败 + 重试 |
| 结果：曲绘、曲名、难度名、星级、「未游玩」标签；链接到详情（可设目标时带 `recommendation` token）；`RecommendationGoalAction`（选择目标对话框、已设定、失效提示）；可选的推荐图片 | 全部保留（链接与 token 规则逐字相同，`RecommendationGoalAction` 未改）；曲目用 `DsSongCell`、`DsDiff`；**新增**推荐理由：接口已有的 `deviationRatio`（±%）、候选指标 / 参考指标、`inStrictRange`（「在 90%–105% 范围内」）与一条 80%–120% 的刻度（90%–105% 为带） |
| 目标：目标下拉（6 项）、星级、「查看目标候选」；加载块；错误；候选不足提示；空；条目：曲绘曲名链接、星级、推荐指数、当前 / 目标 / 差距、进度条与百分比 | 目标为分段；其余保留；条目加 `DsDiff`（难度图标 + 星级）；失败同上三种呈现 |

`RecommendationSongItem.vue` 未改（首页 `PlayerGrowthSurface` 仍用它，属于切片 C）；本页改用新的 `RecommendRow`。

### 与原型或规则的偏离与原因

- **成绩表**：原型的行内图标只在悬停时出现、手机点一行进入编辑抽屉。这里行内操作在 ≥ 1100 常显（触屏与键盘可达），所有宽度都有「详情」展开行，
  手机不再「点行即编辑」（锁定与删除需要入口，编辑对话框是现有组件，不往里加业务）。没有排序控件与王冠 / 评价 / 来源筛选（接口不支持，见契约缺口），
  没有页首的通关 / 全连 / 全良合计（接口只返回当页与总数）。
- **P1 优先于 G4**：原型列表里王冠旁不加文字；按 playbook 门槛，王冠一律带可见文字（≥ 1100 全名、以下短名）。
- **每页 100 条**：服务端分页不变，客户端分两段挂载（每段 50 行），满足 ≤ 60 行挂载预算，不改请求。
- **表单**：工具页参数用原生控件（`select`、数字框、复选框、分段按钮），不再用 Element Plus 的下拉 / 数字框 / 开关 / segmented；进度页的「可搜索下拉」因此没有输入过滤。
- **删去的说明文字**（AGENTS 文案规则）：走势页「对应 taikotrend …」提示；成绩列表每行的「手动录入」标签（页头已有）。
- **新增的真实数据**：成绩行的王冠（原表格没有）、游玩 / 过关 / 全连 / 全良次数（原来只在编辑框里）、推荐理由的三个字段、B30 / 走势的「保存图片」。
- 原型的 Rating 刻度盘、走势折线、六维哑铃、点灯格子、`/my` 的 Rating / 最近 7 天 / 目标快捷格都没有做：生产没有对应的 JSON（见契约缺口）。

### 契约缺口（生产没有，界面不放替身）

- **原生的 Rating / 走势 / 进度视图需要后端提供 JSON**：B30 行（单曲 RT、准确率、入围线）、Rating 与六维的历史序列、每张谱的王冠 / 评价（点灯格子）
  现在只以图片形式由 `charts/b30`、`charts/trend`、`progress/image` 输出。
- 成绩列表：没有排序参数（固定按更新时间倒序）；没有王冠、评价、来源（手动修改 / 已锁定）筛选；没有按王冠的合计；没有定数、准确率、单曲 RT、
  「手动修改过」标记。接口有 `scoreOnly` 参数，页面原来没用，这里也没加。
- `/my`：没有 Rating、近 30 天变化、最近 7 天、当前目标与本周的数字（`/api/account/my-taiko/overview` 受读模型权限控制，现有测试要求本页不挂载它）。
- 推荐：普通推荐行没有我的王冠 / 评价 / 分数、没有推荐所依据的能力方向；目标推荐没有「设为目标」（只有带 token 的普通推荐能设目标）。

### 改动的数据代码（请重点复核）

- `composables/useToolChartImage.ts`：多一个 `errorStatus`（失败时的 HTTP 状态，0 = 无）。请求、取消与代数守卫不变。
- `composables/useRecommendationTool.ts`：多 `errorStatus`、`errorMessage`（失败时的状态与服务端 `statusMessage`）。请求不变。
- `pages/tools/recommend.vue`：目标请求失败时另记 `targetStatus` / `targetStatusMessage`；原有 `targetError` 不变。数量越界时不提交（原来 `el-input-number` 会夹到范围内）。
- `pages/tools/{b30,trend,recommend}.vue`：页面自己 `await fetchCurrentUser()`（原来在 `AccountToolGate` 里做）。走势页数字越界时不提交。
- `pages/account/songs.vue`：脚本逻辑未改；删除了已不用的 `copy` / `stateCopy` / `levelOptions` / `scoreRankLabel`；新增 `filtered`、`clearFilters`、
  `sourceHint`（保留给测试）、对话框挂载状态与 `onDeactivated` 关闭。
- `pages/my/index.vue`：`hubStatus`（首次渲染沿用服务端会话，见上）。`pages/tools/progress.vue`：`defineOptions({ name: "ToolsProgressPage" })`
  （文件名推出的组件名 `Progress` 是保留的 HTML 元素名，原来每次进入都有 Vue 警告）。
- 测试：`tests/accountSongsUi.test.mjs` 一处断言从中文说明改为 locale 键（`sourceHint` 现在是 `t()` 的结果）；`tests/recommendationGoalNuxt.test.mjs`
  （Linux）里普通推荐的数量 / 维度 / 图片选择器改为新的原生控件与 `.rw-result-image`；`scripts/performance/navigation{,-online}.mjs` 的
  `/account/songs`、`/my` 就绪选择器改为 `.sl .sl-summary`、`.hub`。`/my` 的分组保留 `my-links` 类（Linux 的 My Taiko 集成测试在服务端 HTML 里找它）。

### 设计复核后的修改（2026-11-18）

1. `/tools/recommend` 加 `contentLayout: "wide"`：成绩组五个页面同一内容宽度与左缘（矩阵断言五页 `<h1>` 左缘相同）。
2. `/my` 入口名称与目标页面标题一致（见功能对照）；矩阵断言九个入口在中日两种语言下等于各页标题。
3. 全部成绩手机页首压缩（见功能对照）；`scores-phone` 断言难度筛选单行（高 ≤ 52 px）、两个按钮同一行、第一行成绩顶边 < 422 px（844 的一半）、选中「魔王（里）」后它在可见区内、无横向溢出。

重跑：`scores-selfcheck.mjs` 25/25（第一次 23/25：两个手机场景第一行在 429 px，再压缩搜索框高度与间距后通过）；`reworkStage2` 9/9、`homeDeepState` + `growthPassportHttp` 26/26（与 reworkStage2 合计 35/35）；`check:ds` 通过。
截图在 `review-fixes/`，并已覆盖 `final/` 中的同名文件（含 recommend zh 1440 浅、my zh 390 深、scores zh 390 深与 360 浅）。共享文件只改了本切片组件，曲库与切片 A 回归未重跑。

### 验证

| 层级 | 内容 | 结果 |
| --- | --- | --- |
| 静态 / 单元（真实） | `npm run test:ds` | 90/90 |
| 静态 / 单元（真实） | `npm run check:ds` | 通过：tokens、EP 两作用域；对比度 368/368；token 对照表已重新生成；scoped CSS 设计系统目录 0；ds usage 87 文件 0；ds copy 83 文件 |
| 静态 / 单元（真实） | `npm run test:version`、`tests/reworkStage1.test.mjs`、`tests/reworkStage2.test.mjs`（新增 9 项） | 1/1、14/14、9/9 |
| 静态 / 单元（真实） | 受影响的现有测试：`accountSongsUi`、`homeDeepState`、`toolChartIdentity`、`uiBatch2State`、`recommendationToolIdentity`、`recommendationSongItem`、`recommendationGoalIdentity`、`growthPassportHttp` | 52/52 |
| 静态（真实） | `scores-fixtures.ts` 用 tsc strict 按真实响应类型检查（`toSongRow` / `sanitizeBinding` 返回类型、`ProgressOptions`、`RecommendationToolPayload`、`RecommendationGoalPreview`、`TargetRecommendationsPayload`、`AccountAuthUser`） | 该文件 0 错误（它导入的服务端模块在 Nuxt tsconfig 之外有自动导入名报错，与 fixture 无关） |
| 本机真实 HTTP / SSR（`nuxt dev`） | 未登录：`/account/songs` 302 到 `/account/login?redirect=/account/songs`（中日）；四个工具页与 `/my` 服务端 HTML 带 `rework-ep` 且渲染登录提示，浏览器水合 0 警告 0 错误，登录链接带回本页，页签标出当前页；浏览器进入 `/account/songs` 落到登录页；390 深色 | 3/3 |
| 拦截数据的自检（intercepted） | 矩阵：六个页面 × 360/390/820/1440 × 浅/深（中文）+ 日文 390 浅、1440 深 = 10 组 60 页：`rework-ep`、主题、成绩行 ≤ 60、王冠可见文字（≥ 1100 全名 / 以下短名）、评价名称、判定条只在 ≥ 1100、判定三元组只在 375–767、表头从 768 起、图片宽 ≤ 面板宽、进度图自动生成、推荐 12 行、`/my` 身份带与 10 个入口、五个页签与当前页、无横向溢出 | 10/10 |
| 拦截数据的自检（intercepted） | 成绩列表功能（1440）：链接与自定义曲名、已下架 / 手动收录标签、难度筛选、关键词提交、无结果 + 清除、每页 100 分两段、下一页、换回 25 停在第 2 页、详情行 9 项、行内锁定与详情锁定（POST 内容）、编辑 / 新增 / 导入对话框打开并在关闭后卸载、切换到手动绑定（POST、删除出现、锁定消失、说明行）、删除确认后 POST、目录读取失败提示与重试；手机 360 浅 / 390 深（评价名、王冠短名、三元组 ≥ 375、详情、无溢出）；状态：未绑定、无成绩、失败、重试中骨架 | 4/4 |
| 拦截数据的自检（intercepted） | B30（参数 → 请求参数、生成中、概要、新标签打开、保存、越界禁用、条件已改、失败 + 重试、400 → 绑定提示、404 → 无数据 + 多端同步）；走势 820（五个参数）；进度（自动生成、类型切换与条件已改、定数口径、翻页到 2/2、星级、选项失败 + 重试）；推荐（参数、链接与 token、理由、未游玩无目标动作、选择目标 → 预览 → 确认 → 已设定、目标模式、候选不足、400 / 404 / 503 + 重试、普通推荐 400） | 4/4 |
| 拦截数据的自检（intercepted） | 页签在五个页面间来回（1440、390），手机底栏「我的」→ 入口 → B30；EP 开关（/about 无 → 成绩页有 → 编辑对话框的下拉 → 关闭后卸载 → 离开后类去掉且弹层与基线相同 → keepalive 返回恢复 → B30 / 推荐 / `/my` 有 → `/my/growth` 无）；`/my` 登录后与退出后的游客提示 | 4/4 |
| 合计 | `scores-selfcheck.mjs` 最终一次 | 25/25，0 控制台错误，0 水合警告；之后 `/my` 分组加回 `my-links` 类，`--only=my,ssr` 重跑 4/4（`final-my-rerun/`） |
| 指示性计时（dev） | 筛选 121、69 ms；路由切换 22–58 ms（页签往返里两次 267、296 ms 为首次编译后的冷切换）；最长任务 83 ms | 首个筛选超 100 ms 预算；开发模式只作参考 |
| 回归（共享文件） | 曲库 `catalog-selfcheck.mjs`；切片 A `detail-selfcheck.mjs` | 57/57 + SSR 失败 + 24/24；44/44 + SSR 失败 |
| 未验证 | 生产 Nitro、Linux 浏览器、真实数据库与登录、真实图片生成（Python 渲染）、真实推荐与目标写入、真机触控、读屏播报 | — |

运行：`node scripts/rework/scores-selfcheck.mjs --port=3572 --out=<目录> [--only=<场景前缀,…>]`（共享运行器：127.0.0.1、`TAIKO_DB_HOST=invalid.invalid`、
`no-egress.mjs`、一个系统 Chrome、同时一个页面、总时限、`finally` 结束进程树并确认端口空闲）。证据（不提交）：主检出
`.claude/stage-artifacts/slice-b/final/`（`slice-b-selfcheck.json`、截图、`nuxt-dev.log`）。`dev1/` 是开发中的几次运行（含 `FAILED-*` 截图）：
第一次 `/my` 有水合不一致（见「改动的数据代码」），成绩列表的场景脚本几处写错（隐藏的评价元素、keepalive 返回不重取、页码预期），
列表在重试期间仍显示错误而不是骨架、未绑定时显示错误而不是绑定提示（两处都改为上面的行为）。截图前缀 `*-intercepted-*` 为拦截数据，
`ssr-signed-out-*` 为真实服务端渲染。

### 回归结果

本切片改动后重跑（共享文件：`Shell.vue`、`Icon.vue`、`rework.css`、locale）：

- 曲库 `catalog-selfcheck.mjs --port=3561`：HTTP 57/57、SSR 失败通过、场景 24/24（筛选 / 排序 153、92 ms，路由切换 177、171、244 ms，最长任务 128 ms）。
  证据 `.claude/stage-artifacts/slice-b/regression-catalog/`。
- 切片 A `detail-selfcheck.mjs --port=3571`：场景 44/44、SSR 失败通过（页签 98 ms、路由 46 ms、筛选 / 排序 117、153 ms、最长任务 158 ms）。
  证据 `.claude/stage-artifacts/slice-b/regression-detail/`。
- 两次运行结束后端口均已空闲（`portFreeAfter: true`）。

### Linux 隔离验收（尚未运行）

在 `shell-sql.mjs` 加 `--check=scores`，新建 `scores-check.mjs`：沿用 `shell-check.mjs` 的合成账号做法（写入 `web_user_accounts`，真实 HTTPS 登录得到会话），
另外写入一条当前绑定与对应的 userdata 文件（`TAIKO_USERDATA_DIR` 指向 scratch，内容可用 `scores-fixtures.ts` 的 `fixtureScoreRows()` 转成 userdata
记录），歌曲目录用 `detail-data.mjs` 的 `writeDetailFiles()`。然后用生产 Nitro 跑 `runScoresScenarios()`，并把成绩列表、绑定切换、锁定、删除
（手动绑定）改为真实请求（`openContext` 需要加一个不拦截账号接口的开关，本切片没有写）。B30 / 走势 / 进度 / 推荐依赖 Python 渲染与推荐程序：
Linux 环境能运行时用真实图片与真实推荐，否则继续拦截并标明。通过标准：`SELECT DATABASE()` 以 `_test` 结尾 + `--allow-test-db-mutation`；
未登录 SSR 3 项与矩阵 10 组通过；真实登录下成绩列表的筛选、分页、锁定写入、手动删除写入在库里可见；`scripts/rework/scores-check.mjs` 与
`--check=scores` 本切片没有写。另：`tests/recommendationGoalNuxt.test.mjs` 已按新控件改了选择器，需要在 Linux 上跑一次。

### 看到但没有改

- `AccountSongEditorDialog.vue`、`AccountScoreImportDialog.vue` 仍是行内中日文案；编辑框的难度选项写死中文（`简单 … 里谱`），日文页也显示中文；编辑框标题行的
  「ID 3 / 4」里难度是数字。
- `/tools/recommend` 的目标请求直接用 `$fetch`，不经 `useViewerApiFetch`（普通推荐同样）；失败时原来只显示 `error.message`。
- 编辑对话框的 `el-select` 仍是常驻弹层（`persistent` 默认），由于对话框现在只在打开期间挂载，离开后不留节点。
- `scripts/performance/navigation-regression.mjs`、`scripts/verify_my_navigation_browser.mjs` 仍按 Stage 1 之前的侧栏与旧 `/my` 类名写，已经不能运行；
  `tests/viewer1RolloutNuxt.test.mjs` 断言 `.my-links` 恰好 1 个（旧页面已有两组），与本切片之前的页面同样不符。
- `useToolChartImage` 失败时的提示文字直接用服务端 `statusMessage`（中文），日文页也是中文；本切片把 400 / 404 改为自己的提示，其余失败仍显示服务端原文。
