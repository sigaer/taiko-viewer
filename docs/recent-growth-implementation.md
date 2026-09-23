# Viewer 0.74.0 Recent Growth Implementation

日期：2026-09-23
上游结论：`docs/recent-growth-session-identifiability-audit.md` Decision C

## 产品边界

- 产品名称固定为“最近同步的变化”；不使用“这次游玩”“这一轮”或 Session claim。
- 只展示既有 canonical Growth facts 中的 PB、NG 减少、最大连段提升、Clear/FC/DF、Rank 与 Goal completion；不建立第二套成绩事实规则。
- Daily、Weekly、Passport、Goal Evaluation 与 Recommendation 的产品语义不变。
- 首次访问、游标丢失或算法升级时只展示最新可信 observation，不把历史积压包装成未读变化。

## Observation 与来源

- observation order 由 normalized observed instant、确定性文件顺序和 raw revision 共同生成。
- 只有 Wahlap / Hiroba authoritative observation 进入 L1 Recent。
- import、manual、content edit、dispatcher transfer、repair/backfill/migration、unknown source 与 counter regression 保持 L0 并 fail closed。
- destructive L0 / source switch 后的首个 authoritative full snapshot 只作为新基线；在新链形成前不会回退展示旧 observation。
- `writeUserdataWithHistory` 明确保留 `writer_source`，history 中的实际 writer 不再被旧 payload `_meta` 覆盖。

## Cursor 与 API

- `web_growth_recent_cursors` 是 account-level、per-binding acknowledged cursor；raw history / canonical facts 仍是 source of truth。
- `GET /api/account/growth/recent` 只读、authenticated、`private, no-store`，不因 prefetch 或失败渲染前移游标。
- `POST /api/account/growth/recent/ack` 只接受当前 profile 的最新可信 token，并以 owner/binding transaction lock 与 expected boundary 做 CAS。
- 同 token 重试幂等；其他设备已经前移或 profile 已切换时不会覆盖较新的边界。
- unbind 与 account deletion 显式清理 cursor；表不依赖 foreign key，便于既有隐私清理流程审计孤儿和 owner mismatch。

## Home 呈现

- Recent Growth 位于当前成长重点与下一步推荐之间。
- GET 与渲染分离；组件完成 DOM render 后才触发 ack POST。
- 新变化最多展开 5 条，其余以数量汇总；无事实、caught-up、loading 与 recoverable failure 都有稳定状态。
- 亮色/暗色、窄屏、键盘 focus、44px 操作目标与 reduced-motion 均保留。

## 验证记录

- Recent unit / HTTP contract：9 / 9 PASS，含 destructive L0 / source switch 后的新基线隔离。
- Daily / Growth replay：44 / 44 PASS。
- Growth History：9 / 9 PASS。
- Weekly：9 / 9 PASS。
- Passport：12 / 12 PASS。
- Session Identifiability audit fixtures：14 / 14 PASS。
- Goal unit / HTTP：46 / 46 PASS。
- isolated `_test` migration：schema PASS；foreign keys 0；orphans / owner mismatch 0。
- isolated `_test` Recent SQL + authenticated HTTP：2 / 2 PASS，覆盖 read-only GET、CAS POST、reload、multi-device 与 logout/login。
- isolated `_test` Goal SQL lifecycle：3 / 3 PASS，覆盖新增 cursor cleanup 回归。
- isolated `_test` authenticated browser：390×844 PASS；覆盖事实呈现、无横向溢出、44px 操作目标、render 后 ack、reload caught-up，以及 Growth Overview 失败时 Recent 独立降级。
- canonical Growth / History / Weekly / Passport / Goal / Session / Recent 合并回归：143 / 143 PASS。
- production Nuxt build：PASS（与标准部署脚本一致的 4 GiB Node heap，受控 `development-build.slice`）。

全仓 `nuxi typecheck` 仍受既存类型债影响，不能作为零错误 Gate；本次文件需要以过滤结果和 release build 为准。
