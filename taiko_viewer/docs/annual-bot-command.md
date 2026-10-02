# 官方 QQ Bot 2025 版本总结

主指令 `2025版本总结`；别名：`2025年度报告`、`2025版本报告`、`2025年度总结`、`虹2025年度报告`、`虹2025版本总结`、`虹2025版本报告`、`虹2025年度总结`。也接受一个前导 `/`。仅 QQ 官方适配器事件；OneBot 不注册响应行为。以事件发送者身份查询，不能指定他人的鼓众 ID。

图片为 Viewer 分享页同一 1080×1872 导出组件，使用同一冻结生成算法、单快照降级配置和渲染器。已有可复用网页报告时直接复用其导出 PNG；仅 Bot 用户按当前真实绑定生成，独立 Bot 文件缓存，不创建伪造 Viewer 用户/登录会话/内测事件，不同步发帖。文案严格为“完整版报告请移步至Viewer网页端查看~”；Markdown 图片附一个 URL 型键盘按钮，打开 `https://viewer.sakura-bot.cn/annual`。网页登录和绑定检查仍适用，按钮不会携带用户会话。

内部入口 `POST /api/taiko/internal/annual-card` 复用既有服务令牌认证，服务端重新查询官方身份的当前绑定并在返回前再次核对，拒绝未绑定/虚拟合并账号/歧义当前绑定。复用 host-wide admission 的 generator 2 / renderer 1、原队列上限、隔离 worker、压力和磁盘保护、暂停开关。Bot 侧和 API 分别限制最多 4 个不同身份/目标在途；同一目标复用 Promise。Bot 30 秒冷却、API 每身份每分钟 4 次；客户端 HTTP 有 240 秒上限，不自动重试。新 Bot HTTP 事务不是网页 DB 中的 durable job；中断后用户可再次查询已完成缓存，不宣称它具有网页任务全部持久恢复行为。

Bot 缓存按输入指纹与渲染版本隔离，每目标保留当前和前一次成功导出；缓存目录位于年度缓存根下 `bot/`。Bot 渲染路由使用单独的 `bot_...` 文件定位 ID，摘要内保留冻结 schema 的原 `annual_...` ID。读取这些内部摘要/MyDon 仍须有效短时渲染签名。失败或新数据不会覆盖旧 PNG。仅 Bot 报告没有写成网页账户报告，之后注册 Viewer 时网页仍按自己的绑定生成。

## 当前验证与发布状态

2026-10-02：Python 3 项通过（8 个名称、真实 QQ Markdown/键盘序列化和 URL action=0、OneBot 静默、超时不重试）；实际 taiko.py 注册节点已在 NoneBot 初始化环境加载，规则和依赖注入通过。Node 官方身份/绑定拒绝及原策略回归 4 项通过。第一次 Node 测试因测试打包缺 CJS require bridge 失败，修正测试 harness 后通过。独立 MyDon CLI 在隔离、禁止外网、768 MiB 上限进程中实际输出 944×715 PNG；测试未配置 DB 的自定义称号查询记录了错误并回退，不能宣称完整素材路径通过。

完整隔离冒烟脚本 `loadtest/annual-bot-smoke.mjs` 已实现，包含服务认证、非官方、未绑定、暂停/恢复、两同目标请求、Bot-only 真实 PNG、已有网页 PNG 复用、没有伪造注册账户的断言，但 **尚未执行**。候选根 `/var/tmp/annual-test-bot-20261002`，独立 MySQL 已初始化，未启动测试服务。原始实现候选 `92d960e`，后续修正以最终候选清单为准。

标准候选构建被 `scripts/memory/run_build.sh` 拦截：要求 MemAvailable ≥ RAM×25% + 5 GiB，约 12956 MiB；多次观察只有 12500–12630 MiB，缺约 330–450 MiB。没有绕过保护、停止其他人的开发进程或重启生产。**尚未部署 Viewer 0.78.0，尚未重启 Bot，新指令未启用。** 必须待资源恢复后完成候选 build、真实隔离导出、标准部署、内部现网冒烟，再重启 Bot 并核验两适配器连接。真实 QQ 客户端收图及按钮点击仍需实际触发，不冒充已发送消息。

运行：Viewer Node tests 从 viewer 目录执行 `bash ../scripts/memory/run_qa.sh /bin/bash -c 'node --test tests/annualBot.test.mjs tests/annualPolicy.test.mjs'`；Bot tests 从 forum 根执行 `bash scripts/memory/run_qa.sh /bin/bash -c 'cd /home/sigaer/taiko && PYTHONPATH=. .venv/bin/python -m unittest discover -s tests -p test_annual_report_command.py'`。真实隔离测试复用现有 bootstrap 与 browser 任务入口，在配置加 `botSmoke:true`；不连接生产数据库。
