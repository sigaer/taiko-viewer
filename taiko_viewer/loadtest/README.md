# 年度总结公开页压测基线

这些脚本只用于容量与前端稳定性验证，不接入生产启动流程，也不修改年度总结业务逻辑。

## 入口链路盘点

当前 viewer 生产 Node 监听 `127.0.0.1:3100`（`3000` 为其他 Docker 服务）。入口页面为 `/` 和 `/account/version-summary`。年度入口的主要请求链路如下：

| 页面/状态 | 主要请求 | 说明 |
| --- | --- | --- |
| 首页 | `/`、Nuxt document/chunk、字体与首页图片 | 公开访问，不需要 share token |
| 年度入口未生成 | `/account/version-summary`、`/api/account/auth/me`、`/api/account/annual-summaries/annual_2026`、绑定列表相关接口 | 需要登录态；未登录通常为 401/重定向 |
| 年度入口已生成 | 上述接口，随后加载年度素材与页面 chunk | summary GET 为读取链路 |
| 点击生成 | `POST /api/account/annual-summaries/annual_2026/build` | 仅允许本机/staging 测试账号，生产最多人工 1–3 个账号 |
| job 轮询 | `/api/account/annual-summary-jobs/:jobId` | 观察排队、完成时间和失败率 |
| 海报生成 | `POST /api/account/annual-summaries/:key/posters`、`/api/account/annual-poster-jobs/:jobId` | 默认不批量触发；生产最多人工 1–3 个账号 |
| 公开分享 | `/annual/share/:token/` 及 share/poster API | 仍需合法 share token，本阶段暂缓 |

精确首屏请求数、chunk 数、图片数、最大/总传输体积、404、重复请求和 `no-store` 可由 `annual-entry-browser-stress.mjs` 输出；它会为每个响应记录状态、资源类型、`Content-Length` 和 `Cache-Control`。其中 Nuxt 运行时 hash chunk 会随构建变化，不应在 k6 清单中写死占位文件名。

## 安装与准备

- 安装 [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/)（macOS 可用 `brew install k6`，Debian/Ubuntu 可按官方 apt 源安装）。
- 安装 Playwright：在 `taiko_viewer` 执行 `npm install -D playwright`，再执行 `npx playwright install chromium`。
- 复制 `loadtest/tokens.txt.example` 为 `loadtest/tokens.txt`，每行放一个可公开访问的 share token；真实 token 不提交，`.gitignore` 已忽略该文件。
- `loadtest/seed-annual-share-tokens.mjs` 通过现有登录态 share API 生成 token，不手写签名。需设置 `SESSION_TOKEN`（对应 `stv_session`）及数据库环境变量；默认禁止生产环境，生产必须显式设置 `LOADTEST_ALLOW_PRODUCTION=1`。

生成与验证：

```bash
LOADTEST_ENV=staging SESSION_TOKEN='your-session-cookie' TOKEN_COUNT=10 LOCALE=zh node loadtest/seed-annual-share-tokens.mjs
BASE=http://127.0.0.1:3100 bash loadtest/validate-tokens.sh
BASE=https://viewer.sakura-bot.cn bash loadtest/validate-tokens.sh
```

当前 share 创建逻辑会清理同一 summary 的旧 active share，因此 seed 工具只为不同 summary 创建 token；summary 不足时不会伪造或重复覆盖，输出实际数量并提示这不是多用户数据分布。建议后续准备 10–50 个不同 summary。seed 只保证 summary token；poster 仍需先通过账户海报任务生成，poster 404“海报尚未生成”不代表 token 无效。

即使 `BASE` 是 localhost，它也可能指向生产 systemd 进程，因此 seed 默认按 production 处理。生产生成必须同时提供 `LOADTEST_ALLOW_PRODUCTION=1` 和有效 `SESSION_TOKEN`；创建新 share 会按现有业务设计撤销同一 summary 的旧 active share 并清理其 poster，请勿用真实用户正在分享的 summary。

## 入口/API 基线

入口脚本不依赖 share token，会请求首页、年度入口、登录态和年度 summary GET；`COOKIE` 仅从环境变量读取：

```bash
BASE=http://127.0.0.1:3100 k6 run --vus 3 --duration 30s loadtest/annual-entry-api.js
COOKIE='stv_session=测试账号cookie' BASE=https://viewer.sakura-bot.cn k6 run --vus 3 --duration 1m loadtest/annual-entry-api.js
```

输出 p95/p99、error rate 及 200/302/401/403/404/429/5xx 分布。生产只允许上述 3 VU/1 分钟；不要把真实用户 cookie 写入文件或命令历史，建议使用临时 shell 会话和专用测试账号。

开屏静态资源：

```bash
BASE=http://127.0.0.1:3100 k6 run --vus 3 --duration 30s loadtest/opening-static-assets.js
BASE=https://viewer.sakura-bot.cn ASSETS='/_nuxt/实际hash.js,/Calendar.png,/Opening.png,/Overview.png,/2026_autumn.png' k6 run --vus 3 --duration 30s loadtest/opening-static-assets.js
```

`ASSETS` 应来自真实 Network 记录。默认清单已按 2026-09-02 本机构建采样写入实际 Nuxt hash chunk 和首屏图片；重新构建后 hash 可能变化，应重新运行浏览器采样并更新清单。

浏览器开屏稳定性（不是服务端大压测）：

