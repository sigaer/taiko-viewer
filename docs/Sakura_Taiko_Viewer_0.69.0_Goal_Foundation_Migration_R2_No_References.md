# Sakura Taiko Viewer 0.69.0
# Goal Foundation — Migration R2 / No-REFERENCES Continuation
# Application-Owned Lifecycle × DB-Enforced Active Uniqueness

## 0. 当前状态

当前实施状态：

- 实施开始版本：`0.68.12`
- 工作区版本：`0.69.0`
- Goal Foundation 核心代码已完成：
  - 六种 V1 Goal
  - authoritative baseline freeze
  - Today Plan source validation
  - persistence / API
  - Growth Overview integration
  - Home selector / cancel / replace
- 构建、自动化测试与浏览器 fixture 已通过
- 尚未发布
- 当前唯一主要阻塞来自测试库 migration：
  - 新表设计包含 `REFERENCES`
  - 测试迁移账号缺少 `REFERENCES` 权限
  - 因此真实 SQL persistence / concurrency / authenticated lifecycle / production smoke 尚未完成

本轮修订：

> **Goal schema 不再依赖数据库 FOREIGN KEY / REFERENCES。**

保持数据库负责：

> **一个 binding 最多一个 active Goal**

由应用层负责：

> **owner / binding 合法性、解绑清理、用户删除清理、孤儿检测。**

---

## 1. 本轮不是重做 Goal

以下已完成部分原则上不重写：

- Goal baseline
- source revision
- Today Plan 服务端重算校验
- six goal types
- Goal selector
- cancel / replace
- Growth Overview integration
- client binding isolation
- zh / ja
- accessibility
- existing browser UX

本轮重点仅为：

1. migration R2
2. lifecycle contract
3. real SQL validation
4. authenticated lifecycle validation
5. production release gate

---

## 2. Schema R2：移除 REFERENCES

`web_player_goals` 不创建：

```sql
FOREIGN KEY (...) REFERENCES ...
ON DELETE CASCADE
```

明确移除：

- user FK
- binding FK
- `REFERENCES web_user_accounts`
- `REFERENCES web_taiko_bindings`
- DB-level `ON DELETE CASCADE`

---

## 3. Schema R2：保留数据库约束

继续保留：

```text
PRIMARY KEY
NOT NULL
typed columns
normal indexes
generated active_binding_id
UNIQUE(active_binding_id)
```

核心不变量：

> 同一个 binding 同时最多一条 active Goal。

概念：

```sql
active_binding_id =
CASE
  WHEN status = 'active' THEN binding_id
  ELSE NULL
END
```

并：

```sql
UNIQUE KEY uq_web_player_goals_active_binding (active_binding_id)
```

---

## 4. 为什么保留 UNIQUE

应用层事务可以减少并发问题，但不能单独作为最终唯一性保证。

必须保留数据库级：

```text
generated active_binding_id
+
UNIQUE
```

用于防止：

- double click
- retry
- concurrent create
- 多进程竞争

最终产生两个 active Goal。

---

## 5. 实际 MySQL 兼容性必须验证

在真实隔离 MySQL 中验证：

```text
active Goal A
→ INSERT success

同 binding active Goal B
→ UNIQUE conflict

A → cancelled
→ active_binding_id becomes NULL

再 INSERT B
→ success

多个 cancelled rows
→ allowed
```

不能只依赖 TypeScript fixture。

---

## 6. Ownership 改为应用层硬约束

没有 FK 后，所有 Goal mutation 必须继续：

```text
session
↓
requireAccountUser
↓
resolve current binding
↓
binding belongs to current Web user
↓
transaction / row lock
↓
Goal operation
```

客户端不得指定：

- owner user id
- arbitrary binding id
- arbitrary taiko id

来操作 Goal。

---

## 7. Goal create 的 owner / binding 来源

服务端自行确定：

```text
user_id = authenticated web user
binding_id = current binding resolved by existing Growth/account rule
```

不得直接信任客户端传入的：

```text
userId
bindingId
taikoId
source
```

客户端 profile revision 只能用于：

> freshness / consistency check

不能作为授权依据。

---

## 8. Goal Read 也必须验证 ownership

读取 active Goal 时查询必须至少限定：

```text
user_id
+
binding_id
+
status = active
```

即使数据库里意外存在错误数据，也不能仅凭 `binding_id` 返回给其他 Web user。

---

## 9. Goal Cancel / Replace 继续使用 expectedActiveGoalId

保留：

```text
expectedActiveGoalId
```

目的：

- stale cancel 不能取消后来创建的新 Goal
- stale replace 不能覆盖后来新建的 Goal
- 迟到请求必须 409

---

## 10. Binding Row Lock 保留

