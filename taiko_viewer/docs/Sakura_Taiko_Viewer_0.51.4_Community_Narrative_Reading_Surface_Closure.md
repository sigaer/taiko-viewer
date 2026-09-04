# Sakura Taiko Viewer 0.51.4
# Community Narrative & Reading Surface Closure
# Forum Home × Thread Detail Visual Rework

## 0. 阶段定位

当前生产基线：

- Viewer：`0.51.3`
- Player Growth Home 已基本完成 Narrative / Product Voice / Spacing 收口
- Forum / Community 数据模型、权限、发帖、通知、Community Bridge 均已完成主开发周期
- Chart UGC 与 Forum 继续保持独立数据模型
- 当前论坛功能正确，但视觉与阅读表面仍明显存在：
  - UI Prompt 感
  - Hero 信息重复
  - Nested Card 感
  - Thread 标题区与正文割裂
  - 图片像“附件组件”而不是正文
  - 回复区与主帖边界不清晰
  - 移动端首屏被说明性内容占用过多

因此，本阶段定义为：

`0.51.4 COMMUNITY NARRATIVE & READING SURFACE CLOSURE`

本轮目标不是新增论坛能力，而是：

> **让 Community 从“社区模块集合”变成“真正有人在说话的内容空间”；让 Thread 从“多个 Card 拼接的页面”变成“连续可读的文章 + 清晰的讨论区”。**

---

# 1. 本轮核心目标

本阶段只解决两类页面：

1. `/forum` Community Home
2. `/forum/thread/:id` 或现有 Thread Detail 路由

核心原则：

```text
内容 > 容器

文章 > 模块

留白 / divider > nested card

人和内容 > UI 说明
```

---

# 2. 当前已确认的问题

## A. Community Home 首屏 UI Prompt 过多

当前移动端首屏存在多层重复：

```text
首页 / 社区

社区
太鼓达人玩家交流社区，聚合公告、谱面攻略、段位道场与晒分战报。

玩家社区
看看鼓友正在聊什么，找到下一篇值得打开的帖子。

正在发生
正在讨论
```

用户已经：

- 从底部 Tab 点击「社区」
- 进入 `/forum`
- 看见页面标题「社区」

因此大量说明性文字没有新增信息。

---

## B. Mobile Breadcrumb 冗余

移动端已有：

- 底部导航
- 当前社区 Tab 高亮
- URL / 页面结构

因此：

```text
首页 / 社区
```

在移动端属于重复定位。

桌面端可保留 Breadcrumb。

---

## C. Thread Header 与正文割裂

当前 Thread Detail：

```text
[大 Card]
  分类
  标题
  摘要
  作者
  stats
  tag
  点赞 / 回复

正文文字

[单独图片容器]

[回复主题大 Card]
```

用户认知里这其实是一篇文章。

但视觉上被拆成多个系统组件。

---

## D. 图片像附件，不像正文

当前图片：

- 独占一块有色背景
- 大面积空白
- 图片本身缩在中间
- 与前后文字没有共同阅读节奏

结果像：

> Attachment Preview

而不是：

> Article Media

---

## E. Summary / Body 重复

当前例子中：

```text
摘要：
虹2026课题曲已公布
```

正文又出现：

```text
虹2026课题曲已公布
```

详情页存在重复内容。

---

## F. Reply 区与主帖边界不清

当前主帖结束后直接进入：

```text
回复主题
[textarea]
```

但没有明显：

> 主帖结束 / 讨论开始

的结构转换。

---

# 3. 严格范围

本轮只允许修改：

- `/forum` Home 视觉结构
- Community Home Hero / Header
- Mobile breadcrumb
- Community feed chrome
- Thread Detail header / body / media / action bar
- Reply section separator
- Reply composer presentation
- zh / ja 文案
- 必要 presentation helper
- 必要 CSS / component hierarchy

禁止：

