# Sakura Taiko Viewer Recommendation Intelligence Audit

状态：审计基线；0.49.9 Bridge 已按本报告 Non-Goals 实施

生产基线：0.49.8

审计日期：2026-08-25

本报告以 /home/sigaer/taiko 当前生产代码和 /home/sigaer/taiko/taiko-forum/taiko_viewer 当前 Viewer 代码为权威事实来源。公开仓库 sigaer/taiko-bot 只作历史对照；对照 revision 为 46c8646847f8d642b53043b6123d8763e26c0a16，提交时间 2026-07-29。

本审计记录的是 0.49.8 基线。后续 0.49.9 Bridge 只复用本报告确认的生产算法，不修改算法、数据库或 UGC 1A。

## 1. Executive Summary

结论属于 Case B：生产已经有六维、普通推荐匹配、目标推荐画像和目标可达性计算，但没有正式的 strongest / weakest dimension、能力短板或 practice focus 判定。

最重要的五个答案：

1. 当前生产默认权威仍是 V1 六维：大歌力、体力、高速处理、精度力、节奏处理、复合处理。V2 六维已经存在于生产代码，但仍是显式 v2 测试入口和部分 Bot 双栏分析，不是 Viewer Rating、默认 B30、普通推荐或趋势的权威模型。
2. 当前不能可靠输出“你的强项/短板是 X”。代码能计算六个聚合值和候选匹配，但没有经过定义的 strongest/weakest 业务判定；直接取 max/min 不成立。
3. 当前不能输出真正的通用“练习重点”。目标推荐能回答“为了一个用户主动选择的目标，哪些谱面更适合冲”，但不会替用户选择应练哪个能力维度。
4. 首页“今天推荐”的底层普通推荐知道：推荐基准 best_key、Top20 谱面侧指标中位数、候选谱面指标、用户当前指标、已游玩状态、良率、候选与基准偏差、难度范围和内部 recommend_score。API 只保留其中六个字段，UI 最终只展示曲名、歌曲 ID 和难度。
5. 0.49.9 可以桥接已有可靠数据，但不能称为“恢复短板能力”。若实施，应是 Recommendation Intelligence Bridge：结构化暴露既有 Rating/六维/推荐依据，以及把既有目标推荐接到 Viewer；“自动练习重点/短板”仍需要新的、经验证的产品算法。

## 2. Current Production Data Flow

### 2.1 Personal Home Rating

~~~text
AuthenticatedHome
  -> usePersonalHome()
  -> GET /api/account/charts/summary
  -> getPersonalRatingSummary()
  -> Python compute_all_from_userdata()
  -> aggregate_topN_value(results, "AI_rating", 20)
  -> { current, scoreCount }
  -> Home 只显示 current
~~~

证据：

- taiko_viewer/components/home/AuthenticatedHome.vue
- taiko_viewer/composables/usePersonalHome.ts
- taiko_viewer/server/api/account/charts/summary.get.ts
- taiko_viewer/server/services/account/personal.ts
- plugins/utils/score_calculator.py

这是 V1 综合 Rating 的 Top20 聚合。scoreCount 是达到 V1 计入条件的 RatingResult 数量，不是用户全部游玩谱面数。Viewer Home 没有读取任何六维或强弱项数据。

### 2.2 Personal Home “今天推荐”

~~~text
AuthenticatedHome
  -> usePersonalHome()
  -> GET /api/account/recommendation
  -> getPersonalRecommendations()
  -> Python compute_recommendations_for_user(
       best_key="rating",
       limit=3
     )
  -> Viewer service 字段投影
  -> { items }
  -> Home 取 items[0]
  -> 只显示 title / song_id / level
~~~

因此首页调用的是 V1 普通推荐，不是 target_recommend，也不是 V2 推荐。

### 2.3 Viewer B30

~~~text
/tools/b30
  -> GET /api/account/charts/b30?n=&dim=&r=
  -> getB30ImageBuffer()
  -> 默认：render_b30_image()
  -> 单维/动态原点：compute_all_from_userdata()
  -> image/jpeg
