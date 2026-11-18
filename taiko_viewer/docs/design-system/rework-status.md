# 整站 Rework 状态（2026-11-18）

分支 `feature/viewer-rework-stage5`，包含 Stage 1 到切片 G 的全部提交。`taiko_viewer/package.json` 版本为 1.15.0（`233ea32` 从 1.14.0 升上来，`main` 仍为 1.14.0）。
没有合并 `main`，没有部署。只有 Stage 1 第一切片（导航与搜索）在 Linux 隔离环境跑过（`qa-…` 系列 run）；从统一曲库到切片 G，**没有一个切片跑过 Linux 隔离验收**。
下文「本机真实验证」都是 Windows 上的开发自检，不是验收。各切片细节见 `stage-1-progress.md` … `stage-5-progress.md`，规则见 `rework-playbook.md`。

## 各切片

### Stage 1 导航与搜索

- 覆盖内容：默认布局的六组桌面导航、顶栏页签、五项手机导航、中央搜索按钮；搜索面板（`/api/content/songs`，最多 8 首）。
- 提交：`c75facc`（契约起步）、`233ea32`（Keepalive / Teleport 修复，单独可留）、`a4bf423`（外壳与搜索集成）。
- Linux 隔离验证（真实）：Keepalive 5/5 `qa-9f98f83f8625`；DS 静态门禁 17/17 `qa-5d5fbe90bc70`；标准构建通过 `qa-27fa158bca03`；生产 Nitro 浏览器矩阵 20/20 `qa-5092f44ce964`；私有测试库真实 HTTPS 登录与发帖头部。
- 仅拦截数据：无。
- 未验证：实机 iOS / Android 键盘；浏览器 runner 未采集内存峰值。
- 未完成：搜索别名排序、最近搜索、同步 / 通知面板的完整形态。

### Stage 1 统一曲库

- 覆盖内容：`/songs`、`/ja/songs` 合并三个旧列表；旧地址 `/songs/{available,removed,other}`、`/songs/v2-constants` 服务端 302；搜索面板「查看全部 N 首结果」。
- 提交：`74dafff`。
- 本机真实验证：`test:ds` 88/88、`reworkStage1` 14/14、`songShelvesHttp` 1/1；`nuxt dev` 原始 HTTP 57/57（48 个 302 + 9 个不得重定向）；数据文件不可读时 SSR 失败态与重试通过；真实 dev API + 合成数据文件场景 24/24。
- 仅拦截数据：请求失败与重试（失败由拦截注入）；`--stub` 模式另跑一遍同样结果。
- 未验证：生产 Nitro、Linux 浏览器、真实曲库数据规模、真机触控 / 软键盘、读屏、Lighthouse。
- 计时：dev 上首个筛选 159 ms、一次路由切换 238 ms，超预算，以 Linux 生产产物为准。
- 设计复核改了两处（上架状态叫法、搜索结果计数），之后没有重跑浏览器自检。

### 切片 A：页面基础件、歌曲详情、定数表

- 覆盖内容：`/songs/:id`、`/songs/constants`；`ReworkPageHeader / Panel / State / Gate / Pager`、Element Plus 映射开关（`reworkElementPlus` → `html.rework-ep`）、`rework.css`。
- 提交：`b41c2e7`。
- 本机真实验证：`test:ds` 90/90、`check:ds` 通过；详情、V2、谱面图、TJA 包、定数列表走真实接口（合成文件）；`/songs/99` → 301；SSR 失败态与重试；场景 44/44 + SSR 失败 1/1；EP 开关与 Teleport。
- 仅拦截数据：登录态的成绩面板、推荐目标、UGC 投票与标签、相关讨论；定数接口失败与过期提示。
- 未验证：生产 Nitro、Linux 浏览器、真实数据规模、真实数据库与登录、真机触控、读屏、音频实际播放。

### 切片 B：成绩

- 覆盖内容：`/account/songs`、`/my`、`/tools/b30`、`/tools/trend`、`/tools/progress`、`/tools/recommend`。
- 提交：`a39f9e9`。
- 本机真实验证：`reworkStage2` 9/9、受影响的现有测试 52/52；未登录 SSR 3/3（302、登录提示、水合 0 警告）。
- 仅拦截数据：登录后全部内容（矩阵 10 组 60 页、成绩列表功能、四个工具页、页签与 EP 开关）；合计 `scores-selfcheck` 25/25。
- 未验证：生产 Nitro、Linux 浏览器、真实数据库与登录、真实图片生成（Python 渲染）、真实推荐与目标写入、真机触控、读屏。

