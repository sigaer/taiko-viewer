# 数据可靠性与架构决策

G1 = BLOCKED。本结论依据当前Viewer源码，不依赖把P1a隔离PASS当生产PASS。

## DATA-01 非原子成绩提交

- Severity：P0；Status：BLOCKED；SOURCE/E1：[shared.ts](../../taiko_viewer/server/internal/account/shared.ts) `withUserdataWriteLock`、`writeUserdataWithHistory`（约685–742行），[songs.ts](../../taiko_viewer/server/utils/account/songs.ts) edit/create/import。日期2026-10-10，revision `8d70df2`，CONFIDENCE HIGH。
- OBSERVED：C先写临时文件再rename；之后构造H并直接writeFile。没有共同commit/journal、fsync或H失败时恢复C。H名称时间精度为秒，source相同的写入可复用路径。edit/create没有包现有Promise锁；该锁即使使用也不跨进程。
- INFERRED：C成功H失败会留下mixed revision；同秒同来源可覆盖H；并发读改写可能丢失更新。生产发生次数、受影响账号和恢复点UNKNOWN，不宣称已观察到真实损坏。
- Expected：每次已确认成绩提交可识别、完整、可恢复；读取者不把部分提交当新完整版本。Scope：使用此helper的编辑/创建/导入等路径，及依赖其C/H的Growth/Goal/总结。
- 隔离复现：两writer同账号屏障并发、C发布后H故障、同秒重复写、ENOSPC/权限失败、崩溃恢复；用合成目录和源语义适配，不能只模拟happy path。预期旧实现反例与修复后提交/回滚各可证明。
- 最小修复方向：统一读改写锁与可恢复提交合同，覆盖真正writer及reader；单给helper加进程锁不足。Cost：先小fixture，QA≤1GiB/worker≤512MiB；大样本仍保留既定IO PSI门槛。Rollback：旧reader只能消费完整兼容投影，不得忽略pending状态。
- Owner decision：批准跨writer最小安全任务及恢复合同；本轮不实施。

## 数据语义

当前loader仍按文件名顺序选择最近2000文件后解析，full/delta及bestScores前态不可随意裁剪；零变化也可能改变observation/provenance。invalid计数与coverage只说明观察可用性，不证明源提交完整。

0.81.10 `historyVersion`校验inode/ctime/size及目录变化，最多8并发stat；变化/失败/坏文件不保留结果。但已经读到的结果仍会返回，随后调用再重读，**不是fail-closed的跨文件快照协议**。源码注释也明确其只保留旧逐文件边界。

0.81.7引入日存档读取与合并、measurement历史保护、严格最高分判定DF归因；不是0.81.4的全部语义原样继承。历史measurement优先，当日较新代表允许更新；图表仍画存档值，不证明跨公式净增长；score facts仍≤90天。见[变更审查](11-change-impact-review.md)。

## 路线决策

**Decision：先补证据，优先比较A的最小闭合方案；不默认要求P1b。** 1.0依赖的是数据安全，不是特定技术选型。

| 路线 | 进入条件 | 成本/回退与限制 |
|---|---|---|
| A 现有文件加固 | 所有writer受共同锁、commit/fence、恢复和备份合同约束，reader识别完整提交 | 小规模故障/并发先行，保留C/H兼容投影；缺外部writer覆盖不能PASS |
| B P1a | 找回可复核隔离材料，重新基于0.81.10及日存档适配；复测full-size IO PSI/peak、lease consumer | 旧0.80.0隔离代码不能直接合入；0.81.10报告已删除Viewer分支/worktree，复现性待核 |
| C DB canonical | writer convergence、事务+outbox投影、幂等fence、迁移parity和恢复验收 | 不存在DB+文件天然原子事务；旧writer绕过DB仍会split-brain；成本最高且未批准 |

P1a继承状态：隔离68/68 PASS、full-size IO PSI 12.04%超过2%持续10秒门槛、生产覆盖NOT VERIFIED、生产集成未授权、OVERALL BLOCKED。这是历史证据；0.81.10没有解除这些Gate。P1b无生产迁移验收。

DATA-02：新日存档的绑定/删除/旧日冻结/补齐provenance/跨存储恢复，severity UNKNOWN，status UNKNOWN。已有0.81.7报告称637个当前绑定、18577个v1日存档、511个旧日值不变；此次不读取私人数据重验。下一轮验证存档所属ID、损坏/超8MiB行为、撤销与删除后的可见性和备份恢复，不能将外部存档排除在1.0保护范围外。
