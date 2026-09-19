# Server Memory / OOM Incident Forensics — 2026-09-18

## 1. Incident summary

**ROOT CAUSE PARTIALLY CONFIRMED**

北京时间 2026-09-18 11:00–11:38 发生 **A. Global OOM**。用户报告约该时段 SSH 不响应；不是本次整机 reboot。最大单进程是 PID **3623954**，已通过内核和 Codex 执行记录交叉识别为：

```text
PHASE=after node /var/tmp/annual-preview-decoupling/check.mjs
```

这是 Codex 发起的 **Playwright UI 验证脚本**，不是 Codex app-server、VS Code extensionHost，也不是 Nuxt build。11:00 时 RSS 约 13.40 GiB；11:38 被杀时匿名 RSS **13.47 GiB**。三次 OOM dump 均显示 **Free swap = 0 kB / Total swap = 25,165,820 kB**。

已确认的系统故障链：高内存验证进程与既有服务、tmpfs 数据共享机器预算，RAM 和 swap 耗尽；测试所在 session 及父 cgroup 没有内存上限，故障扩散为 global OOM。尚未完全确认的是该脚本内哪条调用造成 13.5 GiB 分配，以及失联期间 swap/磁盘的逐秒行为。

**最强代码级嫌疑：对两张 PNG Buffer 执行 `assert.deepEqual`，失败时生成巨大的断言差异。** 原始脚本确有该语句；图片不同；另一会话在恢复后移除此断言并重跑成功。但是没有事故 PID 的堆、调用栈或 profiler，不能把这一机制升级为完全证实的内存泄漏。

取证时间：11:42–11:46 起，Asia/Shanghai（UTC+08）。本轮仅读取系统/日志及写本报告；没有修改业务代码、配置、重启、kill、清 swap、清缓存、安装工具、构建或部署。取证过程中另一个既有会话在部署，恢复后快照不是静止现场。没有主动复现 OOM。

## 2. 是否 reboot / kernel 或 host failure

- `uptime`：273 天 18 小时以上；`uptime -s`：2025-12-18 16:52:20。
- 当前 boot ID：`828136dfd9bd445fa789d783573efeb9`。`journalctl --list-boots` 只有当前 boot，日志保留范围为 2026-09-03 起；**日志保留起点不是启动时间**。
- `who -b` 无输出。`last -x reboot shutdown` 最新条目为 Aug 1 14:21 reboot / 14:20 shutdown，与内核 uptime 不一致，属于不完整或陈旧的 wtmp 证据，不能据此编造本次重启。
- 事故窗口没有找到 shutdown/reboot、kernel panic、hard/soft lockup、hung-task 或文件系统 I/O 错误；`/sys/fs/pstore` 为空。现存记录不支持本次 host reboot、异常掉电或内核 panic。
- 11:38:28 后生产 PID 3318488 继续输出服务日志，11:44 查询时启动时间仍为前一日 23:59:41。
- 用户症状为 SSH 无响应；没有云平台控制台、串口、网络抓包或云宿主机事件，不能完全排除并发的网络故障。但本地 OOM 有直接证据，不是仅凭 SSH 症状猜测。

## 3. 事故时间线

内核原始时间以 `/var/log/kern.log` 中方括号 uptime 秒、`dmesg -T` 和 shell 执行时间交叉核对。journal 中大量内核行延迟至 **11:38:27** 入库，甚至显示不同的收集时间间隔；不能把全部 OOM 都记为 11:38:27。下表 OOM 时间采用原始 kernel 时间折算，秒级存在时钟转换误差。`—` 表示无该时刻观测，不是零。

