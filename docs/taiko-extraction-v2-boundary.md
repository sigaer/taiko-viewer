# Taiko Domain Extraction v2 — Boundary Audit

后续进展：[Phase 2A 段位展示抽取已完成](taiko-extraction-v2-phase2a.md)。下文状态与清单保留为第一阶段审计时的历史快照，后续实施以该报告为准。

日期：2026-10-12（Asia/Shanghai）。本轮范围经用户确认：**只完成第一阶段审计**。

**状态：BOUNDARY_AUDIT_COMPLETE。第二阶段 Application Extraction：NOT_STARTED；第三阶段 Parity Validation：NOT_RUN。**

本 Goal 的最终目标标记仍是 `TAIKO_APPLICATION_EXTRACTION_PHASE1_COMPLETE`，本文件不提前授予该标记：尚未建立独立包、迁出应用或证明输出 parity。此处“第一阶段审计”与最终目标标记分开记录，不宣称 `PLATFORM_COMPLETE`、`1.0_READY`，不继续旧 Phase 6。

## 1. 基线、方法与证据边界

- 生产基线：Viewer **0.81.12**，release `777546c943b9ca196c365fffa6d1289eb558a2db`；Core **0.1.1**、Python Contract **0.1.0**、Python **3.11**。依据用户提供且本轮读到的 [P0 恢复报告](/var/tmp/taiko-p0-production-20261012/P0-production-recovery-result.md)。这是既有恢复证据，本轮未重新调用生产接口或检查进程。
- Sakura 源码根 A：`/home/sigaer/git/Sakura_bot`，HEAD `cc66b2207a725489987787bb8d5f785f61c3a352`；其 `taiko/` 为本清单主要来源。13 个已跟踪太鼓 WIP 调用点和 3 个未跟踪 Native reader/测试文件仍存在。源码并不等于当前生产运行树 R=`/home/sigaer/taiko`。
- 文档工作区 C：`/home/sigaer/taiko/taiko-forum`，HEAD `56aa05a6eecfbd163bc4cb2b985dfa66ab7ea696`；其中旧 Viewer 0.82.0 候选不等于生产 0.81.12。现有 `docs/taiko-domain-extraction/status.md` 删除及其他 WIP 原样保留。
- 读取适用 AGENTS、当前 status/diff、关键入口与 imports/函数、既有 containment/remaining-scope/release-matrix；旧文件只作历史线索，其 M1–M8、部署、Writer/存储归并和 Phase 6 计划不继承为本轮任务。
- 文件枚举基于 A 的 `git ls-files --cached --others --exclude-standard -z`，全纳入 `taiko/`、`taiko_backend/`、`taiko_manager/`。再对仓内受版本控制及非忽略文本按 `taiko/太鼓/hiroba/donder/wahlap` 搜索，补充入口与共享依赖。对 Python 只做文本/AST 静态阅读，不 import 项目模块；没有启动 Bot、renderer、SQL、browser 或 HTTP 服务。
- 未读取 `.env`、凭据配置值、userdata、生产数据库或私有备份。忽略的数据与缓存不逐账户列名，按 §7 目录边界给定 owner；这不是对私有文件内容的全量审计。动态插件、未跟踪且被忽略的外置资源/配置、实际部署使用情况仍需将来安装验证。

## 2. Owner 与决策的含义

Owner 是可执行的维护/模块归属，不虚构人员姓名。当前 owner 均为所在源码模块的现有维护边界；表中的目标 owner 明确下一归属。`migrate-later` 仍有当前托管方，并不表示无人负责。

- **migrate-now**：进入将来的第二阶段有限候选集；现在不移动文件。混合文件只迁业务片段，余下代码的 owner 在 §4 明确保留。不能据此整目录复制。
- **migrate-later**：专用应用或资料处理能力，但需要额外闭包/独立产品范围；本 Goal 不实现它们。
- **keep**：宿主 adapter、既有 Core、存储、Writer、数据库、同步基础设施、运维与证据保留在原边界；不得因其是新包依赖就顺带迁移。

未来独立包名固定为 **`taiko_application`**。建议由独立 Taiko 应用源码仓维护（优先核对现有 `/home/sigaer/taiko-bot` 是否可承载独立发行包）；物理仓库选择不是本轮已作出的代码/发布变更。不得放进 Viewer runtime、R 运行目录或 Core，也不得要求 `sys.path` 指向 Sakura 才能 import。独立安装时，Sakura 提供外部端口实现，Application 不反向 import Sakura。

建议仅有 `commands/`（平台无关解析）、`handlers/`（用例）、`services/`（业务编排）、`renderers/`、`resources/`、必要端口类型与包元数据。不新建 storage/database/writer 子系统。

```text
Sakura adapter
  事件注册 / caller 身份 / 权限 / 限流 / 消息发送
       → taiko_application commands → handlers → services / renderers
                                      → 既有 Core / Contract（固定版本）
       → 现有基础设施取得输入、维持授权与 lease、执行已有副作用
```

只读输入端口须传入既有授权范围内的 score/history/catalog、资源、时间及设置；其实现仍属现有基础设施。现有权限证明和 before-send 复核保留，不能靠一个 user_id 取代。Writer 路径保持原实现、原格式、原事务，不迁到新包。

## 3. 主要入口与实际调用关系

| 源入口 | 当前调用链 | 本轮结论 |
| --- | --- | --- |
| `taiko/bot.py` / `bot_core.py` / `bot_gateway.py` | NoneBot、QQ/OneBot、共享 feature_handler、plugin 注册 | keep：宿主；`bot.py` 存在硬编码 Sakura 根路径，新包不得依赖该启动技巧 |
| `taiko/plugins/taiko.py` | 注册命令 → 绑定解析/读权限 → utils/Core → 图片或文字 → platform_adapter | 业务用例可迁；框架/权限/Writer/发送必须拆留 |
| `taiko/plugins/utils/__init__.py` | 进度绘制与业务导出，同时 wildcard import drawinfo/update_user | 不可作为新包入口照搬，避免导入时引入 Writer |
| `taiko/plugins/utils/score_calculator.py` | Core v1 → current/history → 趋势 daily measurement → 图像 | 显示名为“查询”也可能写 daily；必须按函数/依赖切开 |
| `taiko/plugins/utils/taikob_v2.py` | Core v2 + dataset snapshot + B30 renderer + 既有趋势 helper | 迁应用编排，不迁 dataset 后台刷新或历史存储 |
| `taiko/server.py` | song/alias GET、public-score token、cookie/config 更新 | 仅纯 song/alias 组装候选；HTTP 监听、认证与更新 keep |
| `taiko/growth_compute/__main__.py` | CLI/dynamic loader → 评级/推荐 → Growth DTO | 只迁纯业务投影；CLI/worker 和存储 keep，不能回退 P0 包加载修复 |
| `miku_bot/sekai/upload/server.py` → `taiko_login.py` | `/uploadTaikoLogin` → token 校验 → 配置写入 | keep：跨目录 Writer，不能遗漏或随 handler 搬迁 |
| `taiko_backend/` ↔ `taiko_manager/` | Java/Spring 管理 API、SQL mapper、Vue 管理界面 | migrate-later：由 Taiko Web/管理产品负责，未确认停用，不能删除 |

## 4. 混合文件的迁移粒度（优先于文件分类）

以下是第二阶段的边界约束，不是本轮施工。保留部分均有明确 owner。对于含 IO 的 renderer，`migrate-now` 仅指将绘制从既有读取 wrapper 中分离，不能原样拷贝 wrapper。

| 路径/符号族 | migrate-now → Application | keep / 暂缓部分与 owner |
| --- | --- | --- |
| `plugins/taiko.py`（下列相对 `taiko/`） | `_parse_trend_args`、`_parse_playtrend_args`、`_parse_taikob_dim_arg` 等平台无关解析；曲目/定数/物量/位置/别名查询；成绩、推荐、进度、B30/v2、段位/个人卡用例；`_collect_song_metric_matches` 与结果图片构建 | `on_*`/decorators、Bot/Event/Matcher、权限、`_finish_*`、消息媒体与 QQ 重试 → Sakura adapter；绑定/u0/visibility、manual CRUD、token、更新采集、`save_alias_data`、审计写入与 draw-guess 管理 → 原基础设施/宿主，当前 Goal 不改 |
| `plugins/utils/__init__.py` | `render_*progress*`、目标推荐图片、纯查询辅助和 Core 调用 | `update_user` 导出、`_read_progress_userdata`、DB/文件获取 → 现有 IO；新包不 wildcard import 旧聚合模块 |
| `plugins/utils/{drawinfo,b30_render,b30_single,draw_dress,draw_summary,dani_progress,dani_overview,recommend_image,tcloud,cover_summary,const_query}.py` | 图片布局、文本/图形、结果适配；`dani_progress` 解析和 `_derive_song_targets` 等段位目标展示，保持 dynamic-rate 行为 | `read_current_json`、`score_read_view`、history loaders、settings SQL、写文件/目录创建 → 原 IO；资源路径由参数/资源接口传入，不能让 renderer 偷读 userdata |
| `plugins/utils/score_calculator.py` | 已有 Core 计算调用的应用装配、推荐结果处理、持有预备数据的图像绘制 | `load_user_snapshots`、`_build_daily_rating_points_from_view` 与 `archive/needs_measurement/store_measurement` → 原历史/daily owner；公式 → 既有 Core；不能为让迁移成功而改为另一种 daily 算法 |
| `plugins/utils/taikob_v2.py` | `compute_all_v2_from_userdata_records`、既有 Core 聚合调用、B20/维度图像；趋势仅展示部分 | `_load_userdata_payload`、dataset fetch、trend 的 daily 读写 → 原 IO；Core v2 不升级、不重写 |
| `plugins/utils/{score_estimator,score_prediction_support,target_recommend,recommendation_intelligence,progress_catalog,progress_star,chart_availability,duplicate_versions,dojo_score,song_position,song_rating_target,song_title_showcase}.py` | 传入数据后的查询/估分/推荐/段位/称号编排及文字投影 | 文件/catalog/userdata 获取、CLI main 与宿主 clock → 原 IO/adapter；纯公式/身份/排序规则 → 原 Core。读取公开 catalog 的代码也不能强迫新包依赖原 cwd |
| `plugins/utils/song_title_query.py` | 解析、模糊匹配选择、拒绝建议、图片 | 自定义称号 SQL 与 player 读取 → 原 catalog/settings/score provider |
| `plugins/utils/my_don_showcase_sync.py` | 给定 settings/title override 后的渲染编排 | `load_web_mydon_showcase_settings` 等 SQL → 原 settings reader |
| `plugins/utils/annual_report_command.py` | 给定卡片请求端口的业务请求/错误结果；不迁年度生成器 | HTTP transport/认证、`build_report_message`、`handle_annual_report` 中 QQ/OneBot 发送 → adapter；年度聚合包 → migrate-later |
| `server.py` | `normalize_song_id`、`build_alias_map`、`attach_aliases` 的纯查询组装 | `SongDataHandler`、load_config/update_cookie、token API、监听 → 原服务 owner |
| `growth_compute/__main__.py` | `_project`、`_priority`、`compute_growth` 中给定结果后的业务组合 | argparse/stdin/stdout、动态模块加载、Source 读取/锁 → 现有 worker owner；不改生产启动方式 |
| `plugins/utils/native_score_read.py`（WIP） | 无 | 全部 keep：其 `NativeReadRequest.resolve` 会调用 `materialize_merged_bind_userdata`，不能仅凭 reader 名或 docstring 宣称无写入；SQL proof、lease、排队与回包复核都不迁 |
| `plugins/utils/{custom_title,score_line,taikob_v2_data,title_catalog,arcade_map,game_login_qr,twso}.py` | 本轮不列入直接迁移；其他应用通过注入所需结果调用 | migrate-later；建表/写入、自动 rebuild、fallback 发布、凭据和网络/缓存闭包各由现有模块 owner 托管；不为抽取扩大范围 |

