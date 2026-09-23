# Recent Growth / Session Identifiability Audit

审计日期：2026-09-21

实施基线：Viewer `0.73.2`

范围：Session identifiability、Recent Growth fallback、只读生产聚合、审计原型；不含用户可见 UI、数据库迁移或发布

## 最终决策

```text
0.74.0 SESSION IDENTIFIABILITY AUDIT COMPLETE

ARCADE SESSION NOT RELIABLY IDENTIFIABLE
RECENT GROWTH OBSERVATION MODEL RECOMMENDED
SESSION CLAIM PROHIBITED
```

产品 Gate 选择 **Decision C**。

- 当前任何来源都不提供可信的 session id、play batch id、arcade visit id、transaction id 或 play-cycle id。
- Wahlap 提供的是 profile 当前成绩观察；一次同步可覆盖多次游玩，且没有 source sequence / previous revision。
- Hiroba adapter 将同步时刻写入所有谱面的 `highscore_datetime` 与 `update_datetime`，这些字段在该来源不能作为街机事件时间。
- Kinoko、manual、网页编辑、repair/backfill、dispatcher 转存均不能升级为真实游玩 Session。
- 30 天生产聚合中 L2/L3 均为 0。时间聚类对 gap 高度敏感，且没有 ground-truth session label，无法估计真实 false merge / false split。

因此禁止在产品中使用“这次游玩”“本次 Session”或“最近一轮记录”。下一用户可见阶段只能实现“最近同步的变化”。

## 版本核对

`taiko_viewer/package.json`、`nuxt.config.ts → runtimeConfig.public.appVersion`、生产 `/more` 与 Nuxt public config 均为 `0.73.2`。本审计没有用户可见变化，不 bump、不发布。

原计划把审计称为 0.74.0、把实现称为 0.74.1；按实际 canonical `0.73.2` 与仓库 release policy，下一次用户可见的向后兼容功能应直接 bump minor 到 **`0.74.0`**。0.74.1 只在 0.74.0 已实际发布后才成立。

## 1. Score write path audit

| 路径 | 实际写入边界 | 新游玩证据 | backfill / 多 session / 多 sync 风险 | sequence / session id | 结论 |
| --- | --- | --- | --- | --- | --- |
| Wahlap | Viewer dispatch → `sync_dispatch_server.py` → `getUserData` → Python `save_userdata` | authoritative current observation | 一次同步可包含上次同步后的任意数量游玩或多个真实到店；同一真实游玩可被多次同步 | 无 | L1 |
| dispatcher local target | Python writer 完成后，`write_local_snapshot` 再转存当前 payload | 无新增上游观察 | 可为同一次 sync 再写零变化快照；source 变为 `sakura-bot-sync` | 无 | L0 |
| Hiroba | Viewer proxy → `sync_hiroba_userdata` → Python `save_userdata` | authoritative scrape observation，但默认仅 4/5 难度且详情失败可继续 | 每次同步重建全量；所有 chart 时间被改成同步时刻 | 无 | L1；chart event time 不可用 |
| Kinoko score import | `mergeKinokoScores` → `writeUserdataWithHistory(kinoko-import)` | 否 | 明确是旧成绩迁移/批量回填 | 无 | L0 |
| Kinoko history import | `writeKinokoHistorySnapshots` + `kinoko-history-current` | 否 | 旧历史按 chart 时间拆成 full baseline/delta；`source=wahlap` 但有 `imported_via` | 导入内部 lane 不是 upstream session | L0 |
| 网页编辑/新增 | `account/songs.ts` → `writeUserdataWithHistory(web-account)` | 否 | 人工内容编辑；会写当前时刻 | 无 | L0 |
| 网页 score import | `account/songs.ts` → `writeUserdataWithHistory(web-score-import)` | 否 | 批量人工导入 | 无 | L0 |
| manual account | `manual.ts` → `writeUserdataWithHistory(manual-*)` | 否 | 创建、重命名、增删成绩都是人工状态 | 无 | L0 |
| `writeUserdataWithHistory` | 原子替换 current file，再写 local full history | 仅表示本地 write boundary | 不是上游观察协议；payload 自带 `_meta` 时会覆盖函数刚构造的 history `_meta`，writer source 需结合文件名识别 | 无 | 不能独立定级 |
| Goal Evaluation | authenticated POST 读取 current snapshot；只写 `web_player_goals` completion evidence | 可确认 baseline 后状态变化和 Viewer 确认 | `completedAt` 是确认时间；不是游玩时间或 session boundary | 有 observation revision，无 source session | 独立 Goal fact；最多随 L1 Recent composition 合并 |
| maintenance / repair / direct file write | 多入口，不统一经过 Viewer writer | 无统一保证 | 可修复、迁移、回滚或重建 | 无 | L0 / fail closed |

