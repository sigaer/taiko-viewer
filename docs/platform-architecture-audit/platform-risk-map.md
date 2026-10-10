# Platform Risk Map

评级用于 1.0 决策，不是漏洞利用结果。**当前建议 BLOCKED_BY_P0**：需先修复并验证授权和成绩发布一致性。审计本身已完成交付；没有因此擅自开始修复。

## P0：1.0 前必须关闭

| ID | 风险 / 已证实事实 | 影响及证据边界 | 关闭证据 |
| --- | --- | --- | --- |
| P0-AUTH | developer userdata 与中心 bind/history/update/Hiroba proxy 缺少目标用户授权；quota 默认匿名 | 源码可到私有读/绑定写/代用凭据。HIGH；生产网关可达性 Unknown，未证明泄漏 | 明确 caller/owner/grant/scope；隔离测试匿名、错 owner、撤销、路径约束、缓存隔离；覆盖代理链，不只给一个路由补 token |
| P0-WRITE | Python C/H 两次直接写；TS rename current 后另写 H；dispatcher 又一套 Writer，TS lock 仅单进程 | 部分发布、并发覆盖、截断读取、同名历史覆盖的可行失败路径。HIGH；实际损坏 Unknown | 跨 Python/Node/进程统一 publication 协议；故障注入/并发/重复请求/恢复/锁失败场景；已确认 committed revision 可完整恢复 |
| P0-CREDENTIAL-BOUNDARY | public-api `/api/token`、miku `/uploadTaikoLogin` 可修改共享 Wahlap cookie，源码无 caller 鉴权 | 中心上游凭据的控制面超出 Taiko 目录；一处只检查 JWT 结构。HIGH 源码，外网可达性 Unknown | 所有入口的认证/ACL 证据；关闭不需要的入口或建立受控管理通道；否定测试，确认不能由外部普通调用者覆盖 |

[API 报告](api-boundary-audit.md)、[数据所有权](data-ownership-audit.md)。C/H 指 current/history；原子 rename 一个文件不是共同提交。Python daily archive 自身已有 flock、临时文件、fsync/replace，**不能把这项保护误写成 C/H 已受保护**。

## P0 Gate 证据缺口：发布前补齐，未证明事故

| ID | 缺口 | 为什么影响 1.0 | 关闭标准 |
| --- | --- | --- | --- |
| G-RESTORE | DB+C/H+历史 measurement/archive+关键配置的一致恢复演练 Unknown | 有 backup 脚本不证明能恢复成长事实；丢掉冻结测量不能用新模型等价重算 | 无生产写入的隔离恢复演练；完整清单、完整性验证、接受的 RPO/RTO |
| G-RUNTIME | R 与 A 的关键 dispatcher 行为不同；Viewer 从 R 导入可变代码 | 只凭 Viewer commit 或 A checkout 无法复现服务行为 | 发布清单含运行树源码/依赖/模型数据 hash；明确正本和交付路径；从该清单能复建必需链路 |

恢复和可复现性的最低 Gate 必须在 1.0 前有证据；目录合并、全自动流水线不必先完成。没有把 Unknown 一律包装成已经发生的 P0 漏洞。

## P1：1.x 前优化，部分契约需在 1.0 前明确

| ID | 已观察问题 | 建议顺序 |
| --- | --- | --- |
| P1-MODEL | 718 个同 AST 函数；v2 精度与目标推荐已分叉 | 冻结 v1/v2、TopN、地区/单双打/去重契约和版本标签；建立纯计算一致性样例，再抽内核 |
| P1-HISTORY | C/H、daily archive、SQL measurement、Goal evidence 的 lineage 粒度不同 | 定义保存时测量和回放事实；补来源/模型/版本；不要把历史测量当缓存重建 |
| P1-CATALOG | 中心、A 副本、B cache 的公共文件 hash 不同；v2 上游/补充/CSV fallback 并存 | 引入数据 revision/freshness/来源字段，按字段定义 owner；不能靠同步同名文件来证明一致 |
| P1-GET | GET quota/绑定 lookup/Growth overview 有写入或建 schema 副作用 | 标明操作副作用和幂等性；监测只读探针必须避开写路径 |
| P1-RESOURCE | B userdata/history 内存字典只限 TTL 未见容量上限；中心 proxy Python maxBuffer 64MiB、无该 helper 的 timeout | 为远程数据、子进程和历史回放建立容量/时间/并发预算；本轮未跑负载，不给性能 PASS |
| P1-QUOTA | X-Forwarded-For 信任链、SELECT 再 UPDATE 配额、各 API 独立计数 | 明确信任代理和原子计数；rate limit 不承担 authorization |
| P1-LEGACY | B SQLite token/credential/Writer 保留；Java 独立账号；miku 凭据写入 | 先建入口清单及正本，再删冗余；当前 local API userdata PUT 已 410，不能误报仍可公开写成绩 |
| P1-REPLAY | Python/TS 多份 full/delta、日期、removed、去重实现 | 共享 schema + 合成契约样例；选择谁定义事实，避免只共享 parser 却分叉语义 |

重复算法本身通常不阻塞 1.0；若产品承诺“同名同版本指标各端相同”，已证实分叉就必须修复或明确区分版本，不能继续使用无区分的统一权威名称。旧性能审计结果属于旁证，本轮没有重跑，不能把过去耗时当当前全站实测。

## P2：长期工程优化

- 模块布局、Monorepo/多 Repo 选择；本轮不决定整体迁库。
- 统一发布物、跨仓库 CI、schema 兼容检查和模型回归门禁。
- 按实际容量再决定 durable queue、独立 compute service、存储数据库化；不能以“JSON 一定不可靠”跳过现有 Writer 缺陷的定位。
- 清理遗留 API/配置/副本、明确 sunset 策略；现有第三方客户端需要迁移窗口。

## 1.0 放行条件

P0-AUTH、P0-WRITE、P0-CREDENTIAL-BOUNDARY 关闭；G-RESTORE 和 G-RUNTIME 有可复核证据；模型命名/历史语义契约冻结。**建立 Taiko Core、全面迁 DB、拆微服务都不是 1.0 的先决条件。** 后续修复需单独授权，本次没有实施。