- 修改 Forum DB schema
- 修改 Thread 数据模型
- 修改 Chart UGC
- 修改 Community Bridge
- 修改发帖 API
- 修改回复 API
- 修改权限
- 修改通知逻辑
- 修改 Reaction / Helpful 业务逻辑
- 修改排序算法
- 修改推荐算法
- 新增 Reputation / Follow / Feed2
- 新增图片上传能力（如果当前尚不存在）
- 新增 OAuth
- 新增后端服务

本轮是：

> **Visual / Narrative / Reading Surface Closure**

不是：

> **Community Feature Expansion**

---

# 4. 版本目标

完成后：

`Viewer 0.51.4`

Backend：

保持当前生产版本。

如果没有真实 blocker，不得修改 Backend。

---

# 5. 开始前必须 Audit

读取全部适用 `AGENTS.md`。

只读审计：

## Community Home

- top shell
- breadcrumb
- title
- subtitle
- action buttons
- tabs
- “正在发生”
- “正在讨论”
- Chart Activity
- Latest Discussions
- empty states
- mobile / desktop

## Thread Detail

- category
- title
- excerpt
- author
- metadata
- tags
- reactions
- body
- media
- related chart
- replies
- composer
- sticky controls

输出：

### A. Duplicate Context Audit

### B. Nested Container Audit

### C. Article Flow Audit

### D. Media Presentation Audit

### E. Reply Boundary Audit

不要先写代码。

---

# 6. Community Home：Mobile Hero 收缩

移动端目标：

```text
社区                         🔔  发布

最新   热门   攻略   精选   公告 …
```

然后尽快进入内容。

---

# 7. Mobile Breadcrumb

移动端默认隐藏：

```text
首页 / 社区
```

桌面端允许保留。

不要通过缩小字号保留一个没有必要的信息层。

---

# 8. Community Hero 标题

保留：

```text
社区
```

作为页面唯一主标题。

不要同时出现：

```text
玩家社区
```

作为第二层同义标题。

---

# 9. 删除说明性 Prompt

当前类似：

```text
太鼓达人玩家交流社区，聚合公告、谱面攻略、段位道场与晒分战报。
```

以及：

```text
看看鼓友正在聊什么，找到下一篇值得打开的帖子。
```

在移动 Feed 首屏默认移除。

这些内容可以转移到：

- SEO metadata
- 社区说明页
- desktop secondary copy
- rules/about

不要每次打开社区都显示。

---

# 10. Mobile Action Layout

顶部：

```text
社区                         [通知] [发布]
```

要求：

- 通知为轻 icon button
- 发布为主 action
- 不使用巨大浮动 Card
- 不抢过内容

---

# 11. Tabs

保留：

```text
最新
热门
攻略
精选
官方公告
...
```

但要求：

- 横向滚动自然
- active 明确
- inactive 轻
- 不要每个 tab 都像独立 Card
- 不要过粗虚线边框

---

# 12. “正在发生 / 正在讨论”层级

当前：

```text
正在发生
正在讨论
```

属于明显重复。

本轮只能保留一个，或者全部移除。

首选：

直接进入 feed。

若产品确实需要 section heading：

保留：

```text
正在讨论
```

即可。

---

# 13. Community Home 首屏目标

390×844 下：

应尽早出现第一条真实帖子或真实活动。

不能让：

- Hero
- 说明
- tabs
- section title

共同占掉大半首屏。

---

# 14. Feed 的核心原则

Feed 应优先表现：

```text
人
↓
内容
↓
媒体
↓
互动
```

而不是：

```text
Section
↓
Card
↓
Metadata
↓
更多 Card
```

---

# 15. Feed 去 Card 化方向

如果当前 Thread Feed 每条都使用大圆角 Card：

需要减弱。

建议方向：

```text
Author
Content
Media
Metadata
────────────
Author
Content
```

通过：

- whitespace
- divider
- typography

区分条目。

---

# 16. 不要求完全无 Card

如果某类内容需要 Card，例如：

- Chart Activity
- 特殊公告
- 结构化内容

可以保留。

但普通 Thread Feed 不应每条都套同权大 Card。

---

# 17. Chart Activity

谱面动态仍属于结构化内容，可以保留轻 Card。

但要控制：

