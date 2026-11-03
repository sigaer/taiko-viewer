# 剩余范围：冻结候选后的有限清单

日期：2026-10-12，Asia/Shanghai。结论：**CANDIDATE_CONTAINED / EXTRACTION_TARGET_NOT_YET_MET**。本文件是后续候选清单，不是实施授权；本轮不改源码、不运行迁移、不发布，不标 Gate 6 PASS。

冻结证据见 [candidate-state.json](candidate-state.json)，组合条件见 [联合发布矩阵](goal-gap-and-release-matrix.md)。冻结是记录 HEAD、工作区与指纹，不是给其他编辑器加写锁。16:26:24–16:29:29 的两次采样无 HEAD/index/status/WIP 指纹差量，17 个 Native 候选文件与 handoff 相同。其他 Codex 进程任务身份 UNKNOWN，不能承诺未来无人编辑。

本轮差量：Viewer 已跟踪的 `docs/taiko-domain-extraction/status.md` 被删除；删除者和原因 UNKNOWN，保持原状。只读 `git show 56aa05a6:docs/taiko-domain-extraction/status.md` 取得历史台账，不将其中旧 Goal active 当作实时事实。公开与本机首页最小 GET 均实测 `appVersion=0.81.11`；生产 schema、grants、pending/outbox、加载源码 SHA 未查询，均 UNKNOWN。

路径缩写：A=`/home/sigaer/git/Sakura_bot`，B=`/home/sigaer/taiko-bot`，C=`/home/sigaer/taiko/taiko-forum`，R=`/home/sigaer/taiko`，V=`C/taiko_viewer`，K=`/home/sigaer/git/sakura-taiko-core`。下面每个目录集合限定为 candidate-state.json 中冻结 HEAD 的已跟踪路径和显式列出的 3 个 Source WIP 文件；不是未来新文件的无限范围。

## MUST_FINISH

这些是达成源码归属目标或激活现有候选前的必要候选工作。单项退出不等于整个 Gate 6 通过；后续只应逐项领取有限授权。

