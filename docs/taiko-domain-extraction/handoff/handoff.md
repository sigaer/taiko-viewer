# SAFE STOP & HANDOFF — 2026-10-12

交接结论：**SAFE_HANDOFF_READY**。此结论只表示本任务可安全只读接手；**Gate 6 未通过，迁移未完成，候选未发布，用户最终源码归属目标尚未实现**。

核验窗口：2026-10-12，Asia/Shanghai；WIP 初始指纹时间 16:02:25，复核时间 16:06:26。本轮遵守最新 SAFE STOP 指令，只读核验及新增本文档。此前要求的三个 containment 产物没有生成。本轮没有新增提交、推送、合并、部署、重启、依赖升级、数据库操作或测试/构建，也没有 stash、reset、clean、删除锁或临时目录。

## 1. 暂停证明与接手边界

原持续迁移 Goal 已通过 `update_goal(status="paused")` 暂停；随后 `get_goal` 多次返回 `paused`，最后一次在 16:06 核验。工具返回：

- threadId：`01a12678-16bf-7033-8a73-eb961fe4c593`
- objective：严格按照原文档 Phase 0–6 逐步执行、留档及阶段推送。
- status：`paused`
- createdAt：`1791646767`；updatedAt：`1791790265`。
- tokensUsed：`10126639`；timeUsedSeconds：`109883`。这是工具的累计记录，不是本轮用量。

**不要恢复这个无限推进 Goal。** 新对话必须先明确有限任务及授权；本文不是实施待办的授权。旧 `status.md` 中的 Goal `active` 是历史文字，未在本轮修改，不能覆盖上述工具实测暂停状态。

已读取适用的仓库说明：Viewer `/home/sigaer/taiko/taiko-forum/AGENTS.md`，Sakura `/home/sigaer/git/Sakura_bot/AGENTS.md` 及其 `taiko/AGENTS.md`，B `/home/sigaer/taiko-bot/AGENTS.md`，运行目录 `/home/sigaer/taiko/AGENTS.md`。Core 根目录未发现自己的 AGENTS.md。最新用户的停止边界优先于历史自动提交、推送、部署要求。后续若获准做 QA，仍必须遵守各实际目录的 memory runner、隔离及数据库验证约束。

## 2. 仓库候选状态（实时本地实测）

`origin/main` 仅是本地 tracking ref，不能当作实时远端。SAFE STOP 内未联网核验远端；旧任务停止前曾对 Source 做网络核验，属于历史证据。HEAD、源码版本、依赖版本、运行版本分别记录如下。

| 仓库/角色 | 绝对路径 | 分支及 HEAD | 本地工作区与候选状态 |
|---|---|---|---|
| Sakura_bot / A、Source | `/home/sigaer/git/Sakura_bot` | main；`cc66b2207a725489987787bb8d5f785f61c3a352`；主题 `9.81.28 将daily采集与补算纳入Source发布锁` | 25 条 porcelain：taiko 13 个已跟踪修改、3 个未跟踪；miku 3 个已跟踪修改、6 个未跟踪条目。暂存区为空。Source 9.81.28 历史已提交/推送；Native Reader 为未提交 WIP。 |
| taiko-bot / B | `/home/sigaer/taiko-bot` | main；`fa0983dcc56ca109555a33d90aac0fecca6bdf0d`；主题 `0.2.7 将 QQ 验证迁移收敛到中心事务` | `web.conf` 修改、`v1_test_report.md` 未跟踪；暂存区为空。0.2.7 历史已提交/推送；未查到 B 的独立运行进程。 |
| Viewer / C | `/home/sigaer/taiko/taiko-forum` | main；`56aa05a6eecfbd163bc4cb2b985dfa66ab7ea696`；主题 `0.82.0 留档daily采集与补算Writer收敛验收` | 已跟踪文件无修改、暂存区为空；交接前 23 个未跟踪条目，其中 22 个既有用户条目和 1 个本任务 SQL 测试。本文件加入后增加 1 条。0.82.0 为本地提交准备状态；尚未标准部署/发布。 |
| Core | `/home/sigaer/git/sakura-taiko-core` | main；`0b7319d94b041daafb0a0d32e3ccc95e50da8810`；主题 `0.1.2 统一客户端领域内核并保留可见性与解析策略` | 工作区和暂存区干净；0.1.2 及 tag 历史已推送。实时远端及仓库可见性 UNKNOWN。 |
| Contract | `/home/sigaer/taiko/taiko-forum/packages/sakura-taiko-contract` | **Viewer 内的包，不是独立 Git 仓库**；归属上面的 Viewer HEAD | 24 个已跟踪文件；该子目录未查到未提交变化。Python 0.1.0、JS 0.1.1；不能为它杜撰独立 HEAD 或独立发布状态。 |

