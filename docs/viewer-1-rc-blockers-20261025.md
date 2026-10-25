# Viewer 1.0 RC 阻断项收口证据

本记录对应 2026-10-25 的明确工作令，当前状态只维护在 [唯一 1.0 Release Gate 表](viewer-1-release-gates-20261023.md)。原始证据保留在 `/home/sigaer/taiko/qa-vault/evidence/viewer-rc-blockers-20261025`，历史 10 月 23 日证据未覆盖或删除。

## 初始运行基线

远程 main 为 `2d571d0ad7b1aa98aadbe285b80df807e052a9f3`；生产 checkout 为 `0b6da1f1b8a8fe4710419220abc8ecf87916cb69`，实际构件仍为 `efbbdb739db1e364d6d7cc1c74a08e59d38c87bb / 0.87.9`。PID 2523912、buildId `98b36f90-d99d-4204-8dd0-2329954f259f`，三项关键产物哈希与既有发布证据一致。Node 24.22.1、内置及产物 Undici 7.30.1、服务自启 disabled。

原工作区 main 较旧且含设计 WIP，本次使用独立 worktree。现行 title_song_relations JSON 与原工作区相同：732 条关系，关系、索引及生成时间均无新增变更，不重新提交旧差异。

## A：历史有效歌曲 SSR 500

按原证据的日志字节范围及 UTC 05:11:00–05:20:49 重新聚合，仍是 65 次、47 个数值歌曲 ID；包含不同难度与日文路由。路径计数不同于歌曲 ID 计数，不能把语言变体算成新歌曲。仅保留公开歌曲路径、允许的 difficulty/list 参数及时间，不保留 IP、Cookie、身份或完整请求。

已有 journal 的 96 条记录未包含该故障的错误栈；主要为 H3 状态信息提示，另有 Growth 时长记录。无法从它们证明页面异常、歌曲 API、UGC、缓存/数据装载或资源故障中的任何一种是根因。

少量当前匿名读取分开检查歌曲 API、UGC 和 SSR：有效页面正常；合法缺失 UGC 返回 404，但歌曲 SSR 仍 200。最初额外探针 1501 不作为历史 47 ID 的归因样本。后续明确检查历史路径 1454、580 的里谱及 1466 的日文低难度路由。小样本仅为诊断，不是在线 SLO。

隔离复制的实际 0.87.8/0.87.9 构件只替换测试 API 和启动 Worker；生产产物未动。两版本歌曲页面构件 SHA256 相同。歌曲 API 503、UGC 503/404、合法缺失、延迟与两路并发均保持可显示页面。空成功响应与非数组 artists 分别复现 `Cannot read properties of undefined (reading 'song')` 和 `input.join is not a function`，保留了具体栈；这是合成反例，不能认定为历史 65 次的原因。当前曲库及故障前每日备份的公开曲库均未发现这两项列表字段类型异常。

用户已明确授权受限生产错误观测。0.87.10 只记录指定两种歌曲路由的公开 ID、合法难度、语言、错误分类、最多六层相对代码位置；每进程每分钟最多 5 条、总共 100 条。不记录异常原文、IP、账号、Cookie、请求头、查询全文或正文，不改 Nginx。隔离真实 Nitro 错误钩子已验证：正常/API 失败状态不产生 SSR 诊断，两个未处理 SSR 反例均产生脱敏栈，响应行为不变。限额、去重、路由与敏感信息排除测试通过。

在取得真实关联证据并完成最小修复及其回归前，A 继续 BLOCKED。无故障复现不能写作修复 PASS。

## B：当前一致恢复集合

只读事务已证明生产数据库选择与 read-only 会话；仅查询表结构、权限能力及估算大小，不读取业务行。当前 35 张候选表包括旧 24 张、六张授权/审计表、Source 生命周期/创建/授权回执及工单两表；六张授权表均实际存在。现有主体具备 SELECT/LOCK TABLES 能力，无权限修改。

只读观察到 503 份 committed Publication manifest，sequence 范围 1–85；两次在线读取的 vector hash 不同，正说明它们是实时观察，不能拼成一致检查点。userdata 约 6.94 GB/89,989 文件，其中 Publication 约 2.04 GB，已有历史和冻结数据约 4.77 GB、删除 Source 保留约 0.124 GB。该统计只用于预算。

