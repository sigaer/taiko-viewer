# Taiko Domain Extraction 执行台账

执行依据：[Execution Plan v2](../Sakura_Taiko_Domain_Extraction_Execution_Plan_v2.md)。用户已授权依序执行 Phase 0–6、逐步留档、阶段提交/推送，技术选择自行决定。日期均为 Asia/Shanghai。此台账不沿用 Annual Poster Phase 字母 Gate。

Goal：`active`。Phase 5 标准发布与只读线上验收完成，Gate 5 PASS；开始 Phase 6 ownership、publication、Read Model 与 storage 决策。先前内存准入阻碍已解除，历史记录保留。

| Phase | Gate | 已完成 / 待完成 | 证据 |
| --- | --- | --- | --- |
| 0 Extraction Audit | PASS | 清单、分类、重复、数据流；无实现变更 | [审计](../taiko-domain-current-state-audit.md)、[复核](evidence/phase0-validation.json) |
| 1 Contract Freeze | PASS | 身份/Chart/Score/Growth + CalculationProfile 冻结，10 项 Golden/validation | [验收](phase1-contract-freeze.md)、[证据](evidence/phase1-validation.json) |
| 2 Core v0.1 | PASS | 四步依序提交；独立 repo/tag，15 项 installed-wheel tests | [验收](phase2-core-v0.1.md)、[证据](evidence/phase2-validation.json) |
| 3 Sakura adapter | PASS | Core 0.1.1 / Sakura 9.80.7；132 regression、生产重启/adapter/HTTP smoke | [验收](phase3-sakura-adapter.md)、[证据](evidence/phase3-validation.json) |
| 4 taiko-bot client | PASS | Core 0.1.2 / client 0.2.0；188 委托、48 回归、固定 Git pin / wheel 安装 / command smoke | [验收](phase4-taiko-client.md)、[证据](evidence/phase4-validation.json) |
| 5 Viewer boundary | PASS | 5.1–5.3 / 230 Node + 5 Python PASS；0.81.11 标准 push/deploy、8 项线上 smoke、旧进程退出/新进程 active | [步骤](phase5-viewer-boundary.md)、[验证](evidence/phase5-validation.json)、[发布](evidence/phase5-publication-validation.json) |
| 6 Writer/storage | IN_PROGRESS | 6.1/6.2、6.3a–c、6.3d.1–9、6.3e.1 已留档；创建/删除/恢复/绑定授权事务、当前成绩计算 canonical Reader 与个人读取身份校验通过隔离验证（53 publication + 132 domain Python、132 offline Node、199 SQL）；待其余 Reader/Writer/grant、Read Model、全量成本/运维恢复与发布 | [步骤](phase6-storage-consolidation.md)、[审计](evidence/phase6-ownership-audit.json)、[最新验证](evidence/phase6-personal-canonical-validation.json) |

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
