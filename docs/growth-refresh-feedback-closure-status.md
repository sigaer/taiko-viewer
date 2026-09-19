# Growth Refresh / Feedback Closure — 实施与验收

任务规格：`Sakura_Taiko_Viewer_0.69.2_Growth_Refresh_Feedback_Closure.md`。

实施起点：`04ee9fe`，canonical version 已为 **0.69.2**（邀请码错误提示修正）。本次发布版本 **0.69.3**，不复用既有版本。

## 实现

- `AuthenticatedHome` 将 `usePlayerGrowth.refresh(identity)` 接入 Goal Surface。每个成功的 evaluate（completed / active / inconclusive）调用一次；不扩展 POST DTO，不在 POST 中计算 Growth。
- Overview GET 显式 `retry: 0`，避免 `$fetch` 在 503 等错误后暗中多发 GET。失败后的重试由用户显式触发。
- 初次读取使用 skeleton；刷新保留已有 UI，成功后整体替换 Overview，包括 Goal、scoreRevision、六维、focus、Today Plan、Daily Progress。
- POST 与 GET 分别检查身份和 generation；同步身份失效覆盖 A→B→A。组件卸载使旧响应失效。
- 刷新失败保留 POST 的临时完成状态；候选目标和“再选一首”均禁用，提供重新刷新。成功后以 fresh Overview 收敛。
- `composeGrowthFeedback` 仅做展示层事实去重。同 song / difficulty / fact type / before / after 才合并。冠次数先根据真实 baseline 和 completion evidence 转为冠等级；缺证据不补零。Clear→FC、FC→DF 显示实际更高冠。其他事实保留，Daily DTO 不修改。
- 没有 schema / migration、Goal 判定、Daily extraction、推荐排序、六维算法变更；不强制轮换 focus 或推荐。

## Gate 记录（发布前）

- 原有 Goal / Daily / 历史回放加新增 composable / fact 测试：97 PASS。
- 最终真实 Surface setup、locale、version、首页状态与刷新测试：27 PASS；定向 TypeScript 检查 PASS。
- 真实 SQL / authenticated lifecycle：3 PASS；隔离库 `taiko_annual_poster_test`，显式 mutation opt-in；正式 helper cleanup，orphan=0。新增断言 POST 不 compute、随后一次 GET 只 compute 一次。
- 首次预发布快照因缺少外部 Annual schema，在 Nuxt 编译前停止；按标准部署的依赖布局复制 schema 后标准 build PASS。未改生成器或绕过检查。
- 首次浏览器故障注入捕获 `$fetch` 隐式重试（多一次 GET）；显式禁用后重新标准 build PASS。
- Browser matrix：48 PASS（6 types × zh/ja × mobile/desktop × light/dark）。每组覆盖 active/inconclusive 刷新、completed 后刷新失败与重试、R2 无 reload 下一 Goal、A/B 隔离、同事实去重与额外事实保留。峰值 752,320,512 bytes，OOM/oom_kill=0；3197 listener 已退出。
- 原推荐算法回归：54 PASS。使用已有系统 Python/pytest；业务虚拟环境不含 pytest，未安装或修改依赖。
- Production no-reload smoke、性能、最终清理：PENDING；发布前检查已通过。

证据目录：`/var/tmp/growth-refresh/`。尚未宣布反馈闭环完成。
