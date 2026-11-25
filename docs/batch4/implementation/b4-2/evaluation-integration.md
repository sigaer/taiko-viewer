# Multi-Goal Evaluation

`portfolio-evaluation.ts` 冻结一次 Score Observation；`portfolio-evaluator.ts` 逐 Goal 校验不可变绑定、target/hash/版本后调用原 `utils/goalEvaluation.ts:evaluateGoal`。没有第二套完成规则，也没有使用预测分数判断 FC/DF。

开放 score-pb、ng-reduced、clear、fc、df、rank-upgrade。played、dimension-practice、task-progress、score-target 缺专用 evaluator，不开放创建。各 Goal 独立结果，单项 inconclusive 不阻止其他项 completed；基础设施失败整体 rollback。paused 自动跳过，显式 evaluation 可包含；completed 重试 no-op，cancelled 拒绝，不由 availability 推断完成。

每项记录 evaluationId、输入 goalRevision、evaluatorVersion、原 baselineRevision、observationRevision/capturedAt、评估时间、outcome/reasonCodes/evidenceRefs 与完整原 evaluator result。active/inconclusive/unsupported 也持久化。evaluationId 绑定 Goal、不可变基线、目标、观测内容/来源与结果，排除临时读取时间；同一文件稍后读取不会反复写入。

S1 的 GoalBaselineBinding 和 Baseline sourceRevision 永不改为 S2/S3。Observation 必须独立通过原身份、revision、provenance、contentHash、marker、时间顺序与 reset 检查。基线/target 篡改或不支持记录返回 unsupported，不补造可信来源。

`sync-portfolio.ts` 在成绩同步后仅调用一次 V2 active batch；V1 继续原路径。Portfolio/Goal CAS 冲突最多重新冻结计算两次，身份冲突不重试。一次观测支持多个目标，不增加 play/session 数；Growth History 仍用唯一 projectGoalFact，Goal factKey 含 Goal ID，occurredAt 仍为 null。完成后的前端发出 completed 事件，首页/成长档案重读成长数据。
