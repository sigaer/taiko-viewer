# Growth History Evidence Audit

审计日期：2026-09-19
实施基线：Viewer 0.69.3
范围：0.70.0 Growth History Foundation

## 结论

0.70.0 采用以下边界：

- Score facts 由现有 authoritative score history 按请求单次线性重放，不复制原始 score JSON，不新增 `web_growth_facts`。
- Goal completion 作为独立 canonical fact 从 `web_player_goals` 读取；`completedAt` 只表示 Viewer 确认时间，不伪装成游玩时间。
- Player State measurement 从 0.70.0 开始捕获，不用当前模型回填过去的“当时六维”。
- measurement 在 authenticated Growth Overview 已完成既有 Python compute 后复用结果写入；不增加 Python 进程。
- 只新增无外键的 `web_growth_measurements`，唯一键为 `(binding_id, score_revision, algorithm_version)`。
- History API 由服务端解析当前 binding，最大查询范围 90 天，private/no-store。

## A. Score History

### 结构与写入

- `writeUserdataWithHistory` 先原子替换当前 `<taikoId>data.json`，再写 `userdata/<taikoId>/data_YYYY-MM-DD_HH_MM_SS_<source>.json`。
- 普通写入的历史 payload 为 full snapshot，`_meta.full=true`、`_meta.ts` 为 Asia/Shanghai 本地时间并保留 source。
- Kinoko history import 可写一条 full baseline 和多条 delta snapshot；delta 是完整 chart row，不是字段 patch。
- Kinoko metadata 同时带 `ts`、`observed_at`、`synced_at`、source、source account、schema version 与 import marker。
- chart 的业务时间来自 `highscore_datetime` / `update_datetime`。文件名和 `_meta` 时间只表示观察/写入边界，不能替代实际成绩时间。

### Replay 与日归因

- `deriveDailyProgress` 已覆盖 ordinary、PB、old PB restore、NG、combo、clear、FC、DF、rank、同谱多事实、多谱、duplicate、midnight、missing-before、truncated、crown ambiguity 等 17 类 authoritative replay。
- PB 依赖 `highscore_datetime` 的严格前进与历史最高分；crown/rank 依赖同业务日内可证明的前后观察，避免跨未观察午夜错误归因。
- 0.70.0 将公共 replay 核心抽为 `deriveProgressForRange`；单日 Home 继续在其后执行原有 priority、crown headline 收敛和 top-3 presentation，canonical history 则保留未截断 facts。

### Retention、截断与修复

- 未发现普通 history 的自动删除、按日 retention 或压缩策略；raw files 当前持续保留。
- Kinoko 单次 import 有 10,000 个 snapshot 文件的安全上限，并按 fingerprint 跳过已导入记录。
- 0.69.3 Growth loader 只读取排序后的最后 2,000 个文件，但此前没有对客户端公开该截断。
- 0.70.0 保留 2,000 文件上限并显式返回 `coverage.scoreHistoryState=truncated`；当前只读样本中最大历史为 1,043 文件，未触发截断。
- import/repair 路径包括普通同步、Wahlap/Kinoko import、Kinoko history import 与手动成绩写入；0.70.0 不重写任何历史文件。

## B. Goal History

- `web_player_goals` 保留 active、cancelled、completed 行；active 由 generated column + unique index 保证每 binding 唯一。
- baseline 固定 source revision、capturedAt、chart 数值、source completeness 与可验证 provenance。
- completion evidence 固定 evaluation version、evaluation time、observation captured time/revision、baseline revision、provenance 与 exact before/after/delta。
- causal boundary 是评价事务内重新读取 authoritative snapshot；`completed_at` 是 Viewer confirmation。
- Canonical Growth 只把 completed Goal 投影为 `goal-completed`。active/cancelled 不伪装成成长成绩。
- Goal fact 默认无 `attributedDay` / `occurredAt`，以 `observedAt` + `confirmedAt` 和 `precision=observation` 表达；因此不会被误塞进某天的 Score Timeline。

## C. Player State / Rating / 六维

- 当前 Growth Overview 通过一个 `growth_compute` Python 进程同时计算 overall Rating、六维、focus basis 与 Today Plan。
- 六维 key 固定为 `big_song`、`stamina`、`speed`、`accuracy_power`、`rhythm`、`complex`；聚合为 per-dimension top 20。
- readiness 由 sample count 与 score history mode 决定；`limited`、`insufficient` 与六维全并列的 `balanced` 不能被当作能力短板。
- 既有 Python payload 没有稳定的 algorithm/model revision 字段，package version 也不足以区分算法和内容数据变化。
- 0.70.0 定义语义版本 `growth-v1`，并对实际 compute 源文件、`rating_structured_with_ids.json`、`song_data.json`、`song_alias.json` 进行流式 SHA-256，保存为 `modelRevision`。文件身份缓存以 size + mtime 失效。
- 今天用当前模型重算旧 score snapshot 可能受 Python、rating structured 或 song catalog 变化影响，所以 V1 不回填过去 measurement。

## D. Account / Profile / Privacy

