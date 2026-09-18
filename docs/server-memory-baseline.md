# Server memory baseline and low-memory hardening

**MEMORY BASELINE ESTABLISHED — NOT YET SAFE FOR WAVE 2.**

2026-09-18 审计；事故原因沿用 [既有 forensic](server-memory-incident-2026-09-18.md)，不重复 OOM 实验。Viewer 保持 **0.68.10**，Annual **annual-observation-v4.5.0**；本轮未修改业务/算法、没有清理生产缓存或手工写 summary。改动仅为开发规则、受限 QA runner 和独立只读监控。

## A. 整机与完整进程 inventory

- `/proc/meminfo` 实际 RAM **30.609 GiB**，不是把标称 32 GB 当成 32 GiB；swap 约 **24 GiB**。
- 初始 `free -h`：available 约 14 GiB；swap 使用约 22.3 GiB。`/tmp` tmpfs 容量 16 GiB，已用约 15 GiB（95%）。
- 遍历 **356 个 PID**，保存 PID、PPID、脱敏 command、exe、cwd、RSS/PSS、RssAnon/RssFile、VmSwap/SwapPss、threads、start time 和 cgroup。进程退出/内核线程可能没有 smaps；此类记录不被伪造为可测工作集。状态文件与 smaps 非原子读数，VmRSS 与 smaps PSS 偶有反常大小不能当成数学精确总量。
- 全量、分别排序的 CSV：`/var/log/taiko-memory-audit/inventory-by-pss.csv`、`inventory-by-rss.csv`；原始 JSON `inventory.json`。不是只收集 top 10。路径位于 root 私有磁盘目录，未把完整命令或用户数据提交 Git。

### 初始互斥工作负载分组

Production Viewer 本身是 Nuxt production，下表只计一次；独立 unmanaged `.output` 另列。计数含命令包装进程；Other 包含内核线程、系统 daemon、SSH/shell 等。所有已枚举 PID 都归组。

| Workload | Processes | RSS GiB | PSS GiB | VmSwap GiB |
|---|---:|---:|---:|---:|
| Production Viewer | 1 | 0.370 | 0.338 | 0.000 |
| MySQL | 1 | 0.447 | 0.462 | 1.110 |
| Taiko/Bot Python | 43 | 7.969 | 7.827 | 4.604 |
| Other Python | 8 | 0.854 | 0.832 | 0.478 |
| VS Code server | 21 | 1.222 | 0.934 | 0.066 |
| extensionHost | 2 | 1.585 | 1.533 | 0.184 |
| Codex | 6 | 0.365 | 0.340 | 0.035 |
| Nuxt production (unmanaged) | 2 | 0.187 | 0.167 | 0.024 |
| Nuxt dev | 3 | 1.674 | 1.620 | 1.082 |
| Nuxt build | 0 | 0.000 | 0.000 | 0.000 |
| Playwright/browser | 19 | 0.333 | 0.250 | 0.178 |
| PHP | 9 | 0.001 | 0.001 | 0.064 |
| Other | 241 | 1.207 | 1.007 | 0.585 |

### PSS 排名前 15 的安全标识（全量见 CSV）

