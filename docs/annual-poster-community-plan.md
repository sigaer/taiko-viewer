# 太鼓年度总结 Poster 页弹幕与社区联动改造主控方案

> **任务性质**：年度总结最后一页重构 + UGC 弹幕 + Forum 自动发帖 + 分享图导出
> **目标仓库**：`/home/sigaer/taiko/taiko-forum`
> **Viewer 工程**：`taiko_viewer`
> **基准代码**：用户于 2026-09-09 提供的 `taiko-viewer.zip` / `PosterSlide.vue`
> **设计素材**：`poster.zip` 中 `background_22.png`、`square_bg.png`、参考效果图
> **建议版本级别**：**minor**；若当前线上为 `0.53.x`，建议目标为 `0.54.0`（若执行前版本已变化，则取下一个合理 minor）
> **部署唯一入口**：`scripts/deploy_forum_web.sh "<commit_message>"`

---

## 0. 文档用途与执行纪律

本文件既是 **Codex 实施任务书**，也是本次功能改造的 **阶段推进 / 审计清单**。

本任务不是简单 UI patch。它新增三条会产生公开传播内容的链路：

1. **Poster 弹幕**：年度回顾用户发布短文本，并参与 Poster 顶部滚动轮播。
2. **弹幕同步 Forum**：用户可选择把弹幕同时发布到「闲聊杂谈」。
3. **年度四格分享图同步 Forum**：用户保存四格图片时，可选择同步发布到「闲聊杂谈」。

因此必须遵守以下总原则：

- **弹幕是独立业务实体**，Forum Thread 只是可选同步结果。
- **Forum Thread 不能充当弹幕数据库**。
- **分享图的页面预览和服务器导出必须共享同一个 Vue 视觉组件**。
- **保存分享图不得隐式创建现有 30 天公开分享链接**。
- 旧的 30 天 share/poster 能力继续保留，但降级为次级入口。
- 任何社区写操作必须具备：
  - 服务端校验；
  - 幂等；
  - 限流；
  - 明确失败降级；
  - 最小审核能力。
- **静态视觉没有通过前，禁止接入社区写操作。**
- 阶段过程中禁止生产写入验证。
- 最终部署只能使用仓库标准脚本，禁止手工复现部署步骤。

---

# 1. 当前代码审计基线

## 1.1 当前 PosterSlide 的行为

当前：

`taiko_viewer/components/account/version-summary/slides/PosterSlide.vue`

仍然围绕旧分享模型：

```text
创建 30 天 share
    ↓
生成 poster job
    ↓
下载海报 / Web Share
    ↓
续期 / 撤销
```

当前主要函数包括：

```text
createShare()
generatePoster()
pollPoster()
downloadPoster()
sharePoster()
renewShare()
revokeShare()
```

并使用：

```text
AnnualPoster.vue
StorySlideShell.vue
```

当前页面视觉仍是：

```text
AnnualPoster preview
+
一组分享/生成/下载/续期/撤销按钮
```

本次不能在这套结构中继续堆输入框和 Forum 按钮，应将 Poster 重构成独立传播场景。

---

## 1.2 当前 AnnualPoster 与新四格不是同一个产品

当前：

`components/account/version-summary/AnnualPoster.vue`

是 3:4 海报组件，包含：

- 玩家资料；
- 3 项统计；
- 最爱歌曲；
- 年度称号；
- QR；
- 30 天 share 信息。

现有服务端 poster 常量：

```ts
ANNUAL_POSTER_WIDTH = 1080
ANNUAL_POSTER_HEIGHT = 1440
```

现有 Playwright 海报渲染链路还强依赖：

```text
summaryId
posterId
shareId
renderToken
```

因此：

> **不要直接把现有 AnnualPoster 改成新四格，也不要为了保存新四格而偷偷创建 shareId。**

新四格应定义为单独的：

```text
AnnualShareGrid / AnnualShareCard
```

现有 `AnnualPoster` 和 30 天公开 share 继续兼容。

---

## 1.3 Forum 当前能力

### 版块

当前 `FORUM_SECTION_SEEDS` 有：

```text
official
events
beginner-help
score-guides
dojo
achievements
arcade
creative
```

其中：

```text
creative = 二创杂谈
```

当前 seed **没有 `general`**。

但当前 i18n 已经存在：

```text
general = 综合讨论
```

所以本轮可以直接正式 seed：

```text
general
```

不用另造 slug。

### 发帖类型

Forum 已支持：

```ts
discussion
guide
achievement
official
```

年度同步固定使用：

```text
discussion
```

### Thread 正文

当前 Forum 支持：

```ts
ForumContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "image"; imageUrl: string; alt?; caption? }
```

所以：

- 弹幕同步：单 paragraph block；
- 年度图片同步：单 image block；

均可直接建立在现有模型上。

### 当前标题规则

普通 `createForumThread` 当前要求：

```text
标题不能为空
标题至少 4 个字符
```

这与“弹幕标题 = 弹幕内容”存在潜在冲突。

不能为了年度弹幕直接放宽普通论坛所有帖子标题规则。

本方案要求抽出 integration 专用写入服务，普通 `/forum/new` 规则保持不变。

### Forum 用户头像

已有：

```text
GET /api/forum/me/summary
```

并且 `ForumUserBadge` 已包含：

```ts
avatarUrl
username
```

弹幕头像统一使用 Forum badge 身份，不使用歌曲封面或 MyDon。

### Forum 图片

当前已有：

```text
POST /api/forum/media/images
```

实现包含：

- MIME / 格式校验；
- 20MB 上限；
- `sharp`；
- 最大 1600×1600；
- 转 WebP；
- OSS；
- `static.sakura-bot.cn` 公网 URL。

本次应抽取其底层 buffer→OSS 能力，供服务器生成的年度分享图直接复用。

---

## 1.4 年度 summary 已有的数据

`VersionSummaryViewModel` 当前已直接提供本页需要的大部分字段。

四格：

```text
favoriteSong
pound.topSong
pound.speed
profileCard
finalTitle
highScore.song
highScore.score
```

下方统计：

