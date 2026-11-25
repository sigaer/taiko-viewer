# Cohort Prior Artifact v1

权威类型 `CohortPriorArtifact` 与 `CohortNode`，校验器 `artifact.ts::validateArtifact`。先提供合成 producer/fixture，未连接任何真实群体生产者。

顶层必填：schemaVersion=cohort-prior-v1、artifactId、sourceRepository（无凭据 HTTPS 仓库地址）、sourceCommit（完整40/64位）、dataSnapshotRevision、catalogRevision、region、ruleset、canonicalChartId、chartRevision、ratingDefinition、ratingGrid、modelVersion、calibrationVersion、generatedAt、population。

每个匿名 Rating 查询节点含：rating、distinctPlayerCount、effectiveSampleSize、scoreDistribution（递增 score/正 weight 的离散 CDF 支撑点）、scoreQ25/Q50/Q75、FC/DF/Clear observed、uncertainty、selectionCoverage。分位数必须与 CDF 一致。distinctPlayerCount 是不同玩家数，ESS 是生产者在玩家去重后按 (Σw)²/Σw² 得出的有效样本量；二者不能互换。直方图桶权重不是逐玩家权重，不能从桶数量反算 ESS。

observed 的 numerator≤denominator≤distinctPlayerCount，semantics 只能是 observed-best-snapshot-rate；没有可靠标签时为 null。样例没有 Attempt/FC/DF/Clear 标签，三项均为 null。

严格拒绝任何层级的额外字段，包括账号、昵称、用户 HMAC、成员列表、逐玩家成绩和预测；拒绝 getter、异常原型、非有限数字、超限数组及凭据 URL。字段白名单是结构防线，不能证明自由文本中没有被违规编码的身份；未来 producer 仍须独立审查、聚合发布及来源认证。

边界：最多64个 Rating 节点，每节点256个桶；每节点至少1名玩家，ESS∈[1,distinct]。available 要求 distinct≥5 且 ESS≥5；不足保留样本量但隐藏分位数。Artifact 的年龄范围为 asOf 前31天以内；未来、过期、曲库/谱面/Rating 定义/地域/ruleset/排除范围不匹配均 unavailable。

population 必须声明 `disjoint-evaluation-population` 和精确 scopeRevision。合成数据必须额外 allowSynthetic=true。该声明只适用于事先隔离的评估人群；不是任意在线用户的自我排除证明。目前没有真实 producer 的认证或排除证明接入，不启用在线真实 Cohort。

Adapter 选择距离最近的**一个**已发布节点，等距选较低 Rating。它不把节点插值称为精确 nearest-24，也不相加重叠群体的 distinct/ESS。M1 精确邻居选择发生在独立离线实验进程中。

样例生成：`scripts/prediction_experiment/preview_fixture.py` 从固定合成数据生成一个 M0 示例和24名不同合成玩家的聚合参考，明确排除示例画像所属合成对象。每6条合成分数先聚合成粗桶，相同桶合并；不发布成员分数或身份。sourceCommit 绑定生成器所在提交，个人模型另绑定 Bot 源码 SHA256。

Artifact 缺失、非法或未获准时明确 unavailable，绝不制造默认分布。生产者后续可发布按 Rating 网格预聚合的匿名查询节点；不能要求 Viewer 接收成员数据。
