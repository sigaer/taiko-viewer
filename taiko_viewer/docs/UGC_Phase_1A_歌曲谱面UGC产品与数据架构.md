# Sakura Taiko Viewer UGC Phase 1A：歌曲 / 谱面 UGC 产品与数据架构

状态：设计规格，未实施

基线版本：0.49.8

本文只定义审计结论、产品决策、数据模型、API contract、权限和迁移路径。本文不执行数据库 migration、不新增 API、不改歌曲页、不修改 Forum、不部署，也不 bump 版本。

## 1. 审计结论

### 1.1 Account / Identity

- web_user_accounts.id 是 Viewer 登录账号的稳定主键；登录使用 username/email + password，会话由 web_user_sessions 和 stv_session cookie 管理。
- web_taiko_bindings 是账号与 Taiko ID 的绑定关系。一个账号可以有多个 binding，但只有一个 is_current = 1；source 目前包括 wahlap、hiroba、manual。
- currentBinding 是成绩读取上下文，不是适合作为 UGC 作者身份的主键。切换 binding 不应转移或隐藏用户过去的贡献。
- 当前公开身份实际使用账号 username、头像和 Forum badge；没有独立的 display_name 字段。UGC 应复用这套公开身份投影，不能复制 email、Taiko ID、score token 或绑定凭证。

证据：server/utils/account-db.ts、server/internal/account/shared.ts、server/internal/forum/shared.ts。

### 1.2 Score / Verified Play

当前没有关系型成绩表。成绩来自当前 binding 对应的 userdata/<taikoId>data.json，记录结构为：

~~~ts
type UserdataSong = {
  song_no: number;
  level: number;
  high_score?: number;
  stage_cnt?: number;
  clear_cnt?: number;
  full_combo_cnt?: number;
  dondaful_combo_cnt?: number;
  highscore_datetime?: string;
  update_datetime?: string;
};
~~~

- 真实成绩 key 是 (song_no, level)，其中 level 为 1 简单、2 普通、3 困难、4 魔王、5 里谱；这与 song_data.json 的 level_1..level_5、rating_structured_with_ids.json 的 (id, level)、tja_note_counts.json 的组合键一致。
- highscore_datetime 是最高分更新时间，update_datetime 是该条记录更新时间；当前没有可靠的 played_at 历史事件。
- 现有 hasEffectiveScoreRecord() 只要 high_score、判定数、游玩次数、连段或成绩次数任一字段为正，就认为记录有效。该判断适合“有成绩记录”，不等同于完整游玩历史。
- manual binding 的成绩可由用户编辑，不能单独作为“已验证游玩”证据；wahlap/hiroba 的本地有效成绩可以在贡献提交时生成 verified_play = true。

结论：没有成绩记录时不禁止贡献，贡献保留为 verified_play = false；成绩只用于展示可信度，不作为参与资格门槛。

### 1.3 Song / Chart

- 歌曲主数据来自 songs/song_data.json，详情 API 是 /api/content/songs/:id，页面是 pages/songs/[id].vue。
- 当前详情页以歌曲 ID 加 selectedTrack 展示谱面：EASY/NORMAL/HARD/ONI/EDIT 对应 difficulty code 1..5，里谱对应 5。
- 当前页面已有歌曲基本信息、六维雷达、音频预览、谱面图片、最大物量和登录用户成绩；没有 UGC 区域。
- 当前 (song_id, difficulty_code) 足够在现有目录中定位一个 Chart，但没有独立 Chart 表、版本号或别名迁移机制，因此不能直接当作永久 UGC 外键。

结论：Phase 1A 以 Chart-level UGC 为主；实施前先建立轻量 ugc_charts registry，将当前 (song_id, difficulty_code) 映射为不可变内部 chart_id。song_id + difficulty 只作为当前 catalog 的 source key。

### 1.4 Forum / Existing Reactions

现有 Forum 是线程模型：

- forum_threads：版块、作者、标题、摘要、内容块、可选 song_id/difficulty_type/level、状态、统计值。
- forum_posts：楼层与楼中楼回复。
- forum_thread_likes、forum_post_likes：账号级唯一 like。
- forum_moderation_logs：只记录线程管理动作；没有通用 report 表。
- Forum 帖子创建要求标题、版块和内容块，歌曲关联是可选字段；这与“打开谱面后点选结构化经验”的低摩擦流程不匹配。

