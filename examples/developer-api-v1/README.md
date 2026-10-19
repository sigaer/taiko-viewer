# Developer API v1 服务端接入例

应用文档版本为 0.85.0；Contract 1.1 仍为候选，未宣布冻结。常规 Developer Token 接入请先阅读 [四个只读 API 与指南](../../docs/developer-api-batch1.md)。本目录保留既有应用 Key / ResourceGrant API 的服务端示例，鉴权体系与 Developer Token 分开，应用转正不扩大任何权限。`server-read.ts` 可纳入服务端 TypeScript 项目，不放入浏览器包。

公开目录使用 `readPublicCatalog('https://viewer.sakura-bot.cn')`，无需 Key 或查询参数，默认歌曲内包含 charts；每个谱面仅有 difficulty 和 level。独立 charts 路径与旧 include 查询不再可用，严格旧客户端需更新绑定。

`readAuthorizedScores({baseUrl,key,playerId})` 仅用于已有稳定 client、有效应用 Key 和明确同意的 playerId，仍受服务器启用状态和现有读取权限控制；没有授权返回 403。不要用 Developer Token 冒充此处的应用 Key，不收集浏览器 Cookie，也不把密钥放入 URL、前端或日志。本次线上验收只覆盖指南中的四个 API，没有新建或扩大生产 ResourceGrant。

用户可按现有规则撤销。读取时仍重新核验授权；示例不缓存载荷、不自动重试。304 时 SDK 的 data 为 null，不能继续使用未经重新核验的旧载荷。`safeFailure` 只保留 status/code/requestId。本次未修改日次配额或权限规则。

超过 Catalog 10,000 行/源 8 MiB、Scores 20,000 条或响应 JSON 8 MiB，服务端返回 503 + 明确 LIMIT_EXCEEDED 错误，无部分 200/304。不能用重试规避；后续分页另提版本。Owner 列表最多 100，有 hasMore 说明遗漏。

旧 `/api/developer/userdata`、proxy current/history/update、public-score-token 和 bot service 继续按原认证域工作；public-score-token 可能刷新并写成绩，v1 GET 不这样做。旧 Token 不自动获得 Grant，不改旧权限，不设 sunset。Web 自读走 Session/BFF，受控 Bot 走既有 Service capability，本地 Core 消费者保留进程内读取，均不为统一而增加 HTTP。

OpenAPI 可离线打包（输出到受控 QA 的证据目录，不能覆盖已有文件）：

```sh
node examples/developer-api-v1/bundle-openapi.mjs "$QA_EVIDENCE_DIR/developer-api-v1-bundled.json"
```

只解析唯一仓库 Schema，无远程引用。打包物是发布派生物，修改正本仍在 `packages/sakura-taiko-contract/schema/contract-v1.json`；不得编辑打包物再当作新 Schema。

可重放本地示例/引用验证：在本分支根目录用 `bash scripts/memory/run_qa.sh /usr/bin/python3 "$PWD/scripts/readiness/run-viewer1-integration-qa.py" examples`。示例测试的传输是合成 loopback 宿主；真实隔离 SQL 授权/撤销证据来自已保留的 0.83 原 74 项及本次边界回归，不将两者混作生产测试。
