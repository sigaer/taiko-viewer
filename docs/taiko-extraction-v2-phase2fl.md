# Phase 2F-L — Public Plugin Source Landing

日期：2026-10-13。状态：**PHASE_2F_SOURCE_LANDING_REVIEW_READY**。

## 两仓审阅入口

| 仓库 | integration HEAD | 交付 |
| --- | --- | --- |
| Taiko | `77d68ffd3edc06040d5a995307217748f744b6e6` | [main 比较页面](https://github.com/sigaer/taiko-bot/compare/main...integration/public-plugin-source-landing?expand=1)；创建 PR 返回 403 `Resource not accessible by integration`，按要求不重试 |
| Sakura | `10871f4edc1342921b372f5d6ab122e1a80e61c3` | [PR #13](https://github.com/sigaer/Sakura_bot/pull/13)，base main，open、未合并；GitHub 复核 mergeable=true |

两仓分支均为 `integration/public-plugin-source-landing`，已推送，工作树干净且 HEAD 与远端一致。Taiko 从实际最新 main `5f8465f` 顺序 cherry-pick F-A/F-B/F-C 三个提交；Sakura 从实际最新 main `390175e` 顺序 cherry-pick 八个迁移提交，均无冲突。各补一个安装文档提交；没有重写冻结候选 `abef35b` / `7c94305`。

Taiko [PR 描述草稿](/var/tmp/taiko-phase2fl-20261013/taiko-pr-body.md) 已准备。403 是提交渠道限制，不是代码或安装阻断。先审阅 Taiko 并确保依赖可获取，再审阅 Sakura。

## 可安装源码与制品

Application **0.5.0**、Song Plugin **0.3.0**、taiko-bot **0.2.12** 不变。中心 Core **0.1.1**、客户端 Core **0.1.2**、Contract **0.1.0** 不变。

Taiko README 的安装命令现在同时提供本仓 Application 与歌曲插件子项目，避免仅安装根项目时误向 PyPI 寻找未发布包。已提交[完整源码/本地 wheel 安装说明](https://github.com/sigaer/taiko-bot/blob/77d68ffd3edc06040d5a995307217748f744b6e6/docs/public-plugin-installation.md)。中心使用对应 Sakura requirements-domain 固定来源，再安装两个 Taiko 子项目；继续源码布局，不安装客户端根包。

普通安装不需要历史 `/var/tmp` 制品。Core/Contract 沿用固定 Git revision 和既有仓库读取授权，或由维护者提供精确版本 wheel；未声称这些私有依赖无需授权。自有子项目真实构建安装通过，完整依赖解析及 pip check 通过，不使用 `--no-deps` 安装。

本轮另用既有冻结 wheel 在两个全新 venv 安装验证，保留以下验收制品 hash：

| 制品 | SHA256 |
| --- | --- |
| Application 0.5.0 | `5f801acea42bc35d8a313721edf9eba6b5274a1b1510aaa5458b5eb297030095` |
| Song Plugin 0.3.0 | `9e68e7c646f73ba6240ac4d68c364a5d674060488ea016255b3a7dda80dff005` |
| taiko-bot 0.2.12 | `23188d68750d565c26478ba5bace7488bd77facd72074c3ce3257edbae299ce3` |

制品及精确锁沿用 [F-P 交付目录](/var/tmp/taiko-phase2fp-20261013)。本轮源码安装会重新构建 wheel；ZIP 时间及根包 README 元数据可使新 hash 不同，不冒充原冻结制品。已逐文件核对新安装 Application/插件 Python 源码与 integration 源码一致。

## 有限集成结果

- 冻结 wheel 全新环境：中心、客户端各 **26 项真实 NoneBot 分派 PASS**，沿用公开/合成 fixture，比较自身旧输出；未重跑历史完整矩阵。
- 同仓子项目重新安装后实际加载完整插件：外部九入口各 1、宿主对应各 0；`score_cmd` 原宿主唯一注册，未执行自动刷新。九入口为 what_song、alias_query、song_where、song_position_phrase、song_pos_by_id、diff_by_id、note_count、const_query、patterns。
- 中心运行布局的被测源码与 integration 中心源码逐字节一致；客户端使用真实已安装根包。平台消息发送为模拟接口，SQL/网络/生产路径访问被测试 guard 禁止。
- 客户端安全 helper 与 **35** 处发送前复核 AST 保持已合并 main 的原样。冻结 Application/公共命令业务实现不变。
- Sakura Miku 及全部非 taiko 源码树与 `390175e` 完全一致；八个整合提交没有引入其他 WIP、Phase 6 或旧 246 文件候选。
- 相对当前 main，P0 相关 Growth、score_calculator、daily_ability、history_time_policy 源码没有改动；生产四文件 hash 仍与恢复记录一致。生产 Dani 等运行文件未写入。候选与生产 P0 的既有差异仍需后续发布单独协调，严禁整目录覆盖。
- 两仓没有仓内 GitHub/GitLab/Jenkins 部署工作流，本轮不添加自动化、不调用部署脚本，仅推送 integration 分支。未检查仓外管理员 webhook 配置，不将源码 PR 当作生产切换授权。

已提交[集成摘要](https://github.com/sigaer/taiko-bot/blob/77d68ffd3edc06040d5a995307217748f744b6e6/docs/public-plugin-landing-validation.json)。详细[安装、分派与范围证据](/var/tmp/taiko-phase2fl-20261013/evidence)及复现脚本保留在同级目录；全部 QA 经 `scripts/memory/run_qa.sh` 运行。

本轮未合并 main、发布包、部署、重启或修改生产数据。score_cmd/Writer 阻断继续延期，没有开展私人命令迁出。完成后停止。
