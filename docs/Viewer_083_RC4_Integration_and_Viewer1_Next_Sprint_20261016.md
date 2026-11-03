# Viewer 0.83.0-rc.4 — 集成候选、生产准入准备与 Viewer 1.0 下一冲刺工作令

**日期**：2026-10-16（Asia/Shanghai）  
**执行者**：Codex，使用现有服务器本地工作树和受控 QA 包装器  
**授权边界**：本令授权本地源码整理、隔离测试、可复核文档、非生产候选构建；**不授权 push、main 合入、生产配置或数据读取、生产 SQL/DDL、部署、服务重启、线上功能开关修改、对生产执行 HTTP 探测**。如需生产只读观察，请另呈现精确 allowlist 与目的，取得独立明确批准。

## 0. 工作令定位：停止重复冻结评审，转向集成

本阶段并非重新开展 Python ownership、Contract Freeze 或 Annual 性能验收。已获 Owner F1–F5 批准的本地 Contract v1.0 **继续冻结**。本轮同时实施两条互不阻断的工作线：

- **主线 R（P0）**：将冻结的 Viewer/SDK/ResourceGrant 与已接线的 `/my` 组成一个**干净、可重建、可审查的 0.83 集成候选**；补齐未经变更的正式 Nuxt 产物启动测试；准备 Gate P 的执行清单，但不访问生产。
- **并行线 I6（P1）**：在独立本地分支选取**仅一个**下一个产品消费者，建议优先选 authenticated Home 的成绩摘要；实现既有服务/读取契约的有限复用，不新写算法，不妨碍 R 的收口。若此线路扩大边界或影响冻结 Schema，停止扩大而另列后续计划。

**成功定义**：主线产生 `LOCAL_INTEGRATION_READY_FOR_REVIEW`（不是 `DEPLOY_READY`）；I6 独立交付一个受限产品候选或可验证的阻断结论；Gate P 继续 `DEPLOY_PENDING_AUTH`。

## 1. 权威组合与不可改变的语义

| 对象 | 固定身份/事实 |
| --- | --- |
| Viewer 当前 I5 产品候选 | `81829d9d7ddfbbf7d30f0f044e6704e951821a70`，版本 `0.83.0-rc.4` |
| Contract 冻结 | `5c68a13964cc8d8750709002485c11cf1ee239cb`，`CONTRACT_FROZEN_LOCAL` |
| I5 分支 | `prep/viewer1-consumer-readmodel-20261016`，工作树 `/home/sigaer/taiko/.worktrees/viewer1-consumer-readmodel-20261016` |
| I5 release manifest SHA-256 | `7e40b26b5cd6c28e903f21ad2ebf720752b81b019f26edfea22cf68a08beaf04` |
| Contract 冻结输出 manifest SHA-256 | `463a090855f571ed72da184a7d1d4c01691e9f5013cf1c106ce99ec190e34b36` |
| Taiko 已安装依赖基线 | `0.14.2`；源码 `a632913dfbdbec1d465f8eaccc0bb80c35e25745`；wheel SHA-256 `398d23000ebde8a9696b8586fc7fff6cf566e49eb6efe970ceba2e5ecf488c0a` |
| Python 角色 | center/client 各 94 包；Core 0.1.1 / 0.1.2，memory-support 1.1.0，installed Contract 0.1.0（尚不消费新平台 DTO） |
| Contract 正本 | `packages/sakura-taiko-contract/schema/contract-v1.json`；workspace package 0.1.2，Protocol 1.0 |
| `/my` 新路径 | `GET /api/account/my-taiko/overview`；默认 `legacy`；仅 QA 显式选 `read-model` |
| Developer API v1 | 协议已冻结，但**运行开关默认关闭**；不可从本工作令推断线上状态 |

在任何测试开始前，按外部 delivery identity 校对工作树 HEAD、清洁度、release manifest、受影响文件 SHA、已安装 venv 的 `-I` 来源。校验不匹配立即 FAIL 并停下，不自动选择另一目录、源码 `PYTHONPATH` 或重建不明构件来兜底。

