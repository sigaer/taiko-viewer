# 功能责任矩阵

分类：**Implemented**＝该对象有实际执行的实现；**Consumed**＝读取已有结果；**Delegated**＝把计算/写入委托给另一对象；**Unknown**＝未证实产品能力或运行可达性。一个格子可分子职责，不能把“有文件”当成正在运行。

A 表示 Sakura_bot 的 Taiko 服务及其已追踪外部依赖；R 是它实际调用的中心运行树。证据和版本见 [Inventory](repository-inventory.md)。

| Capability | Sakura_bot | taiko-bot | Viewer |
| --- | --- | --- | --- |
| 用户绑定 | **Implemented**：聊天 identity → MySQL bind；手动账号 **Delegated** 给 Viewer | **Delegated**：中心 bind 查询/更新/切槽；**Implemented**：本地 identity 适配与残留 SQLite | **Implemented**：Web 账号、称号变更验证、QQ 绑定、中心 bind API、手动认领 |
| 成绩读取 | **Implemented**：Wahlap/Hiroba 拉取、JSON 读取 | **Consumed**：中心 userdata/history；**Implemented**：本地读缓存和 u0 派生读取 | **Implemented**：直接 JSON 读取及账号归属解析；**Consumed**：中心采集结果 |
| 成绩解析 | **Implemented**：Wahlap 规范化、Hiroba HTML/徽章转换 | **Implemented**：缓存记录适配、Hiroba parser/client；官方成绩同步 **Delegated**，本地 sync/Writer 活跃入口 **Unknown** | **Implemented**：编辑输入、Kinoko 导入、achievement 重建、Growth 时间及证据解释 |
| 谱面解析 | **Implemented**：tjaAnalyzer、roll/branch parser、merge_index、元数据生成 | **Consumed**：公共 TJA 统计/曲库/资源；独立完整 TJA analyzer 执行链 **Unknown** | **Consumed**：note counts/roll 数据；TJA 下载索引 **Delegated** 给 R 的 merge_index；**Implemented**：内容字段映射 |
| Rating | **Implemented**：v1/v2 Python | **Implemented**：自己的 v1/v2 Python 副本 | **Delegated**：个人/工具计算调用 R Python；**Consumed**：结果展示 |
| 六维 | **Implemented**：v1、v2 两个命名/公式空间 | **Implemented**：本地 v1/v2；v2 精度维度已与 A 不同 | **Delegated**：基础数值；**Implemented**：Growth priority/sufficiency、measurement 与显示投影 |
| B30 | **Implemented**：选择、去重、聚合、图片 | **Implemented**：本地选择/聚合/图片 | **Delegated**：charts.ts → R/b30_render；**Consumed**：图片 |
| 推荐 | **Implemented**：普通、目标推荐、推荐桥接 | **Implemented**：普通和目标推荐，目标模型明显分叉 | **Delegated**：Python 排序；**Implemented**：今日计划、Goal 可选项、接口投影 |
| Goal | 目标推荐 **Implemented**；Viewer Goal 生命周期能力 **Unknown**，不能将“目标推荐”算作 Goal | 同左，目标推荐 **Implemented**；Web Goal 状态服务 **Unknown** | **Implemented**：创建、baseline、证据验证、评估、完成/取消及 DB 持久化 |
| Growth | **Implemented**：growth_compute、daily ability、趋势；完整 Web Growth 产品 **Unknown** | 趋势/历史消费 **Implemented**；Viewer Growth/Passport 状态服务 **Unknown** | **Implemented**：daily facts、history、recent cursor、weekly/passport、measurement；数值内核 **Delegated** |
| Forum | **Unknown**：未发现独立论坛业务实现；年度报告命令不是论坛 CRUD | **Unknown**：未发现论坛业务实现 | **Implemented**：thread/reply、权限、关系、通知、UGC 与账户集成 |

## 关键调用链

1. A：`bot.py` → TOML 插件加载 → `plugins/taiko.py` 命令 → `getUserData` / Hiroba → `save_userdata` → C/H + daily archive。[E01](evidence-index.md#e01)、[E05](evidence-index.md#e05)
2. B：`plugins/taiko.py` → `viewer_client.proxy_center_*` → Viewer → R；读取返回值写 disposable cache；之后调用自己的 `score_calculator`/`target_recommend`/`b30_render`。[E02](evidence-index.md#e02)、[E03](evidence-index.md#e03)
3. Viewer：account API → requireAccountUser → current binding → `personal.ts` → Python；`getPlayerGrowthOverview` 再定义成长状态、记录 measurement、派生计划。[E07](evidence-index.md#e07)、[E19](evidence-index.md#e19)
4. Viewer：history API → 读取 C/H → `dailyProgress` replay → `projectScoreFacts`；Goal completion 另从 DB 加入；Passport 再合并 daily archive/measurement。[E20](evidence-index.md#e20)

**判定：taiko-bot 属于情况 3（混合）。** 不是纯客户端，也不是完全独立的中心服务。接入中心解决了数据抓取入口的一部分统一，但没有统一算法执行。Viewer 同样不是单纯 Vue 壳：它持有独立产品事实和多个写入入口。
