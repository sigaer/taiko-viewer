# Viewer 0.82.1 代码收口报告 · 2026-10-16

Owner 已于 **2026-10-16** 接受 O1/O2：**Gate C = PASS_WITH_ACCEPTED_RISK**。C1–C4 保持 **PASS_SCOPED**；C5 的历史 PNG 缺口已获风险接受，像素等价仍未重建。**Gate P = DEPLOY_PENDING_AUTH，未达到 DEPLOY_READY**。建议 Owner 审核代码合入及 O1/O2 残余风险；批准前不推送、不合入。0.83 可继续既定非生产设计与隔离开发，本报告不宣称 Contract Freeze。

权威矩阵：[082-gate-status.json](082-gate-status.json)。本报告替代当前收口待办的旧 Annual Blocker 分类；历史报告、FAIL、原始证据全部保留。

## 冻结组合与实际变更

- Viewer `32729e86b070ed5bd40bc033a7d936114e5081ce`，0.82.1，工作树 `/home/sigaer/taiko/.worktrees/viewer082-recovered-20261016`；起始干净，HEAD 未改变。
- Taiko 0.14.2 源码 `a632913dfbdbec1d465f8eaccc0bb80c35e25745`；当前重建 wheel SHA-256 `398d23000ebde8a9696b8586fc7fff6cf566e49eb6efe970ceba2e5ecf488c0a`。原 `0963350…` wheel 已丢失，不宣称 archive 等价。
- runtime manifest SHA-256 `407a3ad925ef2b22d96639153758e644e4723e33e5e6e56ccf800b0e95e217b4`；锁 SHA-256 `122763d862b0a513b692c9f6ef7b64410a276f909fab442065162733abe6da80`。
- center/client 均为独立 94 包，Core 0.1.1/0.1.2，`python-memory-runtime 1.1.0`。重验现有安装版本与重建清单/锁一致，`-I` 产品来源均在各自 venv；已安装 Taiko Python 文件与固定 wheel 内容匹配。复用此前 pip-check 和生命周期 46×2，不重装或重跑。
- 仅四处 SQL 测试 launcher 增加 `QA_RUN_DIR/QA_RUN_TMPDIR`，让测试 Worker 的隔离断言获得其所属目录。产品的环境白名单、业务 SQL、授权、断言及 DTO 均未改。[精确补丁](/home/sigaer/taiko/qa-vault/evidence/082-final-offseason-20261016/qa-path-forwarding.patch)。没有产品/UI 变更，不另改版本；主仓库既有未提交改动未触碰。
- 现存历史 run manifest 的 **356 个归档条目逐 SHA 匹配**（实测口径）；这是完整性检查，不是新增业务 PASS。[复核清单](/home/sigaer/taiko/qa-vault/evidence/082-final-offseason-20261016/review.json)。

## Gate C 证据与限制

| Gate | 结果 | 证据边界 |
| --- | --- | --- |
| C1 安装边界 | PASS_SCOPED | 现有消费者/兼容 Worker，固定组合及 -I 来源；不证明生产解释器 |
| C2 8 项 SQL | PASS_SCOPED | 8 PASS / 0 FAIL / 0 SKIP；Node HTTP + native MySQL + installed Python；不重跑 119 项 |
| C3 授权/事实/DTO | PASS_SCOPED | 重验旧11凭据、28 facts、13严格DTO及11跨谱面回归的原始日志/输入身份；不重跑，零DTO差异 |
| C4 构建/冒烟 | PASS_SCOPED | 完整 Nuxt production build exit 0；真实H3路由/会话与安装态 Worker；不加载 Annual startup plugin |
| C5 历史 PNG | OWNER_DECISION_REQUIRED | 当前3类图可用，旧12项像素等价未重建；不能代签 Owner |

八项指定用例名称及输入 SHA 见 [SQL 逐项结果](/home/sigaer/taiko/qa-vault/evidence/082-final-offseason-20261016/sql-eight-retry.json)。全新 `mysqld --no-defaults` datadir 位于该 run scratch，`@@datadir` 实测与独占目录 realpath 一致，`SELECT DATABASE() = viewer1_security_test`，显式 `TAIKO_ALLOW_TEST_DB_MUTATION=1`。仅私有 Unix socket及随机 loopback代理；无生产 API/DB。测试后 MySQL、代理与 Worker 退出，包装器确认 childrenStopped、清理所属 scratch；保留日志和资源事件。