结论：不把 difficulty vote、tag vote 或 Short Tip 塞进 forum_threads/forum_posts。UGC 使用独立结构化表；复用账号、权限、公开 badge、状态审计和“每用户一条关系”的数据库原则。未来 Community 页面读取 UGC 聚合，而不是把歌曲页嵌入 Forum thread。

证据：server/utils/forum-db.ts、server/utils/forum/threads.ts、types/forum.ts。

## 2. 产品边界与核心决策

### 2.1 Context level

| 内容 | Context | Phase 1A 决策 |
| --- | --- | --- |
| 歌曲喜好、音乐评价 | Song | Deferred |
| 体感难度 | Chart | P0 |
| 谱面标签 | Chart | P0 |
| FC / 全良难度 | Chart | P1，暂不进入首个 MVP |
| 一句话谱面建议 | Chart | P0 |
| Tip helpful | Chart Tip | P0 |

同一歌曲的魔王与里谱可以拥有完全不同的难度、标签和断点，不能以 Song 作为这些数据的唯一归属。

### 2.2 体感难度

采用五档 ordinal 值，存原始用户选择：

~~~ts
type ChartDifficultyVote = -2 | -1 | 0 | 1 | 2;
~~~

推荐内部含义：-2 明显偏易、-1 偏易、0 合理、1 偏难、2 明显偏难。客户端文案可本地化，但数据库只存整数。

- 一个账号一个 Chart 一票；PUT 覆盖，清除时删除当前行。
- 聚合保留 count、五档 distribution、mean（仅供分析，最多一位小数）和 verifiedCount；页面首屏不以平均值替代分布。
- n < 3 不输出“玩家普遍”“公认”等强结论，只显示“1 人认为偏难”或“2 人意见分散”。
- n >= 3 显示分布；只有最高档占比至少 50% 时生成主摘要，否则显示“意见较分散”。
- 默认一起聚合 verified 与 unverified，另返回 verifiedCount；不做权重公式，不让一个人的 binding 状态改变票的数学权重。
- 阈值集中在服务层常量，不散落前端。

### 2.3 FC / 全良难度

不进入首个 P0 MVP。10.4 在当前系统没有稳定且用户容易理解的量尺，直接创造会制造伪精确。Phase 2 若需要，先采用与体感难度相同的 ordinal 体系或经过验证的独立五档，不存小数星级。

### 2.4 Controlled Tag taxonomy

普通用户只能从管理侧词表选择，不能自由创建、负投票或编辑标签文字。建议首批词表：

| 分组 | 初始标签 |
| --- | --- |
| 节奏 | 节奏难、偶数、24 分、变速 |
| 技术 | 复合、长复合、滚奏、连打、大音符 |
| 体力 | 体力、耐力 |
| 视认与速度 | 高速、低速、视认 |
| 结构与难点位置 | 后半难、局部难 |

- 一个用户每个 Chart 最多选择 5 个标签；PUT 整体替换自己的集合，允许取消。
- 标签只支持正向选择，不引入“反标签”。
- 聚合返回每个标签的 count、percentage 和分组；公开首屏最多展示 6 个。
- count < 2 不标为“常见”，但在贡献详情或样本不足状态下可显示“1 人选择”。
- Tag 只有 active/deprecated，deprecated 不再可选但历史 vote 保留；通过稳定 slug 和 label_key 改名，历史数据不改写。
- 新增、改名、deprecated 由 Admin 操作并写管理审计；不提供普通用户创建入口。

### 2.5 Short Tip

- 只存 body，不存 title、section、content blocks 或图片。
- 推荐最多 120 个 Unicode 字符，服务端按 code point 计数并统一空白；前端显示剩余字数。
- 同一账号 / 同一 Chart 最多一条 active tip；PUT 创建或编辑，DELETE 软删除并可由作者重新编辑自己的记录。
- Tip 不进入 Forum thread，不支持回复树，不支持复杂 reaction。
- Helpful 是单向布尔关系，一个用户一个 Tip 一条；作者不能给自己的 Tip helpful。用户可以取消 helpful。
- Tip 排序：helpful DESC, created_at DESC, id DESC；隐藏和删除的 Tip 不参与公开聚合。

### 2.6 Contribution identity 与 Verified Play

推荐采用“登录账号可贡献 + 可选已游玩标记”：

