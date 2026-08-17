# 太鼓年度总结动效规范

## 1. 动效职责

动效用于解释场景因果、建立节拍和突出数据，不用于给静态卡片增加装饰。每个动作必须回答至少一个问题：主角如何登场、数据为何在此刻揭示、上一幕如何进入下一幕。

整套动效以“一击，一回声”为签名：一次用户动作或数据落点产生一个清晰因果，后续反馈只延展这一次因果。每页最多有 1 至 2 个关键运动对象，不用粒子数量或连续摇晃制造强度。

## 2. 统一时间轴

标准场景按以下阶段运行：

| 阶段 | 建议时间 | 职责 |
| --- | ---: | --- |
| establish | 0-300ms | 建立背景、光源和前一页继承物 |
| cue | 250-650ms | 出现短标题或情绪提示 |
| reveal | 550-1150ms | 主视觉完成聚合、旋转、聚光或落点 |
| impact | 950-1750ms | 核心数字 count-up 或称号揭示 |
| resolve | 1550-2300ms | 辅助数据和收束文案出现 |
| breathe | 2300ms 后 | 低强度循环，等待用户操作 |

这是节奏区间，不是所有页相同的 CSS 延时表。受控转场如 Overview 必须以现有 `transitionTime` 为唯一时钟。

## 3. 语义 motion primitives

### `taiko-ripple`

- 来源：鼓面落点或明确点击原点。
- 用途：开场导航、数字完成反馈、场景遮罩。
- 规则：一次触发序号对应一次完成事件；导航锁定期间不得重复触发。
- 降级：reduced motion 下快速显示终态并完成导航，不播放多环扩散。

### `number-impact`

- 来源：count-up 到达真实终值。
- 用途：Overview、Favorite Song 和有效证据数据。
- 组成：主对象 1 次轻缩放、局部波纹、4 至 8 个短粒子；不做持续抖动。
- 规则：同一个 value/activation generation 只反馈一次，离屏完成不得触发。

### `cover-gather`

- 来源：散布封面向主曲绘或舞台中心收拢。
- 用途：Opening、Favorite Song。
- 规则：保持曲绘可辨识，最多保留少量近景对象；移动端减少封面数量。

### `cover-spin-in`

- 来源：period-to-overview 的现有 3D 封面通道。
- 用途：Overview 专用继承转场。
- 规则：不改变原始旋转几何、单一 `AnnualVerticalCoverStream` 或 1600ms 总时长；所有新增视觉读取同一 progress。

### `profile-spotlight`

- 来源：舞台光束聚焦玩家形象。
- 用途：Profile、Final Title 的获奖者登场。
- 组成：环境压暗、光域扩展、玩家形象由剪影到清晰、姓名落版。
- 禁止：整张资料卡上浮。

### `award-reveal`

- 来源：颁奖光束或印章落点。
- 用途：Final Title。
- 规则：使用 `Intl.Segmenter` 按 grapheme 逐字出现，保留空格、标点和换行；证据与 CTA 必须等待称号主体完成。

### 后续模板动作

- `radar-draw`：有效维度逐边绘制，不为缺失值补零。
- `speed-dial`：倍速指针或鼓面刻度落位。
- `calendar-light-up`：仅点亮真实有效日期。
- `night-fall`：背景明度和色温进入夜间，避免纯 opacity fade。
- `stamp-hit`：成就印章一次落点，不连续弹跳。

## 4. 五页 timeline 基线

### Opening

背景/烟花蓄势 -> 封面聚合 -> 音符轨道通过 -> 中央太鼓落点 -> 标题分段出现 -> 年份/CTA 到位 -> 点击触发全屏波纹 -> 波纹完成后仅导航一次。

### Profile

舞台压暗 -> 聚光灯打开 -> 玩家形象从剪影变清晰 -> 玩家名出现 -> 称号/段位以低优先级环绕 -> 一句收束文案出现。

### Overview

封面通道随 `transitionTime` 旋转 -> 标题提示 -> `playCount` 受控 count-up -> 终值 `number-impact` -> 歌曲数、谱面数、时长依次点亮 -> 轻呼吸。

### Favorite Song

背景取色建立 -> 曲绘聚合/旋入 -> 歌名沿曲绘出现 -> 有效次数 count-up -> 曲绘轻鼓点反馈 -> 收束文案出现。

### Final Title

金色舞台建立 -> 玩家形象受光 -> 年度称号逐 grapheme 揭示 -> 依据文案出现 -> 有效核心数据依次点亮 -> CTA 最后出现。

## 5. GSAP 与 CSS 分工

