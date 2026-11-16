// Ruling-specific checks added for the V1.1 acceptance: thread paging (V7), growth time stack
// alignment (V3), deep scroll restore on 1,520 rows (R3), first-screen folds (V1/V2), /me length
// (V9 / S5), list density (V11). Plus showcase screenshots of the palette for the gallery.
import { expect, firstVisible } from '../lib/flowkit.mjs'

const qp = (h) => new URLSearchParams((h.split('?')[1] || '').split('#')[0])

export const threadPaging = {
  name: 'thread-paging',
  quick: false,
  timeoutMs: 60_000,
  async run(t) {
    for (const vp of ['1440x900', '390x844']) {
      const page = await t.open({ vp, route: '/community/t/4017' })
      const floors = () => page.locator('main li.post[id^=floor-]').evaluateAll((els) => els.map((e) => +e.id.slice(6)))
      await t.step(`${vp}: page 1 shows ≤ 20 floors`, async () => {
        const f = await floors()
        expect(f.length > 0 && f.length <= 20, `${f.length} floors on page 1`)
        return `${f[0]}–${f[f.length - 1]}`
      })
      await t.step(`${vp}: 下一页 → p=2, different floors`, async () => {
        const before = await floors()
        const b = await firstVisible(page.locator('main nav.pager').first().getByRole('button', { name: /下一页|次へ/ }), 2000)
        expect(b, 'no 下一页')
        await b.click()
        await page.waitForTimeout(400)
        const h = await t.hash()
        const after = await floors()
        expect(qp(h).get('p') === '2', `hash ${h}`)
        expect(after[0] !== before[0], `floors did not change (${before[0]} → ${after[0]})`)
      })
      await t.step(`${vp}: 只看楼主 → op=1, pressed`, async () => {
        const c = await firstVisible(page.locator('main').getByRole('button', { name: /只看楼主|投稿者のみ/ }), 2000)
        expect(c, 'no 只看楼主')
        await c.click()
        await page.waitForTimeout(400)
        expect(qp(await t.hash()).get('op') === '1', `hash ${await t.hash()}`)
        expect((await c.getAttribute('aria-pressed')) === 'true', 'chip not pressed')
        await c.click()
        await page.waitForTimeout(300)
      })
      await t.step(`${vp}: jump to floor 45 → f=45, floor in view`, async () => {
        const inp = page.locator('#th-jump')
        await inp.fill('45')
        await inp.press('Enter')
        await page.waitForTimeout(700)
        expect(qp(await t.hash()).get('f') === '45', `hash ${await t.hash()}`)
        const r = await page.locator('#floor-45').boundingBox()
        const vh = +vp.split('x')[1]
        expect(r && r.y >= -2 && r.y < vh, `#floor-45 box ${JSON.stringify(r)}`)
      })
      await t.step(`${vp}: invalid floor shows an error`, async () => {
        const inp = page.locator('#th-jump')
        await inp.fill('999')
        await inp.press('Enter')
        await page.waitForTimeout(300)
        expect(await page.locator('#th-jump-err').isVisible().catch(() => false), 'no error for floor 999')
      })
      await t.noConsoleErrors(`${vp}: no console errors`)
      await t.close()
    }
  },
}

