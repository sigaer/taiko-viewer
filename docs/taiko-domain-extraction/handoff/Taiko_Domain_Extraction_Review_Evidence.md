# Taiko Domain Extraction：过程材料审阅证据摘录
## 来源与边界
- 输入：`taiko-domain-extraction.zip`，SHA-256 `b7a4327f8e83fb9e3875263cfdbc434ed657c37530a88261dfd67440d5dbfde8`。
- 包内 62 个文件，解压总计 1,146,029 bytes；52 JSON、8 Markdown、2 CSV。未包含实现源码、完整 Git diff、实际测试 runner 或原始测试日志。
- 下列是原文逐行摘录，不是代码正确性认证。PASS 表示材料中的报告结果，未在本次审阅中独立重跑。
- 时间、提交与生产状态均截止包中记录；没有访问用户服务器或联网核验仓库当前状态。
- E11 来自本对话已提供的旧 v2 方案，用于核对任务定义。

## E01 — 阶段台账、授权表述与剩余工作
来源：`status.md`；文件 SHA-256 `c90cbcc3eadc2698ed1693c9b8a28c8092ab342e5ddc09c75b7746ec3572a06a`。

### 原文第 1–19 行
```text
L1: # Taiko Domain Extraction 执行台账
L2: 
L3: 执行依据：[Execution Plan v2](../Sakura_Taiko_Domain_Extraction_Execution_Plan_v2.md)。用户已授权依序执行 Phase 0–6、逐步留档、阶段提交/推送，技术选择自行决定。日期均为 Asia/Shanghai。此台账不沿用 Annual Poster Phase 字母 Gate。
L4: 
L5: Goal：`active`。Phase 5 标准发布与只读线上验收完成，Gate 5 PASS；开始 Phase 6 ownership、publication、Read Model 与 storage 决策。先前内存准入阻碍已解除，历史记录保留。
L6: 
L7: 当前6.3e.8.6j子步PASS：daily采集/趋势/backfill统一Source SH→namespace锁，采集复用Source EX，backup/restore/purge共用namespace锁；拒绝未纳管/已删除Source新增测量，canonical history补算与dead stage收集。392检查+25故障子场景PASS，frozen v1/v2完整字节及实际公开catalog/合成成绩计算一致；A9.81.28/cc66b22已标准push并核对remote。[证据](evidence/phase6-daily-writer-validation.json)。Native私有return proof、P1a/Read Model/成本/ops/统一激活继续，Gate6 IN_PROGRESS；Viewer0.82本地准备，live0.81.11/R/PIDs不变。
L8: 
L9: | Phase | Gate | 已完成 / 待完成 | 证据 |
L10: | --- | --- | --- | --- |
L11: | 0 Extraction Audit | PASS | 清单、分类、重复、数据流；无实现变更 | [审计](../taiko-domain-current-state-audit.md)、[复核](evidence/phase0-validation.json) |
L12: | 1 Contract Freeze | PASS | 身份/Chart/Score/Growth + CalculationProfile 冻结，10 项 Golden/validation | [验收](phase1-contract-freeze.md)、[证据](evidence/phase1-validation.json) |
L13: | 2 Core v0.1 | PASS | 四步依序提交；独立 repo/tag，15 项 installed-wheel tests | [验收](phase2-core-v0.1.md)、[证据](evidence/phase2-validation.json) |
L14: | 3 Sakura adapter | PASS | Core 0.1.1 / Sakura 9.80.7；132 regression、生产重启/adapter/HTTP smoke | [验收](phase3-sakura-adapter.md)、[证据](evidence/phase3-validation.json) |
L15: | 4 taiko-bot client | PASS | Core 0.1.2 / client 0.2.0；188 委托、48 回归、固定 Git pin / wheel 安装 / command smoke | [验收](phase4-taiko-client.md)、[证据](evidence/phase4-validation.json) |
L16: | 5 Viewer boundary | PASS | 5.1–5.3 / 230 Node + 5 Python PASS；0.81.11 标准 push/deploy、8 项线上 smoke、旧进程退出/新进程 active | [步骤](phase5-viewer-boundary.md)、[验证](evidence/phase5-validation.json)、[发布](evidence/phase5-publication-validation.json) |
L17: | 6 Writer/storage | IN_PROGRESS | 6.1/6.2、6.3a–c、6.3d.1–9、6.3e.1–7、6.3e.8.1–4、8.5a/b及8.6a–j留档；最新daily/趋势/backfill 392检查+25故障子场景；u0/Native所属前轮证据保留；待Native私有return proof、全Writer最终核对/P1a、Read Model、百万成本/ops/统一发布 | [步骤](phase6-storage-consolidation.md)、[审计](evidence/phase6-ownership-audit.json)、[最新验证](evidence/phase6-daily-writer-validation.json) |
L18: 
L19: Gate 未 PASS 不进入下一阶段。代码存在、离线 test 或 Git push 不能代替未完成的生产验证。ROADMAP 版本作为阶段里程碑；Phase 0 禁止代码/package 变更，因此只提交文档，不为编号修改 package 或部署。
```

### 原文第 45–56 行
```text
L45: - 2026-10-11 / 4.4：客户端 `d501343` / 0.2.0 push 成功；两个私有 Git pin 安装并核对实际 commit/source；最终 48 regression、installed-client 14 模块 / real command import PASS。Gate 4 PASS；开始 Phase 5。Viewer 和中心线上依赖未改。
L46: - 2026-10-11 / 5.1：当前/历史/daily archive 读取端口完成，原文 revision/provenance、历史排序/预取/stat 语义保留；219 regression 与局部 TypeScript PASS。Writer block 无变更；Phase 5 全步骤完成后统一版本化发布。
L47: - 2026-10-11 / 5.2：Contract CanonicalFact / GrowthObservation 单一类型来源，History/Recent scope 验证；冻结 Golden、schema、Growth/Goal 兼容与 TypeScript PASS，证据单独归档。继续 5.3。
L48: - 2026-10-11 / 5.3：Contract JS 0.1.1 只读 profiles；230 Node / 5 Python 全通过，百万合成记录 exact baseline DTO 一致 / 无 OOM。Writer/strict schema/Python mapper 不变；0.81.11 patch，进入标准发布验收，未提前 PASS Gate 5。
L49: - 2026-10-11 / 5.4：实现提交 `cd4be76`；memory build wrapper 因可用内存低于约 12.65 GiB 拒绝，标准部署脚本未启动，尚未 push 或切换线上。准入失败已留档；等待维护窗口，不改限制、不手动发布、不进入 Phase 6。
L50: - 2026-10-11 / 5.4-preparation：续行复核内存仍不足；补齐只读在线验收脚本，当前 0.81.10 的 8 项 SSR / anonymous GET 基线通过并留档，未冒称新版本已发布，生产无需账号/成绩写入。
L51: - 2026-10-11 / 5.4-blocked-audit：第三轮复核同一 memory headroom 阻碍，约 11.81 < 12.65 GiB；无活动部署/QA/Annual job，live remote `060dc05`，线上 PIDs 不变。独立准备完成后无其他合规推进动作，Goal 标 blocked 并留恢复步骤；不提前 PASS 或进入 Phase 6。
L52: - 2026-10-11 / 5.4-resume：Goal 恢复 active；可用约 16.88 > 12.65 GiB、PSI < 2、无 Annual worker。实现文件 hash 与 230 Node / 5 Python 验证时相同，JS contract 安装为 0.1.1，线上尚未切换；继续标准发布。
L53: 
L54: - 2026-10-11 / 5.4-PASS：标准脚本 exit 0，`eca1b08` 已 push 并发布 0.81.11；8 项 local/online SSR、401/cache GET 通过，旧 Viewer/receiver PID 退出，新 PID 1063394/1063408 active，NoneBot/public API 未变。Gate 5 PASS，开始 Phase 6；未把匿名 smoke 称为真实用户成绩验收。
L55: 
L56: - 2026-10-11 / 6.1：复核真实中心/Viewer/派生 cache Writer 和 R/A dispatcher 差异；选择单一 Infrastructure JSON publication + immutable read view、私有 file read model，现有身份/Goal/measurement DB 保留。开始合成协议实现；Gate 6 IN_PROGRESS，未部署 Writer。
```

### 原文第 124–132 行
```text
L124: - 2026-10-12 / 6.3e.8.6f：A9.81.23/f04b320标准push且actual remote一致；原QQ sender私聊验证码/hash-only/10min TTL/60s cooldown/完整snapshot，固定多principal gates、merge/owned credential/消费同COMMIT，exact retry不复活、不重置/重跑更新。231 Source（208旧+23新）/70实际_test SQL（38旧+32新）/TS和独立1真实QQ SDK键盘通过；9旧production排除/1warning，四个COMMIT进程退出点与两组5s同锁。121.298s/331796480byte sampled/child354164KiB/high-max-OOM0，wrapper72487 exit0/journal success/inactive/cgroup gone；keyboard0.816s/57143296byte，无依赖安装。两次69pass/1fixture fail及系统SDK/venv缺pytest历史完整保留；主代码不放宽锁，旧exit QA用1s有界等MySQL断连清理。仅Source+Viewer准备DDL/测试留档，无R同步/重启/部署、B0.2.6/live0.81.11/PIDs不变；native整轮/Gate6 IN_PROGRESS，继续client QQ、其余授权/全部Writer/P1a/Read Model/百万成本/ops/统一激活。
L125: 
L126: - 2026-10-12 / 6.3e.8.6g：A9.81.24/926ad23、B0.2.7/fa0983d标准push与actual remote一致。private qq-code/qq-migrate CLI复用native单事务，明确bind_migrate/principal/全Source、live actor/QQ tuple/service policy前后证明；B local SQLite/JSON迁移与逐次upsert退出。241 Source/223 client/TS和新23实际SQL-HTTP+10纯transport PASS，旧160实际SQL+1 policy分轮保留（合计183/11）；补1复合test u0后来选择和解绑不复活PASS。61.846s/445947904byte sampled/child362448KiB/high-max-OOM0、wrapper25873 exit0/unit1791772648-2099982 success/inactive/cgroup gone；补充3.522s/276811776byte sampled成功退出。四个COMMIT真实退出/独立SIGALRM、late撤权/rollback/ACK/runtime replacement等通过。private fixture sys.path、SDK base URL和pure worker resolver注册失败全留档，无生产依赖/SQL变更。Viewer0.82本地准备，R/live0.81.11/PIDs不变、未启动B；Native整轮/Gate6 IN_PROGRESS，继续其余授权/全Writer/P1a/Read Model/成本/ops/统一部署与online Gate。
L127: 
L128: - 2026-10-12 / 6.3e.8.6h：A9.81.26/539f6e5已标准push/actual remote一致，期间用户Milky ff1778f/8c877ee无taiko差异，本步保留parent和其他miku工作。Native命令/first-bind传canonical sender，一次current DTO、共享2并发、Source EX→principal gate→完整current/state证明、每publish/同view render/返回复核；managed profile mismatch拒绝、frozen复制/404/-1/cooldown/image fallback保持。258 Source/28新actual_test SQL PASS，70既有SQL先前通过合计98跨轮；四个COMMIT/publish退出和四种Source等待替换、frozen current/full-delta H内容hash/时间序号一致。67.602s/308043776byte sampled/child217192KiB/high-max-OOM0，wrapper21484 exit0/unit1791776870-2153889成功/inactive/cgroup gone。旧AST symbols、Source cwd/公开catalog fixture、Golden投影/随机名称差异完整留档，无production IO/依赖修改。B0.2.7/Core pins及R/live0.81.11/PIDs不变，Viewer0.82本地；其余Native reader/startup/allWriter/P1a/Read Model/成本/ops/统一online Gate继续IN_PROGRESS。
L129: 
L130: - 2026-10-12 / 6.3e.8.6i：A9.81.27/d4a9d22标准push及actual remote一致，Native u0成员SH→派生EX、同批C/H与commit依赖证明，去掉旧startup SQL/JSON Writer。319 Source、40发布/备份和4补充检查分轮PASS，另25实际故障子场景；frozen初次/增量完整字节一致，两个u0提交死亡点/三身份fence竞争验证。31.617s/285368320byte sampled cgroup peak及补充3.213s/143396864byte，high/max/OOM0，owned child/unit/cgroup退出；两次fixture/runner失败保留。Viewer仅本地档案，无R同步/部署/生产SQL写入，live0.81.11/PIDs不变。继续剩余Native reader、daily/maintenance Writers、P1a停旧Writer后显式纳管、Read Model/百万成本/ops/fixed R deps/统一发布与真实online Gate；Goal active，Gate6 IN_PROGRESS。
L131: 
L132: - 2026-10-12 / 6.3e.8.6j：A9.81.28/cc66b22标准push与actual remote一致。daily同Source lease/namespace锁、Source EX采集复用、趋势history至持久化SH、canonical streaming backfill、bounded seed、tombstone/legacy mutation拒绝；已有backup/restore/purge共用同锁，Source EX收集dead daily stage。349 Source+40发布/备份+3保留趋势用例=392及25故障子场景PASS；frozen v1/v2完整JSON、3条合成成绩实际公开catalog/Core计算一致。实际daily child在replace前/后退出和Source/namespace竞争验证。41.078s/267546624byte sampled peak、child321568KiB、high/max/OOM0；wrapper/unit/cgroup/children退出，早期fixture与选例失败留档。host maintenance保护userdata、admin backup仅catalog/cover/admin-log，并非C/H Writer，无主机缓存动作。Viewer仅档案本地提交，无R同步/部署/生产SQL，继续private return proof、P1a、Read Model/百万成本/ops/fixed deps/统一激活；Goal active/Gate6 IN_PROGRESS。
```

