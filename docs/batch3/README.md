# Batch 3 — Player Intelligence & Recommendation Foundation

状态：候选实现，等待审查；不具备算法替换或生产发布批准。

基础提交：Viewer Batch 2.1 `ae46bfd6`。候选分支：`candidate/viewer-player-intelligence-b3-20261124`。源工作树位于 `/var/tmp/taiko-batch3-20261124/viewer`，没有修改生产工作树或真实玩家资料。

## 交付索引

| 用户交付项 | 文档与实现 |
| --- | --- |
| 1. Player Profile Decision Contract | [player-profile.md](player-profile.md)，`utils/player-intelligence/context.ts` |
| 2. Long-term / Recent Performance Model | [player-profile.md](player-profile.md)，现有 Rating / Measurements / Fact 引用 |
| 3. Goal / Recommendation Dependency Map | [goal-training-home.md](goal-training-home.md) |
| 4. Matching Architecture | [matching-benchmark.md](matching-benchmark.md)，`matching.ts`、`adapters.ts` |
| 5. Reachability Evaluation Design | [matching-benchmark.md](matching-benchmark.md)，独立 stable 准入 |
| 6. Recommendation Offline Benchmark | `benchmark.ts`、两段离线 runner、[证据](evidence/offline-benchmark.json) |
| 7. Training / Next Action Design | [goal-training-home.md](goal-training-home.md)，`next-action.ts` |
| 8. Taiko Agent External Artifact Contract | [external-artifact.md](external-artifact.md)，隔离检查器 `external-artifact.ts` |
| 9. Living Home Integration Plan | [goal-training-home.md](goal-training-home.md)，`projectLivingHome` |
| 10. Phased Implementation and Acceptance Criteria | 本文与 [验收记录](acceptance.md) |

实现路径前缀为 `taiko_viewer/`。全部新增模块为离线纯函数，没有注册 HTTP 路由、后台任务、数据库表或生产 feature flag；现有推荐算法和所有 UI 保持现行入口。新增 adapter 已实际消费现有 TS 合同并通过端到端纯函数测试，不是另起一套事实体系。

## 本批完成边界

完成 source audit、统一 context、既有普通推荐/稳定预测的连接适配器、保守准入和排序、目标下一步/首页内容投影、外部制品隔离检查、可复现指标及既有策略回放。普通推荐的 `inStrictRange` 与稳定可达严格分离。无可靠 stable 预测、无完整身份、版本或可用性时，不补足 K。

没有把合成测试当真实效果评估。既有 core 的 126 个推荐金样例实际运行并保留输出，3 个既有回归测试通过；真实玩家可识别游玩标签为 0。合成指标用例只证明指标算术与边界，无法判断候选算法是否优于现行推荐。概率校准没有概率输出时返回 unavailable。

## 分阶段实施和验收

| 阶段 | 产出 | 验收条件 | 本批状态 |
| --- | --- | --- | --- |
| B3-A 决策合同 | Player/Chart/Goal scope，来源地图，时间边界 | 不重算 Rating；不同模型不混合；错身份/未来知识被排除；覆盖不足明确 | 已实现并离线验证 |
| B3-B 可独立执行基础 | existing adapter、stable gate、两种排序、Next Action、Living Home projection | PB-only/低可信/下架/版本漂移不能入选；不足 K 不补齐；点击无事实写入；公共内容不等待推荐 | 已实现并离线验证 |
| B3-C 离线基线 | 现有策略输出、指标 oracle、版本/hash/复现命令 | 既有 golden 不变化；7 指标完整报告分母/未知；重复运行一致 | 已完成；仅合成基线 |
| B3-D 候选环境接线 | 在现有请求链路组装 context；首页 Next Action 与新曲/活动/社区并行展示 | 无新增事实写入；绑定切换清空；取消/完成/失败回退；现有 signed token + CAS 链路通过；视觉/i18n/无障碍验证 | 后续独立候选工作；不等外部 Agent |
| B3-E 真实离线评估 | 经批准提供的匿名、时间冻结、可识别游玩标签队列 | 固定训练/调参/测试窗口；三策略同门槛分解比较；未知与分群透明；不根据测试集调阈值 | 需要合法导出样本，未声称完成 |
| B3-F 替换决策 | 审查报告及明确替换/不替换结论 | 至少达到以下预注册规则；负责人批准独立发布 | 本批不执行 |

建议 B3-E 在取数前冻结：每个关键地区/能力/冷启动群体至少 100 个有解析稳定标签的曝光，否则该群体只报探索结果；按玩家聚类 bootstrap 95% 区间；条件稳定精度相对基线差值的下界不低于 -0.02；标注覆盖不下降超过 0.02；Actionable Coverage 不以稳定门槛放宽换取；MAE 的相对增幅上界不超过 5%。以上是拟议评审门槛，不是已完成的统计验收。样本不足继续保留旧算法；需要更多样本时不迁移真实玩家数据。

## 协作与约束

已按要求启动 `player_context`、`matching_benchmark`、`goals_living` 三个 Codex Subagents。子会话没有文件工具，Lead 向其提供已核实源码摘录；三者并行完成合同、指标/标签边界、目标/首页设计审阅，Lead 完成文件实现与整合。已采纳其关于知识时间、覆盖窗口、模型口径、稳定阈值实验性质、曝光历史、终点评价和原始基线独立保存的审阅意见；没有将其建议冒充独立源码审计。

未访问 Taiko Agent 仓库，未假设其 Schema；未重写 Rating；未迁移或读取真实玩家数据用于基准；未调用部署脚本；未引入外部 Agent 生产依赖。Viewer 是独立仓库，遵循其 AGENTS，不同步 Sakura_bot。代码与证据仅提交/推送本候选分支，不合入 main。
