# Known Limitations

- 没有可信在线 V2 Recommendation Candidate Producer：accept_recommendation 明确 unavailable，不接受或转换 V1 token。已实现并验证存储层 nonce 唯一消费，尚无在线 V2 token 签发/验签链路。
- 生产迁移、发布和部署均未执行。本候选迁移 CLI 刻意只允许 `_test`；未来生产工具、停写与恢复方案必须独立审查和授权。
- Manual binding 没有可信成绩来源，不能创建/评估依赖成绩证据的 Goal。手动创建是用户操作方式，不会转换成绩来源。
- played、score-target、dimension-practice、task-progress 不开放创建；没有新增推荐或 Rating 算法。
- Availability 是保存的目录检查状态及 revision，没有新增目录变更订阅器；不会在 GET 里自动写入或把未知状态改成可用。取消/恢复不会改写它。
- 历史游标固定终态 snapshot，当前 active/paused 视图反映当前 revision；这不是任意历史时点的完整 Portfolio 回放接口。
- 历史非法 JSON、丢失整个 Baseline、无法确定归属的记录在 preflight 停止激活并保留原始数据，不自动修复。可解析但证据不足的 Baseline、未解析 Chart 则保留为 unsupported/unknown。
- Strict TypeScript 对修改的 Portfolio 服务采用显式类型的 IO adapter 边界；Nuxt 构建验证真实依赖的打包。不是全仓 TypeScript 或完整发布回归。
- 浏览器测试为实际组件连接隔离 SQL/API，认证及 source/catalog 是合成 fixture；没有生产登录、真实同步、真实玩家验收。