## E02 — 已经形成的独立 Core
来源：`phase2-core-v0.1.md`；文件 SHA-256 `7e34b09942edf936d7d884cbca53e8fda8323828c8e6b5611555b1e630977855`。

### 原文第 3–30 行
```text
L3: 2026-10-11 Asia/Shanghai。Gate 0/1 已 PASS 后，按 models → parsers → calculation → recommendation 顺序完成，Gate 2 PASS。
L4: 
L5: 仓库：[sigaer/sakura-taiko-core](https://github.com/sigaer/sakura-taiko-core)，版本 `0.1.0` / tag `v0.1.0`，Contract v1.0 / package `0.1.0`。四步提交：
L6: 
L7: | 步骤 | 提交 | 结果 |
L8: | --- | --- | --- |
L9: | 1 Models | `5044daf` | Player 与契约身份分离；Song/Chart/Score 和原数值 dataclass |
L10: | 2 Parsers | `0e41ab2` | TJA text parser、Hiroba HTML/score mapper，显式 clock |
L11: | 3 Rating / Dimensions | `8d14f5b` | v1 公共公式、v2 center/client profiles、显式 full-score reference |
L12: | 4 Recommendation | `675892a` | 公共候选与排序，两端目标策略、连打/目标容错；显式曲库可用性和日期 |
L13: 
L14: 独立 wheel 安装后 15/15 测试 PASS；源码 bootstrap 和安装产物均验过。Golden 输入全部为合成曲库/成绩，不读取用户数据或数据库。旧 Oracle 固定 A `5ac44b3` / B `46c8646`，每个抽离符号保留 SHA256 和变换说明。具体结果与 wheel hashes 见 [验收证据](evidence/phase2-validation.json)。
L15: 
L16: | Golden 族 | 对照数量 |
L17: | --- | ---: |
L18: | TJA | 7 |
L19: | v1 聚合 | 252 |
L20: | v2 公式边界 / profiles | 168 |
L21: | v2 full-score reference / 聚合 | 144 |
L22: | 普通推荐候选、评分、排序 | 126 |
L23: | 两端目标推荐 | 60 |
L24: | 连打、特殊气球、目标容错 | 96 |
L25: 
L26: 额外覆盖 parser profile/list/detail/achievement、v1 六维、v2 records/DF exception/低精度/过计数、目标用户 profile 的有/无成绩分支。浮点与字段使用精确相等，不做容差掩盖算法漂移。Core AST boundary 无 NoneBot/QQ/HTTP framework/SQL/filesystem/UI 依赖；只允许纯标准库、契约与可选 BeautifulSoup/urllib.parse。
L27: 
L28: 包构建使用运行环境已有 setuptools 68.2.0；系统 Python 的 wheel backend 不全，因此首次构建失败后换用该完整构建环境。安装验证使用 `/var/tmp` 的独立 target，没有修改生产 site-packages。生成目录不提交。
L29: 
L30: 本 Gate 验证 v0.1 要求的独立领域内核；生产消费者尚未切换。剩余混合 orchestration（包括 estimator）在 Phase 3 接入时继续抽离并核对，不能因 Core 存在就宣称 Sakura 已成为 adapter。Phase 3 未 PASS 不进入 Phase 4。
```

## E03 — Sakura adapter 的真实保留范围与上线状态
来源：`phase3-sakura-adapter.md`；文件 SHA-256 `713abcd6058fa9c76fa01992bb73033d0349d1606b1703858aff115e62bc6a37`。

### 原文第 8–28 行
```text
L8: | 步骤 | 完成产物 | 验收 |
L9: | --- | --- | --- |
L10: | 3.1 领域所有权 | Core 0.1.1，47 个纯 Python 模块；Rating/六维/解析/谱面/推荐/估分及剩余数值内核 | 23 项独立安装 tests，源码与 wheel 字节一致；Core 无框架/HTTP/SQL/文件 IO |
L11: | 3.2 Sakura adapter | 旧入口委托固定 Core；33 个发布文件；宿主保留 command/permission/消息/图片/HTTP/鉴权/文件/缓存 | 132 项回归 PASS；9 项线上记录测试排除并拦截读取 |
L12: | 3.3 输出与性能 | 冻结旧源码 Golden，实际命令解析/格式函数；一次加载谱面索引；v2 宿主缓存仍被调用 | 命令模块字节相同；完整谱库 200 条合成记录画像/5 个估分一致；约 0.48 秒 |
L13: | 3.4 提交/依赖/同步 | 两仓库 push；完整 revision pin；系统 user site 与 taiko venv 安装；选定文件先比对、备份、逐文件替换 | 33 文件均与发布源码 hash 相同；旧文件全部与基线相同；无 data/secrets 复制 |
L14: | 3.5 生产切换 | 原 `taiko` screen 内 `nb run`；public-api、sync-receiver 重启 | 旧 PID 退出、新 PID 启动；startup/太鼓插件/QQ/OneBot PASS；公开谱库 200、dispatcher health PASS |
L15: 
L16: ## 发布与算法语义
L17: 
L18: - Core commit [`9fc0731`](https://github.com/sigaer/sakura-taiko-core/commit/9fc0731358f6863c1e1efd9f1930a608850786f7)，tag `v0.1.1`，origin/main 与 tag 推送完成。
L19: - Sakura commit [`95d71d5`](https://github.com/sigaer/Sakura_bot/commit/95d71d57d109d756cb129610051af40a989f016f)，版本 `9.80.7`，origin/main 推送完成；taiko package `0.2.1`，依赖最低 Python 3.11。
L20: - Sakura 验收补记 `70d96cd` / `9.80.8` 只改文档并同步；运行代码不变，不重复重启。
L21: - Contract package `0.1.0`，固定 Viewer `23f89b4f70e5a64ae76c33ac04c6c2d242808df1`。
L22: - Wheel：Core SHA-256 `76294144080b8816331cfce02b6363749078ab60fb048c1b72767387d989b273`；Contract SHA-256 `61c63fda6949c6c8c4f84dd63b170482cc127dcf957facad056663bcf6f240d7`。
L23: 
L24: 仍使用 `v2-center-20261010`，保留中心准确率阈值、超物量拒绝、DF 例外，以及原目标推荐策略。
L25: 名称/难度显示、command registration、permission 和消息格式不改。Hiroba/TJA、分数线、同曲身份、
L26: 星级/在架/国行实装、目标选择、段位和基础计分由 Core 提供值规则。
L27: 宿主提供文件内容、时钟、grade names 与 cache；token/鉴权 helper 未搬入 Core。
L28: Annual 产品 Gate 不改，个人数据/Writer/存储仍按 Phase 6 顺序处理。
```

### 原文第 46–58 行
```text
L46: ## 运行与回退
L47: 
L48: NoneBot `374046/374061` → `829369/829379`；public-api `3263424` → `829173`；
L49: sync-receiver `646803` → `829176`。应用 startup 完成，太鼓插件加载，无 import/startup error，
L50: QQ 与 OneBot 接入成功。接口检查仅 GET，没有生产 DB mutation。
L51: Viewer 无运行代码变化，因此没有 Viewer version bump、构建或部署。
L52: 原有其他项目用户修改未纳入提交；非服务的一次性后台任务未重启。
L53: 
L54: 选定旧文件备份位于运行机器 `/var/tmp/taiko-domain-extraction/phase3-runtime-backup/`，
L55: 原实现 Git baseline 为 `5ac44b36e2e170e84641adf124d77f1e998f4039`；
L56: 已存在文件恢复备份，新增 adapter 文件按清单删除，再重启同一 NoneBot 与两个服务。
L57: 不删除/回写业务数据，不依赖复制生产记录的 fixture。
L58: Core 0.1.0 的 tag/wheel 仍保留；旧应用不导入新包，回退应以整组源文件为单位。
```

## E04 — 分布式客户端的 profile、版本与安装权限
来源：`phase4-taiko-client.md`；文件 SHA-256 `dcd0e8e64e796620412ff9ecfb4ba9c0f2e6b907a8255be15a83a68cbbb85d54`。

### 原文第 10–34 行
```text
L10: ## 4.2 Core 客户端策略
L11: 
L12: Core `0b7319d94b041daafb0a0d32e3ccc95e50da8810` / tag `v0.1.2` 已 push；contract `0.1.0` / schema `1.0`。
L13: 独立安装包 29/29 tests PASS，52 runtime Python modules 全部符合无 filesystem/SQL/framework/HTTP 的依赖边界。
L14: 保留所有此前中心 Golden，另冻结构/输入差异的 86 组客户端案例；不默认切换中心线上 Core 0.1.1。
L15: 
L16: 差异通过显式值/profile 收敛：Hiroba 无 region/crowns 的客户端结构、公开可见范围、v1 pair identity、v2/target title identity、13 字段 SongStats、宽松 CSV、star progress、position 和 scoreline 来源/解析。
L17: v1/v2 算术、六维、推荐评分和连打规则引用同一 Core。宿主提供 cache/catalog/grade names 和逐条 capture timestamps。
L18: 
L19: ## 4.3 客户端委托
L20: 
L21: 14 模块，188 个符号及规则表委托；Python 最低版本 3.11，客户端版本 0.2.0。
L22: 已通过 43 原有回归 + 5 宿主边界回归；安装后的客户端 wheel 验证 14 模块源码一致，真实 NoneBot command import PASS。
L23: 命令源码 SHA-256 `25014419bda9da3a47754b114d556590f11d6a5bc0e21f2be739c7bfba6645b1` 与 baseline 相同。
L24: 新增宿主测试保护版本 pin、空推荐的按需读取、star 数据集隔离、null/zero 区分及宿主时钟。
L25: 
L26: ## 4.4 安装、推送与 Gate
L27: 
L28: 固定 Git revision 安装 PASS：Contract `23f89b4`，Core `0b7319d`，实际 VCS commit 与请求 pin 完全一致，52 Core 源模块与安装包一致。规则表收敛后 48/48 客户端回归 PASS；最终 wheel 14 模块及真实命令 import PASS，commit 后源码与该 wheel 再核对一致。
L29: 
L30: 客户端 0.2.0 wheel SHA-256 `2a29f8d3fc51aacbcb45f82c11f52b82df13eb1718d3945e6572c9c3429ba90a`；Core 0.1.2 wheel `f34c1d0a3e58f5a7ce232ca50741e3235260eb8dabaedd95b41d84e7d0d0d47f`。构建/缓存/runtime 数据不包含在 wheel/release Git 变更中。
L31: 
L32: 本机没有在运行的客户端，因此不虚构客户端线上 adapter 连接验收；真实 installed command/module 加载、既有命令回归及固定源安装完成此次客户端发布 Gate。中心已在 Phase 3 完成线上切换，当前依赖仍保持 0.1.1。
L33: 私有 Core/Contract 源安装要求授权 SSH 读取权限；没有权限的消费者需要维护者提供固定 wheel，未改变仓库可见性。
L34: 所有 QA 经 memory runner，合成输入和 isolated storage，禁止真实 HTTP/生产个人数据读取/生产 mutation；临时目录清理。
```

## E05 — Viewer 已发布成果与资源等待
来源：`phase5-viewer-boundary.md`；文件 SHA-256 `7ff1914910dd5551427ed255f0c18977902d9f0a0af67e289d0d055698160cf2`。

