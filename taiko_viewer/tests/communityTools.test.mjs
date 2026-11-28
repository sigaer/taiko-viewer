// Community completion (favourite, follow / block, member page, notification mark / filter, search, copy link,
// 只看楼主, jump to floor, drafts, author edit / delete): the pure helpers, the ownership rules of the new endpoints
// (without a database: the SQL chain is tests/forumAuthorEditSqlHttp.test.mjs on the isolated Linux test DB), and
// the production page scripts run through the function-level harness. No network, no database, no browser.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  onlyAuthorFloors,
  floorIdForNumber,
  ownsItem,
  threadLink,
  NOTIFICATION_FILTERS,
  filterNotifications,
  ME_TABS,
  meTab,
  meTabRequest,
  toEditableBlocks,
  fromEditableBlocks,
  isDerivedSummary,
  splitTags,
  tagsInputOf,
  replyWindows,
  windowOfPost
} from "../utils/rework/community.ts";
import {
  DRAFT_PREFIX,
  replyDraftKey,
  threadDraftKey,
  cleanReplyDraft,
  cleanThreadDraft,
  readDraft,
  writeDraft,
  removeDraft,
  browserDraftStorage
} from "../utils/rework/communityDraft.ts";
import { decideAuthorWrite, decideFloorDelete, threadVisibleTo, FORUM_DELETED_STATUS } from "../server/utils/forum/ownership.ts";
import { handlers, notification, deferred, settle } from "./fixtures/forumHandlerHarness.mjs";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const memoryStorage = () => {
  const map = new Map();
  return { map, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
};
const floor = (id, floorNo, author, replies = []) => ({ id, floorNo, author: { id: author, username: `u${author}` }, replies, bodyText: "", contentBlocks: [] });

test("只看楼主 keeps the thread author's floors with all their replies, in order", () => {
  const floors = [floor(1, 1, 7, [{ id: 11, author: { id: 9 } }]), floor(2, 2, 9), floor(3, 3, 7)];
  assert.deepEqual(onlyAuthorFloors(floors, 7).map((f) => f.id), [1, 3]);
  assert.equal(onlyAuthorFloors(floors, 7)[0].replies.length, 1);
  assert.deepEqual(onlyAuthorFloors(floors, 42), []);
  assert.deepEqual(replyWindows(onlyAuthorFloors(floors, 42)), [], "no windows: the page shows the 只看楼主 empty state");
  assert.equal(windowOfPost(replyWindows(onlyAuthorFloors(floors, 7)), 2), -1, "a hidden floor is not found (the page then turns 只看楼主 off)");
});

test("jump to floor: exact number, else the next existing floor; invalid or past the end is null", () => {
  const floors = [floor(10, 1, 1), floor(20, 2, 1), floor(40, 4, 1)];
  assert.equal(floorIdForNumber(floors, "2"), 20);
  assert.equal(floorIdForNumber(floors, " 3 "), 40, "a removed floor jumps to the next one");
  assert.equal(floorIdForNumber(floors, 1), 10);
  for (const bad of ["", "0", "-1", "1.5", "abc", "5", null, undefined]) assert.equal(floorIdForNumber(floors, bad), null, String(bad));
});

test("ownership, links, notification filter and /forum/me tabs", () => {
  assert.equal(ownsItem(5, 5), true);
  assert.equal(ownsItem(5, 5, true), false, "locked thread: no author controls");
  assert.equal(ownsItem(5, 6), false);
  assert.equal(ownsItem(5, null), false);
  assert.equal(ownsItem(0, 0), false);
  assert.equal(threadLink("https://viewer.example/", "/ja/forum/thread/12"), "https://viewer.example/ja/forum/thread/12");
  assert.equal(threadLink("https://viewer.example", "forum/thread/12", 99), "https://viewer.example/forum/thread/12#reply-99");
  assert.deepEqual([...NOTIFICATION_FILTERS], ["all", "reply", "mention", "like", "system"]);
  const items = [{ id: 1, type: "reply" }, { id: 2, type: "like" }, { id: 3, type: "reply" }];
  assert.deepEqual(filterNotifications(items, "reply").map((i) => i.id), [1, 3]);
  assert.deepEqual(filterNotifications(items, "all").map((i) => i.id), [1, 2, 3]);
  assert.deepEqual(filterNotifications(items, "system"), []);
  assert.deepEqual([...ME_TABS], ["threads", "replied", "favorites", "history", "following", "followers", "blocked"]);
  assert.equal(meTab(undefined), "threads");
  assert.equal(meTab(["favorites", "x"]), "favorites");
  assert.equal(meTab("bogus"), "threads");
  assert.deepEqual(meTabRequest("threads"), { kind: "threads", scope: "mine" });
  for (const scope of ["replied", "favorites", "history"]) assert.deepEqual(meTabRequest(scope), { kind: "threads", scope });
  for (const scope of ["following", "followers", "blocked"]) assert.deepEqual(meTabRequest(scope), { kind: "people", scope });
});

test("thread editing keeps the stored block order and the create-time rules", () => {
  const stored = [
    { type: "paragraph", text: "第一段" },
    { type: "image", imageUrl: "https://s.example/a.png", caption: "说明", alt: "x" },
    { type: "paragraph", text: "第二段" }
  ];
  const editable = toEditableBlocks(stored);
  assert.deepEqual(editable.map((b) => b.type), ["paragraph", "image", "paragraph"]);
  assert.equal(new Set(editable.map((b) => b.key)).size, 3);
  editable[2].text = "   ";
  editable.push({ key: "n1", type: "image", imageUrl: "https://s.example/b.png", caption: "  " });
  assert.deepEqual(fromEditableBlocks(editable), [
    { type: "paragraph", text: "第一段" },
    { type: "image", imageUrl: "https://s.example/a.png", caption: "说明" },
    { type: "image", imageUrl: "https://s.example/b.png" }
  ]);
  const long = "あ".repeat(130);
  assert.equal(isDerivedSummary("第一段", stored), true);
  assert.equal(isDerivedSummary(`${"あ".repeat(119)}…`, [{ type: "paragraph", text: long }]), true);
  assert.equal(isDerivedSummary("hand written", stored), false);
  assert.equal(isDerivedSummary("x", [{ type: "image", imageUrl: "https://s.example/a.png" }]), false);
  assert.equal(isDerivedSummary("a b", [{ type: "paragraph", text: " a \n b " }]), true, "whitespace collapsed like clipText");
  assert.deepEqual(splitTags("段位, 全良，#配速  x"), ["段位", "全良", "配速", "x"]);
  assert.equal(tagsInputOf(["a", "b"]), "a b");
  assert.deepEqual(splitTags(tagsInputOf(["a", "b"])), ["a", "b"]);
});

test("drafts: per account (and thread), text and uploaded URLs only, never image bytes; SSR has no storage", () => {
  assert.equal(replyDraftKey(3, "12"), `${DRAFT_PREFIX}:reply:3:12`);
  assert.equal(replyDraftKey(null, 12), null);
  assert.equal(replyDraftKey(3, "abc"), null);
  assert.equal(threadDraftKey(3), `${DRAFT_PREFIX}:thread:3`);
  assert.equal(threadDraftKey(undefined), null);
  assert.equal(browserDraftStorage(), null, "no window here, as during server rendering");
  assert.equal(cleanReplyDraft({ body: "  " }), null, "an empty draft is not kept");
  assert.deepEqual(
    cleanReplyDraft({ body: "x".repeat(1200), images: ["https://s.example/a.png", "data:image/png;base64,AAAA", "blob:https://x/1", 7, "https://s.example/b.png", "https://s.example/c.png", "https://s.example/d.png", "https://s.example/e.png"], targetId: 4, targetLabel: "L" }),
    { body: "x".repeat(1000), images: ["https://s.example/a.png", "https://s.example/b.png", "https://s.example/c.png", "https://s.example/d.png"], targetId: 4, targetLabel: "L" }
  );
  assert.deepEqual(cleanReplyDraft({ body: "a", targetId: -1, targetLabel: "L" }), { body: "a", images: [], targetId: null, targetLabel: "" });
  const thread = cleanThreadDraft({ sectionSlug: "../x", threadType: "official", title: "t", paragraphs: ["a", "", 3], images: [{ imageUrl: "data:image/png;base64,AA" }, { imageUrl: "https://s.example/a.png", caption: "c" }] });
  assert.deepEqual(thread, { sectionSlug: "", threadType: "official", title: "t", summary: "", tagsInput: "", paragraphDraft: "", paragraphs: ["a"], images: [{ imageUrl: "https://s.example/a.png", caption: "c" }] });
  assert.equal(cleanThreadDraft({ sectionSlug: "general", threadType: "discussion" }), null, "only choices, no content: nothing to keep");
  const storage = memoryStorage();
  const key = replyDraftKey(1, 2);
  writeDraft(storage, key, { body: "hello", images: [] }, cleanReplyDraft);
  assert.deepEqual(readDraft(storage, key, cleanReplyDraft), { body: "hello", images: [], targetId: null, targetLabel: "" });
  assert.equal(readDraft(storage, replyDraftKey(2, 2), cleanReplyDraft), null, "another account sees nothing");
  writeDraft(storage, key, { body: "" }, cleanReplyDraft);
  assert.equal(storage.map.has(key), false, "emptied draft removes the key");
  storage.setItem(key, "{not json");
  assert.equal(readDraft(storage, key, cleanReplyDraft), null);
  removeDraft(storage, key);
  assert.equal(storage.map.size, 0);
  const throwing = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("quota"); }, removeItem() { throw new Error("blocked"); } };
  assert.equal(readDraft(throwing, key, cleanReplyDraft), null);
  assert.doesNotThrow(() => writeDraft(throwing, key, { body: "x" }, cleanReplyDraft));
  assert.doesNotThrow(() => removeDraft(throwing, key));
});

