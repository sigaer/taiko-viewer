# Sakura Taiko Viewer 0.80.2 — Growth Passport Narrative & Visualization Closure

**独立 Codex 主控指令｜成长档案叙事与可视化收口**

> 在**新的 Codex 对话**中使用本文；以本文为任务合同，不依赖既往聊天上下文。  
> 已知最新已发布版本：**0.80.1**。开工重新核对 canonical version；如仍是 0.80.1，目标为 **0.80.2 patch**，如已前进则不得回退。  
> 这是**用户体验层**的收口，不是 Source Writer、历史数据库、365 天事实存储或评分算法重构。

## 0. 目的与现有证据

0.80.1 已恢复 Passport 的 30/90/180/365 天选择，最近 **最多 90 天 canonical score facts** 的重要性/多样性/时间桶节点精选、Goal 匹配以及当前 Rating/六维 measurement 历史。四档切换已可复用共享 DTO，不额外发起 Passport GET、Python compute 或 History replay。

但线上页面仍有可见 UX 问题：

- 在 9 月 20 日、9 月 28 日、9 月 29 日、10 月 7 日共四个记录日的例子中，Rating 图出现多个孤立圆点和三个很醒目的 `?`；日期旁重复列出“为什么这里断开？”。视觉重点从“我的变化”变成了“系统在解释实现”。
- **六维属于用户理解中的另一类能力指标**，不应在其图上叠加 Rating、Focus 或无关算法的说明；但历史值是否真正跨版本可比较，必须审计实际计算依赖，不能直接假定。
- 下方的节点展示类似「不可 14→2 · 最好成绩 935,200→964,070 · 连击 266→617」的字段堆叠，没有突出哪一件最值得记住。
- 主页面直接展示“本次可查看的成绩节点：最近 30 天”“最近 90 天记录完整”“精选 7 个”等数据覆盖/运行状态文案，抢占用户阅读注意力。
- 标题“值得留下的节点”太像数据栏目；档案应是个人时间叙事，而不只是数据列表。

**核心目标：**让成长档案在不降低事实可信度的前提下，看起来像“翻自己的成长记录”，而非“审计数据和图表控件”。

**本轮不是**：为了连接出好看的线而跨版本虚构连续性；也不是把六维算法、Rating、Goal 或 canonical facts 重新定义。

---

## 1. 必须严格遵守的现存契约

### 1.1 已发布的产品与数据边界

- 版本链：`package.json → nuxt.config.ts → runtimeConfig.public.appVersion → /more`。
- Passport route：`/my/growth`（及既有日文路由映射）；`route.query.range` 是周期选择的真实状态源。
- 已有四档：30/90/180/365；measurement 可按已持久化真实日代表点查询最长 365 天；用户当前状态始终是“现在”，不是所选周期的平均值。
- **成绩节点仍最多使用最近 90 天可确认 canonical facts**；30 天取对应交集，180/365 不能假称拥有全年事实。公开 Growth History 的 90 天限制保持不动。
- 0.80.1 里已经发布的 `milestones.ts` 负责事实合并、重要性、类型多样性、跨日期覆盖、初显精选/展开精选；本轮**保留选取算法**，优先修改单条节点的叙事与布局。
- `measurementVersion + algorithmVersion + modelRevision` 是当前存量记录的**保守兼容性边界**；对无证明的旧记录保持不跨段比较。
- `focus` 指的是某个时点更值得留意的方向；它不等于退步、不等于这段时间练习成功，也不属于 Rating 数值 Tooltip。
- 不把多张谱面的累计最好记录误认为一次真实街机游玩 Session；同一张谱面的 PB / NG / 连击最佳记录也**未必来自同一次游玩**。
- Goal 的 `completedAt` 是 Viewer 确认时间，不自动代表实际游玩日；unmatched Goal 继续标注观察/确认语义。

### 1.2 0.80.0 Growth Voice

阅读并沿用 `docs/growth-product-voice-guide.md`、现有 zh/ja locale、`utils/growthVoice.ts`。语气：从观察说起、用事实说数值、有邀请而无命令；不过度演绎努力、情绪、训练状态或算法可靠性；不给空泛表扬。不要在主页面输出 `modelRevision`、`algorithmVersion`、schema、原始 hash 等。

### 1.3 与被阻断基础设施隔离

