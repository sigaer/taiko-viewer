# Growth product voice audit — 0.80.0

审计基线：main `d45e993` / Viewer 0.79.4（0.79.2 已完成）。本文件在任何产品实现修改前写入。

## 扫描范围与结论

扫描 zh/ja locale、i18n 载入文件（直接复用 JSON，无独立覆盖）、AuthenticatedHome、PlayerGrowthSurface、RecentGrowth、my/weekly、my/growth、passportPresentation、composeGrowthFeedback、usePlayerGrowth/useRecentGrowth，以及 account/growth、weekly/passport composers 返回的枚举。所有相关 locale 叶子（含现存未使用 fallback）逐项列于下表。

模板内仅保留 Rating、事实数字/箭头、歌曲名；aria-label 使用翻译或六维双语名称。server 返回 theme/fact/reason/focus 枚举，前端翻译，未发现独立服务端自然语言文案。原始 revision/SHA 不呈现在普通 UI。维度词汇已统一（大歌/体力/高速/精度/节奏/复合）；当前主问题是固定推荐、空态夸大观察、Weekly 主叙事技术性。

Daily 已按歌曲合并事实；本次保留，不恢复指标标题卡。去重后没有留给 Daily 的事实时，不能说今天没有变化。Recent 不具备真实 session 边界：first-use、recovered boundary 只谈同步与观察，不谈刚打了几首。activity DTO 不足以证明长期静默，因此线上推荐不得仅由同步时间或今日未打推导 quiet；纯 composer 支持显式 quiet，当前传 unknown。

技术说明采用可键盘操作的 details/summary；保留比较限制与范围信息。已选 Goal/刚完成 Goal 文案仅在相应 Goal DTO 存在时使用；强弱语气跟 weekly confidence，推荐最低维并不证明该维近期退步。

审计字符串：**458**（zh/ja 分别 229）；标签可重叠。

| 分类 | 数量 |
|---|---:|
| GOOD | 332 |
| SYSTEM-LIKE | 36 |
| COMMANDING | 0 |
| PROMPT-LIKE | 0 |
| OVER-TECHNICAL | 6 |
| REPETITIVE | 60 |
| TOO-GENERIC | 20 |
| TOO-CAUTIOUS | 0 |
| FAKE-ENCOURAGEMENT | 0 |
| INCONSISTENT-TERM | 16 |
| DUPLICATED-MEANING | 2 |
| MISSING-CONTEXT | 22 |

## 完整审计矩阵

