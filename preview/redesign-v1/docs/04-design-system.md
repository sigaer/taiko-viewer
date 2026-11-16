# 04 · Design System V1

本文是「譜面 Fumen」方向的书面规范，与原型中的活样张 `#/review/system`（`src/views/review/System.vue`）配套。活样张分为 11 节：设计原则、颜色、字体与字阶、间距 / 圆角 / 层级、布局与栅格、基础组件、业务组件、图表与数据展示、交互状态与动效、无障碍与国际化、与现有实现的映射；色值从当前页面实时读取，并附有文字对比度实测。本文给出同一套规则的书面版本，所有数值取自原型源码：

- `src/styles/tokens.css`：Design Tokens
- `src/styles/base.css`：重置、排版角色、基础组件类
- `src/styles/domain.css`：游戏语义视觉
- `src/components/*.vue`、`src/focusTrap.js`：框架、弹层、图表与业务组件

源码中仍与本规范不一致的地方集中列在文末「已知未解决」。

---

## 1. 设计原则

### 1.1 音符即数据

朱 = 咚：刷新成绩、主操作、选中下划线。浅葱 = 咔：信息、链接（`--ka-ink`）、焦点环、稳定性类进展。山吹 = 连打：高光、连续游玩、里程碑、目标达成。

- **依据**：玩家对这三种颜色的含义已有肌肉记忆，直接用作数据编码，不需要额外图例。
- **用户收益**：今日页、成长档案、谱面图之间，同一种颜色始终表示同一类事情；看音符颜色就知道这一天是「打出了新成绩」还是「更稳了」。

### 1.2 一条谱面讲完一段时间

Lane（譜面レーン）是全站唯一的签名元素：时间从左到右，判定圈落在今天，每天一个音符。

- **依据**：签名元素只有一个时才有辨识度，到处使用会沦为装饰。
- **用户收益**：最近 21 天的练习节奏、哪天有突破、连续打了几天，一条带子读完。空、加载、错误状态沿用同一条谱面带（EmptyLane），不需要学另一套视觉。

### 1.3 平面与细线，阴影只属于浮层

面板是 `--surface` + 1px `--line` + `--r-panel`，没有阴影。`--shadow-pop` 只用于对话框、命令面板、账号菜单、Toast；`--shadow-lift` 只用于浮在内容上方的按钮。

- **依据**：数据密集的页面里，阴影会制造层级噪音。
- **用户收益**：表格与点灯表更安静；看到阴影就知道它浮在内容上面、可以关掉。

### 1.4 数字用等宽窄体，汉字用字重做层级

所有数字使用 `.num`：Barlow Condensed、`tabular-nums lining-nums`、600。汉字层级靠 400 / 500 / 700 / 900 字重与字号，不靠颜色。

- **依据**：七位数成绩、两位小数的定数和 Rating 要在窄列里对齐比较；Noto Sans SC / JP 是可变字重。
- **用户收益**：成绩按位对齐，扫一眼能比较；标题与正文的区分在深浅色主题下一致。

### 1.5 查询永远一步可达

桌面顶栏常驻全局搜索（`Ctrl K` / `⌘K`，或非输入状态下按 `/`），手机底栏正中是「咚」键。命令面板直接搜曲名、帖子、操作，也识别「16 oxxo 180 鬼10」这样的配置串。

- **依据**：查歌、看定数、对成绩是最高频的事。
- **用户收益**：从任何页面到任何一首歌的某个难度，一次唤起加一次回车。

---

## 2. Design Tokens

### 2.1 三层结构

| 层 | 内容 | 谁可以引用 |
|---|---|---|
| Primitive | 藍 `--ai-*`、朱 `--shu-*`、浅葱 `--asagi-*`、山吹 `--yamabuki-*` 色阶 | 只有 Semantic / Domain 层 |
| Semantic | 背景、表面、线、文字、三色角色、实色填充、状态色、谱面带、头像、焦点、阴影、遮罩 | 所有组件与 base / domain CSS |
| Domain | 判定、难度、王冠、评价、流派 | `domain.css` 与业务组件 |

规则：**组件以及 `base.css`、`domain.css` 只消费 Semantic 与 Domain token，不直接引用 Primitive，也不写十六进制色。** 主题切换只改 Semantic / Domain 的值。排版、间距、圆角、布局、动效、层级 token 与主题无关。

### 2.2 Primitive 色

| 藍 | 值 | | 朱 | 值 |
|---|---|---|---|---|
| `--ai-950` | `#0b1120` | | `--shu-700` | `#b62a17` |
| `--ai-900` | `#101728` | | `--shu-600` | `#d23a22` |
| `--ai-850` | `#151e35` | | `--shu-500` | `#e8482e` |
| `--ai-800` | `#1a2440` | | `--shu-400` | `#ff6a4d` |
| `--ai-750` | `#212d4e` | | `--shu-100` | `#fde4de` |
| `--ai-700` | `#2b3860` | | **浅葱** | |
| `--ai-600` | `#3f4d78` | | `--asagi-700` | `#0b6f82` |
| `--ai-500` | `#5a6790` | | `--asagi-600` | `#128a9f` |
| `--ai-400` | `#7f8aaa` | | `--asagi-500` | `#1fa5ba` |
| `--ai-300` | `#a7afc6` | | `--asagi-400` | `#4cc6d8` |
| `--ai-200` | `#cdd2e0` | | `--asagi-100` | `#d9f1f5` |
| `--ai-150` | `#dfe3ec` | | **山吹** | |
| `--ai-100` | `#eaedf3` | | `--yamabuki-700` | `#9a6a00` |
| `--ai-50` | `#f3f5f8` | | `--yamabuki-500` | `#f2b51d` |
| `--ai-0` | `#ffffff` | | `--yamabuki-400` | `#ffcb45` |
| | | | `--yamabuki-100` | `#fdf0c8` |

### 2.3 Semantic token

浅色（紙）是 `:root` 默认值；深色（夜藍）由 `:root[data-theme='dark']` 覆盖。

| Token | 浅色 | 深色 | 用途 |
|---|---|---|---|
| `--bg` | `--ai-50` | `--ai-900` | 页面背景 |
| `--bg-sunk` | `--ai-100` | `--ai-950` | 凹陷区域：分段控件底、标签底、悬停底、骨架屏 |
| `--surface` | `--ai-0` | `--ai-850` | 面板、输入框、浮层 |
| `--surface-2` | `#f8f9fb` | `--ai-800` | 表格行悬停、次级表面 |
| `--line` | `--ai-150` | `#26314f` | 分隔线、面板边框 |
| `--line-strong` | `--ai-200` | `#34416a` | 控件边框、表头下线 |
| `--ink` | `#17203a` | `#e9edf7` | 主文字 |
| `--ink-2` | `#47526f` | `#b1b9d0` | 次要文字 |
| `--ink-3` | `#78829d` | `#7d88a8` | 辅助文字、占位符、坐标轴 |
| `--ink-inv` | `#ffffff` | `#101728` | 反色文字 |
| `--don` | `--shu-500` | `--shu-400` | 咚：音符、指示、图形、选中下划线 |
| `--don-solid` | `--shu-600` | `--shu-400` | 主按钮填充（注释：白字 ≥ 4.5:1） |
| `--ink-on-solid` | `--ai-0` | `--ai-950` | 实色填充（主按钮、难度标签）上的文字 |
| `--don-ink` | `--shu-600` | `#ff8266` | 文字级朱色（对白底 ≥ 4.5:1） |
| `--don-wash` | `--shu-100` | `#3b1f24` | 朱色浅底 |
| `--ka` | `--asagi-500` | `--asagi-400` | 咔：信息、焦点 |
| `--ka-ink` | `--asagi-700` | `#6fd6e6` | 链接与文字级浅葱 |
| `--ka-wash` | `--asagi-100` | `#12303f` | 浅葱浅底 |
| `--roll` | `--yamabuki-500` | `--yamabuki-400` | 连打：高光、里程碑 |
| `--roll-ink` | `--yamabuki-700` | `#ffd568` | 文字级山吹 |
| `--roll-wash` | `--yamabuki-100` | `#38301a` | 山吹浅底（也用作待办提示底） |
| `--ok` / `--ok-wash` | `#1d8a54` / `#dcf3e6` | `#4ccb8a` / `#153527` | 成功、上升数值 |
| `--warn` | `--yamabuki-700` | `#ffd568` | 警告 |
| `--danger` | `--shu-600` | `#ff8266` | 错误、破坏性按钮的描边与文字、下降数值 |
| `--lane` | `#232d4b` | `--ai-750` | 谱面带底色（浅色主题下也是深色带；深色下与 `--bg`、`--surface` 拉开层次） |
| `--lane-line` | `#3a466b` | `#34416a` | 谱面带轨线、周小节线 |
| `--lane-ink` | `#e9edf7` | `#e9edf7` | 谱面带上的文字 |
| `--focus` | `0 0 0 3px color-mix(in srgb, var(--ka) 45%, transparent)` | 同一公式，随深色 `--ka` 变化 | 焦点环 |
| `--shadow-pop` | `0 18px 50px -12px rgb(16 23 40 / .28), 0 2px 6px rgb(16 23 40 / .08)` | `0 24px 60px -12px rgb(0 0 0 / .6), 0 0 0 1px #34416a` | 浮层 |
| `--shadow-lift` | `0 6px 18px -8px rgb(16 23 40 / .22)` | `0 8px 22px -8px rgb(0 0 0 / .5)` | 浮动按钮 |
| `--scrim` | `rgb(16 23 40 / .46)` | `rgb(5 8 16 / .62)` | 弹层遮罩 |