- 尺寸
- padding
- CTA
- badge

不要让它比真实用户 Thread 更醒目。

---

# 18. Community Home 内容优先级

移动端建议：

1. Page title + actions
2. Tabs
3. Real thread/activity content

不要：

1. Page title
2. Page description
3. “玩家社区”
4. explanatory subtitle
5. tabs
6. “正在发生”
7. “正在讨论”
8. content

---

# 19. Thread Detail：改成 Article Flow

Thread Detail 应从：

```text
Header Card
↓
Body
↓
Media Card
↓
Reply Card
```

改成：

```text
Article Header
↓
Body
↓
Media
↓
Article Actions
↓
Divider
↓
Replies
```

---

# 20. Thread Header 不再是巨大 Card

移动端优先：

```text
段位道场

虹2026段位预想课题曲一览！

sigaer · 站务
2026/04/30 · 43 浏览

#段位道场
```

整体属于文章头部。

不要套一个巨大的独立白 Card。

---

# 21. 分类 / Tag

分类：

```text
段位道场
```

保持轻量。

Tag：

```text
#段位道场
```

如果和分类完全重复：

需要审计是否两个都必须展示。

如果只是重复同一语义：

详情页优先删除一个。

---

# 22. Thread Title

标题应成为页面最强文字。

不要让：

- category pill
- user badge
- reply button
- metadata

竞争主标题。

---

# 23. Excerpt

Thread Detail 默认不显示 feed excerpt。

如果 excerpt 与正文开头重复：

删除。

Excerpt 继续用于：

- feed
- SEO
- share preview

详情页直接：

```text
Title
Metadata
Body
```

---

# 24. Author Block

建议：

```text
[avatar] sigaer · 站务
         2026/04/30 · 43 浏览
```

保持：

- avatar
- username
- role badge（如果必要）
- time
- view count

减少：

- taiko id
- achievement title
- 多层身份信息

除非这些确实属于 Forum identity。

---

# 25. Author Identity 不能抢正文

不要出现：

```text
用户名
站务
225***35
演奏の達人
等级
徽章
```

全部同时展示。

优先：

```text
avatar
username
role
time
```

其余可以进入 profile。

---

# 26. Stats

当前：

```text
0 回复
0 点赞
43 浏览
2026/04/30 12:59:51
```

可以压缩为：

```text
43 浏览 · 0 回复 · 2026/04/30
```

或现有品牌语言下的等价结构。

不需要秒级时间，除非论坛已有明确需求。

---

# 27. Thread Actions

当前大按钮：

```text
点赞主题
回复主题
```

改为轻量 action bar。

建议：

```text
♡ 点赞    ☆ 收藏    💬 回复    ↗ 分享
```

具体功能以当前已存在能力为准。

如果没有收藏/分享：

不要新增。

只展示真实功能。

---

# 28. Action Bar 位置

Article body / media 之后：

```text
正文
图片

♡ 点赞    💬 回复

────────────────
```

不要在文章头部放两个巨大按钮抢视觉。

---

# 29. Body Typography

正文：

- mobile font size 足够
- line-height 舒适
- 最大宽度合理
- 与 title/metadata 有稳定 spacing

正文应该是阅读主角。

---

# 30. Body 不包独立 Card

正文不要再次：

```text
正文 Card
```

Article 本身就是容器。

---

# 31. Media 与正文必须成为共同体

图片属于 Article Body。

图片应直接进入内容流。

不再使用：

```text
大面积有色背景容器
+
居中小图
```

作为默认图片展示方式。

---

# 32. 单图规则

单图：

- `max-width: 100%`
- 保持原图比例
- 图片本身圆角
- 无额外彩色背景
- 上下 margin 属于正文 rhythm
- 点击可使用现有 lightbox（如已有）

---

# 33. 竖图规则

对于窄竖图：

允许：

- 居中
- 限制最大宽度

例如：

```text
正文

      [竖图]

正文
```

但页面背景保持一致。

不要再放入：

```text
[浅灰大矩形背景]
```

---

# 34. 横图规则

横图：

