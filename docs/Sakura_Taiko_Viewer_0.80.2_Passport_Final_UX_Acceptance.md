# Sakura Taiko Viewer 0.80.2 — Passport Final UX Acceptance

**主题：六维趋势恢复 ×「精彩时刻」含金量收口 × 1.0 前最后一轮 Passport UX 验收**  
**供新的 Codex 对话独立执行。** 此文档是对既有 `0.80.2 Growth Passport Narrative & Visualization Closure` 的聚焦收口，不是再启动一个新的大型 Growth 项目。

## 0. 任务起点与版本纪律

- 最后一次确认正式发布的 Viewer 为 **0.80.1**（`03347639`）；后续 `0.80.2` 可能已有未发布施工。**开工必须核对** `package.json → nuxt.config.ts → runtimeConfig.public.appVersion → /more`、`git status`、已存在的 WIP 分支与适用 `AGENTS.md`。
- 如果 `0.80.2` 仍是未发布候选，就在该版本内继续收口，**不因返工升到 0.80.3**。如果线上/仓库版本已变，以实际 canonical 为准，不回退。
- 先查看 `docs/growth-product-voice-guide.md`、`docs/growth-product-voice-audit.md`、现有 Passport 代码与 0.80.1 milestone 选择器、兼容段判定。**先审计，后改动**。
- 目标是最后一次明确边界的用户体验修复：此轮通过后冻结 Passport 主要信息架构，转入 **1.0 Platform Stabilization / Release Readiness**。

## 1. 必须消除的两个真实负例

### 负例 A：六维趋势不是趋势图

当前用户截图：`六维变化 → 精度力`，9/20、9/28、9/29、10/7 有真实值 `10.42、10.42、10.44、10.48`，页面却只呈现四列日期/数字，并在下方留着「为什么有些点没连起来？」。

**这不可验收：**页面名为“六维变化”，主体却像表格，解释还成为主视觉。用户希望看见时间轴、数据点和能够真实连接的折线，而不是重新排版后的数字卡。

### 负例 B：成长节点像字段排列组合

当前例如：

```text
KAHATAREDOKI NO YUUWAKU
评价从紫雅升到了极
不可 1→0 · 最好成绩 1,001,000→1,005,940

DENSHI DRUM NO TATSUJIN
最好成绩提高了 4,500 分
最好成绩 986,070→990,570 · 连击 357→585
```

单句可读性已有改善，但筛选算法尚未证明“值得展示的程度”始终压过类型、日期的多样化指标。不能只是为每种字段换一句模板。

## 2. 严格产品目标与非目标

本轮必须实现：

1. **图表优先：**单维六维趋势持续显示为有时间横轴的可读图表；有真实可比的相邻测量才用折线，不可比较的部分保留点与诚实断段。
2. **质量优先：**精选先通过“含金量准入”，再按日期、歌曲、事件类型做多样化；不为凑够 8 项强塞弱变化。
3. **自然叙事：**区块定名为 **「精彩时刻」**，每项以一个明确主成就 + 简短佐证为主，避免机械堆砌或假装这些数据来自同一局游玩。
4. **收敛解释：**只有确实影响理解时才出现一处可发现的次级说明，移除问号墙、冗余完整性报表和重复技术术语。

本轮**禁止**：改六维/Rating/推荐公式；回算旧 measurement；改变 Daily/Weekly/Recent/Goal/canonical facts；新增数据库表或迁移；扩展 90 天 score facts 为 365 天；接入 P1a/P1b；新增历史 Replay、Python compute 或读取新权限范围；为追求折线而抹掉真实版本边界；新增成长分/全局排名/成就稀有度数据库。

## 3. 开工审计（短报告，不做第二份大型方案）

首先输出 `docs/passport-final-ux-audit.md`，只回答：

