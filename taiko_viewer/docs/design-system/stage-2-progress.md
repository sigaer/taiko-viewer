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

## 切片 C：今日、成长档案、这一周、目标

2026-11-18，基于 `a39f9e9`，未提交、未合并、未部署，版本仍为 `1.15.0`。没有改 `server/api/**`、没有新增接口、没有数据库访问。
**隔离验收（Linux）尚未运行**；下面除注明「真实」外都是本机开发自检，登录后的内容全部来自拦截的请求。

### 做了什么

- **页面**：`/`（`pages/index.vue`）、`/my/growth`、`/my/weekly`，地址不变。三页都设 `hidePageHeader: true` 与 `reworkElementPlus: true`，页面自己的 `<h1>`；
  两个成长页改为 `contentLayout: "wide"`（原来 growth 为 standard、weekly 为 reading），两个页签左缘相同。没有单独的目标页（按任务说明）。
- **呈现组件**：`components/rework/today/*`（Guest、SongSearch、LatestSongs、Events、Feed、Dan、Tools、AccountValue、Public、SignedIn、Board、Hello、
  Profile、Goal、GoalPicker、Plan）、`components/rework/growth/*`（MetricChart、Now、Milestones、Focus、Next、Songs）、`components/rework/weekly/*`（Hero、
  Highlights、Change）。页面文件只留取数、状态、SEO 与少量呈现用的计算（成长页的雷达起点与关注维度，周报的日期范围与关注句）。
- **保留原处、只换模板的业务组件**（测试按路径读它们的脚本）：`components/home/PlayerGrowthSurface.vue`（目标选择、替换、取消、判定与判定后刷新的脚本未改，
  只删去了已不用的行内中日文案与能力详情的显示函数，新增 `avatarUrl` 属性与两个呈现计算）、`RecentGrowth.vue`、`DailyProgress.vue`（脚本逻辑未改；
  每日进展的行内中日文案迁入 locale，文字相同）。它们不读 DS token，样式由 `components/rework/today/Board.vue` 以 `:deep` 提供。
- **删除**（全部由上面的组件代替，无其他引用）：`components/home/{GuestHome,GuestHero,GuestSongSearch,HomeLatestSongs,HomeCurrentEvents,HomeDanSummary,
  HomePublicTools,HomeAccountValue,HomeSectionHeader,BilibiliDynamicFeed,AuthenticatedHome}.vue`、`components/PassportMetricChart.vue`。
  `components/my-taiko/Overview.vue` 未动（没有任何页面挂载它，`homeDeepState` 仍测它的脚本）；`components/RecommendationSongItem.vue` 首页不再使用，
  但 `recommendationSongItem.test` 读它，保留到切片 G。
- **纯逻辑** `utils/rework/today.ts`：`GROWTH_TABS`、王冠 / 评价换算（`factCrown`、`rankValue`）、雷达轴（缺失值保持缺失，有可比的旧值才画虚线）、
  周报六维变化行（`deltaRows`）、带号数值、`?week=` 的上一周 / 下一周、日期格式、接口枚举值到 locale 键的静态表（使每个键都能核对）。
  图表的点（`metricLine`）放在 `utils/passportNarrative.ts`，紧挨 `passportMetricRuns`（成长页的组件测试工装只能解析一层 `~/utils/<name>`）。
- **共享件的增量**：`ReworkGate` 加 `primary` 事件（主操作被点击，给调用方埋点）与 `actions` 插槽；`ReworkIcon` 加 `forward`；`DsSongCell` 加 `showConstant`
  （传给 `DsDiff`，推荐项没有定数，`dsDiffTabs.test` 新增断言）；`rework.css` 加原生对话框 `.rw-dialog` 与单选行 `.rw-choice`。
- **外壳页签**：成长组改用 `GROWTH_TABS`：成长档案（`/my/growth`）→ 这一周（`/my/weekly`）。页签名与各页 `<h1>` 相同：新增 `rework.passport`，
  `rework.weekly` 由「周报 / 週報」改为「这一周 / この一週間」。今日是单页，没有页签（不变）。
- **文案**：新增 `rework.home.*`（含 Bilibili 动态与每日进展，迁自组件内的中日文案，文字不变）、`rework.growthPage.*`、`rework.weeklyPage.*`，中日一一对应。

