# Stage 5 · 公开页面

依据：`rework-playbook.md`、Design V1.3 Final（冻结 `5f770a2`，原型 `preview/redesign-v1/`）。分支 `feature/viewer-rework-stage5`。

## 切片 F：段位、攻略、称号、工具、关于、更多、别名记录、练习页

2026-11-18，基于 `34d4f5a`，未提交、未合并、未部署，版本仍为 `1.15.0`。没有改 `server/api/**`、没有新增接口、没有数据库访问；
接口的请求与响应不变。**隔离验收（Linux）尚未运行**；下面除注明「真实」外都是本机开发自检。

### 做了什么

- **页面**（地址不变）：`/grade`（302）、`/grade/2023`、`/grade/2024`、`/grade/2025`（→ 五級）、`/grade/2025/:grade`、`/grade/2026`（→ 五級）、`/grade/2026/:grade`、
  `/guide`、`/guide/:difficulty/:level`、`/titles`、`/tools`（302 → `/more`，未改）、`/tools/chart-config`、`/tools/note-count`、`/tools/rt-calculator`、`/tools/tja-constants`、
  `/tools/word-cloud`、`/more`、`/about`、`/alias-log`、`/ourtaikoview/:id/:difficulty`。重做的页面都设 `hidePageHeader: true`（页面自己的 `<h1>`）与 `reworkElementPlus: true`；
  **`/about` 例外**：只设 `hidePageHeader`，不设映射（见偏离）。版面宽度不变。
- **呈现组件**：`components/rework/dan/Course.vue`（四个年份共用）、`guide/{Entry,Level}.vue`、`titles/List.vue`、`tools/{Examples,Lines,Charts,RtCalculator,TjaConstants,TjaImage}.vue`、
  `info/{MoreHub,About,AliasTable}.vue`。`components/tools/TjaChartImageTool.vue` 移为 `components/rework/tools/TjaImage.vue`（脚本只改了选文案表的一行），原文件删除。
  `components/GradeDojoShell.vue` 已无引用，未删（留给切片 G）。
- **纯数据**：`utils/rework/dan.ts`（无 DOM 地读 wiki 片段里的表：课题曲、合格条件、相邻段位与年份；片段行内颜色换成 `data-dan-tone`；`#` 占位链接变文字；
  在曲库里找**唯一完全同名**的歌曲），`utils/gradeDojoLegacy.ts`（2023 / 2024 原写在模板里的内容，逐字搬成与 2025 / 2026 数据文件相同的形状），
  `composables/useDanSongLinks.ts`（用现有 `/api/content/songs` 关键词查询，每首一次，SSR 一起渲染；失败只是不带链接）。
- **外壳**：曲库副页签 = 歌曲列表、定数表、**段位**（新增）、攻略、称号；工具副页签 = 工具（`/more`）、单曲 RT 计算器、查配置、TJA 定数与谱面图、查物量、太鼓词云、设置、关于。
  页签文字与各页面 `<h1>` 用同一个键（`utils/rework/navigation.ts` 的 `SONGS_TABS`、`TOOLS_TABS`，页签可带 `labelKey`）；段位、攻略页签在子页面上同样是当前页（`prefix`）。
- **文案**：新增 `rework.grade`、`rework.danCourse.*`、`guidePage.*`、`titlesPage.*`、`toolPages.*`、`aboutPage.*`、`aliasLogPage.*`、`practice.*`（中日各 145 行，按文本插入，其余格式未动）。
  RT 计算器、词云、关于、别名记录、练习页的行内中日表**逐字**搬入（`tests/fixtures/slice-f-copy-original.json` 是从改前文件求值抽取的原文，`reworkStage5` 逐键比对）；
  `{total}` 占位以原样传入，页面里原有的 `.replace` 不用改。
- **工装**：`scripts/rework/pages-{data,scenarios,tools-capture,selfcheck}.mjs`（共享运行器）。

### 数据来源（逐页）

| 页面 | 来源 | 本机验证方式 |
| --- | --- | --- |
| `/grade/2025/*`、`/grade/2026/*` | 打包的 `assets/data/grade_dojo_nijiiro_{2025,2026}.json`（wiki 页面 HTML 片段） | 真实 SSR；歌曲链接走真实 `/api/content/songs` + 合成曲库 |
| `/grade/2023`、`/grade/2024` | 原模板里的静态内容（现 `utils/gradeDojoLegacy.ts`） | 同上 |
| `/guide` | `utils/guide.ts` 常量 | 真实 |
| `/guide/:d/:l` | 远端攻略源（`public.guideApiBase` `/music/musicDetailList`）+ 服务端内存 / 持久缓存 | 真实服务端代码 + 本机合成上游（`NUXT_PUBLIC_GUIDE_API_BASE`，成功 / 失败）；单个标签读取失败为浏览器拦截 |
| `/titles` | 称号中心 `TAIKO_TITLE_API_BASE/api/titles` + 本地详情 `TAIKO_API_BASE/taiko/title/page` | 真实服务端代码 + 本机合成上游（成功 / 空 / 失败） |
| `/tools/chart-config`、`/tools/note-count` | `songs/analyze_result_filtered.json`、`songs/tja_note_counts.json`（`TAIKO_REPO_ROOT`） | 真实 API + 合成文件 |
| `/tools/rt-calculator` | 曲库、rating、V2 快照文件；计算在浏览器（`utils/rtCalculator.ts`，未改） | 真实 API + 合成文件（`detail-data.mjs`） |
| `/tools/tja-constants` | 文件检查在浏览器；定数计算在服务端（`systemd-run` + Python，只有 Linux）；谱面图在浏览器（tja-tools） | 文件检查真实；服务端真实返回 503「计算服务暂时不可用」；结果视图为拦截；谱面图本机不可用（见未验证） |
| `/tools/word-cloud` | `/api/account/charts/word-cloud`（需登录与绑定） | 访客门真实 SSR；登录后为拦截 |
| `/alias-log` | `logs/alias_action_log.json`（按 cwd 探测） | 真实 API + 合成文件（有数据 / 空 / 缺失） |
| `/more`、`/about` | 静态 | 真实 |
| `/ourtaikoview/:id/:d` | TJA 包 + `practice-player` 运行时 | 控件真实；播放器运行时本机没有构建，停在「播放器下载失败」（记录；渲染未改） |

### 功能对照：段位（`/grade/*`）

| 改前 | 改后 |
| --- | --- |
| `/grade` 302 → `/grade/2026`；`/grade/2025`、`/grade/2026` 302 → 五級 | 不变（原始 HTTP 自检：302；`/grade/2025` 在 dev 冷启动的第一次请求得到 307、第二次 302，是 dev 现象，该页未改） |
| 2025 / 2026：h1「年份 + 段位名」、原始页面链接（新窗口）、Last-modified、三组段位按钮（`navigateTo`） | 页面 `<h1>`「段位」（= 页签）；段位名作 h2，年份与 Last-modified 在其下；三组段位为真实链接（SSR 有 `href`、`aria-current`）；原始页面链接保留 |
| wiki 片段的导航表（前后段位、前后年份） | 读成「相邻段位与版本」一行，链接与片段相同；`#` 占位（2023 / 2024）为纯文字 |
| 没有年份切换 | **新增**版本切换 2026 / 2025 / 2024 / 2023（链接到各年份现有地址，含原有重定向） |
| 楽曲情報表（序号、曲名 wiki 链接、难易度文字、最大连击、BPM、合计） | 课题曲列表：序号、`DsSongCell`（曲库有唯一同名歌曲时带曲绘、链接歌曲详情 `?difficulty=`，里谱 → 5）、`DsDiff`（难度 + ★）、最大连击、BPM、合计；wiki 链接保留为「wiki ↗」 |
| 合格条件表（条件1–4 × 合格 / 金合格，逐曲连打分行） | 条件 × 红合格 / 金合格（在自身内横向滚动），逐曲的值标「1曲目 / 2曲目 / 3曲目」；色点 + 文字 |
| 连打条件详细、補足等片段表格 | 原样；行内颜色换成 token（红 / 金合格格前加色点、灰底「精度曲」用 `--bg-sunk`、强调改为加粗下划线）；表在自身内横向滚动 |
| 攻略：每首一个页签 | `role=tablist`（左右键、Home / End、焦点跟随），内容原样 |
| 对策、其他、各課題曲の練習曲 | 原样（同上处理） |
| 2023 / 2024：两份几乎相同的模板 | 与 2025 / 2026 同一组件；内容逐字保留，两年只差年份一行；曲名原链到 `#`，现在曲库有唯一同名歌曲的链到详情，其余为文字 |
| 2026 完整一览图只在首页 | 2026 段位页加「查看完整一览图」（新窗口，同一图片），其他年份没有这张图 |