P1a 跨 Writer Source Gate、P1b DB Canonical 可行性及完整 365 天 canonical facts 仍独立处理。本轮不得触碰其隔离分支、外部 Writer、生产 DB 表或 `/home/sigaer/taiko/userdata`。不得解锁既有 BLOCKED Gate。

---

## 2. 开工步骤：先形成一份**短审计**，再实施

提交 `docs/passport-narrative-visualization-audit.md`，必须核对下列七点：

1. `pages/my/growth.vue` 的 Rating/六维 SVG 点、path、断点按钮和 Tooltip 实际构建方式；为何目前四个记录日出现三个 `?`。
2. 数值详情 `selectedPoint` 所代表的指标，与 focus/segment 之间的状态依赖；有没有同一个点击触发多个内容区同步闪动。
3. `SkillPassportSegment` 的版本判断是**真正的指标依赖**还是整套 Growth compute 的全局版本标识。
4. 六维值来源、Rating 值来源、`modelRevision` 的生成输入，是否可能出现“仅 Rating 算法/数据变更而六维定义与输入未改变”；是否能用**实际源文件、版本历史及持久化 provenance**证明特定旧测量对可比。
5. `milestones.ts` 输出给 UI 的字段、支持 facts、证据时间和 Goal 桥接；叙事实现应放在何处才能避免把算法与文案混在一起。
6. 30/90/180/365 选择与 current/measurement/fact coverage 的现行关系、旧版和新版文案具体显示位置。
7. 现有 Passport GET、Growth Python、History replay 和浏览器实际初载指标；是否可以实现**纯 UI/presenter 修改、零新增 API**。

审计只针对现有组件与版本来源，不再触发 2,000×500 的 ISO/full P0 压测。本阶段可以基于真实代码检索和已有隔离 fixture 下结论，但**无证据的算法独立性必须写 UNKNOWN**。

### 2.1 关键决策 Gate：按指标判断可比较性

用户的期望是“六维本身的趋势，不应受无关 Rating 更新影响”。这是一条合理的**界面及模型责任分离目标**，**不是**对当前数据兼容性的既成事实。

审计之后只能做以下两种选择：

**A｜PROVEN METRIC-LEVEL COMPARABILITY**

- 证明特定六维指标在某两段记录之间采用相同定义、输入语义、量纲和采样口径，且证明可以针对**这些实际存量记录**建立可靠等价关系；
- 允许在纯投影层采用按指标的兼容段，从而保留六维自身可比较的连线；
- Rating 保留独立的兼容判断；缺失记录不能推导为兼容；
- 必须有固定 fixture 和逐点 source/version 对照。

**B｜NOT PROVEN / UNKNOWN（默认）**

- 维持现有保守 segment 边界，Rating 和六维均不得凭猜测跨段连接；
- 只调整图表 UI 的解释方式、数值上下文与视觉层次；
- 原本是单点的段仍为单点，不宣称“折线趋势已恢复”；
- 如果以后要做真正的 metric-scoped fingerprint，作为下一阶段独立提案，不在本轮未经授权修改测量历史或回算旧数据。

**禁止捷径：**无条件删除 `modelRevision` 比较；看到两个数值均为 10.28 就判定跨段可比；用日期连续、颜色一样或“算法应当独立”代替实际证据；把新版本的分段规则追溯附会到没有相应 provenance 的旧行。

若 A 无法通过，不得以此阻断下面的**断点去噪、成长节点文案和版式修复**；选择 B 继续交付可上线的诚实 UX。

---

## 3. Workstream A｜让图表重新围绕“趋势”而不是“解释器”

### 3.1 图表信息分层

建议在“这段时间”下明确分成：

```text
这段时间                   [30天] [90天] [180天] [365天]

Rating 的走势
[Rating 图]

六维变化
[六维的轻量总览或单维选择]

关注方向
[独立 focus 时间轨迹]
```

不要同时在一张数值图中混放当前 focus、算法版本、问号、PB/Goal、用户操作建议。

### 3.2 折线与单点的**真实规则**