| ID / 有限工作包 | 实际文件或模块 | 依赖 | 缺失验证 | 明确退出条件 |
| --- | --- | --- | --- | --- |
| M0 候选证据一致性 | C `docs/taiko-domain-extraction/status.md` 的删除；四仓 HEAD/index；17 个 WIP 指纹 | 当前快照、交接者对删除用途的解释；不自动恢复文件 | 删除的来源；实际运行制品与源码的映射；外部自动拉取情况 | 后续实施前记录删除应保留或恢复的决定；对实施使用的精确 HEAD+WIP 重新定版；任何新增差量先停并审阅，不凭旧报告继续 |
| M1 Native Reader WIP 定案 | A `taiko/plugins/utils/native_score_read.py`、`taiko/tests/native_score_read_sql_child.py`、`taiko/tests/test_native_score_read.py`；C `taiko_viewer/tests/nativeScoreReadSql.test.mjs`；下方 N1–N13 的已跟踪调用点 | Source/SQL authority、现有 Core 0.1.1、QQ 1.7.2、隔离测试库；M0 | 新 SQL child/parent 从未执行；fresh bind/state、late revoke、SH 至回复、QQ `before_send`/proactive retry、真实 PNG/SDK 路径 | 在同一候选上完成这些明确路径的有界验证；证明自有 hidden 可用、越权/撤权不返回旧图、排队/超时释放 lease；精确记录未覆盖项。若保留未验证 WIP，则不能把它作为可激活组合 |
| M2 太鼓应用源码归属迁出 | A `taiko/` 冻结 473 条 tracked 路径及 3 个 WIP；另 A `taiko_backend/` 31 条、`taiko_manager/` 195 条；逐路径枚举在 JSON `ownership_manifest` | M0；现有 K/Contract 保留；目标归属分工见矩阵；不能把 R 当源码仓库 | 独立路径安装/启动、反向 import、资源/脚本路径、当前命令/采集/渲染/存储调用证明 | 每条路径有迁往既有独立 Taiko 仓库、经证实通用而保留、或经确认废弃的处置；独立仓拥有维护与发布入口；A 当前树移除太鼓专用实现及维护资产，无双份活动源码。历史 Git 不删除，私有数据不入 Git |
| M3 跨目录太鼓入口与宿主边界 | A `miku_bot/sekai/upload/taiko_login.py`；`server.py` 中 `/uploadTaikoLogin`；`miku_bot/runtime_init.py`、`miku_bot/plugins/self_service.py`、`miku-self/self_func/self_test_runtime/user_commands.py` 中 inventory 指出的太鼓部分；A `taiko/bot.py`、`taiko/taiko_runtime/memory.py` 对根级宿主的依赖 | M2；通用 `feature_handler_bootstrap.py`、`feature_handler/`、`runtime_memory/`、`nonebot_plugin_method_calls/` 的明确包/API 边界 | 混合文件的符号级归属；upload cookie 写入入口迁出后的协议；不依赖 Sakura 工作树启动 | 太鼓专用 handler/凭据写入与维护逻辑由 Taiko 仓拥有；Sakura 仅保留真正通用宿主能力。以有限清单的反向依赖/启动验证确认无硬编码 Sakura 源码根；不整体搬走或删除 miku 通用功能 |
| M4 同一候选的安装与 schema 联调 | V `server/utils/account-db.ts`、`server/infrastructure/taiko-publication/` 五个 schema 模块、`server/infrastructure/account/` 四个 schema 模块及 `score-token.ts`、`sync-request.ts`；A `taiko/scripts/{account_sync_cli,source_mutation_cli,hiroba_credential_cli,merged_read_cli,qq_migration_cli}.py` | M1、固定 Source/Viewer/Contract 版本；schema 清单见矩阵；现有 DB 方案不变 | 真实 DDL/FK/索引 parity 的差距清单、完整 Nuxt/NoneBot 启动与 worker 装载、捕获 pool/paths 的组合验证；历史局部 tsc/合成 SQL 不能覆盖这些 | 在授权的隔离环境从明确 schema 基线安装候选，列出所需表/列/约束的逐项结果，并跑限定链路：私有 current/history、Wahlap/Hiroba、绑定删除/visibility/QQ migration、score token、manual create/delete/recovery。不能获取的 schema 证据保持阻断，不以重开 B-0/全 staging 代替差量验证 |
| M5 普通部署者可安装且权限可解释 | B `README.md`、`requirements-domain.txt`、`pyproject.toml`、`taiko_bot/viewer_client.py`、`taiko_bot/userdata_provider.py`；K `pyproject.toml`；C `packages/sakura-taiko-contract/`、`taiko_viewer/scripts/configure_source_service.ts` | 选择现有私有 Git 授权或固定 wheel 分发；M4 候选后端；明确普通 owner 与 service 两种模式 | 没有维护者 SSH 权限的干净环境安装/启动；wheel 交付可达性/hash/许可证；普通 Token 的 own-source 能力与 service 显式授予 | 只有承诺权限和 Developer Token 的部署者按文档成功安装精确包、启动并访问其被授权资源；若承诺服务型跨账号机器人，须实际配置 scopes/principals/sources 并验收。未配置时明确失败，不恢复磁盘/stale/匿名 fallback |
| M6 一次关键成本与锁等待探针 | A `taiko/taiko_store/{publication,reader,merged_read,merged_materialization,daily,bridge}.py`；C `server/infrastructure/taiko-publication/client.ts`、`server/infrastructure/account/{sync-worker-runner,source-mutation-worker-runner,merged-read-worker}.ts`（均相对 `taiko_viewer/`）；现有 Growth 计算入口 | 同一冻结候选、批准的合成输入规模和数值预算；现有 memory runner，不扩大限额 | 冷登记/追加/SH Reader 的 IO、进程树 RSS/bridge+compute 数量、同 Source 更新/查询/撤权的锁等待；32/64 MiB、50k H、2 GiB store 边界的完整链路表现 | 先书面固定一个代表 Source、一个多成员 u0、同账号读写撤权竞争三类场景及预算，再仅运行一次有界探针并对照阈值；失败或预算未定即停止该工作包。不能用 warm cache 成绩代替 cold input 建立成本，也不因此自动开发新架构 |
| M7 受控切换与恢复方案 | A `taiko/scripts/sync_dispatch_server.py`、`backfill_daily_ability.py`、`taiko_store/`；V `server/plugins/source-lifecycle.ts`、`server/services/account/{manual-recovery,source-lifecycle-recovery}.ts`；C `docs/taiko-domain-extraction/source-service-operations.md`；R 对应运行文件和服务 | M1/M4/M6；R dispatcher 行为已在旧报告冻结，不能直接拿早期 A 覆盖；实际 pending/grants/schema 证据 | Writer 停用与纳管顺序、C/H/u0/daily 备份和前向恢复、service 配置、双解释器固定依赖、启动/恢复操作的完整演练 | 一份可执行且经隔离演练的顺序清单，逐一覆盖 Wahlap/Hiroba save、Viewer edit/import/manual/Kinoko、dispatcher、native u0、daily/trend/backfill、backup/restore/purge/collector；每项有唯一 Writer 和停用证明。生产检查与激活另需授权，不混跑新旧 Writer，不以旧危险入口作回退 |
| M8 联合发布准入与有限产品验收 | 矩阵中的 A/R、B、C、K、Contract、Token、schema 组合；C `scripts/deploy_forum_web.sh` 只作为未来既定发布入口 | M0–M7 通过；M2/M3 是用户归属目标，不能被发布成功替代；P1 的独立处理决定 | 客户端真实 SDK/QQ reply、完整图片与 upstream、线上认证产品、部署者升级时序；当前仅首页 200/版本实测 | 先形成精确制品/包 hash/迁移版本/功能兼容清单；后续获准发布时仅最终集成者按标准流程操作，失败即停。既定产品清单逐项验收并报告保留限制；若 P1 未完成，不宣称原 Gate 6 PASS |

M1 的 13 个 tracked 调用点（相对 A）：

