import assert from 'node:assert/strict';

export async function navigationRegression({ page, click, settled, row, setFailure, switchIdentity, out }) {
  await click('/my/weekly'); await settled('/my/weekly');
  const reads = path => row.requests.filter(r => r.path === path).length;
  const before = reads('/api/account/growth/weekly');
  await page.goBack(); await page.locator('.my-page').waitFor();
  await page.goForward(); await page.locator('.weekly-hero').waitFor();
  assert.equal(reads('/api/account/growth/weekly'), before, 'history reuses successful weekly data');
  await page.waitForFunction(() => document.querySelector('[data-nav-key="/my/weekly"]')?.classList.contains('is-active'));
  for (const [path, refresh, alert] of [
    ['/api/account/growth/weekly', '.weekly-refresh', '.weekly-state[role="alert"]'],
    ['/api/account/growth/passport', null, '.passport-state[role="alert"]']
  ]) {
    if (path.endsWith('passport')) { await click('/my/growth'); await settled('/my/growth'); }
    setFailure(path);
    if (refresh) await page.locator(refresh).click();
    else await page.evaluate(() => window.__navQA.refresh('growth-passport:'));
    await page.locator(alert).waitFor();
    assert.ok(!/AbortError/.test(await page.locator(alert).innerText()));
    setFailure('');
    await page.locator(`${alert} button`).click();
    await settled(path.endsWith('weekly') ? '/my/weekly' : '/my/growth');
  }
  // Changes made while the pages are cached must not launch hidden reads.
  await click('/my'); await settled('/my');
  row.passportBeforeIdentity = reads('/api/account/growth/passport');
  const hiddenBefore = row.requests.length;
  await switchIdentity();
  await page.waitForTimeout(100);
  assert.equal(row.requests.length, hiddenBefore, 'no hidden identity reads');
  await click('/my/growth'); await settled('/my/growth');
  const snapshot = await page.evaluate(() => window.__navQA.snapshot());
  const passport = Object.values(snapshot.reads).find(read => read.profileId);
  assert.equal(passport.profileId, '2', 'latest binding wins');
  assert.equal(reads('/api/account/growth/passport'), row.passportBeforeIdentity + 1);
  await click('/account/songs'); await settled('/account/songs');
  const input = page.locator('.filter-row input').first();
  await input.fill('retained filter');
  await click('/my'); await settled('/my');
  await click('/account/songs'); await settled('/account/songs');
  assert.equal(await input.inputValue(), 'retained filter');

  const titles = page.locator('.nav-title');
  await titles.nth(0).focus(); await titles.nth(0).press('Enter');
  assert.equal(await titles.nth(0).getAttribute('aria-expanded'), 'true');
  await titles.nth(0).press('Tab');
  assert.ok(await page.evaluate(() => document.activeElement?.closest('.nav-panel') && !document.activeElement.closest('[inert]')));
  await page.keyboard.press('Enter'); // song catalog submenu
  await page.keyboard.press('ArrowDown');
  assert.ok(await page.evaluate(() => document.activeElement?.classList.contains('el-menu-item')));
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press(' '); // close it again
  const discover = page.locator('.nav-group').nth(0);
  const guide = discover.locator('.nav-menu > .el-sub-menu').nth(2);
  await guide.locator(':scope > .el-sub-menu__title').click();
  await guide.locator('.el-sub-menu').nth(3).locator(':scope > .el-sub-menu__title').click();
  assert.ok(await discover.locator('.el-sub-menu.is-opened .el-sub-menu.is-opened .el-menu-item').count() > 0, 'third-level guide is open');
  // Direct entries exercise programmatic route highlighting and ancestor open.
  await page.evaluate(prefix => { void window.__navQA.navigate(`${prefix}/guide/4/9`); }, row.locale === 'ja' ? '/ja' : '');
  await page.waitForURL('**/guide/4/9');
  await page.waitForFunction(() => [...document.querySelectorAll('.el-menu-item.is-active')].some(el => /9/.test(el.textContent)));
  assert.equal(await page.locator('.el-menu-item.is-active').count(), 1, 'only the current menu is highlighted');
  assert.ok(await discover.locator('.el-sub-menu.is-opened .el-sub-menu.is-opened').count() > 0);
  await page.screenshot({ path: `${out}/guide-third-level-${row.locale}-${row.dark ? 'dark' : 'light'}.png` });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const transition = await page.locator('.nav-panel').first().evaluate(el => { el.classList.add('nav-expand-enter-active'); const value = getComputedStyle(el).transitionDuration; el.classList.remove('nav-expand-enter-active'); return value; });
  assert.equal(transition, '0s');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  assert.equal(await page.locator('.nav-panel').first().evaluate(el => { el.classList.add('nav-expand-enter-active'); const value = getComputedStyle(el).transitionDuration; el.classList.remove('nav-expand-enter-active'); return value; }), '0s', 'mobile keeps instant group switching');
  await page.setViewportSize({ width: 1440, height: 900 });
  row.regression = 'PASS';
}
