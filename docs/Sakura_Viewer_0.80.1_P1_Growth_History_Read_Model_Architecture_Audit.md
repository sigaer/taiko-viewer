# Sakura Taiko Viewer · 0.80.1 P1

# Growth History Read Model Architecture Audit

## 单用户历史增量事实索引 / 在线轻量查询：设计审计与隔离原型

> **性质：架构审计 + 隔离 Proof of Concept；不是生产实现指令。**
>
> **开始实施前先读取仓库实际版本、工作区状态与既有审计报告。**
>
> 本阶段不得自行执行生产 DDL、写生产用户数据、部署、放宽性能预算，或开始 0.80.1 Temporal Passport UI。

---

## 0. 已确认事实与版本边界

- 生产 Viewer 当前仍为 **`0.80.0`**。此前提出的 `0.80.1` 是待实现阶段，不是线上已发布版本。
- P0 代码提交：`1dcf9c3`。日期格式化热点已修复，275 项回归通过；**该提交不等于线上已部署**，开工时核对它是否在当前工作树/分支中。
- ISO/full 2,000-file，500 charts/snapshot、约 283 MB 读取量：**12,834.76 ms**，超过已批准的 **3,000 ms** 历史管线预算。
- 其主要耗时：loader ~4,579 ms，canonical replay ~8,213 ms；selected DTO 序列化几乎不是瓶颈。
- Streaming 原型：`perf/growth-passport-streaming-prototype`，原型提交 `75177fa`；ISO/full ~13,240 ms，但 RSS 从约 417 MiB 降至约 203 MiB。**仅证明内存收益，不证明延迟通过**。
- 当前公开 `GET /api/account/growth/history` 仍保持 **≤90 天**；Passport 365 天仅为设计及离线试算。
- 尚未部署 Temporal Passport UI，无 365-day milestone 功能上线。
- 历史事实与来源边界仍以现有 canonical replay、Goal、Recent/Daily/Weekly/Passport 的既有契约为准。

### 已批准性能/资源 Gate（保持不变）

| 指标                                                            |      已批准上限 |
| --------------------------------------------------------------- | --------------: |
| 365-day load + replay + projection + selected DTO serialization |    **3,000 ms** |
| Passport 全量初载（含 Growth Python）                           |    **5,000 ms** |
| Period projection + milestone curation                          |  **30 ms 以内** |
| Worker process max RSS                                          |     **512 MiB** |
| QA cgroup peak                                                  |       **1 GiB** |
| 单次冷管线读入                                                  |     **300 MiB** |
| 新增 high / oom / oom_kill                                      |           **0** |
| 持续 memory / IO PSI full avg10 ≥2%                             | **10 秒即中止** |

**本轮不能把“索引命中查询 ≤3 秒”偷换为“365 天完整冷重建 ≤3 秒已通过”。**

如果最终采用“后台/离线可重建 + 在线轻量读模型”，必须在结论中单独提出 **新的在线 / 离线双 Gate 预算草案**，并等待用户明确批准。批准前原 Gate 仍视为 BLOCKED。

---

## 1. 为什么进入这一阶段

此前已经验证：

```text
现有在线路径
  → 读取 / 解析成百上千份 JSON snapshot
  → 依照 full/delta/来源/时间做 canonical replay
  → 生成历史事实
  → 只挑选少量 Passport 节点
```

在 ISO/full 压力上限下，即使日期热点优化和 streaming 减少内存，仍不能满足交互预算。

这一轮探索的方向：

```text
权威历史（文件）
        │
        ├─ 构建 / 校验 / 修复路径（允许异步，但需有专门预算）
        │     └─ 可重建、版本化的单用户事实投影
        │
        └─ 在线 Passport 请求
              └─ 轻量读取已验证投影
                    └─ 按 30 / 90 / 180 / 365 天生成代表节点
```

目标不是立刻发明新数据库，而是验证：

1. **读模型能否完整复现 canonical facts？**
2. **Append-only 情况能否从新增观察增量更新，而不是重扫全部历史？**
3. **旧历史被修改、补录、重排、修复时，能否正确失效和重建？**
4. **多 worker / 多设备 / 同步并发时，能否保证 owner、binding 和 generation 一致？**
5. **能够恢复多少历史？哪些情况下应明确显示 partial / truncated / unavailable？**
6. **在线性能是否真正显著改善，且不把成本隐藏到不可控的后台？**

