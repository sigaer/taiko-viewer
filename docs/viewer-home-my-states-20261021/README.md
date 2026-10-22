# Viewer 0.87.5：首页状态与 My Taiko

基于远程 main `81635515ac055a18ff02ec402662d201137069e0`（0.87.4），独立工作区 `/var/tmp/viewer-home-my-states-20261021`、分支 `fix/viewer-home-my-states-20261021`。原设计工作区、WIP 和仓库外备份保留。本次是现有展示与状态恢复的兼容修正，使用 patch 0.87.5；没有新读模型或 Contract 升级。收尾沿用 10 月 22 日已部署的 Node.js 24.22.1／Undici 7.30.1，避免重建时回退安全修复。

## 实际文件与状态变化

| 文件 | 变化 |
| --- | --- |
| `taiko_viewer/pages/index.vue`、`composables/useHomeState.ts` | 游客／未绑定／无有效成绩／就绪保留原判定；加载和认证／绑定／成绩失败独立，错误有重试且公共歌曲、活动、工具仍可用。缓存纳入账号、绑定与同步通知；请求合并、代次保护、停用／卸载取消提交 |
| `composables/useAccountAuthStatus.ts`、`useAccountState.ts` | 共享加载、确认游客、已登录、失败状态；强制重试可恢复；同一 Nuxt app 初始读取合并，旧成功／失败不能覆盖新身份；身份观察器随 app 清理 |
| `composables/useViewerApiFetch.ts` | 原绑定通知保留；已有同步写请求返回后通知首页缓存失效，传输失败仍抛错。没有为状态刷新添加无条件重复请求，没有改同步成功判定 |
| `composables/usePlayerGrowth.ts`、`useRecentGrowth.ts` | 概览与近期分别保留结果、错误及重试；绑定未知期间不读个人数据；KeepAlive 停用时丢弃迟到结果，恢复只补未完成或已失效的读取 |
| `components/home/AuthenticatedHome.vue`、`PlayerGrowthSurface.vue` | 展示概览首次失败和刷新失败的恢复入口；目标处理器保持原样，仅新增概览反馈 props |
| `components/home/RecentGrowth.vue` | 待呈现、失败和停用时不触发自动确认；同 token 已呈现不重复发送；取消未执行帧。确认 transport 的身份代次、重复 token、409 和迟到响应受保护 |
| `pages/my/index.vue`、`locales/zh.json`、`locales/ja.json` | 九个原入口按成长练习／成绩图表／账号年度记录分组，平面轻分隔；失败不显示游客 CTA，加载与强制重试明确，入口一直保留 |
| `tests/homeDeepState.test.mjs`、`tests/fixtures/homeStateHarness.mjs` | 实际 composable、Vue SFC 和 KeepAlive 回归；API 仅为可控 Promise，无真实账号或数据库 |
| `preview/song-detail/review/home_states.*`、`home_state_interactions.py`、`home_state_report.py`、`server/utils/home-deep-fixtures.ts`、预览配置及只读 middleware | 真实 Nuxt 路由、合成输入、同输入对照和隔离交互；独立本地入口，不进入业务构建 |

首页共享歌曲条目和普通推荐直接复用 0.87.4；目标推荐 tab、来源校验、目标创建条件、成绩判定、时间归属与事实去重均不变。`components/my-taiko/Overview.vue` 及 admission 不变，没有读取新 API。公共主题、容器、20px 手机边距、底部导航和侧栏不变。唯一迁移表是 [migration.md](../viewer-lightness-20261020/migration.md)。

## 复现与验证层级

0.87.4 对照源码复现四条断言失败：认证初始读取未合并、绑定广播后旧首页绑定仍保留、卸载后确认 409 又触发读取，以及 KeepAlive 停用后迟到确认仍读取。记录在外置 `baseline-regressions.log`，不计为通过。真实路由另外确认全局 NuxtPage 启用了 KeepAlive：离开首页会停用页面，而非立即卸载；本次将暂停、恢复与请求保护补到这一条实际路径，保留缓存而不无条件重读。

本批浏览器用实际登录表单、资料切换绑定按钮和同步按钮返回首页，写请求均由 Playwright route 受控返回。覆盖错误／重试、旧绑定清空、迟到读取、同步失败不报成功、概览和近期独立失败、目标失败恢复、确认 409 及停用后迟到响应。My Taiko 覆盖九路由、键盘及手机导航、确认游客、认证失败、重试加载、重试失败和恢复、新身份不受旧失败影响。

自动确认隔离分三层：真实 SFC／composable 单测检查相同 token、身份往返、409、卸载和 KeepAlive；浏览器拦截真实组件发出的 POST，只确认合成身份及 token；手动本地预览只对 `home-deep` 的固定合成 token 返回无持久化响应，其他业务写入仍拒绝。所有层级都不代理生产后端。线上仅匿名只读检查，并拦截所有非读取请求，真实账号、成绩、绑定、目标及近期事实写入为 **0**。写入被拒绝不算业务成功证据。

