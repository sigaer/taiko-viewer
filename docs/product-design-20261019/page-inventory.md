# 页面清单与真实浏览器截图

基线0.86.2。桌面1440×1000、手机390×844；中日文另列。当前共61个记录视图：33个线上匿名视图、3个真实移动UA补充视图、21个当前生产构件的合成数据视图、4个日语合成数据视图。另有歌曲下部和年度故事截图。

- **线上匿名**：不登录、不借用私人Cookie；记录最终地址，登录或设备跳转本身也是证据。
- **手机视口**：普通响应式检查使用390宽的桌面UA；年报另外用移动UA与touch模拟，避免把窄窗口误认为移动设备。
- **合成展示**：同一生产构件启动本地Nuxt，使用合成账号与DTO，数据库地址为本地关闭端口。证明布局与给定状态，不证明生产权限或算法。
- **合成日期**：Growth等fixture使用10月7日样本；不是本轮实际玩家活动。Annual fixture的统计周期不用于判断生产真实周期。
- **图片边界**：B30与进度图主要检查入口、参数、加载与图片槽位；本地进度成功占位PNG不是实际生成图的美术证据。没有重新生成私人报告或成绩图片。

[全部截图画廊](../../../qa-vault/evidence/viewer-product-design-20261019/gallery.html)按页面列出。前缀live表示线上、fixture表示合成；同一截图问题的修复归属见[audit.md](audit.md)，不按截图重复立项。

## 页面记录

