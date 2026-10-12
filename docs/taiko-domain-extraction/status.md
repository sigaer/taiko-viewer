# Taiko Domain Extraction 执行台账

执行依据：[Execution Plan v2](../Sakura_Taiko_Domain_Extraction_Execution_Plan_v2.md)。用户已授权依序执行 Phase 0–6、逐步留档、阶段提交/推送，技术选择自行决定。日期均为 Asia/Shanghai。此台账不沿用 Annual Poster Phase 字母 Gate。

Goal：`active`。Phase 5 标准发布与只读线上验收完成，Gate 5 PASS；开始 Phase 6 ownership、publication、Read Model 与 storage 决策。先前内存准入阻碍已解除，历史记录保留。

当前6.3e.8.6i子步PASS：Native u0改为同时锁定成员canonical SH→派生EX、同事务发布current/history，以成员commit/顺序/profile/active merge rule验证依赖；退出stat缓存、旧启动SQL/JSON绑定Writer。冻结初次/增量字节一致，319 Source+40发布/备份+4补充检查分轮PASS，另25故障子场景；A9.81.27/d4a9d22已标准push并核对remote。[证据](evidence/phase6-native-u0-publication-validation.json)。Native私有读取整轮/Gate6 IN_PROGRESS；继续daily/maintenance Writer、P1a、Read Model/成本/ops/统一激活。Viewer0.82本地准备，live0.81.11/R/PIDs不变。

| Phase | Gate | 已完成 / 待完成 | 证据 |
| --- | --- | --- | --- |
| 0 Extraction Audit | PASS | 清单、分类、重复、数据流；无实现变更 | [审计](../taiko-domain-current-state-audit.md)、[复核](evidence/phase0-validation.json) |
| 1 Contract Freeze | PASS | 身份/Chart/Score/Growth + CalculationProfile 冻结，10 项 Golden/validation | [验收](phase1-contract-freeze.md)、[证据](evidence/phase1-validation.json) |
| 2 Core v0.1 | PASS | 四步依序提交；独立 repo/tag，15 项 installed-wheel tests | [验收](phase2-core-v0.1.md)、[证据](evidence/phase2-validation.json) |
| 3 Sakura adapter | PASS | Core 0.1.1 / Sakura 9.80.7；132 regression、生产重启/adapter/HTTP smoke | [验收](phase3-sakura-adapter.md)、[证据](evidence/phase3-validation.json) |
| 4 taiko-bot client | PASS | Core 0.1.2 / client 0.2.0；188 委托、48 回归、固定 Git pin / wheel 安装 / command smoke | [验收](phase4-taiko-client.md)、[证据](evidence/phase4-validation.json) |
| 5 Viewer boundary | PASS | 5.1–5.3 / 230 Node + 5 Python PASS；0.81.11 标准 push/deploy、8 项线上 smoke、旧进程退出/新进程 active | [步骤](phase5-viewer-boundary.md)、[验证](evidence/phase5-validation.json)、[发布](evidence/phase5-publication-validation.json) |
| 6 Writer/storage | IN_PROGRESS | 6.1/6.2、6.3a–c、6.3d.1–9、6.3e.1–7、6.3e.8.1–4、8.5a/b及8.6a–i留档；最新Native u0/启动Writer 363分轮检查+25故障子场景；国服/QQ所属前轮证据保留；待其他Native reader、daily/maintenance Writer/P1a、Read Model、百万成本/ops/统一发布 | [步骤](phase6-storage-consolidation.md)、[审计](evidence/phase6-ownership-audit.json)、[最新验证](evidence/phase6-native-u0-publication-validation.json) |

Gate 未 PASS 不进入下一阶段。代码存在、离线 test 或 Git push 不能代替未完成的生产验证。ROADMAP 版本作为阶段里程碑；Phase 0 禁止代码/package 变更，因此只提交文档，不为编号修改 package 或部署。

## 步骤日志