### 首页的状态与呈现

| 状态（`resolveHomePresentation` / `homeState`） | 呈现 |
| --- | --- |
| `loading`（账号状态解析中） | `ReworkTodayPublic`：骨架（`role=status`、`aria-busy`），读屏 `<h1>`；最新歌曲、当前动态、段位、常用工具照常 |
| `public_error`（auth / binding / scores 任一阶段失败） | 同一页面，`ReworkState` failed：按阶段的原文案 + 重试（同一 `refresh()`） |
| `guest` | `ReworkTodayGuest`：标题、说明、歌曲搜索、登录 / 浏览歌曲；右侧（< 1240 在搜索下方）最新歌曲；常用工具；当前动态 + Bilibili 动态；段位；登录后能用什么 |
| `authenticated_unbound` | 身份行 + `ReworkGate need="binding"`（原标题与说明，去 `/account/profile`，另有「查看我的成绩」），下方公开块与常用工具 |
| `authenticated_bound_empty` | 身份行 + `ReworkState` empty（原标题与说明，主操作「同步成绩」去 `/account/sync`，另有「查看我的成绩」），下方公开块与常用工具 |
| `authenticated_ready` | `PlayerGrowthSurface`：身份行与问候 `<h1>`；Rating 刻度盘 + 六维雷达 + 观察句｜当前目标；最近同步的变化｜今日进展；接下来可以练；下方最新歌曲、当前动态、段位 |
| ready 内：概览读取中 / 失败 / 后台刷新中 / 后台刷新失败 | 骨架 / 失败 + 重试 / 提示行 / 失败 + 重试（原逻辑） |
| ready 内：最近变化 读取中 / 失败 / `new` / `caught-up` / `unavailable` | 骨架 / 失败 + 重试 / 事实列表（王冠带名、评价带名）/ 原叙述句 / 不显示（原逻辑） |
| ready 内：今日 `played` / `not_played` / `unknown` / 只记录游玩 / 变化已在目标里 | 事件列表 / 原文案（各一句，原判定） |
| ready 内：数据 `ready` / `limited` / `insufficient` | 雷达标出关注维度 / 不标 / 没有值时不画雷达、刻度盘显示「—」 |

### 目标的状态（首页）

没有目标（不显示目标卡，推荐行上「设为目标」）；进行中（曲绘、目标类型、选择时的值、设定日、谱面不可用提示；查看谱面、练后同步〔外部同步的绑定〕、确认进展、换一首、取消）；
判定结果 `active` / `inconclusive`（原两句提示，判定后重新读取概览与最近变化）、`completed`（完成卡：分数 / 不可为前后值，全连 / 全良 / 通关为带名王冠，评价为前后两个带名评价；
其他事实；再选一首）；判定失败（原错误句）；保存冲突 409（对话框内原冲突句）；判定后刷新失败（失败 + 「再试一次」，在恢复前禁止新选择，原逻辑）。
选择对话框：没选曲时列出其他可设目标的推荐（或没有的提示）与「查看更多推荐」；选了曲时列目标类型（单选）、错误、取消 / 确认。成长档案只展示目标（进行中与刚完成），
不在那里操作（与原来相同）。

### 功能对照：`/`（改前 → 改后）