## 5. 第二阶段准入与第三阶段 parity 计划（未执行）

1. 冻结具体抽取来源的 HEAD+WIP+P0 修复差量。不得从 A 的 Native/Phase 6 候选整包覆盖生产基线；不能在复制时丢失 P0 的 history_time_policy、包加载与 dynamic-rate 修复。旧生产行为与 A 候选行为不一致时逐项记录，以 0.81.12 对应的已接受行为为产品基准，不重启旧 Goal。
2. 独立包能在非 Sakura cwd 安装/import；不需要加载 NoneBot、访问真实 DB、读取凭据或写 userdata。Sakura adapter 使用包；新包不得反向 import `plugins`、`taiko_store`、宿主源码目录。已有 Core 与 Contract 保留原精确版本，不升级求解依赖。
3. 仅第二阶段 migrate-now 业务片段接入；原宿主仍承担未迁命令与基础设施，不能宣称整个 Sakura 已只剩 adapter。不得留下两套活动公式/renderer 实现；旧输出基准放隔离 fixture/reference 中，不成为长期双实现。
4. Parity 固定同一公开/合成 fixture、时钟、随机种子、catalog、资源与字体、Pillow/matplotlib 版本。禁止复制生产 userdata。旧路径和新路径各运行完整被测用例，不只做 AST 或函数数量检查。

| 必须覆盖 | 同输入比较对象 | 保留的边界证据 |
| --- | --- | --- |
| 查询 | 曲目名称/别名/重复版本、物量、定数分页、位置、无结果/非法参数的文字及字段顺序 | host event → request 解析不变；空值/错误/状态不变 |
| 图片 | 曲目信息、进度、推荐、个人卡等真实 PNG | 在固定依赖下比较尺寸/mode/解码像素 hash；另记编码字节 hash；差异必须定位，不能只凭尺寸 PASS |
| 成绩展示 | 单曲、B30、v2/B20、维度、推荐以及预备趋势点输入 | 数值、排序、精度、皇冠/评级、日期与显示行一致；既有 daily 写入不纳入新包 |
| 段位展示 | 2025 六段及有/无成绩、未知段位、dynamic-rate 输入 | 三曲目标分配/条件/文案和真实段位图片一致，不能只比较占位 PNG |

Writer/存储测试不在本轮。未来 parity 只使用隔离内存/临时 fixture 与禁写 provider；若某查询必须持久化，应测试迁出的纯应用部分并保留旧 IO 调用证据，不能偷偷进行生产变更。运行 QA 必须使用既有 `scripts/memory/run_qa.sh`，并发与运行时间有界；禁止直接执行源码 import 来代替隔离验证。本轮没有运行这些产品测试，因此没有 parity PASS。

## 6. 逐路径清单

下表路径均相对 A。每条都有职责、决策、目标 owner 和理由。规则码的完整理由见本节第一张表；逐路径最后一列引用规则码，不表示省略归属判断。混合路径以 §4 的片段约束优先；静态资产与公开动态 catalog 分开管理。

| 规则码 | 决策 | 目标 owner | 迁移/保留理由 |
| --- | --- | --- | --- |
| APP | migrate-now | Taiko Application | 纯业务编排、输入解释与输出投影；迁入 taiko_application，IO 由宿主注入，公式继续调用既有 Core |
| RENDER | migrate-now | Taiko Application / renderers | 图片布局、绘制与展示属于应用；只迁绘制及展示输入处理，不迁数据读取、同步或写入 |
| MIXED | migrate-now | Taiko Application（业务）＋Sakura adapter（壳）＋现有 Infrastructure（IO） | 仅迁下面拆分表规定的业务片段；整个文件不在可搬迁白名单内 |
| ASSET | migrate-now | Taiko Application / resources | 已跟踪静态展示资源随 renderer 归属迁移；保留字节，不搬私有数据或运行缓存 |
| CORE | keep | 既有 Taiko Core；Sakura 维护当前兼容导出 | 现有纯规则已委托 Core；不再实现、不改公式或版本，未来 Application 直接依赖固定版本 |
| STORE | keep | 现有 Taiko storage / Writer 维护边界 | 存储、持久化、授权事务、数据库或同步基础设施，明确排除于本 Goal |
| HOST | keep | Sakura adapter / 宿主平台 | 框架启动、事件注册、身份权限、消息投递、公共宿主能力保持宿主所有 |
| OPS | keep | 现有 Taiko 运维维护边界 | 启动、部署、回填、迁移、维护和运行环境不属于应用抽取；不执行、不改服务 |
| LATER | migrate-later | Taiko 应用维护边界；暂由 Sakura 中现有模块托管 | 太鼓专用但与外部采集、文件写入或独立产品紧耦合，留待另行限定范围；本轮不搬 |
| ANNUAL | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | 年度报告聚合、reference、缓存、归档为独立依赖闭包；不借此次抽取启动年度项目或改其语义 |
| CATALOG | keep | 现有 Taiko catalog / 数据发布维护边界 | 公开业务数据及索引保留现有单一发布者；Application 通过只读输入使用，不复制活动数据源 |
| TEST | keep | 现有 Taiko 测试维护边界 | 原回归与 fixture 保留为旧行为证据；未来新包补 parity，不重写旧期望值 |
| DOC | keep | 相应 Taiko 模块文档维护边界 | 历史文档、schema、构建声明保留追溯；不把旧 Goal 或旧 Phase 6 当作本轮授权 |
| WEB | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | 独立 Java 后端或管理前端，不是本次 Python 应用抽取；部署状态未核验，不擅删或重写 |

枚举统计：**keep=336**；**migrate-later=264**；**migrate-now=154**；总计 **754** 个路径。统计是文件级分类，不是允许整体搬迁的文件数。

