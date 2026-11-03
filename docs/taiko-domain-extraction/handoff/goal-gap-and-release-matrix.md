# 目标差距与联合发布矩阵

日期：2026-10-12，Asia/Shanghai。**CANDIDATE_CONTAINED / EXTRACTION_TARGET_NOT_YET_MET**。本轮冻结记录，不实施迁移或发布，不恢复旧 Goal，不标 Gate 6 PASS。

## 用户目标与当前归属

目标：太鼓专用源码、命令、渲染、采集/存储及维护脚本由独立太鼓仓库拥有；Sakura_bot 不再承担维护中心。历史 Git 不要求删除。共用 Core 是成果，但不能替代整个应用域的源码归属迁出。

缩写：A=`/home/sigaer/git/Sakura_bot`，B=`/home/sigaer/taiko-bot`，C=`/home/sigaer/taiko/taiko-forum`，V=`C/taiko_viewer`，R=`/home/sigaer/taiko`，K=`/home/sigaer/git/sakura-taiko-core`。Contract 在 C 的 `packages/sakura-taiko-contract`，没有独立 Git HEAD。R 是运行树，无自己的 `.git`，不能当作第四个源码仓库或以 A HEAD 代替它的运行版本。

下表的“应归属”是使用既有独立太鼓仓库的收口建议，未创建目录或改变锁定的计算/存储设计。迁移顺序和具体包路径待有限实施任务定版；不能因建议尚未实施而将残留描述成通用宿主。

| 当前仍由 Sakura 拥有的范围 | 应归属 | 已知依赖与完成缺口 |
| --- | --- | --- |
| A `taiko/bot.py`、`bot_core.py`、`bot_gateway.py`、`plugins/taiko.py`、`taiko_runtime/`、太鼓专用 adapter/命令和 QQ 消息格式 | B 管理原生/分布式部署模式下的太鼓应用包与命令实现 | NoneBot、QQ/OneBot、身份/权限与配置；现有 B 命令不能与新迁入实现继续双份维护。完整安装/注册/send 路径缺证据 |
| A `taiko/plugins/utils/` 中 B30、drawinfo、draw_summary、draw_dress、dani_progress、recommend_image、tcloud 等渲染，`templates/` 与受版本管理的渲染输入 | B 的太鼓渲染/应用资产；纯公式继续 K | PIL/字体/公开 catalog、Core profile、canonical current/history；完整 PNG/素材与独立路径验证未完成 |
| A `taiko/plugins/utils/userdata_storage.py`、`hiroba/`、`native_wahlap_update.py`、`merged_bind.py`、`daily_ability.py`；A `taiko/taiko_store/` | B 的中心采集与存储 Infrastructure，作为现有部署模式的独立 Taiko 所有物；不放进无 IO 的 K | 上游凭据、SQL identity/song locks、C/H publication、daily、u0、授权与 recovery；R 尚无 taiko_store，P1a 纳管和旧 Writer 停用未完成 |
| A `taiko/server.py`、`taiko/scripts/sync_dispatch_server.py`、private CLI、`growth_compute/` | B 中太鼓专用服务/worker；Viewer 产品规则仍 C，纯计算继续 K | Viewer read/publication port、worker cwd、Core pin、SQL grants；R dispatcher 曾有 A 没有的行为，历史合并证据不能被旧文件覆盖 |
| A `taiko/scripts/` 的 16 个脚本，`deploy/`、`pyproject.toml`、`requirements-domain.txt`、tests/docs/schemas 及公开资源索引 | 随所服务的 B/C 模块迁出；维护入口由独立 Taiko 仓发布 | 固定清单在 JSON；包括 backfill、sync、backup、storage maintenance。`storage_maintenance.py` 保护 userdata、`taiko_admin_backup.py` 只管 catalog/admin 的历史结论，不等于成绩恢复验收 |
| A `taiko_backend/` 31 个 tracked 路径：Java 后端、mapper、SQL、build 配置 | C 的太鼓 Web/backend 归属，或经确认停用后从当前 Sakura 树移除 | Java/Spring、catalog/管理身份 SQL、与管理端 API 的边界；当前部署地址/版本 UNKNOWN，不能因未见进程就删源码 |
| A `taiko_manager/` 195 个 tracked 路径：管理前端与构建资产 | C 的太鼓管理端归属，或经确认停用后移除 | 对应 backend、API origin、资源与构建链；历史 inventory 已纳入，不能漏算为“非 bot 不迁” |
| A `miku_bot/sekai/upload/taiko_login.py`、`miku_bot/sekai/upload/server.py` 的 `/uploadTaikoLogin` | 太鼓凭据/配置写入 handler 归 B；如需入口代理，只留真正通用宿主转发 | 本轮实测 server 仍 import `taiko_login` 并调用 `update_taiko_config`；不能只搬 taiko 目录而留下维护入口 |
| A `miku_bot/runtime_init.py`、`miku_bot/plugins/self_service.py`、`miku-self/self_func/self_test_runtime/user_commands.py` 中历史 inventory 指出的太鼓部分 | 太鼓专用部分归 B/C；通用功能留原宿主 | 这些是 mixed 文件，当前符号级边界未重审；仅迁入清单，不整体删除或搬走 miku 功能；无关 miku WIP 保留 |
| A 根级 `feature_handler_bootstrap.py`、`feature_handler/`、`runtime_memory/`、`nonebot_plugin_method_calls/` 与 `taiko/bot.py` 的绝对 Sakura 路径关联 | 真正通用模块可留通用宿主；太鼓不能依赖 Sakura checkout 布局来安装运行 | 本轮确认 `SAKURA_ROOT=/home/sigaer/git/Sakura_bot` 和 `from runtime_memory import ...`；需明确包/接口依赖、验证无 Sakura 目录启动。不新建一套领域核心 |

