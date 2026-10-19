# Rating／六维／普通推荐跨端一致性

2026-10-19。范围仅为当前 Web、中心/客户端 Bot、Developer API 的 V1 综合 Rating、六维与普通综合推荐。目标推荐、Growth、Goal、迁移及更多 API 参数均未改动。版本按实际兼容缺陷发布 patch，工作包不绑定路线版本号。原主控计划只增补版本管理说明，历史证据不改写。

## 输入与实际入口对照

共同数值来源为既有 Core；JSON 投影复用 Application `query/recommendation.py`。成绩 `song_no` 对应 song ID，成绩 `level=4/5` 是鬼/里**难度档位**；目录 API 的 `level` 是星级，不能作为连接键。查询均保留原歌曲 ID，匹配采用 `(id, difficulty)`，同曲组回退也保持难度档位。

| 入口与调用链 | 输入快照/曲库 | Profile、数量、去重与过滤 | 舍入与缓存边界 |
| --- | --- | --- | --- |
| Web `/api/account/charts/summary` → `personal.getPersonalRatingSummary` → installed `recommendation_intelligence rating` → Core + Application | 本人会话当前 binding；Publication shared lease 中的 current；rating structured + song_data | V1 `per-dimension-top20`；Rating 和每个维度各自 Top20 补偿聚合；保留重复版本 | JSON 6 位；无结果缓存；读前/后验证 binding；`private,no-store` |
| Web `/api/account/recommendation` → `getPersonalRecommendations` → installed `ordinary --basis rating --limit 3` | 同上；中心 song_data/raw 国服实装及上下架输入 | 普通综合；3 项；推荐合并版本、best20 参考中位数，分配已玩/未玩候选 | Application 6 位；同一 score/binding lease，无结果缓存 |
| `/tools/recommend` → `/api/account/charts/recommend?n=20` → `charts` → installed `viewer.compute_recommendations_for_user` → Core | 同一 binding/Publication；同一中心曲库；修复后不再以投影文件存在性代替 canonical current | 默认综合20；页面允许1–50与单维选项；同数量/basis 才与 Developer 比较 | 排序、分组取自原业务行；图片显示2位指标/百分比、1位推荐指数；无 OCR；无服务端结果缓存；绑定或账号变化清除/拒绝晚到图片 |
| Developer `/api/developer/userdata/:userid/{rating,recommendations}` → `developer-analytics` → installed offline adapter + Application | 独立 Developer Token/既有 service grant，或既有本人会话；授权读取捕获 songs；执行前后重新读取并验证内容摘要。u0 延续既有 merged-source 读取 | Rating固定Top20、保留版本；Top30只是详情；综合推荐固定20、合并版本。未新增参数 | JSON6位；`scoreRevision` 是 songs/meta 摘要；ETag基于整个响应；每次含条件请求都重做授权/计算/版本证明，不缓存计算结果；进程槽/flock/退出释放 |
| 中心 Bot `taikorec rating 20` → matcher → `TinfoHostProvider` → `prepare_result` → center recommendation adapter → Core → Application command/delivery | 当前中心权限、绑定与捕获 current，发送前重新验证；中心 song_data/raw | 中心 V1 推荐；数量1–50；同曲组按难度识别；实装/在架候选 | 业务浮点不提前舍入；实际渲染前观察行；身份上下文不跨请求；曲库缓存按文件 mtime 失效 |
| 中心 Bot `taikob20 v1 -r` → 实际 matcher/provider → B30Ports → Core → 原雷达 renderer | 同一 provider 捕获 current；同一 structured/身份曲库 | 明确 V1、N20。**既有命令 `collapse_duplicate_versions=True`**；不等同 JSON 的 preserve Profile | JSON对照容差0.5×10^-6；图片2位；原 renderer 仍计算聚合；卡片/聚合身份缓存均随曲库刷新 |
| 客户端 Bot 对应 matcher/provider → client adapters → Core `recommend-client-20261010` / pair namespace | 当前远端绑定和 private read；服务权限域不改。客户端成绩缓存按服务身份/来源区分，复用仍需实时授权；公共分发 song_data 和 structured | 历史客户端可见性/在架规则、pair 分组保留；普通数量规则同上；B30明确V1对照 | Core0.1.2 Profile保留；长驻 visibility/分组缓存改为曲库版本失效；没有引入新的缓存系统 |

有意差异：中心 `taikob` 默认是 v2，本轮 V1 对照显式指定 v1；B30 的 N≠20 延续算术均值，不能用30详情要求 JSON 改按30聚合。Bot B30 的 collapse 与 JSON Rating 的 preserve 不同，合成双版本用例分别断言25/26样本；普通推荐仍合并为同一个谱面身份。中心使用国服 raw 实装，客户端保留其既有可见性 Profile；来源状态不明时保留各 Profile 原规则，未改公式或权限。

## 源码、部署、安装身份

开始时远端实际 main：Viewer `b1f1110` / 0.85.0；Bot `54f1f8c` / 0.16.1。原打开的 Viewer main 为 `56aa05a`，含用户未提交文件，未重置或暂存它们。本轮使用独立 feature worktree。

实测安装身份（非 editable、`-I` 导入）：

