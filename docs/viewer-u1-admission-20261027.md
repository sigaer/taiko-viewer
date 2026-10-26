# U1 明确授权后的首次资源准入结果

后续：用户要求手动复查资源后通过，并进一步明确继续；U1首个请求返回401后停止。最新状态见[限定执行结果](viewer-u1-execution-20261027.md)，下文保留首次资源准入失败的完整记录。

日期：2026-10-27，Asia/Shanghai。承接main `763bd3c48fabbb8dce59b629e4350fb682e3ab04`，依据[已审查U1准备报告](viewer-u1-preparation-20261027.md)、[原U1/W1申请](viewer-source-repair-requests-20261026.md)及用户本轮的明确授权。现行状态只维护在[唯一Gate](viewer-1-release-gates-20261023.md)。

## 授权与立即停止

用户已明确授权本案U1最多四次限定权威只读请求、隔离保存与验证，**不包含W1**。本轮状态是 **AUTHORIZED_RESOURCE_BLOCKED**，不再是“缺少U1授权”。授权没有扩展到同步流程、生产Source/Writer/Publication、数据库、verified或备份调度。

首次只读执行前资源检查位于UTC 2026-10-26 16:39:37–16:39:42（北京时间10月27日00:39:37–00:39:42）。沿用已审查适配器的门槛：MemAvailable≥25%物理内存+3GiB，且宿主内存PSI full avg10<2。

| 指标 | 实际 | 要求 | 结果 |
| --- | ---: | ---: | --- |
| MemAvailable | 9,229,672 KiB | ≥11,169,626 KiB | 不通过，差1,939,954 KiB |
| 内存PSI full avg10 | 0.09 | <2 | 本项通过，不能覆盖内存不足 |

依据用户“若任何前置条件不满足，立即停止并报告”，在首次资源检查失败后立即停止执行。没有启动读取适配器或签发可执行票据、加载cookie、创建网络会话或响应目录，也没有自动重采样、等待后重试、降低门槛或清理宿主资源来促使通过。

main和运行基线核对为：main `763bd3c`，生产checkout/运行构件 `92e6106 / Viewer 0.87.11`，PID4179944、NRestarts=0、自启disabled，MemoryHigh/Max/SwapMax仍1.5GiB/2GiB/256MiB。AGENTS、现行Gate、U1申请及适配器资源检查代码已读取，代码和请求范围未修改。

本轮未继续做本案hash/绑定/锁等后续执行前复核；[准备报告](viewer-u1-preparation-20261027.md)中00:12:33的sequence2/坏hash/绑定/锁0是此前证据，**不冒充本轮的新复核**。将来若按同一授权范围恢复，必须重新核对本案、代码、私有目录及全部实时准入。旧准备计划的NOT_GRANTED只是授权前快照；本轮单独记录明确授权，但未激活或运行该旧计划。

## 本次结果

| 审查项 | 实际状态 |
| --- | --- |
| 四个上游请求 | 全部NOT_ISSUED，实际0次 |
| 精确身份结果及响应完整性 | NOT VERIFIED；无上游响应 |
| 候选长度、SHA-256、结构差异、可信来源 | 无候选，NOT VERIFIED |
| 是否完整当前Source | NOT VERIFIED |
| 精确恢复旧字节或新revision | 尚无候选可裁决 |
| U1 | 已授权；本次资源准入失败后停止，无自动恢复任务 |
| W1 | 未授权、未执行；可信候选形成后仍须新的独立明确授权 |
| Source/RC | 既有fail-closed保持；RC仍BLOCKED |

证据保存在现有私有证据区的 `viewer-u1-admission-20261027/admission-result.json`，只含安全的资源数值、代码hash及授权/停止状态，不含cookie、Source身份或正文。用户授权已留档，不应在后续同范围工作中误报为“尚未授权”；本轮已按停止边界结束，未安排自动重试。

未执行W1、全量恢复或真实业务写入；未改Source、Writer、committed历史、verified、数据库权限、调度、存储位置或安全运行时；未升级Viewer或部署，所有原始失败证据、回滚及WIP保留。
