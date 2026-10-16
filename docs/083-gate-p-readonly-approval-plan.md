# 0.83 Gate P：生产只读观察申请草案

状态 `DEPLOY_PENDING_AUTH`。这是离线计划，`productionAccess=false`；本轮没有读取生产配置、业务数据、SQL、进程身份或 HTTP。历史部署文档和模板不能证明当前运行状态。Owner 签收本文件本身不授权执行观察，也不授权 DDL、切换、重启或外部 API 启用。

## 待 Owner 填写的精确 allowlist

以下字段必须在独立批准中填写具体单值；不能用目录通配、所有 unit、全部 Nginx 配置或全库访问替代。未知值保持 `null`，不从默认配置推断线上端口或路径。

```json
{
  "authorizationId": null,
  "expiresAt": null,
  "operator": null,
  "systemdUnit": null,
  "pid": null,
  "nodeExecutable": null,
  "nuxtEntry": null,
  "nuxtArtifactRoot": null,
  "centerPython": null,
  "clientPython": null,
  "unitConfigurationFile": null,
  "environmentFileNamesOnly": null,
  "proxyVirtualHostFile": null,
  "proxyLogFormatFile": null,
  "listenAddress": null,
  "listenPort": null,
  "trustedProxyCidrs": null,
  "syntheticProbeOrigins": null,
  "syntheticProbeAccountIds": null,
  "sqlConnectionIdentity": null,
  "privateEvidenceDestination": null
}
```

目标产品域名按仓库声明为 Viewer；实际 server_name、监听、代理映射仍待观察。禁止自行扩大到其他虚拟主机、Bot 服务、生产 userdata、密钥文件或十二项私有资源。只读 SQL 是单独的后续授权项，不随 systemd/Nginx 文件观察一并授予。

## 批准后执行顺序与输出约束（本轮全部未执行）

| Gate / 目的 | 精确只读操作 | 允许保存的结果 | 不能据此宣称 |
| --- | --- | --- | --- |
| P-ID / 运行身份 | 对批准的单个 unit 执行 `systemctl show`，仅请求 Id、LoadState、ActiveState、SubState、MainPID、User、Group、WorkingDirectory、FragmentPath、ControlGroup；对批准 PID 读取 exe/cwd 链接、stat、cgroup | unit/启动时间/PID/已批准路径及构件摘要，原始记录仅私有保存 | 可达即身份正确；历史模板即当前部署 |
| P-ID / Node 与 Nuxt | 校验批准的 Node 可执行文件版本/hash，以及批准构件 manifest、入口和静态文件的流式 hash；只解析允许的 ExecStart 路径字段 | 精确 source-to-artifact 对应、版本与差异 | 未构建 HEAD 已部署 |
| P-ID / Python | 仅对批准的两个解释器执行 `-I` 的 metadata/origin 探针，禁止导入 Bot 启动入口或业务模块 | Python/version/distribution origin、94 包集合/lock/wheel RECORD 对照 | workspace Contract 0.1.2 等于 installed 0.1.0，或已升级消费者 |
| P-PROXY / 路由与入口 | 仅解析获批的 vhost 文件：server_name/listen/upstream、允许方法/路径、Origin/Host 校验、可信代理网段和 direct-peer 路径 | 脱敏后的精确路由/ACL/可信链与未知项 | HTTP 200 即 ACL 或授权 PASS |
| P-PROXY / 配额 | 按批准的两个合成来源检查 direct-peer IP 是否共享日预算、转发头是否可伪造；真实负面 HTTP 另获授权后执行 | 合成请求结果与限额归属，不记录真实用户标识 | 已实现公私预算拆分、已证明多副本配额 |
| P-KEY / 凭证 | 只观察批准配置中的字段存在性/脱敏策略；不输出值，不读全量 Environment/environ | Key/Cookie/JWT/Authorization 不进入 URL、代理日志、异常及前端的检查结论 | 有 Developer Token 即可读用户成绩 |
| P-APP / 权限 | 未来仅用批准的合成账号/应用测试无 Grant、错 binding/client/scope、过期、撤销、禁用、旧 ETag | 状态码、无正文/无 ETag、no-store 及操作审计 ID | 本地授权回归替代生产授权链观察 |
| P-AUDIT / 日志 | 解析批准的日志格式定义；若需样例，只允许专门合成请求对应的有限窗口、行数和脱敏输出 | 日志字段白名单、保留期、访问 owner | 可以读取历史业务日志或请求正文 |

禁止 `nginx -T` 全量输出、`systemctl show ... Environment`、整份 `/proc/PID/environ`、未脱敏的 cmdline、全量配置 cat 或日志 tail。敏感文件只能经批准的白名单解析器产生字段存在性/结构；任何 secret 不写 Git、终端和报告。实际观察前将命令/解析器 SHA、字段、最大行数、时间窗口及私有输出目的地一并提交；allowlist 未填齐的行不执行。

## 最短签收路径