- **同一经过验证可比较的连续段有 ≥2 个有效测量点**：用简洁细实线连接真实点，真实点可 hover/tap，不额外插补日期。
- **一个段只有 1 点**：保留点，但减少夸张描边；不在点上人为画一条“趋势线”。
- **缺失维度值、limited/unavailable 点**：遵循原记录可用性，不跨缺口连接。
- **两段不兼容**：必须物理断开，禁止虚线、动画或背景色制造两点可比较的错觉。
- 不做平滑插值、预测、移动平均、归一化以掩盖断点，不删除少数记录来“凑”一条线。
- 如果某 30 天窗内四个 measurement 分属四个不兼容段，即使图上仅有四个点，也**不能为了视觉需求连接**。应转为更易读的点位记录视图/紧凑日期值序列，而不是重复铺三组问号。

### 3.3 删除“断点问号墙”

当前一个断点对应一个大型 `?` 圆圈、一条纵向虚线、底部一条“为什么这里断开？”的三次重复说明，属于主视觉噪声。本轮要求：

- 删除图中占主视线的 `?` 圆圈和反复出现的“9 月 28 日 · 为什么这里断开？”行。
- 使用**轻量留白**作为第一断点表达；必要时一个中性的短竖标记即可，不用破坏数值图线的阅读。
- 如存在真实不兼容段，整张图表区域最多一个可访问的二级说明入口（如“为什么有些点没连起来？”），放在图下或工具栏边缘。
- 展开说明只讲用户相关的事实：**“部分记录的能力值计算方式不同，所以没有直接连成一条线。”** 不输出原始版本键、不按每个日期解释一遍。
- 不兼容数据不能被错误地从无障碍树中隐去；screen reader 的图表摘要应说明“有几段可比较记录/部分记录独立显示”，不要靠颜色单独表达。
- 如果全段可比、没有断点，就不显示这个说明入口。

### 3.4 数值 Tooltip 与 focus 独立

数值详情只有：日期、当前指标名称、该点真实数值；例如：

```text
10月7日
Rating · 10.28
```

或：

```text
10月7日
高速处理 · 9.64
```

Tooltip / 点的 aria-label 禁止附带 focus、模型版本、其他维度解释。focus 在独立的“关注方向”区，允许写“这一天更值得留意的是高速处理”，但不能推断该维度变差或此前精度已经练好。

### 3.5 六维总览——优先验证小多图而不是“七条彩线”

六维与 Rating 分开展示。可从已返回的最多 365 个 measurement 日代表点做**纯前端投影**：

- 优先原型：六个小型趋势图（desktop 3×2 或 2×3，mobile 1×6/2×3 视可读性验证），共享明确的纵轴量纲 **0–15（以现有六维尺度为准）**、一致的时间窗口；每个小图只有自己的维度名称、点/段线及本段的真实数值。
- 备选：一张六维上下文折线图，点击 legend 高亮目标维度，其他线降低对比；390px 如果曲线/图例拥挤则不得上线此方案。
- 六维图不能混入 Rating 序列，也不能把“当前关注方向”画成第七条线。
- 各维度的可比边界由 §2.1 的实际证明决定；若全是独立点，可以选择“当前六维结构 + 少量有日期的记录点”，不承诺不存在的连续曲线。
- 不为了画总览调用新的 Python、读历史文件或在前端重算六维评分。
- 如果本轮无法使多维总览在手机上清晰可读，应保留现有单维选项，做好整洁简化；不要把它作为主修复的上线阻断项。

### 3.6 图表概览文案

一句观察优于叠加技术说明。例：

- **可比较且稳定**：“最近几次可比较的记录里，Rating 在 10.28 附近。”
- **可比较且上升**：“从 10 月 1 日到 10 月 7 日，Rating 从 10.28 来到 10.36。”
- **不可跨段**：“这些天留下了几次 Rating 记录，目前还连不出一段连续走势。”
- **只有 1 点**：“10 月 7 日记录到 Rating 10.28。”

上面只是证据类型样例。**不能**仅因四个不同版本的点都显示 10.28，就说“最近一直保持在 10.28”；先检查可比较性。

---

## 4. Workstream B｜成长节点从“指标拼接”改为有主次的故事

### 4.1 保留选取层，改造叙事投影

0.80.1 的重要性、日期桶、类型多样性及默认/展开上限已通过验收：**不得重新回到 latest-N，也不得随意重算 milestone selection。**

在 selector 输出之后增加纯展示 `composePassportMilestoneNarrative(...)`（实际名字按代码结构决定）：

