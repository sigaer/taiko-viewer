# Phase 0：重复逻辑报告

2026-10-10。详细源码/符号证据见 [原架构审计](platform-architecture-audit/duplicate-logic-report.md)，当前 hash 复核见 [Gate 0](taiko-domain-current-state-audit.md)。

| 领域 | Sakura_bot | taiko-bot | Viewer | 抽离处置 |
| --- | --- | --- | --- | --- |
| Rating v1 | 混合 IO/计算/绘图，GREAT/GOOD 权重及分段 | 相同主公式副本，调用过滤不同 | Python bridge | 纯公式、model 输入、TopN，宿主保留 loader/render |
| 六维 v1 | 大歌/体力/高速/精度/节奏/复合 | 同源副本 | 基础数值委托；Growth priority 是产品规则 | 数值统一，产品规则不混入内核 |
| Rating/六维 v2 | 中心精度公式、双权重、full-score reference | accuracy>rating 分支公式与聚合不同 | 分发 v2 model | 显式 profile；Golden 保留双方旧结果 |
| Score model/parser | userdata 字段、Hiroba HTML/normalize、source/time | normalize 相同、parser 局部漂移 | manual/Kinoko、achievement、事实时间 | 契约映射保留计数、来源、原始时间；clock 注入 |
| Chart parser | TJA analyzer、roll/branch、merge index | 消费公共统计/曲库，不能虚构完整 TJA 实现 | 消费统计，merge_index bridge | text→value 纯 parser；文件/索引 IO 留宿主 |
| Recommendation | ordinary 候选、target_score/history 模型 | ordinary 同源、target 模型明显不同 | 调中心，添加今日计划/Goal UX | 候选/评分纯化；策略版本冻结，Goal 保留 |
| History / Growth | snapshot replay、annual、daily ability | 读取缓存/合并、趋势 | dailyProgress/evidence/facts/SQL measurement | Phase 1 provenance 契约，Phase 5 fact boundary，Phase 6 writer |

原扫描 53 个配对文件、10 个整文件相同、718 个同名 AST 相同函数覆盖 B 的 11,365 个不重复函数源码行。该口径未计重命名或跨路径语义重复，也不表示无上下文差异。合成 v2 accuracy `(rating=10, accuracy=12)`：中心 `11.098612`，taiko-bot `10.954451`。在契约和 parity 完成前，不可用“统一”掩盖这种结果变化。