本地 tracking：Sakura、B、Core 的 `origin/main` 与各自 HEAD 相同。Viewer `origin/main` 为 `9a77dbcfa6c7ef6e502a1a5ae7ba4efc714e2209`，当前 HEAD 比该本地引用领先 39 个提交。**不据此自动 push、pull、切分支、合并或部署。**

### 注册 worktree

以下为现存 Git worktree 元数据及只读 status；未存在的目录不能当作已核验工作区，不清理注册记录。

| 所属 | 绝对路径 | 分支 / 注册 HEAD | 实测状态 |
|---|---|---|---|
| Sakura | `/home/sigaer/annual-p1-baseline2` | detached；`d554940cfd04bfe94f7bc5c22f1663e0a27269fd` | 路径不存在；实际工作区 UNKNOWN |
| Sakura | `/var/tmp/annual-phase4-baseline-src` | detached；`17ba81027193865b57921c09cbfb6df8ebb916b5` | 路径不存在；实际工作区 UNKNOWN |
| Sakura | `/var/tmp/sakura-bot-phase2-a06dd12` | detached；`a06dd12e6e56077c2afd41837b66c3a4990d94ab` | 路径不存在；实际工作区 UNKNOWN |
| Sakura | `/var/tmp/taiko-p1a-sakura` | feat/p1a-cross-writer；`c5863eb3f96d6aa7fba5cf78c4122dfe646edff1` | 现存、干净 |
| B | `/var/tmp/taiko-p1a-bot` | feat/p1a-cross-writer；`bedfc6fc1745edc17d946eaf1ad31afade5ec0e6` | 现存、干净 |
| Viewer | `/home/sigaer/taiko/taiko-forum-worktrees/annual-poster-community` | feature/annual-poster-community；`db5a71d633343debf5550b0860ecc73d2c1658a3` | 现存、干净 |
| Viewer | `/home/sigaer/taiko/taiko-forum-worktrees/v2-console-data-20261008` | feature/v2-console-data-20261008；`df195d5084724dba65f19c8c1acabee0c469ff0f` | 现存、干净 |
| Viewer | `/var/tmp/taiko-growth-streaming-prototype` | perf/growth-passport-streaming-prototype；`75177fa99fe50253265e539cbe878dcc0c976287` | 现存、干净 |
| Viewer | `/var/tmp/taiko-passport-0801` | feat/passport-usability-recovery；`03347639a764a83914dd136f9bceb93c242edb38` | 现存、干净 |
| Viewer | `/var/tmp/taiko-passport-0802` | feat/passport-narrative-0802；`b8092c40f100ccb01f79101bc1357b1b167b15ca` | 现存、干净 |
| Viewer | `/var/tmp/taiko-viewer-audit-0790/taiko-forum` | detached；`73c9ae72576289e39f8572990c5a97a0c560fa92` | 现存、干净 |

四个主仓库自身 worktree 见上表；Core 仅主 worktree；Contract 没有独立 worktree。旧分支与 worktree 的存在不构成集成授权。

## 3. 源码、安装依赖与生产运行分别记录

### 版本和依赖

