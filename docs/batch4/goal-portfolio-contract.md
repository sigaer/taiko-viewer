# Multi-Goal Portfolio Contract

新增 `goal-portfolio/2`，尚未建表、迁移或改 API。保留 v1 Goal ID、Baseline、完成证据与历史语义；现状清单见 [兼容文档](backward-compatibility.md)。

## 现有约束与目标

现有 `PlayerGoal.status` 只有 active/cancelled/completed，`unavailable` 是单独布尔值；`GoalEvaluationResponse` 只有 activeGoal/recentCompletedGoal。SQL 的 `active_binding_id` 生成列和 `uniq_goal_active_binding` 强制单 active。`mutateGoal` 新建前取消原 active，CAS 参数是 `expectedActiveGoalId`，并非 Portfolio revision。只扩 TypeScript 数组不能实现多目标。

新增 Portfolio 以 `(ownerId, profileId)`（当前 binding ID）为所有权边界；source/account/topology 变化须重新验证。无全局“当前目标”唯一约束。同 Chart 的不同 GoalType、不同显式 target 可并行；完成任一 Goal 不取消、不完成、不重置其他 Goal。

## 规范数据模型

下列为新增逻辑模型，非现有可导入 TS 类型。ID/revision 使用十进制字符串避免 BIGINT 精度丢失，时间为带时区 ISO instant，持久层 UTC。

```ts
type GoalPortfolioV2 = {
  schemaVersion: 2;
  ownerId: string; profileId: string;
  portfolioRevision: string;             // 单调 CAS，每次提交 +1
  goals: PortfolioGoalV2[];               // 分页 API 另带 snapshotRevision
  updatedAt: string;
};
type PortfolioGoalV2 = {
  id: string; profileId: string; goalRevision: string;
  songId: number | null; chartId: string | null;
  canonicalSongId: string | null; identityMappingRef: string | null;
  difficultyType: number | null;          // chart goal 必填；跨谱面 task 可 null
  goalType: string; evaluatorVersion: string;
  target: Target | null;                  // 新Goal必填；旧非法/不支持记录可null
  legacyRecord: object | null;            // 迁移时原PlayerGoal完整不可变保留
  displaySnapshot: { title: string; starLevel: number | null };
  lifecycleStatus: 'active' | 'paused' | 'completed' | 'cancelled';
  availability: {
    state: 'available' | 'unavailable' | 'unknown';
    reasonCodes: string[]; checkedAt: string; catalogRevision: string;
  };
  userPriority: number;                   // 0..3，3最高，默认1；不是 A/B/C/D
  userOrder: number;                      // 所有未终态目标中的 0 起连续序号
  baseline: BaselineEnvelope;
  latestEvaluation: GoalEvaluationV2 | null;
  completionEvidence: unknown | null;     // v1 原对象保留；新版本由 evaluator schema 验证
  origin: GoalOrigin;
  diagnostics: { reasonCodes: string[]; missingEvidence: string[]; limitations: string[] };
  createdAt: string; updatedAt: string;
  pausedAt: string | null; completedAt: string | null; cancelledAt: string | null;
};
```

`Target` 引用 [Candidate](candidate-schema.md)。`BaselineEnvelope={version, capturedAt, sourceRevision, evidenceRefs, value}`：version=1 时 value **逐字段保留原 GoalBaseline**（包括 provenance/sourceCompleteness/recordPresent/nullable 数值）；新增类型使用明确版本，不能强转 v1。每个 Goal 自己冻结 baseline，即使两 Goal 创建于同一 snapshot，也有各自 baseline 引用，不能后续原地刷新。

legacyRecord 是只读历史证据，不是第二套可写Goal状态；保留旧targetData/title/starLevel等全部字段供v1 evaluator和历史回放。target=null 的遗留记录必须带 TARGET_UNSUPPORTED、不得生成绑定候选；仍允许查看、暂停、取消。新Goal不得以null target入库。跨谱面task Goal的songId/chartId/difficultyType可null，仅在task-progress evaluator正式注册后允许创建；具体谱面候选仍须精确chartId。

所有新chart Goal的chartId必须使用Catalog Authority canonical Chart ID，canonicalSongId取Authority行，songId只保留sourceSongId适配含义。迁移旧Goal时按原来源namespace/ID/difficulty与冻结catalogRevision唯一解析，记录identityMappingRef；无法解析则chartId/canonicalSongId=null、availability=unknown且报CHART_ID_UNRESOLVED，不生成推荐关联，不删除目标或重采baseline。禁止直接拼旧数字ID为永久ID；原v1 evaluator仍在原identity/provenance scope内评价，不重写历史完成证据。

