# 1.0 RC 验收方案

G6 = PASS仅表示本轮方案交付。RC NOT STARTED / NOT AUTHORIZED。Finding RC-01：severity UNKNOWN，执行状态NOT TESTED；SOURCE为本轮Gate缺口与既有测试入口，`8d70df2`，2026-10-10。方案可执行性MEDIUM，实际验收结果UNKNOWN。

1. **前置门禁**：关闭SEC-01/DATA-01；完成公开范围冻结、writer运行清单、当前源码到产物映射、性能预算决策及恢复合同。P0不能以披露豁免。变更冻结后仅接受有finding ID的P0/P1/安全修复，每次记录受影响Gate并重新审查。
2. **单测/服务级**：当前Home四态、目录难度、推荐Goal、Daily/Recent/Weekly/History/Passport、measurement、0.81.7 DF/排序/存档、0.81.10变更检测与DTO parity；明确基线0.81.9而非0.81.4。练习播放器兼容/WASM缓存升级加入范围。
3. **隔离SQL**：实际SELECT DATABASE()须等于批准的_test库名，并显式mutation opt-in；session/token/owner/binding/Goal/measurement/cursor/UGC/年度job/share负例、并发事务、解绑删除清理和零孤儿。禁止copy生产数据、新增外键、隐式自动建生产schema。
4. **正式构建浏览器**：使用memory runner、一个browser一个page，zh/ja×390/1440×light/dark；Guest/Unbound/Empty/Ready，登录绑定→推荐→Goal创建替换取消→同步→完成→Recent/Daily/Weekly/Passport。检查迟到响应、键盘焦点、可访问名称、错误重试、隐藏内容及无横向溢出。
5. **设备**：iOS Safari、Android、桌面真实浏览器单列版本；不能用Chromium模拟手机代替真机音频/全屏。未验证设备必须写入限制。
6. **性能**：服务请求、Python、history normalization/range replay、SQL、队列、SSR visible/hydration分别计数；成功四档切换预期0 extra account请求/0 Python/0 replay，错误重试不混入该指标。不得用单次2.8秒当p95；阈值及N见性能提案，批准后才能判PASS。
7. **运营**：候选7日窗口（待批准）覆盖高峰，按路由报告请求分母/5xx/timeout、p50/p95/max及资源guard；历史热点单列。严重越权/损坏即冻结候选，重复高频失败或预算失守按批准条件退出RC。
8. **恢复**：合成灾难/并发恢复证明提交点、hash、无孤儿和RPO/RTO；代码回退、数据回退/向前兼容分别验证。值班负责人、告警送达、受控回退路径必须署名。
9. **代表性用户**：先明确授权与副作用。认证GET可能写session/measurement，不能未经授权执行；不制造生产测试账号/Goal/帖子/同步。无合适授权就NOT TESTED，转隔离代表样本。
10. **发布确认**：后续另行批准才允许版本/commit/release；标准wrapper→deploy脚本且HEAD subject一致，脚本失败停止。签字核对Git SHA、package/lock、runtime、/more、产物依赖、健康、用户旅程、DB/文件异常、恢复点。所有签字当前均待完成。

候选发布说明内容：查歌、成绩、练习目标、成长观察、现有社区与总结；存档曲线是记录值，跨算法不等于同量尺净增长；180/365测量不提供全年成绩事实，精彩时刻最多90天；最近同步观察不是可验证的真实Session；partial/truncated说明与错误恢复入口保留。实际已知缺陷需关闭或获批准披露后才能定稿，不将P0包装成限制。

成本：按既有串行QA/build预算分批执行，不与生产构建重叠；所有fixture/截图有生命周期与磁盘配额。失败清理本次进程/监听/合成数据，保留去敏证据，不自行扩大预算。Owner批准RC范围、SLO、设备覆盖、值班和回退合同后另行实施。
