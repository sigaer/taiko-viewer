# Viewer 0.83 本地集成收口

**LOCAL_INTEGRATION_READY_FOR_REVIEW**，候选 `0.83.0-rc.5`。Contract v1.0 保持 `CONTRACT_FROZEN_LOCAL`，I5 为 `I5_LOCAL_SCOPED_PASS`；Gate P 仍 `DEPLOY_PENDING_AUTH`，`deployReady=false`。建议 Owner 签收本地代码集成候选，按下述最短清单独立决定生产准入；不重新签 F1–F5。

## 精确组合

分支 `integration/viewer083-rc4-20261016` 从 I5 `81829d9d7ddfbbf7d30f0f044e6704e951821a70` 建立。正式构建来自干净不可变提交 `3fb935a7763f86d7c6c45fc1b5a16846b2fa142a`；QA 修正提交 `d4f997caace3252cf2045c0158593d161f864c2b` 只改 owner-race 测试 binding 和文件 hash。最终交付文档提交由私有 `083-integration-delivery-identity` 关联，不把交付 HEAD 冒充已部署 release。

冻结提交 `5c68a13964cc8d8750709002485c11cf1ee239cb`、唯一 Schema、Golden、SDK/OpenAPI、权限与 Publication Writer 保持原身份；workspace Contract 0.1.2 / installed 0.1.0 明确分列，Python 两角色各 94 包、Taiko 0.14.2/Core 0.1.1 与 0.1.2 不升级。三仓库本地源码 refs/依赖声明及解释器、wheel RECORD/lock、SDK/OpenAPI、Schema raw/serialized、Node lock 和输出摘要见 [source-to-release manifest](083-integration-manifest.json)。

[差异裁决](083-integration-diff.md)记录本地 main 是 I5 祖先、origin/main 另有一个旧版 Kinoko 修复提交。本轮仅移植新记录时间准入，保留当前 canonical Writer/授权；不是整体合并 origin。既存污染/冲突策略、旧历史 delta 写入及 UI 仍列实际 main 集成前待审，未重写历史。因导入行为修正，版本从 rc.4 递增 rc.5。

## 原封不动产物验收

`PASS_UNMODIFIED_ISOLATED_STARTUP`。通过 build wrapper 在独立 Git archive 目录执行 lock 安装和正式 `npm run build`，安装 20.849s、构建 164.998s；输出 5185 文件启动前后全量流式 hash 一致，**编译产物补丁为零**。旧 I5 改过一个 Annual 插件调用的边界原样保留，本次结果填补该缺口。已有静态 Annual 类型生成 Schema 被识别为额外构建输入并封存 hash；未运行 Annual 生成、清理、指标或负载。

最小源码级 `owned-qa` 隔离默认不生效。启用时严格验证独占目录/cgroup/opt-in、实际 DATABASE()/datadir 后才跳过 Annual 启动副作用；不符退出 78。默认 normal 代码路径保持，未把 QA 模式变成生产下线开关。正式测试运行完整未经修改 Nuxt 产物，连接全新合成 `_test` MySQL、隔离 userdata/cache、固定 installed `-I` Worker；浏览器仅允许本测试 loopback，外部资产请求阻断。没有使用生产宿主上下文。

本轮 23 条命名运行观察（含无效准入退出）、13 条浏览器账户 API 响应、6 个真实浏览器流程：默认双 legacy 的旧 `/my`，新 BFF/v1 404；read-model 下真实 Session 登录、A1/A2/B 隔离与切换、匿名/未绑定/Key 不能替代 Session、读中切换/解绑/会话撤销/owner 改变、同一 Publication SH 与排队 Writer 代际、Catalog 原始字节及旧投影改变 fail-closed、缺失/损坏 Publication 503。375/1280 无横向溢出，原生 selector/键盘重试，503 清空旧私有正文，匿名/未绑定入口均通过。新增 BFF 未写 Goal 或 measurement，不自动 fallback，不新增私密跨请求缓存。

