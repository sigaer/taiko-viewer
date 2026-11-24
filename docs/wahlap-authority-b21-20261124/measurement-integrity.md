# Measurement Integrity follow-up

原 11 次和额外 3 次共 **14 次事件**已逐条重分类：[事件矩阵](integrity/measurement-14-events.json)。来源是 Batch 2 留存的精确 journal、归档和只读 SELECT 证据；本批不修改、回填或重新请求真实 Measurement。

| 事件组 | 范围 | 已确认链路 |
|---|---|---|
| A：原 11 次，同一用户/绑定 | 2026-11-22 上海时间 23:32:38 至 23:38:04 | Python 归档 writer 已执行，已有归档 sampleCount=0；Viewer reader 拒绝；SQL upsert 未进入 |
| B：额外 3 次，另一用户/绑定 | 2026-11-23 上海时间 23:06:20、23:06:44、23:39:01 | 同样为 sampleCount=0 reader rejection；没有 SQL persistence failure 证据 |

根因是 writer/reader 契约不一致：既有 Python 日能力归档 writer 允许零样本、有限数值；Viewer reader 要求 sampleCount>=1，抛出 `Invalid daily ability point`。旧笼统日志把失败描述成 persistence failure，实际失败发生在 reader validation，不能归因数据库写失败。Batch 2 的隔离正/负控制重现此分歧，正样本能通过。

全部 14 次的分类：Reader rejection=14，Python archive writer executed=14，Viewer SQL writer not entered=14，实际 SQL persistence failure observed=0。重复出现的是再次请求后的同类拒绝，没有自动 retry 或 retry success 的可靠证据。不能将重复日志计成 14 条丢失的有效能力测量。

Batch 2 只读 SELECT 观察时，两个受影响日均无 SQL Measurement：A 在其他日期有 7 条，B 总计 0 条。这证明**观察时对应 SQL 点缺失**；不能证明事故发生瞬间数据库状态，也不能把零样本当作本应有效保存的能力值。原始成绩、历史字节及空归档存在，没有发现实际成绩丢失。

每条事件的精确历史请求 scoreRevision 均为 **unknown（0/14 可确认）**。错误日志未记录它，未保留精确请求 payload；不能从相邻归档、bxx.source 或当前模型反推过去的 revision。源头为什么无匹配模型样本仍未被精确证明，不能猜测玩家没有成绩。

SQL 原有去重规则保留：INSERT IGNORE 的绑定/revision/算法唯一性和同日 NOT EXISTS 条件不改变；0 affected rows 还可能是绑定消失等情况，因此新日志记 `not-created`，不武断写成 duplicate。未为调查运行 INSERT/UPDATE/DELETE。

候选新增 [measurement-attempt](../../taiko_viewer/server/services/growth-history/measurement-attempt.ts) 和 writer 回调，仅补未来可追溯字段：attemptId、user/binding、精确 scoreRevision、capturedAt、Catalog revision/PV、算法/measurement version、sampleCount、modelRevision、规范化 SQL writer payload hash、stage、writerExecuted、outcome、retry=false。阶段区分 reader-validation、writer-payload、persistence；无原始成绩或凭证 payload 写入日志。新增隔离测试验证 reader rejection 不进入 writer、payload 准备失败和真实 persistence 调用失败可区分。

这项观测修改不能补回历史缺失信息，也没有改变零样本数据处理规则。未来如需修复该契约或选择回填有效点，另开数据方案并审批。

Weekly 继续允许跨算法版本比较、保留差值，并展示期间计算模型发生变化的说明。没有通过拒绝差值消除问题。Kinoko `2765-01-01` 仅保留成绩值，不能生成真实 play event、Recent Growth 或真实日期归因。
