# Viewer 1.0 readiness — 2026-10-15

## 2026-10-16 最新续行：Runtime Integration

按新工作令完成本轮隔离实现与验证，详见 [Runtime Integration 收尾](runtime-integration-20261016.md)。两个角色精确离线重建；补齐共享 `runtime_memory` 的独立 wheel 后，新候选为各 94 个发行包。compute、Growth、Annual、merged-read 已切到统一绝对解释器与 installed `-I` 模块；保留新版身份复核与 Publication/worker 协议。

center 联合消费者、3 个图片 callsite、两个角色各 46 个代表生命周期通过；新增 merged SQL/HTTP **16 PASS**、内部服务边界 **7 PASS**。这些均为合成/隔离证据，不覆盖完整生产生命周期。

**0.82 总 Gate 仍 BLOCKED**：本轮离线复现了两处凭据控制面无调用者认证，以及删除后重现谱面的 Source-switch 历史归属失败。4 条 source CLI、其他图片/Web 路径、真实 ingress/ACL、全 Writer 与恢复/性能验收仍待完成。未进入 0.83，未改候选版本、合并、推送、部署或读取生产私有数据。以下旧记录保留其原时点与范围。

## 2026-10-16 续行：独立 SQL 配置已解决

无需用户提供测试配置：新增 `scripts/readiness/run-isolated-sql.mjs`，在 QA cgroup 内以 `--no-defaults` 初始化全新 MySQL 8.0.24 datadir，禁用数据库 TCP 监听，仅经本任务 loopback→私有 socket 代理访问。随机测试凭据自动生成到 Git 外 0600 文件；不读取生产配置、不复制生产数据。先核对实际 `@@datadir`，仅创建空 `viewer1_security_test`，再验证实际 `SELECT DATABASE()` 和 mutation opt-in 后执行测试写入。基础四表从生产 DDL 静态提取，保留其外键；其余表仍沿用现有 fixture，不能视为全量生产 migration 验收。

- `sourceAccessSql.test.mjs` + `privateSourceConditionalSql.test.mjs`：**61 PASS**。
- `sourceProxySql.test.mjs`：**31 PASS**。
- 两轮均使用全新 datadir，MySQL 与临时代理结束后关闭，cgroup OOM/OOM-kill 为 0。首次测试用户协议握手失败已保留；仅将隔离测试用户改为 `mysql_native_password` 后通过，未修改生产认证配置。
- Source proxy 测试运行真实 Node 服务及 Python/SQL 协议，但上游 HTTP/catalog 为合成替身，Python 测试程序来自 Sakura `63be19a`，不是已完成 installed worker 迁移。

证据：[isolated-sql-20261016.json](evidence/isolated-sql-20261016.json)。对应四条路由的“SQL 未复验”阻断已从 API 矩阵移除；其他路由、生产 ACL、consumer grant/audience 与完整恢复 Gate 继续未通过。

复验命令（无需自行准备数据库或密码，每次自动创建独立实例；总运行仍受原 memory wrapper 限制）：

```bash
bash scripts/memory/run_qa.sh /usr/bin/env TAIKO_PYTHON_EXECUTABLE=/var/tmp/taiko-runtime-fresh-n6qxnwr3/center/bin/python /www/server/nvm/versions/node/v24.13.0/bin/node scripts/readiness/run-isolated-sql.mjs --allow-test-db-mutation taiko_viewer/tests/sourceAccessSql.test.mjs taiko_viewer/tests/privateSourceConditionalSql.test.mjs taiko_viewer/tests/sourceProxySql.test.mjs
```

以下 2026-10-15 记录保留为历史验收时点，关于当时测试库配置缺失的描述由本节取代。

## 2026-10-16 续行：代理下载与全新角色安装通过

用户授权尝试代理并按进度调整超时后，使用 Git 外 0600 配置向下载子进程传入已有代理；没有把代理值或凭据写入命令、报告或日志。下载采用 120 秒停滞判断、每角色最多 600 秒、780 秒整体下载截止，原 QA wrapper 的 15 分钟/内存限制保持不变。目录扫描遇到 pip 删除临时目录的竞态后，修复为仅容忍 ENOENT，权限/I/O 错误继续失败；相关配置、脱敏、限时和竞态回归 **9 PASS**。

最终重试用时 **348.986 秒**：

