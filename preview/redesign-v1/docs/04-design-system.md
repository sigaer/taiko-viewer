# 04 · Design System V1.2

| 项 | 值 |
|---|---|
| 版本 | V1.2（Design Freeze 轮）：V1.1（`07` 的裁决）+ `10-v1.2-design-decisions.md` 的 F1–F5 |
| 日期 | 2026-11-16 |
| 活样张 | `/#/review/system`（`src/views/review/System.vue`）：每个样本都由下列源码直接渲染，切换主题与语言即见实际效果 |
| 逐项修复记录 | `08-v1.1-fix-record.md`（含 V1.2 一节） |
| 浏览器验收 | V1.1：`09-v1.1-qa-report.md`；V1.2：`11-v1.2-quality-report.md` |
| 遗留风险与集成验收 | `12-risks-and-integration-acceptance.md` |

本文是同一套规则的书面版本。所有数值取自原型源码；**源码与本文不一致时以源码为准**（裁决 D16）。

- `src/styles/tokens.css`：Design Tokens（Primitive → Semantic → Domain）
- `src/styles/base.css`：重置、排版角色、布局辅助、基础控件类、减少动效、舞台面 `.stage`
- `src/styles/domain.css`：游戏语义视觉（音符、难度、王冠、评价、点灯格、封面、判定条、社区角色）
- `src/components/*.vue`：框架、浮层、图表与业务组件（较新的组件文件顶部有 JSDoc，写明 props 与用法）
- `src/{sync,search,routeState,motion,breakpoints,sectionNav,hscroll,focusTrap,dock}.js`：同步状态机、搜索、路由状态、减少动效、断点、页内目录、表格横滑、浮层焦点、手机底部固定区与软键盘（V1.2）
- `src/styles/contrast-check.mjs`：token 对比度检查

C 组裁决（C1–C14，截图复核）在本文中以规范形式写出，均已落入源码（相关位置有 `C1`…`C14` 注释）；浏览器验收结果见 `09` §6a 与 `08` 第 10 节。V1.2 的 F 组裁定（手机详情页导航、触控豁免定稿、搜索面板性能、剩余质量问题、个人主页两处）同样写进对应章节，相关源码位置有 `F1`…`F5` 注释；验收见 `11`。

---

## 1. 设计原则

### 1.1 音符即数据

朱 = 咚：刷新成绩、主操作、选中下划线。浅葱 = 咔：信息、链接（`--ka-ink`）、稳定性类进展。山吹 = 连打：高光、连续游玩、里程碑、目标达成。玩家对这三种颜色已有肌肉记忆，直接用作数据编码；今日、成长、谱面图之间同一种颜色始终表示同一类事情。

### 1.2 一条谱面讲完一段时间

Lane（譜面レーン）是全站唯一的签名元素：时间从左到右，判定圈落在今天，每天一个音符。空、加载、错误状态沿用同一条谱面带（EmptyLane）。`--lane-*` token 只在谱面带、谱面图、空状态条里使用（D4）。

### 1.3 平面与细线，阴影只属于浮层

面板是 `--surface` + 1px `--line` + `--r-panel`，没有阴影。浮层（对话框、抽屉、命令面板、菜单、浮动面板、Toast）统一用 `--overlay-shadow`；`--shadow-lift` 只给浮在内容上方的按钮（原型控制按钮）。

### 1.4 数字与汉字各司其职

分数、Rating、定数、计数用 `.num`（Barlow Condensed、`tabular-nums lining-nums`、600）。汉字层级靠字重与字号。曲名里的数字用正文字体，不用 `.num`（D14）。

### 1.5 查询永远一步可达

桌面顶栏常驻搜索（`Ctrl K` / `⌘K`，非输入状态按 `/`），手机底栏正中是「咚」键。命令面板搜歌曲、帖子、操作、页面，也识别配置串与物量（P1–P10）。

### 1.6 四类模块，四种语气

同一套 token 与组件，曲库成绩、成长目标、社区个人主页、账号绑定在版面节奏、字号和谱面元素的用量上有意区分（V 组裁决，见第 13 节）。

---

## 2. Design Tokens

### 2.1 三层结构

| 层 | 内容 | 谁可以引用 |
|---|---|---|
| Primitive | 藍 `--ai-*`、朱 `--shu-*`、浅葱 `--asagi-*`、山吹 `--yamabuki-*` 色阶 | 只有 `tokens.css` 内的 Semantic / Domain 层 |
| Semantic | 背景、表面、线、文字、三色角色、实色填充、状态、焦点、Toast、音符、谱面带、舞台面、阴影、遮罩 | 组件、页面、`base.css`、`domain.css` |
| Domain | 判定、难度、王冠、评价、流派、社区版块 | `domain.css`、业务组件；页面通过组件或 domain 类使用 |

规则（D1 / D15）：

- **组件、页面、`base.css`、`domain.css` 只消费 Semantic 与 Domain token，不引用 Primitive，不写十六进制色。** 例外：`/review/directions` 里 B / C 方向的概念稿（本来就是别的配色），以及 `index.html` 首屏关键底色（见 3.2）。
- **游戏语义（难度、王冠、评价、判定、状态）只有一个来源**：`tokens.css` 的 Domain 层 + `domain.css` + 对应组件。页面不得自己声明这些颜色。
- 主题切换只改 Semantic / Domain 的值；排版、间距、圆角、布局、控件、浮层、动效、层级 token 与主题无关。

### 2.2 Primitive 色

| 藍 | 值 | | 朱 / 浅葱 / 山吹 | 值 |
|---|---|---|---|---|
| `--ai-950` | `#0b1120` | | `--shu-700` | `#b62a17` |
| `--ai-900` | `#101728` | | `--shu-650` | `#c42b13`（文字级朱） |
| `--ai-850` | `#151e35` | | `--shu-600` | `#d23a22` |
| `--ai-800` | `#1a2440` | | `--shu-500` | `#e8482e` |
| `--ai-750` | `#212d4e` | | `--shu-400` | `#ff6a4d` |
| `--ai-700` | `#2b3860` | | `--shu-100` | `#fde4de` |
| `--ai-600` | `#3f4d78` | | `--asagi-700` | `#0b6f82` |
| `--ai-500` | `#5a6790` | | `--asagi-600` | `#128a9f` |
| `--ai-400` | `#7f8aaa` | | `--asagi-500` | `#1fa5ba` |
| `--ai-300` | `#a7afc6` | | `--asagi-400` | `#4cc6d8` |
| `--ai-200` | `#cdd2e0` | | `--asagi-100` | `#d9f1f5` |
| `--ai-150` | `#dfe3ec` | | `--yamabuki-700` | `#906200` |
| `--ai-100` | `#eaedf3` | | `--yamabuki-600` | `#b47c00`（非文字状态点） |
| `--ai-50` | `#f3f5f8` | | `--yamabuki-500` | `#f2b51d` |
| `--ai-0` | `#ffffff` | | `--yamabuki-400` | `#ffcb45` |
| | | | `--yamabuki-100` | `#fdf0c8` |

V1.1 新增 `--shu-650`、`--yamabuki-600`，`--yamabuki-700` 由 V1 的 `#9a6a00` 调深为 `#906200`（D11）。

### 2.3 Semantic token（随主题变化）

浅色（紙）是 `:root` 与 `:root[data-theme='light']`；深色（夜藍）是 `:root[data-theme='dark']`。

| Token | 浅色 | 深色 | 用途 |
|---|---|---|---|
| `--bg` | `--ai-50` | `--ai-900` | 页面背景 |
| `--bg-sunk` | `--ai-100` | `--ai-950` | 凹陷：分段底、标签底、悬停底、骨架屏 |
| `--surface` | `--ai-0` | `--ai-850` | 面板、输入框、浮层 |
| `--surface-2` | `#f8f9fb` | `--ai-800` | 表格行悬停、次级表面 |
| `--line` | `--ai-150` | `#26314f` | 分隔线、面板边框 |
| `--line-strong` | `--ai-200` | `#34416a` | 表头下线、强分隔 |
| `--ctl-border` | `#838ba1` | `#606f9c` | 输入类控件、按钮、分段外框、筛选胶囊的边框（≥ 3:1） |
| `--ink` | `#17203a` | `#e9edf7` | 主文字 |
| `--ink-2` | `#47526f` | `#b1b9d0` | 次要文字 |
| `--ink-3` | `#5f6983` | `#8994b2` | 辅助文字、占位符、缺失值（在 `--bg-sunk` 上 ≥ 4.5:1） |
| `--ink-inv` | `#ffffff` | `#101728` | 反色文字 |
| `--don` | `--shu-500` | `--shu-400` | 咚：音符、指示、图形、选中下划线 |
| `--don-solid` | `--shu-600` | `--shu-400` | 实色朱填充（主按钮、计数徽章、步骤器当前音符） |
| `--ink-on-solid` | `--ai-0` | `--ai-950` | 实色填充（主按钮、难度标签）上的文字 |
| `--don-ink` | `--shu-650` | `#ff8266` | 文字级朱 |
| `--don-wash` | `--shu-100` | `#3b1f24` | 朱色浅底 |
| `--ka` / `--ka-ink` / `--ka-wash` | `--asagi-500` / `--asagi-700` / `--asagi-100` | `--asagi-400` / `#6fd6e6` / `#12303f` | 咔：信息、链接文字、浅底 |
| `--roll` / `--roll-ink` / `--roll-wash` | `--yamabuki-500` / `--yamabuki-700` / `--yamabuki-100` | `--yamabuki-400` / `#ffd568` / `#38301a` | 连打：高光、里程碑 |
| `--ok` / `--ok-wash` | `#007a46` / `#dcf3e6` | `#4ccb8a` / `#153527` | 成功、上升 |
| `--warn` | `--yamabuki-700` | `#ffd568` | 警告 |
| `--danger` / `--danger-wash` | `--shu-650` / `--shu-100` | `#ff8266` / `#3b1f24` | 错误、破坏性操作、下降；危险浅底（V1.1 新增 `--danger-wash`） |
| `--status-attn` | `--yamabuki-600` | `var(--roll)` | 状态点「需要你做一步 / 部分成功」 |
| `--focus-ring` | `--asagi-700` | `--asagi-400` | 焦点环实色 |
| `--toast-bg` / `--toast-ink` | `--ai-800` / `--ai-50` | `--ai-700` / `--ai-50` | Toast |
| `--lane` | `#232d4b` | `--ai-750` | 谱面带底色（浅色主题下也是深色带） |
| `--lane-line` | `#3a466b` | `#34416a` | 谱面带轨线、周小节线 |
| `--lane-ink` | `#e9edf7` | `#e9edf7` | 谱面带上的主文字 |
| `--shadow-pop` | `0 18px 50px -12px rgb(16 23 40 / .28), 0 2px 6px rgb(16 23 40 / .08)` | `0 24px 60px -12px rgb(0 0 0 / .6), 0 0 0 1px #34416a` | 浮层阴影（经 `--overlay-shadow` 引用） |
| `--shadow-lift` | `0 6px 18px -8px rgb(16 23 40 / .22)` | `0 8px 22px -8px rgb(0 0 0 / .5)` | 浮动按钮 |
| `--scrim` | `rgb(16 23 40 / .46)` | `rgb(5 8 16 / .62)` | 弹层遮罩 |

主操作与破坏性操作靠**形式**区分（实色填充 vs 描边），不靠色相（6.2）。

### 2.4 Semantic token（两套主题共用）

| Token | 值 | 用途 |
|---|---|---|
| `--note-ring` | `--ai-0` | 音符白色内环；实色块上的白色图形（D4） |
| `--note-outline` | `--ai-950` | 音符深色外轮廓；压暗混色；浅葱 / 山吹音符上的深色数字 |
| `--note-fc` | `#ffd75a` | 全连音符的金色内环 |
| `--status-ok` / `--status-fail` | `var(--ok)` / `var(--danger)` | 状态点 |
| `--focus-gap` | `var(--surface)` | 焦点环与元素之间的底色间隙 |
| `--focus` | `0 0 0 2px var(--focus-gap), 0 0 0 4px var(--focus-ring)` | 全局焦点环（2px 间隙 + 2px 实色环） |
| `--lane-don` / `--lane-ka` / `--lane-roll` | `--shu-400` / `--asagi-400` / `--yamabuki-500` | 谱面带上的音符 |
| `--lane-fc` | `var(--note-fc)` | 谱面带全连内环 |
| `--lane-ink-2` / `--lane-ink-3` | `#c3c9db` / `#a5aec8` | 谱面带上的次要文字（日期）/ 弱文字（星期、休息日、小节号），均 ≥ 4.5:1 |
| `--lane-focus` / `--focus-lane` | `--asagi-400` / `inset 0 0 0 2px var(--lane-focus)` | 谱面带内的焦点（`.on-lane` 把 `--focus` 换成它） |
| `--lane-ghost` / `--lane-ghost-ring` | `--ai-500` / `--ai-300` | 有游玩无进展的灰音符 |
| `--lane-measure` | `--ai-400` | 谱面图小节线 |
| `--stage-*` | 见下 | 舞台面 |

