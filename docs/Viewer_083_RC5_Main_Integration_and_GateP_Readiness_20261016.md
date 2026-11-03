# Codex 工作令：Viewer 0.83.0-rc.5 主线集成候选与 Gate P 一次性准备

日期：2026-10-16（Asia/Shanghai）  
决策：**本地代码候选按已验证范围接受；不等于允许合入或生产发布。**  
执行范围：隔离 Git/worktree、离线差异审查、必要代码修复、最小定向验证、Gate P 文档及授权包。  
禁止范围：未授权 push、合并 main、读取生产配置/SQL/业务数据、生产 DDL、部署、重启、开启 v1、修改 Annual 入口/负载。

## 0. 唯一基线及已接受事实

- Viewer `0.83.0-rc.5`，本地交付 HEAD `35d473d`（开始时解析并封存完整 SHA）；构建源码 `3fb935a7763f86d7c6c45fc1b5a16846b2fa142a`；测试接线 `d4f997caace3252cf2045c0158593d161f864c2b`。
- 冻结 Contract v1.0：`5c68a13964cc8d8750709002485c11cf1ee239cb`；My Taiko I5：`81829d9d7ddfbbf7d30f0f044e6704e951821a70`。不可静默改变冻结 Schema、版本/来源语义、ResourceGrant 权限或唯一 Publication Writer。
- 当前 manifest SHA-256：`afbafdf26491c14fa1b9b1f4437029dee3da71ccdd5433668631de053cdff09b`；从仓库/持久索引验证归属，避免将文档 HEAD 冒充实际构建提交。
- 现有 `PASS_UNMODIFIED_ISOLATED_STARTUP` 覆盖未经补丁的 5,185 个产物文件、23 条运行观察、13 条浏览器 API 响应、6 个浏览器流程；四授权表合成恢复仅 `PASS_SCOPED`。相关 SHA 和原始失败留存，不再重复已接受的 0.82 / Annual / 119 SQL / 46×2 / PNG 全量验证。
- 默认 `My Taiko = legacy`，`Developer API = OFF`。Gate P=`DEPLOY_PENDING_AUTH`；`DEPLOY_READY=false`。I6=`DEFERRED_WITH_EVIDENCE`，不阻断集成；不得为了填充进度另造 Home 接入点。

## 1. R：立即解决 origin/main 分叉（唯一主要开发任务）

### R1. 更新并界定 Git 差异

在独立、干净的 review worktree 中完成：

1. 固定三仓库本地 HEAD、branch、工作树状态与 SHA。读取 `083-integration-report.md`、`083-integration-diff.md`、`083-integration-manifest.json`、`083-integration-gates.json` 以及保存的 evidence identity。
2. 允许只读 `git ls-remote` / `git fetch` 更新远端跟踪信息（若本地策略允许），**不执行 push 或修改 main**；记录观察时间和 `origin/main` 完整 SHA。如果不能访问远端，则标 `REMOTE_HEAD_UNVERIFIED`，不得把缓存 origin/main 当成实时远端。
3. 使用 `merge-base`、双向提交图、路径级 diff、必要的 `merge-tree` / 定向 `range-diff`，给每一项 origin 独有变更一条裁决：`ALREADY_INCLUDED` / `CHERRY_PICK_SAFE` / `MANUALLY_RECONCILE` / `INTENTIONALLY_NOT_PORTED` / `NEEDS_OWNER_DECISION`。尤其定位旧 Kinoko 准入变更、历史 delta/Writer、认证、Source、UI 与部署脚本。
4. 首选最小代码路径解决真实差异。**禁止机械合并旧 Writer、旧身份绕过、旧历史数据落盘逻辑，禁止为“零冲突”删除新版权限规则。** 若发现实质无法判定的契约或权限冲突，记录精确路径和行为差异并停止该部分，不将其隐藏在“已解决”。

### R2. 仅针对新差异补验证

- 检查 Kinoko **零写入**的调用语义：确实是安全拒绝、跳过还是成功；不得向客户端错误返回“同步成功/成绩已发布”的成功 receipt。用一组指向真实变更边界的隔离测试证明其返回、Publication sequence 与 C/H 未错误推进。
- 对新增或冲突修订的授权/Source/Catalog/历史逻辑，执行最小真实 `_test` SQL + installed `-I` Worker + H3 反例；未受影响模块复用带源码哈希的旧证据。
- 如果实际产品运行源码发生变动：定向 TS/SFC、完整正式 Nuxt build、未经补丁的本地启动冒烟（`/my` legacy、新 read-model 严格隔离、v1 默认 404），及绑定/owner/撤销/Publication 同代要点。若仅文档变动，不重建或重跑。
- `owned-qa` 只能在已有独占 scratch/datadir/cgroup/opt-in 证明下生效；正式构件保持生产默认正常启动。保留失败轮及最终通过轮。

