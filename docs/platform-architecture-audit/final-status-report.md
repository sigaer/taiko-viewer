# Sakura Taiko Platform Architecture Audit

```text
STATUS: AUDIT COMPLETE / REMEDIATION NOT STARTED
MODE: READ ONLY; documentation output only
DATE: 2026-10-10 Asia/Shanghai

Repositories audited:
- Sakura_bot @ 5ac44b3
- taiko-bot @ 46c8646
- Viewer / taiko-forum @ 8d70df2 (0.81.10)

Files analyzed:
1,180 source/structural files statically scanned
146 paired center-runtime source files compared separately
24 allowlisted public dataset files hashed separately
211 Viewer route handlers inventoried

Functions analyzed:
6,463 statically indexed function/method candidates
  Python AST definitions: 3,728
  JS/TS line-pattern candidates: 2,667
  Java declaration-pattern candidates: 68
Key data/auth/compute call chains manually traced;
not a claim of full semantic review of every indexed function.

Current architecture:
Center Python acquisition/algorithms + shared JSON/MySQL
+ Viewer account/community/growth/API and additional Writers
+ taiko-bot center-data client with local duplicated computation.

Major duplication:
53 same-path bot file pairs; 10 byte-identical files;
718 same-qualified-name Python AST-identical functions;
11,365 non-overlapping B function source lines covered.
Rating v1 cores copied; v2 accuracy, target recommendation,
availability filters and history handling have diverged.

Authority conflicts:
Multiple Writers to center current/history;
Web account/bot identity/upstream account are distinct;
daily archive and SQL measurements preserve different provenance;
runtime tree differs from repository in 8 of 146 paired files.

Security risks:
Private userdata and center proxy lack owner/grant checks in source;
quota token is not user authorization;
multiple shared upstream-cookie update entrances.
No claim of demonstrated production exploitation or disclosure.

Recommended future architecture:
CONDITIONAL Taiko Core for pure calculation;
central versioned API and authorization for private state;
retain bot adapters and Viewer product services.

Migration priority:
Authorization/control-plane -> publication/recovery ->
contract and runtime baseline -> pure Core -> optional DB/service split.

1.0 impact:
BLOCKED_BY_P0 until security and write-consistency gaps close,
with restore/reproducible-runtime evidence.
Core extraction and wholesale DB migration are not 1.0 prerequisites.
```

## 七个问题的回答

1. **各自承担什么？** Sakura Taiko 提供中心采集、算法、命令和曲库管线；taiko-bot 是中心数据客户端与本地计算混合体；Viewer 同时承担账户、社区、成长产品、中心 API、导入/编辑和数据聚合。
2. **哪些代码重复？** 两个 bot 的评分、六维、推荐、B30、Hiroba、历史和渲染；Viewer 基础算法主要委托中心，另有规范化/事实解释重叠。
3. **哪些数据重复存储？** songs/定数/谱面统计公共副本、B userdata/cache/u0、C/H、每日能力 archive 与 SQL measurements；它们不都应删除，语义详见 ownership 报告。
4. **哪些逻辑多个实现？** v1/v2 计算副本、目标推荐、可用谱面过滤、成绩 Writer、full/delta replay、冠标/achievement 规范化；Goal 和目标推荐是不同产品概念。
5. **真正权威来源？** 按领域：官方上游产生官方成绩；中心可编辑 JSON 是当前平台成绩状态；Viewer MySQL 定义 Web identity/Goal/Forum；Python+模型文件定义数值；Viewer TS 定义成长事实；不存在可概括一切的单一仓库权威。
6. **Core 可行吗？** CONDITIONAL，可抽纯领域内核；不能照搬包含 IO/框架/凭据的 utils。
7. **1.0 必须解决什么？** 私有数据/中心代理授权、凭据更新控制面、统一成绩发布与恢复、运行版本可复现和指标契约。无需先做全面数据库化。

## 交付目录

- [repository-inventory.md](repository-inventory.md)
- [responsibility-matrix.md](responsibility-matrix.md)
- [data-ownership-audit.md](data-ownership-audit.md)
- [duplicate-logic-report.md](duplicate-logic-report.md)
- [data-flow-map.md](data-flow-map.md)
- [api-boundary-audit.md](api-boundary-audit.md)
- [platform-risk-map.md](platform-risk-map.md)
- [architecture-decision-record.md](architecture-decision-record.md)
- [evidence-index.md](evidence-index.md) 及 evidence/ CSV/JSON 清单

## 验证边界

执行文件/历史/import/AST/hash/route 扫描及白名单服务元数据读取；另仅提取两个纯函数，用合成数字核实 v2 公式差异。分析通过内存隔离 `run_qa.sh` 运行；没有导入项目业务模块、启动应用、请求业务 API、连接 DB、读取个人 userdata 或输出秘密。没有做在线安全利用、生产负载或恢复演练；运行可达性及数据损坏情况保持 Unknown。

交付检查：10 份 Markdown 的文件链接和证据锚点无缺失；CSV/JSON 计数相符；扫描清单中的 1,180 个源文件 hash 复核未变化；当前仓库已跟踪代码 diff 为空。详见 [校验记录](evidence/validation-results.json)。

本次仅新增审计文档和无私有数据的证据索引，没有改实现、API、Writer、数据库、版本，也没有迁移、提交、推送、部署或重启。文档不影响运行代码，因此无需构建/重启。
