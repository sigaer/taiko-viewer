# Python Memory Phase 4 — Resident Attribution

状态：**ATTRIBUTION PARTIALLY CONFIRMED**。Phase 3 仍为 **FURTHER WORK REQUIRED**，不得签 COMPLETE。本报告是 2026-09-20 的归因检查点；taikobot 新 cohort 的 24h 连续观察尚未完成。

已确认：miku 历史增量主要发生在 Python worker；公开卡片渲染隔离路径存在显著 allocator high-water；谱面类级 memoization 会保留 Score 实例。尚未确认：生产 worker 约 2.2 GiB PSS 中，各 Python/native/plugin 对象的精确份额，及其长期增量是否由同一渲染路径主导。

本轮没有修改生产业务代码、Annual、并发、worker 数、缓存预算或业务公式；没有重启服务、清生产缓存、强制生产 GC/trim、swapoff、drop_caches、heap dump 或附加重型 profiler。生产既有的自动 GC/trim 逻辑保持原样。

## 1. Evidence and measurement boundaries

私有原始证据：`/var/log/python-memory-phase4/`（父目录 0700），只提交本报告。包含 `initial-attribution.json`、`cohorts.jsonl`、`hourly-correlation.json`、`host-accounting.json`、`replica-profile.json`、`replica-allocation-top.json`、`chart-retention.json`。没有记录聊天内容、用户 ID、凭据或对象内容；日志发送者以临时盐哈希去重，最终只保存数量。

生产每 60s 读 status/smaps_rollup/statm/maps，每 5min 读 smaps。记录 PSS/RSS/RssAnon/RssFile/Pss_Anon/Pss_File、private/shared clean/dirty、VmSwap、Threads、age、PID/start ticks；maps 保存数量及哈希，完整路径不进入报告。完整 smaps 按映射类型聚合。采样有进程退出竞争与时间偏差，不能视为原子系统快照。

隔离实验使用现有 QA runner，串行、2/3 GiB MemoryHigh/Max、256 MiB swap、2 CPU、15min 总期限；env 清空、独立 network namespace、公开 master/图片/字体、私有 SQLite 与 browser profile。未导入含凭据的实际 API/config，也未启动机器人适配器。replica 是允许列表中的真实函数提取与公共渲染路径，不是完整生产实例。无需安装 profiler。

## 2. miku 36h trend

继承已审计的 36h 原始分钟样本（2026-09-18 20:37:42 至 09-20 08:37:42 CST）；不是重新启动后测量。以下单位是 **MiB**，不能把 MiB/1000 直接标成 GiB。

| 窗口 | core full-tree PSS 中位数 MiB |
|---|---:|
| 0–6h | 2104.42 |
| 6–12h | 2115.21 |
| 12–24h | 2440.13 |
| 24–36h | 2520.00 |

全窗口树 PSS 最大 2948.29 MiB。缓存预算有效不等于完整内存已归因。

## 3. Worker vs children

下表为了与小时业务计数对齐，使用“各小时 PSS 中位数的中位数”，不能与上表分钟总体中位数直接求和比较。

| 窗口 | worker | root | Chromium 合计 | Playwright driver |
|---|---:|---:|---:|---:|
| 0–6h | 1722.75 | 199.72 | 81.00 | 88.44 |
| 6–12h | 1757.72 | 199.57 | 70.66 | 87.67 |
| 12–24h | 2083.12 | 199.49 | 71.55 | 71.64 |
| 24–36h | 2175.16 | 198.57 | 68.83 | 63.47 |

worker 增加约 452 MiB；root 基本稳定，已识别的五个长期 Chromium 进程反而减少驻留。resource tracker 约 8.2 MiB。历史另有 16 个短命/无法回溯角色的 PID，保留为 unknown，没有按当前 executable 猜回历史角色；因此不能声称任何时刻都只有 9 个进程。

结论：**排除长期 Chromium 子树为本次主要增量来源**；不能仅凭固定 PID 数排除 page/context 泄漏。生产 page/context 数未安全暴露，本轮未通过 CDP 附加读取。

## 4. Current mappings / anonymous decomposition

初始快照：2026-09-20 09:08:36 CST。单位 MiB PSS；映射类别描述地址空间来源，不描述 Python/native 对象所有权。

