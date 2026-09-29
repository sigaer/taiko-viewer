# 有界年度验收探测

默认无 URL、无账户、无写入权限即拒绝。不能将 localhost 或另一端口当成隔离证明。本脚本不准备/清理生产缓存，不生成测试账户，不修改限流，不调用社区同步。

必须先准备独立 `_test` 数据库及仅有该库权限的用户、合成账户与 userdata、独立缓存和 admission 目录，并核对 Python/Chromium worker 的资源与网络边界。`isolationEvidence` 应记录实际 SELECT DATABASE/SHOW GRANTS、进程/cgroup、各目录 realpath、对象存储/队列和外发阻断的核查证据；这个文件及两个环境标志是人工声明，不能替代实际核查。禁止直接复制生产配置。本轮已用本机 MySQL 二进制和全新 datadir 建立独立实例，实测记录见验收文档的续轮章节。

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

历史限制与续轮实际结果分别保存在 `../docs/annual-release-readiness.md`。小样本 smoke 不要求 30 个身份；原 cold 模式仍要求至少 30 个未生成身份。


## 续轮可执行入口

`prepare-annual-candidate.py` 只从指定提交 archive，另显式复制并哈希公开 Python、schema、曲库依赖；不复制未提交称号数据或生产配置。`bootstrap-annual-isolated.mjs` 要求显式 opt-in 和 `run_qa.sh`，启动本轮独立 MySQL（`--no-defaults`、独立 datadir/socket、回环 33179），核验实际 datadir、库名与权限，然后复用候选 schema 代码创建表和 42 个合成账号。生产 MySQL 和原共享测试库均不写入。凭据保存在该运行目录的 0600 文件。

以下命令从 viewer 执行，示例目录必须为全新目录；MySQL 路径为本机现有二进制：

```bash
python3 loadtest/prepare-annual-candidate.py /var/tmp/annual-test-my-run f48a63b
mkdir -p /var/tmp/annual-test-my-run/mysql
bash ../scripts/memory/run_qa.sh /www/server/mysql/bin/mysqld --no-defaults --initialize-insecure --user=root --datadir=/var/tmp/annual-test-my-run/mysql --innodb-buffer-pool-size=128M --log-error=/var/tmp/annual-test-my-run/evidence/mysql-init.log
bash ../scripts/memory/run_build.sh /bin/bash -c 'cd /var/tmp/annual-test-my-run/source/taiko-forum/taiko_viewer && NODE_OPTIONS=--max-old-space-size=4096 npm run build'
python3 loadtest/record-annual-artifact.py /var/tmp/annual-test-my-run
bash ../scripts/memory/run_qa.sh /usr/bin/env TAIKO_ALLOW_TEST_DB_MUTATION=1 "$(command -v node)" loadtest/bootstrap-annual-isolated.mjs /var/tmp/annual-test-my-run
```

最后一条维持有界会话；看到 READY 后，在另一终端按实际结果逐项执行。负载和浏览器子进程仍由该 QA 会话启动，排队命令本身只写任务文件并等候。每个测试任务有硬截止；QA 总期限 15 分钟。每批结束创建 `stop` 文件，确认两个监听和 worker 退出；移除自己的 `stop` 文件后重跑 bootstrap 可继续同一专用库及 fixture，不重复创建账号。勿将所有档位塞进一批。

```bash
python3 loadtest/configure-annual-stages.py /var/tmp/annual-test-my-run
python3 loadtest/queue-annual-stage.py /var/tmp/annual-test-my-run smoke
python3 loadtest/queue-annual-stage.py /var/tmp/annual-test-my-run parallel2
python3 loadtest/queue-annual-stage.py /var/tmp/annual-test-my-run parallel3
python3 loadtest/queue-annual-stage.py /var/tmp/annual-test-my-run same2
python3 loadtest/queue-annual-stage.py /var/tmp/annual-test-my-run same5
python3 loadtest/queue-annual-stage.py /var/tmp/annual-test-my-run high-smoke
python3 loadtest/queue-annual-stage.py /var/tmp/annual-test-my-run browser
python3 loadtest/queue-annual-stage.py /var/tmp/annual-test-my-run protocol
python3 loadtest/queue-annual-stage.py /var/tmp/annual-test-my-run share2
python3 loadtest/queue-annual-stage.py /var/tmp/annual-test-my-run warm
# 人工核验上一档结果、同构建与资源恢复，替换为实际结果文件：
python3 loadtest/queue-annual-stage.py /var/tmp/annual-test-my-run warm3 /var/tmp/annual-test-my-run/results/warm-REPLACE.json
# warm5、burst 同理，各传入已审核的上一档 warm JSON。
python3 loadtest/queue-annual-stage.py /var/tmp/annual-test-my-run mixed
python3 loadtest/queue-annual-stage.py /var/tmp/annual-test-my-run recovery
python3 loadtest/queue-annual-stage.py /var/tmp/annual-test-my-run cold
python3 loadtest/queue-annual-stage.py /var/tmp/annual-test-my-run high-browser
python3 loadtest/queue-annual-stage.py /var/tmp/annual-test-my-run share
python3 loadtest/queue-annual-stage.py /var/tmp/annual-test-my-run public-auth
python3 loadtest/summarize-annual-results.py /var/tmp/annual-test-my-run
touch /var/tmp/annual-test-my-run/stop
```

`smoke` 只做一个冷事务；`parallel2/parallel3` 为不同新用户同步组；`share2` 为两个不同 summary 的日文未命中分享；`mixed` 为 1/s×30s 热读叠加一次冷生成和一次中文未命中分享，总 VU≤3。混合结果单列热读分位数，不拿生成时间与热读 SLA 混算。`browser` 使用实际移动 UA、正常入口与保存按钮，关闭社区同步；`high-browser` 另补快速翻页和两次重播。`protocol` 核对 summary/job/image 越权和数据不足刷新终态。网络 BPF、worker 进程、admission、临时 MySQL IO/RSS 及宿主机压力另存 observations JSON。每份负载结果绑定实际 build ID，升档禁止跨候选提交。

本机观察器保留生产 PID 3542853 / NRestarts=0 的已核实基线；后续环境须重新核验并设置对应基线，不能沿用过期 PID。`public-auth` 当前会复现 4 个中文静态页侧栏登录状态缺陷并非零退出，详见验收报告；不要删除断言使其变绿。5/s 本次触发真实宿主机 PSI 保护，未完成全时长，因此 10/s 的升档前置条件尚未满足。
