# Targeted Test Results

所有 QA 通过既有 `scripts/memory/run_qa.sh`，构建通过 `run_build.sh`；不重跑 B3 126 Golden、3 Core、全部 B4-1 299 项、Python Core、Catalog 全审计或旧性能基准。

| 验证 | 实际证据 |
| --- | --- |
| Portfolio SQL/API/Vue 集成与 Strict TS | `qa-f05779947789`，29/29 节点 PASS（28 子场景 + 汇总），0 failed/skipped/cancelled |
| 原 evaluator、Baseline、sync-observation、Growth History 定向回归 | `qa-3103ed12db55`，48/48 PASS |
| 浏览器 | 上述 SQL run 的 portfolio-browser/results.json；3 视口/语言场景 PASS，PNG 同目录 |
| 候选构建 | 见验收文档，构建日志 `/var/tmp/taiko-b42-20261125/candidate-build.log` |

隔离原始证据：`/home/sigaer/taiko/qa-vault/runs/<runId>/evidence/`，包含 output.log 和 manifest.json。最终集成 run 的 wrapper/process exitCode 均为 0，childrenStopped=true、stopReason=null；未把预算当实测内存峰值。

复现命令（仓库根，使用本机既有 Node/MySQL 工具）：

```bash
bash scripts/memory/run_qa.sh /bin/bash scripts/verify_goal_portfolio.sh
```

脚本在 QA scratch 初始化独立 MySQL datadir，以 `--no-defaults --skip-networking` 启动独立 socket，创建全合成 `viewer_b42_test`。测试验证实际 SELECT DATABASE() 和 mutation opt-in；结束终止并 wait 自己的 MySQL，HTTP 与浏览器在 finally 关闭。没有连接机器上既有生产 MySQL，也不加载生产凭据或玩家文件。

覆盖：原 V1 writer；dry-run；逐行回填中断恢复；重复迁移；ID/基线/完成证据 hash；无法映射 Chart；Schema 旧生成列和 nonce key；并发同 CAS；原响应重放及异 payload；nonce 换 commandId；失败全回滚；全量 reorder/Goal revision；100 上限；S1→S2 与读取时钟变化；多个类型独立评估/不确定结果/暂停显式评价；不重复完成；unavailable 不被取消；所有权/allowlist/五个 legacy 409、旧成长 GET 显式协议协商；只读 GET/Schema 检查；隐私删除；实际 Vue 交互与 409 重读。

开发中失败输出均留在 QA vault：初始类型声明、fixture 模块解析、BIGINT count 断言表示、HTTP 测试路由和浏览器 fixture 修正。没有删除旧测试或降低业务断言来通过。以最终指定 run 为本次验收证据，不能拿失败轮次或历史 B4-1 PASS 替代。

旧成长 GET 的最终兼容修正后重跑了相关 SQL/HTTP/Vue 定向集成，最终 run 为表中记录。第一次完整构建成功后因此进行了必要的第二次候选构建；未重新运行无关全仓测试。构建前外置年度 Schema 缺失的预检失败记录在本会话工具输出中；两次完整构建日志保留在 `/var/tmp/taiko-b42-20261125/`。

最终静态证据核验 `qa-7a90695b4dda`：PASS。10 份交付文档、11 个本地链接、原 AGENTS 前缀保留、B3/原 B4 离线算法/原 evaluator/共享 Contract 无差异、版本一致及 Nuxt 组件注册通过。

| 证据 | SHA-256 |
| --- | --- |
| 最终 29 项集成 output.log | `5e513bd59f4e3b7437a3bb683872a282559321545bbd60852174a2baa1760177` |
| 48 项原模块回归 output.log | `f27a74488302765046faabe447f9e60e4f73175545c0c43b9ad43f178804d927` |
| 最终候选构建日志 | `d63f9467223263313bc4630026b365d3990408d575c24c310fc82e566832ad35` |
