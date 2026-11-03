# Viewer 0.83 rc.6 — 决策清零、主线交付与一次性 Gate P 只读核查工作令

> 执行日期：2026-10-17（Asia/Shanghai）  
> 面向：本地 Codex / 集成负责人  
> 目标：停止循环式 Owner 待签与重复 RC 评审，将已实现的 0.83 收敛为可审查的主线交付包，取得 P-A 旧模式发布所需的最少真实生产证据。  
> **本工作令授权本地代码、文档、离线验证和只读核查方案准备；不因用户一句“继续”自动授权生产访问、Git 推送、主线合入、DDL、部署或功能开关。**

## 0. 一页执行结论：不要再制造阻断

以下内容已闭环，**不得再次作为 `OWNER_*_PENDING`、`BLOCKED` 或新增 RC 的理由**，除非出现相反的新代码/运行证据：

| 决策标识 | 固定结论 | 归档状态 |
|---|---|---|
| `KINOKO-CURRENT-TIME-COMPATIBILITY` | 既存 current 任一无效或未来事件时间，**整批 409**、staging 前退出；不引入旧 per-chart continue、partial-history Writer 或自动修复。诊断 `KINOKO_CURRENT_TIME_CONFLICT`；真实零写入不得生成成功回执。 | `DECIDED_IMPLEMENTED_VERIFIED` |
| `CONTRACT-F1-F5` | 仅有一个 Contract v1.0 Schema 正本，`5c68a139…` 的 `CONTRACT_FROZEN_LOCAL` 有效；ResourceGrant 与两项私有只读 scope 的边界已定。 | `FROZEN_LOCAL` |
| `VIEWER-082-O1-O2` | 历史 PNG Pixel Oracle 缺失、性能历史失败已经按限定范围接受，原 FAIL 保留。 | `CLOSED_ACCEPTED_RISK` |
| `ANNUAL-OFFSEASON` | Annual 已过用户窗口，准备退场；不再跑冷生成、高尾 PSI、年度海报/容量试验。现有报告/入口不能由本令私自删除或关闭。 | `PARKED_EOL` |
| `VIEWER1-I6-HOME` | 现有 Home 已消费 Growth，缺乏新适配收益；不重写 CalculationProfile。 | `DEFERRED_WITH_EVIDENCE` |
| `ORIGIN-NINE-PATH-DISPOSITION` | origin 独有 9 路径已有逐路径裁决；本地合并树保留 rc.6 已验收行为。 | `DECIDED_LOCAL` |

报告中可以继续注明历史差异和剩余风险，但**不能把已裁决兼容性差异重新升级为待签阻断**。只有具体的、此前未覆盖的新 P0 反例才能重开相应决策，须附精确文件/请求/输入/日志 SHA。

## 1. 固定输入与先做的核对（不改主仓库）

- 本地合并交付 HEAD：`6aa5d3a93305e046fcf20d29e7ac8616e3b548e8`。
- 实际合并提交：`6ec45d1f2d2a936b01769fd23ab3904dd9bd0a6d`；源树与 rc.6 候选树相同。
- 正式构建运行源码：`8d915ca2724480c7a287073b742e94a83b44686a`；5185 个原样产物已有证明；如全部非 docs blob 未变，**复用而不重构建**。
- 集成回顾版本：Viewer `0.83.0-rc.6`；唯一 Contract `1.0`；Taiko installed `0.14.2`，center/client 各 94 包，不因包号差异强迫升级尚未消费新 DTO 的角色。
- 最近已实测 `origin/main`：`777546c943b9ca196c365fffa6d1289eb558a2db`（**历史观察值，非当前事实**）。只做必要的 `ls-remote`/fetch 身份确认；若已变化，仅对新增差异作局部审查。
- 三仓库原有 dirty `main`、现有 worktree 和 `qa-vault` 历史证据都不可 stash、reset、清洗或覆盖。

**先核验**：HEAD、父提交、origin 祖先关系、Git status、源码/manifest 的已归档 SHA；若所用源树/新 origin 有实质差异，在新的隔离工作树处理并仅重测受影响路径。无实质差异，不重跑 16 SQL、11 adapter、23 startup、6 browser、119 SQL、46×2 或 Annual。

## 2. 执行包 A：永久关闭 Kinoko 与旧决策项

对现有 `083-main-integration-gates.json`、`083-gate-p-phased-dependencies.json`、`083-local-merge-qa.json` 等交付，制作**单份机器可读决策登记**（建议 `docs/083-decision-register.json`）；其它 JSON 引用此结论即可，避免维护多份冲突的状态。

