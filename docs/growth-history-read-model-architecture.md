# Growth History Read Model：候选架构与提交协议草案

日期：2026-10-08（Asia/Shanghai）；基线 `1dcf9c3`。**设计草案，DECISION=BLOCKED；未实施/批准生产协议或读模型。**

证据：[写入及 canonical 审计](growth-history-read-model-audit.md)。测量/假设边界：[成本账本](growth-history-read-model-benchmark.md)。

## 1. 先行 Gate

| Gate | 当前结论 |
|---|---|
| Evidence | canonical/Goal/measurement 边界已审计；全字段 prototype parity 未运行；所有 writer 输入一致性 BLOCKED |
| Cost | 原 pipeline 已有 P0 实测；下列五条 path 已建模；索引/增量/离线队列真实成本未测，不宣布 PASS |
| Product | 服务未来周期档案；公开 90d 契约不变；partial/dirty 必须披露；不重定义 Session；Temporal UI 未实施 |

## 2. 五条 critical path

| path | IO / parse / CPU | 内存 / Python / DB / 网络 | 并发与失败边界 |
|---|---|---|---|
| Write | 目前 Python 会读 C、查 full、比较 charts，再序列化 C/H；Viewer 序列化 full；未来每提交 hash 一次写入 bytes + 追加 commit record | O(charts) 前态；writer 现有锁 DB 查询不改；index 不调用 Growth Python；新增 commit bytes 有上限 | 单 source-key 跨进程序列化 read→delta→commit；失败须留下可辨 pending/failed 状态 |
| Build | 首建：列目录/读≤2000、parse/replay 1,000,000 rows 上限、原规则投影、校验、写 shadow generation | P0 ISO 12,834.76ms / 416.69MiB；streaming 可研究降低内存；独立 worker，不能在 HTTP worker 同时跑 N 个 | 同 binding 单 flight + 全局 admission；source epoch/owner 变化拒绝 publish |
| Query | 已验证 commit ID + generation/schema/source identity；只读选中日桶/事实；bounded period compose / serialize | current Growth at most once；Goal/measurement 单独 SQL；不读整个 C/H corpus、不回算六维；完整 HTTP 成本 unknown | binding/current/source generation 复查；dirty/missing 返回状态；不静默 stale |
| Invalidate | 受控 commit 通知 epoch；未受控 deep scan需完整 raw hash，不可 stat-only | scan≤300MiB/轮只是将来受限预算；控制列目录/bytes；无 Growth Python；无私人内容日志 | 未纳管 writer 一旦存在，不承诺 freshness；reconcile 自身也需一致读取边界 |
| Rebuild | earliest affected checkpoint 前回放至末尾；无法证明影响范围就 full generation | checkpoints 必须包含 bestScores、observed、chart/day accumulators、来源 barrier；占用 unknown | 后台队列与退避；旧 generation 只内部保留；丢 baseline/损坏不造 complete |

这些路径的新增实际开销未测；不得把原 13 秒挪到后台后写成 3 秒冷建通过。

## 3. A/B/C/D 比较

F=该 binding 全部 canonical facts；K=选中日桶事实；S=checkpoint state；Δ=新增 chart rows。F/K/Δ 的数值尚未测原型。P0 1,997 facts JSON=1,284,791 bytes，只用于容量量级。

| 候选 | 在线冷/热查 | 增量维护 | 回填/修复 | 原子性 / 多 worker | 清理 / 复杂度 |
|---|---|---|---|---|---|
| A：private sidecar | 未命中→building；ready 采用日桶约 O(K)，全 JSON 实现则 O(F)。实际 p50/p95 unknown | 可 append O(Δ) replay；单文件 atomic generation 会重写 O(F+S)，0 变化也可能改 provenance | prefix mutation 重建，不能 blind append | immutable generation + atomic pointer + kernel lock；**仍需 source commit**；同 host 共享卷可行，跨 host 未证明 | 应用 tombstone、retention、orphan sweep；运维中等 |
| B：MySQL facts | 未命中→building；组合索引约 O(log F+K)；实际 query/lock cost unknown | O(变动事实) upsert 新 generation + checkpoint；redo/binlog/index 写放大未测 | shadow generation 事务切换，行级校验 | 已有 MySQL/owner fencing 更便利，但 DB 事务不能提交外部文件；还是需 source commit | 应用事务清理，无 FK；长期保存私人事实需后续授权；DB 运维较高 |
| C：进程缓存 | 冷查仍是 P0 12.83s；热查只内存 selection，未实测 | 同进程更新便宜但多 worker 不共享；重启失效 | 不可靠失效就 stale；不能恢复老事实 | 无持久 generation；每 worker 重复 F/S | 有界 TTL/bytes 只作加速层；不可作主要 read model |
| D：checkpoint | 可减少恢复尾段 replay；只有末状态不能查询此前 PB/FC | O(Δ) + O(S) checkpoint 写 | earliest affected 之前恢复；S 需历史 bestScores 等 | 可靠 immutable checkpoint + source identity，不能用任意 full 替代 | **必要但单独不足**，需 A/B 事实索引搭配 |

