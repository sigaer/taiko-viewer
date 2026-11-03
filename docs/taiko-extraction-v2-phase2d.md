# Taiko Application Extraction — Phase 2D

日期：2026-10-13。状态：**PHASE_2D_COMPLETE**。仅完成六类命令业务编排抽取及本阶段验证，完成后停止。未启动下一阶段、Phase 6 或全量 Application 重构。

## 交付与边界

基于 Phase 2A/2B/2C 功能分支，独立子项目 `packages/taiko-application/` 升为 **0.4.0**，新增 `taiko_application.commands`。Core **0.1.1**、Contract **0.1.0** 的依赖与安装版本保持不变；生产 Viewer 基线仍为 **0.81.12**。

| Sakura 命令注册 | Application usecase | 迁入的业务编排 |
| --- | --- | --- |
| `taikob` | `execute_b30` | v1/v2、维度和列表选择，空成绩与错误提示，图片结果选择 |
| `music_info`（`tinfo`） | `execute_score` | 歌曲候选、模糊提示、成绩图片与错误结果 |
| `what_song`（`xx是什么歌`） | `execute_song` | 难度前缀、查歌、候选列表、谱面选择 |
| `const_query` | `execute_constant` | 参数、在架条件、分页、空结果 notice 与图片选择 |
| progress `matcher` | `execute_progress` | 段位、综合/过关定数、星级、命名进度分派 |
| `taikorec` | `execute_recommendation` | 普通/目标推荐、数量限制、错误提示与展示选择 |

每个 usecase 接收 `CommandContext` 和显式 `*Ports`，返回 `CommandResult` 或无输出的 `None`。Context 传递纯文本/正则捕获、宿主已授权的目标、资源设置和延迟计算的上传提示；它不替代权限证明。结果区分 text、image、silent finish、普通/模糊谱面选择，保留原文本回复入口、图片前缀及 bytes/BytesIO 行为。

Sakura 保留 NoneBot decorator、QQ/OneBot event、permission check 和 message sending。四个私有成绩相关 handler 的权限块 AST 完全一致；公开查询的注册/rule 保持原样。B30 与 progress 的 `prepare_*` 在原权限检查位置之前执行，保留原先非法参数与权限拒绝的先后顺序；成绩和推荐仍先检查权限。

Sakura 的 `_deliver_application_command` 使用既有 finish/text/image/fumen helper 发送结果。数据获取、catalog/cache、计算器、renderer、谱面文件获取与缺资源 fallback 均由现有宿主 Provider 实现。Application 不导入 Sakura、NoneBot 或平台对象，没有新增文件读取、SQL、网络或发送实现。宿主 Provider 原有 IO 仍属宿主，本次没有迁移 userdata、storage、Writer、SQL、sync、daily/history，也没有更改 Core 公式或 Contract。

本阶段 score 指 `tinfo`，song query 指 `xx是什么歌`。手工成绩写入、估分、分数线、别名写入和其他命令均不在此次抽取内。

## Command parity

参考是完整冻结的 Phase 2C `taiko.py`，SHA256：`fd4b1c395fbcfc4941e8a14343e3ca9d95d0ddd31c59e2fcfe3fd68b2683e41e`。测试按 decorator 选取并实际执行六个完整旧 handler，另执行新 adapter 与已安装 wheel 的 Application；不以 AST 数量或静态分析替代行为验证。

同一 fixture 下，**旧 command 输出 = adapter + Application 输出**：

| 命令 | 用例数 | 覆盖与结果 |
| --- | --- | --- |
| B30 | 21 | v1/v2、维度、动态参数、空成绩、数据错误、非法参数、权限失败：PASS |
| 成绩 | 11 | 单曲/多候选、空结果、模糊提示、图片、数据错误、权限失败：PASS |
| 查歌 | 9 | 难度前缀、候选、空结果、模糊谱面、非法输入、外部 bot mention：PASS |
| 定数 | 8 | 正常/分页/越界、含下架、空结果、非法定数/页码/参数：PASS |
| 进度 | 17 | 段位、定数、过关、星级、命名进度、空路径、非法页码、权限失败：PASS |
| 推荐 | 20 | 普通/目标、数量上下限、无成绩/不足、非法维度/难度、数据错误、权限失败：PASS |
| **总计** | **86/86** | **PASS** |

其中 50 个文本回复、30 个图片回复、1 个 silent finish、5 个无输出路径。比较精确文字、图片前缀、direct/reply 选择、Provider 名称/参数/调用顺序及输入不变性。图片比较 PNG/JPEG **编码 bytes SHA256、pixel hash、dimensions、mode**；B30 与成绩命令实际执行原 JPEG 转换。

