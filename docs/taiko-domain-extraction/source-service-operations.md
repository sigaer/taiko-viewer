# 私有成绩服务授权配置

适用范围：Phase 6 / 6.3e.8.1–4 的 Developer userdata、历史、Wahlap/Hiroba 更新、QQ 绑定及 Hiroba 凭据代理。客户端缓存授权和其余 Phase 6 Gate 仍待完成，不能据此激活整个阶段。公共曲库、公开玩家资料与排行榜继续使用原协议。开发者每日额度与私有授权是两个独立检查。

`GET /api/developer/userdata/:userid` 接受有效登录 Cookie 或有效开发者 Bearer token。普通凭据只能读取其账号自有绑定，允许自有非 current 绑定；完整 binding id/taiko_id/source/manual_account_id 在 Source SH 前后复核。绑定本身沿用现有产品的 SQL 授权含义，不额外声称已证明上游账号归属。跨账号中心服务需要按 **token id** 单独登记，不能以开发者申请获批、每日额度、HTTP userid/userId/QQ、同一用户的另一枚 token 推导授权。

`taiko_source_service_grants` 每个 token 一行，保存明确的 service name、Source allowlist、scopes、状态、expiry 和 revision nonce。服务读操作选择授权后不得在撤销时切换成另一类授权继续返回旧结果；新请求可重新选择仍有效的自有绑定。所有读取在首次 actor SQL 前捕获 SQL pool、Source root 与 kernel cwd，并在 SH 内入口与返回前复核有效凭据、完整授权以及存活的 manual SQL authority。托管对象损坏、lease 失效或私有 SQL 故障返回固定 503；无身份 401、无资源授权 403。健康响应仍是完整原始 JSON，未知字段不丢失。

中心服务可选择明确的 Source 列表，或显式 `"*"`。后者是受信中心服务的跨用户能力，只能由私有运维入口登记，普通开发者 token 没有默认全源访问。生产激活前先核对真实服务、token owner 和实际 Source 使用范围；taiko-bot 尚无运行中的业务进程，本子步没有为任何生产 token 登记能力。

## 私有 CLI

实现：[configure_source_service.ts](../../taiko_viewer/scripts/configure_source_service.ts)。此工具无 HTTP 入口，从 stdin 接收至多 16 KiB 的 JSON，45 秒独立进程上限、两个 DB connections；所有连接配置通过私有环境文件载入。不得把 raw token、密码或 DB secrets 放进 argv、Git 或留档。

请求格式如下，ID 与 nonce 使用真实运维输入替换；这里的值仅为格式示例。

```json
{
  "operationId": "11111111111111111111111111111111",
  "operatorUserId": "1",
  "tokenId": "2",
  "serviceName": "taiko-bot",
  "status": "active",
  "scopes": ["source_read"],
  "sources": ["123456789"],
  "expiresAt": null
}
```

已接入的正式 scope 为 `source_read`、`history_read`、`wahlap_update`、`hiroba_sync`、`bind_read`、`bind_write`、`bind_current`、`hiroba_credential_status`、`hiroba_bind`。Source 列表 1–128 项，ID 为 1–128 位 ASCII 字母、数字、下划线或短横线；必须同时满足 stdin 总长度。`expiresAt` 为 DB DATETIME 格式 `YYYY-MM-DD HH:mm:ss`，使用数据库的时间语义；active 登记要求未来时间或 null。

含 `bind_*` 或 `hiroba_bind` scope 的登记另须明确 `principals`：1–128 项身份列表，或显式 `"*"`。身份支持 1–128 位裸数字、`onebot_v11:` 加 1–128 位数字、`qq_official:` 加 1–128 位 ASCII 字母/数字/下划线/短横线。大小写及不同格式分别授权，不自动合并别名。遗漏或 null 拒绝登记；仅含 Source scopes 的旧配置可保持 null。新 nullable `principals_json` 同时存入 grant 与审计表，升级只忽略已存在列的 ER_DUP_FIELDNAME，其余 SQL 错误停止。

QQ 代理配置可在上述请求中改为 `"scopes": ["bind_read", "bind_write", "bind_current"]`，并增加 `"principals": ["onebot_v11:12345"]`。Source allowlist 须包括该身份已绑定的全部 Source 与本次添加的 Source；不能通过空绑定绕过添加目标检查。生产真实 principal/token 登记继续留到最终激活。

