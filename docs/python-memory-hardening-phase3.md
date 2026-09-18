# Python Resident Memory Hardening — Phase 3

状态：**IN PROGRESS**。2026-09-18。严格按 pjskClient → miku-bot → taikobot → maibot 顺序；pjskClient 已通过 30 分钟观察并提交；miku-core 已通过 30 分钟观察；taikobot 已通过 30 分钟观察；maibot 已通过 30 分钟观察并提交。没有改 Annual 算法、generator/render concurrency（均仍为 1），没有触碰 BT-Task。

## Before

保留私有证据 `/var/log/python-memory-phase3/`（0700），包括 Phase 2 基线副本与本轮全进程快照。单位 MiB；PSS、RSS、Swap 独立列示，不将磁盘字节作为 RAM 节省。

| 服务 | 原 PID | PSS | RSS | VmSwap |
|---|---:|---:|---:|---:|
| pjskClient（重启前即时采样） | 1580110 | 1840.35 | 1844.41 | 207.86 |
| miku-bot（本轮初始采样） | 63147 | 2380.3 | 2433.2 | 344.4 |
| taikobot（本轮初始采样） | 3265312 | 527.8 | 542.8 | 18.4 |
| maibot（本轮初始采样） | 3425646 | 547.4 | 572.5 | 30.1 |

其他服务 rollout 前须补当时的稳定采样，以上跨时间采样不用于宣称最终总节省。

## Shared runtime

源码：`/home/sigaer/git/Sakura_bot/runtime_memory`，stdlib-only。pjsk 显式 pin `/opt/python-memory-runtime/1.0.1`；miku/taiko/mai pin `1.1.0`，不向全局 Python path 加整个源码仓库。

- byte/entry LRU，逐条淘汰；bounded object-size admission estimate；PIL eviction 只删除引用、不关闭调用方持有对象。
- 本机私有 telemetry：RSS/PSS/RssAnon/VmSwap/uptime，cache entries/estimated bytes/hit/miss/evictions/budgets；不输出 cache keys、用户数据、凭据；不增加公网 endpoint。
- 磁盘 JSON last-good：流式编码、fsync、atomic rename、current/previous；发布时 previous 也必须有效，避免保留损坏 current 而丢弃最后一个好版本。内存仅保留 bounded revision metadata。
- SQLite：只读 immutable，mmap=0，page cache=2 MiB；last row wins、首次 ID 顺序，另可按原始行序迭代（保留重复行）。
- 新 SQLite 版本由短命子进程创建，AS 768 MiB、CPU 60 秒、父进程 90 秒 deadline；跨服务 build flock、120 秒 lock deadline。与 Annual 队列独立。

缓存统计是预算估计，不是对象 census 或 PSS 归因。SQLite page-cache budget 也不是测得的实际驻留量。

## pjskClient

### Changes / rollout

独立仓库元数据位于 `.git_disabled`，保留该目录名；Git 操作显式指定 git-dir/work-tree。

- `sekaiapi.py` 去除 full-table deepcopy backup，保持 parse retry 和 fallback 返回独立对象；磁盘发布失败不使成功读取的查询失败。原有缺文件行为保持不变。
- `resourceBoxes` 改用共享 SQLite；进程只保持一个连接，源版本检查最多每 5 秒一次；更新失败继续用有效 last-good。
- `CARD_MASTER_INDEX` 保存 row 引用；card episode 两个索引分别从两次加载获取 row，仍有重复的可能，本轮未盲目迁移所有表。用户 runtime account state 未删减。
- 实际入口为 `screen 4064400.sekai` 下 `python3 main.py`；失败的 `pjskclient.service` 不是实际入口，未启动重复实例。
- 仅对已核对 identity 的 PID 1580110 发送 SIGINT，退出后启动 PID 3817885。screen 原有未执行输入令第一次启动命令未生效，清理输入后正常启动，无双实例。没有 broad kill。
- 重启前后本机 `/login` 均返回 HTTP 200；启动完成。最终 1.0.1 的稳定窗口见下文。

### Functional verification

