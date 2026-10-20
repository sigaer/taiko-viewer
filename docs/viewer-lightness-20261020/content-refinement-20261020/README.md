# 页面内容收口

沿用 `design/song-detail-preview-20261020`，以 `63fda22` 为对照基线。公共容器、外围边距、行高和推荐行密度保持不变。未合入 main、未部署、未改版本。

预览入口：`http://127.0.0.1:3208/__review`。启动与远程端口转发见 [预览 README](../../../preview/song-detail/README.md)。入口保留上一轮公共基础及歌曲页历史对照，并新增本次八页的前后对照。

| 页面 | 本次收口 |
| --- | --- |
| 歌曲列表 | 桌面两列紧凑对象行不变；页面、导航与面包屑统一为“实装歌曲”（日文“実装曲”）。60 首完整目录未删条目、未改排序。 |
| 歌曲详情 | 保留原实现，补验成绩加载完成后的分数、判定、明细、讨论及实际谱面节选。节选已经包含小节和音符，保留展开、完整谱面、播放器、音轨、下载与分析入口。 |
| 普通推荐 | 保留筛选与 20 条结果的密度；目标确认、未玩来源限制、列表／同批图片及跳转不变。 |
| 个人资料 | 短面板按自身内容结束；“当前使用”呈现为状态，其余账号仍保留切换操作。头像上传与恢复默认收进“更换头像”，原裁剪、上传与绑定处理脚本保留。 |
| 首页 | 只建立一次个人上下文；六维数值进入“能力详情”，空的今日记录按需查看；实际变化与实际今日记录继续直接展示。未绑定／无成绩不再重复问候开场。 |
| 设置 | 主题只有一个标题和开关；缓存用条目与估算大小摘要、按需明细。清空仍清除全部 localStorage，不改变为选择性清理，也不清除 Cookie。 |
| 成绩 token 指南 | 公共页头承担唯一大标题，正文去掉重复标题及英文眉题；安全说明、字段、调用示例和错误说明保留。其他开发者页面未深度迁移。 |
| 社区 | 补入 16 条明确合成 DTO，现有首页按原规则最多显示 12 条；验证攻略／热门／精选筛选。前后均使用同一有内容列表。卡片徽章、作者与正文的层级仍列入后续迁移，未将空列表或公共适配算作内容完成。 |

五个 PNG 原样复制自用户提供的 `assets/icons/diff/1.png`–`5.png`，存放在 `taiko_viewer/public/icons/difficulty/`，网页路径为 `/icons/difficulty/1.png`–`5.png`；依次对应 kantan、futsuu、muzukashii、oni、inner_oni。合计约 32 KiB，不引入字体包、图标库或图片滤镜。

## 同视口对照

统一使用本机 Linux Chromium 113.0.5672.126、100% 缩放、deviceScaleFactor=1。414×846、390×844、1440×1000 浅色中文，以及 1440×1000 暗色日文，共八页 × 四种条件 × 前后两版。额外检查 820、1280、1920 的内容适配。这些是模拟视口，不是用户手机实测。

- [歌曲详情：前](screenshots/before-song-414-light-zh.png) / [后](screenshots/after-song-414-light-zh.png)；[成绩与讨论：前](screenshots/before-song-414-light-zh-scores.png) / [后](screenshots/after-song-414-light-zh-scores.png)；[真实节选](screenshots/after-song-414-light-zh-chart.png)。本页没有为制造差异再做视觉修改。
- [资料：前](screenshots/before-profile-1440-light-zh-full.png) / [后](screenshots/after-profile-1440-light-zh-full.png)。短面板不为对齐高度制造留白。
- [首页：前](screenshots/before-home-414-light-zh.png) / [后](screenshots/after-home-414-light-zh.png)。先看到个人上下文与可用内容，减少多个空区块轮流开场。
- [设置：前](screenshots/before-settings-414-light-zh.png) / [后](screenshots/after-settings-414-light-zh.png)；[指南：前](screenshots/before-developer-414-light-zh.png) / [后](screenshots/after-developer-414-light-zh.png)。
- [社区有内容完整列表](screenshots/after-community-414-light-zh-full.png)。保留原上限与排序，不用删条目改善截图。

首页状态单独检查：[首次记录／证据不足](screenshots/content-home-scores-414.png)、[有实际合成变化](screenshots/content-home-changes-414.png)、[同步后没有新变化](screenshots/content-home-unchanged-414.png)、[近期变化读取失败](screenshots/content-home-recent-failure-414.png)、[首页读取失败](screenshots/content-home-failure-414.png)、[未绑定](screenshots/content-home-unbound-414.png)、[无成绩](screenshots/content-home-empty-414.png)、[未登录](screenshots/content-home-guest-414.png)。预览入口也可选择这些状态；不改变历史事实判断逻辑。

## 验证与边界

浏览器核对保留原 11 项共享交互检查，并补验头像原裁剪／取消、自然面板高度、缓存明细与清空、首页状态区分、社区有内容筛选和额外宽度。数据来自公开歌曲缓存及合成个人资料；预览写入仍返回 405，不模拟保存成功。

资料页与首页的 `<script setup>` 和 `63fda22` 逐字节一致。实际资料组件另通过 29/29 项绑定异步浏览器回归，覆盖迟到响应、账号／输入／挑战代际、卸载、busy 归属和主动重试。此项使用隔离测试 MySQL、真实 Vue／Element Plus、API composable 与正式绑定 HTTP／SQL；Nuxt shell 和无关展示由既有宿主提供，不等于生产登录、多标签页和完整 Nuxt 认证链路证明。未重跑无关灾备、算法和生产数据套件。

运行编号、源码 hash、资源采样与结果见 [validation.json](validation.json)、[content-checks.json](content-checks.json)、[绑定矩阵](binding-browser-matrix.json)。性能数据为受限 QA 过程采样，不能代替真实用户设备测量。唯一后续范围仍是 [迁移表](../migration.md)；首批可独立交付，73 页不作为深度迁移完成前置条件。
