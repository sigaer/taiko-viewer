# Viewer 0.82.1 最终收口工作令（Annual 退场版）

**日期：**2026-10-16  
**性质：**Codex 执行级工作令 / 范围调整决定  
**状态：**本地候选 `0.82.1`；整体 Gate 仍为 `BLOCKED`，不得凭本文件自动改为 PASS。  
**优先目标：**尽快完成 Taiko Python ownership / installed runtime 迁移，以最小必要证据关闭 0.82，释放 0.83 数据及 Developer API 统一工作。  
**本令替代：**`Viewer_082_Final_Gate_Fast_Unblock_20261016.md` 中的 Annual 冷生成资源归因、cold30、Annual 海报与 O1 Annual 压测前置安排；其他历史事实和原始 FAIL 不删除。

## 0. Owner 范围决议：2026 Annual 不再是 0.82 Blocker

2026 Annual 的真实用户使用窗口已经过去，当前处于准备关闭阶段。**此次版本是架构/运行时迁移，不是 Annual 再上线或容量升级。**

1. 将 Annual cold30、200 snapshots × 500 charts 高尾样本、`MEMORY_PSI_FULL` 根因深挖、排队容量 P95/P99、Annual 海报压力、浏览器演出/年度运营回归等全部移出 `0.82 BLOCKER`，记入 `PARKED_ANNUAL_EOL`。原 `qa-5593936cff4c` 的 `FAIL_RESOURCE`、1 提交/0 完成/29 未执行、host PSI 和 `memory.high` 数据原样保存，禁止篡改为 PASS。
2. **不新增任何 Annual 业务负载**，包括冷生成、为完成 O1 而重新打开队列、强制重算已有年度报告或抽取真实用户历史。既有 Annual 热读 600/600、Worker、旧报告身份与 v4.5.4 新旧隔离证据，仅保留作为已观察的 scoped evidence，不重复执行。
3. 既有已发布报告、分享身份、Frozen measurement、Annual schema/manifest、历史引用不得删除、静默重算或回填；历史接口不得为迁移修改出新权限缺口。除非新改动直接触及历史兼容或出现明确的数据破坏证据，否则不建立新的 Annual 验收任务。
4. **“准备关闭”不等于“授权现在关闭生产”。** 年度入口下线、停止后续生成、分享链接存留期限、历史数据留存与隐私告知另建产品 EOL 任务，由 Owner 另行批准；本令不得修改线上开关、路由、缓存、报告或服务。
5. 与 Annual 无关的 B30、Growth、私有读取、Developer API、Publication 等仍按各自安全/正确性处理；不得借 Annual 退场豁免其他业务风险。

## 1. 当前冻结基线与已接受证据

| 项目 | 当前固定信息 | 本轮处理 |
|---|---|---|
| Viewer | 0.82.1，本地候选 `32729e8`；隔离工作树 `/home/sigaer/taiko/.worktrees/viewer082-recovered-20261016` | 冻结；仅最小 P0 修复可新增提交 |
| Taiko | 0.14.2，源码 `a632913dfbdbec1d465f8eaccc0bb80c35e25745` | 使用固定已安装构件 |
| 当前 wheel | SHA-256 `398d23000ebde8a9696b8586fc7fff6cf566e49eb6efe970ceba2e5ecf488c0a` | 与原丢失 wheel `0963350...` 明确分开 |
| center / client | 独立 94 包；Core 0.1.1 / 0.1.2；`python-memory-runtime 1.1.0` | 依赖锁、`pip check`、`-I` 来源已验证 |
| 运行时正确性 | 各 46 项生命周期；事实 28；凭据 11；Passport DTO 13；Annual 身份 3 | scoped PASS，有哈希证据的不重跑 |
| QA 归档 | `/home/sigaer/taiko/qa-vault`（0700）；65 轮/354 文件登记摘要匹配；占用约 1.24 GiB | 不再以 `/var/tmp` 长期存证 |
| 合成恢复 | SQL/C/H/Goal/measurement、授权连续性及 HTTP 恢复均有 scoped PASS | 不等于生产 PITR / 真实 RPO/RTO |
| 待审草案 | Developer API / ResourceGrant / My Taiko 隔离草案 `78ce858` | 可独立推进设计和非生产开发；暂不宣称 Contract Freeze |

