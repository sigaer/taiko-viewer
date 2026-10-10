# 证据索引与审计方法

审计日期：2026-10-10，Asia/Shanghai。A=Sakura_bot，B=taiko-bot，V=Viewer 独立仓库，R=中心运行树；绝对路径与 HEAD 见 [Inventory](repository-inventory.md)。本索引只包含源码路径/符号、hash 和聚合计数，无真实用户数据或 token。

## 证据范围

- **Observed / source**：本地文件、声明、调用链、SQL schema、Git history、AST/hash。
- **Observed / runtime metadata**：systemd ActiveState/MainPID/WorkingDirectory，进程 executable，以及只含数据路径/监听端口的环境白名单。不导出完整 environ、命令行或服务 secrets。
- **Inference**：竞态/部分提交可能性、维护和部署耦合；有明确代码依据但未执行故障或攻击。
- **Unknown**：生产外网可达性/ACL、真实数据内容/损坏、DB 当前结构与恢复演练、其他自部署实例、运行 Nitro 产物与 HEAD 的逐字一致性。

## 静态扫描口径

以各仓库 `git ls-files -z` 为列表；A 包括 taiko、taiko_backend、taiko_manager、根级入口/shared feature 与关联运维脚本，并按依赖补查 runtime_memory、miku upload/identity 边界。V 包括 taiko_viewer 和运维脚本。排除 node_modules、.output、.nuxt、tests、loadtest、public/assets/songs 数据目录；单源码文件上限 2MB。额外公共数据仅对白名单文件流式 hash。没有导入业务模块。

1,180 是静态扫描文件数，不是“人工完整审阅 1,180 文件”；关键链手工阅读与索引互补。Python AST 精确索引定义；JS/TS 使用单行声明模式，漏掉跨行/匿名函数且可能有候选误差；Java 为方法声明模式。因此 6,463 应读作函数/方法候选索引数，不用于声称所有行为已验证。

import 清单记录 from/import 目标，不把未解析的包名当成本地确定调用边。Nuxt 自动导入、Python importlib 和字符串子进程需要手工补链。完整静态调用图/跨语言语义等价证明不在此次结论中。

重复检查：匹配 A/taiko 与 B 相对路径；函数按 class/嵌套作用域限定名称匹配；比较不含位置属性的 AST dump SHA-256（docstring 仍参与）。函数源码行区间取并集，避免父/子函数重复计算。模块常量、IO、import 与不同数据版本可能令相同函数返回不同结果。

## 可复核产物

| 文件 | 内容 |
| --- | --- |
| [files.csv](evidence/files.csv) | repo/path/行数/SHA-256；1,180 行数据 |
| [functions.csv](evidence/functions.csv) | 文件、行号、限定函数名、识别方法；6,463 行数据 |
| [imports.csv](evidence/imports.csv) | 静态 import 命中；5,039 行数据，不是已解析调用图 |
| [duplicates.csv](evidence/duplicates.csv) | 53 个同路径文件对的相同与变化函数统计 |
| [identical-functions.csv](evidence/identical-functions.csv) | 718 个 AST 相同的函数对及两端行号 |
| [runtime-source-comparison.csv](evidence/runtime-source-comparison.csv) | 146 个中心源码配对；8 项不同 |
| [public-data-copies.csv](evidence/public-data-copies.csv) | 24 个允许公开的数据文件 hash；不含 userdata |
| [viewer-routes.csv](evidence/viewer-routes.csv) | 211 个 API handler 的方法/路径/直接 guard 名称 |
| [summary.json](evidence/summary.json) | 统计汇总 |

审计分析脚本和临时 JSON 放在 `/var/tmp/sakura-architecture-audit`；通过 `bash scripts/memory/run_qa.sh /usr/bin/python3 <script>` 执行。没有启动应用或执行有副作用的 GET/POST。复核时仍应使用内存隔离，且不要用业务 import 代替 AST 读取。

