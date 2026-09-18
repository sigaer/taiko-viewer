# Memory Hardening Phase 2 — Capacity blockers

2026-09-18。生产基线见 `server-memory-baseline.md`；Python 逐服务分摊、数据表示实测及唯一 Go PoC 见 `python-resident-memory-triage.md`。不改 Annual generator、schema、strength、FinalTitle、strongDan 或 `annual-observation-v4.5.0`。

**验收状态：进行中，暂不解除 NOT YET SAFE FOR WAVE 2。** 下方已经完成的证据与待完成的部署/迁移后测量分开记录；没有把设计当作生产已上线。

## Admission implementation

- 所有 `runAnnualSummaryCli` 调用，包括 normal build/admin preview，进入同一个 generator ledger；rating CLI 也经过该 gate。全主机最多 **1** 个 Python worker；20 个排队 unique tickets，排队 TTL **10 min**。DB queue timeout 每 10 秒条件更新，仅过期尚未开始的 queued jobs，不覆盖已经 running 的任务；restart 保留 started_at 区分已运行任务。原 build 240s / ratings 600s runtime 边界不增加。
- `/var/lib/taiko/annual-admission` 下原子 ledger 更新，由内核 flock 保护，与 Node 进程/版本缓存目录无关。适用于当前**单主机、多 Node 进程**；不是多主机分布式调度器。
- 同用户/binding/version 先产品 single-flight，再占队列容量；DB parameters 保存 key/ticket。DB 插入失败撤回自身 reservation，不取消已经加入的 admin 请求。普通队列仍顺序处理 enrichment，避免同时积压许多大 Node 对象。
- 未到本地 dispatcher 的 reservation 计入队列上限，但不占运行 slot；ready callers 可前进，因此尚未启动的本地队列不会阻塞可运行的管理员或独立 ratings refresh。普通 build 的 enrichment 仍读取已有排名 cache，不改其刷新/数据语义。
- `queued → running` DB 更新和 `annual_build_start` 在取得真实 slot 时才发生。单独 operational telemetry 区分 queued/running/completed/failed/queue timeout/run timeout/rejected；不记录 raw token、invite code 或用户内容。
- Renderer 共用一份 gate：canonical save/community/internal 和 legacy，最多 **1** 个 browser，queue cap **8**。同 summary/locale/renderer revision/fingerprint 的实际 canonical path 复用结果；legacy 包含自己的 share/poster identity，避免混用不同 QR 内容。
- Render token 在获得 slot 后生成，不会在排队期间过期。canonical 尺寸、布局与 `share-card-v2-assets` 不变。截图到文件并原子发布，忽略 screenshot 返回 Buffer。
- Node 崩溃后内核释放 metadata/product locks；worker 独立硬期限仍有效，运行 lease 比 cgroup teardown 更长，不因父 Node 退出而立即启动重叠 worker。失败不触发自动重试循环。
- 增加 headroom guard：MemAvailable >= RAM 的 30% + 3 GiB、memory PSI full avg10 <2%；active bounded release build 时也排队。不足时不 fork，原 queue TTL 继续计算。

## Real renderer profile and isolation

以当前生产已有 summary 走真实 internal share-card 页面，fresh browser/private output；没有删除生产 cache，没有写 production DB。首次探针在现有 QA 2/3 GiB 上限内观察，**最终 renderer 上限根据真实页面实测另定**。

| 指标 | 实测 |
|---|---:|
| cold render duration | 2.631 s |
| process-tree peak PSS | 483,404 KiB / 472.1 MiB |
| process-tree peak RSS | 1,000,140 KiB / 976.7 MiB |
| cgroup current peak | 323,842,048 B / 308.8 MiB |
| swap peak | 0 |
| tasks peak | 67 |
| assets | 4 images, 0 broken, fonts loaded |
| PNG | 1080 × 1648 |

PSS/RSS/cgroup 不同口径：共享库 RSS 重复计算；共享页的 cgroup charge 不一定属于本次 unit，因此不能把它们相加。200ms 采样仍可能漏掉更短峰值。

最终限制：renderer **High 768 MiB / Max 1 GiB / SwapMax 128 MiB / TasksMax 256 / CPU 200%**。至多65s unit hard deadline 包含 renderer 的原 60s 整体截止，TimeoutStop 5s，KillMode control-group，OOMPolicy stop。生产不允许失败后回退到无界 Chromium。

Generator 使用同类隔离：High 1 GiB / Max 1.5 GiB / SwapMax 128 MiB / TasksMax 256。参照上一轮 large cold build cgroup peak 488.55 MiB；本轮还需在最终配置下复测。两类 worker 分开故障域，最多允许 1 + 1。

新 launcher 发布前隔离执行：small generator SUCCESS、v4.5.0、92 events、2.117s；真实 renderer SUCCESS、1080×1648、2.320s。均未写 production summary/job。最终生产 smoke/组合峰值见后续记录。

