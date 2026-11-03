# Writer Reader 与数据源清单

G1 = BLOCKED。此表不是“生产全部writer已登记”的声明。SOURCE：当前Viewer源码，旧[来源审计](../growth-history-read-model-audit.md)，0.81.7/0.81.10版本报告。当前源码为E1；外部运行拓扑主要为HISTORICAL_ONLY，CONFIDENCE MEDIUM。

| 路径 | 输入→输出、锁/提交 | 身份/历史/恢复 | 当前证据 |
|---|---|---|---|
| Viewer edit/create | songs.ts→shared.writeUserdataWithHistory；读改写C，rename C，直接write H | 当前绑定；无C/H journal，edit/create未包进程内锁 | E1当前，DATA-01 |
| Viewer import | songs.ts import使用Promise Map锁→C/H | 锁仅单进程，导入不等于新游玩 | E1调用点+旧审计 |
| Kinoko score/history | sync.ts/kinoko-history；C/H或历史批次 | 回填provenance、批次非单事务 | 当前运行状态UNKNOWN；旧审计 |
| Manual/lifecycle | manual、bindings、Goal lifecycle；文件+DB | 手动分数不当真实游玩；跨介质恢复需验证 | 部分E1，完整端到端UNKNOWN |
| Wahlap/Hiroba | 外部save_userdata→C/H | 历史审计无共同commit；当前外部版本未核对 | HISTORICAL_ONLY |
| Dispatcher/proxy | sync receiver/Python转存→C/H | 多目标部分成功、观察重复；非文件提交证明 | 服务active；代码版本与覆盖UNKNOWN |
| merged | 外部merged_bind重建虚拟C/H | 历史审计指出先删历史再重建；不是原子批次 | HISTORICAL_ONLY |
| maintenance/repair/cron | 覆写、删除、回放、替换来源 | 登记、维护门禁、备份与回退未知 | UNKNOWN，不推定不存在 |
| 每日能力存档writer/backfill | 外部snapshot writer→daily-ability-v1-top20.json及其他namespace | 0.81.7报告称文件锁+fsync/replace、旧日冻结、一次补齐 | 版本报告；外部实现/运行版本未复核 |
| Viewer measurement | account/growth→measurements SQL | owner/binding INSERT SELECT；旧scoreRevision和已记录历史日保护；存在日存档时跳过写 | E1当前；SQL行为已改变 |
| Goal | evaluation-store事务→web_player_goals | user→binding→goal行锁，确认时间不等于游玩时间 | E1当前，历史SQL验收 |
| Recent cursor | recent ack服务→独立cursor | 预期绑定隔离/CAS；完整当前负例未测 | 路由身份检查E1，其余UNKNOWN |
| Growth Reader | overview/history/recent/weekly/passport | 文件回放+当前C+catalog+DB事实；Passport请求内复用带stat验证 | E1当前；不提供源事务 |
| 年度/bot/后台消费者 | 源快照/存档→报告/图片/缓存 | job与授权、source lease、并行读取纳管未核齐 | UNKNOWN |

C = `<userdataDir>/<taikoId>data.json`；H = `<userdataDir>/<taikoId>/data_*.json`。仓库服务配置指向外部共享userdata目录，但实际配置未完整核验。不扫描用户文件。

Finding INV-01：severity UNKNOWN，status UNKNOWN。缺所有服务版本、远程targets、定时维护、日存档写入者、历史删除和恢复工具的完整运行态清单，以及每入口写入次数/监控覆盖。下一轮先取得去敏服务清单及人工维护入口登记；不可仅rg无结果就宣称封闭。成本低频只读元数据+跨仓库源码审查，不导入Python模块、不读凭据。Owner决定跨仓库审计范围；失败维持UNKNOWN。
