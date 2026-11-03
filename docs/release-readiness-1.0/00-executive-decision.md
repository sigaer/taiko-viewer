# Viewer 1.0 发布就绪审计决策

审计日期：2026-10-10，Asia/Shanghai。用户已授权将基线从 `0.81.4 / 4465943` 更新到 **`0.81.10 / 8d70df213bfcbc4409654313b50951365898985a`**。模式：只读审计；仅新增本目录报告，不提交、不改代码、不测试写库、不部署。

**结论：BLOCKED_BY_P0。当前不能进入 RC。** 当前源码存在按传入用户 ID 读取完整成绩但未要求身份授权的入口，以及 current/history 非原子发布的可靠性缺口。前者触发任务文档 §13 的安全停止线，因此本轮未完成全部运行态证据采集；不能将本报告称为全站验证通过。没有获取真实私人成绩、凭据或证明已发生生产泄漏/损坏。

```yaml
1.0 READINESS AUDIT: UPDATED BASELINE
BASELINE: 0.81.10 / 8d70df2
G0 Product Contract: UNKNOWN
G1 Data Reliability: BLOCKED
G2 Security: BLOCKED
G3 Performance: BLOCKED
G4 Operations: UNKNOWN
G5 Product Observability: PASS
G6 Release Candidate: PASS
0.81.4 evidence reuse: PARTIAL
Final: BLOCKED_BY_P0
```

G5 PASS 仅指本轮按要求交付可实施的观察方案；G6 PASS 仅指 RC 方案交付。**没有宣称埋点已上线、留存已验证、RC 已执行或获准。** G3 BLOCKED 保留既有历史专项预算失败，不等于已证明当前普通 Passport 请求普遍超时。

## 核心发现

| ID | 紧迫性 | 结论 | 证据与置信度 |
|---|---|---|---|
| SEC-01 | P0 | developer userdata 路由不要求登录、归属或成绩授权 Token；配额函数默认允许匿名 | E1 当前源码，HIGH；生产可达性与网关规则 UNKNOWN |
| DATA-01 | P0 | C rename 后才直接写 H，无共同 commit、跨进程锁和故障恢复；可能部分提交、同秒覆盖 | E1 当前源码，HIGH；未声称真实数据已损坏 |
| PERF-01 | P1 | 旧 3000ms 历史管线预算仍失败；新请求大样本各有一次超过5000ms；kernel peak未知 | 已存 E2 结果，四个关键源 hash匹配，HIGH；生产外推 LOW |
| OPS-01 | UNKNOWN | DB+C/H+新日存档的可验证恢复链、RPO/RTO未取得 | 现有脚本/报告审阅，MEDIUM；不能说不存在备份 |
| CHANGE-01 | P1 决策项 | 0.81.7 已改变事实提取、measurement保护、数据源和精彩时刻排序；不能整体称纯性能发布 | E1 diff +版本内报告，HIGH |

详见 [Gate 台账](10-gate-ledger.md)、[版本影响审查](11-change-impact-review.md)、[后续任务](09-remediation-roadmap.md)。当前缺少运行态证据不能降低这两个源码 P0 的优先级。

## 证据边界

- OBSERVED：HEAD/main/本地 origin/main 为 `8d70df2`；package/lock为0.81.10；runtime配置读取环境版本或package。未 fetch，因此不声称远端此刻一致。
- OBSERVED：已跟踪文件无改动，原有未跟踪文档与测试保留。原任务书本身及部分 P1 文档尚未跟踪，不把它们当已发布实现。
- OBSERVED：只读 `systemctl show` 得到 viewer、sync-receiver、memory-monitor 均 active/running。没有读取服务环境秘密，也没有原样导出进程参数。
- UNKNOWN：线上 `/more`、运行产物SHA、环境版本覆盖、实际服务配置与仓库配置的完整对应。服务active不能证明版本一致或业务健康。
- 本轮没有执行单测、浏览器、SQL、构建或线上认证请求。引用测试数量是历史报告记录，不是本轮重新运行。
- 安全停止后仅整理报告；没有开展公网攻击式验证。认证GET会更新session，Passport可能写measurement，不能作为本轮纯只读生产验证。

## 18 个问题逐项答复

| # | 回答 |
|---|---|
| 1 | 本地版本与引用一致；线上/runtime产物未知。基线漂移已获用户确认，不回退代码。 |
| 2 | [产品合同](01-feature-contract.md)列主要路由/API/状态，并补入练习播放器、工具、支持、开放资源等实际源码范围；尚不能冻结全站。 |
| 3 | 不完整。Viewer入口有当前源码；外部Wahlap/Hiroba/dispatcher/merged与维护工具只有历史拓扑，新增日存档writer须重核。 |
| 4 | 当前Viewer helper没有C/H共同提交，进程内Promise锁不覆盖全部入口；文件stat校验不提供事务。 |
| 5 | C成功H失败、H半写、同秒覆盖、并发读改写丢失更新可由源码解释；完整检测与恢复未证明。 |
| 6 | 继承P1a隔离68/68、IO PSI中止、生产覆盖未验证的历史结论。0.81.10报告记录Viewer P1a分支/worktree已删除且未合入；当前独立复现材料未核验。 |
| 7 | 文件方案仍可行但未验收；不必先P1b。先补全来源和恢复合同，再选择最小跨writer方案。 |
| 8 | DB canonical只是候选，缺迁移parity、outbox、旧writer封闭、回退和资源成本实测。 |
| 9 | SEC-01是源码可证实授权缺口；线上利用与部署外层拦截未测试。其他身份边界有局部保护，不能整体PASS。 |
| 10 | Goal确认日与事实日分离、90天范围及绑定guard保留；0.81.7改变DF归因和排序，须使用新版本证据。 |
| 11 | 本轮没有当前真实流量分母和p95；离线42次不能替代各API线上SLO。 |
| 12 | 0.81.4线上单次2.825/2.906秒只保留为历史值。0.81.10本地切换路径仍无range触发fetch；没有当前版本真实浏览器/线上新实测。 |
| 13 | MyDon/验证码/Overview/年度尾等待当前状态UNKNOWN，未读取私有请求日志，不能写已修复或仍故障。 |
| 14 | 大历史全量读取与Python/年度worker竞争仍是风险；guard源码和monitor active存在，peak与告警送达未知。 |
| 15 | 发布脚本具有产物回退代码，不是数据恢复证明；DB/C/H/日存档联合恢复、RPO/RTO UNKNOWN。 |
| 16 | 存在SPA page_view、home_growth_plan_click、UGC事件源码；真实采集/留存未知，不以IP或请求当用户。 |
| 17 | 两项P0先闭合；性能、日存档与语义验收属于RC决策项；全年事实、新Recap/OAuth等P2可延期。 |
| 18 | BLOCKED_BY_P0，依据当前授权缺口与C/H提交缺口；未用缺少留存率阻断。 |

STOP FOR USER REVIEW。下一轮授权应针对最小修复/隔离验证任务，不是直接授权1.0发布。