V1 的 `--lane-ring`、`--lane-outline`、`--avatar-bg`、`--avatar-ink` 与 `.avatar` 已删除，由 `--note-*` 与 PlayerAvatar 取代。

**舞台面 `.stage`**（集成阶段新增）：两套主题里都是深藍底，用于个人主页身份带、年度回顾手机封面、原型控制按钮。`base.css` 的 `.stage` 在局部把 `--bg`、`--bg-sunk`、`--surface`、`--surface-2`、`--line`、`--line-strong`、`--ctl-border`、`--ink*`、`--don-ink/-wash`、`--ka*`、`--roll*`、`--focus-ring`、`--focus-gap`、`--focus` 重映射到 `--stage-*`，并设 `color-scheme: dark`，子组件（TitlePlate、DanBadge、`.tag`、`.link`、`.btn`、`.role`）不需要单独改色。

| Token | 值 |
|---|---|
| `--stage-bg` / `--stage-sunk` / `--stage-surface` | `--ai-750` / `--ai-800` / `--ai-700` |
| `--stage-ink` / `-ink-2` / `-ink-3` | `#e9edf7` / `#c3c9db` / `#a5aec8` |
| `--stage-line` / `-line-strong` / `-ctl-border` | `#34416a` / `#46557f` / `#8592bb` |
| `--stage-focus` | `--asagi-400` |
| `--stage-don-ink` / `-don-wash` | `#ff8266` / `#3b1f24` |
| `--stage-ka` / `-ka-ink` / `-ka-wash` | `--asagi-400` / `#6fd6e6` / `#12303f` |
| `--stage-roll` / `-roll-ink` / `-roll-wash` | `--yamabuki-400` / `#ffd568` / `#38301a` |

页面内的局部类名不得再用 `.stage`（集成阶段把段位页与手机预览框的同名局部类改成了 `.dstage`、`.dv-stage`）。

### 2.5 Domain token

颜色约定（`domain.css`）：`--c` = 色块 / 边框 / 图形；`--c-ink` = 文字（≥ 4.5:1）。

**判定**：`--judge-good` = `var(--don)`；`--judge-ok` = `var(--ink-3)`；`--judge-ng` 浅 `#7648c8` / 深 `#a583f5`。

**难度**

| 难度 | `--diff-*`（色块）浅 / 深 | `--diff-*-ink`（文字）浅 / 深 |
|---|---|---|
| easy | `#d14019` / `#ff7a55` | `#af2b00` / 同色块 |
| normal | `#448208` / `#8fcb5a` | `#346c00` / 同色块 |
| hard | `#2876b8` / `#5aa9ea` | `#18619c` / 同色块 |
| oni | `#d02f7a` / `#ff66a8` | `#af1a63` / 同色块 |
| ura | `#7648c8` / `#a583f5` | `#6d42b8` / `#b192f8` |

难度色作文字时只允许经 `--diff-*-ink`（D11、C13）；它在 `--surface`、`--bg`、`--bg-sunk` 与自身 14% 浅底上 ≥ 4.5:1。

**王冠**：`--crown-none` 浅 `--ai-300` / 深 `#3f4d78`；`--crown-clear` 银 `#9aa5b8` / `#b9c3d6`；`--crown-fc` 金 `#e0a400` / `#ffc93a`（只作图形，文字用 `--crown-fc-ink` 浅 `#975e00` / 深同色块）；`--crown-dfc` 虹 `conic-gradient(from 210deg, #ff5a5a, #ffb13d, #f6e24b, #58d68d, #4cc6d8, #7a7cf0, #d05be0, #ff5a5a)`（两套主题共用）。

**评价**

| Token | 图形（两套主题共用，除注明） | 文字 `-ink` 浅 / 深 | 名称 |
|---|---|---|---|
| `--rank-iki1` | `#8c93a3` | `#656c7b` / `#9198a8` | 白粹 |
| `--rank-iki2` | `#b0703a` | `#995b23` / `#c6844f` | 铜粹 |
| `--rank-iki3` | `#8e9fb8` | `#5e6e85` / 同图形 | 银粹 |
| `--rank-miyabi1` | `#d79a00` | `#9a6000` / 同图形 | 金雅 |
| `--rank-miyabi2` | `#e2618f` | `#b83b6c` / `#eb6997` | 粉雅（日文「桃雅」） |
| `--rank-miyabi3` | `#8650d2` | `#804acb` / `#aa76fb` | 紫雅 |
| `--rank-kiwami` | 浅 `#17203a` / 深 `#e9edf7`（实色底） | 字为 `--bg` | 极 |
| `--rank-kiwami-ring` | `#c9a227` | — | 极的金色外环 |

**流派**（两套主题共用，只作色点 / 封面底色，不作文字）：`--genre-pops` `#2d9fb8`、`--genre-anime` `#f08a24`、`--genre-kids` `#f0508c`、`--genre-vocaloid` `#9aa7b8`、`--genre-game` `#a865d8`、`--genre-variety` `#5db33a`、`--genre-classic` `#c9a227`、`--genre-namco` `#e8482e`。

**社区版块** `--section-<slug>`（只作色点 / 色条，在 `--surface` 与 `--bg` 上 ≥ 3:1）：

| slug | 浅 | 深 |
|---|---|---|
| official | `#c8402b` | `#ff7a5f` |
| events | `#c4650a` | `#ff9f45` |
| beginner-help | `#2f7fb8` | `#5cb2ea` |
| score-guides | `#d24f2e` | `#ff8061` |
| dojo | `#a87512` | `#e3b04a` |
| achievements | `#c44a2a` | `#f2775a` |
| arcade | `#356f97` | `#6aa8d6` |
| general | `#2f7fb8` | `#5cb2ea` |
| creative | `#b9527c` | `#e57fa8` |

### 2.6 排版 token

| Token | 值 |
|---|---|
| `--font-cjk-sc` | `'Noto Sans SC Variable', 'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei UI', 'Microsoft YaHei', sans-serif` |
| `--font-cjk-jp` | `'Noto Sans JP Variable', 'Hiragino Sans', 'Yu Gothic UI', 'Meiryo', sans-serif` |
| `--font-ui` | `'Barlow', var(--font-cjk-sc)`；`:lang(ja)` 下为 `'Barlow', var(--font-cjk-jp)` |
| `--font-num` | `'Barlow Condensed', 'Barlow', var(--font-cjk-sc)`；`:lang(ja)` 下回退到 JP 栈 |

字号 `--fs-11` 0.6875rem、`--fs-12` 0.75rem、`--fs-13` 0.8125rem、`--fs-14` 0.875rem、`--fs-16` 1rem、`--fs-18` 1.125rem、`--fs-22` 1.375rem、`--fs-28` 1.75rem、`--fs-36` 2.25rem、`--fs-48` 3rem、`--fs-64` 4rem。行高 `--lh-tight` 1.15、`--lh-snug` 1.35、`--lh-body` 1.6（`body` 默认 14px / 1.6）。

### 2.7 间距与圆角

间距（4px 基准）：`--sp-1` 4、`--sp-2` 8、`--sp-3` 12、`--sp-4` 16、`--sp-5` 20、`--sp-6` 24、`--sp-8` 32、`--sp-10` 40、`--sp-12` 48、`--sp-16` 64（px）。页面上内边距 `--sp-6`（手机 `--sp-4`）；`.section` 间距 `--sp-10`（手机 `--sp-8`）；页面底部留白 `--sp-16`（手机 `--sp-12`）；`.panel-pad` `--sp-5`。

| 圆角 | 值 | 用于 |
|---|---|---|
| `--r-xs` | 6px | 标签（`--tag-radius`）、星级点、分段内钮、难度徽章、判定条、小封面 |
| `--r-ctl` | 8px | 按钮与输入框（`--ctl-radius`）、默认封面、命令面板图标格、大号点灯格 |
| `--r-panel` | 14px | 面板、谱面带、特大封面；浮层经 `--overlay-radius` 引用它 |
| `--r-sheet` | 22px | 手机底部抽屉的两个顶角 |
| `--r-note` | 999px | 音符、筛选胶囊、状态条 |

V1 的 `--r-lg`（18px，命令面板）已删除，命令面板改用 `--overlay-radius`。分段外框为 `calc(var(--ctl-radius) + 2px)`，与 3px 内边距下的内钮同心。封面圆角阶梯见 9.6（D3）。

### 2.8 布局、动效、层级

| Token | 值 | 说明 |
|---|---|---|
| `--rail-w` | 84px | 桌面 / 平板左轨 |
| `--bar-h` | 60px | 桌面 / 平板顶栏 |
| `--bar-h-m` | 52px | 手机顶栏（V1.1 新增） |
| `--subtab-h-m` | 44px | 手机二级页签条（V1.1 新增） |
| `--tab-h` | 62px | 手机底栏（不含安全区）；只由外壳与 `--shell-bottom` 使用，页面不直接引用 |
| `--shell-bottom` | 默认 `env(safe-area-inset-bottom, 0px)`；手机且 `:root[data-tabbar='on']` 时 `calc(var(--tab-h) + env(safe-area-inset-bottom, 0px))` | 外壳在底部的占用高度（V1.2，F1.3；定义在 `base.css`） |
| `--dock-h` | 默认 `0px`；由 `useDock` 写入固定条实际高度 | 页面自己的固定底部操作区高度（V1.2） |
| `--kb-h` | 默认 `0px`；由 `useKeyboardInset` 写入键盘遮挡高度 | 软键盘挡住的高度（V1.2，F1.5） |
| `--content-max` | 1480px | `.page` 最大宽度 |
| `--gutter` | 28px；≤767 为 16px | 页面左右边距 |
| `--dur-1` / `--dur-2` / `--dur-3` | 120 / 220 / 420ms | 颜色与按下 / 浮层与音符放大 / 底部抽屉 |
| `--ease-out` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | 默认缓动 |
| `--ease-hit` | `cubic-bezier(0.3, 1.6, 0.5, 1)` | 击打回弹：只用于按下圆形击打物（咚键、播放键、音符）与达成反馈，不用于容器；减少动效时不缩放 |
| `--z-rail` / `--z-bar` | 20 / 30 | 左轨 / 顶栏、手机底栏（手机二级页签为 `calc(var(--z-bar) - 1)`） |
| `--z-sheet` | 60 | Sheet 与遮罩、Popover |
| `--z-palette` / `--z-toast` / `--z-proto` | 80 / 90 / 100 | 命令面板 / Toast / 原型控制（仅原型） |

### 2.9 控件 token（D12）

| Token | 值 | 用于 |
|---|---|---|
| `--hit` | 44px | 手机最小可点区域 |
| `--ctl-h-xs` | 28px | 桌面上的筛选胶囊、分段内钮 |
| `--ctl-h-sm` | 30px | `.btn-sm` |
| `--ctl-h` | 38px | 默认按钮、图标按钮、输入框、选择框；手机上胶囊与分段内钮的视觉高度 |
| `--ctl-h-lg` | 46px | `.btn-lg`；手机上的输入框、选择框、难度切换条 |
| `--ctl-radius` | `var(--r-ctl)` | 按钮、输入类控件、图标按钮、难度切换条 |
| `--ctl-pad-x` | 12px | 输入框、选择框、文本域、筛选胶囊、分段内钮左右内边距 |
| `--btn-pad-x` / `-sm` / `-lg` | 14 / 10 / 20px | `.btn` / `.btn-sm` / `.btn-lg` |
| `--tag-h` / `--tag-radius` | 20px / `var(--r-xs)` | `.tag`、`.role`、DanBadge |
| `--plate-h` | 22px | TitlePlate（称号牌有意比标签高 2px） |

### 2.10 浮层 token（D12）

