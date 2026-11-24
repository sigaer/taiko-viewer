# Taiko Viewer Batch 2.1 — Wahlap Catalog Authority & System Integration

2026-11-24。候选实施、独立安装测试及完整报告已交付。**Viewer RC2 完整 build 被现有内存准入阻断，尚未满足最终验收。**所有结果以 [独立验收记录](acceptance.json) 为准。没有推送、合并 main、正式 Release、部署、生产库/真实成绩写入、Publication 恢复或 Measurement 回填。

Wahlap 官方 Song API 是唯一国行目录权威。已实际验证 1,323 分类行、1,128 个唯一歌曲 ID；中央已安装 Builder 生成 2,993 首歌曲的 immutable Snapshot，国行鬼/里 1,387 张。五项策略集中生成，Viewer、Core/Application、Center/Client/Bot 和 UGC 的候选读端、缓存、版本报告及子进程传递已接入。

494 个原始引用、187 个文件都有逐项分类和证据。295 个 runtime port 引用、5 个纯展示 DTO 引用已收敛；其他为历史兼容、来源生产、草稿、配置、资源分析或工具，不冒充 494 次独立动态执行。活动 CN 链路无 raw/merged/TJA fallback，仍保留的旧代码边界见迁移矩阵。

| 验收交付 | 文件 |
|---|---|
| 1. Wahlap Song API Source Contract | [实际字段、分页、完整性、速率及语义边界](wahlap-source-contract.md)，[逐字段观察](wahlap-field-contract.json) |
| 2. Catalog Source of Truth Matrix | [按字段权威](source-of-truth.md)，[身份与 namespace 审计](identity-audit.json) |
| 3. Catalog Builder Implementation | [实现架构与源码入口](architecture.md)，[已安装构建结果](catalog-build.json) |
| 4. Immutable Snapshot / Revision Strategy | [版本、SHA、原子切换、LKG、缓存与回滚](architecture.md) |
| 5. Five Eligibility Policy Contracts | [五策略唯一实现与输入输出](policy-contracts.md) |
| 6. Seven Raw/Merged Conflict Records | [七项原值与最终映射](seven-conflicts.json) |
| 7. 494 Consumer Migration Matrix | [系统模块状态](consumer-integration-summary.md)，[187 文件矩阵](consumer-migration-matrix.md)，[494 逐引用 ledger](consumer-migration-494.json)，[额外发现的 6 个路径](additional-consumers.json) |
| 8. Cross-consumer Consistency Tests | [全量 Python/Core/Bot/Node/UGC 比对](consistency-performance.json)，[H3 实际 HTTP scope 测试](../../taiko_viewer/tests/catalogHttpScope.test.ts) |
| 9. Client 27/27 Bridge Results | [兼容性说明](client-compatibility.md)，[原 9 项逐项处理](client-nine-resolution.json)，[最终验收](acceptance.json) |
| 10. Publication Integrity Report | [当前对象、inode、历史、writer 与访问影响](publication-integrity.md) |
| 11. Measurement Integrity Report | [根因与影响](measurement-integrity.md)，[原 11 + 额外 3 逐条矩阵](integrity/measurement-14-events.json) |
| 12. 1387 Chart Feature Coverage | [特征范围及统计](chart-feature-coverage.md)，[逐谱状态/hash/parser/diagnostics](coverage/cn-1387-coverage.json) |
| 13. Updated Golden Corpus | [原 6 个 timeline Golden + 新 feature/time 负控制](coverage/golden-corpus-b21.json) |
| 14. Performance and Rollback Report | [实测与边界](performance-and-rollback.md) |
| Core artifact / dependency provenance | [可追溯 wheel 与依赖组合](artifact-provenance.md)，[SHA/commit/安装摘要](artifact-summary.json)，[Core 源码收敛记录](core-source-reconciliation.json) |
| Roadmap / unresolved gates | [后续与发布门槛](roadmap-and-release-gates.md) |
| Execution / private evidence | [真实执行与 Agent 工具预检](execution-ownership.json)，[持久私有归档](durable-evidence.json) |
| Domain Knowledge Primer | [沿用 Batch 2 的知识基础及证据分级](../domain/taiko/README.md) |

最终组合为 Core **0.1.4rc2**、Application **0.10.0rc2**、Bot **0.27.0rc9**；Viewer **1.20.0-rc.2**。Core 和 Application 双构建字节一致，Bot RC9 双构建字节一致，全部从真正 wheel 装入全新隔离环境。Center/Client/联合 resolver 与 pip check 均通过。126 个 Core 推荐数值 oracle、fixture 字节和 Rating/模型公式源文件未改动。

独立测试：Core 契约 **12/12**；Python 原有回归 **76 passed / 4 原有私有样本 skipped**；Node 原有 **310/310**；桥接 **27/27**；Core 原有+时间/位序保护 **31/31**；Authority **15/15**；新增 Node **11/11**。没有把源码 overlay 或未启动的真实 Bot/生产 HTTP 写成安装验收。

Publication 仍有 1 个当前绑定关联的坏对象，与 projection 共享 inode，历史 writer UNKNOWN；没有修复原对象。14 次 Measurement 均为零样本归档触发的 reader rejection，SQL writer 未进入；精确历史 scoreRevision 均 unknown。观察性 trace 已补，未回填。OFFSET 绝对对齐、动态 LEVELHOLD、部分 Scroll/Balloon 与 pattern 能力继续按特征降级，不阻断整个 Catalog。

Kinoko `2765-01-01` 不产生真实 play/growth 日期；Weekly 跨模型差值继续保留并显示模型变化说明。

候选源码位于 `/var/tmp/taiko-batch21-20261124/{viewer,bot,core}`；实际安装环境 `installed-rc9`；wheel/完整 provenance `release-candidate-rc9`；QA activation `catalog`，均在同一独立批次根目录。代码 commit：Viewer `3567ba77`、Bot `c1ff685e`、Core `e254f3ee`。最终文档提交在同一 Viewer 候选分支，原 Correctness/Batch 2 分支和用户原工作区保留。

最终 [交付联检](delivery-verification.json) 验证所有保留基线、parser 源码 hash、报告链接，以及构建后的前端源码与待构建的 RC2 候选一致；[RC1 完整 build 证据](viewer-build-prior.json)另行保留。国行位序共 1,323 个分类成员记录，其中 1,307 有参考顺序、16 为 pending；成员归属仍只来自同一 Wahlap Snapshot。

当前技术阻断见 [构建准入记录](build-admission.json)：RC1 完整 build 已通过；RC2 原字节修正的 Node 310/310、新增 11/11、实际 HTTP 及远端安装 SHA 联检均通过，完整 RC2 build 尚未进入编译。未降低门槛或改用无隔离构建。