- 2026-10-10 / 0.1：三仓库 fetch main，HEAD 与 origin/main 一致；复核 runtime、entry、dependency、storage、API。记录原有未提交工作，不纳入本任务。
- 2026-10-10 / 0.2：1,180 源码 hash 与 1,840 tracked 路径分类，unknown=0。混合职责留有标记；已处理一个旧 transport 文件 hash 过期，当前与 HEAD 相同。
- 2026-10-10 / 0.3：确认 bot v1 重复、v2 accuracy/aggregation 分叉、target 推荐分叉及 Viewer normalization/fact overlap。
- 2026-10-10 / 0.4：明确 current/history/userdata 多 Writer 与消费者、cache/measurement/fact 区别。Gate 0 PASS。
- 2026-10-10 / decision：Python core；语言无关 contract；明确算法 profiles；保持 JSON/现有部署，storage 只在 Phase 6 决策。后续逐阶段生成验证和回退证据。
- 2026-10-10 / release-0：Phase 0 文档提交 `eabc6f7`，origin/main push 成功。历史审计证据随本阶段归档；其他原有报告保留未跟踪。
- 2026-10-10 / 1.1–1.5：Contract v1.0/package 0.1.0，Python/JS Golden 10/10，generated bindings 与 TypeScript check PASS；旧 Hiroba Oracle 固定 source hash。Gate 1 PASS，无生产 consumer 切换。
- 2026-10-11 / 2.1：Core models `5044daf`，身份与数值 dataclass；留 manifest。
- 2026-10-11 / 2.2：Core text parsers `0e41ab2`，旧 TJA/HTML/score 输出相等，clock 由宿主提供。
- 2026-10-11 / 2.3：Core calculations `8d14f5b`，保留 center/client v2 差异、显式输入与 full-score references。
- 2026-10-11 / 2.4：Core recommendations `675892a`；126/60/96 组 Golden；独立安装 wheel 15/15 PASS。Gate 2 PASS，tag `v0.1.0`，开始 Phase 3。用户创建的 Core 远端已可推送。
- 2026-10-11 / 3.1–3.3：Core 剩余纯内核 `9fc0731` / tag `v0.1.1`；23 installed tests；Sakura 132 offline regression，9 online-only 排除；命令源码相同、200 条合成记录画像及 5 个估分一致。
- 2026-10-11 / 3.4：Sakura `95d71d5` / `9.80.7` 已 push；两个 Python 环境安装固定 wheel；33 文件校验、备份、同步；无个人数据/DB mutation。
- 2026-10-11 / 3.5：NoneBot old exit/new startup、taiko plugin、QQ/OneBot、两个服务重启/GET smoke 全 PASS。Gate 3 PASS；允许进入 Phase 4。
- 2026-10-11 / 4.1：读取 taiko-bot AGENTS/status；保留 `web.conf` / `v1_test_report.md` 用户工作。无在运行业务进程；客户端算法/visibility/parser 差异继续显式保留。
- 2026-10-11 / 4.2：Core `0b7319d` / `v0.1.2` 已 push；29 installed-wheel tests PASS，52 runtime modules 无 IO/framework 越界。中心继续固定 Core 0.1.1；新增客户端 86 组输入样例与旧输出一致。
- 2026-10-11 / 4.3：客户端 14 模块 / 188 符号与规则表委托 Core；完整命令及 provider 源码相同，48 regression 与 installed-client import 已通过；正在做最终源码 pin 安装及规则表收敛后的重新验收。

## 发布约束

文档/纯离线 package 阶段只 commit/push，不触发 Viewer 构建。Viewer 运行代码变化使用 `scripts/memory/run_build.sh /bin/bash scripts/deploy_forum_web.sh "<HEAD subject>"`，脚本失败停止，不手动替换 output/重启。bot adapter 改动依据各仓库 AGENTS，避免覆盖现有用户工作；Core 明确版本 pin、可回退。所有新 QA 经 memory runner，无生产 DB mutation。

- 2026-10-11 / 4.4：客户端 `d501343` / 0.2.0 push 成功；两个私有 Git pin 安装并核对实际 commit/source；最终 48 regression、installed-client 14 模块 / real command import PASS。Gate 4 PASS；开始 Phase 5。Viewer 和中心线上依赖未改。
- 2026-10-11 / 5.1：当前/历史/daily archive 读取端口完成，原文 revision/provenance、历史排序/预取/stat 语义保留；219 regression 与局部 TypeScript PASS。Writer block 无变更；Phase 5 全步骤完成后统一版本化发布。
- 2026-10-11 / 5.2：Contract CanonicalFact / GrowthObservation 单一类型来源，History/Recent scope 验证；冻结 Golden、schema、Growth/Goal 兼容与 TypeScript PASS，证据单独归档。继续 5.3。
- 2026-10-11 / 5.3：Contract JS 0.1.1 只读 profiles；230 Node / 5 Python 全通过，百万合成记录 exact baseline DTO 一致 / 无 OOM。Writer/strict schema/Python mapper 不变；0.81.11 patch，进入标准发布验收，未提前 PASS Gate 5。
- 2026-10-11 / 5.4：实现提交 `cd4be76`；memory build wrapper 因可用内存低于约 12.65 GiB 拒绝，标准部署脚本未启动，尚未 push 或切换线上。准入失败已留档；等待维护窗口，不改限制、不手动发布、不进入 Phase 6。
- 2026-10-11 / 5.4-preparation：续行复核内存仍不足；补齐只读在线验收脚本，当前 0.81.10 的 8 项 SSR / anonymous GET 基线通过并留档，未冒称新版本已发布，生产无需账号/成绩写入。
- 2026-10-11 / 5.4-blocked-audit：第三轮复核同一 memory headroom 阻碍，约 11.81 < 12.65 GiB；无活动部署/QA/Annual job，live remote `060dc05`，线上 PIDs 不变。独立准备完成后无其他合规推进动作，Goal 标 blocked 并留恢复步骤；不提前 PASS 或进入 Phase 6。
- 2026-10-11 / 5.4-resume：Goal 恢复 active；可用约 16.88 > 12.65 GiB、PSI < 2、无 Annual worker。实现文件 hash 与 230 Node / 5 Python 验证时相同，JS contract 安装为 0.1.1，线上尚未切换；继续标准发布。

