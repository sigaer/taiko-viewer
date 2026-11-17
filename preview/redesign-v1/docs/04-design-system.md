# 04 · Design System V1.3

| 项 | 值 |
|---|---|
| 版本 | V1.3 Final（C+：真实游戏素材 + Viewer Teal）。Design Freeze Candidate，待批准 |
| 日期 | 2026-11-16 |
| 依据 | `19-v1.3-phase-b-decisions.md`（G0–G13 与 D1–D14），`15-v1.3-brand-system.md`、`16-v1.3-component-specs.md`（19 改过的地方以 19 为准） |
| 活样张 | `/#/review/system`（`src/views/review/System.vue`），素材页 `/#/review/assets` |
| 验收 | `21-v1.3-visual-acceptance.md`；完成记录 `20-v1.3-phase-b-completion.md`；风险与集成清单 `12-risks-and-integration-acceptance.md` |
| 历史版本 | V1.2 的规范原文在提交 `cb8fb5aa` 的本文件里；Phase A 的三版本对照在 `10d069b4` |

本文是原型默认状态（C+）的现行规范。所有数值取自原型源码；**源码与本文不一致时以源码为准**。

| 源码 | 内容 |
|---|---|
| `src/styles/tokens.css` | Primitive → Semantic → Brand → Role → Domain |
| `src/styles/base.css` | 重置、排版、基础控件、角色 token 的使用 |
| `src/styles/domain.css` | 游戏语义视觉与真实素材组件的样式（`.adiff`、`.acrown`、`.arank`、`.cover.acov` 等） |
| `src/components/{Cover,Diff,Crown,Rank,TitlePlate,PlayerAvatar,DanBadge}.vue` | 六个真实素材组件与段位徽章 |
| `src/components/gamemap.js`、`smallasset.js`、`lazy.js` | 业务值 → 素材文件、小尺寸素材选图、曲绘懒加载 |
| `src/mock/titles.js`、`src/mock/real.js` | 称号牌清单、真实曲目与曲绘白名单 |
| `public/game/` | 素材目录（来源与 md5 见 `public/game/README.md`，缺失清单见 `MISSING.md`） |
| `src/styles/contrast-check.mjs`、`src/assets.test.mjs` | 对比度检查、素材映射测试 |

本文只写 V1.3 改动或新增的规则。**没有提到的部分沿用 V1.2**：信息架构、页面布局、断点、外壳与底部空间约定、控件尺寸、浮层结构、同步状态机、搜索与路由状态、无障碍与减少动效的规则，见第 11 节的对照表。

---

## 1. 原则

1. **中性做主体。** 背景、表面、文字、分隔线占一屏的绝大部分。真实曲绘与素材本身颜色丰富，界面不再加高饱和底色。
2. **品牌青绿只表示交互。** 主按钮、链接、选中、焦点、导航选中、单一序列的图表、标志鼓缘。
3. **音符色只表示游戏数据。** 咚、咔、连打、判定、难度、王冠、评价的颜色只出现在数据上，不表示按钮、链接、选中或焦点。
4. **数据靠排版突出，不靠红色。** 主数字的层级由字号、字重、位置建立。
5. **真实素材原样使用。** 不重绘、不裁切、不改色；不用滤镜、混合模式、遮罩或透明度改变素材颜色；只做等比缩小。
6. **没有可靠数据就不画。** 段位、稀有度这类在正式站查不到来源的东西不显示，不用虚构的数据或随机图形补位。

V1.2 的「一条谱面讲完一段时间」「平面与细线，阴影只属于浮层」「查询永远一步可达」不变。

---

## 2. Token

### 2.1 层级

| 层 | 内容 | 谁可以引用 |
|---|---|---|
| Primitive | 藍 `--ai-*`、朱 `--shu-*`、浅葱 `--asagi-*`、山吹 `--yamabuki-*` | 只有 `tokens.css` |
| Semantic | 背景、表面、线、文字、状态、音符、谱面带、舞台面、阴影 | 组件、页面、`base.css`、`domain.css` |
| Brand | `--brand-primary / -hover / -soft / -on-primary / -focus` | 只有 Role 层与标志 |
| Role | 交互角色：按钮、链接、选中、导航、焦点、浮层、图表序列、标签等 | 组件、页面 |
| Domain | 判定、难度、王冠、评价、流派、版块、称号文字 | `domain.css` 与业务组件 |

- 组件表达「按钮 / 链接 / 选中 / 导航 / 焦点 / 信息」时只引用 Role token。
- `--don*`、`--ka*`、`--roll*`、`--diff-*`、`--crown-*`、`--rank-*`、`--judge-*` 只用于游戏数据。
- 组件与页面不引用 Primitive，不写十六进制色。例外：`tokens.css`、`index.html` 的首屏底色、`public/favicon.svg`、历史方向稿 `/review/directions`。
- Role token 在 `:root` 与 `.stage` 上各声明一次，因为舞台面在局部重映射了 Semantic token。

### 2.2 品牌 token（`data-brand="teal"`）