### 切片 C：今日、成长档案、这一周

- 覆盖内容：`/`（游客、未绑定、无成绩、有数据四种状态与目标）、`/my/growth`、`/my/weekly`。
- 提交：`f493816`。
- 本机真实验证：51 个业务测试文件改前改后逐文件相同；`reworkStage2` 19/19；游客首页 SSR、真实 `/api/content/home`、游客矩阵与游客搜索；成长 / 周报未登录 SSR。
- 仅拦截数据：登录后首页、目标的选择 / 替换 / 取消 / 判定、成长与周报全部内容、Bilibili 动态有内容时；合计 `today-selfcheck` 54/54。
- 未验证：生产 Nitro、Linux 浏览器、真实数据库与登录、真实目标写入与判定、真实 Bilibili 接口、真机触控、读屏。

### 切片 D：社区

- 覆盖内容：`/forum`、`/forum/section/:slug`、`/forum/discussions`、`/forum/thread/:id`、`/forum/new`、`/forum/me`、`/forum/notifications`；外壳铃铛未读数；歌曲页相关讨论。
- 提交：`6371b6c`。
- 本机真实验证：论坛 14 个测试文件改前改后逐文件相同；`reworkStage3` 11/11；P0 编译检查；无数据库 SSR 2/2（失败态、302、水合 0 警告）。
- 仅拦截数据：全部论坛读写与登录态（没有在任何服务器上写入）；合计 `community-selfcheck` 27/27；键盘是桩出的 `visualViewport`。
- 未验证：真实数据库与登录、生产 Nitro、Linux 浏览器、真实上传与限流、真机软键盘（P0）、真机触控、读屏。

### 切片 E1：登录、注册、找回、档案、设置

- 覆盖内容：`/account/login`、`/account/register`、`/account/forgot-password`、`/account/profile`、`/settings`。
- 提交：`f3c10b2`。
- 本机真实验证：账号相关 19 个文件 / 命令改前改后逐文件相同（`accountEntryState` 因工装修正 22→28）；`reworkStage4` 8/8；无数据库 SSR 2/2（表单 `name` / `autocomplete`、OIDC 列表、302）；设置页主题 cookie、缓存、语言 1/1。
- 仅拦截数据：登录、注册、找回、OIDC 开始、档案全部读写；合计 `account-selfcheck` 25/25。
- 未验证：真实数据库与登录、真实 OIDC 往返、真实邮件验证码、生产 Nitro、Linux 浏览器、密码管理器保存与填充、真机触控、读屏。

### 切片 E2：同步、开发者、工单

- 覆盖内容：`/account/sync`、`/account/developer`、`/account/developer/grants`、`/account/developer/review`、`/docs/score-token`、`/support`、`/account/support/review`；外壳同步按钮状态。
- 提交：`34d4f5a`。
- 本机真实验证：16 个测试文件改前改后逐行相同；`reworkStage4` 15/15；`/docs/score-token` SSR 与六个登录页 302，2/2。
- 仅拦截数据：同步、token、迁移、开发者申请与审批、授权、工单全部内容（token 全是合成值）；合计 `account2-selfcheck` 25/25。
- 未验证：真实数据库与登录、真实同步与鼓众广场、真实邮件、生产 Nitro、Linux 浏览器、真机、读屏。

### 切片 F：段位、攻略、称号、工具、更多、关于、别名记录、练习页

- 覆盖内容：`/grade/*`、`/guide`、`/guide/:d/:l`、`/titles`、`/tools/{chart-config,note-count,rt-calculator,tja-constants,word-cloud}`、`/more`、`/about`、`/alias-log`、`/ourtaikoview/:id/:d`。
- 提交：`519bfac`。
- 本机真实验证：19 个测试文件改前改后相同；`reworkStage5` 12/12；SSR 2/2；合成文件 / 合成上游的段位、攻略、称号、更多、别名记录；工具输出改前改后比对（RT 72 组全部相同，只有三处有意差异）；合计 `pages-selfcheck` 20/20。
- 仅拦截数据：词云登录后、攻略单个标签读取失败、TJA 定数结果视图。
- 未验证：生产 Nitro、Linux 浏览器、真实攻略源与称号中心、真实数据库与登录（词云）、TJA 服务端计算、TJA 谱面图（本机读不出难度）、练习播放器运行时、真机、读屏。
- E1 回归在本切片两次失败一次通过（`login` 390 登录后不跳转），原因未查明，Linux 上重点看这一步。