Passport旧汇总中的测试源码SHA与当前文件直接比较不同：差异仅为既有`qaTempPrefix`导入及测试目录改接。精确还原这两类路径变更后，源码字节SHA与原严格Oracle相等；原断言/输入未改。该来源裁决见`final-review.json`，未因此重跑13项。

首轮 SQL 真实 1 PASS / 7 FAIL：夹具调用未传 QA 目录，被测试 Worker 守卫拒绝。四行接线修正后仍使用原断言，8 项全部通过。首轮日志 `/home/sigaer/taiko/qa-vault/runs/qa-1bef9e06fe54/evidence` 保留；初次汇总器也未兼容 Node spec reporter，已修正解析，无测试结果篡改。

[构建记录](/home/sigaer/taiko/qa-vault/evidence/082-final-offseason-20261016/build.json) 关联 package-lock、全部构建产物 SHA 与日志。确认构建用时 146.6s，250ms采样 cgroup 峰值约 3.89 GiB；内核 `memory.peak` 不可用，不能把采样最大值称为内核精确峰值；OOM/OOM-kill 见原始 memory.events。包装器界限4/5GiB High/Max，swap512MiB，2CPU，30min。首轮 Nuxt 已输出 Build complete，留证脚本读取缺失字段报错；另一次确认调用在构建前因独占 HOME 已存在退出；最终使用独占路径完成构建并保有子进程 exit=0。前次构建日志保留，没有调用部署脚本或替换生产 output。

[非 Annual 冒烟](/home/sigaer/taiko/qa-vault/runs/qa-81764cf6ade1/evidence/nonannual-smoke.json)：实际账号登录/Session、原生测试 SQL、真实 H3 账号路由；B30、精度、雷达分别生成两次，JPEG SHA一致并经 Sharp 解码，输出有尺寸/字节限制。基础图片路由匿名401、无目标绑定的另一用户400；三个选项共用该鉴权入口，合法 owner 均200、`image/jpeg`、`Cache-Control: no-store`。合法 owner recommendation JSON 为200/private no-store。Publication sequence 2→3，merged Worker 对两个 Source 保持新 commit 向量并读回最新成绩，随后退出；installed Growth sampleCount=35。

此 smoke 使用合成字体/目录/成绩；是原始路由宿主和安装态 Worker 验证，**没有完整启动构建后的服务或生产服务**。首轮宿主缺 Nuxt `createError` 自动导入、下一轮误给 merged Worker 单 Source，分别修正为显式H3导入及合法双Source夹具；原失败日志保留，不定性为产品回归。没有新增生产真实数据或 Annual 负载。

## 十二项历史 PNG 的 Owner 裁决表

原12项是 frozen-source 动态双渲染对照，原素材/字体身份及旧原始结果不能恢复。共同状态 **LEGACY_PIXEL_PARITY_NOT_REESTABLISHED**。下列 unavailable 只指原始像素证据；不声称生产资产已丢失。新合成输出不能伪装成旧 Golden；其余九项不为收口重建全库图片矩阵。

| 历史用例 | 原证据 | 现有替代范围 | 待签 |
| --- | --- | --- | --- |
| `b30` | unavailable | 当代合成 HTTP/JPEG 功能与确定性 | OWNER_DECISION_REQUIRED |
| `dimension` | unavailable | 当代合成 HTTP/JPEG 功能与确定性 | OWNER_DECISION_REQUIRED |
| `radar` | unavailable | 当代合成 HTTP/JPEG 功能与确定性 | OWNER_DECISION_REQUIRED |
| `render_pass_progress_image_bytes` | unavailable | 保留历史 scoped 结果；本轮不重渲染 | OWNER_DECISION_REQUIRED |
| `render_progress_image_bytes` | unavailable | 保留历史 scoped 结果；本轮不重渲染 | OWNER_DECISION_REQUIRED |
| `render_star_progress_image_bytes` | unavailable | 保留历史 scoped 结果；本轮不重渲染 | OWNER_DECISION_REQUIRED |
| `render_progress_image_bytes_by_list` | unavailable | 保留历史 scoped 结果；本轮不重渲染 | OWNER_DECISION_REQUIRED |
| `dani` | unavailable | 保留历史 scoped 结果；本轮不重渲染 | OWNER_DECISION_REQUIRED |
| `trend` | unavailable | 保留历史 scoped 结果；本轮不重渲染 | OWNER_DECISION_REQUIRED |
| `recommendation` | unavailable | 保留历史 scoped 结果；本轮不重渲染 | OWNER_DECISION_REQUIRED |
| `mydon` | unavailable | 保留历史 scoped 结果；本轮不重渲染 | OWNER_DECISION_REQUIRED |
| `cloud` | unavailable | 保留历史 scoped 结果；本轮不重渲染 | OWNER_DECISION_REQUIRED |

