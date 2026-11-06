# 0.69.1 Evaluation Trigger Audit

2026-09-19。实施起点 canonical version 0.69.0；0.69.0 发布 Gate 已关闭。此文是编码前审计，不能作为 0.69.1 验收完成声明。

## 写入路径

| 路径 | 实际边界 | Evaluation 风险 |
| --- | --- | --- |
| account sync / Wahlap | Viewer requestSyncDispatch → 外部 scripts/sync_dispatch_server.py → getUserData → plugins/utils/userdata_storage.py save_userdata | 不经过 writeUserdataWithHistory；dispatcher 回执无绑定内容 revision，读取共享文件存在跨写入竞争 |
| Hiroba proxy sync | taiko-center.ts → 外部 sync_hiroba_userdata → save_userdata | 不经过 Viewer 通用 writer；必须验证实际 source/account |
| Kinoko score import | mergeKinokoScores → writeUserdataWithHistory(kinoko-import) | 旧成绩迁移，不能以导入时间证明 Goal 后游玩 |
| Kinoko history | writeKinokoHistorySnapshots + kinoko-history-current | 历史回填；历史兼容 source 为 wahlap，同时带 imported_via，不能只根据 source 白名单判断 |
| 网页编辑/新增/导入 | account/songs.ts → writeUserdataWithHistory(web-account/web-score-import) | 非 manual binding 也能人工修改；payload 可能保留旧 _meta，必须验证内容完整性 |
| manual | manual.ts → writeUserdataWithHistory(manual-*) | 全部排除 |
| dispatcher 本地转存 | write_local_snapshot 直接写当前文件/历史 | 不是新成绩事件；写入时间不能作为证据 |
| 外部 bot / repair / direct file writes | 不收敛于 Viewer writer | 缺少可验证来源或连续性必须 inconclusive |

外部 Python 路径仅只读审计，本任务不修改其他仓库。save_userdata 产生 schema_version=2、source、source_account、merge_topology、ts、synced_at 和 content_sha256，但不提供 prev_revision 或跨 writer sequence。content_sha256 的规范化使用 Python ujson，去除该字段后 sort_keys；不能直接假设普通 JSON.stringify 等价。

## 决策

采用 B：显式 authenticated POST evaluation，服务端读取当前 authoritative 文件，客户端不提交 observation。GET Overview 保持只读。不得仅因 sync HTTP 成功便将随后读到的文件视为该次同步的结果。

来源验证必须包含内容校验、source/account/topology、baseline 与 observation 的相同语义，以及新鲜同步标记；标记本身仅证明观察顺序，完成条件仍需严格 best-state/累计变化。旧缓存、同 revision、历史回填、源切换、重置或无法验证字段时 fail closed。文件 mtime、request/evaluate time 不充当成绩事件证据。

0.69.0 旧 Goal 没有冻结 score-source provenance；不得事后从当前文件补造旧 baseline 来源。此类 Goal 如无法恢复可验证 baseline，保持 active/inconclusive。新创建 Goal 应冻结通过验证的 provenance；不新增 SQL schema。未知完整性的未游玩 Goal 继续关闭。

## 待实施 / 验证

来源校验与连续性策略需要先通过真实 writer 格式 fixture（包括 ujson 编码差异、历史导入、网页编辑保留元数据）验证，再启用 completion。纯规则、真实 SQL 并发、UI matrix、生产 completion smoke 全部通过前不得声明 Evaluation enabled 或 COMPLETE。

实施与生产验收现已完成，见 [0.69.1 最终状态及 28 项报告](goal-evaluation-implementation-status.md)。本审计保留编码前的边界与选择依据。

## 2026-11-06 — Training Loop 定向收口（1.7.0 候选）

开工核实：main `c1b89fe12b075db367af52728388869b466e2fab`；工作树干净；package 与线上 `/more` 均为 1.6.3。本节覆盖训练闭环，不重开 Annual Poster Phase。

### 影响面与实施决策

