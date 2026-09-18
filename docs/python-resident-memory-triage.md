# Python resident memory triage — 2026-09-18

范围：只读生产 `/proc`、源代码及已有日志；受限实例只读公开 master data。没有向运行中的 bot 注入 profiler，没有重启/减少业务 worker，没有迁移账号数据，没有修改 Annual 算法。私有证据位于 `/var/log/taiko-memory-phase2/`（0700）。

## PSS > 500 MiB 的 Python 进程：首次扫描及复查

首次扫描有下表四个；16:11复查新增第五个Taiko Bot，见末节，未遗漏越过阈值的新进程。单位 MiB，主进程数据取同一次 smaps_rollup。PSS 是驻留量，VmSwap 单列，不把文件大小当成驻留量。

| 服务 / PID | PSS | VmSwap | Private Dirty | 线程 | 连同子进程 PSS | 决策 |
|---|---:|---:|---:|---:|---:|---|
| miku-bot / 63147 | 2085.7 | 326.5 | 2077.7 | 61 | 2283.2 | **OPTIMIZE PYTHON**；共享 master-data 查询层是条件性 Go 候选 |
| pjskClient / 1580110 | 1841.5 | 206.8 | 1840.9 | 14 | 1841.5 | **OPTIMIZE PYTHON**；优先去除全表备用 deepcopy |
| maibot / 3425646 | 602.7 | 30.2 | 591.1 | 18 | 602.7 | **OPTIMIZE PYTHON**；先限制字体缓存、确认图片生命周期 |
| BT-Task / 2270 | 775.8 | 283.8 | 772.1 | 14 | 775.8 | **KEEP PYTHON**；第三方管理组件，先供应商诊断，不自制替代面板 |

完整 RSS、RssAnon、RssFile、Pss_Anon/Pss_File、maps、父链、同父 worker 和进程树在 `python-inventory.json`。这四个进程均以匿名私有页为主，**不能仅由 smaps 把匿名页精确分成 Python 对象、Pillow/NumPy/native malloc 和 allocator fragmentation**。

### Worker/COW 证据

miku：63105 → resource tracker 63146 + spawn worker 63147 → Playwright/Chromium 子树；同一 master 下仅一个业务 worker。maibot：3425596 → resource tracker 3425645 + spawn worker 3425646；仅一个业务 worker。pjskClient：4064401 → 1580110，单个常驻 main。BT-Task：PID 1 → 2270；不是 Hypercorn worker pool。

miku/maibot 启动命令明确为 `multiprocessing.spawn`，不是 preload 后 fork。四个主进程 `Shared_Dirty = 0`；miku shared clean 55.0 MiB、maibot 33.5 MiB 主要是共享库，不是共享全年业务对象。没有证据证明目前存在“N 个 worker 各复制同一 1 GiB state”；不建议凭进程名减少 worker。不同服务会独立缓存同一公开 master data，但没有跨进程对象 census，不能把它们的所有私有页都算作重复数据。

建议：保留现有一个 async worker 的部署方式；对新的 CPU/image 子任务用有界执行器。只有测得 QPS、event-loop delay 和并行任务峰值后，才调整数量。没有实施 worker 数量变更。

## 构成与优化边界

### miku-bot

- `/home/sigaer/miku-bot/miku_bot/sekai/core/api.py`：`_master_cache` 是进程内 OrderedDict，按 mtime 更新，默认 `MIKU_MASTER_CACHE_MAX_ENTRIES=-1`，没有条目/字节上限。本次进程环境未覆盖该值。JP master data 418 文件、298.2 MiB 磁盘 JSON；这不是当前已加载的内存总额。
- `plugins/utils/resource_cache.py`：字体/静态图片/资源图片 LRU 上限分别 64/32/96，但只限条目、不限 decoded bytes；读图函数还返回 `.copy()`。另有独立 card/gacha/chart/guess 缓存，不属于这三个 LRU。
- **已有生产日志提供反证**：最近 2 MiB 日志有 12 次 render-trim。最后五次记录字体 0–6、静态图 0–1、资源图 0–18、master 3–6 个；清理后 RSS 仍约 2.03–2.04 GiB。清理前后减少约 66–126 MiB。不能把 2 GiB 全归咎于这几个已被清过的 cache，也不能宣称清 cache 可回收 2 GiB。
- maps 包含 NumPy、Pillow、OpenCV、matplotlib；子浏览器/driver 合计约 197.5 MiB PSS，单列而非重复算入 Python。源文件已关闭后无法用 FD 反推出已加载对象；`python-files.json` 只记录仍打开的大文件，不等于完整历史加载清单。
- 用户数据接口按目标读取；未发现该查询层常驻所有用户 suite 的证据。用户排名/猜歌历史、主数据和图片缓存分别管理；当前各全局 dict 的 live 字节仍未知。
- 先做 byte-bounded master cache、只读紧凑查询索引、图片/字体按 decoded bytes 预算、短命 render 子进程实验。**初步可验证目标 0.1–0.4 GiB/worker**，不是承诺；约 2 GiB 的剩余构成必须在受控副本做对象/native 分摊，不能用语言重写估算代替。

