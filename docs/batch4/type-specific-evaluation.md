# Type-specific Reachability / Evaluation

本文件是**新增**专用 evaluator 输入输出及准入契约；未实现或启用新模型。`readiness` 评价推荐动作，`GoalEvaluation` 评价已接受 Goal 的完成，后者保留现有唯一实现。两者共享目标定义，不共享错误的成功概率解释。

## 公共输入输出

输入冻结 profile/region/Authority canonical chartId/catalogRevision/sourceHash/scoreRevision/portfolioRevision/asOf、Target、EvidenceRef 集合。旧source key先经Authority唯一解析，不能当canonical ID。按 intent/subtype 分派；拒绝未知 subtype。所有被接受 evidence 的 knownAt≤asOf，发生/观察/确认分别存储；不补造 occurredAt。跨身份、跨目录版本、未来证据和用户排除是硬拒收。可用性 unknown 不进入 A/B。证据年龄按专用 policy，缺 policy 或 required evidence 一律 fail closed。

```ts
type ActionabilityEvaluation = {           // NEW B4 CONTRACT
  evaluatorId: string; evaluatorVersion: string; policyVersion: string;
  evaluationScope: 'target_actionability' | 'interest_relevance';
  evaluatedAt: string; asOf: string; targetHash: string;
  readiness: 'ready_now' | 'reasonable_stretch' | 'not_actionable';
  evidenceRefs: string[];
  confidence: {
    subject: 'evidence_sufficiency';
    level: 'high' | 'medium' | 'low' | 'unknown';
    basisRefs: string[];
    sourceReliability: { value: number; scale: '0..1'; modelVersion: string } | null;
  };
  missingEvidence: string[];                // 规范字段/能力路径，不能用空数组遮掩未知
  limitations: string[];
  reasonCodes: string[];
};
```

在target_actionability scope中，high=所有该规则的必要来源/时序/充分性通过；medium=通过 stretch 规则但未达到 ready；low=有证据但关键条件失败；unknown=关键来源或字段语义无法验证。在interest_relevance scope中，high只表示兴趣关联证据充分，不能提升readiness或表示水平匹配；该scope仅允许not_actionable/D。它是有版本的证据等级，不是统计置信区间。既有 reliability/100 可放 sourceReliability，不等于目标成功概率，不可在跨类型排序中直接比较。B4 不输出 probability；将来概率须另立明确命题、标签和校准协议。

每种 evaluator 必须返回以上全部字段，拒收亦有结构化诊断。目标已满足不意味着“可马上成功”，从待行动候选中移除，若关联 Goal 则触发独立完成核验。没有新因果证据时旧 Goal 仍可 inconclusive，不能从当前状态直接补 completed。

## 已核实的字段语义与边界

| 来源 | 实际含义 / 可证明的范围 | 禁止推断 |
| --- | --- | --- |
| `GoalBaseline.highScore`、`ExistingScoreEstimate.current_score` | 来自当前成绩记录的最高分字段；stable/pb 是独立预测输出 | PB 不等于近期稳定表现；预测 pb 不等于已实现 PB |
| `good_cnt/ok_cnt/ng_cnt/combo_cnt` | Viewer lossless adapter 投影记录字段；没有 attemptId。core Hiroba parser 读成绩详情 `.high_score/.good_cnt/.ok_cnt/.ng_cnt/.combo_cnt`，max_combo 投影到 combo_cnt | 不能断言所有字段是同一演奏或最近一次演奏；不能拼各字段极值成 FC/DF；combo=max 不证明清零 NG 的同次记录 |
| `stage_cnt/clear_cnt/full_combo_cnt/dondaful_combo_cnt` | 状态/累计计数字段，Goal evaluator 用变化与转正证明状态转移 | 累计数不定位一次真实 Session，不表示最近频率或成功概率 |
| `highscore_datetime/update_datetime` | 带来源语义的时间字段；core Hiroba adapter 写 captured_at，人工导入哨兵时间在 Viewer 被剔除 | 不能统一当游玩发生时间，不能据同步时间产生新 play |
| v1 `ng-reduced` | baseline/current 均有完整非负整数良/可/不可，正的总数相等且 ng 减少才 completed | 只证明可比记录 NG 改善，不证明每次游玩 NG 下降或训练因果 |
| core estimator HistorySample | `_build_history_samples` 从 best_map 各谱面记录构建，stable/pb 分位与相邻谱面估计 | rating.sampleCount≥20 不是同谱面 20 次真实演奏 |

