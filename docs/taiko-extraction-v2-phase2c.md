# Taiko Application Extraction — Phase 2C

日期：2026-10-12。状态：**PHASE_2C_COMPLETE**。仅完成 query/application layer 抽取与验证，完成后停止；不授予全量 Application 完成、PLATFORM_COMPLETE 或 1.0_READY 标记。

## 交付与边界

基于 Phase 2A/2B 功能分支，独立子项目 `packages/taiko-application/` 升为 **0.3.0**，新增 `taiko_application.query`。Core **0.1.1**、Contract **0.1.0** 的依赖声明及安装版本不变。Viewer 生产基线仍为 **0.81.12**。

| 能力 | Context / Provider | Application 输出 | Sakura 保留 |
| --- | --- | --- | --- |
| song query | `SongQueryContext`，注入 similarity 与可选 lazy group provider | 曲目行、匹配模式；保留精确名称/ID/别名/部分/模糊顺序 | 命令、catalog 获取、既有 fuzzy matcher、group cache |
| alias query | `SongQueryContext` 的预备 alias/group 输入 | 曲名、别名列表、展示 ID | alias 文件读取、group 获取 |
| constant query | `ConstantQueryContext`、`PaginationContext` | `ConstChartRow`、分页行与页数 | 曲库读取、定数图片 renderer |
| progress summary | `ProgressQueryContext`，既有 Core catalog 输入与预备成绩/可用谱面集合 | 进度候选、汇总；继续调用 Core | catalog/cache、成绩获取、进度图片 |
| recommendation explanation | `RecommendationContext`，预先计算的 rating/普通推荐/目标推荐结果 | rating、普通推荐、目标推荐解释 DTO | score_calculator/target_recommend 计算、CLI、数据获取 |

六个 Sakura 查询模块保留原公开入口，构造 Context 后委托 Application。兼容导出的模型、格式化辅助与常量指向同一 Application 实现。command、auth、data loading、message sending 均留 Sakura。非 ID 精确/部分匹配所需的 group 获取保持懒调用，显式 ID 与 fuzzy 路径不新增该读取。

Application 不导入 Sakura、不读取 userdata/catalog 文件或 SQL、不调用网络/Writer。Context 引用的数据由调用者持有，请求期间保持稳定；外部 Provider 的实现及其授权、IO 仍属宿主。没有迁移 storage、Writer、SQL、sync、daily/history，也没有整体迁移 score_calculator、修改 Core 公式或 Contract。此次未抽取或重写新的图片 renderer。

## Query parity

参考为 Phase 2B 冻结的六个旧源码文件，完整 SHA256 记录于测试 provenance。`const_query`、`duplicate_versions`、`progress_catalog`、`progress_star` 与读取到的 P0 runtime 文件字节一致；`taiko.py`、`recommendation_intelligence.py` 整文件存在既有差异，因此仅对本次相关七个函数核对 AST 内容一致，不宣称整文件等同生产。

测试使用同一合成曲库、别名、成绩摘要和预计算推荐结果，不复制玩家 userdata。五个小型旧模块完整加载；巨型 `taiko.py` 则选取并实际执行三个完整、未修改的查询函数体，避开 NoneBot 注册及其他启动副作用。只替换数据获取和上游计算结果 Provider，不替换匹配、过滤、排序、分页、Core 运算或 DTO 投影。这是执行 parity，不是 AST-only 验收。

| 范围 | 用例数 | 结果 |
| --- | --- | --- |
| 曲目：精确名称/ID/别名/部分/模糊、重复曲目、空库、非法输入 | 11 | PASS |
| 别名：分组/显式 ID、无结果、空/非法输入 | 8 | PASS |
| 定数：正常、在架过滤、空结果、非法值 | 7 | PASS |
| 分页：第一页/第二页、越界、空结果、非法页码/页大小 | 9 | PASS |
| 进度候选与汇总：重复谱面、FC/DF、无成绩、非法输入 | 17 | PASS |
| 推荐解释：普通/目标/rating、空结果、非法 basis | 10 | PASS |
| **总计** | **62/62** | **PASS** |

