# Updated roadmap and release gates

本批交付候选实现、可追溯制品、隔离测试和调查报告。没有把候选源码迁移写成生产已迁移；没有执行发布、推送、部署、数据修复或 Measurement 回填。

| Gate | 状态 / 后续 |
|---|---|
| 单一国行权威 | 已实现：完整 Wahlap Song API → 中央 Builder → immutable policy snapshot；无其他曲库 fallback |
| 494 引用审计 | 494/494 有逐项 disposition，187 文件；295 个 runtime port 引用、5 个纯展示 DTO 引用已收敛；其余兼容、草稿、元数据、配置和工具单列，不伪称 494 个独立运行调用均已执行 |
| 旧规则 | 活动 CN 链路使用中央 flags/masks；旧 Core profile、Contract serializer 和 metadata producer 仍有旧字段处理，明确不具当前 CN 权威；详见矩阵 |
| Request revision consistency | Node H3 request / Python handler pin，Python child 显式 revision；跨消费者全量比较及变更期间隔离测试通过，结果见 acceptance.json |
| 跨实例 rollout | **待批准**：中心 Bot/Viewer 配同一 root；远端先支持 schema/policy 并同步，观察 health 的实际 consumer revisions。不能宣称全局跨机原子事务 |
| 单 writer | **部署前确认**：现有 daily job 的单实例调度锁；atomic pointer 不是多 writer 顺序仲裁 |
| 完整官方抓取 | 当前已验证 1323 分类行/1128 unique + 空终止页 + 单页交叉检查；官方无事务游标/独立 chart release/明确 rate limit，保留这些边界 |
| LKG / stale | 已实现并验证；失败不自动下架、不退其他曲库。运营需明确更新频率及 stale age 告警；不是凭旧 open_day 自动刷新 |
| Client dependency | 已收敛到含完整 Center/Client 接口的 Core；真实安装桥接目标 27/27，以验收记录为准 |
| TJA capability | 1387 张有逐特征状态；坏谱隔离。OFFSET 绝对音乐对齐、动态 LEVELHOLD、部分 Scroll/Balloon 和 pattern 仍未验证/未提供，不是整个 Catalog 的阻断门槛 |
| Publication | **未解决的数据完整性风险**：1 个 current 绑定、同 inode 硬链接、hash/size 不符；writer UNKNOWN。不得把本候选发布视为修复了原对象。后续独立证据与恢复审阅 |
| Measurement | 14 次已确认为 reader rejection，非已证实 SQL 写失败；历史 scoreRevision unknown。未来分阶段 trace 已实现；零样本契约修复或回填需独立方案 |
| Production acceptance | **未执行、等待验收**：生产只读 smoke、真实客户端同步、容量与告警评估、运维 rollback rehearsal 均不能由 QA 根目录测试代替 |

下一批优先顺序：先审阅 Catalog/RC 与 rollout 配置；单独处理 Publication 的写入口及恢复方案；单独确定零样本 Measurement 的产品语义；再按特征补绝对对齐、Balloon、Scroll、动态分支和人工 Golden。无需等待全部 TJA COMPLETE 才迁移已验证功能。

既有 Taiko Domain Knowledge Primer 保留在 [docs/domain/taiko](../domain/taiko/README.md)，官方规则、项目约定、经验和假设继续分级。新增 Wahlap 权威约定见本批 Source Contract；本批没有实现 Taiko Agent、推理模型或新的推荐算法。

执行方式：原生 subagent preflight 返回缺少实际工具，未将其推理冒充执行；Lead 独立 worktree 承担全部源码、数据只读调查、集成和验收。无多个 Agent 并写同一文件。共享 schema/policy 由 Lead 在消费者迁移前确认，迁移计划保留。

保留 Correctness Repair Viewer26930740/Bot62c4d3e、Batch 2 Viewer6af2a292/Botcda0a85/Core52909ec。原工作区未 stash、reset、clean 或覆盖。所有本批 commit 只在隔离本地候选分支；不推送、不合并 main、不创建正式 Release、不部署。

Viewer RC1 build 在准入恢复后通过；RC2 原字节传输修正的 Node/HTTP/远端 SHA 验证通过，但完整 build 又被内存准入阻断。未调整守门条件。RC2 build 是当前技术验收的剩余阻断；生产 HTTP/容量/运维 rollout 与数据恢复仍未执行。位序、定数、指标、历史 alias 及错误特征 schema 的额外收敛也有已安装制品测试。