---

## 2. 三项先行 Gate

### 2.1 Evidence Gate

原始文件是来源，派生事实只是其投影。不得因为“索引更方便”改变事实规则、事实日期或证据等级。

### 2.2 Cost Gate

开工前绘制写入、构建、查询、失效、重建五条 critical path；估算每条路径的 IO、parse、CPU、内存、Python、DB、响应大小和并发成本。

### 2.3 Product Gate

投影服务最终服务于**周期档案**，不是重新定义 Session，也不是将最近 90 天的事件排列成一份“365 天档案”。

只有三个 Gate 的设计均清晰之后，才允许构建**不接生产流量的隔离原型**。

---

# Part I — 代码/数据链路审计

## 3. 必须首先审计完整写入拓扑

核对实际仓库，而不是只依据旧文档。至少覆盖：

- Wahlap live sync、Hiroba live sync；
- Viewer / bot dispatcher 本地转存及重复 observation；
- `writeUserdataWithHistory` 与 Python `save_userdata`；
- Kinoko score/history import；
- web account edit / score import、manual profile；
- maintenance / repair / migration / 直接文件写入；
- Goal Evaluation（DB 确认事实，并非历史文件新游玩）；
- measurement 捕获（已独立持久化，不是历史六维回算）；
- 用户解绑、重新绑定、切换账号、删除账号；
- 现有可能绕过统一 writer 的外部 `/home/sigaer/taiko` 链路。

审计输出逐路径表：

| writer/source | 是否原子写入 | 影响的文件/DB | 产生的观察类型 | 是否可标记 index dirty | 能否顺序增量 | 失败/回滚行为 |
| ------------- | ------------ | ------------- | -------------- | ---------------------- | ------------ | ------------- |

**不能只给 Viewer writer 加 hook，就声称外部写入全部被覆盖。**

## 4. 审计现有 loader / canonical replay 的语义

请找到并记录：

- 历史文件排序键、同时间戳稳定 tie-break；
- latest-2,000 选取逻辑，full/delta 位置和 baseline；
- filename / `_meta.ts` / source / `imported_via` / `content_sha256` 的真实语义；
- valid / invalid / missing-baseline / regression 的处理；
- 观测日（observation day）与可信谱面游玩日（attributed play day）；
- 同谱同日合并、factKey、before/after、crown/rank 和 Goal 关联；
- `bestScores` / current attendance-only / 并列最高分的处理；
- 现有一次 replay 是否天然输出全窗口 canonical facts，还是由查询区间影响事实推导；
- 更新旧快照是否可能改变它之后的所有 facts（尤其窗口边缘 baseline）。

**旧文件只按 `mtime`、大小或 hash 值大小排序均不合法。** Hash 是内容身份，不是递增序号。

## 5. 365 天恢复能力与存储边界

区分四件事：

1. 磁盘上是否仍保存 365 天原始历史；
2. latest-2,000 loader 是否覆盖 365 天；
3. 365 天最早节点之前是否存在可靠 full baseline；
4. 预先建立的索引是否曾经覆盖较早历史，并在文件淘汰后仍有可验证的来源链。

**“索引里存在较早事实”不自动意味着其原始来源仍可复验；“目录里还有文件”也不意味着现有 2,000-file contract 自动提供全年完整性。**

不得从窗口不足、历史被截断、丢失前置 baseline 中推断“那段时间没有变化”。

---

# Part II — 候选架构，必须比较而不是先选技术

## 6. 候选 A：Per-binding Sidecar Read Model

例如绑定私有目录内的版本化 manifest + 原子替换的事实投影文件，或现有技术栈允许的轻量索引容器。

**审计要点：**

- 单 binding 文件数、容量、权限、原子写入方式；
- 多个 Nuxt worker 并发写与跨进程锁；
- 崩溃恢复：临时文件不被读作已提交版本；
- 生产多个进程是否共享同一存储卷；
- 文件损坏或被替换后的校验和修复；
- 文件系统所有权、删除和备份策略。

