# StrongDan Presentation Granularity Audit（只读，未改代码 / 未写新 title / 未调 severity 与 0.55）

口径（按本轮确认）：
- current-version best Dan achievement 取 **max-severity**（den 数与 mark 组合里 severity 最大者）。
- 本轮**不扩大 gate**，只分析「若把 134 人纳入现有 6-title presentation」的碰撞情况。
- completion family：`gold_pass`(mark4) / `kanzui_gold`(mark5) / `kanzui_red`(mark2) / `full_good_gold`(mark6) / `full_good_red`(mark3) / `red_pass`(mark1)，赤系单列不合并。
- tier：A = 七段~八段（dan_id 12–13）、B = 九段~十段（dan_id 14–15）、C = 玄人~达人（dan_id 16–19）。
  dan_id→名称映射由 1405 份 userdata 的 `dojo.scores[].grade` 交叉验证（八段=13、九段=14、十段=15、玄人=16、名人=17、超人=18、达人=19）。

范围：1405 个含段位明细的账号中，current-version best severity ≥ 0.55 的 **134** 人。

## 0. 结论摘要

- 现有 6 个 title 在 134 人规模下**明显塌缩**：实际只用到 4 个，且两个 title 覆盖 **86.6%**
  （`dan_gold_pass` 天衡破阵 73 人 = 54.5%，`dan_kanzui_gold` 凌霄贯律 43 人 = 32.1%）。
- 单个 title 内部跨 tier 混合严重：`凌霄贯律` 43 人里同时含七段(14)、八段(4)、九段(7)、十段(11)、玄人(3)、名人(3)、超人(1)，7 个段位共用一个标题；
  `天衡破阵` 73 人里含八段(41)、九段(14)、十段(14)、玄人(3)、名人(1)，5 个段位。
- `dan_fullgood_red`（澄澈之律）与 `dan_major_progress`（越境凌云）在本 cohort **0 人**；
  `dan_major_progress` 需要在册 grade 事件（advance ≥ 6 且落点 ≥ 八段）才触发，134 人中无人满足。
- tier × family 模拟：18 格中 **10 格非空**，分布明显比现有 title 均衡（A 60 / B 58 / C 16）。

## 1. 134 人：6-title 分布

| presentation key | title | 人数 | 占比 | dan 等级分布 |
|---|---|---|---|---|
| dan_gold_pass | 天衡破阵 | 73 | 54.5% | 八段:41, 十段:14, 九段:14, 玄人:3, 名人:1 |
| dan_kanzui_gold | 凌霄贯律 | 43 | 32.1% | 七段:14, 十段:11, 九段:7, 八段:4, 名人:3, 玄人:3, 超人:1 |
| dan_kanzui_red | 澄境执律 | 15 | 11.2% | 九段:7, 十段:5, 玄人:3 |
| dan_fullgood_gold | 极境无瑕 | 3 | 2.2% | 达人:1, 玄人:1, 七段:1 |
| **合计** | | **134** | | |

## 2. 每个 presentation 内的 tier 混合

| presentation | A 七段~八段 | B 九段~十段 | C 玄人~达人 | tier 数 |
|---|---|---|---|---|
| dan_kanzui_gold 凌霄贯律 | 18 | 18 | 7 | 3 |
| dan_kanzui_red 澄境执律 | 0 | 12 | 3 | 2 |
| dan_fullgood_gold 极境无瑕 | 1 | 0 | 2 | 2 |
| dan_gold_pass 天衡破阵 | 41 | 28 | 4 | 3 |

## 3. 段位分布总览

| dan | tier | 人数 |
|---|---|---|
| 八段 | A 七段~八段 | 45 |
| 十段 | B 九段~十段 | 30 |
| 九段 | B 九段~十段 | 28 |
| 七段 | A 七段~八段 | 15 |
| 玄人 | C 玄人~达人 | 10 |
| 名人 | C 玄人~达人 | 4 |
| 达人 | C 玄人~达人 | 1 |
| 超人 | C 玄人~达人 | 1 |

## 4. completion family（赤系单列）

| family | mark | 人数 |
|---|---|---|
| gold_pass | mark4 | 73 |
| kanzui_gold | mark5 | 43 |
| kanzui_red | mark2 | 15 |
| full_good_gold | mark6 | 3 |