这些结果来自用户提供的阶段报告及原始清单；需要逐项按照 manifest 重验 SHA。**不得将包装器退出码 0、归档哈希 PASS 或历史通过摘要转写成其他业务场景的 PASS。**

## 2. 两级 Gate：结束代码迁移，不混同生产切换

### Gate C — 0.82 代码 / 安装态迁移完成（本轮最短主线）

仅以下事项构成 `CODE_READY` 的强制条件：

- **C1 安装边界稳定：**固定 wheel/94 包锁与 `-I` 运行来源；Viewer Publication、compute、Growth、图片与仍有消费者的兼容 Worker 不从 Sakura 源码/cwd/PYTHONPATH 隐式回退；范围覆盖当前实际路由和 Worker，不再做全仓库历史退休。
- **C2 最小 SQL 缺口：**执行 `minimal-installed-revalidation-20261016.md` 所列 **8 个**定向用例，涉及 `accountSyncCanonicalSql`、`sourceProxySql`、`qqMigrationProxySql`、`hirobaCredentialSql`；真实独立 MySQL、正确安装态模块、失败证据归档。除非 8 项揭示系统性问题，**不重跑原 119 项**。
- **C3 安全与事实不回归：**现有 11 凭据授权、28 Growth facts、13 Passport frozen DTO 及跨谱面修复证据按精确输入/版本审阅；任何新增匿名凭据写入、跨 owner 私有读取、伪游玩、Publication 代际破坏均为阻断。
- **C4 一次完整构建及最小运行冒烟：**针对当前候选执行受控 Nuxt 生产构建和关键路由/安装态 Worker 冒烟（无需 Annual cold、年度页面或年度图片）；冻结构件版本、SQL schema、依赖锁、运行清单、资源边界和回滚点。
- **C5 证据与风险裁决：**对仍缺的 12 PNG 历史冻结素材进行明确、逐项的证据裁决。素材不可恢复时不得伪造像素等价。对于仍在使用的 B30/精度/雷达等图片，须保有当代安装态输出功能正确性、HTTP 安全与确定性检查；历史 Golden 缺失以 `LEGACY_PIXEL_PARITY_NOT_REESTABLISHED` 保留，由 Owner 明示接受或判为阻断。不要为了历史素材再启动全库迁移。

达到 C1–C5 后可以报告 **`CODE_READY_FOR_OWNER_REVIEW`**；只有 Owner 明确批准后才能决定推送/PR/合入。若生产 Gate 未完成，不能声称 `DEPLOY_READY` 或“生产 0.82 PASS”。

### Gate P — 生产切换与数据安全（独立签收，不阻塞非生产 0.83 准备）

以下在**任何生产迁移激活前**仍是硬要求，不能因赶进度、Annual 退场而放松：

- **P1 实际安全边界：**在 Owner 明确授权的只读范围内，核查 Nginx/入口转发、ACL、systemd 的部署 commit、wheel SHA、解释器与运行用户、公开/私有路径映射；匿名用户不能获得私有成绩、上游凭据写入或 bind owner 变更。不得读取业务口令、Cookie 或个人成绩。未授权时记 `PENDING_AUTH`，只准备脚本，不实际探测。
- **P2 备份/恢复/回滚：**保留已验证的合成恢复证据；在实际激活前证明关键 SQL + 成绩 C/H + 历史 measurement/daily + Goal + 授权/撤销状态 + Publication commit 组合的可恢复检查点及演练流程。既定目标 RPO ≤15 分钟、RTO ≤120 分钟。若无法证明 PITR、异地备份或真实规模恢复，不得宣称生产恢复 Gate PASS；可先交付可审阅的执行方案。
- **P3 敏感资源与最小权限：**12 项私有资源如果仍是生产依赖，需明确权属、授权备份目的地及可恢复性，不能私自上传；如果只属于已退役旧宿主的非运行素材，应以依赖清单证明并转交资产治理，不应无理由卡住代码 Gate。受保护本机 vault 不算异地备份。
- **P4 发布控制：**最终受控合入、灰度、回滚及监控单独经 Owner 批准；未核对生产版本/DB 恢复点时不出具可执行的线上 rollback 命令。

