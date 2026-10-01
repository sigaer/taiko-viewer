# 年度报告发布验收 — 2026-09-29

**续轮当前结论：LIMITED（受控合成业务及有界并发已执行，非无条件发布 PASS）。** 最终候选与续轮证据见文末“2026-09-29 续轮”。

**以下为 0.75.8 首轮历史结论：BLOCKED。** 已复现并修复三处低高度移动端裁剪；前端隔离回归与后端真实业务验收必须分开。尚不能批准正式上线：没有三类真实测试账户的鉴权→生成→完整浏览→实际分享闭环，没有已核实全部边界的负载环境，也没有真实 iPhone 证据和发布流量目标。

## 工作区、版本与证据

- 实际仓库 `/home/sigaer/taiko/taiko-forum`，viewer 子目录 `taiko_viewer`，基线 `69531e3`（0.75.7），本次候选 0.75.8。独立仓库，不同步 Sakura_bot。
- 保留已有 `assets/data/title_song_relations.json` 修改和三个未跟踪文档；不将其纳入本次提交。构建快照包含当前 title-song 文件，哈希单独保存。
- 时间：2026-09-29，Asia/Shanghai；原始证据目录 [test-results/annual-readiness-20260929](../test-results/annual-readiness-20260929)（忽略目录的软链接，实际 `/var/tmp/annual-readiness-20260929`）。浏览器截图/逐元素几何见该目录 `browser-before`、`browser-final`。
- 全部重型 QA 通过 `../scripts/memory/run_qa.sh`：2/3GiB High/Max、CPU 200%、15分钟硬截止、整个子进程树退出清理；构建与浏览器串行。无生产重启、缓存清理、真实账户写入、第三方负载或部署。
- Node 24.13.0，项目 Nuxt 3.21.11、Playwright-core 1.61.1；使用本机 Chromium。无 WebKit/真实 iPhone 结果。

## 核实的实际链路

| 项目 | 当前实现与来源 |
|---|---|
| 页面 | `pages/account/version-summary.vue` → `StoryPlayer.vue` → `useAnnualPages.ts`，21页，最终两页 `final`/`poster`；不是历史23页 |
| 身份与入口 | `stv_session`；`requireAccountAnnualSummaryUser` 检查登录及年度访问资格；GET `/api/account/annual-summaries/annual_2026` 返回 envelope，缺数据由页面 POST `.../build` 后轮询 `/api/account/annual-summary-jobs/:jobId` |
| 数据 | `server/services/account/annual-summary/index.ts` 的 envelope 读取已持久化 summary，`safeReadSummary` 核对 schema/窗口；build 经持久化 job、admission 调 Python；schema=4，算法 `annual-observation-v4.5.1`，窗口 2025-10-09～2026-09-30（357天） |
| 缓存 | `runtime.ts:getAnnualCacheRoot/getAnnualSummaryPaths`：默认 `.data/account-cache/annual-summary-v4/summaries/<sha256(userId:bindingId)前24位>/annual_2026/<summaryId>/summary.json`；DB 按 user/binding/version/fingerprint 查找。生成 single-flight key 包含 taikoId、version、输入 revision；只读结果不等于观测到真实计算次数 |
| 真实分享 | Poster 的“保存图片”调用 POST `/api/account/annual-summaries/{summaryId}/share-card`，服务端 renderer 生成，再下载 `/api/account/annual-share-cards/{id}/image`；1080×1872 PNG，底部224px推广区；默认 `syncCommunity:false` 可避免社区写入。不同于旧 `posters` job/30天公开 token 分享 |
| 分享缓存/队列 | `index.ts:getShareCardFingerprint` 包含输入指纹、语言、尺寸和 `share-card-v3-promo-footer`；保存到 summary 同目录 `share-cards/<fingerprint>.png`；renderer 经公共 admission，常量限制1活跃/8排队，generator 2活跃（这是代码配置，不是本轮吞吐量证据） |
| 静态资源 | 本地 public 字体/背景、Nuxt hash chunk，曲绘经 `utils/songCover.ts` 使用 static.sakura-bot.cn 或 texture API；浏览器隔离回归拦截曲绘为本地图片并阻断外部请求，不代表 CDN/真实装扮可用性 |
| 部署与缓存 | 生产 `taiko-viewer.service` PID 3542853，0次重启，MemoryMax=2GiB，主服务单进程，generator/renderer 独立 systemd worker；共机。入口脚本仅 `scripts/deploy_forum_web.sh`，`.output.previous/server/index.mjs` 存在；只检查回滚步骤，没有回滚演练。公开分享/图片 API 设置 private,no-store；Nginx 仓库模板对 hash资源使用 immutable，不把模板当作实际响应头证据 |

## 安全检查及缺陷

1. **weekday P0**：375×567 下，原内容层 `height:max(100%,216.18vw)` 高约811px，footer 实际文字约 y=607～649，遭祖先裁剪。改为沿用 `--annual-stage-height`，独立计算与原设计一致的内容宽度，仅收敛纵向高度；低高度调整标题上边距。文案、字体大小、页面宽度比例保留。
2. **FavoriteSong P0**：375×567 最后一句底边约586px，320×568也裁剪。只在 ≤600px 竖屏将曲绘 top 改116px、模块 gap 改8px，保留曲绘大小和字体。
3. **speedProfile P1**：375×667 下底部两行文字约 y=665～701，被 scene 裁剪。仅 ≤740px 时把 footer 锚定内容区底部并加局部浅色底；同时提高 lead 文字层级并加浅底，避免装饰城市覆盖文字，保持文字和插画宽度。
4. **E2E 安全高风险**：原脚本默认读 `/etc/taiko-viewer.env`，在校验前启动 Nitro，并删除 stale 测试账户、扫描真实 userdata。现在缺显式配置/写入 opt-in/测试库/独立 realpath 根目录/合成数据与外发阻断声明即拒绝；实际 SELECT DATABASE 和受限 grants 核对移到服务启动前，禁止外部 E2E URL。声明本身不构成完整隔离证明。
5. **测试误报修复**：既有 Vite harness 用 `value || key`，把合法空翻译渲染为 key，改为 `??`；分享页是可内部滚动布局，补充滚动到保存按钮及 Playwright 点击 trial；有完整 title 属性的设计性 line-clamp 单列，不冒充文案丢失修复。测试未点击实际分享 POST。

## 实际运行

最终执行结果见文末记录；中途失败与取消日志一并保留。复现入口（从 viewer 目录）：

```bash
bash ../scripts/memory/run_qa.sh "$(command -v npm)" run test:annual
bash ../scripts/memory/run_qa.sh "$(command -v npm)" run test:annual:capacity
bash ../scripts/memory/run_qa.sh "$(command -v node)" --test tests/annualE2eSafety.test.mjs
bash ../scripts/memory/run_qa.sh /usr/bin/env ANNUAL_READINESS=1 ANNUAL_MOTION_LABEL=readiness-final ANNUAL_CHROMIUM_PATH=/usr/bin/chromium "$(command -v node)" scripts/verify_annual_motion.mjs
bash ../scripts/memory/run_qa.sh "$(command -v node)" scripts/verify_annual_share_card_promo.mjs
```

`ANNUAL_READINESS=1` 复用既有 harness，先 Vite production build，再 preview 固定 bundle；不是 Nuxt 鉴权业务端到端测试，也不是 dev server 容量结论。普通样本源于现有 `annual-summary.sample.json`；稀疏为去掉可选数据的 UI fixture，高数值为999999演奏/9999曲、七日大计数和长昵称的 UI fixture。后者**不是**真实大量历史事件的计算压力样本。原 fixture 版本日期是历史样本，不能据此证明线上窗口数据正确。

