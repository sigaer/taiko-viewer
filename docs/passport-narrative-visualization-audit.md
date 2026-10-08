# Passport 0.80.2：审计与设计决策

2026-10-08。起点 main `0334763`，canonical package/runtimeConfig 0.80.1；实现位于 `feat/passport-narrative-0802`。主工作区仅有既存未跟踪文档/测试，保留不动。目标 patch 0.80.2。

## 七项短审计

1. `pages/my/growth.vue` 将每个 segment 的有效值 flatMap 后构造 SVG path；单点圆圈、每个边界两层圆圈加问号、纵向虚线及一行 details。因此四段产生三个重复解释。额外发现缺值被过滤后会跨缺口连接：展示投影需切连续有效 run。
2. selectedPointId 只选择指标点，focusTimeline 已独立；openBreaks 在 SVG 和 details 双向同步引起两个区域更新。删除逐边界状态，保留一个原生 details；数值选择不驱动 focus。
3. `growth-passport/composer.ts` 使用 measurementVersion/algorithmVersion/modelRevision 连续分段；A→B→A 不合并。modelRevision 是全局指纹，并非指标指纹。
4. `account/growth.ts` 从同一次 Python 输出取得 overallRating 与 dimensions；`growth-history/measurements.ts` 保存原始六维、overallRating、全局 revision、availability 和 sampleCount。外部只读源 `growth_compute/__main__.py` 的 compute_growth 从 score 模块和 rated_stats 生成两者。`growth-history/model-revision.ts`（自 c8aef27 起）散列 compute、chart availability、duplicate versions、snapshot history、score calculator、rating structured、song data、alias 八个源。整体指纹可因非指标输入变化，但数据库没有逐指标依赖或各文件旧摘要。**实际旧行的跨 revision 指标等价 UNKNOWN**；不以当前代码推断旧行。
5. `milestones.ts` 输出稳定 id、primaryType、before/after/delta、improvements、factKeys/evidenceRefs；严格 Goal matcher 匹配证据，未匹配保持 observationOnly/day:null。保留 selector；新纯 presenter 在 utils，返回 locale slot、主事实、支持事实、完整追溯与时间精度。
6. route.query.range 选择 shared.views；current 为现在，measurement 最长365天，事实30天交集/其余最多90天。旧版 factWindow、complete、精选计数全在主页面。新版删除普通完整状态，在180/365常显90天范围，在异常 coverage 保留次级提示。
7. 0.80.1 发布报告实测：认证 GET 3163ms、SSR可见4022ms，各1 compute/1 Python/1 replay，payload50541B；四档切换额外API为0。该数据为旧证据，不冒充本轮测试。修改限定 Vue/presenter/locales，无新增后端路径、API、Python、replay或写入。

## Gate：B / NOT PROVEN

保留已有 segment 规则，进一步在纯图表投影中对缺值、limited/insufficient、缺失 revision 断开；不改测量或历史。六维与 Rating 使用独立组件，六维保留单维选择，量纲0–15。暂不做六小图：手机优先突出所选维度，避免增加2190个可聚焦点；这是文档允许的核心方案，不宣称多维增强验收。

## 静态 UX 对照（实施前）

已查看旧真实截图 `/var/tmp/passport-narrative-0802/before-online.png`：三个问号、三行日期解释、重复覆盖声明，主句是指标串。

```text
这段时间                         30 / 90 / 180 / 365
Rating 的走势                    六维变化
四个独立日期值 / 同段真实细实线    单维选择 → 0–15 真实点/线
          为什么有些点没连起来？（全区唯一 details）
关注方向                         独立时间轨迹

这段时间，留下了什么
9月12日  KAHATAREDOKI NO YUUWAKU · 魔王
         评价从紫雅升到了极
         最好成绩 1,001,000 → 1,005,940 · 不可 1 → 0
```

沿用 Viewer 字体、surface/text/muted/accent/border tokens及浅暗主题，不引入新字体资源。视觉标识是细日期时间轴和突出的事实主句；小字承载数值证据，长曲名换行。拒绝KPI卡片和逐断点装饰。四个不同版本点用紧凑日期值记录，连续有效点用细实线；无虚构稳定判断。

## 验证状态

实施/本轮回归/浏览器/线上 Gate 尚未完成，不能声明 COMPLETE。P1a、P1b、365天事实读模型沿用既有 BLOCKED。QA首次准入返回75（其他任务持有维护锁），没有绕过。

## 集成更新（2026-10-09）

并行已授权的家用机 V2 功能将 main 推进到 `df195d5` / 0.81.0。按不回退版本规则，本次 patch 顺延为 **0.81.1**，仍仅实施 0.80.2 brief 的 Passport 范围。

首轮本地回归223/223；真实 Vue 浏览器核心32/32、典型叙事/365点上限16/16通过。后续精确主事实同类型选择补充用例和集成复核见最终报告。此前开发验证的路径限制、热重载中断、第三方 networkidle 等待已修复测试环境并保留失败记录，未绕过资源隔离。

## 最终本地 Gate（发布前快照）

集成 `df195d5` 后，Growth/Goal/Recent/Daily/Weekly/History/Voice/Passport/版本链 **224/224**，Home/日历/V2新增功能回归 **78/78**；真实Vue矩阵 **32/32 + 16/16**，包括hover、真实点击、键盘、绑定及迟到响应隔离。全部周期切换新增账户API为0，365点双图SVG子元素2204。精选器和后端实现无差异。中日文截图逐条审阅通过，无问号墙、无虚构连线，标题和主句优先于支持数值。

证据位于 `/var/tmp/passport-narrative-0802`：`integrated-regression.log`、`integration-checks.log`、`integrated-browser.log`、`browser-matrix.json`、`extras-matrix.json`、截图及`browser-resources.json`。末轮浏览器采样峰值2081898496 bytes，high/max/oom/oom_kill为0；kernel memory.peak不可用，保留unknown。3197监听器已退出；测试只用合成DTO和拒绝连接的DB端口，没有本地DB写入、DDL或生产userdata访问。

标准发布与线上认证验收尚待执行；最终32项完成报告保存在上述目录的`release-report.md`，发布后据实更新，不用本地PASS提前宣称线上COMPLETE。用户已明确授权沿用sigaer现有会话做发布后真实验收。
