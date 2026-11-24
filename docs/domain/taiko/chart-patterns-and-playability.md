# Chart Patterns and Playability

`PROJECT` 分析前必须固定source hash、chart association、COURSE、parser版本与能力范围。单首总音符数只是一种统计：分支按路径分别计数；大音符保留类型；roll/balloon分别保留起止与metadata，不并入普通note count。

`EXPERIENCE` 玩家常按单色连续、红蓝交替、奇数/偶数簇、长复合、短爆发、持续密度、变速/视觉滚动、节奏空拍描述谱面。配色与起手可能改变动作组织；不同玩家惯用手、设备和读谱习惯不同，不能把某种手顺当作唯一正确答案。

`HYPOTHESIS` 峰值局部密度、连续高负荷时长、休息窗口和配色切换能够补充平均密度。它们需要明确窗口、单位、长音符处理、分支策略与专家标注。当前不产生新的难度评分或训练推荐算法。

`PROJECT` 连打时长、气球要求hit数、大音符与combo统计分别输出。重复长音符标记、孤立终点、未闭合span产生diagnostic，不能被扫描器擅自归一化后宣称正确。此次大批`LONG_NOTE_OVERLAP`是审查线索，可能涉及源格式、parser展开或扫描解释边界，尚未逐曲归因。

静态可解析不保证可玩：屏幕滚动、音频对齐、实际分支与控制器约束未包含在静态note gap里。`chart_analysis_eligible(capability)`必须按具体请求能力判断；PARTIAL不等于原谱坏，也不等于整首禁止显示。
