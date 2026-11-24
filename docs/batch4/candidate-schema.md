# Multi-objective Candidate Schema

以下全为 **NEW B4 CONTRACT**，逻辑 TypeScript 用于规格，不是仓库现有导出。保留旧 `MatchCandidate`、`RecommendationToolPayload` 和线上 wire 类型；将来通过显式 adapter 接入。所有 null 均表示未知/不适用，不能默认为 0/false/空证据。

## 身份与公共类型

```ts
type IntentType = 'score_improvement' | 'crown_completion' |
  'dimension_training' | 'discovery' | 'challenge';
type Readiness = 'ready_now' | 'reasonable_stretch' | 'not_actionable';
type Target = {
  horizon: 'near_term' | 'long_term';
  definitionVersion: string;
} & (
  | { kind: 'score'; threshold: number; comparison: 'gte'; baselineRef: string | null }
  | { kind: 'rank'; threshold: number; comparison: 'gte'; requirementRef: string | null }
  | { kind: 'crown'; crown: 'clear' | 'full_combo' | 'dondaful_combo' }
  | { kind: 'ng_reduction'; baselineRef: string; threshold: number; comparison: 'lte'; total: number }
  | { kind: 'dimension_practice'; dimension: { namespace: string; key: string; schemaVersion: string };
      practiceDefinitionRef: string; loadEvidenceRef: string }
  | { kind: 'explore_chart'; discoveryMode: 'interest'; coverageRef: string;
      relevanceRef: string }
  | { kind: 'explore_chart'; discoveryMode: 'level_matched'; coverageRef: string;
      relevanceRef: string; loadEvidenceRef: string }
  | { kind: 'task_requirement'; taskId: string; taskVersion: string; requirementId: string;
      requirementRef: string }
  | { kind: 'task_completion'; taskId: string; taskVersion: string; requirementRefs: string[] }
);
type EvidenceRef = {
  id: string; kind: 'score_snapshot' | 'estimate' | 'catalog' | 'chart_feature' |
    'rating' | 'growth' | 'coverage' | 'attempt' | 'task' | 'goal_baseline' | 'preference';
  source: string; sourceRevision: string; contentHash: string;
  profileId: string | null; chartId: string | null;
  catalogRevision: string | null; modelVersion: string | null;
  occurredAt: string | null; observedAt: string | null; confirmedAt: string | null;
  knownAt: string; fieldSemanticsVersion: string;
};
```

Target 的 threshold/total 为安全整数，分数>0、NG≥0/total>0、rank 1..8；未知 requirementRef 不可用于 rank readiness。crown 已满足时不再推荐。dimension namespace 首期固定 `viewer-six-dimension`，key 只能现有六维之一。target 规范化 JSON（字段排序、禁止 undefined/NaN）经 SHA-256 得 targetHash；同 Goal 的 exact target 不得因展示而变化。

intent/subtype/target.kind必须使用判别注册表：score_pb/score_target→score，rank_upgrade→rank；clear/full_combo/dondaful_combo→同名crown值，ng_reduction→ng_reduction；dimension_practice→dimension_practice；interest_discovery→explore_chart/discoveryMode=interest，level_matched_discovery→explore_chart/discoveryMode=level_matched；dan_task/event_task→task_requirement或task_completion。task_completion必须horizon=long_term且列出全部要求引用，当前版本不得以完整任务为A主动作。不能只凭字段分别合法就接受交叉错误组合。

`chartId` **必须逐值使用 Catalog Authority snapshot 中的 canonical Chart ID**，当前 schema=1 格式为 `song:<persistent-id>:course:<N>`；`canonicalSongId` 取同一行的 `songId`（`song:<persistent-id>`），difficultyType=该行difficulty（1..5）。ID格式不是生成权限：消费者不能把当前数字songId插入模板自行造永久ID。Authority 的 `charts` 字典仍以 `sourceSongId:difficulty` 查找，但字典键不是行内canonical chartId。

保留 `songId:number` 仅作为当前 Authority 行的 sourceSongId/旧API适配字段，非永久身份；新增sourceNamespace明确其namespace。B3 `ChartFeature.key` 与 package `song:difficulty:chartType` 都只能是来源键，经指定catalogRevision的显式sourceAliases/映射证据解析到唯一Authority行。零匹配/多匹配/变体冲突拒绝候选并报 `CHART_ID_UNRESOLVED / CHART_ID_AMBIGUOUS`，不能按标题猜、不截后缀、不以数值相等跨namespace关联。历史原始ID/字节不改。

