# Sakura Viewer 0.80.1 — Passport Usability Recovery

**性质：线上 UX 紧急收口（P0）**  
**执行者：新一轮 Codex 对话；本文作为独立主控文档**  
**已知生产版本：0.80.0；实际版本以开工时 canonical 链为准**  
**原则：先恢复已上线成长档案的可读性，再讨论 365 天事实扩展与数据库迁移。**

> 本文明确取代“必须先完成 365 天 Read Model，才能修改 Passport UI”的旧执行顺序，**仅对 P0 有界 UX 修复授权**。它不解除 P1a Source Gate、P1b/Read Model Gate，也不将被阻断的 Temporal UX 全量目标宣称完成。

## 1. 目标与非目标

现在线上最明显的回归：

- “成长节点”从已有历史中按日期倒序 `.slice(0,8)`，同一天多条 PB 可以占满整页；缺少成就类型及时间跨度的代表性。
- 30/90/180/365 天选择器因现存测量跨度较短而被隐藏，用户误以为页面固定 90 天。
- Rating 等图表在多次算法版本变更下呈散点，断段说明与数据点关系不直观；focus 进入数值 tooltip。
- Passport 的任务变成了 Recent Growth 的长列表，失去“回看一段时间”的意义。

**本阶段的交付重点：**

1. **从现有、已经可可靠取得的最多 90 天 canonical facts 中，精选具有重要性、类别多样性、时间代表性的成长节点；禁止 newest-eight 算法。**
2. 恢复固定的 30/90/180/365 天周期控制，确保趋势/六维测量/关注方向使用实际选择的范围；对成长节点超过 90 天的缺口明确披露。
3. 将技术解释附着到真实图表断点；tooltip 只显示当前指标，focus 单独表达。
4. 遵守已有在线计算链路和性能预算，不引入额外 Python、重复历史回放或未知写入副作用。

**本阶段不交付：**

- 180/365 天完整 score facts、历史全量成就、全量年度成就档案；
- 重跑 365 天 JSON 历史或把公开 History 90 天上限扩大；
- MySQL 迁移、DB canonical、新索引、P1a 文件提交协议上线；
- 新 Rating/六维/推荐算法或旧事实判定语义的修正；
- 大型七线图、个性化画像或新的增长页面。

## 2. 版本、分支与项目保护

开工先检查 `package.json → nuxt.config.ts → runtimeConfig.public.appVersion → /more`。若仍为 0.80.0，建议以 **0.80.1** patch 发布；若已前进，不降级。

- 在当前可部署 Viewer 主线的独立 feature branch/worktree 实施，不合并 P1a 的 `feat/p1a-cross-writer` 三仓库改动。
- 不触碰生产 `/home/sigaer/taiko/userdata`、外部 live writer、生产数据库 DDL、导入/merged/Dispatcher。
- 保留已有工作区中未提交的业务 JSON、称号关系文件和用户文档；不得 `git add -A`。
- 先交付静态代码/测试及 P0 结果，再遵循现有构建/发布脚本。**如果现有部署权限没有覆盖此新阶段，应在部署前等待单独授权。**

## 3. 开工快速审计：最多聚焦四件事

先写 `docs/passport-usability-recovery-audit.md`，仅回答：

1. `getSkillPassport` 的真实 90 天 history load/replay、measurement range、Overview/Python 现有调用数；
2. `buildSkillPassportMilestones` 的候选事实、同谱同日合并、排序和 `.slice(0,8)`；
3. `passportRangeChoices` 的隐藏行为、`route.query.range`、API 范围、控制器刷新路径；
4. 实际图表分段规则及 tooltip/focus 的渲染位置。

不再进行新的 2,000 full × 500 charts ISO 冷回放。那是独立 BLOCKED 的架构任务，不应阻止此轮小范围 UX 发布。

## 4. 紧急修复 A：成长节点不再 latest 8

### 4.1 唯一事实来源

继续复用**既有最多 90 天** canonical Growth History（含已证明的 score/Goal facts、coverage/provenance）。不得生成新事实，不得使用客户端简单对比分数伪造 PB/FC/DF。

