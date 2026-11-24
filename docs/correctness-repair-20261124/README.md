# Taiko Viewer Correctness Repair — 2026-11-24 验收报告

候选分支保留，等待验收；没有合并 main、推送、发布或部署，没有修改生产数据库或真实玩家成绩。

**结论：候选修复完成；当前生产依赖组合尚不能通过完整验收。** A 的维度修复兼容生产 Core 0.1.1；B 的过滤修复需要配套 Core 补丁制品。当前 center pin 仍为 0.1.1，未用源码 0.1.2 冒充生产事实。已保留并验证专用增量回补 patch：隔离的0.1.1副本通过12项契约测试与76项Python回归；尚未生成或发布新的center依赖版本。C 验证了相对 gap 与既有 chart-relative 长音符事件，未证明绝对音频对齐或完整动态分支语义。D 是只读调查，未修复数据。

## 1. Agent 分工、边界与实际执行

| Agent | 独立范围 | 交付与实际执行 |
|---|---|---|
| A — Recommendation Contract | Viewer resolver、Application public basis、Bot 三个 Core adapter、维度测试 | Native A 完成设计及复审；主代理执行代码和测试。公共 `big_song`，仅 Core 边界使用 `daigouryoku`。 |
| B — Catalog Availability | Core availability/candidate selection、host loaders、client 普通和 target 入口、边界测试 | Native B 完成策略及复审；主代理执行。与 A 共用的 client adapter 顺序集成，没有同时写文件。 |
| C — Chart Timeline | Viewer vendored parser/analyzer、Golden Fixtures；集成阶段补 Core 两个 parser 的局部修复 | Native C 提供手算规则和覆盖复审；主代理先复现再修复并验证。 |
| D — Integrity Investigator | Weekly、Publication、日期、Measurement、生产版本，只读 | Native D 审查主代理采集的源码／只读证据，输出根因、风险与建议。[详细报告](agent-d.md)。 |
| Lead | 环境确认、worktree/分支、冲突协调、实现执行、审查、独立集成、性能与构建、报告 | 所有 Git 提交和运行命令均由主代理执行，不把子代理意见冒充独立运行 PASS。 |

本会话 Native 子代理实际没有可用工具；C 重建后仍无工具。已告知用户，采用并行设计／只读审查、主代理执行的方式完成可执行工作。未让多个 Agent 修改同一文件。QA 和构建按维护锁串行，避免资源重叠。

已读取 `/home/sigaer/AGENTS.md`、`/home/sigaer/taiko/AGENTS.md`、Viewer/Bot 根规则和内存指南；查找范围未发现更深适用规则。本批用户停止条件优先于历史自动发布／推送要求，未执行 Poster Phase 工作。

## 2. 原始问题与事实基线

依据用户补充的 **2026-11-23 Intelligence Foundation Audit**；未将 8 月旧审计当作当前事实。

- Viewer main/local origin main：`2d17cb7a9030020ef21a6d01ec93225f86e4dfd3`，1.19.7。
- Bot main/local origin main：`38a47d882a48883cda91ca27f778adfd8ddb2ef9`，0.26.3。
- 生产：Node24.22.1；Python 指向 `/opt/taiko-bot/releases/0.26.3`，Bot0.26.3、Application0.9.2、Core0.1.1。vendored Core0.1.2；center/client 分别 pin0.1.1/0.1.2。
- Viewer 原工作区 `title_song_relations.json` 和研究文件、Bot `web.conf` 与既有未跟踪文件保持原样，没有 stash、覆盖或带入候选。
- A：`big_song` 到 Core 找不到 SongStats 属性；改为 `daigouryoku` 又被 public projection 拒绝。
- B：只排除部分下架状态、数值 0 难度被当作存在、raw 缺失回退到 enriched merged、空集合关闭过滤、client 入口不一致、旧成绩 alias 可覆盖输出 ID。
- C：小节中变速应为750ms却得1000ms；DELAY1秒应为2000ms却得1000ms；Core结构分析器行内注释漏音符。集成新增 Balloon fixture 又复现 `.25` 被读成25秒。
- D：跨版本 Weekly 差值仍展示；Publication hash/长度不符；远期日期；measurement 写入和读取契约不一致；生产制品来源不能只靠版本号证明。

## 3. 文件与提交

两个仓库均保留 `repair/correctness-candidate-20261124`：

- Viewer：`/var/tmp/taiko-correctness-20261124/integration`
- Bot：`/var/tmp/taiko-correctness-20261124/integration-bot`

| 工作包 | 原任务提交 | 候选集成提交 | 主要文件 |
|---|---|---|---|
| A Viewer | `9e3151a2` | `9e3151a2` | account/charts、recommendation-dimensions、resolver test、package/lock（候选1.19.8） |
| A Bot/Application | `f9112f4` | `a14d19d` | recommendation_dimensions、commands/query、offline/center/client adapters、aliases、correctness runner |
| B Core/Bot | `4e226b1` | `1d74978` | chart/availability、recommendation/candidates/catalog_inputs、host loaders、client target、catalog tests |
| C Viewer | `09ba1323` | `d8f766cb` | tja-parser、bar-timeline、note-gap、source manifest、timeline golden |
| Lead 集成补充 | — | `9813266`、`2a014a8`、`3cf01e4` | CN raw 合成夹具、Core inline-comment/decimal/signed-delay、Core golden、跨语言 bridge |

[逐提交完整文件清单](files-and-commits.md)列出全部文件，文档提交见分支最终 `git log`。A/B/C 任务 worktree 和分支保留；未使用的隔离 worktree 不含业务修改。

