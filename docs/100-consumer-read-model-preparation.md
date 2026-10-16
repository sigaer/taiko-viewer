# My Taiko 跨客户端读取准备 — 独立分支

分支 `prep/viewer1-consumer-readmodel-20261016`，基于 Owner 工程评审提交 `d0c6fea8f172c6bc39086f13eac6fe2113205046`，不是正式冻结批准。**contractFrozen=false；Gate P=DEPLOY_PENDING_AUTH。** 原候选 `feat/viewer083-contract-api-20261016` 仍指向 ac10427，评审修订单独留在 review 分支。这里准备 I1–I4 的消费者清单、适配设计、后端接入例和可运行隔离读链；没有把候选字段接到生产产品。

## I1 消费者选择

[机器清单](100-consumer-read-model-matrix.json)逐行列 data/owner/实际入口/源文件 SHA/version/source/permission/cache/rollback，以及唯一 selectedMigration。Viewer Profile/Home/Score/Growth/Goal/Recommend、Bot center/client 与第三方 v1 保留各自认证域。Bot 项以固定 installed 包内代码静态核查，未运行 Sakura 在线命令或读取生产配置；不能宣称所有实际 Bot/App 已切换。

Web 使用自己的 Session/BFF；本地计算直接 installed Core；受控 Bot 保持现有 principal/service capability 和现有远程 read port；只有外部第三方 v1 使用 client Key + ResourceGrant。public-score-token 的未来迁移是另一次显式同意，不转换旧 token 权限，不增加一个“统一网关”跳数。各端 v1/v2 CalculationProfile 可合法不同，显示/诊断必须保留原 profile/modelRevision；这里未改任何公式。

## I2 同一 ReadView 的适配设计

准备原型位于 `taiko_viewer/tests/prototypes/myTaikoReadModel.ts`，只由测试 loopback `/qa/my-taiko` 注册；无生产 route、无 Nuxt UI 接线、无 feature gate 变更。复用 requireAccountUser → withViewerCurrentSource → committed Publication ReadView → 既有 ScoreReadPort。Profile、成绩与 Growth service 的重复 readCurrent 在该请求自己的 ALS scope 内 memo 一次，finally 还原 reader，不保留跨请求数据或权限。

Profile 用现有 getAccountProfile；成绩用既有 fromLegacyScore；Growth 直接调用 getGrowthHistory/canonicalGrowthProjection，不复制 replay 或编造事实，不写 measurement；推荐只返回既有 `/tools/recommend` 入口与绑定/代际，不运行新算法或把入口冒充推荐结果。所有读取共用一个 live SH，current/history 是同一 committed view，binding/owner 在原 authority 两端校验，Session 再校验。匿名、owner 参数注入、读中切换和解绑均整包拒绝；不将 self-read 强制变为 Developer Grant。

内部诊断带 schemaRevision、catalogRevision、scoreRevision、calculationProfile、source/bindingSource 和 legacyScoreRevision。scoreRevision 取 Publication sequence+commitId；legacyScoreRevision 是既有 current raw SHA，不能与之作字符串相等比较。catalogRevision 当前明确标 `legacy-projection-sha256:` / `legacy-projection-v1`，来自现有 catalog 实际读取值，与 v1 Catalog 原始字节 SHA 不可冒充等价；读链结束复读比较，变化则拒绝。后续正式适配须在签收精确组合后把 BFF Catalog read port 与外部 v1 原始源版本对齐，同时保留旧回滚。未把这个内部诊断信封新增为另一份领域 Schema。

原型不依赖 0.1.2 新平台 DTO/availability 字段，仅复用已有 Score/port 和服务；新必需字段的产品实现待 Owner 明确冻结。Source package 0.1.2 与两角色 installed 0.1.0 的矩阵仍以 [Owner 评审](083-owner-freeze-review.md) 为准，未重建 94 包环境。

C/H 是 full/delta 观察，Canonical Fact 是既有规则投影，measurement 是已有冻结值，真实游玩是另一种事件语义。同步/历史 reappearance 不算游玩；测试必须提供真实含义的上游时间才能投影，不放宽规则去追求非空结果。原型明确 measurements=NOT_REQUESTED，不伪造空值等于无测量历史。

