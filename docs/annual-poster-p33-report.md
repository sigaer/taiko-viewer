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