```text
canonical facts
→ existing safe merge / curation
→ selected milestone + supporting facts
→ evidence-aware headline / support / optional detail
→ Vue + zh/ja locale
```

建议输出概念：

```ts
type PassportMilestoneNarrative = {
  id: string;                // 复用现有 stable node ID
  primaryFactKey: string;
  factKeys: string[];         // 事实追溯不可丢
  headlineKey: string;       // zh/ja 对齐语义槽
  headlineParams: Record<string, string | number>;
  supportingFactKeys: string[];
  detailKey?: string;        // 有必要才显示
  timePrecision: 'day' | 'observation' | 'unknown';
};
```

**不需要照抄 DTO**；只要满足事实可追溯、纯函数、与现有接口兼容即可。不保存生成故事，不为文案新增 DB 字段。

### 4.2 文案结构：一句主事 + 一行证据

节点建议：

```text
9月27日  NINJIN NIN  · 魔王
不可降到了 0
最好成绩 914,220 → 952,920 · 连击 231 → 592
```

对较复杂的：

```text
9月12日  KAHATAREDOKI NO YUUWAKU · 魔王
评价从紫雅升到了极
最好成绩 1,001,000 → 1,005,940 · 不可 1 → 0
```

只有 PB：

```text
9月13日  小怪 世界旅行 · 魔王
最好成绩又提高了 39,380 分
965,680 → 1,005,060
```

NG + PB + Combo：

```text
10月6日  夢と希望 · 魔王
这段时间，这首的不可从 14 降到了 2
最好成绩 935,200 → 964,070 · 连击 266 → 617
```

**语义提醒：**PB、最低 NG、最高 combo 可能分别来自不同的成绩更新，以上“这段时间”是累计事实归纳，**不代表它们发生在同一局街机游玩**。不得写成“这一把同时拿到 PB、FC、NG=0”，除非有同一次游戏级别的权威证据（现阶段没有）。

### 4.3 主句由什么事实决定

**明确主事优先于字段数量**：

| Evidence case | 主句建议 | 必须避免 |
|---|---|---|
| 新全良 | “这首留下了一个全良” | 无凭据称“第一次全良人生里程碑” |
| 新全连 | “这首拿到了全连” | 把 NG=0 直接当作全连事实 |
| 评价上升 | “评价从{before}升到了{after}” | 含糊地称“整体能力跨越一大步” |
| 选定 Goal 严格完成 | “之前选下的这首，有结果了”+实际类型 | 用 completedAt 冒充游玩日 |
| NG 明确下降 | “不可从{before}降到了{after}” | 单谱事实扩张为“整体精度正在稳定提升” |
| PB 但无其他强事件 | “最好成绩提高了{delta}分” | 无 before 时计算增长量、造 0 |
| 连击增长 | “最长连击来到了{after}” | 未证实时推断已全连 |
| 只有观察事实 | “这首多了一条更新记录”或不入精选 | 无事实称其“练成了” |

最终优先级以现有 curator 的主类型为起点；如显示主句与 supporting facts 冲突，报告并修复 presenter，不去篡改 canonical facts。Goal 匹配必须复用既有 exact matcher，未匹配的 Goal 只用“确认到……”这类观察语义，**不得赋予游玩日**。

### 4.4 更丰富，但不要变成抽签文案池

建议每个事实语义槽最多 2–4 个经人工审阅的生活化写法（不是每次刷新随意生成）：

- 「最好成绩又往前走了 {delta} 分」
- 「这首的最高分来到了 {after}」
- 「不可终于压到了 0」**仅当“终于”有明确的此前努力/多次记录证据时可用；否则用“不可降到了 0”**
- 「评价来到了 {after}」

保持中文和日文同证据强度；不要因为日文表达习惯，额外编造情绪。选句可借用当前 Growth Voice 稳定上下文/语义槽；**同一节点、同一事实集稳定**，不受列表顺序、locale 切换、hover 或组件重新挂载而随机改变。对于事实数值，准确性优先于多样性。

### 4.5 视觉层级