| 全新角色环境 | Taiko / Application / Contract / Core | 完整安装 | pip check | `-I` bridge |
| --- | --- | --- | --- | --- |
| center | 0.14.1 / 0.8.0 / 0.1.0 / 0.1.1 | PASS | PASS | PASS |
| client | 0.14.1 / 0.8.0 / 0.1.0 / 0.1.2 | PASS | PASS | PASS |

两环境各 93 个发行包；本机四个 Taiko 家族构件使用精确 wheel/hash pin，第三方完整 wheel SHA-256 和已安装版本清单见 [fresh-runtime-proxy-retry-20261016.json](evidence/fresh-runtime-proxy-retry-20261016.json)。center 版本清单 hash 为 `b338ce9815481876112b2afa02069dac20759eee114ac6aaa5aee24e4d5336f5`，client 为 `92c5a13bbe670776502ebd104c185fb5052a0a261d7cb065242a8e7d109aba44`。真实模块来自各自新 venv 的 site-packages，非 editable，没有复制旧 site-packages。

早先离线缺包、240 秒直连超时、[首次代理监控竞态失败](evidence/fresh-runtime-proxy-20261016.json) 均保留。`--find-links` 不保证同版本优先本地，不能宣称重试零重复下载；本次两角色共享的新 workspace HTTP cache 不作为已验收构件，只有完成的 wheel/hash 计入证据。

完整依赖安装这一阻断已解决。**G-RUNTIME / O2 仍未整体 PASS**：center/client 的完整业务生命周期、Viewer compute/Annual/merged worker 迁移、算法/历史连续性和生产解释器配置仍待验收。测试数据库与 venv 均为独立本地资源，无生产部署或包环境变更。

本轮为 `0.82.1` 隔离候选，基于 Viewer `56aa05a`，分支
`feat/viewer-1-readiness-20261015`。**0.82 总 Gate 尚未通过，未进入 0.83 Contract Freeze。**
未合并、推送、部署、重启、访问生产 API/SQL 或读取真实业务凭据。
主工作树的文档删除、未跟踪材料、称号关系业务数据均保持原状；本轮不是发布，未搬入这些未提交变更。

实现分为两个本地提交：`03aeb43` 缓存边界修复、`22f7b0b` installed Publication bridge。Taiko/Sakura 没有新增提交；其精确 main/candidate hash 留在 runtime manifest。二者都不是发布记录。

## 实现与影响面

- `/api/taiko/proxy/*` 与 `/api/taiko/internal/*` 的响应默认 `private, no-store`。
- `privateSourceResponse` 在执行授权/读取前设置禁止缓存，403/503 等失败即使脱离 middleware 也保留该策略。成功的私有 ETag/304 仍在完成实时授权后产生。
- 显式导入 h3 helper，使实际 middleware 可由合成 HTTP 测试加载；未改变授权模型、数据库或 Publication 协议。
- Publication bridge 使用绝对路径 `TAIKO_PYTHON_EXECUTABLE`（默认 `/usr/bin/python3`），以 `-I -m taiko_store.bridge` 调用已安装模块；拒绝相对/NUL 配置，缺少安装包返回脱敏 503，不再从 cwd/PYTHONPATH 回落到源码。compute/Annual/merged-read worker 尚未迁移。本轮没有修改线上解释器配置。
- Viewer package/lock 同步为 `0.82.1`；版本从 package 投影，无硬编码 fallback 要更新。这是候选版本，不是线上版本声明。

当前 main 已包含 owner/service grant、锁内及返回前复核、current/history batch publication；主控文档中基于旧源码的描述不能直接当作当前漏洞证据。没有覆盖旧 ownership 候选：Viewer 与旧候选分叉 39/2，Sakura 分叉 3/29。详见 [runtime-closeout](runtime-closeout.md)。

## 本轮重新执行的验证

全部经 `scripts/memory/run_qa.sh` 串行准入；Node `24.13.0`。依赖复用主工作树 `node_modules`，没有声称 clean npm install 或完整 Nuxt build。没有运行 SQL 套件；没有将 mock SQL 当数据库 E2E。

