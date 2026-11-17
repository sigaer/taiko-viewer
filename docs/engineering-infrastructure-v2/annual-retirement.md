# Annual Report Retirement — Viewer source candidate

范围是本仓库 Viewer 的年度报告产品。没有部署、停止线上 Worker、操作生产库，
也没有改年度算法或仓库外 taiko-bot 安装包。退役 API 是不兼容变更，候选版本
从 1.14.2 提升为 2.0.0；这不是生产发布。

## 消费者审计与边界

| 依赖 | 处理 |
| --- | --- |
| `/annual`、`/account/version-summary`、公开分享、私有 Poster/ShareCard | 移除页面、组件、故事布局和入口；精确旧路径返回 410 |
| Annual account/public/admin/internal/Bot API | 删除处理器；retirement middleware 在读库前返回固定退役响应 |
| annual-summary 服务、缓存维护、渲染/生成 Worker、定时任务、Beta 邀请/遥测 | 移除 Viewer 专用实现和任务启动入口 |
| 年度 Schema 门禁、生成脚本/类型、专用测试/负载脚本、CI schema checkout | 移除；标准 npm build 保留 TJA prebuild 与 Nuxt build |
| gsap、three、@types/three、直接 ajv-formats 依赖 | 无其他运行消费者，移除直接声明；不扩大修复既有 npm 锁漂移 |
| Ajv、Playwright、Sharp、QRCode、通用账号/成绩/Forum | 有非 Annual 消费者，保留 |
| account-titles repository / grant / CLI、已获称号、奖励与审计表 | 全部保留；只搬迁被共享 Schema/奖励测试引用的 Beta DDL 定义 |
| account-db 配置校验与 close hook | 原在 Annual 插件内，迁移到独立 account-db 插件，避免共享生命周期回归 |
| qa-startup-isolation、年度命名的共享 QA guards | 非 Annual 测试仍使用，保留隔离能力 |
| taiko_bot.offline.annual_summary 的 snapshots/events | 仓库外 Source 历史回归仍消费，已识别为共享依赖；不删除安装包或算法 |
| 原始报告、历史分享 PNG、Forum 已同步帖子、用户成绩/称号、管理审计 | 不读写、不删除；没有 DROP TABLE、奖励撤销或数据迁移 |

源码审计候选清单和外部引用保存在本轮 evidence/annual-removal-audit.json。
历史文档和过去的 readiness/oracle 报告保留其原始含义；它们不是当前退役门禁。

## 行为与验证

旧页面提供中/日文结束状态与首页链接；API 返回 410/ANNUAL_REPORT_RETIRED，
不查询历史数据。路径匹配带边界，账号、称号、社区及相似前缀路径不受影响。
`auth/me` 保留 `annualSummaryAccess` 字段并固定 false；titles 获取保持原逻辑。
移除登录、注册、绑定和同步中的 Beta 遥测，账号业务调用及返回契约保留。

首轮标准 build 成功：4096 MiB heap、4/5 GiB build slice、独立网络 namespace，
没有 Schema 文件，未跳过有效通用检查。原始 main 同机标准 build 已通过。
初次 build 对照：main 166.499s、SSR 30.218s、cgroup 4074.30 MiB；
退役候选 143.609s、SSR 25.612s、cgroup 4068.95 MiB。峰值差约 0.13%，
属于小幅波动，**不能声称退役解决了 SSR OOM**。单次时长下降也不等于稳定收益。
Nitro 总量从构建日志 64.7 MB 降到 62.6 MB。最终源码（含通用 account-db 插件）重建再次通过：151.024s、cgroup 4073.03 MiB、进程树 RSS 4183952 KiB；仍没有实质内存收益。最终日志 build-retired-final.log，run qa-f42b9d4bec4b。

52 项基础设施回归（qa-ec89de262b97）、58 项 retirement/账号状态/个人主页/内部服务边界测试通过（qa-520ed51617b3）。
原始 main 与候选最初均有 6 项登录状态测试失败，定位为测试 harness 未注入
真实 `authReturnNavigationOptions`；补充真实 helper 后 54 项全通过，没有改
登录业务实现或放宽断言。原失败日志分别为 qa-ce9bc3a002b7、qa-5de1330a6a14；
通过日志 qa-48677e0cb22e。