外部 `/home/sigaer/taiko` 生产 writer 只读审计，本次未修改其他仓库。

## 2. Snapshot metadata semantics

| 字段 | 能表示什么 | 不能表示什么 |
| --- | --- | --- |
| `_meta.full` | 本地 snapshot 是 full state 还是 delta shape | 上游完整覆盖、一次真实游玩、source session |
| `_meta.ts` | Python/Viewer 本地写入标记；Kinoko history 中可被设为导入记录时间 | 街机开始/结束时间；全局单调 sequence |
| `source` | writer 声明的来源 | 可信 session；且 Viewer generic writer 的 spread 顺序可能保留旧 payload source |
| `observed_at` | Kinoko history 兼容快照中的记录时间；样本仅 54/985 有值 | live observation time；本样本中它主要来自 import |
| `synced_at` | Python live writer 的本地同步/写入时间；Kinoko history 中复用导入记录时间 | 真实 play time；跨 writer 严格排序 |
| `schema_version` | writer envelope 结构版本 | sessionization 算法版本或 source event schema |
| `imported_via` | 明确 import provenance，应切断 session evidence | 普通 live sync 的完整性 |
| `source_account` | source account identity | account 内 session identity |
| `content_sha256` | payload 完整性与内容 revision | predecessor、monotonic cursor、source sequence、游玩时间 |
| 文件名时间 | 本地 history filename/write order；Kinoko history 文件名使用导入业务时间 | 统一 authoritative observation time |

30 天样本：985 个 observation 全有 `ts`；972 有 `synced_at/schema_version/source_account`；918 有 content revision；仅 54 有 `observed_at`，且 54 有 import marker。没有任何 native session 字段。

## 3. Chart time and counter semantics

### Wahlap

- `highscore_datetime` 是当前 PB 的时间；没有 PB 时会沿用旧值。
- `update_datetime` 是该 chart 当前记录的最近更新时间/游玩时间，但每张谱只有一个值，多次游玩被折叠。
- 两者为无 offset、秒精度字符串，当前代码按 `Asia/Shanghai` 解释。
- score、crown、rank 不保证同时变化；PB 时间不能代表非 PB 游玩。

### Hiroba

`score_detail_to_userdata_record` 在同步时对所有抓到的谱面统一执行 `datetime.now()`，同时写入 `highscore_datetime` 和 `update_datetime`。它们是 scrape/write time，不是 upstream event time，因此不能参与 session clustering。

### Import / manual / web

- Kinoko history 保留导入记录的 chart 业务时间，但 import marker 强制 L0。
- Kinoko current、manual、web edit/import 可保留旧时间或写本地编辑时间，不能作为新游玩证据。
- 生产样本的 24,745 个变化 chart 中，两个字段都 100% 可解析，但 100% 无 offset、100% 秒精度；“字段存在”不等于“语义可信”。

### `stage_cnt` / `play_count`

`stage_cnt` 是 per-chart 累计游玩次数。在 22,057 个可比较 transition 中：11,009 增长、11,043 不变、5 回退；2,392 个增长 transition 的 delta > 1，占增长 transition 的 21.73%。这能证明多次游玩可能发生过，也直接说明一行只有一个 `update_datetime` 时不能恢复每次游玩的边界。

当前 canonical score row 没有可用的 per-session `play_count`。任何 profile/song 累计计数同样只能证明累计活动，不能分配到某次到店。

## 4. 30 天去身份化生产聚合

时间窗：2026-08-22 至 2026-09-21，Asia/Shanghai。先按窗口内 observation 数选取 30 个最活跃 profile；731 个 profile 在窗口内有 snapshot。只输出 aggregate，不输出 taikoId、username、文件名、score payload 或 private profile。

| 指标 | 结果 |
| --- | ---: |
| selected profiles | 30 |
| files read（含窗口前 baseline） | 4,587 |
| invalid files | 0 |
| window observations | 985 |
| changed charts | 24,745 |
| snapshots/profile-day p50 / p90 / max | 1 / 4 / 15 |
| same-source observation interval p50 / p90 | 443.98 / 2,970.62 min |
| changed charts/observation p50 / p90 / max | 9 / 33 / 687 |
| `update_datetime` span/observation p50 / p90 / max | 66.18 / 1,436.75 / 1,335,116.65 min |
| observation − chart event lag p50 / p90 / p95 | 97.68 / 4,429.78 / 15,390.72 min |
| valid Wahlap event rows in window | 11,877 |
| Wahlap changed rows whose event precedes the window | 959 / 12,836（7.47%） |

