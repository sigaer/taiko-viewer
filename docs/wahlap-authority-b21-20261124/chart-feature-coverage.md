# 1,387-chart feature coverage and updated Golden Corpus

复用 Batch 2 已验证的 **3,003 份 TJA** 扫描，不重新跑已通过的全量 parser。输入压缩扫描 SHA-256=`d03e4956b126b2e6bafa3a6fef53d4e8d9df53d0441c489346b51519d3c15944`，39,783,717 bytes，5,253,837 events；冻结原文包 SHA-256=`18731b747a40c7329e2980d0176c41fefc03215b9bca4146de141f46c8a4670a`。本批逐文件核对全部 3,003 个 source hash，再按 COURSE/静态路径生成 sidecar，QA `qa-9b7e6e33da28`。没有把旧扫描器空时间误判的 993 INVALID 重新带回。

Batch 2 全文件分类仍为 1,832 COMPLETE（已定义静态范围）、1,171 PARTIAL、0 UNSUPPORTED、0 INVALID；这不等于绝对对齐和动态语义全部正确。221 份含静态分支路径，147 份涉及 player-side，5 份 LEVELHOLD 的动态选择未验证。

国行有效鬼/里 **1,387 张**全部有冻结 raw 源证据。每谱面的 13 项状态、raw/parser/source hash/diagnostics 见 [逐谱覆盖](coverage/cn-1387-coverage.json)，[汇总](coverage/summary.json)，[parser manifest](coverage/parser-manifest.json)。完整相对间隔 histogram、静态路径及密度指标私有归档，不把大文件和原始 TJA 放进源码。

| Feature | AVAILABLE | PARTIAL | UNAVAILABLE | NEEDS_VALIDATION |
|---|---:|---:|---:|---:|
| Basic Note Sequence | 1377 | 10 | 0 | 0 |
| Big Notes | 1377 | 10 | 0 | 0 |
| BPM | 844 | 543 | 0 | 0 |
| DELAY | 1377 | 10 | 0 | 0 |
| MEASURE | 1377 | 10 | 0 | 0 |
| OFFSET | 0 | 0 | 0 | 1387 |
| Scroll | 658 | 8 | 0 | 721 |
| Roll | 1373 | 14 | 0 | 0 |
| Balloon | 0 | 4 | 0 | 1383 |
| Branch | 1287 | 97 | 0 | 3 |
| Local Density | 1377 | 10 | 0 | 0 |
| Rhythm Features | 0 | 1387 | 0 | 0 |
| Pattern Features | 0 | 0 | 1387 | 0 |

AVAILABLE 的范围是该特征明确验证的静态表示：Basic 为有限时间的单条静态路径普通音符序列；Big 为该序列 type 3/4 计数；Local Density 为半开窗口计数，不等同击打负荷或体力模型；没有 Branch/Scroll 命令可标记对应“无该变化”的特征可用，不表示动态选择/渲染已实现。

BPM/DELAY/MEASURE 只覆盖现有静态事件时间线。部分命令/诊断只有文件范围，尚不能精确归属 COURSE 时保守降为 PARTIAL，不复制成已验证课程能力。Roll 的静态起止与 Balloon 的需求命中分别处理；长音异常仅降低相关特征。OFFSET 与音频绝对对齐、Scroll 到显示效果、动态 LEVELHOLD 均不标完整。Rhythm 仅有相对 IOI histogram，所以为 PARTIAL；未实现的新 pattern 推理一律 UNAVAILABLE。

逐谱隔离实现：[coverage assessor](../../../bot/taiko_bot/catalog/coverage.py)、[raw hash validation](../../../bot/taiko_bot/catalog/resources.py)、[Builder record isolation](../../../bot/taiko_bot/catalog/builder.py)。坏 coverage record、缺失/变化 raw、非法或不支持的 parser status 只使该谱面相应特征 unavailable，其他谱面和目录继续构建。原全局若干缺失资源仍单列旧证据，不阻断 1,387 张覆盖或迁移。

Updated Golden Corpus 见 `coverage/golden-corpus-b21.json`：保留 Batch 2 手算 timeline 原样和 source hash；新增半开 1000ms 密度、500ms 相对间隔、Big Note、非有限时间、OFFSET/Scroll/LEVELHOLD 未验证状态、错误 sidecar/raw 隔离和 Kinoko 时间负控制。旧数值 oracle 不因 Catalog 迁移重写。候选验收重新运行现有 timeline Golden；没有声称未验证能力支持。