| 路径 | 职责 | 决策 | 目标 owner | 理由 |
| --- | --- | --- | --- | --- |
| `AGENTS.md` | Sakura 全仓工作规范 | keep | 相应 Taiko 模块文档维护边界 | DOC；按 §4/规则表执行 |
| `feature_handler/__init__.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / __init__.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `feature_handler/bot_group_whitelist.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / bot_group_whitelist.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `feature_handler/feature_handler.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / feature_handler.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `feature_handler/feature_switch.json` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / feature_switch.json | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `feature_handler/feature_switch_handler.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / feature_switch_handler.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `feature_handler/tests/test_bootstrap.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / test_bootstrap.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `feature_handler/tests/test_feature_group_keys.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / test_feature_group_keys.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `feature_handler/tests/test_feature_switch_handler.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / test_feature_switch_handler.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `feature_handler_bootstrap.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / feature_handler_bootstrap.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `helper_page/src/data/commandCoverage.ts` | 帮助站的太鼓命令目录/链接/更新说明；继续由帮助站维护 | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `helper_page/src/data/help/otherFeaturesCategory.ts` | 帮助站的太鼓命令目录/链接/更新说明；继续由帮助站维护 | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `helper_page/src/data/help/rhythmGamesCategory.ts` | 帮助站的太鼓命令目录/链接/更新说明；继续由帮助站维护 | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `helper_page/src/data/helpMeta.ts` | 帮助站的太鼓命令目录/链接/更新说明；继续由帮助站维护 | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `helper_page/src/data/homeUpdates.ts` | 帮助站的太鼓命令目录/链接/更新说明；继续由帮助站维护 | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `maimaiDX/command/mai_score.py` | 检索命中 Wahlap 域名，实为舞萌成绩；保留舞萌 owner，不属太鼓迁移 | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `miku-self/self_func/self_test_runtime/user_commands.py` | 宿主自测的太鼓进程/命令分类 | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `miku_bot/docs/render-memory-instrumentation.md` | 跨服务内存观测说明，提及太鼓 | keep | 相应 Taiko 模块文档维护边界 | DOC；按 §4/规则表执行 |
| `miku_bot/plugins/prsk.py` | PJSK 中 Taiko Viewer 链接命令，仅导航 adapter | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `miku_bot/plugins/self_service.py` | 宿主自助服务的太鼓进程分类 | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `miku_bot/runtime_init.py` | 宿主帮助快捷命令注册 | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `miku_bot/sekai/update/worker.py` | PJSK worker 的调试路径命中 taiko；业务仍属 PJSK | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `miku_bot/sekai/upload/server.py` | 混合上传服务中 /uploadTaikoLogin 路由；太鼓凭据写入链保留 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `miku_bot/sekai/upload/taiko_login.py` | 上传太鼓凭据并更新 config 的 Writer | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `miku_bot/tests/test_taiko_login_upload.py` | 跨目录太鼓 token 上传回归 | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `miku_bot/upload/scripts/taiko_login.sgmodule` | 太鼓登录 token 捕获/上传配置 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `miku_bot/upload/scripts/upload_taiko_login.js` | 太鼓登录 token 上传脚本 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `nonebot_plugin_method_calls/__init__.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / __init__.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `nonebot_plugin_method_calls/cleanup.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / cleanup.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `nonebot_plugin_method_calls/config.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / config.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `nonebot_plugin_method_calls/extractor.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / extractor.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `nonebot_plugin_method_calls/recorder.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / recorder.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `nonebot_plugin_method_calls/store.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / store.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `nonebot_plugin_method_calls/tests/__init__.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / __init__.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `nonebot_plugin_method_calls/tests/test_extractor.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / test_extractor.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `qq_official_runtime/__init__.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / __init__.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `qq_official_runtime/full_permission.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / full_permission.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `qq_official_runtime/menus.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / menus.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `qq_official_runtime/platform.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / platform.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `qq_official_runtime/qq_markdown_media.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / qq_markdown_media.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `qq_official_runtime/storage.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / storage.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `qq_official_runtime/tests/__init__.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / __init__.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `qq_official_runtime/tests/test_full_permission.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / test_full_permission.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `qq_official_runtime/tests/test_qq_markdown_media.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / test_qq_markdown_media.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `runtime_memory/.gitignore` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / .gitignore | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `runtime_memory/README.md` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / README.md | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `runtime_memory/__init__.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / __init__.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `runtime_memory/_build_sqlite.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / _build_sqlite.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `runtime_memory/cache.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / cache.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `runtime_memory/metrics.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / metrics.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `runtime_memory/store.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / store.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `runtime_memory/tests/test_runtime.py` | 太鼓依赖或检索命中的共享功能开关、内存、命令记录或 QQ 平台模块 / test_runtime.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/AGENTS.md` | 太鼓工程文档、构建声明、schema 或已跟踪离线输出 / AGENTS.md | keep | 相应 Taiko 模块文档维护边界 | DOC；按 §4/规则表执行 |
| `taiko/README.md` | 太鼓工程文档、构建声明、schema 或已跟踪离线输出 / README.md | keep | 相应 Taiko 模块文档维护边界 | DOC；按 §4/规则表执行 |
| `taiko/assets/fumens/Futsuu/1007.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Futsuu/1028.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Futsuu/1046.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Futsuu/1091.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Futsuu/1189.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Futsuu/1288.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Futsuu/1289.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Futsuu/1290.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Futsuu/1291.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Futsuu/1372.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Futsuu/1418.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Futsuu/1429.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Futsuu/1440.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Futsuu/390.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Futsuu/601.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Futsuu/606.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Futsuu/719.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Futsuu/725.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Futsuu/847.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Futsuu/903.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Futsuu/904.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Futsuu/930.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/InnerOni/1222.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/InnerOni/1429.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/InnerOni/606.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Kantan/1007.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Kantan/1028.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Kantan/1046.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Kantan/1091.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Kantan/1189.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Kantan/1288.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Kantan/1289.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Kantan/1290.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Kantan/1291.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Kantan/1372.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Kantan/1418.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Kantan/1429.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Kantan/390.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Kantan/601.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Kantan/606.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Kantan/719.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Kantan/725.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Kantan/847.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Kantan/902.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Kantan/903.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Kantan/904.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Kantan/930.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Muzukashii/1007.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Muzukashii/1028.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Muzukashii/1046.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Muzukashii/1091.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Muzukashii/1189.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Muzukashii/1288.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Muzukashii/1289.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Muzukashii/1290.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Muzukashii/1291.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Muzukashii/1372.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Muzukashii/1418.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Muzukashii/1429.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Muzukashii/390.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Muzukashii/601.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Muzukashii/606.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Muzukashii/719.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Muzukashii/725.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Muzukashii/847.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Muzukashii/903.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Muzukashii/904.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Muzukashii/930.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Oni/1007.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Oni/1028.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Oni/1091.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Oni/1189.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Oni/1288.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Oni/1289.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Oni/1290.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Oni/1291.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Oni/1372.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Oni/1429.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Oni/390.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Oni/606.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Oni/719.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Oni/903.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Oni/904.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/fumens/Oni/930.png` | 展示素材 / fumens | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/icons/b30_dims/accuracy_power.png` | 展示素材 / icons | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/icons/b30_dims/accuracy_power.svg` | 展示素材 / icons | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/icons/b30_dims/big_song.png` | 展示素材 / icons | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/icons/b30_dims/big_song.svg` | 展示素材 / icons | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/icons/b30_dims/complex_proc.png` | 展示素材 / icons | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/icons/b30_dims/complex_proc.svg` | 展示素材 / icons | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/icons/b30_dims/overall_rating.png` | 展示素材 / icons | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/icons/b30_dims/overall_rating.svg` | 展示素材 / icons | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/icons/b30_dims/rhythm.png` | 展示素材 / icons | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/icons/b30_dims/rhythm.svg` | 展示素材 / icons | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/icons/b30_dims/speed.png` | 展示素材 / icons | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/icons/b30_dims/speed.svg` | 展示素材 / icons | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/icons/b30_dims/stamina.png` | 展示素材 / icons | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/icons/b30_dims/stamina.svg` | 展示素材 / icons | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/icons/diff/icon_3.png` | 展示素材 / icons | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/name_plate_custom/name_plate_custom_gold.png` | 展示素材 / name_plate_custom | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/name_plate_custom/name_plate_custom_rainbow.png` | 展示素材 / name_plate_custom | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/name_plate_custom/name_plate_custom_sliver.png` | 展示素材 / name_plate_custom | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/templates/anime-bg.png` | 展示素材 / templates | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/templates/anime-info-bg.png` | 展示素材 / templates | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/templates/classic-bg.png` | 展示素材 / templates | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/templates/classic-info-bg.png` | 展示素材 / templates | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/templates/gamemusic-bg.png` | 展示素材 / templates | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/templates/gamemusic-info-bg.png` | 展示素材 / templates | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/templates/info-bg-final-fix.png` | 展示素材 / templates | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/templates/kid-bg.png` | 展示素材 / templates | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/templates/kid-info-bg.png` | 展示素材 / templates | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/templates/original-bg.png` | 展示素材 / templates | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/templates/original-info-bg.png` | 展示素材 / templates | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/templates/pop-bg.png` | 展示素材 / templates | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/templates/pop-info-bg.png` | 展示素材 / templates | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/templates/variety-bg.png` | 展示素材 / templates | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/templates/variety-info-bg.png` | 展示素材 / templates | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/templates/vocaloid-bg.png` | 展示素材 / templates | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/assets/templates/vocaloid-info-bg.png` | 展示素材 / templates | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/bot.py` | 太鼓框架/运行适配 / bot.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/bot_core.py` | 太鼓框架/运行适配 / bot_core.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/bot_gateway.py` | 太鼓框架/运行适配 / bot_gateway.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/deploy/taiko-capacity-logs.logrotate` | 生产服务/定时器/日志容量声明 / taiko-capacity-logs.logrotate | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/deploy/taiko-journald-capacity.conf` | 生产服务/定时器/日志容量声明 / taiko-journald-capacity.conf | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/deploy/taiko-public-api.service` | 生产服务/定时器/日志容量声明 / taiko-public-api.service | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/deploy/taiko-song-update.service` | 生产服务/定时器/日志容量声明 / taiko-song-update.service | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/deploy/taiko-storage-maintenance.service` | 生产服务/定时器/日志容量声明 / taiko-storage-maintenance.service | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/deploy/taiko-storage-maintenance.timer` | 生产服务/定时器/日志容量声明 / taiko-storage-maintenance.timer | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/deploy/taiko_admin_backup.cron` | 生产服务/定时器/日志容量声明 / taiko_admin_backup.cron | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/docs/chart-config-query.md` | 太鼓工程文档、构建声明、schema 或已跟踪离线输出 / chart-config-query.md | keep | 相应 Taiko 模块文档维护边界 | DOC；按 §4/规则表执行 |
| `taiko/docs/domain-extraction-phase6-publication.md` | 太鼓工程文档、构建声明、schema 或已跟踪离线输出 / domain-extraction-phase6-publication.md | keep | 相应 Taiko 模块文档维护边界 | DOC；按 §4/规则表执行 |
| `taiko/docs/domain-migration-phase3.md` | 太鼓工程文档、构建声明、schema 或已跟踪离线输出 / domain-migration-phase3.md | keep | 相应 Taiko 模块文档维护边界 | DOC；按 §4/规则表执行 |
| `taiko/docs/public-score-token-api.md` | 太鼓工程文档、构建声明、schema 或已跟踪离线输出 / public-score-token-api.md | keep | 相应 Taiko 模块文档维护边界 | DOC；按 §4/规则表执行 |
| `taiko/docs/qq-official-adapter.md` | 太鼓工程文档、构建声明、schema 或已跟踪离线输出 / qq-official-adapter.md | keep | 相应 Taiko 模块文档维护边界 | DOC；按 §4/规则表执行 |
| `taiko/docs/resident-memory-caches.md` | 太鼓工程文档、构建声明、schema 或已跟踪离线输出 / resident-memory-caches.md | keep | 相应 Taiko 模块文档维护边界 | DOC；按 §4/规则表执行 |
| `taiko/docs/鼓众广场绑定教程.png` | 太鼓工程文档、构建声明、schema 或已跟踪离线输出 / 鼓众广场绑定教程.png | keep | 相应 Taiko 模块文档维护边界 | DOC；按 §4/规则表执行 |
| `taiko/feature_handler/__init__.py` | 太鼓框架/运行适配 / __init__.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/feature_handler/bot_group_whitelist.py` | 太鼓框架/运行适配 / bot_group_whitelist.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/feature_handler/feature_handler.py` | 太鼓框架/运行适配 / feature_handler.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/feature_handler/feature_switch_handler.py` | 太鼓框架/运行适配 / feature_switch_handler.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/growth_compute/__init__.py` | 既有 Growth worker 包入口保留 | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/growth_compute/__main__.py` | Growth DTO 计算编排与 CLI/动态加载/Source 读取；只迁 compute/projection 片段 | migrate-now | Taiko Application（业务）＋Sakura adapter（壳）＋现有 Infrastructure（IO） | MIXED；按 §4/规则表执行 |
| `taiko/hdu_upload/README.md` | HDU 上传服务、上传页面与运行声明 / README.md | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/hdu_upload/__init__.py` | HDU 上传服务、上传页面与运行声明 / __init__.py | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/hdu_upload/deploy/hdu-uploader.service` | HDU 上传服务、上传页面与运行声明 / hdu-uploader.service | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/hdu_upload/deploy/hdu.sakura-bot.cn.conf` | HDU 上传服务、上传页面与运行声明 / hdu.sakura-bot.cn.conf | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/hdu_upload/server.py` | HDU 上传服务、上传页面与运行声明 / server.py | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/hdu_upload/static/app.js` | HDU 上传服务、上传页面与运行声明 / app.js | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/hdu_upload/static/favicon.ico` | HDU 上传服务、上传页面与运行声明 / favicon.ico | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/hdu_upload/static/index.html` | HDU 上传服务、上传页面与运行声明 / index.html | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/hdu_upload/static/miku.png` | HDU 上传服务、上传页面与运行声明 / miku.png | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/hdu_upload/static/styles.css` | HDU 上传服务、上传页面与运行声明 / styles.css | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/hdu_upload/tests/test_server.py` | HDU 上传服务、上传页面与运行声明 / test_server.py | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/hdu_upload/wsgi.py` | HDU 上传服务、上传页面与运行声明 / wsgi.py | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/nonebot_plugin_method_calls/__init__.py` | 太鼓框架/运行适配 / __init__.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/nonebot_plugin_method_calls/cleanup.py` | 太鼓框架/运行适配 / cleanup.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/nonebot_plugin_method_calls/config.py` | 太鼓框架/运行适配 / config.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/nonebot_plugin_method_calls/extractor.py` | 太鼓框架/运行适配 / extractor.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/nonebot_plugin_method_calls/recorder.py` | 太鼓框架/运行适配 / recorder.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/nonebot_plugin_method_calls/store.py` | 太鼓框架/运行适配 / store.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/nonebot_plugin_method_calls/taiko_commands.py` | 太鼓框架/运行适配 / taiko_commands.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/nonebot_plugin_method_calls/tests/__init__.py` | 太鼓框架/运行适配 / __init__.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/nonebot_plugin_method_calls/tests/test_extractor.py` | 太鼓框架/运行适配 / test_extractor.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/onebot_runtime/__init__.py` | 太鼓框架/运行适配 / __init__.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/onebot_runtime/adapter.py` | 太鼓框架/运行适配 / adapter.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/onebot_runtime/gateway.py` | 太鼓框架/运行适配 / gateway.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/output/grade_dojo_nijiiro_2025_extracted.json` | 太鼓工程文档、构建声明、schema 或已跟踪离线输出 / grade_dojo_nijiiro_2025_extracted.json | keep | 相应 Taiko 模块文档维护边界 | DOC；按 §4/规则表执行 |
| `taiko/plugins/__init__.py` | 插件初始化/配置导出 | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/plugins/config.py` | 插件配置类型 | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/plugins/taiko.py` | 命令注册、业务 handler、图片、数据库管理、更新与发送混合；按 §4 拆分 | migrate-now | Taiko Application（业务）＋Sakura adapter（壳）＋现有 Infrastructure（IO） | MIXED；按 §4/规则表执行 |
| `taiko/plugins/utils/__init__.py` | 巨型进度 renderer/查询聚合导出，混入 update_user 与读数据 | migrate-now | Taiko Application（业务）＋Sakura adapter（壳）＋现有 Infrastructure（IO） | MIXED；按 §4/规则表执行 |
| `taiko/plugins/utils/account_sync.py` | 账号同步鉴权、请求幂等与 dispatcher 调用 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/admin_audit.py` | 管理审计/备份日志 SQL 写入 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_report_command.py` | 年度卡请求与 QQ/OneBot 发送混合；仅业务请求/结果处理迁 | migrate-now | Taiko Application（业务）＋Sakura adapter（壳）＋现有 Infrastructure（IO） | MIXED；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/__init__.py` | 年度包聚合入口 | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/__main__.py` | 年度 CLI 与输出文件 | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/aggregates.py` | 年度统计与展示数据聚合 | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/archive_fallback.py` | 年度 current archive 回退选择 | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/cache.py` | 规范化快照缓存与锁/落盘 | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/constants.py` | 年度版本/常量 | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/corrections.py` | 人工修正对账 | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/dan_events.py` | 段位事件分级和选择 | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/dan_state.py` | 段位状态读取/解释 | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/data/finaltitle_reference_v1.json` | 年度已跟踪 reference/资源 / finaltitle_reference_v1.json | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/eligibility.py` | 年度曲目/候选资格 | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/events.py` | 历史观测事件重建 | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/finaltitle.py` | 年度最终称号入口 | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/finaltitle_features.py` | 称号特征投影 | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/finaltitle_model.py` | 最终称号模型 | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/finaltitle_reference.py` | reference 读取与构建 | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/finaltitle_reference_cli.py` | reference 离线构建入口 | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/helpers.py` | 年度序列化、时间及文件辅助 | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/model.py` | 年度快照/窗口/epoch 模型 | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/profiling.py` | 年度资源观测 | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/ratings.py` | 年度评级分布 | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/reporting_window.py` | 年度报告窗口 | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/service.py` | 年度结果编排 | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/shadow.py` | 年度 shadow 报告 | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/snapshots.py` | 快照枚举/读取/窗口重建 | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/standalone.py` | 独立运行启动兼容壳 | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/annual_summary/standing_dan.py` | 年度段位强度展示规则 | migrate-later | Taiko 年度报告应用维护边界；暂由现有年度模块托管 | ANNUAL；按 §4/规则表执行 |
| `taiko/plugins/utils/arcade_map.py` | 城市机厅查询，混合远端认证、HTTP 与磁盘缓存 | migrate-later | Taiko 应用维护边界；暂由 Sakura 中现有模块托管 | LATER；按 §4/规则表执行 |
| `taiko/plugins/utils/audio_missing_mover.py` | 缺失音频/TJA 文件移动 | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/plugins/utils/b30_render.py` | B30 排版、雷达/趋势插图、更新差异展示 | migrate-now | Taiko Application / renderers | RENDER；按 §4/规则表执行 |
| `taiko/plugins/utils/b30_single.py` | 单曲 B30 卡片、封面/评级/皇冠绘制 | migrate-now | Taiko Application / renderers | RENDER；按 §4/规则表执行 |
| `taiko/plugins/utils/bot_binding_authority.py` | 原生绑定身份与权限校验 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/bot_binding_metadata.py` | 绑定 metadata 读取 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/bot_binding_mutation.py` | 绑定切换/删除等事务 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/bot_qq_migration.py` | QQ 迁移验证码及多身份事务 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/branch_audio_manifest.py` | 分支音频分析与 manifest 写入 | migrate-later | Taiko 应用维护边界；暂由 Sakura 中现有模块托管 | LATER；按 §4/规则表执行 |
| `taiko/plugins/utils/build_achievement_bg.py` | 成就背景离线生成 | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/plugins/utils/build_nijiiro_history_simple.py` | 历史段位课题抓取生成 | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/plugins/utils/chart_availability.py` | 从公开 catalog 取得在架谱面，调用 Core 可用性规则 | migrate-now | Taiko Application | APP；按 §4/规则表执行 |
| `taiko/plugins/utils/chart_roll_metadata.py` | Core 谱面连打修正导出 | keep | 既有 Taiko Core；Sakura 维护当前兼容导出 | CORE；按 §4/规则表执行 |
| `taiko/plugins/utils/const_query.py` | 定数查询、分页与图片 | migrate-now | Taiko Application / renderers | RENDER；按 §4/规则表执行 |
| `taiko/plugins/utils/cover_summary.py` | 封面进度展示 | migrate-now | Taiko Application / renderers | RENDER；按 §4/规则表执行 |
| `taiko/plugins/utils/custom_title.py` | 称号解析/展示与自定义称号建表/创建事务混合 | migrate-later | Taiko 应用维护边界；暂由 Sakura 中现有模块托管 | LATER；按 §4/规则表执行 |
| `taiko/plugins/utils/daily_ability.py` | daily archive/measurement 持久化 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/dani_overview.py` | 段位课题总览图 | migrate-now | Taiko Application / renderers | RENDER；按 §4/规则表执行 |
| `taiko/plugins/utils/dani_progress.py` | 段位请求解析、目标分配和进度图片；用户读取留宿主 | migrate-now | Taiko Application / renderers | RENDER；按 §4/规则表执行 |
| `taiko/plugins/utils/dojo_score.py` | 段位 catalog 适配和 Core 成绩规范化调用 | migrate-now | Taiko Application | APP；按 §4/规则表执行 |
| `taiko/plugins/utils/draw_dress.py` | 玩家、装扮、称号、更新对比图片；历史读取留宿主 | migrate-now | Taiko Application / renderers | RENDER；按 §4/规则表执行 |
| `taiko/plugins/utils/draw_summary.py` | 2025 总结图片；含 import 时 mkdir 与动态加载，不能原样导入新包 | migrate-now | Taiko Application / renderers | RENDER；按 §4/规则表执行 |
| `taiko/plugins/utils/drawinfo.py` | 歌曲详情和成绩图片；读取 userdata/catalog 需与绘制分离 | migrate-now | Taiko Application / renderers | RENDER；按 §4/规则表执行 |
| `taiko/plugins/utils/duplicate_versions.py` | 重复曲目 catalog 适配及 Core identity 调用 | migrate-now | Taiko Application | APP；按 §4/规则表执行 |
| `taiko/plugins/utils/ese_audio_sync.py` | 音频/TJA 同步 | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/plugins/utils/evaluation_roll.py` | Core 连打容量/分数导出 | keep | 既有 Taiko Core；Sakura 维护当前兼容导出 | CORE；按 §4/规则表执行 |
| `taiko/plugins/utils/font_fallback.py` | 字体覆盖检测、fallback 文字测量与绘制 | migrate-now | Taiko Application / renderers | RENDER；按 §4/规则表执行 |
| `taiko/plugins/utils/fumen_rename.py` | 谱面文件改名 | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/plugins/utils/game_login_qr.py` | 游戏登录二维码、凭据读取与上游 HTTP | migrate-later | Taiko 应用维护边界；暂由 Sakura 中现有模块托管 | LATER；按 §4/规则表执行 |
| `taiko/plugins/utils/generate_alias.py` | 别名离线维护遗留文件 | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/plugins/utils/grade_dojo_extract.py` | 段位 HTML 提取和输出文件 | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/plugins/utils/hiroba/__init__.py` | Hiroba 同步基础设施包入口 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/hiroba/client.py` | Hiroba HTTP session/client | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/hiroba/cooldown.py` | Hiroba 同步冷却 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/hiroba/credentials.py` | 凭据与 token 存储 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/hiroba/native_binding.py` | 原生 Hiroba 绑定授权事务 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/hiroba/normalize.py` | 带宿主时钟的 Core 成绩规范化调用 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/hiroba/parser.py` | 既有 Core Hiroba HTML parser 导出 | keep | 既有 Taiko Core；Sakura 维护当前兼容导出 | CORE；按 §4/规则表执行 |
| `taiko/plugins/utils/hiroba/private_credentials.py` | 私有凭据访问 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/hiroba/service.py` | 上游凭据读取与登录 client | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/hiroba/sync.py` | 上游同步、进度回调与 save_userdata | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/manual_account.py` | 空白账号/成绩管理的现有 API transport 与认证桥 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/merge_index.py` | 曲目/TJA 对齐 CLI 和索引输出 | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/plugins/utils/merge_json.py` | JSON 数据合并与保存 | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/plugins/utils/merged_bind.py` | u0 合并派生与 materialization | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/my_don_cli.py` | 当前个人卡 CLI 的文件读取与渲染启动壳 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/my_don_showcase_sync.py` | 个人卡设置 SQL 读取和渲染编排；仅后者迁 | migrate-now | Taiko Application（业务）＋Sakura adapter（壳）＋现有 Infrastructure（IO） | MIXED；按 §4/规则表执行 |
| `taiko/plugins/utils/native_score_read.py` | 未提交 Native reader、SQL 绑定证明、lease 与 u0 materialization | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/native_wahlap_update.py` | Wahlap 原生更新授权与发布 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/performance_forecast.py` | Core 成绩预期导出 | keep | 既有 Taiko Core；Sakura 维护当前兼容导出 | CORE；按 §4/规则表执行 |
| `taiko/plugins/utils/progress_catalog.py` | 进度查询目录和 Core 输入装配 | migrate-now | Taiko Application | APP；按 §4/规则表执行 |
| `taiko/plugins/utils/progress_star.py` | 星级进度摘要调用 | migrate-now | Taiko Application | APP；按 §4/规则表执行 |
| `taiko/plugins/utils/public_score_token.py` | 公开成绩 token 签发/撤销/读取 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/recommend_image.py` | 推荐曲目图片 | migrate-now | Taiko Application / renderers | RENDER；按 §4/规则表执行 |
| `taiko/plugins/utils/recommendation_intelligence.py` | 推荐/评级解释 DTO 和 CLI 输出；CLI 读数据留宿主 | migrate-now | Taiko Application | APP；按 §4/规则表执行 |
| `taiko/plugins/utils/score_calculator.py` | Core 调用、推荐、图像及趋势；历史读取/daily 持久化不能迁 | migrate-now | Taiko Application（业务）＋Sakura adapter（壳）＋现有 Infrastructure（IO） | MIXED；按 §4/规则表执行 |
| `taiko/plugins/utils/score_estimator.py` | 成绩估计用例与 Core estimator 输入装配 | migrate-now | Taiko Application | APP；按 §4/规则表执行 |
| `taiko/plugins/utils/score_line.py` | 分数线查询与 dataset 自动重建/落盘混合 | migrate-later | Taiko 应用维护边界；暂由 Sakura 中现有模块托管 | LATER；按 §4/规则表执行 |
| `taiko/plugins/utils/score_prediction_support.py` | 推荐/估分资料装配；userdata IO 留宿主 | migrate-now | Taiko Application | APP；按 §4/规则表执行 |
| `taiko/plugins/utils/score_token_authority.py` | Bot token 操作权限与事务 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/snapshot_history.py` | 历史文件枚举与时间解析 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/song_position.py` | 曲目位置查询和文字输出 | migrate-now | Taiko Application | APP；按 §4/规则表执行 |
| `taiko/plugins/utils/song_rating_target.py` | 评级目标用例和文字输出 | migrate-now | Taiko Application | APP；按 §4/规则表执行 |
| `taiko/plugins/utils/song_title_query.py` | 称号命令解析、匹配与渲染；自定义称号 SQL 查询留宿主 | migrate-now | Taiko Application（业务）＋Sakura adapter（壳）＋现有 Infrastructure（IO） | MIXED；按 §4/规则表执行 |
| `taiko/plugins/utils/song_title_showcase.py` | 官方称号关系解析、候选与展示选择 | migrate-now | Taiko Application | APP；按 §4/规则表执行 |
| `taiko/plugins/utils/song_tja_mapping.py` | TJA 映射读取、远程刷新、原子写入 | migrate-later | Taiko 应用维护边界；暂由 Sakura 中现有模块托管 | LATER；按 §4/规则表执行 |
| `taiko/plugins/utils/song_update_task.py` | 曲库/封面/谱面定时更新发布 | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/plugins/utils/source_mutation.py` | Source 授权写入入口 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/taiko_db.py` | SQL 连接配置与创建 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/taiko_domain_adapter.py` | 既有 Core/Contract 版本检查、catalog identity 和时钟适配 | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/plugins/utils/taiko_update_cooldown.py` | 更新任务限流/宿主并发控制 | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/plugins/utils/taikob_v2.py` | v2 计算用例、B20/维度/趋势展示；dataset 获取和历史 IO 留宿主 | migrate-now | Taiko Application（业务）＋Sakura adapter（壳）＋现有 Infrastructure（IO） | MIXED；按 §4/规则表执行 |
| `taiko/plugins/utils/taikob_v2_data.py` | v2 dataset 拉取、后台刷新与 fallback 文件发布 | migrate-later | Taiko 应用维护边界；暂由 Sakura 中现有模块托管 | LATER；按 §4/规则表执行 |
| `taiko/plugins/utils/target_recommend.py` | 目标推荐用例、用户画像输入装配 | migrate-now | Taiko Application | APP；按 §4/规则表执行 |
| `taiko/plugins/utils/target_score_core.py` | Core 目标分数规则导出 | keep | 既有 Taiko Core；Sakura 维护当前兼容导出 | CORE；按 §4/规则表执行 |
| `taiko/plugins/utils/tcloud.py` | 游玩词云展示；个人卡设置读取不随迁 | migrate-now | Taiko Application / renderers | RENDER；按 §4/规则表执行 |
| `taiko/plugins/utils/title_catalog.py` | 称号目录抓取、刷新及缓存写入 | migrate-later | Taiko 应用维护边界；暂由 Sakura 中现有模块托管 | LATER；按 §4/规则表执行 |
| `taiko/plugins/utils/tja_roll_parser.py` | TJA 文件读取与既有 Core parser 导出 | migrate-later | Taiko 应用维护边界；暂由 Sakura 中现有模块托管 | LATER；按 §4/规则表执行 |
| `taiko/plugins/utils/tja_roll_sync.py` | TJA 连打 metadata 审计及写回 | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/plugins/utils/twso.py` | TWSO 查询及 dataset 更新 | migrate-later | Taiko 应用维护边界；暂由 Sakura 中现有模块托管 | LATER；按 §4/规则表执行 |
| `taiko/plugins/utils/update_db.py` | 数据库更新遗留文件 | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/plugins/utils/update_user.py` | Wahlap 采集及 save_userdata | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/userdata_storage.py` | userdata 保存、合并与 publication Writer | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/viewer_binding_authority.py` | Viewer 绑定权限证明 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/viewer_qq_migration.py` | Viewer QQ 迁移授权桥 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/plugins/utils/viewer_source_authority.py` | Viewer Source 授权校验 | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/pyproject.toml` | 太鼓工程文档、构建声明、schema 或已跟踪离线输出 / pyproject.toml | keep | 相应 Taiko 模块文档维护边界 | DOC；按 §4/规则表执行 |
| `taiko/requirements-domain.txt` | 太鼓工程文档、构建声明、schema 或已跟踪离线输出 / requirements-domain.txt | keep | 相应 Taiko 模块文档维护边界 | DOC；按 §4/规则表执行 |
| `taiko/schemas/annual-summary-v4.schema.json` | 太鼓工程文档、构建声明、schema 或已跟踪离线输出 / annual-summary-v4.schema.json | keep | 相应 Taiko 模块文档维护边界 | DOC；按 §4/规则表执行 |
| `taiko/scripts/account_sync_cli.py` | 既有 CLI/运维入口 / account_sync_cli.py | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/scripts/audit_annual_reporting_window.py` | 既有 CLI/运维入口 / audit_annual_reporting_window.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/scripts/backfill_daily_ability.py` | 既有 CLI/运维入口 / backfill_daily_ability.py | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/scripts/clear_nb_inherited_proxy_env.sh` | 既有 CLI/运维入口 / clear_nb_inherited_proxy_env.sh | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/scripts/hiroba_credential_cli.py` | 既有 CLI/运维入口 / hiroba_credential_cli.py | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/scripts/merged_read_cli.py` | 既有 CLI/运维入口 / merged_read_cli.py | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/scripts/migrate_multi_bind_to_db.py` | 既有 CLI/运维入口 / migrate_multi_bind_to_db.py | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/scripts/qq_migration_cli.py` | 既有 CLI/运维入口 / qq_migration_cli.py | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/scripts/source_mutation_cli.py` | 既有 CLI/运维入口 / source_mutation_cli.py | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/scripts/start_taiko_gateway_core.sh` | 既有 CLI/运维入口 / start_taiko_gateway_core.sh | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/scripts/storage_maintenance.py` | 既有 CLI/运维入口 / storage_maintenance.py | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/scripts/sync_dispatch_server.py` | 既有 CLI/运维入口 / sync_dispatch_server.py | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/scripts/sync_dispatch_targets.py` | 既有 CLI/运维入口 / sync_dispatch_targets.py | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/scripts/sync_hiroba.py` | 既有 CLI/运维入口 / sync_hiroba.py | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/scripts/taiko_admin_backup.py` | 既有 CLI/运维入口 / taiko_admin_backup.py | keep | 现有 Taiko 运维维护边界 | OPS；按 §4/规则表执行 |
| `taiko/scripts/validate_domain_migration.py` | 既有 CLI/运维入口 / validate_domain_migration.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/server.py` | 曲库/别名 GET 组装和 token/config 写入 HTTP 服务；只迁纯组装 | migrate-now | Taiko Application（业务）＋Sakura adapter（壳）＋现有 Infrastructure（IO） | MIXED；按 §4/规则表执行 |
| `taiko/songs/README.md` | 曲库、段位、别名、评级或音频/TJA 索引 / README.md | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/_index.json` | 曲库、段位、别名、评级或音频/TJA 索引 / _index.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/analyze_result_filtered.json` | 曲库、段位、别名、评级或音频/TJA 索引 / analyze_result_filtered.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/analyze_result_filtered_report.json` | 曲库、段位、别名、评级或音频/TJA 索引 / analyze_result_filtered_report.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/archive_unused/README.md` | 曲库、段位、别名、评级或音频/TJA 索引 / README.md | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/archive_unused/analyze_result.json` | 曲库、段位、别名、评级或音频/TJA 索引 / analyze_result.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/archive_unused/db_data.json` | 曲库、段位、别名、评级或音频/TJA 索引 / db_data.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/archive_unused/rating_structured_with_ids_old.json` | 曲库、段位、别名、评级或音频/TJA 索引 / rating_structured_with_ids_old.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/archive_unused/response_sample.json` | 曲库、段位、别名、评级或音频/TJA 索引 / response_sample.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/archive_unused/song_data_with_roll.json` | 曲库、段位、别名、评级或音频/TJA 索引 / song_data_with_roll.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/archive_unused/song_score_wiki_partial.json` | 曲库、段位、别名、评级或音频/TJA 索引 / song_score_wiki_partial.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/archive_unused/taiko_titles_readable_extract.json` | 曲库、段位、别名、评级或音频/TJA 索引 / taiko_titles_readable_extract.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/archive_unused/twso_cn_data_.json` | 曲库、段位、别名、评级或音频/TJA 索引 / twso_cn_data_.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/archive_unused/twso_data_.json` | 曲库、段位、别名、评级或音频/TJA 索引 / twso_data_.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/branch_audio_manifest.json` | 曲库、段位、别名、评级或音频/TJA 索引 / branch_audio_manifest.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/constants_id_v2.csv` | 曲库、段位、别名、评级或音频/TJA 索引 / constants_id_v2.csv | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/grade_dojo_nijiiro_2025_simple.json` | 曲库、段位、别名、评级或音频/TJA 索引 / grade_dojo_nijiiro_2025_simple.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/grade_dojo_nijiiro_2026_simple.json` | 曲库、段位、别名、评级或音频/TJA 索引 / grade_dojo_nijiiro_2026_simple.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/grade_dojo_nijiiro_history_simple.json` | 曲库、段位、别名、评级或音频/TJA 索引 / grade_dojo_nijiiro_history_simple.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/music_donda_list.json` | 曲库、段位、别名、评级或音频/TJA 索引 / music_donda_list.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/rating_structured_with_ids.json` | 曲库、段位、别名、评级或音频/TJA 索引 / rating_structured_with_ids.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/song_alias.json` | 曲库、段位、别名、评级或音频/TJA 索引 / song_alias.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/song_data.json` | 曲库、段位、别名、评级或音频/TJA 索引 / song_data.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/song_difficulty.json` | 曲库、段位、别名、评级或音频/TJA 索引 / song_difficulty.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/song_id2tjapath.json` | 曲库、段位、别名、评级或音频/TJA 索引 / song_id2tjapath.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/song_score.json` | 曲库、段位、别名、评级或音频/TJA 索引 / song_score.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/taiko_goku_onis.json` | 曲库、段位、别名、评级或音频/TJA 索引 / taiko_goku_onis.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/taiko_song_database.json` | 曲库、段位、别名、评级或音频/TJA 索引 / taiko_song_database.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/tja_note_counts.json` | 曲库、段位、别名、评级或音频/TJA 索引 / tja_note_counts.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/twso_cn_data.json` | 曲库、段位、别名、评级或音频/TJA 索引 / twso_cn_data.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/songs/twso_data.json` | 曲库、段位、别名、评级或音频/TJA 索引 / twso_data.json | keep | 现有 Taiko catalog / 数据发布维护边界 | CATALOG；按 §4/规则表执行 |
| `taiko/taiko_runtime/__init__.py` | 太鼓框架/运行适配 / __init__.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/taiko_runtime/memory.py` | 太鼓框架/运行适配 / memory.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/taiko_runtime/platform_adapter.py` | 太鼓框架/运行适配 / platform_adapter.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/taiko_runtime/qq_markdown_media.py` | 太鼓框架/运行适配 / qq_markdown_media.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/taiko_runtime/reserved_commands.py` | 太鼓框架/运行适配 / reserved_commands.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/taiko_runtime/runtime_env.py` | 太鼓框架/运行适配 / runtime_env.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/taiko_runtime/startup_migration.py` | 太鼓框架/运行适配 / startup_migration.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/taiko_runtime_init.py` | 太鼓框架/运行适配 / taiko_runtime_init.py | keep | Sakura adapter / 宿主平台 | HOST；按 §4/规则表执行 |
| `taiko/taiko_store/README.md` | publication/current/history/daily/u0 存储模块 / README.md | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/taiko_store/__init__.py` | publication/current/history/daily/u0 存储模块 / __init__.py | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/taiko_store/backup.py` | publication/current/history/daily/u0 存储模块 / backup.py | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/taiko_store/bridge.py` | publication/current/history/daily/u0 存储模块 / bridge.py | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/taiko_store/daily.py` | publication/current/history/daily/u0 存储模块 / daily.py | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/taiko_store/merged_materialization.py` | publication/current/history/daily/u0 存储模块 / merged_materialization.py | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/taiko_store/merged_read.py` | publication/current/history/daily/u0 存储模块 / merged_read.py | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/taiko_store/publication.py` | publication/current/history/daily/u0 存储模块 / publication.py | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/taiko_store/reader.py` | publication/current/history/daily/u0 存储模块 / reader.py | keep | 现有 Taiko storage / Writer 维护边界 | STORE；按 §4/规则表执行 |
| `taiko/templates/info-bg-fix.png` | 展示素材 / info-bg-fix.png | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/templates/info-bg.png` | 展示素材 / info-bg.png | migrate-now | Taiko Application / resources | ASSET；按 §4/规则表执行 |
| `taiko/tests/account_sync_sql_child.py` | 旧回归或 fixture / account_sync_sql_child.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/conftest.py` | 旧回归或 fixture / conftest.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/fixtures/hiroba_credential_legacy.json` | 旧回归或 fixture / hiroba_credential_legacy.json | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/fixtures/source_proxy_renderer_legacy.json` | 旧回归或 fixture / source_proxy_renderer_legacy.json | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/fixtures/sync_dispatch_runtime_legacy.py` | 旧回归或 fixture / sync_dispatch_runtime_legacy.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/fixtures/sync_dispatch_targets_runtime_legacy.py` | 旧回归或 fixture / sync_dispatch_targets_runtime_legacy.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/hiroba_credential_child.py` | 旧回归或 fixture / hiroba_credential_child.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/native_binding_metadata_sql_child.py` | 旧回归或 fixture / native_binding_metadata_sql_child.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/native_binding_mutation_sql_child.py` | 旧回归或 fixture / native_binding_mutation_sql_child.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/native_hiroba_sql_child.py` | 旧回归或 fixture / native_hiroba_sql_child.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/native_qq_migration_sql_child.py` | 旧回归或 fixture / native_qq_migration_sql_child.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/native_score_read_sql_child.py` | 旧回归或 fixture / native_score_read_sql_child.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/native_wahlap_sql_child.py` | 旧回归或 fixture / native_wahlap_sql_child.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/qq_migration_private_fixture.py` | 旧回归或 fixture / qq_migration_private_fixture.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/source_mutation_sql_child.py` | 旧回归或 fixture / source_mutation_sql_child.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_annual_archive_fallback.py` | 旧回归或 fixture / test_annual_archive_fallback.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_annual_manual_corrections.py` | 旧回归或 fixture / test_annual_manual_corrections.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_annual_normalized_cache.py` | 旧回归或 fixture / test_annual_normalized_cache.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_annual_report_command.py` | 旧回归或 fixture / test_annual_report_command.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_arcade_map.py` | 旧回归或 fixture / test_arcade_map.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_b30_update_diff.py` | 旧回归或 fixture / test_b30_update_diff.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_bind_auto_update_reply.py` | 旧回归或 fixture / test_bind_auto_update_reply.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_bind_input_rules.py` | 旧回归或 fixture / test_bind_input_rules.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_bind_usage_message.py` | 旧回归或 fixture / test_bind_usage_message.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_city_arcade_forward.py` | 旧回归或 fixture / test_city_arcade_forward.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_count.py` | 旧回归或 fixture / test_count.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_custom_title.py` | 旧回归或 fixture / test_custom_title.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_custom_title_add.py` | 旧回归或 fixture / test_custom_title_add.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_daily_ability.py` | 旧回归或 fixture / test_daily_ability.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_daily_publication.py` | 旧回归或 fixture / test_daily_publication.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_dani_progress.py` | 旧回归或 fixture / test_dani_progress.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_domain_adapter.py` | 旧回归或 fixture / test_domain_adapter.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_drawinfo.py` | 旧回归或 fixture / test_drawinfo.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_duplicate_versions.py` | 旧回归或 fixture / test_duplicate_versions.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_ese_audio_sync.py` | 旧回归或 fixture / test_ese_audio_sync.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_evaluation_roll.py` | 旧回归或 fixture / test_evaluation_roll.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_feature_group_keys.py` | 旧回归或 fixture / test_feature_group_keys.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_feature_switch_handler.py` | 旧回归或 fixture / test_feature_switch_handler.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_game_login_qr.py` | 旧回归或 fixture / test_game_login_qr.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_hiroba_bind_flow.py` | 旧回归或 fixture / test_hiroba_bind_flow.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_hiroba_cooldown.py` | 旧回归或 fixture / test_hiroba_cooldown.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_hiroba_login_cards.py` | 旧回归或 fixture / test_hiroba_login_cards.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_hiroba_parser_crowns.py` | 旧回归或 fixture / test_hiroba_parser_crowns.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_hiroba_profile_and_stats.py` | 旧回归或 fixture / test_hiroba_profile_and_stats.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_hiroba_progress_reporter.py` | 旧回归或 fixture / test_hiroba_progress_reporter.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_hiroba_render_crown_fallback.py` | 旧回归或 fixture / test_hiroba_render_crown_fallback.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_hiroba_service_sync.py` | 旧回归或 fixture / test_hiroba_service_sync.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_hiroba_sync_progress.py` | 旧回归或 fixture / test_hiroba_sync_progress.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_hiroba_transport.py` | 旧回归或 fixture / test_hiroba_transport.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_hiroba_update_mode.py` | 旧回归或 fixture / test_hiroba_update_mode.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_hiroba_update_reply.py` | 旧回归或 fixture / test_hiroba_update_reply.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_memory_caches.py` | 旧回归或 fixture / test_memory_caches.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_merged_bind.py` | 旧回归或 fixture / test_merged_bind.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_merged_materialization.py` | 旧回归或 fixture / test_merged_materialization.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_merged_private_read.py` | 旧回归或 fixture / test_merged_private_read.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_my_don_showcase_layout.py` | 旧回归或 fixture / test_my_don_showcase_layout.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_my_don_showcase_sync.py` | 旧回归或 fixture / test_my_don_showcase_sync.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_native_binding_metadata.py` | 旧回归或 fixture / test_native_binding_metadata.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_native_binding_mutation.py` | 旧回归或 fixture / test_native_binding_mutation.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_native_hiroba_binding.py` | 旧回归或 fixture / test_native_hiroba_binding.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_native_qq_migration.py` | 旧回归或 fixture / test_native_qq_migration.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_native_score_read.py` | 旧回归或 fixture / test_native_score_read.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_native_wahlap_update.py` | 旧回归或 fixture / test_native_wahlap_update.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_official_command_compat.py` | 旧回归或 fixture / test_official_command_compat.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_official_command_gate.py` | 旧回归或 fixture / test_official_command_gate.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_official_update_behavior.py` | 旧回归或 fixture / test_official_update_behavior.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_playtrend.py` | 旧回归或 fixture / test_playtrend.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_private_hiroba_credentials.py` | 旧回归或 fixture / test_private_hiroba_credentials.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_private_message_event.py` | 旧回归或 fixture / test_private_message_event.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_public_score_token_management.py` | 旧回归或 fixture / test_public_score_token_management.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_publication_adapters.py` | 旧回归或 fixture / test_publication_adapters.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_publication_backup.py` | 旧回归或 fixture / test_publication_backup.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_publication_compute.py` | 旧回归或 fixture / test_publication_compute.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_publication_history.py` | 旧回归或 fixture / test_publication_history.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_publication_metadata_bridge.py` | 旧回归或 fixture / test_publication_metadata_bridge.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_publication_proxy_renderer.py` | 旧回归或 fixture / test_publication_proxy_renderer.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_publication_store.py` | 旧回归或 fixture / test_publication_store.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_publication_sync.py` | 旧回归或 fixture / test_publication_sync.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_publication_token_bearer.py` | 旧回归或 fixture / test_publication_token_bearer.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_publication_token_issuer.py` | 旧回归或 fixture / test_publication_token_issuer.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_qq_markdown_media.py` | 旧回归或 fixture / test_qq_markdown_media.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_recommendation_intelligence.py` | 旧回归或 fixture / test_recommendation_intelligence.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_score_calculator.py` | 旧回归或 fixture / test_score_calculator.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_score_estimate_command.py` | 旧回归或 fixture / test_score_estimate_command.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_score_estimator.py` | 旧回归或 fixture / test_score_estimator.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_song_data_pipeline.py` | 旧回归或 fixture / test_song_data_pipeline.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_song_position.py` | 旧回归或 fixture / test_song_position.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_song_rating_target.py` | 旧回归或 fixture / test_song_rating_target.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_song_title_query.py` | 旧回归或 fixture / test_song_title_query.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_song_title_showcase.py` | 旧回归或 fixture / test_song_title_showcase.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_song_tja_mapping.py` | 旧回归或 fixture / test_song_tja_mapping.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_star_progress.py` | 旧回归或 fixture / test_star_progress.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_storage_maintenance.py` | 旧回归或 fixture / test_storage_maintenance.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_taiko_admin_backup.py` | 旧回归或 fixture / test_taiko_admin_backup.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_taiko_image_fallback.py` | 旧回归或 fixture / test_taiko_image_fallback.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_taiko_runtime.py` | 旧回归或 fixture / test_taiko_runtime.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_taiko_update_cooldown.py` | 旧回归或 fixture / test_taiko_update_cooldown.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_taikob_v2.py` | 旧回归或 fixture / test_taikob_v2.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_taikob_v2_data.py` | 旧回归或 fixture / test_taikob_v2_data.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_taikorec_hints.py` | 旧回归或 fixture / test_taikorec_hints.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_target_recommend.py` | 旧回归或 fixture / test_target_recommend.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_tcloud_command.py` | 旧回归或 fixture / test_tcloud_command.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_tja_roll_parser.py` | 旧回归或 fixture / test_tja_roll_parser.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_tja_roll_sync.py` | 旧回归或 fixture / test_tja_roll_sync.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_u0_bind_slots.py` | 旧回归或 fixture / test_u0_bind_slots.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_update_change_highlights.py` | 旧回归或 fixture / test_update_change_highlights.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_update_command_hints.py` | 旧回归或 fixture / test_update_command_hints.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_update_user.py` | 旧回归或 fixture / test_update_user.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_version_summary.py` | 旧回归或 fixture / test_version_summary.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/test_viewer_qq_migration.py` | 旧回归或 fixture / test_viewer_qq_migration.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/token_bearer_fixture.py` | 旧回归或 fixture / token_bearer_fixture.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/token_bearer_sql_child.py` | 旧回归或 fixture / token_bearer_sql_child.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tests/token_issuer_sql_child.py` | 旧回归或 fixture / token_issuer_sql_child.py | keep | 现有 Taiko 测试维护边界 | TEST；按 §4/规则表执行 |
| `taiko/tjaAnalyzer.py` | 谱面文件分析和 Core parser 适配；离线资料处理另定范围 | migrate-later | Taiko 应用维护边界；暂由 Sakura 中现有模块托管 | LATER；按 §4/规则表执行 |
| `taiko/太鼓年度总结实现方案_v2.md` | 太鼓工程文档、构建声明、schema 或已跟踪离线输出 / 太鼓年度总结实现方案_v2.md | keep | 相应 Taiko 模块文档维护边界 | DOC；按 §4/规则表执行 |
| `taiko/太鼓年度总结实现方案_v3.md` | 太鼓工程文档、构建声明、schema 或已跟踪离线输出 / 太鼓年度总结实现方案_v3.md | keep | 相应 Taiko 模块文档维护边界 | DOC；按 §4/规则表执行 |
| `taiko/机器人自测报告模板-2023.xlsx` | 太鼓工程文档、构建声明、schema 或已跟踪离线输出 / 机器人自测报告模板-2023.xlsx | keep | 相应 Taiko 模块文档维护边界 | DOC；按 §4/规则表执行 |
| `taiko_backend/pom.xml` | Java 管理后端 / 构建/启动/测试 | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/sql/db_taiko.sql` | Java 管理后端 / sql | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/sql/tb_music.sql` | Java 管理后端 / sql | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/sql/tb_musicdifficulty.sql` | Java 管理后端 / sql | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/sql/tb_title.sql` | Java 管理后端 / sql | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/src/main/java/com/hyperionml/TaikoBackendApplication.java` | Java 管理后端 / 构建/启动/测试 | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/src/main/java/com/hyperionml/config/TaikoConfig.java` | Java 管理后端 / config | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/src/main/java/com/hyperionml/controller/LoginController.java` | Java 管理后端 / controller | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/src/main/java/com/hyperionml/controller/ManageController.java` | Java 管理后端 / controller | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/src/main/java/com/hyperionml/controller/TaikoController.java` | Java 管理后端 / controller | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/src/main/java/com/hyperionml/interceptor/LoginCheckInterceptor.java` | Java 管理后端 / interceptor | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/src/main/java/com/hyperionml/mapper/TaikoMapper.java` | Java 管理后端 / mapper | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/src/main/java/com/hyperionml/mapper/UserMapper.java` | Java 管理后端 / mapper | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/src/main/java/com/hyperionml/pojo/LevelTagCount.java` | Java 管理后端 / pojo | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/src/main/java/com/hyperionml/pojo/Music.java` | Java 管理后端 / pojo | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/src/main/java/com/hyperionml/pojo/MusicDetail.java` | Java 管理后端 / pojo | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/src/main/java/com/hyperionml/pojo/MusicDifficulty.java` | Java 管理后端 / pojo | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/src/main/java/com/hyperionml/pojo/PageResult.java` | Java 管理后端 / pojo | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/src/main/java/com/hyperionml/pojo/Result.java` | Java 管理后端 / pojo | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/src/main/java/com/hyperionml/pojo/ScoredName.java` | Java 管理后端 / pojo | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/src/main/java/com/hyperionml/pojo/Title.java` | Java 管理后端 / pojo | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/src/main/java/com/hyperionml/pojo/User.java` | Java 管理后端 / pojo | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/src/main/java/com/hyperionml/service/LoginService.java` | Java 管理后端 / service | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/src/main/java/com/hyperionml/service/TaikoService.java` | Java 管理后端 / service | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/src/main/java/com/hyperionml/utils/Entry.java` | Java 管理后端 / utils | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/src/main/java/com/hyperionml/utils/IntegerListJsonTypeHandler.java` | Java 管理后端 / utils | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/src/main/java/com/hyperionml/utils/JwtUtils.java` | Java 管理后端 / utils | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/src/main/java/com/hyperionml/utils/MyUtils.java` | Java 管理后端 / utils | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/src/main/resources/application.yml` | Java 管理后端 / resources | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/src/main/resources/com/hyperionml/mapper/TaikoMapper.xml` | Java 管理后端 / mapper | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_backend/src/test/java/com/hyperionml/TaikoBackendApplicationTests.java` | Java 管理后端 / 构建/启动/测试 | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/.editorconfig` | 管理前端 / .editorconfig | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/.env.development` | 管理前端 / .env.development | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/.env.production` | 管理前端 / .env.production | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/.env.test` | 管理前端 / .env.test | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/.eslintignore` | 管理前端 / .eslintignore | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/.eslintrc.cjs` | 管理前端 / .eslintrc.cjs | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/.eslintrc.json` | 管理前端 / .eslintrc.json | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/.gitignore` | 管理前端 / .gitignore | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/.prettierrc.cjs` | 管理前端 / .prettierrc.cjs | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/.stylelintignore` | 管理前端 / .stylelintignore | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/.stylelintrc.cjs` | 管理前端 / .stylelintrc.cjs | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/LICENSE` | 管理前端 / LICENSE | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/README.md` | 管理前端 / README.md | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/commitlint.config.cjs` | 管理前端 / commitlint.config.cjs | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/index.html` | 管理前端 / index.html | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/lint-staged.config.cjs` | 管理前端 / lint-staged.config.cjs | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/package.json` | 管理前端 / package.json | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/pnpm-lock.yaml` | 管理前端 / pnpm-lock.yaml | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/postcss.config.cjs` | 管理前端 / postcss.config.cjs | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/public/vite.png` | 管理前端 / public/vite.png | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/scripts/preinstall.js` | 管理前端 / scripts/preinstall.js | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/App.vue` | 管理前端 / src/App.vue | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/api/mock/index.ts` | 管理前端 / src/api | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/api/system/dept/index.ts` | 管理前端 / src/api | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/api/system/dict/data/index.ts` | 管理前端 / src/api | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/api/system/dict/data/type.ts` | 管理前端 / src/api | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/api/system/dict/type/index.ts` | 管理前端 / src/api | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/api/system/dict/type/type.ts` | 管理前端 / src/api | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/api/system/login/index.ts` | 管理前端 / src/api | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/api/system/loginlog/index.ts` | 管理前端 / src/api | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/api/system/menu/index.ts` | 管理前端 / src/api | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/api/system/music/index.ts` | 管理前端 / src/api | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/api/system/musicdetail/index.ts` | 管理前端 / src/api | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/api/system/musicdifficulty/index.ts` | 管理前端 / src/api | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/api/system/notice/index.ts` | 管理前端 / src/api | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/api/system/notice/type.ts` | 管理前端 / src/api | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/api/system/operlog/index.ts` | 管理前端 / src/api | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/api/system/post/index.ts` | 管理前端 / src/api | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/api/system/role/index.ts` | 管理前端 / src/api | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/api/system/role/type.ts` | 管理前端 / src/api | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/api/system/user/index.ts` | 管理前端 / src/api | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/api/system/user/type.ts` | 管理前端 / src/api | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/assets/fonts/KoiFont.woff2` | 管理前端 / src/assets | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/assets/icons/koi-menu-left.svg` | 管理前端 / src/assets | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/assets/icons/koi-menu-right.svg` | 管理前端 / src/assets | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/assets/icons/koi-mobile-menu.svg` | 管理前端 / src/assets | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/assets/images/error/403.png` | 管理前端 / src/assets | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/assets/images/error/404.png` | 管理前端 / src/assets | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/assets/images/error/500.png` | 管理前端 / src/assets | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/assets/images/login/bg.png` | 管理前端 / src/assets | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/assets/images/login/waoku.jpg` | 管理前端 / src/assets | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/assets/images/login/wuwu.jpg` | 管理前端 / src/assets | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/assets/images/logo/logo.webp` | 管理前端 / src/assets | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/assets/json/authLogin.json` | 管理前端 / src/assets | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/assets/json/authMenu.json` | 管理前端 / src/assets | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/assets/json/authUser.json` | 管理前端 / src/assets | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/assets/mouse/index.cur` | 管理前端 / src/assets | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/components/KoiCard/Index.vue` | 管理前端 / src/components | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/components/KoiDialog/Index.vue` | 管理前端 / src/components | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/components/KoiDrawer/Index.vue` | 管理前端 / src/components | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/components/KoiExcel/Index.vue` | 管理前端 / src/components | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/components/KoiGlobalIcon/Index.vue` | 管理前端 / src/components | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/components/KoiImage/Index.vue` | 管理前端 / src/components | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/components/KoiPicture/Index.vue` | 管理前端 / src/components | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/components/KoiSelectIcon/Index.vue` | 管理前端 / src/components | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/components/KoiTag/Index.vue` | 管理前端 / src/components | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/components/KoiTagFilter/Index.vue` | 管理前端 / src/components | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/components/KoiToolbar/Index.vue` | 管理前端 / src/components | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/components/KoiUpload/File.vue` | 管理前端 / src/components | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/components/KoiUpload/Image.vue` | 管理前端 / src/components | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/components/KoiUpload/Images.vue` | 管理前端 / src/components | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/components/MobileDrawer/Index.vue` | 管理前端 / src/components | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/components/SvgIcon/Index.vue` | 管理前端 / src/components | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/components/index.ts` | 管理前端 / src/components | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/config/index.ts` | 管理前端 / src/config | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/config/theme.ts` | 管理前端 / src/config | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/directives/index.ts` | 管理前端 / src/directives | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/directives/modules/adaptive.ts` | 管理前端 / src/directives | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/directives/modules/adaptiveTree.ts` | 管理前端 / src/directives | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/directives/modules/auth.ts` | 管理前端 / src/directives | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/directives/modules/copy.ts` | 管理前端 / src/directives | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/directives/modules/debounce.ts` | 管理前端 / src/directives | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/directives/modules/debounceInput.ts` | 管理前端 / src/directives | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/directives/modules/draggable.ts` | 管理前端 / src/directives | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/directives/modules/throttle.ts` | 管理前端 / src/directives | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/directives/modules/throttleInput.ts` | 管理前端 / src/directives | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/directives/modules/waterMarker.ts` | 管理前端 / src/directives | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/hooks/dicts/index.ts` | 管理前端 / src/hooks | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/hooks/screen/index.ts` | 管理前端 / src/hooks | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/languages/index.ts` | 管理前端 / src/languages | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/languages/modules/en.ts` | 管理前端 / src/languages | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/languages/modules/zh.ts` | 管理前端 / src/languages | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/LayoutClassic/index.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/LayoutColumns/index.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/LayoutHorizontal/index.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/LayoutHorizontal/index1.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/LayoutMobile/index.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/LayoutOptimum/index.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/LayoutVertical/index.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/components/Header/components/BreadCrumb.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/components/Header/components/Collapse.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/components/Header/components/Dark.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/components/Header/components/Dimension.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/components/Header/components/FullScreen.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/components/Header/components/Language.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/components/Header/components/Refresh.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/components/Header/components/SearchMenu.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/components/Header/components/ThemeSetting.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/components/Header/components/Toolbar.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/components/Header/components/User.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/components/Header/index.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/components/Logo/index.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/components/Main/components/Maximize.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/components/Main/index.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/components/Menu/AsideSubMenu.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/components/Menu/ColumnSubMenu.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/components/Menu/HorizontalSubMenu.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/components/Tabs/components/TabMenu.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/components/Tabs/index.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/components/ThemeConfig/index.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/layouts/index.vue` | 管理前端 / src/layouts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/main.ts` | 管理前端 / src/main.ts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/routers/index.ts` | 管理前端 / src/routers | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/routers/modules/dynamicRouter.ts` | 管理前端 / src/routers | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/routers/modules/staticRouter.ts` | 管理前端 / src/routers | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/settings.ts` | 管理前端 / src/settings.ts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/stores/index.ts` | 管理前端 / src/stores | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/stores/interface/index.ts` | 管理前端 / src/stores | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/stores/modules/auth-json.ts` | 管理前端 / src/stores | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/stores/modules/auth-mock.ts` | 管理前端 / src/stores | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/stores/modules/auth.ts` | 管理前端 / src/stores | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/stores/modules/global.ts` | 管理前端 / src/stores | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/stores/modules/keepAlive.ts` | 管理前端 / src/stores | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/stores/modules/tabs.ts` | 管理前端 / src/stores | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/stores/modules/user.ts` | 管理前端 / src/stores | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/styles/index.scss` | 管理前端 / src/styles | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/styles/nprogress.scss` | 管理前端 / src/styles | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/styles/reset.scss` | 管理前端 / src/styles | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/styles/transition.scss` | 管理前端 / src/styles | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/styles/variable.scss` | 管理前端 / src/styles | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/utils/axios.ts` | 管理前端 / src/utils | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/utils/errorStatus.ts` | 管理前端 / src/utils | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/utils/filterRoute.ts` | 管理前端 / src/utils | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/utils/index.ts` | 管理前端 / src/utils | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/utils/koi.ts` | 管理前端 / src/utils | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/utils/mittBus.ts` | 管理前端 / src/utils | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/utils/nprogress.ts` | 管理前端 / src/utils | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/utils/random.ts` | 管理前端 / src/utils | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/utils/storage.ts` | 管理前端 / src/utils | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/utils/theme.ts` | 管理前端 / src/utils | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/error/403.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/error/404.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/error/500.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/home/components/KoiCard.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/home/components/KoiLeftChart.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/home/components/KoiRightChart.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/home/components/KoiTimeline1.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/home/components/KoiTimeline2.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/home/index.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/link/gitee/index.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/link/github/index.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/link/iframe/index.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/login/index.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/login/index2.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/menus/menu1.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/menus/menu2.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/module/controls/index.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/module/dialog/index.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/module/drawer/index.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/module/driver/index.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/module/filter/index.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/module/svgIcon/index.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/module/tabs/detail.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/module/tabs/index.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/module/upload/index.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/system/dept/index.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/system/dict/data.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/system/dict/type.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/system/loginlog/index.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/system/menu/index.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/system/music/index.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/system/musicdetail/index.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/system/musicdifficulty/index.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/system/notice/index.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/system/operlog/index.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/system/personage/index.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/system/post/index.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/system/role/index.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/system/user/index.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/views/workbench/index.vue` | 管理前端 / src/views | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/src/vite-env.d.ts` | 管理前端 / src/vite-env.d.ts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/tsconfig.json` | 管理前端 / tsconfig.json | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/tsconfig.node.json` | 管理前端 / tsconfig.node.json | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/unocss.config.ts` | 管理前端 / unocss.config.ts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |
| `taiko_manager/vite.config.ts` | 管理前端 / vite.config.ts | migrate-later | Taiko Web / 管理产品维护边界；暂由 Sakura 原目录托管 | WEB；按 §4/规则表执行 |

