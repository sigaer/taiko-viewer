# 后台工作台改版 + 活跃用户（DAU）服务器执行清单

分支 `feat/admin-dashboard-dau`，已整合 main 1.16.2，目标版本 1.17.0。按顺序执行；任一步失败即停止，不做手工兜底。
密钥只放在已有私有文件中：测试库 `taiko_viewer/.env.test.local`（被 Git 忽略），生产 `/etc/taiko-viewer.env`（服务 EnvironmentFile）。不要把任何密码写进命令、文档或日志。

占位符：`<WT>` = 服务器上的 feature worktree 绝对路径；生产仓库 = `/home/sigaer/taiko/taiko-forum`。

## A. 准备

0. （本地，仅一次）提交并推送分支。只提交 `taiko_viewer/` 下的改动，不要提交 `.claude/`、`preview/`：

```bash
git status --short
git add taiko_viewer
git commit -m "feat(admin): 后台工作台改版与活跃用户统计"
git push -u origin feat/admin-dashboard-dau
```

1. 服务器 worktree：

```bash
cd <WT>
git status --short          # 必须干净
git fetch origin
git checkout feat/admin-dashboard-dau
git merge --ff-only origin/feat/admin-dashboard-dau
git log -1 --oneline
```

2. 依赖（本分支未改 package.json 依赖；与部署脚本一致用 npm install，仅在缺 node_modules 时执行）：

```bash
cd <WT>/taiko_viewer
[ -d node_modules ] || npm install
```

3. 确认 `<WT>/taiko_viewer/.env.test.local` 存在、权限 600，含 `TAIKO_DB_HOST/PORT/USER/PASSWORD/NAME`，库名以 `_test` 结尾。

4. 定义两个查询助手（当前 shell 有效）。`roq` 只读（READ ONLY 事务，先打印实际 `SELECT DATABASE()`）；`twq` 只写测试库（实际库名不以 `_test` 结尾即拒绝，且需显式 opt-in）：

```bash
VIEWER=<WT>/taiko_viewer
NODE_BIN="$(command -v node)"
roq() {  # roq <env 文件绝对路径> "<SQL>" ...；生产前缀 ROQ_SUDO=sudo
  local envf="$1"; shift
  ( cd "$VIEWER" && ${ROQ_SUDO:-} "$NODE_BIN" --env-file="$envf" --input-type=module -e '
import mysql from "mysql2/promise";
const e=process.env;
const db=await mysql.createConnection({host:e.TAIKO_DB_HOST,port:Number(e.TAIKO_DB_PORT||3306),user:e.TAIKO_DB_USER,password:e.TAIKO_DB_PASSWORD,database:e.TAIKO_DB_NAME});
try{await db.query("START TRANSACTION READ ONLY");const [[id]]=await db.query("SELECT DATABASE() AS db");console.log("DATABASE:",id.db);
for(const sql of process.argv.slice(1))console.table((await db.query(sql))[0]);await db.query("ROLLBACK");}finally{await db.end();}' "$@" )
}
twq() {  # twq "<SQL>" ...（只用于测试库）
  ( cd "$VIEWER" && TAIKO_ALLOW_TEST_DB_MUTATION=1 "$NODE_BIN" --env-file="$VIEWER/.env.test.local" --input-type=module -e '
import mysql from "mysql2/promise";
const e=process.env;if(e.TAIKO_ALLOW_TEST_DB_MUTATION!=="1")throw Error("opt-in required");
const db=await mysql.createConnection({host:e.TAIKO_DB_HOST,port:Number(e.TAIKO_DB_PORT||3306),user:e.TAIKO_DB_USER,password:e.TAIKO_DB_PASSWORD,database:e.TAIKO_DB_NAME});
try{const [[id]]=await db.query("SELECT DATABASE() AS db");if(!String(id.db||"").endsWith("_test"))throw Error("Actual _test database required: "+id.db);console.log("DATABASE:",id.db);
for(const sql of process.argv.slice(1)){const [r]=await db.query(sql);console.log(r.affectedRows??r);}}finally{await db.end();}' "$@" )
}
TODAY="DATE(CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','+08:00'))"   # 北京自然日
```

## B. 发布前：测试库验证

`run_qa.sh` / `run_dev.sh` / `run_build.sh` 共用一把锁：B1、B2 跑完再开 B3 的开发服务器。`run_qa.sh` 会清空环境，所需变量都写在命令里。

### B1. 测试库迁移

