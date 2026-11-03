# Taiko Application Extraction — Phase 2E

日期：2026-10-13。状态：**PHASE_2E_BLOCKED**。

已交付客户端六类命令接入共享 Application 的功能分支候选；**双宿主整体验收未完成**。中心宿主普通安装失败，中心真实插件分派和完整双端 renderer/provider 集成尚未证明。不授予 `PHASE_2E_DUAL_HOST_INTEGRATION_COMPLETE`。本轮到此停止。

## 交付与依赖

| 项目 | 本轮候选 | 保留的精确依赖 |
| --- | --- | --- |
| 独立 `taiko-application` | 0.5.0；Core 声明由 `==0.1.1` 改为 `>=0.1.1,<=0.1.2` | Python Contract ==0.1.0；Pillow 原下限不变 |
| 中心 Sakura | Phase 2D 六个 adapter 原代码不变；更新 Application 精确 pin | Application ==0.5.0、Core ==0.1.1、Contract ==0.1.0 |
| 分布式 taiko-bot | 0.2.8；六个 handler 委托共享 usecase | Application ==0.5.0、Core ==0.1.2、Contract ==0.1.0 |

`CommandContext.profile` 显式保留 `center` / `client`，未知 profile 拒绝。客户端命令仍由原 QQ/OneBot matcher 注册；Developer API 身份、Token、授权、数据获取、缓存、资源检查与发送都留原宿主。没有给客户端接入中心的本地读取能力。

两组 Core 版本均实际运行了安装后的 Application：段位 dynamic-rate PNG 1 项、成绩 context 4 项、查询 8 项、命令 6 项均通过。该证据支持上述有限兼容声明，不代表两个 Core 所有输入或 profile 等价。中心不升级 Core，客户端不降级；原 `progress-client-20261010`、`recommend-client-20261010` 和 `identity_namespace="pair"` 继续由原客户端 Provider 使用。

## 干净安装与实际装载

使用系统 `/usr/bin/python3`（3.11.4）新建 venv，无 system site packages。先从固定 revision 的源码构建普通 wheel，再在另一组全新环境中使用离线 wheelhouse 和完整 pip resolver 安装。没有 `--no-deps`、editable install、产品源码 `PYTHONPATH` 注入或复用维护者私有环境。

- 中心 Application + Core 0.1.1：完整安装与 `pip check` PASS。运行环境有 4 个项目依赖分发包；query fixture 另显式安装 fuzzywuzzy 0.18.0 作为注入 matcher 的测试依赖。
- 分布式 Bot + Application + Core 0.1.2：87 个分发包完整安装与 `pip check` PASS。真实 `plugins.taiko` 从 venv site-packages 装载，六个 matcher 均有真实 handler；安装后的 adapter 文件与候选源码逐字节相同。
- 最终环境：`/var/tmp/taiko-phase2e-20261013/clean-final-center`、`clean-final-client`。未向生产虚拟环境安装任何包。
- [两端精确依赖及 wheel SHA256](/var/tmp/taiko-phase2e-20261013/application/packages/taiko-application/tests/dual_host/locks/) 已提交。原始 [中心安装报告](/var/tmp/taiko-phase2e-20261013/evidence/clean-install-center.json)、[客户端安装报告](/var/tmp/taiko-phase2e-20261013/evidence/clean-install-client.json) 保留完整解析结果。

**中心完整 Bot 安装未通过。** 对候选 `Sakura/taiko` 普通 `pip install` 在构建 wheel 要求时 exit 1，setuptools 报告 `Multiple top-level packages discovered in a flat-layout`。现有 `taiko/pyproject.toml` 没有可用的显式打包边界。另静态确认 `taiko_runtime/memory.py` 引用 `/opt/python-memory-runtime/1.1.0`；该外置运行依赖未作为普通部署者交付的一部分核验。本轮没有把源码注入或已有 `/opt` 安装当作安装成功。见 [失败日志](/var/tmp/taiko-phase2e-20261013/evidence/install-center-host.log)。

## 六类命令 parity 与跨端差异