浏览器覆盖21页；375×567、375×667、320×568、390×844；weekday 返回、缩高/恢复；FavoriteSong/final/poster；三轮顺序遍历并卸载/重挂载、约30次快速切页（fixture直接注入且started=true，不是实际入口或重播按钮业务闭环）；记录可见文字 Range、祖先 overflow、weekday 模块重叠、按钮中心点命中、保存按钮滚动可达及截图。卸载时 GSAP ticker/WebGL context 同口径采样；浏览器粗粒度 heap 只记录，不能证明无泄漏。

## 容量与业务阻塞矩阵

| 项目 | 结果 | 实际量/边界 |
|---|---|---|
| 热缓存 1/s×2min、3/s×3min、5/s×5min | BLOCKED | 业务请求0；P95/P99/成功率/实际到达率/恢复均 N/A |
| ≥30不同用户首次生成 | BLOCKED | 无已准备并核实隔离的30合成冷身份，实际冷计算0 |
| 同用户2/5同时首次生成 | BLOCKED | 真实计算次数/排队未观测；admission单测不替代真实生成 |
| 10/s短突发→1/s恢复 | BLOCKED | 未满足前置热档与全部隔离边界，不发流量 |
| 两身份真实分享、重复点击、图片GET解码 | BLOCKED | 组件导出截图不算服务端真实分享；系统分享/保存也未测 |
| 三类真实用户鉴权→自己的summary→最终页→分享 | BLOCKED | 前端合成注入不能验证身份归属、真实关键统计或服务端生成 |
| 超时/短离线/图片失败业务恢复 | NOT_RUN | 没有已隔离业务服务；不注入生产故障 |
| 真实iPhone Safari与主要内置浏览器 | NOT_RUN | 无设备；Chromium/WebKit均不能替代真机 |
| 长稳态、出口/CDN带宽、极限容量、实际回滚 | NOT_RUN | 本轮无对应运行证据 |

新增 [负载说明](../loadtest/annual-readiness.md)、[脚本](../loadtest/annual-readiness.mjs)、[独立监督入口](../loadtest/run-annual-readiness.py)、[最小配置](../loadtest/annual-readiness.example.json)。无 k6，交付的是明确标注的 Node 有界开放时隙探测；`droppedSlots` 不冒充 `k6 dropped_iterations`。脚本包含实际路由/身份校验/有限轮询/PNG解码，尚未执行正向业务路径；仅语法和拒绝路径测试不算容量通过。

隔离解除条件：实际测试库+最小权限（本轮只读复核）；独立合成 userdata/缓存/admission；worker资源、对象存储、队列及外发阻断的可审计证明；30冷身份、2热身份及2个独立并发冷 fixture；可靠服务端计算次数/队列/资源监控。发现旧工作树测试凭据不等于这些条件已经满足。

真机最短复现：Safari工具栏展开→打开年度→weekday→查看七行与底部两段文案→前后翻页返回→工具栏收起/展开→FavoriteSong末句→final→poster滚动到保存→连续点击/实际保存→后台/锁屏返回→再播放一轮。记录机型、iOS版本、屏幕录像及保存的PNG。

## 发布边界

不扩大公开入口、不部署、不调整限流/worker数量。先补真实业务闭环与iPhone证据，再在已隔离环境从单事务/低档开始；有发布目标才能判断探测档位是否足够。正式放量建议保留分批入口和停止新生成的操作能力，持续看失败率/等待时间/积压；出现故障按现有部署脚本及已留存上一版输出回退。旧页面请求已删除chunk的兼容性尚未演练，不能宣称回滚或新旧资源切换已通过。

## 最终执行记录

| 验证 | 实际结果与证据 |
|---|---|
| 契约/类型生成同步 | PASS，21页、zh/ja、schema4；`final-checks.log`；没有另称已完成全项目 vue-tsc 类型检查 |
| 年度单测 | 29/29 PASS，0失败 |
| admission/安全/引用测试 | 14/14 PASS，0失败；包含隔离临时目录的跨进程测试及模拟队列，**不是容量压测** |
| 新增 E2E 安全测试 | 3/3 PASS：拒绝生产默认配置、外部服务、realpath逃逸、实际生产库身份 |
| 拒绝危险启动 | E2E、无配置负载入口、未设置 serverPid 的监督入口均非零退出；`e2e-safety.log`/`load-safety.log`/`supervisor-safety.log`；无业务流量 |
| 实际测试库核验 | PASS，只读 SELECT DATABASE/CURRENT_USER/SHOW GRANTS；`taiko_annual_poster_test`、`taiko_viewer_test@127.0.0.1`，mutations=0；没有把旧 Phase B 记录当作当前证据 |
| 第一轮修复前浏览器 | 44次测量，保留失败图；其中翻译空串误报和滚动/省略误判有明确归因，不把它们算成产品修复 |
| 完整前端样本回归 | 70次测量：普通21页、稀疏5页、高数值21页与视口/操作项；发现 speedProfile 真实裁剪以及一处设计性省略误判；该轮退出1，**不标PASS** |
| 专项确认 | 55/55 PASS，4种视口、weekday回返/缩高恢复、实际平衡/工作日长文案分支、保存按钮滚动点击trial；`browser-confirmation/readiness.json` |
| 最终代码核心复测 | 25/25 PASS，最终 SFC 的21页核心遍历+speedProfile四视口，0未处理JS异常；`browser-release-core/readiness.json`（关闭 import.meta.dev 的固定bundle）及 `last-qa.log` |
| 重播/快速切页 | 完整样本轮完成3次顺序遍历+卸载重挂载及30次快速点击；卸载后ticker均1、WebGL contexts均0，heap粗粒度值均11,200,000 bytes。随后仅修改speedProfile CSS；最后25项使用修改后bundle。不能据此宣称GPU动画或长期无泄漏 |
| 分享图组件导出 | 5/5 PASS：预览、内容基线、中文/日文1080×1872、缺QR回退；PNG可解码、无损对比原1080×1648内容区哈希相同，brokenImages=0；`share-export/report.json`。使用合成图块/装扮，非真实账户服务端分享结果 |

中途一轮旧补丁浏览器被主动取消（exit143），以重建包含新发现修复的固定bundle；该轮不计成功。所有最终脚本/页面变更的 SHA256 见 `final-source-manifest.json`；构建日志列出固定 Vite chunk hash。完整回归有 `WebGL2 unavailable` 提示并使用降级路径，**GPU性能、真实WebGL动画质量未证明**。

资源：宿主机初始 MemAvailable 18,446MiB，Swap已用4,189MiB，磁盘可用39GiB，memory PSI full avg10=0。浏览器cgroup三次观测为1,303,289,856 / 1,593,352,192 / 1,646,067,712 bytes，采样最大约1.53GiB；这不是精确峰值（当前内核未提供该cgroup memory.peak）。观测时memory.events的high/max/oom/oom_kill均0。生产PID仍3542853、NRestarts仍0；没有吞吐量或线上延迟观测可用来宣称共机容量。

所有协议档位：started/completed/HTTP请求量均0；成功率、P95/P99、队列恢复、真实生成次数、dropped iterations为N/A。不得把拒绝路径的0错误或浏览器组件结果换算成上线容量。

关键截图：

- [weekday修复前375×567](../test-results/annual-readiness-20260929/browser-before/375x567-weekday.png) / [修复后](../test-results/annual-readiness-20260929/browser-confirmation/375x567-weekday.png)
- [FavoriteSong修复前](../test-results/annual-readiness-20260929/browser-before/375x567-favorite.png) / [修复后](../test-results/annual-readiness-20260929/browser-confirmation/375x567-favorite.png)
- [speedProfile修复前](../test-results/annual-readiness-20260929/browser-final/high-speedProfile.png) / [最终修复后](../test-results/annual-readiness-20260929/browser-release-core/final-375x567-speedProfile.png)
- [最终称号页](../test-results/annual-readiness-20260929/browser-release-core/normal-390x844-final.png)、[低高度保存按钮可达](../test-results/annual-readiness-20260929/browser-confirmation/375x567-poster-save-visible.png)、[中文组件导出PNG](../test-results/annual-readiness-20260929/share-export/export-zh.png)

