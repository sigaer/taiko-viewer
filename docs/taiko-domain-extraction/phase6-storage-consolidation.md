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


## 6.3d.1 Goal source/SQL 锁顺序完成

Goal create/evaluate 先持有 source SH view，再进入 user/binding SQL `FOR UPDATE`；Python Overview 仍在 SQL 事务外。SQL store 锁定 binding 后核对 id、taiko id、source，same-row 身份变化会在读取 snapshot 之前冲突。原 expected active Goal / score revision、幂等 baseline、completion、cancellation 规则保留；cancel 不读取 score，无需新增 source 锁。

实际 native ESM 测试暴露此前 esbuild bundle 未暴露的 shared/publication 初始化顺序问题：`withUserdataWriteLock` 的 eager alias 可访问尚未初始化的函数。将唯一 `getRuntimePaths` 抽到 Infrastructure 独立模块、shared 继续 re-export，publication 不再导入 shared，并保留延迟 Writer wrapper，消除循环依赖。运行配置含义/默认值无变；Growth 离线 loader 注入同步适配。

最终 114 offline Node + 5 real SQL tests、局部 TypeScript PASS。新 3 SQL/bridge 用例执行实际 Goal service/store、实际账户 score Writer、kernel lease 与 MySQL owner/binding locks，核对进入 SQL connection 前 SH 已取得，Goal owner 锁持有时独立 Writer 未进入 EX，完成后 Writer 正常提交；eval 不额外调用 Growth Python，same binding row source substitution 被拒绝。真实 `SELECT DATABASE()` 返回 `taiko_annual_poster_test`，显式 mutation opt-in=1，仅本次合成 owner rows，finally 清理；未连/复制生产 DB。旧 SQL Goal completion/并发/隐私 cleanup 回归保持。

此测试库的 song lock FK 不存在（历史独立 test bootstrap），因此**不是实际 FK enforcement 验证**，不重新要求 REFERENCES/full staging/B-0；通过实际 source lease/owner lock 顺序与独立 Writer 无法进入 EX，验证已消除这条反向锁依赖。生产 FK 的定义已经源码审阅，后续 lifecycle 仍需保持相同 Source→SQL 顺序。综合 49.426 秒，250 ms sampled cgroup peak 299,700,224 bytes（约 285.82 MiB），high/max/OOM events=0。[证据](evidence/phase6-goal-lock-order-validation.json)。

本步骤本地提交，未 sync/deploy；继续 6.3d.2 manual owner/recovery 与 pending operation 实现，不提前 PASS 全 6.3d/Gate 6。

## 6.3d.2 独立备份与可移植恢复基础完成

A `69c4cac` / 9.81.2 已 push。新 Infrastructure backup 从 source EX view 验证、流式复制独立 C/H inode；daily namespaces 保持各自 `.lock` 冻结边界。私有目录/文件、原文 SHA/size、磁盘余量与限额、fsync 和最终目录 promotion；半批 staging 不作完成 receipt。非法 H 也按原文保留。不可变 backup UUID 重试返回原 source；Viewer scope 另外核对仍是当前代，拒绝用旧备份删除新成绩。

可移植恢复无需旧对象库，只接受空或匹配的 source。先验证整个备份，再构建新的 canonical C/H publication，逐 namespace 恢复 daily；不同的活动 score/legacy 残留/measurement 会拒绝覆盖。恢复协调器必须在整个过程保持 SQL grant 不可用。保持 payload/measurement 原文字节，source sequence 是新的；不把恢复当成回退时钟，不承诺 SQL、C/H 和 daily 的共同事务。SQL/identity 联动恢复、durable operation/outbox 仍待下一步骤。

