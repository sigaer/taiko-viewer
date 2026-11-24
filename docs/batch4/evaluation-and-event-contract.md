# Evaluation and Event Contract

新增协议 `viewer-multi-objective-eval/1`；不更改现有 `viewer-offline/1` 报告含义，不新增生产日志/表。本阶段没有真实可识别游玩队列，不能声称推荐质量已验证。B3 126 Golden Cases 用于旧算法回归，不是 126 个真实玩家成功样本。

## 事件及时间关系

所有新增事件包含 `eventId, eventType, schemaVersion, subjectId, profileScope, occurredAt, receivedAt, knownAt, evidenceRefs`。subjectId 为受控匿名标识；occurredAt 不知道则 null，receivedAt 不能顶替它。服务器写入时间另记，客户端时间要验证合理顺序/漂移，未知不强制补齐。ID 幂等；相同 ID 不同 payload 拒收，迟到事件留原时钟。

B4事件的chartId统一为Catalog Authority canonical Chart ID，带catalogRevision/identityMappingRef；原source namespace/ID只能另列作受控追溯。B3原协议/Golden报告保留原chartKey，只有唯一解析后才加入B4关联，无法解析不猜测同曲或无历史。

生成/展示/接受事件记录intentType、subtype、target.discoveryMode（适用时）、evaluationScope，以及独立ratingSamples/predictionSamples证据引用。Interest Discovery与Level-matched Discovery分层报告，不能把兴趣接受率当水平匹配精度，不能用总体Rating行数充当预测样本分母。数据集须明确每项计数单位及unknown字段。

| 新事件 | 必填关联与语义 |
| --- | --- |
| recommendation_generated | decisionId、candidate IDs/targetHashes、context/evidence/score/catalog/policy/portfolio revisions、asOf/generatedAt；只记录生成，不是曝光 |
| slate_presented | presentationId/slateId/decisionId、实际可见 card IDs、primaryCandidateId、group/readiness、position、完整集合 hash、呈现方式、presentationTelemetryComplete；一张卡一个主动作 |
| recommendation_accepted | acceptanceId/presentationId/cardId/candidateId/targetHash、用户显式 accept 动作、acceptedAt；页面点击/详情查看不计 |
| goal_created_from_recommendation | acceptanceId、commandId、goalId、baselineRevision、portfolioRevisionBefore/After；只有用户明确 accept-and-create 成功提交后存在 |
| score_observation_received | observationId、profile/source/topology、revision/hash、source observedAt/knownAt、coverage；同步结果，不是 Session |
| identifiable_play_observed | sourcePlayId、chart/version/mode、实际 playedAt、knownAt、完整 attempt evidence；来源必须保证独立演奏，不能由快照差分或点击合成 |
| goal_evaluated | evaluationId、goalId/goalRevision、baselineRevision、observationRevision、evaluatorVersion、outcome/result/evidenceRefs；可以仅确认状态转移，不知道真实游玩时刻 |
| goal_portfolio_changed | commandId、前后 revision、affectedGoalIds、用户/系统触发；与 Goal 写入同事务或事务 outbox，不双写两个状态源 |

正式“实际展示”需要主动作及组标识可见（至少 50% 卡面积连续 1 秒、页面前台；新增 instrumentation 规则），虚拟 DOM/预取/响应成功不计。每次展示集合固定，滚动新增卡使用 ready-first 安全前缀/新的合法展示单元；同 presentationId/cardId 重复上报去重。已实际显示但证据未知时记录 unknown；不得把缺 telemetry 的生成量当实际曝光量。刷新/新 presentation 的重复是真重复，统计不能去掉。

接受可以只表达“采用此建议”，不强制建 Goal；accept-and-create 必须明确告知目标，事务提交后接受/创建关联原子化。接受失败、Goal 创建失败分别留失败状态，不虚构 Goal。用户以后手动建同谱面 Goal 不自动回填先前推荐归因；只有明确接受关联才连线。