## 独立 Nuxt 构建及产物核查

- 2026-09-29 02:04～02:07 CST，`build.exit=0`；客户端32.46秒、SSR27.55秒，Nitro完成，输出60.8MB。候选版本0.75.8，build ID `a3010a17-cc9d-4cc6-81d7-73694e4f89cc`。产物位于 `/var/tmp/annual-readiness-build/workspace/taiko-forum/taiko_viewer/.output`，没有替换运行中的 `.output`。
- **构建结论 LIMITED**：编译/打包完成，但8条公开页预渲染调用 `auth/me` 时出现数据库鉴权拒绝（没有给构建注入生产凭据）；不能把退出0等同鉴权/业务启动通过。另有大chunk、PWA `_payload.json` glob未命中的警告，均保留在 `build.log`。这些构建内部GET与被阻塞的正常负载事务分开记账。
- 实际检查client manifest引用的265个文件，共4,736,407 bytes，缺失0；`build-artifacts.json` 保存build ID、entry SHA256。此值是产物文件总大小，不是首屏传输量；HTML实际响应头、CDN冷热缓存和旧页跨版本chunk仍NOT_RUN。
- 构建取基线git archive，覆盖本轮三个SFC、package/lock与当前title_song_relations，复制当前public资源，依赖软链接已有node_modules；没有安装或升级依赖。初始执行证据从01:46:35 CST开始，完整运行日志及结束时间以原始文件时间为准。

实际构建命令：

```bash
bash ../scripts/memory/run_build.sh /bin/bash /var/tmp/annual-readiness-20260929/build.sh
# build.sh 在上述独立快照内设置 NODE_OPTIONS=--max-old-space-size=4096 后执行 npm run build
```

此次不是生产发布：用户明确要求不默认部署，因此没有执行会切换输出/重启的部署脚本。下一次正式发布仍须走仓库规定的标准入口。


## 2026-09-29 续轮：独立实例、真实链路与有界并发

本节保留上轮 BLOCKED 记录，单独记录续轮，旧组件测试不作为本轮协议/容量证据。运行原始资料：`/var/tmp/annual-test-continuation-20260929`（0.75.9）与 `/var/tmp/annual-test-final-20260929`（0.75.10）。

### 候选与输入一致性

- 最终候选：`f48a63b08e69060a8af60c1abe36d879f01283ca`，应用 `0.75.10`，build ID `e60ee0ac-0822-432c-99f2-4b52afd4659d`。从纯 Git archive 构建，无工作区覆盖。后续测试脚本/文档提交不会改变此候选应用产物。
- `assets/data/title_song_relations.json` 使用提交版本，SHA256 `a1b304a2370c3ec4c18be5553d2b85f93d548edd1337f3d30cac065339a17985`；用户原有未提交修改保留且排除。原有未跟踪审计/执行文档未提交。
- `evidence/input-manifest.json` 列出源码、锁文件、public、schema、独立复制的公开 Python 计算代码及曲库文件哈希；`artifact-manifest.json` 列出完整 `.output` 文件哈希；`dependency-versions.json` 记录现有安装锁哈希与依赖/worker 版本。Python 3.11.4、Chromium 113.0.5672.126、MySQL 8.0.24；没有升级依赖。
- 年度算法保持 `annual-observation-v4.5.1`，窗口保持 2025-10-09～2026-09-30。分享 renderer revision 更新为 `share-card-v4-static-capture`。负载结果包含候选 commit/build ID，并通过实际 HTTP build metadata 核对；脚本哈希按任务配置记录。
- 旧候选 `11ee876 / 0.75.9` 的普通/稀疏/高量生成、2/3 冷并发、2/5 去重、分享并发、1/s 与 3/s 结果保留在 continuation 目录，**不冒充最终构建复测**。

### 环境隔离与实际副作用边界

原共享测试库仍有 48 个账号和一个 queued job；候选启动会自动恢复任务和清理过期数据，因此没有使用它启动服务。现有受限账号无法另建库，本机生产 MySQL root 免密连接也被拒绝。随后复用现有 MySQL 可执行文件，以 `--no-defaults` 和全新 datadir 建立独立实例，解决了第一组并发的实际环境阻塞，无需生产凭据或管理员追加权限。

- 独立实例仅绑定 `127.0.0.1:33179`，候选仅绑定 `127.0.0.1:33180`。实际 `@@datadir`、`@@port`、`SELECT DATABASE()`、`CURRENT_USER()`、`SHOW GRANTS` 均核验，应用账号仅有 `taiko_annual_readiness_test.*` 权限。新库初始 schema 需要 REFERENCES，已只给此库补足；复用候选 `ensureAccountSchema` 和显式 growth cursor migration，不复制生产表数据。
- 每轮独立 userdata、cache、admission、account-cache、tmp、会话和签名秘密；秘密 0600、目录在 `/var/tmp/annual-test-*`。42 个账号全部合成，访问资格由真实授权表提供，`NODE_ENV=production`，没有 E2E 鉴权旁路。
- 候选与独立 systemd Python/Chromium worker 设置 `IPAddressDeny=any` / `IPAddressAllow=localhost`、只读系统及仅测试根目录可写，并屏蔽生产 userdata/config/env。实际 cgroup BPF attachment、worker PID/命令、MemoryMax、读写目录和队列由 observations 保存。对外连接探测返回 EAGAIN，单独不能证明阻断；内核 BPF_PROG_QUERY 返回实际 ingress/egress 程序 ID，不能只靠环境变量声明。
- Python generator 保持 2 active、renderer 保持 1 active，共用现有持久 admission。资源预算未提高；测试由 `run_qa.sh` 的 15 分钟/2 核/3GiB 任务分批执行，worker 保留原独立内存/寿命上限。新会话服务器与 QA unit 绑定且有 850 秒硬寿命。
- 分享请求全部 `syncCommunity:false`；未触发社区写入、邮件、生产队列、真实用户同步。对象存储/外部队列为 NOT_APPLICABLE，真实生成结果写到本轮本地缓存。测试使用独立 MySQL，生产共享数据库不承载本轮压力。
- 曲绘及装扮在隔离环境中使用现有降级图形。缺少 MyDon 依赖产生资源接口错误并进入 fallback，不能把页面无 JS 异常或 PNG 成功解释为真实 CDN/装扮通过。

### 修复和失败记录

1. **匿名预渲染鉴权**：原调用链为公开页 layout → `useAccountAuthStatus` → `auth/me` → `getAccountUserFromEvent` → 无 cookie 也先 `ensureAccountSchema`。将无 token 返回提前，保留有会话时的正式数据库校验及错误。三个行为回归验证无 cookie 不触库、有会话数据库异常仍抛出、有效/过期会话行为不变。新构建未注入数据库凭据，8 路预渲染阶段不再出现原鉴权拒绝，原公开页/SSR入口保留。
2. **真实导出 PNG 缺字**：0.75.9 的日文服务端图片出现随机缺字，但 DOM 文本/几何完整。相同页面、截图参数下去掉 `#dynamic-line` 后恢复；单独变更字体或截图参数不能稳定解决。内部导出路由现在跳过全站动态连线与点击爱心初始化，并提升缓存 revision，防止复用旧导出。没有改字号、主体宽度、文案或强制全屏。最终候选真实保存 PNG 重新检查。
3. **测试适配失败保留**：初始浏览器只有手机视口、未设移动 UA，触发既有移动入口重定向；其次开始按钮已进入第 2 页，旧循环多翻一页；均修正脚本后独立重跑。监控模块曾有语法错误，未发送业务流量的该轮标失败。数据不足 fixture 最初完全缺文件导致 404，随后改为受控 partial 当前记录，不能将初次失败记为通过。
4. 0.75.10 的 8 项鉴权/导出回归与 `verify_annual_contract.mjs` 通过；后者确认 21 页定义、zh/ja、schema 4。运行态实际可见页数由真实生成 sections 决定，不强行注入缺失页面。