### 原文第 18–30 行
```text
L18: - 5.1 READ_BOUNDARY_PASS：当前/原文、存在性、历史枚举/读取/stat、daily archive 进入 `ScoreReadPort`。Goal、Personal、Growth 不再自己打开这些成绩文件。兼容 Userdata 类型移至 domain adapter，shared 仅 re-export；原 Writer block 字节相同。
L19: - 219 项离线 regression 全通过；新增读取测试覆盖原文 hash、缺失值、再次读取、非法路径、历史重写、daily archive missing/corrupt/8 MiB 上限；read contract/file adapter/test 的 TypeScript check 通过。保留 frozen oracle 与真实磁盘 adapter，未用最终 DTO mock 代替新边界。
L20: - 首轮一个测试连续重写落在同一毫秒，ctime 相同；测试明确跨过文件系统时钟精度。当前 stat 校验仍不是发布事务，精度限制如实保留，Phase 6 使用 publication version 完善识别。
L21: - [5.1 验证](evidence/phase5-read-validation.json) 保存 source/JUnit hash。回退至 `060dc05` 可恢复旧读取；无存储迁移。步骤提交用于后续整阶段 review，Web 尚未发布，Gate 5 尚未 PASS。
L22: - 5.1 提交 `8288bfe`，仅本地步骤提交，等待本 Phase 发布脚本统一提交/推送。
L23: - 5.2 CANONICAL_FACT_PASS：GrowthFact / temporal / observation 改为 Contract v1.0 类型引用，保留 Viewer GoalType 和非 nullable chart ID 的产品 refinement；删除本地重复模型。History 与 Recent 消费 owner/binding 校验后的 Canonical GrowthProjection，返回原有 facts 字段，不重建或复制事实树。Weekly/Passport 继续消费 History 的同一事实来源。
L24: - [5.2 验证](evidence/phase5-fact-validation.json)：冻结 schema 与旧 fact Golden 一致，跨 owner/binding 拒绝，Goal occurred/observed/confirmed 时间保持；离线完整链路和局部 TypeScript PASS。没有 Writer/SQL/schema 迁移或新对外字段。回退至 `8288bfe` 恢复 5.1；Gate 5 尚未 PASS。
L25: - 5.2 提交 `556abb7`。
L26: - 5.3 IMPLEMENTATION_PASS：Read Port / legacy evidence 类型归属 Contract 的 `score-read` 子路径；Viewer 保留文件 adapter 与兼容 re-export。Daily、Goal、Evidence、Overview 以及 UGC 有效成绩判断委托 Contract JS 0.1.1 的显式 read profiles；删除重复 scalar/crown/judgment/time decode 实现。产品 attendance、Goal lifecycle、来源排除、事实排序/归属及 Writer 验证/流程保留。
L27: - JS 0.1.1 是只读兼容层增量；语言无关 schema v1.0、Python contract 0.1.0 的 schema/types/mapper/metadata 与基线字节相同。中心继续 Core 0.1.1 / Python Contract 0.1.0，客户端固定旧 Git pin。
L28: - 最终 230 Node / 5 Python tests、TypeScript 与 generated bindings PASS。原源码冻结 85 numeric、8 crown/judgment、每个时区 10 timestamp 输入；严格 canonical Score 验证未放松。新读取未深拷贝历史或重建事实树。
L29: - 百万记录直接对比 `060dc05 / 0.81.10`：三对交替 fresh-process 样本全部 DTO digest 相等，均只加载/规范化历史一次、读取 2,000 文件。中位数 4.627 → 4.767 秒（+3.02%）；最大 OS RSS 442.65 MiB；cgroup High/Max/OOM/OOM kill events 均为 0。主机无 `memory.peak`，774.15 MiB 为最高采样值，不标作峰值。一次 5.318 秒高于历史 initial Passport 5 秒目标，未宣称 P0 性能 PASS；Phase 6 Read Model 仍需改善大历史 request latency。另一个旧 0.81.9 oracle 的 19.018 → 4.671 秒反映已有 request reuse 优化，不算本次迁移收益。
L30: - [整阶段实现证据](evidence/phase5-validation.json) 保存完整合成 benchmark 和源码 hash。fixture/临时文件已清理，无遗留 QA unit/监听器，无生产 DB、个人 userdata 读取或 mutation。首次性能命令误选旧 `/usr/bin/node`、一次采集不存在的 `memory.peak` 均记录为失败尝试；改为 Node 24.13.0 与明确的 unavailable metric 后重新完成，未绕过 memory runner。
```

### 原文第 43–59 行
```text
L43: ## Goal blocked audit
L44: 
L45: 同一内存准入条件已连续出现在三个 Goal turn：首次发布尝试、补齐只读在线检查的续行、当前再次复核。前两轮完成实现/检查器准备；当前准入仍失败（约 11.81 GiB 可用，要求 12.65 GiB），PSI=0、无 Annual/QA/build 活动 unit，线上 PIDs 不变。`git ls-remote` 复核远端 main 仍 `060dc05`。不存在已启动而可等待的部署 job。
L46: 
L47: Phase 5 必要独立准备已完成，下一步是被现行 memory guard 拒绝的实际发布；Gate 5 未 PASS 禁止开始 Phase 6。无需新增权限选择，但需要外部资源状态变化/维护窗口，故 Goal 标记 `blocked`，不标完成、不降阈值、不终止其他常驻服务、不手动 push 或部署。 [三轮阻碍审计](evidence/phase5-blocked-audit.json) 已记录。
L48: 
L49: 恢复后先重新核对 worktree/remote/memory；使用当前 HEAD subject 调用 `bash scripts/memory/run_build.sh /bin/bash scripts/deploy_forum_web.sh "$(git log -1 --pretty=%s)"`。成功后用 `scripts/verify_taiko_domain_release.mjs 0.81.11` 验线上版本/匿名授权边界，核对旧 PID 退出/新 PID 和相关运行服务，再保存 Gate 5 证据与进入 Phase 6。此前离线 PASS 不替代这些未完成步骤。
L50: 
L51: ## 恢复发布
L52: 
L53: 恢复 Goal 时，可用内存约 16.88 GiB，超过同一 12.65 GiB 准入；PSI full avg10 < 2，无 Annual/QA/build worker。已复核实现文件 hash 与最终 230 Node / 5 Python 验证完全相同，安装的 JS contract=0.1.1、Viewer package=0.81.11；没有新增实现需要重复运行整套测试。工作树无 tracked diff，线上旧 PID 未变。 [恢复证据](evidence/phase5-resume-admission.json) 留档；接下来执行原定标准脚本，Gate 5 仍待部署和生产检查。
L54: 
L55: ## 5.4 发布验收 PASS
L56: 
L57: 恢复发布提交 `eca1b08` 经标准脚本 push/build/切换/健康检查，exit 0。0.81.11 本地及线上版本可见，8 项匿名 GET / SSR smoke 全通过；旧 Viewer 646789、receiver 829176 已退出，新 PID 1063394 / 1063408 active。NoneBot 829369/829379 和 public API 829173 未重启。没有手动替换 output、单服务重启或限制降级。百度可选收录推送返回当日配额已满，脚本正常完成。
L58: 
L59: [发布证据](evidence/phase5-publication-validation.json) 包含部署日志 hash、8 个请求结果与 PID。真实成绩正确性来自前述合成磁盘/服务/Golden 验证；此次匿名生产检查只证明已发布版本与原有授权/缓存边界，不冒称读取过真实私人数据。Gate 5 PASS，允许进入 Phase 6。历史暂缓与阻碍段落保留其当时状态。
```

## E06 — Phase 6 选型、代码归属及先接入后全量验证
来源：`phase6-storage-consolidation.md`；文件 SHA-256 `86223582c28aa2722ead89cd29c4d32f8c7d9bef3d32fdc361dcfacc01a4895c`。

### 原文第 23–43 行
```text
L23: ### 存储选择
L24: 
L25: 选择加强版 JSON：中心单一 Infrastructure publication 实现，跨进程 kernel flock 包住 read→mutation→commit；私有 immutable content objects、明确 pending journal、原子 committed manifest、兼容 C/H 投影与崩溃恢复。代码置于 Sakura 的中心 Infrastructure 包，**不进入禁止 filesystem/SQL 的 Core**。Viewer Writer 成为此实现的客户端；所有真正中心 Writer 采用同一协议。
L26: 
L27: P1a 在这里负责可信 input commit 与 reader view，不直接合并已删除的旧 0.80.0 实验。采用 immutable generation/source sequence，不能仅用 stat/mtime 判定 ready。现有 legacy 未纳管输入可以读取，但不能被标成已验证 read-model generation；激活必须有全部运行 Writer 覆盖证据。
L28: 
L29: Read Model 选择私有、可重建的文件投影，优先保持现有 90d fact / 365d measurement 的产品范围。score facts 保留全部现有字段与来源排除，Goal/measurement 查询时合并；未验证的新输入不返回静默 stale。先测全量冷建与已提交代查询，再据实决定是否需要 checkpoint/增量；不为追求速度修改事实定义。
L30: 
L31: 数据库：继续现有 identity/Goal/measurement SQL 权威；本阶段先不迁全部成绩到 MySQL。理由是现有单机共享存储能提供线性提交与不可变读取，DB+外部 JSON 仍需 outbox，且无法替代 Writer convergence。此为明确选型，非遗忘 Database 项；最终根据资源、并发和恢复实测复核。若文件方案未满足指标，不提前 PASS。
L32: 
L33: ### 后续验收
L34: 
L35: 6.2 先用合成目录验证协议，覆盖跨进程 RMW、同时间 H、部分失败/ENOSPC、进程死亡、提交前后恢复、非法路径、不可变读取与恢复副本。6.3 再接全部真实 Writer/reader，保留 acquisition/merge/import Golden，封住普通 token 对任意私有 source 的读写。6.4 Read Model 做全字段 parity、提交/绑定/目录变更失效与百万记录资源测量。6.5 各仓库版本化提交、固定运行代码同步、标准 Viewer 发布与在线只读 smoke，并归档合成恢复演练及实际覆盖。Gate 6 当前未 PASS。
L36: 
L37: 原有未跟踪 growth/release 文档与 test 属于用户工作，仅作为历史参考读取，不自动提交或视为本任务新要求。源审计不读取个人 userdata、不连接 DB。当前完成的是 ownership/选型步骤，不是 publication、Read Model 或生产 Gate。
L38: 
L39: ## 6.2 隔离协议验收
L40: 
L41: 中心 Infrastructure `taiko_store` 已完成不可变对象/manifest、kernel flock、pending journal、fsync、兼容 C/H 投影、崩溃恢复、shared lease、显式回收和有界本地 pipe。A 提交 `85c4251` / 9.81.0 已 push；19 项合成磁盘/真实子进程测试通过，含五个进程死亡点、双 writer RMW、ENOSPC、备份恢复中断、pipe EOF 与 collection fence。主进程/最大单 child max RSS 25,516/25,504 KiB，cgroup high/max/OOM events=0；未测进程树 peak、全量 IO、生产恢复或 physical power loss。 [证据](evidence/phase6-publication-protocol-validation.json)。
L42: 
L43: 这是 ISOLATED_PROTOCOL_PASS，不是全 Writer 覆盖或 P1a/Read Model/Phase 6 生产 PASS。新包暂无运行入口引用，未同步 R、未部署、未读生产 userdata 或连接 DB，因此此次基础提交不重启 NoneBot。后续 6.3 接入真实 Writer/reader 时需统一激活和重启验收。协议立即 nonce retry 仅覆盖当前已提交请求，不承诺无限历史 receipt；legacy 未纳管输入不得标作 ready。
```

