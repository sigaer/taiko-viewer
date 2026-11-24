# Batch 4 路线图与审查报告

## 本批结论与边界

Batch 4.0 交付十份文档，把推荐意图、优先级、行动证据、Goal Portfolio、候选和效果指标分开，并定义统一关联。基线为 `c49717b6b7b7f697c0975c3d1477b7abffb26b7f`；工作分支 `design/viewer-recommendation-b4-contract-20261124`，独立工作树 `/var/tmp/taiko-batch4-20261124/viewer`。原 B3 候选及用户修改不覆盖。

仅新增 `docs/batch4/`。没有新增运行代码/数据库DDL/生产UI，没有替换现行推荐、迁移/修改玩家数据、部署、合并main或推送Release tag。Viewer为独立仓库，不向Sakura_bot同步；可提交推送本设计分支供审查。

## 关键冻结决策

1. 五类型与A/B/C/D独立；Personal Goal只作为跨类型意图关联。
2. A最终实际卡片以一个primary action计数，ready≥ceil(N/2)，其余仅stretch，长远目标不得当主动作进入A；70%仅内部优化。
3. Goal生命周期与可用性分离；所有Portfolio写入统一revision CAS，独立baseline/evaluation，完成不连带取消。
4. 分数、Clear、FC、DF、NG、训练、探索、真实任务使用专用证据。B3 stable gate只在分数分支保留，不全局套用。
5. 真实attempt缺失时保持不可判断；新皇冠near规则是离线策略，不是经验证的皇冠概率。新Goal类型无completion evaluator不得开放创建。
6. Composer质量优先，多样性软约束，类型不足可不展示；同Chart聚合不合并Goal证据，歌曲去重不丢Goal。
7. 事件分离生成/展示/接受/创建/观测/可识别play/评价；系统50%不冒充玩家达成率，点击和同步都不是play。

## 多 Agent 审阅及冲突裁决

已分别启动 Agent A（Intent/Priority）、B（Goal Portfolio）、C（Type-specific）、D（Slate/Evaluation），按并发槽位分批。每个任务先要求实际工具权限确认。四个子会话均回报无文件/Shell工具，未执行读取命令、未读取AGENTS、未运行测试；因此它们仅提供设计审阅，**不计为独立代码审计或测试**。D另收到Lead已核实的B3摘要。所有文件检查、实现事实和本批验证由Lead工具执行。

采用意见：一个卡一个主动作；Unavailable独立轴；缺核心证据不能算stretch；指标unknown和成熟窗口；Goal迁移保留baseline；不以字段极值合成attempt。

Lead裁决：

| 分歧/风险 | 最终选择 | 原因 |
| --- | --- | --- |
| 多Goal卡片算几个A单位 | 一个主动作；附属Goal只给独立状态 | 防止把一个ready替多个未知目标背书 |
| unavailable是否第五生命周期枚举 | 生命周期四态+可用性三态，提供Unavailable Goals视图 | 下架不取消承诺，恢复不复活终态 |
| Repeat主键chart还是song | 保留B3 chart主指标，另报song与intent诊断；Composer可按song惩罚 | 不悄悄改变既有报告分母 |
| Score stable是否全类型统一门槛 | 仅score；其他独立，缺证据则不行动 | 不能由分数估计推出FC/DF或真实任务通过 |
| Goal evaluation落盘是否改Portfolio revision | 所有状态/评价持久化都递增一次，幂等no-op除外 | 避免旧候选/排序继续消费过期组合 |
| 旧单目标writer如何继续 | 迁移后拒绝旧写，短期只读adapter且不能任意挑Goal | 不保留两套写路径或误取消其他Goal |

## 分阶段实施（全部未启动）

| 阶段 | 范围与交付 | 进入/退出 gate |
| --- | --- | --- |
| B4-1 契约与离线内核 | 只增新类型、schema validator、target/GoalType registry、纯函数专用接口、合成fixtures；不接生产 | **必须先批准本目录**；严格类型、非法组合拒收、[验收矩阵](acceptance-criteria.md)的schema/priority用例、B3 126不变 |
| B4-2 Portfolio实现候选 | v2存储/API/CAS/签名幂等、生命周期/历史adapter，迁移dry-run工具 | fixture DB隔离、并发/解绑/重放/历史hash验收；真实迁移另批，不执行线上DDL |
| B4-3 专用evaluator候选 | 先接分数与可用证据；crown attempt、dimension特征、discovery覆盖、task定义按能力独立接 | 无数据的类型保持unsupported；阈值与语义注册，有独立oracle；不能借另一设备Agent作为阻塞或虚构其schema |
| B4-4 Composer与事件离线 | 多Goal聚合、去重、手动排序/偏好、repeat、最终展示gate；离线事件replay | gate属性/边界用例、不同类型precision/分母、故障与客户端截断模拟通过 |
| B4-5 候选UI/集成与取数方案 | 单独候选环境展示和显式accept→Goal；事件采集授权/保留期确定 | UI/i18n/无障碍/隐私审查，实际展示gate，必要测试DB有SELECT DATABASE()及mutation opt-in；不自动部署 |
| B4-6 效果审查/替换决策 | 合法匿名时间冻结样本、按类型和分群评估 | 可识别play不足保持unavailable；单独批准迁移/发布/替换，未获批准保留生产现状 |

B4-1不需要访问Taiko Agent。未来细分Chart Intelligence接入只通过版本化输入和本机可验证契约，缺特征不推断手法。训练/任务/探索新Goal evaluator要在开放创建前定义唯一成功命题；本合同的canCreateGoal=false是明确能力边界，不是默默“待实现但可点击创建”。

## 风险与后续审核点

- 真实可识别演奏标签不足；皇冠near常量、score 2% stretch和load-fit仅离线启发式，不能以测试通过授予生产成功率承诺。
- 旧provider字段的同次性、缺失归零与覆盖范围有不足；新证据adapter必须保留presence/语义，无法验证时fail closed。
- 多Goal事务会更频繁产生CAS冲突；先单Portfolio串行正确，再凭实测优化，不提前采用双写/部分事务。
- 曝光前端截断可破坏A门槛；必须验证真实可见集合，后端生成通过不算最终通过。
- 真正数据库迁移与数据保留期不是本批执行事项；后续阶段各有审批，不能拿文档合并代替生产授权。

本批验证记录、明确未执行的验收项以及停止点见 [acceptance-criteria.md](acceptance-criteria.md)。设计完成后停在审查，不自动开始B4-1。