已有 [1.0 readiness 报告](../release-readiness-1.0/00-executive-decision.md) 仅作旁证，本轮重新追踪主要授权/Writer 路径；没有照抄其 Gate 当作本轮在线测试。此前未跟踪文档保持原状。

## 源码定位

以下链接的行号对应此次磁盘快照；后续文件修改以 evidence/files.csv 的 hash 判断证据是否仍适用。

### E01

入口与目录外共享依赖。

- [A:taiko/bot.py:12](/home/sigaer/git/Sakura_bot/taiko/bot.py:12) — `SAKURA_ROOT`
- [A:taiko/pyproject.toml:9](/home/sigaer/git/Sakura_bot/taiko/pyproject.toml:9) — `[tool.nonebot]`
- [A:feature_handler_bootstrap.py:14](/home/sigaer/git/Sakura_bot/feature_handler_bootstrap.py:14) — `def load_plugins`
- [A:taiko/taiko_runtime/memory.py:9](/home/sigaer/git/Sakura_bot/taiko/taiko_runtime/memory.py:9) — `from runtime_memory`

### E02

taiko-bot 中心客户端。

- [B:taiko_bot/viewer_client.py:36](/home/sigaer/taiko-bot/taiko_bot/viewer_client.py:36) — `def _build_headers`
- [B:taiko_bot/settings.py:32](/home/sigaer/taiko-bot/taiko_bot/settings.py:32) — `class Settings`
- [B:plugins/taiko.py:137](/home/sigaer/taiko-bot/plugins/taiko.py:137) — `proxy_center_userdata_update`
- [B:taiko_bot/manual_account.py:14](/home/sigaer/taiko-bot/taiko_bot/manual_account.py:14) — `async def call_manual_account_api`

### E03

taiko-bot cache 与禁用本地写入口。

- [B:taiko_bot/userdata_provider.py:41](/home/sigaer/taiko-bot/taiko_bot/userdata_provider.py:41) — `def update_userdata_cache_from_payload`
- [B:taiko_bot/local_api.py:84](/home/sigaer/taiko-bot/taiko_bot/local_api.py:84) — `async def put_userdata`

### E04

taiko-bot 本地持久化。

- [B:taiko_bot/sqlite_db.py:79](/home/sigaer/taiko-bot/taiko_bot/sqlite_db.py:79) — `CREATE TABLE IF NOT EXISTS bind`
- [B:taiko_bot/storage.py:86](/home/sigaer/taiko-bot/taiko_bot/storage.py:86) — `def write_userdata_with_history`
- [B:plugins/utils/merged_bind.py:57](/home/sigaer/taiko-bot/plugins/utils/merged_bind.py:57) — `def materialize_merged_bind_userdata`

### E05

中心官方成绩生产与 Writer。

- [A:taiko/plugins/utils/update_user.py:23](/home/sigaer/git/Sakura_bot/taiko/plugins/utils/update_user.py:23) — `def getUserData`
- [A:taiko/plugins/utils/userdata_storage.py:88](/home/sigaer/git/Sakura_bot/taiko/plugins/utils/userdata_storage.py:88) — `def save_userdata`
- [A:taiko/plugins/utils/hiroba/sync.py:256](/home/sigaer/git/Sakura_bot/taiko/plugins/utils/hiroba/sync.py:256) — `def sync_hiroba_userdata`

### E06

仓库与运行树 dispatcher 分叉。

- [A:taiko/scripts/sync_dispatch_server.py:228](/home/sigaer/git/Sakura_bot/taiko/scripts/sync_dispatch_server.py:228) — `def read_local_userdata`
- [A:taiko/scripts/sync_dispatch_server.py:326](/home/sigaer/git/Sakura_bot/taiko/scripts/sync_dispatch_server.py:326) — `def dispatch_to_target`
- [R:scripts/sync_dispatch_server.py:269](/home/sigaer/taiko/scripts/sync_dispatch_server.py:269) — `def refresh_userdata_from_wahlap`
- [R:scripts/sync_dispatch_server.py:574](/home/sigaer/taiko/scripts/sync_dispatch_server.py:574) — `refresh_userdata_from_wahlap(userid)`
- [V:taiko_viewer/server/internal/account/sync.ts:117](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/internal/account/sync.ts:117) — `export const requestSyncDispatch`

