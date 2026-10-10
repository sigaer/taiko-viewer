# Passport 历史证据重复装载审计（草案，验证受阻）

- 审计日期：2026-10-10。
- 固定基线：`a5aaf456a22bfcdab3ff634c0f84ae856ceee9bb`，main / 0.81.9。
- 状态：**静态审计完成；补丁、离线计数基准及回归测试已准备；未运行；不能合入或部署。**
- 未连接生产 DB、读取真实用户目录或部署服务。

## 计数结论与适用范围

以下为正常、非 manual、Overview 与 History 都成功、请求期间历史文件不变且没有其他请求碰巧触发全局 single-flight 时的源码推导。不是动态测量。

令 N = min(历史目录中 data_*.json 文件数, 2000)，R = 成功读取原文的文件数，P = 成功解析 JSON 的文件数。一次装载有 N 次 readFile 调用、R 次 JSON.parse 调用、P 次成功解析。`filesRead` 实际是选中的文件数，不能当作成功读取数；`invalidFiles` 同时包含读取异常、坏 JSON 和缺少 songs 数组。

| 工作 | 0.81.9 路径 | 请求共享草案（稳定文件输入） |
| --- | ---: | ---: |
| 历史目录枚举 | 2 | 1 |
| 历史 readFile 调用 | 2N | N |
| 历史 JSON.parse 调用 | 2R | R |
| 历史成功解析 | 2P | P |
| 来源/排除规则、观察 token、counter regression 与状态重建 | 2轮 | 1轮 |
| Daily 单日投影 | 1 | 1 |
| History 最近90日日历投影 | 1 | 1 |
| History score facts 投影 | 1 | 1 |
| readGoalSnapshot 当前成绩读取/解析 | 2 | 2 |
| daily-ability 归档打开 | 2 | 2 |
| 当前能力 Python 调用 | 1 | 1 |

健康 N=2000 样本：历史读取及 JSON.parse 各从4,000次减至2,000次。该数字不含目录枚举、stat、归档、当前成绩、模型版本、曲库及外部 Python 模块的内部文件读取；不能据此声称整个 Passport 只读取2,000个文件。Python 模块 `growth_compute` 位于运行时外部 repoRoot，Viewer 仓库没有其实现，无法从本次仓库审计确定其全部 I/O。

365天是每日能力查询/归档及视图范围。Passport 的事实范围固定最近90天（`passportHistoryRange`），但 evidence 加载器没有日期范围参数，仍加载最近最多2,000个历史文件。不能把90天事实范围视为只读取90天文件。

Overview 调用 `deriveDailyProgress`，内部调用 range/calendar 投影，然后压缩为最多3个事件、每个最多3条事实，并折叠同谱面的冠位标题。History 独立调用 `deriveProgressForRange`，传入当前 revision 并投影完整历史事实。因此两者不是同一 DTO，不能直接复用 Overview 结果构建 History。

## 分支、错误与其他入口

- Overview 在历史装载之前失败：History 通常只加载1次。
- Overview 在 evidence 成功后 Python 等步骤失败：原路径仍可能重复装载；草案保留成功证据供 History 使用。
- manual：Overview 原有加载行为仍保留；History 跳过成绩 evidence/current/catalog，不能简单套用2N。
- 两个独立 HTTP 请求可能偶然共享进行中的 evidence Promise，完成后全局 map 清除。因此上述2N是独立顺序成功路径的计数，不是任意并发下的恒等式。
- Recent：独立装载 evidence，根据 eligible observations/cursor 选择 eventDays，再以 revision 过滤 score/Goal facts。其观察边界、排除来源和确认游标不能用 Passport 90天结果替换。
- Goal：评价仍读取当前成绩及 verified provenance；历史完成 Goal 仍来自持久化事实。未改变任何目标评价、写入、去重或确认时点。
- Daily ability：Overview 读取当前日归档以防覆盖冻结值，Passport 再读365天归档并与持久化 measurement 合并。查询职责及边界不同；本草案保留两次读取和原有 merge/upsert 规则。

## 最小补丁及语义边界