Owner O1：逐项明示接受上述兼容性缺口及替代范围，或指出必须阻断的具体项。在签署前 C5 保持 OWNER_DECISION_REQUIRED；本轮无旧像素等价/生产视觉验收结论。

历史 `history` 474成功/126 dropped仍为 **HISTORICAL_FAIL_CAUSE_UNRESOLVED**；新600/600不证明旧归因。B30预检8.014s、merged-history6.898s仍为 **PERF_P1_NOT_FORMAL_PERCENTILE**，没有新正式分布或PASS声明。请求 Owner O2接受残余风险，另行安排体验优化；没有据此扩大压测。已执行范围未观察到严重越权、Publication代际错误或资源失控，不代表未测全域无缺陷。

Annual cold30 原 FAIL_RESOURCE（1提交/0完成/29未执行、MEMORY_PSI_FULL）、高尾/PSI深挖/海报压测均 **PARKED_ANNUAL_EOL**；历史 warm600/600、Worker、v4.5.4新旧隔离与报告身份仅作 HISTORICAL_SCOPED_PASS。既有文件未删、未重算，生产入口/开关未关闭。Annual EOL 是独立产品任务，不进入本轮 Owner 阻断签收路径。

## Gate P：只准备，未执行生产观察

**实际已知**：固定离线构件、测试 schema身份、合成恢复与HTTP恢复证据。**实际未知**：当前部署commit/wheel/解释器/用户、真实入口ACL、生产schema/数据规模、binlog/PITR、生产恢复点、异地副本及密钥托管。主仓库HEAD和本地`6e7f35b`均不冒充线上回滚版本。

P1 预备脚本 [production-observe.py](/home/sigaer/taiko/qa-vault/evidence/082-final-offseason-20261016/production-observe.py) **NOT_EXECUTED**，仅做离线语法检查。未来需 Owner 指定 unit、Nginx文件、wheel路径及授权编号，提供属当前操作者0600 JSON：`scope=production-readonly-082`、`ownerAuthorizationId`、`units`、`nginxFiles`、`artifacts`。批准后才可运行：

```sh
/usr/bin/python3 /home/sigaer/taiko/qa-vault/evidence/082-final-offseason-20261016/production-observe.py --owner-approved-plan "$OWNER_APPROVED_PLAN"
```

脚本只观察命名unit的MainPID/User/Group/WorkingDirectory/FragmentPath/DropInPaths/运行状态/资源上限及PID的UID/GID/comm/exe；不读Environment、ExecStart、进程参数或业务数据。Nginx仅输出选定入口指令，凭据头只记录header名和是否配置，proxy目标只记scheme/host/port；不记录userinfo。wheel只按批准名单记录UID/GID/mode/大小/SHA。Nginx花括号、include闭包及继承关系仍须限定范围人工审阅，脚本输出不是ACL或实际鉴权PASS。

以下也是**未来准确观察命令，当前未运行**；Owner先填写允许范围，再在私有观察目录归档脱敏结果：

```sh
ss -H -ltnp "sport = :$OWNER_APPROVED_PORT"
nft -j list chain "$OWNER_APPROVED_FAMILY" "$OWNER_APPROVED_TABLE" "$OWNER_APPROVED_CHAIN"
git -C "$OWNER_APPROVED_RELEASE_TREE" rev-parse HEAD
runuser -u "$OWNER_APPROVED_RUNTIME_USER" -- "$OWNER_APPROVED_PYTHON" -I -c 'import sys,json,importlib.metadata as m; names=["taiko-bot","sakura-taiko-core","python-memory-runtime"]; print(json.dumps({"executable":sys.executable,"prefix":sys.prefix,"packages":{n:{"version":m.version(n),"root":str(m.distribution(n).locate_file(""))} for n in names}}))'
```

预期字段：命名端口的绑定地址/进程身份；相关IPv4/IPv6源地址、端口、verdict和默认策略；部署commit；实际解释器/venv/包版本/来源。仅看版本不能证明文件闭包，需与批准wheel/RECORD及运行命令映射核对。不得用全量`nginx -T`、全表配置、`/proc/*/environ`或业务日志代替。未授权时不做HTTP探测；未来若Owner另批只读验证，只探测命名公开/私有路径，预期匿名私有/凭据拒绝、错误Authorization不回落Cookie、跨owner拒绝及private/no-store，不记录口令、Cookie、成绩或请求体。新凭据写入/绑定变更仍不在只读授权内。