~~~

- 默认 B30 使用 V1 RatingResult 与 V1 六维。
- Viewer N 默认 30；N 不等于 20 时，每个维度按自己的 TopN 做算术平均。
- 用户选择单维时仍是大歌力、体力、高速处理、精度力、节奏处理、复合处理。
- API 只返回图片，没有结构化 Rating/六维 payload。

### 2.4 Viewer Recommendation Tool

~~~text
/tools/recommend
  -> GET /api/account/charts/recommend?n=&dim=
  -> getRecommendImageBuffer()
  -> compute_recommendations_for_user(best_key=selected legacy dimension)
  -> generate_recommend_image()
  -> image/jpeg
~~~

这也是 V1 普通推荐。页面允许用户主动选择综合或一个 V1 维度，但系统不会自动选择练习维度。

### 2.5 Viewer Trend

~~~text
/tools/trend
  -> GET /api/account/charts/trend
  -> generate_rating_trend_image()
  -> build_daily_rating_points()
  -> compute_dim_topN_means() / aggregate_topN_value()
  -> image/jpeg
~~~

趋势使用 V1 六维和综合 Rating。默认 N=20；每个历史快照重新计算各维自己的 TopN 聚合。没有 V2 Viewer 趋势入口。

### 2.6 Bot Default and V2 Entry

Bot 的默认 taikob 仍使用 V1：

- taikob N：V1 B30/雷达/单维列表。
- taikob20 v2：显式 opt-in，且代码和图片标题仍标记“测试中”。
- V2 目前只允许 N=20，不支持动态原点。
- Bot 分数详情图会同时构造 V1 与 V2 谱面/玩家数据，并并排绘制“V1 传统定数”和“V2 Rating”。

因此“两套并存”是事实，但产品权威并不对等：V1 是默认生产主线，V2 是生产环境中的实验/对照能力。

## 3. Public Repo Historical Comparison

### 3.1 Comparison boundary

公开仓库不是生产镜像。相对公开 revision，当前私有代码的主要演化包括：

- score_calculator.py 已继续调整身份去重、推荐和 renderer 边界。
- target_recommend.py 从约 600 行的简单 profile match 模型演化为约 2000 行的目标可达性、容量阈值、score estimator、概率和历史证据体系。
- taikob_v2.py 的数据源、聚合和 B20 renderer 接口继续演化。
- 生产中还新增/拆出了 score_estimator.py、performance_forecast.py、target_score_core.py、score_prediction_support.py 等模块。

不能把公开 target_recommend 的字段 contract 当作当前生产 contract。

### 3.2 Ordinary recommendation continuity

公开版和当前生产普通推荐仍属于同一算法家族：

- 按用户侧 best_key 取 Top20。
- 求这些谱面的“谱面侧指标”中位数。
- 候选排除 Top20，包含已游玩与未游玩。
- 用指标偏差、用户分值偏差、良率因子计算 balance/recommend_score。
- 严格范围是参考值的 90%–105%。
- 推荐尽量平衡未游玩和已游玩。

生产版保留该思想，并加强了国行可用曲筛选、同曲身份去重等实现细节。首页 best_key 固定为 rating，所以它不是“自动发现弱项后推荐”。

### 3.3 Target recommendation evolution

公开旧版已经有：

- user_profile；
- candidate dimensions；
- profile_match；
- target_key；
- progress；
- target_score；
- recommend_index。

但旧版 profile 是“V1 Top20 按综合 Rating 排序后，各字段求算术平均”，candidate dims 是按目标精度提示重新计算的一组六维，recommend_index 是 profile match 加 progress bonus 的启发式组合。

当前生产没有简单照搬该结果：

- 非分数目标（全连/全良）使用 UserProfile capacity、required dimensions、profile match、进度与目标专用惩罚。
- 分数目标（极/紫雅/粉雅/金雅）构建 ScoreEstimatorProfile，基于历史相似谱面、稳定/PB 能力、精度证据、滚奏能力、目标所需维度和 performance forecast 估算 TargetReachEstimate。
- 分数目标的 recommend_index 实际来自多次尝试可达概率；测试明确约束其映射和单调性。
- 最终 TargetRecommendationResult.rows 会移除 _required_dims 等内部字段；renderer 只消费歌曲、当前分、目标、差距和推荐指数。

