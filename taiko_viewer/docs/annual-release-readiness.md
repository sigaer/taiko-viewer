# 年度报告发布验收 — 2026-09-29

**结论：BLOCKED。** 已复现并修复三处低高度移动端裁剪；前端隔离回归与后端真实业务验收必须分开。尚不能批准正式上线：没有三类真实测试账户的鉴权→生成→完整浏览→实际分享闭环，没有已核实全部边界的负载环境，也没有真实 iPhone 证据和发布流量目标。

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
