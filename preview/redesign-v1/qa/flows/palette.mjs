// Q4 / P1–P10: command palette, desktop keyboard flow and phone full-screen flow.
import { expect, firstVisible, activeInfo } from '../lib/flowkit.mjs'

const QUERIES = [
  // Phase B（docs/19 G9）：V1.2 的千本桜 / 紅蓮華 等精选曲换成了真实曲号与曲名，查询改用同一类型的真实曲目
  { q: '天狗', expect: /天狗[配囃]/, label: 'title prefix (zh)' },
  { q: 'テングバヤシ', expect: /天狗[配囃]/, label: 'katakana reading' },
  { q: 'kien', expect: /kien|别名|別名/i, label: 'alias' },
  { q: 'HOLIC', expect: /HOLIC/i, label: 'artist' },
  { q: '16 oxxo 180 鬼10', expect: /oxxo|配置|BPM|小节|小節/i, label: 'pattern string (P3)' },
  { q: '765', expect: /物量|765/, label: 'note count (P4)' },
  { q: '全良', expect: /全良/, label: 'term / thread' },
  { q: '同步', expect: /同步成绩|同步/, label: 'action (P6)' },
]

export const dialogSel = '[role=dialog]'
export async function paletteParts(page) {
  const dialog = page.locator(dialogSel).filter({ has: page.locator('input') }).last()
  const input = dialog.locator('[role=combobox], input').first()
  const options = dialog.locator('[role=option]')
  const legacy = dialog.locator('.item')
  return { dialog, input, options: (await options.count()) ? options : legacy, hasOptionRole: (await options.count()) > 0 }
}
async function setQuery(page, q) {
  const { input } = await paletteParts(page)
  await input.fill('')
  await input.fill(q)
  await page.waitForTimeout(350)
  const p = await paletteParts(page)
  const n = await p.options.count()
  const text = n ? await p.dialog.innerText() : ''
  return { n, text, p }
}
async function activeIndex(page) {
  return page.evaluate(() => {
    const d = [...document.querySelectorAll('[role=dialog]')].pop()
    if (!d) return -1
    const opts = [...d.querySelectorAll('[role=option]')]
    const list = opts.length ? opts : [...d.querySelectorAll('.item')]
    const inp = d.querySelector('input')
    const ad = inp?.getAttribute('aria-activedescendant')
    if (ad) return list.findIndex((o) => o.id === ad)
    return list.findIndex((o) => o.getAttribute('aria-selected') === 'true' || o.classList.contains('on'))
  })
}

