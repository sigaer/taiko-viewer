// Q4: login validation, compose validation, bind 3-step flow to completion.
import { expect, firstVisible } from '../lib/flowkit.mjs'

const VALIDATION = /请输入|必填|不能为空|至少|不正确|入力してください|必須|[0-9]+ ?位/
async function hasValidation(page) {
  const alert = await page.locator('main [role=alert], main [aria-invalid=true], main .field-error, main .err').count()
  const text = await page.locator('main').innerText()
  return alert > 0 || VALIDATION.test(text)
}

export const forms = {
  name: 'forms',
  quick: false,
  timeoutMs: 90_000,
  async run(t) {
    let page = await t.open({ vp: '1440x900', state: { auth: 'guest' }, route: '/login' })
    await t.step('login: empty submit shows a validation error', async () => {
      expect(!(await hasValidation(page)), 'validation text visible before submitting')
      const b = await firstVisible(page.locator('main form button[type=submit]'), 2000)
      expect(b, 'no 登录 submit button')
      await b.click()
      await page.waitForTimeout(400)
      expect(await hasValidation(page), 'no validation message after empty submit')
      expect(!(await t.hash()).match(/^#\/$/), 'navigated away despite empty form')
    })
    await t.close()
    page = await t.open({ vp: '1440x900', state: { auth: 'ready' }, route: '/community/new' })
    await t.step('compose: empty publish shows a validation error', async () => {
      const b = await firstVisible(page.locator('main form button[type=submit], main button, header button').filter({ hasText: /^\s*(发布|投稿|发帖)/ }), 2000)
      expect(b, 'no 发布 button')
      if (await b.isDisabled()) return 'publish disabled until valid (acceptable)'
      await b.click()
      await page.waitForTimeout(400)
      expect(await hasValidation(page), 'no validation message after empty publish')
    })
    await t.close()
    page = await t.open({ vp: '390x844', state: { auth: 'unbound' }, route: '/bind' })
    await t.step('bind: three steps to completion', async () => {
      // ① 查找 ID → ② 改称号并确认 → ③ 第一次同步 → 结果页「进入今日」
      const log = []
      for (let i = 0; i < 8; i++) {
        if (await firstVisible(page.locator('main').getByRole('button', { name: /进入今日|「今日」へ進む/ }), 300)) return log.join(' → ') + ' → done'
        for (const inp of await page.locator('main input:visible').all()) {
          const type = (await inp.getAttribute('type')) || 'text'
          if (type === 'checkbox' || type === 'radio') {
            if (!(await inp.isChecked())) await inp.check({ force: true }).catch(() => {})
          } else if (!(await inp.inputValue())) await inp.fill(type === 'password' ? 'qa-test-pass-1' : '123456789012')
        }
        const next = await firstVisible(page.locator('main button:not([disabled])').filter({ hasText: /查找|立即确认|开始同步|下一步|继续|検索|確認|同期を開始|次へ/ }), 1500)
        expect(next, `step ${i + 1}: no enabled next/confirm button (log: ${log.join(' → ')})`)
        const label = (await next.innerText()).trim().slice(0, 12)
        log.push(label)
        await next.click()
        await page.waitForTimeout(/同步|同期/.test(label) ? 6000 : 1500)
      }
      expect(false, `not completed after 8 actions: ${log.join(' → ')}`)
    })
    await t.noConsoleErrors()
  },
}
