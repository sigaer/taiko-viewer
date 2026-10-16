# ResourceGrant 与凭据控制面草案

2026-10-16；0.82 S 工作包，**DRAFT / NOT FROZEN / NOT RELEASE APPROVAL**。

本文件补充 `api-auth-matrix.json`，不取代现有 `packages/sakura-taiko-contract/schema/contract-v1.json`，不注册新 API，不改变现有授权策略。92 项 SQL/HTTP 与 installed Publication 52 项证据继续有效，不能外推到本文件未验收的路径。

## 当前事实与信任边界

| 实体 | 当前事实 | 不得推定 |
| --- | --- | --- |
| Developer Key | 当前有效 credential 标识申请人并提供 quota；private source 还验证绑定 owner 或显式 service grant | 申请通过即可读取任意 taikoId；现有 service grant 即第三方用户 consent |
| Viewer session | 当前 session → user → verified binding；source 读取前后重新证明 | Cookie 可冒充 bot service；绑定字符串相同即可获得其他 namespace 身份 |
| Bot service | `X-Taiko-Bot-Token` 独立共享密钥，常量时间比较；manual/annual-card 在读取 body 前检查 | 已实现逐 bot principal 的 scope/audience/有效期；共享密钥持有者不能声称任意 identityKey |
| public-score token | 绑定级兼容 bearer 授权，可撤销；旧中心入口会尝试刷新 | 纯只读的 Developer API v1、完整 OAuth consent、无副作用 |
| 上游 Wahlap/Hiroba 凭据 | 平台托管的上游账户能力 | 平台请求者身份；JWT 结构正确等于签名/时效正确 |

## ResourceGrant 候选字段与验证顺序

待 owner/consumer 评审的记录：`grantId`、`issuer`、`clientId`、`resourceOwner {namespace:'viewer',id}`、`bindingId`、绑定稳定版本、`resourceType`、`scopes`、`audience`、`issuedAt`、`expiresAt`、`revokedAt`、`consentRevision`。外部 identity 必须带 namespace；不得以 QQ 号码充当 Viewer user id。令牌仅保存不可逆摘要或安全加密后的必要材料，不记录明文 bearer、cookie、密码或 raw score。

候选验证流程：

1. 验证 client/session 的当前状态；缺失、失效、过期 credential → 401。
2. 验证 grant issuer 与精确 audience，clientId 必须匹配实际 client；不将其它 API/service 的 bearer 自动兑换成本路由权限。
3. 验证 grant 当前未撤销、未过期、指定 scope、resourceOwner 与指定绑定仍有效；无授权 → 403，隐藏资源按已选披露策略返回 404。
4. 获取资源锁/lease 后复核绑定身份和 grant revision；返回 DTO 或 304 前再次复核。服务不可用 → 503，不回退为匿名/缓存成功。
5. 写操作独立 `sync:request`/具体 mutation scope；幂等键绑定 actor、grant revision、resource、action、请求摘要，错误重放 → 409。不可把 GET 的缓存命中作为绕过认证的路径。
6. 失败响应 no-store、无 ETag/数据 revision；成功私有条件读取只能 private revalidate，grant 撤销后同 ETag 必须拒绝。

候选 scope 命名 `scores:read`、`history:read`、`growth:read`、`sync:request` 不等于已实现端点或冻结枚举。现有 `source_read`/`history_read` service scopes 保持原语义；迁移、过渡 audience、授权码+PKCE、用户同意/撤销 UI、刷新令牌轮换、TTL 及错误 envelope 仍需决策。不得从此草案生成承诺上线的公开文档。

## 未关闭威胁与最短验收

