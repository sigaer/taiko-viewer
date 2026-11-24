# Player Profile Decision Contract 与长期/近期模型

## 已有事实源审计

| 概念 | 实际入口与权威来源 | 本批决策用途 |
| --- | --- | --- |
| Player State | `server/services/account/growth.ts:getPlayerGrowthOverview` → `runGrowthPythonJson` → `utils/playerGrowth.ts:buildPlayerGrowthState` | 保留 dataSufficiency、priorityDimension、ties；不另算能力 |
| 长期 Rating | `server/services/account/personal.ts:getPersonalRatingSummary` → Bot `offline/recommendation_intelligence.py:build_player_rating_intelligence` → Application projection | `PlayerRatingIntelligence` 原样保留：V1、每维 Top20、duplicate preserve；overall 与六维不同语义 |
| V1 / V2 | `types/recommendation-intelligence.ts` 仅支持 V1；共享 Contract `CalculationProfile` 枚举 `v1-great-only/v1-comprehensive/v2-center-20261010/v2-client-20261010`；`docs/rating-entry-consistency.md` 记录中心 taikob 默认 V2 与 V1 JSON 的有意差异 | 不把 B30/V2 混入 V1 推断；V2 本批显式 not supplied，未来单独命名的原始投影与 CalculationProfile，不转换/平均 |
| 六维 | `big_song/stamina/speed/accuracy_power/rhythm/complex`；`utils/playerGrowth.ts` 选择最低有效维度 | 关注方向是现有启发式，不能称为音乐技能诊断；数据不足不制造零能力 |
| Growth Measurements | `server/services/growth-history/measurements.ts`、`daily-archive.ts`、`measurement-attempt.ts`；已有 snapshot writer/read-time fallback | 使用已产出的记录，不调用有写入副作用的 overview 服务来回放基准 |
| Growth Facts | `packages/sakura-taiko-contract/src/index.ts:CanonicalFact`、`utils/canonicalGrowth.ts`、history/recent/weekly/passport 服务 | 只引用已有 `factKey`；不建立新事实表、不从点击或入队生成 fact |
| Recent Growth | `server/services/growth-recent/service.ts` 与 boundary/store；`useRecentGrowth` | acknowledgedToken 是“已看过”的边界，不是游玩时间；近期知识窗口不等于训练 Session |
| Goal Baseline/Evaluation | `types/player-goal.ts`、`utils/goalEvaluation.ts`、`server/services/goals/*` | 完成只消费原 evaluator；baseline immutable，版本/provenance/CAS 保留 |
| Preferences | 普通推荐显式 basis；现有活动目标；`ForumPreferences.recordHistoryEnabled`；`web_song_locks` 手动数据保护；年报 favoriteSong 等派生统计 | 本批新 preference 合同是 request intent，不是新持久化来源；不把论坛历史开关/手动锁/年报偏好直接当推荐喜好 |

源码审计基于 Viewer `ae46bfd6`，Bot Batch 2.1 `c1ff685e`，core `e254f3ee`；Bot/core 仅只读查看已有调用链及运行既有合成回归。没有访问 Taiko Agent。

## 合同

`buildPlayerDecisionContext(DecisionInput)` 是纯函数。输入需要 `ownerId/profileId/asOf/recentFrom/catalogRevision/scoreRevision`，以及已有 payload 的 `Snapshot<T> {profileId, observedAt, revision, value}`。`observedAt` 是该来源在决策时已经可用的知识时间；不能用回放当天时间代替历史可用时间。各来源 revision 分别保留；rating/growth 的 revision 必须对应当前 scoreRevision，history/goals 不强制使用同一种 revision。

输出分区：