| Token | 值 | 用于 |
|---|---|---|
| `--overlay-radius` | `var(--r-panel)` | 对话框、命令面板、账号菜单、Popover、同步浮层、Toast |
| `--overlay-pad` | 20px | 浮层内边距 |
| `--overlay-pad-sm` | 6px | 菜单类浮层（账号菜单）的外框 |
| `--overlay-shadow` | `var(--shadow-pop)` | 所有浮层的阴影 |
| `--r-sheet` | 22px | 手机抽屉顶角 |

---

## 3. 主题与对比度

### 3.1 主题

- 三档：跟随系统 / 浅色 / 深色（`store.theme`：`system | light | dark`）。`store.js` 把「跟随系统」经 `matchMedia('(prefers-color-scheme: dark)')` 解析后写入 `<html data-theme>`，并监听系统变化。左轨与命令面板中的切换在浅色与深色之间直接切换。
- 谱面带 `--lane` 与舞台面 `--stage-*` 在两种主题下都是深色。

### 3.2 首屏主题（D10）

`index.html` 在任何样式加载前执行一段内联脚本：读 `localStorage['tv-design-v1']` 的 `theme`（`light | dark` 才采用，否则按 `prefers-color-scheme`），写入 `data-theme`；同时写 `lang`（`ja` 或 `zh-CN`）与 `data-motion="reduce"`（如已开启）。紧接一段内联 `<style>` 给 `html` 设 `color-scheme` 与关键底色（浅 `#f3f5f8` = `--ai-50`，深 `#101728` = `--ai-900`），`<meta name="color-scheme" content="light dark">`。这是全站唯一允许写十六进制色的地方，值必须与 `--bg` 一致。

### 3.3 对比度规则（D11）

- 正文与小字（< 24px，或 < 18.66px 的粗体）在它所处的每一种底色上 ≥ 4.5:1，浅色与深色都满足。大字 ≥ 3:1。
- 非文字界面元素（输入框边界、未选中的分段、图标状态、状态点、版块色点）≥ 3:1；输入类控件边框用 `--ctl-border`。
- 禁用态不受此限，但不得承载必要信息。
- 弱状态（没打过、休息日、未通关）用字重与形状区分，不降低不透明度。
- 实色朱填充上的文字一律用 `--don-solid` 底 + `--ink-on-solid`；浅葱 / 山吹音符上的数字用 `--note-outline` 深色字（C13 认可）。

### 3.4 对比度脚本

`node src/styles/contrast-check.mjs [--json]`：解析 `tokens.css`，按浅色 / 深色分别解析 `var()` 链，计算 WCAG 2.x 对比度；任一项不达标退出码为 1。只读、无依赖，不在构建中运行。当前共 236 项（浅深分别计），全部达标；分组为：正文 24、音符色文字 16、状态色文字 14、实色填充 6、难度文字 20、难度填充 10、评价文字 26、王冠文字 4、谱面带文字 8、非文字 6、焦点环 14、状态点 12、舞台文字 32、舞台非文字 8、版块色 36。

脚本只检查 token 对；渐变或图片上的文字、占位符、SVG 坐标轴文字、`text-shadow` 不在其内（`09` §7）。

---

## 4. 字体与文字

### 4.1 字体

`@fontsource` 自托管（`src/main.js` 引入）：Noto Sans SC / JP 可变字重、Barlow、Barlow Condensed。拉丁字母与数字走 Barlow，汉字与假名回退到 Noto。不从任何外部字体服务加载。

### 4.2 语言与字形

- `<html lang>` 跟随界面语言（`zh-CN` / `ja`）。`:lang(ja)` 下 `--font-ui`、`--font-num` 切到 JP 栈并设 `line-break: strict`；日文标题（`h1–h3`、`.t-display`、`.t-h1`、`.t-h2`）加 `font-feature-settings: 'palt'`。
- `[lang='ja']` 元素在中文界面里也用日文字形；`[lang='zh-CN']` 元素用简体字形。
- 另一种语言的曲名一律带正确的 `lang`（`store.subLang`：中文界面为 `ja`，日文界面为 `zh-CN`）；封面字形固定 `lang="ja"`。

### 4.3 排版角色

| 类 | 桌面 | 手机 ≤767 | 字重 / 行高 | 颜色 |
|---|---|---|---|---|
| `.t-display` | `--fs-36` | `--fs-28` | 900 / tight，字距 -0.01em | 继承 |
| `.t-h1` | `--fs-28` | `--fs-22` | 900 / tight | 继承 |
| `.t-h2` | `--fs-18` | 同 | 700 / snug | 继承 |
| `.t-h3` | `--fs-14` | 同 | 700 / snug | 继承 |
| `.t-body` | `--fs-14` | 同 | 400 | 继承 |
| `.t-small` | `--fs-13` | 同 | 400 | `--ink-2` |
| `.t-caption` | `--fs-12` | 同 | 400 | `--ink-3` |
| `.num` | — | — | `--font-num` / 600 / 等宽数字 / 字距 0.01em | 继承 |

辅助类：`.muted`（`--ink-2`）、`.faint`（`--ink-3`）、`.up`（`--ok`）、`.down`（`--danger`）、`.truncate`、`.sr-only`。

### 4.4 标题规则（D14、C6）

| 场景 | 规则 |
|---|---|
| 列表、表格里的标题 | `.title-1l`：单行截断，`title` 属性给出全文 |
| 卡片标题、详情页之外的头部 | `.title-wrap`（最多三行）或 `.title-wrap-2`（最多两行）：`overflow-wrap: anywhere; line-break: strict; text-wrap: balance`，超出再截断 |
| **歌曲详情的主标题**（C6） | **不截断**，按字自然换行；副标题 `.title-wrap-2`（最多两行），截断时 `title` 带全文。C6 取代 V2「标题最多两行」中关于主标题的部分 |
| 数字 | 永不截断；曲名里的数字用正文字体 |
| 行内元素（C1） | 不允许逐字换行：曲名单行截断，说明文字单行截断，分数与差值不换行不截断 |
| 特殊字符 | ＊、～、↑↑、♡、!?、全角括号不改变行高与对齐 |
| 日文扩展 | 标签约为中文的 1.3–1.4 倍：按钮不换行，由容器换行或横滑；左轨标签 11px |

### 4.5 缺失值（D8）

缺失值统一写「—」（U+2014），用 `.na`（`--ink-3`、正文字体、400、不用等宽数字）。适用于星级格（`.star-pip.off` 自动显示「—」）、定数（Diff 的 `showMissing`）、成绩、未游玩的王冠位（`.crown.none` 自动显示「—」）、没有评价（`.rank.none`）。V1 星级点里的「–」已废弃。

### 4.6 数字格式

| 数据 | 格式 | 示例 |
|---|---|---|
| 成绩、计数 | 千分位，不缩写 | 1,004,290 |
| Rating、定数、六维、单曲 RT | 固定两位小数 | 11.97 |
| 精度 | 两位小数 + `%` | 98.76% |
| 变化量 | 带正负号，`.up` / `.down`；颜色只是补充 | +0.31 |
| 星级 | `★` 前缀，不带小数 | ★10 |
| 缺失 | 「—」（`.na`） | — |

---

## 5. 布局框架与断点

### 5.1 断点（D9）

只有三个断点：`767` / `1099` / `1239`。CSS 写 `@media (max-width: 767px)`、`(max-width: 1099px)`、`(max-width: 1239px)`，需要正向时用 `(min-width: 1100px)`、`(min-width: 1240px)`。脚本用 `src/breakpoints.js`：`BP = { mobile: 767, tablet: 1099, desktop: 1239 }`，响应式 ref `isMobile`（≤767）、`isTablet`（768–1099）、`isWide`（≥1240）；`store.viewport.phone` 是另一个 ≤767 的监听。V1 定数表的 1439 断点已删除，改用列优先级（10.6）。评审页 `/review/device` 内部另有一个 900px 断点，不属于产品页面。

| 区间 | 框架 | 内容 | 浮层 |
|---|---|---|---|
| ≤767 手机 | 左轨隐藏；52px 顶栏（标题 / 返回、同步、通知，不放头像）；44px 二级页签条吸顶在顶栏下；62px 底栏五格 + 安全区（歌曲详情、帖子详情、发帖页不显示底栏，见 5.3） | 单列；侧栏并入主栏；数据表改为列表行；`--gutter` 16px | Sheet 变底部抽屉；同步面板在抽屉里；命令面板全屏 |
| 768–1099 平板 | 保留 84px 左轨与 60px 顶栏；搜索框收成 38px 图标按钮；同步状态条只留 38px 图标 | 双栏按规则折叠；表格仍是表格，按列优先级隐藏；筛选改为 chip 行 + 对话框（C4） | 居中对话框 |
| 1100–1239 窄桌面 | 完整顶栏（页签、搜索框、同步状态条、通知、账号） | 侧栏排到主栏下方或收窄；数据表按列优先级隐藏 | 居中对话框；同步浮层锚在状态条下方 |
| ≥1240 宽屏 | 同上 | 主栏 + 侧栏并排；今日首行三栏（Rating ｜ 六维 ｜ 当前目标）；定数表等出现常驻检视栏 | 同上 |

### 5.2 桌面 / 平板框架（`AppShell.vue`）

- **左轨**（`<nav aria-label="主导航">`，宽 `--rail-w`）：标志 38px；六个一级目的地（今日、曲库、成绩、成长、社区、工具），当前项 `aria-current="page"`；底部语言与深浅色切换（图标按钮带 `aria-label`）。账号从顶栏进入。
- **顶栏**（`<header>`，高 `--bar-h`）：详情页有返回按钮（R4，见 10.3）；模块名 `h1`；非详情页内联显示二级页签（`<nav>` 带名称）；搜索框宽 `clamp(200px, 26vw, 360px)`，带 `Ctrl K` 键帽，`aria-keyshortcuts="Control+K"`；同步状态条（SyncButton `chip`）；通知铃（未读数写进 `aria-label`）；账号按钮与菜单。游客没有同步状态条，显示「登录」。
- **主内容** `<main id="main" tabindex="-1">`；页首第一个可聚焦元素是「跳到主要内容」（`.skip`）；一个 `role="status" aria-live="polite"` 区域在路由切换后播报页面名。

### 5.3 手机框架

- **顶栏** 52px（`--bar-h-m`）：左侧返回按钮或 28px 标志（可点区补到 44×44，视觉位置不变）；右侧「同步」「通知」两个 44px 按钮。**顶栏不放头像**（S2），账号入口是底栏「我的」。
- **二级页签条**：吸顶在 52px 处，项最小高 `--subtab-h-m`，横滑、隐藏滚动条。
- **底栏五格**（`<nav aria-label="底部导航">`）：今日 / 曲库 / 「咚」搜索键 / 社区 / 我的；高 `--tab-h` + 安全区。「咚」键 54px 圆形，打开全屏命令面板。
- **哪些页面没有底栏**（F1.1）：`AppShell` 的 `showTabbar = !meta.bareMobile && !meta.dock`。
  - `meta.dock`：自带固定底部操作区的详情页，目前只有歌曲详情 `/songs/:id`（操作条）与帖子详情 `/community/t/:id`（回复框）。
  - `meta.bareMobile`：全屏页，目前只有发布新帖 `/community/new`。
  - 其余页面保留底栏，包括没有固定底部操作区的详情页（个人主页 `/u/:name`、RT 计算器 `/tools/rt` 等）。平板与桌面不受影响。
- **`dock` 页的顶栏**（F1.2）：返回 · 标题 · 搜索 · 同步 · 通知。搜索是图标按钮（`.m-search`），打开与「咚」相同的全屏命令面板；三个图标按钮各 44×44，间距 6px；标题单行，放不下时截断（`.bar-title` 省略号），360 宽下三个按钮完整可点。其他手机页面的顶栏没有搜索按钮。
- 手机顶栏高度与二级页签条的 `top` 都由 `--bar-h-m` 计算。手机上没有账号菜单（`.acct` 为 `only-desktop`），账号入口是底栏「我的」。

### 5.3a 底部空间约定（F1.3）