`GoalOrigin={kind:'legacy'|'manual'|'accepted_recommendation', acceptanceId:null|string, candidateId:null|string, decisionId:null|string, sourceSnapshot:null|object}`；legacy sourceSnapshot 保存现有 source/sourceBasis/sourceMode/sourceRank/sourceRevision/sourceGeneratedAt，不能把旧来源重写为新算法。用户直接创建合法 Goal 不需要伪造推荐，但必须显式提交目标并冻结 baseline。

`GoalEvaluationV2={evaluationId, goalId, goalRevision, evaluatorVersion, baselineRevision, observationRevision, evaluatedAt, observationCapturedAt, outcome:'completed'|'active'|'inconclusive'|'unsupported', reasonCodes, evidenceRefs, result}`；result 的结构由 GoalType/evaluatorVersion 注册。错误为请求/任务错误，不假装 active。原 GoalEvaluation 的 reason/result 保存在 v1 evaluator 结果中。`goalRevision` 是该评价使用的输入 revision；提交后 entity revision 可更大。

## 生命周期与 Unavailable Goals

“Unavailable Goals”是明确支持的 Portfolio 视图：任何未终态 Goal 的 availability=unavailable 或 unknown 都仍保存并可查看；不丢 baseline、不隐式 cancel。不把 unavailable 混进用户生命周期，避免下架后错误复活已取消/已完成目标。

| 操作 | 允许起点 | 结果 |
| --- | --- | --- |
| 用户接受/手动创建 | 无实例 | active，独立 baseline；不影响已有 Goal |
| pause | active | paused；保留 baseline/优先级/次序 |
| resume | paused | active；availability 若不可用仍不可推荐，不刷新 baseline |
| cancel | active/paused | cancelled，终态 |
| 权威 completion | active；paused 可在用户显式 evaluate 时 | completed，独立完成证据；别的 Goal 不变 |
| catalog/来源变化 | 任意 | 更新 availability；终态证据不重算 |
| 重做/改 target | completed/cancelled 或想改目标 | 明确创建新 ID；旧 baseline/target 不可变；不隐式复活 |

paused 不参加自动候选提序和后台完成更新；用户显式 evaluate 可证明暂停期间已完成，记录触发方式。unavailable 的任务停止推荐；权威新观测仍可证明既往目标完成，但必须通过原 evaluator 的因果和来源检查，不能以目录状态推断发生时间。

## GoalType 单一评估路由

| 保留/新增 | GoalType | 意图路由 / 完成规则 |
| --- | --- | --- |
| 保留 | score-pb | score_improvement/score_pb；v1 `highScore > baseline.highScore` |
| 保留 | ng-reduced | crown_completion/ng_reduction；v1 可比总判定数下 NG 减少 |
| 保留 | clear/fc/df | crown 子类型；v1 对应计数转正及原 provenance/reset 检查 |
| 保留 | rank-upgrade | score_improvement/rank_upgrade；v1 1..8 范围内 rank 提升，不当作段位任务 |
| 保留但不可新建 | played | v1 evaluator 返回 unsupported；不得借迁移标完成 |
| 新增、待版本化 evaluator 实施 | score-target | 显式 threshold，观察 highScore≥threshold，含 baseline/时序检查；不冒充 score-pb |
| 新增、暂不开放创建 | dimension-practice / task-progress / played 的新版本 | 先分别注册训练动作证据、真实任务要求或可识别游玩完成规则及版本，再开放；缺 evaluator 时 `canCreateGoal=false` |

Personal Goal 的 readiness 经 GoalType 路由到 [同一专用 evaluator](type-specific-evaluation.md)，其 completion 调用唯一 Goal evaluator。readiness 与完成是两种输出，不建立一个推荐端“猜完成”的第二实现。训练/探索候选可以存在而暂时不能创建 Goal；明确在 capabilities 报告，不能承诺所有建议都可存 Goal。

## 存储与事务边界（新增设计，不是迁移脚本）

保留 `web_player_goals` 为唯一 Goal 内容来源；计划删除 active 唯一索引/生成列，增 goal_schema_version、goal_revision、user_priority、user_order、availability 状态/版本字段；已有 goal_data 的 v1 内容封装到 v2。SQL lifecycle 字段与 JSON 的一致性由同一事务校验，禁止另建一份可独立写的 activeGoal 状态。

