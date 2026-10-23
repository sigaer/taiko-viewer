# Viewer 1.0 Release Gate 当前差距

核对日期：2026-10-23。输入为当前main 0.87.8 / `8edab2be652fc4a940b526b89cfe7c23f94f39b8`、实际生产构件／有效公开开关，以及本次0.87.9工作包的定向回归。最终发布版本／SHA见本工作包外置delivery记录。本表替代旧主控文档的“当前状态”阅读方式，不改写历史PASS／FAIL，也不建立新的审批体系。

| Gate | 当前分类 | 当前证据与准确边界 | 进入RC仍需的最小工作 |
| --- | --- | --- | --- |
| API用户／资源授权与凭据边界 | PASS（已公开范围及本次定向反例） | 0.84.2生产收口明确批准旧Developer Token跨账号**当前成绩只读**；v1仍需ResourceGrant，两者不能混为一种权限。当前生产两个开关仍开，不能沿用“v1 OFF”的旧结论。0.87.8已部署清理客户端原始密码；本次真实SQL验证账号／工单／审批／Grant属主、匿名与撤销Key／旧ETag拒绝。没有新的未签收P0反例，也不声称穷尽所有接口。 | 保持已有权限范围；RC候选只补受改动影响的反例，无需重新签既定公开范围。若出现新P0，单独安全工作包。 |
| 单一Writer／Publication一致性 | PASS（既有范围，源码连续） | 当前Publication／taiko-domain源码与0.84.0 `659a684` 对应目录无差异；当时已安装内核、接收器与Bot保存委托的线上接入及失效拒绝证据仍适用。本次不改Writer或数据库。 | 不重启历史B-0或整套平台迁移；如RC变更Writer，才补受影响的故障／恢复反例。 |
| Contract及跨端语义 | PASS（生成／Golden）；NOT VERIFIED（现行1.1稳定承诺） | 本次正常CI执行唯一Schema绑定检查及跨语言Golden。生产公开meta实际为Contract1.1、`FREEZE_CANDIDATE`、`contractFrozen=false`、完整有界catalog；旧1.0本地冻结不等于当前1.1已经冻结。各端CalculationProfile按既有口径可以不同，不能据UI上线推断所有外部消费者已迁移。 | 以现有版本流程明确1.1候选的稳定边界、已公开DTO变化及实际消费者兼容记录；不要求迁移独立旧应用才能进入RC。 |
| Growth／Goal／Annual历史事实连续性 | PASS（已验证规则与未修改实现） | 冻结趋势、周报可比较性、游玩／观察日期、Goal证据及去重已有相关回归；当前服务端历史／Goal／Annual实现未被本UI工作包修改。0.87.3–0.87.5真实Vue证据不能扩写成所有年度历史数据审计。历史PNG缺口及限定性能失败仍保留既有接受风险。 | 仅在RC改动事实投影时补定向回归；不重算／改写历史，不重启Annual高负载审计。 |
| 生产恢复、备份与回滚 | PASS（已完成隔离恢复／构件回滚）；NOT VERIFIED（持续恢复目标） | P-A曾对真实规模检查点完成24表、53,616文件一致恢复、原生117.325秒及20项功能核对；后续P-B/P-C有Publication／撤销与开关回退证据。它是同盘一次检查点，不证明当前持续RPO、异地恢复或PITR；新增v1授权元数据的一致备份仍需当前证据。0.87.7／0.87.8运行产物完整保留不能替代数据备份。 | 核对**现有**备份任务与最新可恢复检查点是否包含现行授权表、Source／历史／Growth／Goal；补缺项并做一次有界隔离恢复／撤销连续性核验。没有证据前不记PASS。 |
| 运行时隔离、资源控制和性能指标 | PASS（本次实际运行／准入）；NOT VERIFIED（当前性能指标签收范围） | 生产安全Node24.22.1、Undici7.30.1，自启disabled。0.87.8原资源包装器＋标准部署185.16秒，采样峰值4,274,577,408字节，high/max/OOM均0，无豁免。旧限定性能失败已有明确接受记录；构建成功不等于在线p95／容量指标通过。 | 用已有监控／既定阈值补当前候选的有界指标记录；没有新反例不扩大为全站压测或重开已接受历史风险。 |
| 已公开开发者接口兼容承诺 | NOT VERIFIED | 旧全局当前成绩只读、v1 ResourceGrant、0.84.8持续account:read授权及0.85曲库精简都已公开；当前meta仍候选。现有应用文档版本与Contract版本不同，本轮只更新应用版本。没有证据证明现行所有公开DTO的弃用／兼容期已正式落定。 | 在已有开发者文档与发布说明中锁定实际公开路径、认证区别、稳定字段和变更／弃用承诺，绑定现行Schema／SDK／消费者证据；不借UI验收更改跨用户政策。 |

本轮没有自动把任一历史BLOCKED改成PASS：P-A恢复、P-B/P-C启用以及0.84.2扩大已批准只读范围均有后续实际证据，因此不再沿用“未部署／未批准／全部关闭”的旧结论。另一方面，UI已部署不能抹掉持续恢复或公开兼容承诺的证据缺口。

进入1.0 RC的最短路径是：完成A／B各自的精确候选测试、审查与受控发布；收齐上表现行恢复检查点及授权连续性、1.1公开兼容约定、已有性能阈值对应记录；再按现有流程准备RC并做授权范围内的有界核对。若恢复或公开契约的必要证据仍缺失，RC保持未就绪；这不阻止已授权的兼容性0.87.x修复发布。

证据入口：`docs/084-developer-score-access.md`；`docs/083-decision-register.json`的既有接受风险；`/home/sigaer/taiko/qa-vault/evidence/viewer084-user-closeout-20261017/execution-result.md`；`viewer1-pb-pc-rollout-20261017/viewer1-pb-pc-execution-result.md`；`083-pa-core-recovery-release-20261017/verified-recovery-point.json`与原生／业务恢复summary；本次 `viewer-account-safety-20261023/delivery.json`、`viewer-entry-closeout-20261023/gate-current-readonly.json`、SQL及最终CI记录。仅使用无凭据元数据和既有证据，不读取生产业务SQL或备份正文。

73页完整视觉重排、社区整体重设计、独立旧应用、未启用的新My Taiko Overview及新开放API不自动成为1.0阻断项。本表中的NOT VERIFIED是具体证据差距，不是宣布这些能力已经失败；已接受的历史风险不伪装为PASS。