```bash
cd <WT>
roq "$VIEWER/.env.test.local" "SHOW GRANTS"     # 实际库名须以 _test 结尾
# 只读检查：建表前预期失败（"数据服务暂不可用" = 表不存在）；若报库名/opt-in 错误则停止
bash scripts/memory/run_qa.sh /bin/bash -c 'cd taiko_viewer && node --env-file=.env.test.local --experimental-strip-types scripts/migrate_user_activity_schema.ts'
# 应用：输出 {"mode":"test","database":"..._test","action":"apply","seededRows":N,"valid":true}
bash scripts/memory/run_qa.sh /bin/bash -c 'cd taiko_viewer && TAIKO_ALLOW_TEST_DB_MUTATION=1 node --env-file=.env.test.local --experimental-strip-types scripts/migrate_user_activity_schema.ts --apply'
# 再跑一次：seededRows 必须为 0
bash scripts/memory/run_qa.sh /bin/bash -c 'cd taiko_viewer && TAIKO_ALLOW_TEST_DB_MUTATION=1 node --env-file=.env.test.local --experimental-strip-types scripts/migrate_user_activity_schema.ts --apply'
```

新表不带外键，测试库账号无需 REFERENCES 权限。

### B2. 自动化测试

```bash
cd <WT>
# 新增：自带私有 MySQL 的 SQL 集成测试（迁移守卫/种子/访问记录/账号活跃/DAU 口径/审计过滤/90 天清理）
bash scripts/memory/run_qa.sh /bin/bash -c 'cd taiko_viewer && TAIKO_ALLOW_TEST_DB_MUTATION=1 node --experimental-strip-types --test --test-concurrency=1 tests/userActivitySql.test.mjs'
# 纯逻辑
bash scripts/memory/run_qa.sh /bin/bash -c 'cd taiko_viewer && node --experimental-strip-types --test tests/visitBeacon.test.mjs tests/visitBeaconClient.test.mjs tests/userDailyActivity.test.mjs tests/adminRelativeTime.test.mjs'
# 既有访问统计 + 版本
bash scripts/memory/run_qa.sh /bin/bash -c 'cd taiko_viewer && TAIKO_ALLOW_TEST_DB_MUTATION=1 node --test --test-concurrency=1 tests/adminTraffic.test.mjs tests/adminTrafficSql.test.mjs tests/adminDashboardTime.test.mjs tests/versionProjection.test.mjs'
bash scripts/memory/run_qa.sh /bin/bash -c 'cd taiko_viewer && node scripts/verify_admin_traffic.mjs'
# 登录链路改动（getAccountUserFromEvent）相关的既有隔离回归
bash scripts/memory/run_qa.sh /bin/bash -c 'cd taiko_viewer && node scripts/test_oidc_isolated.mjs --allow-test-db-mutation'
bash scripts/memory/run_qa.sh /bin/bash -c 'cd taiko_viewer && node scripts/test_forum_isolated.mjs --allow-test-db-mutation'
```

### B3. 开发服务器 + 手工核对（测试库）

1. 前置：信标用访问统计的盐值；开发模式不跑日志采集，测试库可能没有这一行。

```bash
roq "$VIEWER/.env.test.local" "SELECT source_key, JSON_CONTAINS_PATH(state_json,'one','\$.salt') AS has_salt FROM web_admin_ingest_state WHERE source_key='viewer_access_v2'"
# 无结果时才插入合成盐值（记下：B4 要删掉）
twq "INSERT INTO web_admin_ingest_state (source_key, state_json) SELECT 'viewer_access_v2', JSON_OBJECT('salt', SHA2(CONCAT(UUID(), RAND()), 256)) FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM web_admin_ingest_state WHERE source_key='viewer_access_v2')"
```

2. 启动（另开终端，前台运行；`--dotenv` 只读测试库配置）：

```bash
cd <WT>
bash scripts/memory/run_dev.sh /usr/bin/env NUXT_TELEMETRY_DISABLED=1 "$(command -v node)" "$PWD/taiko_viewer/node_modules/@nuxt/cli/bin/nuxi.mjs" dev "$PWD/taiko_viewer" --host 127.0.0.1 --port 3208 --no-fork --dotenv "$PWD/taiko_viewer/.env.test.local"
```

本机：`ssh -L 3208:127.0.0.1:3208 <服务器>`，浏览器打开 `http://127.0.0.1:3208/`。

3. 核对（SQL 都是只读）：