export const growthRanges = {
  name: 'growth-ranges',
  quick: false,
  timeoutMs: 60_000,
  async run(t) {
    for (const vp of ['1440x900', '390x844']) {
      const page = await t.open({ vp, route: '/growth' })
      for (const r of [30, 90, 180, 365]) {
        await t.step(`${vp}: range ${r} renders aligned rows`, async () => {
          const b = await firstVisible(page.locator('main [role=group]').first().getByRole('button', { name: new RegExp(`^${r}\\s*(天|日)`) }), 2000)
          expect(b, `no ${r} 天 button`)
          await b.click()
          await page.waitForTimeout(350)
          expect(qp(await t.hash()).get('range') === String(r) || r === 90, `hash ${await t.hash()}`)
          const g = await page.evaluate(() => {
            const svg = document.querySelector('main .ts svg, main svg.ts, main .stack svg')
            if (!svg) return { none: true }
            const box = (el) => el && el.getBoundingClientRect()
            const area = box(svg.querySelector('path.area')) || box(svg.querySelector('path.line'))
            const union = (sel) => {
              const els = [...svg.querySelectorAll(sel)].map((e) => e.getBoundingClientRect()).filter((x) => x.width > 0)
              if (!els.length) return null
              return { left: Math.min(...els.map((x) => x.left)), right: Math.max(...els.map((x) => x.right)), n: els.length }
            }
            return { area: area && { left: area.left, right: area.right }, bands: union('.band rect'), days: union('.day-note, .day-tick'), marks: union('.mk .mk-face') }
          })
          expect(!g.none, 'no time stack svg')
          expect(g.area, 'no plotted line/area')
          const bad = []
          for (const k of ['bands', 'days', 'marks']) {
            const row = g[k]
            if (!row) continue
            if (row.left < g.area.left - 8 || row.right > g.area.right + 8) bad.push(`${k} [${Math.round(row.left)}, ${Math.round(row.right)}] outside plot [${Math.round(g.area.left)}, ${Math.round(g.area.right)}]`)
          }
          expect(!bad.length, bad.join('; '))
          return `plot [${Math.round(g.area.left)}, ${Math.round(g.area.right)}] bands ${g.bands ? `[${Math.round(g.bands.left)}, ${Math.round(g.bands.right)}]` : '—'}`
        })
      }
      await t.noConsoleErrors(`${vp}: no console errors`)
      await t.close()
    }
  },
}

export const deepScroll = {
  name: 'songs-deep-scroll',
  quick: false,
  timeoutMs: 60_000,
  async run(t) {
    for (const vp of ['1440x900', '390x844']) {
      const page = await t.open({ vp, route: '/songs?shelf=all' })
      let y0
      let h0
      await t.step(`${vp}: scroll to the middle of the full list and open a song`, async () => {
        const total = await page.evaluate(() => document.documentElement.scrollHeight)
        expect(total > 20_000, `list too short for 1,520 rows (scrollHeight ${total})`)
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2))
        await page.waitForTimeout(400)
        y0 = await page.evaluate(() => scrollY)
        h0 = await t.hash()
        const rows = page.locator('main tr.is-link, main ul.mlist > li a, main ul.mlist > li')
        const n = await rows.count()
        let clicked = null
        for (let i = 0; i < n && !clicked; i++) {
          const b = await rows.nth(i).boundingBox()
          if (b && b.y > 160 && b.y + b.height < (vp === '390x844' ? 760 : 880)) {
            clicked = (await rows.nth(i).innerText()).split('\n')[0]
            await rows.nth(i).click()
          }
        }
        expect(clicked, 'no row in viewport after scrolling')
        await page.waitForTimeout(600)
        expect(/^#\/songs\/\d+/.test(await t.hash()), `hash after click ${await t.hash()}`)
        return `scrollY ${y0} / ${total}, opened "${clicked}"`
      })
      await t.step(`${vp}: Back → same URL and scroll (±40px)`, async () => {
        await page.goBack()
        await page.waitForTimeout(800)
        const h = await t.hash()
        const y = await page.evaluate(() => scrollY)
        expect(h === h0, `hash ${h}, expected ${h0}`)
        expect(Math.abs(y - y0) <= 40, `scrollY ${y}, expected ${y0}`)
        return `scrollY ${y}`
      })
      await t.close()
    }
  },
}