## 5. tier × completion family bucket（模拟，仅统计不写文案）

| tier | gold_pass | kanzui_gold | kanzui_red | full_good_gold | full_good_red | red_pass | 小计 |
|---|---|---|---|---|---|---|---|
| A 七段~八段 | 41 | 18 | 0 | 1 | 0 | 0 | 60 |
| B 九段~十段 | 28 | 18 | 12 | 0 | 0 | 0 | 58 |
| C 玄人~达人 | 4 | 7 | 3 | 2 | 0 | 0 | 16 |
| **合计** | **73** | **43** | **15** | **3** | **0** | **0** | **134** |

非空 bucket 数：**10**（三档 × 六族共 18 格）；当前 6 个 title 复用后实际只出现 4 个 title。

## 6. 明细（按 severity 降序）

| uid | dan | mark | severity | family | tier | presentation key | title | evidence | 现有 event |
|---|---|---|---|---|---|---|---|---|---|
| 40500773 | 达人 | 6 | 1.000 | full_good_gold | C 玄人~达人 | dan_fullgood_gold | 极境无瑕 | 达人 · 金合格全良 | 十段 mark5 (sev 0.856) |
| 84813650 | 玄人 | 6 | 0.962 | full_good_gold | C 玄人~达人 | dan_fullgood_gold | 极境无瑕 | 玄人 · 金合格全良 | 玄人 mark6 (sev 0.962) |
| 46235999 | 超人 | 5 | 0.915 | kanzui_gold | C 玄人~达人 | dan_kanzui_gold | 凌霄贯律 | 超人 · 金合格金粹 | — |
| 3843770 | 名人 | 5 | 0.903 | kanzui_gold | C 玄人~达人 | dan_kanzui_gold | 凌霄贯律 | 名人 · 金合格金粹 | — |
| 70699421 | 名人 | 5 | 0.903 | kanzui_gold | C 玄人~达人 | dan_kanzui_gold | 凌霄贯律 | 名人 · 金合格金粹 | — |
| 86541143 | 名人 | 5 | 0.903 | kanzui_gold | C 玄人~达人 | dan_kanzui_gold | 凌霄贯律 | 名人 · 金合格金粹 | — |
| 26943820 | 玄人 | 5 | 0.885 | kanzui_gold | C 玄人~达人 | dan_kanzui_gold | 凌霄贯律 | 玄人 · 金合格金粹 | — |
| 43533952 | 玄人 | 5 | 0.885 | kanzui_gold | C 玄人~达人 | dan_kanzui_gold | 凌霄贯律 | 玄人 · 金合格金粹 | — |
| 85544443 | 玄人 | 5 | 0.885 | kanzui_gold | C 玄人~达人 | dan_kanzui_gold | 凌霄贯律 | 玄人 · 金合格金粹 | 玄人 mark5 (sev 0.885) |
| 30427428 | 十段 | 5 | 0.856 | kanzui_gold | B 九段~十段 | dan_kanzui_gold | 凌霄贯律 | 十段 · 金合格金粹 | — |
| 36880568 | 十段 | 5 | 0.856 | kanzui_gold | B 九段~十段 | dan_kanzui_gold | 凌霄贯律 | 十段 · 金合格金粹 | — |
| 37203168 | 十段 | 5 | 0.856 | kanzui_gold | B 九段~十段 | dan_kanzui_gold | 凌霄贯律 | 十段 · 金合格金粹 | — |
| 49361622 | 十段 | 5 | 0.856 | kanzui_gold | B 九段~十段 | dan_kanzui_gold | 凌霄贯律 | 十段 · 金合格金粹 | — |
| 49557999 | 十段 | 5 | 0.856 | kanzui_gold | B 九段~十段 | dan_kanzui_gold | 凌霄贯律 | 十段 · 金合格金粹 | — |
| 5095139 | 十段 | 5 | 0.856 | kanzui_gold | B 九段~十段 | dan_kanzui_gold | 凌霄贯律 | 十段 · 金合格金粹 | — |
| 71753273 | 十段 | 5 | 0.856 | kanzui_gold | B 九段~十段 | dan_kanzui_gold | 凌霄贯律 | 十段 · 金合格金粹 | — |
| 71755101 | 十段 | 5 | 0.856 | kanzui_gold | B 九段~十段 | dan_kanzui_gold | 凌霄贯律 | 十段 · 金合格金粹 | — |
| 75669125 | 十段 | 5 | 0.856 | kanzui_gold | B 九段~十段 | dan_kanzui_gold | 凌霄贯律 | 十段 · 金合格金粹 | — |
| 81196122 | 十段 | 5 | 0.856 | kanzui_gold | B 九段~十段 | dan_kanzui_gold | 凌霄贯律 | 十段 · 金合格金粹 | — |
| 89301345 | 十段 | 5 | 0.856 | kanzui_gold | B 九段~十段 | dan_kanzui_gold | 凌霄贯律 | 十段 · 金合格金粹 | — |
| 84304665 | 名人 | 4 | 0.825 | gold_pass | C 玄人~达人 | dan_gold_pass | 天衡破阵 | 名人 · 金合格 | — |
| 15418899 | 玄人 | 4 | 0.808 | gold_pass | C 玄人~达人 | dan_gold_pass | 天衡破阵 | 玄人 · 金合格 | 玄人 mark4 (sev 0.808) |
| 28255423 | 玄人 | 4 | 0.808 | gold_pass | C 玄人~达人 | dan_gold_pass | 天衡破阵 | 玄人 · 金合格 | — |
| 5709784 | 玄人 | 4 | 0.808 | gold_pass | C 玄人~达人 | dan_gold_pass | 天衡破阵 | 玄人 · 金合格 | — |
| 19279238 | 九段 | 5 | 0.795 | kanzui_gold | B 九段~十段 | dan_kanzui_gold | 凌霄贯律 | 九段 · 金合格金粹 | — |
| 28565590 | 九段 | 5 | 0.795 | kanzui_gold | B 九段~十段 | dan_kanzui_gold | 凌霄贯律 | 九段 · 金合格金粹 | 玄人 mark1 (sev 0.529) |
| 61598269 | 九段 | 5 | 0.795 | kanzui_gold | B 九段~十段 | dan_kanzui_gold | 凌霄贯律 | 九段 · 金合格金粹 | — |
| 67687400 | 九段 | 5 | 0.795 | kanzui_gold | B 九段~十段 | dan_kanzui_gold | 凌霄贯律 | 九段 · 金合格金粹 | — |
| 745955 | 九段 | 5 | 0.795 | kanzui_gold | B 九段~十段 | dan_kanzui_gold | 凌霄贯律 | 九段 · 金合格金粹 | — |
| 7818439 | 九段 | 5 | 0.795 | kanzui_gold | B 九段~十段 | dan_kanzui_gold | 凌霄贯律 | 九段 · 金合格金粹 | — |
| 93195406 | 九段 | 5 | 0.795 | kanzui_gold | B 九段~十段 | dan_kanzui_gold | 凌霄贯律 | 九段 · 金合格金粹 | 九段 mark5 (sev 0.795) |
| 10948280 | 十段 | 4 | 0.782 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 十段 · 金合格 | — |
| 1245119 | 十段 | 4 | 0.782 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 十段 · 金合格 | — |
| 12803928 | 十段 | 4 | 0.782 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 十段 · 金合格 | — |
| 1833739 | 十段 | 4 | 0.782 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 十段 · 金合格 | — |
| 20889597 | 十段 | 4 | 0.782 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 十段 · 金合格 | — |
| 2107843 | 十段 | 4 | 0.782 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 十段 · 金合格 | — |
| 23842399 | 十段 | 4 | 0.782 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 十段 · 金合格 | 十段 mark4 (sev 0.782) |
| 27176720 | 十段 | 4 | 0.782 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 十段 · 金合格 | — |
| 28020720 | 十段 | 4 | 0.782 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 十段 · 金合格 | — |
| 34727379 | 十段 | 4 | 0.782 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 十段 · 金合格 | — |
| 39009450 | 十段 | 4 | 0.782 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 十段 · 金合格 | — |
| 41799573 | 十段 | 4 | 0.782 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 十段 · 金合格 | — |
| 47279977 | 十段 | 4 | 0.782 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 十段 · 金合格 | 八段 mark4 (sev 0.650) |
| 83478854 | 十段 | 4 | 0.782 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 十段 · 金合格 | — |
| 10826570 | 九段 | 4 | 0.726 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 九段 · 金合格 | — |
| 16003598 | 九段 | 4 | 0.726 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 九段 · 金合格 | 十段 mark1 (sev 0.512) |
| 24335742 | 九段 | 4 | 0.726 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 九段 · 金合格 | — |
| 31393557 | 九段 | 4 | 0.726 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 九段 · 金合格 | 九段 mark4 (sev 0.726) |
| 37082521 | 九段 | 4 | 0.726 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 九段 · 金合格 | — |
| 44659325 | 九段 | 4 | 0.726 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 九段 · 金合格 | — |
| 64026330 | 九段 | 4 | 0.726 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 九段 · 金合格 | — |
| 70215519 | 九段 | 4 | 0.726 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 九段 · 金合格 | — |
| 72066242 | 九段 | 4 | 0.726 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 九段 · 金合格 | 五段 mark4 (sev 0.411) |
| 73051366 | 九段 | 4 | 0.726 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 九段 · 金合格 | 九段 mark4 (sev 0.726) |
| 79056510 | 九段 | 4 | 0.726 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 九段 · 金合格 | — |
| 83649264 | 九段 | 4 | 0.726 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 九段 · 金合格 | 十段 mark1 (sev 0.512) |
| 84888931 | 九段 | 4 | 0.726 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 九段 · 金合格 | — |
| 91797564 | 九段 | 4 | 0.726 | gold_pass | B 九段~十段 | dan_gold_pass | 天衡破阵 | 九段 · 金合格 | 十段 mark1 (sev 0.512) |
| 11236777 | 八段 | 5 | 0.711 | kanzui_gold | A 七段~八段 | dan_kanzui_gold | 凌霄贯律 | 八段 · 金合格金粹 | 八段 mark5 (sev 0.711) |
| 22724944 | 八段 | 5 | 0.711 | kanzui_gold | A 七段~八段 | dan_kanzui_gold | 凌霄贯律 | 八段 · 金合格金粹 | — |
| 39896983 | 八段 | 5 | 0.711 | kanzui_gold | A 七段~八段 | dan_kanzui_gold | 凌霄贯律 | 八段 · 金合格金粹 | — |
| 62998770 | 八段 | 5 | 0.711 | kanzui_gold | A 七段~八段 | dan_kanzui_gold | 凌霄贯律 | 八段 · 金合格金粹 | — |
| 32094706 | 玄人 | 2 | 0.654 | kanzui_red | C 玄人~达人 | dan_kanzui_red | 澄境执律 | 玄人 · 赤合格金粹 | — |
| 7049369 | 玄人 | 2 | 0.654 | kanzui_red | C 玄人~达人 | dan_kanzui_red | 澄境执律 | 玄人 · 赤合格金粹 | — |
| 77881743 | 玄人 | 2 | 0.654 | kanzui_red | C 玄人~达人 | dan_kanzui_red | 澄境执律 | 玄人 · 赤合格金粹 | — |
| 66792598 | 七段 | 6 | 0.651 | full_good_gold | A 七段~八段 | dan_fullgood_gold | 极境无瑕 | 七段 · 金合格全良 | — |
| 10231293 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | — |
| 12559597 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | 十段 mark1 (sev 0.512) |
| 16785484 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | 八段 mark4 (sev 0.650) |
| 18572514 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | 八段 mark4 (sev 0.650) |
| 20041443 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | 八段 mark4 (sev 0.650) |
| 20691292 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | — |
| 21911849 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | 八段 mark4 (sev 0.650) |
| 25750658 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | 八段 mark4 (sev 0.650) |
| 26256253 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | — |
| 26942676 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | — |
| 27041479 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | — |
| 35181154 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | — |
| 41798218 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | — |
| 45088800 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | — |
| 50080709 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | — |
| 50243859 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | 八段 mark4 (sev 0.650) |
| 51292991 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | — |
| 53834953 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | — |
| 56365790 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | — |
| 56717780 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | — |
| 61767489 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | 九段 mark2 (sev 0.587) |
| 61823959 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | — |
| 64495640 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | — |
| 70176327 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | — |
| 75132580 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | — |
| 78660342 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | — |
| 79697507 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | — |
| 80089342 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | 八段 mark4 (sev 0.650) |
| 81449295 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | 八段 mark4 (sev 0.650) |
| 86338672 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | — |
| 86842588 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | 名人 mark1 (sev 0.540) |
| 89630905 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | 八段 mark4 (sev 0.650) |
| 92349437 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | 八段 mark4 (sev 0.650) |
| 93231266 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | — |
| 94969660 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | — |
| 95803682 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | 八段 mark4 (sev 0.650) |
| 98514346 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | — |
| 99159316 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | — |
| 99232636 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | 八段 mark4 (sev 0.650) |
| 99537254 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | — |
| 99857710 | 八段 | 4 | 0.650 | gold_pass | A 七段~八段 | dan_gold_pass | 天衡破阵 | 八段 · 金合格 | 八段 mark4 (sev 0.650) |
| 25289724 | 十段 | 2 | 0.633 | kanzui_red | B 九段~十段 | dan_kanzui_red | 澄境执律 | 十段 · 赤合格金粹 | — |
| 29694104 | 十段 | 2 | 0.633 | kanzui_red | B 九段~十段 | dan_kanzui_red | 澄境执律 | 十段 · 赤合格金粹 | — |
| 72068254 | 十段 | 2 | 0.633 | kanzui_red | B 九段~十段 | dan_kanzui_red | 澄境执律 | 十段 · 赤合格金粹 | — |
| 74957968 | 十段 | 2 | 0.633 | kanzui_red | B 九段~十段 | dan_kanzui_red | 澄境执律 | 十段 · 赤合格金粹 | — |
| 94317881 | 十段 | 2 | 0.633 | kanzui_red | B 九段~十段 | dan_kanzui_red | 澄境执律 | 十段 · 赤合格金粹 | — |
| 11474725 | 七段 | 5 | 0.599 | kanzui_gold | A 七段~八段 | dan_kanzui_gold | 凌霄贯律 | 七段 · 金合格金粹 | — |
| 18644736 | 七段 | 5 | 0.599 | kanzui_gold | A 七段~八段 | dan_kanzui_gold | 凌霄贯律 | 七段 · 金合格金粹 | — |
| 27214979 | 七段 | 5 | 0.599 | kanzui_gold | A 七段~八段 | dan_kanzui_gold | 凌霄贯律 | 七段 · 金合格金粹 | 七段 mark5 (sev 0.599) |
| 36694302 | 七段 | 5 | 0.599 | kanzui_gold | A 七段~八段 | dan_kanzui_gold | 凌霄贯律 | 七段 · 金合格金粹 | 五段 mark4 (sev 0.411) |
| 40046676 | 七段 | 5 | 0.599 | kanzui_gold | A 七段~八段 | dan_kanzui_gold | 凌霄贯律 | 七段 · 金合格金粹 | — |
| 41746616 | 七段 | 5 | 0.599 | kanzui_gold | A 七段~八段 | dan_kanzui_gold | 凌霄贯律 | 七段 · 金合格金粹 | — |
| 42207207 | 七段 | 5 | 0.599 | kanzui_gold | A 七段~八段 | dan_kanzui_gold | 凌霄贯律 | 七段 · 金合格金粹 | — |
| 52713297 | 七段 | 5 | 0.599 | kanzui_gold | A 七段~八段 | dan_kanzui_gold | 凌霄贯律 | 七段 · 金合格金粹 | — |
| 60774949 | 七段 | 5 | 0.599 | kanzui_gold | A 七段~八段 | dan_kanzui_gold | 凌霄贯律 | 七段 · 金合格金粹 | — |
| 72076388 | 七段 | 5 | 0.599 | kanzui_gold | A 七段~八段 | dan_kanzui_gold | 凌霄贯律 | 七段 · 金合格金粹 | — |
| 85815378 | 七段 | 5 | 0.599 | kanzui_gold | A 七段~八段 | dan_kanzui_gold | 凌霄贯律 | 七段 · 金合格金粹 | 五级 mark6 (sev 0.013) |
| 92870552 | 七段 | 5 | 0.599 | kanzui_gold | A 七段~八段 | dan_kanzui_gold | 凌霄贯律 | 七段 · 金合格金粹 | — |
| 94859510 | 七段 | 5 | 0.599 | kanzui_gold | A 七段~八段 | dan_kanzui_gold | 凌霄贯律 | 七段 · 金合格金粹 | 八段 mark1 (sev 0.425) |
| 95337667 | 七段 | 5 | 0.599 | kanzui_gold | A 七段~八段 | dan_kanzui_gold | 凌霄贯律 | 七段 · 金合格金粹 | — |
| 15129540 | 九段 | 2 | 0.587 | kanzui_red | B 九段~十段 | dan_kanzui_red | 澄境执律 | 九段 · 赤合格金粹 | — |
| 53628801 | 九段 | 2 | 0.587 | kanzui_red | B 九段~十段 | dan_kanzui_red | 澄境执律 | 九段 · 赤合格金粹 | — |
| 6487713 | 九段 | 2 | 0.587 | kanzui_red | B 九段~十段 | dan_kanzui_red | 澄境执律 | 九段 · 赤合格金粹 | — |
| 66264495 | 九段 | 2 | 0.587 | kanzui_red | B 九段~十段 | dan_kanzui_red | 澄境执律 | 九段 · 赤合格金粹 | — |
| 73920246 | 九段 | 2 | 0.587 | kanzui_red | B 九段~十段 | dan_kanzui_red | 澄境执律 | 九段 · 赤合格金粹 | 九段 mark2 (sev 0.587) |
| 77165828 | 九段 | 2 | 0.587 | kanzui_red | B 九段~十段 | dan_kanzui_red | 澄境执律 | 九段 · 赤合格金粹 | — |
| 84835414 | 九段 | 2 | 0.587 | kanzui_red | B 九段~十段 | dan_kanzui_red | 澄境执律 | 九段 · 赤合格金粹 | — |