test("author write rules: owner only, published, unlocked; moderators gain nothing; deleted is gone for everyone", () => {
  const thread = (extra = {}) => ({ authorUserId: 7, status: "published", isLocked: false, ...extra });
  assert.deepEqual(decideAuthorWrite(thread(), 7, "thread"), { ok: true });
  assert.equal(decideAuthorWrite(null, 7, "thread").statusCode, 404);
  assert.equal(decideAuthorWrite(thread({ status: "hidden" }), 7, "thread").statusCode, 404);
  assert.equal(decideAuthorWrite(thread({ status: FORUM_DELETED_STATUS }), 7, "thread").statusCode, 404);
  assert.equal(decideAuthorWrite(thread(), 8, "thread").statusCode, 403, "another member (including a moderator) is refused");
  assert.equal(decideAuthorWrite(thread(), 0, "thread").statusCode, 403);
  assert.equal(decideAuthorWrite(thread({ isLocked: true }), 7, "thread").statusCode, 400, "locked: like replies, 400");
  const post = (extra = {}) => ({ authorUserId: 7, status: "published", threadStatus: "published", isLocked: false, ...extra });
  assert.deepEqual(decideAuthorWrite(post(), 7, "post"), { ok: true });
  assert.equal(decideAuthorWrite(post({ threadStatus: "hidden" }), 7, "post").statusCode, 404);
  assert.equal(decideAuthorWrite(post({ status: "deleted" }), 7, "post").statusCode, 404);
  assert.equal(decideAuthorWrite(post(), 9, "post").statusCode, 403);
  assert.equal(decideAuthorWrite(post({ isLocked: true }), 7, "post").statusCode, 400);
  assert.deepEqual(decideFloorDelete(true, 0), { ok: true });
  assert.deepEqual(decideFloorDelete(false, 3), { ok: true }, "a reply inside a floor can always go");
  assert.equal(decideFloorDelete(true, 1).statusCode, 400, "a floor others reply under stays");
  assert.equal(threadVisibleTo("published", null), true);
  assert.equal(threadVisibleTo("hidden", "user"), false);
  assert.equal(threadVisibleTo("hidden", "moderator"), true, "moderators keep seeing hidden threads");
  assert.equal(threadVisibleTo("deleted", "admin"), false);
});

