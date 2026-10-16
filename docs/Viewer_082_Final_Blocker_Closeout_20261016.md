# Viewer 0.82 最终阻断收尾工作令

> 编制日期：2026-10-16  
> 范围：`Viewer 0.82.1` 隔离候选的**下一轮工作包**；不代表 `0.82 Gate PASS`，不批准 0.83 Contract Freeze。  
> 产品目标：**Viewer 1.0.0 — Sakura Taiko Platform — My Taiko, in one place.**  
> 依据：本轮用户提供的《Viewer 0.82 Runtime Integration — 2026-10-16》全文，以及既有 `Viewer_0822_Runtime_Integration_and_API_Readiness_20261016.md`。以下提交和路径为**报告事实，未登录私有本地工作树复核**。

## 0. 结论与执行策略

当前不是继续做规模性重构的时候。上一轮已经完成了安装态主要调用链、独立 `python-memory-runtime 1.1.0` 支持构件、center/client 94 包环境、各 46 项代表性生命周期、B30/六维/雷达实际图片调用、新增 16 项隔离 SQL，以及既有的身份/Publication 桥接。**不要重复做已通过的基础准备，也不要把这些局部 PASS 误报成整体发布验收。**

从现在起以 **S1 凭据控制面 fail-closed、G1 历史假游玩修复** 为最高优先级（可在隔离工作树并行），随后处理 **R4 四类剩余兼容 worker**，最后完成 **O1 网络/恢复/性能/历史保留联合验收**。在它们通过之前，不合入 `main`、不推送、不开带未知部署触发器的 PR、不部署、不升级 0.83、不访问生产 SQL/私有用户数据或真实凭据。

**版本与组合不得擅自更改：**

| 组件 | 当前报告所述候选 | 禁止混淆 |
|---|---|---|
| Viewer | `feat/viewer-1-readiness-20261015`，基于 `c08ec17`，本轮提交 `def8082`、`7fcaf67`；package 仍 `0.82.1` | 非远端发布、非线上版本；以实际本地 `git rev-parse HEAD` 重新记录 |
| Taiko | `15722e8`，`taiko-bot 0.14.1` 非 editable wheel | 不退回 Sakura `plugins.utils` 或 cwd/PYTHONPATH 源码 fallback |
| Sakura | 活跃 `63be19a` 作为只读源/fixture 对照 | 不把 `38298af` 旧 ownership 分支整仓合入，也不改动原 dirty/P0 树 |
| Shared support | 本轮本地非 editable `python-memory-runtime 1.1.0`，从固定 Git objects 等字节打包 | 新集成 metadata 不等于已发布上游包；务必保存授权、来源及构件 hash |
| Role profile | center Core `0.1.1`；client Core `0.1.2`，两者各 94 distributions | Viewer compute 属于 center；client 误调用触发版本 guard 是**预期拒绝** |

先以本地证据记录三仓库 commit/tree hashes、各 wheel 的 digest、lock manifest、真实模块 `__file__`、Python/Node 解释器路径、已报告的分叉/保留方案；本轮所有后续 QA 须对照这一套组合。

## 1. S1 — 凭据控制面授权：第一优先级 P0

### 1.1 已确认的失败与边界

已通过**离线合成输入与 Writer spies** 复现：当前 Sakura `/api/token` 与 miku `/uploadTaikoLogin` 的匿名请求可到达凭据修改路径。该证据只证明源码控制边界缺陷，不证明生产公网可达、数据已被覆盖或已被利用。先关闭应用层的无身份写入，网络 ACL 作为第二道边界，不能只依靠其隐藏漏洞。

### 1.2 执行要求

