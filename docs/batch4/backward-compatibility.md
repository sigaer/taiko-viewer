# B3 Baseline、兼容与迁移设计

基线 `c49717b6b7b7f697c0975c3d1477b7abffb26b7f`。以下为 Lead 实际读取源码得到的静态事实，不是生产 DB 检查。未访问 Taiko Agent。源码路径相对仓库根；行号用于该提交定位。

## 真实实现地图

| 范围 | 现有实现证据 | B4 影响 |
| --- | --- | --- |
| 五种排序模式/独立来源 | `taiko_viewer/utils/player-intelligence/context.ts:8,25,36`，Snapshot metadata 只保留被接受来源 | focus 不是五种 intent；新增 Candidate schema 不能改写原模式 |
| 分数候选/硬 gate | `taiko_viewer/utils/player-intelligence/matching.ts:5,11,17,25,52` | chart key 为 song:difficulty；ReachEvidence 与 score target 耦合；没有 A/B/C/D；新增专用评估与 Composer |
| ordinary adapter | `taiko_viewer/utils/player-intelligence/adapters.ts:8,19` | 输入最多50条、独立 estimate/targets；reliability/100 非概率；保留原始顺序 |
| 六维一致性 | `taiko_viewer/utils/player-intelligence/dimension-consistency.ts:15`；`matching.ts:66` 附近 | B3 已防空/部分维度冒充 consistent，仍不能以最低项单独诊断短板 |
| score Goal 精确绑定 | `taiko_viewer/utils/player-intelligence/goal-target.ts:4` | 只 active、可用 score-pb；baseline+1；其他 Goal 不能用此 matcher |
| Goal 类型 | `taiko_viewer/types/player-goal.ts:2`；`types/goal-evaluation.ts:2` | 7种 GoalType、单 activeGoal/recentCompletedGoal、baselineVersion=1；没有 paused/portfolioRevision |
| 表结构 | `taiko_viewer/server/services/goals/schema.ts:2,16,23` | web_player_goals 单 active 生成列唯一索引，goal_data LONGTEXT；没有每Goal revision |
| mutation/CAS | `taiko_viewer/server/services/goals/store.ts:11`；`service.ts:13` | source lease→owner/bindings，expectedActiveGoalId；创建替换取消旧Goal；相同 chart/type 重试保留 baseline（不是通用nonce幂等） |
| 签名意图 | `taiko_viewer/server/services/goals/recommendation.ts:17,18,30,45` | 进程 randomBytes HMAC、owner/profile/account/source/chart/rank/revision/inputs/expiry；没有 targetHash/portfolioRevision/nonce消费 |
| preview 与条件 | `recommendation.ts:59`；`service.ts:15` | 严格 body 字段，manual来源不可创建，ordinary preview需可验证 provenance 和已有记录，不能仅凭 goalOptions 的 played 选项认为服务支持 |
| baseline/target | `taiko_viewer/utils/playerGoal.ts:6,12,28` | 原始字段nullable，默认 sourceCompleteness unknown；goalTarget 只是字段/比较形式，score-pb 不传 value |
| 唯一完成规则 | `taiko_viewer/utils/goalEvaluation.ts:8` | 同身份、revision/provenance/contentHash/marker/时序/reset；score>baseline、NG可比total、crown转正、rank提升；played未支持 |
| evaluator写入 | `taiko_viewer/server/services/goals/evaluation-store.ts:10` | 完成在事务内更新goal_data/status；非完成不持久化完整evaluation；completed retry还要求最新Goal |
| recentCompleted | `evaluation-store.ts:6` | 查询最新一条Goal后判断status，不是查询所有已完成或所有并行Goal |
| 评价路由/触发 | `server/services/goals/evaluation.ts:10,26`；`sync-observation.ts:4`；`server/api/account/growth/goal/{evaluate,evaluate-current,preview}.post.ts` | 单活动ID；同步只是触发器、仍需新来源观测；现有链路不能读取时就批量修改多Goal |
| 历史事实 | `server/services/growth-history/goals.ts:9`；`taiko_viewer/utils/growthHistory.ts:56` | 已完成Goal按时间读取；factKey含Goal身份/observationRevision；occurredAt=null、observedAt/confirmedAt保留，不回填真实演奏时间 |
| 隐私删除 | `server/services/goals/lifecycle.ts:7` | 解绑/删用户事务内清理Goal；新portfolio/events亦须纳入同一生命周期 |
| 分数读协议 | `packages/sakura-taiko-contract/src/score-read.ts:4`、`legacy.mjs:39` | lossless记录投影，没有attempt identity；package chartId含chartType，B3 key不含，不可直接等同 |
| 进度/段位入口 | `taiko_viewer/server/services/account/progress.ts:76` | 已有段位版本/选项和Python进度图调用；不是统一 task-requirement/progress Candidate 接口 |
| 离线评价 | `taiko_viewer/utils/player-intelligence/benchmark.ts:3,25` | 7天/首2次可识别play/14天repeat、单activeGoalId；合成协议，不是线上效果证据 |
| Catalog Authority canonical身份 | `taiko_viewer/server/services/content/catalogAuthority.ts:8,20`；`docs/wahlap-authority-b21-20261124/source-of-truth.md` | 读取固定Authority snapshot；chart字典来源键与行内canonical chartId不同；B4必须读后者 |
| Rating样本投影 | `taiko_viewer/server/services/account/personal.ts:29`；`types/recommendation-intelligence.ts:4` | scoreCount只是sampleCount别名，topN=20是聚合参数，不是目标预测样本量 |

