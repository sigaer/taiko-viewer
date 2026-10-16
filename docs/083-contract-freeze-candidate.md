# Viewer 0.83 Contract / Developer API v1 Freeze Candidate

**状态：FREEZE_CANDIDATE_READY_FOR_OWNER_REVIEW。未正式 FROZEN，未达到 DEPLOY_READY。** 本地版本 `0.83.0-rc.1`，隔离分支 `feat/viewer083-contract-api-20261016`，工作树 `/home/sigaer/taiko/.worktrees/viewer083-contract-api-20261016`。首个真实授权闭环已完成，本轮到此收口，不扩展OAuth、全库迁移、Annual或Python ownership审计。

0.82 Owner O1/O2接受已在 `c9b87f4` 落盘：Gate C=`PASS_WITH_ACCEPTED_RISK`，Gate P=`DEPLOY_PENDING_AUTH`。12旧PNG仍未重建像素等价；history474/126及两项性能预检原状态、原始SHA全部保留。0.82候选package仍0.82.1，main及生产均未变。

## 精确基线与提交

| 范围 | 本地提交 / 固定构件 |
| --- | --- |
| 研发起点 | Viewer `32729e86b070ed5bd40bc033a7d936114e5081ce` + 签收提交 `c9b87f4` |
| Package A | `a6be4ea`：唯一v1 Schema兼容增量、生成绑定、Catalog适配与Golden |
| Package B | `78b252d` + `fd4c669`：真实授权API、同意页、SDK、候选版本及页面入口 |
| 正式构建源码 | `fd4c669e6492345802a3b2604bd7842715bd8420`；后续仅文档和最终测试提交，运行源码差异已核验为空 |
| 草案审阅 | `78ce858`，逐文件评估；没有整支cherry-pick或覆盖0.82修复 |
| Taiko安装态 | 0.14.2 / `a632913dfbdbec1d465f8eaccc0bb80c35e25745` |
| wheel SHA-256 | `398d23000ebde8a9696b8586fc7fff6cf566e49eb6efe970ceba2e5ecf488c0a` |
| 环境 | center/client独立94包，Core0.1.1/0.1.2，support1.1.0；未改venv或重建wheel |

[机器可读矩阵](083-contract-and-api-matrix.json)列出每条入口的owner/auth/scope/source/contract/side-effects/migration/regression/sunset，以及逐条HTTP反例。[OpenAPI 3.1](083-developer-api-openapi.yaml)只列11个实际实现操作，样例全为合成数据，无生产服务器声明。最后的文档/测试提交可用`git log -1 -- docs/083-contract-freeze-candidate.md`精确解析。

## 已实现的本地产品闭环

- 匿名 Catalog songs/charts 与 meta；显式 `contractVersion/schemaRevision/catalogRevision`、公共ETag/304、原子日配额。
- 已验证Viewer用户可查看绑定/应用/已有授权，明确选择绑定、应用、资料/成绩scope、1–90天有效期并勾选同意；可撤销。开发者须先有approved application才能注册稳定client；可停用自己的client。
- 私有Profile/Score只读API，资源使用`plr_` opaque ID。Developer Key仅证明`clt_`应用身份；即使开发者拥有该用户账号，也不能跳过ResourceGrant。不同用户给同一个应用授权的读取已验证。
- 同意→第三方读取→用户撤销→第三方403，包括原ETag；真实Vue同意组件已在375px浏览器和真实SQL/HTTP上完成交互。Hiroba、Wahlap、手工绑定的正常私有读取均通过。
- TypeScript SDK在同一真实HTTP上读取并验证撤销后抛出403，不保存或返回旧缓存载荷。

运行默认关闭。源码开发/构建显式opt-in为`TAIKO_DEVELOPER_API_V1_ENABLED=1`；已构建产物的Nuxt运行配置使用`NUXT_DEVELOPER_API_V1=1`及`NUXT_PUBLIC_DEVELOPER_API_V1=1`。这里只说明候选配置，不授权对任何生产进程设置它。没有新开放sync/上游凭据权限；history/growth只有设计Schema，当前申请会被拒绝，未注册对应v1读取路由。

## 一个Schema、一套数据语义

正本仍是 `packages/sakura-taiko-contract/schema/contract-v1.json`，contractVersion仍1.0。源码包兼容patch为0.1.2；固定安装环境内旧contract包为0.1.0，没有偷偷升级。新Python生成绑定和纯Catalog适配是显式候选源文件测试；已安装0.14.2 Publication Worker不需要导入新的平台授权DTO。

User/Binding/ExternalIdentity/DeveloperIdentity/Score/GrowthObservation/CanonicalFact/GrowthProjection/CalculationProfile的原定义和required集合未改。Song/Chart只加可选availability及Chart.tjaCourse；ResourceGrant、client/profile及API版本/响应属于同一文件中的平台DTO。OpenAPI复用Canonical Score并排除其兼容用`legacy`字段；字段类型没有另起一套正本。