### E07

Viewer Python 计算和图表桥。

- [V:taiko_viewer/server/services/account/personal.ts:22](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/services/account/personal.ts:22) — `export const runPythonJson`
- [V:taiko_viewer/server/services/account/personal.ts:36](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/services/account/personal.ts:36) — `export const runGrowthPythonJson`
- [V:taiko_viewer/server/services/account/charts.ts:116](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/services/account/charts.ts:116) — `from plugins.utils.b30_render`
- [V:taiko_viewer/server/services/account/progress.ts:40](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/services/account/progress.ts:40) — `const runPython`

### E08

Viewer JSON/公共数据来源。

- [V:taiko_viewer/server/services/content/runtime.ts:11](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/services/content/runtime.ts:11) — `export const getContentRuntimePaths`
- [V:taiko_viewer/server/utils/taiko-open.ts:39](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/utils/taiko-open.ts:39) — `const DATASET_PATH_RESOLVERS`
- [V:taiko_viewer/nuxt.config.ts:142](/home/sigaer/taiko/taiko-forum/taiko_viewer/nuxt.config.ts:142) — `v2ConstantsUrl:`

### E09

Web 身份与 schema。

- [V:taiko_viewer/server/utils/account-db.ts:56](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/utils/account-db.ts:56) — `CREATE TABLE IF NOT EXISTS web_user_accounts`
- [V:taiko_viewer/server/utils/account-db.ts:101](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/utils/account-db.ts:101) — `CREATE TABLE IF NOT EXISTS web_taiko_bindings`
- [V:taiko_viewer/server/utils/account/auth.ts:271](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/utils/account/auth.ts:271) — `export const requireAccountUser`

### E10

Web/Bot binding 边界。

- [V:taiko_viewer/server/utils/account/bindings.ts:32](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/utils/account/bindings.ts:32) — `export const startBindingVerification`
- [V:taiko_viewer/server/utils/taiko-center.ts:107](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/utils/taiko-center.ts:107) — `const listBotBindRows`
- [A:taiko/taiko_runtime/platform_adapter.py:12](/home/sigaer/git/Sakura_bot/taiko/taiko_runtime/platform_adapter.py:12) — `ONEBOT_V11_PLATFORM`

### E11

手动账号与 service token。

- [V:taiko_viewer/server/utils/account/manual.ts:90](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/utils/account/manual.ts:90) — `const createManualTaikoId`
- [V:taiko_viewer/server/utils/account/manual.ts:574](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/utils/account/manual.ts:574) — `export const requireBotService`
- [V:taiko_viewer/server/api/taiko/internal/manual.post.ts:18](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/api/taiko/internal/manual.post.ts:18) — `requireBotService(event)`

### E12

Developer token 发行与验证。

- [V:taiko_viewer/server/internal/account/developer.ts:131](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/internal/account/developer.ts:131) — `export const generateDeveloperToken`
- [V:taiko_viewer/server/internal/account/developer.ts:318](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/internal/account/developer.ts:318) — `export const getDeveloperTokenRowByHash`
- [V:taiko_viewer/server/utils/account/developer.ts:183](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/utils/account/developer.ts:183) — `export const reviewDeveloperApplication`
- [V:taiko_viewer/server/utils/account-db.ts:247](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/utils/account-db.ts:247) — `CREATE TABLE IF NOT EXISTS web_developer_tokens`

### E13

Hiroba score parser/normalizer。