- GSAP 负责场景主时间轴、受控进度、对象进出场和需要精确 cleanup 的动画。
- CSS animation 只负责低成本、低强度的循环，如微光、呼吸和少量粒子。
- `AnimatedNumber` 负责数字插值和本地化，不由页面重复实现计数器。
- 页面不得同时用 CSS delay 和 GSAP 独立驱动同一关键对象，以免时间轴漂移。
- 时间点应集中在场景配置或 timeline preset，避免散落在模板内的魔法数字。

## 6. 生命周期

每个 scene timeline 必须遵守：

1. `active=true` 时创建或从明确状态播放。
2. `active=false` 时暂停；循环、RAF、timer 和数字更新同时停止。
3. 再次激活时按产品规则继续或重演，但不能叠加第二条 timeline。
4. 根节点变化、summary 切换或卸载时 `kill/revert`，移除监听器。
5. 浏览器进入后台时暂停全局封面时钟和场景循环，返回后只恢复当前页。
6. transition overlay 与实体页面不能同时各自触发一份完成反馈。

推荐通过 `gsap.context()` 绑定场景根节点，由 composable 统一管理 generation 和 cleanup。

### 6.1 中断与确定性终态

- 动画必须可中断。用户翻页、反向滑动、重复点击或路由离开时，当前 tween 立即取消并写入新状态需要的明确起点/终点，不能依赖 `animationend` 或 `transitionend` 保证业务正确。
- 每个 motion preset 明确 `reenter: resume | restart | final`；同一页面不得由组件自行猜测返回后续播还是重演。默认普通场景 `restart`，受控 Overview 按 `transitionTime` 恢复，已完成的导航使用 `final`。
- 点击后 100ms 内必须有按压或鼓点反馈。场景内的签名转场可以完整演出，但不能冻结全部输入；导航锁只能防重复提交，并保留退出/返回能力。
- 依赖完成回调的导航必须设置同源 watchdog。回调丢失、页面隐藏或 reduced motion 切换时直接提交目标页，不能无限等待波纹。
- 真正的路由离开不等待长演出，退出段应短于进入段并控制在约 250ms；period-to-overview 的 1600ms 是页内受控场景，不套用路由退出上限。

## 7. Reduced motion 与省流量

当 `prefers-reduced-motion: reduce` 或 `navigator.connection.saveData` 生效：

- 标题、主视觉、数字和文案直接处于可读终态。
- count-up 直接显示真实值，完成回调不得制造额外震动。
- 粒子、烟花、封面持续流和呼吸循环关闭。
- 页面导航仍可完成，转场使用极短遮罩或直接切页。
- 不通过把所有 duration 改成 1ms 来制造大量同步 animationend 事件。

## 8. 声音与自动运动

- BGM、鼓点和视觉反馈表达同一事件，但任何结论都必须在无声状态下成立。
- 声音按钮始终可达，暴露 `aria-label` 与 pressed 状态；自动播放被浏览器拒绝时保持静音可用状态，不反复抢占播放。
- 页面失活、`document.hidden`、pagehide 或路由离开时暂停声音；恢复时只由播放器所有者决定是否继续。
- 封面流、烟花和粒子只作为 `aria-hidden` 的氛围，不承载必须阅读的信息；失活、焦点进入需要静止的交互区域或 reduced motion 生效时可暂停。

## 9. 性能预算

- DOM 粒子：桌面 low/medium/high 为 8/16/24；移动端最多 12；反馈 burst 建议最多 8。
- 同时运行的复杂 timeline：仅当前页 1 条，特殊 transition overlay 期间由 overlay 接管。
- 3D 封面：继续复用单一封面流，不复制第二套通道。
- 动画优先使用 transform 和 opacity；避免持续大面积 filter、backdrop-filter 和 layout 属性动画。
- 非活动页不运行动画，即使它仍作为相邻页挂载。
- 主线程逐帧工作以 16ms 为上限，点击到视觉反馈控制在 100ms 内；高频 scroll/resize 读写合并到 RAF，并避免同一帧交错读写布局。

## 10. 验收与调试

- 检查标题 -> 主视觉 -> 核心数据 -> 文案的先后关系。
- 检查数字终值等于 summary 真实值，完成反馈每次激活最多一次。
- 检查快速前后翻页没有残留 timer、声音、粒子或重复 CTA。
- 检查快速反向、重复点击、完成事件丢失和路由离开时都能到达确定终态，焦点不进入 inactive/inert 页面。
- 检查 transition debug 的 0ms、中间点、1600ms 三个状态。
- 检查 reduced motion、saveData、页面后台和相邻页挂载状态。
- 录屏时主角运动应可描述为具体语义动作，而不是“元素依次淡入”。