- 日期与歌曲为清晰的上下文；歌曲名不因英文/日文长标题溢出。
- **headline 是视觉主角**，Supporting facts 使用次级字号/颜色，最多展示两个重点；其余事实可在已存在的展开区域中查看，但不得隐藏导致错误理解。
- 不把「最好成绩 → 不可 → 连击 → 评价」固定顺序逐条堆一整行。
- 初显与“查看更多精选”继续使用相同节点 ID 和同一 narrative composer；收起/展开不换句，不改变主事。
- 时间线继续体现日期跨度，视觉不要做 8 张巨型统计卡或彩色 KPI Dashboard。

---

## 5. Workstream C｜标题与覆盖信息的产品化

### 5.1 标题不再像数据字段名

将“值得留下的节点”改为更具个人回顾感的标题。建议默认：

**“这段时间，留下了什么”**

可审阅的备选：

- “这段时间的几件值得记住的事”
- “这段时间的小高光”（仅用于确实有明显成就的情形）
- “翻翻这段时间的收获”

最终确定一个主标题体系即可，不做每天随机标题。不使用“成长指数”“数据节点总览”或臆测用户主观情绪。

### 5.2 删除冗余的完整性宣告，而非删掉真正的限制

**在记录充足、可确认且范围完整的普通状态下：**

- 删除“最近 90 天记录完整”“本次可查看的成绩节点：最近 30 天”等状态报告式正文；
- 删除作为主视觉的“精选 N 个”等技术性数量，除非它对导航确有帮助。

**在 180/365 天窗口：**仍须用一条不起眼、但能找到的真实说明，避免误把成绩节点当全年完整：

> “能力记录按你选的时间展示；成绩回顾目前只整理了近 90 天可确认的变化。”

可放在“成绩回顾”标题边的 info/details；但首次进入 180/365 时**至少要有一次可见的简短范围提示**，不能完全埋进无法发现的浮层。

**对于 partial/truncated/unknown：**不可删除事实限制。可移到次级说明层，语气如：

> “有一部分早期记录没能完整保留，这里只列出能确认的变化。”

禁止简单输出“最近 90 天完整”来规避情况复杂性；`coverage` 枚举和 API 原值保持不变，用户有能力看到必要详情。

### 5.3 “记录方式更新过”不是主模块

如果确实存在不可比较区间，UI 只有一处轻量提示及可展开解释，不单独设大标题、重复日期说明、问号墙。正常可比较图表完全不显示该说明。

### 5.4 Focus 文案保持谦逊

可保留“关注方向”及时间轨迹，轻量一次性解释它是**当时更值得留意的能力方向**；既不解读为评分退步，也不把 focus change 描述成成长事实或策略成果。

---

## 6. 交互与技术实现限制

### 6.1 无 API / 数据迁移优先

优先只修改：Passport 页面/图表呈现、`passportPresentation` 相关纯展示逻辑、节点 narrative composer、zh/ja locale、相关测试和必要的无障碍文本。读取现有 `SkillPassport` DTO，不新建 SQL 表、DB 移动、JSON snapshot loader、新事实类型或上游源。

如 §2.1 的 A 真正需要更细致的 metric-level compatibility metadata：必须先证明旧行可比，且仅在已存在数据足够的情况下采用**兼容性 DTO 附加字段**；若必须修改 measurement 表或历史回填，**暂停此子项并单独报告**，不可偷偷在本 patch 中迁移。

### 6.2 性能预算

以线上 0.80.1 的真实验收作为参考：一次 Passport authenticated GET 至多 1 次 Growth compute / 1 次 Python，至多 1 次已有 90 天 History replay；周期切换 0 Python、0 history replay、0 新 account API。单次线上 SSR 可见曾观测约 4.02 秒，这不是 P95 或正式 SLA。不要因改文案/画图而额外拉取一次历史。

本 patch 期望：

```text
额外后端 API = 0
额外 Python = 0
额外 History replay = 0
额外 DB 写入 = 0
周期切换仍 = 0 Network / 0 Python / 0 Replay
curation selection = 沿用 0.80.1，不重复全量筛选
narrative composition = pure, bounded
```

新六维视图必须量测 365 representative points 上限×6 series 的 DOM/SVG、layout/交互成本；若造成移动端明显卡顿，改为单维高亮/小图，不允许运行时后台重复建图。

### 6.3 SSR/CSR 与身份隔离