## Tests

- `npm run test:annual`：PASS（contract checker + existing Annual suites）。
- `annualAdmission.test.mjs`：6 tests PASS；独立 Node processes 验证 same-card one execution、不同 key 无重叠；20/8 cap、dedup-before-cap、TTL、shared failure、pressure wait、unstarted reservation 不阻塞、caller crash flock recovery、normal reservation rollback 不取消 joined admin。
- `annualAdmissionDb.integration.test.mjs`：真实 MySQL `_test` schema/FK 下验证队列 TTL、stale SELECT 后 running 竞态不会被覆盖；只读核实数据库名后，全部 fixture 在事务内回滚。
- 没有建立新测试框架，没有重跑 full corpus，没有修改 Dan/title fixture/model。
- 一个测试启动问题是 systemd 默认 PATH 选择旧 Node；runner 已显式传递当前 PATH。不是生产业务 failure。

## tmpfs migration

已完成：13 个旧 heaps，原合计 11,443,419,461 B（10.658 GiB）。目标 `/var/lib/taiko/heap-archive/2026-09-18`，0700、disk-backed；文件 0600，保留 mtime。单文件串行、1 MiB chunks、streaming SHA-256、目标二次 hash、source inode/size/mtime 和 open FD/maps 复核后才 unlink 源文件。每个完成文件的 hash/结果只写私有 migration JSONL。

第一次复制触发 256 MiB MemoryHigh 的文件页缓存回收，暂停并删除**未校验的目标 partial**，保留源。修正为每 16 MiB fdatasync + 对已写文件范围 POSIX_FADV_DONTNEED；随后 high/max/oom 不再增长。旧 tmpfs 的冷 swap 页回读仍产生临时 memory/IO PSI，不能宣称过程“零压力”。未 swapoff、未 drop_caches。迁移过程中 Viewer HTTP 200（约42ms）、NRestarts=0，未出现新 kernel OOM。

13/13 SHA-256 校验并迁移完成，合计10.658 GiB。迁移后 `/tmp` 使用3.774 GiB，swap10.474 GiB，MemAvailable12.899 GiB；原目录已为空，再切换为指向磁盘 `/var/lib/taiko/heap-active` 的 symlink。当前future files=0，retention service成功。历史 archive 不套未来2 GiB配额，以免删除事故证据。没有停止活跃编辑器制造更低baseline。

未来目录 `/var/lib/taiko/heap-active`，0700；已安装 `taiko-heap-budget.timer`，每分钟清理**closed** heap 文件到 <=2 files / <=2 GiB / <=7 days。open writer 超额会报 budget violation，不偷删打开文件；QA/dev 另有 2 GiB per-file hard limit。自动 dump 不应默认开启。详见 guidelines：这是 retention enforcement，不能称作目录硬 quota。

## Development fault domain

已安装新 `development.slice`：High 6 / Max 8 GiB、SwapMax 1 GiB、TasksMax 768。`development-qa.slice` 2/3 GiB 和 `development-build.slice` 4/5 GiB 是它的子域，避免三个根 slice 相加突破 aggregate。

新 dev/QA/build wrappers 共享维护锁；多进程开发验证（临时 dev server + browser）必须属于同一有界任务，结束全部关闭。新 dev 单任务2/3 GiB，runtime4h；QA15min；标准 deploy 最长30min。Build wrapper保留原deploy script，不改其flock/NODE_OPTIONS/发布逻辑；开始前还检查 25% RAM reserve + 5 GiB headroom。

**没有 live 迁移/停止现有 VS Code/Codex/root session；production.slice 仍是后续服务维护设计。** 6/8 GiB 不是对所有历史编辑器工作流已完成峰值认证，现有 root resident 继续计入 admin reserve。真正 Nuxt release-build 峰值需要本次标准发布记录补充。迁移后 MemAvailable 约12.9 GiB，原6 GiB构建上限不满足25% reserve，因此在首次发布前将构建上限**收紧**到High4/Max5 GiB（既有Node heap4 GiB保持）；不是降低reserve或增大限制。构建前还确认没有Annual worker在运行。

monitor 已覆盖新 slice/worker，磁盘日志原 rotation 不变。生产/MySQL 没有添加盲目的低 MemoryMax。

## Pending final acceptance

1. Heap migration/路径治理：PASS。
2. 标准部署 0.68.11；不是手工 build/output replacement。
3. 迁移和发布后 10 min baseline；逐次 cold Annual / cold renderer / sequential / permitted 1+1；记录 MemAvailable/PSS/swap/PSI/cgroup events。
4. 按实际峰值重算 reserve，给出最终容量 Gate。Python 完整服务重写不是 Gate prerequisite。
