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


## 6.3d.4 永久删除的一次 SQL 事务、持久回执与恢复 worker

Manual 永久删除在 source EX 内先核验 owner、创建独立 verified C/H/daily 备份，再以一条 SQL transaction 锁定全部 Viewer owner/binding、bot binding 和 source account，保存有界私有 SQL backup 与 pending lifecycle receipt，清理 source 的 identity/Goal/measurement/cursor/showcase/song lock/claim 并重排 remaining binding/slot。失败整体 rollback；rollback 本身失败会销毁连接，不把 uncertain transaction 放回 pool。COMMIT 回执丢失仅凭 matching durable receipt 判断已生效。SQL backup 按 object keys canonical JSON + SHA 保存，兼容 MySQL JSON key 重排，数组/raw strings/timestamps 保留；8 MiB/10,000 rows/128 owners 上限在撤销前核验。

授权撤销后清除 canonical C/H，verified daily purge 再逐 namespace unlink/fsync，形成新 empty publication。旧 backup source、不同活动 generation 或变更后的 daily 均拒绝覆盖/删除。原 actor 可在 binding 已删除后用既存 operation 重试；其他 actor 403。成功 API 返回 opaque backup/operation UUID，不泄露磁盘路径或 SQL recovery payload。永久 manual id 不重用。新 Infrastructure lifecycle table/outbox 不成为 score authority。

启动/60 秒 tick 的 bounded worker 每次只恢复一个 pending source，single flight，close 取消后等待 owned work；failed item 更新 attempt 时间以避免队列饿死。它只向前完成已撤销 grant 的 cleanup，不重新授权；日志只含固定通用提示。Source→SQL 锁顺序贯穿 cleanup，不持 SQL lock 等待 source。Source clear 使用一个 replace-history staged RPC，不为 50,000 个 H 各开请求；读本请求立即观察 empty C/H。

最终 43 Python + 127 offline Node + 27 real `_test` SQL（新增 12 manual deletion）、domainRead/publicationLifecycle 两组局部 TypeScript 全 PASS。覆盖一次 SQL commit、多 legacy owner、晚发生 SQL failure、失败 rollback 销毁连接、丢失 COMMIT 回执、source failure 后 fresh forward recovery、两个独立 delete 并发、不同 source/daily 拒绝、坏 receipt 不触碰文件和真实 Node 进程在 SQL commit 前/后/source publication 后退出；actual TCP 断开前态 rollback/后态 receipt 向前恢复均证明。SQL checksum 经实际 MySQL JSON round-trip 验证。现有 frozen manual/Goal/acquisition/publication 回归保持。[证据](evidence/phase6-manual-lifecycle-validation.json)。

QA 84.824 秒，250 ms sampled cgroup peak 332,267,520 bytes（约 316.875 MiB），high/max/OOM=0，owned systemd unit success/exit 0。真实 SELECT DATABASE() 为 `taiko_annual_poster_test`，显式 opt-in=1，only owned synthetic rows/finally cleanup；fixture 不含 production FK，**不是生产 migration/FK enforcement PASS**，不重开 B-0/DB Isolation。未读取生产私有数据/DB，禁止网络，无新 listener。初始 Goal fixture 缺 source_mode、JSON key 顺序与 TS args 类型问题均修正后完成最终全部验证。

A `8e3a48a` / 9.81.3 完成标准 commit/push；仅 A Infrastructure，未同步 R/未影响现有 NoneBot，因此此步不重启。Viewer 0.82.0 本地步骤留档，等待完整 Phase 6 标准发布 push/deploy；线上仍 0.81.11。这是 MANUAL_DELETE_RECOVERY_PASS，不是完整恢复或 Phase 6 PASS。下一步继续 SQL/source/daily 联动恢复，manual create/claim/detach SQL failure atomicity、通用解绑/注销/grant、dispatcher/u0/daily 的全部 Writer/reader convergence、Read Model/百万记录与最终统一激活发布。


## 6.3d.5 SQL/source/daily 联动恢复协调器

Trusted internal `restoreDeletedManualSource` 读取原 lifecycle receipt，核验 SQL backup canonical checksum、固定表/column allowlists、source/owner/product scope、原 source backup commit/sequence 与全部独立文件。旧 source 必须是 receipt 对应的精确 tombstone；续做只接受本 operation 的固定 restore nonce。新的活动 source、daily namespace/measurement、冲突 SQL primary key/owner 或已注销 Viewer user 均停止。Portable test 允许配置的全新 root 只有私有备份，不依赖原 canonical object store；实际切 root 时必须先停用全部旧 Writer/reader，不能同时跑两个 root。

在恢复文件前持久设 `restoring`，删除 worker 不再选择它，同 actor 的永久删除重试也拒绝。保持原 Source EX → SQL 锁顺序，在 EX 内通过中心唯一 Python implementation 构建新的 C/H commit、逐 daily namespace 恢复并核验，再以一条 SQL transaction 恢复原 owner/binding id、Goal、measurement、cursor、showcase 与 song locks。旧一次性 claim 不恢复。用户已经新选中的其他 binding 不覆盖；bot 恢复追加到现有 slots，保留其 current selection。文件或 SQL failure 期间 SQL grant 保持不可用，已经准入的 `restoring` 可以自动向前完成；普通 `published` 用户删除不能被自动重新授权。

同一 worker 每 tick 从 pending/restoring 的 due operation 选择一个，沿途保留一个 captured SQL pool，不在 shutdown 中解析/重开 pool。SQL/文件都确认后状态 `restored` 与 authority 在同一次 COMMIT 生效；失去 SQL ack 只凭相同 operation/nonce 的 durable receipt 判断成功。重试是 operation acknowledgement，不把更晚的正常成绩修改回退；再次实际删除会新建 receipt，旧 operation 不能复活它。mysql2 的 code/sql/sqlState/sqlMessage diagnostics 可能含整个私有 SQL INSERT，入口现替换为 generic 503，不传 sql/cause；正常 owner/确认错误保留。

最终 43 Python + 128 offline Node + 48 actual `_test` SQL（新增 21 restore）、domainRead/publicationLifecycle 两组局部 TypeScript 全 PASS。完整往返的 current/all H 原文、daily 原文及全部 SQL fields/id 的 canonical SHA 相同；正常修改、重复恢复和再次删除正确。实际 owned Node 进程在 reservation 后、文件恢复后、authority COMMIT 前/后退出，未 commit 的 TCP transaction 回滚、partial file recovery 不赋予 grant、worker fresh resume/idempotent 均验证。并发两个恢复仅一个 SQL commit、丢失 COMMIT ack、失败 rollback 销毁连接、新 current/slot、multi-bot、错备份/跨 source/PK conflict/deleted owner、private driver diagnostics、captured pool 关闭复核及不自动恢复普通删除通过。[证据](evidence/phase6-manual-recovery-validation.json)。

综合 113.322 秒，250 ms sampled cgroup peak 326,217,728 bytes（约 311.106 MiB），high/max/OOM=0、unit success/exit 0；所有 synthetic rows/temporary trees/owned children 清理。实际 SELECT DATABASE()=`taiko_annual_poster_test`、opt-in=1；不含生产 FK、不是生产 migration/full DB disaster recovery。初始 native import ordering 与 empty fixture 两个 harness 问题修正；最终增加 driver 脱敏和 shutdown pool 回归后重新完整验证。未用 production DB、个人数据或网络 QA，无新 listener。

A `fd7b52e` / 9.81.4 的两个本地 RPC 已标准 commit/push，仍只在 A 未同步 R，因此本步骤不重启 NoneBot；Viewer 本地步骤，统一标准部署时 push，live 仍 0.81.11。当前没有新增公网 restore API，提供内部 trusted coordination 和已准入自动续做；最终运维入口/生产恢复 runbook 随全授权收敛归档。MANUAL_COORDINATED_RECOVERY_PASS 不等于 Gate 6 PASS。下一步继续 create/claim/detach SQL failure atomicity、通用解绑/注销/grant、dispatcher/u0/daily 的全部入口、一致 Read Model/P1a、百万成本、统一 runtime sync/发布与在线验收。

## 6.3d.6 认领、发码与解绑事务收敛

三类授权操作在 Source EX 内捕获同一个 SQL pool，先锁 actor/全部相关 binding，再以一次 transaction 完成 capability、binding、current/slot、Goal/measurement/cursor/showcase 清理与最小持久 receipt。Receipt 只保存 operation/source/actor/kind 与认领 hash，不保存明文码或私有成绩，不成为 score authority。发新码晚失败保留旧码；认领晚失败保留未消费 capability 与旧 owner/current；解绑晚失败保留全部原授权及产品事实。rollback 失败销毁 connection；COMMIT ack 丢失只有精确 operation receipt 才确认成功。SQL driver diagnostics 统一脱敏。

排队取得 EX 后重查 claim row id/source/hash/expiry，拒绝同 row 目标替换、过期/撤销与其他 actor 重放。同 actor 已提交认领可凭 receipt + 实际 consumed row + 当前 owner 重试，零额外 COMMIT、不重置后来选中的 current；已提交显式解绑只确认原操作，不重新授权。多 legacy bot 解绑保留仍存活的旧 principal，否则选择存活 holder；只有 receipt 而无当前 ownership 不能认领。创建/认领共用同一 attachment implementation，但创建尚待下一步骤持久协调，不能据此视为完成。

最终 43 Python + 128 offline Node + 73 actual `_test` SQL（新增 25 grant）和 domainRead/publicationLifecycle 两组局部 TypeScript 全 PASS。实际 owned Node 对发码/认领/解绑分别在 COMMIT 前与后退出，TCP transaction 回滚/持久 receipt 重试均验证。覆盖全部晚 SQL failure、failed rollback destroy、ack loss、同/不同 actor 并发、排队 capability 变化、旧 current 保留、三类 captured-pool shutdown-style replacement、真实 driver 私有诊断脱敏；纯 grant 的 C/H 原文、commit ID 与 sequence 全不变。旧 delete/restore/Goal/acquisition/manual Golden 回归保留。既有测试相对 setup COMMIT 计数、transaction connection hook 与同 actor 重试预期同步更新。[证据](evidence/phase6-manual-grant-validation.json)。

综合 137.912 秒，250 ms sampled peak 341,823,488 bytes（约 325.988 MiB），high/max/OOM=0，unit success/exit 0。实际 SELECT DATABASE()=`taiko_annual_poster_test`、显式 mutation opt-in=1，只使用 own synthetic rows/temporary trees/children 并清理；测试 schema 缺生产 FK，不冒称 production migration/FK enforcement、HTTP authentication 或百万容量验收。初始 legacy hook 和重试预期修正，最终复核发现 detach 预检未显式传 captured pool，已修复并新增三类 shutdown 回归后完整重跑。

这是 MANUAL_GRANT_TRANSACTION_PASS，Gate 6 仍 IN_PROGRESS。A `fd7b52e` / 9.81.4 unchanged，无 R sync/NoneBot 重启/Viewer push/deploy；live 0.81.11、Viewer/sync receiver PID 1063394/1063408 active。Viewer 步骤本地提交，待完整 Phase 6 标准发布统一推送。下一步创建持久恢复，然后通用解绑/注销与 private resource grants、实际 dispatcher/u0/daily 全入口、Read Model/P1a/百万成本、运维恢复入口与最终统一激活/在线验收。


## 6.3d.7 创建的持久登记、初始发布与授权恢复

创建先在 Source EX 内以一次 SQL transaction 登记唯一 operation/source/actor、32 KiB 上限且 hash/结构验证的空档案与原 current selection；此时无 account/binding/claim grant。随后保持同一个 EX，通过单一中心 publication 发布固定 nonce 的初始 C/H，核验原文/hash/history identity/sequence=1，再在一次 SQL transaction 添加 manual account、owner binding、current/slot 并把 receipt 设为 ready。SQL/文件失败只保留已登记 pending，由同一个有界 worker 向前续做；rollback 失败销毁连接，丢失 SQL COMMIT ack 只认精确 immutable receipt。不同 source head、SQL authority collision、已注销 Viewer owner、坏/超限 receipt 与原有 archive 拒绝覆盖或重新授权。