1. **调用方盘点优先。** 对两个端点收集路由→handler→写入方法→凭据存储及合法消费者链，确认调用方属于内部管理服务、授权的用户绑定工作流，或应下线的遗留消费者。不得在不理解当前合法上传链路的前提下粗暴删除 miku 集成。
2. **入口默认拒绝。** 在任何修改共享凭据、token 或上游 cookie 之前，必须同时完成请求方身份校验、目标资源 owner/service 权限检查、方法与参数范围校验；无配置、无 token、错误 token、错误 owner、错误 audience/scope、过期/撤销、重放及格式不完整输入须 fail-closed。校验失败不得触发 DB、文件写入、上游刷新或 Writer spy。
3. **JWT 不能只解码。** 如沿用 JWT，需真实验签、检查 `iss`、`aud`、`exp`、`nbf`、`sub` 和账户/目标绑定关系；服务间 token 与用户授权分离。也可以为内部受控写入单独设计短寿命服务凭据，但不得将现有 Developer Token 视为任意用户成绩/凭据的授权。
4. **泄露控制与可维护性。** token/cookie 不进入 URL、日志、异常、测试快照；使用 Git 外隔离配置和测试密钥，凭据权限严格限制；关闭无必要的旧入口。对保留的合法消费者给出迁移兼容方案和原子生效/回滚说明。
5. **双层验收。** 应用层真实 handler + synthetic writer 负测先行；生产入口相关代理配置只读审计，记录监听、路由、auth、upstream 和防缓存实际配置，不对生产用户做攻击性探测，也不能用当前仓库配置推断已部署状态。

### 1.3 必须具备的回归矩阵

| 场景 | 期望 | 最低证据 |
|---|---|---|
| 匿名 / 缺失配置 | 401/403 或明确不可用；Writer 0 次 | 实际 handler、spy、响应无敏感内容 |
| 错误/过期/撤销服务凭据 | 拒绝，Writer 0 次 | 合成凭据测试 |
| 有效调用方但错误用户/账号/`taikoId` | 拒绝，Writer 0 次 | owner/grant/identity mapping |
| 仅解析、未验签的伪造 JWT | 拒绝，Writer 0 次 | 完整验签用例 |
| 正确授权服务请求 | 仅目标凭据一次合法写入 | 对应合法消费者协议集成 |
| 并发、重放、重复请求 | 不发生无权限/越权覆盖；按约定幂等 | 控制面并发回归 |
| 无 middleware、网关遗漏、错误上游返回 | 应用自身仍拒绝、私有响应 `no-store` | 真实 HTTP 边界 |

**S1 完成定义：** 原复现 FAIL 在不弱化原断言的前提下转为 PASS；代码审查证明每条外部入口均验证 caller→resource 绑定；附带消费者兼容和只读 ACL/ingress 证据。只修一条路由不能把 Credential Gate 写为 PASS。

## 2. G1 — Source-switch / reappearance 假游玩：第二优先级 P0

### 2.1 已知失败

当前历史事实推导至少两个案例将“从完整快照被删除的谱面，后来再次出现”计为 `play_delta=1`，而直接切换来源的控制用例正确返回 `0`。这表明**第一次出现（first-seen）与历史再出现（reappearance）区分不足**；当中还涉及 full/delta、来源、同账号及 merged topology 的观测边界。当前成绩是“最佳记录集合”，历史是观测快照，不能由再出现自动证明一次真实游玩。

### 2.2 修复原则

- 保留旧完整事实回放规则和冻结历史测量，不更写 `userdata`、snapshot、既有 DB measurement、已发布年度报告、Goal completion 及分享产物。先定位 `Observation → Canonical Fact → GrowthProjection` 中最窄的责任层，不在多个 UI 页面分别打补丁。
- 在同一可比较的账号/谱面 identity 上保留 `everSeen`/tombstone 或等价的历史观测状态；**full snapshot 的缺席**、delta 未列出、显式删除标记、来源切换和合并拓扑重建语义分别处理。
- 谱面曾经出现、消失又重现，或在可信可比较来源未建立连续基线时重新出现，默认 L0 / unknown，不新增当天 play fact；恢复后的**下一次可比较观测**才依据实际变化与既有政策判断。新谱面确属首次观测的情形，应保留现行且有证据的判定路径，不一刀切抹掉所有 first-seen。
- 事实 `occurredAt`、`observedAt`、`confirmedAt` 不得混淆，不把 `highscore_datetime` 或 `update_datetime` 强行认作精确游玩时间。源/模型修订需要显式标记版本，避免缓存错误复用。

### 2.3 最低 Golden/回归矩阵

