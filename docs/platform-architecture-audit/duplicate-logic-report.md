# Duplicate Logic Report

**重复主要在两个 Python bot 副本之间；Viewer 的主要 Rating/推荐入口调用中心 Python，但自行实现了产品事实、归属和部分规范化。** 不应把所有重复都归为“Viewer 抄了 bot”。

## 可复核规模

在扫描范围内，以 A 的 `taiko/` 去掉前缀后匹配 B 的相对路径：53 个文件配对，10 个整文件 SHA-256 相同。Python 按限定名称（包括 class/嵌套函数）比较 `ast.dump(..., include_attributes=False)`，得到 **718 个同名、同 AST 函数**，覆盖 B 中 **11,365 行不重复计数的函数源码行**。

这不是整个生态克隆检测的总量：不同路径/函数名、变量重命名的语义重复未计入；docstring 参与 AST；模块常量、import 和上下文不同仍可能造成不同行为。因此“同函数 AST”不等于“端到端结果相同”。[汇总](evidence/duplicates.csv)、[718 项明细](evidence/identical-functions.csv)、[统计口径](evidence-index.md)。

## Rating 与六维

| 项目 | A / R | B | Viewer |
| --- | --- | --- | --- |
| v1 输入 | 中心 userdata + rating_structured；可用谱面/重复版本过滤 | 中心读缓存 + 本地公共数据副本 | personal/charts 调用 R，Growth 使用 compute-only bridge |
| v1 accuracy | comprehensive `(良 + 0.5×可)/notes`，0.75 下置零；great-only 0.5 门槛；全良覆盖 | 核心同名函数相同 | 未找到当前主入口的独立 TS 公式实现 |
| v1 精度分段 | comprehensive 0.75 / 0.8278 / 0.9793；normalization 15.5 | 相同函数副本 | 委托 R |
| v1 rating | M 来自 const_to_score；N=calc_y；P、Q 加权幂平均 | 核心函数相同；数据、过滤和调用参数可不同 | 委托 R |
| v1 六维 | 大歌、体力、高速、精度、节奏、复合 | 同一组公式副本 | 数值委托；priority/focus/sufficiency 另有 TS 产品规则 |
| 聚合 | Top20 补偿；N≠20 平均；B30/Top20 是不同调用约定 | 保留相似聚合，部分适配/去重已不同 | Growth 固定 Top20、level≥4 等约束；B30 工具走另一调用链 |
| v2 | 单独 taikob_v2 + taikob_v2_data；六维为体力/手速/爆发/精度/节奏/复合 | 本地 taikob_v2 + CSV parser | V2 内容分发；不能把 Growth v1 数值当 v2 |