Source distribution：Wahlap 906 observations / 13,106 changed charts；Hiroba 23 / 11,458；web-account 42 / 42；import 1 / 138；unknown 11 / 1；dispatcher transfer 2 / 0。

Hiroba 的 23 次 observation 改写了 11,458 行并给它们同步时间，说明仅看字段可解析率会严重高估业务事件时间质量。Wahlap 的 event lag 长尾及 7.47% 窗口外时间说明 observation 可能包含旧状态变化、迟同步或回填，不能直接称为“刚刚一次游玩”。

## 5. Evidence levels

| Level | 生产计数 | 比例 | 说明 |
| --- | ---: | ---: | --- |
| L0 | 113 | 11.47% | import 55、content edit 42、unknown 11、regression 3、dispatcher transfer 2 |
| L1 | 872 | 88.53% | Wahlap 849 缺 source sequence/session id；Hiroba 23 使用 synthetic chart time |
| L2 | 0 | 0% | 没有连续 source sequence；没有 ground truth 可验证候选可靠性 |
| L3 | 0 | 0% | 没有 source-native session identity |

L1 只能使用“最近同步的变化”“刚刚更新”。当前不允许“这一轮”，更不允许“这次游玩”。

## 6. Gap sensitivity（仅分析，不采纳阈值）

输入仅为窗口内、未被排除的 Wahlap changed-chart event time。它不是逐 play log。`observation split proxy` 表示同一次 observation 在该 gap 下被拆成多个 cluster；`multi-observation` 表示一个 cluster 跨多个 observation；`>3h` 是潜在 false merge 风险。它们都不是有标签的真实错误率。

| Gap | clusters | avg events | observation split proxy | multi-observation | >3h | same-day multi-cluster proxy |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10m | 3,998 | 2.97 | 83.16% | 0.08% | 0% | 94.80% |
| 20m | 1,865 | 6.37 | 57.29% | 4.24% | 0.05% | 78.61% |
| 30m | 1,302 | 9.12 | 42.97% | 10.22% | 1.77% | 65.13% |
| 45m | 960 | 12.37 | 31.43% | 15.63% | 6.77% | 51.83% |
| 60m | 819 | 14.50 | 24.80% | 18.80% | 13.43% | 41.62% |
| 90m | 672 | 17.67 | 17.11% | 25.00% | 24.11% | 26.59% |

候选数从 10m 的 3,998 降到 90m 的 672，变化接近 6 倍。45m 仍有 31.43% observation 被拆分，同时 6.77% cluster 已超过三小时。没有 session id、到店标记或人工标注，无法把这些 proxy 转成真实 false split / false merge。任何阈值都不具备产品 Gate 所需证据。

午夜不是 cluster 边界；prototype 只按 elapsed gap 切分。source/account 切换、import、manual、repair、content edit、counter regression 都强制断开。

## 7. Audit fixture matrix

审计原型版本 `session-audit-v1-gap-45m`；candidate id 由 version、evidence level、source/account、window 和 observation revisions 生成，固定输入得到固定 id。

| Fixture | Expected | Actual | Evidence | false split / merge | Result |
| --- | --- | --- | --- | --- | --- |
| S1 单次同步、单时间簇 | 1 candidate | 1 | L2 synthetic contract | no / no | PASS |
| S2 一次 session、多次连续 sync | 合并 1 | 1 | L2 synthetic contract | no / no | PASS |
| S3 一次 bulk sync、两个远距离簇 | 拆 2 | 2 | L2 synthetic contract | no / no | PASS |
| S4 跨午夜连续 | 合并 1 | 1 | L2 synthetic contract | no / no | PASS |
| S5 旧历史 import | 0 | 0 | L0 | no / no | PASS |
| S6 manual | 0 | 0 | L0 | no / no | PASS |
| S7 同日两个明显 cluster | 2 | 2 | L2 synthetic contract | no / no | PASS |
| S8 event time 缺失 | 0 candidate | 0 | L1 | no / no | PASS |
| S9 source switch | 分开 2 | 2 | L2 synthetic contract | no / no | PASS |
| S10 repair / regression | 0 | 0 | L0 | no / no | PASS |
| S11 同谱多次提升 | 1 candidate、保留 2 revisions | matched | L2 synthetic contract | no / no | PASS |
| S12 Goal + score facts | 同 window composition，不重写 fact | matched | L2 synthetic contract | no / no | PASS |