| PID / PPID | 工作负载 / cwd | PSS GiB | RSS GiB | Swap GiB |
|---|---|---:|---:|---:|
| 63147 / 63105 | Taiko/Bot Python · `/home/sigaer/miku-bot` | 2.067 | 2.079 | 0.327 |
| 1580110 / 4064401 | Taiko/Bot Python · `/home/sigaer/pjskClient` | 1.798 | 1.802 | 0.202 |
| 1697380 / 1697362 | Nuxt dev · `/home/sigaer/taiko/taiko-forum/taiko_viewer` | 1.293 | 1.326 | 0.266 |
| 3689538 / 3689302 | extensionHost · `/root` | 0.807 | 0.844 | 0.000 |
| 2270 / 1 | Other Python · `/www/server/panel` | 0.757 | 0.760 | 0.278 |
| 3303473 / 2071222 | extensionHost · `/root` | 0.725 | 0.741 | 0.184 |
| 3425646 / 3425596 | Taiko/Bot Python · `/home/sigaer/maibot` | 0.569 | 0.591 | 0.033 |
| 3265312 / 3265257 | Taiko/Bot Python · `/home/sigaer/taiko` | 0.472 | 0.486 | 0.021 |
| 2112 / 1178 | MySQL · `/www/server/data` | 0.462 | 0.447 | 1.110 |
| 3997543 / 3898640 | Taiko/Bot Python · `/home/sigaer/miku-bot/miku_bot/plugins/utils` | 0.415 | 0.418 | 0.482 |
| 4168579 / 1 | Taiko/Bot Python · `/home/sigaer/miku-bot` | 0.362 | 0.366 | 0.125 |
| 3630621 / 1 | Production Viewer · `/home/sigaer/taiko/taiko-forum/taiko_viewer` | 0.338 | 0.370 | 0.000 |
| 1953007 / 1 | Nuxt dev · `/home/sigaer/taiko/taiko-forum-worktrees/annual-poster-community/taiko_viewer` | 0.327 | 0.348 | 0.790 |
| 4082141 / 4082130 | Taiko/Bot Python · `/home/sigaer/maibot` | 0.309 | 0.318 | 0.098 |
| 1780236 / 1 | Taiko/Bot Python · `/home/sigaer/miku-bot` | 0.283 | 0.285 | 0.620 |

## A3 / D / L. Stale session 判断与已执行清理

| 进程 | 证据 | 判断与动作 |
|---|---|---|
| 1953007，3101 Nuxt dev | 9 月 10 日启动；独立 annual-poster-community worktree；`.env.test.local`；`/tmp/annual-phase-b-layer` 和 Phase B 测试日志；Phase 已关闭 | LIKELY_STALE → 确认测试遗留，SIGTERM 整棵拥有的进程树；5 个 PID |
| 1697380，3001 Nuxt dev | 9 月 15 日启动；`/tmp/poster-qa/dev.log`；无客户端连接；未见生产 upstream 引用 | 用户授权自行确认后认定测试遗留，SIGTERM 5 个 PID；未停止其他 Node |
| 2436574，旧 UX `.output` | 9 月 11 日启动；`/tmp/ux2-server.log (deleted)`；无生产监听，仅两条 DB 连接；与 taiko-viewer.service 的 3630621 分离 | 测试遗留，SIGTERM；不因连接 MySQL 就误认生产 Viewer |
| 3630621，3100 Viewer | systemd production service、真实 upstream | ACTIVE，保留 |
| 1946855，旧 Codex app-server | 8 月 30 日启动；app-server-control socket/log | UNKNOWN，年龄不足以证明无用；保留 |
| 664241，`python -` | 3 月 31 日启动、PPID 1、pjskClient cwd、管道/socket，约 0.949 GiB swap | UNKNOWN，未证明是忘记退出的 validation；保留并向业务 owner 核验 |
| 多 Remote-SSH / extensionHost | 活跃 VS Code server 树，有近期进程和 Codex 子进程 | ACTIVE/UNKNOWN，保留，不强制登出 |
| 现有 Playwright/browser | 父进程属于 miku-bot 等业务 Python，非本轮临时 QA | ACTIVE/owner-managed，保留；不能仅按存活天数判断 browser leak |

停止前保存了 PID/start/cwd/父链/FD/连接证据；只对验证过的具体进程树 SIGTERM，没有 broad pkill。初始三个测试主进程约 **1.79 GiB PSS / 1.08 GiB VmSwap**，不可把共享 RSS 简单相加当精确回收量。`cleanup.json` 和 inventory 保留，未删除它们的测试文件、heap snapshot 或用户数据。

### 10 分钟业务基线

观察窗口 **2026-09-18 14:15:43 CST → 2026-09-18 14:25:43 CST**，61 个样本，约 599.97 秒；开始前三个已确认测试服务均已停止，窗口内没有本轮 cold build / QA / Nuxt build。

这是共享主机的正常业务观察，**不是关闭所有编辑器后的独占空闲主机实验**。VS Code、extensionHost、Codex 保留并单独归组；production subtotal 排除这些组及 dev/build/unmanaged Nuxt。Other/Python 中尚未证实可停的工作负载保守计入 production，所以不低估业务预算。该 subtotal 是可审计的工作负载归属估计，不包含未映射 tmpfs 页或内核/page cache；不能与 MemAvailable 直接相减得到同一个量。

