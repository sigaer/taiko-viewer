# 全站 Rework 实施规则

设计负责人维护。适用于 Stage 1 剩余部分到 Stage 5 的每一个切片；每个切片的实施者先读这一份，
再读 `viewer-ds.md`、`stage-1-progress.md` 和自己切片的任务说明。与本文冲突的旧约定以本文为准。

依据：Design V1.3 Final（冻结基线 `5f770a2`，原型在仓库主检出的 `preview/redesign-v1/`，只读）与
`preview/redesign-v1/docs/06-migration-plan.md`。2026-11-18 项目负责人的指示：按现有方案推进整站，
大体遵循方案即可；色彩与布局觉得不对的地方可以调整；最大程度使用已有的曲绘、难度、评价、王冠图标
和其他适用组件。

## 1. 切片与分支

一次只有一个写入者。每个切片一个提交，可以单独撤销。不合并 `main`，不部署。

| 切片 | 内容 | 分支 |
|---|---|---|
| A | 页面基础件、歌曲详情、定数表 | `feature/viewer-rework-stage1` |
| B | 成绩：`/account/songs`、`/my`、`/tools/b30`、`trend`、`progress`、`recommend` | `feature/viewer-rework-stage2` |
| C | 今日 `/`（四种登录态）、`/my/growth`、`/my/weekly`、目标 | `feature/viewer-rework-stage2` |
| D | 社区：`/forum` 全部页面 | `feature/viewer-rework-stage3` |
| E | 账号：登录、注册、找回、资料、同步、开发者、工单、版本摘要、设置 | `feature/viewer-rework-stage4` |
| F | 段位、攻略、称号、工具、关于、更多、别名记录、文档页、支持页 | `feature/viewer-rework-stage5` |
| G | 全站 Element Plus 映射切换、旧样式与废弃组件清理、地址合并与重定向、全站一致性复核 | `feature/viewer-rework-stage5` |

不在范围内，一行都不改：年度回顾（`pages/annual*`、`pages/account/annual-*`、`components/Annual*`、
`layouts/story.vue`、相关服务端代码）、后台（`pages/admin/**`、`layouts/admin-taiko.vue`）、
`scripts/deploy_forum_web.sh`、`server/api/**` 的契约、数据库。

## 2. 改什么，不改什么

- **改的是呈现**：模板结构、样式、交互细节、状态呈现、文案位置。页面的 `<script>` 里取数、权限、
  路由参数、SEO、埋点的逻辑保持不变；需要拆组件时把呈现部分拆到 `components/rework/<区域>/`，
  数据逻辑留在原处或原样搬走，不重写。
- **不改业务**：Rating、成长事实、目标判定、同步状态机、登录与 OIDC、绑定校验、论坛读写、限流、
  消息与通知的含义。接口的请求与响应不变，不新增接口。
- **只用真实数据**：页面上出现的每个字段都来自现有接口或现有数据文件。原型里有而生产没有的
  （例如每小节音符密度、目标尝试轨迹、时间栈的 Rating / 段位里程碑、段位道场合格记录、公开个人主页）
  不做替身、不放占位、不写「即将上线」，记到进度文档的契约缺口里。
- **现有功能一个不少**：重做一个页面之前先列出它现在能做的每件事（操作、链接、弹层、状态、提示），
  重做之后逐项对照。少了任何一项都要在交回时说明原因。
- **地址不变**：切片 A–F 保持现有地址。迁移方案里的地址合并（`/play/*`、`/growth/*`、
  `/community/*` 等）统一放到切片 G，用 `legacyCatalogLocation` 同样的方式加服务端 302。

## 3. 设计

- 每个页面对照原型里对应的视图（`preview/redesign-v1/src/views/*.vue`）和 `docs/05-page-specs.md`、
  `docs/04-design-system.md`、`docs/16-v1.3-component-specs.md`。原型是视觉与交互参照，不是数据模型：
  它的路由、Mock、Store、字段名都不搬。
