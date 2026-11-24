# Catalog Consumer Migration Matrix

状态：待批准计划；本批没有迁移 catalog 消费者。准确文件/行号详见 `consumer-inventory.json`，不得以此表替代实际调用链。

| 消费者 / 当前入口 | 现在读取/规则 | 目标Authority接口/策略 | 迁移验证与先决条件 |
|---|---|---|---|
| Viewer Search / Song Detail：`server/services/content/songs.ts`、content loaders、song API | merged + aliases；各处normalizeShelfStatus/filter | song/chart视图、alias索引、catalog_display；地区状态只显示中央值 | 同名、旧ID、shelf2、下架详情仍可读；搜索覆盖计数；首批仅只读影子对比 |
| Rating / B30 / Trend：Bot offline score_calculator / Core calculation、Viewer account rating/trend | rating表、duplicate groups、catalog identity各自读取 | historical_score关联 + model输入投影；不对历史记录套CN current过滤 | 现有rating算法/排序/数值不重写；固定成绩fixture对比旧新关联；每批revision一致 |
| Ordinary Recommendation：Viewer account/charts→Application query→三宿主adapter→Core | candidate修复分别从merged/raw取资格，center/client不同pin | Authority recommendation_eligible(modelProfile,region) chart集合 + 当前展示ID +别名关联；Core仅排序 | 七维度+空集/错误源/旧alias/当前ID；需Core制品与Client兼容gate解决 |
| Target Recommendation：offline/center/client target_recommend | 候选/feature/config/scoreline多源拼接 | 同一recommendation_eligible及按模型中央输入投影，用户目标约束仍原引擎 | 所有原目标回归；不能rating有行就放行无里谱/非CN；不得开发新engine |
| Player Growth / Goal：account/growth、growth-history/evidence、goal evaluation | catalog关联、历史snapshot重放、daily archive、SQL measurement | historical_score、song/chart关联、模型及catalog revision；导入时间语义单独保留 | 历史事实不消失；Kinoko2765不成为play事件；跨模型Weekly差值保留且显示变化 |
| Bot：public命令、center/client loaders、资源client | 本地cache / public JSON manifest、重复visibility/alias处理 | 同一snapshot包或中央投影API+revision；adapter只查中央policy索引 | 离线lastGood/过期策略、空集fail closed、版本报告；不将本地cache升级为权威 |
| Application | context/query/command接收host数据；特征结构假定 | host提供带revision的authority read port和eligibility结果，Application验证契约 | context不得混revision；保持public big_song→Core daigouryoku边界 |
| Public API / 数据包：`taiko_data_api`、catalog publication、Viewer taiko manifest | JSON数据集逐文件打包/按源名缓存 | versioned public snapshot投影+manifest hash+policy结果+版本header | 现有API兼容投影只作短期迁移适配；明确淘汰点为全部客户端认schema；私有资源不外发 |
| Community / UGC：manual/custom songs与论坛关联 | 标题/手动资源/社区source ID | source namespace + moderation + catalog_display；与official chart明确区分 | 用户创建内容不因无CN而消失，不把UGC提升为CN可玩；不改社区生产数据 |
| Future Chart Intelligence / Taiko Agent | 尚未实现统一domain输入 | chart_analysis_eligible(capability)、hash固定timeline、领域知识分级、解释链 | 必须先过parser能力golden/来源身份/绝对对齐专项gate；本批只文档与语料，无agent模型 |

迁移顺序：M0批准schema/identity/policy与差异账本→M1只读Builder原型、快照验证及故障注入→M2 Search/Detail/API只读影子对比→M3 Rating/B30/Trend历史关联→M4 Ordinary/Target及Growth/Goal→M5 Bot/Application/offline分发切换→M6移除旧loader/重复过滤与过渡投影；Community按namespace专项验收后接入。Chart Intelligence/Agent是后续独立项目，不随快照迁移自动获准。

每批必须有owner、单独变更集、旧新fixture对照、consumer版本报告、激活条件与上一个snapshot回滚演练。迁移期间只有一个authority，影子比较不形成第二套生产判断。删除旧规则以全部对应消费者通过中央policy golden为条件，不能无限期双读/双过滤。