Candidate、EvidenceRef、Goal关联、卡片聚合、事件与B4评估一律用canonical chartId；目录revision仍单独冻结，内容hash不是永久ID。读取到槽位不证明谱面存在：还须exists=true及对应地区policy允许。跨歌曲去重使用Authority支持的identityGroup，默认canonicalSongId；额外版本合并必须有显式权威关系，不能从旧数值ID推断。旧B3 key只在legacyChartKey与原协议回放中保留。

B4-1 Review Fix：已解析 `EvidenceRecord.ref.contentHash` 必填，值为 `SHA-256(canonicalJSON(payload))` 的 64 位小写 hex；canonicalJSON 对 object keys 排序、array 顺序保留，仅接受有限 JSON 值。缺失、null、格式错误或摘要不匹配均拒绝；未知证据保留缺失诊断，不能作为已解析记录传入。此修订统一现有 payload 完整性验证，不改变 B3 wire protocol。

EvidenceRef 是来源定位，不包含私密账号、token、cookie、原始个人 payload。必须在权限受控的 evidence resolver 中能复查；sourceRevision 不总是 SHA，标记 hash 的字段才强制 64 位小写 hex。与当前 B3 ReachEvidence 对应的 sourceHash/scoreRevision 等约束继续采用原规则。shared refs 可引用同一不可变证据，不能共享可变结论。

## Candidate

```ts
type MultiObjectiveCandidate = {
  schemaVersion: 'candidate/1';
  candidateId: string; decisionId: string;
  profileId: string; region: 'CN' | 'JP';
  songId: number; sourceNamespace: string; legacyChartKey: string | null;
  canonicalSongId: string; chartId: string; difficultyType: number; identityGroup: string;
  identityMappingRef: string;
  catalogRevision: string; sourceHash: string | null; scoreRevision: string | null;
  portfolioRevision: string | null; policyVersion: string; generatedAt: string; asOf: string;
  intentType: IntentType; subtype: string;
  goalIds: string[];
  goalLinks: GoalLink[];
  source: {
    kind: 'ordinary' | 'legacy_target' | 'catalog' | 'goal_portfolio' | 'task';
    sourceRevision: string; generatedAt: string; baselineRank: number | null;
    generatorVersion: string; evidenceRefs: string[];
  };
  playerEvidence: {
    snapshotRefs: string[]; ratingRef: string | null; estimateRef: string | null;
    coverageRef: string | null; attemptRefs: string[];
    ratingSamples: RatingSampleEvidence | null;
    predictionSamples: ChartPredictionSampleEvidence | null;
    recordSemantics: 'aggregate_or_unknown' | 'verified_attempt';
    recordState: 'unplayed_confirmed' | 'no_score_record' | 'coverage_unknown' | 'played_known';
  };
  chartEvidence: {
    availability: 'active' | 'removed' | 'unknown';
    catalogRef: string; featureRefs: string[]; verifiedDimensions: string[];
  };
  target: Target; targetHash: string;
  readiness: Readiness;
  actionability: ActionabilityEvaluation;
  evidenceRefs: string[];
  diagnostics: {
    reasonCodes: string[]; missingEvidence: string[]; limitations: string[];
    canCreateGoal: boolean; unsupportedGoalTypes: string[];
  };
};
type GoalLink = {
  goalId: string; goalRevision: string; baselineRef: string; targetHash: string;
  lifecycleStatus: 'active' | 'paused' | 'completed' | 'cancelled';
  availability: 'available' | 'unavailable' | 'unknown';
  userPriority: number; userOrder: number;
  actionability: ActionabilityEvaluation;
  evaluationRef: string | null;
};
```

`ActionabilityEvaluation` 定义见 [专用评估](type-specific-evaluation.md)，其 reasonCodes/missingEvidence/limitations 为权威，Candidate diagnostics 是复制出的便于消费视图，序列化时必须相等，不能双独立生成。`readiness === actionability.readiness`；evidenceRefs 为所有使用到的 source/player/chart/target/actionability/goalLink refs 的去重并集。多余 refs 不可作未核验背书。

`RatingSampleEvidence={ratingRef, scoreRevision, modelVersion, sampleCount, unit:'rating_result_rows', aggregation:'per-dimension-top20', topN:20, duplicateHandling:'preserve'}`；sampleCount为非负整数，不表示目标谱面演奏次数，也不保证是唯一Chart数。

`ChartPredictionSampleEvidence={estimateRef, chartId, scoreRevision, modelVersion, featureCutoff, unit:'comparable_chart_records', targetIdentityExcluded, poolKind:'same_difficulty'|'pooled'|'unknown', poolCount:number|null, stableNeighborCount:number|null, pbNeighborCount:number|null, dataSufficiency:string, sufficiencyRuleRef, evidenceRefs:string[]}`。这些是新增显式诊断字段，不是B3 adapter已提供的字段；计数只映射真实预测器结果/诊断，未导出则null。targetIdentityExcluded未知为null，不默认true。已知计数为非负安全整数；其scope必须与当前canonical chartId对应。完整充分性规则见专用评估，不能用ratingSamples.sampleCount补predictionSamples任一字段。