| Token | 浅色 | 深色 | 用途 |
|---|---|---|---|
| `--brand-primary` | `#006c76` | `#86d9dc` | 主按钮底、链接、选中指示、导航选中 |
| `--brand-hover` | `#005860` | `#a0e3e5` | 悬停与按下 |
| `--brand-soft` | `#d7ece9` | `#2a565a` | 选中的筛选、提示条、标签浅底 |
| `--brand-on-primary` | `#ffffff` | `#0b2a2d` | 品牌实色上的文字与图标 |
| `--brand-focus` | `#006c76` | `#86d9dc` | 焦点环 |

舞台面（`.stage`，两种主题里都是深青）上，品牌 token 一律取深色值；其中 `--brand-soft` 为 `#244b4e`。

### 2.3 Semantic：浅色与深色

**明度阶梯。** 五级要一眼能分开：下沉 < 页面 < 卡片 < 分区 ≈ 浮层（G1）。

| Token | 浅色 | 深色 | 用途 |
|---|---|---|---|
| `--bg-sunk` | `#def0ee` | `#081619` | 下沉区、谱面带、浮层里的选中行 |
| `--bg` | `#eaf6f5` | `#0c2023` | 页面 |
| `--surface` | `#f9fdfc` | `#1a383d` | 卡片、面板 |
| `--surface-2` | `#f2f9f8` | `#234a50` | 表面上的分区、表头、悬停行 |
| `--overlay-bg` | 等于 `--surface` | `#265056` | 对话框、抽屉、搜索面板、菜单、Popover、Toast |
| `--line` | `#ccdfdc` | `#2f5257` | 分隔线、卡片外框 |
| `--line-strong` | `#b4cecb` | `#447378` | 强分隔、浮层外框、密度图普通柱 |
| `--ink` | `#203f43` | `#e4f4f1` | 主要文字、主数字 |
| `--ink-2` | `#3d5a5e` | `#accbca` | 次要文字、辅助数字、下降量 |
| `--ink-3` | `#4d696c` | `#a3c0c0` | 弱文字（在 `--bg-sunk`、`--surface-2`、`--overlay-bg` 上 ≥ 4.5:1） |
| `--ctl-border` | `#6e8c8e` | `#779fa1` | 输入类控件边框（在浮层上 ≥ 3:1） |
| `--ok` / `--ok-wash` | `#26724e` / `#e4f3ea` | 沿用 V1.2：`#4ccb8a` / `#153527` | 成功、上升 |
| `--toast-bg` / `--toast-ink` | `#24494d` / `#f1fbf9` | `#31565b` / `#f1fbf9` | 只在历史版本使用；C+ 的 Toast 走 `--toast-surface` |
| `--lane` / `--lane-line` | `#17353a` / `#2f5257` | `#081619` / `#2f5257` | 谱面带底与轨线 |
| `--ink-inv` | 沿用 V1.2 | `#10282b` | 反色文字 |
| `--shadow-pop` | `0 18px 50px -12px rgb(22 43 48 / .28), 0 2px 6px rgb(22 43 48 / .08)` | `0 24px 60px -12px rgb(0 0 0 / .6), 0 0 0 1px #3d6165` | 浮层阴影 |
| `--shadow-lift` | `0 6px 18px -8px rgb(22 43 48 / .22)` | 沿用 V1.2 | 浮动按钮 |
| `--scrim` | `rgb(15 27 33 / .46)` | `rgb(5 14 16 / .62)` | 遮罩 |

- 浅色下浮层与卡片同底，靠阴影与 1px `--line-strong` 外框（`--overlay-line`，用阴影画，不占版面）分开。
- 卡片在两种主题下都有 1px `--line` 外框。
- `--warn`、`--danger`、`--danger-wash`、`--status-*` 沿用 V1.2 的值。

**舞台面（两种主题相同）**

| Token | 值 |
|---|---|
| `--stage-bg` / `--stage-sunk` / `--stage-surface` | `#1d3d42` / `#17353a` / `#27494e` |
| `--stage-ink` / `-ink-2` / `-ink-3` | `#e4f4f1` / `#c0dad8` / `#a3c2c1` |
| `--stage-line` / `-line-strong` / `-ctl-border` | `#3a5d62` / `#4d7277` / `#82a8aa` |
| `--stage-focus` | `#86d9dc` |
| `--stage-ka` / `-ka-ink` / `-ka-wash` | `#5cc4ef` / `#8ad4f4` / `#16344a` |

### 2.4 Role token（C+ 的取值）