### 功能对照：攻略

| 页面 | 改前 | 改后 |
| --- | --- | --- |
| `/guide` | `?difficulty=&level=` 301；hero（「Guide Hub」、标题、说明）、四张难度卡（图标、名称、「N 个星级入口」、★ 链接） | 301 不变；`<h1>`「攻略」+ 吉祥物图；每个难度一行（`DsDiff` 图标 + 名称）+ 全部 ★ 链接（顺序不变，44 px）；删去 hero 文字与「N 个星级入口」 |
| `/guide/:d/:l` | 两侧吉祥物 + 标题；难度分布 el-table；7 个标签行（色带、数量、展开）；展开：骨架、失败 + 重试、空、el-table 六列；ElMessage；页面失败 el-result + 返回入口 | 标题与两侧图保留；**新增**同难度 ★ 链接行；分布表（自身内滚动）；标签行为 `aria-expanded` 按钮（诈称两档危险色、逆诈称两档信息色的左边线），状态用 `ReworkState`；明细六列不变、自身内滚动、一次挂载 30 行 +「再显示 30 条」；ElMessage 保留；页面失败：失败 + **新增**重试 + 返回入口 |

### 功能对照：称号（`/titles`）

| 改前 | 改后 |
| --- | --- |
| 卡片标题 + 副标题 | `<h1>`「称号」（= 页签）；副标题删去 |
| 表：稀有度徽章、称号、获取条件、关联歌曲 `#id` | 同四列；称号用 `DsTitlePlate`（稀有度即牌面编号——服务端以「名称 + 稀有度」区分全连 / 全良 / 表里牌面——在素材表里显示牌面，否则文字形式；放不下退回文字形式）；稀有度数字保留 |
| 全部行一次挂载 | 每页 50 行（`ReworkPager`，焦点回到概要）；**新增**关键词筛选（称号、条件、稀有度数字） |
| 骨架、失败 el-alert、空 | `ReworkState` 加载 / 失败 + **新增**重试 / 空 |

### 功能对照：工具

| 页面 | 改前 | 改后 |
| --- | --- | --- |
| `/tools` | 302 → `/more` | 不变 |
| `/tools/chart-config` | 中文写死的示例行；el-input（默认「16 oxxo」）；查询（loading）；错误 el-alert；结果 pre | `<h1>`；原生输入（同默认值）；示例为可点的芯片（**新增**：点了填入），「省略分音符…」进 locale（日文新译）；按钮请求中禁用 + 转圈；错误 `rw-alert`（警告类型同前）；结果按行显示自动换行；**修复**：非法查询的错误原来不显示（见改动的数据代码） |
| `/tools/note-count` | 说明、数字框（0–99999）、查询、错误、概要 + 列表、空提示（页面一打开就显示「没有找到…」） | 同说明、原生数字框、同概要与列表；空提示只在查询之后出现；错误修复同上 |
| `/tools/rt-calculator` | 远程搜索 el-select、版本 / 难度 select、加载 / 失败重试 / 无定数 + 重试 / 请选择歌曲、详情链接与物量、自动补齐 + 全良、三个判定输入（只读、校验）、提示、结果（综合 RT、精度、六项 + 细条）、来源 | 全部保留；脚本只换文案来源；保留 Linux 冒烟脚本读取的类名与 id；el-select `:persistent="false"`；只读的那一格下加「自动补齐」小字 |
| `/tools/tja-constants` | 拖放区（单个 .tja、≤ 512 KB）、编码、计算 / 重新计算、隐私说明、计算中 + 取消、错误、状态；结果：标题（聚焦）、下载 JSON、难度、分支、物量、分支错误、三个定数、五项、原始指标、参考说明、来源；谱面图（读取、难度、显示曲名、生成、取消、错误、重读、尺寸、下载 / 原图、预览、tja-tools 链接） | 全部保留（检查、请求、取消、超时、下载未改）；`accept=".tja"` 不变；编码 select 的内联处理移成页面函数 `setEncoding`（同效果）；元素引用由组件经函数 ref 设回页面 |
| `/tools/word-cloud` | `AccountToolGate`；说明、生成、错误 el-alert、图片 | `ReworkGate need=login`（登录带 `redirect`、注册）；同说明与按钮；结果用 `ReworkScoresImageResult`：图片、查看原图、**新增**保存图片；错误按含义呈现（400 未绑定 → 绑定门、404 无数据 → 去同步、其他 → 失败 + 重试） |

### 功能对照：`/more`、`/about`、`/alias-log`、练习页

| 页面 | 改前 | 改后 |
| --- | --- | --- |
| `/more` | 四组（发现、查谱工具、账号系统、工单支持）+ 语言 + 版本 | `<h1>`「工具」（= 外壳目的地与页签）；按外壳分组：曲库（段位、攻略、称号）、工具（同工具页签 7 项，**新增**太鼓词云；设置、关于从账号组移来）、账号系统（多端同步、网页成绩 token、开发者权限）、工单支持（工单支持、别名修改日志）；每项文字 = 目标页 `<h1>`；语言分段；版本行 |
| `/about` | 开发团队（说明、四人头像 / 名字 / 分工）、技术栈（说明、13 项）、友情链接（Ourtaiko） | 内容、头像、名字、分工、技术栈、链接逐字保留；`<h1>`「关于」；三块 `ReworkPanel` |
| `/alias-log` | 标题 + 「共 N 条记录」；搜索（清空即重搜）；加载 / 失败 + 重新加载 / 空；表格六列；el-pagination（20 / 页） | 同数据与列；歌曲与「查看」为真实链接（同去向）；原生搜索框（清除按钮仍重搜）；`ReworkPager`；<1100 每行一块 |
| `/ourtaikoview/:id/:d` | 沉浸版面（外壳内，无副页签与手机导航）：返回、h1、鼓音音量、全屏、重新加载、状态 / 错误、iframe、展开全屏 | 全部保留（`.practice-page` 等类名不变）；控件换共享样式（`rw-link`、`rw-btn`、`rw-field__label`、`rw-alert`）；嵌套 `<main>` 改为 `<div>`；**播放器渲染（iframe、展开舞台、`#171717` 底色）未动** |

### 工具输出比对（改前 / 改后同一组输入）

`pages-tools-capture.mjs` 在**未改动的代码**（`34d4f5a` 的导出副本，同一份合成数据）上先跑一次，改后再跑一次，逐字段比对页面读出的输出
（证据：`tools-before/tools-capture-before.json`、`tools-after/tools-capture-after.json`、`tools-capture-diff.json`）。

- **RT 计算器**：72 组（歌曲 1 / 6 / 9 的全部 V2 与 V1 谱面 × 初始、全良、自动补良、自动补不可、自动补可、手动非法、手动小数、低于 75%，另日文 8 组）：
  综合 RT、精度、六项数值与名称、三个输入框的值与只读、校验状态、物量、选项 —— **全部相同**；空选择状态相同。
