# 运维发布与恢复审计

G4 = UNKNOWN。Finding OPS-01：severity UNKNOWN，status UNKNOWN；SOURCE：当前部署脚本、memory指南、仓库service模板、只读systemctl状态；2026-10-10、`8d70df2`，E1+有限E3。CONFIDENCE：代码机制HIGH，灾难恢复能力LOW。

## 已观察事实

- 标准路径为`run_build.sh → deploy_forum_web.sh "<HEAD subject>"`。wrapper有维护锁、余量/PSI门禁、development-build子slice、30分钟上限、4/5GiB high/max；本轮未调用。
- deploy脚本校验已跟踪工作区、HEAD subject与package版本；fetch并push后构建，以git archive HEAD和外部schemas形成输入；产物next/previous切换，健康检查失败调用产物rollback并退出。**Git已推送不等于部署成功，源码HEAD不证明运行产物版本。**
- 构建还依赖外部schemas及共享node_modules；需在RC证据记录hash/lock和依赖版本。脚本临时build root仍显式用/tmp，不能假定wrapper的TMPDIR覆盖所有调用；本轮不改脚本。
- 健康检查为本地titles、receiver health与公网titles，没有覆盖全部认证用户旅程。
- viewer、sync-receiver、memory-monitor均active/running；未核验完整运行配置与产物版本。仓库模板描述共享userdata、Nuxt Node服务与外部Python receiver，这不是所有bot/cron实例清单。
- memory monitor是采样存储，不自动等于告警已接收；年度准入设计为单机持久门禁，不能据此保证多机一致性。

## 恢复证据缺口

| 对象 | 已证明到哪一步 | 当前状态 |
|---|---|---|
| Viewer代码/产物 | 有previous输出与失败回退源码 | 当前回退点可用性、实际演练UNKNOWN |
| DB | 本轮无生产查询、无恢复演练 | 备份频率/加密/保留/校验UNKNOWN |
| C/H | 有历史风险审计 | 完整提交点、断链检测、已提交数据恢复UNKNOWN |
| daily ability archives | 0.81.7报告记录冻结存档与补齐 | 纳入备份、删除/撤销、DB一致恢复UNKNOWN |
| 配置/密钥 | 已知EnvironmentFile引用 | 受控恢复策略UNKNOWN，不读取secret内容 |
| RPO/RTO | 未取得批准合同 | NOT DEFINED IN AVAILABLE EVIDENCE，不推断运营方从未定义 |

## 后续隔离演练

Owner批准候选RPO≤24小时、RTO≤2小时是否足以兑现成绩承诺；这是讨论起点，不是可接受静默损失的豁免。若已确认提交要求零丢失，应采用RPO=0提交日志合同另行评估。

演练使用合成C/H、DB与日存档联合恢复包，包含清单、hash、schema/算法/owner版本和恢复顺序。场景包括C删除/损坏、H缺失/断链、部分恢复、DB与文件错位、ENOSPC、并发提交、迁移失败和解绑删除。核对已提交计数、最终hash、无跨owner数据、无孤儿、job重试幂等及耗时；仅在_test DB和隔离目录执行。

成本：先小fixture，单个串行worker、既定memory runner；大数据演练需先审批输入/IO预算。失败行为：停止演练并留脱敏清单，不对生产restore、restart或配置回退。源代码rollback与数据恢复必须分别验收，不能用一次标准部署成功代替。
