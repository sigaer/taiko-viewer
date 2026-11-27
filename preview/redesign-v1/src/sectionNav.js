import { nextTick, onBeforeUnmount, onMounted, ref, toValue, watch } from 'vue'
import { scrollBehavior } from './motion'

/**
 * useSectionNav(ids, options?) —— 页内目录的当前节跟踪（V10 / I11）。账号、设置、开发者共用。
 *
 *   ids       string[] | Ref<string[]> | () => string[]   各节元素的 id，按页面顺序
 *   options   { deps?: WatchSource[], rootMargin?: string }
 *             deps：这些值变化时（例如登录态、申请状态导致各节重新渲染）在下一帧重新观察
 *
 * 返回 { current, scrollTo, refresh }
 *   current   Ref<string>  当前节 id：视口上部（顶栏下方到 45% 高度之间）第一个可见的节
 *   scrollTo(id)           滚到该节（减少动效时不平滑，见 motion.js 的 scrollBehavior），
 *                          立即标为当前节，并把焦点交给节标题（h2，需 tabindex="-1"），不再滚动
 *   refresh()              手动重新观察
 *
 * IntersectionObserver 在卸载时断开（R6）；没有 IntersectionObserver 时 current 保持为第一节。
 *
 * 例：
 *   const NAV = computed(() => [{ id: 'set-look', label: … }, …])
 *   const { current, scrollTo } = useSectionNav(() => NAV.value.map((n) => n.id))
 *   <button :aria-current="current === n.id ? 'true' : undefined" @click="scrollTo(n.id)">
 */
export function useSectionNav(ids, { deps = [], rootMargin = '-96px 0px -55% 0px' } = {}) {
  const list = () => toValue(ids) || []
  const current = ref(list()[0] || '')
  const seen = new Set()
  let io = null
  let alive = true

  function refresh() {
    io?.disconnect()
    io = null
    seen.clear()
    const order = list()
    if (!order.includes(current.value)) current.value = order[0] || ''
    if (!alive || typeof IntersectionObserver === 'undefined' || typeof document === 'undefined') return
    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id)
        const first = list().find((id) => seen.has(id))
        if (first) current.value = first
      },
      { rootMargin },
    )
    for (const id of order) {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    }
  }

  function scrollTo(id) {
    const el = typeof document !== 'undefined' ? document.getElementById(id) : null
    if (!el) return
    el.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
    current.value = id
    el.querySelector('h2')?.focus({ preventScroll: true })
  }

  onMounted(refresh)
  watch([() => list().join('|'), ...deps], () => nextTick(refresh))
  onBeforeUnmount(() => {
    alive = false
    io?.disconnect()
    io = null
  })

  return { current, scrollTo, refresh }
}