补充只读核验使用 B3 原回归所引用的本机 core 源码 `/var/tmp/taiko-batch21-20261124/core`：`core/parser/hiroba.py:327` 读取成绩详情判定/combo，`core/parser/hiroba_score.py:19` 把 captured_at 写入 highscore/update 时间；`core/recommendation/estimator.py:236` 从 best_map 构建 HistorySamples（非每次演奏）。这些不是另一设备的 Taiko Agent，也未执行同步/读玩家数据。保守结论是不能证明字段同次性，不能把 snapshot 当 attempt；未声称核实所有上游真实行为。

本轮三项修订补充核验同机B2.1源码：`/var/tmp/taiko-batch21-20261124/bot/taiko_bot/catalog/builder.py:73` 写 `charts[sourceSongId:difficulty].chartId = <stable songId>:course:<difficulty>`，含exists与policies；其sourceAliases/previous snapshot维持永久身份，不能由消费者重造。`bot/packages/taiko-application/src/taiko_application/query/recommendation.py:43` 的sampleCount=len(results)，`bot/taiko_bot/offline/growth_compute.py:61`起使用正rating、level≥4的rated_stats及逐维top20。Core estimator第298/339/695行分别选择同难度池、目标特征邻近证据、排除目标identity并计算本谱面估计；ScoreEstimateSnapshot.neighbor_count存在，而B3 adapter未透传。以上均为静态源码核验，不是玩家数据抽样。

## 字段演进边界

| B3 字段 | B4 新模型 | 兼容规则 |
| --- | --- | --- |
| activeGoal、recentCompletedGoal | GoalPortfolioV2.goals | 不再作为权威数据源；旧读仅受限视图 |
| expectedActiveGoalId | expectedPortfolioRevision + expectedGoalRevision | 旧 ID 无法保护排序/另一个Goal的修改；不能伪装成 revision |
| status + unavailable boolean | lifecycleStatus + availability 三态 | 保留旧status，不自动把unavailable变cancelled；旧true→unavailable，旧false只能标待复核unknown |
| baselineVersion=1 / baseline | versioned BaselineEnvelope | 原对象不变；不能迁移时采新成绩覆盖 |
| source/sourceMode/sourceBasis/... | origin.sourceSnapshot | 完整留存旧来源，不凭新intent重写历史 |
| targetData | Target + targetHash | v1仍由原evaluator解释；score-pb仅baseline+1，ng-reduced为baseline.ngCnt-1；非法/未知baseline保留但不绑定候选 |
| goalId? / isUnplayed | goalLinks[] / recordState+coverage | 旧单ID包装一项，严格target校验；旧布尔不证明完整覆盖 |
| targetScore / stableScore / confidence | score target + type-specific actionability | 只进入score分支；不可投射到FC/DF |
| focus | 新intent + 显式偏好 | 不一一改名，不改旧报告 |
| B3 `songId:difficultyType` / package chartId | Authority canonical chartId + identityMappingRef | 来源namespace+原ID+难度经冻结Authority唯一解析；保留legacyChartKey，拒绝猜测/歧义；songId数字字段仅作sourceSongId适配 |
| 未区分的discovery | interest_discovery / level_matched_discovery | 旧focus/isUnplayed不能决定新子类型；兴趣不要求预测且仅D，水平匹配须独立证据；没有自动升级 |
| Rating sampleCount / topN | ratingSamples / predictionSamples两个独立对象 | 前者总体行数，后者目标相关可比记录；缺neighbor_count等不能用Rating值填入；B3原gate只作为原行为保留 |