公开版证明这些概念有历史来源，但当前产品设计必须以生产模型为准，不能恢复旧 profile_match contract。

## 4. Rating / Six-Dimension Version Matrix

| Consumer | Overall Rating | Six dimensions | Status |
| --- | --- | --- | --- |
| Viewer Home Rating | V1 Top20 | 不返回 | 当前权威 |
| Viewer /tools/b30 | V1 | 大歌力、体力、高速处理、精度力、节奏处理、复合处理 | 当前权威 |
| Viewer /tools/recommend | V1 | 用户显式选择一个 V1 维度 | 当前权威 |
| Viewer /tools/trend | V1 | V1 六维 | 当前权威 |
| Bot 默认 taikob | V1 | V1 六维 | 当前权威 |
| Bot taikob20 v2 | V2 | 体力、手速、爆发、精度、节奏、复合 | 显式测试入口 |
| Bot 分数详情 | V1 + V2 | 两套并排 | 用户可见对照 |
| 普通推荐 | V1 | V1 best_key，默认 rating | 当前权威 |
| 目标推荐 | V1 特征/容量体系 + 新 score estimator | V1 派生能力和目标 required dims | 当前权威目标模型 |

### 4.1 Compatibility layer

存在命名兼容层，但不是模型等价层：

- V1 alias 把“高速/速度”映射到 speed，把“精度”映射到 accuracy_power。
- V2 alias 把“高速处理/speed”映射到“手速”，把“精度力”映射到“精度”。
- b30_render 是可注入 aggregation/result provider 的共享 renderer，V2 通过传入 V2 计算函数复用布局。
- Bot 分数详情显式同时加载两套结果。

这些兼容只解决入口和渲染复用，不能把 V1 的“大歌力/高速处理”自动翻译成 V2 的“爆发/手速”。

## 5. Player Profile

### 5.1 General Rating profile

V1 的核心结构化结果是每张谱面的 RatingResult：

- Overall：AI_rating。
- 六维：big_song、stamina、speed、accuracy_power、rhythm、complex_proc。
- 还保留定数、良率、原始谱面维度和中间变量。

用户总体六维通过 compute_dim_topN_means(results, N) 构造：

- 每个维度独立排序。
- 每维取自己的 TopN，而不是用同一批 Overall TopN。
- N=20 使用该维度专用的 Top20 补偿参数。
- N!=20 使用简单 TopN 算术平均。
- Overall Rating 同样通过 aggregate_topN_value 独立聚合。

因此系统确实能构造类似：

~~~ts
{
  rating: number,
  dimensions: {
    bigSong: number,
    stamina: number,
    speed: number,
    accuracyPower: number,
    rhythm: number,
    complex: number
  }
}
~~~

但目前没有一个跨 Viewer/Python 的共享 DTO；这些值主要停留在 Python 函数和图片 renderer 输入中。

### 5.2 Target UserProfile

目标推荐另有真正的 UserProfile dataclass：

~~~text
played_count
score_ratio_median
accuracy_median
combo_median
rating_capacity
difficulty_capacity
dim_capacity
user_dim_capacity
~~~

构造逻辑：

1. fallback profile 从已游玩曲目构建，按 quality 排序，取 max(12, 样本数/4) 个高质量样本，维度与难度取中位数。
2. 能成功计算 V1 RatingResult 时，primary profile 使用每维独立 Top20 聚合；alternate profile 使用每维独立 Top40 聚合。
3. primary 乘 0.98 保守折扣，再逐字段与 alternate 取较低值。
4. 分数目标当前进一步使用 ScoreEstimatorProfile，分开 stable_profile 与 pb_profile，并引入历史相似谱面证据。

这是一套用于“候选是否适合某个已选目标”的能力容量模型，不是“用户短板分类器”。