两套主题共用的 Semantic token（谱面带在两种主题下都是深色，音符颜色固定）：

| Token | 值 | 用途 |
|---|---|---|
| `--lane-don` | `--shu-400` | 谱面带上的咚音符 |
| `--lane-ka` | `--asagi-400` | 谱面带上的咔音符、谱面带内焦点描边 |
| `--lane-roll` | `--yamabuki-500` | 连打条、目标音符 |
| `--lane-fc` | `#ffd75a` | 全连音符的金色内环 |
| `--lane-ring` | `--ai-0` | 音符白色内环 |
| `--lane-outline` | `--ai-950` | 音符深色外轮廓 |
| `--lane-ghost` / `--lane-ghost-ring` | `--ai-500` / `--ai-300` | 有游玩无进展的灰音符 |
| `--lane-measure` | `--ai-400` | 谱面图里更醒目的小节线与小节号 |
| `--avatar-bg` / `--avatar-ink` | `--ai-700` / `--ai-0` | 头像默认底色与文字 |

`--danger` 与 `--don-ink` 的值相同。主操作与破坏性操作靠**形式**区分（实色填充 vs 描边），不靠色相，见 4.1。

### 2.4 Domain token

**判定**

| Token | 浅色 | 深色 |
|---|---|---|
| `--judge-good` | `var(--don)` | 同左（随 `--don` 变化） |
| `--judge-ok` | `var(--ink-3)` | 同左（随 `--ink-3` 变化） |
| `--judge-ng` | `#7648c8` | `#a583f5` |

**难度**

| Token | 浅色 | 深色 |
|---|---|---|
| `--diff-easy` | `#e0502a` | `#ff7a55` |
| `--diff-normal` | `#5f9e2f` | `#8fcb5a` |
| `--diff-hard` | `#2f7fc2` | `#5aa9ea` |
| `--diff-oni` | `#d6337f` | `#ff66a8` |
| `--diff-ura` | `#7648c8` | `#a583f5` |

**王冠**

| Token | 浅色 | 深色 | 含义 |
|---|---|---|---|
| `--crown-none` | `--ai-300` | `#3f4d78` | `.crown` 的默认底色（未游玩实际渲染为短横线，见 5.4） |
| `--crown-clear` | `#9aa5b8` | `#b9c3d6` | 通关（银） |
| `--crown-fc` | `#e0a400` | `#ffc93a` | 全连（金） |
| `--crown-dfc` | `conic-gradient(from 210deg, #ff5a5a, #ffb13d, #f6e24b, #58d68d, #4cc6d8, #7a7cf0, #d05be0, #ff5a5a)` | 同左 | 全良（虹） |

**评价**

| Token | 浅色 | 深色 | 名称 |
|---|---|---|---|
| `--rank-iki1` | `#8c93a3` | 同左 | 白粹 |
| `--rank-iki2` | `#b0703a` | 同左 | 铜粹 |
| `--rank-iki3` | `#8e9fb8` | 同左 | 银粹 |
| `--rank-miyabi1` | `#d79a00` | 同左 | 金雅 |
| `--rank-miyabi2` | `#e2618f` | 同左 | 粉雅（日文「桃雅」） |
| `--rank-miyabi3` | `#8650d2` | 同左 | 紫雅 |
| `--rank-kiwami` | `#17203a` | `#e9edf7` | 极（实心） |
| `--rank-kiwami-ring` | `#c9a227` | 同左 | 极的金色外环 |

**流派**（两套主题共用）：`--genre-pops` `#2d9fb8` 流行音乐、`--genre-anime` `#f08a24` 动漫音乐、`--genre-kids` `#f0508c` 儿童音乐、`--genre-vocaloid` `#9aa7b8` 博歌乐、`--genre-game` `#a865d8` 游戏音乐、`--genre-variety` `#5db33a` 综合音乐、`--genre-classic` `#c9a227` 古典音乐、`--genre-namco` `#e8482e` 南梦宫原创。

### 2.5 排版

| Token | 值 |
|---|---|
| `--font-cjk-sc` | `'Noto Sans SC Variable', 'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei UI', 'Microsoft YaHei', sans-serif` |
| `--font-cjk-jp` | `'Noto Sans JP Variable', 'Hiragino Sans', 'Yu Gothic UI', 'Meiryo', sans-serif` |
| `--font-ui` | `'Barlow', var(--font-cjk-sc)`；`:lang(ja)` 下改为 JP 栈 |
| `--font-num` | `'Barlow Condensed', 'Barlow', var(--font-cjk-sc)`；`:lang(ja)` 下回退到 JP |

拉丁字母与数字走 Barlow，汉字与假名回退到 Noto。字体由 `@fontsource` 自托管：Barlow 400 / 500 / 600 / 700，Barlow Condensed 500 / 600 / 700，Noto Sans SC / JP 可变字重。

**字号**（`body` 基准 14px）：`--fs-11` 0.6875rem、`--fs-12` 0.75rem、`--fs-13` 0.8125rem、`--fs-14` 0.875rem、`--fs-16` 1rem、`--fs-18` 1.125rem、`--fs-22` 1.375rem、`--fs-28` 1.75rem、`--fs-36` 2.25rem、`--fs-48` 3rem、`--fs-64` 4rem（即 11–64px）。

**行高**：`--lh-tight` 1.15（展示标题）、`--lh-snug` 1.35（小标题）、`--lh-body` 1.6（正文默认）。

| 排版角色 | 桌面 | 手机 ≤767 | 颜色 |
|---|---|---|---|
| `.t-display` | 36 / 900 / tight，字距 -0.01em | 28 | 继承 |
| `.t-h1` | 28 / 900 / tight | 22 | 继承 |
| `.t-h2` | 18 / 700 / snug | 18 | 继承 |
| `.t-h3` | 14 / 700 / snug | 14 | 继承 |
| `.t-body` | 14 | 14 | 继承 |
| `.t-small` | 13 | 13 | `--ink-2` |
| `.t-caption` | 12 | 12 | `--ink-3` |
| `.num` | Barlow Condensed / 600 / 等宽数字 | 同 | 继承 |

### 2.6 间距

4px 基准：`--sp-1` 4、`--sp-2` 8、`--sp-3` 12、`--sp-4` 16、`--sp-5` 20、`--sp-6` 24、`--sp-8` 32、`--sp-10` 40、`--sp-12` 48、`--sp-16` 64（px）。

常用组合：页面上内边距 `--sp-6`（手机 `--sp-4`）；区块间距 `.section` 为 `--sp-10`（手机 `--sp-8`）；区块标题下 `--sp-4`；`.panel-pad` 为 `--sp-5`。

### 2.7 圆角

| Token | 值 | 用于 |
|---|---|---|
| `--r-xs` | 6px | 标签、难度徽章、星级点、判定条、社区角色、骨架屏、分段控件内钮 |
| `--r-ctl` | 8px | 按钮、输入框、图标按钮、菜单项、焦点环、难度切换按钮、谱面图 |
| `--r-panel` | 14px | 面板、对话框、账号菜单、Lane 外框 |
| `--r-lg` | 18px | 命令面板 |
| `--r-sheet` | 22px | 手机底部抽屉的两个顶角 |
| `--r-note` | 999px | 音符、胶囊（Chip、搜索框、同步状态、Toast、左轨选中态、连打条） |

规则：圆角按层级区分。小号内嵌元素 6，控件 8，容器 14，命令面板 18，从屏幕底部升起的抽屉 22，「像音符一样」的东西全圆。分段控件外框是 `calc(var(--r-ctl) + 2px)`，与内钮保持 3px 内边距下的同心关系。

### 2.8 布局变量

| Token | 值 | 说明 |
|---|---|---|
| `--rail-w` | 84px | 桌面 / 平板左侧窄轨宽度 |
| `--bar-h` | 60px | 桌面顶栏高度（手机顶栏在组件内为 52px） |
| `--tab-h` | 62px | 手机底栏高度（不含安全区） |
| `--content-max` | 1480px | `.page` 最大宽度 |
| `--gutter` | 28px；≤767px 时 16px | 页面左右边距 |

### 2.9 动效

| Token | 值 | 用途 |
|---|---|---|
| `--dur-1` | 120ms | 悬停、颜色、边框、按下缩放；浮层离场 |
| `--dur-2` | 220ms | 淡入淡出、对话框升起、命令面板下落、音符放大 |
| `--dur-3` | 420ms | 手机底部抽屉升起 |
| `--ease-out` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | 默认缓动 |
| `--ease-hit` | `cubic-bezier(0.3, 1.6, 0.5, 1)` | 击打回弹 |

规则：**击打回弹（`--ease-hit`）只用于按下圆形击打物（咚键、播放键、音符）与达成反馈。** 不得用于页面、面板、列表等容器。

### 2.10 层级

| Token | 值 | 元素 |
|---|---|---|
| `--z-rail` | 20 | 左轨 |
| `--z-bar` | 30 | 顶栏、手机底栏、歌曲详情手机操作条；手机二级页签为 `calc(var(--z-bar) - 1)` |
| `--z-sheet` | 60 | Sheet |
| `--z-palette` | 80 | 命令面板 |
| `--z-toast` | 90 | Toast |
| `--z-proto` | 100 | 原型控制（仅原型） |

