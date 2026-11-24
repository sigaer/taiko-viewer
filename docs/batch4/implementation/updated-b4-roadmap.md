# Updated B4 Roadmap

| 阶段 | 本次状态 / 后续内容 |
| --- | --- |
| B4.0 | 已批准契约 a68d8bda；本次统一 priority 文档 Discovery 最后一处泛称 |
| B4-1 | 独立离线内核、严格输入/证据验证、只读 Goal 关联、组合器、新回归、旧回归与实测性能；候选交付待验收 |
| B4-2 | 在独立隔离范围实现可信 evidence projection/resolver、真实模型版本绑定、样本 provenance；补 weakness/task capability 前先冻结专用 schema 与证据 |
| 后续 Portfolio | 独立批准后实施多 Goal schema/API/CAS/token/迁移与历史兼容；并发、权限解绑、回滚、nonce replay 均需数据库验证 |
| 后续推荐接线 | 独立批准后适配在线请求、用户接受、preview 与 UI；证明 planned 与真实 presentation gate；不能直接替换 B3 |
| 后续效果评价 | 实际曝光→接受→Goal→可识别成绩观察链；八项指标区分未知/未成熟/缺覆盖，再谈真实效果和概率校准 |

验收前置：审查本批完整结果、独立样本单位、canonical 身份拒绝边界、所有 unsupported 能力、候选排序与短缺、B3 原样回归、测量环境限制。没有证据的类型允许缺席，不以数量或覆盖要求降低 A 门槛。

停止点：本候选提交并推送后等待验收。不合并 main，不部署，不发布正式 Release，不启动 B4-2、迁移或生产 UI/API。
