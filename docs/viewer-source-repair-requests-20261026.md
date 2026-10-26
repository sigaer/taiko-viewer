# Source 单案修复决策与两份独立授权申请

日期：2026-10-26，Asia/Shanghai。本报告是 [唯一 Release Gate](viewer-1-release-gates-20261023.md) 的证据附件，沿用 [原完整性报告](viewer-source-integrity-20261025.md)。本轮生产只读；没有调用上游、修复 Source、修改 Writer、数据库或备份调度。

## 当前前提

UTC 2026-10-26 14:36:29（北京时间22:36:29），只读 SH 锁下确认 B1-CURRENT-01：sequence=2、当前 manifest 与原 commit、428002B/`66b61224…544c7` 引用、428028B/`d186ad57…feb2` 坏对象及 projection 的完整 hash、inode/mtime/ctime 均与原证据相同，无 pending。只校验本案两个路径，未重扫750对象或旧检查点。

只读 SQL 会话核对实际 DATABASE()/transaction_read_only；同一 Source 身份仍有一个 Wahlap 当前绑定，source/is_current/created_at/updated_at 与原记录一致。当前 binding ID、属主 ID 已封存为执行前置条件；原证据未保存这两个完整原值，不能追认其历史逐字段连续性。当前歌曲锁数量为0，执行前仍须重查绑定、锁及权限，不以该次读数代替执行时授权。

现有 Wahlap 获取代码 `update_user.getUserData` 使用现有配置 cookie，四路并发、每请求连接5s/读取30s：两个读取型 POST（songs、search player），两个 GET（achievement、dojo）。末尾调用 `save_userdata`；账号同步还可能分发到其他目标、插入 SQL 日志/回执。因此**不能执行现有同步接口来完成只读获取**。配置只检查存在/可读性，未读取 cookie；认证可用性、当前账号可查询性、返回完整性仍 NOT VERIFIED。

`_select_search_player` 存在首项 fallback；提供 Publication lease 时才有后续严格 ID 检查。新只读适配器必须无条件精确匹配本案 ID，禁止 fallback。`pageSize=3000` 也不证明全部记录完整；若达到截断边界或分页/总数不能验证，停止，不擅自追加分页请求。

## 申请 U1：本案有限权威只读获取（可以独立审查，尚未执行）

申请范围仅 B1-CURRENT-01，允许一次使用现有 Wahlap 凭据向 `https://wl-taiko.wahlap.net` 发起以下最多四个请求；真实 ID 和配置位置只在私有执行单中，不进入命令参数、PR或公开日志。

| 请求 | 约束 |
| --- | --- |
| POST `/api/user/all/songs` | 现有读取参数，page=1、pageSize=3000、isPlayed=true、userid=本案；不追加分页 |
| POST `/api/user/search/player` | keyword=本案、page=1、pageSize=10；只接受精确 userid |
| GET `/api/game/player/achievement/:case` | 本案一个 ID |
| GET `/api/game/dojo/score/:case` | 本案一个 ID |

拟用独立只读适配器，单并发、无重试、无自动重定向、无凭据刷新，总墙钟≤60s；连接≤3s、读超时≤10s，每响应≤8MiB、总响应≤16MiB，失败即停止。沿用现有 QA 准入和私有磁盘证据区，正文及身份仅在隔离环境比较；日志只记录允许的结构检查、长度、hash、分类及时间。

授权须包含：读取并在 TLS 请求头中使用现有配置 cookie、将本案 ID 传给指定上游，以及在私有隔离目录短期保存四个响应和候选。禁止调用 `getUserData`、`save_userdata`、dispatch、SQL写入或任何 Source/缓存/绑定持久化；不得输出异常原文/凭据。可使用无副作用的 dojo 解析函数，并明确获取时间/版本，不能把四个响应声称为上游原子快照。

即使这些接口用于读取，远端仍可能产生访问记录、配额扣减或安全审计；不承诺上游零副作用。没有授权则继续不访问。获得授权后，先审查只读适配器，再执行这一次限定读取；输出精确身份匹配、四个响应状态、结构/分页完整性、版本、候选长度/SHA-256、与已授权本案材料的差异及来源验证报告。该授权**不包含生产写入**。

## 现有 Writer 与隔离演练

安装内核 `taiko_store/publication.py` SHA-256 为 `bd402a38fbc9916e52a2e274180406dcfc2ff0c0a0155b828391b4921d775f3f`。

