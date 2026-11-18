# Temporary Storage Governance — 2026-11-17

2026-11-18 保留策略更新：下文归档数量为历史记录。可再生原件已按授权清理，
不再宣称完整原件可复验；当前索引与占用见 `vault-closeout-20261118.md`。

本轮先完成只读盘点，再修改清理规则。没有批量删除历史目录。

首轮 190 个路径约 6.17 GiB allocated；补充 /tmp 引用、FD 与 systemd 配置
扫描后 191 个路径。完整逐目录 logical/allocated bytes、entry count、最早/最近
mtime、工作树、UID、进程引用、打开文件进程、服务配置、分类及未知所有权状态
保存在 `/home/sigaer/taiko/qa-vault/runs/qa-09418b3d54f8/evidence/inventory.json`。
原始路径包含其他任务信息，不复制到公开 Git 文档。只读盘点脚本可重复执行：
`TAIKO_QA_PROFILE=static bash scripts/memory/run_qa.sh /usr/bin/python3 scripts/memory/inventory.py`。

| 较大目录 | allocated GiB | 处置 |
| --- | ---: | --- |
| taiko-resource-backfill | 2.203 | 无完成/所有者证明，保留 |
| ds-phase0-schema-20261117 | 0.865 | Phase 0 工作树与证据，保留 |
| viewer-nav-1102 | 0.836 | 无完成/所有者证明，保留 |
| taiko-b30-performance | 0.494 | 有引用，保留 |
| pjsk-fps-release-20261116 | 0.444 | 非本任务且未到期，保留 |
| taiko-build | 0.253 | 没有逐项任务完成证明，保留 |

这些目录不是全盘占用主因。盘点时文件系统约 314.85 GiB、可用 34.44 GiB、
使用率 89%。未以扫描无引用替代所有者、任务完成、源码状态和证据保留确认。
因此旧目录批量回收处于 `BLOCKED_UNKNOWN_OWNER`，释放历史空间为 0。

新任务将 scratch 与 Vault 分离：`/var/tmp/viewer-task-qa-<id>/scratch`，
任务根记录身份、PID/starttime、boot、期限、状态与 Vault 指针。正常结束先
确认 cgroup 退出并归档证据，再扫描外部进程引用。遇到打开的 FD（包括宿主
安全扫描器）只保留此目录，不停止扫描器。使用 fd-safe rmtree，只清自身目录。

异常任务 fallback 只回收有有效 creator metadata、owner 已退出、cgroup 已空、
完成/期限后超过 24 小时、无源码工作树和引用的任务。删除前重新扫描引用及
验证 dev/inode、mtime/ctime 和整树元数据签名。旧目录不能仅凭年龄自动升级
为已确认垃圾。Cleanup 独立锁；源码单元仍使用既有 128/256 MiB、50% CPU、
10 分钟限制。没有替换线上已安装的清理服务。

容量政策依据本机 315 GiB 卷、6.17 GiB 已盘点产物与保留需求：保留至少
5% 卷容量（约 15.7 GiB，且不低于原 5 GiB），所有 active scratch reservation
合计最多 8 GiB。static 256 MiB，QA/browser/dev 2 GiB，build 4 GiB；对应超时
15/15/240/30 分钟。8 GiB 是可审计初始容量上限，不是已测出的满负载容量。
日志每任务 64 MiB，必要证据独立保留；既有证据不自动过期。未知旧数据继续
保留，已确认构建缓存原 7 日、日志 30 日政策不据此授权删除未知数据。

可用空间扣除预留不足 floor 时，大型新任务 exit 75；不靠无限重试挤入。
优先级是无引用且确认完成的构建缓存、过期 owned scratch；源码/活动工作树/
必要证据不参与容量回收。没有生产数据删除、数据库操作、服务重启。

验证：原 Vault/清理安全测试、新 scratch aggregate 拒绝测试、真实外部 FD
保留及关闭后自清理测试通过。正常任务目录删除，日志仍可从独立 Vault 读取。
异常任务由硬期限与下次扫描回收；留存状态可审计。回退本提交前先结束新任务，
保留 Vault 与尚有引用的目录；不需要恢复或移动生产文件。

