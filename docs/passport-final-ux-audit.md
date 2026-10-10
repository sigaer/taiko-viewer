# Passport Final UX — 审计与实施决策

2026-10-09；输入为 `Sakura_Taiko_Viewer_0.80.2_Passport_Final_UX_Acceptance.md`。
开工 main `eeece6f` / **0.81.3**；0.80.2 WIP 已在 `b8092c4` 以 0.81.1 合入，没有未发布 0.80.2 候选。本轮兼容 UX 修复目标 **0.81.4**。package → nuxt.config（读取 package）→ public.appVersion → /more（dev fallback）一致。既存未跟踪文档/测试不纳入发布，不改 P1/Poster。

## 六项审计

1. 真正图表是 `components/PassportMetricChart.vue`，`utils/passportNarrative.ts:passportMetricRuns` 在服务端连续兼容段中再切缺值/limited/缺失 revision。SVG path 仅对至少两个有效点的 run 绘制。**四点各自版本不同 → scattered=true → ol.passport-point-records，而非 SVG**，这就是四列数字的直接原因；并非线的 CSS 不可见。全部兼容四点原本能画线，但六维 0–15 固定纵轴缺少中间刻度。
2. measurementVersion=1 是存储/测量契约；algorithmVersion=`growth-v1` 是固定 Growth 算法标识，均由 history/constants.ts 写入。modelRevision 是 model-revision.ts 对八个文件（growth compute、chart availability、duplicate versions、snapshot history、score calculator、rating structured、song data、alias）的名称及内容 SHA256；任意文件改动均改变整体 revision。scoreRevision 是成绩输入修订，**正常成绩进步不能因此断线**。

   只读核对运行源码 `growth_compute/__main__.py:72–95` 和 `plugins/utils/score_calculator.py:compute_six_dims / build_all_stats_for_user / aggregate_topN_value`：同一 all_stats 中 rating>0 且 level>=4 的 rated_stats，各指标分别排序 top20，然后中位数+分组加权平均+各列补偿参数，最终6位小数；加权组为40/30/20/10%，不足20条重新归一。共同输入包括成绩 good/ok/DF 判定、谱面 note count、曲谱匹配/可用性、定数表与 accuracy_to_score、P/Q/AI 公式、曲目数据与版本匹配。**七个指标的实际依赖**：

   | 展示指标 | 单谱数值及特有依赖 | 聚合 |
   |---|---|---|
   | Rating | AI(M,N,P,Q)；M=定数映射，N=精度映射 | AI_rating 独立 top20/补偿参数 |
   | 大歌力 | sqrt(AI×M) | 大歌力独立 top20/补偿参数 |
   | 体力 | sqrt(AI×AE×15.5/100)；AE 依平均/瞬间密度 I/J | 体力独立 top20/补偿参数 |
   | 高速处理 | sqrt(AI×AF×15.5/100)；AF 依 I/J | 高速独立 top20/补偿参数 |
   | 精度力 | sqrt(AI×N) | 精度独立 top20/补偿参数 |
   | 节奏处理 | sqrt(AI×AG×15.5/100)；AG 依叩き分け/BPM变化 K/L | 节奏独立 top20/补偿参数 |
   | 复合处理 | sqrt(AI×AD×15.5/100)；AD=复合处理 H | 复合独立 top20/补偿参数 |

   所以 Rating 公式变化也可能改变六维。模型散列是上述依赖的粗粒度超集，不能凭更名/相同数值推断等价。