- 现有测试：**103 PASS**；1 项现有 Starlette template 参数弃用 warning。
- Shared runtime focused tests：**8 PASS**；LRU/ownership、循环对象和大 set 的 bounded estimate、current/previous 损坏后重开、重复 ID/顺序、更新/损坏/缺源时 SQLite 离线恢复。
- 真实公开 resourceBoxes：**21,278 个唯一 ID 全量查询值一致**；**100 个代表性奖励文案及 placeholder 判定一致**。不读取/修改测试用户账号，不运行全用户 Annual corpus。
- 运行日志有一个账号的既有“本地 auth 缓存不存在”故障：历史错误中已有同账号同类记录；本轮未见新增此类受影响账号。其他账号有成功登录和业务完成记录。不能将这项既有 auth 故障归为 master-data 回归，也不宣称全部账号无故障。

### Isolated public-table result

| 路径 | 表加载后 PSS MiB | RSS MiB | 加载秒 | 全部 ID 查询秒 |
|---|---:|---:|---:|---:|
| JSON + deepcopy backup + index | 150.35 | 158.68 | 1.392 | 0.201 |
| SQLite 只读（包含首次建库） | 12.34 | 21.02 | 1.286 | 0.480 |

输出 SHA-256 完全相同。查询时间包括逐行 canonical encode/hash，不是纯 DB lookup 或用户请求 P95。单表隔离差额约 138 MiB，**不得当作服务最终节省或乘以所有 master 表数**。载入完整 main 后的峰值另有业务初始化，不混作表驻留量。

### Normal JSON read latency

同源公开 cards（1452 行）各连续读取 3 次，old/new 完整输出 SHA-256 相同。后两次 warm read 中位数：原路径 **1.320 s**，新路径 **0.341 s**。没有通过保留第二份 Python object tree 换取速度；去掉每次成功读取的 deepcopy 后，受控读取耗时更低。样本很小，不作为生产请求 P95。

last-good 指标的 hit/miss 指 fallback 查询；SQLite 指标的 hit/miss 指 ID 查询命中，不宣称测到了 SQLite 内部 page-cache hit ratio。原 JSON 正常路径也每次读源文件，并非从备用 object tree 返回。

### Fallback reader publication race follow-up

首轮观察约 26 分钟无新的运行异常。代码审查发现：fallback 若先读取 manifest，而两次发布随即回收其旧 generations，读取存在文件消失的窗口。未见线上复现；在签署前主动补上读取/发布共用锁，新增线程回归验证读取期间发布不会 GC 当前 generation。

共享 artifact 升至 1.0.1；focused 31 项复测 PASS。仅 pjskClient 再次 scoped restart，当前 PID 3831137，HTTP 200。第一轮约 5/15 分钟 PSS 为 1039.44/1039.36 MiB，仅作初步证据。以下表格采用最终 1.0.1 / PID 3831137 的新窗口；最终 30 分钟窗口已完成。

### After / observation

低开销 observer 每 30 秒采样，独立 development.slice、MemoryMax=128 MiB、CPUQuota=10%；写磁盘私有 JSONL。现有长期 monitor 继续运行。

| 时点 | PSS | RSS | VmSwap | 状态 |
|---|---:|---:|---:|---|
| 5 min（实际 uptime 303 s） | 1055.80 MiB | 1071.22 MiB | 0.00 MiB | HTTP 200；publication errors=0 |
| 15 min（实际 uptime 905 s） | 1055.81 MiB | 1071.22 MiB | 0.00 MiB | HTTP 200；publication errors=0 |
| 30 min（实际 uptime 1809 s） | 1075.23 MiB | 1090.42 MiB | 0.00 MiB | HTTP 200；publication errors=0 |

最终窗口 61 个样本，HTTP failures=0。30 分钟 PSS 与原进程重启前差额约 **765.1 MiB**。这是观察到的驻留差额，仍受原进程多日 uptime、账号恢复状态及 allocator 高水位影响；不将差额全部归为 cache bytes，也不把 Swap 下降叠加为 RAM 节省。完整长期归因待 24h+ 观察。