初始 H 身份和字节由原 shared serializer 生成，创建用 operation UUID 与登记时刻固定输入。实际 Python 在 objects-staged 后、pending journal 前退出，会留下未提交 manifest；中心现在仅允许相同 requestHash 在 unchanged parent 上重新提交，并拒绝旧 nonce 覆盖 newer head。intent/projection 未提交回滚产生的 empty sequence-0 parent 只供原已登记 creation 续做；新 ID 不能占用任何既存 manifest/C/H/archive directory。既有 shared timestamp/serializer 抽出为单一 Infrastructure module并 re-export，正常 Writer 的时间采集点、序列化顺序与分配寿命保留，不导入 content/product/SQL，未把 filesystem 放入 Core。

两条既有 HTTP adapter 可接收可选 requestId。相同 UUID/actor/nickname 并发只有一个 source；完成后的重试仅确认原 result，不覆盖后来的成绩、不复活已删除/解绑的账号。无 UUID 的旧请求只续做同 actor/nickname 的 pending；完整成功后丢失 HTTP ack 的重放需要明确 UUID，未声称前端已接重试 nonce。延迟恢复保留用户后来新选中的 Viewer/bot current。统一队列每 tick 仍只处理一个 due creation/delete/restoring，captured pool/abort/attempt fairness 保持；ready birth receipt 不会被 worker 自动重新授权。永久 source ID 不重用。

最终 45 Python + 131 offline Node + 106 actual `_test` SQL（新增 33 creation）、两组局部 TypeScript 全 PASS。五个实际 Node 创建退出点、五个实际 Python 底层 publication 退出点、两类丢失 SQL COMMIT ack、source ack loss、晚失败/failed rollback、concurrent UUID、旧 pending 重试、frozen blank C/H raw SHA/返回 DTO、later selection、删除后 acknowledge、坏/超限 SQL payload、source/grant/daily conflict 与 captured pool/private diagnostics 均覆盖。旧 manual/grant/delete/restore/Goal/Growth/acquisition 回归保持。[证据](evidence/phase6-manual-creation-validation.json)。

QA 172.201 秒，250 ms sampled cgroup peak 356,143,104 bytes（约 339.645 MiB），high/max/OOM=0、unit success/exit 0。实际 SELECT DATABASE()=`taiko_annual_poster_test`、显式 opt-in=1，所有 owned rows/tree/children 清理；无生产 DB/个人文件/外部服务 QA，无新 listener。测试 schema 缺生产 FK，不冒称 production migration/FK enforcement/authenticated HTTP/full server tsc/百万容量。初始 wrapper 路径与 opt-in 传递问题在连接前停止；完整回归的两个旧 SQL query hook、一个把 legacy daily 当 H 的 snapshot helper 问题修复，并在相同预算重新全套通过。

A `f3146cf` / 9.81.5 已标准 commit/push；仅 A Infrastructure 未同步 R，因此现有 NoneBot 无需在此步骤重启。Viewer 0.82.0 本地步骤，待 Phase 6 完整标准部署统一 push；live 0.81.11、Viewer/receiver PID 1063394/1063408 active。MANUAL_CREATION_RECOVERY_PASS，Gate 6 仍 IN_PROGRESS。继续通用解绑/登录账号注销与 private grants、actual dispatcher/u0/daily 全入口和 reader identity fence、Read Model/P1a/百万成本、运维恢复入口与最终统一 runtime sync/发布/线上验收。


## 6.3d.8 通用解绑事务与 Growth 完整身份复核

通用绑定解绑现在先持有 Source EX，再在同一次 SQL transaction 锁定 owner 与其全部 bindings，复核捕获的 id/taiko id/source/manual account identity。实际 last-binding count、Goal/measurement/cursor/song-lock/showcase cleanup、remaining current selection 和最小私有 operation receipt 只做一次 COMMIT；任一晚失败不留下部分授权或丢失 current，rollback 失败销毁连接。精确 UUID receipt 证明丢失 COMMIT ack，同 owner 并发只撤权一次，完成后的 retry 仅确认原返回结果，不重复改变 selection/成绩。manual 仍使用既有专门入口，foreign binding、坏 receipt、已注销 owner 拒绝。普通 successful DTO 字段保留，纯撤权不生成 score observation。

默认绑定切换属于 SQL metadata，不读取成绩；锁定 owner/all bindings 后两次 current 更新在一个 SQL transaction 完成，不在 SQL 后请求 Source lease。shared 旧入口延迟委托同一实现，避免新循环依赖。Overview/History/Passport/Recent 在获得 SH 后及返回 DTO 前复核完整四字段身份；排队期间同 row id 的 taiko/source/manual account 替换不能带出旧 profile 产品。Recent ACK 的整个 evidence→owner/cursor transaction→COMMIT 共用一个 SH view，完整身份在 SQL 锁内再次证明，保留 boundary CAS/idempotency。原 shared Writer 来源校验补上实际 string type，拒绝 undefined/null/coercible object，正常字节/时钟语义不变。

最终 45 Python + 132 offline Node + 139 actual `_test` SQL（新增 33 binding/source 用例）、两组局部 TypeScript 全 PASS。包含 late cleanup/current/receipt/driver failure、failed rollback、lost ack/concurrent retry、actual queued identity substitution/last-binding change、captured pool、corrupt receipt/deleted owner、long Growth SH 与撤权 EX、Recent cursor COMMIT 与新 publisher fence、两个 actual Node COMMIT 前后退出点。C/H raw SHA、commit ID、sequence 在纯 SQL 操作前后不变，原 manual/acquisition/Goal/Growth 完整 Golden 回归保留。[证据](evidence/phase6-binding-revocation-validation.json)。

QA 198.253 秒，250 ms sampled cgroup peak 367,939,584 bytes（约 350.895 MiB），high/max/OOM=0；unit success/exit 0、inactive/MainPID 0/无残留 cgroup。实际 SELECT DATABASE()=`taiko_annual_poster_test`、显式 mutation opt-in=1，owned rows/tree/children 清理。测试 schema 无生产 FK，未把这些 service/bridge 测试称为 production migration/FK enforcement/authenticated HTTP/full server tsc/百万容量。首轮 fixture 的重复 ID/范围/来源参数修正；新 provenance test 引入 runtime globals 导致窄 tsc 停止，移入已有正确类型环境后原限额整套重跑通过。

这是 BINDING_REVOCATION_AND_GROWTH_IDENTITY_PASS，Gate 6 仍 IN_PROGRESS。无公开登录账号删除业务路由，不新增此产品；现有 ops/test cleanup helpers 与 binding verification confirmation 尚需授权/fence 审阅收敛。个人 rating/recommendation 等其余 reader、private source/QQ/Hiroba grants、actual dispatcher/u0/daily 全入口、P1a/Read Model/百万成本、运维恢复入口与最终 runtime sync/发布/线上验收继续执行。A `f3146cf` / 9.81.5 unchanged；Viewer 0.82.0 本地步骤待统一标准部署 push，live 0.81.11/PID 1063394、receiver PID 1063408 unchanged，无 R sync/NoneBot 重启。


## 6.3d.9 绑定验证的身份与事务收敛

原确认流程分开提交 current reset、binding/title grant 和验证记录删除；等待或晚失败可丢失默认绑定、重复操作，且只使用 fence 外的挑战。现在公开 profile/title 观察在 SQL 外完成，随后 Source EX→SQL owner/all bindings，复核原 verification id/hash/expiry 和 existing binding 的完整身份，一次 SQL COMMIT 写入 grant/title/current、消费匹配挑战、登记私有最小确认回执。晚失败完整 rollback，失败 rollback 销毁连接；丢失 COMMIT ack 只认精确 operation/verification proof，捕获 pool 不在续做时更换。纯 grant 不生成 score observation。

准备验证只涉及公开资料与 SQL metadata，无 score grant；其 challenge replace 也改为 owner-locked 一次 transaction，不在 SQL 后获取 Source。确认回执只保留 actor/binding/source/verification id 与 title/challenge hash，不保存原文、密码、成绩或凭据。原 body 仍只需要 taikoId；同 actor 已完成重试必须还有 matching owned binding/title proof，确认原结果，不覆盖 later current/unrelated pending，也不复活移除或替换后的绑定。新挑战必须重新验证；prepare 无 client UUID，process/HTTP ack loss 后重新 prepare 可以按旧语义替换 baseline，不承诺无限请求重放。

绑定查询仅认 exact official userid；删除 first-player fallback，拒绝会丢精度的 unsafe numeric ID，设置 15 秒 HTTP deadline。保持原“称号/称号牌变化”产品规则，不声称建立新的更强身份挑战协议。手动账号走专门 claim：bot-only/deleted SQL reservations 和已定义的 98 namespace 均拒绝普通 external verification，覆盖没有 SQL authority 的 legacy orphan。公共原图/排行榜搜索语义未借此扩展。SQL owner/current/rollback helpers 与通用解绑共用单一实现。

最终 45 Python + 132 offline Node + 169 actual `_test` SQL（新增 30 verification）、两组局部 TypeScript PASS。冻结 `7d67edc` successful prepare/confirm DTO 与 source/current/verified fields 一致；C/H raw SHA、commit ID、sequence 保持。覆盖 late grant/current/consume/receipt/driver failure、rollback destroy、lost ack/concurrent actor、排队期间 challenge identity/expiry/baseline/source 替换/foreign owner、existing binding refresh、captured pool、腐坏 receipt/deleted owner、手动 namespace/删除后/孤立档案拒绝、两个 actual Node COMMIT 前后退出。真实 login cookie 与实际 HTTP prepare/confirm/current/GET adapters 验证 401、pending→complete、reload、later selection、replay、logout/re-login；official profile 响应为 synthetic，不调用真实 Wahlap。[证据](evidence/phase6-binding-verification-validation.json)。

QA 224.135 秒，250 ms sampled peak 386,424,832 bytes（约 368.523 MiB），high/max/OOM=0；unit success/exit 0、inactive/MainPID 0、无残留 cgroup。实际 SELECT DATABASE()=`taiko_annual_poster_test`，显式 mutation opt-in=1，owned rows/tree/HTTP listener/children 清理；无 production DB/私人文件/official network QA。测试库不带生产 FK，不冒称 migration/FK enforcement/full server tsc/百万容量。首轮不合规的 synthetic manual ID 触发现有 CHECK，未放松约束；第二轮错用删除 helper 名称修正，随后定向与最终整套通过。

这是 BINDING_VERIFICATION_TRANSACTION_PASS；Gate 6 仍 IN_PROGRESS。个人 rating/recommendation/Growth Python CLI 的直接 compatibility reads 已定位，必须连同 canonical Reader 接入验证，不能仅给 Node 外层加锁即当成完成。其余 private profile/token/QQ/Hiroba/source grant、ops cleanup、actual dispatcher/u0/daily 全入口、P1a/Read Model/百万成本/运维恢复与最终统一 sync/release/在线验收继续。A `f3146cf` / 9.81.5 unchanged；Viewer 0.82.0 本地步骤，live 0.81.11/PIDs 1063394、1063408 unchanged，无 R sync/NoneBot 重启/Viewer 部署。

## 6.3e.1 Python current Reader 与个人产品读取 fence 完成

Rating/普通推荐的两个 current 入口、目标/预测共用 loader 统一到 `taiko_store.reader.read_current_json`，在 SH 内验证 immutable current 后解码；managed 缺失/损坏/无效 JSON 不回退 projection，legacy sequence-zero 保留原值形态而不冒称 ready。显式 root 优先，Viewer 向子进程传自己的 userdata root 与 compute-only 环境。真实 Growth CLI 发现并修复独立 loader 的 domain adapter alias 缺失。两个 CLI 的 publication error 统一 code 75/固定诊断；Node 映射为脱敏 503，其余计算失败保持 502，120 秒 deadline/12 MiB stdout 上限。

四个个人产品在一个 Source SH 内完成存在检查和 Python 计算；等待 SH 后及返回前复核完整 id/taiko_id/source/manual_account_id。纯读不变更 C/H 字节、commit 或 sequence；后续 selection 替换返回 409，撤权/独立发布等待读取完成。实际 SQL 的 16 个等待中四字段替换、返回前替换、当前选择和长读 fence 均覆盖。