- 2026-10-11 / 5.4-PASS：标准脚本 exit 0，`eca1b08` 已 push 并发布 0.81.11；8 项 local/online SSR、401/cache GET 通过，旧 Viewer/receiver PID 退出，新 PID 1063394/1063408 active，NoneBot/public API 未变。Gate 5 PASS，开始 Phase 6；未把匿名 smoke 称为真实用户成绩验收。

- 2026-10-11 / 6.1：复核真实中心/Viewer/派生 cache Writer 和 R/A dispatcher 差异；选择单一 Infrastructure JSON publication + immutable read view、私有 file read model，现有身份/Goal/measurement DB 保留。开始合成协议实现；Gate 6 IN_PROGRESS，未部署 Writer。

- 2026-10-11 / 6.2：A `85c4251` / 9.81.0 已 push，单一 Infrastructure publication foundation / local bridge 的 19 项合成磁盘/进程验证 PASS；尚无运行入口引用，不同步/重启 R。开始 6.3 真实接入；Gate 6 IN_PROGRESS。

- 2026-10-11 / 6.3a：Viewer 有界本地 pipe 客户端的 6 个实际跨语言合成用例 + TypeScript PASS；原入口尚未接入。步骤本地提交，待 Phase 6 标准发布一并 push；继续 score read view / 真正 Writer convergence。

- 2026-10-11 / 6.3b：A `2d7bd9a` / 9.81.1 已 push，acquisition kernel RMW / lease reader；Viewer 0.82.0 预备版本，shared/account writer + Growth 单 view 本地步骤。24 Python、66 Node、TS 与 version test 1 全 PASS；约 280.11 MiB sampled cgroup peak，最终 OOM=0。早期测试 loader heap failure 已修复并重跑。未同步 R/未部署，继续剩余 Writer、授权与 Read Model，Gate 6 IN_PROGRESS。

- 2026-10-11 / 6.3c：Kinoko full/delta 与 current 同批次暂存/提交；SQL song lock 纳入 kernel fence、获取后复查完整 source identity。17 actual account/Kinoko 回归 PASS，约 95.86 MiB sampled cgroup peak、OOM=0；完整旧 H bytes/name/summary Golden 一致。Viewer 本地步骤，继续 manual 删除、dispatcher/u0、grant 与 Read Model；Gate 6 IN_PROGRESS。

- 2026-10-11 / 6.3d-audit：发现 Goal SQL→source 与新 Writer source→SQL/FK 反向依赖，及 manual rename 后 canonical manifest 仍存、多 owner 多事务与等待后 owner 检查缺口。锁顺序/生命周期收敛方案已留档；具体实现与故障/隔离 SQL 验证待执行，未提前 PASS。

- 2026-10-11 / 6.3d.1：Goal create/eval Source SH→SQL owner/binding；SQL 锁内完整 identity proof。消除 shared/publication native ESM 初始化循环。114 offline + 5 actual `_test` SQL、TS PASS；约 285.82 MiB sampled peak/OOM=0。测试库 FK 缺失明确留档，不重开 B-0/REFERENCES。未发布，继续 manual lifecycle 与全 Writer/Read Model。

- 2026-10-11 / 6.3d.2：A `69c4cac` / 9.81.2 已 push；独立 inode 的 verified C/H/daily 备份、五个 backup 与三个恢复真实死亡点、无旧对象库 portable restore、旧备份不能删除新代。40 Python + 43 Node、TS PASS，约 247.5 MiB sampled/OOM=0。Viewer 本地步骤，未同步/部署；SQL 生命周期/outbox 尚待接入，Gate 6 IN_PROGRESS。

- 2026-10-11 / 6.3d.3：Manual 成绩读写在 Source EX/SH 内重查 owner，visibility/claim/detach 同 fence；rename SQL rollback/lost ack 保留正确 nickname。提交前补偿保留原 ALS/EX，rollback proof 与补偿在同一重新取得的 EX 内。120 offline + 15 actual `_test` SQL、TS PASS，约 276.07 MiB sampled/OOM=0；日数据仅 generation timestamp 刷新，关系/索引未变。Viewer 本地提交，继续永久删除/receipt/worker，Gate 6 IN_PROGRESS。