| Token | C+ | 用途 |
|---|---|---|
| `--action-bg` / `-bg-hover` / `-ink` | `--brand-primary` / `--brand-hover` / `--brand-on-primary` | 主按钮 |
| `--btn-ink-bg` / `-line` / `-ink` / `-hover` | 同主按钮 | `.btn-ink` 在 C+ 也是品牌实色；同一区域已有主按钮时加 `.c-secondary` 降级 |
| `--link` | `--brand-primary` | 链接 |
| `--selected-bg` / `-ink` / `-line` | `--brand-soft` / `--brand-primary` / `--brand-primary` | 选中的筛选胶囊、列表项、开关、目录 |
| `--seg-on-bg` / `-ink` / `-ring` | `--brand-soft` / `--brand-primary` / `--brand-primary` | 分段控件选中项 |
| `--tab-line` | `--brand-primary` | 页签指示线 |
| `--nav-active-bg` / `-ink` / `-text` | `--brand-primary` / `--brand-on-primary` / `--brand-primary` | 窄轨选中胶囊、底栏选中文字 |
| `--focus-ring`、`--focus` | `--brand-focus`；`--focus` 为 2px `--focus-gap` + 2px `--brand-focus` | 焦点环 |
| `--input-focus-line` | `--brand-primary` | 搜索框等聚焦边框 |
| `--info-wash` / `-ink` / `-line` | `--brand-soft` / `--brand-primary` / `--brand-primary` | 提示条、进行中的步骤 |
| `--brand-mark` | `--brand-primary` | 标志鼓缘 |
| `--accent` | `--brand-primary` | 复选框 `accent-color`、正文列表圆点 |
| `--selection` | 品牌色 30% 透明 | 文字选区 |
| `--overlay-bg` / `--overlay-line` / `--popover-line` | 见 2.3 / `--line-strong` / `--line-strong` | 浮层 |
| `--toast-surface` / `--toast-text` | `--overlay-bg` / `--ink` | Toast（浮层一级，不再是深色条） |
| `--row-sel-bg` / `--row-sel-line` | 品牌色 12% 混 `--surface` / `--brand-primary` | 选中或定位的表格行、选项、拖放区（行内有 `--ink-3` 文字，`--brand-soft` 在深色下只有 4.21:1） |
| `--unread-wash` | `--brand-soft` | 未读通知行首条 |
| `--role-mod-bg` / `-ink`、`--role-admin-bg` / `-ink` | `--brand-soft` / `--brand-primary`（两者相同） | 版主、站务身份标签 |
| `--tag-don-bg` / `-ink`、`--tag-info-bg` / `-ink` | `--bg-sunk` / `--ink-2` | 标签默认中性 |
| `--warn-wash` | `--roll-wash`（两种品牌相同） | 警告浅底，字用 `--warn` |
| `--lock-ink` | `--ink-2` | 已锁定的成绩 |
| `--emph-num` | `--ink` | 主数字（不再用朱色） |
| `--series` / `--series-alt` / `--series-fill` | `--brand-primary` / `--brand-primary` / 12% | 单一序列图表 |
| `--series-focus` / `-focus-ink` | `--ink` / `--ink` | 雷达上的「当前重点」维度 |
| `--series-band-bg` / `-line` / `-cur` | 品牌色 10% 混表面 / 45% 透明 / 22% 混表面 | 图表上的区间带 |
| `--chart-mark` | `--ink-2` | 图表事件标注的引导线 |
| `--progress-line` | `--brand-primary` | 步骤条已完成的连线 |
| `--annual-wash` / `-ink` | `--brand-soft` / `--brand-primary` | 年度回顾入口卡片 |
| `--vote-on` / `-wash` / `-ink` | `--brand-primary` / `--brand-soft` / `--brand-primary` | 「有帮助」按下态 |
| `--don-data` | 浅 `#e58572`，深 `#e8806c` | 图表里成片的朱色（见 3） |
| `--density-bar` | `--line-strong` | 密度图普通小节 |
| `--judge-h` | 6px | 成绩判定条高度 |

### 2.5 Domain token（C+ 与 V1.2 不同的部分）

| Token | C+ | 说明 |
|---|---|---|
| `--ka` / `--ka-ink` / `--ka-wash` | 浅 `#2b9bcf` / `#0f6a96` / `#ddeff8`；深 `#5cc4ef` / `#8ad4f4` / `#16344a` | 咔向蓝偏移，与品牌青绿分开（D1） |
| `--lane-ka` / `--lane-focus` | `#56c1ee` / `#86d9dc` | 谱面带上的咔与焦点 |
| `--judge-good` | `var(--don-data)` | 判定条「良」段是成片的朱色 |
| `--section-*` | 全部 `var(--ink-3)` | 版块色点中性，版块靠名称区分 |
| `--diff-*-ink`（深色） | easy `#ff8a69`、hard `#75b7ed`、oni `#ff7fb7`、ura `#d0befb`；normal 沿用 | 在深青表面的 14% 浅底上 ≥ 4.5:1 |
| `--rank-*-ink`（深色） | iki1 `#a8adba`、iki2 `#d19c72`、iki3 `#a4b1c6`、miyabi1 `#e6a500`、miyabi2 `#ef89ad`、miyabi3 `#b98ffc` | 同上 |
| `--rank-iki2-ink` / `--crown-fc-ink` / `--rank-miyabi1-ink`（浅色） | `#955922` / `#925b00` / `#925d00` | 在青绿浅底上调暗留余量 |
| `--plate-ink` / `--plate-ink-outline` | `#2b1d14` / `#ffffff`（两种主题相同） | 称号牌面上的文字（游戏里的写法） |
| `--site-title-bar` | 七色线性渐变 | 站内称号左侧的竖条 |

`--don`、`--roll`、`--diff-*`、`--crown-*`、`--rank-*`（图形色）、`--genre-*` 沿用 V1.2。`--diff-*` 与 `--crown-*` 仍用于没有图标的地方：点灯格、图表。

### 2.6 不变的 token

