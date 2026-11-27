import { shallowRef } from 'vue'

/**
 * 断点（D9）：只用三个 —— 手机 ≤ 767、平板 768–1099、桌面 ≥ 1100、宽屏 ≥ 1240。
 * CSS 里写 `@media (max-width: 767px)` / `(max-width: 1099px)` / `(max-width: 1239px)`；
 * 脚本里需要判断时用这里的响应式 ref（全站单例，随窗口变化更新）。
 *
 *   import { isMobile, isTablet, isWide } from '../breakpoints'
 *   if (isMobile.value) ...
 */
export const BP = Object.freeze({ mobile: 767, tablet: 1099, desktop: 1239 })

function watchQuery(q) {
  if (typeof window === 'undefined' || !window.matchMedia) return shallowRef(false)
  const mq = window.matchMedia(q)
  const r = shallowRef(mq.matches)
  const on = (e) => (r.value = e.matches)
  if (mq.addEventListener) mq.addEventListener('change', on)
  else if (mq.addListener) mq.addListener(on)
  return r
}

/** ≤ 767px */
export const isMobile = watchQuery(`(max-width: ${BP.mobile}px)`)
/** 768–1099px */
export const isTablet = watchQuery(`(min-width: ${BP.mobile + 1}px) and (max-width: ${BP.tablet}px)`)
/** ≥ 1240px */
export const isWide = watchQuery(`(min-width: ${BP.desktop + 1}px)`)
