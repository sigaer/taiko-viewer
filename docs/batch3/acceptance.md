# Batch 3 候选验收记录

结论：架构与离线可独立验收基础通过，保留候选分支审查。不是生产发布、算法效果胜出或真实队列验收。

## 运行结果

最终综合运行：`qa-76e08088447d`，既有 `scripts/memory/run_qa.sh`，`development-qa.slice` 子 cgroup，2 GiB High / 3 GiB Max / 256 MiB swap。wrapper exit 0、process exit 0、childrenStopped=true，scratch 已由 wrapper 删除；未启动 dev server/浏览器/业务 worker。

- 严格 TypeScript 检查通过（新基础模块，`playerIntelligence.tsconfig.json`）。既有 contract 的 JS 声明通过 allowJs 读取；未放宽新 TS 的 strict。
- 76 项 Node 测试全部通过，其中本批 15 项，另外 61 项覆盖原 Player Growth、Goal Baseline/Evaluation、Session Identifiability。
- 实际执行 installed Batch 2.1 core `0.1.4rc2` 普通推荐，126 个原 golden cases 保持一致；既有推荐测试 3 项通过。
- 两次独立生成 existing baseline 与七指标报告，两个文件 SHA-256 逐字节一致。hash 见 [replay.sha256](evidence/replay.sha256)。报告未使用系统当前时间。
- 原 main 的 title_song_relations 与 research/dojo 等未提交工作原样保留；本工作树仅新增 Batch 3 文件。

运行命令：

```bash
bash scripts/memory/run_qa.sh /bin/bash scripts/verify_player_intelligence.sh \
  /www/server/nvm/versions/node/v24.13.0/bin/node \
  /home/sigaer/taiko/taiko-forum/taiko_viewer/node_modules/typescript/bin/tsc \
  /var/tmp/taiko-batch21-20261124/installed-rc9/bin/python \
  /var/tmp/taiko-batch21-20261124/core/tests
```

本地完整原始证据：`/home/sigaer/taiko/qa-vault/runs/qa-76e08088447d/evidence`。为便于分支审阅，保存本次工具输出与 wrapper manifest 的副本。wrapper 的 final manifest 有退出/子进程清理证据，不包含进程峰值；不将采样或配置预算冒称实际峰值。

## 指标结果的正确解释

| 合成算术 oracle | 结果 |
| --- | --- |
| Stable Precision 保守下界 / 条件精度 | 0.25 / 0.50，未知 2/4 |
| Actionable Coverage / slot coverage | 1 / 1 |
| MAE / RMSE / bias | 15 / sqrt(250) / 5，逐次标签 2 |
| 概率校准 | unavailable；独立测试提供人工概率时 Brier=0.20 |
| 不同歌曲配对 / unique chart ratio | 1 / 0.75 |
| Repeat Rate | 0.25 |
| Goal 完成率 / 可评价覆盖 | 1 / 0.5，仅关联非因果 |

这张表仅验证两个 synthetic decisions 的已知算术答案，不能作为用户群体效果。旧策略回放报告中实际输出 841 条、请求 1176 slots；没有 stable target、逐次游玩或 Goal 标签，相关质量指标保持 unavailable/unknown。完整输入不足与实际零候选明确区分。

## 验收过程中修复与保留限制

首轮类型检查发现外部 envelope 的 TS narrowing 与共享 contract 的 `.mjs` 类型导入问题，已修复并重新通过 strict 检查。一次综合测试因新工作树没有本仓库 `@sakura-taiko/contract` 链接导致两个既有测试加载失败；runner 已仅在候选工作树建立该本地包链接，重跑 76/76。另一次 memory QA 锁正被占用，按既有流程等待，没有绕过隔离。以上失败不作为成功样本或跳过测试处理。

Nuxt 完整构建、浏览器交互、生产 smoke、真实标签效果评估均未执行。本批没有 UI/路由接线，不需要发布构建；后续 Living Home 接线按其独立验收执行。未调用 deploy、未合并 main、未创建稳定 release tag。已检查仓库工作流：当前 release 仅由指定稳定 tags 触发；本候选分支推送不触发生产部署。

审查重点：实验 stable 准入阈值的校准；真实 identifiable-play 导出协议；score-pb 之外的目标支持；真实 exposure warmup 与终点 goal evidence；未来外部制品正式 Schema 的兼容性。它们没有被伪装成已完成的生产能力，也不阻塞本批基础层验收。