- [A:taiko/plugins/utils/hiroba/normalize.py:22](/home/sigaer/git/Sakura_bot/taiko/plugins/utils/hiroba/normalize.py:22) — `def score_detail_to_userdata_record`
- [A:taiko/plugins/utils/hiroba/parser.py:189](/home/sigaer/git/Sakura_bot/taiko/plugins/utils/hiroba/parser.py:189) — `def parse_score_list_page`
- [B:plugins/utils/hiroba/normalize.py:22](/home/sigaer/taiko-bot/plugins/utils/hiroba/normalize.py:22) — `def score_detail_to_userdata_record`
- [B:plugins/utils/hiroba/parser.py:175](/home/sigaer/taiko-bot/plugins/utils/hiroba/parser.py:175) — `def parse_score_list_page`

### E14

TS 成绩编辑/导入/重建。

- [V:taiko_viewer/server/internal/account/shared.ts:701](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/internal/account/shared.ts:701) — `export const rebuildUserdataAchievement`
- [V:taiko_viewer/server/utils/account/songs.ts:223](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/utils/account/songs.ts:223) — `writeUserdataWithHistory(`
- [V:taiko_viewer/server/internal/account/kinoko-import.ts:9](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/internal/account/kinoko-import.ts:9) — `high_score`

### E15

C/H 发布和锁。

- [V:taiko_viewer/server/internal/account/shared.ts:682](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/internal/account/shared.ts:682) — `const userdataWriteQueues`
- [V:taiko_viewer/server/internal/account/shared.ts:722](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/internal/account/shared.ts:722) — `export const writeUserdataWithHistory`
- [A:taiko/plugins/utils/userdata_storage.py:247](/home/sigaer/git/Sakura_bot/taiko/plugins/utils/userdata_storage.py:247) — `with open(save_path, "w"`
- [A:taiko/plugins/utils/userdata_storage.py:18](/home/sigaer/git/Sakura_bot/taiko/plugins/utils/userdata_storage.py:18) — `def _load_locked_song_keys`

### E16

持久 daily ability。

- [A:taiko/plugins/utils/daily_ability.py:31](/home/sigaer/git/Sakura_bot/taiko/plugins/utils/daily_ability.py:31) — `def archive(`
- [A:taiko/plugins/utils/daily_ability.py:77](/home/sigaer/git/Sakura_bot/taiko/plugins/utils/daily_ability.py:77) — `def store_measurement`
- [A:taiko/plugins/utils/daily_ability.py:90](/home/sigaer/git/Sakura_bot/taiko/plugins/utils/daily_ability.py:90) — `def capture_snapshot`

### E17

SQL measurement 与 archive 合并。

- [V:taiko_viewer/server/services/growth-history/measurements.ts:21](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/services/growth-history/measurements.ts:21) — `export async function upsertGrowthMeasurement`
- [V:taiko_viewer/server/services/growth-history/daily-archive.ts:11](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/services/growth-history/daily-archive.ts:11) — `export async function readDailyAbilityArchive`
- [V:taiko_viewer/server/services/growth-history/daily-archive.ts:38](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/services/growth-history/daily-archive.ts:38) — `export function mergeDailyAbilityMeasurements`

### E18

Goal provenance 与 Recent 证据。

- [V:taiko_viewer/server/services/goals/provenance.ts:36](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/services/goals/provenance.ts:36) — `schema_version`
- [V:taiko_viewer/server/services/goals/snapshot.ts:5](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/services/goals/snapshot.ts:5) — `export async function readGoalSnapshot`
- [V:taiko_viewer/server/services/growth-history/evidence.ts:63](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/services/growth-history/evidence.ts:63) — `const exclusionFor`
- [V:taiko_viewer/server/services/growth-recent/store.ts:49](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/services/growth-recent/store.ts:49) — `export async function writeRecentCursor`

### E19

Viewer Growth 产品状态与读取时测量。

- [V:taiko_viewer/server/services/account/growth.ts:34](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/services/account/growth.ts:34) — `export const getPlayerGrowthOverview`
- [V:taiko_viewer/utils/playerGrowth.ts:64](/home/sigaer/taiko/taiko-forum/taiko_viewer/utils/playerGrowth.ts:64) — `buildPlayerGrowthState`
- [V:taiko_viewer/composables/usePlayerGrowth.ts:9](/home/sigaer/taiko/taiko-forum/taiko_viewer/composables/usePlayerGrowth.ts:9) — `export const usePlayerGrowth`

