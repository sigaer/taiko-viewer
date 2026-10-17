# Viewer 0.83 rc.6 主线交付

`MAINLINE_HANDOFF_READY_FOR_AUTHORIZED_PUSH` / `CODE_HANDOFF_READY`；生产只读尚未授权，`P_A_DEPLOY_PENDING_AUTH`；新 P0：`NONE`。本轮仅文档/机器矩阵整理，版本仍 `0.83.0-rc.6`。

## 精确身份与最小审查范围

候选分支 `integration/viewer083-rc6-mainline-handoff-20261017`，合入目标 `origin/main`。输入交付 `6aa5d3a93305e046fcf20d29e7ac8616e3b548e8`，真实本地 merge `6ec45d1f2d2a936b01769fd23ab3904dd9bd0a6d`（父为 `70c3d3e1cd6b6964c396ea2fda1fc07e73a49fe1`、`777546c943b9ca196c365fffa6d1289eb558a2db`），构建源 `8d915ca2724480c7a287073b742e94a83b44686a`。最终文档交付 HEAD/tree 和文件hash在本地提交后封存于 `/home/sigaer/taiko/qa-vault/evidence/083-rc6-mainline-handoff-20261017/delivery-identity.json`；它是准确交付身份，不能拿输入 SHA 冒充最终 HEAD。

本次 `origin/main=777546c943b9ca196c365fffa6d1289eb558a2db`，重新 ls-remote/fetch 观察时间 `2026-10-17T02:15:30.529887+00:00`。它仍是候选祖先，无新增远端差异。九路径裁决不重开，未引入旧发布 unit、fs Writer 或过期 lock。所有非 docs blob 与构建源相同；1,487 个工作文件和 release manifest 的52项重新核对，原有 main/输入 worktree 保持原状。当前最小差异只涉及四份新交付文档及原矩阵的状态/引用修正，没有运行源码变化。

构件：复用原 rc.6 的 5,185 文件清单与原样启动证明，不重建、不重复测试。release manifest SHA-256 `c743de0b28123cac01599b9525315c9fc6c4e71b05749de6d0ceb6622a95358b`；构建回执 SHA-256 `0dbbcbcd427e25450a65b54feedd75f7dbb2f4cf88a67b7af48da6cdd7174876`；前次交付身份 SHA-256 `ecced8fced9a2306b5cf8244046401953531cd9db0d110c5152ceb4f34b3bae7`；前次 evidence index SHA-256 `1b5230f49282beeecc56a811f7feb1e53d3f35d21fceaf05f9772a7b65467ed3`。[交付矩阵](083-mainline-gate.json)提供原路径/hash及复用边界。

## 决策关闭

[唯一决策登记](083-decision-register.json)保存 Kinoko 整批409工程定稿、Contract F1–F5、0.82 O1/O2、Annual、I6、九路径裁决的最终结论；不再要求 Kinoko 风险重复签收，不虚构新签章/审批时间。旧 FAIL、PNG Oracle 缺口、history性能、Annual PSI、范围外typecheck失败保持历史身份。74 HTTP 不冒称本轮全量重测；normal Annual 生产兼容性也不能用 owned-qa 启动替代。

## P-A 真正剩余项

| 依赖 | 证据状态／下一动作 |
|---|---|
| 当前部署身份、有效双 legacy/v1 OFF/Annual normal、既有schema/Source生命周期与启动兼容 | `DEPENDENCY_REQUIRED + EVIDENCE_PENDING`；获批后按一次只读包观察能证明的部分，不能证明的继续 UNKNOWN |
| 真实 Session/Source 访问链、入口ACL/代理/Host/Origin和脱敏 | `DEPENDENCY_REQUIRED + EVIDENCE_PENDING`；只读包限配置/字段存在性，无HTTP探测或业务数据 |
| 既有成绩/绑定/历史/测量/Goal 备份与恢复基础 | `DEPENDENCY_REQUIRED + EVIDENCE_PENDING`；metadata新鲜度不等于恢复成功，不读备份载荷或私有资产 |
| 不可变新旧构件及回退程序 | `DEPENDENCY_REQUIRED + EVIDENCE_PENDING`；候选是rc.6，生产当前版本和可恢复旧版本/路径尚 UNKNOWN；不能把历史0.81.12模板当线上事实 |
| 发布窗口、操作者、部署/回滚许可及发布后最小旧路由冒烟 | `DEPENDENCY_REQUIRED + EVIDENCE_PENDING`；集中另批有副作用发布包 |

四表/F3 DDL、外部Grant/配额、Annual性能和I6在此P-A为 `NOT_APPLICABLE`。`realBlockers=[]` 仅说明无新增代码 P0；生产前置并未通过。P-B受控MyTaiko和P-C外部Developer各自待准入，均不锁死P-A也不继承其开关授权。双 mode 默认 legacy、Developer OFF、Annual normal 保持不变，owned-qa 不导入生产。

## 可以执行的后续动作及权限

1. 本地交付已完成；可直接审查本分支 `git diff 6aa5d3a93305e046fcf20d29e7ac8616e3b548e8..HEAD -- docs` 及 sealed identity。未创建远端PR、bundle或新RC。
2. 只需一次批准 [P-A_PRODUCTION_READONLY_AUDIT](gate-p-readonly-onepass.md)，填写机器/操作者/有效期/起始配置与存证位置；批准后同包连续核查有界引用链，无须逐PID/文件签。当前 `READY_FOR_SINGLE_READONLY_APPROVAL`、`CAN_RUN_NOW=false`。
3. Git权限另批：明确批准后核对 HEAD 等于封存的完整 SHA，重新确认 origin，再推送此**具名候选分支**：`git push origin HEAD:refs/heads/integration/viewer083-rc6-mainline-handoff-20261017`。不使用force；远端变动只审增量。此命令本轮未运行。PR远端创建和合入 `main` 仍需明确授权；不得checkout/reset已有dirty main。
4. P-A真实证据、不可变旧构件与回滚缺项补齐后，另批受控发布执行包；发布只用标准部署脚本及资源包装器。本轮不运行脚本、不部署/重启/改开关。只读审核通过不等于 `DEPLOY_READY`。

供后续PR使用的正文草案：rc.6将已验证的运行树与观察到的origin建立真实本地祖先关系；本次仅统一已关闭工程决策及P-A生产只读申请。运行输入未变，复用原构建/隔离测试及全部历史失败。目标main，默认双legacy/v1OFF/Annualnormal。P-A实际运行身份、ACL、恢复/回滚和发布授权待齐备，P-B/P-C独立。