| 北京时间 | 事件 / 进程 | RSS | swap | load / IO | 内核或执行证据 |
|---|---|---:|---|---|---|
| 10:54:46 | 启动本次验证 Nuxt dev，PID 3621848，端口 3218 | — | — | — | `dev.pid` mtime；原会话启动记录和 10:58 `ss` |
| 10:56:22 | before 验证结束，exit 0 | — | — | — | 原会话命令记录；before-export.png mtime |
| 10:57:12–10:57:43 | 首次 after 验证结束，exit 1 | — | — | — | 原会话 CommandExecution；不是仍在运行的并发副本 |
| **10:58:07.230** | 修改导航等待条件后，启动第二次 after；PID 3623954 | — | — | — | 执行记录 `started_at_ms=1789700287230` |
| 10:59:04 | 已出现五个 viewport 的 after 截图，尚无最终结果 | — | — | — | 原会话 `ls after*` 输出 |
| **11:00:17–18** | 第一次 global OOM；先杀测试 session 的 Chromium PID 3624581 | **3623954 RSS 14,047,748 kB** | **空闲 0** | — | invoking task 为另一业务 headless_shell PID 4112470 |
| 约 11:00–11:38 | 用户感知 SSH 无响应 | — | — | 无历史速率数据 | 用户口述时间约 40 分钟前，与日志相符 |
| **11:37:12–13** | 第二次 global OOM；杀另一业务 Chromium PID 43121 | 3623954 RSS 14,130,952 kB | **空闲 0** | — | invoking task 为 YDService PID/TID 4063520 |
| **11:38:24–25** | 第三次 global OOM，杀 **3623954 MainThread** | **anon 14,128,308 kB** | **空闲 0** | — | invoking task 为 gpg-agent PID 3624980 |
| 11:38:28.047 | 原验证命令返回 **137**；运行约 2420.8 秒 | — | — | — | shell 明确输出 `3623954 Killed ... check.mjs` |
| 11:38:28 起 | 原生产进程继续输出请求日志 | — | — | — | `journalctl` 中 node[3318488] |
| 11:39:00–11:40:09 | 另一会话移除 PNG Buffer 深度断言并重跑成功 | 无峰值记录 | — | — | 原会话 exit 0，图片差异检查结果非零 |
| 约 11:42 | 另一会话部署开始；随后一个 Nuxt build | 后续观测 3.17–3.66 GiB | — | — | PID 3629059；不是 11:00 的事故启动者 |
| **11:42:13** | 本次取证开始，机器已恢复响应 | 系统 available 约 14.40 GiB | 已用约 22.97 GiB | load **10.78 / 170.23 / 243.34** | uptime、meminfo、PSI |
| 11:42:49 后 | 20 秒 vmstat + 10 次 iostat | — | 持续回读，so=0 | 详见 IO 节 | 仅反映恢复期，且叠加另一会话构建 |

## 4. OOM / killed process 详情

三次均为 `constraint=CONSTRAINT_NONE`、`global_oom`，不是 `CONSTRAINT_MEMCG`。

| 原始时间（约） | 被杀 PID / name | total-vm kB | anon-rss kB | file-rss kB | shmem-rss kB | oom_score_adj | task_memcg |
|---|---|---:|---:|---:|---:|---:|---|
| 11:00:18 | 3624581 / headless_shell | 1,476,434,676 | 106,624 | 0 | 46,256 | 300 | `/user.slice/user-0.slice/session-896415.scope` |
| 11:37:13 | 43121 / headless_shell | 1,476,274,008 | 904 | 0 | 36 | 300 | `/user.slice/user-0.slice/session-884865.scope` |
| 11:38:25 | **3623954 / MainThread** | **15,617,524** | **14,128,308** | **0** | **0** | **0** | `/user.slice/user-0.slice/session-896415.scope` |

历史 `/proc/PID/oom_score` 未采集，无法恢复；表中是内核真实记录的 **oom_score_adj**，不是 oom_score。Chromium 巨大的 total-vm 是虚拟地址空间，不能认定其消耗了 TB 级 RAM；被杀顺序也不是简单 RSS 排序。首次发起 OOM 的进程同样不等于最大消费者或根因。

第一次 Mem-Info 关键原文（kB，注明 pages 的项目除外）：

```text
active_anon:1770042 inactive_anon:5876257      # pages
active_file:239 inactive_file:1133           # pages
free:51962 shmem:141779 pagetables:79053     # pages
Node 0 active_anon:7080168kB inactive_anon:23505028kB
active_file:652kB inactive_file:4160kB
dirty:0kB writeback:0kB shmem:567116kB
Node 0 Normal free:68744kB min:62888kB low:92720kB
Free swap  = 0kB
Total swap = 25165820kB
```