### 原文第 47–64 行
```text
L47: ## 6.3a Viewer 本地 pipe 客户端
L48: 
L49: 新增独立 Infrastructure client，实际启动中心 `taiko_store.bridge` 子进程，并在一个任务期间保留 kernel lease。原文用 stdin；消息/诊断/生命周期/清理均有限额，缺少 package 直接失败，不走旧 Writer fallback。6 项真实 Node↔Python 合成测试与局部 TypeScript PASS：current/H 单批次、读 lease 拒绝写、callback 错误退出、两个共享读者、缺模块与 deadline 后重新获取锁。 [证据](evidence/phase6-node-client-validation.json)。
L50: 
L51: 此客户端尚无生产调用入口；实现作为本地步骤提交，随 Phase 6 实际接入与版本化 Viewer 标准发布一并推送，不以此子步骤冒称生产 Writer 已迁移。下一步为中心 score read view、全部 Writer 接入及授权 fence。
L52: 
L53: 
L54: ## 6.3b 首批真实接入与一致读取
L55: 
L56: 中心 A `2d7bd9a` / 9.81.1 已 push：Wahlap/Hiroba 公共 save 入口完成整段 RMW 的 kernel fence，按 manifest 原文读取、成绩锁查询失败即停止、独立 H identity/sequence、current+delta 一次提交；与 `85c4251` 旧代码 Golden 比较 current bytes/hash 和 history payload，full/delta/锁定保留/删除不变。同一 clock 不再覆盖或把两个 observations 排反。Python reader 仅属于创建它的 lease；不能释放后复用。
L57: 
L58: Viewer shared Writer、account song edit/create/import 采用同一跨语言 fence 和暂存批次，回调完整成功后才提交。并发账户修改保留两者；晚发生的 SQL/业务失败补偿本请求新建的 lock，保留已有 lock；回执丢失时关闭原 child 后探测唯一 nonce，确认已提交便返回成功，不撤销已生效 lock。未知 outcome 不冒称 rollback；不声称 SQL 与 filesystem 构成跨系统事务。
L59: 
L60: Growth Overview/History/Passport/Recent 多文件产品读取及 request-local evidence reuse 持有一个共享 view。已纳管 current/H 从 immutable objects 读取，不受 compatibility projection 丢失影响；损坏 canonical object 返回明确 503，不变成 partial/空成绩。历史 invalid JSON 证据继续进入 invalid count；Goal/measurement/daily 产品含义不变。真实托管 fixture 的完整 Passport DTO 与旧实现 SHA 相同；独立同步在 Passport 读取期间等待，请求结束后下一次读取观察新 commit。Legacy 未接管兼容窗口保留其旧 stat/reload 语义；不能据此声称所有旧 Writer 已一致。
L61: 
L62: 最终综合 Python 24 + Node 66、TypeScript，以及版本 projection 1 项均 PASS。250 ms sampled cgroup peak 293,720,064 bytes（约 280.11 MiB），42.213 秒，high/max/OOM events=0；非完整百万记录容量证明。早期一次旧 QA data URL loader 的累计模块字符串触发 Node 1536 MiB heap limit；改为磁盘临时 ESM 并清理后，在原限额重跑全套通过。两个 fixture 问题（继承同一个读 context、跨编译模块的 Error constructor identity）与一个 TS fixture 类型问题已纠正并记录；未绕过隔离。[证据](evidence/phase6-source-adapter-validation.json)。
L63: 
L64: Viewer 预备 minor 0.82.0，本步骤本地提交，待完整 Phase 6 标准发布 push/deploy。A/R 运行目录尚未同步，新 Writer 未激活；线上保持 Viewer 0.81.11 与旧中心 Writer。剩余 Kinoko 批次、manual 永久删除、实际 dispatcher、u0 与其他多文件 reader、私有资源授权、Read Model、全量成本/恢复及统一上线验收均继续执行；Gate 6 IN_PROGRESS，不把此子步骤当成全阶段完成。
```

## E07 — 新协议引出的锁顺序与生命周期扩展
来源：`phase6-storage-consolidation.md`；文件 SHA-256 `86223582c28aa2722ead89cd29c4d32f8c7d9bef3d32fdc361dcfacc01a4895c`。

### 原文第 78–98 行
```text
L78: ## 6.3d 接入前发现：锁顺序与 manual lifecycle（待实现）
L79: 
L80: 2026-10-11，在开始 manual 永久删除前复核真实调用链：`goals/service.writePlayerGoal` 的 `mutateGoal` prepare 与 `goals/evaluation.evaluateActiveGoalForBinding` 的 observe 现在在 SQL `web_user_accounts FOR UPDATE` 后调用 score snapshot。新 source Writer 先持有 kernel EX 再 `INSERT web_song_locks`；该表有 user FK，可等待同一个用户行锁，形成 SQL→source 与 source→SQL 的反向依赖。**所有需要 source 的 Goal mutation/evaluation 必须先获取 source read view，再进入 SQL owner/binding transaction；保持原来的 expected profile/revision/active-goal 校验和 Python compute 在 SQL transaction 外。** cancellation 无 source 读取，不额外加锁。上线前必须有真实 bridge 与事务顺序回归，不能仅凭普通 sequential tests 声称无死锁。
L81: 
L82: Manual 永久删除当前直接 rename C 与整个历史目录、吞掉 rename 错误，之后分别删除 locks、各 owner bindings/Goal/measurement/cursor、bot bind 和 account。Managed manifest 仍持有 C/H，故直接 rename 不能删除 canonical source。现有多事务循环还允许失败后失去请求者 binding，重试无法完成清理。manual rename/upsert/delete 的 owner 检查在 fence 外，等待后需重查，防止已撤销的 owner 修改成绩。
L83: 
L84: 选型：保留 identity/product SQL 权威；manual lifecycle 以一次 SQL owner 清理事务配合可恢复 source tombstone 和 durable operation receipt/outbox，明确跨系统恢复方向，不冒称 SQL+FS 联合事务。Source EX → SQL owner/bindings 的顺序须统一，owner 撤销后所有普通读写 grant 拒绝，再完成/恢复 canonical C/H 清理。备份保持有界、私有、verified current/H，并覆盖独立 daily archive；错误不能吞掉。新 SQL receipt 是 Infrastructure lifecycle 记录，不是把 score facts 改成 DB authority；具体 schema/恢复 worker 要在 synthetic 与实际 `_test` DB guard 下验证后才采用。此处为已完成源码审阅与自主技术选择，**实现、故障验证与生产激活均待执行**；不能 PASS 6.3d/Gate 6。
L85: 
L86: 服务复核：Viewer PID 1063394、sync receiver PID 1063408 仍 active。实际单位名是 `taiko-sync-receiver.service`，不要把脚本文件名猜成 `taiko-sync-dispatch.service`；本步骤没有部署/重启。日更新服务由原任务运行，不能终止或排除其经验证的 title/song relation 变更。
L87: 
L88: 
L89: ## 6.3d.1 Goal source/SQL 锁顺序完成
L90: 
L91: Goal create/evaluate 先持有 source SH view，再进入 user/binding SQL `FOR UPDATE`；Python Overview 仍在 SQL 事务外。SQL store 锁定 binding 后核对 id、taiko id、source，same-row 身份变化会在读取 snapshot 之前冲突。原 expected active Goal / score revision、幂等 baseline、completion、cancellation 规则保留；cancel 不读取 score，无需新增 source 锁。
L92: 
L93: 实际 native ESM 测试暴露此前 esbuild bundle 未暴露的 shared/publication 初始化顺序问题：`withUserdataWriteLock` 的 eager alias 可访问尚未初始化的函数。将唯一 `getRuntimePaths` 抽到 Infrastructure 独立模块、shared 继续 re-export，publication 不再导入 shared，并保留延迟 Writer wrapper，消除循环依赖。运行配置含义/默认值无变；Growth 离线 loader 注入同步适配。
L94: 
L95: 最终 114 offline Node + 5 real SQL tests、局部 TypeScript PASS。新 3 SQL/bridge 用例执行实际 Goal service/store、实际账户 score Writer、kernel lease 与 MySQL owner/binding locks，核对进入 SQL connection 前 SH 已取得，Goal owner 锁持有时独立 Writer 未进入 EX，完成后 Writer 正常提交；eval 不额外调用 Growth Python，same binding row source substitution 被拒绝。真实 `SELECT DATABASE()` 返回 `taiko_annual_poster_test`，显式 mutation opt-in=1，仅本次合成 owner rows，finally 清理；未连/复制生产 DB。旧 SQL Goal completion/并发/隐私 cleanup 回归保持。
L96: 
L97: 此测试库的 song lock FK 不存在（历史独立 test bootstrap），因此**不是实际 FK enforcement 验证**，不重新要求 REFERENCES/full staging/B-0；通过实际 source lease/owner lock 顺序与独立 Writer 无法进入 EX，验证已消除这条反向锁依赖。生产 FK 的定义已经源码审阅，后续 lifecycle 仍需保持相同 Source→SQL 顺序。综合 49.426 秒，250 ms sampled cgroup peak 299,700,224 bytes（约 285.82 MiB），high/max/OOM events=0。[证据](evidence/phase6-goal-lock-order-validation.json)。
L98: 
```

### 原文第 126–149 行
```text
L126: ## 6.3d.4 永久删除的一次 SQL 事务、持久回执与恢复 worker
L127: 
L128: Manual 永久删除在 source EX 内先核验 owner、创建独立 verified C/H/daily 备份，再以一条 SQL transaction 锁定全部 Viewer owner/binding、bot binding 和 source account，保存有界私有 SQL backup 与 pending lifecycle receipt，清理 source 的 identity/Goal/measurement/cursor/showcase/song lock/claim 并重排 remaining binding/slot。失败整体 rollback；rollback 本身失败会销毁连接，不把 uncertain transaction 放回 pool。COMMIT 回执丢失仅凭 matching durable receipt 判断已生效。SQL backup 按 object keys canonical JSON + SHA 保存，兼容 MySQL JSON key 重排，数组/raw strings/timestamps 保留；8 MiB/10,000 rows/128 owners 上限在撤销前核验。
L129: 
L130: 授权撤销后清除 canonical C/H，verified daily purge 再逐 namespace unlink/fsync，形成新 empty publication。旧 backup source、不同活动 generation 或变更后的 daily 均拒绝覆盖/删除。原 actor 可在 binding 已删除后用既存 operation 重试；其他 actor 403。成功 API 返回 opaque backup/operation UUID，不泄露磁盘路径或 SQL recovery payload。永久 manual id 不重用。新 Infrastructure lifecycle table/outbox 不成为 score authority。
L131: 
L132: 启动/60 秒 tick 的 bounded worker 每次只恢复一个 pending source，single flight，close 取消后等待 owned work；failed item 更新 attempt 时间以避免队列饿死。它只向前完成已撤销 grant 的 cleanup，不重新授权；日志只含固定通用提示。Source→SQL 锁顺序贯穿 cleanup，不持 SQL lock 等待 source。Source clear 使用一个 replace-history staged RPC，不为 50,000 个 H 各开请求；读本请求立即观察 empty C/H。
L133: 
L134: 最终 43 Python + 127 offline Node + 27 real `_test` SQL（新增 12 manual deletion）、domainRead/publicationLifecycle 两组局部 TypeScript 全 PASS。覆盖一次 SQL commit、多 legacy owner、晚发生 SQL failure、失败 rollback 销毁连接、丢失 COMMIT 回执、source failure 后 fresh forward recovery、两个独立 delete 并发、不同 source/daily 拒绝、坏 receipt 不触碰文件和真实 Node 进程在 SQL commit 前/后/source publication 后退出；actual TCP 断开前态 rollback/后态 receipt 向前恢复均证明。SQL checksum 经实际 MySQL JSON round-trip 验证。现有 frozen manual/Goal/acquisition/publication 回归保持。[证据](evidence/phase6-manual-lifecycle-validation.json)。
L135: 
L136: QA 84.824 秒，250 ms sampled cgroup peak 332,267,520 bytes（约 316.875 MiB），high/max/OOM=0，owned systemd unit success/exit 0。真实 SELECT DATABASE() 为 `taiko_annual_poster_test`，显式 opt-in=1，only owned synthetic rows/finally cleanup；fixture 不含 production FK，**不是生产 migration/FK enforcement PASS**，不重开 B-0/DB Isolation。未读取生产私有数据/DB，禁止网络，无新 listener。初始 Goal fixture 缺 source_mode、JSON key 顺序与 TS args 类型问题均修正后完成最终全部验证。
L137: 
L138: A `8e3a48a` / 9.81.3 完成标准 commit/push；仅 A Infrastructure，未同步 R/未影响现有 NoneBot，因此此步不重启。Viewer 0.82.0 本地步骤留档，等待完整 Phase 6 标准发布 push/deploy；线上仍 0.81.11。这是 MANUAL_DELETE_RECOVERY_PASS，不是完整恢复或 Phase 6 PASS。下一步继续 SQL/source/daily 联动恢复，manual create/claim/detach SQL failure atomicity、通用解绑/注销/grant、dispatcher/u0/daily 的全部 Writer/reader convergence、Read Model/百万记录与最终统一激活发布。
L139: 
L140: 
L141: ## 6.3d.5 SQL/source/daily 联动恢复协调器
L142: 
L143: Trusted internal `restoreDeletedManualSource` 读取原 lifecycle receipt，核验 SQL backup canonical checksum、固定表/column allowlists、source/owner/product scope、原 source backup commit/sequence 与全部独立文件。旧 source 必须是 receipt 对应的精确 tombstone；续做只接受本 operation 的固定 restore nonce。新的活动 source、daily namespace/measurement、冲突 SQL primary key/owner 或已注销 Viewer user 均停止。Portable test 允许配置的全新 root 只有私有备份，不依赖原 canonical object store；实际切 root 时必须先停用全部旧 Writer/reader，不能同时跑两个 root。
L144: 
L145: 在恢复文件前持久设 `restoring`，删除 worker 不再选择它，同 actor 的永久删除重试也拒绝。保持原 Source EX → SQL 锁顺序，在 EX 内通过中心唯一 Python implementation 构建新的 C/H commit、逐 daily namespace 恢复并核验，再以一条 SQL transaction 恢复原 owner/binding id、Goal、measurement、cursor、showcase 与 song locks。旧一次性 claim 不恢复。用户已经新选中的其他 binding 不覆盖；bot 恢复追加到现有 slots，保留其 current selection。文件或 SQL failure 期间 SQL grant 保持不可用，已经准入的 `restoring` 可以自动向前完成；普通 `published` 用户删除不能被自动重新授权。
L146: 
L147: 同一 worker 每 tick 从 pending/restoring 的 due operation 选择一个，沿途保留一个 captured SQL pool，不在 shutdown 中解析/重开 pool。SQL/文件都确认后状态 `restored` 与 authority 在同一次 COMMIT 生效；失去 SQL ack 只凭相同 operation/nonce 的 durable receipt 判断成功。重试是 operation acknowledgement，不把更晚的正常成绩修改回退；再次实际删除会新建 receipt，旧 operation 不能复活它。mysql2 的 code/sql/sqlState/sqlMessage diagnostics 可能含整个私有 SQL INSERT，入口现替换为 generic 503，不传 sql/cause；正常 owner/确认错误保留。
L148: 
L149: 最终 43 Python + 128 offline Node + 48 actual `_test` SQL（新增 21 restore）、domainRead/publicationLifecycle 两组局部 TypeScript 全 PASS。完整往返的 current/all H 原文、daily 原文及全部 SQL fields/id 的 canonical SHA 相同；正常修改、重复恢复和再次删除正确。实际 owned Node 进程在 reservation 后、文件恢复后、authority COMMIT 前/后退出，未 commit 的 TCP transaction 回滚、partial file recovery 不赋予 grant、worker fresh resume/idempotent 均验证。并发两个恢复仅一个 SQL commit、丢失 COMMIT ack、失败 rollback 销毁连接、新 current/slot、multi-bot、错备份/跨 source/PK conflict/deleted owner、private driver diagnostics、captured pool 关闭复核及不自动恢复普通删除通过。[证据](evidence/phase6-manual-recovery-validation.json)。
```

