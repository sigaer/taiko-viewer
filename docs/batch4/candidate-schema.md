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
  | { kind: 'explore_chart'; coverageRef: string; relevanceRef: string | null }
  | { kind: 'task_requirement'; taskId: string; taskVersion: string; requirementId: string;
      requirementRef: string }
  | { kind: 'task_completion'; taskId: string; taskVersion: string; requirementRefs: string[] }
);
type EvidenceRef = {
  id: string; kind: 'score_snapshot' | 'estimate' | 'catalog' | 'chart_feature' |
    'rating' | 'growth' | 'coverage' | 'attempt' | 'task' | 'goal_baseline' | 'preference';
  source: string; sourceRevision: string; contentHash: string | null;
  profileId: string | null; chartId: string | null;
  catalogRevision: string | null; modelVersion: string | null;
  occurredAt: string | null; observedAt: string | null; confirmedAt: string | null;
  knownAt: string; fieldSemanticsVersion: string;
};
```

Target 的 threshold/total 为安全整数，分数>0、NG≥0/total>0、rank 1..8；未知 requirementRef 不可用于 rank readiness。crown 已满足时不再推荐。dimension namespace 首期固定 `viewer-six-dimension`，key 只能现有六维之一。target 规范化 JSON（字段排序、禁止 undefined/NaN）经 SHA-256 得 targetHash；同 Goal 的 exact target 不得因展示而变化。

intent/subtype/target.kind必须使用判别注册表：score_pb/score_target→score，rank_upgrade→rank；clear/full_combo/dondaful_combo→同名crown值，ng_reduction→ng_reduction；dimension_practice→dimension_practice；explore_chart→explore_chart；dan_task/event_task→task_requirement或task_completion。task_completion必须horizon=long_term且列出全部要求引用，当前版本不得以完整任务为A主动作。不能只凭字段分别合法就接受交叉错误组合。

chartId **在本合同内**采用已有 B3 `ChartFeature.key = songId:difficultyType`，songId 为正安全整数、difficultyType 为 1..5；地区/目录/hash 是独立必需的 identity scope。它不是 package lossless `chart.chartId = song:difficulty:chartType`，映射时须明示，出现双人/变体歧义就拒绝，不截掉后缀强行合并。跨歌曲去重使用现有 catalog 的 `identityGroup`，不能按标题猜。

EvidenceRef 是来源定位，不包含私密账号、token、cookie、原始个人 payload。必须在权限受控的 evidence resolver 中能复查；sourceRevision 不总是 SHA，标记 hash 的字段才强制 64 位小写 hex。与当前 B3 ReachEvidence 对应的 sourceHash/scoreRevision 等约束继续采用原规则。shared refs 可引用同一不可变证据，不能共享可变结论。

## Candidate

```ts
type MultiObjectiveCandidate = {
  schemaVersion: 'candidate/1';
  candidateId: string; decisionId: string;
  profileId: string; region: 'CN' | 'JP';
  songId: number; chartId: string; difficultyType: number; identityGroup: string;
  catalogRevision: string; sourceHash: string; scoreRevision: string;
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

同 chart `123:4`，G1=score-pb(baseline 900000)、G2=df。C1 的 target={kind:score,threshold:900001,...} 关联 G1，ready_now；C2 的 crown=dondaful_combo 关联 G2，not_actionable/CROWN_ATTEMPTS_MISSING。卡片主动作 C1 可进 A，G2 仍独立不可判断。不能让 C1.goalIds=[G1,G2] 伪造共同目标。

相同 chart、相同 targetHash 的两个来源先合并 evidence 但逐条验版本与语义；相冲突的同 evidence ID 拒收，不任意取最新。旧 ordinary 未提供 target 或估计时，不创建假分数 Candidate；可以另走有覆盖声明的 discovery 来源，仍按其证据等级决定位置。

输入预算继承 B3：单次最多 5,000 原始 Candidates、每组 0..50、全 slate≤50 卡，单 Candidate≤100 goalLinks、≤256 evidenceRefs；超限为明确错误，不静默裁切证据。Catalog 候选扫描预算/分页范围必须报告；不声称完整召回。
