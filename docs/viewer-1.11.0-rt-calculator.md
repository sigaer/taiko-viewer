# Viewer 1.11.0 单曲 RT 计算器

入口：`/tools/rt-calculator`、工具首页、桌面侧栏及歌曲详情。公开使用，无需登录，不读写个人成绩。

- 以歌曲 ID 和难度档位选取定数，V1 支持魔王/里魔王，V2 支持困难/魔王/里魔王。
- 输入良、可、不可；默认根据可和不可补齐良，也可补齐其他判定或手动输入全部判定。合计必须等于当前版本的谱面音符数。
- 实时显示综合 RT、精度与六维；提供全良操作。低于 75% 精度时提示不计入 Rating，不显示有效 RT。
- V1 复用当前 structured 定数表及谱面参数。V2 复用 Viewer 的 OurTaiko 定数服务及现有家用机补充数据。
- 浏览器数值实现对应 `sakura_taiko_core.rating.v1`、`dimension.v1`、`rating.v2`。V2 使用中心端 `v2-center-20261010`，精度维度按该 Profile 计算，不混用客户端 Profile。
- 保留计算精度，展示四位小数；这些结果是单谱成绩的 RT，不是玩家 Top20 聚合 Rating。

验证：`tests/rtCalculator.test.mjs` 五项通过，包含 80 组分段边界、密度分支及真实公开曲库样例，与实际安装的 Core 对比两版本各七项得分，容差 `1e-8`。判定补齐、非法总数、小数、75% 门槛、V2 不可率惩罚及曲目身份筛选均已覆盖。修改的四个 Vue 组件完成编译检查。

线上只读烟测脚本：`scripts/verify_rt_calculator_browser.mjs`，通过仓库 `scripts/memory/run_qa.sh` 启动；验证真实 API、输入、版本切换、选曲、移动端、暗色及日文。
