# Viewer 1.0 Release Gate 当前差距

核对日期：2026-10-23。输入为当前main 0.87.9 / `efbbdb739db1e364d6d7cc1c74a08e59d38c87bb`、实际生产构件／有效公开开关，以及本次0.87.9工作包的定向回归。PR #36 精确候选为 `715fa8b57e61a3dd0429eab803b645c80763a680`，CI #72及独立只读审查通过；外部自动审查持续Running不计通过。实际构件／部署结果见该工作包外置delivery记录。本表替代旧主控文档的“当前状态”阅读方式，不改写历史PASS／FAIL，也不建立新的审批体系。

| Gate | 当前分类 | 当前证据与准确边界 | 进入RC仍需的最小工作 |
| --- | --- | --- | --- |
| API用户／资源授权与凭据边界 | PASS（已公开范围及本次定向反例） | 0.84.2生产收口明确批准旧Developer Token跨账号**当前成绩只读**；v1仍需ResourceGrant，两者不能混为一种权限。当前生产两个开关仍开，不能沿用“v1 OFF”的旧结论。0.87.8已部署清理客户端原始密码；本次真实SQL验证账号／工单／审批／Grant属主、匿名与撤销Key／旧ETag拒绝。没有新的未签收P0反例，也不声称穷尽所有接口。 | 保持已有权限范围；RC候选只补受改动影响的反例，无需重新签既定公开范围。若出现新P0，单独安全工作包。 |
| 单一Writer／Publication一致性 | PASS（既有范围，源码连续） | 当前Publication／taiko-domain源码与0.84.0 `659a684` 对应目录无差异；当时已安装内核、接收器与Bot保存委托的线上接入及失效拒绝证据仍适用。本次不改Writer或数据库。 | 不重启历史B-0或整套平台迁移；如RC变更Writer，才补受影响的故障／恢复反例。 |
| Contract及跨端语义 | PASS（生成／Golden）；PASS（兼容文档审查）；NOT VERIFIED（公开发布）；NOT VERIFIED（正式1.1冻结） | 本次正常CI执行唯一Schema绑定检查及跨语言Golden。生产公开meta实际为Contract1.1、`FREEZE_CANDIDATE`、`contractFrozen=false`、完整有界catalog；旧1.0本地冻结不等于当前1.1已经冻结。各端CalculationProfile按既有口径可以不同。现行Schema、v1 SDK／服务自正式0.85.0至本候选无差异；14个源码消费者、既有公网SDK及隔离HTTP证据有界成立，不声称所有第三方已迁移。[现行兼容承诺](developer-api-compatibility.md)明确严格字段、可选扩展风险及弃用流程。 | PR #37已完成兼容文档审查并合并，但标准部署因HEAD标题未以0.87.9开头而退出，构建／产物未切换，公开URL仍404，不能记作公开承诺已发布；须按既有流程另行完成公开发布。是否正式Freeze仍须现有release-controlled lifecycle的明确决定并同步meta/OpenAPI/样例，不能把本文当作已冻结，不迁移无关旧应用。 |
| Growth／Goal／Annual历史事实连续性 | PASS（已验证规则与未修改实现） | 冻结趋势、周报可比较性、游玩／观察日期、Goal证据及去重已有相关回归；当前服务端历史／Goal／Annual实现未被本UI工作包修改。0.87.3–0.87.5真实Vue证据不能扩写成所有年度历史数据审计。历史PNG缺口及限定性能失败仍保留既有接受风险。 | 仅在RC改动事实投影时补定向回归；不重算／改写历史，不重启Annual高负载审计。 |
| 生产恢复、备份与回滚 | BLOCKED（现行一致恢复集合）；PASS（既有隔离恢复及构件回滚） | P-A曾对真实规模检查点完成24表、53,616文件一致恢复、原生117.325秒及20项功能核对；后续P-B/P-C有Publication／撤销与开关回退证据。它是同盘一次检查点，不证明当前持续RPO、异地恢复或PITR；新增v1授权元数据的一致备份仍需当前证据。最新实际verified指针另为2026-10-17 05:03:41Z、24表／53,622文件、原生121.165秒。现有每日cron在2026-10-23 04:15本地时间成功，但只含曲库／别名／封面与3张管理统计表；不是账号／Source／历史／Growth／Goal备份。既有核心集合明确未包含现已启用的4张v1授权表及2张source service grant／audit表，且检查点记录仍为旧文件格式，无当前Publication vector。0.87.7／0.87.8运行产物不能替代数据备份。本次不创建生产备份或改动旧正文、调度、权限。 | 需另行明确授权并建立包含当前六张授权／审计表、身份／Session／Key／绑定、Source／历史／Growth／Goal及同代Publication的可恢复集合，明确检查点后撤销的replay或恢复前fail-closed政策，再以现有流程隔离验证。当前合成库native round-trip仅证明当前授权结构和撤销拒绝，不证明生产覆盖、RPO/RTO、异地或PITR。 |
| 运行时隔离、资源控制和性能指标 | PASS（资源观测／准入）；NOT VERIFIED（在线性能）；BLOCKED（有效歌曲500待处置） | 生产安全Node24.22.1、Undici7.30.1，自启disabled。0.87.9原资源包装器＋标准部署211.68秒，采样峰值4,283,248,640字节，high/max/OOM均0，无豁免。本次0.87.8启动后1536点观测峰648,863,744B、swap/high/max/OOM均0，15秒采样边界保留。普通日志无request_time，开发者timed仅5样本，不能签当前p95／容量。现有日志65次歌曲详情SSR500对应47个有效目录ID（UTC05:11–05:20），原因未知；它不是已证实的扫描，也未被旧接受风险覆盖。旧限定性能失败继续按原CLOSED_ACCEPTED_RISK保留，构建成功不等于在线性能通过。 | 先定向归因并处置有效歌曲500，再按已有O1阈值补当前候选的业务成功率及有代表性p95/p99记录；日志缺时延不得推测通过。无全站压测，不重开既有接受风险；如需新增生产日志配置须单独授权。 |
| 已公开开发者接口兼容承诺 | PASS（兼容文档审查）；NOT VERIFIED（公开发布／正式冻结决定） | 旧全局当前成绩只读、v1 ResourceGrant、0.84.8持续account:read授权及0.85曲库精简都已公开；当前meta仍候选。现有应用文档版本与Contract版本不同，PR #36已按兼容修复发布0.87.9，本轮文档／验收不再升级应用版本。本次新增公开静态[现行兼容边界与弃用承诺](developer-api-compatibility.md)，不安排sunset、不虚构已通知第三方或固定天数；严格字段、显式变更版本和实际消费者验证流程已完成正常文档审查，但静态公开部署被标准脚本拒绝，尚未对外发布。 | 不改现有权限；正式Contract1.1 Freeze仍需现有发布决定，候选meta继续如实显示false。未知第三方采用不写成已验证；未来影响它们的变更须走已写明的通知／迁移流程。 |