固定 B3 文件证据见 [兼容性源码地图](backward-compatibility.md)。对生产上游是否每个字段来自同次演奏没有独立证明，因此 contract 中 `recordSemantics='aggregate_or_unknown'` 为保守默认，不用名字猜测。core parser 的缺字段归零也不能作为“原始证据存在”的证明；新适配器必须保留 presence/解析来源。

## Score Improvement

输入：当前 PB 与来源、正安全整数 threshold、已注册分数模型的 stable/PB 估计、分别记录的Rating总体样本与目标谱面预测样本、版本和时间、谱面可用性。候选可来源于普通推荐，但必须另给 target。

### 两种样本是独立门槛

| 字段/来源 | 单位与scope | 可以证明 / 不能证明 |
| --- | --- | --- |
| `PlayerRatingIntelligence.sampleCount` | Application rating聚合的results行数，duplicateHandling=preserve；Growth对应rated_stats行数 | 全局画像数据规模；≥20只是B3总体画像门槛，不是20张去重Chart或20次游玩 |
| `topN=20` | 每维聚合选取上限，各维可以选不同记录 | 聚合方法；不能称所有维度都有20个充分独立样本，更不是预测邻居数 |
| estimator `pool_samples` | 过滤掉目标identity后的可比chart-record池；same-difficulty pool足够时采用它，否则pooled pool | 本次模型估计输入；`EXACT_POOL_MIN=12`是选池条件，不是同谱面12次游玩，不能把常量名当普适充分性规则 |
| `stable.neighbor_count / pb.neighbor_count` | 针对目标谱面经特征距离筛选的邻近记录数量 | 目标相关证据规模；不是总体Rating行数、不是目标谱面演奏次数，也不单独证明预测正确 |
| `data_sufficiency / reliability` | 预测器对该target/model/inputs的结果 | 独立于Rating总体门槛；ok/高reliability也不是已校准成功概率 |

现有Core `ChartScoreEstimate`提供stable/pb的neighbor_count，但B3 `ExistingScoreEstimate`只保留score，未投影该数值；poolCount也没有在该wire输出中给出。新增adapter必须从真实输出/明确诊断读取，缺失记null与`PREDICTION_SAMPLE_EVIDENCE_MISSING`，不能复制Rating.sampleCount，不能由“预测返回了分数”编造样本。

B4分数门槛为**总体画像通过 AND 目标预测证据通过**。目标预测必须绑定当前canonical chart/scoreRevision/modelVersion，dataSufficiency=ok、stableNeighborCount>0且来源可核实、sufficiencyRuleRef指向该版本实际使用的选池/距离/外推规则。stretch还需pbNeighborCount>0及相应PB证据。规则所需诊断缺失则not_actionable；poolCount未导出保留null，不把null当0，也不虚报已检查该计数。不得给所有模型硬套≥20个预测邻居。规则版本未注册亦fail closed。

`score_pb` 必须 currentBestScore 已知，threshold=当前/对应 Goal baseline+1（Goal 绑定见下）；`score_target` 必须 threshold>currentBestScore 且不超已验证计分上界；rank_upgrade 仅在权威 Rank→分数要求映射存在时评价 readiness，否则 not_actionable。旧 rank-upgrade Goal 的完成 evaluator 仍可正常工作。