候选可包含 `score-pb`、`ng-reduced`、`combo-improved`、`clear`、`fc`、`df`、`rank-upgrade`、合法的 `goal-completed`；普通 played 仅在信息确实很少时作为活动说明，不能凑数伪称突破。

### 4.2 同谱同日合并

先依据 `(binding, chart/song, difficulty, day, timePrecision)` 安全聚合；一个节点可以同时包含 `FC + NG 1→0 + PB`。未经严格 Goal-score 关联的 observation-only Goal 不能被强行绑定某个游玩日。

每个节点保留对应 canonical `factKeys` / evidence refs 供测试追溯。不得删除或改写 History/Weekly/Recent 的事实输出。

### 4.3 用于选择的三种信号

- **Importance：** DF、FC、首次 clear、评价升级、合法 Goal 成就、相对显著的 PB/NG 改善、combo 等。相对幅度只用于候选排序；不设绝对的“进步分”或夸大式标签。
- **Diversity：** 尽量覆盖不同事实类型及不同谱面。默认主展示同一自然日最多 2 个独立节点、同一谱面最多 1 个、同一主类型不超过 3 个；若数据实际只有某一种类别，可放宽类型约束，但不造假。
- **Temporal coverage：** 对实际可确认的候选窗口分成 3 个时间桶（近 30 天可用 3×10 天；90 天为 3×30 天），每个有事实的桶优先保留至少一项高质量节点，之后补齐剩余席位。只在有事实的日期铺开；不得伪造没有发生的月份。

**稳定结果：**相同 facts/period 得到相同节点和顺序；排序不受原始数组顺序影响；tie-break 使用稳定 day/chart/factKey。

### 4.4 展示数量与“查看更多”

- 初始精选建议 **8–12 个节点**，数量由实际候选决定，不强行凑满。
- 允许额外返回有界的**最多 24 个精选节点**供用户在同页点击“查看更多精选”展开；不是把 `.slice(0,8)` 改成 `.slice(0,24)`，二者必须使用同一套多样性与时间覆盖选择算法。
- 如果某天存在 8 个 PB，可以显示“10 月 6 日 · 多首谱面刷新最好成绩”，下方列最有代表性的 1–2 首，其他可在该日的小展开中查看（限于已返回的精选数据）。不要用 8 张近乎相同的卡占满页面。
- 如果没有可确认的历史节点，空态写“在现有可确认的记录里，暂时还没有值得单独列出的节点”；不得断言用户没有游玩或没有进步。
- 成长节点按时间自然顺序呈现（可按最近→较早，但**挑选不是按时间截取**）。

### 4.5 必须通过的对抗测试

```text
90天窗口：
7月中旬：FC
8月：与 score fact 匹配的 Goal 完成
9月：评价提升 + NG 降低
10月6日：8 张不同谱面 PB
同一天同谱：PB + NG + FC
```

90 天选择结果必须包含有条件进入窗口的较早不同类型节点，不能被 10 月 6 日的 8 个 PB 独占。若较早事件超过 90 天，则正确排除，不假装存在。另测只有同日 PB、只有一种类型、没有事件、partial/truncated、unmatched Goal、输入乱序。

## 5. 紧急修复 B：恢复周期选择，但不谎称 365 天事实完整

### 5.1 固定四档

始终展示 `[30天] [90天] [180天] [365天]`；默认为 90。`route.query.range` 是唯一交互状态，前进/后退导航保持一致。即使只有 4 天 measurement，也不隐藏可选窗口。

### 5.2 两类时间覆盖必须区分

**Measurement coverage：** 现有已保存的 Rating/六维测量最多可按所选 365 天范围筛选。趋势、focus、period measurement summary 随 30/90/180/365 改变；顶部“现在的我”、active Goal/Today Plan 仍代表当前，不随范围改变。

**Score-fact coverage：** 本 P0 版本仍严格使用**最多最近 90 天**历史事实。