- 将 `KINOKO-CURRENT-TIME-COMPATIBILITY` 从 `OWNER_RISK_ACCEPTANCE_PENDING` 更改为 `DECIDED_IMPLEMENTED_VERIFIED`，备注：既有明确方案、rc.6 定向测试 16/11 以及本轮用户要求停止重复签收；这是**工程决策关闭**，不虚构新的加密签章或审批时间。
- Kinoko 的 `409`、零 Publication 写入、`422` 全过滤、`409` 重复零写入、部分有效写入 warning 均不得为了减少状态项而改行为。
- 原有 `FAIL`、原 PNG Oracle 缺口、History 性能失败、Annual PSI 事件继续留在历史证据，不可重标成 PASS。
- 调整 Gate 词汇：**`DEPENDENCY_REQUIRED`** 与 **`EVIDENCE_PENDING`** 是两个维度；P-A 的既有数据恢复基础仍 `REQUIRED + PENDING`，而 **Developer v1 四表/F3 DDL 在双模式 legacy + API OFF 时为 `NOT_APPLICABLE`**。
- `P-A.realBlockers=[]` 仅表示「未发现新增 P0 代码冲突」，不表示生产部署前置条件全部通过。

验收：机器矩阵里不再出现旧 Kinoko 决策待签；但不修改运行权限、Contract、Writer、算法或旧历史数据。

## 3. 执行包 B：只生成一次主线交付包，别再增加 rc.7

目标状态 `MAINLINE_HANDOFF_READY_FOR_AUTHORIZED_PUSH`，**不是** `MERGED`、`DEPLOY_READY` 或 `PRODUCTION_ACTIVE`。

1. 将本地真实合并树及 `origin/main` 已观测祖先关系整理为**精确交付提交和最小审查差异**；核对最终 Git tree 和 9 项 origin 裁决，不重写旧服务 unit、旧 fs Writer 或过期 lock。
2. 源码非 docs 与 `8d915ca…` 相等时，关联已经封存的构建、5,185 个构件、测试/证据 SHA；不因添加决策登记和交付说明而重建。若任何运行 blob 确实改变，则仅做定向构建和相关回归。
3. 明确「即将提交的分支」、「合入目标」、「新旧版本/rollback artifact 依赖」、「需外部授权的 Git 操作」。**可以生成本地集成提交、bundle、patch、PR 正文草案；不得未经明确授权 push、创建远端 PR、改写 main、tag 或运行部署脚本。**
4. 保持 `myTaikoPrivate=legacy`、`myTaikoPublic=legacy`、Developer API OFF、Annual 正常启动模式；不得将隔离测试专用 `owned-qa` 配置导入生产。
5. 如果发现新的 origin commit：先判定是否与候选相交；无关变更更新祖先/审查记录即可，相关变更只审相关文件，不从头重启 0.82/0.83 全域验收。

交付最多三个主文件：`083-decision-register.json`、`083-mainline-handoff.md`、`083-mainline-gate.json`；历史 manifest/evidence 用路径及 SHA 引用，不复制大量证据或写长篇新报告。

## 4. 执行包 C：Gate P 只读核查合并成**一次**审批申请

**切勿再提出“每个 PID / 文件 / 字段分别签一次”的流水审批。** 准备一个 `P-A_PRODUCTION_READONLY_AUDIT` 授权范围，一次批准后，执行者可按严格限定的引用关系连续观察，无须每发现一条路径就再次请示；但不能凭此申请本身或本工作令开始生产读取。

### 4.1 一次批准的操作包边界

| 对象 | 单次批准后可检查的内容 | 上限及禁止项 |
|---|---|---|
| Viewer 服务身份 | 从候选 `taiko-viewer.service` 起，`systemctl show` 白名单字段；该 unit 明确引用的 fragment/drop-ins、MainPID 的 exe/cwd/cgroup 与启动身份 | 起始只认**一个具名 unit**；不存在则停，不扫描全部 unit；不读 `environ`、原始密钥、完整 cmdline |
| 发布构件 | 由已确认运行 identity 解析到的 Node/Nuxt 入口、已部署 source/build manifest、预留的上一个可恢复版本 | 只读路径元数据/流式 SHA/受控版本字段；不能读取业务数据，也不替换 release symlink |
| ingress 与凭据暴露 | 经明确批准的 Viewer vhost 及其**明确引用的**少量 include，Host/Origin/路径 ACL、可信代理、日志脱敏字段存在性 | 不运行 `nginx -T` 全量转储；不输出 Cookie/Key/Authorization/JWT 值；需要跨站配置或不确定引用时记 UNKNOWN 并停在该分支 |
| 备份与回滚**元数据** | 已批准的备份作业/清单的最后成功时间、预期覆盖范围、恢复方案存在性、旧构件身份 | 不读取业务备份载荷、SQL 业务行、私有资产内容，不试恢复；无法证实时标 `UNPROVEN` |
| **可选**普通 Schema 指纹 | 仅当本次审批已明确给出库和只读账号时，查询已批准的非业务行 `INFORMATION_SCHEMA` 元数据，校验旧模式依赖的现有表/索引 | 不猜数据库/账号，不查业务行，不执行 DDL；Developer 专属四表结构并非 P-A 的必要前置 |