## E08 — 权限/凭据/QQ接入与端到端缺口
来源：`phase6-storage-consolidation.md`；文件 SHA-256 `86223582c28aa2722ead89cd29c4d32f8c7d9bef3d32fdc361dcfacc01a4895c`。

### 原文第 309–319 行
```text
L309: ## 6.3e.8.1 私有成绩读取与显式中心服务授权
L310: 
L311: 正式 Developer userdata route 继续真实 quota，但 quota/开发者申请/HTTP userid 不构成 Source grant。有效 Cookie 或 active Developer token 仅访问其自有完整绑定，非 current/自有隐藏 binding 保留；跨账号由私有运维按 token id 登记明确 Source allowlist/scopes。没有默认全源权限，中心服务的 '*' 需要显式配置；同一用户的其他 token 与 Cookie 不能借用该能力。有效 session/token/account、完整 binding 或 service tuple/revision/expiry 在 Source SH 前后复核，不能在同一次读取中静默 fallback；manual SQL authority 删除后即拒绝尚未 outbox cleanup 的 canonical bytes。首次 actor SQL 前捕获 pool/Source root/kernel cwd，managed corruption/lease loss/SQL 故障固定 503，权限失效 401/403，健康完整 raw JSON/未知字段保持。
L312: 
L313: 新增私有 stdin 配置 CLI：实际 SQL username+email 完整站点 operator proof，account→token→grant→audit 顺序、一次 COMMIT 与最小 durable audit；inspect 不变更权限，exact/concurrent replay 不覆盖后续撤销，late failure/rollback destroy/ACK loss/no-commit 验证。16KiB stdin/45s lifetime/2 DB connections，实际 SELECT DATABASE 与 mutation opt-in；无 HTTP grant 配置入口、无 raw token/secret argv、无 Source 成绩写入。详细选择、协议与运维：[source-service-operations.md](source-service-operations.md)。预留 mutation scopes 不表示代理已迁移。
L314: 
L315: 先定向 41 SQL/两组 TS PASS，再 broad regression 149 offline +378 actual guarded SQL（新增43）/两组 TS PASS；审计后增加首次 SQL 前 Source paths capture 与 lease loss，最终定向 45 SQL/两组 TS PASS。现有335 SQL与149 offline所涉及的产品/fixture文件未再改变，只有新 Source helper 与其专用 tests 增加 hardening；两轮受测文件 SHA独立保存，不能把前一轮的文件哈希当最终哈希。Source9个 code/fixture SHA 与6.3e.7证据完全一致，因此120 publication/170 domain Python沿用此前实际结果，不冒称本轮重跑。初轮 manual_account_id 变更的错误分类失败已修复重跑。
L316: 
L317: Broad 473.66s/430.598MiB sampled，最终 40.326s/341.367MiB；high/max/OOM=0，实际 wrapper exit0/journal deactivated success/MainPID0/collected cgroup gone，owned children/listeners/roots/rows finally 清理。完整证据：[phase6-source-access-validation.json](evidence/phase6-source-access-validation.json)。不冒称上游真实网络、production FK、完整 Nuxt/NoneBot 或在线 authenticated验收。
L318: 
L319: 本子步 PRIVATE_SOURCE_READ_AND_EXPLICIT_SERVICE_PROVISION_PASS；Gate6 IN_PROGRESS。A code/9.81.11/R/runtime unchanged，无 Source修改或同步，所以本步不重启 NoneBot/API；Viewer0.82.0本地步骤，按标准统一发布推送，live0.81.11/PIDs1063394、1063408、829173 unchanged。尚未为生产 token登记能力。继续 Wahlap旧 dispatcher caller、Hiroba private stdin/QQ bind grant/native writer、SDK/cache、u0/daily/all Writer/P1a、完整 Read Model/invalidation/百万成本与IO/RSS、ops restore/cleanup、fixed dependencies/R sync/统一发布与真实线上产品验收。
```

### 原文第 322–346 行
```text
L322: ## 6.3e.8.2 中心更新代理、历史与 renderer 同一视图
L323: 
L324: 正式 Wahlap 更新/Hiroba 同步/历史代理继续真实 quota，使用有效 Cookie 或 active Developer token 的完整自有 binding，或按 token 登记的 Source/scopes/revision/expiry。更新要求 owner binding 的平台匹配；manual 不允许外部 acquisition。parent 首次 actor SQL 前捕获 pool/root/cwd，不持 EX 等待 child；私有 stdin worker 在 Source EX 后锁定并复核实际凭据和完整 owner/service tuple，每次 C/H 发布前及最终只读 SQL COMMIT 前再次证明。Wahlap 原真实 refresh/local snapshot 保留两次独立观察，Hiroba 原真实同步保留一次 C/H；晚 SQL/transport/返回权限失败保留已经授权的成绩，不冒称跨文件/SQL 联合回滚或新增 nonce 重放。旧 requestSyncDispatch 现已无正式 caller；Hiroba 凭据 bind 仍待迁移，不能把同步 stdin 改造说成全部密码 argv 已移除。
L325: 
L326: 返回在 fresh SH 内核对 exact produced commit/sequence、捕获的凭据/grant 和存活 lease。历史从 canonical raw 读取，保留原文件名顺序、_meta.ts、完整 full/delta/未知字段与无效 JSON 跳过；累计 32MiB 超限固定 503，不截断。renderer 的 current/H 使用同一 EX view 或默认 SH，七个冻结 AST 函数与实际未改 R 一致；previous song/dojo、两种 showAll 的 PNG 哈希用 synthetic PIL panels/columns 对照，不冒称全素材视觉验收。
L327: 
L328: Account/source 两类 worker 共用单 Viewer 进程 2 active/8 queued/30s queue；32KiB stdin/64KiB stdout/8KiB stderr，Wahlap 180s、Hiroba 900s，native 独立 SIGALRM，child close 后释放槽。凭据只经 stdin/捕获连接，不进入 argv；存储的 Fernet 密码在同一 SQL connection 读取解密，不在事务中调用隐式 DDL COMMIT。图片为 16MiB 以内的私有随机 nonce 文件，目录最多16个、1800s过期清理，Node 验证大小/普通单链接文件/SHA后保留原 DTO base64，并在成功/失败后清理。多副本 host admission 与总体容量继续后续审阅。
L329: 
L330: 最终 Source 126 publication（新增6 renderer）/170 domain、client52（新增4 missing-token）、153 offline Node（15 worker transport）、409 actual guarded SQL（335 existing+45 source access+29 proxy）及两组局部 TS PASS。实际 Cookie/active token/service 与 native PyMySQL/Source/real worker 跑通；五个真实 child退出、排队/返回 binding/session/service替换、fetch后expiry、只读 COMMIT ACK loss、stored encrypted credentials、Hiroba resolved-id拒绝、private PNG暂存/超限/清理、history累计容量与projection loss均覆盖。所有 native connection 实际 SELECT DATABASE()=_test且opt-in1，上游/图片 panels 为 synthetic，测试库无生产 FK，owned child/listener/root/rows 清理。证据：[phase6-source-proxy-validation.json](evidence/phase6-source-proxy-validation.json)。
L331: 
L332: 回归分两段：Source126/170先已通过，随后客户端因QA驱动错误选择系统Core0.1.1而在收集阶段停止；改为原guarded validator与固定Git安装Core0.1.2/Contract0.1.0后，client/TS/Node/SQL完整通过。两段受测产品哈希完全相同。最终后一段533.993s/502.090MiB sampled、high/max/OOM0，实际wrapper exit0+journal success/MainPID0/collected cgroup gone。客户端四个私有成绩 SDK 调用现在要求token，Hiroba等待900s；缓存授权与其余私有SDK未冒称完成。
L333: 
L334: 本子步 PRIVATE_CENTER_UPDATE_HISTORY_AND_RENDER_VIEW_PASS，Gate6 IN_PROGRESS。A9.81.12与client0.2.1标准源码提交/推送的完整OID以中央证据为准；R没有复制这些预备代码，所以running Bot/API未加载，无本子步重启。Viewer0.82.0本地阶段提交，待完整Phase6标准部署统一push，live0.81.11/PIDs1063394、1063408、829173不变，未登记生产service能力。继续Hiroba credential/bind、QQ bind、permission-aware bounded cache、u0/daily/all Writer/P1a、完整Read Model/invalidation/百万IO/RSS成本、trusted ops与fixed deps/R sync/统一发布/真实在线产品验收。
L335: 
L336: ## 6.3e.8.3 QQ 私有 metadata、一次事务与 nonce 恢复
L337: 
L338: 三个正式 bind 路由保留实际每日 quota，改用 active Cookie/Developer token 的 verified QQ authority，或按 token 显式登记 principal+Source+bind scope。principal 与成绩 Source 是独立能力对象；nullable principals_json 同时迁移 grant/audit，Source-only 旧配置兼容，bind_* 缺少明确身份范围拒绝。普通 upsert 须有完整自有同平台 Viewer binding，manual 仍走创建/认领入口；服务返回/修改均检查全部成员 Source。selected service 不静默切 owner，大小写/格式不合并，完整授权在排队后/事务中/返回前复核。运维细节：[source-service-operations.md](source-service-operations.md)。
L339: 
L340: 此 metadata 仅 SQL，Source C/H/sequence 不变，不在 SQL 后申请 Source 锁。共享 2 active/8 queued/30s admission，SHA identity GET_LOCK 等待 5s；account→credential→principal/target grant→bind rows→selection→receipt，一次 COMMIT。GET 不写 current/state，在内存恢复原 healthy 首项选择及 manual/u0 DTO。每身份最多128绑定、slot小于一百万；legacy表不一致/缺失manual authority固定503。两种 mutation 支持 requestId；最小 receipt 没有 raw Cookie/token/完整 DTO，same credential+grant+intent replay返回当前结果，不重复写入或覆盖后续选择。ACK不明由捕获pool新连接证明 exact receipt+outcome，未COMMIT不能报成功；rollback/release-lock不明销毁连接。
L341: 
L342: 定向79 SQL与局部TS PASS，最终56 client/153 offline Node/443 actual guarded SQL（409 existing+34 new）及两组TS PASS；两个真实Node COMMIT前后退出、实际5s锁等待、同nonce并发、撤权/expiry/完整target替换/返回前session和QQ损失、failed rollback与ACK loss/captured pool、真实operator principal配置/audit replay、原DTO与no GET writes均覆盖。旧quota SELECT/INSERT并发导致第二请求503，修复为单条unique-key原子increment/cap；初稿误解auto-increment OK packet已依据实际数字头纠正，实际IP1/token2并发边界与重试通过。失败驱动缺opt-in在连接前拒绝、TS narrowing和destroy数量断言纠正均留档，不冒称初轮全通过。
L343: 
L344: 最终567.064s/477.078MiB sampled，high/max/OOM0，actual wrapper exit0/journal success/MainPID0/collected cgroup gone。Source A未变9文件SHA与6.3e.8.2一致，沿用126 publication/170 domain Python PASS；本轮没有Source修改、push或R同步。SQL测试DB实际SELECT DATABASE()=_test且显式mutation opt-in，未复制生产数据或做生产mutation，测试库无production FK证明，owned rows/roots/children/listeners finally关闭。完整证据：[phase6-bot-binding-validation.json](evidence/phase6-bot-binding-validation.json)。
L345: 
L346: 本子步PRIVATE_QQ_BINDING_TRANSACTION_AND_REPLAY_PASS，Gate6 IN_PROGRESS。client0.2.2三个SDK增加token要求与可选request_id，固定Core0.1.2/Contract0.1.0不变，源码标准commit/push；Viewer沿用Phase6预备0.82.0本地步骤，统一标准部署负责push/build/restart。live0.81.11及三个服务PID不变，没有生产service登记或线上授权烟测。Hiroba credential status/bind的旧argv/多次credential与QQ autocommit、B旧缓存fallback，以及全Writer/u0/P1a、完整Read Model/invalidation/百万IO-RSS成本、trusted ops/fixed R deps/停止旧Writer后sync/标准发布与在线Gate继续处理。
```