| 序列 | 预期 |
|---|---|
| A(full 含谱) → B(full 不含) → B(full 重现) | reappearance 不计游玩；保持来源/删除证据 |
| A(full 含谱) → A(full 删除) → A(full 重现) | 不凭重新出现计游玩 |
| full 含谱 → delta 未列出 → full 含谱 | delta 未出现并不等于删除 |
| full 含谱 → 明确 removed → 之后重现 | 保留 tombstone；首个重现不计游玩 |
| 来源直接切换（原通过对照） | 仍为 0 |
| 真正新谱首次可信观测、连续同源后数值变化 | 既有可核证真实变化不丢失 |
| 同日多 snapshot、重复导入、乱序、u0 merged、手动/修复 | 无重复事实；无低可信动作冒充游玩 |
| 历史重放两次、失败中断后恢复 | fact ID、计数、状态稳定，既有记录不被回写 |

维护“冻结旧实现 FAIL + 新候选针对性 PASS”的差异报告，作为**明确的事实语义纠偏**，而非偷偷修改 oracle 或将旧 FAIL 标成 xfail-as-PASS。请审查是否有其他产品依赖旧 `play_delta` 语义，列出影响面（Recent、Growth、Weekly、Passport、Goal、Annual），并增加回归。

**G1 完成定义：** 已复现的两例假游玩均为 0；旧 direct-switch 用例仍为 0；首次真实新谱与连续可比较变动不回归；冻结测量/报告完全不变；重新执行并记录旧全套 `271/7/1` 对应测试的**当前新组合**结果，不沿用旧报告充数。

## 3. R4 — 四类剩余兼容 worker 的明确所有权与迁移

本轮主要调用链已接入 installed wheel：Publication、compute、Annual generator/ratings/bootstrap、merged-read、Growth fingerprint 和部分图片。但仍有四类**显式兼容边界**：`account-sync`、`source-mutation`、`QQ-migration`、`Hiroba-credential`。

**不是所有脚本都必须无条件搬到统一算法包。** 逐项先确认合法调用方、实际 service 入口、私有 SQL/凭据需求、运行角色（center/client）、已存在 wheel CLI、请求/响应 schema 与失败语义；然后明确判定为：

- `MIGRATE`：保留真实消费者，切到绝对 `TAIKO_PYTHON_EXECUTABLE`、非 editable 已安装 CLI、`-I`，明确数据根和所需环境；无 Sakura 源码 import 或回退。
- `RETAIN-OWNED`：因安全或应用所有权应由宿主服务实现，不是 Taiko 算法职责；有单独构件/部署身份、受控授权、可测试端点契约，并证明 Viewer 不依赖未封闭的源码导入。
- `RETIRE`：已确认没有真实消费者与部署实例；先提供调用日志/服务清单/回滚依据，再经审批退役。

对每类至少形成一条成功 + 错误映射 + 缺包 fail-closed + 错误权限 + 幂等/并发（如有写入）测试，重跑对应 SQL 及业务链路。Viewer center compute 保持 `Core 0.1.1`，client 保持 `0.1.2`；不得为消除版本 guard 让错误角色直接调用。

对剩余图片家族同理：识别真实消费路径和运行角色；已通过的 B30、精度六维、雷达**不代表全部图片或 frozen PNG Golden**。至少补齐首次失败的依赖边界并验证固定图像 Golden（若 UI/字体/图像有意改变，需记录非等价差异）。

**R4 完成定义：** 每个仍使用的消费者有安装构件或被明确拥有的服务契约；不再出现 Viewer 调用的“无声源码回退”；四类角色生命周期与对应安全授权验证通过；任何尚存兼容边界必须公开记录为发布限制，而非藏在 PASS 中。

## 4. O1 — 生产就绪的四类最后证据

### 4.1 运行与 ingress/ACL

读取实际部署 manifest 与代理/service 配置（只读、凭据脱敏），比对仓库配置：`ExecStart`/Node/Python 可执行路径、已装 wheel hash、环境变量来源、systemd cgroup、监听地址、Nginx upstream、允许运行用户和 IPC/socket ACL。**不以仓库模板推定生产行为。** 未经批准不修改生产服务配置。

### 4.2 一致性恢复

在隔离副本与空 SQL 数据库完成联合恢复演练：DB 主体/绑定、current/history 原子发布、不可重算的 Python daily ability archive、Viewer Growth measurement/Goal 状态、历史 Source lineage、依赖构件版本，以及 12 个隔离资源的加密异地备份/审查。至少分别覆盖“写入途中异常”、“提交后投影丢失”、“数据库恢复点与文件恢复点不一致”三个故障场景。先由 owner 给定 RPO/RTO；不能凭有备份脚本推定已达标。

