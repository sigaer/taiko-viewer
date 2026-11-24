# Scoring and Goals

`PROJECT` 本系统区分通关、全连（FC）、全良（Dondaful）、指定分数、Rank与NG减少。不能把提高分数等价为更稳定地全连；长连打/气球收益、判定构成和计分模式需要分开解释。原始良/可/不可、combo、clear/FC/DF累计值缺字段时保持未知，不自行补零证明成就。

`OFFICIAL` [Donkatsu Cup 2025/2026官方规则](https://taiko-esp.taiko-ch.net/2025_2026/)在指定Switch赛事中明确计分模式为真打，并另列良、可、最大combo、连打等同分判定依据。这证明“成绩比较需要游戏与计分模式语境”；不能把该赛事规则泛化为所有街机版本或全平台固定配点公式。

`PROJECT` Viewer Rating及六维属于本项目算法输出，不是官方星级/官方段位/人的能力真值。公共维度词汇为 `rating, big_song, stamina, speed, accuracy_power, rhythm, complex`；进入Core边界时大歌力转为`daigouryoku`，公开API不泄漏内部别名。

`PROJECT` 目标必须绑定chartId、difficulty、区域、算法/模型版本、catalogRevision和观测时间。历史成绩保留原source association，不因下架丢弃。Weekly允许跨算法比较，保留首尾值和差值，并标明期间模型改变；不能把该差值全部解释成玩家成长。

`EXPERIENCE` 分数目标与稳定性目标可以交替使用，单次PB不等于已经稳定掌握。`HYPOTHESIS` 最合适的目标跨度与练习轮数取决于个人、设备、近期状态和目标类型；当前没有足够校准证据输出精确成功概率或“几天必达”。

验证需求：独立计分资料与平台版本；长音符hit上限与分支取值；真实多次尝试的变异；模型改版的独立影响。此批没有重写Rating公式。
