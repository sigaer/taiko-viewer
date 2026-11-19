# PC 首页双栏布局验收

2026-11-19（Asia/Shanghai）。基线 `7ad6c690`，候选分支 `fix/home-desktop-columns-20261119`，版本 `1.15.1`。按最新要求提交并推送独立分支，不创建 PR；没有合并 main 或部署。

## 修改范围

| 文件 | 修改 |
| --- | --- |
| `pages/index.vue` | 仅有个人数据的登录首页容器上限从 1000px 放宽至 1360px，保留导航和其他页面宽度。 |
| `today/SignedIn.vue`、`home/PlayerGrowthSurface.vue` | 将原有最新歌曲、当前动态通过插槽接入布局，保留请求、属性和事件。 |
| `today/Board.vue` | 左栏欢迎、Rating、现有近期变化、推荐、最新歌曲；右栏今日进展、当前动态。真正的两列 Grid，7:3、24px 间距，两栏顶部对齐和 `min-width: 0`。既有目标卡仍保留在 Rating 后。 |
| `today/Hello.vue` | 根据主栏实际宽度安排问候与原有版本报告 Banner。 |
| `today/Profile.vue` | 两个等宽图表区域，绘图中心对齐，成长建议和档案入口在右图下方居中。 |
| `ds/charts/Radar.vue` | 新增默认关闭的 `centered` 展示选项，仅首页启用；对称扩展 SVG viewBox，容纳外部标签并保持绘图中心。其他调用保持原样。 |
| `today/Plan.vue` | PC 三列轻量卡片，成绩和评级图标同区、移除可见评级名称、全宽独占一行的目标按钮。 |
| `package.json`、`package-lock.json` | 兼容布局修正，patch 升级至 1.15.1，依赖不变。版本取自 package，无需修改 `dev` 占位文字。 |

上述组件路径均相对于 `taiko_viewer/components/`，页面路径相对于 `taiko_viewer/`。没有修改算法、DTO、API、请求、权限、路由、活动数据、导航组件或部署脚本，也没有新增用户可见说明文案。

## 响应式规则

`growth-surface` 的实际内容宽度达到 **1000px** 才启用两栏，断点自然扣除左侧导航和页面留白。主栏最小宽度约 683px，可容纳三个推荐卡片。较窄时恢复原顺序：欢迎、Rating／目标、近期变化、今日进展、推荐、最新歌曲、当前动态。移动端保留原推荐列表、目标弹窗和底部导航交互。

## 前后截图

使用同一组合成账号 DTO、歌曲、评级、进展和动态，Chromium、DPR 1、浅色主题、中文、减少动画。截图中的封面为组件原有的默认封面；未替换成其他歌曲图片。基线使用未修改首页的本地 dev，最终截图使用本地生产构建产物；所有数据接口均由浏览器拦截，不连接真实账号数据库。

| 分辨率 | 修改前 | 修改后 | 完整页面 |
| --- | --- | --- | --- |
| 1600×900 | [前](screenshots/before-1600x900-ready.png) | [后](screenshots/after-1600x900-ready.png) | [前](screenshots/before-1600x900-ready-full.png) / [后](screenshots/after-1600x900-ready-full.png) |
| 1440×900 | [前](screenshots/before-1440x900-ready.png) | [后](screenshots/after-1440x900-ready.png) | [前](screenshots/before-1440x900-ready-full.png) / [后](screenshots/after-1440x900-ready-full.png) |
| 1366×768 | [前](screenshots/before-1366x768-ready.png) | [后](screenshots/after-1366x768-ready.png) | [前](screenshots/before-1366x768-ready-full.png) / [后](screenshots/after-1366x768-ready-full.png) |
| 390×844 | [前](screenshots/before-390x844-ready.png) | [后](screenshots/after-390x844-ready.png) | [前](screenshots/before-390x844-ready-full.png) / [后](screenshots/after-390x844-ready-full.png) |

## 验证

生产模式构建 **PASS**（`npm run build`，标准 4096MiB Node 堆，`run_build.sh` 隔离，退出 0，Nitro 入口生成）。首次失败和修正见文末。保留既有 BigInt/es2019、混合导入、chunk 体积和 PWA payload glob 警告；修正路径后无预渲染文件缺失错误。