最终 53 publication Python（新增 8）、132 既有领域 Python（排除 9 线上用例）、132 offline Node、199 actual `_test` SQL（新增 28 personal fence + 2 real Python）及两组局部 TypeScript PASS。六条 actual CLI 的非 timing 完整 DTO 对照冻结 `f3146cf`，oracle 只重定向个人 root 与补齐已知 alias；使用完整公开谱库和合成成绩，不读取生产个人文件/DB。实际 Node→Python 跑通四产品及 Growth，projection 删除/改写保持完整输出，canonical corruption 503/其他 child failure 502 且不泄露 stderr/路径。测试 guard 禁止 Python 网络和 owned root 外写入；SQL guard 实际 SELECT DATABASE/显式 opt-in。

验证分两段：53/132 Python 在首 unit 已通过，之后 scoped TS 因缺少 Nuxt test declarations 中止；补齐后 TS 通过。中间运行器把 Python 搜索路径传给 Node 模块缺失 fixture，按所有权清理该失败 unit；只给 Python 命令设置搜索路径，最终两组 TS/132 Node/199 SQL 全部完成、runner exit 0。Node unit 254.409 秒/250 ms sampled peak 376,492,032 bytes（约 359.051 MiB）；Python unit 62.537 秒/337,477,632 bytes；两段 high/max/OOM=0。Final unit journal deactivated successfully，collected 后 MainPID=0/cgroup 已不存在；不把 collected unit 的默认 Result/ExecMainStatus 当退出证明。证据：[phase6-personal-canonical-validation.json](evidence/phase6-personal-canonical-validation.json)。

A `5b61502` / 9.81.6 已 push；未复制 R/未重启任何 live service，Viewer 0.82.0 保持本地阶段提交、随统一标准发布推送。接下来处理 profile/token/sync 与其他私有 grant、剩余 Python history/ctime Reader、dispatcher/u0/daily/all Writer、P1a/Read Model/百万成本/运维恢复及最终激活；Gate 6 IN_PROGRESS。


## 6.3e.2 账号档案、同步概览和 Viewer token 授权

账号档案与只读同步概览现在捕获同一 SQL pool 和完整绑定 identity，在 Source SH 后及返回前复核 owner/current；SQL proof 前后检查 lease 存活，等待期间替换 id/taiko_id/source/manual_account_id 或读取中更换绑定不能带出旧 private DTO。Title 从 canonical current 读取，projection 删除/改写不改变结果；managed corruption/non-object 返回脱敏 503，legacy missing/invalid 保留 verified title。Binding DAO 保留原排序与字段，list 有 128 条上限；pending/QQ/cooldown/log subqueries 使用捕获 pool。移除原 account sync 遗留本地调试上报。

Viewer token 签发/撤销采用 Source EX→SQL owner/current locks→有界 loopback gateway→实际 SQL token hash/mask/existence proof，手动/98/异常 external source 拒绝；body 不能改用其他 Source。15 秒 fetch/body deadline、16 KiB body、exact string taiko echo 与固定公开错误防止私人网关诊断外泄。状态查询失败保留原 unavailable 行为，targets 限制响应、64 条与文本长度并保留默认 fallback。纯 token/grant 不产生 score observation；C/H bytes、commit/sequence 不变。

网关 token SQL 独立提交，外层 authority transaction 只持锁、不写 token，不能冒称跨 gateway/SQL atomic rollback。Readonly COMMIT ack loss 在同 lease、owner/current 与精确 token outcome 下直接确认一次网关结果；晚 SQL failure 可能留下已提交 token，新的 issue 按原语义旋转，failed rollback 销毁连接。后续实际 gateway Writer 收敛必须重用/重构同一 grant 边界，禁止 parent EX 下 child 再取 Source EX。Sync dispatch mutation、直接 bot/gateway token grant 和 arbitrary-source API 授权继续下一步。

最终两组局部 TypeScript、136 offline Node（新增 4 gateway stream）与 236 actual _test SQL（新增 37 account source，包含 2 既有 actual Python personal）全部 PASS；未改 A Python，53 publication/132 domain Python 沿用上一份证据，不称本步重跑。真实 cookie 的 profile/sync/issue/status/revoke/reload/logout/re-login 和冻结 7bf9a56 healthy full DTO 一致，外部网关用两个 owned loopback servers/实际 token SQL 合成。16 排队替换、返回前替换、lease loss、长 SH/EX/publisher/SQL current lock、hash mismatch、非法/过大/私密错误、COMMIT ACK/failed rollback/captured pool 均通过。[证据](evidence/phase6-account-source-validation.json)。

QA 287.916 秒，250 ms sampled peak 390651904 bytes（372.555 MiB），high/max/OOM=0；实际 wrapper exit 0/journal deactivated successfully，collected 后 MainPID=0/无 cgroup，不以 collected unit 默认状态证明退出。首次注入异常缺少真实 mysql2 code/sql 属性，只修正 test driver shape，失败 unit 不记整体 PASS；定向与最终完整回归通过。实际 SELECT DATABASE()=taiko_annual_poster_test、显式 opt-in，owned rows/root/HTTP listeners/lease children 清理，测试 schema 不含生产 FK，局部 tsc 不等于 full Nuxt。

这是 ACCOUNT_PROFILE_SYNC_OVERVIEW_TOKEN_AUTHORITY_PASS；Gate 6 IN_PROGRESS。A 5b61502/9.81.6 unchanged，Viewer 0.82.0 本地提交待最终标准部署统一 push；live 0.81.11/PIDs 1063394、1063408、829173 unchanged，无 R sync/restart/deploy。继续剩余 history/ctime Reader、private grant/sync dispatch、ops cleanup、actual dispatcher/u0/daily/all Writer、P1a/Read Model/百万成本/运维恢复及最终激活。


## 6.3e.3 Python 历史、文件时间兼容与 daily root

load_user_snapshots 从一个 canonical SH view 枚举、排序和消费 H，完整重建结束才释放；full/delta、基线前忽略、profile/achievement 替换、removed songs、未知字段与旧异常 JSON 排除语义不变。parse_snapshot_time 保留两类时间文件名与 suffix/tie 顺序，异常文件名使用被捕获的原 filesystem mtime。getUtime 在同一受保护视图验证 current，使用捕获的旧 ctime 展示值；managed 缺失/损坏不降为 partial/空，tombstone 不读取旧 projection，legacy 空目录/缺失 current 保持 []/None。

Schema 1 增加可选 fileMtimes/fileCtimes（有限 JSON number 秒值），接管原文件即捕获；相同 raw hash 不合并不同旧文件的 metadata，未改引用保持旧值。恢复在同一批次带回这些值，显式 restore overrides 纳入 nonce request hash，晚失败/portable restore 不把存储操作显示成新成绩更新。文件时钟不作为 play/observation time 或 P1a ready proof；旧 manifest 没有这些值时只能兼容读取 object metadata，不能声称找回已丢失原 legacy 时钟。增加 32 MiB serialized manifest 提交前上限，避免合法但超长 H 名称加 metadata 后产生无法再读的已提交代。

真实趋势调用的 audit guard 发现 daily archive 曾越过配置 root 指向硬编码生产目录，guard 在写入前阻断。daily archive/capture 提供显式 root > TAIKO_USERDATA_DIR > 旧 ROOT；acquisition 把 store.root 传给现有两个日模型。只修正 root，不修改 namespace/flock/既往日冻结/当日代表规则；chart/backfill/daily 的共同 lifecycle Source fence 继续随后收敛。

75 publication Python（新增 21 history + 1 acquisition root）、156 domain/trend/daily Python（132 既有 + 24 扩展）、138 offline Node（新增 2 actual metadata pipe）、236 actual _test SQL、两组局部 TypeScript PASS。冻结 5b61502 完整 snapshots、日趋势/曲数趋势 Rating 和六维 DTO 一致；oracle 只重定向个人 root，公开完整谱库与算法没有 mock。Projection loss/tamper、坏/缺对象、legacy invalid/non-object/unsafe exclusion、相同 raw 不同 mtime、失效 view、实际独立 writer 等待 SH、portable backup/restore、迟失败 old caption、nonce/metadata byte bounds 均覆盖。[证据](evidence/phase6-history-reader-validation.json)。

验证分段保留：75 publication 在首 unit 已通过，后续扩大 domain fixture 缺完整 Bot routes 而停止，不把首 unit 记为整体通过。补齐真实趋势纯解析器的 AST 载入，仅排除 3 个未修改、需要完整 NoneBot 注册的 route tests；另 9 个既有 production cases 仍排除，最终 scoped domain/TS/Node/SQL 完整 exit 0。Final unit 311.970s/250ms sampled peak 388325376 bytes（370.336 MiB），high/max/OOM=0；早段 64.066s/236072960 bytes。以实际 wrapper exit/journal success 证明完成，collected 后 MainPID=0/cgroup gone。首次 dir_fd guard/legacy skip expectation 已修正并定向通过；只删除确属本次失败 fixture 的临时目录，非 force 清理。SQL 真实 DATABASE/opt-in、owned roots/children/listeners 清理；不称为 production FK/full Nuxt/full Bot/百万容量验收。

本步 PYTHON_HISTORY_AND_FILESYSTEM_METADATA_READER_PASS；Gate 6 IN_PROGRESS。A 6a90c7e / 9.81.7 已标准 commit/push，未复制运行 R 因此不需要此步重启；Viewer 0.82.0 本地提交随最终标准发布统一 push。运行 Viewer/receiver/public API PIDs 1063394/1063408/829173 未变。继续 private grant/sync dispatch、ops cleanup、actual dispatcher/u0/daily/all Writer、P1a/Read Model/百万成本/运维恢复及统一激活验收。


## 6.3e.4 Viewer token 的单次授权 SQL transaction

6.3e.2 的 Viewer EX → independent token gateway 会在实际 Python gateway 也获取同一 Source EX 后形成跨进程等待，而且晚失败不能撤销已经由网关独立提交的 token。现在 Viewer 在自己的 Source EX 内捕获 pool、锁 owner/全部 bindings、证明完整 current identity，直接在同一个 SQL transaction 签发/撤销并核验 hash/mask，只有一次 COMMIT；status 在既有 SH 内直接查询同一 captured pool。没有调用 child gateway 获取第二个 EX。表、48 位 hex token、SHA256 storage、mask、日期秒精度、row id/created_at 保留、last_used reset、fresh rotation 与 revoke affected-row 语义保持；Schema 的规范化 DDL 与 A 6a90c7e 现有 Python issuer 完全一致，账户初始化与测试使用同一声明。旧 gateway adapter 留作 frozen rollback/有界 response 回归，不作为当前 Viewer grant 路径。

提交前失败完整 rollback；失败 rollback 销毁连接并保留旧 token。只有已经尝试 COMMIT 且同一 lease/owner/current 仍可证明、实际持久 token outcome 完全匹配，才确认丢失 ACK；不再称作 readonly transaction。实际进程在 COMMIT 前退出保留旧状态，COMMIT 后退出保留新状态；fresh issue 重试按原产品语义再次旋转，没有新增跨请求 nonce 或永久保存明文 token。晚失去 lease/owner/current 不向调用方返回 private token，即使 SQL 已提交；后续请求按现有行为处理。纯 token/grant 不变更 C/H bytes、commit 或 sequence。

两组局部 TypeScript、51 account source 定向用例及最终 138 offline Node / 250 guarded _test SQL 全 PASS，新增 14 token transaction 用例。保留真实 cookie/frozen 7bf9a56 full DTO、16 queued 四字段 identity races、long SH/EX/SQL owner lock、captured pool/错误脱敏及全部旧 lifecycle/Goal/Growth/Python personal 回归；新增 issue/revoke COMMIT 前失败、两种 mutating ACK、实际存储 hash 替换拒绝、lease death、原日期/row retention、两个 concurrent fresh issue、status unavailable 和四个 actual Node process deaths。A 未改：75 publication/156 domain Python 沿用上一份 evidence，未冒称本步重跑。证据：[phase6-token-atomic-validation.json](evidence/phase6-token-atomic-validation.json)。

最终 QA 298.819 秒、250 ms sampled peak 441589760 bytes（421.133 MiB）、high/max/OOM=0；actual wrapper exit0/journal success/collected MainPID0/无 cgroup。实际 SELECT DATABASE() 为 taiko_annual_poster_test，并检查 _test 后缀与显式 mutation opt-in；owned SQL rows/Source tree/child/两个 HTTP listener 由 fixture finally 清理。测试 schema 缺其他生产 FK，不冒称 full Nuxt/full Bot/生产迁移/百万成本/线上 authenticated smoke。

