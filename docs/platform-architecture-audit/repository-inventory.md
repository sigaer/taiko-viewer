# Repository Inventory

审计日期：2026-10-10，Asia/Shanghai。模式：READ ONLY；只新增本目录审计文档。基线和统计方法见 [证据索引](evidence-index.md)。源码能力、磁盘运行树、实际服务状态分开记录，未把 README 当作运行证明。

| Repo | Language | Runtime | Entry | Main Responsibility |
| --- | --- | --- | --- | --- |
| Sakura_bot | Python；关联 Java/TS | Taiko 子项目 NoneBot/ASGI；Python HTTP 服务；Spring Boot 内容后端 | `taiko/bot.py` → `pyproject.toml` → `plugins/taiko.py`；`taiko/server.py`；`taiko/scripts/sync_dispatch_server.py` | 中心成绩采集与持久化、聊天命令、Rating/六维/B30/推荐、曲库生成、公开成绩 Token；仓库还包含共享运行框架、内容管理和登录凭据写入入口 |
| taiko-bot | Python | NoneBot + FastAPI/uvicorn | `bot.py`；可选 `bot_core.py`/`bot_gateway.py`；挂载 `/local-api` | 可自部署聊天客户端；中心绑定与同步代理；公共数据与成绩缓存；独立的本地计算、渲染及部分遗留解析/存储实现 |
| Viewer | TypeScript/JavaScript；Python 辅助脚本 | Nuxt 3.21.11 / Nitro；运行 Node 24.13.0；调用 Python 3.11 | Nuxt `server/api/*`、服务层；部署产物 `.output/server/index.mjs` | Web/BFF、账户和授权、Forum/UGC、Goal/Growth、成绩编辑与导入、中心代理、公共数据分发、内容聚合 |

## 仓库和运行树

| 对象 | 路径 | 扫描基线 |
| --- | --- | --- |
| A | `/home/sigaer/git/Sakura_bot` | `5ac44b36e2e170e84641adf124d77f1e998f4039` |
| B | `/home/sigaer/taiko-bot` | `46c8646847f8d642b53043b6123d8763e26c0a16` |
| C | `/home/sigaer/taiko/taiko-forum` | `8d70df213bfcbc4409654313b50951365898985a`；Viewer 0.81.10 |
| R，中心运行树 | `/home/sigaer/taiko`，不是 A 的路径别名 | Viewer 实际 `TAIKO_REPO_ROOT` 指向这里；不把它称作第四个已版本化仓库 |

未 fetch；以上是本地 HEAD，不宣称远端即时一致。A 原有 miku 内存相关修改、B 原有 `web.conf` 修改，以及 C 原有未跟踪报告/测试均未改动。没有 commit/push。

