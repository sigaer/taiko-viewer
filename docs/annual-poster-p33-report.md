# Annual Poster / Breakthrough / Highscore P3.3 Report

本轮只修正 3 个明确的界面问题，未改动 annual algorithm、FinalTitle 模型、统计数据来源、breakthrough 判定逻辑、poster 保存逻辑、分享逻辑或其它页面文案。

- 版本：`0.63.3`（patch）
- 发布提交：`7438cab 0.63.3 修正年度海报统计横向分布与称号文案`
- 部署：`bash scripts/deploy_forum_web.sh "0.63.3 修正年度海报统计横向分布与称号文案"`，exit 0（脚本自行完成 push、隔离构建、产物切换、重启与健康检查）；本地与线上 appVersion 均为 `0.63.3`
- 无关的工作区改动 `taiko_viewer/assets/data/title_song_relations.json` 在部署前以 stash 方式可逆隔离、部署后原样恢复，SHA-256 前后一致（`4cc9be6074d011ddf7eed43f4351e0a4131145838a32e811670682497cca48fa`），未进入提交

## 1. Poster 下方 6 个统计项横向重排

修改文件：`taiko_viewer/components/account/version-summary/AnnualShareGrid.vue`

根因：`.annual-share-grid__stats` 是 3 列 grid，左右各留 `5.5cqw` 内边距、列间距仅 `4cqw`，三列内容整体被挤在卡片中间；item 没有固定宽度，也不是被居中包裹，但可用宽度被内边距吃掉。

修改内容：

- stats wrapper 从 3 列 grid 改为 `display:flex; flex-wrap:wrap`，6 个 item 用 `flex:1 1 calc((100% - 10cqw)/3)` 精确确定每行 3 个，结构仍是 2 行 × 3 列，DOM 仍是 6 个直接子项
- 左右内边距由 `5.5cqw` 收到 `1.5cqw`，列间距由 `4cqw` 放大到 `5cqw`，列宽随之变宽、列与列之间更舒展
- 统计项文本、顺序、数据来源均未改动

414×896（poster 卡最大宽度 363px）实测对比：

| 指标 | 修改前 | 修改后 |
|---|---|---|
| 列宽 | 98.02px | 105.27px |
| 列间距 | 14.51 / 14.52px | 18.14 / 18.14px |
| 内容左右内缩 | 20.0 / 19.95px | 5.44 / 5.46px |
| 行结构 | 2 × 3 | 2 × 3 |

移动端窄屏实测（所有宽度均无溢出、无裁切、无横向滚动）：

| 视口 | 卡片宽 | 列宽 | 列间距 | 内容内缩（左右） |
|---|---|---|---|---|
| 414×896 | 362.98 | 105.27 | 18.14 / 18.14 | 5.44 / 5.46 |
| 390×844 | 332.84 | 96.52 | 16.64 / 16.65 | 4.98 / 5.03 |
| 360×740 | 273.88 | 79.42 | 13.69 / 13.69 | 4.10 / 4.14 |
| 320×640 | 208.36 | 60.42 | 10.41 / 10.40 | 3.13 / 3.15 |
| 导出 1080×1648 | 1080 | 313.20 | 54 / 54 | 16.19 / 16.20 |

## 2. Poster「称号展示」字段修正

修改文件：同上

根因：下方 `称号展示` 单元格直接渲染 `summary.profileCard?.danName`（段位值），所以显示 `八段`；breakthrough 页主标题取的是 `summary.finalTitle.title`。

修改内容：

- 新增 `profileTitle = summary.finalTitle.title || summary.profileCard?.danName || '—'`，默认以 breakthrough 页展示的最终称号为准，仅在无对应称号时按既有兜底逻辑回退
- 页面标签文案 `称号展示` 未改动

验证（同一份 fixture 中 `finalTitle.title = 一年一鼓，一路同行`，`breakthrough.title = 突破·十段`，`profileCard.danName = 八段`，三者为不同字符串）：

- breakthrough 页主标题 = `一年一鼓，一路同行`
- Poster「称号展示」= `一年一鼓，一路同行`
- 不再出现 `八段`；zh / ja 两个 locale 结果一致
- 分享卡导出（1080×1648）使用同一组件、同一取值

## 3. Highscore 页移除 SCORE 文案

修改文件：`taiko_viewer/components/account/version-summary/slides/HighScoreSlide.vue`

