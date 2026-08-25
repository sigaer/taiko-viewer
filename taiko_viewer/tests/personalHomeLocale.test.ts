import test from "node:test";
import assert from "node:assert/strict";
import zh from "../locales/zh.json" with { type: "json" };
import ja from "../locales/ja.json" with { type: "json" };

const personalHomeKeys = [
  "home.personal.eyebrow",
  "home.personal.greeting",
  "home.personal.rating",
  "home.personal.ratingBasis",
  "home.personal.viewScores",
  "home.personal.connected",
  "home.personal.summaryUnavailable",
  "home.personal.unboundTitle",
  "home.personal.unboundBody",
  "home.personal.bindCta",
  "home.personal.emptyTitle",
  "home.personal.emptyBody",
  "home.personal.syncCta",
  "home.personal.recommendationEyebrow",
  "home.personal.recommendationSong",
  "home.personal.level",
  "home.personal.viewSong",
  "home.personal.recommendationUnavailable",
  "home.personal.noRecommendation",
  "home.personal.openRecommendationTool"
] as const;

const resolve = (messages: Record<string, unknown>, key: string) =>
  key.split(".").reduce<unknown>((value, part) => {
    if (!value || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[part];
  }, messages);

for (const [locale, messages] of [["zh", zh], ["ja", ja]] as const) {
  test(`${locale} personal home translations are complete`, () => {
    for (const key of personalHomeKeys) {
      const value = resolve(messages, key);
      assert.equal(typeof value, "string", `${locale} missing ${key}`);
      assert.ok(String(value).trim(), `${locale} empty ${key}`);
      assert.notEqual(value, key, `${locale} raw key ${key}`);
    }
  });
}

test("home copy does not claim unsupported ability judgments", () => {
  for (const messages of [zh, ja]) {
    const text = JSON.stringify(messages.home.personal);
    assert.doesNotMatch(text, /短板|弱项|强项|练习重点|弱点|苦手|強み|練習重点/);
  }
});

test("mobile tab and personal page use separate labels", () => {
  assert.equal(zh.nav.my, "我的");
  assert.equal(zh.nav.myTaiko, "我的太鼓");
  assert.equal(ja.nav.my, "マイ");
  assert.equal(ja.nav.myTaiko, "マイ太鼓");
});

test("personal home error copy does not expose implementation details", () => {
  for (const messages of [zh, ja]) {
    for (const key of ["home.personal.summaryUnavailable", "home.personal.recommendationUnavailable"]) {
      const value = String(resolve(messages, key));
      assert.doesNotMatch(value, /\/api\/|\b(?:500|502)\b|timeout|worker/i);
    }
  }
});