| 映射/版本 | 当前规则 |
| --- | --- |
| 身份 | Viewer account≠QQ/bot key≠taikoId；client owner≠resource owner。绑定使用不可变SQL bindingId，授权另捕获owner/source/taikoId/manual身份 |
| 歌曲/谱面 | song_no→songId；level→difficulty 1–5；TJA course=difficulty−1；星级为独立Chart.level。chartId包含基本ID/难度/单双打类型，不按同名合并 |
| 地区/可用性 | 只接收显式CN/JP、single/double；缺失为UNKNOWN/unknown。shelf0 active、1 removed、其他/缺失unknown，不把“other”擅自解释成JP；重复源ID拒绝而非合并 |
| 成绩 | high_score/good_cnt/ok_cnt/ng_cnt/combo_cnt/best_score_rank映射既有Score；缺失null不归零，累计counts与clear/FC/DF字段分开 |
| 时间 | capturedAt只取有效带时区_meta.ts或null，不采用port的请求时钟。highscoreAt/updatedAt保留上游文本，不推断游玩 |
| 事实 | current为最佳记录集合，history为full/delta观察；同步不是游玩。按谱面continuity-v3逻辑和既有冻结measurement/Goal不变 |
| revision | scoreRevision=Publication sequence+commitId；catalogRevision=同次读取原始catalog bytes SHA；schemaRevision=唯一Schema的JSON序列化SHA。均不是对抗恶意Writer的签名 |
| 算法 | 原始只读API calculationProfile=null，无Rating/六维重算；既有CalculationProfile与历史modelRevision不被新SHA替代 |

旧`growth.json` Golden原样保留。新`growth-chart-continuity-v3.json`只加入已批准0.82修复的provenance标记；测试先严格证明去掉该唯一标记后与原样例完全一致，再严格比较完整新DTO。没有弱化Passport测试或重写任何历史业务数据。

## 授权、事务与读一致性

四个增量表：client、opaque binding resource、ResourceGrant、grant audit events；现有`web_developer_tokens`继续只存哈希/轮换/撤销，与stable client通过approved application关联。Token轮换不换client，也不增scope。ResourceGrant不存明文Key。SQL同意/撤销及审计同事务，重新同意改变grantId/revision，保留审计及binding resource ID。

Cookie-only的授权管理拒绝任何Authorization头，写操作要求同Origin。非手工绑定沿用既有非null verified_title证据；手工绑定必须对应存活manual account。用户和client创建者账号须存在且邮箱已验证。旧绑定缺验证证据时不给新grant，不改变旧接口。

私有读在取得SH之前、取得SH后读数据之前、Worker关闭后响应之前复核授权。最后一次SQL在**同一语句**中核验token/client/application/developer/owner/grant/binding/resource，避免把分开的凭据检查与grant查询拼成陈旧授权。scope、audience、nonce、UTC有效期及绑定快照必须满足；决策线性化点是最后的授权SQL，已在此前完成的撤销拒绝200/304。

数据通过现有ScoreReadPort/installed Publication ReadView读取，只读取已提交代际；无managed Publication时明确503，不把mtime或请求时间伪装成commit。响应内容和scoreRevision取自同一个SH视图；并发Writer可发布下一代，但不能让本响应混代。Profile只返回playerId/bindingId/displayName/source；Score拷贝既有契约白名单，丢弃legacy/raw扩展和profile凭据。所有私有响应和错误`private, no-store`；条件请求完整检查后才可能304。

GET不触发上游抓取、绑定变更或C/H写入。日配额是单独声明的SQL副作用，复用现有原子consumeOpenQuota；client日配额跨token轮换共享，匿名按直接peer IP散列，不信任转发头。`429`在私有grant验证后才决定，不能替代授权。API不缓存私有载荷，SDK亦不保存旧载荷。此轮没有第二个Publication Writer。

## 必需验证与原始证据

| 验证 | 结果/实际边界 |
| --- | --- |
| Schema/生成绑定/JS Golden | PASS；11项JS，既有定义兼容、UTC/Shanghai时间profile、legacy ScoreReadPort及新地区/单双打/难度样例 |
| Python Golden | PASS；5项既有Score/roundtrip + 2项候选Catalog同一Golden；固定解释器-I |
| SQL/HTTP | PASS；3个选中套件/用例，0FAIL/0SKIP；其中v1流程记录74项实际HTTP/SDK观察，其余2项是旧Source service允许/拒绝 |
| 安全反例 | 匿名私有、Key无grant、A2/B1/他client、scope/audience、过期/撤销/解绑/owner/source替换、禁用app/client、token轮换、无效Authorization+有效Cookie、越权参数、路径标识、跨owner同意/停用、CSRF均拒绝 |
| 并发 | 最后授权前撤销grant/token会拒绝；Writer排队时旧响应保持旧body+revision，下一次读新代；Writer+撤销并发不返回私有响应 |
| 配额 | 限额2的5个并发有效请求恰为2成功/3个429；无“按启动顺序猜结果”的断言 |
| 用户页面 | 实际grants.vue + 真实登录/SQL/API；375×812、明确同意、读取、撤销、再拒绝，无横向溢出；Nuxt壳composables和CSS变量由隔离宿主供应 |
| 安装态 | wheel/lock重验SHA；94包、0.14.2/support1.1.0、-I来源都在独立venv；不重复46×2 ownership生命周期 |
| 正式构建 | exit0，151.0s；cgroup250ms采样峰值约3.90GiB，kernel memory.peak不可用；high/max/OOM/OOM-kill均0 |
| OpenAPI | 11操作均映射实际route文件；73个请求/响应样例通过Schema；带legacy的私有Score样例被拒绝 |
| source-switch | 复用qa-e51b0af965bc已完成suite的scoped PASS，重验日志SHA及当前测试源码与基线一致；父wrapper的unsafe-scratch历史失败保留，不声称重跑 |