排版（`--font-*`、`--fs-*`、`--lh-*`）、间距（`--sp-*`）、圆角（`--r-*`）、布局（`--rail-w`、`--bar-h`、`--bar-h-m`、`--subtab-h-m`、`--tab-h`、`--content-max`、`--gutter`、`--shell-bottom`、`--dock-h`、`--kb-h`）、动效（`--dur-*`、`--ease-*`）、层级（`--z-*`）、控件（`--hit`、`--ctl-*`、`--btn-pad-x*`、`--tag-*`、`--plate-h`）、浮层（`--overlay-radius/-pad/-pad-sm/-shadow`）与 V1.2 相同。

---

## 3. 颜色规则

| 颜色 | 用于 | 不用于 |
|---|---|---|
| 品牌青绿 | 一级导航选中；主按钮；链接；选中的筛选、分段、页签指示线；输入框焦点与焦点环；单一序列图表（Rating 走势线、雷达描边与 12% 填充、Rating 圆环）；标志鼓缘 | 游戏数据 |
| 中性 | 背景、表面、文字、分隔线；默认标签；版块色点；次要按钮 | — |
| 咚（朱，`--don`） | 音符、图例圆点、新纪录 / 新全连 / 新全良行首的音符点、通知角标与未读点、手机底栏的「咚」键、段位合格的红点、标志鼓面 | 按钮、链接、选中、Rating 等大数字、下降量 |
| 柔化朱（`--don-data`） | 图表里成片的朱色：密度图的难点柱、判定条「良」段、雷达与折线里的朱色填充 | 小图形（小图形用 `--don` 原色） |
| 咔（偏蓝） | 只以音符形状出现（圆形、白环、深色轮廓） | 文字、链接、按钮、选中 |
| 连打（山吹） | 谱面带的连打条、里程碑音符、「精华」标签浅底、警告浅底 | 交互 |
| 难度、王冠、评价 | 由真实素材自己带颜色，容器中性；`--diff-*` / `--crown-*` 只给点灯格与图表 | 交互 |
| 状态 | 成功、警告、危险各一种；破坏性按钮是危险色描边 | — |

多序列图表：品牌色加中性色，第三个序列才用别的颜色。表示游戏数据的序列（判定、音符类型、王冠分布）用各自的语义色，大面积时用柔化色。

**验收口径（G3）。** 歌曲详情首屏里，朱色带的面积不超过品牌色带的 60%。统计时排除曲绘与头像矩形。16 个状态里 15 个达标；歌曲详情浅色 1440 是 0.70，裁定接受为已知未达标（剩下的主要是谱面图里的音符，不动）。

---

## 4. 数字层级（G2）

| 对象 | 规则 |
|---|---|
| 卡片的主数字（Rating、最好成绩、Rating 表合计） | `--emph-num`（= `--ink`），数字字体，700，这张卡片里最大的一档；同卡其他数字至少小两档 |
| 辅助数字（上限、百分比、次数） | `--ink-2`，500 |
| 变化量 | 上升 `.up`：`--ok` + ▲；下降 `.down`：`--ink-2` + ▼。不用红色表示下降。箭头对读屏隐藏 |
| 新纪录、新全连、新全良 | 行首一个咚色音符点，标题加粗；只有点是朱色 |
| Rating 圆环 | 环为品牌色，环内数字 `--ink`，`--fs-48`，首页第一屏最大的数字；圆环 168px（Phase A 150px），卡片外尺寸不变 |

- 今日页首屏阅读顺序：一句话摘要 → Rating → 这次想练 → 最近 21 天。
- 歌曲详情「我的成绩」：最好成绩是卡片里唯一的最大字号；王冠、评价在它上方一行，尺寸不超过数字高度。
- 个人主页数字区：数字在同一基线上。

---

## 5. 按钮、选中与浮层

- **按钮三级。** 主按钮（品牌实色）、次要按钮（中性描边）、文字按钮。**一个区域只有一个主按钮。** `.btn-primary` 与 `.btn-ink` 在 C+ 都是品牌实色；同一区域两者并存时，给其中一个加 `.c-secondary`：`--surface` 底、`--ctl-border` 边、`--ink` 字，悬停 `--bg-sunk`。
- **歌曲详情。** 主按钮是「设为这次想练」（手机「想练这首」）；页头与手机操作条里的「游玩练习」都是次要按钮。
- **选中态。** 卡片与页面上：`--selected-*`、`--row-sel-*`。浮层底（`--overlay-bg`）上的选中行用下沉一级 `--bg-sunk`（例如搜索面板的当前项），因为 `--brand-soft` 在浮层底上分不出来。
- **浮层。** 对话框、抽屉、搜索面板、菜单、Popover、Toast 都用 `--overlay-bg` 加 `--overlay-line` 外框；结构、尺寸、焦点规则沿用 V1.2。
- **自查清单（G10）。** 有没有两个实色按钮并排；有没有红色的非数据元素；有没有只靠颜色区分的状态；深色下卡片与页面是否分得开。

---

## 6. 主题、首屏与对比度