当前有限路径清单为 A `taiko/` 473、`taiko_backend/` 31、`taiko_manager/` 195，共 **699 个 tracked 路径**，另 3 个未跟踪 Native WIP；包括源码、测试、文档和资产路径，**不是 699 个源码模块**。完整清单见 JSON `ownership_manifest`，不读取私有数据内容。根级通用/混合模块不计入这 699 条，单独列出以避免误删。原 1180 modules/1840 paths 分类中的 “retain host” 是历史方案标注，不能用来改变本轮用户的最终归属目标。

Phase 6 §6.1 把 publication 放进 Sakura 中心 Infrastructure，是为了避免文件系统/SQL 进入纯 Core，并就近接入中心 Writer；这解释了当时的位置，**没有解决维护中心仍在 Sakura 的问题**。可保留同一 publication 实现及安全修复，把归属和包边界迁至独立 Taiko 仓；无需重写第四套 Core 或另建数据库。

## 本轮证据与发布状态

| 对象 | 本轮实测源码 / 工作区 | 运行、已发布与未知 |
| --- | --- | --- |
| A | main `cc66b2207a725489987787bb8d5f785f61c3a352`，主题 9.81.28；Taiko Python 项目版本 0.2.1；13 tracked +3 untracked Native WIP；无暂存 | 9.81.28 push 是历史证据，实时远端 UNKNOWN；Phase 3 基线 9.80.7/95d71d5 历史已部署，不能称 R 正加载 cc66b22 |
| B | main `fa0983dcc56ca109555a33d90aac0fecca6bdf0d`，0.2.7；保留 web.conf/v1_test_report.md；无暂存 | 0.2.7 历史已 push；未发现 cwd 在 B 的本机业务进程，预期 `.venv` 不存在。外部实例、自动拉取和其包版本 UNKNOWN |
| C / Viewer | main `56aa05a6eecfbd163bc4cb2b985dfa66ab7ea696`，package 0.82.0；比本地 origin/main `9a77dbc…` 领先39；status.md 被删；Native SQL test 未跟踪 | 本机与公开首页均 HTTP 200 / appVersion **0.81.11**。0.82.0 尚未在这两个观测端点上线；0.81.11/eca1b08 标准部署为历史证据；当前 bundle 精确 SHA UNKNOWN |
| K / Core | main `0b7319d94b041daafb0a0d32e3ccc95e50da8810`，0.1.2，干净 | tag/push 历史已完成；R metadata 是0.1.1，QA target是0.1.2。registry/current remote UNKNOWN，不把 QA 安装当 B 生产安装 |
| Contract | C 内 Python0.1.0 / JS0.1.1；归属 C HEAD；Viewer 使用 `file:../packages/sakura-taiko-contract` | Node node_modules 链接至源码包0.1.1；生产 bundle 实际嵌入版本 UNKNOWN。Python consumer 固定旧 Viewer commit23f89b4，不自动换到 C HEAD |
| R | 独立于 A 的运行目录；userdata_storage/merged_bind/daily_ability/dispatcher 4份文件的 hash 与旧 ownership 报告相同；无 taiko_store/native_score_read.py | NoneBot829369/829379；Viewer1063394、receiver1063408、public API829173、song-update1550183 状态/进程实测，主要 PID 与 handoff 相同；完整加载源码 SHA UNKNOWN |