### pjskClient

- `/home/sigaer/pjskClient/sekaiapi.py::_read_masterdata_json` 每次成功 `json.load` 后保存 **`copy.deepcopy(data)`** 到无字节上限的 `MASTERDATA_JSON_CACHE`，再把原 data 返回调用方；回退时又 deepcopy。
- `main.py` 和 `modules/runtime/masterdata_indexes.py` 有 RESOURCE_BOX_INDEX、CARD_MASTER_INDEX、CARD_EPISODE_BY_ID_CACHE、多个 music/card 索引；多数索引指向已加载 row，而备用缓存另有一份 row tree。
- `runtime_state.py::RUNTIME_STATE_ACCOUNTS` 保存账号运行状态；`runtime_runner.py` 的活动账号循环持有 `suite_data_current`。这证明有 per-active-account 驻留，**不证明所有磁盘用户数据均已常驻**。没有导出账号/session 内容，也没有假装知道 live account 数量。
- maps 有 Pillow/msgpack/ujson；无子浏览器。文件 RSS 仅约 5.2 MiB，不支持“1.8 GiB 都是必要 mmap”的说法。
- 优先把可靠的 last-good 版本落盘，按需读取/索引，保持原子更新和 fallback 语义；共享只读 row 时必须审计调用方是否修改 row。单个 resourceBoxes 实测见下表。**规划目标 0.14–0.6 GiB/进程**，上界取决于真实 cache 驻留与并发账号数，不作为本轮已经回收的内存。

### maibot

- `libraries/maimaidx_music.py::MaiMusic` 懒加载 total_list、aliases、plate IDs、level 索引、guess_data；`MusicList.filter` 使用 `deep=False`，不能误报为已有全表 deepcopy。level 索引使用小型 RaMusic 记录。
- static 目录 13 份 JSON 共 10.7 MiB；music/chart 数据体积本身不足以解释全部 603 MiB。
- `libraries/image.py` 字体 LRU 默认 `MAIMAIDX_FONT_CACHE_SIZE=0 or None`，即**无界**；static bytes 默认 128 条。maps 有 Pillow/NumPy。没有子浏览器；图片渲染函数仍有逐次打开/转换/resize 路径。
- 建议先增加字体条目及字节预算、记录实际 cache_info 与图片峰值，在单任务结束检查引用生命周期。**规划目标 0.03–0.15 GiB**，未取得 live 字体缓存计数，不能把该范围宣称为实测节省。
- 以图片/native 库为主的功能保留 Python；没有证据支持完整 Go/Rust 重写。

### BT-Task

- `/www/server/panel/BT-Task` 载入 task.main；Task 管理采样、进程、网络及插件任务。`class/process_task.py` 有 SimpleCache(5000)、PID/network/process dictionaries。
- 没有科学计算/浏览器库映射，无业务子树，绝大多数为私有匿名页；**具体 heap/native/cache 比例未知**。不运行其主程序作为“测试”，避免执行真实管理任务。
- KEEP PYTHON。优先使用供应商支持的进程监控/cache 诊断和升级评估；需要在受控副本录入合成进程样本后再评估缓存清理。当前**可信的节省估计为 0（未证明）**，不许用“重写面板”补齐容量表。

## 受控 representation prototype 与 Go PoC

代码：`scripts/memory/prototypes/master_query.py`、`master_query.go`。输入是同一份 **23.56 MiB resourceBoxes.json / 37,691 rows**，不是用户数据。存在重复 ID；三个实现均保持当前 dict comprehension 的 **last row wins**，SQLite 使用 INSERT OR REPLACE。100 个确定性 ID 查询内容完全相等；Python current/SQLite 的规范 JSON SHA-256 相等，Go 的解码结果逐对象比较相等。