| 对象 | 源码/声明版本 | 实测已安装 / 证据性质 | 运行版本边界 |
|---|---|---|---|
| Sakura taiko 源码 | Git 主题 9.81.28；`taiko/pyproject.toml` 项目版本 **0.2.1**；声明 Core[hiroba]==0.1.1、Contract==0.1.0、QQ adapter==1.7.2 | 本地声明实测，Git主题不等于 Python 包版本 | Phase 6 当前 Source HEAD 未复制为运行版本；内存源码 SHA UNKNOWN |
| R `/home/sigaer/taiko` | `pyproject.toml` 0.2.1，声明 Core 0.1.1 / Contract 0.1.0 / QQ 1.7.2 | `.venv/lib/python3.11/site-packages` dist-info：Core 0.1.1、Contract 0.1.0、QQ 1.7.2 | 安装目录元数据实测；不能据此证明各进程已加载的模块内容 |
| B | pyproject 0.2.7；声明 Core[hiroba]==0.1.2、Contract==0.1.0 | B 自己的 `.venv/lib/python3.11/site-packages` 不存在；实际部署环境 UNKNOWN | 未发现 cwd 为 B 的独立进程；全局部署状况 UNKNOWN |
| Viewer | `taiko_viewer/package.json` 0.82.0 prepared；Contract 为 `file:../packages/sakura-taiko-contract` | `node_modules/@sakura-taiko/contract/package.json` 为指向源码包的链接，磁盘版本 0.1.1 | 最后历史上线验收 0.81.11；本轮未发 HTTP 请求，当前公开版本 UNKNOWN |
| Core | pyproject 0.1.2；Contract==0.1.0 | 隔离 QA target `/var/tmp/taiko-domain-extraction/git-pin-installed` 中 0.1.2 | 该 QA target 不是 B 的生产安装证据 |
| Contract | Python 0.1.0；JS 0.1.1 | R 环境及隔离 QA target Python 0.1.0；Viewer Node 链接 0.1.1 | 嵌入不同运行环境，不能当作统一独立部署版本 |

另实测 `/root/.local/lib/python3.11/site-packages` Core 0.1.1 / Contract 0.1.0，`/usr/lib/python3.11/site-packages` QQ adapter 1.7.2。以上只读了包元数据，没有导入业务应用，也没有修改环境。

R 中 `/home/sigaer/taiko/taiko_store` 和 `/home/sigaer/taiko/plugins/utils/native_score_read.py` 不存在，是当前 Phase 6 代码尚未整体激活的直接证据。Phase 3 的历史发布基线是 Source `95d71d5` / 9.80.7，Core 0.1.1，R 同步/重启/adapter smoke 当时 PASS；**这不是本轮实测 R 的精确源码 SHA**。

### 发布与候选

- 已发布的 Phase 3/5 运行现场保留。Phase 5 最后记录为 Viewer 0.81.11，经标准部署脚本发布，记录关联 `eca1b08`。本轮仅确认相应服务仍 active，未重新做在线产品验收。
- Source 9.81.28、B 0.2.7、Core 0.1.2 的提交/推送为旧任务已完成动作；SAFE STOP 不追加任何发布。
- Viewer 0.82.0 本地预备提交与 Source Native Reader WIP **未发布**。不得把提交成功、包安装成功、进程活着或历史 PASS 当成当前候选上线成功。
- 固定 Git pin 安装证据在 `evidence/phase4-validation.json`：Core `0b7319d94b041daafb0a0d32e3ccc95e50da8810`；Contract Python 来源为 Viewer commit `23f89b4f70e5a64ae76c33ac04c6c2d242808df1` 的子目录。不要自动换成 main/HEAD。
- 普通 Developer Token 是 HTTP 能力凭证，不等于 GitHub 私有仓库读取权。Core 最初按私有仓库创建；当前可见性、包分发渠道及普通部署者安装条件本轮 UNKNOWN，不能承诺无需 GitHub 权限即可安装。

## 4. 暂停位置及所有未提交现场