本轮没有自动把任一历史BLOCKED改成PASS：P-A恢复、P-B/P-C启用以及0.84.2扩大已批准只读范围均有后续实际证据，因此不再沿用“未部署／未批准／全部关闭”的旧结论。另一方面，UI已部署不能抹掉持续恢复或公开兼容承诺的证据缺口。

进入1.0 RC的最短路径是：0.87.9精确候选验收、独立审查与受控发布已完成；收齐上表现行恢复检查点及授权连续性、1.1公开兼容约定、已有性能阈值对应记录；再按现有流程准备RC并做授权范围内的有界核对。若恢复或公开契约的必要证据仍缺失，RC保持未就绪；这不阻止已授权的兼容性0.87.x修复发布。

证据入口：`docs/084-developer-score-access.md`；`docs/083-decision-register.json`的既有接受风险；`/home/sigaer/taiko/qa-vault/evidence/viewer084-user-closeout-20261017/execution-result.md`；`viewer1-pb-pc-rollout-20261017/viewer1-pb-pc-execution-result.md`；`083-pa-core-recovery-release-20261017/verified-recovery-point.json`与原生／业务恢复summary；本次 `viewer-account-safety-20261023/delivery.json`、`viewer-entry-closeout-20261023/gate-current-readonly.json`、SQL及最终CI记录。仅使用无凭据元数据和既有证据，不读取生产业务SQL或备份正文。

73页完整视觉重排、社区整体重设计、独立旧应用、未启用的新My Taiko Overview及新开放API不自动成为1.0阻断项。本表中的NOT VERIFIED是具体证据差距，不是宣布这些能力已经失败；已接受的历史风险不伪装为PASS。

## 本轮三项Gate收口记录

详细证据与有界隔离恢复命令见[本轮收口记录](viewer-1-rc-closeout-20261023.md)。原始非敏感元数据、独立审查、Contract字段清单和只读遥测位于 `/home/sigaer/taiko/qa-vault/evidence/viewer-1-rc-closeout-20261023`。本轮不重新审计Writer、Growth或平台迁移，不修改生产数据库、备份正文、公开权限或资源限制，不因文档／验收升级应用版本。

### 公开文档发布的实际状态

PR #37候选 `e050305a61db297f761baffd4924cd197cd145b0` 的CI #75（295回归、Contract／Golden、正常生产构建）及独立审查通过，合并为 `0b6da1f1b8a8fe4710419220abc8ecf87916cb69`。标准run_build调用部署脚本后，脚本在第1步因合并标题未以当前版本0.87.9开头而拒绝，退出码1；按规则已停止，不重试、修改脚本、手动替换输出或重启。生产checkout已到该合并SHA，但实际进程PID、buildId和完整关键产物哈希仍对应已部署PR #36 / `efbbdb7`，两者不混写。公开兼容Markdown仍404。0.87.8归档及.previous、安全运行时、自启disabled均未变化。

因此兼容文档审查PASS，公开发布NOT VERIFIED；不得将Git合并等同于公开生效。该修正文档提交不部署、不升级版本；后续需先满足标准提交标题要求，再按原受控流程发布并核对公开文件哈希。实际停止记录见仓库外 `viewer-1-rc-closeout-20261023/deploy-result.json` 与 `stopped-deployment-readonly.json`。
