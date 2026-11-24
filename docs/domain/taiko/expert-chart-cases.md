# Expert Chart Cases — 案例基础，待专家复核

此页区分手算oracle与真实曲例。当前没有人类专家签字，不把“Expert”目录标题当作已完成专家评审。

| case | 可复现证据 | 已证明 / 未证明 |
|---|---|---|
| 固定BPM / 小节内BPM | 合成8槽，第0→4槽，120→240 | 相对gap1000→750ms；不证明音频同步 |
| DELAY正负小数 | 同8槽，+1秒或-.25秒 | gap2000或750ms；不是把`.25`解析成25秒 |
| MEASURE / 大音符 | 3/4小节、3/4音符类型 | gap750ms；类型保留、普通note count仍独立 |
| Roll / Balloon | Golden corpus中自编谱，气球metadata5 | 保留长音符起止/要求；不推导实际连打hit与玩家能力 |
| N/E/M与LEVELHOLD | 既有`tjaTimeline.test.mjs`独立路径oracle与全量诊断 | 静态路径；动态分支选择/LEVELHOLD仍UNVERIFIED |

真实曲例的source路径、hash、COURSE、每路径note count/大音符/roll/balloon/时长与诊断在[expert-case-evidence.json](../../catalog-release-batch2-20261124/timeline/expert-case-evidence.json)。选取包含Tenjiku、Donkama、Yokuderu、Clotho的语料作为复核候选，不在缺少专家证据时给它们贴“体力谱/技术谱/必练谱”等标签。

专家复核应逐例确认：文件与实际版本一致？COURSE身份一致？分支口径是什么？长音符重复标记怎样解释？局部节奏/配色瓶颈在哪里？候选分析是否保留原文位置与hash？绝对音频对齐是否经过实测？每条评语保存依据、反例、reviewer与日期，才能晋升EXPERIENCE或已验证事实。