1. 当前真正渲染六维图的文件、SVG/path/点位与纯数字 fallback 的进入条件；为什么截图四点没有有效线？
2. 现有 `measurementVersion / algorithmVersion / modelRevision` 各自覆盖哪些输入？**分别列出 Rating 与每个六维指标的实际计算依赖**，以及这些输入如何引起 revision 变化。
3. 旧测量是否保存了足够的历史 provenance，能够**对特定历史点**证明跨粗粒度 revision 后某一维数值的定义、输入语义、量纲、聚合规则均未改变？
4. 0.80.1 `milestones.ts` 的真实选择路径：事实合并 → importance/magnitude → bucket → 同天/同类型限制 → 初显/展开。现有规则是否会为了时间覆盖把弱事件挤到高价值事实之前？
5. 现有 `GrowthFact` 能证明哪些事情（FC、DF、Goal、Rank、NG、PB）？哪些只是不同观察之间的最佳状态差异？
6. 当前 API/客户端初载和 30/90/180/365 切换的成本账本：请求、Python、History replay、measurement query、DTO、UI 渲染；不得以猜测代替计数。

审计完成后输出 1 页**实施决策**：指标级可比性 `PROVEN / NOT PROVEN`，图表最终方案，精选 quality gate 方案，性能风险。不要把实施决策藏在代码注释里。

## 4. Workstream A — 六维趋势图最终验收

### A1. 可比性的正确边界

六维与 Rating 是不同的**用户展示语义**，但不等于历史数值天然使用独立的版本/来源。

- **若 PROVEN：**有历史源码、输入版本及实际测量 provenance 的完整证据链，证明特定六维的跨段值同定义、同量纲、同输入语义且同聚合规则，才允许只在该维的投影上建立更细的兼容连接。Rating 仍按其自己的兼容性处理。
- **若 NOT PROVEN：**维持现有保守的 `measurementVersion + algorithmVersion + modelRevision` 断段。即使 10.42、10.42 相等，也不能据此跨版本连线，更不能把它称为稳定或上升趋势。
- 不得从“Rating 算法名称变了”反推“六维一定没变”；若必要证明需要更改 measurement schema、回填或旧源码不可得，**停止这项跨段优化，不阻断安全图表和精彩时刻收口**。

### A2. 无论可比与否，都必须真正有图

- 使用真实日期定位的 SVG/Canvas 时间坐标轴，标记每个可信测量点；同一连续兼容段有两个及以上有效点时，**点之间有可见实线**。
- 不兼容段、缺失维度或无效值：断开，不加虚线桥梁，不伪造每日中间点；同一段只有一点时显示单点。
- **全部为单点段时仍保留完整时间图**（时间轴 + 精确点位 + 非夸张的轻量辅助线/刻度），不得回退成四列纯数字。可以说明“目前记录还不足以画出连续走势”，但不编造趋势。
- x 轴与 30/90/180/365 所选窗口相匹配，不把四天数据拉成全年假连续。六维使用可解释的一致量尺；若采用局部纵轴缩放，必须标明刻度，避免把 10.42→10.48 的小幅变化放大成剧烈跃升。
- Rating 与六维分开；主图 tooltip、焦点 aria-label **仅日期、指标名称、数值**，不混入当时 focus；关注方向继续在独立区块。
- 删除点位上方多个 `?` 与每个断点的说明链接。**至多一处**可键盘操作的图表级「记录说明」，仅在确有不兼容断段时展示；默认不展开。它说明“有些时期采用不同计算方式，因此不会直接比较”，不暴露 raw revision、hash、schema。
- 六维单维切换必须便于操作。可附一个克制的六维总览，但**不是本轮硬要求**；不得为此用七条彩线或六个巨卡破坏手机第一屏。

### A3. 四点负例的正确判定

对四条精度力 `10.42 → 10.42 → 10.44 → 10.48` 构造两类 fixture：

- **全兼容版本：**四点依真实时间连成一条折线，可以精确查看点值；任何折线/点均不代表未经采样的中间日期有记录。
- **全部独立版本：**同一真实时间图保留四个点但不连；页面没有「四列数值卡 + 一排问号」的退化结果，也不能声称“精度持续提高”。

两类都要过真实浏览器截图，并以可访问的文字摘要解释数据限制。

## 5. Workstream B —「精彩时刻」精选质量优先

### B1. 在现有 0.80.1 选择器上迭代，不新写事实引擎

保留原 `GrowthFact`、时间归因、同谱/同日合并、稳定 ID、`factKeys`、Goal 严格匹配、source evidence 与 `timePrecision`。修改仅发生在**表现层候选资格、主事选择、质量排序、有限多样性与文案**。

采用明确两阶段流程：

