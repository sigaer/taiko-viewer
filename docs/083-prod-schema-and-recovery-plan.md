# 0.83 授权表、恢复与灰度执行预案

`gateP=DEPLOY_PENDING_AUTH`，`deployReady=false`。生产 SQL/DDL、备份、恢复、灰度、回滚及开关操作本轮均 **未执行**。本文件只记录源码目标与隔离库证据；RPO ≤15 分钟、RTO ≤120 分钟是待验证目标，合成恢复不代表真实规模达标。

## 目标 schema 与生产差异控制

唯一 DDL 来源是 [schema.ts](../taiko_viewer/server/infrastructure/developer-api-v1/schema.ts)，四张 additive InnoDB/utf8mb4_bin 表不存成绩，不创建 Writer。

| 表 | 主键 / 唯一约束 | 必需索引 / 语义 |
| --- | --- | --- |
| web_developer_api_clients | client_id；application_id 唯一 | idx_api_client_owner_page(owner_user_id,created_at,client_id)；应用归属、active/disabled |
| web_developer_api_resources | player_id；binding_id 唯一 | 不把公开 playerId 当成授权 |
| web_developer_resource_grants | grant_id；(owner_user_id,binding_id,client_id) 唯一 | idx_api_grant_player_client(player_id,client_id)；idx_api_grant_owner_page(owner_user_id,issued_at,grant_id)；scopes/audience/source、同意版本、有效期、撤销及 revision |
| web_developer_resource_grant_events | 自增 id | idx_api_grant_event(grant_id,id)；保留授权/撤销事件 |

生产差异未知。后续先经只读授权对这四个**确切表名**查询 INFORMATION_SCHEMA 的列、字符集、引擎、索引；不 SELECT 业务行。将观察结果与本次锁定 DDL 做结构 diff，并提交确切待执行语句及 hash。不得自动 DROP、改列、重建表或覆盖已有 Grant。

仓库 `migrate_developer_api_v1.ts` 无参数只输出四条 CREATE；`--apply` 被限定为独占隔离 `_test`。它的 `CREATE TABLE IF NOT EXISTS` **不会修复既存表缺失的 F3 索引**。生产如已有早期表，需另外审阅以下两条增量的适用性、锁表成本和窗口，仅在对应索引确实缺失且独立 DDL 授权后执行：

```sql
ALTER TABLE web_developer_api_clients
  ADD INDEX idx_api_client_owner_page(owner_user_id,created_at,client_id);
ALTER TABLE web_developer_resource_grants
  ADD INDEX idx_api_grant_owner_page(owner_user_id,issued_at,grant_id);
```

不能向生产直接运行当前测试迁移 CLI，也不能放松它的隔离 guard。表存在但结构/索引不符时停止迁移并复核；不把“第二次 CREATE 没报错”当作生产幂等证明。生产 SQL、执行身份、时限和具体回退 DDL 仍待单独审批。

## 本轮真实隔离证据与边界

`viewer083SchemaRecovery.test.mjs` 在全新 `_test` MySQL 中查验实际 DATABASE()/@@datadir、显式 mutation opt-in 后：dry-run 输出四表；两次 apply 后结构一致；检查两个 F3 owner-keyset 索引列序；真实 Cookie HTTP 同意、Key+Grant 读、撤销携旧 ETag 返回 403；禁用 client 保留行；在该库中仅删除 allowlist 四表，再用 bounded 合成 schema/行快照恢复；恢复后的 disabled client 携旧 ETag 返回 401，未复活授权。日志/hash 由集成 evidence index 关联。

禁用 client、撤销 Grant 是状态变更，均不等于硬删除；资源映射和审计行必须保留。独立客户端禁用/Token 撤销/Grant 到期/解绑/所有者变化都应拒绝私有读取，权限校验先于缓存及 304。不能删除审计事件来“回滚授权”。此测试只证明四张合成表的恢复及拒绝行为，未证明生产约束/既存 schema 升级、全量恢复性能、异地备份或 PITR。

## 一致检查点、备份与恢复顺序（待执行）

