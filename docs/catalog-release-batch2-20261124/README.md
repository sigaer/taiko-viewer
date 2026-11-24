# Taiko Viewer Batch 2 — Catalog Authority & Release Readiness

日期：2026-11-24。**交付可审阅的架构、RC和证据；全系统Release Gate仍未通过。** 原Correctness Repair候选保留，本批不merge main、不push、不发Release、不部署、不改真实成绩/生产库、不覆盖Publication、不回填Measurement，也没有开发新推荐引擎或Taiko Agent。

主要结果：Center Core0.1.3rc1可追溯wheel和配套Application0.9.3rc1/Bot0.26.4rc1已真实安装、依赖检查通过；12项契约、76项Python、310项Node和Viewer构建通过。27桥接18通过、Client9项失败，完整兼容仍是阻断门槛。3003份TJA全部扫描，1832静态范围COMPLETE、1171 PARTIAL；绝对对齐和动态LEVELHOLD未验证。

| 要求交付 | 入口 |
|---|---|
| 1. Core Artifact Provenance Report | [制品溯源](core-artifact-provenance.md) |
| 2. Dependency Compatibility Matrix | [兼容矩阵](dependency-compatibility.md) |
| 3. Catalog Source of Truth Matrix | [源权威、身份、地区、发布语义](catalog/source-of-truth.md)，[逐首逐谱面identity map](catalog/song-chart-identity-map.json)，[source alias map](catalog/source-alias-map.json) |
| 4. Catalog Authority Architecture | [目标契约、五政策、不可变快照](catalog/architecture.md) |
| 5. Catalog Consumer Migration Matrix | [逐消费者迁移](catalog/migration-matrix.md)，[494个源码调用位置](catalog/consumer-inventory.json) |
| 6. Publication Integrity Report | [调查与限制](integrity/publication-report.md) |
| 7. Measurement Integrity Report | [原11次逐条、额外3次、根因与影响](integrity/measurement-report.md)，[逐条矩阵](integrity/measurement-event-matrix.json) |
| 8. Full TJA Corpus Scan | [扫描说明](timeline/README.md)，[3003文件索引](timeline/file-index.json)，[summary及压缩全event artifact](timeline/scan-summary.json) |
| 9. Canonical Chart Timeline Golden Corpus | [手算Golden及完整事件](timeline/golden-corpus.json)，既有Node/Core Golden纳入回归 |
| 10. Taiko Domain Knowledge Primer | [docs/domain/taiko/](../domain/taiko/README.md)（官方/项目/经验/假设分级） |
| 11. Updated Roadmap | [路线与批准边界](roadmap-and-gates.md) |
| 12. Unresolved Risks and Release Gates | [逐Gate状态](roadmap-and-gates.md)，[独立验收与失败证据](validation.md) |

Catalog发现：2993首集成目录、raw/merged有7个难度差异；rating/scoreline/原TJA均不能独立作为区域资格权威；`region_map.json`实际是地理映射。首选单Builder产生版本化只读snapshot与中央policy结果，消费者仅用轻量读取适配，未直接改造全部消费者。

Publication：916个current实际验hash，原1个对象长度/hash不符且与projection共享inode；两代历史751个对象、1499引用中1个坏引用，当前关联1个账号。原字节留证，实际写入进程仍未知。Measurement：原11次同绑定0样本归档触发reader拒绝，SQL upsert未进入；另3次属第二绑定。每请求scoreRevision未被原日志记录，不能精确恢复，未冒充已确认。

Kinoko2765手动导入标记不列为修复异常，新回归确保不生成play/growth事件。Weekly允许跨模型比较，保留差值，仅增加模型变化/信息不完整的中文日文说明，并验证窄屏布局。

保留位置：本批Viewer `/var/tmp/taiko-batch2-20261124/integration`、Bot `/var/tmp/taiko-batch2-20261124/bot`、Core `/var/tmp/taiko-batch2-20261124/core`；最终wheel与SHA清单 `/var/tmp/taiko-batch2-20261124/release-candidate/`；原始私有证据 `/var/tmp/taiko-batch2-20261124/evidence/integrity-private/`。详细分支/commit与证据归档见 `handoff.json`。只等待验收，没有隐式后续发布动作。