| 改前 | 改后 |
| --- | --- |
| 年度入口横幅（`AnnualHero`，全宽） | 不变（年度组件未动），外层限宽 612 px，桌面不再占满一屏宽 |
| 游客：品牌与版本、标题、说明、歌曲搜索、「查看我的太鼓数据」「浏览歌曲」、范围说明 | 全部保留，按冻结的 Today.vue 左栏排版；手机隐藏范围说明（原来同样） |
| 游客搜索：只搜实装（`shelfStatus=0`，12 条取 6），回车打开第一首 | **改为全站搜索的同一契约** `songSearchRequest`（全部上架状态，8 条）；超过 8 首时最后一项「查看全部 N 首结果」→ `catalogLocation(searchAllState(q))`；↑↓ / 回车 / Esc、清空、加载 / 失败 / 无结果、埋点不变 |
| 最新歌曲：5 张大卡（曲绘、两种曲名、上架日原样） | 5 行：`DsCover`、页面语言曲名、另一语言名、上架日（YYYY-MM-DD）、魔王难度与星级（`DsDiff`，无定数位）；「查看全部」→ `/songs`；加载骨架；失败或空为原文案 |
| 当前动态：两张活动图（手机只显示第一张）、Bilibili 动态（进入视口前占位，失败则整块移除） | 两张活动图都显示（原样 `loading="lazy"`、`decoding="async"`，加了宽高），标题在图下而不是叠在图上；动态的懒创建、5 分钟缓存、图片代理、链接与失败移除逻辑不变 |
| Bilibili 动态：作者、动作、时间、正文折叠、图片九宫格、预览（`el-dialog`）、视频卡、转评赞、来源 | 全部保留；预览对话框只在打开期间挂载；空状态由 `el-empty` 改为 `ReworkState` |
| 段位：NIJIIRO 2026、标题、说明、「查看段位」、完整一览（新窗口）、预览图（新窗口） | 全部保留，链接与埋点不变；预览图不再旋转 |
| 常用工具：查配置、查物量、谱面攻略、段位查询 + 「查看全部」 | 不变（同样的地址与埋点） |
| 登录后能用什么：说明、能力标签、登录；右侧装饰卡「12,840 RATING」与彩条 | 文字、标签与登录保留；**装饰卡删去**（一个接口没返回的数字） |
| 账号状态加载中 / 失败：文字 + 重试；公开块 | 骨架 / `ReworkState` failed（按阶段文案）+ 重试；公开块不变 |
| 未绑定：标记、眉标、标题、称号、说明、「绑定账号」、「查看我的成绩」 | `ReworkGate` binding（同去向、同埋点）+「查看我的成绩」；头像、名字、称号在上方 |
| 无成绩：同上，主操作「同步成绩」 | `ReworkState` empty + 「同步成绩」「查看我的成绩」（同去向、同埋点） |
| 有数据：问候 `<h1>`、称号、「看看这一周」「成长档案 →」 | 头像、名字、称号、两个链接（名称改为两页标题「这一周」「成长档案」）、问候 `<h1>` |
| 折叠的「能力详情」：Rating、观察句、六维小格（关注维度加粗） | 不再折叠：`DsDrumDial`（Rating / 15.5）、`DsRadar`（六维，关注维度标出）、观察句、「成长档案」链接 |
| 最近同步的变化：最多 5 条、恢复说明、另有 N 项、空的叙述句、失败重试；渲染后确认 | 不变（脚本未改）；每条加曲绘，王冠类事实显示带名王冠，评价类显示带名评价 |
| 今日进展：日期、游玩谱面数、状态句、事件（曲名链接、难度、事实前后值） | 不变；加曲绘；全连 / 全良 / 通关为带名王冠，评价为前后两个带名评价 |
| 推荐：标题为语气句、曲绘曲名难度星级、当前最好分数、设为目标 / 已选 | 同上，用 `DsSongCell`；**新增**当前最好评价（接口已有 `currentBestRank`）与「全部推荐」→ `/tools/recommend` |
| 目标卡与对话框 | 见上节；`<dialog>`、焦点陷阱与恢复、请求体逐项不变（场景核对 POST 内容） |

### 功能对照：`/my/growth`

| 改前 | 改后 |
| --- | --- |
| 未登录：标题 + 登录（不带回本页） | `ReworkGate` login（带回本页）+ 注册；服务端首屏即为该提示（真实 SSR） |
| 加载 4 条闪烁块；失败：标题、服务端文字、「成长档案入口」、重试 | 骨架；`ReworkState` failed（同标题、同文字、同链接与重试） |
| 页首：「现在的我」、记录自、Rating、观察句、六维条与「暂无记录」、看看这一周 | 页首为「成长档案」`<h1>`、记录自、看看这一周；侧栏「现在的我」：`DsDrumDial`、`DsRadar`（实线现在；可比时虚线为本时期起点 `currentSegmentChange.start`，带日期图例）、缺失的维度以「暂无记录」列出（不足三项时列出全部值）、观察句 |
| 范围 30/90/180/365（`aria-pressed`，写地址），更新中、失败重试、实际记录日 | 不变（分段按钮）；范围在接口返回的 `shared` 中客户端选取，不重新请求（原逻辑） |
| 两张图：Rating、所选维度（6 个按钮，写地址）；手写 SVG：按日期定位、可聚焦的点、←/→、选中读数与前后按钮、摘要句 | `DsLineChart` × 2（见「图表」）；摘要句、选中读数、前后按钮保留；图表本身可聚焦，←/→/Home/End 切换点，选中点在线上标出 |
| 精彩时刻：日期 / 确认日、标题句、曲名链接、难度、证据、更多证据、目标完成、展开 / 收起、覆盖说明 | 全部保留，竖向时间线；全连 / 全良 / 通关为带名王冠，评价为前后带名评价 |
| 关注方向：了解更多、变化句、按时期的列表（当前高亮） | 全部保留；时期为一条带（当前段标出，`aria-current`） |
| 想继续的话：进行中 / 已完成的目标（链接、类型）、建议句、推荐曲 | 全部保留；推荐曲用 `DsSongCell` |

