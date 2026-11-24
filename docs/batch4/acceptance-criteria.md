# Batch 4.0 Acceptance Criteria

本文件区分“本批文档交付验证”与“未来实现必须通过的验收”。后者列出的是测试规范，不能称已执行或通过。基线 `c49717b6b7b7f697c0975c3d1477b7abffb26b7f`。

## 交付清单

| 文档 | 必须回答的问题 |
| --- | --- |
| [recommendation-intent-contract.md](recommendation-intent-contract.md) | 五类型、子类型、输入/目标/来源/证据/不支持/理由/优先级；Personal Goal非算法 |
| [priority-actionability-contract.md](priority-actionability-contract.md) | 独立A/B/C/D、三态、实际N/ceil50%、70%优化、三类结果分离 |
| [goal-portfolio-contract.md](goal-portfolio-contract.md) | 多active、paused、completed、cancelled、unavailable、同Chart多Goal、排序/独立baseline/eval、revision/CAS/token |
| [type-specific-evaluation.md](type-specific-evaluation.md) | score/四皇冠/训练/探索/任务/Goal分派、统一输出、真实字段语义/未知 |
| [candidate-schema.md](candidate-schema.md) | 所需字段、target联合、evidence、Goal links、主动作聚合、预算/错误 |
| [slate-composer-design.md](slate-composer-design.md) | 多类型、歌曲去重、排序/偏好/repeat/短缺/最终gate |
| [evaluation-and-event-contract.md](evaluation-and-event-contract.md) | 八项指标、分母/unknown、生成到观察的时间/归因、不伪造Session |
| [backward-compatibility.md](backward-compatibility.md) | 可定位源码事实、新旧字段、旧API/token、一次性可重入迁移与收敛 |
| [implementation-roadmap.md](implementation-roadmap.md) | 分期、风险、子代理权限/审查边界、Lead裁决、审批停止点 |
| 本文 | 可执行的后续验收矩阵、已做与未做验证区分 |

## 后续验收矩阵（尚未实现/执行）

