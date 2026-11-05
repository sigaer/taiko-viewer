// Production composables with real Vue reactivity and controlled browser/timer
// ports. No network, database, or production sessions are used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { ref, computed, watch, effectScope, nextTick } from 'vue';

const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); await nextTick(); };
async function fixture(options = {}) {
  const scope = effectScope(), user = ref(options.guest ? null : { id: 1 });
  const route = ref('/songs/available'), states = new Map(), requests = [], timers = new Map();
  const hooks = { mounted: [], beforeUnmount: [] };
  const media = Object.assign(new EventTarget(), { matches: !options.desktop });
  const document = Object.assign(new EventTarget(), { hidden: false });
  const window = Object.assign(new EventTarget(), { matchMedia: () => media });
  const navigator = { onLine: true };
  let timerId = 0;
  const ports = {
    ref, computed, watch, document, window, navigator, AbortController,
    useAccountState: () => ({ accountUser: user }),
    useState: (key, factory) => { if (!states.has(key)) states.set(key, ref(factory())); return states.get(key); },
    useRoute: () => ({ get fullPath() { return route.value; } }),
    useViewerApiFetch: () => (path, input) => new Promise((resolve, reject) => requests.push({ path, input, resolve, reject })),
    onMounted: fn => hooks.mounted.push(fn), onBeforeUnmount: fn => hooks.beforeUnmount.push(fn),
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout: id => timers.delete(id)
  };
  for (const name of ['useForumUnreadCount', 'useForumNotificationPolling']) {
    const source = await readFile(new URL(`../composables/${name}.ts`, import.meta.url), 'utf8');
    const code = stripTypeScriptTypes(source.replace('export const', 'const'), { mode: 'strip' });
    ports[name] = new Function(...Object.keys(ports), `${code}; return ${name};`)(...Object.values(ports));
  }
  const count = scope.run(() => ports.useForumUnreadCount());
  const model = scope.run(() => ports.useForumNotificationPolling());
  hooks.mounted.forEach(fn => fn());
  const dispatch = (target, name) => target.dispatchEvent(new Event(name));
  let closed = false;
  return {
    ...count, ...model, user, route, requests, timers,
    hide: value => { document.hidden = value; dispatch(document, 'visibilitychange'); },
    mobile: value => { media.matches = value; dispatch(media, 'change'); },
    online: value => { navigator.onLine = value; dispatch(window, value ? 'online' : 'offline'); },
    focus: () => dispatch(window, 'focus'),
    tick: async () => { const [id, timer] = timers.entries().next().value; timers.delete(id); timer.callback(); await settle(); },
    close: () => { if (!closed) { closed = true; hooks.beforeUnmount.forEach(fn => fn()); scope.stop(); } },
    listenerTargets: [media, document, window]
  };
}

test('mobile polling starts outside community, deduplicates events, and checks again in 30 seconds', async () => {
  const h = await fixture();
  try {
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].path, '/api/forum/notifications/unread');
    assert.equal(h.requests[0].input.timeout, 10000);
    h.focus(); h.focus(); assert.equal(h.requests.length, 1);
    h.requests[0].resolve({ unreadCount: 2 }); await settle();
    assert.equal(h.unreadCount.value, 2);
    assert.equal([...h.timers.values()][0].delay, 30000);
    await h.tick(); h.requests[1].resolve({ unreadCount: 3 }); await settle();
    assert.equal(h.unreadCount.value, 3); assert.equal(h.timers.size, 1);
    h.route.value = '/forum'; await settle();
    assert.equal(h.requests.length, 3); assert.equal(h.timers.size, 0);
    assert.equal(h.unreadCount.value, 3, 'entering community must not mark notifications read');
  } finally { h.close(); }
});

test('successful mark-read counts supersede an older in-flight poll', async () => {
  const h = await fixture();
  try {
    h.setUnreadCount(4); h.setUnreadCount(0);
    h.requests[0].resolve({ unreadCount: 4 }); await settle();
    assert.equal(h.unreadCount.value, 0);
    await h.tick(); h.requests[1].resolve({ unreadCount: 1 }); await settle();
    assert.equal(h.unreadCount.value, 1);
  } finally { h.close(); }
});

test('logout and account round trips discard old responses immediately', async () => {
  const h = await fixture();
  try {
    h.setUnreadCount(5);
    h.user.value = null;
    assert.equal(h.unreadCount.value, 0); assert.ok(h.requests[0].input.signal.aborted);
    h.user.value = { id: 2 }; h.user.value = { id: 1 };
    h.requests[0].resolve({ unreadCount: 20 }); h.requests[1].resolve({ unreadCount: 30 });
    await settle(); assert.equal(h.unreadCount.value, 0);
    h.requests[2].resolve({ unreadCount: 1 }); await settle(); assert.equal(h.unreadCount.value, 1);
    h.user.value = { id: 1, username: 'new metadata' }; assert.equal(h.requests.length, 3);
  } finally { h.close(); }
});

test('guests and desktop do not poll; login and switching to mobile start checks', async () => {
  const h = await fixture({ guest: true, desktop: true });
  try {
    assert.equal(h.requests.length, 0);
    h.user.value = { id: 1 }; assert.equal(h.requests.length, 0);
    h.mobile(true); assert.equal(h.requests.length, 1);
    h.mobile(false); assert.ok(h.requests[0].input.signal.aborted);
    h.requests[0].resolve({ unreadCount: 6 }); await settle(); assert.equal(h.unreadCount.value, 0);
    assert.equal(h.timers.size, 0);
  } finally { h.close(); }
});

test('hidden and offline pages pause; returning checks afresh without accepting aborted results', async () => {
  const h = await fixture();
  try {
    h.hide(true); assert.ok(h.requests[0].input.signal.aborted);
    h.requests[0].resolve({ unreadCount: 4 }); await settle();
    assert.equal(h.unreadCount.value, 0); assert.equal(h.timers.size, 0);
    h.hide(false); assert.equal(h.requests.length, 2);
    h.requests[1].resolve({ unreadCount: 2 }); await settle();
    h.online(false); assert.equal(h.timers.size, 0);
    h.online(true); assert.equal(h.requests.length, 3);
  } finally { h.close(); }
});

test('failed or malformed polls preserve the last confirmed count and schedule recovery', async () => {
  const h = await fixture();
  try {
    h.setUnreadCount(7); h.requests[0].reject(new Error('offline')); await settle();
    assert.equal(h.unreadCount.value, 7); assert.equal(h.timers.size, 1);
    for (const count of [-1, NaN, 1.5, '2']) {
      await h.tick(); h.requests.at(-1).resolve({ unreadCount: count }); await settle();
      assert.equal(h.unreadCount.value, 7);
    }
    await h.tick(); h.requests.at(-1).resolve({ unreadCount: 0 }); await settle();
    assert.equal(h.unreadCount.value, 0);
  } finally { h.close(); }
});

test('unmount aborts requests, clears timers and removes browser listeners', async () => {
  const h = await fixture();
  h.close(); assert.ok(h.requests[0].input.signal.aborted);
  h.requests[0].resolve({ unreadCount: 4 }); await settle();
  assert.equal(h.unreadCount.value, 0); assert.equal(h.timers.size, 0);
  h.focus(); h.hide(false); h.mobile(true); h.online(true);
  assert.equal(h.requests.length, 1);
});