### 5.3 Are dimensions comparable?

六个 V1 玩家维度最终都落在大致 0–15.5 的 Rating-like 数值范围，雷达图和 profile matching 会同时使用它们；因此在相同模型内做候选容量比较是实现所支持的。

但不能据此把六维值直接做 max/min 后输出强弱项，原因包括：

- 六个维度公式不同：大歌力与精度力分别依赖定数得点/精度得点，其余维度依赖不同谱面特征。
- 每维 TopN 取的是不同曲目集合。
- Top20 补偿参数按维度分别校准。
- 没有代码定义“跨维差多少才构成强项/弱项”。
- V1 与 V2 量尺和维度语义不同，不能横向混用。

结论：数值适合模型内 radar、趋势和候选约束；不自动支持自然语言强弱项判断。

## 6. Weakness / Strength Capability

全仓业务逻辑搜索没有找到正式的：

- weakest dimension；
- strongest dimension；
- 能力短板；
- 强项/弱项；
- practice focus / training focus；
- 自动练习重点。

与“擅长/不擅长”有关的命中主要来自静态攻略文案，不是玩家画像算法。

target_recommend 的 _profile_match 只在候选谱面维度超过用户容量时施加惩罚。required_dims 只表达“达成这个特定目标需要什么能力”，并不表达“用户最该练什么”。

因此：

- Strongest dimension：当前不可安全暴露为产品结论。
- Weakest dimension：当前不可安全暴露为产品结论。
- Practice focus：当前不存在通用算法结果。
- “六维最低项 = 短板”禁止使用。
- “推荐歌曲需要 speed = 今天练高速”也不能自动成立，除非未来新增经过定义的目标选择/重点判定。

## 7. Recommendation Pipeline

### 7.1 Ordinary recommendation

普通推荐返回的完整结构化 candidate row 包含：

~~~text
title
song_id
level
is_unplayed
recommend_score
indicator_deviation_percent
indicator_deviation_abs
score_deviation_percent
user_indicator
reference_indicator
accuracy
accuracy_factor
is_in_strict_range
song_indicator
rating_indicator
~~~

算法知道：

- best_key：本次按综合或哪个维度推荐。
- 用户该 best_key 的 Top20 结果。
- Top20 对应谱面的谱面侧指标中位数 reference_indicator。
- 候选谱面的 selected indicator 和 overall rating indicator。
- 当前用户在该谱面的能力值/良率。
- 候选是否未游玩。
- 候选与基准的有符号/绝对偏差。
- 是否位于严格推荐带。
- 用于排序的内部 recommend_score。

它没有：

- UserProfile 对象；
- 六维 candidate vector；
- profile_match；
- target_key / target score / target progress；
- 练习重点；
- recommendation reason 字段。

普通推荐图片中的“推荐指数”也不是持久化的算法字段。renderer 将当前结果列表的 recommend_score 做 min-max 相对归一化得到 0–100；它只适合该张图内排序展示，不能作为跨请求稳定语义。

### 7.2 Home presentation boundary

getPersonalRecommendations() 只保留：

~~~text
title
song_id
level
is_unplayed
user_indicator
reference_indicator
~~~

它丢弃：

- recommend_score；
- indicator_deviation_percent / abs；
- score_deviation_percent；
- accuracy / accuracy_factor；
- is_in_strict_range；
- song_indicator；
- rating_indicator；
- best_key 本身。

PersonalRecommendation 类型也不包含 algorithm/version/basis。

AuthenticatedHome 再只消费：

- title；
- song_id；
- level。

所以首页确实消费了普通推荐模型最薄的一层 projection。即使 API 已保留 is_unplayed、user_indicator、reference_indicator，当前 UI 也没有展示。

### 7.3 What the Home recommendation really means

首页固定 best_key=rating，其语义是：

“从当前国行可用候选中，找出 overall rating 谱面侧指标接近用户 Top20 参考带、兼顾已游玩状态和当前良率的谱面。”

它不意味着：

