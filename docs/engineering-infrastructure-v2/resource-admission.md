# Resource Admission & Concurrency — 2026-11-17

范围：独立基础设施分支；不改生产服务、不安装系统脚本、不改 slice 层级。

## 原锁审计

| 入口 | 原持有期 | 保护对象 | 不必要的冲突 |
| --- | --- | --- | --- |
| run_qa.sh → qa_vault.py | 整个任务，最长 15 分钟 | QA 总内存、临时目录 | 所有 QA、Build、Dev、Cleanup |
| run_build.sh | 整个构建，最长 30 分钟 | 构建资源 | 独立小测试、Cleanup |
| run_dev.sh | 整个服务器，最长 4 小时 | 开发资源 | 所有其他任务 |
| tmp_cleanup.py | 完整扫描与删除，最长 10 分钟 | 文件删除 | 无关工作树任务 |
| deploy_forum_web.sh | 整个发布 | 同一生产输出、PID 文件、输出切换 | 应保留此互斥 |

全仓搜索确认前四个入口使用 `/run/lock/taiko-memory-qa.lock`；qa_vault 原来
通过继承 fd 间接持锁。Annual 的 generator/renderer 元数据锁为短事务，
monitor 单例锁独立，均保留。原 build 表达式读取 `/proc/meminfo` 的 KiB，
`5*1024**2` 实际是 5 GiB；新实现统一字节，明确安全余量与任务预算。

## 实现与资源

全局锁现在只保护登记、资源检查和原子发布。登记包含所有要求字段，另有
boot ID、PID/starttime、port、slice。静态任务可同工作树并行；可变任务以
规范化工作树互斥；Dev 要求显式端口；独立工作树共享 QA 3 GiB 总预算。
Build 同时仅一个，4/5 GiB，4096 MiB Node heap，与小型静态任务可并行。
Cleanup 改用独立删除锁。没有降低既有父级 6/8 GiB 总限制。

Annual 与构建启动的竞态由短启动屏障关闭：读取现有 running ticket，
持 generator/renderer 锁直到新 build cgroup 可见（最多 5 秒），随后立即
释放；运行时仍由 Annual 既有 build-pids 门禁保护。不会持锁覆盖构建生命周期。
独立构建保留既有部署互斥，标准部署脚本的执行和产物切换逻辑未改。

采样主机约 30.6 GiB RAM、8 CPU，开发 slice 当前约 161 MiB。
保留 25% RAM + 1 GiB 内核/管理余量；计入未消耗的任务预留，检查 PSI、
swap I/O、父/子 cgroup 和磁盘。拒绝 exit 75，包含具体原因。短事务最多
等待 500 ms，避免正常的毫秒级竞争误拒绝；不做无限重试。

## 验证

- 52 项 Python 回归通过（准入、Vault、清理、取消标记）。
- 真实静态任务 qa-358383441092 / qa-cf8e076fc733 同时开始，差约 11 ms。
- qa-3603beb7ddbd Build 与 qa-642ea1d366b1 static 重叠。
- 第二个 Build qa-426e846c6a4c exit 75：生产目标构建锁已持有。
- qa-2aba24058c58：真实并发、正常释放、systemd 2 秒超时、supervisor
  SIGKILL 后保留活跃 cgroup 预留、cgroup 3 秒期限退出后回收，全部通过。
- 重启/boot ID、PID 复用、过期、QA 总量、父 slice、主机/PSI/swap/磁盘
  拒绝由单元测试验证；没有为验证重启宿主机。
- 一个早期 smoke 因短锁立即失败而失败，修复后重跑通过；另一次正确识别
  外部旧版维护锁而拒绝，没有杀掉持锁进程。

原始输出和 cgroup/RSS 样本保存在 QA Vault 对应 run/evidence。
本提交是可审查源码，不代表主机所有旧入口已升级。新旧 wrapper 并行迁移
需先结束旧任务；本轮不替换已安装服务。回退先等自有 cgroup 退出，再
revert 本提交；无需数据库操作、生产重启或产物切换。

实测补充：QA slice 在 pids.current=0 时仍有约 290 MiB 历史缓存/内核收费。
把单任务 Max 直接设为整个 QA slice 的 3 GiB 会被正确但永久地拒绝；
因此单任务 QA 调整为 High 2 GiB / Max 2.5 GiB，1536 MiB heap 不变，
为测得残留向上取整保留 512 MiB。QA slice 仍为 2/3 GiB，没有改父级层级
或绕过实际收费；需要更大任务应使用独立 build 预算。

后续盘点发现 idle QA 收费可增长到约 535 MiB，不能把它当作永久任务预留。
最终控制器始终记录 slice 的真实 memory.current，但容量准入按活跃任务与
未知活跃 unit 的 MemoryMax 预留；已退出 unit 的共享缓存不产生永久 lease。
主机 MemAvailable/PSI 与原 slice MemoryMax 仍生效，不执行 drop_caches。
未知 direct development.slice 进程拒绝准入。单任务 QA 仍保持较保守的 2.5 GiB。


最终回归补充：qa-ec89de262b97 的 52 项通过，与真实私有 SQL QA
qa-e8d82e74af95 同时准入；该 static 准入锁等待 0.0048 ms、持有 0.558 ms，
不覆盖任务执行。qa-dbc5115200bb 真实并发 smoke 通过，新增 QA 2.5 GiB
加外层 static 0.5 GiB 后，再申请 static 明确 exit 75，且未启动子 cgroup。
正常结束、超时、supervisor 崩溃后的 lease 均按 cgroup 生命周期释放。
未知活跃 unit 按其 MemoryMax 和 CPU quota 预留，避免旧入口漏计资源。

真实 Dev qa-4984566c9345 通过：127.0.0.1 HTTP、登记端口/cgroup、重复端口
exit 75、10 秒硬期限后监听和 lease 释放。首次 qa-bf50b4a4ff1c 的最后断言
误把 TCP TIME_WAIT 当成监听未释放；改为连接探测后重验，没有修改生产服务。
静态准入与 Dev 同时进行的盘点也完成，未被全局任务锁串行化。

最终整合回归为 57 项（qa-dd112d43ed79）。同一窗口还并行准入了完整盘点、
Phase 0 静态测试和页面像素比较，共四个 static 任务；像素比较按实际差异退出
1，资源调度没有将它错误当成互斥冲突或吞掉失败。Phase 0 test:ds 85/85 与
check:ds 通过（qa-f7f06191dd66）。没有额外提高 slice 或 Node heap。

收尾验证：qa-9dc7a68c796d 最终 58 项全部通过，与回退截图比较同时准入。
登记簿最终为空，taiko-qa-* 无 running unit，测试端口 35251/35252 无监听。
没有改动安装的生产 wrapper、systemd slice 或服务；此分支等待审查后再决定推广。
