# Sakura Taiko — P0 Production Recovery Sprint

> **执行级 Codex 主控指令 / 2026-10-12 / r1**  
> 适用：Viewer 成长页 502、Bot 段位进度异常、Kinoko 导入后的 `taikotrend` 历史不可见及未来时间污染。  
> **本文件授权的是独立候选准备与隔离验证，不是生产操作授权。**
>
> 当前判定：`P0 INCIDENT OPEN / SOURCE EXTRACTION FROZEN / NO PRODUCTION MUTATION APPROVED`。

---

## 0. 第一条指令与停止边界

你是负责**恢复现有线上产品**的事故修复 Codex，不是 Taiko Domain Extraction 的继续执行者。不得恢复原有长期 Goal，也不得把 P0 修复并入 `feat/taiko-application-extraction-20261012`。

本轮允许完成以下**有限且实质性的产出**：

1. 一份受影响数据的**一致性备份与写入遏制操作方案**，包含需要另行批准的具体动作；在批准前仅做只读预检。
2. 一组基于**生产实际运行源码语义**制作的隔离 Hotfix 候选，覆盖四个修复面：Growth 启动、段位 renderer、趋势读时过滤、Kinoko 导入校验。
3. 与修复内容对应的**真实入口定向验证**及镜像/合成历史回归，附资源账本和源文件差异。
4. 一份**可执行但未执行的受控部署、回滚与数据后续恢复清单**。

结束即停。不得追加 P1a/P1b、Read Model、数据库改造、API 重构、全量 Native 迁出、OAuth、整仓版本同步或性能探索子阶段。

### 绝对禁止（除非用户在本轮之后针对具体动作单独批准）

- 不改动 `/home/sigaer/taiko`（下称 R）的生产业务源码、userdata、history、daily、cache、DB、授权/凭据、运行配置。
- 不修改线上 `.output`；不覆盖运行目录；不 `git reset --hard`、`git clean`、整体 `revert`、`checkout` 覆盖现有 WIP。
- 不重启、停止或 reload 生产服务；不合并/push/main；不 bump 版本；不激活 `0.82.0`、Phase 6 或新 Source/bridge。
- 不重新 Kinoko 导入、backfill、repair、重算生产历史，不删除/改写 2765 年文件，不猜测正确年份。
- 不访问未经授权的他人私有成绩，不导出完整日志、原始账号 ID、Cookie、Developer Token、Hiroba/Wahlap 凭据。
- 不调整资源 guard、增加 QA 并发、不通过 `--no-deps` 安装结果宣称完整可部署。
- 不用“用户打开页面无报错”替代事实验证；GET 也可能产生写入。

若当前迁出工作树正在被其他 Codex 修改，**只读查明冲突并 STOP**；不在同一工作树竞写。所有 Hotfix 只在**新建的隔离工作区**进行。

---

## 1. 事故证据与既有事实（不得重新猜测）

权威输入文件（若服务器上路径可用，先读；不可用则请用户提供，不重新全仓审计）：

- `/var/tmp/taiko-incident-20261012/incident-root-cause.md`
- `/var/tmp/taiko-incident-20261012/incident-timeline.md`
- `/var/tmp/taiko-incident-20261012/recovery-options.md`
- 同目录的 `account-a-metadata.json`、`fixture-evidence.txt`（若存在）
- `/var/tmp/taiko-application-extraction-20261012/C/docs/taiko-application-extraction/release-candidate-lock.json`
- `/var/tmp/taiko-application-extraction-20261012/C/docs/taiko-application-extraction/extraction-validation.md`
- 对应目录的 `AGENTS.md`、memory engineering guidelines、现有 QA runner 文档。

### I-01 — Viewer Growth（`CONFIRMED`）

实际生产 `/api/account/growth/overview` 返回 502；在 `-m growth_compute growth` 的模块装载阶段出错，尚未读取成绩。