冻结原中心完整 handler 行为参考、Phase 2D 中心 adapter、冻结原客户端完整 handler 和新客户端 adapter 分别实际执行。函数体来自固定源码，未重写查询分支或异常处理；宿主数据与 renderer Provider 注入合成输入及固定公开 fixture PNG。新 adapter 实际调用安装后的同一份 `taiko_application.commands`。

| 命令 | 中心旧行为 = 中心 adapter | 客户端旧行为 = 新 adapter |
| --- | --- | --- |
| B30 | 21 PASS | 36 PASS |
| tinfo | 11 PASS | 12 PASS |
| xx是什么歌 | 9 PASS | 9 PASS |
| 定数 | 8 PASS | 9 PASS |
| 进度 | 17 PASS | 21 PASS |
| taikorec | 20 PASS | 24 PASS |
| **合计** | **86/86 PASS** | **111/111 PASS** |

比较文本、候选行顺序、空值、异常类型/消息、Provider 参数及调用顺序、授权失败时停止位置和发送选择。图片比较编码 bytes SHA256、pixel hash、dimensions、mode；B30/tinfo 的真实 JPEG 转换也执行。客户端 10 个原行为会抛出的异常明确列为预期，其余用例不能靠双方共同报错通过。权限失败不进入 Application execute 或数据 Provider。

| 既有差异 | 中心 | 客户端 |
| --- | --- | --- |
| B30 语法和默认 | 可省略数量，默认 v2 | 必须给数量，默认 v1 |
| v2 | 中心现有数量/错误映射 | 仅 20 首；原 TypeError/上游错误继续抛出 |
| B30 空成绩 | 可能继续区分有鬼成绩但未达 75% | 原统一空成绩提示，无额外读取 |
| 模糊匹配 | 仅被拒绝的模糊结果显示建议 | 任意模糊结果沿用客户端建议路径 |
| tinfo renderer | prefer_best_in_group=True | 保留原客户端参数，不新增该覆盖 |
| 定数空结果 | 可再查含下架曲目并提示 | 一次查询与原空结果图片 |
| 目标推荐 | “最多返回20首”，中心上传提示 | “固定返回20首”，客户端原上传提示和错误日志 |
| 数据及绘图 Provider | 中心既有实现 | Developer API/current-view、客户端 Core profile 和资源路径 |

[中心完整结果](/var/tmp/taiko-phase2e-20261013/evidence/center-commands/parity.json)；[客户端完整结果](/var/tmp/taiko-phase2e-20261013/evidence/client-parity.json)。两种 Core 的 [独立命令重放（中心）](/var/tmp/taiko-phase2e-20261013/evidence/compat-command-center.json)、[独立命令重放（客户端环境）](/var/tmp/taiko-phase2e-20261013/evidence/compat-command-client.json) 均为 6/6。

## 真实平台分派与授权边界

实际安装的 NoneBot 插件保留六个真实 matcher/rule/handler，使用 OneBot `PrivateMessageEvent` 经 `nonebot.message.handle_event` 分派，真实宿主发送 helper 最终调用内存模拟 API。六类命令共 **22/22 PASS**，覆盖图片、文本、空结果、非法参数、403/404 和失效身份错误。授权与资料/绘图 Provider 使用公开合成 fixture；其他产品 matcher 不执行。postprocessor 显式捕获 handler 异常，不能把 NoneBot 吞掉的异常算作成功。见 [分派结果与图片 hash](/var/tmp/taiko-phase2e-20261013/evidence/plugin-dispatch.json)。

真实安装的 Developer API reader/cache 使用 `httpx.MockTransport`，先取得合成成绩并进入缓存，再验证 401、403、404、429、500、503、超时、缺 Token、非法身份：**9/9 拒绝通过**。没有回退到磁盘或旧缓存成绩。见 [授权/缓存结果](/var/tmp/taiko-phase2e-20261013/evidence/private-transport.json)。阻止真实 socket、SQL；不运行 Bot 连接生命周期，不接 QQ 或私人 userdata。