| 角色 / PID | PSS | heap mapping | anonymous mmap | library file | other file | Threads |
|---|---:|---:|---:|---:|---:|---:|
| root / 3870884 | 198.55 | 51.85 | 139.46 | 5.76 | 1.34 | 8 |
| resource_tracker / 3870978 | 8.18 | 1.75 | 4.79 | 0.26 | 1.33 | 1 |
| worker / 3870979 | 2218.14 | 202.23 | 1995.45 | 8.08 | 12.19 | 45 |
| playwright_driver / 3871029 | 86.83 | 26.59 | 55.22 | 0.18 | 4.78 | 11 |
| browser / 3871091 | 29.33 | 0.00 | 14.85 | 1.01 | 13.40 | 23 |
| browser / 3871093 | 4.09 | 0.00 | 0.41 | 0.40 | 3.16 | 1 |
| browser / 3871094 | 7.55 | 0.00 | 0.50 | 0.69 | 6.19 | 1 |
| browser / 3871110 | 17.62 | 0.00 | 4.16 | 6.05 | 7.28 | 17 |
| browser / 3871112 | 11.94 | 0.00 | 1.72 | 0.71 | 9.47 | 8 |

worker 的约 1995.5 MiB anonymous mmap 是最大区域，但 **anonymous ≠ Python heap**。Python arenas、native malloc arenas、大块图像、线程栈等都可能在匿名映射；文件映射也可能有 COW 匿名页。library mapping 的 8 MiB 不包含库在匿名页上的堆分配。

旧 36h 没有完整 smaps 分区历史，不能证明那 400–800 MiB 增量具体来自 heap 还是 anon mmap；新采集用于补齐这项证据。未证明文件 mmap 增长是主因。

## 5. Business correlation

按同一 36h 时轴构建 36 个小时桶。Matcher 使用 dispatch 日志结合源码模块/行号映射；不是“完成了多少次渲染”。未匹配模块保留 unmapped。卡片、gacha、guess、chart 分类仅覆盖已映射处理器；`ranCard` 等其他路径在逐模块计数中保留，不假装分类覆盖全部渲染。

| 最大上升小时（窗口起点后） | worker PSS 增量 MiB | group events | card dispatch | chart dispatch | guess dispatch | render cost markers | 可见独立发送者下界 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 17 | 355.27 | 635 | 17 | 1 | 74 | 4 | 284 |
| 16 | 68.55 | 676 | 11 | 8 | 30 | 5 | 337 |
| 1 | 53.16 | 1098 | 26 | 10 | 0 | 9 | 431 |

小时事件数与 worker 小时增量的 Pearson r：group_event=0.147, card_matcher=0.045, gacha_matcher=-0.014, guess_matcher=0.252, chart_matcher=0.154, render_cost_marker=-0.021, existing_auto_trim=0.086, websocket_marker=-0.068, observed_unique_senders=0.189.

相关性弱，35 个差分样本且业务混合、日志覆盖不完整，不能归因到某个用户数、插件或时间本身。最大上升小时为 2026-09-19 13:37:42–14:37:42 CST；browser 中位 PSS 70.92 MiB、5 个进程；worker +355.27 MiB，root 无对应增长。

日志有 680 条**原业务既有** render-trim 记录；上述大增量小时仍有 24 次 trim，中位 RSS 下降约 75 MiB。这提示仅增加 trim 频率未必解决生产剩余驻留。140 条 Cost time、18,959 条 group event、135 条 WebSocket marker 均是日志代理指标，不是完整调用计数；WebSocket marker 不等于实际重连。未取得可靠的 browser/context 创建、master refresh 完整计数，不能将缺记录解释成零次。

## 6. Browser lifecycle

`miku_bot/milky_haruka/utils/browser.py` 维护一个持久 context；截图页面有 finally close，最多 3 次尝试；context/driver 有清理路径。`plugins/utils/self_service.py` 的 Playwright browser 也在 finally 关闭。旧 `plugins/utils/convert.py` Selenium 路径存在异常分支没有 finally 的源代码风险，但未证明当前业务可达或实际泄漏。谱面 Selenium 路径另有 quit 清理，不混为同一路径。