### 公开页运行态保留问题

匿名访问 8 路均 HTTP 200 且 `auth/me.authenticated=false`；持有效合成会话访问同样 8 路，接口均识别 user 1。`/grade/2023`、`/grade/2024`、`/settings`、`/about` 的侧栏仍显示匿名状态，**公开页登录展示验收未通过**。静态 HTML 的 `__NUXT_DATA__` 含 `account-user=null`、`account-user-loaded=true`；现有 `useAccountAuthStatus.resolveAccountUser()` 命中 loaded 后不重取会话。该 composable 与 `SidebarNav` 不在本轮修复中，历史提交为 `d7f8ffe / 0.49.1`。这是缓存 hydration 状态的展示缺陷，未观察到鉴权绕过或账户数据串用；实际年度入口、受保护 API 和越权拒绝另有成功证据。按本轮只修发布阻断/高风险的范围保留为 P2，不扩改全站会话状态。构建期鉴权错误已解除，不能因此把整个公共登录体验标 PASS。

### 最终候选的实际执行结果

| 场景 | started / completed / failed / unfinished | HTTP | P95 / P99（ms） | 结果 |
|---|---:|---:|---:|---|
| cold | 30 / 30 / 0 / 0 | 150 | 1188.14 / 1196.17 | PASS |
| mixed | 32 / 32 / 0 / 0 | 70 | 2339.70 / 2440.37 | PASS |
| parallel2 | 2 / 2 / 0 / 0 | 10 | 1259.80 / 1259.80 | PASS |
| parallel3 | 3 / 3 / 0 / 0 | 18 | 2312.12 / 2312.12 | PASS |
| recovery 1/s | 180 / 180 / 0 / 0 | 360 | 25.36 / 33.50 | PASS |
| same2 | 2 / 2 / 0 / 0 | 11 | 1261.65 / 1261.65 | PASS |
| same5 | 5 / 5 / 0 / 0 | 26 | 1503.77 / 1503.77 | PASS |
| share | 4 / 4 / 0 / 0 | 16 | 279.07 / 279.07 | PASS |
| share2 | 2 / 2 / 0 / 0 | 8 | 4215.81 / 4215.81 | PASS |
| smoke 普通 | 1 / 1 / 0 / 0 | 5 | 1284.44 / 1284.44 | PASS |
| smoke 高量 | 1 / 1 / 0 / 0 | 10 | 7767.59 / 7767.59 | PASS |
| warm 1/s | 120 / 120 / 0 / 0 | 240 | 20.79 / 29.89 | PASS |
| warm 3/s | 540 / 540 / 0 / 0 | 1080 | 22.18 / 27.84 | PASS |
| warm 5/s | 1161 / 1161 / 0 / 0 | 2322 | 18.15 / 22.70 | STOPPED，未完成计划 |
| burst 10/s ×60s | 0 / 0 / 0 / 0 | 0 | N/A | BLOCKED：5/s 未完成，未越级 |

各档 `droppedSlots=0`。分位数只包含成功事务；两三人的 P95/P99 只是小样本最大值附近，不用于外推容量。HTTP 列是业务请求，另有每档一次 build metadata GET；不含页面静态资源、浏览器和独立协议断言的请求。逐笔耗时、真实发起窗口、请求量和资源详见 [result-summary.json](../test-results/annual-continuation-20260929/evidence/result-summary.json) 及对应原始 results JSON。

- warm 1/s×120s、3/s×180s 完成；5/s×300s 实际仅运行约232.27s，计划1500，启动并成功1161，未发起339。PSI full avg10=6.63% 触发保护，exit=1，停止原因 SIGTERM；不能用该段零请求失败宣称 5/s 通过。`observedStartsPerSecond=3.87` 按原300秒配置窗口计，实际232秒发起窗口另存，不能混成成功维持5/s全程。
- 停止后首先观察约40秒恢复（PSI降至0；完整记录包含开始恢复请求后的后续点），随后 recovery 1/s×180s 全部通过。主服务 RSS 从216.13MiB回到148.77MiB，独立MySQL约380MiB，队列/worker均归零。全局压力尖峰的来源未完全归因；测试服务和development cgroup没有新增OOM/high事件，不能据此断言与测试无关。未自动重试5/s或提高保护阈值。
- 同用户 same2/same5 分别独立新身份，各只有1条 completed job、attempt=1及1个实际 `standalone.py build` 进程。不同用户 parallel2/parallel3 分别启动2/3次实际计算，最大同时2个；第三人 queued→started 约1秒，其余该组为0秒（DB DATETIME秒级精度）。逐用户job与时间见 [computation-map.json](../test-results/annual-continuation-20260929/evidence/computation-map.json)（user→job→admission→实际worker）及 [jobs-final.tsv](../test-results/annual-continuation-20260929/evidence/jobs-final.tsv)，200ms观测保留admission状态及worker命令；不把进程观测间隔冒充精确CPU计算时长。
- 30冷身份均为全新账户，30条 completed job、attempt=1、30个实际Python计算，串行最大1个；没有宣称恒定1/s或冷生成总体容量。
- share2 两个不同summary均 `cached:false`，实际渲染2次、最大同时1个，返回并完整解码两张1080×1872 PNG；随后四次顺序share均真实POST+图片GET，验证缓存复用，不当作额外4次渲染。mixed叠加1个新冷生成和1个未命中分享，实际generator/renderer各1个；30次热读P95=21.93ms/P99=31.80ms，冷事务约2.34s、分享约2.44s，三类不混算SLA。
- 200ms采样的单generator cgroup最大94.90MiB、renderer最大254.95MiB，短时真实峰值可能漏采。每档末尾10秒观察中worker均退出、无running/queued项，未清除缓存或队列来制造恢复。资源JSON包含宿主机CPU/换页/网络累计计数、测试MySQL IO/RSS和生产PID监测；这些不是生产流量/线上延迟SLA证明。

### 浏览器、真实产物与最终判定

普通12份历史快照×4谱面=48条记录，独立预期44次演奏；稀疏2×1=2条记录，预期1次；高量120×40=4800条记录，预期4760次、最高分811900，含窗口前baseline。高量窗口内119个可用快照，截止2026-06-03，不宣称覆盖每一天。API验证身份、schema4、算法、已知演奏值；后续30冷及4次share还核对最高分和可比较快照数。未修改生成后的summary以满足断言。

三个真实账号从移动入口遍历当前有效页面：普通18页、稀疏10页、高量18页，最终到final/poster并实际点击保存，重复分享命中同一结果。375×567下关键文字、祖先裁剪、按钮命中、weekday主体宽度及独立区块重叠均检查；普通4页、稀疏3页、高量4页关键几何记录均0问题，页面遍历每步核对当前active页。高量额外两次重播、快速上下翻页后保存，0未处理JS异常。21页是定义总数，缺少所需sections的页面自然不展示，不注入mock补页。

数据不足账号终态 `INSUFFICIENT_DATA`，刷新3次不新增build POST且job不变；拥有者summary/job为200，他人summary/job/share image均404。协议适配阶段的失败日志保留，最终独立复测PASS。

关键实际文件（原图未经后处理）：

- [普通中文服务端PNG](../test-results/annual-continuation-20260929/results/business-normal-zh.png)、[稀疏日文服务端PNG](../test-results/annual-continuation-20260929/results/business-sparse-ja.png)、[高量中文服务端PNG](../test-results/annual-continuation-20260929/results/business-high-zh.png)
- [低高度weekday](../test-results/annual-continuation-20260929/results/business-high-zh-weekday.png)、[final](../test-results/annual-continuation-20260929/results/business-high-zh-final.png)、[保存按钮可达](../test-results/annual-continuation-20260929/results/business-high-zh-save-visible.png)
- [0.75.9缺字原图](../test-results/annual-continuation-20260929/results/before-0.75.9-sparse-ja.png)、[原始构建日志](../test-results/annual-continuation-20260929/evidence/build.log)、[运行态公开页检查](../test-results/annual-continuation-20260929/results/public-auth.json)

