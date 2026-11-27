// Stage 3 slice D: the community pages (helpers, contracts the pages rely on, source rules, the P0 compiled rule).
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { parse, compileStyle } from "@vue/compiler-sfc";
import {
  COMMUNITY_TABS,
  HOME_FILTERS,
  homeFilter,
  REPLY_WINDOW,
  replyWindows,
  windowOfPost,
  replyHashId,
  replyTargetName,
  roleTag,
  threadSongTitle,
  threadSongLocation,
  threadStates,
  activityTitle,
  forumTimeText,
  NOTIFICATION_ICONS
} from "../utils/rework/community.ts";
import { catalogRequestFor } from "../utils/rework/catalog.ts";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
/** Source without comments (rules about code, not about the notes that explain them). */
const code = async (path) => (await read(path)).replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
const locale = async (lang) => JSON.parse(await read(`locales/${lang}.json`));
const get = (obj, key) => key.split(".").reduce((o, k) => o?.[k], obj);
const COMMUNITY = "components/rework/community";
const PAGES = ["pages/forum/index.vue", "pages/forum/discussions.vue", "pages/forum/section/[slug].vue", "pages/forum/thread/[id].vue", "pages/forum/new.vue", "pages/forum/me.vue", "pages/forum/notifications.vue"];

const floor = (id, floorNo, replies = 0, author = 1) => ({
  id,
  floorNo,
  bodyText: "",
  contentBlocks: [],
  likeCount: 0,
  createdAt: "2026-11-18T00:00:00.000Z",
  author: { id: author, username: `u${author}` },
  viewerHasLiked: false,
  isBlockedAuthor: false,
  replies: Array.from({ length: replies }, (_, i) => ({ id: id * 1000 + i + 1, parentPostId: id, rootPostId: id, bodyText: "", contentBlocks: [], likeCount: 0, createdAt: "", author: { id: 9, username: "r" }, viewerHasLiked: false, isBlockedAuthor: false }))
});

test("community tabs: three existing addresses; each label is that page's <h1>", async () => {
  assert.deepEqual(COMMUNITY_TABS.map((t) => t.to), ["/forum", "/forum/me", "/forum/notifications"]);
  const shell = await read("components/rework/Shell.vue");
  assert.match(shell, /community: COMMUNITY_TABS\.map\(\(tab\) => \(\{ \.\.\.tab, labelKey: `rework\.\$\{tab\.key\}` \}\)\)/);
  const [index, me, notifications] = await Promise.all(["pages/forum/index.vue", "pages/forum/me.vue", "pages/forum/notifications.vue"].map(read));
  assert.match(index, /:title="t\('rework\.community'\)"/);
  assert.match(me, /:title="t\('rework\.myPosts'\)"/);
  assert.match(notifications, /:title="t\('rework\.notifications'\)"/);
  for (const lang of ["zh", "ja"]) {
    const m = await locale(lang);
    assert.equal(get(m, "rework.myPosts"), get(m, "forum.myCommunity"), `${lang}: the tab is named like the page (我的社区)`);
  }
});

test("the shell's bell shows the unread count from the existing poll and the confirmed counts", async () => {
  const shell = await read("components/rework/Shell.vue");
  assert.match(shell, /const \{ unreadCount \} = useForumNotificationPolling\(\);/);
  assert.match(shell, /class="bell-dot num"/);
  const index = await read("pages/forum/index.vue");
  assert.match(index, /setUnreadCount\(count\)/, "the home payload's count reaches the bell");
});

test("home filters: latest is the default and not written", () => {
  assert.deepEqual([...HOME_FILTERS], ["latest", "hot", "guide", "featured"]);
  assert.equal(homeFilter(undefined), "latest");
  assert.equal(homeFilter("hot"), "hot");
  assert.equal(homeFilter("bogus"), "latest");
});

