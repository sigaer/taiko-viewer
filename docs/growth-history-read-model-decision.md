# Growth History Read Model：Phase 1 BLOCKED 与后续决策

日期：2026-10-08（Asia/Shanghai）；基线 `main / 1dcf9c3`，生产 Viewer 确认 **0.80.0**。

```text
GROWTH READ MODEL ARCHITECTURE — BLOCKED
REASON = NO SHARED COMMITTED INPUT GENERATION ACROSS ACTUAL WRITERS
REQUIRED INPUT / DECISION = AUTHORIZE AND VALIDATE CROSS-WRITER COMMIT PROTOCOL FIRST

PHASE 0 PREFLIGHT = COMPLETE
PHASE 1 TOPOLOGY / CANONICAL AUDIT = BLOCKED AT SOURCE CONSISTENCY GATE
PHASE 2 COST / CANDIDATE DESIGN = DRAFT ONLY
PHASE 3–5 READ-MODEL PROTOTYPE / PARITY / BENCHMARK = NOT RUN
DECISION = BLOCKED (E — NO APPROVED DESIGN)
EXISTING 3000MS / 5000MS GATES = BLOCKED / NOT VALIDATED
NEW ONLINE/OFFLINE BUDGETS = PROPOSED, NOT APPROVED
PRODUCTION VIEWER REMAINS 0.80.0
NO TEMPORAL UI / NO PRODUCTION SCHEMA / NO DEPLOY
```

完整 [P1 任务](Sakura_Viewer_0.80.1_P1_Growth_History_Read_Model_Architecture_Audit.md) §36 明确要求：“若 Phase 1 发现外部 writer 一致性无法封闭，提前出 BLOCKED，不要在其上搭脆弱索引。” §20 又禁止修改 live writer 和接入生产 API；因此本轮在可完成的审计/诊断之后提前停止，不要求用户重新批准已经批准的 P0 预算，也不宣称 P1 全阶段完成。

## 1. 阻断与交付

已经交付：[写入/语义审计](growth-history-read-model-audit.md)、[架构及提交协议](growth-history-read-model-architecture.md)、[实测/假设成本账本](growth-history-read-model-benchmark.md)、本决策，以及 [测试专用诊断](../taiko_viewer/tests/growthReadModelPreflight.test.mjs)。

实际阻断：Python `save_userdata` 与 dispatcher 直接覆写 C/H，Viewer 只原子替换 C、直接写 H；现有锁仅进程内且部分 web edit/create 未使用；merged 重建可先删除整段历史。**增加读模型存储、DB generation CAS、mtime/hash cache 或 Viewer hook，都不能自行创建所有原始 writer 的共同提交边界。**

此外完整 canonical facts 受 current revision 及 catalog title 影响；checkpoint 需跨 full 保留 bestScores 和未 finalize 的同日 chart accumulator。仅缓存历史事实、或采用任意 full checkpoint，都不能直接替换 canonical pipeline。

本轮 12 项诊断和 242 项已有回归均 PASS，只证明反例与现有语义；没有新读模型的 parity PASS。缺少的原型/ISO 压力/并发实测均在 benchmark 明确标 unknown / NOT RUN；没有跳过这些后宣称完成。

## 2. 新在线/离线预算提案（尚未批准）

旧 3s/5s Gate 依旧阻断。以下是未来 A+D/B+D 方案测量目标草案，不是对现 Gate 的修改或已满足的承诺；在用户明确批准、来源提交协议通过和完整原型实测前不能进入生产实现。

| 路径 | 提议目标 | 边界/依据 |
|---|---|---|
| 验证索引的 fact load + verify + selection + serialization | p95 ≤100ms；composition 仍 <30ms | 新实验目标，没有当前索引结果支持；不含 Python/Goal/measurement/HTTP |
| 完整 authenticated Passport GET | p95 ≤5,000ms，Growth Python 最多一次 | 保留原初载预算；必须另测网络/浏览器可见时间，不拿目前 90d logs 当验收 |
| 30/90/180/365 切换 | 已返回四档的客户端切换不额外 Python/replay；若需网络查询，fact path p95 ≤100ms | 新 DTO/浏览器未实现，时间桶 curation 未测 |
| append 0/1/5/50/500 charts | 增量 apply + publish p95 ≤500ms，每档独立报告 | 包含 source commit 验证/checkpoint 与 store 写入；不隐藏旧前缀全 SHA 成本 |
| 首次/dirty 离线 full rebuild | 单任务目标 ≤20s，watchdog 仍 60s；一个 builder 起步 | P0 cold 12.83s 仅参考；新增 IO/validation 未测；不能称原 3s 冷建通过 |
| 首次/dirty 排队与产品状态 | building/dirty 目标 ≤60s；队列准入目标 ≤20 项，超出明确 unavailable/retry | 需要真实到达率/压力/失败恢复验证，超标不静默 stale，不能保证 100k 同时初始化 |
| resources | worker ≤512MiB、QA peak ≤1GiB、冷读 ≤300MiB；新增 high/oom/oom_kill=0；PSI full ≥2% 持续 10s 中止 | 保留原资源限制；peak 不可读仍未验收，不能提高 guard 换 PASS |