组件内的局部层级（表头 1、账号菜单 5、难度切换条 5）只在各自的堆叠上下文内有效。

---

## 3. 全局导航、页面容器与栅格

信息架构见 `router.js`：6 个一级目的地（今日 / 曲库 / 成绩 / 成长 / 社区 / 工具）加账号；二级页签定义在 `MODULES[*].tabs`。

### 3.1 桌面框架（≥1100px）

**左轨**（固定，宽 `--rail-w`，`--surface` + 右侧 `--line`）

- 顶部标志（38px）。
- 六个目的地：图标在 52×34 的胶囊里，下方 12px 标签。当前模块胶囊填充 `--ink`、图标为 `--bg`，`aria-current="page"`；悬停为 `--bg-sunk`。
- 底部：语言切换（「中 / 日」字框）、深浅色切换。
- 「账号」不在左轨上，从顶栏账号菜单进入。

**顶栏**（吸顶，高 `--bar-h`，`--bg` 88% 半透明 + 背景模糊，底部 `--line`）

- 左：详情页显示返回按钮（`meta.back`）；模块名 `h1`（18 / 900）；非详情页内联显示二级页签，当前页签有 3px `--don` 下划线。
- 中：全局搜索框，宽 `clamp(200px, 26vw, 360px)`，胶囊形，带 `Ctrl K` 键帽，点击打开命令面板。
- 右：
  - 同步胶囊：已同步时显示「<时间>同步」，点击执行同步；同步中图标旋转、文字为「正在同步…」、`--ka-ink`、禁用。未绑定 / 无成绩时变为 `--roll-wash` 底的待办胶囊，链接到 `/bind` 或 `/account/sync`。
  - 通知铃：未读数为 `--don` 圆角徽标。
  - 账号头像：展开 220px 菜单（`role="menu"`，`--shadow-pop`）：我的主页、账号与绑定、同步、设置、退出登录。游客显示「登录」（`.btn-ink.btn-sm`）。

### 3.2 平板（768–1099px）

保留左轨与顶栏。搜索框收成 38px 图标按钮；同步胶囊只保留图标。页面多栏布局在此区间开始合并（3.5）。

### 3.3 手机框架（≤767px）

- **顶栏**：52px；无返回按钮时左侧显示 28px 标志；右侧通知与头像；搜索框与同步胶囊隐藏；账号菜单改为 `position: fixed` 贴在顶栏下方。
- **二级页签行**：顶栏下单独一行，吸顶（`top: 52px`），横向滚动、隐藏滚动条。
- **底栏五格**：今日 / 曲库 / 「咚」搜索键 / 社区 / 我的。高 `--tab-h` + 底部安全区，`--surface` 94% 半透明 + 模糊。
  - 「咚」键：54px 圆形，上移 18px，`--don` 填充 + `--lane-ring` 内环 + `--lane-outline` 外环 + `--shadow-lift`，按下缩放 0.9（`--ease-hit`），打开全屏命令面板。
  - 「我的」在成绩、成长、账号、工具、我的模块下都显示为选中；工具在手机上从「我的」进入。
  - 有未读通知时「社区」格显示 `--don` 小圆点。
  - `meta.bareMobile` 的页面（发布新帖）隐藏底栏。

### 3.4 页面容器

`.page`：`max-width: var(--content-max)`，居中，内边距 `--sp-6 var(--gutter) --sp-16`；手机 `--sp-4 var(--gutter) --sp-12`。

- `.page-head`：底部对齐、两端分布、可换行，下方 `--sp-6`。
- `.section` + `.section-head`：标题与右侧「更多」链接（`.more`，13px，`--ka-ink`）。区块标题不换行；标题右侧放控件组（`.row-wrap`）时控件组单行横向滚动，空间不够时整组换到标题下方。
- 路由切换时滚动回顶部（同一路径内保持位置）。

### 3.5 常用页面布局

| 布局 | 实例 | 桌面栅格 | 变化 |
|---|---|---|---|
| 主栏 + 吸顶侧栏 | 歌曲详情 | `minmax(0,1fr) 340px`，间距 40，侧栏 `top: calc(var(--bar-h) + 80px)` | ≤1239：侧栏 300px；≤767：单栏，「我的成绩」移到最前 |
| 主栏 + 侧卡 | 今日、Rating | `minmax(0,1.75fr)` / `minmax(0,1.7fr)` + `minmax(320px,1fr)` | ≤1239：单栏 |
| 表格 + 检视面板 | 定数表 | ≥1240：`minmax(0,1fr) 328px`，检视面板吸顶、自身可滚动 | 1240–1439 隐藏一列；≤1099 再隐藏一列；≤767 换成列表行 |
| 分面 + 表格 | 歌曲列表 | `216px minmax(0,1fr)`，分面吸顶 | ≤1099：分面移到上方横排；≤767：Chip 行 + 筛选抽屉 |
| 三栏社区 | 社区广场 | `200px minmax(0,1fr) 300px`，两侧吸顶 | ≤1239：`190px minmax(0,1fr)`，右栏隐藏；≤767：单栏，版块变为 Chip 行 |
| 阅读栏 | 帖子详情 | `minmax(0,760px) 320px` | ≤1099：只保留 760px 阅读栏 |

吸顶侧栏的 `top` 都以 `--bar-h` 为基准再加偏移。

### 3.6 断点

| 区间 | 变化 |
|---|---|
| ≤767px 手机 | 左轨隐藏、底栏出现；顶栏 52px；二级页签独立成行；`--gutter` 16px；控件加高；`.only-mobile` 显示、`.only-desktop` 隐藏；表格 → 列表行；对话框 → 底部抽屉；命令面板全屏 |
| 768–1099px 平板 | 保留左轨；搜索框收成图标；同步胶囊只留图标；歌曲列表分面移到上方；帖子详情去掉侧栏 |
| 1100–1239px 窄桌面 | 完整框架；今日、Rating 合为单栏；歌曲详情侧栏 300px；社区右栏隐藏 |
| ≥1240px 桌面 | 全部多栏布局；定数表出现检视面板 |

断点写法统一为 `max-width: 767px` / `1099px` / `1239px` 与 `min-width: 1240px`。

---

## 4. 基础组件规范

### 4.1 按钮 `.btn`

| 项 | 规格 |
|---|---|
| 默认 | 高 38px（手机 44），内边距 0 14px，`--r-ctl`，1px `--line-strong`，`--surface` 底，14px / 500，图标间距 6px |
| `.btn-primary` | `--don-solid` 填充，`--ink-on-solid` 文字，700；悬停为 `--don-solid` 88% 混 `--lane-outline` |
| `.btn-danger` | **描边**：`--surface` 底，`--danger` 边框与文字，700；悬停 `--don-wash` 底 |
| `.btn-ink` | `--ink` 填充、`--bg` 文字、700；悬停 `--ink` 86% 混 `--bg` |
| `.btn-ghost` | 无边框无底、`--ink-2`；悬停 `--bg-sunk` |
| 尺寸 | `.btn-sm` 30px / 13px（手机 36）；`.btn-lg` 46px / 16px；`.btn-block` 满宽 |
| 状态 | 默认变体悬停 `--surface-2` + `--ink-3` 边框；按下缩放 0.97；`[disabled]` 透明度 0.5、不响应指针 |

- **Do**：一个视图只有一个 `.btn-primary`。不改变数据的主要动作（游玩练习、重试、完成）用 `.btn-ink`；取消与次要入口用 `.btn-ghost` 或默认 `.btn`。
- **Do**：**主操作与破坏性操作靠形式区分（实色填充 vs 描边），不靠色相。** 删除、解绑等不可撤销操作的确认按钮用 `.btn-danger`，放在 Sheet 底栏右侧（全部成绩、状态样例、账号解绑都这样做）。
- **Don't**：不要用 `.btn-primary` 做删除确认，也不要给 `RouterLink` 渲染的 `.btn` 依赖 `[disabled]`。

### 4.2 图标按钮 `.icon-btn`

38×38（手机 44×44），`--r-ctl`，`--ink-2`，悬停 `--bg-sunk` + `--ink`。图标来自 `Icon.vue`：24 网格、1.75 描边、圆头圆角，`aria-hidden="true"`。每个图标按钮必须有 `aria-label`。

### 4.3 输入框与字段

| 项 | 规格 |
|---|---|
| `.field` | 纵向排列，间距 6px |
| 标签 | 13px / 500 / `--ink-2` |
| `.input` / `.select` | 高 40px（手机 46），内边距 0 12px，`--surface`，1px `--line-strong`，`--r-ctl` |
| `.textarea` | 自适应高度，内边距 10px 12px，可纵向拉伸 |
| 占位符 / 悬停 / 聚焦 | `--ink-3` / 边框 `--ink-3` / 边框 `--ka` + `--focus` |
| 错误 | `.is-error` 边框 `--danger`；`.field-error` 12px `--danger`；`.field-hint` 12px `--ink-3` |
| 手机字号 | 16px，避免 iOS 聚焦缩放 |

- **Do**：错误时设 `aria-invalid`，用 `aria-describedby` 指向错误或提示的 `id`；失焦或提交后再显示错误，文案说明差什么、怎么改（如「鼓众广场 ID 是 12 位数字，现在是 10 位」）。
- **Don't**：不要只用红色边框表示错误。