- 2026-10-11 / 6.3d.4：A `8e3a48a` / 9.81.3；manual 永久删除一次 SQL transaction + 私有 backup/receipt、canonical/daily forward cleanup、bounded worker；43 Python + 127 offline + 27 actual `_test` SQL、两组局部 TS PASS，真实进程 commit 前/后/source 发布后退出与重试通过。约 316.875 MiB sampled/OOM=0；回滚失败销毁连接。未同步/部署，继续联动恢复、全 Writer/grant 和 Read Model；Gate 6 IN_PROGRESS。

- 2026-10-11 / 6.3d.5：A `fd7b52e` / 9.81.4；trusted SQL/source/daily 协调恢复、持久 restoring、authority 一次 COMMIT、已准入 worker 续做，普通删除不自动撤销。43 Python + 128 offline + 48 actual `_test` SQL（新增 21 restore）、两组局部 TS PASS，四个实际进程退出点/完整字节与 SQL fields-id-hash/new-binding-conflict/portable root/captured pool/driver 脱敏通过，约 311.106 MiB sampled/OOM=0。未 sync/deploy；继续 lifecycle/grant、全 Writer、Read Model 与最终发布，Gate 6 IN_PROGRESS。

- 2026-10-11 / 6.3d.6：认领/发码/解绑一次 SQL transaction 与最小持久授权回执；同 actor 已提交重试不重复授权/改变 current，legacy 多 bot 解绑保留存活 principal。43 Python + 128 offline + 73 actual `_test` SQL（新增 25 grant）、两组局部 TS PASS，六个 actual Node COMMIT 前后退出、晚 SQL failure/rollback destroy/ack loss/排队后 capability 替换/捕获 pool/SQL 脱敏验证；纯 grant 不改变 C/H commit/sequence，约 325.988 MiB sampled/OOM=0。Viewer 本地步骤，A unchanged `fd7b52e`，未 sync/deploy；继续创建持久恢复、通用解绑/注销/资源 grant、全 Writer/Read Model 与发布，Gate 6 IN_PROGRESS。

- 2026-10-11 / 6.3d.7：A `f3146cf` / 9.81.5 已 push；创建 durable reservation→固定初始 C/H→一次 SQL authority、bounded forward worker/optional request UUID；修复未提交 manifest 同输入 unchanged-parent retry。45 Python + 131 offline + 106 actual `_test` SQL（新增 33 creation）、两组局部 TS PASS，五个 Node/五个 Python 退出、完整冻结 raw parity、ack loss/concurrent/deleted owner/new selection/private diagnostics/oversize/archive 拒绝通过，约 339.645 MiB sampled/OOM=0。未 sync/deploy；Viewer 本地留档，继续通用解绑/注销/grant、全 Writer/P1a/Read Model、百万成本/运维恢复与统一发布，Gate 6 IN_PROGRESS。

- 2026-10-11 / 6.3d.8：通用解绑 Source EX→一次 SQL cleanup/current/最小 receipt、lost ack/concurrent retry；SQL-only selection 一次事务。Growth 四产品 SH 后/返回前完整 identity 复核，Recent ACK 持 SH 至 cursor COMMIT。45 Python + 132 offline + 139 actual `_test` SQL（新增 33 binding/source）、两组局部 TS PASS；两个 actual Node 退出、late failure/rollback destroy/排队后身份替换/long read/new publisher/captured pool 回归，纯 grant C/H commit/sequence 不变。约 350.895 MiB sampled/OOM=0，QA unit success/inactive/无残留 cgroup。Viewer 本地留档，A unchanged `f3146cf`，未 sync/deploy；继续 confirmation/其余 reader/grant、全 Writer/P1a/Read Model/百万成本/恢复与统一发布，Gate 6 IN_PROGRESS。

- 2026-10-11 / 6.3d.9：公开 exact profile→Source EX→SQL owner/原挑战及绑定身份复核→一次 grant/title/current/challenge/最小 receipt COMMIT；prepare replace 同样单 SQL transaction，replay 不重置 later selection。拒绝 wrong/unsafe numeric userid、manual reservation/98 legacy orphan；保留原 title-change 产品规则。45 Python + 132 offline + 169 actual `_test` SQL（新增 30 verification）、两组局部 TS PASS，actual Cookie prepare/confirm/GET/reload/re-login 与两个 Node COMMIT 退出、晚失败/rollback discard/ack loss/排队替换/captured pool/frozen DTO 通过；约 368.523 MiB sampled/OOM=0，unit success/inactive/无残留 cgroup。未 sync/deploy；继续实际 Python canonical Reader、其余私有入口/grant、全 Writer/P1a/Read Model/百万成本/恢复与统一发布，Gate 6 IN_PROGRESS。