公开 HTML、独立 profile、单页串行的 100-job fixture **未完成**：现有 headless_shell 与 full Chromium 两次均在 new_page 时退出；第一次 kernel 明确记录隔离 PID 810751 segfault。没有扩大权限、关闭隔离或安装替代浏览器。两个测试根 PID 810751/811304 已退出，QA cgroup teardown 回收子进程；随后按本次专用 profile 扫描 /proc，剩余 Chromium=0。不能写 browser replica PASS，也不能把隔离启动失败认定为生产 page leak。生产浏览器 PID/tree 未被操作。

## 7. Threads / tasks / executor queues

生产初始 root 8、worker 45、driver 11 threads；新序列每分钟采样。旧 36h 未记录 Threads，不能补造长期线程趋势。IO/render executors 实际配置 8/2；45 个 OS threads 不等于 render workers 泄漏，可能包含其他库/客户端线程。

`plugins/utils/executor_pool.py` 的 ThreadPoolExecutor 并发有界，但 submit/run_in_executor 的 pending queue 没有业务硬上限。`_render_in_flight` 是计数，不是 admission cap。未通过侵入方式读取生产 qsize，实际积压量 UNKNOWN。OneBot create_task registry 完成后 discard，生命周期正确但 admission 未设全局上限。没有调小 workers。

## 8. Source retention inventory

以下为审计分类，不是生产字节归因。

| 源码 / state | 分类 | 结论与边界 |
|---|---|---|
| memory_runtime 公共表、font/static/resource/guess cache | BOUNDED | 已有 entry/byte 预算；estimated bytes 不等于精确 resident |
| guess song/character/alias metadata | BOUNDED（有限公开目录） | 随曲库版本变化，非固定字节预算 |
| guessRank / rank_rows_cache | PER-USER | 排名持久数据、排序副本；实际体积未知，不应删除业务数据 |
| guess answer sets / timeout events | LIFETIME-BOUND | timeout/结束有 pop，活跃组数未设全局上限 |
| wordle/handle sessions | LIFETIME-BOUND | 结束取消 timer、删除 session；并发组数未设全局上限 |
| prsk live_subscriptions / last_notice | PER-USER（按组） | 订阅生命周期，unsubscribe 清理，非内存预算 |
| sekai_update_task | BOUNDED | 单例、shutdown cancel |
| OneBot tasks | LIFETIME-BOUND / admission UNBOUNDED | 完成 discard；并发事件突发可积压 |
| OneBot handoff locks / generations | PER-USER（bot ID）/ UNKNOWN | 部分连接状态清理；lock 表未见整体预算 |
| IO/render pending futures | UNBOUNDED | worker 有界不能代替队列有界；未测实际积压 |
| DB connection pool | BOUNDED | Queue(maxsize=DB_POOL_SIZE) |
| chat request messages / screenshot base64 | LIFETIME-BOUND | 请求局部；待完成 Future 可延长整个对象图生命周期 |
| randomer history / 第三方插件全局 state | UNKNOWN | 尚未穷尽依赖及生产活跃对象，不能判无泄漏 |
| Score.get_time_event/get_bar_event/note_hands | BOUNDED entries，bytes UNKNOWN | 类级 lru_cache 默认 128；key 持有 self，连带谱面对象图 |

未发现第一方明确 matplotlib/pyplot 主要调用链，不据此排除第三方库。生产匿名页无法区分 Pillow/OpenCV/NumPy，不能凭库已加载就认定其占用。

独立无凭据 Score 实验直接载入纯 stdlib parser，用 100 个空 events 的 synthetic Score 调用真实 get_time_event：删除局部引用并 GC 后 **100 个 weakref 仍存活**；只清理隔离 cache 后 **0 个存活**，cache_info maxsize=128/currsize=100。证实实例所有权问题，尚未证明生产保留数量、谱面大小或 400 MiB 归因。musics 与 skillmusic 两份 parser 均需在后续设计中覆盖。

## 9. Public render replica / batch curve

真实提取路径 `findGroupcard('vs')`，公开角色卡片全集；3 张 master 表 + compact resourceBoxes。100 次 lookup 是已暖相同 master/key 的重复读取，不代表 100 种业务请求。100 次渲染串行，返回 BytesIO 用完关闭，仅保存 hash/size，不积累图像。100 次输出 SHA-256 一致；中位耗时约 5.00s（有 tracemalloc，不能当生产延迟）。

