# Slate Composer Report

Composer 返回 ValidationResult<Slate>，先验证、精确关联和复验，再按 canonical Chart 聚合。不同 target 保留不同 candidateId 和 GoalLink，只有一个 primary action；secondary Goal 的 readiness 不继承主动作。

同 ID 完全重复输入折叠；语义冲突全拒，不按到达次序选赢家。只有通过各自 identity/evidence 验证且核心语义一致的来源 alias 才可确定性合并，mapping proofs 写入诊断。非法候选即使与合法候选共享 ID 也不能借后者绕过拒收。

主动作默认先比较合法组和 readiness，再 active+available 用户 priority（高优先）/order（小优先）、类型偏好、14天实际曝光重复、未覆盖的合法 intent、baselineRank、candidateId。多个匹配 Goal 取最高 priority 下最早 order，不累计权重。显式 primaryActionByChart 使用稳定 action 三元组；选择较弱或长期动作会降组，不能沿用原 A 身份。

先 ready 再 stretch 构造 A；stretch≤ready。70%为软优化，先选足 ready，再允许达到50%底线的合法 stretch；不会为了70%硬限制容量。剩余近程可行动项进 B，长期进 C，自由探索进 D。全 slate 同 identityGroup 最多一卡；被去重其他难度/Goals 保留在输入 Portfolio，输出 suppression 说明。

history 只接受显式实际曝光记录，不记录本次生成。CN canonical 映射无法验证的旧键使 repeatHistory=unknown。相同歌曲14天内重复降低次序；显式 active Goal、不同 target 或合格候选不足分别给 USER_GOAL_REQUEST / EVIDENCE_CHANGED / QUALIFIED_SHORTAGE。EVIDENCE_CHANGED 当前只在 targetHash 实质改变时报告；scoreRevision 一次同步不自动清空重复。

容量及质量先于类型覆盖，没有合格某类型可以为空。shortage 按请求数减实际卡数计算；diagnostics 区分 candidate rejected、关联拒绝、Chart 聚合、歌曲去重、组/全局容量、A gate、历史未知与每类型已验证/可行动/被选主动作数量。尚无候选生成器扫描 telemetry，因此这些数量不宣称完整目录召回率；生成、未扫描与真实曝光指标留后续。

输出 cardId 与 slateId 覆盖最终有序内容，最终 gate 复核 primary 投影、Goal 状态、重复身份、A门槛和 card hash。只证明 planned slate；未启动浏览器或事件采集。