- 选 30：节点取与最近 30 天相交的可确认事实；
- 选 90：节点可从最近 90 天挑选；
- 选 180/365：仍只能从最近 90 天事实挑选，UI 必须清楚标记：**“成长节点目前仅整理到最近 90 天可确认的记录”**；这不是完整的 180/365 天成就列表；
- 任何不完整、截断、未知 coverage 必须保留现有状态与准确披露。

标题建议用 **“值得留下的节点”**；副标题明确 **“本次可查看的成绩节点：最近 90 天”** 或“近 30 天”。不得写“过去 365 天完整成就”。

**注意：这是明确的过渡产品契约。** 完整 180/365 天事实节点需要后续 DB/Read Model 阶段单独实现并验收，不作为 0.80.1 完成条件。

### 5.3 范围短于选择周期

例如只有 4 天 measurement，选择 365 时展示“过去 365 天 · 已有 4 个记录日”。X 轴必须反映所选择的日期窗口，不能偷偷缩放为那 4 天并造成每个选项完全相同的视觉错觉；不插值、不补数据。

### 5.4 防止切换重算

当前范围切换可能触发完整 Passport GET → 当前 Growth Python → 90 天 History replay。**热修不得以四次 Python/历史回放换取四个按钮。**

优先最小方案：首次 Passport 加载一次已支持的最多 365 天每日 measurement 代表点 + 一份最多 90 天 canonical facts，经服务端一次 composer 派生不同的有界 window views（或等价的共享 DTO）；周期切换仅更新本地选中 view，**0 新 Python、0 新历史回放，目标 0 网络**。所有 facts/measurements 仍按账号、绑定服务端验证；不把原始 userdata 发给前端。

如果这一修改经成本审计证明会造成无法接受的初载/DTO 体积：允许改成轻量 **range-only GET**，它不重新执行 current Growth compute，不重新 replay 历史，只查询/裁剪已证明的 measurement projection。若做不到，明确阻断该项，不可偷跑现有重型 endpoint。

必须测量页面初载和四次切换的 API 请求数、Python 次数、history replay 次数、响应体积、可见更新耗时。

## 6. 紧急修复 C：让趋势图不再令人费解

- 严格沿用现有 `measurementVersion + algorithmVersion + modelRevision` 分段：**同段且至少两个有效点才连线，不同段物理断开，不能平滑插值跨段。**
- 如截图实际每段只有一个点，散点不是绘图错误；应在图下简要说明“这段记录还不够多，暂时连不出连续走势”，不能为了好看假连线。
- “记录方式更新过”不再孤零零放置；在真实断点附近使用“为什么这里断开？”可键盘/触屏展开：前后算法计算方式不同，数值不直接比较。
- **Rating/六维数值 tooltip 仅显示日期、指标名称、数值。** 移除“高速处理”之类 focus 标签；focus 保留在独立的“关注方向”区，注明是当时更值得留意的方向，不是该数值的类型或下降证明。
- 保持 0.80.0 zh/ja Voice System；不显示 raw SHA、revision、segment ID。
- 六维同图/2×3 small multiples 是后续完整 Temporal UX 的增强项，**不作为本次 P0 必达项**。若现有组件已能以纯展示、零额外计算安全实现，可以作为非阻断增强；不得牺牲节点修复和快速发布。

## 7. 可接受的技术改动范围

允许修改 Passport 的 presentation composer、纯函数选择器、页面 Vue、i18n、Passport private DTO 的**兼容性新增字段**及必要的 measurement 共享查询。严禁改 canonical 事实定义、Goal 证据、算法版本分段方式、source writer 和默认 History 90 天 public validator。

推荐拆分：

```text
existing getSkillPassport
   ├─ current Growth         最多原有 1 次 Python
   ├─ History 90d            原有 1 次有界 replay
   ├─ Measurements <=365d    一次有界读取与按日采样
   └─ composePassportViews   纯函数，多周期筛选和精选节点

client route.range
   └─ choose shared view     不重新启动 Python/replay
```