新增 `web_goal_portfolios(user_id,binding_id,revision,updated_at)`，唯一键 `(user_id,binding_id)`；新增事务内 command/event 存储（commandId、requestHash、响应、前后 revision、受影响 Goal IDs）。每 Goal evaluation 的 evidence 不放在 Portfolio 共享可变 baseline。历史按 Goal ID 读取，不使用最新 Goal 遮住其他 Goal。

最大 100 个 active+paused（含 unavailable）Goal，每次最多 100 个操作/评价对象；超限拒绝 422，不截断 CAS 写入。终态目标游标分页，固定 snapshot revision，不把历史丢进每次候选排序。

所有写操作使用 `expectedPortfolioRevision`（必填）和 `commandId`；修改现有 Goal 另带 expectedGoalRevision。整个 Portfolio 一次命令 all-or-nothing，同事务校验权限、所有目标、顺序、idempotency，写 Goals/事件并将 Portfolio revision 递增一次。仅修改不同 Goal 的并发写也先保守串行 CAS，冲突返回 409 和当前 revision，不静默覆盖。userOrder 重排必须包含所有未终态 IDs 恰好一次，终态剔除并重编号；与新建并发必冲突。

锁顺序保留源读租约在 SQL 外层：必要 source publication read lease → account owner → bindings（现有稳定顺序）→ portfolio → goal IDs 升序 → command/event。绑定切换/解绑同样锁 owner/bindings。禁止 SQL 锁内调用 Python 推荐计算。只在事务前计算纯评价，事务内校验 frozen observation revision/source marker、baseline/goal revision、当前绑定和目录版本；变化返回冲突后重读，不把旧评价覆盖新状态。

评价持久化（含 active/inconclusive 结果更新）、availability 更新、pause/resume/reorder 都算 Portfolio 写入，各受影响 Goal revision +1，Portfolio +1；完全相同 evaluationId/commandId 重放为 no-op，不再次增 revision。自动后台评价也读 expected revision，冲突至多重新取数重算两次，仍冲突返回待重试，不无限重试。

同 observation 可支持同 Chart 多个 Goal，逐个 evaluator 得出独立结果，在一次 batch 内原子提交。一个结果 inconclusive 不阻止其他完成，基础设施错误则整事务 rollback。同一 observation 不因此变成多次游玩。完成事实唯一键继续包含 goalId，计数 Goal Progression 可有两个完成，但 play 指标只能认领一次。

## 新 API 与安全意图

新增拟议端点 `/api/account/growth/goal-portfolio`（GET，纯读）、`/goal-portfolio/commands`（POST）和 `/goal-portfolio/evaluate`（POST）。GET 返回 schemaVersion/revision/Goals/capabilities；GET 不暗中评价或创建事实。命令包含 profileId/expectedPortfolioRevision/commandId/operations；无权限不返回别人的 revision。409 后客户端重读并展示冲突；422 是 unsupported/limit/invalid target。

接受推荐先 preview，后显式 accept-and-create。v2 短时 signed token 绑定 owner/profile/source identity、action=accept-goal、candidateId/decisionId、intent/subtype、canonical target hash、catalog/policy/score/evidence revisions、portfolioRevision、issuedAt/expiresAt、nonce/keyId/schemaVersion。有效期 15 分钟，重启失效可要求刷新；初期保留进程内 HMAC 密钥语义，不擅自引入另一套长期凭据。多实例共享/轮换密钥是后续单一 signer 部署决策。

token 验签不代替权限、CAS、目录/成绩复验。事务内用 `(owner,profile,commandId)` 唯一键：同 requestHash 重放原响应且不重采 baseline；异 payload 返回 409。成功事务记录 nonce 归属，不能更换 commandId 重放创建第二目标。精确相同未终态 Goal（规范化 type/target）返回 existingGoalId，不重置 baseline；不同 target/GoalType 同 Chart 合法。

v2 token绑定的chart为canonical chartId并包含identityMappingRef，不以来源数字键替代；跨revision映射变化需重新preview。接受推荐时origin.sourceSnapshot必须保存intentType/subtype/targetHash，Discovery另保存target.discoveryMode，不能在接受时互换，也不能自动转换成score-pb。缺对应completion evaluator仍不允许建Goal。

旧 API 的隔离和迁移步骤见 [backward-compatibility.md](backward-compatibility.md)。本阶段不访问或执行真实 DB schema 变更。