`GET/POST /api/taiko/proxy/bind` 与 `POST /api/taiko/proxy/bind/current` 现在要求有效 Cookie/token。普通凭据须有当前已验证、active 的 Viewer QQ 绑定，与裸 QQ 或 `onebot_v11:QQ` 精确匹配；添加外部账号另须完整自有、同平台 Viewer binding，manual 通过既有创建/认领入口。服务凭据同时证明 exact grant/revision/expiry/principals/sources/scope，选中服务授权后不降级为 owner 授权。

QQ metadata 只触及 SQL，不读写 C/H，也不在 SQL 事务后申请 Source 锁。共用 2 active/8 queued/30s admission，以 63 字符 SHA 身份名的 MySQL GET_LOCK 串行化，等待上限 5 秒。account→credential→principal grant/目标 owner binding→bind rows→selection state→最小 receipt，完整返回前再次证明；每身份最多 128 绑定，slot 小于一百万，旧 healthy visibility/manual/u0 DTO 保留。GET 只读，旧缺失 current 在内存中选择首项，不保存修正。失败回滚，rollback 或 RELEASE_LOCK 无法证明时销毁连接。

两种 mutation 接受可选 `requestId`（32 位小写 hex 或小写 UUID）；省略时服务生成。持久回执仅保存操作/actor/grant/principal/action/intent/outcome 哈希及时间，无原始 Cookie/token/完整 DTO。相同凭据、完整 grant 和意图重试只返回当前 DTO，不重复变更、覆盖后来 selection；相同 ID 不同意图 409。COMMIT ACK 不明时，捕获 pool 的新连接必须证明 exact 回执和当前 outcome，不能把未提交当成功。