### 4.4 分段控件 `.seg`

`--bg-sunk` 底、内边距 3px、圆角 `calc(var(--r-ctl) + 2px)`；内钮高 30px（手机 36）、`--r-xs`、13px / 500 / `--ink-2`。`aria-pressed="true"` 或 `aria-selected="true"` 时为 `--surface` 底、`--ink`、700、细阴影。

用于 2–4 个互斥的视图选项（30 / 90 / 180 天、单人 / P1 / P2、表格 / 封面、谱面分歧）。多选用 Chip，页面导航用页签。

### 4.5 页签 `.tabs`

横排、间距 `--sp-5`、底部 `--line`，横向滚动且隐藏滚动条。项 14px / 500 / `--ink-2`；选中（`aria-selected` 或 `.router-link-exact-active`）为 `--ink` / 700 + 3px `--don` 下划线。顶栏与手机二级页签使用同一视觉；歌曲详情难度切换条是 `role="tablist"` / `role="tab"`，视觉见 5.2。

### 4.6 Chip `.chip`

高 28px（手机 34），胶囊，1px `--line-strong`，13px / `--ink-2`。可交互的 Chip 是 `<button>`，`aria-pressed` 选中时 `--ink` 填充、`--bg` 字。用于筛选（可多选）与横向快捷筛选行。静态标签用 `.tag`。

### 4.7 标签 `.tag` 与圆点 `.dot`

`.tag`：高 20px、`--r-xs`、11px / 500、`--bg-sunk` 底、`--ink-2`，不可交互；变体 `.tag-don` / `.tag-ka` / `.tag-roll` / `.tag-ok` 用对应 wash 底与 ink 字。`.dot`：8px 圆点，颜色取 `currentColor`，用于流派、版块，旁边必须有名称。

### 4.8 数据表 `.dt`

| 项 | 规格 |
|---|---|
| 字号 | 正文 13px；表头 12px / 500 / `--ink-3` |
| 表头 | `sticky; top: 0`，`--surface` 底，底部 1px `--line-strong` |
| 单元格 | 内边距 9px 12px，底部 1px `--line`；最后一行无下线 |
| 对齐 | `.r` 右对齐、`.c` 居中 |
| 行 | 悬停 `--surface-2`；可点击行 `.is-link` |
| 排序 | 表头内 `<button>`，`th` 设 `aria-sort`，当前列显示箭头 |
| 紧凑 | `.dt-compact`：上下内边距 5px |

- 数值列（成绩、准确率、BPM、定数、日期、序号）一律 `.r` + `.num`；王冠、评价、星级列 `.c`；歌曲列用 SongCell。
- 可点击整行：`tabindex="0"` + `Enter` 打开。
- **桌面表格 → 手机列表行**：表格容器 `.only-desktop`，另给 `.only-mobile` 的列表行（封面 + 标题 + 一行关键指标 + 右侧主数值或王冠 / 评价），不在手机上横向滚动整张表。

### 4.9 键值对、统计、面板、骨架屏、头像、链接

- **`.kv`**：两列网格（`auto 1fr`），间距 8px 16px，13px；`dt` `--ink-3`，`dd` 右对齐 / 500。
- **`.stat`**：`.v` Barlow Condensed / 700 / 28px / 行高 1；`.k` 12px `--ink-3` 在下方；`.d` 变化量 14px / 600，配合 `.up`（`--ok`）或 `.down`（`--danger`）。
- **`.panel`**：`--surface`、1px `--line`、`--r-panel`，无阴影；`.panel-pad` `--sp-5`；`.panel-head` 内边距 `--sp-4 --sp-5`、底部 `--line`；`.rule` 1px 分隔线。
- **`.sk`**：`--bg-sunk`、`--r-xs`、最小高 12px，`--surface` 70% 光带 1.4s 扫过；容器设 `aria-busy="true"`。只用于结构已知、内容未到的区域，形状与真实内容一致；等待操作结果用 EmptyLane `loading`。
- **`.avatar`**：圆形 32px / 13px / 700，`--avatar-bg` 底、`--avatar-ink` 字；`.lg` 72px、`.sm` 24px。社区用户按 `hsl(<hue> 45% 42%)` 着色；无图片时显示首字。
- **`.link`**：`--ka-ink` / 500，悬停下划线。整块可点击的行不加下划线，悬停时标题变为 `--ka-ink`。

### 4.10 Sheet（对话框 ↔ 底部抽屉）

`Sheet.vue`，参数 `open`、`title`、`width`（默认 520），插槽 `default` 与 `foot`。

| 项 | 桌面 / 平板 | 手机 ≤767 |
|---|---|---|
| 位置 | 居中，四周留 24px | 贴底，满宽 |
| 尺寸 | `min(width, 100%)`，最高 `min(86dvh, 820px)` | 最高 90dvh |
| 外观 | `--r-panel`、`--shadow-pop` | 顶角 `--r-sheet`，40×4 抓手，底部安全区内边距 |
| 进场 | 上移 12px + 缩放 0.98 → 原位，`--dur-2` | 自底部滑入，`--dur-3` |
| 底栏 | 按钮右对齐 | 按钮等分宽度 |

行为：`role="dialog"`、`aria-modal="true"`、`aria-label` 为标题；`Esc` 或点击遮罩关闭；打开时锁定页面滚动。**焦点**（`focusTrap.js`）：打开时焦点落到正文里第一个可用的输入项，没有输入项则落到关闭按钮；`Tab` / `Shift+Tab` 限制在弹层内循环；关闭后焦点还给打开它的元素。

- **Do**：同一份内容在桌面是对话框、在手机是抽屉；底栏左侧取消 / 保留，右侧确认。
- **Don't**：不要在 Sheet 里再打开 Sheet。

### 4.11 Toast

`toast(text, kind = 'ok')`，3.2 秒后消失。容器 `role="status"`、`aria-live="polite"`，底部居中（手机在底栏上方），不拦截指针。外观：胶囊、`--lane` 底、`--lane-ink` 字、`--shadow-pop`，左侧一个音符：`ok` 为朱色，其他类型（`info`）为浅葱。

只用于已完成操作的确认与轻量提示（「设置已保存」「登录后可以投票」）。Toast 不可点击，不承载撤销，不用于错误（错误就地显示）。

### 4.12 命令面板

`CommandPalette.vue`，全局唯一实例。

- **唤起**：顶栏搜索框、`Ctrl K` / `⌘K`、非输入状态按 `/`、手机「咚」键、游客首页搜索框。
- **布局**：桌面宽 680px、距顶 11vh、`--r-lg`、`--shadow-pop`；手机全屏、无圆角、无动画，输入框 16px。
- **空查询**：「最近看过」的歌曲 + 「快捷操作」（同步成绩、单曲 RT 计算器、发布新帖、选目标、查看 Rating 构成、切换深浅色、切换语言；部分只在已同步时出现）。
- **有查询**：匹配 `/^\s*(\d{1,2})\s+[oxOX]{2,}/` 时最前面给出「按配置查谱」；歌曲在日文名、中文名、艺术家中匹配，最多 6 首，显示魔王及以上难度的 Diff（已同步时附王冠），副标题带 `lang`；帖子按标题与标签匹配，最多 4 条；操作按名称匹配。
- **键盘与焦点**：打开时聚焦输入框；↑ / ↓ 选择、`Enter` 打开、`Esc` 关闭；`Tab` 限制在面板内；关闭后焦点还给打开它的元素。
- **无结果**：提示可用日文原名、中文译名或别名搜索，并给出「打开曲库」。

### 4.13 Gate（权限引导）

`Gate.vue`，参数 `what`。按登录态给出唯一的下一步，**留在原地**，不跳转登录页：`guest` →「登录后查看<what>」+ 登录（主）/ 注册；`unbound` →「先绑定鼓众广场 ID」+ 去绑定；`empty` →「还没有成绩」+ 同步成绩。外观：面板，最大宽 640px，上方 8vh，内部用 EmptyLane。

### 4.14 EmptyLane（空 / 错误 / 加载）

`EmptyLane.vue`，参数 `title`、`text`、`tone`（`empty` | `error` | `loading`）、`compact`，默认插槽放操作。视觉：280×44 胶囊形谱面带（`--lane` 底、`--lane-line` 轨线），左侧判定圈；下方 `.t-h2` 标题、`.t-small` 说明、操作。

| tone | 含义 | 视觉 |
|---|---|---|
| `empty` | 还没有音符飞过来 | 空谱面带 + `--lane-ink` 70% 判定圈 |
| `error` | 判定为「不可」 | 判定圈变为 `--judge-ng`，并填充 30% |
| `loading` | 音符正在飞来 | `--lane-don`、`--lane-ka`、`--lane-don` 三个音符向判定圈飞，1.5s 循环，错开 0.5s |

---

## 5. 业务组件规范

规则：**游戏语义（音符、判定、难度、王冠、评价、封面、社区角色）的视觉只在 `domain.css` 与本节组件中定义**，页面不得自行给难度、王冠、评价着色。

### 5.1 Note 音符 `.note`

圆形，尺寸由 `--n` 控制（默认 14px），底色 `--don`，内侧 14% `--lane-ring` 环 + 外侧 1px `--lane-outline`（55%）。