第一次 SQL 验证错误选用了 TCP 专用 runner 跑 Unix-socket 套件，3 项因
COMMUNITY_TEST_SOCKET 缺失在安全边界拒绝；空白测试库 identity 与 bootstrap
通过，daemon 已退出。该次不计产品失败或通过，需用原套件对应 runner 重验。

回退：在独立工作树 revert 此提交，恢复 pinned schema 后标准 npm build；
保留的数据/奖励无需恢复或迁移。已上线的产品目前未动，不执行生产回退。


剩余运行兼容边界：基础设施中的 Annual 启动屏障暂保留，因为当前生产仍运行
旧版本，且本任务禁止部署或停止线上 Worker。它只读取旧准入状态，不启动年度
任务。退役分支不再含年度 Worker 入口；外部安装包的 snapshots/events 为共享
Source 消费者，不能随 Viewer 产品退役删除。

SQL 最终结果：社区/称号实际 H3+SQL 套件 qa-29192f40dc98 通过。OIDC 与账号
HTTP 初次均失败；原始 main qa-5ec831cab427 同样 503/undefined user.id。
定位为旧夹具缺失现有 web_account_titles 表，auth/me 的真实校验拒绝。
仅在两个 SQL 测试中执行现有 ACCOUNT_TITLE_TABLE_SQL，保留全部业务断言；
重跑 qa-e8d82e74af95 两套件全通过，私有数据库、SELECT DATABASE()、mutation
opt-in、daemon exit 均确认，productionConnections/Writes=0。OIDC provider 和
OurTaiko 为合成服务，未宣称实际第三方联调。没有改变业务 schema 校验行为。


实际 Nitro 退役验证 qa-860780271296 通过：在私有空白 MySQL 中通过 HTTPS
真实登录并保留 Secure cookie；账号/profile、通知、帖子均 200，年度来源
称号仍在 auth/me 返回且数据库 revoked_at 为空。8 类旧页面/API 的 GET 和
POST 共 16 次全部 410/no-store，退出前称号仍为 1 条。后台仅为合成管理 API。
cgroup 采样峰值 803139584 bytes，进程树 RSS 1190376 KiB，OOM/high/max=0；
完整结果 runtime-retired/summary.json。没有查询、迁移或删除生产历史数据。
HTTPS 自签测试证书下 Service Worker 未注册，这次不计 PWA 通过；PWA 在
独立可信回环 origin 重验，避免把证书环境限制当作业务结论。

最终 SSR 转换 24.680s（main 30.218s），总构建 151.024s（main 166.499s）；
仍只是单次同机观测。Nuxt JS 从 4282221 降至 3353667 bytes、CSS 从 706184
降至 466010 bytes，文件数 295→276；不再打包 Annual story font。构建报告
entryCss=0 是文件名定位器不匹配，不能解读为没有 CSS；真实总 CSS 以上述扫描为准。

部署源码中的年度 Schema archive 复制随依赖退役移除；它不再是构建前提。
该脚本仅做静态语法/隔离 helper 检查，没有运行部署、切换产物或服务重启。

可信 HTTP 回环 PWA 最终验证 qa-d479273600c5 通过：main、Phase 0、退役候选、
回退 main 均实际注册，3 项预缓存、离线 manifest 200、离线导航失败行为一致。
不是所有页面离线可用。该 run 峰值采样 866222080 bytes，RSS 1237812 KiB，
事件均 0。最终基础设施回归 58 项 qa-9dc7a68c796d 全通过。

Phase 0 原分支只更新验收文档。其正常构建、样张/组件/图表、登录/API/PWA
已在隔离环境覆盖；测试构建仍有 6 项旧路由 CSS 差异，严格截图和资源 URL
对照仍失败（同版本复采亦复现）。不以本次退役或基础设施成果代替这些门禁。
完整机器摘要见 verification-20261118.json；原始证据已转存独立 QA Vault，
本轮构建树和大型产物安全清除，未知历史数据与用户已有改动保留。