| 实现 | 无 profiler PSS | 基础 PSS | 数据加载/启动 | lookup P50 / P95 | 单进程本地查询吞吐 |
|---|---:|---:|---:|---:|---:|
| 当前 Python：JSON + deepcopy backup + ID index | 151.1 MiB | 9.45 MiB | 1.484 s | 0.530 / 0.694 μs | 1,127,822/s |
| Python：SQLite 只读，2 MiB cache，关闭 mmap | 12.36 MiB | 9.43 MiB | 0.017 s | 15.83 / 20.221 μs | 61,079/s |
| Go：流式读 JSON，RawMessage ID index，按次 decode | 20.88 MiB | 1.85 MiB | 0.544 s | 7.632 / 16.702 μs | 106,765/s |

- 10,000 次 warm 本地 lookup；不含 HTTP/RPC、并发、源文件更新、SQLite 首次建库时间。current 在建索引后释放局部 rows list，保持实际调用方的所有权关系；其返回已有对象，SQLite/Go 解码独立返回对象；**输出值相同，分配行为不同**。不是端到端 QPS 或生产 P95。
- SQLite 相对 current 驻留减少约 **138.7 MiB（91.8%）**；Go 减少约 **130.2 MiB（86.2%）**。按表内存不等于整个服务内存；不可线性乘 418 文件或整个 1.8/2.1 GiB。
- 另外单独开启 tracemalloc：current Python live allocations 84.4 MiB、peak 128.4 MiB；主要 decoder ~41.7 MiB、copy.py 几项合计 ~41.7 MiB。开启 tracer 后 PSS 295.5 MiB、启动 26.60 s，明确展示 profiler 本身开销，**不把这次结果混入正常峰值**。
- 只有“跨进程共享的只读 master-data ID 查询”被选为 **CANDIDATE FOR GO** 并做这一项 PoC。结果显示，Python 内 SQLite 改造已经更省驻留；没有理由现在全面迁移。若未来证实多个服务长期重复加载同表且需要统一原子发布，可以试共享 Go read service；边界仅 versioned master-data query，不包含账号/auth、游戏自动化、Pillow/render、业务状态机。
- **没有 RUST 候选**：没有取得需要 Rust 的 CPU/parser/binary 热点证据。

## Uptime 与未决测量

与上一轮 inventory 比较，同 PID PSS：miku 2116.5 → 2085.7 MiB；pjskClient 1841.6 → 1841.5；maibot 582.2 → 602.7；BT-Task 774.8 → 775.8。进程分别自 9 月 13 日、9 月 4 日、9 月 6 日、2025 年 12 月 18 日运行。短窗波动与 uptime 的相关性不足以证明 leak；maibot 增长约 20 MiB 值得继续看一周曲线，不能因此直接杀进程或减少 worker。

A Python heap / B native / C file-backed / D cache / E duplication / F unknown 的精确百分比，只在 resourceBoxes 受控数据路径得到部分分摊；生产四个完整进程仍有 unknown。下一步应在无网络、无账号副作用的受控实例复现单请求，分别统计 tracemalloc、native、cache byte counter 和 smaps；**不在本轮给未知字节贴上已验证标签**。这一长期 triage 不要求 Wave 2 前完成服务重写。

### Supplement: RSS and resident split

| PID | RSS MiB | RssAnon MiB | RssFile MiB | Pss_File MiB | Start (CST) |
|---|---:|---:|---:|---:|---|
| 2270 | 779.4 | 772.0 | 7.4 | 3.7 | 2025-12-18T16:52:30+08:00 |
| 63147 | 2131.9 | 2075.7 | 56.2 | 8.0 | 2026-09-13T14:03:57+08:00 |
| 1580110 | 1845.5 | 1840.3 | 5.2 | 0.6 | 2026-09-04T13:53:26+08:00 |
| 3425646 | 625.2 | 590.5 | 34.7 | 11.6 | 2026-09-06T19:11:58+08:00 |

### Project-wide worker roles (additional read-only check)

同 cwd 不等于相同 worker。miku 有 core / gateway / milky 三个 Hypercorn master，各 `--workers 1`；maibot 有 main-core / main-gateway / bottle-core / bottle-gateway 四个 master，各一个 worker。还存在独立 upload/ranking/update 和 customer-portal 进程，不应作为同一个 replicated application pool 去减 worker。当前 role 清单和低于 500 MiB 的 ancillary processes 保存于 `all-project-workers.json`。

