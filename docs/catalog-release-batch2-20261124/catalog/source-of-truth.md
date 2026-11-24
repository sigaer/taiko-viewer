# Catalog Source of Truth Matrix — 2026-11-24

状态：只读调查与目标设计；没有启用新 Authority 或迁移消费者。来源证据见 `source-audit.json`（每文件 SHA-256、长度、mtime、结构与读取稳定性）、`song-chart-identity-map.json`、`consumer-inventory.json`（494 个源码引用）。QA `qa-f6a0473a4f7c`。源为 Viewer `26930740`、Bot `62c4d3e`，不是生产在线 API 刷新。

| 来源 | 已验证用途 / 字段权威边界 | 不具备的权威 | 生成与调用链 |
|---|---|---|---|
| Wahlap `/api/user/all/songs` 的最近成功采集 | 国行来源的歌曲 ID、目录出现、难度、当时上架状态 | 其他地区、主机、原始谱面解析；本批没有重取网络响应 | Bot `taiko_bot/offline/song_update_task.py:update_taiko_music`，2460 起；请求→响应校验→canonical ID→位置采集→去重→保留旧条目→raw/merged |
| `song_data_raw.json`，2993 首 | 保留 Wahlap 本次字段与历史条目；与 merged 交集是候选修复的国行门槛 | **不是未加工完整原始响应**：保留旧历史/补充条目，不能单独证明最新上架或全部字段正确 | 同上 2470–2512；`raw` 名称不代表全字段权威；原始响应未保存且缺整批来源清单 |
| `song_data.json`，2993 首 | 当前集成目录；显示标题/分类，`legacy_ids` 显式身份迁移，OurTaiko 关联 | 任意正难度不证明国行可玩；roll 元数据不证明原 TJA 语义完整 | `sync_song_data_with_taiko_database` 合并 Wiki→`ourtaiko_catalog`→`catalog_resources`→reconcile；国行优先保持 Wahlap 来源 |
| `taiko_song_database.json` | Wiki 的平台、版本、作者、补充难度信息 | CN 当前上架；缺失字段不能默认不存在 | `song_update_task.py:sync_song_data_with_taiko_database`；正难度可受 raw 限制及 score-confirmed 例外影响 |
| `ourtaiko_charts.json`，2990 条 | OurTaiko source ID、`nijiiroId`/`officialId`、平台、difficulty 和资源登记 | 不等于 ESE 每份文件；`hasFiles` 不证明文件可读/匹配/解析正确；不决定 CN 上架 | `ourtaiko_catalog.py:fetch_charts` 验证全量与分页并集、去重；`merge_catalog` 按来源ID而非标题合并，`nijiiroId` 与 `mainland_ids` 决定 CN 派生状态 |
| ESE 原始 TJA，2990 个文件 | 采样时实际内容、COURSE、音符/命令原文、文件 hash | 正式商业发布身份、当前区域可玩、绝对音频对齐 | `/home/sigaer/git/ESE_autosync`；本批逐文件扫描，SHA 见 timeline index |
| `assets/catalog_sources`，13 个补充 TJA | 补充资源原文及 hash | 不可当作 ESE 原始文件或自动当作官方谱面 | `catalog_resources.py` 补充资源路径；ESE + 此目录 = 本批 3003 份语料 |
| `song_id2tjapath.json`，2979 映射 | song ID→候选资源路径 | 路径本身不证明 COURSE、原谱一致性、区域/发布或 parser 完整性 | `song_tja_mapping.py`、OurTaiko enrich/reconcile；有文件与有映射分别统计 |
| `rating_structured_with_ids.json` | 既有算法的特征/常数/评分输入，`songs` 复合键 | 曲库全集、可玩性、原始音符事实；不能用 rating 有行替代 raw 难度 | `load_rating_config`→Core score/calculation→ordinary/target |
| `catalog_constants.json` / `constants_id_v2.csv` | 带模型语境的 V2 常数与补充计算来源 | 不能倒推 chart existence；不同算法字段不混用 | `catalog_constants.py:fill_constants`；Analyzer 输出是派生值 |
| `taiko_goku_onis.json`，5255 条 | Scoreline / 极分、天井/连打计算输入及 match_source | CN 可玩、歌曲去重权威、原谱确实可解析；条目可跨难度/版本 | `score_line`→`rebuild_scoreline_dataset`；Bot scoreline query / Viewer scoreline consumers |
| `song_score.json`, `song_difficulty.json`, `tja_note_counts.json` | 各自既有曲目得分/难度/音符数缓存 | 不覆盖身份、区域或源文件；note count 受分支口径影响 | writer 与 source hash 缺失时仅作为线索，不能提升为权威 |
| `song_alias.json`（2098）/`song_alias_new.json`（1162）/`alias.xlsx` | 搜索别称；`legacy_ids` 才是已声明身份迁移 | 搜索名称相同不证明同歌/同谱；别名表不重写历史成绩 | 别名与 identity consumer 分列在 inventory；现有多份 alias 状态须迁移到 builder 的输入登记，不新增长期双配置 |
| `music_donda_list*`、各代 dojo、分析索引、title relations | 社区难度经验、段位/称号关联、搜索派生索引 | 不决定发行区域、谱面真伪或当前可玩；社区等级不是官方星级 | 独立 source namespace、版本与证据等级 |
| `region_map.json` | 中国地理名映射（37 项） | **不是曲目地区可用性表** | 街机位置/地理显示；不能用它补 JP/TW/HK 曲目状态 |
| `twso_data.json` 等排名数据 | 外部成绩排名观察 | 排名中出现不证明当下区域目录或 raw TJA | 仅做来源审计；没有复制真实玩家行到报告 |

