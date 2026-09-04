# Codex 任务：太鼓年度总结 Demo 表现层改造

## 任务背景

当前项目已经实现了一版太鼓年度总结 demo。基础数据、页面链路和 summary JSON 大体可用，但当前效果更接近“统计卡片轮播”，还没有形成类似网易云音乐年度总结那种有节奏、有层次、有情绪的 H5 演出。

请先阅读并参考项目文档：

```text
./太鼓年度总结Demo改造方案.md
```

如果该文件已经复制到仓库中，建议放置为：

```text
./太鼓年度总结Demo改造方案.md
```

本轮任务不要一次性重写全部页面，而是先做第一阶段改造：统一页面演出骨架，并重点改造关键页面。

---

## 总体目标

在不大改现有数据结构、不破坏现有 summary JSON、不重写后端计算逻辑的前提下，重构年度总结前端表现层。

目标是把当前页面从：

```text
普通数据统计页
```

升级为：

```text
带有太鼓风格、年度总结仪式感、页面转场和情绪文案的 H5 小演出
```

---

## 本轮改造范围

### 必须优先处理

请优先完成以下内容：

```text
1. 重构年度总结页面的通用页面容器
2. 引入统一的页面演出结构
3. 增加基础动效工具组件
4. 优先改造开屏页、总览页、最终称号页
5. 保持现有数据接口兼容
6. 保持移动端性能可接受
```

### 本轮暂不处理

本轮不要优先做：

```text
1. 不要大改后端数据计算
2. 不要新增大量页面
3. 不要重写 summary JSON schema
4. 不要引入复杂的外部动画资产依赖，除非项目已有
5. 不要为了视觉效果牺牲移动端性能
```

---

## 页面演出统一结构

每个年度总结页面都应尽量遵循以下演出顺序：

```text
0.0s - 0.3s：入场转场
0.3s - 0.8s：标题出现
0.8s - 1.5s：主视觉出现
1.2s - 2.2s：核心数字动画
2.0s - 2.8s：情绪文案出现
2.8s 以后：轻微循环动效
```

每页建议拆成以下层级：

```text
背景层：渐变、场景、纹理
氛围层：粒子、光带、音符、鼓点波纹
主视觉层：封面、装扮、图表、称号
数据层：大数字、排行、次数、时间
文案层：标题、解释、收束句
```

---

## 推荐新增或重构的组件

请根据现有项目结构判断实际文件名和位置。若已有类似组件，请在现有基础上改造，不要重复造轮子。

建议组件：

```text
AnnualContainer.vue
AnnualPage.vue
AnnualScene.vue
AnimatedNumber.vue
TaikoRipple.vue
ParticleLayer.vue
SongCoverCard.vue
ProfileCard.vue
AchievementStamp.vue
SharePoster.vue
```

建议 composable：

```text
useAnnualPages.ts
useAnnualTransition.ts
useAnimatedNumber.ts
usePageEnterTimeline.ts
useSceneMood.ts
```

---

## 页面配置建议

如果当前项目已有页面配置，请扩展它；如果没有，可以新增类似结构。

```ts
type AnnualPageConfig = {
  key: string;
  component: Component;
  condition?: (summary: AnnualSummary) => boolean;
  chapter: "intro" | "overview" | "taste" | "habit" | "memory" | "final";
  transitionIn: string;
  transitionOut: string;
  bgMood: string;
  intensity: "low" | "medium" | "high";
};
```

示例：

```ts
const pageConfigs = [
  {
    key: "opening",
    component: OpeningPage,
    chapter: "intro",
    transitionIn: "fade",
    transitionOut: "taiko-ripple",
    bgMood: "rainbow-stage",
    intensity: "high",
  },
  {
    key: "overview",
    component: OverviewPage,
    chapter: "overview",
    transitionIn: "taiko-ripple",
    transitionOut: "cover-shatter",
    bgMood: "bright-impact",
    intensity: "high",
  },
  {
    key: "final",
    component: FinalTitlePage,
    chapter: "final",
    transitionIn: "gold-burst",
    transitionOut: "fade",
    bgMood: "award-stage",
    intensity: "high",
  },
];
```

---

## 第一批重点页面改造

## 1. 开屏页 OpeningPage

### 目标

让开屏页从普通入口升级为“太鼓舞台开演”。

### 视觉元素

```text
歌曲封面墙
中央太鼓鼓面或太鼓图形
彩虹光带
咚 / 咔粒子
开始按钮
弱节奏呼吸动画
```

### 动效要求