它是安全可重放的大图路径，未证明是生产最重的 mysekai/profile/chart 路径；本轮不引入真实用户数据以扩大覆盖。

| 阶段 | PSS MiB | RssAnon MiB | Python traced MiB | tracer metadata MiB |
|---|---:|---:|---:|---:|
| startup | 17.16 | 14.14 | 2.71 | 1.35 |
| master_warmup | 243.07 | 240.10 | 79.41 | 75.95 |
| 100_lookups | 243.07 | 240.10 | 79.42 | 75.96 |
| renders_1 | 464.15 | 460.58 | 80.16 | 76.22 |
| renders_10 | 464.25 | 460.79 | 80.24 | 76.27 |
| renders_50 | 474.07 | 470.61 | 80.79 | 76.28 |
| renders_100 | 476.89 | 473.48 | 80.82 | 76.29 |
| normal_after_workload | 476.97 | 473.48 | 80.83 | 76.30 |
| idle_20s | 477.00 | 473.48 | 80.84 | 76.30 |
| after_gc | 477.03 | 473.48 | 80.57 | 76.17 |
| after_trim | 244.38 | 240.95 | 80.59 | 76.18 |
| idle_after_trim_20s | 245.40 | 241.98 | 80.60 | 76.19 |

缓存估计全程约 91.50 MiB master + 0.139 MiB compact resourceBoxes，无预算变更；PIL 路径不启动 browser，browser subtree=0。首轮渲染出现约 221 MiB 阶跃；10→100 次再增加约 12.64 MiB，未见按渲染数线性增加数百 MiB。只有 100 次、单一路径，不能证明无限期平台。

tracemalloc 自身约 76 MiB metadata，显著影响绝对 PSS；其元数据及 gc census 开销不能当生产驻留。采样到 QA cgroup current 540.22 MiB、memory.events 全 0；VmHWM 488.28 MiB 是过程中读数，下界而非最终全树精确峰值。kernel 未提供该 cgroup memory.peak。

## 10. GC / allocator experiment (replica only)

20s idle：PSS 477.00 MiB。GC：477.03 MiB，Python traced 80.84→80.57 MiB；没有大幅回收。随后 malloc_trim：**244.38 MiB，下降 232.65 MiB**；Python traced 仍约 80.59 MiB。再 idle 20s 为 245.40 MiB。

glibc mallinfo2：渲染前 arena 118.54 MiB、free blocks 2.70 MiB；GC 后 arena 356 MiB、free blocks 238.41 MiB、allocated blocks 117.59 MiB。trim 后 arena 341.37 MiB，但 RSS/PSS 回收远大于 arena 虚拟大小下降——空闲页可被归还而地址区域保留。mallinfo2 不是完整 native profiler，不包含所有映射/库自定义分配。

**该隔离路径的 render 增量以 allocator high-water 为主，有高置信度。** 不能把它外推为整个生产 worker 的主因：生产已有自动 trim，混合 workload、线程和存活对象不同。本轮未触发生产 GC/trim。

## 11. Object census

| 渲染次数 | tracked dict | tracked list | tracked set | tracked tuple |
|---|---:|---:|---:|---:|
| renders_10 | 11862 | 11206 | 134 | 1826 |
| renders_50 | 11867 | 11208 | 134 | 1830 |
| renders_100 | 11872 | 11210 | 134 | 1834 |

小幅增长包括 profiler 保存的 checkpoint/timing 元数据；不能当业务泄漏。浅层字节不遍历对象图。gc.get_objects 仅覆盖 GC-tracked 对象，str/bytes/bytearray 及部分 dict 不在 census；未列出不代表零。没有看到 tracked PIL.Image 累积，但不证明所有 native pixels 已释放。

最终 tracemalloc 最大栈为 json/decoder.py:353，约 76.60 MiB / 1,410,565 allocations；符合公开 master 解析驻留。importlib 次之约 1.68 MiB。不是生产全量 heap 归因。

## 12. taikobot fresh cohort

