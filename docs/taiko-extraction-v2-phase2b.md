# Taiko Application Extraction — Phase 2B

日期：2026-10-12。状态：**PHASE_2B_COMPLETE**。只完成成绩展示抽取与本阶段验证，完成后停止。没有启动其他 Application 抽取、Phase 6 或平台重构。

## 交付与边界

基于 Phase 2A 的独立功能分支，`taiko-application` 升为 **0.2.0**。Core **0.1.1**、Contract **0.1.0** 的依赖声明及安装版本均未变化，Viewer 生产基线仍为 **0.81.12**。

新增 `taiko_application.score.ScorePresentationContext`，四个 renderer 接收准备好的 context，返回原类型的图片结果：

| 原模块 | Application 实现 | 输出 |
| --- | --- | --- |
| `b30_render` | `B30Renderer` | PNG bytes |
| `b30_single` | `B30SingleRenderer` | PNG bytes；保留可选 Pillow Image 返回 |
| `drawinfo` | `ScoreInfoRenderer` | PNG bytes |
| `recommend_image` | `RecommendationRenderer` | 原有 BytesIO |

Context 携带成绩条目、曲目资料、评级与六维展示值、B30 排序/差值、预备趋势行、更新时间、推荐结果以及外部资料图层。Application 只读取传入的展示资源，不读取 userdata、catalog JSON、history 或数据库，不调用 Writer、sync 或网络。图片资源在请求结束或异常时释放；调用者提供的图片不由 renderer 关闭。renderer 实例按请求使用，不跨并发请求共享。

Sakura 的四个原公开入口保留，准备 context 后委托 Application。command、auth、data loading、message sending 均留 Sakura。原有 Core 调用、daily/history 获取与差值计算、v2 数据获取也留原边界。`draw_dress` 不在抽取范围，其资料/装扮图层仍由宿主提供。没有迁移 userdata/storage、Writer、daily/history、SQL 或 sync，没有改 Core 公式或 Contract。

缺少必需模板时，在进入 v2/daily 获取前保留原错误；缺少可选封面、图标、分类模板和背景时保留原回退输出。原全局布局/字体资源与调用者指定封面资源根的区别由 context 显式保留。

## Parity 验收

冻结的四个旧模块与读取到的 P0 runtime 文件逐一 SHA256 相同。完整旧 renderer 源码未修改；测试没有替换其绘图、文字、皇冠选择、布局或 PNG 编码函数。

Fixture 使用公开曲库向量和合成成绩，不复制玩家数据；41 个外部公开图片/字体资源固定 SHA256，不提交资源包。环境：Python 3.11.4、Pillow 11.3.0、Core 0.1.1、Contract 0.1.0。

| Fixture | b30_render | b30_single | drawinfo | recommend_image |
| --- | --- | --- | --- | --- |
| 普通成绩 | PASS | PASS | PASS | PASS |
| FC | PASS | PASS | PASS | PASS |
| DF | PASS | PASS | PASS | PASS |
| 高评级 | PASS | PASS | PASS | PASS |
| 无成绩 | PASS | PASS | PASS | PASS |
| 缺可选资源 | PASS | PASS | PASS | PASS |

每项均对比 **PNG bytes 的 SHA256、解码 pixel hash、dimensions、mode**，旧 Sakura 与新 adapter 调用 Application 的结果完全一致；同一 context 重复渲染也一致。额外真实 **30 卡 B30** 为 1080×3030 RGBA，parity PASS；矩阵包含更新差值展示。总计 **25/25** 组图片通过。

另对 b30_single、b30_render、drawinfo 检查必需模板完全缺失：均保持 `FileNotFoundError`，且错误前不调用 v2/daily 获取，**3/3 PASS**。

独立 wheel 安装到 `/var/tmp` target，在非 Sakura cwd 重放四个 context：**4/4 PASS**。测试拒绝 Sakura/SQL/网络依赖、所有文件写入和展示资源以外的数据读取；Pillow 自身的字体依赖在开启资源读取限制前完成初始化。没有安装到生产虚拟环境。

Phase 2A 段位回归 **4/4 PASS**、解析 **6/6 PASS**；2025 六段 dynamic-rate PNG hash 仍为 `474e31251e977817840770198769d5b63d8ef9228414ffd48629992f2b2fc4df`。

测试边界明确：daily/历史输入、身份/catalog 获取、v2 数据源与未抽取的 draw_dress 图层由 fixture 提供；评级运算使用固定 Core 函数。没有运行真实 daily/Writer 或完整 Bot 会话，不将此结果称为 draw_dress 集成验收或生产在线验收。高评级单卡/B30 包含 `999.88` 显示 override，以覆盖高数值文本布局。

## 证据与提交

- [成绩 parity 结果及全部 hash](/var/tmp/taiko-phase2b-20261012/final-parity/parity.json)。同目录保留 25 张合成 fixture PNG 和独立重放 context。
- [独立安装结果](/var/tmp/taiko-phase2b-20261012/standalone.json)。
- [Phase 2A 回归结果](/var/tmp/taiko-phase2b-20261012/dani-regression/parity.json)。
- [包说明与复现步骤](/var/tmp/taiko-phase2b-20261012/application/packages/taiko-application/README.md)。测试、fixture 来源及 reference/资源 hash 已进入功能分支。
- wheel：`/var/tmp/taiko-phase2b-20261012/wheels/taiko_application-0.2.0-py3-none-any.whl`，SHA256 `bfdad0d4587f17a34a29d5cad74c68df13408fa80b50258f34be26824f53f728`。

所有 QA 通过既有 `scripts/memory/run_qa.sh` 执行。成绩 parity 43.749 秒、最大 RSS 180,772 KiB；独立重放 1.945 秒、最大 RSS 96,860 KiB；段位回归 16.638 秒、最大 RSS 101,284 KiB。成绩与段位检查记录的 memory.events high/max/oom/oom_kill 均为 0；未宣称测得内核未提供的 cgroup memory.peak。

两个仓库均已提交并推送 `feature/taiko-application-phase2b`，工作树干净，未合并 main：

| 仓库 | 提交 | 独立工作树 |
| --- | --- | --- |
| [taiko-bot](https://github.com/sigaer/taiko-bot/commit/1ed62e62d9d322ef30ddc6efbf70b152530131a5) | `1ed62e6` | `/var/tmp/taiko-phase2b-20261012/application` |
| [Sakura_bot](https://github.com/sigaer/Sakura_bot/commit/582a9ea578c035678f168186074c78d5b8b0a27b) | `582a9ea` | `/var/tmp/taiko-phase2b-20261012/sakura` |

源仓原有 WIP 保留，生产运行树未修改，没有部署、重启、生产包安装或数据库连接。当前交付为已验证的功能分支候选；不授予全量 Application 完成、PLATFORM_COMPLETE 或 1.0_READY 标记。