对 A/Taiko 与 R 的 **146 个同路径源码文件**比较：138 个字节一致、8 个不同。包括 `scripts/sync_dispatch_server.py` 的实质行为差异：A 的 dispatch 读取已有成绩再保存；R 先调用 `getUserData` 拉取 Wahlap 再分发。[E06](evidence-index.md#e06)、[比较清单](evidence/runtime-source-comparison.csv)。`growth_compute/__main__.py` 的文本差异主要是展开格式和额外常量，不能把全部 8 项都称作算法漂移。

## Runtime 与依赖

### Sakura_bot

- 根项目 `pyproject.toml` 的 Python `^3.7.3` 是旧根声明，**不代表当前 Taiko 可在 3.7 运行**。Taiko 子项目声明 `>=3.8,<4.0`，源码使用更高版本特性；本机中心相关进程实际 `/usr/bin/python3.11`。
- Taiko 有独立 NoneBot 入口；根 `bot.py` 的默认 plugin_dirs 是 miku/haruka/maimai，不能因单仓库就画成一个大 NoneBot 进程。
- `taiko/bot.py` 把 Sakura 根目录加到 `sys.path`，调用 `feature_handler_bootstrap`；`taiko_runtime/memory.py` 导入根级 `runtime_memory`。共享依赖超出 taiko 目录。[E01](evidence-index.md#e01)
- 存储：PyMySQL/MySQL（绑定、成绩锁、Hiroba 凭据、公开成绩 Token），`userdata/*data.json` 和历史目录，歌曲 JSON/CSV、图片/TJA、缓存、OSS。
- API：requests/httpx 的 Wahlap/Hiroba 客户端；V2 定数通过 Viewer API 拉取；手动账号命令通过 Viewer 内部服务 API。
- Token：Wahlap cookie、加密保存的 Hiroba 凭据、用户公开成绩 Token、bot service token，角色不同。
- 扫到关联的 `taiko_backend`：Java 21、Spring Boot 3.4.0、MyBatis/MySQL，管理 `tb_music/tb_musicdifficulty/tb_title`；另有 `tb_user`/JWT 管理身份。源码存在，不据此断言其当前服务地址和运行版本。[E30](evidence-index.md#e30)
- `miku_bot/sekai/upload/server.py` 的 `/uploadTaikoLogin` 可写 Taiko cookie，是 taiko 目录外的真实写入链。[E29](evidence-index.md#e29)

### taiko-bot

- Python 声明 `>=3.8,<4.0`；README 建议 3.11；依赖包括 NoneBot 2、QQ/OneBot、FastAPI、uvicorn、httpx、requests、BeautifulSoup、Pillow、NumPy/pandas/matplotlib、cryptography、redis。
- SQLite 位于默认 `storage/data/taiko.sqlite3`；`taiko_db.py` 是 SQLite 兼容封装，不是共享 MySQL 包。
- 默认成绩目录 `storage/cache/userdata`；公共数据在 `songs`、资源在 `assets`；会保存读取缓存及 u0 合并派生结果。
- `viewer_client.py` 请求 `/api/developer/userdata/*` 和 `/api/taiko/proxy/*`；Bearer 可选，配置项 `TAIKO_VIEWER_DEVELOPER_TOKEN`。手动账户另外使用 `TAIKO_BOT_SERVICE_TOKEN`。[E02](evidence-index.md#e02)、[E03](evidence-index.md#e03)
- SQLite 中仍有 bind、public_score_tokens、web_hiroba_credentials、web_song_locks 定义，不应据表名假定它们仍是中心事实权威。[E04](evidence-index.md#e04)
- 本轮进程 cwd 白名单扫描未看到 B 路径的 Python 服务。**运行实例及外部自部署实例版本 Unknown**；不能说所有 taiko-bot 已下线。

### Viewer

- `package.json` 固定 Nuxt 3.21.11，使用 mysql2、undici、Sharp、Playwright、OSS、邮件等库；没有 taiko-core 包依赖。
- 源码 `server/services` 存在；根级 `taiko_viewer/services` 未找到对应业务实现。已覆盖 `server/`、`utils/`、`composables/`、`scripts/`，并沿页面调用确认算法入口。
- 实际服务 cwd 为本仓库 `taiko_viewer`；运行 Node 路径 `/www/server/nvm/versions/node/v24.13.0/bin/node`。
- 实际 Viewer 环境白名单：repoRoot=`/home/sigaer/taiko`，userdata=`/home/sigaer/taiko/userdata`，songData/ratingStruct 分别指向该运行树 `songs`。未导出其他环境变量或秘密。
- `personal.ts` 经 child_process 调用 R 的 `plugins.utils.recommendation_intelligence` 和 `growth_compute`；图表调用 R 的 B30、Rating、推荐渲染模块。[E07](evidence-index.md#e07)
- `content/runtime.ts` 与 account/shared 直接读取 JSON；MySQL 保存账户、绑定、Forum/UGC、Goal、measurement 等；内容还有独立素材、外部 API 和持久缓存。[E08](evidence-index.md#e08)

## 本机服务证据

只读 `systemctl show/list-units`：Viewer、public-api、sync-receiver、song-update 均 active；这不等于业务探针成功。

| 服务 | MainPID（采样时） | cwd / 已确认运行时 |
| --- | --- | --- |
| taiko-viewer | 646789 | C/taiko_viewer；Node 24.13.0 |
| taiko-sync-receiver | 646803 | R；Python 3.11；进程环境声明 `127.0.0.1:3102` |
| taiko-public-api | 3263424 | R；Python 3.11 |
| taiko-song-update | 1550183 | R；Python 3.11 |

未发现足够证据将 Docker/PM2 标为这三者当前部署方式。public-api 仓库 unit 声明 `0.0.0.0:9999`，网络/防火墙实际暴露面未验证。也未证明正在运行的 Nitro 产物逐字对应源码 HEAD。

## 扫描统计与历史

| 仓库 | 静态扫描文件 | 函数/方法候选索引 |
| --- | ---: | ---: |
| A（Taiko + 调用边界） | 372 | 3,049 |
| B | 68 | 1,168 |
| C（Viewer + 运维脚本） | 740 | 2,246 |
| 合计 | **1,180** | **6,463** |

Python 为 AST 定义数，JS/TS 和 Java 为模式识别候选；不是“逐个函数已人工证明正确”。关键业务链已人工阅读。原始 [文件](evidence/files.csv)、[函数](evidence/functions.csv)、[import](evidence/imports.csv) 可复核。

Git 历史提供分叉证据：B 在 `3e32f48`（2026-07-07）同步 v2/目标推荐；A 后续经历推荐、轻量 Growth 计算拆分和 `5ac44b3`（2026-10-10）每日能力存档更新。历史说明持续维护成本，不以提交标题替代代码比较。
