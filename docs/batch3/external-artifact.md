# Taiko Agent External Artifact Consumption Boundary

这是 Viewer 自己提出的候选消费信封 `viewer-analysis-artifact-draft/1`，不是 Taiko Agent 已有或已承诺支持的 Schema。本任务没有访问其仓库、检查其代码、复制内部实现或要求共享文件系统。

| 字段 | Viewer 消费要求 |
| --- | --- |
| envelopeVersion | 本消费边界版本；未知版本拒绝，不做猜测升级 |
| chart | namespace / id / difficultyType；必须匹配期待的 catalog 精确身份 |
| catalogRevision | 对应谱面目录版本；不默认把旧分析用于新目录 |
| sourceHash | 该分析所用源制品 SHA-256；由外部提供者说明具体字节范围；需匹配 Viewer 预期，不从标题推断 |
| analysis | producer / version / schema；标识实际导出格式与算法，不能用 envelopeVersion 代替 |
| featureCoverage | available / missing；不交叠、不重复，未知不是零值 |
| featurePayload | 按导出 schema 解释的 opaque 对象；字段与 available 对应；本批不理解领域内部特征 |
| evidenceReferences | 有限的证据引用，只有可追溯性含义；不会自动取 URL、读取路径或执行内容 |
| diagnostics | 有限 code + severity；error 隔离拒收 |

`inspectExternalArtifact(json, expectedScope)` 对最多 262,144 字符的本地字符串做结构/identity/catalog/hash/coverage/diagnostics 检查。它不 fetch、不读文件、不注册 runtime adapter。结构有效也只返回 `quarantined` 与 `usableForMatching=false`，因为正式 schema 和语义尚未完成兼容性评估。UTF-8 文件接收端未来还需单独限制字节数、签名/供应者权限、压缩展开和 JSON 深度；本批没有创建上传入口，不能把此函数作为完整不可信上传服务。

将来项目负责人提供正式导出制品后，评估顺序：确定真实 schema 与 hash 字节范围 → 保存原制品/hash/producer/version → 检验身份/版本/coverage → 用离线 fixture 写显式 adapter → 验证特征单位、坐标、缺失值、evidence 语义 → 与无该特征的 baseline 做消融 → 审查兼容性 → 独立决定是否接入 Viewer。拒收诊断必须可读，不能静默丢字段后继续推荐。

外部能力缺失或制品过期时仍使用当前已验证 catalog、Rating 和 stable predictor 基础能力；不调用远程 Agent，也不重写其领域知识、Guide–Chart Alignment 或音乐理解。本批没有生产 import、远程依赖、轮询任务、协议双写或共享状态。
