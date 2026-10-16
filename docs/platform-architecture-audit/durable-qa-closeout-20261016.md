# Viewer 0.82.1 持久证据恢复与 O1 续验

**Viewer 0.82.1 BLOCKED；未进入 0.83 Freeze。** 当前因 Annual 高历史量冷生成触发 PSI 停止阈值，所有新增业务负载已停止；退出清理与最终归档已完成。 这份记录接续原始证据丢失报告，不覆盖历史 FAIL。所有新工作树、wheel、安装环境和正式证据均在 `/home/sigaer/taiko` 下；不再依赖 `/var/tmp` 持久保存。

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

## 第二阶段：history 专项与隔离恢复

原 buffered 方法与流式方法均完成同规模 history c3 600/600（各规模 200），0 失败/429/超时/dropped/OOM。总体 P95/P99 分别为 1733/1929 ms、1516/1677 ms。两轮各规模输入摘要、完整响应摘要集合、wheel、Viewer 运行闭包和测试脚本摘要一致。本轮两方法都未复现历史资源 FAIL；最低 MemAvailable 分别 14,526,328 / 14,633,556 KiB，高于历史失败轮，所以不能将原失败仅归因于客户端分配。

完整独立诊断：`/home/sigaer/taiko/qa-vault/evidence/o1-history-methods-20261016/history-method-diagnostic-20261016.json`（SHA-256 `e28f84e33d423927c14641514dfa745e790664806f4049a8f07c7313fd0e233d`），同目录 Markdown 与逐请求/资源原始记录可复核。**历史 474/126 FAIL 保留，迁移性能基线归因仍待证据。**

恢复准入 14 PASS（`qa-9b37dfa703ce`）；独立 MySQL 恢复 1 PASS（`qa-518bbc2e2069/evidence/recovery-tnnAr7/evidence.json`），RPO 145 ms、RTO 8401.57 ms。涵盖 SQL、C/H、daily、Goal/measurement、Annual 旧身份、授权撤销及新 publication 代际；两 MySQL 均退出，scratch 清理完成。此结论仅适用于受控停写的小规模合成检查点及实际服务图，不是生产 HTTP、PITR、定时异地备份或完整恢复 Gate PASS。独立 HTTP 就绪场景继续实现。

## 第三阶段：HTTP 恢复与 Annual 热读

独立 HTTP 恢复 `qa-010859c89224/evidence/http-restore-IQQ5VK/evidence.json` 为 **PASS_SCOPED_HTTP_RESTORE**。故障时真实 profile 请求 500；恢复后重新登录、profile/current/history 200，响应摘要与 publication header 与故障前相同；核心 POST 200，publication 3→4 且读取内容改变。撤销 token 返回 401，撤销/过期 grant 返回 403；无法证明撤销连续性时同时失效 developer token 和会话，两个 HTTP 入口均 401。墙钟 RPO 141 ms、RTO 7864.98 ms；仍限于合成 loopback 和受控检查点。完整含会话的 SQL 仅在 scratch 用于恢复，退出清理；持久 SQL 副本脱敏，明确不作为可直接恢复备份。

Annual 热读 **PASS**：1/s、3/s、5/s 各 200/200，0 失败/429/超时/dropped，P95/P99 为 88.448/98.610、80.515/93.016、75.089/84.222 ms。详见 [Annual 原始证据与前置失败记录](annual-o1-recovered-20261016.md)。正式 30 人冷生成和海报仍待验证，不能由热读推断通过。

私有 current 并发 1 完成每规模 200、合计 600/600；small/medium/large P95/P99 分别为 88.52/94.76、87.92/100.93、91.76/99.74 ms，均 PASS_SCOPED。完整聚合为 `/home/sigaer/taiko/qa-vault/evidence/o1-current-c1-20261016/phase-performance-aggregate.json`。其他并发、操作、极端样本继续执行。

## 第四阶段：资源停止与实际未完成项

**停止新增业务负载，0.82 BLOCKED。** Annual 正式 cold 首个 high 任务（200 快照×500 谱面）在 52.654 s 时触发 `MEMORY_PSI_FULL`，未完成；30 计划身份中 1 提交、0 完成、1 失败、29 未执行。P95/P99 不可计算，不能把停止时长当完成耗时。`qa-5593936cff4c/evidence/annual-o1-A3cg7j/evidence.json` 保留原始 FAIL。host full avg10 从 0.00 升至 5.99；worker 采样最大内存约 1 GiB、swap 128 MiB、memory.high 事件 387、OOM/OOM-kill 为 0。内核 memory.peak / io.stat 未提供，标为 UNAVAILABLE，采样最大不是真实峰值证明，也不能仅凭 host PSI 判定其唯一来源。

