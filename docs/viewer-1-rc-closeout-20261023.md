# Viewer 1.0 RC 最后三项证据收口

> 2026-10-31：0.88.3已标准发布并补完别名修复的真实Nuxt／空白隔离SQL／登录／移动端定向验收。当前四条产品主线、证据边界、真正恢复阻断与可延期项，统一以[唯一Gate的最新结论](viewer-1-release-gates-20261023.md)为准。下文0.87.9部署停止等均为历史事实，不能代表当前线上版本。未改生产数据、灰度权限或资源准入。

唯一当前差距表仍为 [viewer-1-release-gates-20261023.md](viewer-1-release-gates-20261023.md)。本记录解释证据，不新建 Gate 或审批体系，不重审已有 Writer／Growth／平台迁移。

## PR #36 发布

候选 `715fa8b57e61a3dd0429eab803b645c80763a680`，CI #72 / run 39898869622：295/295、Contract、跨语言 Golden、正常生产构建通过。已有真实 Nuxt 74 项／46 图、同候选密码安全27项及隔离SQL42请求。

外部自动审查自04:15 UTC持续Running数小时，明确未记PASS。按本轮允许的替代路径核对：GitHub main 元数据 protected=false、protection.enabled=false、required checks off，无CODEOWNERS或必需人工审批规则；保护详情403不当作审批通过。独立只读review对精确候选及必要依赖无P0–P3发现，记录在仓库外 `pr36-review/review.md/json`，不冒充GitHub人工approval。

PR #36 squash为 `efbbdb739db1e364d6d7cc1c74a08e59d38c87bb`，合并树与候选一致。原run_build＋未修改标准部署211.68秒成功，采样峰4,283,248,640 B，high/max/OOM计数0，无准入豁免；明确代理、安全Node24.22.1／Undici7.30.1、自启disabled保持。线上8项HTTP及36个匿名页面组合通过，主动业务写入0。0.87.8完整回滚与.previous一致，0.87.7档案保留，原设计336项WIP哈希一致。

## 1. 备份／恢复：BLOCKED

- 现有cron每日本地04:15执行，2026-10-23包SHA256 `7ace1613b2a6fbb78db86d854fa006dde3962e71e5f594f2dc517e2c19d53443` 实际流式校验通过。282,312,981 B／1046条archive项；内容仅曲库、别名、封面及 `web_admin_action_logs`、`web_admin_access_rollups`、`web_admin_ingest_state` 三表。只读索引，没有提取业务正文、读取备份Key或改动备份。
- 实际latest-verified指针为2026-10-17 05:03:41.240381Z，24表／53,622文件，原生恢复121.165秒，20项功能记录；是较早检查点，不沿用另一个03:57检查点的117.325秒数字。该job自己的allowlist确认缺少当前四张v1授权表及两张source service grant／audit表，且记录的源仍为旧文件格式，无当前Publication vector。旧恢复策略要求独立新目标、恢复后全部Bearer／待确认凭据fail closed；不证明检查点后撤销replay、持续RPO/RTO或异地/PITR。
- 为补当前授权结构的恢复证据，本次新建私有 `_test` MySQL，在实际 `SELECT DATABASE()`、datadir归属及 `TAIKO_ALLOW_TEST_DB_MUTATION=1` 后，执行18张合成表的原生mysqldump／mysql import。dump 27,612 B，原生round-trip为秒级（精确值见最终 `authorization-recovery.json`，不作为生产RTO）；48次真实本地HTTP。恢复后Session／Key撤销、Grant对旧ETag的拒绝、属主／绑定／client和跨账号拒绝保持；source service grant撤销行及audit保持。没有将缺Publication夹具时的503当成source读取拒绝通过，不声称该HTTP路径已恢复验收。
- 合成dump仅在owned scratch中存在并删除；私有MySQL、socket、库已退出删除。没有生产连接、生产数据复制、新建生产备份、运行维护任务或修改调度。历史失败attempts保留，只有最终run计入结果。

复跑（只会创建独占合成测试库；不恢复生产备份）：

```sh
bash scripts/memory/run_qa.sh /usr/bin/env TAIKO_ALLOW_TEST_DB_MUTATION=1 ENTRY_AUTH_RECOVERY=1 COMMUNITY_SQL_TEST_FILE=accountEntrySqlHttp.test.mjs VIEWER_REVIEW_OUT=/var/tmp/viewer-rc-authorization-recovery /usr/bin/python3 preview/song-detail/review/community_sql.py
```

剩余具体条件是经明确授权建立当前六张授权／审计表、账号／Session／Key／绑定、Source／历史／Growth／Goal和同代Publication的一致可恢复集合，明确撤销replay或恢复前fail-closed政策，再以现有流程验证。当前授权不包含修改生产库、备份正文、权限、调度或资源限制，因此没有擅自补造“最新全备”。

