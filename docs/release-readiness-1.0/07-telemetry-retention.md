# 产品观察方案与埋点缺口

G5 = PASS，仅针对本轮观察方案交付；真实采集、D1/D7结果UNKNOWN。Finding OBS-01：severity P1（测量能力欠账，不以留存率阻断），status UNKNOWN（现网覆盖）。SOURCE：analytics.ts、layouts/default.vue及story.vue、PlayerGrowthSurface.vue、useChartUgc.ts；`8d70df2`，2026-10-10，E1 HIGH。

已存在条件性GA加载、SPA page_view、动态路径模板和去query/hash；home_growth_plan_click、ugc_difficulty_submit、ugc_tag_submit等源码。采集是否配置、送达、同意/退出与删除策略未验证。检索未找到下列全部规范事件的实现，不把名称近似当作同一事件。

| 事件 | 触发/去重规范 | 分母与来源 | 当前缺口 |
|---|---|---|---|
| recommendation_impression | 推荐区域≥50%可见持续1秒；页面实例+推荐revision去重 | 可呈现推荐的Web会话 | 未见完整实现；不等于已阅读 |
| recommendation_open_song | 点击已呈现推荐并打开目标；interaction ID去重 | 已曝光推荐 | home_growth_plan_click近似，送达/归因未知 |
| goal_create_success | DB提交成功后发，goal ID的不可逆标识去重 | 合法创建尝试；替换单列 | 缺业务成功事件 |
| goal_eval_confirmed | 严格评估返回已确认结果；goal+revision+结果去重 | 有效评估尝试 | 不把请求200全算成功完成 |
| goal_complete_confirmed | 首次严格evidence使Goal完成且事务提交 | eligible Goals | 页面打开、勾选不计；缺独立埋点 |
| score_sync_success | 上游同步及本地提交均确认；sync operation去重 | 合法同步尝试；Web/Bot分列 | 任务记录不等于端到端提交成功 |
| growth_daily_view | 内容成功呈现、可见门槛，页面实例+业务日 | 可访问Daily的会话 | 不是API请求数 |
| growth_weekly_view | 同上，周窗口 | 可访问Weekly的会话 | 需SPA去重 |
| growth_passport_view | 首次内容成功呈现；range切换另作属性或独立事件 | 有资格访问的会话 | page_view不能证明数据呈现成功 |
| returning_user_d1/d7 | 上海自然日队列，D0后第1/7日发生有效产品事件 | 同口径D0活跃用户 | 稳定身份、bot/测试排除、同意与删除均待落地 |

身份建议：匿名以获得同意的随机ID定义，仅同一浏览器；登录使用独立不可逆映射ID，跨设备仅按合法登录合并，不用IP合并；匿名登录前轨迹只有明确许可才关联。不收原始成绩、邮箱、QQ、Token或分享密钥；动态route模板需覆盖新路由。自然社区发帖与年度自动帖子增加source枚举，不能用帖子总数代表互动。

保留/退出提案：事件明细30天、去标识聚合90天；用户可退出，退出停止后续可选行为采集；删除账号同步清理映射与可关联事件。数据源端同意、GA端保留删除能力和访问权限须单独核验，当前不宣称合规已通过。

验收计划：隔离页面与事件sink逐项检查成功/失败/重试/SPA/多设备、双事件不重复、删除后无可关联记录，和DB业务提交计数对账；不发生产埋点。成本小fixture、单浏览器memory runner；失败不发业务成功事件。Owner批准事件口径、保留和隐私策略，再另行授权实现。