- **外壳写**：`AppShell` 只在手机宽度、并且值变化时给根元素写 `data-tabbar="on" | "off"`（桌面上不写，卸载时删除）；`base.css` 据此计算 `--shell-bottom`（底栏可见 = `--tab-h` + 安全区，隐藏 = 安全区）。外壳 `.shell` 的下内边距为 `--shell-bottom`。
- **页面写**：页面的固定条用 `src/dock.js` 的 `useDock(elRef)` 把自己的实际高度写进 `--dock-h`（`ResizeObserver` 跟随；值不变不写；新页面接管后旧页面卸载不会清掉；卸载时清理）。`dock` 页的正文下内边距为 `calc(var(--dock-h) + 16px)`，最后一行内容滚到底时完全露出。
- **谁必须读这些变量**：歌曲详情操作条与帖子回复框（`bottom: calc(var(--shell-bottom) - env(safe-area-inset-bottom, 0px))`，内部自己加安全区）；社区悬浮发帖按钮（`calc(var(--shell-bottom) + 16px)`）；Toast（`calc(var(--shell-bottom) + var(--dock-h) + 12px)`，停在固定条上方）；RT 计算器底条（`calc(var(--shell-bottom) + 8px)`）。
- **规则**：页面不得写死底栏高度，也不得直接用 `--tab-h` 定位。底部抽屉（Sheet）只用安全区，不受影响；原型控制把手按屏幕高度定位，与此无关；原型没有「返回顶部」按钮。
- **软键盘**（F1.5）：`useKeyboardInset()` 用 `visualViewport` 计算键盘挡住的高度（差值 > 80px 才算键盘，避开地址栏收放），写进 `--kb-h` 并给根元素加 `data-kb`；卸载时移除监听与属性。

### 5.3b 手机详情页的固定条

- **歌曲详情操作条**（F1.4）：两个等宽按钮（`flex: 1 1 0`），高 `--hit`（44px），上下内边距 12px，下边再加安全区；内容与顺序不变；`--surface` 94% 半透明 + 模糊，顶部 1px `--line`。
- **帖子回复框**（F1.5）：收起时一行 44px（行高 26px + 上下 8px + 边框）；随输入增高，最多 5 行（148px），超出后框内滚动；图片按钮与发送按钮各 44×44。键盘弹出时（根元素有 `data-kb`）回复框 `bottom: var(--kb-h)` 并且不再叠加安全区。**键盘跟随只有代码，没有在真实软键盘下验证**：headless Chrome 不会弹出键盘，`visualViewport` 不变；矮视口代理（390×480、360×420）只证明了布局放得下、阅读位置不跳动（`11` §6）。

### 5.4 页面容器

`.page`：`max-width: var(--content-max)`，居中，内边距 `--sp-6 var(--gutter) --sp-16`（手机 `--sp-4 var(--gutter) --sp-12`）。`.page-head` 底部对齐、两端分布、可换行。`.section` + `.section-head`：标题不换行；标题旁的 `.row-wrap` 控件组单行横滑；「更多」链接 `.more`（`--fs-13`、`--ka-ink`），手机上有透明扩展区补到 `--hit`。`.only-mobile` / `.only-desktop` 在 767 切换。

账号、设置、开发者为单栏 760px，桌面左侧有吸顶的页内目录（`useSectionNav`，见 10.3）；帖子详情为阅读栏。登录、绑定、评审页使用 bare 布局（无框架）。

---

## 6. 基础组件

### 6.1 尺寸总表（D12）

| 控件 | 桌面高 | 手机 ≤767 | 边框 / 圆角 / 左右内边距 |
|---|---|---|---|
| `.btn` | `--ctl-h` 38 | `--hit` 44 | `--ctl-border` / `--ctl-radius` / `--btn-pad-x` |
| `.btn-sm` | `--ctl-h-sm` 30 | `--hit` 44 | 同上 / `--btn-pad-x-sm` |
| `.btn-lg` | `--ctl-h-lg` 46 | 46 | 同上 / `--btn-pad-x-lg` |
| `.icon-btn` | 38×38 | 44×44 | 无边框 / `--ctl-radius` |
| `.input` `.select` | `--ctl-h` 38 | `--ctl-h-lg` 46，字号 16px | `--ctl-border` / `--ctl-radius` / `--ctl-pad-x` |
| `.textarea` | 自适应，内边距 10px `--ctl-pad-x` | 字号 16px | 同上 |
| `.seg button` | `--ctl-h-xs` 28 | 视觉 `--ctl-h` 38 + 透明扩展到 44；最小宽 44、不收缩 | 外框 `--ctl-border`、圆角 `--ctl-radius + 2px`；内钮 `--r-xs` |
| `.chip` | `--ctl-h-xs` 28 | 视觉 38 + 透明扩展到 44（窄胶囊横向也补到 44） | `--ctl-border` / `--r-note` / `--ctl-pad-x` |
| `.tag` | `--tag-h` 20 | 同 | 无边框 / `--tag-radius` |
| `.diff-tab` | `--hit` 44 | `--ctl-h-lg` 46 | 1.5px 难度色混 `--line` / `--ctl-radius` |
| 手机二级页签 | — | `--subtab-h-m` 44 | — |

### 6.2 按钮 `.btn`

| 变体 | 规格 |
|---|---|
| 默认 | `--surface` 底、`--ink` 字、14px / 500、图标间距 6px；悬停 `--surface-2` 底 + `--ink-2` 边；按下 `scale(0.97)` |
| `.btn-primary` | `--don-solid` 填充、`--ink-on-solid` 字、700；悬停 `--don-solid` 88% 混 `--note-outline` |
| `.btn-danger` | **描边**：`--surface` 底、`--danger` 边与字、700；悬停 `--danger-wash` 底 |
| `.btn-ink` | `--ink` 填充、`--bg` 字、700 |
| `.btn-ghost` | 无边框无底、`--ink-2`；悬停 `--bg-sunk` |
| `.btn-block` | 满宽 |
| `[disabled]` | 透明度 0.5、不响应指针；进行中的操作同时改写文案（「正在同步…」） |

一个视图只有一个 `.btn-primary`；删除、解绑等不可撤销操作的确认用 `.btn-danger`，放在 Sheet 底栏右侧。不要给 `RouterLink` 渲染的 `.btn` 依赖 `[disabled]`。按钮文案写明后果。

### 6.3 输入框与字段

`.field`（纵向，间距 6px）；标签 `--fs-13` / 500 / `--ink-2`；占位符 `--ink-3`；悬停边 `--ink-2`；聚焦边 `--focus-ring` + `--focus`（`:focus` 即显示）；`.is-error` 边 `--danger`；`.field-error` / `.field-hint` 12px `--danger` / `--ink-3`。禁用（`:disabled` 或 `aria-disabled="true"`）：`--bg-sunk` 底、`--ink-3` 字、`--line` 边、`not-allowed`。错误时设 `aria-invalid` 并用 `aria-describedby` 指向说明；不要只用红色边框表示错误。表单控件没有触控豁免（C10）：发帖页的标签输入在手机上与其他输入框同高，用 `--ctl-h-lg`（46px）。

### 6.4 分段 `.seg`、页签 `.tabs`、筛选胶囊 `.chip`

- `.seg`：`--bg-sunk` 底、3px 内边距、内钮间距 2px。选中（`aria-pressed="true"` 或 `aria-selected="true"`）为 `--surface` 底、`--ink`、700、`inset 0 0 0 1px var(--ctl-border)` 细框。分段容器是带名称的 `role="group"`，项用 `aria-pressed`。用于 2–4 个互斥视图选项。
- `.tabs`：横排、间距 `--sp-5`、底线 `--line`，横滑；选中（`aria-selected` 或 `.router-link-exact-active`）为 `--ink` / 700 + 3px `--don` 下划线。页内页签是 `tablist / tab`，支持左右键。
- `.chip`：多选筛选；选中 `aria-pressed="true"` 为 `--ink` 填充、`--bg` 字。手机上横滑的胶囊行（`.chips`、`.mchips`、`.dimchips`、`.mfilters`、`.row-wrap`）上下各留 3px（`padding-block: 3px; margin-block: -3px`），避免 `overflow-x: auto` 裁掉扩展区。胶囊内的移除钮在扩展区之上（`z-index: 1`）。
- 选中态的 `box-shadow` 不得盖住焦点环：`.seg button:focus-visible`、`.chip:focus-visible` 显式恢复 `--focus`。

### 6.5 标签 `.tag`、状态点、圆点

- `.tag` 五种色调（D12）：中性 `.tag`；信息 `.tag-info`（= `.tag-ka`，浅葱）；高光 `.tag-roll`（山吹）；成功 `.tag-ok`；危险 `.tag-danger`。另有 `.tag-don`（朱）**只表示「主操作相关 / 置顶」等强调，永不表示失败**；失败、错误一律用 `.tag-danger`。
- `.status-dot`：8px 圆点 + 2px `--surface` 外圈；默认 `--status-attn`（需要你做一步 / 部分成功），`.fail` 为 `--status-fail`，`.ok` 为 `--status-ok`。旁边或所在按钮的可访问名称必须说出状态。
- `.dot`：8px，颜色取 `currentColor`，用于流派、版块；旁边必须有名称。

### 6.6 数据表 `.dt`

| 项 | 规格 |
|---|---|
| 字号 | 正文 `--fs-13`；表头 `--fs-12` / 500 / `--ink-3` |
| 表头 | `position: sticky; top: 0`，`--surface` 底，底线 `--line-strong`；可排序表头是 `<button>`，`th` 设 `aria-sort` |
| 单元格 | 内边距 9px 12px，底线 `--line`；`.r` 右对齐、`.c` 居中 |
| 行 | 悬停 `--surface-2`；`.is-link` 可点 |
| 密度 | `:root[data-density='compact']` 时上下内边距 5px；虚拟列表的定高行表格（`.lib`、`.st`、`.ctable`）在紧凑态不加内边距，行高由各自的 `--row-h` 决定 |
| 横滑 | 外层 `.hs`，右侧还有内容时加 `.hs-more`（`useHScroll` 计算），右缘 40px 渐隐；固定首列 `.dt-sticky-col`（`left: 0`、右侧 1px `--line-strong`） |
| 读屏 | 有 `caption`（可视觉隐藏）与 `scope` |

数值列一律 `.r` + `.num`；王冠、评价、星级列 `.c`；歌曲列用 SongCell。手机上数据表改为列表行（`.only-desktop` 表格 + `.only-mobile` 列表），不横滑整张表。

### 6.7 其他基础类

- `.panel` / `.panel-pad` / `.panel-head` / `.rule`：平面面板与分隔线。
- `.kv`：两列网格，`dt` `--ink-3`，`dd` 右对齐 / 500。
- `.stat`：`.v` Barlow Condensed 700 / 28px；`.k` 12px `--ink-3`；`.d` 变化量配 `.up` / `.down`。
- `.sk` 骨架：`--bg-sunk`、`--r-xs`，`--surface` 70% 光带 1.4s 扫过；减少动效时不扫光。容器设 `aria-busy="true"`。
- `.link`：`--ka-ink` / 500，悬停下划线。
- `.hit`：透明 `::after` 把可点区补到 `max(100%, --hit)`，视觉不变；相邻控件间距 ≥ 6px。
- `.on-lane`：深色谱面带内把 `--focus` 换成 `--focus-lane`。
- `.scroll-x`：横向滚动容器。
- 过渡：`.fade-*`（`--dur-2`）、`.pop-*`（上移 8px + 0.98，进 `--dur-2` `--ease-out`、出 `--dur-1`）、`.sheet-*`（自底部，`--dur-3`）。

---

## 7. 浮层

所有浮层共用 `--overlay-radius`、`--overlay-pad`、`--overlay-shadow`；抽屉顶角 `--r-sheet`。焦点管理用 `src/focusTrap.js`（`focusables`、`trapTab`、`restoreFocus`）。

| 浮层 | 组件 | 桌面 / 平板 | 手机 ≤767 | 关闭与焦点 |
|---|---|---|---|---|
| 对话框 / 抽屉 | `Sheet.vue` | 居中，四周 24px，宽 `min(width, 100%)`（默认 520），最高 `min(86dvh, 820px)` | 贴底满宽，最高 90dvh，顶角 `--r-sheet`，40×4 抓手，底部安全区 | `role="dialog"` `aria-modal`，标题经 `aria-labelledby`；Esc、遮罩、关闭按钮；打开时焦点到第一个输入项（否则关闭按钮），Tab 困在内，关闭还原 |
| 锚定浮层 | `Popover.vue` | 锚在元素旁，`placement` 五种，默认宽 320、间距 8 | 不用于手机（用 Sheet） | Esc、点外面关闭并还原焦点；打开时焦点进第一个可聚焦元素 |
| 同步浮层 | `SyncButton.vue` 内的 `.pop` | 锚在状态条下方，宽 340 | 手机走 Sheet 抽屉 | Esc、点外面；关闭还原到状态条 |
| 命令面板 | `CommandPalette.vue` | 距顶 11vh，宽 `min(720px, 100%)`，最高 76dvh | 全屏 100dvh、无圆角、无动画，输入行吸顶 + 「取消」 | 见 10.2 |
| 账号菜单 | `AppShell.vue` | 内边距 `--overlay-pad-sm`，`role="menu"` | 手机无账号菜单 | ↑ ↓ Home End 移动，Esc 关闭并还原到菜单按钮，点外面关闭 |
| Toast | `Toasts.vue` | 底部居中 28px，`--toast-bg` / `--toast-ink`，左侧音符（`ok` 朱、其他浅葱） | `bottom: calc(var(--shell-bottom) + var(--dock-h) + 12px)`：在底栏或页面固定条上方（F1.3） | 3.2 秒自动消失，不抢焦点、不拦截指针；`role="status" aria-live="polite"` |

