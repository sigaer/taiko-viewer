# 年度总结公开页压测基线

这些脚本只用于容量与前端稳定性验证，不接入生产启动流程，也不修改年度总结业务逻辑。

## 安装与准备

- 安装 [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/)（macOS 可用 `brew install k6`，Debian/Ubuntu 可按官方 apt 源安装）。
- 安装 Playwright：在 `taiko_viewer` 执行 `npm install -D playwright`，再执行 `npx playwright install chromium`。
- 复制 `loadtest/tokens.txt.example` 为 `loadtest/tokens.txt`，每行放一个可公开访问的 share token；真实 token 不提交，`.gitignore` 已忽略该文件。

## k6 命令

在 `taiko_viewer` 目录执行：

```bash
k6 run -e BASE=http://127.0.0.1:3000 loadtest/annual-share-api.js
k6 run -e BASE=https://staging.example.com -e VUS=10 -e DURATION=2m loadtest/annual-share-api.js
k6 run -e BASE=http://127.0.0.1:3000 loadtest/annual-poster.js
k6 run -e BASE=https://staging.example.com -e VUS=5 -e DURATION=1m loadtest/annual-poster.js
k6 run -e BASE=http://127.0.0.1:3000 -e ASSETS='/_nuxt/app.js,/monthly/monthly.png,/weekday/038_key.png,/favoriteShift/cover_bg_7.png,/Calendar.png' loadtest/annual-static-assets.js
```

静态脚本默认包含 `/_nuxt/*`、`/monthly/*`、`/weekday/*`、`/lateNight/*`、`/favoriteShift/*`、`/obsession/*`、`/annual/*`、`/assets/cover/*` 的示例路径；请用 `ASSETS` 替换为 staging 构建中实际存在的文件，避免把目录占位符当成 404 结论。

## 浏览器验收

浏览器脚本不是大规模服务端压测。它用 414×896 移动视口打开公开页，等待加载后连续翻页并收集 `pageerror`、失败请求和 console error：

```bash
BASE=http://127.0.0.1:3000 TOKEN='your-token' CONCURRENCY=2 ROUNDS=12 node loadtest/browser/annual-browser-stress.mjs
```

可设置 `REDUCED_MOTION=1`、`PAUSE_MS`；`ROUNDS` 建议 10–20。

## 测试策略与观测

先本机小流量，再 staging 容量测试，最后生产仅做低强度、短时、可回滚验证；不要默认高压打生产。当前公开 API 有 per-IP 限流，单机高并发可能先得到 429。429 通常说明限流生效，不等于服务器故障：容量测试应使用已获批准的多出口/限流白名单并关注 5xx，限流测试则固定单 IP、验证阈值和恢复行为。

压测同时观察：`journalctl -u taiko-viewer.service -f`、nginx access/error log、CPU、Node RSS/heap、`free -h`、swap、`iostat -xz 1`、disk await、网络带宽、DB connection、429 数量和 502/504 数量。

推荐验收指标：summary p95 < 800ms、p99 < 2000ms、5xx < 1%；HTML p95 < 1000ms、p99 < 2500ms、5xx < 1%；poster p95 < 1200ms、p99 < 3000ms、5xx < 1%；静态资源 p95 < 500ms、无大量 404/5xx 且带宽不打满。浏览器应无 pageerror、无关键 requestfailed、连续翻页不卡死，`active=false` 后动画不残留，reducedMotion/saveData 正常。

## 示例输出

`annual-share-api.js` 会打印 HTML/summary 的 p95、p99、error rate，并通过 `annual_status{endpoint,status}` 提供 200/429/5xx 分布；`annual-poster.js` 额外打印 image/png 校验和传输体积 p95。k6 的 `http_req_failed` 与脚本自定义失败率都应结合状态分布解读，不能把 429 自动当作 5xx 故障。
