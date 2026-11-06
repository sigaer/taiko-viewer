import assert from 'node:assert/strict';
import test from 'node:test';
import { notifications, notification, composer, deferred, settle } from './fixtures/forumHandlerHarness.mjs';

await test('valid notification refresh reconciles both caches while failed refresh keeps the last count', async () => {
  const h = await notifications([notification(1)]);
  h.server.unreadCount = 8;
  await h.retry();
  assert.equal(h.unreadCount.value, 8);
  for (const cache of h.caches.values()) assert.equal(cache.value.unreadNotificationCount, 8);
  h.readsQueue.push(() => Promise.reject(new Error('read unavailable')));
  await h.retry();
  assert.equal(h.data.value, null);
  for (const cache of h.caches.values()) assert.equal(cache.value.unreadNotificationCount, 8);
  assert.equal(h.unreadCount.value, 8);
});
await test('accepted mark while inactive reconciles cached badges only after a valid resumed read', async () => {
  const h = await notifications([notification(1)]);
  const pending = h.markAllRead();
  h.deactivate();
  h.writes[0].resolve({ unreadCount: 0 });
  await pending;
  for (const cache of h.caches.values()) assert.equal(cache.value.unreadNotificationCount, 1);
  h.activate();
  await settle();
  for (const cache of h.caches.values()) assert.equal(cache.value.unreadNotificationCount, 0);
});

