# Catalog Source of Truth Matrix

权威按字段划分。没有任何一个现有 JSON 同时拥有所有字段的最终决定权。

| 字段 / 能力 | 权威 / 输入 | 允许用途 | 不允许用途 |
|---|---|---|---|
| 当前国行歌曲目录 | 完整成功 Wahlap Song API | LISTED / NOT_IN_CURRENT_CATALOG | 失败响应判定缺失、其他曲库回退 |
| 官方难度元数据 | 同一 Wahlap Snapshot 的 level_1…5 | 操作性 offered difficulty、CN 星级展示 | 声称独立 chart release、机台授权状态 |
| 永久 Song Identity | 中央 Builder + 已审查 metadata id / legacy_ids；previous snapshot 保留永久 ID | `song:<persistent-id>`、历史旧 ID 关联 | 从同名、搜索别名直接合并身份 |
| Chart Identity | 中央 Song Identity + COURSE 1…5 | `<songId>:course:<N>`；已知存在与五个候选槽位分开 | 把 coverage 记录存在当成谱面存在 |
| Source Alias | 显式 catalog-id / wahlap / ourtaiko / taikowiki / nijiiro namespace | 来源追溯、交叉检索 | 把不同 namespace 相同字符串当同一身份 |
| 国行分类成员 / 位序 | Wahlap 决定分类成员；已有参考表仅决定匹配顺序 | Builder 冻结 positions，旧/新成员从同一官方快照过滤，未匹配为 pending | 用参考表或日本官方网页推断国行上架；消费者单独读取 cn_song_positions.json |
| 搜索别名 | song_alias，经同一 Snapshot 冻结 | 多结果搜索、显示 | 搜索歧义直接合并身份或决定国行状态 |
| 全球谱面元数据 | song_data（merged）、OurTaiko、wiki 等来源字段 | 全球/历史难度、曲名、分类、资源引用 | 覆写官方国行目录或 offered difficulty |
| raw | 历史官方导出和更新中间输入 | 对照差异、保留历史证据 | 当前国行权威或不可用时的 fallback |
| rating | rating_structured_with_ids | 既有 Rating 模型及其输入可用性 | 推断上架或编造缺少的模型数据 |
| scoreline | taiko_goku_onis / 原始 score、roll、stream 数据 | 既有目标推荐和分数线模型 | 推断上架；读请求重建真实文件 |
| Raw Fumen | 绑定来源根目录的 ESE / OurTaiko 文件 + SHA | 原始文件可用性、下载、局部分析 | TJA 有无决定国行状态 |
| Parser / Features | 冻结扫描 + parser manifest + 单谱面 feature sidecar | AVAILABLE/PARTIAL/UNAVAILABLE/NEEDS_VALIDATION | 把相对间隔当绝对音乐对齐，假定动态 LEVELHOLD 正确 |
| Historical Score Association | 原始 Publication 血缘 + Snapshot 的显式 aliases | 只读关联旧 ID；未知保持未知 | 修改真实成绩字节或重新生成 Publication |
| 游玩时间 | 可信历史事件字段及来源 | 已验证真实 play event | `2765-01-01` 归因真实游玩、Recent Growth 或成长日期 |

候选统一目录 2,993 首、14,965 个难度槽位、12,052 张已知谱面；官方列入 1,128 首，鬼/里当前操作性可玩 1,387 张。普通推荐有模型输入的中央许可 1,346 张，目标推荐 1,343 张。许可是前置资格，既有算法仍检查每个维度需要的有限数值，不改推荐算法。

七个 raw/merged 差异均为 COURSE 5：1210、226、197、1103、106、301、663。官方 level_5 均为 0；merged 的全球/历史里谱元数据保留，当前 CN 里谱资格为 false。每项原始数值、曲名和结论见 [七项冲突记录](seven-conflicts.json)。这七项不能通过“发现 TJA”改成国行已提供。

身份和 alias 的计数、namespace 碰撞及 Snapshot Hash 见 `identity-audit.json`。旧 Batch 2 记录的 558 个搜索别名歧义继续保留多结果语义；不把搜索词当身份等价关系。

元数据维护任务仍可生成旧 shelf 字段，用于草稿、历史展示分组或来源处理。它们不写 Catalog policy；线上候选读端改读中央投影。旧 Contract DTO 和 Core 纯函数的历史兼容分支单列在迁移矩阵，不能当成“所有旧判断代码均已删除”。

历史身份更新由中央 Builder 保留已知旧记录和显式 legacy/source aliases，CLI 与 runtime refresh 均读取已验证 previous snapshot；前一代损坏时拒绝重置身份。缺失覆盖侧车只降低分析能力，不阻断目录。位序链路及额外发现的消费者见 `additional-consumers.json`。
