# Sakura Taiko Viewer 0.69.1 — Goal Evaluation

## 0. 阶段定位

当前生产基线为 `0.69.0`。Goal Foundation 已正式关闭：无 REFERENCES schema、真实 SQL persistence/concurrency、生产 migration、create/reload/login/profile switch/replace/stale conflict/cancel、cleanup/orphan audit 全部 PASS；Evaluation 尚未启用，Daily Progress 未修改。

0.69.1 只解决一个问题：

> 冻结 Goal baseline 后，后续 authoritative score state 是否足以证明该 Goal 已达成？

目标链路：

```text
Frozen Baseline
→ Later Authoritative Observation
→ Evidence Validation
→ active → completed
→ Persist Completion Evidence
```

本版不把 Goal 完成并入 Daily Progress，不改推荐算法，不做 streak / XP / Weekly Recap。

---

## 1. 版本与边界

目标版本：`0.69.1`。

实施开始前读取 canonical version；不得回退。

继续支持六种 Goal：

- `score-pb`
- `ng-reduced`
- `clear`
- `fc`
- `df`
- `rank-upgrade`

继续不开放：

- manual Goal
- accuracy Goal
- probability Goal
- arbitrary numeric target
- runtime unplayed Goal（当前 source completeness 仍为 unknown）

---

## 2. 先做 Evaluation Trigger Audit

编码前先审计 authoritative score 的正式写入路径：

- Wahlap
- Hiroba
- Kinoko/import
- `writeUserdataWithHistory`
- account refresh/sync
- 其他 production write path
- manual（只确认边界，不纳入 Evaluation）

必须回答：

1. 非 manual authoritative writes 是否收敛到一个可靠 post-write boundary？
2. 哪些路径可能是旧数据导入/回填，不能把“写入时间”当游玩时间？
3. 是否可以在 score write 成功后触发内部 Goal evaluation？
4. 如果没有统一 hook，是否需要显式 evaluation mutation？

优先策略：

### A. Post-authoritative-write hook
若存在统一可靠写入边界，优先在 score/history write 成功后调用 Goal evaluator。

要求：Evaluation 失败不能回滚已经成功的 score sync。

### B. Explicit evaluation mutation
若没有统一 hook，使用显式 mutation，例如：

```text
POST /api/account/growth/goal/evaluate
```

由客户端/同步完成后触发。服务端自行读取 authoritative state。

**默认禁止 GET `/api/account/growth/overview` 隐式写 completed。**

---

## 3. 因果证据模型

Goal baseline 已有：

- `baselineVersion=1`
- baseline score fields
- SHA-256 content revision
- `capturedAt / causalBoundary`
- source provenance
- source completeness

Evaluation 读取 later authoritative state，并验证：

```text
same authenticated owner
same binding
same song
same difficulty
same source semantics
later revision/provenance is after baseline
not cached/pre-baseline replay
```

不得仅依赖：

- request time
- file mtime
- evaluate time

作为“Goal 后发生”的证据。

---

## 4. Completion Evidence 必须持久化

不能只写：

```text
status=completed
completed_at=NOW()
```

必须在现有 versioned `goal_data` 内冻结 completion evidence，概念：

```ts
{
  evaluationVersion: 1,
  evaluatedAt,
  observationCapturedAt,
  observationRevision,
  baselineRevision,
  source,
  provenance,
  result: {
    goalType,
    before,
    after,
    facts
  }
}
```

`completed_at` 的语义是：

> Viewer 确认并持久化 Goal 达成的时间。

不是玩家实际打出成绩的精确时间。

若 source 有可靠成绩事件时间，可另存 `scoreEventAt`。

优先不新增 schema；现有 `status / completed_at / goal_data` 应足够。

---

## 5. 状态机

本版：

```text
active
cancelled
completed
```

允许：

```text
active → cancelled
active → completed
```

禁止：

```text
cancelled → completed
completed → cancelled
completed → active
```

Goal 历史不可逆。

`active → completed` 后，现有 generated `active_binding_id` 自动变为 NULL，因此同 binding 可以创建下一 Goal。

---

## 6. 六种 Goal 完成规则

### score-pb

```text
future.highScore > baseline.highScore
```

并要求 later authoritative observation、同 chart/source/revision continuity。

记录 before / after / delta。

### ng-reduced

```text
future.ngCnt < baseline.ngCnt
```

且：

- good/ok/ng 完整非负
- baseline/future 总判定物量一致
- total > 0
- later authoritative observation

不得把缺失字段补 0；语义仍是“保存成绩中的不可降低”。

### clear

baseline 尚未 Clear 或更高。

完成证据：

- `future.clearCnt > baseline.clearCnt`
- 或 authoritative FC/DF 状态足以证明 Clear 已达成

### fc

完成证据：

- `future.fullComboCnt > baseline.fullComboCnt`
- 或 authoritative DF 状态足以证明 FC 已达成

