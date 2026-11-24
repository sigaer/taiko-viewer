# Catalog Authority Architecture — 设计候选，未激活

## 所有权与契约

Central Catalog Builder 是唯一拥有 catalog identity、来源优先级、资格规则的组件。Core 保持数值计算边界；Authority 的策略不散落在 Core、Viewer、Python loader、Application 或 Bot。推荐引擎仍负责用户目标/已玩集合/排序，不能重新推断 catalog 资格。

| 实体 | 必须字段与不变量 |
|---|---|
| Song Identity | 永久 `songId`（opaque稳定键）、标题及本地化、source aliases；重命名不改身份，冲突不以标题自动合并 |
| Chart Identity | 永久 `chartId`, songId, difficultyId, platform/release/chartVariant；内容 hash 为版本，不作为永久主键；同COURSE但实质不同谱面不可共用主键 |
| Source Alias | `(sourceNamespace, sourceKey, validFrom, validTo)`→song/chart，有依据/审核状态；唯一、无环，禁止跨命名空间数字直接相等 |
| Difficulty | canonical enum easy/normal/hard/oni/ura；来源原值、numeric course映射独立；star 可空并带来源，星级0不等于谱面存在 |
| Region | CN/JP/TW/HK/... 与 platform 独立，来源能力可部分覆盖，未证实为 UNKNOWN |
| Release Status | region+platform+release+asOf+sourceEvidence 的 RELEASED/RETIRED/ANNOUNCED/UNKNOWN；有效时间区间与采集时间分开 |
| Raw Fumen | source URI/路径引用、source hash、bytes、COURSE association、AVAILABLE/MISSING/UNREADABLE/MISMATCH，授权/可分发标识；不会把私有TJA放公共API |
| Parser Status | parser ID/version+code SHA、source hash、分类 COMPLETE/PARTIAL/UNSUPPORTED/INVALID、capability vector 与 diagnostics；相对时间/绝对时间/静态分支/动态LEVELHOLD分开 |
| Historical Association | 原成绩source ID、原COURSE、映射证据、解析到的当前/历史chartId；未知与冲突保留，原成绩字节不改 |

缺失、明确不存在、来源冲突分别编码，不能都变成 false/空数组。任何字段需要 value、sourceRef、observedAt、effectiveAt（可空）、confidence/evidenceKind。Builder 输出冲突账本和本次差异，不能依据“最大的JSON最全”选权威。

## 中央 Eligibility Policies

以下为 `policyVersion=1` 的设计候选，尚未在消费者生效。输出 `{eligible, reasonCodes[], evidenceRefs[], policyVersion, catalogRevision, asOf}`；未知关键证据采取拒绝推荐/分析，并保留明确原因。统一来源于快照中的 eligibility 表/索引；只读适配层只查询、校验schema/revision并投影，禁止重新解析 `shelf_status`。

| policy | 中央定义 |
|---|---|
| `catalog_display` | 可明确识别的歌/谱面或已知历史关联均可显示；允许 retired、无CN、无raw、解析partial；标注相应状态。受内容可见性/UGC审核约束 |
| `historical_score` | 合法已存成绩可关联或作为 unresolved/orphan 展示；不要求 current playable、rating行或raw。这个策略不能删除、隐藏未上架旧成绩，也不能把导入时戳当play时间 |
| `cn_current_playable` | CN/目标platform/release在asOf有效的RELEASED，谱面COURSE存在且地区来源明确；迁移初期保留候选merged/raw交集正值与明确shelf0作为policy1证据，缺任一返回拒绝/unknown；不由rating/文件存在反推 |
| `recommendation_eligible` | 满足目标region current playable + 身份无冲突 + 对请求模型可用的可信特征与常数 + 内容可见；普通/目标推荐共享这份catalog资格，用户偏好和目标条件再交给原引擎计算。提供 context(modelProfile,region,platform) 对应的**中央预计算**变体，不能各客户端写分支 |
| `chart_analysis_eligible` | chart/source identity明确且raw已验hash/COURSE；按请求能力匹配parser capability。允许partial的静态分析必须声明输出局限；绝对音乐时间/动态分支能力未验证时拒绝该能力，不整体谎报complete |