### 功能对照：`/my/weekly`

| 改前 | 改后 |
| --- | --- |
| 未登录：标题 + 登录 | `ReworkGate` login（带回本页）（真实 SSR） |
| 加载；失败 + 成长档案入口 + 重试 | 骨架；`ReworkState` failed（同内容） |
| 本周 / 完整一周、刷新、日期范围、6 个合计、主题句、覆盖说明、看成长档案 | 全部保留：`<h1>`「这一周」、眉标、日期范围、刷新；**新增上一周 / 下一周**（现有 `?week=` 契约，下一周只在已完成的一周出现）；主题句作大字；6 个合计横排（手机两列） |
| 值得记住的变化：变化句、曲绘与曲名链接、难度、目标完成 | 保留（类名 `weekly-rhythm`）；全连 / 全良为带名王冠，评价为前后带名评价 |
| 能力变化：主维度前后与差值、Rating 差值、关注方向句；记录方式不同（可展开）；其他原因句 | 保留；**新增**六个维度各自的差值与比例条（接口已有 `dimensionDeltas`；最大增幅标出，缺失为「—」） |
| 当前建议：观察句、推荐曲或「暂无」 | 保留 |

### 图表（替换了什么，用的哪些真实数据）

| 位置 | 组件 | 数据 |
| --- | --- | --- |
| 首页 Rating | `DsDrumDial`（15.5 / 0.5） | `/api/account/growth/overview` `playerState.overallRating` |
| 首页六维 | `DsRadar` | `playerState.skills`（> 0 的值），关注维度 `priorityDimension`（数据就绪且未全部并列时） |
| 成长档案 Rating / 维度走势（原 `PassportMetricChart` 手写 SVG） | `DsLineChart` | `segments[].points`（经 `passportMetricRuns`，只用测得的点；缺值处断开） |
| 成长档案现在的我 | `DsDrumDial` + `DsRadar` | `current.rating`、`current.dimensions`；虚线 `currentSegmentChange.start.dimensions`（仅 `compatible`） |
| 周报能力变化 | 保留手写比例条（token 着色） | `measurementChange.dimensionDeltas`：一组带正负号的差值，没有对应的 DS 图表 |
| 谱面带（`DsLane`） | 没有使用 | 生产没有逐日的游玩数据（首页只有今天、周报只有合计），不合成日子 |

`DsSpark` 没有使用：首页概览没有序列。原图按日期定位横轴，`DsLineChart` 按测量顺序等距排列、标签为日期（偏离，见下）。

### 与原型或规则的偏离与原因

- **首页（有数据）**：没有原型第二行的 21 天谱面带与按天进展（无逐日数据），改为「最近同步的变化｜今日进展」两栏；没有「近 30 天 / 全站位置 / 连续游玩」、
  六维 30 天前的虚线、目标尝试轨迹、「社区正在聊」（首页没有这些数据；社区块属于切片 D 的数据面）。问候 `<h1>` 沿用原语气规则，不用原型「上次同步带来 N 条」的主句（语气规则冻结）。
- **首页（游客）**：右侧不放原型的示例谱面带（示例数据），放真实的最新歌曲，手机在搜索下方，首屏可见（场景断言第一行 < 844 px）。没有原型的「社区精选」（切片 D）。
  搜索框是真实的输入框（原型是打开全局面板的按钮），以保留原有的就地结果；年度横幅限宽。
