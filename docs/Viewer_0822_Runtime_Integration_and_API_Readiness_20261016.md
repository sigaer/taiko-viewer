# Viewer 0.82.2 — Runtime Integration & API Readiness 工作令

> 日期：2026-10-16（依据 2026-10-15 readiness 主记录与 2026-10-16 两次续行）  
> 定位：**0.82.1 隔离候选之后的下一轮实施 / 非生产放行证明**  
> 最终产品方向：**Viewer 1.0.0 · Sakura Taiko Platform · My Taiko, in one place.**  
> 当前阶段：`0.82 Architecture Audit / Runtime Closeout`，**尚未进入 `0.83 Contract Freeze`**。

## 0. 执行决议

1. **认领已解决的阻断，不重复施工。** 2026-10-16 已建立自动隔离 MySQL 8.0.24（`--no-defaults`、全新 datadir、私有 socket、代理仅供测试、实际 `@@datadir` + `SELECT DATABASE()` + mutation opt-in）并通过 61 + 31 = **92** 项相关 SQL/HTTP 测试。center/client 两个全新、非 editable、各 93 distributions 的环境都通过完整安装、`pip check`、`-I` bridge；依赖下载问题已经解决。installed Publication 的 **52** 项合成验证亦已通过。
2. **0.82 剩余核心任务集中在“组合落地 + 全生命周期证据”。** 固定三仓库各自实际 HEAD、包/依赖/协议身份，消化跨分支变化，再完成 Viewer compute / Annual / merged-read 的 installed-wheel 执行路径，以及 center/client 真实业务生命周期、Growth/历史连续性、各 Writer 组合和恢复验收。
3. **安全与 API 并行但分层。** 当前本地 Viewer main 已报告有 owner/service grant、锁内和返回前复核、current/history batch publication；**以前基于旧 `777546c` 的源码漏洞描述不能直接证明新本地代码仍有相同缺陷**。但其他 API、生产 ingress/ACL、第三方 `ResourceGrant`/audience/consent、凭据控制面和跨 Writer 仍无完整关闭证据，维持相应 Gate 为 BLOCKED。
4. **不做提前升级。** `0.82.1` 只是隔离候选，`0.82.2` 仅为建议下一个工作包名称，不得提前写入 `package.json` 或宣布上线；0.83 只在 0.82 规定 Gate 关闭之后启动。
5. **禁做生产操作。** 禁止部署、重启、访问生产私有凭据和用户记录、生产 SQL 写入、合入/推送 `main`、覆盖 dirty/P0 worktree、删除真实文件、重写已有年度报告/历史 measurement，未经审查不得创建触发自动部署的 PR；所有测试继续经 `scripts/memory/run_qa.sh` / `run_build.sh` 入场。

## 1. 正确的版本/证据基线

以下“本地 HEAD”仅来自用户提供的验收记录；本文件作者无权登录用户服务器，不能据此断言其后没有新增提交。

| 角色 | 证据中基线/候选 | 当前用法 | 不得误用 |
|---|---|---|---|
| Viewer local active main | `56aa05a`（报告时点） | 新安全、Grant 与 Writer 实现的整合底座 | 不能由旧远端 `777546c` 直接覆盖 |
| Viewer readiness | `feat/viewer-1-readiness-20261015`，提交 `03aeb43` → `22f7b0b` | `0.82.1` 隔离候选；installed Publication bridge | 不代表生产已部署，不自动包含旧 ownership 迁移全部改动 |
| Viewer old ownership candidate | `6331aea`（基于 `777546c`） | 只作为 worker 调用迁移的差异/测试参考 | 已报告同新 Viewer 分叉 `39/2`；禁止盲目整仓 cherry-pick |
| Taiko wheel candidate | `15722e8`，`taiko-bot 0.14.1` | center/client non-editable wheel 与算法接口候选 | 尚非已发布生产运行版本 |
| Sakura old ownership candidate | `38298af`（基于 `86b8334`） | 旧 Python runtime 清退依据 | 与活跃 Sakura 已报告分叉 `3/29`，不可整仓覆盖 |
| Sakura synthetic proxy fixture | `63be19a` | SQL/HTTP 测试 Python 程序源 | 不是 final installed worker / 实际 Sakura 服务切换 |
| Contract | Python `sakura-taiko-contract 0.1.0`，JS read adapter `0.1.1` | 保留既有语义与 Golden | 不是完整 API Grant/Consent Freeze |
| Core role difference | center `sakura-taiko-core 0.1.1`；client `0.1.2` | 必须分别证明两种角色行为 | 不能将两者指纹或环境混为一组 |

