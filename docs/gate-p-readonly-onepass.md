# P-A_PRODUCTION_READONLY_AUDIT：一次有界只读核查申请

状态 `READY_FOR_SINGLE_READONLY_APPROVAL`；`CAN_RUN_NOW=false`；`PRODUCTION_READONLY_AUDIT_NOT_YET_AUTHORIZED`。本工作令只授权准备本申请，未授权执行。此包替代原先逐个 discovery/PID/文件审批；一次明确批准后，合法引用链内连续观察，无须逐路径再次签收。

## 一次填写、一次批准

| 授权字段 | 待批准值 |
|---|---|
| scopeId | `P-A_PRODUCTION_READONLY_AUDIT` |
| 执行机器（明确名称，不以本地 cwd 推断） | UNKNOWN |
| 操作者／授权编号 | UNKNOWN／NOT_GRANTED |
| 生效、失效时间（Asia/Shanghai，单次窗口≤30分钟） | UNKNOWN |
| 起始 Viewer unit | `taiko-viewer.service`，仅来源模板，尚未在线确认 |
| Viewer vhost 起始文件（一个明确绝对路径） | UNKNOWN；可明确 EXCLUDE，此分支保留 UNKNOWN |
| 备份/回滚元数据起始清单、计划文件或具名作业（合计≤2个） | UNKNOWN；可明确 EXCLUDE，此分支保留 UNPROVEN |
| 私有证据目录（新建独占子目录、0700、本机持久盘） | UNKNOWN |
| 可选普通 Schema metadata | 默认 EXCLUDED；只有本次批准同时填写连接引用、精确库名、只读账号、现有表白名单时纳入 |

无须预先填写由 unit 才能发现的 PID、Node 路径、Nuxt 入口或 drop-in。**批准必须包含上述机器、操作者、时效、私有存证位置和纳入分支的起点**；不将文档签收或“继续”解释成生产授权。缺省排除的分支不自动扩权，也不使其他已批准分支失效。

## 引用链和操作上限

总墙钟≤240秒；单执行者、文件流式串行读取；受控资源包装器 `scripts/memory/run_qa.sh`，共用 maintenance lock，不与构建/QA重叠；不启动应用、浏览器、业务导入或 Annual。核查输出≤1MiB、私有结果/日志合计≤4MiB；遇资源保护触发即结束本包。下列每个失败仅停止相应分支，独立记录 UNKNOWN/UNPROVEN；没有有效 Viewer unit 时，其下游身份/构件分支停止，已批准的独立 vhost/备份分支仍可运行。

| 分支 | 允许对象／操作及来源 | 硬上限／输出白名单 |
|---|---|---|
| 服务身份 | 起始一次 `systemctl show taiko-viewer.service`；结束最多复核一次。仅 `Id,LoadState,ActiveState,SubState,MainPID,User,Group,WorkingDirectory,FragmentPath,ControlGroup,DropInPaths` | 每次≤10秒、≤16KiB；只有一个 Viewer unit；不 list-units／全量 show |
| unit 引用文件 | 仅 show 返回的 FragmentPath 与 DropInPaths；只解析 `[Service]` 的 User/Group/WorkingDirectory、ExecStart 中 Node 可执行路径及 `.mjs` 入口路径、EnvironmentFile **路径存在性**和下述非敏感 mode 常量 | ≤1 fragment＋4 drop-ins；每文件≤64KiB，合计≤256KiB、≤15秒；不保存原始 unit、ExecStart 整行或其他参数；不打开 EnvironmentFile |
| 运行 PID | 仅已确认 MainPID 的 `/proc/<pid>/exe`、cwd、cgroup、stat 的 state/ppid/startTicks；首尾复核 unit.MainPID 与 startTicks 一致 | ≤1PID、≤10秒、≤8KiB；exe/cwd 只读 symlink/路径元数据；禁止 cmdline/environ、fd/内存扫描 |
| Node/Nuxt/当前构件 | 由 exe、WorkingDirectory、unit 中直接 Node＋literal entry 引用解析；manifest 仅在该 release 根下的 `docs/083-release-manifest.json`、`docs/083-mainline-gate.json`、`build-manifest.json`、`release-manifest.json` 四个固定名字中检查；随后只按 manifest 枚举路径流式 SHA。受控 package.json 只取 name/version | ≤4 manifests、每个≤2MiB；当前+旧版本合计≤12000文件/1GiB哈希读取、≤90秒；每release≤6000文件/512MiB；无 manifest 不目录扫描。输出 count/bytes/hash match/version/来源路径；不导入代码或运行 Node/Python 来取版本 |
| 旧可恢复构件 | 仅由批准的回滚清单中明确 `previousRelease` / rollback artifact 引用，或 Owner 本次明示的旧 release 路径进入 | 最多1个旧版本，计入上行预算；找不到保持 UNKNOWN，不枚举 releases、不改 symlink |
| Viewer ingress | 明确批准的一个 vhost，和其中 literal include 直接引用的同站配置 | 总计≤5文件、引用深度≤2、每文件≤64KiB/总≤256KiB、≤20秒；仅 serverName/listen/upstream/path/method/Host/Origin/ACL/trustedProxy、log字段/脱敏存在性；不 nginx -T、不读访问日志/凭据/cert/key。glob、变量include、跨站或不确定引用停止该引用分支 |
| 备份/回滚元数据 | 已批准≤2个起始清单/作业，及其明确引用的同范围 metadata（非备份载荷）；如批准的起点本身是具名备份作业，只取 Id/LoadState/ActiveState/Result/ExecMainStatus/ExecMainExitTimestamp/LastTriggerUSec 中适用字段 | ≤6 metadata对象、每文件≤64KiB/合计≤256KiB、≤20秒；输出最后成功时间、预期覆盖类别、checkpoint/校验/恢复方案的存在性、旧构件身份；时间新鲜不等于恢复 PASS；不启动作业、不读业务备份/用户资产 |
| 可选 schema 指纹 | 仅本次批准的精确连接/库/只读账号和≤32个既有表；仅 SELECT DATABASE()、INFORMATION_SCHEMA.TABLES/COLUMNS/STATISTICS 选定字段 | ≤10秒、≤2048行/256KiB；列限 schema/table/engine/collation、column/ordinal/type/nullable、index/nonUnique/seq/column；不取业务行、columnDefault或任意SQL；Developer四表/F3排除，非P-A必要条件 |