普通 saver 会先调用 current reader，已坏 current 因长度/hash 不符而被拒绝；正常同步不能直接自愈。底层 `stage/publish` 可以只替换 current 并产生 sequence+1，但在提交前失败时，通用 `_recover` 会试图重装旧坏对象，拒绝并保留 pending。故“正常 publish 成功一次”不能证明失败恢复合格。

新增 [合成演练脚本](../scripts/readiness/source_repair_rehearsal.py) 只允许现有 QA scratch，拒绝生产根目录，运行时禁止网络。它没有安装或改写生产内核。20项验证 PASS：正常 saver 拒绝、原回滚边界、显式修复的新 revision、8处实际子进程死亡/恢复、幂等、外来 pending/变更候选/陈旧父代拒绝、恢复中候选损坏拒绝、锁冲突拒绝、四请求带保存副作用的 mock 及身份不符拒绝。

原型使用绑定到精确父 manifest、坏 hash、候选 hash、transaction ID 和审批摘要的专用 forward-only 修复意图。中断后只能恢复该已批准新代；旧内容已坏时不假装可回退为健康旧代。它保留旧 commit 文件和坏对象证据，只改变新 revision 与当前指针；不追加历史观测、不重算 Growth/Goal，不改凭据。受保护权限/测量只用合成文件验证未变，**不是生产 SQL 原子性或完整恢复证明**。

硬链接风险在合成 fixture 中实际复现：对象与 projection 共用 inode，绕过内核的原地写会同时破坏对象。已核对的当前 `_put_stream`、`_install`、正常 saver 和 `write_local_snapshot` 使用新对象/原子 replace/Publication commit，没有发现这些路径原地写入已有 canonical 对象。0600文件和硬链接本身不阻止同一有权限主体原地写；本轮没有证明历史写入者，也没有因此重开完整 Writer 迁移。

## 申请 W1：本案新修复 revision（独立预审单，当前不能签发执行授权）

对象范围：仅本案 current，从当前 sequence2/精确父 manifest 创建新 revision；其他749个健康引用、旧 manifest、身份/Session/Key/Grant、历史、Growth/Goal、评分和权限保持原语义。原始坏对象、manifest、审计及原始失败证据须先封存；不覆盖旧 committed hash，不把当前坏字节重哈希到旧 revision。

U1完成后，才补齐：权威四响应的验证报告、**候选完整长度/hash/结构差异**、生产协调器代码及哈希、执行身份/时间窗口和精确审批摘要。现在没有这些物料，**不申请空白的条件式生产执行许可**。须另行提交并取得明确 W1 写入授权；U1或合成通过不能代替它。

拟执行事务：正常准入与维护互斥→重新核对绑定/锁/父代/坏hash/no pending→本案 EX→对全部新当前代引用及候选校验→持久化私有修复意图/审批记录→stage新对象→受控 hardlink/replace 安装→fsync并提交新 revision→验证 reader、projection、全部当前代引用及权限/事实不变→恢复本案读取。生产协调器须专门支持已坏父代的恢复，不能直接运行本合成原型或修改安装文件绕过部署。

失败策略：提交前且无意图时保持原不可用状态；有精确修复意图时保持入口 fail-closed，待同一批准候选恢复到新代；候选/父代/绑定/外来pending不符则停止，保留证据。已提交后只允许精确幂等确认或另一个经过审批的补偿 revision，不强行退回坏父代，不删除旧审计。预期影响仅为本案短时拒绝读取转为新代正常读取；若需要变更任何事实、锁语义或其他对象，超出此单并停止。

新 revision **不能恢复丢失的旧字节**。后续恢复验收必须区分“全体 Source 当前 committed vector 的全部引用”与“保留的旧损坏 revision”。原型只证明前者可恢复健康；旧坏 revision仍坏。若发布 Gate 要求旧 revision内容也完整可读，W1新代修复不能关闭该项，需精确副本或发布决策对历史不可恢复边界作明确裁决；不能静默排除旧引用来推进 verified。

证据在 `qa-vault/evidence/viewer-source-stability-20261026`：`source-state-check.json`、`repair-backup-capabilities.json`、`source-repair-rehearsal.json` 及私有绑定前置条件。20项最终运行见该证据的交付索引；初次元数据格式比较与回滚故障注入位置的失败运行原样保留。

结论：调查和合成演练 **PASS（限定范围）**；上游权威获取 **BLOCKED_PENDING_U1**；生产修复 **BLOCKED_PENDING_CANDIDATE_AND_W1**；完整恢复及推进 verified 均未执行。