| 视图 | 实际请求路由 | 最终路由 | 证据类型 | 对应组件 | 截图 |
| --- | --- | --- | --- | --- | --- |
| live-home-1440 | `/` | `/` | live-anonymous | `pages/index.vue / home/*` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-home-1440.png) |
| live-my-1440 | `/my` | `/my` | live-anonymous | `pages/my/index.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-my-1440.png) |
| live-songs-1440 | `/songs/available` | `/songs/available` | live-anonymous | `SongListContent.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-songs-1440.png) |
| live-song-1440 | `/songs/1455` | `/songs/1455` | live-anonymous | `pages/songs/[id].vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-song-1440.png) |
| live-scores-1440 | `/account/songs` | `/account/login` | live-anonymous | `pages/account/songs.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-scores-1440.png) |
| live-b30-1440 | `/tools/b30` | `/tools/b30` | live-anonymous | `pages/tools/b30.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-b30-1440.png) |
| live-recommend-1440 | `/tools/recommend` | `/tools/recommend` | live-anonymous | `pages/tools/recommend.vue / RecommendationGoalAction.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-recommend-1440.png) |
| live-progress-image-1440 | `/tools/progress` | `/tools/progress` | live-anonymous | `pages/tools/progress.vue / useToolChartImage` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-progress-image-1440.png) |
| live-passport-1440 | `/my/growth` | `/my/growth` | live-anonymous | `pages/my/growth.vue / PassportMetricChart.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-passport-1440.png) |
| live-weekly-1440 | `/my/weekly` | `/my/weekly` | live-anonymous | `pages/my/weekly.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-weekly-1440.png) |
| live-annual-1440 | `/annual` | `/` | live-anonymous | `pages/annual.vue / annual-mobile.global.ts` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-annual-1440.png) |
| live-annual-report-1440 | `/account/version-summary` | `/` | live-anonymous | `pages/account/version-summary.vue / StoryPlayer.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-annual-report-1440.png) |
| live-community-1440 | `/forum` | `/forum` | live-anonymous | `pages/forum/index.vue / ForumThreadCard.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-community-1440.png) |
| live-profile-1440 | `/account/profile` | `/account/login` | live-anonymous | `pages/account/profile.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-profile-1440.png) |
| live-api-guide-1440 | `/docs/score-token` | `/docs/score-token` | live-anonymous | `pages/docs/score-token.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-api-guide-1440.png) |
| live-home-390 | `/` | `/` | live-anonymous | `pages/index.vue / home/*` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-home-390.png) |
| live-my-390 | `/my` | `/my` | live-anonymous | `pages/my/index.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-my-390.png) |
| live-songs-390 | `/songs/available` | `/songs/available` | live-anonymous | `SongListContent.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-songs-390.png) |
| live-song-390 | `/songs/1455` | `/songs/1455` | live-anonymous | `pages/songs/[id].vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-song-390.png) |
| live-scores-390 | `/account/songs` | `/account/login` | live-anonymous | `pages/account/songs.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-scores-390.png) |
| live-b30-390 | `/tools/b30` | `/tools/b30` | live-anonymous | `pages/tools/b30.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-b30-390.png) |
| live-recommend-390 | `/tools/recommend` | `/tools/recommend` | live-anonymous | `pages/tools/recommend.vue / RecommendationGoalAction.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-recommend-390.png) |
| live-progress-image-390 | `/tools/progress` | `/tools/progress` | live-anonymous | `pages/tools/progress.vue / useToolChartImage` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-progress-image-390.png) |
| live-passport-390 | `/my/growth` | `/my/growth` | live-anonymous | `pages/my/growth.vue / PassportMetricChart.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-passport-390.png) |
| live-weekly-390 | `/my/weekly` | `/my/weekly` | live-anonymous | `pages/my/weekly.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-weekly-390.png) |
| live-annual-390 | `/annual` | `/` | live-anonymous | `pages/annual.vue / annual-mobile.global.ts` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-annual-390.png) |
| live-annual-report-390 | `/account/version-summary` | `/` | live-anonymous | `pages/account/version-summary.vue / StoryPlayer.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-annual-report-390.png) |
| live-community-390 | `/forum` | `/forum` | live-anonymous | `pages/forum/index.vue / ForumThreadCard.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-community-390.png) |
| live-profile-390 | `/account/profile` | `/account/login` | live-anonymous | `pages/account/profile.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-profile-390.png) |
| live-api-guide-390 | `/docs/score-token` | `/docs/score-token` | live-anonymous | `pages/docs/score-token.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-api-guide-390.png) |
| live-ja-home-390 | `/ja/` | `/ja/` | live-anonymous-ja | `pages/index.vue / home/*` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-ja-home-390.png) |
| live-ja-song-390 | `/ja/songs/1455` | `/ja/songs/1455` | live-anonymous-ja | `pages/songs/[id].vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-ja-song-390.png) |
| live-ja-api-guide-390 | `/ja/docs/score-token` | `/ja/docs/score-token` | live-anonymous-ja | `pages/docs/score-token.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-ja-api-guide-390.png) |
| live-annual-phone-390 | `/annual` | `/annual` | live-mobile-UA-anonymous | `pages/annual.vue / annual-mobile.global.ts` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-annual-phone-390.png) |
| live-annual-report-phone-390 | `/account/version-summary` | `/annual` | live-mobile-UA-anonymous | `pages/account/version-summary.vue / StoryPlayer.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-annual-report-phone-390.png) |
| live-developer-login-390 | `/account/developer` | `/account/login` | live-mobile-UA-anonymous | `pages/account/developer/index.vue / DeveloperApiGuide.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/live-developer-login-390.png) |
| fixture-home-ready-1440 | `/` | `/` | production-build-synthetic-DTO | `pages/index.vue / home/*` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/fixture-home-ready-1440.png) |
| fixture-my-ready-1440 | `/my` | `/my` | production-build-synthetic-DTO | `pages/my/index.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/fixture-my-ready-1440.png) |
| fixture-scores-ready-1440 | `/account/songs` | `/account/songs` | production-build-synthetic-DTO | `pages/account/songs.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/fixture-scores-ready-1440.png) |
| fixture-b30-form-1440 | `/tools/b30` | `/tools/b30` | production-build-synthetic-DTO | `pages/tools/b30.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/fixture-b30-form-1440.png) |
| fixture-recommend-list-1440 | `/tools/recommend` | `/tools/recommend` | production-build-synthetic-DTO | `pages/tools/recommend.vue / RecommendationGoalAction.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/fixture-recommend-list-1440.png) |
| fixture-progress-form-1440 | `/tools/progress` | `/tools/progress` | production-build-synthetic-DTO | `pages/tools/progress.vue / useToolChartImage` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/fixture-progress-form-1440.png) |
| fixture-passport-ready-1440 | `/my/growth` | `/my/growth` | production-build-synthetic-DTO | `pages/my/growth.vue / PassportMetricChart.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/fixture-passport-ready-1440.png) |
| fixture-weekly-partial-1440 | `/my/weekly` | `/my/weekly` | production-build-synthetic-DTO | `pages/my/weekly.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/fixture-weekly-partial-1440.png) |
| fixture-profile-ready-1440 | `/account/profile` | `/account/profile` | production-build-synthetic-DTO | `pages/account/profile.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/fixture-profile-ready-1440.png) |
| fixture-developer-guide-1440 | `/account/developer` | `/account/developer` | production-build-synthetic-DTO | `pages/account/developer/index.vue / DeveloperApiGuide.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/fixture-developer-guide-1440.png) |
| fixture-home-ready-390 | `/` | `/` | production-build-synthetic-DTO | `pages/index.vue / home/*` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/fixture-home-ready-390.png) |
| fixture-my-ready-390 | `/my` | `/my` | production-build-synthetic-DTO | `pages/my/index.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/fixture-my-ready-390.png) |
| fixture-scores-ready-390 | `/account/songs` | `/account/songs` | production-build-synthetic-DTO | `pages/account/songs.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/fixture-scores-ready-390.png) |
| fixture-b30-form-390 | `/tools/b30` | `/tools/b30` | production-build-synthetic-DTO | `pages/tools/b30.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/fixture-b30-form-390.png) |
| fixture-recommend-list-390 | `/tools/recommend` | `/tools/recommend` | production-build-synthetic-DTO | `pages/tools/recommend.vue / RecommendationGoalAction.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/fixture-recommend-list-390.png) |
| fixture-progress-form-390 | `/tools/progress` | `/tools/progress` | production-build-synthetic-DTO | `pages/tools/progress.vue / useToolChartImage` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/fixture-progress-form-390.png) |
| fixture-passport-ready-390 | `/my/growth` | `/my/growth` | production-build-synthetic-DTO | `pages/my/growth.vue / PassportMetricChart.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/fixture-passport-ready-390.png) |
| fixture-weekly-partial-390 | `/my/weekly` | `/my/weekly` | production-build-synthetic-DTO | `pages/my/weekly.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/fixture-weekly-partial-390.png) |
| fixture-profile-ready-390 | `/account/profile` | `/account/profile` | production-build-synthetic-DTO | `pages/account/profile.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/fixture-profile-ready-390.png) |
| fixture-developer-guide-390 | `/account/developer` | `/account/developer` | production-build-synthetic-DTO | `pages/account/developer/index.vue / DeveloperApiGuide.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/fixture-developer-guide-390.png) |
| fixture-annual-ready-390 | `/account/version-summary` | `/account/version-summary` | production-build-synthetic-DTO | `pages/account/version-summary.vue / StoryPlayer.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/fixture-annual-ready-390.png) |
| fixture-ja-home-ready-390 | `/ja` | `/ja` | production-build-synthetic-DTO | `pages/index.vue / home/*` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/fixture-ja-home-ready-390.png) |
| fixture-ja-recommend-list-390 | `/ja/tools/recommend` | `/ja/tools/recommend` | production-build-synthetic-DTO | `pages/tools/recommend.vue / RecommendationGoalAction.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/fixture-ja-recommend-list-390.png) |
| fixture-ja-passport-ready-390 | `/ja/my/growth` | `/ja/my/growth` | production-build-synthetic-DTO | `pages/my/growth.vue / PassportMetricChart.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/fixture-ja-passport-ready-390.png) |
| fixture-ja-developer-guide-390 | `/ja/account/developer` | `/ja/account/developer` | production-build-synthetic-DTO | `pages/account/developer/index.vue / DeveloperApiGuide.vue` | [查看](../../../qa-vault/evidence/viewer-product-design-20261019/fixture-ja-developer-guide-390.png) |

## 可复现方法

公开页面：使用给定路由和视口直接访问；年报桌面与移动UA分别测试。受限态：本地生产构件从about以客户端路由进入，替换账号／绑定／Growth等API响应；页面交互逻辑保持构件实现。`capture-public.py`、`supplement-live.py`、`capture-fixtures.py`、`capture-fixtures-ja.py` 保存在同一私有证据目录。

未进行生产业务POST。浏览器已有的统计事件请求在公开检查中被拦截；本地所有API响应替换，未知端点返回明确的合成503。初始化阶段两处fixture形状／Node路径问题已纠正；最终清单仅包含成功截图，不将这些合成宿主问题归因为产品缺陷。