每页三组对照：1440 浅色中文、390 浅色中文、414 暗色日文。正常样本有六维、推荐三态、今日事实和近期记录，My Taiko 九入口完整。另补 390px 两页认证失败前后对照；正常输入 JSON 哈希及失败的 HTTP 状态／错误语义逐组核对，Linux Chromium 模拟视口，不代表真机。

## 可复跑预览

在本工作区准备锁定依赖后，使用已有资源包装启动；打开 `http://127.0.0.1:3208/__home-states`，从入口选择合成状态、语言和主题进入真实 `/` 与 `/my`：

```sh
bash scripts/memory/run_dev.sh /usr/bin/env \
  VIEWER_BATCH2_EVIDENCE=/home/sigaer/taiko/qa-vault/evidence/viewer-home-my-states-20261021 \
  /www/server/nvm/versions/node/v24.13.0/bin/node \
  taiko_viewer/node_modules/@nuxt/cli/bin/nuxi.mjs dev preview/song-detail \
  --host 127.0.0.1 --port 3208 --no-fork --dotenv preview/song-detail/.env.preview-empty
```

浏览器复跑：`bash scripts/memory/run_qa.sh /usr/bin/env VIEWER_REVIEW_OUT=<仓库外目录> /usr/bin/python3 preview/song-detail/review/home_states.py after --checks`。基线加 `before --source <0.87.4工作区>/taiko_viewer`；`after --entry-only` 检查入口。CI 列表和 Contract 检查复用 `review/growth_tests.py`（不传旧批次 baseline 参数）。QA、预览和构建串行使用原预算；构建通过正常业务 `npm run build` 入口，显式传入已验证代理，不改全局网络。

仓库工作流仅 CI 与原 0.85.0 tag 的 GitHub release 发布，未发现主机服务／timer／cron 或 Git hook 自动部署。当前 GitHub 连接不提供管理级仓外 webhook 列表，GET 被连接器拒绝；不据此宣称核查了仓外配置。正式部署仍只使用现有受控脚本。

原始图、运行记录和生成产物位于仓库外 `/home/sigaer/taiko/qa-vault/evidence/viewer-home-my-states-20261021`，Git 只保留源码、可复用 fixture／测试及本说明。最终验证数、证据归档 SHA、候选和发布状态由外置 `validation.json`、`evidence-manifest.json`、`candidate-audit.json`、`delivery.json` 绑定；未完成的发布步骤不预先标为通过。

## 候选验证记录

最终本地 CI 同组 **201／201** 项测试、Contract 生成及跨语言检查通过；六组正常与两组认证失败同输入前后对照、去重后 56 项浏览器检查、真实预览入口通过，页面错误为 0。额外检查手机末项完整点击区与焦点避开底部导航。目标处理器、共享歌曲条目、My Taiko admission、公共基础和 API／Contract／历史规则均与基线核对一致。

本机正常生产构建在原资源包装的准入阶段被拒绝：可用内存未达到 `.25 × MemTotal + 5 GiB`，未开始编译，不计为构建通过。独立 PR 继续执行原 CI 的正常生产构建；最终 CI、审查和受控部署结果以 PR 与外置交付记录为准。资源预算、准入及部署脚本没有改动。

证据归档 `evidence.tar.gz` SHA-256：`396189852c57f9ce4af57f474084235a0f00186566016c401bcc365ae2845e10`。外置 `index.html` 可离线查看八组前后图；`evidence-manifest.json` 绑定实际源码哈希和逐文件证据。

## 2026-10-22 收尾

网站已由独立安全修复恢复至 0.87.4，应用源码仍为本批基线，但运行时与制品已是 Node.js 24.22.1、内置及 npm Undici 7.30.1。本分支仅复用该安全修复已审查的 Undici 精确版本、下载地址和完整性值，变更 package、锁文件根依赖、Undici 的两处锁定条目；其他依赖不变。不会重新部署旧 Node.js 或 Undici 7.25.0。

使用这套运行时和安全依赖重新执行当前 CI 同组测试：**201／201**，Contract 生成与跨语言检查通过，隔离业务写入 0。UI 组件与原截图对应源码未变，八组对照和 56 项浏览器检查继续作为展示证据；新的测试、CI、制品、配置和线上只读结果归档在原证据目录的 `closeout-20261022/`，不覆盖首轮记录。

用户明确授权本次忽略内存限制。若执行本地发布，仅对该次构建的 MemAvailable 准入作临时豁免；仍保留原构建 cgroup 上限、CPU／超时、串行互斥及失败即停止，仓库的资源包装和部署脚本不变。正式结果以最终候选对应 CI、审查和仓库外交付记录为准。0.87.4 安全制品和此前回滚产物均保留；应用启动正常后台写入与验收主动写入分别记录，不将线上启动声称为零写入。