文件结构仅为示意，不是指定实现：

```text
private-growth-read-model/<binding-id>/
  manifest.json
  generation-000123.facts.*
  generation-000123.checkpoint.*
```

不得在真实生产路径中按此结构写文件，除非得到后续明确授权。

## 7. 候选 B：数据库派生事实读模型

如果数据库已适合这类查询，评估按 `binding_id`、attributed/observed 时间范围、fact type 读取的索引模型。

**必须说明：**

- MySQL 查询/索引、写放大、事务及锁竞争；
- 严格 owner + current binding 过滤；
- 删除生命周期和 orphan 审计；
- 表与索引增长估算（1k / 10k / 100k 用户）；
- idempotent upsert 与 generation 切换；
- 是否会把未授权的长期事实存储扩展带入生产。

既有项目约束：**不使用 FOREIGN KEY / REFERENCES**；清理由应用事务负责。

**此轮只能作 schema 草案与隔离测试，不能新增生产表或执行 migration。**

## 8. 候选 C：短期内存/进程缓存

必须客观评价：

- 多 worker 不共享、重启丢失；
- 首次查询仍然重放 365 天；
- 来源文件变化失效困难；
- 无法单独提供持久长期节点；
- 容易增加进程内存。

可以是性能加速层，但**不得把它当成主要的、可恢复的长期读模型**。

## 9. 候选 D：有界重放 + Checkpoint，仅加速恢复

可研究定期可靠状态检查点 + 后续 delta，而不直接持久化全部事实。

必须证明它解决哪种成本：

- 能减少从头计算当前状态；
- 但要找 365 天中发生的 milestone，仍需要该窗口的历史变化或事实投影；
- “只加载最近 checkpoint”不能还原 checkpoint 之前的 PB/FC 过程。

## 10. 决策输出

需要对 A/B/C/D 给出定量比较：

| 候选 | 在线冷查 | 在线热查 | 增量维护 | 回填/修复 | 原子性 | 多 worker | 清理 | 运维复杂度 |
| ---- | -------- | -------- | -------- | --------- | ------ | --------- | ---- | ---------- |

结论只能是：

- **A — FILE READ MODEL VIABLE**
- **B — DB READ MODEL JUSTIFIED**
- **C — CACHE ONLY, NOT A READ MODEL**
- **D — CHECKPOINT NEEDED BUT INSUFFICIENT ALONE**
- **E — NO APPROVED DESIGN; FURTHER AUDIT REQUIRED**

可以是 A+D 或 B+D 的组合，但必须说明各层各自承担什么责任。

---

# Part III — 索引正确性与可重建契约

## 11. Read Model 是 Projection，不是权威事实

建立清晰的三个层：

```text
raw snapshot/history + independent authoritative Goal DB
       ↓ canonical semantics
verified projection generation
       ↓ bounded period selection
Passport DTO
```

禁止向原历史回写“方便索引”字段；禁止修改历史事实判定来适配存储方式。

## 12. Read Model 最小数据契约（概念）

```ts
type GrowthReadModelManifest = {
  bindingId: string;
  userId: string;
  projectionVersion: string;
  canonicalAlgorithmRevision: string;
  generation: string;
  coveredFrom: string | null;
  coveredThrough: string | null;
  coverage: "complete" | "partial" | "truncated" | "unknown";
  lastAppliedOrderKey: string | null;
  lastAppliedEvidenceRevision: string | null;
  verifiedInputFingerprint: string;
  buildStatus: "ready" | "building" | "dirty" | "unavailable";
  builtAt: string;
};

type GrowthIndexedFact = {
  factKey: string;
  chartId: string;
  difficultyCode: string;
  type: string;
  before: unknown;
  after: unknown;
  attributedDay: string | null;
  observedAt: string | null;
  source: string;
  evidenceRevision: string | null;
  provenance: string;
};
```

这是**概念示意**，字段须从当前 canonical GrowthFact 精确映射，不能另起事实语义。`userId/bindingId` 只能来自经过授权的服务器绑定解析。不要在事实索引中复制账号密码、Token 或完整私人 userdata。

## 13. 版本与重建边界

索引必须记录：

