> 历史本地 merge/QA 报告；当前交付及唯一只读申请见 [主线交付](083-mainline-handoff.md)。原执行证据不变。

# Viewer rc.6 本地合并演练交付

状态：`LOCAL_MERGE_ANCESTRY_READY_FOR_REVIEW` + `GATE_P_PHASED_APPROVAL_PREPARED`。`Gate P=DEPLOY_PENDING_AUTH`，`deployReady=false`。

## 1. 真实本地合并候选

独立分支 `integration/viewer083-rc6-merge-rehearsal-20261016`；本地 merge commit `6ec45d1f2d2a936b01769fd23ab3904dd9bd0a6d`，父提交为审查交付 `70c3d3e1cd6b6964c396ea2fda1fc07e73a49fe1` 和本次重新 fetch 的 `777546c943b9ca196c365fffa6d1289eb558a2db`。观察时间 `2026-10-16T15:25:46.650032+00:00`。远端未新增提交；merge-base `9a77dbcfa6c7ef6e502a1a5ae7ba4efc714e2209`。

实际运行 `git merge --no-ff --no-commit`，保留八个冲突及一个自动合并文件的原始结果，逐项落实既有九项裁决。未使用全仓库 ours 策略。最终树 `3ab2c6b6f8ffa628da05be242eb2b37ce2e42330` 与 `70c3d3e` 完全相同；真实 `merge-base --is-ancestor` 返回 0；无未决冲突。原有三个仓库 dirty main 和其他输入工作树的 HEAD、分支、完整 status 均保持原状。

九项逐文件决定、全部路径、双向独有提交和 tree diff 见 [祖先关系证明](origin-ancestry-reconciliation.json)。旧发布目录 service 模板、0.81.12 lock、旧直接 fs Writer 均未进入候选。

Kinoko 兼容性：既有 current 任一异常／未来事件时间，整批 409，在 staging 前终止；诊断 `KINOKO_CURRENT_TIME_CONFLICT`，可见提示“现有成绩时间异常，导入已停止，请联系管理员处理”。不是旧逐谱面跳过后 delta 发布的等价行为。工程结论见 [唯一决策登记](083-decision-register.json)，无需重复签收；保留污染数据，后续仅通过另行授权的账号诊断／修复工单处理，本轮没有创建修复接口或清理数据。

## 2. 最小 QA 与构件身份

与正式构建源 `8d915ca2724480c7a287073b742e94a83b44686a` 比较：全部 1487 个非 docs 跟踪文件逐项 Git blob／工作文件 SHA-256 一致；配置、lock、Schema／生成绑定和受保护树不变。差异仅六份历史审查文档。rc.6 release manifest SHA-256 仍为 `c743de0b28123cac01599b9525315c9fc6c4e71b05749de6d0ceb6622a95358b`。

已逐文件重新校验 5,185 个原样产物，无额外／缺失文件。复用 rc.6 的 16 项 Kinoko SQL/H3 观测、11 项 adapter/Publication、23 项启动观测与六个浏览器流程；不重建，不重跑全量启动、0.82 或 Annual。构件回执 SHA-256 `0dbbcbcd427e25450a65b54feedd75f7dbb2f4cf88a67b7af48da6cdd7174876`。

新增一项专门的 OFF 依赖测试：原样构件、全新隔离 MySQL `_test` 与实际 `@@datadir`、显式 mutation opt-in；Developer 与双 MyTaiko flag 均不设置，使用已构建默认值。登录／Profile／旧 `/my` 正常，I5 BFF 404，11 项 v1／Client／Grant 操作（含 If-None-Match）均 404、无 ETag；另测匿名无效 Key 仍 404。共 16 项 HTTP 观测。四表前后均不存在，排除观察者连接后，应用 SQL general log 对四表引用为 0。原样 Nuxt、SQL daemon、监听和进程组已退出。

源码审查确认所有十一项操作先执行 OFF guard，普通账号 schema 初始化不引用四表；独立迁移 CLI 不会被启动自动调用。结论仅 `PASS_SCOPED`：普通 `ensureAccountSchema` 仍有其他 CREATE/ALTER，Source 生命周期仍可恢复；不能宣称默认关闭意味着整个启动没有副作用。QA 使用受保护的 `owned-qa` 跳过 Annual 后台，不能替代生产 `normal` 启动兼容性证明。

初次身份脚本因 Git 中文路径转义解析失败，原 FAIL 和原脚本保留；改为 NUL 分隔后通过。旧 Kinoko v1 FAIL、74 HTTP 的原源码范围、18 Golden、完整 typecheck 的 154 项范围外诊断及 0.82 历史 FAIL 均保留，不冒称本树重新全量通过。[QA 矩阵](083-local-merge-qa.json)包含时间、退出、资源／PSI／OOM、失败及 raw hash；私有证据根 `/home/sigaer/taiko/qa-vault/evidence/083-rc6-merge-rehearsal-20261016`。

## 3. 三层 Gate P 提案

| 层级 | 本轮结论 | 未满足条件 |
|---|---|---|
| P-A 旧模式暗部署 | 四表／v1 Grant／对外专属配额不自动成为 OFF 部署前置条件 | 实际身份、当前 ingress/ACL、不可变新旧回滚构件、现有数据备份恢复、一般 schema/启动兼容、独立发布授权和合成旧路由冒烟仍未知 |
| P-B 受控 MyTaiko | 提议独立受限实例；进程 mode 不等于用户 allowlist；v1 继续 OFF | Owner／入口审核、真实 Session/owner/source/revision 负面验证、完整同实例路由及双 mode 回退尚未实施 |
| P-C Developer v1 | 独立外部启用，全部专属条件保留 | 真实历史身份、Proxy/Origin/Key/日志、Grant/撤销/缓存、四表/F3 DDL、PITR/加密异地恢复、公私预算审计与明确开关许可均未通过 |

[三层依赖矩阵](083-gate-p-phased-dependencies.json)逐项映射原 11 项；原 [授权矩阵](gate-p-authorization-ready.json)也增加 `phaseDependencies`。`REQUIRED` 是要求，不是 PASS。十二个 private-resource 均为未映射占位符；需要授权后的真实依赖清单来确定权属／备份，不能循环作为已知依赖，也不宣布无关。生产 schema、PITR、异地恢复及 RPO≤15min/RTO≤120min 未实测，旧四表合成恢复只保持 `PASS_SCOPED`。

## 4. 唯一下一项待批请求

该历史 P-ID-DISCOVERY 卡已由 [P-A 一次有界只读核查申请](gate-p-readonly-onepass.md)替代，当前 `CAN_RUN_NOW=false`。一次明确批准后，可沿包内有限引用链连续观察，不再逐个 PID／文件签收；原卡及原执行证据保留历史身份。

Contract 保持 `CONTRACT_FROZEN_LOCAL`，冻结提交 `5c68a13964cc8d8750709002485c11cf1ee239cb`；I6 `DEFERRED_WITH_EVIDENCE`；默认双 legacy、v1 OFF、Annual normal 均保留。未 push、tag、合入既有 main、访问生产配置/SQL/数据、部署、重启或启用功能。交付后停止扩展。
