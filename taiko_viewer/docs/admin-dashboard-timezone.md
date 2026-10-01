# 后台图表时区修复（0.77.1）

2026-10-02 Asia/Shanghai。只读核实：Viewer 进程/宿主机、MySQL 会话均为北京时间。viewer_access 的 bucket_start 是 UTC 无时区文本，mysql2 默认却按宿主机本地时区解码成 Date，再调用 toISOString 丢弃时区作为图表标签，累计慢 16 小时。DATE(created_at) 经相同 Date 解码后截 UTC 日期，会让注册/绑定归到前一天；上传 mtime 原先按 UTC 日期分组。Python bot 指令 rollup 存的是北京时间，不能统一给整张表加 8 小时。

修复只在后台数据入口显式处理存储约定：SQL DATE_FORMAT 返回字符串，访问 UTC 与 bot 北京时间各自解析成带时区的时间点；图表标签、上传日期和日志日桶按 Asia/Shanghai。Nginx 日志解析尊重原始偏移，小时/日桶不依赖 Node 进程 TZ。24h 汇总使用明确 UTC ISO 时间点。没有更改共享数据库池、迁移/清空历史统计、重置日志游标或修改用户数据。

验证命令（viewer 目录）：

```sh
bash ../scripts/memory/run_qa.sh /www/server/nvm/versions/node/v24.13.0/bin/node --test tests/adminDashboardTime.test.mjs
```

一项组合回归通过：Asia/Shanghai、UTC、America/Los_Angeles 下分别验证 +0800/-0700 日志相同时间点、北京时间午夜边界、UTC 存储与本地存储对齐、小时桶往返。

私有只读复核 `/var/tmp/admin-time-20261002/verify.mjs` 对实际 dashboard 模块进行依赖注入：所有 DB 操作只允许 SELECT，事务 READ ONLY；禁用日志摄取、schema 初始化和审计写入，备份/审计列表为空；上传目录只读扫描。实际 SQL 的注册日期/计数逐项核对成功。修复后末桶为 `10-02 01:00`，10 月 1/2 日新增用户分别 358/8，上传 2426/749（当时快照，后续会变化）。不将此项称为管理员鉴权或全页面浏览验证。证据 `readonly-dashboard.json` 留仓库外。

初次运行测试时工作目录多拼一层，文件未创建且测试未执行；更正路径后测试通过。生产发布结果另记。
