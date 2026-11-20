import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import ts from 'typescript';
import { createApp, createError, eventHandler, readBody, toNodeListener } from 'h3';
import { $fetch } from 'ofetch';
import { ref } from 'vue';

const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const load = source => import('data:text/javascript,' + encodeURIComponent(compile(source)));

test('login authenticates remotely, reports timing without secrets and never caches server authorization', async () => {
  const calls = [], audits = [];
  const remote = createServer(async (req, res) => {
    calls.push(req.url);
    res.setHeader('content-type', 'application/json');
    if (req.url === '/taiko/login') {
      res.end(JSON.stringify({ code: 0, data: 'test-trusted-token' })); return;
    }
    if (req.url === '/taiko/manage/auth/me' && req.headers.authorization === 'Bearer test-trusted-token') {
      res.end(JSON.stringify({ code: 0, data: { id: 3, username: 'isolated-admin', exp: Math.floor(Date.now() / 1000) + 3600 } })); return;
    }
    if (req.headers.authorization === 'Bearer unavailable') { res.statusCode = 500;res.end('{}');return; }
    res.statusCode = 401;res.end(JSON.stringify({ code: -1, msg: 'Invalid token' }));
  });
  await new Promise(resolve => remote.listen(0, '127.0.0.1', resolve));
  const before = { $fetch: globalThis.$fetch, ports: globalThis.__adminLoginTestPorts };
  globalThis.$fetch = $fetch;
  globalThis.__adminLoginTestPorts = {
    config: () => ({ taikoAdminApiBase: `http://127.0.0.1:${remote.address().port}` }),
    audit: async input => { audits.push(input); }
  };
  let source = await readFile(new URL('../server/utils/admin/auth.ts', import.meta.url), 'utf8');
  source = source.replaceAll('from "h3"', 'from ' + JSON.stringify(import.meta.resolve('h3')))
    .replace('import { ensureNonEmpty, getSecureCookieFlag } from "~/server/internal/account/shared";',
      `const ensureNonEmpty=(v,m)=>{if(!v)throw createError({statusCode:400,statusMessage:m})};const getSecureCookieFlag=()=>false;`)
    .replace('import { recordAdminAction } from "./audit";', 'const recordAdminAction=(input)=>globalThis.__adminLoginTestPorts.audit(input);')
    .replace('import { getAdminRuntimeConfig } from "./shared";', 'const getAdminRuntimeConfig=()=>globalThis.__adminLoginTestPorts.config();');
  let proxy;
  try {
    const auth = await load(source);
    const app = createApp();
    app.use('/login', eventHandler(async event => auth.loginTaikoAdmin(event, await readBody(event))));
    app.use('/me', eventHandler(async event => ({ user: (await auth.requireTaikoAdminSession(event)).user })));
    proxy = createServer(toNodeListener(app));await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${proxy.address().port}`;
    const response = await fetch(base + '/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'isolated-admin', password: 'synthetic-password' }) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).user.username, 'isolated-admin');
    const timing = response.headers.get('server-timing');
    for (const stage of ['credentials', 'identity', 'audit', 'total']) assert.ok(timing.includes(stage + ';dur='));
    assert.doesNotMatch(timing, /synthetic-password|test-trusted-token|isolated-admin/);
    const cookie = response.headers.get('set-cookie').split(';')[0];
    assert.match(response.headers.get('set-cookie'), /HttpOnly/);
    assert.deepEqual(calls, ['/taiko/login', '/taiko/manage/auth/me']);
    assert.equal(audits.length, 1);
    for (let i = 0; i < 2; i++) assert.equal((await fetch(base + '/me', { headers: { cookie } })).status, 200);
    assert.equal(calls.filter(path => path.endsWith('/auth/me')).length, 3);
    for (const token of ['forged', 'unavailable']) {
      assert.equal((await fetch(base + '/me', { headers: { authorization: 'Bearer ' + token } })).status, token === 'forged' ? 401 : 503);
    }
    const invalid = await fetch(base + '/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(invalid.status, 400);
  } finally {
    if (proxy) await new Promise(resolve => proxy.close(resolve));
    await new Promise(resolve => remote.close(resolve));
    globalThis.$fetch = before.$fetch;globalThis.__adminLoginTestPorts = before.ports;
  }
});

test('client reuses the verified login payload; a forced check and logout retain their semantics', async () => {
  const keys = ['useState', '$fetch'];const before = Object.fromEntries(keys.map(key => [key, globalThis[key]]));
  const state = new Map();let calls = 0;
  const payload = { authenticated: true, user: { id: 3, username: 'isolated-admin', exp: 4000000000, expiresAt: '2096-10-02' } };
  globalThis.useState = (key, init) => { if (!state.has(key)) state.set(key, ref(init()));return state.get(key); };
  globalThis.$fetch = async () => { calls++;return payload; };
  try {
    const { useAdminAuthStatus } = await load(await readFile(new URL('../composables/useAdminAuthStatus.ts', import.meta.url), 'utf8'));
    const auth = useAdminAuthStatus();
    auth.acceptAdminAuthPayload(payload);
    assert.equal(await auth.isAuthenticated(), true);assert.equal(calls, 0);
    assert.equal(await auth.isAuthenticated(true), true);assert.equal(calls, 1);
    auth.clearResolvedAdminUser();assert.equal(await auth.isAuthenticated(), false);assert.equal(calls, 1);
  } finally { for (const key of keys) globalThis[key] = before[key]; }
});

test('retired admin pages redirect after authentication while title management remains available', async () => {
  const keys = ['defineNuxtRouteMiddleware', 'useAdminAuthStatus', 'navigateTo'];
  const before = Object.fromEntries(keys.map(key => [key, globalThis[key]]));let authenticated = true;
  globalThis.defineNuxtRouteMiddleware = handler => handler;
  globalThis.useAdminAuthStatus = () => ({ isAuthenticated: async () => authenticated });
  globalThis.navigateTo = (path, options) => ({ path, options });
  try {
    const { default: guard } = await load(await readFile(new URL('../middleware/admin-auth.ts', import.meta.url), 'utf8'));
    for (const path of ['/admin/taiko/annual-beta', '/admin/taiko/annual-summaries', '/admin/taiko/annual-summaries/report']) {
      assert.equal((await guard({ path })).path, '/admin/taiko/dashboard');
    }
    assert.equal(await guard({ path: '/admin/taiko/titles' }), undefined);
    authenticated = false;
    assert.equal((await guard({ path: '/admin/taiko/titles' })).path, '/admin/taiko/login');
  } finally { for (const key of keys) globalThis[key] = before[key]; }
});
