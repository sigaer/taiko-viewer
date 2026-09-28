# 有界年度验收探测

默认无 URL、无账户、无写入权限即拒绝。不能将 localhost 或另一端口当成隔离证明。本脚本不准备/清理生产缓存，不生成测试账户，不修改限流，不调用社区同步。

必须先准备独立 `_test` 数据库及仅有该库权限的用户、合成账户与 userdata、独立缓存和 admission 目录，并核对 Python/Chromium worker 的资源与网络边界。`isolationEvidence` 应记录实际 SELECT DATABASE/SHOW GRANTS、进程/cgroup、各目录 realpath、对象存储/队列和外发阻断的核查证据；这个文件及两个环境标志是人工声明，不能替代实际核查。当前机器缺少这些条件，禁止直接复制配置后指向生产。

配置见 `annual-readiness.example.json`。账户 JSON 为数组，每项包含 `synthetic:true, userId, cookie, nickname, playCount`；真实 cookie 仅保存在仓库外 0600 文件。至少 30 个未生成冷身份、2 个热身份、同用户并发的两组独立新身份。

目标进程须显式携带：`TAIKO_ALLOW_TEST_DB_MUTATION=1`、`TAIKO_DB_NAME=..._test`、DB 连接参数、`ANNUAL_E2E_ISOLATED_ROOT=/var/tmp/annual-test-...`、该目录内的 `TAIKO_USERDATA_DIR`/`TAIKO_ANNUAL_CACHE_DIR`/`TAIKO_ANNUAL_ADMISSION_DIR`、`ANNUAL_E2E_SYNTHETIC_DATA=1`、`ANNUAL_E2E_EGRESS_BLOCKED=1`。必须由受限 development cgroup 托管；端口与 PID 的监听归属也会核查。

从 viewer 目录执行（不要把密钥写入命令）：

```bash
bash ../scripts/memory/run_qa.sh /usr/bin/python3 loadtest/run-annual-readiness.py /private/annual-probe.json
```

升压时必须在 `previousResult` 指定上一档健康 warm JSON（3/s需要1/s，5/s需要3/s，10/s需要5/s）；仍需人工核实结果来自同一构建/环境及资源/队列恢复。只在真实隔离、服务端监控齐备后逐档人工审核：

| 场景 | 配置 | 前提 |
|---|---|---|
| warm | 1/s ×120s，maxVus=5 | 多个缓存身份，先各自 1 次冒烟 |
| warm | 3/s ×180s，再 5/s ×300s，maxVus≤10 | 上一档成功、无丢弃、无资源风险 |
| burst | 10/s ×60s，maxVus≤10 | 5/s 通过 |
| recovery | 1/s ×180s | 比较延迟、队列、内存回到基线 |
| cold | 首轮串行，maxVus=1，固定30个身份 | 至少30个未生成身份，不重复；首轮串行，每次间隔至少1秒；不宣称恒定1/s，硬时限可能使30身份无法全部完成 |
| same2/same5 | 同步2/5事务，maxVus=2/5 | 各使用一个全新身份；需另查 admission 日志中的真实计算次数 |
| share | 4次事务，maxVus=1 | 两身份轮换、包含真实 share-card POST 和图片 GET；四次顺序完成，无到达率宣称 |

协议 iteration = auth/me → summary GET →（冷路径 build POST + 最多每秒一次有界 job GET + 最终 summary GET）；share 额外 POST `.../{summaryId}/share-card`，`syncCommunity:false`，GET 返回 imageUrl，完整 PNG 解码并保留产物。不包括 HTML、字体、图片或页面操作。首次尝试失败计失败，不自动重试。身份/版本/已知关键值不符立刻停止。

热缓存/突发 Node 探测采用按时隙发起、有硬 VU 上限的开放模型；忙时不排队补发，记录 `droppedSlots`。它不是 k6，`k6DroppedIterations=null`。启动数/成功/失败/未完成/请求量、时隙丢弃和分位数写入 JSON；成功分位数不含失败，因此必须同时读失败率。`observedStartsPerSecond` 使用配置发起窗口或实际较长窗口，`httpPerSecond` 使用含收尾观察的总墙钟时长。冷路径与分享顺序执行、同用户采用同步组，三者均不宣称到达率。

门槛：warm/burst/recovery P95≤800ms、P99≤2000ms、成功率≥99.5%，本脚本更保守地将任何失败/丢弃标为非零退出；30秒后累计失败>5%停止。冷生成180秒、分享90秒为本轮预设上限，未实测基线前不得当作已达到 SLA。缺服务端真实计算次数/队列回落证据时不得自动升压。

独立 Python 监督进程每秒采集宿主机 MemAvailable、PSI、CPU/换页累计计数、目标进程 IO、网络累计计数及 PID 启动身份；Node 另采集 RSS/cgroup OOM。资源危险或监控丢失仅停止本轮负载子进程，不杀服务器。所有任务仍受 `run_qa.sh` 15分钟/cgroup 限制。共享 MySQL/工作进程的峰值、磁盘IO和生产健康需现有监控补齐，脚本采样不能替代它们。

未实际验证的限制：此环境未执行过真实协议正向路径；缺少 30 个合成冷账户、真实分享和容量结果。脚本拒绝路径及语法检查结果见 `../docs/annual-release-readiness.md`。解除隔离阻塞后，先跑单事务并验证响应字段，再执行矩阵，不跳过冒烟。
