# 性能容量与成本账本

G3 = BLOCKED。既有全历史专项预算仍未通过；当前普通线上API SLO为UNKNOWN，两者不可混用。

Finding PERF-01：P1，BLOCKED。SOURCE：[0.81.10报告](../growth-passport-request-performance-08110.md)及[逐样本JSON](../growth-passport-request-performance-08110.json)，2026-10-10；记录的E2离线实验，本轮只核对证据。evidence.ts、dailyProgress.ts、growthRequestMemo.ts、Passport service.ts四个SHA-256与当前源码逐一一致。CONFIDENCE：已记录样本HIGH，真实SQL/Python/线上延迟LOW。

## 可复用的具体测量

基准是 **0.81.9→0.81.10**，不是0.81.4→0.81.10。7类×前后×每类3次=42独立进程；保留文件系统页缓存，不能称冷盘；DB/Python/catalog注入匿名适配器。完整DTO hash在各类前后样本一致。

| 样本 | before p50 ms | after p50 ms | after尾部/解释 |
|---|---:|---:|---|
| mixed | 59.58 | 45.98 | 每组N=3，不估总体p95 |
| invalid | 62.03 | 51.71 | 坏文件保留重复装载 |
| boundary | 41.23 | 41.80 | 小幅变慢，不掩盖 |
| truncated | 1088.26 | 457.07 | latest-2000语义保持 |
| iso-full | 19510.18 | 4705.70 | max 5253.2，不能声称全部≤5000 |
| local-full | 12238.45 | 4970.23 | max 5444.3，不能声称全部≤5000 |
| no-baseline | 69.62 | 40.69 | partial边界保持 |

大样本2000选中文件×500谱面，读取/parse从4000→2000。正常路径normalization从2→1，Daily 1、range 2、scoreFacts 1、currentReads 2、archiveReads 2。**装载减少不等于所有replay只剩一次。** 变化期间会重装；坏文件路径也不减半。

旧365天管线另测：ISO 5151.43ms、local 4440.67ms，均超过原3000ms；启动器报告预算失败。约441/437MiB进程RSS不是cgroup peak；kernel peak UNKNOWN。high/oom/oom_kill记录增量0不代替peak验收。没有修改预算。

## 当前端到端成本的可知范围

| 工作流 | 当前证据 | 缺失项 |
|---|---|---|
| Passport初载 | 一次Overview调用；Overview源码一次runGrowthPythonJson；measurement代表SELECT+coverage SELECT仍两项；History includeMeasurements=false | 真实Python内部成本、总SQL、DB时间、端到端p50/p95/max、TTFB/hydration均未重测 |
| 四档切换 | 当前useAsyncData只watch账号/binding；range本地selectPassportPeriod；0.81.7报告56浏览器场景与零额外请求 | 0.81.10正式构建浏览器计数未测；源码成立不冒充线上实测 |
| Guest Home/搜索/歌详情 | 路由与已有测试存在 | 当前请求N、成功率、延迟、payload、CPU/内存UNKNOWN |
| 绑定/同步/Goal/Recent/Daily/Weekly | 源码与历史专项测试 | 当前各路径分母、失败/重复/超时与不同账号并发成本UNKNOWN |
| 论坛/年度/分享 | 历史专项报告、admission设计 | 当前排队/worker耗时分解与容量UNKNOWN |
| MyDon/验证码/Overview热点 | 旧问题线索 | 没有本轮日志分母，当前是否仍故障UNKNOWN |

0.81.4线上GET 2825ms、SSR可见2906ms只作历史单次比较，不能作为0.81.10成绩或P95。0.81.7对存档存在与否改变measurement写入次数，额外读日存档；两个measurement SELECT不是“整个请求只有两次SQL”。

## 待批准的服务观察方案

候选窗口：连续7日、至少覆盖一个高峰；每个关键路由目标≥200有效请求再评估p95，低流量不足则延长窗口或标UNKNOWN，不用聚合全站数替代低流量路由。记录总请求、2xx/4xx/5xx/超时、重试、取消、身份类型及样本冷/热；不记录原始ID/成绩/凭据。

待批准目标：核心API成功率≥99.5%（业务拒绝单列），窗口5xx错误预算≤0.5%；普通交互GET p95≤2s，Passport p95≤5s；任何越权/数据损坏立即停止RC。上述是新提案，不替换既有历史3000/5000ms Gate。队列仍保留现有20/8、worker 2/1与原TTL/资源限制，不能为过Gate放宽。

复测计划：先小样本语义与服务计数，再独立压力窗口；同账号去重/不同账号隔离分别测。大历史≤300MiB输入、QA≤1GiB、worker≤512MiB，IO/memory PSI原guard及watchdog不变，peak不可读即UNKNOWN。失败保留聚合并关闭本次子进程，不清缓存、不重启生产。Owner决定双SLO能否采用；未批准前PERF-01不关闭。
