# A/B/C/D Slate Composer

新增只读组合器 `viewer-slate/1`，不实现推荐模型、不写 Goal/成绩/曝光。输入为已冻结 context、各专用 evaluator 输出的 Candidates、Portfolio 快照、用户偏好、实际展示历史和组容量；输出卡片、分组、短缺与诊断。旧 B3 matching 不被替换。

## 确定性流程

1. 验证所有 candidate/evidence 身份、版本、asOf 与 context；冲突拒收。注册表不支持的类型返回 capability diagnostics；不凭 Composer 自行计算皇冠或重新评价 Goal。
2. 过滤非法目标、用户排除、下架和已达标动作。unknown availability 不进可玩卡；Portfolio 中仍保留不可用 Goal。paused/终态 Goal 不提供 active 提序。
3. 根据已核实 GoalType+targetHash 关联各自 goalLinks。按 chartId 建集合，保留不同类型/target 独立 Candidate，选一个明确 primary action；不可借一个 ready 把全卡 Goals 变 ready。
4. 在可行动的 near_term 集合构建 A；以 readiness 与 [A 门槛](priority-actionability-contract.md)为硬约束，再考虑用户手动优先级、类型偏好、覆盖和重复控制。同 identityGroup 全 slate 最多一卡；跨难度竞争要保留 suppression 理由。
5. 未入 A 的 ready/stretch 有具体收益者进入 B；有效长期目标进入 C；其余可用且理由诚实的自由探索进入 D。无效 identity/target 不通过 D 兜底。A/B/C/D 全局去重，已选歌曲不再占下一组。
6. 组内 ready 在 stretch 前，分别按稳定排序键排序；每张展示卡只有一个主动作。组不足可以空。最终聚合、过滤、去重、分页后再次验证 A，并输出 presentation plan。

所有遍历以稳定 ID 破平局，同输入必须同输出。不得依赖数据库未排序结果或 JS Map 的任意上游顺序。

## 优化优先顺序

硬约束顺序：identity/权限/版本 → availability/用户排除 → 专用 readiness → A 50% → 全局歌曲去重 → 容量。不可互相抵消。

在合法集合内：先尝试达到 A 70% ready 的内部目标；用户 `userPriority` 高者/`userOrder` 前者优先（仅 active 且 available），再类型显式偏好、实际历史重复惩罚、尚未覆盖的合格类型、既有 baselineRank、candidateId。没有 Goal 的项默认 userPriority=0/order=∞；多个匹配 Goals 取最高 priority 下最早 order，不求和，避免创建多个 Goal 刷权重。不能比较不同类型的 confidence 数值来取代专用 readiness。

70% 不是容量要求，也不允许把合法但重要的 stretch 永久排除：先按上述键选择 ready，再在 70% 约束下添 stretch；若用户有高优先级 stretch 或存在未覆盖合格类型，可以继续添至 50% 底线，记录 `optimizationTargetMet=false`。50% 不可让步。

A 容量 K、去重后 ready 数 R、stretch 数 S，若无其他冲突则最大可展示数为 `min(K, R+S, 2R)`；N=0 合法。实现可用 bounded greedy+有界替换，但必须在最终集合证明 gate；不要求本阶段求全局最优。反例 R=1,S=8,K=5，只能选≤2，不能为了类型覆盖选5。

同歌多个候选竞争时先考虑 A 合格主动作；不能因用户更喜欢一个 not_actionable DF 而吞掉同歌 ready score 后还保留原 A 数量。若用户明确指定 DF 主动作，则该卡移到 C/D，并重新补位/缩小 A。未选 candidate/Goal 永远保留原状态，记录 `song_dedup`。

## 类型覆盖和重复控制

默认不设强制“每类至少一张”。只对有合格候选的类型施加软覆盖偏好；缺 crown/task/训练证据时允许这些类型在 A/B 为零。各类型候选生成失败、未扫描、证据不全、被去重、被容量压下必须分别报告。

保留 B3 chart 层 14 天 actual exposure 口径作为主 Repeat Rate；新增 song identity/intent 层仅作附加诊断，不改历史指标含义。Composer 排序以同 song identity 最近 14 天实际展示作为重复惩罚；不得以生成日志当曝光。用户显式选择的 active Goal、证据/target 真正变化或没有可替代合格项允许重复，但记录 `USER_GOAL_REQUEST / EVIDENCE_CHANGED / QUALIFIED_SHORTAGE`。正常重复降序而非一律禁止；禁止通过重复条目填 A。

历史不完整为 `repeatHistory=unknown`，不能记 repeat=false 或推断这是新歌。scoreRevision 变化只有涉及当前 target 的实质证据变化才触发 EVIDENCE_CHANGED，不能任意一次同步都重置重复窗口。

## 输出与实际展示

新增 `Slate={schemaVersion,slateId,decisionId,policyVersion,asOf,portfolioRevision,groups,requestedCounts,displayableCounts,qualityGate,diagnostics}`。qualityGate 包含 A 的 N/R/S/minReady、hardGatePassed、optimizationTargetMet、emptyReason；diagnostics 含各类型 source/scanned/evaluable/eligible/selected 数量与每个 suppressedCandidateId 的原因。

presentation plan 包含不可变 card IDs/primaryCandidateIds/group/readiness/hash。响应不等于实际展示事件。客户端只能展示服务端允许且单独满足 gate 的页面/前缀；按 ready-first 前缀处理折叠/渐进加载。若只有 stretch 可见，不给其 A 标识，等待合格展示单元或移到 B。客户端筛选/隐藏/响应式变化后重验并产生新 presentationId；失败保守隐藏 A 或缩组，不显示违规组合后伪造日志。

不能保证远端实际可见性时，评估标记 unknown presentation，不宣称 gate 通过；已知实际展示违反则保留 violation。展示后 evidence 变旧，不能修改过去事件，只生成新 decision。

## 无副作用边界

Composer 不创建 Goal、不更新 userOrder、不取消 Goals、不推进任务、不登记 Session。输出 acceptance affordance 仅是用户下一步选择；真实接受/建 Goal 由 [Portfolio 事务](goal-portfolio-contract.md)处理。全部算法和 UI 接线都属于批准后的阶段，本批仅文档。