| 类 | 效果 |
|---|---|
| （默认） / `.ka` / `.roll` | 咚 `--don` / 咔 `--ka` / 连打与目标 `--roll` |
| `.big` | `--n: 20px` |
| `.ghost` | 透明底 + 1.5px `--ink-3` 环 |
| `.fc` | 新全连：16% `--lane-fc` 金色内环 |
| `.dfc` | 新全良：朱色鼓面 + `--lane-ring` 白环 + `--crown-dfc` 虹色外环 |

`.fc` / `.dfc` 与 Lane 上的全连 / 全良音符编码相同。音符用于 Toast、成长事实类型、目标尝试轨迹、步骤引导（完成 = 咔，当前 = 咚，未到 = 空心）、目标单选标记。

### 5.2 Diff 难度徽章

`Diff.vue`，参数 `d`（1–5）、`star`、`constant`、`short`、`lg`。三段信息**始终按同一顺序**：**难度名 → ★星级 → 定数**。

| 段 | 样式 |
|---|---|
| 难度名 `.d` | 难度色填充，`--ink-on-solid` 文字 700 |
| 星级 `.s` | `★` + 星级，`--font-num` 700 / 14px，难度色字，难度色 10% 混 `--surface` 底 |
| 定数 `.k` | 两位小数，`--font-num` 600 / 14px，`--ink`，`--surface` 底，左侧难度色 40% 分隔线 |

外框高 22px（`.lg` 28px）、`--r-xs`、1px 难度色边框。`short` 用单字难度名，`title` 给出全称。没有定数时省略第三段。

| d | key | 中文 / 短 | 日文 / 短 |
|---|---|---|---|
| 1 | easy | 简单 / 简 | かんたん / 易 |
| 2 | normal | 普通 / 普 | ふつう / 普 |
| 3 | hard | 困难 / 难 | むずかしい / 難 |
| 4 | oni | 魔王 / 鬼 | おに / 鬼 |
| 5 | ura | 魔王（里）/ 里 | おに（裏）/ 裏 |

**难度切换条**（歌曲详情）：每个难度一枚 44px 按钮，显示难度名（难度色）、★星级（18px）、定数、已同步时的王冠；选中时整枚按钮填满难度色。手机上未选中的按钮隐藏难度名。

### 5.3 star-pip 星级点

最小 22×22、`--r-xs`、难度色 14% 底、难度色数字（`--font-num` 700）。`.off` 表示该难度不存在：透明底、`--ink-3`、400，内容「–」。用于歌曲列表的五个难度列与手机列表行。

### 5.4 Crown 王冠

`Crown.vue`，参数 `v`、`size`（`''` | `sm` | `lg`）、`label`。

| v | class | 中文 | 日文 | 形状与颜色 |
|---|---|---|---|---|
| `null` | `none` | 未游玩 | 未プレイ | 短横线（2px，`--ink-3`），不画王冠形 |
| `-1` | `played` | 已游玩 | プレイ済み | 空心圆环（1.5px `--ink-3`） |
| `0` | `clear` | 通关 | クリア | 王冠，`--crown-clear` 银 |
| `1` | `fc` | 全连 | フルコンボ | 王冠，`--crown-fc` 金 |
| `2` | `dfc` | 全良 | 全良 | 王冠，`--crown-dfc` 虹色锥形渐变 |

未游玩不画灰色王冠，避免被读成银色通关。尺寸：默认 20×16，`sm` 15×12，`lg` 30×24。王冠是 SVG 遮罩，颜色由背景提供。无障碍：`role="img"` + `aria-label`，外层 `title`；`label` 为真时右侧显示文字。

### 5.5 Rank 评价

`Rank.vue`，参数 `v`（0–8）、`lg`、`label`。22px 圆形（`lg` 32），1.5px 描边，中间字形。

| v | key | 中文 | 日文 | 字形（中 / 日） | 样式 | 门槛 |
|---|---|---|---|---|---|---|
| 0 / 1 | none | — / 未取得 | — / 未取得 | 无 | 虚线圈、透明度 0.5 | — |
| 2 | iki1 | 白粹 | 白粋 | 粹 / 粋 | 描边 | 500,000 |
| 3 | iki2 | 铜粹 | 銅粋 | 粹 / 粋 | 描边 | 600,000 |
| 4 | iki3 | 银粹 | 銀粋 | 粹 / 粋 | 描边 | 700,000 |
| 5 | miyabi1 | 金雅 | 金雅 | 雅 | 描边 + 14% 填充 | 800,000 |
| 6 | miyabi2 | 粉雅 | 桃雅 | 雅 | 描边 + 14% 填充 | 900,000 |
| 7 | miyabi3 | 紫雅 | 紫雅 | 雅 | 描边 + 14% 填充 | 950,000 |
| 8 | kiwami | 极 | 極 | 极 / 極 | `--rank-kiwami` 实心、`--bg` 字，`--surface` 间隙 + `--rank-kiwami-ring` 外环 | 1,000,000 |

粹 → 雅 → 极 的层级由「只描边 → 描边加淡填充 → 实心加外环」表达；字形随语言切换。无障碍同 Crown。

### 5.6 Cover 封面

`Cover.vue`。原型中是生成式占位：底色为流派色，按曲目 ID 做 ±22° 色相旋转，按 `id % 3` 选三种装饰变体，中间是日文曲名第一个有效字符（`lang="ja"`）。整块 `aria-hidden="true"`，旁边必须有曲名。尺寸：默认 44px、`.sm` 32、`.lg` 72、`.xl` 168、`.fill` 100%，正方形，圆角随尺寸为 6 / 8 / 10 / 14px。生产环境替换为封面 CDN 图片，尺寸与圆角规则不变。

### 5.7 SongCell 歌曲单元

封面 + 主标题 + 副标题，全站列表共用。

- **主标题**：当前界面语言的曲名（`songTitle`），14px / 700 / `--ink`，单行截断。
- **副标题**：另一种语言的曲名（`songSub`；与主标题相同时为空），12px / `--ink-3`，单行截断，最小高度 1em。调用方可用 `sub` 传入补充信息（推荐理由、流派与上架日期）替代。

**`lang` 规则**：凡显示「非当前界面语言」的曲名，都加正确的 `lang`（中文界面下的日文名为 `ja`，日文界面下的中文名为 `zh-CN`）。SongCell 使用默认副标题时自动设置；传入 `sub` 时不设置。

### 5.8 判定条 `.judge`

8px 高、`--r-xs` 的横条，按良 / 可 / 不可数量用 `flex` 分配宽度：`--judge-good`、`--judge-ok`、`--judge-ng`。下方 `.judge-legend` 给出三项文字与数字（16px / 700）。判定条必须与图例一起使用。

### 5.9 FactRow 成长事实

一条进展 = 类型音符 + 封面 + 曲名与「Diff + 类型名」+ 右侧「之前 → 之后」，整行链接到 `/songs/:id?d=<难度>`。今日页、成长档案、每周回顾共用。事实类型来自 `mock/data.js` 的 `FACT`（与仓库 PlayerGrowth facts 的 `type` 一致）：

| type | 中文 | 日文 | 音符 | 权重 | 右侧显示 |
|---|---|---|---|---|---|
| `df` | 新全良 | 全良達成 | `.big.dfc` | 6 | 全良王冠 + 成绩 |
| `fc` | 新全连 | フルコンボ | `.big.fc` | 5 | 全连王冠 + 成绩 |
| `goal-completed` | 练成了目标 | 目標達成 | `.big.roll` | 4.5 | 不可 之前 → 之后 |
| `rank-upgrade` | 评价升级 | 評価アップ | `.ka` | 4 | 评价 → 评价 |
| `score-pb` | 刷新最好成绩 | 自己ベスト | 默认（朱） | 3 | 成绩 + 增量（`--ok`） |
| `clear-upgrade` | 首次通关 | 初クリア | 默认（朱） | 3 | 成绩 + 增量 |
| `ng-reduced` | 不可变少了 | 不可が減った | `.ka` | 2 | 不可 之前 → 之后 |
| `combo-improved` | 连击更长了 | コンボ更新 | `.ka` | 2 | 连击 之前 → 之后 |
| `played` | 打了一次 | プレイ | `.ghost` | 1 | — |

权重决定 Lane 上每天显示哪个事实的音符（取最高者）。手机上右侧数值纵向堆叠，含箭头的变化保持横排；`dense` 用于游客首页示例。

### 5.10 GoalCard 当前目标

「这次想练」面板：标题 +「全部目标」链接；72px 封面、目标类型（13px / 700 / `--don-ink`）、曲名（18px / 900）、带定数的 Diff、关注维度标签（`.tag-ka`）；尝试轨迹——虚线上每次尝试一个音符（最近一次实心朱色，之前为空心）、不可数、几天前，终点是判定圈「0 / 全连」，离判定圈越近离目标越近；一句话总结；操作「查看谱面」+「练后同步」（主按钮，同步中禁用）。

### 5.11 ThreadRow 帖子行

- 元信息：版块圆点（版块色只出现在这一个圆点上）+ 版块名；置顶（`.tag-don` + 图钉）、精华（`.tag-roll`）、非讨论类型的类型标签。
- 标题 16px / 700（`compact` 14px、最多两行），悬停 `--ka-ink`；摘要 13px / `--ink-2`、最多两行（`compact` 不显示）。
- 底部：作者头像与名字、时间、回复、点赞、浏览（浏览只在桌面显示）。
- 关联歌曲：非 `compact` 时右侧 96px 列（72px 封面、曲名、Diff）；手机 56px，隐藏曲名。

