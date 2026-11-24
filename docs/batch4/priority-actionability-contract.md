# Priority 与 Actionability

新增契约 `viewer-multi-objective/1`。基线与状态见 [总契约](recommendation-intent-contract.md)。现有 `viewer-stable-match/1` 不改动；它的 eligible 不能直接替代本契约三态。

## 组别与三态

| 组 | 正式名称 | 条件 |
| --- | --- | --- |
| A | Priority / 优先尝试 | 非长期动作，专用证据充分，满足下述最终展示门槛；用户高优先级只能在合格集合内提序 |
| B | Worth Improving / 值得提升 | 有具体改善/练习/探索收益，ready_now 或 reasonable_stretch；因容量、重复控制或偏好未入 A；不是存放未知证据的兜底组 |
| C | Long-term Challenge / 长期挑战 | target 的 `horizon=long_term`，目标有效且有可解释路径/差距；readiness 可为任一态，但 not_actionable 必须保留缺项，不承诺当前可达 |
| D | Discovery / 自由探索 | 可用谱面的自由查看/探索，明确证据不足或低相关性；不限于 discovery 类型；不可用谱面只留 Goal 管理/诊断，不充当可玩推荐 |

`ready_now`：当前具体动作满足已注册专用证据门槛，系统有理由建议现在尝试；不保证成功。

`reasonable_stretch`：关键语义、身份、可用性完整，达到专用 stretch 门槛；仍有明确且有界的差距。缺核心证据不能改名 stretch。

`not_actionable`：不满足上述两者，包括证据未知、过期、语义不明、目标不可支持或过远。它不等于玩家无能力。错误身份/非法 target 从候选集合拒收，而不是装进 D；已达标目标进入 Goal 评估，不重复推荐同一达标动作。

## A 组硬规则

N 是**最终实际展示的 A 卡片数**，在 Chart 聚合、歌曲去重、过滤、分页和可见性确认之后计数。每卡仅一个明确 `primaryCandidateId` / primary action，按其 readiness 计数，不按 Goal 数量计数。

```text
N = |displayed A cards|
R = |cards whose primary readiness is ready_now|
S = |cards whose primary readiness is reasonable_stretch|
R >= ceil(N * 0.5)
R + S = N
all primary targets.horizon == near_term
```

因此 N ≤ 2R。not_actionable 与 long_term 零容忍。合格候选不足则减少 N，允许空组；不得降低阈值、制造 ready、重复卡片或用多样性名义补足。70% 是内部优化目标：先达到 50% 硬门槛，再在合法解中偏好 R/N≥0.7；不能对外称“70%成功率”。N=0 时 gate 合法为空，rate=`null/not_applicable`，不是 100%。

| N | 最少 R | 反例 |
| --- | --- | --- |
| 0 | 0 | 只报空组原因，不记成功 |
| 1 | 1 | 单 stretch 不可独占 A |
| 2 | 1 | 0 ready + 2 stretch 不合格 |
| 3 | 2 | 1 ready + 2 stretch 不合格 |
| 5 | 3 | 2 ready + 3 stretch 不合格 |

不能在一个组总体合格后随意截取子集。任何页面/折叠/实验都必须重验，流式展示按 ready 优先序形成每个前缀均合格的安全单元。用户隐藏一张 ready 卡时，剩余 stretch 必须同步移出 A 或补入已合格 ready；未能原子更新的曝光记录仍按实际情况记录 violation，不能回写日志抹除违规。真正曝光门槛见 [事件协议](evaluation-and-event-contract.md)。

## 多 Goal 聚合的裁决

同 Chart 的 score Goal ready、DF Goal not_actionable 时：可以用 score 动作作为 A 主动作；DF 只能作为独立状态的关联 Goal 展开，不能显示“本卡所有目标优先达成”。A 分母只计主动作一次。若想把 DF 变成主动作，重新评估并重新分组。不能把多个 Goal 的判定字段拼成一个充分证据。

长期 DF Goal 不能因附着在 ready score 卡上成为 A 的 actionable Goal。C 的长期候选不作为 A 主动作；若给同任务创建近期开练动作，必须另有具体 target/requirement，且不能将该动作的可执行性外推为完整任务可达。

## 三个不能互换的结果

| 概念 | 问题 | 数据 |
| --- | --- | --- |
| System Actionability | 当前系统证据是否足以支持该动作？ | 决策时专用 evaluator、最终展示卡、readiness |
| User Acceptance | 用户是否明确接受这次建议？ | 展示之后的显式 accept 事件；点击/浏览不算 |
| Goal Achievement | 后续证据是否满足独立 Goal 的完成规则？ | 用户接受后冻结 baseline，权威 observation 与专用 Goal evaluator |

50% 是第一行的产品硬底线，绝不是“至少一半真实玩家能达成”。无真实可识别游玩标签时，不能以系统通过率替代效果。组别与类型独立的必要反例：discovery 可 A 或 D；challenge 可 A（当前要求）或 C（长期任务）；Personal Goal 可以完全不产生 A 候选。
