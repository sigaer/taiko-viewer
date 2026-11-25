# B4-3.0 / B4-3.1 候选验收

真实模型对照状态：**WAITING_FOR_EXTERNAL_ARTIFACT**。

候选分支：`candidate/viewer-type-specific-evaluators-b4-3-20261125`。B4-2基线：`bd63d0a82dae6f8c15c49542eca8aa62a233e2a3`。本次修订沿用既有候选，不重启历史审计；Viewer版本 `1.22.0-rc.2`。

核心问题“真实相近Rating群体能否提供独立增益”尚未获得真实数据答案。正式外部Artifact尚未转移，真实MAE/Pinball/排序/配对Bootstrap没有执行，不标为PASS，也不将合成改善称为真实结果或真实负结果。当前保留M0，Hybrid不可用。

## 实现交付

- [Prediction Evidence](prediction-evidence-contract.md)：五种证据角色、完整scope/修订、原始Stable/PB、分位数未知、有符号残差、reasonCodes，不修改Goal Baseline。
- [Cohort Artifact](cohort-prior-artifact-v1.md)：匿名查询节点、scoreMean/scoreMedian/Q25/Q50/Q75、distinct/ESS、观察率分母、Rating定义、身份/修订/时效及artifactHash校验。内容Hash不冒充来源认证。
- [协议v2](experiment-protocol.md)：M0冻结；M1–M4、3种累计匹配、5种预算、3种留出；M5可选未运行。λ由训练内部完整用户CV选择，校准用户也从λ选择中排除。
- [真实对照状态](personal-vs-cohort-results.md)和[融合状态](hybrid-fusion-results.md)：均为WAITING_FOR_EXTERNAL_ARTIFACT。
- [泄漏与验证](data-leakage-and-validation.md)和[限制](limitations-and-negative-results.md)。

[external-experiment-status.json](external-experiment-status.json)是当前实际入口结果，results/primary/splitAudits为空；包含当前协议Hash与源码指纹。默认命令无需Bot源码或任何玩家文件：

```bash
bash scripts/memory/run_qa.sh /usr/bin/python3 scripts/prediction_experiment/run.py \
  --output /var/tmp/b43-external-status.json
```

旧[aggregate-results.json](aggregate-results.json)仅保留为**历史合成流程验证**，明确SYNTHETIC_SMOKE_ONLY、绑定源码提交 `0c261b0bec3cb0642cd603b198acb243da4c2c40` 和协议v1。其225行模拟数据不是当前内层CV模型的评测，也不是现实增益结论。本修订只运行必要合成定向测试，未为了获得更好模拟结果重跑或优化全矩阵。

M0继续使用未修改的本机Bot纯核心，源提交 `38a47d882a48883cda91ca27f778adfd8ddb2ef9`，核心SHA256 `b2f46ea056c8b20691a41c17dc7253c6c1b9483bd82bd8536fc6da1897929ae0`。没有复制/重实现另一套Bot预测公式。

## 候选展示

候选环境两个运行时开关均默认关闭：

```text
NUXT_PREDICTION_COMPARISON_CANDIDATE=true
NUXT_PUBLIC_PREDICTION_COMPARISON_CANDIDATE=true
```

现有Goal Preview对话框复用对照组件；Goal Portfolio保留已有候选入口。明确标记合成画像，显示Personal/Cohort/Hybrid、分位数、人数/ESS、各模型版本、证据修订、缺失证据和限制，并显示“等待外部群体数据”。Hybrid维持未知；没有接受推荐、写入成绩或改写Baseline的动作。组件使用独立ARIA ID，支持两入口共存。

API `GET /api/candidate/prediction-preview?state=available|missing|sparse|revision`，默认404，开启也只读合成fixture，拒绝额外身份参数，private/no-store/noindex。没有真实数据producer、账号导入、跨设备调用或真实预测服务接入。单份匿名群体CDF也不能自动产生合规的独立留出评估标签；真实链路仍等待外部数据与排除/评估证明。

## 本次定向验证

| 范围 | 状态 | 证据 |
| --- | --- | --- |
| M0/λ内层CV/模型/泄漏/统计/入口 | PASS | qa-916c91db3539，39项Python定向测试 |
| Artifact Hash/均值/中位数/隐私/身份/分母 | PASS | qa-069795ea851a，21项Node定向测试（含Evidence集成） |
| 默认WAITING与历史源码指纹 | PASS | qa-f415ca811133，真实结果为空、历史记录匹配其旧提交 |
| Prediction严格TypeScript | PASS | qa-f415ca811133 |
| HTTP与Vue、现有Goal Preview | PASS | qa-f711ea799d36（最终文案复核）；qa-d6c533fe943f：候选gate/query/no-store、390/768/1440px、中文/日语、状态/失败重试、模型/缺失/限制、真实组件嵌入 |
| 最终跨模块验证 | PASS | qa-3198879721d4，等待状态/历史指纹/严格TS/21项契约/HTTP+Vue+Goal Preview |
| rc.2候选Nuxt构建 | PASS | 完整npm run build退出0，161.3秒；5GiB cgroup限额保留 |
| 真实M0–M4对照 | WAITING_FOR_EXTERNAL_ARTIFACT | 未转移正式Artifact与匿名独立评估证据 |

浏览器测试工具首次在已生成Nuxt配置下遇到CJS动态require失败，scope未标PASS。已修正为本地模块、明确Node require桥接及限长错误输出，定向重跑通过。没有据此改动产品算法或降低断言。

QA证据根 `/home/sigaer/taiko/qa-vault/runs/<run>/evidence`。所有QA/build经既有wrapper；源码中的内存脚本不修改。用户此前明确“跳过门槛”的本候选构建授权仅用于可用内存准入，仍保留共享锁、PSI/年度worker检查、5GiB cgroup硬限额、超时和清理。构建不执行部署脚本。

未重复B3 Golden、B4-1/B4-2全量回归、Catalog历史审计或数据库迁移。没有访问、clone或修改另一台设备的Taiko Agent；没有导入逐用户原始数据、修改Bot生产代码/Rating/真实成绩/生产推荐/Goal Baseline；不迁移生产DB、不合并main、不部署、不发布Release。完成候选提交与推送后等待验收。

最终rc.2构建日志：`/var/tmp/taiko-b43-20261125/candidate-build-rc2-final.log`，SHA256 `9bdeee0dfd2fdff5cdd92ef252170a82f4dbf5156c6a19ba1f3c878f9f0d652b`。末段日志RSS=3966MiB（不是精确峰值），现有分块/BigInt target警告未升级为错误。移动端复核补正“个人点可用但分位校准缺失”的状态文案后重新构建；此前停止的中间构建不计PASS。`.output`仅留在候选worktree，未启动服务或复制到生产。

`external-experiment-status.json` SHA256：`fbfce26eca941d8b35b07b7d3e0fe68ab49a21e936b51b4f4fe42c0f695bea51`。

`aggregate-results.json` SHA256：`8f4a8c93b925a5f462e23e04f479baa359f92fb42d000b60119937ffe71e04cc`。