规则：同一份内容在桌面是对话框、在手机是抽屉；不要在 Sheet 里再开 Sheet。Toast 只用于已完成操作的确认与轻提示，不承载撤销，不用于错误（错误就地显示）。

桌面同步浮层不用 Popover，而是 `SyncButton.vue` 自带的 `.pop`：它要跟随状态条的运行 / 结果状态与焦点规则。Popover 用于成绩页「导出图片」菜单与规格页的显示选项。

---

## 8. 游戏语义

规则（D2 / D15 / C5 / C13）：难度、王冠、评价、判定、状态的颜色只来自下表的 token、类与组件；页面不得自行配色。**颜色永远不是唯一载体**：每一项都同时有文字或形状。

### 8.1 难度

| d | key | 中文 / 短 | 日文 / 短 | 色块 / 文字 token | 类 / 组件 |
|---|---|---|---|---|---|
| 1 | easy | 简单 / 简 | かんたん / 易 | `--diff-easy` / `--diff-easy-ink` | `.diff.easy`、`.star-pip.easy`、`.diff-tab.easy`、`.dc-easy`；Diff |
| 2 | normal | 普通 / 普 | ふつう / 普 | `--diff-normal` / `-ink` | 同上 `.normal` |
| 3 | hard | 困难 / 难 | むずかしい / 難 | `--diff-hard` / `-ink` | 同上 `.hard` |
| 4 | oni | 魔王 / 鬼 | おに / 鬼 | `--diff-oni` / `-ink` | 同上 `.oni`（默认） |
| 5 | ura | 魔王（里）/ 里 | おに（裏）/ 裏 | `--diff-ura` / `-ink` | 同上 `.ura` |

- `.dc-*` 只设置 `--c` / `--c-ink`，给需要难度色的自定义元素用。
- **C5**：任何宽度下每个难度都带文字；放不下全称时用单字（简 / 普 / 难 / 鬼 / 里；日文用上表短标）。歌曲详情的难度切换条在手机上可横滑，两端渐隐（左 16px、右 24px 的遮罩；V1.2 补上左端，滚到当前难度后不再出现被硬切的半个标签）。实现：手机上未选中项的全称 `.dn` 视觉隐藏（留给读屏，且不撑宽页面），显示单字 `.dshort`；选中项显示全称，并始终横向滚入可视区（只动难度条，不动页面）。

### 8.2 王冠

| v | 类 | 中文 | 日文 | 形状与颜色 |
|---|---|---|---|---|
| `null` | `.crown.none` | 未游玩 | 未プレイ | 显示「—」（`--ink-3`），不画王冠形 |
| `-1` | `.crown.played` | 已游玩 | プレイ済み | 空心圆（1.5px `--ink-3`） |
| `0` | `.crown.clear` | 通关 | クリア | 王冠，`--crown-clear` |
| `1` | `.crown.fc` | 全连 | フルコンボ | 王冠，`--crown-fc` |
| `2` | `.crown.dfc` | 全良 | 全良 | 王冠，`--crown-dfc` |

点灯格同一套编码：`.lamp.none`（`--ctl-border` 虚线框）、`.played`（`--ink-3` 实线细框）、`.clear`、`.fc`、`.dfc`（虹色边）。C7：列表行里的个人状态只用 Crown 组件，尺寸与其他列表一致并带可读名称；没打过就不显示，不出现孤立的小圆点或小王冠。

### 8.3 评价

| v | key | 中文 | 日文 | 字形 | 样式 | 门槛 |
|---|---|---|---|---|---|---|
| 0 / 1 | none | — / 未取得 | — / 未取得 | 「—」 | 无圈 | — |
| 2 | iki1 | 白粹 | 白粋 | 粹 / 粋 | 描边 `--rank-iki1`，字 `-ink` | 500,000 |
| 3 | iki2 | 铜粹 | 銅粋 | 粹 / 粋 | 同上 | 600,000 |
| 4 | iki3 | 银粹 | 銀粋 | 粹 / 粋 | 同上 | 700,000 |
| 5 | miyabi1 | 金雅 | 金雅 | 雅 | 描边 + 14% 填充 | 800,000 |
| 6 | miyabi2 | 粉雅 | 桃雅 | 雅 | 描边 + 14% 填充 | 900,000 |
| 7 | miyabi3 | 紫雅 | 紫雅 | 雅 | 描边 + 14% 填充 | 950,000 |
| 8 | kiwami | 极 | 極 | 极 / 極 | `--rank-kiwami` 实心、`--bg` 字、`--surface` 间隙 + `--rank-kiwami-ring` 外环 | 1,000,000 |

类：`.rank.<key>`（组件）、`.rk.<key>`（只设 `--c` / `--c-ink`）、`.lamp.rk.<key>`（点灯格评价模式）。

### 8.4 判定

| 判定 | token | 类 | 文字 |
|---|---|---|---|
| 良 | `--judge-good` | `.judge .g` | 图例「良 + 数字」 |
| 可 | `--judge-ok` | `.judge .o` | 「可 + 数字」 |
| 不可 | `--judge-ng` | `.judge .n` | 「不可 + 数字」 |

`.judge` 是 8px 横条，必须与 `.judge-legend`（文字 + 16px / 700 数字）一起使用。

### 8.5 状态

| 状态 | token | 类 / 组件 | 文字载体 |
|---|---|---|---|
| 成功 / 上升 | `--ok`、`--ok-wash`、`--status-ok` | `.tag-ok`、`.up`、`.status-dot.ok` | 标签文字；`+` 号 |
| 需要你做一步 / 部分成功 | `--status-attn`、`--roll-wash` | `.status-dot`、`.tag-roll` | SyncButton `aria-label`；状态条文案 |
| 失败 / 错误 / 下降 | `--danger`、`--danger-wash`、`--status-fail` | `.tag-danger`、`.down`、`.status-dot.fail`、`.btn-danger`、`.field-error` | 文案说明原因；`-` 号 |
| 警告 | `--warn` | — | 文案 |
| 强调（非失败） | `--don-ink`、`--don-wash` | `.tag-don` | 「置顶」等 |

---

## 9. 组件

每个组件一节：用途、props、状态、无障碍。props 以组件源码为准。

### 9.1 AppShell

全站框架（第 5 节）。无 props。负责：左轨、顶栏、手机顶栏与底栏、二级页签、跳到主要内容、路由播报、返回按钮（R4）、账号菜单（Esc / ↑ ↓ / 点外面）。

### 9.2 Sheet

对话框 ↔ 底部抽屉（7）。props：`open`、`title`、`width`（520）。slots：`default`、`foot`（底栏：桌面右对齐，手机等分）。事件：`close`。

### 9.3 Popover

锚定浮层（桌面）。props：`open`、`anchor`（元素或选择器）、`placement`（`bottom-end` 默认 / `bottom-start` / `bottom` / `top-end` / `top-start`）、`width`（320）、`offset`（8）、`label`（`role="dialog"` 的名称；作菜单时内容自己声明 `role="menu"`）。事件：`close`。位置随滚动、缩放更新。桌面同步面板不用它（见 7）。

### 9.4 CommandPalette

全局唯一实例，行为见 10.2。无 props（`store.paletteOpen` 控制）。

### 9.5 Toasts

Toast 容器（7）。调用 `toast(text, kind = 'ok')`。

### 9.6 Cover

生成式封面占位：流派色底、按 ID 色相旋转、三种装饰变体、曲名首字（`lang="ja"`）；整块 `aria-hidden`，旁边必须有曲名。props：`song`、`size`。尺寸与圆角阶梯（D3）：

| size | 边长 | 圆角 | 用于 |
|---|---|---|---|
| `sm` | 32px | `--r-xs` | 紧凑表格 |
| `''` | 44px | `--r-ctl` | 列表行 |
| `lg` | 72px | `calc(var(--r-ctl) + 2px)` | 卡片、帖子行关联谱面；手机头条与代表成绩 |
| `tile` | 96px | `calc(var(--r-ctl) + 2px)` | 社区头条、代表成绩（桌面） |
| `xl` | 168px | `--r-panel` | 详情页头 |
| `fill` | 100% | 随容器 | — |

生产环境替换为封面 CDN 图片，尺寸与圆角规则不变。

### 9.7 SongCell

封面 + 主标题（当前语言，`.title-1l` + `title`）+ 副标题（另一语言曲名并带 `lang`，或调用方的 `sub`）。props：`song`、`size`、`sub`；slot `sub` 追加在副行末尾。中日同名时不重复显示副标题。

### 9.8 Diff

难度徽章：难度名 → ★星级 → 定数，顺序固定。props：`d`（1–5）、`star`、`constant`、`short`、`lg`、`showMissing`（无定数时显示「—」占位以便列对齐）。外框 22px（`lg` 28px）、`--r-xs`、1px 难度色边；名段 `--c` 底 + `--ink-on-solid`；星级段 `--c-ink` 字、`--c` 10% 混 `--surface` 底；定数段 `--ink`、`--surface` 底。读屏读出一次「难度全称 星级 N 定数」，简称与 ★ 对读屏隐藏。

### 9.9 Crown · Rank

- Crown：props `v`（`null` / `-1` / `0` / `1` / `2`）、`size`（`''` 20×16 / `sm` 15×12 / `lg` 30×24）、`label`（同时显示文字，此时图形对读屏隐藏）。SVG 遮罩，颜色由背景提供；`role="img"` + `aria-label`。
- Rank：props `v`（0–8）、`lg`（32px，默认 22px）、`label`。读屏同 Crown；没有评价读作「没有评价」。

### 9.10 PlayerAvatar · TitlePlate · DanBadge（身份原子，V6）

- **PlayerAvatar**：鼓面头像。props `user`（`{ name, hue, dan }`）或分别传 `name` / `hue` / `dan`；`size` 24 / 32 / 44 / 72 / 96（默认 32，≥ 72 时鼓缘画一圈鋲）；`label`。鼓面色由 `identity.js` 的 `faceColor(hue)` 取到白字 ≥ 4.6:1；鼓缘按段位档次：低（级位、初–五段）`--ctl-border`、中（六–九段）`--ka`、高（十段及以上 / 玄人 / 名人 / 超人 / 达人）`--roll`。默认对读屏隐藏（旁边总有昵称），传 `label` 时为 `role="img"`。
- **TitlePlate**：称号牌。props `text`、`rare`（山吹牌面：`--roll` 边、`--roll-wash` 底、`--roll-ink` 字）。高 `--plate-h`，3px 双线框，两端各一颗鋲；不换行，过长截断并以 `title` 给出全文。
- **DanBadge**：段位徽章。props `dan`（空或「—」时不渲染）。高 `--tag-h`、`--tag-radius`、1px 内描边；档次颜色与 PlayerAvatar 鼓缘一致（中档 `--ka-wash` / `--ka-ink`，高档 `--roll-wash` / `--roll-ink`）。档次判断统一用 `identity.js` 的 `danTier()`，页面不要自己判断。

三者在帖子、楼层、榜单、通知、个人主页、今日、我的统一使用；V1 的 `.avatar` 已删除。

### 9.11 ThreadRow

帖子行：作者（PlayerAvatar 32px + 昵称 + DanBadge）→ 标题 → 摘要；版块色只出现在一个圆点上；关联歌曲在右侧。props：`thread`、`compact`（作者缩到底部一行、24px 头像、不显示摘要与关联谱面）、`preview`（渲染为不可交互的 `div`，版式相同，发帖页右侧预览用）。读屏：链接名称 = 标题，作者、版块、时间、回复数作为描述。行内的作者名、版块名是行内链接，触控规则见 11.4。

### 9.12 FactRow

