# Canonical Identity Adapter Report

`resolveCanonicalChartIdentity(snapshot | preparedIndex, request)` 接收 namespace、原 sourceId 字符串、difficulty、catalogRevision、region 与业务 policy。成功结果包含 canonicalSongId、行内 chartId、difficultyType、identityGroup、identityMappingRef、catalogRevision、sourceSongId。

实现只读取 `sourceAliases` 指向的 canonical song，再寻找同 difficulty 的实际 row。`charts` 的来源键不作永久 ID；不按标题查找、不按数字相等跨 namespace 合并，不拼 chartId 模板。当前 whitelist：wahlap、catalog-id、ourtaiko、taikowiki、nijiiro。别名冲突或同 canonical song/difficulty 的冲突 rows 为 AMBIGUOUS；零匹配、exists=false、目录版本不符及业务不允许为 UNRESOLVED。

Authority schema=1、policy=wahlap-cn-1；`catalog_display`、`cn_current_playable` 和 `recommendation_eligible[profile]` 使用 snapshot 的真实 decision.eligible。Candidate 至少通过 CN 当前可玩政策；score 与使用 score load-fit 的分支还检查 ordinary/target 推荐资格。当前 Authority 不足以证明 JP 当前可玩，因此 JP Candidate 保守拒收，不能拿 CN 政策套用。

identityGroup 默认行内 canonical songId。没有显式 Authority 版本族关系时不额外合并版本。mappingRef 哈希绑定目录 revision、namespace、原 alias、映射证据和 canonical row 身份；不同 namespace 的合法映射可指向同一 canonical chart，但其 mapping proof 仍分别保留。

实际读取了本机 B2.1 已有 QA catalog，不是 Taiko Agent，也不是玩家数据：目录 revision `891a2a0aa47dff10f576e1ec273721a26ebfcb8bcd3f41521139f4ecc769c52f`，完整文件 SHA-256 `d93cf2a4030c4e8744b28bf07aa34f501492d487be905fedcfa186b18aac9357`。抽取两条未经修改的 row 与其八条显式 aliases，保存为 [authority-slice.json](../../../taiko_viewer/tests/multi-objective/authority-slice.json)，含来源路径与 SHA。该 fixture 是切片，不宣称包含完整目录。

R01–R03 覆盖真实 row canonical ID、来源键差异、跨 namespace 同数值隔离、同一 chart 多 alias、歧义、空槽位、policy 拒绝、目录错版、模型不支持和旧 Goal 未解析。读取 snapshot 文件及指针 SHA 的责任仍属上游 Catalog Authority reader；纯内核接收可信 frozen snapshot，不重新定义目录内容 revision 的生成规则。
