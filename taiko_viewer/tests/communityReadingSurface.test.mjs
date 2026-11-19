import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");
// Slice D (stage 3): the forum pages' presentation moved to components/rework/community/* and their inline zh / ja
// copy to locales (rework.forum.*); assertions below follow the moved code with the same intent.
const locale = (lang) => JSON.parse(read(`locales/${lang}.json`));
const get = (obj, key) => key.split(".").reduce((o, k) => o?.[k], obj);

test("community home keeps the mobile surface content-first", () => {
  const source = read("pages/forum/index.vue");
  assert.match(source, /hidePageHeader: true/);
  assert.match(source, /<ReworkPageHeader class="community-header" :title="t\('rework\.community'\)">/);
  assert.doesNotMatch(source, /community-rail|activeTitle|activeEyebrow|community-subtitle|community-kicker/);
  assert.match(source, /class="community-feed"/);
  assert.ok(source.indexOf('class="community-feed"') < source.indexOf('class="community-chart-activity"'));
});

test("forum breadcrumb is hidden only on mobile", () => {
  const source = read("layouts/default.vue");
  assert.match(source, /forum-breadcrumb/);
  assert.match(source, /@media \(max-width: 700px\)[\s\S]*\.breadcrumb-bar\.forum-breadcrumb \{ display: none; \}/);
});