- 两个根元素属性：`data-assets="authentic"`、`data-brand="teal"`。默认即 C+。
- `index.html` 的首屏脚本在样式加载前写入 `data-theme`、`data-assets`、`data-brand`；版本选择的读取顺序为：地址 `?variant=`，其次本地设置（只认带 `variantRev: 'phase-b'` 的记录），否则 `c`。深色首屏不先闪浅色或藍墨。
- **对比度规则**沿用 V1.2：正文与小字 ≥ 4.5:1，大字与非文字元素 ≥ 3:1，深浅两种主题都要满足。
- **对比度脚本** `node src/styles/contrast-check.mjs`：当前 630 项全部达标，覆盖 fumen 与 teal 的浅、深四套。不达标时只在同一色相内调明度。
- 真实素材不调色：银色王冠的黑描边在深色下看不见，这是素材本身的样子，不处理。

---

## 7. 真实素材组件

### 7.1 素材进入原型的规则

- 图标类从正式站 `origin/main`（`f9b39e6`）的 `taiko_viewer/public/` 原样复制到 `public/game/`，逐字节相同。来源路径与 md5 记在 `public/game/README.md`，由 `src/assets.test.mjs` 核对。
- 曲绘不复制，运行时从 `static.sakura-bot.cn` 加载，只限白名单曲目。
- 难度图标统一用正式站的 `icons/diff/1–5.png`（D6）。
- 每张图都有固定宽高，加载前后不改变布局。

`public/game/` 共 80 个文件：
- 原样复制 31 个：难度 5、王冠 3、评价 7（2–8）、称号牌 12、牌面清单 1、头像 2、完整标志 1；
- 小尺寸素材 46 个；
- `README.md`、`MISSING.md`、`small-assets.json` 各 1 个。

### 7.2 小尺寸素材（G5、D10）

| 素材 | 尺寸目录 | 对应绘制尺寸 | 格式 |
|---|---|---|---|
| 评价 `rank/{2–8}` | 56、80 | 28、40 的 2× | WebP（带透明通道，有损 0.92）+ 同尺寸 PNG 回退 |
| 王冠 `crown/{clear,full,dondaful}` | 36、60、96 | 18、30、48 的 2× | 同上 |

- 只做等比缩小，原图保留在 `public/game/{rank,crown}/`。难度图标（6–7 KB）不做缩小版。
- 生成脚本 `qa/tools/gen-small-assets.mjs`（系统 Chrome 的 canvas，逐级减半、高质量重采样），可重复运行；前后字节数在 `public/game/small-assets.json`。
- 组件用 `<picture>`：WebP 与 PNG 各一组 `srcset`（1× / 2×）；`smallSrc(dir, name, draw)` 取不小于绘制尺寸的档位作 1×，不小于两倍绘制尺寸的档位作 2×。

### 7.3 Cover 曲绘

| 项 | 规则 |
|---|---|
| 谁请求图片 | 只有白名单曲目（`song.coverOk`：非生成曲，且曲号与曲名在正式站测试数据里对得上，`src/mock/real.js`） |
| 加载顺序 | 缩略图 `cover/thumb/{200\|400}/{id}.webp?v=0841`（`srcset` 200w / 400w，`sizes` 为实际显示宽度）→ 原图 `cover/{id}.png` → 缺失占位 |
| 不做的事 | 不使用正式站的 `fallbackSongId`（1384）：不把另一首歌的曲绘显示在当前歌曲上（D5） |
| 懒加载 | 全站一个 `IntersectionObserver`，进入视口前 320px 开始；`priority`（歌曲详情主封面）立即加载；换歌先回到底色 |
| 外观 | 尺寸与圆角阶梯沿用 V1.2（32 / 44 / 72 / 96 / 168 / 撑满）；`object-fit: cover`；加载前 `--bg-sunk`；1px `--line` 内描边；图片 120ms 淡入，减少动效时不淡入 |
| 缺失占位 | 真实曲目加载失败：`--bg-sunk` 底、`--ink-3` 音符图标，名称「没有曲绘」 |
| 示例占位 | 生成曲与未验证曲目：同上，加 45° 细斜纹（`--line`），≥ 96px 时写「示例」，名称「示例曲目」 |

两种占位都不用流派色、曲名首字或随机色。确实缺图的 6 首见 `public/game/MISSING.md`。

### 7.4 Diff 难度

- `game/diff/{1–5}.png` 依次为简单、普通、困难、魔王、魔王（里）。原图宽高比不统一（94×78 到 86×86），放进正方形框里 `object-fit: contain`，不拉伸。
- **徽章（`.adiff`）**：图标 + ★星级 + 定数。
  - 容器：`--surface` 底、1px `--line`、`--r-xs`，高 22px（`lg` 28px）。
  - 图标框 18px（`lg` 22px）。
  - 星级 `--ink` 加粗；定数 `--ink-2`，没有定数时显示 `--ink-3` 的「—」。
  - 里魔王与魔王图标形状相同，图标后加「里 / 裏」。
  - 徽章里不写难度单字；可访问名称读完整的难度名、星级与定数。
- **难度页签（歌曲详情）**：图标 26px + 难度名 + ★星级 + 定数。
  - 未选中：`--surface` 底、1.5px `--line`。
  - 选中：2px `--selected-line`、`--selected-bg` 浅底、文字加粗、底部 2px 指示线、`aria-selected`。选中不靠图标颜色表示。
  - 手机上未选中项显示单字短标（C5）；难度条横滑，两端渐隐，当前难度滚入可视区。
