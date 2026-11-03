# Growth History Read Model：写入与 canonical 审计

日期：2026-10-08（Asia/Shanghai）。基线：`main` / `1dcf9c3`，Viewer package **0.80.0**。

**Phase 1 = BLOCKED：目前没有所有 writer 共同遵守的输入提交边界。按任务文件 §36 的提前停止规则，未进入 read-model PoC。** 本报告不是 P1 全阶段完成报告，也不改变 P0 的性能 Gate。

任务来源：[P1 Architecture Audit](Sakura_Viewer_0.80.1_P1_Growth_History_Read_Model_Architecture_Audit.md)。关联：[架构](growth-history-read-model-architecture.md)、[成本](growth-history-read-model-benchmark.md)、[决策及 36 项回答](growth-history-read-model-decision.md)。

## 1. 开工状态与审计边界

- `HEAD=1dcf9c3`，P0 formatter 修复就在当前 main；此前 streaming PoC 为另一个 worktree/分支 `perf/growth-passport-streaming-prototype` / `75177fa`，未合并。
- 既有年度社区 feature worktree 未修改。本任务不属于年度 Poster Phase B。
- 开工 `git status`：业务文件 `taiko_viewer/assets/data/title_song_relations.json` 有既有修改；另外有用户的 P1/P0/Temporal/voice 审计等未跟踪文档。全部保留，未暂存、重写或纳入本任务。
- 仅新增四份审计文档和一个测试专用诊断模块；没有 live writer、共享 Growth、UI、版本、生产 schema、用户文件或部署修改。
- 外部 `/home/sigaer/taiko` 仅只读源码检索。没有执行 Python 模块：这些模块可能在 import 时读取凭据、初始化 runtime 或访问 DB。
- 审计覆盖下列仓库可定位入口；不能证明任意运维 shell、历史脚本副本、未盘点的远程 dispatcher 都已纳管。源码存在也不等于每种入口当前有生产流量。

## 2. 实际写入拓扑

`H` = `<userdataDir>/<taikoId>/data_*.json`；`C` = `<userdataDir>/<taikoId>data.json`。实际 Viewer service 配置与 Python 默认路径均指向 `/home/sigaer/taiko/userdata`，是共享的本机文件系统，不是各 Nuxt worker 私有目录。

