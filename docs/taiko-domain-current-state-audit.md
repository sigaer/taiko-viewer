# Taiko Domain Phase 0：现状审计

日期：2026-10-10（Asia/Shanghai）。执行依据：[Execution Plan v2](Sakura_Taiko_Domain_Extraction_Execution_Plan_v2.md)。**Gate 0：PASS**，只表示抽离现状审计完成，不表示线上安全、恢复或 1.0 发布 Gate 已通过。

## 0.1 仓库清单

| 项目 | 当前 HEAD（fetch 后与 origin/main 相同） | Runtime / language | 入口 | Dependencies | Storage | API |
| --- | --- | --- | --- | --- | --- | --- |
| Sakura_bot | `5ac44b3` | Python 3.11，NoneBot/ASGI；内容后端 Java/Spring | `taiko/bot.py`、`plugins/taiko.py`、`server.py`、sync dispatcher | NoneBot、HTTP clients、Pillow、数值/绘图库、PyMySQL；Taiko 还依赖根级 runtime | 中心 userdata current/full/delta、daily ability、MySQL binding/credential/locks、公共模型文件 | Wahlap/Hiroba acquisition、public-score、Viewer v2 constants/internal service |
| taiko-bot | `46c8646` | Python、NoneBot/FastAPI | `bot.py`、`plugins/taiko.py`、`viewer_client.py` | OneBot/QQ、HTTP clients、Pillow、数值/绘图库、SQLite | disposable userdata/history cache、SQLite、本地公共资源 | Viewer developer userdata、center proxy、internal manual account |
| Viewer | `8d70df2` / 0.81.10 | Node 24.13 / TypeScript / Nuxt 3.21.11，Python bridge | Nuxt/Nitro API、`server/services/account/personal.ts` | mysql2、undici、Sharp、Playwright 等 | Web account/Forum/Goal/measurement MySQL；中心 JSON；产品缓存 | `/api/account/*`、`/api/forum/*`、`/api/developer/*`、`/api/taiko/*` |

完整入口、依赖与运行态边界见 [repository inventory](platform-architecture-audit/repository-inventory.md)。中心运行树 `/home/sigaer/taiko` 与 Sakura_bot 仓库不是同一路径；旧审计 146 个同路径文件有 8 项差异，后续迁移必须逐项处理，不以仓库提交代替运行部署。

## 0.2 每文件分类

- [module-classification.csv](taiko-domain-extraction/evidence/module-classification.csv)：1,180 个既有审计源码，当前流式 SHA-256、四类责任、后续位置和 mixed 标记。
- [tracked-file-classification.csv](taiko-domain-extraction/evidence/tracked-file-classification.csv)：1,840 个相关已跟踪路径，包含测试、说明、catalog/model/asset 输入；仅枚举资源路径，不读取个人数据。Sakura 取 taiko/taiko_backend/taiko_manager；Viewer 取 taiko_viewer/scripts/deploy；另见原审计源码清单中的跨目录平台依赖。
- 类别只有 Domain、Adapter、Infrastructure、Presentation，unknown 为 0。分类是当前主要责任；mixed 明确保留需按函数切分的边界，不声称每个混合文件都可整文件抽离。非领域 package/build/runtime wiring 留在宿主。
- Rating、六维、score/chart 模型、纯解析、推荐候选/评分属于 Domain。命令、HTTP、权限属于 Adapter；数据库、网络采集、认证、文件与 publication 属于 Infrastructure；图片、Vue、客户端格式属于 Presentation。
- Viewer Growth/Goal 的产品规则仍由 Viewer 定义；提取公共成绩规范与 Canonical Fact 接口不改变 Goal 生命周期、来源排除或事实归属规则。

## 0.3 重复逻辑

见 [duplicate logic report](duplicate-logic-report.md)。两个 bot 的 53 个配对文件、10 个整文件相同、718 个同名 AST 相同函数是旧审计观察，不等于全部端到端行为一致。当前复核未发现 Rating/六维/推荐源码漂移。

已证实分叉包括 v2 精度公式、Top20 权重/满分参考、谱面可用过滤、目标推荐模型和历史消费。Viewer 主要数值调用中心 Python，另有成绩规范化与 Growth 事实解释。抽离不能使 taiko-bot 的既有结果悄然变为中心结果。

## 0.4 数据流与权威

见 [data flow map](data-flow-map.md)。上游产生官方成绩；中心可编辑 JSON 是平台 current state，不是不可修改的游玩日志。Python acquisition、Viewer 编辑/导入、dispatcher、merged derived writer 均有写入路径。taiko-bot 正常模式只缓存中心读结果。History 是观察证据，daily ability/SQL measurements 是当时测量，Growth fact 是基于证据的投影，三者不能合并成同一个时间语义。

## 决策与后续 Gate

1. Contract 使用语言无关 JSON Schema + Python/TypeScript bindings；身份采用命名空间，禁止把 Web user、QQ identity、taikoId 或 developer identity 当作同一个 ID。纯 contract 不携带 cookie/token。
2. Core 使用 Python，独立仓库 `sakura-taiko-core`；原因是现有权威数值和两个 bot 都是 Python，可保持浮点/排序语义。Core 接收显式 records/catalog/model/availability/clock 输入，不访问框架、HTTP、SQL、filesystem、UI。
3. 既有 v1/v2 及 A/B 已证实差异作为显式算法 profile 冻结。实现共用相同内核，差异通过策略参数；不建立第三套未经 parity 的公式。不在抽离阶段改变生产语义。
4. 暂保留部署宿主和 JSON；API/contract boundary 先行，Phase 6 再决定 publication/Writer/Read Model/DB。不因 extraction 直接全面数据库化。
5. 每阶段保留版本 pin、adapter 与兼容测试；旧实现通过 Git commit/tag 可恢复，切换前有离线 Golden parity。不可把尚未实测的命令/线上路径写为 PASS。

## 证据复核与边界

[phase0-validation.json](taiko-domain-extraction/evidence/phase0-validation.json) 记录 fetch 后的完整 SHA、分类计数和复核。通过 `bash scripts/memory/run_qa.sh /usr/bin/python3 /var/tmp/taiko-domain-extraction/phase0.py` 执行。1,180 项中唯一旧 hash 不符为 `taiko/plugins/utils/twso.py`，其当前文件 hash 与 `git show HEAD:path` 完全一致，无本地 diff；将它作为旧证据过期记录，当前清单覆盖旧 hash。它属于 transport infrastructure，不影响此次已确认的计算分叉。

本阶段没有改实现、移动源码、创建 package、读取私人 userdata、业务 HTTP、DB 连接、部署或重启。原有 miku 工作、taiko-bot web.conf、Viewer 其他未跟踪报告/测试均保留。历史报告里的“未授权迁移/STOP FOR REVIEW”只描述过去审计；本次用户已授权 Phase 0–6，执行顺序以 v2 为准。安全/可靠性发现仍有效，须在对应边界阶段闭合。