pjsk 阶段功能/短窗稳定性 **PASS**，继续现有长期 monitor。独立仓库提交并推送 `4c5a77ee07ae`；共享库 1.0.1 提交并推送 `b397ba749753`（9.61.5）。

## miku-bot

### Changes / rollout

- master 默认从无界变为 64 entries / 256 MiB estimated bytes，逐条 LRU；weight 为 bounded object estimate 与 4 × source bytes 的较大者。仍支持显式 0 禁用 admission；旧负数不再产生无界缓存。更新只失效同表旧 revision。
- `resourceBoxes` 复用 pjsk 的同源只读 SQLite，不保留完整过滤 JSON。仅缓存 card ID → box ID；保持 findcard **按原始行序首次匹配**，没有误用 SQLite 按 ID 的 last-row-wins 替代此业务语义。启动时预热小索引。
- 移除 findcard/gacha 二级表缓存，统一 primary cache。font/static/resource 保留既有 entry caps 64/32/96，增加 96/96/128 MiB byte bounds；guess base64 512 entries / 64 MiB。保留调用方独立 image copy，eviction 不 close 共享 image。
- 原生产 IO/render workers **8/2 保持不变**（Git 镜像原文件落后于生产，diff 中出现 16/8 → 8/2 是同步已存在配置）。移除正常 render 后全清图片缓存，交给 LRU；原 gc/malloc_trim 保留，不作为新内存收益的原因。
- RGB JPEG render 避免不必要的全图 RGB copy；需转换时只关闭派生 image。数据、字体和 JPEG quality 不变。
- 仅 core master 63105 及核对过的 9 个后代退出后启动新 master 3870884 / worker 3870979。gateway 63450、Milky 4169230 不重启；端口预期响应 core 404、gateway docs 200、Milky 404。线程池/启动环境原样继承，无重复实例。

### Functional verification / render PoC

- Shared runtime 1.1.0 **9 PASS**；miku cache、image、info、guess、CN runtime、suite rates、Milky update 相关 **41 PASS**。
- 公开 cards 1452 种的类型判定原/新 **0 差异**；source 版本更新、重复 resource ID/行序、byte eviction、image ownership 均有定向验证。
- 真实公开查卡渲染 1500 × 5640、JPEG 1,312,374 bytes，原/新/短命子进程的 SHA-256 全相同；10 次最终 PoC 渲染成功。私有结果在 `/var/log/python-memory-phase3/miku-render-poc/`，不含用户数据。
- 长寿命进程 5 次：首次 1.720 s，warm 0.563–0.650 s；最终 PSS 163.9 MiB、RSS 184.8 MiB、峰值 RSS 185.1 MiB。
- 短命子进程 5 次：父进程 PSS 约 8.45 MiB 稳定，每子进程峰值 RSS 约 184 MiB，但每次 wall 1.870–2.070 s。**不切换默认 production render**：相对 warm 约 0.6 s 有明显延迟代价。PoC 保留 operator-only、串行、child memory/CPU/timeout bounds。
- 原公开三表混合探针 load 后 PSS 291.2 MiB；新的同工作负载为 217.4 MiB（未含最终 RGB copy 优化），查询/渲染输出相同。该差额是隔离工作负载，不能与服务差额相加。混合探针首请求因 cards eviction + compact 初建较慢；上线使用启动预热，预算是否适合长期流量继续看 telemetry。
- rollout 后已观察到真实 primary cache hits 和公开表载入；原有复读插件 KeyError、picstatus 网络/统计错误、QQ event validation error 在历史日志也存在。另有既有聊天上游认证 401（历史同类记录 1722 条），与本轮缓存无关。没有据此宣称零错误，需区分既有插件问题与本轮 memory 代码异常。

### After / observation

重启前 30 个一分钟采样：core PSS median 2044.8 MiB（min 2008.7 / max 2189.3），RSS median 2165.1 MiB、VmSwap median 336.3 MiB；整个 core 树即时 PSS 2164.7 MiB。不可用 worker 数字代替完整树收益。

| 时点 | core PSS | core RSS | VmSwap |
|---|---:|---:|---:|
| 5 min（307 s） | 473.36 MiB | 507.86 MiB | 0 |
| 15 min（909 s） | 677.44 MiB | 718.58 MiB | 0 |
| 30 min（1813 s） | 768.16 MiB | 812.80 MiB | 0 |

