# Sakura Taiko Viewer 0.68.9
# Daily Progress Narrative — Final Acceptance by Historical Replay
# Authoritative History Replay × Real Browser Fixture × Production Smoke

## 0. 阶段定位

当前生产基线：

- Viewer：`0.68.9`
- Daily Progress Narrative 已实现并部署
- 固定 KPI Grid 已移除
- 首页已改为可证实的成长事件表达
- Growth Hero / Today Plan 文案已软化
- 现有测试与合成浏览器矩阵已通过
- 尚未正式关闭本阶段，原因是此前把“真实用户当天自然产生改善”设成了最终验收条件

本轮调整验收策略：

> **不再等待现实世界随机产生测试用例。**

对于当前这种确定性的历史差分逻辑，正式验收改为：

```text
Authoritative-format Historical Replay
        +
Real Browser Fixture Acceptance
        +
Production Authenticated Smoke
```

自然发生的真实用户改善：

```text
OPTIONAL OBSERVATION
```

不再作为 Closure Blocker。

---

## 1. 现有能力边界

继续严格遵守 0.68.9 审计结论。

支持：

- played
- score PB
- NG reduced
- combo improved
- crown upgrade
- FC
- DF
- rank / evaluation upgrade

本轮不输出：

- first play
- accuracy improvement
- Rating change
- six-dimension change

不得扩大能力边界。

---

## 2. 三层正式验收

### Layer A — Authoritative-format Historical Replay

**REQUIRED**

### Layer B — Real Browser Fixture Acceptance

**REQUIRED**

### Layer C — Production Authenticated Smoke

**REQUIRED**

### Layer D — Naturally Occurring Real-user Improvement

**OPTIONAL**

只有 A + B + C 全部通过，才可关闭 0.68.9。

---

## 3. Layer A — 历史重放原则

优先使用真实历史中已经发生过的事件。

例如：

```text
09:20
NG = 8

17:45
NG = 4
```

将测试时钟冻结到该历史日期，让真实 Daily Progress pipeline 把这一天当作“今天”。

期望输出：

```text
今天

打得更稳了
○○○
不可 8 → 4
```

禁止只 Mock 最终 DTO。正式 replay 必须尽量走：

```text
full snapshot
→ delta snapshot
→ history replay
→ Daily Progress event extraction
→ Growth Overview
→ Vue
```

---

## 4. Snapshot 与 Clock 要求

Fixture 必须使用现有 authoritative history 的真实字段结构：

- `high_score`
- `good_cnt`
- `ok_cnt`
- `ng_cnt`
- `combo_cnt`
- crown counters
- `best_score_rank`
- `highscore_datetime`
- `update_datetime`

以及正式 full / delta snapshot 结构。

允许 test-only frozen clock，但：

- 不修改生产 Calendar Day 语义
- 继续使用 `Asia/Shanghai`
- 不修改系统时间
- 不新增生产 debug API

---

## 5. 必测 Replay Matrix

至少覆盖：

1. **No Play** → `今天还没开打`
2. **Played / No Improvement** → `今天打了 N 张谱`，不得显示 0 KPI
3. **Score PB** → before / after / delta
4. **Old PB Restore** → 不得误判为今日 PB
5. **NG Reduced** → 真实 before → after
6. **Combo Improved**
7. **Clear Upgrade**
8. **Clear → FC**
9. **FC → DF**
10. **Rank Upgrade**，不得叫“段位变化”
11. **Same Song Multiple Events**：PB + NG↓ + FC 合并为一个 richer event
12. **Multiple Songs**
13. **Duplicate Sync**：不得重复生成事件
14. **Midnight Boundary**：23:59 → 00:01，按 Asia/Shanghai
15. **Missing Previous State**：不得猜改善
16. **Truncated History**：不得误判首次游玩/新皇冠
17. **Crown Midnight Ambiguity**：证据不足时不得归因到今天

---

## 6. Fixture 来源优先级

优先级：

1. 已存在的真实历史 snapshot
2. 从真实 snapshot 最小裁剪得到的匿名 fixture
3. 与 authoritative schema 完全一致的 synthetic fixture

若使用真实历史，必须去除：

- userId
- taikoId
- username
- token
- session
- private profile fields

---

## 7. Layer B — Real Browser Fixture Acceptance

必须启动真实 Viewer 本地/隔离环境。

让真实页面走：

```text
Home
→ authenticated fixture
→ Growth Overview
→ history replay
→ Daily Progress DTO
→ Vue render
```

至少覆盖：

- Ready + Improvement
- Ready + PB
- Ready + Crown Upgrade
- Ready + Played / No Improvement
- Ready + No Play
- Balanced
- Limited

必须真实检查：

- zh / ja
- light / dark
- 390×844
- 1440×900

重点确认：

- 不出现固定 KPI Grid
- 不显示无意义 0
- event song title 正确
- difficulty / star 正确
- before → after 正确
- 同谱多事件合并
- Hero 不命令式
- Today Plan 不训话
- no raw key
- no overflow