- ready_now：保留 B3总体画像与分数阈值，并新增上述独立预测样本审计门槛：Rating.sampleCount≥20，目标预测证据通过，reliability/100≥0.6，dataSufficiency=ok，stableScore>0，threshold≤stableScore，featureCutoff≤generatedAt≤asOf 且 cutoff 距 asOf≤30 天，所有 identity/revision/hash 匹配。分别报告rating_result_rows与comparable_chart_records，不声称稳定达成率。
- reasonable_stretch：同样的完整性、时效和充分性，另有 stable 与 pb 且 `stableScore < threshold <= pbScore`，并且 `(threshold-stableScore)/stableScore <= 0.02`。2% 是 **B4 离线候选策略常量**，未经真实成功率验证；未来调整必须新 policyVersion 和冻结评估，不能边跑测试边放宽。只有 PB、无 stable 不能通过。
- 其他 not_actionable；缺 PB 当前值不算明确改善。`horizon=long_term` 即使数值 gate 通过也不进 A。

reasonCodes：`SCORE_STABLE_SUPPORTED / SCORE_BOUNDED_STRETCH / SCORE_PB_ONLY / RATING_SAMPLE_INSUFFICIENT / PREDICTION_SAMPLE_INSUFFICIENT / PREDICTION_SAMPLE_EVIDENCE_MISSING / SCORE_TARGET_INVALID / SCORE_TARGET_BINDING_MISMATCH / SCORE_RANK_MAPPING_MISSING`。缺项分别写ratingSamples或predictionSamples，不能再用含糊的SCORE_SAMPLE_INSUFFICIENT。limitations 至少含 `MODEL_ESTIMATE_NOT_ATTEMPT_DISTRIBUTION`、`CONFIDENCE_NOT_SUCCESS_PROBABILITY`。

## Crown Completion：四个不同 evaluator

共同输入：权威当前皇冠状态/缺口、相同 chart/version/mode、完整字段语义、专用能力证据。**分数 stable/pb、score prediction 中 pred_ng/pred_ok、旧 recommend_index 都不能证明皇冠 readiness。**

为可测试地冻结门槛，新增只面向未来可识别演奏输入的 `crown-near-evidence/1`：取同 chart/版本/模式、asOf 前 30 天内最近三个 distinct attemptId（不按结果挑样本），每个有可验证 occurredAt/knownAt、judge totals 或对应 Clear gauge requirement。至少跨两个日历日。当前 B3 不提供此输入，不能将快照伪装为它。下列数值仅为保守离线行动启发式，不是皇冠成功预测；生产启用前需单独真实证据审查。

| subtype | ready_now 的专属 near 条件（三次均符合） | reasonable_stretch | Goal completion（保留） |
| --- | --- | --- | --- |
| clear | 明确平台/模式 Clear 要求；每次最终 gauge/通过指标距离要求≤5% 的该指标合法全量程，且无其他失败条件 | 最近一次符合 near 条件，至少两次可识别样本；其余次数未达 ready，但所有规则已知 | v1 baseline clear/FC/DF 均0，后续任一累计值转正，其他因果检查通过 |
| full_combo | 完整同次 judge total>0、NG≤1，combo 与 attempt 绑定、无模式冲突；目标皇冠尚未拥有 | 最近一次 NG≤3 且相同完整语义，至少两次样本；未满足 ready | v1 baseline FC/DF 均0，后续 FC 或 DF 转正 |
| dondaful_combo | 完整同次 total>0，NG=0 且 OK≤2；目标 DF 尚未拥有 | 最近一次 NG≤1 且 OK+NG≤5，同样至少两次样本；未满足 ready | v1 baseline DF=0，后续 DF 转正 |
| ng_reduction | 明确比较基准 ng>0，总判定数/模式相同；三次 attempt NG 均≤baseline NG-1 | 最近一次≤baseline NG-1，至少两次样本；未满足 ready | v1 可比记录 total 相等且 NG 下降；不宣称 attempt 成功 |

Clear 的合法量程/判定要求未知时不能用 highScore 替代。FC/DF near 条件不是成功标签；即使 NG=0 或 OK=0，没有来源验证不能据此补皇冠。若有权威已达成皇冠，先移除候选并评价 Goal，不继续将其计为 ready 推荐。ng_reduction readiness 与记录完成不同：attempt 较好可支持尝试，但只有权威记录转移才能完成旧 Goal。

没有上述 attempt evidence 的当前快照：可展示皇冠缺口/长期目标，输出 not_actionable，不能勉强标 stretch。未完成皇冠本身不是即刻可达证据。关键 missingEvidence：`attempt.identity / attempt.judgementSemantics / clear.requirement / crown.current / baseline.comparableTotal`。

