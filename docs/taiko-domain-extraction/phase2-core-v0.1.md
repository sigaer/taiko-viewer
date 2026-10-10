# Phase 2：独立 Taiko Core v0.1 验收

2026-10-11 Asia/Shanghai。Gate 0/1 已 PASS 后，按 models → parsers → calculation → recommendation 顺序完成，Gate 2 PASS。

仓库：[sigaer/sakura-taiko-core](https://github.com/sigaer/sakura-taiko-core)，版本 `0.1.0` / tag `v0.1.0`，Contract v1.0 / package `0.1.0`。四步提交：

| 步骤 | 提交 | 结果 |
| --- | --- | --- |
| 1 Models | `5044daf` | Player 与契约身份分离；Song/Chart/Score 和原数值 dataclass |
| 2 Parsers | `0e41ab2` | TJA text parser、Hiroba HTML/score mapper，显式 clock |
| 3 Rating / Dimensions | `8d14f5b` | v1 公共公式、v2 center/client profiles、显式 full-score reference |
| 4 Recommendation | `675892a` | 公共候选与排序，两端目标策略、连打/目标容错；显式曲库可用性和日期 |

独立 wheel 安装后 15/15 测试 PASS；源码 bootstrap 和安装产物均验过。Golden 输入全部为合成曲库/成绩，不读取用户数据或数据库。旧 Oracle 固定 A `5ac44b3` / B `46c8646`，每个抽离符号保留 SHA256 和变换说明。具体结果与 wheel hashes 见 [验收证据](evidence/phase2-validation.json)。

| Golden 族 | 对照数量 |
| --- | ---: |
| TJA | 7 |
| v1 聚合 | 252 |
| v2 公式边界 / profiles | 168 |
| v2 full-score reference / 聚合 | 144 |
| 普通推荐候选、评分、排序 | 126 |
| 两端目标推荐 | 60 |
| 连打、特殊气球、目标容错 | 96 |

额外覆盖 parser profile/list/detail/achievement、v1 六维、v2 records/DF exception/低精度/过计数、目标用户 profile 的有/无成绩分支。浮点与字段使用精确相等，不做容差掩盖算法漂移。Core AST boundary 无 NoneBot/QQ/HTTP framework/SQL/filesystem/UI 依赖；只允许纯标准库、契约与可选 BeautifulSoup/urllib.parse。

包构建使用运行环境已有 setuptools 68.2.0；系统 Python 的 wheel backend 不全，因此首次构建失败后换用该完整构建环境。安装验证使用 `/var/tmp` 的独立 target，没有修改生产 site-packages。生成目录不提交。

本 Gate 验证 v0.1 要求的独立领域内核；生产消费者尚未切换。剩余混合 orchestration（包括 estimator）在 Phase 3 接入时继续抽离并核对，不能因 Core 存在就宣称 Sakura 已成为 adapter。Phase 3 未 PASS 不进入 Phase 4。

回退：生产没有接入，当前运行行为不变；Phase 3 pin wheel/版本/哈希，保留旧 Git 基线、adapter API 和兼容测试，任何数值策略改变必须新建 profile。Viewer package/version 未变化，无须部署或重启。
