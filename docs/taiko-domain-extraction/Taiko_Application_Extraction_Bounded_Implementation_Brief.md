# 太鼓应用域迁出：有限施工指令

> 用途：在三份候选收口文件之后，交给新的 Codex 对话执行。
> 本文件是下一轮实施建议；只有用户明确交付并授权执行本指令后，才允许下面的隔离源码修改。
> 目标是交付真实的迁出候选，不是重做架构审计，也不是继续完成旧 Phase 6 全部尾项。
> 生产保持现状。源码迁出验收、联合运行验收和原 Gate 6 是三个不同结论。

## 1. 输入与已知边界

先读适用的 AGENTS.md，以及：

- `candidate-state.json`
- `remaining-scope.md`
- `goal-gap-and-release-matrix.md`
- 既有 handoff、ownership inventory、Phase 3/4/5/6 证据，仅按需要读取。

上述三文件的状态为 `CANDIDATE_CONTAINED / EXTRACTION_TARGET_NOT_YET_MET`。
它们记录的是 2026-10-12 的采样，不是永久锁，不证明目前所有生产进程加载的源码版本。

| 缩写 | 报告中的实际路径 | 记录的源码基线 / 用途 |
| --- | --- | --- |
| A | `/home/sigaer/git/Sakura_bot` | `cc66b2207a725489987787bb8d5f785f61c3a352` + 明确列出的 Taiko WIP |
| B | `/home/sigaer/taiko-bot` | `fa0983dcc56ca109555a33d90aac0fecca6bdf0d`，分布式候选 0.2.7 |
| C | `/home/sigaer/taiko/taiko-forum` | `56aa05a6eecfbd163bc4cb2b985dfa66ab7ea696`，Viewer 源码候选 0.82.0 |
| V | `C/taiko_viewer` | Viewer 工作目录，不另算源码仓库 |
| K | `/home/sigaer/git/sakura-taiko-core` | `0b7319d94b041daafb0a0d32e3ccc95e50da8810`，Core 0.1.2 |
| R | `/home/sigaer/taiko` | 无自己的 Git 标记的运行目录；不是 A HEAD 的同义词 |
| Contract | `C/packages/sakura-taiko-contract` | Python 0.1.0 / JS 0.1.1；本轮不改归属或统一版本 |

报告实测 Viewer 首页为 0.81.11；C 相对本地 origin/main 领先 39 个提交，不代表实时远端已经核验。
中心 Core 固定 0.1.1，客户端固定 0.1.2。不要仅为版本号一致升级或回退它们。

## 2. 本轮唯一主要结果

交付一组可审阅的隔离分支和本地候选制品，使：

1. Sakura 的太鼓专用应用源码、命令、渲染、采集/存储及维护资产有真实迁出结果。
2. 原生/中心部署与分布式部署由 B 中的同一太鼓应用实现维护；必要 provider、授权和兼容策略显式区分，不再复制整个应用目录。
3. K 中已有纯规则保持复用；Viewer 产品逻辑和现有 Contract 不重写。
4. 在不可访问 Sakura 源码 checkout 的隔离环境中，可以安装并验证此次迁入的实际入口与代表调用链。
5. 不部署、不激活 Phase 6、不改生产数据、不宣称原迁移总目标或 1.0 已经完成。

同一实现不等于同一权限：分布式机器人不能因为与中心共享代码就获得上游凭据、中心 SQL 或任意用户数据。

## 3. 授权边界

允许：创建隔离 worktree/分支、按明确清单迁移和修改源码、局部包构建、定向测试、本地提交、生成迁出/删除配对 diff。

禁止：

- 在原 A/B/C 的 main 工作区直接搬迁或删除文件；覆盖用户已有 WIP。
- push、合并 main、创建远端 release、公开发布包、同步 R、运行标准生产部署脚本、重启生产服务。
- 修改生产 schema、授权、Token、userdata、history、daily、u0、服务配置或凭据。
- blanket reset/revert/clean/stash，自动清理缺失 worktree，批量终止未知 Codex 或业务进程。
- 新 Read Model、全量 SQL 化、第四个领域核心、OAuth、新的权限产品、重新设计全部 Writer。
- 仅为收口恢复 userid-only 授权、stale 私有缓存、匿名回退、密码 argv 或旧不安全入口。
- 修改 Rating/六维/推荐公式、旧 measurement、Passport 语义及 canonical facts。

现有数据库测试授权必须与实际工作目录规则一致；没有明确测试库授权时不得连接数据库。
允许的 mutating QA 仍须验证实际库名以 `_test` 结尾及既有显式 opt-in，不能用生产凭据改连另一数据库来冒充隔离。