| 指标 | min | median | max |
|---|---:|---:|---:|
| PRODUCTION_BASELINE_PSS GiB | 10.626 | 10.819 | 11.361 |
| PRODUCTION_BASELINE_RSS GiB | 11.039 | 11.276 | 11.915 |
| Production VmSwap GiB | 6.890 | 6.890 | 6.896 |
| BASELINE_SWAP (host) GiB | 21.035 | 21.035 | 21.354 |
| BASELINE_MEM_AVAILABLE GiB | 14.321 | 15.824 | 15.999 |

窗口 CPU busy（全核总 tick）平均 **11.74%**、10s 区间最大 **17.87%**；iowait 平均 **0.25%**、最大 **9.87%**；1min load 中位 **0.89**、最大 **1.54**。

Viewer PSS 中位约 0.363 GiB、峰值 0.519 GiB；Taiko/Bot Python 中位约 7.94 GiB，是主要常驻工作集。MySQL 驻留 PSS 约 0.465 GiB **不意味着可以给它 0.5 GiB 硬上限**：另有约 1.11 GiB swap 和不可忽略的业务波动。编辑器/Codex 合计约 2.78 GiB PSS，尚未迁移到独立有界开发故障域。

## B. Swap health

`vmstat 1 60` 保存于 `vmstat60.txt`；剔除首行 since-boot，59 个一秒区间：si 均值 **72.88 KiB/s**、峰值 **4272**；so 均值 **0.47 KiB/s**、峰值 **28**；r 均值 **0.66**、最大 **3**；b 最大 **0**；wa 均值 **0.10%**、最大 **6%**。

10 分钟窗口 swap in 总计 **23.859 MiB**，10 秒采样最大速率 **2029.4 KiB/s**、平均 **40.72 KiB/s**。

10 分钟窗口 swap out 总计 **0.078 MiB**，10 秒采样最大速率 **5.6 KiB/s**、平均 **0.13 KiB/s**。

memory PSI full 累计 stall 占窗口 **0.437%**，IO full **0.546%**；avg10 峰值分别 12.57% / 12.97%，包含窗口开头之前压力的平滑尾部，不能与窗口累计比率混淆。末尾 avg10 已回落至 0。

结论：高 swap **主要是历史冷页残留，夹杂短暂回读/压力**，当前证据不支持整个窗口持续 thrashing，也不支持“完全没有压力”。没有 swapoff/swapon/drop_caches。6.89 GiB production VmSwap 的未来热回读仍是预算风险；它不是可免费再利用的 RAM。

## C. tmpfs / temporary budget

`df -h /tmp` + `du -x -B1` + stat/mincore + 全 /proc FD 和 maps 检查；未读取 heap 内容。`tmp.json` 保存所有顶层目录及 >100 MiB 文件的 logical/allocated size、mtime、UID、打开 PID 与驻留估计。

| 项目 | logical / allocated GiB | owner / mtime | 是否打开 | 建议 |
|---|---:|---|---|---|
| `/tmp/codebuddy-heap-snapshots` | 10.658 / 10.658 | UID [0]；2026-08-27 01:11:58 CST 至 2026-09-05 14:31:30 CST | 无 FD | ARCHIVE → MOVE_TO_DISK；校验后再批准移除源文件 |
| `/tmp/node-compile-cache` | 0.374 / 0.469 | UID [0]；2025-12-19 22:05:02 CST 至 2026-09-18 11:44:49 CST | 无 FD | KEEP，后续转磁盘并给 512 MiB 预算 |
| `/tmp/taiko-growth-validation` | 0.211 / 0.235 | UID [0]；2025-09-28 17:06:21 CST 至 2026-09-17 23:53:18 CST | 无 FD | ARCHIVE / MOVE_TO_DISK |
| `/tmp/Resource-CN1.55.7z` | 0.435 / 0.435 | UID [0]；2026-08-15 22:44:08 CST 至 2026-08-15 22:44:08 CST | 无 FD | DELETE_CANDIDATE，先确认用途 |
| `/tmp/tmp.YwU4RPE4Yb` | 0.162 / 0.162 | UID [0]；2026-06-14 21:37:24 CST 至 2026-06-14 21:37:24 CST | 无 FD | UNKNOWN build/temp；按 task owner 确认 |

