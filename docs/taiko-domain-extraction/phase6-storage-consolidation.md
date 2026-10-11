# Phase 6 — Storage and Writer Consolidation

状态：IN_PROGRESS。Phase 5 0.81.11 已通过标准部署与线上只读验收。本阶段执行顺序为 ownership → publication/recovery（P1a 输入一致性）→ Read Model → Database 决策复核 → 跨仓库发布/恢复验收。这里的步骤编号细化 Execution Plan v2 的四项内容，不另行套用历史 P1/Annual Gate。

## 6.1 Ownership 复核与选择

成绩的定义来自冻结 Contract/Core；来源获取、凭据与授权属于 Adapter/Infrastructure。平台 current 是可编辑的最佳成绩集合，H 是 full/delta 观察证据；不是官方逐次游玩账本。Viewer 保留 Goal/Growth 产品事实定义；不能把 acquisition 时间改成游玩时间。

| 数据/入口 | Owner 与实际写入 | 纳管要求 |
| --- | --- | --- |
| Wahlap / Hiroba current+H | 中心 `userdata_storage.save_userdata`；两种来源共用 helper | 前态、Web song locks、delta 与提交须处在同一跨进程锁内；保留 profile/source/hash 语义 |
| Viewer edit/create/import | `shared.writeUserdataWithHistory`、`utils/account/songs` | edit/create 当前无完整 RMW 锁；同秒 H 名称可重用；统一提交接口 |
| Viewer manual create/rename/score/delete | `utils/account/manual` | score/rename 的进程内锁不跨 Python；账号删除也须纳入 fence/recovery；账号授权仍归原 owner |
| Kinoko current/history | `utils/account/sync`、`internal/account/kinoko-history` | 现有批次逐文件发布；history 与 current 纳入一个提交，保持 import 排除与幂等 |
| dispatcher local target | **实际** R `scripts/sync_dispatch_server.py` | R 比 A 多 Wahlap refresh/错误处理；不得用 A 旧文件覆盖真实行为；避免拿较早读取结果覆盖刚更新 current |
| 中心 u0 merged | `plugins/utils/merged_bind` | 派生 source identity；全量 delete/rebuild 改为可恢复批次；源成员读取须一致 |
| taiko-bot cache / u0 | B userdata_provider / merged_bind | 本地派生读取缓存，不赋予中心 Writer 权限；保留现有中心 API 契约 |
| daily ability | Python daily_ability 的独立命名空间与 flock | 历史 measurement，不是可丢弃缓存；保留旧日冻结、当日代表更新与恢复范围 |
| SQL measurements / Goal / cursor / identities | Viewer / bot 各自 identity 与 product owner | 现有 DB 权威不迁移；read model 不拥有这些记录，不绕过删除/绑定验证 |

运行服务核对：Viewer 与 dispatcher 由 systemd 管理；NoneBot 由现有 screen/nb run 管理。Viewer 标准部署只重启服务，不复制 dispatcher 源码，因此 R/A 差异必须在本任务显式审阅、合并、同步与留档。storage_maintenance 对 userdata 列为 protected，现有 taiko_admin_backup 只备份其配置/管理表，不能冒称成绩恢复已覆盖。

### 存储选择

选择加强版 JSON：中心单一 Infrastructure publication 实现，跨进程 kernel flock 包住 read→mutation→commit；私有 immutable content objects、明确 pending journal、原子 committed manifest、兼容 C/H 投影与崩溃恢复。代码置于 Sakura 的中心 Infrastructure 包，**不进入禁止 filesystem/SQL 的 Core**。Viewer Writer 成为此实现的客户端；所有真正中心 Writer 采用同一协议。

P1a 在这里负责可信 input commit 与 reader view，不直接合并已删除的旧 0.80.0 实验。采用 immutable generation/source sequence，不能仅用 stat/mtime 判定 ready。现有 legacy 未纳管输入可以读取，但不能被标成已验证 read-model generation；激活必须有全部运行 Writer 覆盖证据。

Read Model 选择私有、可重建的文件投影，优先保持现有 90d fact / 365d measurement 的产品范围。score facts 保留全部现有字段与来源排除，Goal/measurement 查询时合并；未验证的新输入不返回静默 stale。先测全量冷建与已提交代查询，再据实决定是否需要 checkpoint/增量；不为追求速度修改事实定义。

数据库：继续现有 identity/Goal/measurement SQL 权威；本阶段先不迁全部成绩到 MySQL。理由是现有单机共享存储能提供线性提交与不可变读取，DB+外部 JSON 仍需 outbox，且无法替代 Writer convergence。此为明确选型，非遗忘 Database 项；最终根据资源、并发和恢复实测复核。若文件方案未满足指标，不提前 PASS。

### 后续验收

6.2 先用合成目录验证协议，覆盖跨进程 RMW、同时间 H、部分失败/ENOSPC、进程死亡、提交前后恢复、非法路径、不可变读取与恢复副本。6.3 再接全部真实 Writer/reader，保留 acquisition/merge/import Golden，封住普通 token 对任意私有 source 的读写。6.4 Read Model 做全字段 parity、提交/绑定/目录变更失效与百万记录资源测量。6.5 各仓库版本化提交、固定运行代码同步、标准 Viewer 发布与在线只读 smoke，并归档合成恢复演练及实际覆盖。Gate 6 当前未 PASS。

