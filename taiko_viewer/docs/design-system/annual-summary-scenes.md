# 太鼓年度总结场景模板

## 1. 场景结构约定

`AnnualScene` 是语义容器，不是统一卡片壳。页面通过六层插槽组合自己的构图：

```text
AnnualScene
├── BackgroundLayer
├── AtmosphereLayer
├── MainObjectLayer
├── DataFocusLayer
├── CopyLayer
└── TransitionLayer
```

每个场景必须声明 `sceneType`、`mainFocus`、`mood`、`intensity` 和进出场语义。主对象层只容纳一个视觉主角；辅助信息不能通过多个等权容器重新形成卡片网格。

## 2. Hero Scene

### 适用页面

Opening、Profile，以及未来需要人物/身份登场的页面。

### 主视觉焦点

太鼓、玩家形象或其他身份象征。对象应占据画面最主要的视觉面积，并有明确的舞台光源或背景关系。

### 布局规则

- 主对象位于中心或明显偏心焦点，不使用左右两列“文案 + 卡片”模板。
- 标题贴近舞台空间出现，不放在固定通用页头中。
- 身份证据以环绕标签、字幕或短铭牌表达，最多 2 项。
- CTA 最后出现，与主对象形成可理解的动作关系。

### 动效规则

- Opening 使用 `cover-gather` 建立舞台，再以太鼓落点完成标题和 CTA。
- Profile 使用 `profile-spotlight`，由暗到明揭示玩家形象，再显示姓名和身份信息。
- 离场优先使用主对象驱动的波纹、光幕或聚焦变化。

### 禁止事项

- 玩家资料卡、两列信息卡、卡片网格。
- 标题、头像、称号、段位同时放大。
- 开场仅做整页淡入或静态海报加按钮。

## 3. Impact Number Scene

### 适用页面

Overview，以及未来以次数、时长或成就数量为唯一高潮的页面。

### 主视觉焦点

一个核心数字。Overview 的唯一主角是 `playCount`。

### 布局规则

- 主数字占据中央最大层级，单位紧贴但显著更小。
- 标题、太鼓锚点、歌曲数/谱面数/时长都是陪衬。
- 辅助数据可沿一条弧线、节拍轨道或上下层级依次点亮，不并列成统计卡。
- 数值无效时隐藏该证据，不保留空位。

### 动效规则

- `number-impact` 与 count-up 同步，终值触发一次鼓点缩放、波纹和少量粒子。
- Overview 必须继续受 `transitionTime` 控制，与 period-to-overview 封面通道处在同一时钟。
- 0ms、过渡中和 1600ms 的定格状态都必须可复现，无终态跳变。

### 禁止事项

- 多个大数字并列。
- 恢复旧成就网格或 KPI 卡片。
- 辅助数据与 `playCount` 使用相同字号、对比度或冲击反馈。

## 4. Song Memory Scene

### 适用页面

Favorite Song，以及未来的 obsession、monthly favorite、high score、challenge、near dondaful 等歌曲记忆页。

### 主视觉焦点

曲绘。歌名和次数围绕曲绘形成记忆，而不是放进独立信息卡。

### 布局规则

- 背景从曲绘主色、柔化图像或色块关系中获得，不依赖统一浅蓝底。
- 曲绘应是首个清晰识别对象，并保留稳定方形比例。
- 歌名可沿曲绘边缘、遮罩或舞台字幕出现；副标题和曲号只作为弱信息。
- `playCount > 0` 时数字作为一次爆点；无有效歌曲或次数时保留单主视觉与短收束。
- 缺失曲绘使用现有 `AnnualArtworkFallback`，不能显示破图或空白框。

### 动效规则

- 入场使用 `cover-gather` 或 `cover-spin-in`，曲绘到位后才出现歌名。
- 次数 count-up 在曲绘稳定后开始，完成时只让曲绘轻微鼓点震动，不整体摇屏。
- 离场可以从曲绘主色、边缘或旋转方向继承到下一幕。

### 禁止事项

- “曲绘卡 + 歌曲信息卡 + 次数卡”的三块式布局。
- 用模糊大图遮蔽真实曲绘，使歌曲无法辨识。
- 长日文歌名单行溢出或强制截断主要信息。

## 5. Pattern Scene

### 适用页面

Keyword、RT/Rating、Speed、Calendar、Weekday、Time of Day、Late Night 等行为模式页。此模板不在第一轮五页实现范围内，但用于约束后续迁移。

### 主视觉焦点

一个可识别的模式装置：雷达、RT 环、倍速鼓面、点亮日历、时钟轨道或夜间月相。

### 布局规则

- 图表必须成为场景对象，而不是卡片内部的报表。
- 有效维度不足时缩减装置或切换为单关键词/单数值构图，不补零制造空图。
- 辅助说明紧贴装置，不使用大面积空容器。

### 动效规则

- 使用 `radar-draw`、`speed-dial`、`calendar-light-up`、`night-fall` 等与数据含义一致的动作。
- 动画顺序由数据关系决定，避免所有元素同一时间上浮。

### 禁止事项

- 大空白卡、假雷达、0 值日历和无样本排名剪影。
- 普通柱状图/表格直接放入通用面板。

## 6. Award Scene

### 适用页面

Final Title，以及未来成就、里程碑和海报收束场景。

### 主视觉焦点

年度称号或单个成就标志。Final Title 的称号必须比玩家形象和证据数据更突出。

### 布局规则

- 深色舞台和金色聚光建立颁奖氛围，不套通用浅色页头。
- 玩家形象先作为获奖者登场，随后让称号占据画面中心。
- 依据文案是一句颁奖词；有效核心数据作为依次点亮的证据，不形成三张 KPI 卡。
- “查看年度海报”在所有证据到位后出现，只负责进入现有 Poster 页面。

### 动效规则

- 使用 `profile-spotlight` 引入玩家，再用 `award-reveal` 逐 grapheme 揭示称号。
- 证据按节拍依次点亮，每项最多一次反馈。
- CTA 以光束收束或舞台落幕方式出现，不抢称号首次揭示。

### 禁止事项

- 称号被头像卡、依据卡、统计卡和按钮共同挤压。
- 用通用 fade/slide 替代颁奖揭示。
- 在 Final Title 重新创建分享或海报生成逻辑。

## 7. 第一轮页面映射

| 页面 | sceneType | mainFocus | mood | intensity | 主要语义动效 |
| --- | --- | --- | --- | --- | --- |
| Opening | hero | taiko-drum | rainbow-stage | high | cover-gather, taiko-ripple |
| Profile | hero | player-avatar | profile-stage | medium | profile-spotlight |
| Overview | impact-number | play-count | bright-impact | high | cover-spin-in, number-impact |
| Favorite Song | song-memory | song-cover | cover-spectrum | high | cover-gather, number-impact |
| Final Title | award | annual-title | award-stage | high | profile-spotlight, award-reveal |

这一映射应进入现有页面注册配置，而不是在页面内各自硬编码另一份不可查询的规则。