## 7. 非源码与外置边界（不读取私有内容）

| 路径/边界 | 职责 | 决策 | owner 与理由 |
| --- | --- | --- | --- | --- |
| A `taiko/data/`，以及被忽略的 `userdata/`、history、daily、配置/凭据、日志与运行缓存 | 运行数据与状态；仅记录边界，不逐账户枚举 | keep | 原 storage/Writer/运维 owner；禁止迁移数据或复制到 Git |
| A `taiko/**/__pycache__/`、虚拟环境、前端 node_modules/build 等生成目录 | 可重建运行/构建产物 | keep | 原构建/运行环境 owner；不是抽取源码，不能作为新包资产 |
| `assets/fonts/`、封面、外部谱面等源码引用但本次 tracked 清单不完整的资源 | 字体/图片/谱面供给 | keep | 现有资源维护方；未来 renderer owner 须列出依赖及可分发范围，不能自动复制整个生产 assets；未宣称独立 PNG 已可复现 |
| R `/home/sigaer/taiko`，尤其 `plugins/utils/history_time_policy.py` 与 P0 三个其他 runtime 文件 | 当前生产运行树与恢复修复 | keep | 现有运行维护方；不以 A HEAD 代替它，不修改、不重启、不覆盖 |
| `/home/sigaer/taiko/releases/p0-0.81.12/taiko-forum` | 已发布 Viewer 制品 | keep | Viewer release owner；无服务变更、无版本 bump/部署 |
| `/home/sigaer/git/sakura-taiko-core` | 既有领域公式与模型 | keep | Taiko Core owner；本 Goal 不修改公式/升级包 |
| C `packages/sakura-taiko-contract/` | 既有 Contract 源码与 Python/JS 版本边界 | keep | Contract owner；工作区 JS 版本与生产 Python pin 不可混同 |
| `/home/sigaer/taiko-bot` | 既有独立客户端/应用候选仓 | keep | Taiko 客户端维护方；作为未来包承载候选，本轮不改该仓、不承诺安装已通过 |

