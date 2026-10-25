# Viewer 1.0 Release Gate 当前差距

更新：2026-10-25，Asia/Shanghai。此文件是唯一现行 1.0 Release Gate 表；[本轮证据](viewer-1-rc-blockers-20261025.md)和[历史收口记录](viewer-1-rc-closeout-20261023.md)解释证据，不另设 Gate。远程 main 为 2d571d0，生产 checkout 为 0b6da1f，实际构件为 efbbdb7 / 0.87.9；合并不能当作发布。受限诊断及文档 patch 0.87.10 已获授权，实际发布待验证。

| Gate | 当前分类 | 实际证据及边界 | 剩余最小工作 |
| --- | --- | --- | --- |
| API用户／资源授权与凭据边界 | PASS（既有公开范围） | 保留旧 Developer Token 跨账号当前成绩只读、v1 ResourceGrant、account:read 的既定权限；0.87.8 凭据安全及0.87.9定向SQL/入口证据沿用。本轮不扩权，不执行真实业务写入。 | 仅补实际受影响反例；无新P0时不重建权限工作。 |
| 单一Writer／Publication一致性 | PASS（既有范围） | 原Writer接入与失效拒绝证据沿用；当前503份committed manifest的实时观察不是恢复检查点。 | 本轮备份纳入当前Publication格式及同代引用对象；不重开B-0或平台迁移。 |
| Contract及跨端语义 | PASS（既有Schema/Golden）；NOT VERIFIED（正式1.1冻结） | 实际公开meta HTTP200、Contract1.1，状态字段实际名为status，值FREEZE_CANDIDATE，contractFrozen=false。schemaRevision与源码一致；DTO、权限及CalculationProfile未改。 | 本轮明确保持候选，不作正式冻结决定；文档公开不改变冻结状态。正式Freeze仍须现有release-controlled lifecycle的明确发布决定及meta/OpenAPI/样例一致。 |
| Growth／Goal／Annual历史事实连续性 | PASS（既有规则及范围） | 冻结趋势、周报可比较性、观察时间、Goal证据和去重沿用既有验证；不重算或改写历史，旧PNG缺口及已接受风险保留。 | 仅在事实投影实现变更时补受影响回归。 |
| B：生产恢复、备份与回滚 | BLOCKED（当前一致集合）；PASS（历史隔离恢复／构件回滚） | 最新verified仍为2026-10-17 05:03:41Z、24表/53,622文件、原生121.165秒，未含现行六张授权/审计表及当前Publication vector。10月25日每日包仍仅曲库/封面/三张管理表。只读核对35张候选表及约6.94GB/89,989文件，尚非可恢复集合。 | 已获一次性检查点和隔离恢复授权；复核35表、同代vector/objects、身份/Key/Grant/Source/历史/Growth/Goal。不能证明检查点后撤销连续性时恢复前全部凭据/Grant fail-closed。实测一次RPO/RTO；不改调度、权限、存储位置或异地/PITR。 |
| A：有效歌曲SSR500 | BLOCKED（历史归因未完成） | 原窗口65次/47个有效歌曲ID成立，旧journal无错误栈。当前有限匿名页面/API及隔离API失败、UGC缺失、延迟/并发未复现。空成功响应及非数组列表触发两个隔离SSR异常，但不是已证明的历史原因。 | 已授权受限错误观测：最多5条/分钟、100条/进程，不采集用户标识或请求正文。取得实际关联栈后最小修复并覆盖有效/缺失/API恢复/导航/UGC/难度/日文路由；不据合成反例关闭历史阻断。 |
| D：资源控制与在线性能 | PASS（既有准入及只读资源核查）；NOT VERIFIED（在线性能） | Node24.22.1/Undici7.30.1、自启disabled、内存上限、构建互斥/超时及Worker准入保持。普通access日志无request_time；少量匿名探针不能推算p95。旧O1/Annual的CLOSED_ACCEPTED_RISK不重开。 | A归因处置后按既有O1记录业务成功率、代表路由p50/p95/p99、热冷读取、RSS/PSI/OOM和Worker准入；缺时延/样本不足仍NOT VERIFIED，无全站压测。 |
| C：公开开发者接口兼容承诺 | PASS（文档审查）；NOT VERIFIED（公开发布／正式冻结） | PR37自动审查P1成立：公开Markdown需要版本区分。发布前URL仍404；正文源SHA256为9eb8d4775317cb307d0c42dff97ea9a38e708ecabbf80bd4a7d41cde72a7f36a。旧Token能力和v1Grant生命周期分开说明。 | 随0.87.10标准patch公开，核对HTTP/hash、实际构件/版本、Schema/DTO及meta；不改历史提交、标题校验或手工替换产物。 |

**RC：BLOCKED，未准备1.0 RC。** A/B实际阻断和必要性能证据尚未关闭。工作包独立签收；兼容性patch的标准发布不等于RC就绪。

原始证据：/home/sigaer/taiko/qa-vault/evidence/viewer-rc-blockers-20261025。旧证据、失败尝试、0.87.8/0.87.9回滚及原设计WIP保留。生产验收只做匿名业务读取；公开meta有既有配额记账，不能称为完全没有数据库侧效应。
