# Recommendation Principles

`PROJECT` 所有目录资格来自Catalog Authority：catalog_display、historical_score、cn_current_playable、recommendation_eligible、chart_analysis_eligible。个人目标/偏好/已玩集合在现有引擎内计算；任何消费者不能用本地`shelf_status != 1`或rating有行复制目录策略。

推荐解释分四层：来源/身份与区域资格；玩家实际观测与样本充分度；既有模型下的目标条件；排序/取舍。每层保存catalog/policy/model/parser/source revision，未知数据不伪装成负证据。静态曲谱解释需要真实source hash和足够的parser capability。

`EXPERIENCE` 可组合熟悉曲巩固与适度探索，但比例因人而异。提升分数、FC、全良、挑战新难度是不同目标，不能用一个排序分数替代所有目标。`HYPOTHESIS` 某谱面特征与某玩家收益之间的因果关系需要重复观察、偏差控制和反馈检验；不凭相关性宣称保证成长。

验证先保证候选合法、身份稳定、空权威集不放行、历史成绩不丢失、所有宿主维度词汇一致。随后才评估模型的命中率、覆盖与公平比较；不能在本批借迁移改写Rating或新增Recommendation Engine。精确成功概率/训练规划/Agent解释需要另立验证方案和批准。

发布中跨模型Weekly差值继续展示，并说明计算模型变化；它是描述性比较，不单独作为训练策略效果或玩家能力增长的因果证据。
