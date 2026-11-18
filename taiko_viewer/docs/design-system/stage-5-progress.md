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