这些结果尚不覆盖“最后一次授权读取之后、发送之前撤权”的完整时序，也不代表中心插件真实分派通过。没有为填补证据而改变身份权限语义。

## 去重报告

客户端六个 handler 的业务主体已删除并委托统一 `execute_b30/score/song/constant/progress/recommendation`，未创建 `execute_client_*` 副本。旧实现仅保留为 Git 固定 revision 的离线测试参考，不作为运行 fallback。六类 handler 之外 **399 个顶层 AST 节点不变**，见 [范围检查](/var/tmp/taiko-phase2e-20261013/evidence/scope.json)。

仍活动的客户端 `plugins/utils/{b30_render,b30_single,drawinfo,recommend_image,dani_progress,const_query,progress_catalog,progress_star,score_calculator,target_recommend}.py` 是当前 Provider。其中与早期 Application presentation/query 仍有重叠；移除它们需要客户端 profile、资源及私有读取链的独立 parity。本阶段只替换命令编排，不宣称全部 renderer/query 已去重。六个旧 handler 业务主体没有剩余活动副本；其他产品命令及基础设施不在删除清单。

## 提交、制品、安装顺序与阻断

两个仓库均已提交并推送 `feature/taiko-application-phase2e`，工作树干净，未合并 main：

| 仓库 | 提交 | 内容 |
| --- | --- | --- |
| [taiko-bot](https://github.com/sigaer/taiko-bot/commit/152137a023ef32d710eb8026c7b1cacc5ab9a3f7) | `152137a` | 客户端实际接入、共享 profile、依赖兼容声明、测试、精确锁与去重/安装说明 |
| [Sakura_bot](https://github.com/sigaer/Sakura_bot/commit/c8ed8c11088152ed2190bc422337a293f02fd9f0) | `c8ed8c1` | 中心 Application pin 与安装阻断说明；中心 handler 不变 |

- Application wheel：`/var/tmp/taiko-phase2e-20261013/wheels/taiko_application-0.5.0-py3-none-any.whl`，SHA256 `5f801acea42bc35d8a313721edf9eba6b5274a1b1510aaa5458b5eb297030095`。
- 客户端 wheel：同目录 `taiko_bot-0.2.8-py3-none-any.whl`，SHA256 `f4b8ac32830fc99c94723dd6b58b93f28f170a21e03f80e82e132e816ff75051`。
- [复现步骤、来源 revision 与精确依赖](/var/tmp/taiko-phase2e-20261013/application/packages/taiko-application/tests/dual_host/README.md)。构建制品后仅补充了文档/测试证据，运行代码与最终已测 wheel 一致。

[最终候选审计](/var/tmp/taiko-phase2e-20261013/evidence/final-audit.json) 核对了远端分支提交、两端依赖、已安装源码、wheel hash 和上述测试计数；保留 BLOCKED 标记。

后续顺序：先解决中心宿主可复现安装声明与外置依赖交付，再完成中心真实分派及完整双端 renderer/provider、授权时序验收；通过后审阅并先交付 B 仓 Application wheel，再安装各端精确依赖和 adapter。不得先合并 A 的依赖 pin 到缺少 Application 0.5.0 的环境。当前不执行以上后续工作。

未解决阻断：**中心完整宿主无法按现有声明安装；中心真实插件装载/分派缺少通过证据；完整双端真实 renderer/provider 与上述撤权时序仍未验收。** 固定 PNG Provider 的命令重放不能替代这些验收。

所有安装、构建与 QA 经既有 `scripts/memory/run_qa.sh` 串行隔离执行。最终中心命令检查 3.005 秒、最大 RSS 89,444 KiB，记录的 memory.events high/max/oom/oom_kill 均为 0；不将该单项数据称为整个集成的峰值。没有变更生产运行代码、生产环境安装、部署、重启、storage、Writer、SQL、sync、daily/history、Core 公式、Contract 或 Viewer 0.81.12。未合并旧 246 文件候选，未继续旧 Phase 6、Sakura 宿主移除或基础设施迁移。