```text
overview.playCount
overview.uniqueSongs
overview.currentClearCharts
period.activeDays
timeOfDay.topLabel / periods / favoriteHourLabel
ratingRank.rating / rankLabel / tier
```

因此本次 **不修改 annual summary schema，不修改年度算法**。

---

## 1.5 部署脚本真实约束

仓库：

```text
scripts/deploy_forum_web.sh
```

不是一个单纯 restart 脚本。

它已经负责：

1. 校验工作区；
2. 校验 HEAD commit message；
3. 校验 commit message 以 Viewer version 开头；
4. fetch / 检查远端；
5. **push**；
6. npm install（按需）；
7. 在干净 git archive workspace 中构建；
8. 切换 `.output`；
9. systemd / Nginx；
10. 本地与线上健康检查；
11. 失败时回滚 Viewer 构建。

所以最终流程必须是：

```text
本地测试
↓
bump version
↓
git commit
↓
deploy_forum_web.sh "<与 HEAD 完全一致的提交信息>"
```

**不要在脚本前手工 `git push`。**
脚本自身会 push。

---

# 2. 最终产品结构

建议新 Poster 页拆成：

```text
PosterSlide.vue
│
├── AnnualPosterDanmaku.vue
│   ├── DanmakuViewport
│   ├── 4-lane scheduler
│   ├── ReactionInput
│   └── ReactionCommunitySyncToggle
│
├── AnnualShareGrid.vue
│   ├── square_bg.png
│   ├── 年度歌曲
│   ├── 最高秒速
│   ├── 称号展示 / 资料卡
│   ├── 年度高分
│   └── 6 项年度指标
│
├── AnnualPosterActions.vue
│   ├── 保存图片
│   ├── ImageCommunitySyncToggle
│   └── LegacyShareEntry
│
└── background_22.png
```

建议新增服务层：

```text
server/services/account/annual-reactions/
server/services/account/annual-share-card/
server/services/forum/integrations/
```

避免把 UGC、Forum、Playwright 渲染全部写进 `PosterSlide.vue`。

---

# 3. Poster UI 视觉规范

## 3.1 素材

整理至：

```text
public/annual/poster/background_22.png
public/annual/poster/square_bg.png
```

原始 zip 不提交。

参考素材：

```text
background_22.png  414×896
square_bg.png      363×554
```

因此 414×896 为 master layout。

---

## 3.2 整页背景

```css
background:
  url("/annual/poster/background_22.png")
  center / cover no-repeat;
```

Poster 是 full-bleed scene。

不要继续保留当前 Poster 页的大型：

```text
eyebrow
title
lead
AnnualPoster preview
右侧 actions column
```

需要审计 `StorySlideShell` 是否会强制预留这些区域。

优先：

- Poster 使用独立 full-screen scene；
- 继续由 StoryPlayer 提供顶部进度 / 声音 / 菜单 / 底部翻页；
- Poster 自己不要额外复制 StoryPlayer controls。

---

## 3.3 Master 坐标

414×896 参考图初始目标：

```text
顶部弹幕区       y ≈ 8% ~ 17%
输入/发送区      y ≈ 17% ~ 25%
四格主体         y ≈ 25% ~ 87%
保存/同步区      y ≈ 89% 左右
底部导航         由 StoryPlayer safe area 控制
```

四格：

```text
width = 363 / 414 ≈ 87.68vw
max-width ≈ 363px @ 414 master
```

建议：

```css
--share-grid-width: min(87.68vw, 363px);
```

不要：

- `width:100%`;
- 左右贴边；
- 用 CSS 重绘 `square_bg`；
- 拉伸素材改变比例。

---

# 4. AnnualShareGrid：四格唯一视觉真源

## 4.1 组件职责

新增：

```text
components/account/version-summary/AnnualShareGrid.vue
```

必须是纯展示组件：

```ts
props:
  summary
  locale
  exportMode?
```

禁止内部：

- fetch；
- Forum API；
- 下载；
- 分享；
- 弹幕；
- job polling；
- share creation。

这个组件同时被：

```text
PosterSlide
服务器 share-card render page
```

复用。

> 页面四格与保存出来的四格必须来自同一 template / CSS。

---

## 4.2 square_bg 内部结构

`square_bg.png` 自身包含：

```text
上方四个彩色象限
+
下方白色统计区域
```

推荐在其上 overlay：

```text
┌──────────────┬──────────────┐
│ 年度歌曲     │ 最高秒速     │
│              │              │
│ favorite     │ pound        │
├──────────────┼──────────────┤
│ 称号展示     │ 年度高分     │
│              │              │
│ profile      │ highScore    │
├──────────────┴──────────────┤
│ 六项年度统计                │
└─────────────────────────────┘
```

不要再额外给四格加白卡或圆角 panel。

`square_bg` 就是格子背景。

---

# 5. 四格字段映射

## 5.1 左上：年度歌曲

数据：

```ts
summary.favoriteSong
```

展示：

```text
年度歌曲
歌曲封面
歌曲名（空间允许时）
```

封面失败：

```text
AnnualArtworkFallback
```

---

## 5.2 右上：最高秒速

数据：

```ts
summary.pound?.topSong
summary.pound?.speed
```

展示：

```text
最高秒速
歌曲封面
{speed} 打/秒
```

缺 speed：

```text
暂无记录
```

禁止使用：

```text
totalPoundCount
topPoundCount
```

冒充秒速。

---

## 5.3 左下：称号展示

不是歌曲。

使用 mini profile card。

数据优先：

```ts
summary.profileCard?.myDonUrl
summary.profileCard?.nickname
summary.profileCard?.title
summary.profileCard?.danName
summary.finalTitle.title
```

称号 fallback：

```text
profileCard.title
→ finalTitle.title
```

展示重点：

```text
MyDon
昵称
年度/当前称号
段位（空间允许）
```

不要把完整 Profile 页缩进来。

这是 Poster 专用 compact profile card。

---

## 5.4 右下：年度高分

数据：

```ts
summary.highScore?.song
summary.highScore?.score
```

展示：

```text
年度高分
歌曲封面
分数
```

缺失：

```text
暂无记录
```

---

# 6. 下方六项字段