```text
R/growth_compute/__main__.py:38
  _load_source('score', 'score_calculator.py')
R/plugins/utils/score_calculator.py:29
  from .taiko_domain_adapter import identity_inputs
ModuleNotFoundError: No module named 'growth_compute.taiko_domain_adapter'
```

**这不是“没有历史数据”。** Viewer 线上构建使用 `createFileScoreReader`，不能用尚未上线的 publication reader 解释故障。源码历史 commit `5b61502` 已有一个 Growth 启动修正候选，但不能直接视为 R 已加载或已经验收。

### I-02 — 段位进度（`LIKELY`，共享 renderer 缺陷 `CONFIRMED`）

`dani_progress.py` 经 `_build_dynamic_user_dimension_profile` 调用已删除的 `score_calculator._get_song_indicator_value`，导致 `AttributeError`。Viewer 同渲染器的 traceback 与合成数据均复现；**Bot 本次原始 traceback 尚未捕获**。对应函数逻辑在已安装 Core 的候选模块中，但签名/语义需要逐项核对，不能仅恢复一个同名 stub。

### I-03 — Kinoko / taikotrend（`CONFIRMED`）

账号 **A** 的 Kinoko history 包含 `2765-01-01` 观察时间。趋势选择“最新点”为时间锚，导致正常 2024–2026 历史被最近 30 天窗口全部排除。受影响范围：

| 对象 | 第一轮已知值 |
|---|---|
| current | 1 文件，约 973,038 B，1,444 条歌曲记录 |
| history | **1,214 文件**，26,294,315 B，19 full / 1,195 non-full |
| Kinoko 命名历史 | 795，其中 `kinoko-history_` 794 |
| daily archive | 3 文件，v1-top20 / v1-top50 / v2-top20 |
| 总计 | 1,218 文件，27,354,878 B |
| 未来污染 | 1 个已证实 2765 年 delta、current 的 4 条 `update_datetime` 及 4 条 `highscore_datetime` 字段、3 个 daily 的未来点 |

原始文件 SHA、metadata 已有，但**尚无一致性备份**。现有历史文件存在，不代表已证明零删除、零覆盖或可恢复至导入前。异常事件的实际业务日期 `UNKNOWN`，**绝对不得修成猜测年份**。

### I-04 — 跨仓库状态

| 项 | 冻结事故材料中的状态（需要差量核验，不当作新实时事实） |
|---|---|
| R | `/home/sigaer/taiko`，与 Sakura Git 工作树不同；生产载入源码与当前仓库 HEAD 不同 |
| Viewer | 生产首页 0.81.11；源码曾准备 0.82.0，未被本事故证明可发布 |
| R Python | `/usr/bin/python3.11`；Core 0.1.1 / Python Contract 0.1.0 元数据 |
| taiko-bot | 有未联合发布的候选，不能用它作生产 Hotfix |
| 源码迁出 | `SOURCE_EXTRACTION_PARTIAL`，A `39c477f`、B `b076ee4`、C `a6f7a10` 是隔离本地提交，不合并 |

**每一条已知结论必须引用对应证据；本轮实测、历史日志、推断三者分别标 `MEASURED` / `HISTORICAL` / `INFERENCE`。**

---

## 2. 执行节奏：四个有边界的工作包

| 工作包 | 动作 | 产物 | 本轮权限 |
|---|---|---|---|
| E0 | 现场版本与范围最小复核；账号 A 写入入口/备份阻断检查 | `00-incident-lock.md`、`01-backup-and-isolation-plan.md` | 只读，可立即做 |
| E1 | 基于 R 精确行为的独立 Hotfix | 隔离补丁/提交及 `02-hotfix-change-map.md` | 仅隔离源码与 fixture |
| E2 | 真实执行入口回归 + 合成历史污染测试 | `03-targeted-validation.md`、日志、资源报告 | 仅隔离环境 |
| E3 | 发布、回滚、认证烟测、数据恢复**操作方案** | `04-release-and-recovery-gates.md` | 仅文档，不执行 |

