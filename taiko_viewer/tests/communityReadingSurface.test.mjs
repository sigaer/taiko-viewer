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
