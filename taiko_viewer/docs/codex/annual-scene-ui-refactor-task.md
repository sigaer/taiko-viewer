# 年度总结 Scene-based UI 重构迁移计划

## 1. 范围与约束

本计划只定义设计系统接入和后续实施阶段。本次文档提交不修改 Vue/TypeScript/CSS、summary v4、后端统计、路由、缓存、版本号或部署状态。

实施时以 `docs/design-system/annual-summary-master.md` 为最高设计输入。`frontend-design` 用于保持项目辨识度，`ui-ux-pro-max` 只做定向 UX/可访问性/动效/技术栈校验；禁止用其自动生成的 landing page 设计系统覆盖现有文档，禁止未经用户授权执行 `--persist`/`--force`。

后续第一轮页面实现仅允许覆盖：

1. Opening
2. Profile
3. Overview
4. Favorite Song
5. Final Title

其余年度页面保持业务可用，待五页验证 Scene-based 范式后再分批迁移。禁止一次性重写 23 页。

## 2. 当前代码地图

以下路径均相对于 `taiko_viewer/`。

### 2.1 入口、播放器与注册

| 职责 | 当前文件 | 当前行为 |
| --- | --- | --- |
| 年度总结页面入口 | `pages/account/version-summary.vue` | 加载 summary、控制开始前状态/抽屉并挂载播放器 |
| 故事播放器 | `components/account/version-summary/StoryPlayer.vue` | 纵向 scroll snap、导航、音频、活动页识别、特殊转场 |
| 页面注册 | `composables/useAnnualPages.ts` | 23 页组件、可见条件、章节、mood、intensity、进出场 key |
| 通用页面壳 | `components/account/version-summary/StorySlideShell.vue` | 通用页头、frame/body、`AnnualScene` 包装和 timeline |
| 场景容器 | `components/account/version-summary/AnnualScene.vue` | background/atmosphere/visual/data/copy 五个插槽及默认内容层 |
| 通用演出 | `composables/useAnnualTimeline.ts` | 按 title/visual/data/copy 建立通用 GSAP 时间轴 |
| 进度导航 | `components/account/version-summary/StoryProgress.vue` | 章节与页面进度选择 |
| period/overview 特殊场景 | `components/account/version-summary/AnnualPeriodOverviewScene.vue` | 单一 3D 封面流、受控 1600ms 转场和两页文案 |
| 特殊转场常量 | `utils/annualTransition.ts` | 时长、clamp 和转场关键时间 |
| 封面时钟/流 | `utils/annualCoverClock.ts`, `utils/annualCoverFlow.ts` | 封面相位与几何计算 |
| 年度数据呈现工具 | `utils/annualPresentation.ts` | 有效数字、有效文本、grapheme 分段 |

### 2.2 当前 23 页组件

所有页面组件位于 `components/account/version-summary/slides/`：

| 顺序 | page key | 文件 |
| ---: | --- | --- |
| 1 | `opening` | `OpeningSlide.vue` |
| 2 | `profile` | `ProfileSlide.vue` |
| 3 | `period` | `PeriodSlide.vue` |
| 4 | `overview` | `OverviewSlide.vue` |
| 5 | `favorite` | `FavoriteSongSlide.vue` |
| 6 | `obsession` | `ObsessionSongSlide.vue` |
| 7 | `favoriteShift` | `FavoriteShiftSlide.vue` |
| 8 | `keyword` | `KeywordSlide.vue` |
| 9 | `ratingRank` | `RatingRankSlide.vue` |
| 10 | `monthly` | `MonthlyFavoritesSlide.vue` |
| 11 | `weekday` | `WeekdayActivitySlide.vue` |
| 12 | `calendar` | `CalendarActivitySlide.vue` |
| 13 | `timeOfDay` | `TimeOfDaySlide.vue` |
| 14 | `lateNight` | `LateNightSlide.vue` |
| 15 | `speedProfile` | `SpeedProfileSlide.vue` |
| 16 | `nearDondaful` | `NearDondafulSlide.vue` |
| 17 | `challenge` | `ChallengeSlide.vue` |
| 18 | `pound` | `PoundSlide.vue` |
| 19 | `highScore` | `HighScoreSlide.vue` |
| 20 | `milestones` | `MilestonesSlide.vue` |
| 21 | `breakthrough` | `BreakthroughSlide.vue` |
| 22 | `final` | `FinalTitleSlide.vue` |
| 23 | `poster` | `PosterSlide.vue` |

本轮五个目标页的准确映射：

