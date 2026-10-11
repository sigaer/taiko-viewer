# 私有成绩服务授权配置

适用范围：Phase 6 / 6.3e.8.1 的 Developer userdata 读取。此时其余中心代理、Hiroba、QQ bind 写操作尚待迁移，不能据此激活整个 Phase 6。公共曲库、公开玩家资料与排行榜继续使用原协议。开发者每日额度与私有成绩授权是两个独立检查。

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

当前生效的正式读取 scope 为 `source_read`。`history_read` helper 已具备边界，但正式 history 代理尚待接入。schema 预留 `wahlap_update`、`hiroba_sync`、`hiroba_credential_status`、`hiroba_bind`、`bind_read`、`bind_write`、`bind_current`；预留名称不表示相关调用迁移已完成。Source 列表 1–128 项，ID 为 1–128 位 ASCII 字母、数字、下划线或短横线；必须同时满足 stdin 总长度。`expiresAt` 为 DB DATETIME 格式 `YYYY-MM-DD HH:mm:ss`，使用数据库的时间语义；active 登记要求未来时间或 null。

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

Viewer 此子步只提交源码与证据，版本沿用 Phase 6 预备 0.82.0；统一标准部署负责构建、push 和服务重启。发布前必须完成 Wahlap 旧 dispatcher caller、Hiroba credentials argv、QQ bind authority、SDK 权限与缓存处理，以及剩余全部 Writer/Read Model/P1a 工作。运行中的 R 未复制这些预备变更，此子步无需重启 NoneBot。