## 7. 单独建议表

### A. 现有 26 名 strongDan：改用 max-severity 口径后 presentation 变化

只有 **3 人**变化（其余 23 人事件即等于当前版本 best，呈现不变）：

| uid | 现 presentation | 现 evidence | severity | 新 selection | 新 presentation | 新 evidence | 新 severity |
|---|---|---|---|---|---|---|---|
| 40500773 | 凌霄贯律 `dan_kanzui_gold` | 十段 · 金合格金粹 | 0.856 | 达人 mark6 | 极境无瑕 `dan_fullgood_gold` | 达人 · 金合格全良 | 1.000 |
| 47279977 | 天衡破阵 `dan_gold_pass` | 八段 · 金合格 | 0.650 | 十段 mark4 | 天衡破阵 `dan_gold_pass` | 十段 · 金合格 | 0.782 |
| 61767489 | 澄境执律 `dan_kanzui_red` | 九段 · 赤合格金粹 | 0.587 | 八段 mark4 | 天衡破阵 `dan_gold_pass` | 八段 · 金合格 | 0.650 |

注：`47279977` 的 title 不变、只有证据行段位从八段变十段；`61767489` 连 title 一起变。

### B. gate 扩容到 134 人后：现有 6-title 是否失衡

- 失衡，而且是「头重」型：`dan_gold_pass` 一家占 54.5%，`dan_kanzui_gold` 占 32.1%，两者合计 86.6%；
  剩下的 `dan_kanzui_red` 11.2%、`dan_fullgood_gold` 2.2%，另两个 0%。
- 更关键的是**同一 title 内段位跨度极大**：`天衡破阵`(73) 从八段(41) 一路到名人(1)；
  `凌霄贯律`(43) 从七段(14) 到超人(1)。标题本身不承载段位信息，段位只落在证据行，
  所以 134 人里会出现大量「同一句标题 + 只有段位不同」的重复观感。
- 按 tier × family 分桶后有 10 个非空 bucket（A: 41/18/0/1、B: 28/18/12/0、C: 4/7/3/2），
  即使只按「tier × family」粗分，分布也远比现有 4 个 title 均匀；这是后续是否扩 gate 的关键依据。

## 8. 本轮未做

未修改代码、未新增或改写任何 title 文案、未调整 severity 公式与 0.55 阈值、未扩 gate、未动 schema / UI / locale。