本步 VIEWER_TOKEN_SINGLE_AUTHORITY_SQL_TRANSACTION_PASS，Gate 6 仍 IN_PROGRESS。Viewer 0.82.0 阶段源码本地提交，随统一标准部署推送；live 0.81.11/PIDs 1063394、1063408、829173 unchanged。A 6a90c7e/9.81.7 unchanged，无 R sync/restart/deploy。剩余 direct Python bot/gateway token ownership 与 bearer read/refresh grant、arbitrary-source/QQ/Hiroba API grant、Viewer sync dispatch、ops cleanup、all Writer/daily/P1a/Read Model/百万成本/运维恢复与最终激活继续执行。


## 6.3e.5 Python bearer grant、canonical DTO 与 acquisition lease 复用

原 public-score bearer 只在请求入口解析一次 token，提前提交 last_used_at 后读取 projection、调用 refresh，再次直接读取文件。现在捕获一个 SQL connection，完成无 private file 访问的 optimistic token snapshot；Source EX 后通过 FOR UPDATE 锁定精确 token row id/hash/Source，在同一 EX 内读取 canonical current、刷新、再次构建 canonical DTO、复核 grant、提交使用时间。等待中 row id/Source/hash/revoke 替换拒绝，Body userid/taikoId 不改变资源。已有 bearer 是独立的显式 Source capability，沿用旋转/撤销之前存活的语义，不依赖后来选中的 current binding；Bot/gateway 的实际签发 owner proof 尚待下一步。

Wahlap getUserData 与 Hiroba private/public/bound 和两个实际 save 分支显式传递已有 publication_store；save_userdata 验证相同 identity/live EX 后复用，不获取 child EX、不升级 SH。默认无 store 的 Writer 继续自行获取 EX，TAIKO_USERDATA_DIR 优先旧 root；可选 TAIKO_WAHLAP_CONFIG_PATH 保留旧 cookie JSON/default path。Wahlap 四请求增加 5s connect/30s read timeout，bearer POST 保持正常接口/CORS 并增加 16KiB body/15s read bound。

Healthy full DTO 对照 frozen 6a90c7e；projection loss/tamper 不改变输出，managed corruption/missing object 503 且不触发刷新回退，legacy invalid/missing 仍可按原规则刷新。保留已有 Hiroba 有本地数据时的 upstream failure fallback，但 publication failure 不回退并不泄露私人路径/SQL/凭据。Canonical publication 与 SQL last_used_at 独立提交：已授权 acquisition 可能在晚 SQL failure/进程退出后保持已提交的新 C/H；fresh retry 沿用旧 observation 行为，不冒称跨 DB/file transaction、跨请求 nonce 或整次联合 rollback。Usage COMMIT ACK loss 返回脱敏 unavailable，未把它当作 score/grant joint ACK。

最终 95 publication Python（新增20 bearer/lease/实际 Hiroba routes）、166 domain/trend/daily Python（9 production+3 untouched full Bot routes excluded）、138 offline Node、267 actual _test SQL（新增17 native bearer，含实际 owned HTTP、真实 PyMySQL/SQL song lock、四个 native process deaths）和两组局部 TS 全 PASS。Frozen healthy DTO、四字段 token 排队替换/撤销、SQL pin/Publisher wait、actual Wahlap/current-history、Hiroba routing/save 两分支、failed rollback close/captured connection/late metric failure 全覆盖。Native transport/credentials/daily capture 为 synthetic，未复制生产个人数据/凭据或访问 official network；真实 SELECT DATABASE()=_test+显式 mutation opt-in。证据：[phase6-bearer-canonical-validation.json](evidence/phase6-bearer-canonical-validation.json)。

QA 420.048s/450.320MiB sampled、472195072 bytes/250ms sample/high-max-OOM=0，actual wrapper exit0/journal success/collected MainPID0/无 cgroup。首次 dataclass fixture 注册缺失在测试/DB前停止；missing canonical 404/503 缺口修复后定向与最终整套通过。所有 owned rows/root/HTTP listener/child finally 清理；不声称 production FK/full Nuxt/full NoneBot registration/百万成本/线上 authenticated smoke。

本步 PYTHON_BEARER_SOURCE_GRANT_AND_ACQUISITION_LEASE_REUSE_PASS，Gate 6 IN_PROGRESS。A 408d2f8 / 9.81.8 已标准 commit/push（HEAD==origin/main）；未复制 R，所以现有 NoneBot/public API 未加载本步变更、不在此源码步骤重启。Viewer 0.82.0 本地留档随标准部署统一推送；live 0.81.11/PIDs 1063394、1063408、829173 unchanged。继续 native Bot/gateway 签发 owner/current proof、arbitrary-source/QQ/Hiroba service grants、Viewer sync dispatch、ops cleanup、actual dispatcher/u0/daily/all Writer、P1a/Read Model/百万成本/运维恢复与最终激活验收。


## 6.3e.6 Native Bot Token 当前 owner 与旧 gateway 收敛

原 issuer 按 Source 查找任意 bind owner，Bot 命令又可能选择被提及的可见绑定；现在只接受 adapter 认证的实际 sender。bot_binding_authority 先捕获当前实账号 identity，在 Source EX 后按 bind→virtual state 顺序锁定该 sender 全部行及 u0 状态，缺失 legacy 状态在事务内补建中性实账号行，不覆盖既有 u0、不依赖 gap lock/isolation；提交前复核 row_id/qq/id/source/slot/current/visible。隐藏的自有实账号保持正常；其他用户的可见绑定、虚拟 u0、manual、case-colliding/unsafe/unbounded SQL rows 拒绝。Current fallback 保留无 current 标记的第一 slot legacy 行为，多个 current 的损坏记录拒绝。

Native issue/status/revoke 统一 Source EX→owner/current→token SQL 单次事务；不主动读取/发布 C/H 或产生观察；底层 EX 仍可恢复既存 publication pending。正常 token 长度、hash/mask、row id/created_at、fresh rotation/last-used reset、revoke affected-row/idempotence、完整 healthy DTO 对照 frozen 408d2f8。COMMIT 前晚失败保留旧 token，失败 rollback 强制 close；uncertain ACK 只在已尝试 COMMIT 后，用捕获 factory 的 fresh connection 在同一个 EX 下证明 exact token tuple 与完整当前 owner，不认部分绑定/未执行 COMMIT，不返回 later owner 的 plaintext。

实际调用链审计确认正式 Viewer token 已在 6.3e.4 改为直接 SQL service；只有 frozen gateway fixtures 保留旧 adapter。Userid-only /score-token 没有 principal 证明，不能用 loopback 或伪造 identityKey/userId 补出 grant，实际 route 返回 410，issue/status/revoke 均无 SQL/Source 副作用。Python 原函数名与 gateway parser 保留作 adapter/rollback evidence，ownerless 调用及 require_bot_binding=False 拒绝；旧“Viewer 无 owner 也可签发”测试改为权限纠正验证，不冒称原不安全行为仍兼容。已有 bearer 仍是旋转/撤销前存活的 Source capability，后来 current selection 不自动撤销。

107 publication Python（新增12 proof/actual command AST）、170 domain Python（新4管理用例，9 production+3 untouched full Bot routes excluded）、138 offline Node、303 actual guarded _test SQL（新增36 native issuer，既有17 bearer/2 personal真实Python）及两组局部 TS 全 PASS。九类排队 binding/state 替换、ownerless/foreign/manual/u0/case collision、SQL/Source pin wait、实际 READ COMMITTED 缺失状态行的 u0 插入等待且重试拒绝、晚失败/rollback close/captured factory、issue/status/revoke ACK loss/no COMMIT/later owner拒绝、issue/revoke 六个真实 native 退出点及完整 actual gateway owned HTTP 全覆盖。所有 SQL connection 实际 SELECT DATABASE() 后缀 _test+explicit mutation opt-in；无 production userdata/secret/FK/official network/完整 NoneBot registration 断言。

最终 QA 447.75s/421.340MiB sampled、high/max/OOM=0；首轮全回归已通过后静态审计补强 READ COMMITTED 无状态行锁，定向及最终整套重跑留独立证据；实际 wrapper exit0+journal success+collected MainPID0/cgroup gone，owned child/listener/root/rows finally 清理。证据：Viewer docs/taiko-domain-extraction/evidence/phase6-token-issuer-validation.json。A f0a2624 / 9.81.9 已标准 commit/push，远端 main 已核对；未复制 R，所以 running Bot/API 未加载此代码，本子步不重启。Viewer 0.82.0 留档随标准部署统一 push；live 0.81.11/PIDs 1063394、1063408、829173 unchanged。Gate 6 IN_PROGRESS，继续 arbitrary Source/QQ/Hiroba service grant、Viewer sync/actual dispatcher/u0/daily/all Writer、P1a/Read Model/百万成本/运维恢复与最终激活。


## 6.3e.7 已登录 Viewer 同步与实际 dispatcher Writer

实际 R dispatcher 比 A 多 Wahlap refresh/404/nonzero 行为及 target description。本步冻结两份实际 R 文件并记录 SHA，保留真实刷新→压缩/读取→本地快照与完整健康 DTO、full/delta/删曲/顺序/原始字节；R 原文件未改。新 Source Writer 显式重用同一 EX，current+本地 H 单次发布，H 名加 sequence/UUID，保留原 _meta.ts/source 与独立观察，避免同秒覆盖与读后旧值覆盖。Wahlap 刷新和 local target 仍是两次独立 C/H 提交；SQL 晚失败不会自动撤销已授权成绩。

正式 Viewer 使用真实登录 Cookie user.id 和捕获的完整 binding identity；HTTP body 的 userid/userId/taikoId 不构成 grant。通过私有 stdin CLI，由 worker 独占 Source EX→SQL owner/all bindings→nonce/cooldown→刷新/分发→完整授权复核→一次日志与最小 request receipt COMMIT。Node parent 不持 EX 等待 child EX；返回前 fresh SH+captured pool 复核当前四字段、exact receipt/log id/hash。相同已提交 optional requestId 可跨 30min cooldown 确认原日志，无新 C/H；不声称现有浏览器自动持久保存 nonce。Uncertain ACK 只在尝试 COMMIT 后用捕获 factory 的 fresh connection、原 EX 和完整 current owner 证明 exact log/receipt；no-commit/later owner/log tampering 503。纯 userid gateway /dispatch 返回 410，不接受伪造 principal，不读 body/SQL/Source；targets/health 保留。Viewer 账号同步已不再调用旧 HTTP adapter；taiko-center 的 Wahlap 更新代理仍调用该 adapter，Hiroba 代理走独立 Python 任务。两条代理链均待 service-grant/Writer 迁移及客户端兼容验证，须在统一发布前完成，本步不把它们判为 PASS。

所有 runner 共用当前单 Viewer 进程内 2 active/8 queued/30s queue deadline；16KiB stdin、64KiB stdout、8KiB stderr、180s parent deadline/SIGTERM→1.5s SIGKILL，等待 close 后释放槽。CLI 自身 SIGALRM 180s，即使 parent 退出仍有独立内核上限；实际 2s 缩短测试确认 signal death/owner 与 Source 锁释放及重试，不冒称实际 Viewer parent death 测试。实际 pool 的 WeakMap 保存原配置，不重新读取全局 pool/DB secrets；worker whitelist env/absent proc env-file path/leaf module bootstrap，不启动 Bot aggregate utils/drawing preload。Multi-replica host gate/all-writer capacity review 待后续。

最终 120 publication Python（新增13）、170 domain Python（9 production+3 untouched full Bot routes excluded）、149 offline Node（新增11实际 worker transport）、335 actual guarded _test SQL（新增32完整 Cookie→真实 Node runner→private CLI→native PyMySQL/Source）及两组局部 TS 全 PASS。四类排队/final identity replacement、SQL owner pin、日志晚失败/rollback close、captured config/COMMIT ACK/no-commit/later owner/log tampering、五个实际 CLI退出点、真实独立 SIGALRM、nonce concurrent/replay/cooldown、实际 SQL locked song保留、local target failed log/refresh 404/502、SH lease loss 全覆盖。Remote replies 和 daily callback synthetic，后者仅核对 root；不冒称 official network、实际 daily计算/全 Writer、prod FK、完整 Nuxt/NoneBot 或线上 authenticated 验收。每个 native connection 都以 SELECT DATABASE() 后缀 _test 和显式 mutation opt-in 证明隔离；owned rows/root/child/listener finally 清理。

