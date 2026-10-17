# My Taiko I5 产品候选实施报告

状态：`MY_TAIKO_I5_PRODUCT_CANDIDATE_READY_FOR_REVIEW`，Viewer `0.83.0-rc.4`；Contract `CONTRACT_FROZEN_LOCAL`。`Gate P=DEPLOY_PENDING_AUTH`、`deployReady=false`、`productionAccess=false`、`publicApiEnabled=false`。本报告替代前一轮本路径中的原型待签结论；原始报告保留在 Git `1b06f7d7e7ab2c6c7c6bd66ebfa117512196fed3` 及旧证据中。

## 交付与身份

独立分支 `prep/viewer1-consumer-readmodel-20261016`，原准备头 `1b06f7d7e7ab2c6c7c6bd66ebfa117512196fed3`，以本地整合提交 `196be85a6216d1468f3b8182b2a017fe6cd08b37` 引入独立冻结提交 `5c68a13964cc8d8750709002485c11cf1ee239cb`。F1–F5 批准输入及聊天审批来源见 [冻结决议](083-freeze-final-review.md)。不再次请求 F1–F5 批准。冻结输出 manifest SHA `463a090855f571ed72da184a7d1d4c01691e9f5013cf1c106ce99ec190e34b36`；I5 输出 manifest SHA `7e40b26b5cd6c28e903f21ad2ebf720752b81b019f26edfea22cf68a08beaf04`。最终 I5 提交及所有交付文件精确身份写入 `/home/sigaer/taiko/qa-vault/evidence/083-owner-approved-freeze-i5-20261016/i5-delivery-identity.json`，避免提交自引用。

新增真实 `GET /api/account/my-taiko/overview` 与可维护的 `server/services/my-taiko/overview.ts`，现有 `pages/my/index.vue` 通过 `components/my-taiko/Overview.vue` 消费。共用原有 Session/owner/current binding、Publication ReadView、Score mapper 与 Growth 投影。没有引用 `/qa/*` 原型，没有第二套 Schema/算法/Writer/权限体系；Profile/成绩摘要/90 天事实摘要及现有推荐工具入口均来自实际读取。推荐只为入口，不是已计算结果。

## 一致性与拒绝语义

一次请求内 current/history 共用 live SH 与 committed generation；current memo 只存于该请求 ALS reader，finally 还原。Growth 使用已有 createGrowthScoreEvidenceRequest，避开全局 in-flight 复用；读取结束关闭 SH Worker 后，再验证 Session、owner/current binding 与 Catalog。成功请求底层 current 装载一次。绑定/owner/来源/Catalog 变化、注销/过期、未绑定、Publication 缺失或损坏均整包拒绝，私有响应 `private, no-store`，无 ETag/304、跨请求授权载荷缓存或自动 fallback。URL owner/binding 覆盖与无 Session 的 Developer Key 被拒。

release 使用唯一 v1 catalog() 的原始源 revision，另列 `legacyCatalogRevision=legacy-projection-sha256:…`。同源投影不等价、恢复 mtime 的旧缓存、读中原始字节改变均拒绝；空白变更可使 raw revision 不同而投影相同。`scoreRevision=publication-v1:sequence:commitId` 来自同一个 captured view；schemaRevision 来自唯一 Schema，calculationProfile=null，不用请求时钟/mtime 替代任何代际。

Score 数字/unknown 只经已有 Contract mapper；BFF 仅计数，不重算 Rating/六维。canonical facts 使用既有投影；新页面只把真正 played+instant 标为游玩，其他事实按观测展示，摘要取既有排序中的最近 8 条并明示剩余入口。无可靠证据时显示 unknown/partial/truncated 和可靠记录不足。measurement 未读取，`NOT_REQUESTED`；GET 没有 measurement/Goal/Score/C/H/Grant Writer。既有 Session `last_seen_at` 触达保留；登录/登出及测试主动 Writer/解绑是独立动作。

## 实际完整宿主验证

本次成功：`/home/sigaer/taiko/qa-vault/runs/qa-732c619e5434/evidence`，26 个非浏览器命名 HTTP 观察及 7 个真实浏览器流程。全新 `_test` MySQL，验证实际 SELECT DATABASE()/@@datadir 与显式 mutation opt-in；使用固定 Taiko 0.14.2 已安装 Python 的 `-I -m taiko_store.bridge`。没有运行时模块替换、模拟权限/API 或组件宿主。