### 切片 G：调色、全站 Element Plus 映射、复核事项、清理、一致性复核

- 覆盖内容：token 调色（浅色页面底中性、框架保持青绿、深色主按钮低一档、禁用态 token）；Element Plus 映射成为外壳默认（只跳过 `/annual` 与 `/admin`）；顶栏账号菜单与「我的」页的设置 / 退出登录；折线图刻度；首页横幅进问候行；「其他」歌曲返回其上架状态；回复框预览失败占位；删除 9 个无引用组件；自检运行器释放自己的开发锁；48 个地址的一致性复核与修正。地址合并不做（见待决事项）。
- 提交：分支 `feature/viewer-rework-stage5` 上 `519bfac` 之后的那一个提交（设计负责人复核后提交）。
- 本机真实验证：`test:ds` 92/92、`check:ds`（对比度 416/416、tokens 2416 值、`--prototype` 时原型 + 调整 = 生产）、`test:version`、`reworkStage1`…`5`（16/16）；业务测试 101 个文件逐文件与记录相同（差别只在删除的测试条目）；`/annual` 等 5 个范围外地址 × 2 宽 × 2 主题改前（`519bfac`）/ 改后 20/20 完全相同（手机 UA）；曲库 HTTP 57/57 + SSR 失败 + 24/24；A 44/44 + SSR；B 25/25；C 54/54；D 27/27；E1 25/25；E2 25/25；F 20/20；样张矩阵 457/457、图表 350/350、`browser-check` 67/72（5 条与作用域无关，见 `stage-5-progress.md`）。
- 仅拦截数据：账号菜单与「我的」页的登录态、退出登录请求；一致性复核里登录后的地址（成绩、成长、社区、档案、同步、开发者、工单、词云、首页）；调色证据里的成绩列表、登录后首页、同步、工单。
- 未验证：生产 Nitro、Linux 浏览器、真实登录与真实退出登录、真机（手机「我的」页、软键盘、触控）、读屏实际播报（菜单按钮只做了键盘自检）、真实手机上的 `/annual`（只用手机 UA 模拟）。E1 `login` 390 两次失败的原因没有复现直接证实（判断见 `stage-5-progress.md`「登录场景的失败」）。

## 三项门槛

- **P0 回复框软键盘避让**：已做——`ReplyBox.vue` scoped 规则 `html[data-kb] .crb`（编译为 `html[data-kb] .crb[data-v-…]`），`tests/reworkStage3.test.mjs` 用 `@vue/compiler-sfc` 编译断言；`check-scoped-css` 设计系统目录 0 处；浏览器里桩出 `visualViewport` 后选择器命中、回复框贴在键盘上沿（390 回复框、360 发帖页）。
  未验证：真实键盘。iOS Safari（`offsetTop` 随滚动变化、横竖屏、输入法组字）与 Android Chrome（`resizes-visual` / `resizes-content`）都没有在真机上看过。B6.4、B6.8、B12.14 真机通过之前，回复框不算可上线；150 px 阈值可能要按真机调整。
- **P1 王冠文字**：已做——成绩相关界面王冠都带可见文字（`DsCrown text`）：详情成绩面板全名、其他难度短名；全部成绩 ≥ 1100 全名、以下短名；首页、成长、周报的王冠事实全名；评价旁带名称（`DsRank named`）。王冠原图未改。
  未验证：只在本机合成 / 拦截数据下断言过，真实数据下未看。
- **P2 默认头像**：已做——所有出现人的地方用 `DsPlayerAvatar`，空值、服务端 `miku.png`、加载失败都显示 `/default-avatar.svg` 原样（`filter: none`、`opacity: 1`）；切片 D 用混合头像（拦截数据）在四页断言。
  未做：设计负责人看截图的复核（`avatars-*-intercepted-zh-820-light.png`）；真实账号的混合头像（Linux 计划里）。默认头像橙色在一屏多个时最显眼，没有为截图改色。

## 契约缺口（按区域）

