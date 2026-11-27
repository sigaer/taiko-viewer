// 身份原子共用的规则（V6）：段位档次与头像面色。PlayerAvatar、DanBadge 共用，页面不要自己判断档次。

const HIGH = ['十段', '玄人', '名人', '超人', '达人', '達人']
const MID = ['六段', '七段', '八段', '九段']

/**
 * 段位档次：'high'（十段及以上 / 玄人 / 名人 / 超人 / 达人）| 'mid'（六–九段）| 'low'（其余，含级位与初–五段）| null（无段位）
 * @param {string} dan
 */
export function danTier(dan) {
  if (!dan || dan === '—' || dan === '-') return null
  if (HIGH.some((k) => dan.includes(k))) return 'high'
  if (MID.some((k) => dan.includes(k))) return 'mid'
  return 'low'
}

function lumOfHsl(h, s, l) {
  // HSL → sRGB → 相对亮度
  s /= 100
  l /= 100
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(f(0)) + 0.7152 * lin(f(8)) + 0.0722 * lin(f(4))
}

const faceCache = new Map()
/**
 * 头像面色：给定色相，取让白色首字母 ≥ 4.6:1 的最亮的那一档（饱和度固定 45%），返回 CSS hsl()。
 * @param {number} hue 0–360
 */
export function faceColor(hue = 220) {
  const h = ((Math.round(hue) % 360) + 360) % 360
  if (faceCache.has(h)) return faceCache.get(h)
  let l = 46
  while (l > 15 && 1.05 / (lumOfHsl(h, 45, l) + 0.05) < 4.6) l -= 1
  const c = `hsl(${h} 45% ${l}%)`
  faceCache.set(h, c)
  return c
}