- `--diff-*` 只用于点灯格与图表。

### 7.5 Crown 王冠

**换算规则（正式站 `AccountSongScores.vue`，原型 `gamemap.js` 的 `crownFromCounts`）：** 全良次数 > 0 → 全良；否则全连次数 > 0 → 全连；否则通关次数 > 0 → 通关；有记录但三项都为 0 → 已游玩；没有记录 → 未游玩。

| 状态 | 画法 | 可访问名称 |
|---|---|---|
| 全良 / 全连 / 通关 | `crown/{dondaful,full,clear}`，正方形框，不加底板或色圈 | 全良 / 全连 / 通关 |
| 已游玩 | 8px 空心圆环，1.5px `--ink-3` | 已游玩 |
| 未游玩 | 「—」 | 未游玩 |

- 尺寸：筛选胶囊 16，密集表格 `table` 与 `sm` 18，默认 22，歌曲详情成绩区 `lg` 30，达成时刻 `xl` 48（px）。
- 不画灰色王冠表示「没拿到」。点灯格仍是色块（`--crown-*`），图例用真实王冠。
- **已知局限：** 三档王冠形状相同，只有颜色不同（银、金、彩虹）。列表里王冠旁不加文字，靠可访问名称和筛选项里的文字说明。

### 7.6 Rank 评价

| 值 | 名称（中 / 日，与正式站 `scoreRank.ts` 一致） | 画法 |
|---|---|---|
| 0 | 未设置 / 未設定 | 「—」 |
| 1 | 未取得 / 未取得 | 「—」（`rank/1.png` 全透明，不加载） |
| 2 | 白粹 / 白粋 | `rank/2` |
| 3 | 铜粹 / 銅粋 | `rank/3` |
| 4 | 银粹 / 銀粋 | `rank/4` |
| 5 | 金雅 / 金雅 | `rank/5` |
| 6 | 粉雅 / 桃雅 | `rank/6` |
| 7 | 紫雅 / 紫雅 | `rank/7` |
| 8 | 极 / 極 | `rank/8` |

- 值与文件的对应已逐项看图核对，并写成 `src/assets.test.mjs` 的测试。Bot 里选图的函数不在本仓库，正式集成时要再对一次。
- 素材四周有透明边：占位 24px、绘制 28px 居中；歌曲详情成绩区占位 36、绘制 40；小于 24px 的占位不放图，只写评价名。
- **桌面密集表格**：图标 + 评价名（`--ink-2`、`--fs-12`），图对读屏隐藏。
- **手机列表行（`compact`）**：图标占位 20、绘制 24，后跟两字评价名（`--fs-11`、`--ink-2`）。任何宽度下名称都在图标右边；375 宽以下由列表行隐藏判定数（良 / 可 / 不可）让出宽度，判定数在 ≥ 375 与歌曲详情里仍可见。
- **评价升级**：「原 → 新」，原评价 24px，新评价 30px，中间 `--ink-3` 箭头。
- 任何宽度下评价都不只靠颜色区分。

### 7.7 称号

**游戏称号**（`user.gameTitle = { name, plate, custom? }`；`null` 表示没有称号，什么都不显示）
- 牌面由达成类型 × 难度范围决定：清单里 9 张切片（plate 0 / 1 / 2 / 41 / 42 / 43 / 59 / 60 / 61）。自定义称号按通关 / 全连 / 全良用银 / 金 / 虹三张（文件名 `custom_sliver` 照正式站拼写）。共 12 张，定义在 `src/mock/titles.js` 的 `PLATES`。
- 没有明确牌面对应的组合只显示文字，不猜（D13）。
- **宽位置（`form="plate"`）**：个人主页身份带、帖子详情作者区、社区头条作者区。
  - 牌面宽 220px，按原比例算高度。
  - 文字 12px，用 `--plate-ink` 加 `--plate-ink-outline` 描边，压在牌面的文字段里；带角色图的切片在右侧留出图案的位置。
  - 放不下先缩到 10px，还放不下就退回文字形式，完整称号放在 `title` 里。
  - 没有切片时只显示 `--ink-2` 文字。
- **窄位置（`form="text"`）**：今日与「我的」身份行、帖子列表行、回复行、达人榜、搜索结果。只显示 `--ink-3`、`--fs-12` 文字，单行截断。
- 没有「稀有称号」：`rare` 与虚构的稀有集合已删除（G8）。称号页按正式数据里有的两个维度分组：达成类型 × 难度范围。

**站内称号**（`user.siteTitle`，正式站 `AccountTitle`）
- 中性小标签，左侧 3px `--site-title-bar` 彩虹竖条，不套牌面。窄屏下换到牌面下一行。

### 7.8 PlayerAvatar 头像

| 状态 | 画法 |
|---|---|
| 有 `avatarUrl` | 上传的图片，圆形，`object-fit: cover`，1px `--line` 外描边 |
| 没有头像 | 正式站的 `/default-avatar.svg`，原样使用（`public/game/avatar/default-avatar.svg`，501 字节） |
| 图片加载失败 | 退回默认头像 |