约 29.17 GiB active/inactive anonymous 类页面、极少文件缓存、正常区可用页接近最低水位、swap 为零，直接支持全局分配失败。匿名 LRU 类统计不应全部归于某一个进程；tmpfs 页面亦影响回收预算。

## 5. Top memory processes：事故现场与恢复后分开

以下来自**首次 OOM task dump**，RSS/swapents 原为 4 KiB pages，已换算为 kB。它是事故证据，比事后 `ps` 更重要。

| PID / 识别 | RSS kB | swap kB |
|---|---:|---:|
| **3623954 / Node Playwright check.mjs** | **14,047,748** | 42,612 |
| 63147 / Python multiprocessing，父 63105 hypercorn bot_core | 2,085,060 | 380,332 |
| 1580110 / python3 main.py | 1,827,296 | 268,904 |
| 1697380 / Nuxt dev，端口 3001 | 1,723,220 | 330,692 |
| 3621848 / 本轮 Nuxt dev，端口 3218 | 1,419,144 | 226,648 |
| 2270 / BT-Task Python | 791,352 | 288,984 |
| 3303473 / VS Code extensionHost | 747,712 | 193,436 |
| 2112 / mysqld | 458,496 | 1,170,032 |
| 3318488 / Viewer production | 440,580 | 78,952 |
| 3997543 / python3 deckServer.py | 434,384 | 505,500 |
| 1953007 / 旧 Phase B Nuxt dev，端口 3101 | 336,232 | 827,052 |

事故 dump 按 comm 汇总：Node/MainThread 33 个约 **18.84 GiB RSS / 2.78 GiB swap**；Python/BT-* 35 个约 **7.98 GiB RSS / 4.52 GiB swap**；Chromium 24 个约 298 MiB RSS；Codex 前缀 6 个约 119 MiB RSS / 63 MiB swap；PHP 9 个 RSS 612 kB、swap 66,996 kB；Java **0 个**。comm 归组是近似识别，不能代替全部 exe/命令路径；共享页使 RSS 相加存在重复，也不会包含全部 tmpfs swap。

恢复期按 `/proc/PID/exe` 严格分类（11:46:11，kB；组间可重叠，不能横向累加）：

| 组 | 数量 | RSS 合计 kB | VmSwap 合计 kB |
|---|---:|---:|---:|
| Node | 32 | 5,112,484 | 2,061,984 |
| Python（含面板、取证短进程） | 52 | 9,191,584 | 5,429,556 |
| Java | 0 | 0 | 0 |
| PHP | 9 | 628 | 66,996 |
| VS Code Node | 15 | 2,282,060 | 642,920 |
| extensionHost | 2 | 1,532,620 | 370,292 |
| Remote server-main | 3 | 199,084 | 127,656 |
| fileWatcher | 2 | 205,864 | 4,792 |
| language server（按命令识别） | 4 | 97,432 | 70,296 |
| Codex app-server/CLI | 3 | 350,148 | 47,328 |
| Codex code-mode-host | 3 | 24,856 | 5,672 |
| Nuxt 命令相关 Node | 7 | 1,913,088 | 1,256,268 |
| PM2 daemon | 1 | 44,276 | 11,212 |

没有证据显示 Java/PHP 是本次主因；Python 是不可忽略的常驻基线，但没有证明其 worker 在事故前突然扩容或泄漏。

## 6. VS Code / Codex / Nuxt / 验证进程关系

仍存活的父子链由 `/proc`、`ps`、`pstree` 核实：

```text
VS Code server 3558306
  extensionHost 3558569
    Codex app-server 3559236
      shell -> 验证命令（历史执行记录）-> node check.mjs 3623954 [OOM killed]
      shell 3628409 -> deploy 3628411 -> npm 3628861 -> nuxt build 3629059 [恢复后]
```

已退出的 3623954 的精确 PPID 无 `/proc` 快照，shell→该 PID 的映射来自同一执行记录的 `Killed` 行，不假装恢复了完整历史进程树。PID 3624581 与它同 session，符合测试 Chromium，但其精确历史 PPID 同样缺失。PID 43121 则属于存活的另一业务 Playwright/browser 树，与本次测试不是同一个 session。

