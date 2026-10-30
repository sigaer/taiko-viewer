# B1-CURRENT-01：W1 单对象协调器与待批准执行方案

U1 实际四路获取及候选验证已完成。本次交付专用协调器，**没有生产写入授权、没有执行 W1**。当前状态仍以[唯一 Release Gate 表](viewer-1-release-gates-20261023.md)为准。

## 固定输入与实现

候选为430,712字节，SHA-256 `a3cbdfc7aff5ae7874a0dad5f33ef87dec0d47fc238d7a1eee214a88c4cf3b18`。U1实际状态201/201/200/200；精确身份及隔离内核读回通过。相对现存坏Source：歌曲623→627，新增4、更新55、无删除；profile/dojo不变，achievement两个计数数组及同步元数据变化。不是丢失的旧committed字节，四路不是原子快照，上游全集仍未证明；本案采用已批准的既有第一页读取契约。

[边界入口](../scripts/readiness/source_w1_coordinator.py)固定私有scope摘要与候选；[修复实现](../scripts/readiness/source_w1_repair.py)提取既有演练的forward-only机制，调用安装Publication的stage/publish/install及校验，不修改内核。仅允许精确父代sequence2→3、固定transactionId和current替换；其他749个引用及时间元数据、旧坏对象/提交、历史事实、Growth/Goal、身份与凭据保留。

私有映射、完整父manifest、绑定、生产路径、执行UID与命令在原私有证据目录的`w1-specific`材料中，不进入Git。哈希如下：

| 材料 | SHA-256 |
| --- | --- |
| 边界入口 | `0124c8ac2b6c49178ce5fdb0348f2a76524ebd020afb1af09f6bd6087cf88c78` |
| 修复实现 | `74ab314ae3d0a61767b0b49f8357dcbeeb9a41ef6ed5a3eb2e7411bfa6973480` |
| 两文件code bundle | `7a18d199c9aed24ea3cabf29a1270b2f3aebfde5fdfc859aac96b831cdb2eea2` |
| 私有scope | `1ea0c2ae5374ef874dc1cbfa33c96670a5224b39f3ea645c6bc98262a52fddca` |
| 父manifest规范化摘要 | `20654bf3eb1b3b8a593142d713add63d0b64af3ae4869eedecccc7a8a92572dc` |
| 正式审批材料materials.json | `4db79da91558925c2c0eff0b4d6fb02216afeacc1a3aeee5293a8231dae4dae6` |

## 执行方案与停止条件

拟维护窗口为独立批准后的下一次明确启动。有效授权须记录精确UTC起止（≤5分钟）及授权引用，绑定上述scope、代码和审批材料；任务墙钟≤60秒。执行身份限定为私有scope封存的既有维护UID。当前只有`NOT_GRANTED`模板，不存在有效W1票据；入口默认在私有读取、SQL及Source操作前拒绝。

使用原QA包装器/维护互斥、父级High2GiB/Max3GiB、2CPU及磁盘限制；宿主保持`MemAvailable ≥ ceil(30% MemTotal + 3GiB)`和PSI full avg10<2。没有将仅U1获准的一次性较低公式扩展到W1，没有改全局策略。

锁顺序为Source EX→InnoDB REPEATABLE READ绑定/歌曲锁范围锁→发布→SQL rollback释放锁。SQL只有会话设置与锁定读取，不执行业务DML。每次恢复和发布前重查精确绑定、歌曲锁0、审批材料、执行窗口；核对父代、坏对象、候选、全部非current引用。首次stage前私有保存原manifest及坏字节并fsync。

pending及新receipt必须匹配原父代、固定事务、候选和审批摘要。没有intent的失败保持旧案fail-closed；intent持久化后只完成同一新代，不尝试把已损坏父代重装为健康回滚。候选/父代/绑定/审批变化、外来pending、资源拒绝或引用校验失败即停，无自动重试。已提交再次调用只确认同一receipt，不产生第二个revision。中断后新的明确启动仍须有效的独立W1授权窗口。

提交后通过正常内核reader及projection核对候选长度/hash，检查全部活动引用、非current引用/时间元数据和原坏证据。生产受限正常读取验收在实际获批执行后进行；本轮未调用生产HTTP。新current恢复不会修复保留的旧坏revision，也不会自动推进latest-verified或改备份调度。

## 精确验证与代码审查

最终代码在`qa-99d4e4c7c6ce`通过[14项定向测试](../scripts/readiness/test_source_w1.py)，实际子进程退出覆盖intent、commit及恢复提交中断；包含提交/幂等、stage前原始材料保存失败、scope/审批/候选/父代/绑定拒绝、锁顺序、未授权零副作用及非current/保护哨兵保留。没有重跑旧20项演练、U1、分页、容量或平台迁移。

本轮精确代码核对未发现阻断问题。SQL边界使用脚本化连接验证锁定查询和rollback；没有执行生产SQL，也不把该测试冒充线上SQL锁或恢复验收。真实进程中断、Publication内核及文件操作仅发生在QA合成根目录。最终测试之后未修改协调器代码。

当前交付可进入单案W1生产审批。PR代码审查/合并与用户独立生产写入授权仍按既有流程进行；本报告和机器模板本身不构成授权。生产Source尚未修复，B恢复Gate和RC仍BLOCKED；健康同代恢复验证须在Source修复及读取验收之后另行按既有流程开展。