- **TJA 定数**：文件检查（错误类型、空文件、超过 512 KB、两个文件）、选中文件信息、真实服务端 503 的提示、429、`note_limit`、结果（标题与焦点、难度、分支、物量、三个定数、五项、原始指标、分支错误）、
  逐难度逐分支切换、下载文件名与内容 —— **全部相同**。
- **查配置**（9 个查询 × 中日）、**查物量**（5 个查询 × 中日）：结果行 **全部相同**。
- 差异只有三处，都是有意的：①改前页面在非法查配置时抛出页面错误「Must be called at the top of a `setup` function」且不显示错误（中日各 1 次），改后显示服务端的格式说明（修复）；
  ②查物量改前一打开就显示「没有找到对应物量的谱面」，改后查询前不显示；③因此改前的 2 条页面错误在改后消失。

### 与原型或规则的偏离与原因

- **`/about` 不设 `reworkElementPlus`**：页面没有 Element Plus 组件，映射不改变任何东西；切片 A–E2 的浏览器场景（以及它们的 Linux 版本）都用 `/about` 作为「没有映射的页面」检查开关的去掉与恢复。设上会让这些场景全部失效。切片 G 全站切换时一并处理。
- 段位：没有原型的段位徽章、「我的最好」列、挑战次数、练习建议、社区讨论（RK-46 与生产数据都没有）；合格条件的行名用数据里的「条件1–4」（原型的「魂量表 / 良 / 不可 / 连打数」是从模拟数据推出来的，生产数据只有每格的文字）。
  原型把版本与段位写进地址查询，这里保持现有路径。红 / 金合格的标记用状态色 `--danger` / `--warn`（音符色 `--don*` / `--roll*` 按规则只能用在音符与图表组件里），旁边总有文字。
  曲名链接只认曲库里唯一的完全同名（NFKC）歌曲，不做模糊匹配（宁可不链，不链错）。
- 攻略：原型的「难度 × 星级矩阵带篇数」没有做篇数（篇数要每个星级读 7 次远端），入口只列链接；标签内是现有的谱面表，不是原型的社区攻略列表（没有这种数据）。新增同难度 ★ 链接行。
- 称号：没有原型的「已获得」、达成类型筛选（没有个人称号数据；达成类型可从牌面编号推，但只有 9 个编号在表里，不做部分筛选）；新增关键词筛选与分页，补偿分页后不能整页查找。
- 删去的说明文字（AGENTS 文案规则）：攻略入口的「Guide Hub」、「谱面攻略入口」、「按难度和定数进入对应攻略页，页面会输出独立 URL、canonical 与结构化 breadcrumb。」（实现说明）与「N 个星级入口」；称号副标题「所有可获得的称号及获取条件」。
  `/about` 的两句说明按裁定 6 保留。
- `/more` 的标题是「工具」（外壳目的地名与页签名），浏览器标签与 SEO 标题仍是「更多」（SEO 未改）。
- 练习页的展开全屏按钮在深色舞台上用了 `rw-btn`（浅底），原来是透明描边；渲染区其余未动。

### 契约缺口（生产没有，界面不放替身）

- 段位：段位徽章、个人合格记录与最好成绩、挑战次数、合格统计（RK-46）；课题曲的歌曲 id（只能按曲名找）、定数。
- 攻略：每个星级的攻略数量（不读远端就没有）、攻略条目与歌曲 id 的对应（远端 `id` 含义未确认，所以条目不链接）。
- 称号：个人已获得状态、称号的达成类型字段、称号的日文 / 中文名区分。
- 工具：查配置的结构化结果（只有文本行，所以没有原型的歌曲单元格与小节位置）；查物量的歌曲 id 与难度星级。

### 改动的数据代码（请重点复核）

- `composables/useGuideContent.ts`、`useTitlesContent.ts`：`useViewerApiFetch()` 提到 setup 里调用（请求与 key 不变）。原来在 handler 里调用，`refresh()`（新的重试）与 watch 在 setup 之外运行时 `useI18n()` 抛错，页面再也读不到——自检发现（与切片 A 的 `useSongDetail` 同一个问题）。
- `pages/tools/chart-config.vue`、`note-count.vue`：`resolveViewerError(error, fallback)` 加第三个参数 `t`。原来它在 catch 里调用 `useI18n()`（setup 之外）抛错，非法查询什么也不显示、页面报错——改前抓取里可见。
- `pages/tools/note-count.vue`：新增 `searched`（空提示只在查询后出现）。
- `pages/grade/2025/[grade].vue`、`2026/[grade].vue`：段位固定为本实例打开时的参数（页面 key 本来就含参数；keepalive 的旧实例不再跟随新地址），段位组标签改为 locale 键；新增 `useDanSongLinks`。
- `pages/tools/rt-calculator.vue`、`alias-log.vue`、`about.vue`、`ourtaikoview/[id]/[difficulty].vue`、`tools/word-cloud.vue`：`copy` 改读 locale（同文字、同键）。`alias-log` 的歌曲跳转函数删去（改为链接）。
- `pages/tools/tja-constants.vue`：`setEncoding`、两个函数 ref 设置器（呈现）。`components/rework/tools/TjaImage.vue`：语言选择由 `locale === 'ja' ? 'ja' : 'zh'` 改为按文案表的键选（zh / ja 结果相同；`check-ds-copy` 不允许行内语言分支）。
- `reworkStage5` 用「改前脚本的每一行都还在（允许的改动逐条列出）」检查 RT、TJA、查配置、查物量、攻略详情、练习页与谱面图组件（`tests/fixtures/slice-f-scripts-original.json`）。

### 测试基线（裁定 9；不需要数据库与浏览器，逐文件运行）

证据：主检出 `.claude/stage-artifacts/slice-f/baseline-before/`、`baseline-after/`（`summary.txt` 除新增的 `reworkStage5` 一行外逐行相同）。

| 文件 | 改前 | 改后 | 说明 |
| --- | --- | --- | --- |
| `rtCalculator` | 4/5（1 skip） | 4/5（1 skip） | skip：本机没有安装 Core |
| `tjaCalculator` | 0/1 | 0/1 | 本机 chdir 到带 `%E6` 的路径失败（环境） |
| `officialTitles` | 6/6 | 6/6 | 断言改读组件（见下） |
| `dsTitlePlate`、`ourTaikoView`、`practiceBundle`、`practiceBundleFetch` | 5/5、2/2、3/3、1/1 | 同 | |
| `practicePlayer` | 4/5 | 4/5 | 第 3 条本机 symlink EPERM（环境） |
| `toolChartIdentity`、`uiBatch2State`、`versionProjection`、`homeDeepState`、`homePresentation` | 1/1、4/4、1/1、23/23、6/6 | 同 | |
| `adminTraffic` | 0/1 | 0/1 | 本机临时目录路径（环境）；会在 `taiko_viewer/var/` 留空目录，结束时已删 |
| `reworkStage1`…`4` | 14/14、19/19、11/11、15/15 | 同 | `reworkStage2` 一条断言改写（见下） |
| `reworkStage5`（新） | — | 12/12 | |
| `npm run test:ds`、`check:ds`、`test:version` | 90/90、通过、1/1 | 90/90、通过、1/1 | token 对照表重新生成（旧样式删除后 `--viewer-*` 引用数下降） |

### 改动的测试断言（逐条）

1. `tests/officialTitles.test.ts` 第一个测试最后一条：读取的文件由 `pages/titles.vue` 改为 `components/rework/titles/List.vue`（表格搬进组件），断言的正则 `<td>{{ title.condition }}</td>` 不变。
2. `tests/reworkStage2.test.mjs`「slice pages…」：`word cloud (slice F) keeps the old gate`（断言页面含 `AccountToolGate`）改为断言不含 `AccountToolGate` 并使用 `<ReworkGate :need="accountUser ? null : 'login'">`（该条本来就是留给切片 F 的占位）。
3. 新增 `tests/reworkStage5.test.mjs` 12 条；新增工装数据 `tests/fixtures/slice-f-copy-original.json`、`slice-f-scripts-original.json`。

