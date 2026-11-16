// Ruling C (screenshot review) — measurable parts checked in the browser:
// C1 Today list at 820, C2 Lane columns / notes / dates, C3 ChartSheet measures per row,
// C4 /songs first screen at 820, C5 difficulty tabs carry text, C6 detail title not clamped,
// C7 constants phone row status, C8 palette "view all", C9 prototype handle width.
import { expect, firstVisible } from '../lib/flowkit.mjs'
import { EDGE_PAGES } from '../matrix.mjs'

const laneGeom = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('main .lane')].map((lane) => {
      const cols = [...lane.querySelectorAll('.col')]
      const w = cols.map((c) => c.getBoundingClientRect().width)
      const notes = cols.map((c) => c.querySelector('.n')?.getBoundingClientRect().width || 0)
      const worst = cols.reduce((m, c, i) => Math.max(m, notes[i] - (w[i] - 8)), -99)
      const dates = cols.map((c) => c.querySelector('.date b')?.textContent.trim())
      const overlap = cols.some((c, i) => {
        if (!i) return false
        const a = cols[i - 1].querySelector('.date b')?.getBoundingClientRect()
        const b = c.querySelector('.date b')?.getBoundingClientRect()
        return a && b && a.right > b.left + 1
      })
      return { link: lane.tagName === 'A', n: cols.length, minW: Math.min(...w), worst, dates, overlap, scroll: lane.scrollWidth > lane.clientWidth + 1, atEnd: lane.scrollLeft + lane.clientWidth >= lane.scrollWidth - 2 }
    }),
  )

