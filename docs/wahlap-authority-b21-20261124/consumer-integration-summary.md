# Consumer integration status

以下均指候选源码。生产未部署。Viewer RC1 全量 build 通过；RC2 字节传输修正的 Node/HTTP/远端联检通过，完整 RC2 build 仍待内存准入。逐原始引用、当前文件 SHA、静态调用路径和保留原因见 [494-reference ledger](consumer-migration-494.json) 与 [187-file matrix](consumer-migration-matrix.md)。静态迁移与实际执行证据分别记录。

| 消费者 | 已迁移的实际入口 | 策略及版本报告 | 验证范围 |
|---|---|---|---|
| Viewer Song Search / Detail | content/songs → captureCatalogAuthority；旧链接查中央 aliases | catalog_display；HTTP revision/PV/state，行级 stamp | 全量 Node snapshot、H3 scope、Viewer build |
| Rating / B30 / Trend | 三宿主歌曲/身份/visibility/B30/summary/prepared caches 读中央投影 | historical association/display 与当前 CN 分开；handler/health/HTTP 报告 | installed Core golden、B30 import/port smoke、Python regressions |
| 普通推荐 | offline、Center、Client 实际 score_calculator → 中央 ordinary mask | recommendation_eligible ordinary；Application context + 宿主报告 | 27 installed bridges、empty mask、alias、numeric golden |
| 目标推荐 | 三宿主 target ports → target mask；模型读端内存投影 | recommendation_eligible target；相同 request revision | 原有 target regression 保留所有数值/排序 oracle |
| Today Plan | growth_compute 使用相同普通推荐；Viewer growth 合成计划 | recommendation mask + goalChartAvailable；H3/child revision、goal receipt 输入 | 原有 growth/replay/goal Node 测试；未执行生产 measurement writer |
| Player Growth / Goal | getSongCatalog、Python compute env、goalChartAvailable、fingerprint 和 receipt | cn_current_playable、historical_score；HTTP/child + Catalog 纳入模型指纹 | 310 Node 原有回归、时间 marker 负控制、measurement stage tests |
| Python Core | pure functions 接收 flags/masks；availability 不读取 raw | 中央预计算许可；由 host/context 报实际版本 | 12 contracts、30 Core tests、126 既有推荐 oracle |
| Application | context revision/PV 成对注入；constant query 优先中央 flags | 不拥有第二套官方规则；context/host 版本 | installed projections、Center/Client/joint resolver |
| Sakura Bot Center / Client | public catalog/index/provider、progress、dani、metrics、draw/summary 等中央端口；120 handler scope | 懒捕获同一 generation；health 列实际使用过的 consumer 版本 | installed host smoke、Authority fault/port tests；没有启动真实 Bot/适配器 |
| Public API | Viewer v1 catalog postprojection、taiko data/catalog/manifest；Bot song API aliases 与歌曲同 scope | 中央 identity、CN flags、revision-bound transport、HTTP headers | 全量 Node/Python一致性；manifest/DTO 源码审查；未做生产 HTTP |
| Community / UGC | cover、draw_guess/song lookup 使用中央 rows；UGC loader 改为 Snapshot | catalog display/current chart permission；父 handler 或 UGC catalogReport | UGC actual loader 与全量 policy keys 一致；冲突 shelf 负控制 |
| Annual / offline historical use | annual helpers、cache fingerprint、historical eligibility；原成绩字节不变 | historical_score，不因当前未列入删除历史记录 | Python/Node 保留回归；未运行真实年度生成器 |
| Chart Intelligence | Builder 输出每谱面 13 特征及 analysis policy；raw hash validator 单谱隔离 | chart_analysis_eligible(feature)、parser/source revision | 1387 覆盖、静态 Golden、bad raw/record isolation；没有实现新推理引擎 |
| 元数据维护 / alias admin | 保留明确草稿读写与来源导入；只有 Builder 激活进入公共目录 | 原 shelf 为非权威源字段，不给上层 CN 权限 | 只读/合成验证；未执行真实维护 writer |

当前是否还有旧逻辑：**有**旧 raw/shelf fixture profile、Contract serializer、元数据 producer、维护及预览脚本；矩阵单列。活动 CN 资格读取中央 flags/masks，不从这些兼容逻辑回退。不能用“JSON 已复制到多个仓库”宣布迁移完成；此候选实际替换了读端、缓存、版本 pin、子进程环境和远端分发。

是否混用 Catalog Revision：全量验证的 Python Reader、Core availability/progress、Bot masks、Node Reader、UGC loader 使用同一个已安装 Builder 产物；27 个桥接 case 各自同 scope。HTTP 并发测试确认切换后旧请求保持旧版本、新请求使用新版，响应头与子进程 env 一致。不同机器 rollout 期间可能短暂并存两代，health 明确报告，尚未做生产 rollout。

API 不可用：保留已校验 LKG、报告 stale/incomplete、不推断新的下架；无有效 Snapshot 时当前 CN 功能 unavailable。历史原始成绩及未解析 ID 保留。TJA 失败：只降低对应 feature vector/analysis eligibility，不更改官方 membership，不阻断目录、其他歌曲或已有模型推荐。

额外审计覆盖位序/历史继承等原 inventory 未命中的路径：[额外消费者](additional-consumers.json)。Center/Client 定数与成绩指标的实际宿主结果已加入安装桥接 smoke；位序分类成员从 Snapshot 冻结，已有参考表仅供排序，[成员与排序统计](position-authority-audit.json)。
