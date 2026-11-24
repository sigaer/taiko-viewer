# Rhythm and Music Theory

`DEFINITION` 若BPM所指拍为四分音符，一拍时长为`60/BPM`秒；4/4小节为`240/BPM`秒，`MEASURE a/b`相对4/4的小节倍率为`a/b`。这些是音乐坐标公式，实际谱面命令生效位置必须由指定解析器契约确认。

`PROJECT` 本批静态timeline按小节内槽位分段积分BPM：`dt = 槽位跨度 / 槽位总数 × 240000 × measureRatio / BPM`。DELAY以秒记录，在其边界只加一次。小节内MEASURE在候选parser中作用到下一小节；这是已固定的实现/fixture语义，其他模拟器方言应单列。

手算：BPM120，8槽的第0与第4槽间隔1000ms；第2槽变为240后是`2×250 + 2×125 = 750ms`；这一区间增加1秒DELAY后为2000ms。负DELAY允许产生较小的相对间隔；倒序或非有限timeline必须诊断，不能直接修正成看似合理值。

相对音符间隔、谱面内部累计时间、相对音乐播放的绝对对齐是三种契约。OFFSET不改变相对间隔；候选Golden仅证明这一不变量。绝对音频对齐需要明确OFFSET符号、音频头/静音、起点、时钟和实际资源hash，本批全部标记UNVERIFIED，不以`chartTime + OFFSET`冒充已验证音乐时间。

`EXPERIENCE` 玩家常用8分、16分、三连音、切分、休止、换拍描述节奏；同一平均密度下，这些结构可能带来不同认知负荷。`HYPOTHESIS` 节奏处理难度需要局部音符序列和乐句上下文，而不是只看BPM变化次数。

分支静态N/E/M可分别生成timeline；实际分支选择、SECTION状态、LEVELHOLD、阈值判定与音频共用时间轴需要动态模拟和独立oracle。当前不能从某条静态路径推导真实玩家所有游玩事件。