目前选择 **E — NO APPROVED DESIGN; FURTHER AUDIT REQUIRED**。来源协议和 parity 通过后优先实测 **A+D**：本机共享存储、无需新生产表、可重建私有投影；这只是实验优先次序，不是 FILE READ MODEL VIABLE。若 fact 大小/写放大/多机要求否定 A，再以实测支持 B+D。C 只做 bounded acceleration；D 不能独自恢复全年 milestone。

## 4. 必须先落实的 source commit 协议

下面是后续可审阅的改造合同，不是已部署实现。仅 Viewer hook 无法满足合同。

1. 所有 Wahlap/Hiroba/dispatcher/web/manual/Kinoko/merged/maintenance writer 对同一可信 source identity 使用跨进程 kernel lock 或唯一 writer service。绑定 ID 与 raw source identity 不混淆：raw source 可能被多个业务入口使用。
2. 在持锁 read previous C 之前记录 mutation intent/epoch；未完成 intent 让 index reader 为 dirty/building。不能在最后才打 dirty，留下 C 已变但 ready 仍可读的 gap。
3. current/history 每个文件写私有 temporary 并 fsync/rename；同时保存 recovery journal。commit manifest 最后 fsync + 原子替换；reader 只读一个已提交 input generation 的不可变清单。目录写完成但 manifest 未提交的文件不算本代。
4. 普通 delta 必须从同锁保护的 committed 前态计算。秒级文件名需不覆盖 identity；不得回写旧历史便利字段或伪造 observation。
5. import/merged/repair 是 **replace/backfill** 操作。整段先写 shadow input generation，再原子提交整段 manifest，禁止 delete-all 后发布零散文件；old prefix identity 改变必须 dirty/rebuild。
6. 对仍使用 legacy writer 的 source 默认 `unavailable/dirty`。提供在维护门禁内做的 bounded deep reconciliation；它能校验静止的历史，不能替代未纳管 live writer 的原子提交。文件 watch/mtime 只能作 hint。
7. source sequence 与 content hash 独立：可比较的提交序号由协议产生；hash 仅 identity。content hash、order key、来源、文件名、是否有效、current revision 都进入 fingerprint。
8. 审核和测试协议覆盖实际部署版本、dispatcher target 与运维入口。未知 writer 不能因为“没有观察到更新”被标成 ready。

在此合同得到授权并通过 writer integration 前，不构建依赖它的“可用索引”。

## 5. Manifest / checkpoint / fact 概念契约

```ts
type Manifest = {
  ownerId: string; bindingId: string; bindingEpoch: string;
  projectionVersion: string; canonicalAlgorithmRevision: string;
  generation: string; inputCommit: string; sourceEpoch: string;
  historyFingerprint: string; currentRevision: string;
  catalogRevision: string; // 或通过全字段验证的查询时 title overlay
  lastAppliedOrderKey: string | null; lastAppliedEvidenceRevision: string | null;
  coveredFrom: string | null; coveredThrough: string | null;
  coverage: "complete" | "partial" | "truncated" | "unknown";
  buildStatus: "ready" | "building" | "dirty" | "unavailable";
  factHash: string; checkpointHash: string; builtAt: string;
};
```

fact 必须直接保存/复现现有 `GrowthFact` 全字段，不引入新的证据等级。checkpoint 包含 state chart rows（裁剪至 replay 所需字段）、observed、**历史 bestScores**、未 finalize 的 day/chart facts accumulator、loader source barrier/counter 状态。不能复制整个私人 userdata/profile、Token/密码。业务数据仍是私人信息，即使去掉凭据也要按 binding 生命周期清理。