### 原文第 349–361 行
```text
L349: ## 6.3e.8.4 Hiroba 凭据授权、纯 discovery worker 与 SQL 一次提交
L350: 
L351: 两个正式Hiroba凭据路由保留真实每日quota，要求有效Cookie/Developer token的完整自有外部binding，或显式token级Source/scope；普通绑定必须预先拥有同平台Hiroba binding，服务绑定另须明确principals。发现的目标卡片和返回QQ全部成员逐项授权，manual拒绝，selected service不降级为owner。首次actor SQL前捕获pool/root/cwd及worker key，等待/事务/receipt INSERT后完整复核；另补QQ回执INSERT后的expiry proof。详见[source-service-operations.md](source-service-operations.md)。
L352: 
L353: native worker只运行原playable-card discovery、兼容Fernet加解密和keyed HMAC意图，不连接SQL、不写credential/token/成绩文件。密码仅经私有stdin，旧无授权Hiroba adapter返回410，原password argv machinery退出。状态保留无凭据false，损坏密文固定503；卡片顺序、target过滤、空结果、manual/current完整DTO及legacy Fernet oracle保持。SQL一次事务保存全部凭据、可选QQ metadata/current state和最小receipt，C/H/sequence不变。操作nonce先GET_LOCK5s，有卡片的QQ另用原principal gate；共享2 active/8 queued/30s admission。stdin32KiB/stdout16KiB/stderr8KiB，crypto30s/discovery180s/native独立SIGALRM/TERM后1.5sKILL等待close，客户端timeout300s；configured_by_qq扩至191。
L354: 
L355: 已提交同actor/grant/keyed intent nonce跳过登录与重写，返回当前QQ选择，不重置后来selection；不相关自有binding新增不使回执失效，已选binding撤销拒绝。ACK不明仅在捕获pool的新连接证明exact回执、credential及当前outcome才成功；no-COMMIT仍503，rollback或named release无法证明销毁连接。receipt不保存raw密码、token或完整DTO。
L356: 
L357: 最终134 Source publication/credential（126+8）、170 domain、59 client、158 offline Node、477 actual guarded SQL（443 existing+1 QQ receipt proof+33 Hiroba）和两组局部TS全部PASS；14 Source/43 Viewer/5 client受测文件最终SHA未变。真实Cookie/token/SQL/native CLI、三个discovery等待撤权、receipt后expiry、captured pool/root/key替换、failed rollback/ACK loss、并发nonce/5s锁、两次实际Node COMMIT前后死亡、native失败/死亡/独立alarm、long official principal、旧adapter410和完整healthy DTO覆盖。最初SQL fixture遗漏Source sys.path导致106项中22项启动失败，修正后focused110及hardening38通过；final使用最终IO禁止guard再完整重跑，不冒称初轮通过。
L358: 
L359: 最终QA 728.739s/513.129MiB sampled/high-max-OOM0；systemd journal成功终止，MainPID0/collected cgroup gone。每个native SQL连接实际SELECT DATABASE()=_test且显式mutation opt-in，未复制生产个人数据、凭据或做production mutation；owned rows/root/listener/child清理。上游回复synthetic，测试库缺production FK，不冒称official network/full Nuxt/full NoneBot/线上authenticated或全Writer Gate。完整证据：[phase6-hiroba-credential-validation.json](evidence/phase6-hiroba-credential-validation.json)。
L360: 
L361: 本子步PRIVATE_HIROBA_CREDENTIAL_TRANSACTION_AND_REPLAY_PASS，Gate6 IN_PROGRESS。Source9.81.13与client0.2.3标准提交/推送OID以证据为准；Viewer0.82.0本地步骤，待完整Phase6标准部署统一push。运行R未复制、NoneBot/API未加载本步代码，不在源码步骤重启；live0.81.11及三个service PID不变。继续permission-aware bounded cache/native Bot凭据及QQ Writer/u0/daily/all Writer/P1a、完整Read Model/invalidation/百万冷暖IO-RSS成本、trusted restore/cleanup/runbook/fixed R deps/停止旧Writer后sync/统一发布与真实在线产品验收。
```

## E09 — 仍未完成的最终规模验证与激活
来源：`phase6-storage-consolidation.md`；文件 SHA-256 `86223582c28aa2722ead89cd29c4d32f8c7d9bef3d32fdc361dcfacc01a4895c`。

### 原文第 491–529 行
```text
L491: ## 6.3e.8.6h 原生国服所属更新与同视图渲染（STEP_PASS）
L492: 
L493: 2026-10-12。一次bounded current DTO确定账号/槽位，实际framework sender传入Native update和first-bind自动更新，userid-only helper在IO前拒绝。独立模块捕获完整current row/state→Source EX→同principal gate→SQL证明，每publication、同canonical view渲染前后与返回前证明row_id/principal/ID/source/slot/current/visibility/u0。拒绝foreign/bare/manual/non-Wahlap/virtual/过期current。silent ID cooldown、原四请求getUserData与common C/H writer保持，所有Native国服更新共用process内2线程准入/30s等待（非host全局准入声明）。首次绑定也走同一路径。
L494: 
L495: managed getUserData要求精确profile.userid，阻止原search fallback首玩家写入错误Source，未受管旧public selector不改但不宣称已verified。render使用同EX捕获reader，16MiB界限/错误保留text-only成功；图片后无第二text回复，原all/default5/404/-1/成功文案保持。metadata/driver失败固定状态回复，不再写本handler旧ad-hoc diagnostics。合法C/H observation在后续SQL/owner失败保留而失败返回，不冒称SQL/files原子事务。
L496: 
L497: 258 Source（241旧+17 input/admission/actual command与profile）、28新actual_test SQL复合用例PASS；9production/real排除/warning1。原70 native metadata/mutation/Hiroba/QQ SQL在旧fixture失败轮先通过，分轮合计98；B0.2.7/223/TS前轮证据沿用。真实SQL、实际getUserData四合成HTTP与common writer、actual daily capture/compute（空合成成绩，不宣称daily数值全验收）、captured-view synthetic小render，非真实PNG/官方上游/完整NoneBot或online/百万性能。两条保留official/cooldown及旧bind-image test通过实际AST namespace。验证own hidden、完整owner/state、5s同lock、late revoke/rollback/ACK、四个before/after publish/readonly COMMIT进程退出、Source等待visible/row-id/source/u0替换/next retry清理。
L498: 
L499: Frozen926ad23 acquisition在同Source/SQL/clock、两个独立owned根各观察两次，current/full-delta H内容SHA256严格相等；filename时间/序号/结构一致，随机nonce正常不同。tracked公开V2 catalog预置fresh避免QA background网络/共享文件写入，actual daily计算不stub；所有native及song-lock连接实际SELECT DATABASE()=_test+opt-in1，owned行/root/children/leases清理，无production私有data复制/SQL mutation。
L500: 
L501: 67.602s/250ms sampled308043776bytes/child217192KiB/high-max-OOM0，wrapper21484 exit0，unit1791776870-2153889 successful/ExecMainStatus0/inactive/MainPID0/cgroup gone。AST fixture符号遗漏、wrong cwd/daily公开catalog refresh、Golden假定旧投影/随机filename相等均完整保留；256/28通过后补固定metadata/driver错误反馈再最终258/28。详见[证据](evidence/phase6-native-wahlap-authority-validation.json)。
L502: 
L503: Source539f6e5/9.81.26标准push且remote一致。本步7个taiko文件，用户期间Milky ff1778f/8c877ee与926ad23无taiko差异，parent保留且无miku用户改动混入；回退8c877ee保持用户提交。Viewer0.82 SQL测试/证据本地準备，Bfa0983d/0.2.7和Core0.1.1/0.1.2未变；R未复制/重启/部署，live0.81.11与三个active PID1063394/1063408/829173不变。Native authority整轮/Gate6 IN_PROGRESS，继续其他private Native readers/startup SQL writer、全u0/daily/maintenance Writer/共享persistent准入/P1a停止legacy writer后接管、完整Read Model/精确失效/百万冷暖IO-RSS/trusted恢复cleanup/runbook/fixed R deps/生产grant/标准Viewer发布与R同步重启/真实online Gate。
L504: 
L505: 
L506: ## 6.3e.8.6i 原生 u0 发布与旧启动绑定 Writer 退出（STEP_PASS）
L507: 
L508: 2026-10-12。原生 u0 不再使用 stat/mtime 缓存、无界身份锁字典或逐文件覆盖。先按 Source 顺序持所有成员 SH，再取派生 u0 EX；成员必须已 canonical，读请求不能自动纳管成员，也不能覆盖未纳管的现有 u0。用户资料来源与 manual 成员保持原生定义，客户端 external-only 规则不变。configured userdata root 优先。current/history 同一 publication，初次与增量时钟保持冻结实现；增量不重写已有历史。旧自动 startup bind SQL/multi-bind JSON Writer 删除，保留纯 normalization 兼容函数及 feature-switch/credential initialization/telemetry/QQ cleanup。
L509: 
L510: manifest 可选 opaque dependencyHash 包含精确 principal、成员 commit 与顺序、profile member、当前进程使用的 merge rule revision；进入 request hash 且其他 publish 不自动继承。来源仅改历史时保存新依赖回执，不捏造成绩观察；same-mtime 新 commit 仍失效。投影替换不能代替 canonical bytes，损坏对象失败。每进程2准入、30s准入/锁等待、32MiB aggregate input/derived encoded output是明确上限，未称为已通过大账号或全主机准入。active rule map仍沿用冻结进程内核，实际catalog刷新/Read Model失效继续后续处理。
L511: 
L512: 319 guarded Source、40 pure publication/backup tests、4新增边界检查分轮PASS，另25故障子场景。冻结539f6e5在两套合成root/固定clock下初次与增量current bytes及全部H filename/content SHA完全一致。两个实际u0 child提交前后退出分别恢复旧/新完整代；另一个child持Source111/222 SH与u0 EX时，三者的竞争EX均被拒绝，退出后都可取得。覆盖same-mtime source commit/profile切换、warm不重建、不制造新代、history-only不追加点、未纳管拒绝、corruption、不合法参数、长principal、aggregate cap/admission、manual/root、dependency nonce冲突与startup调用边界。没有SQL、真实上游、PNG、完整NoneBot boot或线上/百万验收。
L513: 
L514: 最终两轮31.617s/285368320byte cgroup250ms采样与3.213s/143396864byte，largest child314404/178708KiB；high/max/OOM0，wrapper exit0/journal正常退出/cgroup删除。早期317pass/1fail的fixture对hardlink投影原地写入造成正确hash拒绝，修正为inode替换；297pass/6fail的spawn递归runner改为同memory wrapper内单独python -m pytest，生产协议不放宽。失败日志保留，完整[证据](evidence/phase6-native-u0-publication-validation.json)。
L515: 
L516: A9.81.27/d4a9d22仅8个本步文件标准commit/push及actual remote核对，miku用户改动保留；Viewer0.82档案仅本地提交，B0.2.7/Core pins不变。R未复制或重启，无生产SQL/数据复制/部署，live0.81.11与三个active PID不变。已有u0与成员须停完旧Writer后显式纳管，不能首次read重建覆盖旧历史。回退Source539f6e5、Viewer档案f08abd0；协议激活后不能重新启用旧自动startup绑定Writer。Native整轮/Gate6 IN_PROGRESS；继续其余Native私有return proof、daily/backfill/maintenance Writer、P1a、Read Model精确依赖/失效、限额/百万冷暖IO-RSS、trusted ops/fixed R deps、统一标准发布与真实online验收。
L517: 
L518: 
L519: ## 6.3e.8.6j daily 采集、趋势与 backfill Writer 收敛（STEP_PASS）
L520: 
L521: 2026-10-12。daily文件IO收敛到Source Infrastructure的daily.py。普通archive持Source SH→namespace EX，显式readonly用namespace SH；成绩Writer已有EX直接复用，不升级SH。v1/v2无显式store的采集也在同一SH下完成。backup/restore/purge在Source EX下共用同一namespace锁，因此删除/备份/收集不能越过活动daily Writer。namespace锁30s、directory/file/lock普通文件和O_NOFOLLOW、8MiB envelope、fsync原子替换及父目录持久化；变化仅允许活动canonical current/history，未纳管或tombstone不能新增测量。已冻结读取与旧past/today/capturedAt/computedAt/origin/namespace规则保持。daily文件仍独立于C/H commit，不宣称v1/v2或SQL/filesystem共同事务。
L522: 
L523: 趋势从history获取、计算至archive保存持Source SH。backfill改为同一SH下canonical raw history/metadata排序与streaming state，投影丢失仍可补算；保留10000文件/32MiB单文件，seed普通文件8MiB/10000条，root明确参数优先于env/default。新的daily atomic stage使用Source标记，由已有Source EX collector识别；SH Writer不抢先清理其他活跃namespace。实际进程退出后EX收集器可删除本Source draft，正常archive/历史/C/H保留。
L524: 
L525: 349 guarded Source+40 publication/backup+3旧趋势adapter=392检查及25故障子场景，在同一serial memory wrapper内PASS。冻结d4a9d22的v1/v2完整JSON字节，在stub计算及3条合成成绩/跟踪的公开catalog/实际Core公式下都相等；旧值不随后续公式变化。实际child在daily replace前退出保留完整旧文件，fsync后退出保留完整新文件；C/H head不变、dead draft收集/后续写成功。child持daily Source SH/namespace EX时竞争Source EX及namespace EX超时，退出后fence释放。覆盖EX复用、Root/Source/expired lease、tombstone/legacy拒绝、readonly/exception、symlink/caps、canonical projection loss和趋势history capture前即持SH。
L526: 
L527: 最终41.078s/267546624byte cgroup250ms采样、child max321568KiB、high/max/OOM0；wrapper exit0/journal正常退出/owned child reaped/cgroup gone。早期333pass/1fail为Golden fixture未先纳管canonical Source，改fixture不放松write要求；额外实际catalog测试起名test_real_被offline安全过滤，改成明确合成命名后补测及最终整轮均通过，不去掉生产隔离。完整[证据](evidence/phase6-daily-writer-validation.json)。没有SQL、生产私有数据/复制、真实upstream、PNG、完整NoneBot boot、百万或online验收。
L528: 
L529: 维护入口核对：storage_maintenance只清理host VSIX并明确保护userdata；taiko_admin_backup管理catalog/cover/admin日志表及其备份，不读写成绩。这两者未修改、未针对主机缓存执行。Source collector按EX保护新daily stage，独立portable backup/restore/purge的40+25验证保持。A9.81.28/cc66b22仅12个本步文件标准commit/push和actual remote一致，miku用户改动保留；Viewer0.82只档案本地提交，B/Core pins不变，R未同步/重启、无部署，live0.81.11/三个PID不变。回退Source d4a9d22、Viewer档案f33fbe3；激活后不得重新启用无Source fence的旧daily Writer。Native私有return proof、最终Writer范围核对、P1a停完旧Writer后纳管、Read Model精确daily等依赖/失效、百万冷暖IO-RSS/限额、trusted ops/fixed R deps及统一标准发布/真实产品验收继续，Gate6 IN_PROGRESS。
```

