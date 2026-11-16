import { shallowRef } from 'vue'

/**
 * 减少动效（D13）。
 *
 * `prefersReducedMotion` —— 只读的响应式 ref：系统设置 `prefers-reduced-motion: reduce`
 * 或原型开关（根元素 `data-motion="reduce"`）任一成立即为 true。全站单例，随两者变化自动更新。
 *
 * `scrollBehavior()` —— 'auto' | 'smooth'，给 scrollTo / scrollIntoView 用：减少动效时不平滑滚动。
 *
 * 用法：
 *   import { prefersReducedMotion, scrollBehavior } from '../motion'
 *   el.scrollIntoView({ behavior: scrollBehavior(), block: 'nearest' })
 *   <EmptyLane v-if="..." />  // 组件内部用 prefersReducedMotion.value 选择静止形态
 */
const hasWindow = typeof window !== 'undefined'
const mq = hasWindow && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
const root = hasWindow ? document.documentElement : null

function compute() {
  return Boolean((mq && mq.matches) || (root && root.dataset.motion === 'reduce'))
}

export const prefersReducedMotion = shallowRef(compute())

function update() {
  prefersReducedMotion.value = compute()
}

if (mq) {
  if (mq.addEventListener) mq.addEventListener('change', update)
  else if (mq.addListener) mq.addListener(update)
}
if (root && typeof MutationObserver !== 'undefined') {
  new MutationObserver(update).observe(root, { attributes: true, attributeFilter: ['data-motion'] })
}

export function scrollBehavior() {
  return prefersReducedMotion.value ? 'auto' : 'smooth'
}
