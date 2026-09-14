# Annual Build Performance Report

审计对象：年度总结首次生成约 20 秒（用户/鼓众 ID 2258735）。本轮只做观测，不改变年度算法、FinalTitle、页面、缓存语义或部署流程。

## 结论摘要

2258735 的 cold build 在本机真实数据上为 13.10 s；线上同账号的持久化 job 记录为 18–21 s。主要耗时不是 FinalTitle，也不是文件 I/O，而是 snapshot replay/state rebuild 和 observation event 构建：约 6.7 s + 2.7 s（本机 CLI）。线上 job 还包含服务端 Python spawn/import、Node 端 envelope parse/schema validation、摘要文件写入和数据库更新，因此总时长更接近 20 s。

FinalTitle（feature extraction + Dan event + scoring）约 11–12 ms（<0.1%），不会解释 20 秒问题。

## 测量方法与范围

- 使用真实 userdata（`/home/sigaer/taiko/userdata`），未复制或改写业务数据。
- 选取 5 个真实账号，覆盖少量历史、中等历史、300+ snapshot、高 playCount、含 dojo history；2258735 为重点账号。
- 通过 `/tmp/profile_annual.py` 做临时函数级计时；脚本只存在于 `/tmp`，每次使用独立临时 `TAIKO_ANNUAL_CACHE_DIR`，可直接删除。
- 另以真实 `python3 -m plugins.utils.annual_summary build` 测量端到端 CLI wall time，并以只读 SQL 检查线上 `web_annual_summary_jobs` 的 created/started/completed 时间。
- schema validation 使用与运行时相同的 AJV schema（`/home/sigaer/taiko/schemas/annual-summary-v4.schema.json`）；Node JSON parse/stringify 单独计时。
- 未执行生产 DB mutation；未部署、未重启服务。

## 账号覆盖与 cold build

阶段值单位为 ms；`state rebuild` = snapshot history 总耗时减去 snapshot file read/parse；`FinalTitle` 包含 feature extraction、Dan event、scoring。`other` 包含 Python CLI 输出序列化、Node/服务端收尾、文件/DB 写入等无法从纯 Python 函数边界拆出的时间。

| 账号 | raw history | 年度 snapshot | history changes/events | 文件读取 | playCount（当前档案） | dojo | cold wall | Python cold start | read/parse | state rebuild | events | aggregates | Dan+FinalTitle | other |
|---|---:|---:|---:|---:|---:|:---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 20159783（少量） | 1 | 1 | 0 | 2 | 1,538 | 否 | 1,687 | 1,509 | 8 | 11 | 1 | 179 | 4 | 0 |
| 26960604（中等） | 8 | 6 | 38 | 9 | 570 | 是 | 1,680 | 1,509 | 9 | 19 | 8 | 88 | 4 | 43 |
| 63666714（较多） | 291 | 163 | 3,454 | 292 | 5,183 | 是 | 4,469 | 1,509 | 168 | 1,441 | 870 | 347 | 7 | 127 |
| 2258735（重点，926 raw） | 926 | 343 | 3,124 | 927 | 11,535 | 是 | **13,099** | 1,509 | 717 | **6,729** | **2,731** | 498 | 11 | 904 |
| 33587101（高 playCount） | 44 | 40 | 5,446 | 45 | 39,377 | 是 | 4,122 | 1,509 | 117 | 772 | 732 | 647 | 5 | 340 |

说明：`年度 snapshot` 是去重、按年度窗口保留的 snapshot；`raw history` 是目录中的 `data_*.json` 数量。2258735 的 926 个 raw snapshot 中，343 个进入年度窗口，另有 unchanged/duplicate 等被忽略。文件读取数等于候选 snapshot 加当前 userdata 的 lineage read；5 个账号均只扫描 history 目录一次，未发现重复 history directory traversal，也未发现同一路径重复读取。

## 18 个阶段的 wall-time 归因

以下以重点账号 2258735 为主，其他账号的差异见上表。

