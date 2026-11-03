# Viewer 0.83.0-rc.6 — 本地 Git 集成演练与分阶段 Gate P 工作令

**日期：**2026-10-16  
**目标：**在不推送、不改变任何已有 main 工作树、不访问生产的情况下，把已经审查的 rc.6 转化为**具有真实 origin 祖先关系的本地合并候选**，并把未来生产准入拆成「旧模式暗部署 / My Taiko 受限启用 / Developer API 独立启用」三条可分别签收的路径。避免继续陷入功能评审和反复的全量 QA。

## 0. 精确输入与权限边界

- rc.6 审查交付：`70c3d3e1cd6b6964c396ea2fda1fc07e73a49fe1`；正式构建源码：`8d915ca2724480c7a287073b742e94a83b44686a`。
- rc.6 manifest SHA-256：`c743de0b28123cac01599b9525315c9fc6c4e71b05749de6d0ceb6622a95358b`。
- 最近一次有证据的 `origin/main`：`777546c943b9ca196c365fffa6d1289eb558a2db`，2026-10-16 14:02:28 UTC；当时 `ahead/behind=134/1`、唯一远端提交。**该 SHA 仅是观察值，执行前重新核对，不能假定远端未改变。**
- Contract：`CONTRACT_FROZEN_LOCAL`，冻结提交 `5c68a139`，不得修改唯一 Schema/Golden/SDK/OpenAPI 或扩大授权 scope。Taiko 0.14.2、两角色 94 包和已固定 wheel/lock 不重新构建。
- Gate P：`DEPLOY_PENDING_AUTH`；`deployReady=false`；v1 OFF；My Taiko 两侧默认 `legacy`；Annual startup 正常模式。I6 `DEFERRED_WITH_EVIDENCE`。
- Owner 本次只授权**在全新隔离 worktree 进行本地 merge 演练、必要局部源码调整和定向 QA**。未授权任何 push、tag、main 合并、生产配置读取、生产 SQL、运行时操作、部署、开关启用。
- 所有原有三个仓库的 dirty main、未提交文件、工作分支保持原状；不要 stash、reset、checkout 或直接修改。所有证据进入 `/home/sigaer/taiko/qa-vault` 持久化专属目录，并设最大资源/磁盘预算；不得再往 `/var/tmp` 堆放无主大文件。

## R1. 完成真实 Git 祖先关系（主路径，先执行）

1. 用新 worktree/独立分支从已签收 rc.6 **运行源码和审查补丁所对应的准确树**创建候选；记录 `git status`、完整 HEAD、tree、SHA 清单。只进行允许的远端**只读 fetch**，核对最新 `origin/main`：若不再是本文件中的 `777546c`，先生成新远端独有提交及路径的差异报告，只审新增部分；发现新的高风险 Writer/认证/Publication 变更则停下并上报。
2. 在隔离分支上尝试 `git merge --no-ff --no-commit <pinned-origin-main>`，**不使用全仓库 `-s ours`、不强行重放旧代码、不修改本地 main**。对冲突逐路径落实已经评审的九项裁决，额外路径只按新证据处理。保留 rc.6 的完整 owner/source/Session 边界、唯一 Publication Writer、冻结 Contract、I5 BFF 和所有安全默认值。
3. Kinoko 的兼容性选择明确登记为 Owner 待风险接受：**任何既有 current 异常时间 → 整批 409，staging 前终止**，不会自动跳过污染谱面并做旧式 delta 发布。针对这一行为保留用户可见提示、可复现的诊断代码与未来独立数据修复入口；**本轮不自动清理污染账号，也不放宽到部分导入**。
4. 如果 merge/tree 允许，创建**仅在隔离分支上的本地集成提交**；验证 `<observed-origin>` 为新候选祖先（`git merge-base --is-ancestor`）、受保护树与精确文件身份、未意外引入旧 deploy 模板/旧 fs Writer/0.81.12 lock。绝不把“行为裁决”直接等同“Git 已合入”。
5. 生成 `origin-ancestry-reconciliation.json`：旧/新 HEAD、merge-base、双向独有 commit、全部变更路径、每个文件处置、tree diff、真实祖先检查结果、候选 commit。若 merge 不能可靠结束，保持 `MERGE_REHEARSAL_BLOCKED`，不要通过写假标记跳过。