- 不生成任何随机的身份图，不按段位给头像着色。模拟玩家都没有 `avatarUrl`，原型不导入真实用户的图片。
- `public/game/avatar/miku.png` 只在素材页作为「有头像」状态的演示。
- 默认头像是橙粉渐变，在列表里很显眼；裁定保留（G6）。

### 7.9 段位徽章与标志

- **DanBadge**：真实素材模式下不渲染（G7、D9）。正式站的论坛与账号数据里查不到段位字段的来源。社区帖子行、帖子作者区、达人榜、个人主页身份带、今日与「我的」身份行、账号页都不显示段位。模拟数据里的 `dan` 字段保留但不渲染；身份行变短，不补别的东西。段位道场页保留。
- **标志**：桌面窄轨与手机顶栏用简化鼓面（鼓缘 `--brand-mark`，鼓面朱色）。登录页品牌区用正式站的完整标志 `optimized/logo-256.webp`（`public/game/brand/logo-256.webp`，原样）。

### 7.10 组件内部因素材而改的排版

- 曲库表格「我的 鬼 / 里」每格 96px（王冠 + 评价图标 + 两字名称），宽度从弹性的歌曲列取；「我的」格与日期列之间每一行至少 12px（最终测得 16px）。
- 成绩页手机行：评价图标四周留 2px，王冠对齐评价图标中心。
- 歌曲详情手机「我的成绩」：王冠与评价在分数上方一行。
- 称号组件允许换行（窄屏下站内称号换到牌面下一行）。
- 难度徽章 `position: relative`，读屏文字不撑出横滑容器。
- 点灯进度图例加入真实王冠与评价图标。

**写法注意。** 在 scoped 样式里不要用 `:global(:root[...]) .x` 这种前缀写法：Vue 只保留 `:global()` 里面的部分，后面的选择器被丢掉，规则落到根元素上。曲库「我的」格宽（R1）与帖子回复框的软键盘规则都因此失效过。需要随根元素属性变化的样式，写在全局样式表里，或在组件里用普通的作用域选择器加根元素属性判断。

---

## 8. 游戏语义（取代 V1.2 第 8 节）

| 语义 | 业务值 | 素材 / token | 组件 | 颜色之外的载体 |
|---|---|---|---|---|
| 难度 | 1–5 | `game/diff/{d}.png`；`--diff-*` 只给点灯格与图表 | `Diff`、难度页签 | 图标形状、「里」字、难度名（页签）、可访问名称 |
| 王冠 | 全良 / 全连 / 通关 / 已游玩 / 未游玩 | `game/crown/{dondaful,full,clear}`；`--crown-*` 给点灯格 | `Crown` | 已游玩是圆环、未游玩是「—」；三档王冠之间只有颜色不同（已知局限） |
| 评价 | 0–8 | `game/rank/{2–8}` | `Rank` | 图上的字（粋 / 雅 / 極）、评价名文字（桌面表格与手机行） |
| 判定 | 良 / 可 / 不可 | `--judge-good`（= `--don-data`）、`--judge-ok`、`--judge-ng`；条高 `--judge-h` 6px | `.judge` + `.judge-legend` | 图例文字与数字 |
| 状态 | 成功 / 警告 / 危险 | `--ok`、`--warn` + `--warn-wash`、`--danger` | 标签、状态点 | 文案 |
| 新纪录 | 新纪录 / 新全连 / 新全良 | `--don` 音符点 | 行首 | 标题文字 |

---

## 9. 其他组件在 V1.3 的变化

| 组件 | 变化 |
|---|---|
| Toast | 底色 `--toast-surface`（= `--overlay-bg`）、字 `--toast-text`，加浮层外框；位置规则不变 |
| DensityStrip | 普通小节 `--density-bar`（= `--line-strong`），难点小节 `--don-data`；尺寸不变 |
| 判定条 | 高 6px，「良」段 `--don-data`；数字仍在条下方 |
| LineChart / Radar / DrumDial | 单序列用 `--series`（品牌色），雷达填充 12%，当前重点维度 `--series-focus`；Rating 圆环 168px |
| Lane / ChartSheet / TimeStack | 音符颜色不动；谱面带底 `--lane`；咔音符为偏蓝的 `--lane-ka` |
| AppShell | 窄轨与底栏选中走 `--nav-active-*`；通知角标与「咚」键保留朱色；顶栏默认头像为 `/default-avatar.svg` |
| CommandPalette | 结果行的曲绘、难度、王冠、评价用真实素材；当前项底色 `--bg-sunk` |
| ThreadRow、FactRow、GoalCard、SongCell | 曲绘与素材组件随上面的规则；目标卡的类型与目标数不再是红字 |
| 年度回顾 | 只统一入口卡片（`--annual-*`）与外围导航，内部不动 |

---

## 10. 素材组件的生产数据来源

