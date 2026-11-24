# Known Limitations

- 内核无生产接线；B3 推荐、wire、126 Golden 和旧报告维持原行为。没有新 UI/API、Goal 存储、迁移、CAS、token/nonce、曝光采集或浏览器验证。
- EvidenceRecord 是未来受信 resolver 的版本化离线输入。内容 hash 证明一致性，不能证明 producer 真实或签名有效。新 metadata 不能由旧 B3 缺失字段猜造；调用方必须有来源授权。上下文/prepared 索引应同批使用。
- 真实可识别 attempt 样本不足。B3 snapshot/同步不当 Session；皇冠近似条件仅在合成可信 attempt/window fixture 下验证，未测真实 FC/DF 成功率，也未训练预测模型。
- NG mode/platform 新投影字段未知保留 null，不能从旧聚合记录补造同模式比较。UTC 日界用于本版三次证据跨度；玩家本地日界需要版本化后续设计。
- 当前只注册 score load-fit、explicit focus 六维训练。残差 schema/weakness producer 未实现；所有无证据 weakness 正向声明拒绝。训练可练不证明能力提升。
- Challenge 定义/进度可验证，专用复合任务 actionability producer 未接入，因此本批挑战不能进 A/B；不把不同 PB 拼成同次任务通过。
- 当前 Authority 支持 CN 政策；JP 当前可玩资格未知，不能把 CN 结果外推。没有显式歌曲版本族关系就只以 canonical songId 去重。
- Identity adapter 接收上游已验证 snapshot；不会重读 production pointer、重新生成目录内容 revision 或访问其他设备。
- 离线 GoalLink 不是签发令牌、接受事件或写权限。所有 canCreateGoal=false；Goal completion 仍由旧唯一 evaluator 负责，本批未复制或执行完成迁移。
- 组合器是有界 greedy，优先硬质量与用户排序，不证明全局最优覆盖。预算内批量性能仅代表本机合成离线测量，不构成在线延迟、吞吐或内存容量承诺。
- 质量门槛只标 planned_slate。Priority Acceptance/Achievement、Type-specific Precision、真实 Candidate Coverage 和 Goal Progression 需要后续曝光/接受/真实观测链路；不能把 clicks、同步或系统校验通过当真实玩家结果。

本批未测试 G02–G08 的数据库生命周期/并发/token 子场景、E事件采集/归因和M数据库迁移。G05 只测纯函数幂等与输入冲突，不声称事务幂等通过。