### 验证

| 层级 | 内容 | 结果 |
| --- | --- | --- |
| 业务测试基线（真实） | 见上表，19 个文件改前改后逐文件运行 | 逐文件相同（失败的都是环境，改前即失败） |
| 静态 / 单元（真实） | `test:ds`、`check:ds`、`test:version`、`reworkStage1`…`5` | 90/90；通过（tokens 2352、ds usage 180 文件 0、ds copy 176 文件、scoped CSS 0、小图标 46）；1/1；14/14、19/19、11/11、15/15、12/12 |
| 本机真实 HTTP / SSR（`nuxt dev`，无数据库） | 中日：5 个重定向；16 个页面 200、唯一 `<h1>`、`rework-ep`（`/about` 无）；服务端 HTML 里有：九段三首的歌曲详情链接与合格条件、2026 一览图（2025 没有）、2023 / 2024 的链接（`GO GET'EM!` → 905 里谱、`RIDGE RACER STEPS` → 906、两首同名的 `よーいドン！` 不链接）、无 `#` 链接、年份行不同；攻略入口 30 个 ★ 链接、分布数字；称号 50 行；更多 15 个去向与版本；关于的全部文字；别名记录总数与 20 行；词云访客门；水合后 h1 = 服务端 h1、0 水合警告 | 2/2 |
| 本机真实（合成文件 / 合成上游） | 段位（段位与年份链接、相邻、页签键盘、里谱链接到详情、2023 单课程）；攻略（入口 → ★10、分布、展开 45 行先挂 30、键盘开合、空标签、★ 切换、上游失败 → SSR 失败态 → 重试成功）；称号（牌面 / 文字形式、分页与焦点、筛选、无匹配与清除、上游失败 → 重试、空）；更多（15 项逐项点进去 h1 = 文字，3 项需登录落到登录页；8 个工具页签各自为当前页且文字 = h1；语言）；别名记录（翻页、搜索、清空、空文件、缺文件 → 失败 → 重试）；练习页控件；EP 开关（`/about` → RT 计算器：下拉为映射色，离开后去掉、`<body>` 节点不多于基线 + 2，返回恢复） | 全部通过 |
| 拦截数据的自检（intercepted） | 词云登录后：生成、图片与替代文字、400 → 绑定门、404 → 去同步、500 → 失败 → 重试；攻略单个标签读取 502 → 重试；TJA 结果视图 | 通过 |
| 矩阵 | 16 页 × 360/390/820/1440 × 浅/深（中文）+ 日文 390 浅、1440 深 = 10 组 160 页：`rework-ep`、主题、唯一 h1、无横向溢出、触控目标 ≥ 44、宽表在自身内滚动（`overflow-x:auto`）、挂载行 ≤ 60（称号 50、别名 20、攻略标签 ≤ 30） | 10/10 |
| 合计 | `pages-selfcheck.mjs` 最终一次 | **20/20**，0 控制台错误、0 水合警告、0 Vue 警告；最长任务 114 ms；筛选 41 / 23 ms；路由切换 107 ms（dev，仅参考）；`portFreeAfter: true`、`browserStoppedAfter: true` |
| 工具输出比对 | 见上节 | 只有三处有意差异 |
| 回归（共享文件：Shell、navigation、locale） | 改前（动手前，`34d4f5a` 的导出副本）：曲库 HTTP 57/57、SSR 失败通过、24/24；A 44/44 + SSR 失败；B 25/25；C 54/54；D 27/27；E1 25/25；E2 25/25。改后（最终代码）：曲库 HTTP 57/57、SSR 失败通过、24/24；A 44/44 + SSR 失败；B 25/25；C 54/54；D 27/27；E1 **24/25 → 24/25 → 25/25**（见下）；E2 25/25 | 端口与浏览器进程结束后都已释放 |
| 未验证 | 生产 Nitro、Linux 浏览器、真实攻略源与称号中心、真实数据库与登录（词云）、TJA 服务端计算（Linux）、TJA 谱面图（本机 dev 不提供 `/tja-tools/renderer.js`，改前改后都读不出难度，**没有验证**）、练习播放器运行时、真机、读屏 | — |

E1 回归：前两次整套运行都在同一步失败（`login` 390「pending…」：登录请求放行后没有跳到 `/settings`，120 秒内地址不变，无控制台错误）；只跑 `login` 时，用改前的 `Shell.vue` 与改后的 `Shell.vue` 都是 4/4；第三次整套运行 25/25。原因没有查明（可能是 dev 按需编译的时序），**不能断言与本切片无关**，请在 Linux 生产产物上重点看这一步。另：一次被结束的 dev 服务器留下了 Nuxt 的开发锁，后面几次运行用 `NUXT_IGNORE_LOCK=1` 启动（运行器本身未改）。

本机自检过滤了两类控制台消息并计数记录：Nuxt dev 把服务端日志转发到浏览器的 `ssr:error`（上游被故意关掉时出现）；练习页播放器运行时缺失（`ourtaikoview-runtime/…`，本机没有构建）。

运行：`node scripts/rework/pages-selfcheck.mjs --port=3577 --out=<目录> [--only=…]`；工具比对 `--capture=before|after`。证据（不提交）：主检出 `.claude/stage-artifacts/slice-f/`：
`final/`（JSON、截图：`*-real-*` 真实、`*-intercepted-*` 拦截）、`tools-before/`、`tools-after/`、`tools-capture-diff.json`、`dev1`–`dev4/`（开发中的运行，含 `FAILED-*`）、`baseline-before/`、`baseline-after/`、`regression-before/`、`regression-after/`。

自检中发现并改掉的：`components/rework/guide/Index.vue` 被 Nuxt 注册成 `ReworkGuide`（index 被去掉）→ 改名 `Entry.vue`；攻略 / 称号重试无效（composable）；别名很长时 `.rw-tag` 不换行造成 360 宽溢出（改为可换行的标签）；攻略详情页漏设两个 meta。

### Linux 隔离验收（尚未运行）

在 `shell-sql.mjs` 加 `--check=pages`，新建 `pages-check.mjs`：在 scratch 写 `writePagesFiles()`（别名日志写到 Nitro 的 cwd 下 `logs/`，结束删除；合成上游同进程启动），生产 Nitro，`runPagesScenarios()`，再跑 `captureTools({ variant: "after" })` 与本记录的改前抓取比对。另需：

- TJA 定数真实计算（`systemd-run` + `/usr/bin/python3` + `.output/server/tja-runtime`）：把 `TJA_FIXTURE` 拦截换成真实请求，至少一份多难度、带分支的 TJA；谱面图在 Linux 生产产物上验证（`/tja-tools/renderer.js`）。
- 词云：私有测试库（`SELECT DATABASE()` 以 `_test` 结尾 + `TAIKO_ALLOW_TEST_DB_MUTATION=1`）的合成绑定账号，真实图片与 400 / 404。
- 练习页：`scripts/verify_practice_player.mjs` 原样可用（`.practice-page`、按钮名「全屏 / 退出全屏 / 重新加载」、链接「返回歌曲」、`input[type=range]` 都保留）。
- `scripts/verify_rt_calculator_browser.mjs` 原样可用（`.rt-output .rating strong`、`.dimensions dd`、`#rt-*`、`.judgment-toolbar select`、`.selection-row select`、`.rt-controls [role=combobox]`、`.more-hub a[href=…]` 都保留）。
- 段位：用生产数据量看一次歌曲链接命中率（只认唯一完全同名）。

### 留给切片 G 的清单

