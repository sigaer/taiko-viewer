# API / Token 边界审计

> 2026-10-15 增量说明：下文保留原审计时点结论。当前 Viewer `56aa05a` 已引入 Source owner/service grant 与回程复核，不能再将下文“只有 quota”当作当前实现。当前 28 条入口与依赖 hash 见 [api-auth-matrix.json](api-auth-matrix.json)，本轮实际验证及未通过 Gate 见 [gate-evidence.md](gate-evidence.md)。旧候选分支与当前 main 分叉，未联合上线。

**Developer Token 当前主要是开发者身份与高配额凭证，不是用户数据访问授权。** “有 token 检查函数”与“每条敏感路由要求它并校验 owner/scope”是两回事。

路由盘点共 **211 个 Viewer handler 文件**：account 80、forum 22、taiko 18、developer 1、content 14、admin 54，其余见 [完整清单](evidence/viewer-routes.csv)。清单中的 direct_guard_names 只是直接语法标记，不是安全通过表；业务包装函数中的 guard 已针对关键链继续追踪。

## Viewer 边界

| API 家族 | 当前主要边界 | 数据/副作用 | 审计结论 |
| --- | --- | --- | --- |
| `/api/account/auth/*` 等登录入口 | 注册/密码/session 业务验证 | account、session | 公共登录入口不应机械要求既有 session；未进行密码攻击或全量会话测试 |
| `/api/account/bindings/*`、songs、sync | requireAccountUser / userId → 当前 binding；绑定需称号验证 | 可编辑/导入 C/H、写锁、请求同步 | 关键 owner 链存在；不等于所有操作已测试安全 |
| `/api/account/growth/*` | requireAccountUser + owner/binding | history、Goal、recent、Passport；overview 可能 INSERT measurement | 实际 Growth 前缀在 account 下；未找到顶层 `/api/growth/*` handler |
| `/api/forum/*` | 公开读；写链 requireAccountUser、业务角色/可见性 | MySQL forum 数据 | 已追踪 threads/reply 等到 service guard；其他 route 仅静态盘点，非全量权限验收 |
| `/api/developer/userdata/[userid]` | enforceTaikoOpenQuota，默认不要求 token | 直接 `readRawUserdataText(userid)`，完整 JSON | **P0：源码无登录/owner/成绩授权校验**；路径也缺少统一 allowlist/confinement |
| `/api/taiko/manifest,data,assets,resources,arcades` | 默认匿名配额；有效 Bearer 提升配额 | 公共文件/资源，quota DB 写入 | 公共数据与私有数据不能共用“只有 quota 就足够”的边界 |
| `/api/taiko/proxy/bind*` | 同样默认匿名 quota | 请求者传 identityKey；查询还可修正 current，POST 修改中心 bind | **P0：缺少 caller→identityKey 验证**；GET 不是纯读取 |
| `/api/taiko/proxy/userdata/*/history,update,sync-hiroba` | 同样默认匿名 quota | 历史数据、中心拉取/写入/渲染；Hiroba 可用中心已存凭据 | **P0：未证实目标用户授权链**；源代码直接可达敏感动作 |
| `/api/taiko/proxy/hiroba/bind,credentials/*` | 默认匿名 quota | 凭据绑定、存在性查询 | 需纳入同一个数据/identity 授权修复范围 |
| `/api/taiko/internal/manual,annual-card` | requireBotService，X-Taiko-Bot-Token，timingSafeEqual | 手动认领/写分、卡片 | 与 Developer Bearer 独立；服务 token 仍需保护调用方 identity 约束 |
| `/api/internal/*`、admin、annual share | 各自的 service/admin/share guard | 渲染/管理/分享 | 非 Developer Token 的统一覆盖范围；本轮不宣称每项完整安全验收 |

