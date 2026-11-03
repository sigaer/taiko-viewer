# Sakura Taiko P0 — H4 Kinoko 异常时间排除与恢复准入（有限执行指令）

**版本**：2026-10-12 / H4 policy amendment  
**本次依据**：用户确认 Kinoko 侧可人工录入 2765 年等明显异常时间，这些时间不代表可信的实际游玩历史；授权**业务规则调整**为排除异常未来时间。  
**运行状态**：`P0_HOTFIX_CANDIDATE_BLOCKED`；H1/H2/H3 仅隔离测试 PASS；B0 备份未执行；生产事故 OPEN。  
**输入**：`p.zip` 的 `p0-production-recovery/` 报告、`viewer-guard-BLOCKED.patch`、`candidate-review.patch` 和现存候选 `4d97357`。  
**范围**：只解锁 H4 和相关定向验证；保留 H1/H2/H3；不恢复迁出 Goal，不修改 Core、Contract、Rating 等公式、不改动生产数据。

## 0. 核心决定——不是整批拒绝，也不是强行修正为当前时间

将 H4 从“发现一条时间异常则整个 Kinoko 导入失败”改为：

1. **对 Kinoko 输入的每条成绩事件做时间可信度检查**。有效的历史事件进入既有导入、去重、合并和排名计算；明显异常的事件仅跳过，不成为 current/History/每日档案/趋势/最高分日期的证据。不能将 2765 改成 2025、2026 或导入当日。
2. 时间上限按 `Asia/Shanghai` 解释，使用注入的单一 `now` 和既有候选 `now + 5 分钟` 包含式容差；不写死 `2765` 年。此处五分钟是工程容差，不是假定 Kinoko 确有五分钟时钟误差。
3. **同一批正常与异常事件混合时，正常事件继续导入**。所有事件均无效时，不进行成绩、current、history、daily 或与导入成功有关的业务状态写入，返回可理解的无有效记录/导入失败状态，不制造零分、不删除已有数据。
4. 每次导入提供明确计数：源记录数、有效记录数、跳过异常时间记录数、已有记录去重数、实际写入数；对跳过项只给出脱敏位置、类型和原因，不回显成绩数据/密钥。须保证客户端能展示“部分导入”而非误报全部成功。
5. **current 现有异常项与新输入分开对待**：账号 A 已有四条未来时间。不能把整个 `userdata` 的旧异常字段作为新导入的致命拒绝条件；更不能自动“修复”它们。未受污染的谱面可继续处理；有冲突的谱面保留旧状态，标记需要单独 R0 恢复的项目。在未有可信前态/业务规则确认前，不根据“2765 比现在晚”更新成绩或日期。
6. 对历史组 `latestSongs` 必须**由过滤后的有效事件重新确定**；不得先取所有记录的 `latest`、再只过滤历史，否则 2765 记录仍可能通过 current 路径回流。
7. 坚持 H3 原则：趋势窗口锚定请求时钟；未来污染快照、记录与既存三个 daily namespace **读时过滤**；绘图读取不再写回存档。对过去已保存的异常数据不执行覆盖、删除或回填。

### 特别说明：跳过异常记录 vs 去掉日期后保留成绩

P0 默认采用**整条异常事件不参加自动成绩与时间合并**，而不是仅清除其日期后把未经证实的分数作为今天的新 PB。Kinoko 人工录入的真实日期未知，无法证明这个事件在时间序列中的位置。其他有效事件正常保留。后续如需要“无日期的手动成绩”作为单独产品能力，另立范围与业务语义，不属于 H4 修复。

## 1. 现有 H4 补丁必须修改的问题

对照 `p.zip` 中 `viewer-guard-BLOCKED.patch`：

