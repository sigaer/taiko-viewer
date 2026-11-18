# Stage 1 · 导航、搜索与曲库

2026-11-18，独立分支 `feature/viewer-rework-stage1`。依据已批准的 V1.3（冻结
`5f770a2ddd2df970454f85fda09fa73008120b66`）及 `06-migration-plan.md`；未合并、未部署。

当前完成 Keepalive 前置修复与导航/搜索首个页面集成切片，版本 `1.15.0`。
这不是整个 Stage 1 完成声明；统一曲库及旧 URL 重定向仍是下一步。

## 本轮实现

- 默认布局接入六组桌面导航、顶栏页签、五项手机导航及中央搜索按钮；使用当前
  业务 URL，保留中日文、主题、账号真实状态、页面宽度与沉浸/键盘行为。
  发帖页保留自己的吸顶头部，详情页不显示列表页签。预渲染页面首次挂载后
  重新读取真实会话，避免构建时的游客状态覆盖已登录账号入口。
- 搜索接入真实 `/api/content/songs`，160 ms 防抖、取消过期请求、最多展示 8 首；
  API 现有最小分页量为 12，展示层明确截断。页面动作使用现有路由。
- 原生 dialog 的模态焦点、combobox/listbox、方向键/Home/End/Enter、输入法保护、
  Esc 与触发点焦点归还、Ctrl/Cmd K 和非输入区 `/`、移动 visualViewport 适配。
  错误可重试；搜索结果跳转后聚焦主内容。
- `html.viewer-rework` 明确启用既有 V1.3 Token，DS 检查覆盖新组件；旧页面的
  Element Plus 映射未切换。Barlow 按需加载，中日文仍使用系统字体。
- 没有新增后端 API、模拟线上状态或修改年度报告代码。搜索别名排序、最近搜索、
  全部结果与统一曲库联动，以及同步/通知面板的完整形态尚未完成。

## Keepalive 与 Teleport

Keepalive 前置修复：NuxtPage 显式 prop 会优先于路由 meta，导致 `keepalive:false`
失效；改用 Nuxt app 默认配置，保留 PracticePlayerPage 排除与普通页面缓存。
隔离真实 Nuxt/Element Plus 浏览器 qa-3a0db8518560 证实修复前不缓存声明失效；
qa-9f98f83f8625 修复后 5 项通过：同布局状态保留、跨布局/head、无布局缓存页的
Teleport 卸载、显式禁止缓存、零生命周期异常。当前 Vue 3.5.43/Nuxt 3.21.11/
Element Plus 2.13.2 未复现历史 Windows nextSibling 异常，不能声称复现并修复了
相同框架异常；未改依赖或删除样张既有保护。测试不连接数据库、使用独立网络。
参考 Nuxt 本地 page.js 的 `props.keepalive ?? route.meta.keepalive` 优先级及
[Vue KeepAlive 生命周期](https://vuejs.org/guide/built-ins/keep-alive)。

## Linux 验证

| 验证 | 结果与证据 run |
| --- | --- |
| Keepalive/Teleport 最小真实 Nuxt 回归 | 5/5，`qa-9f98f83f8625` |
| DS 静态门禁与 Stage 1 契约 | 17/17，`qa-5d5fbe90bc70` |
| 标准 `npm run build`（含 Schema check） | 通过，`qa-27fa158bca03`；159.806 s，Nitro 入口完整，64.6 MB（gzip 23.3 MB） |
| 生产 Nitro 浏览器矩阵 | 20/20，`qa-5092f44ce964`；1440/1280/820/390/360 × zh/ja × light/dark |
| 搜索与导航 | 8 首真实 API 结果、键盘/IME、失败后实际重试、焦点归还/跳转、页签与横向溢出均通过 |
| 登录与发帖兼容 | 私有测试库真实 HTTPS POST 登录/GET 会话、Secure cookie、预渲染页账号入口、桌面/手机发帖头部通过 |
| 字体 B / FOUT | 2 个请求、44,984 bytes；阻塞字体时截图可读，加载前后顶栏/搜索入口/操作区最大尺寸变化 0 px |

构建使用现有 V2 build runner（Vault `qa-db288316b995/evidence/owner-cleanup/qa_vault.py`），
`development.slice/development-build.slice`，Node Heap 4096 MiB、cgroup 4/5 GiB；
0.2 s 实测 cgroup 峰值 4,263,477,248 bytes（3.97 GiB）、进程树 RSS 峰值
4,059,932 KiB，OOM/oom_kill 均为 0。固定 Schema 沿用 Phase 0 已验证文件，
Blob `d1661791fc49f9a2ddfc86da61621139359fcce3`，未改构建检查或年度代码。

浏览器通过仓库 `scripts/memory/run_qa.sh`（2/3 GiB，900 s）执行
`scripts/rework/shell-sql.mjs --allow-test-db-mutation --output=<隔离 Nitro .output>`，
外层 `unshare --net` 仅启用 loopback。沿用空库启动方式，实际验证
`SELECT DATABASE() = viewer1_security_test`、本次私有 datadir 和显式 opt-in；
合成账号/歌曲，不读取或写入生产数据。Chromium 单浏览器、单上下文串行运行；
这些宽度不是实机 iOS/Android 键盘验收。浏览器 runner 未采集峰值，不能把预算
上限当作实测峰值；结束记录确认子进程退出、私有 MySQL 退出、scratch 已回收。

中途失败如实保留：空数据库配置被启动隔离门禁拒绝（未进入页面）；页签测试
误用了 Playwright 不支持的 `current` 过滤器，已改成显式 `aria-current`；
`qa-7351827fab50` 发现预渲染页面仍显示游客入口，补上首次挂载会话刷新后由
`qa-5092f44ce964` 证实修复。PSI 超限时曾返回 `DEFERRED_RESOURCE_BUDGET`，
压力恢复后才继续，没有绕过 runner。已审视桌面/手机深色搜索与字体回退截图。

证据在 `/home/sigaer/taiko/qa-vault/runs/<run>/evidence/`；最终构建完整日志、
指标与实际构建源文件校验保留于 `qa-27fa158bca03/evidence/stage1-delivery/`。
回退：仅回退本轮外壳/搜索集成提交即可恢复旧布局，保留独立 Keepalive 修复
`233ea320`。不需要数据库迁移、服务重启或生产产物切换。