**续轮结论：LIMITED。** 候选一致性、实际隔离环境、合成账号鉴权/生成/分享闭环、不同用户冷并发、同用户去重、分享竞争、混合负载、1/s和3/s热读及恢复均有实测证据。原环境阻塞已解除；5/s完整档未通过且10/s未执行，公开静态页登录展示仍有P2缺陷，真机、真实用户代表性和目标流量覆盖不足。不能据此无条件公开放量。

最终收尾：新增脚本语法检查、8项鉴权/导出回归和契约检查再次通过，见 `evidence/final-checks.log`。测试33179/33180监听、独立candidate unit及年度worker已退出；生产PID仍3542853、NRestarts=0，见 `evidence/cleanup.json`。应用修复提交为11ee876和f48a63b；本轮后续提交仅含测试与报告，不改被测应用产物。未执行部署。

可审阅证据已筛除凭据复制到 [annual-continuation-20260929](../test-results/annual-continuation-20260929)，共124个文件的哈希清单见 [SHA256.json](../test-results/annual-continuation-20260929/SHA256.json)，另有 [完整证据压缩包](../test-results/annual-continuation-20260929.tar.gz)。原始目录保留，不把含账号cookie的配置打包；生成产物遵守仓库规则不进Git。浏览器任务输入哈希、各次任务退出码和最终脚本哈希随包保存。报告及可执行脚本提交到独立viewer仓库。

### 运行入口与未验证边界

完整命令和小样本/完整模式定义见 [loadtest/annual-readiness.md](../loadtest/annual-readiness.md)。新增的最小 fixture、bootstrap、任务排队工具复用既有年度负载入口和浏览器几何检查，没有替换原 30 冷身份专项。任务、首次失败、复测日志分别保存；不自动重试掩盖失败。

真机仍为 **NOT_RUN**。测试服务只在回环，不修改生产反代。可由操作者通过既有 SSH 授权做私有端口转发访问该候选，验证 build ID 后手测：iPhone Safari 工具栏展开 → weekday 七行/底部文案 → 翻页返回 → 工具栏展开收起 → FavoriteSong 末句 → speedProfile → final → poster 实际保存 → 后台/锁屏返回。需记录设备/系统版本、录像和保存 PNG；本轮未建立真机入口，也未把 Chromium 或 WebGL 降级当作 iPhone/GPU 通过。

真实用户代表性、真实 CDN/装扮、线上流量分布仍未验证。`TARGET_LOAD_UNSPECIFIED`：实测档位不等于目标峰值或冷生成总体容量。未部署、未重启生产、未扩大入口；正式发布和回滚仍走仓库标准部署入口，发布切换及回滚演练 NOT_RUN。

## 2026-09-29 公开测试发布（独立于完整容量验收）

本轮按新授权开放免邀请码公开测试，不重新执行5/s、10/s矩阵。冻结算法保持 `annual-observation-v4.5.2`；统计窗口仍为上海时区 `[2025-10-09 00:00:00, 2026-10-01 00:00:00)`，即包含9月30日全天。`ANNUAL_PUBLIC_OPEN_AT` 旧常量不是当前实际开关，公开时间由服务端运行策略控制；不为上线改动统计口径。

当前版本只接受 `annual_2026`，跨截止日期仍可按该窗口生成、读取已有报告；未知版本404。应用换版不主动全员生成、不清缓存，已有同算法/窗口有效报告继续复用，旧算法按原有按需校验处理。在截止前生成的固定缓存不会在10月1日自动全量刷新，本轮不引入定时重建。

### 操作控制

唯一服务端策略文件默认 `/var/lib/taiko/annual-policy.json`（可由 `TAIKO_ANNUAL_POLICY_FILE` 明确指定一处替代路径）；每次准入读取，无需重启。原子CLI保留未指定字段，邀请码记录和资格表不改写。公开模式只跳过邀请资格，登录、会话有效期、绑定流程、owner资源判断和独立管理员检查保持原实现。公开访问/status/埋点不创建beta participant或伪造兑换、内测事件，缺participant不阻断生成与分享。

从 `taiko_viewer` 目录执行：

```bash
python3 scripts/annual-policy.py                     # 核对实际文件内容
python3 scripts/annual-policy.py --mode invite       # 入口模式回退，保留暂停状态
python3 scripts/annual-policy.py --mode public       # 开放，保留暂停状态
python3 scripts/annual-policy.py --pause-generation yes
python3 scripts/annual-policy.py --pause-rendering yes
python3 scripts/annual-policy.py --pause-generation no --pause-rendering no
```

暂停仅拒绝新的计算/渲染准入，返回503及明确原因；已接收任务继续收尾，任务查询、已有报告及缓存图片读取保留。管理员强制重建在删除旧缓存之前也检查暂停。没有提高2个generator/1个renderer、队列、内存预算、限流或改动既有输入指纹去重。客户端生成/分享POST明确不自动重试，429/503后至少60秒才能手动再提交。压测的PSI监督器不是生产自动降级功能；这里是可操作的服务端手动准入控制，既有worker资源保护继续工作。

代码版本回滚走新revert提交及标准发布脚本，不手动替换线上输出：先把模式回到invite，按逆序回退本轮三个功能提交 `fb48fa9 a5c50e6 2d17f2a`，在审查工作区后递增应用patch版本并提交，然后执行 `bash scripts/memory/run_build.sh /bin/bash scripts/deploy_forum_web.sh "<HEAD完整提交信息>"`。不要回退用户原有修改。标准脚本自带健康检查失败时恢复 `.output.previous` 的流程；本轮不演练生产版本回滚。

### 针对性记录

- 私密凭据与现网原始证据保存在 `/var/tmp/annual-public-20260929`，未提交cookie/私人报告；用户明确授权自行筛选现有有效会话。只选择一个旧内测和一个未获邀、已验证绑定且尚无报告的账号；没有注册测试账号、批量授权、兑换邀请码或社区同步。
- 初始0.76.0暂停API正确返回503，但页面异步错误处理调用setup-only的 `useI18n()`，导致文案缺失；已修复为传入setup阶段捕获的翻译函数。保留失败日志和截图，不把首次失败计通过。
- 0.76.1目标链路和暂停页面通过；一轮浏览器测量被生成成功toast暂时遮挡导航按钮，已保留记录并在toast结束后复测通过，没有用CSS隐藏通知。最后审查去掉额外的active-job短路，保持原输入指纹/去重流程，最终功能候选0.76.2。
- 隔离环境通过既有bootstrap准备全新独立MySQL/目录/会话，worker外发及资源边界沿用已验证机制。没有把localhost本身当隔离证明；测试只执行针对性用例，没有重复负载矩阵。原有准入测试7/7通过，包含renderer第9个/generator第21个排队键拒绝；单元回归包含配置切换、两类暂停、错误配置拒绝、截止后版本解析、异步错误处理。

最终构建、部署、模式切换与现网结果见下方实测记录；候选验证与实际发布分别记录。完整容量、真机、生产回滚仍未验证，发布结论保留LIMITED。

最终部署前候选验证：`fb48fa94a97c8d430a7268ef3451523e3194e17a` / `0.76.2`，独立构建 ID `21aa7c32-8b1b-4ce1-a9c3-668835ddb06d`。`/var/tmp/annual-test-public-release-20260929` 保存完整输入、产物指纹和隔离证据；`public-smoke.done`、`public-browser.done` 均 exit 0。普通中文 18 页、稀疏日文 10 页实际浏览，关键几何断言零问题、页面异常零；两份 1080×1872 PNG 完整解码，匿名公开入口显示登录且不显示邀请码。合成 MyDon 缺资源导致 404/500 并走回退，不能作为现网真实资源通过；现网另验。此次构建没有出现预渲染鉴权错误。随后提交仅包含脚本及本记录，不修改候选应用实现。