## 4. 不把全部 MUST_FINISH 变成一个新 Goal

`remaining-scope.md` 的 M0–M8 是总剩余登记表，不是本轮必须全部执行的连续任务。

| 工作包 | 本轮处理 |
| --- | --- |
| M0 | 必做：一次差量核对、保护 WIP、明确候选输入 |
| M2/M3 | 主施工：文件与混合符号归属迁出、宿主路径解耦、两部署模式共用实现 |
| M1 | 保留安全 WIP；迁入入口实际依赖时执行已有定向验证，不扩成全部 Native 安全重构 |
| M5 | 完成本地分发包与普通部署模式的隔离安装；外部渠道上线和真实 service grant 属发布验证 |
| M4 | 只做迁出引起的路径/装载/接口安装差量；候选 Source 的完整 schema 联调仍单列 |
| M6 | 新 Source 协议采用前的硬验证；不因源码搬迁而强制先完成所有协议压力测试 |
| M7/M8 | 后续联合运行和生产切换准入，本轮不执行 |
| P1/PARKED/DEFER | 不启动；只保留关联关系 |

若某项迁出确实依赖 M1/M4/M6 的安全结果，必须指出精确调用链和原因。
不得笼统写“平台尚不完整，所以先把 Phase 6 全做完”。
源码位置改变不证明协议可用；反过来，未启用协议的完整压力验证也不应自动阻止形成可审阅的迁出分支。

## 5. 固定输入与工作区隔离

1. 一次核验路径、HEAD、index、相关文件 hash，并比对三份报告。
2. 仅对重叠且会被本轮修改的并发差量暂停处理；无关 miku、web.conf、文档 WIP 不纳入提交。
3. 使用固定 HEAD 创建隔离工作树，不在运行目录 R 上建立迁移分支。
4. 17 个 Native WIP 逐项核验。A 为 13 个 tracked 修改 + 3 个 untracked 文件，C 为 1 个 untracked SQL 测试。
5. WIP 作为带来源 hash 的明确 overlay 保存；不得自动丢弃，也不得凭历史 408 tests 结果认定新 SQL child/parent 已通过。
6. `status.md` 删除保持原工作区状态；使用已有 handoff 副本和固定 Git blob作历史输入。不要恢复原文件或追查删除者来延长任务。
7. 两个中文文件名的 MISSING 含 Git 转义表现，须先用正确处理中文、空格和转义的路径枚举核实，不能直接算成丢失文件。

输出一份简短 `execution-lock.json`，固定相关 HEAD、overlay hash、工作树路径、版本 pin、已排除用户改动。
后续自身预期提交不算意外漂移；相关外部冲突才触发局部停工。

## 6. 实际迁出清单与落点

复用 JSON 的 `ownership_manifest`，不要重新扫描全生态建立第二本 inventory。

| 来源 | 数量 / 范围 | 默认迁出方向 |
| --- | --- | --- |
| A `taiko/` | 473 个 tracked 路径 + 3 个 Native 未跟踪候选 | B 拥有应用、命令、渲染、服务、存储、脚本、测试、公开资源；纯计算继续 K |
| A `taiko_backend/` | 31 个 tracked 路径 | C 中独立的既有后端组件归属，不与 Nuxt/API 重写合并 |
| A `taiko_manager/` | 195 个 tracked 路径 | C 中独立的管理前端组件归属，不重写 UI |
| A 目录外太鼓 handler | matrix 列出的五个混合/专用路径 | 太鼓专用部分迁至 B/C，通用 miku 功能保留 |
| A 根级宿主依赖 | 已列四类通用宿主依赖 | 使用明确的包/接口边界，不能保留 Sakura checkout 绝对路径或 sys.path 注入 |

699 是 tracked 路径数，不是 699 个业务模块；每个路径都必须有处置，但不要求每个文件逐一重写。
B/C 内部具体目录仅允许为这些已知组件确定落点，不再创建新业务系统。

`extraction-map.json` 每条记录至少包括：sourceRepo、sourceCommit、sourcePath、sourceHash、overlayHash（如有）、disposition、targetRepo、targetPath、targetHash、reason、validation。

允许的 disposition：
- MOVE：字节保持或只有明确路径适配。
- MERGE_SINGLE_IMPLEMENTATION：与 B 已有实现合并，并列出被移除的重复代码。
- RETAIN_GENERIC：有符号级证据表明为通用代码，不得用此标签保留太鼓 adapter。
- EXTERNAL_CONFIG：部署数据/凭据不入包，代码改读明确外部配置。
- BLOCKED_CONTENT_OR_OWNERSHIP：内容、许可或归属无法判定，保留原样并阻断该项删除。
- RETIRE：仅对已有明确停用授权的组件使用；未见进程不等于可以删除。