13 份 heap snapshot，共约 **10.658 GiB**，mincore 驻留约 **0.141 GiB**，无打开 FD，也无 /proc/maps 引用。它们仍占 tmpfs 配额；大量非驻留 tmpfs 页与历史 swap 消耗相符，但 mincore 不能逐页给出 swap 槽归属，不能把所有非驻留页精确宣称为 swap。

归档建议：磁盘目录权限 0700，逐文件流式复制/压缩、流式 hash 校验、确认 owner 后再删除源；不要用 readFile/内存 Buffer 归档 10 GiB。根盘当前约 39 GiB 空闲，复制会消耗磁盘并触发冷页回读，应受 I/O/内存 scope 限制且单文件串行。**本轮未归档/删除这些文件**。未来 heap dumps 仅显式开启，磁盘总额 ≤2 GiB、≤2 份、7 天保留；临时 QA 单任务建议 ≤1 GiB、7 天保留。新 QA TMPDIR 已使用 `/var/tmp/taiko-bounded-qa`。

## E. Annual cold-build profile

对 1532 个有 snapshot 的目录只扫描文件名/大小选样，**没有全量生成**。按历史总字节量选约 P10、median、最大输入，至少 3 snapshots。每次一个生产同源 CLI、全新私有 normalized cache、文件系统历史只读；所有输出写 `/var/log/taiko-memory-audit/cold-*`，没有写 production DB/cache。OS page cache 未清：这里的 cold 指 summary/normalized cache miss，不代表物理磁盘全冷。

每任务独立 systemd cgroup：MemoryHigh 2 GiB / Max 3 GiB / SwapMax 256 MiB / TasksMax 128 / CPUQuota 200% / RuntimeMaxSec 240；主机 MemAvailable <8 GiB 或 PSI full avg10 >2% 时不准入，执行中 available <5 GiB 停止。采样前 2 秒 0.2 秒一次、之后 1 秒一次；`wait4.ru_maxrss` 捕获子生成器更短峰值。PSS/RSS tree 包括很小的 usage wrapper；cgroup.current 另含归属该 cgroup 的 file/cache/kernel 页面，并不一定大于共享 PSS。

首次工具 preflight 因主机没有 `/usr/bin/time` 在 generator 启动前失败；证据保留 `preflight-*`，不计为生成失败。换成 Python wait4 后三次全部成功。

| 样本 / UID | snapshots / input MiB | generator s | max RSS MiB (wait4) | tree PSS peak MiB | tree RSS peak MiB | cgroup peak MiB | events / output MiB |
|---|---:|---:|---:|---:|---:|---:|---:|
| small / 1322664 | 3 / 0.23 | 1.86 | 167.87 | 152.49 | 173.97 | 129.49 | 92 / 0.11 |
| median-like / 27214979 | 28 / 0.88 | 2.30 | 172.04 | 156.82 | 178.47 | 133.30 | 1402 / 1.51 |
| large / 91899919 | 235 / 124.21 | 15.39 | 331.26 | 321.95 | 343.75 | 488.55 | 2672 / 2.84 |

全部 `annual-observation-v4.5.0`，exit 0，VmSwap/cgroup swap **0**，high/max/oom/oom_kill **0**；owned cgroups 全部回收。RssAnon tree peaks 约 125.1 / 129.6 / 295.0 MiB。完整 PID/PPID/cgroup/逐秒轨迹、进程最大 RSS 和阶段日志见 `profiles.json`、各 `samples.json` / `time.txt` / `progress.log`。

这是 **Python generator** 的峰值增量，不是假装测得整个 HTTP + rating enrichment + MyDon + Node serialization 的峰值。Node 侧最多 64 MiB stdout、JSON parse/校验等另留预算。三账号峰值的样本中位 RSS 172.04 MiB；“P95-like”只能用最大观测 **331.26 MiB** 作保守替代，**不是统计学 P95**。cgroup 最大约 **488.55 MiB**，建议先按 **1 GiB / build** 预算，而非按最小样本放开 worker。

## F / G. Current concurrency and backpressure

