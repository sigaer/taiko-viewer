# 数据所有权审计

**当前没有覆盖全平台的单一“用户表”或单一“事实库”。** 权威必须按领域和版本说明。成绩读取主要依赖中心 JSON，但中心 JSON 由多个独立 Writer 修改；放在同一台设备不等于 single writer。

证据分级：源码可证为 Observed；根据代码推导的后果为 Inference；未查 DB/私有数据、未测外部可达性为 Unknown。本轮未连接任何数据库。

## User：谁定义用户

| 身份 | 定义者 / 存储 | 绑定关系与边界 |
| --- | --- | --- |
| Viewer account | Viewer `web_user_accounts.id`；session 引用 user_id | Web 登录、Forum、Goal、measurement 的 owner；不是 taikoId |
| 街机/上游账号 | Wahlap/Hiroba 外部 ID | 平台不能自行定义官方身份；导入后以字符串 taiko_id/源标识引用 |
| Web Taiko binding | `web_taiko_bindings` | user_id → taiko_id，源码有 taiko_id 唯一约束；称号变更验证；current 是 Web 选择 |
| Bot identity | QQ/OneBot 等平台适配层的 identity key；中心 MySQL `bind.qq` | `bind.id` 是 taiko ID；有槽位、source、is_current；不要把 `qq` 列必然理解为纯 QQ 号码 |
| Web ↔ QQ | `web_user_qq_bindings` | 单独验证表；不是因为两个 ID 字符串一样就自动归并 |
| 手动账号 | Viewer `taiko_manual_accounts` | 平台生成 `98` 前缀 ID；Viewer/bot owner 与短期 claim code；不是官方成绩证明 |
| Developer token owner | `web_developer_tokens.user_id` | 开发者申请人的 Viewer account；**不代表 token 拥有所有 taiko_id 的成绩授权** |
| Public score token | 中心 `public_score_tokens.taiko_id` | 以凭证映射单个成绩账号；与开发者 Token 是两套机制 |
| 旧内容管理用户 | Java `tb_user` / JWT | 管理内容的独立身份域；未证实和 Viewer account 有迁移或统一映射 |

