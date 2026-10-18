# Developer API：现有只读能力与接入指南

文档对应应用发布 `0.85.0-rc.7`。公开曲库使用 API 路径 `v1`，分析结果中的 `model: v1` 是计算模型；两者与网站发布版本、Contract 版本分别管理。Contract 1.1 维持 `FREEZE_CANDIDATE`，本次没有宣布冻结。

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

主要入口为 `GET /api/v1/taiko/catalog/songs`，一次读取返回 `{versions, items: CatalogSongWithCharts[]}`。每项保留现有 Song 字段并新增 `charts: Chart[]`。独立 `/api/v1/taiko/catalog/charts` 已移除；从 `items[].charts` 获取谱面。新 DTO 不替代或放宽 canonical Song 的 `additionalProperties: false`，不扩展成绩等其他 Song 引用。

本次按产品要求调整默认响应，`CatalogSongsResponse.items` 现在为 `CatalogSongWithCharts[]`。严格旧客户端需更新契约绑定；TypeScript SDK 使用 `songs()`，不再提供 `charts()`，扁平列表可用 `data.items.flatMap(song => song.charts)`。旧 `?include=charts` 请求返回 400，独立 charts 路径返回 404。目录专用 DTO 不扩散到其他 Song 引用；Contract 1.1 仍为候选，schemaRevision 随规范内容更新，不改变已发布字段含义。

Song 保留字符串 songId、中日原始曲名（缺失为 null）、aliases（可为空）、catalogRevision、availability。Chart 直接复用同一次 `catalog()` 的投影，按 songId 线性分组，无逐曲读取，无第二套谱面识别逻辑；版本与 `versions.catalogRevision` 相同。嵌套 charts 与既有内部谱面投影内容完全一致。

- `difficulty`：难度档位 1 简单 / 2 普通 / 3 困难 / 4 鬼 / 5 里鬼，对应旧成绩的 `level`。
- `level`：谱面星级，例如 difficulty=4、level=9 表示鬼 9 星。不是旧成绩的 level。
- 关联旧成绩时使用 `String(song_no) === songId` 和 `record.level === chart.difficulty`；不是拿成绩 level 匹配星级。`tjaCourse = difficulty - 1` 是既有 TJA 映射。
- chartId、type（single/double/unknown）、variant（未知为 null）、availability、catalogRevision 保留原谱面投影。仅从已存在且有效的 level_1…level_5 记录形成谱面；缺少难度或里谱不补造，无谱面时 charts=[]。
- region 为 CN/JP/UNKNOWN，status 为 active/removed/unknown。Chart 的 availability 是现有投影继承的曲库记录元数据，**不是逐难度、逐地区实装证明**。不能因为歌曲上架便认为其所有难度已在中国实装。

公开调用不发送 Authorization；主动附带的 Bearer 仍会被验证，不自动降级为匿名。响应仍受 8 MiB 上限、歌曲源 8 MiB/10000 行、别名源 4 MiB/20000 行等原有限制；超限返回 503，而非放宽资源限制。响应按内容生成 ETag，结构调整会使旧缓存失效。

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

本次修改歌曲目录默认响应并移除独立谱面路由；其他接口、算法、权限、Token、已有授权和数据保持不变。独立的应用授权管理页面仍保留原地址和权限；开发者首页不恢复此前隐藏的旧版授权说明与管理链接。History、Growth、Goal、年度报告不在这四个第三方 API 的文档范围内，本文不宣布整个 API 体系冻结。