1. Home resolver 提供当前 binding，`usePlayerGrowth` 的 Overview 提供 active/recent completed Goal；Surface 保留短期 mutation 回执，成功刷新后以完整 Overview 替换。
2. 歌曲详情已将 `difficulty=1..5` 映射到 EASY/NORMAL/HARD/ONI/EDIT。新入口复用此路由；浏览不写 Goal。同步入口带 profileId/from=goal；只返回站内 `/#current-goal`，不接受外部 return URL。
3. 当前 owned sync worker 在 Source EX 下先取得 Wahlap current，再分发到目标，最后持久化 receipt/log；Node 在 SH 下核对 owner/binding/request/log hash。partial 和 failed 是下游送达状态，不等于本地采集失败。同步前后还必须有不同 revision/hash、更晚 marker/observedAt、相同可信 source/account/topology；HTTP、mtime、请求时间不作为证据。
4. `readActiveGoal` 轻量解析当前目标，再复用 `evaluateActiveGoalForBinding` → `evaluateStoredGoal` → `evaluateGoal`。新增 authenticated `POST /api/account/growth/goal/evaluate-current` 仅接受 profileId，供显式重试；无目标返回 no-active-goal，不读 Overview。
5. 自动评估在同步响应前完成，不调用 Growth/Python。失败隔离为 evaluation-error，已成功的同步不回滚。自动链仅接入 live submitAccountSync，Kinoko current/history 与 manual 路径不接入。V1 基线/完成证据、锁顺序、CAS、历史不可逆规则保持不变。
6. sync 完整响应后统一递增 homeGeneration；两个 composable 以数据失效信号监听，identity 仍仅表示用户/binding/enabled。Home resolver 同身份数据更新保留 ready snapshot；身份切换立即清空，代际拒绝 ABA 迟到响应。
7. `useAccountDataRefresh` 合并同周期更新，inactive 只标脏，激活消费一次；显式读取消费已排队 dirty，避免激活重复读取。同身份保留上次 DTO，成功后整体替换；Overview 失败禁用旧 Today Plan 创建。
8. 手动 Goal evaluation 的 completed/active/inconclusive 均采用一次低频显式双读取；Overview 与 Recent 独立失败/重试，任何读取失败均不撤销已持久化 completionEvidence。
9. 无基线资格：DEFERRED。`full` 是 snapshot shape，不是 upstream coverage；Hiroba 默认难度子集且可能详情失败，Wahlap 当前契约也没有可验证完整覆盖声明。生产 `sourceCompleteness` 仍 unknown，record absence 不能证明未玩。已有新记录 provenance 能验证出现，但不能补造 baseline absence；因此 played 与首次 Clear 均不开启，V1 不变、无 schema。后续先建立覆盖契约，再以 goal_data 的 baseline/evaluation V2 表达缺失记录及独立 Clear 证据。

最小实施顺序：同步证据门槛/复用 evaluator → 双读取与 Home 生命周期 → Goal/同步页双语入口和反馈 → 定向规则/SQL/浏览器验收 → minor 版本与标准部署。未改变 Rating、六维、推荐排序、Daily facts、Recent cursor 或 Developer API。

### 验收口径

- 代码单元、隔离 SQL/worker、浏览器 synthetic network、只读线上 HTTP、真实账号游玩链路分别记录，不互相替代。
- 实际 SQL 测试先执行 SELECT DATABASE() 并验证 `_test`，要求 TAIKO_ALLOW_TEST_DB_MUTATION=1；仅合成上游响应，禁止生产伪造成绩。
- 无授权真实账号及实际游玩证据时，线上完整训练闭环为 NOT_VERIFIED；发布与自动测试不能将其升级为 PASS。

### 1.7.0 发布前交付记录

| 交付项 | 状态 | 说明 |
| --- | --- | --- |
| Goal 卡片入口 | PASS（代码/UI） | 指定难度、绑定上下文、manual 隐藏同步入口；既有选歌弹窗/CAS 保留 |
| 同步自动评估与结果 | PASS（隔离 SQL/worker） | completed / active / inconclusive / no-active-goal；异常保留同步结果、独立重试 |
| Overview / Recent 刷新 | PASS（单元/UI） | 同步响应含评估后才失效；返回各读一次；不重复 Growth 计算 |
| KeepAlive 回访 | PASS（单元/UI） | inactive 不读、dirty 合并、DTO 保留、ABA 与同身份代际拒绝迟到响应 |
| 无基线 played / 首次 Clear | DEFERRED | 覆盖证据不足；不新增 V2、不降低 V1 门槛 |
| 真实账号完整游玩链路 | NOT_VERIFIED | 本轮没有可用的已授权专用账号与实际新游玩证据；未伪造线上完成 |