原有未跟踪 growth/release 文档与 test 属于用户工作，仅作为历史参考读取，不自动提交或视为本任务新要求。源审计不读取个人 userdata、不连接 DB。当前完成的是 ownership/选型步骤，不是 publication、Read Model 或生产 Gate。

## 6.2 隔离协议验收

中心 Infrastructure `taiko_store` 已完成不可变对象/manifest、kernel flock、pending journal、fsync、兼容 C/H 投影、崩溃恢复、shared lease、显式回收和有界本地 pipe。A 提交 `85c4251` / 9.81.0 已 push；19 项合成磁盘/真实子进程测试通过，含五个进程死亡点、双 writer RMW、ENOSPC、备份恢复中断、pipe EOF 与 collection fence。主进程/最大单 child max RSS 25,516/25,504 KiB，cgroup high/max/OOM events=0；未测进程树 peak、全量 IO、生产恢复或 physical power loss。 [证据](evidence/phase6-publication-protocol-validation.json)。

这是 ISOLATED_PROTOCOL_PASS，不是全 Writer 覆盖或 P1a/Read Model/Phase 6 生产 PASS。新包暂无运行入口引用，未同步 R、未部署、未读生产 userdata 或连接 DB，因此此次基础提交不重启 NoneBot。后续 6.3 接入真实 Writer/reader 时需统一激活和重启验收。协议立即 nonce retry 仅覆盖当前已提交请求，不承诺无限历史 receipt；legacy 未纳管输入不得标作 ready。

两次验证 harness 失败（缺少 `/usr/bin/time`、stdin 主文件不适合 spawn）已修正为磁盘 runner，并最终重新完成全部19项；未绕过 memory wrapper。用户的原有 miku/Web/未跟踪报告均未提交。

## 6.3a Viewer 本地 pipe 客户端

新增独立 Infrastructure client，实际启动中心 `taiko_store.bridge` 子进程，并在一个任务期间保留 kernel lease。原文用 stdin；消息/诊断/生命周期/清理均有限额，缺少 package 直接失败，不走旧 Writer fallback。6 项真实 Node↔Python 合成测试与局部 TypeScript PASS：current/H 单批次、读 lease 拒绝写、callback 错误退出、两个共享读者、缺模块与 deadline 后重新获取锁。 [证据](evidence/phase6-node-client-validation.json)。

此客户端尚无生产调用入口；实现作为本地步骤提交，随 Phase 6 实际接入与版本化 Viewer 标准发布一并推送，不以此子步骤冒称生产 Writer 已迁移。下一步为中心 score read view、全部 Writer 接入及授权 fence。


## 6.3b 首批真实接入与一致读取

中心 A `2d7bd9a` / 9.81.1 已 push：Wahlap/Hiroba 公共 save 入口完成整段 RMW 的 kernel fence，按 manifest 原文读取、成绩锁查询失败即停止、独立 H identity/sequence、current+delta 一次提交；与 `85c4251` 旧代码 Golden 比较 current bytes/hash 和 history payload，full/delta/锁定保留/删除不变。同一 clock 不再覆盖或把两个 observations 排反。Python reader 仅属于创建它的 lease；不能释放后复用。

Viewer shared Writer、account song edit/create/import 采用同一跨语言 fence 和暂存批次，回调完整成功后才提交。并发账户修改保留两者；晚发生的 SQL/业务失败补偿本请求新建的 lock，保留已有 lock；回执丢失时关闭原 child 后探测唯一 nonce，确认已提交便返回成功，不撤销已生效 lock。未知 outcome 不冒称 rollback；不声称 SQL 与 filesystem 构成跨系统事务。

Growth Overview/History/Passport/Recent 多文件产品读取及 request-local evidence reuse 持有一个共享 view。已纳管 current/H 从 immutable objects 读取，不受 compatibility projection 丢失影响；损坏 canonical object 返回明确 503，不变成 partial/空成绩。历史 invalid JSON 证据继续进入 invalid count；Goal/measurement/daily 产品含义不变。真实托管 fixture 的完整 Passport DTO 与旧实现 SHA 相同；独立同步在 Passport 读取期间等待，请求结束后下一次读取观察新 commit。Legacy 未接管兼容窗口保留其旧 stat/reload 语义；不能据此声称所有旧 Writer 已一致。

最终综合 Python 24 + Node 66、TypeScript，以及版本 projection 1 项均 PASS。250 ms sampled cgroup peak 293,720,064 bytes（约 280.11 MiB），42.213 秒，high/max/OOM events=0；非完整百万记录容量证明。早期一次旧 QA data URL loader 的累计模块字符串触发 Node 1536 MiB heap limit；改为磁盘临时 ESM 并清理后，在原限额重跑全套通过。两个 fixture 问题（继承同一个读 context、跨编译模块的 Error constructor identity）与一个 TS fixture 类型问题已纠正并记录；未绕过隔离。[证据](evidence/phase6-source-adapter-validation.json)。