| 验证 | 结果 | 范围 / 限制 |
| --- | --- | --- |
| `privateCacheBoundary.test.ts` | 3 PASS | 真实 h3 middleware/helper + 合成 loopback handler；401/403/503、授权后304、授权丢失、无 middleware、公开 manifest 不受影响；不是业务权限 SQL 验收 |
| Contract Python Golden | 5 PASS | 原有语义、严格输入拒绝、legacy roundtrip |
| Contract JS/read Golden + version projection | 9 PASS | Python/JS 共用 Golden、UTC/上海时间、现有严格 schema 未改 |
| generated bindings `--check` | PASS | 未另建 schema，也未扩大 Contract Freeze 的验收结论 |
| `publicationClient.test.ts` + `publicationScope.test.ts` | 33 PASS | 当前 Viewer bridge 对旧 Taiko 候选源码；合成磁盘/锁/提交/恢复；不是 installed wheel 路径 |
| `accountScorePublication.test.mjs` + `kinokoPublication.test.mjs` | 17 PASS | 实际账户/导入服务、合成内存 SQL adapter、真实候选 bridge；无数据库连接 |
| 上述四套 Publication 测试在最终 installed bridge 上重跑 | 52 PASS | 0.14.1 新 venv、非 editable、`-I`；新增空 venv 缺包、恶意 cwd/PYTHONPATH 与相对/NUL 配置拒绝；前面的 33+17 是迁移前基线，不累计为最终测试数 |
| `publicationLifecycle.tsconfig.json` `tsc --noEmit` | PASS | bridge 迁移后重新通过；局部类型检查，不是完整前端构建 |
| `verify_viewer1_evidence.mjs` | PASS | 最终 28 路由、38 个固定依赖 hash；不是自动传递闭包或安全授权 PASS |
| `audit-runtime.py` | inventory produced | 三仓库本地 refs、wheel/模板/hash；remote hooks/rulesets 未验证 |
| fresh center/client venv 的 `-I` bridge | 两组局部 PASS | 非 editable 0.14.1，验证安装来源、current/history 同 commit、读取对象一致和 SH 拒写；仅标准库依赖闭包 |
| fresh 完整角色离线依赖安装 / `pip check` | FAIL | 两角色缺少本地 `aiomysql>=0.2.0` wheel，完整依赖未解析；未用复制旧 site-packages 伪造 fresh |
| PyPI 第三方 wheel 补齐尝试 | FAIL / 超时 | center 在 cryptography 下载时达到 240 秒上限；client 未开始。精确本机 Taiko wheel/hash 保留，未完成安装或依赖锁，未放宽预算 |

前四组测试日志保存在本机 `/var/tmp`，SHA-256：

| 日志 | SHA-256 |
| --- | --- |
| `/var/tmp/taiko-viewer1-security-qa.log` | `4d72e598294b13251f9867339ed65a470be82fdec5e8d4cb382041134b19a65a` |
| `/var/tmp/taiko-viewer1-contract-qa.log` | `aaef4b50b4a5f4f7a54aec4c83fb10da40eb1d090005eb18f7cf923c0e660d4f` |
| `/var/tmp/taiko-viewer1-publication-qa.log` | `9a5b3173ee8037d0216895a7496f59df4238ba82e4d09615c03aec1a85de5150` |
| `/var/tmp/taiko-viewer1-account-qa.log` | `6739cb38d9951af7fb1f0b569dd840c90b76a3e95cd4a0b45f181124c7f6cb5c` |
| `/var/tmp/taiko-viewer1-installed-publication-qa.log` | `be68dc131528d985b4da92922b16753b2e1f3a5be4a071cbffcbbbc089d7665c` |
| `/var/tmp/taiko-viewer1-final-checks.log` | `d7aec6305f893f9e1b583269f86c6e78fe174062ed37519ceb914b2be1bb2182` |
| `/var/tmp/taiko-viewer1-fresh-runtime-pypi-qa.log` | `7e679220f51088a3fa082ed7c14f3146a4927fce1cb9eba4b75dbb7bf1cbc386` |

这些日志是本机证据，不是异地备份。上述套件受 wrapper 的 cgroup 内存/任务/时间限制，未额外采样峰值，不能据此给出生产性能结论。HTTP fixtures 在 finally 关闭服务和连接，无部署/开发常驻服务。

fresh 安装任务另记录自身 cgroup 与 `memory.events`（OOM/OOM-kill 为 0）；内核未提供 `memory.peak`，明确记为 UNAVAILABLE。保留两份实测：[离线安装及 bridge](evidence/fresh-runtime-20261015.json)、[网络补齐失败](evidence/fresh-runtime-pypi-20261015.json)。后者总耗时 244.248 秒包含 venv 准备，下载子进程在任务自己的进程组中终止。