暂停在 **Phase 6 / 6.3e.8.6k Native score Reader WIP**。历史 `status.md` 与 `phase6-storage-consolidation.md` 最近归档到 **6.3e.8.6j daily Writer PASS**；整个 Gate 6 仍 `IN_PROGRESS`。没有将新 SQL 测试或 Native Reader 标为 PASS。

WIP 内容：请求级 Native read Scope、精确 Source 读取及 fresh SQL bind/state 校验、可见性证明、Source SH 持有到回复、u0 成员 SH 与 canonical dependencyHash、2 active / 8 queue / 30s 限制、score 命令及曲名别名护栏、`before_send`（含 QQ proactive retry）与各成绩渲染 Reader 接入。这些描述仅为候选代码范围，不证明实际 SQL/SDK/生产行为正确。

Source 根目录下已跟踪修改：

```text
taiko/plugins/taiko.py
taiko/plugins/utils/__init__.py
taiko/plugins/utils/b30_render.py
taiko/plugins/utils/dani_progress.py
taiko/plugins/utils/draw_dress.py
taiko/plugins/utils/draw_summary.py
taiko/plugins/utils/drawinfo.py
taiko/plugins/utils/recommend_image.py
taiko/plugins/utils/taikob_v2.py
taiko/plugins/utils/tcloud.py
taiko/taiko_runtime/platform_adapter.py
taiko/taiko_store/merged_materialization.py
taiko/taiko_store/reader.py
```

Source 未跟踪候选：

```text
taiko/plugins/utils/native_score_read.py
taiko/tests/native_score_read_sql_child.py
taiko/tests/test_native_score_read.py
```

Viewer 未跟踪候选：`/home/sigaer/taiko/taiko-forum/taiko_viewer/tests/nativeScoreReadSql.test.mjs`。

**新 SQL child 和 Node parent 测试写于最后 QA 之后，尚未执行。** 全部候选保持原状态；不能把前一轮的 408 项结果套到新增测试上。

### 无关用户工作保留

Sakura 已跟踪修改：`miku_bot/plugins/utils/executor_pool.py`、`miku_bot/plugins/utils/render_memory.py`、`miku_bot/runtime_init.py`。未跟踪：`miku_bot/plugins/utils/attribution_hooks.py`、`attribution_publisher.py`、`attribution_schema.py`、`executor_metrics.py`、`miku_bot/scripts/memory_burst/`、`miku_bot/tests/test_memory_burst.py`。未纳入本迁移提交，不删除或 stash。

B：`web.conf`、`v1_test_report.md` 保持原状。

Viewer 既有 22 个未跟踪条目（目录条目不等于文件数量）：

```text
docs/Sakura_Taiko_Viewer_0.74.0_Recent_Growth_Session_Identifiability_Audit.md
docs/Sakura_Taiko_Viewer_0.79.2_Growth_Experience_Closure_Codex_Brief.md
docs/Sakura_Taiko_Viewer_0.80.0_Growth_Product_Voice_Narrative_System.md
docs/Sakura_Taiko_Viewer_0.80.1_Growth_Passport_Temporal_UX_Closure.md
docs/Sakura_Taiko_Viewer_0.80.1_P0_Performance_Remediation_Gate.md
docs/Sakura_Taiko_Viewer_0.80.2_Growth_Passport_Narrative_Visualization_Closure.md
docs/Sakura_Taiko_Viewer_0.80.2_Passport_Final_UX_Acceptance.md
docs/Sakura_Taiko_Viewer_1.0_Release_Readiness_Platform_Stabilization_Audit.md
docs/Sakura_Viewer_0.80.1_P1_Growth_History_Read_Model_Architecture_Audit.md
docs/Sakura_Viewer_0.80.1_Passport_Usability_Recovery_Codex_Brief.md
docs/growth-history-read-model-architecture.md
docs/growth-history-read-model-audit.md
docs/growth-history-read-model-benchmark.md
docs/growth-history-read-model-decision.md
docs/growth-passport-temporal-ux-architecture.md
docs/growth-passport-temporal-ux-audit.md
docs/python-memory-phase4-attribution.md
docs/release-readiness-1.0/
docs/taiko-official-schema.dbml
taiko_viewer/docs/年度报告上线前快速验收执行指令.md
taiko_viewer/docs/年度报告验收续轮：解除环境阻塞，跑通真实业务链路.md
taiko_viewer/tests/growthReadModelPreflight.test.mjs
```