事务内继续锁定当前 binding：

```sql
SELECT ...
FROM web_taiko_bindings
WHERE id = ?
FOR UPDATE
```

并重新验证：

```text
binding.user_id == authenticated user
```

不需要 FK 才能执行这一步。

---

## 11. 解绑清理由应用层负责

移除 `ON DELETE CASCADE` 后：

所有会删除 binding 的正式路径必须显式清理 Goal。

概念：

```text
BEGIN

DELETE FROM web_player_goals
WHERE binding_id = ?

DELETE FROM web_taiko_bindings
WHERE id = ?

COMMIT
```

实际顺序按当前 binding 删除逻辑决定。

关键：

> Goal cleanup 与 binding delete 必须处在同一可靠 lifecycle path。

---

## 12. 必须审计所有 Binding 删除入口

至少审计当前存在的：

- 普通 unbind
- manual detach
- manual permanent delete 导致的 binding 删除
- 管理/内部 binding delete path（若存在）
- 测试 / maintenance helper（若会进入生产代码）

不能只修一个 UI 路径。

---

## 13. Web User 删除清理

如果项目存在 Web user 删除路径：

必须：

```text
DELETE goals WHERE user_id = ?
```

再删除 user / bindings，或在同一事务按现有规范完成。

如果当前没有 Web user 自助删除入口：

仍需提供 / 复用账户级 cleanup helper，使未来直接删除 user 的正式维护路径能够清 Goal。

---

## 14. Goal Cleanup Helper

建议抽取明确 helper，例如概念：

```text
deleteGoalsForBinding(bindingId)
deleteGoalsForUser(userId)
```

名称按项目风格。

目标：

- 避免多个解绑路径各写一份 SQL
- 便于测试
- 便于未来 account deletion 复用

---

## 15. Cleanup 不等于普通取消

必须区分：

### 用户点击“取消 Goal”

```text
active → cancelled
保留历史
```

### binding / user 删除

```text
privacy lifecycle cleanup
物理删除相关 Goal
```

两者语义不同。

---

## 16. Rebind 语义保持

解绑：

```text
binding deleted
→ related Goals deleted
```

以后重新绑定同一个 taiko id：

```text
new binding identity
→ 不恢复旧 Goal
```

保持此前隐私语义。

---

## 17. Orphan Audit 必须新增

移除 FK 后，必须有明确 orphan 检查。

### User orphan

```sql
SELECT g.id
FROM web_player_goals g
LEFT JOIN web_user_accounts u
  ON u.id = g.user_id
WHERE u.id IS NULL;
```

必须：

```text
0 rows
```

### Binding orphan

```sql
SELECT g.id
FROM web_player_goals g
LEFT JOIN web_taiko_bindings b
  ON b.id = g.binding_id
WHERE b.id IS NULL;
```

必须：

```text
0 rows
```

### Owner mismatch

```sql
SELECT g.id
FROM web_player_goals g
JOIN web_taiko_bindings b
  ON b.id = g.binding_id
WHERE g.user_id <> b.user_id;
```

必须：

```text
0 rows
```

---

## 18. Orphan Audit 用途

至少用于：

- integration tests
- migration validation
- production smoke cleanup verification

不要求每次 Home GET 都执行昂贵 orphan scan。

---

## 19. Migration Script R2

修改：

`taiko_viewer/scripts/migrate_goal_schema.ts`

要求：

1. `SELECT DATABASE()`
2. test 环境必须 `_test`
3. mutation opt-in 保留
4. 创建无 FK 的 `web_player_goals`
5. 验证 generated column
6. 验证 UNIQUE
7. introspect schema
8. 输出简洁 migration report

---

## 20. Migration 必须幂等

重复执行：

```text
migrate_goal_schema.ts
migrate_goal_schema.ts
```

第二次不得：

- 报重复表错误
- 重建数据
- 删除数据
- 改坏索引

---

## 21. 处理之前失败的 migration 状态

此前 `CREATE` 因 `REFERENCES` 权限失败。

实现前必须检查：

```text
表是否完全不存在
是否存在 partial table
是否存在 partial index
```

用：

```text
information_schema
SHOW CREATE TABLE
```

确认实际状态。

不要假定 failed CREATE 一定什么都没留下。

---

## 22. 不再要求 REFERENCES 权限

新的测试 migration 不应依赖：

```text
GRANT REFERENCES
```

也不需要：

- 管理员额外授权 REFERENCES
- 专门的 REFERENCES migration principal

---

## 23. 仍需要正常 DDL 权限

移除 REFERENCES 不代表 migration 无权限要求。

仍可能需要：

- CREATE
- ALTER
- INDEX

如果现有测试 migration 账号连这些也没有：

> 停止并报告真实缺失权限。