**`pages/` 下（不含 admin、annual、version-summary）仍没有 `reworkElementPlus` 的页面**：`pages/about.vue`（有意，见偏离）、`pages/account/index.vue`（302 页）、`pages/grade/index.vue`、`pages/grade/2025/index.vue`、`pages/grade/2026/index.vue`、`pages/tools/index.vue`（四个都是重定向页）、`pages/my.vue`（`/my/*` 的父路由）、`pages/songs/index.vue`（曲库，切片 A 记录时就没有设）。

**仍被重做页面（或 `components/rework`、`components/ds`）引用的、在 `rework` / `ds` / annual / admin 之外的组件**：
`components/RecommendationGoalAction.vue`（`/songs/:id`、`/tools/recommend`）、`components/account/AccountAvatarCropperDialog.vue`（档案）、`AccountScoreImportDialog.vue`、`AccountSongEditorDialog.vue`（`/account/songs`）、
`components/account/TitleBadges.vue`（`rework/my/Hub`、`rework/today/Hello`、`SignedIn`）、`components/forum/ForumMediaViewer.vue`（帖子）、`ForumSafeImage.vue`（`rework/community/ReplyBox`）、`SongRelatedDiscussions.vue`（`rework/song/Discussions`）、
`components/home/PlayerGrowthSurface.vue`（`rework/today/SignedIn`）。不再被引用、可删：`components/GradeDojoShell.vue`、`components/tools/AccountToolGate.vue`（已无任何引用，`reworkStage5` 断言）。

### 看到但没有改

- `/grade/2025` 在 dev 冷启动第一次请求返回 307（之后 302）；2023 / 2024 的内容是一份九段的占位（「内容待补充。」），按裁定保留。
- RT 计算器页面是 keepalive 的且跟随全局 `route.query`：离开后旧实例仍会响应别的页面的 `songId` 查询（原样）。
- 攻略详情的标签数据在服务端缓存 5 分钟，上游失败后在缓存期内仍返回旧数据（原样）。
- 查配置在结果超过 10 条时随机取 10 条（服务端逻辑），同一查询两次结果可能不同。
- 称号中心与本地详情任一失败整页失败（服务端逻辑，原样）。

### 设计复核后的修改（2026-11-18）

1. **`/tools/rt-calculator` 判定输入（<768 错位重叠）**：原因是 `rework.css` 的 `html.viewer-rework .rw-input[type="number"] { width: 120px }` 特异度高于组件里的 `width: 100%`，三格各 120 px 撑出面板；
   「自动补齐」小字又只在一列里，拉高了那一列。改为 `.judgment-grid .judgment input.rw-input`（等宽三列，占满列宽）、列为「标签 / 输入」两行；「自动补齐 · 良」移到三格下面单独一行（不随列变化）。计算与输入行为未动。
2. **`/guide/:d/:l` <768**：两张插图放在标题左侧同一行（各 56 px，空 alt 不变），不再单独占一行；★ 选择行在 390×844 上的顶部位置 193 px（第一屏三分之一 281 px 以内）。
   谱面详情表：单行列（BPM、分类、属性、物量）`white-space: nowrap`，曲名列宽 240、谱面特征列宽 300（保留换行），表最小宽 860 px，在自身区域内横向滚动；页面仍不横向滚动。
3. **场景新增断言**（矩阵每组）：三个判定输入互不重叠、都在 `.rt-controls` 内、底边一致（≤ 1 px）、等宽（≤ 1 px）——实测宽 360：93 / 390：103 / 820：205 / 1440：141 px；
   <768 时 ★ 选择行顶部 < 844 / 3；详情表单行列每格只有一行、曲名与特征列宽 ≥ 200 px。

重新运行：`pages-selfcheck.mjs` **20/20**（0 控制台错误、0 水合警告、`portFreeAfter: true`）；RT 等工具输出比对重跑：RT 72 组全部相同，差异仍只有上面三处有意差异（`tools-after-fix1/`、`tools-capture-diff-fix1.json`）；
`check:ds` 通过、`test:ds` 90/90、`reworkStage5` / `reworkStage2` / `officialTitles` 共 37/37。`final/` 里的截图已用这次运行（`fix1/`）的截图替换。

## 切片 G：调色、全站 Element Plus 映射、复核留下的事项、清理与一致性复核

2026-11-18，基于 `519bfac`，未提交、未合并、未部署，版本仍为 `1.15.0`。没有改 `server/api/**`、没有新增接口、没有数据库访问；接口的请求与响应不变。
范围外的页面与组件（年度、`/account/version-summary`、后台、`scripts/deploy_forum_web.sh`）一行未改。**隔离验收（Linux）尚未运行**；下面除注明「真实」外都是本机开发自检。
地址合并（`/play/*`、`/growth/*`、`/community/*`、`/login`、`/bind` 及其重定向）按负责人裁定**本轮不做**，记在 `rework-status.md` 的待决事项里。

### 1. 调色（只改 token 的值）

裁定与全部取值见 `viewer-ds.md`「实施调色（2026-11-18）」；差异的唯一来源 `scripts/ds/spec/tuning-2026-11-18.json`。

| token | 主题 | 原值 | 新值 |
|---|---|---|---|
| `--bg` | 浅 | `#eaf6f5` | `#f0f4f4` |
| `--bg-sunk` | 浅 | `#def0ee` | `#e4eaea` |
| `--surface` | 浅 | `#f9fdfc` | `#ffffff` |
| `--surface-2` | 浅 | `#f2f9f8` | `#f7f9f9` |
| `--line` | 浅 | `#ccdfdc` | `#d3dcdc` |
| `--action-bg` | 深 | `#86d9dc` | `#45aeb5` |
| `--action-bg-hover` | 深 | `#a0e3e5` | `#5cbcc2` |
| 新增 `--chrome-bg` / `-surface` / `-sunk` / `-line` | 浅 / 深 | — | 调色前的 `--bg` / `--surface` / `--bg-sunk` / `--line`（深色与现值相同） |
| 新增 `--action-bg-active` | 浅 / 深 | — | `= --action-bg-hover` / `#3a9da4` |
| 新增 `--disabled-bg` / `-ink` / `-line` | 浅 / 深 | — | `--bg-sunk` / `--ink-3` / `--line`；`#1f3d42` / `#6b8a8c` / `#2f5257` |

- 外壳（左侧栏、顶栏、副页签、手机底栏、顶栏搜索框、外壳按钮悬停、跳到主要内容链接）改读 `--chrome-*`，浅色下框架保持青绿，内容区中性。
- 禁用按钮：`.rw-btn:disabled` 与 `el-button.is-disabled` 改读 `--disabled-*`（playbook §7 已更正：深色下禁用态是低对比的底与字，不再是近黑底加亮字）。Element Plus 主按钮按下改读 `--action-bg-active`。
- 没有改：文字、链接、品牌、选中、焦点（深色仍 `#86d9dc`）；音符、王冠、评价、难度、类型；`--line-strong`；素材；`.stage`（舞台里 `--action-bg*` 仍取舞台品牌值，新 token 在舞台里按舞台值重新声明）。
- 检查：`check-tokens` 的快照改为「原型级联 + 调整」（2416 个解析值）；`--prototype` 另核对「生产去掉调整 = 原型」与 `04` §2.2–§2.5（211 个值 0 处不符）。`contrast-check` 416 对全部通过（新增框架底上的文字 / 链接 / 导航 / 焦点、按下态、主按钮填充对 `--surface` / `--bg` / `--surface-2`（深色 4.76 / 6.40 / 3.68）、禁用文字下限 2.5）。

### 2. Element Plus 映射成为默认值

