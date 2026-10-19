# 进度图 HTTP 500 修复

发布后观察窗口内的 8 次进度图 500 均为 `kind=dani`。应用日志出现 `KeyError: fileName`，合成历史可在旧安装包复现：Viewer 的 Python 适配层传递 `capturedAt/payload`，段位历史读取却按 `fileName` 排序。该结论不能覆盖全部历史 63 次 500，未能确认的历史异常仍保留未知。

Viewer 0.86.1 使用已验证的 Bot 0.16.3 Viewer 适配层，保留原始历史文件名，沿用既有文件名排序、版本隔离和图片渲染。Core/Application 不变。Web 端仅补充页码整数校验、进程失败的固定类别诊断和输出协议校验；业务拒绝保持 400/404，内部失败保持 500，已被终止的工作进程返回 503。日志不记录子进程 argv、原始 stderr、身份、凭据或私人路径，120 秒超时、SIGKILL 和 30 MiB 输出上限不变。

验证包含安装 wheel 的 7 项合成 Publication/渲染回归，以及 `tests/progressImage.test.mjs` 的真实 HTTP 路由、五种图片分支、401/400/404、渲染失败、输出损坏、超时退出、错误脱敏与实际安装 wheel 的端到端测试；另复用账号切换时过期图片响应的回归。端到端测试通过 `TAIKO_PROGRESS_TEST_PYTHON` 和 `TAIKO_PROGRESS_TEST_FIXTURE` 显式指定隔离安装环境及合成 fixture，不连接生产数据库。

按标准脚本先完成生产构建再切换 Viewer。保留既有回滚构件和旧解释器。上线后的合成验收与自然访问分开统计，短窗口或小样本不用于宣称错误率归零。
