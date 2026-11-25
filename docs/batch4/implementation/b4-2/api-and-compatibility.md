# API and Compatibility

所有端点使用现有 requireAccountUser、当前 Binding 与 owner 范围，严格 body/query allowlist。响应（包括错误）使用 `Cache-Control: private, no-store`、`Vary: Cookie`。协商成长旧读的两个端点还在 Vary 中包含协议请求头。

| 方法与路径 | 契约 |
| --- | --- |
| GET /api/account/growth/goal-portfolio | schemaVersion=2、profileId、portfolioRevision、当前所有非终态 + 一页历史、capabilities、snapshotRevision、pagination |
| POST /api/account/growth/goal-portfolio/commands | profileId、expectedPortfolioRevision、commandId、operations |
| POST /api/account/growth/goal-portfolio/evaluate | profileId、expectedPortfolioRevision、commandId、可选 goalIds、explicitPausedEvaluation |
| GET /api/account/growth/goal-portfolio/options | profileId/songId/difficultyType；只读生成当前合法手动目标选项，不签发推荐 token |

命令返回 newPortfolioRevision、affectedGoals、createdGoals、updatedGoals、existingGoalIds、diagnostics、replayed。Reorder 还带 expectedGoalRevisions 映射。创建手动目标的 target 必须显式提供且与所注册 evaluator 的当前 Baseline 规则一致；baselineRef 在服务端绑定，不信任客户端来源或证据。

错误：401 认证、403 权限、409 revision/身份/command 冲突、422 未支持类型/非法目标/数量上限、503 Schema 缺失/迁移中/不兼容。无权限不泄露其他 owner 的 revision。

未迁移 V1 保留原 writer。V2 的旧 goal.post/delete、preview、evaluate、evaluate-current 在 HTTP 和服务边界拒绝 409 `goal-portfolio-upgrade-required`，不接受 V1 CAS/token。旧读仅当全部非终态最多一个、无 paused、类型/target/来源/availability 能无损表示时投影，并在返回 Goal 上标 legacyProjection=true；否则升级错误，不任意挑 Goal。unknown availability 和新 manual origin 无法无损塞入旧协议，因此也拒绝。

成长 overview/passport 通过 `X-Goal-Portfolio-Schema: 2` 显式协商 V2；新版 useViewerApiFetch 为这两个端点设置请求头。未声明 V2 的旧客户端必须先通过无损 projection，否则 409，不能把 activeGoal=null 当作多目标的完整视图。

新版 growth overview 明确 goalPortfolioVersion=2，旧 activeGoal/recentCompletedGoal 不再代表 V2 状态；首页通过新 Portfolio API 获取完整集合。其他仍采用旧单目标协议的消费者收到升级保护。无双写。