| ID | 场景 | 必须结果 |
| --- | --- | --- |
| I01 | intent未知/Personal Goal作第六类型 | schema拒绝；合法goalIds可跨五类关联 |
| I02 | 同类型不同readiness；不同类型同A | 不按类型硬编码组；discovery可A，challenge可C或近期A |
| P01 | A N=0/1/2/3/5 | minReady=0/1/1/2/3，N0 rate=null |
| P02 | ready=1/stretch=8/K5 | A≤2；只有stretch时A为空 |
| P03 | A混入not_actionable/long_term | gate失败，不能改名stretch救场 |
| P04 | 去重/筛选/客户端只显示stretch | 重验移组/缩组；实际违规不能以原生成集合掩盖 |
| P05 | 50%通过但70%未达 | hardGate=true、optimizationTargetMet=false |
| G01 | 同Chart score-pb与df两个active | 两ID/两baseline/独立eval；score完成不改变df |
| G02 | pause/resume/unavailable恢复/取消后再可用 | lifecycle与availability独立；不重采baseline、不复活终态 |
| G03 | 两客户端同revision分别改两个Goal | 仅一个事务成功，另409；不丢排序/更改 |
| G04 | reorder与create/evaluate并发 | Portfolio CAS冲突、原子重排；不可部分成功 |
| G05 | 同command重放/同ID不同payload/同nonce新command | 原响应且baseline不变 / 409 / 拒绝重复接受 |
| G06 | token错owner/chart/target/catalog/score/portfolio/过期 | 拒绝；验签不能绕CAS；旧v1 token不能转v2 |
| G07 | source lease/owner/binding/portfolio/goal锁并发解绑 | 既有锁顺序，无孤儿/越权；解绑清理新事件/portfolio |
| G08 | 多Goal评价同观测：一完成一inconclusive | 各结果独立，同事务；基础设施错误全部rollback；play不复制 |
| G09 | 终态Goal修改target/算法自动建议 | 必须显式新Goal；建议不落Goal表 |
| T01 | PB-only/high confidence而stable缺失 | score not_actionable，不入A/B |
| T02 | stable>0,target≤stable/在pb内且≤2%/超过2% | ready / stretch / not_actionable，其他证据条件须同时成立 |
| T03 | score-pb baseline b，target b/b+1/b+2 | 只b+1合法绑定；非法/溢出baseline拒绝 |
| T04 | pred_ng=0或高分；无真实attempt | FC/DF不能ready/stretch；不能补皇冠 |
| T05 | crown 3次near条件、仅2次stretch条件、聚合max combo | 按独立子类型边界；聚合不能替代distinct attempt |
| T06 | Clear无gauge requirement；NG total不相等 | not_actionable / v1 completion inconclusive |
| T07 | 六维最低但无chart特征/无佐证 | not_actionable，不能称短板；explicit focus须标用户意图 |
| T08 | 完整覆盖缺记录/返回缺记录但不完整/覆盖未知 | unplayed_confirmed/no_score_record/coverage_unknown，后两者不称从未玩过 |
| T09 | 过期任务/仅段位名/当前进度未知 | 不生成challenge；高星曲不当任务 |
| T10 | 同次段位条件由不同历史PB拼接 | 拒绝任务达成/可达断言 |
| T11 | GoalType played或新类型未注册 | completion unsupported、canCreateGoal=false；不能套score规则 |
| C01 | 同Chart两个不同target | 两candidateId，卡片聚合保留独立goalLinks，主动作仅一项 |
| C02 | 同song不同chart被去重 | 一卡，suppression诊断；Portfolio Goals不删除 |
| C03 | 用户优先级或类型配额要求不合格项 | 质量门槛获胜；该类型允许空 |
| C04 | 重复曝光历史未知/14天内重复/仅生成未展示 | unknown / repeat / 不算曝光；intentional repeat单列 |
| C05 | 不同目录/region/未来evidence/含双人歧义ID | 拒收并给reason，不以同title合并 |
| C06 | 同输入重复运行/超预算 | 相同IDs/顺序/诊断；超限明确错误 |
| E01 | 点击、同步、PB快照 | 不变成accept/play/session |
| E02 | 曝光前play晚到达/未来特征 | 不归因推荐后play / 排除泄漏输入 |
| E03 | 同play多曝光/同chart多Goal | 最早合格曝光一次认领；Goal可独立完成但不制造多play |
| E04 | 未成熟窗口/缺标签/无真实样本 | immature/unknown/unavailable，不当失败，不编0%/100% |
| E05 | 10展示6ready4accept2resolved1success | actionability=.6，acceptance=.4（日志完整时），achievement=.5条件/.25下界/.5覆盖 |
| E06 | 某组违规但全局平均≥50% | 记录单组violation，不能PASS |
| E07 | 原126Golden+新版fixtures | 原集合与输出不改；新用例独立，不删旧例迎合设计 |
| M01 | 迁移重复执行/取消完成历史/旧非法baseline | 原ID/对象hash/事实key不变；不可恢复字段保留unsupported |
| M02 | 迁移后旧写接口；多active旧读 | upgrade-required，不替换目标或任意选一个 |
| M03 | 多active后回滚旧schema | 禁止重新加单active约束造成目标丢失；先冻结写保留v2 |
| R01 | 来源键123:4与Authority行内song:…:course:4 | B4使用行内canonical ID；字符串格式正确但Authority不存在的ID仍拒绝 |
| R02 | 两个来源alias解析同一chart；同数值不同namespace | 前者按权威关系聚合/去重，后者不能直接合并；保留mapping evidence |
| R03 | ID未解析/映射歧义/exists=false槽位/旧Goal无映射 | 候选拒收；旧Goal保留baseline/history且标未知，不造永久ID |
| R04 | Interest Discovery无Rating/无预测/覆盖未知，但有兴趣证据与可用chart | 可D探索，level match未评估，不能称未玩；不进A/B或Actionability分母 |
| R05 | 高兴趣confidence与水平匹配不足 | 不升级ready；两个subtype/targetHash不混用；五类型覆盖不重复计discovery |
| R06 | Level-matched Discovery通过/缺失load-fit | 前者按ready/stretch和A gate组合；后者不进A/B；有独立兴趣证据才另生兴趣候选 |
| R07 | Rating.sampleCount=200但预测neighbor缺失/0或data_sufficiency不足 | 分别PREDICTION_SAMPLE_EVIDENCE_MISSING/INSUFFICIENT；不能用200填预测字段 |
| R08 | Rating.sampleCount<20但目标预测充分 | 分数分支总体门槛仍失败；Interest Discovery不受该门槛影响 |
| R09 | topN=20/重复Rating行/邻近样本数<20 | 不推断20次游玩或20张唯一谱面；预测按其模型规则判断，不照搬Rating门槛 |
| R10 | B3报告/事件旧键迁到B4比较 | 原报告字节不变；明确canonical映射覆盖，未解析历史unknown而非首次曝光 |