- 2026-10-11 / 6.3e.1：A `5b61502` / 9.81.6 已 push；current 计算统一 canonical SH Reader，修复真实 Growth CLI loader alias；四个人产品等待后/返回前完整 identity proof、120s/12MiB bounded compute。53 publication Python + 132 既有领域 Python + 132 offline Node + 199 actual `_test` SQL（新增 30 personal，其中 2 actual Python）、两组局部 TS PASS；六 CLI frozen 非 timing DTO/projection loss/tamper/corruption、16 排队四字段 race、later selection/撤权/发布等待通过。最终 Node QA 254.409s/359.051MiB sampled/OOM=0，Python 已通过部分单独保留；Nuxt fixture/runner env correction 与所有权清理留档。未 sync/restart/deploy；继续其余 Reader/grant、全 Writer/P1a/Read Model/百万成本/恢复及统一发布，Gate 6 IN_PROGRESS。

- 2026-10-11 / 6.3e.2：账号档案/同步概览共用捕获 pool/完整 identity 的 SH proof；Viewer token EX→SQL owner/current locks→有界独立 gateway→SQL hash/mask proof，readonly ACK loss 精确确认、late failure 保留原 fresh issue 旋转。两组局部 TS + 136 offline Node + 236 actual _test SQL（新增 37 account source，真实 cookie/frozen DTO/16 替换/lease loss/锁等待/driver 脱敏）PASS；287.916s/372.555MiB sampled/OOM=0，wrapper exit0/journal success/collected cgroup gone。A 5b61502/9.81.6 unchanged，Viewer 本地留档，无 sync/restart/deploy；继续剩余 grant/sync dispatch、history Reader、全部 Writer/P1a/Read Model/百万成本/恢复与最终发布，Gate 6 IN_PROGRESS。

- 2026-10-11 / 6.3e.3：Python H 在 SH 内枚举/排序/完整重建，保留 frozen 5b61502 full/delta/rating/六维；filesystem mtime/ctime 捕获与恢复保持旧兼容值，非 play/ready evidence，manifest 提交前 32MiB 上限。daily root 与实际 Source 对齐，guard 阻断旧硬编码 production access 后修正，无生产写入。75 publication + 156 domain/trend/daily Python、138 offline Node、236 actual _test SQL/两组局部 TS PASS（9 production + 3 untouched full Bot routes excluded）；311.970s/370.336MiB sampled/OOM=0。A 6a90c7e / 9.81.7 已 push，Viewer 本地步骤，无 R sync/restart/deploy；继续 grant/所有 Writer/P1a/Read Model/百万成本/运维恢复与最终激活，Gate 6 IN_PROGRESS。

- 2026-10-11 / 6.3e.4：Viewer token EX→SQL owner/current→同一次 token mutation COMMIT，移除独立 gateway grant 依赖，提交前失败保留旧 token、uncertain ACK 只认 exact SQL outcome。两组局部 TS/51 focused/138 offline Node/250 actual _test SQL（新增 14，四个真实 issue/revoke process deaths）PASS；298.819s/421.133MiB sampled/high-max-OOM=0，wrapper exit0/journal success/collected cgroup gone。Python 75/156 previous PASS 未重跑，A 6a90c7e/9.81.7 unchanged；Viewer 本地留档，无 sync/restart/deploy。继续 Python/private resource grant、sync/all Writer/P1a/Read Model/百万成本/运维恢复与最终激活，Gate 6 IN_PROGRESS。

- 2026-10-11 / 6.3e.5：Python bearer captured SQL→Source EX→exact token id/hash/Source FOR UPDATE→canonical/read-refresh/final grant proof/usage COMMIT；Wahlap/Hiroba/save 显式重用同一 EX，拒绝 SH/expired/foreign。95 publication +166 domain Python、138 offline Node、267 actual _test SQL/两组 TS PASS（新增20 Python+17 native bearer，四个真进程退出/HTTP/real song lock）；420.048s/450.320MiB sampled/high-max-OOM=0，wrapper exit0/journal success/collected cgroup gone。A 408d2f8/9.81.8 已标准 commit/push，Viewer 本地留档，无 R sync/restart/deploy。继续 native issuer/private grants、sync/all Writer/P1a/Read Model/百万成本/运维恢复与最终激活，Gate 6 IN_PROGRESS。

- 2026-10-11 / 6.3e.6：Native Bot sender→Source EX→完整 current owner/virtual state/token→同一次 SQL COMMIT，旧 userid-only gateway 410；uncertain ACK exact fresh proof，他人可见绑定/u0/manual 拒绝，自有 hidden 正常。107 publication +170 domain Python、138 offline Node、303 actual _test SQL/两组 TS PASS（新增12 Python+36 native issuer（含实际 READ COMMITTED 缺失状态行锁定），九类 identity/state race、六个实际 issue/revoke deaths/HTTP）；447.75s/421.340MiB sampled/high-max-OOM=0，wrapper exit0/journal success/collected cgroup gone。A f0a2624/9.81.9 已标准 commit/push，远端 main 已核对；Viewer 本地步骤，无 R sync/restart/deploy。继续其他 private/service grants、sync/all Writer/P1a/Read Model/百万成本/运维恢复与最终激活，Gate 6 IN_PROGRESS。