- 同一数据 SSR 与 hydration 选句稳定；不因为 server/client locale、时区或随机数变化而闪烁。
- profile 切换、解绑/重绑和延迟 API 响应继续隔离，不能复用别人的图表/节点文案。
- 不暴露事实来源的 raw hash、source token、敏感个人 ID；所有 account API 保持认证与 `private, no-store`、`Vary: Cookie`。
- 点位 hover / tap、展开/收起、range 变化不改变节点 narrative 事实或标题。

---

## 7. 验收 Fixture（必须真实跑，不只列清单）

### 7.1 图表与兼容性

1. **四个单点、四个不同 global `modelRevision`**：默认 UNKNOWN → 不跨段画线；无三问号墙；可访问的单个范围说明。
2. **一个连续兼容 segment 的四点**：实线连接；tooltip 仅日期+指标+数值。
3. **A→B→A**：第三个 A 不与第一个 A 接起来；不能把非相邻段跨回去合并。
4. **确证仅 Rating 口径变化、六维指标完整相容**：只有在 §2.1 A 的 provenance 证明通过时，六维才允许连、Rating 断；若不能证明则显式记录 B 并保持保守。
5. **missing dimension / limited sample / new user**：对应维度无值不补 0、不插线，不因缺数据断言能力退步。
6. **same-day multiple measurements**：沿用上海业务日最后一条 `capturedAt`/ID tie-break，不重新平均。
7. **30/90/180/365**：数值图、六维窗口、focus、摘要跟随 selected range；事实仍遵守 <=90 天限制。
8. **真实旧账户**：点位与截图中相近的四日期、三个模型断点场景；与预期无障碍和视觉状态一致。

### 7.2 成长节点与文案

9. **多事实同谱**：PB、NG、combo 可共同展示，但主句只讲有据可查的事实；不说来自同一次游玩。
10. **NG=0、无 FC fact**：只能说不可为 0，不能称全连。
11. **FC 与 DF 区分**：不能见到全连就称全良。
12. **PB 无 before**：不能计算 delta 或把缺失当 0。
13. **紫雅→极**：评价和分数分别呈现，不能推断全局六维突增。
14. **matched/unmatched Goal**：未匹配只表示观察/确认日；不把 completedAt 假装成 play day。
15. **同日 8 PB + 较早 FC/Goal/rank**：既有 curator 结果和 factKeys 与 0.80.1 golden 一致；只换叙事外观。
16. **输入事实乱序、zh/ja 切换、展开/收起**：事实主句稳定、所用 factKeys 不变，无跨语言证据强度漂移。
17. **空事实/仅普通更新/partial/truncated**：不造“收获”，不说“没有玩过”，必要覆盖说明仍可找到。
18. **30/90/180/365**：30/90 正常状态无重复完整性说明；180/365 有可理解、能发现的“成绩片段目前最多近 90 天”提示。

### 7.3 回归

- 当前 Passport query、measurement、focus、segments、milestone selection、Goal matching、现有 canonical History；
- Recent / Daily / Weekly、Goal create/evaluate/no-reload next、Recommendation ranking、六维和 Rating 计算；
- 0.80.0 Growth Voice zh/ja golden、0.80.1 range/query 状态、browser back/forward；
- 0.80.1 主要核心“同日 PB 洪水”fixture 必须保持选择结果的时间/类型多样性；
- public History 90d contract、用户/绑定隔离、版本链。

---

## 8. 浏览器视觉与无障碍 Gate

### 8.1 至少覆盖的实际浏览器状态

- `390×844` 中文浅色、日文浅色、中文或日文暗色；
- `1440×900` 中文浅色、日文暗色；
- **线上真实稀疏四记录日情境**；
- 合成同版本四点可连线；
- 合成多版本四点不可连线；
- 多维小图/备选图（若实施）；
- PB+NG+combo、评价升级、FC/DF、Goal、普通单一 PB；
- 30/90/180/365、展开/收起、页内跳转、键盘 focus、长日文/英文歌名、底部导航与 overflow。

### 8.2 验收问题（必须在截图报告逐项回答）

