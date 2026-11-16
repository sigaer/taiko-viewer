// In-page check implementations. installQA is serialised by Playwright and evaluated in the
// page, so it must be fully self-contained (no closures over module scope).
export function installQA() {
  if (window.__QA) return true
  const INTERACTIVE = 'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=option], [role=menuitem], [role=checkbox], [role=switch]'

  function sel(el) {
    if (!el || el.nodeType !== 1) return String(el)
    const parts = []
    let n = el
    for (let i = 0; n && n.nodeType === 1 && i < 4; i++) {
      let s = n.tagName.toLowerCase()
      if (n.id) {
        parts.unshift(s + '#' + n.id)
        break
      }
      const cls = [...n.classList].filter((c) => !/^(data-v-|router-link|v-)/.test(c)).slice(0, 2)
      if (cls.length) s += '.' + cls.join('.')
      const lbl = n.getAttribute('aria-label')
      if (lbl && i === 0) s += `[aria-label="${lbl.slice(0, 24)}"]`
      parts.unshift(s)
      n = n.parentElement
    }
    return parts.join(' > ')
  }
  function txt(el, n = 40) {
    return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, n)
  }
  function visible(el) {
    if (!el.isConnected) return false
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') return false
    if (el.closest('[aria-hidden="true"], [inert]')) return false
    let n = el
    while (n && n.nodeType === 1) {
      if (parseFloat(getComputedStyle(n).opacity) === 0) return false
      n = n.parentElement
    }
    return true
  }
  function srOnly(el) {
    const r = el.getBoundingClientRect()
    return r.width <= 2 || r.height <= 2
  }
  function sample(arr, n) {
    if (arr.length <= n) return arr
    const out = []
    const step = arr.length / n
    for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)])
    return out
  }
  function fixedAncestor(el) {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const p = getComputedStyle(n).position
      if (p === 'fixed' || p === 'sticky') return n
    }
    return null
  }
  function inProto(el) {
    return !!el.closest('.proto')
  }
  const vw = () => document.documentElement.clientWidth
  const vh = () => window.innerHeight

  // ---- colour parsing via canvas (handles rgb, color(srgb), oklch, color-mix results) ----
  const cv = document.createElement('canvas')
  cv.width = cv.height = 1
  const cx = cv.getContext('2d', { willReadFrequently: true })
  const ccache = new Map()
  function rgba(str) {
    if (ccache.has(str)) return ccache.get(str)
    let out
    const m = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/.exec(str)
    if (m) out = [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]]
    else if (str === 'transparent') out = [0, 0, 0, 0]
    else {
      cx.clearRect(0, 0, 1, 1)
      cx.fillStyle = '#000'
      cx.fillStyle = str
      cx.fillRect(0, 0, 1, 1)
      const d = cx.getImageData(0, 0, 1, 1).data
      out = [d[0], d[1], d[2], d[3] / 255]
    }
    ccache.set(str, out)
    return out
  }
  function over(top, bot) {
    // top over opaque-ish bottom
    const a = top[3] + bot[3] * (1 - top[3])
    if (a === 0) return [0, 0, 0, 0]
    return [0, 1, 2].map((i) => (top[i] * top[3] + bot[i] * bot[3] * (1 - top[3])) / a).concat(a)
  }
  function lum(c) {
    const f = (v) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
  }
  function ratio(a, b) {
    const l1 = lum(a)
    const l2 = lum(b)
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
  }
  const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

  function effectiveBg(el) {
    const layers = []
    let unknown = null
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n)
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        unknown = n
        break
      }
      const c = rgba(cs.backgroundColor)
      if (c[3] > 0) {
        layers.push(c)
        if (c[3] >= 0.999) break
      }
    }
    if (unknown) return { unknown: sel(unknown) }
    let base = layers.length && layers[layers.length - 1][3] >= 0.999 ? layers.pop() : [255, 255, 255, 1]
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base)
    return { bg: base }
  }

  const QA = {}

  QA.overflow = function () {
    const de = document.documentElement
    const sw = de.scrollWidth
    const cw = de.clientWidth
    const res = { scrollWidth: sw, clientWidth: cw, overflow: sw > cw + 1, offenders: [] }
    if (!res.overflow) return res
    const all = document.body.querySelectorAll('*')
    const clipsX = (n) => {
      const ox = getComputedStyle(n).overflowX
      return ox !== 'visible'
    }
    for (const el of all) {
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) continue
      if (r.right <= cw + 1 + window.scrollX && r.left >= -1) continue
      const cs = getComputedStyle(el)
      if (cs.position === 'fixed' && (cs.visibility === 'hidden' || cs.transform !== 'none')) continue
      let clipped = false
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement)
        if (clipsX(p)) {
          clipped = true
          break
        }
      if (clipped) continue
      // report origin elements only: parent itself fits
      const pr = el.parentElement?.getBoundingClientRect()
      if (pr && pr.right > cw + 1 && el.parentElement !== document.body) continue
      res.offenders.push({ selector: sel(el), right: Math.round(r.right), width: Math.round(r.width), text: txt(el, 30) })
      if (res.offenders.length >= 12) break
    }
    return res
  }

  QA.interactive = function () {
    return [...document.querySelectorAll(INTERACTIVE)].filter((el) => visible(el) && !srOnly(el) && !el.closest('.proto'))
  }

  QA.occlusion = async function (max = 60) {
    const els = sample(QA.interactive(), max)
    const out = []
    let checked = 0
    for (const el of els) {
      // elements inside fixed/sticky containers are positioned already
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
      await new Promise((r) => requestAnimationFrame(() => r()))
      // virtualised lists recycle rows on scroll: a detached / collapsed element has no hit box to test
      if (!el.isConnected) continue
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) continue
      const x = r.left + r.width / 2
      const y = r.top + r.height / 2
      if (x < 0 || y < 0 || x >= vw() || y >= vh()) continue // inside a horizontal scroller / off-canvas
      checked++
      const hit = document.elementFromPoint(x, y)
      if (!hit) continue
      if (hit === el || el.contains(hit) || hit.contains(el)) continue
      if (hit.tagName === 'LABEL' && hit.control === el) continue
      const fa = fixedAncestor(hit)
      const cover = fa || hit
      out.push({
        selector: sel(el),
        text: txt(el, 30),
        cover: sel(cover),
        coverFixed: !!fa,
        coverProto: inProto(hit),
      })
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    return { checked, occluded: out }
  }

  QA.truncation = function () {
    const out = []
    const info = []
    const all = document.body.querySelectorAll('*')
    let n = 0
    for (const el of all) {
      if (++n > 6000) break
      if (el.closest('.proto, svg')) continue
      const hasText = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())
      if (!hasText) continue
      if (/^(INPUT|TEXTAREA|SELECT|OPTION|SCRIPT|STYLE)$/.test(el.tagName)) continue
      const cs = getComputedStyle(el)
      if (cs.display === 'inline') continue
      if (!visible(el) || srOnly(el)) continue
      const ox = cs.overflowX
      if (ox === 'auto' || ox === 'scroll') continue
      const clampX = el.scrollWidth > el.clientWidth + 1
      const lc = cs.webkitLineClamp && cs.webkitLineClamp !== 'none'
      const clampY = lc && el.scrollHeight > el.clientHeight + 1
      if (!clampX && !clampY) continue
      const ell = cs.textOverflow === 'ellipsis'
      if (clampX && !ell && !lc) {
        out.push({ selector: sel(el), text: txt(el), clipped: ox !== 'visible', sw: el.scrollWidth, cw: el.clientWidth })
      } else if (!el.closest('[title]')) {
        info.push({ selector: sel(el), text: txt(el) })
      }
      if (out.length > 30) break
    }
    return { undeclared: out, ellipsisNoTitle: info.slice(0, 30), ellipsisNoTitleCount: info.length }
  }

  // C14: text boxes of different elements that intersect (> 2px in both axes), and text blocks that
  // wrap one CJK character per line (width < 1.5em with 3+ CJK characters).
  QA.textCollide = function (maxNodes = 1800) {
    const CJK = /[぀-ヿ㐀-鿿豈-﫿ｦ-ﾟ]/g
    const boxes = []
    const wraps = []
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (t) => (t.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    })
    const range = document.createRange()
    let n = 0
    const fixedCache = new Map()
    const layer = (el) => {
      // the nearest fixed / sticky / absolutely positioned ancestor decides the stacking "layer"
      if (fixedCache.has(el)) return fixedCache.get(el)
      let v = null
      for (let x = el; x && x.nodeType === 1; x = x.parentElement) {
        const p = getComputedStyle(x).position
        if (p === 'fixed' || p === 'sticky') {
          v = x
          break
        }
      }
      fixedCache.set(el, v)
      return v
    }
    // text that is clipped (ellipsis, overflow hidden, scrollers) only paints inside its clipping boxes:
    // intersect the range rects with every clipping ancestor
    const clipCache = new Map()
    const clipOf = (el) => {
      if (clipCache.has(el)) return clipCache.get(el)
      let c = { left: -1e9, top: -1e9, right: 1e9, bottom: 1e9 }
      for (let x = el; x && x !== document.body && x.nodeType === 1; x = x.parentElement) {
        const cs = getComputedStyle(x)
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none')) {
          const r = x.getBoundingClientRect()
          c = { left: Math.max(c.left, r.left), top: Math.max(c.top, r.top), right: Math.min(c.right, r.right), bottom: Math.min(c.bottom, r.bottom) }
        }
        // content-visibility: auto|hidden off screen is not rendered; its layout is a placeholder size
        if ((cs.contentVisibility === 'auto' || cs.contentVisibility === 'hidden') && !(x.getBoundingClientRect().bottom > 0 && x.getBoundingClientRect().top < innerHeight)) {
          c = { left: 0, top: 0, right: 0, bottom: 0 }
          break
        }
        if (cs.position === 'fixed') break
      }
      clipCache.set(el, c)
      return c
    }
    const badge = (el) => !!el.closest('.badge, .tab-dot, .status-dot, [class*="badge"], .count, .tip, .tooltip, .sr-only, .warm')
    while (tw.nextNode() && n < maxNodes) {
      const t = tw.currentNode
      const el = t.parentElement
      if (!el || el.closest('svg, script, style, noscript, .proto, [aria-hidden="true"] .sr-only')) continue
      if (!visible(el) || srOnly(el)) continue
      n++
      range.selectNodeContents(t)
      const rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5)
      if (!rects.length) continue
      const clip = clipOf(el)
      for (const r0 of rects) {
        // range rects are font content areas (ascent + descent); glyph ink sits inside ≈ 12% top / bottom
        const inset = (r0.bottom - r0.top) * 0.12
        const r = { left: Math.max(r0.left, clip.left), top: Math.max(r0.top + inset, clip.top), right: Math.min(r0.right, clip.right), bottom: Math.min(r0.bottom - inset, clip.bottom) }
        if (r.right - r.left > 0.5 && r.bottom - r.top > 0.5) boxes.push({ el, r, text: t.textContent.trim().slice(0, 24) })
      }
      const cjk = (t.textContent.match(CJK) || []).length
      if (cjk >= 3) {
        const fs = parseFloat(getComputedStyle(el).fontSize) || 14
        const b = range.getBoundingClientRect()
        if (rects.length >= 3 && b.width < 1.5 * fs) wraps.push({ selector: sel(el), text: t.textContent.trim().slice(0, 24), width: Math.round(b.width), lines: rects.length })
      }
    }
    // bucket by 40px rows to keep the pairwise test cheap
    const rows = new Map()
    boxes.forEach((b, i) => {
      for (let y = Math.floor(b.r.top / 40); y <= Math.floor(b.r.bottom / 40); y++) {
        if (!rows.has(y)) rows.set(y, [])
        rows.get(y).push(i)
      }
    })
    const seen = new Set()
    const hits = []
    for (const list of rows.values()) {
      for (let a = 0; a < list.length; a++) {
        for (let c = a + 1; c < list.length; c++) {
          const A = boxes[list[a]]
          const B = boxes[list[c]]
          if (A.el === B.el || A.el.contains(B.el) || B.el.contains(A.el)) continue
          const ix = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left)
          const iy = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top)
          if (ix <= 2 || iy <= 2) continue
          if (layer(A.el) !== layer(B.el)) continue // a fixed / sticky layer over scrolling content is intended
          if (badge(A.el) || badge(B.el)) continue
          // only what is actually painted there: the point must belong to one of the two
          const px = Math.max(A.r.left, B.r.left) + ix / 2
          const py = Math.max(A.r.top, B.r.top) + iy / 2
          if (px < 0 || py < 0 || px >= vw() || py >= vh()) {
            // off-screen: still compare, elementFromPoint cannot help there
          } else {
            const h = document.elementFromPoint(px, py)
            if (h && !(A.el.contains(h) || B.el.contains(h) || h.contains(A.el) || h.contains(B.el))) continue
          }
          const key = sel(A.el) + '|' + sel(B.el)
          if (seen.has(key)) continue
          seen.add(key)
          hits.push({ a: sel(A.el), b: sel(B.el), ta: A.text, tb: B.text, ix: Math.round(ix), iy: Math.round(iy), y: Math.round(py) })
          if (hits.length >= 30) break
        }
      }
    }
    return { nodes: n, collisions: hits, wraps: wraps.slice(0, 20) }
  }

  QA.tapTargets = async function () {
    const els = QA.interactive()
    const small = []
    let checked = 0
    for (const el of els) {
      // C10: inline text links (an author / section name in a row, a link in a sentence, a text-styled
      // button.link) need a hit HEIGHT ≥ 24px, not 44×44. Inline = a text-only a / button.link laid out
      // inline (not flex / grid / block), with no media inside.
      let need = 44
      if (el.tagName === 'A' || (el.tagName === 'BUTTON' && el.classList.contains('link'))) {
        const cs = getComputedStyle(el)
        // text links that are not controls: an author / section / title-source name, a link in a sentence.
        // (display may be block for truncation, e.g. .title-1l) — anything styled as a button / chip / tab is not
        const control = el.matches('.btn, .chip, .tab, [role=tab], .icon-btn, .seg button, .fopt') || cs.display === 'flex' || cs.display === 'grid' || cs.display === 'inline-flex' || cs.display === 'inline-grid'
        const textOnly = !el.querySelector('img, svg, .cover, .avatar, .crown, .diff, .note')
        if (!control && textOnly && (el.textContent || '').trim().length <= 60) need = 24
      }
      if (el.disabled) continue
      let r = el.getBoundingClientRect()
      checked++
      if (need === 24 ? r.height >= 24 : r.width >= 44 && r.height >= 44) continue
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
      if (!el.isConnected) continue
      r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) continue
      const cxp = r.left + r.width / 2
      const cyp = r.top + r.height / 2
      if (cxp < 0 || cyp < 0 || cxp >= vw() || cyp >= vh()) continue
      const own = (x, y) => {
        const h = document.elementFromPoint(x, y)
        if (!h) return false
        if (h === el || el.contains(h)) return true
        return !!el.labels && [...el.labels].some((lb) => lb === h || lb.contains(h))
      }
      if (need === 24) {
        const h24 = r.height >= 24 || (own(cxp, cyp - 11.5) && own(cxp, cyp + 11.5)) ? 24 : Math.round(r.height)
        if (h24 < 24) small.push({ selector: sel(el), text: txt(el, 24), w: Math.round(r.width), h: h24, area: h24 * 44, inline: true })
        continue
      }
      const w = r.width >= 44 || (own(cxp - 21.5, cyp) && own(cxp + 21.5, cyp)) ? 44 : Math.round(r.width)
      const h = r.height >= 44 || (own(cxp, cyp - 21.5) && own(cxp, cyp + 21.5)) ? 44 : Math.round(r.height)
      if (w < 44 || h < 44) small.push({ selector: sel(el), text: txt(el, 24) || el.getAttribute('aria-label') || '', w, h, area: w * h })
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    small.sort((a, b) => a.area - b.area)
    return { checked, count: small.length, worst: small.slice(0, 10) }
  }

  QA.contrast = function (max = 400) {
    const nodes = []
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (t) => (t.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    })
    while (tw.nextNode()) nodes.push(tw.currentNode)
    const fails = new Map()
    const unknown = new Map()
    let checked = 0
    for (const t of sample(nodes, max)) {
      const el = t.parentElement
      if (!el || el.closest('svg, script, style, noscript, .proto, [aria-hidden="true"]')) continue
      if (el.closest('[disabled], [aria-disabled="true"], :disabled')) continue
      if (!visible(el) || srOnly(el)) continue
      const cs = getComputedStyle(el)
      let fg = rgba(cs.color)
      let op = 1
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) op *= parseFloat(getComputedStyle(n).opacity)
      fg = [fg[0], fg[1], fg[2], fg[3] * op]
      if (fg[3] === 0) continue
      const b = effectiveBg(el)
      const size = parseFloat(cs.fontSize)
      const bold = parseInt(cs.fontWeight) >= 700
      const large = size >= 24 || (size >= 18.66 && bold)
      if (b.unknown) {
        const k = sel(el)
        if (!unknown.has(k)) unknown.set(k, { selector: k, text: t.textContent.trim().slice(0, 30), bgSource: b.unknown })
        continue
      }
      checked++
      const fgc = over(fg, b.bg)
      const r = ratio(fgc, b.bg)
      const need = large ? 3 : 4.5
      if (r < need) {
        const key = hex(fgc) + '|' + hex(b.bg) + '|' + sel(el)
        const prev = fails.get(key)
        if (prev) prev.count++
        else fails.set(key, { concept: !!el.closest('.mocks'), fg: hex(fgc), bg: hex(b.bg), selector: sel(el), ratio: Math.round(r * 100) / 100, need, size, text: t.textContent.trim().slice(0, 30), count: 1 })
      }
    }
    return { checked, fails: [...fails.values()].slice(0, 40), failCount: fails.size, unknown: [...unknown.values()].slice(0, 20), unknownCount: unknown.size }
  }

  // focus snapshot of el + pseudo-elements + first descendants (rings drawn on a child)
  QA.focusSnap = function () {
    const el = document.activeElement
    if (!el || el === document.body) return null
    const props = ['outlineStyle', 'outlineWidth', 'outlineColor', 'boxShadow', 'backgroundColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'textDecorationLine']
    const snap = (n, pseudo) => {
      const cs = getComputedStyle(n, pseudo)
      return props.map((p) => cs[p]).join('|')
    }
    const targets = [el, el.parentElement, el.parentElement?.parentElement, ...[...el.querySelectorAll('*')].slice(0, 4)].filter(Boolean)
    return targets.map((n) => snap(n) + '#' + snap(n, '::before') + '#' + snap(n, '::after')).join('\n')
  }
  QA.focusCheck = function () {
    const el = document.activeElement
    if (!el || el === document.body || el === document.documentElement) return { none: true }
    if (el.tagName === 'IFRAME') return { iframe: true }
    const focused = QA.focusSnap()
    const r = el.getBoundingClientRect()
    const inView = r.bottom > 0 && r.right > 0 && r.top < vh() && r.left < vw() && r.width > 0 && r.height > 0
    // unfocused state: blur, snapshot (from the same element), refocus with focus-visible
    const ref = el
    ref.blur()
    const prevActive = document.activeElement
    const plain = (() => {
      const save = document.activeElement
      const tmp = ref
      const props = ['outlineStyle', 'outlineWidth', 'outlineColor', 'boxShadow', 'backgroundColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'textDecorationLine']
      const snap = (n, pseudo) => props.map((p) => getComputedStyle(n, pseudo)[p]).join('|')
      const targets = [tmp, tmp.parentElement, tmp.parentElement?.parentElement, ...[...tmp.querySelectorAll('*')].slice(0, 4)].filter(Boolean)
      return targets.map((n) => snap(n) + '#' + snap(n, '::before') + '#' + snap(n, '::after')).join('\n')
    })()
    try {
      ref.focus({ focusVisible: true, preventScroll: true })
    } catch {
      ref.focus()
    }
    return { proto: inProto(ref), selector: sel(ref), text: txt(ref, 30) || ref.getAttribute('aria-label') || '', changed: focused !== plain, inView, skip: /跳到|スキップ|skip|メインコンテンツ/i.test(txt(ref, 30)), prevActive: !!prevActive }
  }

  QA.a11y = function (expectLang) {
    const issues = []
    const name = (el) => {
      if (el.getAttribute('aria-label')?.trim()) return el.getAttribute('aria-label').trim()
      const lb = el.getAttribute('aria-labelledby')
      if (lb) {
        const t = lb
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent || '')
          .join(' ')
          .trim()
        if (t) return t
      }
      const t = (el.innerText || el.textContent || '').trim()
      if (t) return t
      const img = el.querySelector('img[alt]:not([alt=""])')
      if (img) return img.alt
      if (el.getAttribute('title')?.trim()) return el.getAttribute('title').trim()
      return ''
    }
    for (const img of document.querySelectorAll('img')) {
      if (!img.hasAttribute('alt') && visible(img)) issues.push({ check: 'a11y-img-alt', selector: sel(img), detail: 'img without alt' })
    }
    for (const el of document.querySelectorAll('button, a[href], [role=button], [role=tab], [role=menuitem], [role=option]')) {
      if (!visible(el) || el.closest('.proto')) continue
      if (!name(el)) issues.push({ check: 'a11y-name', selector: sel(el), detail: 'interactive element without accessible name' })
    }
    for (const el of document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea')) {
      if (!visible(el) && !(el.type === 'checkbox' || el.type === 'radio')) continue
      if (el.closest('.proto')) continue
      const ok = (el.labels && el.labels.length) || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title')
      if (!ok) issues.push({ check: 'a11y-label', selector: sel(el), detail: el.placeholder ? `placeholder only: "${el.placeholder.slice(0, 30)}"` : 'form control without label' })
    }
    const ids = new Map()
    for (const el of document.querySelectorAll('[id]')) ids.set(el.id, (ids.get(el.id) || 0) + 1)
    for (const [id, n] of ids) if (n > 1) issues.push({ check: 'a11y-dup-id', selector: '#' + id, detail: `id used ${n}×` })
    const mains = document.querySelectorAll('main, [role=main]').length
    if (mains === 0) issues.push({ check: 'a11y-main', selector: 'main', detail: 'no main landmark' })
    if (mains > 1) issues.push({ check: 'a11y-main', selector: 'main', detail: `${mains} main landmarks` })
    const lang = document.documentElement.lang || ''
    if (!lang.toLowerCase().startsWith(expectLang)) issues.push({ check: 'a11y-lang', selector: 'html', detail: `html[lang]="${lang}" expected ${expectLang}*` })
    return issues.slice(0, 60)
  }

  QA.infiniteAnimations = function () {
    const out = []
    for (const a of document.getAnimations()) {
      const t = a.effect?.getTiming?.()
      if (a.playState === 'running' && t && t.iterations === Infinity) {
        const tgt = a.effect.target
        out.push({ selector: tgt ? sel(tgt) : '?', name: a.animationName || a.id || a.constructor.name })
      }
    }
    return out
  }

  QA.sel = sel
  window.__QA = QA
  return true
}