这是一份可批准/修改的草案。要采用在线/离线双 Gate，须明确批准“离线冷建不再作为 HTTP 3s 内必完成的步骤”，同时保留原管线失败的结论；不得只批准指标数字而模糊新旧 Gate 关系。

## 3. 最小后续范围与验收条件

**下一步先落实来源提交协议。** 需要明确授权跨仓库 writer 协议改造与隔离验证范围：本仓库 Viewer helper/web edit/Kinoko/manual/lifecycle，加外部 Wahlap/Hiroba 共用 writer、dispatcher、merged 及 maintenance 接入。先形成可审阅的代码与测试，不执行生产写入/migration/deploy；是否发布提交协议留到其 Gate 准备就绪后另行批准。

协议合同已在 architecture §4 具体写出：跨进程 read→delta→commit 锁；pending intent/epoch；临时文件 fsync/rename；不可变输入 generation/commit manifest；批次 shadow publication；writer coverage/reconciliation；binding fence 与失败恢复。对未纳管 writer 默认不给 ready。不能只增加 dirty 通知而保留半成品读取。

解除 source Gate 后才能恢复 P1 Phase 3–5：先冻结严格 golden，再只在测试专用模块验证 A+D，测写放大后选择 FILE/DB/CHECKPOINT+INDEX；原计划 24 类 fixture/ISO 上限/真实只读 aggregate/多 worker 完整验证全部仍需做。随后用户决定新双 Gate 预算和 stale 产品策略；read-model Gate 通过再授权生产实现；最后才是 Temporal UI。

## 4. 必答36项