[E09](evidence-index.md#e09)、[E10](evidence-index.md#e10)、[E11](evidence-index.md#e11)、[E31](evidence-index.md#e31)、[E33](evidence-index.md#e33)、[E34](evidence-index.md#e34)。

`server/middleware/private-cache.ts` 设置 no-store，不提供认证；它的 private prefixes 也没有普遍覆盖 `/api/taiko/proxy/`。存在共享缓存风险需结合实际响应头/反向代理核实，不能推断已被 CDN 缓存。quota 使用 X-Forwarded-For 和分离 SELECT/UPDATE，信任代理及并发配额严格性另列 P1。

## Developer Token 五问

1. **谁签发？** Viewer：登录账号申请，reviewer 审批，生成 24 字符 token，旧 active token 撤销；数据库存 SHA-256 和 mask，审批邮件发送凭证。owner 为申请人的 web account。[E12](evidence-index.md#e12)
2. **谁验证？** Viewer `resolveDeveloperQuotaToken` → `readDeveloperBearerToken` → `getDeveloperTokenRowByHash`，要求记录 active；更新 last_used_at。
3. **权限是什么？** 目前源码默认匿名每 API/UTC 日 100、有效 developer token 2500（可配置）。表/查询中未见 per-resource taiko_id grant、scope、audience、expires_at 校验。`requireDeveloperToken` 参数存在，但上述 sensitive proxy 调用没有传 true。当前事实是“配额身份”，不是细粒度授权。
4. **taiko-bot 怎么用？** `TAIKO_VIEWER_DEVELOPER_TOKEN` 若设置则发 `Authorization: Bearer`；主 userdata/proxy 路径没有本地强制 token 配置。手动 API 使用另外的 X-Taiko-Bot-Token。[E02](evidence-index.md#e02)
5. **第三方能否使用？** 协议上可用任意 HTTP client 调用，非 bot 专属。匿名路径是否公网可达受网关影响，本轮未测。第三方持开发者 token **不能被视为已获得每位用户授权**。

## 其他 Token 与 Sakura API

| 凭证 / 服务 | 签发与验证 | 当前职责与风险 |
| --- | --- | --- |
| Viewer session | Viewer 登录/会话表 → requireAccountUser | Web owner；不是 bot service token |
| 中心 public score token | Python secrets.token_hex(24)，SHA-256 存 MySQL `public_score_tokens`；Viewer 经 localhost score-token gateway 管理 | 单个 taiko_id 的 bearer 成绩授权；`server.py /api/public-score/by-token` 还会刷新官方成绩，带写入副作用 |
| B public score token | 同源函数，SQLite 本地发行/查验实现仍存在 | 不是中心 Developer Token；发行命令存在，但本轮 local_api 未找到对应公共 token 路由，部署可用性 Unknown |
| Hiroba 凭据 / token | 外部登录；cryptography/Fernet 保护中心存储 | 不能当作平台通用授权；proxy 代用已存凭据必须先校验 owner |
| Wahlap cookie | 上游凭据，中心 config/env 读取 | `taiko/server.py /api/token` 与 miku `/uploadTaikoLogin` 均是写入入口；后者仅做 JWT 结构检查，未验证签名/到期真实性，且调用链未见 caller auth |
| sync dispatcher | R `127.0.0.1:3102`；/dispatch、/score-token | 依靠网络隔离，未见应用层鉴权；不得通过无 owner 的公网代理放大权限 |

中心 `server.py` 同时提供歌曲读取与 `/api/public-score/by-token`、`/api/token`；repo service 声明监听 0.0.0.0:9999。实际服务 active；公网转发/ACL Unknown。miku upload 的 before_request 只限制服务路由分区，不是认证。[E29](evidence-index.md#e29)、[E35](evidence-index.md#e35)、[E36](evidence-index.md#e36)

外围 Java 内容 API：`/taiko/*` 读、`/taiko/manage/**` JWT interceptor；`tb_user` 与 Web account 不同。公开 guide 与管理写入应在未来 boundary map 中保留，不能假定都已被 Developer API 接管。[E30](evidence-index.md#e30)

## 1.0 前最小闭环（未执行）

- 给私有读取、中心同步和绑定代理建立统一认证+用户 grant/owner/scope；不能只把 requireDeveloperToken 设为 true。
- 用户 taiko_id、bot identity、服务 identity 分开校验；参数路径在统一允许字符和 root containment 下解析。
- 封闭 cookie 更新和 localhost 管理入口的信任边界，验证每个外部入口及反向代理规则；不自动认定所有服务已公网暴露。
- 使用隔离合成账号做匿名、错用户、撤销、过期、不同 scope、缓存隔离和重试测试。API 日配额、last_used 和 ensureSchema 都可能写库，本轮没有调用这些入口。

本报告确认的是源码授权缺口，不是已证实生产入侵或泄漏。