- canonical fact composer/replay 版本或源码/规则修订；
- projection schema version；
- 输入历史序列 fingerprint（需可稳定重现）；
- build generation 与覆盖起止；
- source provenance 的可信边界；
- 失败/中止原因（只记录非敏感诊断）。

**注意：** 0.70.0 `modelRevision` 用于 Rating/六维测量分段，不能直接拿它当 canonical score facts 的投影版本。它们是两个不同版本系统。

不得在源码升级后继续把旧 projection 默认为兼容；明确 `compatible / dirty / rebuild-required`。

## 14. 哪些情况允许 Append Incremental？

仅当证明：

1. 已提交的历史前缀**没有**改变；
2. 新条目有稳定且可比较的有序位置；
3. 旧 prefix 的内容与来源身份未失效；
4. 有可靠 replay baseline/checkpoint；
5. 没有 history import/backfill/reorder/repair 改动已索引区间；
6. index generation 与 current binding 未切换；
7. canonical replay 增量与全量回放事实一致。

方可只处理新增条目。

**同一新 full snapshot 500 行仍可能需要 O(500) 对比，但不应该自动退化为 O(2,000 × 500)。** 如果存在 0 变化的同步，也必须遵守原始 observation、source、revision 和 attendance 语义。

## 15. 非 Append 的修复策略

遇到以下情况，**不得盲目追加事实**：

- 较早文件被替换、删除、同名覆盖；
- 历史批量 import 或按旧日期回填；
- writer provenance 修复、source change；
- 文件时间与内容顺序出现冲突；
- full/delta baseline 消失、链条断裂；
- counter 回退，或修改了某个过去状态使后继事实变化；
- canonical fact algorithm 更新；
- projection store 损坏；
- current binding 发生变化。

允许设计从**最早受影响位置之前的可靠 checkpoint**局部重建；不能证明局部范围时，按新 generation 重新构建。

重建失败：保持旧 generation 可供内部验证，但在线不得把它呈现为“已是最新且完整”。

## 16. Fingerprint / Dirty 检测不是一句“比较 mtime”

必须明确两类写入：

1. **受控 writer**：可记录 committed generation/变更 manifest/dirty signal；
2. **未受控 writer**：只能通过可检验的目录/内容一致性扫描或可信 manifest 机制发现变化。

分析 `size + mtime` 可能漏掉同尺寸/保留时间戳的覆盖；每次读取全量 SHA 又可能重引入高成本。

提交成本实测与安全方案：例如 writer-side committed manifest + 后台定期 deep reconciliation + 查询时 O(1) generation 验证。未解决外部 writer 一致性以前，不得宣称“增量索引已自动覆盖所有同步入口”。

## 17. 并发读取与原子 generation 切换

设计明确线性化边界：

```text
write snapshot/history complete
→ provenance/manifest commit
→ index builder sees committed input generation
→ build next read-model generation
→ validate
→ atomically publish ready generation
```

读请求必须看到**一个完整 generation**，不能从“旧 manifest + 新 facts 文件”混读。

并发场景必须测试：

- 两个 worker 同时尝试更新；
- writer 正在写入而用户打开 Passport；
- 先读绑定 A 后用户切到 B；
- 删除用户与 index builder 竞态；
- builder 异常退出留下临时文件/未提交 DB 行；
- GC/清理旧 generation 与正在进行的 read；
- 同一输入被重复触发多次 build。

引入数据库锁、文件锁或 generation CAS 均需提供准确契约；不能假设单进程。

## 18. Goal 与 Measurement 的独立事实边界

- Score facts 从 authoritative snapshots 归纳；
- Goal completion 由已存在的 Goal DB/evidence 确认，可能晚于 score observation；
- `completedAt` 是 Viewer 确认时间，不是实际游玩日；
- 不匹配的 Goal 保持 observation-only；
- measurement 是不可历史回算的当时 Rating/六维观察，不由 score fact index 反推；
- Passport 模型/算法版本分段继续独立有效。

必须审计 Goal 是按查询时合并还是单独触发索引 invalidation，禁止把 Goal 只写入 DB 却遗漏最终 Passport 的 milestone。

## 19. 异常时的产品状态

至少区分：