- 这是用户最弱的维度；
- 这是最应该练的能力；
- 这首歌与某个自动识别短板有关；
- 这是极/全连/全良目标推荐。

## 8. Target Recommendation

### 8.1 Supported objectives

生产 Bot 支持：

- 极 goku
- 紫雅 ziya
- 粉雅 fenya
- 金雅 jinya
- 全连 full_combo
- 全良 dondaful
- 可附加 1–10 星筛选

入口仍是 taikorec / 推荐歌曲，但只要首参数被识别为目标，就进入 compute_target_recommendations_for_user；否则进入普通维度推荐。这是共享命令入口下的两个不同产品概念。

### 8.2 Structured target result

顶层 TargetRecommendationResult 包含：

~~~text
target_key
target_display
rows
candidate_count
required_count
is_enough
message
userdata
~~~

公开 row 已包含：

- song_id、level、star、title；
- current score；
- target_text；
- gap_text；
- progress（当前生产单位是 0–99.9 的百分数，不是 0–1 ratio）；
- recommend_index；
- is_unplayed；
- 分数目标还可能包含 recommend_likelihood、target_band_likelihood/index 和 target_key。

内部 renderer 前还有更丰富结构：

- UserProfile / ScoreEstimatorProfile；
- candidate feature；
- profile_match；
- target required_dims；
- TargetReachEstimate；
- required accuracy/good/hit rate；
- roll speed；
- history confidence；
- stable/PB score；
- single/three-attempt probability；
- forecast confidence。

不过其中许多字段没有进入最终 rows，或以私有 _required_dims 暂存后在返回前删除。

### 8.3 Renderer versus structured data

Bot 目标推荐图片实际显示：

- 难度、ID、星级、曲名；
- 当前分；
- 目标分/目标；
- 差距；
- 推荐指数。

renderer 不显示 row 中已有的 progress，也不显示内部 profile_match、required_dims、history confidence 或 probability breakdown。

因此 target pipeline 具备明显的“renderer 前结构化 intelligence”，但 Viewer 当前完全没有消费它。

### 8.4 Relationship to ordinary recommendation

| Aspect | 普通“今天推荐” | 目标推荐 |
| --- | --- | --- |
| 用户输入目标 | 无；首页固定 rating | 必须选择极/雅/FC/全良 |
| 核心思想 | 靠近用户 Top20 指标参考带 | 对选定目标做可达性/容量/进度评估 |
| UserProfile | 无正式对象 | 有 |
| Candidate dimensions | 单一 selected indicator | 多维 feature 和 required dims |
| Progress | 无 | 有 |
| Target score | 无 | 有 |
| Recommend index | renderer 内相对指数 | 目标模型结果 |
| Viewer API | 有，但字段很薄 | 无 |
| Bot user-facing | 普通推荐图 | 目标推荐图 |

两者不能合并命名为同一个“推荐算法”。

## 9. Existing User-facing Analysis

| Capability | Bot | Viewer | Structured before renderer |
| --- | --- | --- | --- |
| V1 Overall Rating | B30 图、单曲详情 | Home 数字、B30 图、趋势图 | 是 |
| V1 玩家六维雷达 | taikob 图、单曲详情 | B30/趋势图片 | 是 |
| V1 六维单维表 | taikob dim | /tools/b30 dim 图片 | 是 |
| V2 Rating/六维 | taikob20 v2、单曲详情双栏 | 无 | 是 |
| 强弱项文字 | 无 | 无 | 否 |
| 普通推荐理由 | 图中展示指标/偏差，不是 reason | 无 | 只有原始指标，没有 reason 字段 |
| 目标推荐 | 目标推荐图 | 无 | 是 |
| 目标进度 | row 有 progress；图主要展示差距 | 无 | 是 |
| 目标分/差距 | 图中显示 | 无 | 是 |
| 推荐指数 | 普通图相对指数；目标图模型指数 | 无 | 是，但两者语义不同 |

Viewer 的工具页多数只把 Python renderer 暴露为图片 endpoint，没有结构化 DTO。