不改变：User/Binding/Score/Canonical Fact 语义、按谱面 continuity-v3、历史冻结 measurement、旧报告身份、一个 Publication Writer、source/capturedAt 的可靠性规则、v1/v2 CalculationProfile 的合法差异。`legacyCatalogRevision` 与新 `catalogRevision` 含义不同，不能字符串等价或改名掩盖。

## 2. R0 — 本地集成工作树与差异控制（P0）

1. 从已批准的 I5 完整提交建立**新的**本地集成工作树，不直接在生产目录、主工作树或旧复核分支上覆盖；优先使用既有受保护 `.worktrees` / `qa-vault` 空间。新 branch 名可为 `integration/viewer083-rc4-20261016`，以实际创建为准。
2. 读取本地 Viewer `main`、当前 `origin/main`（仅本地已知 refs；不因此执行远程操作）和目标三仓库依赖清单。记录分叉、冲突文件、需要保留的 0.82 安全与 Writer 修复。不得用旧 ownership 分支整体覆盖新的代码，也不得强推。
3. 以唯一已签 Contract 的 schema/source hash 为守卫，将 `5c68a139` 的冻结记录与 `81829d9d` 的产品修改正确纳入一个候选提交图；禁止额外改变 Schema/Golden、权限边界和 Writer。
4. 审核 `pages/my/index.vue`、`components/my-taiko/Overview.vue`、`server/api/account/my-taiko/overview.get.ts`、`server/services/my-taiko/overview.ts` 等实际路径、feature mode 默认值和失败语义。禁止 `/qa/*` 原型进入产品路由。若文件名与报告不一致，以实际 Git 文件为准并写入差异。
5. 出一份 **source-to-release** 清单：Git 提交、workspace package 与安装态包差异、Schema raw/serialized hash、SDK/OpenAPI、Python executable、wheel RECORD/lock、Node lock、构建输出摘要；不要将未构建的 HEAD 称作已部署 release。

**输出**：`docs/083-integration-diff.md`、`docs/083-integration-manifest.json`。严禁将 qa-vault 下含隐私/内部绝对路径的完整证据直接复制到公开 Taiko 仓库。

## 3. R1 — 原封不动的正式 Nuxt 构建产物启动验证（P0）

当前 I5 的 26 HTTP + 7 浏览器流程是在实际 Nuxt 环境中完成的，但其中测试副本修改过**一个已编译的 Annual 启动插件调用**；另外 5,184 个输出文件匹配。这是已明确记录的隔离测试边界，不能将其改称为“未改动构件完整启动 PASS”。本节只填这一缺口，**不进行 Annual cold30/高尾/性能/海报测试**。

1. 从**干净、不可变的集成提交**在独立构建目录执行一次 Nuxt production build。继续使用 `scripts/memory/run_build.sh` 与 QA 容量准入，保证非生产数据库、用户数据、缓存和网络出口均独立；产物与源码身份存入 `qa-vault`。
2. 使用**未经补丁修改的完整构建产物**启动隔离 Nuxt 服务；独立 `_test` MySQL（真正查 `SELECT DATABASE()` 与 `@@datadir`）、合成账户、隔离 userdata 和已安装 `-I` Python；所有启动副作用须在独占测试环境内。请先检查实际 Nuxt startup plugin 的环境依赖，不能在含生产配置的宿主上下文启动候选。若缺少安全的启动隔离能力，**记录为 `BLOCKED_UNMODIFIED_STARTUP`，不要为了通过测试再次修改编译后的文件**。
3. 若只有过季 Annual 插件造成隔离启动障碍，可另作**最小、可审阅、源代码层的非生产启动隔离**（清楚界定配置/默认状态），不改 Annual 算法、不触发生成、不擅自关闭线上功能；任何改变都要关联独立提交和回归。不能修改已签 Contract 元数据。
4. 在新构件上验证双配置：默认 `legacy` 时 `/my` 仍用旧路径，新的 BFF/Developer v1 默认关闭；QA 专用 `read-model` 时合法 Session 的 `/my` → 新 BFF 返回有界、正确的字段，Developer API 仍 OFF。
5. 只覆盖受影响用例：登录和绑定切换、匿名/未绑定、读中解绑/会话撤销、同一 Publication revision、Catalog 改变时 fail-closed、500/503 清空前一用户载荷、移动 375px / 桌面 1280px；不复跑无变更的 46×2、119 SQL、12 PNG、Annual 性能。
6. 单独核验安全退出、Worker/SQL/Chromium 生命周期、OOM/PSI、退出码真实传递、当前轮 scratch 清理和持久日志 hash。若合成宿主出现已知 131 条工作包外的 TS 诊断，限定受影响文件校验、保留诊断，不宣称全仓类型检查 PASS。

