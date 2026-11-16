// F1: phone detail navigation on /songs/:id and /community/t/:id.
//   tab bar absent there (present on /u/:name, /tools/rt); header back / search / sync / bell ≥ 44 and
//   unobscured; action bar / reply box visible and not covering content at top and at the bottom
//   (last content line fully above the bar); toast above the bar; reply box grows 1 → 5 lines;
//   short viewports (390×480, 360×420) with the reply box focused as a keyboard proxy;
//   back restores /songs filters + scroll and /community feed + section + scroll; palette → detail → back;
//   header search opens the full-screen palette and focus returns to it on Esc.
import { expect, firstVisible } from '../lib/flowkit.mjs'

const geom = (page) =>
  page.evaluate(() => {
    const r = (el) => (el ? el.getBoundingClientRect().toJSON() : null)
    const tabbar = document.querySelector('nav.tabbar')
    const dock = document.querySelector('.mbar') || document.querySelector('form.composer')
    const btns = ['header .back', 'header .m-search', 'header .m-sync', 'header .bell'].map((s) => {
      const el = document.querySelector(s)
      if (!el) return { s, missing: true }
      const b = el.getBoundingClientRect()
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)
      return { s, w: Math.round(b.width), h: Math.round(b.height), right: b.right, left: b.left, free: !!hit && (hit === el || el.contains(hit)) }
    })
    return { vh: innerHeight, vw: document.documentElement.clientWidth, tabbar: tabbar ? r(tabbar) : null, dock: r(dock), btns, sw: document.documentElement.scrollWidth }
  })

// bottom edge of the last line of real content in <main> (text or replaced elements), excluding the dock itself
const lastContentBottom = (page) =>
  page.evaluate(() => {
    const main = document.querySelector('main')
    const dock = document.querySelector('.mbar, form.composer')
    let best = 0
    const tw = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, { acceptNode: (t) => (t.textContent.trim() ? 1 : 3) })
    const rg = document.createRange()
    while (tw.nextNode()) {
      const t = tw.currentNode
      if (dock && dock.contains(t)) continue
      const el = t.parentElement
      if (!el || el.closest('.sr-only, [aria-hidden="true"]') || getComputedStyle(el).position === 'fixed') continue
      rg.selectNodeContents(t)
      for (const b of rg.getClientRects()) if (b.height > 0 && b.bottom > best) best = b.bottom
    }
    for (const el of main.querySelectorAll('button, a, img, .cover, input, textarea')) {
      if (dock && dock.contains(el)) continue
      const b = el.getBoundingClientRect()
      if (b.height > 0 && b.width > 0 && getComputedStyle(el).visibility !== 'hidden' && b.bottom > best) best = b.bottom
    }
    return best
  })

async function toBottom(page) {
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForTimeout(250)
  }
}