12 组权限/绑定失败覆盖 403、404 和绑定解析异常，均确认 **Application 执行 usecase 调用为 0、数据 Provider 调用为 0**；另覆盖 B30/progress 在权限检查前处理非法参数的原顺序。此处权限依据由 fixture 注入，测试执行真实保留的 handler 分支与 safe binding wrapper，不连接数据库。

真实 wheel 安装到独立 `/var/tmp` target，在非 Sakura cwd 的独立进程直接调用六个 usecase：**6/6 PASS**。该进程不读取 Sakura 源码，阻止宿主/SQL/网络模块依赖；Pillow 插件初始化后禁止所有 command-time 文件 IO。没有安装到生产虚拟环境。

### 验证边界

命令测试中的数据获取、上游计算、渲染与最终消息 transport 是显式 fixture 边界。图片 Provider 输入采用既有合成成绩 PNG 并固定 hash；constant/progress/fumen 的图片在此作为固定载荷使用，不宣称本轮命令矩阵实际生成了对应完整业务图片。比较 Provider 调用确保命令选择、参数和顺序不变，真实 renderer parity 单独运行并记录如下。

没有启动完整 NoneBot、QQ/OneBot 会话或框架 rule 调度，没有进行生产在线验收。权限检查代码和规则未迁出；这份报告不将注入权限结果的测试称为生产鉴权集成测试。

## 回归与范围核对

- Phase 2C 查询：**62/62 PASS**。
- Phase 2B 成绩 renderer：**25/25 PASS**，必需模板缺失错误 **3/3 PASS**。
- Phase 2A 段位：图片 **4/4 PASS**、解析 **6/6 PASS**；2025 六段 dynamic-rate PNG 仍为 `474e31251e977817840770198769d5b63d8ef9228414ffd48629992f2b2fc4df`。
- `taiko.py` 的六个注册/signature 保持不变，四段权限检查不变；其余 **540 个顶层语句** AST 完全一致，包括 decorator/rule、权限 helper、其他命令及 IO。已有 Application 段位/成绩/查询实现未改；回归测试中的包版本断言随 0.4.0 更新。

所有 QA 经既有 `scripts/memory/run_qa.sh`：命令 parity 3.096 秒、最大 RSS 89,336 KiB；独立 usecase 重放 0.317 秒、55,260 KiB；查询回归 0.637 秒、61,280 KiB；成绩回归 45.332 秒、180,416 KiB；段位回归 16.688 秒、101,168 KiB。记录的 memory.events high/max/oom/oom_kill 均为 0，不宣称测得内核未提供的 cgroup memory.peak。

## 提交与证据

两个仓库已提交并推送 `feature/taiko-application-phase2d`，未合并 main：

| 仓库 | 提交 | 独立工作树 |
| --- | --- | --- |
| [taiko-bot](https://github.com/sigaer/taiko-bot/commit/1be8d67d911861bbd6a6a83f70c4ad973476eeea) | `1be8d67` | `/var/tmp/taiko-phase2d-20261013/application` |
| [Sakura_bot](https://github.com/sigaer/Sakura_bot/commit/5b6708405756bfd824c9983369040641f6e6765c) | `5b67084` | `/var/tmp/taiko-phase2d-20261013/sakura` |

- [命令 parity 输出、调用链与全部 hash](/var/tmp/taiko-phase2d-20261013/parity/parity.json)
- [独立安装重放](/var/tmp/taiko-phase2d-20261013/standalone.json)
- [源码范围及依赖审计](/var/tmp/taiko-phase2d-20261013/scope-audit.json)
- [Phase 2C 回归](/var/tmp/taiko-phase2d-20261013/query-regression/parity.json)
- [Phase 2B 回归](/var/tmp/taiko-phase2d-20261013/score-regression/parity.json)
- [Phase 2A 回归](/var/tmp/taiko-phase2d-20261013/dani-regression/parity.json)
- [包说明与复现步骤](/var/tmp/taiko-phase2d-20261013/application/packages/taiko-application/README.md)：测试、fixture 定义、参考源码及图片 hash 已提交。
- wheel：`/var/tmp/taiko-phase2d-20261013/wheels/taiko_application-0.4.0-py3-none-any.whl`，SHA256 `2e6243810ae571ff6438b977fffd9e2de44ca16a57d610656139153141da70fd`。

原工作区 WIP 保留。生产运行树未修改，没有部署、重启、生产包安装或数据库连接；Viewer 无版本变更。当前交付为经验证的功能分支候选，完成后停止，不授予全量 Application 完成、PLATFORM_COMPLETE 或 1.0_READY 标记。