| 设计文档名称 | 当前组件 |
| --- | --- |
| OpeningPage | `components/account/version-summary/slides/OpeningSlide.vue` |
| ProfilePage | `components/account/version-summary/slides/ProfileSlide.vue` |
| OverviewPage | `components/account/version-summary/slides/OverviewSlide.vue`，实际画面由 `AnnualPeriodOverviewScene.vue` 提供 |
| FavoriteSongPage | `components/account/version-summary/slides/FavoriteSongSlide.vue` |
| FinalTitlePage | `components/account/version-summary/slides/FinalTitleSlide.vue` |

### 2.3 页面挂载与切换边界

`StoryPlayer.vue` 当前已经具备应保留的性能基础：

- 23 个 slide 外壳保留滚动高度，但只在 `Math.abs(activeIndex - index) <= 1` 时挂载组件。
- 非当前页设置 `aria-hidden=true` 和 `inert`，组件接收 `active=false`。
- `activeIndex` 由 scroll position、按钮、键盘和触控手势统一驱动。
- period 与 overview 相邻切换时由 overlay 挂载 `AnnualPeriodOverviewScene`，GSAP 驱动 `transitionTime`，结束后再提交真实页面位置。
- `?transitionTime=` 开发调试入口可以定格特殊转场。
- `prefers-reduced-motion` 与 `saveData` 合并为 `reducedMotion` 下发页面。
- BGM、鼓点声音、页面可见性、pagehide/pageshow、路由离开已有集中生命周期。

需在后续补强：全局封面 RAF 当前不随 `document.hidden` 和活动场景完全停表；scene 自身的 timer/循环要统一登记和暂停，避免只依赖 CSS `animation-play-state`。

## 3. 可保留组件与能力

### 3.1 原样或小幅扩展后保留

- `StoryPlayer.vue`：继续作为唯一总容器和导航/音频所有者。
- `useAnnualPages.ts`：继续作为唯一页面注册源，在原配置上增加 `sceneType`、`mainFocus` 和 motion preset，不新建第二份 registry。
- `AnnualPeriodOverviewScene.vue`：保留原 3D 旋转几何、单一封面通道和受控时间；仅重构内部语义层和视觉层级。
- `AnnualVerticalCoverStream.vue`：继续服务 Opening/period/overview 的封面运动关系。
- `AnnualOpeningCarousel.vue`、`AnnualOpeningFireworks.vue`、`AnnualOpeningBeatLane.vue`：保留开屏资产能力，接入新 lifecycle 和编排。
- `AnimatedNumber.vue`：保留本地化、受控 progress、完成回调，补 generation/反馈契约。
- `TaikoRipple.vue`：保留触发序号和完成事件，纳入 transition layer。
- `ParticleLayer.vue`：保留确定性 DOM 粒子，补 saveData 与反馈 burst 模式。
- `AnnualDrumWindow.vue`：作为太鼓/玩家形象对象保留，不再自动置于卡片中。
- `AnnualArtworkFallback.vue`：继续承担缺失曲绘兜底。
- `AnnualPoster.vue`、`PosterSlide.vue`：本轮不重做，保留服务端 PNG、下载和分享链路。
- `utils/annualPresentation.ts`：继续统一有效数字、文本与 grapheme 处理。

### 3.2 兼容保留但不再扩展为主范式

- `StorySlideShell.vue`：暂时服务未迁移的 18 页，不能被目标五页继续当作默认构图。后续应收缩为 legacy adapter 或只提供 chrome/safe-area 能力。
- `useAnnualTimeline.ts`：未迁移页继续使用；新场景改用 scene preset/可控 timeline 后逐步收敛，避免长期同时维护两套通用入场协议。
- `StoryRadarChart.vue`、`StoryCounter.vue` 等统计组件：以后作为 Pattern Scene 内的视觉 primitive，而不是卡片内容。

## 4. 需要废弃的卡片式结构

“废弃”指后续目标页不再使用其布局角色，不要求本次文档提交删除代码。

### 通用壳

`StorySlideShell.vue` 当前固定的 `header + frame + body` 会让所有页面共享同一报告版式；其 deep selector 还会把 `article`、`__panel`、heat/bars/clock 统一染成浅蓝卡片。这一套不能继续作为 Scene-based 页面主体。

后续处理：保留未迁移页兼容，目标页直接使用扩展后的 `AnnualScene`，页面标题进入 `CopyLayer`，不再占据固定页头。

### Profile

`ProfileSlide.vue` 的 `profile-slide__facts article` 是称号/段位资料卡组合。它们应改为围绕玩家形象的弱字幕或舞台铭牌，玩家形象成为唯一主角。