最终 QA 492.871s/435.266MiB sampled、high/max/OOM=0；actual wrapper exit0+journal success+collected MainPID0/cgroup gone。第一次 /dev/null secret-loader 拒绝已定位改正；静态审计补保留 R target description 与 native lifetime 后，定向/最终整套均重跑。证据：Viewer docs/taiko-domain-extraction/evidence/phase6-account-sync-validation.json，含全部受测源码哈希与四轮独立 QA artifact/unit。A 565a7da138b57d7e460e632372920e4191d99b90 / 9.81.10 已标准 Source commit/push，实际远端 main 一致，9个受测代码/fixture 的 commit hashes 全匹配；R 未复制，running Bot/API 没有加载本步变更，本源码子步不重启。Viewer 0.82.0 本地留档随统一标准部署 push；live 0.81.11/PIDs 1063394、1063408、829173 unchanged。

本子步 VIEWER_AUTHENTICATED_SYNC_AND_RUNTIME_DISPATCHER_PASS；Gate 6 IN_PROGRESS。继续其余 private/arbitrary Source/QQ/Hiroba/developer/proxy service grant、u0/daily/B cache/all Writer、P1a/完整 Read Model/invalidation/百万冷暖成本与 IO/RSS、trusted ops restore/cleanup/runbook、fixed deps/R sync/统一发布与真实线上产品验收。


## 6.3e.8.1 私有成绩读取与显式中心服务授权

正式 Developer userdata route 继续真实 quota，但 quota/开发者申请/HTTP userid 不构成 Source grant。有效 Cookie 或 active Developer token 仅访问其自有完整绑定，非 current/自有隐藏 binding 保留；跨账号由私有运维按 token id 登记明确 Source allowlist/scopes。没有默认全源权限，中心服务的 '*' 需要显式配置；同一用户的其他 token 与 Cookie 不能借用该能力。有效 session/token/account、完整 binding 或 service tuple/revision/expiry 在 Source SH 前后复核，不能在同一次读取中静默 fallback；manual SQL authority 删除后即拒绝尚未 outbox cleanup 的 canonical bytes。首次 actor SQL 前捕获 pool/Source root/kernel cwd，managed corruption/lease loss/SQL 故障固定 503，权限失效 401/403，健康完整 raw JSON/未知字段保持。

新增私有 stdin 配置 CLI：实际 SQL username+email 完整站点 operator proof，account→token→grant→audit 顺序、一次 COMMIT 与最小 durable audit；inspect 不变更权限，exact/concurrent replay 不覆盖后续撤销，late failure/rollback destroy/ACK loss/no-commit 验证。16KiB stdin/45s lifetime/2 DB connections，实际 SELECT DATABASE 与 mutation opt-in；无 HTTP grant 配置入口、无 raw token/secret argv、无 Source 成绩写入。详细选择、协议与运维：[source-service-operations.md](source-service-operations.md)。预留 mutation scopes 不表示代理已迁移。

先定向 41 SQL/两组 TS PASS，再 broad regression 149 offline +378 actual guarded SQL（新增43）/两组 TS PASS；审计后增加首次 SQL 前 Source paths capture 与 lease loss，最终定向 45 SQL/两组 TS PASS。现有335 SQL与149 offline所涉及的产品/fixture文件未再改变，只有新 Source helper 与其专用 tests 增加 hardening；两轮受测文件 SHA独立保存，不能把前一轮的文件哈希当最终哈希。Source9个 code/fixture SHA 与6.3e.7证据完全一致，因此120 publication/170 domain Python沿用此前实际结果，不冒称本轮重跑。初轮 manual_account_id 变更的错误分类失败已修复重跑。

Broad 473.66s/430.598MiB sampled，最终 40.326s/341.367MiB；high/max/OOM=0，实际 wrapper exit0/journal deactivated success/MainPID0/collected cgroup gone，owned children/listeners/roots/rows finally 清理。完整证据：[phase6-source-access-validation.json](evidence/phase6-source-access-validation.json)。不冒称上游真实网络、production FK、完整 Nuxt/NoneBot 或在线 authenticated验收。

本子步 PRIVATE_SOURCE_READ_AND_EXPLICIT_SERVICE_PROVISION_PASS；Gate6 IN_PROGRESS。A code/9.81.11/R/runtime unchanged，无 Source修改或同步，所以本步不重启 NoneBot/API；Viewer0.82.0本地步骤，按标准统一发布推送，live0.81.11/PIDs1063394、1063408、829173 unchanged。尚未为生产 token登记能力。继续 Wahlap旧 dispatcher caller、Hiroba private stdin/QQ bind grant/native writer、SDK/cache、u0/daily/all Writer/P1a、完整 Read Model/invalidation/百万成本与IO/RSS、ops restore/cleanup、fixed dependencies/R sync/统一发布与真实线上产品验收。


## 6.3e.8.2 中心更新代理、历史与 renderer 同一视图

正式 Wahlap 更新/Hiroba 同步/历史代理继续真实 quota，使用有效 Cookie 或 active Developer token 的完整自有 binding，或按 token 登记的 Source/scopes/revision/expiry。更新要求 owner binding 的平台匹配；manual 不允许外部 acquisition。parent 首次 actor SQL 前捕获 pool/root/cwd，不持 EX 等待 child；私有 stdin worker 在 Source EX 后锁定并复核实际凭据和完整 owner/service tuple，每次 C/H 发布前及最终只读 SQL COMMIT 前再次证明。Wahlap 原真实 refresh/local snapshot 保留两次独立观察，Hiroba 原真实同步保留一次 C/H；晚 SQL/transport/返回权限失败保留已经授权的成绩，不冒称跨文件/SQL 联合回滚或新增 nonce 重放。旧 requestSyncDispatch 现已无正式 caller；Hiroba 凭据 bind 仍待迁移，不能把同步 stdin 改造说成全部密码 argv 已移除。

返回在 fresh SH 内核对 exact produced commit/sequence、捕获的凭据/grant 和存活 lease。历史从 canonical raw 读取，保留原文件名顺序、_meta.ts、完整 full/delta/未知字段与无效 JSON 跳过；累计 32MiB 超限固定 503，不截断。renderer 的 current/H 使用同一 EX view 或默认 SH，七个冻结 AST 函数与实际未改 R 一致；previous song/dojo、两种 showAll 的 PNG 哈希用 synthetic PIL panels/columns 对照，不冒称全素材视觉验收。

Account/source 两类 worker 共用单 Viewer 进程 2 active/8 queued/30s queue；32KiB stdin/64KiB stdout/8KiB stderr，Wahlap 180s、Hiroba 900s，native 独立 SIGALRM，child close 后释放槽。凭据只经 stdin/捕获连接，不进入 argv；存储的 Fernet 密码在同一 SQL connection 读取解密，不在事务中调用隐式 DDL COMMIT。图片为 16MiB 以内的私有随机 nonce 文件，目录最多16个、1800s过期清理，Node 验证大小/普通单链接文件/SHA后保留原 DTO base64，并在成功/失败后清理。多副本 host admission 与总体容量继续后续审阅。

最终 Source 126 publication（新增6 renderer）/170 domain、client52（新增4 missing-token）、153 offline Node（15 worker transport）、409 actual guarded SQL（335 existing+45 source access+29 proxy）及两组局部 TS PASS。实际 Cookie/active token/service 与 native PyMySQL/Source/real worker 跑通；五个真实 child退出、排队/返回 binding/session/service替换、fetch后expiry、只读 COMMIT ACK loss、stored encrypted credentials、Hiroba resolved-id拒绝、private PNG暂存/超限/清理、history累计容量与projection loss均覆盖。所有 native connection 实际 SELECT DATABASE()=_test且opt-in1，上游/图片 panels 为 synthetic，测试库无生产 FK，owned child/listener/root/rows 清理。证据：[phase6-source-proxy-validation.json](evidence/phase6-source-proxy-validation.json)。

回归分两段：Source126/170先已通过，随后客户端因QA驱动错误选择系统Core0.1.1而在收集阶段停止；改为原guarded validator与固定Git安装Core0.1.2/Contract0.1.0后，client/TS/Node/SQL完整通过。两段受测产品哈希完全相同。最终后一段533.993s/502.090MiB sampled、high/max/OOM0，实际wrapper exit0+journal success/MainPID0/collected cgroup gone。客户端四个私有成绩 SDK 调用现在要求token，Hiroba等待900s；缓存授权与其余私有SDK未冒称完成。

本子步 PRIVATE_CENTER_UPDATE_HISTORY_AND_RENDER_VIEW_PASS，Gate6 IN_PROGRESS。A9.81.12与client0.2.1标准源码提交/推送的完整OID以中央证据为准；R没有复制这些预备代码，所以running Bot/API未加载，无本子步重启。Viewer0.82.0本地阶段提交，待完整Phase6标准部署统一push，live0.81.11/PIDs1063394、1063408、829173不变，未登记生产service能力。继续Hiroba credential/bind、QQ bind、permission-aware bounded cache、u0/daily/all Writer/P1a、完整Read Model/invalidation/百万IO/RSS成本、trusted ops与fixed deps/R sync/统一发布/真实在线产品验收。

## 6.3e.8.3 QQ 私有 metadata、一次事务与 nonce 恢复

三个正式 bind 路由保留实际每日 quota，改用 active Cookie/Developer token 的 verified QQ authority，或按 token 显式登记 principal+Source+bind scope。principal 与成绩 Source 是独立能力对象；nullable principals_json 同时迁移 grant/audit，Source-only 旧配置兼容，bind_* 缺少明确身份范围拒绝。普通 upsert 须有完整自有同平台 Viewer binding，manual 仍走创建/认领入口；服务返回/修改均检查全部成员 Source。selected service 不静默切 owner，大小写/格式不合并，完整授权在排队后/事务中/返回前复核。运维细节：[source-service-operations.md](source-service-operations.md)。

此 metadata 仅 SQL，Source C/H/sequence 不变，不在 SQL 后申请 Source 锁。共享 2 active/8 queued/30s admission，SHA identity GET_LOCK 等待 5s；account→credential→principal/target grant→bind rows→selection→receipt，一次 COMMIT。GET 不写 current/state，在内存恢复原 healthy 首项选择及 manual/u0 DTO。每身份最多128绑定、slot小于一百万；legacy表不一致/缺失manual authority固定503。两种 mutation 支持 requestId；最小 receipt 没有 raw Cookie/token/完整 DTO，same credential+grant+intent replay返回当前结果，不重复写入或覆盖后续选择。ACK不明由捕获pool新连接证明 exact receipt+outcome，未COMMIT不能报成功；rollback/release-lock不明销毁连接。

定向79 SQL与局部TS PASS，最终56 client/153 offline Node/443 actual guarded SQL（409 existing+34 new）及两组TS PASS；两个真实Node COMMIT前后退出、实际5s锁等待、同nonce并发、撤权/expiry/完整target替换/返回前session和QQ损失、failed rollback与ACK loss/captured pool、真实operator principal配置/audit replay、原DTO与no GET writes均覆盖。旧quota SELECT/INSERT并发导致第二请求503，修复为单条unique-key原子increment/cap；初稿误解auto-increment OK packet已依据实际数字头纠正，实际IP1/token2并发边界与重试通过。失败驱动缺opt-in在连接前拒绝、TS narrowing和destroy数量断言纠正均留档，不冒称初轮全通过。

最终567.064s/477.078MiB sampled，high/max/OOM0，actual wrapper exit0/journal success/MainPID0/collected cgroup gone。Source A未变9文件SHA与6.3e.8.2一致，沿用126 publication/170 domain Python PASS；本轮没有Source修改、push或R同步。SQL测试DB实际SELECT DATABASE()=_test且显式mutation opt-in，未复制生产数据或做生产mutation，测试库无production FK证明，owned rows/roots/children/listeners finally关闭。完整证据：[phase6-bot-binding-validation.json](evidence/phase6-bot-binding-validation.json)。

