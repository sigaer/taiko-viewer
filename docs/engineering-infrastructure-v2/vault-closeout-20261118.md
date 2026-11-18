# QA Vault 一次性清理 · 2026-11-18

用户明确授权后，对已结束 QA 的可再生证据生成精确清单并复查进程/FD/cgroup、
服务和路径身份；不要求历史 creator metadata。未改服务或定时器。

- allocated：7496019968 → 2574348288 bytes（6.98 → 2.40 GiB）。
- 删除 2050 项，allocated 4922580992 bytes（4.58 GiB）；完成时文件系统 free 40733822976 bytes。
- runs scratch 原有 8192 bytes；runs evidence 原有约 2.39 GiB。未动活动任务状态。
- 保留约 858 MiB 的旧构建源码/依赖：p0-0.83.1 工作树的 node_modules 仍链接至该依赖树；源码保留。
- 两套 runtime-manifest 指定 Python 环境约 795 MiB；账号安全及 SSR 调查证据约 250 MiB；锁定 wheelhouse/工具及小型结果索引保留。
- 没有通过复制大型文件转移占用。截图、构建原件和完整旧日志不再保证可复验。

私有索引：`/home/sigaer/taiko/qa-vault/EVIDENCE-RETENTION.json`；精确计划、逐项删除
journal 与结果在 qa-14600655c2ef。清理脚本 4 项安全测试通过（qa-1f8309622bf9；最终源码复测 qa-68c6a0f98af6）。
早期只读扫描因短暂消失的 cgroup 及低效引用查找修正；压力/互斥不足的尝试返回
75，未删除；实际 apply 只有 qa-14600655c2ef。历史小型结果、提交 SHA、资源
峰值、关键诊断摘要保留；verification JSON 已标记原始归档不完整。