- `kinoko-import.ts:fetchKinokoScores/fetchKinokoHistory` 目前调用 `validateKinokoTimes` / `sanitizeKinokoSong` 后异常即 `422`，导致**一条 2765 事件阻断整批**。改为在合法身份/结构检查后分组过滤，按成功和跳过两组继续；绝不把无效行伪装成其他正常成绩。
- `kinoko-history.ts:normalizeHistoryRecords` 目前按 `requireTimestamp=true` 整组抛错。改为仅对过滤后的有效历史记录做 snapshot 生成、时间排序和去重；有效的 full baseline/delta 语义不能改变。
- `kinoko-import.ts:mergeKinokoScores` 和 `kinoko-history.ts:writeKinokoHistorySnapshots` 目前调用 `validateKinokoPayloadTimes(userdata, now)`，**账号 A 的既存 2765 字段会使今后的正常导入也失败**。将“校验新来源事件”与“识别既有污染”分开；既有污染按可观察冲突分支处理，不静默覆盖、不在所有谱面上报错。
- `kinoko-time.ts:parseKinokoTimestamp` 当前只接受旧式整秒上海本地时间；此前已有真实合法的带偏移 ISO / 小数秒元数据，且 `_meta.ts` 可是 compact 时间字符串。严格区分 **score event time** 与 **snapshot/import metadata time**：只把可确定语义的成绩事件时间用于业务时间比较；对 legacy、ISO offset、fraction 和 compact metadata 分别作兼容解析或按既有契约保留，不因元数据格式不同错误拒绝整批。
- `server/utils/account/sync.ts` 必须保证输出的当前成绩计划与历史计划来自**同一组过滤后的输入**，正常记录入库前仍执行身份/所属校验及真实的 rank/crown/achievement 构建。保留已有事务/锁的既有行为，不额外发明一个写入体系。
- 两条 `server/api/account/sync/kinoko-*.post.ts` 生产 route 中，`trackBetaServer` 在上游读取/日期预检前可能触发 DB 写入。**不要为达到“绝对无 DB 写入”绕开 `requireAccountUser`、身份核验或安全审计**。真正的硬条件是“无效/全跳过数据不能写入成绩、history、current、import receipt、daily 或错误的业务合并”；认证/审计/遥测可能存在的 DB 副作用必须**逐项列明、实测并取得准入决定**，不让 Codex 自行放宽原来的零写入 Gate。

## 2. H4 必须完成的验证矩阵

只在原受控 memory wrapper 和隔离 `_test` SQL 中执行。测试环境必须先运行 `SELECT DATABASE()`，确认名称以 `_test` 结尾，且显式 `TAIKO_ALLOW_TEST_DB_MUTATION=1`；未获得测试库写入许可时，只完成无 DB 的验证，将 SQL Gate 保留 BLOCKED。

| 场景 | 预期结果 |
|---|---|
| 合法历史 2024/2025/2026 + 一条 2765 | 合法记录正确入库并保留时间顺序；2765 跳过；导入摘要报告准确 |
| 仅含 2765 / 2099 等未来历史 | 不产生新的 current/history/daily 成绩写入；返回明确无有效记录 |
| `update_datetime` 正常而 `highscore_datetime` 未来，或反之 | 异常事件不得通过另一日期字段绕过过滤 |
| 同曲多事件，最新一条为 2765 | latest 选自剩余有效事件；不能以 2765 写回 current |
| 既有 current 已有 2765，导入其他曲目合法事件 | 合法曲目仍可处理，既存受污染曲目不发生隐式改写 |
| 既有 current 污染 + 同曲正常来源事件 | 进入显式受污染冲突处理，不静默覆盖，也不令所有其他曲目失败 |
| 旧式整秒、合法带偏移 ISO、小数秒、compact `_meta.ts` | 按各字段已有语义兼容；不将元数据错误当作成绩时刻 |
| 时区边界、闰日、同一秒多记录、`now+5m` 与 `now+5m+1s` | deterministic；不受机器 TZ 或夏令时隐式影响 |
| 重复导入、合法 full baseline + delta、已有历史 | 不重复生成历史、不丢 baseline，rank/crown/最高分等既有合并规则维持 |
| 已有异常 daily 存档 + 新读时过滤 | 30/90/365 天趋势恢复合理窗口，不在读取时重写三个存档 |
| 无权限、所属账号不符、上游故障、全无效输入 | 无越权数据和成绩状态写入；保留必要审计；无匿名/陈旧数据 fallback |
| SQL 测试真实 route 而非 stub | 实测认证、tracking、receipt、用户表、业务状态前后差量，报告每项副作用 |

