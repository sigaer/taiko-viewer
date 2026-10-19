# Developer API：现有只读能力与接入指南

文档对应应用发布 `0.85.0`（沿用 rc.8 已验收功能）。公开曲库使用 API 路径 `v1`，分析结果中的 `model: v1` 是计算模型；两者与网站发布版本、Contract 版本分别管理。Contract 1.1 维持 `FREEZE_CANDIDATE`，本次没有宣布冻结。

正式地址为 `https://viewer.sakura-bot.cn`。2026-10-18 在此前线上 rc.4 上，使用既有受控 Token 与受控 Source 串行只读预查，以下四个接口均返回 HTTP 200，包括匿名曲库读取；因此移除“仅本地候选、未部署”的过时说明。可用性不是权限承诺：第三方受保护读取仍要求现有已获批、有效 Token 及服务端读取权限，不因文档可见而开放。

| 能力 | GET 路径 | 第三方接入 | 用途 |
| --- | --- | --- | --- |
| 当前成绩 | `/api/developer/userdata/{userid}` | 现有 Developer Token | 当前存档展示、自定义统计 |
| 歌曲、谱面与难度 | `/api/v1/taiko/catalog/songs` | 公开，不发送 Authorization | 曲名搜索、别名与 ID 关联 |
| Rating 与六维 | `/api/developer/userdata/{userid}/rating` | 现有 Developer Token | 综合与六维计算、高 Rating 谱面详情 |
| 推荐游玩谱面 | `/api/developer/userdata/{userid}/recommendations` | 现有 Developer Token | 普通 Rating 推荐列表 |

`{userid}` 是太鼓 Source ID，不是 Viewer 网站账号 ID，也不是其他接口的 `plr_...` 资源标识。服务端保留本人会话等已有能力；第三方示例统一使用 Bearer Token，不复制浏览器 Cookie。歌曲目录默认包含全部已有谱面，不接受查询参数；其他接口参数不变。别名已经包含在曲库内，没有独立 aliases 接口，也没有新增 B30 路径。

## 网站中的指南

登录后的 `/account/developer` 提供中日双语总览、按接口折叠的字段表、cURL/Python 示例和合成 JSON。未申请、待审批、驳回、获批但 Token 失效的用户也能阅读，并看到相应权限提示。申请、掩码、审批记录保持现有范围，不重新显示或自动使用真实密钥。页面加载、展开、复制不请求成绩或分析 API。

完整可解析响应示例与字段类型见 [OpenAPI](developer-api-batch1-openapi.yaml)。网站代码示例与翻译位于 `taiko_viewer/utils/developer-api-guide.ts`，自动化测试执行 cURL/Python 的请求构造和失败分支，并按 OpenAPI 校验合成及隔离 HTTP 响应。

## 真实返回契约

### 当前成绩

仅保留来源数据中存在的 `profile`、`songs`、`achievement`、`dojo`、`_meta`，不为缺省字段补空对象或数组。内部结构来自 Source，可能为 null 或其他 JSON 类型；`songs` 通常为成绩数组，常见 `song_no`、`level`、`high_score` 等不代表每条记录都具有这些字段。递归过滤凭据、Token、Cookie 等敏感键。该接口没有成长历史、年度报告、同步或写入能力。

### 歌曲、谱面与难度

`GET /api/v1/taiko/catalog/songs` 默认返回 `{versions, items: CatalogSong[]}`，无需 Token 或查询参数。`versions` 仅包含 `contractVersion`、`schemaRevision`、`catalogRevision`，对应契约、响应结构与整份曲库内容。歌曲与谱面从同一次读取生成，版本只在顶层声明一次。

每首歌曲只有 `songId`（字符串）、`song_name`、`song_name_jp`（曲名缺失为 null）、`aliases`（可为空数组）、`status` 和 `charts`。`status` 为 active 上架、removed 下架、unknown 来源未标明。这是歌曲状态，不代表逐难度或逐地区的实装状态。

每个谱面只有 `difficulty` 和 `level`：

- `difficulty`：1 简单 / 2 普通 / 3 困难 / 4 鬼 / 5 里鬼，对应旧成绩的 `level`。
- `level`：谱面星级。例如 difficulty=4、level=9 表示鬼 9 星。
- 关联成绩使用 `String(song_no) === song.songId` 与 `record.level === chart.difficulty`。谱面在所属歌曲内按 difficulty 区分。
- 只保留已有谱面投影实际产生的难度，不补造缺少的难度或里谱；无谱面时 charts=[]。

rc.8 精简了 rc.7 的目录响应：移除嵌套 chartId/songId、tjaCourse、type/variant、region、逐项 catalogRevision 和无关的 null 版本字段；歌曲 availability.status 收敛为 status。严格客户端应更新 `CatalogSongsResponse` 及生成绑定。内部 canonical Song、Chart、ApiReadVersions 保持原定义，成绩等其他响应不采用目录精简 DTO。Contract 1.1 仍为候选，未宣布冻结。