**验收**：`PASS_UNMODIFIED_ISOLATED_STARTUP` 或真实 `BLOCKED_*`；不允许以工具退出码 0 覆盖业务失败。最终新源码若与冻结输入不同，只对受影响部分重新执行必要测试、增量更新 manifest，不重签 F1–F5。

## 4. R2 — Gate P 离线预案：让审批只剩实际观察与发布（P0，并行）

本节只生成**可执行且受约束的预案**，不实际进入生产。

**P1 — 生产运行与入口**：准备精确 allowlist，列出需要观察的 systemd unit、真实 Nuxt 构件/Node/Python 路径、Nginx/反代虚拟主机、ACL/可信 proxy/Origin/Host、direct-peer IP 共享配额问题，以及 JWT/Authorization/Cookie 日志脱敏。只读审计即使获授权也不能等于 ACL/真实授权自动 PASS；具体端口、路径、PID 未确认时留空，不得猜。

**P2 — 授权表迁移与恢复**：新四表 `web_developer_api_clients`、`web_developer_api_resources`、`web_developer_resource_grants`、`web_developer_resource_grant_events` 及 F3 owner-keyset 索引；在独立库生成 schema diff、迁移 dry-run、幂等/索引校验、删除禁用/撤销语义。生产 DDL 只有未来另行批准后才能执行。与现有 session、developer token 撤销、绑定关系、Publication committed vector、history measurement/Goal 配套规划一致检查点、PITR 和异地加密备份；指标沿用 RPO ≤15min、RTO ≤120min，合成恢复不冒充真实规模验证。十二项私有资产的运行依赖/权属与备份目的地由 Owner 后续独立确认，不在本轮触碰资产。

**P3 — 灰度顺序与回滚**：先让含代码的系统**以旧模式、Developer API OFF**运行，并确认无回归；然后在受控名单为 `/my` 开 `read-model`；最后在四授权表、P-ID/P-APP/P-PROXY/P-KEY/P-AUDIT 和恢复安全准备已签收后，再评估是否启用外部 API v1。各步独立 Gate，不自动连锁开启。出现跨用户数据、撤销失效、混代、严重服务影响等立即阻断。`/my` 回滚使用两个 mode 配置回 `legacy`，Developer API 独立 OFF；不得仅靠前端 UI 隐藏实现权限防护，也不能把单独切换前端文件当作完整数据回滚。

**输出**：`docs/083-gate-p-readonly-approval-plan.md`、`docs/083-prod-schema-and-recovery-plan.md`、`docs/083-canary-rollback-runbook.md`。所有包含环境、业务、IP、用户、Key 等敏感信息的输出须私有化，不入公开仓库。

## 5. I6 — 第二个真实消费者（P1，独立分支、不阻断 R）

从现有消费者矩阵确定下一个直接改善用户体验且业务边界最小的目标。**首选 authenticated Home 的成绩摘要**（核对 `components/home/AuthenticatedHome.vue`、`composables/usePersonalHome.ts`、`/api/account/charts/summary` 实际依赖；若源码变化则以现有矩阵为准）；不一次迁移 Home、Score、Growth、Goal、Recommend 全部页面。