### 4.3 性能

分别对安装态 cold/warm 的 `B30`、Growth Overview/History、Annual、merged-read、授权私有读取进行固定样本负载测量。收集 p50/p95/p99、CPU、RSS/cgroup、I/O、子进程启动次数、缓存命中、回放次数、失败率，并与**同环境、同输入、同并发**旧候选基线对照。`memory.peak` 不可用就报告 `UNAVAILABLE`，不能凭日志时间估算峰值。阈值必须在验收前由 owner 明确。

### 4.4 历史连续性与发布限制

确认 Growth legacy SHA-256 连续性、Source 修复后的事实修订、年度/Rating v2 缓存失效、历史 measurement 的只读不可回写、已发布年度报告和 Goal 等产品字段不会被静默重算。保留所有已观察 FAIL 与 SKIP；若需迁移不可逆行为，另开需批准的变更。

## 5. Developer API：0.82 必须保持的临时政策

开发者申请/审批并不自动授予他人私有成绩读取权限。当前阶段可继续服务经审查的**公共、非敏感**数据（公共曲库/资源/元信息）的开发者需求，但不要把现有 Developer Token（身份与配额）升级为所有人的成绩授权。对私有数据仅允许明确持有的旧 public-score token 所涵盖的**单账户、受限读取兼容边界**或已实现且实测 owner/grant 的路由，不增加匿名或范围不明的通道。

`ResourceGrant` / audience / scopes / owner / revocation / consent 继续以威胁模型和接口草案维护；**0.82 可以修复当前 P0 并设计未来接口，但不宣布 0.83 Contract Freeze 已完成**。历史公开路径需要兼容策略、迁移公告和日落窗口，不能在未盘点消费者时直接删掉全部旧入口。

## 6. 0.82 Gate 签收表

| Gate | 当前判定 | 必须提供的关闭证据 |
|---|---|---|
| Credential boundary | **BLOCKED（离线 FAIL 已复现）** | 两个入口零无授权写入 + 合法消费者兼容 + 实际 ingress/ACL 只读证据 |
| History facts | **BLOCKED（两例 false play 已复现）** | Tombstone/来源比较语义修复，旧 FAIL 不豁免，相关所有产品回归 |
| Runtime ownership/cutover | **PARTIAL** | 94 包角色组合 + 四 worker 归属/迁移 + 所有 active 调用方/图像验证 |
| Single publication | **PARTIAL** | 已安装 bridge 扩展到所有实际 Writer，跨进程故障注入与完整恢复证据 |
| API authorization | **PARTIAL** | 既有 92 SQL、16 merged、7 internal 仅为局部；全活跃路由、无中间件、安全缓存、caller-owner 负测与 ACL |
| Historical/Annual continuity | **PARTIAL** | Source 修复后的 revision/缓存/不可重写回归及新组合全套 |
| Restore/RPO-RTO | **BLOCKED** | 空库+文件+measurement/archive 的一致性隔离恢复，12 资源离站加密备份 |
| Performance/production manifest | **BLOCKED** | 运行路径实际只读审计，容量与 p50/p95/p99，同负载回归，owner 阈值 |
| 0.83 Contract Freeze | **NOT STARTED** | 上述 0.82 Gate 获批后单独启动；不预先冻结 OAuth/ResourceGrant 草案 |

**成功要求：** 零未经授权的 writer 到达，零已知伪游玩；剩余实际消费者均有明确安装/宿主边界；历史与数据无静默修改；生产切换计划可复核且回滚演练可证。`0.82 PASS` 需 owner 显式签字，单项局部测试通过不能自动改变状态。

## 7. 建议本轮提交/证据结构

建议隔离工作树中分成两条可审查独立变更线（不要并发修改同一工作树）：