没有 fetch/ls-remote，因此 origin/main 只是本地引用。16:26:24–16:29:29 冻结采样无工作区差量；status.md 删除在首次读取前已存在，无法认定是谁删除。其他 codex 进程仍存在，但未发现旧迁移持续写入证据；这不是永久暂停证明。

## 可运行组合矩阵

“候选条件成立”不表示已经可上线。安装包、源码提交、生产运行分别判定；有 UNKNOWN 的组合不能标 VERIFIED。

| 组合 | 客户端 / 后端 / Source | Core / Contract | Token 与 schema 条件 | 判定 |
| --- | --- | --- | --- | --- |
| L：保留现网 | Viewer 0.81.11 + 现有 R；无本机 B 启动证据 | R 磁盘 Core0.1.1 / Python Contract0.1.0；加载值未知；Viewer bundle Contract未知 | 现网 schema/grants 未查；普通现网授权沿用已有部署 | **OBSERVED_RUNNING + HISTORICAL Phase3/5 PASS**；本轮仅进程/匿名首页，未做认证产品验收；保持现状 |
| H：历史客户端基线 | B0.2.0/d501343 的历史安装/命令 import；当时中心边界 | Core0.1.2 / Python Contract0.1.0 固定 pin | 历史隔离安装与合成 SQLite/files，不是生产跨用户 grant | **HISTORICAL_ONLY**；不能外推到 B0.2.7，也不建议回退恢复不安全入口 |
| X1：新 B + 旧线上后端 | B0.2.7/fa0983d → Viewer0.81.11 + 旧 R | 包 pin 即使正确，也不能提供缺失的 HTTP/Source 能力 | B 已要求私有 Token、raw-v1/order metadata、版本证明、中心 u0、remove/visibility/token/QQ migration 新协议；旧后端未联合验收 | **NOT A SUPPORTED RELEASE COMBINATION**；部分公共接口能通不代表私有命令可用，不允许承诺升级即用 |
| X2：只上线 Viewer 候选 | Viewer0.82.0/56aa05a + 当前 R | JS Contract0.1.1；R仍Core0.1.1/Contract0.1.0 | R 无 taiko_store/新CLI；生产DDL/grants未知，未完成adoption | **BLOCKED**；Source bridge/worker 依赖未就绪，不能单靠 build/包版本补齐 |
| X3：只同步 Source 候选 | A cc66b22(+Native WIP) → R，但仍旧 Viewer/旧 Writer 并跑 | 中心Core0.1.1/Contract0.1.0必须保持；Native WIP未验收 | QQ migration表、生命周期/grant等依赖未确认；新旧 Writer 同 root 不可并跑 | **BLOCKED**；不能用“代码已push”许可同步或重启 |
| J-owner：候选普通部署 | B0.2.7 + Viewer0.82.0 + 与之匹配的迁出后Source代码、完整canonical/adoption | B Core0.1.2；中心Core0.1.1；Python Contract0.1.0；Viewer JS0.1.1，全部精确 pin | 有效Developer Token + 完整自有同平台Source绑定；QQ操作需verified QQ对应身份；manual走专用入口；schema完整 | **CONDITIONAL / NOT JOINTLY VERIFIED**；M1/M4–M8完成前不可激活。ordinary token不具有跨任意用户能力 |
| J-service：候选服务部署 | 与J-owner同版，服务机器人处理明确授权的多身份 | 同上，不能自动统一Core版本 | token-id级active Source grant；scopes+sources+principals+expiry/revision精确匹配；生产尚未登记的历史记录不能替代本轮实测 | **CONDITIONAL / NOT JOINTLY VERIFIED**；按token的显式授权与包下载权限各自验收 |
| X4：错误包组合 | B0.2.7 + Core0.1.1，或仅安装Core0.1.2缺Contract/hiroba extra；把Python pin换成浮动main | 不符合声明固定依赖 | Developer Token无法修复Python import/功能profile缺口 | **UNSUPPORTED / NOT VERIFIED**；历史QA误选系统Core0.1.1曾收集失败；不尝试升级来掩盖 |