3. measurement 行只保存版本三元组、scoreRevision、最终数值、focus、样本量、availability、capturedAt，没有每个输入的历史快照/摘要或逐指标 provenance。对**特定旧点跨粗 revision 的等价证明 NOT PROVEN**；不查私人成绩、不迁移、不回填，不引入跨版本连接。
4. 旧 milestones 路径：稳定 factKey 去重 → score-history 类型/日精度筛选 → 同 owner/binding/song/difficulty/day/precision 合并 → Goal 严格 matcher → 固定类型 importance + 最大相对 magnitude → **先3个时间桶，再未出现类型，再质量补位** → 同天2/同类型3/同曲1硬限制 → 初显8/展开24 → 按日期展示。普通 PB 可以因桶代表优先入选，强成就会被同日硬限制排除；没有质量准入。
5. GrowthFact 是 canonical 观察投影。FC/DF/clear 由 canonical crown 阶梯 -1/0/1/2 提升产生；原任务禁止NG推断FC，后续用户已纠正该领域定义（见下节）；Rank 是枚举状态提升；PB/NG/combo 是不同观察的最佳状态差异，不能称为同一局。Goal 来自完成证据；只有相同归属、谱面、goalType、sourceRevision 或有限 before/after 严格匹配才借用真实 play day，未匹配保持 day:null、observed/confirmed 语义。
6. 成本账本：当前 service 源码单请求读 365 天日代表 SQL **1次** + coverage SQL **1次**，history includeMeasurements:false（其 measurement SQL **0次**）；共享 DTO，30/90 两次纯 curation，180/365复用90；四档切换纯 selectPassportPeriod，额外 Passport GET **0**。上次发布实测 `/var/tmp/passport-narrative-0802/online-smoke.json`（0.81.1，**不是本轮新测量**）：GET 2166ms，1 compute/1 Python/1 replay，measurement query 3ms，curation 4ms，DTO50541B；SSR可见2987ms，1/1/1；切换0/0/0。本轮 fixture 浏览器对 API 计数并单独记录渲染时间，HTTP回归对加载调用计数；未经授权的生产认证成本不臆测。

## 一页开工实施决策（后续产品指示覆盖处见下节）

- **Metric compatibility: NOT PROVEN**。保留 measurementVersion+algorithmVersion+modelRevision，A→B→A、缺值、limited、未知 provenance 都不桥接。只移除 scattered 数字列表分支。真实日期横轴与所选窗口一致；六维统一 **0–15.5**（实际补偿上限），0/5/10/15.5 轻刻度；Rating 显示明确局部纵轴刻度。没有虚拟每日值。单点也有 SVG；空态保留无记录文字。tooltip/aria仅日期/指标/值；最多一处「记录说明」，只对版本断段出现。
- 视觉沿用 surface/text/muted/accent/border 和已有 display/body 字体，不加资源。图表约240px高，窄屏保持点位与纵轴可读；主成就加粗，证据最多两条。签名元素为真实日期折线/点图，不新增装饰。
- **质量规则冻结 v1（纯投影，不改 canonical）**：先做 source/evidenceVersion/时间/有限值/枚举检查。A=有效新DF/FC/首次clear/枚举Rank提升/已证实Goal；未匹配Goal仍只说确认。B-NG=before>after>=0 且整数，after=0 或减少>=2且降幅>=30%。因此1→0、21→5、14→2通过，5→4淘汰；0不可不等于FC。
- B-PB：有限正基线和正增量，以 **after-before** 为准（显式delta矛盾拒绝）。使用既存评价分数阶梯的区间尺度：50–90万之间每级10万，90–100万每级5万，百万以上沿用5万比较单位（不发明新评价）。最小证据：增量>=基线0.5% 且>=区间10%；其后至少满足基线1%、区间20%、或最小证据候选在当前窗口相对增幅上四分位之一。多事实只对 PB>=基线0.25%且>=区间5% + NG减少>=2且>=20% 的两类可靠改善允许 B；弱字段数量不能晋升。仅combo、played、无PB baseline、无Rank before/枚举均不能单独入选。
- 校准反例：+5000在70万基线不足区间10%而拒绝；+5000在95万且窗口相对幅度上四分位可通过；+1/+100/+1000即使窗口最大也不满足最小证据。+39380/965680满足基线1%及区间20%，不依窗口。固定 fixture 给出分布和完整 trace，不能根据生产单张截图调权重。
- 排序先真实强度（A的主成就等级；B的重大程度档/幅度），在**相同质量水平**内采用同曲/同日/同类型/时间桶软偏好；不同等级不跨档替换。每谱默认1条，但后续同谱强成就保留例外；同日2/同类型3均为软限制，没有相近替代时放行并记trace。至多8/24，不拿C补位。trace只在显式审计调用时构造，不进入DTO/用户UI。
- 性能风险：候选可靠性/percentile一次索引，有限24席选择；3000 score +300 Goal benchmark p95<30ms并报告max，不新增Python/replay/API/查询。profile/binding迟到响应继续用原隔离机制。没有新增DB/权限、90天事实扩容或P1接入。