### 候选 SHA-256 指纹

以下 16 个 Source WIP 在 16:02:25 与 16:06:26 两次核验无差量。只是有限窗口内文件稳定的证据，不能证明所有外部编辑器永久停止。Viewer 新 SQL 测试在第二次核验时记录指纹。

```text
b7e9534f4cc749426efac5bda85944c9cc72a038ff5f88d58efb1d178578656e  taiko/plugins/taiko.py
08d889880ee2b4718e7d546c74c11d9fb2bdf0a224d5f04ba0b05f8e6c224ce9  taiko/plugins/utils/__init__.py
75101d4183cf7fd0a49a525f5b4f91a7bf9ceb7d6462b8c02f8a600a5462a11e  taiko/plugins/utils/b30_render.py
74305daf0877276cf79bf021e0a4d03b8c740f35fcdbaa42f8f994c1dbfc1b2e  taiko/plugins/utils/dani_progress.py
b52a10c2c3acd4a8e1e1b84e25d0ecf3841bd50a8639164d288747412a403660  taiko/plugins/utils/draw_dress.py
9c9d694eb82d5a9363073cdbc1ee2b0cf310e2d4d96675e2a526aa015a4592b6  taiko/plugins/utils/draw_summary.py
a3ee2012844dfee8e2949f31c23de2a0bfb161acfac3f89da2fcd893725b97b1  taiko/plugins/utils/drawinfo.py
f81cd5bbf15dbe1548f456da6e3a91ac14fde6309a2dcc0792d4c285de18e8ec  taiko/plugins/utils/recommend_image.py
53108d416458609501db1c560fe7eea5cf3cbd3173c51bb1cfc69ac02e0b2c2c  taiko/plugins/utils/taikob_v2.py
a9a7deae068614f83eadcfc2a5104a1618e0e20c0f2f1d774e3d0616d93631cf  taiko/plugins/utils/tcloud.py
f0be53b8262e7e9ffdc71cd29b87c78dc52e239bd071eb217192505b0640d8d9  taiko/taiko_runtime/platform_adapter.py
b80c2a88e7116e254062578ad13f84ba09cc3e0b2bcc154aeb32d484707e42db  taiko/taiko_store/merged_materialization.py
8520ed38bdcb483fd616b5c9aa7725d8a552d06a30b51cc7c24d9e1c7a763d88  taiko/taiko_store/reader.py
ae8a8f536ffc7d1d0f5ab762d8691feccc88a6f3ed0c008bfeb1360837b38e90  taiko/plugins/utils/native_score_read.py
68b1389506436d7fdcd175bce57f2d9de9629ad8fc2f1b859f64f697ca8798bf  taiko/tests/native_score_read_sql_child.py
1cd212fe1305998d349cf826389155a030c0cb1b2ac183114696959409583cd8  taiko/tests/test_native_score_read.py
3967faeb42e5e4efa64a1c06f7d2f557498b8295e2fb3ff8feeb6d456cabd9e7  Viewer:taiko_viewer/tests/nativeScoreReadSql.test.mjs
```

## 5. 受控任务退出、进程与锁核验

最后已启动的有界 QA 经原 runner 正常结束；原 exec 会话 `55200` 最后 poll 返回 exit 0，已关闭。本轮没有启动新的 QA，没有为结束而强杀任何进程。

只读核验依据：systemd show、running unit 列表、`/proc` 中命令标识/cwd/cgroup、`ss`、过滤后的 `lslocks`。

