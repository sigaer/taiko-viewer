# Viewer 1.0 产品合同审查

G0 = UNKNOWN。SOURCE：`8d70df2` 路由清单、Growth源码、历史验收报告；CONFIDENCE：源码范围HIGH，完整用户旅程LOW。下表是候选冻结范围，尚未取得全站四态、权限负例及设备验收，不能宣告 FEATURE-SCOPE FROZEN。

| 领域 | 路由/API | 数据与最低合同 | 失败边界与证据 |
|---|---|---|---|
| Home/IA | `/`、`/my`；`/api/content/home`、`/api/account/growth/overview` | Guest/Unbound/Bound-empty/Ready；移动/桌面导航 | homeStateResolver.test.ts存在；当前全站浏览器未测 |
| Discovery | `/songs`、`/songs/[id]`、`/titles`、`/guide/*`、`/grade/*`；content songs/guide/titles/v2 | 国服catalog、上下架/难度、谱面/试听；不能将未收录当零成绩 | 缺谱、缺音频、旧浏览器分别降级；练习路径此次有变化 |
| My Taiko | `/my`、账户/绑定页面；account songs/charts/bindings/auth | 当前身份成绩、Rating/B30、六维、权限与绑定 | 无数据不能冒充已同步；注销/切换拒绝晚到数据 |
| Training | Home Growth surface；growth overview/goal及同步API | 推荐→主动Goal→基线→同步→严格完成证据 | 不把推荐/点击计为游玩；Goal事务测试有历史记录 |
| Progress | `/my/growth`、growth recent/history/weekly及recent/ack | 日/周/最近观察；measurement 30/90/180/365，score facts≤90天 | full/delta截断/未知来源显式coverage；无可靠session不称真实局 |
| Community | `/forum/*`；forum threads/replies、account charts/*/ugc、content community | 论坛、曲谱关联、反馈、审核隐藏删除 | 关联服务端校验、owner、速率限制、状态过滤；当前全链负例未测 |
| Version Summary | `/annual`、`/annual/share/[token]`；account annual-summaries/jobs/shares/posters | 已公开总结、异步任务、分享撤销、稀疏降级 | 入口受policy；实际线上开放配置未知，不能从源码推断所有人可用 |
| Developer/Sync | 文档/开发者与同步页面；developer/userdata、taiko proxy、account sync/score-token | 身份授权、Token隔离撤销、来源可解释 | SEC-01阻断；不同Token体系不能只按名称认定安全 |
| 补充：练习播放器 | `/ourtaikoview/[id]/[difficulty]`；content songs/*/tja-package | Safari/Ogg降级、全屏、软件解码、WASM持久缓存 | 0.81.5/6/8/9有改动，不能遗漏；真机兼容与缓存升级证据需补 |
| 补充：工具与支持 | `/tools/*`、`/support`、设置；support tickets、开放数据/资源、公开动态等 | B30/趋势/推荐/进度等已有入口，工单权限、资源失败提示 | 已列源码能力；线上可达/配置/权限矩阵未完成 |

Finding FEATURE-01：severity UNKNOWN；status UNKNOWN。预期为所有公开功能有真实路由→数据→权限→失败状态→验收场景映射。此次安全STOP前未完成每个外围入口追踪，不以此表冒充全量验收。

后续复现：隔离官方构建，四态×zh/ja×390/1440×light/dark；核心旅程逐步完成，单设备浏览器预算遵循现有memory runner。成本为一轮串行构建及浏览器矩阵，执行前核对隔离和测试库。失败保留脱敏截图/场景ID、不修代码；维护者决定实际公开范围和冻结签字。