### 5.12 ChartSheet 谱面图（占位）

生产环境由服务端渲染的谱面图 PNG 取代；原型保留它，是为了按真实比例与密度做版式。`--lane` 底、`--r-ctl`；每行 4 个小节（手机 2 个），小节高 40px（手机 34），`--lane-measure` 小节线与小节号、`--lane-line` 轨线；音符 13px（大音符 19px）用 `--lane-don` / `--lane-ka`，`--lane-ring` 内环、`--lane-outline` 外轮廓；连打为 `--lane-roll` 全圆长条；密度 > 0.72 的小节加 `--lane-don` 10% 底（与 DensityStrip 同一阈值）。`role="img"`。

### 5.13 社区角色 `.role`

18px 高、`--r-xs`、11px / 700。`.moderator` 为 `--ka-wash` + `--ka-ink`；`.admin` 为 `--don-wash` + `--don-ink`。

---

## 6. 图表、成绩数据与歌曲信息展示规范

全部图表是手写 SVG / CSS 组件，颜色只引用 token。

### 6.1 Lane 譜面レーン

`Lane.vue`，参数 `days`、`modelValue`（选中的 `daysAgo`，支持 `v-model`）、`compact`。每天一列（最小 34px，`compact` 22px），三行：事实计数 22 / 谱面带 60 / 日期 40（`compact` 16 / 60 / 26）。整条带 `--lane` 底、`--r-panel`，两种主题下都是深色带。溢出时横向滚动、隐藏滚动条，**默认停在最右端**让「今天」可见；选中某天不改变滚动位置。

| 元素 | 编码 |
|---|---|
| 没有游玩 | 4px `--lane-line` 小圆点，日期变暗 |
| 有游玩、无进展 | 14px `--lane-ghost` 音符 + `--lane-ghost-ring` |
| 刷新成绩 / 首次通关 | 20px `--lane-don` 音符 |
| 评价升级 / 不可减少 / 连击更长 | 20px `--lane-ka` 音符 |
| 新全连 | 30px `--lane-don` 音符 + `--lane-fc` 金色内环 |
| 新全良 | 36px：`--lane-don` 鼓面 + `--lane-ring` 白环 + `--crown-dfc` 虹色外环 |
| 练成目标 | 30px `--lane-roll` 音符 |
| 连续游玩 | 相邻两天都游玩时，用 `--lane-roll` 62% 的连打条（10px）连接 |
| 今天 | 46px 判定圈，日期显示「今天」 |
| 小节线 | 每周一的列左侧 1px `--lane-line` |
| 当天多条进展 | 音符上方显示条数（>1 时） |
| 日期 | `月/日`，非 `compact` 时下方显示星期 |
| 选中 / 悬停 | 谱面带底提亮至 `--lane-ink` 9% / 6%，音符放大 1.14（`--ease-hit`）；选中日期变为 `--lane-ink` 加粗 |
| 焦点 | 列内 2px `--lane-ka` 内描边 |

无障碍：外层 `role="group"`（「最近的练习谱面」）；每列是按钮，`aria-pressed` 表示选中，`aria-label` 为「日期 + N 条进展 / 有游玩 / 没有游玩」。使用位置：今日页（21 天，下方显示当天事实）、游客首页示例（`compact`）、年度回顾入口（`compact`）、评审总览页。

### 6.2 DrumDial 鼓面刻度盘

参数 `value`、`max`（15.5）、`step`（0.5）、`size`（168）、`tone`（`don` | `ka` | `roll`）。鼓面（`--surface-2` + `--line-strong` 边）外围一圈「鋲」，每颗 = `step`，数量 `round(max / step)`：Rating 满刻度 15.5 → **31 颗**；从 7 点半方向顺时针铺 270°。已达到的鋲半径 2.6、`tone` 色；半颗为 `tone` 与 `--line-strong` 各半；未达到的半径 1.7、`--line-strong`。中心插槽放数值（今日页为「Rating」、两位小数、「/ 15.5」三行）；SVG `aria-hidden`，可读数值由插槽文字提供。也可用于目标完成度（`max = 1`、`step = 1/24`）。使用：今日 176px、Rating 164px、我的 112px、单曲 RT 计算器 208px。

### 6.3 Radar 雷达图

参数 `axes`（`[{ label, value, prev?, key }]`）、`focus`、`size`、`domain`、`tone`（默认 `var(--don)`）。

- **量程**：未传 `domain` 时自动收窄：下限 `floor(min - 0.6)`（≥ 0），上限 `ceil(max + 0.1)`，同时考虑 `prev`。**量程上下限印在图上**，避免「看起来都一样」或误以为从 0 开始。
- 四圈参考环（25 / 50 / 75 / 100%）与辐条用 `--line`；当前值 `tone` 16% 填充 + 2px 描边；`prev` 为 `--ink-3` 1.25px **虚线**、不填充；关注轴顶点放大为 `--ka` 实心点，轴名 `--ka-ink` / 700；每个轴名下印两位小数的数值。
- **无障碍**：`role="img"`，`aria-label` 自动生成为「轴名 数值，轴名 数值…」。

玩家六维（今日、成长档案、个人主页）用自动量程并带 `prev`；谱面五维能力（歌曲详情、定数表检视面板、TJA 工具）固定 `domain = [0, 15.5]`，便于跨谱面比较。

### 6.4 LineChart 趋势折线

参数 `points`（`[{ label, v }]`）、`height`（220）、`marks`（`[{ index, text }]`）、`digits`（2）、`tone`、`label`。

- 宽度由 `ResizeObserver` 跟随容器（最小 240px）。**单一序列不画图例**。
- Y 轴：按跨度选步长（> 1.2 用 0.5，> 0.5 用 0.25，否则 0.1），每隔 `ceil(count / 3)` 步画一条参考线，**最多 4 条**；刻度标签 `--font-num` 12px。X 轴：桌面 7 个标签，宽度 < 480px 时 4 个。
- 线：`tone` 2.25px；下方 `tone` 9% 面积；末端 4.5px 实心点。里程碑：`--roll` 虚线竖线 + 圆点。
- 读数：悬停 / 触摸时出现 `--ink-3` 竖线、圆点与读数框（`--ink` 底、`--bg` 字），显示数值、标签与里程碑文字（`--roll`）。`touch-action: pan-y`。
- **无障碍**：`role="img"`，`aria-label` 取 `label`；未传时自动概括为「从 <首值> 到 <末值>」。

使用：Rating 页（30 / 90 / 180 天、里程碑）、成长档案（Rating 用 `--don`，其他指标用 `--ka`）。

### 6.5 DensityStrip 与 Spark

- **DensityStrip**：`values`（每小节 0–1）、`height`（56）。每小节一根柱，`--ink-3` 55% 不透明；**密度 > 0.72 用 `--don` 全不透明**标出难点。`role="img"`。歌曲详情配说明「每小节密度，朱色是难点」与首尾小节号。
- **Spark**：`values`、`w`（96）、`h`（28）、`tone`（`--ink-2`）。1.75px 线 + 末端 2.5px 点，无坐标轴，`aria-hidden`，只作为旁边数字的补充。

### 6.6 数字格式

| 数据 | 格式 | 实现 | 示例（`mock/data.js`） |
|---|---|---|---|
| 成绩 | 千分位，无小数 | `fmt()` = `toLocaleString('en-US')` | 1,004,290 |
| Rating | 两位小数 | `toFixed(2)` | 11.97 |
| 准确率 | 两位小数 + `%` | `toFixed(2) + '%'` | `xx.xx%` |
| 定数（主 / 75% / 99%） | 两位小数 | `toFixed(2)` | `xx.xx` |
| 单曲 RT、六维、能力值 | 两位小数 | `toFixed(2)` | 12.70 |
| 变化量 | 带 `+`，`.up` / `.down` | | +0.31 |
| 物量、点赞、浏览 | 千分位 | `fmt()` | 与成绩相同 |
| 缺失值 | 「—」 | `fmt(null)` / `fx(null)` | — |

规则：所有数字用 `.num`；表格数值列右对齐（`.r`），同列小数位一致；星级前缀 `★`、不带小数；不存在的难度在星级点中显示「–」，缺失的定数与成绩显示「—」。

### 6.7 冗余编码：颜色永远不是唯一载体

| 信息 | 颜色之外的载体 |
|---|---|
| 王冠 | 形状（短横 / 圆环 / 王冠）、`aria-label`、`title`、可选文字 |
| 评价 | 字形（粹 / 雅 / 极）、描边 / 填充 / 外环、`aria-label` |
| 难度 | 难度名或单字缩写、`title` 全称 |
| Lane 与成长事实 | 音符尺寸与内外环、类型名文字、右侧王冠 / 评价 / 数值 |
| 判定条 | 图例文字与数字 |
| 流派、版块 | 圆点旁的名称 |
| 密度难点 | 柱高 |
| 涨跌 | `+` 号与数值 |
| 主操作 vs 破坏性 | 实色填充 vs 描边 |

例外：谱面图中咚 / 咔音符只靠颜色区分，与游戏本身一致。

### 6.8 替代现有实现