生产没有，界面不放替身。

**曲库与搜索**
- 列表 API 无定数、个人王冠 / 成绩 / 进度、分类 / 星级 / 难度筛选、按星级 / 定数 / BPM / 曲名排序、别名显示、各上架状态的数量。
- 搜索不支持别名、艺术家、谱面配置；没有相关度排序；服务端最小分页 12，前端截断为 8。

**歌曲详情与定数表**
- 详情：每小节音符密度、小节定位、分歧谱面图、连打时间与气球数、别名、收藏、准确率、单曲 RT、最好成绩变化曲线、「设为这次想练」、讨论的帖子类型 / 作者。
- 定数表：星级、日文曲名、别名 / 艺术家搜索、定数区间筛选、个人王冠与评价列、CSV 导出、无定数谱面数量。

**成绩**
- B30 行（单曲 RT、准确率、入围线）、Rating 与六维历史序列、每张谱的王冠 / 评价（点灯格子）只有图片，没有 JSON。
- 成绩列表无排序参数、无王冠 / 评价 / 来源筛选、无按王冠合计、无定数 / 准确率 / 单曲 RT / 「手动修改过」。
- `/my` 无 Rating、近 30 天变化、最近 7 天、当前目标与本周数字（`my-taiko/overview` 受读模型权限控制）。
- 推荐：普通推荐行无我的王冠 / 评价 / 分数与能力方向；目标推荐无「设为目标」。

**今日与成长**
- 逐日游玩活动（21 天 / 7 天谱面带）、连续游玩天数；Rating 近 30 天变化、全站位置；首页六维历史值。
- 目标的尝试记录与当前进度、目标历史；时间栈里的 Rating / 段位里程碑；周报图片生成；首页社区热帖。

**社区**
- 帖子：当前用户在该谱面的成绩；收藏（接口存在，页面无入口）；举报、复制链接、只看楼主、楼层跳转、编辑与删除；楼层分页参数。
- 作者：段位、头像色相、稀有称号、楼层里的发帖统计。
- 广场：头条位、版块今日新帖数、标签热度数、达人榜 Rating。
- 通知：按类型筛选与按类型未读数、发出者以外的对象。发帖：草稿、上传进度、图片块排序。

**账号**
- 修改密码、修改用户名 / 邮箱、注销账号、重新发送验证邮件。
- 绑定的上次同步时间与来源同步状态；QQ 绑定的 Bot 迁移结果明细；最近登录时间、登录设备与会话列表。
- 设置：列表密度、曲名语言偏好、通知偏好。

**同步与开发者与工单**
- 同步：阶段与进度、耗时、多条历史、新进展统计、逐目标最近成功时间、目标开关持久化、取消接口。
- 外壳同步状态：没有轻量的「最近同步状态」接口，打开同步页之前外壳不知道状态。
- 工单：附件、按状态 / 分类筛选、重新打开。

**段位 / 攻略 / 称号 / 工具**
- 段位：徽章、个人合格记录与最好成绩、挑战次数、合格统计；课题曲的歌曲 id 与定数。
- 攻略：每个星级的攻略数量；攻略条目与歌曲 id 的对应。
- 称号：个人已获得状态、达成类型字段、中日名区分。
- 工具：查配置的结构化结果；查物量的歌曲 id 与难度星级。

## 与冻结设计的重要偏离