每日 quota 改为单条 INSERT…ON DUPLICATE KEY UPDATE，在 unique daily key 上原子决定递增或拒绝；首次 insert 的自增主键与 duplicate increment 的 LAST_INSERT_ID(count) 分别解释，capped no-op 为 0。实际并发 IP/token 边界与同 nonce 请求已验证。SQL 行数语义参考 [MySQL 官方文档](https://dev.mysql.com/doc/refman/8.4/en/insert-on-duplicate.html)，QA 以实际驱动返回头为准。

`GET /api/taiko/proxy/hiroba/credentials/:taikoId` 要求有效 Cookie/token 的完整自有外部 binding，或明确 `hiroba_credential_status` 与目标 Source。manual 拒绝；凭据不存在返回原 `hasCredentials:false`，存在则以兼容的原 Fernet key 解密验证，损坏固定 503。状态不要求 current 成绩文件存在，不改变凭据、绑定或 C/H；路由仍执行正常每日 quota。

`POST /api/taiko/proxy/hiroba/bind` 保留邮箱、密码、可选 `targetTaikoNo`、`configuredByQq`，增加可选 `requestId`。普通凭据只授权预先存在的完整自有 Hiroba bindings；服务需明确 `hiroba_bind`、Source 与 principals。发现的全部目标卡片、可选 QQ 的全部已有成员及写入目标都须被授权，QQ 字段、密码或上游登录成功不能代替该证明。卡片顺序与目标过滤沿用原 playable-card helper；没有匹配卡片仍返回原空结果，不创建 binding。原 helper 的发现范围不在此改为实际所有官方卡片的额外查询。

Viewer 首次 actor SQL 前捕获 pool、root/cwd 和 worker key 环境。native worker 只发现可玩卡片、兼容加解密或计算 keyed HMAC 意图，不连接 SQL、不写凭据/token/成绩文件。密码仅经 HTTP body 与私有 stdin；旧无授权 Hiroba adapter 返回 410，旧 password argv 路径已退出。SQL 按 account→credential→Source/principal grant→credential/bind rows→selection→receipt 顺序，在一个事务内保存全部卡片凭据、可选 QQ metadata、current state 和最小回执；receipt INSERT 后再次完整复核才 COMMIT。credential-only 不保存 QQ metadata。`configured_by_qq` 列扩为191，覆盖合法官方身份长度。

凭据绑定与其他私有 worker 共用单进程 2 active/8 queued/30s admission；operation nonce 的 GET_LOCK 等待5s，非空 QQ 结果另用原 principal gate。stdin32KiB/stdout16KiB/stderr8KiB，fingerprint/decode30s、discovery180s；native SIGALRM 独立生效，parent TERM后1.5s KILL并等待close。客户端 bind timeout300s。回执仅保存 actor/grant、keyed HMAC意图、最多128个有序Source IDs及credential/outcome hash，不保存原密码或完整DTO。已提交的同凭据/授权/意图重试跳过登录和重写，返回当前QQ结果，不覆盖后来selection；不相关自有binding新增不使完成回执失效，已选binding撤销则拒绝。COMMIT ACK不明须在捕获pool的新连接证明exact回执、凭据及当前outcome，未COMMIT不能报成功。rollback/named-lock释放无法证明则销毁连接。这是纯SQL metadata事务，不纳入C/H发布，也不在SQL后申请Source锁。

普通 Cookie/token 可以更新完整自有 binding 对应的平台，Wahlap/Hiroba 不互换，manual 不允许外部 acquisition。中心服务仍须逐项配置 scope 与 Source 范围。private worker 独占 Source EX，再锁定 SQL 凭据与授权，每次成绩发布前及最终 COMMIT 前复核；Node 返回前取得 fresh SH，验证原 produced commit/sequence 与完整授权，不能返回另一代成绩。晚 SQL/transport/撤权失败不自动撤销已经授权提交的成绩；该更新代理未增加跨请求 nonce 重放。

历史返回保留完整 raw full/delta/未知字段与原文件名顺序，累计 32MiB 超限返回 503，不截断。图片 current/history 使用同一 publication view，PNG 上限16MiB，私有目录最多16个暂存文件、1800秒过期清理，响应成功或失败后删除本请求图片。账户同步与更新代理共用单 Viewer 进程2个 active/8个 queued/30秒排队；Wahlap 180秒、Hiroba 900秒执行上限，native worker 有独立 signal deadline。多副本发布前仍需 host admission 审阅。

工具从 SQL 验证 operator 的 **username 与 email 同时匹配现有站点运维身份**，然后按 account→token→grant→audit 锁序提交一次 SQL transaction。token owner 必须存活，active 登记要求 token 有效且未撤销。最小 audit 只保存此次能力配置；不会复制成绩。相同 operationId/配置重试确认已有记录，不会覆盖后续新配置或撤销；相同 operationId 携带不同配置返回 409。丢失 COMMIT ACK 只根据同一捕获 pool 的新连接和 exact audit 确认；未提交不能报成功，rollback 失败销毁连接。

在 Viewer 目录内，经内存隔离 wrapper 启动：

```bash
bash /home/sigaer/taiko/taiko-forum/scripts/memory/run_qa.sh \
  /usr/bin/env TAIKO_ALLOW_TEST_DB_MUTATION=1 \
  /www/server/nvm/versions/node/v24.13.0/bin/node \
  --env-file=/absolute/private/test.env --experimental-strip-types \
  scripts/configure_source_service.ts --apply < /absolute/private/service-request.json
```

默认模式只 inspect，不写配置。测试 apply 必须以实际 `SELECT DATABASE()` 确认 `_test` 且与载入配置一致，并有显式 mutation opt-in。不得把生产数据复制进测试库。生产操作只在最终激活步骤使用：私有环境额外设 `TAIKO_SOURCE_SERVICE_EXPECTED_DATABASE` 为实际数据库及 `TAIKO_ALLOW_SOURCE_SERVICE_PRODUCTION_MUTATION=1`，命令增加 `--production --apply`。实际数据库必须匹配期望且不以 `_test` 结尾。该显式运维开关不改变当前不得用生产库做 mutating QA 的规则。

撤销使用新 operationId 和 `status: "revoked"`，仍明确提交配置字段。也可通过既有开发者 token 撤销/轮换使凭据失效；Source reader 会检查实际 token status、revoked_at、owner，而非只信 quota 检查。不要直接修改 revision 或复用旧 operationId 覆盖配置。

## 验收与后续激活

验证范围包括真实 Cookie 登录与正式 Developer route、实际开发者 quota、实际 `_test` SQL、Source SH、实际私有 CLI、排队/返回期间身份与能力替换、撤销/expiry、exact replay、单 COMMIT、late failure/rollback destroy/ACK loss、完整 JSON 与 canonical corruption。上游网络、完整 Nuxt build、真实跨用户服务注册和生产烟测留在最终激活验收。

Viewer 此子步只提交源码与证据，版本沿用 Phase 6 预备 0.82.0；统一标准部署负责构建、push 和服务重启。Wahlap 更新现已退出旧 HTTP dispatcher，Hiroba 同步与凭据发现使用私有stdin；客户端四项成绩、三项QQ绑定与两项Hiroba凭据SDK都已要求有效token。permission-aware bounded cache、native Bot凭据/QQ Writer、全部Writer/Read Model/P1a仍须完成。运行中的R未复制这些预备变更，此子步无需重启NoneBot。