| 现有实现 | V1 |
|---|---|
| ECharts（`AdminChartCard.client.vue`，仅管理后台） | 管理后台不在本次范围内，保持不变 |
| 手写 SVG（如 `PassportMetricChart.vue`、`StoryRadarChart.vue`、`AnnualRatingWaterfallChart.vue`） | 前台统一为 Radar、LineChart、Spark、DrumDial；年度回顾故事播放器内的图表不在范围内 |
| 服务端渲染 PNG 的工具页（`pages/tools/b30.vue`、`trend.vue`、`progress.vue` 等） | `/play` 用 DrumDial + LineChart + 原生表格替代 B30 表与走势图片，保留「生成 B30 图片」供分享；点灯进度改为原生页面 `/play/progress` |
| 服务端渲染的谱面图 PNG | 继续使用；ChartSheet 只是占位 |

---

## 7. 响应式与移动端适配原则

原型在 ≤767px 时采用的变换：

1. **表格 → 列表行**：桌面 `.dt` 加 `.only-desktop`，手机给 `.only-mobile` 列表行（歌曲列表、Rating、定数表）。
2. **对话框 → 底部抽屉**：所有弹层用 Sheet，内容不变。
3. **侧栏内容前置**：歌曲详情把「我的成绩」放到主栏最前，只保留王冠、成绩、准确率、评价与判定条；头部事实只保留前两项。
4. **固定底部操作条**：歌曲详情在底栏上方固定「游玩练习 / 想练这首」；社区广场用右下角圆形发帖按钮。
5. **横向滚动行**：筛选 Chip、社区版块、二级页签、难度切换条、Lane、区块标题旁的控件组都横向滚动并隐藏滚动条；完整筛选放进抽屉，底栏给出「查看 N 首」。
6. **命令面板全屏**。
7. **触控尺寸**：`.btn`、`.icon-btn` 44px；输入框与选择框 46px；难度切换按钮 46px；`.btn-sm`、分段内钮 36px；`.chip` 34px。
8. **16px 输入**：`.input`、`.select`、`.textarea`、命令面板与歌曲列表搜索框在手机上都是 16px。
9. **安全区**：`viewport-fit=cover`；底栏、`.shell` 底部留白、Sheet 底部、Toast、浮动按钮、歌曲详情操作条都加 `env(safe-area-inset-bottom)`。
10. **排版收紧**：`.t-display` 28px、`.t-h1` 22px；页面与区块间距缩小；帖子行关联歌曲列 56px；谱面图每行 2 小节；命令面板中的 Diff 隐藏定数段。

---

## 8. 交互状态、反馈与动效

### 8.1 状态

| 状态 | 处理 |
|---|---|
| 悬停 | 边框 `--ink-3` 或底色 `--bg-sunk` / `--surface-2`；文字 `--ink-2` → `--ink`；整行链接标题变 `--ka-ink`；`.link` 下划线 |
| 焦点 | 全局 `:focus-visible { box-shadow: var(--focus); border-radius: var(--r-ctl) }`；输入框在 `:focus` 即显示焦点环；左轨只给胶囊加环；深色谱面带上改用 2px `--lane-ka` 内描边 |
| 按下 | `.btn` 缩放 0.97（`--dur-1`）；「咚」键、试听键缩放 0.9（`--ease-hit`） |
| 禁用 | `[disabled]` 透明度 0.5、不响应指针；进行中的操作同时改写按钮文字（「正在同步…」） |
| 选中 | 由 ARIA 属性驱动：`aria-pressed`（分段、Chip、Lane 列、投票、「有帮助」）、`aria-selected`（页签、难度切换）、`aria-checked`（目标单选）、`aria-current="page"`（左轨）、`.router-link-exact-active` |
| 加载 | 结构已知用骨架屏；等待操作结果用 EmptyLane `loading` 或按钮进行中状态；同步胶囊图标旋转 |

### 8.2 反馈模式

- **Toast**：操作已完成或轻提示（4.11）。
- **就地错误**：字段下 `.field-error`；表单级错误用 `role="alert"` 提示块；计算器合计校验同样就地显示。
- **破坏性操作**：Sheet 确认，标题是问题（「删除这条成绩？」），正文写清后果与能否恢复，底栏「取消 / 保留」+ `.btn-danger`；完成后 Toast。
- **乐观切换**：投票、标签、「有帮助」点击后立即更新计数与选中态；游客触发需要登录的操作时给 `info` Toast，不跳转。
- **权限引导**：Gate（4.13）。

### 8.3 动效规则

- 动效只回应操作或状态变化。**路由切换不做转场**（`App.vue` 中 `RouterView` 无 `Transition`）。
- 击打回弹（`--ease-hit`）只用于按下圆形击打物（咚键、播放键、音符）与达成反馈。
- 已有过渡：`fade`（遮罩，`--dur-2`）、`pop`（账号菜单与 Toast：上移 8px + 缩放 0.98，进场 `--dur-2` `--ease-out`，离场 `--dur-1`）、Sheet 升起、命令面板下落；循环动画只有骨架屏光带、EmptyLane 飞行音符、同步图标旋转。
- `prefers-reduced-motion: reduce`：全局把动画与过渡时长压到 0.001ms、循环次数 1、滚动行为 `auto`。

### 8.4 加载、空、错误的语义

| 形态 | 何时使用 | 文案要求 |
|---|---|---|
| 骨架屏 | 首次进入、结构已知 | 无文字 |
| EmptyLane `loading` | 等待一个操作（同步、读取成绩） | 说明在做什么，必要时提示「不要关闭页面」 |
| EmptyLane `empty` | 没有数据、搜索无结果 | 陈述事实 + 下一步 + 一个操作 |
| EmptyLane `error` | 加载失败、同步失败、离线、找不到歌曲 | 说明已有数据不受影响，给出重试；同步失败另给「查看同步记录」 |
| 404 | 地址无对应页面 | 「打开搜索」与「回到今日」 |
| 无权限 | 需要额外权限（开发者） | 说明如何申请与大致时长 |
| Gate | 需要登录 / 绑定 / 同步 | 见 4.13 |

---

## 9. 无障碍与国际化

### 9.1 焦点与键盘

- 统一焦点样式 `--focus`，只在 `:focus-visible` 出现。
- `Esc` 关闭 Sheet 与命令面板；`Ctrl K` / `⌘K` / `/` 唤起命令面板，↑↓ / `Enter` 移动与打开。
- **浮层焦点管理**（`src/focusTrap.js`，Sheet 与命令面板共用）：打开时焦点进入浮层，`Tab` / `Shift+Tab` 在浮层内循环（可聚焦元素：链接、未禁用的按钮与表单控件、`tabindex` 非 -1 的元素，且可见）；关闭时焦点还给打开它的元素。
- 可点击的表格行 `tabindex="0"` 并响应 `Enter`。

### 9.2 源码中使用的 ARIA

- 导航：`<nav aria-label>`、`aria-current="page"`。
- 账号菜单：`aria-haspopup="menu"`、`aria-expanded`、`role="menu"` / `menuitem`。
- 弹层：`role="dialog"`、`aria-modal="true"`、`aria-label`。
- 实时区域：Toast `role="status"` + `aria-live="polite"`；计算器结果、工具解析结果、通知计数 `aria-live="polite"`。
- 选择：`tablist` / `tab` + `aria-selected`；`radiogroup` / `radio` + `aria-checked`；`aria-pressed`。
- 表格 `aria-sort`；表单 `aria-invalid`、`aria-describedby`、`role="alert"`。
- 图形：王冠、评价、雷达、折线、密度条、谱面图 `role="img"` + `aria-label`；Lane `role="group"` + 每列 `aria-label`；图标、封面、Spark、DrumDial 的 SVG `aria-hidden="true"`；骨架屏容器 `aria-busy="true"`。

### 9.3 图表的文字替代

DrumDial 的数值在插槽文字中；Radar 的 `aria-label` 列出全部轴与数值，图上也印出数值与量程；LineChart 有 `label` 或自动的首末值概括，悬停读数框给出精确值；Spark 只作为旁边数字的补充。

### 9.4 中日文字形与文本扩展

- `store.js` 把 `<html lang>` 设为 `zh-CN` 或 `ja`；`:lang(ja)` 下 `--font-ui` 与 `--font-num` 切换为日文字体栈；`[lang='ja']` 元素在中文界面里也用日文字形，`[lang='zh-CN']` 元素用简体字形。「直、骨、角」等汉字在中日文中写法不同。
- 另一种语言的曲名都标注 `lang`（5.7），封面字形固定 `lang="ja"`。
- 日文标签通常更长（「ゲームミュージック」「アカウント連携」「コミュニティ」）：曲名与列表标题单行截断；按钮、Chip、分段、页签不换行；手机二级页签行与区块标题旁的控件组横向滚动；难度缩写两种语言都是单字。

### 9.5 主题模式

- 跟随系统 / 浅色 / 深色。`store.js` 把「跟随系统」通过 `matchMedia('(prefers-color-scheme: dark)')` 解析后写入 `<html data-theme>`，并监听系统变化；左轨与命令面板中的切换在浅色与深色间直接切换。
- `:root` 默认是浅色，深色只通过 `data-theme='dark'` 生效；生产实现需在首屏脚本前写入 `data-theme`，避免深色用户看到浅色闪烁。
- 谱面带（`--lane`）在两种主题下都是深色带。