| 索引状态                       | 在线行为                           |
| ------------------------------ | ---------------------------------- |
| `ready` + fingerprint/版本匹配 | 读取已验证投影                     |
| `building`，首次缺失索引       | 显示“正在整理成长记录”，不说无变化 |
| `dirty`，有较新同步尚未建立    | 明确“新记录尚在整理”，不宣称最新   |
| `partial` / `truncated`        | 只列出可确认的覆盖，披露范围       |
| `unavailable` / corrupted      | 可重试，不生成虚假完整节点         |
| current binding 不匹配         | 禁止返回旧账号投影                 |

是否允许展示上一次已验证但已落后的 generation，必须在产品层单独决定并披露 **as-of 时间**；不得默认静默返回 stale。

---

# Part IV — 隔离原型与实验设计

## 20. P1 Prototype 的隔离要求

允许创建测试目录、独立 worktree、纯函数/adapter、合成输入、影子索引。**禁止**：

- 修改生产表、生产用户文件和 live writer；
- 接入生产 API 真实响应；
- 部署 staging/production（除非用户另行授权）；
- 将实验 sidecar 直接放进生产用户目录；
- 擅自合并到共享 Growth 服务；
- 修改既有 90d public History validator；
- 更改 P0 批准预算。

可以只读生产样本作 aggregate 对照，禁止输出账号 ID、用户名、原始分数 JSON 或 Token。

## 21. 必须先冻结 canonical 对照样本

在改写任何导出/回放实现之前，保存严格的 golden：

- score facts 全字段和稳定 factKeys；
- before / after / source / provenance / attribution；
- Goal 桥接（匹配与不匹配）；
- coverage、truncated/partial/unknown；
- full/delta 顺序、无 baseline、invalid；
- 同日多次观察、上海跨日/时区、regression；
- repeat build 的 byte-for-byte 或 canonical normalized equality。

以 **全量结构等价**为主，不接受只比较“事实数量一致”。

## 22. Fixture 矩阵

至少 20 类：

1. 单 full baseline + 新增 full；
2. full → delta → delta；
3. 两个相邻快照内容一致；
4. 只有一首 PB；
5. PB + NG + FC 同谱同日；
6. 同日多 revision / 合并；
7. ISO Z / +08:00 / UTC 跨上海午夜；
8. 无 full baseline；
9. invalid JSON / songs=null；
10. latest 2,000 / 2,001 丢弃旧文件；
11. import/backfill 插入较早历史；
12. web/manual/edit/dispatcher / unknown source；
13. counter regression / 来源拓扑变化；
14. 同文件原地修改（内容变大小变）；
15. 同大小、mtime 不变但内容改变；
16. 删除历史中间快照；
17. Goal completed 与 score fact 精确匹配；
18. unmatched Goal 不伪造游玩日；
19. 绑定 A/B 切换及解绑清理；
20. 并发 writer/build/read/删除；
21. 构建中 crash / partial generation；
22. canonical algorithm revision 改变；
23. 测量分段变更但 score facts 不变；
24. 365d 窗口早期高价值节点、晚期 PB 洪峰。

每个 fixture：

```text
Input topology
Canonical expected facts / coverage
Incremental read model results
Full rebuild results
Invalidation action
Identity / generation checks
PASS / FAIL
```

## 23. 等价性 Gate

必须同时验证：

- cold full canonical replay == cold read-model build；
- incremental build == 全量重建最终 generation；
- 输入顺序变化但语义顺序相同 → 结果稳定；
- 被修改的旧历史 → 索引失效 / 正确重建，不保留错误旧事实；
- 故障中止 / 重跑 → 幂等；
- privacy cleanup → 不可再读取旧绑定；
- 30/90/180/365 共用底层事实，窗口日期语义一致；
- public 90d History 结果不变。

不得通过调整 expected golden 来满足新实现。

---

# Part V — 性能、容量与并发 Gate

## 24. 性能测试分离四条路径

1. **Full rebuild**：首次缺少索引，重建 365 天（不在用户 HTTP 请求关键路径假定完成）；
2. **Append incremental**：单次新同步仅改变 0/1/5/50/500 charts；
3. **Clean indexed query**：已验证 generation 的 30/90/180/365 周期读取；
4. **Dirty/rebuild/query race**：文件变更后如何保持正确且可见。

