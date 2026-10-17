# 丢失 SQL / PNG 原始证据的最小补验方案

状态：`NOT_RUN_AFTER_RESOURCE_STOP`。固定业务源码和第三方依赖没有变化；新构件已完成来源、94×2 安装清单及关键 Oracle 检查。以下仅补四个已安装 CLI 的 SQL/文件连接入口，不重新运行旧 119 项故障矩阵。Annual PSI 停止后没有执行这些用例。

| 测试文件（taiko_viewer/tests） | 原有用例名称，断言保持不变 |
| --- | --- |
| accountSyncCanonicalSql.test.mjs | real cookie sync preserves complete DTO and two C/H observations; nonce replay bypasses cooldown |
| accountSyncCanonicalSql.test.mjs | worker pins owner and current binding until its one SQL commit |
| sourceProxySql.test.mjs | formal update image uses the exact published current/history view and private file cleanup |
| sourceProxySql.test.mjs | real Hiroba sync receives credentials only over stdin and publishes one current/history observation |
| qqMigrationProxySql.test.mjs | actual service issue and migration use shared Python SQL transaction with private responses |
| qqMigrationProxySql.test.mjs | ordinary session self migration uses exact QQ authority and atomic bare fallback |
| hirobaCredentialSql.test.mjs | actual discovery and one COMMIT save all cards, hidden slots and frozen manual/current DTO |
| hirobaCredentialSql.test.mjs | invalid Authorization never falls back to a valid Cookie |

执行前仍需当前候选 manifest、实际 `_test` 数据库证明及显式 mutation opt-in、当前 run scratch、原 cgroup 和压力准入；不允许生产 SQL 或旧路径兜底。精确名称筛选必须证明实际执行数，零通过或全部 skip 不得算 PASS。已签收的 lifecycle 46×2 不因此重跑。

原 12 PNG 是冻结源码动态双渲染对照，不是 Git 内的 12 张静态 golden。固定 Git 的 assets 仅占位，原素材/字体身份尚未恢复；新 14 项合成素材不可替代旧像素等价。可准备单张 **NEW_SYNTHETIC_B30_PARITY**，但它不能关闭旧 12 PNG 的原始证据缺失。未读取私有素材，也未启动新渲染负载。

旧 119 / 12 的状态均为 `HISTORICAL_ACCEPTED_RAW_LOST / CURRENT_ARTIFACT_REUSE_NOT_ESTABLISHED`。上述方案及后续复用裁决须与实际执行证据分开记录。