有三个 Remote server、两个 extensionHost 和三个 Codex app/CLI 进程。Codex CLI 1946855 存活约 18 天；两个 app-server 分别约 12 小时和 3 小时。旧会话存在，但是否仍有用户需要不能仅按年龄判断。两 extensionHost 当次实测约 0.70/0.69 GiB RSS，不支持它们是 13.5 GiB 的事故 PID。

11:43 左右高内存 PID 的 `/proc/status`、`smaps_rollup`、`limits` 摘要（kB，动态非原子读取）：

| PID | VmRSS | RssAnon | RssFile | VmSwap | PSS | Threads |
|---|---:|---:|---:|---:|---:|---:|
| 63147 | 2,109,284 | 2,092,712 | 16,564 | 347,108 | 2,098,033 | 44 |
| 1580110 | 1,848,012 | 1,845,252 | 2,760 | 250,948 | 1,846,415 | 14 |
| 1697380 | 1,489,660 | 1,431,988 | 57,672 | 279,076 | 1,448,897 | 28 |
| 3303473 | 739,104 | 708,788 | 30,316 | 193,392 | 725,230 | 13 |
| 3558569 | 722,944 | 685,984 | 36,960 | 177,956 | 703,314 | 20 |
| 3559236 | 191,952 | 85,572 | 106,380 | 16,616 | 174,685 | 29 |
| 3303836 | 83,668 | 44,144 | 39,524 | 8,740 | 71,997 | 21 |
| 1946855 | 53,860 | 26,880 | 26,980 | 23,152 | 58,813 | 17 |
| 3629059（恢复后 build） | 3,321,756 | 3,256,136 | 65,620 | 0 | 3,278,604 | 27 |

这些 PID 的 address-space 和 resident-set limits 为 unlimited；不能将 VSZ 当成 RSS。没有本次 extensionHost 的持续增长曲线，所以不能诊断 **G. VS Code/Codex extension leak**。旧 CodeBuddy 堆快照只证明曾生成转储，不证明今天 extensionHost 泄漏。

### 原始验证脚本中的强嫌疑语句

事故时版本由 Codex rollout 还原，不能只看 11:39 已改过的当前文件：

```js
if (phase === 'after')
  assert.deepEqual(
    await fs.readFile(out + '/after-export.png'),
    await fs.readFile(out + '/before-export.png')
  );
```

它位于导出截图、内容断言之后，最终写 after.json 之前。进程被杀后原会话记录：after-export.png 已存在，after.json 不存在。恢复后的 PIL 对比记录两张图片均为 **3240×4944**，35,803 像素不同；PNG 文件约 1.3 MB（当前 after 文件已被重跑覆盖，不用其当前字节内容冒充事故原件）。

本机 Node v24.13.0 内置 `internal/assert/assertion_error` 源码可只读检查：`inspectValue` 使用 `maxArrayLength: Infinity`、`customInspect: false`，`createErrDiff` 对展开后的行调用 `myersDiff`。因此“大型不同 Buffer 的断言错误格式化导致高分配/长耗时”有具体实现依据。没有对这两个 Buffer 再次执行断言。

另一会话 11:39 移除此 PNG Buffer 断言、加少量进度日志，11:40 重跑 exit 0，是强关联证据。环境在 OOM 后也发生变化，且没有当时 JS/native 调用栈，因此仍标记**高可信嫌疑机制，不是严格受控复现或已证实泄漏**。

### Build 与部署并发

事故窗口内找到的是 Nuxt dev + Playwright 测试；没有找到两个并发 production build 的证据。第一次 after 在第二次启动前已 exit 1。三个 dev（3001、3101、3218）和生产服务共存属实。

恢复后观测到一个 build：3629059，PPID 3628861 npm，父 3628411 deploy，祖先 3559236 Codex。`scripts/deploy_forum_web.sh` 已有 `flock -n` 单实例锁、900 秒默认超时、`NODE_OPTIONS=--max-old-space-size=4096`，并在 `/tmp/taiko-viewer-release.*` 内构建后再切换/重启。因此 build 与旧生产共存是实际行为；现有锁并未为任意手工 dev/测试提供隔离，Node heap 限制也不等于整个进程树/cgroup 总内存限制。