窗口健康采样全部符合预期，gateway healthz=200/ok、118 个 OneBot 连接，原 gateway/Milky PID 保持不变；新增 RuntimeError 的相同签名在历史日志已有。没有 memory runtime/master/image cache 代码异常。

30 分钟 cache：master 16 表 / 196.86 MiB estimate、903 hit / 16 miss（98.3%）；font 18 / 89.67 MiB、270/21（92.8%）、eviction 1；static 5 / 32.85 MiB、16/6；resource 84 / 127.97 MiB、301/129（70.0%）、eviction 25。初始冷填充计入 miss，不能把这些累计值与不存在的旧生产 hit ratio 比较。所有缓存符合 entry/byte cap，真实流量已验证逐项淘汰。

core worker 与重启前 30 分钟 median 差额约 1276.6 MiB，但 master/browser 同时重新预热，**不能把 worker 差额当完整服务净收益**。完整树对比另外保存于 `miku-core-tree-before.json` / `long-observation.jsonl`；最终采用同范围的树 PSS，继续 24h 观察。短窗功能/稳定性 PASS。已提交并推送 `1491c12`（9.61.6）。完整 core 树约 30 分钟 PSS 1231.3 MiB，对比原 2164.7 MiB，观察差额约 933.4 MiB；不把 worker 和树差额重复相加。 **后续约 50 分钟已观察到 worker PSS 回升至约 1.48 GiB**，master estimate 244 MiB、font 93 MiB、resource 125 MiB 仍均合预算，原有 render-trim 也有执行。完整树当时约 1.92 GiB，故 30 分钟差额不可签作持续节省。需 24h 曲线；剩余 heap/native/业务引用未分摊，不清缓存或盲目减 worker。

## taikobot

### Changes / verification

保留 V2 100,000 / Dan required-rate 200,000 / dynamic summary 1,024 entry ceilings，新增 64 / 64 / 16 MiB estimated byte budgets。required-rate 和 summary 从满载全清改逐项 LRU。B30 icon 新增 128 entries / 16 MiB decoded budget；只关闭临时转换图，eviction 不 close 调用方持有的图。原 chart snapshot、key/value、公式、userdata 读取均保持。

- 三个代表账号 27 项输出 hash 全相同：V2/六维、Dan、推荐、两次 B30；未运行全用户 corpus。
- focused regressions **118 PASS，1 deselected**；生产 `.venv` 同依赖环境补跑亦 118 PASS（仅复用系统 pytest runner，未安装生产依赖）（现有 300 账号批测按本轮范围排除）。
- V2 uncached cost 原/新约 20.4/20.9 μs；代表工作集 2,801 entries，重复查询原/新均 hit 2,813 / miss 2,801。新 byte accounting 有 CPU 成本：冷计算 0.057–0.228 s，warm 0.017–0.033 s；原 warm 0.013–0.026 s，绝对增加为毫秒级。
- 初始 B30 两次有 host 耗时波动，追加原/新交替对照六次：PNG hash 全同（1080×3030），原 median 7.54 s / 新 7.35 s；新有一次 8.62 s，不能把单次抖动当固定提速或退化。
- 小工作集隔离 probe 的 PSS 原 309.76 / 新 294.62 MiB；包含 native 分配波动，**不把这 15 MiB 计为已证明的 cache 节省**。主要收益先是限制长期增长。

### Rollout / observation

仅核对的 `taiko` screen 进程组 3265257/3265312 收到 SIGINT。旧进程退出后，跨会话 TIOCGPGRP 返回不适用；替代启动尚未发生。改以 `/proc/<shell>/stat` 核对前台 shell，再在原 screen 启动 `nb run`。新 master 3890004 / worker 3890046，startup complete、adapter connected、原端口 37564 监听，docs 404 为应用预期。没有 broad kill / 双实例。

