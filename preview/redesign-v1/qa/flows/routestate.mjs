// Q4 / R1–R5: list state in the URL, back restores filters + scroll, difficulty switch keeps params.
import { expect, firstVisible } from '../lib/flowkit.mjs'

const query = (h) => new URLSearchParams((h.split('?')[1] || '').split('#')[0])

export const routeState = {
  name: 'route-state',
  quick: true,
  timeoutMs: 120_000,
  async run(t) {
    const page = await t.open({ vp: '1440x900', route: '/songs' })
    let listHash
    let savedScroll = 0
    await t.step('keyword search writes q= to the URL (debounced, replace)', async () => {
      const inp = await firstVisible(page.locator('main input[type=search], main input.sinput, main input[type=text], main input:not([type])'), 2000)
      expect(inp, 'no search input on /songs')
      const len0 = await page.evaluate(() => history.length)
      await inp.fill('')
      await inp.pressSequentially('sakura', { delay: 40 })
      await page.waitForTimeout(500)
      const h = await t.hash()
      const len1 = await page.evaluate(() => history.length)
      // clear before asserting so later steps start from an unfiltered list
      await inp.fill('')
      await page.waitForTimeout(450)
      expect(query(h).has('q'), `hash after typing: ${h}`)
      expect(len1 - len0 <= 1, `typing pushed ${len1 - len0} history entries (should use replace)`)
    })
    await t.step('filter chip updates the URL', async () => {
      const chip = await firstVisible(page.locator('main button[aria-pressed=false]').filter({ hasText: /★\s?(9|10|8)/ }), 2000)
      expect(chip, 'no star filter chip')
      const before = await t.hash()
      await chip.click()
      await page.waitForTimeout(400)
      listHash = await t.hash()
      expect(listHash !== before && listHash.includes('?'), `hash unchanged after filter: ${listHash}`)
      return listHash
    })
    await t.step('open a song from the scrolled list', async () => {
      await page.evaluate(() => window.scrollTo(0, Math.min(700, document.documentElement.scrollHeight - innerHeight)))
      await page.waitForTimeout(250)
      savedScroll = await page.evaluate(() => scrollY)
      const row = await firstVisible(page.locator('main tbody tr, main a[href*="#/songs/"]'), 2000)
      expect(row, 'no song row')
      // pick a row that is in the viewport
      const rows = page.locator('main tbody tr, main a[href*="#/songs/"]')
      const n = await rows.count()
      let clicked = false
      for (let i = 0; i < n && !clicked; i++) {
        const b = await rows.nth(i).boundingBox()
        if (b && b.y > 120 && b.y < 800) {
          await rows.nth(i).click()
          clicked = true
        }
      }
      if (!clicked) await row.click()
      await page.waitForTimeout(600)
      const h = await t.hash()
      expect(/^#\/songs\/\d+/.test(h), `hash after row click: ${h}`)
      return `scrollY before=${savedScroll}`
    })
    await t.step('switch difficulty replaces d= only', async () => {
      const tabs = page.locator('main [role=tab][aria-selected=false]')
      const tab = await firstVisible(tabs, 2000)
      expect(tab, 'no unselected difficulty tab')
      await tab.click()
      await page.waitForTimeout(300)
      const h = await t.hash()
      expect(query(h).has('d'), `no d= after difficulty change: ${h}`)
    })
    await t.step('browser Back restores filters and scroll position (R3)', async () => {
      for (let i = 0; i < 3; i++) {
        const h = await t.hash()
        if (!/^#\/songs\/\d+/.test(h)) break
        await page.goBack()
        await page.waitForTimeout(500)
      }
      const h = await t.hash()
      expect(h === listHash, `after Back hash=${h}, expected ${listHash}`)
      const y = await page.evaluate(() => scrollY)
      expect(Math.abs(y - savedScroll) <= 40, `scrollY after Back ${y}, expected ≈${savedScroll}`)
      const pressed = await page.locator('main button[aria-pressed=true]').filter({ hasText: /★/ }).count()
      expect(pressed > 0, 'filter chip no longer pressed after Back')
    })
    await t.step('reload restores the view from the URL', async () => {
      await t.reload()
      const pressed = await page.locator('main button[aria-pressed=true]').filter({ hasText: /★/ }).count()
      expect(pressed > 0, 'filter lost after reload')
    })
    await t.step('R1: difficulty switch keeps from/q/m', async () => {
      await page.goto(t.url('/songs/615?from=qa&q=keep&m=3'))
      await page.waitForTimeout(800)
      const tab = await firstVisible(page.locator('main [role=tab][aria-selected=false]'), 2000)
      expect(tab, 'no unselected difficulty tab on /songs/615')
      await tab.click()
      await page.waitForTimeout(300)
      const q = query(await t.hash())
      expect(q.get('from') === 'qa' && q.get('q') === 'keep' && q.get('m') === '3' && q.has('d'), `params after switch: ${q.toString()}`)
    })
    await t.step('R5: other song resets to top', async () => {
      await page.evaluate(() => window.scrollTo(0, 600))
      await t.go('/songs/1')
      const y = await page.evaluate(() => scrollY)
      expect(y < 5, `scrollY ${y} after opening another song`)
    })
    await t.noConsoleErrors()
  },
}