| # | 回答 / 可检索位置 |
|---|---|
| 1 工作树/版本/P0 | `main / 1dcf9c3 / 0.80.0`；streaming `75177fa` 独立未合并；生产匿名 version 复核通过，audit §1 |
| 2 所有实际 writer 覆盖？ | 可定位入口已逐一审计，含外部 Python/dispatcher/merged；未知运维/远程 target 不能证明全覆盖，audit §2 |
| 3 受控与 reconciliation | 当前无共同 committed input generation；Viewer 可将来纳管，外部必须一同改造或拒绝索引服务，audit §2 / architecture §4 |
| 4 排序/2000/baseline | filename 秒时间+完整文件名，先 latest-2000 再 parse；不额外找 baseline；replay 与 observations 两套顺序，audit §3 |
| 5 内容身份 | raw byte SHA-256 是 revision；Python canonical content hash 独立，不当 order sequence，audit §3 |
| 6 canonical 版本 | 固定 loader/replay/projector/calendar 规则 revision + projection version；current/catalog 也是输入；measurement modelRevision 不能复用，audit §4 / architecture §5 |
| 7 Goal/measurement | 独立 DB 确认/捕获，completedAt 不当 play day，六维不回算，audit §5 |
| 8 A/B/C/D 成本 | architecture §2–3，benchmark §4–5；新实际延迟 unknown，C 冷查仍 P0 成本 |
| 9 推荐介质 | **未批准任何介质**；source Gate 后优先隔离 A+D 实验，DB 仅在量化写放大/多机需求成立后比较，architecture §3 |
| 10 manifest/generation | architecture §5：input commit/owner/binding epoch/canonical/schema/hash/coverage/status；facts 精确复用 GrowthFact |
| 11 append 准入 | stable committed prefix/order/baseline/checkpoint/current/catalog/owner/version 全匹配；滑窗淘汰不是 append，architecture §6 |
| 12 旧历史修改检测 | 受控 commit 使 dirty；未纳管 writer 需要受维护门禁的内容扫描，当前未封闭，architecture §4/6 |
| 13 同尺寸 mtime | 第 4 诊断通过：stat/order/count 不变，content/facts 变；必须 hash/可信 commit |
| 14 import/backfill/reorder | prefix 变即 dirty/rebuild；batch 不得逐文件作为 ready，audit §2 / architecture §6 |
| 15 rule 升级 | revision 变化 rebuild-required，不默认兼容，architecture §5 |
| 16 mid-history 局部 | 仅 earliest affected 之前 verified checkpoint 恢复并重放后继；不能遇 full 停止；当前未实现，architecture §6 |
| 17 checkpoint 边界 | 必须 bestScores/observed/loader barrier/unfinished chart facts；末 checkpoint 不能还原此前 milestone，audit §4 / architecture §3/5 |
| 18 365 覆盖 | raw 保留、2000 覆盖、前 baseline、可复验 source chain 各自记录；当前全体 profile unknown，audit §6 |
| 19 2000 对旧节点 | 会舍弃 baseline/最佳成绩前态；不能保留 index 老 fact 后声称来源仍 complete，audit §6 |
| 20 异常产品状态 | architecture §8；building/dirty/partial/truncated/unavailable 明确，不默认 stale，不造无变化 |
| 21 writer/build/read 一致性 | 目前 BLOCKED；计划 source commit + immutable generation + CAS/lease/owner fence，architecture §4/7 |
| 22 两 worker 去重 | 计划 kernel flock + input/version key；非进程 Map；多 worker 测试 NOT RUN |
| 23 A/B/unbind/delete | DB ownership/current binding epoch、tombstone/publish fence、私有目录 cleanup/orphans；当前无 index，测试 NOT RUN，architecture §7 |
| 24 full rebuild parity | **NOT RUN**；只有小样本 canonical 全字段 golden 和 existing pipeline parity PASS，不能当 read-model PASS |
| 25 incremental/full parity | **NOT RUN**：source Gate 提前停止，未建增量 adapter |
| 26 mutation/crash fixtures | source 中间 gap/同尺寸覆盖/旧 mutation 诊断 PASS；read-model crash/lease/CAS NOT RUN，audit §7 |
| 27 ISO 原测试 build 成本 | **read-model unknown**；旧 canonical 12,834.76ms / 282,969,992 bytes，benchmark §1/4 |
| 28 indexed query p50/p95/payload | **unknown**，没有 index；旧 score-only DTO/90d production logs 不能替代，benchmark §1/3/4 |
| 29 0/1/5/50/500 append 成本 | **unknown / NOT RUN**，见 benchmark §4；不从 O(Δ) 直接推时延 |
| 30 cold CPU/IO/RSS/PSI | 新 build unknown；P0 参考和本轮 tiny 诊断分开，kernel peak/io.stat unknown，benchmark §1–2 |
| 31 并发容量/限流 | benchmark §5 情景模型；单隔离 builder/binding 去重/有界队列/pressure admission；实测 NOT RUN |
| 32 3s/5s 仍 blocked？ | 是：ISO cold 明确超 3s；完整 365 GET 含 Python 尚未验证，不能以新 query 替代 |
| 33 新预算/授权 | 本文 §2，全部 PROPOSED, NOT APPROVED；旧预算文件未改 |
| 34 生产改动？ | 无 DB 连接/DDL、私人文件/UI/版本/部署变化；仅新 docs/test；既有业务 JSON 未动 |
| 35 下游契约变化？ | 无：public History ≤90d、Goal/Recent/Daily/Weekly/Passport 共享代码全未改；242 项已有回归 PASS |
| 36 下一阶段最小交付/阻断 | 先授权并验证跨 writer 提交协议，再恢复 P1 隔离 read-model 实验；source 一致性、全字段 parity、完整压力/并发资源可观测性及双 Gate 批准仍阻断 |

## 5. 产物与清理

本轮新增源文件仅四份 docs 与测试专用模块；没有 `git add -A`，没有将用户旧文档/关系数据混入。本轮诊断目录全部 finally 删除，未启动 dev server/browser/worker 服务；标准 QA transient unit 随 runner 完成退出。保留两个小型私有聚合产物（preflight JSON、runtime baseline JSON），没有 raw userdata、大型 fixture 或私密账号数据进入 Git；后续重跑可覆盖同类聚合输出。