最新 verified 仍为 2026-10-17 05:03:41.240381Z、24 表/53,622 文件；原生恢复 121.165 秒保持历史身份。2026-10-25 04:15 本地每日包为 283,107,974 B，只含曲库、别名、封面及三张管理表。每日保留默认 7 日/4 周/6 月；核心检查点保留规则为不删除旧 verified 点，原子指针仅在恢复验证成功后推进。

本轮用户已另行明确授权一次当前规模检查点与隔离恢复，包括最长 150 秒静止窗口。沿用既有私有加密位置、原子完成标记及隔离恢复流程；不改调度、数据库权限、存储位置或异地/PITR。最终清单/预算和执行结果另附实际证据。旧程序禁止 Publication 的断言不能删除后直接运行旧格式：必须纳入并校验当前 committed vector 和引用对象，身份、Key、Grant、Source、历史、Growth、Goal 同一静止代次。

撤销连续性政策：完整保存检查点已有撤销与审计；不声称可重放检查点后的撤销。若连续性不能证明，恢复服务开放前使恢复的 Session、Key、Grant、待确认凭据失效，保留属主、绑定、Source、历史与审计，要求重新验证/授权。恢复到旧快照后只校验原有 revoked 行不足以证明这个政策。

目标沿用 RPO≤15 分钟、核心 RTO≤120 分钟。一次受控恢复只证明该检查点及该次 RPO/RTO，不能替代持续调度、异地或 PITR 的证据。

## C：兼容承诺与冻结

PR #37 的自动审查 P1 成立：公开兼容 Markdown 是用户可见变更，需要应用版本区分。此次按 patch 0.87.10 发布，不改历史合并标题、不绕过脚本、不复制公开文件到运行目录。现行 Schema 文件 SHA256 为 `341e6bfb04d4268c6b0f2781242ad283cf3462b50e2c2958e7f792886e81999b`，meta 的 schemaRevision 为 `30591840759a1d437e01f002f215a320673ce7ed95580d30f162756339c646db`，二者算法含义不同。

发布前公开 Markdown 仍 HTTP 404。当前真实 meta 的状态字段实际名为 `status`，值为 `FREEZE_CANDIDATE`，`contractFrozen=false`；未新增名为 contractStatus 的 DTO 字段。现有 `contractRelease` lifecycle 保持候选，此次明确不作正式 Contract 1.1 Freeze 决定；文档公开不会把状态变成 FROZEN。Developer Token 的旧跨账号当前成绩只读与 v1 的 ResourceGrant/account:read 生命周期继续分别说明。

## D：在线性能

O1 的业务成功率 99.5%、每类建议至少 200 个成功样本、原 p95/p99、1/3/5 并发和 Worker 上限不变。A 尚未归因处置时不开展本轮在线性能签收。可读取现有遥测核对资源，不将短匿名探针、构建时间或无 request_time 日志推算为在线 p95。历史 `CLOSED_ACCEPTED_RISK` 和旧 Annual 高负载失败不重开。

## 发布与执行结果

0.87.10发布提交为 `d21779a84905d68c9d6b55ed78b7c8ea2463bd69`。12项定向测试通过，真实隔离Nitro错误钩子验证通过；原run_build与未修改标准脚本发布成功，234.07秒。第一次仅包装器因可用内存不足拒绝，标准部署脚本未执行；后续服务维护结束后资源自然满足才执行，没有降低准入。BASH_ENV只指定既有Node24.22.1的PATH，使标准构建的登录子Shell也使用安全运行时，不改部署脚本。

公开More页为0.87.10，buildId `50a30255-b0a6-43c3-94f0-dfc844246b83`。兼容文档HTTP200/5151B/SHA256 `9eb8d4775317cb307d0c42dff97ea9a38e708ecabbf80bd4a7d41cde72a7f36a`。真实公共目录1503曲，通过现行OpenAPI白名单校验；chart只有difficulty和level。Schema/SDK/v1处理实现与0.87.9无变化，meta保持候选。0.87.9的.previous及0.87.8/0.87.9完整归档哈希复核保留，服务自启disabled，Node24.22.1和Undici7.30.1保持。原设计WIP未修改。

## 当前生产规模恢复的实际失败边界

用户授权后的同代捕获为UTC **2026-10-25 08:31:51.907458Z**，35表/11,308行，90,092文件/6,955,112,108B，506份Publication committed manifest。全局Writer静止、35表读锁、现行Publication内核EX锁和源inode/size/mtime/ctime前后稳定证明同代；未变更文件复用预拷贝时逐个核对该签名，变化文件在静止窗口重取。包含六张授权/审计表、身份/Session/Key/绑定、Source生命周期/回执、历史/冻结日事实/Growth/Goal及必需运行配置。加密捕获719,317,597B，仍在原私有位置与保留机制下，不改调度、权限、存储位置或异地/PITR。

