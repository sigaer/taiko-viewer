# Viewer 1.0 Release Gate 当前差距

更新：2026-10-25，Asia/Shanghai。此文件是唯一现行 1.0 Release Gate 表；[本轮证据](viewer-1-rc-blockers-20261025.md)、[A：SSR 归因](viewer-ssr-attribution-20261025.md)、[B：Source 完整性与修复准备](viewer-source-integrity-20261025.md)和[历史收口记录](viewer-1-rc-closeout-20261023.md)解释证据，不另设 Gate。本轮起始远程 main 为 `ccc68df31c6971a6f659d59c90efba5174209bad`、运行构件为0.87.10 / d21779a。现已按标准流程发布 **0.87.11 / 92e6106ef84753ac3f0830ffccdf9717b1dfd5dd**，buildId **acc7ece2-0652-4e7f-a02b-4759ae2e62f4**，PID4179944，公开More版本一致。后续纯仓库报告提交不作为新运行构件。

| Gate | 当前分类 | 实际证据及边界 | 剩余最小工作 |
| --- | --- | --- | --- |
| API用户／资源授权与凭据边界 | PASS（既有公开范围） | 保留旧 Developer Token 跨账号当前成绩只读、v1 ResourceGrant、account:read 的既定权限；0.87.8 凭据安全及0.87.9定向SQL/入口证据沿用。本轮不扩权，不执行真实业务写入。 | 仅补实际受影响反例；无新P0时不重建权限工作。 |
| 单一Writer／Publication一致性 | PASS（既有范围） | 原Writer接入与失效拒绝证据沿用；上轮503份manifest实时观察不是检查点；本轮确认一个current共享对象不符committed引用，恢复完整性在B单列BLOCKED，不撤销既有Writer架构验收。 | Source修复须另授权；修复后再验证同代完整引用，不重开B-0或平台迁移。 |
| Contract及跨端语义 | PASS（既有Schema/Golden）；NOT VERIFIED（正式1.1冻结） | 实际公开meta HTTP200、Contract1.1，状态字段实际名为status，值FREEZE_CANDIDATE，contractFrozen=false。schemaRevision与源码一致；DTO、权限及CalculationProfile未改。 | 本轮明确保持候选，不作正式冻结决定；文档公开不改变冻结状态。正式Freeze仍须现有release-controlled lifecycle的明确发布决定及meta/OpenAPI/样例一致。 |
| Growth／Goal／Annual历史事实连续性 | PASS（既有规则及范围） | 冻结趋势、周报可比较性、观察时间、Goal证据和去重沿用既有验证；不重算或改写历史，旧PNG缺口及已接受风险保留。 | 仅在事实投影实现变更时补受影响回归。 |
| B：生产恢复、备份与回滚 | BLOCKED（源完整性／有效恢复点）；PASS（B1单案定位、B2方案准备及既有受限恢复验证） | 上轮同代诊断捕获实际覆盖35表/11,308行、90,092文件/6.955GB及506份Publication vector；原生还原195.887秒，全部SQL值摘要/文件hash一致。发现一份现存current对象及projection不符合committed hash；恢复后也被拒绝。21项健康代表检查及全部恢复凭据/Grant失效、审计保留通过，不能覆盖该失败。verified仍为10月17日旧点，没有推进。 | 本轮单案核对：sequence2的750对象中749健康/1坏，current与projection同inode；两现存current为合法JSON但不能证明丢失的committed内容。751个保留对象、关联归档及旧检查点无精确副本；reader和projection guard隔离实测503。须另授权权威读取及具体生产修复，或取得精确副本后申请原子恢复；目前不执行任何Source/Writer写入，不拼接未知代次。有效RPO≤15min/RTO≤120min仍NOT VERIFIED；调度/权限/位置/PITR均未改。 |
| A：有效歌曲SSR500 | BLOCKED（历史65次未全部归因）；PASS（新增真实缺陷归因、修复及0.87.11发布） | 0.87.10观测得到有效ID100126的两条真实Nuxt上下文栈，与09:00:09Z两次HTTP500关联。useChartUgc在await公共数据后调用私有composable丢失setup上下文；隔离实际产物对历史ID1454复现同栈。修复后原25个成功案例可见内容hash一致，新0.87.11产物28次隔离读取全200，浏览器hydration/难度切换/跨歌曲/日文导航通过；线上四首代表歌曲详情200，100126歌曲API200/合法UGC缺失404。29项定向测试通过。原65次/47ID仍没有逐次错误栈，不能统归此因。 | 最小修复已标准发布并核对编译产物；截至09:56:45Z完整观察仍仅两条发布前记录，新进程短窗口无新增不证明长期无故障。继续保留受限观测及历史证据，不创造线上负载等待复现。历史整体归因仍须相关证据。A与Source问题独立。 |
| D：资源控制与在线性能 | PASS（准入与受限资源核查）；NOT VERIFIED（在线性能） | Node24.22.1/Undici7.30.1、自启disabled、内存上限/构建互斥/超时及Worker上限保持。0.87.11短窗口RSS324,728KiB、cgroup973,787,136B、swap0、PSI full avg10=0、high/max/OOM计数0；不能签收长期容量。构建200ms采样峰4,282,781,696B、high/max/OOM为0。既有原生恢复QA峰1,364,357,120B、无OOM。普通日志无request_time，热冷/业务成功率/p50/p95/p99没有本轮合格样本；旧接受风险不重开。 | 按指示等A归因处置后执行既有O1签收；无全站压测、不由构建215.66秒、28次隔离读取或九次匿名读取推算在线p95。构建峰值不冒充在线容量证明。 |
| C：公开开发者接口兼容承诺 | PASS（公开文档及当前DTO核对）；NOT VERIFIED（正式1.1冻结） | PR37的P1通过实际patch版本0.87.10解决。公开Markdown HTTP200、5151B，SHA256为9eb8d4775317cb307d0c42dff97ea9a38e708ecabbf80bd4a7d41cde72a7f36a，与源一致。真实1503曲目录通过现行OpenAPI验证；Schema/SDK/公开DTO实现与0.87.9无差异。0.87.11实测文档HTTP200/hash不变、meta仍FREEZE_CANDIDATE/contractFrozen=false；Schema/DTO/权限实现未改。 | 本轮明确保持候选，不作正式Contract1.1 Freeze决定；文档公开不等于FROZEN。若RC要求正式冻结，继续按现有release-controlled lifecycle作出发布决定。 |