最终生产产物浏览器矩阵 **16/16 PASS**（`qa-76b846d78ac3`）：1600/1440/1366 PC、390/320 手机、767/1024/1100/1280/1920 宽度，桌面及手机空数据、成长接口失败、已有目标、1440px 窗口但内容仅 950px、日文深色。未发现页面横向滚动或浏览器异常。接口失败场景的预期 HTTP 503 不记为页面异常。

| 视口 | 原内容宽度 | 新内容宽度 | 左栏 / 右栏 | 两栏顶部 |
| --- | --- | --- | --- | --- |
| 1600×900 | 1000px | 1360px | 935.19 / 400.81px | 均为 84px |
| 1440×900 | 1000px | 1300px | 893.19 / 382.81px | 均为 84px |
| 1366×768 | 1000px | 1226px | 841.39 / 360.61px | 均为 84px |

以上均为 7:3、栏间距 24px。浏览器还断言最新歌曲使用左栏完整宽度、SVG 实际绘图中心（`getScreenCTM()`）相对于各自半区横向误差小于 1px、三张卡片等宽与按钮底部对齐、评级图标保留但名称不显示、Banner 保持 800:239 比例。几何数据见 [before-layout.json](before-layout.json)、[after-layout.json](after-layout.json)。

交互回归 **PASS**：点击设为目标、选择类型、确认后发出预期的 POST（含歌曲/难度/类型/版本及原目标字段），返回后即时显示目标卡；实际点击成长档案、这一周、最新歌曲并检查目标 URL，返回首页成功；当前动态卡片在新窗口打开原外链。手机保留单栏的进展/推荐/最新/动态顺序。

附加状态截图：[空数据](screenshots/after-1440x900-empty.png)、[成长读取失败](screenshots/after-1440x900-failed.png)、[已有目标](screenshots/after-1440x900-active.png)、[日文深色](screenshots/after-1440x900-ready-dark-ja.png)。

相关测试：`reworkStage2`、`dsCharts`、`dsRank`、`homeDailyProgress`、`homeGrowthFeedback`、`homeDeepState`、`homePresentation`，**106/106 通过**。包括真实 Vue 组件的目标状态、刷新和过期响应保护测试。

`git diff --check`、package/lock 三处版本一致性检查均通过。浏览器运行 55.3 秒，250ms 采样 cgroup 峰值约 555MiB，OOM/oom_kill 均为 0，见 [browser-resources.json](browser-resources.json)。标准构建采样观察到的内存最高约 3.97GiB，OOM/oom_kill 均为 0；本机内核不提供 `memory.peak`，采样值不宣称为绝对峰值。所有自建服务器和浏览器已退出，3219 端口无监听。构建与 QA 没有并行。

重跑浏览器验收（先在独立工作区完成构建）：

```sh
bash scripts/memory/run_qa.sh /absolute/path/to/node taiko_viewer/scripts/verify_home_desktop_layout.mjs --built
```

`--before` 仅采集旧版三组桌面和一组手机基线；省略 `--built` 启动本地 dev。脚本使用现有隔离 runner、私有运行目录、单浏览器和顺序场景，运行后关闭浏览器和服务器，截图与报告写入 runner 的 evidence 目录。

## 验证边界与人工验收

目标 POST 和动态跳转在本地网络夹具中完成，用于回归展示层事件、请求参数、弹窗和导航行为，不代表真实后端写入验证。没有运行线上 smoke 或真实设备测试。当前动态 Banner 在原实现中是图片及标题，没有点击链接；本次保留原样，验证已有动态卡片的外链。原有近期变化、目标卡和段位入口均保留。

本轮范围内没有未解决的实现问题；最终视觉验收由人工确认。真实设备和真实账号后端行为不在本轮本地 UI 验证证明范围内。

首次构建使用 Node 默认约 2GB 堆，在 Nitro 最终打包阶段 OOM；独立工作区还缺少 `songs/song_data.json`，产生预渲染读文件错误。随后按仓库发布脚本既有 `--max-old-space-size=4096` 配置和原有 4/5GiB 构建 cgroup 重跑，只读指定公共歌曲文件，没有扩大 cgroup 上限或连接生产 DB。构建产物留在工作区，不进入 Git。