不能只测第 3 条，然后宣布端到端系统性能通过。

## 25. 压力输入

继续复用可复现的：

- 真实只读高活跃 profile（仅 aggregate）；
- ISO/full 2,000 files × 500 charts（约 283 MB）；
- local/full 对照；
- 真实 full/delta 混合；
- 无 baseline / invalid / truncated；
- 1 个用户短时间多次同步；
- 多个不同用户的并发首次初始化 / 已命中查询。

沿用 P0 的 QA wrapper、watchdog、checkpoint 和资源护栏。不要与 build/deploy 并发测试。

## 26. 必须采集的成本账本

每条路径至少：

- number of files/stat/open/read、bytes、JSON.parse 次数；
- snapshot materialization / canonical visit rows；
- append detection / fingerprint 时间；
- incremental apply / partial rebuild / full rebuild 时间；
- projection query / curation / serialization；
- worker RSS / heap / external / arrayBuffers；
- QA cgroup memory.current、可用时 memory.peak；
- memory/IO PSI，high/oom/oom_kill 增量；
- response bytes、warm/cold、p50/p95/max、并发条件；
- 首次 ready 所需耗时、用户看到 `building/dirty` 的时长；
- 索引磁盘或 DB 占用、每个事实平均增量字节；
- 回放和原始输入是否被多读多次。

若 peak / IO 字段无法访问，写 `unknown`，不可以用 100ms 采样值冒充峰值。

## 27. 新在线/离线预算草案——必须等待授权

建议在报告中独立提出、**不要视作已批准**：

| 路径                      | 建议关注指标                                                  | 是否已批准 |
| ------------------------- | ------------------------------------------------------------- | ---------- |
| 已验证索引的 Passport GET | p50/p95，含 current Growth、Goal、measurement 与 selected DTO | 否         |
| 30↔90↔180↔365 切换        | 网络 / Python / replay 增量与浏览器交互延迟                   | 否         |
| append 更新索引           | 每同步新增 CPU/IO、worker 内存、p95                           | 否         |
| 首次离线 full rebuild     | 单用户资源上限、watchdog、吞吐、排队时长                      | 否         |
| dirty / 版本变化重建      | 最大 stale/building 时长及恢复策略                            | 否         |

已批准的 3,000ms/5,000ms 预算继续作为**现有 365 cold pipeline 的阻断标准**。转向新架构的任何“重新定义 Gate”都要求用户明确授权。

## 28. 容量模型

提供至少三种活跃度：

- 低频：每周少量新观察；
- 常规：每日 1–数次同步；
- 高频：一日数十次同步或高密度导入。

在 1k / 10k / 100k binding 规模估算：

```text
事实数 / binding / 年
索引平均字节 / fact
manifest/checkpoint 字节
总存储及月增长
索引更新写放大
重建队列峰值
保留及垃圾回收成本
```

所有系数区分“实测”与“假设”。不得用一个高活跃 profile 的样本宣称代表全部用户。

---

# Part VI — 未来 Temporal Passport 的接口边界

## 29. 当前阶段只设计、不上线

未来目标仍为：

```text
GET authenticated Passport
  → validate current user/binding
  → get current Growth at most once
  → load current/measurement/Goal once
  → read validated Growth Fact Read Model
  → compose 30/90/180/365 periodViews
  → serve minimal DTO
```

`GET /api/account/growth/history` 原有 90d 上限不变。

索引与查询之间必须检查 owner、binding、generation 与 version；私有 API 保持 `private, no-store`、`Vary: Cookie`。

## 30. 未来内容投影继续遵循原 Passport 契约

- 固定显示 30/90/180/365 选择，不因只有 4 天 measurement 隐藏；
- 当前 Rating/六维/Goal/Today Plan 是 **current**，不是历史平均；
- Rating 同测量 segment 连线，跨版本断线；
- 六维趋势不回算历史、不可跨段连线；
- focus 独立轨迹，不进入 Rating 数值 tooltip；
- milestone 来自 365d 可确认事实，按重要性、类型多样性、时间覆盖选取；
- 同谱同日合并、同日/同谱/类型限制及时间桶；
- 缺失、partial、truncated、dirty 都不得伪装成完整 365 天档案。