## 10. Structured Data Already Available

可直接复用、无需重写算法的可靠结构化能力：

1. V1 每谱面 RatingResult。
2. V1 Overall 与各维 TopN 聚合函数。
3. V1 历史快照的 Rating/六维时间点。
4. 普通推荐完整 candidate rows。
5. V2 每谱面 V2RatingResult 和 V2 Top20 聚合函数，但仍应标为实验模型。
6. 目标推荐的 TargetRecommendationResult。
7. 目标推荐 rows 的目标、差距、进度、推荐指数。
8. 分数目标内部 TargetReachEstimate 和 stable/PB forecast。
9. 非分数目标内部 UserProfile、candidate feature、required dimensions 和 profile match。

“可直接复用”不等于“全部适合直接公开”。内部字段仍需稳定 contract、单位、算法版本、缺失状态与隐私审查。

## 11. Data Currently Lost at Presentation Boundary

### 11.1 Ordinary Home API boundary

Python candidate row -> Viewer API 时丢失：

- selected basis/best_key；
- recommend_score；
- candidate indicator 与 rating indicator；
- 相对 reference 的偏差；
- score deviation；
- 当前良率与 accuracy factor；
- strict range 标记。

Viewer API -> Home UI 时又丢失：

- is_unplayed；
- user_indicator；
- reference_indicator。

### 11.2 Image-only Viewer tools

B30、趋势、普通推荐均只有 image endpoint，因此结构化 Rating、六维、时间序列和 candidate rows 无法被 Viewer 组件、无障碍语义、响应式布局或后续 Personal Home 复用。

### 11.3 Target recommendation boundary

目标推荐没有 Viewer API。Bot 返回图片前：

- progress 已在 row 中但 renderer 未展示为结构化进度组件；
- required_dims 在内部使用后删除；
- profile_match 没有进入最终 row；
- score estimator 的 evidence、stable/PB、confidence 和 required performance 没有进入 TargetRecommendationResult public contract；
- target score 当前在最终 row 中主要以 target_text 字符串存在，而不是稳定 numeric targetScore 字段。

## 12. Capability Matrix

| Capability | Public old repo | Current production | Structured? | User-facing now? | Safe to expose? |
| --- | --- | --- | --- | --- | --- |
| Overall Rating | V1 | V1 默认；V2 实验 | 是 | Home/Bot/图片 | 是，带 model/version 与样本口径 |
| Six dimensions | V1；已有 V2 | V1 默认、V2 测试并存 | 是 | 图片为主 | V1 可；V2 需实验标识 |
| Strongest dimension | 无正式判定 | 无 | 否 | 否 | 否 |
| Weakest dimension | 无正式判定 | 无 | 否 | 否 | 否 |
| Practice focus | 无 | 无 | 否 | 否 | 否 |
| Candidate dimensions | 目标推荐 local dict | 目标模型内部 feature/required dims；普通推荐仅单指标 | 内部是 | 否 | 仅在定义稳定 contract 后 |
| Profile match | 旧目标推荐显式分数 | 目标模型内部；分数目标已演化为 forecast | 内部是 | 否 | 不应恢复旧字段；需按现模型定义 |
| Target | 极/雅/FC/全良 | 同上 | 是 | Bot 图 | 是 |
| Target progress | 是 | 是 | 是 | Bot 主要显示差距 | 是，需明确不同目标的单位 |
| Target score | numeric 字段 | 内部 numeric，最终 row 多为 target_text | 部分 | Bot 图 | 是，先稳定 numeric contract |
| Recommendation index | 简单 heuristic | 普通图相对归一；目标模型概率/专用指数 | 是 | Bot 图 | 目标可；普通指数不可跨请求解释 |
| Recommendation reason | 无正式 reason | 无正式 reason | 否 | 否 | 否；不能前端生成 |
| Stable/PB forecast | 无 | 分数目标已有 | 内部是 | 否 | 可候选，但超出最窄 Home bridge |
| History confidence | 无 | 分数目标已有 | 内部是 | 否 | 需产品校准后再公开 |