以上全部完成后**必须停止**，输出 `P0_HOTFIX_CANDIDATE_READY` 或 `P0_HOTFIX_CANDIDATE_BLOCKED`。不得自动执行生产发布。

---

## 3. E0 — 现场保护、版本核对和一致性备份门槛

### 3.1 差量复核（只读）

1. 记录 R、S（`/home/sigaer/git/Sakura_bot/taiko`）、Viewer 的当前进程 `PID/cwd/exe/start`，所需文件 SHA，以及已知服务/定时任务清单；不 dump 全部环境变量。
2. 仅比较 I-01/I-02/I-03 相关已确认文件及 import/worker 调用链，不重新扫描 699 文件。
3. 记录 `git status`（含已有 Native WIP）、source HEAD、当前 R SHA 和 `.output` manifest；不假定 Python 内存 `sys.modules` 等于磁盘源码。
4. 针对账号 A：只读核对文件数量、size、路径顺序、mtime 与 SHA 的差量；不复制完整私有内容到日志。不启动会读写 daily 的趋势命令。
5. 确认是否有其他同步、Kinoko 导入、trend/daily 计算、维护/补算入口仍对 A 可写。**若无法有把握定位全部 Writer，备份 Gate 标为 `BLOCKED_WRITER_FENCE`。**

### 3.2 建立可审批的备份/写入隔离方案

提出两种可选路径，由用户选择并单独授权：

- **优先：已有文件系统的一致性只读快照。** 证明快照覆盖 A 的 current、history、daily、文件依赖/标记，且快照建立本身的副作用与资源预算已获批准；随后从快照复制到受限备份目录。
- **替代：账号 A 的短时、可恢复写入围栏。** 精确覆盖 Kinoko score/history/current、关联同步、trend 的 daily 持久化与其他可能改写 A 的任务；记录生效确认、超时、撤销方式，再进行流式复制/校验。没有真实 account-level fence 时不能凭“暂时没人操作”宣称一致性，必须申请**限定维护窗口**或停止。

**不允许未经用户批准直接停全站、重启服务、`chmod` 生产目录、删除锁文件，或通过任意业务 GET/工具函数触发读时写入。**

备份预检必须包含：

- 目标明细：1 current + 1,214 history + 3 daily，及确认必要的清单/映射；额外文件需解释归属；必要 DB 关联仅记录元数据和是否需要单独授权转储。
- 源/目的目录必须独立、权限最小（目录建议 `0700`、文件 `0600`）；路径由现场确认而非硬编码账户 ID。用户私有备份不进 Git、聊天、外部对象存储或临时公开目录。
- 预计原始体量约 27.35 MB，另评估文件系统剩余空间、元数据与至少一份额外恢复副本空间；禁止覆盖旧备份。
- 使用固定源文件清单、受控期间的逐文件流式 SHA256、目标副本 SHA 和总件数核对，拒绝 symlink/path traversal；写入备份完成标记应最后原子发布。
- 读取旧 `account-a-metadata.json` 作前后证据对照。哈希一致也只能证明**备份所包含的观察时点**，不能证明导入前没有丢失。
- 记载 fence 开始与结束、监控成功/失败和可能未纳入的 writer；若存在变更/覆盖/文件数不一致，标 `BACKUP_INCONSISTENT` 并停止，不宣称安全恢复条件满足。

**E0 到此只是方案，不执行生产备份/围栏。** 待用户明确批准账号、范围、方法和必要的服务影响后，另一个受控生产操作才可执行 E0.2。

### 3.3 数据扩散检查

只读、有限范围，检查受影响 A 的新文件是否再次出现 `observed_at/capturedAt/update_datetime/highscore_datetime > 合理未来上限`。如新增，立即报告 `ACTIVE_CONTAMINATION_SUSPECTED` 并提出账号级隔离审批；不能因单次检查无新增便标为彻底安全。

未批准扫描所有用户前，绝不运行全站读取用户目录的扫描器。跨账号影响范围标 `UNKNOWN`。

---