本轮不得以审计之名提前改这些 UI。

---

# Part VII — 安全与生命周期

## 31. 访问控制

- 服务端自行解析 logged-in web user 与 current binding；
- 不接受前端 arbitrary `user_id` / `binding_id` 选择；
- 每次 read/build/cleanup 都校验 binding ownership；
- 投影不包含 Score Token、Service Token、Cookie、原始认证信息；
- sidecar 若落盘，只能在私有路径；路径不能由 taikoId 或用户输入直接拼接；
- 限制事实大小、文件读取总 bytes、单文件大小、索引体积和并发构建数量。

## 32. 删除 / 重绑定

- unbind：删除当前 binding 的整个索引与 generation；
- delete user：清理全部所属绑定索引；
- rebind 相同 Taiko ID：新的 binding identity，不能继承旧 index；
- builder 运行中删除绑定：最终 publish 必须失败并销毁临时产物；
- 无 FK 设计时必须有应用级 cleanup/orphan/owner mismatch 审计。

## 33. 故障与运维

审计：

- generation 数量/旧版本清理策略；
- 单 binding 重建锁与重试退避；
- 读模型损坏检测；
- 存储空间不足与磁盘错误；
- 部分写入与断电恢复；
- backfill/reconcile 的优先级和限流；
- 多用户同时冷建对 2 GiB Viewer MemoryMax 的影响；
- 合成账号生产 smoke 和正式清理的步骤。

**不允许将 13 秒 × N 个用户的冷重建直接并发塞进 Web worker。**

---

# Part VIII — 必须交付的文档和原型

## 34. 文档

在仓库 `docs/` 创建：

1. `growth-history-read-model-audit.md`：写入拓扑、语义、现状成本与风险；
2. `growth-history-read-model-architecture.md`：A/B/C/D 对比、选择理由、数据契约与失效恢复；
3. `growth-history-read-model-benchmark.md`：逐阶段性能、资源、容量、concurrency 与缺失指标；
4. `growth-history-read-model-decision.md`：Gate 结论、预算草案、后续授权事项。

不必四份文档完全重复事实，可引用共享章节；但四个主题必须独立可检索。

## 35. 隔离原型产物

- 独立 test worktree 或测试专用模块；
- deterministic manifest / candidate fact store adapter；
- append update 与 dirty/rebuild prototype；
- canonical equality/golden 测试；
- 真实只读 aggregate 与 synthetic 2,000-file benchmark；
- 持续资源指标和 watchdog；
- 生成/清理产物清单。

不得通过 `git add -A` 意外提交旧的无关工作区变更。实验大型文件与用户私密数据不进入 Git。

## 36. Codex 执行顺序

```text
Phase 0 — Version/workspace/preflight
Phase 1 — Writer + canonical replay topology audit
Phase 2 — Cost model + candidate A/B/C/D comparison
Phase 3 — Golden fixtures + isolated read-model PoC
Phase 4 — Append / mutation / crash / multi-worker parity
Phase 5 — Real + synthetic + concurrency cost benchmark
Phase 6 — Architecture decision + new budget proposal
STOP — 等待用户批准后续生产实现
```

若 Phase 1 发现外部 writer 一致性无法封闭，提前出 `BLOCKED`，不要在其上搭脆弱索引。

---

# Part IX — Release / Decision Gate

## 37. 禁止提前宣称完成

存在以下任何问题，不能进入生产实现：

- canonical facts 仅“数量相等”，全字段不一致；
- 无法发现旧文件变动或补录；
- 索引把 hash 当递增顺序；
- 无法区分已验证/正在构建/脏索引；
- writer 与 reader 可能读到半成品 generation；
- import/manual/repair 改变证据等级；
- completedAt 冒充 play day；
- 缺失 baseline / 2,000 截断却显示 complete；
- public History 的 90d contract 被改动；
- profile switch / unbind / delete 遗留或串用索引；
- 测试跳过 ISO/full 真实上限；
- 只测命中延迟不测索引增量、重建与并发；
- 修改现有 3s/5s 预算未经批准；
- 新增生产表或文件索引、部署或 UI 修改未经授权。

