# Client compatibility and dependency convergence

Batch 2 的 9 个失败全部属于 Client 宿主的桥接失败：发布的 Core 0.1.3rc1 从旧 Center 基线构建，缺少 Client 所需接口；不是可以用 9 个新数字 Golden 修掉的问题。此批从 Core v0.1.2 的完整 Center/Client 接口基线出发，纳入 Batch 2 已审查的 correctness 修复，再加入 Authority 输入契约，形成 **Core 0.1.4rc2**。

| 依赖组合 | 候选及验证 |
|---|---|
| Center | Bot 0.27.0rc9 + Application 0.10.0rc2 + Core 0.1.4rc2；干净安装、resolver、实际宿主桥接 |
| Client | 同一组 wheel，保留 Client selection、scoreline、rating/group 接口；实际宿主桥接 |
| 联合 extras | 同一组 wheel，`pip check` 与 center,client dry-run resolver 均通过 |
| Contract | 0.1.0 保留旧序列化契约；当前 API 包装器覆写 Authority 身份和国行状态 |
| memory runtime | 1.1.0 原 wheel 原样复用 |

旧 Core Golden 126 个数值 oracle 和 fixture 文件均未改动。迁移只把本意“不限制”的旧 `[]` 输入改为显式 None；新的空 mask 表示中央明确拒绝所有候选。raw 可用性旧夹具转为负控制，活动 CN 宿主使用官方 Snapshot。历史纯函数 profile 继续有意义地保留，不能成为当前宿主回退路径。

目标推荐的原有回归夹具原来写两个 catalog JSON。本批改成明确构建一个**合成官方 Snapshot**，保留旧曲目、难度、分数和预期排序/星级等所有 oracle。否则测试会误读 QA 全量目录，得到不属于该夹具的谱面。没有通过重算预期值消除行为错误。

另外在真正安装后的模块导入发现旧 PAIR_ID_MAP 残留引用已删除变量；RC1 的失败日志与制品保留，RC2 修复。完整调用核对进一步收敛 B30、展示卡、summary、模型内存读取、缓存和 Public API aliases，后续候选统一定数/位序、缓存及历史身份保护，最终为 Bot RC9 / Core RC2 / Application RC2。先前 RC 没有覆写或复用同版本制品。

27 桥接是 Node 的实际维度 resolver × 三个已安装宿主模块的实际 `recommend_songs`，再由安装后的 Application 投影；同时检查候选 ID 和相同 revision/PV。不是 AST 代跑宿主，不用 vendored source overlay 冒充制品。额外 smoke 导入 Client/Center B30、b30_single、visibility，并在没有 legacy song_data 文件的隔离 root 验证 Authority 读取。

测试入口、各 case、环境 prefix、实际 import path、源码逐 Python 文件 SHA 与 wheel 一致性，均见 `acceptance.json` 和 release candidate 的 `bridge-cases.json`、`installed-imports.json`。最终结果以验收记录为准；没有读取私有真实用户样本来伪造通过。