- 只复用同一 canonical ScoreReadPort/现有算法计算 Profile、revision/source 诊断；V1 Rating、六维、TopN 与现有 `/api/account/charts/summary` 的含义和输出不得改变。
- Home 自读仍用 Viewer Session，绝不使用外部 ResourceGrant 代替 owner；禁止新 Writer、重复计算公式、新模型评分、跨请求私人缓存或额外强制远程 HTTP hop。
- 在隔离 SQL/HTTP/真正消费者页面中，先实现新旧两路的完整 DTO 等价、明确合法 `CalculationProfile` 差异、同一 binding/source 的 revision 连续性及回滚。把新消费者放在独立默认 OFF mode 下；旧路径保持不变。
- 只有定位到具体性能或一致性收益后才扩大迁移；如果 1 次读取无法满足既有算法需要，报告边界而不是伪造等价或强行让 Home 使用 `null` 的 raw calculationProfile。

**交付**：`I6_LOCAL_CONSUMER_CANDIDATE` 或清楚标记 `I6_DEFERRED_WITH_EVIDENCE`，独立源码提交、测试、回滚、消费者矩阵增量。不得改变本轮 Contract 冻结边界，不把 I6 加入 R 的 Gate。

## 6. 明确不做

- 不再审批/重新冻结已签的 F1–F5，不做 0.82 ownership 全量迁移，不重算 Annual、历史 measurement 或报告。
- 不新增第三方 history/growth/sync/write/credential scope，不将 legacy token 自动升级为 ResourceGrant，不安排未经验证的 legacy sunset。
- 不增加第二个持久 Score Writer，不用直接读 JSON 替代 Source/Publication 授权；不因 `GET` 端口服务可达而绕过权限。
- 不因为旧 PNG Golden 原始文件不可恢复而无限停工；旧 FAIL、历史性能问题和 Owner 的 O1/O2 风险接受继续保留。
- 不运行生产环境，不读取生产 DB 或配置，不推送远端，不合入 main，不部署，不改生产 feature flag；不要用生产页面/浏览器手工完成 QA。
- 不因「工作令签收」推断用户已授权生产只读观察；若需要，必须另问明确授权并说明 allowlist。

## 7. 最终交付与 Gate 状态

仅输出以下 4 个主文件，详细证据由受保护 qa-vault 的索引关联：

1. `docs/083-integration-report.md` — R0/R1 结果、差异归因、用户行为、失败和已知限制。
2. `docs/083-integration-gates.json` — 机器可读状态，字段至少包括 `CONTRACT_FROZEN_LOCAL`、`I5_LOCAL_SCOPED_PASS`、`UNMODIFIED_NUXT_STARTUP`、`LOCAL_INTEGRATION_READY_FOR_REVIEW`、`gateP=DEPLOY_PENDING_AUTH`、`publicApiEnabled=false`、`productionAccess=false`，以及哈希、运行结果、Owner 待签。
3. `docs/083-gate-p-readonly-approval-plan.md` — 生产只读命名范围和验证场景的**待授权计划**，不附任何从生产读取的内容。
4. `docs/083-prod-schema-and-recovery-plan.md`（含 canary/rollback 小节或链接到 runbook）— 最小 DDL/备份/PITR/切换顺序；标记全部未执行。

I6 只向其独立分支提交一个报告与测试索引，不把其范围扩进 R 主交付。保存失败尝试和业务状态，复用有效历史 scoped 证据；持久 SHA、进程清理、占用空间记录按现有 QA 机制执行。

**Gate 判定**：

- `LOCAL_INTEGRATION_READY_FOR_REVIEW`：只有精确组合、干净构建、未经修改的隔离宿主启动、必要安全/数据一致性冒烟均通过后才能设定；不得据此写 `DEPLOY_READY`。
- `DEPLOY_PENDING_AUTH`：保持直到 Owner 单独授权并完成生产实际部署身份/ACL、四授权表 migration、恢复与备份、灰度/回滚审阅；无法完成的项原样记为 `PENDING`，不制造 PASS。
- `CONTRACT_FROZEN_LOCAL`：保持，不通过运行时环境变量修改其含义。后续需修改已冻结对外 Contract，另开版本与独立决策，不偷偷覆盖 Manifest。

**本工作令结束条件**：给 Owner 一次性呈现“可供代码集成审阅的精准组合 + 尚需授权的最短 Gate P 清单”，不再请求无关重复批准。完成后主要团队可以继续 Viewer 1.0 的产品开发；最终上线仍由 Gate P 独立决策。
