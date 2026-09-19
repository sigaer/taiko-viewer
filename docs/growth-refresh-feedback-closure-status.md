# Growth Refresh / Feedback Closure — 实施与验收

任务规格：`Sakura_Taiko_Viewer_0.69.2_Growth_Refresh_Feedback_Closure.md`。

实施起点：`04ee9fe`，canonical version 已为 **0.69.2**（邀请码错误提示修正）。本次发布版本 **0.69.3**，不复用既有版本。

## 实现

- `AuthenticatedHome` 将 `usePlayerGrowth.refresh(identity)` 接入 Goal Surface。每个成功的 evaluate（completed / active / inconclusive）调用一次；不扩展 POST DTO，不在 POST 中计算 Growth。
- Overview GET 显式 `retry: 0`，避免 `$fetch` 在 503 等错误后暗中多发 GET。失败后的重试由用户显式触发。
- 初次读取使用 skeleton；刷新保留已有 UI，成功后整体替换 Overview，包括 Goal、scoreRevision、六维、focus、Today Plan、Daily Progress。
- POST 与 GET 分别检查身份和 generation；同步身份失效覆盖 A→B→A。组件卸载使旧响应失效。
- 刷新失败保留 POST 的临时完成状态；候选目标和“再选一首”均禁用，提供重新刷新。成功后以 fresh Overview 收敛。
- `composeGrowthFeedback` 仅做展示层事实去重。同 song / difficulty / fact type / before / after 才合并。冠次数先根据真实 baseline 和 completion evidence 转为冠等级；缺证据不补零。Clear→FC、FC→DF 显示实际更高冠。其他事实保留，Daily DTO 不修改。
- 没有 schema / migration、Goal 判定、Daily extraction、推荐排序、六维算法变更；不强制轮换 focus 或推荐。

## Gate 记录（全部通过）

- 原有 Goal / Daily / 历史回放加新增 composable / fact 测试：97 PASS。
- 最终真实 Surface setup、locale、version、首页状态与刷新测试：27 PASS；定向 TypeScript 检查 PASS。
- 真实 SQL / authenticated lifecycle：3 PASS；隔离库 `taiko_annual_poster_test`，显式 mutation opt-in；正式 helper cleanup，orphan=0。新增断言 POST 不 compute、随后一次 GET 只 compute 一次。
- 首次预发布快照因缺少外部 Annual schema，在 Nuxt 编译前停止；按标准部署的依赖布局复制 schema 后标准 build PASS。未改生成器或绕过检查。
- 首次浏览器故障注入捕获 `$fetch` 隐式重试（多一次 GET）；显式禁用后重新标准 build PASS。
- Browser matrix：48 PASS（6 types × zh/ja × mobile/desktop × light/dark）。每组覆盖 active/inconclusive 刷新、completed 后刷新失败与重试、R2 无 reload 下一 Goal、A/B 隔离、同事实去重与额外事实保留。峰值 752,320,512 bytes，OOM/oom_kill=0；3197 listener 已退出。
- 原推荐算法回归：54 PASS。使用已有系统 Python/pytest；业务虚拟环境不含 pytest，未安装或修改依赖。
- Production no-reload smoke、性能、正式 lifecycle 清理、orphan、health：全部 PASS。

证据目录：`/var/tmp/growth-refresh/`。

## 生产发布与验收

- 发布提交：`41830df` — `0.69.3 打通目标确认后的成长刷新与下一目标闭环`。
- 标准路径：`bash scripts/memory/run_build.sh /bin/bash scripts/deploy_forum_web.sh '0.69.3 打通目标确认后的成长刷新与下一目标闭环'`，exit 0；脚本推送 `origin/main`。没有修改 guard 或部署脚本。
- 构建前 MemAvailable=14,257,248 KiB，required=13,266,778 KiB；SwapTotal=25,165,820 KiB，SwapFree=14,003,104 KiB；主要进程记录在 `release-memory.json`，未清理无关进程。
- `taiko-viewer` / `taiko-sync-receiver` active；`/`、`/more` 200；未登录 Growth Overview 401；隔离账号的 authenticated Growth Overview 200。`/more` canonical UI **0.69.3**，无 JS / hydration 错误。
- 完整链路：Overview R1 → 真实 Today Plan 创建 → synthetic authoritative source R2 → evaluate → 单次 Overview R2 → **不导航、不 reload、不重新登录，直接下一 Goal 创建成功**。下一 Goal baseline revision 等于 R2 文件 SHA-256。
- fresh skills、focus、Today Plan、Daily presentation 均与返回的 R2 Overview 对齐；最终 Goal 也来自 fresh Overview。
- 一次确认实测：**1 evaluation POST + 1 Overview GET + 1 Growth Python process**。POST 234 ms，后续 Overview TTFB 640 ms / total 641 ms，确认至 fresh UI 1,025 ms。Python 进程按该隔离 profile 每 50 ms 采样，另有 SQL service instrumentation 和未改动的服务端单入口作为交叉证据。
- 两次 Goal 创建含 UI 操作耗时 1,013 / 964 ms；cancel 28 ms。无额外 Goal GET；响应 `Cache-Control: private, no-store`、`Vary: Cookie`；页面不含 session raw key。
- Profile A→B→A 不串 Goal；下一 Goal 经 reload / logout-login 仍保留；旧 Goal evaluation 返回 409；取消后 reload 无 active Goal。
- 清理前保留 completed history=1、cancelled history=1；经 `deleteUserWithGoals` 清理后 users / bindings / sessions / goals 全为 0，synthetic userdata 和临时 auth 文件残留为 0；user orphan / binding orphan / owner mismatch 全为 0。
- 新建 QA/build 单元已退出，3197 listener=0。未执行 schema migration。
- Daily 精确去重和额外事实保留由 48 组真实 UI + 纯函数测试验证；生产完成卡标题为“这次练成了”，没有把 Goal 的 causal evidence 改写成“今天完成”。
- 可选百度 sitemap 推送返回当日 quota exhausted；标准部署正常 exit 0，不影响 Viewer / Goal Gate。

