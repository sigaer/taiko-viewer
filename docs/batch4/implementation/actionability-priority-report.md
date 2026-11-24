# Actionability / Priority Report

`validateActionabilityEvaluation` 验证已注册输出的版本、scope、目标/时间、置信度语义、refs、理由及各类型必要条件。它没有训练或执行 Score/FC/DF 预测模型，也不调用 Goal completion。

Score：Rating≥20 与真实目标预测诊断独立通过；stable>0、reliability≥.6、30天 cutoff、合法当前 PB/计分上界；ready target≤stable；stretch stable<target≤PB 且差距≤2%。score_pb 只能合法 baseline+1。PB-only 或预测邻居缺失不能提级。

皇冠：权威当前状态、完整同次 semantics、最近窗口覆盖证明、distinct attemptId、模式和时间；ready 最近三次且跨两个 UTC 日历日，stretch 至少两次且最近一次达 subtype 边界。Clear gauge、FC NG、DF OK+NG、NG 可比总数/基准独立检查。UTC 是当前 offline/1 日界；不能暗称采用玩家本地日界。aggregate combo、pred_ng、score 高分均不能替代 attempt。near 是已批准启发式的输入契约检查，不是新皇冠成功预测。

Dimension：explicit focus、非零有效玩家维度、Rating/Growth 同版本一致性、谱面 verified feature 与独立 load-fit 同时成立。当前 weakness/residual producer 未实现，不接受“最低项即短板”或无证据的 weakness 理由。

Discovery：interest_relevance 与 target_actionability 分离；interest_discovery 永远 D/not_actionable。level_matched_discovery 必须完整 coverage、相关性及 score load-fit 独立证据；缺少预测样本不能沿用兴趣 confidence。Challenge 必须真实版本化任务与当前进度；过期/缺进度拒收，无专用 actionability producer 时不入 A/B。

Priority 分类与类型独立：Interest D；其他 long_term C；near_term ready/stretch 最佳资格 A，容量回落 B；near_term not_actionable D。分类和 gate 的输入前提是已通过完整候选验证。

最终 gate 按卡片 primaryCandidateId 计数，`R >= ceil(N/2)`、`R+S=N`，long_term/not_actionable 不得在 A。同 Chart 多 Goal 只计一项主动作。N=0 rate=null；50%通过而70%未达仍合法。ready-first 使默认展示前缀合格；过滤后只剩 stretch 的子集重新验证失败。

返回 `scope='planned_slate', actualExposureVerified=false`。这不是浏览器实际曝光验证，更不是用户接受率、真实游玩率或目标达成率。客户端隐藏/分页及事件采集待后续实施。