```text
canonical facts → 同谱同日合并 → 事实可靠性/类型检查
               → QUALITY GATE（先判值得展示）
               → 按真实强度排序 → 类型/时间/同曲去重与软约束
               → 初显/展开 → 为入选节点选一个主叙事 → 事实佐证
```

**不得**先平均分配三个时间桶、再从每桶挑最好的普通 PB 填满“精彩时刻”。

### B2. 可审计的质量等级

| 等级 | 典型事实 | 准入与注意事项 |
|---|---|---|
| **A：明确成就** | 已证实的新 DF/FC、有效评价提升、严格完成的用户 Goal、可靠的首次通关 | 依据原 canonical 证据；Goal 未匹配真实 play day 时只能使用观察/确认语义，不推断游玩日 |
| **B：显著改善** | 不可明确降低（尤其降至 0 或明显减少）、有实质意义的 PB、伴随多类可证事实的提升 | 必须用**已冻结、可说明的业务条件**判断显著性；既看绝对事实和成绩尺度，也看历史/窗口内相对幅度；不能只取窗口最大值就把极小 PB 称为高光 |
| **C：普通变化** | 微小 PB、轻微 combo 增加、单纯已游玩/已同步 | 不自动进入「精彩时刻」；可保留在已有 Recent/Daily/成绩明细，不能为了凑数量晋升 |

不要未经校准直接规定“PB +5000 全是高光”或“不可降 1 一律不算”。需要从现有窗口的相对幅度分布、可验证的成就阶梯和最小质量证据共同建立**有限、稳定的判定规则**。阈值/档位如果新增，写在 `docs/passport-final-ux-audit.md`，给出反例和质量分布；须用固定 fixture 校准，不凭单张截图临时调权重。

### B3. 多样性是次级偏好，不能降级事件质量

- 同天最多 2、同类型最多 3、同曲最多 1 可以作为**初始软约束**，不是无条件硬门槛。
- 如果同日有 3 个独立、很有价值的 DF/FC/评价事件，而较早只有极小 PB，**不能只为凑早期 bucket 就踢掉高质量事件**。可保留高质量例外、同日分组或少于上限；必须记录选择原因。
- 时间桶用于 A/B 候选在**可比较质量水平内**提升时间覆盖；不允许用 C 级事实替换 A 级高光。
- A 级并非都必然固定第一：同曲多事实的成就等级、可信时间和呈现容量需要整体排序；相同输入（即使事实乱序）必须产生相同入选集合与顺序。
- **不凑数量**：真正符合条件的只有 3 项，就显示 3 项；没有可靠高光时展示自然空态，不声称用户没进步。
- 保持 0.80.1 现有初显（至多 8）与展开（至多 24）的性能/可追溯边界；展开也不能把 C 级弱记录伪装成精选。

### B4. 主成就 + 一行佐证

标题固定为：**「精彩时刻」**（日文采用自然的同语义表达，避免直译腔）。日期/歌曲/难度是上下文；**一个主事实**是视觉主角，其他事实降成不超过两条紧凑佐证。示例仅表示已确认的**跨记录成绩变化**：

```text
9月12日 · 魔王
KAHATAREDOKI NO YUUWAKU
评价从紫雅升到了极
不可 1 → 0 · 最好成绩 1,001,000 → 1,005,940

9月13日 · 魔王
冲刺旋侯
不可从 5 降到了 0
最好成绩 977,550 → 985,950 · 连击 130 → 478

仅 PB，达到 B 级时：
最好成绩提高了 39,380 分
965,680 → 1,005,060
```

- **不能把 NG=0 推论为 FC**，不能把多个 best 字段说成同一局比赛成果，不能无证据使用「终于」「一把拿下」「练了很多次」。
- FC/DF/评价与 PB 同谱出现：主句优先反映高价值成就；PB/NG/combo 是可选 supporting evidence，不做字段排列组合长串。
- 发生日与确认日继续区分；未匹配 Goal 不硬塞成某日街机高光。涉及弱证据只写观察范围内可以确认的内容。
- 单节点文案必须由稳定 `factKey`/事实集决定，zh/ja 同义槽，离开/返回、切换周期、展开/收起时不抖动；不新增随机选句或持久化文案历史。

### B5. 精选算法必须交出可解释的“选入/淘汰清单”

