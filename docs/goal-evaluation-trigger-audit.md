# 0.69.1 Evaluation Trigger Audit

2026-09-19。实施起点 canonical version 0.69.0；0.69.0 发布 Gate 已关闭。此文是编码前审计，不能作为 0.69.1 验收完成声明。

## 写入路径

| 路径 | 实际边界 | Evaluation 风险 |
| --- | --- | --- |
| account sync / Wahlap | Viewer requestSyncDispatch → 外部 scripts/sync_dispatch_server.py → getUserData → plugins/utils/userdata_storage.py save_userdata | 不经过 writeUserdataWithHistory；dispatcher 回执无绑定内容 revision，读取共享文件存在跨写入竞争 |
| Hiroba proxy sync | taiko-center.ts → 外部 sync_hiroba_userdata → save_userdata | 不经过 Viewer 通用 writer；必须验证实际 source/account |
| Kinoko score import | mergeKinokoScores → writeUserdataWithHistory(kinoko-import) | 旧成绩迁移，不能以导入时间证明 Goal 后游玩 |
| Kinoko history | writeKinokoHistorySnapshots + kinoko-history-current | 历史回填；历史兼容 source 为 wahlap，同时带 imported_via，不能只根据 source 白名单判断 |
| 网页编辑/新增/导入 | account/songs.ts → writeUserdataWithHistory(web-account/web-score-import) | 非 manual binding 也能人工修改；payload 可能保留旧 _meta，必须验证内容完整性 |
| manual | manual.ts → writeUserdataWithHistory(manual-*) | 全部排除 |
| dispatcher 本地转存 | write_local_snapshot 直接写当前文件/历史 | 不是新成绩事件；写入时间不能作为证据 |
| 外部 bot / repair / direct file writes | 不收敛于 Viewer writer | 缺少可验证来源或连续性必须 inconclusive |

外部 Python 路径仅只读审计，本任务不修改其他仓库。save_userdata 产生 schema_version=2、source、source_account、merge_topology、ts、synced_at 和 content_sha256，但不提供 prev_revision 或跨 writer sequence。content_sha256 的规范化使用 Python ujson，去除该字段后 sort_keys；不能直接假设普通 JSON.stringify 等价。

## 决策

采用 B：显式 authenticated POST evaluation，服务端读取当前 authoritative 文件，客户端不提交 observation。GET Overview 保持只读。不得仅因 sync HTTP 成功便将随后读到的文件视为该次同步的结果。

来源验证必须包含内容校验、source/account/topology、baseline 与 observation 的相同语义，以及新鲜同步标记；标记本身仅证明观察顺序，完成条件仍需严格 best-state/累计变化。旧缓存、同 revision、历史回填、源切换、重置或无法验证字段时 fail closed。文件 mtime、request/evaluate time 不充当成绩事件证据。

0.69.0 旧 Goal 没有冻结 score-source provenance；不得事后从当前文件补造旧 baseline 来源。此类 Goal 如无法恢复可验证 baseline，保持 active/inconclusive。新创建 Goal 应冻结通过验证的 provenance；不新增 SQL schema。未知完整性的未游玩 Goal 继续关闭。

## 待实施 / 验证

来源校验与连续性策略需要先通过真实 writer 格式 fixture（包括 ujson 编码差异、历史导入、网页编辑保留元数据）验证，再启用 completion。纯规则、真实 SQL 并发、UI matrix、生产 completion smoke 全部通过前不得声明 Evaluation enabled 或 COMPLETE。

实施与生产验收现已完成，见 [0.69.1 最终状态及 28 项报告](goal-evaluation-implementation-status.md)。本审计保留编码前的边界与选择依据。