### R1 最小验收

- 来源身份链可核查；无未经裁决的远端独有文件；无未解决冲突/未提交运行变更。
- 新候选确实包含执行时观测到的 `origin/main` 祖先；**没有更改任何现有 main 工作树、远程仓库或生产服务**。
- 明确标识：`LOCAL_MERGE_ANCESTRY_READY_FOR_REVIEW`，**不能直接写成 `MERGED_MAIN` 或 `DEPLOY_READY`**。

## R2. 只运行受影响验证，不重开大审计

1. 比较新集成树与 `8d915ca` 的运行源码输入清单。**如果运行源码、lock、Schema/生成绑定、配置、构建输入的字节均一致**，按证据边界复用 rc.6 的 5,185 构建产物原样启动证据与既有定向测试，补做一次 source/tree 身份证明，不为了新 merge commit 强制重建。
2. 如果合并实际改变运行源码：只补变更对应的 Kinoko HTTP/SQL（零写入 422/409、污染整批 409、partial 200 warning、成功单 generation、owner/source/Session 并发拒绝）、11 项 adapter/Publication、I5 `/my` Session/ReadView、外部 v1 OFF 的负面样例；必要时重做**一次**正式构建及原样产物冒烟。保留原 FAIL，不误称旧 74 HTTP 或完整仓库 typecheck 在新树重新通过。
3. 证明零写入不产生 success receipt、success log、空 current 或 Publication sequence 增量；合法部分导入 warning，不改变冻结 Contract。没有第二套 Writer，没有默认旧 JSON fallback。
4. 存证执行时间、锁、资源/PSI/OOM、隔离 MySQL `_test` 与 `@@datadir`、子进程退出、源码/原始结果 hash。严格清理任务所属 scratch，避免全量重跑。

## P0. 把 Gate P 从“11 项一次过”拆成三个部署层级（只整理，不实际执行）

**关键原则：生产运行证据未知，不自动放行任何层级。但对外 v1 尚未启用时，其专属 DDL、应用真实性、Grant 授权和对外 API 配额验收**不应被错误提升为**旧模式暗部署**的强制条件；前提是源码/隔离测试明确证明关闭状态不引用四张新表、无运行时副作用。反之若存在隐式 DDL/查询依赖，则标为该层级的真实 BLOCKER。

| 层级 | 预期状态 | 必需生产证据 / 风险 | 不应自动附带的事项 |
|---|---|---|---|
| **P-A：仅更新代码，旧模式暗部署** | `/my=legacy`（public/private 同步），Developer v1 OFF，Annual normal | 实际部署身份、当前入口/ACL、不可变新旧构件和回滚、现有数据的有效备份恢复基础、源码启动兼容、合成匿名/旧路由冒烟；完整生产变更仍单独批准 | 不为 OFF 的 v1 立即创建四表；不要求第三方应用授权上线验收；不得开启新 `/my` |
| **P-B：受控 My Taiko 新读取** | v1 继续 OFF，仅获批用户或隔离实例使用 `read-model` | 明确能实施的可审查受控路由方案（现有 mode 是进程级，不等于用户 allowlist）、生产身份及真实权限/代际负面测试、及时回退双 mode | 不以 `/my` 成功自动启用 v1，也不动第三方 Grant/客户端 Key |
| **P-C：Developer API v1 对外启用** | 独立有限范围启动 | 真实身份与历史 binding 有效性、proxy/Origin/Key 日志、业务与合成授权检查、四表和 F3 索引的受审 DDL、撤销安全 PITR/异地加密恢复、公私预算/审计、明确许可与灰度 | 不自动升级 Bot token/旧 public-score-token、不开放 history/growth/sync/写分 |

