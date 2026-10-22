// Function-level harness: executes the entire production SFC script with
// controlled transports and minimal reactive/lifecycle ports. Not a Vue mount,
// DOM/browser test, Nuxt runtime, or SQL validation. No network is used.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
export function deferred() {
  let resolve, reject;
  const promise = new Promise((r, j) => { resolve = r; reject = j; });
  return { promise, resolve, reject };
}
export const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
export function reactivePorts() {
  const watchers = [], hooks = { beforeUnmount: [], activated: [], deactivated: [] };
  let flushing = false;
  const equal = (a, b) => Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((v, i) => Object.is(v, b[i])) : Object.is(a, b);
  const notify = () => {
    if (flushing) return;
    flushing = true;
    try {
      for (let pass = 0; pass < 50; pass++) {
        let changed = false;
        for (const w of [...watchers]) {
          const value = w.getter();
          if (!equal(w.value, value)) { const old = w.value; w.value = value; changed = true; w.callback(value, old); }
        }
        if (!changed) return;
      }
      throw new Error('Reactive harness did not settle');
    } finally { flushing = false; }
  };
  const ref = initial => {
    let value = initial;
    return { get value() { return value; }, set value(next) { value = next; notify(); } };
  };
  const reactive = object => new Proxy(object, { set(target, key, value) { target[key] = value; notify(); return true; } });
  const computed = getter => ({ get value() { return getter(); } });
  const watch = (source, callback, options = {}) => {
    const getter = typeof source === 'function' ? source : Array.isArray(source)
      ? () => source.map(s => typeof s === 'function' ? s() : s.value) : () => source.value;
    const w = { getter, callback, value: getter() }; watchers.push(w);
    if (options.immediate) callback(w.value, undefined);
    return () => watchers.splice(watchers.indexOf(w), 1);
  };
  return { ref, reactive, computed, watch, nextTick: callback => Promise.resolve().then(() => callback?.()),
    onBeforeUnmount: cb => hooks.beforeUnmount.push(cb), onActivated: cb => hooks.activated.push(cb),
    onDeactivated: cb => hooks.deactivated.push(cb),
    fire: name => { for (const cb of hooks[name]) cb(); }, notify };
}

export async function handlers(path, api, exported, options = {}) {
  const source = await readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'SFC script must exist');
  const code = stripTypeScriptTypes(script.replace(/^import[^\n]*;\r?\n/gm, ''), { mode: 'strip' });
  const reactivity = reactivePorts();
  const { ref, computed, watch, onBeforeUnmount } = reactivity;
  const states = new Map([['account-user', ref({ id: 1 })], ['account-binding-generation', ref(0)]]);
  const caches = new Map(['forum-home', 'forum-me-home'].map(key => [key, ref({ unreadNotificationCount: options.unreadCount || 0 })]));
  const messages = [], navigations = [];
  const useState = (key, factory) => { if (!states.has(key)) states.set(key, ref(factory())); return states.get(key); };
  const useAsyncData = async (_key, loader, config = {}) => {
    const data = ref(config.default?.() ?? null), pending = ref(false);
    let sequence = 0;
    const refresh = async () => {
      const current = ++sequence; pending.value = true;
      try { const value = await loader(); if (current === sequence) data.value = value; }
      finally { if (current === sequence) pending.value = false; }
    };
    const clear = () => { sequence++; data.value = config.default?.() ?? null; pending.value = false; };
    await refresh(); return { data, pending, refresh, clear };
  };
  // Execute the repository guard itself (no replacement of its identity logic).
  const guardSource = await readFile(new URL('../../composables/useAccountRequestGuard.ts', import.meta.url), 'utf8');
  const guardCode = stripTypeScriptTypes(guardSource.replace(/^import[^\n]*;\r?\n/gm, '').replace('export const', 'const'), { mode: 'strip' });
  const useAccountRequestGuard = new Function('useState', 'watch', 'onBeforeUnmount', `${guardCode}; return useAccountRequestGuard;`)(useState, watch, onBeforeUnmount);
  const route = reactivity.reactive({ query: options.query || {}, fullPath: '/forum/new' });
  const navigate = async target => { navigations.push(target); return options.navigate?.(target); };
  const ports = {
    ...Object.fromEntries(Object.entries(reactivity).filter(([key]) => !['fire', 'notify'].includes(key))),
    useState, useAccountRequestGuard, useAsyncData,
    useI18n: () => ({ t: key => key, locale: ref(options.locale || 'zh') }),
    useLocalePath: () => value => value, useAccountState: () => ({ accountUser: states.get('account-user') }),
    useNuxtData: key => ({ data: caches.get(key) }), useViewerApiFetch: () => api,
    useViewerDateTime: () => ({ formatDateTime: v => v, formatDate: v => v }),
    definePageMeta: () => {}, useViewerSeo: () => {}, buildPageDescription: v => v,
    useRoute: () => route, useRouter: () => ({ push: navigate }), navigateTo: navigate,
    isNavigationFailure: result => Boolean(result?.__navigationFailure),
    ElMessage: Object.fromEntries(['success', 'warning', 'error'].map(kind => [kind, text => messages.push({ kind, text })])),
    FORUM_IMAGE_MAX_BYTES: 20 * 1024 * 1024,
    resolveForumSectionTranslation: (_t, _slug, name) => name,
    FormData: class { append() {} }
  };
  const run = new AsyncFunction(...Object.keys(ports), `${code}\nreturn { ${exported.join(', ')} };`);
  const model = await run(...Object.values(ports));
  return { ...model, source, states, caches, messages, navigations, route,
    changeUser: id => { states.get('account-user').value = id === null ? null : { id }; },
    deactivate: () => reactivity.fire('deactivated'), activate: () => reactivity.fire('activated'),
    unmount: () => reactivity.fire('beforeUnmount') };
}

