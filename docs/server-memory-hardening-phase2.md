# Memory Hardening Phase 2 — Capacity blockers

2026-09-18。生产基线见 `server-memory-baseline.md`；Python 逐服务分摊、数据表示实测及唯一 Go PoC 见 `python-resident-memory-triage.md`。不改 Annual generator、schema、strength、FinalTitle、strongDan 或 `annual-observation-v4.5.0`。

**最终容量状态：MEMORY BASELINE ESTABLISHED / SAFE FOR WAVE 2（memory/capacity gate）。** Viewer0.68.11已标准部署；迁移、62样本基线、真实冷任务/1+1和两Node单卡复测完成，详见下方实际结果。独立移动端产品Gate不自动改变。

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

Generator 使用同类隔离：High 1 GiB / Max 1.5 GiB / SwapMax 128 MiB / TasksMax 256。参照上一轮 large cold build cgroup peak 488.55 MiB；本轮已在最终配置下复测，见后文。两类 worker 分开故障域，最多允许 1 + 1。

新 launcher 发布前隔离执行：small generator SUCCESS、v4.5.0、92 events、2.117s；真实 renderer SUCCESS、1080×1648、2.320s。均未写 production summary/job。部署后生产页面/组合峰值见后文。

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

**没有 live 迁移/停止现有 VS Code/Codex/root session；production.slice 仍是后续服务维护设计。** 6/8 GiB 不是对所有历史编辑器工作流已完成峰值认证，现有 root resident 继续计入 admin reserve。真正 Nuxt release-build 峰值已由本次标准发布记录补充。迁移后 MemAvailable 约12.9 GiB，原6 GiB构建上限不满足25% reserve，因此在首次发布前将构建上限**收紧**到High4/Max5 GiB（既有Node heap4 GiB保持）；不是降低reserve或增大限制。构建前还确认没有Annual worker在运行。

monitor 已覆盖新 slice/worker，磁盘日志原 rotation 不变。生产/MySQL 没有添加盲目的低 MemoryMax。

## Production release and completed capacity retest

**Viewer 0.68.11**, source/release commit `8356dcd`。2026-09-18 16:27 CST 标准 `scripts/deploy_forum_web.sh "<HEAD subject>"` 完成，经 `run_build.sh` 隔离调用；未修改标准部署脚本、未手工替换 output。首页版本与 HTTP 200 已核实，service active、NRestarts=0。可选百度推送返回日配额耗尽，不影响部署。

实际 Nuxt release workflow 179.3s，build cgroup sampled peak **4095.98 MiB**，最小 MemAvailable **9.058 GiB**。High=4 GiB 引发回收（父级统计含子域 high events=943），Max/OOM/oom_kill=0；最大 cgroup swap16.17 MiB。该峰值是在 High 限制下测得，不声称是无限制需求峰值。4/5 GiB 的发布预算已实际走通；development aggregate 6/8 GiB 未被本次工作流突破。

### Post-migration baseline

**16:27:50 → 16:38:35 CST，645.45s，62 samples**（61个10秒采样，另补结束确认）。无本轮 QA/cold job/build；保留真实业务、原有 editor/root sessions。沿用 Phase 1 的互斥归组，不把编辑器计入 business subtotal；未证实可停的 Other 保守计入业务。

| 指标 GiB | min | median | max |
|---|---:|---:|---:|
| Production PSS | 10.480 | 10.542 | 10.880 |
| Production RSS | 10.955 | 11.013 | 11.380 |
| Production VmSwap | 6.918 | 6.919 | 6.920 |
| Host swap | 10.496 | 10.498 | 10.498 |
| MemAvailable | 12.780 | 13.092 | 13.165 |
| VS Code + extensionHost + Codex PSS | 4.118 | 4.127 | 4.144 |

