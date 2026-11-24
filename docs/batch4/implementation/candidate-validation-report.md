# Candidate Validation Report

严格检查 `candidate/1` 全字段，拒绝额外字段、缺字段、重复 refs、错误枚举、非安全整数、非法时间、目标哈希及 candidateId 不符。Candidate 使用契约原有字段；没有第二套 score/crown Candidate schema。

目标 JSON 以字段名稳定排序、有限 JSON 值生成 SHA-256；candidateId 使用契约规定的八个字段。context 绑定 profile/region/catalog/score/portfolio/policy/time 与 decisionId。canonical row、mapping proof、sourceHash、当前可玩及相应推荐资格均须复核。actionability 与 readiness/diagnostics 复制视图必须相同，goalIds 为独立 links 的 sorted unique 投影。

refs 必须等于 source/player/chart/target/actionability/Goal 所用证据及其声明依赖的去重并集。拒绝缺失 resolver 记录、冲突同 ID、内容哈希不符、非法 producer namespace、跨 profile/chart/catalog/score revision、未来发生/观察/确认/knownAt，以及内部 coverage/progress/cutoff 晚于证据自身 knownAt。

`EvidenceRecord` 是新增受信 resolver 投影，shape 在 evidence.ts 封闭定义：catalog、rating、score_estimate、score_snapshot、coverage、interest、dimension_focus/feature/measurement、score_load_fit、goal_baseline、rank_requirement、attempt、attempt_window、task。snapshot 与 baseline 的 platform/mode 保留 nullable；NG actionable 必须证明 baseline/current/attempt 同模式，未知不填默认模式。当前最高分/Rank/皇冠/可比 NG 已达标时拒绝候选，不据此修改 Goal 完成状态。

RatingSampleEvidence 与 ChartPredictionSampleEvidence 分别同自己的 producer payload 逐值核对。前者单位 rating_result_rows，topN20、duplicateHandling=preserve；后者 comparable_chart_records，绑定目标 chart、score/model revision、cutoff、target exclusion、pool/rule 与 stable/PB 邻居。预测数缺失保留 null，不能填 Rating 的 200、topN20 或假定演奏次数。poolCount 未导出可以为 null；注册规则不要求所有预测模型一律邻居≥20。

unknown coverage、查询无成绩、充分覆盖未玩、已玩记录是四种状态。完整 coverage 必须声明 query、地区、难度范围、无遗漏、absence semantics、时间与 record presence；已有 snapshot/attempt/正 PB 与未玩或无记录声明冲突时拒绝。Interest 可无 Rating/预测/scoreRevision/raw hash，但仍需可用 canonical chart、兴趣证据和诚实 coverage 状态。

预算：输入≤5,000 candidates、每候选≤256 refs/100 GoalLinks、整 slate≤50、每组≤50；超限明确报错。额外离线预算：context≤100,000 evidence records、Portfolio≤5,000 goals、history≤10,000 rows。没有采集真实玩家数据或自动补齐缺失 provenance。

验证覆盖见 [测试报告](golden-and-regression-results.md)。strict TS 是静态一致性检查，不替代上游来源真实性验证。