短窗功能/稳定性 PASS。30 min（1826 s）PSS/RSS 278.35/305.39 MiB，Swap=0，所有健康采样正常；临时 screen 日志已关闭，持续使用本机 cache/host telemetry。5 min（295 s）PSS/RSS 254.40/281.31 MiB；15 min（895 s）261.50/288.40 MiB，Swap 均为 0。真实 V2/B30 请求已填充缓存：30 分钟 V2 entries 1351 / estimate 2.32 MiB / hit 10815 / miss 1351（88.9%）；Dan rate 378 / 0.22 MiB / 3091/382（89.0%）；summary 2 / 4134 bytes，icons 7 / 10276 bytes。未达到大预算，不虚报自然流量已验证满载淘汰；边界由 focused tests 覆盖。QQ adapter 观察到 `msg_elements.0.message_type/msg_idx` 上游事件字段校验异常，调用链未涉及 cache；相同字段在 miku 重启前日志的 Pydantic 1 箭头格式中各有 242 条记录。taiko 原 screen 未持久化旧日志，不能声称已取得 taiko 的精确历史错误率。另有一次 NoneBot command-prefix 消息索引 IndexError，栈在 framework adapter/message，未涉及本轮 memory 代码；保留为非本轮归因的运行异常，不隐藏成零错误。

taiko 已提交并推送 `ac8c96d`（9.61.7）。完整树即时 before PSS 610.90 MiB，约 30 分钟 after 349.33 MiB；后续继续预热，不将短窗差额签为持续节省。

## maibot

### Before / verification

修改前：生产 `libraries/image.py` 字体 cache maxsize=None；公开查询 3 首 × 3 次、猜歌 lite/FFT、牌子 × 2、文字 × 3 共 16 个 render，实际用 10 个 font identity，font hit 357 / miss 10，static bytes hit 39 / miss 16。query 约 0.415–0.523 s，plate 0.654–0.811 s，guess 0.022–0.026 s；隔离 render 后 PSS 42.48 MiB、峰值 RSS 106.11 MiB。

5 个既有 unittest 模块 **19 PASS**。直接 pytest package discovery 会导入完整 NoneBot 插件并因未初始化 driver 失败；改用这些测试原有 unittest 入口通过，未为测试启动生产 bot。

`ScoreBaseImage` 为固定 18 张预加载素材，按实际 resize 后 geometry 估算 decoded bytes 10.65 MiB（非测得 PSS），不是服务 600 MiB 的解释。保持它与 MaiMusic 模型；仅补字体/压缩静态字节预算及辅助图片生命周期。

### Changes / rollout

- font 64 entries / 192 MiB estimated budget；保留生产原有环境变量配置支持（Git 镜像此前落后）；static compressed bytes 128 entries / 64 MiB。非正数/非法环境值回到有界默认值，不再产生无界 cache。font estimate 不是测得的 FreeType native allocations。
- 缓存淘汰仅删除引用；临时 RGB、圆角 mask、text image 使用 `contextlib.closing` 显式释放。Pillow 的普通 image context manager 不保证销毁像素数据，新 ownership 测试发现并纠正了这一点。OneBot 必需的 base64 协议不变，通过 buffer view 避免额外完整 bytes copy。
- 新增 7 项 cache/ownership 测试，连同既有 19 项，共 **26 PASS**。最终 16 次公开 render 的 PNG hash/尺寸 **0 差异**；query median 原/新 0.4770/0.4731 s，plate 0.7324/0.6578 s，text 0.0087/0.0089 s，未见持续延迟退化。隔离工作负载大小不足以证明长期节省。
- 仅 `systemctl restart maibot-main.service`：使用原 supervisor 管理的 core/gateway 生命周期，core=1、render=4 保持。bottle 独立 PID 4082141 未重启。新 main/core/gateway PID 3909459/3909538/3909728。
- 重启前 core 即时 PSS/RSS/Swap 601.21/633.59/30.04 MiB。标准 graceful stop 使用服务原有超时，随后正常启动。core `/docs` 404 为既有路由预期；gateway 正确健康路径 `/gateway/health` 返回 200/ok，状态记录 53 slots。最初 observer 误用 `/healthz` 收到路由 404，已修正 observer；不是业务故障。
- 5 min（306 s）PSS/RSS 172.43/214.44 MiB；15 min（906 s）216.57/269.54 MiB，Swap 均为 0，gateway 200、peers alive。30 min（1807 s）PSS/RSS 242.71/270.43 MiB、Swap 0。短窗功能/稳定性 PASS。字体 20 项 / estimate 78.92 MiB / hit 1337 / miss 20（98.5%）；static 66 项 / 2.73 MiB / 782/66（92.2%）。自然流量未触发淘汰，边界由 focused tests 覆盖。服务已提交并推送 `696c000`（9.61.8）。
- 窗口发现一次 `mai_score.py:344` 的 `NoneType.charts`：按 ID 查询未命中后未做空值保护，尚未进入 image helper。重启前日志没有相同签名，不能声称其历史已复现；未改动的查询代码足以定位为输入边界缺陷，保留记录，未将其掩盖为零错误或归因于 font cache。另有一次 QQ 发图 `ActionFailed` / code 40054005，历史相同 code 有 14 处，栈在官方 API response；不是本轮图片编码异常。

