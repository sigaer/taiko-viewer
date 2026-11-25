# Personal vs Cohort 真实对照结果

状态：**WAITING_FOR_EXTERNAL_ARTIFACT**。

正式Cohort Artifact尚未从外部生产者转移，Viewer没有导入逐用户原始数据。当前不能回答“真实Rating相近群体是否提供独立预测增益”，没有真实MAE/Pinball/排序/覆盖率或Bootstrap区间可以报告。未将合成数值填入这些项目。

待正式匿名Artifact、本人排除与修订证明，以及符合相同目标和独立留出的匿名评估证据到位后，再按冻结协议比较M0–M4。M5可选。不能仅凭一份群体CDF推断个体留出实验已经完成。

当前[外部实验状态](external-experiment-status.json)的results/primary/splitAudits均为空。默认CLI只输出该等待状态。

[aggregate-results.json](aggregate-results.json)保留此前225行**历史合成流程验证**，resultKind=historical-synthetic-smoke，status=SYNTHETIC_SMOKE_ONLY，绑定源码提交0c261b0bec3cb0642cd603b198acb243da4c2c40及协议v1。这些数字来自模拟分数，不代表真实玩家，也不是当前内层CV选λ的v2结果；不据此推荐任何模型。该文件可通过verify_report.py按历史源码Hash验证，不伪装成当前源码的运行结果。

本次改版验证了固定M0保真、训练内CV λ、完整用户分折、相同测试集合、各指标计算与无外部数据时不运行真实比较。没有为了改善合成数值调整目标、指标或切分。
