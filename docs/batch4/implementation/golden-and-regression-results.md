# Golden and Regression Results

2026-11-24，Lead 在独立候选 worktree 执行；所有 QA 经现有 memory/run_qa.sh 隔离和共享锁串行运行，没有服务、浏览器、真实账号或数据库访问。

| 检查 | 最终实际结果 |
| --- | --- |
| 新内核 Strict TypeScript（含测试与 benchmark） | PASS |
| 新 B4 Node tests | **109/109**，0 failed/skipped/cancelled |
| 原 B3 Strict TypeScript | PASS，配置未修改 |
| 原 Node tests | **92/92**，0 failed/skipped/cancelled |
| Core Golden | **126/126**，原 fixture 未改，连续回放两次 |
| Core regressions | **3/3**，两次运行均通过 |
| B3 两份报告及 replay.sha256 | 与 a68d8bda/B3 原字节一致 |
| 生产边界 | 旧 server/types/packages/player-intelligence 与 B3 docs 无差异 |

最终集成 run：`qa-f60f48f1ac35`，exitCode=0。原始 output 与 manifest 保留在 `/home/sigaer/taiko/qa-vault/runs/<runId>/evidence/`，副本见 [证据目录](evidence/qa-runs.json)。早期 strict TS 失败已修正，其日志也保留，不把早期失败隐藏成一次通过。

```bash
bash scripts/memory/run_qa.sh /bin/bash scripts/verify_multi_objective_integration.sh \
  /www/server/nvm/versions/node/v24.13.0/bin/node \
  /home/sigaer/taiko/taiko-forum/taiko_viewer/node_modules/typescript/bin/tsc \
  /home/sigaer/taiko/taiko-forum/taiko_viewer/node_modules/@types \
  /var/tmp/taiko-batch21-20261124/installed-rc9/bin/python \
  /var/tmp/taiko-batch21-20261124/core/tests
```

| 契约编号 | 实际覆盖 |
| --- | --- |
| R01–R03 | 真实 Authority row/alias 切片、namespace隔离、歧义/exists/policy/旧Goalunknown |
| R04–R06 | 无Rating兴趣探索、high兴趣不可提级、独立load-fit水平探索 |
| R07–R09 | Rating与预测单位/provenance分离、null/0/低Rating/邻居<20、poolCount未知 |
| R10 | 原B3报告SHA不变；旧未解析曝光key使history unknown |
| I01–I02 | 联合注册表、Personal Goal非intent、同类型不同readiness、水平探索进A |
| P01–P05 | N=0/1/2/3/5、R1S8、非法A、过滤stretch子集、50%而非70%硬门槛 |
| G01/G05/G09纯函数部分 | 独立Goal状态、精确目标/baseline/revision、幂等、冲突拒绝、不写目标 |
| T01–T03 | PB-only、score边界、baseline+1及safe integer |
| T04–T06 | score不可替代皇冠、四类型near/两次stretch、聚合/模式/total/gauge拒绝 |
| T07–T08 | 训练玩家+谱面+负荷、未知一致性、无佐证弱项拒绝、四种覆盖状态 |
| T09–T11 | 任务过期/进度、同次任务不拼PB、played/new type unsupported |
| C01–C06 | Chart聚合/歌曲去重、用户优先级与偏好、重复历史、非法输入、确定性/容量 |
| 独立审查追加 | 已达标NG/Rank/皇冠、多个snapshot、unplayed与PB冲突、跨类型理由/缺limitations、payload内部未来、NG未知模式 |

没有把上述 T 的输入契约校验称为新预测模型准确率；没有运行 G 的真实 CAS/token/nonce/迁移事务或 E 的实际事件采集。P04 是 planned subset 验证，不是浏览器曝光测试。

保留 SHA-256：existing-baseline.json=`ed6ed2b0f0bfce8ef197536a0e81f32a9115d133b235f5dd69d8e3b02b53f36f`；offline-benchmark.json=`acf208e6efb5a62b44e9b4a33f526c52e7cab03574c02400d114b90337e57bbc`。

原 B3 worktree 仍为 c49717b6，原 B4 contract worktree 仍为 a68d8bda，均干净。未改旧 Golden 预期以适应新内核。

最终文档与边界检查 run=`qa-3c61c092c571`：12/12 必需报告、19 个相对链接、代码块配对、14 个内核文件哈希、允许修改路径和未接生产入口检查通过；记录见 [boundary-audit.json](evidence/boundary-audit.json)。此前检查发现三处报告相对链接层级错误，已修正；失败日志也保留。成功检查的原始 manifest/output 同样在上述 QA vault，exitCode=0、childrenStopped=true、stopReason=null。