一条成长事实：类型音符 + 封面 + 曲名与「Diff + 类型名」+ 右侧「之前 → 之后」，整行链接到歌曲该难度。props：`fact`（`{ type, songId, d, before, after, rankFrom?, rankTo? }`）、`dense`。链接的读屏名称是一句完整的话。事实类型（`mock/catalog.js` 的 `FACT`）：

| type | 中文 | 日文 | 音符 | 权重 |
|---|---|---|---|---|
| `df` | 新全良 | 全良達成 | `.big.dfc` | 6 |
| `fc` | 新全连 | フルコンボ | `.big.fc` | 5 |
| `goal-completed` | 练成了目标 | 目標達成 | `.big.roll` | 4.5 |
| `rank-upgrade` | 评价升级 | 評価アップ | `.ka` | 4 |
| `score-pb` | 刷新最好成绩 | 自己ベスト | 默认（朱） | 3 |
| `clear-upgrade` | 首次通关 | 初クリア | 默认（朱） | 3 |
| `ng-reduced` | 不可变少了 | 不可が減った | `.ka` | 2 |
| `combo-improved` | 连击更长了 | コンボ更新 | `.ka` | 2 |
| `played` | 打了一次 | プレイ | `.ghost` | 1 |

权重决定 Lane 上每天显示哪个事实的音符（取最高者）。

### 9.13 GoalCard

「这次想练」：当前目标。props：`goal`（`{ songId, d, type, dim, attempts: [{ ng, ago }], baseline, latest }`）。尝试轨迹是有序列表，每项一句读屏文字（「第 N 次尝试，X 天前，不可 N」），终点是判定圈；操作「查看谱面」+「练后同步」（调用同一个同步状态机，S5）。

### 9.14 Gate

权限引导：留在原地、说明差哪一步、给出那一步的按钮。props：`what`。按 `store.auth`：`guest`「登录后查看<what>」、`unbound`「先绑定鼓众广场 ID」、`empty`「还没有成绩」。内部用 EmptyLane；最大宽 640px。

### 9.15 EmptyLane

空 / 错误 / 加载的统一形态：一条空谱面 + 判定圈。props：`title`、`text`、`tone`（`empty` | `error` | `loading`）、`compact`；默认插槽放操作。`error` 判定圈变为 `--judge-ng`；`loading` 三个音符飞向判定圈，减少动效时改为静止的三个音符 + 文字。

### 9.16 SyncButton

同步入口。props：`variant`（`icon` 手机顶栏 44px 按钮 / `chip` 平板与桌面状态条）、`force`（`{ kind, phase?, still? }`，只渲染手机按钮的某个状态，不读不写同步状态、不可交互；`kind`：`idle | need | running | fresh | partial | failed`；`still` 显示减少动效形态）。角标用 `.status-dot`：`need` / `partial` 为 `--status-attn`，`failed` 为 `.fail`。`aria-label` 读出当前状态（`store.syncStatus.label`）。平板（≤1099）状态条收成 38px 图标。状态与文案见 10.1。

### 9.17 SyncPanel

同步面板，手机放进底部抽屉，桌面是状态条下方的浮层；内容只随「登录态 × 同步状态」变化。props：`heading`、`headingId`（`sync-panel-title`）、`resultOnly`（只渲染结果区，给 `/account/sync` 复用）、`force`（`{ auth?, state?, phase?, result? }`，按给定情形渲染，不读不写全局状态，按钮只渲染不执行；给 `/review/system` 与 `/states` 用）。

### 9.18 VirtualList

跟随窗口滚动的定高行虚拟列表（M6：长列表挂载行数 ≤ 60）。props：`items`、`rowHeight`（必须与实际行高一致）、`overscan`（8）、`tag` / `rowTag`（表格模式用 `tbody` / `tr`）、`keyField`、`colspan`（99）、`rowClass`（字符串或函数，行状态挂在行元素上，不在单元格里各自判断）、`rowAttrs`（函数，绑定到行元素，不覆盖 `aria-rowindex`）。slot `{ item, index }`；expose `scrollToIndex(i, align)`。总高度恒等于 `items.length × rowHeight`，首帧即可还原滚动位置（R3）。曲库、成绩、定数表使用。

### 9.19 Lane

全站签名组件（1.2）。props：`days`（`[{ daysAgo, date, played, facts }]`）、`v-model`（选中的 `daysAgo`）、`compact`、`label`（默认「最近的练习谱面」）、`to`（只作概览：整条带渲染为一个链接，每天不可点，读屏名称概括「N 天里打了 M 天」）。可点形态：`role="group"`，每天一个按钮（`aria-pressed`、`aria-label`「日期 + N 条进展 / 有游玩 / 没有游玩」），漫游 tabindex——整条带只占一个 Tab 位，← → 在日期间移动，Home / End 到首尾，Enter / 空格选中；带内焦点用 `--focus-lane`。

编码（全尺寸，按 `--ns` 等比缩小）：没有游玩为 `--lane-line` 小刻度；有游玩无进展 14px `--lane-ghost`；刷新成绩类 20px `--lane-don`；稳定性类 20px `--lane-ka`；新全连 30px + `--lane-fc` 内环；新全良 36px（朱面 + 白环 + `--crown-dfc` 外环）；练成目标 30px `--lane-roll`；连续游玩用 `--lane-roll` 连打条连接；今天为判定圈；周一列左侧小节线；当天多条进展时音符上方显示条数；日期 `--lane-ink-2`，星期与弱文字 `--lane-ink-3`。

**C2 尺寸规范**（列宽 `--col-w` 由容器宽度与天数算出，音符缩放 `--ns`）：

- 音符直径不超过「列宽 − 8px」，三档大小按列宽等比缩小（选中时的 1.14 倍放大也计算在内）；
- 每天可点时列宽 ≥ 44px，放不下就横向滚动，默认停在今天，左缘渐隐提示还有内容，不允许半个标签被硬切；
- 只作概览、每天不可点时（手机「我的」）列宽 ≥ 36px，显示最近 7 天，整条谱面带是一个去「成长」的链接；
- 列宽 < 40px 时日期只写「日」，月初与今天写全。

### 9.20 ChartSheet

谱面图占位（生产环境为服务端 PNG `/api/content/songs/:id/chart-image`）。props：`seed`、`rows`、`density`、`start`、`label`（默认「谱面图，第 a–b 小节」，随语言切换）、`highlight`（小节号：山吹描边与底色，读屏名称注明）。`role="img"`；`--lane` 底，`--lane-measure` 小节线，音符 `--lane-don` / `--lane-ka` + `--note-ring` / `--note-outline`，连打 `--lane-roll`；密度 > 0.72 的小节加淡朱底（与 DensityStrip 同阈值）。咚 / 咔音符只靠颜色区分，与游戏本身一致（唯一例外）。

**C3 每行小节数**：按容器宽度取（容器查询，不按视口），每小节 ≥ 150px，可选 4 / 2 / 1，随容器变化即时重排。`rows` 表示数据量（每行 4 小节的数据），重排不改变小节总数。

### 9.21 DensityStrip · Spark

- DensityStrip：props `values`（每小节 0–1）、`height`（56）、`label`（默认按语言给出小节数与高密度小节数）。`--ink-3` 柱，> 0.72 的小节用 `--don` 标出难点。`role="img"`。
- Spark：props `values`、`w`（96）、`h`（28）、`tone`（`--ink-2`）。无坐标轴，`aria-hidden`，只作为旁边数字的补充。

### 9.22 LineChart

趋势折线。props：`points`（`[{ label, v }]`）、`height`（220）、`marks`（`[{ index, text }]`）、`digits`（2）、`tone`（`var(--don)`）、`label`（不传时按语言概括「从 a 到 b」）。宽度随容器（最小 240px）；单一序列不画图例；Y 轴 ≤ 4 条参考线；悬停 / 触摸出现读数线。`role="img"`。多行共享时间轴用 TimeStack。

### 9.23 TimeStack

成长档案的时间栈（V3）：指标折线、关注方向带、里程碑音符、每日练习密度条上下对齐，共用一条横轴和一个读数光标；开放图表，无面板框，≤ 4 条参考线，横轴标签只在底部出现一次。props：`points`、`marks`（`type`：`df` / `fc` / `rating` / `dan` / `goal`）、`bands`（`current` = 进行中）、`days`、`digits`（2）、`tone`（`var(--don)`）、`label`（默认「成长时间栈」）、`height`（180）。键盘：聚焦后 ← → 移动光标，Home / End 到首尾，Esc 收起读数；读数经 `aria-live` 播报；另有视觉隐藏的里程碑表。宽 < 480px 时方向带标签截断、里程碑标签隐藏（仍在读数中显示）。

### 9.24 Radar · DrumDial

- Radar：props `axes`（`[{ label, value, prev?, key }]`）、`focus`、`size`（260）、`domain`、`tone`（`var(--don)`）、`label`（读屏名称前缀，数值自动接在后面）。未传 `domain` 时自动收窄量程（下限 `floor(min − 0.6)`、上限 `ceil(max + 0.1)`）并印在图上。玩家六维用自动量程带 `prev`；谱面五维固定 `[0, 15.5]`。
- DrumDial：props `value`、`max`（15.5）、`step`（0.5）、`size`（168）、`tone`（`don`）。鼓缘一圈鋲，每颗 = `step`（15.5 → 31 颗），从 7 点半方向顺时针 270°。SVG `aria-hidden`，数值在插槽文字里。

### 9.25 Icon · Logo · ProtoPanel

- Icon：自绘线性图标，24 网格、1.75 描边、圆头圆角；props `name`、`size`（20）；`aria-hidden`，图标按钮必须有 `aria-label`。
- Logo：一面鼓的俯视图；props `size`（36）。
- **Favicon**（F4.2）：`public/favicon.svg`，由 `index.html` 以 `<link rel="icon" type="image/svg+xml" href="./favicon.svg">` 引用。图形与 Logo 相同（朱色鼓面 + 浅葱鼓缘 + 一圈鋲），用 SVG 内的 `@media (prefers-color-scheme: dark)` 切换深色那套颜色。它是独立资源，**允许直接写色值**（D1 的例外），色值取自 Primitive：浅色鼓缘 `#1fa5ba`、鼓面 `#e8482e`；深色鼓缘 `#4cc6d8`、鼓面 `#ff6a4d`。深色那套没有在浏览器标签页上看过（`11` §9）。
- ProtoPanel：原型控制面板，只存在于原型里，`#/review*` 与 iframe 内不显示。开关见 `README.md`。手机上收起为左缘小把手；C9：把手可见宽度 ≤ 12px（高 `--hit`），留在 16px 页边距内，点击区只向屏幕外扩展、不向内容方向扩展。已知：平板与桌面的帖子页上，原型面板按钮会压住回复框的「回复」按钮；它不属于产品，没有修改（`11` §10）。

---

## 10. 模式

### 10.1 同步（S1–S5）

- **一个状态机**（`src/sync.js`）：`idle → running（phase 0 读取鼓众广场 → 1 写入 Viewer → 2 推送到同步目标）→ success | partial | failed`。每阶段 800ms（`PHASE_MS`），成功后对勾 2.5 秒（`FRESH_MS`）。计时器在模块级，路由切换不打断；`reset()` 后旧计时器不再写状态。下一次结果由原型控制面板「下一次同步结果」指定。
- **入口**：手机顶栏 SyncButton `icon`；平板 / 桌面顶栏 SyncButton `chip`；目标卡「练后同步」与其他旧入口调用 `store.runSync()`（同一状态机，手机上同时打开面板）；`/account/sync` 主按钮与结果区用同一状态机与 `SyncPanel resultOnly`。「我的」页没有同步按钮，只有一行只读的上次同步信息。
- **手机按钮角标**：

| 状态 | 图标 | 角标 | `aria-label` 例 |
|---|---|---|---|
| 已同步、空闲 | 同步图标 | 无 | 同步：2 小时前同步 |
| 游客 / 未绑定 / 从未同步 | 同步图标 | `--status-attn` | 同步：还没有绑定鼓众广场 ID |
| 同步中 | 旋转（减少动效时静止 + 进度点） | 无 | 同步：正在同步，第 2 步，共 3 步 |
| 刚刚成功 | 对勾约 2.5 秒 | 无 | 同步：刚刚同步，4 条新进展 |
| 部分成功 | 同步图标 | `--status-attn` | 同步：部分同步，1 个同步目标没有成功 |
| 失败 | 同步图标 | `--status-fail` | 同步：上次同步失败 |