四表专项仅做真实隔离 dry-run、重复 apply、F3 索引、同意/撤销旧 ETag 403、禁用保留行及合成恢复后拒绝 401。不能据此声称生产 schema、缺索引旧表升级、PITR 或真实规模恢复已通过。

## 资源、诊断与失败记录

构建 200ms 采样峰值 4270735360 bytes（约 3.98 GiB），QA 峰值 1140666368 bytes（约 1.06 GiB）。QA memory PSI full avg10 最大 **2.53**，OOM=0；保留该采样峰值，不将定向冒烟称为容量验收，也不追加 PSI 深挖。内核 memory.peak 不可用，明确采用采样峰值；私有资源记录含进程 PID/启动身份、RSS/PSS 采样、PSI、退出和 cgroup 证据。Nuxt/listener、Chromium、SQL daemon/pool、进程组及当轮 scratch 已退出/清理，日志和输出有持久 SHA。

受影响 server/type 文件类型诊断为 0，SFC script/template 编译通过；扩展依赖闭包有 154 条范围外诊断，完整保存在私有 scoped-typecheck 证据。历史工作包曾记录 131，本轮闭包范围不同，不宣称全仓类型检查 PASS。

保留所有失败：安装日志 label 冲突；Kinoko 旧断言期待异常而新准入返回零写入；disabled client 的测试预期误写 403；首轮 tuple/数组 TS 诊断；build sampler 请求不存在 memory.peak；缺失外部静态 Schema；production install 遗漏构建 devDependencies；干净树 guard 拒绝未提交文档；Nitro import.meta 驱动定位导致首次完整启动退出 78；缩减测试后 owner-race 选中 binding 与变更对象不一致；报告封装 hash helper 的字符串/Path 类型误用。已分别修正工具/测试或最小源码，未改已编译文件、放松数据库隔离或权限来通过。真实非零退出未覆盖成 PASS。

未改的 Schema/Golden/SDK/OpenAPI 按 hash 复用原证据；原 74 HTTP-SDK 保留原提交身份和覆盖边界，不宣称本轮重新认证所有 74 项，当前运行覆盖以 F3/I5 和本轮 scoped 记录为准。不重新开展 0.82、119 SQL、46×2、12 PNG 或 Annual 测试。0.82 O1/O2 的接受风险、旧 PNG 等价缺口及历史性能/Annual FAIL 原样保留。

## 最短 Owner 待签与 I6

1. 评审这份本地组合和 origin 剩余差异；不授权推送或 main 合入。
2. 填齐并另批 [生产只读精确 allowlist](083-gate-p-readonly-approval-plan.md)，再核实际 P-ID/P-PROXY/P-KEY/P-AUDIT；当前端口、路径、PID 均未知。
3. 独立批准 [schema、恢复、灰度与回滚计划](083-prod-schema-and-recovery-plan.md)：生产差异/条件 F3 索引、同一检查点与 PITR、异地加密目的地、RPO≤15min/RTO≤120min 真实规模验证、十二项私有资产权属、受控名单实现及窗口。先 legacy/v1 OFF，再受限 My Taiko，最后另批 v1。

I6 在独立 `integration/viewer1-i6-home-20261016` 提交 `d52410c352f2071e6d28af095504d323214bd363` 记录 `I6_DEFERRED_WITH_EVIDENCE`，不阻断 R：实际 Home 已用 Growth 链，建议的 usePersonalHome 无调用点，raw/null profile 无法替换完整既有计算 DTO。独立分支仅报告/索引，没有新开关、算法、Writer 或权限体系。

机器判定见 [Gate 矩阵](083-integration-gates.json)。本轮没有 push、main 合入、生产配置/SQL/业务数据/HTTP 访问、部署、生产重启、v1 开关启用或 Annual 负载。Gate P 未执行项保持待签；本地代码就绪不等于 `DEPLOY_READY`。
