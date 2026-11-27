// Q4 / S1–S5: sync entry points, 4 auth states × 3 outcomes, phone header button + sheet and
// desktop chip + popover. Outcome is chosen via the prototype state `syncOutcome`.
import { expect, firstVisible } from '../lib/flowkit.mjs'

const RESULT = {
  success: /同步完成|新进展|没有新进展|同期完了|新しい記録/,
  partial: /部分|没有成功|一部/,
  failed: /没有同步成功|同步失败|同期できませんでした|失敗/,
}
const RUNNING = /正在同步|同步中|同期中/
const AUTHS = ['guest', 'unbound', 'empty', 'ready']
const OUTCOMES = ['success', 'partial', 'failed']

function panel(page) {
  return page.locator('[role=dialog]').filter({ hasText: /同步|同期/ }).last()
}
async function waitText(locator, rx, timeout = 7000) {
  const t0 = Date.now()
  let s = ''
  while (Date.now() - t0 < timeout) {
    s = await locator.innerText().catch(() => '')
    if (rx.test(s)) return s
    await new Promise((r) => setTimeout(r, 120))
  }
  throw new Error(`text ${rx} did not appear within ${timeout}ms (saw "${s.replace(/\s+/g, ' ').slice(0, 120)}")`)
}
const phoneButton = (page) => firstVisible(page.locator('header').getByRole('button', { name: /^(同步|同期)/ }), 1500)
const desktopChip = (page) => firstVisible(page.locator('header .syncchip'), 1500)

export function syncFlow(kind) {
  const phone = kind === 'phone'
  return {
    name: `sync-${kind}`,
    quick: true,
    timeoutMs: 360_000,
    stepTimeoutMs: 25_000,
    async run(t) {
      for (const auth of AUTHS) {
        for (const outcome of OUTCOMES) {
          const label = `${auth}/${outcome}`
          const page = await t.open({ vp: phone ? '390x844' : '1440x900', state: { auth, syncOutcome: outcome }, route: '/' })
          if (phone) await phoneCase(t, page, auth, outcome, label)
          else await desktopCase(t, page, auth, outcome, label)
          await t.close()
        }
      }
      if (phone) {
        await t.open({ vp: '390x844', state: { auth: 'ready' }, route: '/me' })
        await t.step('/me has no sync button (S5)', async () => {
          const n = await t.page.locator('main').getByRole('button', { name: /同步|同期/ }).count()
          expect(n === 0, `${n} sync button(s) inside /me main`)
        })
        await t.close()
      }
    },
  }
}

async function phoneCase(t, page, auth, outcome, label) {
  let btn
  const ok = await t.step(`${label}: header button reads its state (S2)`, async () => {
    btn = await phoneButton(page)
    expect(btn, 'no header button named 同步… (S2)')
    const lbl = (await btn.getAttribute('aria-label')) || ''
    expect(/[：:]/.test(lbl), `aria-label "${lbl}" does not read the state`)
    if (auth === 'ready' && outcome === 'success') {
      const n = await page.locator('header .avatar, header [aria-haspopup=menu]').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 0).length)
      expect(n === 0, `${n} avatar/menu button(s) visible in the phone header`)
    }
    return lbl
  })
  if (!ok) return
  const p = panel(page)
  await t.step(`${label}: sheet opens at the bottom`, async () => {
    await btn.click()
    await p.waitFor({ state: 'visible', timeout: 3000 })
    await page.waitForTimeout(350)
    const r = await p.boundingBox()
    expect(r && r.y + r.height >= 842 && r.width >= 388, `sheet box ${JSON.stringify(r)} is not a bottom sheet`)
  })
  if (auth === 'guest') {
    await t.step(`${label}: guest panel offers 登录 + 注册`, async () => {
      expect(await firstVisible(p.getByRole('button', { name: /^(登录|ログイン)$/ }), 1500), 'no 登录 button')
      expect(await firstVisible(p.getByRole('button', { name: /^(注册|新規登録)$/ }), 1500), 'no 注册 button')
    })
    return
  }
  if (auth === 'unbound') {
    await t.step(`${label}: unbound panel shows step 2 and 去绑定`, async () => {
      expect((await p.locator('[aria-current=step]').count()) === 1, 'no current step')
      const b = await firstVisible(p.getByRole('button', { name: /去绑定|連携する/ }), 1500)
      expect(b, 'no 去绑定 button')
      await b.click()
      await page.waitForTimeout(500)
      expect(/#\/bind/.test(await t.hash()), `去绑定 went to ${await t.hash()}`)
    })
    return
  }
  const startRx = auth === 'empty' ? /开始同步|同期を開始/ : /立即同步|今すぐ同期/
  await t.step(`${label}: start → running → ${outcome}`, async () => {
    if (auth === 'empty') await waitText(p, /10 ?秒/, 1500)
    const go = await firstVisible(p.getByRole('button', { name: startRx }), 1500)
    expect(go, `no ${startRx} button in idle panel`)
    await go.click()
    await waitText(p, RUNNING, 2500)
    const s = await waitText(p, RESULT[outcome], 9000)
    if (auth === 'ready') await t.shot(`panel-${outcome}`)
    return s.replace(/\s+/g, ' ').slice(0, 80)
  })
  if (outcome === 'success') {
    await t.step(`${label}: badge returns to idle after success`, async () => {
      const lbl = await (await phoneButton(page)).getAttribute('aria-label')
      expect(!/失败|部分/.test(lbl), `aria-label "${lbl}" after success`)
    })
    return
  }
  await t.step(`${label}: badge reads ${outcome}, retry runs again`, async () => {
    const lbl = (await (await phoneButton(page)).getAttribute('aria-label')) || ''
    expect(outcome === 'failed' ? /失败|失敗/.test(lbl) : /部分|一部/.test(lbl), `aria-label "${lbl}" does not read ${outcome}`)
    const retry = await firstVisible(p.getByRole('button', { name: /重试|再試行/ }), 1500)
    expect(retry, 'retry button missing')
    await retry.click()
    await waitText(p, RUNNING, 2500)
  })
}