| writer/source 与定位 | 原子性 / 锁 | 文件 / DB | 观察类型 | dirty 能力（现状） | 顺序增量准入（现状） | 失败 / 回滚 |
|---|---|---|---|---|---|---|
| Wahlap：外部 `plugins/utils/update_user.py:getUserData` → `userdata_storage.py:save_userdata` | C、H 都 `open(...,"w")`；无共享锁 | C；首次 full、后续 H delta；读 DB 谱面锁 | `wahlap`；schema v2、content hash、账号/拓扑元数据 | 无 input generation；可未来统一 writer | 不可承诺：delta 从无锁 C 推导 | C 已写而 H 失败不回滚；并发可能使用不同前态 |
| Hiroba：外部 `plugins/utils/hiroba/sync.py` → 同一个 `save_userdata` | 同上 | C / H | `hiroba`，来源切换另有 barrier | 同上 | 同上 | 同上 |
| Viewer proxy update / sync-hiroba：`server/utils/taiko-center.ts:proxyTaikoCenterUserdataUpdate/proxyTaikoCenterHirobaSync` | 前者 dispatch `sakura-bot`；后者启动 Python `sync_hiroba_userdata`，没有独立 writer 锁 | 同上述 C / H | 分别 dispatcher-transfer / hiroba | 无 | 不能以 proxy route quota 代替 source commit | 复用上述失败边界；proxy image 不是 history 提交证明 |
| Viewer sync dispatcher：`server/utils/account/sync.ts:submitAccountSync` → `internal/account/sync.ts:requestSyncDispatch` → 外部 `scripts/sync_dispatch_server.py:write_local_snapshot` | C、H `write_text`；没有跨 writer 锁/commit | C / H、web sync log | 转存 `sakura-bot-sync`；可能与上游 observation 重复 | web sync log **不是**内容提交证明 | 不可；转存 delta 与其他 writer 竞态 | 两文件不能一起回滚；目标可部分成功 |
| Viewer 公共 helper：`server/internal/account/shared.ts:writeUserdataWithHistory` | C 临时文件 rename；H 直接 `writeFile`；helper 本身不加锁 | C / full H | source / writer_source 显式保存 | 未写 dirty/commit；未来可接 | 不可作为全部入口的证明 | C 成功后 H 失败无回滚；秒级同 source 文件名可覆盖 |
| Web edit/create：`server/utils/account/songs.ts:updateAccountSong/createAccountSong` | 当前调用 helper **未包** `withUserdataWriteLock` | C / H；create 可写谱面锁 | `web-account` / manual | 无 | 即使同 Node worker 也未全面串行 | create 失败尝试撤销新增谱面锁，不回滚已发布 C |
| Web score import：同文件 `importAccountSongs` | `withUserdataWriteLock` 是进程内 Promise Map | C / H | `web-score-import` / content-edit | 无 | 不覆盖 Python/另一 worker | 文件发布仍非整体事务 |
| Kinoko score import：`server/utils/account/sync.ts:importKinokoScores` | 进程内锁；changed 时 helper | C / full H、sync log | `kinoko-import` / import | 无 | 不能升级到 authoritative live observation | 已写文件与日志不能原子提交 |
| Kinoko history：`importKinokoHistory` → `internal/account/kinoko-history.ts:writeKinokoHistorySnapshots` | 每个 H 临时文件 rename；批次无原子 commit；锁仅进程内 | 回填 full baseline + 多个 delta H；必要时 C / H；上限 10,000 | `source=wahlap` 但 `imported_via=kinoko-history` | 无批次 revision/dirty | **必须 rebuild**，历史位置可早于旧前缀 | 某文件失败时先前已发布文件不撤回；可重试去重，但读者可见中途状态 |
| Manual create/rename/score/delete：`server/utils/account/manual.ts`；web/internal manual endpoints 共用 | create helper；其他多用进程内锁 | C / H、manual account/bind/谱面锁 DB | manual，不得视为可信游玩 | 无 | 无 score history（manual binding History 当前跳过 replay） | 文件与 DB 非单事务；失败细节随入口不同 |
| 外部 merged binding：`plugins/utils/merged_bind.py` | Python 本进程线程锁；单 JSON 临时文件 replace | 虚拟 C、整段 H | 合并/拓扑变化；payload 可能没有 live provenance | 无 | 重建路径先删除所有 H 再逐文件写，绝不能 append | 中途崩溃可留下空/不完整 H；单文件原子性不等于整段原子性 |
| Maintenance / repair / migration / 直接覆盖 | 未找到通用 history 写入协议或全局锁 | 可覆盖、删除、补录 C/H；外部 merged 已是实际实例 | repair/backfill/migration 必须保留边界 | 只能 reconciliation，未证明在线 freshness | 不可自动纳管 | 任意 shell 不能靠 Viewer hook 覆盖；需维护入口登记和 quiescence/commit |
| 外部 `scripts/storage_maintenance.py` / `taiko_admin_backup.py` | 前者明确保护 userdata；后者受管目录/表不含 history | 不改变本链路原始 history | 非 score observation | 不适用 | 不适用 | 不把普通缓存/备份维护误列为 history writer |
| Goal Evaluation：`services/goals/evaluation-store.ts:evaluateStoredGoal` | owner→binding→goal 行锁，应用事务 | `web_player_goals` | DB 确认事实，非新 H | 不能依赖 score index dirty；查询时合并 | 独立事实，不做 score append | 事务 rollback；`completedAt` 与 capturedAt 独立 |
| Measurement：`services/account/growth.ts` → `growth-history/measurements.ts` | `INSERT IGNORE ... SELECT` 验 owner/binding | `web_growth_measurements` | 当时 Rating/六维/focus | 独立查询/segment | 不由 score history 推算 | 捕获失败不制造历史测量；不运行认证 GET 作“只读 QA” |
| switch / unbind / rebind：`utils/account/bindings.ts`、`internal/account/shared.ts`、`goals/lifecycle.ts` | 删除 owner/bindings 行锁及事务；switch helper 是两条 UPDATE | current binding、Goal/measurement/recent cursor 清理 | 生命周期，非游玩 | 当前无 read-model 清理项 | 必须 binding identity + epoch fence | 不能只按 Taiko ID 复用；现有主档案 start/end binding 检查不能替代新 builder publish fence |
| delete account / permanentlyDeleteManualAccount | 前者应用事务；manual 先将 C/H 移入 `.manual_deleted` 再多项 DB 清理 | owner/bindings/事实；manual C/H 备份 | 生命周期 | 需新 projection tombstone 与 orphan 扫描 | delete builder publish 必须失败 | 文件与 DB 边界不同，不可声称已有跨介质事务 |

**受控与未受控的准确含义：** Viewer helper/Kinoko/生命周期可以在未来授权的生产改造中纳管，当前一个都没有新协议的 committed input generation；Python/dispatcher/merged/运维入口必须一同纳管或明确拒绝索引服务。不能将“能修改 hook”写成“已经纳管”。