---

## 8. Recommendation Attribution 仍禁止

即使 fixture 中该歌曲恰好也是 Today Plan 候选，只要没有：

- recommendation snapshot
- selected goal
- baseline

就不得显示：

```text
推荐歌曲取得进步
```

只能描述：

```text
这张谱今天有进步
```

或更具体的事实。

---

## 9. Layer C — Production Authenticated Smoke

生产环境不再要求等待真实 PB / FC。

只要求：

- 真实登录 session 可用
- Growth API 200
- Home 正常 render
- Daily Progress 不报错
- `private, no-store` 保持
- 当前真实历史可安全解析
- 无 hydration error
- 无 raw key
- 无 JS error
- latency 没有明显回归

如果今天无游玩：

```text
今天还没开打
```

即为有效 Smoke。

---

## 10. Production 性能

至少记录一次真实 authenticated Growth request：

- TTFB
- total
- browser Growth visible

要求事件化 replay 不造成明显性能回退。

继续保持：

- 一次 history load
- 一次 replay
- 一次既有 Python compute

---

## 11. Layer D — 自然发生的真实改善

定义为：

`OPTIONAL OBSERVATION`

如果刚好发生，可以验证并记录。

如果没有，不阻塞 Closure。

---

## 12. Closure Policy 更新

原规则：

```text
必须真实玩家当天自然产生改善
```

正式废止。

新规则：

```text
Authoritative-format replay       REQUIRED
Real browser fixture              REQUIRED
Production authenticated smoke    REQUIRED
Natural real-user improvement     OPTIONAL
```

---

## 13. Fixture Harness 安全

禁止生产环境出现：

```text
/api/debug/set-user-history
/api/test/growth
```

等测试接口。

Fixture 应通过：

- test dependency injection
- local file
- isolated test provider
- test-only module

完成。

---

## 14. 版本规则

如果本轮只增加：

- fixture
- tests
- acceptance scripts
- docs

且不修改 production runtime：

保持 `Viewer 0.68.9`。

如果发现真实 runtime bug 并修改生产代码：

先读取 canonical version：

```text
package.json
→ nuxt.config
→ runtimeConfig.public.appVersion
```

再顺延 patch。

---

## 15. Build / Tests

必须运行：

- Daily Progress tests
- Growth tests
- Home-state tests
- recommendation regression
- history replay tests
- i18n
- version

以及：

```bash
npm run build
git diff --check
```

---

## 16. Historical Replay Report

最终报告必须列出每个 fixture：

```text
Fixture
Input snapshots
Expected event
Actual event
PASS / FAIL
```

不能只写“全部测试通过”。

---

## 17. Browser Matrix Report

至少列出：

- Ready improvement
- Ready PB
- Ready crown
- Played / no improvement
- No play
- Balanced
- Limited

并报告：

- zh / ja
- mobile / desktop
- result

---

## 18. Production Smoke Report

必须回答：

1. authenticated Growth API HTTP？
2. Cache-Control？
3. TTFB？
4. total？
5. browser visible？
6. Home 是否正常？
7. Daily Progress 当前实际状态？
8. console error？
9. raw key？
10. hydration error？

---

## 19. Completion Blockers

以下任一存在不得关闭：

- replay 只 Mock 最终 DTO
- fixture 不符合生产 snapshot schema
- PB / NG / crown 与 authoritative history 不一致
- duplicate sync 重复生成事件
- midnight attribution 错误
- 无 before 却生成 improvement
- same-song events 未合并
- Browser fixture 仍出现 KPI Grid
- Production session 无法正常打开 Growth
- 性能明显回退
- 为测试新增 production debug API
- 无 recommendation snapshot 却声称推荐因果

---

## 20. 最终状态

全部通过后记录：

`0.68.9 DAILY PROGRESS NARRATIVE CLOSURE COMPLETE`

`AUTHORITATIVE HISTORY REPLAY ACCEPTED`

`PROVABLE GROWTH EVENTS ACCEPTED`

`REAL BROWSER FIXTURE ACCEPTED`

`PRODUCTION AUTHENTICATED SMOKE PASSED`

`PLAYER HOME DAILY FEEDBACK ACCEPTED`

`NATURAL REAL-USER IMPROVEMENT NO LONGER A CLOSURE BLOCKER`

`READY FOR GOAL FEEDBACK LOOP`

---

## 21. 下一阶段

完成后正式进入 Goal Feedback Loop。

下一阶段继续沿用同样验收原则：

```text
Goal baseline
+
authoritative future snapshot replay
+
browser fixture
+
production smoke
```

验证：

```text
Recommendation
↓
User chooses
↓
Goal baseline
↓
Later score
↓
Goal evaluation
↓
Growth feedback
```

自然发生的真实 Goal 完成同样作为：

`OPTIONAL POST-LAUNCH OBSERVATION`

而不是上线前必须等待的随机条件。