## 13. 0.49.9 Recommendation

### 13.1 Decision

建议 Case B 的 0.49.9 Recommendation Intelligence Bridge，但必须把范围理解为“暴露已有可靠能力”，而不是“恢复一个已存在的短板系统”。

0.49.9 不应在 Home 显示：

- 你的短板是高速；
- 今天练高速；
- 最弱维度；
- 自动练习重点；
- 由 min(dimensions) 生成的解释。

因为这些结论当前不存在于权威模型。

### 13.2 Safe narrow scope

推荐按以下优先级：

P0：

1. 建一个 Python 侧 shared structured result/CLI adapter，直接调用现有 V1 compute/aggregate/recommend 函数，不复制算法到 TypeScript。
2. 为 /my 或 /tools/recommend 提供 private structured endpoint：
   - model: v1；
   - overallRating；
   - sampleCount；
   - six dimensions；
   - aggregation: per-dimension-top20；
   - recommendation basis；
   - ordinary candidate metadata。
3. 扩展首页 recommendation contract，至少保留 basis=overall_rating、isUnplayed、candidate/reference indicator 和偏差；Home 文案最多表达“综合 Rating 推荐”，不表达短板。
4. 在 /tools/recommend 增加目标推荐模式，直接桥接现有 TargetRecommendationResult：目标、当前分、目标分、差距、进度、recommend index。不要先公开内部 required_dims 或概率细节。
5. 为普通 recommend index 和目标 recommend index 使用不同字段名/说明，避免两个 0–100 被误认为同一量尺。

P1：

- 在 /my 展示完整 V1 六维雷达/表格的结构化版本。
- 结构化历史趋势。
- 评审 target forecast 的 stable/PB/confidence 是否达到用户可解释标准。

### 13.3 Home recommendation

Home 最窄改动可以是：

~~~text
今天推荐
<歌曲名>  <难度>
综合 Rating
~~~

或展示“未游玩”状态。当前不能增加“练习重点”。

若产品一定要求 Home 出现“练习重点 + 相关推荐”，则那不是 bridge，而是新算法开发：需要定义重点选择目标、跨维标准化、置信度、样本门槛、稳定性和推荐关系。应另立设计阶段，不放进 0.49.9 bridge。

## 14. Implementation Proposal

仅为方案，不执行。

### 14.1 Shared Python contract

新增只读 adapter，建议返回：

~~~ts
type PlayerRatingIntelligence = {
  model: "v1";
  aggregation: "per-dimension-top20";
  overallRating: number | null;
  scoreCount: number;
  dimensions: Array<{
    key: "big_song" | "stamina" | "speed" | "accuracy_power" | "rhythm" | "complex";
    value: number;
  }>;
};

type OrdinaryRecommendationIntelligence = {
  model: "v1";
  basis: "rating" | "big_song" | "stamina" | "speed" | "accuracy_power" | "rhythm" | "complex";
  items: Array<{
    songId: number;
    level: number;
    title: string;
    isUnplayed: boolean;
    candidateIndicator: number;
    referenceIndicator: number;
    deviationRatio: number;
    inStrictRange: boolean;
  }>;
};
~~~

不包含 strongest、weakest 或 practiceFocus。

### 14.2 Target contract

为现有 TargetRecommendationResult 做稳定 projection：

~~~ts
type TargetRecommendationIntelligence = {
  target: "goku" | "ziya" | "fenya" | "jinya" | "full_combo" | "dondaful";
  targetLabel: string;
  candidateCount: number;
  items: Array<{
    songId: number;
    level: number;
    star: string;
    title: string;
    currentScore: number | null;
    targetScore: number | null;
    targetLabel: string;
    gapLabel: string;
    progressPercent: number;
    recommendationIndex: number;
    isUnplayed: boolean;
  }>;
};
~~~

numeric targetScore 应从生产目标数据显式投影，不能让前端解析 target_text。adapter 也应把当前 Python 的 0–99.9 progress 百分数明确命名为 progressPercent，避免沿用公开旧版 0–1 ratio 的语义。