`historical_score` 是保留/关联政策，不是允许任何手工数据成为官方成绩。Kinoko `2765-01-01` 作为手动导入标记保存；play/growth temporal evidence = unavailable/import，不做未来异常回填。Weekly 跨模型允许算差，返回版本说明元数据。

## 快照方案评估与选择

| 方案 | 判定 |
|---|---|
| 相同 JSON 复制到多仓，各自过滤 | 拒绝：相同字节不能防止判断规则漂移，无法原子切换 |
| 所有请求查一个中央服务 | 能集中策略，但增加请求依赖/离线故障与部署耦合；可提供 API，不作为本阶段唯一运行方式 |
| 单一 Builder + 不可变版本快照 + 轻量只读适配 | 首选：生成一次身份与策略；消费者读同一release/revision，经hash验证后本地持有，只实现通用读取接口 |

权威包采用只读 SQLite（song/chart/alias/availability/resource/parser/eligibility/source 表与索引）；同时生成可审查的manifest和公开脱敏JSON投影。公开JSON只能包含中央算好的状态和政策结果，不交给每个仓库重新过滤。禁止把真实成绩/账号/密钥装入catalog包。

包布局：`catalog/<revision>/{catalog.sqlite,public.json,manifest.json,sha256sums}`。manifest 包含 schemaVersion、catalogRevision、policyVersion、builderCommit、构建环境、sourceManifest（每源内容hash/长度/观测/抓取/有效时间/transform版本）、parser/model依赖、每输出hash及计数/冲突。schemaVersion 管结构，policyVersion 管决策语义，catalogRevision 为规范化manifest+数据内容的hash；仅builtAt变化不能制造业务revision。manifest采用规范JSON编码；在hash输入中排除revision自身，避免自引用。

流程：冻结并记录各源→验证来源完整性与namespace映射→派生字段/全部policy→差异检查→golden和consumer contract→写不可变revision目录→fsync文件/目录→读回验hash→标记可激活。生成失败或任一输入未完整读取，不替换现有snapshot，不把部分输出当空目录。

Atomic Activation：同文件系统 staging→rename版本目录，随后原子rename `active.json` 指针（revision+manifestHash），fsync父目录。读者捕获指针并开只读连接，整个请求固定revision；旧连接/在途请求保留旧目录，由租约/引用计数或保守保留期阻止GC竞态。不是一次把多个仓库的JSON分别覆盖。后续实现需隔离inode测试，不能复用有硬链接污染风险的Publication投影机制。

Consumer Version Reporting：每服务健康/诊断返回 consumerBuild、schema支持范围、activeCatalogRevision、policyVersion、parser/model版本、loadedAt、stale/lastGood；API响应使用 `X-Catalog-Revision` / policyVersion，推荐token与解释链带revision。匿名接口不能泄漏私有源路径。不同消费者短期revision差异可监测，但同一个请求禁止混代字段。

Cache Invalidation：所有catalog计算/查询缓存key包括catalogRevision+policyVersion+模型配置；activation后新请求用新key，旧缓存自然有限期淘汰；不要读mtime猜版本或先清所有缓存再加载。多实例按版本广播/轮询指针，不需要业务双写。离线Bot报告lastGood revision及stale；过期数据是否允许推荐由中央有效期政策决定。

Rollback：保留至少当前、上个已验证revision及源manifest，回滚只原子切换已验证且schema兼容的指针；消费者按revision重新开只读连接/使用新缓存key。回滚不修改历史成绩，不把历史token或解释链静默重算到新revision。快照发布、激活、回滚与GC为不同有审计的操作；本批均未执行。

## 验收与批准边界

先对现有2993首/12052候选chart并集、7难度差异、遗留别名、资源missing、区域unknown生成迁移差异账本。golden必须包含shelf0/1/2、空权威集、缺raw、无里谱、同名异ID、legacy冲突/环、退休历史成绩与partial解析。影子只读对比只能写QA证据，禁止双写生产权威。新快照 schema/policy批准后才逐批接消费者；任何出乎预期的历史成绩消失、推荐出现非目标区域、混revision或来源读取不完整均阻止激活。