尽可能使用正文内容宽度。

不要缩成小附件。

---

# 35. 多图规则

如果当前 Thread 已支持多图：

建议：

```text
1 图 → 大图
2 图 → 2列
3 图 → 1+2 或 3列
4+ → grid + count
```

但本轮只修改已有显示，不新增上传能力。

---

# 36. 图片边界

图片与文字通过：

- margin
- caption（如果存在）
- paragraph rhythm

连接。

不要通过：

- Card title
- Attachment label
- 独立背景块

连接。

---

# 37. Caption

如果图片本身有 caption 数据：

显示轻量 caption。

如果没有：

不要自动生成：

```text
图片1
附件
帖子图片
```

---

# 38. Related Chart

Thread 的 Related Chart 仍保留。

但它属于结构化引用。

应在 Article Body 后或 metadata 附近以轻量 inline context 呈现。

不要把它做成比正文更大的 Card。

---

# 39. 主帖结束边界

主帖结束后必须明确建立分隔：

```text
────────────────────────
```

然后进入：

```text
回复 12
```

---

# 40. Replies Section Title

使用：

```text
回复 12
```

或：

```text
回复
```

不要：

```text
回复主题
```

“回复主题”属于系统动作名，不是内容 section。

---

# 41. 0 Reply

无回复：

```text
回复 0

还没有回复
```

或更自然等价文案。

不要用巨大 empty Card。

---

# 42. Reply List

回复条目：

优先：

```text
avatar username time

reply content

────────────
```

减少：

- reply Card
- nested Card
- 大 badge
- 大边框

---

# 43. Reply Composer

当前巨大：

```text
回复主题
[textarea]
```

需要收敛。

建议：

```text
写下回复…
```

作为轻量 composer。

如果已有 sticky reply：

可以优先使用 sticky / bottom composer。

---

# 44. Composer 与 Replies 的关系

Composer 属于：

> Discussion action

不是独立巨型模块。

不要让 composer 比已有回复更重。

---

# 45. Mobile Sticky Reply

如当前已有或很容易复用：

可以保留：

```text
写下回复…
```

作为底部轻量入口。

但不得与全站底部导航冲突。

---

# 46. 不新增功能

如果当前没有：

- 收藏
- 分享
- 图片 lightbox

不要为了视觉方案新增业务功能。

只使用现有能力。

---

# 47. Community Home 与 Thread 的共同视觉原则

统一：

```text
低 chrome
高内容密度
稳定留白
明确层级
```

避免：

```text
大 Card
大圆角
大标题
大按钮
多 badge
```

同时出现。

---

# 48. Sakura 品牌保留

保持：

- 暖色
- 当前 typography
- 当前 navigation
- light/dark
- 品牌 accent

不是复制其他论坛。

吸收的是：

> content-first layout

不是：

> 别人的视觉皮肤。

---

# 49. Mobile Information Density

目标：

内容可以更密，但 UI chrome 更少。

例如：

```text
作者
正文
图片
互动
```

信息多没问题。

只要不再叠：

```text
Card
Section
Badge
Subtitle
CTA
```

---

# 50. 390×844 Community Home Acceptance

检查：

1. mobile breadcrumb 是否移除
2. 页面只保留一个“社区”主标题
3. 说明性 Prompt 是否移除
4. tabs 后尽快出现真实内容
5. 不再连续出现“玩家社区 / 正在发生 / 正在讨论”
6. 发布按钮仍清晰
7. 通知入口仍可用
8. 第一屏内容密度明显提升
9. 页面不像后台社区模块页

---

# 51. 390×844 Thread Acceptance

检查：

1. 标题是视觉主角
2. Header 不再是大独立 Card
3. excerpt 不与 body 重复
4. author / stats 更紧凑
5. body 与 title 连续
6. 图片与正文连续
7. 图片无突兀大背景
8. action bar 轻量
9. 主帖结束有明确 divider
10. replies 明确开始
11. composer 不与主帖混在一起

---

# 52. Desktop Acceptance

`1440×900`

Community Home：