1. 先批准资产 owner、可读/备份范围、密钥保管、加密异地目的地与恢复隔离目的地。十二项私有资源仍使用 `private-resource-01` 至 `private-resource-12` 占位；真实名称、权利、运行依赖和备份去向全待 Owner 映射。本轮没有读、复制或 hash 它们；它们不是十二项旧 PNG Golden。
2. 未来经批准建立 Writer/授权变更静止窗口或可靠一致快照机制；记录 SQL snapshot/binlog GTID/position 与统一 UTC 检查点。把 sessions、developer applications/tokens、binding/owner/source 生命周期、四授权表、Goal、冻结 history measurement 纳入同一恢复集合。先私有化最终表 allowlist 和 schema fingerprint，再执行备份，不根据本计划猜表名。
3. 对每个受保护 score identity 记录 committed Publication vector（sequence/commitId/文件 hash）并包含引用的不可变 objects、必要事实/观察历史、measurement、Goal、Catalog/模型及 schema 版本。使用既有 Publication 备份/校验接口与写锁；禁止自行复制松散 current JSON 代替一致 vector，禁止恢复时重算 Annual/measurement。保留上一可验证 generation。
4. SQL 加密全备配连续 binlog/PITR；Publication/事实/冻结文件使用相同检查点及加密离机备份。传输、远端接收、保留、校验、解密权限与恢复职责分离。Owner 确认备份 key 的离线恢复与异地目的地；本轮目的地未知。
5. 隔离恢复到新库/新存储：先核 schema/index/lock，再恢复检查点 SQL 与对应 Publication vector/objects；重放仅到与文件 vector 可证明一致的点。跨集合不一致则保持私有入口 OFF，不靠最新时间戳猜配对。
6. 恢复不能让检查点后的撤销失效：用独立保存的撤销/禁用审计及 Token/Session/binding 变更补齐到恢复目标；无法证明完整时默认禁用外部 API、失效受影响 Session/Token/Grant，要求重新登录/授权，不从旧备份重新激活 client。任何实际变更需包含在恢复执行授权内。
7. 核对 owner/binding/source、Publication hash、冻结 measurement/Goal、客户端状态与撤销序列；执行合成无 Grant/错 owner/撤销/旧 ETag 负面测试。记录“故障点→恢复点”损失与端到端恢复时间，再由 Owner 决定 RPO/RTO 是否达标。没有真实规模测量时不标 PASS。

## 三步灰度及完整回滚（均待另批）

| 阶段 | 必须显式配置 | 准入与停止条件 |
| --- | --- | --- |
| 1：含代码、旧模式 | NUXT_MY_TAIKO_READ_MODEL_MODE=legacy；NUXT_PUBLIC_MY_TAIKO_READ_MODEL_MODE=legacy；NUXT_DEVELOPER_API_V1=false；NUXT_PUBLIC_DEVELOPER_API_V1=false；TAIKO_DEVELOPER_API_V1_ENABLED 不置 1；Annual startup mode 保持 normal | 精确部署构件/解释器/ACL 与恢复检查点已签；验证原 Session/绑定、Profile/成绩/Growth、原 `/my`；新 BFF/v1 404。QA 的 owned-qa 禁止写入生产配置 |
| 2：仅 My Taiko 受控名单 | private/public 两个 myTaiko mode 同为 read-model，Developer v1 仍 OFF | 名单隔离必须先有可审查实现；当前 mode 是进程级，不自带用户 allowlist，不能声称已经可以按用户灰度。需独立批准隔离实例/路由名单方案及观察窗口 |
| 3：评估外部 v1 | 四表/索引、P-ID/P-APP/P-PROXY/P-KEY/P-AUDIT、备份恢复及独立预算/审计签收后，另批 v1 配置 | Contract 已冻结不等于允许运行；不得因阶段 2 PASS 自动启用 v1 |

跨用户正文、撤销/过期后仍读、错误 304、混合 Publication/Catalog 代际、数据错误、资源失控或严重服务影响立即停止。失败记录、用户影响和精确构件身份持续保留，不删 FAIL。

My Taiko 代码回滚同时把 **private 和 public** mode 设回 `legacy`；外部 v1 独立 OFF，并确保旧兼容开关 `TAIKO_DEVELOPER_API_V1_ENABLED` 没有重新开启它。使用标准部署流程和获批的不可变旧构件，不手工替换一份前端文件或单独重启来代替完整回滚。表、Grant 撤销、审计与合法新 Publication 保留，不能为了代码回滚回退用户数据。若确需数据恢复，执行前述已签一致检查点程序并重验证撤销安全；DDL 删除不是常规回滚。

Owner 尚需签：真实身份/入口观察授权、origin 分叉差异、具体生产 schema diff 与 DDL、备份目的地/权属/PITR/RPO/RTO、受控名单实现、灰度窗口与回滚操作者，最后才是是否启用外部 API。当前状态不是 `DEPLOY_READY`。
