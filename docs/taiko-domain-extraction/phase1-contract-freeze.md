# Phase 1：Contract Freeze

日期：2026-10-10，Asia/Shanghai。前置 Gate 0 PASS，提交 `eabc6f7` 已推送 origin/main。**Gate 1：PASS**，范围是未接入生产的 value contract v1.0 / package 0.1.0。

产物：[sakura-taiko-contract](../../packages/sakura-taiko-contract/README.md)。JSON Schema 为唯一类型定义，Python TypedDict 和 TypeScript bindings 自动生成；package 只接受显式值，不读取配置/数据库/文件、网络或 wall clock。生成器和测试属于开发工具，不属于 runtime contract。

| 步骤 | 冻结内容 | 验证 |
| --- | --- | --- |
| 1.1 User | User、Binding、ExternalIdentity、DeveloperIdentity 命名空间；scopes 不代表成绩授权 | schema 拒绝身份混合与额外 token 字段 |
| 1.2 Chart | source songId/chartId、difficulty 1–5、catalog star level、single/double/unknown、variant/revision | 五种难度、单/双打、未知 catalog、数字型 ID 跨语言一致 |
| 1.3 Score | 判断/分数/冠标 flags 与 cumulative counts、rank、stage/roll、source、三个不同时间、有限 legacy evidence | 5 组合成 Golden，旧 Hiroba A/B 函数精确输出；legacy 无损往返，缺失与 0 区分 |
| 1.4 Growth | Observation 排除理由、CanonicalFact、Temporal、Evidence、Projection | 现有 Viewer projectScoreFacts 完整输出和 key 一致；时间不补造 |
| 1.5 Calculation | v1 两种 accuracy、v2 center/client profiles，model/catalog/availability/TopN pin | schema 所有已冻结 profile 可验证；未更改公式 |

旧实现 Oracle 在 fixture 中冻结并记录原源码/函数 hash。迁移之后无需导入包含 NoneBot/IO 的旧应用来运行 contract tests。测试首次对当前两个仓库函数提取验证，通过后固定同字节纯函数；运行时不使用旧 fixture。

验证命令：`bash scripts/memory/run_qa.sh /bin/bash scripts/validate_taiko_contract.sh`。证据：[phase1-validation.json](evidence/phase1-validation.json)：Python 5/5、JS 5/5、generated bindings 和 TypeScript 检查 PASS。JS 测试依赖本仓库已有 Ajv/TypeScript，contract runtime 无第三方依赖。不得把 fixture parity 外推为真实玩家数据或已部署 API 验收。

决策：保持 score 原始最佳记录语义；read roundtrip 禁止发布修改后的 canonical value；旧格式 compatibility 限定在 score evidence adapter，后续收敛点为 Phase 5/6 的存储边界。Growth fact 采用现有输出形状和 optional/null 约定，不引入新事实算法或未经验证的游玩时间。identity 的统一是可解释映射，而非强制合并 Web/QQ/上游用户。

回退：此 package 尚未被任何运行服务引用，可回退本阶段 commit 至 Gate 0；无需迁移、部署、重启、改 DB 或 web version。路线图版本号是产品里程碑，不为离线契约包更改生产 Viewer。