## 4. E1 — 隔离 Hotfix：四个具体修复面

隔离实现来源以**当前 R 实际需要修复的调用入口**为 oracle，在独立目录建立最小的可复跑环境。已存在于 S 的后续提交（如 `5b61502`）可作为参考，但须核对签名、依赖以及是否暗含未发布的 Source/DB 新架构。禁止直接将 S main 或 0.82.0 全量同步进 R。

### H1 — Growth 模块装载

**故障：** `-m growth_compute` 入口把 `score_calculator.py` 当成 `growth_compute.score`，导致相对 `.taiko_domain_adapter` 指错包。

**要求：**

1. 为真正的 `plugins.utils.score_calculator` 建立正确 package 上下文，或使用等价且可维护的显式依赖装配；保持 `__package__`、模块复用与既有公共接口语义，避免重复加载两份 score calculator。
2. 审查 `plugins.utils.__init__` 等 import 副作用；不为了修复相对导入而隐式启动 NoneBot、SQL、网络或生产 Writer。
3. 不使用 `sys.path` 的不受限全局插入、未验证的 monkeypatch、复制 `taiko_domain_adapter.py` 到 Growth 包内作为长期修复。
4. 不修改 Rating/六维公式、数值版本、TopN、current/history 的来源规则，不添加第二次 Python/历史回放。
5. 尽量复用已有已提交修复，避免另造新实现；需要实际 R 布局下的模块/CLI 证明。

**必须通过：**

- 与 R 相同的 `/usr/bin/python3`、已固定 Core 0.1.1 / Contract 0.1.0，在**无生产 userdata、无生产数据库**环境下运行 `python -m growth_compute --help` 成功。
- 已有合成 Growth CLI：有数据、空数据、损坏/缺文件、断授权路径，输出符合原 DTO；不把合法空态变成 502。
- 启动/退出时没有 DB 初始化、网络访问、daily 生产写入；进程数与成本相较对应基线无额外计算。

### H2 — 段位进度函数兼容

**故障：** `dani_progress.py` 调用已移除的 `_get_song_indicator_value`。

**要求：**

1. 在 `score_calculator` 的**兼容委托**与 `dani_progress` 的**明确 Core API 改造**之间选择**一种主实现**。如使用私有 Core 函数，必须核实版本、签名、返回量纲、缺失/非有限值、重复曲组、可用性和可见性语义；不能仅靠名字相同。
2. 搜索该旧符号的其他直接消费者（限定已知范围，不全仓算法重写），报告匹配结果。
3. 变更不得导致 Bot 与 Viewer 图片调用出现不同公式、显示排序、候选歌曲集合或权限回退。
4. 不直接替换整个 `score_calculator.py`、`dani_progress.py` 为未来迁出候选的不同版本。

**必须通过：**

- 用已有公开 2025 六段曲库和合成 80 条成绩，走 `render_dani_progress_image_bytes()` 真入口，能成功生成有效 PNG；与冻结旧语义可比较的数值/关键事实一致。
- 合成 `rated results < 10` 的降级分支没有错误；非法/不支持段位进入既有明确错误路径。
- 既有 Viewer 共用 renderer 路径也通过；Bot 事件级结果需在后续**经批准的线上 smoke** 验证，未取到真实 Bot traceback 前仍应保留证据局限。

### H3 — taikotrend 读取异常未来记录时仍显示正常历史

**故障：** `_limit_trend_points_to_recent_days` 及历史/daily 构建使用“最后一个点”作时间锚，2765 年挤掉合法历史。

**要求：**