| Surface | Current copy | Classification | Evidence/state | Narrative role | Required change |
|---|---|---|---|---|---|
| zh Home/Recommendation/Recent/Daily `home.growth.recent.eyebrow` | 最近 | DUPLICATED-MEANING | recent.state / facts / boundary；同步观察，不是 Session | State / Observation | 删除与标题重复的眉题。 |
| zh Home/Recommendation/Recent/Daily `home.growth.recent.title` | 最近同步的变化 | GOOD | recent.state / facts / boundary；同步观察，不是 Session | State / Observation | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.recent.caughtUp` | 最新变化都看过了 | SYSTEM-LIKE, MISSING-CONTEXT | recent.state / facts / boundary；同步观察，不是 Session | State / Observation | 只描述已知记录；无新记录不等于没游玩，未确认不等于仍在练。 |
| zh Home/Recommendation/Recent/Daily `home.growth.recent.noChanges` | 最新同步中没有可确认的新变化 | SYSTEM-LIKE, MISSING-CONTEXT | recent.state / facts / boundary；同步观察，不是 Session | State / Observation | 只描述已知记录；无新记录不等于没游玩，未确认不等于仍在练。 |
| zh Home/Recommendation/Recent/Daily `home.growth.recent.failed` | 暂时无法读取最近变化 | GOOD | recent.state / facts / boundary；同步观察，不是 Session | State / Observation | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.recent.retry` | 重试 | GOOD | recent.state / facts / boundary；同步观察，不是 Session | State / Observation | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.recent.more` | 另有 {count} 项变化 | GOOD | recent.state / facts / boundary；同步观察，不是 Session | State / Observation | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.recent.score` | 最好成绩 {value} | GOOD | recent.state / facts / boundary；同步观察，不是 Session | Observation | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.recent.ngReduced` | 不可减少至 {value} | GOOD | recent.state / facts / boundary；同步观察，不是 Session | Observation | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.recent.combo` | 最大连段 {value} | INCONSISTENT-TERM | recent.state / facts / boundary；同步观察，不是 Session | Observation | 统一连击/コンボ。 |
| zh Home/Recommendation/Recent/Daily `home.growth.recent.rank` | 评价提升至 {value} | GOOD | recent.state / facts / boundary；同步观察，不是 Session | Observation | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.recent.goal` | 练习目标 | INCONSISTENT-TERM | recent.state / facts / boundary；同步观察，不是 Session | State / Observation | 统一为这次想练/这次练成；避免任务叙事。 |
| zh Home/Recommendation/Recent/Daily `home.growth.recent.types.clear` | 新通关 | GOOD | recent.state / facts / boundary；同步观察，不是 Session | Observation | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.recent.types.fc` | 新全连 | GOOD | recent.state / facts / boundary；同步观察，不是 Session | Observation | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.recent.types.df` | 拿到全良 | GOOD | recent.state / facts / boundary；同步观察，不是 Session | Observation | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.recent.types.goal-completed` | 目标达成 | INCONSISTENT-TERM | recent.state / facts / boundary；同步观察，不是 Session | Observation | 统一为这次想练/这次练成；避免任务叙事。 |
| zh Home/Recommendation/Recent/Daily `home.growth.greeting.morning` | 早上好，{name} | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.greeting.noon` | 中午好，{name} | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.greeting.afternoon` | 下午好，{name} | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.greeting.evening` | 晚上好，{name} | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.limitedTitle` | 再积累一些成绩，推荐会更贴合 | SYSTEM-LIKE, TOO-GENERIC | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 用有状态约束的邀请；六维/均衡/记录少分别组句。 |
| zh Home/Recommendation/Recent/Daily `home.growth.nextFocusValue` | 最近可以从{dimension}入手 | SYSTEM-LIKE, TOO-GENERIC | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 用有状态约束的邀请；六维/均衡/记录少分别组句。 |
| zh Home/Recommendation/Recent/Daily `home.growth.skillOverview` | 六维概览 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.planTitle` | 可以试试这三首 | SYSTEM-LIKE, TOO-GENERIC | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 用有状态约束的邀请；六维/均衡/记录少分别组句。 |
| zh Home/Recommendation/Recent/Daily `home.growth.noRecommendation` | 暂时没有合适的练习谱面。 | GOOD | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.progressTitle` | 今天 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.noPlay` | 今天还没开打 | SYSTEM-LIKE, MISSING-CONTEXT | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 只描述已知记录；无新记录不等于没游玩，未确认不等于仍在练。 |
| zh Home/Recommendation/Recent/Daily `home.growth.progressUnavailable` | 最近还没有可确认的游玩记录 | SYSTEM-LIKE, MISSING-CONTEXT | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 只描述已知记录；无新记录不等于没游玩，未确认不等于仍在练。 |
| zh Home/Recommendation/Recent/Daily `home.growth.loadFailed` | 成长建议暂时不可用，其他首页内容仍可使用 | GOOD | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.balanced` | 最近状态挺均衡 | GOOD | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.weeklyEntry` | 看看这一周 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.passportEntry` | 成长档案 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.storyLinks` | 成长记录 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.playedSummary` | 今天打了 {count} 张谱 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.events.played` | 今天打过 | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Home/Recommendation/Recent/Daily `home.growth.events.score-pb` | 刷新最好成绩 | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Home/Recommendation/Recent/Daily `home.growth.events.ng-reduced` | 打得更稳了 | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Home/Recommendation/Recent/Daily `home.growth.events.combo-improved` | 连击更长了 | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Home/Recommendation/Recent/Daily `home.growth.events.clear-upgrade` | 新通关 | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Home/Recommendation/Recent/Daily `home.growth.events.fc` | 新全连 | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Home/Recommendation/Recent/Daily `home.growth.events.df` | 拿到全良 | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Home/Recommendation/Recent/Daily `home.growth.events.rank-upgrade` | 评价提升 | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Home/Recommendation/Recent/Daily `home.growth.factLabels.score-pb` | 最好成绩 | GOOD | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.factLabels.ng-reduced` | 不可 | GOOD | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.factLabels.combo-improved` | 连击 | GOOD | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.factLabels.rank-upgrade` | 评价 | GOOD | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.additionalPb` | 今天另外还有 {count} 首刷新了最好成绩 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.goalScore` | 最好成绩也到了 {value} | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home/Recommendation/Recent/Daily `home.growth.logSeparator` | ， | REPETITIVE | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Home/Recommendation/Recent/Daily `home.growth.log.played` | 今天也打了这首 | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Home/Recommendation/Recent/Daily `home.growth.log.score-pb` | 最好成绩又往前走了 {delta}，到了 {value} | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Home/Recommendation/Recent/Daily `home.growth.log.ng-reduced` | 不可压到了 {value} | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Home/Recommendation/Recent/Daily `home.growth.log.combo-improved` | 连击也到了 {value} | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Home/Recommendation/Recent/Daily `home.growth.log.rank-upgrade` | 评价到了 {value} | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Home/Recommendation/Recent/Daily `home.growth.log.clear-upgrade` | 拿到通关了 | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Home/Recommendation/Recent/Daily `home.growth.log.fc` | 拿到全连了 | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Home/Recommendation/Recent/Daily `home.growth.log.df` | 拿到全良了 | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Goal `home.goal.evaluate` | 确认进展 | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Goal `home.goal.completed` | 这次练成了 | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Goal `home.goal.refreshing` | 正在更新状态… | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Goal `home.goal.refreshFailed` | 成长状态刷新失败，请重新刷新。 | SYSTEM-LIKE, MISSING-CONTEXT | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 只描述已知记录；无新记录不等于没游玩，未确认不等于仍在练。 |
| zh Goal `home.goal.retryRefresh` | 重新刷新 | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Goal `home.goal.chooseNext` | 再选一首 | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Goal `home.goal.inconclusive` | 暂时无法确认，更新成绩后再试。 | SYSTEM-LIKE, MISSING-CONTEXT | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 只描述已知记录；无新记录不等于没游玩，未确认不等于仍在练。 |
| zh Goal `home.goal.unchanged` | 还在练习中 | SYSTEM-LIKE, MISSING-CONTEXT | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 只描述已知记录；无新记录不等于没游玩，未确认不等于仍在练。 |
| zh Goal `home.goal.completedTypes.score-pb` | 刷新最好成绩 | REPETITIVE | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Goal `home.goal.completedTypes.ng-reduced` | 不可减少了 | REPETITIVE | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Goal `home.goal.completedTypes.clear` | 拿到通关 | REPETITIVE | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Goal `home.goal.completedTypes.fc` | 拿到全连 | REPETITIVE | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Goal `home.goal.completedTypes.df` | 拿到全良 | REPETITIVE | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Goal `home.goal.completedTypes.rank-upgrade` | 评价提升 | REPETITIVE | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Goal `home.goal.title` | 这次想练 | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Goal `home.goal.choose` | 选这首 | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Goal `home.goal.selected` | 已选 | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Goal `home.goal.question` | 这次想练到哪一步？ | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Goal `home.goal.replaceConfirm` | 换成这首？ | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Goal `home.goal.replace` | 换一首 | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Goal `home.goal.cancel` | 取消 | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Goal `home.goal.confirm` | 就选这个 | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Goal `home.goal.saving` | 保存中… | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Goal `home.goal.baseline` | 选择时 {value} | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Goal `home.goal.baselineNg` | 选择时不可 {value} | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Goal `home.goal.unavailable` | 这张谱目前不可用 | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Goal `home.goal.noOptions` | 这首暂时还不能选择 | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Goal `home.goal.conflict` | 成绩或选择已更新，请刷新后再试。 | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Goal `home.goal.error` | 没能保存，请稍后再试。 | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Goal `home.goal.types.score-pb` | 刷新最好成绩 | REPETITIVE | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Goal `home.goal.types.ng-reduced` | 把不可再压低一点 | REPETITIVE | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Goal `home.goal.types.clear` | 先拿到通关 | REPETITIVE | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Goal `home.goal.types.fc` | 试试全连 | REPETITIVE | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Goal `home.goal.types.df` | 试试全良 | REPETITIVE | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Goal `home.goal.types.rank-upgrade` | 把评价再提一级 | REPETITIVE | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Goal `home.goal.types.played` | 先打一次 | REPETITIVE | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| zh Home existing/fallback `home.personal.eyebrow` | 我的太鼓 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home existing/fallback `home.personal.greeting` | 欢迎回来，{name} | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home existing/fallback `home.personal.rating` | Rating | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home existing/fallback `home.personal.ratingBasis` | 综合 Rating | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home existing/fallback `home.personal.connected` | 成绩已连接 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home existing/fallback `home.personal.summaryUnavailable` | 个人摘要暂时不可用 | GOOD | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home existing/fallback `home.personal.viewScores` | 查看我的成绩 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home existing/fallback `home.personal.unboundTitle` | 连接你的太鼓数据 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home existing/fallback `home.personal.unboundBody` | 绑定一个太鼓账号后，这里会显示你的成绩与推荐。 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home existing/fallback `home.personal.bindCta` | 绑定账号 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home existing/fallback `home.personal.emptyTitle` | 账号已连接 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home existing/fallback `home.personal.emptyBody` | 同步成绩后，这里会出现你的个人数据。 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home existing/fallback `home.personal.syncCta` | 同步成绩 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home existing/fallback `home.personal.recommendationEyebrow` | 今天推荐 | GOOD | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home existing/fallback `home.personal.recommendationSong` | 推荐歌曲 | GOOD | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home existing/fallback `home.personal.level` | {level} 星 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home existing/fallback `home.personal.viewSong` | 查看歌曲 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home existing/fallback `home.personal.recommendationUnavailable` | 推荐暂时不可用 | GOOD | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home existing/fallback `home.personal.noRecommendation` | 暂时没有可推荐的歌曲 | GOOD | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Home existing/fallback `home.personal.openRecommendationTool` | 打开推荐工具 | GOOD | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.title` | 这一周 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.description` | 回看这一周可以确认的成绩变化、成长记录与下一步练习方向。 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.currentWeek` | 本周 · 截至今天 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.completeWeek` | 这一周 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.highlights` | 值得记住的变化 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.guestTitle` | 登录后查看这一周 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.login` | 登录 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.loading` | 正在整理这一周 | GOOD | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.loadFailed` | 这一周暂时无法打开 | GOOD | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.retry` | 重试 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.goalCompleted` | 完成了自己选下的练习目标 | INCONSISTENT-TERM | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 统一为这次想练/这次练成；避免任务叙事。 |
| zh Weekly `weekly.passportEntry` | 查看成长档案 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.theme.stability` | 这周最明显的是打得更稳了 | GOOD | weekly.theme.type/confidence；现有 theme 算法，范围受 coverage 约束 | Observation → Meaning（周记录主题） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.theme.score-breakthrough` | 这周最好成绩刷新得最集中 | TOO-GENERIC | weekly.theme.type/confidence；现有 theme 算法，范围受 coverage 约束 | Observation → Meaning（周记录主题） | 复述已确认变化，不声称比上周更多或笼统突破。 |
| zh Weekly `weekly.theme.new-crown` | 这周最值得记住的是新的冠 | GOOD | weekly.theme.type/confidence；现有 theme 算法，范围受 coverage 约束 | Observation → Meaning（周记录主题） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.theme.rank-breakthrough` | 这周有了新的评价突破 | TOO-GENERIC | weekly.theme.type/confidence；现有 theme 算法，范围受 coverage 约束 | Observation → Meaning（周记录主题） | 复述已确认变化，不声称比上周更多或笼统突破。 |
| zh Weekly `weekly.theme.goal-follow-through` | 这周完成了自己选下的练习目标 | GOOD | weekly.theme.type/confidence；现有 theme 算法，范围受 coverage 约束 | Observation → Meaning（周记录主题） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.theme.mixed-growth` | 这周的变化落在了好几个方向 | GOOD | weekly.theme.type/confidence；现有 theme 算法，范围受 coverage 约束 | Observation → Meaning（周记录主题） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.theme.broad-activity` | 这周打过的谱面更广了 | TOO-GENERIC | weekly.theme.type/confidence；现有 theme 算法，范围受 coverage 约束 | Observation → Meaning（周记录主题） | 复述已确认变化，不声称比上周更多或笼统突破。 |
| zh Weekly `weekly.theme.focus-change` | 这周更值得关注的方向变了 | GOOD | weekly.theme.type/confidence；现有 theme 算法，范围受 coverage 约束 | Observation → Meaning（周记录主题） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.theme.balanced` | 这周整体比较均衡 | GOOD | weekly.theme.type/confidence；现有 theme 算法，范围受 coverage 约束 | Observation → Meaning（周记录主题） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.theme.quiet` | 这周主要是在熟悉谱面 | SYSTEM-LIKE, MISSING-CONTEXT | weekly.theme.type/confidence；现有 theme 算法，范围受 coverage 约束 | Observation → Meaning（周记录主题） | 只描述已知记录；无新记录不等于没游玩，未确认不等于仍在练。 |
| zh Weekly `weekly.theme.no-play` | 这周还没有新的游玩记录 | GOOD | weekly.theme.type/confidence；现有 theme 算法，范围受 coverage 约束 | Observation → Meaning（周记录主题） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.theme.limited-coverage` | 这周可确认的记录还不够完整 | SYSTEM-LIKE, MISSING-CONTEXT | weekly.theme.type/confidence；现有 theme 算法，范围受 coverage 约束 | Observation → Meaning（周记录主题） | 只描述已知记录；无新记录不等于没游玩，未确认不等于仍在练。 |
| zh Weekly `weekly.fact.played` | 打过这张谱 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.fact.score-pb` | 最好成绩 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.fact.ng-reduced` | 不可 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.fact.combo-improved` | 连击 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.fact.clear` | 首次通关 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.fact.fc` | 新全连 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.fact.df` | 新全良 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.fact.rank-upgrade` | 评价 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.coverage.complete` |  | GOOD | coverage / segments；披露保留范围及比较限制 | Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.coverage.partial` | 部分历史记录不可用，下面只列出能确认的变化 | GOOD | coverage / segments；披露保留范围及比较限制 | Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.coverage.truncated` | 较早的部分记录未保留，下面只列出能确认的变化 | GOOD | coverage / segments；披露保留范围及比较限制 | Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.coverage.unknown` | 记录范围暂时无法确认，下面只列出能确认的变化 | GOOD | coverage / segments；披露保留范围及比较限制 | Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.measurement.title` | 能力变化 | GOOD | measurementChange.compatible/reason/focusFrom/focusTo；不跨版本比较 | Observation / Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.measurement.now` | 周初 → 现在 | GOOD | measurementChange.compatible/reason/focusFrom/focusTo；不跨版本比较 | Observation / Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.measurement.weekEnd` | 周初 → 周末 | GOOD | measurementChange.compatible/reason/focusFrom/focusTo；不跨版本比较 | Observation / Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.measurement.focusChanged` | 当前更值得关注的方向从{from}转到了{to}。 | GOOD | measurementChange.compatible/reason/focusFrom/focusTo；不跨版本比较 | Observation / Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.measurement.focusSame` | 当前更值得关注的方向仍然是{focus}。 | GOOD | measurementChange.compatible/reason/focusFrom/focusTo；不跨版本比较 | Observation / Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.measurement.insufficient` | 这周还没有足够的连续能力记录。 | SYSTEM-LIKE, MISSING-CONTEXT | measurementChange.compatible/reason/focusFrom/focusTo；不跨版本比较 | Observation / Secondary disclosure | 只描述已知记录；无新记录不等于没游玩，未确认不等于仍在练。 |
| zh Weekly `weekly.measurement.limited` | 这周的成绩记录还不足以形成稳定的能力趋势。 | SYSTEM-LIKE, MISSING-CONTEXT | measurementChange.compatible/reason/focusFrom/focusTo；不跨版本比较 | Observation / Secondary disclosure | 只描述已知记录；无新记录不等于没游玩，未确认不等于仍在练。 |
| zh Weekly `weekly.measurement.algorithm-mismatch` | 本周测量口径发生更新，能力趋势暂不直接比较。 | OVER-TECHNICAL | measurementChange.compatible/reason/focusFrom/focusTo；不跨版本比较 | Observation / Secondary disclosure | 主句统一为记录方式更新；比较限制放 details。 |
| zh Weekly `weekly.measurement.model-mismatch` | 本周测量模型发生更新，能力趋势暂不直接比较。 | OVER-TECHNICAL | measurementChange.compatible/reason/focusFrom/focusTo；不跨版本比较 | Observation / Secondary disclosure | 主句统一为记录方式更新；比较限制放 details。 |
| zh Weekly `weekly.measurement.measurement-version-mismatch` | 本周测量版本发生更新，能力趋势暂不直接比较。 | OVER-TECHNICAL | measurementChange.compatible/reason/focusFrom/focusTo；不跨版本比较 | Observation / Secondary disclosure | 主句统一为记录方式更新；比较限制放 details。 |
| zh Weekly `weekly.focus.balanced` | 整体均衡 | GOOD | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.focus.limited` | 继续积累成绩 | GOOD | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.focus.insufficient-data` | 继续积累成绩 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.next.title` | 接下来 | GOOD | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Weekly `weekly.next.focus` | 最近仍可以从{focus}入手 | SYSTEM-LIKE, TOO-GENERIC | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 用有状态约束的邀请；六维/均衡/记录少分别组句。 |
| zh Passport `passport.title` | 成长档案 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.description` | 记录自己的成绩、关注方向与一路走来的变化。 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.guestTitle` | 登录后查看成长档案 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.login` | 登录 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.loading` | 正在整理成长档案 | GOOD | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.loadFailed` | 成长档案暂时无法打开 | GOOD | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.retry` | 重试 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.currentTitle` | 现在的我 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.recordedSince` | 记录自 {date} | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.focusLead` | 最近可以从{focus}入手 | SYSTEM-LIKE, TOO-GENERIC | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 用有状态约束的邀请；六维/均衡/记录少分别组句。 |
| zh Passport `passport.skillOverview` | 当前六维 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.limited` | 成绩记录还不多，再积累一些后趋势会更清楚。 | GOOD | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.newRecordTitle` | 成长记录刚刚开始 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.newRecord` | 再积累一些成绩后，这里会慢慢出现你的能力轨迹。 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.rangeLabel` | 趋势范围 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.latestMilestones` | 最近 {count} 项 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.recordsRange` | 记录范围 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.rangeDays` | {days} 天 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.rangeActual` | 已记录 {days} 天 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.dimensionLabel` | 趋势维度 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.current` | 现在 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.weeklyEntry` | 看看这一周 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.trend.title` | 这段时间 | GOOD | 当前可比较 segment 的 points、currentSegmentChange；限定所选维度 | Observation（趋势与实际值） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.trend.noPoints` | 这个方向还没有记录。 | GOOD | 当前可比较 segment 的 points、currentSegmentChange；限定所选维度 | Observation（趋势与实际值） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.trend.onePoint` | {day} 记录到{dimension} {value}。 | GOOD | 当前可比较 segment 的 points、currentSegmentChange；限定所选维度 | Observation（趋势与实际值） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.trend.summary` | {dimension} 从 {fromDay} 的 {from} 到 {toDay} 的 {to}。 | GOOD | 当前可比较 segment 的 points、currentSegmentChange；限定所选维度 | Observation（趋势与实际值） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.trend.summaryBreak` | {dimension}的记录，{fromDay}至{toDay}。 | GOOD | 当前可比较 segment 的 points、currentSegmentChange；限定所选维度 | Observation（趋势与实际值） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.trend.pointLabel` | {day}，{dimension} {value}，关注方向{focus} | GOOD | 当前可比较 segment 的 points、currentSegmentChange；限定所选维度 | Observation（趋势与实际值） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.change.up` | 这段时间，{dimension}从 {from} 到了 {to}。 | GOOD | 当前可比较 segment 的 points、currentSegmentChange；限定所选维度 | Observation（趋势与实际值） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.change.down` | 最近几次记录里，{dimension}从 {from} 到了 {to}。 | GOOD | 当前可比较 segment 的 points、currentSegmentChange；限定所选维度 | Observation（趋势与实际值） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.change.stable` | 最近几次记录里，能力结构基本没变。 | GOOD | 当前可比较 segment 的 points、currentSegmentChange；限定所选维度 | Observation（趋势与实际值） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.change.insufficient` | 记录还在积累，再多几次同步后趋势会更清楚。 | GOOD | 当前可比较 segment 的 points、currentSegmentChange；限定所选维度 | Observation（趋势与实际值） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.change.limited` | 成绩记录还不多，再积累一些后趋势会更清楚。 | GOOD | 当前可比较 segment 的 points、currentSegmentChange；限定所选维度 | Observation（趋势与实际值） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.change.stableValue` | 最近几次记录里，{dimension}基本保持在 {value}。 | GOOD | 当前可比较 segment 的 points、currentSegmentChange；限定所选维度 | Observation（趋势与实际值） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.segmentUpdated` | 记录方式更新过 | GOOD | coverage / segments；披露保留范围及比较限制 | Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.segmentExplanation` | 更新前后的数值不直接比较。 | GOOD | coverage / segments；披露保留范围及比较限制 | Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.focusTitle` | 关注方向 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.focus.balanced` | 整体均衡 | GOOD | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.focus.limited` | 继续积累成绩 | GOOD | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.focus.insufficient-data` | 继续积累成绩 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.milestonesTitle` | 最近的节点 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.recent90` | 最近 90 天 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.noMilestones` | 最近还没有可确认的成长节点。 | GOOD | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.goalCompleted` | 同时完成了自己选下的练习目标 | INCONSISTENT-TERM | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 统一为这次想练/这次练成；避免任务叙事。 |
| zh Passport `passport.goalObserved` | 这次练习目标已确认完成 | INCONSISTENT-TERM | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 统一为这次想练/这次练成；避免任务叙事。 |
| zh Passport `passport.fact.score-pb` | 最好成绩 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.fact.ng-reduced` | 不可 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.fact.combo-improved` | 连击 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.fact.clear` | 首次通关 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.fact.fc` | 新全连 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.fact.df` | 新全良 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.fact.rank-upgrade` | 评价 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.fact.goal-completed` | 完成练习目标 | INCONSISTENT-TERM | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 统一为这次想练/这次练成；避免任务叙事。 |
| zh Passport `passport.coverage.complete` | 最近 90 天记录完整。 | GOOD | coverage / segments；披露保留范围及比较限制 | Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.coverage.partial` | 最近记录存在缺口，节点只列出可以确认的部分。 | GOOD | coverage / segments；披露保留范围及比较限制 | Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.coverage.truncated` | 部分较早记录未保留，节点只列出可以确认的部分。 | GOOD | coverage / segments；披露保留范围及比较限制 | Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.coverage.unknown` | 最近记录范围暂时无法确认，节点只列出可以确认的部分。 | GOOD | coverage / segments；披露保留范围及比较限制 | Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.nextTitle` | 接下来 | GOOD | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.nextFocus` | 最近仍可以从{focus}入手 | SYSTEM-LIKE, TOO-GENERIC | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 用有状态约束的邀请；六维/均衡/记录少分别组句。 |
| zh Passport `passport.activeGoalTitle` | 这次想练 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.completedGoalTitle` | 最近练成 | INCONSISTENT-TERM | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 统一为这次想练/这次练成；避免任务叙事。 |
| zh Passport `passport.rangeAll` | 全部记录 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.updating` | 正在更新这段记录… | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| zh Passport `passport.focusContinuing` | {focus}仍然是现在最值得关注的方向。 | SYSTEM-LIKE, TOO-GENERIC | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 用有状态约束的邀请；六维/均衡/记录少分别组句。 |
| zh Passport `passport.focusChanged` | 最近关注的方向转到了{focus}。 | GOOD | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.recent.eyebrow` | 最近 | DUPLICATED-MEANING | recent.state / facts / boundary；同步观察，不是 Session | State / Observation | 删除与标题重复的眉题。 |
| ja Home/Recommendation/Recent/Daily `home.growth.recent.title` | 最近同期した変化 | GOOD | recent.state / facts / boundary；同步观察，不是 Session | State / Observation | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.recent.caughtUp` | 最新の変化は確認済みです | SYSTEM-LIKE, MISSING-CONTEXT | recent.state / facts / boundary；同步观察，不是 Session | State / Observation | 只描述已知记录；无新记录不等于没游玩，未确认不等于仍在练。 |
| ja Home/Recommendation/Recent/Daily `home.growth.recent.noChanges` | 最新の同期で確認できる新しい変化はありません | SYSTEM-LIKE, MISSING-CONTEXT | recent.state / facts / boundary；同步观察，不是 Session | State / Observation | 只描述已知记录；无新记录不等于没游玩，未确认不等于仍在练。 |
| ja Home/Recommendation/Recent/Daily `home.growth.recent.failed` | 最近の変化を読み込めませんでした | GOOD | recent.state / facts / boundary；同步观察，不是 Session | State / Observation | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.recent.retry` | 再試行 | GOOD | recent.state / facts / boundary；同步观察，不是 Session | State / Observation | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.recent.more` | ほか {count} 件の変化 | GOOD | recent.state / facts / boundary；同步观察，不是 Session | State / Observation | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.recent.score` | 自己ベスト {value} | GOOD | recent.state / facts / boundary；同步观察，不是 Session | Observation | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.recent.ngReduced` | 不可 {value} | GOOD | recent.state / facts / boundary；同步观察，不是 Session | Observation | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.recent.combo` | 最大コンボ {value} | INCONSISTENT-TERM | recent.state / facts / boundary；同步观察，不是 Session | Observation | 统一连击/コンボ。 |
| ja Home/Recommendation/Recent/Daily `home.growth.recent.rank` | スコアランク {value} | GOOD | recent.state / facts / boundary；同步观察，不是 Session | Observation | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.recent.goal` | 練習目標 | INCONSISTENT-TERM | recent.state / facts / boundary；同步观察，不是 Session | State / Observation | 统一为这次想练/这次练成；避免任务叙事。 |
| ja Home/Recommendation/Recent/Daily `home.growth.recent.types.clear` | 初クリア | GOOD | recent.state / facts / boundary；同步观察，不是 Session | Observation | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.recent.types.fc` | フルコンボ達成 | GOOD | recent.state / facts / boundary；同步观察，不是 Session | Observation | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.recent.types.df` | ドンダフルコンボ達成 | GOOD | recent.state / facts / boundary；同步观察，不是 Session | Observation | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.recent.types.goal-completed` | 目標達成 | INCONSISTENT-TERM | recent.state / facts / boundary；同步观察，不是 Session | Observation | 统一为这次想练/这次练成；避免任务叙事。 |
| ja Home/Recommendation/Recent/Daily `home.growth.greeting.morning` | おはよう、{name} | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.greeting.noon` | こんにちは、{name} | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.greeting.afternoon` | こんにちは、{name} | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.greeting.evening` | こんばんは、{name} | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.limitedTitle` | 記録が増えると、おすすめも選びやすくなります | SYSTEM-LIKE, TOO-GENERIC | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 用有状态约束的邀请；六维/均衡/记录少分别组句。 |
| ja Home/Recommendation/Recent/Daily `home.growth.nextFocusValue` | 最近は{dimension}を意識してみてもよさそう | SYSTEM-LIKE, TOO-GENERIC | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 用有状态约束的邀请；六维/均衡/记录少分别组句。 |
| ja Home/Recommendation/Recent/Daily `home.growth.skillOverview` | 6つの力の概要 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.planTitle` | この3曲はいかが？ | SYSTEM-LIKE, TOO-GENERIC | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 用有状态约束的邀请；六维/均衡/记录少分别组句。 |
| ja Home/Recommendation/Recent/Daily `home.growth.noRecommendation` | 条件に合う練習譜面がありません。 | GOOD | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.progressTitle` | 今日 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.noPlay` | 今日はまだプレイしていません | SYSTEM-LIKE, MISSING-CONTEXT | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 只描述已知记录；无新记录不等于没游玩，未确认不等于仍在练。 |
| ja Home/Recommendation/Recent/Daily `home.growth.progressUnavailable` | 確認できるプレイ記録がまだありません | SYSTEM-LIKE, MISSING-CONTEXT | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 只描述已知记录；无新记录不等于没游玩，未确认不等于仍在练。 |
| ja Home/Recommendation/Recent/Daily `home.growth.loadFailed` | 成長提案を利用できません。他のホーム機能は利用できます | GOOD | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.balanced` | 最近は全体のバランスがよさそう | GOOD | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.weeklyEntry` | 今週を振り返る | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.passportEntry` | 成長の記録 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.storyLinks` | 成長の記録 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.playedSummary` | 今日は{count}譜面をプレイ | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.events.played` | 今日のプレイ | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Home/Recommendation/Recent/Daily `home.growth.events.score-pb` | 自己ベスト更新 | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Home/Recommendation/Recent/Daily `home.growth.events.ng-reduced` | 不可が減りました | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Home/Recommendation/Recent/Daily `home.growth.events.combo-improved` | コンボが伸びました | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Home/Recommendation/Recent/Daily `home.growth.events.clear-upgrade` | 初クリア | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Home/Recommendation/Recent/Daily `home.growth.events.fc` | フルコンボ達成 | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Home/Recommendation/Recent/Daily `home.growth.events.df` | ドンダフルコンボ達成 | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Home/Recommendation/Recent/Daily `home.growth.events.rank-upgrade` | スコアランク更新 | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Home/Recommendation/Recent/Daily `home.growth.factLabels.score-pb` | 自己ベスト | GOOD | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.factLabels.ng-reduced` | 不可 | GOOD | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.factLabels.combo-improved` | コンボ | GOOD | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.factLabels.rank-upgrade` | スコアランク | GOOD | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.additionalPb` | 今日はほかにも{count}曲でベストを更新 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.goalScore` | ベストも{value}に | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home/Recommendation/Recent/Daily `home.growth.logSeparator` | 。 | REPETITIVE | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Home/Recommendation/Recent/Daily `home.growth.log.played` | 今日はこの曲もプレイ | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Home/Recommendation/Recent/Daily `home.growth.log.score-pb` | ベストを{delta}伸ばして{value}に | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Home/Recommendation/Recent/Daily `home.growth.log.ng-reduced` | 不可を{value}まで減らせた | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Home/Recommendation/Recent/Daily `home.growth.log.combo-improved` | 最大コンボも{value}に | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Home/Recommendation/Recent/Daily `home.growth.log.rank-upgrade` | 評価は{value}に | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Home/Recommendation/Recent/Daily `home.growth.log.clear-upgrade` | クリアできた | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Home/Recommendation/Recent/Daily `home.growth.log.fc` | フルコンボを達成 | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Home/Recommendation/Recent/Daily `home.growth.log.df` | ドンダフルコンボを達成 | REPETITIVE | dailyProgress.events.facts；当天归属与 before/after/delta 不变 | Observation（事实或指标标签） | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Goal `home.goal.evaluate` | 進み具合を確認 | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Goal `home.goal.completed` | 今回の目標を達成 | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Goal `home.goal.refreshing` | 状態を更新しています… | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Goal `home.goal.refreshFailed` | 成長データを更新できませんでした。もう一度お試しください。 | SYSTEM-LIKE, MISSING-CONTEXT | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 只描述已知记录；无新记录不等于没游玩，未确认不等于仍在练。 |
| ja Goal `home.goal.retryRefresh` | 再読み込み | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Goal `home.goal.chooseNext` | 次の曲を選ぶ | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Goal `home.goal.inconclusive` | まだ確認できません。成績を更新してからお試しください。 | SYSTEM-LIKE, MISSING-CONTEXT | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 只描述已知记录；无新记录不等于没游玩，未确认不等于仍在练。 |
| ja Goal `home.goal.unchanged` | 引き続き練習中 | SYSTEM-LIKE, MISSING-CONTEXT | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 只描述已知记录；无新记录不等于没游玩，未确认不等于仍在练。 |
| ja Goal `home.goal.completedTypes.score-pb` | 自己ベスト更新 | REPETITIVE | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Goal `home.goal.completedTypes.ng-reduced` | 不可が減った | REPETITIVE | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Goal `home.goal.completedTypes.clear` | クリア達成 | REPETITIVE | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Goal `home.goal.completedTypes.fc` | フルコンボ達成 | REPETITIVE | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Goal `home.goal.completedTypes.df` | ドンダフルコンボ達成 | REPETITIVE | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Goal `home.goal.completedTypes.rank-upgrade` | 評価アップ | REPETITIVE | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Goal `home.goal.title` | 今回練習したい曲 | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Goal `home.goal.choose` | この曲にする | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Goal `home.goal.selected` | 選択中 | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Goal `home.goal.question` | 今回は何を目指す？ | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Goal `home.goal.replaceConfirm` | この曲に変更する？ | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Goal `home.goal.replace` | 別の曲を選ぶ | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Goal `home.goal.cancel` | キャンセル | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Goal `home.goal.confirm` | これにする | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Goal `home.goal.saving` | 保存中… | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Goal `home.goal.baseline` | 選んだとき {value} | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Goal `home.goal.baselineNg` | 選んだときの不可 {value} | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Goal `home.goal.unavailable` | この譜面は現在利用できません | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Goal `home.goal.noOptions` | この曲はまだ選べません | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Goal `home.goal.conflict` | 成績または選択が更新されました。再読み込みしてお試しください。 | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Goal `home.goal.error` | 保存できませんでした。少し待ってからお試しください。 | GOOD | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Invitation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Goal `home.goal.types.score-pb` | 自己ベストを更新する | REPETITIVE | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Goal `home.goal.types.ng-reduced` | 不可をもう少し減らす | REPETITIVE | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Goal `home.goal.types.clear` | まずはクリアを目指す | REPETITIVE | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Goal `home.goal.types.fc` | フルコンボを目指す | REPETITIVE | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Goal `home.goal.types.df` | 全良を目指す | REPETITIVE | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Goal `home.goal.types.rank-upgrade` | スコアランクをひとつ上げる | REPETITIVE | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Goal `home.goal.types.played` | まずは一度プレイする | REPETITIVE | activeGoal / completionEvidence / evaluate.outcome；仅评价确认事实 | Intention / Observation | 保留必要指标名；事实与句子分工；分数不在每张卡重复强调更新。 |
| ja Home existing/fallback `home.personal.eyebrow` | マイ太鼓 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home existing/fallback `home.personal.greeting` | おかえりなさい、{name} | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home existing/fallback `home.personal.rating` | Rating | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home existing/fallback `home.personal.ratingBasis` | 総合 Rating | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home existing/fallback `home.personal.connected` | 成績を接続済み | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home existing/fallback `home.personal.summaryUnavailable` | 個人サマリーを利用できません | GOOD | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home existing/fallback `home.personal.viewScores` | 自分の成績を見る | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home existing/fallback `home.personal.unboundTitle` | 太鼓データをつなぐ | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home existing/fallback `home.personal.unboundBody` | 太鼓アカウントを連携すると、成績とおすすめがここに表示されます。 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home existing/fallback `home.personal.bindCta` | アカウントを連携 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home existing/fallback `home.personal.emptyTitle` | アカウントを接続済み | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home existing/fallback `home.personal.emptyBody` | 成績を同期すると、ここに個人データが表示されます。 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home existing/fallback `home.personal.syncCta` | 成績を同期 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home existing/fallback `home.personal.recommendationEyebrow` | 今日のおすすめ | GOOD | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home existing/fallback `home.personal.recommendationSong` | おすすめ楽曲 | GOOD | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home existing/fallback `home.personal.level` | {level} 星 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home existing/fallback `home.personal.viewSong` | 楽曲を見る | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home existing/fallback `home.personal.recommendationUnavailable` | おすすめを利用できません | GOOD | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home existing/fallback `home.personal.noRecommendation` | おすすめできる楽曲がありません | GOOD | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Home existing/fallback `home.personal.openRecommendationTool` | おすすめツールを開く | GOOD | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.title` | この一週間 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.description` | この一週間に確認できたスコアの変化、成長の記録、次の練習方向を振り返ります。 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.currentWeek` | 今週 · 今日まで | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.completeWeek` | この一週間 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.highlights` | 覚えておきたい変化 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.guestTitle` | ログインして今週を振り返る | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.login` | ログイン | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.loading` | 今週の記録をまとめています | GOOD | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.loadFailed` | この一週間を表示できません | GOOD | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.retry` | 再試行 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.goalCompleted` | 自分で選んだ練習目標を達成 | INCONSISTENT-TERM | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 统一为这次想练/这次练成；避免任务叙事。 |
| ja Weekly `weekly.passportEntry` | 成長の記録を見る | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.theme.stability` | 今週いちばん目立ったのは、より安定したこと | GOOD | weekly.theme.type/confidence；现有 theme 算法，范围受 coverage 约束 | Observation → Meaning（周记录主题） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.theme.score-breakthrough` | 今週は自己ベストの更新が重なりました | TOO-GENERIC | weekly.theme.type/confidence；现有 theme 算法，范围受 coverage 约束 | Observation → Meaning（周记录主题） | 复述已确认变化，不声称比上周更多或笼统突破。 |
| ja Weekly `weekly.theme.new-crown` | 今週いちばん覚えておきたいのは新しい王冠 | GOOD | weekly.theme.type/confidence；现有 theme 算法，范围受 coverage 约束 | Observation → Meaning（周记录主题） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.theme.rank-breakthrough` | 今週はスコアランクに新しい前進がありました | TOO-GENERIC | weekly.theme.type/confidence；现有 theme 算法，范围受 coverage 约束 | Observation → Meaning（周记录主题） | 复述已确认变化，不声称比上周更多或笼统突破。 |
| ja Weekly `weekly.theme.goal-follow-through` | 今週は自分で選んだ練習目標を達成しました | GOOD | weekly.theme.type/confidence；现有 theme 算法，范围受 coverage 约束 | Observation → Meaning（周记录主题） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.theme.mixed-growth` | 今週はいくつもの方向に変化がありました | GOOD | weekly.theme.type/confidence；现有 theme 算法，范围受 coverage 约束 | Observation → Meaning（周记录主题） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.theme.broad-activity` | 今週は幅広い譜面をプレイしました | TOO-GENERIC | weekly.theme.type/confidence；现有 theme 算法，范围受 coverage 约束 | Observation → Meaning（周记录主题） | 复述已确认变化，不声称比上周更多或笼统突破。 |
| ja Weekly `weekly.theme.focus-change` | 今週は注目したい方向が変わりました | GOOD | weekly.theme.type/confidence；现有 theme 算法，范围受 coverage 约束 | Observation → Meaning（周记录主题） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.theme.balanced` | 今週は全体にバランスが取れています | GOOD | weekly.theme.type/confidence；现有 theme 算法，范围受 coverage 约束 | Observation → Meaning（周记录主题） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.theme.quiet` | 今週は譜面に慣れる時間が中心でした | SYSTEM-LIKE, MISSING-CONTEXT | weekly.theme.type/confidence；现有 theme 算法，范围受 coverage 约束 | Observation → Meaning（周记录主题） | 只描述已知记录；无新记录不等于没游玩，未确认不等于仍在练。 |
| ja Weekly `weekly.theme.no-play` | 今週はまだ新しいプレイ記録がありません | GOOD | weekly.theme.type/confidence；现有 theme 算法，范围受 coverage 约束 | Observation → Meaning（周记录主题） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.theme.limited-coverage` | 今週は確認できる記録がまだ十分ではありません | SYSTEM-LIKE, MISSING-CONTEXT | weekly.theme.type/confidence；现有 theme 算法，范围受 coverage 约束 | Observation → Meaning（周记录主题） | 只描述已知记录；无新记录不等于没游玩，未确认不等于仍在练。 |
| ja Weekly `weekly.fact.played` | この譜面をプレイ | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.fact.score-pb` | 自己ベスト | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.fact.ng-reduced` | 不可 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.fact.combo-improved` | コンボ | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.fact.clear` | 初クリア | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.fact.fc` | 新フルコンボ | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.fact.df` | 新ドンダフルコンボ | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.fact.rank-upgrade` | スコアランク | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.coverage.complete` |  | GOOD | coverage / segments；披露保留范围及比较限制 | Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.coverage.partial` | 一部の履歴を利用できないため、確認できた変化だけを表示しています | GOOD | coverage / segments；披露保留范围及比较限制 | Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.coverage.truncated` | 古い記録の一部が残っていないため、確認できた変化だけを表示しています | GOOD | coverage / segments；披露保留范围及比较限制 | Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.coverage.unknown` | 記録の範囲を確認できないため、確認できた変化だけを表示しています | GOOD | coverage / segments；披露保留范围及比较限制 | Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.measurement.title` | 力の変化 | GOOD | measurementChange.compatible/reason/focusFrom/focusTo；不跨版本比较 | Observation / Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.measurement.now` | 週のはじめ → 現在 | GOOD | measurementChange.compatible/reason/focusFrom/focusTo；不跨版本比较 | Observation / Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.measurement.weekEnd` | 週のはじめ → 週末 | GOOD | measurementChange.compatible/reason/focusFrom/focusTo；不跨版本比较 | Observation / Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.measurement.focusChanged` | いま注目したい方向は{from}から{to}へ移りました。 | GOOD | measurementChange.compatible/reason/focusFrom/focusTo；不跨版本比较 | Observation / Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.measurement.focusSame` | いま注目したい方向は引き続き{focus}です。 | GOOD | measurementChange.compatible/reason/focusFrom/focusTo；不跨版本比较 | Observation / Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.measurement.insufficient` | 今週は連続した力の記録がまだ十分ではありません。 | SYSTEM-LIKE, MISSING-CONTEXT | measurementChange.compatible/reason/focusFrom/focusTo；不跨版本比较 | Observation / Secondary disclosure | 只描述已知记录；无新记录不等于没游玩，未确认不等于仍在练。 |
| ja Weekly `weekly.measurement.limited` | 今週のスコア記録だけでは、安定した傾向をまだ判断できません。 | SYSTEM-LIKE, MISSING-CONTEXT | measurementChange.compatible/reason/focusFrom/focusTo；不跨版本比较 | Observation / Secondary disclosure | 只描述已知记录；无新记录不等于没游玩，未确认不等于仍在练。 |
| ja Weekly `weekly.measurement.algorithm-mismatch` | 今週は測定方法が更新されたため、力の推移を直接比較しません。 | OVER-TECHNICAL | measurementChange.compatible/reason/focusFrom/focusTo；不跨版本比较 | Observation / Secondary disclosure | 主句统一为记录方式更新；比较限制放 details。 |
| ja Weekly `weekly.measurement.model-mismatch` | 今週は測定モデルが更新されたため、力の推移を直接比較しません。 | OVER-TECHNICAL | measurementChange.compatible/reason/focusFrom/focusTo；不跨版本比较 | Observation / Secondary disclosure | 主句统一为记录方式更新；比较限制放 details。 |
| ja Weekly `weekly.measurement.measurement-version-mismatch` | 今週は測定バージョンが更新されたため、力の推移を直接比較しません。 | OVER-TECHNICAL | measurementChange.compatible/reason/focusFrom/focusTo；不跨版本比较 | Observation / Secondary disclosure | 主句统一为记录方式更新；比较限制放 details。 |
| ja Weekly `weekly.focus.balanced` | 全体のバランス | GOOD | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.focus.limited` | 記録を増やすこと | GOOD | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.focus.insufficient-data` | 記録を増やすこと | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.next.title` | 次は | GOOD | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Weekly `weekly.next.focus` | 最近は引き続き{focus}から取り組めそうです | SYSTEM-LIKE, TOO-GENERIC | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 用有状态约束的邀请；六维/均衡/记录少分别组句。 |
| ja Passport `passport.title` | 成長の記録 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.description` | スコアや練習で意識したこと、これまでの変化を振り返る。 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.guestTitle` | ログインして成長の記録を見る | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.login` | ログイン | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.loading` | 成長の記録をまとめています | GOOD | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.loadFailed` | 成長の記録を表示できません | GOOD | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.retry` | 再試行 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.currentTitle` | いまの自分 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.recordedSince` | {date} から記録 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.focusLead` | 最近は{focus}から取り組めそうです | SYSTEM-LIKE, TOO-GENERIC | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 用有状态约束的邀请；六维/均衡/记录少分别组句。 |
| ja Passport `passport.skillOverview` | 現在の6つの力 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.limited` | まだ記録が少ないので、もう少し増えると変化が見えてきます。 | GOOD | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.newRecordTitle` | 成長の記録が始まったばかりです | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.newRecord` | スコアが増えるにつれて、ここに力の軌跡が少しずつ現れます。 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.rangeLabel` | 推移の期間 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.latestMilestones` | 最新{count}件 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.recordsRange` | 記録の期間 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.rangeDays` | {days}日 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.rangeActual` | {days}日分の記録 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.dimensionLabel` | 推移する項目 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.current` | 現在 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.weeklyEntry` | 今週を振り返る | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.trend.title` | この期間の変化 | GOOD | 当前可比较 segment 的 points、currentSegmentChange；限定所选维度 | Observation（趋势与实际值） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.trend.noPoints` | この項目にはまだ記録がありません。 | GOOD | 当前可比较 segment 的 points、currentSegmentChange；限定所选维度 | Observation（趋势与实际值） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.trend.onePoint` | {day}に{dimension} {value}を記録しました。 | GOOD | 当前可比较 segment 的 points、currentSegmentChange；限定所选维度 | Observation（趋势与实际值） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.trend.summary` | {dimension}は{fromDay}の{from}から{toDay}の{to}へ。 | GOOD | 当前可比较 segment 的 points、currentSegmentChange；限定所选维度 | Observation（趋势与实际值） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.trend.summaryBreak` | {fromDay}から{toDay}までの{dimension}の記録。 | GOOD | 当前可比较 segment 的 points、currentSegmentChange；限定所选维度 | Observation（趋势与实际值） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.trend.pointLabel` | {day}、{dimension} {value}、注目方向は{focus} | GOOD | 当前可比较 segment 的 points、currentSegmentChange；限定所选维度 | Observation（趋势与实际值） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.change.up` | この間、{dimension}は{from}から{to}に。 | GOOD | 当前可比较 segment 的 points、currentSegmentChange；限定所选维度 | Observation（趋势与实际值） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.change.down` | 最近の記録では、{dimension}は{from}から{to}に。 | GOOD | 当前可比较 segment 的 points、currentSegmentChange；限定所选维度 | Observation（趋势与实际值） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.change.stable` | 最近の記録では、全体のバランスはほぼ変わっていません。 | GOOD | 当前可比较 segment 的 points、currentSegmentChange；限定所选维度 | Observation（趋势与实际值） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.change.insufficient` | 記録はまだ増えている途中。あと何回か同期すると、変化が見えてきます。 | GOOD | 当前可比较 segment 的 points、currentSegmentChange；限定所选维度 | Observation（趋势与实际值） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.change.limited` | まだ記録が少ないので、もう少し増えると変化が見えてきます。 | GOOD | 当前可比较 segment 的 points、currentSegmentChange；限定所选维度 | Observation（趋势与实际值） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.change.stableValue` | 最近の記録では、{dimension}は{value}前後で落ち着いています。 | GOOD | 当前可比较 segment 的 points、currentSegmentChange；限定所选维度 | Observation（趋势与实际值） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.segmentUpdated` | 記録方法が変わりました | GOOD | coverage / segments；披露保留范围及比较限制 | Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.segmentExplanation` | 更新前後の数値は直接比較していません。 | GOOD | coverage / segments；披露保留范围及比较限制 | Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.focusTitle` | 注目方向 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.focus.balanced` | 全体のバランス | GOOD | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.focus.limited` | 記録を増やすこと | GOOD | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.focus.insufficient-data` | 記録を増やすこと | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.milestonesTitle` | 最近の節目 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.recent90` | 最近90日 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.noMilestones` | 最近は確認できる成長の節目がまだありません。 | GOOD | 现有 error/readiness/attendance/coverage 状态；不推断行为 | State / Recovery | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.goalCompleted` | 自分で選んだ練習目標も達成 | INCONSISTENT-TERM | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 统一为这次想练/这次练成；避免任务叙事。 |
| ja Passport `passport.goalObserved` | この練習目標の達成を確認 | INCONSISTENT-TERM | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 统一为这次想练/这次练成；避免任务叙事。 |
| ja Passport `passport.fact.score-pb` | 自己ベスト | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.fact.ng-reduced` | 不可 | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.fact.combo-improved` | コンボ | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.fact.clear` | 初クリア | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.fact.fc` | 新フルコンボ | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.fact.df` | 新ドンダフルコンボ | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.fact.rank-upgrade` | スコアランク | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.fact.goal-completed` | 練習目標を達成 | INCONSISTENT-TERM | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 统一为这次想练/这次练成；避免任务叙事。 |
| ja Passport `passport.coverage.complete` | 最近90日の記録はそろっています。 | GOOD | coverage / segments；披露保留范围及比较限制 | Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.coverage.partial` | 最近の記録には一部欠けがあるため、確認できた節目だけを表示しています。 | GOOD | coverage / segments；披露保留范围及比较限制 | Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.coverage.truncated` | 古い記録の一部が残っていないため、確認できた節目だけを表示しています。 | GOOD | coverage / segments；披露保留范围及比较限制 | Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.coverage.unknown` | 最近の記録範囲を確認できないため、確認できた節目だけを表示しています。 | GOOD | coverage / segments；披露保留范围及比较限制 | Secondary disclosure | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.nextTitle` | 次は | GOOD | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.nextFocus` | 最近は引き続き{focus}から取り組めそうです | SYSTEM-LIKE, TOO-GENERIC | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 用有状态约束的邀请；六维/均衡/记录少分别组句。 |
| ja Passport `passport.activeGoalTitle` | 今回取り組むこと | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.completedGoalTitle` | 最近できたこと | INCONSISTENT-TERM | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 统一为这次想练/这次练成；避免任务叙事。 |
| ja Passport `passport.rangeAll` | すべての記録 | GOOD | 现有路由、选择、记录范围与操作 | Label / Navigation / Control | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.updating` | 記録を更新しています… | GOOD | 现有 DTO 的实际记录、姓名、指标或界面状态 | Observation / Label | 保留；核对 zh/ja 证据强度和占位符。 |
| ja Passport `passport.focusContinuing` | 引き続き、{focus}を意識したいところ。 | SYSTEM-LIKE, TOO-GENERIC | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 用有状态约束的邀请；六维/均衡/记录少分别组句。 |
| ja Passport `passport.focusChanged` | 最近は{focus}に注目。 | GOOD | priorityDimension/readiness/focus/Goal 状态；最低维只支持邀请 | Invitation（方向选择） | 保留；核对 zh/ja 证据强度和占位符。 |

## 实施决策

审计完成后方可实施。表内 GOOD 不是新文案授权，必要状态/控件保留；其余按证据与所在位置修改，不机械替换。无 DB/schema、算法、测量、history/replay 变更。色彩/字体沿用 Viewer 既有暖色与显示字体，改变文字层级和节奏，不新增装饰。首页推荐说明缩成一行观察、推荐标题为邀请；Daily 留歌曲与事实；Weekly/Passport 把记录限制放在需要处。