### Favorite Song

`FavoriteSongSlide.vue` 的 `song-slide__panel`、`song-slide__metric` 和 chips 将曲绘、歌名、次数拆成独立卡片。应重构为曲绘主场景，歌名贴合曲绘，次数作为一次数据爆点。

### Final Title

`FinalTitleSlide.vue` 的 `final-title-slide__panel`、mini evidence panel 和三格 metrics 延续了卡片堆叠。应让称号直接占据舞台中心，玩家形象、依据和数据只作为逐层点亮的证据。

### Overview

Overview 当前没有走 `StorySlideShell`，这点应保留。`AnnualPeriodOverviewScene.vue` 中辅助 facts 应继续弱化为空间字幕/轨迹数据，不能恢复统计卡或成就网格。

### Opening

Opening 已直接使用 `AnnualScene`，封面、烟花、音符轨道和太鼓按钮可以保留。需要改的是场景主次与 timeline，不应退回通用卡片壳。

## 5. AnnualScene 接入方案

### 5.1 单一架构演进

项目已经存在 `AnnualScene.vue`，不新建同名平行目录。后续在现有组件上扩展：

```text
AnnualScene
├── background       -> BackgroundLayer
├── atmosphere       -> AtmosphereLayer
├── visual           -> MainObjectLayer
├── data             -> DataFocusLayer
├── copy             -> CopyLayer
├── transition       -> TransitionLayer（新增）
└── default          -> 仅保留兼容内容，不作为新页面主构图
```

实现时可以先用语义插槽和 class 完成，无需为了形式立刻拆出六个只有一层 div 的 Vue 文件。只有当 layer 需要独立 props、lifecycle 或复用逻辑时再拆组件。

### 5.2 Props 与上下文

目标契约：

```ts
type AnnualSceneProps = {
  active: boolean
  reducedMotion: boolean
  sceneType: 'hero' | 'impact-number' | 'song-memory' | 'pattern' | 'award'
  mainFocus: string
  mood: string
  intensity: 'low' | 'medium' | 'high'
  transitionIn: string
  transitionOut: string
}
```

`saveData` 不由每个页面各自读取，继续由播放器或统一 motion context 下发。`AnnualScene` 暴露根节点给 timeline composable，并用 data attributes 提供可测试的 scene 元信息。

`profile-stage` 是本次设计系统新增 mood。Phase 1 必须同步扩展 `AnnualSceneMood` union、registry 配置和播放器/场景 CSS mood 映射；如果实现前决定复用 `stage-blue`，应先统一修改设计文档，不能让文档值与 TypeScript 类型长期分叉。

### 5.3 Registry 接入

在现有 `ANNUAL_PAGE_REGISTRY` 上增量增加：

- `sceneType`
- `mainFocus`
- `motionPreset` 或等价配置

现有 `bgMood` 在 Phase 1A 直接收敛为 `mood`，不保留双字段；`intensity`、`transitionIn/Out` 继续作为场景配置。页面 visible 条件和 23 页顺序不动。

### 5.4 Timeline 接入

Phase 1 新建或扩展统一 composable，使它：

- 以场景根节点为 GSAP context。
- 支持 `establish/cue/reveal/impact/resolve/breathe` 阶段和页面 preset。
- `active=false` 暂停全部主/循环动画。
- summary/root 变化时 kill/revert，再建立单一 timeline。
- reduced motion/saveData 直接设置终态。
- 为受控 Overview 提供 progress 绑定，不另启独立时钟。

旧 `data-annual-stage=title/visual/data/copy` 在未迁移页继续兼容；新场景使用更明确的 layer/preset target，迁移完成后再决定是否删除旧协议。

## 6. 迁移阶段

每个 Phase 独立提交、独立验证，前一阶段验收通过后再进入下一阶段。

### Phase 1：AnnualScene 架构和基础 motion primitives

交付：

- 扩展现有 `AnnualScene.vue` 的六层语义、transition layer、scene metadata 和 activity 状态。
- 扩展现有 registry，新增 `sceneType`、`mainFocus`、motion preset；页序和 visible 条件不变。
- 建立统一 scene timeline lifecycle，兼容未迁移页的 `useAnnualTimeline`。
- 补齐 `AnimatedNumber`、`TaikoRipple`、`ParticleLayer` 的 active/generation/saveData/cleanup 契约。
- 定义 `profile-spotlight`、`number-impact`、`cover-gather`、`award-reveal` 基础 preset。
- 为 preset 定义 `reenter` 策略、可中断终态和完成 watchdog；业务导航不依赖动画完成事件才能正确执行。
- 建立语义颜色、焦点、44px 触控和 8px 间距 tokens，并让固定 chrome 为焦点预留可见空间。
- StoryPlayer 翻页后维持可预测焦点/读屏顺序，任何时刻焦点不得停留在 `inert` slide。

