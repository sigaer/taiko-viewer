# Daily Progress 历史重放验收闭环

日期：2026-09-18。功能阶段：0.68.9；执行基线：main bb84aec / Viewer 0.68.11。

本轮仅修改 fixture、验收脚本、测试入口与文档；生产 runtime 不变，版本保持 0.68.11，无须重新发布。自然发生的真实改善是 OPTIONAL OBSERVATION，不再作为阻塞项。

## 方法与边界

- Fixture 为 synthetic authoritative-format 输入。仓库没有可直接复用的脱敏历史 fixture；为确定性覆盖所有边界，本轮构造完整 chart records 与 `_meta.full` / `_meta.ts` full/delta 文件，不复制生产用户资料。真实历史解析另外由生产 smoke 覆盖。
- `tests/fixtures/growthReplayHarness.mjs` 在 `/var/tmp` 创建独立文件目录，测试模块依赖注入 binding、当前数据路径、catalog 和既有 Python compute 边界，直接执行生产 `getPlayerGrowthOverview` 源码。真实 loadHistory → deriveDailyProgress → Growth Overview 均不 mock。
- Python compute 的推荐结果在该局部测试中固定；推荐算法另外运行既有 Python 回归。测试不声称 fixture 跑了真实 Python 计算。
- 冻结时钟仅在测试模块作用域：2026-09-17T15:00:00+08:00；业务日仍使用生产 Asia/Shanghai 实现。不改系统时间、不添加 debug/test API、不连接数据库。
- 每个重放断言一次 history load、一次 replay、一次 compute 调用、一次 current load、一次 catalog load。
- 浏览器从真实本地 Viewer 的 About 经首页链接进入 Home；丢弃匿名 SSR auth 缓存后，由真实 Home resolver 请求 authenticated fixture 的 auth/binding/scores，再触发实际 Growth service 重放。没有最终 Daily DTO 或 Home resolver DTO mock。
- 同曲也进入 Today Plan，确认页面不声称推荐因果；首次游玩、accuracy、Rating 与六维变化均不输出。

## Layer A — Historical Replay

17/17 PASS。完整输入与期望保存在 `taiko_viewer/tests/fixtures/dailyProgressReplay.mjs`；机器报告：`/var/tmp/growth-closure/replay.json`。每条 chart 保留 high_score、good_cnt、ok_cnt、ng_cnt、combo_cnt、三个 crown counter、best_score_rank、highscore_datetime、update_datetime。

| Fixture | Input snapshots（F=full，D=delta；时间为 _meta.ts） | Expected event | Actual event | Result |
| --- | --- | --- | --- | --- |
| no-play | F @ 2026-09-17 00:00:00 / 1 chart(s)<br>D @ 2026-09-17 12:01:00 / 1 chart(s) | not_played; charts=0 | not_played; charts=0 | PASS |
| ordinary | F @ 2026-09-17 00:00:00 / 1 chart(s)<br>D @ 2026-09-17 12:01:00 / 1 chart(s) | played; charts=1 | played; charts=1 | PASS |
| pb | F @ 2026-09-17 00:00:00 / 1 chart(s)<br>D @ 2026-09-17 12:01:00 / 1 chart(s) | score-pb 900000 → 907130 (Δ7130); charts=1 | score-pb 900000 → 907130 (Δ7130); charts=1 | PASS |
| old-pb-restore | F @ 2026-09-16 18:01:00 / 1 chart(s)<br>D @ 2026-09-17 00:00:00 / 1 chart(s)<br>D @ 2026-09-17 12:01:00 / 1 chart(s) | played; charts=1 | played; charts=1 | PASS |
| improvement | F @ 2026-09-17 00:00:00 / 1 chart(s)<br>D @ 2026-09-17 12:01:00 / 1 chart(s) | ng-reduced 8 → 4 (Δ-4); charts=1 | ng-reduced 8 → 4 (Δ-4); charts=1 | PASS |
| combo | F @ 2026-09-17 00:00:00 / 1 chart(s)<br>D @ 2026-09-17 12:01:00 / 1 chart(s) | combo-improved 60 → 80 (Δ20); charts=1 | combo-improved 60 → 80 (Δ20); charts=1 | PASS |
| clear | F @ 2026-09-17 00:00:00 / 1 chart(s)<br>D @ 2026-09-17 12:01:00 / 1 chart(s) | clear-upgrade -1 → 0 (Δ1); charts=1 | clear-upgrade -1 → 0 (Δ1); charts=1 | PASS |
| crown | F @ 2026-09-17 00:00:00 / 1 chart(s)<br>D @ 2026-09-17 12:01:00 / 1 chart(s) | fc 0 → 1 (Δ1); charts=1 | fc 0 → 1 (Δ1); charts=1 | PASS |
| df | F @ 2026-09-17 00:00:00 / 1 chart(s)<br>D @ 2026-09-17 12:01:00 / 1 chart(s) | df 1 → 2 (Δ1); charts=1 | df 1 → 2 (Δ1); charts=1 | PASS |
| rank | F @ 2026-09-17 00:00:00 / 1 chart(s)<br>D @ 2026-09-17 12:01:00 / 1 chart(s) | rank-upgrade 6 → 7 (Δ1); charts=1 | rank-upgrade 6 → 7 (Δ1); charts=1 | PASS |
| merged | F @ 2026-09-17 00:00:00 / 1 chart(s)<br>D @ 2026-09-17 12:01:00 / 1 chart(s) | fc -1 → 1 (Δ2), score-pb 900000 → 907130 (Δ7130), ng-reduced 8 → 0 (Δ-8); charts=1 | fc -1 → 1 (Δ2), score-pb 900000 → 907130 (Δ7130), ng-reduced 8 → 0 (Δ-8); charts=1 | PASS |
| multiple | F @ 2026-09-17 00:00:00 / 2 chart(s)<br>D @ 2026-09-17 12:01:00 / 2 chart(s) | played; played; charts=2 | played; played; charts=2 | PASS |
| duplicate | F @ 2026-09-17 00:00:00 / 1 chart(s)<br>D @ 2026-09-17 12:01:00 / 1 chart(s)<br>D @ 2026-09-17 12:02:00 / 1 chart(s) | score-pb 900000 → 907130 (Δ7130); charts=1 | score-pb 900000 → 907130 (Δ7130); charts=1 | PASS |
| midnight | F @ 2026-09-17 00:00:00 / 1 chart(s)<br>D @ 2026-09-17 12:01:00 / 1 chart(s) | score-pb 900000 → 907130 (Δ7130); charts=1 | score-pb 900000 → 907130 (Δ7130); charts=1 | PASS |
| missing-before | F @ 2026-09-17 00:00:00 / 0 chart(s)<br>D @ 2026-09-17 12:01:00 / 1 chart(s) | played; charts=1 | played; charts=1 | PASS |
| truncated | D @ 2026-09-17 12:01:00 / 1 chart(s) | played; charts=1 | played; charts=1 | PASS |
| crown-midnight | F @ 2026-09-16 18:01:00 / 1 chart(s)<br>D @ 2026-09-17 12:01:00 / 1 chart(s) | played; charts=1 | played; charts=1 | PASS |