await test('notification success uses the server count, including off-page unread', async () => {
  const h = await notifications([notification(1)], { unreadCount: 31 });
  const task = h.openNotification(h.item(1));
  assert.equal(h.item(1).isRead, false, 'do not claim acceptance before the response');
  h.writes[0].resolve({ unreadCount: 30 }); await task;
  assert.equal(h.data.value.unreadCount, 30); assert.equal(h.item(1).isRead, true);
  for (const cache of h.caches.values()) assert.equal(cache.value.unreadNotificationCount, 30);
  assert.equal(h.unreadCount.value, 30);
  assert.equal(h.mutationBusy.value, false); assert.equal(h.openingNotificationId.value, null);
});
await test('single-read failure preserves the existing records and count', async () => {
  const h = await notifications([notification(1), notification(2)]);
  const task = h.openNotification(h.item(1)); h.writes[0].reject(new Error('503')); await task;
  assert.equal(h.data.value.unreadCount, 2); assert.equal(h.item(1).isRead, false);
  assert.equal(h.mutationBusy.value, false); assert.equal(h.messages.at(-1).kind, 'error');
});
await test('different notifications cannot race: the busy action is ignored and can be retried', async () => {
  const h = await notifications([notification(1), notification(2)]);
  const a = h.openNotification(h.item(1)); await h.openNotification(h.item(2));
  assert.equal(h.writes.length, 1, 'shared mutex prevents the old A/B rollback race');
  h.writes[0].reject(new Error('late A')); await a;
  const b = h.openNotification(h.item(2)); h.writes[1].resolve({ unreadCount: 1 }); await b;
  assert.equal(h.data.value.unreadCount, 1);
  assert.equal(h.item(1).isRead, false); assert.equal(h.item(2).isRead, true);
});
await test('single-read and mark-all use the same lock', async () => {
  const h = await notifications([notification(1), notification(2)]);
  const first = h.openNotification(h.item(1)); await h.markAllRead();
  assert.equal(h.writes.length, 1); h.writes[0].reject(new Error('late single')); await first;
  const all = h.markAllRead(); h.writes[1].resolve({ unreadCount: 0 }); await all;
  assert.equal(h.data.value.unreadCount, 0); assert.ok(h.data.value.items.every(i => i.isRead));
  assert.equal(h.unreadCount.value, 0);
});
await test('mark-all failure never optimistically erases unread flags', async () => {
  const h = await notifications([notification(1), notification(2)]);
  const all = h.markAllRead(); assert.equal(h.data.value.unreadCount, 2);
  h.writes[0].reject(new Error('503')); await all;
  assert.equal(h.data.value.unreadCount, 2); assert.ok(h.data.value.items.every(i => !i.isRead));
});
await test('duplicate click sends exactly one mark-read request', async () => {
  const h = await notifications([notification(1)]);
  const task = h.openNotification(h.item(1)); await h.openNotification(h.item(1));
  assert.equal(h.writes.length, 1); h.writes[0].resolve({ unreadCount: 0 }); await task;
});
await test('rejected navigation clears busy state and permits a second click', async () => {
  const h = await notifications([notification(1, { isRead: true, threadId: 12, postId: 9 })], { navigate: async () => { throw new Error('navigation'); } });
  await h.openNotification(h.item(1));
  assert.equal(h.mutationBusy.value, false); assert.equal(h.openingNotificationId.value, null);
  await h.openNotification(h.item(1));
  assert.equal(h.navigations.length, 2); assert.equal(h.writes.length, 0);
  assert.deepEqual(h.navigations[0], { path: '/forum/thread/12', hash: '#reply-9' });
});
await test('navigation rejection after successful mark-read cannot restore unread', async () => {
  const h = await notifications([notification(1, { threadId: 12 })], { navigate: async () => { throw new Error('navigation'); } });
  const task = h.openNotification(h.item(1)); h.writes[0].resolve({ unreadCount: 0 }); await task;
  assert.equal(h.data.value.unreadCount, 0); assert.equal(h.item(1).isRead, true);
  assert.equal(h.openingNotificationId.value, null); assert.equal(h.messages.at(-1).kind, 'error');
});
await test('resolved navigation cancellation also releases notification controls', async () => {
  const h = await notifications([notification(1, { threadId: 12, isRead: true })], { navigate: async () => ({ __navigationFailure: true }) });
  await h.openNotification(h.item(1)); assert.equal(h.mutationBusy.value, false);
  assert.equal(h.messages.at(-1).kind, 'error');
});
await test('read failure has a separate state and retry recovers', async () => {
  const h = await notifications([notification(1)], { initialFailure: true });
  assert.equal(h.data.value, null); assert.equal(h.loadError.value, '通知加载失败'); assert.equal(h.pending.value, false);
  await h.retry(); assert.equal(h.loadError.value, ''); assert.equal(h.data.value.items.length, 1);
  assert.match(h.source, /v-else-if="loadError"/);
  assert.match(h.source, /v-else-if="data"/);
});
await test('legal empty notifications are not a failure', async () => {
  const h = await notifications([]);
  assert.equal(h.data.value.total, 0); assert.equal(h.loadError.value, ''); assert.equal(h.pending.value, false);
});
await test('pagination requests the existing page/pageSize contract and keeps global unread count', async () => {
  const h = await notifications(Array.from({ length: 25 }, (_, i) => notification(i + 1)));
  assert.equal(h.data.value.items.length, 20); assert.equal(h.totalPages.value, 2);
  h.movePage(1); await settle();
  assert.equal(h.page.value, 2); assert.equal(h.data.value.items.length, 5);
  assert.equal(h.data.value.unreadCount, 25); assert.deepEqual(h.reads.at(-1), { page: 2, pageSize: 20 });
  h.movePage(-1); await settle(); assert.equal(h.data.value.items.length, 20);
});
await test('page navigation is disabled during a mark-read mutation', async () => {
  const h = await notifications(Array.from({ length: 25 }, (_, i) => notification(i + 1)));
  const task = h.openNotification(h.item(1)); h.movePage(1); assert.equal(h.page.value, 1);
  h.writes[0].resolve({ unreadCount: 24 }); await task;
});
await test('an old notification response cannot update the next user or navigate', async () => {
  const h = await notifications([notification(1, { threadId: 5 })]);
  const old = h.openNotification(h.item(1)); h.changeUser(2);
  h.server.items = [notification(201)]; h.server.unreadCount = 7;
  for (const cache of h.caches.values()) cache.value = { unreadNotificationCount: 7 };
  await settle(); h.writes[0].resolve({ unreadCount: 0 }); await old;
  assert.equal(h.data.value.items[0].id, 201); assert.equal(h.data.value.unreadCount, 7);
  assert.equal(h.navigations.length, 0); assert.equal(h.messages.length, 0);
  for (const cache of h.caches.values()) assert.equal(cache.value.unreadNotificationCount, 7);
});
await test('switching A to B and back to A invalidates the first A callback', async () => {
  const h = await notifications([notification(1)]);
  const old = h.openNotification(h.item(1)); h.changeUser(2); h.changeUser(1); await settle();
  h.writes[0].reject(new Error('old A')); await old;
  assert.equal(h.messages.length, 0); assert.equal(h.data.value.unreadCount, 1);
});
await test('KeepAlive deactivation hides old state and blocks late notification effects', async () => {
  const h = await notifications([notification(1, { threadId: 5 })]);
  const old = h.openNotification(h.item(1)); const reads = h.reads.length; h.deactivate();
  h.writes[0].resolve({ unreadCount: 0 }); await old;
  assert.equal(h.reads.length, reads); assert.equal(h.navigations.length, 0); assert.equal(h.data.value, null);
  h.activate(); await settle(); assert.equal(h.data.value.unreadCount, 0); assert.equal(h.mutationBusy.value, false);
});
await test('late GET after identity switch cannot replace current user records', async () => {
  const h = await notifications([notification(1)]), d = deferred();
  h.readsQueue.push(() => d.promise); const refresh = h.retry();
  h.changeUser(2); h.server.items = [notification(202)]; h.server.unreadCount = 1; await settle();
  d.resolve({ total: 1, unreadCount: 99, page: 1, pageSize: 20, items: [notification(99)] }); await refresh;
  assert.equal(h.data.value.items[0].id, 202); assert.equal(h.data.value.unreadCount, 1);
});
await test('late GET error after deactivation cannot show a new error or trigger another fetch', async () => {
  const h = await notifications([notification(1)]), d = deferred();
  h.readsQueue.push(() => d.promise); const refresh = h.retry(); const reads = h.reads.length;
  h.deactivate(); d.reject(new Error('late error')); await refresh;
  assert.equal(h.loadError.value, ''); assert.equal(h.data.value, null); assert.equal(h.reads.length, reads);
});
await test('Japanese notification failure has localized state copy', async () => {
  const h = await notifications([], { initialFailure: true, locale: 'ja' });
  assert.equal(h.loadError.value, '通知を読み込めませんでした'); assert.equal(h.copy.value.retry, '再試行');
});
await test('failed discussion creation keeps the original editable body', async () => {
  const h = await composer(); const initial = h.form.paragraphDraft;
  const task = h.submit(); h.calls[0].reject(new Error('503')); await task;
  assert.equal(h.form.paragraphDraft, initial); assert.deepEqual(h.paragraphBlocks.value, []);
  assert.equal(h.submitting.value, false); assert.equal(h.publishedThreadId.value, null);
});
await test('retry sends a single current draft rather than duplicating failed paragraphs', async () => {
  const h = await composer(); const first = h.submit(); h.calls[0].reject(new Error('503')); await first;
  h.form.paragraphDraft = 'Edited body'; const second = h.submit();
  assert.deepEqual(h.calls[1].input.body.contentBlocks, [{ type: 'paragraph', text: 'Edited body' }]);
  h.calls[1].resolve({ id: 10 }); await second; assert.equal(h.publishedThreadId.value, 10);
});
await test('successful creation preserves chart identity, tags and content ordering', async () => {
  const h = await composer({ query: { songId: '1455', difficulty: '5' } });
  h.form.tagsInput = 'one，two #three'; h.paragraphBlocks.value = ['Existing paragraph'];
  h.imageBlocks.value = [{ imageUrl: '/synthetic.png', caption: 'Caption' }];
  const task = h.submit(), body = h.calls[0].input.body;
  assert.equal(body.songId, '1455'); assert.equal(body.difficultyType, '5'); assert.equal(body.level, '10');
  assert.deepEqual(body.tags, ['one', 'two', 'three']); assert.equal(body.contentBlocks.length, 3);
  assert.equal(body.contentBlocks[0].text, 'Existing paragraph'); assert.equal(body.contentBlocks[1].text, 'Editable body');
  assert.equal(body.contentBlocks[2].type, 'image'); h.calls[0].resolve({ id: 11 }); await task;
  assert.equal(h.navigations[0], '/forum/thread/11');
});
await test('all paragraph blocks remain editable after switching away from guide mode', async () => {
  const h = await composer(); h.paragraphBlocks.value = ['Original']; h.form.threadType = 'discussion';
  assert.match(h.source, /<div v-if="paragraphBlocks.length" class="block-list">/);
  assert.match(h.source, /v-model="paragraphBlocks\[index\]"/);
  h.paragraphBlocks.value[0] = 'Edited'; const task = h.submit();
  assert.equal(h.calls[0].input.body.contentBlocks[0].text, 'Edited'); h.calls[0].reject(new Error('503')); await task;
  assert.equal(h.paragraphBlocks.value[0], 'Edited');
});
await test('creation success then navigation rejection never resends POST on retry', async () => {
  const h = await composer({ navigate: async () => { throw new Error('navigation'); } });
  const task = h.submit(); h.calls[0].resolve({ id: 12 }); await task;
  assert.equal(h.publishedThreadId.value, 12); assert.equal(h.navigationFailed.value, true);
  assert.equal(h.submitting.value, false); assert.equal(h.editorDisabled.value, true);
  await h.submit(); assert.equal(h.calls.length, 1); assert.equal(h.navigations.length, 2);
  assert.ok(h.messages.every(m => m.kind !== 'error'), 'do not label navigation as creation failure');
});
await test('resolved navigation failure also retains the accepted creation receipt', async () => {
  const h = await composer({ navigate: async () => ({ __navigationFailure: true }) });
  const task = h.submit(); h.calls[0].resolve({ id: 13 }); await task;
  assert.equal(h.navigationFailed.value, true); assert.equal(h.publishedThreadId.value, 13);
  await h.viewPublishedThread(); assert.equal(h.calls.length, 1);
});
await test('double publish click sends one POST', async () => {
  const h = await composer(); const task = h.submit(); await h.submit(); assert.equal(h.calls.length, 1);
  h.calls[0].resolve({ id: 14 }); await task;
});
await test('identity change clears private drafts and ignores late creation success', async () => {
  const h = await composer(); h.imageBlocks.value = [{ imageUrl: '/private.png', caption: 'Private' }];
  const task = h.submit(); h.changeUser(2); h.calls[0].resolve({ id: 15 }); await task;
  assert.equal(h.form.paragraphDraft, ''); assert.equal(h.form.title, ''); assert.deepEqual(h.imageBlocks.value, []);
  assert.equal(h.publishedThreadId.value, null); assert.equal(h.navigations.length, 0); assert.equal(h.messages.length, 0);
});
await test('KeepAlive deactivation retains an accepted creation without navigating in the background', async () => {
  const h = await composer(); const task = h.submit(); h.deactivate(); h.calls[0].resolve({ id: 16 }); await task;
  assert.equal(h.publishedThreadId.value, 16); assert.equal(h.navigations.length, 0);
  h.activate(); await h.submit(); assert.equal(h.calls.length, 1); assert.equal(h.navigations[0], '/forum/thread/16');
});
await test('unmount ignores late creation receipt and side effects', async () => {
  const h = await composer(); const task = h.submit(); h.unmount(); h.calls[0].resolve({ id: 17 }); await task;
  assert.equal(h.publishedThreadId.value, null); assert.equal(h.messages.length, 0); assert.equal(h.navigations.length, 0);
});
await test('empty editable paragraphs do not cause an empty-content POST', async () => {
  const h = await composer(); h.form.paragraphDraft = ' '; h.paragraphBlocks.value = ['  ']; await h.submit();
  assert.equal(h.calls.length, 0); assert.equal(h.messages.at(-1).text, h.copy.value.contentRequired);
});
await test('uploads in flight block publication and do not lose successful attachment results', async () => {
  const h = await composer(); const uploaded = h.uploadImage({ file: { size: 10 } });
  assert.equal(h.uploading.value, true); await h.submit(); assert.equal(h.calls.length, 1);
  h.calls[0].resolve({ imageUrl: '/synthetic.png' }); await uploaded;
  assert.equal(h.uploading.value, false); const task = h.submit();
  assert.equal(h.calls[1].input.body.contentBlocks.at(-1).imageUrl, '/synthetic.png'); h.calls[1].resolve({ id: 18 }); await task;
});
await test('late upload from another author cannot populate the new draft', async () => {
  const h = await composer(); const task = h.uploadImage({ file: { size: 10 } }); h.changeUser(2);
  h.calls[0].resolve({ imageUrl: '/old-private.png' }); await task;
  assert.deepEqual(h.imageBlocks.value, []); assert.equal(h.uploading.value, false); assert.equal(h.messages.length, 0);
});
await test('late song search after KeepAlive deactivation cannot leave the loading flag stuck', async () => {
  const h = await composer(); h.songQuery.value = 'Synthetic'; const task = h.searchSongs(); h.deactivate();
  h.calls[0].resolve({ songs: [{ id: 1 }] }); await task; h.activate();
  assert.equal(h.songLoading.value, false); assert.deepEqual(h.songResults.value, []);
});
await test('start-another explicitly clears the saved receipt and permits a new publication', async () => {
  const h = await composer(); const task = h.submit(); h.calls[0].resolve({ id: 19 }); await task;
  h.startAnotherThread(); assert.equal(h.publishedThreadId.value, null); assert.equal(h.form.paragraphDraft, '');
  h.form.title = 'Another'; h.form.paragraphDraft = 'New content'; const second = h.submit();
  assert.equal(h.calls.length, 2); h.calls[1].resolve({ id: 20 }); await second;
});
await test('late old-user read cannot unlock a newer user mutation', async () => {
  const h = await notifications([notification(1)]);
  const old = h.openNotification(h.item(1)); h.changeUser(2); h.server.items = [notification(202)]; await settle();
  const current = h.openNotification(h.item(202)); h.writes[0].reject(new Error('old'));
  await old; assert.equal(h.mutationBusy.value, true); assert.equal(h.openingNotificationId.value, 202);
  h.writes[1].resolve({ unreadCount: 0 }); await current; assert.equal(h.mutationBusy.value, false);
});
await test('late creation response after author A-B-A is still stale', async () => {
  const h = await composer(); const old = h.submit(); h.changeUser(2); h.changeUser(1);
  h.form.paragraphDraft = 'New A draft'; h.calls[0].resolve({ id: 21 }); await old;
  assert.equal(h.publishedThreadId.value, null); assert.equal(h.form.paragraphDraft, 'New A draft');
  assert.equal(h.navigations.length, 0);
});
await test('multiple upload completions keep publication disabled until all uploads finish', async () => {
  const h = await composer(); const a = h.uploadImage({ file: { size: 1 } }); const b = h.uploadImage({ file: { size: 2 } });
  h.calls[0].resolve({ imageUrl: '/a.png' }); await a; assert.equal(h.uploading.value, true);
  await h.submit(); assert.equal(h.calls.length, 2);
  h.calls[1].reject(new Error('503')); await b; assert.equal(h.uploading.value, false);
  assert.equal(h.form.paragraphDraft, '  Editable body  '); assert.equal(h.imageBlocks.value.length, 1);
});
await test('body text changed while a request is pending is never overwritten by its failure', async () => {
  const h = await composer(); const old = h.submit(); h.form.paragraphDraft = 'New edit';
  h.calls[0].reject(new Error('503')); await old;
  assert.equal(h.form.paragraphDraft, 'New edit'); assert.deepEqual(h.paragraphBlocks.value, []);
});

