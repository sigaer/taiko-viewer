# Batch 4.0 — Recommendation Intent Contract

状态：设计候选，等待审查；不授权 B4-1、算法替换、迁移或发布。基线为 `candidate/viewer-player-intelligence-b3-20261124` / `c49717b6b7b7f697c0975c3d1477b7abffb26b7f`。本目录的 MUST/必须表示审查通过后实施的约束，不表示已有实现。

标记约定：**现有**指该提交中可定位的实现；**新增**指 B4 契约；**保留**指继续采用原语义。全部新增字段不能直接传给旧 API（旧 API 拒绝未知字段）。字段总表见 [Candidate](candidate-schema.md)，现状证据见 [兼容性](backward-compatibility.md)。

## 三条独立轴

新增 `intentType = score_improvement | crown_completion | dimension_training | discovery | challenge`，仅此五种。新增 `priorityGroup = A | B | C | D` 和 `readiness = ready_now | reasonable_stretch | not_actionable`，分别表达组合位置和当前行动证据。不能用类型推导组别，也不能用组别证明达成。

Personal Goal 是用户明确接受的意图实例，由 `goalIds` / `goalLinks` 关联任意类型；不是第六种推荐类型或另一套算法。一个谱面可有提分、FC、DF 等多个独立目标。没有 Goal 的候选合法；生成、展示、点击均不创建 Goal。

## 类型矩阵（全部为新增路由契约）

| 类型与 subtype | 输入 / 候选来源 | 输出目标、必要证据 | 不支持 / 推荐理由 / 优先级资格 |
| --- | --- | --- | --- |
| `score_improvement`: `score_pb`, `score_target`, `rank_upgrade` | 权威成绩快照、当前 PB、既有 stable/PB estimator、样本口径；既有 ordinary 顺序、有效 Goal 或目录内明确分数目标 | 提高 PB、达到显式整数分数或提升 Rank；分数门槛、独立 stable 估计、模型/输入版本、充分性和时间证据 | `inStrictRange`、单 PB、孤立预测不证明稳定可达。解释当前值/目标/stable 与缺项；满足专用 evaluator 才可 A/B，可信长期目标可 C，自由查看可 D |
| `crown_completion`: `clear`, `full_combo`, `dondaful_combo`, `ng_reduction` | 权威皇冠状态、判定语义、谱面版本；目录缺皇冠条目、旧 target 列表、Goal | 分别为 Clear、FC、DF 或可比记录 NG 减少；专属皇冠/判定 evidence，不能借分数预测 | 旧 `combo gap`/推荐指数只是候选来源。理由说明具体缺口及语义，不能说高分意味着 FC/DF；有专属可达证据才可 A/B，长期愿望 C，证据不足只能 D 浏览或不展示 |
| `dimension_training`: `dimension_practice` | 现有六维画像与一致性；有来源的谱面维度特征、适配负荷、训练依据；维度过滤后的目录和明确用户训练意图 | 可执行的指定维度练习动作；玩家对应维度证据与谱面对应特征同时存在 | 六维最低项不能单独叫短板，星级不能替代专项特征。理由说明“为何此维度、为何此谱面”；能执行训练不等于能力会提高；A/B 需要专用准入，长期训练 C，兴趣查看 D |
| `discovery`: `explore_chart` | 当前目录、地区可用性、成绩覆盖证明、显式偏好、负荷匹配；目录探索分支 | 探索特定谱面；输出 `unplayed_confirmed / no_score_record / coverage_unknown / played_known` | 无记录不自动等于没玩过。只有覆盖充分才在限定来源范围称未游玩。充分覆盖和匹配可 A/B，D 自由探索；通常无长期目标，不强行放 C |
| `challenge`: `dan_task`, `event_task` | 真实任务 ID、版本、要求、有效期/地区、当前进度与相关谱面；任务目录 | 明确 task/requirement 的下一步，或完整任务目标；每个要求有进度证据 | 任意高难谱不是 challenge；缺任务或进度不生成该类型。当前可推进且专用评估通过可 A/B，完整任务属长期目标则 C；D 仅任务浏览 |

Subtype 是有命名空间的判别字段，不能自由混搭。`score_pb` 对应旧 `score-pb`，`full_combo` 对应旧 `fc`，`dondaful_combo` 对应旧 `df`，不改写历史 GoalType。旧 `TargetRecommendationKey='dondaful'` 是另一入口的已有字符串，不能全局替换。

## 能力与意图边界

保留六维 `big_song / stamina / speed / accuracy_power / rhythm / complex`，保留 V1 的 per-dimension-top20 / duplicateHandling=preserve。B4 不生成另一套 Rating。未来细分维度用新增 `{namespace, key, schemaVersion, featureRevision}` 注册，必须给出尺度、来源和与六维的关系；不得把未知细分维度塞进 `RatingDimensionKey` 或猜测手法。Chart Intelligence 当前没有被假定为已接通。

用户偏好包括类型权重、排除谱面和手动 Goal 排序；不修改 evidence/readiness。用户把 DF Goal 排第一，不使它进入 A。算法选出的候选只有在用户确认目标种类、谱面和目标后才转换为真实 Goal，并在服务器冻结独立 baseline。

## 现有模式的处理

现有 `DecisionPreferences.focus` 的 skill-match/growth/goal/discovery/breakthrough 是排序模式，不是上述类型。不得直接映射成五类并宣称完成迁移。ordinary 只是来源；有显式提分 target 才能生成 score 候选。growth 必须补足训练证据；goal 经 GoalType 分派；discovery 必须补覆盖状态；breakthrough 属提分意图，不能冒充段位/活动 challenge。

现有 score-pb Goal 的完成条件仍是 `highScore > baseline.highScore`，对应包含等号的候选分数恰为 baseline+1。任意更高指定分数需要新增 `score-target` GoalType/evaluator，不能复用 score-pb 名义改变旧语义。

## 推荐理由要求

每个理由必须指向 evidenceRef，并绑定具体动作/target；显示目标差距、数据口径和缺项，不编造音乐手法、最近 Session 或成功概率。可用理由例：`SCORE_STABLE_SUPPORTED`、`CROWN_FC_NEAR_EVIDENCE`、`DIMENSION_PLAYER_CHART_MATCH`、`DISCOVERY_UNPLAYED_SCOPED`、`TASK_NEXT_REQUIREMENT`。机器代码及状态见 [专用评估](type-specific-evaluation.md)。产品文案以后单独设计，不把本目录规格直接显示在 UI。

交付导航：[优先级](priority-actionability-contract.md) · [Goal Portfolio](goal-portfolio-contract.md) · [专用评估](type-specific-evaluation.md) · [Candidate](candidate-schema.md) · [Composer](slate-composer-design.md) · [事件/评估](evaluation-and-event-contract.md) · [兼容](backward-compatibility.md) · [路线图](implementation-roadmap.md) · [验收](acceptance-criteria.md)。
