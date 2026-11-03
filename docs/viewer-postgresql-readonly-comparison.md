# Viewer / PostgreSQL 只读对照

2026-10-23 实测。此工作只增加独立命令行对照工具；Viewer 的接口、页面和数据源配置保持原状。

## 运行

从仓库根目录运行，输出目录须为尚不存在的 `/var/tmp` 子目录：

```bash
bash scripts/memory/run_qa.sh /usr/bin/python3 -B \
  taiko_viewer/scripts/audit_postgres_catalog.py \
  --output-dir /var/tmp/taiko-viewer-pg-audit-new
```

默认读取运行中的 `taiko-viewer.service` 的公开曲库路径配置，定位 `song_data.json`。
指定 `--song-data /absolute/path/song_data.json` 可对照另一份明确的公开曲库。
比较前后校验 JSON SHA-256；发生变更则失败，避免报告混用不同版本。

PostgreSQL 通过既有容器 `ourtaiko-database-postgres` 内的 `psql` 查询，数据库为 `ourtaiko_database`。
不安装依赖、不新增秘密配置，密码不进入命令行或报告。
容器既有登录会话在固定 SQL 中 `SET LOCAL ROLE ourtaiko_database_viewer`；
查询采用 `REPEATABLE READ READ ONLY` 事务，检查有效角色不是 superuser，
且三张曲库表具有 SELECT、没有 INSERT/UPDATE/DELETE/TRUNCATE 权限。
这是一次离线对照连接，不是 Viewer 常驻连接，也没有创建 Web 调试接口。

查询仅涉及曲库、难度、资源元数据及必要的角色/列定义；不读取用户、会话或个人成绩。
单条语句最多 10 秒，子进程最多 35 秒；最多 20,000 条曲目、100,000 条难度，
输入和输出均有 32 MiB 上限。超限拒绝输出部分对照结论。

## 对照口径

- 仅以 Viewer `id` = PG `nijiiro_id` 的唯一关联作为正式匹配，禁止使用 PG 内部主键替代。
- 未匹配记录可通过中日文/其他译名发现同名候选，候选不自动关联或写回。
- 对照单人 `single` 谱面，双人 `p1/p2` 单独排除；星级 0、空白、`-` 视为无谱面。
- 名称按 NFKC、大小写、空白标准化；简繁体、版本后缀等差异保留人工核对。
- BPM 只直接比较标量；范围 BPM 记为不可直接比较，不强行转换。
- 分类按已有 category_flags 位定义核对；版本或地区差异未被判定为某一侧数据错误。
- 资源只核对外键引用与资源记录，未下载或验证真实对象文件。

## 本次结果

最终快照：`/home/sigaer/taiko/songs/song_data.json`，共 1,500 首；
SHA-256：`c8087758b328c68a5538273124d13054035d83311cf22e1a7c22feee49cafc10`。

| 范围 | Viewer 数量 | 按 ID 未匹配 |
|---|---:|---:|
| 常规在架 | 1,127 | 3 |
| 未实装/已下架 | 227 | 13 |
| 其他歌曲 | 146 | 146 |
| 总计 | 1,500 | 162 |

PG 有 2,973 条曲目、12,704 条难度，1,367 条曲目有虹版 ID。
共 1,338 首按 ID 唯一匹配；PG 另有 29 个虹版 ID 未出现在 Viewer。
162 首未匹配中，147 首有同名候选，其中 5 首有多个候选、15 首的候选包含已分配其他虹版 ID 的记录，不能直接补 ID。

常规在架未匹配：

- `1429 / Emma`：PG 同名候选的虹版 ID 是 `1032`，需核对不同版本/编号含义。
- `1500 / LUMINΔ`：严格标准化后未发现同名候选。
- `1501 / 技神暗鬼 / 技神闇鬼`：严格标准化后未发现同名候选。

已匹配范围内：

| 差异 | 数量 |
|---|---:|
| 星级不同 | 56 个单人难度，涉及 36 首曲目 |
| Viewer 有、PG 缺少的单人难度 | 18 个，涉及 8 首 |
| PG 有、Viewer 缺少的单人难度 | 10 个 |
| 分类不同 | 76 首 |
| 标量 BPM 不同 | 81 首 |
| BPM 表达无法直接对照 | 355 首 |
| 按 ID 匹配但名称仍需人工确认 | 13 首 |
| 语言对应名称不同 | 84 个字段，涉及 83 首 |

示例：`今夜はホーミー` 的简单/普通/困难/鬼星级在两边均不同；
`新時代` 的 BPM 为 JSON `175`、PG `117.96`。
这些记录证明两套元数据存在差异，尚未裁定哪一方正确。

PG 的 2,973 条曲目都有可关联的 TJA 和音频资源记录，**封面引用覆盖为 0**。
上架日期、版本、作者、音符数、上下架状态、连打和气球信息在当前 PG 曲库三表中也没有直接对应列。
现有 JSON 因而仍需要保留，不能依据曲目匹配率直接切换数据源。

本次完整明细存放在 `/var/tmp/taiko-viewer-pg-audit-20261023-final/report.json`，
可读报告为同目录 `report.md`。临时报告不纳入 Git；本文件保留结果摘要与复跑方法。

## 验证

```bash
bash scripts/memory/run_qa.sh /usr/bin/python3 -B -m unittest discover \
  -s taiko_viewer/tests -p test_postgres_catalog_audit.py -v
```

8 项单元验证通过，覆盖主键与虹版 ID 混淆、同名候选不自动关联、重复 ID、
单人与双人难度、无谱面占位、BPM 范围、只读权限/行数限制及角色参数校验。
真实只读查询和报告生成通过。未修改线上服务、数据表或任何曲库源文件。
