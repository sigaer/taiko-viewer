# Skill Passport Data Audit

审计日期：2026-09-21
审计范围：Viewer 当前 Growth / History / Weekly / Goal / Binding / Measurement 数据层
审计方式：代码审阅 + 生产数据库只读查询（`SELECT DATABASE() = taiko`）

## 结论

现有 `web_growth_measurements` 已具备 Skill Passport V1 所需字段、唯一约束和范围索引。可以直接建立每日代表点、measurement version segment、当前 segment 变化与 focus trajectory，不需要新表、字段变更或历史六维回算。

当前仓库 canonical Viewer 版本已经是 `0.72.0`，高于规格形成时的 `0.70.1` 基线。本次实现不得回退版本；发布版本应从当前 canonical version 继续递增。

## 实际 Schema

生产表：`web_growth_measurements`，InnoDB，`utf8mb4_0900_ai_ci`。

关键字段：

- 所有权：`user_id`、`binding_id`
- 测量身份：`score_revision`、`measurement_version`、`algorithm_version`、`model_revision`
- 测量值：`rating`、`dimensions_json`、`focus`、`sample_count`、`availability_state`
- 时间：`captured_at DATETIME(3)`、`created_at DATETIME(3)`

约束与索引：

- `PRIMARY (id)`
- `UNIQUE uniq_growth_measurement_revision (binding_id, score_revision, algorithm_version)`
- `INDEX idx_growth_measurement_owner_range (user_id, binding_id, captured_at)`

上述范围索引适合 current binding 的 30/90/180/365 天有界读取；唯一键继续保证同 score revision 的 Overview 重复访问为 no-op。

## 生产数据分布

只读查询时的实际结果：

- rows：28
- users / bindings：24 / 24
- captured range：2026-09-19 07:25:24.558Z → 2026-09-20 18:04:50.893Z
- Asia/Shanghai 业务日：3
- 每 binding 行数：min 1 / avg 1.17 / max 2
- 同一 binding、同一上海业务日存在多 revision 的日期：3
- 同日最大 revision 数：2
- 多 revision 日期包含的行数：6
- orphan：user 0 / binding 0 / owner mismatch 0

版本分布：

- `measurementVersion = 1`
- `algorithmVersion = growth-v1`
- 实际存在 3 个不同 `modelRevision`（19 / 8 / 1 行）

状态分布：

- ready：accuracy 12、speed 4、complex 4、rhythm 3、stamina 2
- limited：2
- insufficient：1

审计证明：每日取最后 measurement、limited/insufficient 保留以及 model revision break 均是当前真实数据所需的语义。

## 当前数据流

### Current Growth Overview

`getPlayerGrowthOverview(userId)`：

- 只解析 current binding；
- 最多调用一次当前 Growth Python compute；
- 返回 current Rating、六维、focus、Today Plan、active/recent Goal；
- 成功 compute 后按现有唯一键 upsert measurement；
- 同 revision 再次访问不会增加 measurement 频率。

Passport 应在自己的 endpoint 中只调用一次该服务，页面不得再独立请求 Overview。

### Growth History

`getGrowthHistory` 已提供 canonical score / Goal facts、measurement 与 coverage，但公开 History 范围上限为 90 天。Passport 应：

- measurement trajectory：直接按 current binding 从现有 measurement 表读取最长 365 天；
- recent milestones：复用 `getGrowthHistory`，固定最多最近 90 天；
- 不扩张 canonical raw-history 范围，也不重定义 PB / crown / Goal 事实。

### Goal 与 Weekly

- Goal facts 保留 attributed / observed / confirmed 时间语义。
- Weekly composer 已有严格 Goal-score 关联规则，可复用同 binding、song、difficulty、goal type、revision/before-after 的桥接原则。
- 不允许使用 `completedAt` 冒充 score day。

### Binding 与清理

- `getCurrentBindingRow` 是 Growth、History、Goal 的共同 current profile 边界。
- binding 删除会同时调用 `deleteMeasurementsForBinding`。
- user 删除会调用 `deleteMeasurementsForUser`。
- Passport 不需要增加 lifecycle hook。

## 当前 IA

- `/my` 为个人入口。
- `/my/weekly` 已上线，Home Growth 区和 Sidebar 已有 Weekly 入口。
- `pages/my.vue` 当前只识别 Weekly 子路由；新增 `/my/growth` 时需要把 nested-route 判断扩展为通用 Growth 子页。
- Passport 应与 Weekly 双向轻量链接，并在现有 Home Growth 入口组中增加文字链接，不新增大型首页区块。

## 实施边界

- `NO NEW TABLE`
- `NO ALTER web_growth_measurements`
- `NO HISTORICAL RECOMPUTE`
- `NO ALL-TIME MILESTONE CLAIM`
- measurement 最长 365 天，recent canonical facts 最长 90 天
- 同一上海业务日按 `capturedAt`、`id` 排序取最后一点
- segment key：`measurementVersion + algorithmVersion + modelRevision`
- 不跨 segment 连接曲线或计算 delta
- 页面同一时间只显示 Rating 或一个六维趋势

结论：`DATA AUDIT PASS — IMPLEMENTATION MAY PROCEED`。