---

## 10. 与现有实现的映射

现有实现指 `taiko_viewer/assets/css/tokens.css` 与 `main.css`。

| 现有 | Design V1 |
|---|---|
| `--viewer-bg` `#eaf6f5`（青绿调） | `--bg` `#f3f5f8`（藍调冷白） |
| `--viewer-surface` / `-subtle` / `-hover` | `--surface` / `--bg-sunk` / `--surface-2` |
| `--viewer-text` / `-muted` / `-disabled` | `--ink` / `--ink-2` / `--ink-3` |
| `--viewer-border` / `--viewer-control-border` | `--line` / `--line-strong` |
| `--viewer-primary` `#bd352f` / `-hover` / `--viewer-on-primary` | `--don-solid`（按钮填充）/ 混色悬停 / `--ink-on-solid`；图形与指示用 `--don`，文字用 `--don-ink` |
| `--viewer-primary-surface` | `--don-wash` |
| `--viewer-link` `#006c76` | `--ka-ink` `#0b6f82` |
| `--viewer-selected` | 无直接对应：选中态用 `--ink` 填充（Chip、左轨）或 `--surface` 浮起（分段） |
| `--viewer-success` / `-surface` | `--ok` / `--ok-wash` |
| `--viewer-warning` / `-surface` | `--warn` / `--roll-wash` |
| `--viewer-error` / `-surface` | `--danger` / （V1 无 `--danger-wash`，`.btn-danger` 悬停借用 `--don-wash`） |
| `--viewer-info` / `-surface` | `--ka` / `--ka-wash` |
| `--viewer-overlay` / `--viewer-shadow` | `--scrim` / `--shadow-pop`、`--shadow-lift`（只用于浮层） |
| `--viewer-tooltip-bg` / `-text` | 读数框 `--ink` / `--bg`；Toast `--lane` / `--lane-ink` |
| `--viewer-difficulty-easy / normal / hard / oni / edit`（红 / 黄褐 / 绿 / 紫 / 灰） | `--diff-easy / normal / hard / oni / ura`（橙红 / 绿 / 蓝 / 粉 / 紫）。**色相整体改变**，`edit` 对应 `ura` |
| `--viewer-constant-comprehensive` / `-star` | 无对应：定数是 Diff 中性色的第三段 |
| `--viewer-guide-*`（7 档难易底色） | V1 `tokens.css` 无对应 |
| `--viewer-radius` 14px 单一圆角；Element Plus 8 / 6px | `--r-xs` 6 / `--r-ctl` 8 / `--r-panel` 14 / `--r-lg` 18 / `--r-sheet` 22 / `--r-note` 999 |
| `--viewer-space-group` 32 / `-item` 12 | `--sp-8` / `--sp-3`（完整 4px 刻度） |
| `--viewer-content-standard` 1000 / `-wide` 1180 / `-reading` 800 | `--content-max` 1480；阅读栏 760px（帖子详情） |
| `--viewer-page-gutter` `clamp(24px, 3vw, 48px)`，≤960 为 20px | `--gutter` 28px，≤767 为 16px |
| 断点 960px，外加约 98 个文件中约 150 处 `max-width` 自定义断点 | 767 / 1099 / 1239（/ 1240）四档 |
| 248px 侧边栏 + 手机抽屉菜单 | 84px 窄轨 + 顶栏页签；手机五格底栏 |
| 系统字体栈，正文 15px | 自托管 Noto Sans SC / JP + Barlow / Barlow Condensed，正文 14px，数字专用 `--font-num` |
| `:focus-visible` 3px `--viewer-link` outline，偏移 3px | `box-shadow: var(--focus)` |
| `.shimmer-card` 1.8s | `.sk` 1.4s |
| 王冠、评价为文字（如 `AccountSongScores.vue` 的 `crownLabel`） | Crown / Rank：形状 + 颜色 + 字形 + `aria-label` |
| Element Plus 变量从 `--viewer-*` 重映射 | 从 Semantic 层映射（下方提案） |
| 三种图表实现：ECharts（后台）、手写 SVG、服务端 PNG 工具页 | 前台统一为 V1 SVG 图表组件（6.8） |

### Element Plus 变量映射（提案，未实施）

以下片段只是迁移提案，尚未在任何工程中实施。深色主题不需要另写一份，Semantic token 本身随 `data-theme` 切换。

```css
/* 提案：Element Plus 变量从 Design V1 Semantic 层映射（未实施） */
html:root {
  --el-color-primary: var(--don-solid);
  --el-color-primary-dark-2: color-mix(in srgb, var(--don-solid) 88%, var(--lane-outline));
  --el-color-primary-light-3: color-mix(in srgb, var(--don-solid) 70%, var(--surface));
  --el-color-primary-light-5: color-mix(in srgb, var(--don-solid) 50%, var(--surface));
  --el-color-primary-light-7: color-mix(in srgb, var(--don-solid) 25%, var(--surface));
  --el-color-primary-light-8: color-mix(in srgb, var(--don-solid) 15%, var(--surface));
  --el-color-primary-light-9: var(--don-wash);
  --el-color-white: var(--ink-on-solid);
  --el-color-success: var(--ok);
  --el-color-success-light-9: var(--ok-wash);
  --el-color-warning: var(--warn);
  --el-color-warning-light-9: var(--roll-wash);
  --el-color-danger: var(--danger);
  --el-color-error: var(--danger);
  --el-color-info: var(--ka-ink);
  --el-color-info-light-9: var(--ka-wash);
  --el-bg-color: var(--surface);
  --el-bg-color-page: var(--bg);
  --el-bg-color-overlay: var(--surface);
  --el-fill-color-blank: var(--surface);
  --el-fill-color: var(--bg-sunk);
  --el-fill-color-light: var(--surface-2);
  --el-text-color-primary: var(--ink);
  --el-text-color-regular: var(--ink);
  --el-text-color-secondary: var(--ink-2);
  --el-text-color-placeholder: var(--ink-3);
  --el-text-color-disabled: var(--ink-3);
  --el-border-color: var(--line-strong);
  --el-border-color-light: var(--line);
  --el-border-color-lighter: var(--line);
  --el-border-radius-small: var(--r-xs);
  --el-border-radius-base: var(--r-ctl);
  --el-border-radius-round: var(--r-note);
  --el-box-shadow: var(--shadow-pop);
  --el-box-shadow-light: var(--shadow-lift);
  --el-mask-color: var(--scrim);
  --el-font-family: var(--font-ui);
  --el-font-size-base: var(--fs-14);
}
```

注意事项：

- Element Plus 的危险按钮默认是实色填充。为符合 4.1「靠形式区分」的规则，迁移时破坏性按钮应使用 `plain`（描边）形态。
- 现有 `main.css` 把 `.el-button` 与输入框最小高度设为 44px；在 V1 中这只应在手机断点下生效（桌面按钮 38px、输入框 40px）。

---

## 已知未解决

以下与本规范不一致之处在源码中仍然存在：

1. **页面仍直接引用 Primitive 或十六进制色**：`Account.vue`（`--ai-0`、`--ai-900`）、`Growth.vue`（`--ai-950`）、`Play.vue` 与 `Recommend.vue`（`#fff`、`--ai-900`）、`Progress.vue`（`--ai-900`、`--ai-300`）、`Sync.vue`（`--ai-0`）、`SongDetail.vue`（`--ai-950`、`#fff`）。组件与三份全局样式表已清理。
2. **游戏语义写在页面里**：`SongDetail.vue` 的难度切换条（`.dtab`）在 scoped 样式中重新声明了五个难度色，建议收进 `domain.css`。
3. **未 token 化的圆角**：封面 6 / 8 / 10 / 14px（`domain.css`）、命令面板图标格 8px（应为 `--r-ctl`）。
4. **谱面带 token 被借用到谱面带之外**：`--lane-ring`、`--lane-outline` 被 `.note`、封面、「咚」键、`.btn-primary` 悬停、分段控件阴影使用，Toast 与原型按钮使用 `--lane` / `--lane-ink`。取值没有问题，但命名与用途不符，建议补充中性的 `--on-color` / `--outline` 类 token。
5. **`tokens.css` 注释过时**：`--ease-hit` 注释仍写「只用于确认 / 达成」（与 2.9 规则不同）；`--rank-kiwami` 注释写「配虹边」，实际外环是金色 `--rank-kiwami-ring`；`--rank-miyabi2` 注释写「桜雅」，数据中为「粉雅 / 桃雅」。
6. **无障碍**：命令面板结果列表没有 `listbox` / `option` 语义与 `aria-activedescendant`；账号菜单只在鼠标移出或点击时关闭，缺少 `Esc` 与方向键；GoalCard 尝试轨迹的 `aria-label` 在无角色的 `div` 上不会被读出；`ChartSheet`（「谱面图」）与 `DensityStrip`（「每小节音符密度」）的 `aria-label` 写死为中文。
7. **手机触控尺寸**：`.btn-sm`、分段内钮 36px，`.chip` 34px，低于 44px。
8. **缺失值两种横线**：星级点用「–」，定数与成绩用「—」。
9. **未 token 化的布局值**：手机顶栏 52px；定数表另有 `max-width: 1439px` 断点。
10. **无首屏主题**：`index.html` 没有在脚本执行前写入 `data-theme`，深色用户会先看到浅色。