午夜 fixture 的 before 为 2026-09-16T15:59Z（上海 23:59），after 为 16:01Z（上海次日 00:01）。Crown midnight fixture 缺少当天基线观测，因此只输出 played。Old PB restore 从历史最高 990000 回落到 900000，再恢复到 950000，不能算今日 PB。

## Layer B — Browser Matrix

64/64 PASS：8 场景 × zh/ja × light/dark × 390×844/1440×900。下表每格包含明、暗两个主题。

| 场景 | zh mobile | zh desktop | ja mobile | ja desktop |
| --- | --- | --- | --- | --- |
| Ready improvement（NG 8 → 4） | light PASS / dark PASS | light PASS / dark PASS | light PASS / dark PASS | light PASS / dark PASS |
| Ready PB（900000 → 907130，+7130） | light PASS / dark PASS | light PASS / dark PASS | light PASS / dark PASS | light PASS / dark PASS |
| Ready crown（Clear → FC） | light PASS / dark PASS | light PASS / dark PASS | light PASS / dark PASS | light PASS / dark PASS |
| Played / no improvement | light PASS / dark PASS | light PASS / dark PASS | light PASS / dark PASS | light PASS / dark PASS |
| No play | light PASS / dark PASS | light PASS / dark PASS | light PASS / dark PASS | light PASS / dark PASS |
| Balanced | light PASS / dark PASS | light PASS / dark PASS | light PASS / dark PASS | light PASS / dark PASS |
| Limited | light PASS / dark PASS | light PASS / dark PASS | light PASS / dark PASS | light PASS / dark PASS |
| Same-song PB + NG + FC | light PASS / dark PASS | light PASS / dark PASS | light PASS / dark PASS | light PASS / dark PASS |

验证：真实 Home 状态解析、实际 Growth 请求触发磁盘重放、歌曲名称、Daily 难度标签、Today Plan 难度与 9 星、PB before/after/delta、NG before/after、同谱单事件合并、无固定 KPI Grid、无无意义 0 指标、非命令式 Hero/Plan、无推荐因果宣称、无 raw key、无页面或 Growth 横向溢出、无 JS/hydration 错误。NG 8 → 0 属于有效事实，不视为无意义 0。

Daily 事件现有展示为歌曲名与难度；星级检查针对 Today Plan 的既有星级展示。本轮未新增 UI 字段。

截图已人工抽查中文移动端浅色、日文桌面同谱合并、日文移动端深色。64 张截图和逐组合结果位于 `/var/tmp/growth-closure`，机器报告为 `browser.json`。

## Layer C — Production Authenticated Smoke

PASS。真实已有授权 session，生产只读 GET，无等待自然改善。最终请求时间：2026-09-18T11:10:38.804Z。

