# Annual UX Detail P1 Report

本轮未修改年度算法、FinalTitle 文案、21 页内容、schema、缓存语义或部署产物；未 bump version、未 deploy。

## 1. 翻页音效

- 原触发点：`components/account/version-summary/StoryPlayer.vue` 的 `watch(activeIndex)` 调用 `playDrum()`；该函数创建内嵌 PCM `DRUM_SOUND` Audio。
- 已移除 page transition 对 `playDrum()` 的调用、Drum Audio 实例及停止逻辑；BGM session、静音开关和页面内其它逻辑保留。
- 当前源码无 `playDrum` 引用，年度翻页 SFX = OFF。内嵌 PCM 常量仍保留为未引用 dead asset，未扩大范围删除。

## 2. Poster 背景调查

基线请求 `/annual/poster/square_bg.png` 的结论是“source 新 / build output 旧 / online bytes 旧”，不是浏览器缓存单独命中：

| 项目 | SHA-256 | 尺寸 |
|---|---|---|
| 当前 source `public/annual/poster/square_bg.png` | `77a1344ccf82e11280a67443b0d212a8e3b9f73eef5e972ee25ddd10c2f5f67f` | 362×554 |
| 修改前本地 `.output/public/.../square_bg.png` | `a7c33c85194eaa74bd67b1f75d8120158043faa9b847acec0b40513750f1cbdb` | 363×554 |
| 当前线上 `/annual/poster/square_bg.png` | `a7c33c85194eaa74bd67b1f75d8120158043faa9b847acec0b40513750f1cbdb` | 363×554 |

线上响应为 `200 image/png`，`ETag: "1ba8a-Wc64x7ofQEGFkKzPzR5vKcQcUJk"`，`Last-Modified: Mon, 14 Sep 2026 09:51:17 GMT`；未返回 `Cache-Control` 或 `Age`。页面原 CSS 实际引用 `/annual/poster/square_bg.png`。

最终方案：新增稳定文件名 `square_bg_v2.png`，`AnnualShareGrid.vue` 改为引用该 URL。构建后 source 与本地 output 均为 `77a1344c…f67f`（362×554），从 URL 层面避免继续命中旧文件。由于本轮明确不部署，线上 `square_bg_v2.png` 当前为 404；待人工审阅后的下一次部署再验证线上三方一致。

## 3. Opening 关键资源

- 艺术字：`/title.png`（source/online SHA-256 `d902714a9cceb96bd0ea47de9df732be650dc1c707f60027e74e1ff878602649`，1536×1024）。Opening 使用 `OpeningSlide.vue` 的 `.annual-opening__title-art`。
- BGM：`/audio/annual/natsumatsuri-303-old.ogg`（source/online SHA-256 `15769961c4bb2f7c04fbe5b043ec43f35300fa217f87200161341346812aa9b3`，4,328,614 bytes）。现有 `annualBgm.client.ts` 创建单一 Audio controller，`preload=auto`。
- 年度入口 setup 立即启动 `preloadAnnualBgm()` 与 `preloadAnnualOpeningArtwork()`；summary 出现后等待同一 promise，并与既有 Opening cover preload 并行。
- artwork ready 条件：Image load 且 `img.decode()` 成功；失败/超时记录明确 `console.warn`，随后继续进入 Opening，不会无限 loading。
- BGM ready 条件：既有 controller 的 `canplay`/`canplaythrough` 或 `readyState >= 3`；只预加载，不自动播放。Opening mount 复用同一 controller，不重复下载。
- autoplay permission 与 asset preload 分离：播放仍由 Opening 的真实用户手势/现有 `play()` 机制决定；拒绝时保留既有 pointerdown/keydown retry，不绕过浏览器策略。

## 4. 浏览器与时序检查

- 使用 Chromium/Playwright 访问生产艺术字与 BGM URL，关闭浏览器缓存：artwork `decode()` 成功约 578 ms；audio `canplay` 成功、`readyState=4` 约 232 ms。
- 使用本地构建产物确认 CSS 已引用 `square_bg_v2.png`，新文件 hash 与 source 一致。
- 认证年度页面的 cache-hit/cold-build 端到端时间线需要登录态；本轮未伪造账号或触发重建。代码 Gate 保证 Opening 仅在 critical asset promise settled 后显示，资源失败则 graceful fallback。
- 翻页连续性由源码契约验证：`playDrum` 引用数为 0；BGM 仍为单一 session，不会因翻页 restart/duplicate。

## 5. 验证

- `npm run test:annual`：PASS
- `npm run test:annual:period`：PASS（11/11）
- `npm run test:version`：PASS
- `npm run test:forum`：PASS（6/6）
- `npm run build`：PASS
- `title_song_relations.json` 未修改/未提交；SHA-256 前后均为 `4cc9be6074d011ddf7eed43f4351e0a4131145838a32e811670682497cca48fa`。

## 6. 变更文件

- `components/account/version-summary/StoryPlayer.vue`
- `components/account/version-summary/AnnualShareGrid.vue`
- `pages/account/version-summary.vue`
- `utils/annualOpeningAssets.client.ts`
- `public/annual/poster/square_bg.png`（既有正确背景，纳入相关变更）
- `public/annual/poster/square_bg_v2.png`
- `scripts/verify_annual_contract.mjs`

等待人工审阅；本轮没有部署。