不得新增持久化，不缓存私人 raw JSON 于无隔离的全局变量。不得让不同 binding 的客户端缓存或异步响应串号。

## 8. 性能 Gate（开工前记录 baseline）

**不修改 P0 历史 3s / 完整 Passport 5s 等已批准预算；这些针对 365 天旧冷回放的 BLOCKED 结论继续成立。** 本次不运行 365 天冷回放，不能借 90 天热修证明它通过。

本次另外增加**回归型成本门槛**：

- 原有最多 90 天 History load/replay **最多一次**；不得扩大 2,000-file/raw byte 界限。
- 原有 current Growth Python **最多一次初载**；切换周期新增 Python = 0。
- 周期切换新增 canonical history replay = 0；优选网络 = 0。
- Milestone grouping + curation：**目标 <30ms**（代表性 3,000 facts/90 天；同时报告 p50/p95、max 和成本环境，不拿 tiny fixture 冒充）。
- 页面初载与 payload 相比现有生产基线应报告增量；若可见时延严重回退，不得仅凭纯函数 benchmark 放行。
- 不增加数据库写入、Python 工作进程、全局 cache；不绕过 memory guard。

## 9. 必测场景

### 纯函数与语义

1. 最新同日 8 PB + 较早 FC/Goal/rank/NG；
2. 同谱同日 PB+NG+FC 合并；
3. 仅有一个日期、仅有 PB、不凑类型；
4. milestone 的 stable identity、排序稳定、同日/同谱/类型限制；
5. Goal 严格关联与未匹配 observation-only 时间语义；
6. 最近30与最近90的实际候选差异，180/365只声明近90可确认；
7. complete/partial/truncated/unknown coverage；
8. 4天 measurement + 365天选择、空段、同 segment 2点、跨段 A→B→A；
9. Focus 独立、tooltip 无 focus；
10. 当前状态与 period projection 不混淆；
11. 多用户/切换 binding 无串号；
12. 既有 Daily/Weekly/Recent/Goal/Rating/推荐事实回归。

### 浏览器矩阵

- zh / ja；390px 移动与 1440px 桌面；代表性 light/dark；
- 真实 Vue + 合成 API DTO 跑通四档选择、URL back/forward、同日 PB flood、有较早不同类别节点、3个以上非空日期桶；
- 展开“查看更多精选”，不暗示展示了“全部”；
- 长标题、底部导航、focus 标签、图表 tooltip/keyboard/tap、断点说明、Hydration、无溢出。

### 发布后验证

- 按标准部署脚本和隔离测试账号进行认证 smoke，必要时标明 GET Growth 可能捕获 measurement，因此不冒充纯只读；
- 生产上至少检查当前个人账户的已有真实记录展示，不修改真实用户成绩；
- 大量事件的可重复测试在隔离 fixture 里完成；生产不为了丰富时间线伪造玩家记录；
- 存在生命周期测试时，所有 synthetic account/binding/Goal/measurement/cursor/files 必须清理，孤儿审计为零。

## 10. 不可发布条件

任一存在则继续 BLOCKED：

- 仍用 `.sort(date desc).slice(0,8)` 挑成长节点；
- 一天 PB 洪水占满时间线，明明存在较早的其他类型事件；
- “查看更多”只是把 latest-8 换成 latest-24；
- 180/365 选中时谎称节点完整覆盖该周期；
- 30/90/180/365 按钮不可见或无效；
- 切换范围会重复当前 Growth Python 或有界历史 replay；
- current Rating/Goal 被所选历史时间窗错误覆盖；
- 跨 segment 造线或无法解释断点；
- Tooltip 中仍混入 focus；
- existing Growth Voice、i18n、profile isolation 或公开 History<=90 回归；
- 无成本证据、无真实浏览器验证、未完成线上功能 smoke；
- 改动触及 P1a writer、P1b DB 或扩大 365 历史回放。

## 11. Codex 工作顺序与止损点

**Step 1 — 小范围审计（不修改线上语义）**：确定原 composer、当前请求链路和性能 baseline。输出成本账本。

