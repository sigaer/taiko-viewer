# Implementation Architecture

全部新增运行代码位于 `taiko_viewer/utils/multi-objective/`，不修改 B3 `utils/player-intelligence/`、旧 wire 类型或服务器入口。

| 模块 | 职责 |
| --- | --- |
| contracts / schemas / shape | 单一公共类型及严格运行时镜像；拒绝额外字段、非法枚举、非有限数值与超预算数组 |
| common / context | 稳定 JSON、SHA-256、显式时间、冻结决策 ID、批次索引 |
| identity | 从真实 Authority snapshot 的 alias 与 row 解析和复核身份 |
| registries | 五 intent、合法 subtype/target、六种既有 completion GoalType、版本化输出验证能力 |
| evidence / candidate / actionability | provenance、样本单位、目标、时序、专用 evaluator 输出及声明一致性 |
| goals | 已验证 Candidate 与只读 Portfolio 的精确关联；无状态写入 |
| priority / composer | 主动作、A/B/C/D、确定性排序、歌曲去重、容量、planned gate |

顺序：冻结 context/options → prepareValidationContext → validateCandidate → associateCandidatesWithPortfolio → 再验证关联结果 → Chart 聚合与主动作 → 歌曲去重和组容量 → 最终 validatePrioritySlate。组合器自行执行这一顺序。单独调用分类、关联、gate 时，调用方必须先完成入口验证；这些低层函数不是独立的授权边界。

公开函数由 [index.ts](../../../taiko_viewer/utils/multi-objective/index.ts) 导出。`validateCandidate(unknown, context[, prepared])` 与 `composeRecommendationSlate(input, context, options)` 返回判别 `ValidationResult`，没有静默字段修补。单条坏候选成为 suppression；整批预算、context、options 错误为 `ok:false`，不伪装成合法空 slate。

版本：内核 `b4-offline/1`，Candidate `candidate/1`，policy `viewer-multi-objective/1`，Slate `viewer-slate/1`，Target `target/1`。均为 B4 新协议。`GoalPortfolioSnapshot='goal-portfolio/2'` 是只读投影，并非已实施数据库模型。

新增 resolver transport `EvidenceRecord='b4-evidence/1'` 包装既有契约 EvidenceRef 与可审计 producer payload；它不改变 Candidate 字段定义。`ValidationContext.decisionInputsHash` 绑定排序偏好、实际曝光历史、容量及显式主动作选择。主动作 selector 使用 `(intentType,subtype,targetHash)`，避免把包含 decisionId 的 candidateId 再哈希进同一 decisionId 产生循环依赖。

输入 context 是调用方已冻结的、权限受控的离线对象；prepared 索引只在同一 context 内复用，不是跨用户缓存。内核验证完整性和一致性，不验证上游签名、不提供鉴权，也不能证明 caller 给出的 payload 真实发生。接入前必须实现可信 resolver；不能让浏览器提交伪造“verified attempt”。无生产 IO、网络、系统时钟读、随机数或持久化。

Lead 先冻结公共类型后分派 A/B/C。三位代理实际没有文件/终端工具，只提供设计意见，Lead 完成对应模块。A–C 首轮 strict TS 和入口集成通过后，Agent D 实际取得工具，读取 AGENTS/契约并独立实现 priority/composer；Lead 统一验证。D 随后只读审查六个验证模块，发现已达标、未游玩冲突、理由和时间边界问题；Lead 修复并添加独立回归。代理未执行的检查不计为测试结果。