- 2026-10-11 / 6.3e.7：真实 Cookie user→private stdin CLI→Source EX→SQL owner/current/nonce/cooldown/log 一次 COMMIT；保持 actual R Wahlap refresh/两次 C/H 独立观察及 DTO/target metadata，userid-only /dispatch 410。120 publication/170 domain Python、149 offline Node、335 actual _test SQL/两组 TS PASS（新增13 Python+11 worker transport+32 Cookie/native sync，五个实际 worker退出点与独立 SIGALRM/replay/race/ACK loss）。492.871s/435.266MiB sampled/high-max-OOM=0，wrapper exit0/journal success/collected cgroup gone。A 565a7da / 9.81.10 已标准 commit/push，实际远端 main 与9个受测代码哈希已核对；Viewer 本地步骤、无 R sync/restart/deploy。继续其余 private/service grants、u0/daily/all Writer/P1a/Read Model/百万成本/运维恢复与最终激活，Gate 6 IN_PROGRESS。

- 2026-10-11 / 6.3e.7-caller-audit：更正“旧 HTTP adapter 仅留 fixture”措辞：account/sync 已迁移，taiko-center Wahlap 更新代理仍调用 requestSyncDispatch，Hiroba 代理走独立 Python 任务且同样待迁移，必须在统一发布前完成 service-grant/Writer 迁移及 taiko-bot 兼容验证。Source 文档更正 59c3569 / 9.81.11 已标准推送并核对远端；仅文档修改，无运行代码变更、不需 Bot 重启。受测实现与 6.3e.7 PASS 范围未变；未激活 /dispatch 410，Gate 6 IN_PROGRESS。

- 2026-10-11 / 6.3e.8.1：正式 Developer raw userdata Cookie/active token自有完整binding与按token显式Source service policy，SH前后credential/grant/manual authority/lease复核；private stdin operator CLI一次grant/audit COMMIT、concurrent/exact replay不覆盖后来撤销、ACK loss/late failure/rollback destroy。broad149 offline+378 guarded SQL及两组TS PASS，最终Source root/cwd capture/SH loss hardening45 SQL及两组TS PASS；Source hashes unchanged，沿用120/170 Python真实先前结果。约430.598MiB broad/341.367MiB final sampled、high/max/OOM0，QA success/inactive/no cgroup。未登记生产service grant、未sync/deploy；Gate6 IN_PROGRESS，继续proxy/native/QQ/Hiroba/SDK/cache、全部Writer/P1a/ReadModel/成本与统一发布。

- 2026-10-11 / 6.3e.8.2：中心 Wahlap/Hiroba 更新 private stdin/native EX→SQL完整grant、每次发布与返回前复核；history/renderer同一canonical view，private PNG容量/清理；四项客户端SDK要求token/Hiroba900s。126 publication/170 domain Source、52 client、153 offline/409 guarded SQL/两组TS PASS；Source先通过，clientQA错误Core版本纠正后后续全通过，受测哈希相同。533.993s/502.090MiB final sampled/high-max-OOM0，wrapper exit0/journal success/no cgroup。A6a218a2/9.81.12、client d120f65/0.2.1已标准commit/push，实际远端与受测9/5文件SHA匹配；Viewer0.82.0本地待统一标准发布，无R sync/线上变更。Gate6 IN_PROGRESS，继续credential/QQ bind、cache/all Writer/P1a/ReadModel/成本/运维及激活。

- 2026-10-11 / 6.3e.8.3：QQ GET/upsert/current 真实 Cookie/token→verified QQ 或显式 service principals+Source/scope→有界 SQL 身份锁→一次 metadata/state/最小 receipt transaction；GET 无选择修复写入，exact retry 不覆盖 later selection。修复旧 quota 并发 SELECT/INSERT race，实际 IP/token cap。56 client（新增4）/153 offline/443 actual guarded SQL（新增34）/两组局部 TS PASS；两个真实 Node COMMIT 前后退出、late grant/session/QQ loss/rollback destroy/ACK loss/captured pool/healthy frozen manual/u0 DTO 验证。Source126/170沿用未变9文件哈希，未冒称重跑；567.064s/477.078MiB sampled/high-max-OOM0，wrapper exit0+journal success/MainPID0/cgroup gone。client0.2.2提交/push OID以中央证据为准，A6a218a2/9.81.12 unchanged；Viewer0.82.0本地步骤，无R sync/restart/deploy。继续Hiroba credential/bind、缓存授权、全Writer/P1a/Read Model/成本/运维/最终发布，Gate6 IN_PROGRESS。