- 不空
- Hero 不过大
- tabs 自然
- Feed 内容优先

Thread：

- article max-width 合理
- 图片比例自然
- replies 与 article 分区清晰

---

# 53. Dark Mode

重点：

- divider 可见但不重
- metadata 对比度足够
- image 不出现奇怪背景
- article / replies 边界清楚
- feed 不因去 Card 化而糊成一片

---

# 54. zh / ja

至少真实检查：

- `/forum`
- Thread Detail

中文：

- 不出现 Prompt 说明
- 不出现“回复主题”等系统化文案

日文：

- 自然
- 不逐字翻译中文结构
- section title 简短

---

# 55. Raw Key Regression

继续保证：

```text
forum.*
community.*
```

不得直接出现在用户可见 UI。

---

# 56. Accessibility

- thread link keyboard accessible
- image alt 语义正确
- action buttons accessible name 正确
- reply composer label 正确
- divider 不依赖颜色表达
- heading hierarchy 合理

---

# 57. 不要用更多装饰修 Community

禁止通过：

- 更多 gradient
- 更多 icon
- 更多 badge
- 更多 shadow
- 更多 glass

解决“成熟度”。

本轮重点：

```text
减少
合并
连续阅读
内容优先
```

---

# 58. Feed Thread Item

普通 Thread Feed 项建议结构：

```text
[avatar] username · role
         time

title / body preview

media preview（如有）

views                   likes replies
────────────────────────────
```

不要求机械照搬。

Codex 根据现有 component 实现。

---

# 59. Thread Feed 标题 / 正文

如果 Thread 同时有 title + excerpt：

在 Feed 可以展示。

但不要：

```text
category
title
excerpt
metadata
tag
```

全部同等级。

优先：

```text
title
excerpt
```

category 降级。

---

# 60. Official Announcement

官方公告可以保留特殊识别。

但不要让：

```text
官方公告
公告
```

双 badge。

一个状态即可。

---

# 61. Chart Activity

继续保留结构化谱面动态。

但审计：

- sample limited
- CTA
- chart info
- contribution count

避免 UI Prompt 化。

---

# 62. Community Home Empty State

如果没有 Thread：

不要用巨大 Card。

简短：

```text
还没有新的讨论
```

然后允许发布。

---

# 63. Thread Media Responsive

确保：

- portrait
- landscape
- square
- long image

都不会：

- 溢出
- 过度缩小
- 留巨大有色背景
- 拉伸

---

# 64. Existing Thread Example

对当前：

`虹2026段位预想课题曲一览！`

实际浏览器验收。

必须看到：

```text
段位道场
虹2026段位预想课题曲一览！

sigaer · 站务
2026/04/30 · 43 浏览

虹2026课题曲已公布

[图片]

[action bar]

────────────

回复 0
```

视觉连续。

---

# 65. Summary Duplication Test

如果 excerpt == body first paragraph：

详情页不得重复展示。

需要新增 regression。

---

# 66. Media Background Regression

确保 Thread 正文图片默认容器：

不得使用明显：

```text
background: colored panel
```

除非是：

- file placeholder
- broken media
- explicit gallery surface

---

# 67. Reply Boundary Test

DOM / component 层确认：

Article end
与
Replies start

存在独立语义 section。

不要只是：

```text
body
textarea
```

连续堆叠。

---

# 68. Performance

本轮不得显著增加：

- API request
- image blocking
- JS bundle
- layout shift

不新增重依赖。

---

# 69. Tests

运行现有：

- forum
- community
- UGC
- admin-auth
- i18n
- version
- home-state
- growth

新增/更新：

- Community hero duplicate-copy tests
- Mobile breadcrumb test
- Thread excerpt duplication test
- Article/media flow test
- Reply boundary test
- raw-key test

然后：

```bash
npm run build
git diff --check
```

---

# 70. Version

完成：

`Viewer 0.51.4`

Backend：

保持不变。

---

# 71. Production Smoke

至少：

```text
/forum
/forum/thread/:realId
/songs/:id
/
```

HTTP 200。

---

# 72. Production Browser Acceptance

