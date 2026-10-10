# Phase 3：Sakura adapter 验收

2026-10-11，Asia/Shanghai。前置 Gate 0/1/2 PASS。**Gate 3 PASS**。
依据 [Execution Plan v2](../Sakura_Taiko_Domain_Extraction_Execution_Plan_v2.md)，
每一步记录如下；[验证证据](evidence/phase3-validation.json)及
[文件同步清单](evidence/phase3-runtime-sync.json)可复核。

| 步骤 | 完成产物 | 验收 |
| --- | --- | --- |
| 3.1 领域所有权 | Core 0.1.1，47 个纯 Python 模块；Rating/六维/解析/谱面/推荐/估分及剩余数值内核 | 23 项独立安装 tests，源码与 wheel 字节一致；Core 无框架/HTTP/SQL/文件 IO |
| 3.2 Sakura adapter | 旧入口委托固定 Core；33 个发布文件；宿主保留 command/permission/消息/图片/HTTP/鉴权/文件/缓存 | 132 项回归 PASS；9 项线上记录测试排除并拦截读取 |
| 3.3 输出与性能 | 冻结旧源码 Golden，实际命令解析/格式函数；一次加载谱面索引；v2 宿主缓存仍被调用 | 命令模块字节相同；完整谱库 200 条合成记录画像/5 个估分一致；约 0.48 秒 |
| 3.4 提交/依赖/同步 | 两仓库 push；完整 revision pin；系统 user site 与 taiko venv 安装；选定文件先比对、备份、逐文件替换 | 33 文件均与发布源码 hash 相同；旧文件全部与基线相同；无 data/secrets 复制 |
| 3.5 生产切换 | 原 `taiko` screen 内 `nb run`；public-api、sync-receiver 重启 | 旧 PID 退出、新 PID 启动；startup/太鼓插件/QQ/OneBot PASS；公开谱库 200、dispatcher health PASS |

## 发布与算法语义

- Core commit [`9fc0731`](https://github.com/sigaer/sakura-taiko-core/commit/9fc0731358f6863c1e1efd9f1930a608850786f7)，tag `v0.1.1`，origin/main 与 tag 推送完成。
- Sakura commit [`95d71d5`](https://github.com/sigaer/Sakura_bot/commit/95d71d57d109d756cb129610051af40a989f016f)，版本 `9.80.7`，origin/main 推送完成；taiko package `0.2.1`，依赖最低 Python 3.11。
- Sakura 验收补记 `70d96cd` / `9.80.8` 只改文档并同步；运行代码不变，不重复重启。
- Contract package `0.1.0`，固定 Viewer `23f89b4f70e5a64ae76c33ac04c6c2d242808df1`。
- Wheel：Core SHA-256 `76294144080b8816331cfce02b6363749078ab60fb048c1b72767387d989b273`；Contract SHA-256 `61c63fda6949c6c8c4f84dd63b170482cc127dcf957facad056663bcf6f240d7`。

仍使用 `v2-center-20261010`，保留中心准确率阈值、超物量拒绝、DF 例外，以及原目标推荐策略。
名称/难度显示、command registration、permission 和消息格式不改。Hiroba/TJA、分数线、同曲身份、
星级/在架/国行实装、目标选择、段位和基础计分由 Core 提供值规则。
宿主提供文件内容、时钟、grade names 与 cache；token/鉴权 helper 未搬入 Core。
Annual 产品 Gate 不改，个人数据/Writer/存储仍按 Phase 6 顺序处理。

## 验证细节与已处理问题

新 Golden 包括 5 组估分上下文、54 组目标选择、24 组分数线、7 组谱面分析、
7 组路径校验、3 组段位、9 组基础计分，以及谱面匹配/索引/称号/可用性/进度。
旧 252/168/144/126/60/96 组领域 Golden 继续通过。
全部 fixture 为合成输入。生产 installed tests 另外使用实际系统 Python/BeautifulSoup 依赖完成 23 PASS。

初次广泛回归有两项未在名字标明线上依赖的历史测试读取生产成绩，固定断言已经过期。
新旧实现只读对照的 4 个结果相同；没有 DB 访问/写入，也未保存个人输入。
后续离线 runner 会拦截生产个人文件、生产目录写入及实际 HTTP，并排除这些历史用例。
上面的 132 PASS 来自该隔离运行。命令测试只 AST 加载真实命令函数，避免注册 NoneBot 或发消息。

完整谱库有 1,348 个候选谱面；200 条合成记录的旧/新画像样本相同，5 个估分相同。
旧加载 0.4470 秒，新加载 0.4779 秒。修正了初版委托绕过宿主 v2 有界缓存的问题，
并新增实际缓存入口委托测试；索引一次加载还减少了自定义谱库的重复文件读取。

## 运行与回退

NoneBot `374046/374061` → `829369/829379`；public-api `3263424` → `829173`；
sync-receiver `646803` → `829176`。应用 startup 完成，太鼓插件加载，无 import/startup error，
QQ 与 OneBot 接入成功。接口检查仅 GET，没有生产 DB mutation。
Viewer 无运行代码变化，因此没有 Viewer version bump、构建或部署。
原有其他项目用户修改未纳入提交；非服务的一次性后台任务未重启。

选定旧文件备份位于运行机器 `/var/tmp/taiko-domain-extraction/phase3-runtime-backup/`，
原实现 Git baseline 为 `5ac44b36e2e170e84641adf124d77f1e998f4039`；
已存在文件恢复备份，新增 adapter 文件按清单删除，再重启同一 NoneBot 与两个服务。
不删除/回写业务数据，不依赖复制生产记录的 fixture。
Core 0.1.0 的 tag/wheel 仍保留；旧应用不导入新包，回退应以整组源文件为单位。

所有 QA/包构建/安装都经过 Viewer `scripts/memory/run_qa.sh`，无并发 build/QA。
启动详细日志在机器私有临时目录中，未写入 Git；仓库证据仅保留状态、版本、hash 和 PID。