本子步PRIVATE_QQ_BINDING_TRANSACTION_AND_REPLAY_PASS，Gate6 IN_PROGRESS。client0.2.2三个SDK增加token要求与可选request_id，固定Core0.1.2/Contract0.1.0不变，源码标准commit/push；Viewer沿用Phase6预备0.82.0本地步骤，统一标准部署负责push/build/restart。live0.81.11及三个服务PID不变，没有生产service登记或线上授权烟测。Hiroba credential status/bind的旧argv/多次credential与QQ autocommit、B旧缓存fallback，以及全Writer/u0/P1a、完整Read Model/invalidation/百万IO-RSS成本、trusted ops/fixed R deps/停止旧Writer后sync/标准发布与在线Gate继续处理。


## 6.3e.8.4 Hiroba 凭据授权、纯 discovery worker 与 SQL 一次提交

两个正式Hiroba凭据路由保留真实每日quota，要求有效Cookie/Developer token的完整自有外部binding，或显式token级Source/scope；普通绑定必须预先拥有同平台Hiroba binding，服务绑定另须明确principals。发现的目标卡片和返回QQ全部成员逐项授权，manual拒绝，selected service不降级为owner。首次actor SQL前捕获pool/root/cwd及worker key，等待/事务/receipt INSERT后完整复核；另补QQ回执INSERT后的expiry proof。详见[source-service-operations.md](source-service-operations.md)。

native worker只运行原playable-card discovery、兼容Fernet加解密和keyed HMAC意图，不连接SQL、不写credential/token/成绩文件。密码仅经私有stdin，旧无授权Hiroba adapter返回410，原password argv machinery退出。状态保留无凭据false，损坏密文固定503；卡片顺序、target过滤、空结果、manual/current完整DTO及legacy Fernet oracle保持。SQL一次事务保存全部凭据、可选QQ metadata/current state和最小receipt，C/H/sequence不变。操作nonce先GET_LOCK5s，有卡片的QQ另用原principal gate；共享2 active/8 queued/30s admission。stdin32KiB/stdout16KiB/stderr8KiB，crypto30s/discovery180s/native独立SIGALRM/TERM后1.5sKILL等待close，客户端timeout300s；configured_by_qq扩至191。

已提交同actor/grant/keyed intent nonce跳过登录与重写，返回当前QQ选择，不重置后来selection；不相关自有binding新增不使回执失效，已选binding撤销拒绝。ACK不明仅在捕获pool的新连接证明exact回执、credential及当前outcome才成功；no-COMMIT仍503，rollback或named release无法证明销毁连接。receipt不保存raw密码、token或完整DTO。

最终134 Source publication/credential（126+8）、170 domain、59 client、158 offline Node、477 actual guarded SQL（443 existing+1 QQ receipt proof+33 Hiroba）和两组局部TS全部PASS；14 Source/43 Viewer/5 client受测文件最终SHA未变。真实Cookie/token/SQL/native CLI、三个discovery等待撤权、receipt后expiry、captured pool/root/key替换、failed rollback/ACK loss、并发nonce/5s锁、两次实际Node COMMIT前后死亡、native失败/死亡/独立alarm、long official principal、旧adapter410和完整healthy DTO覆盖。最初SQL fixture遗漏Source sys.path导致106项中22项启动失败，修正后focused110及hardening38通过；final使用最终IO禁止guard再完整重跑，不冒称初轮通过。

最终QA 728.739s/513.129MiB sampled/high-max-OOM0；systemd journal成功终止，MainPID0/collected cgroup gone。每个native SQL连接实际SELECT DATABASE()=_test且显式mutation opt-in，未复制生产个人数据、凭据或做production mutation；owned rows/root/listener/child清理。上游回复synthetic，测试库缺production FK，不冒称official network/full Nuxt/full NoneBot/线上authenticated或全Writer Gate。完整证据：[phase6-hiroba-credential-validation.json](evidence/phase6-hiroba-credential-validation.json)。

本子步PRIVATE_HIROBA_CREDENTIAL_TRANSACTION_AND_REPLAY_PASS，Gate6 IN_PROGRESS。Source9.81.13与client0.2.3标准提交/推送OID以证据为准；Viewer0.82.0本地步骤，待完整Phase6标准部署统一push。运行R未复制、NoneBot/API未加载本步代码，不在源码步骤重启；live0.81.11及三个service PID不变。继续permission-aware bounded cache/native Bot凭据及QQ Writer/u0/daily/all Writer/P1a、完整Read Model/invalidation/百万冷暖IO-RSS成本、trusted restore/cleanup/runbook/fixed R deps/停止旧Writer后sync/统一发布与真实在线产品验收。

## 6.3e.8.5 私有读取缓存与 u0 客户端迁移（IN_PROGRESS）

2026-10-12 checkpoint。私有current/history每次到中心完成实际quota、完整actor/resource proof、SH/content读取和返回前复核，才允许精确ETag 304；private/no-cache/must-revalidate和Vary Authorization/Cookie。SQL资源查询后的会话失效窗口已补凭据复核。已验证的Source publication header用于current/history同代读取，变化时最多重试一次，无verified header不冒称同代。

B provider改为序列化LRU，64项/32MiB总量/4MiB单项/30s，key包含中心地址及token哈希、Source和类型。每次lookup仍请求中心，401/403/429/503、超期、网络失败均无旧数据fallback，返回对象为caller副本。取消普通Source-ID磁盘填充和Hiroba状态TTL；常规隐式current loaders统一provider。本地FastAPI成绩/历史GET必须带caller自己的Bearer，不把配置的Bot token借给匿名HTTP请求，真实401/403保持。

当前113项guarded client（含15个实际loader/命令函数和4个真实ASGI权限用例）、90项真实SQL（16 conditional+45 access+29 proxy）及局部TS通过；SQL101.815s/467.340MiB sampled/high-max-OOM0，wrapper实际exit0/journal成功/collected cgroup gone。初轮网络guard拒绝MockTransport、89 SQL中的两个晚会话失效和一个quota测试错误均如实记录。[进度证据](evidence/phase6-private-cache-progress.json)的hash为checkpoint后采集，不是完整最终验收。Source新增外部提交至9.81.15/2a27f09，整个taiko树相对本任务5c99dbd未变，保留其他项目改动；126+8/170 Source结果沿用原证据，未冒称重跑。

缓存步骤未完成、不得发布：u0仍依赖本地读取/合并/文件写入，而新provider已经不再填充这些文件。选择将u0迁到中心，统一证明principal、全部成员Source和同时持有的SH input views；B仅消费中心结果。还需历史loader/public bearer fallback、渲染current/history joins、u0/完整full-delta/未知字段Golden和最终回归，再版本化提交/push客户端与Viewer步骤。当前implementation未提交，client仍0.2.3、Viewer预备0.82.0，线上0.81.11及三个PID不变，无R同步/生产grant/部署。Gate6继续IN_PROGRESS，全Writer/P1a/Read Model/成本/运维及最终激活要求保持。

## 6.3e.8.5a 中心 u0 多成员私有读取（STEP_PASS；缓存轮仍 IN_PROGRESS）

2026-10-12。u0 current/history正式路由现在由中心授权、合并；B resolver不再获取各成员写本地文件或调用materializer。内部 `u0v1_` 为principal的严格base64url编码，完整保留官方身份尾部/大小写，拒绝非canonical编码；不依赖旧sanitize字符串的逆推。u0要求当前virtual状态、至少两名official成员，manual排除，profile保留旧客户端排除manual后的index clamp。所有绑定行包括manual仍在principal capability/membership proof内。

一个native worker按Source排序取得全部canonical SH；所有lease ready后才允许Node获取principal gate并开始SQL，派生前后锁内完整证明actor、principal policy、membership/current state及每名Source的授权。ordinary须verified QQ和完整自有同平台Source；service须明确bind_read/principals与所有成员的source_read，合并history因追加当前观察还须history_read。worker没有SQL连接/secret，也不写u0文件；只消费同时捕获的canonical views及公开combo参考，legacy member不冒称同代。

复用旧中心合并规则，冻结2a27f09的full/delta、removed、无效JSON、equal timestamps、current早于末H的append顺序、profile/dojo、stage totals与未知字段Golden。history两遍扫描，只保留紧凑timeline与每成员相邻状态，扩展输出有32MiB累计上限；manifest向量/输入也分别32MiB，最多128成员，一个worker；stdin32KiB/stdout32MiB/stderr8KiB，ready45s/derive90s/native180s alarm/TERM-KILL/child close；共享既有2 active/8 queued/30s admission。current采用原incremental materializer的最大current file mtime，不将请求时间伪装为新成绩，也不把mtime当play/ready evidence。

普通Source条件GET与u0都必须先真实quota、授权及原文/对象证明，随后才可精确304；single header为v1 commit/sequence，merged header为覆盖完整member vector、profile及binding state的SHA digest，两种语法明确区分。current字节未变/H-only新head时，304仍携带新的验证向量。B同代current/history最多一次fresh重试，合法adopted sequence0也可核验，不对legacy header缺失作可信声明。

12 Source（8新+4旧）、最终120 guarded B、140 actual SQL/HTTP（15 merged+35 QQ+90现有私有读）和局部TS PASS。最终SQL157.239s/463.133MiB sampled/high/max/OOM0，wrapper exit0、systemd journal successful、owned cgroup/listener/worker清理；实际_test DB/opt-in guard，无生产复制或mutation。失败轮分别为AST fixture缺lineno、Source被误放到B的Core0.1.2 pin及Node identity module不必要引入service导致fixture注册前收集失败；修正后完整范围通过，[证据](evidence/phase6-merged-read-validation.json)记录实际范围/文件hash/日志，未冒称全Phase6或线上验收。

Source按9.81.16标准源码commit/push；Viewer0.82.0本地步骤commit，全部Phase6完成后才标准部署/push。运行R没有新module/entrypoint，未同步/重启；线上0.81.11与PID1063394/1063408/829173不变。B仍0.2.3、缓存轮未完成且代码未发布：下一步历史磁盘loaders与renderer current/H joins/public bearer fallback，随后完整回归/版本提交/push。Source native u0物化Writer、credential/QQ/daily全部Writer/P1a、Read Model/invalidation/百万IO-RSS、trusted ops/fixed R deps及旧Writer停用后的统一激活与真实产品smoke继续待做，Gate6 IN_PROGRESS。

同轮追加校准（Source9.81.17）：公开combo表会改变同chart的最佳记录选择，故合并标识还须包含公开参考与明确merge/history/clock profile的 `ruleRevision`。worker ready前载入并固定map，Node验证SHA并纳入整个digest。新增真实A/B选择反转样例，private Source head相同而ruleRevision及输出改变；禁止仅凭private heads把两次不同规则结果配成一代。追加后最终13 Source（9新+4旧）/120 B/140 SQL/局部TS全部通过，最终资源、代码hash、两个Source提交/push和Viewer本地提交以[证据](evidence/phase6-merged-read-validation.json)为准。缓存轮及Gate6继续IN_PROGRESS，下一步历史loader/joins/fallback与完整Read Model输入版本收敛。

## 6.3e.8.5b 客户端历史与缓存源码轮（CODE_ROUND_PASS）

2026-10-12。默认私有历史 DTO 保持兼容；可选 `?format=raw-v1` 返回原文件名与canonical manifest捕获的mtime/ctime。readonly bridge在原lease内验证字节并读取metadata，拒绝invalid key/corruption/staging；projection丢失不改变结果。u0返回带微秒的合并配方filename，不伪造文件stat，C/H版本向量与profile/规则依赖仍由中心统一证明。实际serialized output包含重复timestamp/metadata预算，不截断健康历史以掩盖容量失败。

B所有隐式private current/history loader每次fresh中心授权；原disk/stale fallback和本地u0物化删除。新history adapter纯解码与host profile保留旧trend full/delta/removed、filename+mtime排序、previous歌曲/dojo状态和Dani reverse-filename选择；趋势逐点计算，不保留所有重建状态。Update/B30/current Dani使用一组verified C/H，变化最多重试一次；Summary计算使用其同一current歌曲集合。默认SDK旧DTO与explicit trend旧DTO仍兼容，新private loader拒绝缺少ordering metadata的非空历史。local bearer在实际center fetch前后复核，本地token删除/轮换/映射变化和中心错误均不返回私有数据。旧native Hiroba/scores Writer在IO前410，旧函数保留作未激活阶段回退；不宣称native token issuer/credentials/QQ最终迁移完成。