1. 使用明确的**查询基准时钟**（Asia/Shanghai 业务时间、可注入固定 `now`）决定最近 30/90/365 天窗口，禁止让任何已存未来观察成为锚。
2. 在构建/回放选择窗口之前处理异常未来 snapshot；在最终过滤之前再次检查**已存在的 daily archive**。**两个入口都要防护**，否则旧存档仍会把历史挤出。
3. 对时间异常的 delta，只将其作为**不可用于时间轴的污染证据**隔离；不得把数值变成 0、随意变更业务日期、对原始 current/history 做更改，亦不能将可追溯的实际成绩虚构成当天游玩。
4. 如果被隔离的数据仍可影响后续回放状态、当前 bestScores 或每日存档写入，必须明确设计纯读投影处理：既要防止 2765 被存入新 daily，也不能丢弃其它合法历史基线。无法证明时标 `H3 BLOCKED`，不得先发一个只过滤 UI 的表面修复。
5. 现有合法过去事件、时区边界、同日多条、未变化点、`-a`、v1/v2 和 TopN 的原规则保留；异常检测与当前时钟允许偏差是新 Policy，须在报告中固定具体阈值并论证其避免误判的理由，不得从异常样本直接推测日期。
6. **生产既有 daily archive 只读，不覆盖。** 隔离测试用临时归档目录测读时行为。若原 CLI 在读时必定写 daily，生产 smoke 必须另获授权并记录预期写集。

**必须通过：**

- 冻结合成 `2024–2026 正常 full/delta + 2765 delta`，默认 v2 30 天输出正常有效历史点，且不输出 2765。
- 正常数据 30/90/365 的时间窗口与历史基线一致；未来数据出现于 latest snapshot、首条、current timestamp、archive（含已经污染文件）、多个 TopN 组合时均不过滤错合法点。
- 只有异常节点时清晰显示资料不足而非伪造 0 或产生巨大时间范围；旧文件 SHA 在测试前后不变；反复请求幂等且不扩大污染。
- 生成合成渲染 PNG 成功，未查询生产账号或真正重新导入。

### H4 — Kinoko 导入前置日期校验

**故障：** `normalizeTimestamp` 只判断日期可被 JS Date 往返解析，接受 2765；`sanitizeKinokoSong` 保留这个值；合并 current 还可按字符串时间排序使它取得优先权。

**目标文件（现场核对真实路径）：**

- Viewer `server/internal/account/kinoko-history.ts`
- Viewer `server/internal/account/kinoko-import.ts`
- 涉及的 `normalizeTimestamp`、`sanitizeKinokoSong`、`mergeKinokoScores` 及历史 `writeKinokoHistorySnapshots` 调用边界。

**要求：**

1. 同一套可测试的**日期准入规则**应用于 Kinoko history、score current、full baseline、delta 及成绩字段；禁止只过滤 history 而让 current 继续携带 2765。
2. 以服务器可信当前日期和明确允许的上游时钟偏差为基准，拒绝/隔离异常未来值；不能以字符串大小或 JS Date 合法性替代语义校验。不得任意设置一个“最早年份”破坏合法旧历史。
3. **在第一个生产写入副作用之前，对整个导入计划预检**。任何致命异常默认 `reject whole request` 或明确可验证的安全隔离响应，禁止半批次留下 current 变化/新 history 文件；不能保证时如实列出原路径的事务限制并 STOP，不伪称原子。
4. 合法旧时间、跨年、闰日、时区、空字段、毫秒/微秒、同秒多个谱面、重复导入指纹、非法 epoch、非有限数值分别有固定测试。
5. 对客户端返回可理解的输入错误，不包含私密源负载、Token 或完整原始 JSON；防止过多重试触发另一轮大规模写入。
6. 不自动“修正”或覆盖已有账号 A 记录，不新增数据库表、读取模型或导入格式升级。

**必须通过：**

- 含 2765 的 history/score 导入在任何文件或 DB mutation 之前被拒绝；执行前/后文件清单、字节 hash、manifest 与 receipt 均不变。
- 同份 batch 中一条非法、其余合法，也不出现部分 current/history 写入；合法 full+delta、重复同 timestamp 与导入去重行为回归。
- 合法导入未改变成绩数值、rank/crown、字段合并与既有授权/绑定隔离。

---

## 5. E2 — 实测矩阵、成本与安全证明

### 5.1 黄金数据集：固定、合成、可复跑

