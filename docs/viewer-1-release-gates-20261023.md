# Viewer 1.0 Release Gate 当前差距

更新：2026-10-30，Asia/Shanghai。此文件是唯一现行 1.0 Release Gate 表；[本轮证据](viewer-1-rc-blockers-20261025.md)、[A：SSR 归因](viewer-ssr-attribution-20261025.md)、[B：Source 完整性与修复准备](viewer-source-integrity-20261025.md)、[本轮Source授权申请](viewer-source-repair-requests-20261026.md)、[0.87.11稳定性](viewer-08711-stability-20261026.md)、[持续备份设计](viewer-continuous-backup-plan-20261026.md)、[U1准备及授权核对](viewer-u1-preparation-20261027.md)、[U1已授权后的资源准入](viewer-u1-admission-20261027.md)、[U1实际限定执行](viewer-u1-execution-20261027.md)和[历史收口记录](viewer-1-rc-closeout-20261023.md)解释证据，不另设 Gate。本轮起始main为`763bd3c48fabbb8dce59b629e4350fb682e3ab04`，生产checkout/运行均未变，仍为上轮标准发布的 **0.87.11 / 92e6106ef84753ac3f0830ffccdf9717b1dfd5dd**，buildId **acc7ece2-0652-4e7f-a02b-4759ae2e62f4**，PID4179944，公开More版本一致。后续纯仓库报告提交不作为新运行构件。 以上0.87.11、buildId与PID是该历史轮次的观测快照；10月30日本次W1工作不核对其他并行发布，不将这些旧值追认为当前生产版本证明。

| Gate | 当前分类 | 实际证据及边界 | 剩余最小工作 |
| --- | --- | --- | --- |
| API用户／资源授权与凭据边界 | PASS（既有公开范围） | 保留旧 Developer Token 跨账号当前成绩只读、v1 ResourceGrant、account:read 的既定权限；0.87.8 凭据安全及0.87.9定向SQL/入口证据沿用。本轮不扩权，不执行真实业务写入。 | 仅补实际受影响反例；无新P0时不重建权限工作。 |
| 单一Writer／Publication一致性 | PASS（既有范围） | 原Writer接入与失效拒绝证据沿用；上轮503份manifest实时观察不是检查点；本轮确认一个current共享对象不符committed引用，恢复完整性在B单列BLOCKED，不撤销既有Writer架构验收。 | Source修复须另授权；修复后再验证同代完整引用，不重开B-0或平台迁移。 |
| Contract及跨端语义 | PASS（既有Schema/Golden）；NOT VERIFIED（正式1.1冻结） | 实际公开meta HTTP200、Contract1.1，状态字段实际名为status，值FREEZE_CANDIDATE，contractFrozen=false。schemaRevision与源码一致；DTO、权限及CalculationProfile未改。 | 本轮明确保持候选，不作正式冻结决定；文档公开不改变冻结状态。正式Freeze仍须现有release-controlled lifecycle的明确发布决定及meta/OpenAPI/样例一致。 |
| Growth／Goal／Annual历史事实连续性 | PASS（既有规则及范围） | 冻结趋势、周报可比较性、观察时间、Goal证据和去重沿用既有验证；不重算或改写历史，旧PNG缺口及已接受风险保留。 | 仅在事实投影实现变更时补受影响回归。 |
| B：生产恢复、备份与回滚 | BLOCKED（生产Source／有效恢复点）；PASS（U1输入及候选隔离验证）；W1待独立生产授权 | 既有全量诊断/受限恢复证据和sequence2坏current原始失败均保留，verified仍为10月17日旧点。PR44/45交付流式读取及既有第一页格式兼容；10月30日一次新授权U1实际四路201/201/200/200，627歌曲记录，精确身份与输入hash通过。候选430,712B、a3cbdfc7…cf3b18通过隔离内核读回；仅证明既有第一页读取契约，非原子快照、全集未证明、非旧committed字节。W1专用协调器及最终14项新增路径验证完成，详见[单案执行方案](viewer-w1-coordinator-20261030.md)；本轮生产写入0，Source仍fail-closed。 | 对固定候选、sequence2→3的current单对象事务完成PR审查并取得新的明确W1生产授权；不得将代码/测试通过当作Source恢复。实际获批执行后验证普通reader、projection与全部活动引用，再按既有流程开展健康同代恢复；旧损坏revision仍保留且不可恢复，latest-verified和调度不自动推进。 |
| A：有效歌曲SSR500 | BLOCKED（历史不确定性尚未风险接受）；PASS（已修复真实缺陷及0.87.11限定观测） | 0.87.11发布后28.7186小时真实窗口，当前有效ID歌曲GET965次：200=910、302=55、4xx/5xx=0，581ID/中日路由，覆盖历史47ID中的34个。55次302均符合下架歌曲补list=removed规则，终态未关联；不能将协议层100%写成页面业务完成率100%。6066条journal中歌曲SSR诊断0，上下文及其他新分类均0。此前真实缺陷修复、29项测试和隔离/浏览器回归沿用。 | 历史65次仍不追认为全部同因。现行SLO可独立补证，无需强行重现全部历史错误；用户确认歌曲SSR没有既定p95/p99阈值。计时探针资源准入拒绝，实际请求0；完整业务/延迟签收及历史风险接受暂不批准，由既有发布流程审查。 |
| D：资源控制与在线性能 | PASS（原限制及无Viewer OOM）；NOT VERIFIED（完整在线性能） | 安全运行时、自启disabled、内存/互斥/超时及Worker上限不变。6893次15秒采样：Viewer cgroup峰1,579,560,960B、swap峰2,084,864B、PSI full avg10峰0.44，high/max/OOM增量0；宿主可用内存最低4,964,576KiB、PSI峰5.43。当前RSS377,268KiB；不是亚秒峰值或整机容量签收。普通歌曲日志无request_time，p50/p95/p99无有效本轮时间队列。 | 不借用其他业务的延迟阈值。最多400次/单并发/≤0.5次每秒计时方案在首请求前因内存余量不足被拒绝，保持NOT VERIFIED；未降低门槛。热冷、并发和Worker排队/丢弃仍未验；旧Annual/O1接受风险不重开。 |
| C：公开开发者接口兼容承诺 | PASS（公开文档及当前DTO核对）；NOT VERIFIED（正式1.1冻结） | PR37的P1通过实际patch版本0.87.10解决。公开Markdown HTTP200、5151B，SHA256为9eb8d4775317cb307d0c42dff97ea9a38e708ecabbf80bd4a7d41cde72a7f36a，与源一致。真实1503曲目录通过现行OpenAPI验证；Schema/SDK/公开DTO实现与0.87.9无差异。0.87.11实测文档HTTP200/hash不变、meta仍FREEZE_CANDIDATE/contractFrozen=false；Schema/DTO/权限实现未改。 | 本轮明确保持候选，不作正式Contract1.1 Freeze决定；文档公开不等于FROZEN。若RC要求正式冻结，继续按现有release-controlled lifecycle作出发布决定。 |