- **未绑定 / 无成绩**：用 `ReworkGate` / `ReworkState`（裁定 4），没有原型的三步清单。
- **成长档案**：保留两张图（Rating 常显 + 维度图），原型是一张图加指标切换——原页面可以同时看 Rating 与一个维度，合成一张会少功能。横轴按测量顺序而不是日期比例。
  侧栏在 < 1100 时移到主栏之前（先看现在的我）。
- **周报**：主题句不作 `<h1>`（`<h1>` 与页签同名，同切片 B 的约定），作大字放在页首下；没有原型的七天谱面带、「生成这一周的图片」（无接口）。
- **P1**：王冠一律带可见文字（`DsCrown text="full"`）；评价升级显示前后两个带名评价（`DsRank variant="upgrade"` 只有图，没有可见名称）。
- **目标卡** 只在有目标时出现（原型同样）；目标在成长档案只展示不操作（与原来相同）。

### 契约缺口（生产没有，界面不放替身）

- 逐日游玩活动（首页 21 天、周报 7 天的谱面带与按天进展）；连续游玩天数。
- Rating 近 30 天变化、全站位置；首页六维的历史值（概览只有现在）。
- 目标的尝试记录与当前进度（只有选择时的基线和完成时的前后值）；目标历史列表。
- 时间栈里的 Rating / 段位里程碑（裁定 4）；关注方向与里程碑共用一条时间轴需要按日期的点（现有接口可以，但原型的时间栈组件不在生产）。
- 周报图片生成；首页的社区热帖（切片 D）。

### 改动的数据代码（请重点复核）

- `pages/index.vue`：模板改为三个组件；脚本只加了两个 meta 键。状态解析、内容读取、活动图列表、SEO 未改。
- `pages/my/growth.vue`：加 meta 与 `radarStart`、`radarFocus` 两个呈现计算；取数、范围 / 维度路由、错误处理未改。
- `pages/my/weekly.vue`：加 meta 与 `rangeText`、`focusText`；删去已不用的 `signed`、`totalFields`。取数与 `?week=` 处理未改（上一周 / 下一周链接在 `weekly/Hero.vue`）。
- `components/home/PlayerGrowthSurface.vue`：见「做了什么」。`completedSupport`、`completedTypeText`、`profileFocus` 只是把原模板里的表达式移成计算。
- `components/home/RecentGrowth.vue`、`DailyProgress.vue`：只改模板；`DailyProgress` 的三句文案改由 locale 提供（文字相同，`homeDailyProgress` 测试仍按原文核对）。
- 首页搜索的请求由「实装、12 条」改为全站搜索的请求（裁定 3），这是唯一有意改变请求参数的地方。

### 业务测试基线（改前 → 改后）

见下面「验证」表的第一行与附表；两次都在本机逐文件运行同一组 51 个文件（不需要数据库与浏览器的那些）。

### 看到但没有改

- 首页 `GuestHome` 的「账号状态不可用」提示永远不会出现：只有 `presentation === 'guest'` 时渲染，而它的条件是 `presentation === 'public_error'`（原样保留在 `ReworkTodayGuest` 的属性上）。
- 原 `AuthenticatedHome` 有一个永远走不到的分支（`personal-top`，三种登录态都已被其他分支覆盖），没有搬过来。
- 埋点 `home_latest_song_click` 与段位、工具的埋点在登录后的首页仍写 `home_state: 'guest'`（原样）。
- `scripts/verify_growth_*_browser.mjs`、`verify_home_p0e.mjs`、`verify_training_loop_browser.mjs` 等 Linux 浏览器脚本依赖的类名：保留了 `growth-surface`、`growth-goal(--completed)`、
  `goal-evaluate`、`goal-actions`、`growth-plan(__choice/__choose)`、`growth-progress`、`growth-event`、`growth-loading`、`recent-growth(__fact/__empty)`、`passport-page/-hero/-range[data-range]/-dimensions/-updating/-refresh-error/-loading/-chart-detail`、
  `weekly-page/-hero/-refresh`、`home-page`、`guest-hero`、`guest-song-search__result/__status`；不再存在：`passport-chart circle`、`passport-chart__segment path`、`growth-skill`、
  `personal-status`、`growth-surface img`（这些脚本里已有更早就失效的选择器，如 `growth-metric`、`passport-change`）。这些脚本需要在 Linux 上按新结构更新后才能作为验收。
