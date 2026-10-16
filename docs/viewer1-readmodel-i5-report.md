# My Taiko I5 — 隔离候选，正式接线待冻结

2026-10-16，Asia/Shanghai。独立分支 `prep/viewer1-consumer-readmodel-20261016`，由准备提交 `49899d48a0ccff677d8506f59cea502b521758c4` 与本轮 review 收口 `289094de74fa4872c7e43459ec57ce5c207ce36f` 在本地整合而来。**contractFrozen=false；F1–F5 尚无 Owner 明确批准；Gate P=DEPLOY_PENDING_AUTH。** 本轮只交付隔离设计、可运行原型与合成端到端验证；不将测试路由或组件宿主称为产品接线。

## 唯一首批产品入口设计

源文件核查选择现有 `taiko_viewer/pages/my/index.vue` 的已登录 My Taiko 概览作为后续唯一首批消费者。它当前用 useAccountState 取 Session，展示个人工具链接；本轮未改这个页面。拟定 BFF 为 `GET /api/account/my-taiko/overview`，**未注册**。正式冻结后才实现页面→BFF，承载 Profile、当前成绩摘要和最多 90 天事实简述；不连带重写 Home/History/Growth/Goal/Recommend/Forum。

权限仍由 requireAccountUser 和 withViewerCurrentSource 服务端推导 owner/current binding；URL/body 不接受 owner/binding 覆盖。Web 自读不经 Developer Key/ResourceGrant。平台 Bot/第三方/本地 Core 保持现有独立认证域、CalculationProfile 与安装版本，不为统一增加 HTTP 跳数。

## 实际可运行的原型

`taiko_viewer/tests/prototypes/myTaikoReadModel.ts` 只由受限测试宿主的 `/qa/my-taiko` 和 `/qa/my-taiko-90` 注册；没有生产 server/api 文件或 UI 引用它。

- 单个 committed Publication ReadView、同一请求 ScoreReadPort；请求自己的 ALS reader memo 当前快照，在 finally 还原。Profile、成绩和 Growth 共享 current/history sequence/commit，A1/A2/B 不共用跨请求缓存。成功链针对 A/B 与并发 Writer 均验证底层 current 装载一次。
- Profile 用 getAccountProfile，Score 用唯一 Contract fromLegacyScore；Growth 用 getGrowthHistory/canonicalGrowthProjection，不复制回放或算法。原型默认 90 天，测试保留原两日链作差异验证。
- frozen measurement 未请求，明确 diagnostics.measurements=NOT_REQUESTED，不拿空列表声称“没有历史测量”；实测无新增 measurement 写入。Goal 事实仍走既有服务，没有第二套 Goal evaluator 或 Writer。
- 推荐只给既有 `/tools/recommend` 入口及该响应的绑定/scoreRevision，state=ENTRY_ONLY，不冒充实时推荐结果。
- 完整响应依然有记录/字节边界；权限变化、源版本变化或 Publication 不可用直接整包拒绝，未实现任何自动旧路径回落。

## Catalog 原始 revision 与旧桥接

原型现在直接复用 `server/services/developer-api-v1/catalog.ts` 的同一个 catalog()：同样的受控文件路径、8 MiB/10,000 行边界、同次原始 bytes SHA 和唯一 Contract projectCatalog。`release.catalogRevision` 与 v1 的真实源字节身份一致，`catalogRevisionProfile=developer-api-v1-source-bytes`。

旧 `legacy-projection-sha256` 不再占据该字段，而保存在 `release.legacyCatalogRevision`。原型用同一个纯 canonical adapter 比较实际 legacy Catalog reader 的投影与本次原始源投影；两者不一致则 409，不用新 SHA 给旧缓存背书。请求结束再读取源作明确校验：raw revision 改变则拒绝。current 只装载一次，Catalog 的额外一次读取用于源校验，不能将其声称为“全部文件只读一次”。

真实文件测试证明：仅增加空白时 raw revision 改变，legacy 投影 revision 可以不变；改动内容后恢复纳秒 mtime 时，旧 Catalog mtime 缓存仍可陈旧，但原型拒绝 409，不回退或冒充版本等价。恢复原字节后可再读。此保护只在隔离原型，不宣称已修复或切换所有旧消费者。

诊断信封包含 schemaRevision/catalogRevision/scoreRevision/calculationProfile/source，同时保留 legacyScoreRevision 和 bindingSource。Publication sequence+commitId 与旧 current raw SHA 是不同 revision profile，禁止比较字符串相等后推断数据相同。raw calculationProfile=null，原 v1/v2 算法 profile 不被改公式抹平。C/H 是观察，Canonical Fact 是既有规则投影，冻结 measurement 与真实游玩是各自语义，同步/reappearance 不计为游玩。