除 pass 数量外，给每个固定 fixture 输出**可审计 trace**：`candidateId / canonical factKeys / qualityTier / materialityBasis / primaryFact / selectionRank / selected / reason / bucket`。

不能只汇报“多样性更好”，必须回答：

- 为什么这条 PB 有含金量？其分数增量/对照基准是什么？
- 为什么某条同日 PB 被排除？
- 这条较早的 FC 为什么入选？
- 哪些事件因为证据不足而不是分数小被拒绝？
- 初显和展开为何保持一致？

trace 只用于测试/审计，不输出给普通用户，也不保存生产私有成绩日志。

## 6. Workstream C — 页面语言与信息层级（只做必要收口）

- `六维变化` 和 `精彩时刻` 的正文以趋势/事实为主。删除无意义的“精选 N 项”“最近 XX 天记录完整”“本次可查看的成绩节点”等报表式提示。
- **180/365 天时仍必须能发现事实覆盖限制**：能力测量按选中周期显示，但精彩时刻目前仅源自**最多近 90 天**可确认的 score facts；使用一条轻量、靠近区块标题的说明或可展开提示，不得将近 90 天冒充全年。
- partial/truncated/unknown 的真实缺口不能藏到不可发现的位置，更不能改成“没有变化”。
- 不复写 Rating/六维图里的关注方向；`focus` 是独立信息层，不能演绎“短板已解决”。
- 本轮不更换 Viewer 的主题视觉、导航体系或增加多层卡片；优先留白、排版和图表可读性。

## 7. 开发与性能边界

- 预期改动范围：`pages/my/growth.vue`、Passport 现有 chart/presentation helpers、现有 `milestones.ts` 的**纯精选投影**、zh/ja locale、相关单元/浏览器测试及一份审计。不要顺手改 writer、Growth history loader、评级源数据与数据库。
- 新增 Python compute = **0**；新增原始 history replay = **0**；四档本地切换额外 Passport GET = **0**。保留 0.80.1 的单次共享 DTO 和本地 periodViews。
- benchmark 必须包含：365 measurement days、六维图 DOM/path/点数量、3,000 score facts + 300 Goal 候选的质量选择开销、初显/展开、DTO bytes；保留已有 <30ms 单次 curation 目标，若超出不得藏进 page render。
- 确保 `current Rating/六维/Goal/Today Plan` 不会随历史周期被替换成旧状态；profile/binding 变更时旧请求不得污染新 UI。
- 公共 History <=90 天、私有 no-store/Vary Cookie、事实/版本兼容性保持现状。

## 8. 强制验证矩阵

### A. 图表与兼容性

1. 4 点全兼容 → 图上四点与连接线，日期间距正确。
2. 4 点各独立 → 图上四点但没有跨段线；没有表格 fallback/问号墙。
3. 两段、A→B→A、部分缺值、单点、空态、同业务日代表点。
4. 维度之间对版本依赖不同：只有在 provenance 证明通过时才允许某一维跨较粗 revision 连接；否则全部保守。
5. Tooltip/aria 仅日期+指标+数值，focus 在独立区。
6. 30/90/180/365、本地切换、历史覆盖、手机尺寸与键盘/tap 操作。

### B. 精彩时刻含金量（核心 golden）

1. **同日 8 条微小 PB + 较早 FC/DF/Goal/评价**：不能为了同日代表、时间桶配额而选多条微小 PB，A/B 候选须优先。
2. **同日 3 个独立强成就 + 较早一个极弱 PB**：允许突破同日默认 2 条软限制，不能让弱 PB 冒充早期代表。
3. **只有很小 PB/Combo**：少显示或空态，不凑满 8；不可评价为“大突破”。
4. **NG 1→0 / 21→5 / 14→2 / 5→4**：分别证明质量判断有证据、且不把同样的降 1 机械等价。
5. **PB + NG + FC 同谱同日**：合并一个节点，FC 可成为主句，其他指标只做佐证；不同 observed facts 不会被说成同一局。
6. **评价 紫雅→极 + PB**：评价优先；无评价枚举或 before 时不可编造。
7. **Goal strict matched / unmatched**：匹配事实只能用真实 day，unmatched 为 observation-only。
8. **倒序输入、同分 tie、period 切换、初显/展开**：输出确定性、factKeys/时间精度不变。
9. **partial/truncated/unknown**：不造完整历史，不把缺失写成“没有精彩时刻”。

