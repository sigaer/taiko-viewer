import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("community home keeps the mobile surface content-first", () => {
  const source = read("pages/forum/index.vue");
  assert.match(source, /hidePageHeader: true/);
  assert.match(source, /<h1>\{\{ t\("forum\.title"\) \}\}<\/h1>/);
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
  assert.match(source, /<article class="thread-article">/);
  assert.match(source, /<h1>\{\{ detail\.title \}\}<\/h1>/);
  assert.doesNotMatch(source, /\{\{ detail\.summary \}\}/);
  assert.match(source, /class="thread-content"[\s\S]*class="thread-actions"[\s\S]*class="reply-section"/);
  assert.match(source, /reply-section__divider/);
  assert.match(source, /id="replies-title"/);
  assert.doesNotMatch(source, /replyThread: "回复主题"|replyThread: "テーマに返信"/);
});

test("thread media does not use a colored attachment panel", () => {
  const source = read("pages/forum/thread/[id].vue");
  const mediaStyles = source.slice(source.indexOf(".thread-image img"), source.indexOf(".thread-image figcaption"));
  assert.match(mediaStyles, /background: transparent/);
  assert.doesNotMatch(mediaStyles, /aspect-ratio/);
});

test("reply surface uses one boundary and a bottom composer", () => {
  const source = read("pages/forum/thread/[id].vue");
  const actionStyles = source.slice(source.indexOf(".thread-actions {"), source.indexOf(".thread-action {"));
  assert.doesNotMatch(actionStyles, /border-bottom/);
  assert.match(source, /class="reply-section__divider"/);
  assert.match(source, /v-if="!replyExpanded"[\s\S]*class="reply-box__open"/);
  assert.match(source, /--thread-nav-offset: calc\(66px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(source, /bottom: var\(--thread-nav-offset\)/);
  assert.doesNotMatch(source, /\.reply-box\s*\{[\s\S]*position: sticky/);
  assert.doesNotMatch(source, /\.reply-list\s*\{[\s\S]*overflow-y/);
});

test("reply actions focus the shared composer and preserve target context", () => {
  const source = read("pages/forum/thread/[id].vue");
  assert.match(source, /const setReplyTarget[\s\S]*replyExpanded\.value = true[\s\S]*replyInput\.value\?\.focus/);
  assert.match(source, /setReplyTarget\(null\)/);
  assert.match(source, /setReplyTarget\(post\.id/);
  assert.match(source, /setReplyTarget\(reply\.id/);
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
  assert.match(source, /class="thread-action__icon"/);
  assert.match(source, /class="reply-action__icon"/);
  assert.match(source, /:aria-pressed="detail\.viewerHasLiked"/);
  assert.match(source, /:aria-pressed="post\.viewerHasLiked"/);
  assert.match(source, /\.thread-action:focus-visible/);
  assert.match(source, /\.reply-action:active/);
  assert.match(source, /min-height: 44px/);
});

test("community dark mode remaps semantic text and composer surface tokens", () => {
  const thread = read("pages/forum/thread/[id].vue");
  assert.match(thread, /body\.theme-dark \.forum-thread-page \{[\s\S]*--viewer-text: #f2e7dc/);
  assert.match(thread, /body\.theme-dark \.forum-thread-page \{[\s\S]*--viewer-text-muted: #cab8aa/);
  assert.match(thread, /body\.theme-dark \.forum-thread-page \{[\s\S]*--viewer-surface: rgba\(27, 24, 22, 0\.92\)/);
  assert.match(thread, /body\.theme-dark \.reply-box \{[\s\S]*var\(--viewer-surface\)/);
  assert.match(thread, /body\.theme-dark \.reply-box :deep\(\.el-textarea__inner\) \{[\s\S]*var\(--viewer-text\)/);
});

test("reply list keeps internal rhythm and a bottom inset above fixed composer", () => {
  const source = read("pages/forum/thread/[id].vue");
  assert.match(source, /\.reply-list \{[\s\S]*gap: 18px/);
  assert.match(source, /\.floor-card__actions \{ margin-top: 12px; padding-bottom: 4px; \}/);
  assert.match(source, /\.sub-reply-item \{[\s\S]*padding: 16px 0 16px 28px/);
  assert.match(source, /\.reply-list \{ padding-bottom: 24px; \}/);
  assert.match(source, /--thread-composer-height: 64px/);
});

test("thread feed items navigate as accessible full-row targets", () => {
  const source = read("components/forum/ForumThreadCard.vue");
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
  assert.match(newThread, /单张图片不能超过 20MB/);
  assert.match(thread, /FORUM_IMAGE_MAX_BYTES/);
  assert.match(thread, /1枚の画像は20MB以内で選択してください/);
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