- 曲库桌面用带网格列的列表（`ul`），不是 `<table>`；`catalog` 排序写作「曲库顺序」。
- 歌曲详情：页内「返回列表」删除，只留外壳返回键；谱面分析不再折叠；访客 < 1100 时「我的成绩」改为谱面区之后的一行；页签上不显示王冠。
- 定数表默认排序保持 ID 升序（原型主定数降序）；难度只能单选；无定数区间、CSV。
- 成绩表行内操作在 ≥ 1100 常显，手机不「点行即编辑」；每页 100 条时客户端分两段挂载。
- 工具页参数改用原生控件；进度页的可搜索下拉因此没有输入过滤。
- 原型的 Rating 刻度盘（成绩页）、走势折线、六维哑铃、点灯格子、`/my` 快捷格都没做（没有 JSON）。
- 首页有数据时没有 21 天谱面带，改为「最近同步的变化｜今日进展」两栏；游客页右侧放真实最新歌曲，不放示例谱面带；装饰卡「12,840 RATING」删去。
- 成长档案保留两张图（Rating + 维度），横轴按测量顺序而不是日期比例。
- P1 优先于原型：王冠一律带文字；评价升级显示前后两个带名评价。
- 社区广场无「头条」大卡与搜索框；达人榜显示发帖数与获赞数；手机发帖为标题旁按钮，不是悬浮按钮。
- 帖子页回复多时按每窗 ≤ 60 条在前端分窗口，不是楼层分页；楼中楼全部显示。
- 未登录时回复框换成「登录后回复」（原来可以输入，提交后才提示）。
- 发帖页手机显示标题框；版块、类型、关联歌曲常显；没有实时预览与草稿。
- 通知页无类型筛选与单条「标为已读」。
- 失败的图片不再显示回落图：列表缩略图整块移除，正文图为「图片无法显示」占位。
- 登录三页无示例谱面舞台、无同页切换、无逐字段即时校验。
- 档案：用户名作页面 `<h1>`；无单独「危险区」，危险操作留在各行；无编辑资料 / 改密码 / 添加账号对话框。
- 同步页无三步步骤器、进度、历史表（接口是一次性返回）。
- `/about` 不设 `reworkElementPlus`：各切片场景用它作「无映射页」。切片 G 已处理：映射是外壳默认，页面不再写这个 meta，场景改用 `/annual`。
- 段位合格条件行名用数据里的「条件1–4」；红 / 金合格用 `--danger` / `--warn` 加文字；曲名只链唯一完全同名歌曲。
- `/more` 页面标题为「工具」，浏览器标签与 SEO 标题仍为「更多」。
- 删去的说明文字（AGENTS 文案规则）分布在各页：走势页 taikotrend 提示、登录说明段、设置快捷入口说明、同步说明段、攻略「Guide Hub」、称号副标题等。
- **实施调色（切片 G，有意与冻结原型不同）**：浅色 `--bg` `#eaf6f5` → `#f0f4f4`、`--bg-sunk` `#def0ee` → `#e4eaea`、`--surface` `#f9fdfc` → `#ffffff`、`--surface-2` `#f2f9f8` → `#f7f9f9`、`--line` `#ccdfdc` → `#d3dcdc`；外壳框架改读新的 `--chrome-*`（= 调色前的值，保持青绿）；深色 `--action-bg` `#86d9dc` → `#45aeb5`、悬停 `#a0e3e5` → `#5cbcc2`、新增按下 `#3a9da4`（链接、选中、焦点仍 `#86d9dc`）；新增 `--disabled-*`（深色禁用按钮不再是近黑底加亮字）。全部取值与理由：`viewer-ds.md`「实施调色（2026-11-18）」，差异来源 `scripts/ds/spec/tuning-2026-11-18.json`。
- Element Plus 映射是全站默认（切片 G）：只有 `/annual` 与 `/admin` 路径不带，靠外壳里的显式名单，不靠页面 meta（`pages/annual.vue` 在范围外，不能加退出开关）。

## 用户会注意到的行为变化