```text
feature knownAt <= decision asOf <= generatedAt <= presentedAt <= acceptedAt
Goal baseline captured during explicit accepted create command
Goal completion: original evaluator's provenance/order checks, not just arrival time
play attribution: presentedAt < playedAt <= presentedAt + 7d
accepted achievement: acceptedAt < playedAt <= acceptedAt + 7d
all evaluation labels knownAt <= dataset.freezeAt
```

客户端时序不能验证时该事件不进入可归因分母，单列未知。展示前的演奏后来同步到达不能算推荐后演奏。只有 observedAt 的 PB 可报告“后续确认状态变化”，不能证明曝光后游玩。缺 occurredAt 的 Goal completion 可以进入独立 Goal Progression 的状态指标，不能强塞到 play-based achievement。

## 冻结观察协议

- 统一离线 freezeAt/revision；输入只用当时可知的证据，不能用今天目录修补历史；未知版本排除并计数。
- Acceptance window = 展示后 7 天；Achievement window = 接受后 7 天；Type outcome precision window = 展示后 7 天。分别要求窗口成熟，不能混用。Repeat warmup = 14 天。
- Play 归因保持 B3 的最早合格曝光先认领，按 playedAt/ID 稳定排序，不看成绩选择曝光；每个 sourcePlayId 在一个协议内只认领一次。同一次 play 可以作为多个独立 Goal 的证据，但不能让 recommendation outcome 分母膨胀。
- 同卡多个目标，仅 primary action 是该曝光的预测命题；副 Goal 不算独立推荐成功。Acceptance 只认显式关联的 action，不按 songId 猜。
- 对 score stable 命题继续取窗口内最早两次 identifiable plays，两次都≥threshold 才成立；一次 PB 不能证明稳定。皇冠命题使用最早一次可识别尝试的对应真实皇冠结果；NG 用目标版本/判定数匹配的首次尝试；任务使用要求规定的同次/累计真值。记录型 Goal 成功另走 Goal evaluator，不改变上述命题。
- 若最早曝光在接受前，已认领的 play 不能重新分配给后一次高分接受事件。接受后 outcome 只有其归属曝光、且在 acceptedAt 之后的标签可用；无法满足保留 unknown，不追求好看的成功率。

## 八项指标

所有 ratio 必须返回 `{value|null,numerator,denominator,unknownCount,excludedCount,immatureCount,status,protocolVersion}`。不同层次计数（卡、候选、Goal、类型）不能相加。无分母返回 unavailable，不补0/100。每个关键类型/地区/能力/冷启动群体单列分母和覆盖。

