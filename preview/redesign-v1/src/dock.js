import { onBeforeUnmount, onMounted, watch } from 'vue'

/**
 * 手机详情页的固定底部操作区（F1.3）。
 * 外壳只提供一个变量 --shell-bottom（底栏可见时 = 底栏高度 + 安全区，隐藏时 = 安全区，见 base.css）；
 * 页面的固定条用它定位，并把自己的实际高度写进 --dock-h，供外壳给正文留白、提示条避让。
 *
 *   const bar = ref(null)
 *   useDock(bar)            // bar 是固定条元素（模板 ref）
 *
 * 卸载时清掉变量与观察器。
 */
let dockOwner = 0
export function useDock(elRef) {
  const root = document.documentElement
  const id = ++dockOwner
  let ro = null
  let last = null
  const set = () => {
    if (dockOwner !== id) return
    const el = elRef.value
    // 固定定位元素的 offsetParent 恒为 null，按 display 判断是否显示（桌面上操作条 display: none）
    const h = el && getComputedStyle(el).display !== 'none' ? Math.round(el.getBoundingClientRect().height) : 0
    // 根元素上的自定义属性一变，整页都要重算样式：值不变不写；桌面上（0）不写
    const v = h ? `${h}px` : null
    if (v === last) return
    last = v
    if (v) root.style.setProperty('--dock-h', v)
    else root.style.removeProperty('--dock-h')
  }
  onMounted(() => {
    dockOwner = id // 新页面接管（旧页面的卸载晚于新页面挂载时，也不会把变量清掉）
    set()
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(set)
      if (elRef.value) ro.observe(elRef.value)
    }
    window.addEventListener('resize', set)
  })
  watch(elRef, (el, old) => {
    if (!ro) return
    if (old) ro.unobserve(old)
    if (el) ro.observe(el)
    set()
  })
  onBeforeUnmount(() => {
    ro?.disconnect()
    window.removeEventListener('resize', set)
    if (dockOwner === id && last) root.style.removeProperty('--dock-h')
  })
}

/**
 * 软键盘（F1.5）：用 visualViewport 算出键盘挡住的高度，写进 --kb-h（没有键盘时 0）。
 * 回复框据此贴在键盘上方，并且此时不再叠加安全区。卸载时清理。
 */
export function useKeyboardInset() {
  const root = document.documentElement
  const vv = window.visualViewport
  let last = 0
  const update = () => {
    if (!vv) return
    const covered = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop))
    // 小于 80px 的差值是地址栏收放，不算键盘
    const kb = covered > 80 ? Math.round(covered) : 0
    if (kb === last) return // 值不变不写根元素（避免整页重算样式）
    last = kb
    if (kb) {
      root.style.setProperty('--kb-h', `${kb}px`)
      root.setAttribute('data-kb', '')
    } else {
      root.style.removeProperty('--kb-h')
      root.removeAttribute('data-kb')
    }
  }
  onMounted(() => {
    update()
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
  })
  onBeforeUnmount(() => {
    vv?.removeEventListener('resize', update)
    vv?.removeEventListener('scroll', update)
    if (last) {
      root.style.removeProperty('--kb-h')
      root.removeAttribute('data-kb')
    }
  })
}