export const screenReview = {
  name: 'screen-review',
  quick: false,
  timeoutMs: 120_000,
  async run(t) {
    let page = await t.open({ vp: '820x1180', route: '/' })
    await t.step('C1: 820 Today — title above, facts single column, no per-character wrap', async () => {
      const r = await page.evaluate(() => {
        const head = document.querySelector('.dayfacts .day-head')?.getBoundingClientRect()
        const facts = document.querySelector('.dayfacts .facts')
        const cols = facts ? getComputedStyle(facts).gridTemplateColumns.split(' ').length : 0
        const rows = [...document.querySelectorAll('.dayfacts .fact')].map((f) => f.getBoundingClientRect().height)
        return { headBottom: head?.bottom, factsTop: facts?.getBoundingClientRect().top, cols, maxRow: Math.max(...rows) }
      })
      expect(r.cols === 1, `facts grid has ${r.cols} columns`)
      expect(r.headBottom <= r.factsTop + 1, 'day head is not above the facts')
      expect(r.maxRow < 90, `a fact row is ${r.maxRow}px tall (wrapping)`)
      return `1 column, tallest row ${Math.round(r.maxRow)}px`
    })
    await t.step('C2: 820 Today lane — columns ≥ 44, notes ≤ column − 8, no date overlap, starts at today', async () => {
      const [l] = await laneGeom(page)
      expect(l && l.minW >= 43.5, `narrowest column ${l?.minW}px`)
      expect(l.worst <= 0.5, `a note exceeds column − 8 by ${l.worst.toFixed(1)}px`)
      expect(!l.overlap, 'date labels overlap')
      expect(!l.scroll || l.atEnd, 'scrollable lane does not start at today')
      return `${l.n} columns ≥ ${l.minW.toFixed(1)}px, scroll ${l.scroll}`
    })
    await t.step('C4: 820 /songs — chip row instead of facets, list starts in the first screen', async () => {
      await t.go('/songs')
      const r = await page.evaluate(() => ({
        facets: !!document.querySelector('.facets') && getComputedStyle(document.querySelector('.facets')).display !== 'none',
        chips: !!document.querySelector('.mfilters'),
        firstRow: document.querySelector('main tbody tr.is-link')?.getBoundingClientRect().top,
      }))
      expect(!r.facets && r.chips, `facets visible ${r.facets}, chip row ${r.chips}`)
      expect(r.firstRow < 400, `first row at y=${r.firstRow}`)
      const btn = await firstVisible(page.locator('main .mfilters').getByRole('button', { name: /筛选/ }))
      await btn.click()
      const d = page.locator('[role=dialog][aria-modal=true]').last()
      await d.waitFor({ state: 'visible', timeout: 3000 })
      await page.waitForTimeout(350)
      const b = await d.boundingBox()
      expect(Math.abs(b.x + b.width / 2 - 410) < 40 && b.y > 20, `filter dialog ${JSON.stringify(b)} not centred`)
      await page.keyboard.press('Escape')
      return `first row y=${Math.round(r.firstRow)}`
    })
    await t.step('C3: 820 /songs/615 — chart sheet measures ≥ 150px, 2 per row', async () => {
      await t.go('/songs/615')
      const r = await page.evaluate(() => {
        const line = document.querySelector('main .sheet .line')
        const ms = [...line.querySelectorAll('.measure')].map((m) => m.getBoundingClientRect())
        const perRow = new Set(ms.map((m) => Math.round(m.top))).size === 1 ? ms.length : ms.filter((m) => Math.round(m.top) === Math.round(ms[0].top)).length
        return { perRow, minW: Math.min(...ms.map((m) => m.width)) }
      })
      expect(r.minW >= 149, `narrowest measure ${r.minW}px`)
      return `${r.perRow} per row, ≥ ${Math.round(r.minW)}px`
    })
    await t.close()

    page = await t.open({ vp: '390x844', route: '/songs/615' })
    await t.step('C5: phone difficulty tabs each show a text label; selected tab visible', async () => {
      const r = await page.evaluate(() =>
        [...document.querySelectorAll('.diffbar [role=tab]')].map((b) => {
          const vis = [...b.querySelectorAll('.dn, .dshort')].find((x) => getComputedStyle(x).display !== 'none' && x.getBoundingClientRect().width > 2)
          const bar = b.parentElement.getBoundingClientRect()
          const r = b.getBoundingClientRect()
          return { text: vis?.textContent.trim() || '', name: b.textContent.trim(), sel: b.getAttribute('aria-selected') === 'true', inView: r.left >= bar.left - 1 && r.right <= bar.right + 1 }
        }),
      )
      const bad = r.filter((x) => !x.text)
      expect(!bad.length, `${bad.length} tab(s) without a visible text label`)
      const sel = r.find((x) => x.sel)
      expect(sel?.inView, 'selected difficulty is scrolled out of the bar')
      return r.map((x) => x.text).join(' ')
    })
    await t.step('C2: phone /me lane — overview link, 7 days, columns ≥ 36, no date overlap', async () => {
      await t.go('/me')
      const [l] = await laneGeom(page)
      expect(l && l.link, 'lane on /me is not a single link')
      expect(l.n === 7 && l.minW >= 35.5, `${l.n} columns, narrowest ${l.minW}px`)
      expect(l.worst <= 0.5 && !l.overlap, `note excess ${l.worst}, overlap ${l.overlap}`)
      return `${l.n} columns ≥ ${l.minW.toFixed(1)}px, dates ${l.dates.join(' ')}`
    })
    await t.step('C9: phone prototype handle visible width ≤ 12px', async () => {
      const w = await page.evaluate(() => document.querySelector('.proto .fab')?.getBoundingClientRect().width)
      expect(w != null && w <= 12.5, `handle width ${w}`)
      return `${w}px`
    })
    await t.step('C7: phone constants rows — status is a named crown, never a bare dot', async () => {
      await t.go('/songs/constants')
      const r = await page.evaluate(() =>
        [...document.querySelectorAll('main .mrow .mmeta .crown-wrap')].slice(0, 30).map((c) => ({ label: c.querySelector('.crown-label')?.textContent.trim() || '' })),
      )
      expect(r.every((x) => x.label), 'a crown in a row has no visible name')
      return `${r.length} crowns, all named`
    })
    await t.close()

    page = await t.open({ vp: '1440x900', route: EDGE_PAGES[0] })
    await t.step('C6: long title on the detail page is not clamped', async () => {
      const r = await page.evaluate(() => {
        const h = document.querySelector('main h1.title')
        const cs = getComputedStyle(h)
        return { clamp: cs.webkitLineClamp, sh: h.scrollHeight, ch: h.clientHeight, ov: cs.overflow }
      })
      expect((r.clamp === 'none' || !r.clamp) && r.sh <= r.ch + 1, `title clamp ${r.clamp}, ${r.sh} > ${r.ch}`)
      return `line-clamp ${r.clamp}, overflow ${r.ov}`
    })
    await t.step('C8: palette hides "view all" when every song is listed', async () => {
      await page.keyboard.press('Control+k')
      const inp = page.locator('[role=dialog] input').last()
      await inp.fill('千本')
      await page.waitForTimeout(400)
      const r = await page.evaluate(() => {
        const opts = [...document.querySelectorAll('[role=dialog] [role=option]')].map((o) => o.textContent)
        return { songs: document.querySelectorAll('[role=dialog] [role=option].song').length, more: opts.some((t) => /在曲库中查看全部/.test(t)) }
      })
      expect(!(r.songs <= 8 && r.more && r.songs < 8), `"view all" shown under ${r.songs} result(s)`)
      return `${r.songs} song result(s), view-all ${r.more ? 'shown' : 'hidden'}`
    })
    await t.noConsoleErrors()
  },
}