### 14.3 API placement and caching

- private endpoint 放在 /api/account/*，由现有 private-cache middleware 设置 no-store。
- 不把 Python 结构化模型放进公开 content API。
- 将 Rating/六维和 recommendation 分开，避免一个超级 endpoint。
- current binding 是计算上下文；cache key 必须包含 user/binding 和输入数据 revision。
- API 返回 algorithm/model version，以便未来 V2 迁移而不静默改变维度含义。

### 14.4 Verification

实施时至少需要：

- Python adapter 与现有 renderer 输入一致性测试；
- V1 Top20 aggregation golden tests；
- ordinary recommendation projection tests；
- target numeric targetScore/progress contract tests；
- private cache isolation；
- Home 不出现“短板/弱项/练习重点”的 copy review；
- V1/V2 model label 防串测试。

## 15. Non-Goals

0.49.9 bridge 不做：

- 修改 V1/V2 算法；
- 将 V2 升为默认权威；
- TypeScript 重算六维或推荐；
- min(dimensions)=短板；
- 自动选择练习重点；
- LLM 解释六维；
- 新 recommend_index 公式；
- 把普通推荐与目标推荐合并为同一量尺；
- 完整六维 Dashboard 塞进 Home；
- UGC 1B；
- 数据库 migration。

## 16. UGC Relationship

UGC Phase 1A 不需要修改。

未来可把以下信号作为 Recommendation 的附加输入：

- 体感难度分布：辅助校正“官方/算法难度与玩家体感”的差异。
- 受控标签：辅助补充体力、速度、节奏、复合、视认、结构等谱面语义。

但它们应是后续候选特征或解释信号，不应：

- 改写当前 ugc_charts / vote / tag schema；
- 直接覆盖生产 Rating；
- 用少量 UGC 自动判定玩家短板；
- 在 Phase 1A 冷启动阶段进入核心排序。

先完成 UGC 数据质量、样本门槛和 tag taxonomy 稳定性，再单独评估 Recommendation feature integration。

## 17. Risks

1. 模型混淆：V1 与 V2 名称有 alias 重叠，但公式和维度不同。
2. 量尺误读：V1 六维同为 Rating-like 数字，不等于已定义跨维强弱等级。
3. 指数误读：普通推荐图的 0–100 是列表内相对归一，目标 recommend index 是另一套语义。
4. projection 漂移：当前 Viewer 内嵌 Python 字符串手选字段，Python result 变化时 TypeScript 不会自动报错。
5. target contract 不稳定：生产内部智能远丰富于最终 rows，直接暴露私有字段会绑定实现细节。
6. 样本口径混乱：Home Top20、Viewer B30 默认 Top30、target primary Top20/alternate Top40 各自含义不同。
7. 去重差异：Bot 默认 B30 使用 collapse_duplicate_versions=True，部分 Viewer 调用沿用默认 false；bridge 前应明确统一产品口径。
8. V2 数据源风险：V2 依赖独立 snapshot/source，且当前用户入口仍标“测试中”。
9. 文案越权：原始指标可以支持“推荐依据：综合 Rating”，不支持自动生成“你的短板是 X”。

## 18. Audit Verification

已运行：

~~~text
pytest -q tests/test_score_calculator.py tests/test_taikob_v2.py tests/test_target_recommend.py
63 passed
~~~

另外使用现有生产样本只读检查了普通推荐和目标推荐的 renderer 前 row keys，未写入用户数据或生产状态。

本审计到此停止，等待是否批准 0.49.9 bridge 设计实施。

## 19. 0.49.9 Bridge 实施边界

Bridge 将 Python 结构化结果作为唯一计算来源：Rating 返回 V1 per-dimension-top20 与 preserve 去重元数据，普通推荐固定 basis=rating，目标推荐独立返回 targetScore、gap、progressPercent 与 targetRecommendationIndex。Home 仅增加“综合 Rating”依据标签；完整目标结果放在 `/tools/recommend`，不宣称强项、短板或练习重点。