| 运行位置 | Bot | Application | Core | Contract |
| --- | --- | --- | --- | --- |
| 发布前 Viewer 实际解释器（历史 role-center wheel） | 0.14.2 | 0.8.0 | 0.1.1 | 0.1.0 |
| 发布前中心 Bot `/opt/taiko-bot/current` | 0.16.1 | 0.8.1 | 0.1.1 | 0.1.0 |
| 本轮中心候选 wheel 安装 | 0.16.2 | 0.8.1 | 0.1.1 | 0.1.0 |
| 本轮客户端候选 wheel 安装 | 0.16.2 | 0.8.1 | 0.1.2 | 0.1.0 |

基线真实 RECORD 摘要见 `qa-ce5ab26865ef/evidence/installed-identities.json`；候选验证另外检查 wheel SHA、安装 RECORD、每个修改模块与源码的 SHA，不用历史迁移版本号代替当前身份。Core/Application 未修改、未发新版本；中心与客户端的 Core 依赖继续各自固定。Viewer 发布同时校准已有 Python interpreter override，加载本轮已验证的中心 wheel。

## 确认的缺陷与最小修复

1. **曲库缓存不失效。** path-only LRU 把 stat 一起缓存，长驻进程继续使用旧分组；客户端 visibility index 和 import-time pair map 也会过期。`qa-59244577546d` 在生产已安装旧 wheel 上用纯合成曲库复现 `afterSame=false`，预期 true。保留原 LRU 上限，查询时检查 mtime，按版本缓存；聚合/卡片/普通推荐获取当前分组。客户端 import-time 分组还会调用尚未定义的 `load_json` 而落入空组，改为实际 JSON 读取，并在请求中复用既有 catalog adapter。
2. **空候选过滤被关闭。** Core旧接口将空 availability set 当作未传过滤器。`qa-d9dab46a8764` 中所有48首下架后仍返回20推荐。仅在宿主适配边界对确认为空的当前可用集返回空列表；正常候选排序和 Core公式不改。
3. **推荐图片未复核绑定。** `qa-e593c41f31b3` 在计算等待期间切换 binding 后仍返回200，预期409。图片复用 JSON 已有 `withPersonalScoreRead`，持有 score lease 并验证读前/后 binding。
4. **前端晚到结果串账号。** `qa-d0436f765de6` 中账号A请求在切到B后设置 `blob:synthetic-1`。复用现有 account-user、account-binding-generation，取消旧请求并丢弃其晚到成功/错误；切回与卸载亦释放 object URL。没有增加可见文案或重做页面。
5. **部署构件偏离源码依赖。** Viewer 的 interpreter override 仍加载0.14.2/0.8.0。通过既有部署过程切至已验证的0.16.2/0.8.1安装构件，保留上版环境与输出供恢复。

## 可运行验证

`tests/ratingEntryConsistencySql.test.mjs` 同一次测试创建 synthetic current/曲库，分别调用实际 H3 HTTP routes、真实 session/Developer SQL授权、真实 Python worker、Bot实际 OneBot matcher/命令/provider。只替换外部消息、中心只读SQL/客户端上游传输以及推荐像素边界；计算、参数、过滤、私有缓存与发送前权限验证均实际执行。Bot Rating使用原雷达 renderer 的聚合并观察渲染前值；不 OCR。

固定基线：正常25成绩、48候选曲库；Rating **7.772054**，六维依次 **7.198173 / 6.304349 / 6.425044 / 8.390748 / 3.548068 / 6.085352**。20项推荐的 ID、档位、已玩分组和原排序逐项固定断言；没有通过重排或放宽容差隐藏差异。Top20内相同谱面参数的独立聚合断言与固定数值同时验证。JSON六位舍入对应原浮点容差≤0.0000005。

矩阵包括空/单条/不足Top20与30、75%两侧、低于Rating阈值但已玩、缺失曲库难度、无里谱、未知ID、双版本、全下架无候选、未知来源状态、成绩发布更新、曲库修改与切回。另验证两个真实session隔离、实际绑定切换/切回、切换中的409、无效维度400、无登录401、撤权401、Developer准入释放与原worker锁/超时路径。授权仍分为本人会话、Bot provider权限、Developer Token；未统一凭据。

复验：准备受保护的 candidate/roles manifest（解释器与wheel SHA）后，执行：

```sh
QA_ARTIFACT_MANIFEST=/absolute/protected/rating-entry-manifest.json \
  bash scripts/memory/run_qa.sh /usr/bin/python3 scripts/readiness/run-rating-entry-qa.py \
  --bot-source /absolute/taiko-bot --sql
QA_ARTIFACT_MANIFEST=/absolute/protected/rating-entry-manifest.json \
  bash scripts/memory/run_qa.sh /usr/bin/python3 scripts/readiness/run-rating-entry-qa.py \
  --bot-source /absolute/taiko-bot
```

SQL runner启动空的独立 MySQL，先验证实际 datadir 和 `SELECT DATABASE()=viewer1_security_test`，再向子进程设置 `TAIKO_ALLOW_TEST_DB_MUTATION=1`。没有生产成绩复制、绑定切换或授权修改。退出检查 MySQL、loopback server和worker关闭。QA/build串行通过既有cgroup/maintenance锁。

## 发布记录

选择 Viewer **0.85.1**、Bot **0.16.2**：均为现有功能的兼容缺陷修复。Core、Application、Contract及其他仓库不改版本。称号关系JSON相对实际main只有生成时间刷新，关系、统计和索引无语义变化。

当前验证/PR/部署最终结果随本轮执行补入此节；不另建 Gate。仅使用现有 Bot deploy 与 Viewer `run_build.sh → deploy_forum_web.sh "<HEAD subject>"`，上线后少量串行只读验收，不用生产写入制造测试条件。