- 以上是**准入依赖拆分提案**，不是缩减既有生产安全要求；与已有 Gate P 11 项矩阵形成 `phaseDependencies`，新增 `REQUIRED / NOT_APPLICABLE_WHILE_OFF / PENDING_EVIDENCE`，绝不把未测写成 PASS。
- 十二项 `private-resource-01..12` 仍只是**未映射的占位符**，不是已确定的生产运行依赖；需基于获准的真实依赖清单定位，并单独完成权属和备份授权。不得让无法识别的占位符作为循环审计任务，也不能自动声称不重要。
- 生产 schema 差异、PITR、异地备份、RPO≤15min/RTO≤120min 均未实测。现有四表合成恢复仅 `PASS_SCOPED`。不要凭默认关闭或本地成功冒充生产基线安全。

## P1. 最小生产发现请求——准备独立授权，不提前执行

目前唯一具有具体候选名称的发现项是 `P-ID-DISCOVERY`：`taiko-viewer.service`，**名称来自仓库模板，不是线上已确认 unit**。

向 Owner 提供极简独立审批卡（未获批准前 `CAN_RUN_NOW=false`）：

- **目的：**仅确认这个具名候选 unit 是否存在及其元数据，用于后续填准生产清单。
- **操作：**一次 `systemctl show taiko-viewer.service`，只允许 `Id,LoadState,ActiveState,SubState,MainPID,User,Group,WorkingDirectory,FragmentPath,ControlGroup` 十字段；≤10 秒；结果保存至由 Owner 指定的私有存证目录。
- **禁止：**`list-units` 横扫、全量 `systemctl show`、`Environment`、`ExecStart` 详情、进程 cmdline/environ、业务文件/数据库、HTTP 探测或修改；unit 不存在/不匹配就停止，不自动猜新名字。
- **缺项：**由 Owner 明确确认是否允许该范围及操作者、有效期、存证位置；不将此前对 F1–F5 的聊天批准用于生产发现。

只有完成这一项后，才能依据**真实发现**提出下一张精确的 P-ID-VERIFY/代理文件等审批；SQL metadata 属另一项授权，DDL、备份、发布更是另批。

## 明确不做

- 不做 0.83 新 DTO、OAuth、第三方新 scope、I6、Home/Goal/Growth 大改。
- 不重跑 Annual、历史 12 PNG、119 SQL、46×2 安装生命周期、0.82 各类已接受测试。
- 不 push、不 tag、不合并既有 main、不部署、不读生产配置/数据、不执行生产 SQL/DDL、不重启、不启用 v1/新 `/my`。
- 不将错误的“污染数据整批拒绝”兼容差异隐藏为完全等价；不把用户拒绝导入默默算为成功。

## 最终只交付四件事

1. **本地真实 merge 祖先候选**（新 commit/ref、差异裁决、tree/hash、源到构件身份，若不成立则提供明确阻断报告）。
2. **最小受影响 QA 结果**（已有证据复用界限、确实新跑的用例、失败/退出/资源记录）。
3. **三层 Gate P 依赖矩阵**（P-A/P-B/P-C 分开、每项真实 `UNKNOWN/PENDING` 保留、不能因 v1 未来工作锁死暗部署）。
4. **单项 P-ID-DISCOVERY 请求**（十字段、一个候选 unit、10 秒、未批准不可执行）。

**建议结束状态：**`LOCAL_MERGE_ANCESTRY_READY_FOR_REVIEW` + `GATE_P_PHASED_APPROVAL_PREPARED`；`DEPLOY_PENDING_AUTH` 不变。交付之后停下，等待必要的具体生产操作授权，不再主动扩展为新一轮平台审计。