全新`mysqld --no-defaults`独占datadir，实测`SELECT DATABASE()=viewer1_security_test`与`@@datadir`，显式mutation opt-in，仅Unix socket+随机loopback代理。实际执行了guarded migration CLI。MySQL/HTTP/Worker/Chromium全部退出，所属scratch清理，原始日志/断言/输入及版本SHA持久存证。

主证据：[SQL观察](/home/sigaer/taiko/qa-vault/runs/qa-8b89a48bcfcd/evidence/developer-api-v1-observations.json)、[Contract](/home/sigaer/taiko/qa-vault/runs/qa-7217c1949d21/evidence/contract-summary.json)、[用户交互](/home/sigaer/taiko/qa-vault/runs/qa-8b89a48bcfcd/evidence/083-consent-ui.json)、[构建](/home/sigaer/taiko/qa-vault/evidence/083-contract-api-20261016/build.json)、[最终Schema/来源核查](/home/sigaer/taiko/qa-vault/runs/qa-298caee1e2cb/evidence/final-validation.json)。完整最小索引位于`/home/sigaer/taiko/qa-vault/evidence/083-contract-api-20261016/evidence-index.json`。

初始失败均保留：离线npm缺缓存后按同一lock安装；新授权事务被旧夹具的score-write期望阻挡，正确切换为metadata事务；真实SQL暴露跨旧表collation冲突并修成binary身份比较；旧Growth Golden缺已批准的v3 provenance标记，保留原例并新增严格后继。没有把任何失败包装成PASS或覆盖旧原始日志。

## 兼容策略与边界

矩阵覆盖Web session、Developer raw、proxy current/history/update、QQ/bind、内部manual服务、旧public-score/by-token与token管理。旧入口全部`COMPAT_RETAINED`，未删、未改认证域、未伪称已迁移。旧public-score-token在Taiko服务内，可能先刷新并写成绩；v1只读GET没有该副作用。内部服务凭据/旧service scopes不等于普通Developer Key；旧token均不自动升级成ResourceGrant。没有安排sunset日期。

未执行：完整构建后Nuxt服务启动/全站主题回归（避免启动Annual插件）、线上/外部gateway调用、生产ingress/ACL/配置/数据/PITR、Annual负载、119SQL/46×2/全PNG重跑。用户页面证据属于真实组件+真实API宿主，不冒充完整Nuxt部署验收。Gate P仍待单独授权；未来恢复清单须纳入四张新授权表并与token撤销状态及Publication检查点一致。

## 本地重放与用户操作例

```sh
cd /home/sigaer/taiko/.worktrees/viewer083-contract-api-20261016
bash scripts/memory/run_qa.sh /usr/bin/python3 "$PWD/scripts/readiness/run-viewer083-qa.py" contract
bash scripts/memory/run_qa.sh /usr/bin/python3 "$PWD/scripts/readiness/run-viewer083-qa.py" sql
```

第二条命令创建全新DB、合成已审核应用/用户、真实HTTP路由和同意组件宿主；不需要生产账户、配置或数据。测试结束自动关闭和清理，不留下后台开发服务。schema变更在`taiko_viewer/scripts/migrate_developer_api_v1.ts`，默认只显示DDL；`--apply`仅允许有准入run/scratch及实际_test/datadir证明的独占测试实例，不能拿它直接连生产。

用户操作：登录隔离Viewer会话→「应用授权」→选择应用与绑定→只勾选所需资料/最佳成绩→选有效期并明确同意→应用通过`createDeveloperApi(...).scores(playerId)`读取→用户撤销→同Key与旧ETag再次读取403。Key只从本机受保护测试配置提供，不放URL、命令参数、浏览器页面或Git。该流程已由browser+HTTP测试执行，不需要手动导出任何私有素材。

## Owner待签

1. 唯一Schema增量、availability的显式unknown口径、字段白名单、source/version/时间语义，以及v3 provenance后继Golden裁决。
2. 稳定client与approved application映射、90天上限、显式逐绑定同意、两项read scope及最终授权边界；history/growth继续不开。
3. MVP边界：Catalog最多10000源行、Score最多20000条/响应8MiB、owner列表最多100项；实际生产proxy日配额、审计保留和DB审计时间口径需另审，不宣称容量验收。
4. 旧入口兼容与未来sunset策略；生产恢复清单新增授权元数据，Gate P单独批准。
5. 审阅后另行决定正式0.83 Contract Freeze、发布与生产切换。本轮未授权push/合入main/部署/重启，也未执行这些动作。
