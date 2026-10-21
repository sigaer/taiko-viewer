# 首页＋My Taiko 批次：共享歌曲条目

本增量基于 main `86de23f311fc29328b7b7aae93a63bc764b9c125`（0.87.3），独立分支 `design/viewer-home-my-20261021`，工作区 `/var/tmp/viewer-home-my-20261021`。本次仅完成首页今日推荐与普通推荐的共享条目，按兼容 UX 修整准备 0.87.4；首页深层状态和 My Taiko 其他内容没有据此标为完成。唯一迁移清单仍为 [migration.md](../viewer-lightness-20261020/migration.md)。原预览、WIP 和备份保留。

| 实际文件 | 调整 |
| --- | --- |
| `taiko_viewer/components/RecommendationSongItem.vue` | 以既有普通推荐行提取纯展示组件：56px 原比例封面、可换行标题、难度／可选星级、标签／详情 slot、与链接并列的操作区；公共色值、轻分隔、44px 按钮 |
| `taiko_viewer/components/home/PlayerGrowthSurface.vue` | 今日推荐接入共用行，当前成绩在详情区；目标按钮／缺失或空选项说明位于同一条目；原目标处理器、三态、已选、忙碌、冲突及焦点流程保留 |
| `taiko_viewer/pages/tools/recommend.vue` | 普通列表接入共用行，保留标签、完整原列表及排序、难度导航和有权限时的推荐凭据；目标 tab 的脚本、模板与样式不变 |
| `taiko_viewer/components/RecommendationGoalAction.vue` | 仅给原触发按钮加公共展示标记，并同步绑定 dialog DOM ref；preview／确认／冲突／身份与凭据处理器未改写 |
| `taiko_viewer/tests/recommendationSongItem.test.mjs` | 真实 SFC 展示、可选字段、链接与按钮结构、原目标失败重试及凭据、Suspense 下 DOM ref 回归；沿用既有身份回归 |

共用组件只接收 props 与 slots，不读取 API，不补零，不合并两边状态机。没有新增后端请求、来源能力、推荐算法或权限；普通数量与目标 tab 能力保持，歌曲链接继续携带对应难度。手机操作区空间不足时在条目内部另起一行；不把按钮嵌入链接，也不裁切长曲名。

## 对照与状态验证

使用同一首合成长标题歌曲：1455／里谱／10★，首页保留当前 980,000 分，普通推荐保留原标签。两入口各覆盖 1440px 浅色中文、390px 浅色中文、414px 暗色日文，共六组前后对照；实际输入 JSON 哈希与歌曲／难度序列逐组一致。首页仍展示原三条，普通推荐仍展示原二十条。

真实页面检查包含歌曲跳转、目标按钮不触发导航、目标选项缺失／空数组／可用、不可创建、44px 按钮、手机完整标题与操作区域、busy、保存失败恢复及已选。普通推荐另覆盖 preview 失败重试、推荐凭据、确认冲突失效、绑定失效清空和重新取得推荐后的确认成功。成功写操作只由隔离的 Playwright route 或组件受控响应返回，不转发到任何后端；真实账号、成绩、绑定和目标写入为 0。

检查中在 0.87.3 对照源码也复现了旧问题：绑定失效并重新加载推荐后，DOM 中已有 dialog，但字符串 template ref 仍为空。同步 function ref 修复节点绑定，原业务脚本保持一致。新增真实 Vue Suspense 回归复现父层延后 post-render 效果的情况，确保节点绑定无需等待 mounted 效果。基线失败记录独立归档，不计为通过结果。

## 可运行预览

准备当前锁定依赖后运行 `bash preview/song-detail/run.sh`，打开 `http://127.0.0.1:3208/__song-rows`，从入口进入真实首页和普通推荐。需要显示外置截图时，使用现有资源包装显式传入目录：

```sh
bash scripts/memory/run_dev.sh /usr/bin/env \
  VIEWER_BATCH2_EVIDENCE=/home/sigaer/taiko/qa-vault/evidence/viewer-home-my-20261021 \
  /www/server/nvm/versions/node/v24.13.0/bin/node \
  taiko_viewer/node_modules/@nuxt/cli/bin/nuxi.mjs dev preview/song-detail \
  --host 127.0.0.1 --port 3208 --no-fork --dotenv preview/song-detail/.env.preview-empty
```

隔离 fixture 仅用于 opt-in 预览；正常应用构建不加载它或本地评审路由。可重跑浏览器脚本为 `preview/song-detail/review/song_rows.py before|after --checks`，`--source` 可指定未修改基线，`--entry-only` 验证入口。所有 QA 通过 `scripts/memory/run_qa.sh` 串行执行，构建使用既有 `run_build.sh`。截图为 Chromium 模拟视口，不代表真机。

原始截图、JSON 与日志在仓库外 `/home/sigaer/taiko/qa-vault/evidence/viewer-home-my-20261021`。Git 保留组件、fixture、回归和本说明；归档与最终提交由 `evidence-manifest.json`、`candidate-audit.json` 绑定，最终发布状态记录在外置 `delivery.json`。

## 最终候选验证

170 项当前 CI／相关测试、Contract 绑定生成及跨语言 Golden 通过；六组同输入前后页面、36 项浏览器检查和真实预览入口通过，页面错误为 0。正常业务入口 `npm run build` 通过（154.65 秒），产物不加载合成 fixture。原处理器 script、目标 tab 尾部模板／样式、后端／权限／算法、公共主题／容器及依赖图均与基线核对一致。

原始证据归档 `evidence.tar.gz`，SHA-256：`b07ea1a888e4e72b6aa619240248d92a77bdc6977592302ce93734c55fe9cdd2`。源码哈希和逐文件证据索引在外置 `evidence-manifest.json`，`index.html` 可离线查看前后图。所有临时服务在验证后退出。最终 PR、提交、审查、部署及回滚运行产物以 `delivery.json` 为准；此处不预先声称尚未发生的发布结果。
