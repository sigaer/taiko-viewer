# Viewer 1.0 Release Gate 当前差距

更新：2026-10-25，Asia/Shanghai。此文件是唯一现行 1.0 Release Gate 表；[本轮证据](viewer-1-rc-blockers-20261025.md)和[历史收口记录](viewer-1-rc-closeout-20261023.md)解释证据，不另设 Gate。初始远程 main 为2d571d0、生产checkout为0b6da1f、运行构件为efbbdb7/0.87.9。本轮已按标准流程发布 **0.87.10 / d21779a84905d68c9d6b55ed78b7c8ea2463bd69**，buildId为50a30255-b0a6-43c3-94f0-dfc844246b83，公开More页版本一致。后续纯仓库Gate文档提交不作为新运行构件。

| Gate | 当前分类 | 实际证据及边界 | 剩余最小工作 |
| --- | --- | --- | --- |
| API用户／资源授权与凭据边界 | PASS（既有公开范围） | 保留旧 Developer Token 跨账号当前成绩只读、v1 ResourceGrant、account:read 的既定权限；0.87.8 凭据安全及0.87.9定向SQL/入口证据沿用。本轮不扩权，不执行真实业务写入。 | 仅补实际受影响反例；无新P0时不重建权限工作。 |
| 单一Writer／Publication一致性 | PASS（既有范围） | 原Writer接入与失效拒绝证据沿用；当前503份committed manifest的实时观察不是恢复检查点。 | 本轮备份纳入当前Publication格式及同代引用对象；不重开B-0或平台迁移。 |
| Contract及跨端语义 | PASS（既有Schema/Golden）；NOT VERIFIED（正式1.1冻结） | 实际公开meta HTTP200、Contract1.1，状态字段实际名为status，值FREEZE_CANDIDATE，contractFrozen=false。schemaRevision与源码一致；DTO、权限及CalculationProfile未改。 | 本轮明确保持候选，不作正式冻结决定；文档公开不改变冻结状态。正式Freeze仍须现有release-controlled lifecycle的明确发布决定及meta/OpenAPI/样例一致。 |
| Growth／Goal／Annual历史事实连续性 | PASS（既有规则及范围） | 冻结趋势、周报可比较性、观察时间、Goal证据和去重沿用既有验证；不重算或改写历史，旧PNG缺口及已接受风险保留。 | 仅在事实投影实现变更时补受影响回归。 |
| B：生产恢复、备份与回滚 | BLOCKED（源完整性／有效恢复点）；PASS（实际规模原生还原及受限验证） | 一次同代诊断捕获实际覆盖35表/11,308行、90,092文件/6.955GB及506份Publication vector；原生还原195.887秒，全部SQL值摘要/文件hash一致。发现一份现存current对象及projection不符合committed hash；恢复后也被拒绝。21项健康代表检查及全部恢复凭据/Grant失效、审计保留通过，不能覆盖该失败。verified仍为10月17日旧点，没有推进。 | 取得损坏对象对应committed hash的可信副本，或另行裁决源修复；本轮未修改生产源数据。已核对的当前包与旧完整点无精确副本，不拼接未知代次。有效RPO≤15min/RTO≤120min仍NOT VERIFIED；调度/权限/位置/PITR均未改。 |
| A：有效歌曲SSR500 | BLOCKED（历史归因未完成） | 原窗口65次/47个有效ID成立，旧journal无错误栈。有限匿名页面/API、隔离API失败/UGC缺失/延迟并发未复现历史故障；两个合成SSR反例有栈，但不是已证实的历史原因。获授权的受限错误观测已随0.87.10上线；截至本轮最终检查，新增诊断记录0。 | 等待真实关联栈，确认根因后最小修复，覆盖有效/缺失/API恢复/导航/UGC/难度/日文路由。没有复现不等于已修复；不以B的私有Source损坏推断公共歌曲SSR原因。 |
| D：资源控制与在线性能 | PASS（准入与受限资源核查）；NOT VERIFIED（在线性能） | Node24.22.1/Undici7.30.1、自启disabled、内存上限/构建互斥/超时及Worker上限保持。最终进程RSS265,120KiB、cgroup221,061,120B、swap0、PSI full avg10=0、当前OOM计数0；是短窗口读数。原生恢复QA峰1,364,357,120B、无OOM。普通日志无request_time，热冷/业务成功率/p50/p95/p99没有本轮合格样本；旧接受风险不重开。 | 按指示等A归因处置后执行既有O1签收；无全站压测、不由构建234秒或少量探针推算在线p95。新构建瞬时内存峰未完整捕获，不冒充在线容量证明。 |
| C：公开开发者接口兼容承诺 | PASS（公开文档及当前DTO核对）；NOT VERIFIED（正式1.1冻结） | PR37的P1通过实际patch版本0.87.10解决。公开Markdown HTTP200、5151B，SHA256为9eb8d4775317cb307d0c42dff97ea9a38e708ecabbf80bd4a7d41cde72a7f36a，与源一致。真实1503曲目录通过现行OpenAPI验证；Schema/SDK/公开DTO实现与0.87.9无差异。meta仍FREEZE_CANDIDATE/contractFrozen=false。 | 本轮明确保持候选，不作正式Contract1.1 Freeze决定；文档公开不等于FROZEN。若RC要求正式冻结，继续按现有release-controlled lifecycle作出发布决定。 |

**RC：BLOCKED，未准备1.0 RC。** A/B实际阻断和必要性能证据尚未关闭，正式1.1冻结也没有签收。工作包独立签收；兼容性patch的标准发布不等于RC就绪。

原始证据：/home/sigaer/taiko/qa-vault/evidence/viewer-rc-blockers-20261025。旧证据、失败尝试、0.87.8/0.87.9回滚及原设计WIP保留。生产验收只做匿名业务读取；公开meta有既有配额记账，不能称为完全没有数据库侧效应。

本轮部署234.07秒成功；此前包装器内存准入拒绝时标准脚本未执行，后续资源自然满足才正常发布，无豁免或脚本修改。两次同一检查点工作中的受控静止窗口分别21.215秒（校验失败）和19.639秒（诊断捕获），服务全部恢复。诊断包明确非有效恢复点；隔离MySQL/HTTP/桥接子进程已退出，明文恢复副本清理，私有加密包、失败证据及旧verified点保留。