### C. 浏览器与发布

- zh/ja × 390px / 1440px × light/dark 的**代表性真实浏览器矩阵**，必须覆盖全兼容折线和全 singleton 两种真实图形状态，以及 A/B 级事件混合和空态。
- 附**改前/改后成对截图**：同一组四个精度点、同一份「PB 洪水 + 高质量事件」事实。仅单元测试通过不足以关闭 UX Gate。
- 检查横向溢出、移动底栏遮挡、长歌曲标题、键盘导航、SVG/ARIA、无 hydration/runtime error、无 raw locale key。
- 回归：Goal create/evaluate/no-reload next、Recent、Daily、Weekly、History、recommendation、measurements、0.80.0 Voice、0.80.1 range/curation、账号隔离。
- 完成标准 build / Git diff 检查和既有部署健康流程；**只在已获授权的发布流程及全部 Gate PASS 后部署**。不绕过 memory runner、拒绝增加资源 guard 额度换 PASS，保护无关工作区修改。

## 9. 阶段化交付与止损

| 阶段 | 交付 | 退出条件 |
|---|---|---|
| 0. 审计 | `passport-final-ux-audit.md`，实际 Metric 依赖与 selector trace 设计 | PROVEN/NOT PROVEN 明确，负例可复现 |
| 1. 图表 | 修正实线/点/时间轴/轻说明的真正可视化 | 两个四点 fixture 的浏览器截图 PASS |
| 2. 精彩时刻 | quality gate、trace、主叙事与 secondary evidence | 强/弱事件矩阵 PASS；不为多样性牺牲含金量 |
| 3. 终验 | 性能、双语、桌面/手机、回归、生产烟测（有授权时） | 没有新增数据/计算负载与产品语义越界 |

**止损 1：**旧 measurement 历史无法证明跨版本兼容时，不回填、不迁移、不伪造线；如实用保守点线图结束本阶段。  
**止损 2：**质量模型如果需要新成就来源/新 DB 证据，停掉该子项，使用可证明的原有事实做精选。  
**止损 3：**任何低优先级多维大图或装饰性动画不得延误这轮 UX 修复与 1.0 准备。

## 10. 最终报告必须回答（精简）

1. 实际开工/最终版本与提交；是否复用已有 0.80.2 WIP？
2. 四点没有连线的真正原因、metric dependency 结论、允许和禁止的连接边界；有无跨版本未经证明的路径？
3. 两种四点 screenshot 是否都通过？出现一个点、多个点、多个不兼容段时是否仍是图表？
4. 「精彩时刻」质量分级规则、阈值依据、测试 trace；哪些弱事件被淘汰？为什么？
5. 同日高质量多事件是否允许突破软配额？较早高成就是否不会被 PB 洪水挤出？
6. 节点主句与附证事实、Goal/FC/DF/评价证据归因是否可靠？
7. 180/365 的 score-fact <=90 天范围是否被正确披露？
8. 新增请求/Python/replay、curation p50/p95/max、DTO bytes、浏览器真实可见时间？
9. zh/ja、390/1440、light/dark、关键回归、资源、构建/线上（若发布）证据？
10. 是否可冻结 Passport 主体 UX，进入 1.0 Release Readiness？如否，仅列剩余硬阻断。

全部通过后才能记录：

```text
0.80.2 PASSPORT FINAL UX ACCEPTANCE COMPLETE
CHART-FIRST SIX-DIMENSION TRENDS ACCEPTED
METRIC COMPATIBILITY BOUNDARIES PRESERVED
NO QUESTION-MARK WALL / NO NUMERIC-CARD FALLBACK
QUALITY-FIRST GROWTH HIGHLIGHTS ACCEPTED
DIVERSITY SUBORDINATE TO SIGNIFICANCE
CANONICAL FACTS / GOAL TEMPORAL SEMANTICS PRESERVED
30/90/180/365 RANGE CONTRACT PRESERVED
NO EXTRA PYTHON / RAW HISTORY REPLAY
ZH / JA / MOBILE / DESKTOP REGRESSION ACCEPTED
PASSPORT UX FEATURE-FROZEN FOR 1.0 READINESS
```
