# B4-3.0 / B4-3.1 验收

候选分支：`candidate/viewer-type-specific-evaluators-b4-3-20261125`。基线 `bd63d0a82dae6f8c15c49542eca8aa62a233e2a3`。Viewer版本 `1.22.0-rc.1`。

验收状态：候选实现、合成实验、定向验证与Nuxt候选构建均已完成。真实数据中的Hybrid采用门槛未通过，保留M0。

范围：统一证据契约、匿名 Artifact Adapter、固定 Bot M0 的合成对照实验、候选 Goal 对照组件。**数据科学结论：不建议采用 Hybrid，保留 M0；真实独立信息尚未得到验证。**

## 交付

- [证据契约](prediction-evidence-contract.md)：五类证据、全身份/修订绑定、有符号残差语义、未知分布、不可变 Baseline。
- [Artifact v1](cohort-prior-artifact-v1.md)：聚合节点、严格字段白名单、distinct/ESS、时效与排除范围、显式 unavailable。
- [实验协议](experiment-protocol.md)：M0–M4、3种匹配、5种预算、3种留出各3折；M5明确未运行。
- [Personal vs Cohort](personal-vs-cohort-results.md) / [Hybrid 决策](hybrid-fusion-results.md)。
- [泄漏与验证](data-leakage-and-validation.md) / [限制与负结果](limitations-and-negative-results.md)。
- [完整聚合结果](aggregate-results.json)：225行，无成员/逐用户回测；SHA256 `4228a50ebcaf74fb1713dc37487020e635ba1bc86b2bb56a10688e5639f9ef89`。

协议 SHA256：`1babceef2e7f9d5bf8387179f3e8cbe3fba581f0d2a9373e17d26995db6fe333`。报告中 sourceFingerprints 绑定 models、validation、personal_fixture、run 的实际内容。M0 核心 SHA256 `b2f46ea056c8b20691a41c17dc7253c6c1b9483bd82bd8536fc6da1897929ae0`，Bot源提交 `38a47d882a48883cda91ca27f778adfd8ddb2ef9`。

## 使用候选对照

两个运行时开关均默认关闭；仅在隔离候选环境设置：

```text
NUXT_PREDICTION_COMPARISON_CANDIDATE=true
NUXT_PUBLIC_PREDICTION_COMPARISON_CANDIDATE=true
```

已有 Goal Portfolio 面板出现“打开对照 · 预测对照”。这是明确标注的合成画像，不是当前登录玩家的预测；不依赖该玩家成绩构造群体。可切换样本充足/缺失/不足/版本不匹配，显示个人Stable/PB、群体Q25/Q50/Q75、人数/ESS、证据修订和未知Hybrid。没有写入操作。

API：`GET /api/candidate/prediction-preview?state=available|missing|sparse|revision`。默认404；开启后只提供合成数据，拒绝额外身份参数，private/no-store/noindex。独立 HTTP+Vue harness 不需要生产账号或DB：

```bash
bash scripts/memory/run_qa.sh /absolute/node taiko_viewer/scripts/verify_prediction_preview.mjs
```

没有新增真实个人预测服务或真实 Cohort producer。真实个人接入保留严格 `adaptPersonalEstimate` seam，只有完整的可信估计快照才能包装；不能把合成 fixture 当线上结果。当前最小产品闭环是候选合成对照，而非生产预测功能。

## 验证证据

| 范围 | 状态 | 证据 |
| --- | --- | --- |
| 固定M0/模型/泄漏/统计 | PASS | qa-904a43b10f5a，31项独立定向Python测试，wrapperExitCode=0 |
| 完整实验 | PASS | qa-8d08f9914a92：225行/9折完整，wrapperExitCode=0，childrenStopped=true |
| 跨模块聚合校验 | PASS | qa-6ad589d0c16a：源哈希/目标/相同集合/完整回退/匿名输出 |
| Contract/Artifact/身份修订 | PASS | 同一scope，19项Node测试 |
| 严格TypeScript | PASS | 同一scope，prediction模块与直接边界 |
| HTTP+Vue | PASS | 同一scope，404gate/400query/no-store、390/768/1440px、中文/日语、状态/失败重试、无横向溢出 |
| 候选Nuxt构建 | PASS | 用户明确授权跳过本次可用内存准入；保留共享锁、压力检查及5GiB cgroup限额。完整构建exit=0，155.5秒 |

构建先按默认可用内存准入被拒绝两次。用户随后明确指示“跳过门槛”；仅在 `/var/tmp/taiko-b43-20261125/run-build-authorized.sh` 这份临时wrapper副本中移除本次 MemAvailable 断言，保留所有其他锁、压力/年度worker检查、cgroup限制、超时与清理；仓库内存脚本未修改。没有终止其他服务。

首个实际构建因独立worktree缺少共享Annual Schema退出；从固定Bot源提交 `38a47d882a48883cda91ca27f778adfd8ddb2ef9` 导出契约到临时 `schemas/` 后，标准 `npm run build` 全部通过。没有修改年度代码、生成类型或业务数据。构建日志保留现有分块大小/BigInt target警告，无编译错误；末段日志RSS为3851MiB（非精确峰值）。

成功构建日志：`/var/tmp/taiko-b43-20261125/candidate-build-authorized-2.log`，SHA256 `7b9577cade8e34d6034b336462c88ac65f7d75ad1e3ec98c0fdbfa5a35597a83`。生成物仅在候选worktree的 `.output`，未复制到生产、启动服务或部署。

QA证据根 `/home/sigaer/taiko/qa-vault/runs/<run>/evidence`。浏览器截图在 qa-6ad589d0c16a/evidence。所有临时监听器、浏览器及子进程在finally/cgroup清理；保留合成聚合报告和源码工作区。没有把停止或失败的scope标为PASS。

## 决策与边界

Cross-user 主配置 M4 用户宏MAE改善32,256.46分，95%用户簇CI [30,905.79,33,384.32]；Combined因目标群体覆盖0而完整回退，改善0、CI[0,0]。真实数据证据缺失，且必要联合留出未显示增益，因此不采用Hybrid。零增益不是对所有跨家族残差方法的反证。

未修改Bot生产代码或Rating算法，未接入Taiko Agent，未导入真实玩家账号/成绩，未上传逐用户回测，未改写Goal Baseline，未连接生产DB或迁移，未修改生产推荐、main、部署状态或Release。候选仅提交/推送独立Viewer分支，等待验收。