test("thread detail uses an article flow with an explicit reply boundary", () => {
  const source = read("pages/forum/thread/[id].vue");
  const head = read("components/rework/community/ThreadHead.vue");
  const replies = read("components/rework/community/Replies.vue");
  assert.match(source, /<article class="thread-article">/);
  assert.match(head, /<ReworkPageHeader class="th" :title="thread\.title">/, "the title is the page <h1>");
  assert.doesNotMatch(source + head, /\{\{ (detail|thread)\.summary \}\}/);
  assert.match(source, /class="thread-content"[\s\S]*<ReworkCommunityThreadActions[\s\S]*<ReworkCommunityReplies/);
  assert.match(read("components/rework/community/ThreadActions.vue"), /class="ta thread-actions"/);
  assert.match(replies, /class="cr reply-section"/);
  assert.match(replies, /\.cr \{[\s\S]*border-top: 1px solid var\(--line-strong\)/, "one boundary before the replies");
  assert.match(replies, /id="replies-title"/);
  for (const lang of ["zh", "ja"]) assert.doesNotMatch(get(locale(lang), "rework.forum.thread.replyThread"), /回复主题|テーマに返信/);
});

test("thread media does not use a colored attachment panel", () => {
  const source = read("pages/forum/thread/[id].vue");
  const mediaStyles = source.slice(source.indexOf(".thread-image img"), source.indexOf(".thread-image figcaption"));
  assert.match(mediaStyles, /background: transparent/);
  assert.doesNotMatch(mediaStyles, /aspect-ratio/);
});

test("reply surface uses one boundary and a bottom composer", () => {
  const actions = read("components/rework/community/ThreadActions.vue");
  const box = read("components/rework/community/ReplyBox.vue");
  const replies = read("components/rework/community/Replies.vue");
  assert.doesNotMatch(actions.slice(actions.indexOf(".ta {"), actions.indexOf(".ta__act {")), /border-bottom/);
  assert.match(box, /v-if="!expanded"[\s\S]*class="crb__open"/);
  // < 768: fixed above the bottom navigation (65 px + safe area); ≥ 768: sticky at the bottom of the reply section
  assert.match(box, /@media \(max-width: 767px\) \{\s*\.crb \{\s*position: fixed;[\s\S]*?bottom: calc\(65px \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(box, /\.crb \{\s*position: sticky;\s*bottom: 0;/);
  assert.match(box, /html\[data-kb\] \.crb \{\s*bottom: var\(--kb-h, 0px\);/, "soft keyboard: docked on the keyboard");
  assert.doesNotMatch(replies, /\.cr__list\s*\{[^}]*overflow-y/);
});

test("reply actions focus the shared composer and preserve target context", () => {
  const source = read("pages/forum/thread/[id].vue");
  assert.match(source, /const setReplyTarget[\s\S]*replyExpanded\.value = true[\s\S]*replyInput\.value\?\.focus/);
  assert.match(source, /setReplyTarget\(null\)/);
  assert.match(source, /@reply="setReplyTarget"/);
  const floor = read("components/rework/community/Floor.vue");
  assert.match(floor, /emit\('reply', floor\.id/);
  assert.match(floor, /emit\('reply', reply\.id/);
  assert.match(source, /replyTarget\.label/);
});

test("thread mutations update local state without route-level refresh", () => {
  const source = read("pages/forum/thread/[id].vue");
  const threadLike = source.slice(source.indexOf("const toggleThreadLike"), source.indexOf("const togglePostLike"));
  const postLike = source.slice(source.indexOf("const togglePostLike"), source.indexOf("const renderReplyBlocks"));
  assert.match(threadLike, /apiFetch<ForumLikeMutationResult>/);
  assert.match(threadLike, /detail\.value\.viewerHasLiked = result\.liked/);
  assert.match(threadLike, /detail\.value\.likeCount = result\.likeCount/);
  assert.match(threadLike, /restoreScrollPosition\(scrollY\)/);
  assert.match(threadLike, /trigger\?\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(threadLike, /await refresh\(\)/);
  assert.match(postLike, /currentPost\.viewerHasLiked = result\.liked/);
  assert.match(postLike, /currentPost\.likeCount = result\.likeCount/);
  assert.match(postLike, /restoreScrollPosition\(scrollY\)/);
  assert.match(postLike, /trigger\?\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(postLike, /await refresh\(\)/);
  assert.match(source, /data\.value = result/);
  assert.match(source, /restoreScrollPosition\(scrollY\)/);
});

test("thread actions expose lightweight icon, pressed, and focus states", () => {
  const source = read("pages/forum/thread/[id].vue");
  const actions = read("components/rework/community/ThreadActions.vue");
  const floor = read("components/rework/community/Floor.vue");
  assert.match(actions, /<ReworkIcon :name="liked \? 'heartFilled' : 'heart'" \/>/);
  assert.match(floor, /<ReworkIcon :name="floor\.viewerHasLiked \? 'heartFilled' : 'heart'" \/>/);
  assert.match(source, /:liked="detail\.viewerHasLiked"/);
  assert.match(actions, /:aria-pressed="liked"/);
  assert.match(floor, /:aria-pressed="floor\.viewerHasLiked"/);
  assert.match(floor, /:aria-pressed="reply\.viewerHasLiked"/);
  assert.match(actions, /\.ta__act:focus-visible/);
  assert.match(floor, /\.cf__act:active/);
  assert.match(actions + floor, /min-height: var\(--hit\)/);
});

test("community dark mode remaps semantic text and composer surface tokens", () => {
  const thread = read("pages/forum/thread/[id].vue");
  assert.match(thread, /body\.theme-dark \.forum-thread-page \{[\s\S]*--viewer-text: #f2e7dc/);
  assert.match(thread, /body\.theme-dark \.forum-thread-page \{[\s\S]*--viewer-text-muted: #cab8aa/);
  assert.match(thread, /body\.theme-dark \.forum-thread-page \{[\s\S]*--viewer-surface: rgba\(27, 24, 22, 0\.92\)/);
  assert.match(thread, /body\.theme-dark \.reply-box \{[\s\S]*var\(--viewer-surface\)/);
  assert.match(thread, /body\.theme-dark \.reply-box :deep\(\.el-textarea__inner\) \{[\s\S]*var\(--viewer-text\)/);
});

test("notifications mark one item read locally before deep-link navigation", () => {
  const source = read("pages/forum/notifications.vue");
  const openNotification = source.slice(source.indexOf("const openNotification"), source.indexOf("const formatNotificationTime"));
  assert.match(openNotification, /item\.isRead = true/);
  assert.match(openNotification, /body: \{ ids: \[item\.id\] \}/);
  assert.match(openNotification, /syncUnreadCount\(result\.unreadCount\)/);
  assert.match(source, /hash: item\.postId \? `#reply-\$\{item\.postId\}` : undefined/);
  assert.doesNotMatch(openNotification, /refresh\(/);
});

test("reply deep links use stable ids after DOM render and highlight the target", () => {
  const source = read("pages/forum/thread/[id].vue");
  const floor = read("components/rework/community/Floor.vue");
  assert.match(floor, /:id="`reply-\$\{floor\.id\}`"/);
  assert.match(floor, /:id="`reply-\$\{reply\.id\}`"/);
  assert.match(source, /windowOfPost\(replyWindowList\.value, replyId\)/, "a deep link first shows the reply window holding the post");
  assert.match(source, /threadPageMounted\.value[\s\S]*await nextTick\(\)[\s\S]*await waitForRouteScroll\(\)[\s\S]*requestAnimationFrame\(locate\)/);
  assert.match(source, /requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => resolve\(\)\)\)/);
  assert.match(source, /target\.scrollIntoView\(\{ block: "center", behavior: "auto" \}\)/);
  assert.match(source, /target\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /setTimeout\([\s\S]*1800/);
  assert.match(source, /ElMessage\.info\(copy\.value\.replyUnavailable\)/);
  assert.equal(get(locale("zh"), "rework.forum.thread.replyUnavailable"), "这条回复已不可用");
  assert.equal(get(locale("ja"), "rework.forum.thread.replyUnavailable"), "この返信は利用できません");
});

test("thread images open an accessible lightweight viewer without losing scroll", () => {
  const thread = read("pages/forum/thread/[id].vue");
  const viewer = read("components/forum/ForumMediaViewer.vue");
  assert.match(read("components/rework/community/Blocks.vue"), /class="cb__trigger"/);
  assert.match(thread, /@open="openImageViewer"/);
  assert.match(thread, /<ForumMediaViewer/);
  assert.match(viewer, /class="forum-media-viewer"/);
  assert.match(viewer, /role="dialog"/);
  assert.match(viewer, /aria-modal="true"/);
  assert.match(viewer, /event\.key === "Escape"/);
  assert.match(viewer, /preservedScrollY\.value = viewerScrollY\(\)/);
  assert.match(viewer, /scrollViewerTo\(\{ top: preservedScrollY\.value, behavior: "auto" \}\)/);
  assert.match(viewer, /touch-action: pinch-zoom/);
  assert.match(viewer, /items\.length > 1/);
});

test("reply list keeps internal rhythm and a bottom inset above fixed composer", () => {
  const source = read("pages/forum/thread/[id].vue");
  const floor = read("components/rework/community/Floor.vue");
  assert.match(floor, /\.cf__replies \{[\s\S]*border-left: 2px solid var\(--line-strong\)/, "replies inside a floor sit on a left rule");
  assert.match(floor, /\.cf \{[\s\S]*border-bottom: 1px solid var\(--line\)/);
  assert.match(source, /@media \(max-width: 767px\) \{\s*\.forum-thread-page \{\s*padding-bottom: 72px;/, "room for the fixed reply box");
});

test("thread feed items navigate as accessible full-row targets", () => {
  const source = read("components/rework/community/ThreadRow.vue");
  assert.match(source, /role="link"/);
  assert.match(source, /tabindex="0"/);
  assert.match(source, /@click="handleCardClick"/);
  assert.match(source, /@keydown="handleCardKeydown"/);
  assert.match(source, /target\.closest\("a, button, input/);
  assert.match(source, /:focus-visible/);
  assert.match(source, /:active/);
  assert.match(source, /cursor: pointer/);
});

test("forum image uploads share the 20MB boundary", () => {
  const shared = read("utils/forum.ts");
  const server = read("server/internal/forum/shared.ts");
  const media = read("server/utils/forum/media.ts");
  const newThread = read("pages/forum/new.vue");
  const thread = read("pages/forum/thread/[id].vue");
  assert.match(shared, /FORUM_IMAGE_MAX_MB = 20/);
  assert.match(shared, /FORUM_IMAGE_MAX_BYTES = FORUM_IMAGE_MAX_MB \* 1024 \* 1024/);
  assert.match(server, /IMAGE_MAX_BYTES = FORUM_IMAGE_MAX_BYTES/);
  assert.match(media, /论坛图片过大，请控制在 20MB 以内/);
  assert.match(newThread, /before-upload="validateImageFile"/);
  assert.match(newThread, /file\.size > FORUM_IMAGE_MAX_BYTES/);
  assert.equal(get(locale("zh"), "rework.forum.compose.uploadTooLarge"), "单张图片不能超过 20MB");
  assert.match(thread, /FORUM_IMAGE_MAX_BYTES/);
  assert.equal(get(locale("ja"), "rework.forum.thread.uploadTooLarge"), "1枚の画像は20MB以内で選択してください");
});

test("forum visible copy does not contain removed prompt headings", () => {
  for (const locale of ["zh", "ja"]) {
    const messages = JSON.parse(read(`locales/${locale}.json`));
    const indexCopy = messages.page?.forum?.index;
    assert.equal(indexCopy?.kicker, undefined);
    assert.equal(indexCopy?.subtitle, undefined);
    assert.equal(indexCopy?.activeEyebrow, undefined);
    assert.equal(indexCopy?.activeTitle, undefined);
    assert.equal(indexCopy?.feedEyebrow, undefined);
  }
});