## 7. 不把“迁出”做成两套新目录

B 中不允许长期形成 `official_copy/` 与 `distributed_copy/` 两套命令、渲染和业务实现。

迁入时优先形成：共同命令/用例/渲染 + 中心 Source provider + 远程 Developer API provider。
这描述本轮目标边界，不预设现有文件已经如此组织。

对旧 B 同名功能：逐项决定复用、合并或委托；必须在配对 diff 中删除或停用被替代的活动实现。
兼容旧 import 的临时转发仅允许放在独立 Taiko 仓，不能在 A 留下 Taiko 专用适配器作为完成状态。

保留 center/client 既有公式 profile 和批准的权限差异；列明功能差异是必要部署差异、既有兼容差异还是待修漂移。
D1 可以延期改变公式，但不能延期暴露差异，也不能把未统一行为写成“完全对齐”。

## 8. 混合入口与通用宿主

必须处理：
- `miku_bot/sekai/upload/taiko_login.py`
- `miku_bot/sekai/upload/server.py` 中 `/uploadTaikoLogin`
- `miku_bot/runtime_init.py`
- `miku_bot/plugins/self_service.py`
- `miku-self/self_func/self_test_runtime/user_commands.py`

后三类按符号拆分，不整体搬走 miku 功能。先排除同文件中用户的无关 WIP，再生成本轮 diff。
外部路由映射可在部署计划中保留兼容，但太鼓凭据写入 handler 的实现不能继续由 Sakura 维护。

`feature_handler_bootstrap.py`、`feature_handler/`、`runtime_memory/`、`nonebot_plugin_method_calls/`：
只解耦迁入组件实际依赖的接口。已有通用包则固定版本使用；没有明确包边界时，将缺口限定到具体符号，不进行整个 Sakura 框架重写。
最终独立环境不得访问 A checkout，也不得从 R 偷取源码来让测试通过。

## 9. 敏感内容与分发

这是源码迁出任务，不是将中心仓库全部公开。

- 不假设 B 的实时可见性或目标分发权限已验证。
- 先对实际迁出清单执行有界敏感内容/许可检查；报告仅记录类别与路径，不记录秘密值。
- `application.yml`、`.env.*`、SQL、部署脚本等即使已被 A 跟踪，也不自动等于可公开内容。
- 私人成绩、登录凭据、数据库连接秘密、私有运行资产不进入 B/C 的新候选提交或构建包。
- 不能确认能分发的内容保留源副本且阻断相关项；禁止用复制整个 R 的方式解决资源缺失。
- 普通客户端包不得包含中心凭据或默认取得中心 SQL/Source 权限。

使用已有 Core/Contract 的固定 wheel 或已批准包渠道做干净安装验证；维护者可构建制品，普通部署者验证不得借用维护者 SSH 凭据。
本地制品安装通过与外部分发渠道可获得性分别报告。无需公开源码，也不另起“包平台”项目。

## 10. Native WIP 与未激活协议的处理

现有安全代码按精确输入保存，不用旧不安全实现替代。

- 实际迁入的默认入口依赖 Native Reader WIP时，执行现有 child/parent 和相关定向用例；失败则停该入口，不能标可运行。
- 没有授权测试库或完整运行前提时，可完成路径映射和移植 diff，但明确 `RUNTIME_VALIDATION_BLOCKED`。
- 不把未验证 overlay 静默加入默认可发布构建。
- 不因这次迁出新增 Source 协议、修改 schema 规则或扩大 Token 权限。
- 现有 Phase 6 默认启动可能进行 DDL、Source 纳管或外网请求，启动前核对并隔离；无法隔离就不执行该启动。

## 11. 本轮验证清单

只跑对本次迁出真正敏感的验证，不重跑每份历史报告的全部套件。