Interest Discovery允许ratingSamples/predictionSamples均null，输出兴趣证据及LEVEL_MATCH_NOT_ASSESSED；这不产生A/B资格。Level-matched Discovery若使用score load-fit，必须有独立predictionSamples，不能仅凭Rating样本多升级。

sourceHash表示被使用的谱面/模型输入内容hash，Interest Discovery没有使用这些输入时允许null；没有成绩快照时scoreRevision也允许null，coverage须为unknown，仍须可核验的catalogRef/identityMappingRef与兴趣证据。不能因无raw谱面或预测特征阻断纯兴趣探索，也不能用目录hash冒充raw/预测hash或填假scoreRevision。score等依赖这些输入的evaluator继续要求真实hash/revision并验证scope；null不是绕过其门槛的兼容值。

candidateId = `sha256(canonical({decisionId,profileId,chartId,catalogRevision,policyVersion,intentType,subtype,targetHash}))`；decisionId 绑定 frozen context（含 score/portfolio/evidence revisions、asOf、preferences），同决策重复生成稳定，同 Chart 不同 target/type 不撞 ID。不使用随机展示次序决定 ID，不把用户明文 ID 暴露到公共 telemetry。外部事件使用不可逆用户范围标识。

同一候选仅关联 targetHash 严格等价的 Goals；不同 target/GoalType 应为独立 Candidate，再在卡片层聚合。goalIds 是 goalLinks IDs 的 sorted unique 投影，不是选择任意 Goal 的权限。每 Goal 可有独立 baseline/evaluation；不能以共同 chartId 合并这些状态。

`canCreateGoal=true` 要求对应 GoalType/evaluator 已注册、baseline 能合法冻结、来源支持、用户明确接受后可复验；它不等于 token 已签发。token 不放在持久 Candidate 或公共事件内，只在用户 preview 意图时短时生成。

portfolioRevision=null 只允许无已读Portfolio的独立推荐；此时goalIds/goalLinks必须为空，不提供Goal提序。读失败不等于空Portfolio：diagnostics明确缺失，接受前必须重新读取真实revision。空Portfolio有确定revision，不能用null绕过CAS。

## Display Card（新增、不同于 Candidate）

```ts
type RecommendationCard = {
  cardId: string; decisionId: string; chartId: string; identityGroup: string;
  candidateIds: string[]; primaryCandidateId: string;
  priorityGroup: 'A' | 'B' | 'C' | 'D'; primaryReadiness: Readiness;
  goalLinks: GoalLink[];                    // goalId 去重，独立状态保持原值
  supplementalCandidateIds: string[];      // 仅上下文，非 A 的第二动作
  dedupSuppressedCandidateIds: string[];
  repeatReasonCode: string | null;
};
```

cardId 绑定 decisionId/chartId/primaryCandidateId，变主动作产生新 cardId。卡片不是完整 Portfolio，只显示相关状态；同歌曲其他难度被去重后，Goal 仍在 Portfolio 管理中可访问。关联 cancelled/completed 仅作上下文不提序；paused/unavailable 不以 active 名义提序。副候选不能共享主动作 readiness 或自动兑换多 Goal。

## 例子与错误

同一经Authority解析的 chart `song:123:course:4`（示意，必须实际存在于该snapshot），G1=score-pb(baseline 900000)、G2=df。C1 的 target={kind:score,threshold:900001,...} 关联 G1，ready_now；C2 的 crown=dondaful_combo 关联 G2，not_actionable/CROWN_ATTEMPTS_MISSING。卡片主动作 C1 可进 A，G2 仍独立不可判断。不能让 C1.goalIds=[G1,G2] 伪造共同目标；来源键`123:4`不直接成为canonical chartId。

相同 chart、相同 targetHash 的两个来源先合并 evidence 但逐条验版本与语义；相冲突的同 evidence ID 拒收，不任意取最新。旧 ordinary 未提供 target 或估计时，不创建假分数 Candidate；可以另走有覆盖声明的 discovery 来源，仍按其证据等级决定位置。

输入预算继承 B3：单次最多 5,000 原始 Candidates、每组 0..50、全 slate≤50 卡，单 Candidate≤100 goalLinks、≤256 evidenceRefs；超限为明确错误，不静默裁切证据。Catalog 候选扫描预算/分页范围必须报告；不声称完整召回。