| 步骤 | 操作 | 预期 |
| --- | --- | --- |
| a | 无痕窗口打开首页，不滚动不点击，保持可见 ≥5 秒 | 新增 1 行，`user_id` 为 NULL，`is_suspect=0` |
| b | 同一窗口刷新、切换几个页面 | 当天行数不变 |
| c | 用测试账号登录 | 同一行 `user_id` 变为该账号；`web_user_daily_activity` 当天有该账号 1 行 |
| d | 打开 `/admin/taiko/dashboard`（缓存 60 秒，必要时 1 分钟后刷新） | 「今日 · 活跃用户」、已登录/未登录与下方 DAU SQL 一致 |

```bash
# a / b / c
roq "$VIEWER/.env.test.local" "SELECT DATE_FORMAT(day,'%Y-%m-%d') AS day, LEFT(visitor_key,12) AS vk, LEFT(ip_key,12) AS ik, user_id, is_suspect, first_seen_at FROM web_daily_visitors WHERE day=$TODAY ORDER BY first_seen_at DESC LIMIT 10"
roq "$VIEWER/.env.test.local" "SELECT DATE_FORMAT(day,'%Y-%m-%d') AS day, user_id, first_seen_at FROM web_user_daily_activity WHERE day=$TODAY"
# d：与后台口径相同的 DAU
roq "$VIEWER/.env.test.local" "SELECT COUNT(DISTINCT ident) AS dau, COUNT(DISTINCT CASE WHEN ident LIKE 'u%' THEN ident END) AS logged_in, COUNT(DISTINCT ident)-COUNT(DISTINCT CASE WHEN ident LIKE 'u%' THEN ident END) AS anonymous FROM (SELECT CONCAT('u',user_id) AS ident FROM web_user_daily_activity WHERE day=$TODAY UNION ALL SELECT IF(user_id IS NULL, CONCAT('d',visitor_key), CONCAT('u',user_id)) FROM web_daily_visitors WHERE day=$TODAY AND is_suspect=0) AS a"
```

想重测 a：浏览器里删除 localStorage 的 `tv_visit_day`（`tv_device_id` 不变则仍是同一行）。若开发环境无法登录后台，跳过 d，改在 E 中线上核对。

### B4. 清理

```bash
# 开发服务器终端 Ctrl+C，然后确认端口已释放
ss -ltnp | grep ':3208' || echo "port free"
# 删除本次手工产生的测试数据（只在测试库）；表保留
twq "DELETE FROM web_daily_visitors" "DELETE FROM web_user_daily_activity"
# 仅当 B3-1 是你插入的盐值行
twq "DELETE FROM web_admin_ingest_state WHERE source_key='viewer_access_v2'"
```

## C. 发布

版本为 minor：1.16.2 → 1.17.0。仓库中没有首页版本兜底字符串（只有 `package.json` / `package-lock.json`）。

```bash
cd <WT>/taiko_viewer
npm version 1.17.0 --no-git-tag-version          # 同时更新 package.json 与 package-lock.json
cd <WT>
# 按惯例写 docs/releases/1.17.0.md（后台工作台改版；活跃用户 = 登录账号 + 合格访问设备去重；需显式迁移两张新表）
git add taiko_viewer/package.json taiko_viewer/package-lock.json docs/releases/1.17.0.md
git commit -m "1.17.0 后台工作台改版与活跃用户统计"
git push origin feat/admin-dashboard-dau

cd /home/sigaer/taiko/taiko-forum
git status --short                                # 必须无已跟踪改动
git fetch origin
git checkout main
git merge --ff-only origin/main
git merge --no-ff origin/feat/admin-dashboard-dau -m "1.17.0 后台工作台改版与活跃用户统计"
git log -1 --pretty=%s                            # 必须以 1.17.0 开头
bash scripts/memory/run_build.sh /bin/bash scripts/deploy_forum_web.sh "$(git log -1 --pretty=%s)"
```

`run_build.sh` 只是隔离包装，内部执行标准 `scripts/deploy_forum_web.sh`。合并冲突或 main 已出现更高版本：停止，重新确认版本后再来。部署脚本失败：停止，不手工推送、替换产物或重启。

## D. 生产迁移（部署成功后）

部署后、迁移前，写入静默失败，后台显示「—」，属预期。迁移只新建两张表并从会话表一次性回填，不改动已有表。生产库名以 `/etc/taiko-viewer.env` 的 `TAIKO_DB_NAME` 为准（下文写作 `taiko`）。

