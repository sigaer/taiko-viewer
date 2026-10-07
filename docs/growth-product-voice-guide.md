# 成长产品语言 — 0.80.0

Viewer 是个人太鼓成长记录。只谈看到的记录与用户选下的练习，不扮演教练，不给任务，不用鼓励填空。

观察 → 含义 → 邀请：不要求每处凑齐三句。事实够强时说数值；只看到少量记录时缩小范围；没有观察时少说。六维最低项只支持「可以留意」的邀请，不支持「最近退步」「手感变稳」等时间趋势结论。

| 内部语义 | 中文 | 日本語 |
|---|---|---|
| focus | 最近可以多留意 | 最近は…を意識してみても |
| recommendation | 想练的话，可以看看 | 練習するなら、このあたりはいかが？ |
| active Goal | 这次想练 | 今回練習したい曲 |
| completed Goal | 这次练成了 + 事实 | 今回できたこと + 事実 |
| inconclusive | 暂时还确认不了这次进展 | 今回の進み具合は、まだ確認できません |
| limited | 记录还不多 | まだ記録が少ない |
| balanced | 各方面的记录比较接近 | 各項目の記録は近い |
| measurement | 能力记录 | 力の記録 |
| model break | 记录方式更新过 | 記録方法が変わりました |
| refresh | 更新一下 / 再试一次 | 更新 / もう一度試す |
| Recent | 最近同步的变化 | 最近同期した変化 |
| no-play | 没有新的游玩记录 | 新しいプレイ記録がない |
| combo | 连击 | コンボ |

技术说明只放次级 details/summary；键盘能展开，有明确 focus。无需说明的地方不加副标题。保留实际范围、比较限制、异常恢复和下一步操作；SHA、revision、schema 等不出现在普通 UI。

## 文案选择

`utils/growthVoice.ts` 定义共享状态与各 surface composer；它返回 locale key 与事实参数，不拼万能故事。Home、Goal、Recent、Daily、Weekly、Passport 分开选择。所有值来自现有 DTO；不请求新接口，不保存文案历史。

推荐使用 FNV-1a，将 surface、user/profile、上海业务日期、focus、readiness、goalState、activity 映射到已审阅的 locale 文案池。每个字段最多 128 字符、池大小固定，纯函数、O(1)。无随机数、请求时间、scoreRevision、语言或加载状态；zh/ja 对应同一语义槽。同用户/状态/业务日重复更新不换句；状态或次日允许换句。不同账号不要求不同句子，固定池有正常碰撞。

六维各 4 组 zh/ja，balanced/limited/quiet/active/completed 各 4 组，普通邀请 5 组，Daily 分数变化 4 组。每条对齐证据强度、行动压力与情绪节制，不要求直译。quiet 必须由真实长期活动状态提供；现有 overview 没有这个字段，因此线上传 unknown，绝不拿同步时间或一天未游玩猜静默。

Daily 保持既有提取和事实去重，歌曲是主体，数值是句子；未留给 Daily 的变化已在 Goal/Recent 展示时，不称今天没有变化。未知分数增量只说当前最好成绩，不补出 0 或增长量。Weekly confidence 不是 high 时只谈已经留下的记录；静默只说没有集中的变化，不猜用户在熟悉谱面。

Passport 只比较既有可比较记录段。趋势稳定说实际值；记录少说积累中；更新前后仍不连接、不跨段比较。方向变化不代表旧方向已经解决。

## 回归禁词

主要叙述禁止「当前计算口径」「根据数据分析」「系统建议」「当前优先提升项」「下一步先练」「任务完成」「成长指数」「超过 X% 玩家」及 modelRevision、algorithmVersion、measurement segment、schema、revision。技术披露中仅允许已审阅的比较限制；不输出原始标识。

避免无事实的「加油」「太棒了」「突破自己」「继续保持」，避免「我帮你挑了」。Recent 不说「这一轮」「这次游玩」「刚刚打了 N 首」。无新记录不等于没玩，无新变化不等于仍在练，低维不等于退步。

## 验收入口

- `test:growth:voice`：六维与状态文案池、双语 golden、同日稳定、禁词与纯函数性能。
- `scripts/verify_growth_voice_browser.mjs`：真实 Vue + 合成 API DTO，104 个状态/布局组合；`--weekly-only` 用于周报排版的 28 个定向检查。覆盖 zh/ja 手机、zh 桌面、ja 深色手机；这是有依据的成对覆盖，不宣称完整语言/尺寸/主题笛卡尔积。
- 原 Growth/Goal/History/measurement/Profile 隔离回归保持执行。文案实现不修改服务端、schema 或算法。
- 线上采用既有 `run_growth_experience_production_smoke.mjs --voice`，仅发布后用自建一次性账号与合成记录验证真实认证流程，沿用明确 opt-in 和正式 lifecycle 清理。不是真实玩家数据，也不向真实玩家账号写入测试内容。

验证通过 memory runner，Viewer 发布只走标准 deploy script。截图、资源统计、线上 smoke JSON 与发布后最终报告位于 `/var/tmp/growth-voice-0800`，不进入 Git。这里记录验收契约，不提前写入尚未执行的线上通过结论。