必须真实检查：

- `/forum`
- 一个有图片 Thread
- 一个无图片 Thread
- 一个有回复 Thread（如有）
- 一个 0 reply Thread

尺寸：

- 390×844
- 1440×900

主题：

- light
- dark

语言：

- zh
- ja

---

# 73. 录屏验收

最终录制：

1. `/forum` 首屏
2. 点进 Thread
3. 阅读正文与图片
4. 滚动到 Replies

检查：

- Community Home 不再“解释社区是什么”
- 第一条内容更早出现
- Thread 是一篇连续文章
- 图片属于正文
- Replies 明确独立

---

# 74. Completion Blockers

以下任一存在不得关闭：

- Mobile `/forum` 仍显示 breadcrumb
- 同时出现“社区 / 玩家社区 / 正在发生 / 正在讨论”多层同义标题
- Community Hero 仍占大半首屏
- Thread Header 仍是巨大独立 Card
- excerpt 与 body 重复
- 图片仍有突兀有色大背景
- 图片仍像附件预览
- 回复区仍与主帖无明显分隔
- “回复主题”仍作为巨大 section 标题
- 普通 Feed 仍全部是厚 Card
- raw key
- zh / ja 回归
- Community Bridge / UGC 功能回归
- Backend 被无必要修改

---

# 75. 最终报告必须回答

1. Mobile breadcrumb 是否移除？
2. Community Home 最终主标题？
3. 哪些说明性 Prompt 被删除？
4. “玩家社区”是否删除？
5. “正在发生 / 正在讨论”如何处理？
6. tabs 是否保留？
7. 第一条真实内容相对首屏提前多少？
8. 普通 Thread Feed 是否去 Card 化？
9. Chart Activity 是否保持结构化 Card？
10. Thread Header 是否去大 Card？
11. excerpt 是否在详情页隐藏？
12. author block 如何收敛？
13. stats 如何收敛？
14. 点赞 / 回复是否改为轻 action bar？
15. body 是否与 header 连续？
16. 图片是否移除大背景？
17. portrait image 如何布局？
18. multi-image 如何处理？
19. Related Chart 放在哪里？
20. 主帖结束如何分隔？
21. Replies 最终标题？
22. 0 reply 如何显示？
23. Composer 如何收敛？
24. 是否新增任何 Forum 业务能力？
25. 是否修改 Schema？
26. 是否修改 Backend？
27. zh 是否通过？
28. ja 是否通过？
29. light / dark 是否通过？
30. 390×844 是否通过？
31. 1440×900 是否通过？
32. 是否仍明显像 Beta Forum / UI Template？
33. Viewer 最终版本？
34. 是否可以正式关闭 0.51.4？
35. 是否可以继续进入 0.52.x？

---

# 76. 完成后的正式状态

全部通过后：

`0.51.4 COMMUNITY NARRATIVE & READING SURFACE CLOSURE COMPLETE`

`COMMUNITY HOME CONTENT-FIRST LAYOUT ESTABLISHED`

`MOBILE COMMUNITY HERO COMPRESSED`

`DUPLICATE COMMUNITY PROMPT COPY REMOVED`

`THREAD DETAIL CONVERTED TO ARTICLE FLOW`

`THREAD MEDIA INTEGRATED INTO ARTICLE BODY`

`ARTICLE / REPLIES BOUNDARY ESTABLISHED`

`NESTED CARD DENSITY REDUCED`

`COMMUNITY VISUAL ACCEPTANCE PASSED`

`0.51.x EXPERIENCE CLOSURE COMPLETE`

`READY FOR 0.52.x GOAL FEEDBACK LOOP`

---

# 77. 下一阶段

只有本轮完成后进入：

`0.52.x GOAL FEEDBACK LOOP`

下一阶段：

```text
Player State
↓
Today Plan
↓
用户选择练习目标
↓
Goal Baseline
↓
实际游玩
↓
成绩同步
↓
Goal Evaluation
↓
Growth Event
↓
Next Action
```

0.51.4 未通过前：

禁止提前实现 Goal。
