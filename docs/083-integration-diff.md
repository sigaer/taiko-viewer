# 0.83 集成差异控制

I5 输入 `81829d9d7ddfbbf7d30f0f044e6704e951821a70`；冻结记录 `5c68a13964cc8d8750709002485c11cf1ee239cb` 已经通过 I5 的提交图纳入。新分支 `integration/viewer083-rc4-20261016` 从该精确 I5 创建，没有覆盖原分支或 main。候选版本递增为 `0.83.0-rc.5`，以区分本轮新增的 Kinoko 导入安全行为修正；Node 依赖没有升级。

## 本地 refs 与分叉裁决

只读本地 refs，未 fetch：`main=56aa05a6eecfbd163bc4cb2b985dfa66ab7ea696` 是 I5 祖先，输入时 ahead/behind=87/0；`origin/main=777546c943b9ca196c365fffa6d1289eb558a2db`，merge-base=`9a77dbcfa6c7ef6e502a1a5ae7ba4efc714e2209`，输入时 126/1。origin 的一个独有提交为 0.81.12 Kinoko 异常时间与污染隔离修复，不能整体覆盖当前 0.82 Publication/权限实现。

本轮仅选择性保留新记录的严格时间准入、未来时间排除、Shanghai/显式 offset 顺序及 metadata/event 分离。服务层仍走现有 `withUserdataWriteLock`/ScoreReadPort/Publication stage，未复制 origin 的旧共享文件写入器或改变权限体系。对直接历史写入的非法时间改为零条过滤、零快照、Publication 不推进；这一差异已实测并保留首次旧断言 FAIL。没有改计分、累计字段合并公式或迁移既存业务数据。

三方只读 merge-tree 表明双边修改：package.json、package-lock.json、kinoko-history.ts、kinoko-import.ts、shared.ts、sync.ts；kinoko-time.ts 双边新增。其余 origin 文件包括 service 模板、sync UI。这里是**选择性集成候选，不是 origin/main 整体合并**：旧版本号/service、旧 Writer、污染记录冲突/历史 delta 写入及相应 UI 未移植。既存污染修复和冲突策略仍需在真正集成该 origin 提交时独立裁决；本轮不静默重写历史，也不声称 origin 全部修复已经进入候选。实际 main 合入前须复核这份剩余差异。

## 新提交与安全边界

| 提交 | 差异与验证 |
| --- | --- |
| 742248a | 时间准入与 rc.5；正常 Kinoko 导入兼容原字节/快照、去重及失败原子性；未来/非法时间不进入新记录 |
| 2412492 | 已验证长度界限的数组访问和解析 tuple 类型约束；无算法变化 |
| be65565 | 最小源码级 owned-qa 启动隔离及定向 Nuxt/恢复测试；默认 `annualStartupMode=normal`；新增模式须独占 scratch/cgroup、实际 loopback `_test` 和 datadir、显式 mutation opt-in 全部验证，否则退出 78 |
| a69dff3 | 离线 Gate P 观察/迁移/恢复/灰度预案；该提交首次独立构建通过；启动探针的 Nitro 解析问题修正后，以后续 3fb935a 重新干净构建 |

后续 `3fb935a` 修正 Nitro 重写 import.meta 导致的驱动解析，改由实际 Node 入口定位，并保留全部范围外 TS 诊断。`d4f997c` 只修正缩减后的 owner-race 测试选中 binding，不改变运行源码。最终构建提交与产物身份见 manifest。

Nitro 2 的 plugin 调度不 await async 返回，因此 owned-qa 准入采用一次同步、5 秒/8KiB/64MiB 限制的原生 SQL 子进程证明；凭证只经 stdin 传递，不进入 argv/日志。正常模式不执行这个探针。Annual 只在获准的非生产模式跳过启动副作用；未改算法、未触发生成/清理/指标任务、未改变线上入口。另一个 source-lifecycle plugin 在同一准入后保留原本工作与退出钩子。

唯一 Contract Schema、generated TS/Python、Catalog/Score adapter、SDK、OpenAPI、Developer API 授权服务及 Publication Writer 都与 I5 输入保持相同字节；精确 hash 见 manifest。`/my` 页面/组件、实际 BFF route/service/type 也未改动，继续默认双 legacy，Developer v1 OFF；没有新增 `/qa/*` 产品路由。

## 构建闭包

构建输入是干净 Git archive，加固定 Node lock，以及已有静态 Annual 类型生成 Schema。独立目录首次预检查暴露该仓库外依赖，现已独立封存其 SHA `a8ecc11504f4f59c9460e2ca72ac8e330d1aa182df0f7d18936e377fedf33ad1`；没有新建领域 Schema 或运行 Annual 任务。`npm ci --include=dev --offline --ignore-scripts` 使用 lock 完整安装构建依赖，正式 `npm run build` 未绕过原预检查。构建与 QA 串行使用各自资源包装器，无部署脚本调用。产物全量文件摘要与启动前后对照由私有构建/运行记录关联，不复制内部绝对路径或完整私有证据到 Git。

后续交付提交仅补充 QA 诊断保留和报告索引；正式构建提交与交付提交分开记录，不把未重新构建的交付 HEAD 称作已部署 release。