| 路径 | 当前保护 | 缺口 |
|---|---|---|
| 普通 Annual build | `index.ts:122` build limit **1 / Node process**；async pump；user/binding/version file lock 与已有 job 复用 | pending array/DB queue 无明确最大长度、等待 TTL；多 Node replica 不共享此上限 |
| 旧 poster job | 独立 poster queue limit **1 / process** | 与 build 可并行；不覆盖新版 share-card |
| 新 share-card | `createAccountAnnualShareCard` cache miss 直接 `renderAnnualShareCard` | **无全局 render semaphore，冷请求可并行启动 Chromium；相同卡片并发也在写库前先 render** |
| 管理员即时 preview | `buildAdminAnnualPreview` 直接 `runAnnualSummaryCli` | 绕过普通队列，多 operator 请求可启动多个 generator |
| rating distribution | 独立 `rating-distribution` file lock；逐账号读取并留紧凑数值 | 单独 Python 类任务，未纳入统一 generator 预算；不能把普通 limit 1 当所有 Python 总上限 |

实际生产服务是单 Node 进程；清理的另一 `.output` 是测试进程。结论不是“所有 build 完全无界”，而是**普通 worker 已限 1，但全入口资源准入及 render 仍未闭环**。正式开放前属于 P1 capacity risk。

### 设计建议（本轮没有实现业务 queue/semaphore）

1. 统一 generator admission，覆盖普通/admin/必要的 ratings 类重任务；起始 **MAX_CONCURRENT_ANNUAL_BUILDS=1**。多实例采用单 worker service + durable DB job claim/lease，或明确的跨实例 semaphore，不能依赖各进程自己的计数器。
2. 保持同一 user/binding/version single-flight；先去重再占队列名额。FIFO 待运行上限建议 **20**，queue TTL **10 分钟**，running timeout 保留当前 **4 分钟**。排队超时与执行失败分别编码；不把 queued 当 generator crash。
3. 满队列返回可重试的容量状态（429/503 + Retry-After），不 fork；异步 UI 展示现有 queued/running 状态。不要同步等待锁而阻塞 Node event loop。
4. 指标：running、queue depth、oldest age、admitted/rejected、queue timeout、run duration、cgroup peak、kill reason；job_id/correlation 可记录，不记 cookie/raw invitation。lease 回收可恢复 worker 退出，不能每次 reload 重建失败任务。
5. **独立 canonical-render gate 建议并发 1、待队列 8、same-summary/locale/fingerprint single-flight**，覆盖 save/community/backend/legacy render；超时必须覆盖整个 render，包括 fonts/evaluate/close。正常生成结果与资源 readiness 不变。
6. 建议持续 MemAvailable <8 GiB 或 memory full avg10 >2% 时暂停新启动，恢复阈值 >10 GiB 持续 30 秒，避免反复开关；最旧队列超时仍按规则处理。限流不是缓存删除或数据 bypass。

## H. Python low-memory audit

- `snapshots.py:142` 起先读入所有 `SnapshotInput.payload` 并排序，再重建整个 history；峰值同时持有 raw candidates 和 rebuilt states。小对象列表本身不是问题，原始大 payload 的生命周期才是主要优化对象。
- 既有 COW / `changed_keys` / signature 正确保留：未变化 chart dict 共享；delta 只 deepcopy 变化 chart；每个 snapshot 仍建立完整 songs 引用列表并 sort keys，profile/achievement/dojo 另 deepcopy。不要误报成“每步 deepcopy 全部歌曲”。
- signatures 保留 canonical JSON bytes，有额外内存但避免重复全状态序列化；不得未经等价验证改成另一种比较。`file_sha256` 已使用 1 MiB streaming chunks，是正例。
- `service.py` 同时保留 history、selection、events、play_events、trusted 等引用集合。多数列表共享 event 对象，不是多份深拷贝。CLI 最后 `json.dumps` 生成整个输出字符串；`build_public_summary` deepcopy 的是 summary，不是全年全部 raw history。
- 优先后续设计：metadata/lineage/order 的第一遍索引 + 第二遍增量重建；释放已处理 raw payload；保留必要边界状态、compact observed events 和 fingerprint metadata。严格保持排序/dedup/source lineage/年度边界和 first-record semantics；先做输出等价和峰值比较再修改。
- rating distribution 按文件逐个 `json.loads`、保留标量 ratings/bins，未观察到把全 corpus payload 一起存入列表。其全部 HTTP 冷排名耗时/峰值本轮没有单独跑，属于额外预算验证项。