不要扩大权限，也不要改连 production。

---

## 24. Real SQL Gate：Schema

真实 `_test` DB 验证：

- table exists
- engine
- charset
- primary key
- typed columns
- generated active_binding_id
- unique index
- no foreign keys
- DATETIME(3)
- JSON/LONGTEXT fields as designed

---

## 25. Real SQL Gate：Persistence

至少：

```text
create
read
reload
cancel
replace
same goal idempotent
cancelled history retained
```

必须使用真实 SQL store。

---

## 26. Real SQL Gate：Concurrency

至少：

### Concurrent create A / B

同 binding：

```text
A succeeds
B conflicts
```

最终 active rows：

```text
1
```

### Concurrent Same Goal

两个相同 Goal 并发提交：

最终：

```text
1 active Goal
```

行为可以：

- 一个 created
- 一个 existing/idempotent

不得两条。

---

## 27. Stale Replace

场景：

```text
Goal A active
client1 持有 A id

Goal A 被 client2 换成 B

client1 再 replace expected=A
```

必须：

```text
409
```

不能覆盖 B。

---

## 28. Stale Cancel

迟到：

```text
cancel(A)
```

不能取消后来 active 的 B。

---

## 29. Binding Isolation

真实 DB：

```text
User 1 / Binding A
User 1 / Binding B
User 2 / Binding C
```

Goal 必须完全隔离。

---

## 30. Profile Switch

真实持久化测试：

```text
A create Goal A

switch B
→ activeGoal != A

B create Goal B

switch A
→ Goal A

switch B
→ Goal B
```

---

## 31. Unbind Cleanup

测试：

```text
Binding A
→ create active + cancelled history
→ unbind A
```

期望：

```text
all Goals for binding A = 0
binding A = deleted
orphan audit = 0
```

---

## 32. User Cleanup

在隔离测试库：

```text
User U
→ multiple bindings
→ goals
→ account cleanup
```

最终：

```text
goals for U = 0
orphan audit = 0
```

---

## 33. Goal Baseline / Goal Types 均保持不变

R2 migration 不改变：

- baselineVersion = 1
- SHA-256 content revision
- createdAt
- capturedAt / causalBoundary
- scoreObservedAt
- crown / rank fields
- source completeness
- source provenance

Goal 类型继续：

```text
score-pb
ng-reduced
clear
fc
df
rank-upgrade
```

未游玩仍只对：

```text
server-proven complete source
```

开放。

manual / accuracy 继续 deferred，概率目标继续禁止。

---

## 34. Today Plan Source 防伪不变

POST 仍必须：

```text
重新解析 session/current binding
↓
重新生成 Today Plan
↓
校验 song/difficulty
↓
计算 source metadata
↓
重新读取 authoritative score
↓
revision recheck
↓
freeze baseline
```

发生变化：

```text
409
```

---

## 35. Growth Overview / API 不变

`activeGoal` 继续合入：

```text
/api/account/growth/overview
```

不新增 Home GET。

写入继续：

```text
POST   /api/account/growth/goal
DELETE /api/account/growth/goal
```

成功与错误：

```text
private, no-store
Vary: Cookie
```

---

## 36. Evaluation 仍禁止

本轮还是 0.69.0 Goal Foundation。

不得自动：

```text
active → completed
```

Daily Progress 也不修改。

---

## 37. Authenticated SQL Lifecycle Gate

迁移成功后，用真实 session + test DB / isolated account 验：

```text
GET Overview
activeGoal = null

POST Goal
→ created

GET Overview
→ same Goal

reload
→ persists

cancel
→ activeGoal null

DB
→ cancelled row retained
```

---

## 38. Production Migration 前检查

发布前：

1. canonical production version
2. production DB name
3. existing schema state
4. migration principal capability
5. backup / rollback convention
6. table不存在或 schema compatible
7. 无旧 partial Goal table

---

## 39. Production Migration

按标准安全路径执行无 FK schema。

不得：

- 在普通用户首次访问时碰运气 CREATE
- 自动 DROP
- 临时增加 REFERENCES 权限

---

## 40. Production Deploy

Migration PASS 后：

按现有标准：

```text
scripts/deploy_forum_web.sh
run_build.sh
```

任一步失败立即停止。

---

## 41. Production Smoke

使用隔离生产测试账号：

```text
create
↓
refresh
↓
still active
↓
cancel
↓
refresh
↓
active gone
↓
cancelled history retained
```

最后清理测试数据。

同时检查：

- no cross-profile leak
- private/no-store
- no raw key
- no JS error
- no scroll top mutation
- no extra Goal GET
- Goal create response time
- Overview response time

---

## 42. Production Orphan Audit

部署后至少执行一次：