**可复核的远端边界：** 截至本次远端读取，GitHub `sigaer/taiko-viewer` 的 `main` 仍为 `777546c`，本地三个 Viewer readiness SHA (`56aa05a`、`03aeb43`、`22f7b0b`) 未在远端检索到；旧 ownership 候选分支存在。任何需要检验当前本地新代码的任务，**以实际本地 worktree 内容为准**，不能以远端旧分支静态搜索取代。

### 1.1 本轮严禁误报的 PASS

- SQL：两轮独立全新 datadir **92 PASS**，但只包括 `sourceAccessSql.test.mjs`、`privateSourceConditionalSql.test.mjs`、`sourceProxySql.test.mjs`。基础四表静态提取生产 DDL，其余是现有 fixture；**不是全量 production migration E2E**。
- Fresh role：两个 venv 的完整依赖安装 + `pip check` + `-I` bridge PASS；这不证明 center/client 的所有业务命令与生命周期 PASS。
- Publication：installed 0.14.1 的 52 项合成测试 PASS；这不证明所有当前 Writer 已激活同一锁/commit 协议，亦不证明线上读者保持跨文件快照一致。
- 私有缓存：`private, no-store` 与 304 授权后响应的局部测试 PASS；不能替代 ACL、用户 Grant、代理所有路由的认证检验。
- 历史：旧离线全套 `271 PASS / 7 SKIP / 1 FAIL`（Source-switch）继续记录；**不算新集成组合的 PASS**。
- 三仓库 `main`、部署配置、公开/私有 ACL 尚未联合签收。

## 2. 工作包 R1 — 三仓库真实组合冻结（必须先完成）

在**只读检查和独立 worktree**中采集：

- 每个 repo `git status --porcelain=v1`、`git rev-parse HEAD`、`git branch --show-current`、`git merge-base`、候选提交关系；记录 dirty 文件而不清理、覆盖、stash 或 reset。
- 逐文件比较旧 ownership 候选与新 active base：**仅迁入尚未实现且必要的调用/测试/证明**，保留 active main 的安全与 Writer 修复。优先 conflict-focused port，而非 merge/cherry-pick 整仓。
- center/client 已安装发行包名、版本、wheel SHA-256、精确依赖锁定、`sys.executable`、`package.__file__`、`pip check`、`python -I` 实际 import 来源。
- `TAIKO_PYTHON_EXECUTABLE` 的**作用域矩阵**：Viewer Web、账户 compute、Growth、Annual generator、Annual renderer（Node 单列）、merged-read、sync dispatcher、center、client。记录每处环境变量来源/回退规则和实际解释器；不要求 center 与 client 必须同一个 venv，但每个进程必须使用该角色指定且已验证的解释器。
- 将全新 venv 的临时绝对路径替换成可在 release manifest 中重建/检查的环境身份；`/var/tmp/.../center/bin/python` 只能作为本次 QA 的测试路径，不是可靠的生产路径。
- 生成 `runtime-release-manifest.json` 增量版，包含 `viewerCommit`、`taikoCommit`、`sakuraCommit`、`wheelDigest`、`dependenciesDigest`、`contractDigest`、`coreRoleVersion`、`catalogRevision`、`workerProtocol`、`rollbackTarget`、`verifiedAt`、`evidencePaths`，不得包含任何凭据、账号成绩内容或内部可见私有数据。

**R1 判据**：能够在一个全新、非 editable 环境仅按 manifest 复建角色依赖，不借助 cwd、`PYTHONPATH` 或旧仓库源文件完成 import；commit/版本/角色无歧义；任何分叉文件都在 conflict ledger 中有取舍与原因。

## 3. 工作包 R2 — Viewer 所有 Python 执行路径统一

必须审核当前**本地 active 源码**实际调用，不能只根据旧候选推断。建议按下列矩阵逐条迁移，并最小化改动。

| 消费者 | 候选中已知入口/协议 | 最终要求 |
|---|---|---|
| Publication bridge | `python -I -m taiko_store.bridge` | 已有 installed 52 PASS；保留，禁止源码 fallback |
| Annual generator | `python -I -m taiko_bot.offline.annual_summary` | Web → admission → systemd cgroup → worker `sys.executable` → wheel，全链路成功、失败与清理 |
| Rating distribution | `taiko_bot.offline.annual_summary ratings` | catalog/current 内容 revision 正确；定时/并发下无过度重算 |
| Annual worker bootstrap | `scripts/annual_python_worker.py` | 启动与 `execvpe(sys.executable, ...)` 一致、超时/杀进程组/cgroup 残留为 0 |
| B30/六维/推荐/图片 compute | `taiko_bot.offline.viewer`、其他已安装 CLI / adapter | JSON/PNG Golden、权限与资源路径；不允许从 Sakura 旧 `plugins.utils` 回退 |
| Growth 模型 revision | `taiko_bot.offline.fingerprint --growth-root` | 原算法、曲库输入与过去 measurement identity 保持既定连续性；非等价 wheel 切到 v2 |
| merged current/history read | `taiko_bot.cli.merged_read_cli` | 完整协议、source vector、lease/close、duplicate-source 与错误分类 PASS |
| center & client | 角色各自 `0.14.1` + Core `0.1.1/0.1.2` | 分别跑真实代表性命令和账户/同步/渲染生命周期，不以 import test 代替 |