另有 source-native session id fixture：跨 sync 合并为一个 L3 candidate，PASS。该 fixture 只证明实现契约；生产来源没有相应字段，不能据此把生产数据升级为 L2/L3。

## 8. Performance

受控 QA cgroup、只读、无身份输出。90 天选择 observation 数最高的真实 profile，沿用 Growth History 2,000-file上限：

| 项目 | 结果 |
| --- | ---: |
| snapshots read / invalid | 267 / 0 |
| canonical score facts | 2,783 |
| unique fact event times | 573 |
| 45m analysis candidates | 114 |
| history load | 103.18 ms |
| existing canonical replay | 278.79 ms |
| session/recent composition increment | 1.97 ms |
| total（含 304.94 ms corpus selection） | 698.33 ms |
| process max RSS | 139.70 MiB |

30-profile aggregate audit为 11.59s / max RSS 561.34 MiB。Session composition 相对现有 replay 增量很小；没有性能证据支持 materialized session table。产品实现应在现有一次 history replay 的 facts 上 composition，不再次扫描 raw history。

## 9. Persistence and Recent Growth boundary

现有 `scoreRevision` 是 current payload hash；history fact 的 `evidenceRevision` 是 snapshot hash。两者都没有 predecessor/monotonic sequence。当前没有 last-seen/last-acknowledged growth cursor，localStorage/sessionStorage 也没有 growth revision cursor。measurement revision 是模型测量唯一键，不是“用户看到哪里”。

决策：

- 不建 `web_growth_sessions`，不持久化 heuristic candidate。
- 本审计不建 cursor 表。
- 下一阶段若要求跨设备一致，采用 **account-level、per-binding server cursor**，不采用 browser-local cursor。
- GET Recent 必须只读，返回 acknowledged boundary → current observation 的 canonical facts。
- client 成功呈现后，以独立 authenticated POST 显式 acknowledge；CAS 校验 expected boundary/current revision，避免 prefetch 或失败 GET 悄悄 advance。
- cursor 只表示“看到哪里”，raw history/facts 仍是 source of truth；unbind/rebind 按 binding row identity 隔离，删除生命周期需一起清理。
- 在实现 cursor 前，先建立可定位的 observation order token（observed instant + deterministic file order + revision），并显式排除 import/content-edit/unknown/regression。不能把 content hash 当自增 revision。

## 10. 下一实现范围

目标版本：**Viewer 0.74.0 Recent Growth**（从实际 0.73.2 minor bump）。

允许范围：

1. 在既有 Growth History replay 上建立 Recent observation window；不修改 PB/crown/rank/Goal canonical fact 规则。
2. 修正/规范 writer provenance，使 history entry 保留实际 writer source，不能被旧 payload `_meta` 覆盖。
3. 定义 deterministic observation order token 与 account-level per-binding acknowledged cursor。
4. 实现 read-only Recent GET + explicit ack POST；private/no-store、owner/current-binding、CAS、multi-device/reload/logout-login 语义必须验收。
5. Home Growth 增加“最近同步的变化”：PB、NG、combo、clear/FC/DF、rank、Goal completed，并链接现有“接下来”计划。
6. 文案只允许“最近同步的变化”“刚刚更新”；不出现 Session、这次游玩、这一轮。
7. Daily、Weekly、Passport、Goal Evaluation 与 recommendation 保持不变。

阻塞项：在 source provenance、observation order、cursor CAS、import/manual/repair 排除和真实 authenticated multi-device smoke 全部 PASS 前，不发布 Recent Growth。Session Recap 则继续无限期禁止，除非未来 source 增加可验证的 native session identity 或获得足够 ground-truth 标注重新开 Gate。

## 11. 40 项核心答复