```text
user orphan = 0
binding orphan = 0
owner mismatch = 0
```

只读。

---

## 43. 版本策略

当前工作区：

`0.69.0`

如果本轮只修 migration/lifecycle 且尚未发布：

继续发布：

`0.69.0`

不要 bump 到 `0.69.1`。

`0.69.1` 保留给 Goal Evaluation。

---

## 44. Commit Scope

当前工作区已有历史验收相关未提交修改。

必须：

- 不回滚已有改动
- 不把无关改动混进 Goal commit
- 明确 staged diff
- `git diff --check`

---

## 45. Tests

新增 / 强化：

- no-FK schema test
- generated unique test
- SQL concurrent create
- concurrent same-goal
- stale replace
- stale cancel
- binding isolation
- profile switch
- unbind cleanup
- user cleanup
- orphan audit
- owner mismatch audit
- idempotent migration

---

## 46. DB Test Safety

所有 mutation test：

先：

```sql
SELECT DATABASE();
```

必须：

```text
*_test
```

并要求：

```text
TAIKO_ALLOW_TEST_DB_MUTATION=1
```

否则 fail closed。

---

## 47. 不允许的“修复”

禁止：

- 为了 migration 通过切 production DB
- 临时删 UNIQUE
- hard-delete 普通 cancelled Goal
- 关闭 transaction
- 客户端控制 owner/binding
- 跳过 source revision check
- 把 synthetic store 当 SQL PASS
- 为了测试临时加 REFERENCES 权限

---

## 48. 最终报告必须回答

1. R2 migration 是否完全移除 REFERENCES？
2. 最终 `SHOW CREATE TABLE`？
3. 是否存在任何 FK？
4. active_binding_id generated expression？
5. UNIQUE 是否真实工作？
6. migration 是否幂等？
7. 测试账号是否仍需要 REFERENCES？
8. 真实 SQL create/read/cancel/replace 是否 PASS？
9. 并发 create 结果？
10. stale replace 结果？
11. stale cancel 结果？
12. same-goal 幂等结果？
13. Binding A/B 隔离？
14. User A/B 隔离？
15. unbind cleanup？
16. user cleanup？
17. user orphan 数？
18. binding orphan 数？
19. owner mismatch 数？
20. baseline revision 是否保持？
21. Today Plan source revalidation 是否保持？
22. 六种 Goal 是否保持？
23. 未游玩 runtime completeness 状态？
24. manual / accuracy 是否仍关闭？
25. activeGoal 是否仍合入 Overview？
26. 是否新增额外 Home GET？
27. authenticated lifecycle 是否 PASS？
28. production migration 是否 PASS？
29. production create/reload/cancel smoke？
30. production orphan audit？
31. 最终 Viewer 版本？
32. 是否实现任何 Evaluation？
33. Daily Progress 是否改变？
34. 是否可以正式关闭 0.69.0？
35. 是否 READY FOR 0.69.1？

---

## 49. Completion Blockers

任一存在不得关闭：

- migration 仍需要 REFERENCES
- schema 真实 SQL 未验
- UNIQUE 并发不工作
- 同 binding 可出现两个 active Goal
- stale cancel/replace 会误操作新 Goal
- ownership 只靠客户端
- unbind 留 orphan Goal
- user delete 留 orphan Goal
- owner mismatch audit 非 0
- baseline / source revision 被弱化
- SQL lifecycle 未真实 PASS
- production smoke 未完成
- 0.69.0 偷跑 Evaluation
- Daily Progress 被顺手修改

---

## 50. 完成后的状态

全部通过后记录：

`0.69.0 GOAL FOUNDATION COMPLETE`

`NO-REFERENCES GOAL SCHEMA ACCEPTED`

`APPLICATION-OWNED GOAL LIFECYCLE ESTABLISHED`

`ONE ACTIVE GOAL PER BINDING ENFORCED`

`REAL SQL PERSISTENCE / CONCURRENCY ACCEPTED`

`GOAL OWNERSHIP / CLEANUP ACCEPTED`

`TODAY PLAN → GOAL SOURCE ATTRIBUTION ACCEPTED`

`AUTHORITATIVE GOAL BASELINE PERSISTED`

`GOAL SURVIVES RELOAD / LOGIN / DEVICE`

`GOAL EVALUATION NOT YET ENABLED`

`READY FOR 0.69.1 GOAL EVALUATION`

---

## 51. 下一阶段

0.69.1 才开始：

```text
Active Goal
↓
Later authoritative observation
↓
provenance / revision continuity
↓
compare against baseline
↓
progressed / completed
```

继续沿用：

```text
authoritative replay
+
real DB
+
browser fixture
+
production authenticated smoke
```

不要求等待自然用户随机完成目标。