## E10 — 新的服务授权与锁/任务时限
来源：`source-service-operations.md`；文件 SHA-256 `0541f11143207bf665de323e6fc06fb3e74f135454e18bd119e1dd57e7c0b4ea`。

### 原文第 3–9 行
```text
L3: 适用范围：Phase 6 / 6.3e.8.1–4 的 Developer userdata、历史、Wahlap/Hiroba 更新、QQ 绑定及 Hiroba 凭据代理。客户端缓存授权和其余 Phase 6 Gate 仍待完成，不能据此激活整个阶段。公共曲库、公开玩家资料与排行榜继续使用原协议。开发者每日额度与私有授权是两个独立检查。
L4: 
L5: `GET /api/developer/userdata/:userid` 接受有效登录 Cookie 或有效开发者 Bearer token。普通凭据只能读取其账号自有绑定，允许自有非 current 绑定；完整 binding id/taiko_id/source/manual_account_id 在 Source SH 前后复核。绑定本身沿用现有产品的 SQL 授权含义，不额外声称已证明上游账号归属。跨账号中心服务需要按 **token id** 单独登记，不能以开发者申请获批、每日额度、HTTP userid/userId/QQ、同一用户的另一枚 token 推导授权。
L6: 
L7: `taiko_source_service_grants` 每个 token 一行，保存明确的 service name、Source allowlist、scopes、状态、expiry 和 revision nonce。服务读操作选择授权后不得在撤销时切换成另一类授权继续返回旧结果；新请求可重新选择仍有效的自有绑定。所有读取在首次 actor SQL 前捕获 SQL pool、Source root 与 kernel cwd，并在 SH 内入口与返回前复核有效凭据、完整授权以及存活的 manual SQL authority。托管对象损坏、lease 失效或私有 SQL 故障返回固定 503；无身份 401、无资源授权 403。健康响应仍是完整原始 JSON，未知字段不丢失。
L8: 
L9: 中心服务可选择明确的 Source 列表，或显式 `"*"`。后者是受信中心服务的跨用户能力，只能由私有运维入口登记，普通开发者 token 没有默认全源访问。生产激活前先核对真实服务、token owner 和实际 Source 使用范围；taiko-bot 尚无运行中的业务进程，本子步没有为任何生产 token 登记能力。
```

### 原文第 30–42 行
```text
L30: 已接入的正式 scope 为 `source_read`、`history_read`、`wahlap_update`、`hiroba_sync`、`bind_read`、`bind_write`、`bind_current`、`bind_remove`、`bind_visibility`、`score_token_issue`、`bind_migrate`、`hiroba_credential_status`、`hiroba_bind`。Source 列表 1–128 项，ID 为 1–128 位 ASCII 字母、数字、下划线或短横线；必须同时满足 stdin 总长度。`expiresAt` 为 DB DATETIME 格式 `YYYY-MM-DD HH:mm:ss`，使用数据库的时间语义；active 登记要求未来时间或 null。
L31: 
L32: 含 `bind_*`、`hiroba_bind` 或 `score_token_issue` scope 的登记另须明确 `principals`：1–128 项身份列表，或显式 `"*"`。身份支持 1–128 位裸数字、`onebot_v11:` 加 1–128 位数字、`qq_official:` 加 1–128 位 ASCII 字母/数字/下划线/短横线。大小写及不同格式分别授权，不自动合并别名。遗漏或 null 拒绝登记；仅含 Source scopes 的旧配置可保持 null。新 nullable `principals_json` 同时存入 grant 与审计表，升级只忽略已存在列的 ER_DUP_FIELDNAME，其余 SQL 错误停止。
L33: 
L34: QQ 代理配置可在上述请求中改为 `"scopes": ["bind_read", "bind_write", "bind_current"]`，并增加 `"principals": ["onebot_v11:12345"]`。Source allowlist 须包括该身份已绑定的全部 Source 与本次添加的 Source；不能通过空绑定绕过添加目标检查。生产真实 principal/token 登记继续留到最终激活。
L35: 
L36: QQ 历史迁移需另列 `bind_migrate`，原QQ私聊申请code和目标私聊消费均使用该scope及各自canonical subject；支持多个bot的同一服务须显式覆盖这些subject。Source allowlist覆盖source canonical/bare及target现有全部绑定。普通已验证QQ owner可访问其对应OneBot；official身份不能通过输入QQ号推断。新接口只收canonical身份，码hash-only/10min TTL/60s申请间隔，绑定/所属credential/code消费同一SQL COMMIT。申请一次请求，消费同码/target重试不重放后来解绑或选择。Native和center使用同一源码实现；须先由Viewer schema准备 `taiko_qq_migration_codes`，再在完整Phase 6门禁通过后激活R私有CLI。中心private task45s独立期限、parent50s/1500ms grace；64KiB输入/256KiB输出/8KiB stderr。详细证据见[QQ客户端中心验证](evidence/phase6-client-qq-migration-validation.json)。本次仍未登记生产grant或部署。
L37: 
L38: `GET/POST /api/taiko/proxy/bind` 与 `POST /api/taiko/proxy/bind/current` 现在要求有效 Cookie/token。普通凭据须有当前已验证、active 的 Viewer QQ 绑定，与裸 QQ 或 `onebot_v11:QQ` 精确匹配；添加外部账号另须完整自有、同平台 Viewer binding，manual 通过既有创建/认领入口。服务凭据同时证明 exact grant/revision/expiry/principals/sources/scope，选中服务授权后不降级为 owner 授权。
L39: 
L40: QQ metadata 只触及 SQL，不读写 C/H，也不在 SQL 事务后申请 Source 锁。共用 2 active/8 queued/30s admission，以 63 字符 SHA 身份名的 MySQL GET_LOCK 串行化，等待上限 5 秒。account→credential→principal grant/目标 owner binding→bind rows→selection state→最小 receipt，完整返回前再次证明；每身份最多 128 绑定，slot 小于一百万，旧 healthy visibility/manual/u0 DTO 保留。GET 只读，旧缺失 current 在内存中选择首项，不保存修正。失败回滚，rollback 或 RELEASE_LOCK 无法证明时销毁连接。
L41: 
L42: 两种 mutation 接受可选 `requestId`（32 位小写 hex 或小写 UUID）；省略时服务生成。持久回执仅保存操作/actor/grant/principal/action/intent/outcome 哈希及时间，无原始 Cookie/token/完整 DTO。相同凭据、完整 grant 和意图重试只返回当前 DTO，不重复变更、覆盖后来 selection；相同 ID 不同意图 409。COMMIT ACK 不明时，捕获 pool 的新连接必须证明 exact 回执和当前 outcome，不能把未提交当成功。
```

