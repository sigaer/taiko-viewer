# 0.81.4 到 0.81.10 变更影响审查

Range：`4465943..8d70df2`，50文件，4391 additions / 138 deletions。2026-10-10只读git diff及源码审查。SOURCE E1 HIGH；运行效果依已存实验，不自动升级为E3。

## 版本链

| Commit | 内容 | Gate影响 |
|---|---|---|
| 4465943 | 0.81.4基线 | 旧验收起点 |
| 4a4e110 | 0.81.5旧Safari Ogg加载 | G0/G3：播放器兼容 |
| da02feb | 0.81.6 iPhone全屏 | G0：真机与交互 |
| 4953d3f | 0.81.7每日能力历史、DF、精彩时刻 | G0/G1/G2/G3/G4：数据与展示语义 |
| 9438bcd | 0.81.8本地软件解码 | G0/G3：音频失败降级、资源 |
| a5aaf45 | 0.81.9 WASM持久缓存 | G0/G3/G4：缓存升级、离线/失败 |
| 195e819 | Passport历史成本探针与opt-in草案 | 证据/实验，不等于最终生产行为 |
| 70d03a2 | systemd QA CI | 隔离工作流 |
| c8bfcb9 | offline fs adapter修正 | 测试适配器 |
| 5f5675c | 123项回归与42样本记录 | 历史证据，不是最终182项同一批次 |
| 8d70df2 | 0.81.10读取/回放优化、文件变化校验 | G1/G3：请求内复用与失效重读 |

## 语义与数据影响

| 项目 | 0.81.4→0.81.10 | 单独0.81.10相对0.81.9 |
|---|---|---|
| history replay | 新增严格最高分DF事实判定；回放实现优化 | 串行语义前提下8文件预读、日期memo、按日索引、请求内证据复用；不是减少范围 |
| measurement查询/来源 | 新daily archive读取并与SQL代表合并；coverage加上archive | 没有新增查询设计，复用变化在score evidence路径 |
| measurement writer | 修改INSERT保护：同scoreRevision不能因算法另写；旧日已有记录拒绝替换；存在archive时Overview跳过写 | 无独立新增writer协议 |
| userdata结构 | 当前C/H格式未在本仓库重构；新增依赖外部daily-ability-v1-top20.json | 没有更改C/H格式，不代表外部数据源无变化 |
| DTO | types无变更不等于内容无变更；新增日点/coverage、DF facts、精选顺序可能变化 | 7类匿名样本相对0.81.9完整DTO hash相同，不证明所有并发输入 |
| milestone composer | 0.81.7类型满3后给其他合格A/B机会，可跨tier/band；不同于0.81.4仅同质量带多样性 | 没有再改composer |
| trend semantics | 仍画冻结存档记录、真实日期连线；来源新增archive且旧日保护更强；不能解释成同公式净增长 | 没有再改趋势语义 |
| 90天facts | passportHistoryRange固定90；180/365仍仅measurement，事实边界未扩展 | 保持 |
| P1a/P1b | 日存档扩大必须保护的来源；0.81.10明确元数据校验非写事务 | 不解决源提交Gate，不构成DB canonical迁移 |

回答：**整个区间包含数据语义修正，不是纯性能优化。单独0.81.10是以保持0.81.9语义为目标的性能优化，有指定样本DTO parity与变更检测证据；不能因此宣称跨writer事务安全。**

当前版本报告记载0.81.7这些变化来自后续用户决策；本轮不改回旧规则。但1.0任务书“多样性仅同级质量带”的历史描述已落后，FEATURE-01/R4需要以实际新版合同确认，不能同时宣布两个互斥规则都通过。

## 性能调用数与切换

当前源码Overview一次runGrowthPythonJson；独立Python实际内部行为未重测。健康稳定历史装载/normalization从2次降1次；Daily/range投影仍两次，不能继续笼统写“1 replay”而不定义计数器。同步变化/坏文件会重新装载。

Passport仍两项measurement SELECT（代表+coverage），History不再查measurement的设置保留；整个请求还有认证、binding、Goal和可选measurement写入，不可称总SQL=2。0.81.7新增两处archive读取，对写入分支有影响。

四档切换：useAsyncData watch只含user/binding，range走selectPassportPeriod，源码支持0 extra请求/Python/replay。0.81.7报告浏览器56/56，0.81.10报告182相关回归与四档DTO；**本轮未获得0.81.10正式构建浏览器/线上计数的新证据**，只能标E1确认+部分历史E2复用。错误状态点同档重试可主动refresh，不属于成功切换零请求合同。