- **桌面状态条文案**：`2 小时前同步` / `正在同步… 2/3` / `刚刚同步 · 4 条新进展` / `部分同步`（山吹底）/ `同步失败`（危险色描边）。空闲时点击直接开始；部分成功或失败时点击打开浮层看原因。未绑定、无成绩时文案是下一步动作；游客不显示状态条。
- **面板内容**：游客（说明 + 登录 / 注册）、未绑定（三步清单，第二步为当前 + 去绑定）、已绑定无成绩（账号 + 「第一次同步大约需要 10 秒」+ 开始同步）、空闲（上次时间、结果摘要、各同步目标 + 立即同步、同步设置）、同步中（三阶段高亮，按钮禁用，可关闭面板）、成功、部分成功（失败目标与原因 + 重试失败的目标）、失败（「已有的数据没有变化」+ 重试）。
- **Toast**：只在成功且面板未打开时出现。

### 10.2 命令面板（P1–P10）

- **唤起**：顶栏搜索框、`Ctrl K` / `⌘K`（再按关闭）、非输入状态按 `/`、手机「咚」键。
- **匹配**（`src/search.js`，命令面板、曲库、工具页共用）：NFKC、忽略大小写与空格标点、片假名与平假名互通、全角半角互通；多词全部命中。**拉丁字母 / 数字组成的查询词只在词首命中**（LiSA 不命中 Nivalis*Anima 的中间），可跨相邻词连写；含汉字 / 假名的词按子串命中。排序：标题完全相同 > 标题前缀 > 别名 > 标题包含 > 艺术家。
- **结果**：歌曲最多 8 首，命中别名或另一语言时副行注明；右侧魔王与里各显示 Diff 与我的成绩（没有时「—」；手机只显示短名 + 星级与王冠 + 评价）；回车进默认难度（查询含「里 / 裏 / ura」进里谱），难度徽章可直接点。末行「在曲库中查看全部 N 首」带关键词与 `shelf=all` 进入曲库，N 与曲库行数一致（同一个 `matchSongIds`）；**C8**：总数 ≤ 已显示条数时不显示该行。配置串（如 `16 oxxo 180 鬼10`）先显示解析结果再列最多 5 张谱；2–4 位纯数字按物量列最接近的 5 张；帖子最多 4 条；快捷操作与页面按名称可搜。示例查询（`EXAMPLES`）：千本桜、qby、16 oxxo 180 鬼10、765。
- **键盘与读屏**：输入框 `role="combobox"`，结果 `role="listbox"`（按组分 group）/ `option`，`aria-activedescendant` 指示当前项；↑ ↓ 循环、Home / End、Enter 执行、Esc 关闭；当前项滚入可视区；鼠标移动才改变当前项。结果数经 `aria-live` 播报。打开时焦点进输入框，关闭回到触发元素，导航后焦点到新页面主内容。
- **手机**：全屏；输入行吸顶 + 「取消」；`visualViewport` 让结果区避开软键盘；滚动结果时收起键盘；首次点按即生效；空状态给出可点的示例查询。
- **最近看过**：最近 5 首（本地存储），可清除。
- **性能（F3）**：首键（每次打开面板后的第一次按键）与热态（其后的按键）分开测。预算：**首键 p95 ≤ 100ms，热态 p95 ≤ 50ms**；只有多数轮次（≥ 5 轮中过半）超预算时才继续优化（F3.4）。V1.1 C12 加的结果行预挂载已删除（F3.3），「首批结果压到一屏以内」也已撤回。实测（`11` §5.2，6 轮，1440×900 生产构建）：full 首键 p95 16.3–23.7ms、热态 p95 13.9–19.3ms；demo 首键 12.3–18.6ms、热态 8.3–10.5ms；全部满足。
- **搜索索引**：`store.ensureSearch()` 在第一次需要时才建立索引（命令面板、工具页；曲库与社区只在第一次有关键词时调用），不压在进入页面的那一刻。

### 10.3 路由状态（R1–R6）

- **`useQueryState(schema)`**（`src/routeState.js`）：字段类型 `string | number | boolean | set`，`default`（等于默认值时不写进地址）、`param`、`debounce`（关键词 250）、`values`（合法取值）。从地址初始化；改字段 → `router.replace`，只改自己的参数、保留其余；后退 / 前进时字段跟着地址变；离开当前路径后不再写地址；卸载时清理计时器与监听。曲库、成绩、定数表、社区、点灯进度、Rating、成长、推荐、段位、攻略等页面的筛选与切换都用它。
- **R1**：歌曲详情切换难度只替换 `d`，保留 `from`、`q`、`m` 等。
- **R3**：后退 / 前进恢复滚动；只改查询参数不滚动；新导航回到顶部；长列表用 VirtualList。
- **R4**：详情页返回按钮有站内历史时 `router.back()`，否则回模块首页。
- **R5**：换一首歌是全新状态并回到顶部；同一首歌换难度就地更新。
- **R6**：所有定时器、观察器、监听器在卸载时清理（`useQueryState`、`useHScroll`、`useSectionNav`、LineChart / TimeStack 的 `ResizeObserver` 等）。
- **页内目录** `useSectionNav(ids)`（`src/sectionNav.js`）：返回 `{ current, scrollTo, refresh }`；`scrollTo` 按 `scrollBehavior()` 滚动并把焦点交给节标题。账号、设置、开发者共用。

### 10.4 缺失值

见 4.5：一律「—」+ `.na`，组件内置（Crown、Rank、`.star-pip.off`、Diff `showMissing`）。

### 10.5 空、加载、错误、权限

| 形态 | 何时 | 文案要求 |
|---|---|---|
| 骨架屏 `.sk` | 首次进入、结构已知 | 无文字；形状与真实内容一致 |
| EmptyLane `loading` | 等待一个操作 | 说明在做什么 |
| EmptyLane `empty` | 没有数据、搜索无结果 | 陈述事实 + 下一步 + 一个操作 |
| EmptyLane `error` | 加载失败、同步失败、离线、找不到 | 说明已有数据不受影响，给出重试 |
| Gate | 需要登录 / 绑定 / 同步 | 留在原地，给出唯一下一步（9.14） |
| 404 | 地址无对应页面 | 打开搜索、回到今日 |

`/states` 页集中展示这些形态（含 SyncPanel `force` 样张）。

### 10.6 表格

- **列优先级**（V11）：始终显示「曲目（固定首列）、难度 / 星级、定数、我的（魔王与里）」；空间不够时依次隐藏上架日期 → 流派 → 次要能力值。横向仍放不下时首列固定、表格在面板内横滑，右缘渐隐（6.6）。
- **密度**：设置页与原型面板的「列表密度」写 `store.density`（`comfortable | compact`），根元素 `data-density` 随之变化，对所有表格生效；虚拟列表的定高行随密度切换（`/songs` 56 / 44、`/play/scores` 48 / 40、`/songs/constants` 52 / 42，单位 px）。
- 平板（V12）表格保留为表格，不变列表行。

### 10.7 筛选

- **≥1100**：曲库左侧分面（吸顶）。
- **≤1099**（C4，平板沿用手机做法）：一行常用筛选 chip + 「筛选」按钮，完整分面放进 Sheet（平板居中对话框，手机底部抽屉），底栏「查看 N 首」；筛选数徽章用 `--don-solid` 底。表格仍是表格（V12）。
- 所有筛选与地址同步（10.3）。

---

## 11. 无障碍

### 11.1 地标、标题与播报

- 每页一个 `header`、带名称的 `nav`（主导航、底部导航、页签）、`main#main`。
- 页首「跳到主要内容」；**C11**：登录与绑定页没有导航可跳过，不加跳转链接，保留唯一的 `main` 与正确的标题层级。评审页（bare 布局）同样没有。
- 路由切换后焦点到 `main`，`aria-live` 播报页面名。

### 11.2 键盘与 ARIA

| 模式 | 用于 | 要点 |
|---|---|---|
| `combobox` + `listbox` / `option` + `aria-activedescendant` | 命令面板 | 10.2 |
| `menu` / `menuitem` | 账号菜单 | ↑ ↓ Home End；Esc 关闭并还原焦点 |
| `dialog` + `aria-modal` | Sheet、命令面板、Popover | 焦点进入、Tab 困住、关闭还原（`focusTrap.js`） |
| `tablist` / `tab` + `aria-selected` | 页签、难度切换条 | 左右键切换 |
| `group` + `aria-pressed` | 分段、筛选胶囊、Lane 列、投票 | 分段容器带名称 |
| `aria-sort` | 可排序表头 | 表头是按钮 |
| `aria-invalid` + `aria-describedby` + `role="alert"` | 表单 | 6.3 |
| `role="img"` + `aria-label` | Crown、Rank、Radar、LineChart、DensityStrip、ChartSheet | 名称随语言切换 |
| `role="status"` / `aria-live="polite"` | Toast、路由播报、命令面板结果数、TimeStack 读数 | — |
| 有序列表 + 读屏文字 | GoalCard 尝试轨迹 | — |

所有只有图标的按钮有 `aria-label`（同步按钮读出当前状态）；表单控件有可见标签或 `aria-label`；表格有 `caption` 与 `scope`；图表旁有同一份数据的数字。

### 11.3 焦点环

`--focus` = 2px `--focus-gap` 间隙 + 2px `--focus-ring` 实色环，只在 `:focus-visible` 出现（输入框在 `:focus` 即出现并把边换成 `--focus-ring`）。在 `--bg`、`--bg-sunk`、`--surface`、`--surface-2`、主按钮上都可见；深色谱面带内用 `.on-lane` → `--focus-lane`（内描边）；舞台面内由 `.stage` 重写。选中态的 `box-shadow` 不得盖住焦点环。

### 11.4 触控（D7、C10、F2）

- 手机上 `.btn`、`.btn-sm`、`.icon-btn`、底栏项、列表行、二级页签、分段、胶囊、页码钮的可点区域 ≥ 44×44。
- **透明扩展区**是代码里统一的做法：视觉尺寸不变，用透明 `::after` 把可点区补到 `--hit`（`.hit` 工具类；手机上的 `.chip::after`、`.seg button::after`、区块「更多」链接、句子里的独立链接）。筛选胶囊与分段内钮视觉 38px，扩展到 44px；相邻控件间距 ≥ 6px，避免扩展区重叠；横滑行留出上下 3px，扩展区不被裁掉。
- **唯一的豁免（F2，C10 正式生效）**：行内文字链接（列表行里的作者名、版块名）可以低于 44px，条件是三条**同时**满足：
  1. 点击高度 ≥ 24px（实现：手机上上下各 4px 内边距与等量负外边距，版面不动）；
  2. 所在整行是 ≥ 44px 的主目标；
  3. 与相邻的独立交互目标间隔 ≥ 8px，或互不相邻。
- **不在豁免内**：按钮、图标按钮、表单控件、页签、分段、胶囊、列表行、底栏项，以及**句子里的独立文字链接**（不在列表行里，手机上用透明扩展区补到 44×44）。表单控件：发帖页的标签输入在手机上用 `--ctl-h-lg`（46px）。谱面带按 C2（9.19）：可点的每日列 ≥ 44px，只作概览的谱面带整条是一个链接。
- 验收脚本对产品页的不足 44×44 记为错误，对行内链接检查上面三条（`11` §3：最终 0 / 0）。

### 11.5 减少动效（D13）

- 触发：系统 `prefers-reduced-motion: reduce`，或原型开关（根元素 `data-motion="reduce"`）；两者在 `base.css` 中效果相同。脚本用 `src/motion.js` 的 `prefersReducedMotion`（只读 ref）与 `scrollBehavior()`（`auto` | `smooth`）；`store.reducedMotion` 是同义的 computed。
- 效果：动画与过渡时长 0.001ms、循环 1 次；没有无限循环动画（EmptyLane 加载为静止的三个音符，骨架屏不扫光，同步图标不旋转而显示进度点）；`.btn` / `.hit-scale` 按下不缩放，点灯格悬停不上移；滚动定位不用平滑滚动。

---

## 12. 动效

- 动效只回应操作或状态变化；**路由切换不做转场**。
- 击打回弹 `--ease-hit` 只用于按下圆形击打物（咚键、播放键、音符）与达成反馈，不用于页面、面板、列表等容器。
- 已有过渡：`fade`（遮罩）、`pop`（账号菜单、Toast）、`sheet`（抽屉升起）、命令面板下落（手机无动画）、`.btn` 按下缩放 0.97。循环动画只有骨架屏光带、EmptyLane 飞行音符、同步图标旋转，减少动效时全部停止。
- 信息不能只靠动效传达。