`canonicalAlgorithmRevision` 需固定实际 replay/projector/loader/calendar 规则 revision，projection schema 独立版本化；现有 measurement `modelRevision` 完全独立。源码/规则不兼容 → rebuild-required；不能将旧 index 默认兼容。

## 6. Incremental 与失效

Append 只在 old committed prefix 内容/来源/order 身份不变、new order 严格追加、same owner/binding/epoch/版本、有可靠 checkpoint、current overlay 和 catalog 契约已验证时准入。latest-2000 滑窗淘汰最早记录 **不是 append**：它改变 replay baseline/bestScores。未来如要保留淘汰前事实，必须另行批准来源保留合同，不能自动扩大历史存储。

旧文件替换/删除、same-size+mtime overwrite、backfill/import、source topology/counter change、canonical upgrade、current publication缺口、store corrupt、binding switch/delete：拒绝增量，dirty 或 unavailable。mid-history 局部 rebuild 只从 earliest affected 之前校验过的 checkpoint 启动，不能在下一个 full 提前结束（bestScores 可继续影响所有后继）。无法证明局部范围就全量重建。

## 7. Concurrency、generation 与生命周期

- 原型未来用 kernel `flock` 作单 binding/source build single-flight；不能以 stale lock TTL 删除活跃 writer 的锁。跨 host 不在当前已证明范围内。
- ready publication 是唯一线性化点：build 完整临时 immutable generation → schema/fact/checkpoint hash/parity 验证 → owner/current binding/source commit 复查及 CAS → fsync atomic pointer。重复 input/version 触发复用同 generation。
- 删除与 publish 必须共用 binding fence：先 DB 锁验证存活与 current 身份，再安装 pointer；delete 以同锁先设置 tombstone/revoke，再异步移除文件。文件/SQL 无联合事务，崩溃残留只能是不可被授权读出的 orphan，不能复活 binding。
- reader 持 generation lease 或读锁直至所需文件打开/读取完，GC 不删除活跃 generation。暂拟保留当前+上一 verified generation；体积/TTL/lease 未测，不能称 capacity PASS。
- rebind 同 Taiko ID 是新 binding identity；不能继承旧目录。路径由服务端映射、校验 owner/binding，不直接拼接用户参数；private mode 0700/0600、体积/读 bytes/单文件/超时/admission 均须限额。
- 首建最多一个隔离 builder，全局队列/去重/压力门禁；不在 2GiB Viewer worker 并行跑多个 13s replay。重试指数退避、有限次数、错误仅非敏感 reason。ENOSPC/损坏/中止保留旧内部证据但拒绝当最新返回。

## 8. 产品和 API 行为（只设计）

| 状态 | 将来的可见行为 |
|---|---|
| ready 且身份/commit/version匹配 | 读取验证代；current/Goal/measurement 一次获取，compose 四档最小 DTO |
| 首建缺失/进行中 | 正在整理成长记录；不推断无变化 |
| dirty、新同步或 repair 尚未投影 | 新记录尚在整理；不静默返回旧代 |
| partial/truncated | 只展示能确认的 coverage；不得升级全年完整性 |
| unavailable/corrupt | 可重试；不造 milestone |
| owner/binding 不匹配/deleted | 拒绝旧 binding 内容 |

本草案默认不返回 stale；若想显示上代，需另作产品决定，披露 as-of。接口继续 authenticated、`private, no-store`、`Vary: Cookie`，不接受 arbitrary user/binding 查询。Goal 按 DB 确认时间查询时合并；measurement segments/focus 独立；milestone 全年 importance/diversity/time-bucket 是下一阶段工作，当前 latest-8 composer 未改变。

## 9. 尚未完成的验收

24 类 fixture 的 read-model parity、mutations、crash/GC/delete、两个实际 worker single-flight 与 full 2,000-file/500-chart benchmark **均待 source Gate 解除后实施**。本轮 12 项诊断不能替代这些验证。B schema 仅候选草案：metadata 按 `(user_id,binding_id)` fencing；事实按 `(binding_id,generation,attributed_day,fact_type)` 及独立 observation 时间索引；应用事务清理，无 FOREIGN KEY/REFERENCES。没有 DDL、DB 隔离测试或生产 migration。