| 项目 | 实测 |
| --- | --- |
| authenticated Growth HTTP | 200 |
| Cache-Control | `private, no-store` |
| TTFB | 1592 ms |
| total | 1595 ms（浏览器 request start 至 response end） |
| browser Growth visible | 2686 ms（Home 导航开始至 Growth focus 可见） |
| Home | authenticated_ready，正常 render |
| Daily Progress 实际状态 | not_played，显示“今天还没开打”，0 events |
| console error | JS / 应用错误 0；封面缩略图资源 404 一条，见下 |
| raw key | 无 |
| hydration error | 无 |
| Growth 破图 | 0 |

非阻塞资源观察：`/cover/thumb/200/214.webp` 返回 404；既有 SongCoverImage fallback 正常，Growth 图片 complete 且 naturalWidth > 0。该项没有被当成“零 console error”掩盖。验收器只允许已经通过破图检查的这类封面 thumbnail 404；其他 console/resource 错误仍失败。该静态资源问题不属于 Daily replay 的 JS 或历史解析错误。

本轮未改生产 runtime；一次 history load / replay / compute 的结构通过调用计数确认。多次只读 smoke 的 TTFB 为约 1.55–1.91 s，最终 1.592 s，Growth 可见约 2.56–2.91 s。没有同会话 0.68.9 的历史性能基准，因此不声称测得跨版本速度提升；当前 runtime 无新增计算路径或明确可见的性能退化。

机器报告：`production.json`；截图：`production.png` / `production-growth.png`。这些私有 artifacts 未纳入 Git。

## 回归与构建

- Daily Progress / Growth / historical replay / Home state / Home presentation / i18n / version：69/69 PASS。
- Python target recommendation / recommendation intelligence：54/54 PASS。
- 隔离 `npm run build`：PASS（0.68.11）。首次隔离副本缺少外部 schema，补齐目录布局；随后 Node 默认约 2 GiB 堆在 Nitro 阶段耗尽，重试使用部署脚本既有的 `--max-old-space-size=4096`，保持构建 cgroup High 4 GiB / Max 5 GiB。
- 最终 QA runner exit 0；browser 耗时 137.64 s，250 ms 采样内存峰值 649.5 MiB；production 耗时 3.74 s，采样峰值 319.4 MiB。两者 memory.events 的 high/max/oom/oom_kill 均为 0。cgroup 与进程 VmHWM 已写入 `browser-resources.json` / `production-resources.json`；采样峰值不是保证捕获亚毫秒峰值的 kernel peak。
- 最终本次 QA cgroup 已退出，127.0.0.1:3198 无监听；Chromium/context/server 均由 finally 和所属 cgroup 回收。`git diff --check` PASS。
- 所有 QA 通过 `scripts/memory/run_qa.sh`，构建通过 `run_build.sh`，共享维护锁，未重叠执行。临时数据与截图均在磁盘目录 `/var/tmp/growth-closure`。

## 重跑入口

在仓库根目录，通过受限 runner 调用 Node；Node 路径以本机 `command -v node` 为准。

```bash
bash scripts/memory/run_qa.sh "$(command -v node)" --experimental-strip-types --test taiko_viewer/tests/dailyProgress.test.ts taiko_viewer/tests/playerGrowth.test.ts taiko_viewer/tests/dailyProgressReplay.test.mjs
bash scripts/memory/run_qa.sh "$(command -v node)" --experimental-strip-types taiko_viewer/scripts/verify_growth_closure.mjs
bash scripts/memory/run_qa.sh /usr/bin/env GROWTH_AUTH_FILE=/private/authorized-session.json "$(command -v node)" --experimental-strip-types taiko_viewer/scripts/verify_growth_closure.mjs --production
```

浏览器脚本要求先在 `/var/tmp/growth-closure/viewer` 准备本地隔离生产构建（也可通过 `GROWTH_ARTIFACTS` 指定 artifact 根目录）。它只绑定 127.0.0.1:3198；finally 关闭 context/browser/本次创建的 server，超时由 cgroup 回收。生产 auth 文件使用现有授权会话 `{ "owner": "..." }`，内容不进入 Git、报告或命令行。

## 最终状态

A + B + C = PASS。D = OPTIONAL OBSERVATION，未等待、也未伪造真实用户当天改善。具备进入 Goal Feedback Loop 的验收条件，本轮不实施下一阶段。

```text
0.68.9 DAILY PROGRESS NARRATIVE CLOSURE COMPLETE
AUTHORITATIVE HISTORY REPLAY ACCEPTED
PROVABLE GROWTH EVENTS ACCEPTED
REAL BROWSER FIXTURE ACCEPTED
PRODUCTION AUTHENTICATED SMOKE PASSED
PLAYER HOME DAILY FEEDBACK ACCEPTED
NATURAL REAL-USER IMPROVEMENT NO LONGER A CLOSURE BLOCKER
READY FOR GOAL FEEDBACK LOOP
```