P2 备份/恢复方案（**生产未执行；RPO≤15min、RTO≤120min尚未证明**）：

1. Owner确认生产数据根、SQL范围、部署构件/依赖锁/配置引用及实际规模，明确获批恢复环境、备份账户、离线/异地加密目的地、密钥保管与保留期。秘密仅走受保护文件/密钥服务，不在CLI、Git、报告或日志出现。
2. 建立带时间戳和binlog/GTID坐标的应用一致性检查点：关键SQL、成绩current/history及其Publication committed向量与全部引用objects、historical measurement/daily、Goal、身份绑定/授权/撤销/过期/receipt状态同一恢复边界。发布前需证明现有writer的协调方式；不可用互不对齐的SQL dump与文件拷贝假装一致性。
3. 连续binlog/PITR与备份链需覆盖≤15min目标窗口；检查点清单逐hash、断链检测、最近成功时间及加密异地接收回执可复核。受保护本机vault只算本机存证。Annual现有报告/分享/frozen身份只保留，不重新生成。
4. 在批准的独立恢复环境还原完整快照/文件向量并PITR到同一坐标，阻断上游/生产网络；所有恢复验证写入仍需实测`SELECT DATABASE()`以`_test`结尾、独占datadir及mutation opt-in。缺失objects或混代直接失败，不用重算掩盖。
5. 验证合法owner读写、跨owner/已撤销/过期授权拒绝、Publication序列与commit一致、C/H与daily/measurement/Goal身份保留；在真实代表规模记录检查点年龄及事故开始到服务可用的时间，再据原始计时签RPO/RTO。保留现有合成恢复结果，不将小样本毫秒值升级为生产恢复能力。

P3的12项私有资源与上面的12项PNG证据**不是同一份清单**。目前未获准读/复制/哈希私有资源；矩阵`private-resource-01…12`仅是待Owner映射的审计占位ID，不伪造实际资产名称。逐项待填owner/来源权利/当前运行依赖/获批备份目的地/加密与恢复证明。不能宣称它们均已退役；若后续批准的依赖清单证明仅旧宿主非运行素材，再转资产治理。该未知属于Gate P，不自动扩成Gate C新审计。

P4 正式回滚清单（**无线上可执行回滚命令**）：发布前锁定当前真实部署commit、解释器、wheel/94包锁、可恢复数据检查点与schema兼容性；Owner单独批准灰度范围、停止条件、负责人及观察窗口。出现P0先暂停推广/新writer准入，按已演练的一致性恢复或兼容旧构件回退流程执行，不能只换前端output或单独覆盖C/H。回滚后验证权限撤销、Publication、合法owner和Growth，再签生产结果。实际观察点未知时不杜撰systemctl/release/SQL还原命令。未来正式Viewer部署仍只能用受控标准脚本，本轮没有执行。

## 交付与待签

仅本报告、一份矩阵及 [持久原始证据目录](/home/sigaer/taiko/qa-vault/evidence/082-final-offseason-20261016) 构成本轮主交付；旧报告不改写为新PASS。新证据索引在该目录`evidence-index.json`，涵盖执行器、补丁、输入/构件SHA、原始日志、逐项断言、wrapper资源/清理记录及构建产物清单。失败attempt与最终通过分开留存，未保留测试数据库/凭据。

Owner当前待签：O1历史PNG逐项兼容裁决；O2历史性能残余风险。随后另行授权O3生产只读范围、O4权属/异地备份/PITR/恢复演练，Gate P具备证据后再签O5发布控制。**本轮到此结束代码收口，不再扩展Annual或全域迁移审计。**

## Owner 签收追加 · 2026-10-16

依据 `Viewer_083_Contract_and_Developer_API_Execution_Order_20261016.md` §0.1及本轮明确指令，O1/O2 = OWNER_ACCEPTED_RISK，Gate C = PASS_WITH_ACCEPTED_RISK。上文测试时点的待签表和客观失败保留为历史；当前签收状态以 `082-gate-status.json` 为准。12 PNG仍为 LEGACY_PIXEL_PARITY_NOT_REESTABLISHED；history 474/126仍为 HISTORICAL_FAIL_CAUSE_UNRESOLVED；两项性能预检没有正式分位数结论。Gate P仍 DEPLOY_PENDING_AUTH，没有任何生产/合入/发布授权。签收前报告与矩阵原字节已保存于 `/home/sigaer/taiko/qa-vault/evidence/083-contract-api-20261016/before-owner-acceptance-*`。旧证据索引的报告SHA属于该签收前时点，不应套用到追加签收后的文件。