### 已部署并切换公开模式：2026-09-29 21:40–21:43 Asia/Shanghai

发布结论 **LIMITED（公开测试已上线；不是完整容量 PASS）**。

- 实际运行版本 **0.76.2**，发布 commit `0b373a21868afef0a4726382b22b13de55f6c41c`，现网 build ID **`ed8d9830-8310-4815-8185-9e4d9aba8d34`**。标准 `run_build.sh → deploy_forum_web.sh` exit 0，已推送，站点与接收器健康检查通过；生产预渲染未出现鉴权错误。部署前保持 invite，部署后先完成旧内测现网协议及浏览器冒烟，再切 public。
- 当前 `/var/lib/taiko/annual-policy.json` 为 `public / pauseGeneration=false / pauseRendering=false`；匿名入口显示“年度报告公开测试”与登录，隐藏邀请码；匿名报告接口仍 401。
- 邀请模式现网：未获邀账号 403；旧内测账号实际冷生成、服务端新渲染及 PNG GET 完成，事务约 **23.95s**，分享 POST **2.481s**。20 页全部浏览，375×567 关键文本/祖先裁剪/按钮检查通过，2 次连续重播及快速翻页、页面保存下载、缓存复用通过；页面异常及 HTTP 资源失败均 0。
- 公开模式现网：未获邀已验证绑定账号实际冷生成、服务端新渲染与 PNG GET 完成，含暂停/恢复检查的事务约 **8.56s**，首次成功分享 POST **2.369s**。19 页全部浏览、2 次重播/快速翻页、保存下载及缓存复用通过，页面异常 0。两阶段均保留完整解码的 **1080×1872 PNG**；单次小样本耗时不代表 SLA 或吞吐能力。
- 现网暂停/恢复：新生成关闭返回 **503 + Retry-After:60**；恢复后完成。新渲染关闭返回 **503**；恢复后完成。两者同时暂停时，已有报告 GET、图片 GET、已缓存 share-card POST 仍 200。最终已恢复两项。其他账号读取报告及图片 404。没有取消已接受任务或改变并发/资源限额。
- 未获邀现网账号原本存在历史 participant=1/events=14，切公开后仍为 **1/14**；授权记录始终 **0**。只新增自身 **1 个 job / 1 个 summary**，未兑换邀请码或补授权。完全没有 participant 的正常账号、未绑定、过期会话、数据不足、非管理员拒绝等覆盖来自最终隔离候选，而不是伪称真实用户现场造数。
- 现网浏览器首次失败保留于 `browser-invite-initial-failure.log` 和同名目录：通用几何检查将移动弹幕的正常进出裁剪误报为静态正文越界。核对现有组件的 translate3d 移动/overflow:hidden 后，只对该明确选择器分类记录 `intentionalMarquee`，增加实际位置变化断言；正文、按钮、weekday 宽度和重叠检查不放宽。复测在**同一现网 build**通过；后续仅提交测试脚本/证据，无应用代码变化。
- 真实资源限制：未获邀账号访问 `/cover/thumb/400/43.webp` 与 `/cover/thumb/400/72.webp` 返回 404（7 次请求）；现有组件有曲绘回退，浏览/分享仍完成，但**原始资源缺失未修复**，不能写“全部资源通过”。旧内测账号未出现 HTTP 资源失败。浏览器仅允许站内及 sakura-bot.cn 域的只读图像/字体/样式请求，外部分析请求被阻断，未验证那些外部服务。
- 恢复观察：最后生产 `NRestarts=0`，服务 cgroup 约 **972 MiB**，本轮 generator/renderer 已退出，内存 PSI avg10/avg60 为 0；这是一次有限恢复观察，**不是生产自动降级或容量保证**。隔离临时服务与 33179/33180 监听已关闭。
- 用户原有 title_song_relations 未提交内容已恢复并验证 SHA256；额外保留命名 stash 与仓库外备份。未提交到候选，不覆盖其他未跟踪文件。

证据（私人真实账户数据不得放入 Git）：`/var/tmp/annual-public-20260929/` 权限 0700，凭据文件 0600；`deploy.log`、`deploy-result.json`、`live-invite.json/png`、`live-public.json/png`、`browser-invite/`、`browser-public/`、`public-db-before.json`、`public-db-after.json`、`release-result.json`。截图包括 opening/weekday/final/poster、匿名公开入口及实际保存按钮。凭据由用户授权自行选取现有有效会话，没有在日志/文档输出 token。

本轮现网实际运行命令（viewer 目录；公开阶段会改变模式，请勿当只读命令重复执行）：

```bash
bash ../scripts/memory/run_qa.sh /usr/bin/env ANNUAL_LIVE_SMOKE_AUTHORIZED=1 /www/server/nvm/versions/node/v24.13.0/bin/node loadtest/annual-live-smoke.mjs /var/tmp/annual-public-20260929/live-config.json invite
bash ../scripts/memory/run_qa.sh /www/server/nvm/versions/node/v24.13.0/bin/node loadtest/annual-business-browser.mjs /var/tmp/annual-public-20260929/browser-invite.json
bash ../scripts/memory/run_qa.sh /usr/bin/env ANNUAL_LIVE_SMOKE_AUTHORIZED=1 /www/server/nvm/versions/node/v24.13.0/bin/node loadtest/annual-live-smoke.mjs /var/tmp/annual-public-20260929/live-config.json public
bash ../scripts/memory/run_qa.sh /www/server/nvm/versions/node/v24.13.0/bin/node loadtest/annual-business-browser.mjs /var/tmp/annual-public-20260929/browser-public.json
```

`public` 协议脚本要求从未生成报告的新账号；当前账号已经生成，不可把重复运行失败解释为产品回归。脚本失败时会收回 invite 并关闭两个新任务开关，需核对私有失败记录再恢复。现网本次两个协议阶段均 exit 0。

未执行：真实 iPhone / iOS 工具栏真机验证、完整 5/s/10/s 容量矩阵、生产高负载、跨统计截止时间的实际时钟验证、手动版本回滚。版本结束后可读为代码/单测证据；截止前生成的报告不会自动补齐剩余日期。并发仍为 generator 2 / renderer 1，队列预算未提高。没有群发公告。标准部署附带百度收录推送返回当日配额耗尽（HTTP 400，成功 0 条），不影响站点上线，未额外重试。


## 2026-10-01 改分历史修正与正式入口收尾（0.76.4 候选）

修复统一发生在年度聚合之前，不逐页篡改展示值。人工降低高分撤销超过修正值的先前高分事件；将通关/全连/全良归零撤销对应先前解锁；下调评级撤销先前极的突破候选；降低游玩计数时，超出修正上限的历史批次无法精确分配到具体次数，因此保守排除并记录 provenance warning，不虚构日期。未改动的计数、其他谱面、修正后真正取得的新成绩保留；单纯锁定不撤销历史。支持 web-account、manual-score、web-score-import、manual-score-delete。

页面审计：

| 页面 | 数据路径及处理 |
|---|---|
| opening | 封面曲池使用期末状态；随受影响账号重新生成更新 |
| period | 首次观测日期与固定统计窗口不改 |
| overview | 修正后的游玩事件、期末通关统计 |
| favorite / obsession / favoriteShift / monthly | 修正后的游玩与偏好聚合 |
| weekday / calendar / timeOfDay / lateNight | 修正后的有时间依据的游玩事件；不给人工修改编造游玩时间 |
| keyword / ratingRank | 原本读取期末成绩，并非此次历史高分选择缺陷；更新后的个人快照正确沿用，排名总体缓存不强制重建 |
| speedProfile / nearDondaful / pound | 原本读取期末成绩；保留口径，更新已改字段 |
| challenge | 修正后的游玩及全连/全良解锁，避免已撤销的全连继续屏蔽挑战候选 |
| highScore | 排除后来被人工修正否定的历史高分 |
| milestones | 撤回被否定的解锁/评级事件 |
| final / poster / 服务端分享图 | 消费上述修正结果，称号权重和冻结统计区间不变 |