固定使用现有年度页面口径，不重新发明统计。

| 展示名称 | 数据来源 | 格式 |
|---|---|---|
| 游玩记录 | `overview.playCount` | 数字 |
| 鼓点记录 | `overview.uniqueSongs` | 数字 |
| 已经通关 | `overview.currentClearCharts` | 数字 / `—` |
| 陪伴天数 | `period.activeDays` | `{n} 天` |
| 活跃时段 | `timeOfDay.topLabel` + 对应 `range`；无则 `favoriteHourLabel` | 短文本 |
| 鼓众坐标 | `ratingRank` | 优先 `rankLabel · rating`，空间不足仅 rating |

说明：

当前 Viewer i18n 已经将：

```text
overview.uniqueSongs
```

以“鼓点记录”口径展示。

本轮保持年度页面一致性，不在 Poster 单独改词义。

---

# 7. 固定缺失态

四格和六字段必须保持固定几何。

缺失数据：

```text
不删除格子
不 collapse
不改为三格
```

统一：

```text
图片 → AnnualArtworkFallback
数值 → —
歌曲 → 暂无记录
```

这样服务器导出的图片不会因为用户数据不同而整体变形。

---

# 8. 顶部弹幕 UI

## 8.1 结构

推荐：

```text
DanmakuViewport
────────────────────

[输入年度感想……………………]

☑ 同步分享到社区       [发送感想]
```

输入框：

```css
background: rgba(255,255,255,.50);
border: 1px solid rgba(0,0,0,.55);
border-radius: 14~18px;
```

发送按钮可用深色半透明 / 黑色边。

同步默认：

```ts
true
```

---

## 8.2 弹幕条

每条：

```text
[viewer avatar][ 文本 ]
```

Avatar：

```text
26~30px
圆形
1px 黑色 border
```

Text bubble：

```text
单行
50% 白底
小黑 border
圆角矩形
```

建议：

```css
background: rgba(255,255,255,.50);
border: 1px solid rgba(0,0,0,.58);
border-radius: 999px;
```

弹幕不能换行。

过长时服务端限制长度，不做多行气泡。

---

# 9. 弹幕动画：必须持续运动

## 9.1 Lane 数

414 master：

```text
4 lanes
```

小屏可根据实际高度：

```text
3~4 lanes
```

但只要有数据：

> **始终至少有一条弹幕处于从右向左运动状态。**

不能：

```text
所有弹幕离场
↓
停几秒
↓
重新开始
```

---

## 9.2 速度

采用恒定像素速度，不采用每条统一 duration。

建议初始：

```text
48~56 CSS px / sec
```

因此：

```text
duration =
(viewportWidth + bubbleWidth + gap) / speed
```

长弹幕和短弹幕实际移动速度一致。

---

## 9.3 调度

维护：

```ts
laneState[]
displayQueue
```

每 lane 记录：

```text
当前条目
当前条目宽度
开始时间
预计离场时间
下一条最早 spawn 时间
```

避免同 lane 追尾。

间距建议：

```text
60~100px
```

---

## 9.4 数据少时

业务只有 1 条：

```text
A
```

视觉层可以：

```text
A A A A
```

重复调度。

数据库仍只有 1 条。

2~5 条同理。

这叫：

```text
visual duplication
```

不是新增 UGC 数据。

---

## 9.5 页面 active 生命周期

```text
active = true
→ 正常运行

active = false
→ pause scheduler / animation
```

返回 Poster：

```text
继续运动
```

不清空已有 reaction pool。

`reducedMotion`：

- 禁止额外 burst / bounce；
- 弹幕仍保持低速、匀速水平移动，避免与“有数据不得静止”的产品要求冲突；
- 可降至约 18~24px/s。

---

# 10. 弹幕数据模型

新增表建议：

```sql
web_annual_poster_reactions
```

建议字段：

```sql
id                  CHAR(36) PRIMARY KEY
user_id             BIGINT UNSIGNED NOT NULL
summary_id          CHAR(36) NOT NULL
version_key         VARCHAR(64) NOT NULL
content             VARCHAR(255) NOT NULL

status              VARCHAR(16) NOT NULL DEFAULT 'published'

community_sync_requested TINYINT(1) NOT NULL DEFAULT 1
community_sync_status    VARCHAR(16) NOT NULL DEFAULT 'pending'
forum_thread_id          BIGINT UNSIGNED NULL
community_sync_error     VARCHAR(255) NULL

client_nonce        CHAR(36) NOT NULL

created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP
```

索引：

```sql
UNIQUE KEY uniq_annual_reaction_user_nonce
  (user_id, client_nonce)

KEY idx_annual_reaction_feed
  (version_key, status, created_at)

KEY idx_annual_reaction_summary
  (summary_id, created_at)
```

FK：

```text
user_id    → web_user_accounts
summary_id → web_annual_summaries
```

---

# 11. 弹幕内容规则

建议：

```text
trim 后 1~60 个 Unicode 字符
```

服务器：

```text
换行 → 空格
连续空白折叠
不允许空字符串
不允许 HTML
不做 v-html
```

用户端 maxlength 也设 60，但服务端必须再次校验。

---

# 12. 弹幕 API

## 12.1 Feed

```http
GET /api/account/annual-reactions
  ?versionKey=annual_2026
  &limit=40
```

仅登录用户可访问。

返回：

```ts
{
  items: Array<{
    id: string;
    content: string;
    createdAt: string;
    author: {
      userId: number;
      username: string;
      avatarUrl: string;
    };
  }>;
}
```

Avatar 通过 Forum badge/profile 查询，不建议在 reaction 表保存 avatar snapshot。

只返回：

```text
status = published
```

如果 `forum_thread_id != null` 且对应 Forum Thread 已 hidden：

```text
不进入 feed
```

避免社区已隐藏内容继续在 Poster 滚动。

---

## 12.2 发布

```http
POST /api/account/annual-summaries/:summaryId/reactions
```

Body：

```json
{
  "content": "今年真的打了好多鼓！",
  "syncCommunity": true,
  "clientNonce": "UUID"
}
```

返回：

