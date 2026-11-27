import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * useHScroll(wrapRef, tableRef?) —— 表格在面板内横滑时的状态（V11 / I13）。
 *
 *   overflow   表格比容器宽（需要横滑；视图据此打开 overflow-x 与首列固定）
 *   moreRight  右侧还有没露出来的内容（视图给外层加 .hs-more，base.css 画右缘渐隐）
 *
 * 用一个被动 scroll 监听 + ResizeObserver，不依赖 scroll-driven animation（兼容性）。
 * wrapRef 可以在 v-if 里出现 / 消失；监听在卸载时清理（R6）。
 *
 * 模板：
 *   <div class="hs" :class="{ 'hs-more': moreRight }">
 *     <div ref="wrap" class="panel tablewrap" :class="{ overflow }"><table ref="table">…</table></div>
 *   </div>
 */
export function useHScroll(wrapRef, tableRef = null) {
  const overflow = ref(false)
  const moreRight = ref(false)
  let ro = null
  let el = null
  let raf = 0

  function measure() {
    raf = 0
    const w = wrapRef.value
    if (!w) {
      overflow.value = moreRight.value = false
      return
    }
    const t = tableRef?.value || w.firstElementChild
    const inner = t ? t.offsetWidth : w.scrollWidth
    overflow.value = inner > w.clientWidth + 1
    moreRight.value = overflow.value && w.scrollLeft + w.clientWidth < w.scrollWidth - 1
  }
  function schedule() {
    if (!raf) raf = requestAnimationFrame(measure)
  }
  function detach() {
    if (el) el.removeEventListener('scroll', schedule)
    if (ro) ro.disconnect()
    el = null
  }
  function attach(w) {
    detach()
    if (!w) return measure()
    el = w
    w.addEventListener('scroll', schedule, { passive: true })
    if (typeof ResizeObserver !== 'undefined') {
      if (!ro) ro = new ResizeObserver(schedule)
      ro.observe(w)
      nextTick(() => {
        const t = tableRef?.value || w.firstElementChild
        if (t && ro && el === w) ro.observe(t)
        measure()
      })
    }
    measure()
  }

  watch(wrapRef, (w) => attach(w))
  onMounted(() => attach(wrapRef.value))
  onBeforeUnmount(() => {
    detach()
    ro = null
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  })
  return { overflow, moreRight, measure }
}