- 删除分数旁的 `<small>SCORE</small>` 及其 scoped 样式 `.score-poster__score small`
- 分数数值、动画、日期、正文与布局层级均未改动
- 实测 414×896 与 390×844：分数仍为 `1,002,340`，页面文本中已无 `SCORE`

## 4. 验收脚本

新增 `taiko_viewer/scripts/verify_annual_poster_p33.mjs`（离线渲染真实组件，不连后端/数据库/生产数据），9 个用例覆盖：

- Poster 页 414×896 / 390×844 / 360×740 / 320×640：2 行 × 3 列、6 项、无裁切、无溢出、无横向滚动
- 列宽大于修改前的 3 列 track 宽度，列间距 ≥ 10px，内容内缩不超过 `1.5cqw + 1.5px`
- 「称号展示」等于 breakthrough 页主标题，且不等于 `八段`
- ja locale 保持相同几何与相同称号来源
- breakthrough 页主标题 = Poster「称号展示」
- highscore 页保留分数、无 `SCORE`
- 导出面 1080×1648：同一套 2 × 3 规则、统计项全部落在卡片内

运行结果：`P3.3 poster layout verification PASS (9 cases)`；`npm run test:annual` 亦通过（`{"ok":true,"pageCount":21,"locales":["zh","ja"],"schemaVersion":4}`）。

## 5. 遗留观察（本轮未改动）

- `scripts/verify_annual_poster_static.mjs` 在修改前的 `HEAD` 上即已失败：第 59 行 `button:disabled` 计数断言（`0 !== 2`）与随后的 `poster-scene__compose` overflow 判定都不成立，属于既有测试夹具与现状不一致，与本轮改动无关（已用 pristine `HEAD` 复现确认）。本轮未扩大范围修改它。
- 线上 Poster 页需要登录态，本轮未使用任何账号凭据；线上核验以部署产物为准：`annual-share-grid__stats` 的 flex/`1.5cqw` 样式、`profileTitle` 取值表达式均已出现在 `.output` 中，且构建产物内已无 `SCORE` 标签。

## 6. 追加：后台年度报告页（`0.64.0`）

用户反馈：后台点已有 viewer 账号的「生成报告」后进入一个空白/错误页，只有搜索框可用、其余什么都做不了。

只读取证（未使用任何管理员凭据，未改动业务数据）：

- 线上 nginx 访问日志（来源 IP `112.22.86.67`，Referer `https://viewer.sakura-bot.cn/admin/taiko/annual-summaries`，Android 手机 UA）显示 19:56:35 查询 `Saki` → 19:56:41 `POST /api/admin/annual-summaries/build` 200 → 19:56:41 起报告资源（`/title.png`、`/to_end.png`、`/Loop/0..48.png`、年度 BGM）立即加载 → 19:56:59 资料卡请求 → 19:57:26–19:57:58 逐页加载 timeOfDay / speedProfile / pound / highScore / milestones。即报告本身确实打开并可翻页。
- 同一窗口的三次 `GET /api/account/my-don`（19:51:06 / 19:53:03 / 19:56:59）都返回操作者本人 580631 字节的 MyDon，而管理员专用路由 `GET /api/admin/annual-summaries/:summaryId/my-don` 全时段调用次数为 0。
- 只读核对 `web_annual_summaries` / `web_annual_summary_jobs`：19:50–19:57 三次操作中只有 19:54:36 的任务（user 598，咕咕）成功落库并生成 summary 行，文件存在；当天没有其它 summary 行。因此「点了生成报告却没有报告」的情形是真实存在的。
- 用真实页面组件 + 真实落库 summary（`annual_35a25203a011597698ef23ea`）离线复现：报告页可以正常渲染开场与 20 页幻灯片，报错路径只会渲染一句错误文本且没有任何可用操作。
- 线上路由存在性核验：`GET /api/admin/annual-summaries/:summaryId` 在本地部署实例返回 401「请先登录太鼓管理后台」（说明路由已注册），错误页状态来自接口失败而不是路由缺失。

修改内容（`0.64.0`）：