改分发生在统计截止后时，仅修正已有期末谱面的明确改动字段；不导入截止后的游玩，游玩总数不会被截止后的人工上调扩大。新算法 v4.5.3；v4.5.2 且没有人工改分历史的报告继续复用，受影响账号下次进入按原队列生成，新人工改分再次使其缓存失效。没有清缓存或预生成全体用户报告。旧分享图片是不可变历史产物，不批量重写；新报告分享使用新 summary ID。历史邀请码/反馈记录和接口保留，仅移除页面左下角 AnnualBetaFeedback 两个按钮。

Kassel 在原报告同一输入下复算：4,228 事件→4,182；移除 46 个被人工修正否定的事件，92 个事件的成就标记被修正。年度高分 桂月 1,018,930→潮音205号SSS线 977,200；全连解锁 64→63，全良 1→0；游玩 3,351→3,333。源成绩未写入修改，证据在 `/var/tmp/annual-correction-20261001/kassel-replay.json`。生产发布及实际生成/浏览/分享结果完成后另记，以上不是已部署声明。


本轮补充发现并修复：人工修改历史文件继承了 `_meta.observed_at/synced_at`，此前会按上次同步时间排序。人工来源现优先自己的 `_meta.ts`，否则解析自身文件名；不改写历史文件。Python 候选已同步提交 Sakura_bot `f36ae12`（前置 `131eb0d`），生产文件在最终发布前尚未切换。年度包只由短生命周期 CLI 使用，无 NoneBot 调用，因此不重启无关 Bot 服务。

候选应用 `0dfbd01` / 0.76.4，隔离 build `e1ae8a53-98e6-41fd-8206-5b310edf2a16`；Python 外部输入指纹记录于 `/var/tmp/annual-test-correction-20261001/evidence/input-manifest.json`。新增 Python 8/8、缓存 Node 3/3、策略/窗口 11/11、21 页契约通过。扩展 Python 测试 35 通过、4 失败；生产原代码复跑同样 35/4，失败为 3 项 first_seen_play 与 1 项 finaltitle mark progression，保留在 `/var/tmp/annual-correction-20261001/python-{regression,baseline}.log`，不声称全部测试通过。

`public-smoke` 与 `correction-smoke` 均 exit 0：实际测试库、独立缓存/worker 的正常鉴权/拒绝、暂停/恢复、生成/分享，以及旧 v4.5.2 无改分缓存复用、单纯锁定不失效、真实改分 POST 后缓存失效/重建、再次改分再次更新。合成游玩数 44→33，旧高分排除；生成并完整解码 `results/corrected-share.png`（1080×1872）。第二次改分发生在固定统计截止之后，未引入新的窗口外游玩。测试只写合成账号，未修改 Kassel 成绩。

### 0.76.4 实际上线与现网复测（2026-10-01 Asia/Shanghai）

结论 **LIMITED：修复已上线，公开模式持续生效；不代表完整容量验收通过**。

- 实际部署 commit `c96dedacbfc26a0f01c44836d00d9378e3beffa5`，build ID `b78c8b07-aa4d-4911-8195-6014f97fe73d`，应用版本 0.76.4。标准部署脚本 exit 0，已推送；Python 源码对应 Sakura_bot `f36ae12`，5 个运行文件与隔离候选逐一校验一致。后续证据文档提交不改变实际部署 commit。
- 部署期间保持 public，先暂停新生成与新渲染、确认在途任务清空，再标准部署并切换已验证 Python 输入，最后恢复两个开关。最终 `public / pauseGeneration=false / pauseRendering=false`。generator 2 / renderer 1 及队列、资源预算不变；没有改用户成绩、清缓存或批量生成。
- Kassel 真实生成→浏览→服务端分享→图片下载通过。现网报告使用 v4.5.3，已撤销的桂月 1,018,930 不再成为年度高分；当前有效最高为 **永远同在 985,200**，来源时间 2026-09-29 19:48:25+08:00。游玩 3,379；移除 47 个事件、修正 92 个成就标记。该输入包含后续真实同步，与上方固定旧输入回放不同，不能直接比较两组总数。分享 POST 约 2.463s，真实 PNG 1080×1872 完整解码。
- 未获邀正常账号继续读取原 v4.5.2 报告，证实无人工改分者无需全员重建；匿名接口仍 401，他人图片仍拒绝。单纯锁定仍不触发重建；受人工改分影响的旧报告在下次进入时按原队列重新生成。已有下载及旧分享图片不追溯重写。
- 现网浏览器 exit 0：Kassel 全部 21 页、未获邀账号全部 19 页，均完成快速翻页、连续重播两次、保存下载及分享缓存复用，页面异常 0。两个测试反馈按钮均不存在。匿名公开入口显示公开标题及登录，不显示邀请码。隔离候选另覆盖普通中文 18 页和稀疏日文 10 页，页面异常及几何断言问题均 0。
- 生成等待期间宿主机内存 PSI full avg10 一度 15.28、avg60 11.24，既有准入保护使任务等待；没有绕过保护或重复提交。压力自然恢复后原任务完成。最终观察 full avg10=0、avg60=0.09，Viewer active / NRestarts=0 / MemoryCurrent=413,044,736 字节，接收器 active。有限观察不能证明容量充足或生产自动降级；高峰仍可能有等待。
- 原有曲绘 `/cover/thumb/400/43.webp`、`72.webp` 缺失仍存在（第二账号 7 次 404，组件回退，分享完成）；未修复这两个资源。真实 iPhone、完整 5/s/10/s 容量、生产版本回滚未执行。扩展 Python 的 4 项既有失败仍保留，不写为全量测试通过。
- 隔离服务已停止，33179/33180 无监听。用户原有 title_song_relations 未提交修改已恢复并核对 SHA256，其他未跟踪文件保留。百度推送当日配额 400 为标准脚本非阻断结果，没有追加重试。

私密证据保存在 `/var/tmp/annual-correction-20261001`（0700）：`deploy.log`、`deploy-result.json`、`python-release.json`、`live-smoke.json`、`kassel-corrected-live.png`、`browser-live/high-business-browser.json`、`browser-live/public-landing.json`、两账号截图与实际 PNG。私人报告及会话未提交 Git。

操作仍使用 viewer 目录的 `python3 scripts/annual-policy.py`：`--pause-generation yes` 暂停新生成，`--pause-rendering yes` 暂停新分享渲染，`--pause-generation no --pause-rendering no` 恢复，`--mode invite` 回退入口。暂停保留已有报告及缓存图片读取，已接收任务继续收尾。

本版代码回滚需同时协调 Viewer 与外部 Python：先暂停两类新任务并等在途完成；在干净审查工作区创建 Viewer 功能提交 `0dfbd01` 的 revert（`c96deda` 主要为验收脚本，不要求回退证据），递增 patch 并通过标准发布脚本部署；Python 回退 `f36ae12`、`131eb0d` 对应改动并同步 Sakura_bot 与运行路径，校验后再恢复准入。不要直接替换 `.output`，不要覆盖用户未提交文件。本轮未执行此回滚。

### 2026-10-01 后续公开状态复核（0.76.6）

后续歌曲讨论修复已标准部署：commit `0c5abf9`，build `f3cab57d-548c-418c-aae1-370e3f660c21`。版本总结策略未改，现网 status 为 public，两类新任务暂停均 false；旧内测和未获邀账号实际报告 GET 均 200、有报告。所有符合登录、账号状态与绑定要求的用户无需邀请码；数据不足、资源归属等既有检查保留。这次只读复核不替代此前的容量与真机限制。

