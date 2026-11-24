# Full TJA Corpus Scan / Canonical Chart Timeline Baseline

完整语料为2990份ESE原始TJA加13份`assets/catalog_sources`补充TJA，合计3003，来源分别标记`ESE/`与`supplemental/`。先扫描ESE单源时计数2990，该次证据原样保存在`evidence/ese-only-initial`；核对实际映射/资源链后纳入13份补充谱，不以重复拷贝或虚构文件凑数。

## 交付 / 重跑

| 文件 | 内容 |
|---|---|
| `file-index.json` | 全3003份source路径/hash、状态、COURSE与diagnostics，便于逐项查阅 |
| `scan-summary.json` | QA ID、每类计数、parser源码SHA、扫描器版本、全量压缩artifact路径/hash/长度 |
| `golden-corpus.json` | 自编手算原谱、预期时间、实际逐event输出与适用能力 |
| `expert-case-evidence.json` | 固定源hash真实曲例，待专家复核，不宣称专家已验证 |
| `source-corpus-manifest.json` | 本次扫描原文的私有归档、逐文件hash再验结果；防止每日source更新使baseline不可重现 |
| `/var/tmp/taiko-batch2-20261124/evidence/full-tja-scan.jsonl.gz` | 每文件完整event timeline；按文件流式序列化，不把全部语料展开到内存 |

运行器 `scripts/audit/batch2/scan_tja.mjs`，必须用run_qa与Node24.22.1，单文件<=2MiB、最多10000份、8分钟截止，单线程、写入有背压。使用候选真实vendored parser与`barIntervalMs` bundle，不是自造一套替代parser。文件读取前后stat校验，source hash固定；压缩内容可逐行审计。原文归档只放私有QA目录，不作为公共资源发布。

最终扫描3003/3003：COMPLETE1832、PARTIAL1171、UNSUPPORTED0、INVALID0。分类是下述受限契约的审计结果，**不表示全部TJA功能或音频同步完整支持**；0个INVALID只表示没有触发本扫描器的结构/异常门槛，不是逐首真伪认证。

## 每文件字段与状态定义

包含sourceHash、encoding、parser version/code SHA、COURSE原值/解析key、每COURSE/静态路径普通noteCount、大音符数、roll/balloon数量与metadata、NOTE事件（bar/slot/type/谱面相对timeMs）、长音符span、BPM/DELAY事件、MEASURE有效小节倍率、OFFSET原值、分支原命令/参数、diagnostics。

BPM/DELAY同槽位命令的原始次序保存在rawCommands（原行号和参数）。候选parser将命令分类到独立数组，未证明同槽位每条命令的瞬时先后时刻，因此命令`timeMs=null`，提供boundaryBeforeDelayMs/boundaryAfterDelayMs；不会把忽略此前DELAY的数值误标成精确命令时间。音符的chart-relative时间与上述命令边界语义分开。

| 分类 | 本批精确定义 |
|---|---|
| COMPLETE | 已输出静态chart-relative表示且无已检测diagnostic；只对这一scope成立，绝对音乐对齐仍UNVERIFIED |
| PARTIAL | 有可用静态输出，但含分支动态、LEVELHOLD、未知命令、player-side、长音符边界等未验证/冲突 |
| UNSUPPORTED | 结构块可识别但候选parser无法生成COURSE，不能以空对象算成功 |
| INVALID | 无法解码、START/END结构不匹配、parser异常或非有限timeline；保留诊断不修源 |

音符数按1–4，5/6与7/9分别长连打/气球，8不作为普通note。分支按N/E/M分开计数，不求和当作一份真实演奏。numeric COURSE key与Oni/ura/edit原名保留，身份归一化交给Catalog Authority，不能用同名key覆盖真实身份。

## 能力矩阵 / Golden

| 能力 | 验证状态 |
|---|---|
| 相对note gap、分段BPM、DELAY正负小数、MEASURE、大音符、基本roll/balloon | 自编6例完整event hand oracle +既有29项Node timeline Golden +21项Core修复样例；已验证所列fixture边界 |
| OFFSET相对不变量 | 既有Golden测试-1/0/1.5不改变gap |
| 绝对音乐时间 | 全部UNVERIFIED，absoluteTimes=null；未听音/测音频头/校准OFFSET符号 |
| N/E/M静态路径 | 独立BPM/DELAY状态的Golden通过；不是动态branch选择模拟 |
| LEVELHOLD / SECTION动态状态 | UNVERIFIED；5份出现LEVELHOLD的文件明确PARTIAL |
| Player sides、多格式/未知命令、重复长音符标记 | 保留diagnostic、PARTIAL；没有把格式猜测提升为支持 |

221份有branch、147份有player-side未验证语义。大量低难度`LONG_NOTE_OVERLAP`需要逐例核对重复marker/源方言/parser展开与扫描解释，不能直接宣称原TJA坏，也不能静默忽略。未新增parser业务修复、音频对齐算法、难度模型或Agent。

本批保留先前全量扫描输出，后续只修正扫描报告的BPM/DELAY命令时间表述；原parser源码未改。新旧压缩artifact与各自hash分目录保留，最终以本目录summary指定的artifact为准。

扫描器v2曾把命令精确时间null误算为nonfinite，导致993份错误INVALID；v3明确允许这种未知值，并以6例Golden的状态断言防回归。错误输出在`evidence/scan-v2-null-classification-error/`保留。最终以v3 summary与全量artifact为准，原谱与vendored parser未变。