1. 作者和所有唯一约束使用 web_user_accounts.id。
2. 提交时读取当前 binding；仅当 binding 非 manual 且 userdata 中存在匹配 (song_no, level) 的有效成绩记录时，写入 verified_play = true。
3. verified_play 是本次贡献的证据快照，不随用户切换 currentBinding 回溯改写；公开只显示“已游玩”徽标，不显示 Taiko ID 或成绩详情。
4. 用户确实玩过但 Viewer 尚未同步成绩时仍允许贡献，标记为未验证。这样不会把缓存新鲜度误当成参与资格。

不要求 currentBinding，也不要求成绩证明才能写入；可通过账号登录、速率限制、唯一约束和举报机制控制滥用。未来若数据可靠性和参与率验证充分，再考虑“仅已游玩筛选”。

## 3. 权限矩阵

| 角色 | 公开聚合 / Tip | 写入 vote/tag/tip | Helpful | 举报 | 管理 |
| --- | --- | --- | --- | --- | --- |
| Guest | 允许 | 登录流程后继续 | 登录流程后继续 | 登录流程后继续 | 无 |
| Logged Account | 允许 | 允许，verified 可为 false | 允许，不能给自己 | 允许，每 Tip 一次 | 无 |
| Bound Account | 同上 | 同上；满足条件时标记 verified | 同上 | 同上 | 无 |
| Verified Player | 同上 | 同上；仅是展示/筛选信号 | 同上 | 同上 | 无 |
| Moderator | 同上 | 同上 | 同上 | 同上 | 隐藏/恢复、处理举报 |
| Admin | 同上 | 同上 | 同上 | 同上 | 全部管理、Tag 词表、审计 |

Guest 点击写操作时复用现有 /account/login 流程，不新建 UGC 登录 Modal。个人贡献状态只在 authenticated endpoint 返回。

## 4. 推荐数据架构

### 4.1 A 与 B 的比较

| 方案 | 优点 | 风险 | 结论 |
| --- | --- | --- | --- |
| A：每种内容独立表 | 结构清楚、约束直接、聚合查询可解释；适合 vote/tag/tip 的不同生命周期 | 表数量较多，需要少量共用 moderation/report 设施 | 推荐 |
| B：ugc_content + ugc_vote + ugc_relation | 初期表少，未来类型扩展看似方便 | polymorphic target、JSON payload、状态和唯一约束变复杂；difficulty vote 被迫伪装成内容 | 不推荐作为 Phase 1 |

推荐是“A + 小型共享设施”：ugc_charts、ugc_tags、chart_difficulty_votes、chart_tag_votes、chart_tips、chart_tip_helpful、chart_tip_reports，另加专用 moderation log。不要创建可以容纳所有类型的 JSON UGC 表。

### 4.2 SQL 草案（仅设计，不执行）