精确 QA/Generator unit 已退出，MySQL 正常关闭，scratch 不存在，6 个原始归档文件摘要匹配。主动 systemctl stop 导致该轮 wrapper 返回 0；**此返回值不能推翻业务 resource-stop/FAIL**，原 manifest 不改写。详细独立裁决见 [Annual 冷任务资源失败](evidence/annual-o1-cold-resource-stop-20261016.json)。

Passport 2000 快照×500 谱面独立极端请求 8.390 s，低于单次 15 s 边界，PASS_EXTREME_SCOPED；不混入常规分位数。B30 与 merged-history 各 9 次预检全部 HTTP 200，但 P95/P99 分别 8.014 s 与 6.898 s，保留目标未达 FAIL，均不足正式样本。其余各操作及并发覆盖矩阵、所有新原始文件摘要见 `/home/sigaer/taiko/qa-vault/evidence/o1-resource-stop-stage-20261016/fast-o1-performance-20261016.json`，SHA-256 `463bb56617961c1052647a12c07f6b1fc7cb0dcf1118249cf57d532454de6578`。

旧 119 worker SQL 和 12 PNG 的历史 PASS 摘要继续保留，但原始证据丢失，**不能宣称当前新构件已复验**。SQL 最小必要入口闭包已定位为四文件八项定向用例，未在资源停止后启动；不重跑全部 119。原 12 PNG 需要原公共素材身份，当前合成 B30 资源不构成像素等价证明，亦未读取私有资源。独立产品草案仍为 `78ce858` / READY_FOR_FREEZE_REVIEW，未冻结；本轮不重测其旧 25 项。

最短剩余阻断：

1. 处理 Annual 资源准入失败及归因，再完成缺失 O1 正式分布、必要海报场景；历史 history 474/126 FAIL 保留，旧 0.14.1 环境缺失阻断迁移归因。
2. 补最小八项安装态 SQL 入口证据或完成明确复用裁决；旧 PNG 素材及原始证据身份仍缺失，不以新素材代替。
3. 持续一致检查点/PITR、完整规模恢复、异地加密备份与 12 项私有资源权属；本轮两个合成恢复 PASS 不代替这些要求。
4. 经单独授权的生产只读 ingress/ACL/运行身份审计及 Owner 签收。没有生产访问、部署、重启、推送或 main 合入。

## 最终归档与空间对比

最终清单：`/home/sigaer/taiko/qa-vault/runs/qa-b494a72a1631/evidence/durable-qa-inventory.json`。覆盖此前 65 轮；已登记文件 SHA 全部匹配，0 缺失/不匹配。65 轮均已证明子进程退出、只清理本轮 scratch，scratch 均不存在；归档核查轮自身也已退出并清理。逐轮成功/失败/停止原因保留，归档校验 PASS 不等于业务 Gate PASS。

| 指标 | 本任务开始 | 最终归档核查 |
| --- | ---: | ---: |
| 文件系统可用字节 | 41,197,596,672 | 39,094,525,952 |
| vault 分配字节 | 20,480 | 1,330,135,040 |
| vault 权限 | 0700 | 0700 |

对应可用空间约 38.37→36.41 GiB，vault 约 1.24 GiB。目录清单和每轮清理记录均在上述 JSON；变化包含工作树依赖及其他系统活动，不归咎于或清理其他任务。新候选 wheel、94×2 环境、锁和运行清单继续保存在受保护 vault。早期重建目录保留，不进行跨轮清理；两个构建脚本已改为未来仅 wheel/log/证据持久化，source/builder/archive/cache 进入当轮 scratch。该修订仅静态验证，没有为路径调整重复重建已验构件。

主动中止修订新增 5 项定向检查 PASS；无业务负载的真实中止 smoke `qa-4163edfc0fcf` 返回预期 125、明确 OWNER_ABORT 原因，确认 unit 退出及 scratch 清理。原 cold 的 wrapper 0 和业务 FAIL 均未改写。后续 scope 标签仅元数据调整，原 Annual warm 600 PASS 及其源码摘要保留，不重复执行。

单文件状态矩阵：[082-durable-gate-20261016.json](evidence/082-durable-gate-20261016.json)。下一步最小安装态闭包见 [八项定向补验方案](minimal-installed-revalidation-20261016.md)。本轮没有生产配置/SQL访问、部署、重启、推送或 main 合入。
