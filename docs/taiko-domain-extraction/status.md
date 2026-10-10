# Taiko Domain Extraction 执行台账

执行依据：[Execution Plan v2](../Sakura_Taiko_Domain_Extraction_Execution_Plan_v2.md)。用户已授权依序执行 Phase 0–6、逐步留档、阶段提交/推送，技术选择自行决定。日期均为 Asia/Shanghai。此台账不沿用 Annual Poster Phase 字母 Gate。

| Phase | Gate | 已完成 / 待完成 | 证据 |
| --- | --- | --- | --- |
| 0 Extraction Audit | PASS | 清单、分类、重复、数据流；无实现变更 | [审计](../taiko-domain-current-state-audit.md)、[复核](evidence/phase0-validation.json) |
| 1 Contract Freeze | PASS | 身份/Chart/Score/Growth + CalculationProfile 冻结，10 项 Golden/validation | [验收](phase1-contract-freeze.md)、[证据](evidence/phase1-validation.json) |
| 2 Core v0.1 | PASS | 四步依序提交；独立 repo/tag，15 项 installed-wheel tests | [验收](phase2-core-v0.1.md)、[证据](evidence/phase2-validation.json) |
| 3 Sakura adapter | IN_PROGRESS | 纯领域委托，command/output parity、发布与回退；尚未切换生产 | 待 Phase 3 记录 |
| 4 taiko-bot client | NOT_STARTED | versioned Domain client，保持算法 profile、cache-only | — |
| 5 Viewer boundary | NOT_STARTED | contract read → Canonical Fact → 删除重复领域解释 | — |
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

## 发布约束

文档/纯离线 package 阶段只 commit/push，不触发 Viewer 构建。Viewer 运行代码变化使用 `scripts/memory/run_build.sh /bin/bash scripts/deploy_forum_web.sh "<HEAD subject>"`，脚本失败停止，不手动替换 output/重启。bot adapter 改动依据各仓库 AGENTS，避免覆盖现有用户工作；Core 明确版本 pin、可回退。所有新 QA 经 memory runner，无生产 DB mutation。
