# Five Eligibility Policy Contracts

唯一实现是 [catalog/policies.py](../../../bot/taiko_bot/catalog/policies.py)，policyVersion=`wahlap-cn-1`，schemaVersion=1。适配层读取预计算结果，不重新推导国行资格。

| Policy | 输入 | 输出及语义 |
|---|---|---|
| catalog_display | 已知歌曲/谱面身份 | `eligible` + reasons。歌曲统一可检索；谱面须全球元数据或官方难度表明存在。未知历史记录不因此删除 |
| historical_score | 历史关联是否已解析 | 始终保留历史关联或 unresolved 状态；当前未列入、没有 raw、解析失败均不抹去成绩 |
| cn_current_playable | 完整官方目录中的歌曲、官方正难度、身份无冲突 | true/false + official offered / not offered / song absent / identity conflict 原因。与 raw/parser 独立 |
| recommendation_eligible | 上项 + ordinary/target 模型输入键、排除双打元数据 | 每个 profile 独立决定。ordinary 要既有正 score/combo，target 还需既有分数线 initial_points；既有算法继续检查维度数值。无模型时只降级推荐，不移除歌曲 |
| chart_analysis_eligible | 已知谱面、无身份冲突、对应特征状态为 AVAILABLE | 按特征分别给 eligible/reasons。PARTIAL、NEEDS_VALIDATION、UNAVAILABLE 不冒充完整支持 |

Song projection 中 `catalogDisplay`、`historicalScore`、`cnRelease`、`cnCurrentPlayable`、`recommendationEligible` 都由 Builder 从这些决策生成。每张 chart 另外带完整 reasons、rawAvailability、parserStatus、parserVersion、sourceHash、diagnostics 和 feature vector。

五个难度槽位不是五张真实谱面的证明。`exists` 单独记录；官方歌曲存在、官方难度提供、全球谱面存在、raw 存在、解析及每项特征成功是不同维度。

空策略 mask 表示**明确没有任何许可**；None 仅供纯 Core 的显式不限制计算模式。活动 CN 宿主必须提供中央 mask，不能用 None 绕过 Snapshot。

历史别名优先映射到永久身份并保留旧 ID 血缘；当前推荐使用中央提供的现用 sourceSongId。身份冲突保留可审查证据并阻止有争议的 CN/分析资格；不把两个主体自动合并。

Kinoko 手动导入标记只影响时间证据：分数继续按原规则保留，真实 play instant 为 null，不产生成长事件。Weekly 跨算法版本差值继续计算并展示模型变化说明，没有用禁止比较代替修复。