## 2. Contract／兼容：已验证部分PASS；正式1.1冻结NOT VERIFIED

当前公开meta与唯一Schema精确对应，revision `30591840759a1d437e01f002f215a320673ce7ed95580d30f162756339c646db`。Contract包、v1 SDK及v1服务／API自正式0.85.0至PR #36无diff；14个当前源码消费点与既有公网SDK／隔离HTTP证据已分类。源码消费者不等于所有外部第三方已迁移；独立旧Bot/Client保留其原认证与安装pin，不制造全量迁移前置条件。

[兼容承诺](developer-api-compatibility.md)唯一正文随网站作为静态Markdown公开：稳定字段／nullable／unknown、时间与难度含义、完整目录边界、严格optional扩展兼容、显式新契约／迁移以及弃用流程。不虚构sunset天数或消费者通知。特别区分ResourceGrant撤销与共享Developer Key失效：前者不自动撤销旧Token能力，共享Key失效仍影响使用该Key的两域请求。两份OpenAPI的注释只澄清历史候选metadata与现行说明，不改权限或DTO。

承诺经本PR正常审查合并、静态公开后，该文档项PASS；现行meta仍 `FREEZE_CANDIDATE / contractFrozen=false`，不悄改或移植历史1.0 Freeze。按已有release-controlled lifecycle，需明确正式1.1冻结，或记录现有RC流程允许候选契约进入RC的决定；本文不替代该发布决定。

## 3. 性能：资源观测PASS；在线性能NOT VERIFIED；有效歌曲500待处置

只读聚合现有20MiB以内日志及今日监控，未新增压力或测量请求。0.87.8启动后1536点、15秒采样，Viewer观测峰648,863,744 B、swap0、high/max/OOM0；memory PSI full avg10最大0.18%，NRestarts0，自启disabled。此窗口不证明短时峰值或当前9版本的全容量。

普通access日志没有request_time，开发者timed仅5样本且无受保护成绩样本，因此当前p95/p99／容量不能签PASS。现有窗口10,366请求中65个500全部归于歌曲详情SSR，涉及47个现行目录有效ID，集中UTC05:11–05:20。没有保存URL／ID／IP，严格脱敏journal未得到可归因的错误类别，原因未知。它不是已证明的扫描，也未包含在旧CLOSED_ACCEPTED_RISK中；对RC应保留为具体阻塞信号，不据此声称是PR #36引入，或擅自修改歌曲业务。

历史O1限定失败依原decision register继续接受；不重开它们。最短补证是定向归因并处置这65个SSR500，再针对既有O1路由与阈值获取有代表性成功率／延迟观测。若需要改变生产日志字段或采样配置，需另获明确授权；本轮没有修改它们，不开启无目标全站压测。

## 证据位置与发布边界

仓库外 `/home/sigaer/taiko/qa-vault/evidence/viewer-1-rc-closeout-20261023/`：`backup/inventory.json`、`backup/authorization-recovery.json`、`backup/entry-sql-http.json`、`backup/sql-runtime.json`；`contract/inventory.json`、`contract/consumers.json`及独立文档审查；`performance/current-telemetry.json`、`existing-500-classification.json`、`existing-500-attribution.json`；`pr36-review/`。PR #36部署构件／只读线上证据在相邻 `viewer-entry-closeout-20261023/delivery.json`。

本PR只增加文档、静态公开说明和复用测试／夹具，不改业务处理器、Schema、Contract版本、权限、依赖或资源预算。依本轮明确指示保持应用0.87.9；静态文档仍使用原受控部署流程发布。只读线上验收不主动同步、发帖、授权、撤销、确认近期事实或写入真实账号。恢复集合缺口和有效歌曲500未解决前，不宣称Viewer 1.0 RC已就绪。

## 静态兼容说明发布停止记录

PR #37最终候选 `e050305` 对应CI #75和独立审查通过，合并 `0b6da1f`。原包装器／未修改标准部署脚本在构建前因HEAD标题未以0.87.9开头拒绝，退出1；本轮停止部署，无绕过、重试、手动替换或重启。生产checkout为0b6da1f，但运行的仍是PR #36 / efbbdb7构件，PID与buildId未变。只读复核公开兼容URL为404，故承诺公开项尚未PASS；Git文档审查与正式冻结仍分别记录。0.87.8完整归档和.previous、安全运行时、自启disabled均保留。

本段为准确记录阻塞的文档修正，不部署、不升级应用版本。未来公开发布须使用符合标准版本前缀的提交标题，并重新通过受控脚本与只读哈希核对；当前没有把此未完成步骤写为通过。证据：外置deploy-result.json、stopped-deployment-readonly.json。
