// Q4 / D6 / D12: Sheet = centered dialog on desktop, bottom sheet on phone; focus trap, Esc,
// scrim click, focus restore; account menu keyboard.
import { expect, firstVisible, activeInfo } from '../lib/flowkit.mjs'

const OPENERS = [
  { route: '/growth/goals', name: /换.*目标|选.*目标|新目标|目標を(変|選)/ },
  { route: '/account', name: /编辑资料|修改密码|添加账号|プロフィールを編集/ },
  { route: '/community/new', name: /关联.*谱面|譜面を関連/ },
]

async function findOpener(t, vp) {
  for (const o of OPENERS) {
    await t.go(o.route)
    const b = await firstVisible(t.page.locator('main').locator('button').filter({ hasText: o.name }), 1200)
    if (b) return { ...o, btn: b }
  }
  return null
}
const isOpen = (page) => page.locator('[role=dialog][aria-modal=true]').count()

function overlayFlow(kind) {
  const phone = kind === 'phone'
  return {
    name: `overlay-${kind}`,
    quick: !phone,
    timeoutMs: 90_000,
    async run(t) {
      const page = await t.open({ vp: phone ? '390x844' : '1440x900', route: '/' })
      let op
      await t.step(
        'find a Sheet opener',
        async () => {
          op = await findOpener(t)
          expect(op, 'no known Sheet opener found on goals/account/compose')
          return `${op.route} ${op.name}`
        },
        { critical: true },
      )
      await t.step('Sheet opens with correct placement', async () => {
        await op.btn.evaluate((el) => el.setAttribute('data-qa-opener', '1'))
        await op.btn.click()
        const d = page.locator('[role=dialog][aria-modal=true]').last()
        await d.waitFor({ state: 'visible', timeout: 3000 })
        await page.waitForTimeout(400)
        const r = await d.boundingBox()
        const vw = phone ? 390 : 1440
        const vh = phone ? 844 : 900
        if (phone) expect(r.y + r.height >= vh - 2 && r.width >= vw - 2, `phone sheet box ${JSON.stringify(r)} is not a bottom sheet`)
        else expect(Math.abs(r.x + r.width / 2 - vw / 2) < 40 && Math.abs(r.y + r.height / 2 - vh / 2) < 80, `desktop dialog box ${JSON.stringify(r)} not centered`)
      })
      await t.step('focus is inside the dialog and Tab is trapped', async () => {
        const inside = () => page.evaluate(() => !!document.activeElement?.closest('[role=dialog][aria-modal=true]'))
        expect(await inside(), `focus after open: ${JSON.stringify(await activeInfo(page))}`)
        for (let i = 0; i < 15; i++) {
          await page.keyboard.press(i % 5 === 4 ? 'Shift+Tab' : 'Tab')
          expect(await inside(), `focus escaped dialog after ${i + 1} Tab presses: ${JSON.stringify(await activeInfo(page))}`)
        }
      })
      await t.step('Esc closes and restores focus to opener', async () => {
        await page.keyboard.press('Escape')
        await page.waitForTimeout(400)
        expect((await isOpen(page)) === 0, 'dialog still open after Esc')
        const back = await page.evaluate(() => document.activeElement?.getAttribute('data-qa-opener') === '1')
        expect(back, `focus after close: ${JSON.stringify(await activeInfo(page))}`)
      })
      await t.step('scrim click closes and restores focus', async () => {
        await page.locator('[data-qa-opener]').click()
        await page.locator('[role=dialog][aria-modal=true]').last().waitFor({ state: 'visible', timeout: 3000 })
        await page.waitForTimeout(300)
        await page.mouse.click(phone ? 195 : 30, phone ? 40 : 30)
        await page.waitForTimeout(400)
        expect((await isOpen(page)) === 0, 'dialog still open after scrim click')
        const back = await page.evaluate(() => document.activeElement?.getAttribute('data-qa-opener') === '1')
        expect(back, `focus after scrim close: ${JSON.stringify(await activeInfo(page))}`)
      })
      if (!phone) {
        await t.go('/')
        await t.step('account menu: open, ↑↓ between items, Esc restores focus', async () => {
          const btn = await firstVisible(page.locator('header [aria-haspopup=menu]'), 1500)
          expect(btn, 'no account menu button')
          await btn.focus()
          await page.keyboard.press('Enter')
          const menu = page.locator('[role=menu]')
          await menu.waitFor({ state: 'visible', timeout: 2000 })
          await page.keyboard.press('ArrowDown')
          const a1 = await page.evaluate(() => document.activeElement?.getAttribute('role') === 'menuitem' && document.activeElement.textContent.trim())
          await page.keyboard.press('ArrowDown')
          const a2 = await page.evaluate(() => document.activeElement?.getAttribute('role') === 'menuitem' && document.activeElement.textContent.trim())
          expect(a1 && a2 && a1 !== a2, `ArrowDown did not move between menuitems (${a1} → ${a2})`)
          await page.keyboard.press('Escape')
          await page.waitForTimeout(250)
          expect(!(await menu.isVisible().catch(() => false)), 'menu still open after Esc')
          expect(await btn.evaluate((el) => el === document.activeElement), 'focus not restored to menu button')
        })
      }
      await t.noConsoleErrors()
    },
  }
}
export const overlayDesktop = overlayFlow('desktop')
export const overlayPhone = overlayFlow('phone')
