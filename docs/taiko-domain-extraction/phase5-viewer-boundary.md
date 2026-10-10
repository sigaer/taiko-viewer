# Phase 5 — Viewer boundary

状态：IN_PROGRESS。按 Execution Plan v2 的顺序执行：5.1 只迁移读取，5.2 Growth 消费 Canonical Fact，5.3 删除重复领域解释。此阶段不改 Writer、数据位置或计算 profiles。

## 5.1 读取审计与选择

- 当前成绩：account/shared、Goal snapshot 以及 Personal/Growth 的文件存在性检查。Goal revision 必须继续 hash 实际读到的原文，provenance 必须继续收到同一原文；不得使用展示缓存。
- 历史成绩：Growth evidence 的枚举、八文件预取和 request-local stat 校验。排序、2,000 文件上限、原文 hash、来源排除、source switch 和 discontinuity baseline 保留。
- 每日能力：只读中心已经冻结的 daily archive；维度计算仍来自中心/Core，Viewer 保留产品 focus/availability 和既有 measurement 合并规则。
- 选择进程内、可替换的版本化 Read Port 与文件 adapter。当前单机中心已经有稳定存储，额外 HTTP 服务不能解决 ownership，反而新增部署依赖。Product 服务依赖 port；路径、文件布局和原文读取由 infrastructure adapter 承担。兼容类型只在 adapter 层保留，后续 5.3 收敛字段解释。
- 保留 Phase 1 Contract v1.0 的 strict Score mapper；不对所有历史记录深拷贝，也不把旧缺失值改为 0。Growth/Goal 的产品判断与事实时间归属继续由 Viewer 定义。
- 不增加对外个人数据接口，也不修改现有 API 授权；Developer resource grant 与全部 Writer 的整改归 Phase 6 ownership。

基线：21 个离线 test 文件、202 项经 memory runner 完成（exit 0），JUnit 存于 `/var/tmp/taiko-domain-extraction/viewer-phase5-baseline.xml`。数据库、Python 计算、网络和真实账户由现有测试 harness 明确替换；历史内容均为合成 fixture。生产进程及 Core 0.1.1 pin 未改。

## 步骤与验证

- 5.1 READ_BOUNDARY_PASS：当前/原文、存在性、历史枚举/读取/stat、daily archive 进入 `ScoreReadPort`。Goal、Personal、Growth 不再自己打开这些成绩文件。兼容 Userdata 类型移至 domain adapter，shared 仅 re-export；原 Writer block 字节相同。
- 219 项离线 regression 全通过；新增读取测试覆盖原文 hash、缺失值、再次读取、非法路径、历史重写、daily archive missing/corrupt/8 MiB 上限；read contract/file adapter/test 的 TypeScript check 通过。保留 frozen oracle 与真实磁盘 adapter，未用最终 DTO mock 代替新边界。
- 首轮一个测试连续重写落在同一毫秒，ctime 相同；测试明确跨过文件系统时钟精度。当前 stat 校验仍不是发布事务，精度限制如实保留，Phase 6 使用 publication version 完善识别。
- [5.1 验证](evidence/phase5-read-validation.json) 保存 source/JUnit hash。回退至 `060dc05` 可恢复旧读取；无存储迁移。步骤提交用于后续整阶段 review，Web 尚未发布，Gate 5 尚未 PASS。
- 5.1 提交 `8288bfe`，仅本地步骤提交，等待本 Phase 发布脚本统一提交/推送。
- 5.2 CANONICAL_FACT_PASS：GrowthFact / temporal / observation 改为 Contract v1.0 类型引用，保留 Viewer GoalType 和非 nullable chart ID 的产品 refinement；删除本地重复模型。History 与 Recent 消费 owner/binding 校验后的 Canonical GrowthProjection，返回原有 facts 字段，不重建或复制事实树。Weekly/Passport 继续消费 History 的同一事实来源。
- [5.2 验证](evidence/phase5-fact-validation.json)：冻结 schema 与旧 fact Golden 一致，跨 owner/binding 拒绝，Goal occurred/observed/confirmed 时间保持；离线完整链路和局部 TypeScript PASS。没有 Writer/SQL/schema 迁移或新对外字段。回退至 `8288bfe` 恢复 5.1；Gate 5 尚未 PASS。
- 5.2 提交 `556abb7`。
- 5.3 IMPLEMENTATION_PASS：Read Port / legacy evidence 类型归属 Contract 的 `score-read` 子路径；Viewer 保留文件 adapter 与兼容 re-export。Daily、Goal、Evidence、Overview 以及 UGC 有效成绩判断委托 Contract JS 0.1.1 的显式 read profiles；删除重复 scalar/crown/judgment/time decode 实现。产品 attendance、Goal lifecycle、来源排除、事实排序/归属及 Writer 验证/流程保留。
- JS 0.1.1 是只读兼容层增量；语言无关 schema v1.0、Python contract 0.1.0 的 schema/types/mapper/metadata 与基线字节相同。中心继续 Core 0.1.1 / Python Contract 0.1.0，客户端固定旧 Git pin。
- 最终 230 Node / 5 Python tests、TypeScript 与 generated bindings PASS。原源码冻结 85 numeric、8 crown/judgment、每个时区 10 timestamp 输入；严格 canonical Score 验证未放松。新读取未深拷贝历史或重建事实树。
- 百万记录直接对比 `060dc05 / 0.81.10`：三对交替 fresh-process 样本全部 DTO digest 相等，均只加载/规范化历史一次、读取 2,000 文件。中位数 4.627 → 4.767 秒（+3.02%）；最大 OS RSS 442.65 MiB；cgroup High/Max/OOM/OOM kill events 均为 0。主机无 `memory.peak`，774.15 MiB 为最高采样值，不标作峰值。一次 5.318 秒高于历史 initial Passport 5 秒目标，未宣称 P0 性能 PASS；Phase 6 Read Model 仍需改善大历史 request latency。另一个旧 0.81.9 oracle 的 19.018 → 4.671 秒反映已有 request reuse 优化，不算本次迁移收益。
- [整阶段实现证据](evidence/phase5-validation.json) 保存完整合成 benchmark 和源码 hash。fixture/临时文件已清理，无遗留 QA unit/监听器，无生产 DB、个人 userdata 读取或 mutation。首次性能命令误选旧 `/usr/bin/node`、一次采集不存在的 `memory.peak` 均记录为失败尝试；改为 Node 24.13.0 与明确的 unavailable metric 后重新完成，未绕过 memory runner。
- 版本按兼容重构 patch 为 0.81.11；package/lock 同步，无其他可见文案或 fallback 版本字符串。最终发布提交须由标准 memory build wrapper 调用 deploy script，随后验线上版本、服务进程与只读 HTTP/auth smoke。Gate 5 当前仍待生产验收。
