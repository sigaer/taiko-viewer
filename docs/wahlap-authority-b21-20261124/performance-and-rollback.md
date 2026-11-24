# Performance and rollback report

[实际测量](consistency-performance.json)在内存隔离 QA 中使用安装后的 Python Bot/Core 和实际 Node read adapter / UGC loader。Snapshot 36,435,443 bytes，2,993 首、14,965 个槽位。测试使用独立 owned root；无生产服务器压力实验。

最终实际构建 2.359 秒；Python 冷读 1212.2 ms，30 次缓存读取中位数 0.058 ms；Node 冷读 569.0 ms，缓存读取中位数 0.331 ms。激活 1631.0 ms、回滚 1314.5 ms。受 2 CPU cgroup、磁盘与系统缓存影响，不能当生产 p95 SLA。

在 owned root 安装完整 Snapshot 和一个合成第二 generation，实际激活、模拟抓取失败、确认 pointer 原字节未变、回滚到已校验旧 generation，验证第二版本仍保留且 catalog.json link count=1。激活/回滚包含完整大文件读取校验，不仅测 rename。没有使用真实 Catalog 或业务数据做回滚。

切换前读取确认 schema=1、policy=wahlap-cn-1、revision、SHA、size；同 revision 异内容拒绝。atomic pointer fsync/rename 保障完整可见；不承诺多个并发 writer 的先后顺序。部署必须落实单 writer 调度。

缓存以 revision/PV 标识，正在处理的旧请求可完成旧 generation，新请求读取新 pointer。这是有意的请求隔离，不在一个结果中混用两代。远端 manifest/download 期间切换由 revision-bound endpoint 返回 409；远端保留 LKG 并重新取得 manifest，不本地重算 policy。

允许的未来回滚操作仅切换候选 Catalog activation pointer 到兼容已验证版本，并观察 consumer health；它不恢复 Publication，不回填 Measurement，不修改真实成绩。源码部署与 Catalog 激活应分别具备可审阅记录，本批都未在生产执行。

Viewer build 使用现有 memory build wrapper 的 cgroup/锁，仅运行 `npm run build`。用户本批明确禁止部署，因此未调用会产生部署副作用的标准 deploy script；这不是生产发布完成的证据。
