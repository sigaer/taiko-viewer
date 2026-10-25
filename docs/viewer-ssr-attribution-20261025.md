# A：歌曲 SSR 500 真实归因与最小修复

本报告不另设 Gate；状态只维护于 [唯一 Release Gate 表](viewer-1-release-gates-20261023.md)。原始历史失败与上轮诊断保留于 `qa-vault/evidence/viewer-rc-blockers-20261025`；本轮证据为同级 `viewer-source-ssr-investigation-20261025`。两者均在现有私有证据区，不进入公开站点。

## 真实异常

运行基线为 0.87.10 / `d21779a84905d68c9d6b55ed78b7c8ea2463bd69`；远程 main 为 `ccc68df31c6971a6f659d59c90efba5174209bad`。实际产物的受限 Nitro 插件已注册。UTC 08:30:16–09:29:20 的 journal 完整读取 167 条、197,750B，发现两条真实诊断，未达到每分钟 5 条或进程累计 100 条限额。

UTC 09:00:09.739Z 和 .758Z 的 `/songs/100126` 均为 `nuxt-context-unavailable`。当前 1503 曲公开目录确有 ID 100126。现有 Nginx 日志在同一秒对应两次 HTTP 500 / 53,824B；只提取时间、公开路径、状态与字节，不提取 IP、身份、查询全文或请求头。没有为了等待复现发起线上请求。

两个实际栈相同：

```text
server/chunks/build/server.mjs:248:13                 useNuxtApp
server/chunks/build/asyncData-BWgzVsMg.mjs:20:19       useAsyncData
server/chunks/build/asyncData-BWgzVsMg.mjs:120:10      useLazyAsyncData
server/chunks/build/_id_-M54YOrvQ.mjs:945:24          useChartUgc
server/chunks/build/_id_-M54YOrvQ.mjs:1334:19         song page Promise.all
```

源码 `composables/useChartUgc.ts` 在 `await useAsyncData(...)` 之后调用 `useLazyAsyncData`，后者需要当前 Nuxt setup 上下文；自定义 async composable 内部的 await 没有页面编译器的上下文恢复。故障发生于页面数据装载及 composable 注册，栈没有落在歌曲 API、UGC 服务实现或数据字段解码中。

这能归因上述两次真实有效歌曲故障；不能据此认定当天上游 UGC 返回 503。SSR 内部 API 没有对应访问日志，现有证据不能还原它们当时的响应。也不能以时间相近推断与私有 Source 异常有关。

09:00 分钟内四次既有 15 秒遥测中，Viewer cgroup 为 217,448,448–223,928,320B，swap 0、high/max/OOM/oom_kill 均 0、内存 PSI full avg10 为 0。这些样本不证明亚秒峰值、请求并发或在线容量；没有以资源读数替代具体错误栈。

## 隔离复现与修复

在 QA cgroup 内复制实际 0.87.10 产物，仅隔离副本停用启动 Writer/Annual 插件并拦截全部 API，保留已部署观测钩子；只用公开歌曲数据、匿名身份与确定性错误。无生产 DB、Source、外部上游或真实业务写入，最多两路并发。

原始 26 次隔离读取中，历史有效 ID 1454 的里谱、UGC 503 案例出现 HTTP 500 / 53,812B，得到与线上相同的五层栈。其余 25 次成功。修复副本 26 次均 200，原来 25 次成功案例的可见 body SHA-256 全部一致；没有其他可见差异。另用真实观测 ID 100126 的公开数据补正常/UGC 失败，最终等价修复副本 28 次均 200、无 SSR 诊断。所有隔离服务和监听均已关闭。

修复只把 private composable、computed 和 watch 的注册移到等待 public 数据之前，最终仍等待并返回原来的 resolved publicState。公共及私有请求路径、private `server:false`、刷新和取消策略、写入队列、登录返回、UGC 载荷均不变。没有修改歌曲详情服务、推荐来源、目标、成绩、评分或 Growth 事实，也没有新增 UI 文案。

受控 setup 生命周期测试在原实现失败于同一处 `[nuxt] instance unavailable`；修复通过。29 项定向测试覆盖 setup/watch 所属作用域、UGC 404/503、失败后刷新、原投票请求与确认值、日文登录返回、观测限额和脱敏、版本投影及已有 UGC 语义。该测试补入既有 CI。

证据映射：`ssr-observation.json`、`ssr-correlation.json`、`ssr-resource-correlation.json`、`isolated-08710-before.json`、`isolated-08710-fixed.json`、`isolated-08710-fixed-final.json`、`ssr-differential.json`。QA 运行：`qa-c9783ca2a46c`（原产物）、`qa-880e29f80a37`（首次差分）、`qa-a61fdb4ace30`（最终等价补丁）、`qa-0eccf192c950`（29 项）；原实现失败运行与首次隔离脚本断言失败也保留，不冒充成功。

## 状态及历史边界

已定位的真实 Nuxt 上下文缺陷：修复与隔离回归 PASS；发布结果在 Gate 中记录。兼容应用修复按 patch 0.87.11 处理，未因 Source 分析升级版本。

2026-10-23 UTC 05:11–05:20 的 65 次 / 47 个有效 ID 仍缺原始异常栈；目前证明该机制可影响历史有效 ID，没有证明它解释全部历史故障。历史整体归因继续 **BLOCKED**，既有空成功响应、非数组 artists 合成反例也不追认为历史原因。受限观测继续沿用原授权，不加日志字段、不改 Nginx、不提升采样。

有界在线性能仍 **NOT VERIFIED**：未满足历史故障收口前置条件，不开展全站压测、不以这 28 次隔离读取推算在线 p95。Contract 1.1 保持 `FREEZE_CANDIDATE`。