主要产物：`build.log`、`deploy.log`、`browser-results.json`、`browser-resources.json`、`final-tests.log`、`sql.log`、`recommendation.log`、`production-evaluation.json`、`production-lifecycle.json`、`health-final.json`。

## 规格要求的 27 项结论

| # | 问题 | 结论 |
|---|---|---|
| 1 | 开始 / 最终版本 | 0.69.2 / 0.69.3；0.69.2 已被既有发布使用。 |
| 2 | evaluate 后一次 Overview | 是；统一 refresh，关闭 GET 隐式 retry。 |
| 3 | active / inconclusive | 每次成功 2xx 均刷新一次。 |
| 4 | POST revision 字段 | 未扩展；POST DTO 保持 Goal Evaluation contract。 |
| 5 | refresh 接入 | AuthenticatedHome 将 usePlayerGrowth.refresh(identity) 传给 Surface。 |
| 6 | 保留旧 UI | 是；仅初次读取 skeleton，刷新失败也保留原数据。 |
| 7 | profile guard | POST mutation generation + identity；GET request generation + identity；同步失效覆盖 A→B→A，卸载失效。 |
| 8 | scoreRevision | fresh Overview 整体替换，下一创建冻结 R2。 |
| 9 | Player State | fresh Overview 整体替换，服务端新 Python compute。 |
| 10 | focus | 来自 fresh Player State；允许保持原值。 |
| 11 | Today Plan | 来自 fresh Overview；允许改变或不变。 |
| 12 | Daily Progress | 来自 fresh Overview，再做独立展示 composition。 |
| 13 | 无 reload 下一 Goal | LOCAL / PRODUCTION PASS；下一 Goal baseline=R2。 |
| 14 | stale-plan | 已消除本页保留 baseline-era revision 导致的稳定冲突；新的并发同步仍由服务端 409 保护。 |
| 15 | 推荐排序 | 未改变。 |
| 16 | 强制 rotate focus | 没有。 |
| 17 | Daily extractor | 未改变；历史回放通过。 |
| 18 | 去重 | 同 song / difficulty / type / before / after；不修改 raw DTO。 |
| 19 | higher crown | 从真实 evidence 取更高冠，与 baseline 冠等级比较；证据不足不推测。 |
| 20 | 其他 Daily facts | 保留；矩阵中更高冠去重后仍显示同谱面的 combo 进展。 |
| 21 | Browser matrix | 48 PASS；六种类型 × 中日文 × 移动桌面 × 明暗主题。 |
| 22 | 生产无 reload | PASS；1 POST → 1 GET → R2 → 下一 Goal，无 reload。 |
| 23 | 确认至 fresh UI 延迟 | 1,025 ms；POST 234 ms，Overview TTFB / total 640 / 641 ms。 |
| 24 | Python 次数 | SQL instrumentation：POST 0 + GET 1；生产真实 Python 进程采样为 1。 |
| 25 | cleanup / orphan | 测试库、生产清理均 PASS；所有临时数据和 orphan=0。 |
| 26 | 0.69.0 / 1 回归 | Goal / Daily / replay 97 PASS，最终前端与首页 27 PASS，真实 SQL 3 PASS，推荐 54 PASS；并非去重后的测试总数。 |
| 27 | 可正式关闭 | 是；全部 Gate PASS。 |

## 完成状态

以下 0.69.2 为规格里程碑名称，实际部署版本为 **0.69.3**。

```text
0.69.2 GROWTH FEEDBACK LOOP CLOSURE COMPLETE
EVALUATION → FRESH GROWTH OVERVIEW ESTABLISHED
CURRENT SCORE REVISION PROPAGATED TO HOME
PLAYER STATE REFRESHED FROM AUTHORITATIVE SCORE
TODAY PLAN REFRESHED AFTER EVALUATION
NO-RELOAD NEXT GOAL FLOW ACCEPTED
PROFILE-SAFE GROWTH REFRESH ACCEPTED
GOAL / DAILY PRESENTATION DEDUP ACCEPTED
DAILY PROGRESS EXTRACTION UNCHANGED
RECOMMENDATION RANKING UNCHANGED
0.69.x GOAL FEEDBACK LOOP COMPLETE
```