test("reply windows keep the server order and mount at most REPLY_WINDOW items", () => {
  assert.ok(REPLY_WINDOW <= 60, "V1.3 budget");
  assert.deepEqual(replyWindows([]), []);
  const small = [floor(1, 1, 2), floor(2, 2)];
  const one = replyWindows(small);
  assert.equal(one.length, 1);
  assert.equal(one[0].size, 4);
  const posts = [floor(1, 1, 30), floor(2, 2), floor(3, 3, 70), floor(4, 4, 2)];
  const windows = replyWindows(posts, 60);
  const flat = windows.flatMap((w) => w.floors.flatMap((f) => [...(f.head ? [f.floor.id] : []), ...f.replies.map((r) => r.id)]));
  const expected = posts.flatMap((p) => [p.id, ...p.replies.map((r) => r.id)]);
  assert.deepEqual(flat, expected, "order unchanged, nothing lost or repeated");
  for (const w of windows) assert.ok(w.size <= 60 && w.size > 0);
  const continued = windows.flatMap((w) => w.floors).filter((f) => !f.head);
  assert.ok(continued.length >= 1 && continued.every((f) => f.floor.id === 3), "the 70-reply floor continues in the next window");
  assert.equal(windowOfPost(windows, 3), windows.findIndex((w) => w.floors.some((f) => f.head && f.floor.id === 3)));
  assert.equal(windowOfPost(windows, 3070), windows.length - 1 - (windows.at(-1).floors.some((f) => f.floor.id === 3) ? 0 : 1));
  assert.equal(windowOfPost(windows, 999999), -1);
  assert.equal(windows[0].firstFloor, 1);
  assert.equal(windows.at(-1).lastFloor, 4);
  assert.equal(replyHashId("#reply-42"), 42);
  assert.equal(replyHashId("#floor-1"), null);
});

test("identity, states, chart links and times", () => {
  const f = floor(10, 1, 3, 7);
  f.replies[1].parentPostId = f.replies[0].id;
  assert.equal(replyTargetName(f.replies[0], f), "u7");
  assert.equal(replyTargetName(f.replies[1], f), "r");
  assert.equal(replyTargetName({ ...f.replies[0], parentPostId: null }, f), "");
  assert.equal(roleTag({ role: "user" }), null);
  assert.equal(roleTag({ role: "moderator" }), "moderator");
  assert.equal(roleTag({ role: "admin" }), "admin");
  assert.deepEqual(threadStates({ isPinned: true, isFeatured: false, isLocked: true, status: "hidden" }), ["pinned", "locked", "hidden"]);
  const song = { id: 12, title: "曲", titleJp: "曲JP", coverUrl: "", category: "", difficultyType: 4, difficultyLabel: "魔王", level: 9 };
  assert.deepEqual(threadSongTitle(song, "ja"), { text: "曲JP", lang: undefined });
  assert.deepEqual(threadSongTitle({ ...song, titleJp: "" }, "ja"), { text: "曲", lang: "zh-CN" });
  assert.deepEqual(threadSongTitle(song, "zh"), { text: "曲", lang: undefined });
  assert.deepEqual(threadSongLocation(song, true), { path: "/songs/12", query: { difficulty: "4" }, hash: "#chart-ugc" }, "as before: the song page at that difficulty and its notes");
  assert.deepEqual(threadSongLocation({ ...song, difficultyType: null }, true), { path: "/songs/12", query: {}, hash: undefined });
  assert.deepEqual(activityTitle({ songTitle: "a", songTitleJp: "" }, "ja"), { text: "a", lang: "zh-CN" });
  assert.equal(forumTimeText("2026-11-17T16:30:00.000Z", "datetime", "zh", "Asia/Shanghai"), "2026/11/18 00:30");
  assert.equal(forumTimeText("2026-11-17T16:30:00.000Z", "date", "ja", "Asia/Shanghai"), "2026/11/18");
  assert.equal(forumTimeText("", "date", "zh"), "—");
  assert.equal(forumTimeText("not a date", "date", "zh"), "—");
  assert.deepEqual(Object.keys(NOTIFICATION_ICONS).sort(), ["like", "mention", "reply", "system"]);
});