```text
1. 背景封面墙缓慢漂移或缩放。
2. 中央太鼓鼓面轻微呼吸。
3. 标题逐行或逐字出现。
4. 按钮轻微发光。
5. 点击按钮后，触发鼓面扩散效果。
6. 扩散效果结束后切换到下一页。
7. 低性能模式下关闭封面墙动画，只保留背景渐变。
```

### 文案建议

```text
鼓点响起的时候，
这一版的回忆也被悄悄记录了下来。

准备好了吗？
```

按钮：

```text
开启我的太鼓回忆
```

---

## 2. 总览页 OverviewPage

### 目标

总览页应成为第一波数据高潮，而不是普通统计卡片。

### 数据

尽量复用现有 summary 中的字段：

```text
游玩次数
游玩歌曲数
谱面记录数
估算时长
过关次数
全连次数
全良次数
极数量
```

### 动效要求

```text
1. 页面进入后先出现标题。
2. 游玩次数作为最大数字砸下或弹入。
3. 数字从 0 count-up 到真实值。
4. 数字出现时触发鼓点波纹或粒子。
5. 歌曲数、谱面数、时长作为第二层数据依次出现。
6. 全连、全良、极等徽章最后出现。
```

### 文案建议

```text
这一版，
你敲响了太鼓 {{play_count}} 次。

{{score_key_count}} 个成绩记录，
一点点堆成了属于你的 {{estimated_time_text}}。

这些数字看起来很安静，
但每一个，都是你亲手敲出来的。
```

---

## 3. 最终称号页 FinalTitlePage

### 目标

最终页应成为全篇收束，不是普通总结卡。

### 动效要求

```text
1. 页面先暗下。
2. 金色或彩虹光线从上方落下。
3. 玩家装扮或太鼓角色登场。
4. 年度称号逐字出现。
5. 周围浮现核心年度数据。
6. 分享按钮最后出现。
```

### 文案建议

```text
这一版的你，
值得一个称号。

{{final_title}}

因为你不是只记得成功的那一次，
你也把每一次重来，
都敲进了这一年的鼓点里。
```

---

## 文案改造规则

请尽量避免说明式文案。

不要写：

```text
你最常游玩的歌曲是《xxx》，共计 xx 次。
```

优先改成：

```text
有些歌不是路过，
是你一次次回头。

这一版，你打了《xxx》xx 次。

它大概已经很熟悉你的鼓点了。
```

所有页面文案尽量使用三段式：

```text
情绪铺垫
  ↓
数据揭示
  ↓
记忆点收束
```

---

## 视觉风格要求

整体方向：

```text
太鼓达人风格
网易云年度总结式仪式感
彩虹、鼓点、封面、称号、舞台感
移动端 H5
```

建议章节色彩：

```text
登场：彩虹、亮蓝、白光
总览：亮蓝、太鼓红、金色
偏好：多彩、封面主色
习惯：蓝紫、时间渐变
突破：金色、紫色、深色背景
分享：年度主色 + 金色徽章
```

太鼓元素应参与动效，而不是只作为静态装饰：

```text
鼓面 → 页面转场扩散
咚 / 咔 → 粒子和数字跳动
鼓棒 → 划线、敲击、盖章
音符 → 背景流动
封面 → 歌曲页主视觉、转场碎片
称号条 → 身份页和最终页主元素
段位徽章 → 成就页和海报高光
```

---

## 性能要求

必须注意移动端性能：

```text
1. 只渲染当前页和前后相邻页。
2. 离屏页面暂停动画。
3. 离屏 Lottie / Rive / Canvas 停止播放。
4. 粒子数量按设备性能分档。
5. 不要在所有页面同时播放复杂背景动画。
6. 图片资源需要懒加载。
7. 封面墙动画要有低性能降级。
8. 避免造成页面切换卡顿。
```

---

## 验收标准

本轮完成后应达到：

```text
1. 开屏页有明显仪式感。
2. 总览页数字有冲击力。
3. 最终称号页有收束和颁奖感。
4. 页面之间不再只是普通滑动切换。
5. 文案不再主要是说明式统计。
6. 移动端无明显卡顿。
7. 现有 summary 数据接口保持兼容。
8. 原有页面仍可正常访问。
```

---

## 推荐提交方式

请按较小 PR / commit 拆分：

```text
1. refactor annual page container
2. add animation primitives
3. improve opening page
4. improve overview page
5. improve final title page
6. polish copy and mobile performance
```

每次提交应尽量保持页面可运行，避免一次性大改导致难以回退。