- `AnnualShareGrid.vue`：资料卡重试地址不再写死 `/api/account/my-don`。新增 `profileFallback: 'viewer' | 'summary'`，`viewer` 保持所有者页面与导出的既有行为，`summary` 改用该年度总结自己的 `GET /api/admin/annual-summaries/:summaryId/my-don`，因此管理员预览他人报告时不可能再回退到自己的头像。
- `PosterSlide.vue` / `StoryPlayer.vue`：新增同名可选 prop（默认 `viewer`）并向下传递，所有者页面行为不变。
- `pages/admin/taiko/annual-summaries/[summaryId].vue`：加载失败时不再只剩一句白字——改为站内场景样式的错误态，固定显示服务端错误信息与两个操作（重新加载、返回管理）；报告正常时保留固定「返回管理」按钮；`StoryPlayer` 使用 `profile-fallback="summary"`。

新增 `taiko_viewer/scripts/verify_admin_annual_report.mjs`（5 个用例，离线渲染真实页面与真实 grid，不连后端/数据库）：

| 用例 | 断言 |
|---|---|
| player | 报告渲染并有幻灯片；只请求 `/api/admin/annual-summaries/:id/my-don`，绝不请求 `/api/account/my-don` |
| error | 显示服务端错误文案，且始终提供 `重新加载` / `返回管理` |
| summary-missing | 所有者形状的 MyDon 只请求一次，不回退到 viewer 地址 |
| grid-admin | 管理员作用域下不会请求操作者本人的 MyDon |
| grid-owner | 所有者作用域仍保留 `/api/account/my-don` 回退 |

结果：`Admin annual report verification PASS (5 cases)`；同时 `P3.3 poster layout verification PASS (9 cases)`、`npm run test:annual` 均通过。

发布：`0e6ea2 0.64.0 修正后台年度报告资料卡回退与管理端恢复操作`，标准部署脚本 exit 0，本地与线上 appVersion 均为 `0.64.0`；无关的 `title_song_relations.json` 同样可逆隔离并在部署后原样恢复（SHA-256 一致）。

说明：报告页自身能渲染这点已用真实数据离线复现；用户描述的「空白错误页」对应的是接口失败时的错误态，本次已让该状态可读、可重试、可退出。若线上仍出现空白，请提供该次点击的时间点，我可以按 nginx 日志继续定位具体是 404（总结不存在）还是文件缺失（410）。


## 7. 追加：后台年度报告入口改为站内预览（`0.65.0`）

用户在 `0.64.1` 上线后反馈问题依旧，并明确要求：不必跳转导航，做成和「无 viewer 账号」一样的预览也可以。

处理：`pages/admin/taiko/annual-summaries.vue` 不再对任何报告做路由跳转。

- 「查看报告」：`openPreview(summaryId)` 直接拉取 `GET /api/admin/annual-summaries/:summaryId` 并把结果放进 `preview`，由页内同一套 `StoryPlayer` 预览渲染——与「仅预览」路径完全一致，不经过任何路由分包，因此弱网下不会再出现「点了没反应」。
- 「生成报告 / 强制重建」：任务完成后同样走 `openPreview`，不再跳转。
- 预览层补回缺失的样式：固定全屏覆盖（`position: fixed; z-index: 2000`），左上角固定「返回管理」按钮，关闭时把 `previewStarted` 复位。此前页内预览（taiko ID 预览路径）只是页面流里的一个裸 `div`，既没有覆盖层样式也没有可靠的关闭入口。
- 预览使用 `profile-fallback="summary"`，操作者不会看到自己的资料卡头像。
- `pages/admin/taiko/annual-summaries/[summaryId].vue` 予以保留：直接访问该 URL 时仍可打开报告，失败时显示错误文案 + `重新加载` / `返回管理`。

验证：`scripts/verify_admin_annual_report.mjs` 现为 5 个离线渲染用例 + 入口源码断言，其中断言「列表页源码不得出现 `navigateTo`」「必须通过 `openPreview` 打开报告」「预览必须带 `profile-fallback="summary"`」；`P3.3 poster layout verification PASS (9 cases)` 同时通过。

新增 `tests/fixtures/annual-summary.sample.json`：真实线上 summary 载荷（昵称等身份信息已脱敏），作为三个页面校验脚本的共用夹具，避免再用人工拼装的假数据。

发布：`8219438 0.65.0 后台年度报告改为站内预览打开`，标准部署脚本 exit 0，线上 appVersion `0.65.0`；无关的 `title_song_relations.json` 依旧可逆隔离并原样恢复（SHA-256 一致）。