## 4. 各工作包验证

- A：七个 public basis，大小写／中文／旧别名与未知值；真实 Core 排序及 Application projection；三个 adapter 函数边界。source0.1.2 与 installed0.1.1 的维度专测各4个 unittest 方法通过。
- B：A+B 联合 source Core12个 unittest 方法通过，含七维度×空集／交集、下架、缺失／0／非有限难度、raw损坏、重复身份、表里区分、旧 alias 和无效重复行。未修改的 installed0.1.1 同套测试22个失败断言／subtest，是已确认依赖缺口。
- C：Viewer Golden29项（含父测试）通过；Core21项新增手算样例通过。涵盖 BPM 内部／端点／重复、DELAY 边界／正负／小数、MEASURE、空小节／跨小节、OFFSET相对不变量、N/E/M、大小音符、Roll/Balloon及缺失 metadata。
- D：有界只读扫描1098个归档、23930个点；12个 sampleCount 不合法；一个稳定manifest长度/hash异常且投影同inode；2765年条目确认来自带 historical-snapshot 标记的记录。未作写入者归因或数据修复。

子代理没有自行执行测试，以上是主代理对各工作包的运行结果。

## 5. 主代理独立集成验证

见 [验证证据与最终结果](validation.md)。集成检查包含新旧代码同环境对照，而非简单相加子代理结果。

- Node 基线279/279，候选309/309。覆盖 Goal/Evaluation、Growth/History/Weekly/Passport/Recent、Home、Recommendation/Goal身份、Publication和关键模拟HTTP契约。
- Python 生产依赖基线55通过/4既有跳过；候选正常模块导入与原业务回归加Core Golden为76通过/4既有跳过。跳过项是原有禁止读取真实用户夹具的规则，没有删测试。
- 完整 TJA HTTP 测试通过：真实隔离worker、编码、分支、返回维度、错误边界、并发准入、大小限制、rate limit；不访问生产业务HTTP。
- 跨语言桥接、wheel构建、生产Core补丁覆盖实验、合成性能与Viewer构建结果详见validation；生产原包与临时补丁实验分开记录。
- Token源码审查确认按原payload验签后解析，未在验签前改basis，10分钟TTL未变；既有Goal token／身份回归通过。

失败区分：Node首次使用错误Python导致33失败，明确配置生产Python与合成根目录后基线279全通过；Python新增严格raw要求触发39旧夹具失败，补齐合成raw后原断言全通过；TJA HTTP首次因PrivateTmp看不到/var/tmp runtime返回503，移至QA scratch后通过；新增Balloon测试发现真实小数解析bug，已修复。构建工具／堆参数问题单列，不静默归为基线bug。

## 6. 修复前后行为

| 触发 | 修复前 | 候选行为 |
|---|---|---|
| 大歌／big_song推荐 | Core或projection异常 | public始终big_song，Core属性daigouryoku |
| raw缺失／损坏 | 可回退到扩展曲库 | 显式不可用，拒绝生成不可信候选 |
| 权威空候选集 | truthiness可关闭过滤 | 返回空结果 |
| 未上架／不存在的里谱 | 部分路径可入候选 | shelf0且merged/raw对应难度都正数 |
| 已玩旧版本ID | 可替换当前可用候选ID | 仍显示当前可用谱面ID，保留已玩语义 |
| 变速／DELAY审计fixture | 1000/1000ms | 750/2000ms |
| 合法行内注释 | Core音符数0 | 2 |
| `.25`秒DELAY | Core读为25秒 | 0.25秒；有限负delay也保留 |
| Weekly／Publication／异常归档 | 已有风险 | 仅定位并记录，未改数据或业务行为 |

## 7. 未解决问题与验收门槛

1. **当前生产依赖兼容未通过**：B/C Core变更尚未进入center安装包。scratch overlay即使通过，也不等于生产0.1.1已兼容。必须决定有来源证明的center补丁制品／版本和pin，重新验收后才可发布；不能直接切换到client0.1.2。
2. 未证明绝对OFFSET音频对齐、完整音符事件流、动态LEVELHOLD或全量3003份富特征语义。没有新增难度评分系统、Taiko Agent或完整训练规划系统。
3. D所列Weekly解释、Publication写入者、日期来源及measurement异常点与11次日志的对应仍待下一批；没有自动修复或回填。
4. 不包含生产认证HTTP、真实Bot进程在线交互、DB集成写入或生产并发压测。模拟API和离线测试不冒充在线验收；性能样本不构成SLA。
5. 本次构建产物仅用于候选验证，未替换生产.output，未建立既有生产1.19.7对应GitSHA的独立证明。

## 8. 回滚方案

本批未部署，生产无须回滚。保留主工作区和main即可继续现状。候选需要撤销时，在候选分支按逆序revert本批提交，或从上述基线另建分支；不要对带用户修改的main执行reset/clean。

A的Viewer与Bot/Application应作为一组审查；B/C的Core修复不能仅靠发布Viewer生效。未来如获发布授权，回滚应同时固定Viewer、Application/Bot和对应Core制品及来源清单；本报告不授权执行发布或回滚生产。

## 9. 下一批次建议

先完成center Core补丁制品与来源清单，再处理Weekly跨版本差值、Publication对象与投影inode隔离、measurement写入／读取契约和异常日期来源。各数据修复需先生成具体清单、隔离测试及审阅方案。随后扩展版本化全量Golden corpus与性能基线；训练计划闭环和概率校准仍为后续独立工作。