shell history 找到 build/deploy 命令历史，但不把“出现过命令”当作本次执行和并发证明。没有发现本次事故遗留的 production build；恢复后的构建不应倒推为 11:00 根因。

PM2 活 daemon 已存在后只读查询 `jlist`（仅输出白名单字段，未导出 env）：仅 `main`，PID 985290，fork_mode，instances=1，restart_time=0，memory=31,768,576 bytes，pm_uptime=1766230189463；它是 sekai_calculator，不是 Viewer。没有 PM2 新旧 Nuxt worker 叠加证据。

## 7. 当前 RAM / swap 状态

11:42 初始 `/proc/meminfo`，单位 kB：

| 字段 | 值 | 字段 | 值 |
|---|---:|---|---:|
| MemTotal | 32,095,592（30.61 GiB） | MemAvailable | 15,102,828（14.40 GiB） |
| MemFree | 13,401,376 | Cached | 1,975,632 |
| SwapTotal | 25,165,820（约 24 GiB） | SwapFree | 1,083,020 |
| SwapCached | 242,524 | Shmem | 507,776 |
| Dirty | 2,780 | Writeback | 32 |
| Slab | 817,916 | SReclaimable | 554,056 |
| PageTables | 231,228 | Buffers | 142,072 |
| CommitLimit | 41,213,616 | Committed_AS | 56,481,488 |

swap 为根盘上的 `/swapfile`，优先级 -2，使用 24,082,800 kB，约 **22.97 GiB / 95.7%**。这是恢复期残留占用；不能仅据此宣布仍在 thrashing。`vm.overcommit_memory=0`；Committed_AS 是虚拟承诺量，超出 CommitLimit 不等于同量实占 RAM。

