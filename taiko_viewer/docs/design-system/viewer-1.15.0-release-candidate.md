# Viewer 1.15.0 Release Candidate

2026-11-19（Asia/Shanghai）。候选分支：`integration/viewer-1.15.0-rc`。

本报告交付集成候选供最终审批。本轮没有合并 main、创建正式 Release/tag、推送 main 或部署生产。正式版本仍为 **1.15.0**；正式发布提交与 Release 须沿用该版本并与 package/lock 一致。

## 集成来源与裁定

- 集成基线：最新获取的 `origin/main`，`c7c4f7488d7e78a9b6f9081456fb156c20ddba09`，1.14.3。
- 完整功能分支：`origin/feature/viewer-rework-stage5`，`d15134cc08edfc45c6f2c5a78585f076f38723c5`，包含 Stage 0–5 与切片 G。
- 集成提交：`194c2d045108b0e0ed17efa46b0e9b2a093ba796`。报告随后以独立文档提交补齐证据；没有逐切片发布。
- 不合并 `/play/*`、`/growth/*`、`/community/*`、`/login`、`/bind` 地址；保留现有业务 URL 与新导航。已完成的 `/songs` 合并、旧地址重定向保留。
- 接受切片 G 调色及默认全站 Element Plus 映射，记为 V1.3 修订。没有启动新视觉版本。
- Infrastructure V2、Annual Retirement 均未混入。构建复用已有 V2 隔离执行器，未改仓库基础设施。

## 相对当前 main 的差异