## 本批实际验证记录

2026-11-24，Lead在独立B4工作树完成以下检查。只使用已有合成fixtures；没有访问真实玩家数据或启动服务/browser，没有执行迁移/构建/部署。

| 检查 | 实际结果 |
| --- | --- |
| 指定B3基线/原工作树 | HEAD仍为c49717b6b7b7f697c0975c3d1477b7abffb26b7f，原工作树干净 |
| 文档完整性 | 10/10指定Markdown；33个相对文件链接有效，代码块配对 |
| 修改范围 | 仅docs/batch4；B3文档/证据、源码、测试、scripts、packages未改 |
| 原strict TypeScript | PASS，未改配置或关闭strict |
| 原Node回归 | 92/92，0 failed/skipped/cancelled |
| 原Core Golden Cases | 126/126，两次实际回放，未改fixture或既有推荐实现 |
| 原Core回归 | 3/3，两次运行均通过 |
| 报告复现 | 两次SHA-256相同，且与指定B3提交的报告逐字节相同 |
| 进程清理 | wrapper/process exitCode=0，childrenStopped=true，stopReason=null；未启动临时服务 |

回归run：`qa-e9d4fe64b0be`；文档检查run：`qa-aa73bde93158`。均经原`run_qa.sh`与development-qa.slice隔离执行，没有绕过准入或增加内存预算。wrapper未提供进程内存峰值，不能把预算当实测峰值。持久原始证据分别在 `/home/sigaer/taiko/qa-vault/runs/<runId>/evidence/manifest.json` 和 `output.log`。

| B3原报告 | 保留SHA-256 |
| --- | --- |
| existing-baseline.json | `ed6ed2b0f0bfce8ef197536a0e81f32a9115d133b235f5dd69d8e3b02b53f36f` |
| offline-benchmark.json | `acf208e6efb5a62b44e9b4a33f526c52e7cab03574c02400d114b90337e57bbc` |

实际回归命令（工作树根目录）：

```bash
bash scripts/memory/run_qa.sh /bin/bash scripts/verify_player_intelligence.sh \
  /www/server/nvm/versions/node/v24.13.0/bin/node \
  /home/sigaer/taiko/taiko-forum/taiko_viewer/node_modules/typescript/bin/tsc \
  /var/tmp/taiko-batch21-20261124/installed-rc9/bin/python \
  /var/tmp/taiko-batch21-20261124/core/tests
```

文档检查通过隔离wrapper执行 `/usr/bin/python3 /var/tmp/taiko-batch4-20261124/check_docs.py`，检查上述文件/链接/代码块、源码差异边界、原候选状态与两报告原字节；该临时检查器不属于运行代码。`git diff --check`在提交前执行。以上不证明B4新schema、CAS事务、新类型可达性或新Composer已经实现；前述I/P/G/T/C/E/M用例全部是未来验收规范。真实玩家效果、概率校准和生产可用性未测试。

## B4-1 前三项契约修订验证

本轮基于`b6dab5ef`仅修订十份契约，未实施新schema/adapter/evaluator。隔离文档检查run=`qa-2d0789914a77`：10份文档、35个相对文件链接、代码块配对通过；canonical身份、Discovery两个subtype、两类样本字段和独立缺失诊断的文本断言通过，新增R01–R10验收规范。`git diff --check`通过。原B3候选HEAD/干净状态未变，126 Golden所在报告与B3基线逐字节一致，两个SHA-256仍为上表值。

wrapper/process exitCode=0、childrenStopped=true、stopReason=null。证据保存在`/home/sigaer/taiko/qa-vault/runs/qa-2d0789914a77/evidence/`。本轮没有重跑源码测试；上节92/126/3回归结果是B4.0初始文档交付时的实际运行，不能当作新字段实现测试。R01–R10尚未实现或执行，不将文档断言检查称为算法/数据库验收。

## 审查停止点

十份文档完成后停止，等待本契约审查批准。不得自动开始B4-1。生产替换、DB迁移、UI发布、真实取数各需其阶段明确授权，不能因本设计分支提交推送而自动执行。