| 组件 | 正式站字段 | 说明 |
|---|---|---|
| Cover | `SongCatalogItem.id`（或 `songNo`） | 资源可用性没有字段，靠加载失败回退；不使用 `fallbackSongId` |
| Diff | 难度序号 1–5、`level_{n}`；定数来自 `V2ConstantsItem`（只有 hard / oni / edit） | |
| Crown | `AccountSongScore.clearCnt / fullComboCnt / dondafulComboCnt`，以及有无记录 | 按 7.5 的优先级换算 |
| Rank | `AccountSongScore.bestScoreRank`（0–8） | 文件对应需对照 Bot 的选图函数 |
| TitlePlate | `verifiedTitle` / `verifiedTitleplateId`；「我的小咚」展示称号的 `plateId` / `plateStyle`；站内称号 `ForumUserBadge.titles` | 没有稀有度字段 |
| PlayerAvatar | `ForumUserBadge.avatarUrl` | 正式站服务端的默认头像是 `miku.png`，前端是 `/default-avatar.svg`；V1.3 统一用后者 |
| DanBadge | 无 | 不显示 |

模拟数据与正式字段的完整对照见 `src/mock/data.js` 文件头，差异清单见 `12` 的 A6。

---

## 11. 沿用 V1.2 的部分

以下规则在 V1.3 没有改动，原文见提交 `cb8fb5aa` 的本文件（括号内为当时的章节）：

| 内容 | V1.2 章节 |
|---|---|
| Primitive 色、排版 token、字体与 `lang` 规则、标题截断（含 C6）、缺失值「—」、数字格式 | §2.2、§2.6、§4 |
| 间距、圆角、布局、动效、层级、控件与浮层 token | §2.7–§2.10 |
| 断点 767 / 1099 / 1239；桌面、平板、手机框架；底部空间约定（`--shell-bottom`、`--dock-h`、`--kb-h`）；手机详情页固定条 | §5 |
| 基础控件的尺寸与状态（按钮、输入、分段、页签、胶囊、标签、数据表、横滑表格） | §6（颜色改为 Role token，见本文 2.4） |
| 浮层的结构、尺寸与焦点管理 | §7（底色改为 `--overlay-bg`） |
| 同步状态机与入口；路由状态 `useQueryState`；空 / 加载 / 错误 / Gate；表格列优先级与密度；筛选 | §10 |
| 搜索面板的匹配、键盘与读屏 | §10.2。性能预算改为首键 p95 ≤ 50 ms、热态 p95 ≤ 50 ms（G12，取代 V1.2 的首键 100 ms）。V1.3 的性能在 C+ 上测量；Phase B 前期写过的一组数字实际测的是历史版本 A，已在 `21` §5 更正。C+ 的路由切换中位约 97 ms，比 A 慢约 32 ms（真实素材的挂载与解码） |
| 无障碍：地标、键盘、ARIA、焦点环、触控 44×44 与 F2 的行内链接豁免、减少动效 | §11 |
| 动效原则；模块的视觉表现（V 组） | §12、§13 |

---

## 12. 历史说明：版本 A、B

- 地址 `?variant=a|b|c`（写在 `#` 之前）只对当次加载生效，原型面板里也能切换。默认 `c`（C+）。
- **A**（`data-assets="generated"`、`data-brand="fumen"`）：V1.2 的生成式封面、CSS 王冠与评价、鼓面头像、段位徽章、藍墨与朱色配色。
- **B**（`authentic` + `fumen`）：真实素材，V1.2 配色。
- fumen 下 Role token 解析为 V1.2 的实际值（如 `--action-bg` = `--don-solid`、`--link` = `--ka-ink`、`--selected-bg` = `--ink`、`--emph-num` = `--don-ink`、`--judge-h` 8px、`--overlay-bg` = `--surface`），咔仍是浅葱。
- Phase B 起不再维护和验收 A、B。数据修正（G9）对所有版本生效，所以它们与历史截图不再逐像素一致。要原样复现，用提交 `cb8fb5aa`（V1.2）与 `10d069b4`（Phase A），历史截图在 `qa/screenshots/` 与 `qa/screenshots/v13/`。

---

## 13. 仍未解决 / 未验证

取自 `21` §11–§12，均基于模拟数据：

- **歌曲详情浅色 1440 的朱色比例**是 0.70，按 G3 口径未达到 ≤ 0.60，裁定接受。剩下的主要是谱面图里的音符（规则不动）；柔化色调亮不改变色相统计。
- **默认头像**橙粉渐变是首屏最饱和的元素之一（裁定保留；G3 统计已排除头像）。
- **王冠三档只靠颜色区分**（列表里不加文字）。
- **评价值 ↔ 文件**的对应在 Bot 选图函数里没有核对。
- **WebP 有损压缩**的像素级色差只做了肉眼对照。
- **称号页的获得条件**是关系表原文，中日文混合，不随界面语言切换。
- 真实玩家数据（成绩、称号、上传头像）、真实设备与软键盘、真实网络下的曲绘缓存与延迟都没有验证。
- **软键盘避让很可能没有生效。** `src/views/Thread.vue` 在 scoped 样式里写了 `:global(:root[data-kb]) .composer`，Vue 会把它编译成只剩根元素的选择器，回复框「贴在键盘上方、不叠加安全区」那条规则大概率从 V1.2 起就无效。本轮没有修改；正式实现必须在真机上实现并测试（`12` 的 RK-56）。
- **路由切换比 A 慢约 32 ms**（C+ 中位约 97 ms，A 约 64 ms），仍在 200 ms 预算的一半以内。
- 评审页（`/review/system`、`/review/compare`）的触控目标提示不在产品页。

正式集成阶段的处置见 `12-risks-and-integration-acceptance.md`。