| Role | PID | PSS MiB | Private Dirty MiB | Shared Dirty MiB |
|---|---:|---:|---:|---:|
| miku core | 63147 | 2097.3 | 2089.0 | 0.0 |
| miku gateway | 63450 | 210.0 | 209.4 | 0.0 |
| mai main core | 3425646 | 583.4 | 571.8 | 0.0 |
| mai main gateway | 3425847 | 106.1 | 105.6 | 0.0 |
| mai bottle core | 4082141 | 316.3 | 314.5 | 0.0 |
| mai bottle gateway | 4082283 | 46.8 | 46.6 | 0.0 |
| miku milky | 4169230 | 145.9 | 144.6 | 0.0 |

Core 的 parent master 仍有约 199 MiB（miku）/95 MiB（mai）的 VmSwap，不能因为其 resident 很低就认为完全不占资源；也不能把必要 supervisor 杀掉来回收这些页。四个重点进程的 shared PSS（Pss − Private_Clean − Private_Dirty）如下，远小于各自 private heap：

- PID 2270: shared PSS approximately 1.55 MiB.
- PID 63147: shared PSS approximately 5.63 MiB.
- PID 1580110: shared PSS approximately 0.62 MiB.
- PID 3425646: shared PSS approximately 8.00 MiB.

## 第二次全进程复查：Taiko Bot 越过 500 MiB

16:11 CST 左右重新扫描全部实际 Python 可执行文件，新增 PID 3265312（`/home/sigaer/taiko/bot.py`）达到 PSS 504.9 MiB，随后短窗 530.7 MiB；不能只保留最早四个超过阈值的进程。首次同帧 RSS 519.8 MiB、RssAnon 493.6 MiB、RssFile 26.2 MiB、VmSwap 21.3 MiB、26 threads；后续 smaps Pss_File 10.9 MiB、Private_Dirty 494.1 MiB、Shared_Dirty 0、shared PSS 约 7 MiB。原始证据 `python-high-refresh.json`、`taiko-high-files.json`。

- 进程树是 nb launcher 3265257 → bot 3265312，无业务子浏览器/worker；2026-09-17 22:32 启动，属于旧 root session。单实例 NoneBot/ASGI，不是 Hypercorn N-worker 复制；不改变 worker 数，也不 live 移动该进程。
- `taikob_v2_data.py::_snapshot` 保存一份全曲目 source snapshot，TTL 3600s；公共 song_data/rating JSON 磁盘分别 3.01/0.92 MiB，不能据此解释全部驻留。
- `taikob_v2.py::_calculate_v2_from_chart_cached` LRU 100,000 条；`dani_progress.py::_REQUIRED_RATE_PROFILE_CACHE` 达 200,000 条才整体清空，`_DYNAMIC_USER_SUMMARY_CACHE` 1024 条。`b30_render.py::_ICON_CACHE[(path,size)]` 没有显式上限；实际 name/size 组合是否有限、live cache 数量/字节未知。
- B30 按请求目标读取单用户 userdata；没有证据表明该路径一次载入全站所有用户。当前进程还加载共享 feature-handler 插件，不能把这个局部结论扩大为对全部插件的完整对象普查。
- native maps 包含 Pillow、NumPy、OpenCV、matplotlib、pandas；仍打开的 >1 MiB 文件只有 DDFont.ttf（7.02 MiB 磁盘），不等于全部曾加载文件。Python heap/native/image/allocator 的匿名页分摊仍为 unknown。
- 同 PID Phase 1 PSS 483.0 MiB → 本轮 504.9–530.7 MiB；业务渲染的短窗变化不足以证明持续 leak。miku 同次扫描也达到 2387.3 MiB，说明预算需用较长窗口而非单帧最低值。
- **OPTIMIZE PYTHON**：先对上述缓存记录 cache_info/decoded bytes，再实验较小、平滑逐条驱逐的预算和图片生命周期；不改计算公式、Dan strength 或 Annual 结果。可验证的规划目标 **0.02–0.08 GiB**，尚未实测节省；其余暂按必要或未知驻留保留。图片/native 依赖不支持整项目 Go/Rust 重写，不增加第二个语言 PoC。
