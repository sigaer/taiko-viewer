// Built production Nuxt with an empty isolated test DB. Provider listings and
// existing account pages are real routes; no real external provider is enabled.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdir, open, realpath, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';
import { chromium } from 'playwright-core';

const pause = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await fn()) return; await pause(60); }
  throw Error('Owned Nuxt deadline');
}

test('built Nuxt OIDC disabled and enabled pages in zh/ja at 375, 414 and desktop', { timeout: 180000 }, async () => {
  assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION, '1');
  const E = process.env.QA_EVIDENCE_DIR, scratch = await realpath(process.env.QA_RUN_TMPDIR);
  const root = resolve(scratch, 'oidc-ui');
  const pool = mysql.createPool({ host: process.env.TAIKO_DB_HOST, port: Number(process.env.TAIKO_DB_PORT), user: process.env.TAIKO_DB_USER, password: process.env.TAIKO_DB_PASSWORD, database: process.env.TAIKO_DB_NAME, connectionLimit: 3 });
  let host, hostDone, browser, context, page, base, log;
  const cases = [], errors = [], deniedOrigins = [];
  try {
    const [[proof]] = await pool.query('SELECT DATABASE() name,@@datadir datadir');
    assert.match(proof.name, /_test$/); assert.equal(await realpath(proof.datadir), await realpath(process.env.TAIKO_TEST_MYSQL_DATADIR));
    for (const folder of ['', 'userdata', 'cache', 'annual', 'viewer-cache']) await mkdir(resolve(root, folder), { recursive: true });
    await writeFile(resolve(root, 'config.json'), '{}'); await writeFile(resolve(root, 'catalog.json'), '[]');
    const env = { PATH: process.env.PATH, NODE_ENV: 'production', NODE_OPTIONS: '--max-old-space-size=1024', TMPDIR: scratch,
      QA_RUN_ID: process.env.QA_RUN_ID, QA_RUN_DIR: process.env.QA_RUN_DIR, QA_RUN_TMPDIR: scratch,
      TAIKO_TEST_MYSQL_DATADIR: process.env.TAIKO_TEST_MYSQL_DATADIR, TAIKO_ALLOW_TEST_DB_MUTATION: '1', NUXT_ANNUAL_STARTUP_MODE: 'owned-qa',
      NUXT_REPO_ROOT: root, NUXT_USERDATA_DIR: resolve(root, 'userdata'), NUXT_TAIKO_CONFIG_PATH: resolve(root, 'config.json'), NUXT_ACCOUNT_CACHE_DIR: resolve(root, 'cache'),
      NUXT_ANNUAL_CACHE_DIR: resolve(root, 'annual'), NUXT_VIEWER_CACHE_DIR: resolve(root, 'viewer-cache'), NUXT_SONG_DATA_PATH: resolve(root, 'catalog.json'),
      TAIKO_RUNTIME_ENV_FILE: resolve(root, 'absent.env'), TAIKO_PYTHON_EXECUTABLE: process.env.TAIKO_PYTHON_EXECUTABLE,
      NUXT_PUBLIC_API_BASE: 'http://127.0.0.1:1', NUXT_PUBLIC_GUIDE_API_BASE: 'http://127.0.0.1:1', NUXT_TAIKO_API_BASE: 'http://127.0.0.1:1', NUXT_TAIKO_ADMIN_API_BASE: 'http://127.0.0.1:1',
      NUXT_LOCAL_SYNC_RECEIVER_BASE_URL: 'http://127.0.0.1:1', NUXT_MY_TAIKO_READ_MODEL_MODE: 'legacy', NUXT_DEVELOPER_API_V1: 'false', NUXT_PUBLIC_DEVELOPER_API_V1: 'false' };
    for (const prefix of ['TAIKO_DB_', 'NUXT_DB_', 'NUXT_BOT_DB_']) for (const suffix of ['HOST', 'PORT', 'USER', 'PASSWORD', 'NAME']) env[prefix + suffix] = process.env['TAIKO_DB_' + suffix];
    async function stop() {
      if (!host) return;
      host.kill('SIGTERM'); let timer;
      await Promise.race([hostDone, new Promise(r => { timer = setTimeout(() => { host.kill('SIGKILL'); r(); }, 3000); })]);
      clearTimeout(timer); await hostDone; host = null;
      await until(async () => { try { await fetch(base + '/api/account/auth/me', { signal: AbortSignal.timeout(300) }); return false; } catch { return true; } }, 3000);
      await log.close(); log = null;
    }
    async function start(enabled) {
      await stop();
      const listener = createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
      const port = listener.address().port; await new Promise(r => listener.close(r)); base = `http://127.0.0.1:${port}`;
      log = await open(resolve(E, `oidc-ui-nuxt-${enabled}.log`), 'w', 0o600);
      const providers = [{ id: 'mock', label: 'Synthetic OIDC', enabled: true, issuer: 'https://127.0.0.1:1', clientId: 'viewer-test', redirectUri: 'https://viewer.example/api/account/oidc/mock/callback' }];
      host = spawn(process.execPath, [new URL('../.output/server/index.mjs', import.meta.url).pathname], {
        cwd: root, env: { ...env, NITRO_HOST: '127.0.0.1', NITRO_PORT: String(port), NUXT_OIDC_ENABLED: enabled ? '1' : 'false', NUXT_OIDC_PROVIDERS_JSON: JSON.stringify(providers) }, stdio: ['ignore', log.fd, log.fd]
      });
      hostDone = once(host, 'close');
      await until(async () => {
        if (host.exitCode !== null) throw Error('Owned Nuxt failed startup');
        try { return (await fetch(base + '/api/account/auth/me', { signal: AbortSignal.timeout(700) })).status === 200; } catch { return false; }
      });
    }
    browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'], timeout: 15000 });
    context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === base || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
      deniedOrigins.push(url.origin); return route.abort();
    });
    page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message.slice(0, 200)));
    for (const enabled of [false, true]) {
      if (enabled) {
        const migrate = async (optIn, args = ['--apply']) => {
          const child = spawn(process.execPath, ['--experimental-strip-types', new URL('../scripts/migrate_oidc_schema.ts', import.meta.url).pathname, ...args], {
            env: { ...env, TAIKO_ALLOW_TEST_DB_MUTATION: optIn }, stdio: ['ignore', 'ignore', 'ignore']
          });
          const [code] = await once(child, 'close'); return code;
        };
        assert.notEqual(await migrate('0'), 0, 'migration refuses absent mutation opt-in');
        assert.notEqual(await migrate('1', ['--production']), 0, 'production mode is forbidden');
        assert.equal(await migrate('1'), 0); assert.equal(await migrate('1'), 0, 'explicit migration is idempotent');
      }
      await start(enabled);
      assert.equal((await (await fetch(base + '/api/account/oidc/providers')).json()).providers.length, enabled ? 1 : 0);
      for (const locale of ['zh', 'ja']) for (const width of [375, 414, 1280]) for (const pageName of ['login', 'register']) {
        const prefix = locale === 'ja' ? '/ja' : '';
        await page.setViewportSize({ width, height: width === 1280 ? 900 : 812 });
        await page.goto(base + prefix + '/account/' + pageName, { waitUntil: 'networkidle', timeout: 25000 });
        await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__));
        assert.equal(await page.locator('.oidc-options').count(), enabled ? 1 : 0, `${enabled}/${locale}/${width}/${pageName}`);
        assert.ok(await page.locator('input[type=password]').count());
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
        if (enabled) {
          const button = page.locator('.oidc-options button');
          assert.ok((await button.boundingBox()).height >= 44);
          await button.click(); await page.locator('.oidc-options [role=alert]').waitFor();
          assert.ok(await page.locator('input[type=password]').first().isEditable());
        }
        await page.screenshot({ path: resolve(E, `oidc-${enabled}-${locale}-${width}-${pageName}.png`) });
        cases.push({ enabled, locale, width, page: pageName, overflow: false });
      }
      if (enabled) for (const locale of ['zh', 'ja']) for (const error of ['ourtaiko_email_unverified', 'ourtaiko_rate_limited']) {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(base + (locale === 'ja' ? '/ja' : '') + '/account/login?oidc_error=' + error, { waitUntil: 'networkidle', timeout: 25000 });
        const alert = page.locator('.oidc-options [role=alert]'); await alert.waitFor();
        if (error === 'ourtaiko_email_unverified') assert.match(await alert.innerText(), /OurTaiko/);
        else assert.match(await alert.innerText(), locale === 'ja' ? /しばらく待って/ : /稍后重试/);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
        assert.ok(await page.locator('input[type=password]').first().isEditable());
        cases.push({ enabled, locale, width: 375, page: 'safe-error', error, overflow: false });
      }
      // Profile uses a real existing Session and the actual profile/binding routes.
      const [user] = await pool.execute("INSERT INTO web_user_accounts(username,email,password_hash,email_verified) VALUES (?,?,'oidc-only',1)", ['ui-' + enabled, 'ui-' + enabled + '@example.invalid']);
      const session = randomBytes(32).toString('hex');
      await pool.execute('INSERT INTO web_user_sessions(session_token,user_id,expires_at) VALUES (?,?,DATE_ADD(NOW(),INTERVAL 1 HOUR))', [session, user.insertId]);
      await context.addCookies([{ name: 'stv_session', value: session, url: base }]);
      for (const locale of ['zh', 'ja']) for (const width of [375, 414, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(base + (locale === 'ja' ? '/ja' : '') + '/account/profile', { waitUntil: 'networkidle', timeout: 25000 });
        await page.locator('.profile-main-card').waitFor();
        assert.equal(await page.locator('.oidc-options').count(), enabled ? 1 : 0);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
        if (enabled) assert.equal(await page.locator('.oidc-options button').count(), 1);
        await page.screenshot({ path: resolve(E, `oidc-${enabled}-${locale}-${width}-profile.png`) });
        cases.push({ enabled, locale, width, page: 'profile', overflow: false });
      }
      await context.clearCookies();
    }
    assert.deepEqual(errors, []);
    await writeFile(resolve(E, 'oidc-nuxt-ui.json'), JSON.stringify({ pass: true, cases, pageErrors: errors, deniedOrigins: [...new Set(deniedOrigins)], providerMode: 'listing enabled with loopback-unreachable issuer; start fails safely; no real provider login', database: proof.name }, null, 2));
    await stop();
  } finally {
    await page?.close(); await context?.close(); await browser?.close();
    if (host) { host.kill('SIGKILL'); await hostDone; }
    await log?.close(); await pool.end();
  }
});
