# B4-1 Review Fix 性能对照

原始报告 [performance-benchmark.md](performance-benchmark.md) 和 [performance.json](evidence/performance.json) 保持原字节。本轮修复涉及 Candidate Validation 及 Goal 关联使用的 actionability 校验，按原 benchmark 脚本追加测量，未改脚本、输入规模、循环次数或阈值，未做性能优化。

原 run：`qa-9fd4ad6f4c18`；新 run：`qa-cd715dafb68d`。同一 Node v24.13.0 / Linux x64 / Xeon Platinum 8255C；现有 QA cgroup 两核限额、MemoryHigh 2GiB / Max 3GiB、Node heap 1536MiB。串行，预热一次；10/100 测 7 次，1000/5000 测 5 次。每个候选有一个准确匹配的 active score-pb Goal；完整 Slate 包含准备、验证、关联、组合与最终 gate。

下表为每批毫秒中位数，单元格为“原测量 → 本轮测量”：

| 候选/Goal 数 | Validation | Canonical Identity | Goal Association | Priority Gate | Slate Composition | Context |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 2.760 → 2.750 | 0.253 → 0.248 | 1.947 → 1.986 | 0.841 → 0.903 | 15.961 → 19.550 | 3.061 → 3.114 |
| 100 | 22.472 → 28.885 | 2.140 → 2.778 | 17.071 → 27.568 | 4.546 → 7.804 | 136.938 → 139.826 | 21.216 → 28.072 |
| 1000 | 221.310 → 216.070 | 22.627 → 23.378 | 175.787 → 171.108 | 4.490 → 4.421 | 1329.574 → 1336.120 | 210.889 → 207.163 |
| 5000 | 1230.262 → 1178.824 | 123.245 → 142.931 | 920.790 → 822.527 | 9.293 → 5.430 | 7852.186 → 7689.490 | 1282.252 → 1258.857 |

5,000 候选完整 Slate 原中位数 7,852.186ms，本轮 7689.490ms。该差异包含运行噪声；未进行受控多轮性能归因，不能声称性能优化或生产容量提升。Gate 仍只检查最多 50 张展示卡及完整候选 lookup，不是 5,000 张展示卡。

本轮 Node 进程 `maxRSS=573468 KiB`，是全进程高水位，不是增量内存或 cgroup 峰值。测量覆盖合成 score-pb 路径，没有真实 Crown producer、模型预测、DB、网络、并发吞吐或生产 SLA 结论。每轮相同输入的 slateId 一致性断言通过。

原始样本、min/median/max、环境与 slateHash 见 [追加数据](evidence/review-fix-performance.json)，未截断运行输出和 wrapper manifest 在 [本轮证据目录](evidence/review-fix/)。

```bash
bash scripts/memory/run_qa.sh /www/server/nvm/versions/node/v24.13.0/bin/node \
  --experimental-strip-types taiko_viewer/tests/multi-objective/benchmark.ts \
  docs/batch4/implementation/evidence/review-fix-performance.json
```