## 验证证据

本节的终验以末节用户更新后的边界为准，原文的保守版本断线和禁止NG推断FC条款已被覆盖。发布前本地 Gate PASS；正式发布及授权账号烟测结果记录于 `/var/tmp/passport-final-ux-0814/release-report.md`，烟测完成前不宣称最终 COMPLETE。

- 固定黄金案例与相关回归 **235/235 PASS**：Goal create/evaluate/refresh、Daily/Weekly/Recent/History、推荐、measurement、Voice、Passport range/curation/HTTP、profile/binding 隔离；日志 `regression-final.log`。新增 final UX 黄金案例11项。
- 隔离 SQL **3/3 PASS**：实际 `SELECT DATABASE()` 为 `taiko_annual_poster_test` 后才设置显式 mutation opt-in；measurement上海业务日代表、Goal并发评估、登录/登出/创建/替换/取消/binding清理及零孤儿；日志 `sql-regression-final.log`。测试库缺少既有两张Growth表，使用仓库既存DDL补齐，未改产品schema、未连接生产进行mutating QA。此前失败测试残留的唯一合成账号已按精确id/随机用户名/no-login校验清理；最终测试均结束。
- 标准 Nuxt build **PASS**，独立 scratch preview，不替换生产输出；日志 `preview-build.log`。正式部署仅使用既定 `run_build.sh → deploy_forum_web.sh "<HEAD subject>"`。
- 正式构建浏览器 **56/56 PASS**（32核心+24附加）：zh/ja × 390/1440 × light/dark，compatible/singleton四点都保持SVG+实线；真实日期8:1间距、准确点值/键盘/鼠标/触屏点击/相邻按钮、弱事件空态/partial/unknown/truncated、365点/展开收起、长标题/移动底栏、零横向溢出/hydration/runtime/raw locale、四档0额外account请求、绑定切换和迟到响应隔离。dev矩阵此前亦56/56通过，正式构建结果为最终依据。数据与截图见 `browser-matrix.json` / `extras-matrix.json`；并排比较 `before-compatible-zh-390-light.png` 和 `recovery-compatible-zh-390-light.png`，以及 `before-singletons-zh-390-light.png` 和 `recovery-singletons-zh-390-light.png`。两组固定事实及四个精度点相同；已人工看图确认连线、主成就和无解释墙，并查看日文桌面暗色及长标题手机图。
- 浏览器synthetic初载可见：核心min/p50/max **361/663/891ms**，附加 **476/720/975ms**；核心切换max203ms。365点时两个当前显示指标合计SVG元素**2219**，双帧等待最高87.8ms；这是实际浏览器绘制帧等待，不是生产API耗时。layout shift max0.06809，包含站点进入/字体布局，未新增大图资源。
- 纯curation220轮，CPU200%、Node24.13.0、Xeon8255C：3000 score facts p50/p95/max **10.23/17.12/34.86ms**；3000+300 Goal **11.27/21.42/26.24ms**。365日sharedDTO **225791B**，compose24.09ms，初显8/展开24，共享节点47。p95<30ms通过；如实保留3000 case单次34.86ms尾峰，不能理解为每次都小于30ms。先前试算超目标后已通过减少重复排序/扫描、只为至多24条组装详细DTO及仅审计生成trace优化，未放宽资源guard。`curation.json` / `curation-resources.json`。
- 正式构建浏览器采样峰值：核心**638095360B**，附加**627912704B**；high/max/oom/oom_kill均0。curation Node maxRSS181551104B。所有QA/build串行使用memory runner，未提高预算；临时预览服务由finally关闭并校验无3197监听。
- Goal真实构建UI专项 **8/8 PASS**（双语/两宽度/明暗，score-pb代表场景）：创建、评估active/inconclusive/completed、刷新失败重试、无重载下一推荐、替换/绑定隔离；其他Goal类型由235项回归及3项SQL验证覆盖，未宣称48格全矩阵。`goal-browser-final.log` / `preview/browser-results.json`。新增脚本syntax check及`git diff --check`通过。