| 验证 | 可接受证据 | 不可替代的边界 |
| --- | --- | --- |
| 路径完整性 | 699 路径 + Native overlay + 混合符号都有处置；目标 hash或变更原因可追溯 | 目录存在不算迁出完成 |
| 去重 | B 两部署模式实际调用同一业务模块，旧副本删除/委托清单 | 共用 Core 不能替代命令/渲染去重 |
| 脱离 Sakura | A checkout 不可访问时实际入口安装/装载/代表调用 | 简单改 cwd、mock整个应用不算 |
| 计算行为 | 复用正确依赖版本下的既有 Golden，针对路径/装载变化补测 | 不允许浮动版本或悄改数值容差 |
| 代表功能 | 两模式的查歌、B30、六维/推荐、成绩/同步、段位/趋势各取已有代表链；公开资源下至少一份实际 PNG | mock 上游和测试 Source只能证明对应隔离边界，不冒充真实授权/上游验收 |
| Native 安全 | 实际受影响路径的 owner/撤权/超时/发送前检查定向用例 | 历史测试不覆盖后写的 SQL 文件 |
| 宿主回归 | 混合符号拆出后通用 miku入口可装载，用户WIP hash保持 | 不启动用户其他真实机器人 |
| 安装 | 干净目标环境由固定制品安装，不能依赖 A/R源码、维护者预装包 | 本地安装不代表公共渠道已发布 |
| Viewer | worker/Read Port 指向迁出入口，现有冻结界面和功能不改变 | 不执行生产部署，不以模拟结果替代联合运行 |

复用测试须匹配被测模块及其依赖，而非只比较测试文件 hash。
资源 runner、限制及取消清理沿用已批准规则。不绕过 guard，不与其他构建重叠。

## 12. 与成本和发布门禁的关系

本轮只为安装/装载/路径迁移做有界资源记录，不能拿它关闭 M6 或原 P1a 规模 Gate。

真正采用新 Source 协议前，仍须完成 M6 的登记/追加、Reader lease、同 Source 更新/查询/撤权竞争、bridge+compute 进程树和 IO/RSS。
实际 probe 的输入、时间/内存/IO预算必须来自已批准配置，未知则待决；不能依据代码支持上限自行扩大测试。

将 Source 协议代码从 A 搬到 B，不等于授权纳管生产数据。
将 A 删除 diff 准备好，不等于允许马上删除原工作区或切换服务。

## 13. 施工顺序和防止无限扩展

内部按以下三个检查点完成，不再在每点后要求用户重发一轮通用审计：

1. 锁定输入、隔离工作树、完成实际落点/敏感内容检查；开始真实迁移。
2. 完成迁出和重复实现收敛、混合入口路径适配；产出配对 add/remove diff。
3. 执行上述定向验证、构建候选和固定发布依赖；交付后停止。

资源准入拒绝一次后记录并结束受阻任务，不无人值守循环等候数小时。
失败先归因，再做有明确修复点的定向复测；相同问题重复失败不得继续盲试。
新发现的清单外需求进入有编号的 deferred 项；只因直接阻断本轮目标才提交局部范围变更。
禁止以“既然在这里，顺便统一全部…”继续开子系统。

## 14. 最终交付物

本轮必须有代码，不接受只新增下一份计划。

- A/B/C 隔离分支及本地 commit 清单：目标新增/合并和 A 删除配对可审阅；K/Contract无必要不变。
- `execution-lock.json`：真实使用基线、overlay、依赖和工作区。
- `extraction-map.json`：全部有限路径和混合符号的最终处置。
- `extraction-validation.md`：安装、实际入口、无 Sakura 路径、去重、代表功能与安全差量的 PASS/BLOCKED。
- `release-candidate-lock.json`：本轮制品/包 hash、协议/schema要求、中心/分布式配置、未验证运行条件；全部标未发布。

不生成几十份名称略有不同的状态报告；原有证据按路径引用。
无法完成的路径列有限 blocker，保留已完成代码，不重新进入旧 Phase 6 的无限尾项。

## 15. 允许的结束状态

`SOURCE_EXTRACTION_CANDIDATE_READY`：有限迁出目标的代码及隔离验证满足本轮条件，可以审阅配对删除。

`SOURCE_EXTRACTION_PARTIAL`：已有真实迁移提交，但还存在精确列出的归属、内容、安装或验证阻断。

`HANDOFF_CONFLICT`：相关文件仍被另一任务改写，无法安全建立输入；只处理冲突，不运行迁移。

无论哪种状态，都分别列：
- 整体太鼓功能对齐：已证实范围 / 仍存在的差异。
- 联合生产发布：NOT_AUTHORIZED / NOT_VERIFIED。
- 原 Gate 6 / Read Model：保持已有结论，不因本轮改成 PASS。
- 1.0：本轮不作发布决定。

本轮结束后不继续 M7/M8，不 push，不同步 R，不重启，不自动执行新 Goal。

## 16. 一句话验收

不是“又多了一个 Core”，也不是“所有平台问题都修完了”，而是：

> 独立太鼓仓库中已经出现可安装、可审阅、可验证的真实应用迁出候选；Sakura 的对应删除和共享实现收敛有配对证据；尚未满足的联合运行前提被明确保留，没有偷偷上线或重新扩大任务。