初载真实耗时UNKNOWN；离线中位数不能替代SQL/Python/SSR/网络。完整账本见[性能报告](05-performance-capacity.md)。

## 0.81.4 证据复用 PARTIAL

- 可复用设计与未改源码依据：四档本地选择、90天事实限制、基本绑定guard、Goal确认时间与事实日区分；仍须查实际部署与回归。
- 不能直接继承：0.81.4 milestones排序/DF事实/measurement写入与来源验收，因为0.81.7改变了对应合同；改用新版本测试记录并补边界。
- 不可移植数字：0.81.4单次线上延迟/compute与replay日志、235项总数、56正式构建场景不能标成0.81.10本轮PASS。
- 0.81.10最终182项报告、42样本及四个源hash可追踪，但本轮未重跑；0.81.9冻结fixture是该parity基线。
- title_song_relations.json diff只有generated_at；没有关系或索引业务变化。未重写该文件。

## 完整变更文件列表

下方路径由只读`git diff --name-only 4465943..8d70df2`列出；包括测试/报告，不能将50个文件全视为业务变更。

- `.github/workflows/passport-request-audit.yml`
- `docs/growth-passport-request-evidence-audit.md`
- `docs/growth-passport-request-evidence-results.json`
- `docs/growth-passport-request-performance-08110.json`
- `docs/growth-passport-request-performance-08110.md`
- `docs/passport-final-ux-audit.md`
- `taiko_viewer/assets/data/title_song_relations.json`
- `taiko_viewer/docs/ourtaikoview-practice.md`
- `taiko_viewer/package-lock.json`
- `taiko_viewer/package.json`
- `taiko_viewer/pages/my/growth.vue`
- `taiko_viewer/pages/ourtaikoview/[id]/[difficulty].vue`
- `taiko_viewer/public/practice-player/index.html`
- `taiko_viewer/public/practice-player/release.json`
- `taiko_viewer/scripts/benchmark_passport_final_ux.mjs`
- `taiko_viewer/scripts/performance/benchmark-growth-request.mjs`
- `taiko_viewer/scripts/performance/growth-benchmark-worker.mjs`
- `taiko_viewer/scripts/performance/growth-module-loader.mjs`
- `taiko_viewer/scripts/practice_player_dev.mjs`
- `taiko_viewer/scripts/sync_practice_player.mjs`
- `taiko_viewer/scripts/verify_passport_final_ux_browser.mjs`
- `taiko_viewer/scripts/verify_practice_audio_decode.mjs`
- `taiko_viewer/scripts/verify_practice_player.mjs`
- `taiko_viewer/server/api/content/songs/[id]/tja-package.get.ts`
- `taiko_viewer/server/services/account/growth.ts`
- `taiko_viewer/server/services/growth-history/daily-archive.ts`
- `taiko_viewer/server/services/growth-history/evidence.ts`
- `taiko_viewer/server/services/growth-history/measurements.ts`
- `taiko_viewer/server/services/growth-history/service.ts`
- `taiko_viewer/server/services/growth-passport/milestones.ts`
- `taiko_viewer/server/services/growth-passport/service.ts`
- `taiko_viewer/server/services/practice-player/release.mjs`
- `taiko_viewer/server/utils/practiceAudio.ts`
- `taiko_viewer/tests/dailyAbilityArchive.test.ts`
- `taiko_viewer/tests/dailyProgress.test.ts`
- `taiko_viewer/tests/dailyProgressReplay.test.mjs`
- `taiko_viewer/tests/fixtures/growthReplayHarness.mjs`
- `taiko_viewer/tests/fixtures/growthRequestHarness.mjs`
- `taiko_viewer/tests/fixtures/passport0819/dailyProgress.ts.txt`
- `taiko_viewer/tests/fixtures/passport0819/evidence.ts.txt`
- `taiko_viewer/tests/fixtures/passport0819/service.ts.txt`
- `taiko_viewer/tests/growthHistoryHttp.test.mjs`
- `taiko_viewer/tests/growthHistorySql.test.ts`
- `taiko_viewer/tests/growthRequestEvidence.test.mjs`
- `taiko_viewer/tests/passportFinalUx.test.ts`
- `taiko_viewer/tests/practiceAudio.test.ts`
- `taiko_viewer/tests/practicePlayer.test.mjs`
- `taiko_viewer/utils/dailyProgress.ts`
- `taiko_viewer/utils/growthRequestMemo.ts`
- `taiko_viewer/utils/practiceBundle.ts`