## 3. Loader 的实际契约

权威定位：`server/services/growth-history/evidence.ts`、`constants.ts`。

1. 只枚举 `data_*.json`，`fileOrder = 文件名解析到秒的时间数字（补足14位） + ':' + 完整文件名`；`localeCompare` 排序再 `slice(-2000)`。同秒微秒/后缀通过完整名字 tie-break；未解析文件名的时间前缀为零。**不是 mtime，也不是 content hash 大小。**
2. 先截断后 parse；不会为 dropped baseline 额外向前找 full。`filesRead` 是选中的文件数，valid snapshots 数需减 invalid。
3. snapshot timestamp 的优先级：`observed_at → observedAt → synced_at → ts → filename`。时间为空/非法时，观察为 L0；compact `_meta.ts` 不必能作为 ISO 解析，`synced_at` 因而关键。
4. 全文件 raw bytes 的 SHA-256 是 `revision`。声明的 64-hex `content_sha256/contentRevision/content_revision/revision` 只是另一个 content identity 元数据，不是单调序列，也没有在本 loader 中复验声明 hash。
5. Python `content_sha256` 是排除该字段后 ujson sort_keys 的语义序列化 hash，不等于 raw bytes hash。Goal provenance 有专门校验，并保存浮点字面量等编码细节；不能拿一种 hash 替代另一种。
6. `full=true` 或 **完全没有 `_meta`** 且 profile+achievement+songs full shape 才判 full；Kinoko importer 的 inspection heuristic 与 Growth loader 不完全相同，不能直接复用 importer baseline 判断。
7. replay 顺序是文件顺序；observations 另按 `observedAt → orderKey → revision` 排序。两套顺序可不同。排序冲突需保留原契约并阻止未经验证的 append，不能按 observation 次序悄悄重放。
8. loader 前态用于 counter regression / changed event days / 来源 barrier；会应用 `songs_removed`。invalid JSON、非数组 songs、读取失败计 invalid 并跳过。
9. writer_source > filename 已知 writer source > `_meta.source`。import/manual/repair/content-edit/dispatcher/unknown/regression/source-switch/discontinuity-baseline 影响 **Recent L0/L1**。这些排除并没有把 snapshot 从 score canonical replay 删除。改变这个规则属于事实变更，本轮没有做。
10. in-flight Map 仅合并同 Node 进程的同时 load，不是持久缓存、cross-worker 锁、文件事务或 fingerprint validation。

## 4. Canonical replay 与投影

定位：`utils/dailyProgress.ts`、`utils/growthHistory.ts`、`growth-history/service.ts`。

- **所有选中 snapshot 都 replay**；requested day 集合只控制 chart event 的归档。state / observed / bestScores 的更新不由查询起止过滤。因此同一固定输入可以一次构建较大日集合再投影较小窗口，但不能去掉 window 外的前态。
- full 重置 state / observed，delta 中每一行是完整 chart record，缺字段不从旧行补齐。**bestScores 在 full 之间继续保留历史最大值。**从任意 full 当作完整 checkpoint 重建会改变后续 PB 判定。
- score PB 必须有 before，并有更晚 highscore 时间且高于 bestScores；并列最高分不成为 PB。NG/combo 要可比且同总 judgment。crown/rank 的可信当日归属另需 before/update 或 observedBefore 同日关系。回退不是进步，但回退后的恢复仍受 bestScores 约束。
- observed day 与 highscore/update 的 attributed play day 分开；ISO offset 使用上海日历，不可将文件名日或 Goal completedAt 当 play day。
- 同谱同日 chart 累积事实；before 保留该类型首个值，after 按方向取最高/最低，factOccurredAt 更新；factKey 由 binding/day/song/difficulty/type/before/after 固定编码。没有 stage/session 推断。
- **current attendance-only 不是新历史 transition，但会进入 `getChart` 并覆盖 chart 级 `evidenceRevision`/snapshotKind；已有 PB 等的来源 revision 也可能改为 currentRevision。**新索引必须精确保留这个现状：current overlay 与未经 finalize 的 chart accumulator，或把 current/catalog 一起列为输入。只 fingerprint H 无法复现全字段 facts。
- 即使新增 full 的 chart score 内容完全相同，`getChart` 仍可更新已存在同日事实的 observedAt/revision；事实数量和 factKey 不变不代表整份投影不变。0 变化同步必须处理这些 observation/provenance 更新，不能直接 no-op。
- title 回调来自现时 catalog（及 song_name fallback）；catalog 更新会改变完整事实的 title，不改变 factKey。可设计查询时重做 title overlay，但须验证全字段等价。
- replay 的 `songs_removed` 与 loader 不一致：`GrowthSnapshot` 没传这个字段，daily canonical 没应用它。必须原样保留或在另一次已授权语义修复中处理，不能在索引实验中顺便“修正”。
- once finalized 的 played fact 不能直接当新 transition 累积器：以后同日出现 PB 时需要移除 attendance-only headline。checkpoint 需要保存原始 accumulator，不能仅保存已格式化 DTO。
- score projection 输出完整既有 `GrowthFact`，包括 owner/binding、title、before/after/delta、evidence source/revision/version/provenance、temporal attributed/occurred/observed/confirmed/precision。新增 sidecar 不能另造一套 schema 解释它。

