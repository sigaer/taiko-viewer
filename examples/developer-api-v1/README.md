# Developer API v1 服务端接入例

本地候选，尚未正式冻结或启用生产。以 [Owner 评审](../../docs/083-owner-freeze-review.md) 的精确组合为评审输入；正式接入待 Owner 签收。`server-read.ts` 可直接纳入服务端 TypeScript 项目，复用仓库 SDK；不要打进浏览器包。

1. 开发者通过既有申请入口提交应用，等待审核；登录自己的 Viewer 会话注册稳定 client。注册不签发资源权限，Key 仍通过既有后台管理获取/轮换。
2. 资源 owner 在「应用授权」选择该应用、自己的具体绑定、profile:read 和/或 scores:read、有效期并明确同意。owner 留存授权结果中的 playerId，再通过其应用后端的受信流程交给该应用；本候选没有 OAuth callback 或自动授权码流，不能让应用搜集其他人的绑定/授权资料。
3. 应用后端从受保护服务配置读取 Key 与已同意的 playerId，调用 `readAuthorizedScores({baseUrl,key,playerId})`。baseUrl 必须是明确批准的 HTTPS origin，隔离测试可用 loopback HTTP；不将 Key 放 URL、前端、构建变量或日志。
4. profile 接口另需 profile:read；有 scores:read 不隐含 profile。没有 Grant 返回 403；错误用 `safeFailure` 只保留 status/code/requestId，不记录载荷或 Key。轮换 Key 不变 client，不增加 scope。
5. 用户可随时撤销；下一次读取（包括 ETag 请求）拒绝。示例不缓存载荷、不自动重试；304 只表示已重新授权核验的表示未变，SDK 的 data 为 null，不能忽略新错误继续返回旧载荷。

公共 Catalog 可调用 `readPublicCatalog(baseUrl)`，无需 Key。现有候选同一 client/匿名每日预算暂由所有 v1 读共用；后续公共与私有预算拆分、可信反代与错误率/429/响应字节/失效 Key 观测须由独立启用工作包签收，本准备分支不修改配额或权限行为。

超过 Catalog 10,000 行/源 8 MiB、Scores 20,000 条或响应 JSON 8 MiB，服务端返回 503 + 明确 LIMIT_EXCEEDED 错误，无部分 200/304。不能用重试规避；后续分页另提版本。Owner 列表最多 100，有 hasMore 说明遗漏。

旧 `/api/developer/userdata`、proxy current/history/update、public-score-token 和 bot service 继续按原认证域工作；public-score-token 可能刷新并写成绩，v1 GET 不这样做。旧 Token 不自动获得 Grant，不改旧权限，不设 sunset。Web 自读走 Session/BFF，受控 Bot 走既有 Service capability，本地 Core 消费者保留进程内读取，均不为统一而增加 HTTP。

OpenAPI 可离线打包（输出到受控 QA 的证据目录，不能覆盖已有文件）：

```sh
node examples/developer-api-v1/bundle-openapi.mjs "$QA_EVIDENCE_DIR/developer-api-v1-bundled.json"
```

只解析唯一仓库 Schema，无远程引用。打包物是发布派生物，修改正本仍在 `packages/sakura-taiko-contract/schema/contract-v1.json`；不得编辑打包物再当作新 Schema。

可重放本地示例/引用验证：在本分支根目录用 `bash scripts/memory/run_qa.sh /usr/bin/python3 "$PWD/scripts/readiness/run-viewer1-integration-qa.py" examples`。示例测试的传输是合成 loopback 宿主；真实隔离 SQL 授权/撤销证据来自已保留的 0.83 原 74 项及本次边界回归，不将两者混作生产测试。