开始：2026-09-20 09:08:36 CST。root **3982136** / worker **3982155**，以 PID+start ticks 双身份标记。每分钟完整树与缓存 metrics；身份变化创建新 cohort，绝不将缺失历史补成连续树。没有为了测量重启。

本次检查点：

- miku-core: 23 samples / 0.367h，PSS min/median/max 2534.45/2551.71/2582.82 MiB；不完整样本 0，cache budget violations 0；24h=False。

- taikobot: 23 samples / 0.367h，PSS min/median/max 712.65/712.99/713.56 MiB；不完整样本 0，cache budget violations 0；24h=False。

**24h gate PENDING**，最早 2026-09-21 09:08:36 CST 才具备满 24h 时长。`python-memory-phase4-cohorts.service` 运行 36h，128 MiB / 32 MiB swap / CPU 10%；不依赖当前对话继续采集。`python-memory-phase4-review.timer` 已核对下一次触发 09-21 09:12 CST，将生成私有 `cohort-review.json`。计划任务不等于已完成；届时必须核验实际触发、连续性、缺样和 PID 边界后再更新结论。

## 13. Whole-host accounting

快照：2026-09-20 09:26:48 CST. 分组按每 PID 互斥分配；family 包含相同服务 cwd 的其他 Python 进程，所以大于 core 树，不可直接比较为增长。该分类有 cwd 启发式成分，也包含当时只读采样进程，不能冒充严格 production-only systemd 归属。

| 分类 | count | PSS GiB | RSS GiB | VmSwap GiB |
|---|---:|---:|---:|---:|
| other | 236 | 0.775 | 0.928 | 0.440 |
| Viewer/Node | 6 | 0.505 | 0.522 | 0.090 |
| MySQL | 1 | 0.488 | 0.478 | 1.078 |
| other Python/Bot | 14 | 0.177 | 0.215 | 0.341 |
| BT-Task | 1 | 0.644 | 0.650 | 0.399 |
| miku family | 21 | 4.205 | 4.399 | 1.795 |
| Chromium/browser | 11 | 0.062 | 0.108 | 0.098 |
| mai | 21 | 0.907 | 1.064 | 0.406 |
| pjsk | 3 | 1.775 | 1.796 | 1.236 |
| taiko | 11 | 1.181 | 1.243 | 0.408 |
| VS Code server | 31 | 1.107 | 1.307 | 0.482 |
| Codex | 7 | 0.266 | 0.312 | 0.063 |
| extensionHost | 3 | 2.216 | 2.261 | 0.472 |

进程 PSS 合计 **14.308 GiB**。物理 RAM 30.609 GiB，MemFree 0.925 GiB，MemAvailable 13.718 GiB；swap used 10.851 GiB（单独列示，不算 resident）。

物理类别近似记账如下。它是 PSS 的**另一个视角**，不得与上表相加。

| Linux 物理类别代理 | GiB |
|---|---:|
| anonymous_pages | 13.832 |
| file_page_cache_proxy | 12.008 |
| shared_memory_tmpfs_resident_proxy | 0.373 |
| buffers | 0.355 |
| slab | 1.124 |
| page_tables | 0.165 |
| kernel_stack | 0.027 |
| percpu | 0.020 |

以 MemTotal−MemFree 为分母，解释 **94.00%**，残差 **1.780 GiB**。Cached−Shmem 作为 file-cache proxy；Shmem 含 tmpfs 但不只 /tmp；页表、slab 等是系统近似计数，非严格互斥页级证明。MemAvailable 是可回收能力估计，不等于未用内存。未将 RSS sum、PSS、mapped file cache 重复求和。

## 14. extensionHost / development attribution

| PID | uptime h | PSS MiB | RSS MiB | VmSwap MiB | 后代数 | 判定 |
|---|---:|---:|---:|---:|---:|---|
| 3303473 | 57.76 | 806.25 | 819.46 | 239.02 | 4 | UNKNOWN |
| 3689538 | 43.70 | 629.23 | 646.95 | 167.46 | 7 | UNKNOWN |
| 3722426 | 42.68 | 834.18 | 848.77 | 77.25 | 7 | UNKNOWN |

私有 host-accounting.json 保留每个后代 PID/PSS/RSS/Swap/role。PID 3724033 language server 约 258.59 MiB PSS；三个 extensionHost 都有 Codex 后代，其他 Python/Node 子进程未凭进程名硬归为 language server。后代已计入互斥主表，不能再叠加其树合计。