### df

```text
future.dondafulComboCnt > baseline.dondafulComboCnt
```

### rank-upgrade

```text
future.bestScoreRank > baseline.bestScoreRank
```

验证有效 rank 范围，最高 rank 不提供该 Goal。

Higher crown 可以满足 lower Goal：

```text
DF → satisfies FC + Clear
FC → satisfies Clear
```

但 evidence 必须记录真实观察到的状态，不伪造不存在的 counter 转移。

---

## 7. Evaluation 结果

纯函数建议：

```ts
evaluateGoal(baseline, observation, goalType)
```

返回：

```ts
{
  outcome: 'completed' | 'active' | 'inconclusive',
  evidence?: ...
}
```

- `completed`：证据充分，条件满足
- `active`：证据充分，但尚未达到目标
- `inconclusive`：revision/provenance/source/字段不足，不能判断

`inconclusive` 不等于失败，Goal 保持 active。

V1 不新增 `progressed` / `failed` 状态。

---

## 8. Persistence Service

建立类似：

```text
evaluateActiveGoalForBinding(...)
```

职责：

1. server-resolve user/current binding
2. lock active Goal
3. 读取 verified later authoritative observation
4. 调纯 evaluator
5. 若 completed，CAS `active → completed`
6. 写 completion evidence
7. 返回稳定结果

客户端不得提交“我完成了”的成绩事实。

---

## 9. 并发与幂等

必须真实 SQL 验证：

### evaluate vs evaluate
同 observation 重复触发，只完成一次；`completed_at` 不漂移。

### evaluate vs cancel
最终只能是 cancelled 或 completed 之一。

### evaluate vs replace
若 A 先 completed，则 stale replace(A) conflict；
若 replace 先成功，则 A cancelled，evaluation 不得再完成 A。

### completed 后
可以正常创建下一 active Goal。

禁止：

- double completion
- completed → cancelled
- cancelled → completed
- evidence 写到错误 Goal
- wrong profile completion

---

## 10. Stale / Replay / Repair 防误判

必须覆盖：

- same revision
- older revision
- cached pre-baseline state
- source mismatch
- binding mismatch
- chart/difficulty mismatch
- source provenance discontinuity
- data reset/repair
- historical replay/backfill

不能证明 later 时：

```text
outcome = inconclusive
Goal stays active
```

---

## 11. Home 最小反馈

0.69.1 必须让用户看见 Evaluation 结果，但不提前做 0.69.2 Daily Progress 整合。

推荐：

```text
这次练成了

Fallen Angel
魔王 · 9星

刷新最好成绩
998,360 → 1,005,490
```

或：

```text
不可 8 → 4
拿到通关
拿到全连
拿到全良
评价提升
```

避免：

- “任务完成！”
- Mission Complete
- XP / 奖励
- 大型庆典动画

保持“太鼓生活页”语气。

---

## 12. Overview DTO

建议保持：

```ts
activeGoal: Goal | null
recentCompletedGoal: GoalCompletion | null
```

不要把 completed Goal 塞回 `activeGoal`。

简单规则：

- 如果最新 Goal 是 completed 且没有更新的 active Goal，可返回 recentCompletedGoal
- 用户创建下一 active Goal 后，新的 Goal 成为主要内容
- 不引入任意 24h / 7d TTL

历史入口留给后续阶段。

---

## 13. 不改 Daily Progress / Recommendation

即使同一次 observation 同时：

```text
PB + NG下降 + FC + Goal completed
```

0.69.1：

- Goal Evaluation 只处理当前 Goal
- Daily Progress 继续用既有算法
- Recommendation ranking 不改
- 不自动创建下一 Goal
- 不自动切换 target dimension

`Goal completed → Daily Progress narrative` 留给 0.69.2。

---

## 14. Tests — Pure Evaluation

至少覆盖：

- PB unchanged / +1 / missing / regression
- NG 8→4、8→8、总物量变化、字段缺失
- Clear via clear / FC / DF
- FC via FC / DF
- DF
- Rank 6→7、7→8、unchanged、invalid
- higher crown satisfies lower goal

---

## 15. Tests — Evidence Boundary

至少：

- same revision → no completion
- old revision → no completion
- wrong source → no completion
- wrong binding → no completion
- wrong song/difficulty → no completion
- pre-baseline cache → no completion
- provenance discontinuity → inconclusive
- duplicate observation → idempotent

---

## 16. Historical Replay

继续沿用 0.68.9 / 0.69.0 的确定性验收方法。

至少六种 Goal 各有：

```text
baseline R1
→ future authoritative R2
→ expected completed
```

另覆盖：

- unchanged
- inconclusive
- stale snapshot
- duplicate observation
- one observation containing multiple achievements

---

## 17. Browser Matrix

至少：