- 新外壳：六组导航、顶栏页签、手机五项导航与中央搜索；`Ctrl/Cmd K`、`/` 打开搜索。
- 三个歌曲列表合为 `/songs`（实装 / 未上架 / 其他 / 全部，两种排序，分页）；旧地址 302 到新地址；定数表地址改为 `/songs/constants`（旧地址 302）。
- 搜索面板与首页游客搜索都搜全部上架状态，有「查看全部 N 首结果」；首页游客搜索原来只搜实装。
- 歌曲详情：页内返回链接没了，用外壳返回键。「其他」歌曲的地址会补上 `list=other`（与未上架补 `list=removed` 相同，切片 G），返回落到 `/songs?shelf=other`。新增其他难度成绩一行、六维雷达与五项雷达并排。
- 定数表：新增检视面板（打开歌曲、用 RT 计算器）、清除筛选；难度为分段按钮。
- 成绩页签变为五个：全部成绩、B30 表、Rating 走势、歌曲进度、推荐歌曲（「点灯进度」改名「歌曲进度」）。
- 全部成绩新增王冠列、游玩 / 过关 / 全连 / 全良次数、详情展开；B30、走势、词云新增「保存图片」；推荐行新增推荐理由。
- `/my` 入口名称改为目标页标题（「成绩管理」→「全部成绩」，「每周回顾」→「这一周」）。
- 首页有数据时 Rating 刻度盘与六维雷达直接显示（原来折叠）；推荐新增当前最好评价与「全部推荐」。
- 周报新增上一周 / 下一周与六维各自差值；成长档案图表可键盘逐点查看。
- 社区：新增版块栏、热门标签、达人榜；帖子行新增最后活动日期；帖子新增「楼主」标签、「已隐藏」标记；外壳铃铛显示未读数字；通知新增发出者头像与未读圆点；列表筛选改为页内展开。
- 退出登录入口移到个人档案「登录与关联」区块（Stage 1 换外壳后站内一度没有任何退出入口）；切片 G 起顶栏头像是账号菜单（个人档案、多端同步、设置、退出登录），手机在「我的」页底部有设置与退出登录。
- 档案新增左侧目录、每个绑定自己的「需重新验证」；`?oidc_error=` 时自动滚到「登录与关联」。
- 设置新增语言行（中文 / 日本語）；主题为分段按钮。
- 注册 / 找回：验证码结果与两次密码不一致的错误显示在字段下；找回页回车可提交。
- 同步页新增最近一次同步摘要行与结果行；未绑定时目标列表与开始按钮不显示；外壳同步按钮在打开过同步页后显示状态点。
- 网页成绩 token 文档链接在日文页指向日文文档；`/docs/score-token` 日文页错误表为日文。
- 工单审批台手机上选中后焦点移到工单；动作后不再整页闪成骨架。
- 段位：新增版本切换、课题曲链接到歌曲详情、2026 一览图入口；外壳曲库页签新增「段位」。
- `/more` 按外壳重新分组，新增太鼓词云入口；称号新增关键词筛选与每页 50 行分页；攻略详情新增同难度 ★ 行与「再显示 30 条」。
- 查配置非法查询现在显示错误（原来页面报错无提示）；查物量打开时不再显示「没有找到」。
- 切片 G：浅色主题的页面底接近中性、面板为白色，导航框架仍是青绿底；深色主题的主按钮暗一档；禁用按钮看起来是禁用的。
- 切片 G：已登录有数据时，首页年度横幅在问候一行（宽屏在问候右侧）。工具组各页（查配置、查物量、词云、设置、关于）同一内容宽度；攻略入口与曲库组同宽；曲库与帖子标题与其他页面同字号。
- 切片 G：「我的」页的年度入口点击时开始播放年度音乐（旧侧栏原有、Stage 1 起丢失的行为补回）；表单字段与档案页上传头像的键盘焦点为 2 px 焦点环。

## Linux 验收计划

共同条件：`scripts/memory/run_qa.sh`，生产 Nitro 产物（V2 build runner，`/var/tmp` 下），`unshare --net` 仅 loopback，私有空 MySQL，`SELECT DATABASE()` 以 `_test` 结尾 + `--allow-test-db-mutation` / `TAIKO_ALLOW_TEST_DB_MUTATION=1`，一个浏览器，`finally` 全部关闭，截图 `acceptance_*`，私有 MySQL / Nitro 退出、scratch 回收。
除 `catalog` 外，下列 `*-check.mjs` 与 `--check=` 都**还没有写**；A 之后的切片都需要 `openContext` 增加「不拦截账号 / 论坛接口」的开关（也没有写）。