- 2026-10-11 / 6.3e.8.4：Hiroba status/bind私有授权、兼容Fernet纯discovery worker/stdin、credential+QQ+receipt单次事务、keyed intent nonce与fresh ACK proof完成；134/170 Source、59 client、158 offline/477 guarded SQL及两组TS PASS，旧ownerless adapter410。Source5c99dbd/9.81.13与clientadae96e/0.2.3已push、实际远端与14/5受测哈希一致；Viewer0.82.0本地留档，R/live unchanged。缓存/Native Bot writer/全Writer/P1a/Read Model/成本/ops/发布及在线Gate仍待，Gate6 IN_PROGRESS。

- 2026-10-12 / 6.3e.8.5a：中心u0私有current/history同时SH→principal gate→SQL完整证明，冻结旧merge/history/profile/append语义；Source9.81.16/fb8f3a2及公开规则参考revision追加9.81.17/356cd1e已标准push。13 Source/120 B/140 actual _test SQL及TS PASS，最终159.063s/490.070MiB sampled/high-max-OOM0，wrapper exit0/journal成功/cgroup gone。Viewer0.82.0本地预备提交，B缓存轮仍未完成/未提交，运行R/线上0.81.11/PIDs不变；下一步历史磁盘loaders、renderer joins/public bearer fallback及完整Read Model/Writer/成本/ops/最终发布，Gate6 IN_PROGRESS。

- 2026-10-12 / 6.3e.8.5b：中心raw-v1排序元数据、冻结历史loaders/current-H joins与private cache源码轮完成；153 client、62 Source+5subtests、12 pipe、143 SQL及TS PASS。跨仓库172.261s/481.43MiB sampled/high-max-OOM0；最后client-only153另跑。A e87722b /9.81.18与B47bf5c1 /0.2.4 commit/push远端核验；Viewer0.82本地预备，R/live0.81.11不变。Gate6仍IN_PROGRESS，继续native Bot authority、全Writer/P1a/Read Model/成本-运维和统一激活/在线验收。

- 2026-10-12 / 6.3e.8.6a：原生绑定metadata限定1–3身份/128行、BINARY精确case、移除死的全表Writer与old-info fallback；153 Source（132旧+21新）、1 actual SQL复合用例PASS，9既有real例排除。9.845s/201609216byte sampled/high-max-OOM0；初始QA配置失败和追加校准留档。A331314d/9.81.19、458ceae/9.81.20已push核对；B0.2.4/live0.81.11不变，R未同步。Native authority/Gate6仍IN_PROGRESS。

- 2026-10-12 / 6.3e.8.6b：A9.81.21/9befec4已标准push；原生绑定4写入同principal gate/SQL TX、精确所属credential删除同COMMIT、确认固定ID与摘要失败安全回复。182 Source（132旧+21 metadata+29 mutation）、13真实_test SQL复合用例PASS，含3选定旧u0命令回归、5s同锁和实际COMMIT前后死亡。32.845s/216309760byte sampled/high-max-OOM0、wrapper exit0、unit successful/inactive/cgroup gone。未复制R/重启/部署；native authority整轮/Gate6 IN_PROGRESS，继续其余授权与全Writer/P1a/Read Model/成本/运维/统一激活。

- 2026-10-12 / 6.3e.8.6c：B0.2.5/a8f1b38已标准push，remote SHA核对；中心删除/visibility一次SQL事务、显式新scope、durable effect/确认固定ID、重绑后exact retry不重放。最终181 client/66实际SQL/TS PASS，同轮此前凭据33+access45 PASS，合计144跨两轮。72.334s/533839872byte sampled/high-max-OOM0，journal success/ExecMainStatus0/cgroup gone。fixture初始化失败遗留66测试QQ行已逐条证明并清理、remaining0，失败历史留档；上游/full Bot/online未覆盖。A9.81.21及R/live0.81.11/PIDs不变，Viewer0.82本地预备；native authority/Gate6继续IN_PROGRESS。

- 2026-10-12 / 6.3e.8.6d：B0.2.6/e275995源码及6ade2e1文档已push核对remote；网页成绩token私聊sender/current real中心签发、显式score_token_issue/完整owner、Source EX→principal gate→SQL、exact ACK/一请求不自动重试，未使用local bearer410。195 client/既有66 SQL+最终24 SQL-HTTP和1纯policy/TS PASS（分轮），26.613s/471056384byte sampled/high-max-OOM0，wrapper exit0/journal successful/cgroup gone。初轮transitive import与新test注册失败如实留档。A9.81.21、R/live0.81.11/PIDs不变，Viewer0.82本地预备；native authority/Gate6 IN_PROGRESS。

- 2026-10-12 / 6.3e.8.6e：A9.81.22/3e1d76e标准push且remote一致；原生Hiroba credential+bind一次事务、Source EX/完整row/credential owner发布与同view渲染proof、foreign公开回退、partial-sync与损坏凭据行动提示。208 Source（132旧+21 metadata+29 mutation+8共享credential+18新）/38实际_test SQL（13旧+25新）PASS，9production排除/1warning；四个真实COMMIT/publication进程退出点和5s同gate。72.488s/227680256byte sampled/child216204KiB/high-max-OOM0，wrapper24123 exit0/journal success/MainPID0/cgroup gone。两次AST fixture失败和205/37中间PASS及补充变更完整留档。上游/渲染为合成边界，非full Bot/online；B0.2.6和R/live0.81.11/PIDs不变，Viewer本地预备。native整轮/Gate6 IN_PROGRESS，继续认证QQ和其他Writer/P1a/Read Model/成本/ops/统一激活。

