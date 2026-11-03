# Taiko Application Extraction v2 — Phase 2F-A

日期：2026-10-13。状态：**PHASE_2F_A_OWNERSHIP_CUTOVER_COMPLETE**。
仅完成 `xx是什么歌` 的首次插件归属切换；交付为功能分支候选，未上线。

## 分支与交付

两个仓库均提交并推送 `feature/song-plugin-cutover`，工作树干净，未合并 main：

| 仓库 | 提交 | 隔离工作树 |
| --- | --- | --- |
| [taiko-bot](https://github.com/sigaer/taiko-bot/commit/c5ef2271927cc746bd19691eb8f3fccd8da3d91d) | `c5ef227` | `/var/tmp/taiko-phase2fa-20261013/application` |
| [Sakura_bot](https://github.com/sigaer/Sakura_bot/commit/241a2376c7f6c338b5796efad6b119f47496821b) | `241a237` | `/var/tmp/taiko-phase2fa-20261013/sakura` |

客户端分支直接继承已合并热修补的 main `5f8465f`；Sakura 分支继承 `c8ed8c1`。
纳入 `44aaf656` 的 Application 0.5.0 原包，62 个文件逐一不变。没有整包覆盖客户端
`plugins/taiko.py`，没有回放 Phase 2E-R 其余五类客户端命令改造。
本次只接入歌曲命令所需成果；其余私人命令沿用 main 的既有实现。
客户端 send_authority helper 字节不变、35 处发送前复核调用保留，未增加第二次复核。

新增最小独立发行单元 `packages/nonebot-plugin-taiko-song/`，版本 **0.1.0**；
客户端根包版本 **0.2.10**。插件拥有 matcher、rule、handler、双平台输入、公共查询
Provider、模糊/难度/谱面选择及发送适配，唯一业务用例为
`taiko_application.commands.execute_song`。Application 仍不依赖 NoneBot。

Sakura 仅在既有 `tool.nonebot.plugins` 中声明外部插件，并增加精确安装依赖。
未新增 Sakura 专用 adapter。插件通过 `nonebot.require` 使用两宿主已有的通用
`feature_handler` 功能开关 API；该通用宿主能力仍由宿主提供，未迁移其存储或权限。
插件自身不导入 `plugins.taiko`、Sakura utils 或绝对工作树路径。
中心公共资料目录可显式配置；客户端沿用独立 Taiko 仓已有公开资料与资源就绪入口。

## 验收

全新隔离环境真实安装依赖和 wheel，未使用 `--no-deps` 安装。两端 `pip check` PASS：

| 宿主 | Core | Contract | Application | 外部插件 | 事件对照 |
| --- | --- | --- | --- | --- | --- |
| 中心源码运行布局 | 0.1.1 | 0.1.0 | 0.5.0 | 0.1.0 | **34/34 PASS** |
| 已安装客户端 | 0.1.2 | 0.1.0 | 0.5.0 | 0.1.0 | **34/34 PASS** |

使用真实 NoneBot `load_plugin`、matcher/rule/handler、合成 OneBot 群消息与 QQ 官方
GroupAtMessageCreateEvent；捕获框架执行异常，任意异常均使测试失败。
外部插件先于宿主太鼓插件加载，此时 `plugins.taiko` 和 `plugins.utils` 均未导入。
加载完整宿主太鼓插件后，其原歌曲 matcher 为 **0**，外部插件为 **1**；
`priority=10`、`block=True` 不变。中心其余 **73** 条、客户端其余 **69** 条注册声明
AST 逐项不变；中心其余 **312**、客户端其余 **253** 个函数/类 AST 不变。
这不是其他所有命令的完整业务回归。

覆盖普通曲名、精确 ID、别名、重复曲目、模糊结果、难度前缀/谱面选择、非法命令、
空曲库、Provider 解析错误、两平台入口、功能开关拒绝与外部 Bot mention 排除。
新旧入口完整结构化发送载荷一致；谱面图比较 PNG bytes SHA256、像素 hash、dimensions
和 mode。两端分别与自身旧行为对照，保留中心重复曲目归并、歌曲简介和客户端可见性/
模糊提示/资源行为差异。

参考：Sakura `c8ed8c1`、客户端 main `5f8465f` 的冻结命令入口；旧入口实际执行，
共享函数与旧基线 AST 一致。旧源码在独立 reference namespace 中运行，未作为活动
生产实现保留。公共曲库向量来自既有 Phase 2E-R fixture，另加明确的合成重复曲目和别名。
固定已跟踪 `1007.png` 谱面用于 fixture ID 的路径选择验证，不宣称它是该真实曲目的谱面。
未复制玩家 userdata。

仅替换外围功能开关存储、资源就绪输入和消息发送接口；查询、Core 分组、Application
用例、谱面文件读取及消息构建实际运行。网络、SQL 和生产路径访问均被测试 guard 拒绝。
中心源码布局与通用 runtime_memory/qq_official_runtime 支持来源沿用 Phase 2E-R 冻结来源；
没有把中心源码运行称为中心 wheel 安装。所有 QA 经既有 memory/run_qa.sh 运行。
既有 Application 业务和 renderer 未变，因此未重复全部历史矩阵。

## 移除清单与剩余归属

| 范围 | 本次结果 |
| --- | --- |
| Sakura `what_song` matcher/handler | 删除；活动入口唯一归 Taiko 外部插件 |
| Sakura `_extract_what_song_query`、`_should_handle_what_song` | 删除，外部插件承接 |
| 两宿主 `WHAT_SONG_REGEX`、`WHAT_SONG_OFFICIAL_PATTERNS` | 删除原定义，外部插件维护 |
| 客户端原 `what_song` handler、专属 official extractor/rule | 删除，不保留第二套活动 command usecase |
| Sakura SongPorts/execute_song 专属 imports | 删除 |
| queryMusic、前缀解析 helper、模糊/谱面/平台共享函数 | 其他成绩、估分、别名、位置、难度 ID 等命令仍调用，保留原宿主源码 |
| B30、tinfo、进度、推荐、定数及其他命令入口 | 本次未迁移所有权，仍归各宿主原插件；不是完整 Sakura 去太鼓化 |
| userdata、授权、storage、Writer、SQL、sync、daily/history | 全部保持原边界与实现 |

客户端差量含 62 个原样引入的 Application 文件；不是旧 246 文件迁出候选。
新插件的公共 Provider 和发送适配归独立 Taiko 仓维护；通用功能开关、其他命令仍需
使用的共享函数不被错误计为已迁出或误删。

## 安装顺序与证据

未来采用顺序：先从 Taiko 功能分支准备 Application/插件 wheel 和既有 Core/Contract
依赖源；中心精确安装 Core 0.1.1，客户端精确安装 Core 0.1.2；再配套采用两端源码与
插件列表。中心不要安装 taiko-bot 根包。本任务未将新 wheel 发布到 PyPI，也未执行
生产安装或合并；不能仅删除原 matcher 而不安装外部插件。

- [安装说明与宿主配置](/var/tmp/taiko-phase2fa-20261013/application/packages/nonebot-plugin-taiko-song/README.md)
- [完整验收摘要与 wheel/fixture hash](/var/tmp/taiko-phase2fa-20261013/application/packages/nonebot-plugin-taiko-song/tests/acceptance/summary.json)
- [中心分派](/var/tmp/taiko-phase2fa-20261013/evidence/center-dispatch.json)、[客户端分派](/var/tmp/taiko-phase2fa-20261013/evidence/client-dispatch.json)
- [函数与安全修复范围审计](/var/tmp/taiko-phase2fa-20261013/evidence/scope-audit.json)
- 精确环境锁与上述结果已提交至插件 `tests/acceptance/`。安装日志、冻结参考与 wheel
  保留于 `/var/tmp/taiko-phase2fa-20261013/`。

无未解决验收阻断。Viewer **0.81.12**、生产运行目录和服务未修改；未部署、重启、
合并 main、迁移基础设施或继续 Phase 6。原工作区 WIP 保留。完成后停止。