[E21](evidence-index.md#e21)、[E22](evidence-index.md#e22)、[E23](evidence-index.md#e23)、[E07](evidence-index.md#e07)。

v1 核心公式（代码摘要）：

```text
P = 150 − sqrt(max(150² − (M−N)²/2, 0))
Q = max(sqrt(max(25 − (M−15.5)²/25 − (N−23)²/69, 0)) − 4, 0.5)
AI = (Q × M^P + (1−Q) × N^P)^(1/P)
P≈0 时使用对数域的几何均值极限处理。
六维：sqrt(AI × M)、sqrt(AI × AE×15.5/100)、
      sqrt(AI × AF×15.5/100)、sqrt(AI × N)、
      sqrt(AI × AG×15.5/100)、sqrt(AI × AD×15.5/100)。
```

### 已确认的 v2 分叉

A/R `_calc_accuracy_rating` 为 `min(rating, accuracy) + ln(abs(rating-accuracy)+1)`。B 调 `_calc_ln_rating(rating, accuracy, accuracy)`，在 accuracy 高于 rating 的分支可落到几何均值。合成例：rating=10、accuracy=12 时，前者 11.098612，后者 10.954451。通过 AST 仅提取这两个已阅读的纯函数，在隔离进程以合成数字验证；未导入项目或读取用户成绩。**这是源码可证的不同公式**，不是只改变量名，也不是实际玩家差异的测量结果。

A 还有 v2 Top20 双权重/full-score reference 补偿；B 当前渲染主要取结果列表 Top20，经自己的表格渲染链。A/R v2 内核文件与 B 分别约 591/425 行，不能以旧 parity commit 证明当前一致。[E23](evidence-index.md#e23)

## 推荐

| 步骤 | 普通推荐 A/R | 普通推荐 B | 目标推荐 A/R vs B |
| --- | --- | --- | --- |
| 候选生成 | 全曲库减 best20；已玩/未玩合并；duplicate identity 去重 | 同源结构副本 | A 使用 score_prediction_support/target_score_core 的候选、历史画像；B 主要遍历本地 scoreline rows |
| filtering | 优先 CN 可用 chart key，fallback 上架 song ID；rating 指标 ≤ best20 median+0.2 | 上架 song ID 筛选；缺少同样的 CN chart-key 分支 | 均有星级/已达目标等筛选，但谱面覆盖、已有成绩选择不同 |
| scoring | 指标偏差、范围与用户 best20 对照 | 类似偏差模型副本 | A 使用 score-history/profile capacity、likelihood/probability 等模型；B 使用 profile match、progress bonus、missing penalty 的组合 |
| 输出 | 原始推荐、推荐 intelligence 投影、图片 | 本地列表/图片 | Viewer ordinary/target 调 A/R Python；今日计划与 Goal action 由 TS 追加 |

A `target_recommend.py` 2,084 行，B 594 行；不能归类成“同一推荐逻辑的路径适配”。A `score_calculator.py` 2,698 行、B 2,833 行，共有函数中仍有大量相同内核与不同外层。[E24](evidence-index.md#e24)、[E25](evidence-index.md#e25)

## Parser 与规范化

| 类别 | 发现 | 重复/差异判断 |
| --- | --- | --- |
| Hiroba HTML/score | A/B 均有 client/parser/normalize；normalize 文件完全相同，parser 的 crown/profile/score list 函数已有差异 | 真正的复制与漂移；B 正常同步委托中心，不能把残留本地 sync 当作活跃 Writer |
| TJA | A tjaAnalyzer 负责谱面分析；tja_roll_parser 负责分歧/连打/气球；merge_index 负责匹配 | 同语法的多个分析器，有不同输出职责；不是三个仓库都各有完整 TJA parser |
| Viewer TJA | noteCount 读生成 JSON；songTjaBundleIndex 动态加载 merge_index | 主要消费与委托，不是独立重写完整 TJA 规则 |
| CSV/chart metadata | A taikob_v2_data、B taikob_v2、本地 song/rating loader；Viewer v2ConstantsModel 对上游+补充+catalog 做映射 | 多个映射边界；需要 contract fixture，不能只抽公式 |
| Score 输入 | Python normalize/save；TS account shared、songs/manual、Kinoko importer | 字段校验、achievement 重建、来源/时间/锁定策略多实现 |
| History replay | Python score_calculator/annual/merged_bind；TS dailyProgress/evidence | full/delta、removed、时间和来源解析有多套消费者；事实粒度不同，不能机械合并 |
| Crown/achievement | Python Hiroba achievement；TS rebuildUserdataAchievement | 不同来源与累计统计约定；是否应统一需字段契约先行 |

[E13](evidence-index.md#e13)、[E14](evidence-index.md#e14)、[E26](evidence-index.md#e26)、[E27](evidence-index.md#e27)。

## 依赖和维护成本

不是只需发布一个 Python wheel：当前 utils 有固定绝对路径、NoneBot 包初始化、数据库/凭据读取、图片字体、NumPy/pandas/matplotlib、数据文件和 Viewer 反向 API 依赖。`growth_compute` 已通过 `spec_from_file_location` 和 `TAIKO_COMPUTE_ONLY=1` 分离部分计算依赖，说明可抽离，也说明当前不是自然隔离的模块。[E28](evidence-index.md#e28)

优先统一纯函数与显式输入：score record/ChartKey、v1/v2 model、可用谱面/去重、Rating/六维、TopN、推荐候选及评分。保留 bot adapter、HTTP、Writer、凭据、DB、渲染在宿主侧。推荐输出、模型版本和数据 revision 必须一起冻结。未在本轮创建 Core 或移动代码。
