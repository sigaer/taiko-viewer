# Dan Strength V4.1 — Release Design Audit（只读，未改生产代码）

## 1. Formula consistency（裁定：脚本对、报告错）

脚本的真实表达式（`/tmp/dan-audit/v4_model2.py`，与冻结的 audit matrix 完全一致）：

```python
def gold_premium(d): return (0.17 + 0.14*((d-12)/7)) * DANBASE[d]
def k6(d):           return 3.744 + 0.016*(d-12)
def kr(d):           return 0.40  + 0.02 *(d-12)
def bonus(d):        P = gold_premium(d); return {1:0, 2:0.10*P, 3:kr(d)*P, 4:P, 5:P+0.10*P, 6:P+k6(d)*P}
def strength(d, m):  return DANBASE[d] + bonus(d)[m]
```

因此：

- `金虹合格 = danBase + (P + k6·P) = 金合格 + k6·goldPremium` —— **报告写的公式结构正确**；
- 但 **报告写的 `k6 = 4.70` 与冻结矩阵不符**：由导出矩阵反解得 `k6(七段) = 3.744`、每段 +0.016（`3.744 → 3.856`）。报告里的 4.70 是中间试算值，从未进入冻结版本。
- **赤虹 = danBase + kr·goldPremium**（`kr = 0.40 → 0.54`）；报告里「赤虹 premium 0.085→0.303」也写错了，正确是 **0.085 → 0.544**（与表格里达人 0.544 自洽）。

数值核对：`七段 金虹 = danBase 1.25 + bonus 1.0081 = 2.2581`；等价写法 `金合格 1.46 + 3.744×0.2125 = 2.2581` ✅。

### 1.1 新增断言（本次已跑通）

```
ASSERT computed matrix == exported audit matrix (七段~达人):        PASS
ASSERT 金虹 == 金合格 + k6·premium（赤虹 == danBase + kr·premium）:  PASS
ASSERT 报告写的 金虹 = danBase + k6·premium:                        FAIL(2.046 vs 2.258)  # 报告公式错
ASSERT 报告写的 k6 = 4.70:                                          FAIL(frozen 3.744)
```

### 1.2 报告文字勘误

- 「赤虹 premium 0.085→0.303」→ **0.085 → 0.544**（数值参数不变，只是报告算术错）
- 「七段金虹 2.26 低于九段赤合格 1.65 之上」方向写反 → 正确：**七段金虹 2.258 > 九段赤合格 1.65**，但 **< 十段赤合格 1.90**（即落在玄人赤合格 2.15 与名人赤合格 2.45 之间，正好贴合 anchor band）

## 2. Freeze V4（确认冻结）

| 冻结项 | 值 |
|---|---|
| canonical 术语 | mark0 未合格 / 1 赤合格 / 2 赤合格金粹 / 3 赤虹合格 / 4 金合格 / 5 金粹金合格 / 6 金虹合格 |
| danBase | 七段 1.25 → 达人 3.25（piecewise accelerating，step +0.20…+0.45） |
| goldPremium | (0.17+0.14t)·danBase，七段 0.2125 → 达人 1.0075 |
| kanzui premium | 0.10·goldPremium（七段 0.030 → 达人 0.141） |
| red rainbow | kr(dan)·goldPremium，kr = 0.40+0.02(dan-12) |
| gold rainbow | k6(dan)·goldPremium，k6 = 3.744+0.016(dan-12) |
| 排序 | current-version strength 全序，无 V5 |

本轮不再调参；下文全部基于冻结值。

## 3~4. Candidate domain 与选择

- domain：`current-version levelList` 中 **dan ≥ 七段 且 mark ≥ 1**（五级~六段保留原始成绩但不参与竞争，因此不需要给低段位金虹加 cap）
- `currentVersionBest = argmax(strength, dan_id, mark)`，确定性 tie-break：先 strength、再 dan、再 mark

- 全量账号（含段位记录）：1305；其中存在 dan ≥ 七段 且 mark ≥ 1 记录：**537**

## 5. Gate

```
threshold = strength(十段, 赤合格) = 1.9000
strongDan = currentVersionBest exists AND currentVersionBest.strength >= threshold
```

- 旧覆盖（observed-event 规则，V2 审计）：**26 人**
- 新覆盖（V4.1 gate）：**124 人**

语义自然形成情况（实测）：

| 段位 | 能进入 gate 的 family | 实测人数 |
|---|---|---|
| 七段 | gold_rainbow | 1 |
| 八段 | — | 0 |
| 九段 | gold | 16 |
| 十段 | gold, red | 47 |
| 玄人 | gold, gold_rainbow, red | 30 |
| 名人 | gold, red | 17 |
| 超人 | gold, red | 12 |
| 达人 | gold_rainbow | 1 |

与产品预期一致：七/八段只有 gold_rainbow 能进（八段金虹 strength 1.89 < 1.90，实测 0 人）；九段 gold / gold_rainbow；十段及以上任意有效合格。

## 7. Title bucket（dan × family，dan 不合并）

| bucket | users | sample uid | representative evidence |
|---|---|---|---|
| 十段 × red | 34 | 12559597 | 十段 · 赤合格 |
| 玄人 × red | 25 | 10071618 | 玄人 · 赤合格 |
| 九段 × gold | 16 | 10826570 | 九段 · 金合格 |
| 十段 × gold | 13 | 10948280 | 十段 · 金合格 |
| 名人 × red | 12 | 17899708 | 名人 · 赤合格 |
| 超人 × red | 10 | 11435401 | 超人 · 赤合格 |
| 名人 × gold | 5 | 3843770 | 名人 · 金粹金合格 |
| 玄人 × gold | 4 | 15418899 | 玄人 · 金合格 |
| 超人 × gold | 2 | 46235999 | 超人 · 金粹金合格 |
| 七段 × gold_rainbow | 1 | 66792598 | 七段 · 金虹合格 |
| 玄人 × gold_rainbow | 1 | 84813650 | 玄人 · 金虹合格 |
| 达人 × gold_rainbow | 1 | 40500773 | 达人 · 金虹合格 |