## I / J / K. Node, image, Playwright audit

- 正例：输入文件 hash 已 `createReadStream`；图片保存走 server canonical renderer；下载 Blob/object URL、10 秒 revoke；没有把 Poster 转为页面 screenshot 再 scale；小 QR dataURL 是有界例外。
- `runtime.ts` stdout string 拼接后 64 MiB 检查、随后 trim/JSON.parse/schema validation，存在瞬时多 representation；stderr ring 4000 字符，但 progress `pending` 在无换行异常输出时缺独立长度限制。建议容量限定在拼接前、限制 pending，后续才考虑 stream-to-file，避免改变契约。
- `readAnnualJson` / `readAnnualImage` 全文件读取；图片当前约 1 MiB PNG 本身不大，但并发倍增。部分 GC 的 `Promise.all` 依赖可变 share 列表，应后续改 bounded pool。schema 错误 stringify 后再 slice 的做法不能防止 stringify 分配。
- `poster.ts:54` 每次 render 新开 browser/context/page；PNG Buffer → atomicWriteFile，浏览器 finally close 是正例，未见长期显式缓存所有 PNG。页面同时有 DOM、解码位图、screenshot surfaces、PNG Buffer；1080×1648 RGBA **6.79 MiB**，3× DPR 为约 **61.11 MiB**，不应只按 PNG 文件大小预算。
- 可改进为 screenshot 临时文件 + atomic rename，减少业务持有 PNG Buffer；不得为此改 readiness/字体/版式。当前 `page.evaluate` 中额外 `document.fonts.ready` 没有总 deadline，page default timeout 不能覆盖任意 evaluate；需整个 render deadline 与 cgroup teardown。
- 当前 helper 的 Promise.all 用于固定少数卡片图片与背景，有界资源规模下可接受，不是 corpus 并发池；未来 DOM 若可变则加 pool。没有理由盲目重写它或关闭 fallback。
- 已有静态 QA/e2e 顶层 browser finally close；各 page/context 并不都在局部 finally 释放，测试失败要依赖外层退出。历史三个 dev session 遗留是已证实的生命周期缺陷；19 个业务浏览器不能据此判 leak。
- 肇事 PNG Buffer deep assertion 位于历史私有 validation，不能据此声称现有生产算法存在该断言。仓库扫描未发现明确 Buffer 深度断言；大型二进制断言禁令现已写入 AGENTS 和 guidelines。

### Bounded QA 实测

独立 runner 串行验证已有 canonical PNG 在 360/390/430 三个 viewport 的 decode/screenshot，流式 hash；exit **0**，tree PSS peak **307.06 MiB**，cgroup peak **192.92 MiB**，swap **0**，结束 cgroups **[]**。这不是完整 Nuxt production render 的最大值，只证明常规图片 QA 可在初始小预算内完成；未触发 OOM 或重放 runaway。

新 `scripts/memory/run_qa.sh`：host-wide flock 一次 1 个 QA，2/3 GiB High/Max、256 MiB Swap、256 tasks、200% CPU、15min、KillMode=control-group、OOMPolicy=stop、finally trap；Node heap 1536 MiB。**没有必要先给每个小 QA 6/8 GiB**。6/8 GiB 作为未来整个 development/build 域候选上限，不能每个会话都各发 8 GiB。runner 是新任务的强制项目规则，不代表已隔离全部现存 root/VS Code session。

## M / N. 服务预算与故障域

