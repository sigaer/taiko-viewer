# 歌曲详情真实组件预览

日期：2026-10-20。分支：`design/song-detail-preview-20261020`。基线：Viewer 0.86.2 / `1c522c1`。**待视觉确认，仅本地预览，不部署。**

先打开[同视口新旧对照](index.html)。它包含长曲名、有／无里谱、已登录有成绩、已登录无成绩、未登录，以及中日文的 1440×1000 桌面和 390×844 手机画面。左侧为现有 0.86.2 源码，右侧为真实 Vue 实现，两侧运行同一 Nuxt 布局并使用相同输入。

[启动真实页面的说明](../../preview/song-detail/README.md)提供本地预览命令、路由和状态切换。它读取本分支实际的 Vue 页面与组件，保留 SSR 和客户端挂载；没有使用原型 HTML 或 `refine.js` 代替真实页面。

本机交付在 `/var/tmp/viewer-song-preview-20261020` 独立工作树，`pjskClient` 和原 Viewer 主工作区中没有 `preview`。普通用户可从任意目录执行：

```bash
sudo bash /var/tmp/viewer-song-preview-20261020/preview/song-detail/run.sh
```

root 终端省略 `sudo`。打开 `http://127.0.0.1:3208/songs/1455?previewState=scores`；远程编辑器需先转发服务器端口 `3208`。权限和停止方法见上方启动说明。

| 长标题曲目、有成绩 | 桌面对照 | 手机对照 |
| --- | --- | --- |
| 中文 | [原尺寸并排图](screenshots/compare-zh-1440.png) | [原尺寸并排图](screenshots/compare-zh-390.png) |
| 日本語 | [原尺寸并排图](screenshots/compare-ja-1440.png) | [原尺寸并排图](screenshots/compare-ja-390.png) |

## 空间关系

沿用 revision-v2 的完整标题宽度、轻量难度导航、谱面主列和辅助阅读列。移除歌曲页重复的泛化页头，将曲绘缩为桌面 112px、手机 64px，给曲名和原名完整的可用宽度；版本括号前允许自然换行。

主列显示**当前难度的真实谱面 PNG**，上方直接提供原有播放器和完整谱面入口。难度选择同时统领谱面、音轨、当前成绩、分析与社区上下文；不再把五组谱面链接和五组播放器卡片重复平铺。所有已有难度仍可通过页签访问，键盘方向键、Home、End 同样可用。

桌面主列与辅助列相隔 40px；成绩保留数值重点，讨论按内容自然结束。手机改为单列，先读谱面和试听，再接成绩、讨论及谱面评价。分析和歌曲资料使用具名展开项，保留全部内容。

背景只在歌曲区域采用轻微暖白到青白的层次，白色谱面表面承担主要操作；真实曲绘、谱面音符、红色主要按钮和青色链接提供色彩。没有扩大 Hero，也没有添加空白装饰卡片。全站原有侧栏、导航、字体与其他页面主题保持原样。

## 保留的功能

| 能力 | 新页面中的位置与语义 |
| --- | --- |
| 难度、谱面、练习 | 有里谱显示五项，无里谱显示四项；每项继续使用对应 PNG 文件夹、星级与 `/ourtaikoview/:song/:difficulty` 路由。完整图片仍在新标签页打开，内嵌节选可横向浏览，纵向滚动继续阅读页面 |
| 试听与分支 | 鼓点、混音、纯音乐全部保留；复用 `useSongBranchAudio` 的基础／分支 URL 与合并标签，鼓点共享音量和静音仍在 |
| 下载 | 原 `tjaBundleUrl` 存在时提供 TJA+OGG 下载；不存在时不制造下载或播放器能力 |
| 成绩 | API 仍返回原来的全部难度记录；界面显示当前难度。分数、星级、判定、通关／全连／全良状态、连击、连打、游玩次数及日期均保留，另可进入既有全部成绩页面 |
| 目标 | `RecommendationGoalAction` 及处理器未修改；仍须登录、带推荐 token 且当前难度匹配来源。直接访问歌曲页不增加通用目标按钮 |
| 分析 | 原六维雷达和数值不改算法；已有 V2 定数入口继续按原 shelf status 条件保留；雷达扩充标签绘图区，避免文字被裁切 |
| 社区 | 难度评价、标签、攻略提示、点赞／举报、相关讨论、全部讨论与发帖入口均保留原组件和事件连接 |

## 必要的局部调整

- [歌曲页](<../../taiko_viewer/pages/songs/[id].vue>)：用显式 Vue 结构组织标题、当前谱面、阅读侧栏与社区；仅该路由设置 `hidePageHeader`。分类日语采用现有歌曲列表用语，不改变目录值。
- [难度选择](../../taiko_viewer/components/song/SongDifficultyTabs.vue)、[真实谱面](../../taiko_viewer/components/song/SongChartPreview.vue)、[试听](../../taiko_viewer/components/song/SongAudioPreview.vue)：从原页拆出局部组件；试听继续调用原 composable，没有复制新的音频规则。
- [成绩](../../taiko_viewer/components/account/AccountSongScores.vue)、[相关讨论](../../taiko_viewer/components/forum/SongRelatedDiscussions.vue)、[谱面评价](../../taiko_viewer/components/ChartUgcSection.vue)：增加显式 `appearance="song-detail"` 外观，默认外观保留。样式均 scoped，歌曲 token 仅定义在页面根元素，未修改全局 CSS。

公开 1455 DTO 缺少 `max_combo`，但对应分析已有 `combo`。物量展示先读取目录值，缺失时只取同曲目、同难度的现有分析数值；没有用其他难度补造数值。无里谱时的无效 EDIT 深链接落回 ONI。谱面组件检查已完成加载的 SSR／缓存图片，避免挂载前 load 事件已经触发后仍显示“正在读取”。

## 数据与检查范围

公开歌曲 DTO 来自[来源清单](../../preview/song-detail/fixtures/sources.json)；谱面和音频使用已有静态资源。账号、个人成绩和社区空数据为合成，未读取生产私人记录。新旧对照使用同一套 fixture，不把它称为生产账号验收。

[现有页采集记录](before-capture.json)与[新版采集记录](after-capture.json)各覆盖 24 个正常展示组合；有成绩状态另附完整长页。图中的差异来自真实组件，截图没有替换谱面内容或注入原型样式。固定手机底栏在浏览器长截图中留在原视口位置，首屏对照使用标准视口图。

[局部交互检查](interaction-check.json)记录难度切换、对应 URL、里谱成绩、键盘焦点、分析、真实混音播放、讨论／下载／评价入口、无里谱深链接、目标来源条件、登录衔接和分支音轨。补充截图：[展开分析](screenshots/after-analysis-zh-1440.png)、[里谱](screenshots/after-edit-zh-1440.png)、[目标入口](screenshots/after-goal-entry-zh-1440.png)、[手机分支音轨](screenshots/after-branches-zh-390.png)。

预览根不加载业务 server 目录，非 GET/HEAD 的 API 请求统一返回 405。目标入口检查只证明原组件和来源条件被保留，不伪造目标预览／提交成功；真实写入服务、认证、算法和数据库不在本轮验证范围。没有重跑后端业务套件，也没有创建新的发布 Gate。

本轮保留 0.86.2 版本；尚未合入 main、推广到首页／练习／成长或部署。生产实施需先完成最终视觉确认，实际准备发布时再按变更性质递增版本。
