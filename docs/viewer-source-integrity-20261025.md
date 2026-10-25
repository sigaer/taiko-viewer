# B：Source committed 对象完整性调查与修复准备

本报告只解释证据，当前状态见 [唯一 Release Gate 表](viewer-1-release-gates-20261023.md)。案件对外别名为 **B1-CURRENT-01**。Source 身份、revision/commitId、私有路径和正文不进入 Git、PR、站点或公开日志；精确映射、原始 manifest 及结构差异留在现有私有证据区。本文没有生产变更授权效力。

B1单案定位与B2方案准备 **PASS（限定范围）**；具体历史写入入口 **NOT VERIFIED**；Source生产修复及B整体 **BLOCKED**。该状态不将分析完成等同于恢复完成。

## B1：异常类型与范围

以现有 Publication SH 锁只读核对，无 pending；当前 sequence **2**，committed manifest 与保留的原始 commit 记录完全一致，读前后未变化。身份、revision、previousCommitId、引用关系已在私有证据核对，原始记录未修改。

| 对象 | 字节 | SHA-256 | 结论 |
| --- | ---: | --- | --- |
| sequence 2 committed current 引用 | 428002 | `66b61224c72bee75a583d83febfc618319897ac6f088b1457952e795b12544c7` | 权威预期，尚无精确内容副本 |
| 当前对象及 current projection | 428028 | `d186ad57ea8f36b20ac6106d58880b00dba63018384554bdca605fdfbf45feb2` | 均不符 committed 引用 |
| sequence 1 current 对象 | 428001 | `6829b3ee334dd7343909b9e01b064eb6e4618d22acac87f1639b201894410d4e` | 与自己的旧引用一致，不能代替 sequence 2 |

当前对象和 projection 同 device、同 inode、nlink=2，mtime/ctime 均为 UTC 2026-10-17 09:52:49.908。Publication 的 `_install` 正常使用硬链接安装 projection；两者读取的是同一份坏字节，故不是仅独立投影与健康对象不同。具体异常类型为 **committed 引用对应的共享对象内容已不一致**。现有证据不能确定历史写入进程、入口或修改者，也不能排除初始损坏；不据时间关联给 Writer 定责。

该 current revision 的 750 个唯一对象已全部流式校验：**749 正常、1 个 current 不符**，共约 3.59MB 的受限读取。保留的 sequence 1/2 中只有 sequence 2 引用本案坏 current；不将一份 current 的异常扩展为全部 Source、全部历史或平台故障。前一完整代与当前全部代的系统性健康不是本次单案结论。

用户另行明确授权单案正文分析后，在隔离 QA 中只解析上述两个 current：均为合法 JSON，结构各有五个顶层字段；profile、songs、achievement 与前一 revision 相同，差异为新增 `dojo.version` 和 `_meta.synced_at`、`_meta.content_sha256`、`_meta.ts` 三项值变化。此处比较的是两个现存版本，**不是已丢失的 sequence 2 committed 正文**；不能据此反推出其精确字节，也不能以业务主体相同放弃 Publication 校验。内层 `_meta` 的历史算法和版本不替代外层 committed 长度/hash。

只读 SQL 会话实际核对 DATABASE()/transaction_read_only：该案一个当前绑定，来源类型 Wahlap。mtime 前后五分钟内有一条成功 sync 元数据，创建于本地 UTC+8 17:52:26，记录 originalBytes=428001；无匹配 lifecycle 或 admin 元数据。不读取 sync result_json 或身份值。成功日志早于坏文件 mtime，不能证明该次同步实施了后续修改，也不能证明审计覆盖所有历史入口。

## 可信副本与读取路径

已核对的范围：

- 实际同代诊断捕获的全部文件哈希清单：精确副本 0。
- 10 月 17 日 05:03:41 verified 完整点和 03:57 附近另一完整点的原生清单：精确副本 0。没有从跨时间文件拼出同代恢复结论。
- 本案保留的 751 个对象：精确副本 0；本案 `.manual_deleted` 关联归档目录 0。
- 前一个 current 是有效旧对象，但 hash/长度均不同。既有前后缀/空白诊断也未找到精确恢复内容。

这是已授权、已查范围内未找到，不能宣称所有可能外部来源都没有。未调用 Wahlap 或其他外部上游，未读取其他 Source 正文；私有正文授权也不包含外部请求。