### R3. 本轮唯一代码交付

交付一个独立 `integration/...` **本地待合入候选**，附可复核 Git commit + source-to-release manifest、origin 差异裁决表、代码 review patch、测试证据。状态仅可为：

- `MERGE_CANDIDATE_READY_FOR_OWNER_REVIEW`：所有重要 origin 差异已逐项裁决，没有开放的 P0 代码冲突；或
- `MERGE_CANDIDATE_BLOCKED_SPECIFIC_DIFF`：列出具体冲突及最小决策，不扩大检查范围。

**不执行 push、merge main、tag 或部署。** 若重要更改影响冻结 Contract，先隔离成明确的增量提案，不能静默改 `CONTRACT_FROZEN_LOCAL`。

## 2. P：准备一次性 Gate P 授权包，但不得越权执行

在上述代码审查并行完成以下 **离线准备**，直接复用现有两份计划，不再写第四份宏大架构文档：

- `083-gate-p-readonly-approval-plan.md`：生成**具体、最小、可执行**的只读操作表及输出字段白名单。未知 unit/PID/vhost/Node/Python/SQL 等保持 `UNKNOWN`。可以用获批的仓库静态配置提出**候选**，但不能标为已经观察的生产值；任何范围发现/生产读取均需单独明确授权。
- `083-prod-schema-and-recovery-plan.md`：列出四授权表和 F3 owner-keyset 索引的精确 DDL source/hash、`INFORMATION_SCHEMA` 最小观察要求、差异升级条件、数据库 owner、锁与回退影响。测试 `--apply` 仍只允许新建独占 `_test` 实例。
- 把 P-ID、P-APP、P-PROXY、P-KEY、P-AUDIT、P-MIGRATION、P-RESTORE 整合为**一页明确的授权决定表**：每项 `WHY / EXACT_SCOPE / CAN_RUN_NOW / OWNER_APPROVAL_NEEDED / EVIDENCE / STOP_CONDITION`，将只读观察、SQL 观察、备份恢复、DDL、灰度、v1 启用 **分别授权**，不得合并成一个宽泛“同意上线”。
- 优先注明上线阻断的真实风险：历史绑定验证与资源属主、新旧代理及 Origin 校验、Authorization/Cookie 脱敏、匿名直连 peer 日配额归属、Grant/Key 撤销状态和 Publication 同检查点恢复、不可恢复的 12 项私有资产权属/异地备份。12 项私有资产与 12 项旧 PNG Golden 是不同清单。
- Gate P 恢复目标 RPO≤15 分钟、RTO≤120 分钟只是目标；四表合成恢复不等同生产 PITR/离机备份。未知保持 `UNPROVEN`。不模拟签字，不虚构地址、线上状态或可执行回滚命令。

输出 `gate-p-authorization-ready.md` 及机器可读 `gate-p-authorization-ready.json`。若某项缺少可授权的具体路径/作用域，明确标为 `NEEDS_SCOPED_DISCOVERY_APPROVAL`，在取得许可前不执行任何线上观察。

## 3. 下一消费者 I6：明确维持暂缓

`I6_DEFERRED_WITH_EVIDENCE` 为本轮已接受结论：现有 Home 已由 Growth 读取链服务，建议的 `usePersonalHome` 没有真实调用点，而且 raw/null CalculationProfile 不应覆盖原计算 DTO。**不强制新增第二个消费者**；仅当主线合入与 Gate P 路径清晰后，从真实高价值业务消费者重新排优先级。

## 4. 停止条件及交付格式

必须立即停止并上报的情形：来源/授权/Writer 行为不确定；`origin/main` 与假定不同且影响当前代码；测试触及非 `_test` DB/非独占目录；无法证明 owner/binding/source 保持安全；QA 资源保护触发；任何需生产凭据、真实用户数据或变更的操作。

本轮只交付三项：

1. `083-main-integration-review.md`：origin 每项裁决、精确 Git 身份、必要差异/验证、代码 merge-ready 判定。
2. `gate-p-authorization-ready.md` + `.json`：一页 Owner 可批范围及未知字段，未经批准不执行。
3. 单份最终 Gate JSON + 永久 evidence index：明确 `Contract=FROZEN_LOCAL`、`R=...`、`GateP=DEPLOY_PENDING_AUTH`、`I6=DEFERRED`、所有来源复用/失败边界。

**完成后立即停止本轮。** 不再重复过去的测试，不再扩大到 Annual、0.90 功能开发或全域安全审计；优先让 Owner 一次性看到真实代码合入剩余差异和生产授权前置条件。