### E20

历史 replay/fact/Passport。

- [V:taiko_viewer/server/services/growth-history/service.ts:27](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/services/growth-history/service.ts:27) — `export async function getGrowthHistory`
- [V:taiko_viewer/utils/dailyProgress.ts:37](/home/sigaer/taiko/taiko-forum/taiko_viewer/utils/dailyProgress.ts:37) — `deriveProgressForRange`
- [V:taiko_viewer/utils/growthHistory.ts:14](/home/sigaer/taiko/taiko-forum/taiko_viewer/utils/growthHistory.ts:14) — `export function projectScoreFacts`
- [V:taiko_viewer/server/services/growth-passport/service.ts:9](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/services/growth-passport/service.ts:9) — `mergeDailyAbilityMeasurements`

### E21

中心 v1 rating/六维。

- [A:taiko/plugins/utils/score_calculator.py:291](/home/sigaer/git/Sakura_bot/taiko/plugins/utils/score_calculator.py:291) — `def calc_accuracy`
- [A:taiko/plugins/utils/score_calculator.py:403](/home/sigaer/git/Sakura_bot/taiko/plugins/utils/score_calculator.py:403) — `def compute_P`
- [A:taiko/plugins/utils/score_calculator.py:521](/home/sigaer/git/Sakura_bot/taiko/plugins/utils/score_calculator.py:521) — `def compute_six_dims`
- [A:taiko/plugins/utils/score_calculator.py:897](/home/sigaer/git/Sakura_bot/taiko/plugins/utils/score_calculator.py:897) — `def aggregate_topN_value`

### E22

taiko-bot v1 副本。

- [B:plugins/utils/score_calculator.py:386](/home/sigaer/taiko-bot/plugins/utils/score_calculator.py:386) — `def calc_accuracy`
- [B:plugins/utils/score_calculator.py:616](/home/sigaer/taiko-bot/plugins/utils/score_calculator.py:616) — `def compute_six_dims`
- [B:plugins/utils/score_calculator.py:998](/home/sigaer/taiko-bot/plugins/utils/score_calculator.py:998) — `def aggregate_topN_value`

### E23

v2 算法与模型输入。

- [A:taiko/plugins/utils/taikob_v2.py:161](/home/sigaer/git/Sakura_bot/taiko/plugins/utils/taikob_v2.py:161) — `def _calc_accuracy_rating`
- [B:plugins/utils/taikob_v2.py:172](/home/sigaer/taiko-bot/plugins/utils/taikob_v2.py:172) — `def _calc_ln_rating`
- [A:taiko/plugins/utils/taikob_v2_data.py:19](/home/sigaer/git/Sakura_bot/taiko/plugins/utils/taikob_v2_data.py:19) — `V2_DATASET_URL`
- [B:plugins/utils/taikob_v2.py:18](/home/sigaer/taiko-bot/plugins/utils/taikob_v2.py:18) — `V2_CONSTANTS_CSV`

### E24

普通推荐过滤差异。

- [A:taiko/plugins/utils/score_calculator.py:2449](/home/sigaer/git/Sakura_bot/taiko/plugins/utils/score_calculator.py:2449) — `def recommend_songs`
- [B:plugins/utils/score_calculator.py:2588](/home/sigaer/taiko-bot/plugins/utils/score_calculator.py:2588) — `def recommend_songs`

### E25

目标推荐与投影。