| 指标 | 冻结口径 | Unknown / 附加报告 |
| --- | --- | --- |
| Priority Actionability Rate | 实际展示 A 的 ready_now 主动作 / 实际展示 A 主动作 | 每个 presentation 单独 gate，不能用全局均值掩盖违规；展示完整但 readiness 缺失不计 ready 且违规，展示本身未知不进分母；报 not_actionable/long_term violation 与空组数 |
| Priority Acceptance Rate | 在7天内明确接受的 A presentation/action 去重数 / 接受遥测完整且窗口成熟的 A presentation/action 数 | 点击不算；无人接受且全窗口日志完整才算0；遥测缺失/不成熟分别报告，另报完整遥测覆盖率 |
| Priority Achievement Rate | 接受 A 后7天内满足对应 target 命题的已解析主动作数 / 已接受、成熟且具有充分 outcome 标签的 A 主动作数 | 同时报 confirmed/all mature accepted 保守下界与 resolved/all mature accepted 标签覆盖；无 play 不是失败；已接受但无 Goal 仍可评价明确 target。旧 Goal 的随后状态完成单列，不混入 play rate |
| Type-specific Precision | 按 intent/subtype/命题分别：独立标签证实的推荐断言数 / 同类有真值的断言数 | 固定拆 `evidencePrecision` 与 `outcomePrecision`：前者由独立审核/冻结 oracle 复核专用规则，后者用上文未来真值；不能 evaluator 自己产 ready 再算100%精度。score/crown 不合并，训练目标不擅自改成分数提升 |
| Type Coverage | 实际有合格主动作展示的类型数 / 该决策扫描域内有合格且允许展示候选的类型数 | 合格=ready/stretch 且目标有效；另报绝对 x/5、各类型能力缺口、D 浏览覆盖；不以覆盖率强制塞不合格类型 |
| Candidate Coverage | 扫描域内至少产生一个 ready/stretch 候选的唯一 Chart 数 / 同域可用且有足够证据可评估的唯一 Chart 数 | 按类型和 union 分别报 catalogTotal/scanned/evaluable/eligible；补 evaluable/scanned 与 scanned/catalogTotal，不能掩盖未扫描/未知。ordinary adapter≤50 不称全库覆盖 |
| Repeat Rate | 有完整14天历史的当前实际展示卡中，同 profile+chartId 在之前14天已展示的次数 / 有完整14天历史的展示卡数 | 保留 B3 chart 主口径；附 song identity、intent/target、intentional repeat 分层；历史不全 unknown，生成不算曝光；同一 slate 歌曲重复另作 invariant violation |
| Goal Progression | 固定窗口内每 GoalType 的有证据正向进展 Goals / 有可比起终点的 Goals；另报 completed/resolved、resolved/all eligible | Goal ID 去重；active-at-start 队列，paused/cancelled 切断自动观察窗口并作 censoring；新建目标另队列。score delta、NG delta、皇冠离散状态分别报，不求混合平均；completed 终态或窗口终点 active 才解析完成率 |

Dimension outcome 的命题是 `practiceDefinitionRef` 所定义的练习行为被独立证据验证，不是六维必升；没有该行为证据时 outcomePrecision unavailable。Discovery outcome=可识别演奏/探索任务定义的真实执行，浏览点击不能算游玩。Challenge 的同次要求不能用几天内不同 PB 拼成成功。未注册命题不纳入 outcome 分母但计 unknown。

Discovery的evidencePrecision分成interest relevance和level fit两个独立命题，前者由明确兴趣依据/独立标注验证，后者由专用水平证据验证；点击只可另报engagement，不证明任一游玩结果。Interest Discovery仅D，不参与Priority三项指标，也不作为Type/Candidate Coverage中ready/stretch的分子或分母；另报interest eligible/display coverage，仍在五类型绝对浏览覆盖中计discovery一次。Level-matched Discovery沿用可行动口径。Candidate Coverage与Repeat Rate的B4 chart单位均为canonical ID，不能将同谱面多个来源键重复计数。

例：A 展示10、ready6，则 System Actionability=60%。其中4明确接受、2有充分后续标签、1成功，则 conditional Achievement=1/2、label coverage=2/4、保守下界=1/4；不能宣称6/10玩家成功。若接受遥测完整且成熟，Acceptance=4/10；否则按其完整分母另算。

## 质量准入与限制

当前硬 gate 只有最终 A 50%（内部70%优化）、身份/语义/时序完整、无数据泄漏和原126 golden不变。B4.0 不凭合成测试设定“玩家成功率达到X%”发布目标。

未来效果比较保留 B3 预注册原则：原始策略、原顺序+门槛、重排三组分开；按玩家聚类、冻结训练/调参/测试窗口；每关键群体不足100个可解析曝光只报探索结果，给95%区间及缺标签率。类型新增命题须独立定样本/阈值，不能套用分数MAE到皇冠。没有真实可识别样本，Outcome Precision/Achievement 继续 unavailable；证据质量通过不授权替换生产。

Privacy：原始 source account/provenance 仅受控证据存储可见，分析事件不含令牌/凭据/玩家原始快照；删除用户/绑定须一并删除或不可逆解除事件关联。具体存储保留期与采集授权由实施前评审固定，本批不创建采集任务或访问玩家数据。