当前 raw 与 merged 都有 shelf0=1128、shelf1=329、shelf2=1536；这表示两表的同一派生状态分布，**不是两次独立来源交叉验证**。正难度口径存在 7 个 merged/raw chart 差异，详见 `difficultyConflicts`。严格候选规则得到全 COURSE 4771、鬼/里 1387 个 CN chart key；这不是全曲库谱面总数。merged/raw 任一正难度并集为 12052。

## Song / Chart Identity Map

机器清单保留每首 ID、legacy IDs、Wiki songNo、来源身份字段、每个 COURSE 的 merged/raw 正值和 CN 候选状态。当前未检测到一旧 ID 指向多首的冲突；其他来源 ID 碰撞还需按下述 namespace 契约构建阻断校验，不能仅凭该结果认为全部来源身份已证明。

`song_data.id` 是本系统目录键；小于100000的一般为 Nijiiro/Wahlap 数字命名空间，100000+ 为本地分配补充键（不要把数字范围本身当资格策略）。`ourtaiko_ids`、`official_id`、`wiki_song_nos` 必须带来源保存。相同标题、不同 source ID、同 ID 的不同版本谱面都不能直接 collapse。COURSE 1..5 表示简单/普通/困难/鬼/里；`edit`、`ura` 是来源别名；不能把 COURSE 字符串、星级和内部 level 混作同一维度。

历史成绩保持原 payload / song_no / difficulty。只读关联产生 `(originalSourceIdentity, originalCourse, catalogSongId, catalogChartId, associationEvidence, catalogRevision)`，未能关联时保留 orphan 历史卡片；不会将当前推荐输出 ID 替换成旧历史 alias。

## Region Availability Source Map / Release Semantics

| 范围 | 已验证来源 | 目标状态 / 不确定边界 |
|---|---|---|
| CN | 最近成功 Wahlap 采集，经 importer 保留与规范化 | 当前 shelf0/1/2 是派生编码；缺采集时间、失败时保留旧数据，必须暴露 stale/unknown |
| JP / 其他虹版地区 | Wiki/OurTaiko 的 platform/version/official association | 有身份/版本不是该地区当日已开放，未逐地区验证，不默认 available |
| 主机 / 历史版本 | OurTaiko/Wiki 版本归属 | RELEASED / RETIRED / UNKNOWN 必须注明 platform/release 和有效时间，不反向赋 CN |
| ESE / 补充 TJA | 文件可读性与内容hash | raw_fumen.available；与 release status 正交 |

现有 `shelf_status=0` = 本地定义“国行上架”，1 = 国行下架/保留历史，2 = 其他平台/补充目录。不能把2标为“所有地区未发布”，也不能以“非1”判 CN 可玩。目标不沿用一个全局 shelf 字段：每个 region/platform/release/时间有 RELEASED、RETIRED、ANNOUNCED、UNKNOWN，缺失视 UNKNOWN；物理谱面为 PRESENT/ABSENT/UNKNOWN；原始资源为 AVAILABLE/MISSING/UNREADABLE/MISMATCH；parser 状态独立。

## 审计限制

这是现存文件与当前源码的只读审计，未发起 Wahlap/OurTaiko 刷新，未将当日未保存网络响应或旧生产制品视为已验证事实。源文件逐个稳定不证明多个文件在同一个发布事务中生成：缺一个共同 source revision 正是需要 Catalog Authority 的原因。所有未知项进入 builder 的 conflict/release gate，不能靠补默认值消失。

补充身份/资源审计（`alias-audit-summary.json`）：2990个OurTaiko source ID均有当前集成目录关联，尚不等于逐谱面同一性已证明；558个规范化搜索别名对应多首歌，不能作为identity合并依据。按实际`catalog_resource_root + tja_path`分别解析ESE与OurTaiko根，2987首有可读raw资源，6首缺路径或缺文件；其中3个既有mapping路径失效。13首明确使用OurTaiko资源根，不能把所有相对路径都拼接到ESE。歌曲数、TJA文件数和COURSE数不是一一对应。