最终 guarded B153（既有warning2、无skip）、Source62+5subtests、Node/Python pipe12、真实SQL/HTTP143、局部TS通过。B冻结adae96e的原filesystem函数，用owned files分别对照trend/update/dojo/Dani；daily/playcount聚合用确定性非空计算值验证流程，Core算法Golden沿用既有Phase4范围。实际Update以小PIL panel输出PNG，B30/Dani准备函数捕获输入直到渲染边界，不冒称完整assets或NoneBot/上游真实authQA。SQL实际SELECT DATABASE()=_test、explicit opt-in1；SQLite实际PRAGMA database_list验证owned路径。无production数据复制、SQL mutation、service grant登记或私有storage读取。

跨仓库unit172.261s/采样peak504815616 bytes（481.43MiB），high/max/OOM0，journal successful/inactive、cgroup退出；该unit测client150，其后仅B变更禁用旧Writer/移除unused常量/版本0.2.4，再独立完整跑153，无理由不重复未变的Source/Viewer。所有代码hash、日志hash、unit/session与范围见[新证据](evidence/phase6-client-history-validation.json)，先前8.5a证据不覆盖。Source e87722b /9.81.18及B47bf5c1 /0.2.4已commit/push，实际远端HEAD相同；仅Bweb.conf/v1_test_report.md用户工作保留，Source miku与Viewer原growth/release报告保留。

Viewer0.82.0本步本地预备提交，待统一标准脚本部署/push；线上0.81.11、PID1063394/1063408/829173未变化，R无taiko_store且未同步/重启。本源码轮完成不等于Phase6 Gate PASS。继续native Bot credentials/QQ/token issuer与Source全部Writer/u0/daily/P1a、Read Model/Goal-measurement merge/invalidation、百万cold-warm IO/RSS和bridge容量复核、trusted restore/cleanup/runbook、R固定依赖与旧Writer停用后的统一激活/真实产品在线验收。

## 6.3e.8.6a 原生 Bot 绑定元数据范围（子步 PASS，authority轮 IN_PROGRESS）

2026-10-12。Native Bot的整张bind表加载改为明确1–3身份键、每个normalized principal128行上限；索引候选+BINARY精确比较保留官方case/尾部下划线，不从普通请求推测bareQQ别名。QQ迁移明确source/target/rawQQ键。原ids/current_index/current_slot/sources DTO冻结e87722b一致，u0/真实current保留。非法/混淆/重复/多current/超容量拒绝，DB错误固定且连接关闭。无人调用的全表回写入口删除。普通getter同样精确比较，current entry只用一次metadata，不借旧info的id重建删除绑定或覆盖新选择。此metadata不是Source授权；其余Native操作/高层fallback继续逐个收敛。

最终Source153（132既有+21新，9旧production/real例排除，warning1）、真实MySQL子进程1个复合用例PASS。实际changed getter/loader AST及真实SQL验证hidden/u0/current/case alias，非完整NoneBot注册；旧u0测试只更新mock接口，未计入执行。首轮误用compute-only导致旧recommend renderer缺符号（150pass/1fail），QA环境修正后151通过；追加getter与old-id fallback校准后153最终通过。日志及失败轮均保留。最终9.845s，sampled peak201609216 bytes，child OS maxRSS215416KiB另列，high/max/OOM0，unit success/inactive/no cgroup。SELECT DATABASE()为_test、explicit opt-in1，仅owned synthetic行/root/child，无生产数据或SQL变更。[完整证据](evidence/phase6-native-binding-metadata-validation.json)。

A331314d/9.81.19与458ceae/9.81.20标准commit/push，实际remote已核对；B47bf5c1/0.2.4未变，Viewer0.82此步测试/文档本地待统一标准部署push。live0.81.11与三个PID不变，R未同步/重启。native authority整轮/Gate6仍IN_PROGRESS，继续binding mutations/visibility/migration named gates与credential/token issuer、全部Source/daily/u0 Writer/P1a、Read Model/invalidation/成本/ops、固定R deps/旧Writer停止后的统一激活及真实online产品验收。

## 6.3e.8.6b 原生 Bot 绑定事务与所属凭据撤销（子步 PASS）

2026-10-12。四个真实原生入口 `_upsert_bind_record` / `_switch_bind_record` / `_remove_bind_record` / `_set_taiko_bind_visibility` 收敛到独立 SQL-only mutation 模块。锁名精确复用中心 `sha256(JSON.stringify(principal))`、5s named gate，再完整锁定/验证最多128条bind及selection state；明确顺序principal→bind→state→credential，不在SQL后取得Source。所有连接为请求独占，异常/rollback失败也finally关闭。索引候选中遇到case-colliding principal或state拒绝，避免旧CI unique key把另一个官方身份的state覆盖；重复、双current、非法Source/manual类型、槽位与超容量拒绝。

旧删除先用另一条连接删全局Hiroba凭据、再COMMIT bind，现以同一cursor删除精确 `configured_by_qq=sender principal` 的凭据和bind，外部/旧raw-QQ owner保留，不凭公共Source-ID清理别人凭据。删除保持原顺序/current，临时槽位高于已证明max，规避固定+1000/gapped slot碰撞；单成员时持久u0归0，空成员时删state。原生u0继续支持manual成员，保留与客户端external-only profile的产品差异；manual attach/remove仍须专用authority。新增使用空槽，可见性失败按服务暂不可用处理。

结果DTO在同一事务内复读/校验后COMMIT；回复无需另一连接重构。最后绑定确认直接保存已证明的ID/TTL，空值或槽位不能作forced target；confirmation handler无二次metadata选择。已完成的动作在manual nickname/摘要读取失败时仍回复成功和固定重试提示，无私有SQL日志或错误泄漏。native COMMIT响应不确定只报unavailable，不自动重放位置删除；本子步没有durable native nonce receipt，不声明exactly-once，也没有把metadata DTO当Source permission。

最终182 Source（132旧offline+21 metadata+29 mutation）、13真实guarded MySQL复合用例全PASS，9旧production/real例排除、warning1。新复合测试通过实际AST adapter运行保留u0文件中3个选定command regression；其余u0/QQ和NoneBot全注册未运行。冻结458ceae删除参数10输入一致；实际SQL覆盖hidden/new/existing/u0/manual/visibility、foreign凭据、slot/cap、case/state、Node持相同锁5s timeout、late SQL error/rollback失败、COMMIT前后error与两次真实进程退出的凭据-bind原子性/锁清理。每条native连接实际SELECT DATABASE()=_test且opt-in1，全部数据/行/root/子进程由fixture拥有，无production private data复制/SQL mutation。

32.845s，250ms sampled peak216309760 bytes（非绝对峰）；largest child OS maxRSS219420KiB，high/max/OOM均0，wrapper44228实际exit0、unit1791746555-1846060 successful/inactive/MainPID0/collected cgroup gone。中间177/181 Source与13 SQL通过后分别补确认/摘要问题，再跑最终完整轮；hash为最后轮后且实现无后续改动。[完整证据](evidence/phase6-native-binding-mutation-validation.json)。

A `9befec4209e8ef48db953a99fc41e723c76eb253` /9.81.21标准push且实际remote一致；仅本步6文件，无无关miku改动。Viewer SQL测试和文档本地提交，预备0.82.0待统一标准发布；B0.2.4未改。运行R未复制、新模块未加载，三个服务active且PID1063394/1063408/829173，线上Viewer0.81.11。不在native authority与旧Writer/P1a门禁未完成时同步重启。Source回退458ceaee；native整轮及Gate6仍IN_PROGRESS。继续原生Hiroba credential bind/sync/认证QQ联接、客户端token issuer/绑定删除、native读取与返回proof、全部Writer/daily/u0/P1a、Read Model/依赖失效/百万冷暖成本、trusted restore/cleanup/runbook/固定R依赖/停止旧Writer后的统一部署与真实在线产品验收。

## 6.3e.8.6c 客户端删除与可见性中心事务（STEP_PASS）

2026-10-12。B 删除解绑移除本地 SQL/JSON authority，使用中心 authenticated GET 解析具体账号和 remove POST。最后一个账号的确认保存中心返回的具体 ID/TTL，强制确认拒绝位置/空目标。可见性改为整个 principal 的 visibility POST，不通过 upsert 重建选择。手动账号删除仍走专用生命周期。删除当前账号保留冻结客户端后继选择规则；原生 Bot profile 与含 manual 的全局 u0 不被重写。

中心两项操作要求显式 bind_remove / bind_visibility scopes、principal 和全部成员 Source。共享 principal gate、完整 SQL 证明和一次 COMMIT；精确所属 Hiroba credential 与 binding 同事务删除，其他所属保留。小型 effect/hash receipt 固定原操作结果，重试返回当前绑定，不删除后来重新绑定的 Source、不覆盖后来可见性/选择。未知 COMMIT 在释放旧连接/gate 后用 captured pool 新连接证明。新增 nullable receipt 列兼容旧 upsert/current intent hash。

B SDK 最多两次相同 nonce 请求，响应流式 256KiB；90s 分块检查加最长 10s socket 等待，不宣称严格 90s 进程期限。401/403/404/409/429 等保持错误、重定向拒绝，无本地权限 fallback。framework message identity 固定 nonce，删除位置解析后只提交具体 ID，确认操作使用新的消息 nonce。

最终181 guarded B、局部 TS、66真实_test SQL/HTTP PASS；同轮此前未变的33 Hiroba+45 access PASS，共144项分属两轮。覆盖5个 frozen client 删除选择 Golden、actual Python SDK/命令AST到owned H3、确认/重绑重试、全成员授权、late撤权/SQL/rollback/ACK loss、四个 COMMIT 前后真进程退出。上游synthetic，非full NoneBot/Nuxt、线上authenticated或百万性能。72.334s/533839872byte cgroup250ms采样、child399568KiB、高压/OOM0，systemd success/ExecMainStatus0/MainPID0/cgroup gone。

初轮 fixture/TS/SDK guard 失败如实留档；初始化失败遗留66测试QQ行通过失败时间窗/生成QQ/缺失parent/状态与连续user ID逐条证明，同事务精确删除、remaining0，actual SELECT DATABASE()=_test及双显式opt-in，无production mutation。fixture setup现在受finally清理。完整[证据](evidence/phase6-client-binding-mutation-validation.json)。

B0.2.5/a8f1b38标准commit/push和实际remote SHA核对。Source A9.81.21代码/hash未变，182 Source之前证据沿用而未重跑。Viewer0.82本地预备，线上0.81.11及三个PID不变，无R同步/重启/部署、无启动客户端。该版本依赖中心0.82协议与显式生产grant，独立源码push不代表已激活。native authority整轮/Gate6 IN_PROGRESS，继续native Hiroba/QQ、client QQ/token issuer、全部Writer/P1a、Read Model/invalidation/百万冷暖IO-RSS、trusted ops/fixed R deps/旧Writer停用后的统一发布与真实产品验收。

## 6.3e.8.6d 客户端网页成绩 token 中心所属签发（STEP_PASS）

2026-10-12。私聊命令只使用发送者 principal 的中心当前实账号，不借用提及/可见他人绑定或本地 SQLite 的 ID 查询。隐藏自有实账号可用，u0/manual/他人/失效授权拒绝。Node 捕获 pool/runtime paths，Source EX→principal gate→SQL，前后证明 caller/grant、完整 Bot bindings/选择与普通 owner 的对应 web Source/platform，再用既有中心 token 表/48hex mask 一次 COMMIT 旋转。service 另须显式 score_token_issue、principal 与全部绑定 Source，provisioning 缺 principal 拒绝。响应 private,no-store 和 Vary credentials。

ACK 丢失只在仍持 EX、捕获 pool 新连接精确证明 token hash/mask/caller/current 后成功。客户端签发单次请求、不自动重试、不持久化含 token 的回执；再次用户命令明确旋转。通用绑定 transport 保持256KiB/90s分块检查/10s socket，旧删除/visibility两次nonce retry不变。旧无业务调用者的local bearer helper任何IO前410，历史未使用SQLite token schema保留待统一清理。

