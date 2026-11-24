# Core Artifact Provenance Report

状态：仅本地Release Candidate，未发布/部署。最终可审阅制品目录为 `/var/tmp/taiko-batch2-20261124/release-candidate/`；早期 `artifacts/` 与 `artifacts-center-rc/` 是构建/兼容实验，不能取代最终清单。每个最终wheel均连续重建两次并确认逐字节SHA相同，SOURCE_DATE_EPOCH固定到对应源码commit时间。

| 制品 | 来源 | 最终SHA-256 |
|---|---|---|
| sakura_taiko_core-0.1.3rc1 | 独立Core仓库 `52909ec` | `1a29aa212ed6e5d7e680c784ec0be98f3d3f84db61d13badd9d6b9e934ff4e9c` |
| taiko_application-0.9.3rc1 | Bot候选 `cda0a85`，packages/taiko-application | `084e9080c21a5d68e2725d6f677b4311b3f8467d970f93820561b3acf79d4c39` |
| taiko_bot-0.26.4rc1 | Bot候选 `cda0a85` | `29a9e872d43c3a1e7eca402b93310b0369eb6768328ef54ce52cef6157c74a30` |

完整长度、contract/memory及配套依赖wheel的hash、Requires-Dist、构建工具版本、每包源码commit/epoch在 `release-manifest.json`；源码逐文件SHA在 `source-file-manifest.json`，该文件本身hash也在最终manifest中。`SHA256SUMS`覆盖最终目录中制品与清单。辅助第三方/既有插件wheel取自 `/opt/taiko-bot/artifacts`，已记录原路径与hash；它们不是本批从源码重建的制品，不夸大其源码provenance。

## Source lineage / 版本

保留用户指定的Viewer `repair/correctness-candidate-20261124@26930740`与Bot同名分支`62c4d3e`，均未移动。新的Core维护worktree `/var/tmp/taiko-batch2-20261124/core`、分支 `repair/center-core-0.1.3rc1-20261124` 从独立Core仓库v0.1.1(`9fc0731`)起步，只应用候选的五文件Center增量回补；未把Client 0.1.2整包覆盖Center。

补丁来源为Bot候选 `docs/correctness-repair-20261124/core-center-backport.patch`，SHA `c2baff5be96894fdf55b41edae6bd7d2111a2e1e685e9352f0ba38fa80a3e283`。对应availability、candidate filtering、catalog identity和两个parser；Rating/六维公式未改。候选原0.1.1文件hash保留在前批 `backport-inputs.json`。独立Core的commit明确包含源码与版本，构建不依赖从生产site-packages临时拼装overlay。

0.1.2已用于Client领域提取，故分配下一patch系列0.1.3的rc1，不重用已发布0.1.1/0.1.2。Bot/Application分别分配0.26.4rc1/0.9.3rc1，修改仅为Center制品pin、Application上限、宿主精确版本检查与候选版本声明。Client pin仍为0.1.2；没有未经审核把它切换到Center维护版本。这是必要的候选依赖配套，不能解释为已迁移所有catalog消费者。

## 构建 / 安装环境

Python3.11、setuptools80.9.0、wheel0.45.1。由既有run_qa隔离，采用tracked源码文件快照、无build isolation的固定工具；没有在生产解释器安装构建工具。PyPI初次直连失败，按工作区规则通过现存CN HTTP代理127.0.0.1:18888完成工具/依赖获取；未修改任何生产代理配置。具体第三方包版本以最终freeze为准；不声称所有依赖与生产完全相同。

新venv `/var/tmp/taiko-batch2-20261124/installed-center-rc`由 `/usr/bin/python3 -m venv`创建，没有system-site-packages、PYTHONPATH或源码Core overlay。安装实际wheel后，用`python -I`检查Core、Contract、Application、Bot的`__file__`均位于该venv的site-packages；逐个Core `.py`与commit源码比较SHA相等。测试源码仅作为测试用例/合成provider，不替代已安装包。证据 `installed-imports.json`。

先经历未对齐pin导致collection拒绝，再生成真正配套RC wheel后76通过；该失败保留，不以测试时伪造version()绕过。最后补齐Center可选插件与其实际依赖，Pillow按pil-utils要求使用11.3.0，执行pip check及真实pip Center extra dry-run。最初缺pil-utils、之后需要其依赖的失败同样留证。

## 结果与边界

最终Center契约12通过、Python76通过/4原有skip；Node原309全部通过，加入Kinoko标记回归及Weekly说明后310通过；Viewer build成功；5个本地Python包wheel可重复构建。跨语言27项真实安装Core桥接18通过/9个Client失败，详见兼容矩阵。**Center计算候选可审阅，不是全系统发布PASS。**

本批额外运行旧Core v0.1.1完整23个unittest方法，20方法通过、3方法发生128个失败断言/subtest：126个旧推荐golden以空资格集合表示“不过滤”，另2个仍期待旧空集/缺明确shelf状态的可用性结果。这些旧契约与本次明确fail-closed修复冲突，未删除测试或改算法去迎合旧输出；需把旧golden迁移到新资格契约后才能宣称Core全仓回归PASS。原始失败日志保留为release gate，而非隐藏在12项必需契约结果中。