## 迁移计划（本阶段不执行）

1. 审核后在隔离 fixture DB 完成 v2 schema/read/write/eval/history 适配。真实实施前只读 inventory：行数/状态分布/格式版本/孤儿/重复ID；不得把真实玩家快照复制到测试库。旧 schema audit/migrate_goal_schema.ts 必须同步版本化，避免它把删除唯一索引误判后自动恢复。
2. 明确切换窗口，阻断旧 Goal 写/evaluate，记录可恢复 schema 与数据快照标识；不运行双写。新增 Portfolio 行与 revision=1，按 binding 包装所有旧Goals（不仅active），保留 id、baseline、created/completed/cancelled、completionEvidence。无目标的绑定初始空 Portfolio/revision=0，首次命令原子初始化。
3. active=active，cancelled/completed保留终态；原单active默认userPriority=1/userOrder=0。不存在的 paused 不猜造。旧 unavailable=true保留不可用，false→unknown待catalog复核；历史completed证据不因可用性复核而消失。旧目标非法target/baseline标unsupported诊断，不修复成已完成、不删除。
4. 行级稳定migrationKey（旧ID+schema version）确保重复执行不重建baseline、不重复写历史。验证映射前后计数/ID/原baseline与completionEvidence hashes、事实key不变，再移除active唯一约束并切单一v2 writer；DDL与数据切换分步检查，MySQL DDL不假装与全部DML原子回滚。
5. 先切读/写/eval/历史/解绑全链路再允许创建第二active。旧 projection 仅是输出 adapter，不是长期第二状态源。不提供“回滚到旧单active写入继续运行”的虚假保证；有多active后回滚先停止写、保留v2数据/读能力，禁止任意取消Goal来迎合旧索引。

迁移脚本、SQL、数据复制均不在本批交付中。实际迁移需要单独批准和隔离测试证据，不能由阅读本文触发。

## 旧客户端与 Token

未迁移用户仍走旧实现。迁移完成的 binding，旧 POST/DELETE/evaluate/evaluate-current/preview 写意图统一返回409 `goal-portfolio-upgrade-required`，即使当前只有一个active也不接收旧CAS/token；必须刷新v2客户端/preview。这样不会用旧替换行为取消其他Goal。

旧只读接口只在“所有未终态Goal≤1，且可表示为旧active，且GoalType/baselineVersion可旧读”时输出明确 `legacyProjection=true` 的兼容响应；有paused、多active、不可表达状态则返回升级要求，不任意挑一个Goal冒充全状态。无未终态时可用旧空视图；recentCompleted沿原语义投影，不用于v2完整历史。未知字段不能直接塞给旧TS消费者，应在新版边界按schema协商。

v1 token不具备目标和Portfolio revision绑定，不能转换为v2授权；无论是否过期一律重新preview签发。v2 command幂等在commit前建立，以完整canonical request hash校验；保留同重试原baseline，不再依赖“恰好当前Goal同chart/type”启发式。

兼容adapter撤除条件：所有受支持客户端支持v2，迁移fixture及历史回放通过，观察期无旧writer调用并经审查；随后删旧writer分支和唯一目标投影依赖，保留版本化历史读取。没有无限期双写、双读或双配置路线。

本轮修订不改旧数据库song_id/difficulty_type或已签v1 token。新增canonical关联是读取Authority后的版本化关联证据；没有唯一映射的旧Goal保留原baseline/history且不进入新推荐，不能迁移时强写一个推测ID。B3 Golden和旧Repeat报告不重算；B4采用canonical单位，跨版本比较需显式身份解析覆盖率。此前B4.0草稿的explore_chart单subtype与短chartId尚未实现，不设长期兼容读写，直接由本修订替换。
