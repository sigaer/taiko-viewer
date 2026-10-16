# Viewer 0.83 main 集成审查候选

**MERGE_CANDIDATE_READY_FOR_OWNER_REVIEW**。唯一输入 rc.5 `35d473dfd350af5a6f40bcc00993a9fbdb1b3825` 已按 manifest/永久 identity 核验；本轮修复后的候选为 `0.83.0-rc.6`，运行源码与正式构建提交 `8d915ca2724480c7a287073b742e94a83b44686a`。分支 `integration/viewer083-rc5-main-review-20261016`。Contract=FROZEN_LOCAL，Gate P=DEPLOY_PENDING_AUTH，I6=DEFERRED，deployReady=false。

## Git 身份与远端观察

实际 `ls-remote` 观察时间 `2026-10-16T14:02:28.816036+00:00`，远端 main=`777546c943b9ca196c365fffa6d1289eb558a2db`；随后 fetch 验证相同。此前缓存恰好一致，不能把旧缓存称作本轮远端证明。merge-base=`9a77dbcfa6c7ef6e502a1a5ae7ba4efc714e2209`；运行提交相对 origin ahead/behind=134/1，origin 独有提交仅 1 个。完整双向图、三方 merge-tree 与 code review patch 均封存在永久 evidence index，SHA 见最终 Gate JSON。

Viewer main=`56aa05a6eecfbd163bc4cb2b985dfa66ab7ea696`；Sakura_bot=`63be19a5c35ba98831b3eeec1746f36fed049a7e`；taiko-bot=`fa0983dcc56ca109555a33d90aac0fecca6bdf0d`。三者原工作树都有未提交工作，原 branch/status/SHA 私有封存，未纳入、stash、改写或提交它们；只有新的 review worktree 承载本候选。

本轮**未执行 Git 合并**，origin 仍不是候选祖先；不声称可以直接 fast-forward 或所有历史文本冲突已消失。这里解决的是每条重要行为差异，并给最终集成者精确选取的文件树与审查补丁。main 合入/push/tag/部署仍需另行授权。

## origin 独有的全部 9 个路径裁决

| 精确路径 | 裁决 | 候选行为与依据 |
| --- | --- | --- |
| `taiko_viewer/deploy/taiko-viewer.service` | INTENTIONALLY_NOT_PORTED | 旧发布目录 WorkingDirectory/ExecStart 不覆盖候选或生产；保留当前模板，实际路径 UNKNOWN；no runtime/template edit; Gate P separately observes actual identity |
| `taiko_viewer/package.json` | INTENTIONALLY_NOT_PORTED | 不回退旧 0.81.12 版本；在 rc.5 基础按行为修复递增 rc.6，不升级依赖；normalized package dependency equality against rc.5 |
| `taiko_viewer/package-lock.json` | INTENTIONALLY_NOT_PORTED | 保留完整现行 workspace/lock；只同步 root/package version 到 rc.6；normalized lock equality against rc.5; offline npm ci |
| `taiko_viewer/pages/account/sync.vue` | MANUALLY_RECONCILE | 保留现有本地化成功文案；部分实际发布用 warning；拒绝由旧 catch 显示，不把零写入显示成功；SFC compilation and real H3 partial/rejection responses |
| `taiko_viewer/server/internal/account/kinoko-history.ts` | ALREADY_INCLUDED | 时间准入、metadata/event 分离、Shanghai/offset 及 baseline 规则已进入 rc.5；保留 canonical Reader/Writer，禁止旧 fs 落盘覆盖；unchanged from input; affected 11 adapter/publication regressions |
| `taiko_viewer/server/internal/account/kinoko-import.ts` | MANUALLY_RECONCILE | 保留准入；补 timeSummary、非字符串时间拒绝、上游错误脱敏和 epoch 顺序。既存 current 任一异常则整批拒绝，替代旧 per-chart continue/changedSongs+delta 依赖；16 SQL/H3 observations; epoch-order regression; no staged pollution |
| `taiko_viewer/server/internal/account/kinoko-time.ts` | ALREADY_INCLUDED | 完整 helper 已进入 rc.5；只存在已检查的 TS tuple 约束差别，无新运行变化；identical Git blob to input; timestamp regression |
| `taiko_viewer/server/internal/account/shared.ts` | INTENTIONALLY_NOT_PORTED | 旧第四参数 partial-history/direct fs Writer 不移植；既存污染在调用边界拒绝，唯一现行 Writer 与 full/delta 格式不变；protected Publication/Source trees and shared.ts unchanged; C/H rollback proofs |
| `taiko_viewer/server/utils/account/sync.ts` | MANUALLY_RECONCILE | 在现行 auth/Source 上调整：全过滤 422、重复零变更 409、污染 409，不写 success log；复用完整 owner/binding/source tuple 与 Session 前后检查，真实写入才 published=true；16 native SQL/installed -I/H3 cases; successful C/H advances exactly one generation |

旧提交中的 auth/Source 实现不能覆盖现行 Session、owner、完整 binding tuple 或 canonical Publication。Catalog、冻结 Contract/SDK/OpenAPI、Source 适配与 deploy script 没有 origin 新差异，均保留现行版本。保护对象的 Git tree/blob 与 raw 文件 SHA 在最终 Gate JSON 中逐项列出；没有第二个算法、Writer 或权限体系。

## 真实修复与兼容性裁决