await test('title-free body and image drafts submit with locale and query section', async () => {
  const h = await composer({ query: { section: 'general' } }); h.form.title = '';
  const first = h.submit(); assert.equal(h.calls[0].input.body.title, '');
  assert.equal(h.calls[0].input.body.locale, 'zh'); assert.equal(h.calls[0].input.body.sectionSlug, 'general');
  h.calls[0].reject(new Error('retry')); await first;
  h.form.paragraphDraft = ''; h.imageBlocks.value = [{imageUrl:'/test.png', caption:''}];
  const second = h.submit(); assert.equal(h.calls[1].input.body.contentBlocks.length, 1);
  h.calls[1].resolve({id:40}); await second;
});
await test('upload failure preserves body and allows retry', async () => {
  const h = await composer(); const body = h.form.paragraphDraft;
  const first = h.uploadImage({file:{size:10}}); h.calls[0].reject(new Error('upload failed')); await first;
  assert.equal(h.form.paragraphDraft, body); assert.equal(h.uploading.value, false);
  const second = h.uploadImage({file:{size:10}}); h.calls[1].resolve({imageUrl:'/retry.png'}); await second;
  assert.equal(h.imageBlocks.value[0].imageUrl, '/retry.png');
});
await test('deactivated upload cannot overwrite the resumed draft or unlock a new upload', async () => {
  const h = await composer(); const old = h.uploadImage({file:{size:10}});
  h.deactivate(); h.activate(); const current = h.uploadImage({file:{size:10}});
  h.calls[0].resolve({imageUrl:'/stale.png'}); await old;
  assert.equal(h.uploading.value,true); assert.equal(h.imageBlocks.value.length,0);
  h.calls[1].resolve({imageUrl:'/fresh.png'}); await current;
  assert.equal(h.imageBlocks.value[0].imageUrl,'/fresh.png');
});