| `--check=` | 切片 | 必须覆盖 |
|---|---|---|
| `catalog` | 统一曲库 | `buildDataset()`（实装 60 / 未上架 50 / 其他 30）；HTTP 57 项（302 + 精确 `Location`，9 项无 `Location`）；`ssrFailure.pass`；场景 24/24；计时与预算对比 |
| `detail` | A | `writeDetailFiles()` 写 scratch；`runDetailScenarios()` + `detailSsrFailureCheck()`；登录态改为真实测试账号与合成成绩 / UGC，做不到时保留拦截并标明 |
| `scores` | B | 合成账号真实 HTTPS 登录、绑定与 userdata；成绩列表筛选、分页、锁定写入、手动删除写入在库里可见；未登录 SSR 3 项与矩阵 10 组；B30 / 走势 / 进度 / 推荐能跑 Python 时用真实图片与推荐 |
| `today` | C | 游客 SSR 与矩阵、搜索；首页四种登录态、目标的选择 / 替换 / 取消 / 判定为真实请求，目标写入在库里可见；成长与周报 |
| `community` | D | 合成版块帖子、长帖（> 60 条回复，含楼中楼与屏蔽作者）、通知、版主账号；`forum_threads` / `forum_posts` 运行前后差值除本次自建并清理的数据外为 0；回复、点赞、上传、发帖、标记已读、站务各一次真实写入；429；真实账号混合头像截图交设计负责人；真机 iOS Safari 与 Android Chrome 键盘（B6.4、B6.8、B12.14） |
| `account` | E1 | 真实 HTTPS 登录、错误密码、限流、`redirect` 与 `/oidc/interaction/<uid>`、cookie `Secure` / `SameSite`、密码管理器（Chrome、Safari）；注册与找回走测试邮件出口；测试 OIDC 提供方完整往返；绑定验证（抓取服务桩）、手动账号全部操作、QQ；会话过期 → 登录提示 → 回到档案；头像上传与我的小咚 |
| `account2` | E2 | 同步（鼓众广场与目标桩：成功 / 部分 / 全失败、429、`profile-changed`、503、长请求期间离开）；token 生成 / 轮换 / 撤销与旧 token 401；迁移 409 / 422；开发者申请、审批、授权同意 / 撤销与第三方读取；工单创建、追加、站务回复 / 关闭、未读 |
| `pages` | F | `writePagesFiles()` 与合成上游；`runPagesScenarios()`；`captureTools({ variant: "after" })` 与改前抓取比对；TJA 定数真实计算（`systemd-run` + Python）与谱面图（`/tja-tools/renderer.js`）；词云真实图片与 400 / 404；生产数据量下段位歌曲链接命中率 |

| `sweep`（切片 G，需新写） | G | 生产 Nitro 上 `runSweep()`（48 个地址、同一组拦截）与截图比对；登录态用私有测试库的真实账号时，账号菜单与「我的」页的退出登录走真实 `POST /api/account/auth/logout` 并回到登录页；`/annual` 改前（`519bfac` 构建）/ 改后用手机 UA 跑 `existing-pages.mjs`（`DS_USER_AGENT`）比对 |

另：E1 的 `login` 390 场景（切片 F 回归里两次失败）在生产产物上重点看。切片 G 的判断：导航在开发模式下要等服务器当场渲染 `/settings/_payload.json`，失败时导航没有确认；生产产物取静态载荷。场景现在会在失败时记录仍在进行的请求，`REWORK_TRACE=login` 记录跟踪。

### 需要更新的 Linux 脚本与工装