最终并发盘点 qa-dd797071d3bf：198 个路径，allocated 7.307 GiB，卷可用
35385270272 bytes；增量含本轮构建/浏览器证据。报告增加精确 file/directory/
symlink 数量、可识别 creator metadata，修正系统进程 cwd=/ 被误列为所有目录
引用的问题。首次并发盘点 qa-d8d1446181d0 遇到另一任务正常自清理导致路径
消失；改为记录扫描变化并继续，重跑通过。此修正没有放宽删除资格。
删除前重新检查进程及新服务/fixture 引用，晚发生的扫描预算失败会保留已经
完成的删除记录；52 项回归包含这两项。最终仍没有删除未知历史目录。

范围限制：scratch 限额监控 runner 提供的 TMPDIR；既有工作树内 .nuxt/.output
由创建任务在证据归档后清理，不是文件系统级全路径配额。本轮未安装定时器或
替换已安装 libexec，部署该基础设施需后续独立审查。Vault 的既有证据不会仅因
磁盘水位被删除；需要另行确定证据保留/销毁政策才能回收它们。


发布临时目录的源码入口也纳入治理（未执行部署）：deploy_forum_web.sh 只改
临时目录/日志创建与清理调用，切换、提交、推送、重启逻辑未动。通过新 runner
运行时使用其 scratch/release，直到整个子 cgroup 退出后由 runner 归档/清理；
直接调用兼容路径使用独立 viewer-task-qa-<id>/scratch，记录真实 creator
PID/starttime、目录身份，保留 64 KiB 日志尾，扫描外部 FD 后清理；被引用则
保留并由现有 24 小时 fallback 接管。不是通配符删除或移走服务文件。
56 项回归 qa-a269dce9cc0e 通过，新增 release scratch 的委托清理、独立清理、
打开 FD 保留/释放、拒绝陌生路径。后续引用扫描出现任务正常结束的 ENOENT，
修正为跳过已消失的目录，权限失败仍停止；补充回归与全盘点在最终记录中列出。

最终完整盘点 qa-e7f4129b41f4 通过：217 个现存路径，逐路径 allocated 合计
11.907 GiB，可用 35380404224 bytes。范围补充了 /var/tmp 外的独立工作树及
旧 Vault/runs/*/scratch，不扫描/删除 Vault 的持久证据和安装工件。57 个列出
但已不存在的工作树/并发自清理目录单独记录，未执行 git worktree prune。
完整清单仍只在私有 Vault。总量增加主要来自补全盘点范围，不能当作磁盘新增量。
57 项最终基础设施回归 qa-dd112d43ed79 全通过；部署 shell 的 bash -n 通过。

最终安全回归 qa-9dc7a68c796d：58/58，通过新增 creator cleanup 的服务引用检查、
内部 scratch symlink 不误保留、外部引用仍保留。清理前 dry-run qa-e63d4bd20d1a
确认逐文件归档、工作树身份/状态及无引用；apply qa-1842af427b5e 再次校验后
移除本轮 baseline/final 两棵独立工作树、构建恢复根及候选 .nuxt/.output。
回收 allocated 1234755584 bytes（约 1.15 GiB）；卷 free 34004312064 →
35239546880 bytes（同时存在其他主机活动，不以 free 差替代逐项统计）。没有
删除历史未知目录，历史回收量仍为 0；没有 prune 其他任务的工作树登记。
652 文件/70289601 bytes 的原始日志、截图、失败结果和 harness 已归档至
`/home/sigaer/taiko/qa-vault/runs/qa-1160a6030e71/evidence/delivery/`，manifest.json
含逐文件 SHA-256。私有盘点见 qa-e7f4129b41f4；不把完整进程/路径清单提交 Git。
原 Phase 0 IDE 工作树保留；基础设施源码工作树在提交/推送结束前保留。