最终组合 QA：`/home/sigaer/taiko/qa-vault/runs/qa-985aedc807c3/evidence`。

- 单元/组件状态：99 PASS（Goal 46、Growth refresh 10、training/deep state 24、Home 18、版本投影 1）。
- 隔离 SQL/authenticated HTTP/已安装 Python worker：7 PASS，使用生产当前 runtime `/opt/taiko-bot/releases/0.19.3`，上游 Wahlap 响应为合成 fixture。覆盖实际持久化 completionEvidence、下游全失败仍本地完成、评估异常不撤销同步、新 API 401/400/409、无目标、nonce replay 和只评估重试。同步/评估的 `runGrowthPythonJson` 调用数为 0。
- 浏览器：zh/ja × 390/1440 四组 PASS。真实 Vue 路由与页面、合成网络；设置目标、EDIT 难度、返回目标、同步反馈、Overview/Recent 各一次读取、无 stale-plan 创建下一首、错误重试、manual 隐藏入口、无页面 JS error/水平溢出。不是线上真实账号验收。
- 全部 QA 使用 `scripts/memory/run_qa.sh`；最终浏览器与 dev server 已结束，3198 无监听。未与 release build 并行。
- 新 API 只有 `POST /api/account/growth/goal/evaluate-current`。复用 readActiveGoal / evaluateActiveGoalForBinding / evaluateStoredGoal / verifiedGoalProvenance；无数据库 Schema、无版本化 Goal 语义变化。
- 版本 1.6.3 → 1.7.0，package/lock 同步；Nuxt/More 从 package 投影，无硬编码 fallback 需修改。
- BLOCKED：无代码/隔离验收阻塞。KNOWN_LIMITATION：同步前后任一可信快照无法校验、来源切换或连续性不足仍 inconclusive；不能声明单次街机 Session 完成。

复核命令：`npm run test:goal`、`npm run test:growth:refresh`、`npm run test:training`、`npm run test:home-state`、`npm run test:version`；SQL 选择 `accountSyncCanonicalSql.test.mjs` 的 `training loop|real cookie sync|remote refresh exceptions`；UI 为 `npm run test:training:browser`。SQL 凭据只由私有 env 文件加载，报告不包含凭据或真实用户数据。

修改文件（相对仓库根目录）：
- `docs/goal-evaluation-trigger-audit.md`
- `taiko_viewer/components/home/AuthenticatedHome.vue`
- `taiko_viewer/components/home/PlayerGrowthSurface.vue`
- `taiko_viewer/components/home/RecentGrowth.vue`
- `taiko_viewer/composables/useAccountDataRefresh.ts`
- `taiko_viewer/composables/useHomeState.ts`
- `taiko_viewer/composables/usePlayerGrowth.ts`
- `taiko_viewer/composables/useRecentGrowth.ts`
- `taiko_viewer/composables/useViewerApiFetch.ts`
- `taiko_viewer/package-lock.json`
- `taiko_viewer/package.json`
- `taiko_viewer/pages/account/sync.vue`
- `taiko_viewer/scripts/verify_training_loop_browser.mjs`
- `taiko_viewer/server/api/account/growth/goal/evaluate-current.post.ts`
- `taiko_viewer/server/services/goals/evaluation.ts`
- `taiko_viewer/server/services/goals/sync-observation.ts`
- `taiko_viewer/server/utils/account/sync.ts`
- `taiko_viewer/tests/accountSyncCanonicalSql.test.mjs`
- `taiko_viewer/tests/goalProfileCache.test.mjs`
- `taiko_viewer/tests/goalSyncObservation.test.ts`
- `taiko_viewer/tests/growthClientLoading.test.mjs`
- `taiko_viewer/tests/growthEvaluationRefresh.test.mjs`
- `taiko_viewer/tests/growthRefresh.test.mjs`
- `taiko_viewer/tests/homeDeepState.test.mjs`
- `taiko_viewer/types/goal-evaluation.ts`