| # | 答复 |
| ---: | --- |
| 1 | 实施开始 Viewer `0.73.2`；生产 `/more` 同为 0.73.2。 |
| 2 | Wahlap、dispatcher transfer、Hiroba、Kinoko score/history、Viewer generic writer、网页编辑/import、manual、Goal envelope、maintenance/direct writes。 |
| 3 | 只有校验后的 Wahlap/Hiroba 能代表新的 authoritative observation；仍不等于新 session。 |
| 4 | Kinoko、网页 import、manual、repair/migration 可 backfill；Wahlap 延迟同步也可一次包含多段历史活动。 |
| 5 | `_meta.ts` 是 local write/observation marker；Kinoko history 中可为导入记录时间，不是 arcade time。 |
| 6 | `observed_at` 当前主要存在于 Kinoko history import，表示兼容快照记录时间，不是 live session boundary。 |
| 7 | live Python `synced_at` 是同步写入时间；import 中可复用业务记录时间；都不是 play session。 |
| 8 | Wahlap PB 时间可用但会沿用；Hiroba 为同步时刻；import/manual/web 不能证明新 PB session。 |
| 9 | Wahlap 每 chart 最近更新时间可部分使用但多 play 折叠；Hiroba 为同步时刻。 |
| 10 | Wahlap 有部分可信 chart event time；Kinoko history 保留业务时间但 L0；Hiroba 无 authoritative event time。 |
| 11 | 所有 audited source 的 session id 均不存在。 |
| 12 | `stage_cnt` 是累计 per-chart，只能确认活动；`play_count` 无可用 per-session 契约。 |
| 13 | snapshots/profile-day p50=1、p90=4、max=15；same-source interval p50=443.98m、p90=2,970.62m。 |
| 14 | update span/observation p50=66.18m、p90=1,436.75m；PB time span更长，不能作 session span。 |
| 15 | same-day multi-cluster proxy 随 gap 从 94.80%（10m）到 26.59%（90m）；不是 ground-truth 比例。 |
| 16 | 10/20/30/45/60/90m 分别产生 3,998/1,865/1,302/960/819/672 candidates。 |
| 17 | 短 gap 会把一次长时间连续活动、多个 sync 或同 observation 拆开；45m observation split proxy 31.43%。 |
| 18 | 长 gap 会把同日多次到店或跨 observation 活动合并；90m >3h candidate 24.11%。 |
| 19 | 午夜不硬切，只按 elapsed time；Daily business day 与 session boundary 分离。 |
| 20 | source/account switch 强制切断。 |
| 21 | import marker、Kinoko filename/source 强制 L0。 |
| 22 | manual source/filename 强制 L0。 |
| 23 | repair/backfill/migration/unknown 与 counter regression 强制 L0。 |
| 24 | 四级定义适配；生产只有 L0/L1，L2/L3 条件未满足。 |
| 25 | L0 11.47%、L1 88.53%、L2 0%、L3 0%。 |
| 26 | 不可安全使用“这次游玩”。 |
| 27 | 当前也不可使用“这一轮”。 |
| 28 | 应退为“最近同步的变化”。 |
| 29 | prototype key = version + level + source/account + window + revisions 的 SHA-256 前 24 hex。 |
| 30 | `session-audit-v1-gap-45m`；非默认 gap 写入对应版本；native session 使用独立版本。 |
| 31 | derived-on-read 足够，composition 1.97ms。 |
| 32 | 不需要 session 表。 |
| 33 | 跨设备 Recent 需要 acknowledged cursor；本审计不建表。 |
| 34 | 选择 account-level、per-binding server cursor，不选择 device-local。 |
| 35 | 任一设备 ack 后账号共同前移；GET 不前移，成功呈现后 POST CAS ack。 |
| 36 | 90d：267 snapshots、2,783 facts、114 analysis candidates、总 698.33ms、max RSS 139.70MiB。 |
| 37 | 产品实现不得额外 replay raw history；在既有 one-pass facts 上 composition。 |
| 38 | 本阶段未修改 Daily/Weekly/Passport/Goal/Recommendation。 |
| 39 | Decision C：SESSION NOT RELIABLY IDENTIFIABLE。 |
| 40 | 下一用户可见版本 0.74.0：Recent Growth + deterministic observation cursor + explicit ack；禁止 Session claim。 |

## 12. 实施与证据

- Audit prototype：`taiko_viewer/server/services/growth-session/audit.ts`
- 12 类 fixture + native session/sequence guard：`taiko_viewer/tests/growthSessionIdentifiability.test.ts`
- 去身份化聚合：`taiko_viewer/scripts/audit_recent_growth_session.mjs`
- 90 天 benchmark：`taiko_viewer/scripts/benchmark_recent_growth_session.mjs`
- 本地 aggregate artifact：`/var/tmp/recent-growth-session-audit-30d.json`

验证：14/14 session audit tests PASS；30 天生产聚合与 90 天 benchmark 均通过 memory-isolated QA。没有数据库写入、DDL、版本 bump、UI 变化或部署。
