# 成长档案与周报 · Viewer 0.87.3

基于远程 main `b6183b7c46b789e1eb2728760e7c1c91268747b6`（0.87.2，PR #29），在独立分支 `design/viewer-growth-weekly-20261021` 完成。原预览工作区、WIP 与备份未改动。唯一迁移清单为 [migration.md](../viewer-lightness-20261020/migration.md)；首页深层状态、My Taiko 总览及其他页面仍属后续批次。

| 页面 | 实际实现 | 保留的语义 |
| --- | --- | --- |
| 成长档案 | `pages/my/growth.vue`、`components/PassportMetricChart.vue` | 1000px；当前 Rating／六维／记录起点与所选历史周期分开；变化优先、歌曲／难度／日期及依据紧随；关注方向历史、目标和带难度的推荐入口保留 |
| 周报 | `pages/my/weekly.vue` | 800px；服务端周日期与汇总、具体亮点、能力变化、当前建议；账号／绑定／周次变更清旧结果并重新读取，迟到响应与卸载回调不污染新上下文 |
| 成绩分页 | `pages/account/songs.vue` 的分页模板与局部样式 | 总数／每页条数与完整前页／页码／后页分组；共用原分页模型，其他成绩布局及处理器不变 |

正文、次级文字、表面、边界与焦点均读取现有语义变量。未调整公共容器、20px 手机边距、公共配色或导航；未改变 API、Contract、权限、Rating、历史回放、事实去重或周报主题算法。

## 数据与状态

成长趋势继续调用 `selectPassportPeriod()`，从一次返回的 `shared.views` 切换 30／90／180／365 天；六维和 query 切换没有额外历史请求。`passportMetricRuns()` 未修改：每日冻结值不重算，版本元数据变化不断线，缺失数值断线。当前缺失维度显示“暂无记录”，不会显示为 0。近期事实明确标出实际覆盖日期，与长周期趋势分开；只观察到的目标继续标为确认日，无时间信息显示日期未知。保留精选顺序、展开／收起和剩余依据。

周报汇总取 composer 返回的 `totals`：`distinctCharts` 是有归属周内事实的不同谱面数；PB／FC／DF／评价提升为去重后的对应事实数量；完成目标取既有归因结果。汇总不从四条可见亮点反算，不解释为游玩次数。当前周服务端结束日期截至业务日，历史完整周使用周末；前端直接显示服务端起止日期。能力差值仍只在 `measurementChange.compatible` 为真时展示，不可比较时说明实际版本／模型原因；与成长趋势连线规则分别处理。历史周中的 `currentNextAction` 明确写为当前建议。

基线真实 Vue 页面配合实际 `useViewerApiFetch()` 的隔离测试复现：成功绑定切换广播代次后，原周报没有新请求，仍呈现旧结果。浏览器也检查实际 Nuxt `$s` 状态。修复加入账号、绑定与周次上下文、同步清理、请求取消及迟到结果过滤；失败路径使用 setup 中捕获的 `t` 调用 `resolveViewerError()`。加载、请求失败及重试与事实空态分开。未绑定响应依据现有后端实际 400“请先绑定鼓众 ID”，匿名依据实际 401；合成接口不会把未绑定伪装成空成绩。

## 真实预览与同输入对照

准备当前锁定依赖后，在本工作区执行：

```sh
bash preview/song-detail/run.sh
```

入口 `http://127.0.0.1:3208/__growth-review`。通过 IDE 转发 3208 可打开。它使用真实 `/my/growth`、`/my/weekly`、`/account/songs`，可选中日文、浅暗与合成状态。预览没有生产配置，不转发写请求。需要查看外置前后截图时，将证据目录显式传入受控命令：

```sh
bash scripts/memory/run_dev.sh /usr/bin/env \
  VIEWER_BATCH2_EVIDENCE=/home/sigaer/taiko/qa-vault/evidence/viewer-growth-weekly-20261021 \
  /www/server/nvm/versions/node/v24.13.0/bin/node \
  taiko_viewer/node_modules/@nuxt/cli/bin/nuxi.mjs dev preview/song-detail \
  --host 127.0.0.1 --port 3208 --no-fork --dotenv preview/song-detail/.env.preview-empty
```

两页各有 1440px 浅色中文、390px 浅色中文、414px 暗色日文的同输入前后图，入口按组显示；另有 414px 中日文分页对照。截图原文件和运行记录位于仓库外证据目录，Git 仅保留可重跑 fixture、用例和本说明。生产入口不加载 fixture 服务或评审路由。

验证用例：`tests/growthPageState.test.mjs`（真实 SFC 与实际 API 包装器，受控传输）、既有 `passportNarrative.test.ts`、`passportFinalUx.test.ts`、`growthPassport.test.ts`、`growthWeekly.test.ts` 及当前 CI。浏览器脚本 `preview/song-detail/review/growth.py before|after --checks`；相关测试入口 `growth_tests.py`，均通过 `scripts/memory/run_qa.sh` 串行执行。图表点选、前后按钮、键盘、长文案与查询前进后退在真实页面核对。真实账号、成绩、绑定及目标写入为 0；隔离传输中的绑定广播不代表生产写流程验收。

最终运行数量、归档校验值、生产构建与发布记录以本说明后面的最终验证记录和仓库外 `delivery.json` 为准。

## 最终验证记录

- 166 项当前 CI／相关测试通过；包含真实组件的账号／绑定／周次隔离、迟到成功／失败、退出及卸载、失败恢复、四周期／六维本地选择、精选展开和 SVG 点选择回归。Contract 绑定生成检查和跨语言 Golden 通过。
- 25 个浏览器状态、44 项检查通过；两页各三组正常前后图及两组成绩分页图共八组，实际 API 输入 JSON 哈希逐组一致。覆盖加载、失败重试、匿名、未绑定、无点／单点／缺失维度、有限覆盖、完整历史周、不可比较和无建议。补充大精选集合只增加预览状态，另验证其正常输入哈希未改变。
- 正常 `npm run build` 通过（157.67 秒），使用业务入口；检查产物无合成 fixture 或本地评审路由。显式使用验证可用的 `127.0.0.1:33233` 代理，未变更全局网络、依赖或资源预算。
- 浏览器及构建串行使用现有资源包装，预览进程均已退出。代表浏览器 cgroup 采样峰值约 1.19 GiB，无 high／max／OOM 事件；原始限额及资源记录留在 QA vault。截图为 Linux Chromium 模拟视口，不代表真机。
- 实现、fixture 和测试源文件哈希在 `evidence-manifest.json`；原始截图、日志、生产构建记录和同输入校验归档为 `evidence.tar.gz`，SHA-256：`1660d0ab23389e379badd735b9f23ce33d31920d081a111685699ea37788f2b5`。

证据目录：`/home/sigaer/taiko/qa-vault/evidence/viewer-growth-weekly-20261021`。其中 `index.html` 可离线查看前后截图；最终 PR／合并 SHA、受控部署、只读线上检查及回滚运行产物记录写入同目录 `delivery.json`。这些外置发布记录不会被当作尚未发生的通过结果。