- 原型与真实数据对不上时（字段更少、文本更长、状态更多），按真实数据重新排版，可以调整布局与
  用色，把偏离和原因写进进度文档。判断标准：信息层级清楚、一屏里品牌色只标交互、手机上不挤。
- **素材与组件优先用已有的**：曲绘 `DsCover`、难度 `DsDiff` / `DsDiffTabs`、评价 `DsRank`、
  王冠 `DsCrown`、头像 `DsPlayerAvatar`、称号牌 `DsTitlePlate`、站内称号 `DsSiteTitle`、
  歌曲单元 `DsSongCell`、音符 `DsNote`、判定条 `DsJudgeBar`、图表 `components/ds/charts/*`，
  以及 `public/icons/` 下现有的图标。真实素材不改色、不加滤镜、不重新压缩。缺一种形态时给已有组件
  加属性（像 `DsDiff` 的 `showConstant`），不另写一个相似组件。
- **颜色只用 token**：新代码不写十六进制色，不引用 Primitive 层。品牌色（青绿）只用于主操作、
  链接、选中与焦点；音符色（咚 / 咔 / 连打）只表示游戏含义与数据，不做按钮和装饰。
- **Element Plus**：只在表单与弹层内部使用。已重做的页面通过路由 meta 打开 V1.3 的 Element Plus 映射
  （切片 A 建立这个开关，Teleport 弹层同样生效，离开页面后恢复）。全站默认值到切片 G 再切换。
  开关：页面 `definePageMeta({ reworkElementPlus: true })`；`components/rework/Shell.vue` 按当前路由在 `<html>`
  上加 `rework-ep`（SSR 首屏即有，切到没有这个 meta 的页面时去掉，keepalive 页面同样）。
  `assets/css/ds/element-plus.css` 的每条规则在 `html.ds-preview:root` 与 `html.rework-ep:root` 下各写一遍，
  `check-tokens.mjs` 检查两组选择器完全一致、没有第三种作用域。常驻弹层：`el-select` 用 `:persistent="false"`，
  对话框只在打开期间挂载（离开页面时不留节点）。
- **三项门槛**：
  - P1：成绩相关界面里王冠三档必须有可见文字（`DsCrown` 的 `text`），不只靠颜色；王冠原图不改。
  - P0：帖子回复框的软键盘避让，编译后的 scoped CSS 选择器必须命中目标元素（`check-scoped-css`）；
    真机验证不在本机范围，记为未验证。
  - P2：默认头像保持 `/default-avatar.svg`，不为截图调色。
- 评价图旁必须带评价名称文字。不显示段位徽章与段位数据。缺失值统一显示「—」。

## 4. 工程约定

- 新样式都在 `html.viewer-rework` 作用域的 token 之上；scoped 样式不写 `:global(sel) .x`。
- 断点 767 / 1099 / 1239（`utils/ds/breakpoints.ts`）。验证宽度 360、390、820、1440，深浅两种主题，
  中文与日文。不出现横向页面滚动；触控目标不小于 44 px；键盘焦点可见；尊重减少动效。
- 状态用统一的基础件呈现：加载（保持版面的骨架）、空、失败（带重试）、需要登录或绑定（`ReworkGate`）。
- 文案：新增或改动的可见文字放进 `locales/zh.json` 与 `locales/ja.json` 的 `rework.<区域>.*`；
  动到某个模板里内联的中日文案时顺手迁过去。遵守 `AGENTS.md` 的文案规则：只留名称、数据、操作与
  必要的状态说明，不写解释界面的副标题，不把规格语言写给用户。
- 页面默认 keepalive：依赖路由查询的页面只响应自己路由的变化；带常驻弹层的页面离开时不留节点。
- SSR 与水合一致：首屏不读浏览器存储，不用未取整的浮点数做属性值。
- 版本号保持 1.15.0，直到负责人另行决定。不改 `package-lock.json`（安装用 `npm install --no-save`）。

