# Performance Benchmark

实测 run `qa-9fd4ad6f4c18`，Node v24.13.0/Linux x64，Intel Xeon Platinum 8255C；现有 QA cgroup 两核限额、MemoryHigh 2GiB/Max3GiB、Node heap1536MiB，单进程串行。并非生产请求负载。

每个规模有相同数量的合成候选和准确匹配的 active score-pb Goals，每目标有独立 baseline/evaluation；不是空 Portfolio 快捷路径。预热1次；10/100规模测7次，1000/5000测5次。以下是每批毫秒中位数，非每候选平均或尾延迟SLA。

| 候选/Goal数 | Validation | Identity resolve | Goal association | Priority gate | 完整 Slate | Context准备 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 2.760 | 0.253 | 1.947 | 0.841 | 15.961 | 3.061 |
| 100 | 22.472 | 2.140 | 17.071 | 4.546 | 136.938 | 21.216 |
| 1,000 | 221.310 | 22.627 | 175.787 | 4.490 | 1,329.574 | 210.889 |
| 5,000 | 1,230.262 | 123.245 | 920.790 | 9.293 | 7,852.186 | 1,282.252 |

Validation/Identity/Association 复用本批 prepared 索引；完整 Slate 包含 context准备、两次候选验证、Goal关联、排序、去重和gate。Gate 使用完整候选 lookup，但展示卡最多50（10规模为10）；不能称对5000展示卡做gate。所有计时原始样本、min/median/max、最终slateHash与环境见 [performance.json](evidence/performance.json)。每轮重组同时检查 slateId 一致。

进程实测 `process.resourceUsage().maxRSS=601296 KiB`（约587.2MiB），为整个 benchmark Node 进程的高水位，不是每项增量、cgroup峰值或生产容量。wrapper预算不能当实测峰值。

5,000项约7.85秒说明当前实现适合作为待优化的离线候选批处理基线，尚未证明可放入在线请求路径。包含复制、schema/hash及全量复验成本；未做生产缓存、并发吞吐、冷启动、DB/网络或真实模型预测测量。

```bash
bash scripts/memory/run_qa.sh /bin/bash scripts/verify_multi_objective.sh \
  /www/server/nvm/versions/node/v24.13.0/bin/node \
  /home/sigaer/taiko/taiko-forum/taiko_viewer/node_modules/typescript/bin/tsc \
  /home/sigaer/taiko/taiko-forum/taiko_viewer/node_modules/@types benchmark
```
