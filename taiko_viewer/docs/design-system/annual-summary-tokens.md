# 太鼓年度总结设计 Tokens

## 1. 使用方式

本文档定义 Scene-based 改造的目标 token 契约。本阶段只记录规范，不要求立即改写现有 CSS。后续实现应在年度总结作用域内定义 `--annual-*`，避免覆盖站点通用 `--viewer-*`。

已存在并继续复用：

- `--viewer-font-family`：中日文系统字体栈。
- `--viewer-display-font`：故事布局下使用 `TaikoDisplay` 拉丁字形，并回退到系统中日文字体。
- `font-variant-numeric: tabular-nums`：数字稳定宽度。

不新增网络字体或大型视觉依赖。

## 2. 颜色

### 基础中性色

| Token | 值 | 用途 |
| --- | --- | --- |
| `--annual-ink-strong` | `#13233d` | 明亮场景主标题 |
| `--annual-ink` | `#294766` | 正文和弱标题 |
| `--annual-ink-muted` | `#6f8195` | 辅助标签 |
| `--annual-paper` | `#f8fbff` | 必要的亮色文字/薄层 |
| `--annual-night` | `#081329` | 深色舞台底 |
| `--annual-night-soft` | `#17254a` | 深色舞台层次 |

### 太鼓与节奏色

| Token | 值 | 用途 |
| --- | --- | --- |
| `--annual-don` | `#ef5d52` | 鼓点、主反馈 |
| `--annual-ka` | `#45a8dd` | 节拍轨道、辅助反馈 |
| `--annual-festival-yellow` | `#f5c95f` | 祭典灯光 |
| `--annual-festival-green` | `#5fc99a` | 彩色节奏点 |
| `--annual-festival-violet` | `#8b79d6` | 封面光谱辅助色 |

### 颁奖色

| Token | 值 | 用途 |
| --- | --- | --- |
| `--annual-gold-bright` | `#ffe9a6` | 称号高光 |
| `--annual-gold` | `#e5b84e` | 奖项主色 |
| `--annual-gold-deep` | `#8e6723` | 暗部和边缘 |

### 场景 mood

Mood 是多色关系，不是一张铺满全页的单色渐变：

| Mood | 背景关系 | 强调色 |
| --- | --- | --- |
| `rainbow-stage` | 深夜蓝 + 舞台天蓝 + 局部彩色灯 | don/ka/yellow |
| `profile-stage` | 深蓝暗场 + 冷白聚光 + 玩家装扮原色 | ka/don |
| `bright-impact` | 近白中心光 + 蓝色空间层 + 金色落点 | ink/don/yellow |
| `cover-spectrum` | 曲绘提取色 + 深色遮罩 + 高对比原图 | 由曲绘决定 |
| `time-blue` | 清晨蓝、日光白、夜色蓝的时间关系 | ka/violet |
| `midnight` | night + violet + 少量冷光 | ka/gold |
| `award-stage` | night + gold spotlight + black edge | gold-bright/don |

禁止将 `#f7fbff -> #e5f1ff` 作为所有页面默认成品背景。

## 3. 字体层级

字号采用离散 token 和断点覆盖，不按 viewport 宽度连续缩放。

| Token | 竖屏手机 | 大竖屏/桌面 | 用途 |
| --- | ---: | ---: | --- |
| `--annual-type-display` | `3.5rem` | `6rem` | 单一核心数字/年度称号 |
| `--annual-type-hero` | `2.25rem` | `4rem` | 开场标题 |
| `--annual-type-title` | `1.75rem` | `2.75rem` | 场景标题 |
| `--annual-type-object-label` | `1.25rem` | `1.75rem` | 歌名/玩家名次级档 |
| `--annual-type-body` | `0.875rem` | `1rem` | 收束文案 |
| `--annual-type-meta` | `0.6875rem` | `0.75rem` | 单位、页码、辅助标签 |

规则：

- 核心数字与标题不可同时使用 display 档。
- 中日文标题行高 1.08 至 1.2；数字行高 0.88 至 1。
- 字距默认 `0`；仅短英文元信息可使用不超过 `0.08em` 的正字距。
- 长歌名按 grapheme 长度分为 normal/compact/long 三档，并允许自然换行。