```bash
cd /home/sigaer/taiko/taiko-forum/taiko_viewer
# 只读检查：预期因缺表失败；若报 "expectation" / "identity" 错误则停止
sudo /usr/bin/env TAIKO_ACTIVITY_EXPECTED_DATABASE=taiko "$(command -v node)" --env-file=/etc/taiko-viewer.env --experimental-strip-types scripts/migrate_user_activity_schema.ts --production
# 应用：预期 {"mode":"production","database":"taiko","action":"apply","seededRows":N,"valid":true}
sudo /usr/bin/env TAIKO_ACTIVITY_EXPECTED_DATABASE=taiko TAIKO_ALLOW_ACTIVITY_PRODUCTION_MIGRATION=1 "$(command -v node)" --env-file=/etc/taiko-viewer.env --experimental-strip-types scripts/migrate_user_activity_schema.ts --production --apply
# 复查：再次 inspect 应 valid:true
sudo /usr/bin/env TAIKO_ACTIVITY_EXPECTED_DATABASE=taiko "$(command -v node)" --env-file=/etc/taiko-viewer.env --experimental-strip-types scripts/migrate_user_activity_schema.ts --production
```

只读确认：

```bash
VIEWER=/home/sigaer/taiko/taiko-forum/taiko_viewer
ROQ_SUDO=sudo roq /etc/taiko-viewer.env \
  "SELECT TABLE_NAME, CREATE_TIME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('web_user_daily_activity','web_daily_visitors')" \
  "SELECT COUNT(*) AS rows_total, MIN(day) AS first_day, MAX(day) AS last_day FROM web_user_daily_activity" \
  "SELECT COUNT(*) AS has_traffic_salt FROM web_admin_ingest_state WHERE source_key='viewer_access_v2'"
```

`has_traffic_salt` 必须为 1（线上访问统计已在运行），否则信标不会计数。

## E. 线上冒烟

1. 普通浏览器打开 `https://viewer.sakura-bot.cn/`，保持可见 5 秒；登录后再浏览账号页、论坛列表与帖子页，均正常。
2. 只读核对：

```bash
VIEWER=/home/sigaer/taiko/taiko-forum/taiko_viewer
TODAY="DATE(CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','+08:00'))"
ROQ_SUDO=sudo roq /etc/taiko-viewer.env \
  "SELECT COUNT(*) AS devices, SUM(user_id IS NOT NULL) AS linked, SUM(is_suspect) AS suspect FROM web_daily_visitors WHERE day=$TODAY" \
  "SELECT COUNT(*) AS accounts_today FROM web_user_daily_activity WHERE day=$TODAY" \
  "SELECT COUNT(DISTINCT ident) AS dau, COUNT(DISTINCT CASE WHEN ident LIKE 'u%' THEN ident END) AS logged_in FROM (SELECT CONCAT('u',user_id) AS ident FROM web_user_daily_activity WHERE day=$TODAY UNION ALL SELECT IF(user_id IS NULL, CONCAT('d',visitor_key), CONCAT('u',user_id)) FROM web_daily_visitors WHERE day=$TODAY AND is_suspect=0) AS a"
```

3. 后台 `/admin/taiko/dashboard`：「今日 · 活跃用户」从「—」变为数字（缓存 60 秒），已登录/未登录与上面 SQL 一致；14 天走势在首日之前显示为未统计；「最近操作」不出现查看类记录。
4. 无效请求不计数：`curl -s -o /dev/null -w '%{http_code}\n' -X POST https://viewer.sakura-bot.cn/api/metrics/visit -H 'content-type: application/json' --data '{}'` → `204`。
5. 日志：`sudo journalctl -u taiko-viewer --since "15 min ago" --no-pager | grep -i -E "error|metrics" | tail -n 50`。

有效信标仅在入库成功后返回 204；数据库暂时不可用返回 503，同一 IP 超过每分钟 60 次返回 429。客户端确认 204 后保存当天标记，失败在 15 秒后有限重试，每页每标记最多三次。数据库命名锁保证同 IP 并发请求仍只放行前 20 台设备；第 21 台起标疑。接口本身最多同时处理 16 个请求。

全部通过后记录 Gate PASS。

### 出问题时

- 普通缺陷：修复后按 C 正常发版（fix forward）。
- 没有环境变量开关；新增开关也要重启才生效，而重启只能走部署脚本，所以不加。
- 紧急停用（无需重启，需你确认后用常规生产 DB 管理方式执行）：写入在表不存在时静默失败、后台显示「—」，登录不受影响。
  - 停访客信标计数：`RENAME TABLE web_daily_visitors TO web_daily_visitors_paused;`
  - 停账号活跃写入：`RENAME TABLE web_user_daily_activity TO web_user_daily_activity_paused;`
  - 恢复：把表名改回。前端仍会发 204 请求，要去掉只能发版。