不做：不改五个页面具体构图，不迁移其他页面。

验收：现有 23 页可运行；period-to-overview debug 不变；非活动页无运行中的 timeline/粒子；reduced motion 直达终态；快速中断和完成回调丢失不影响导航与焦点。

### Phase 2：OpeningPage + ProfilePage

Opening 交付：

- 保留封面墙、烟花、音符轨道和视觉资产。
- 将中央太鼓确立为入口落点，标题/年份/CTA 按完整舞台 timeline 出现。
- 点击锁定，`taiko-ripple` 完成后仅导航一次。

Profile 交付：

- 从资料卡改为玩家登场 Hero Scene。
- 玩家形象占据唯一主视觉，使用 `profile-spotlight`。
- 姓名、称号、段位降为舞台字幕/证据；无效项不保留空位。

验收：两页无主卡片布局；快速点击、离页、返回、reduced motion 均不叠加动画。

### Phase 3：OverviewPage + FavoriteSongPage

Overview 交付：

- 保留 `AnnualPeriodOverviewScene` 和单一 `AnnualVerticalCoverStream`。
- `playCount` 成为绝对主角，并完全受现有 `transitionTime` 控制。
- 辅助数据按节拍点亮，不构成统计卡；主数字完成仅反馈一次。

Favorite Song 交付：

- 从“曲绘卡 + 信息卡 + metric 卡”改为 Song Memory Scene。
- 曲绘为第一主视觉，歌名和次数围绕曲绘出现。
- 缺歌、缺图、无有效次数和长中日文名称均有自然兜底。

验收：Overview 的 0ms/中间/1600ms 定格连续；Favorite Song 无卡片拼接感和文字溢出。

### Phase 4：FinalTitlePage

交付：

- 保留深色金色颁奖氛围，称号成为全屏唯一主角。
- 玩家形象 -> 称号逐 grapheme -> 依据文案 -> 有效数据 -> CTA 依次出现。
- CTA 只调用现有 `next` 导航进入 Poster，不生成海报、不创建分享。
- Poster 服务端 PNG、下载和分享流程保持不变。

验收：称号不再包在信息卡中；无效数据不显示；CTA 时序正确且没有新增 API 调用。

### Phase 5：anti-patterns 自查和移动端性能

交付：

- 按 `docs/design-system/annual-summary-anti-patterns.md` 对五页逐项审查。
- 检查 `390x844`、`720x1568`、`844x390`，覆盖中日文、最长歌名、缺失图片和缺失数字。
- 检查 200%/400% 缩放、320 CSS px 等效宽度、最大系统文字和用户文字间距覆盖；单屏不足时验证紧凑/滚动态，无核心内容裁切。
- 对实际 mood 和曲绘 scrim 进行对比度检查：正文至少 4.5:1，大字、有意义图形、控件边界和焦点状态至少 3:1。
- 检查全部主要触控目标至少 44x44 CSS px、间距至少 8px，固定 chrome/safe area 不遮挡焦点，滑动有按钮与键盘替代。
- 检查 `prefers-reduced-motion`、saveData、浏览器后台、快速往返和相邻页挂载。
- 检查静音、自动播放拒绝、后台切换和路由离开；声音不作为唯一反馈且不会离屏残留。
- 检查快速反向、重复点击、完成事件丢失和路由离开；动画可取消且最终状态确定。
- 使用 transition debug 检查 Overview 三个关键时间点。
- 运行年度契约测试、目标 E2E 和生产构建。

验收：五页不能被识别为 dashboard/card-grid；移动端无持续高负载、横向滚动、遮挡或离屏动画。

## 7. 提交与发布策略

- 每个 Phase 小步提交，不跨阶段混合大量页面实现。
- 实现阶段每次提交只暂存本阶段相关文件，继续保护现有未跟踪文档、图片、GIF 和参考视频。
- 只有涉及运行中 viewer 的代码改动才按仓库规则升级 `package.json`、构建、推送和重启服务。
- 本次仅新增文档，不升级版本、不构建、不部署。

## 8. 完成定义

第一轮完成不等于 23 页全部迁移。完成定义是：五个目标页证明同一 `AnnualScene` 架构可以承载五种不同的叙事场景，同时保留现有数据与播放器契约，并为其他页面提供可复用但不模板化的迁移路径。