~~~sql
CREATE TABLE ugc_charts (
  chart_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  song_id INT NOT NULL,
  difficulty_code TINYINT UNSIGNED NOT NULL,
  source_key VARCHAR(64) NOT NULL,
  catalog_revision VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_ugc_charts_source (source_key),
  UNIQUE KEY uniq_ugc_charts_catalog_pair (catalog_revision, song_id, difficulty_code),
  KEY idx_ugc_charts_song (song_id, difficulty_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ugc_tags (
  tag_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(64) NOT NULL,
  label_key VARCHAR(128) NOT NULL,
  group_key VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_ugc_tags_slug (slug),
  KEY idx_ugc_tags_status_group (status, group_key, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chart_difficulty_votes (
  chart_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  value TINYINT NOT NULL,
  verified_play TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (chart_id, user_id),
  CONSTRAINT chk_chart_difficulty_vote_value CHECK (value BETWEEN -2 AND 2),
  CONSTRAINT fk_chart_difficulty_votes_chart FOREIGN KEY (chart_id) REFERENCES ugc_charts(chart_id) ON DELETE CASCADE,
  CONSTRAINT fk_chart_difficulty_votes_user FOREIGN KEY (user_id) REFERENCES web_user_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chart_tag_votes (
  chart_id BIGINT UNSIGNED NOT NULL,
  tag_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  verified_play TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (chart_id, tag_id, user_id),
  CONSTRAINT fk_chart_tag_votes_chart FOREIGN KEY (chart_id) REFERENCES ugc_charts(chart_id) ON DELETE CASCADE,
  CONSTRAINT fk_chart_tag_votes_tag FOREIGN KEY (tag_id) REFERENCES ugc_tags(tag_id) ON DELETE RESTRICT,
  CONSTRAINT fk_chart_tag_votes_user FOREIGN KEY (user_id) REFERENCES web_user_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chart_tips (
  tip_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  chart_id BIGINT UNSIGNED NOT NULL,
  author_user_id BIGINT UNSIGNED DEFAULT NULL,
  body_text VARCHAR(120) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  verified_play TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME DEFAULT NULL,
  UNIQUE KEY uniq_chart_tip_author (chart_id, author_user_id),
  KEY idx_chart_tips_public (chart_id, status, updated_at),
  CONSTRAINT fk_chart_tips_chart FOREIGN KEY (chart_id) REFERENCES ugc_charts(chart_id) ON DELETE CASCADE,
  CONSTRAINT fk_chart_tips_author FOREIGN KEY (author_user_id) REFERENCES web_user_accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chart_tip_helpful (
  tip_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tip_id, user_id),
  CONSTRAINT fk_chart_tip_helpful_tip FOREIGN KEY (tip_id) REFERENCES chart_tips(tip_id) ON DELETE CASCADE,
  CONSTRAINT fk_chart_tip_helpful_user FOREIGN KEY (user_id) REFERENCES web_user_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chart_tip_reports (
  report_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tip_id BIGINT UNSIGNED NOT NULL,
  reporter_user_id BIGINT UNSIGNED DEFAULT NULL,
  reason VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  note VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME DEFAULT NULL,
  resolved_by_user_id BIGINT UNSIGNED DEFAULT NULL,
  UNIQUE KEY uniq_chart_tip_reporter (tip_id, reporter_user_id),
  KEY idx_chart_tip_reports_queue (status, created_at),
  CONSTRAINT fk_chart_tip_reports_tip FOREIGN KEY (tip_id) REFERENCES chart_tips(tip_id) ON DELETE CASCADE,
  CONSTRAINT fk_chart_tip_reports_reporter FOREIGN KEY (reporter_user_id) REFERENCES web_user_accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_chart_tip_reports_resolver FOREIGN KEY (resolved_by_user_id) REFERENCES web_user_accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chart_ugc_moderation_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  target_type VARCHAR(16) NOT NULL,
  target_id BIGINT UNSIGNED NOT NULL,
  operator_user_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(32) NOT NULL,
  reason VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_chart_ugc_moderation_target (target_type, target_id, created_at),
  CONSTRAINT fk_chart_ugc_moderation_operator FOREIGN KEY (operator_user_id) REFERENCES web_user_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
~~~

说明：Tip 的唯一键保证删除后仍可由原作者编辑同一行；账号删除时 Tip 保留为匿名内容，vote/tag/helpful 按账号删除。ugc_charts 的 catalog_revision 允许未来歌曲目录重编号或替换时建立新 chart，并通过应用层 alias 迁移旧引用。

### 4.3 TypeScript contract 草案

~~~ts
type ChartUgcSummary = {
  chart: { chartId: string; songId: number; difficultyCode: 1 | 2 | 3 | 4 | 5 };
  difficulty: {
    count: number;
    verifiedCount: number;
    distribution: Record<"-2" | "-1" | "0" | "1" | "2", number>;
    mean: number | null;
    summary: "insufficient" | "mixed" | "easy" | "balanced" | "hard";
  };
  tags: Array<{ slug: string; labelKey: string; groupKey: string; count: number; percentage: number }>;
  tips: Array<{
    tipId: string;
    body: string;
    helpfulCount: number;
    verifiedPlay: boolean;
    author: { displayName: string; avatarUrl: string };
    createdAt: string;
  }>;
};

type ViewerChartUgcState = {
  difficultyVote: -2 | -1 | 0 | 1 | 2 | null;
  tagSlugs: string[];
  tip: { tipId: string; body: string; status: "active" | "hidden" | "deleted" } | null;
  helpfulTipIds: string[];
};
~~~

## 5. API contract 草案

### 5.1 Public

- GET /api/content/songs/:songId/ugc?difficulty=1..5：返回一个 Chart 的 aggregate、公开 Tip 和 chart identity；不返回 viewer state。使用匿名 SWR/公开缓存。
- GET /api/content/songs/:songId/ugc/tips?difficulty=1..5&cursor=...：Tip 超过首屏时分页；首个 MVP 可以由 summary 返回前 3 条，避免拆成多个首屏请求。

### 5.2 Authenticated

- GET /api/account/charts/:songId/:difficulty/ugc/me：返回 ViewerChartUgcState，Cache-Control: private, no-store。
- PUT /api/account/charts/:songId/:difficulty/ugc/difficulty body { value: -2|-1|0|1|2|null }：幂等覆盖或清除。
- PUT /api/account/charts/:songId/:difficulty/ugc/tags body { slugs: string[] }：校验 active tag、最多 5 个，事务内替换。
- PUT /api/account/charts/:songId/:difficulty/ugc/tip body { body: string }：创建或编辑唯一 Tip。
- DELETE /api/account/charts/:songId/:difficulty/ugc/tip：作者软删除自己的 Tip。
- PUT /api/account/chart-tips/:tipId/helpful body { enabled: boolean }：幂等设置；服务端拒绝作者 self-helpful。
- POST /api/account/chart-tips/:tipId/reports body { reason: "spam"|"abuse"|"advertising"|"link"|"duplicate"|"other" }：同一用户同一 Tip 只允许一条 pending/历史报告。

### 5.3 Moderator / Admin

- 不把现有 /api/forum/moderation/action 扩展为 UGC polymorphic action；新增专用 POST /api/admin/chart-ugc/moderation，body 包含 targetType、targetId、action、reason。
- 新增 GET/POST/PATCH /api/admin/chart-ugc/tags 管理 controlled vocabulary。
- 报告队列只在后台读取，处理结果写 chart_tip_reports 和 chart_ugc_moderation_logs。

### 5.4 Cache 与 SSR

推荐 public aggregate 与个人状态分离：

1. SSR/Guest 首先请求 public summary，可缓存、可进入歌曲详情 canonical HTML。
2. 登录后再请求 /me，只在客户端合并按钮状态和“我的贡献”。
3. 不把 aggregate 与 user state 放进同一个可共享缓存 key；如果未来必须混合 endpoint，必须 private, no-store，不能依赖 cookie 自动 Vary。

## 6. Aggregation 与反滥用

- 所有聚合只统计 status = active 的 vote、tag vote、Tip；删除/隐藏立即从公开结果剔除。
- 采用数据库主键/唯一键保证一人一票、一人一 Chart 一组 tag、一人一 Tip、一人一 helpful、一人一举报。
- vote/tag/tip/helpful/report 写操作按账号和 IP 做服务层 rate limit；MVP 不做信誉权重、Bayesian/Wilson、ranked voting 或自动下架阈值。
- Tip 文本限制 120 Unicode 字符；拒绝 HTML、控制字符和明显非法链接格式，管理员仍可人工处理绕过规则的内容。
- 状态只用 active、hidden、deleted。用户删除自己的 Tip 使用 deleted；管理员隐藏使用 hidden；恢复回 active。不为 MVP 引入 pending/approved 工作流。
- 举报后内容继续展示，直到管理员处理；reason 至少为 spam、abuse、advertising、link、duplicate、other。
- 举报者必须登录；唯一键防止重复举报。被举报 Tip 不自动隐藏，不做“多人举报即下架”。
- 提交体感、标签和 Tip 可 optimistic update，但失败必须回滚并重新请求 public summary/me；Tip 创建不建议在网络不稳定时伪造成功。

## 7. Song Detail 插入方案

当前页面真实结构是左侧歌曲信息、中间六维雷达、右侧试听与谱面预览，AccountSongScores 在 detail-main 之后。建议不重排既有信息，只在 detail-main 之后、AccountSongScores 之前增加一个 full-width ChartUgcSection：

~~~text
歌曲信息 / 六维雷达 / 试听与谱面预览
────────────────────────────
ChartUgcSection
  当前谱面（复用 selectedTrack）
  玩家体感（分布 + 我的投票）
  谱面标签（分组 + 选择入口）
  玩家提示（最多三条 + helpful）
────────────────────────────
我的成绩
~~~

- 默认只展示 aggregate，不打开编辑器；贡献入口是 inline 控件或移动端 compact bottom sheet。
- 复用现有 selectedTrack 和 fumenDefs，切换谱面时只替换一个 summary，不建立歌曲级混合投票。
- Guest 看完整公开内容，点击操作进入现有登录页。
- Empty state 不堆叠零计数：无投票时只显示“还没有玩家留下体感”和一个首个贡献入口；无 Tip 时显示单行入口；Tag 无数据时隐藏统计列表。
- 移动端优先：五档按钮、标签 chips、120 字输入和 helpful 按钮均可在单手宽度内完成；不使用多级下拉和大型论坛表单。

## 8. SEO、隐私与删除语义

- 歌曲详情的 canonical URL 仍是 /songs/:id；公开 aggregate、最高 3 条 active Tip、常见标签可 SSR，增加歌曲页长尾内容。
- 不为单个 Tag、单个 vote 或单个 Tip 创建可索引 URL；不创建 Tip 独立页面。
- 公开作者只返回当前 username/display identity、头像和必要的 verified badge；不返回 email、内部 user ID、Taiko ID、score token、绑定来源凭证或原始成绩。
- 用户改 username 后，Tip API 读取新身份；不把旧 username 冗余写入 Tip。
- 用户删除账号时：Tip 行保留并匿名化为“已注销用户”；vote/tag/helpful 删除，聚合计数相应减少；report 的 reporter 可置空但管理员处理记录保留。
- 用户切换、移除或重新绑定 Taiko ID 不修改既有 UGC 的作者和 verified_play 快照。

## 9. Cold Start 与展示规则

当多数 Chart 只有 0～2 个贡献时，页面仍通过“可贡献且可验证”的结构保持价值：

- 官方歌曲、难度、六维、物量和成绩继续作为稳定信息；UGC 是补充层，不替代官方数据。
- n = 0：显示轻量首个贡献入口，不显示空的百分比图表。
- n = 1/2：显示具体人数和分布，不使用“玩家公认”；Tip 以时间排序并保留“暂无更多玩家反馈”的简短状态。
- 只在 n >= 3 时生成强摘要；标签只在至少 2 人选择后进入“常见标签”区域。
- 已验证人数单独展示，帮助用户判断样本质量，但不把未验证贡献隐藏掉。

## 10. MVP 分层与实施顺序

### P0

1. ugc_charts registry 与当前 catalog (song_id, difficulty_code) 映射。
2. 五档体感难度、分布、少样本摘要、我的 vote。
3. Controlled Tag 词表、分组、最多 5 个、我的 tags。
4. 120 字单条 Tip、编辑/删除、helpful、基础排序。
5. Guest read、登录 write、verified snapshot、匿名公开身份。
6. active/hidden/deleted、用户自删、举报、管理员处理和审计日志。
7. public summary 与 private /me 分离缓存，以及歌曲详情插入点。

### P1

- FC 难度 / 全良难度（先完成量尺可理解性验证）。
- Tip 分页、更多排序和贡献历史。
- UGC Profile、Community 聚合视图、仅已验证筛选。
- catalog revision alias 工具和数据质量报表。

### Deferred

- 回复树、长文编辑器、图片 Tip。
- reputation 权重、复杂 reaction、负投票。
- 自由创建 Tag、Tag 页面和大量 indexable URL。
- 创作者关注、实时通知、自动审核或举报阈值下架。
- Song-level 喜好/音乐评价，除非有独立产品需求。

## 11. Migration / 开发计划（不执行）

1. 先写只读 chart registry 校验脚本：遍历 song_data.json、rating、note count，报告缺失或重复 (song_id, difficulty_code)；不写生产 DB。
2. 设计并评审 ugc_charts 与 Tag seed；确认 catalog revision 和旧 chart alias 策略。
3. 在独立 migration 中创建上述表、索引、约束和初始 controlled vocabulary；migration 必须可回滚且不改 Forum 表。
4. 实现 service 层的 chart resolve、verified-play 检查、聚合常量和 moderation 权限；数据库约束作为最终一致性边界。
5. 实现 public summary、private /me 和幂等 write API；补充 API contract/type tests、少样本聚合测试、缓存隔离测试和 self-helpful 测试。
6. 实现 ChartUgcSection，先在 staging 验证移动端、SSR、登录跳转和失败 rollback，再按 Viewer 部署规则发布。

本阶段停止在规格确认，不执行以上 migration、API、UI 或部署步骤。