test("new endpoints follow the existing write paths (auth, sanitising, conditional UPDATE, response shapes); no schema change", async () => {
  const files = {
    "server/api/forum/threads/[id]/edit.post.ts": /updateForumThreadByAuthor\(event, event\.context\.params\?\.id, await readBody\(event\)\)/,
    "server/api/forum/threads/[id]/delete.post.ts": /deleteForumThreadByAuthor\(event, event\.context\.params\?\.id\)/,
    "server/api/forum/posts/[id]/edit.post.ts": /updateForumPostByAuthor\(event, event\.context\.params\?\.id, await readBody\(event\)\)/,
    "server/api/forum/posts/[id]/delete.post.ts": /deleteForumPostByAuthor\(event, event\.context\.params\?\.id\)/
  };
  for (const [file, pattern] of Object.entries(files)) assert.match(await read(file), pattern, file);
  const threads = await read("server/utils/forum/threads.ts");
  const own = threads.slice(threads.indexOf("// ---- Author edit / delete"));
  assert.ok(own.length > 1000);
  assert.equal((own.match(/await requireAccountUser\(event\)/g) || []).length, 2, "both loaders authenticate like the create paths");
  assert.match(own, /decideAuthorWrite\(/);
  assert.match(own, /normalizeContentBlocks\(payload\.contentBlocks\)/, "thread body sanitised as on create");
  assert.match(own, /normalizeReplyContentBlocks\(payload\)/, "reply body sanitised as on reply");
  assert.match(own, /normalizeTags\(payload\.tags\)/);
  const updates = own.match(/UPDATE forum_(threads|posts)[\s\S]*?`/g);
  for (const sql of updates.filter((s) => !s.includes("reply_count"))) {
    assert.match(sql, /author_user_id = \?/, sql);
    assert.match(sql, /status = 'published'/, sql);
    assert.match(sql, /is_locked = 0/, sql);
  }
  assert.match(own, /return await getForumThreadDetail\(event, threadId\);/, "thread edit answers with the detail, like create");
  assert.match(own, /return \{ ok: true \};/, "thread delete answers like moderation/action");
  assert.doesNotMatch(own, /DELETE FROM/, "deletion is a soft status");
  assert.match(threads, /if \(!threadVisibleTo\(row\.status, viewerProfile\?\.role\)\)/);
  assert.match(threads, /if \(!thread \|\| thread\.status === FORUM_DELETED_STATUS\)/, "moderation cannot bring back an author-deleted thread");
  const schema = await read("server/utils/forum-schema-definition.ts");
  assert.match(schema, /status VARCHAR\(16\) NOT NULL DEFAULT 'published'/, "the existing status column carries 'deleted'");
  assert.doesNotMatch(schema, /deleted_at|edited_at|is_deleted/);
});

test("notifications: mark one read without opening it, under the shared lock; filter by type over the loaded page", async () => {
  const items = [notification(1, { type: "reply" }), notification(2, { type: "like" }), notification(3, { type: "reply", isRead: true })];
  const writes = [];
  const model = await handlers("pages/forum/notifications.vue", (path, input = {}) => {
    if (path === "/api/forum/notifications") return Promise.resolve({ total: 3, unreadCount: 2, page: 1, pageSize: 20, items: structuredClone(items) });
    assert.equal(path, "/api/forum/notifications/read");
    const d = deferred();
    writes.push({ input, ...d });
    return d.promise;
  }, ["data", "markRead", "openNotification", "mutationBusy", "typeFilter", "visibleItems", "typeFilters"]);
  assert.deepEqual(model.typeFilters.value.map((f) => f.key), ["all", "reply", "mention", "like", "system"]);
  model.typeFilter.value = "reply";
  assert.deepEqual(model.visibleItems.value.map((i) => i.id), [1, 3]);
  model.typeFilter.value = "all";
  const item = model.data.value.items.find((i) => i.id === 1);
  const task = model.markRead(item);
  assert.equal(item.isRead, false, "not claimed before the response");
  await model.markRead(model.data.value.items.find((i) => i.id === 2));
  assert.equal(writes.length, 1, "the shared lock admits one write at a time");
  assert.deepEqual(writes[0].input.body, { ids: [1] });
  writes[0].resolve({ unreadCount: 1 });
  await task;
  await settle();
  assert.equal(item.isRead, true);
  assert.equal(model.data.value.unreadCount, 1);
  assert.equal(model.mutationBusy.value, false);
  assert.equal(model.navigations.length, 0, "marking does not navigate");
  await model.markRead(item);
  assert.equal(writes.length, 1, "an already read item sends nothing");
  const failing = model.markRead(model.data.value.items.find((i) => i.id === 2));
  writes[1].reject(new Error("503"));
  await failing;
  assert.equal(model.data.value.items.find((i) => i.id === 2).isRead, false, "a failed mark keeps the item unread");
  assert.equal(model.mutationBusy.value, false);
});

test("composer draft: restored only after mount, saved while editing, kept per account, removed when the thread is accepted", async () => {
  const storage = memoryStorage();
  storage.setItem(threadDraftKey(1), JSON.stringify({ title: "Saved title", paragraphDraft: "Saved body", images: [{ imageUrl: "https://s.example/a.png", caption: "" }] }));
  const calls = [];
  const api = (path, input = {}) => {
    if (path === "/api/forum/sections") return Promise.resolve({ items: [] });
    const d = deferred();
    calls.push({ path, input, ...d });
    return d.promise;
  };
  const h = await handlers("pages/forum/new.vue", api, ["form", "paragraphBlocks", "imageBlocks", "draftRestored", "discardDraft", "submit", "publishedThreadId"], { storage });
  assert.equal(h.form.title, "", "nothing is read from storage before mount (server render and hydration match)");
  h.mount();
  assert.equal(h.form.title, "Saved title");
  assert.equal(h.form.paragraphDraft, "Saved body");
  assert.deepEqual(h.imageBlocks.value, [{ imageUrl: "https://s.example/a.png", caption: "" }]);
  assert.equal(h.draftRestored.value, true);
  h.form.title = "Edited title";
  assert.equal(JSON.parse(storage.getItem(threadDraftKey(1))).title, "Edited title");
  h.changeUser(2);
  await settle();
  assert.equal(h.form.title, "", "another account starts empty");
  assert.equal(JSON.parse(storage.getItem(threadDraftKey(1))).title, "Edited title", "the first account's draft stays");
  h.form.title = "Second account";
  assert.equal(JSON.parse(storage.getItem(threadDraftKey(2))).title, "Second account");
  h.form.paragraphDraft = "Body";
  const submitted = h.submit();
  assert.equal(calls.at(-1).path, "/api/forum/threads");
  calls.at(-1).resolve({ id: 55 });
  await submitted;
  await settle();
  assert.equal(storage.getItem(threadDraftKey(2)), null, "accepted: the draft is gone");
  assert.equal(h.publishedThreadId.value, 55);
  h.changeUser(1);
  await settle();
  assert.equal(h.form.title, "Edited title");
  h.discardDraft();
  assert.equal(storage.getItem(threadDraftKey(1)), null);
  assert.equal(h.form.title, "");
});

test("thread page: favourite, copy link, 只看楼主, jump, own edit / delete and the reply draft are wired to the existing endpoints", async () => {
  const page = await read("pages/forum/thread/[id].vue");
  assert.match(page, /`\/api\/forum\/threads\/\$\{requestedThread\}\/favorite`, \{\s*method: "POST",\s*body: \{ enabled: wanted \}/);
  assert.match(page, /`\/api\/forum\/posts\/\$\{postId\}\/edit`, \{\s*method: "POST",/);
  assert.match(page, /`\/api\/forum\/posts\/\$\{postId\}\/delete`, \{ method: "POST" \}/);
  assert.match(page, /`\/api\/forum\/threads\/\$\{requestedThread\}\/delete`, \{ method: "POST" \}/);
  assert.equal((page.match(/await confirmDelete\(/g) || []).length, 2, "both deletions are confirmed (ElMessageBox.confirm)");
  assert.match(page, /ElMessageBox\.confirm\(message, title, \{ type: "warning"/);
  assert.match(page, /navigator\.clipboard\.writeText\(link\)/);
  assert.match(page, /onlyAuthorFloors\(detail\.value\.posts, detail\.value\.author\.id\)/);
  assert.match(page, /router\.replace\(\{ query: route\.query, hash \}\)/, "jump uses the existing #reply-<id> deep link");
  assert.match(page, /onMounted\(\(\) => \{\s*threadPageMounted\.value = true;\s*restoreReplyDraft\(\);/, "the reply draft is read after mount");
  assert.match(page, /removeDraft\(browserDraftStorage\(\), draftKey\);/);
  const actions = await read("components/rework/community/ThreadActions.vue");
  assert.match(actions, /:aria-pressed="favorited"/);
  const floorSource = await read("components/rework/community/Floor.vue");
  assert.match(floorSource, /v-if="mine\(floor\.author\.id\)"/);
  assert.match(floorSource, /v-if="mine\(reply\.author\.id\)"/);
  const me = await read("pages/forum/me.vue");
  assert.match(me, /'\/api\/forum\/me\/summary'/);
  assert.match(me, /'\/api\/forum\/relationships', \{ query: \{ scope: tabRequest\.value\.scope/);
  assert.match(me, /"\/api\/forum\/history\/clear", \{ method: "POST" \}/);
  assert.match(me, /"\/api\/forum\/preferences", \{ method: "POST", body: \{ recordHistoryEnabled: enabled \} \}/);
  assert.match(me, /ElMessageBox\.confirm\(t\("rework\.forum\.mine\.clearHistoryConfirm"\)/);
  const user = await read("pages/forum/user/[id].vue");
  assert.match(user, /apiFetch\(`\/api\/forum\/users\/\$\{route\.params\.id\}`, \{ retry: 0 \}\)/);
  assert.match(user, /`\/api\/forum\/users\/\$\{requested\}\/\$\{kind\}`, \{\s*method: "POST",\s*body: \{ enabled \}/);
  assert.match(user, /ElMessageBox\.confirm\(t\("rework\.forum\.user\.blockConfirm"\)/);
  const edit = await read("pages/forum/edit/[id].vue");
  assert.match(edit, /`\/api\/forum\/threads\/\$\{requested\}\/edit`, \{\s*method: "POST",\s*retry: 0,\s*body: \{ title: form\.title, summary: form\.summary, tags: splitTags\(form\.tagsInput\), contentBlocks, locale: locale\.value \}/);
  assert.match(edit, /middleware: "account-auth"/);
});
