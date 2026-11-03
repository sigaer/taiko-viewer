# Taiko Application Extraction — Phase 2A

后续进展：[Phase 2B 成绩展示抽取已完成](taiko-extraction-v2-phase2b.md)。本文保留 Phase 2A 的历史验收记录。

日期：2026-10-12。状态：**PHASE_2A_COMPLETE**。仅完成段位展示抽取及本阶段 parity，完成后停止；不授予全量 `TAIKO_APPLICATION_EXTRACTION_PHASE1_COMPLETE`、`PLATFORM_COMPLETE` 或 `1.0_READY`。

## 交付

独立子项目 `packages/taiko-application/` 提供发行包 `taiko-application==0.1.0`，import 名 `taiko_application`。段位输入/展示模型、业务 service、renderer、Core 调用分别成模块。包不反向 import Sakura，不带 userdata、字体或生产资源。Core 固定 **0.1.1**，Contract 固定 **0.1.0**，未改公式；没有安装 taiko-bot 根项目或采用其不同的 Core pin。

Sakura `taiko/plugins/utils/dani_progress.py` 改为 adapter：保留原公开函数签名与 current/history/catalog 获取，委托 Application 完成业务与绘制。命令注册、授权和发送入口不改；`dani_overview` 所需辅助接口继续委托同一 renderer。2025 六段不触发 scoreline 自动刷新。业务缓存限于单次请求，renderer 关闭图片与图标缓存。

两个仓库均已提交并推送 `feature/taiko-application-phase2a`，未合并 main：

| 仓库 | 提交 | 独立工作树 |
| --- | --- | --- |
| [taiko-bot](https://github.com/sigaer/taiko-bot/commit/e0dc41d49c7a47fc7dccd4f261b5f451f88ab1ba) | `e0dc41d` | `/var/tmp/taiko-phase2a-20261012/application` |
| [Sakura_bot](https://github.com/sigaer/Sakura_bot/commit/759262d30b21637544eb47f5e90939fda09adaa6) | `759262d` | `/var/tmp/taiko-phase2a-20261012/sakura` |

源仓原有 Native/Phase 6 WIP 未并入或覆盖。storage、Writer、SQL、sync、userdata 格式均未迁移。生产运行树与 Viewer 0.81.12 未修改，没有部署、重启、生产安装或数据库连接。

## Parity

旧路径采用冻结且未修改的八个 P0 runtime 源码模块，SHA256 固定。旧 dani_progress 与 Sakura `cc66b220` 的文件字节相同；score_calculator 为已接受 P0 文件 `8f3e9a7d…`，保留 dynamic-rate bridge。未以 Native WIP 代替旧行为。

同一公开曲库 fixture 加合成成绩（30 条成绩及三曲已到达的标准化 dojo 结果），未复制玩家 userdata。32 个外部图片/字体资源固定 SHA256，未提交 Git。环境为 Python 3.11.4、Pillow 11.3.0、Core 0.1.1、Contract 0.1.0。

| 用例 | dynamic-rate | PNG 尺寸 | 旧 Sakura = Application = adapter |
| --- | --- | --- | --- |
| 2025 六段，30 条成绩 | true；三曲维度分配均存在 | 1280×2004 | PASS |
| 2025 六段，3 条成绩 | false | 1280×2004 | PASS |
| 空成绩 | false | 1280×1836 | PASS |
| 无 userdata | 不适用 | 1280×720 | PASS |

比较完整目标分配、展示 section 内容，以及 PNG 编码字节、解码像素、尺寸和 mode。六组命令解析通过；实际 dani_overview 导入兼容检查通过。2025 六段如调用 scoreline loader，测试会失败，验证没有引入该刷新副作用。

动态六段 PNG SHA256：`474e31251e977817840770198769d5b63d8ef9228414ffd48629992f2b2fc4df`；像素 SHA256：`50b8d98eb9797fd021c57f16641779b35c598c3ea890a8149e94daf05dc84890`。

真实 wheel 安装到独立 `/var/tmp` target，在非 Sakura cwd 下运行；禁止宿主/SQL/网络依赖及所有文件写入，仍生成相同动态六段 PNG，exit 0。没有改变生产虚拟环境。

- [完整 parity 结果](/var/tmp/taiko-phase2a-20261012/final-parity/parity.json)：4/4 PASS，命令解析 6/6 PASS。
- [复现说明与测试入口](/var/tmp/taiko-phase2a-20261012/application/packages/taiko-application/README.md)：测试、合成 fixture、reference/资源 hash 已提交；旧源码和资源留在同级任务目录。
- wheel：`/var/tmp/taiko-phase2a-20261012/wheels/taiko_application-0.1.0-py3-none-any.whl`，SHA256 `733dab9a52c5b8a971e087cb1c49aa762d56a93cdabc4aaeff68b4ebaf6c4665`。
- QA 经既有 `scripts/memory/run_qa.sh` 隔离执行。最终 parity 16.379 秒，最大 RSS 101,320 KiB，memory.events high/max/oom/oom_kill 均为 0；内核未提供 memory.peak，不宣称测得 cgroup 峰值。独立安装测试最大 RSS 73,052 KiB。

## 验收边界

验证的是段位展示 fixture 等价与独立安装调用，没有运行完整 Bot 会话或生产在线验收。原来读取真实数据的批量回归未运行，不声称全量测试通过。adapter 是待安装新包后使用的功能分支候选，尚未上线。

没有继续其他 migrate-now 项、年度模块、Phase 6、存储或平台重构。Boundary Audit 保留为历史审计快照，本报告记录随后仅 Phase 2A 的实施结果。