Viewer 预备 minor 0.82.0，本步骤本地提交，待完整 Phase 6 标准发布 push/deploy。A/R 运行目录尚未同步，新 Writer 未激活；线上保持 Viewer 0.81.11 与旧中心 Writer。剩余 Kinoko 批次、manual 永久删除、实际 dispatcher、u0 与其他多文件 reader、私有资源授权、Read Model、全量成本/恢复及统一上线验收均继续执行；Gate 6 IN_PROGRESS，不把此子步骤当成全阶段完成。


## 6.3c Kinoko 历史批次与谱面 lock fence

Kinoko helper 通过同一 source EX scope 读取已有 H、识别 baseline/duplicate、逐对象暂存并提交。已有真实 import service 外层 current 合并复用同一个 scope，因此全历史与当前成绩只增加一次 source sequence；后续 merge/current/bridge failure 不会留下半批 H。Full/delta、同 timestamp 多 lane、原 filename/hash、import 排除、10,000 上限与 invalid legacy JSON 留存语义保留。Managed object corruption 明确停止 import。当前/历史两个 import 在获取 fence 后重查 binding id/source identity。

另把 SQL `setAccountSongLock` 放进 source fence；Python acquisition 在同一 EX lease 内读取的 lock 集合不再被该端点中途修改。Lock flag 单独变化不生成 score observation。账户 writer 获取 fence 后检查 binding id、taiko id 与 source，防止相同 row id 下目标身份变化。

最终 17 项 actual service/helper 回归通过（9 account、8 Kinoko），Golden 固定旧 `d337527` Kinoko 实现，比较全部 H 名称与 raw SHA/summary。综合 7.678 秒，250 ms sampled cgroup peak 100,519,936 bytes，high/max/OOM events=0。真实跨语言 bridge、实际导入算法与文件系统，DB 使用 allowlisted 内存 adapter；禁止网络，不是生产凭据/远程 Kinoko 或认证 HTTP 验收，也不冒称完整 server tsc。拆出复用磁盘 bundle fixture，临时文件清理。[证据](evidence/phase6-kinoko-adapter-validation.json)。

本步骤仍为 Viewer 0.82.0 的本地阶段提交，不提前标准部署；manual 永久删除、dispatcher/u0、其余跨文件 reader、私有 grant、Read Model 与最终恢复/发布仍未完成。线上版本/Writer 未切换，Gate 6 IN_PROGRESS。


## 6.3d 接入前发现：锁顺序与 manual lifecycle（待实现）

2026-10-11，在开始 manual 永久删除前复核真实调用链：`goals/service.writePlayerGoal` 的 `mutateGoal` prepare 与 `goals/evaluation.evaluateActiveGoalForBinding` 的 observe 现在在 SQL `web_user_accounts FOR UPDATE` 后调用 score snapshot。新 source Writer 先持有 kernel EX 再 `INSERT web_song_locks`；该表有 user FK，可等待同一个用户行锁，形成 SQL→source 与 source→SQL 的反向依赖。**所有需要 source 的 Goal mutation/evaluation 必须先获取 source read view，再进入 SQL owner/binding transaction；保持原来的 expected profile/revision/active-goal 校验和 Python compute 在 SQL transaction 外。** cancellation 无 source 读取，不额外加锁。上线前必须有真实 bridge 与事务顺序回归，不能仅凭普通 sequential tests 声称无死锁。

Manual 永久删除当前直接 rename C 与整个历史目录、吞掉 rename 错误，之后分别删除 locks、各 owner bindings/Goal/measurement/cursor、bot bind 和 account。Managed manifest 仍持有 C/H，故直接 rename 不能删除 canonical source。现有多事务循环还允许失败后失去请求者 binding，重试无法完成清理。manual rename/upsert/delete 的 owner 检查在 fence 外，等待后需重查，防止已撤销的 owner 修改成绩。

选型：保留 identity/product SQL 权威；manual lifecycle 以一次 SQL owner 清理事务配合可恢复 source tombstone 和 durable operation receipt/outbox，明确跨系统恢复方向，不冒称 SQL+FS 联合事务。Source EX → SQL owner/bindings 的顺序须统一，owner 撤销后所有普通读写 grant 拒绝，再完成/恢复 canonical C/H 清理。备份保持有界、私有、verified current/H，并覆盖独立 daily archive；错误不能吞掉。新 SQL receipt 是 Infrastructure lifecycle 记录，不是把 score facts 改成 DB authority；具体 schema/恢复 worker 要在 synthetic 与实际 `_test` DB guard 下验证后才采用。此处为已完成源码审阅与自主技术选择，**实现、故障验证与生产激活均待执行**；不能 PASS 6.3d/Gate 6。

服务复核：Viewer PID 1063394、sync receiver PID 1063408 仍 active。实际单位名是 `taiko-sync-receiver.service`，不要把脚本文件名猜成 `taiko-sync-dispatch.service`；本步骤没有部署/重启。日更新服务由原任务运行，不能终止或排除其经验证的 title/song relation 变更。