## 阻断与下一工作包

| Gate | 当前状态 | 下一必要证据 |
| --- | --- | --- |
| API authorization | BLOCKED | 2026-10-16 已通过私有成绩与同步代理 92 项 SQL/HTTP 复验，测试配置阻断已解决；其余入口和生产路由/ACL 仍待验收 |
| Credential boundary | BLOCKED | Sakura upload/token、dispatcher 身份和 ACL；Wahlap 匿名 player/ranking 的公开字段界定 |
| Runtime ownership | BLOCKED | center/client 完整依赖安装已通过；仍需保留 main 后续安全/Writer 代码，统一 installed wheel 执行路径并验证各角色业务生命周期 |
| Single publication | BLOCKED | 最终 installed bridge 的 52 合成通过不覆盖全部运行 Writer；跨 Writer 故障恢复与统一激活仍待验收 |
| Contract freeze | PARTIAL | 原契约回归通过；consumer ResourceGrant/audience/consent 尚未实现，不能称 Developer API v1 可用 |
| Historical continuity | PARTIAL | 历史 Source-switch `271 PASS / 7 SKIP / 1 FAIL` 原样保留，本轮未重跑或豁免；旧报告不能当当前组合通过 |
| Restoration / 1.0 RC | BLOCKED | 12 个资源异地加密备份/权利审查、数据恢复演练、完整 E2E/灰度及生产签收 |

下一步先固定分叉后的三仓库集成组合与角色依赖，继续 compute/Annual/merged-read 的解释器和模块映射；bridge 局部通过不能代表全部已有运行环境可用。SQL 复验必须有显式 `TAIKO_ALLOW_TEST_DB_MUTATION=1` 和实际 `SELECT DATABASE()` 结果 `_test` 后缀，不能恢复匿名或源码 fallback 来制造通过。

## 复验命令

在隔离候选根目录执行，所有任务串行。`NODE` 应为绝对 Node 24 路径；本轮使用 `/www/server/nvm/versions/node/v24.13.0/bin/node`。

```bash
bash scripts/memory/run_qa.sh "$NODE" scripts/verify_viewer1_evidence.mjs
bash scripts/memory/run_qa.sh "$NODE" --experimental-strip-types --test --test-concurrency=1 taiko_viewer/tests/privateCacheBoundary.test.ts
bash scripts/memory/run_qa.sh /usr/bin/python3 packages/sakura-taiko-contract/tools/generate_bindings.py --check
bash scripts/memory/run_qa.sh /usr/bin/python3 -m unittest discover -s packages/sakura-taiko-contract/tests -v
bash scripts/memory/run_qa.sh "$NODE" --experimental-strip-types --test --test-concurrency=1 packages/sakura-taiko-contract/tests/contract.test.mjs packages/sakura-taiko-contract/tests/viewer-read.test.mjs taiko_viewer/tests/versionProjection.test.mjs
bash scripts/memory/run_qa.sh "$NODE" taiko_viewer/node_modules/typescript/bin/tsc -p taiko_viewer/tests/fixtures/publicationLifecycle.tsconfig.json --noEmit
```

Publication 测试在 `taiko_viewer/` 执行，指定已安装 0.14.1 的绝对解释器；源码候选只作为兼容 cwd，`-I` 禁止从中导入：

```bash
bash ../scripts/memory/run_qa.sh /usr/bin/env TAIKO_PYTHON_EXECUTABLE=/var/tmp/taiko-runtime-fresh-n6qxnwr3/center/bin/python TAIKO_PUBLICATION_TEST_REPO_ROOT=/var/tmp/taiko-final-ownership-20261015/taiko "$NODE" --experimental-strip-types --test --test-concurrency=1 tests/publicationClient.test.ts tests/publicationScope.test.ts tests/accountScorePublication.test.mjs tests/kinokoPublication.test.mjs
```

机器清单：[API](api-auth-matrix.json)、[ownership](ownership-map.json)、[Writer](writer-matrix.json)、[runtime manifest](runtime-release-manifest.json)。owner 签收和跨仓库联合验收仍 pending。本轮仅创建 Viewer 本地候选提交，Taiko/Sakura 未修改；不触发任何远程 hook 或部署。