- **S1 变更**：Sakura/miku 的凭据写入口 fail-closed、consumer migration、合成 auth 负测、只读入口矩阵；主仓及服务原树保持不动。
- **G1 变更**：Viewer Growth 观测事实修复、回放 Golden、产品回归、历史差异声明；不改已有持久测量。
- **R4 变更**：四类 worker 的 source→installed/owned map、角色生命周期、图片矩阵；保留 94 分发包与 lock 的可复现性。
- **O1 证据**：deployment ingress/ACL/restore/performance 文档和 machine-readable Gate 状态，逐项说明 Observed/Inference/Unknown。实际生产配置只读检查须另获权限，不属于自动代码阶段。

文档建议增补至 `docs/platform-architecture-audit/`：`credential-boundary-closeout.md`、`source-reappearance-semantics.md`、`worker-ownership-closeout.json`、`viewer082-gate.json`；证据放 `evidence/`，不提交日志中的 token、cookie、私有 data，临时 `/var/tmp` 也不作为异地备份。

## 8. 直接交给 Codex 的主控指令

> 继续 Viewer 0.82.1 隔离候选的 Gate 收尾，不升级 0.83，不推送、合入、建 PR、部署、重启，也不访问/写入生产 SQL、真实私有凭据、用户数据。先检查当前三个本地 repo 的真实 HEAD/status/branch/tree/运行角色和构件 hash，固定新一轮联合 manifest；此前报告的 `def8082`、`7fcaf67`、`c08ec17`、Taiko `15722e8`、Sakura `63be19a` 只是复核目标，不作为未经核验的最新值。所有任务须通过 `scripts/memory/run_qa.sh` / `run_build.sh` 的受控 QA/构建准入；SQL 仅全新隔离 MySQL datadir，先验证 `@@datadir` 与 `SELECT DATABASE()` 和 mutation opt-in。
>
> 第一工作包 S1：在 Sakura `/api/token`、miku `/uploadTaikoLogin` 真正完成**应用层鉴权且先鉴权后 Writer**，先识别合法消费者/账号归属，默认拒绝匿名、错误、过期、撤销、越权、伪造 JWT。保留失败复现并增补合法请求、并发/重放和无 middleware 负测，敏感日志脱敏。仅在隔离工作树操作，不改变生产入口。
>
> 第二工作包 G1：修复 Growth Source-switch/reappearance 假游玩，两例 `play_delta=1` 应转为 `0`，保留曾出现谱面的 tombstone/everSeen 语义，区分 full 缺席、delta 未出现、removed、source/topology 变化，保留真实新谱和连续观测的合法事实。不要篡改旧 oracle、历史 measurement、Annual/Goal 已发布数据；完成 Recent/Growth/Weekly/Passport/Goal/Annual 回归并记录已知旧 FAIL 与新事实语义的受控差异。
>
> 第三工作包 R4：审计 account-sync、source-mutation、QQ-migration、Hiroba-credential 四类 worker，逐项判断 MIGRATE / RETAIN-OWNED / RETIRE，保证实际使用链路有受控已安装构件或明确授权的宿主服务，不留 Viewer 静默源码回退。使用 94 包 center/client 精确依赖锁验证模块来源、响应协议、权限与失败路径；已通过的三种图片不代替其他图片家族的验证。
>
> 逐阶段记录独立提交、回归命令、结果、差异以及故障证据；不要将不通过项 xfail-as-PASS，也不要把已有 92 SQL、52 Publication、各 46 生命周期直接宣称完整 E2E。最后输出 Gate 矩阵、真实部署/ACL/一致恢复/性能仍未证明的边界，明确下一步需要 owner 的审批/只读配置/异地备份动作。无验证就保持 BLOCKED，工作树保持干净。

## 9. 本轮明确不做的事

不以清理 195 个 Java/Vue 文件或全部 27 个旧测试作为当前 P0 工作目标；不全盘迁入新 DB、不新建微服务、不将开发者 token 当作 User Grant、不改变 v1/v2 Rating 正本、不将 Source switch 脑补为实际游玩、不偷偷改变已保存报告的 revision，不声称本轮 local wheel 是正式发布物。

待上述 P0 均关闭、剩余运行时链路完成可复核签收后，再把 0.83 **Contract Freeze** 独立立项：统一 `User/Binding/ExternalIdentity`、Score/Chart、Growth provenance、publication revision、Developer Client/ResourceGrant/consent、公开 API schema/错误码/分页/版本、用户迁移兼容与测试向量。