---

## 13. 模块的视觉表现（V 组裁决摘要）

| 模块 | 版面 | 文字与密度 | 颜色角色 | 谱面元素 |
|---|---|---|---|---|
| 曲库、成绩 | 表格、分面、吸顶表头、固定首列 | 13–14px，紧凑行 | 中性为主；朱只给主定数与 Rating | 只作数据编码（星级格、王冠、密度条） |
| 成长、目标 | 共享一条时间轴；开放图表；纵向留白宽 | 16px 正文；叙述句作标题 | 浅葱 = 过程，山吹 = 里程碑，朱 = 达成 | 谱面带、用音符标里程碑 |
| 社区、个人主页 | 阅读栏、头条、更大的封面与头像 | 标题 16–22px，行高宽 | 版块色点；称号牌用山吹 | 不用谱面带；用鼓面头像 |
| 账号、绑定 | 单栏 760px、分段标题、状态行、步骤器 | 14–16px；按钮文案写明后果 | 中性 + 状态色 | 只有步骤器里的音符 |

页面要点：V1 今日（身份一行；主句是上次同步带来的变化；宽屏首行三栏；1280×800 首屏见谱面带）· V2 歌曲详情（封面桌面 112 / 手机 72；1440×900 首屏见谱面图上沿与完整「我的成绩」；三种缺失状态；`m=` 定位并高亮小节；主标题规则见 4.4 / C6）· V3 成长时间栈 · V4 目标路径与按月历史 · V5 这一周 12 周可翻 · V6 社区头条与身份原子 · V7 帖子每页 20 楼、只看楼主、跳楼层、楼中楼 > 3 折叠 · V8 个人主页舞台身份带 · V9 「我的」≤ 两屏半、无同步按钮，概览里是最近 7 天的迷你谱面带（Lane `to="/growth"`，整条是去成长的链接，按 C2） · V11 补充：Rating 表在 ≤1099 先隐藏准确率与 RT 条 · V10 账号设置开发者单栏 + 页内目录、危险操作在底部 · V11 列优先级与密度 · V12 平板保留左轨与表格。详细规格见 `07` 与 `05-page-specs.md`。

**个人主页（F5，V1.2）**
- **代表成绩（桌面，F5.1）**：三张卡片在一个三列网格里等高（网格行拉伸）；卡片内容区 `flex: 1`，「更换」按钮贴卡片底部对齐；曲名用 `.title-wrap-2`（最多两行）并以 `title` 给出全文。手机上改为单列。
- **公开范围（手机，F5.2）**：说明文字在上，分段控件在下通栏（`.privacy` 换行，`.seg` 占满一行、三个按钮等分）。
- **数字区（手机，F5.2）**：Rating 在第一行通栏（`order: -1`、`grid-column: 1 / -1`），下面是 2×2 的全良 / 全连 / 通关 / 极，不留孤立的半行。

设计负责人看过的其余页面（首页、曲库、歌曲详情、成绩、成长、社区）不再调整（`10` F5）。

---

## 14. 与现有实现的映射

现有实现指 `taiko_viewer/assets/css/tokens.css` 与 `main.css`。

| 现有 | Design V1.2 |
|---|---|
| `--viewer-bg` `#eaf6f5`（青绿调） | `--bg`（藍色阶） |
| `--viewer-surface` / `-subtle` / `-hover` | `--surface` / `--bg-sunk` / `--surface-2` |
| `--viewer-text` / `-muted` / `-disabled` | `--ink` / `--ink-2` / `--ink-3` |
| `--viewer-border` / `--viewer-control-border` | `--line` / `--ctl-border` |
| `--viewer-primary` `#bd352f` / `--viewer-on-primary` | `--don-solid` / `--ink-on-solid`；图形用 `--don`，文字用 `--don-ink` |
| `--viewer-link` `#006c76` | `--ka-ink` |
| `--viewer-success` / `-warning` / `-error` / `-info` 及 `-surface` | `--ok` / `--warn` / `--danger` / `--ka` 及 `--ok-wash` / `--roll-wash` / `--danger-wash` / `--ka-wash` |
| `--viewer-overlay` / `--viewer-shadow` | `--scrim` / `--overlay-shadow`（只用于浮层）、`--shadow-lift` |
| `--viewer-difficulty-easy / normal / hard / oni / edit` | `--diff-easy / normal / hard / oni / ura`（色相整体改变，`edit` 对应 `ura`）；文字用 `--diff-*-ink` |
| `--viewer-radius` 14px 单一圆角 | `--r-xs` 6 / `--r-ctl` 8 / `--r-panel` 14 / `--r-sheet` 22 / `--r-note` 999；封面按 9.6 阶梯 |
| 断点 960px 与大量零散 `max-width` | 767 / 1099 / 1239；数据表按列优先级隐藏列 |
| 248px 侧边栏 + 手机抽屉菜单 | 84px 左轨 + 顶栏页签；手机五格底栏 |
| 系统字体栈，正文 15px | 自托管 Noto Sans SC / JP + Barlow / Barlow Condensed，正文 14px |
| `:focus-visible` 3px outline | `box-shadow: var(--focus)` |
| 王冠、评价为文字 | Crown / Rank / `.lamp` |
| 「没打过」用降低不透明度 | 「—」（`.na`）、空心圆、虚线框 |
| 失败提示借用朱色标签 | `.tag-danger` / `--danger`；`.tag-don` 只表示强调 |
| 首字母圆片头像 | PlayerAvatar + TitlePlate + DanBadge |
| 未登录时硬跳登录页或内联提示不一 | Gate；同步入口 SyncPanel |
| ECharts（后台）、手写 SVG、服务端 PNG 三套图表 | 前台统一为 SVG 图表组件，成长页用 TimeStack；管理后台不在范围内 |

### Element Plus 变量映射（提案，未实施）

只是迁移提案，尚未在任何工程中实施。深色主题不需要另写一份，Semantic token 本身随 `data-theme` 切换。

```css
/* 提案：Element Plus 变量从 Design V1.2 Semantic 层映射（未实施） */
html:root {
  --el-color-primary: var(--don-solid);
  --el-color-white: var(--ink-on-solid);
  --el-color-success: var(--ok);
  --el-color-success-light-9: var(--ok-wash);
  --el-color-warning: var(--warn);
  --el-color-warning-light-9: var(--roll-wash);
  --el-color-danger: var(--danger);
  --el-color-danger-light-9: var(--danger-wash);
  --el-color-error: var(--danger);
  --el-color-info: var(--ka-ink);
  --el-color-info-light-9: var(--ka-wash);
  --el-bg-color: var(--surface);
  --el-bg-color-page: var(--bg);
  --el-bg-color-overlay: var(--surface);
  --el-fill-color: var(--bg-sunk);
  --el-fill-color-light: var(--surface-2);
  --el-text-color-primary: var(--ink);
  --el-text-color-regular: var(--ink);
  --el-text-color-secondary: var(--ink-2);
  --el-text-color-placeholder: var(--ink-3);
  --el-border-color: var(--line-strong);
  --el-border-color-light: var(--line);
  --el-input-border-color: var(--ctl-border);
  --el-border-radius-small: var(--r-xs);
  --el-border-radius-base: var(--ctl-radius);
  --el-border-radius-round: var(--r-note);
  --el-component-size-small: var(--ctl-h-sm);
  --el-component-size: var(--ctl-h);
  --el-component-size-large: var(--ctl-h-lg);
  --el-dialog-border-radius: var(--overlay-radius);
  --el-dialog-padding-primary: var(--overlay-pad);
  --el-popover-border-radius: var(--overlay-radius);
  --el-popover-padding: var(--overlay-pad);
  --el-box-shadow: var(--overlay-shadow);
  --el-box-shadow-light: var(--shadow-lift);
  --el-mask-color: var(--scrim);
  --el-font-family: var(--font-ui);
  --el-font-size-base: var(--fs-14);
}
```

注意：Element Plus 的危险按钮默认是实色填充，迁移时破坏性按钮应使用 `plain`（描边）形态；现有 `main.css` 把控件最小高度设为 44px，在 V1.1 中这只应在手机断点下生效。

---

## 15. V1.1 已解决

V1「已知未解决」的十项，处理与验证级别见 `08-v1.1-fix-record.md`：

- **K1** 页面直接引用 Primitive / 十六进制色 → D1，见 08 · K1。
- **K2** 难度色写在页面里 → D2，`.diff-tab` 收进 `domain.css`，见 08 · K2。
- **K3** 未 token 化的圆角 → D3，封面与命令面板图标格用圆角阶梯，见 08 · K3。
- **K4** 谱面带 token 被借用 → D4，`--note-*`、`--toast-*`，见 08 · K4。
- **K5** `tokens.css` 注释过时 → D5，见 08 · K5。
- **K6** 无障碍缺口 → D6，见 08 · K6。
- **K7** 手机触控尺寸 → D7，见 08 · K7。
- **K8** 缺失值两种横线 → D8，统一「—」，见 08 · K8。
- **K9** 未 token 化的布局值、1439 断点 → D9，见 08 · K9。
- **K10** 无首屏主题 → D10，见 08 · K10。

## 16. 仍未解决 / 未验证

以下取自 `11-v1.2-quality-report.md` §9–§10（V1.2 最终一轮：368 个用例、18 个流程，错误 0、警告 0，没有阻塞问题），均基于模拟数据。V1.1 的同类清单见 `09` §7–§9。

**V1.1 遗留项在 V1.2 的结果**
- 命令面板按键：口径改为首键 / 热态分开测后，6 轮全部在预算内（10.2）。
- 手机触控目标：产品页 0 条 `tap-target` 错误、0 条 `inline-link` 错误（11.4）。
- favicon 已加，`favicon.ico` 的 404 消失（9.25）。
- 「文字超出盒子」提示：按 F4.3 分类后没有第四类「真实裁切或可读性风险」，检查只再报告第四类。
- `/review/system`：页内目录焦点环已补，样张表格排序钮点击高度 ≥ 24px。
- 平板 820 宽未看的四页（`/songs/59`、`/songs/438`、`/songs/100136`、`/community/t/4017?p=2`）已看过，没有问题。

**未解决（非阻塞）**

1. **快速切换的长任务余量小**：本机上 60 次切换的最长任务 141–191ms（预算 200ms，最后一轮 173ms）。V1.2 已做三处减负（曲库与社区的搜索索引改为第一次有关键词时建立、定数表检索串懒计算、外壳只在手机且值变化时写根元素）。更慢的设备上可能超出，正式实现应在目标设备上重测。
2. **评审页** `/review/system`：首次渲染仍有 300–600ms 的长任务；手机上评审页标志（30px）与「链接」文字按钮（29px）低于 44px；评审页没有「跳到主要内容」。都不在产品页。
3. **原型控制按钮**在平板与桌面的帖子页会压住回复框的「回复」按钮；它是原型自带的控件，不属于产品。
4. 截断但没有 `title` 的 18 处提示未处理。

**仅源码或静态检查**
- 回复框「键盘弹出时贴在键盘上方、不叠加安全区」（F1.5）：只有 `visualViewport` 的代码，没有触发过真实键盘；「阅读位置不跳动」只在矮视口代理里验证过。
- `src/dock.js` 的卸载清理与归属切换：通过快速切换后的最终状态间接验证。
- favicon 深色那套颜色：没有在浏览器标签页上看过。
- token 对比度（236 项）、搜索、同步状态机、模拟数据自检。

**未验证**

- 真机软键盘（iOS Safari、Android Chrome）、iOS 的 `visualViewport` 行为、中日文输入法组字、安全区（刘海、Home 指示条）。
- 真实触屏的滚动惯性与点按延迟；2× 渲染。
- Safari、Firefox，低端安卓设备的性能。
- 读屏软件的实际朗读（路由播报、同步进度）；只验证了焦点移动。
- 真实网络、真实接口、错误与超时、离线；真实数据与账号。
- 深色、日文、1280 宽的大部分页面没有逐张看图（`11` §11 列出看过的截图）；SVG 里的文字相撞只能靠看图。
- 对比度检查看不到的文字：渐变或图片上的文字（17 处提示）、占位符、SVG 坐标轴文字、`text-shadow`。
- D5（tokens 注释）、D16（规范与实现一致）：本文按源码核对，没有浏览器检查。

正式集成阶段的处置见 `12-risks-and-integration-acceptance.md`。
