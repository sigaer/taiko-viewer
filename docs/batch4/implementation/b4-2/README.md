# B4-2 Multi-Goal Portfolio

候选基线 `a08f5a97812962d00fe8cc92192fc3b38b86d142`；分支 `candidate/viewer-multi-goal-b4-2-20261125`。Viewer 版本 `1.21.0-rc.1`。

交付链路：在首页或成长档案创建多个独立目标 → 保存各自 Baseline/Binding → 独立评估 → 暂停/恢复/取消/排序/优先级 → 完成历史与成长事实展示。V2 为唯一写入源；未迁移 V1 保留原行为。

- [Schema 和迁移](schema-and-migration.md)
- [Store、CAS 和幂等](portfolio-store-and-cas.md)
- [生命周期](goal-lifecycle.md)
- [独立评估与同步](evaluation-integration.md)
- [API 和兼容](api-and-compatibility.md)
- [产品界面](ui-delivery.md)
- [实际测试证据](targeted-test-results.md)
- [限制](known-limitations.md)
- [验收](acceptance.md)

长期规则已写入 [Viewer Development Principles](../../../viewer-development-principles.md)，根 AGENTS.md 增加入口，原 Annual Poster、安全、内存和发布规则保留。

执行说明：尝试按三个独立 worktree 分包给原生子代理；三个子代理均报告无可调用工具，未修改文件、未提交。全部代码及验证由 Lead 实际完成，未把设计审查当执行结果。未读取真实玩家文件、未连接生产数据库、未部署、未建 Release、未合并 main，未访问另一设备的 Taiko Agent。