reasonCodes：`CROWN_CLEAR_NEAR_EVIDENCE / CROWN_FC_NEAR_EVIDENCE / CROWN_DF_NEAR_EVIDENCE / CROWN_NG_NEAR_EVIDENCE / CROWN_BOUNDED_STRETCH / CROWN_ATTEMPTS_MISSING / JUDGEMENT_SEMANTICS_UNKNOWN / AGGREGATE_NOT_ATTEMPT / CROWN_REQUIREMENT_UNKNOWN / CROWN_BASELINE_INCOMPARABLE`。limitations：`NEAR_EVIDENCE_NOT_CROWN_PROBABILITY`、`STATE_TRANSITION_NOT_SESSION`。

## Dimension Training

输入必须同时有玩家对应维度、谱面 verifiedDimensions/feature 来源，以及训练意图依据。保留六维集合，要求 Rating/Growth 同 revision 且 global/对应维度 consistency=consistent，Rating总体sampleCount≥20，非零/未填充的真实有效维度；对 chart 的负荷评估独立于“该维度最低”。若使用score load-fit，另需目标预测样本门槛，不能从Rating样本数推导。

训练依据两种且必须标明：`explicit_user_focus`（用户希望练该维度，不叫短板）或 `corroborated_weakness`。后者要求同模型至少两份不同 scoreRevision、相隔≥7天的有效 measurement 显示相同相对低项，且对该维度有≥3个不同 chart 的版本化负荷/表现 residual 证据支持低于参照值；residual 的尺度/参照/阈值必须来自已注册 feature schema，缺注册则不支持 weakness 路径。仅一个最低项不能通过。

ready_now：上述玩家、谱面及意图依据俱全，注册 load-fit evaluator 为 ready，当前 chart 可练且有明确 dimension_practice target。reasonable_stretch：相同证据俱全，load-fit 为 bounded_stretch；load-fit 必须记录可比较负荷值、上下界和 policyVersion。初期可用 score 专用 ready/stretch 作为**练习负荷**证据，但只能说明目标练习负荷，不证明专项能力提升。没有可验证 load-fit 注册器则 not_actionable，不凭 star 填充。

reasonCodes：`DIMENSION_PLAYER_CHART_MATCH / DIMENSION_EXPLICIT_FOCUS / DIMENSION_WEAKNESS_CORROBORATED / DIMENSION_LOWEST_ONLY / DIMENSION_PLAYER_MISSING / DIMENSION_CHART_MISSING / DIMENSION_INCONSISTENT / DIMENSION_LOAD_UNKNOWN`。limitations：`PRACTICE_NOT_ABILITY_GAIN`、`SIX_DIMENSION_ONLY`。measurement 的模型兼容必须复验，B3 recent comparison 的 currentModelCompatibility=unknown 不能自动当通过。

## Discovery

新增 recordCoverage 包含 profile/source/region/catalogRevision/difficultyScope/from/to/completeness/absenceSemantics/evidenceRefs。`unplayed_confirmed` 仅当当前来源的有效 chart coverage 完整、无过滤/分页遗漏、缺失行明确表示未游玩（或明确零游玩），并且没有任何 played evidence 冲突；文案限定“此账户/来源/覆盖范围”，不宣称人生从没玩过。

`no_score_record`=查询已执行、当前返回无该谱面成绩，但不能证明完整游玩覆盖；`coverage_unknown`=查询/范围/语义不明；`played_known`=有可靠游玩/记录证据。这个新枚举不能从旧 isUnplayed 布尔值单向强推。

**Interest Discovery / `interest_discovery`**：根据显式兴趣（歌曲/风格/活动等）或有来源的目录相关性提供自由探索。必需canonical identity、可用性、relevanceRef；不要求Rating、stable/PB预测、load-fit或完整成绩覆盖。coverage仍必须如实声明，未知不能说未游玩。`evaluationScope=interest_relevance`，readiness=not_actionable（水平适配未评估），只进D；兴趣证据可为high confidence但不产生A/B资格。无relevanceRef不能伪造个性化兴趣理由。