- [A:taiko/plugins/utils/target_recommend.py:550](/home/sigaer/git/Sakura_bot/taiko/plugins/utils/target_recommend.py:550) — `def _build_score_history_profile`
- [A:taiko/plugins/utils/target_recommend.py:1863](/home/sigaer/git/Sakura_bot/taiko/plugins/utils/target_recommend.py:1863) — `def compute_target_recommendations_for_user`
- [B:plugins/utils/target_recommend.py:421](/home/sigaer/taiko-bot/plugins/utils/target_recommend.py:421) — `def _profile_match_score`
- [B:plugins/utils/target_recommend.py:516](/home/sigaer/taiko-bot/plugins/utils/target_recommend.py:516) — `def compute_target_recommendations_for_user`
- [A:taiko/plugins/utils/recommendation_intelligence.py:1](/home/sigaer/git/Sakura_bot/taiko/plugins/utils/recommendation_intelligence.py:1) — `import`

### E26

TJA 分析/连打/曲目匹配。

- [A:taiko/tjaAnalyzer.py:13](/home/sigaer/git/Sakura_bot/taiko/tjaAnalyzer.py:13) — `DEFAULT_SONG_DIR`
- [A:taiko/plugins/utils/tja_roll_parser.py:28](/home/sigaer/git/Sakura_bot/taiko/plugins/utils/tja_roll_parser.py:28) — `_COURSE_KEY`
- [A:taiko/plugins/utils/merge_index.py:81](/home/sigaer/git/Sakura_bot/taiko/plugins/utils/merge_index.py:81) — `from tjaAnalyzer`
- [A:taiko/plugins/utils/song_update_task.py:82](/home/sigaer/git/Sakura_bot/taiko/plugins/utils/song_update_task.py:82) — `SONG_DATA_PATH`

### E27

Viewer TJA 委托/统计消费。

- [V:taiko_viewer/server/services/content/songTjaBundleIndex.py:6](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/services/content/songTjaBundleIndex.py:6) — `importlib`
- [V:taiko_viewer/server/services/tools/noteCount.ts:33](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/services/tools/noteCount.ts:33) — `tja_note_counts.json`

### E28

compute-only 动态桥。

- [A:taiko/growth_compute/__main__.py:17](/home/sigaer/git/Sakura_bot/taiko/growth_compute/__main__.py:17) — `def _load_source`
- [R:growth_compute/__main__.py:99](/home/sigaer/taiko/growth_compute/__main__.py:99) — `def compute_growth`

### E29

Taiko 目录外凭据入口。

- [A:miku_bot/sekai/upload/server.py:921](/home/sigaer/git/Sakura_bot/miku_bot/sekai/upload/server.py:921) — `@app.route("/uploadTaikoLogin"`
- [A:miku_bot/sekai/upload/server.py:127](/home/sigaer/git/Sakura_bot/miku_bot/sekai/upload/server.py:127) — `def _guard_service_routes`
- [A:miku_bot/sekai/upload/taiko_login.py:31](/home/sigaer/git/Sakura_bot/miku_bot/sekai/upload/taiko_login.py:31) — `def validate_taiko_token`
- [A:miku_bot/sekai/upload/taiko_login.py:54](/home/sigaer/git/Sakura_bot/miku_bot/sekai/upload/taiko_login.py:54) — `def update_taiko_config`

### E30

关联 Java 内容后端与身份。

- [A:taiko_backend/pom.xml:30](/home/sigaer/git/Sakura_bot/taiko_backend/pom.xml:30) — `<java.version>`
- [A:taiko_backend/src/main/java/com/hyperionml/controller/TaikoController.java:16](/home/sigaer/git/Sakura_bot/taiko_backend/src/main/java/com/hyperionml/controller/TaikoController.java:16) — `@RequestMapping`
- [A:taiko_backend/src/main/java/com/hyperionml/config/TaikoConfig.java:16](/home/sigaer/git/Sakura_bot/taiko_backend/src/main/java/com/hyperionml/config/TaikoConfig.java:16) — `addInterceptors`
- [A:taiko_backend/src/main/java/com/hyperionml/mapper/UserMapper.java:17](/home/sigaer/git/Sakura_bot/taiko_backend/src/main/java/com/hyperionml/mapper/UserMapper.java:17) — `@Select`
- [A:taiko_backend/src/main/resources/com/hyperionml/mapper/TaikoMapper.xml:104](/home/sigaer/git/Sakura_bot/taiko_backend/src/main/resources/com/hyperionml/mapper/TaikoMapper.xml:104) — `from tb_musicdifficulty`