```ts
{
  reaction: {...},
  communitySync: {
    requested: boolean;
    status: "completed" | "failed" | "skipped";
    threadId?: number;
    threadUrl?: string;
    message?: string;
  }
}
```

---

# 13. 弹幕发布幂等

客户端生成：

```text
clientNonce
```

第一次 POST：

```text
插入 reaction
```

同用户重复相同 nonce：

```text
返回原 reaction
```

禁止生成第二条。

如果：

```text
reaction 已存在
community_sync_status = failed
syncCommunity = true
```

允许服务端对**同一 reaction**做受控 sync retry。

不能创建第二个 Forum Thread。

---

# 14. 弹幕限流

建议服务端至少两层。

## Primary reaction

初始：

```text
同用户最短 3 秒 / 条
60 条 / 小时
```

## Forum sync

更严格：

```text
同用户最短 30 秒 / 次
10 条 / 日
```

超过 Forum sync 限制：

```text
reaction 仍发布成功
communitySync.status = skipped
```

UI：

```text
感想已发送；社区同步过于频繁，本次仅显示弹幕。
```

限流必须在服务端。

---

# 15. UGC 最小审核能力

因为未同步社区的弹幕也会公开出现在 Poster reaction feed，因此必须能隐藏。

最低要求：

```text
status = published / hidden
```

新增管理员最小接口或复用现有 admin 体系：

```http
PATCH /api/admin/annual-reactions/:id
{
  "status": "hidden"
}
```

审计：

```text
隐藏后 GET feed 不再返回。
```

若 reaction 已同步 Forum：

- Forum thread 被隐藏 → reaction feed 也隐藏；
- reaction 被隐藏是否反向隐藏 thread，可先不自动做，避免跨系统误操作；
- 管理员可在 Forum 独立处理帖子。

---

# 16. Forum 版块调整

## 16.1 新增「闲聊杂谈」

正式使用 slug：

```text
general
```

新增 seed：

```ts
{
  slug: "general",
  name: "闲聊杂谈",
  description: "日常闲聊、曲目感想、年度回顾与社区杂谈。",
  icon: <沿用现有可用 icon>,
  accentColor: <沿用设计系统>,
  sortOrder: 80
}
```

---

## 16.2 「二创杂谈」→「同名二创」

现有：

```text
creative
二创杂谈
```

改：

```text
creative
同名二创
```

建议：

```text
sortOrder = 90
```

描述收紧到创作：

```text
绘画、视频、音乐、同人创作与其它二次创作。
```

---

## 16.3 i18n

同步：

```text
locales/zh.json
locales/ja.json
```

中文：

```text
general  = 闲聊杂谈
creative = 同名二创
```

日文使用自然对应表达，不保留中文占位。

---

## 16.4 App

Flutter Forum 当前从服务器：

```text
/api/forum/sections
```

读取 section，并显示服务端名称。

因此本轮默认：

```text
不单独修改 Flutter UI
```

但必须做接口验证：

```text
general 已出现
creative 名称已更新
排序正确
```

---

# 17. Forum integration：不能直接污染普通发帖规则

普通论坛当前：

```text
title.length >= 4
```

年度弹幕可能短于 4 字。

不要：

```text
把全论坛标题最小长度改成 1
```

建议把 thread creation 抽成：

```text
createForumThreadCore(...)
```

普通入口：

```text
createForumThread(event,payload)
→ policy = normal
```

年度 integration：

```text
createAnnualReactionForumThread(...)
→ policy = integration
```

integration 仍必须执行：

- ensure forum schema；
- user/profile 校验；
- section 校验；
- thread type 校验；
- content block sanitize；
- tags；
- DB insert；
- mention / notification 的安全逻辑。

只允许年度 integration 使用更短标题。

---

# 18. 弹幕同步 Forum

客户端不得传：

```text
sectionSlug
threadType
```

只传：

```text
syncCommunity: true/false
```

服务器硬编码：

```text
section = general
threadType = discussion
```

同步内容严格为：

```text
标题 = 弹幕发送内容
正文 = 弹幕发送内容
```

Forum block：

```ts
[
  {
    type: "paragraph",
    text: reaction.content
  }
]
```

建议 tags：

```text
年度报告
年度感想
```

可选，但不要自动绑定歌曲。

---

# 19. Forum 同步失败语义

Reaction 是 primary operation。

所以：

```text
reaction DB insert 成功
Forum 发帖失败
```

结果仍是：

```text
弹幕发送成功
community_sync_status = failed
```

客户端：

```text
感想已发送，社区同步失败。
```

不要：

- rollback reaction；
- 从本地弹幕队列删除；
- 让发送按钮显示整体失败。

---

# 20. 弹幕 Optimistic / Immediate 行为

服务端 POST 成功后：

```text
立即把 response.reaction 插入前端 reaction pool
```

不要等待下一次 GET。

后台 feed 可：

```text
15~30 秒 refresh
```

不需要 WebSocket。

Poster 页未激活时停止刷新。

---

# 21. 新四格分享图：与旧 share 解耦

## 21.1 禁止行为

点击：

```text
保存图片
```

不得：

```text
自动 create 30-day share
```

也不得要求先有：

```text
shareId
```

---

## 21.2 新 Artifact

定义：

```text
Annual Share Card
```

视觉：

```text
仅 square_bg 四格 + 下方六字段
```

不包含：

- 弹幕；
- 输入框；
- StoryPlayer controls；
- 保存按钮；
- 30天分享 QR；
- 页面背景整屏。

---

# 22. Share Card 导出尺寸

`square_bg`：

```text
363×554
```

保持比例。

推荐服务器导出：

```text
1080×1648
```

近似：

```text
1080 / 1648 ≈ 363 / 554
```

不要强行塞回现有：

```text
1080×1440
```

导致四格压缩。

---

# 23. Share Card 数据表

建议：

```sql
web_annual_share_cards
```

字段：

