# Taiko Domain Extraction 执行台账

执行依据：[Execution Plan v2](../Sakura_Taiko_Domain_Extraction_Execution_Plan_v2.md)。用户已授权依序执行 Phase 0–6、逐步留档、阶段提交/推送，技术选择自行决定。日期均为 Asia/Shanghai。此台账不沿用 Annual Poster Phase 字母 Gate。

| Phase | Gate | 已完成 / 待完成 | 证据 |
| --- | --- | --- | --- |
| 0 Extraction Audit | PASS | 清单、分类、重复、数据流；无实现变更 | [审计](../taiko-domain-current-state-audit.md)、[复核](evidence/phase0-validation.json) |
| 1 Contract Freeze | PASS | 身份/Chart/Score/Growth + CalculationProfile 冻结，10 项 Golden/validation | [验收](phase1-contract-freeze.md)、[证据](evidence/phase1-validation.json) |
| 2 Core v0.1 | PASS | 四步依序提交；独立 repo/tag，15 项 installed-wheel tests | [验收](phase2-core-v0.1.md)、[证据](evidence/phase2-validation.json) |
| 3 Sakura adapter | PASS | Core 0.1.1 / Sakura 9.80.7；132 regression、生产重启/adapter/HTTP smoke | [验收](phase3-sakura-adapter.md)、[证据](evidence/phase3-validation.json) |
| 4 taiko-bot client | PASS | Core 0.1.2 / client 0.2.0；188 委托、48 回归、固定 Git pin / wheel 安装 / command smoke | [验收](phase4-taiko-client.md)、[证据](evidence/phase4-validation.json) |
| 5 Viewer boundary | IN_PROGRESS | 5.1–5.3 / 230 Node + 5 Python PASS；发布内存准入暂缓，待 push / deploy / smoke | [步骤](phase5-viewer-boundary.md)、[验证](evidence/phase5-validation.json)、[准入](evidence/phase5-publication-attempt.json) |
| 6 Writer/storage | NOT_STARTED | ownership、P1a、read model、DB 决策、publication/recovery | — |

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