## 38. 阶段结论格式

满足所有审计、PoC 和报告要求时，只可写：

```text
0.80.1 P1 GROWTH HISTORY READ MODEL ARCHITECTURE AUDIT COMPLETE

AUTHORITATIVE HISTORY BOUNDARY PRESERVED
CANONICAL FACT PARITY [PASS/FAIL]
APPEND INCREMENTAL PARITY [PASS/FAIL]
HISTORICAL MUTATION INVALIDATION [PASS/FAIL]
GENERATION / SNAPSHOT CONSISTENCY [PASS/FAIL]
USER / BINDING ISOLATION [PASS/FAIL]
COVERAGE / TRUNCATION SEMANTICS [PASS/FAIL]
ONLINE QUERY COST MEASURED
INCREMENTAL MAINTENANCE COST MEASURED
OFFLINE REBUILD COST MEASURED
CAPACITY / MULTI-WORKER COST ASSESSED

DECISION = [FILE | DB | CHECKPOINT+INDEX | BLOCKED]
NEW ONLINE/OFFLINE BUDGETS = PROPOSED, NOT APPROVED
PRODUCTION VIEWER REMAINS 0.80.0
NO TEMPORAL UI / NO PRODUCTION SCHEMA / NO DEPLOY
```

若有不可解决的来源一致性缺口，或原型无法验证：

```text
GROWTH READ MODEL ARCHITECTURE — BLOCKED
REASON = ...
REQUIRED INPUT / DECISION = ...
```

**本轮即使找到可行架构，也不能写 `0.80.1 TEMPORAL UX COMPLETE`。**

---

## 39. 最终报告必答 36 项

1. 工作树/分支/版本/P0 提交位置？
2. 所有实际写入路径及外部 writer 是否已覆盖？
3. 哪些写入受控，哪些只可 reconciliation？
4. 当前排序/2,000-file/baseline 的真实契约？
5. 原始 snapshot 的可靠内容身份是什么？
6. canonical score facts 的版本边界是什么？
7. 是否仍严格保留 Goal 和 measurement 独立语义？
8. 候选 A/B/C/D 的结论与成本？
9. 推荐索引存储介质及拒绝其他介质的理由？
10. manifest / generation 概念 schema？
11. append incremental 的严格准入条件？
12. 旧历史改写如何发现？
13. 同大小/mtime 覆盖怎么处理？
14. import/backfill/reorder 如何失效？
15. canonical 规则升级如何失效？
16. mid-history 变更是否可局部重建？
17. checkpoint 的作用和边界？
18. 365 天可验证覆盖如何定义？
19. latest-2,000 对旧节点的影响？
20. 失效/损坏/离线重建中，用户会看到什么？
21. 并发 writer/build/read 的一致性策略？
22. 两个 worker 同时 build 怎么去重？
23. profile A/B、unbind、delete 的隔离/清理？
24. 原型 full rebuild 与 canonical facts 全字段是否相同？
25. 增量 update 与 full rebuild 是否相同？
26. 历史 mutation / crash fixtures 是否通过？
27. ISO/full 2,000 原始测试的 read-model 构建成本？
28. 在线命中 p50/p95 与 payload bytes？
29. 单次增量写入成本（0/1/5/50/500 变更）？
30. 冷建/重建的 CPU、IO、RSS、PSI 与时间？
31. 多用户并发容量与限流方案？
32. 当前批准 3s/5s Gate 是否仍 BLOCKED？
33. 新在线/离线预算提案是什么，是否等待授权？
34. 是否有任何生产 DB/业务文件/UI/版本变更？
35. 是否修改 public 90d History 或下游 Goal/Recent/Daily/Weekly？
36. 下一阶段生产实施的最小可交付范围与明确阻断项？

---

## 40. 原则

最终系统可以为每位用户维护一份私有、可重建的成长事实索引，但不能改变一个关键事实：

> **历史快照只证明系统观察到的成绩状态变化，不能自动升级成真实街机 Session；派生索引也不能比原始证据更确定。**

本次 P1 的价值是把性能和一致性风险在生产施工前测清楚，并选择可以长期维护的读模型，而不是把当前 12.83 秒回放藏在另一个没有监控的地方。