| 威胁 | 当前证据/风险 | 最短下一步 |
| --- | --- | --- |
| 跨用户/绑定或撤销后304 | 四条 source 路由已有92项隔离SQL证据；未覆盖全部bot/credential route | 分别跑 bot binding、Hiroba bind/status 等既有独立 suite，不能重复92替代 |
| Developer/session冒充内部服务 | 新 `internalServiceBoundary.test.mjs` 执行生产 guard 与两个实际 handler，业务 adapter 为内存 spy | 7项已PASS；验证失败在body读取/业务调用前。成功仅证明dispatch，非业务授权/HTTP入口验收 |
| 共享服务key冒充principal | 内部bot两个handler接收调用者声明的identityKey；共享密钥没有per-client audience | 签收可信调用者边界或设计独立service identity+principal约束；保持BLOCKED |
| 上游cookie控制面匿名写 | 当前Sakura `taiko/server.py::do_POST` `/api/token` 无caller auth；miku `uploadTaikoLogin` 只有结构校验 | 新offline probe只编译指定源码函数，替换writer为内存spy；预期安全FAIL，应单独修复这些owner路径，再验证拒绝无写副作用 |
| JWT签名/过期未验证 | `validate_taiko_token` 检查HS256/typ/id/exp类型及正数，没有签名或当前时刻判断 | 不把它作为调用者auth；控制面需独立授权，上游token有效性需可信上游验证或已定义验证协议 |
| 代理IP污染/配额逃逸 | quota读取X-Forwarded-For，nginx模板使用`$proxy_add_x_forwarded_for`，未证明边缘清洗 | 实际可信proxy链签收和合成伪造header测试；现有原子quota代码不能解决IP信任 |
| 上游player/ranking被过度公开 | 两路由匿名quota后用平台凭据访问Wahlap | owner签收返回字段公开性/最小字段策略；无生产抓取 |

## 已跟踪 ingress 模板审阅

只读取 Git 跟踪模板，**未读取 `/etc`、环境密钥、运行服务配置或生产监听/用户数据**。

- `taiko_viewer/deploy/nginx.viewer.sakura-bot.cn.dynamic.conf`：`location /` 与 `@nuxt` 通配转发 `127.0.0.1:3100`；没有针对 `/api/taiko/internal/*`、developer userdata 的网络 allow/deny；不能以名称 internal 推断私有网络。
- `taiko_viewer/deploy/taiko-viewer.service`：Nuxt声明监听loopback，但Nginx公开转发仍须应用授权；EnvironmentFile只记录引用，未打开。
- `taiko_viewer/deploy/taiko-sync-receiver.service`：dispatcher模板声明 `127.0.0.1:3102`；实际listener/ACL及本机其他进程信任未知。
- Sakura `taiko/deploy/taiko-public-api.service`：模板 `--host 0.0.0.0 --port 9999`；是否安装、运行及防火墙可达未知，不等于公网暴露证明。
- legacy forum nginx模板重定向Viewer；`qqbot-cache/taiko`静态alias的实际内容/披露范围未检查。

模板本身不是生产证据。正式放行仍需授权的只读部署配置/ACL签收，且禁止用公开越权请求证明它。

## 新验证命令与边界

由最终集成代理经 memory wrapper 串行执行：

```sh
bash scripts/memory/run_qa.sh /www/server/nvm/versions/node/v24.13.0/bin/node --test taiko_viewer/tests/internalServiceBoundary.test.mjs
bash scripts/memory/run_qa.sh /usr/bin/python3 taiko_viewer/tests/credentialControlPlaneProbe.py /home/sigaer/git/Sakura_bot
```

第二条是安全负面 probe；当前源码预期 exit 1 / `securityGate: FAIL`，应如实保留失败记录。源码函数提取不是完整Web框架/反向代理E2E；writer仅内存spy，真实写入次数为零。未发现复现也返回REVIEW_REQUIRED，不自动将Gate置PASS。所有0.82/0.83总Gate保持原状态。

## 本轮已执行证据与停止条件

- `internalServiceBoundary.test.mjs`：7 PASS / 0 FAIL，日志 `/var/tmp/viewer0822-internal-boundary.log`。首次系统Node不支持`--test`返回exit9，改用项目Node v24.13.0成功；不是业务测试失败后放宽断言。
- `credentialControlPlaneProbe.py`：exit1 / **securityGate FAIL**，日志 `/var/tmp/viewer0822-credential-probe.log`。两个匿名合成请求分别到达1次内存writer并响应200；miku过期exp=1及dummy签名仍通过真实结构校验。日志、测试、被提取源码hash均在矩阵`additionalSecurityEvidence`。
- 这是当前源码控制面拒绝策略失败，真实磁盘写入0、生产访问0。即刻维持这两个凭据控制面路径**禁止集成/部署**；未修改Sakura/miku实现。Viewer不相关的本地R2候选工作可继续。修复必须由对应owner增加独立caller认证/授权并重跑否定测试，不能删除probe或改为预期通过。