1. 图表第一眼看见的是数值走势/测量记录，还是三个大问号？
2. **存在可比点时有真实线；不存在时没有伪造线**吗？
3. Rating、六维、focus 是三个角色分明的信息层吗？
4. 异常技术说明是否只有一个弱化入口、且真正需要时仍可发现？
5. 节点是否先读到一句有意义的事实，而非长串 `PB · NG · Combo`？
6. 日期不同的节点仍然可见吗？“查看更多”后叙事不改变吗？
7. 365 天选择时，是否明白能力趋势按一年、成绩片段仍主要来自最多 90 天？
8. 日文是否自然，是否存在原始 key、未翻译中文或假装成同一局的表达？
9. 深色模式、390px、hover/tap/keyboard 是否可用？
10. 有没有新增长时间的 layout shift、SSR hydration 警告、额外网络请求或明显卡顿？

### 8.3 人工文案审阅重点

需要手动读完整中文和日文样例，尤其是“连击更稳”“终于拿下”“这一次同时”之类含因果/时长/主观推断的句子。不能把单首谱的多个最佳值自然拼接成同一次实际游玩的故事。

---

## 9. 测试、资源与发布流程

1. 独立分支/worktree 开工，先记录 `HEAD`、`git status`、canonical version。保留所有未跟踪文档和称号关系业务 JSON，不使用 `git add -A`。
2. 先交付审计与一个静态 UX 对照：**当前截图状态 → 新版图表断点表现 → 典型节点叙事**；确认 §2.1 A/B 路径后再批量修改。
3. 使用既有 `scripts/memory/run_qa.sh` 执行定向及 Growth 全回归；不绕开资源保护，不和 build 并行，不提升 heap/cgroup 仅为过测试。
4. 优先在正式组件/真实 Vue 浏览器中以合成 DTO 跑矩阵；不是只测 mock renderer。截图保存 QA 目录，不把截图、敏感 payload 或密钥加入 Git。
5. 构建使用现有 `scripts/memory/run_build.sh` 和仓库规定的发布方式；只有功能、事实、性能、浏览器 Gate 全部通过且现有部署授权适用时才能按标准脚本发布。否则停在可审阅 feature branch，报告 BLOCKED 并等待授权。
6. 发布后匿名认证边界测试、既有授权会话和需要的隔离合成账号 smoke；不得修改真实用户成绩或用线上测量写入伪称纯只读。执行真实 cleanup / orphan 审计，确认生产版本与 commit。
7. 百度可选推送额度等非阻断项按仓库政策处理，不能把外部推送失败当作 UI 功能测试失败。

**性能记录必须包含：**生产初载总耗时、Python count、History replay count、payload bytes、四档切换额外 API 次数、绘图耗时、narrative compose 计时、浏览器可见更新和资源指标。缺失 `memory.peak` 的情况标 unknown，不能以 `memory.current` 采样峰值替代 kernel peak 证明。

---

## 10. 分阶段交付与止损策略

### Phase 0 — Audit / Decision

交付依赖矩阵，判断是 §2.1 A 还是 B；不得假装六维和 Rating 的历史输入已被证明独立。

### Phase 1 — Core UX（必须）

- 图表移除问号墙/重复解释，单点与可比较折线遵循真实兼容性；focus 与数字 Tooltip 分离。
- 节点 `headline + supporting evidence`，中日文人工审阅，纯 presenter。
- “这段时间，留下了什么”或经审阅等价标题；冗余覆盖状态移到合理层级。
- 0.80.1 四档/90 天事实边界、筛选多样性全部保持。

### Phase 2 — Optional Enhancement（不阻断 Phase 1）

- 经证明的 metric-scoped comparability 展示；
- 六维 six-small-multiples 或六维上下文线（择一、手机验收）。

如果 Phase 2 需要测量 schema 迁移、过去模型依赖不可恢复、导致新 Python/replay、或手机版拥挤，**停掉 Phase 2，不要拖延 Phase 1 的 UX 修复**；记录下一阶段提案。

### Phase 3 — Regression / Release

完成单测、浏览器、人审、性能与部署 Gate；仅在全部适用发布条件满足时正式发布。

---

## 11. 发布阻断条件

任一出现不得宣称 0.80.2 COMPLETE：