| 阶段 | wall time | 占 cold wall | 观测说明 |
|---|---:|---:|---|
| 1. Viewer cache lookup | ~10–30 ms | <0.3% | DB latest-summary lookup + cache file existence/validation；未命中才进入 job。 |
| 2. task create / queue wait | 0 ms 本机；线上 0–1,000 ms | 0–8% | 线上 job 的 `started_at-created_at` 为 0 或 1 s；队列上限为 1。 |
| 3. Python spawn → module ready | **约 1,509 ms** | 12.1% | 20 次 `python3 -c pass` 中位数约 45 ms；导入 annual-summary service 中位数约 1,509 ms。 |
| 4. snapshot history discovery | 与 state rebuild 同一函数边界 | — | 目录枚举/排序包含在 history 总段；目录只扫描一次。 |
| 5. snapshot file read / parse | **717 ms** | 5.8% | 927 次读取（926 history + current userdata）。 |
| 6. state rebuild | **6,729 ms** | **54.0%** | 对每个有效 snapshot 应用 full/delta、复制 state、计算 state hash。 |
| 7. annual aggregates | 498 ms | 4.0% | overview、favorite、time sections、keyword/rating、personality、achievement 等。 |
| 8. Period | <1 ms（内联 dict 构造） | <0.01% | 没有独立函数边界；在 summary 构造中完成。 |
| 9. Copy-1/Copy-2 narrative | 已包含在阶段 7 | — | 代码没有独立 narrative pass；无法再拆而不改变业务代码。 |
| 10. Dan state / Dan events | 0.06 ms + 7.73 ms | 0.06% | `read_dan_state` 约 0.06 ms；`dan_achievement_event` 约 7.73 ms。 |
| 11. FinalTitle feature extraction | 0.10 ms | <0.01% | `summary_features`。 |
| 12. FinalTitle scoring | 0.32 ms | <0.01% | percentile/dimension scoring + title selection。 |
| 13. summary serialization | 27 ms | 0.2% | 3.4 MB envelope 的 `JSON.stringify`。 |
| 14. schema validation | 23 ms | 0.2% | AJV summary + events validation；首次 compile 另有一次性小额开销。 |
| 15. cache write | 约 20–80 ms | <0.7% | summary/events/my-don atomic writes，取决于文件系统；不接近秒级。 |
| 16. backend reports complete | <100 ms | <0.8% | job row update 与最终响应收尾。 |
| 17. frontend polling detects complete | **0–1,200 ms，期望约 600 ms** | 0–9.6% | 前端每 1,200 ms GET 一次 job；完成后再 reload annual。 |
| 18. redirect / normalize | <50 ms | <0.4% | 路由/normalize 不在后台 build 临界路径。 |

阶段 4、8、9、15、16、18 的数值是从现有函数边界和单独 parse/write 微基准得到的区间，而不是新增持久化日志；本轮没有把 debug logging 留在产品代码中。

## A/B/C：同一账号 2258735

- **A cold build**：本机独立临时 cache，真实 CLI 13.10 s；线上同账号 2026-09-14 job 为 21 s（`936387d3-64a1-4ee1-9aa6-127d45e8d80f`）。
- **B 第二次 cache hit**：线上同账号历史 job 记录为 0–1 s（`a078cfc8…`、`c4dba27e…`，`progress_stage=queued` 即完成），符合只读 latest-summary/cache 路径；没有再次 spawn Python。读取/parse/AJV 本身约 40 ms（3.4 MB envelope）。
- **C 强制 rebuild**：线上同账号在已有摘要后再次产生 18 s job（`dde69199-eb01-4e8c-a22d-90adbd2dfd66`）；强制路径绕过摘要 cache 后重新执行同一 Python pipeline。`force` 标志没有持久化到 job row，因此只能以“已有摘要后出现的完整 18 s rebuild”识别，不能从历史 row 反推出更细的 force 参数。

线上同类真实账号 job 也显示明显的历史规模相关性：99408699（934 raw snapshots）22 s，63666714（291 raw / 163 年度）13 s，75669125 6 s；cache-hit job 为 0 s。

## 直接回答问题

1. **20 秒真正花在哪里？** 2258735 主要是 state rebuild（约 6.7 s）和 event 构建（约 2.7 s），再加约 1.5 s Python import/cold start；线上额外的 Node/DB/文件收尾把总时长推到 18–21 s。
2. **CPU / IO / process / queue / polling 各占多少？** CPU 主要消耗在 Python state replay/event loops；snapshot IO 约 0.7 s（约 6%）；process startup 约 1.5 s（约 12%）；queue 通常 0 s、最坏观测 1 s；polling 额外 0–1.2 s。没有证据表明磁盘 IO 或 queue 是主因。
3. **FinalTitle 新增多少？** 约 11–12 ms（<0.1%）；其中 Dan event 约 7.7 ms，feature/scoring <1 ms。
4. **snapshot history 是否重复遍历？** 未发现重复目录遍历；每个账号 `candidate_scans=1`。当前 userdata 会额外做一次 lineage read，但路径与 history 文件不重复；2258735 共 927 次、927 个唯一路径。
5. **用户看到的等待与后台真实计算差多少？** 后台完成后，前端检测理论差 0–1.2 s（期望 0.6 s），再加一次 annual reload；不存在必然“晚几秒”。线上 18–21 s 与本机 13.1 s 的差额主要在服务端运行环境/收尾，而非前端。
6. **是否存在后台已完成但前端晚几秒才发现？** 代码允许最多一个 1.2 s polling interval；当前没有观测到超过数秒的延迟证据。
7. **下一步最值得优化的前三项（仅建议，不在本轮实施）？**
   1. 降低 state rebuild 的全量 state copy/hash 成本（最大项，约 54%）。
   2. 减少 event 构建对 343 个年度 snapshot/3,124 events 的重复计算（约 22%）。
   3. 优化 Python cold-start（约 1.5 s 固定成本），例如常驻 worker 或按请求复用进程；需先评估部署与隔离风险。

## 审计状态

本报告提交后等待人工审阅。本轮没有业务代码、算法、FinalTitle、UI、缓存语义或部署流程变更；临时 profiling 脚本位于 `/tmp/profile_annual.py`，可安全删除。