### 原文第 48–58 行
```text
L48: `POST /api/taiko/proxy/hiroba/bind` 保留邮箱、密码、可选 `targetTaikoNo`、`configuredByQq`，增加可选 `requestId`。普通凭据只授权预先存在的完整自有 Hiroba bindings；服务需明确 `hiroba_bind`、Source 与 principals。发现的全部目标卡片、可选 QQ 的全部已有成员及写入目标都须被授权，QQ 字段、密码或上游登录成功不能代替该证明。卡片顺序与目标过滤沿用原 playable-card helper；没有匹配卡片仍返回原空结果，不创建 binding。原 helper 的发现范围不在此改为实际所有官方卡片的额外查询。
L49: 
L50: Viewer 首次 actor SQL 前捕获 pool、root/cwd 和 worker key 环境。native worker 只发现可玩卡片、兼容加解密或计算 keyed HMAC 意图，不连接 SQL、不写凭据/token/成绩文件。密码仅经 HTTP body 与私有 stdin；旧无授权 Hiroba adapter 返回 410，旧 password argv 路径已退出。SQL 按 account→credential→Source/principal grant→credential/bind rows→selection→receipt 顺序，在一个事务内保存全部卡片凭据、可选 QQ metadata、current state 和最小回执；receipt INSERT 后再次完整复核才 COMMIT。credential-only 不保存 QQ metadata。`configured_by_qq` 列扩为191，覆盖合法官方身份长度。
L51: 
L52: 凭据绑定与其他私有 worker 共用单进程 2 active/8 queued/30s admission；operation nonce 的 GET_LOCK 等待5s，非空 QQ 结果另用原 principal gate。stdin32KiB/stdout16KiB/stderr8KiB，fingerprint/decode30s、discovery180s；native SIGALRM 独立生效，parent TERM后1.5s KILL并等待close。客户端 bind timeout300s。回执仅保存 actor/grant、keyed HMAC意图、最多128个有序Source IDs及credential/outcome hash，不保存原密码或完整DTO。已提交的同凭据/授权/意图重试跳过登录和重写，返回当前QQ结果，不覆盖后来selection；不相关自有binding新增不使完成回执失效，已选binding撤销则拒绝。COMMIT ACK不明须在捕获pool的新连接证明exact回执、凭据及当前outcome，未COMMIT不能报成功。rollback/named-lock释放无法证明则销毁连接。这是纯SQL metadata事务，不纳入C/H发布，也不在SQL后申请Source锁。
L53: 
L54: 普通 Cookie/token 可以更新完整自有 binding 对应的平台，Wahlap/Hiroba 不互换，manual 不允许外部 acquisition。中心服务仍须逐项配置 scope 与 Source 范围。private worker 独占 Source EX，再锁定 SQL 凭据与授权，每次成绩发布前及最终 COMMIT 前复核；Node 返回前取得 fresh SH，验证原 produced commit/sequence 与完整授权，不能返回另一代成绩。晚 SQL/transport/撤权失败不自动撤销已经授权提交的成绩；该更新代理未增加跨请求 nonce 重放。
L55: 
L56: 历史返回保留完整 raw full/delta/未知字段与原文件名顺序，累计 32MiB 超限返回 503，不截断。图片 current/history 使用同一 publication view，PNG 上限16MiB，私有目录最多16个暂存文件、1800秒过期清理，响应成功或失败后删除本请求图片。账户同步与更新代理共用单 Viewer 进程2个 active/8个 queued/30秒排队；Wahlap 180秒、Hiroba 900秒执行上限，native worker 有独立 signal deadline。多副本发布前仍需 host admission 审阅。
L57: 
L58: 工具从 SQL 验证 operator 的 **username 与 email 同时匹配现有站点运维身份**，然后按 account→token→grant→audit 锁序提交一次 SQL transaction。token owner 必须存活，active 登记要求 token 有效且未撤销。最小 audit 只保存此次能力配置；不会复制成绩。相同 operationId/配置重试确认已有记录，不会覆盖后续新配置或撤销；相同 operationId 携带不同配置返回 409。丢失 COMMIT ACK 只根据同一捕获 pool 的新连接和 exact audit 确认；未提交不能报成功，rollback 失败销毁连接。
```

### 原文第 74–92 行
```text
L74: ## 验收与后续激活
L75: 
L76: 验证范围包括真实 Cookie 登录与正式 Developer route、实际开发者 quota、实际 `_test` SQL、Source SH、实际私有 CLI、排队/返回期间身份与能力替换、撤销/expiry、exact replay、单 COMMIT、late failure/rollback destroy/ACK loss、完整 JSON 与 canonical corruption。上游网络、完整 Nuxt build、真实跨用户服务注册和生产烟测留在最终激活验收。
L77: 
L78: Viewer 此子步只提交源码与证据，版本沿用 Phase 6 预备 0.82.0；统一标准部署负责构建、push 和服务重启。Wahlap 更新现已退出旧 HTTP dispatcher，Hiroba 同步与凭据发现使用私有stdin；客户端四项成绩、三项QQ绑定与两项Hiroba凭据SDK都已要求有效token。permission-aware bounded cache、native Bot凭据/QQ Writer、全部Writer/Read Model/P1a仍须完成。运行中的R未复制这些预备变更，此子步无需重启NoneBot。
L79: 
L80: 
L81: ## 原生 u0 与启动绑定迁移的激活边界
L82: 
L83: Source9.81.27已准备canonical u0 publication。成员SH按Source排序后取得派生EX，同批发布C/H；读请求拒绝未纳管成员或已存在的未纳管u0。最终切换必须先停止全部旧Source/u0/daily/maintenance Writer，再显式纳管现有成员及u0、核对历史与daily冻结点，最后同步新Source并启动。不得让首次读取覆盖旧u0历史，不得将生产资料复制进测试库。这里记录激活要求，当前没有执行生产纳管/同步/重启。
L84: 
L85: startup不再自动重写bind SQL或taiko_multi_bind.json；绑定所属与QQ联接使用已验证的显式中心事务。旧JSON只保留纯normalization兼容测试，不再作authority Writer。feature-switch迁移、Hiroba表初始化、telemetry、QQ cleanup仍保留。回退运行代码须同时停所有新Writer，不能在线并开旧startup绑定Writer。private Native return proof、daily/maintenance收敛、Read Model/成本和最终产品验收继续Phase6 Gate。
L86: 
L87: 
L88: ## daily Writer 的 Source 与 namespace 锁
L89: 
L90: Source9.81.28将采集、趋势补算和explicit backfill纳入Source SH→daily namespace锁；采集已有Source EX时复用，backup/restore/purge/collection取EX。活动测量写入必须有canonical current/history，legacy或tombstone拒绝新增。P1a纳管和切换前仍要停所有旧daily Writer；同root不能混跑旧namespace-only实现。
L91: 
L92: 显式backfill只处理单一Source，支持--userdata-dir与有界plain-file seed，读取canonical history，保留past frozen值和原origin，不将重算称为实际游玩。操作应通过既定memory wrapper，私有资料留在原授权root，不能复制生产数据到测试库。Source-tagged daily stage仅在Source EX collector中收集；不得删lock inode或另开无锁清理。Read Model必须包含实际daily内容依赖，不能只靠C/H commit判定measurement cache有效。本子步只准备源码/留档，未执行生产补算、纳管、同步或重启。
```

## E11 — 我此前方案的目标偏差和开放式 Phase 6
来源：`Sakura_Taiko_Domain_Extraction_Execution_Plan_v2.md`；文件 SHA-256 `28731a20f4fa676727be4d433ec66f1b3eac8c3975ceedb22ebc925ae262e0d5`。

### 原文第 369–411 行
```text
L369: # Phase 3 --- Sakura_bot Extraction
L370: 
L371: ## Goal
L372: 
L373: Sakura_bot 不再拥有太鼓领域实现。
L374: 
L375: Before:
L376: 
L377:     Sakura_bot
L378: 
L379:     plugins/taiko
L380:         rating
L381:         score
L382:         parser
L383:         command
L384: 
L385: After:
L386: 
L387:     Sakura_bot
L388: 
L389:     adapter/
L390:         taiko_adapter
L391: 
L392: ------------------------------------------------------------------------
L393: 
L394: ## Keep
L395: 
L396: 保留：
L397: 
L398: -   command
L399: -   permission
L400: -   message formatting
L401: 
L402: ------------------------------------------------------------------------
L403: 
L404: ## Remove
L405: 
L406: 移除：
L407: 
L408: -   rating formula
L409: -   score parser
L410: -   chart model
L411: -   difficulty calculation
```

### 原文第 425–444 行
```text
L425: # Phase 4 --- taiko-bot Alignment
L426: 
L427: ## Goal
L428: 
L429: 消除第二套实现。
L430: 
L431: 检查：
L432: 
L433: -   rating
L434: -   dimension
L435: -   parser
L436: -   score model
L437: 
L438: 替换：
L439: 
L440:     local implementation
L441: 
L442: 为：
L443: 
L444:     Taiko Domain Client
```

### 原文第 486–503 行
```text
L486: # Phase 6 --- Storage and Writer Consolidation
L487: 
L488: 最后处理：
L489: 
L490: -   Writer ownership
L491: -   P1a
L492: -   Read Model
L493: -   Database
L494: 
L495: 原因：
L496: 
L497: 必须先明确：
L498: 
L499:     谁定义数据
L500: 
L501: 再决定：
L502: 
L503:     数据存在哪里
```

### 原文第 545–557 行
```text
L545: # Rollback Strategy
L546: 
L547: 每阶段：
L548: 
L549: 保留：
L550: 
L551: -   old implementation
L552: -   adapter layer
L553: -   compatibility tests
L554: 
L555: 禁止：
L556: 
L557: 一次删除旧逻辑。
```

## E12 — 最新 JSON 状态（选定字段原值）
来源：`evidence/phase6-daily-writer-validation.json`。下列仅提取字段，没有重新解释结果。
```json
{
  "step": "6.3e.8.6j",
  "date": "2026-10-12",
  "status": "DAILY_WRITER_FENCE_PASS",
  "phase6Gate": "IN_PROGRESS",
  "goalStatus": "active",
  "source": {
    "version": "9.81.28",
    "commit": "cc66b2207a725489987787bb8d5f785f61c3a352",
    "parent": "d4a9d22cbb0d9cf7e14116f487909aff9034d023",
    "pushed": true,
    "actualRemoteMainVerified": true,
    "filesSha256": {
      "taiko/plugins/utils/daily_ability.py": "9c0a4ef231259a30cef93a43098f738e672cb63c45654066aef29f57d30ca4c4",
      "taiko/plugins/utils/score_calculator.py": "3c9e55aef75d2ea5acee2a55c93c265dc7afede31c543b7e1bb44cd1667e0a9d",
      "taiko/plugins/utils/userdata_storage.py": "f0c2334f4e64aa6ce544092dac1176665bc6aab4cedd1a98b5efa12c3a23419f",
      "taiko/scripts/backfill_daily_ability.py": "c8d10c4a401b37105fa674fbbb3bdfb3c99f77350843bc1e185295d3d17e8005",
      "taiko/taiko_store/README.md": "0e6923ef9cae02ee358c8454881901f6e278013a34996df07eaeeb5c876df477",
      "taiko/taiko_store/backup.py": "c3788c2182bba553c39d367bce616aad80abb9f5ca671e8e5cf8a11b4d88028f",
      "taiko/taiko_store/publication.py": "bd402a38fbc9916e52a2e274180406dcfc2ff0c0a0155b828391b4921d775f3f",
      "taiko/taiko_store/daily.py": "9409a2b508ff1c5823b09ffc02e16b0003e6445e878c782bdc8204389ab97f2a",
      "taiko/tests/test_daily_ability.py": "cf29192941b0d92770a5eb325a3cbdcb5e6ff6daf3ff80cb844afe715b82a912",
      "taiko/tests/test_playtrend.py": "a0ab7c89e48f89a1fc8f3b4e4f8bfac04aa6ce61e10f3cdbe7930d2e4878a31b",
      "taiko/tests/test_publication_history.py": "25eb77baa2afdf5e4515085aa2efde1bd4e483bffc5d5c58af3c8a8cbd66ce6d",
      "taiko/tests/test_daily_publication.py": "5d2a2c85f6c2afbdcf815f501e06fb99dcd203c0ebe269d050f1953e3d53c879"
    }
  },
  "viewer": {
    "preparedVersion": "0.82.0",
    "liveVersion": "0.81.11",
    "parentCommit": "f33fbe34658e1bcf19baa4b79203456def8641fe",
    "standardReleasePending": true,
    "manualPush": false
  },
  "limitations": [
    "Not all Writer activation or native private return-proof completion.",
    "No production adoption, real upstream, complete NoneBot boot, PNG or authenticated online acceptance.",
    "No million-record cold/warm cost or full-size acceptance; existing ceilings require remaining reconciliation.",
    "Daily archives remain independently atomic and must be included by exact content in Read Model dependencies."
  ],
  "remaining": [
    "Native private return proof and final writer coverage audit",
    "P1a explicit canonical adoption after all old Writers stop",
    "Rebuildable Read Model with exact Source/daily/catalog/goal/measurement dependencies and invalidation",
    "Limit reconciliation/million-record cold/warm IO/RSS",
    "Trusted operations/recovery and fixed runtime dependencies",
    "Standard Viewer deployment/coordinated runtime activation/explicit production grants/real product acceptance"
  ]
}
```
