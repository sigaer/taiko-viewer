# Determinism Report

Target 与 Candidate ID 使用已批准 canonical JSON/SHA-256 公式，不用随机数或当前系统时钟。context.asOf/generatedAt 显式提供；decisionId 包含冻结 profile/revisions/evidence refs/Portfolio/排除项及排序输入 hash。未知或冲突数据拒收，不任意择新。

Catalog aliases/rows 先索引再显式比较；candidate、Goal、diagnostic 的输出均用稳定 ID 破平局。用户偏好保持其语义；实际曝光记录数组顺序不决定推荐，createComposeInputsHash 对历史行规范排序。所有字符串比较使用二进制顺序而非环境 locale。

显式主动作使用 `{intentType,subtype,targetHash}`，不是本次 candidateId，避免 decisionId 与 selector 相互依赖。Target 不同会改变 targetHash/candidateId；主动作或展示计划改变会改变 cardId/slateId。

执行测试反转 candidates、evidence、sourceAliases、charts 字典和 history 顺序，重复八轮验证决策 ID 与完整 slate（含诊断）相同。相同关联重复执行完全相同且输入无修改。性能脚本每轮组合均断言 slateId 与同规模首轮一致。

这些结果说明版本和冻结输入相同条件下可复现；不保证更换 policy/catalog/用户偏好之后保持旧推荐，也不证明上游异步采集自然形成相同输入。
