// 浮层（Sheet、命令面板）共用的焦点管理：打开时把 Tab / Shift+Tab 限制在浮层内，关闭时把焦点还给打开它的元素。
const SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function focusables(root) {
  if (!root) return []
  return [...root.querySelectorAll(SELECTOR)].filter((el) => el.getClientRects().length > 0)
}

export function trapTab(e, root) {
  if (e.key !== 'Tab' || !root) return
  const list = focusables(root)
  if (!list.length) {
    e.preventDefault()
    return
  }
  const first = list[0]
  const last = list[list.length - 1]
  const active = document.activeElement
  if (!root.contains(active)) {
    e.preventDefault()
    ;(e.shiftKey ? last : first).focus()
  } else if (e.shiftKey && active === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

export function restoreFocus(el) {
  if (el && el.isConnected && typeof el.focus === 'function') el.focus({ preventScroll: true })
}