隔离复制本案坏对象、manifest 与硬链接 projection，直接调用现行 `createPublicationScoreReader.readCurrent` 及 `captureProjectionIntegrity`，二者均返回 **PublicationUnavailableError / 503**，没有退回 legacy projection。原生产规模隔离恢复中 Publication 内核同样拒绝此对象。fail-closed **PASS（本案路径）**，不能冒充全量恢复 PASS。

证据为 `source-metadata.json`、`source-audit.json`、`source-body-summary.json`、`source-copies-readers.json`；私有子目录保存映射、原始 manifest 与仅含路径/差异类型的结构报告。对应 QA `qa-9c0fc5f289ea`、`qa-f278885beda6`（单案正文）、`qa-1d6f86296a17`（副本与 reader）；原检查点证据不覆盖或删除。

## B2：独立生产变更申请草案（不可执行）

当前选择为 **保持异常拒绝，生产修复 BLOCKED**。调查及方案准备完成，不表示生产修改获批。没有编辑 Source、Writer 状态、committed 历史、verified 指针、备份范围/正文/调度、数据库权限或存储位置。

共同授权边界：只允许本案一个 Source，先重新锁定 identity/revision/sequence 和坏 hash；变化即停止。所有读写须现行 Writer 准入及维护互斥；保存加密原始坏对象、manifest、审计和文件元数据。不得影响其他 749 个健康对象，不改评分、历史事实、Growth/Goal、绑定或授权。任何实际写入均须用户**新的独立明确生产授权**，本轮单案读取授权不包含这些操作。

方案一，今后取得精确副本：先在隔离环境证明可信来源、428002B、完整 SHA-256 及本案引用关系，再申请恢复对象/projection 的一次受控维护窗口。在锁内确认当前状态未变，以临时同文件系统文件、fsync、原子 replace 和受控硬链接安装恢复准确字节，保留 manifest 不变。两条路径的转换须置于拒绝读取的维护窗口，不能声称两次 rename 本身跨路径原子。全部 750 个对象及引用验证通过后才恢复读取。失败时保留拒绝状态，以封存原始物料回退文件状态；不能将坏内容称为有效回滚。此方案目前没有内容物料，**不可执行**。

方案二，从权威来源重建：先单独授权该 Source 的有限 Wahlap 读取，禁止顺带同步/持久化。验证取得内容、身份、时间、版本和范围，在隔离环境生成明确候选及字段差异，再提交具体新 hash/长度/新 revision 的生产变更申请。经批准后走现有 Writer 的显式修复批次，新 revision 记录修复原因及旧引用；不得伪造旧 committed 内容、直接重哈希旧 revision 或重写 manifest。已有失败原始引用永久保留。若 Writer 的历史校验不允许安全建立修复代，则先提交兼容修复设计，不能绕过校验。回退采用补偿 revision 或保持本案不可用，不回退历史权限、不重算事实。当前未获上游读取或生产写入授权，也未证明权威重建能力，**NOT VERIFIED / 不可执行**。

方案三，内容无法证明：保持现有 fail-closed，原始历史和诊断包保留；不截断、拼接 JSON 或把旧版/当前坏字节重新命名为旧 committed 内容。只有具备可信物料和新授权后才转入前两条路径。

## 后续恢复 Gate

本案生产修复获得授权、执行并验收之后，才重新捕获实际同代检查点和完整隔离恢复：35 表、相关文件闭包、全部 committed manifest/引用、身份/Session/Key/Grant、Source、历史、Growth/Goal、配置及 Publication vector 均须同代。检查点已有撤销须保留；检查点后的撤销若无连续 replay 证据，开放前使恢复出的所有凭据/Grant fail-closed，入口和后台 Writer 保持关闭直至重新验证授权。

完整恢复及 RPO≤15min/RTO≤120min 继续 **NOT VERIFIED**。上轮 195.887 秒原生还原和诊断包不能替代本案修复与全流程验收；latest-verified 仍保留 10 月 17 日旧点。本轮没有重新恢复或推进指针。B 整体 **BLOCKED**，与歌曲 SSR 归因独立，不能进入 RC。

0.87.11发布后再次只读核对，本案对象/projection的坏hash与committed manifest均未变，latest-verified未推进。应用SSR修复没有实施本案数据修复，也不为本申请提供生产写入授权。
