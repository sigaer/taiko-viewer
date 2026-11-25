# Portfolio Store, CAS and Idempotency

公共类型为 `types/goal-portfolio.ts`。`portfolio-store.ts` 提供 readPortfolio/readGoal/readPortfolioRevision/readGoalHistory、executePortfolioCommand、updateGoalEvaluation。所有 SQL revision 读取使用 CAST AS CHAR，递增使用 BigInt，再以十进制字符串传输，校验 UINT64 上限。

写入顺序：必要时先获得成绩读 lease、冻结一次成绩及 Catalog → owner → 按既有顺序锁 bindings → Portfolio → 按 ID 锁非终态 Goals → command/event。不在 SQL 锁内执行 Python 或推荐计算；事务内复验 binding source/account、CAS、谱面成绩锁和当前 Catalog pointer。批量创建同一请求共用一次成绩读取，每个新 Goal 独立冻结 Envelope/Binding。

commandId + canonical request SHA-256 在 CAS 前核验。同 ID 相同请求返回原响应（replayed=true），旧 expected revision 也不重复执行；同 ID 异请求 409。DB nonce 唯一键阻止改 commandId 再消费，且 nonce 与 owner/profile 作用域绑定。当前 API 不签发或接受推荐 V2 token，内部 nonce 约束已有实际 SQL 负例验证。

普通写命令必须 expectedPortfolioRevision；现有 Goal 必须 expectedGoalRevision；reorder 附每个 Goal 的期望 revision。冲突返回 409 与当前可见 revision，不自动在新状态上重放。一个非空变更事务只递增 Portfolio 一次；每个受影响 Goal 递增一次。无变更命令和相同 evaluationId 不递增。任何失败回滚 Goals/Portfolio/commands/events。

所有未终态 Goal 连续 userOrder，取消/完成后同事务重编号。reorder 必须精确包含全部未终态 Goal 一次；上限 100 个未终态、100 个操作/评价，超限 422，不截断。

完全相同的未终态 chart/type/语义 target 返回 existingGoalIds，保留旧 Baseline，即使来源已有更新。同 chart 不同类型或不同合法 target 可共存。Baseline reference 由 resolver 生成；重复检测比较规范化目标语义，不能依赖新分配的随机 evidence ref。

终态历史按固定 snapshotRevision 与降序 Goal ID 游标分页，游标绑定 owner/profile/snapshot，不加载全部历史参与评估。GET 使用只读一致性事务，不创建空 Portfolio；首次命令在 owner 锁下初始化 revision=0。