**RC：BLOCKED，未准备1.0 RC。** B1定位及B2方案准备完成不代表生产修复获批；实际规模一致恢复须在Source修复获批完成后再执行，verified不推进。 A/B实际阻断和必要性能证据尚未关闭，正式1.1冻结也没有签收。工作包独立签收；兼容性patch的标准发布不等于RC就绪。

原始证据：/home/sigaer/taiko/qa-vault/evidence/viewer-rc-blockers-20261025；本轮增量：同级viewer-source-ssr-investigation-20261025。旧证据、失败尝试、0.87.8/0.87.9/0.87.10回滚及原设计WIP保留。生产验收只做匿名业务读取；公开meta有既有配额记账，不能称为完全没有数据库侧效应。

10月25日0.87.11标准部署215.66秒成功，首次正常准入，无豁免或脚本修改。标准脚本原有的构建完成后残留进程清理分支执行，最终退出0，未作手工替换/重启/推送。0.87.10上轮部署234.07秒及其先前包装器准入拒绝证据仍保留。两次同一检查点工作中的受控静止窗口分别21.215秒（校验失败）和19.639秒（诊断捕获），服务全部恢复。诊断包明确非有效恢复点；隔离MySQL/HTTP/桥接子进程已退出，明文恢复副本清理，私有加密包、失败证据及旧verified点保留。

10月25日发布后及本轮均未重跑恢复、未写生产Source或Writer状态，坏对象/projection/manifest及latest-verified均未变。单案私有正文读取仅在用户明确授权后执行，无上游访问。最终构件保留Node24.22.1/Undici7.30.1、自启disabled、原内存与Worker准入。全部owned隔离服务、浏览器及子进程已退出。

2026-10-26本轮仅生产只读与合成演练，未部署、未升级版本、未访问Wahlap、未改备份/SQL权限/存储；新增证据为qa-vault/evidence/viewer-source-stability-20261026。持续备份设计提出5分钟尝试及严格验证/互斥预算，现有停五服务脚本不可直接定时运行；预算、增量验证和完整RTO仍NOT VERIFIED，需独立生产变更授权。正式Contract1.1 Freeze仍单独决策。

PR #42阶段按用户“未明确授权则停止准备”要求停在准备阶段。新增证据viewer-u1-preparation-20261026；没有读取cookie、发送上游请求、创建响应目录或修改生产Source/Writer/manifest/verified/权限/调度。本轮不延伸W1，不重扫全体对象，不升级或部署。

首次授权后的资源检查阶段：U1已明确授权（不含W1），资源准入失败后立即停止；该阶段没有加载cookie或发出上游请求，也没有自动重试/下调门槛。新证据viewer-u1-admission-20261027；授权未取消，但本轮没有激活可执行计划或继续获取。Source完整性、候选可信度、W1和RC的阻断未关闭。

用户手动复查资源通过后，明确指示继续；U1在2026-10-27 01:03:41北京时间实际发出1次请求，HTTP401后关闭本次尝试，另3请求未发出。新执行记录不覆盖首次资源失败。当前阻断是认证拒绝，不是缺少U1授权或仍未通过资源；未形成候选，W1仍需独立授权，RC未解锁。

2026-10-29代码收口：[U1流式解析交付及专用策略审批建议](viewer-u1-streaming-closeout-20261029.md)随代码集中审查。最终精确回归为34项PASS，最终容量六类合成输入均完成，较旧同TLS实现显著减少占用。此处PASS仅指代码/合成验证，不代表上游获取、严格峰值验收、新预算批准、可信Source候选或W1。新准入公式未启用，生产0.87.11及Source/Writer/manifest/verified/权限/调度未变，RC仍BLOCKED。
