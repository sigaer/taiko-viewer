# 推荐结果可操作化与目标衔接

范围：Viewer 普通推荐 → 歌曲/指定谱面 → 显式确认 → 既有 Goal 评估与 Growth。沿用 [跨入口一致性结论](rating-entry-consistency.md) 的 Profile、固定数值与排序基线；没有重新审计计算、修改 Bot/Core/Application、首页或第三方 Developer API。

## 保留与补齐

- 普通推荐仍支持 1–50 和综合/六维选择；图片改为同次提交的可选展示。新站内 `/api/account/recommendation/tool` 在既有 `withPersonalScoreRead` 中调用已安装 wheel 的 `compute_recommendations_for_user` **一次**，原始有序行同时交给既有 Application 投影和原图片 renderer。页面加载不计算，未选择图片不渲染。旧图片及固定数量推荐接口保持兼容。
- 列表保留原数量、分组标记、谱面身份和排序，不重新排序。难度取 `level`，星级取对应目录 `level_4/level_5`，链接使用 `difficulty`；鬼/里的同页导航也响应 query 变化。
- 目标推荐原有数量、浏览、歌曲链接和难度参数继续保留；没有把极/紫雅等精确目标映射成 `rank-upgrade`。本轮不增加精确等级模型。
- 推荐批次、目标推荐请求和确认面板复用 `account-user` / `account-binding-generation`；取消旧请求并检查 generation。账号切换、切回、绑定变化、参数变化及卸载清除旧结果；晚到成功或失败不能恢复旧列表、图片或确认状态。

## 服务端来源与兼容

旧请求和旧数据继续使用 `source='today-plan'`，仍验证 `todayPlan.items`；旧客户端传入来源字段的拒绝行为保留。新请求显式使用 `ordinary-recommendation`，数据库现有 VARCHAR 字段足够，无 schema 迁移。

新增入口必须提供服务端签发的短期推荐凭据，包含所有者、绑定/来源、谱面、basis、原排序位置、成绩版本、曲库/安装构件输入摘要及生成时间。HMAC 防止更改或伪造候选；不是认证凭据，仍要求现有 Web 本人会话。有效期十分钟、进程重启失效，失效后重新生成推荐。没有新增结果缓存或持久凭据系统；当前部署为单 Nitro 进程，多实例共享签名不在本轮范围。

`goal/preview` 只读，返回服务器核实的谱面、可选 GoalType 和活动目标。创建仍由 `writePlayerGoal → mutateGoal` 完成：成绩 lease 先于 SQL owner/binding 锁，重验权限、当前绑定、成绩、目录、实装输入、锁、来源证明、可选类型及 `expectedActiveGoalId`。安装构件身份在 SQL 事务前解析；锁内不启动 Python 计算。客户端不提交基线、完成条件或完成状态。

服务端生成 baseline / targetData / source 元数据；单活动目标约束、同目标重复提交幂等、替换冲突、取消与原有评估保持不变。新入口不支持缺少可靠来源、锁定、下架、缺谱或不可准确评估的目标。**当前 evaluator 要求已有基线成绩，因此未玩候选只提供浏览和谱面导航，不展示尚不能可靠完成的目标按钮。** 既有今日计划规则不改。

用户先查看谱面和类型，再明确确认。其他活动目标显示替换确认和原目标；同谱面的已有目标引导查看。成绩/目录/账号状态变化使旧确认失效并要求刷新；读取、跳转、打开确认框均不创建 Goal。

## 生命周期与验证

新增来源直接进入原 Goal 存储、评估、完成证据及 `loadGoalFacts → projectGoalFact`；未另建完成事件。相同观察、重复评估及无充分证据不会产生第二条完成事实，不重写历史事实或完成时间。

可运行测试：

- `recommendationGoalSql.test.mjs`：真实会话/H3 HTTP、隔离 SQL、已安装 `-I` worker；沿用 48 曲/25 成绩的固定 20 项身份/分组/排序基线，观察图片渲染前的同批次投影；数量/维度、未玩、空候选、下架、签名/来源/权限、锁、两账号与切换、重复提交、并发替换、成绩变化、原评估、事实去重及 worker 失败后的 lease 释放。
- `recommendationGoalNuxt.test.mjs`：全新 Nuxt 构建、真实 HTTP/SQL/安装 wheel、Chromium；中日文 × 1280/375 四组合，普通列表 → 里谱 `difficulty=5` / 10★ → 目标确认/创建 → 发布合成新成绩 → 原评估 → 成长展示，截图落受保护 QA evidence；另验证实际数量、维度和图片选择。
- `recommendationToolIdentity.test.mjs`、`recommendationGoalIdentity.test.mjs`：实际 composable/SFC 的晚到响应、账号/绑定切换、切回、重复点击、卸载和取消。未 mock 被验证的身份保护代码。
- 原 `playerGoalSqlHttp.test.mjs`、GoalType/evidence/HTTP 单测继续运行；旧 SQL fixture 补齐真实 Bot 持有端和已发布手动来源，符合当前 detach/delete 前提，生产权限及清理逻辑未改。

身份、分组、顺序和整数证据精确断言；浮点沿用上一轮 Application 六位舍入规则，无 OCR，无排序消差。外部图像资源/网络可阻断；真实图片另通过安装 renderer 验证。

复验（需要受保护的安装构件 manifest；运行器自行创建空 MySQL）：

```sh
QA_ARTIFACT_MANIFEST=/absolute/protected/rating-entry-manifest.json \
  bash scripts/memory/run_qa.sh /usr/bin/env \
  TAIKO_PYTHON_EXECUTABLE=/absolute/installed/bin/python \
  /absolute/node scripts/readiness/run-isolated-sql.mjs --allow-test-db-mutation \
  taiko_viewer/tests/recommendationGoalSql.test.mjs \
  taiko_viewer/tests/recommendationGoalNuxt.test.mjs \
  taiko_viewer/tests/playerGoalSqlHttp.test.mjs
```

运行前需按现有 memory wrapper 在 `taiko_viewer` 构建 `.output`。SQL runner 证明实际 `SELECT DATABASE()` 为 `_test` 且 datadir 属于本次空实例，再向测试子进程显式传 mutation opt-in；测试结束检查数据库、HTTP listener、浏览器和子进程退出。没有复制生产成绩或在生产创建目标/修改绑定。

## 版本与发布

实际 main 为 0.85.1 后选择 **0.86.0**：新增普通推荐交互和兼容 Goal 来源，属于下一个 minor；不是路线图进度编号。只发布 Viewer。Bot 0.16.2 / Application 0.8.1 / Core 0.1.1 安装构件继续复用。OpenAPI 仅同步应用文档版本，第三方字段、排序、参数及权限不变。称号关系数据已核对实际 main，关系、统计和索引相同，无额外业务数据变更。

发布使用现有 PR/CI 及 `run_build.sh → deploy_forum_web.sh "<HEAD subject>"`；实际部署、回滚输出与只读线上验收结果记录在 PR 和本轮交付中。生产验收不 POST 目标，也不通过登录、成绩或绑定写入制造测试条件。