## 4. 间距与安全区

| Token | 值 |
| --- | ---: |
| `--annual-space-1` | `4px` |
| `--annual-space-2` | `8px` |
| `--annual-space-3` | `12px` |
| `--annual-space-4` | `16px` |
| `--annual-space-5` | `24px` |
| `--annual-space-6` | `32px` |
| `--annual-space-7` | `48px` |
| `--annual-space-8` | `64px` |

场景安全内边距：

```css
padding-block-start: max(var(--annual-space-4), env(safe-area-inset-top));
padding-block-end: max(var(--annual-space-4), env(safe-area-inset-bottom));
padding-inline: var(--annual-space-4);
```

播放器固定控件占用区域必须纳入页面构图，不得通过额外空卡或大页头规避。

## 5. 尺寸与形状

- `--annual-scene-height`: `100dvh`，以 `100svh` 作为兼容声明。
- `--annual-touch-target`: `44px`，紧凑横屏不得小于 `40px`。
- `--annual-radius-sm`: `4px`。
- `--annual-radius-md`: `8px`。
- `--annual-radius-round`: `999px`，仅用于鼓面、圆形按钮、徽章和轨迹。
- 曲绘使用稳定 `aspect-ratio: 1`；海报使用现有 `3 / 4`。
- 主对象尺寸用容器和断点约束，不因标签、hover 或数字位数改变布局。

## 6. 光、阴影和边界

场景深度来自光源与对象关系，不来自每个容器的阴影：

| Token | 建议值 | 用途 |
| --- | --- | --- |
| `--annual-shadow-object` | `0 24px 56px rgb(5 16 38 / 28%)` | 曲绘、玩家形象 |
| `--annual-glow-don` | `0 0 28px rgb(239 93 82 / 36%)` | 鼓点反馈 |
| `--annual-glow-gold` | `0 0 36px rgb(229 184 78 / 30%)` | 称号/颁奖光 |
| `--annual-hairline-light` | `rgb(255 255 255 / 22%)` | 深色场景少量描边 |

- 禁止给所有文本容器加 `backdrop-filter`、边框和投影。
- 大面积持续 blur 只允许静态低分辨率背景层，移动端优先取消。
- 辅助标签可使用轻描边，但不形成一组同权卡片。

## 7. 层级

| Token | 值 | 内容 |
| --- | ---: | --- |
| `--annual-z-background` | `0` | 背景 |
| `--annual-z-atmosphere` | `10` | 粒子/光 |
| `--annual-z-object` | `20` | 主对象 |
| `--annual-z-data` | `30` | 核心数据 |
| `--annual-z-copy` | `40` | 文案 |
| `--annual-z-transition` | `50` | 页内转场 |
| `--annual-z-chrome` | `80` | 播放器导航 |
| `--annual-z-overlay` | `100` | period-overview 特殊覆盖层 |

所有层保持 `pointer-events:none`，只有明确交互控件恢复 pointer events。

## 8. Motion tokens

| Token | 值 | 用途 |
| --- | ---: | --- |
| `--annual-duration-hit` | `180ms` | 鼓点缩放 |
| `--annual-duration-enter` | `520ms` | 单对象登场 |
| `--annual-duration-reveal` | `760ms` | 波纹/主视觉揭示 |
| `--annual-duration-count` | `900ms` | 默认 count-up |
| `--annual-duration-scene` | `2300ms` | 标准场景演出窗口 |
| `--annual-ease-out` | `cubic-bezier(.2,.8,.2,1)` | 自然落位 |
| `--annual-ease-impact` | `cubic-bezier(.18,.82,.24,1)` | 波纹/冲击 |

特殊 period-to-overview 继续使用现有 1600ms 常量，不被通用 token 覆盖。

## 9. 粒子预算

- low: 8，medium: 16，high: 24。
- 移动端硬上限 12；一次性反馈 burst 上限 8。
- reduced motion、saveData 或页面非活动时为 0 个运行粒子。
- 粒子颜色必须来自当前 mood，不得成为无关装饰。