export function notification(id, extra = {}) {
  return { id, isRead: false, threadId: null, postId: null, type: 'system', title: `synthetic-${id}`, body: 'Synthetic', createdAt: '2026-10-22T00:00:00Z', ...extra };
}
export async function notifications(items, options = {}) {
  const server = { items: structuredClone(items), unreadCount: options.unreadCount ?? items.filter(i => !i.isRead).length };
  const writes = [], reads = [], readsQueue = [];
  const api = (path, input = {}) => {
    if (path === '/api/forum/notifications') {
      const { page, pageSize } = input.query || {}; reads.push({ page, pageSize });
      if (readsQueue.length) return readsQueue.shift()();
      return Promise.resolve({ total: server.items.length, unreadCount: server.unreadCount, page, pageSize,
        items: structuredClone(server.items.slice((page - 1) * pageSize, page * pageSize)) });
    }
    assert.equal(path, '/api/forum/notifications/read'); assert.equal(input.method, 'POST');
    const d = deferred();
    const call = { body: structuredClone(input.body), reject: d.reject, resolve: result => {
      for (const item of server.items) if (!input.body.ids || input.body.ids.includes(item.id)) item.isRead = true;
      server.unreadCount = result.unreadCount; d.resolve(result);
    } };
    writes.push(call); return d.promise;
  };
  if (options.initialFailure) readsQueue.push(() => Promise.reject(new Error('503 synthetic')));
  const h = await handlers('pages/forum/notifications.vue', api,
    ['data', 'pending', 'loadError', 'page', 'pageSize', 'totalPages', 'actionsDisabled', 'mutationBusy', 'openingNotificationId', 'markAllRead', 'openNotification', 'movePage', 'retry', 'copy'],
    { ...options, unreadCount: server.unreadCount });
  return { ...h, server, writes, reads, readsQueue, item: id => h.data.value.items.find(i => i.id === id) };
}
export async function composer(options = {}) {
  const calls = [];
  const api = (path, input = {}) => {
    if (path === '/api/forum/sections') return Promise.resolve({ items: [] });
    if (path.startsWith('/api/content/songs/')) return Promise.resolve({ song: { id: 1455, song_name: 'Synthetic', level_4: 9, level_5: 10 } });
    const d = deferred(); calls.push({ path, input, ...d }); return d.promise;
  };
  const h = await handlers('pages/forum/new.vue', api,
    ['form', 'paragraphBlocks', 'imageBlocks', 'submitting', 'uploading', 'publishedThreadId', 'navigationFailed', 'editorDisabled', 'submit', 'viewPublishedThread', 'startAnotherThread', 'uploadImage', 'searchSongs', 'songQuery', 'songResults', 'songLoading', 'copy'], options);
  h.form.title = 'Synthetic title'; h.form.paragraphDraft = '  Editable body  ';
  return { ...h, calls };
}