1. active PB
2. completed PB
3. completed NG
4. completed Clear
5. completed FC
6. completed DF
7. completed Rank
8. completed → create next Goal
9. inconclusive remains active
10. A/B profile isolation

覆盖：

- zh / ja
- 390×844
- 1440×900
- light/dark 若现有 matrix 成本可接受

检查：

- no raw key
- no overflow
- no hydration error
- no scroll-to-top mutation
- Today Plan / Daily Progress 不被 completed UI 挤掉

---

## 18. Production Smoke

不等待真实街机自然事件。

使用隔离生产测试账号：

```text
create Goal
→ freeze baseline
→ 写入合法 future authoritative observation
→ 触发正式 Evaluation path
→ Goal completed
→ reload
→ logout/login
→ completed evidence persists
→ create next Goal
→ cleanup
```

线上只需重点 smoke 1 个代表性 Goal；六种全部覆盖留给 replay + real SQL integration。

---

## 19. Cleanup / Orphan

最终必须：

```text
temporary user = 0
binding = 0
session = 0
goal = 0
userdata = 0

user orphan = 0
binding orphan = 0
owner mismatch = 0
```

继续通过正式 lifecycle helper，不手工残留部分数据。

---

## 20. Performance

记录：

- pure evaluation compute
- SQL transition latency
- 若采用 post-write hook：score sync 增量 latency
- 若采用 explicit mutation：evaluation HTTP latency
- Growth Overview latency

Evaluation 不应明显拖慢原有 sync 或 Home 首屏。

---

## 21. Logging / Security

日志区分：

```text
goal-eval completed
goal-eval unchanged
goal-eval inconclusive
goal-eval conflict
goal-eval error
```

不得记录 session token、私密凭据或完整私人 score file。

所有 Evaluation mutation：

- authenticated
- current binding server-resolved
- private, no-store
- 不能操作任意 user/binding
- 不能提交任意 observation
- 不能完成 cancelled/completed Goal

---

## 22. Completion Blockers

任一存在不得关闭：

- GET Overview 隐式写 completed（除非单独审计批准）
- 只凭 request time / mtime 判断完成
- 客户端提交 completion facts
- completion evidence 未冻结
- `completed_at` 被冒充实际游玩时间
- duplicate evaluate 改写 completed_at
- cancelled Goal 被完成
- completed Goal 被取消
- replace/evaluate race 产生错误状态
- stale observation 完成 Goal
- wrong profile/chart/difficulty 完成 Goal
- 六种规则未覆盖
- 修改 Daily Progress 算法
- 修改 recommendation ranking
- production smoke 未 PASS
- cleanup/orphan 非 0

---

## 23. 最终报告必须回答

1. 实施开始/最终 Viewer 版本？
2. Evaluation trigger 采用 A 还是 B？为什么？
3. 审计了哪些 authoritative write paths？
4. GET Overview 是否保持只读？
5. pure evaluator 接口？
6. completion evidence 结构？
7. completedAt 的语义？
8. 是否需要 schema migration？
9. 六种 Goal 分别如何判定？
10. higher crown 如何满足 lower Goal？
11. stale/same revision 如何处理？
12. source discontinuity 如何处理？
13. evaluate/cancel race？
14. evaluate/replace race？
15. duplicate evaluate？
16. completed 后能否创建下一 Goal？
17. recentCompletedGoal 如何返回？
18. Home completed UI 如何表现？
19. 是否修改 Daily Progress？
20. 是否修改 Recommendation？
21. 六种 replay 是否 PASS？
22. real SQL concurrency 是否 PASS？
23. browser matrix 是否 PASS？
24. production completion smoke 是否 PASS？
25. cleanup/orphan 是否 0？
26. 性能数据？
27. Evaluation 是否正式启用？
28. 是否 READY FOR 0.69.2？

---

## 24. 完成状态

全部 Gate 通过后记录：

```text
0.69.1 GOAL EVALUATION COMPLETE

AUTHORITATIVE POST-BASELINE EVIDENCE ACCEPTED
SIX GOAL TYPES EVALUABLE
GOAL COMPLETION EVIDENCE PERSISTED
ACTIVE → COMPLETED TRANSITION ESTABLISHED
COMPLETED GOAL SURVIVES RELOAD / LOGIN
EVALUATION CONCURRENCY / IDEMPOTENCY ACCEPTED
DAILY PROGRESS UNCHANGED
RECOMMENDATION RANKING UNCHANGED

READY FOR 0.69.2 GROWTH FEEDBACK LOOP CLOSURE
```

---

## 25. 0.69.2 预留

0.69.2 才做：

```text
Goal completed
→ Daily Progress / Today narrative
→ Player State refresh
→ Today Plan / next action
```

届时再正式关闭：

```text
Recommendation
→ User Choice
→ Baseline
→ Authoritative Result
→ Goal Completion
→ Growth Feedback
→ Next Action
```

即完整 Goal Feedback Loop。