195 guarded client（171保留+24中心token用例，替代10旧local-authority用例）、既有绑定66 SQL、最终新token24实际SQL/HTTP+1纯provisioning policy及TS PASS。合计90实际SQL/HTTP和1策略检查，分属两轮，不冒称同一次全通过。实际Python SDK→owned H3、命令AST群聊/空/manual/u0/denied/private sender验证，late撤权/rollback/lease loss、Source/principal队列、exact ACK/captured pool与config替换、两个COMMIT前后真进程退出。原parity保留NoneBot module import，不宣称完整Bot启动/真实upstream/online。26.613s/471056384byte cgroup250ms采样、child361936KiB/high-max-OOM0，wrapper exit0/journal成功/MainPID0/cgroup gone。初轮150pass/3import fail与新Node文件注册失败（旧66pass）已修正、失败证据保留，无生产私有数据复制/写入。

B0.2.6/e275995源码与6ade2e1文档校准已标准push及实际remote核对，完整[证据](evidence/phase6-client-score-token-validation.json)。A9.81.21/12文件hash未变，沿用182 Source前轮结果未重跑。Viewer0.82仍本地预备，线上0.81.11/PIDs不变，R未同步、服务未重启、client未启动。native authority/Gate6 IN_PROGRESS；继续native Hiroba/QQ、client QQ迁移、全Writer/P1a、Read Model/成本/运维/fixed R deps/旧Writer停用后统一发布与真实online Gate。


## 6.3e.8.6e 原生 Hiroba 绑定事务与同步所属（STEP_PASS）

2026-10-12。Native纯discovery/Fernet加密之后，principal named gate→最多128行bind/state→按Source排序credential locks，全部凭据、绑定和首个发现账号current一次COMMIT。保留原生card顺序、target过滤、hidden及manual/u0 profile；删除无调用者的独立credential save/delete Writer。COMMIT未知仅固定查询后重试，不自动重放，不宣称native durable exactly-once。

同步单独捕获root、完整binding row/current与credential tuple，Source EX→同principal gate→SQL复核，publication和同canonical view的渲染/返回逐次证明。只有configured_by_qq精确sender才解密；其他owner/legacy凭据走公开同步，不借用密码。图片16MiB边界，保留渲染失败文字成功。合法C/H提交后发生晚owner/SQL失败保留观察但拒绝成功回复，未声称跨系统事务。绑定后同步失败明确账号已绑定、完成数量和切换失败账号重试；自有损坏密文保留固定重绑命令。

208 Source（132旧+21 metadata+29 mutation+8共享credential+18新）、38真实_test SQL复合用例（13旧+25新）PASS；9旧production例排除/1warning。两个选定旧绑定提示/损坏凭据测试运行实际AST adapter，实际update handler证明sender/image/all mode；无完整NoneBot注册。SQL覆盖single COMMIT、cap/late error/ACK loss、own/foreign/corrupt credentials、current/u0/Source拒绝、发布前后及render撤权、四个真实COMMIT/publication前后进程退出、5s同gate和资源清理。每个native连接实际SELECT DATABASE()=_test+explicit opt-in1，官方获取及render输出合成（非真实PNG/上游），无生产数据复制/SQL写入。

两次AST fixture适配失败（199/3及204/1，无SQL运行）已保留；205 Source/37 SQL中间PASS后补partial文案/credential行动提示/sender回归，最终完整重跑。72.488s、250ms sampled227680256bytes、child216204KiB，high/max/OOM0；wrapper24123 exit0、unit1791754427-1931821 success/ExecMainStatus0/inactive/MainPID0/cgroup gone，owned child/row/root清理。[完整证据](evidence/phase6-native-hiroba-authority-validation.json)。

A3e1d76e/9.81.22已标准commit/push和actual remote一致，仅本步9文件，不包含miku用户改动。Viewer SQL测试/证据本地提交准备0.82.0，B6ade2e1/0.2.6不变；R没有新代码，未同步/重启/部署，live0.81.11与三个active PID1063394/1063408/829173不变。回退Source9befec4、Viewer准备9511e47。native authority整轮/Gate6 IN_PROGRESS，继续认证QQ联接和客户端QQ迁移、其余private native readers/updates、全部u0/daily/maintenance Writers、P1a全部Writer停止后接管、Read Model准确依赖/失效、百万冷暖IO-RSS/限额、trusted恢复/清理/runbook/固定R依赖、统一标准Viewer发布及R同步重启/真实在线产品验收。


## 6.3e.8.6f 原生 QQ 验证码迁移事务（STEP_PASS）

2026-10-12。旧“输入QQ号即复制绑定”缺所属证明；原OneBot实际sender私聊申请128bit随机码，仅存SHA256、10min UTC TTL、60s申请间隔及canonical/bare完整绑定与state fingerprint。目标私聊提交“绑定QQ QQ号 验证码”，不同QQ/官方openid不能自述所属；OneBot自己对应bare QQ可直接迁移。所有source/bare/target principal gates及SQL reads固定排序，单条principal最多128行；无Source/文件/网络锁，业务请求无DDL。Viewer统一schema新增表，须在最终R激活前创建。

一次COMMIT处理绑定合并、源真实is_current选择、精确source/bare所属Hiroba credential转移、验证码消费和小型hash-bound effect。保留canonical优先/bare fallback、源顺序后目标去重、目标首行visibility或源默认、源绑定记录保留；目标manual保留，源manual须专用认领。拒绝来源冲突、容量/case/过期/错误码及任何source binding/state变化。修正旧未排序首行替代真实current的选择缺陷；不改变native u0含manual定义。凭据owner迁至目标，原source不能借用新owner密码，仍可公开同步/重新登录。

同码同target消费后只读现在target绑定，晚解绑/选择不重放或复活，首次自动更新不重复；新码申请替换旧proof/receipt，非无限期exactly-once。未知COMMIT固定查询后重试，申请丢失明文响应不自动重放。摘要或首次自动更新错误不把已提交绑定误报回滚；其余普通Native更新authority仍待后续。私聊命令/usage/QQ按钮一致，码不进action log。

231 Source（208既有+23新）、70实际_test SQL复合用例（38旧+32新）和局部TS PASS，9旧production排除/warning1；另1保留QQ键盘/真实Bot payload序列化在现有Bot venv通过，无安装依赖、NoneBot启动或发消息。SQL覆盖hash-only/snapshot/TTL/cooldown/current/visibility/canonical/bare、manual/cap/case、own/foreign credential、late error/rollback/ACK、消费与申请COMMIT前后四个真实退出点、双目标并发、exact retry/损坏effect/两组5s同锁。每连接实际SELECT DATABASE()=_test+explicit opt-in1、owned rows/root/child清理，无production SQL/数据复制/HTTP。

主轮121.298s/250ms sampled331796480bytes/child354164KiB/high-max-OOM0，wrapper72487 exit0，unit1791755796-1948775 success/ExecMainStatus0/inactive/MainPID0/cgroup gone；独立keyboard0.816s/57143296sample bytes/child53088KiB成功清理。两次69 SQL pass/1 fail分别为故障注入双次抵消和旧os._exit QA GET_LOCK(0)与MySQL异步断连清理竞态；改一次注入及1s有界释放证明，未放宽运行锁。系统PythonQQ/pydantic冲突、Bot venv缺pytest均留档，最后直接执行保留AST+实际SDK。完整[证据](evidence/phase6-native-qq-migration-validation.json)。

Af04b320/9.81.23仅本步9文件标准push，remote一致；Viewer0.82.0源码/DDL/测试/档案本地准备，B6ade2e1/0.2.6不变，客户端QQ仍待同一中心事务接口。R未复制或重启，无部署，live0.81.11/三个active PID1063394/1063408/829173不变。回退Source3e1d76e、Viewer准备3d9c6d7；激活后不得回退开放不验证QQ号的路径。Native整轮/Gate6 IN_PROGRESS，继续client QQ私有接口/transport/grants/命令、其余Native private读写和startup SQL Writer、全u0/daily/maintenance Writers、P1a停止旧Writer后纳管、Read Model/精确失效/百万冷暖IO-RSS与限额、trusted恢复/清理/runbook/固定R依赖及统一标准Viewer发布/R同步重启/真实在线验收。


## 6.3e.8.6g 客户端 QQ 中心所属事务（STEP_PASS）

2026-10-12。B旧路径根据输入QQ查local SQLite/JSON，再多次upsert中心绑定，现统一private qq-code/qq-migrate接口→捕获pool/paths/env→有界stdin CLI→同一native SQL merge。新增明确bind_migrate service scope和principal；事务固定多principal gates→actor locks→bounded bindings/state，开始、读取后和COMMIT前证明live session/token、精确QQ owner或service十字段tuple及source canonical/bare/target现有全部Source。ordinary owner限已验证对应OneBot QQ，official目标需明确service subject，不推断QQ所属。credential转移/绑定/current/code消费同一COMMIT，Node响应前再用捕获pool复核grant。

申请单请求、不保存明文code重放；消费同码同target两次network/503 retry，self migration一次。不重置later selection/u0、不复活解绑、不重复自动更新；未确认COMMIT固定提示查询后重试。B退出local authority reader/merge/逐次upsert，保留历史table待统一cleanup。源顺序/explicit SQL current/target visibility（包括0）与manual专用origin lifecycle保持，target manual和既有native/client u0差异不改。命令/usage/QQ按钮一致私聊流程。

CLI64KiB输入/256KiB输出/8KiB stderr、45s独立SIGALRM、parent50s和1500ms SIGKILL grace；slot保持至close。严格operation/principal/QQ/bound/current/source/manual/Unicode响应，错误固定枚举与private,no-store/Vary。SDK继承256KiB streaming/90s分块检查/10s socket，无严格90s进程期限宣称；no redirect/token必需和无local fallback。policy Source排序与Node现有normalization一致。

最终241 Source（231旧+10 private frame）、223 client（195旧+28新）、TS和23实际SQL-HTTP+10纯worker transport PASS。之前未变的160实际SQL+1 provisioning policy另轮通过，共183实际SQL、11纯检查，不能合成一轮全green。实际Python SDK/command AST→owned H3/actual CLI/MySQL；session/self/bare/service/scope/subject/all Source、late actor/grant/QQ/rollback/未知ACK、四个COMMIT退出/独立期限信号、credential-bind-code原子、exact retry、unsorted allowlist/runtime replacement/private headers/quota/protocol/frame/Unicode回归。后追加同一retry composite u0保留再删除current不复活，1补充actual test PASS，非增加新unique case。无真实上游、完整NoneBot/Nuxt/online产品或百万性能。

61.846s/250ms sampled445947904bytes/child362448KiB/high-max-OOM0，wrapper25873 exit0/unit1791772648-2099982 successful/ExecMainStatus0/inactive/MainPID0/cgroup gone。补充3.522s/276811776bytes/child286960KiB、unit1791773091-2105724同样成功清理。每个private QA连接实际SELECT DATABASE()=_test+opt-in1，owned行/root/child/两loopback listeners清理。初轮161pass/21启动fail、focused21/22和pure worker23pass/1注册fail为fixture sys.path/base URL/Nuxt resolver缺失，修正并保存历史，没有修改生产依赖/绕过权限。[完整证据](evidence/phase6-client-qq-migration-validation.json)。

A926ad23/9.81.24与Bfa0983d/0.2.7仅本步6/11文件标准push、actual remote一致，不包含miku/web.conf用户改动。Viewer0.82源码/测试/证据本地准备，R未复制/重启、B无业务进程启动、live0.81.11和active PID1063394/1063408/829173不变；显式生产grant仍须统一激活。Core Source0.1.1/B0.1.2 pin未变。回退Sourcef04b320/B6ade2e1/Viewer准备afb3b0d；上线后不重开旧QQ自述复制路径。Native authority整轮/Gate6 IN_PROGRESS，继续其余Native private reads/ordinary updates/startup SQL Writer、全u0/daily/maintenance Writers与P1a停止legacy Writers后接管、完整Read Model/精确失效/百万冷暖成本、trusted恢复/cleanup/runbook/fixed R deps、最终标准Viewer发布/R同步重启/真实authenticated online Gate。