export const folds = {
  name: 'first-screen',
  quick: false,
  timeoutMs: 60_000,
  async run(t) {
    let page = await t.open({ vp: '1280x800', route: '/' })
    await t.step('V1: 1280×800 Today lane top edge inside the first screen', async () => {
      const r = await page.locator('main .lane').first().boundingBox()
      expect(r && r.y >= 0 && r.y < 800, `lane box ${JSON.stringify(r)}`)
      return `lane top ${Math.round(r.y)}px`
    })
    await t.close()
    page = await t.open({ vp: '1440x900', route: '/songs/615' })
    await t.step('V2: 1440×900 chart sheet top edge and whole 我的成绩 in the first screen', async () => {
      const s = await page.locator('main .sheet[role=img]').first().boundingBox()
      const m = await page.locator('main section.myscore').first().boundingBox()
      expect(s && s.y < 900, `chart sheet box ${JSON.stringify(s)}`)
      expect(m && m.y >= 0 && m.y + m.height <= 900, `我的成绩 box ${JSON.stringify(m)}`)
      return `sheet top ${Math.round(s.y)}px, 我的成绩 ${Math.round(m.y)}–${Math.round(m.y + m.height)}px`
    })
    await t.close()
    page = await t.open({ vp: '390x844', route: '/me' })
    await t.step('V9: /me at 390×844 ≤ 2.5 screens, no sync button', async () => {
      const h = await page.evaluate(() => document.documentElement.scrollHeight)
      const n = await page.locator('main').getByRole('button', { name: /同步|同期/ }).count()
      expect(h <= 2.5 * 844, `scrollHeight ${h} > ${2.5 * 844}`)
      expect(n === 0, `${n} sync button(s)`)
      return `scrollHeight ${h}px (${(h / 844).toFixed(2)} screens)`
    })
    await t.close()
  },
}

export const density = {
  name: 'density',
  quick: false,
  timeoutMs: 90_000,
  async run(t) {
    // V11 + VirtualList contract: compact rows are shorter, and every rendered row is exactly the
    // table's declared --row-h (the virtual list computes offsets from it)
    for (const route of ['/songs', '/play/scores', '/songs/constants']) {
      const h = {}
      for (const d of ['comfortable', 'compact']) {
        const page = await t.open({ vp: '1440x900', state: { density: d }, route })
        h[d] = await page.evaluate(() => {
          const tb = document.querySelector('main table[style*="--row-h"]')
          if (!tb) return null
          const declared = parseFloat(tb.style.getPropertyValue('--row-h'))
          const rows = [...tb.querySelectorAll('tbody tr')].filter((r) => r.cells.length > 1).slice(0, 12).map((r) => Math.round(r.getBoundingClientRect().height * 10) / 10)
          return { declared, rows }
        })
        await t.close()
      }
      await t.step(`${route}: compact shorter than comfortable, rows = declared --row-h`, () => {
        expect(h.comfortable && h.compact, `no fixed-row table on ${route}`)
        const off = []
        for (const d of ['comfortable', 'compact']) {
          const bad = h[d].rows.filter((x) => Math.abs(x - h[d].declared) > 0.6)
          if (bad.length) off.push(`${d}: declared ${h[d].declared}px, rows ${[...new Set(bad)].join('/')}px`)
        }
        expect(h.compact.declared < h.comfortable.declared, `declared ${h.comfortable.declared} → ${h.compact.declared}`)
        expect(!off.length, off.join('; '))
        return `comfortable ${h.comfortable.declared}px, compact ${h.compact.declared}px`
      })
    }
  },
}

// Gallery screenshots of the palette (light + dark, desktop song query, phone pattern query).
export const paletteShowcase = {
  name: 'palette-showcase',
  quick: false,
  timeoutMs: 60_000,
  async run(t) {
    for (const theme of ['light', 'dark']) {
      let page = await t.open({ vp: '1440x900', state: { theme }, route: '/' })
      await t.step(`desktop ${theme}: palette with 千本`, async () => {
        await page.keyboard.press('Control+k')
        const inp = page.locator('[role=dialog] input').last()
        await inp.fill('千本')
        await page.waitForTimeout(400)
        await t.shot(`desktop-${theme}`)
      })
      await t.close()
      page = await t.open({ vp: '390x844', state: { theme }, route: '/' })
      await t.step(`phone ${theme}: full-screen palette with config query`, async () => {
        await page.locator('nav').getByRole('button', { name: /搜索|検索/ }).first().tap()
        const inp = page.locator('[role=dialog] input').last()
        await inp.fill('16 oxxo 180 鬼10')
        await page.waitForTimeout(400)
        await page.evaluate(() => document.activeElement?.blur())
        await t.shot(`phone-${theme}`)
      })
      await t.close()
    }
  },
}