每个读取对象必须在证据里记录 `起始授权对象 → 引用字段/指令 → 解析后路径 → 类型/预算 → 结果`。只允许直接可证的引用；不执行 shell、unit ExecStart、配置 include 或 manifest 内容。relative entry 只相对 show 的 WorkingDirectory 解析；仅接受直接 Node 可执行文件及 literal Nuxt entry；复杂 shell/wrapper/变量链无法证明时标 UNKNOWN，不读完整 cmdline 补洞。symlink 最多两跳，越出已批准 release/配置范围则停止该引用分支。禁止 manifest 路径穿越、`.env`、密钥/证书载荷、userdata、Publication对象、业务备份及十二项未映射私有资源，即使 manifest 声称引用它们也不得读取。

mode 只允许从获批 unit 的 literal Environment 指令投影以下非敏感键：`NUXT_MY_TAIKO_READ_MODEL_MODE`、`NUXT_PUBLIC_MY_TAIKO_READ_MODEL_MODE`、`TAIKO_DEVELOPER_API_V1_ENABLED`、`NUXT_DEVELOPER_API_V1`、`NUXT_PUBLIC_DEVELOPER_API_V1`、`NUXT_ANNUAL_STARTUP_MODE`；值仅接收 `legacy/read-model/normal/owned-qa/true/false/0/1`。不输出其他键值、原始行或凭据值/其内容hash；EnvironmentFile 存在或覆盖关系不能证明时，**effective mode=UNKNOWN**，不凭源码默认值判线上通过。

私有存证只存脱敏字段、引用链、文件/读取字节计数、允许的构件SHA、分支状态/耗时；不将 raw unit/vhost、Authorization/Cookie/JWT/Key、日志行或业务内容写入磁盘。所有公开结果仅为状态/证据hash；不输出生产路径明细到公开文档。出现疑似secret时丢弃未批准字段，禁止错误对象/stringify泄漏。

## 停止与判定

- unit 缺失/名称不匹配：不猜名字、不扫描，停止身份下游；PID复用、入口/构件漂移、无法证明引用、预算超限，停止对应分支。发现新权限/数据 P0 时封存脱敏反例和SHA，暂停受影响后续操作。
- metadata 无法证明真实恢复、有效 flags、正常启动或数据库兼容时，保留 `UNPROVEN/EVIDENCE_PENDING`，不能把只读核查通过写成发布 PASS；已有备份元数据≠恢复成功。
- 一次批准只覆盖此只读包；不覆盖 Git push/PR/main/tag、任何 DDL/写SQL/迁移、备份读取/复制/恢复/异地传输、HTTP探测或用户状态变更、deploy/restart/symlink更换/feature gate。SQL分支被明确纳入后无需逐表再签，未纳入则不查库。
- 完成后只汇总 P-A 尚缺证据。后续所有有副作用的发布、最小旧路由冒烟和回滚实操集中另批一个发布执行包；不回到逐个 PID/路径循环审批。

本次申请尚未执行。P-B MyTaiko 受限灰度、P-C Developer 外部启用独立处理；不以本包自动开启两者。
