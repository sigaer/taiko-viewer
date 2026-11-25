# Prediction Evidence v1

状态：候选实现；目标 `best-score-snapshot/1`，单位 score。不是下一次演奏预测。

权威类型：`taiko_viewer/utils/prediction-evidence/types.ts`；运行时校验：`personal.ts`。

| 字段 | 语义 |
| --- | --- |
| schemaVersion / predictionId | prediction-evidence-v1 / 按规范化内容计算的 SHA256 身份 |
| modelId / modelVersion / predictionType | 算法身份、不可变版本、证据角色 |
| canonicalChartId / chartRevision | 由权威曲库解析的谱面及修订；合成样例使用独立 synthetic 命名空间 |
| profileId / playerProfileRevision | Viewer profile 及本次画像修订；不是 Cohort 成员身份 |
| scoreRevision / catalogRevision / cohortRevision | 当前证据的成绩、曲库、群体修订；个人证据 cohortRevision=null |
| target | 共享目标 kind/unit/definitionVersion；各模型使用相同观测标签 |
| availability / point | available、insufficient、unavailable；后两者 point=null |
| distribution | 有校准身份的 Q25/Q50/Q75；或显式 unavailable+reason |
| uncertainty | evidence-quality；不是成功概率 |
| evidenceRefs / limitations / createdAt | 来源引用、必要限制、UTC 时间 |

五种角色不可互换：

- `personal`：投影现有 Bot Stable/PB，不重算或调整其输出。Stable 是本实验的点预测代理；PB 另存 personalScores。两者都不是 Q25/Q50/Q75。
- `cohort-observation`：相近 Rating 群体的经验分布，不冒充个人预测。
- `cohort-residual`：训练用户 OOF 的 y−M0 条件残差；允许负数，量纲为分数偏移，不能直接当最终分数。
- `hybrid`：个人预测加经 ESS/不确定性收缩的条件残差；必须引用 Cohort 修订和拟合证据。
- `chart-feature`：仅提供谱面信息；不能声明 point 或成绩分布。

个人输入绑定全部六项 scope，并检查 legacy song/course 与权威解析结果一致。featureCutoff≤generatedAt≤asOf。来源不匹配时整份个人证据不可用。调用方必须从可信估计快照提供谱面/画像修订，不能用当前修订包装旧估计。

比较函数只接受同一 scope 的 personal 和 cohort-observation。它没有 Goal、Baseline、DB 或写服务依赖。历史 Goal Baseline 继续保留创建时的 sourceRevision、成绩及身份；新 Score/Cohort 修订只产生新证据。此轮不新增 Goal 迁移或写入路径。

当前候选决策固定为 retain-personal。真实留出验证缺失时 Hybrid 显式 unavailable；不把 M0 复制成“融合预测”。