必要时扩展现有真实合并回归，而不是继续使用 `rebuildUserdataAchievement` 的空 stub 冒充 rank/crown 验收。全量性能测试和整个 Bot 功能测试不在本轮范围内。

## 3. 状态和授权边界

**H4_POLICY_ACCEPTED** 只表示用户已决定业务上排除异常未来历史。它**不等于** H4_VERIFIED、B0_BACKUP_COMPLETE、D0_DEPLOY_AUTHORIZED、S0_LIVE_SMOKE_AUTHORIZED 或 R0_DATA_REPAIR_AUTHORIZED。

下一步仍须分别处理：

1. **B0：私有一致性备份**：账号 A 当前 1 + history 1214 + daily 3，共 1218 文件约 27.35 MB。此前的 SHA256 清单不是备份。必须有可信存储快照，或事先获授权且能证明覆盖全部相关 Writer 的短时围栏/维护窗口。不能以 `chmod`、删除锁文件、关闭未知进程代替。
2. **H4：隔离实现与测试**：这次仅允许继续修订 isolated candidate，保留上一版 `4d97357` 可核对证据；不修改 R 或 Viewer 正在运行的文件。测试 SQL 的额外权限须由使用者明确给予。
3. **D0：生产修复发布**：须独立审批具体文件 SHA、构建来源、受影响服务/重启、回滚与维护窗口。不得合入 `0.82.0`、Phase 6、迁出 wheel 等未联合验收代码。
4. **S0：认证烟测**：Growth GET 与趋势 GET 可能有写入/缓存副作用，先列出并授权测试写集。
5. **R0：纠正已有污染**：只根据可信真实日期/备份，针对确切 current 字段及 daily 记录设计可逆修复；不可由 2765 猜测真实年份。历史原文件优先不可变保护。

### 推荐状态机

```text
P0_HOTFIX_CANDIDATE_BLOCKED
          ↓（本文件批准的是业务时间策略）
H4_POLICY_ACCEPTED
          ↓（隔离代码、真实合并回归、准入 SQL 验证通过）
P0_HOTFIX_CANDIDATE_READY
          ↓（B0 可靠备份 + 明确 D0 发布授权）
P0_HOTFIX_DEPLOYABLE
          ↓（受控发布 + S0 有限认证烟测）
P0_FUNCTIONS_RECOVERED / DATA_CONTAMINATION_UNRESOLVED
          ↓（单独 R0 数据恢复）
P0_DATA_RECOVERY_REVIEWED
```

每一状态都必须附实际日志/哈希和未完成项，不允许把正常趋势重新显示写成“全部历史已恢复”。

## 4. 可直接交给 Codex 的有限命令

> 用户已作出业务决定：Kinoko 人工录入产生的显著未来年份不是可信游玩时间，**排除异常事件，不阻断同批正常数据**。请按本文件第 0–2 节修正当前已存在的 H4 候选，不要开启新的平台重构。
>
> - 使用 `p.zip` 内 `viewer-guard-BLOCKED.patch`、`05-open-risks-and-decisions.md` 和 `03-targeted-validation.md` 为确切输入，先读取实际 repo 的适用 `AGENTS.md`。
> - 保留 H1/H2/H3 的隔离 PASS 和原工作树，新的 H4 只在隔离分支实现；对发现的其他问题只记录，不扩展施工。
> - 交付 H4 新补丁、变更路径、过滤与跳过统计、真实 Kinoko merge/rank/crown 测试、输入字段格式测试、实际 route 和允许的 `_test` SQL 差量测试。不能运行 SQL 时明确标 BLOCKED，不更改 Gate 含义。
> - 特别验证：**已有 current 2765 不阻断其他正常曲目；latestSongs 不回流异常事件；全部异常时没有成绩侧写入**。
> - 不备份/读取/改写生产私人 userdata，不运行生产 Kinoko 导入，不修改线上 schema/Token/运行代码；不提交推送到 main，不启动服务、不发布、不重启。
> - 完成后停下，给出 `H4_PASS` 或 `H4_BLOCKED` 的明确证据，以及仍需的 B0、D0、S0、R0 独立授权清单。

**终点**：`H4_POLICY_ACCEPTED` → 隔离验证能否达到 `P0_HOTFIX_CANDIDATE_READY`，不是生产事故结案。