全过滤/空记录返回 422；重复且无实际 C/H 写入返回 409；两者 published=false，既不生成 success log/成功 receipt，也不创建空 current 或推进 Publication sequence。真实成功才返回 published=true；部分有效记录发布有 partial=true，现有 UI 使用 warning，正常成功保留原本地化文案。

origin 对既存污染采用逐谱面排除并借旧 Writer 的 partial-history 参数继续导入。本候选明确选择**当前成绩任一异常时间即整批 409，进入 staging 前停止**，因此不复制旧污染到新 full H，也不改变唯一 Writer/旧历史数据。这是已实现的兼容性取舍，不声称与旧“继续部分导入”等价；污染修复留给独立数据操作授权。没有开放的来源/权限/Writer P0 代码冲突，Owner 仍需审查这一行为选择。

导入在抓取前捕获完整 binding 身份，发布复用既有 withViewerCurrentSource write scope，并在写入前后重新检查 Session。owner/source/manual_account_id 变化和撤销均拒绝；不是新授权机制。时间 sanitizer 不再把非字符串先强转，upstream detail 不进入客户端错误；同分数按真实 epoch 而非混合格式字符串排序，计分与累计字段公式不变。

## 最小验证与源到产物身份

- 新建独占 `_test`，实际 SELECT DATABASE()/@@datadir、mutation opt-in 和固定 installed `-I` Worker：16 条真实 Cookie/H3 观察通过，包括全过滤、缺失 C、重复、污染、部分写入、单 generation、source/manual/owner 变更、Session 撤销、匿名拒绝。上游 Kinoko 传输指向合成 loopback；本导入路径的权限、Reader/Writer 和服务使用实际源码、真实 SQL。宿主连接/配置及未使用的内容/analytics 边界复用既有隔离 fixture，不声称这是未改宿主的 H3 测试；未经修改的正式 Nuxt 冒烟另列如下。
- 受影响适配器/Publication 11 项回归通过，含上海时间/ISO offset 的先后比较；受影响 TS 诊断 0，sync.vue 与现有 My Taiko SFC 编译通过。范围外 154 条 TS 诊断完整保留，不宣称全仓类型 PASS。
- 从干净 commit 的独立 Git archive 正式 build 157.921 秒；5185 文件未经补丁，启动前后 hash 全部相同。23 条运行观察、13 条浏览器 API 响应、6 个浏览器流程通过：默认双 legacy、BFF/v1 404；QA read-model 严格隔离；切换/解绑/owner/Session 撤销、Publication 同代与 Catalog fail-closed；375/1280、503 清旧正文。
- owned-qa 的独占 scratch/datadir/cgroup/opt-in/原生 SQL 证明原样保留；无效上下文仍退出 78。代码中的生产默认 normal、My Taiko legacy、Developer OFF，当前线上配置未观察；未修改 Annual 插件/入口或执行 Annual 任务。
- 构建采样峰值 4193734656 bytes，QA 1159069696 bytes，memory PSI full avg10 最大 1.81，OOM/高压阈值事件均 0；kernel memory.peak 不可用，未把采样值当绝对峰值或容量验收。退出码真实传递，进程组/Nuxt/listener/Chromium/SQL/scratch 已清理，原始日志有持久 SHA。

source-to-release manifest 内嵌于 [单份最终 Gate JSON](083-main-integration-gates.json)：Git/build/lock/Schema raw+serialized/SDK/OpenAPI/解释器/wheel RECORD/lock/输出身份均有记录。后续交付提交只补文档，不把未构建的文档 HEAD 当作已部署 release。workspace Contract 0.1.2 与 installed 0.1.0 明确分列，两角色 94 包旧来源证明复用，本轮仅核固定 Python/wheel/lock hash 和实际 -I 读取；不重做 ownership 审计。

唯一失败轮：owner reassignment 后仍有另一绑定，正确触发 full identity 409；测试原预期 400 失败。修正预期后通过，未放宽运行逻辑，失败原文/hash 保留。旧 rc.5 全部 FAIL、0.82 O1/O2、PNG/性能/Annual 历史结果未改；四授权表合成恢复与未变更 Golden/SDK/OpenAPI 按原身份复用，不重跑已接受全量套件，也不把原 74 HTTP 的所有源码身份重新认证。

## Gate P 与停止点

Owner 下一步只需审查候选及[一次性授权决定表](gate-p-authorization-ready.md)（[机器包](gate-p-authorization-ready.json)）。11 项决定分别区分只读发现/文件、SQL 结构、合成状态变更测试、DDL、业务数据备份恢复、灰度与外部 v1；所有 CAN_RUN_NOW=false。生产 unit/PID/vhost/Node/Python/SQL/owner 仍 UNKNOWN；缺 scope 的行 NEEDS_SCOPED_DISCOVERY_APPROVAL。

复用并补齐的[只读计划](083-gate-p-readonly-approval-plan.md)和[schema/恢复计划](083-prod-schema-and-recovery-plan.md)提供精确字段/上限、四表与 F3 DDL source/hash、结构查询、锁与回退影响。RPO≤15min/RTO≤120min、PITR、加密离机备份和十二项私有资产均未验证；十二项私有资源不是十二项旧 PNG Golden。没有模拟签字、实际地址或生产回滚命令。

I6 维持已接受的 DEFERRED_WITH_EVIDENCE（独立提交 d52410c），没有另造 Home 接入点。本轮到此停止：没有 push、merge main、tag、生产配置/SQL/业务数据/HTTP 访问、DDL、部署、重启、v1 启用或 Annual 负载。
