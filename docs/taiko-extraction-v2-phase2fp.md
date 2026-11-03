# Phase 2F-P — Public Plugin Candidate Integration

日期：2026-10-13。状态：**PHASE_2F_PUBLIC_CANDIDATE_READY**。

九个公开命令的跨仓候选已冻结。本轮没有修改运行源码、创建新版本、合并 main、发布包、部署或重启。`score_cmd` 独立延期；此标记不代表 Phase 2F-C 全部完成或生产发布批准。

## 精确候选

| 仓库 | 冻结 commit | 已核验继承链 |
| --- | --- | --- |
| Taiko | [abef35b77d120c5eb87fb8ce0f1c1de1be07e354](https://github.com/sigaer/taiko-bot/commit/abef35b77d120c5eb87fb8ce0f1c1de1be07e354) | 安全补丁 main `5f8465f` → F-A `c5ef227` → F-B `091a6ab` → F-C `abef35b` |
| Sakura | [7c94305c974bf16de49f40d71e075530bb6ff011](https://github.com/sigaer/Sakura_bot/commit/7c94305c974bf16de49f40d71e075530bb6ff011) | `c8ed8c1` → F-A `241a237` → F-B `05437bd` → F-C `7c94305` |

两仓功能分支为 `feature/public-catalog-commands-cutover`，工作树干净。本轮不另造源码提交；沿用上述已推送提交。Application 对照 `44aaf65` 的 62 个文件不变，没有合入旧 246 文件候选、Phase 6 或工作区 WIP。候选本来存在的存储实现差异不被视为本轮生产迁移授权。

## 制品与依赖

交付目录：[taiko-phase2fp-20261013](/var/tmp/taiko-phase2fp-20261013)。三个 wheel 原样收集，未重新构建，源码及隔离安装内容逐字节核对通过：

| wheel | SHA256 |
| --- | --- |
| `taiko_application-0.5.0-py3-none-any.whl` | `5f801acea42bc35d8a313721edf9eba6b5274a1b1510aaa5458b5eb297030095` |
| `nonebot_plugin_taiko_song-0.3.0-py3-none-any.whl` | `9e68e7c646f73ba6240ac4d68c364a5d674060488ea016255b3a7dda80dff005` |
| `taiko_bot-0.2.12-py3-none-any.whl` | `23188d68750d565c26478ba5bace7488bd77facd72074c3ce3257edbae299ce3` |

三个制品位于 `wheels/`；`dependencies/` 同时保留既有 Core 0.1.1、Core 0.1.2、Contract 0.1.0 wheel。中心精确锁 Core **0.1.1**，客户端 **0.1.2**，两端 Contract **0.1.0**。完整安装环境逐项对应 [center-lock.txt](/var/tmp/taiko-phase2fp-20261013/center-lock.txt) / [client-lock.txt](/var/tmp/taiko-phase2fp-20261013/client-lock.txt)，两端 `pip check` PASS；不是 `--no-deps` 安装证明。

中心继续源码布局：`CENTER_SOURCE_RUNTIME_PASS / CENTER_WHEEL_NOT_REQUIRED`。另保留 `sakura-source-7c94305.tar`，仅含该提交下的太鼓 Python 源码与安装声明，不含私人数据。公共资源、宿主通用 `feature_handler`、runtime_memory/QQ 支持仍须按已验收来源提供；此源码归档不是可整目录覆盖生产的部署包。通用支持来源及资源 hash 沿用 F-C 汇总。

[SHA256SUMS](/var/tmp/taiko-phase2fp-20261013/SHA256SUMS) 包含制品、源码归档与锁文件。未假设自有 wheel 已发布到 PyPI；该目录也不是全部第三方依赖的离线镜像。

## 所有权与有限核对

九个入口：`what_song`（xx是什么歌）、`alias_query`、`song_where`、`song_position_phrase`、`song_pos_by_id`、`diff_by_id`、`note_count`、`const_query`、`patterns`。

- 两端实际装载的外部插件 matcher 集合恰为上述九项，各 1；原宿主对应入口均为 0。
- 原宿主 `score_cmd` 仍实际注册，外部插件不拥有它；裸 `查分` 不被新定数/配置入口或原模拟计分 matcher 抢占。
- 本轮复用 F-C 的隔离安装环境，验证完整锁、已安装来源和当前候选一致；不是再次宣称新建干净环境。
- 真实 NoneBot、合成 OneBot/QQ 事件与模拟发送：中心 **26 项**、客户端 **26 项 PASS**。覆盖九项正常代表输出、定数/配置开关拒绝与裸 `查分` 排除；另检查原计分 matcher 的裸命令不匹配。文字和真实图片载荷与各宿主冻结参考一致，异常显式捕获。禁止生产路径、SQL、网络及分派期间文件写入。
- 未改变的完整证据沿用 F-B **156/160** 项、F-C **78/80** 项，不重跑 2A–2E 矩阵。中心/客户端原有差异保留。
- 客户端安全 helper 字节及 **35** 处发送前复核调用 AST 与已合并 `5f8465f` 一致；无丢失或重复复核。

Sakura 从 F-A 前 `c8ed8c1` 至本候选，运行源码累计删除 **1,216 行**、新增 2 行，净减少 **1,214 行**：`plugins/taiko.py` 删除 585 行、新增 2 行；utils 聚合删除 41 行；duplicate_versions 删除 26 行；song_position 54 行与 const_query 510 行整模块退出。包括九组 matcher/handler 及无消费者专属 helper；共享查询及其他命令仍有消费者的实现保留。独立 Taiko 仓拥有已迁出的公共入口、Provider、必要绘图和发送适配；这不是整个 Sakura 太鼓源码退出维护。

## 延期事项与生产 P0 差异

`score_cmd` 继续归两端原宿主的计分入口及公共分数配置刷新维护边界。既有 `_load_score_json → rebuild_scoreline_dataset → write_text` 自动刷新链和 matcher/handler 未改，未执行刷新。其迁移需要单独限定后续范围，不阻断本轮九入口交付。

只读核对生产四个 P0 源码文件，hash 均与 0.81.12 恢复报告一致：

| 路径 | Sakura 候选与生产差异 |
| --- | --- |
| `growth_compute/__main__.py` | 候选不含生产显式加载 history_time_policy 的依赖闭包，仍有候选 PublicationError/存储相关路径；不能覆盖 P0 worker 加载修复 |
| `plugins/utils/score_calculator.py` | history/current/daily 数据取得和时间过滤路径不同；候选使用既有 taiko_store 读取，生产保留 P0 有界时间查询及未来记录过滤 |
| `plugins/utils/daily_ability.py` | 候选 PublicationStore/daily_archive 与生产文件锁、原子发布及只读 archive 接口不同 |
| `plugins/utils/history_time_policy.py` | 生产存在，候选缺失 |

逐文件完整 hash、函数差异及源码 diff 见 [manifest](/var/tmp/taiko-phase2fp-20261013/evidence/manifest.json) 和同目录 `p0-*.diff`。这些差异未在本轮修复，也未测试实际生产数据。**后续中心发布必须逐项保留/协调 P0 修复，禁止整目录覆盖生产运行目录。** 本轮候选交付无未解决阻断；生产切换仍有这项独立发布门槛。

## 后续合并与发布顺序

1. 先审阅 Taiko 精确候选，确保 Application 0.5.0、Song Plugin 0.3.0 和匹配宿主制品通过可信制品渠道可取得；自有包使用显式本地 wheel/制品源，按两端锁进行完整依赖解析，不依赖未发布的 PyPI 版本。
2. 再配套审阅/合并 Sakura 删除入口提交。仓库合并与上线分开；中心不要安装客户端根 wheel，也不要只删除入口却缺少外部插件。
3. 发布前单独完成中心 P0 差量协调、公共资源和通用宿主依赖准备；按 `center` / `client` profile 保持既有曲库及权限语义。新插件不能与仍注册旧九入口的宿主同时活动。
4. 获得后续发布授权后，才切换匹配宿主源码与插件配置。本轮不执行该步骤。

本轮证据：[中心分派](/var/tmp/taiko-phase2fp-20261013/evidence/center-dispatch.json)、[客户端分派](/var/tmp/taiko-phase2fp-20261013/evidence/client-dispatch.json)、[冻结清单](/var/tmp/taiko-phase2fp-20261013/evidence/manifest.json)。测试脚本保留在交付目录，全部 QA 经 `scripts/memory/run_qa.sh` 执行。

Viewer **0.81.12**、生产依赖、生产数据及原工作区 WIP 保持不变。没有开始私人命令迁移或处理计分 Writer 阻断。完成后停止。
