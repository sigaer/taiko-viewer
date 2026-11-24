# Registry Contract

| Intent | 合法 subtype | Target |
| --- | --- | --- |
| score_improvement | score_pb / score_target / rank_upgrade | score / score / rank |
| crown_completion | clear / full_combo / dondaful_combo / ng_reduction | 对应 crown / ng_reduction |
| dimension_training | dimension_practice | dimension_practice，现有六维 |
| discovery | interest_discovery / level_matched_discovery | explore_chart，分别 interest / level_matched |
| challenge | dan_task / event_task | task_requirement 或 long_term task_completion |

联合验证，不接受三个字段各自合法但交叉错配。Personal Goal 不是第六 intent。Target version 固定 target/1；NG/rank/score 范围、比较方向、空 task completion、dimension namespace/schema/key 均独立校验。

六维：big_song、stamina、speed、accuracy_power、rhythm、complex。未来 Chart Intelligence schema 必须显式注册；当前不能传任意字符串冒充已验证维度。

输出验证器 ID 为 `b4-contract:<subtype>`，evaluatorVersion=1，policy=viewer-multi-objective/1。这是新增 B4 validator capability，并非声称存在同名生产预测模型。scope 与 subtype 绑定，不能用 score evaluator 证明 FC/DF。score/load-fit 的证据投影约定使用 `core-estimator/1` 和 `core-estimator/pool-distance-extrapolation/1`；这些是新 resolver 的版本化规范名，不能直接声称现有 B3 wire 已带这些元数据。实际 adapter 必须绑定真实 producer 版本和诊断，否则不得产出合格证据。

当前可验证的正向输出：score/rank（rank 需权威分数映射）、四皇冠近似行动证据、explicit focus 六维训练、score load-fit 的水平探索。Interest 只能验证相关性且 readiness=not_actionable。没有注册的残差 schema 时 weakness 路径不受支持；没有专用 task actionability producer 时挑战仅接受真实定义/进度的 not_actionable 输出，不能用独立 PB 拼同次任务。

GoalType 保留 `score-pb / ng-reduced / clear / fc / df / rank-upgrade` 的既有 completion evaluator 语义，只引用现有实现路径，不复制完成规则。`played` 与任何新增 GoalType 返回 completionSupported=false。所有 offline capability 的 canCreateGoal=false；注册或验证成功不授权建 Goal，不签 token，也没有“自动接受”行为。

I01/I02 与 T11 覆盖联合表、未知 intent/subtype/target、原型键、未知 evaluator/version、unsupported GoalType 和注册不等于创建授权。
