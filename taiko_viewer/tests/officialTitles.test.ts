import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { getTitlesPageContent } from "../server/services/content/titles.ts";

test("titles page reads the shared official catalog, preserving unknown conditions", async () => {
  const content = {
    titles: [{ id: 134, name: "765の達人", rarity: 2, condition: "", songIds: [] }],
    total: 1
  };
  globalThis.useRuntimeConfig = () => ({ taikoTitleApiBase: "http://center.test/" });
  globalThis.$fetch = async (path, options) => {
    assert.equal(path, "/api/titles");
    assert.equal(options.baseURL, "http://center.test");
    assert.equal(options.retry, 0);
    return content;
  };
  assert.deepEqual(await getTitlesPageContent(), content);
  const page = readFileSync(new URL("../pages/titles.vue", import.meta.url), "utf8");
  assert.match(page, /<td>\{\{ title.condition \}\}<\/td>/);
});

test("unavailable or incomplete official catalog fails without legacy DB substitution", async () => {
  globalThis.useRuntimeConfig = () => ({});
  for (const response of [null, { titles: [], total: 1 }]) {
    globalThis.$fetch = async () => response;
    await assert.rejects(getTitlesPageContent, (error: any) => error.statusCode === 503);
  }
  globalThis.$fetch = async () => { throw new Error("center unavailable"); };
  await assert.rejects(getTitlesPageContent, (error: any) => error.statusCode === 503);
});