- 机制（playbook §3 已改写）：`components/rework/Shell.vue` 默认在 `<html>` 上加 `rework-ep`，只跳过 `utils/rework/navigation.ts` 的 `isLegacyPage`（`LEGACY_PAGES = ['/annual']`、`LEGACY_PREFIXES = ['/admin']`）。这些页面同时保留调色前的页面底（`.rework-shell.is-legacy` 读 `--chrome-bg`）。
  选「外壳默认 + 显式名单」而不是「meta 改成退出开关」：后者要改 `pages/annual.vue`（范围外）。只留一种机制：45 个页面里的 `reworkElementPlus: true` 已删除（`reworkStage2/3/5` 的对应断言改为「页面不再写这个 meta」）。
- 用到默认布局的范围外页面只有 `/annual`（`pages/annual*` 其余用 `story` 或无布局；后台用 `admin-taiko` 或无布局，`/admin/taiko` 首页只做重定向）。`/about`、曲库、`/my` 父路由、重定向页现在都有映射。
- **`/annual` 只在手机上渲染**（`middleware/annual-mobile.global.ts`：桌面浏览器被送到首页，带 `annualMobileOnly`）。所以：
  - 「改前改后不变」的证明用手机 UA 采集（`existing-pages.mjs` 新增 `DS_USER_AGENT`）：`/annual`、`/ja/annual`、`/annual/share/<token>`（中日）、`/admin/taiko/login` × 1440 / 390 × 浅 / 深 = 20 个状态。改前在 `519bfac`（工作区改动临时存放，只保留新增的脚本）采集，改后在最终代码上采集。结果见「验证」。
  - 各切片场景里「没有映射的页面」由 `/about` 改为 `/annual`，该场景的页面以手机 UA 打开（请求头 + `navigator.userAgent`）；曲库在详情场景里改为断言「有映射」。

### 3. 复核留下的事项（playbook §7）

1. **顶栏账号菜单**：登录后头像是菜单按钮（`aria-haspopup="menu"`、`aria-expanded`、`aria-controls`），菜单 `role=menu` 四项：个人档案、多端同步、设置、退出登录。Enter / 空格 / ↓ 打开并聚焦第一项，↑ 聚焦最后一项；菜单内 ↑ ↓ 循环、Home / End；Esc 关闭并把焦点还给按钮；Tab、外部点击、任何导航都关闭。未登录仍是「登录」链接（标记与改前相同）。
   退出登录三处（菜单、手机「我的」页、档案页）共用 `composables/useAccountSignOut.ts`：旧侧栏的同一请求与步骤（`POST /api/account/auth/logout` → 清本地账号状态 → 登录页；失败静默）。档案页的入口保留。
   手机（< 768 顶栏不显示头像）：「我的」页在分组之后加一组：设置（所有人）、退出登录（已登录）；个人档案是顶部身份行，多端同步在「常用功能」里。
2. **折线图**（`utils/ds/charts.ts`）：x 轴标签取同一个整数步长（0、s、2s…），最后一个点总有标签，离它太近的常规标签去掉（只有最后一段可能长于步长，最多 2 倍）；y 轴 ≥ 10,000 的标签带千分位（`en-US`，小于 10,000 不分组）；刻度步长多了 4 × 10^k，在 ≤ 4 条参考线的预算内取范围最紧的一个（0–10,200 → 0–12,000，原来 0–15,000）。`dsCharts.test.ts` 新增 2 条、改 1 条（步长集合）。
3. **首页横幅**：有成长面板时（已登录、有数据），横幅（`AnnualHero`，范围外组件，未改）放进问候一行：≥ 1100 在问候右侧（最宽 612，原尺寸不放大），两个成长链接移到问候下方；< 1100 在问候上方。其他状态（访客、未绑定、无数据、读取中）仍在页面顶部一行。图片有固定宽高，没有版面跳动；没有裁切。
4. **「其他」歌曲的返回**：与未上架相同，详情页在地址不带 `list=` 时补 `list=other`（`replace`；服务端渲染时同样是重定向，与未上架一致），外壳返回键与面包屑只看地址，因此回到 `/songs?shelf=other`。
5. **回复框上传预览**：改用 `ReworkCommunityMedia`；加载失败显示与内容图片失败相同的中性占位（图片图标、虚线框、`role=img` + 「图片加载失败」），不再回落到无关图片。之后 `ForumSafeImage` 没有调用者，已删除。
6. **删除的组件**（逐个全仓库搜索：组件名、短横线名、`Lazy` 前缀、文件名）：见下表。
7. **登录场景两次失败**：见「登录场景的失败」。
8. **Nuxt 开发锁**：运行器结束自己的 dev 服务器（按进程号结束进程树，nuxi 来不及释放锁）后，`releaseOwnDevLock` 删除 `.nuxt/nuxt.lock`——只在锁的端口等于本次端口、写入时间不早于本次启动、端口已空闲时删除；别的进程的锁不动。每次运行在结果里记录 `devLock`（本切片所有运行都是 `removed`）。不再需要 `NUXT_IGNORE_LOCK=1`。

### 删除与保留

| 文件 | 处理 | 依据 / 改动的测试 |
|---|---|---|
| `components/SidebarNav.vue` | 删除 | 外壳替代（Stage 1）。读它源码的：`growthPassportHttp`、`growthWeeklyHttp` 改读 `utils/rework/today.ts`（成长页签含 `/my/growth`、`/my/weekly`）；`scripts/verify_annual_contract.mjs` 的「年度入口在点击里预热音乐」改读 `components/rework/my/Hub.vue`——**旧侧栏的这项行为从 Stage 1 起就丢了**，本切片在「我的」页的年度入口按原逻辑补回（`primeAnnualBgm()`，1 秒后未进入年度页则释放） |
| `components/MobileTabBar.vue`、`components/AppMobileHeader.vue`、`components/GradeDojoShell.vue` | 删除 | 无任何引用 |
| `components/account/AccountSongScores.vue` | 删除 | `dsUtils` 的王冠顺序断言改读 `tests/fixtures/account-song-scores-crownlabel-original.txt`（删除前的 `crownLabel` 原文） |
| `components/my-taiko/Overview.vue` | 删除 | `homeDeepState` 中只测这个组件的 2 条测试删除（23 → 21，留注释）；`/my` 自切片 B 起是 `rework/my/Hub.vue`。`server/services/my-taiko/overview.ts` 与类型 `MyTaikoOverview` 是接口，保留 |
| `components/RecommendationSongItem.vue` | 删除 | `recommendationSongItem` 中只测这个组件的中日 2 条删除（留注释），其余 2 条（`RecommendationGoalAction`）保留 |
| `components/tools/AccountToolGate.vue` | 删除 | `reworkStage5` 的断言改为「文件已不存在」 |
| `components/forum/ForumSafeImage.vue` | 删除 | 回复框改完后无调用者；`tests/fixtures/forumDiscoveryBrowserRuntime.mjs`（Linux 工装）去掉它的导入与注册——这个工装还导入切片 D 已删除的 `ForumThreadCard` 等，改前就不能运行，见 Linux 清单 |
| `components/SongCoverImage.vue` | 保留 | 唯一的组件调用者（`RecommendationSongItem`）已删；但 `tests/songCoverFallback.test.mjs` 测它的回落规则、`DsCover` 的缓存参数说明以它为来源、Linux 工装导入它。删不删由负责人决定 |
| `components/forum/ForumMediaViewer.vue`、`SongRelatedDiscussions.vue`、`components/account/*Dialog.vue`、`TitleBadges.vue`、`components/home/*`、`RecommendationGoalAction.vue` | 保留 | 仍被重做页面使用 |
| 旧的 `--viewer-*` token 与全局 CSS | 保留 | 范围外页面仍在用 |

### 登录场景的失败（E1 `login` 390）

结论：**不是页面逻辑的竞态**，按证据判断是开发服务器一侧的停顿；本切片没有复现，没有改产品代码，场景加了诊断。