初始 PSI：memory some avg10/60/300=0.76/3.73/**46.44**，full=0.67/3.12/**40.12**；IO some=1.93/3.92/**41.66**，full=1.89/3.48/**37.93**；CPU some=0.21/1.32/3.75。avg300 是平滑压力指标，不是精确还原前五分钟每秒占比，但支持近期严重 memory/IO 阻塞，而取证时已恢复。

## 8. IO / swap thrashing / 磁盘空间

执行 `vmstat 1 20` 和 `iostat -xz 1 10`，忽略首行/首组开机以来平均值后：

- vmstat：si **32–5,752 KiB/s**，so **0**；iowait **0–12%**；r **3–19**，b **0–2**。这是恢复回读及同时构建，不是事故期的连续换入换出记录。
- iostat：vda r_await 约 **0.71–1.69 ms**（有读 IO 的区间），w_await 约 **0.76–2.50 ms**；util **1.6–42%**，aqu-sz 最大 **0.75**；vdb 接近空闲。取证窗口未见磁盘饱和或超时。
- 事故三份 Mem-Info 的 Dirty/Writeback 低，未见独立写回风暴证据；这不能排除当时 swap IO/回收引起长时间卡顿。
- sysstat 的 sar/iostat 已安装，但 `/var/log/sysstat` 为空；`sar -r/-S/-W/-q/-d/-u` 均报 sa18 不存在。atop 命令和历史目录未找到。无法给出事故前 await、util、si/so、major-fault 速率或 run queue 曲线。
- **C. Swap thrashing** 是合理且有 PSI 支持的放大机制，但历史吞吐缺失，不能完全确认；**D. Disk IO exhaustion** 无充分证据，不能用当前正常磁盘反向排除事故期短暂饱和。

文件系统：根盘 vda1 315G，264G 已用、39G 可用，88%；数据盘 vdb 118G，98G 已用、15G 可用，88%。inode 使用率分别 11%/2%；没有 ENOSPC/inode 耗尽证据。ext4，未发现事故窗口 I/O timeout、blk_update_request、EXT4/XFS error。

**`/tmp` 是 tmpfs，不是普通磁盘目录：总约 16G，已用 15G，95%，仅约 895M 可用。** `du` 最大项为 `/tmp/codebuddy-heap-snapshots`，13 个历史文件，逻辑字节合计 **11,443,419,461（10.66 GiB）**，mtime 在 8 月 27 日至 9 月 5 日北京时间。其 tmpfs 页即便已换出，仍占共享 RAM/swap 容量；不能把 10.66 GiB 全算作当时 resident RAM，也不能与 RSS 无区别相加。文件在事故前已生成，支持它是既有预算放大因素，但没有事故时逐文件驻留/换出映射。

其他目录：`/tmp/node-compile-cache` 480M，`/tmp/taiko-growth-validation` 241M；`/var/tmp` 5.3G（根盘），含 3.4G/1.4G 的历史验证目录；`~/.vscode-server` 7.1G，`~/.npm` 1.3G，Viewer `.output` 127M。`.nuxt` 在检查时未取得有效 du 输出，不能写成零。未清理任何文件，未读取堆快照内容。

## 9. systemd / cgroup v2

挂载为 cgroup2。`systemd-cgls/cgtop`、`systemctl show` 与 cgroup 文件交叉检查：

| cgroup / unit | 恢复期 memory.current | swap.current | events.local oom / oom_kill | MemoryHigh / Max / SwapMax | TasksCurrent / Max |
|---|---:|---:|---|---|---|
| session-896415 | 6,233,317,376 B | 406,884,352 B | **0 / 2** | infinity / infinity / infinity | 198 / infinity |
| user-0.slice | 18,137,661,440 B | 18,903,457,792 B | 0 / 0（层级 oom_kill=55） | 全 infinity | 1071 / 82653 |
| taiko-viewer | 644,194,304 B | 55,406,592 B | 0 / 0 | 全 infinity | 11 / 37569 |
| bt.service | 961,146,880 B | 363,827,200 B | 0 / 0 | 全 infinity | 15 / 37569 |
| mysqld | 515,239,936 B | 1,194,274,816 B | 0 / 0 | 全 infinity | 81 / 37569 |
| session-884865 | 2,975,346,688 B | 817,401,856 B | **0 / 1** | 全 infinity | 228 / infinity |

PHP 两服务也均没有 MemoryHigh/Max/SwapMax 上限。以上 unit 无 CPU quota；session OOMPolicy=continue，Viewer/MySQL/BT/PHP OOMPolicy=stop。计数是 cgroup 生命周期累计，不全属于今天；session-896415 的两次 kill 与本次两个受害者吻合。

`memory.events` 的 max/high/oom 均为 0，而 oom_kill 可增加，结合内核 `global_oom`，明确是**全局 OOM 杀入这些 cgroup**，不是 cgroup 触及 MemoryMax 自己 OOM。不能混淆事件计数语义。

内核 5.10 环境中 `memory.peak` 不存在，systemd MemoryPeak=[not set]。session-896415 累计 pgmajfault=788,172、pgscan=441,057,899、pgsteal=15,791,415；memory.pressure full avg300 约 31.79。它们支持曾有强回收压力，但没有基线时不能当作本次全部增量。

## 10. Root cause / contributing factors / confidence

按指定分类：**J. Mixed cause**，其中确定的主故障为 **A. Global OOM**。

- **Primary trigger（高可信）：** 3623954 的独立 Node 验证进程达到 13.4–13.5 GiB RSS，在 swap 已耗尽的共享机器上形成最大单进程压力。命令身份、占用和 kill 证据闭环。可归为 **E. Runaway process / memory leak** 中的 runaway 高分配；“持续泄漏”尚不能确诊。
- **最可能的内部机制（中高可信）：** 原始 PNG Buffer 深度断言失败后展开/差异生成。静态源码、执行阶段、图片差异、移除断言后重跑均相符；没有采样堆栈，保留其他 Node/Playwright 分配路径可能性。
- **Secondary amplifiers（高可信存在、贡献量不能完整拆分）：** tmpfs 上 10.66 GiB 历史堆快照；约 8 GiB 的 Python RSS 基线；多个 dev 与 production 同机；session 和父 cgroup 没有 RAM/swap 上限；旧开发/测试会话长期存活。
- **C. Swap thrashing（部分支持）：** swap 全满、恢复前 PSI 高、长时间 SSH 不响应；缺事故期 si/so/await，不能量化或认定为唯一主因。
- **F. Build concurrency：** 未证实为本次根因。恢复后的单 build 与事故时间严格分开。
- **G. VS Code/Codex extension leak：** 未证实。Codex 启动了肇事测试，有执行责任链，但不是 Codex 自身 RSS 吃满，也不是已证明多个 build。不能因旧 heap 文件或在场而定性扩展泄漏。
- **H. Service worker overcommit：** 多服务基线属实，但无 worker 数异常增加证据。
- **B. cgroup OOM / D. Disk IO exhaustion / I. Kernel / host failure：** 分别有反证或缺乏支持，不作为确定根因。

是否可复现：**本轮未复现**。原环境上的删断言重跑成功仅是自然对照；不能证明原始故障必现。后续若做实验，应在独立非生产机器或严格受限 cgroup，保存原始输入/版本，测 RSS/PSS/PSI 和 JS/native stack，并限制时长与总内存。本轮不执行。

## 11. Unavailable evidence / 限制

- 本次**没有 reboot**，因此没有证据因“本次重启”丢失；不应套用该说法。
- PID 3623954/3624581/43121 被杀，历史 `/proc` 的 PPID、smaps、limits、oom_score、线程栈无法追溯。没有 3623954 heap/profile/core 的现成证据。
- sysstat 未采集、无 atop：事故前逐秒内存、swap IO、磁盘延迟、top/PSS 轨迹不可恢复。PSI/major-fault 总量只是累计/平滑值。
- cgroup 无 memory.peak 文件，且生命周期计数不是事故专属。
- 原 after.log/check.mjs/after-export.png 已由另一会话改写或重跑覆盖；原命令和旧脚本从 append-only rollout 历史提取。当前文件不可视为事故原版。
- 现存 journal 仅当前 boot 且从 9 月 3 日开始；没有 previous boot 可查。9 月 6 日也有历史 global OOM，但未将其与今天合并或用它证明同一原因。
- 云宿主机、控制台、网络丢包、用户端 SSH 精确时间不可用。wtmp 与 uptime 冲突已保留而未强行统一。

## 12. Remediation plan（建议，未实施）

### P0 防崩

1. **先约束验证/浏览器进程树，而不只约束 build。** 每次 UI QA、截图、dev 和构建放独立 cgroup，设置经过容量验证的 MemoryHigh/MemoryMax/MemorySwapMax、超时、TasksMax；避免与整个 VS Code session 混成一个不可隔离故障域。生产与 SSH 留足预算。
2. **审查大 Buffer 断言。** 若只需字节相等，使用返回布尔值的 Buffer 比较或 hash，加固定短错误信息；视觉验证用有界图片差异指标/产物，而非百万字节深度断言展开。先确认业务验证意图，不能把像素允许差异变成放弃检查。
3. **制定 tmpfs 堆转储预算。** 经用户后续批准再归档/删除旧 CodeBuddy 快照；未来放磁盘路径，限制大小、数量及保留期。当前仅建议，未清理。
4. 为开发/验证/构建设共享资源准入和串行策略。deploy 已有单实例锁，应保留并覆盖绕过脚本的高内存任务；不要重复“添加已存在的锁”而忽略 QA。计划回收不再需要的旧 dev/session，须另行执行，不能凭进程年龄自动 kill。
5. 按实测峰值给生产和 Python 服务规划 MemoryHigh/Max，总预算覆盖并发常驻、page cache、内核及 tmpfs；避免给关键数据库盲目设置过低硬上限。未给出没有容量依据的全服务统一限额。

### P1 可观测性

1. sysstat 已安装：后续启用采集并验证 sa 文件确实生成；无需先重复安装。atop 若获授权可安装并启用历史记录。
2. persistent journal **已经存在**，重点验证容量、保留策略、压力时日志收集延迟和 OOM 原始单调时间；不是建议从零开启一个已启用功能。
3. 采集每服务/cgroup 数据和 OOM 日志；退出 137 自动关联 PID、命令、启动者、cgroup、job ID。对测试成功/失败和部署保留独立不可覆盖日志，避免事故记录被重跑覆盖。

### P2 优化

1. 在受控环境验证 PNG 断言差异生成路径；保留必要的 Node/Playwright 版本与输入 hash，对照简短错误输出，避免在生产机重放。
2. 根据 PSS/峰值决定 Python worker、浏览器页/上下文、Nuxt dev 数量，优先消除无用常驻，而不是一律减少生产并发。
3. `--max-old-space-size` 仅是辅助约束；需同时覆盖 Buffer/native/Chromium 子进程及 tmpfs。现有 build=4096 MiB heap 上限不是整机安全保证。
4. 针对 tmpfs、npm、VS Code 和临时构建制定有限保留规则。swap 策略必须与工作集和 IO 能力一起评估；不建议用清 swap 或无限加 swap 掩盖高分配问题。

## 13. Monitoring plan

建议后续以 **10 秒采样**（常态可 30 秒）、保留 **7–14 天**：CPU/load/run queue；MemAvailable、RSS/PSS/top-N、VmSwap；PSI memory/io/cpu；si/so/major faults；磁盘 await/util/queue/吞吐；每关键 cgroup memory.current、swap.current、events/local、pressure，支持时采 memory.peak，不支持则采样维护峰值；tmpfs/磁盘空间；PID/PPID/starttime/受控命令标签。

全量 smaps 不必每 10 秒扫描，可对 top-N 或异常 PID 低频采集。日志落**磁盘**而不是近满 tmpfs，设置轮转/大小上限；剔除环境变量、token、cookie、敏感命令参数。告警使用 MemAvailable、持续 PSI full、swap IO 与 cgroup 趋势联合判断，不能仅用 swap used 百分比。OOM 或任务 RSS 异常时保存已有采样前后窗口及原始 kernel dump，避免自动生成超大 heap snapshot 再放大事故。

## 14. Evidence index / 复查入口

- `/var/log/kern.log:40` 起：11:00 第一次 OOM；`:68` Mem-Info；`:90` swap=0；`:341` PID 3623954；`:355–356` 第一受害者。
- `/var/log/kern.log:357` 起第二次 OOM，`:659` 3623954；`:723` 起第三次，`:1023` 3623954，`:1085–1086` 最终 kill。
- `journalctl -k --since '2026-09-18 10:40:00'`、`dmesg -T`；`/var/log/messages` 同步核对；syslog/journal 事故窗口错误检索。保留对 journal 收集延迟的解释。
- `/root/.codex/sessions/2026/09/16/rollout-2026-09-16T16-43-24-01a0a962-902b-7e91-808f-18c0829b41b9.jsonl`：约行 4472 原始脚本；4497 首次 after exit 1；4532 dev PID/监听；4571 第二次 after 明确 PID 3623954、exit 137、起止时间；4582 after.json 不存在；4607 图片差异；4622 移除 Buffer 断言并重跑 exit 0。文件是活跃追加日志，报告只引用已存在记录。
- `/var/tmp/annual-preview-decoupling/check.mjs` 和图片：**恢复后版本**；`/var/tmp/annual-first-run-beta/dev.pid`、原启动命令。
- `/sys/fs/cgroup/user.slice/user-0.slice/session-896415.scope/` 与其他列出 unit 的 memory.*；`/proc/meminfo`、`/proc/pressure/*` 和存活 PID 的 status/smaps_rollup/limits。
- `scripts/deploy_forum_web.sh:62` 起 singleton；`:192` tmpfs 构建目录；`:206` heap 配置；`:208` 构建；后续切换/重启逻辑。只读审核，未执行或修改。
- 本次工具结果包含实时 `vmstat 1 20`、`iostat -xz 1 10`、目录大小和 PM2 白名单摘要；未把任何用户数据、堆转储、完整私密日志或配置秘密复制进仓库。

结论：系统级 Global OOM、最大消费者及其 Codex 发起的验证命令身份已确认；具体分配机制和 swap/IO 卡顿细节仍部分推定，故最终状态为 **ROOT CAUSE PARTIALLY CONFIRMED**。