```sql
id              CHAR(36) PRIMARY KEY
summary_id      CHAR(36) NOT NULL
user_id         BIGINT UNSIGNED NOT NULL
locale          VARCHAR(8) NOT NULL
fingerprint     CHAR(64) NOT NULL
file_path       VARCHAR(1024) NOT NULL
width           INT UNSIGNED NOT NULL DEFAULT 1080
height          INT UNSIGNED NOT NULL DEFAULT 1648

forum_image_url VARCHAR(1024) NULL
forum_thread_id BIGINT UNSIGNED NULL

created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP
```

唯一：

```sql
UNIQUE(summary_id, locale, fingerprint)
```

同一 summary / locale / fingerprint 重复保存：

```text
复用文件
```

---

# 24. Share Card Job

不建议把 `share_card` 塞进现有 `poster_id` 语义。

可选两个实现，优先 A。

## A. 扩展现有 annual jobs

新增：

```ts
AnnualJobType =
  "build"
  | "poster"
  | "share_card"
```

DB 新增：

```text
share_card_id CHAR(36) NULL
```

repository / serialization 增加：

```text
shareCardId
```

优点：

- 复用已有队列/轮询模式；
- 与 annual 架构一致。

禁止：

```text
用 poster_id 存 shareCardId
```

---

## B. 独立 share-card job table

仅当扩展当前 annual queue 风险明显更大时采用。

Codex 必须在 Phase E 开始前报告为何选 B。

---

# 25. Share Card API

建议：

```http
POST /api/account/annual-summaries/:summaryId/share-card
```

Body：

```json
{
  "locale": "zh"
}
```

返回：

```ts
{
  job: {
    id: string;
    status: "queued" | "completed";
  };
  shareCard?: {
    id: string;
    imageUrl: string;
    width: 1080;
    height: 1648;
  };
}
```

轮询：

```http
GET /api/account/annual-share-card-jobs/:jobId
```

Owner-only image：

```http
GET /api/account/annual-share-cards/:id/image
```

不能公开匿名访问。

---

# 26. Share Card 服务器渲染

新增内部 render page：

```text
/pages/account/annual-share-card/[summaryId].vue
```

通过短期 renderToken 鉴权。

页面只渲染：

```vue
<AnnualShareGrid
  :summary="summary"
  :export-mode="true"
/>
```

复用现有：

```text
playwright-core
/usr/bin/chromium
font wait
image decode
screenshot
atomicWriteFile
```

不要引入：

```text
html2canvas
dom-to-image
浏览器 canvas 截图
```

尤其曲绘 / avatar 涉及外域图片，避免 canvas CORS 风险。

---

# 27. 图片加载就绪协议

Share Card render page 必须提供类似：

```ts
window.__ANNUAL_SHARE_CARD_READY__ = true
```

仅在：

- summary 已加载；
- fonts ready；
- 所有必要 image `complete/decode`；
- fallback 已确定；

后设 true。

Playwright：

```text
waitForFunction(READY)
↓
document.fonts.ready
↓
images decode
↓
screenshot
```

---

# 28. 保存图片流程

点击：

```text
保存图片
```

如果 share card 已缓存：

```text
直接下载
```

否则：

```text
POST share-card
↓
job polling
↓
ready
↓
download
```

保存 primary action 与社区同步必须解耦。

---

# 29. “保存图片同步社区”开关

独立：

```ts
syncImageToCommunity = true
```

不要和弹幕 checkbox 共用同一个 ref。

用户可以：

```text
弹幕同步 / 图片不同步
```

反之也可以。

默认二者都是：

```text
true
```

---

# 30. 服务器生成图片上传 Forum OSS

当前 `uploadForumImage(event,file)` 强依赖 multipart / H3。

抽底层：

```ts
storeForumImageBuffer({
  userId,
  buffer,
  mimeType?,
  purpose?
})
```

职责：

- sharp normalize；
- 最大尺寸；
- WebP；
- OSS；
- 返回 URL / width / height。

然后：

```text
浏览器 multipart upload
→ storeForumImageBuffer

annual share-card
→ storeForumImageBuffer
```

不要服务器生成 PNG后再让浏览器重新上传。

---

# 31. 分享图片同步 Forum

固定服务端规则：

```text
section = general
threadType = discussion

title =
快来看看我的年度报告吧～
```

正文：

```ts
[
  {
    type: "image",
    imageUrl: uploadedForumImageUrl
  }
]
```

**正文只允许这一张图片。**

不要增加：

- paragraph；
- 二维码说明；
- share URL；
- 年度数据摘要；
- 自动歌曲绑定。

---

# 32. 分享图片幂等

用户可能：

```text
保存
保存
保存
```

不能创建 3 个帖子。

使用：

```text
web_annual_share_cards.forum_thread_id
```

或独立同步记录。

判定 key：

```text
user_id
summary_id
locale
fingerprint
```

如果已经存在 `forum_thread_id`：

```text
仍允许再次下载
社区同步返回 existing thread
```

不能新建。

---

# 33. 图片保存成功 / Forum 失败

必须：

```text
图片下载成功
Forum 发帖失败
```

UI：

```text
图片已保存，社区同步失败。
```

不能让 Forum 失败阻止下载。

---

# 34. 旧 30 天 Share 的产品位置

保留：

```text
create share
generate legacy poster
renew
revoke
webShare
```

但从 Poster 主操作区移出。

建议收进：

```text
更多分享方式
  └─ 创建 30 天公开链接
```

或：

```text
公开年度链接
```

默认折叠。

主操作只强调：

```text
发送感想
保存图片
```

---

# 35. Poster 动效

这页已经有持续弹幕作为主要动态，不需要额外强演出。

首次进入：

```text
background 250~300ms fade
square grid 350~450ms translateY(8~10px)+opacity
输入区 fade
弹幕立即进入持续调度
```

四格可有极小 stagger：

```text
0 / 60 / 120 / 180ms
```

禁止：

- TaikoRipple；
- burst；
- giant orb；
- 大型 scale 0→1；
- 影响输入可用性的长入场。

---

# 36. 无障碍与移动端

## 弹幕

视觉弹幕容器：

```text
aria-hidden=true
```

避免屏幕阅读器不断朗读滚动 UGC。

发布结果使用：

```text
aria-live="polite"
```

## 输入

必须有可访问 label。

## Keyboard

Enter 默认不直接发送，避免中文输入法误触。