## 受影响隔离验证

新 run `qa-173c39e7551b`：1 个实际 SQL/HTTP 套件、21 项观察，0 FAIL/0 SKIP。全新 `viewer1_security_test`，实际 SELECT DATABASE()/@@datadir 和 mutation opt-in；私有 loopback、真实登录 Cookie、固定 center `-I` installed Publication Worker、真实 Catalog 文件/reader、既有 owner authority/Profile/Growth 服务。

覆盖 A1/A2/B 用户和绑定切换，匿名/owner 参数注入拒绝，读中切换/解绑，默认 90 天 partial coverage，queued Writer 下旧响应 body/revision 同代、下一次读新代，Catalog 读中变化及保留 mtime 的陈旧缓存拒绝，Publication 缺失 503，证据不足返回 unknown/空 facts，会话读中失效 401，未绑定 400。失败路径没有旧文件 fallback；`/api/v1/taiko/catalog/songs` 在此宿主仍默认 404，未打开 v1 gate。

OpenAPI bundler/后端示例只因 rc.3 owner pagination 文档变化作定向再验证：`qa-2ac8e227698f`，11 操作、95 Schema 实例、86 内部引用，3 个合成 loopback SDK 场景通过，server/编译子进程退出。它不是另一轮真实授权测试，真实权限证据是 F3 本轮及保留的原 74 项。

复用 review rc.3 正式构建；本 I5 包只改 tests/prototypes 与测试文件，server/pages/lib/nuxt/package/Schema 相对 review 的运行源码不变，不为未接线原型另跑构建。没有重建两个 94 包 venv；installed Contract 0.1.0 不因 workspace 0.1.2 的原型存在就被宣称已升级。

## 冻结后产品接线 Gate 与回滚设计

| 项目 | 当前状态 | 获正式冻结批准后必须完成 |
| --- | --- | --- |
| /my → 自有 BFF 真实接线 | NOT_RUN_OWNER_F1_F5_PENDING | 只改这一个入口，owner/绑定由服务端取；摘要由同一 port 读结果投影，不新增算法 |
| 真实 Vue + 完整 Nuxt 宿主 | NOT_RUN_OWNER_F5_PENDING | 实际路由/DB/Worker，375 与桌面；不是模拟接口截图 |
| 未登录/未绑定/不足/截断/加载错误 UI | DESIGN_ONLY | 登录入口、绑定入口、证据不足、partial/truncated 分别显示；加载错误可重试，不展示陈旧账号数据 |
| Annual 启动插件隔离 | NOT_RUN_NOT_NEEDED_BEFORE_F5 | 若正式完整宿主被插件牵连，先证明独立禁用仅影响该插件；不生成 Annual 或改 EOL 入口 |
| 旧路径兼容 fallback | DESIGN_ONLY_DISABLED | 显式模式开关，默认 legacy；仅授权通过且 allowlist 的非安全格式故障可尝试一次同等权限旧服务，仍同请求重新证明 Session/binding/Publication；不新增 HTTP 跳数 |
| 需要 fail-closed 的故障 | PROTOTYPE_PASS_SCOPED | 401/403、owner/binding/source/revision 改变、Publication 缺失/损坏、未知或未分类错误均禁止 fallback |
| 回滚评估 | DESIGN_ONLY | 切回既有入口，不迁/删除成绩、measurement、Goal 或授权表；更改生产开关仍需 Gate P 授权 |

正式 fallback 需使用已验证的旧 BFF service/ScoreReadPort；不能直接打开旧 JSON 文件、不以捕获异常为由绕过权限或 Publication，不能对所有 503 自动回落。当前产品路由原样，原型 fallback=NONE，故没有未经签收的自动兼容开关。

## 交付身份和 Owner 待签

完整状态与原始证据 SHA 见本分支 [最终矩阵](083-freeze-final-matrix.json)。原始索引与本分支提交/文件 SHA 存于 `/home/sigaer/taiko/qa-vault/evidence/083-freeze-closeout-i5-20261016/i5-evidence-index.json` 及 `i5-delivery-identity.json`。旧 49899d4、d0c6fea、原 FAIL 与 scoped PASS 的 SHA/适用范围保留；本轮未生成虚假冻结或产品上线结果。

下一步仍是 Owner 对 `083-freeze-final-review.md` 指定的 rc.3 精确运行提交 + manifest SHA 批准 F1–F5，然后才做最小冻结记录与此单入口产品接线。P-ID/P-APP/P-PROXY/P-KEY/P-AUDIT/P-RESTORE/P-MIGRATION 独立待签。未 push、合 main、读取生产配置/SQL/业务数据、部署、重启、启用公共 API 或执行 Annual 负载。