J 组合中的 Source 包地址/迁出后的 commit 尚未产生，不能伪造可执行 release tag。当前 A HEAD + WIP 只构成冻结输入；最终源码归属 M2/M3 仍未实现。

## Token 和安装权利的不同条件

| 凭证/能力 | 授予什么 | 不授予什么 |
| --- | --- | --- |
| Viewer Cookie /普通 Developer Token | 站点身份及其自有Source/平台绑定授权；API quota独立核验 | 任意Source、别人的QQ、默认跨用户service能力、GitHub SSH读取权 |
| 显式 Source service grant | 绑定到特定token id的scopes、sources、principals、revision/expiry；`*` 也必须显式登记 | 同账户其他token/Cookie的继承权，不得撤权后fallback |
| public score bearer | 既有被签发的成绩Source capability，按旋转/撤销规则生效 | Developer API账号授权、QQ迁移所属或私有Git下载权 |
| Bot internal service token / 上游Wahlap/Hiroba凭据 | 各自既有内部API或上游访问职责 | 不可替代Developer Source grant，也不能把登录成功当站点/QQ所属证明 |
| GitHub SSH授权 / 可获取的固定wheel | 下载与安装精确版本的代码及依赖 | 任何HTTP业务数据权限 |

B当前安装文件真实固定：

- Core0.1.2 → `sakura-taiko-core` commit `0b7319d94b041daafb0a0d32e3ccc95e50da8810`，带 `[hiroba]` extra。
- Python Contract0.1.0 → Viewer commit `23f89b4f70e5a64ae76c33ac04c6c2d242808df1` 的 `packages/sakura-taiko-contract` 子目录。
- 中心Core0.1.1 → `9fc0731358f6863c1e1efd9f1930a608850786f7`，不可用K当前HEAD替代。
- 当前 Python 声明均至少3.11；B README要求Git及两个私有依赖仓库SSH读取授权，或先从维护者取得精确wheel再安装B。没有在本轮安装任何包。

Phase4历史wheel SHA256：Contract0.1.0 `61c63fda6949c6c8c4f84dd63b170482cc127dcf957facad056663bcf6f240d7`；Core0.1.2 `f34c1d0a3e58f5a7ce232ca50741e3235260eb8dabaedd95b41d84e7d0d0d47f`。这些是旧证据值，不代表当前分发渠道仍可下载、已提供许可或当前磁盘wheel已经重验。

**仅有普通 Developer Token 的部署者，目前没有被证明能够完成干净安装并运行承诺的完整机器人能力。** 包渠道可达性/授权、wheel完整依赖和hash/许可证、Token模式允许的功能范围须分别验收。无需把私有源码公开，但不能用维护者已安装成功代替普通部署者的证据。

## Schema 与激活依赖

本轮未连接任何数据库。下表是源码需求，不是实际 applied 证明；JSON记录各声明文件hash。生产/test实时schema、pending/outbox与grants全部 **UNKNOWN**。历史SQL测试使用 `_test` 与显式opt-in，但多份报告声明未包含生产FK，不能冒称完整迁移验收。