提供 `getSkillPassport` 的内部 `shareScoreEvidence` 选项，**默认关闭，HTTP入口不传入且不暴露该选项**。离线测试/基准显式启用时，才创建绑定初始 taikoId 的请求局部 loader，经可选内部参数传给 Overview 与 History。它复用已经成功装载的 evidence Promise；拒绝后允许重试；账号不匹配走原加载器；独立接口继续走原 loader。没有 TTL/常驻已完成缓存，持有最多一个账号的证据，生命周期随请求结束。保留 Overview 顺序执行、绑定检查、当前成绩读取、能力冻结规则及独立投影。生产默认仍独立处理，未批准或未经证明的复用不生效。

**重要限制：稳定输入的等价性尚待执行测试证明；并发同步场景存在明确语义差异。** 原路径允许 History 看到 Overview 完成后新增/修改的历史文件；请求共享固定首次装载的历史证据，而 History 当前成绩仍会重新读取。本草案没有实现文件代际校验/同步锁，不能保证这类场景事实与基线完全一致。必须先确定产品是否允许请求内固定历史证据边界，或增加有依据的写入代际校验并测试失效重装；否则保留两次独立装载，不应启用这份接线。代码因此仅作为 draft candidate，不是已证明安全的优化。

共享后的 Daily/History 仍各自遍历 snapshots；本草案目标是单次装载和单次 evidence normalization，不是单次业务回放。若进一步共享原始 transition 索引，需要证明 bestScores、full/delta 删除/重置、observedBefore、事件日、当前 attendance 与 revision 语义一致，再分别保留 Daily 展示截断和 History 完整投影。

## 验证准备

新增 `tests/growthRequestEvidence.test.mjs` 与离线服务 adapter。执行实际 Passport/Overview/History/evidence 算法，仅替换 DB/Python/catalog 依赖；固定时钟、写匿名历史文件，不 mock 最终响应。覆盖 mixed/no-baseline/invalid/boundary/truncated、完整 Passport DTO hash、实际读取/解析计数、共享输入不被投影修改、独立请求不复用已完成缓存、绑定变化拒绝、Overview compute 失败、loader 拒绝后重试。

新增 `scripts/performance/benchmark-growth-request.mjs`，复用已有匿名 `prepareFixture`。每个样本使用独立进程，before/after交替顺序3组，记录请求总耗时、读取/解析/装载/投影耗时、文件字节、DTO hash及进程最大RSS。单worker最多60秒、输出256KiB、串行执行；运行时强制批准的QA cgroup。只允许匿名模式，不提供real路径。文件页缓存未强制清空，不能称为冷盘测试；缺少真实SQL/Python开销，不能宣称最新生产延迟或3000ms Gate通过。

Daily timer包含内部range timer，不能把它们直接相加；loader timer包含read/parse与其他证据处理，独占来源重建开销可估算为 loader-read-parse，但仍含目录枚举、hash、排序、计时开销。进程RSS包含离线模块转译和adapter，不是生产服务峰值。

在完整仓库、已有依赖及批准的systemd/cgroup主机上，从仓库根目录执行：

```bash
bash scripts/memory/run_qa.sh /bin/bash -c 'cd taiko_viewer && node --experimental-strip-types --test --test-concurrency=1 tests/growthRequestEvidence.test.mjs tests/growthPipelineParity.test.mjs tests/growthCalendarParity.test.mjs tests/dailyProgress.test.ts tests/growthHistory.test.ts tests/growthMeasurements.test.ts tests/growthPassport.test.ts tests/growthRecent.test.ts'
bash scripts/memory/run_qa.sh /bin/bash -c 'cd taiko_viewer && node scripts/performance/benchmark-growth-request.mjs /var/tmp/growth-request-audit mixed invalid boundary truncated iso-full local-full no-baseline'
```

## 当前验证阻断

已尝试 `bash scripts/memory/run_qa.sh /usr/bin/true`，退出1：`System has not been booted with systemd as init system (PID 1)` / `Failed to connect to bus: Host is down`。

遵守 `AGENTS.md` 与 `docs/memory-engineering-guidelines.md`：隔离失败不能无界回退。因此没有执行Node测试/基准、没有测得ms/RSS、没有重跑旧365天样本。旧12,834.76ms只作为旧管线记录，不作为本补丁的基线。本草案代码/测试未经运行，仍可能需要修正；没有修改版本或部署，也没有修改隔离脚本。
