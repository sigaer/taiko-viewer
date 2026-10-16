# Viewer 0.82.1 持久证据恢复与 O1 续验

**Viewer 0.82.1 BLOCKED；未进入 0.83 Freeze。** 这份记录接续原始证据丢失报告，不覆盖历史 FAIL。所有新工作树、wheel、安装环境和正式证据均在 `/home/sigaer/taiko` 下；不再依赖 `/var/tmp` 持久保存。

## 构件与安装态

Taiko 0.14.2 按固定源码 `a632913dfbdbec1d465f8eaccc0bb80c35e25745` 重建。新 wheel SHA-256 为 `398d23000ebde8a9696b8586fc7fff6cf566e49eb6efe970ceba2e5ecf488c0a`，387 个源码/数据成员与固定 Git 源码一致。原 wheel 已丢失，不能声称新旧 ZIP 或全部内容完全相等；原 SHA `0963350629b261fb5002bf6ef96c6019c22ca5c9515b73279f3c578d8e6725c8` 继续保留为历史身份。派生锁仅改变本地 Taiko wheel 的摘要，其余依赖维持锁定版本和摘要。

center/client 均为独立 94 包环境，Core 分别为 0.1.1/0.1.2；独立 `python-memory-runtime 1.1.0` 重建摘要与原值完全相同。两环境的 wheel 校验、完整包清单、`pip check`、`-I` 模块来源均 PASS。详细证据见 [构件重建记录](runtime-reconstruction-20261016.md)。

受保护根目录为 `/home/sigaer/taiko/qa-vault`（0700）。当前运行清单为 `artifacts/runtime-manifest.json`，SHA-256 `407a3ad925ef2b22d96639153758e644e4723e33e5e6e56ccf800b0e95e217b4`。新增 14 项合成图片素材有独立摘要，不冒充丢失的历史素材。0.14.1 安装态基线仍缺失，回归归因不得伪造基线对照。

## 每轮 QA 保护

每轮由现有 cgroup 包装器创建专属 `runs/qa-<id>/scratch` 和持久 `evidence`。每两秒记录磁盘余量及本轮占用；默认 scratch 上限 2 GiB、磁盘余量下限 5 GiB；Annual 原 22 GiB 准入要求不变。退出时先证明本轮进程退出，再仅删除本轮 scratch；证据文件 fsync、逐文件 SHA-256 和原子清单保留。没有清理其他轮次、失败环境或用户文件。

包装器 16 项检查 PASS（`qa-8dcbdd00a8d5`），实际遗留子进程退出及清理 smoke PASS（`qa-511a321f82a1`）。Annual 路径隔离负例 PASS（`qa-48b66bfdda37`）。原包装器误拒绝 publication 合法硬链接的 `qa-e51b0af965bc` 保持 FAIL；修正后 scratch 按 inode 去重计算分配空间，清理只 unlink 本轮名称，外部目标保持，证据文件仍拒绝硬链接。

## 必要的丢失证据补验

表中 ID 均对应 `/home/sigaer/taiko/qa-vault/runs/<ID>/evidence`，含日志和摘要清单。

| 项目 | 实际结果 | 原始证据 |
| --- | --- | --- |
| 新历史事实 / 凭据鉴权 / Annual 身份 Oracle | 28 / 11 / 3 PASS | `qa-dc168789101e` |
| 来源重现单元 / 安装集成 / 跨谱面改善 | 11 / 2 / 11 PASS | `qa-e51b0af965bc`，该批次后续因包装器错误终止，整批不称 PASS |
| Passport 完整冻结 DTO | 13 PASS，保留全部严格断言 | `qa-e51b0af965bc` |
| 安装消费 / Growth revision / 指纹 / Annual worker / 旧布局替代断言 | 3 / 1 / 1 / 8 / 1 PASS | `qa-7f126a4b8860` |
| center/client 生命周期 | 46 + 46 PASS | `qa-7f73d15bcbff` / `qa-abc55d05f04b` |

生命周期恢复首次因旧参照 center/client 目录映射反向而失败（`qa-51b6bb3a1feb`）；原始源码 SHA 正确。按原源码角色纠正映射后重跑，全部业务断言不变，首次失败和原恢复文件均保留。未重跑 119 项完整 worker SQL、12 PNG 旧套件或独立产品草案测试。

## O1 与恢复状态

历史 history c3 **FAIL 不变**：600 计划请求中 474 成功、126 dropped，成功率 79%，P95/P99 为 1506.67/1587.44 ms，0 HTTP 429/超时/OOM。最低 MemAvailable 12,720,932 KiB，低于原阈值 12,774,405.6 KiB；原始分布丢失，不能重造。新专项将区分 buffered 原客户端与流式消费；即使未复现，也不能消除历史 FAIL 或认定 0.14.1→0.14.2 无回归。

Annual、后续 O1 cohort 与最小一致性恢复补验正在串行执行，只有正式归档结果才能更新为 PASS。生产 ingress/ACL/运行身份仍 `PENDING_AUTHORIZATION`；12 项私有资源权属及加密异地备份仍 `BLOCKED`。没有读取生产配置、访问生产 SQL、部署、重启、推送或合入 main。

## 第一阶段空间与清理记录

归档检查 `qa-d5709b0e543c/evidence/durable-qa-inventory.json`：30 轮已结束 QA 的文件摘要全部匹配，0 缺失/不匹配；30 轮均证明子进程退出并仅清理自己的 scratch，当前这些 scratch 均不存在。失败轮次的证据继续保留。

| 指标 | 开始 | 第一阶段结束 |
| --- | ---: | ---: |
| 文件系统可用字节 | 41,197,596,672 | 39,161,876,480 |
| vault 分配字节 | 20,480 | 1,317,920,768 |
| vault 权限 | 0700 | 0700 |

系统可用空间变化包含工作树依赖及其他系统活动，不能全算作本任务净占用。清单另含每个目录分配空间。持久目录包括 `artifacts`（运行清单、npm 缓存）、`wheelhouse`、`locks-*`、`role-center-*`、`role-client-*`、`sources`（固定 Oracle、合成素材）、`tooling`、`runs/*/evidence`。它们都位于受保护 vault 内。Git 工作树位于相邻 `.worktrees`，不在临时目录中。

Annual 第一轮 `qa-87c1a800ccdb` 是 SQL bootstrap 的旧路径校验失败，未触达 Annual queue，不能计入冷生成业务耗时或成功率；修复共享前置后继续，失败日志保留。
