// 小尺寸素材（docs/19 G5）：按绘制尺寸选 1× / 2× 资源。缩小版由 qa/tools/gen-small-assets.mjs 生成，
// 放在 public/game/{rank|crown}/{边长}/ 下，WebP（带透明通道）+ 同尺寸 PNG 回退；原图保留在 public/game/{rank|crown}/。
export const SMALL = { rank: [56, 80], crown: [36, 60, 96] }

/** 返回 { webp, png, src }：<picture> 的 WebP srcset、PNG srcset 与 <img src>（PNG 1×）。 */
export function smallSrc(dir, name, draw) {
  const sizes = SMALL[dir]
  const pick = (px) => sizes.find((s) => s >= px) ?? sizes[sizes.length - 1]
  const one = pick(draw)
  const two = pick(draw * 2)
  const p = (s, ext) => `game/${dir}/${s}/${name}.${ext}`
  return {
    webp: `${p(one, 'webp')} 1x, ${p(two, 'webp')} 2x`,
    png: `${p(one, 'png')} 1x, ${p(two, 'png')} 2x`,
    src: p(one, 'png'),
  }
}