**RC：BLOCKED，未准备1.0 RC。** B1定位及B2方案准备完成不代表生产修复获批；实际规模一致恢复须在Source修复获批完成后再执行，verified不推进。 A/B实际阻断和必要性能证据尚未关闭，正式1.1冻结也没有签收。工作包独立签收；兼容性patch的标准发布不等于RC就绪。

原始证据：/home/sigaer/taiko/qa-vault/evidence/viewer-rc-blockers-20261025；本轮增量：同级viewer-source-ssr-investigation-20261025。旧证据、失败尝试、0.87.8/0.87.9/0.87.10回滚及原设计WIP保留。生产验收只做匿名业务读取；公开meta有既有配额记账，不能称为完全没有数据库侧效应。

本轮0.87.11标准部署215.66秒成功，首次正常准入，无豁免或脚本修改。标准脚本原有的构建完成后残留进程清理分支执行，最终退出0，未作手工替换/重启/推送。0.87.10上轮部署234.07秒及其先前包装器准入拒绝证据仍保留。两次同一检查点工作中的受控静止窗口分别21.215秒（校验失败）和19.639秒（诊断捕获），服务全部恢复。诊断包明确非有效恢复点；隔离MySQL/HTTP/桥接子进程已退出，明文恢复副本清理，私有加密包、失败证据及旧verified点保留。

本轮未重跑恢复、未写生产Source或Writer状态，坏对象/projection/manifest及latest-verified均未变。单案私有正文读取仅在用户明确授权后执行，无上游访问。最终构件保留Node24.22.1/Undici7.30.1、自启disabled、原内存与Worker准入。全部owned隔离服务、浏览器及子进程已退出。