## 5. 验证（两层，互不替代）

本机是 Windows，没有 Linux 隔离环境、没有数据库。本机做的都是开发自检，不是验收。

- **真实（本机可做）**：单元测试与静态检查（`npm run test:ds`、`npm run check:ds`、
  `npm run test:version`、切片自己的测试文件）；重定向的原始 HTTP 检查；不依赖数据库的页面用合成
  数据文件跑真实接口与真实 SSR（做法见 `scripts/rework/catalog-selfcheck.mjs`）。
- **拦截请求的自检**：依赖数据库或登录的页面，用按真实响应类型写的合成数据拦截浏览器请求，
  在客户端导航下检查版面与交互。截图与结果都标明是拦截数据。服务端渲染出来的是未登录或失败状态，
  同样要检查水合无警告。
- 每个切片的浏览器场景写成不依赖环境的模块（`scripts/rework/<切片>-scenarios.mjs`），本机运行器和
  以后的 Linux 运行器共用；Linux 一侧只需要写清楚怎么接到 `shell-sql.mjs` 的 `--check=`，不要求在
  本机写出无法运行的大段代码。
- 开发服务器：自己的端口（不用 3000、3517、3518、3527、3562），数据库主机设为 `invalid.invalid`，
  `NODE_OPTIONS` 预加载 `scripts/ds/no-egress.mjs`；一个浏览器、最多两个页面、有总时限、
  `finally` 里全部关闭；结束后确认端口空闲。不碰端口 3527 和进程 21500。
- 截图放到主检出的 `.claude/stage-artifacts/<切片>/`（不提交）：每个重做的页面至少 1440 浅色、
  390 深色各一张，关键状态（空、失败、需要登录）各一张，日文 390 抽一张。
- 性能预算沿用 V1.3：筛选与排序 ≤ 100 ms，路由切换 ≤ 200 ms，挂载行数 ≤ 60，无超过 200 ms 的长任务。
  开发服务器上的数字只作参考。

## 6. 交回

结论在前。说明：改了哪些文件；页面原有功能对照表里有没有缺项；偏离原型或本文的地方与原因；
测试与检查结果（带数量）；哪些是真实验证、哪些是拦截数据的自检、哪些没有验证；契约缺口；
在现有生产代码里看到但没有改的问题；进程与端口是否清理干净。不提交、不推送。
权限提示挡住的操作写在交回里，不请别人代做。

进程清理只结束自己启动的进程（运行器记录的进程号及其进程树）。不按进程名或命令行匹配结束进程。

## 7. 留给切片 G 的事项（设计负责人在各切片复核时记下）

- 外壳的账号入口：顶栏头像目前没有菜单，退出登录只在资料页的「登录与关联」里（切片 E1 补回）。
  切片 G 给顶栏头像加账号菜单：资料、同步、设置、退出登录。
- 深色主题下禁用的主按钮是近黑底加亮字，看起来像可用的深色按钮：禁用态改成低对比的底与字。
- 折线图：x 轴日期标签间隔不均、y 轴大数没有千分位（Stage 0 复核时记下）。
- 首页顶部横幅在桌面上只占左侧约六成宽，右侧留空：重新安排。
- 「其他」歌曲在没有记住曲库位置、地址也不带 `list=` 时，返回落到 `/songs` 而不是 `/songs?shelf=other`。
- 不再被引用的旧组件：`SidebarNav.vue`、`MobileTabBar.vue`、`AccountSongScores.vue`、
  `my-taiko/Overview.vue`、`RecommendationSongItem.vue`、`AccountToolGate`（切片 F 之后）等，
  连同读取它们源码的测试一起处理。
- 回复框里刚上传图片的预览失败时仍回落到一张不相关的图片（`ForumSafeImage`）。
- 各切片交回里列出的、因选择器或类名变化需要在 Linux 一侧更新的浏览器脚本，汇总成一张清单。
