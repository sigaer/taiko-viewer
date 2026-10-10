# 成长档案请求性能修复 — 0.81.10

日期：2026-10-10（Asia/Shanghai）。基线：`a5aaf45` / 0.81.9。

本次继承 codex 审计分支，并将默认关闭的草案改为默认启用、请求内校验文件变化的复用。不是直接打开旧草案的固定快照开关。

## 行为与实现

- Passport 在首次装载前后记录历史目录及选中文件的设备、inode、大小、纳秒 mtime/ctime；History 再次请求时重新校验。追加、删除、替换、同长度改写、恢复 mtime、短暂增删后恢复文件名集合都会使复用失效。
- 元数据读取失败、历史读取/解析不完整或加载期间发生变化时，不保留该结果；下一次调用重新读取。重新装载不加入较早的全局 in-flight 请求。不同账号不复用，独立 HTTP 请求不保留已完成缓存。
- 文件内容每批最多预读 8 个，解析、来源排除、状态推进和快照顺序保持串行。stat 并发最多 8。来源检查与状态构建合并为一次谱面遍历，未变化记录跳过数值退步检查。
- 日期转换、时间戳解析只在一次回放/装载中缓存，每个 Map 上限 4096 个字符串；非字符串走原转换。日历事件按日期建立索引，避免每个日期重新扫描所有事件。当前成绩、能力归档、冻结 measurement、Goal 确认与 Daily/History 独立投影规则保持原样。
- 没有新增用户可见文案或 HTTP 开关。版本投影来自 package.json，package-lock 同步为 0.81.10。

这些检查依赖本机文件系统提供的 inode/ctime，不是跨文件写事务、写入锁或新的 writer 协议。并发写入期间原有逐文件读取仍可能观察到不同写入时点；本次确保不会因为请求缓存而持续使用已检测到的旧历史。没有扩大为跨请求数据缓存。

## 验证

所有执行均通过未修改的 `scripts/memory/run_qa.sh`，没有连接生产 DB 或读取真实用户历史。

- 182 项回归通过，0 失败：Daily replay、History、Recent、Weekly、Passport、账号切换、冻结能力、30/90/180/365 周期、版本投影与路由约束。
- 新增服务级测试覆盖 Overview 与 History 之间同步成绩、装载期间新增、删除、同尺寸恢复 mtime、atomic rename、目录短暂增删、stat 失败恢复、坏文件重试、不同账号隔离及共享输入不被修改。
- 基准的 before 不会偷偷使用优化后的回放：`tests/fixtures/passport0819/` 固定保存了 0.81.9 的 evidence、dailyProgress 和 Passport service；仅 DB/Python/catalog 等外部依赖使用匿名适配器，最终 DTO 不 mock。
- 7 类样本 × before/after × 3 次，各次为独立进程、交替执行，共 42 次。每类完整 Passport DTO SHA-256 全部相同。健康大样本历史读取/JSON.parse 从 4000 降至 2000；坏文件路径保留重读。

## 同机匿名离线请求耗时

单位 ms，中位数；文件系统页缓存未清空，不称为冷盘测量。

| 样本 | 0.81.9 | 0.81.10 | 减少 |
| --- | ---: | ---: | ---: |
| mixed | 59.58 | 45.98 | 22.8% |
| invalid | 62.03 | 51.71 | 16.6% |
| boundary | 41.23 | 41.80 | -1.4% |
| truncated | 1088.26 | 457.07 | 58.0% |
| iso-full | 19510.18 | 4705.70 | 75.9% |
| local-full | 12238.45 | 4970.23 | 59.4% |
| no-baseline | 69.62 | 40.69 | 41.6% |

完整逐样本结果和生产源文件 SHA-256 见 [JSON](growth-passport-request-performance-08110.json)。ISO/full 和 local/full 均为 2000 个选中文件 × 500 谱面；另有一个文件因原有 2000 上限截断。优化后的大样本进程最大 RSS 约 437 MiB（含测试转译与适配器），不是生产服务总内存。

两个大样本各有一次超过 5000 ms：ISO/full 5253.2 ms，local/full 5444.3 ms。只能确认显著改善，不能据此声明所有请求通过 5000 ms Gate。SQL、外部 Python、真实账号数据和浏览器可见时间不在离线计时中。旧的 365 天原始事实成本探针与当前 90 天事实服务不属于同一实验，不据此改写旧 Phase/Read Model/Temporal UX Gate。

最终代码另跑原 365 天事实管线探针：ISO/full 5151.43 ms、local/full 4440.67 ms，均超过原 3000 ms 预算，启动器退出 2；不是执行中断或 OOM。两个进程分别约 441/437 MiB，high/oom/oom_kill 增量均为 0，kernel cgroup peak 不可读。上述旧预算保持未通过，本次不扩大为历史 Read Model 重构。

`readMs` 是并发 readFile 的累计耗时，不能与 loader 相减作为独占 CPU 时间；`readBatchMs` 才是预读批次墙钟时间。`dailyMs` 已包含在 `rangeMs` 中，不能重复相加。

## 清理与发布范围

已删除 Viewer 的 `feat/p1a-cross-writer` 本地分支、origin 分支及干净工作树 `/var/tmp/taiko-p1a-forum`。该分支未合入 main，所以 main 没有需要反向撤销的 P1a 实现。其他仓库和原有未跟踪文档不在本次删除范围。

发布只能通过 `scripts/memory/run_build.sh` 包装的 `scripts/deploy_forum_web.sh "<HEAD subject>"`。代码版本为兼容性能修复，使用 patch 版本 0.81.10。