export const paletteDesktop = {
  name: 'palette-desktop',
  quick: true,
  timeoutMs: 120_000,
  async run(t) {
    const page = await t.open({ vp: '1440x900', route: '/' })
    await t.step(
      'Ctrl+K opens palette with focus in input',
      async () => {
        await page.keyboard.press('Control+k')
        const { dialog } = await paletteParts(page)
        await dialog.waitFor({ state: 'visible', timeout: 3000 })
        const a = await activeInfo(page)
        expect(a?.tag === 'INPUT', `focus is on ${a?.tag}.${a?.cls}`)
      },
      { critical: true },
    )
    await t.step('input is a combobox with listbox/option results (P7)', async () => {
      const r = await page.evaluate(() => {
        const d = [...document.querySelectorAll('[role=dialog]')].pop()
        const i = d.querySelector('input')
        return { role: i.getAttribute('role'), listbox: !!d.querySelector('[role=listbox]') }
      })
      await setQuery(page, '天狗')
      const opt = await page.locator('[role=dialog] [role=option]').count()
      expect(r.role === 'combobox' && r.listbox && opt > 0, `input role=${r.role}, listbox=${r.listbox}, options=${opt}`)
    })
    for (const q of QUERIES) {
      await t.step(`query ${q.label}: "${q.q}"`, async () => {
        const { n, text } = await setQuery(page, q.q)
        expect(n > 0, `no results for "${q.q}"`)
        expect(q.expect.test(text), `results for "${q.q}" do not mention ${q.expect}`)
        return `${n} results`
      })
    }
    await t.step('↑ ↓ cycle, Home / End', async () => {
      const { n } = await setQuery(page, 'a')
      expect(n >= 3, `need ≥3 results for keyboard test, got ${n}`)
      const i0 = await activeIndex(page)
      await page.keyboard.press('ArrowDown')
      const i1 = await activeIndex(page)
      expect(i1 !== i0 && i1 >= 0, `ArrowDown did not move active item (${i0}→${i1})`)
      await page.keyboard.press('End')
      const iEnd = await activeIndex(page)
      expect(iEnd === n - 1, `End → ${iEnd}, expected ${n - 1}`)
      await page.keyboard.press('ArrowDown')
      const iWrap = await activeIndex(page)
      expect(iWrap === 0, `ArrowDown at end → ${iWrap}, expected wrap to 0`)
      await page.keyboard.press('ArrowUp')
      expect((await activeIndex(page)) === n - 1, 'ArrowUp at start did not wrap to end')
      await page.keyboard.press('Home')
      expect((await activeIndex(page)) === 0, 'Home did not go to first item')
    })
    await t.step('Enter on "天狗" navigates to a song', async () => {
      await setQuery(page, '天狗')
      await page.keyboard.press('Home').catch(() => {})
      await page.keyboard.press('Enter')
      await page.waitForTimeout(500)
      const h = await t.hash()
      expect(/^#\/songs\/\d+/.test(h), `hash after Enter: ${h}`)
      const open = await page.locator(dialogSel).filter({ has: page.locator('input') }).count()
      expect(open === 0, 'palette still open after navigation')
    })
    await t.step('focus moves to main content after navigation (P8)', async () => {
      const inMain = await page.evaluate(() => !!document.activeElement?.closest('main') || document.activeElement?.tagName === 'MAIN')
      expect(inMain, 'focus is not inside <main> after palette navigation')
    })
    await t.step('Esc closes and returns focus to opener', async () => {
      const opener = await firstVisible(page.locator('header button').filter({ hasText: /搜索|検索|Ctrl/ }))
      expect(opener, 'desktop search button not found in header')
      await opener.click()
      const { dialog } = await paletteParts(page)
      await dialog.waitFor({ state: 'visible', timeout: 3000 })
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
      expect((await page.locator(dialogSel).filter({ has: page.locator('input') }).count()) === 0, 'palette did not close on Esc')
      const back = await opener.evaluate((el) => el === document.activeElement)
      expect(back, `focus after Esc is on ${JSON.stringify(await activeInfo(page))}`)
    })
    await t.step('Ctrl+K toggles closed', async () => {
      await page.keyboard.press('Control+k')
      await (await paletteParts(page)).dialog.waitFor({ state: 'visible', timeout: 3000 })
      await page.keyboard.press('Control+k')
      await page.waitForTimeout(300)
      expect((await page.locator(dialogSel).filter({ has: page.locator('input') }).count()) === 0, 'second Ctrl+K did not close')
    })
    await t.step('"/" opens palette outside inputs', async () => {
      await page.locator('main').first().click({ position: { x: 5, y: 5 } }).catch(() => {})
      await page.keyboard.press('/')
      const ok = await (await paletteParts(page)).dialog.isVisible().catch(() => false)
      if (ok) await page.keyboard.press('Escape')
      expect(ok, '"/" did not open the palette')
    })
    await t.noConsoleErrors()
  },
}

export const palettePhone = {
  name: 'palette-phone',
  quick: true,
  timeoutMs: 90_000,
  async run(t) {
    const page = await t.open({ vp: '390x844', route: '/' })
    await t.step(
      'center 咚 button opens full-screen palette',
      async () => {
        const btn = await firstVisible(page.locator('nav').getByRole('button', { name: /搜索|検索/ }))
        expect(btn, 'center search button not found in bottom bar')
        await btn.tap()
        const { dialog } = await paletteParts(page)
        await dialog.waitFor({ state: 'visible', timeout: 3000 })
        const r = await dialog.boundingBox()
        expect(r && r.width >= 385 && r.height >= 780, `palette box ${r?.width}×${r?.height}, expected full screen`)
      },
      { critical: true },
    )
    await t.step('cancel button present on the input row', async () => {
      const c = await firstVisible(page.locator('[role=dialog]').getByRole('button', { name: /取消|キャンセル/ }))
      expect(c, 'no 取消 button')
    })
    await t.step('empty state shows example chips that fill the query and show results', async () => {
      const { dialog, input } = await paletteParts(page)
      await input.fill('')
      await page.waitForTimeout(200)
      const chips = dialog.locator('button:not([role=option])').filter({ hasNotText: /^(取消|キャンセル)$/ })
      const n = await chips.count()
      let used = null
      for (let i = 0; i < n && !used; i++) {
        const c = chips.nth(i)
        if (!(await c.isVisible())) continue
        const txt = (await c.innerText()).trim()
        if (!txt || /清除|クリア/.test(txt)) continue
        await c.tap()
        await page.waitForTimeout(350)
        expect(await dialog.isVisible().catch(() => false), `tapping "${txt}" closed the palette instead of filling the query`)
        const v = await input.inputValue()
        if (v) used = { txt, v }
      }
      expect(used, 'no example chip filled the query')
      const p = await paletteParts(page)
      expect((await p.options.count()) > 0, `example "${used.v}" produced no results`)
      return `${used.txt} → "${used.v}"`
    })
    await t.step('first tap on a result navigates', async () => {
      const { input } = await paletteParts(page)
      await input.fill('天狗')
      await page.waitForTimeout(350)
      const p = await paletteParts(page)
      const before = await t.hash()
      await p.options.first().tap()
      await page.waitForTimeout(500)
      const after = await t.hash()
      expect(after !== before && /#\/songs\/\d+/.test(after), `hash ${before} → ${after}`)
    })
    await t.noConsoleErrors()
  },
}
