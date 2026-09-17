# Daily Progress capability audit — 0.68.9

实施前基线：package.json 0.68.8 → nuxt.config.ts → runtimeConfig.public.appVersion。范围仅 Growth presentation。

| 当天事实 | 能力 | 证据及限制 |
| --- | --- | --- |
| 游玩谱面 | PARTIALLY_PROVABLE | update_datetime / highscore_datetime 当天记录；unique chart，不是次数；离线未同步不可知 |
| 首次游玩 | NOT_PROVABLE | 截断历史、导入生成的空 full baseline 不能证明此前没玩过 |
| Score PB | PARTIALLY_PROVABLE | 已知 previous high_score，严格增加，highscore_datetime 当天，before 时间早于 after |
| NG 下降 | PARTIALLY_PROVABLE | 同谱完整判定计数、相同总判定数、已知 before，成绩时间当天且前后递增 |
| Accuracy | NOT_PROVABLE（本轮不输出） | authoritative score_calculator.py calc_accuracy 使用算法权重与 catalog combo，DF 特判；现有 TS overview 未携带 authoritative accuracy，禁止自定义良率 |
| Crown | PARTIALLY_PROVABLE | clear_cnt/full_combo_cnt/dondaful_combo_cnt 已知，冠标严格升级，前后 update 时间递增且当天 |
| Rank | PARTIALLY_PROVABLE | best_score_rank 已知且严格增加，复用 utils/scoreRank.ts 1–8 映射 |
| Combo | PARTIALLY_PROVABLE | 与 NG 相同的完整判定证据，combo_cnt 严格增加 |
| Rating / 六维 | NOT_PROVABLE（本轮不输出） | 当前 Python compute 输出当前聚合，没有日初 authoritative 聚合；不新增重算 |

原“段位变化”= clear/full combo/dondaful 冠标变化，不是段位道场。旧实现 delta 没有写入 state，且 highscore 优先导致普通游玩可能被旧 PB 时间遮蔽。

输入标准字段为 highscore_datetime / update_datetime；played_at、highscoretime、updatetime 不在该 DTO 的 authoritative 契约内，不猜别名。stage_cnt 为累计次数，本轮不转述为今日次数。Calendar Day 固定 Asia/Shanghai，带 offset 时间转换，无 offset 为业务本地时间。

沿用一次 history load、一次 replay；full 替换、delta 合入；缺字段不补零生成改善。重复同步不生成重复事件。同谱合并，最多三谱、每谱最多三条事实。DF > FC > clear > rank > PB > NG > combo > played。

没有游玩前 recommendation snapshot / goal baseline；不做推荐因果归属。没有 Schema、API、新进程或算法变更。未知/未同步状态不宣称确定未游玩。

补充：累计 crown/rank 需要当天已有 before 记录或当天观测的快照，且该观测早于 after.update_datetime。跨过未观测的午夜时，不能把昨天可能发生的升级归为今天。无此窗口证据保留普通游玩/PB，不展示冠标或评价改善。

# 验收 / 最终问题对照

| # | 回答 |
| --- | --- |
| 1–2 | 实际基线 0.68.8；目标/源码 0.68.9 |
| 3–5 | 固定 KPI Grid 已移除；“涉及谱面”改为“今天打了 N 张谱”；原“段位变化”为 crown |
| 6–7 | 支持 played、score-pb、ng-reduced、combo-improved、clear-upgrade、fc、df、rank-upgrade；首次游玩、accuracy、Rating/六维变化不输出 |
| 8 | previous high_score 存在，after 超过已知历史最高分，highscore_datetime 当天且晚于 before；旧成绩恢复不算 PB |
| 9 | before/after NG 均存在、完整判定计数总和一致且大于 0、NG 严格减少、highscore_datetime 当天且递增 |
| 10 | 不单独实现精度算法；authoritative 权重/阈值/DF 特判不重复计算 |
| 11–12 | crown 与 rank 严格升级且当天比较窗口成立；rank 使用项目 1–8 映射，不叫段位 |
| 13–14 | song_no + level 合并，最多三条事实；DF > FC > clear > rank > PB > NG > combo > played，同等级 songId/level 稳定排序 |
| 15–16 | 普通游玩列歌曲及“今天打了 N 张谱”；无今日记录显示“今天还没开打”；无可用日期显示未知状态 |
| 17–20 | Ready“最近可以从{维度}入手”；Balanced“最近状态挺均衡”；Limited“再积累一些成绩，推荐会更贴合”；Plan“可以试试这三首” |
| 21 | 删除重复副标题和“下一步”eyebrow |
| 22–24 | 无 recommendation attribution；无游玩前 snapshot，因此没有推荐因果宣称 |
| 25–26 | 无新增 API/Schema |
| 27 | 一次 history load/replay、一次既有 Python compute；保留 private,no-store；真实 authenticated 性能待在线会话验收 |
| 28–31 | zh/ja 文案人工审查通过；浏览器矩阵结果见后续验证记录，真实用户状态尚待会话 |
| 32 | 使用正文事件行，不含 KPI 数字栏 |
| 33 | 尚不能正式宣布 READY FOR GOAL FEEDBACK LOOP：真实用户生产浏览器验收未完成；本轮没有实施 Goal Loop |

验证：Growth/首页/i18n/版本/社区 67 项通过（随后增加历史最高分回退 fixture，Daily 单独 21 项通过）；现有 Python recommendation 54 项通过；admin-auth 使用现有隔离环境、SELECT DATABASE() 与 mutation opt-in，1 项通过。临时隔离 Nuxt build 通过。发布最终源码须再由标准脚本构建。

不记录 COMPLETE / PLAYER HOME DAILY FEEDBACK ACCEPTED，直到真实用户生产验收满足原方案。

发布前：最终回归 68/68；本地合成浏览器矩阵 40/40（zh/ja × light/dark × 390×844/1440×900 × improvement/ordinary/no-play/balanced/limited）。浏览器矩阵不构成真实用户在线验收。
