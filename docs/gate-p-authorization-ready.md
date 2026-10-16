# Gate P 一次性授权决定表（尚未授权）

Gate P=`DEPLOY_PENDING_AUTH`。本轮未做任何生产观察或变更。**所有 CAN_RUN_NOW=否、OWNER_APPROVAL_NEEDED=是**；UNKNOWN 的行均 `NEEDS_SCOPED_DISCOVERY_APPROVAL`，不能用一次“同意上线”授权整表。Owner 可先单独批准 P-ID-DISCOVERY 对一个仓库模板候选名称的元数据观察；无许可不执行。

| 项目 | WHY | EXACT_SCOPE | CAN_RUN_NOW | OWNER_APPROVAL_NEEDED | EVIDENCE | STOP_CONDITION |
| --- | --- | --- | --- | --- | --- | --- |
| P-ID-DISCOVERY | 确认真实运行身份 | 候选 taiko-viewer.service **一个名称**，systemctl show 的 10 个白名单字段、10 秒；候选并非线上观察值 | 否 | 独立批准名称/操作者/有效期/私有输出 | 仓库模板 hash | unit 不存在或不符即停，不扩展搜索 |
| P-ID-VERIFY | 构件/解释器可追溯 | PID、Node、Nuxt、两 Python 路径 UNKNOWN；先发现再批准确切路径，仅 hash/metadata | 否 | 精确 PID/文件范围 | 本地 rc.6 构建、固定 runtime 身份 | PID/path/hash 不符或预算超限 |
| P-APP | 历史绑定/属主/撤销有效 | 合成账号、binding/client/playerId、origin UNKNOWN；仅批准的授权/撤销 HTTP 与状态/正文存在性/ETag/no-store 字段 | 否 | **含状态变更的测试另批**，不附带开 v1 | 旧 Grant/Key 与本轮 Session/Source scoped 证据 | 跨属主正文、失效后 200/304；OFF 404 不证明授权 |
| P-PROXY | 新旧代理/Origin/Host 与匿名 peer 配额 | 单 vhost/显式 include、可信 peer/探测来源 UNKNOWN；只读解析 ≤100 结构项/64KiB，合成 HTTP 另批 | 否 | 确切文件/parser/探测范围 | 仅仓库与本地实现 | 转发头可伪造、共享配额归属不符、未知 include |
| P-KEY | 无凭证泄漏且 Key 可撤销 | 文件、字段/parser、lifecycle owner UNKNOWN；只输出存在性和脱敏 boolean，不输出值或 secret hash | 否 | 字段白名单与 parser hash | 本地错误脱敏/权限实现 | 需要输出 Authorization/Cookie/JWT/Key 或全量环境 |
| P-AUDIT | 可追溯且不泄漏真实业务 | 格式文件/合成 requestId/日志文件 UNKNOWN；样例另批 ≤20 行/5 分钟 | 否 | 文件/parser/窗口/保留 owner | 仅合成日志 | 真实标识、header/body、越过窗口 |
| P-MIGRATION-OBSERVE | 确定真实 schema diff | SQL 身份/库/只读 principal UNKNOWN；四个确切表的 INFORMATION_SCHEMA，≤512 行/128KiB/10秒，无业务行 | 否 | **SQL 观察独立批准** | 四表合成结构/索引证据 | 错库/额外 scope/结构或索引不符即停 |
| P-MIGRATION-DDL | 仅执行审阅后的增量 | DB owner/executor/window/最终 SQL hash UNKNOWN；最多四 CREATE + 条件 F3 ALTER；不运行测试 --apply 到生产 | 否 | **DDL 另批**，含锁/空间/回退 | 固定 DDL source/hash | 锁超时、漂移、未知在线 DDL 能力；不自动 DROP |
| P-RESTORE | 撤销与 Publication 同检查点 | 表/identity/文件清单、checkpoint、异地加密目的地、key custodian、隔离恢复目标 UNKNOWN | 否 | **业务数据备份恢复另批** | 四表合成恢复仅 PASS_SCOPED | 缺撤销/配对 vector/资产权属/目的地，私有路径保持 OFF |
| P-CANARY | 可控切换与完整回滚 | 实际 unit/artifact/窗口/名单路由/操作者/旧构件 UNKNOWN；先双 legacy、v1 OFF，Annual normal | 否 | **部署/灰度另批**，不授权 main/push | 本地双模式启动 | 跨用户、混代、撤销失效或严重影响；双 mode 回退且 v1 独立 OFF |
| P-V1-ENABLE | 对外 API 独立准入 | 实际 unit/外部 ingress/预算/窗口 UNKNOWN；先签 P-ID/APP/PROXY/KEY/AUDIT、DDL 和恢复 | 否 | **外部 v1 启用另批** | 冻结协议和本地反例 | 任一前置未签或把 MyTaiko PASS 自动当启用批准 |

精确字段、上限、路由、四表 CREATE、F3 ALTER 与源文件 SHA 见 [机器包](gate-p-authorization-ready.json)。复用的[只读计划](083-gate-p-readonly-approval-plan.md)包含 fail-closed 命令模板和字段白名单；[schema/恢复计划](083-prod-schema-and-recovery-plan.md)包含最小结构 SQL、锁与回退影响。机器包没有批准 ID、签名或假地址，任何未来发现均不能自动扩大下一步范围。

RPO≤15min、RTO≤120min、PITR、异地加密备份与真实规模恢复均 **UNPROVEN**。十二项私有资产仍为 private-resource-01…12 占位，名称/权属/运行依赖/备份目的地待 Owner 映射；未读、未复制，恢复能力也未知，不能声称实际资产已丢失。它们与十二项旧 PNG Golden 不是同一清单。

只读发现不授权 SQL；结构 SQL 不授权业务行/备份；备份恢复不授权 DDL/灰度；灰度不授权 v1。v1 关闭时只能验证关闭行为，受限实例的授权反例测试也需要单独批准其运行状态，不能隐式开启 feature gate。