每个消费者必须出具：**入口定位、解释器身份、实际 wheel 版本、合成输入、标准输出/图片哈希、失败/退出码、时间/内存限制、旧路径禁用证据**。不要仅查找 `python3` 字符串；搜索 `spawn`、`execFile`、Python module invocation、systemd service、环境配置及默认解释器。

**R2 判据**：所有预期在 0.82 切换的消费路径都通过 installed-wheel 端到端（含 timeout、不存在模块、路径污染、取消任务、worker 未正常退出等负面测试）；绝对路径解释器检查贯穿全过程。若某功能尚不能迁，列出真实 consumer 与隔离的兼容边界，不能伪装已无依赖。

## 4. 工作包 R3 — Storage / Writer 跨进程联合验收

不要重写 `taiko_store.PublicationStore`，优先复用已有 commit/reader/lock/recovery 机制。对所有真实 Writer 做新矩阵：

- Wahlap、Hiroba、Sakura sync dispatcher、Viewer manual/edit、Kinoko import、Source switch、merged/u0 派生。
- 区分**当前主 Writer**、派生 Writer、同步观察及用户授权操作；同一 `(taikoId, source)` 不代表相同“真实游玩”语义。
- 每个写路径在同一不可变 `commitId / sequence / manifest` 下验证 current 和 full/delta history 的交付；故障前后读取必须见到可解释的提交代际。
- 在隔离测试根目录执行并发跨 Python/Node/进程写入、同 request nonce 重试、写中 kill、磁盘空间不足、lock timeout、`pending.json` 恢复、断链错误传播；**旧裸 JSON reader 一致性须明确验证或设置严格过渡约束**。
- 测试必须证明未改变历史 frozen daily archive、旧 SQL measurements、已持久化 annual 报告。禁止“修复性地”重算并覆盖已发表/已归档数据。
- source switch 历史失败单独登记：冻结基线是否同样重现、触发最小集、原因、是否涉及事实归属误判；最终 Gate 是否可以有期限地接受该失败，须由 owner 明确批准，不得偷偷加 `xfail` 或剔除测试。

**R3 判据**：Writer matrix 中**所有生产使用的写入口**都具有可复核的同一提交、并发/恢复证据；运行服务的实际路径与源代码一致。未覆盖项列为 blockers，而不是用合成的 52 PASS 代替。

## 5. 工作包 S — P0 安全、API/开发者能力（与 R2/R3 并行）

现已通过的 **92 SQL** 不再因“缺少测试数据库配置”阻断；仅在改动相应功能或需要最终回归时重跑。集中验证目前尚未知的入口/权限：

1. 从本地 active 版本重新生成 `api-auth-matrix.json`，比对已完成的四条私有 Source 相关路由，确认 service grant、owner 复核、返回前复核、缓存头在**真实运行进程**中生效。注明 92 SQL 覆盖的具体路由及未覆盖路由。
2. 审核 Nginx/网关/服务监听/允许来源，包括 `/api/taiko/proxy/*`、`/api/taiko/internal/*`、developer userdata、Sakura `/api/token`、miku `/uploadTaikoLogin`、Hiroba 凭据、sync dispatcher。用只读配置及隔离回环测试，不做公网越权试验。
3. 分离授权实体：**Developer App/Key = client identity + quota；ResourceGrant = 用户对指定绑定/资源的 scoped consent；Service identity = 内部受控调用；public-score token = 当前兼容通道**。普通 Developer Token 不因审批自动获得他人成绩权限。
4. 编制 `ResourceGrant` / `audience` / `scopes` / `expiration` / `revocation` / `resourceOwner` 的合同草案，保留现有 `sakura-taiko-contract` schema，**0.82 先做设计和威胁模型，不擅自宣称已完成 0.83 Freeze**。
5. 开发者申请可继续受理，但在统一授权上线前，向申请人只承诺**已验收的公共能力**。对私有成绩仅提供由数据主体明确持有、可撤销的现有授权路径，并标注旧接口可能伴随刷新副作用；未经用户授权禁止直接传入任意 `taikoId` 获取完整 userdata。
6. 除旧 SQL 92 项外，再做 Anonymous、wrong owner、wrong binding、revoked/expired client、wrong audience、missing scope、service impersonation、path traversal、ETag/304 after revocation、no middleware 与代理错误场景；同时验证失败路径不泄露结果、不触发写入或资源刷新。