| Fault domain | 建议预算 / 限制 | 当前状态 |
|---|---|---|
| Production 常驻总量 | 先保留 **14 GiB** 容量包络：实测 max 11.36 + ~2.64 GiB 业务/热回读余量 | 容量规划值，**未设置总生产 MemoryMax**；swap 热回读仍需后续观测 |
| Viewer 本体 | 后续候选 High 1.5 / Max 2 GiB，仅在 Python/Chromium 已迁出后验证 | 未应用；目前孩子仍继承 Viewer cgroup，不能直接拿本体 PSS 设限 |
| MySQL / bot Python | 按服务 owner、热页和业务周期测峰再定；不能按当前低 RSS 杀 worker | 未应用任何生产限制 |
| Annual worker | 每 job 初始 High 768 MiB / Max 1 GiB、Swap 128 MiB、Tasks 64、240s；全局 N=1 | **建议**，先在真实 worker integration 验证；本轮测量用 2/3 GiB 上限避免削平正常峰值 |
| Canonical renderer | 建议独立域、并发 1；容量模型先留 0.75 GiB，后续测真实 Nuxt renderer 再定 High/Max | 仍未实现隔离/全局 semaphore；这是 gate blocker |
| 新 ad-hoc QA | 2/3 GiB、Swap 256 MiB、Tasks256、15min，host lock | runner 已验证；由 systemd 管整个子树 |
| 长期 dev/Codex/QA 域 | aggregate High ~6 / Max ~8 GiB、Swap ≤1 GiB，多个 task 的上限受父 slice 约束 | 设计，未迁移已有编辑器；需计划性重新启动 session，不能把整个 root session 硬塞小限额 |
| Nuxt deploy build | 单独域候选 High 5 / Max 6 GiB、Swap 512 MiB、Tasks512，独占维护窗口 | **未应用**；保留已有 flock 和 heap=4096 MiB，不新增第二把 deploy 锁 |

实际限额写入 cgroup v2 才能限制 native/Buffer/Chromium；迁移父 PID 不会自动搬走已存在的子进程，不能把 root user slice 限额当安全迁移。现有生产/root 主要 cgroup 仍无限制，设计状态必须如实保留。

Deploy 额外发现：脚本明确在 `/tmp/taiko-viewer-release.XXXXXX` 建 workspace，固定路径不会因 QA TMPDIR 改变而迁走。未来需单独批准脚本变更到磁盘并压测 build 峰值；本轮不编辑/运行标准 deploy 脚本。

## O. 长期监控与 sysstat

- 已安装并启动 **taiko-memory-monitor.service**；独立 Python sampler，每 **15s** 记录 MemAvailable/swap、paging/major-fault counters、memory/IO/CPU PSI、CPU/load/disk counters、关键 cgroup current/swap/events；每 **60s** top-15 PSS。只记进程短 name，不记 argv/env/auth。
- 磁盘 `/var/log/taiko-memory/YYYY-MM-DD.jsonl`，0700 目录/0600 文件、14 天保留、32 MiB/日硬 cap（约 448 MiB 总预算）。UTC 按日轮转，超 daily cap 暂停该日追加，需外部监控 file freshness/size。没有写 /tmp。
- 监控自身 High64 / Max128 MiB、Swap0、Tasks16、CPUQuota10%、Nice10、低 I/O 优先级。当前约 9 MiB memory.current，NRestarts 0，已验证多条持续采样；不是仅交付配置模板。初次安装缺少 libexec 目录在启动前修复，未影响生产。
- 尚无外部消息/告警投递；建议 warning available<6 GiB 60s、critical<3 GiB、持续 memory full>2%、新 oom_kill、swap IO+IO PSI 同升。**不要声称本轮已配置 Pager/邮件告警**。
- sysstat 根因：`/etc/default/sysstat ENABLED=false`，collect/summary timer 均 disabled；cron 的 debian-sa1 在 systemd 环境直接 exit。故“已安装”没有 sa 历史。
- 可选补充配置（**未执行**）：ENABLED=true、HISTORY=14、COMPRESSAFTER=2；启用 sysstat.service/collect.timer/summary.timer，将 collect 的 OnCalendar override 为 30s 并检查 `/var/log/sysstat/sa*` 连续生成。新 sampler 已覆盖 15s memory 观测，没必要重复安装 sysstat。

## P. Launch capacity model

RAM **30.609 GiB**；Production 规划 **14 GiB**（实测 PSS median 10.819 / max 11.361）；kernel/page-cache **2 GiB**；常驻 admin/editor **3 GiB**；30% safety **9.183 GiB**；留给 Annual pipeline **2.426 GiB**。

为 Python **1 GiB / build**（最大观测 cgroup 0.477 GiB 的约 2×）、canonical render 暂留 **0.75 GiB**、Node/enrichment/serialization **0.25 GiB**：

`floor((30.609 - 14 - 2 - 3 - 9.183 - 0.75 - 0.25) / 1) = 1`

