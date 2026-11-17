// 游戏数据 → 真实素材的对应关系（docs/16 A2–A4、docs/19 G9）。组件与 src/assets.test.mjs 共用这一处。
// 纯函数，不依赖浏览器。

/** 难度 1–5 → public/game/diff/{d}.png（简单、普通、困难、魔王、魔王（里）） */
export function diffImage(d) {
  return Number.isInteger(d) && d >= 1 && d <= 5 ? `game/diff/${d}.png` : null
}

/** 评价值 → 图片文件名（不含尺寸目录）。2–8 = 白粹 … 极；0 未设置、1 未取得没有图（rank/1.png 是全透明图，不加载）。 */
export function rankFile(v) {
  return Number.isInteger(v) && v >= 2 && v <= 8 ? String(v) : null
}

/** 原型的单值王冠（-1 已游玩 / 0 通关 / 1 全连 / 2 全良 / null 未游玩）→ 图片文件名；已游玩与未游玩没有图。 */
export function crownFile(v) {
  return v === 2 ? 'dondaful' : v === 1 ? 'full' : v === 0 ? 'clear' : null
}

/**
 * 正式站 AccountSongScores.vue 的优先级：全良次数 > 0 → dondaful；否则全连次数 > 0 → full；否则通关次数 > 0 → clear；
 * 有记录但三项都是 0 → 已游玩（-1）；没有记录 → 未游玩（null）。返回原型的单值王冠。
 */
export function crownFromCounts(rec) {
  if (!rec) return null
  if ((rec.dondafulComboCnt || 0) > 0) return 2
  if ((rec.fullComboCnt || 0) > 0) return 1
  if ((rec.clearCnt || 0) > 0) return 0
  return -1
}