要求审批包包含执行机器、操作者、有效期、起始具名 unit、可沿引用发现的有限文件/路径种类、字段白名单、私有证据位置和停止条件。**无需预先猜出必须通过首次发现才能知道的 PID/可执行文件路径，但后续必须能从授权入口的引用链直接证明其来源，禁止任意扩展。** 每一分支应有耗时、输出条数/字节上限，失败独立记录，不使其它合法分支自动失效。

### 4.2 权限分界

- 一次只读生产核查批准 ≠ Git push/merge 批准。
- 一次只读生产核查批准 ≠ 生产 SQL 写入/DDL/迁移批准。
- 备份元数据查看 ≠ 读取或复制用户业务数据、十二项未映射私有资源或异地传输批准。
- 观察服务/HTTP 配置 ≠ 可重启、部署或打开 Developer API。
- 未经明确限定的线上探测、真实或合成用户状态变更不得混进只读包。需要另批准的实操集中到**有副作用的发布执行包**，而不是把只读配置观察再拆 11 次。

如果现有操作者有权进行用户明示范围内的生产只读审计，才执行这一个包；**本轮用户的“继续”不提供该项具体授权**。授权仍未获得时，状态应为 `READY_FOR_SINGLE_READONLY_APPROVAL`，但本地交付工作继续完成，不能重新把 Kinoko/Contract/Annual 标记阻断。

## 5. 执行包 D：P-A 旧模式发布的真实剩余 Gate（不涉及 P-B/P-C）

只收集 P-A 的必要证据：

| P-A Gate | 当前可采信证据 | 仍需真实证据 |
|---|---|---|
| 代码与无改动启动 | rc.6 同树、5,185 构件、真实隔离启动及默认 OFF 的 16 项 HTTP | 生产当前版本/运行身份；正常启动与既有业务 schema 兼容 |
| 既有用户数据安全 | 0.82/0.83 已验收的授权/Publication 边界 | 实际 Session/Source 访问链、入口 ACL 与敏感信息脱敏 |
| 基础恢复可用 | 四表合成恢复仅作参考，**不是 P-A 的依赖** | 既有成绩/绑定/历史/测量/Goal 数据的真实备份与恢复基础、不可变旧构件、回退程序 |
| 旧模式发布 | `legacy/legacy`、v1 OFF 已测试 | 发布窗口、操作者、受控部署/回滚授权和发布后最小旧路由冒烟 |

P-A **不要求**：新的四表/F3 生产迁移、第三方 Grant 真正对外开通、其公私配额评估、Annual 性能专项或 I6。P-B 保持 My Taiko 受限灰度独立，P-C 保持 Developer API 生产准入独立；P-B/P-C 不能自动继承 P-A 的开关授权。

关于正常 Annual 插件：仅评估生产 `normal` 启动是否妨碍旧模式服务，不启动新的年度业务/压测，不擅自关闭年度入口。

## 6. 验收与停止点

**本轮允许执行并必须交付：**

- `083-decision-register.json`：已闭环事项全部 `DECIDED/ACCEPTED/FROZEN/DEFERRED`，不得再出现 Kinoko 新 Owner 待签。
- `083-mainline-handoff.md`：精确 Git/source-to-artifact 身份、origin 祖先、已裁决差异、可执行的下一 Git 操作清单与回滚依赖。
- `083-mainline-gate.json`：分别显示 `CODE_HANDOFF_READY`、`PRODUCTION_READONLY_AUDIT_NOT_YET_AUTHORIZED`、`P_A_DEPLOY_PENDING_AUTH`、`P_B_PENDING`、`P_C_PENDING`；历史 PASS/FAIL 不改写。
- `gate-p-readonly-onepass.md`：**仅一份**范围合理、可一次批准执行的生产只读核查单，而不是 11 个独立小审批。

**停止条件：** 发现此前未覆盖的真实高风险权限/数据错误、产生非预期运行源码 diff、origin 实质冲突、资源保护触发；或用户未授予的生产/远端权限即将被使用。此时仅暂停受影响操作，提交一条可复现的新问题，不要重启全项目签收流程。

**明确不执行：** Git push、PR 远端创建、main 合并、tag、生产只读观察（直到单项合并授权明确授予）、生产 SQL、DDL、备份/恢复实操、部署、服务重启、Feature Gate 启用、Annual 新负载。

**希望得到的最终回复不超过一屏：** 已关闭的旧 blocker、主线交付候选 SHA、P-A 缺什么真实证据、一次性只读审批是否待批、任何新 P0（没有就写 NONE）。不要再以反复 Owner 评审替代进度。