`fixtures/P0-incident/` 最小包括：

| 案例 | 必须证明 |
|---|---|
| `growth-package-context` | 真正模块入口不再缺包，且无生产副作用 |
| `dani-2025-six-dan` | 80 条合成成绩进入个人动态分支，并获得合法图片 |
| `dani-insufficient` | 低样本不误调用已删除路径 |
| `history-normal` | 正常窗口/点值完全不改变 |
| `history-future-delta-2765` | 2765 不能决定最新窗口；完整合法日期能出现 |
| `daily-future-archive` | 即使存档已经污染，显示/派生不继续引入未来值 |
| `kinoko-current-future` | 仅 current 时间污染也能阻断写入 |
| `kinoko-history-future` | full + delta 导入前阻断异常 |
| `kinoko-mixed-batch` | 某条异常导致整批零副作用 |
| `legitimate-old-import` | 合法旧历史不被未来防护误伤 |
| `multi-profile-owner` | 绑定/账号隔离与授权边界不变 |

使用独立 scratch 目录，绝不复用或上传账号 A 的 private raw JSON 当测试夹具；允许使用脱敏元数据形态，值全部重新合成。Goldens 包括 DTO/PNG、返回状态/错误类别、前后文件哈希及 import 次数，而不仅看 `exit code=0`。

### 5.2 测试优先级

1. 先跑四个修复点各自最窄单测 + 真实 CLI/renderer 入口；定向失败必须 STOP 该修复面。
2. 再跑 Growth / History / Daily / dani / Kinoko 的**受影响既有回归**。只对触达代码及依赖做影响分析，不重跑年度报告、论坛或全部 699 路径。
3. 最后小规模合成并发：在 runner 资源门禁内验证 Kinoko 非法请求与同账号查询没有产生新 archive；不得并发打生产环境。
4. 需要运行 SQL 集成测试时，**必须明确 `SELECT DATABASE()` 为 `_test` 数据库且 `TAIKO_ALLOW_TEST_DB_MUTATION=1`，只用 synthetic identity；无此环境则 SQL 部分 `BLOCKED`，不能改连生产。**

### 5.3 性能和资源

- 必须采用现有 `scripts/memory/run_qa.sh` / 已批准 runtime wrapper、串行构建和有效 cgroup；不得独立启动无监控全量压力或重建 1,214 个真实历史。
- 对 H1 检查 Python 进程数量没有增长；对 H3 检查 30/90/365 读取与存档新增写入为 0 或明确不超过原准入；不要把 synthetic benchmark 声称为线上 P95。
- 记录测试固定输入规模、wall、CPU、max RSS/cgroup 实际可用字段、PSI、`memory.events` high/max/oom/oom_kill； `memory.peak` 不可读则标 UNKNOWN，不用 child RSS 冒充 cgroup peak。
- 保持既定 abort 条件和资源上限（含 PSI 高压保护）。任何超限立即停止该子测试并记录 `BLOCKED_RESOURCE_GATE`，不增预算、不优化成无限循环。

### 5.4 安全断言

- auth/owner/binding/token 映射未改；不能为了证明 Growth 能显示而使用 userid-only、匿名或 stale fallback。
- Python loader 不意外导入 NoneBot/DB/网络组件；Renderer 不读取其他账号；存储错误、权限错误与“历史资料不足”必须分离。
- 输出日志仅有脱敏 ID、异常类别、文件基线 hash，不包含个人成绩细节、当前 JSON、Credentials。
- 任何新增模块依赖都在运行包 pin 与环境门禁内；不更换 Core 0.1.1、Client Core 0.1.2 或 Python Contract 0.1.0。

---

## 6. E3 — 生产恢复方案（只能准备，不能自动执行）

### Gate B0 — 数据保护审批

**审批必须列明：** 精确账号 A 的内部身份（仅私有执行端）、哪些 Writer 暂停/隔离、冻结开始时间与最长允许维护窗口、所用锁/快照方案、私人备份路径/权限/保留策略、hash 验证、发生中途写入时的 STOP/恢复动作。