- `components/my-taiko/Overview.vue` 没有页面挂载，仍是行内中日文案。

### 改动的测试断言（逐条）

1. `tests/growthPassportHttp.test.mjs`：图表源文件由 `components/PassportMetricChart.vue` 改为 `components/rework/growth/MetricChart.vue`；`role="group"`、`tabindex="0"` 两条不变；
   `passport-chart__segment`（每段一个 `<g>`，被替换的呈现）改为 `passportMetricRuns(`、`metricLine(`、`<DsChartsLineChart`。
2. `tests/growthPageState.test.mjs`：「actual SVG chart …」一条挂载的组件路径改为新图表组件；模型断言（点数、段数、选中点、前后步进、维度切换清空选择、空数据）一条未改，全部通过。
3. `tests/reworkStage2.test.mjs`（切片 B 的边界断言）：`/my/growth`、`/my/weekly` 原断言「不带 `reworkElementPlus`（属于切片 C）」，改为断言带上。
4. `scripts/rework/scores-scenarios.mjs`（切片 B 的 EP 开关场景）：原断言 `/my/growth` 没有 `rework-ep`，改为有，并再去 `/about` 断言去掉。
5. 新增：`tests/reworkStage2.test.mjs` 10 条切片 C 测试；`tests/dsDiffTabs.test.mjs` 的 SongCell 用例加 `showConstant` 三条断言。

### 验证