**S Gate**：每条敏感入口从请求 → 边界/反向代理 → Node/Python → 存储资源都可证明 caller/resource/side effect 的授权；生产真实网络 ACL 需另有只读签收证据，不能仅靠 SQL fixtures 放行。

## 6. 工作包 G — Growth/Annual/历史一致性

- 原始 `score/current` 是**当前最佳记录集合**，不是逐次游玩日志；`history` 是观测证据，Source-switch、导入/手动/修复不能自动被当作真实当天游玩事实。
- Growth 保持对验证等价 wheel 的旧指纹连续性；算法或实际输入变动采用独立 v2 identity；保存旧 measurement/revision 不重写。
- Annual 已生成、分享、公开产物保留原 provenance；新算法读取变更触发应由缓存新键/显式重算决定，不给旧记录静默换标签。
- 验证 `compute -> Growth -> Goal -> Passport/Weekly -> Annual` 的相同输入/相同 Profile 与真实源码路径对应，检查 catalog/source revision、分页/历史 full/delta、空用户/损坏 user data、checksum mismatch、并发 Source-switch。
- 对指纹函数及完整历史读取做 cold/warm 性能基线：p50/p95/p99、子进程启动数、物理读取量、cgroup RSS/PSI、单用户/跨用户并发；**不要以测试总耗时推导产品性能**。

**G Gate**：算法/指纹/历史事实中持续兼容与有意变更都有可对照的独立 evidence；无法复现的“已通过”不得签收。

## 7. 0.82 Gate 与转入 0.83 的判断表

| 门类 | 2026-10-16 可信状态 | 晋级条件 |
|---|---|---|
| 自动隔离 MySQL | **PASS（限定三套 SQL/HTTP suite）** | 保留两个 fresh datadir、`@@datadir`、`SELECT DATABASE()`、自动 teardown 证据 |
| full role dependency install | **PASS（center/client）** | 进一步做角色业务生命周期（另一个 Gate），不是重复安装 |
| installed Publication bridge | **PASS（52 synthetic）** | 进一步覆盖全部生产 Writer 与 runtime reader |
| all compute/Annual/merged worker | **BLOCKED** | installed-wheel 全路径 + timeout/cgroup/error/cleanup，跨服务端到端 |
| API auth + actual ingress | **BLOCKED（局部通过）** | 补齐未覆盖入口、Grant/audience、生产只读 ACL 验证 |
| Credential boundary | **BLOCKED** | Sakura/miku/dispatcher 全入口合法调用与拒绝测试 |
| Single publication | **BLOCKED（局部通过）** | 所有 Writer 在共同 commit/锁/恢复协议下证明一致 |
| History continuity | **PARTIAL** | Source-switch 独立裁决；Growth/Annual 不重写与新版组合再验收 |
| Contract | **PARTIAL（现有 Golden 通过）** | 0.83 前必须明确 ResourceGrant/来源/模型/profile，但不提前宣布冻结 |
| Restore / RC | **BLOCKED** | 12 隔离资源异地备份、DB+C/H+archive/measurement 恢复演练、release manifest 和灰度 |

**正式停止条件**：若最先发现复现的 P0 越权、非一致读取/写入或生产部署钩子，则暂停目标路径的合并/部署，单独留下可重现的 blocker 及消除验证；不要为赶版本放宽错误处理或回退到源码导入。

## 8. Codex 下一轮直接执行指令（完整复制）