理论上限 **24** 个 strongDan title（七段/八段各 1，九段 2，十段~达人各 4）；当前 population 覆盖 **12** 个。

当前 population = 0 但未来合法的 bucket（12 个）：八段 × gold_rainbow、九段 × gold_rainbow、十段 × red_rainbow、十段 × gold_rainbow、玄人 × red_rainbow、名人 × red_rainbow、名人 × gold_rainbow、超人 × red_rainbow、超人 × gold_rainbow、达人 × red、达人 × red_rainbow、达人 × gold。

## 10. Overlay 影响（45-key ordinary FinalTitle 不改）

- 旧 strongDan 覆盖：26；新覆盖：124；交集 **10**；**新增 114**；**退出 16**
- 退出的 16 人全部是「八段 金合格/金粹金合格」型（八段最高 strength 1.73 < 1.90），他们在旧规则下靠 observed event 拿到 presentation，在新 gate 下不再达标：

| uid | V4 currentVersionBest | strength |
|---|---|---|
| 11236777 | 八段系（旧事件 dan 13 m5） | < 1.90 |
| 16785484 | 八段系（旧事件 dan 13 m4） | < 1.90 |
| 18572514 | 八段系（旧事件 dan 13 m4） | < 1.90 |
| 20041443 | 八段系（旧事件 dan 13 m4） | < 1.90 |
| 21911849 | 八段系（旧事件 dan 13 m4） | < 1.90 |
| 25750658 | 八段系（旧事件 dan 13 m4） | < 1.90 |
| 27214979 | 八段系（旧事件 dan 12 m5） | < 1.90 |
| 50243859 | 八段系（旧事件 dan 13 m4） | < 1.90 |
| 61767489 | 八段系（旧事件 dan 14 m2） | < 1.90 |
| 73920246 | 八段系（旧事件 dan 14 m2） | < 1.90 |
| 80089342 | 八段系（旧事件 dan 13 m4） | < 1.90 |
| 81449295 | 八段系（旧事件 dan 13 m4） | < 1.90 |
| 92349437 | 八段系（旧事件 dan 13 m4） | < 1.90 |
| 95803682 | 八段系（旧事件 dan 13 m4） | < 1.90 |
| 99232636 | 八段系（旧事件 dan 13 m4） | < 1.90 |
| 99857710 | 八段系（旧事件 dan 13 m4） | < 1.90 |

需要产品确认：这 16 人是否接受「不再显示 strongDan 大称号」（其 ordinary FinalTitle 与 breakthrough flash 不变）。

保留在交集里的 10 人，presentation/evidence 全部由「event dan」改为「current-version best」：

| uid | 旧 presentation（event） | 新 presentation（current best） |
|---|---|---|
| 15418899 | 玄人 · 金合格 (dan_gold_pass) | 玄人 · 金合格 |
| 23842399 | 十段 · 金合格 (dan_gold_pass) | 超人 · 赤合格金粹 |
| 31393557 | 九段 · 金合格 (dan_gold_pass) | 九段 · 金合格 |
| 40500773 | 十段 · 金粹金合格 (dan_kanzui_gold) | **达人 · 金虹合格** |
| 47279977 | 八段 · 金合格 (dan_gold_pass) | 十段 · 金合格 |
| 73051366 | 九段 · 金合格 (dan_gold_pass) | 九段 · 金合格 |
| 84813650 | 玄人 · 金虹合格 (dan_fullgood_gold) | 玄人 · 金虹合格 |
| 85544443 | 玄人 · 金粹金合格 (dan_kanzui_gold) | 超人 · 赤合格金粹 |
| 89630905 | 八段 · 金合格 (dan_gold_pass) | 十段 · 赤合格 |
| 93195406 | 九段 · 金粹金合格 (dan_kanzui_gold) | 九段 · 金粹金合格 |

## 8. Evidence 术语（canonical，已锁定）

Evidence 形如 `{dan} · {canonical completion}`，例如 `达人 · 金虹合格`、`十段 · 金粹金合格`、`玄人 · 金合格`。
**禁止**：全连金合格 / 全良金合格 / 金合格全连 / 金合格全良。

## 9. Finale 语义

- breakthrough flash = observed event（不变，**不把 event.dan 改写成 current dan**）
- strongDan 主区域 = current-version best achievement（用 V4 strength）
- 点名校验：`40500773 → 达人 · 金虹合格 (8.142)` ✅；`49557999 → 玄人 · 金合格 (2.688)` ✅；`66792598 → 七段 · 金虹合格 (2.258)` ✅

## 11. 发布建议（仅建议，未执行）

- gate / candidate 域 / presentation 语义均发生变化 → 落地时 bump **annual algorithm version `v4.4.0 → v4.5.0`**（候选）。
- 需要 locale 新增/调整 24 个 strongDan title 槽位（当前只需 12 个 bucket 有文案，其余可留待有 population 时再补，但键位建议一次定义好）。
- 不清 cache、不部署、不改 45-key ordinary FinalTitle。

## 12. 本轮未做

未改生产代码（generator / locale / schema / Viewer / 45-key model），未部署，未清缓存。