- running 的 `taiko-qa-*`、`taiko-dev-*`、`taiko-build-*` unit 列表为空。
- 按本任务脚本标识 `phase6-native-read-*`、`native_score_read_sql_child`、`phase6-daily-final-*`、`phase6-native-u0-*` 及 QA cgroup 识别，未发现仍存活的任务进程。
- `/sys/fs/cgroup/development.slice/development-qa.slice/taiko-qa-1791789665-2280361.service` 已不存在。
- 对 `/run/lock/taiko-(memory-qa|maintenance|viewer)` 及 `/var/tmp/.*phase6` 的 held-lock 核验没有命中本任务锁；没有删除锁文件或 journal。
- 未发现本任务临时监听。下面均为原有生产监听，保持原状。

| 原有服务 / 进程 | PID | 启动时间（CST） | 状态 / 监听 |
|---|---|---|---|
| taiko-viewer.service | 1063394 | 2026-10-11 08:37:48 | active/running；127.0.0.1:3100 |
| taiko-sync-receiver.service | 1063408 | 2026-10-11 08:37:48 | active/running；127.0.0.1:3102 |
| taiko-public-api.service | 829173 | 2026-10-11 01:18:42 | active/running；0.0.0.0:9999 |
| R NoneBot nb 父进程 | 829369 | 2026-10-11 01:19:04 | cwd `/home/sigaer/taiko`；argv0 `/usr/bin/python3` |
| R NoneBot bot.py 子进程 | 829379 | 2026-10-11 01:19:06 | cwd R；`.venv/bin/python`；0.0.0.0:37564 |
| taiko-song-update.service | 1550183 | 2026-10-01 13:09:07 | active/running；原有服务，未干预 |

receiver 使用 R `.venv/bin/python`，public API 使用 `/usr/bin/python3`；运行解释器不同，不能将一个安装目录的版本套到所有进程。

主机还存在其他 `codex` 进程（核验时 PID 1829053、1946855、2072413、2074523，cwd `/root`）及编辑器进程。其任务身份、所有工作区写入权限及活动范围 **UNKNOWN**；不是已经证明属于本任务的待清理进程，不终止。已知 Source WIP 在上述两次指纹核验间稳定，未发现本任务持续写入冲突。新对话若观察到同一工作区仍被写入，应停止接手并报告差量。

未识别出本任务正在提交/发布/恢复或需要继续完成的事务；无需额外清理。**生产 SQL pending/outbox/迁移 journal 的实时状态本轮没有查询，记 UNKNOWN**。不得为证明干净删除任何 pending、journal 或锁，不得将“本任务无活跃 runner”扩大为“生产没有任何后台任务”。

## 6. 最近操作与验证证据

### 最后成功

1. 最后 Source 已提交/推送：9.81.28，`cc66b2207a725489987787bb8d5f785f61c3a352`。Viewer 最新本地文档提交：`56aa05a6eecfbd163bc4cb2b985dfa66ab7ea696`。均发生在 SAFE STOP 前；对应验收记录见下列 daily evidence 和 Phase 6 报告。
2. 最后 Native WIP 有界 QA：
   - runner：`/var/tmp/phase6-native-read-first-qa.py`
   - 日志：`/var/tmp/phase6-native-read-first-qa.log`
   - 资源：`/var/tmp/phase6-native-read-first-resource.json`
   - unit：`taiko-qa-1791789665-2280361.service`；journal 时间 2026-10-12 15:21:05–15:21:48，`Deactivated successfully`。查询入口 `journalctl -u taiko-qa-1791789665-2280361.service`，不是新 QA。
   - Source：365 passed / 9 production deselected / 1 warning；publication/backup：40 passed + 25 fault subtests；retained daily trend：3 passed / 160 deselected / 1 warning。合计 **408 tests + 25 subtests**，串行运行。
   - 42.543s；sampled peak 273698816 bytes；child max RSS 321660 KiB；high/max/OOM 0。
   - **范围限制：未覆盖后写入的新 SQL 测试、完整 NoneBot SDK send、实际 PNG 路径或线上行为，不是全量回归，也不是 Gate 6 PASS。**