**B0 通过后** 才可以执行一次受控备份。当前审计素材中还未发生这件事，因此标为 `PENDING_APPROVAL`。除非证明了可靠的 snapshot，一律不能把边写边 cp 当一致性备份。

### Gate H0 — Hotfix 代码准入

在 B0 完成且 H1/H2/H3/H4 的隔离验收通过后，锁定：

- 真正拟投放的**目标文件级差异**，逐文件从 R 运行基线对照，不使用未来 Sakura main 的未合并大改。
- 需要调整的 Viewer 代码目标提交 / package / lock / runtime config；如果需要重新构建，则用官方 `run_build.sh → deploy_forum_web.sh`；不得手改 `.output`。
- 用户可见的变化范围（Bugfix）；需要碰到哪个进程、为何需要重启、是否需要短暂中断及回退执行人。
- 备份/原 runtime hash、可回退的构建包和配置记录；回退**仅是已验证的安全代码/配置**，不可恢复旧授权漏洞。

H0 不能凭 `git diff --check`、局部 fixture 或完成 wheel 安装直接 PASS；必须证明同一来源的真实 CLI/renderer 和前后依赖一致。

### Gate D0 — 部署批准（第二次独立人工授权）

只在用户批准修复文件清单、实际受影响服务、时间窗口、回滚方式后，按已有运行维护规范执行。建议顺序（由 Codex 最终按真实依赖图修订）：

1. 已有备份完整且写入保护有效；异常 Kinoko 新输入不能再提交。
2. 先核对 Runtime 构建/文件清单与补丁准确匹配；拒绝安装任何 P1a/Phase6/抽离 wheel 或新 DB/Source 功能。
3. 按控制面依赖先后投放导入防护与只读趋势容错；Growth/段位最小修复相应部署。只重启必须重新加载修复模块的服务；禁止为了方便全栈重启。
4. 逐项小流量授权 smoke；异常则立刻停止后续阶段并按已批准的安全回退流程处理。
5. 经过批准后解除账号级暂停/围栏，监控新增时间异常、失败率和 daily 状态。

**不能用一个“恢复成功”概括三个独立结果。** 上线完成仍必须在报告中分别记录：`GROWTH_RECOVERED`、`DANI_RECOVERED`、`TREND_VISIBLE`、`KINOKO_FUTURE_GUARD_ACTIVE`、`EXISTING_DATA_CONTAMINATION_UNRESOLVED/RESOLVED`。

### Gate S0 — 认证生产验收批准

前提：明确授权一个受控测试账号/现有账号和命令范围、可能的写入副作用，以及具体清理/留存。

| 业务动作 | 观察对象 | 可能副作用 |
|---|---|---|
| Viewer Growth 认证 GET | HTTP、DTO、耗时、Python stderr | measurement/Goal/初始化表；不可当纯 GET |
| Bot 段位进度 | 真正用户发起的有限命令与 PNG | 可能缓存/日志/生成图片 |
| taikotrend | 正常窗口、历史点、无 2765 | 原读取可能新建 daily archive，须控制 |
| Kinoko 非法导入 | 应先在隔离环境执行 | 生产禁止为验证而再次提交 2765 数据 |

生产 smoke 不应主动构造越权请求或对陌生用户测试。保持错误率与隐私告警监控，测试证据脱敏。

### Gate R0 — 已存在异常历史的数据修复（**本轮绝不执行**）

至少确认：

1. 是否有导入前可核验备份、上游原始时间证据；无证据则真实年月日 `UNKNOWN`。
2. 4 条 current 未来字段、一个 2765 delta 与三个 daily 的关系；是否有更多影响；旧合法历史是否有被覆盖。
3. 修复方案只在副本上演练，`before/after` 精确 JSON 字段差异和派生复算的预期写集；不得更动曲目分数、皇冠、Goal 或合法历史。
4. 必须有独立备份、可撤销性、源账号写入 fence 与结果哈希；没有明确来源时间就不回填一个假的日期。
5. 由用户另行授权**明确文件/表、真实日期或隔离政策、运行方式和回滚**。此前仅恢复趋势的视觉可见性，不能升级为 `DATA_RESTORED`。