## I3 开发者接入

[服务端示例与迁移说明](../examples/developer-api-v1/README.md)提供申请→注册→明确授权→读取→撤销路径，复用现有 TypeScript SDK，无 Key 浏览器注入、URL 参数或 payload 日志。离线 bundler 只解析唯一 Schema，所有引用改为内部引用；输出是派生物，不是第二 Schema。

当前公共/私有 v1 共用原日预算，未改权限或额度。下一启用工作包需独立签公共/私有预算、生产代理边界、429/错误率/响应字节/失效 Key 指标及审计保留；本准备分支不把“规划拆分”写成已实现。旧 raw/proxy/public-score-token/service 继续各自认证，不设 sunset。

## I4 可重放的最小一致性读链

使用全新隔离 `_test` MySQL、实际 SELECT DATABASE()/@@datadir 及 mutation opt-in；固定 wheel/center installed `-I` Publication Worker；合成 A1/A2/B 用户和真实 Cookie/HTTP，真实 Catalog 文件 reader、Profile/Growth/fact service。测试专用 composition 仅替换配置/连接和未使用的上游边界，不替换本读链的权限、Publication、数据投影或 Catalog 实现。

9 项实际 HTTP 观察：A1 Profile→成绩→事实→推荐入口，匿名拒绝，bindingId 参数注入拒绝，A2 切换，两用户隔离与切回，读中切换拒绝，回 A1 无 A2 缓存，读中解绑拒绝。每个成功请求底层 readCurrent=1，所有 facts owner/binding 相符，推荐入口版本与 response 同代。推荐计算、measurement Writer、所有 Bot 实际运行和完整 UI 整合未执行，不声称已迁移。

```sh
cd /home/sigaer/taiko/.worktrees/viewer1-consumer-readmodel-20261016
bash scripts/memory/run_qa.sh /usr/bin/python3 "$PWD/scripts/readiness/run-viewer1-integration-qa.py" sql
bash scripts/memory/run_qa.sh /usr/bin/python3 "$PWD/scripts/readiness/run-viewer1-integration-qa.py" examples
```

无依赖时可同包装器以 install 模式按原 lock `npm ci --ignore-scripts`，不复用旧工作树 node_modules，workspace contract 链接必须指向本工作树。没有生产 route/runtime/UI 修改；本包不另跑 Nuxt 构建，复用评审 rc.2 正式构建的原边界。

## 证据、失败和待签

成功 SQL：`/home/sigaer/taiko/qa-vault/runs/qa-4fd61589c58f/evidence/my-taiko-integration-observations.json`。成功示例/引用：`qa-07778f7e5303`，11 操作/93 实例、86 内部引用，示例服务器与编译子进程退出。

失败保留：`qa-65803327bb46` 的合成输入无上游时间且混入初始化 history，Growth 正确未投影；只补显式时间并用原 Publication API 发布独立合成 history，没有改算法。`qa-801c5528dbd1` 的示例断言成功但包装器因 esbuild 后代未退出 FAIL；显式 finally stop 后重新通过，不把第一轮称 PASS。所有原始日志、输入、hash 与精确提交通过独立 evidence index/delivery identity 封存。

Owner 待签：0.83 F1–F5 正式冻结；I1 每个真实客户端 owner/版本与迁移优先级；正式统一 Catalog revision 及 CalculationProfile 诊断；原型 BFF 的产品路由/受影响页面接线与授权回归范围；公私预算/代理/审计。Gate P 的 ingress/ACL/DDL/备份恢复/PITR/回滚仍独立待授权。这里没有 push、main 合入、生产配置/SQL/业务数据访问、部署、重启、v1 feature gate 启用或 Annual 负载。

最终持久索引：`/home/sigaer/taiko/qa-vault/evidence/100-consumer-readmodel-prep-20261016/evidence-index.json`；精确本分支提交与文档 SHA 见同目录 delivery-identity.json。基线评审后补齐 direct legacy.mjs/read-values 适配依赖哈希；未修改运行源码或重跑业务套件。
