import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../locales/", import.meta.url);
const sections = ["official", "events", "beginner-help", "score-guides", "dojo", "achievements", "arcade", "creative", "general"];

for (const locale of ["zh", "ja"]) {
  test(`${locale} forum sections have user-facing labels`, () => {
    const messages = JSON.parse(fs.readFileSync(new URL(`${locale}.json`, root), "utf8"));
    for (const slug of sections) {
      const label = messages.forum?.sections?.[slug]?.name;
      assert.equal(typeof label, "string");
      assert.equal(label.startsWith("forum."), false);
    }
  });
}