3. 最近已归档 daily Writer QA：`/var/tmp/phase6-daily-final-qa.py`、`/var/tmp/phase6-daily-final-qa.log`、`/var/tmp/phase6-daily-final-resource.json`。392 checks + 25 subtests；41.078s；sampled peak 267546624 bytes；OOM 0。归档于 `phase6-daily-writer-validation.json`。

### 失败及其边界

- 最近 daily Writer 历史初次 QA：`/var/tmp/phase6-daily-first-qa.log`，333 pass / 1 fail，legacy golden fixture 缺 Source adoption；后续已处理并由 final QA 覆盖。
- 历史公式测试选择失败：`/var/tmp/phase6-daily-real-formula-selection-failure-qa.log`，0 selected / exit 5（名称 `test_real_` 被 offline guard 排除）；后续 synthetic 命名选择及 final QA 已通过。
- 当前 Native WIP 最近上述有界 QA 没有失败。本轮不修复新发现问题，不重新运行任何测试。
- SAFE STOP 初次只读 worktree 检查对已不存在的 `/home/sigaer/annual-p1-baseline2` 使用 cwd，返回 FileNotFoundError；随后只读检查改为存在性判定并标 UNKNOWN。记录在本会话工具输出，没有独立日志；没有 prune/恢复目录，也不涉及业务变更。

临时日志与 QA target 均保留在磁盘 `/var/tmp`，没有清空。资源文件是历史运行证据，不能当作未来任务的预算免检证明。

## 7. 现有状态、inventory、报告入口

下列为既有材料。相对路径全部以 **`/home/sigaer/taiko/taiko-forum/`** 为根；其中内容属于报告生成当时状态，接手需与本交接的实测差量区分。

| 用途 | 路径 |
|---|---|
| 原 Phase 0–6 执行计划 | `docs/Sakura_Taiko_Domain_Extraction_Execution_Plan_v2.md` |
| 原 Program / 最终目标 | `docs/Sakura_Taiko_Domain_Extraction_Program.md` |
| 最新归档迁移 status | `docs/taiko-domain-extraction/status.md`（旧 Goal active 行已过时；Gate 6 仍未 PASS） |
| Phase 6 主报告 | `docs/taiko-domain-extraction/phase6-storage-consolidation.md` |
| Source operations | `docs/taiko-domain-extraction/source-service-operations.md` |
| 当前状态审计 | `docs/taiko-domain-current-state-audit.md` |
| repo inventory | `docs/platform-architecture-audit/repository-inventory.md` |
| 平台历史最终报告 | `docs/platform-architecture-audit/final-status-report.md` |
| 数据流 / 重复逻辑 | `docs/data-flow-map.md`；`docs/duplicate-logic-report.md` |
| 分类清单 | `docs/taiko-domain-extraction/evidence/module-classification.csv`；`tracked-file-classification.csv`（分别历史 1180 modules、1840 tracked paths） |
| Phase 6 归属清单 | `docs/taiko-domain-extraction/evidence/phase6-ownership-audit.json` |
| 最后已归档 daily | `docs/taiko-domain-extraction/evidence/phase6-daily-writer-validation.json` |
| Native u0 / wahlap | `docs/taiko-domain-extraction/evidence/phase6-native-u0-publication-validation.json`；`phase6-native-wahlap-authority-validation.json` |
| B QQ migration | `docs/taiko-domain-extraction/evidence/phase6-client-qq-migration-validation.json` |
| Phase 3 运行同步 / 验证 | `docs/taiko-domain-extraction/evidence/phase3-runtime-sync.json`；`phase3-validation.json` |
| Core/Contract 安装 pin | `docs/taiko-domain-extraction/evidence/phase4-validation.json` |
| Phase 5 发布 / 验证 | `docs/taiko-domain-extraction/evidence/phase5-publication-validation.json`；`phase5-validation.json` |