最终 40 Python（新增 16）+ 43 Node、局部 TypeScript PASS；五个 backup 的真实进程死亡点、restore 提交前/提交后/部分 archive 完成的死亡、独立 inode 与旧根删除、原文/非法 H/daily、ENOSPC、锁期限、磁盘余量、symlink/FIFO/超限/损坏拒绝及 stale-backup grant 均覆盖。综合 26.004 秒，250 ms sampled peak 259,522,560 bytes（约 247.5 MiB），high/max/OOM=0。最初 QA runner 误用了系统旧 Node，在 tests 前语法失败；改为当前 Node 24.13.0 绝对路径后原限额重新通过。[证据](evidence/phase6-source-backup-validation.json)。

无生产数据/DB/network QA，无新 listener，测试树与 children 已清理；仍未 sync R/部署。Viewer 客户端步骤本地提交，待 Phase 6 标准发布统一 push。本节为 BACKUP_RECOVERY_FOUNDATION_PASS；manual lifecycle、全 Writer/grant、Read Model、百万记录与最终发布仍待完成，Gate 6 IN_PROGRESS。

## 6.3d.3 手动账号等待后 owner 复核与补偿 fence

Manual rename/upsert/delete/get score 在 Source EX/SH 内重新查询 owner。Visibility、claim issuance/consumption 与 detach 也采用同一 Source EX；Viewer detach 保持 Source→SQL owner/binding 的顺序，纯 grant 变化不额外生成成绩 observation。Rename 的 SQL nickname 更新处在 EX 内，publication 已证明回滚时恢复旧 nickname；回执丢失但 nonce 已提交时保留新 SQL nickname 与成绩。

进一步修复 source scope 的补偿竞争窗口：callback 在提交前失败时，在原 EX 与原 request ALS 内完成补偿；需要重新证明 rollback 时，probe 改用 EX，并在同一 EX 内完成破坏性 SQL cleanup。新的独立 Writer 不能在 proof 与补偿之间进入；更晚、不同的 source head 仍不代表本请求回滚，未知 outcome 不撤销 SQL side effect。

最终 120 offline Node + 15 real SQL（新增 10 manual）与局部 TypeScript PASS。Actual manual service、真实 MySQL 和中心 bridge；正常 create/read/rename/upsert/edit/delete 的完整 current 与全部 H SHA/返回 DTO 对 frozen `fbfd43e` 保持一致。真实 SQL owner 在请求排队期间撤销后，rename/upsert/delete/read 均 403 且 C/H 完全未变。Nickname rollback/lost ack、bot visibility/claim、detach/Goal SQL 顺序和旧错误/确认契约通过。`SELECT DATABASE()` 实际为 `taiko_annual_poster_test` 且显式 opt-in=1；只创建/清理本次 synthetic rows。Manual test bootstrap 不带 FK，**不是 production migration/FK enforcement 验证**。[证据](evidence/phase6-manual-owner-validation.json)。

综合 60.002 秒，250 ms sampled peak 289,484,800 bytes（约 276.07 MiB），high/max/OOM=0。最初 SQL invocation 缺少 mutation opt-in，guard 在连接前拒绝；frozen temp module 的 package resolution 和 rename precheck 次数修正后重跑。一次完整回归揭示补偿 callback 仍持有 kernel EX 但 request ALS 已离开，已修复并完成 16 focused、随后全部 120+15 验证。没有绕过隔离或调整预算，无生产 DB/私有数据/network QA，无新 listener。

日更新 `title_song_relations.json` JSON/全部 business fields 已验证；866 rows、685 relations、442 songs、525 titles，relations/by_song/by_title 与原版全相同，仅 generated_at 更新，纳入本步骤 release 范围。Viewer/sync receiver 仍 active/PID 1063394/1063408，未同步/部署。

这是 MANUAL_OWNER_RECHECK_PASS，不是完整 grant/lifecycle PASS：永久删除仍待单 SQL 事务 + durable receipt/outbox + canonical/daily cleanup + bounded recovery worker；create/claim/detach 的 SQL failure recovery、通用解绑/注销与其他非 Source 锁入口还需统一复核。下一步先完成真实永久删除，再推进 dispatcher/u0、全资源 grant 与 Read Model；Gate 6 IN_PROGRESS。