```bash
BASE=http://127.0.0.1:3100 node loadtest/browser/annual-entry-browser-stress.mjs
COOKIE='stv_session=测试账号cookie' BASE=https://viewer.sakura-bot.cn CONCURRENCY=1 node loadtest/browser/annual-entry-browser-stress.mjs
```

脚本覆盖 390×844、414×896、430×932，输出首屏/`networkidle` 耗时、资源/图片数量、传输体积、`no-store` 数量及 pageerror、requestfailed、console error、图片 404、5xx API。生产最多 `CONCURRENCY=2`。

## Build/Poster Job Smoke

build 是队列任务，会触发 CLI、文件读写和数据库写入；poster 还会进行图片渲染。两者都不是普通 GET 压测：默认 dry-run，不会 POST。

```bash
k6 run -e BASE=http://127.0.0.1:3100 loadtest/annual-build-queue-smoke.js
ALLOW_BUILD_TEST=1 COOKIE='stv_session=测试账号cookie' BASE=http://127.0.0.1:3100 k6 run loadtest/annual-build-queue-smoke.js
```

只允许本机/staging 测试账号；生产禁止批量 POST，最多人工确认 1–3 个账号，并观察 job 排队/完成时间、失败率、Node RSS/heap、磁盘 IO、swap、DB 连接。poster 生成同理，使用现有账户接口手动触发，必须先设置 `ALLOW_POSTER_JOB_TEST=1` 的变更控制；本目录不提供批量 poster 生成脚本。poster GET 读取压测仍需合法 token 和已生成海报。

## 推荐顺序与生产边界

1. 入口/开屏压测：不需要 share token。
2. 登录态年度入口：需要测试账号 cookie。
3. summary build queue smoke：仅低强度、显式许可。
4. poster job smoke：仅低强度、显式许可。
5. 公开 share API/poster：需要合法 token；poster 还需要已生成海报。
6. UI 完成后的浏览器全链路回归。

生产只做入口 API 3 VU/1 分钟、静态资源低强度（不超过约 30 并发等效）、浏览器 1–2 并发；禁止 100+ VU、批量 build/poster、真实用户 cookie 和任何 Nginx/限流配置改动。测试期间观察 `journalctl -u taiko-viewer.service -f`、nginx access/error、CPU、Node 内存、`free -h`、swap、`iostat -xz 1`、`ss -s`、502/504、重启和数据库连接；触发停止条件立即中止。

## k6 命令

在 `taiko_viewer` 目录执行：

```bash
k6 run -e BASE=http://127.0.0.1:3100 loadtest/annual-share-api.js
k6 run -e BASE=https://staging.example.com -e VUS=10 -e DURATION=2m loadtest/annual-share-api.js
k6 run -e BASE=http://127.0.0.1:3100 loadtest/annual-poster.js
k6 run -e BASE=https://staging.example.com -e VUS=5 -e DURATION=1m loadtest/annual-poster.js
k6 run -e BASE=http://127.0.0.1:3100 -e ASSETS='/_nuxt/app.js,/monthly/monthly.png,/weekday/038_key.png,/favoriteShift/cover_bg_7.png,/Calendar.png' loadtest/annual-static-assets.js
```

静态脚本默认包含 `/_nuxt/*`、`/monthly/*`、`/weekday/*`、`/lateNight/*`、`/favoriteShift/*`、`/obsession/*`、`/annual/*`、`/assets/cover/*` 的示例路径；请用 `ASSETS` 替换为 staging 构建中实际存在的文件，避免把目录占位符当成 404 结论。

## 浏览器验收

浏览器脚本不是大规模服务端压测。它用 414×896 移动视口打开公开页，等待加载后连续翻页并收集 `pageerror`、失败请求和 console error：

```bash
BASE=http://127.0.0.1:3100 TOKEN='your-token' CONCURRENCY=2 ROUNDS=12 node loadtest/browser/annual-browser-stress.mjs
```

可设置 `REDUCED_MOTION=1`、`PAUSE_MS`；`ROUNDS` 建议 10–20。

## 测试策略与观测

先本机小流量，再 staging 容量测试，最后生产仅做低强度、短时、可回滚验证；不要默认高压打生产。当前公开 API 有 per-IP 限流，单机高并发可能先得到 429。429 通常说明限流生效，不等于服务器故障：容量测试应使用已获批准的多出口/限流白名单并关注 5xx，限流测试则固定单 IP、验证阈值和恢复行为。

压测同时观察：`journalctl -u taiko-viewer.service -f`、nginx access/error log、CPU、Node RSS/heap、`free -h`、swap、`iostat -xz 1`、disk await、网络带宽、DB connection、429 数量和 502/504 数量。

推荐验收指标：summary p95 < 800ms、p99 < 2000ms、5xx < 1%；HTML p95 < 1000ms、p99 < 2500ms、5xx < 1%；poster p95 < 1200ms、p99 < 3000ms、5xx < 1%；静态资源 p95 < 500ms、无大量 404/5xx 且带宽不打满。浏览器应无 pageerror、无关键 requestfailed、连续翻页不卡死，`active=false` 后动画不残留，reducedMotion/saveData 正常。

## 示例输出

`annual-share-api.js` 会打印 HTML/summary 的 p95、p99、error rate，并通过 `annual_status{endpoint,status}` 提供 200/429/5xx 分布；`annual-poster.js` 额外打印 image/png 校验和传输体积 p95。k6 的 `http_req_failed` 与脚本自定义失败率都应结合状态分布解读，不能把 429 自动当作 5xx 故障。
