import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:https';
import { once } from 'node:events';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generateKeyPairSync, createHash, randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';
import { SignJWT } from 'jose';
import { createApp, createRouter, defineEventHandler, toNodeListener } from 'h3';
import { installGoalSqlRuntime } from './fixtures/goalSqlRuntime.mjs';

test('OIDC real TLS provider + H3 handlers + isolated MySQL', { timeout: 120000 }, async () => {
  assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION, '1');
  const scratch = await realpath(process.env.QA_RUN_TMPDIR);
  const socket = resolve(scratch, 'community-mysql.sock');
  assert.equal(socket, process.env.COMMUNITY_TEST_SOCKET);
  const admin = await mysql.createConnection({ socketPath: socket, user: 'root' });
  let pool, providerServer, viewerServer, uninstall;
  const originalFetch = globalThis.fetch;
  const originalHandler = globalThis.defineEventHandler;
  const tls = { key: await readFile(process.env.OIDC_TEST_KEY), cert: await readFile(process.env.OIDC_TEST_CERT) };
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const wrongKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...keys.publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' };
  const codes = new Map();
  let providerOrigin, viewerOrigin, metadataOverride = {}, providerDown = false, exchangeGate;
  let tokenRequests = 0;
  const ourSubject = index => index.toString(16).padStart(32, '0');
  const ourSecret = randomBytes(32).toString('hex');
  let lookupServiceKey = ourSecret, lookupReply = {}, lookupGate, lookupRequests = 0, lookupAuthFailures = 0, lookupRedirectsFollowed = 0;
  const lookupInvariantFailures = [], lookupCases = [];
  const checks = [];
  try {
    const [[host]] = await admin.query('SELECT @@datadir dir');
    assert.equal(await realpath(host.dir), resolve(scratch, 'community-mysql-data'));
    await admin.query('CREATE DATABASE viewer_oidc_test CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci');
    pool = mysql.createPool({ socketPath: socket, user: 'root', database: 'viewer_oidc_test', connectionLimit: 5 });
    const [[proof]] = await pool.query('SELECT DATABASE() name');
    assert.match(proof.name, /_test$/); assert.equal(proof.name, 'viewer_oidc_test');
    const runtime = { oidcEnabled: false, oidcProvidersJson: '[]', myTaikoReadModelMode: 'legacy', annualStartupMode: 'normal', public: {} };
    uninstall = installGoalSqlRuntime(pool, runtime);
    globalThis.defineEventHandler = defineEventHandler;
    const { CREATE_TABLES } = await import('../server/utils/account-schema-definition.ts');
    for (const name of ['web_user_accounts', 'web_user_sessions', 'web_email_verifications', 'web_password_resets', 'web_annual_summary_access']) {
      await pool.execute(CREATE_TABLES.find(sql => sql.startsWith(`CREATE TABLE IF NOT EXISTS ${name} (`)));
    }
    await pool.execute("ALTER TABLE web_annual_summary_access ADD COLUMN enabled TINYINT(1) NOT NULL DEFAULT 1, ADD COLUMN feature VARCHAR(64) NOT NULL DEFAULT 'annual_first_run_beta'");
    const { OIDC_TABLES } = await import('../server/services/oidc/schema.ts');
    for (const sql of OIDC_TABLES) await pool.execute(sql);
    // Explicit migration is rerunnable and never called by a request.
    for (const sql of OIDC_TABLES) await pool.execute(sql);
    providerServer = createServer(tls, async (req, res) => {
      try {
        const url = new URL(req.url, providerOrigin);
        res.setHeader('content-type', 'application/json');
        if (providerDown) { res.statusCode = 503; return res.end('{}'); }
        if (url.pathname === '/.well-known/openid-configuration') return res.end(JSON.stringify({
          issuer: providerOrigin, authorization_endpoint: providerOrigin + '/authorize', token_endpoint: providerOrigin + '/token', jwks_uri: providerOrigin + '/jwks',
          response_types_supported: ['code'], subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256'],
          code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'], ...metadataOverride
        }));
        if (url.pathname === '/redirect-must-not-be-followed') { lookupRedirectsFollowed++; res.statusCode = 400; return res.end('{}'); }
        if (url.pathname === '/internal/v1/external/lookup') {
          lookupRequests++;
          res.setHeader('cache-control', 'no-store');
          let body = ''; for await (const chunk of req) { body += chunk; assert.ok(body.length < 32768); }
          const input = JSON.parse(body);
          try {
            assert.equal(req.method, 'POST'); assert.equal(url.search, '');
            assert.match(req.headers['content-type'], /^application\/json(?:;|$)/);
            assert.equal(req.headers.origin, undefined); assert.equal(req.headers.cookie, undefined); assert.equal(req.headers.authorization, undefined);
            assert.deepEqual(Object.keys(input), ['id']); assert.match(input.id, /^[0-9a-f]{32}$/);
            assert.equal(req.headers['x-service-id'], 'viewer-test'); assert.ok(typeof req.headers['x-service-key'] === 'string');
            assert.ok(!['client_id', 'client_secret', 'code', 'access_token', 'id_token'].some(k => url.searchParams.has(k) || Object.hasOwn(input, k)));
          } catch { lookupInvariantFailures.push('lookup request contract violation'); throw Error('Mock lookup request invalid'); }
          if (lookupGate) await lookupGate;
          if (req.headers['x-service-key'] !== lookupServiceKey) {
            lookupAuthFailures++; res.statusCode = 401; return res.end(JSON.stringify({ code: 'SERVICE_UNAUTHORIZED', message: 'private upstream detail', data: null }));
          }
          if (lookupReply.stall) return;
          if (lookupReply.redirect) { res.writeHead(302, { location: lookupReply.redirect }); return res.end(); }
          res.statusCode = lookupReply.status || 200;
          if (lookupReply.retryAfter !== undefined) res.setHeader('retry-after', lookupReply.retryAfter);
          if (lookupReply.contentType) res.setHeader('content-type', lookupReply.contentType);
          if (lookupReply.raw !== undefined) return res.end(lookupReply.raw);
          const response = { code: 'OK', message: '', data: { id: input.id, nickname: 'Synthetic player', email: input.id + '@ourtaiko.example.invalid', emailVerified: true } };
          return res.end(JSON.stringify(lookupReply.body ?? response));
        }
        if (url.pathname === '/jwks') return res.end(JSON.stringify({ keys: [jwk] }));
        if (url.pathname === '/authorize') {
          assert.equal(url.searchParams.get('response_type'), 'code');
          assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
          assert.ok(url.searchParams.get('state')); assert.ok(url.searchParams.get('nonce'));
          const code = randomBytes(24).toString('hex');
          const isOur = new URL(url.searchParams.get('redirect_uri')).pathname === '/api/account/oidc/ourtaiko/callback';
          if (isOur) assert.equal(url.searchParams.get('scope'), 'openid profile');
          codes.set(code, { request: url.searchParams, isOur, ...(isOur ? { auth: 'basic' } : {}) });
          const callback = new URL(url.searchParams.get('redirect_uri'));
          callback.searchParams.set('code', code); callback.searchParams.set('state', url.searchParams.get('state'));
          res.writeHead(302, { location: callback.href }); return res.end();
        }
        if (url.pathname === '/token') {
          tokenRequests++;
          let body = ''; for await (const chunk of req) { body += chunk; assert.ok(body.length < 10000); }
          const params = new URLSearchParams(body), code = params.get('code'), record = codes.get(code);
          codes.delete(code);
          assert.ok(record, 'authorization code is one-use at provider');
          assert.equal(params.get('grant_type'), 'authorization_code');
          assert.equal(params.get('redirect_uri'), record.request.get('redirect_uri'));
          assert.equal(createHash('sha256').update(params.get('code_verifier')).digest('base64url'), record.request.get('code_challenge'));
          const auth = record.auth || 'none';
          if (auth === 'none') assert.equal(params.get('client_id'), 'viewer-test');
          if (auth === 'basic') assert.ok(decodeURIComponent(Buffer.from(req.headers.authorization.slice(6), 'base64').toString()) === 'viewer-test:' + (record.isOur ? ourSecret : 'synthetic-secret'), 'mock basic authentication accepted');
          if (auth === 'post') { assert.equal(params.get('client_id'), 'viewer-test'); assert.ok(params.get('client_secret') === (record.isOur ? ourSecret : 'synthetic-secret'), 'mock client secret accepted'); }
          if (exchangeGate) await exchangeGate;
          const claims = { ...(record.isOur ? { sub: ourSubject(1) } : { sub: 'subject-default', email: 'new@example.invalid', email_verified: true }), nonce: record.request.get('nonce'), ...record.claims };
          if (record.isOur) assert.ok(!Object.hasOwn(claims, 'email') && !Object.hasOwn(claims, 'email_verified'), 'OurTaiko ID Token has no email claims');
          const token = await new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).setIssuer(record.issuer || providerOrigin)
            .setAudience(record.audience || 'viewer-test').setIssuedAt().setExpirationTime(record.expiry || '5m').sign(record.badSignature ? wrongKeys.privateKey : keys.privateKey);
          return res.end(JSON.stringify({ access_token: 'synthetic-access-token', token_type: 'Bearer', expires_in: 300, id_token: token }));
        }
        res.statusCode = 404; res.end('{}');
      } catch { res.statusCode = 400; res.end('{"error":"invalid_grant"}'); }
    });
    providerServer.listen(0, '127.0.0.1'); await once(providerServer, 'listening');
    providerOrigin = `https://127.0.0.1:${providerServer.address().port}`;
    const router = createRouter();
    for (const [method, path, file] of [
      ['get', '/api/account/oidc/providers', 'oidc/providers.get.ts'], ['get', '/api/account/oidc/bindings', 'oidc/bindings.get.ts'],
      ['post', '/api/account/oidc/:provider/start', 'oidc/[provider]/start.post.ts'], ['get', '/api/account/oidc/:provider/callback', 'oidc/[provider]/callback.get.ts'],
      ['post', '/api/account/auth/login', 'auth/login.post.ts'], ['get', '/api/account/auth/me', 'auth/me.get.ts'], ['post', '/api/account/auth/logout', 'auth/logout.post.ts'],
      ['post', '/api/account/auth/reset-password', 'auth/reset-password.post.ts']
    ]) router[method](path, (await import('../server/api/account/' + file)).default);
    viewerServer = createServer(tls, toNodeListener(createApp({ onError: (error, event) => {
      event.node.res.statusCode = error.statusCode || 500;
      event.node.res.setHeader('content-type', 'application/json'); event.node.res.end(JSON.stringify({ statusCode: error.statusCode || 500 }));
    } }).use(router)));
    viewerServer.listen(0, '127.0.0.1'); await once(viewerServer, 'listening');
    viewerOrigin = `https://127.0.0.1:${viewerServer.address().port}`;
    globalThis.fetch = (url, options) => {
      assert.ok([viewerOrigin, providerOrigin].includes(new URL(url).origin), 'Only owned synthetic HTTPS servers allowed');
      return originalFetch(url, options);
    };
    const provider = { id: 'mock', label: 'Synthetic OIDC', enabled: true, issuer: providerOrigin, clientId: 'viewer-test', redirectUri: viewerOrigin + '/api/account/oidc/mock/callback' };
    const configure = (changes = {}) => { runtime.oidcEnabled = true; runtime.oidcProvidersJson = JSON.stringify([{ ...provider, ...changes }]); };
    const ask = (path, { cookie = '', body, origin = viewerOrigin, method = body ? 'POST' : 'GET' } = {}) => fetch(viewerOrigin + path, {
      method, redirect: 'manual', headers: { cookie, origin, 'x-forwarded-proto': 'https', ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000)
    });
    const sessionCookie = res => res.headers.getSetCookie().find(c => c.startsWith('stv_session='))?.split(';')[0];
    async function begin({ cookie, purpose = 'login', redirect = '/songs/42', locale = 'zh', providerId = 'mock' } = {}) {
      const res = await ask(`/api/account/oidc/${providerId}/start`, { cookie, body: { purpose, redirect, locale, userId: 999999, lookupUrl: 'https://untrusted.invalid/custom' } });
      assert.equal(res.status, 200, 'start status');
      const { authorizationUrl } = await res.json();
      const browserCookie = res.headers.getSetCookie().find(c => c.startsWith(`stv_oidc_${providerId}=`));
      assert.match(browserCookie, /HttpOnly/); assert.match(browserCookie, /Secure/); assert.match(browserCookie, /SameSite=Lax/);
      const response = await fetch(authorizationUrl, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
      assert.equal(response.status, 302);
      const callback = new URL(response.headers.get('location'));
      const record = codes.get(callback.searchParams.get('code'));
      return { callback, record, cookie: [cookie, browserCookie.split(';')[0]].filter(Boolean).join('; ') };
    }
    async function complete(flow, expected = '/songs/42') {
      const res = await ask(flow.callback.pathname + flow.callback.search, { cookie: flow.cookie });
      assert.equal(res.status, 303); assert.equal(res.headers.get('location'), expected);
      assert.equal(res.headers.get('cache-control'), 'no-store'); assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
      return res;
    }
    const count = async table => (await pool.query(`SELECT COUNT(*) n FROM ${table}`))[0][0].n;
    const unchangedFailure = async (flow, expected = '/account/login?oidc_error=provider_unavailable') => {
      const before = await Promise.all(['web_user_accounts', 'web_external_identities', 'web_user_sessions'].map(count));
      const res = await complete(flow, expected);
      assert.equal(sessionCookie(res), undefined);
      assert.deepEqual(await Promise.all(['web_user_accounts', 'web_external_identities', 'web_user_sessions'].map(count)), before);
    };
    // Disabled even with a populated registry: no discovery, no schema prerequisite.
    runtime.oidcProvidersJson = JSON.stringify([provider]);
    assert.deepEqual(await (await ask('/api/account/oidc/providers')).json(), { providers: [] });
    assert.equal((await ask('/api/account/oidc/mock/start', { body: { purpose: 'login' } })).status, 404);
    assert.equal((await ask('/api/account/oidc/mock/callback?state=x&code=x')).status, 404);
    assert.equal(await count('web_user_accounts'), 0);
    configure({ enabled: false }); assert.deepEqual(await (await ask('/api/account/oidc/providers')).json(), { providers: [] });
    configure();
    assert.equal((await ask('/api/account/oidc/bindings')).status, 401);
    assert.equal((await ask('/api/account/oidc/mock/start', { body: { purpose: 'link' } })).status, 401);
    assert.equal((await ask('/api/account/oidc/mock/start', { origin: 'https://evil.invalid', body: { purpose: 'login' } })).status, 403);
    checks.push('disabled, provider disabled, anonymous binding and cross-origin start denied');
    const first = await complete(await begin());
    const firstCookie = sessionCookie(first); assert.ok(firstCookie);
    assert.match(first.headers.getSetCookie().find(c => c.startsWith('stv_session=')), /HttpOnly.*Secure.*SameSite=Lax/);
    const [[firstUser]] = await pool.query('SELECT * FROM web_user_accounts');
    assert.equal(firstUser.email_verified, 1); assert.equal(firstUser.password_hash, 'oidc-only');
    assert.equal((await ask('/api/account/auth/login', { body: { identifier: firstUser.username, password: 'oidc-only' } })).status, 401);
    assert.equal((await (await ask('/api/account/auth/me', { cookie: firstCookie })).json()).user.id, firstUser.id);
    const again = await complete(await begin()); assert.notEqual(sessionCookie(again), firstCookie);
    assert.equal(await count('web_user_accounts'), 1);
    checks.push('PKCE S256, nonce, signature, first account + identity + shared session, unusable password, linked login rotates session');
    // An unverified/missing email can authenticate an existing identity, but cannot provision an account.
    let flow = await begin(); flow.record.claims = { email_verified: false, email: 'changed@example.invalid' };
    await complete(flow); assert.equal((await pool.query('SELECT email FROM web_user_accounts'))[0][0].email, firstUser.email);
    for (const verified of [false, 'true', null]) {
      flow = await begin(); flow.record.claims = { sub: 'unverified-' + verified, email_verified: verified };
      await unchangedFailure(flow, '/account/login?oidc_error=email_required');
    }
    flow = await begin(); flow.record.claims = { sub: 'conflicting-email' };
    await unchangedFailure(flow, '/account/login?oidc_error=email_conflict');
    await pool.execute("INSERT INTO web_user_accounts(username,email,password_hash,email_verified) VALUES ('identifier@example.invalid','different@example.invalid','existing-local-account',1)");
    flow = await begin(); flow.record.claims = { sub: 'conflicting-login-identifier', email: 'identifier@example.invalid' };
    await unchangedFailure(flow, '/account/login?oidc_error=email_conflict');
    const { getPasswordHash } = await import('../server/internal/account/shared.ts');
    const password = randomBytes(20).toString('hex');
    const [second] = await pool.execute('INSERT INTO web_user_accounts(username,email,password_hash,email_verified) VALUES (?,?,?,1)', ['local-test', 'local@example.invalid', await getPasswordHash(password)]);
    const secondCookie = sessionCookie(await ask('/api/account/auth/login', { body: { identifier: 'local-test', password } }));
    flow = await begin({ cookie: secondCookie, purpose: 'link', redirect: '/account/profile' });
    flow.record.claims = { sub: 'linked-local', email: 'unverified@example.invalid', email_verified: false };
    assert.equal(sessionCookie(await complete(flow, '/account/profile')), undefined);
    const status = await (await ask('/api/account/oidc/bindings', { cookie: secondCookie })).json();
    assert.equal(status.providers[0].linked, true); assert.equal(status.providers[0].remoteLinkStatus, 'not_requested');
    assert.ok(!JSON.stringify(status).includes('linked-local'));
    flow = await begin(); flow.record.claims = { sub: 'linked-local', email_verified: false };
    const linkedCookie = sessionCookie(await complete(flow));
    assert.equal((await (await ask('/api/account/auth/me', { cookie: linkedCookie })).json()).user.id, second.insertId);
    flow = await begin({ cookie: secondCookie, purpose: 'link', redirect: '/account/profile' }); flow.record.claims = { sub: 'linked-local' };
    await complete(flow, '/account/profile'); assert.equal(await count('web_external_identities'), 2);
    flow = await begin({ cookie: firstCookie, purpose: 'link' }); flow.record.claims = { sub: 'linked-local' };
    await unchangedFailure(flow, '/account/profile?oidc_error=identity_conflict');
    flow = await begin({ cookie: secondCookie, purpose: 'link' }); flow.record.claims = { sub: 'second-identity-same-issuer' };
    await unchangedFailure(flow, '/account/profile?oidc_error=identity_conflict');
    checks.push('email conflict never merges, unverified email never provisions, explicit binding targets session, repeated binding idempotent, identity/user issuer uniqueness');
    // Account switch, expiry, logout and old callbacks never change the target account.
    flow = await begin({ cookie: secondCookie, purpose: 'link' });
    flow.cookie = flow.cookie.replace(secondCookie, firstCookie);
    await unchangedFailure(flow, '/account/profile?oidc_error=session_changed');
    flow = await begin({ cookie: secondCookie, purpose: 'link' });
    await pool.execute('UPDATE web_user_sessions SET expires_at=DATE_SUB(NOW(),INTERVAL 1 HOUR) WHERE session_token=?', [secondCookie.split('=')[1]]);
    await unchangedFailure(flow, '/account/profile?oidc_error=session_changed');
    flow = await begin({ cookie: firstCookie, purpose: 'link' });
    let releaseExchange; exchangeGate = new Promise(r => { releaseExchange = r; });
    const beforeToken = tokenRequests;
    const pending = ask(flow.callback.pathname + flow.callback.search, { cookie: flow.cookie });
    for (let i = 0; i < 100 && tokenRequests === beforeToken; i++) await new Promise(r => setTimeout(r, 10));
    await ask('/api/account/auth/logout', { cookie: firstCookie, body: {} });
    releaseExchange(); exchangeGate = null;
    const denied = await pending; assert.equal(denied.headers.get('location'), '/account/profile?oidc_error=session_changed');
    assert.equal(sessionCookie(denied), undefined);
    flow = await begin();
    const stateHash = createHash('sha256').update(flow.callback.searchParams.get('state')).digest('hex');
    await pool.execute('UPDATE web_oidc_transactions SET expires_at=DATE_SUB(NOW(),INTERVAL 1 HOUR) WHERE state_hash=?', [stateHash]);
    await unchangedFailure(flow, '/account/login?oidc_error=invalid_transaction');
    flow = await begin(); const oldCookie = flow.cookie;
    const newer = await begin(); flow.cookie = newer.cookie;
    await unchangedFailure(flow, '/account/login?oidc_error=invalid_transaction');
    flow.cookie = oldCookie; await complete(flow);
    flow = await begin(); const savedState = flow.callback.searchParams.get('state'); flow.callback.searchParams.set('state', randomBytes(24).toString('hex'));
    await unchangedFailure(flow, '/account/login?oidc_error=invalid_transaction');
    flow.callback.searchParams.set('state', savedState); await complete(flow);
    await unchangedFailure(flow, '/account/login?oidc_error=invalid_transaction');
    checks.push('account switch, expiry, logout during exchange, browser transaction binding, bad state and replay denied without session writes');
    for (const fault of ['nonce', 'signature', 'issuer', 'audience', 'expiry', 'azp', 'single-azp', 'c_hash', 'at_hash']) {
      flow = await begin();
      if (fault === 'nonce') flow.record.claims = { nonce: 'wrong' };
      if (fault === 'signature') flow.record.badSignature = true;
      if (fault === 'issuer') flow.record.issuer = 'https://evil.invalid';
      if (fault === 'audience') flow.record.audience = 'other-client';
      if (fault === 'expiry') flow.record.expiry = Math.floor(Date.now() / 1000) - 3600;
      if (fault === 'azp') { flow.record.audience = ['viewer-test', 'other']; flow.record.claims = { azp: 'other' }; }
      if (fault === 'single-azp') flow.record.claims = { azp: 'other' };
      if (fault === 'c_hash' || fault === 'at_hash') flow.record.claims = { [fault]: 'wrong' };
      await unchangedFailure(flow);
    }
    flow = await begin(); flow.record.claims = { c_hash: createHash('sha256').update(flow.callback.searchParams.get('code')).digest().subarray(0, 16).toString('base64url'), at_hash: createHash('sha256').update('synthetic-access-token').digest().subarray(0, 16).toString('base64url') }; await complete(flow);
    flow = await begin(); flow.callback.searchParams.delete('code'); flow.callback.searchParams.set('error', 'access_denied');
    await unchangedFailure(flow);
    flow = await begin(); flow.callback.searchParams.set('code', 'unknown-code'); await unchangedFailure(flow);
    flow = await begin();
    let releaseDisabled; exchangeGate = new Promise(r => { releaseDisabled = r; });
    const requestCount = tokenRequests;
    const disabledPending = ask(flow.callback.pathname + flow.callback.search, { cookie: flow.cookie });
    for (let i = 0; i < 100 && tokenRequests === requestCount; i++) await new Promise(r => setTimeout(r, 10));
    const disableBefore = await Promise.all(['web_user_accounts', 'web_external_identities', 'web_user_sessions'].map(count));
    runtime.oidcEnabled = false; releaseDisabled(); exchangeGate = null;
    const disabledResponse = await disabledPending;
    assert.equal(disabledResponse.headers.get('location'), '/account/login?oidc_error=provider_unavailable');
    assert.equal(sessionCookie(disabledResponse), undefined);
    assert.deepEqual(await Promise.all(['web_user_accounts', 'web_external_identities', 'web_user_sessions'].map(count)), disableBefore); configure();
    metadataOverride = { issuer: 'https://evil.invalid' };
    assert.equal((await ask('/api/account/oidc/mock/start', { body: { purpose: 'login' } })).status, 503);
    metadataOverride = { token_endpoint: 'https://evil.invalid/token' };
    assert.equal((await ask('/api/account/oidc/mock/start', { body: { purpose: 'login' } })).status, 503);
    metadataOverride = { code_challenge_methods_supported: ['plain'] };
    assert.equal((await ask('/api/account/oidc/mock/start', { body: { purpose: 'login' } })).status, 503);
    metadataOverride = {};
    flow = await begin(); providerDown = true; await unchangedFailure(flow);
    assert.equal((await ask('/api/account/oidc/mock/start', { body: { purpose: 'login' } })).status, 503); providerDown = false;
    flow = await begin(); configure({ clientId: 'changed-client' });
    await unchangedFailure(flow, '/account/login?oidc_error=invalid_transaction'); configure();
    flow = await begin(); runtime.oidcEnabled = false;
    assert.equal((await ask(flow.callback.pathname + flow.callback.search, { cookie: flow.cookie })).status, 404); configure();
    checks.push('wrong nonce/signature/issuer/audience/azp/expiry, malicious discovery/endpoints/PKCE, provider outage, config change and disabling pending flow denied');
    // Real parallel callbacks consume one persisted transaction exactly once.
    flow = await begin();
    const beforeSessions = await count('web_user_sessions');
    const concurrent = await Promise.all([1, 2].map(() => ask(flow.callback.pathname + flow.callback.search, { cookie: flow.cookie })));
    assert.equal(concurrent.filter(res => sessionCookie(res)).length, 1);
    assert.equal(await count('web_user_sessions'), beforeSessions + 1);
    // Independent browsers racing to create the same identity: no orphan accounts.
    const flows = [await begin(), await begin()];
    for (const [index, f] of flows.entries()) f.record.claims = { sub: 'concurrent-new', email: `concurrent-${index}@example.invalid` };
    const beforeAccounts = await count('web_user_accounts');
    const race = await Promise.all(flows.map(f => ask(f.callback.pathname + f.callback.search, { cookie: f.cookie })));
    assert.ok(race.some(res => sessionCookie(res)));
    assert.equal(await count('web_user_accounts'), beforeAccounts + 1);
    assert.equal((await pool.query('SELECT COUNT(*) n FROM web_external_identities WHERE subject=?', ['concurrent-new']))[0][0].n, 1);
    assert.equal((await pool.query('SELECT COUNT(*) n FROM web_user_accounts a LEFT JOIN web_external_identities i ON i.user_id=a.id WHERE a.password_hash=\'oidc-only\' AND i.id IS NULL'))[0][0].n, 0);
    // Two valid local accounts race to link the same new external identity.
    const linkFlows = [];
    for (const index of [1, 2]) {
      await pool.execute('INSERT INTO web_user_accounts(username,email,password_hash,email_verified) VALUES (?,?,?,1)', ['race-local-' + index, 'race-local-' + index + '@example.invalid', await getPasswordHash(password)]);
      const cookie = sessionCookie(await ask('/api/account/auth/login', { body: { identifier: 'race-local-' + index, password } }));
      const f = await begin({ cookie, purpose: 'link' }); f.record.claims = { sub: 'race-link', email_verified: false }; linkFlows.push(f);
    }
    const beforeLinkSessions = await count('web_user_sessions');
    const linkedRace = await Promise.all(linkFlows.map(f => ask(f.callback.pathname + f.callback.search, { cookie: f.cookie })));
    assert.equal(linkedRace.filter(r => r.headers.get('location') === '/songs/42').length, 1);
    assert.equal(await count('web_user_sessions'), beforeLinkSessions);
    assert.equal((await pool.query('SELECT COUNT(*) n FROM web_external_identities WHERE subject=?', ['race-link']))[0][0].n, 1);
    const { readRemoteLinkIntent } = await import('../server/services/oidc/remote-link.ts');
    const intent = await readRemoteLinkIntent(pool, second.insertId, providerOrigin);
    assert.equal(intent.status, 'not_requested'); assert.match(intent.operationId, /^[a-f0-9]{64}$/);
    assert.equal((await readRemoteLinkIntent(pool, second.insertId, providerOrigin)).operationId, intent.operationId);
    assert.equal(await readRemoteLinkIntent(pool, second.insertId, 'https://unrelated.invalid'), null);
    for (const auth of ['basic', 'post']) {
      configure({ clientSecret: 'synthetic-secret', tokenEndpointAuthMethod: auth === 'basic' ? 'client_secret_basic' : 'client_secret_post' });
      flow = await begin(); flow.record.auth = auth; await complete(flow);
    }
    configure();
    for (const redirect of ['//evil.invalid', '/%2f%2fevil.invalid', '/a/..//evil.invalid', '/api/account/auth/logout']) await complete(await begin({ redirect }), '/account/profile');
    await complete(await begin({ redirect: '/ja/songs/42', locale: 'ja' }), '/ja/songs/42');
    flow = await begin({ locale: 'ja' }); flow.record.claims = { nonce: 'wrong' }; await unchangedFailure(flow, '/ja/account/login?oidc_error=provider_unavailable');
    for (const [index, sub] of ['  Opaque Subject  ', '  opaque subject  '].entries()) {
      flow = await begin(); flow.record.claims = { sub, email: `opaque-${index}@example.invalid` };
      await complete(flow);
      const [[identity]] = await pool.execute('SELECT subject FROM web_external_identities WHERE issuer=? AND subject=?', [providerOrigin, sub]);
      assert.equal(identity.subject.toString(), sub, 'opaque subject retains spaces and case');
    }
    // OurTaiko 0.1: OIDC proves identity only; service lookup supplies the email.
    const configureOur = (changes = {}) => {
      runtime.oidcEnabled = true;
      runtime.oidcProvidersJson = JSON.stringify([{ ...provider, id: 'ourtaiko', label: 'OurTaiko', clientSecret: ourSecret,
        tokenEndpointAuthMethod: 'client_secret_basic', redirectUri: viewerOrigin + '/api/account/oidc/ourtaiko/callback', ...changes }]);
    };
    const ourBegin = async (options = {}, sub) => {
      const f = await begin({ ...options, providerId: 'ourtaiko' });
      if (sub !== undefined) f.record.claims = { sub };
      return f;
    };
    const okProfile = (id, changes = {}) => ({ code: 'OK', message: '', data: { id, nickname: 'Synthetic player', email: id + '@ourtaiko.example.invalid', emailVerified: true, ...changes } });
    const snapshot = () => Promise.all(['web_user_accounts', 'web_external_identities', 'web_user_sessions'].map(count));
    configureOur();
    let ourBefore = await snapshot(), callsBefore = lookupRequests;
    const ourFirst = await complete(await ourBegin());
    const ourCookie = sessionCookie(ourFirst); assert.ok(ourCookie);
    const ourMe = (await (await ask('/api/account/auth/me', { cookie: ourCookie })).json()).user;
    const [[ourAccount]] = await pool.execute('SELECT email,email_verified,password_hash FROM web_user_accounts WHERE id=?', [ourMe.id]);
    assert.equal(ourAccount.email, ourSubject(1) + '@ourtaiko.example.invalid'); assert.equal(ourAccount.email_verified, 1); assert.equal(ourAccount.password_hash, 'oidc-only');
    assert.deepEqual(await snapshot(), ourBefore.map(n => n + 1)); assert.equal(lookupRequests, callsBefore + 1);
    lookupCases.push({ name: 'first login uses email-free ID Token then service lookup and atomic account/identity/session', pass: true });
    lookupReply = { status: 503, body: { code: 'UNAVAILABLE', message: 'private upstream detail', data: null } };
    ourBefore = await snapshot(); callsBefore = lookupRequests;
    const ourAgain = await complete(await ourBegin());
    assert.ok(sessionCookie(ourAgain) !== ourCookie); assert.equal(lookupRequests, callsBefore, 'known identity follows protocol without another lookup');
    assert.deepEqual(await snapshot(), [ourBefore[0], ourBefore[1], ourBefore[2] + 1]); lookupReply = {};
    lookupCases.push({ name: 'existing OurTaiko identity logs in without duplicate account or lookup', pass: true });
    const localName = 'ourtaiko-local';
    const [ourLocal] = await pool.execute('INSERT INTO web_user_accounts(username,email,password_hash,email_verified) VALUES (?,?,?,1)', [localName, 'our-local@example.invalid', await getPasswordHash(password)]);
    let localCookie = sessionCookie(await ask('/api/account/auth/login', { body: { identifier: localName, password } }));
    const bound = await complete(await ourBegin({ cookie: localCookie, purpose: 'link', redirect: '/account/profile' }, ourSubject(2)), '/account/profile');
    assert.equal(sessionCookie(bound), undefined);
    const [[linkedOur]] = await pool.execute('SELECT user_id,remote_link_status FROM web_external_identities WHERE issuer=? AND subject=?', [providerOrigin, ourSubject(2)]);
    assert.equal(linkedOur.user_id, ourLocal.insertId); assert.equal(linkedOur.remote_link_status, 'not_requested');
    assert.equal((await pool.execute('SELECT email FROM web_user_accounts WHERE id=?', [ourLocal.insertId]))[0][0].email, 'our-local@example.invalid');
    const linkedLogin = sessionCookie(await complete(await ourBegin({}, ourSubject(2))));
    assert.equal((await (await ask('/api/account/auth/me', { cookie: linkedLogin })).json()).user.id, ourLocal.insertId);
    lookupCases.push({ name: 'active Viewer session binds only its user, keeps local email, and associated login matches issuer/sub', pass: true });
    let ourIndex = 100;
    async function ourFailure(name, reply, expectedCode = 'provider_unavailable', options = {}) {
      const sub = ourSubject(ourIndex++); lookupReply = typeof reply === 'function' ? reply(sub) : reply;
      const f = await ourBegin(options, sub);
      const before = await snapshot(), requests = lookupRequests;
      const res = await complete(f, `${options.locale === 'ja' ? '/ja' : ''}/account/${options.purpose === 'link' ? 'profile' : 'login'}?oidc_error=${expectedCode}`);
      assert.equal(sessionCookie(res), undefined); assert.deepEqual(await snapshot(), before);
      assert.equal(lookupRequests, requests + 1); assert.ok(!res.headers.get('location').includes('private upstream detail'));
      if (expectedCode === 'ourtaiko_rate_limited') assert.equal(res.headers.get('retry-after'), '12');
      lookupReply = {}; lookupCases.push({ name, pass: true, accountsIdentitiesSessionsUnchanged: true });
    }
    await ourFailure('existing Viewer email is never merged', id => ({ body: okProfile(id, { email: firstUser.email }) }), 'email_conflict');
    for (const [status, code] of [[400, 'REQUEST_INVALID'], [401, 'SERVICE_UNAUTHORIZED'], [403, 'SERVICE_FORBIDDEN'], [404, 'NOT_FOUND'], [409, 'EMAIL_UNVERIFIED'], [409, 'ALREADY_LINKED'], [429, 'RATE_LIMITED'], [503, 'UNAVAILABLE']]) {
      await ourFailure(code, { status, body: { code, message: 'private upstream detail', data: null }, ...(status === 429 ? { retryAfter: '12' } : {}) },
        code === 'EMAIL_UNVERIFIED' ? 'ourtaiko_email_unverified' : code === 'RATE_LIMITED' ? 'ourtaiko_rate_limited' : 'provider_unavailable');
    }
    const authBefore = lookupAuthFailures; lookupServiceKey = randomBytes(32).toString('hex');
    await ourFailure('service credential mismatch after successful OIDC', {}); assert.equal(lookupAuthFailures, authBefore + 1); lookupServiceKey = ourSecret;
    for (const [name, reply, expected] of [
      ['invalid JSON', { raw: '{invalid' }], ['missing envelope field', { body: { code: 'OK', data: {} } }],
      ['array instead of envelope', { body: [] }], ['wrong code type', { body: { code: 200, message: '', data: null } }],
      ['nonempty success message', id => ({ body: { ...okProfile(id), message: 'unexpected' } })],
      ['trailing newline in email', id => ({ body: okProfile(id, { email: 'a@example.invalid' + String.fromCharCode(10) }) })],
      ['wrong message type', { body: { code: 'OK', message: false, data: {} } }],
      ['missing profile field', id => { const body = okProfile(id); delete body.data.nickname; return { body }; }],
      ['wrong data ID', id => ({ body: okProfile(ourSubject(9999)) })],
      ['non-string data ID', id => ({ body: okProfile(id, { id: 123 }) })],
      ['non-string nickname', id => ({ body: okProfile(id, { nickname: {} }) })],
      ['non-string email', id => ({ body: okProfile(id, { email: 123 }) })],
      ['absent email', id => { const body = okProfile(id); delete body.data.email; return { body }; }],
      ['empty email', id => ({ body: okProfile(id, { email: '' }) })],
      ['invalid email', id => ({ body: okProfile(id, { email: 'invalid' }) })],
      ['control character in email', id => ({ body: okProfile(id, { email: 'a' + String.fromCharCode(0) + '@example.invalid' }) })],
      ['email verification is false', id => ({ body: okProfile(id, { emailVerified: false }) }), 'ourtaiko_email_unverified'],
      ['string true does not verify email', id => ({ body: okProfile(id, { emailVerified: 'true' }) })],
      ['numeric verification does not verify email', id => ({ body: okProfile(id, { emailVerified: 1 }) })],
      ['unexpected profile field', id => ({ body: { ...okProfile(id), data: { ...okProfile(id).data, extra: true } } })],
      ['wrong content type', { contentType: 'text/plain', raw: '{}' }],
      ['response size limit', { raw: ' '.repeat(32769) }],
      ['status and code mismatch', { status: 404, body: { code: 'EMAIL_UNVERIFIED', message: '', data: null } }],
      ['unknown error code', { status: 409, body: { code: 'UNKNOWN', message: '', data: null } }],
      ['error data must be null', { status: 404, body: { code: 'NOT_FOUND', message: '', data: {} } }],
      ['invalid Retry-After', { status: 429, body: { code: 'RATE_LIMITED', message: '', data: null }, retryAfter: 'invalid' }],
      ['HTTP redirect is not followed', { redirect: providerOrigin + '/redirect-must-not-be-followed' }],
      ['lookup network timeout', { stall: true }]
    ]) await ourFailure(name, reply, expected);
    // The same lookup rejection must not attach an identity to an active account.
    await ourFailure('binding requires verified external email', id => ({ body: okProfile(id, { emailVerified: false }) }), 'ourtaiko_email_unverified', { cookie: localCookie, purpose: 'link', locale: 'ja' });
    // Invalid identity proofs are rejected before any service credential is sent.
    for (const fault of ['signature', 'nonce', 'state', 'subject-uppercase', 'subject-length']) {
      const f = await ourBegin({}, ourSubject(ourIndex++));
      if (fault === 'signature') f.record.badSignature = true;
      if (fault === 'nonce') f.record.claims.nonce = 'wrong';
      if (fault === 'state') f.callback.searchParams.set('state', randomBytes(24).toString('hex'));
      if (fault === 'subject-uppercase') f.record.claims.sub = 'ABCDEF0123456789ABCDEF0123456789AB';
      if (fault === 'subject-length') f.record.claims.sub = 'too-short';
      callsBefore = lookupRequests;
      await unchangedFailure(f, '/account/login?oidc_error=' + (fault === 'state' ? 'invalid_transaction' : 'provider_unavailable'));
      assert.equal(lookupRequests, callsBefore); lookupCases.push({ name: fault + ' rejected before lookup', pass: true });
    }
    const replay = await ourBegin({}, ourSubject(ourIndex++)); await complete(replay); callsBefore = lookupRequests;
    await unchangedFailure(replay, '/account/login?oidc_error=invalid_transaction'); assert.equal(lookupRequests, callsBefore);
    const exchangeA = await ourBegin({}, ourSubject(ourIndex++)), exchangeB = await ourBegin({}, ourSubject(ourIndex++));
    exchangeB.callback.searchParams.set('code', exchangeA.callback.searchParams.get('code')); callsBefore = lookupRequests;
    await unchangedFailure(exchangeB); assert.equal(lookupRequests, callsBefore);
    lookupCases.push({ name: 'repeated callback and code replay cannot trigger another lookup', pass: true });
    const changed = await ourBegin({ cookie: localCookie, purpose: 'link' }, ourSubject(ourIndex++));
    changed.cookie = changed.cookie.replace(localCookie, linkedLogin); callsBefore = lookupRequests;
    await unchangedFailure(changed, '/account/profile?oidc_error=session_changed'); assert.equal(lookupRequests, callsBefore);
    // Keep lookup pending while proving the server has no Session row lock open.
    const duringLookup = await ourBegin({ cookie: localCookie, purpose: 'link' }, ourSubject(ourIndex++));
    let releaseLookup; lookupGate = new Promise(r => { releaseLookup = r; });
    callsBefore = lookupRequests;
    const pendingLookup = ask(duringLookup.callback.pathname + duringLookup.callback.search, { cookie: duringLookup.cookie });
    for (let i = 0; i < 200 && lookupRequests === callsBefore; i++) await new Promise(r => setTimeout(r, 10));
    assert.equal(lookupRequests, callsBefore + 1);
    const locker = await pool.getConnection();
    try {
      await locker.query('SET innodb_lock_wait_timeout=1'); await locker.beginTransaction();
      await locker.execute('SELECT user_id FROM web_user_sessions WHERE session_token=? FOR UPDATE', [localCookie.split('=')[1]]);
      await locker.rollback();
    } finally { await locker.rollback(); locker.release(); }
    await ask('/api/account/auth/logout', { cookie: localCookie, body: {} });
    const beforeLookupFinish = await snapshot(); releaseLookup(); lookupGate = null;
    const lookupDenied = await pendingLookup;
    assert.equal(lookupDenied.headers.get('location'), '/account/profile?oidc_error=session_changed'); assert.equal(sessionCookie(lookupDenied), undefined);
    assert.deepEqual(await snapshot(), beforeLookupFinish);
    lookupCases.push({ name: 'session switch, no network-held Session lock, logout during lookup rechecked before final transaction', pass: true });
    configureOur({ tokenEndpointAuthMethod: 'client_secret_post' });
    const ourPost = await ourBegin({}, ourSubject(ourIndex++)); ourPost.record.auth = 'post'; await complete(ourPost);
    assert.equal((await pool.query("SELECT COUNT(*) n FROM web_external_identities WHERE provider_id='ourtaiko' AND remote_link_status<>'not_requested'"))[0][0].n, 0);
    assert.equal(lookupRedirectsFollowed, 0);
    assert.deepEqual(lookupInvariantFailures, []);
    assert.ok(lookupCases.length >= 40);
    await writeFile(resolve(process.env.VIEWER_REVIEW_OUT, 'ourtaiko-lookup-http.json'), JSON.stringify({ pass: true, cases: lookupCases, lookupRequests,
      requestContract: 'POST JSON id only, X-Service-ID/Key from server OIDC config, no Origin/Cookie/Authorization/OAuth parameters, fixed local issuer origin',
      redirectsFollowed: lookupRedirectsFollowed, emailInIdToken: false, profileSource: 'ourtaiko_external_lookup', writeTransactionDuringNetwork: false,
      remoteLinkStatus: 'not_requested', productionConnections: 0, realOurTaikoRequests: 0, credentialsRecorded: false }, null, 2) + '\n');
    configure();
    await complete(await begin());
    checks.push('OurTaiko lookup adapter leaves generic provider login and profile source unchanged');
    checks.push('parallel one-use callbacks, concurrent first account atomicity, confidential client basic/post, safe redirects and Japanese errors');
    await writeFile(resolve(process.env.VIEWER_REVIEW_OUT, 'oidc-sql-http.json'), JSON.stringify({ pass: true, database: proof.name, actualSelectDatabase: true, privateDatadirVerified: true, checks, productionConnections: 0, productionWrites: 0, credentialsRecorded: false }, null, 2) + '\n');
  } finally {
    globalThis.fetch = originalFetch; globalThis.defineEventHandler = originalHandler;
    for (const server of [viewerServer, providerServer]) if (server) { server.closeAllConnections(); await new Promise(r => server.close(r)); }
    uninstall?.(); await pool?.end(); await admin.end();
  }
});