**Level-matched Discovery / `level_matched_discovery`**：目标是有证据支持的水平匹配探索，`evaluationScope=target_actionability`。ready_now要求coverage完整且语义可靠、当前谱面可用、relevanceRef和注册load-fit ready；reasonable_stretch要求同样完整证据且load-fit bounded_stretch。使用score load-fit时必须分别通过Rating总体与目标预测样本门槛，不得用sampleCount≥20代替。否则not_actionable，不进A/B；若另有真实兴趣证据可独立生成interest候选，必须更换subtype/targetHash/candidateId并记录降级原因，不能保留“适合当前水平”的理由。

两者都是discovery，Type Coverage按五大类型只计一次，subtype另报。已玩曲可重访并标played_known；重复控制适用。兴趣匹配不表示可达，水平匹配也不保证达成；“真正去玩了”需可识别play证据，点击不能验证。reasonCodes：`DISCOVERY_INTEREST_SUPPORTED / LEVEL_MATCH_NOT_ASSESSED / DISCOVERY_LEVEL_MATCHED / DISCOVERY_UNPLAYED_SCOPED / DISCOVERY_REVISIT / DISCOVERY_NO_SCORE_RECORD / DISCOVERY_COVERAGE_UNKNOWN / DISCOVERY_RELEVANCE_MISSING / DISCOVERY_LOAD_UNKNOWN`。limitations：`ABSENCE_SCOPED_TO_SOURCE`、`EXPLORE_NOT_PLAYED`，兴趣分支另含`INTEREST_NOT_LEVEL_FIT`。

## Challenge

新增 task evidence 必须包含 taskId/version/authorityRef/sourceHash、region/platform、有效期或明确 evergreen、requirements（AND/OR、阈值、顺序、同次/累计语义、chart 映射）和相同版本的当前 progress/knownAt。B3 已有段位选项/进度图片入口，但没有接入上述统一结构；图片、段位名称、年度 challenge 摘要都不能直接当本合同证据。

对具体 `task_requirement`：先验证任务有效且要求未完成，再把可分解的要求分派到相应 score/crown 等 evaluator，ready_now=所有该动作必要子条件 ready，stretch=没有 not_actionable 且至少一个 stretch。真实段位同次多曲、连续通过、特殊条件不可拆成多张独立 PB 拼接；没有专用 task evaluator 时 not_actionable。

对完整任务 `horizon=long_term`：无论能否练一首都不能进入 A；C 明确显示整个任务与当前差距。不从单首 readiness 推出整段通过。不知道 task definition/progress 时不生成 challenge 候选，另返回 diagnostics，不能偷偷降格为“挑战某高星曲”。

reasonCodes：`TASK_NEXT_REQUIREMENT / TASK_COMPOSITE_SUPPORTED / TASK_DEFINITION_MISSING / TASK_PROGRESS_MISSING / TASK_EXPIRED / TASK_REQUIREMENT_UNSUPPORTED / TASK_LONG_TERM`。limitations：`CHART_PROGRESS_NOT_TASK_CLEAR`、`TASK_VERSION_SCOPED`。

## Personal Goal 与通用诊断

每个 goalLink 按 GoalType→intent/subtype→唯一 actionability evaluator 分派，targetHash/baselineRevision 必须匹配。旧 score-pb baseline 为 b 时目标必须恰好 b+1；如果当前 PB 已越过 b，先请求原 evaluator 判断完成，不能把候选另一个分数绑到原 Goal。FC 与 DF 同谱面仍各自评价。

通用 reasonCodes：`EVIDENCE_MISSING / EVIDENCE_STALE / EVIDENCE_SCOPE_MISMATCH / EVIDENCE_FUTURE / CATALOG_UNAVAILABLE / USER_EXCLUDED / TARGET_UNSUPPORTED / TARGET_ALREADY_MET / EVALUATOR_UNREGISTERED`。reasonCodes 为版本化注册表；未知 code 消费端保守降级，不能默认通过。missingEvidence 说明缺哪一个输入，limitations 说明即便通过也不能承诺什么，三者不能互相省略。