- Web user 可有多个 binding；current binding 由服务端按 `is_current DESC,id ASC` 解析，API 不接受客户端 user/binding selector。
- binding source 为 Wahlap、Hiroba 或 manual；Goal 已明确排除 manual。
- manual 写入也会形成 full score history，但这些时间是记录编辑时间，不足以证明街机游玩日；V1 不把 manual score 放入 date-attributed Growth Timeline。
- 切换 binding 后只读取该 current binding 的 Goal、measurement 与 score evidence。
- unbind/rebind 以 binding row identity 隔离；measurement cleanup 已并入现有事务型 binding/user lifecycle。重新绑定不会继承旧 binding 的 private measurement。
- raw score files 由 Taiko 数据层按 taiko ID 管理，不属于可重建 Growth projection；0.70.0 不改变其删除生命周期。

## Persistence 决策

### Score facts

选择 derived-on-read：

- raw score history 已是权威数据；复制会形成第二 source of truth。
- stable `factKey` 由 binding、业务日、chart、fact type、before/after 构成；重复 replay 和 duplicate sync 不产生重复事实。
- 一次 history load + 一次有序 replay 同时生成整个范围，不按天重复扫描。
- 当前最大实际样本性能足以支撑 90 天私有查询，因此没有性能证据支持 materialization。

### Measurements

选择持久化：

- measurement 是当时成功完成的模型观察，事后无法可靠重建。
- 唯一性由 binding + score revision + algorithm version 保证。
- capturedAt 按 UTC 存储；score 日归因继续使用 Asia/Shanghai。
- write failure 只记录安全日志并允许同 revision 下次重试，不使 Overview 失败。

## 性能证据

只读、去身份化地选择本机 history 文件数最多的真实 profile；未输出 ID 或 score payload。一次载入 1,043 / 1,043 files，1,043 snapshots，invalid=0，load=751.05 ms。

| Range | Replay | Facts | Observed RSS delta | Observed heap delta |
|---|---:|---:|---:|---:|
| 7d | 227.56 ms | 123 | 37.88 MiB | 18.96 MiB |
| 30d | 183.85 ms | 601 | 1.80 MiB | -4.70 MiB |
| 90d | 218.53 ms | 1,457 | 0.26 MiB | 9.08 MiB |
| full history / 1,096d | 567.49 ms | 4,042 | 35.06 MiB | 2.67 MiB |

RSS/heap delta 是进程采样差值，不是峰值归因；首轮包含 JIT/分配预热。当前 90d 的 load + replay 约 0.95s，API 因此锁定 90 天，不开放 all-time 请求。重放复杂度随 history snapshot 数线性增长，而不是 `days × history`。

## Coverage 语义

- `complete`：已加载范围内存在可证明早于或等于 from day 的 full baseline，且没有 loader 截断/坏文件。
- `partial`：有 evidence，但缺少足够 baseline 或有坏文件。
- `truncated`：raw history 文件数超过 2,000 loader 上限。
- `unknown`：无可用 evidence，或 manual source 不进入日归因 timeline。
- measurement 从 0.70.0 on-demand 捕获，存在记录时仍标 `partial`；没有记录时为 `unknown`，不伪称连续覆盖。

## 容量估算

按每天一个新 score revision、30 rows/user/month、约 1.2 KiB/row（数据、主键与两个索引的规划量级）估算：

- 1k users：约 35 MiB/month
- 10k users：约 352 MiB/month
- 100k users：约 3.43 GiB/month

若高活跃用户平均 3 个新 revision/day，则约为上述三倍。唯一键会吸收同 revision 的重复 Overview，但不会人为丢弃真实的新 revision；上线后应按实际 rows/user/month 校准 retention 决策。

## 发布与生产 Gate

- Viewer 0.70.0 使用标准 `scripts/deploy_forum_web.sh` 发布；构建、服务重载、Nginx 检查和健康检查通过。
- 生产迁移先 inspect 后 apply；实际数据库为 `taiko`，schema errors=0，无外键，measurement user/binding orphan 与 owner mismatch 均为 0。
- 隔离生产账号构造多日 authoritative history；History API 首次返回 4 facts、`complete` coverage，total 122 ms。完成 Goal 并产生新 revision 后返回 6 facts、1 条独立 Goal fact 和 2 条 measurement，total 105 ms。
- 首次 Overview 709 ms；同 revision 重复 Overview 629 ms 且 measurement 保持 1 行；新 revision Overview 600 ms 并产生第 2 行。三次均复用每次请求原有 Growth compute，没有为 measurement 额外启动 Python。
- smoke cleanup 后 users、bindings、sessions、goals、measurements、synthetic files 全为 0；Goal 与 measurement 两类 orphan/mismatch 全为 0。
- 最终回归：Daily/Growth 44、Growth History 9、Goal 46、Growth refresh 8、version projection 1，共 108 tests PASS；隔离真实 SQL、幂等迁移、并发 upsert、生命周期清理 PASS。

```text
0.70.0 GROWTH HISTORY FOUNDATION COMPLETE

CANONICAL GROWTH FACT MODEL ESTABLISHED
MULTI-DAY AUTHORITATIVE HISTORY REPLAY ACCEPTED
GOAL HISTORY MERGED INTO GROWTH TIMELINE
LONGITUDINAL PLAYER STATE MEASUREMENTS ESTABLISHED
MEASUREMENT VERSION BOUNDARY ESTABLISHED
HISTORY COVERAGE EXPLICIT
PRIVATE PROFILE ISOLATION ACCEPTED
DAILY PROGRESS SEMANTICS UNCHANGED
0.69.x GOAL LOOP REGRESSION ACCEPTED

READY FOR 0.70.1 WEEKLY GROWTH RECAP
READY FOR 0.70.2 SKILL PASSPORT DATA LAYER
```