**Recommended MAX_CONCURRENT_ANNUAL_BUILDS = 1，保持现有普通 worker 数，不增加。** 这是假设 renderer 同时最多 1 且已隔离的规划；当前未限 renderer，所以不能宣布已经安全。3 GiB admin 只覆盖常驻编辑器，不准许同时再开重型 build/QA；重 QA/build 使用独占维护窗口及重新核算的容量准入。若所有 production swapped pages 同时转热，14 GiB 也可能不足，需减 dev 负载或扩容，不能吃掉 safety reserve。

取串行大账号 15.39s，加未实测 HTTP enrich/I/O 余量，采用 **20s / job** 的示例服务时间（非承诺 SLA）。空队列、单 worker、无错误/新流量条件下：

| 同时点击用户 | running | queued | 末位开始等待 | 末位完成时间 |
|---:|---:|---:|---:|---:|
| 5 | 1 | 4 | 80s | 100s |
| 10 | 1 | 9 | 180s | 200s |
| 20 | 1 | 19 | 380s | 400s |

这只是排队计算，不是并发压测。queue cap20 能容纳示例；若已有队列则可能拒绝。实际 240s timeout 的慢任务可令后位超过建议 600s queue TTL，此时应明确排队超时/可重试，而不是无限等待或多 fork。三样本不足以给总体统计 P95/公开用户规模吞吐保证。

## Q / R. 已执行、未执行与 gate

已执行：完整 inventory/PSI/swap/tmpfs 审计；确认并停止三棵旧 QA/dev；约 10min baseline；3 个受限 serial cold builds；1 个受限三视口图片 QA；磁盘长期监控；[memory guidelines](memory-engineering-guidelines.md)、AGENTS 强制规则及 QA runner。验证均保持生产 active / NRestarts=0；没有新 OOM、没有改变 Annual 结果语义。

未执行：生产代码优化、generator/renderer semaphore、新 worker service、生产/MySQL cgroup 限制、root/editor 迁移、swap/cache 清理、heap archive/delete、deploy script 修改、外部告警配置。

**真实 capacity blockers：**

1. 新 share-card 冷渲染无全局并发/单卡 single-flight，及管理员直跑绕过 generator admission；普通 queue 缺容量与等待 TTL。
2. 生产与既有 root development 仍未完成故障域隔离；新 runner/规则只保护合规的新 QA，不能宣称 root 全部受限。
3. 约 15 GiB tmpfs / 21 GiB 历史 swap 占用未治理；真实 Nuxt render/完整 HTTP enrichment 峰值、正常业务更长周期热回读包络尚未闭环。不要用 0.3 GiB 的轻量 PNG QA 代替 production renderer 最大峰值。

建议下一轮先落实全入口 bounded admission + render limit=1，再受限验证真实 renderer 峰值；经确认串行归档旧 heaps；计划迁移 dev 域，观察至少一个正常业务周期，复算预算后再考虑 Wave 2。不是为降低延迟把并发从 1 调大。

**MEMORY BASELINE ESTABLISHED. NOT YET SAFE FOR WAVE 2.** 现有 Wave 1 可继续受控观察，内存审计本身不替代此前移动设备验收 Gate。

## Evidence / references

全量私有证据：`/var/log/taiko-memory-audit/`（inventory CSV/JSON、tmp.json、baseline JSONL、baseline-summary.json、vmstat60.txt、profiles.json、各 cold 目录、qa-profile.json、cleanup.json）；长期只读 telemetry：`/var/log/taiko-memory/`。Audit raw artifacts 为本次保留，未进入自动长期日志轮转；单独 owner-approved retention。

关键源码：`taiko_viewer/server/services/account/annual-summary/{index,runtime,poster}.ts`；`/home/sigaer/taiko/plugins/utils/annual_summary/{snapshots,service,cache,helpers,__main__,ratings}.py`；标准部署 `scripts/deploy_forum_web.sh`。

cgroup 限制/层级及 PSI 含义以 [Kernel cgroup v2](https://docs.kernel.org/admin-guide/cgroup-v2.html) 和 [Kernel PSI](https://docs.kernel.org/accounting/psi.html) 为准；实际主机 kernel 5.10 没有 memory.peak，因此使用逐点采样 + wait4，而不是伪造 MemoryPeak。
