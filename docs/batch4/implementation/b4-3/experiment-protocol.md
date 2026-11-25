# 冻结实验协议 v2

真实对照状态：`WAITING_FOR_EXTERNAL_ARTIFACT`。默认入口不生成合成玩家、不调用预测器、不输出真实对比指标。本轮只使用合成数据做定向验证。协议在查看指标前冻结于 `scripts/prediction_experiment/run.py::PROTOCOL`，报告保存 protocolHash 和四个源文件 SHA256。不按结果调整目标、权重、分折或阈值。

## 数据与基线

M0 直接调用本机 Bot Git 提交 `38a47d882a48883cda91ca27f778adfd8ddb2ef9` 中未修改的纯核心 `_estimate_with_profile`。核心版本0.1.2，Git tree `49efcd37beb3b9f1a31c76b13c96490ab52e153c`，完整源码 SHA256 见 `m0-source.json`。调用前强制校验；不加载 Bot runtime、真实目录或账号 reader。使用与现有 host 相同的核心成绩、Rating、画像构建函数，显式传入所有合成对象和日期。

固定 seed=4301、clock=2026-11-25T00:00:00Z、catalog=synthetic-catalog/b43-v1、chart=synthetic-chart/1。60名合成玩家，12个目标谱面（3个家族），18个独立历史谱面。部分画像4条历史，4个画像无历史。重复快照用来验证去重，不算独立样本。合成定数表只用于本实验，不代表生产曲库。

目标为物理计分规则构造的最佳成绩快照。M0 点为原始 stable.score，PB 仅保留来源含义。每个模型使用相同 M0 可评估测试集合；M0 缺失的冷启动只报告不足与覆盖，不进行伪造点预测。

## 模型矩阵

| 模型 | 定义 |
| --- | --- |
| M0 | 固定 Bot 个人 Stable 点预测，不拟合跨用户参数 |
| M1 | 同谱面 Rating 最近24名不同玩家的均值（主配置） |
| M2 | 标准化特征上的连续 Gaussian kernel；带宽=max(第24邻居距离,1) |
| M3 | global→family→chart 层级收缩；每层 ESS/(ESS+12)，支持不足回退个人 |
| M4 | 训练用户 OOF y−M0 条件残差，经层级、ESS 与残差方差收缩后加回 M0 |
| M5 | 可选，本轮未运行，不作为验收阻塞 |

匹配累计增加：Rating；Rating+六维；Rating+六维+成绩结构。各特征尺度只从训练折拟合。所有群体模型共同使用具备 M0 的训练人群，确保残差和基线可比；冷启动成员不参与本轮群体拟合。

预算 top10、top24、top40、top60、adaptive。Adaptive 是从至少10名起，取达到 ESS24 的最短前缀，上限60。训练人群少于预算时如实报告实际人数；本合成实验 top60 常受约40名训练用户限制，不能据此声称60优于40。相同玩家的多谱面在层级池内先聚合为一个玩家贡献，所有快照先按序号/可见时间取最新。排除预测对象本人。

所有可用池要求 distinct≥5、ESS≥5；缺少同谱面时 M1/M2 回退M0，M3/M4尝试家族；家族也不可用时回退M0，包括其完整训练校准分布。全局池仅作为有可用谱面/家族证据时的 prior，不凭空声明新家族可预测。

M4 的 residual 与 normalizer/noise 全部来自外层 train。M0 是无跨用户学习的固定推理，每个训练用户的目标都不在其画像中，因此其预测也是用户 OOF 合法基线。融合校准进一步按完整用户留出重拟合。先把条件残差按 ESS/(ESS+12) × noise²/(noise²+conditionalVariance/ESS) 收缩，得到 CohortResidual。最终 Hybrid=M0+λ×CohortResidual。λ通过外层train内部3折完整用户分组CV选择，固定候选0/0.25/0.5/0.75/1，以用户等权MAE最小为准，同分选较小λ。候选网格在运行当前版本测试前固定，不通过测试集选权重；每个内层fold重新拟合尺度/群体/噪声。

分位校准的每个留出用户，其全部记录也从λ选择中排除，再做内层CV。因此融合和分位校准没有共享校准用户标签。λ选择无可用群体时为0，并输出 cohort_unavailable、完整回退M0；有足够证据但CV选择0时不伪称缺少证据，只表明训练CV拒绝融合。

分布统一使用最多24个预先按哈希选中的训练用户做完整用户 OOF 残差分位校准。M0 的点不变；校准后的 Q50 可以与原始点不同。无校准样本时三个分位数都为 null，点指标和分布可评估人数分开报告。群体不足时使用 M0 的 OOF 分布，不沿用有群体时拟合的误差偏移。Stable/PB 从不直接标为所需分位数。

## 切分、指标与采用门槛

三种协议各3折：cross-user、chart-family、combined。用户和家族先按稳定哈希排序再均衡分折，与标签无关。家族协议同时执行全部测试用户 embargo；combined 使用预先固定的家族折置换。精确定义和限制见 data-leakage-and-validation.md。

主配置固定 Rating/top24，其余14组匹配/预算组合是探索项，不用于选择“最佳测试权重”。显式synthetic-smoke模式可生成每协议75行聚合结果、共225行。当前改版没有为追求模拟收益重跑昂贵全矩阵；使用针对λ/CV和矩阵入口的合成定向测试。旧225行结果仅保留为协议v1的历史流程验证，绑定旧源码提交，不代表当前v2或真实对比。M0 在各探索配置复用同一预测与指标，其 cohort 元数据始终是主配置辅助参考，不表示 M0 使用了群体或对应探索预算。MAE/MedianAE/RMSE、三分位 pinball、50%区间覆盖/宽度、Precision/Recall/NDCG@3；排序相关标签固定 score≥950000。报告用户等权与记录加权、Rating 5/8/11/14分层、冷/稀疏画像、群体覆盖。MAE CI 与配对 M4−M0 增益用用户簇 bootstrap；主项200次，探索项50次。它们是描述性区间，不是多重比较校正后的显著性结论。

只有真实独立用户和必要 combined 留出显示稳定 M4 增益才可建议采用。合成实验无论正负都不能授权采用。缺少真实历史快照，Temporal Holdout unavailable；更新时间没有被解释为游玩时间。

## 入口与重放

实际对照默认入口（不需要Bot源码、不读取任何玩家或Artifact目录）：

```bash
bash scripts/memory/run_qa.sh /usr/bin/python3 scripts/prediction_experiment/run.py \
  --output /var/tmp/b43-external-status.json
```

正式Artifact未转移，结果只能为WAITING_FOR_EXTERNAL_ARTIFACT，results/primary/splitAudits为空。不会用合成结果填充它们。正式群体CDF本身也不足以证明独立留出增益，还需与M0一致的匿名评估证据、排除与修订证明；本轮未假装已具备该真实数据链路。

只有显式指定合成模式才执行模拟矩阵：

```bash
bash scripts/memory/run_qa.sh /usr/bin/python3 scripts/prediction_experiment/run.py \
  --mode synthetic-smoke --core-source /absolute/frozen-core \
  --workers 2 --output /var/tmp/b43-synthetic-smoke.json
```

报告status=SYNTHETIC_SMOKE_ONLY，actualExperimentStatus仍为WAITING_FOR_EXTERNAL_ARTIFACT。固定Bot commit的纯核心源码必须先导出并通过SHA256检查。无生产路径默认值、无原始数据导入。最多两个进程，与QA共享15分钟/3GiB预算，不为合成极端场景扩大预算。
