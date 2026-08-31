import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../locales/", import.meta.url);
const sections = ["official", "events", "beginner-help", "score-guides", "dojo", "achievements", "arcade", "creative", "general"];
const visibleKeys = [
  "community.relatedDiscussions",
  "community.viewAllDiscussions",
  "community.discussThisChart",
  "community.noRelatedDiscussions",
  "community.viewChart",
  "community.chartActivity.eyebrow",
  "community.chartActivity.title",
  "community.chartActivity.participants",
  "community.chartActivity.viewChart",
  "home.growth.limitedTitle",
  "home.growth.focusDescription",
  "home.growth.planTitle",
  "home.growth.progressTitle",
  "home.growth.noPlay",
  "home.growth.loadFailed"
];

const resolve = (messages, key) => key.split(".").reduce((value, part) => value && typeof value === "object" ? value[part] : undefined, messages);

for (const locale of ["zh", "ja"]) {
  const messages = JSON.parse(fs.readFileSync(new URL(`${locale}.json`, root), "utf8"));
  test(`${locale} forum sections have user-facing labels`, () => {
    for (const slug of sections) {
      const label = messages.forum?.sections?.[slug]?.name;
      assert.equal(typeof label, "string");
      assert.equal(label.startsWith("forum."), false);
    }
  });

  test(`${locale} visible community and growth keys resolve`, () => {
    for (const key of visibleKeys) {
      const value = resolve(messages, key);
      assert.equal(typeof value, "string", `${locale} missing ${key}`);
      assert.notEqual(value, key, `${locale} raw key ${key}`);
      assert.ok(value.trim(), `${locale} empty ${key}`);
    }
  });

  test(`${locale} growth copy avoids duplicate prompt labels`, () => {
    const growth = messages.home.growth;
    assert.equal(growth.currentState, undefined);
    assert.equal(growth.focusTitle, undefined);
    assert.equal(growth.todayPlan, undefined);
    assert.equal(growth.dailyProgress, undefined);
    assert.equal(growth.planTitle, locale === "zh" ? "练这三首" : "この3曲を練習");
    assert.equal(growth.progressTitle, locale === "zh" ? "今天" : "今日");
  });
}