## 8. 审计结论与未完成项

本轮只新增本文档。Sakura 源码与 Writer 未修改，没有部署、重启、数据库连接/迁移、生产数据读写或服务配置修改。文档不影响运行代码，因此不需要版本升级、部署或 Bot 重启。

文档完整性核对通过：754 条路径与枚举清单一一对应，重复/缺失路径及空 owner 均为 0；三类决策均有效。通过 `scripts/memory/run_qa.sh` 执行有界文档检查，exit 0。Sakura 的 Git status 与 tracked diff 指纹前后相同；Viewer 工作区差量仅新增本文档，既有删除/WIP 未改。额外搜索 `.txt/.conf/.html/.xml/.ini/.cfg/.sql/.service/.timer/.example/.properties/.bat/.ps1` 未发现新增跨目录匹配。核对证据：`/var/tmp/taiko-extraction-v2-boundary-20261012/verification.json`。这些是静态文档检查，不是产品 parity 或生产验收。

边界上的重要风险已有 owner：混合模块由 Application/adapter/原基础设施分段负责；旧 Phase 6 Native WIP 留原 owner；缺少的可分发字体/图片由资源维护方负责；年度模块与 Java/管理前端明确 migrate-later，未确认停用的路径不删除。

审计完整性仅针对 §1 定义的源码枚举与外置边界，不将静态调用分析说成生产行为验证。独立 package、Sakura adapter 改造、真实图片 parity 均尚未实施。最终 `TAIKO_APPLICATION_EXTRACTION_PHASE1_COMPLETE` 只能在用户要求的后续 Application Extraction 与四类 parity 完成后再判定。