- 整个窗口 memory PSI full **0.0021%**，IO PSI full **0.1169%**；memory full avg10 最大0.02%，无持续压力。
- swap in **0.738 MiB**、out **0.145 MiB**，最大换入20.21 KiB/s。10.5 GiB swap以历史冷页为主，不是当前 thrashing。
- Phase 1 business PSS median10.819/max11.361 GiB，本次10.542/10.880 GiB：业务驻留未恶化。Host MemAvailable 比旧窗口低，编辑器驻留已约4.13 GiB（此前约2.8 GiB）；没有把两次不同开发负载直接比较为业务回归。
- heap迁移前 `/tmp`14.432 GiB、swap21.025 GiB；迁移后 `/tmp`3.774 GiB、swap10.474 GiB。回收主要反映在 swap，不能宣称释放了10.66 GiB resident RAM。

### Cold runtime and renderer

在已发布源码对应的 runtime 上调用同一 admission/launcher，使用真实 userdata、生产 internal render 页面及合法 render token；结果/normalized cache 写到私有独立目录，**未写生产 summary/job/cache**。每组 fresh application cache/browser；没有清 OS page cache，所以“cold”不是强造冷磁盘。采样200ms，分别记录整个 worker tree RSS/PSS、cgroup current/swap/tasks/limits/events、host MemAvailable/PSI。

| 场景 | 任务耗时 | worker peak PSS MiB | worker peak cgroup current MiB | host最低可用 GiB |
|---|---|---:|---:|---:|
| large Annual（91899919） | 15.107s | 314.16 | 369.58 | 12.694 |
| cold canonical renderer | 2.495s | 446.34 | 296.41 | 12.761 |
| Annual → renderer | 14.576s + 2.181s | 456.92（同一时刻合计峰值） | 356.29 | 12.698 |
| Annual + renderer，允许的1+1 | 15.384s / 2.366s | **596.08**（同一时刻合计峰值） | **407.23** | **12.604** |
| 两个独立Node请求同一张card | 两个调用均成功 | 439.55 | 277.74 | 12.688 |

- 单独 large worker RSS329.85 MiB、8 tasks；renderer RSS956.92 MiB、66 tasks。RSS含共享库重复页，不能与 cgroup Max直接等同。
- 所有测得 worker **swap=0、high/max/oom/oom_kill=0**，实际 cgroup limits 与发布配置一致；每组结束 `remaining_units=[]`。生产其他业务 browser 保留，未 broad pkill。
- 1+1真实时间重叠约2秒；这次实际重叠峰值不代表两类最大峰值必然同一时刻出现，预算仍采用硬上限合计。
- 三次 large CLI 均2672 events、schema通过、`annual-observation-v4.5.0`。15.1–15.4s 与 Phase 1 large15.392s 接近，无明显生成性能回归；三个同账号样本不是全用户 P50/P95。
- 每次 PNG **1080×1648**、4 images、broken=0、fonts=loaded；人工查看四宫格、文字、统计与原样图结构一致。保存 streamed SHA-256/size作artifact标识，没有用二进制 deep assertion，也没有声称不同时间截图逐字节相同。
- same-card 两个**独立 Node processes**只产生 **1个 renderer unit / 1次 running / 1次 capture**，两个请求共享结果。跨进程不同key串行由专门进程测试覆盖；没有20用户破坏性压测。
- 各测试短窗口 memory full stall约0.006–1.32%，均非持续；结束avg10=0。13:00以来 kernel OOM matches=0，生产 queue-expiry/dispatch/admission error新日志=0。
- 额外真实2s hard-timeout fixture在2.188s结束，拥有的cgroup与子树消失。不能用只杀systemd-run客户端的方式提前释放slot。

**认证范围说明**：历史 owner cookie 只读探测返回401，未把它当成generator失败，也没有重造登录会话。因此本轮没有声称完成 owner-authenticated Save POST E2E；上述实际capture通过生产合法internal render路径完成。API auth/entitlement代码未改动，容量Gate依据真实worker、生产页面、已部署调用链和跨进程测试；移动端/认证全链路验收仍属各自产品Gate。

## Launch capacity model

| 项目 | GiB | 依据 |
|---|---:|---|
| Physical RAM | 30.609 | /proc/meminfo |
| Production budget | 12.000 | 本次max10.880，含约1.12 GiB业务波动余量 |
| Kernel / page-cache reserve | 2.000 | 独立预留，PSS不含此项 |
| Existing editors / admin reserve | 5.000 | 实测max4.144，保留活跃旧session |
| Minimum safety reserve（25%） | 7.652 | 不用swap增加RAM预算 |
| Available for Annual | **3.957** | 上述扣除后 |

