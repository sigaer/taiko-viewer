// 曲绘懒加载（docs/16 A1）：全站共用一个 IntersectionObserver，进入视口前 320px 开始加载。
// 每个元素只回调一次（进入后即停止观察）；组件卸载时 unobserve。

const MARGIN = '320px 0px'
let io = null
const cbs = new WeakMap()

function ensure() {
  if (io || typeof IntersectionObserver === 'undefined') return io
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        const cb = cbs.get(e.target)
        io.unobserve(e.target)
        cbs.delete(e.target)
        if (cb) cb(e.boundingClientRect.width)
      }
    },
    { rootMargin: MARGIN },
  )
  return io
}

/** 观察 el；进入（视口 + 320px）时调用 cb(显示宽度 px)。返回取消函数。 */
export function whenNear(el, cb) {
  const o = ensure()
  if (!o) {
    cb(el.getBoundingClientRect().width)
    return () => {}
  }
  cbs.set(el, cb)
  o.observe(el)
  return () => {
    if (!cbs.has(el)) return
    cbs.delete(el)
    o.unobserve(el)
  }
}

export const COVER_BASE = 'https://static.sakura-bot.cn/cover/'
export const COVER_V = '0841'