---

## 7. 必须交付的文件与验收记录

只在事故专用隔离工作区交付：

```text
p0-production-recovery/
  00-incident-lock.md
  01-backup-and-isolation-plan.md
  02-hotfix-change-map.md
  03-targeted-validation.md
  04-release-and-recovery-gates.md
  05-open-risks-and-decisions.md
  evidence/
    environment-manifest.json
    tests-summary.json
    resources-summary.json
    git-diff-stat.txt
    source-hashes.json
```

- 如有补丁，分别列修复文件、真正修改的函数、原因、反向依赖、旧/新行为和对应 regression fixture。
- 四个修复面每项有 `PASS / BLOCKED / UNKNOWN`，严禁综合某项成功冲抵另一项失败。
- 形成可审查的隔离 Git commit 或 patch 文件，**只在隔离分支，不 push、不部署**；不得夹带旧抽离提交及他人 WIP。
- 输出完整版本/部署组合：R 磁盘、实际 Python 路径、Viewer build、S repo、Core/Contract、候选 Hotfix；无法证明 loaded modules 的字段标 UNKNOWN。
- 备份若未获授权，`BACKUP_NOT_EXECUTED`，不要写成“已完成”。
- 尾项不允许写“其余所有 Writer/更多端到端测试/下一次检查”，只能列**与本事故四个修复面直接有关且有文件/测试名字的有限阻断**。

### 最终回复的固定格式

```text
SAKURA TAIKO P0 INCIDENT — HOTFIX CANDIDATE

Runtime incident state: OPEN / CONTAINED / UNKNOWN
Data backup: PENDING_APPROVAL / COMPLETE_VERIFIED / BLOCKED
H1 Growth module import: PASS / BLOCKED / UNKNOWN
H2 Dani renderer: PASS / BLOCKED / UNKNOWN
H3 Trend future-window: PASS / BLOCKED / UNKNOWN
H4 Kinoko ingest future guard: PASS / BLOCKED / UNKNOWN
Isolation tests/resources: PASS / BLOCKED / UNKNOWN
Production deployment: NOT_AUTHORIZED / AUTHORIZED_SEPARATELY
Existing 2765 contamination: PRESENT / CLEANED_WITH_APPROVAL / UNKNOWN
Extraction candidate: FROZEN; no changes

Decision:
P0_HOTFIX_CANDIDATE_READY
or
P0_HOTFIX_CANDIDATE_BLOCKED

Artifacts: <absolute paths>
Explicit approvals required next: <precise actions>
```

**再次强调：`P0_HOTFIX_CANDIDATE_READY` 只代表隔离修复准备好，并不代表生产恢复，亦不授权上线。**

---

## 8. Codex 开工消息（独立对话首条）

你现在接管 Sakura Taiko 的三个已定位 P0 生产故障。请完整阅读本文件及 §1 引用的原始事故报告和适用 `AGENTS.md`。

请按 E0→E1→E2→E3 交付**一次完整的、有限的 Hotfix 候选及恢复运行手册**，不得拆成无限个后续阶段。只读复核和隔离代码/fixture 开发可执行；生产写入隔离、一致性备份、数据库、重启、部署、认证 GET/taikotrend smoke、current/history/daily 更改均需要另外明确批准，遇到相关步骤应停止并报告审批内容。不得触碰正在执行的 Domain Extraction 隔离工作树，不得把其源码合并进本次修复。

**先证明能在本次事故的真实运行架构上修复，再讨论正式发布。** 若无法建立账户 A 的可靠备份/写入围栏，继续完成不接触生产数据的 Hotfix 候选，但将所有生产投放和污染修复列为 BLOCKED；最终提交上述有限产物后停止。