可：

```text
Ctrl/Cmd + Enter
```

作为快捷发送，可选。

## Bottom controls

Poster 内容底部必须预留 StoryPlayer navigation safe area。

---

# 37. 分阶段执行总览

---

## Phase A — Poster Static Rebuild

### 目标

只完成：

- 新背景；
- 顶部弹幕区静态壳；
- 输入框；
- 两个默认同步 checkbox；
- AnnualShareGrid；
- 四格数据；
- 六字段；
- 保存按钮；
- legacy share 次级入口。

### 禁止

- reaction DB；
- reaction POST；
- Forum 自动发帖；
- share-card Playwright；
- OSS 新上传链路；
- 任何生产 POST。

### 必须产出

414×896 master：

```text
reference
implementation
side-by-side
```

另：

```text
390×844
430×932
390×760
414×800
```

### Gate A

必须满足：

- background 正确；
- square_bg 几何接近参考；
- 四格不存在重叠；
- 六字段无遮挡；
- input / button 清晰；
- sync checkbox 默认 checked；
- 底部 navigation 不遮挡。

**Gate A 未通过，禁止进入 Phase B。**

---

## Phase B — Danmaku Core

### 目标

实现：

- reaction table；
- GET feed；
- POST reaction；
- Forum avatar；
- sanitize；
- idempotency；
- primary rate limit；
- 4 lane scheduler；
- low-data visual duplication；
- local immediate append；
- refresh；
- active lifecycle。

### 本阶段必须：

```text
syncCommunity 强制 false
```

即使 UI 已有 checkbox，也暂时不产生 Forum Thread。

### Gate B

本地专用测试账号：

1. 无 reaction：
   - 显示空态；
   - 不伪造弹幕。

2. 1 条：
   - 页面持续有弹幕在移动；
   - visual duplicate 不产生 DB duplicate。

3. 10+ 条：
   - lane 不追尾；
   - 不全部同时空屏。

4. POST 重复 nonce：
   - DB 仅 1 条。

5. 30 秒录屏：
   - 有数据时不能出现全部静止。

**Gate B 未通过，禁止 Forum 写入。**

---

## Phase C — Forum Taxonomy

### 目标

- seed `general`；
- 名称「闲聊杂谈」；
- `creative` →「同名二创」；
- i18n zh/ja；
- section ordering；
- App API compatibility。

### Gate C

验证：

```text
/api/forum/sections
```

必须：

- general 存在；
- creative 名称正确；
- slug 不变；
- thread count 正常；
- Web Forum 可进入；
- Flutter model 不报错。

本阶段仍禁止年度自动发帖。

---

## Phase D — Reaction → Forum

### 目标

打开：

```text
syncReactionToCommunity
```

实现：

- integration thread helper；
- general；
- discussion；
- title == reaction；
- paragraph == reaction；
- short-title integration policy；
- sync rate limit；
- sync status；
- sync retry 幂等。

### Gate D

专用测试账号：

#### Case 1

```text
sync=false
```

结果：

- reaction 有；
- Forum 无 thread。

#### Case 2

```text
sync=true
```

结果：

- reaction 有；
- general thread 有；
- type = discussion；
- 标题 == reaction；
- 正文 == reaction。

#### Case 3

同 nonce retry：

- reaction 不重复；
- thread 不重复。

#### Case 4

Forum rate limited：

- reaction 成功；
- community status skipped；
- UI 不显示整体失败。

---

## Phase E — Share Card Export

### 目标

- AnnualShareGrid 真源；
- server render page；
- Playwright；
- share-card cache/table；
- owner-only image；
- job；
- download；
- 不创建 30-day share。

### Gate E

验证：

1. 无 activeShare 用户也能保存四格。
2. 保存后：
   - `web_annual_shares` 数量不增加。
3. 图片：
   - 比例正确；
   - 1080×1648 左右；
   - 字体完整；
   - 封面完整；
   - fallback 正常。
4. 页面四格与导出四格视觉一致。
5. 重复生成命中 fingerprint cache。

---

## Phase F — Share Card → Forum

### 目标

打开：

```text
syncImageToCommunity
```

实现：

- generated buffer → Forum OSS；
- general；
- discussion；
- 固定标题；
- image-only body；
- forum_thread_id；
- idempotency；
- failure isolation。

### Gate F

#### sync=false

- 下载成功；
- Forum 无 thread。

#### sync=true

Forum：

```text
标题：
快来看看我的年度报告吧～

正文：
仅 1 个 image block
```

重复保存：

- 可以重复下载；
- 不创建第二个社区 thread。

Forum failure：

- 图片仍保存成功；
- UI 明确提示同步失败。

---

# 38. 数据库改动审计要求

所有数据库改动必须是：

```text
additive
```

禁止删除旧：

```text
web_annual_shares
web_annual_posters
web_annual_summary_jobs
```

现有 public share 必须继续可用。

迁移要求：

- `CREATE TABLE IF NOT EXISTS`；
- `ALTER` 走项目现有 migration 容错模式；
- 新索引有明确名称；
- 外键 delete policy 明确；
- 不触碰用户成绩原始数据。

---

# 39. 服务端事务边界

## Reaction

建议：

```text
transaction A:
insert / get existing reaction
commit

optional Forum sync:
独立动作
更新 reaction sync status
```

不要把 Forum 同步失败回滚 reaction。

## Share Card

```text
生成 / cache artifact
↓
下载可用
↓
optional Forum sync
```

不要把 Forum 失败标记 share-card render failed。

---

# 40. API 安全约束

客户端不能决定：

```text
Forum section
thread type
Forum author id
reaction author id
share-card user id
```

全部由 session / server 推导。

Community sync：

```text
general + discussion
```

服务端硬编码。

Share-card：

必须校验：

```text
summary belongs to current user
```

Reaction：

同样校验年度 summary owner。

---

# 41. 日志约束

禁止日志输出：

- session cookie；
- share token；
- renderToken；
- 完整敏感错误对象。

允许：

```text
reaction id
summary id
user id
thread id
share-card id
sync status
job stage
```

错误文本需要截断。

---

