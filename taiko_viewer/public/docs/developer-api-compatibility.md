# Developer API 现行兼容边界与变更承诺

适用当前已公开的 Developer Token 四接口与 ResourceGrant v1 读取；网站版本、API 路径 v1、计算模型 v1、Contract 1.1 以及内部 ScoreRead 1.0 分别管理。Contract 1.1 自 Viewer 1.0.0 正式冻结，发布决定见仓库 docs/releases/1.0.0.md；对应 meta 返回 CONTRACT_FROZEN / contractFrozen=true。此前候选状态保留原历史含义。冻结只确认当前结构与语义，不修改权限、灰度或运行开关。

## 保持稳定的边界

- Contract 1.1 类型正本为 `packages/sakura-taiko-contract/schema/contract-v1.json`；当前运行 schemaRevision 为 `30591840759a1d437e01f002f215a320673ce7ed95580d30f162756339c646db`。Python/TypeScript 绑定由同一正本生成。公开 HTTP DTO 按对应 OpenAPI 的白名单及附加约束解释，不将内部 canonical Score 的可选 legacy 证据字段开放给外部响应。
- `/api/v1/taiko/catalog/songs` 无查询参数、一次返回有界完整目录；不是分页或截断列表。顶层 versions 只含 contractVersion、schemaRevision、catalogRevision。CatalogSong 保留 songId、song_name、song_name_jp、aliases、status、charts；CatalogChart 只有 difficulty 和 level。difficulty 为 1–5 难度，level 为星级；曲名缺失为 null，别名缺失为空数组，缺少谱面不补造。status 为歌曲 shelf 元数据，不能解释为每难度/地区可用性。
- `/api/v1/taiko/players/{playerId}/profile|scores` 保持 opaque playerId、版本封套、Schema 字段/nullable/unknown 语义及完整响应边界；不把观察时间改称游玩日期，不重算冻结历史。`account:read` 新同意与既有 resource-consent-v1 的原 scope/到期规则分别保留，旧授权不自动扩大。
- Developer Token 当前成绩保留来源中实际存在的 profile、songs、achievement、dojo、_meta 键；嵌套内容本来是来源相关 JSON，不承诺每条成绩具备某个来源字段，继续过滤敏感键。Rating/推荐字段以当前四接口 OpenAPI 为准，聚合样本数、详情上限、维度类型、排序和比例的已发布含义保持不变。
- 旧 Developer Token 已批准的跨账号当前成绩只读与 v1 ResourceGrant 是两套现有授权域。撤销 ResourceGrant 不自动撤销旧 Developer Token 的成绩只读权限；撤销旧全局读取的 source service grant 不等同撤销 ResourceGrant。但撤销或停用两边共用的 Developer Key、应用或账号，会按各接口现有校验同时拒绝相关请求。history/growth scope 继续不开放；无隐式升级、无新增同步或写入能力。公开文档可见不等于权限授予。
- 鉴权/撤销仍先于私有内容与304；SDK不缓存私有载荷、不自动重试、不在304提供旧数据。各接口已公布的缓存和错误格式差异保留，不承诺统一错误封套、固定配额、固定延迟或自动 Retry-After。

## 变更与弃用

- 修复及内容数据刷新不得静默删除、重命名字段，修改字段类型/必填性/null 或缺失语义、ID命名空间、难度/星级含义、时间含义及权限。目录内容 revision 可以随正常更新变化；它不代表公开结构可以任意变化。
- 现有 Schema 的严格对象普遍 `additionalProperties=false`，因此即使增加可选字段也需先判断严格消费者兼容性；不能笼统承诺“所有新增字段均兼容”。枚举扩展、边界/分页调整同样先做兼容检查。影响现有严格客户端的结构变更使用显式新契约/响应版本及迁移说明，不能只改网站 patch。
- 变更记录须同时列 Schema revision、公开 DTO/OpenAPI、生成绑定及实际受影响 SDK/消费者；复用现有 CI 的生成检查、跨语言 Golden 和对应 HTTP/权限反例。不将内部 API 改造或 UI 上线当作外部采用证据。
- 当前没有安排旧 Token、既有授权、现有完整目录或任何已公开接口的 sunset 日期。未来确需弃用时，先发布旧/新字段或路径、替代方法、影响面与明确迁移窗口，留下实际已知消费者通知/验证记录；窗口未经现有发布流程确认前不执行删除。此处不虚构已有通知、客户确认或固定天数。
- 早期候选的 Song.title、独立 catalog/charts、include 查询及 rc.7 冗余目录字段已经在 0.85.0 正式发布前按现有说明移除；本承诺不把它们恢复，也不将早期候选消费者等同当前 DTO。

## 已知消费者与正式冻结

当前源码内14个 Contract 使用点、服务端SDK示例、既有受控真实HTTPS/隔离HTTP记录已核对。独立 Bot/Client 保留其内部认证域和历史安装pin；没有证据证明所有外部第三方已经迁移，也不把独立旧应用强制迁移列为1.0前置项。

正式冻结依据2026年10月31日Viewer 1.0.0发布决定，受控lifecycle、有效OpenAPI和meta示例同步。Schema revision保持不变，现有授权与安装构件不迁移。后续变更遵守上面的兼容检查与弃用承诺，不把网站版本号作为扩权凭证。