| 文件 | 要改什么 | 记录切片 |
|---|---|---|
| `tests/recommendationGoalNuxt.test.mjs` | 选择器已改为原生控件与 `.rw-result-image`，需在 Linux 跑一次 | B |
| `scripts/performance/navigation.mjs`、`navigation-online.mjs` | 就绪选择器已改为 `.sl .sl-summary`、`.hub`，需在 Linux 跑一次 | B |
| `scripts/performance/navigation-regression.mjs` | 仍按 Stage 1 之前的侧栏写，已不能运行 | B |
| `scripts/verify_my_navigation_browser.mjs` | 按旧侧栏与旧 `/my` 类名写，已不能运行；切换绑定按 `.binding-item` 与按钮名称仍可用 | B、E1 |
| `tests/viewer1RolloutNuxt.test.mjs` | 断言 `.my-links` 恰好 1 个，与现有页面（两组）不符，本切片之前即不符 | B |
| `scripts/verify_growth_*_browser.mjs`、`scripts/verify_home_p0e.mjs` | `passport-chart circle`、`passport-chart__segment path`、`growth-skill`、`personal-status`、`growth-surface img` 已不存在（另有更早失效的 `growth-metric`、`passport-change`） | C |
| `scripts/verify_training_loop_browser.mjs` | 同上类名问题；同步目标 `.target-item .el-checkbox` 改为 `.target-item input` | C、E2 |
| `tests/fixtures/forumDiscoveryBrowserRuntime.mjs` | 直接导入已删除的 `ForumThreadCard.vue` / `ForumUserBadge.vue` / `ReadState.vue` / `ThreadListPage.vue`；`.forum-thread-card` 等选择器 | D |
| `scripts/verify_account_titles_browser.mjs` | 同上导入；`.account-title`、`.floor-card__user`、`.sub-reply-item__head` 改为新结构，称号为 `.ds-site-title` | D |
| `tests/oidcNuxtUi.test.mjs` | 不用改：`.oidc-options`、`.oidc-linked`、`[role=status]`、`.profile-main-card`、`.submit-btn` 都保留；需在 Linux 跑 | E1 |
| `tests/fixtures/developerApiV1Ui.mjs`、`developerApiV1ManageabilityUi.mjs` | 已补 `t`、等待条件改为 `[data-grants-page]`；仍缺 `useAccountPageScope`（改前即缺），补上才能跑 | E2 |
| `tests/developerApiGuideUi.test.mjs` | 外壳补 `useForumResource` / `useAccountPageScope`（改前即缺） | E2 |
| `scripts/verify_practice_player.mjs`、`scripts/verify_rt_calculator_browser.mjs` | 不用改，选择器都保留；需在 Linux 跑 | F |
| `scripts/verify_annual_contract.mjs` | 切片 G 已改：「年度入口在点击里预热音乐」的检查由已删除的 `SidebarNav.vue` 改读 `components/rework/my/Hub.vue`；脚本本机第 12 行即停（年度 schema 在仓库外），需在 Linux 跑 | G |
| `tests/fixtures/forumDiscoveryBrowserRuntime.mjs`（再记一次） | 切片 G 删了 `ForumSafeImage.vue` 并去掉它的导入与注册；其余失效导入见 D 一行 | G |
| `scripts/ds/browser-check.mjs` | 切片 G：所有重做页面都有映射，「现有页面」参照只剩 `/annual`，要用 `--existing /annual` 与手机 UA（`DS_USER_AGENT`）；其中两条「离开后样式相同」会因 Element Plus 按需样式表失败（与作用域无关），Linux 一侧需决定是否改判据 | G |
| 各切片 `*-scenarios.mjs` 的 EP 开关场景 | 切片 G 已改用 `/annual` 并以手机 UA 打开；Linux 版本直接复用 | G |
| `forumCoreSqlHttp`、`forumCommunitySqlHttp`、`oidcSqlHttp`、`accountTitlesSql`、`botScoreTokenSql`、`developerApiV1Sql`、`developerApiV1ManageabilitySql`、`accountSyncCanonicalSql` | 不用改；本机由环境守卫拒绝，需在 Linux 隔离测试库上跑 | D、E1、E2 |

## 待负责人决定

- **地址合并**（`/play/*`、`/growth/*`、`/community/*`、`/login`、`/bind` 及其重定向）本轮不做：理由是它涉及登录重定向、OIDC 回跳地址、移动应用和 bot 使用的链接以及大量服务端测试，本机都无法验收；每个页面已能通过新导航在现有地址到达。记为开放计划项。
- **版本号**：分支仍为 1.15.0，发布时的版本号由负责人决定（AGENTS.md：可见变化须升版本，minor 适用于新功能与新页面）。
- **合并与发布顺序**：各切片提交在同一分支上，未合并 `main`，未部署；部署只能由最终集成者用 `scripts/deploy_forum_web.sh "<HEAD subject>"`。
- 设置页「清空缓存」没有确认，且 `localStorage.clear()` 会清掉记住的账号、主题备份等全部本地数据（E1）。
- 网页成绩 token 生成 / 轮换没有确认，轮换会让旧 token 立即失效；关闭工单没有确认（E2）。
- `components/SongCoverImage.vue` 已没有组件调用者（切片 G 删除了唯一的调用者），仍被 `songCoverFallback` 测试与一个 Linux 工装引用，删不删。
- `/annual` 只在手机 UA 上渲染（桌面送到首页），范围外，未改；它的提示框颜色在用过 Element Plus 提示框的页面之后会变（按需样式表的加载顺序），也是范围外。
- 帖子正文段落里的换行被合并、回复里保留换行；渲染冻结，保持原样（D）。
- `developerApiV1*` 工装缺 `useAccountPageScope`（改前即缺），是否在本轮补（E2）。
- 设置页审批入口按写死的用户名与邮箱判断（E1，原样保留）。
- P0 回复框上线前的真机验证安排（iOS Safari、Android Chrome，记录机型与系统版本）。
- P2 默认头像的观感复核（切片 D 截图待设计负责人看）。