歌曲“查看所有讨论”由固定 score-guides 板块改为 `/forum/discussions`，复用同一列表组件，保留 songId/difficultyType/排序/分页。原板块入口仍按板块过滤；发帖保留歌曲与难度。0.76.5 首轮中文通过，日文发现既有帖子卡片丢失语言前缀，0.76.6 已一并修复。最终中日文实际点击幽玄之乱入口，预览及完整列表都包含 achievements 帖子；排序、返回、刷新、发帖目标参数、原板块入口通过，页面异常均 0；没有写入任何帖子。样本仅一页，未现场验证多页数据翻页。论坛文案单测 6/6。证据 `/var/tmp/song-discussions-20261001`：最终 `browser-final/result.json`、中日文截图、`annual-access.json`、部署日志及首次失败日志。标准 npm install 的工作区 lock 重排另存证据后恢复已提交 lock；用户原有 title_song_relations 修改完整恢复、SHA256 一致。此证据提交不改变已部署代码。

## 2026-10-01 菌菌导入按需更新与首次同步降级（0.77.0 候选）

候选应用 `4801279`，隔离 build `68ff788c-d8eb-4d2b-a878-5091daffc5b3`；外部 Python 对应 Sakura_bot `a183d0f`。没有修改冻结窗口、评级算法、worker 并发或队列预算。默认关闭 `refreshImports`、`archiveFallback` 两个独立热配置开关，旧配置缺字段仍按关闭处理；关闭不会撤销已生成报告。

菌菌导入记录参与输入指纹，已有报告读取时检查导入修订。页面进入后按需提交原队列，旧报告及旧图片继续可读，新报告完整落盘并写入记录后成为最新报告；更新失败仍读旧报告，本路径不执行先删后建或旧报告裁剪。重复当前成绩导入没有新增/更新时不再写入无变化快照。历史迁移仍按原幂等写入逻辑。

降级仅在原统计窗口没有快照且最新快照含有效成绩时启用，使用一个快照，不构造游玩事件，不把截止后记录导入正常年度统计。无有效成绩仍失败。有正常年度数据的计算输出在开关开/关时一致。按用户后续要求，沿用正常入口、标题、页面风格，不显示“当前成绩档案”等模式标签；日期和累计数据如实显示，缺少历史依据的页面隐藏。

验证：Python 4/4（关闭仍拒绝、开启生成、空成绩拒绝、正常年度不变、导入影响输入身份），Node 策略/导入/日期 9/9，21 页契约通过。隔离 `refresh-smoke` exit 0：合成正常报告 44→56 次；暂停时旧报告可读；真实 worker 返回 INSUFFICIENT_DATA 后旧报告及旧 PNG 保留；成功更新后旧 PNG 仍 200；开关关闭后已有报告仍可读；新账号原失败缓存随开启降级释放并成功生成。真实分享 PNG 均 1080×1872，完整解码。导入在隔离测试中以合成菌菌历史快照模拟，不向菌菌第三方发起请求。

浏览器 exit 0：正常中文 18 页、新用户中文及日文各 10 页，低高度 375×567、关键几何检查、快速翻页、连续重播、下载及缓存复用通过，页面异常 0。合成 MyDon 没有真实形象素材，404/500 及回退保留，不将其计为真实资源全通过。未做真机及全容量矩阵。证据 `/var/tmp/annual-test-refresh-20261001`、`/var/tmp/annual-refresh-20261001`；测试实例及 33179/33180 已停止。

部署只走标准发布脚本；最终上线版本、开关与现网结果另记。回退开关（viewer 目录）：`python3 scripts/annual-policy.py --refresh-imports no --archive-fallback no`。暂停/恢复新任务仍使用原 `--pause-generation`、`--pause-rendering` 参数。Python 是独立短生命周期 worker 输入，不涉及运行中 NoneBot 进程，不重启无关 Bot。

### 0.77.0 实际上线与现网复测（2026-10-01 13:43–13:47 Asia/Shanghai）

结论 **LIMITED：两项功能已开启，实际生成、浏览、分享通过；不是完整容量验收**。

- 实际部署 commit `fd1d68c47fe4e8b41b229157841e32f4e43b4910`，build **`54994094-fc9f-4794-96ca-ece9058947e7`**。标准 `run_build.sh → deploy_forum_web.sh` exit 0，已推送；对应 Python 为 Sakura_bot `a183d0f`，3 个运行文件与隔离测试输入逐一核对后原子替换。服务 stop/start 均记录在 13:43:37；这不是完整请求无中断证明。无关 Bot 不重启。
- 切换前暂停新生成与新渲染、确认队列和 worker 清空；构建期间原站运行。部署后先以两项功能关闭状态读取原报告 200，再开启。最终策略 `mode=public, pauseGeneration=false, pauseRendering=false, refreshImports=true, archiveFallback=true`。并发、资源保护及限流未调整，没有清缓存、修改成绩或批量生成。
- 真实已导入账号：开关关闭时仍读取原报告；开启后 `refreshAvailable=true`，原队列成功生成新 ID，224→1817 次；新报告不再提示刷新，旧 ID 仍 200。该账号当前输入按既有算法落在 `current_archive`（无新用户降级标记），因此不应将差值解释成新发生的年度游玩。没有为了测试重新调用菌菌第三方导入。
- 真实此前数据不足账号：现网生成成功，单快照 1493 次，实际同步日期 2026-10-01，冻结版本窗口仍为 2025-10-09 至 2026-09-30（Asia/Shanghai，右开截止 2026-10-01）。沿用正常标题、入口和布局，不标“当前成绩档案”，缺乏依据的历史页面不展示。
- 两账号真实服务端分享 POST 分别约 2.422s / 2.403s，PNG 1080×1872 完整解码。现网浏览器两账号各 9 页全部浏览、低高度几何检查、快速翻页、连续重播两次、保存下载和分享缓存复用通过；页面异常 0，资源失败 0。匿名入口仍要求登录，匿名报告 API 401。隔离样本页数 18/10 与真实样本 9 不同，取决于有依据的内容。
- 收尾队列 queued/running=0，Viewer/接收器 active、NRestarts=0；宿主机 memory PSI full avg10/60/300 均 0。Viewer MemoryCurrent 约 1.23 GB，接收器约 139 MB；磁盘使用 90%、可用 31 GiB。有限观察不能证明峰值容量。
- 实际日志另见新绑定但无 userdata 的 `/api/account/my-don` ENOENT 500，本轮两个测试账号未出现，未将全站写为无错误，也未扩大修复范围。既有 SMTP、部分缺失曲绘问题不因这次测试而宣称解决。真机 iPhone、完整负载、生产版本回滚未执行。
- 首次私有准备脚本误用 `/usr/bin/node` 的旧版本，顶层 await 语法失败，未连接数据库；改用项目 Node v24 后成功。隔离测试记录中的历史失败继续保留。标准部署百度推送配额 HTTP 400、成功 0 条是非阻断结果，没有额外重试。

私密证据 `/var/tmp/annual-refresh-20261001`（0700）：`deploy-result.json`、`deploy.log`、`python-release.json`、`live-flags-off.json`、`before/after-{imported,fresh}.json`、`live-smoke.json`、`live-{imported,fresh}.png`、`browser-live/high-business-browser.json`、关键截图与实际下载。会话保存为仓库外 0600；不提交私人报告。原有 title_song_relations 修改已恢复且 SHA256 一致，其他工作区修改保留。隔离实例仍已停止。

操作（viewer 目录）：`python3 scripts/annual-policy.py --refresh-imports no --archive-fallback no` 关闭两项新行为，已生成报告仍可读；`--pause-generation yes --pause-rendering yes` 暂停新任务，改为 `no` 恢复。必要代码回滚需先暂停并排空任务，审查后回退 Viewer 功能提交 `4801279`，递增 patch 后用标准部署脚本；同时回退 Sakura_bot `a183d0f` 的 Python 改动并同步运行路径，核对后恢复准入。不得手动替换 `.output` 或覆盖用户修改。本轮没有执行生产代码回滚。