| 层级 | 内容 | 结果 |
| --- | --- | --- |
| 业务测试基线（真实） | 同一组 51 个测试文件逐个运行（home-state、growth、goal、training、weekly、passport、recent、experience、voice、history、refresh 及读首页 / 成长源码的测试）；改前 → 改后 | 改前：其中 11 个文件有失败，全部是本机环境原因（`Bounded QA run paths required`、`/var/tmp` 不存在、canonical/golden 回放）；改后：逐文件通过 / 失败数相同，唯一差别 `dailyAbilityArchive` 由 0/1 变 1/1（`/var/tmp` 目录状态，与本切片无关）与 `reworkStage2` 9 → 19（新增）。关键文件：`homeDeepState` 23/23、`homeDailyProgress` 2/2、`growthEvaluationRefresh` 1/1、`growthRecentHttp` 3/4（第 4 条环境）、`growthPassportHttp` 3/3、`growthWeeklyHttp` 3/3、`growthPageState` 9/9、`goalEvaluation` 36/36、`growthVoice` 52/52、`homeGrowthFeedback` 29/29 |
| 静态 / 单元（真实） | `npm run test:ds`、`npm run check:ds`、`npm run test:version`、`reworkStage1`、`reworkStage2` | 90/90；通过（tokens、对比度 368/368、token 对照表已重新生成、scoped CSS 设计系统目录 0、ds usage 113 文件 0、ds copy 109 文件）；1/1；14/14；19/19 |
| 静态（真实） | `today-fixtures.ts` 用 tsc strict 按真实响应类型检查（`PlayerGrowthOverview`、`RecentGrowthResponse`、`SkillPassportResponse` 含 `shared`、`WeeklyGrowthResponse`、`PlayerGoal`、`BilibiliDynamicResponse`、`AccountAuthUser`） | 该文件 0 错误（导入的 composable 在 Nuxt tsconfig 之外有自动导入名报错，同切片 B） |
| 本机真实 SSR / API（`nuxt dev` + 合成文件） | 游客首页中日：服务端 HTML 带 `rework-ep`、`data-home-presentation="guest"`、标题、搜索框；水合 0 警告 0 错误；最新歌曲 5 行（真实 `/api/content/home`）、工具 4、活动 2（`loading=lazy`）、段位链接新窗口、登录 / 浏览 / 登录后能用什么的去向；Bilibili 动态因无外网真实失败 → 整块移除。`/my/growth`、`/my/weekly` 未登录：服务端 HTML 带登录提示与 `rework-ep`，登录链接带回本页，`<h1>` 与页签同名。游客矩阵 360/390/820/1440 × 浅深（中）+ 日文 390 浅 / 1440 深：无横向溢出，< 768 时第一首最新歌曲在首屏内，今日无页签。游客搜索：请求为 `view=list&page=1&pageSize=8&keyword&sort=catalog`（无 shelfStatus），8 条 + 「查看全部 N 首」（N = 同一请求的 total）、↓ 到查看全部回车 → `/songs?q=合成&shelf=all`、点结果进详情、无结果、Esc 关闭 | 2 + 10 + 1 组通过（搜索失败一步为拦截） |
| 拦截数据的自检（intercepted） | Bilibili 动态有内容（链接、新窗口、头像经代理且 lazy、展开 / 收起、九宫格预览对话框在 EP 映射下打开并卸载）/ 空；最新歌曲读取中 / 失败；账号状态读取中 → 绑定读取失败（阶段文案）→ 重试 → 有数据；未绑定、无成绩各 1440 浅 / 390（深 / 浅） | 7 组通过 |
| 拦截数据的自检（intercepted） | 有数据首页矩阵 10 组：唯一 `<h1>`、刻度盘与雷达的可访问名称、雷达文字无裁切 / 重叠、目标卡链接（谱面、`/account/sync?profileId=1&from=goal`）、最近变化与今日进展的王冠名与评价名、推荐 6 行 5 个设为目标、无常用工具、无横向溢出、渲染后发出确认（`tok-1`） | 10/10 |
| 拦截数据的自检（intercepted） | 目标：无目标 → 选择（对话框、三个类型、未选不能确认、POST 内容逐项）→ 已选 → 换一首（列出 4 首、409 冲突提示、重试成功、`expectedActiveGoalId`）→ 判定 active / inconclusive（提示句 + 重新读取概览）→ 判定失败 → 判定完成（带名王冠）→ 再选一首；取消（DELETE + 期望 id）；完成：分数前后 / 评价前后带名；谱面不可用；概览读取中 → 失败 → 重试；最近变化失败 → 重试 → 已看过；没打、未知、只记录游玩；没有推荐；数据不足（无雷达、刻度盘「—」） | 6 组通过 |
| 拦截数据的自检（intercepted） | 成长 / 周报矩阵 10 组（360/390/820/1440 × 浅深 + 日文 2）：两张走势图 + 刻度盘 + 雷达的名称、图表文字无裁切 / 重叠、页签名 = `<h1>`、页签切换、两页 `<h1>` 左缘相同、周报合计 6、亮点 4（王冠名、评价名）、六维变化 6 行、无横向溢出；成长功能：范围从 `shared` 客户端切换（不重新请求、地址写入、摘要改变）、维度切换写地址、图表聚焦后 ← / Home 改读数、选中点标在线上、精彩时刻 8 → 11 → 8、王冠 / 评价名、关注方向 3 段与当前段、虚线图例、两个目标链接、推荐 3、看看这一周；失败 + 资料链接 + 重试；无当前记录与无精彩时刻；周报功能：上一周（`?week=2026-11-09`、请求带 week、已完成一周两侧都有）、刷新重新读取、无亮点 + 记录不足 + 无建议、记录方式不同 + 覆盖说明、失败 + 重试；EP 开关（/about 无 → 三页有 → 离开去掉 → 返回恢复） | 10 + 4 组通过 |
| 合计 | `today-selfcheck.mjs` 最终一次 | **51/51**，0 控制台错误，0 水合警告，0 Vue 警告；端口 3573 结束后空闲 |
| 指示性计时（dev） | 成长 ↔ 周报页签切换 111–139 ms；最长任务 164 ms | 开发模式只作参考 |
| 回归（共享文件） | 曲库 `catalog-selfcheck`（3561）；切片 A `detail-selfcheck`（3571）；切片 B `scores-selfcheck`（3572） | HTTP 57/57、SSR 失败通过、24/24；44/44 + SSR 失败；25/25；三次结束后端口空闲 |
| 未验证 | 生产 Nitro、Linux 浏览器、真实数据库与登录、真实的目标写入与判定、真实 Bilibili 接口、真机触控、读屏播报 | — |