- 失败时的状态（切片 F 两次失败的记录与截图）：按钮显示「继续」并保持转圈、`disabled`，没有错误提示，地址 120 秒不变，最后一个请求是 `GET /api/account/auth/me`。按钮文字「继续」说明 `POST /auth/login` 已成功、`authenticatedUserId` 已写入；仍在转圈说明 `submit()` 停在某个 `await` 上没有返回。
- 排除：①视图票据（`useAuthFormScope`）失效——那条路径会在停用时把 `submitting` 复位，按钮不会一直转；②开发服务器重载页面——页面没有重载（表单状态还在），日志里没有 Vite 依赖重新优化或重载；③两个开发服务器争用 `.nuxt`——切片 F 那几次运行在时间上首尾相接，没有重叠；④登录页守卫跳转——会产生导航失败并显示错误，而这里没有。
- 剩下的只有 `await navigateTo("/settings")` 没有结束（URL 只在导航确认后才变）。本切片在通过的运行里记录了这一步的请求（Playwright 跟踪 `e1-trace/loop1/…trace-login-390-zh.zip`）：放行后依次是 `auth/me` → `/_nuxt/pages/settings.vue` → **`/settings/_payload.json`**。`/settings` 没有被排除在预渲染之外，客户端把它当作预渲染页面，在路由 `beforeResolve` 里先取载荷再确认导航；开发模式下这个载荷是服务器当场渲染 `/settings` 得到的（页面 `await fetchCurrentUser()`，服务端会读账号库，本机库主机不可解析）。这一步在通过的运行里约 160 ms；它没有超时，若服务器渲染卡住，导航就一直不确认，正是失败时看到的样子。
- 复现：同一顺序的整套 E1 跑了 3 次（`e1-trace/run1`、`final/account-run1`、`final/account`），另外每次新启动开发服务器只跑「预热 → SSR 中日 → 登录四个场景」5 次（`e1-trace/loop1–5`，即切片 F 失败时所在的位置），`login` 390 全部通过（8/8）。
- 判断与处理：页面的登录流程在生产产物上取的是静态的预渲染载荷，不经过这条开发时的服务器渲染，所以不按产品竞态修。场景改为在失败时记录**仍在进行的请求**（`inflight`），并可用 `REWORK_TRACE=<场景前缀>` 记录跟踪；以后再出现，结果里会直接给出卡住的请求。这一判断没有被复现直接证实，Linux 生产产物上的 E1 验收仍要重点看这一步。

### 一致性复核

全部重做页面（`pages/` 下除后台、年度、版本摘要，48 个地址状态，其中重定向页 5 个不单列）各 1440 浅色中文、390 深色中文、1440 浅色日文，加 360 宽中日两种的横向滚动检查；数据层级同各切片（`real` 为真实服务端渲染 + 合成文件 / 合成上游，`intercepted` 为切片自己的拦截数据，截图文件名标明）。
截图：主检出 `.claude/stage-artifacts/slice-g/pages/<地址名>__1440-light__<real|intercepted>.png`、`__390-dark__…`。量出的数据：`sweep.json`（h1 字号 / 位置、内容区左缘与宽度、当前页签文字、按钮高度 / 圆角 / 字号、面板、状态块、第一个键盘焦点的样式、横向滚动）。

| 发现 | 处理 |
|---|---|
| 曲库的 `<h1>`（上架状态名）是 18 px，其余页面 32 px | 改为与 `ReworkPageHeader` 相同的字号与字重；位置不变（原型的版面：左侧筛选、右侧搜索与标题） |
| 曲库组：攻略入口是 standard（左缘 262），其余 wide（172） | 攻略入口改 wide |
| 工具组三种宽度：查配置、查物量、词云 wide，RT、TJA、工具 standard，设置、关于 reading；设置的栏 760 居中，标题比左缘缩进 20 px | 全组 standard（左缘 262）；设置、关于的栏保持 800 宽、左对齐 |
| 帖子页 `<h1>` 36 px（其余 32 px） | 去掉帖子页的字号覆盖 |
| Element Plus 输入框 / 下拉的键盘焦点只有 1 px 边框色（自绘输入框是 2 px 焦点环）；档案页「更换头像」外的 `el-upload` 获得焦点时没有任何焦点样式 | 映射里加同一个 2 px 焦点环（`.el-input__wrapper.is-focus`、`.el-select__wrapper.is-focused`、`.el-textarea__inner:focus-visible`、`.el-upload:focus-visible`，两组作用域各一份） |
| `/annual` 改前改后唯一的差别：外壳「跳到主要内容」链接的底色读 `--surface`（浅色由 `#f9fdfc` 变白） | 改读 `--chrome-surface`（框架的一部分）后完全相同 |
| 首页问候 `<h1>` 28 px、访客首页 44 px、档案页（用户名）28 px、发新帖的标题在吸顶栏里（18 px）、`/my` 的 `<h1>` 只给读屏 | 各切片有意的设计（首页与档案页的身份行、发帖页的吸顶栏），未改 |
| 曲库页签「歌曲列表」与 `<h1>`（「实装歌曲」等上架状态名）不同 | 未改：标题跟随上架状态（Stage 1 复核时定的叫法），页签是页面名 |
| 账号相关页面（同步、开发者、工单、审批）宽度不一（reading / standard / wide） | 未改：它们不在桌面导航的任何一组里；审批台是双栏工作台 |
| 主页面首个焦点是年度横幅链接，焦点环 3 px（`AnnualHero` 自带样式） | 范围外组件，未改 |
| 横向滚动、唯一 `<h1>`、旧的朱色主按钮、控制台错误 / 水合警告 | 48 个地址 × 3 组 + 360 中日：0 处 |
| 模板里的内联中日三元 | 0 处。脚本里剩下的只有日期 / 数字格式的语言选择，以及共享组件 `RecommendationGoalAction.vue` 的文案表（测试直接编译这个组件，未迁） |
| 按钮 | 全部 44 px、圆角 8 px；常规 14 px、`--sm` 13 px；主 / 次 / 幽灵 / 危险描边四种 |
| 面板 | `rw-panel` 一种：圆角 14、白底、`--line` 边、上 16 / 左 20 |

### 验证

