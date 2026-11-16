// Q4: theme and locale toggles from the UI (desktop rail and phone /me).
import { expect, firstVisible } from '../lib/flowkit.mjs'

const html = (page) => page.evaluate(() => ({ theme: document.documentElement.dataset.theme, lang: document.documentElement.lang }))

export const toggles = {
  name: 'toggles',
  quick: false,
  timeoutMs: 60_000,
  async run(t) {
    let page = await t.open({ vp: '1440x900', route: '/' })
    await t.step('desktop theme toggle flips data-theme', async () => {
      const b = await firstVisible(page.getByRole('button', { name: /深浅色|主题|テーマ|theme/i }), 2000)
      expect(b, 'no theme toggle button')
      const a = await html(page)
      await b.click()
      await page.waitForTimeout(250)
      const z = await html(page)
      expect(a.theme !== z.theme, `data-theme ${a.theme} → ${z.theme}`)
    })
    await t.step('desktop locale toggle updates html[lang]', async () => {
      const b = await firstVisible(page.getByRole('button', { name: /切换语言|言語|language/i }), 2000)
      expect(b, 'no locale toggle button')
      await b.click()
      await page.waitForTimeout(250)
      const z = await html(page)
      expect(z.lang.startsWith('ja'), `html[lang]=${z.lang} after toggle`)
      await b.click()
      await page.waitForTimeout(250)
      expect((await html(page)).lang.startsWith('zh'), 'did not switch back to zh')
    })
    await t.noConsoleErrors('desktop: no console errors')
    await t.close()
    page = await t.open({ vp: '390x844', route: '/me' })
    await t.step('phone /me: language switch to 日本語', async () => {
      const b = await firstVisible(page.locator('main').getByRole('button', { name: /日本語/ }), 2000)
      expect(b, 'no 日本語 control on /me')
      await b.click()
      await page.waitForTimeout(250)
      expect((await html(page)).lang.startsWith('ja'), 'html[lang] did not become ja')
    })
    await t.step('phone /me: dark theme control', async () => {
      const b = await firstVisible(page.locator('main').getByRole('button', { name: /深色|ダーク/ }), 2000)
      expect(b, 'no dark-theme control on /me')
      await b.click()
      await page.waitForTimeout(250)
      expect((await html(page)).theme === 'dark', 'data-theme not dark')
    })
    await t.noConsoleErrors('phone: no console errors')
  },
}
