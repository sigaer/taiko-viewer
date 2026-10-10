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