### E31

中心代理的读写链。

- [V:taiko_viewer/server/utils/taiko-center.ts:137](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/utils/taiko-center.ts:137) — `const ensureSingleCurrentBotBind`
- [V:taiko_viewer/server/utils/taiko-center.ts:197](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/utils/taiko-center.ts:197) — `const upsertBotBindRecord`
- [V:taiko_viewer/server/utils/taiko-center.ts:458](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/utils/taiko-center.ts:458) — `export const proxyTaikoCenterHirobaSync`
- [V:taiko_viewer/server/api/taiko/proxy/bind.post.ts:6](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/api/taiko/proxy/bind.post.ts:6) — `enforceTaikoOpenQuota(event`

### E32

Viewer v2 上游/补充/导出。

- [V:taiko_viewer/server/services/content/v2Constants.ts:10](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/services/content/v2Constants.ts:10) — `consoleSupplement`
- [V:taiko_viewer/server/services/content/v2ConstantsModel.ts:81](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/services/content/v2ConstantsModel.ts:81) — `buildV2ConstantsRows`
- [V:taiko_viewer/server/utils/taiko-open.ts:136](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/utils/taiko-open.ts:136) — `export const resolveTaikoV2ConstantsDataset`

### E33

quota 不是 owner grant。

- [V:taiko_viewer/server/utils/taiko-open.ts:166](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/utils/taiko-open.ts:166) — `const resolveDeveloperQuotaToken`
- [V:taiko_viewer/server/utils/taiko-open.ts:186](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/utils/taiko-open.ts:186) — `export const enforceTaikoOpenQuota`
- [V:taiko_viewer/server/utils/account/developer.ts:287](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/utils/account/developer.ts:287) — `export const getDeveloperUserdataByUserid`

### E34

Forum guards / cache middleware。

- [V:taiko_viewer/server/utils/forum/threads.ts:413](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/utils/forum/threads.ts:413) — `export const createForumThread =`
- [V:taiko_viewer/server/internal/forum/shared.ts:442](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/internal/forum/shared.ts:442) — `SELECT * FROM forum_user_profiles`
- [V:taiko_viewer/server/middleware/private-cache.ts:3](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/middleware/private-cache.ts:3) — `const PRIVATE_PREFIXES`

### E35

中心公开 API 与 Cookie Writer。

- [A:taiko/server.py:21](/home/sigaer/git/Sakura_bot/taiko/server.py:21) — `TOKEN_API_PATH`
- [A:taiko/server.py:201](/home/sigaer/git/Sakura_bot/taiko/server.py:201) — `def do_POST`
- [A:taiko/deploy/taiko-public-api.service:8](/home/sigaer/git/Sakura_bot/taiko/deploy/taiko-public-api.service:8) — `ExecStart`

### E36

public score token 不同发行域。

- [A:taiko/plugins/utils/public_score_token.py:160](/home/sigaer/git/Sakura_bot/taiko/plugins/utils/public_score_token.py:160) — `def issue_public_score_token_for_taiko_id`
- [A:taiko/plugins/utils/public_score_token.py:358](/home/sigaer/git/Sakura_bot/taiko/plugins/utils/public_score_token.py:358) — `def fetch_latest_userdata_by_token`
- [B:plugins/utils/public_score_token.py:49](/home/sigaer/taiko-bot/plugins/utils/public_score_token.py:49) — `def issue_public_score_token_for_taiko_id`
- [V:taiko_viewer/server/utils/account/score-token.ts:8](/home/sigaer/taiko/taiko-forum/taiko_viewer/server/utils/account/score-token.ts:8) — `requireAccountUser(event)`