- 仍出现三排醒目 `?` 与日期重复的“为什么这里断开？”；
- 使用未证明等价的旧 segment 跨线、虚构 Rating 稳定或维度改善；
- 把“六维应独立”当作无条件跨 `modelRevision` 连线的许可证；
- Rating Tooltip 又混入 focus 或其他维度；
- 节点继续仅是一串“分数·不可·连击·评价”的统计字段，没有事实主句；
- 同一首多个最佳记录被说成同一局打出的成绩；
- NG=0 被无证据说成 FC；或 completedAt 被称为游玩日；
- 30/90/180/365、selected state、current state 或 90 天 milestone selection 回归；
- 180/365 不披露成绩片段仍最多近 90 天，或 partial/truncated 误称完整；
- 为此补丁增加 Python、History replay、DB 写入、全量历史回算；
- 单纯为了做多维图表导致 mobile 不可读、渲染卡顿；
- 旧的 P1a/P1b/365 Read Model BLOCKED 被暗中当作已解除；
- 浏览器、zh/ja、人审或生产验收未完成。

---

## 12. 完成报告必须回答（32 项）

1. 实施起始/最终版本、commit、branch？
2. Audit 文档路径？
3. Rating 和六维依赖审计：实际同源/独立的范围？
4. 哪些历史数据有指标级可比较性**证据**？
5. §2.1 决策 A/B，UNKNOWN 如何处理？
6. 是否改变了旧数据的 segment 规则？证据是什么？
7. 4 个单点不同 revision 的最终图形怎样显示？
8. ≥2 个同段点如何连接？
9. A→B→A、missing point 是否保持断开？
10. 大问号与重复说明是否删除？
11. 断点解释如何呈现并可访问？
12. Tooltip 是否只含日期/所选指标/数值？
13. Focus 与图表最终如何分离？
14. 六维总览最终选哪种形式，或为何 defer？
15. mobile 六维显示可读性证据？
16. milestone selector 的 factKeys/排序是否不变？
17. narrative composer 文件与 DTO 契约？
18. PB、NG、FC、评价、Goal 的主事选择规则？
19. 单谱多最佳记录是否避免“同一局”误称？
20. 标题最终采用什么中文/日文？
21. 哪些技术词和重复 coverage 被移出主页面？
22. 180/365 的 90 天成绩事实限制如何告知？
23. partial/truncated/unknown 在哪里保留准确说明？
24. zh/ja 人审结论与示例截图？
25. 浏览器矩阵、390px/1440px/暗色验收？
26. a11y（keyboard/tap/aria/details）结果？
27. 初载 API/Python/History replay 次数是否不变？
28. 30/90/180/365 切换额外请求次数？
29. 响应大小与浏览器渲染性能变化？
30. Growth Voice、Goal、Recent、Daily、Weekly、History regression？
31. 生产 smoke、资源、cleanup/orphan、部署健康结果？
32. 是否可以正式记录 0.80.2 COMPLETE？遗留 P1a/P1b/365 Gate 状态？

### 全部适用 Gate 通过后的完成块

```text
0.80.2 GROWTH PASSPORT NARRATIVE & VISUALIZATION CLOSURE COMPLETE

RATING / SIX-DIMENSION / FOCUS ROLES SEPARATED
METRIC COMPARABILITY EVIDENCE BOUNDARY PRESERVED
CONNECTED TREND SEGMENTS ACCEPTED WHERE ACTUALLY COMPARABLE
SINGLE-POINT AND INCOMPATIBLE RECORDS HONESTLY PRESENTED
QUESTION-MARK BREAK CLUTTER REMOVED

MILESTONE HEADLINE + FACT SUPPORT NARRATIVE ACCEPTED
NO FALSE SINGLE-PLAY OR UNPROVEN PROGRESS CLAIMS
PASSPORT SECTION VOICE ACCEPTED (ZH / JA)
REDUNDANT TECHNICAL COPY DEMOTED
MATERIAL FACT COVERAGE LIMITS REMAIN DISCOVERABLE

0.80.1 PERIOD / MILESTONE CURATION REGRESSION ACCEPTED
NO EXTRA PYTHON / REPLAY / DB WRITE
NO PUBLIC HISTORY CONTRACT CHANGE

P1a SOURCE GATE STILL BLOCKED
365-DAY FACT READ MODEL STILL BLOCKED
```

**最终用户标准：**用户先看见“这一段自己的变化与收获”，而不是“算法问号、文件覆盖状态和一长串指标”。如现有记录不能证明连续趋势，页面要**自然地展示零散记录**，而不是为了美观制造错误历史。