## 5. Goal / measurement / 生命周期

- `growth-history/goals.ts` 在每次 History 请求按 owner+binding 和 **completed_at** 时间范围查询并校验存活 owner/binding。Goal query 与 score facts 一起 compose；未来保持查询时合并，避免 Goal 只写 DB 而索引遗漏。
- `projectGoalFact`：attributedDay/occurredAt=null，observedAt=observationCapturedAt，confirmedAt=completedAt，precision=observation。Weekly/Passport 仅按既有 exact revision 或 before/after 等规则桥接；未匹配仍 observation-only。
- measurement 独立、不可回算；`measurementVersion/algorithmVersion/modelRevision` 控制 segments，**modelRevision 不是 canonical score algorithm revision**。
- 当前 Passport 服务先取 initial binding，调用 current Growth 一次，再取 measurements+coverage 和 90d history，最后复查 binding。未来仍需私有无缓存头、服务端 current binding；build/publish/cleanup 都需同样的 owner fence。
- 删除 Goal/measurement/recent cursor 的应用事务已经存在，但 read-model 文件不存在，也不存在可复用的 sidecar 清理流程。不能假定 future sidecar 自动随 SQL cascade 删除（本项目没有 FK）。

## 6. 365 天可恢复性

| 层次 | 现状 / 可声称的结论 |
|---|---|
| 磁盘有无 365d 文件 | 未对全部私人 profile 盘点；P0 单个真实样本不能代表所有 binding |
| latest-2000 是否覆盖全年 | 高频/导入可不覆盖；2,001 synthetic 已证明旧文件被舍弃 |
| 窗口前可靠 full baseline | 只在选中 snapshots 中检查；无 baseline → partial；有 full 也不证明丢掉的历史 bestScores 可恢复 |
| 原始源淘汰后较早 index facts | 当前没有此索引。未来须记录可复驗来源链与保留策略；不能把仅存 fact 当仍可核实的 complete |

现有 scoreCoverage 的优先级为 manual/empty→unknown，truncated→truncated，有 full<=from 且 invalid=0→complete，否则 partial。这个标签是现有 API 的 baseline 契约，**不是**整个源目录在某个原子时间点完整的证明，也不是来源可复验的全年保证。future coverage 需把 input verification 与 evidence coverage 分开。

公开 History validator 仍 ≤90d；Passport 已允许 30/90/180/365 **measurement** 范围，但 `passportHistoryRange` 始终取最近 90d score facts。当前不是 365d milestone 产品。

## 7. 隔离诊断与阻断依据

新增 [growthReadModelPreflight.test.mjs](../taiko_viewer/tests/growthReadModelPreflight.test.mjs) 在 `/var/tmp` 小型合成目录重现 audited 文件操作的中间边界，运行**未改动**的 production loader/replay/projector；没有调用 live writer，也不把 fixture 模拟当 writer integration PASS。

12 项全部通过，证明：完整 fact golden/重复 replay 稳定、半写 JSON、C/H 发布缺口、同尺寸同 mtime 覆盖、destructive batch 的空/partial gap、旧记录对后继 bestScores 的影响、current revision overlay、0 成绩变化仍更新 observation、catalog title 输入、两套排序区别、无 baseline/import 边界，以及小样本四档投影等价。具体成本见 benchmark。

**测试 PASS 的含义是反例复现成功，不是输入一致性或 read-model Gate PASS。** 即使一次甚至两次 SHA 扫描相同，也不能排除随后未纳管 writer 修改、删除后重建的 gap 或 C/H 不同批次；没有 epoch/提交边界，无法让在线 reader O(1) 判断“ready 且最新”。

§36 要求：“若 Phase 1 发现外部 writer 一致性无法封闭，提前出 BLOCKED，不要在其上搭脆弱索引。”当前授权禁止 live writer 改造；因此该缺口在本阶段不能封闭。原型 parity/crash/multi-worker/2,000-file 索引 benchmark 尚未实施，不冒充完成。
