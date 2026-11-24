# Taiko Domain Knowledge Primer

日期：2026-11-24。此目录是知识与验证基础，不包含 Taiko Agent 推理、训练或新的推荐引擎。

每条知识必须分级：`OFFICIAL` 为所列平台/版本的官方资料；`PROJECT` 为本系统明确产品约定或可复现源码事实；`EXPERIENCE` 为玩家经验，不能写成普适定律；`HYPOTHESIS` 为需要语料/专家/实测验证的命题。音乐时值公式标为 `DEFINITION`。转载攻略、模拟器代码和本系统评分不是官方规则。

| 文档 | 范围 |
|---|---|
| [Gameplay Fundamentals](gameplay-fundamentals.md) | 音符、判定、难度与地区/平台 |
| [Scoring and Goals](scoring-and-goals.md) | 分数、准确度、过关/FC/全良、模型版本 |
| [Rhythm and Music Theory](rhythm-and-music-theory.md) | BPM、小节、细分、DELAY/OFFSET与时间坐标 |
| [Chart Patterns and Playability](chart-patterns-and-playability.md) | 配色、复合、长音符、分支、可读性 |
| [Player Behavior](player-behavior.md) | 成绩观察、导入、缺失、学习与偏好 |
| [Recommendation Principles](recommendation-principles.md) | 资格、目标、解释、评价边界 |
| [Expert Chart Cases](expert-chart-cases.md) | 手算案例与待专家复核真实曲例 |

来源阅读日为2026-11-24。官方入门：[街机版 How to Play](https://taiko.namco-ch.net/taiko/en/howto/)、[官方街机首页](https://taiko.namco-ch.net/taiko/en/index.php)。官方首页明确地区/店铺可玩差异，因此不能用国际目录证明国行上架。

实现方资料：[OpenTaiko changelog](https://github.com/0auBSQ/OpenTaiko/blob/main/CHANGELOG.md) 是模拟器实现的一手记录，包含compatibility modes和OFFSET/LEVELHOLD相关修正；它不构成Bandai官方TJA标准。本系统固定的vendored parser/hash与全量语料见 [Batch2 Timeline](../../catalog-release-batch2-20261124/timeline/README.md)。后续引用这些资料时保存页面/commit版本，不能以可变main链接代替构建溯源。

知识新增模板：`claimId / 陈述 / 分级 / 适用平台-地区-版本 / sourceURL或源码commit+行 / 证据日期 / 反例 / 验证状态 / golden关联 / reviewer`。未有专家签字的曲例只能是候选案例；未有人类标注的模型维度不能被称作客观能力真值。

B2.1 项目约定：国行当前目录唯一来源为完整成功的 Wahlap 官方 Song API，其他曲库只提供身份/元数据/资源/分析输入；候选中央 Snapshot 与五项策略见 [Source Contract](../../wahlap-authority-b21-20261124/wahlap-source-contract.md)。这是本系统权威边界，不是 Bandai 对 TJA 或评分规则的通用标准。