extensionHost 本体 2.217 GiB，VS Code server 1.107 GiB、Codex 0.266 GiB，当前合计约 3.59 GiB PSS，尚不足以证明“长期经常 >4–6 GiB”；历史峰值与当前值应分别监测。进程活着和启动久均不能证明用户仍在使用或已废弃，本轮 UNKNOWN，不杀 editor。它是独立容量占用，不能计入 Python core 泄漏。

## 15. Root-cause confidence / recommended next patch

| 候选 | 当前结论 | 置信度 |
|---|---|---|
| A Python live heap | 生产份额未知；隔离公开 JSON ~76.6 MiB traced | 未完成生产归因 |
| B/C native/image | 真实公开 PIL 渲染产生显著非-traced 驻留阶跃 | 高（该路径）；库间份额未知 |
| D browser children | 36h 主增量不在长期 Chromium 子树 | 高；page/context 数未知 |
| E allocator high-water | 隔离 render 增量中占主导；trim 回收 232.65 MiB | 高（隔离）；生产主导未确认 |
| F retained state | Score 方法缓存保留实例已复现；session/rank 实际量未知 | 所有权高；生产字节未知 |
| G queues/threads | pending admission 无硬界；实际积压未知 | 源码高；运行贡献未知 |
| H mmap/file | 当前最大是 anon mmap，非大文件映射 | 当前映射高；历史增长类别未知 |
| I other | 第三方插件、native allocator 与存活对象仍有缺口 | 保留 UNKNOWN |

推荐下一步按证据收敛，**本轮不实施优化**：

1. 最小数值 telemetry patch：分别记录 IO/render pending/running/完成数、task registry 长度、主要 session/rank 的条目数、Score cache_info、按 handler 的渲染成功/耗时。低频本地聚合、无用户内容，保持业务语义和现有 worker/cache budget；补全生产增量与具体存活结构的联系。
2. Score 定向生命周期补丁候选：先用公开真实大小谱面验证实例所有权、多个 Score 混用与结果等价，再评估随实例释放的 memoization。当前“会保留”已确认，但未证明改它能节省几百 MiB，不先给节省承诺，不直接取消缓存或改变预算。
3. PIL 渲染候选：在同一公开 fixture 比较 owned-image 显式关闭与有界短命 render 进程，连同峰值、warm/cold 延迟及输出 hash 一起评估。先确定收益再决定上线；不把已有 trim 加频当修复，不减 worker。
4. 完成真实 24h taiko cohort；生产 miku mmap/Threads 新序列继续积累。隔离 browser 启动兼容性另行处理，不扩大本轮到生产重启/依赖升级。

本轮产出为 **ATTRIBUTION PARTIALLY CONFIRMED**。不能签 Phase 3 COMPLETE，也没有新的 Wave 2 容量放行依据。

## Restart observation window — 2026-09-20 10:05:26 CST

用户报告业务进程重启后，已核验 taikobot 身份变更：旧 root/worker 3982136/3982155 → **829841/829877**；miku-core 仍为 3870884/3870979，未发生身份变化。本次仅重启只读采集器，没有重启业务服务。

旧 `cohorts.jsonl` 原样保留，旧定时汇总已停用；新窗口写入 `/var/log/python-memory-phase4/restart-20260920-100525`，不与旧样本合并为连续 24h。每分钟完整树采样、每 5min mappings，预算保持 128 MiB / swap 32 MiB / CPU 10%，采集 36h。

首样本：**2026-09-20 10:05:26 CST**，两服务完整且无采集错误。taiko PSS 321.14 MiB，仅为重启后的起点，不代表长期优化效果。24h 最早完成：**2026-09-21 10:05:26 CST**；自动汇总安排 2026-09-21 10:07:26 CST。

当前采集 unit：`python-memory-phase4-cohorts-20260920-100525.service`；汇总 timer：`python-memory-phase4-review-20260920-100525.timer`。后续若再变更 PID/start ticks，按新 cohort 重新计算连续窗口，不能按本次预定日期直接签 PASS。**24h gate 仍 PENDING；Phase 3 仍 FURTHER WORK REQUIRED。**