独立 `/api/v1/taiko/catalog/charts` 仍已删除；SDK 使用 `songs()`，扁平谱面列表可通过父歌曲和 charts 组合，歌曲 ID 从父项读取。旧 include 查询仍返回 400，旧 charts 路径仍返回 404。

公开调用不发送 Authorization；主动附带的 Bearer 仍会被验证。响应仍受 8 MiB 上限、歌曲源 8 MiB/10000 行、别名源 4 MiB/20000 行等原有限制；超限返回 503，不返回截断目录。ETag 按内容生成，结构变化会使旧缓存失效。

### Rating

响应包含 `playerId`（本次 Source ID）、`scoreRevision`（songs 与 _meta 摘要）、`model`（v1）、`aggregation`（per-dimension-top20）、整数 `topN`（当前 20）、`duplicateHandling`（preserve）、`overallRating`（数字或 null）、整数 `sampleCount`、`dimensions`、`topSongs` 和整数 `topSongsCount`。

六维数组元素是 `{key, value}`；键为 big_song、stamina、speed、accuracy_power、rhythm、complex。六维各自按现有 Top-N 规则聚合，综合值复用 Core 的自身聚合规则，不是简单平均最多 30 个详情。没有正的综合结果时 overallRating 为 null；空样本时 sampleCount 为 0、六维值为 0、topSongs 为空。

详情按谱面 rating 降序，最多 30 个。每项包含数字 songId、level、字符串 title（可为空）、数字 rating，以及六维键到数字的 dimensions **对象**。顶层 dimensions 是数组，二者不可混同。`sampleCount` 可能大于详情数。没有把 topN 改成 30，也没有复制或修改业务算法。

### 推荐

响应 `{playerId, scoreRevision, model, basis, items}`，basis 固定为 rating。items 最多 20 项，可为空或不足上限。每项只有 `songId`、`level`（整数）、`title`（字符串）、`isUnplayed`（布尔）、`candidateIndicator`、`referenceIndicator`、`deviationRatio`（数字）、`inStrictRange`（布尔）。

候选指标来自谱面，参考指标是个人 Rating 前 20 样本对应谱面指标的中位数。deviationRatio 是 `(candidate-reference)/reference` 的比例，0.05 表示 +5%；返回数值经过舍入。严格范围为参考指标的 90%～105%。isUnplayed 依据合并重复版本后的样本，而不是查询全平台历史。

保持已实现排序：严格范围内未玩与已玩候选优先，按现有分组补足；严格组内按算法平衡分排序，宽松组内按绝对指标偏离排序。响应没有暴露该平衡分，也不是按某个返回字段全局排序。没有推荐理由、预期提升分数、数量或六维选项。

## 限制、缓存与错误

- 当前成绩与两个分析接口共用 `developer_userdata` UTC 日次额度；曲库使用独立计数。配置决定实际额度，不承诺固定调用次数。429 后停止即时重试，按响应和额度重置情况处理；实现不保证 Retry-After。
- 分析复用安装的 `taiko_bot.offline.score_calculator` 与 `taiko_application.query.recommendation`，没有 Core 副本。进程内与全局 flock 保证单分析任务，Worker 地址空间 1 GiB、数值库线程 1、期限 60 秒，admission 持续到 PID 退出。本次没有更改这些限制。
- 当前生产 `/api/developer/` 代理使用现有 60 秒读取超时（不是普通页面 location 的 300 秒）。客户端分析示例使用连接 5 秒／读取 90 秒，当前成绩和曲库使用读取 20 秒。较长客户端等待不延长网关期限，可能仍收到 502/504，且响应不一定是 JSON。不得承诺固定完成时间或默认并发调用。
- 503 可来自 ANALYSIS_BUSY、计算期限、输入限制、Publication 不可用或计算前后数据摘要变化。只做有限次数的串行退避重试；持续失败应报告维护者。401 检查密钥有效性，403 检查现有权限，404 检查 Source/数据或接口开关；400 检查请求参数。
- 受保护响应为 `private, no-cache, must-revalidate` 并带 ETag，不是此前文档声称的 no-store。曲库为 `public, max-age=60, must-revalidate`。If-None-Match 命中可返回无正文 304，仍经过鉴权；分析也可能照常计算并计数。示例不发送条件头，客户端若自行添加须先处理 304 再读 JSON。
- 曲库错误体为 `{code, message, requestId}`；受保护接口沿用现有 H3 错误格式，可能有 data.code，不应假定所有错误具有相同 JSON 结构。示例先检查 HTTP 状态，再解析 JSON；不输出 Token。

0.85.0 包含此前默认完整曲库、独立谱面路由移除和 rc.8 精简 DTO 的迁移；本次转正保持 rc.8 接口、算法、权限、Token、已有授权和数据不变。独立的应用授权管理页面仍保留原地址和权限；开发者首页不恢复此前隐藏的旧版授权说明与管理链接。History、Growth、Goal、年度报告不在这四个第三方 API 的文档范围内，本文不宣布整个 API 体系冻结。

本批交付与客户端迁移示例见 [0.85.0 发布说明](releases/0.85.0.md)。