# 42. 测试矩阵

## Unit / Service

至少补：

```text
reaction sanitize
reaction empty reject
reaction maxlength
reaction nonce idempotency
reaction rate limit
reaction community sync false
reaction community sync completed
reaction community sync failed
reaction community sync rate limit

forum general section seed
forum creative renamed
forum integration short title
forum image-only thread

share grid data mapping
share grid missing-state
share-card fingerprint
share-card owner authorization
share-card render cache
share-card community idempotency
```

---

## Annual contract

继续：

```bash
npm run test:annual
```

不得破坏现有 pageCount / annual schema。

---

## Build

```bash
npm run build
```

注意：

这只是本地验收 build。

最终部署仍必须走部署脚本。

---

# 43. E2E 真实流程

只使用：

```text
本机 / staging
专用测试账号
```

禁止擅自使用普通真实用户社区身份写测试帖。

---

## E2E 1：初始弹幕

```text
进入 Poster
→ 拉取历史 reaction
→ 30 秒观察
```

要求：

- 有数据时持续滚动；
- 无全停顿；
- 头像正常；
- 文本不追尾。

---

## E2E 2：只发弹幕

```text
sync=false
→ 发送
```

要求：

- reaction 立即出现；
- DB 1 条；
- Forum 0 thread。

---

## E2E 3：弹幕同步社区

```text
sync=true
→ 发送
```

要求：

```text
Forum section = general
threadType = discussion
title = reaction
body = reaction
```

---

## E2E 4：只保存图片

```text
sync image=false
→ 保存
```

要求：

- download 成功；
- 不创建 30-day share；
- 不创建 Forum thread。

---

## E2E 5：图片同步社区

```text
sync image=true
→ 保存
```

要求：

- download 成功；
- Forum thread 1 条；
- 标题固定；
- body 只有 image block。

---

## E2E 6：重复点击

连续点击：

```text
发送
保存
```

模拟 retry。

要求：

- nonce 防 reaction duplicate；
- share-card forum thread 不 duplicate。

---

# 44. 视觉验收

## Poster 主页面

尺寸：

```text
390×844
414×896
430×932
390×760
414×800
```

检查：

- square_bg 比例；
- 四格完整；
- title 不溢出；
- 资料卡不挤压；
- 六项字段不被导航遮挡；
- input 不被 mobile keyboard 前的初始 viewport 裁切；
- checkbox 可点击；
- barrage 不挡 input；
- StoryPlayer controls 最上层。

---

## Share Card

至少：

```text
1080×1648
```

同时生成缩放预览检查：

```text
414px width
```

确保手机分享软件预览仍可读。

---

# 45. 性能要求

## Poster 首次进入

不要因为：

```text
Forum
share-card renderer
legacy poster
```

阻塞页面首次可交互。

优先：

```text
background / square_bg
summary local data
reaction feed
```

Share-card 只在用户点保存时生成。

Forum section 不需要 Poster 首屏额外请求。

---

## Barrage

持续动画只能修改：

```text
transform
opacity（边缘必要时）
```

禁止每帧：

```text
left
top
width
height
```

文本宽度可以 spawn 前测量一次并缓存。

---

# 46. 旧功能回归

必须确认以下仍可用：

```text
30 天公开 share create
legacy poster generate
legacy poster download
Web Share
renew
revoke
public share read
public poster read
```

即使 UI 被收进“更多分享方式”，API 不得破坏。

---

# 47. 上线前写入冻结

在功能全部完成后，生产部署前：

```text
禁止使用生产普通账号进行：
reaction POST
Forum thread POST
share-card community POST
```

部署后 canary 仅执行：

```text
GET /
GET annual page
GET /api/forum/sections
GET reaction feed（使用授权测试身份，如必要）
静态资源 HEAD/GET
```

生产写验证必须另外获得明确批准。

---

# 48. 版本与提交策略

该功能包含：

- 新 UI；
- 新 UGC；
- DB schema；
- Forum taxonomy；
- Forum integration；
- 新 render artifact；

属于 backward-compatible feature。

建议：

```text
0.53.x → 0.54.0
```

若执行时已经进入 0.54+，选择下一个符合 AGENTS Release Policy 的 minor。

建议最终 commit：

```text
<VERSION> 年度Poster增加弹幕与社区分享联动
```

例如：

```text
0.54.0 年度Poster增加弹幕与社区分享联动
```

---

# 49. 部署硬约束

**唯一合法部署方式：**

```bash
cd /home/sigaer/taiko/taiko-forum

bash scripts/deploy_forum_web.sh \
  "<与 HEAD 提交信息完全一致的 commit message>"
```

例如：

```bash
bash scripts/deploy_forum_web.sh \
  "0.54.0 年度Poster增加弹幕与社区分享联动"
```

---

## 禁止

禁止手工：

```text
git push
npm run build + copy output
systemctl restart taiko-viewer
rsync/scp
手工替换 .output
手工复现 deploy_forum_web.sh
```

作为正式部署方案。

注意：

```text
deploy_forum_web.sh 自身负责 git push
```

所以：

> **最终 commit 后不要先手工 push，再调用脚本。**

---

## 脚本失败

任一步失败：

```text
STOP
```

禁止：

```text
“脚本失败，所以我改用手工 restart”
```

必须报告失败步骤。

---

# 50. 最终部署前顺序

严格：

```text
1. 所有 Phase Gate 通过

2. npm run test:annual

3. 相关 Forum / backend tests

4. npm run build
   （仅本地验收）

5. bump viewer version

6. package-lock 同步

7. git diff / git status 审计

8. git add 指定范围

9. git commit
   commit subject 必须以 version 开头

10. 不手工 push

11. cd /home/sigaer/taiko/taiko-forum

12. bash scripts/deploy_forum_web.sh "<HEAD subject>"

13. 脚本 exit code = 0

14. taiko-viewer.service active

15. taiko-sync-receiver active

16. 本地 health

17. viewer.sakura-bot.cn health

18. 线上 appVersion

19. 只读生产 canary
```

---

# 51. Rollback

## Viewer

由：

```text
deploy_forum_web.sh
```

自带 `.output.previous` 健康检查 rollback。