### trace要点

完整合成事实trace为 `selection-traces.json`，不存储任何生产私有成绩trace，不进入DTO。

| 固定候选 | 级别/结果 | 证据 |
|---|---|---|
| eight tiny PB +100…+450 / baseline950000 | C，全拒绝 | 低于0.5%基线且低于评分区间10%，不满足最小证据 |
| early DF / early FC | A，选择序1/2 | crown 1→2 / 0→1，不被近期PB洪水挤走 |
| rank + NG1→0 + PB4940 同组 | A，选择序3 | 用户领域定义：NG0即FC作主句，不可1→0及评价提升作附证 |
| observed Goal | A，选择序4 | canonical完成证据，day:null，仅确认日 |
| PB39380 / baseline965680 | B，选择序5 | 相对4.078%，评分区间78.76%，无需依赖分位数 |
| 同日FC/DF/评价3条 + 弱早期PB | 3条A全入选 | 第3条记录soft-day-exception；弱PB被quality gate拒绝 |
| NG21→5 /14→2 /5→4 | B/B/C | 绝对下降16/12/1，相对76.19%/85.71%/20%；5→4不合格 |
| 无baseline/未知Rank/无before/无evidenceVersion | C | 证据不足或矛盾，不能制造主成就 |

初显8与展开24来自同一选取前缀、最后按时间展示；倒序输入结果一致。一个主句、至多两条附证；NG0保留原canonical NG factKey/type，未创造FC事实。全良仍需canonical DF，NG缺少同份OK=0证据时不推断DF。180/365邻近标题明确披露精彩时刻<=90天；当前Rating/六维/Goal不随周期变成历史状态。

## 最新用户决策与最终实现边界

本轮用户明确覆盖原验收文档两项边界：

1. 「根据每天快照固定当天的能力值，后续即使更新算法，过去的已有值也保持不变。依旧保持零新增历史计算和连续连线。」只读核对父目录 `/home/sigaer/taiko/plugins/taiko.py:trend_handle` 与 `plugins/utils/score_calculator.py:_build_daily_rating_points_with_status`：bot v1 是按同一天最后快照选代表，用当前同一cfg重算后连接；它的图片还按索引等距定位。用户随后选择**冻结每日存档值**语义，不要求引入bot的重新计算。Viewer复用已有每日measurement与共享DTO，图表投影跨版本连接真实有限值；**不声称跨版本同公式等价，不改或回填旧数值，不新增Python/历史计算/replay，不改bot文件**。仍按真实日期定位，不复制bot的等距索引/图片。原保守分段元数据、后台版本信息、历史focus与change DTO保留，但不再决定SVG连接，也不再出现「记录说明」。缺失指标没有数值可画，仍不造零值；从有值到缺值不能伪称每天都有记录。两个原四点fixture最终都应为四点+一条实线，原「全独立版本不能连线」验收由本指示覆盖。
2. 「NG（不可）降成0就是FC（全连），ok和ng都是0就是全良。」因此可靠NG before>0→0升为**A/FC**叙事（质量band90），不可变化留作第一条佐证，原factKey/type仍保持NG，不造新的canonical FC。非零NG显著减少仍为B，5→4为C。全良使用已有canonical DF（crown=2），若只有NG事实而没有同份可=0证据，不推断全良。多个best字段不视为同一局；不由其他字段猜可=0。有效FC与NG0同组时canonical FC作主句；DF优先级更高。

最终显示为「精彩时刻 / ハイライト」，一条主成就+最多两条证据；删除每节点额外「其他变化」折叠以减少说明墙。180/365常显90天事实范围；partial/truncated/unknown仍可发现。图表摘要称「记录值」，不宣称算法净增长；年月跨年时日期含年份。点值支持键盘、hover/tap及相邻记录按钮（密集日期可准确逐条查看）。