| 模块（相对 V） | 候选所需SQL对象/变化 | 激活条件 |
| --- | --- | --- |
| `server/infrastructure/taiko-publication/{lifecycle,creation,grant,binding-revocation,binding-confirmation}-schema.ts` | `taiko_source_lifecycle`、`taiko_manual_creations`、`taiko_manual_grant_receipts`、`web_taiko_binding_revocations`、`web_taiko_binding_confirmations` | 生命周期receipt、forward recovery与authority在同一版本下验证；新worker启动不能先于所需schema |
| `server/infrastructure/account/source-service-schema.ts` | `taiko_source_service_grants`、`taiko_source_service_grant_audit`及`principals_json` | token-id精确授权；生产真实service清单/登记结果待证实 |
| `server/infrastructure/account/bot-binding-schema.ts` | `taiko_bot_binding_operations`及`effect_json`/`effect_hash` | remove/visibility/nonce重试使用完整receipt结构 |
| `server/infrastructure/account/qq-migration-schema.ts` | `taiko_qq_migration_codes` | 先schema，再Native/center QQ CLI；禁止恢复输入QQ即复制绑定的入口 |
| `server/infrastructure/account/hiroba-credential-schema.ts` | `web_hiroba_credentials.configured_by_qq`扩至191；`taiko_hiroba_binding_operations` | 与原Fernet兼容、身份长度与credential/QQ事务同版验证；不输出密钥 |
| `server/infrastructure/account/score-token.ts`、`sync-request.ts`、`server/utils/account-db.ts` | `public_score_tokens`、`web_data_sync_receipts`与既有account/binding/state/session/developer/quota/日志表；通过account-db初始化组合 | 同时核对Python issuer/native连接使用的列与约束；不能仅检查新增表名。DDL可能由初始化触发，本轮未import应用或执行初始化 |
| A `taiko/taiko_store/publication.py`、Contract `schema/contract-v1.json` | 文件publication schema与JSON契约，不是SQL迁移；C/H、daily、u0各自的实际边界保留 | 旧Writer停用、显式纳管、history/daily冻结点和恢复证明；不能把manifest/schema文件存在当数据已迁移 |

## 后续联合发布的准入矩阵

以下是待执行步骤的依赖关系，不是本轮操作授权，也不是可以复制执行的发布命令。

| 顺序 | 必须先有的证据 | 当前状态 / 停止条件 |
| --- | --- | --- |
| 1 固定制品和归属 | M0候选无冲突；M2/M3迁出结果；Source/Viewer/B/Core/Contract精确commit与包hash | 归属目标未实现；Native为WIP；发生差量先审阅 |
| 2 验证安装、schema与关键成本 | M1/M4/M5/M6；限定链路、普通部署者安装、锁等待和进程成本阈值 | 尚缺。不得以既有局部PASS或Phase5百万DTO parity代替 |
| 3 排定维护与恢复 | M7；实际运行文件/解释器/Writer清单、schema/grants/pending状态、独立备份及前向恢复演练 | UNKNOWN项未闭合就不切换；新旧Writer不可并跑 |
| 4 生产schema/Source/Viewer协调切换 | 获准的维护窗口中明确DDL与worker启动顺序，全部旧Writer停用后纳管C/H/u0/daily，再激活匹配Source/后端与显式grants | 本轮禁止；只允许最终集成者用既定memory build wrapper和 `scripts/deploy_forum_web.sh`，参数为HEAD subject。脚本失败停止，不手动替换output/重启补救 |
| 5 客户端升级与认证产品验收 | 后端J组合先可用；普通owner/service两种部署模式分别验证；SDK/QQ send/PNG/上游与撤权重试清单 | 不能先让外部部署者跟随B main升级而假定旧后端兼容；外部自动拉取状态UNKNOWN |
| 6 如实结案 | 源码归属和运行验收分别记录；P1 Read Model若仍PARKED，原Gate6仍不通过 | 不以三报告或一次上线宣布全部平台完成；本轮仅contained |

M6限定探针必须覆盖：登记/追加、Reader lease、同Source查询/更新/撤权等待、bridge与compute实际进程树/IO/RSS。已知上限有32MiB bridge/u0与64MiB Source object、50k H/2GiB store，历史用例不能证明它们端到端兼容。Hiroba worker执行上限900s也不是并发可用性证明。缺少数值预算就标待决并停，不启动新的大型benchmark或数据库方案。

原生与客户端仍有必要部署/权限差异及历史公式、可见范围、parser、u0 manual成员差异。现有Core profile保存旧行为；统一这些产品语义属于 [D1](remaining-scope.md)，不是此次迁出时静默更改的理由。

证据入口：[handoff](handoff.md)、[审阅与收口意见](Taiko_Domain_Extraction_30h_Review_and_Containment.md)、[Phase6主报告](../phase6-storage-consolidation.md)、[历史repository inventory](../../platform-architecture-audit/repository-inventory.md)、[Source service操作说明](../source-service-operations.md)、[完整实测快照](candidate-state.json)。历史报告的下一步措辞不提供本轮实施授权。