- `longTerm`：现有 V1 rating、growthState；V2 not supplied。缺 Rating 不从 growthState 或维度平均补值。有限数值、非负样本、重复维度检查；Rating/Growth 分歧保留源值并禁止冲突 focus 影响排序。
- `recent`：窗口内已有 measurements、近期获知的 factKey 引用、可比较的历史 ratingDelta、比较记录 ID 与模型元组。未知当前模型兼容性不升级成相同口径。
- `goals`：现有 GoalEvaluationResponse，绝不重新评估或补造完成。
- `preferences`：用户此次显式关注模式/偏好/排除；排除优先，错 profile 或未来意图不使用；不落库。
- `confidence`：样本量、原覆盖状态、请求窗口是否覆盖、来源时间及诊断；不是单一“玩家可信分数”。

Review Fix 收敛：`sources` 显式分别读取 rating/growth/history/goals/preferences 自身的 Snapshot，并且只有对应 payload 最终被接受才记录其 revision/observedAt；缺失、错身份、未来时间、错 payload profile、无效 Rating 或不符 scoreRevision 的来源为 null。`confidence.observedAt` 也只取已接受的 Rating 来源。rating/growth 都须匹配当前 scoreRevision，但时间仍独立；history/goals/preferences 的 revision 互不替代，合法的 null revision 保留。

`growthConsistency` 现在为 `consistent / inconsistent / unknown`，并提供逐维 `dimensionConsistency`。只有完整六维、两侧每维都有唯一正有限值、数值一致且 overallRating 已知一致时才是 consistent。空数组、缺维、零填充或缺来源为 unknown；已有数值冲突为 inconsistent（即使其余维度缺失）。整体 Rating 不因空/部分维度而丢弃。Growth 提序只消费完整一致且 ready 的现有 priorityDimension，并要求该维在 chart 的 verifiedDimensions 内；部分证据不证明“最低维度”，不进行提序。

时间必须含时区。History 查询范围是上海日期闭区间，转换到上海日界后才能声称覆盖所请求的时刻窗口。原始 coverage 保留；请求窗口不完整时有效 coverage 为 unknown。Measurements 按 owner/binding/time 筛选，同 ID 冲突排除，按时间与 ID 确定排序。至少两个不同时间、所有记录 ready、measurementVersion/algorithmVersion/非空 modelRevision 一致时才比较；不同 scoreRevision 属于正常成长，不因此排除。单条、未知版本、模型切换或中间 limited 均不能解释成“没有成长”。

Fact 纳入时间使用 `confirmedAt ?? observedAt`，还检查所有非空时刻不在未来；无效的非 null confirmation 不静默退回 observation。`factReferences` 保留原始 occurredAt（实际发生）、observedAt（观察）、confirmedAt（确认）、precision，并明确 knownAt 与 knowledgeBasis。缺失的时刻仍是 null，不相互补值。Context 和 Living Home 使用完全相同的 `factSemantics=recently-known-fact-references` 与时间引用；晚确认的旧 PB 可以出现在“近期获知变化”，不能被描述成今天打出或今天实际游玩。它不是最近实际游玩的采样序列，也不改变 Session Identifiability。

## 长期与近期的产品语义

长期 Rating 是现有长期最佳成绩聚合，不做本批改写或时间衰减。历史测量差值只表示两个已记录状态之间的变化。近期表现目前可用的是观察到的变化，逐次成绩、稳定性方差、疲劳、练习次数、会话长度都没有足够权威证据，本批不输出。不得因为近期没有新 PB 判定能力下降。

`server/services/growth-session/audit.ts` 的 L0/L1/L2 审计边界继续生效：导入/修复/手动/回退不能作为可识别 Session；观察批次不是训练 Session；L2 inferred candidate 也不是逐次游玩证明。benchmark 的 identifiable-play 必须由未来正式导出证明，不能直接从 Growth Fact、L2 候选或点击构造。

未来 V2 接入只增加已命名的原始计算投影和 CalculationProfile，保留 V1 语义与各自 coverage。未来 Preferences 持久化前先确定唯一用户意图来源，不能用多个本地缓存和服务端状态双写。本批不需要这些后续能力即可独立验收。