`/var/tmp/taiko-domain-extraction/` 保留既有隔离安装、wheel 和 QA 产物；不得将这些当作生产运行环境。其他 Phase 6 历史 evidence 保留在同一 evidence 目录。本轮未重新展开全量审计。

## 8. 尚未解决，仅记录

这些是后续候选事项，**本轮无实施授权，也不自动开启下一项**。

| 有限已知事项 / 模块 | 缺失证据或依赖 |
|---|---|
| Source Native Reader WIP（第 4 节列出的文件） | 新 SQL child/parent 未运行；fresh-state、late race、QQ send/proactive callback 等真实路径需后续有界验证；未提交、未发布、未形成 Native Gate PASS |
| R 精确运行源码、Viewer 当前公开版本 | 当前加载 SHA / HTTP 版本 UNKNOWN；不能以 main HEAD 或磁盘 package.json 替代 |
| Source consolidation 激活 / P1a adoption、quiescing | 现有 Phase 6 Writer 准备不等于 R 已激活；生产 schema、service grants、pending/outbox 实时证据 UNKNOWN；旧运行 Writer 仍存在 |
| Read Model 的 C/H、daily/catalog/Goal/measurement 依赖及失效边界 | 未完成相应验证与 cold/warm IO、RSS 和限额验收；此次明确不启动 Read Model、迁移或 benchmark |
| 大对象及容量限额 | 32 MiB bridge/u0 与 64 MiB Source object，以及 50k H / 2 GiB store 的边界仍需统一确认；百万记录验收缺失 |
| 受控运维 / 恢复 / 固定运行依赖 | 发布及恢复 runbook、明确生产 service grants、协同版本与真实线上产品验收尚未完成 |
| B 0.2.7 的候选激活 | 新协议依赖候选 Viewer 0.82.0、私有 Source Scope 与 grants；最后已发布 Viewer 0.81.11 的历史证据不能证明该组合可激活 |
| 普通 Developer Token 部署者包安装 | HTTP Token 不提供私有 GitHub 权限；固定私有 Git pin 的可获取条件及包分发尚无完整部署者证据 |
| 用户最终源码归属 | 大量太鼓专用 commands、render、acquisition、storage、maintenance scripts 仍在 Sakura_bot/taiko；Core 抽取不等于太鼓仓库完整拥有。目标为独立太鼓仓库拥有这些源码及维护责任，Sakura 不再是维护中心；历史 Git 记录无需删除。**EXTRACTION_TARGET_NOT_YET_MET** |
| 外部编辑器/agent 与失踪 worktree | 未知外部活动不能清理；注册但缺失的 worktree 只能记 UNKNOWN，不能自动 prune/reset |

生产数据、凭据、资源 guard 与现有安全修复保持原状。不得恢复旧不安全入口；不得另起第四套 Core 或数据库设计。

## 9. 新对话只读接手步骤与停止条件

1. 先读本文、现有 status、inventory、Phase 6 主报告及实际目录 AGENTS.md。区别历史报告与实时证据，避免从 Phase 0 重启。
2. 只读核对绝对路径、分支、HEAD、index、WIP 指纹、实际 task runner；发现差量先记录，不自动拉取、重置、切分支、合并或清理。若同一工作区仍有旧任务写入，停止接手并报告冲突。
3. 不将 README/status 的 PASS、HEAD、tag、已安装包、磁盘产物和正在运行版本混用；未取得证据一律 UNKNOWN。特别保留 Phase 3/5 运行状态与尚未提交 Native 候选。
4. 任何后续实施须由用户明确给出有限范围；本 handoff 和原 Goal 不提供继续迁移、补测、发布或数据库操作的授权。不存在为了“收尾完整”继续修复的例外。

**当前无需人工取消已知本任务进程或释放已知本任务锁。** 尚需后续接手者确认的安全边界是未知外部 agent 活动，以及未查询的生产运行源码/版本/schema/pending 状态；这些未知没有被伪装为已清理。此处结束本轮，不选择下一任务。