## Cross-service duplication / savings

已确认 `jp:resourceBoxes` 的实际源为 `/home/sigaer/sekai/masterdata/resourceBoxes.json`；manifest 的 dev/inode/size/mtime revision 与源一致。pjsk 打开共享 SQLite generation 的一个 FD；miku 按原始行序扫描后关闭 DB，只持有约 145,683 estimated bytes 的 card ID → box ID 索引。两者复用同一发布基础设施和物理 DB，不再各自保留完整 resourceBoxes Python tree。DB 约 25 MB 是磁盘大小，不计 RAM 收益。

pjsk card episode 的两个索引仍可能引用分别加载的 row；未取得独立 live object census，故不量化重复。taiko/mai 为不同游戏目录，未发现证据证明同一数百 MiB 公共表跨服务长期驻留；这不等于所有重复均已排除。当前无证据支持新建 Go read service，继续优先共享 SQLite。最终 confirmed resident reduction 等待完整稳定窗口。

## Remaining unknown / classification

账号 runtime state、Python heap、native image buffers、allocator 高水位尚未完整分摊。只读 smaps 分类已保存：`[heap]` 与 anonymous mmap 不能分别等同于 Python/native；例如当前 pjsk 主要为 anonymous 页，miku 同时有匿名页与 heap 驻留。没有运行 intrusive heap dump，也没有把 cache 估算与这些页强行一一对应。暂定分类（未替代 24h Gate）：pjskClient / taikobot / maibot 为 OPTIMIZED PYTHON；miku 为 FURTHER PYTHON WORK，原因是 native/heap/业务引用导致的后续 PSS 回升仍待分摊。无整服务 Go/Rust rewrite 或新增 shared Go data service 的证据。BT-Task KEEP PYTHON。

## Production capacity review

30 分钟正常基线已完成：61 samples / 1799.60 s，observer 正常退出。开始前核对全部 root PID/start identity 且 uptime ≥30 min。私有证据 `normal-baseline.jsonl` / `normal-baseline-summary.json`；24h+ 观察仍未到时。释放容量优先作为安全余量，不自动提高 Annual concurrency。本报告尚不能签署 `PYTHON MEMORY HARDENING PHASE 3 COMPLETE`。

### Long observation execution

`python-memory-phase3-long-observe-v2.service` 每 60 秒记录四服务实际进程树、cache metrics 与 host PSI，独立 128 MiB observer 域，48 小时有限窗口；不写 tmpfs。最终 maibot rollout 于 2026-09-18 20:37:42 +08:00 完成，24h 验收不得早于次日同一时刻。`python-memory-phase3-24h-summary.timer` 已安排次日生成私有 `long-observation-summary.json`；只输出证据、缺口、预算违规及 identity 变化，**不会自动签署 PASS**。报告需结合业务日志/延迟复核。

### Baseline scope caveat

正常业务窗口前段发现 extensionHost 合计约 6–7 GiB PSS（旧 Phase 2 median 约 2.32 GiB），部分仍属于旧无限额 user session。开发负载会影响 host MemAvailable、PSI 与热页换入，不能把所有 host 差额归因于 Python 补丁，也不能称为纯 idle production。没有关闭用户正在使用的编辑器、没有变更其 cgroup 或启动额外压力测试。