```text
目标：继续 Viewer 1.0 readiness，完成 0.82 剩余的跨仓库 installed runtime closeout；优先推进实际代码与验收，不再复做已经通过的数据库隔离环境和 center/client 完整依赖下载。0.83 Contract Freeze 尚未获准开始。

先阅读：
- 当前 Viewer local feat/viewer-1-readiness-20261015 的 readiness 主记录、runtime-closeout.md、api-auth-matrix.json、ownership-map.json、writer-matrix.json、runtime-release-manifest.json
- evidence/isolated-sql-20261016.json、evidence/fresh-runtime-proxy-retry-20261016.json（连同旧失败记录）
- 三仓库 AGENTS.md，Viewer docs/platform-architecture-audit/*、现有 sakura-taiko-contract 和 taiko_store Publication 协议

工作安全约束：
1. 只在隔离 worktree、隔离 SQL、合成 userdata 与已安装 wheel 的 QA 角色环境工作，不污染主工作树，不 stash/reset 删除 dirty 文件，不访问生产身份、密钥、SQL/实际用户成绩；禁止 deploy/restart/main push/PR/hooks 触发与线上写操作。
2. 所有 QA/BUILD 必须经过 scripts/memory/run_qa.sh / run_build.sh 的 cgroup/内存/时间准入。SQL 有显式 --allow-test-db-mutation、真实 SELECT DATABASE() 且目标必须是全新 viewer1_security_test 库；绝对不连接生产。
3. 从 git status、HEAD、merge-base 开始，核对 Viewer active/local 56aa05a→03aeb43→22f7b0b 与旧 Viewer 6331aea 的分叉；Taiko 15722e8；Sakura 本地新 HEAD 和旧 38298af 的分叉。禁止盲目 cherry-pick 旧候选覆盖新版 owner/service grant、锁复核及 batch Writer。
4. 固定 role-specific package/wheel hash 和解释器；实际检查 center/core 0.1.1 与 client/core 0.1.2 的安装闭包。不得由源码、editable、PYTHONPATH 或污染 cwd 提供模块。Production interpreter 配置只生成待审模板。
5. 依次补齐 compute、Annual generator/rating、merged-read、Growth fingerprint、实际 center/client 命令 lifecycle 的 installed-wheel 执行链、失败链和 cgroup cleanup；维持唯一受控解释器入口（按服务角色独立）。优先小步增量补丁 + 新测试。
6. 并行追踪所有 Python/Node/dispatcher/Viewer/merge Writer 的同 commit current/history 语义，覆盖故障恢复和并发冲突；旧 JSON 直读者的隔离必须显式说明。Source-switch 原有 FAIL 不能变 PASS 或删除。
7. 在本地新版源码而非旧审计假设上审查 API auth：已有的 92 SQL 通过不重复宣称 1.0 放行；针对未覆盖路由、Sakura/miku 凭据控制面及反向代理 ACL 补测试/只读证据。Developer Token 是 identity/quota，不得让它直接代替用户 ResourceGrant。
8. 收尾必须产出：更新的 runtime-release-manifest.json、api-auth-matrix.json、writer-matrix.json、conflict-ledger.json、Gate 状态表、fresh run 日志 hash、各 repo 实际提交、完整 rollback 指令和剩余 blockers。不得改写前次失败证据。

优先顺序：R1 组合冻结 → R2 installed compute/Annual/merged → R3 cross Writer 及 G 历史事实 → S 未覆盖授权/凭据边界并行 → 0.82 Gate 重验收。

只在上述必需证据关闭后，提交一份“建议进入 0.83 Contract Freeze”的有条件签收报告；否则明确 0.82 BLOCKED 及下一个最短修复动作。禁止以文件删除数或已跑的孤立测试数替代放行标准。
```

## 9. 供 owner 复核的关键证据路径（以用户报告为准）

- `scripts/readiness/run-isolated-sql.mjs`：每次新 MySQL 8.0.24 datadir、真实 DB 名 + SQL mutation opt-in。
- `evidence/isolated-sql-20261016.json`：61+31 SQL/HTTP PASS、隔离/关闭证据。
- `evidence/fresh-runtime-proxy-retry-20261016.json`：center/client 全新安装；已安装第三方 sha/版本清单；center manifest hash `b338ce9815481876112b2afa02069dac20759eee114ac6aaa5aee24e4d5336f5`，client `92c5a13bbe670776502ebd104c185fb5052a0a261d7cb065242a8e7d109aba44`。
- `runtime-closeout.md`：本地真实分叉及新安全/Writer 改动归属。
- `api-auth-matrix.json`、`ownership-map.json`、`writer-matrix.json`、`runtime-release-manifest.json`：现有机器清单，须增量更新，不能再造平行权威。
- `/var/tmp/taiko-viewer1-installed-publication-qa.log`：installed 52 synthetic PASS 的原始记录（本机临时文件，不等于异地持久备份）。
- `docs/Sakura_Taiko_Domain_Extraction_Program.md` 与 `packages/sakura-taiko-contract/README.md`：原定 0.82/0.83/0.90/0.95/1.0 产品和领域契约，不因当前复验结果重编号。

---

**本文件只规定下一轮任务，未对任何用户服务器或仓库执行写操作。** 即使文件已有 `PASS` 标签，只有对应的本地、隔离、真实消费者证据才能把联合 Gate 改为 PASS。