Annual预算：generator Max1.5 GiB + renderer Max1 GiB + Node/envelope0.5 GiB = **3 GiB**；再留0.957 GiB未分配。加上最低安全预留，约 **8.609 GiB / 28.1% RAM** 不分配给业务。Node0.5 GiB是规划余量，不是对整个旧Viewer服务新设的硬限制；整个Viewer仍计入12 GiB业务预算，保守多预留任务临时增长。

**MAX_CONCURRENT_ANNUAL_BUILDS=1；MAX_CONCURRENT_ANNUAL_RENDERS=1。** 按保守硬预算 `floor((3.957 - 1 renderer - 0.5 Node) / 1.5 generator) = 1`。不按三次低实测峰值推导出8个worker。真正运行前仍要求 MemAvailable≥30% RAM+3 GiB（约12.183 GiB）、memory full avg10<2%；有压力就排队，active bounded build期间不新开Annual worker。

规划取 **20s/生成槽**（实测最慢15.384s，额外留处理余量），headroom充足、无其他队列时：

| 同时点击 Annual | running | queued | 平均启动等待 | 最后一人启动等待 |
|---:|---:|---:|---:|---:|
| 5 | 1 | 4 | ~40s | ~80s |
| 10 | 1 | 9 | ~90s | ~180s |
| 20 | 1 | 19 | ~190s | ~380s |

这不是端到端SLA：enrichment、用户数据规模、生产业务I/O与headroom可能增加等待。queue20/TTL600s，超额明确reject，等待超时明确timeout；慢任务不能靠增加Python进程消化。Renderer独立queue8，正常单卡约2–3s，超过容量同样拒绝。公开1000用户只改变排队/缓存/磁盘规模，不允许1000个worker；需用真实到达率观察后再调整，**不因此现在提高并发**。

## Final capacity gate

| Gate | 结果 |
|---|---|
| Annual generator host-global1，含normal/admin/ratings | PASS：唯一launcher与持久ledger，跨进程测试 |
| Same binding/version dedup before queue capacity | PASS：产品lock + persisted ticket，DB/rollback竞态测试 |
| Canonical/legacy renderer host-global1 | PASS：共用gate/launcher，无server-side额外Chromium入口 |
| Same-card single-flight | PASS：两Node真实请求，仅一个renderer |
| Renderer独立cgroup | PASS：真实current/PSS/limits/tasks、hard-timeout、退出清理 |
| tmpfs heap governance | PASS：13/13校验迁移，future路径磁盘化与retention guard；不是filesystem硬quota |
| New dev/QA/build bounded | PASS：父子预算+共享维护锁，实际Nuxt发布走通；旧活跃session未live搬移 |
| >10min baseline未明显恶化 | PASS：62样本，业务PSS稳定，无持续换页/PSI |
| 1+1组合与安全reserve | PASS：最低MemAvailable12.604 GiB，保守硬预算仍留28.1% |
| No OOM / sustained pressure / production error regression | PASS：worker事件/内核/服务检查 |

**MEMORY BASELINE ESTABLISHED**

**SAFE FOR WAVE 2 — memory/capacity gate。** 本结论不自动解除既有真实iOS/Android等独立产品验收HOLD，也不是不限流公开压测认证。旧root/editor任务在自然重启时按新规则迁移，Python完整服务重写不是本次放行前置条件。

长期路线：先优化Python缓存/数据表示；五个>500 MiB服务的构成、unknown、worker/COW及节省假设见 `python-resident-memory-triage.md`。唯一Go PoC显示可行，但Python SQLite方案在该数据集更省内存，暂不支持整服务重写。继续积累7–14天正常流量曲线，再评估公开发布容量。

私有证据：`/var/log/taiko-memory-phase2/` 下 `heap-migration.jsonl` / `heap-migration-final.json`、`deploy-summary.json` / `deploy-samples.json`、`baseline-after.jsonl` / `baseline-after-summary.json`、`retest/*/{profile,samples,result}.json` / `run.log`、`png-validation.json`。PNG均留在私有目录，不提交用户数据或凭据。