**Gate C 与 Gate P 不可合并伪装；`CODE_READY` 可以先于 `DEPLOY_READY`，但未授权不得自动发布。**

## 3. O1 与历史 FAIL 的重新分级

| 证据/异常 | 0.82 定性 | 必要动作 |
|---|---|---|
| Annual cold Resource Stop、cold30 未执行 | `PARKED_ANNUAL_EOL`；非本轮 Blocker | 归档并停止再测，不降安全阈值 |
| Annual 热读与 v4.5.4 兼容 | `HISTORICAL_SCOPED_PASS` | 不重跑、不重建 |
| history c3 历史 474/126 dropped | `HISTORICAL_FAIL_CAUSE_UNRESOLVED` | 原样保留；与新两轮 600/600 的宿主余量不同，不能自动归因为客户端，也不自动单独阻止代码 Gate；Owner 接受残余风险 |
| B30 九次预检 P95 8.014s；merged-history 6.898s | `PERF_P1_NOT_FORMAL_PERCENTILE` | 缺正式分布；不能伪报 PASS。没有服务崩溃、无界增长、严重常规功能退化时移至体验优化/0.95；有明确严重回归则升为 P0 |
| current c1 600/600、Annual warm 600/600、Passport 极端 8.390s | `PASS_SCOPED` | 不重复跑过季 Annual 业务负载 |
| 12 PNG 原冻结素材丢失 | `ORACLE_GAP_OWNER_DECISION` | 当前活跃图像可用性最低验证 + 留下历史缺口，不复制未授权素材 |
| 30 人 Annual、高尾性能、海报峰值、压测阈值 | `PARKED_ANNUAL_EOL` | 不得加入 Gate C / P 的前置 |

“性能不作为本次新加门槛”**不等于**容忍核心请求无限挂起、跨用户数据混淆、资源泄漏影响平台或安全防护缺失。此类严重回归仍然阻断。

## 4. Codex 本轮严格执行顺序

**步骤 1 — 一次只读证据审阅，不重复全量审计。**

- 从持久 `/home/sigaer/taiko/qa-vault` 校验 runtime manifest、wheel/锁、8 项 SQL 计划及现存 Gate 矩阵；仅阅读最新本地工作树及历史报告。
- 建立基线 SHA/分支/工作树干净度记录。发现测试基线变化时先列出差异，不静默合并旧 ownership 分支。
- 将所有 Annual O1、cold30、PSI 深挖任务从本次执行队列和 blocking 表删除，**仅修改当前决策/待办，不删除原始 evidence**。

**步骤 2 — 优先补齐 8 项安装态 SQL。**

- 使用现有 `run_qa.sh` 和独占 QA scratch、`--no-defaults` 全新 MySQL datadir、仅私有 socket/loopback、`_test` DB；实测 `@@datadir`、`SELECT DATABASE()` 与测试写入 opt-in。
- 只启动这 8 项的指定执行器，当前锁定 installed wheel + Node/SQL 真实协议 + 合成业务对象。不要调用生产 API、生产数据库或无授权网关。
- 完成即自动退出 MySQL / worker，持久归档最小原始日志、逐项断言、构件/输入 SHA、运行时与资源事件。