export const detailNavPhone = {
  name: 'detail-nav-phone',
  quick: false,
  timeoutMs: 240_000,
  stepTimeoutMs: 30_000,
  async run(t) {
    for (const vp of ['390x844', '360x740']) {
      for (const route of ['/songs/615', '/community/t/4017']) {
        const page = await t.open({ vp, route })
        const thread = route.startsWith('/community')
        await t.step(`${vp} ${route}: no tab bar; back / search / sync / bell ≥ 44, ≥ 6px apart, unobscured`, async () => {
          const g = await geom(page)
          expect(!g.tabbar, 'tab bar is shown')
          for (const b of g.btns) {
            expect(!b.missing, `${b.s} missing`)
            expect(b.w >= 44 && b.h >= 44, `${b.s} is ${b.w}×${b.h}`)
            expect(b.free, `${b.s} is covered`)
            expect(b.right <= g.vw + 0.5 && b.left >= -0.5, `${b.s} outside the viewport`)
          }
          const [, s, y, n] = g.btns
          expect(y.left - s.right >= 5.5 && n.left - y.right >= 5.5, `gaps ${Math.round(y.left - s.right)} / ${Math.round(n.left - y.right)}px`)
          expect(g.sw <= g.vw + 1, `horizontal overflow ${g.sw}`)
          return g.btns.map((b) => `${b.w}×${b.h}`).join(' ')
        })
        await t.step(`${vp} ${route}: ${thread ? 'reply box' : 'action bar'} at the bottom, content above it at top and at the end`, async () => {
          const g = await geom(page)
          expect(g.dock && g.dock.bottom >= g.vh - 1 && g.dock.top > g.vh * 0.6, `dock box ${JSON.stringify(g.dock)}`)
          await toBottom(page)
          const g2 = await geom(page)
          const last = await lastContentBottom(page)
          expect(last <= g2.dock.top + 0.5, `last content line ends at ${Math.round(last)}, dock starts at ${Math.round(g2.dock.top)}`)
          return `dock ${Math.round(g2.dock.height)}px, last line ${Math.round(last)} ≤ ${Math.round(g2.dock.top)}`
        })
        if (!thread) {
          await t.step(`${vp} ${route}: action bar = two equal 44px buttons, 12px padding`, async () => {
            const r = await page.evaluate(() => {
              const bar = document.querySelector('.mbar')
              const b = [...bar.querySelectorAll('.btn')].map((x) => x.getBoundingClientRect())
              const cs = getComputedStyle(bar)
              return { w: b.map((x) => Math.round(x.width)), h: b.map((x) => Math.round(x.height)), pt: parseFloat(cs.paddingTop) }
            })
            expect(r.w.length === 2 && Math.abs(r.w[0] - r.w[1]) <= 1, `widths ${r.w}`)
            expect(r.h.every((h) => h === 44), `heights ${r.h}`)
            expect(r.pt === 12, `padding-top ${r.pt}`)
            return `${r.w.join(' / ')}px wide`
          })
          await t.step(`${vp} ${route}: toast appears above the action bar`, async () => {
            await page.evaluate(() => window.__TV__.store.toasts.push({ id: 99901, text: 'QA', kind: 'ok' }))
            await page.waitForTimeout(250)
            const r = await page.evaluate(() => ({ toast: document.querySelector('.toast')?.getBoundingClientRect().bottom, dock: document.querySelector('.mbar').getBoundingClientRect().top }))
            expect(r.toast != null && r.toast <= r.dock, `toast bottom ${r.toast}, bar top ${r.dock}`)
            return `toast bottom ${Math.round(r.toast)} ≤ bar top ${Math.round(r.dock)}`
          })
        } else {
          await t.step(`${vp} ${route}: reply box 44px collapsed, grows to 5 lines then scrolls; buttons 44×44`, async () => {
            const ta = page.locator('#th-reply')
            const h0 = (await ta.boundingBox()).height
            await ta.fill('一\n二\n三')
            await page.waitForTimeout(150)
            const h3 = (await ta.boundingBox()).height
            await ta.fill('1\n2\n3\n4\n5\n6\n7\n8')
            await page.waitForTimeout(150)
            const h8 = (await ta.boundingBox()).height
            const r = await page.evaluate(() => {
              const el = document.querySelector('#th-reply')
              const lh = parseFloat(getComputedStyle(el).lineHeight)
              const btns = [...document.querySelectorAll('form.composer .cbtns > *')].map((b) => b.getBoundingClientRect()).map((b) => [Math.round(b.width), Math.round(b.height)])
              return { lh, oy: getComputedStyle(el).overflowY, scroll: el.scrollHeight > el.clientHeight, btns }
            })
            expect(Math.round(h0) === 44, `collapsed height ${h0}`)
            expect(h3 > h0 && h8 > h3, `heights ${h0} → ${h3} → ${h8}`)
            expect(h8 <= r.lh * 5 + 24 && r.scroll && r.oy === 'auto', `8 lines: ${h8}px, overflow ${r.oy}`)
            expect(r.btns.every(([w, h]) => w >= 44 && h >= 44), `buttons ${JSON.stringify(r.btns)}`)
            await ta.fill('')
            return `${Math.round(h0)} → ${Math.round(h3)} → ${Math.round(h8)}px (max 5 lines)`
          })
          await t.step(`${vp} ${route}: toast appears above the reply box`, async () => {
            await page.evaluate(() => window.__TV__.store.toasts.push({ id: 99902, text: 'QA', kind: 'ok' }))
            await page.waitForTimeout(250)
            const r = await page.evaluate(() => ({ toast: document.querySelector('.toast')?.getBoundingClientRect().bottom, dock: document.querySelector('form.composer').getBoundingClientRect().top }))
            expect(r.toast != null && r.toast <= r.dock, `toast bottom ${r.toast}, reply box top ${r.dock}`)
          })
        }
        await t.step(`${vp} ${route}: header search opens the full-screen palette; Esc returns focus to it`, async () => {
          const s = page.locator('header .m-search')
          await s.click()
          const d = page.locator('[role=dialog]').filter({ has: page.locator('input') }).last()
          await d.waitFor({ state: 'visible', timeout: 3000 })
          const b = await d.boundingBox()
          const [w, h] = vp.split('x').map(Number)
          expect(b.width >= w - 2 && b.height >= h - 2, `palette ${Math.round(b.width)}×${Math.round(b.height)} is not full screen`)
          await page.keyboard.press('Escape')
          await page.waitForTimeout(300)
          expect(await s.evaluate((el) => el === document.activeElement), 'focus did not return to the search button')
        })
        await t.noConsoleErrors(`${vp} ${route}: no console errors`)
        await t.close()
      }
      for (const route of ['/u/mochidon', '/tools/rt']) {
        const page = await t.open({ vp, route })
        await t.step(`${vp} ${route}: tab bar present, no header search`, async () => {
          const r = await page.evaluate(() => ({ tab: !!document.querySelector('nav.tabbar'), s: !!document.querySelector('header .m-search') }))
          expect(r.tab && !r.s, JSON.stringify(r))
        })
        await t.close()
      }
    }

    // short viewports as a keyboard proxy: reply box focused
    for (const vp of ['390x480', '360x420']) {
      const page = await t.open({ vp, route: '/community/t/4017' })
      await t.step(`${vp}: reply box focused — box, header and some content all visible`, async () => {
        await page.evaluate(() => window.scrollTo(0, 900))
        await page.waitForTimeout(200)
        const y0 = await page.evaluate(() => scrollY)
        await page.locator('#th-reply').focus()
        await page.waitForTimeout(300)
        const r = await page.evaluate(() => {
          const c = document.querySelector('form.composer').getBoundingClientRect()
          const bar = document.querySelector('header.bar').getBoundingClientRect()
          return { vh: innerHeight, cTop: c.top, cBottom: c.bottom, barBottom: bar.bottom, y: scrollY, sw: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth }
        })
        expect(r.cBottom <= r.vh + 0.5 && r.cTop > r.barBottom + 80, `reply box ${Math.round(r.cTop)}–${Math.round(r.cBottom)}, header ends ${Math.round(r.barBottom)}, viewport ${r.vh}`)
        expect(Math.abs(r.y - y0) <= 2, `reading position jumped ${y0} → ${r.y}`)
        expect(r.sw <= r.vw + 1, 'horizontal overflow')
        return `content band ${Math.round(r.cTop - r.barBottom)}px between header and reply box`
      })
      await t.close()
    }

    // back restores list state
    let page = await t.open({ vp: '390x844', route: '/songs?shelf=all&star=10' })
    await t.step('390: /songs filters + scroll → detail → header back restores both', async () => {
      await page.evaluate(() => window.scrollTo(0, 2400))
      await page.waitForTimeout(400)
      const h0 = await t.hash()
      const y0 = await page.evaluate(() => scrollY)
      const row = await firstVisible(page.locator('main ul.mlist > li a, main ul.mlist > li').filter({ hasText: /./ }))
      const rows = page.locator('main ul.mlist > li')
      const n = await rows.count()
      for (let i = 0; i < n; i++) {
        const b = await rows.nth(i).boundingBox()
        if (b && b.y > 140 && b.y + b.height < 760) {
          await rows.nth(i).locator('a').first().click()
          break
        }
      }
      await page.waitForTimeout(600)
      expect(/#\/songs\/\d+/.test(await t.hash()), `not on a detail page: ${await t.hash()}`)
      await page.locator('header .back').click()
      await page.waitForTimeout(800)
      const h1 = await t.hash()
      const y1 = await page.evaluate(() => scrollY)
      expect(h1 === h0, `hash ${h1}, expected ${h0}`)
      expect(Math.abs(y1 - y0) <= 40, `scrollY ${y1}, expected ${y0}`)
      expect(!!row, 'no row')
      return `${h0} @ ${y0}`
    })
    await t.close()
    page = await t.open({ vp: '390x844', route: '/community' })
    await t.step('390: /community feed + section + scroll → thread → header back restores all', async () => {
      await page.locator('main').getByRole('tab', { name: /热门/ }).first().click()
      await page.waitForTimeout(300)
      await page.locator('main .mboards').getByRole('button', { name: /谱面攻略/ }).first().click()
      await page.waitForTimeout(400)
      await page.evaluate(() => window.scrollTo(0, 900))
      await page.waitForTimeout(400)
      const h0 = await t.hash()
      const y0 = await page.evaluate(() => scrollY)
      expect(/feed=hot/.test(h0) && /section=/.test(h0), `hash ${h0}`)
      const links = page.locator('main a[href*="#/community/t/"]')
      const n = await links.count()
      for (let i = 0; i < n; i++) {
        const b = await links.nth(i).boundingBox()
        if (b && b.y > 140 && b.y + b.height < 760) {
          await links.nth(i).click()
          break
        }
      }
      await page.waitForTimeout(600)
      expect(/#\/community\/t\//.test(await t.hash()), `not on a thread: ${await t.hash()}`)
      await page.locator('header .back').click()
      await page.waitForTimeout(800)
      const h1 = await t.hash()
      const y1 = await page.evaluate(() => scrollY)
      expect(h1 === h0, `hash ${h1}, expected ${h0}`)
      expect(Math.abs(y1 - y0) <= 40, `scrollY ${y1}, expected ${y0}`)
      return `${h0} @ ${y0}`
    })
    await t.close()
    page = await t.open({ vp: '390x844', route: '/songs?star=9' })
    await t.step('390: palette → song → header back returns to the list', async () => {
      const h0 = await t.hash()
      await page.locator('nav.tabbar').getByRole('button', { name: /搜索/ }).click()
      const inp = page.locator('[role=dialog] input').last()
      await inp.fill('千本')
      await page.waitForTimeout(400)
      await page.locator('[role=dialog] [role=option]').first().tap()
      await page.waitForTimeout(600)
      expect(/#\/songs\/\d+/.test(await t.hash()), `not on a song: ${await t.hash()}`)
      await page.locator('header .back').click()
      await page.waitForTimeout(600)
      expect((await t.hash()) === h0, `hash ${await t.hash()}, expected ${h0}`)
    })
    await t.noConsoleErrors()
  },
}