test("P0: the reply box's keyboard rule compiles to a selector that keeps the reply box", async () => {
  const source = await read(`${COMMUNITY}/ReplyBox.vue`);
  const { descriptor } = parse(source, { filename: "ReplyBox.vue" });
  const style = descriptor.styles.find((s) => s.scoped);
  const compiled = compileStyle({ source: style.content, filename: "ReplyBox.vue", id: "data-v-p0check", scoped: true });
  assert.deepEqual(compiled.errors, []);
  assert.match(compiled.code, /html\[data-kb\] \.crb\[data-v-p0check\]\s*\{\s*bottom: var\(--kb-h, 0px\);/, "html[data-kb] .crb[data-v-…] keeps the .crb part");
  assert.doesNotMatch(compiled.code, /(^|\n)\s*html\[data-kb\]\s*\{/, "no rule collapsed to the root alone");
  assert.doesNotMatch(await code(`${COMMUNITY}/ReplyBox.vue`), /:global\(/);
  const layout = await read("layouts/default.vue");
  assert.match(layout, /root\.setAttribute\('data-kb', ''\)/);
  assert.match(layout, /root\.style\.setProperty\('--kb-h', `\$\{inset\}px`\)/);
  assert.match(layout, /window\.innerHeight - \(viewport\.height \+ viewport\.offsetTop\)/);
  assert.match(layout, /addEventListener\('scroll',syncKeyboard\)/);
});

test("no :global(...) prefix rule in the community components (must-be-clean directory)", async () => {
  const files = (await readdir(new URL(`../${COMMUNITY}`, import.meta.url))).filter((f) => f.endsWith(".vue"));
  assert.ok(files.length >= 20);
  for (const file of files) assert.doesNotMatch(await code(`${COMMUNITY}/${file}`), /:global\(/, file);
  const strict = await read("scripts/ds/check-scoped-css.mjs");
  assert.match(strict, /STRICT_DIRS = \[[^\]]*"components\/rework"/, "components/rework is a must-be-clean directory");
});

test("P2 / identity: avatars are DsPlayerAvatar; no dan; titles through DsTitlePlate / DsSiteTitle", async () => {
  const files = (await readdir(new URL(`../${COMMUNITY}`, import.meta.url))).filter((f) => f.endsWith(".vue"));
  const all = (await Promise.all(files.map((f) => code(`${COMMUNITY}/${f}`)))).join("\n") + (await Promise.all(PAGES.map(code))).join("\n");
  assert.doesNotMatch(all, /DanBadge|\bdan\b|\.dan\b/i);
  assert.doesNotMatch(all, /miku\.png/);
  assert.doesNotMatch(all, /<Forum(UserBadge|ThreadCard|ReadState)\s+[:@v]/, "the old badge, card and read-state components are gone");
  const author = await read(`${COMMUNITY}/Author.vue`);
  assert.match(author, /<DsPlayerAvatar :src="user\.avatarUrl"/);
  assert.match(author, /<DsTitlePlate v-if="user\.verifiedTitle" :name="user\.verifiedTitle" :plate="user\.verifiedTitleplateId"/);
  assert.match(author, /<DsSiteTitle v-for="title in user\.titles \|\| \[\]"/);
  assert.match(await read(`${COMMUNITY}/NotificationItem.vue`), /<DsPlayerAvatar v-if="item\.actor" :src="item\.actor\.avatarUrl"/);
  assert.match(await read(`${COMMUNITY}/MeHead.vue`), /<ReworkCommunityAuthor v-if="user" :user="user" :size="72"/);
});

test("every community page uses the rework frame and the Element Plus mapping", async () => {
  for (const path of PAGES) {
    const source = await read(path);
    assert.doesNotMatch(source, /reworkElementPlus/, path + " (slice G: the mapping is the shell default)");
    if (!path.endsWith("new.vue")) assert.match(source, /hidePageHeader: true/, path);
  }
  assert.match(await read("pages/forum/new.vue"), /composerHeader: true/);
  for (const path of ["pages/forum/index.vue", "pages/forum/thread/[id].vue", `${COMMUNITY}/ListPage.vue`]) assert.match(await read(path), /useForumHydratedState\(/, path);
});

test("reads and writes are the same requests as before", async () => {
  const thread = await read("pages/forum/thread/[id].vue");
  assert.match(thread, /apiFetch\(`\/api\/forum\/threads\/\$\{route\.params\.id\}`, \{ retry: 0 \}\)/);
  assert.match(thread, /apiFetch<ForumThreadDetail>\(`\/api\/forum\/threads\/\$\{requestedThread\}\/replies`, \{\s*method: "POST",\s*body: \{\s*bodyText: replyBody\.value,\s*contentBlocks,\s*parentPostId: replyTarget\.value\.id \|\| undefined,/);
  assert.match(thread, /`\/api\/forum\/threads\/\$\{requestedThread\}\/like`, \{\s*method: "POST",/);
  assert.match(thread, /`\/api\/forum\/posts\/\$\{postId\}\/like`, \{\s*method: "POST",/);
  assert.match(thread, /"\/api\/forum\/media\/images",\s*\{\s*method: "POST",\s*body: formData,/);
  assert.match(thread, /threadResource\.accept\(result\)/);
  const composer = await read("pages/forum/new.vue");
  assert.match(composer, /apiFetch<\{ id: number \}>\("\/api\/forum\/threads", \{\s*method: "POST",\s*retry: 0,\s*body: \{\s*sectionSlug: form\.sectionSlug,\s*threadType: form\.threadType,\s*title: form\.title,\s*locale: locale\.value,\s*summary: form\.summary,/);
  assert.match(composer, /:http-request="uploadImage" :before-upload="validateImageFile"/);
  // The picker uses the shared catalog contract and asks for the same songs as before (released, catalog order).
  assert.match(composer, /catalogRequestFor\(\{ q: keyword, shelf: "available", sort: "catalog", page: 1 \}, 8\)/);
  assert.deepEqual(catalogRequestFor({ q: "x", shelf: "available", sort: "catalog", page: 1 }, 8), { view: "list", page: 1, pageSize: 8, keyword: "x", sort: "catalog", shelfStatus: 0 });
  const notifications = await read("pages/forum/notifications.vue");
  assert.match(notifications, /body: \{ ids: \[item\.id\] \}, retry: 0/);
  assert.match(notifications, /"\/api\/forum\/notifications\/read", \{\s*method: "POST", body: \{\}, retry: 0/);
  const me = await read("pages/forum/me.vue");
  assert.match(me, /apiFetch\("\/api\/forum\/moderation\/action", \{\s*method: "POST",\s*body: \{\s*threadId,\s*action,\s*enabled\s*\}/);
  // Content rendering is frozen: plain text interpolation (no v-html); line breaks kept in replies, collapsed in the body
  const blocks = await code(`${COMMUNITY}/Blocks.vue`);
  assert.match(blocks, /<p v-if="block\.type === 'paragraph'" class="cb__p">\{\{ block\.text \}\}<\/p>/);
  assert.match(blocks, /\.cb:not\(\.is-body\) \.cb__p \{\s*white-space: pre-wrap;/);
  assert.doesNotMatch(blocks.slice(blocks.indexOf(".cb__p {"), blocks.indexOf(".cb:not(.is-body) .cb__p")), /white-space/);
  for (const file of (await readdir(new URL(`../${COMMUNITY}`, import.meta.url)))) assert.doesNotMatch(await read(`${COMMUNITY}/${file}`), /v-html/, file);
  // Failed images: never another picture. Content → placeholder (not a viewer trigger); list thumbnail → removed.
  assert.match(blocks, /class="cb__failed" role="img" :aria-label="t\('rework\.forum\.imageFailed'\)"/);
  assert.match(blocks, /<ReworkIcon name="image" \/>/);
  assert.match(blocks, /<button\s+v-else\s+type="button"\s+class="cb__trigger"/);
  const media = await code(`${COMMUNITY}/Media.vue`);
  assert.doesNotMatch(media, /miku|fallback/i);
  assert.match(media, /<img\s+v-if="near && src"/, "no <img> without a source");
  const row = await code(`${COMMUNITY}/ThreadRow.vue`);
  assert.match(row, /v-else-if="showMedia"/);
  assert.match(row, /@failed="mediaFailed = true"/);
  for (const file of ["Blocks.vue", "ThreadRow.vue"]) assert.doesNotMatch(await code(`${COMMUNITY}/${file}`), /ForumSafeImage/, file);
  assert.match(thread, /!failedImageUrls\.value\.includes\(block\.imageUrl\)/, "failed images are left out of the viewer");
  const list = await read(`${COMMUNITY}/ListPage.vue`);
  assert.match(list, /apiFetch\('\/api\/forum\/threads', \{ query: requestQuery\.value, retry: 0 \}\)/);
});

test("forum copy lives in locales: rework.forum in both languages, the same keys", async () => {
  const [zh, ja] = await Promise.all([locale("zh"), locale("ja")]);
  const keys = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
  assert.deepEqual(keys(zh.rework.forum).sort(), keys(ja.rework.forum).sort());
  for (const path of ["pages/forum/thread/[id].vue", "pages/forum/new.vue", "pages/forum/me.vue", "pages/forum/notifications.vue"]) {
    assert.doesNotMatch(await read(path), /locale\.value === ["']ja["']\s*\?/, `${path}: no inline zh / ja table`);
  }
  assert.equal(get(zh, "rework.forum.thread.replyToUser").replace("{'@'}", "@"), "回复 @{username}");
});