首次对象闭包校验失败，服务在21.215秒内恢复；保留失败加密输出和原始校验证据。只读定位确认一份current对象和projection已不符合committed引用：期望428,002B/hash `66b61224c72bee75a583d83febfc618319897ac6f088b1457952e795b12544c7`，实际428,028B/hash `d186ad57ea8f36b20ac6106d58880b00dba63018384554bdca605fdfbf45feb2`。实际mtime为10月17日09:52:49.908Z，预拷贝及重新流式读取的坏hash一致。本轮未改该文件，不推断历史写入者或原因；这是私有Source完整性问题，不能当作公共歌曲SSR500的原因。

为完成实际规模受控隔离恢复，第二次只捕获这项已明确的损坏并如实标记 `ENCRYPTED_DIAGNOSTIC_CURRENT_GENERATION_CAPTURE_NOT_RECOVERABLE`；仍对其他对象严格校验，静止窗口19.639秒，服务全部恢复。绝不将该诊断包标成可恢复点，也未推进latest-verified。

原生MySQL还原与全文件闭包验证通过，195.887秒；35表DDL/索引/11,308行的原生值摘要及90,092文件hash全部匹配。恢复目的地是原机制下的全新私有root和实际 `_test` 数据库，实际SELECT DATABASE()/@@datadir/skip_networking及显式mutation opt-in成立；没有将生产身份恢复到生产服务。

随后按实际committed vector核对506份manifest，29,846份健康唯一对象通过；同一坏current对象恢复后仍被Publication内核拒绝。21项健康代表业务检查通过，范围明确排除这项已计入整体失败的损坏源，不能据此宣称整体恢复成功。恢复中的Session、Key、client、ResourceGrant、source service grant及待确认凭据全部fail-closed；撤销/授权审计保留，原Goal和measurement值不重算。旧凭据无法复活，检查点后撤销没有replay能力，因此恢复服务仍须保持入口与后台Writer关闭，重新登录、源验证和授权后才能开放。

在同代捕获文件清单、最新旧verified点和另一个旧完整点中查找精确committed hash，均没有匹配。额外26字节也不是可验证的简单前后缀或尾部空白；没有删除字段、截断正文、改写hash或混用无法证明一致的旧数据来使校验通过。需要可信canonical副本，或另行裁决源数据修复；当前工作令禁止生产验收真实业务写入，故没有擅自修复生产Source。

RPO≤15分钟、RTO≤120分钟仍未签收。诊断捕获至隔离恢复开始的年龄、原生耗时及完整工作流耗时分别记录于 `backup/rpo-rto.json`；原生195.887秒低于目标不代表整体RTO通过，健康代表HTTP也不能替代损坏Source和核心写入恢复。有效verified指针仍是10月17日旧点，不能据本次诊断包宣称当前持续RPO达标。

所有owned MySQL、HTTP及桥接子进程退出后清理了本轮明文恢复副本；私有加密诊断包、失败尝试、SQL摘要、原始坏对象证据及旧verified点保留。没有改生产数据库业务行或Source正文。

## 最终资源及RC结论

最终只读服务快照：RSS265,120KiB，cgroup当前221,061,120B，swap0，PSI full avg10=0，当前high/max/OOM计数均0；服务重启后的短窗口不证明长期容量。原生恢复QA采样峰1,364,357,120B、RSS合计峰396,932KiB，当前代验证峰1,140,924,416B；两者OOM计数增量0。每次QA仍2/3GiB、两CPU、15分钟，构建仍4/5GiB和原超时/互斥；没有准入豁免。新构建瞬时峰没有完整捕获，保持边界，不沿用旧构建的峰值。

A历史归因BLOCKED；B有效恢复集合BLOCKED，真实规模原生还原与fail-closed验证已完成；C公开兼容承诺PASS，正式Contract1.1 Freeze仍NOT VERIFIED；D在线性能NOT VERIFIED，未违反前置条件提前压测。业务成功率与代表路由的p50/p95/p99、热冷容量均没有本轮合格时间队列。旧O1/Annual接受风险不重开。

**不能进入1.0 RC，未准备RC。**
