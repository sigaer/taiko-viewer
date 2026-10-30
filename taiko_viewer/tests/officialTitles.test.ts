import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { getOfficialTitlesContent, getTitlesPageContent } from "../server/services/content/titles.ts";
import { getLocalTitleDetails, mergeOfficialTitleDetails } from "../server/services/content/titleDetails.ts";

const item = (id, name, rarity, condition = "", songIds = []) => ({ id, name, rarity, condition, songIds });
const config = () => ({ taikoTitleApiBase: "http://center.test/", taikoApiBase: "http://local.test/" });

test("page keeps official inventory and IDs while restoring local conditions and songs", async () => {
  const official = { titles: [item(134, "765の達人", 2), item(800, "新称号", 2, "API条件")], total: 2 };
  globalThis.useRuntimeConfig = config;
  globalThis.$fetch = async (path, options) => {
    if (path === "/api/titles") {
      assert.equal(options.baseURL, "http://center.test");
      return official;
    }
    assert.equal(path, "/taiko/title/page");
    assert.equal(options.baseURL, "http://local.test");
    assert.deepEqual(options.query, { page: 1, pageSize: 500 });
    return { code: 0, data: { pageData: [item(2, "765の達人", 2, "本地条件", [20, 38])], total: 1 } };
  };
  const payload = await getTitlesPageContent();
  assert.deepEqual(payload, { titles: [item(134, "765の達人", 2, "本地条件", [20, 38]), official.titles[1]], total: 2 });
  assert.deepEqual(official.titles[0], item(134, "765の達人", 2));
  const page = readFileSync(new URL("../pages/titles.vue", import.meta.url), "utf8");
  assert.match(page, /<td>\{\{ title.condition \}\}<\/td>/);
});

test("local details win per field; API fills missing rows and fields without adding local-only titles", () => {
  const official = { titles: [
    item(1, "有本地", 2, "API条件", [1]),
    item(2, "无本地", 2, "API条件", [2]),
    item(3, "本地缺条件", 2, "API条件", [3]),
    item(4, "本地缺歌曲", 2, "API条件", [4]),
    item(5, "全未知", 2, "？？？")
  ], total: 5 };
  const local = [
    item(90, "有本地", 2, "本地条件", [90, 90, -1, "91"]),
    item(91, "本地缺条件", 2, "? ? ?", [92]),
    item(92, "本地缺歌曲", 2, "本地条件"),
    item(93, "本地独有", 2, "不应展示", [93])
  ];
  const original = JSON.stringify({ official, local });
  const payload = mergeOfficialTitleDetails(official, local);
  assert.deepEqual(payload.titles.map((title) => title.condition), ["本地条件", "API条件", "API条件", "本地条件", ""]);
  assert.deepEqual(payload.titles.map((title) => title.songIds), [[90, 91], [2], [92], [4], []]);
  assert.deepEqual(payload.titles.map((title) => title.id), [1, 2, 3, 4, 5]);
  assert.equal(payload.total, 5);
  assert.equal(JSON.stringify({ official, local }), original);
});

test("matching normalizes name width and whitespace, but never mixes plate variants", () => {
  const official = { titles: [item(1, "POLARiSNAUT", 43), item(2, "POLARiSNAUT", 61, "里谱API"), item(3, "765 の達人", 2)], total: 3 };
  const payload = mergeOfficialTitleDetails(official, [
    item(100, "POLARiSNAUT", 42, "表谱全连", [42]),
    item(101, "POLARiSNAUT", 43, "表谱全良", [43]),
    item(102, "７６５　の達人", 2, "本地条件", [765])
  ]);
  assert.deepEqual(payload.titles.map((title) => title.condition), ["表谱全良", "里谱API", "本地条件"]);
  assert.deepEqual(payload.titles.map((title) => title.songIds), [[43], [], [765]]);
});

test("local details fetch all pages and normalize the legacy song_ids alias", async () => {
  globalThis.useRuntimeConfig = config;
  const pages = [];
  globalThis.$fetch = async (path, options) => {
    assert.equal(path, "/taiko/title/page");
    pages.push(options.query.page);
    return { code: 0, data: { pageData: [{ id: options.query.page, name: `称号${options.query.page}`, rarity: 2, condition: "???", song_ids: [1, "2", 0, 1] }], total: 2 } };
  };
  assert.deepEqual((await getLocalTitleDetails()).map((title) => title.songIds), [[1, 2], [1, 2]]);
  assert.deepEqual(pages, [1, 2]);
});

test("incomplete or repeated local pages fail instead of silently discarding known details", async () => {
  globalThis.useRuntimeConfig = config;
  for (const second of [[], [item(1, "重复", 2)]]) {
    globalThis.$fetch = async (_path, options) => ({ code: 0, data: {
      pageData: options.query.page === 1 ? [item(1, "称号", 2)] : second,
      total: 2
    } });
    await assert.rejects(getLocalTitleDetails, (error: any) => error.statusCode === 503);
  }
  globalThis.$fetch = async () => { throw new Error("local unavailable"); };
  await assert.rejects(getLocalTitleDetails, (error: any) => error.statusCode === 503);
});

test("official keys can load without local metadata; missing official inventory never falls back to local titles", async () => {
  globalThis.useRuntimeConfig = config;
  const official = { titles: [item(1, "官方称号", 2)], total: 1 };
  globalThis.$fetch = async (path) => {
    assert.equal(path, "/api/titles");
    return official;
  };
  assert.deepEqual(await getOfficialTitlesContent(), official);
  for (const response of [null, { titles: [], total: 1 }]) {
    globalThis.$fetch = async (path) => path === "/api/titles" ? response : { code: 0, data: { pageData: [], total: 0 } };
    await assert.rejects(getTitlesPageContent, (error: any) => error.statusCode === 503);
  }
});