**步骤 3 — 一次构建 + 安全/业务最小 smoke。**

- 在有界 memory wrapper 下完成 Viewer 0.82.1 构建及受控 HTTP/Worker smoke；以非 Annual 的现有活跃请求为对象，覆盖鉴权拒绝、合法 owner 读取、Publication 读取与写后读、Growth facts 和主流 B30 图片。
- 所有已有 PASS 的 46×2、119 SQL、Annual cold/warm 及全量 PNG 不重复。构建如失败，定位最小修复点再定向回归；禁止顺手做产品重设计。
- 对旧 12 PNG 仅形成 `recoverable / unavailable / substitute+owner acceptance` 的决策，保留历史身份差异。

**步骤 4 — 同步准备 Gate P，不擅自执行线上检查。**

- 产出脱敏只读 ingress/ACL/systemd 观察清单、准确观察命令及预期输出字段；等待 Owner 单独授权。
- 产出生产备份/PITR/部署回滚检查表：实际已知/未知、恢复入口、异地归档目的地需要谁授权、敏感凭据如何不入日志；不在没有授权的情况下备份私有资产或导出业务数据。
- Gate P 可在 Gate C 测试期间准备，但本次工作不得执行 live ingress 扫描、生产 SQL、重启、推送、main 合入或部署。

**步骤 5 — 一次裁决汇总，结束 0.82 代码迁移或仅返回最小 Blocker。**

- 交付一个 `082-code-closeout.md`、一个 `082-gate-status.json` 和必要原始证据目录。禁止产生几十份互相冲突的主报告。
- 每个 Gate 明确 `PASS_SCOPED`、`FAIL`、`CODE_READY_FOR_OWNER_REVIEW`、`DEPLOY_PENDING_AUTH`、`PARKED_ANNUAL_EOL`、`OWNER_DECISION_REQUIRED`、`NOT_EXECUTED`；历史失败永不覆盖。
- 如 Gate C 全部满足，报告“**建议 Owner 审核代码合入**”，同时明确 Gate P 未完成。若仍 FAIL，只输出具体可复现失败和下一条修复动作，**不再开启大型架构审计或 Annual 测试**。

## 5. 与 Viewer 1.0 的并行推进

- 0.83：可以继续完善跨语言 Contract、数据/来源/版本定义、ResourceGrant、Developer API v1 设计与隔离开发；`78ce858` 作为草案审查起点。**不因年度窗口结束就修改既有成绩/历史语义。**
- Developer Token 不等于用户授权：私有成绩 API 必须具备 caller identity + owner/consent + scopes/audience + 撤销与有效期；公共曲库可保持明确的匿名读取边界。
- 平台唯一外部接口、Writer/projection、身份映射是 1.0 产品主线，不因这些尚未设计完成就卡住 0.82 **已冻结的兼容性迁移**；但已经暴露的安全越权不可延期上线。
- Annual 正式退场、页面隐藏、报告/分享保留策略另立 `Annual 2026 EOL` 决策项；在单独 Owner 授权前，**不做生产开关修改、不删报告和历史文件**。

## 6. 禁止事项与完成定义

严禁：绕过 PSI/内存/磁盘安全阈值；恢复源码 import fallback；修改 frozen history/Passport DTO 去迎合测试；匿名开放凭据/私有数据；批量触碰生产；为了新 Annual 负载重开已结束活动；擅自删除 QA evidence、未授权私有资源或其他进程的 scratch；把未授权生产审计写成通过；为了“快速”把 `BLOCKED` 改成 `PASS`。

**最终预期交付：**一个可审阅的 0.82 代码迁移候选、最小安装态 SQL/构建/业务证据、原始失败保留的 Gate C/P 双层签收表，以及一份简明的待 Owner 授权清单。**Annual 不在这份清单的阻断关键路径上。**

**请先完成 Gate C，再向 Owner 提交签收申请；Gate P 获授权后单独验收生产切换。**