**Step 2 — 独立 milestone selector**：先做 fixture 与 golden，证明同日 PB flood 不再覆盖 90 天其他节点。必须先实现这项，不允许因后续图表阻塞而丢掉最重要的修复。

**Step 3 — 恢复 range 与真实覆盖提示**：固定四档，选中状态、事实 90 天 cap、测量档位准确；证明切换无额外 Python/replay。

**Step 4 — 图表解释与 tooltip**：保留 segment 真实性，移出 focus，轻量断点说明。六维多线可延后。

**Step 5 — 回归与视觉验收**：zh/ja、移动/桌面、性能、旧 Growth。达标后提交明确的 P0 发布报告，按授权部署。

如果 Step 3 无法在不增加重型计算的情况下完成，不要把整个阶段宣称 PASS；可报告 **`MILESTONE FIX READY / PERIOD SWITCH BLOCKED`**，提出将 Step 2 独立发布的最小安全补丁供用户批准。不得为了凑齐全部功能偷偷扩展 API 历史范围。

## 12. 最终报告必须回答

1. 开工/发布 canonical 版本和 Git 提交？
2. 原 latest-eight 根因、替代选择器文件位置？
3. 90 天窗口内 8 个同日 PB + 较早 FC/Goal/rank fixture 选出了什么？
4. 同谱同日合并、Goal 时间归因、事实可追溯是否一致？
5. 初显与“查看更多精选”的节点数量及折叠策略？
6. 30/90/180/365 选择与路由是否一致？
7. 30/90 与 180/365 成长事实 coverage 文案如何区别？
8. 四档测量趋势、focus 与当前状态的边界是否正确？
9. 初载 Python/history replay、各档切换请求数与额外 replay？
10. 单次 curation p50/p95/max、API payload/初载可见时间？
11. chart line、segment break、tooltip/focus、Keyboard/tap 如何验收？
12. zh/ja/mobile/desktop/dark 浏览器矩阵和人工截图结论？
13. Goal/Recent/Daily/Weekly/History/Voice/推荐回归结果？
14. 生产认证 smoke 与残留/orphan 状态？
15. 是否触碰 P1a/DB/365 冷回放、是否遵守旧 Gate？
16. 是否可标记 `0.80.1 PASSPORT USABILITY RECOVERY COMPLETE`？

## 13. 允许的完成标记

全部 P0 要求和生产烟测完成后：

```text
0.80.1 PASSPORT USABILITY RECOVERY COMPLETE

LATEST-8 MILESTONE REGRESSION REMOVED
90-DAY CANONICAL MILESTONE CURATION ACCEPTED
IMPORTANCE / DIVERSITY / TEMPORAL COVERAGE ACCEPTED
30 / 90 / 180 / 365 MEASUREMENT RANGE CONTROLS RESTORED
FACT-COVERAGE CAP DISCLOSED HONESTLY
NO 365-DAY FACT COVERAGE CLAIM
FOCUS REMOVED FROM METRIC TOOLTIP
SEGMENT BREAK SEMANTICS PRESERVED
NO EXTRA PYTHON OR HISTORY REPLAY ON RANGE SWITCH
GROWTH VOICE / DAILY / WEEKLY / RECENT / GOAL REGRESSION ACCEPTED

365-DAY READ MODEL / P1a SOURCE GATE STILL BLOCKED
```

如果只完成里程碑选择器但周期切换未完成，必须使用 `PARTIAL / NOT RELEASED`，除非用户另行同意拆分热修发布；不能复用上面的 COMPLETE 标记。

## 14. 后续阶段，不在本轮实施

- **P1b DB Canonical Feasibility**：统一事务写入、增量事实存储、旧 JSON 兼容迁移、完全语义 parity。
- **Full Temporal Passport**：可靠 180/365 天 score facts、完全按所选范围精选节点、六维多曲线总览以及新的在线/离线成本 Gate。

**短期先解决用户每天看得见的问题。长期再建设完整的历史基础设施。两条路线互不充当对方的验收证明。**