| 层级 | 内容 | 结果 |
| --- | --- | --- |
| 静态 / 单元（真实） | `npm run test:ds`、`npm run check:ds`、`npm run test:version`、`reworkStage1`…`5` | 92/92（新增 2 条图表）；通过（tokens 2416 值、EP 两作用域一致、collisions 0、对比度 416/416、token 对照表已重新生成、scoped CSS 0、ds usage 180 文件 0、ds copy 176 文件、小图标 46）；1/1；14/14、19/19、11/11、15/15、16/16 |
| 静态（真实） | `check-tokens --prototype <redesign-v1>` | 原型 + 调整 = 生产（4832 值）；生产去掉调整 = 原型；`04` 表 211 值 0 不符 |
| 业务测试基线（真实，逐文件，101 个文件） | 切片 C–F 记录过的文件（首页、目标、成长、论坛、OIDC、账号入口、工具等） | 逐文件与各切片记录相同，差别只有：`homeDeepState` 23 → 21（删除只测已删组件的 2 条，见下）；`recommendationSongItem` 2/2（同样删除了 2 条，以前的记录里没有这个文件）；`dsUtils` 13/13（改读 fixture）。没有记录过的 `songCoverFallback` 本机 0/1（环境）。证据：`.claude/stage-artifacts/slice-g/baseline-after/summary.txt` |
| 范围外页面不变（真实，`existing-pages.mjs`，手机 UA） | `/annual`、`/ja/annual`、`/annual/share/<token>`、`/ja/annual/share/<token>`、`/admin/taiko/login` × 1440 / 390 × 浅 / 深：改前 `519bfac`，改后最终代码 | **20/20 完全相同**（DOM、版面、计算样式、字体与图片请求、错误；像素也相同）。中途一次比对发现「跳到主要内容」链接的底色变了，改为 `--chrome-surface` 后重采 |
| 调色证据 | 改前（动手前）/ 改后：成绩列表、登录后首页、同步、工单（拦截），曲库、歌曲详情、登录页（真实）× 1440 / 390 × 浅 / 深 | 28 + 28 张，`.claude/stage-artifacts/slice-g/colour/before/`、`after/` |
| 一致性复核 | 48 个地址 × 1440 浅中文（截图 + 测量 + 360 中文）、390 深中文（截图）、1440 浅日文（测量 + 360 日文） | 144/144；修正后受影响的 17 个地址重跑 51/51。唯一 `<h1>`、无横向滚动、无旧朱色主按钮、0 控制台错误 / 水合警告 |
| 曲库（切片 1） | `catalog-selfcheck` | HTTP 57/57、SSR 失败通过、24/24 |
| 切片 A | `detail-selfcheck` | 44/44 + SSR 失败通过（第一次 43/44：「其他」歌曲返回的断言是旧行为，按第 4 项改断言后重跑） |
| 切片 B | `scores-selfcheck` | 25/25（第一次 14/25：「我的」页入口数 10 → 11、访客 8 → 9，按第 1 项改断言后重跑） |
| 切片 C | `today-selfcheck` | 54/54（首页问候行断言已改为带横幅） |
| 切片 D | `community-selfcheck` | 27/27 |
| 切片 E1 | `account-selfcheck` | 25/25（最终代码）。此前一次 24/25：档案页 390 日文的「目录行在区块之上」——场景在页面自动滚到待确认挑战后测量吸顶的目录行（场景竞态），改为回到页顶后一次测完；`login` 390 见上节，3 次整套 + 5 次冷启动全部通过 |
| 切片 E2 | `account2-selfcheck` | 25/25 |
| 切片 F | `pages-selfcheck` | 20/20 |
| Stage 0 样张 | `samples-matrix.mjs`、`charts-check.mjs`、`browser-check.mjs`（`--existing /annual`，手机 UA） | 457/457；350/350；67/72——5 条见「看到但没有改」（Element Plus 按需样式表与 `/annual` 自身的 503，与作用域无关）。`browser-check` 的根属性样例改为与 `--brand-primary` 比较（样例规则读的就是它；深色 `--action-bg` 现在低一档）；以 `/settings` 作参照时 9 条失败是因为它已经有映射 |
| 未验证 | 生产 Nitro、Linux 浏览器、真实数据库与登录（真实退出登录）、真机（手机「我的」页、软键盘、触控）、读屏实际播报（菜单按钮只按 WAI-ARIA 写法做了键盘自检）、真实手机上的 `/annual` | — |

所有运行：端口 3578、`127.0.0.1`、库主机不可解析、`no-egress` 预加载、一个浏览器、只结束自己记录的进程树；每次结束时 `portFreeAfter: true`、`browserStoppedAfter: true`、`devLock: removed`。最后检查 3578 没有监听；`adminTraffic` 测试留下的 `taiko_viewer/var/` 已删除。
证据（不提交）：主检出 `.claude/stage-artifacts/slice-g/`：`colour/`、`outofscope/before-phone/`、`final/outofscope/after-phone/`（与 `final/outofscope-compare.txt`）、`sweep1/`、`final/sweep/`、`pages/`（最终截图 96 张与 `inconsistencies.txt`）、`final/<切片>/`（`-run1` 为第一次）、`final/stage0/`、`e1-trace/`、`baseline-after/`。

### 改动的测试断言与工装（逐条）

1. `reworkStage2`（3 处）、`reworkStage3`（1 处）、`reworkStage5`（2 处）：「页面带 `reworkElementPlus: true`」改为「页面不写这个 meta」（映射是外壳默认）；`reworkStage5` 的 `AccountToolGate` 一条改为文件不存在。
2. `dsUtils`：王冠顺序改读删除前的 `crownLabel` 原文（fixture）。
3. `homeDeepState`：删除只测 `my-taiko/Overview.vue` 的 2 条。`recommendationSongItem`：删除只测 `RecommendationSongItem.vue` 的中日 2 条，`rowComponent` 默认路径改为 `RecommendationGoalAction.vue`。
4. `growthPassportHttp`、`growthWeeklyHttp`：导航来源由 `SidebarNav.vue` 改为 `utils/rework/today.ts`。
5. `scripts/verify_annual_contract.mjs`：年度入口预热音乐的检查改读 `components/rework/my/Hub.vue`。
6. `dsCharts`：步长集合加 4；新增「y 轴千分位」「x 轴等步长、最后标签固定」两条与上界取紧的三个例子。
7. 场景模块：七个切片的 EP 开关场景改用 `/annual`（手机 UA）；详情场景「曲库没有映射」改为「有映射」；`pages-scenarios` 的「`/about` 没有映射」改为全部有；`today-scenarios` 的首页问候行几何断言加横幅（≥ 1100 在右，以下在上，链接位置随之）；`account-scenarios` 加 `REWORK_TRACE` 跟踪与失败时仍在进行的请求。
8. `existing-pages.mjs` 加 `DS_USER_AGENT`；`selfcheck-runner.mjs` 加 `releaseOwnDevLock` 与 `launchBrowser`；新增 `sweep-scenarios.mjs`、`sweep-selfcheck.mjs`（`--mode=colour|pages|outofscope|stage0`）。
9. `reworkStage5` 新增切片 G 4 条（12 → 16）。

### 看到但没有改

- `/annual` 只在手机 UA 上渲染，桌面浏览器被送到首页（`annualMobileOnly`）；范围外，未改。
- 首页年度横幅链接的焦点环是 3 px、`--el-color-primary`（`AnnualHero` 自带样式，范围外）。
- `components/SongCoverImage.vue` 已没有组件调用者（见删除与保留）。
- `browser-check.mjs` 以 `/annual`（现在唯一没有映射的外壳页面）作参照时，离开样张后 `el-tooltip` / `el-message` 探针的计算样式与进入前不同：Element Plus 在第一次用到某个组件时才加载它的样式表，加载后的样式表排在 `main.css` 之后，旧页面的提示框颜色随之变化。这是生产里从任何用过这些组件的页面去 `/annual` 都会发生的情况，与 `ds-preview` 作用域无关，切片 G 之前同样存在；另 1 条是 `/annual` 自己的年度接口在无库时 503 被记在样张页上。原脚本以 `/settings` 作参照的检查前提（该页没有映射）已经不成立。
- `tests/songCoverFallback.test.mjs` 在本机失败（esbuild 解析不了含 `%E6` 的路径与 `vue`，环境），以前的记录里没有这个文件。
- 本工作区的检出是 CRLF（`core.autocrlf=true`），`reworkStage4` 里按 `\n` 匹配源码的 3 条在 CRLF 文件上失败；本切片改过的文件都写回 LF（提交时 git 统一为 LF，与提交内容无关）。以前的切片记录 15/15 应是在 LF 文件上跑的。
- 社区场景开发模式下的路由切换有约 1.1 s 的几次、最长任务 1822 ms（开发模式按需编译，切片 D 记录里没有这两个数，不作结论）。

### Linux 隔离验收（尚未运行）

- `shell-sql.mjs --check=sweep`：在生产 Nitro 上跑 `runSweep()`（与本机同一组地址与拦截）并对比截图；登录态改为私有测试库的真实账号时，账号菜单的退出登录走真实 `POST /api/account/auth/logout`。
- `/annual` 不变的证明：用手机 UA 在生产产物上重复 `existing-pages.mjs capture`（`DS_USER_AGENT`）改前（`519bfac` 的构建）/ 改后比对。
- 各切片的 Linux 清单汇总在 `rework-status.md`；本切片新增的需更新项：`scripts/verify_annual_contract.mjs`（已改，读 Hub）；`tests/fixtures/forumDiscoveryBrowserRuntime.mjs`（改前即导入已删除的组件）。