覆盖真实登录→/my→BFF、刷新、A1→A2→A1/B、匿名与未绑定入口、读中切换/解绑/owner 变化/登出，真实 SQL 锁下 queued Writer 的旧响应/下一代一致性、Publication 缺失/对象损坏、Catalog mutation/stale cache、source mismatch，以及同步/来源切换/reappearance 不产生新增假游玩。首次 full 中有可靠时间的既有游玩仍被保留，不把它改成零来迎合测试。2001 个极小合成重复观察只触达既有 2000 文件 coverage 边界，不是 Annual 或新增容量测试。

375×812、1280×900 的实际 Nuxt 页面均无横向溢出；真实 selector、键盘焦点、重试、503 清除旧载荷、SQL 阻塞下 15 秒真实请求超时与恢复、匿名/绑定入口均通过。关键 hydration/console/pageerror 为零。外部资产请求在浏览器中阻断，仅使用隔离 loopback。最终 measurement/Goal 行数为零。默认 legacy 宿主的既有 /my 及关闭的 BFF/Developer API 均验证。

正式 `npm run build` 成功：154.29 秒，采样峰值 4248760320 字节，memory.peak 不可用，memory.events high/max/oom/oom_kill 全零。源码输入清单在构建前后及收口逐项 hash 一致；构建时 Git base 为 196be85，未将 dirty build 冒称该提交本身的产物。最终交付提交通过外置身份复核同一源码清单。

正式构件没有启动。隔离测试副本仅替换编译后的 Annual 启动插件数组中的一次调用，保留 account DB guard/close hook；其余 5184 个输出文件字节与正式构件一致。生产 Annual 源码/入口/EOL 状态未变，未生成年度数据。所有自有 Nuxt/Chromium/SQL 子进程与 listener 退出，scratch 已按本轮 ownership 清理。

受影响 server/types 语义 TypeScript 和两个 Vue SFC script/template 编译通过；保留 131 条改动文件外依赖诊断，不宣称全仓 typecheck 通过。冻结 OpenAPI 11 operation/95 样例/6 分页 Golden 再验证通过；Schema/生成绑定/固定 wheel 和94包环境不变。原18 Golden、74 HTTP/SDK、34 F3 与21原型证据保留并限定 hash 复用，未把它们混算为完整产品新测。

失败均保留：未安装既有 Goal/Growth DDL 的空库导致受控503；合成观察误含真实上游时间的错误零游玩预期；hydration 前填表与隐藏菜单登录链接的浏览器定位错误；一个新调用的 TS 参数推断错误，移除摘要不使用的可选 mapper 参数后通过。还修复了传取消信号时 fetch 库忽略 timeout 的问题，改用请求内计时器，真实阻塞下的超时/取消/恢复均通过；组合 deadline API 的浏览器不兼容失败也保留。原始失败日志/截图/清理和 scoped rerun 不覆盖，见合并矩阵与 evidence-index。既有年度 FAIL/性能失败/PNG证据缺口保持原样。

## 开关、回滚和下一阶段

默认两端 `myTaikoReadModelMode=legacy`，显式隔离宿主才设 `NUXT_MY_TAIKO_READ_MODEL_MODE=read-model` 与 `NUXT_PUBLIC_MY_TAIKO_READ_MODEL_MODE=read-model`。Developer API gate 独立保持 OFF。经后续生产批准的回滚只恢复这两个 mode 为 legacy，不删改任何成绩/事实/测量/Grant；新路径任何错误都没有自动旧数据回落。

测试仅在新库安装原有 Account/Goal/Growth DDL；没有生产 DDL 或新 schema 迁移。正式环境既有表/解释器/身份/代理/ACL/配额/审计/恢复和上线后验证均未观察，继续 Gate P 待独立授权。

| 优先级 | 下一阶段 Viewer 1.0 待办 | 依赖 | 需生产授权 |
| --- | --- | --- | --- |
| P0 启用前 | Gate P 只读 ingress/身份/代理与核心备份恢复、迁移/回滚审阅 | 本地 F/I5 交付 | 是 |
| P1 本地 | 选择下一实际消费者 Owner/版本，按既有矩阵接 read model/CalculationProfile | 本候选评审 | 否 |
| P1 发布前 | 受控 canary、批准后的开关启用和线上读链后验 | Gate P 与备份恢复签收 | 是 |

复跑命令（在本 I5 工作树内，复用已封存的隔离构件，重新创建测试库）：`bash scripts/memory/run_qa.sh /usr/bin/python3 scripts/readiness/run-viewer1-integration-qa.py product`。

合并机器状态：[083-freeze-final-matrix.json](083-freeze-final-matrix.json)。最小必要原始证据索引：`/home/sigaer/taiko/qa-vault/evidence/083-owner-approved-freeze-i5-20261016/evidence-index.json`。没有 push、main 合入、生产配置/SQL/业务数据访问、部署、生产重启、公共 API 启用或 Annual 负载。