- 2026-10-12 / 6.3e.8.6f：A9.81.23/f04b320标准push且actual remote一致；原QQ sender私聊验证码/hash-only/10min TTL/60s cooldown/完整snapshot，固定多principal gates、merge/owned credential/消费同COMMIT，exact retry不复活、不重置/重跑更新。231 Source（208旧+23新）/70实际_test SQL（38旧+32新）/TS和独立1真实QQ SDK键盘通过；9旧production排除/1warning，四个COMMIT进程退出点与两组5s同锁。121.298s/331796480byte sampled/child354164KiB/high-max-OOM0，wrapper72487 exit0/journal success/inactive/cgroup gone；keyboard0.816s/57143296byte，无依赖安装。两次69pass/1fixture fail及系统SDK/venv缺pytest历史完整保留；主代码不放宽锁，旧exit QA用1s有界等MySQL断连清理。仅Source+Viewer准备DDL/测试留档，无R同步/重启/部署、B0.2.6/live0.81.11/PIDs不变；native整轮/Gate6 IN_PROGRESS，继续client QQ、其余授权/全部Writer/P1a/Read Model/百万成本/ops/统一激活。

- 2026-10-12 / 6.3e.8.6g：A9.81.24/926ad23、B0.2.7/fa0983d标准push与actual remote一致。private qq-code/qq-migrate CLI复用native单事务，明确bind_migrate/principal/全Source、live actor/QQ tuple/service policy前后证明；B local SQLite/JSON迁移与逐次upsert退出。241 Source/223 client/TS和新23实际SQL-HTTP+10纯transport PASS，旧160实际SQL+1 policy分轮保留（合计183/11）；补1复合test u0后来选择和解绑不复活PASS。61.846s/445947904byte sampled/child362448KiB/high-max-OOM0、wrapper25873 exit0/unit1791772648-2099982 success/inactive/cgroup gone；补充3.522s/276811776byte sampled成功退出。四个COMMIT真实退出/独立SIGALRM、late撤权/rollback/ACK/runtime replacement等通过。private fixture sys.path、SDK base URL和pure worker resolver注册失败全留档，无生产依赖/SQL变更。Viewer0.82本地准备，R/live0.81.11/PIDs不变、未启动B；Native整轮/Gate6 IN_PROGRESS，继续其余授权/全Writer/P1a/Read Model/成本/ops/统一部署与online Gate。

- 2026-10-12 / 6.3e.8.6h：A9.81.26/539f6e5已标准push/actual remote一致，期间用户Milky ff1778f/8c877ee无taiko差异，本步保留parent和其他miku工作。Native命令/first-bind传canonical sender，一次current DTO、共享2并发、Source EX→principal gate→完整current/state证明、每publish/同view render/返回复核；managed profile mismatch拒绝、frozen复制/404/-1/cooldown/image fallback保持。258 Source/28新actual_test SQL PASS，70既有SQL先前通过合计98跨轮；四个COMMIT/publish退出和四种Source等待替换、frozen current/full-delta H内容hash/时间序号一致。67.602s/308043776byte sampled/child217192KiB/high-max-OOM0，wrapper21484 exit0/unit1791776870-2153889成功/inactive/cgroup gone。旧AST symbols、Source cwd/公开catalog fixture、Golden投影/随机名称差异完整留档，无production IO/依赖修改。B0.2.7/Core pins及R/live0.81.11/PIDs不变，Viewer0.82本地；其余Native reader/startup/allWriter/P1a/Read Model/成本/ops/统一online Gate继续IN_PROGRESS。

- 2026-10-12 / 6.3e.8.6i：A9.81.27/d4a9d22标准push及actual remote一致，Native u0成员SH→派生EX、同批C/H与commit依赖证明，去掉旧startup SQL/JSON Writer。319 Source、40发布/备份和4补充检查分轮PASS，另25实际故障子场景；frozen初次/增量完整字节一致，两个u0提交死亡点/三身份fence竞争验证。31.617s/285368320byte sampled cgroup peak及补充3.213s/143396864byte，high/max/OOM0，owned child/unit/cgroup退出；两次fixture/runner失败保留。Viewer仅本地档案，无R同步/部署/生产SQL写入，live0.81.11/PIDs不变。继续剩余Native reader、daily/maintenance Writers、P1a停旧Writer后显式纳管、Read Model/百万成本/ops/fixed R deps/统一发布与真实online Gate；Goal active，Gate6 IN_PROGRESS。