不要绕过。

## DB

本轮 DB 是 additive migration。

若 Viewer 回滚：

- 新表保留；
- 新字段保留；
- 旧代码不读取它们；
- 不需要生产中 DROP TABLE。

## Forum section

若功能临时下线：

- `general` 可以保留；
- `creative` 名称如需回退，仅 seed/name 回退；
- 不删除已产生 thread。

---

# 52. 阶段审计表

| Phase | 内容 | 状态 | Gate | 生产写入 |
|---|---|---|---|---|
| A | Poster 静态 UI | ☑ | PASS — Gate A passed after user manual multi-viewport visual acceptance. | 禁止 |
| B | Danmaku Core | ☐ | 30s 连续滚动 + 幂等 | 禁止 |
| C | Forum 版块 | ☐ | general/creative API | 禁止 |
| D | Reaction→Forum | ☐ | sync false/true/idempotency | 禁止 |
| E | Share Card | ☐ | 无 shareId 导出 + 缓存 | 禁止 |
| F | Image→Forum | ☐ | image-only + no duplicate | 禁止 |
| Final | 全链路回归 | ☐ | tests/build/E2E | 禁止 |
| Deploy | 标准脚本部署 | ☐ | script exit 0 | 只读 canary |

Codex 每完成一个 Phase：

1. 更新本表；
2. 给出修改文件列表；
3. 给出测试命令；
4. 给出结果；
5. 给出未完成项；
6. **不得自动跳到下一 Phase，除非当前 Gate 明确通过。**

---

# 53. Codex 每阶段统一报告模板

```md
## Phase X Report

### 1. 修改范围
- ...

### 2. 数据库改动
- 无 / ...

### 3. API 改动
- 无 / ...

### 4. UI 改动
- ...

### 5. Forum 联动
- 未启用 / ...

### 6. 幂等
- ...

### 7. 限流
- ...

### 8. 测试
- command:
- result:

### 9. 截图/录屏
- ...

### 10. Console / 404
- ...

### 11. Gate
- PASS / FAIL

### 12. 未解决问题
- ...

### 13. 是否触发生产写
- 必须为 NO

### 14. 是否部署
- 阶段中必须为 NO
```

---

# 54. 最终交付报告模板

```md
# Poster Community Feature Final Report

## UI
- Poster background:
- square grid:
- 4-grid mapping:
- six stats:
- barrage lanes:
- barrage speed:
- continuous feed verified:

## Reaction Backend
- table:
- API:
- sanitization:
- idempotency:
- rate limit:
- moderation:

## Forum
- general:
- creative:
- thread type:
- reaction sync:
- image sync:

## Share Card
- component single source:
- render size:
- cache:
- owner-only:
- legacy share side effect: NONE

## Failure Isolation
- reaction success/forum fail:
- download success/forum fail:

## E2E
- reaction sync=false:
- reaction sync=true:
- image sync=false:
- image sync=true:
- duplicate click:

## Tests
- annual:
- forum:
- build:
- console:
- 404:

## Release
- version:
- commit:
- working tree:
- deploy command:
- deploy_forum_web.sh executed: YES
- exit code:
- service:
- online appVersion:

## Safety
- production reaction POST: NO
- production forum POST: NO
- production load test: NO
```

---

# 55. Codex 任务开场指令（建议直接使用）

```text
本任务不是简单 Poster UI 修改。

它新增：
1. 年度弹幕；
2. 弹幕可选同步 Forum；
3. 年度四格分享图；
4. 分享图可选同步 Forum；
5. Forum 新版块与更名。

请严格按
docs/annual-poster-community-plan.md
（或本主控文档实际保存路径）
分 Phase 执行。

规则：

- 不得一次性实现全部 Phase。
- 每个 Phase Gate 通过后才进入下一阶段。
- 弹幕是独立业务实体，Forum Thread 只是可选同步结果。
- 禁止用 Forum Thread 充当弹幕数据源。
- AnnualShareGrid 必须同时作为页面四格和服务器导出四格的唯一视觉真源。
- 保存图片不得创建 30 天 public share。
- Forum 同步默认勾选，但 primary action 与 Forum sync 必须失败隔离。
- 社区写必须服务端硬编码 general + discussion。
- 所有写操作必须幂等、限流。
- 静态 Poster UI 未通过前禁止实现 Forum 写。
- 全阶段禁止生产社区 POST。
- 最终部署只能使用 scripts/deploy_forum_web.sh。
- 禁止手工 push/build/restart 代替部署脚本。
- 部署脚本失败必须 STOP，不得 fallback。
```

---

# 56. Phase A 推荐首轮实际任务

Codex 第一轮只做：

```text
Phase Annual-Poster-A-StaticRebuild
```

允许修改：

```text
PosterSlide.vue
AnnualShareGrid.vue（新增）
Poster 专用子组件
locales zh/ja
public/annual/poster/*
必要 CSS
```

暂时禁止修改：

```text
server/*
types/forum.ts
forum-db
forum thread service
account-db schema
annual poster renderer
```

Phase A 完成后必须先给：

```text
414×896 reference vs implementation
390×844
430×932
```

以及四格字段真实值截图。

在用户确认静态 Poster 结构后，再进入 Phase B。

---

# 57. 最终不可违反的 12 条规则

1. `background_22.png` 是 Poster 背景。
2. `square_bg.png` 是四格背景，不用 CSS 重画。
3. 四格预览与导出共用 `AnnualShareGrid`。
4. 弹幕不是 Forum Thread。
5. Forum 同步默认开，但可关闭。
6. 弹幕同步固定 `general + discussion`。
7. 图片同步固定 `general + discussion`。
8. 图片帖子正文只有一张分享图。
9. 保存图片不创建 30 天 share。
10. 旧 share/poster API 保持兼容。
11. 全部写操作幂等 + 限流 + 失败隔离。
12. 最终部署只运行 `scripts/deploy_forum_web.sh "<HEAD subject>"`。

---

**状态：Phase A Gate PASS（Gate A passed after user manual multi-viewport visual acceptance）；Phase B 未开始。执行进度以 status.md 为准。**