[E09](evidence-index.md#e09)、[E10](evidence-index.md#e10)、[E11](evidence-index.md#e11)、[E12](evidence-index.md#e12)、[E30](evidence-index.md#e30)。B SQLite 有旧 bind/token 表，但主绑定命令已委托中心；其本地表与中心的实时一致性 Unknown。

## Score：谁产生、修改、读取

平台的持久记录主要使用 `(song_no, level)`，不是统一的 `song_id/chart` 对象。对外投影常叫 `songId/difficultyType`；跨库相同曲的去重由 duplicate_versions 等规则实现。

| 审计字段 | 中心记录 / 转换 | 来源及语义 |
| --- | --- | --- |
| song_id / chart | song_no / level；前端再转 difficultyType | 曲库和上游 ID，经别名/重复版本映射；TJA course 0–4 不能直接当成绩 level 1–5 |
| score | high_score | 上游最佳成绩或手动编辑/导入结果；不是逐次 play event |
| good / ok / ng | good_cnt / ok_cnt / ng_cnt | Hiroba good/ok/bad 映射；Rating 的 GREAT 对应 good_cnt，GOOD 对应 ok_cnt，命名须显式转换 |
| combo | combo_cnt | Hiroba max_combo；另有 stage_cnt、pound_cnt |
| rank | best_score_rank | Wahlap rank 或 Hiroba badge 映射；不等于 clear/crown |
| clear / fc / df | clear_cnt / full_combo_cnt / dondaful_combo_cnt | 计数或来源解析值，通常以 `>0` 判定；不能把互相替代的 UI 图标当同一事实字段 |
| 时间 | highscore_datetime / update_datetime / `_meta.ts` 等 | 上游记录时间、同步观察时间不同；Hiroba normalize 将部分时间填为当前抓取时间，不可据此证明精确游玩时刻 |

来源和写入者：[E05](evidence-index.md#e05)、[E13](evidence-index.md#e13)、[E14](evidence-index.md#e14)。

| Writer | 输入 | 实际修改 | 读取者 |
| --- | --- | --- | --- |
| R `update_user.getUserData` | Wahlap Cookie + official API | 规范化后调用 Python save_userdata；考虑 web_song_locks | bot、Viewer、公开成绩 API、后续同步 |
| R Hiroba sync | Hiroba client/HTML parser/credentials | canonical profile/songs/achievement/dojo → 同一个 Python Writer | 同上 |
| Viewer account songs/manual | 已登录用户当前绑定、编辑/创建/认领 | TS writeUserdataWithHistory；部分写锁与 Web song locks | bot、Viewer、第三方读取路径 |
| Viewer Kinoko current/history import | 导入载荷、来源标记 | current 和导入历史；不等于官方现场游玩 | Growth replay、Viewer、bot |
| R sync dispatch local target | 运行树先刷新 Wahlap，再读取现有 JSON | 再写 current + delta H，标记 sakura-bot-sync | 中心读取者；Growth 明确排除这种 transfer observation |
| A/B merged_bind u0 | 多账号 C/H | 合并的派生 userdata 和历史 | 渲染/比较；不应被当成新官方账号 |
| B userdata_provider | Viewer 响应 | 本地原子缓存，不写回中心 | 本地算法/图片 |

**中心的“最佳记录集合”是产品当前状态的主要权威，不是官方原始不可修改账本。** Web 编辑/导入能改变它；锁定记录可保留人工结果。Python `_load_locked_song_keys` 出错时返回空集合，锁保留可能 fail-open。这是可靠性风险，不证明发生过覆盖。

## History：snapshot、measurement、fact、cache

| 数据 | 类型 | 权威性与恢复含义 |
| --- | --- | --- |
| `userdata/<id>data.json`（通常口头称 userdata.json） | current state，完整投影 C | 当前读取权威；可修改、会被覆盖；不能恢复所有过去事件 |
| `userdata/<id>/data_*.json` | full/delta snapshot H | 平台观察证据；可回放到观测状态；非逐次街机事件、非天然无重复 append-only log |
| `_meta.source/account/topology/schema/hash` | provenance 元数据 | 可检查来源连续性与内容一致性；无签名，不是跨不可信 Writer 的真实性证明 |
| `daily-ability-v1-top20.json` / v2 | 持久 measurement archive | Python 在 snapshot 时记录的当日能力；已有过去日冻结，当日可由更新 snapshot 替换；不是可随意丢弃的缓存 |
| MySQL `web_growth_measurements` | Viewer measurement | 读请求可能创建；保存 score/model/algorithm revision、rating/六维、sample_count；保留当时测量值，不代表当前模型重算值 |
| Growth score fact | 请求期派生 fact | TS `dailyProgress` 回放后 `projectScoreFacts` 生成；本轮未发现独立持久化 score-fact 表；不能写成“事实都在 DB” |
| Goal completion fact | DB Goal 状态/评估证据的投影 | 权威来自 Goal lifecycle/evaluation，不来自推荐列表 |
| Recent cursor | `web_growth_recent_cursors` | owner/binding 的已读/观察游标；丢失会影响反馈状态，不等于成绩丢失 |
| B userdata/history cache | 派生 cache | 可重新拉取；HTTP 失败可返回内存旧值；无权决定中心状态 |
| 内容/计算/annual cache | 派生缓存或已发布产物 | 必须分别看 input revision 与发布语义，不能一概删除当“无状态” |

[E15](evidence-index.md#e15)、[E16](evidence-index.md#e16)、[E17](evidence-index.md#e17)、[E18](evidence-index.md#e18)、[E19](evidence-index.md#e19)、[E20](evidence-index.md#e20)。

### 已存在的事实定义

- Viewer 独立定义日历 Asia/Shanghai、fact type、归属日、occurred/observed/confirmed 时间、来源排除、coverage、Growth state 与 Goal completion。
- evidence.ts 排除 manual/import/repair/content-edit/dispatcher-transfer、来源切换等观察。历史快照有变化不自动等于“今天玩过”。
- Python daily archive 与 Viewer SQL measurement 同时持久化能力值。Passport 合并代码让既有 Viewer 过去日测量优先；当日比较 capturedAt。overview 若当日已有 archive 会跳过 SQL measurement 新增。**已有明确优先规则，但两套账本的模型/来源粒度不同**。
- daily archive row 保存 origin/computedAt 等，缺少逐条 score revision/model hash；TS 适配给出 `algorithmVersion=daily-v1`、`modelRevision=null`。与 SQL measurement 的可追溯性不等价。

## 重复存储与真正数据源

| 数据域 | 当前主来源 | 重复保存/转换 | 是否已证实冲突 |
| --- | --- | --- | --- |
| 中心成绩 | R userdata，由 Python/TS 多 Writer 共同修改 | C/H、u0、B cache、measurement/archive/facts | Writer 协议不同已证实；真实丢失/错写 Unknown |
| v1 曲库/定数/谱面统计 | R songs + 更新任务/人工配置 | A 磁盘副本、B songs、公共资源包/CDN、内容投影 | 采样文件 hash 已不同；不能仅据 hash 判定业务错误 |
| v2 定数 | Viewer 配置上游（默认 ourtaiko）、本地 console supplement、catalog 映射 | Viewer persistent cache/导出 CSV → 中心 bot/B 本地 fallback | API-first 路径与 CSV fallback 并存，freshness 可不同 |
| 指南/标题/编辑内容 | Java/内容 DB、Viewer 管理与资料文件，按字段分工 | tb_music/tb_musicdifficulty/tb_title、songs JSON、title_song_relations | 存在多种定义载体；DB 实际逐行重叠/对账 Unknown |
| 身份绑定 | Web binding 与 bot bind 各管自己的 owner/slot | B 本地旧表；QQ linking 表 | 不是“同一个 user_id 的三份表”；需显式映射 |

只对白名单公共数据做流式 hash，共 24 个文件：[public-data-copies.csv](evidence/public-data-copies.csv)。例如中心与 B 的 song_data、rating_structured、constants_id_v2 不同；tja_note_counts 和 song_difficulty 在该次采样相同。没有读取或复制个人 userdata。运行中的 daily updater 可继续更新公共文件，hash 仅代表采样时刻。

## 1.0 所需数据契约

这是后续修复要求，未实施：明确每个域的 owner；成绩 publication 的单一提交边界；完整/增量和删除语义；来源、merge topology、模型版本；观测时间与事件时间；Web/bot identity 映射；cache/measurement/fact 的保留规则。恢复范围必须包括 DB、C/H、不可重算的历史 measurement/archive、凭据和发布版本。

现有 backup 脚本存在，但尚未取得覆盖上述全部对象的一致性恢复演练及 RPO/RTO。因此结论是“恢复能力未证明”，不是“没有备份”。