运行：`node scripts/rework/today-selfcheck.mjs --port=3573 --out=<目录> [--only=<场景前缀,…>]`（共享运行器）。证据（不提交）：主检出
`.claude/stage-artifacts/slice-c/final/`（`slice-c-selfcheck.json`、43 张截图、`nuxt-dev.log`；前缀 `*-intercepted-*` 为拦截数据，`ssr-*`、`guest-*` 为真实服务端与合成文件），
`regression-catalog/`、`regression-detail/`、`regression-scores/`。开发中的问题如实记录：图表组件最初用 `<DsRadar>` 等短名，但图表目录自动注册为 `DsCharts*`，第一次矩阵里
刻度盘与雷达没有渲染（改为显式导入 / 注册名）；成长页「想继续的话」的目标卡在侧栏撑出横向溢出（加 `min-width: 0`）；周报页和图表组件最初导入嵌套的 `~/utils/rework/today`，
`growthPageState` 的组件工装只能解析一层路径而失败（改为页面不导入、图表的点放到 `utils/passportNarrative.ts`）；场景脚本几处写错（判定后的概览应带目标、范围切换不重新请求）。

### Linux 隔离验收（尚未运行）

在 `shell-sql.mjs` 加 `--check=today`，新建 `today-check.mjs`：曲库用 `detail-data.mjs` 的 `writeDetailFiles()`；登录态沿用 `shell-check.mjs` 的合成账号
（`SELECT DATABASE()` 以 `_test` 结尾 + `--allow-test-db-mutation`），写入一条当前绑定与 userdata（可由 `today-fixtures.ts` 的数据转换），再用生产 Nitro 运行
`runTodayScenarios()`：游客 SSR 与矩阵、搜索直接可用；首页四种登录态、目标的选择 / 替换 / 取消 / 判定、成长与周报改为真实请求（`openContext` 需要一个不拦截账号接口的开关，
本切片没有写），并核对目标写入在库里可见。通过标准：场景全部通过、0 水合警告、截图 `acceptance_*`、私有 MySQL / Nitro 退出。另需在 Linux 上按新结构更新
`verify_growth_*_browser.mjs`、`verify_home_p0e.mjs`、`verify_training_loop_browser.mjs` 的选择器（见「看到但没有改」）后再跑。`today-check.mjs` 与 `--check=today` 本切片没有写。

### 设计复核后的修改（切片 C，2026-11-18）

1. 有数据首页的页首合为一行：头像在问候 `<h1>` 旁（名字只在问候里出现一次，原来身份行与问候连续两次出现名字），站内称号在 `<h1>` 下；「这一周 / 成长档案」≥ 768 在同一行右侧，
   手机在 `<h1>` 下方（`rework/today/Hello.vue`；头像原来就没有链接）。场景断言名字在页首只出现一次、头像在 `<h1>` 左侧、操作的位置按宽度。
2. 目标卡（≥ 1100）不再被拉到与左侧 Rating / 雷达卡等高：卡片取自然高度，曲目、目标说明与操作保持在一起（`Board.vue` `.tb-goal { align-self: start }`，`Goal.vue` 去掉
   `margin-top: auto` 与 `height: 100%`）。进行中、完成（分数 / 王冠 / 评价）、谱面不可用三种状态在 820 与 1440 各断言「曲目到操作」的距离；没有目标时不显示目标卡，提示行在页首下方，不受影响。
3. **进程清理规则**：曾按命令行匹配结束本机全部无头 `chrome.exe`，违反 AGENTS.md 的内存规则（不得大范围结束进程）。`scripts/rework/selfcheck-runner.mjs` 现在用
   `chromium.launchServer()` 启动浏览器并记录其 PID（`report.browserPid`），`finally` 中先正常关闭，仍存活时只结束这一棵进程树，结果写入 `report.browserStoppedAfter`
   （为 `false` 时运行失败）；开发服务器仍按 spawn 的 PID 结束进程树。所有切片的自检共用此运行器。

重跑 `today-selfcheck.mjs`：**54/54**（新增目标状态 1440 的 3 组），0 控制台错误、0 水合警告、0 Vue 警告；`portFreeAfter: true`、`browserStoppedAfter: true`。
证据 `.claude/stage-artifacts/slice-c/review-fixes/`；`final/` 中的 `home-ready-intercepted-zh-1440-light`、`-zh-390-dark`、`-zh-820-light` 已替换。
曲库与切片 A / B 回归未重跑（只改了切片 C 的组件与运行器的浏览器启动方式）。