1. Owner 确认本地集成组合及 origin/main 剩余差异的处理，不重新签 F1–F5。
2. Owner 单独批准上面填齐的只读范围，完成 P-ID/P-PROXY/P-KEY/P-AUDIT 观察；发现代理可伪造、共享配额不符或私密日志泄漏则保持阻断。
3. 独立审阅四表及 owner-keyset 索引差异、恢复检查点、备份目的地、十二项私有资源映射；见 [迁移与恢复计划](083-prod-schema-and-recovery-plan.md)。只读观察不授权变更。
4. 另批生产迁移、灰度、回滚执行窗口后，才可讨论发布。初次只运行旧模式、Developer API OFF；My Taiko 和外部 v1 分别签收。

所有实际生产值和观察证据留在批准的私有目录。代码 Gate、只读观察、生产 DDL、发布、My Taiko 开关和 v1 启用是独立决策；本文件没有合并这些权限。

## RC.5 主线复核后的最小执行表（离线，全部待单独授权）

一次性授权决定见 [gate-p-authorization-ready](gate-p-authorization-ready.md) 及同名 JSON；本计划继续作为字段和边界依据。UNKNOWN 不得替换成猜测的生产值。仓库 service 模板只提供候选名称 `taiko-viewer.service`，不证明该 unit 真实存在或正在运行。

| 步骤 | 精确操作与前置条件 | 输出字段白名单 / 上限 |
| --- | --- | --- |
| P-ID-DISCOVERY | 仅在 Owner 单独批准后，对上述**一个候选名称**执行 `systemctl show`；不存在立即停止，不执行 list-units、端口扫描或目录搜索 | Id, LoadState, ActiveState, SubState, MainPID, User, Group, WorkingDirectory, FragmentPath, ControlGroup；≤16 字段，10 秒 |
| P-ID-VERIFY | Owner 确认上一步得到的单 PID、Node/Nuxt 文件与两个 Python 路径后，仅读这些确切对象；流式 hash 与固定 receipt 对照；Python 只运行 `-I` metadata，不导入业务模块 | PID/start ticks/exe/cwd/cgroup、Node version、artifact/source hash、Python metadata origin/version；≤2 解释器，无 environ/原始 cmdline |
| P-PROXY | 先单独批准**一个** vhost 文件和明确引用的片段路径，再由白名单解析器只输出路由结构；完整 Nginx 配置读取不在范围内 | server_name/listen/upstream、Host/Origin/method/path、可信 proxy CIDR、direct-peer 配额键；≤100 条结构记录、64 KiB、10 秒 |
| P-KEY | 凭证路径和字段白名单仍 UNKNOWN；只能在单独确定文件与 parser hash 后检查存在性/脱敏配置，不输出值 | 字段存在性 boolean、redaction 配置、key lifecycle owner；禁止 Cookie/Authorization/JWT/Key、内容 hash、请求体 |
| P-AUDIT | 只读批准的日志格式文件；合成 HTTP 产生的最多 20 行样例需另外批准精确文件/合成 requestId/≤5 分钟窗口 | timestamp、合成 requestId、method、固定 route、status、bytes、duration、redaction boolean；不得保存真实标识/headers/payload |
| P-APP | 合成账号/应用/绑定/Key 的 ID 与 HTTP endpoint 尚 UNKNOWN；登录/授权/撤销会变更状态，不能并入只读观察授权 | 仅状态码、是否有私有正文/ETag、no-store、审计 ID；无 Grant、错 owner/source/scope、过期/撤销/旧 ETag 必须拒绝 |
| P-SQL-OBSERVE | 连接身份、数据库名与只读 principal 尚 UNKNOWN；只批准对四张确切表的 INFORMATION_SCHEMA 结构观察，不读取业务行 | 目标 schema 名及 table/column/type/null/default/extra/collation、index name/uniqueness/order/column；≤512 行、128 KiB、10 秒 |

任何命令执行前都要有独立授权 ID、有效期、操作者、exact scope 与私有 evidence 目的地。下例仅说明 fail-closed 模板，**本轮未执行**；未知或不匹配时在调用 systemctl 前退出，不能把空变量当作“观察全部”。

```bash
# OWNER_AUTHORIZATION_ID 和 APPROVED_UNIT 需来自另行明确批准。
: "${OWNER_AUTHORIZATION_ID:?separate authorization required}"
: "${APPROVED_UNIT:?exact unit required}"
[ "$APPROVED_UNIT" = 'taiko-viewer.service' ] || exit 64
timeout 10s systemctl show --no-pager \
  --property=Id,LoadState,ActiveState,SubState,MainPID,User,Group,WorkingDirectory,FragmentPath,ControlGroup \
  "$APPROVED_UNIT"
```

该候选名称以外的发现、路径解析、SQL 登录和 HTTP 测试均需各自授权；只读发现结果也不能自动扩大下一步 scope。真实授权/ACL 是否成立、日志是否无凭证、匿名 direct-peer 是否共享预算，都保持 UNPROVEN。