质量软约束仅在相同tier/band内比较，类型/时间多样性不能把C塞进结果。相对幅度q75采用nearest-rank `ceil(.75*N)-1`，仅计算已满足最小证据的有效窗口PB。扫描至多24席；先序检查最高质量档，再在档内选软偏好与真实幅度。trace显式审计导出，生产curation返回仅原milestones/initialIds。

## 2026-10-10 修正：每日存档、全良遗漏与首屏类型覆盖（0.81.7）

用户本次明确要求 bot 同样冻结每日值，并授权对“只有成绩快照、没有能力值”的历史日期按当前算法一次性补齐。此前零历史计算限制不再禁止这次离线补齐；网页请求和周期切换仍不执行新增历史计算。

- 原 bot 每次 taikotrend 都重新计算所选历史。现在权威快照 writer 保存 v1/v2 Top20 日存档；当天新快照可更新代表值，相同快照和过去日期不能因算法更新重算。其他 TopN、v1 合并模式使用独立命名空间；第一次生成缺失记录后冻结。文件锁串行化读改写，临时文件 fsync 后原子替换，损坏存档拒绝覆写。
- Viewer 只读取 v1 Top20 最终存档，与原 measurement 按上海日期合并；已有历史 measurement 优先，当天才允许更新为较新快照。离线补齐先导入已有 Viewer 数值，再流式还原每个日期最后快照，只计算缺失日期；生产数据库仅 SELECT，无迁移、无历史测量更新。
- measurement writer 拒绝为同一 scoreRevision 因 algorithmVersion 改变另存替代值；过去已有记录日也不再由新的迟到请求替换。当天新成绩仍可追加测量。
- 精彩时刻原来的类型软限制仅作用于相同 tier/band，大量 FC 会排在所有 Rank/NG/PB 之前。现在同类型已有 3 条后，先让其他已通过 A/B 质量门槛的类型获得展示机会；无合格替代时可放宽。C 仍不可入选，初显仍是统一选择序列的前 8 条，展开至多 24 条；trace 标记 qualified-type-coverage。
- 全良另有事实提取遗漏：跨日快照的累计 crown 原本无法精确归到最后游玩日，导致有明确最高分全良判定的记录也被排除。现在只有前后完整判定总数一致、最高分提高且日期前进、最新同份记录良>0/可=0/不可=0、全良 crown 从未全良升至全良时，才按最高分日期生成 DF。仅累计次数变化、缺字段、旧最高分时间仍不推断日期。新增匿名合成回归覆盖该路径。
- 删除趋势上方重复的“过去 N 天 · 已有 X 个记录日”。仍保留真实日期轴、点值交互、30/90/180/365 本地切换和精彩时刻 90 天事实范围。
- 本次称号关系文件仅 generated_at 更新，关系和索引未变化，随发布收录。

验证结果在执行完成后追加；任务私有证据存放 `/var/tmp/passport-0817`，不纳入仓库。

本轮发布前验证：82 项相关单元/投影/HTTP 静态回归通过；后续 Overview 日存档保护、真实服务回放及 Daily 针对性组合 44/44 通过；两项隔离 SQL 验证在实际 SELECT DATABASE() 确认为 `_test` 且显式 opt-in 后通过，含算法变更不替代旧快照和过去已记录日拒绝覆盖。Bot 存档单测 5/5、趋势与双模型 writer 回归 22/22 通过。性能优化后 3000 / 3300 候选 p95 为 19.83 / 18.40ms，保留 <30ms 门槛。真实浏览器 dev 矩阵 56/56 通过，覆盖双语/明暗/手机桌面、365 点、展开、键盘、迟到响应和四档切换零额外请求；已看手机普通和日文暗色长标题截图。临时预览进程与 3197 监听已退出。

授权历史补齐处理 637 个有快照的当前绑定鼓众，读取 29544 个文件，得到 18577 个 v1 日存档，失败 0；对原有 511 个有效历史日逐值核对均未变化。用户指定账号的真实快照回放确认遗漏 DF 进入初显集合；bot 实际 v1/v2 趋势生成均成功，各有 344 个存档日，已有 344 个 v1 日值不变。DB 未执行生产 mutation。私人种子、账号审计、图像和详细日志仅留 `/var/tmp/passport-0817`。