逐项比较 **旧 Sakura = 新 adapter = 直接 Application**：字段/行顺序、数值、空值、完整结果、异常类型和消息；同时比较宿主数据获取顺序并确认 fixture 未被修改。9 个非法输入用例必须保留旧异常，其余 53 个用例必须成功返回，不能以双方同时报错充当正常用例通过。

真实 wheel 安装到独立 `/var/tmp` target，在非 Sakura cwd 的新进程重放八组结果，覆盖五类能力及分页：**8/8 PASS**。阻止 Sakura/SQL/网络模块依赖，执行查询时禁止所有文件 IO。未安装到生产虚拟环境，未运行完整 Bot 会话或真实数据库查询。

## 既有能力回归

- Phase 2A：段位图片 **4/4 PASS**，解析 **6/6 PASS**；2025 六段 dynamic-rate PNG SHA256 仍为 `474e31251e977817840770198769d5b63d8ef9228414ffd48629992f2b2fc4df`。
- Phase 2B：成绩图片 **25/25 PASS**，必需模板缺失错误 **3/3 PASS**，独立图片重放 **4/4 PASS**；比较 PNG bytes、pixel hash、dimensions、mode。
- 源码范围检查：六个宿主文件中 **328** 个非抽取函数/类 AST 不变；已有 Application 段位/成绩实现未修改。没有运行生产 Writer、daily 或用户历史读取。

所有 QA 经既有 `scripts/memory/run_qa.sh` 隔离执行。查询 parity 0.593 秒、最大 RSS 61,208 KiB；独立查询重放 0.002 秒、最大 RSS 19,284 KiB（耗时仅计查询执行）；成绩回归 41.412 秒、最大 RSS 180,468 KiB；段位回归 16.245 秒、最大 RSS 101,432 KiB。记录的 memory.events high/max/oom/oom_kill 均为 0；不宣称测得内核未提供的 cgroup memory.peak。

## 提交与证据

两个仓库已提交并推送 `feature/taiko-application-phase2c`，工作树干净，未合并 main：

| 仓库 | 提交 | 独立工作树 |
| --- | --- | --- |
| [taiko-bot](https://github.com/sigaer/taiko-bot/commit/79fba5cd8d63c81b48ae102cac905d56d510a1b3) | `79fba5c` | `/var/tmp/taiko-phase2c-20261012/application` |
| [Sakura_bot](https://github.com/sigaer/Sakura_bot/commit/440a7f39a1bd36a1650332d923c4913f721c027f) | `440a7f3` | `/var/tmp/taiko-phase2c-20261012/sakura` |

- [查询 parity 完整输出及 hash](/var/tmp/taiko-phase2c-20261012/parity/parity.json)
- [独立安装重放](/var/tmp/taiko-phase2c-20261012/standalone.json)
- [Phase 2B 回归](/var/tmp/taiko-phase2c-20261012/score-regression/parity.json)、[独立图片重放](/var/tmp/taiko-phase2c-20261012/score-standalone.json)
- [Phase 2A 回归](/var/tmp/taiko-phase2c-20261012/dani-regression/parity.json)
- [函数变更范围](/var/tmp/taiko-phase2c-20261012/scope-audit.json)、[生产相关函数静态核对](/var/tmp/taiko-phase2c-20261012/runtime-query-provenance.json)、[最终审计](/var/tmp/taiko-phase2c-20261012/final-audit.json)
- [包说明与复现步骤](/var/tmp/taiko-phase2c-20261012/application/packages/taiko-application/README.md)：测试、合成 fixture、参考源码 hash 已提交。
- wheel：`/var/tmp/taiko-phase2c-20261012/wheels/taiko_application-0.3.0-py3-none-any.whl`；SHA256 `ee47845c2fff42132456b3f2fa187348d0ae8302b4c4d50db50a027771e8b064`。

原工作区 WIP 保留，生产运行树未修改，没有部署、重启、生产包安装或数据库连接。当前交付是功能分支候选；此次文档不触发 Viewer 版本变更。完成后停止，没有启动下一阶段、Phase 6 或全量 Application 重构。