完整审阅入口：[main → 候选](https://github.com/sigaer/taiko-viewer/compare/main...integration/viewer-1.15.0-rc)，或 `git diff c7c4f748..integration/viewer-1.15.0-rc`。源集成共 472 个文件变更，另加本报告；包括 Stage 0–5 已有完整成果，并非本轮新增实现的文件数。主要范围为导航与搜索、统一曲库、歌曲详情与定数、成绩与成长、社区、账号与设置、同步/开发者/工单、工具/段位/信息页、设计组件与样张，以及配套测试和文档。

业务 API、账号/OIDC 服务、数据库 schema/迁移、运行基础设施和部署脚本相对 main 均没有改动。服务端差异只有已批准的 `server/middleware/legacy-catalog.ts` 与 `server/services/content/sitemap.ts`。未执行生产数据读写测试，未连接生产数据库。

1.14.3 的东方联动、冬季活动原图与优化图、`generate_responsive_images.mjs` 配置和中日文文案全部保留。首页活动引用自动合并到新组件；删除冲突按新版组件处理，并用 `object-fit: contain` 保持横幅完整显示，手机展示两项活动。称号关系 JSON 与 main 字节一致，已检查 JSON，没有新增关系或索引变更。

package.json 与 package-lock.json 的根版本及根 package 版本均为 1.15.0；lock 的依赖部分未变。本轮没有按切片递增版本。

## 本轮验收

| 项目 | 结果与范围 | 证据 run |
| --- | --- | --- |
| Linux 标准生产构建 | `npm run build` 退出 0，固定 Schema 检查通过，Nitro 入口完整；未启用样张 | `qa-a73eaead3aff` |
| DS / 版本 / 核心静态测试 | DS 95/95；版本 1/1；核心与 Stage 1–5 共 260/260；`check:ds` 通过 | `qa-781c4c56ee45`、`qa-57848a2912f7` |
| 生产 Nitro + 私有 MySQL 核心 | 9/9 组通过，真实请求与真实数据库，见下文 | `qa-38fa4ec77e38` |
| 代表页面矩阵 | 27/27 状态，主题、唯一标题、无整页横向溢出、控制台/水合检查；部分登录数据为既有拦截场景，未算真实写入证明 | `qa-4064696afd1d` |
| 真实成绩页视觉 | 1440/390 × zh/ja × light/dark，8/8；实际登录与读取，主题及溢出断言、截图复核 | `qa-38fa4ec77e38` |
| Stage 0 作用域浏览器回归 | 74/74，计算样式严格比较，样张 CSS 不加载进参照页；附加进程退出检查通过 | `qa-57848a2912f7` |
| 真机软键盘 | 未执行。无设备/历史记录，负责人明确答复「没有，不设为阻断」；非阻断风险，不记 PASS | 本次会话裁定 |

### 真实核心行为

1. 390px 登录到 `/settings`：中文、日文各三次，六次均在 20 秒内完成；真实 POST 登录、GET 会话。验证 session cookie 的 Secure、HttpOnly、SameSite=Lax。
2. 顶栏菜单真实退出，服务端会话失效；错误密码返回 401；重新登录正常。
3. 本地 TLS 测试 OIDC 提供方完成发现、授权码、PKCE、JWKS/签名、nonce 校验、真实 callback 与会话建立，回到 `/settings`；事务已消费。未声称验证真实外部身份提供方。
4. 真实目标流程：已安装 Python 模型读取既有合成运行时向量，选择、读取、判定、替换、取消均走生产 API；核对私有库两条取消历史。
5. 真实成绩读取、锁定与修改；核对锁记录及修改后成绩，再从实际页面读取。八组视觉截图单独保存。
6. 同步概览及提交走真实生产 API、实际受限 CLI/SQL/文件发布，核对一条持久 receipt。仅鼓众上游与日常计算使用已有 `installed-workers/account_sync_sql_child.py` 的合成响应，不访问真实鼓众或分发目标。
7. 社区创建帖子、手机回复框发出真实 POST、立即显示、重载保留、点赞、读取通知；脚本文字未执行。清理本次线程后 `forum_threads` 总数差为 0。
8. PWA manifest、SW、theme-color 正常；实际注册并激活 Service Worker。缓存只有 `/_nuxt/builds/latest.json`、对应构建元数据、`/manifest.webmanifest` 三项，无账号/API/HTML/payload。标准产物 `/_ds/tokens` 为 404。

### 测试修正与隔离

- 作用域参照由已经默认映射的 `/settings` 改为范围外 `/admin/taiko/login`。独立参照文档不进入样张，只加载样张实际使用的同一组厂商 `el-*.<hash>.css` 按需 CSS（不加载样张/SFC 样式，以免遮蔽全局泄漏），然后逐项比较根变量、html/body、按钮、tooltip、message、选项及弹窗计算样式。删除对单个 message 样式变化的豁免；真实 CSS 差异仍失败。robots 断言恢复到参照页原值（后台登录页本身就是 noindex），不误要求后台页可索引。匿名后台会话探针的 401 按错误来源归入参照页并记录；断网曲绘由既有合成 PNG 提供，CSS/JS/字体请求不拦截，pageerror 不豁免。
- 构建报告只将 `ds-samples/` 视为样张实现；生产已经合法使用的 DS 组件、字体、token 不再被误报为样张泄漏。普通产物排除样张路由的 HTTP 检查仍保留。
- `forumI18n` 两条旧推荐标题精确断言更新为现有冻结中日文文案，其余冗余提示检查保留；未更改产品文案。
- Linux 执行器沿用 `shell-sql`/`shell-check`，复用 `writePagesFiles`、`runSweep`、`goalAuthoritative`、`installedRuntimeCatalog`、既有同步 worker fixture 与资源采集模块。没有扩展成基础设施专项。
- 每次 DB 运行都在独立网络 namespace 中，仅启用 loopback；私有空 MySQL、限定权限测试用户。实际 `SELECT DATABASE() = viewer1_security_test`、私有 datadir、显式 CLI opt-in 及 `TAIKO_ALLOW_TEST_DB_MUTATION=1` 均验证后才执行测试写入。无生产数据复制，凭据仅在内存及私有运行环境中传递。
- 构建 151.16 秒，200ms 采样的 cgroup 峰值 4,178,870,272 bytes；真实核心浏览器阶段 45.94 秒，250ms 采样峰值 1,683,808,256 bytes。OOM/oom_kill 均为 0。峰值是采样值，不是硬件瞬时峰值。
- 构建、QA 串行；单浏览器，场景串行。finally 关闭浏览器、Nitro、测试 TLS 提供方、私有 MySQL，隔离执行器确认子进程退出；SQL/浏览器测试 scratch 已回收，构建产物按隔离执行器的保留规则留存。

所有 run 的持久证据位于 `/home/sigaer/taiko/qa-vault/runs/<run>/evidence/`。真实核心的 `rc-result.json`、`pwa-runtime.json`、`rc-resources.json` 与 `acceptance-*` 截图可直接复核；矩阵的 `sweep.json` 标明 real/intercepted。标准产物保留于 `/var/tmp/taiko-viewer-1150-ops/standard-output`；两个隔离产物均不得直接发布；样张产物仅用于作用域验收，正式发布由标准部署脚本重新构建。

中途失败未隐去：首次构建实际完成，但采集器读取本机不支持的 `memory.peak` 导致工装退出 1；修正为采样后标准构建完整复验。真实测试曾使用错误 Python 路径、详情页不完整模型输入、错误 HTTP 预期与 evaluate-current 请求字段，均修正测试配置/断言后复验；没有通过改生产业务代码绕过失败。前述静态文案旧断言也已复验。

## 剩余风险与审批边界

- iOS Safari / Android Chrome 真机键盘、横竖屏、输入法组字仍未验证，按负责人裁定为非阻断风险。
- 没有验证真实第三方 OIDC、邮件出口、线上同步上游、所有图片生成器、全量真实数据规模与性能预算。局部 fixture/拦截场景不能替代这些证明。
- 视觉采用代表页面结构断言及截图复核，没有声明跨平台逐像素一致；其余本机长矩阵保留为历史证据，未无关重跑。
- 构建保留既有 reverse OIDC BigInt/es2019 警告，相关生产代码未改。RC 不等于生产发布批准。
- 正式 Release/tag 尚未创建。最终合并与发布均等待负责人批准；批准后必须使用标准部署脚本，以正式 HEAD subject 为参数，并保持版本三方一致。

## 回退步骤

1. 本轮未改变生产或 main。若拒绝候选，保留分支与证据供复查即可，生产无需回退；不要 reset 或覆盖 main。
2. 若批准发布后需要撤回，在届时最新 main 上另建恢复候选，审阅对本报告集成 merge commit 的 `git revert -m 1 <集成提交>`，保留基线之后独立业务更新。此命令仅是恢复方案，本轮未执行。
3. 复核活动资源、中日文、版本/lock/Release、标准构建与核心 smoke。回退版本与正式提交由最终批准确定；本次无数据库迁移，故无回滚 schema 的步骤。
4. 获准后仅由最终集成者运行 `scripts/memory/run_build.sh /bin/bash scripts/deploy_forum_web.sh "$(git log -1 --pretty=%s)"`；脚本失败立即停止，不手动推送 main、不替换生产输出、不单独重启服务。后续操作仍需最终批准。

## 最终记录

最终复验：`qa-57848a2912f7` 的作用域 74/74、DS 95/95、版本 1/1、账号切片 15/15、JSON/版本根检查均通过。`git diff --cached --check` 通过。最终再次 fetch 后 `origin/main` 仍为 `c7c4f748`。所有生产改动须等待后续最终批准。
