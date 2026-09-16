# Annual First-Run Closed Beta runbook

Viewer 0.68.1（0.68.0 功能发布后的恢复补丁）；Annual algorithm 固定 annual-observation-v4.5.0。本轮只验证首次体验，不调整冻结的年度模型、场景、Poster 或 Performance P2。

## 招募与波次

Wave 1 邀请 8–10 人（准备 12 个 single-use code）；Wave 1 无 P0/P1 后，再放出 Wave 2 的 20–30 人（准备 32 个 code）。目标有效参与者至少 30 人，不解释为统计显著性实验。

统一初始消息：

> 你获得了太鼓年度报告封闭测试资格。请直接打开网站开始体验。过程中尽量按照自己的理解完成操作；如果遇到无法继续的地方，请告诉我们，先不要询问具体点击路径。

单独私发网站 https://viewer.sakura-bot.cn 与一个邀请码。不要提前告知 Banner、个人中心、绑定按钮或年度报告直链。不得群发共享同一个 single-use code。

## 操作与安全

邀请使用已有数据库配置，通过 `taiko_viewer/scripts/create_annual_beta_invites.mjs` 生成；指定 `--count`、`--cohort wave1|wave2`、`--expires`、`--out /var/tmp/annual-beta-invites-<timestamp>.csv`，生产必须显式 `--production`。测试库须实际 SELECT DATABASE() 以 `_test` 结尾，并设置 TAIKO_ALLOW_TEST_DB_MUTATION=1。

CSV 以独占创建、0600 权限保存。只向指定测试者私发其 code；不粘贴到日志、Git、报告或公共聊天。数据库只存 SHA-256；验证不消耗，登录后原子兑换才消耗。CSV 丢失时停用未发出的邀请并生成替代，不尝试恢复明文。

Dashboard：`/admin/taiko/annual-beta`，沿用现有年度管理员权限。可停用未兑换邀请；停用邀请不自动撤销已发放资格。资格沿用 `web_annual_summary_access` 的 enabled/feature，紧急撤销须按现有数据库管理流程操作对应账号，不删除业务账号。

## 观察与提示

观察首页实际曝光 → 点击 → 验证 → 认证 → 兑换 → 绑定 → 同步 → 年度入口 → 构建 → 阅读 → Poster → 反馈。不要只统计 Annual click rate。

仅在测试者卡住时逐级提示，并在 participant 上记录最高提示等级及时间：

- T0：无提示。
- T1：“完成数据准备后，网站中已经开放了一项与你年度游玩记录有关的新内容。”
- T2：“可以在个人数据相关区域寻找年度报告。”
- T3：明确位置或直链。

Self-Service Activation 要求从首页 Hero 起步，有邀请兑换、认证、绑定、同步和报告打开事件，且最高提示级别小于 T3。已有内部账号的年度烟测不能当作新用户激活。

## 每日检查

在 Dashboard 检查漏斗、逐步转换、七项耗时 p50 与样本数、participant timeline、失败状态、insufficient_data 和反馈。耗时来自同一 participant 的事件时间；低样本/跨次重试需要结合时间线解释。

检查 annual API unexpected 5xx、构建失败与重复构建、服务重启及冷构建耗时。数据不足单独统计，不伪造 summary，不计作 sufficient-data 构建失败。失败状态跨刷新保留；更新数据后由用户明确重试。

反馈区分客观数据错误与主观描述偏好。复核时使用自动附带的 owner summary、算法版本、数据更新时间、locale 和 slide；不要求测试者提交密码、cookie、token 或全量 userdata。

## 严重性与推进

- P0：跨用户数据、错绑账号、认证/资格绕过、私有 API 越权。立即暂停发放邀请，保留证据，修复并复验。
- P1：注册/登录、有效兑换、绑定被阻断；同步永不结束；有充分数据却无法生成；致命渲染、持续错误核心指标、构建循环。暂停扩波，修复并复验。
- P2：可发现性、非阻塞文案/显示、轻微响应式问题。记录并集中处理，不持续重构。

Wave 2 前确认 Wave 1 全路径有实际记录且无未解决 P0/P1，数据不足与退出参与者分别列出。Beta 期间只修 P0/P1 和明确阻断 onboarding 的问题。

## 发布与数据规则

唯一部署入口 `bash scripts/deploy_forum_web.sh "<HEAD subject>"`，失败即停，不手动替换输出或重启绕过。称号关联文件已按 `annual-beta-title-relations-audit.md` 收敛到 Git HEAD；历史固定 SHA、stash/restore 例外不再适用。

邀请码、私有认证文件和测试证据保留在 /var/tmp，禁止纳入 Git。封闭测试结束后由运营决定反馈保留时间，并清理过期 pending/session 与未归属匿名数据；不把原始邀请码加入分析系统。