async function desktopCase(t, page, auth, outcome, label) {
  if (auth === 'guest') {
    await t.step(`${label}: guest has 登录 instead of a status chip`, async () => {
      expect(!(await desktopChip(page)), 'status chip shown to a guest')
      expect(await firstVisible(page.locator('header').getByRole('link', { name: /^(登录|ログイン)$/ }), 1500), 'no 登录 in header')
    })
    return
  }
  let chip
  const ok = await t.step(`${label}: status chip present with next action`, async () => {
    chip = await desktopChip(page)
    expect(chip, 'no .syncchip in header (S4)')
    const txt = (await chip.innerText()).trim()
    if (auth === 'unbound') expect(/绑定|連携/.test(txt), `chip text "${txt}"`)
    if (auth === 'empty') expect(/同步|同期/.test(txt), `chip text "${txt}"`)
    return txt
  })
  if (!ok) return
  if (auth === 'unbound' || auth === 'empty') {
    await t.step(`${label}: chip leads to the next step`, async () => {
      await chip.click()
      await page.waitForTimeout(600)
      const h = await t.hash()
      expect(auth === 'unbound' ? /#\/bind/.test(h) : /#\/account\/sync/.test(h), `chip went to ${h}`)
    })
    if (auth === 'empty') {
      await t.step(`${label}: /account/sync main button → ${outcome}`, async () => {
        const main = page.locator('main')
        const go = await firstVisible(main.getByRole('button', { name: /开始(第一次)?同步|立即同步|同期を開始|今すぐ同期/ }), 2000)
        expect(go, 'no start button on /account/sync')
        await go.click()
        await waitText(page.locator('body'), RUNNING, 2500)
        await waitText(main, RESULT[outcome], 9000)
      })
    }
    return
  }
  // ready: idle click starts directly (S4)
  await t.step(`${label}: chip click → running → ${outcome}`, async () => {
    await chip.click()
    await waitText(chip, RUNNING, 2500)
    const s = await waitText(chip, outcome === 'success' ? /刚刚同步|新进展|同期/ : outcome === 'partial' ? /部分|一部/ : /失败|失敗/, 9000)
    return s.trim()
  })
  if (outcome === 'success') return
  await t.step(`${label}: chip opens popover with reason and retry`, async () => {
    await chip.click()
    const p = panel(page)
    await p.waitFor({ state: 'visible', timeout: 2500 })
    await waitText(p, RESULT[outcome], 1500)
    const r = await p.boundingBox()
    const c = await chip.boundingBox()
    expect(r.y >= c.y + c.height - 2, 'popover is not anchored below the chip')
    await t.shot(`popover-${outcome}`)
    const retry = await firstVisible(p.getByRole('button', { name: /重试|再試行/ }), 1500)
    expect(retry, 'retry button missing')
    await retry.click()
    await waitText(await desktopChip(page), RUNNING, 2500)
    await page.keyboard.press('Escape')
  })
}