最终 maibot rollout 后约 35 分钟时（miku 已更早上线），miku 完整树已约 2.1 GiB，接近原 2.16 GiB；master cache 真实 eviction 20、font 57、resource 1470，各预算仍有效。该持续观测进一步否定把重启后 30 分钟的约 933 MiB 差额签成长期节省。

## Completed normal-traffic baseline / provisional savings

窗口：2026-09-18 21:07:53–21:37:52 +08:00。同 Phase 2 的分组排除口径；现有编辑器仍运行，**不是无开发负载的严格对照实验**。

| 指标（GiB） | Phase 2 median | 本窗口 min / median / max |
|---|---:|---:|
| Business PSS | 10.542 | 9.351 / 9.471 / 10.126 |
| Business RSS | 11.014 | 9.865 / 9.986 / 10.643 |
| Business VmSwap | 6.919 | 6.053 / 6.132 / 6.135 |
| Host MemAvailable | 13.092 | 8.900 / 12.717 / 12.823 |
| Host swap used | 10.498 | 10.133 / 10.275 / 10.279 |
| Taiko/Bot Python PSS | 7.781 | 6.580 / 6.641 / 7.053 |

业务 PSS median **观察下降 1.071 GiB**；Bot Python 分组下降约 1.141 GiB。不能把后者与前者相加。Viewer、MySQL、编辑器和其他业务亦有变化，不能声称整机差额全部来自本轮代码。

同一个最终正常窗口，四服务**完整进程树** PSS：

| 服务 | rollout 前树 PSS MiB（单点） | 最终窗口 median MiB | 观察差额 MiB |
|---|---:|---:|---:|
| pjskClient | 1840.38 | 1265.78 | 574.60 |
| miku-core（含其 render/browser 子树，不含未重启 gateway/Milky） | 2164.65 | 2077.45 | 87.20 |
| taikobot（含 nb parent） | 610.90 | 530.88 | 80.02 |
| maibot-main（含 core/gateway，独立 bottle 不计） | 682.34 | 450.34 | 232.00 |

合计观察差额 **973.82 MiB（0.951 GiB）**。before 单点、after 窗口 median、旧 uptime/Swap 与新进程预热不同；**不是已确认的长期因果净收益**。pjsk 的隔离 resourceBoxes 对照约 138 MiB 差额另有相同查询 hash 支持，但不得再叠加到服务差额。当前不能宣称达成 2–4 GiB 持续节省；final confirmed resident reduction 仍待 24h+。

压力并未随业务 PSS 等比例改善：memory PSI some/full 的 avg10 峰值 **3.18% / 2.22%**，整窗 stall fraction **0.128% / 0.096%**；IO PSI 峰值 **3.03% / 2.36%**，stall fraction **0.341% / 0.296%**。实际 swap in/out **24.26 / 170.42 MiB**。末段趋稳，但不能抹去前段压力或把高 swap 一概解释为无活动冷页。同期 extensionHost PSS max 6.574 GiB、median 3.219 GiB（旧 median 2.322 GiB）；旧未隔离会话仍是容量风险，未擅自迁移/关闭。

最终只读 HTTP 检查：pjsk login 200；miku core/taiko/mai core 的既有 docs 路由 404；miku gateway healthz 与 mai gateway health 均 200；Milky 既有 docs 404。状态均与实际路由预期一致，404 不作为业务生成失败。所有阶段有对应真实运行 cache activity；不将 HTTP 存活替代业务输出验证。最终 maibot rollout 后内核新 OOM markers=0，maibot NRestarts=0。

**当前 Gate：四服务 rollout + focused/output regression + 5/15/30 min + normal 30 min 已完成；24h+ REVIEW PENDING。不得签署 `PYTHON MEMORY HARDENING PHASE 3 COMPLETE`。** Annual generator/render concurrency 继续各 1，不因本轮驻留下降提高；容量优先留作余量。无需新建 Go 数据服务，miku 剩余 heap/native/业务引用归因继续观察。