1. N1 `taiko/plugins/taiko.py`
2. N2 `taiko/plugins/utils/__init__.py`
3. N3 `taiko/plugins/utils/b30_render.py`
4. N4 `taiko/plugins/utils/dani_progress.py`
5. N5 `taiko/plugins/utils/draw_dress.py`
6. N6 `taiko/plugins/utils/draw_summary.py`
7. N7 `taiko/plugins/utils/drawinfo.py`
8. N8 `taiko/plugins/utils/recommend_image.py`
9. N9 `taiko/plugins/utils/taikob_v2.py`
10. N10 `taiko/plugins/utils/tcloud.py`
11. N11 `taiko/taiko_runtime/platform_adapter.py`
12. N12 `taiko/taiko_store/merged_materialization.py`
13. N13 `taiko/taiko_store/reader.py`

后续顺序：M0 → M1/M5 的证据与交付准备 → M6 先回答当前设计的关键成本 → M2/M3 有限迁出及 M4 联调 → M7 → M8。M6 执行前仍须满足自己的依赖；箭头不是本轮启动命令，也不表示必须并发。

## PARKED

| ID / 保留事项 | 实际文件或模块 | 依赖与缺失验证 | 退出条件 |
| --- | --- | --- | --- |
| P1 原 Phase 6 Read Model 完整工作包 | C `taiko_viewer/server/services/{growth-history,growth-recent,goals}/`、`server/services/taiko-domain/read.ts`；A `taiko/growth_compute/`、`taiko_store/{reader,daily,merged_read}.py`；现有 `docs/growth-history-read-model-*.md` 仅作参考 | M6 成本结果；精确 C/H commit、daily 内容、catalog/规则、binding、Goal/measurement 依赖与失效；百万记录 cold/warm IO/RSS 未验收。Phase 5 的百万 DTO parity 不是此项成本证明 | 用户另授有限范围后，仅就 90d fact/365d measurement 既定产品窗口制定完整 parity/失效/资源阈值并验收。在此之前不启动开发，原 Gate 6 持续未通过 |
| P2 现有 Phase 6 候选及安全修复保管 | A cc66b22 + Native WIP；B fa0983d；C 56aa05a 的 0.82.0；candidate-state.json 中精确文件 hash | M1/M4/M7/M8 尚未完成；源码 push 不等于联合上线 | 原样保留，只有某个依赖闭合的有限集合经审阅才可另行授权发布。不得 blanket revert、恢复 userid-only grant、密码 argv、无所属 QQ 复制、stale private fallback 或旧 startup/daily Writer |
| P3 历史 worktree 与外部编辑现场 | JSON `repositories.*.worktrees`；A miku WIP、B `web.conf`/`v1_test_report.md`、C 既有未跟踪报告 | 3 个注册 worktree 路径缺失；外部任务身份 UNKNOWN；本轮非清理任务 | 保持原状且不纳入迁移提交；只有其所有者另授清理/恢复范围才处置。路径缺失不自动 prune |

## DEFER

| ID / 延期事项 | 实际文件或模块 | 依赖与缺失验证 | 退出条件 |
| --- | --- | --- | --- |
| D1 已冻结行为 profile 的产品统一 | K 既有 calculations/recommendations/visibility/parser 模块，A/B 对应 domain adapter；Phase 3/4 报告中的 center/client v2、target、可见范围、parser 与 u0 manual 差异 | 需要逐项产品决定和新 Golden，现有兼容性不允许静默改公式 | 有单独批准的差异表和数值/可见性验收后才改变；本次保留 Core 0.1.1/0.1.2 固定组合，不把版本一致作为目标 |
| D2 百万负载长期基准与多副本扩展 | P1 指定模块、C worker runners、A `taiko_store/` | M6 探针及 P1 范围决定；多主机/多副本 admission、长期容量预算未批准 | 另立固定数据集/场景/运行时上限和指标；本轮不运行 benchmark、不自动新增全局调度系统 |
| D3 SQL 化成绩或另建 Core/数据库 | 现有 K、Contract、A `taiko_store/`、C account/Goal/measurement schema | 当前加强 JSON + 既有 SQL 权威选择保留；没有新方案授权 | 不属于本次迁出完成条件。除非用户另行明确改变范围，否则不启动；不设计第四套核心或新数据库 |

## 验证复用与停止边界

复用 Phase 3/4/5 与 Phase 6 已有报告时，须比对受测文件及其依赖的候选版本，保留合成上游、缺 FK、AST/局部 tsc、无完整 Bot/Nuxt/PNG 的限制；不叠加为“全平台通过”。Native 最后 408 tests +25 subtests 是历史证据，不覆盖后写的 SQL child/parent。

后续 mutating QA 必须实际 `SELECT DATABASE()` 以 `_test` 结尾且 `TAIKO_ALLOW_TEST_DB_MUTATION=1`，不得复制生产资料；按实际工作目录 memory runner 执行。既有 B-0/DB Isolation 不重启，有限 schema 差距仍须诚实列明。发现本清单外的新阻断只记差量、停止该包并重新限定范围，不自动递归扩展任务。

本轮到三份产物交付即结束。文档不会改变运行代码或业务配置，因此不需要版本 bump、部署或重启；最新用户明确禁止提交/推送及业务变更。
