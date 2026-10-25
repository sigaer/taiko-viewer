import test from "node:test";
import assert from "node:assert/strict";
import { createSongSsrObserver } from "../server/services/content/songSsrObservation.ts";

test("song SSR diagnostics retain public routing and code locations only", () => {
  const records: unknown[] = [];
  const observe = createSongSsrObserver(record => records.push(record), () => 0);
  const error = new TypeError("Cannot read properties of undefined; secret-user@example.invalid");
  error.stack = "TypeError: secret-token\n    at render (file:///private-host/output/server/chunks/build/_id_-abc.mjs:1360:50)\n    at user (file:///private-user/sensitive.ts:1:2)\n    at computed (/private/output/server/node_modules/@vue/reactivity/dist/reactivity.cjs.prod.js:407:28)\n    at value (/private/node_modules/../../private/data.js:1:2)";
  error.name = "Error"; // H3 may wrap the original exception while keeping its stack.
  const event = {path:"/ja/songs/580?difficulty=5&token=secret-query"};
  observe(error, event);
  observe(error, event);
  assert.equal(records.length, 1);
  assert.deepEqual(records[0], {atUtc:"1970-01-01T00:00:00.000Z",songId:580,difficulty:5,locale:"ja",category:"TypeError",failure:"missing-value-read",stack:["server/chunks/build/_id_-abc.mjs:1360:50","node_modules/@vue/reactivity/dist/reactivity.cjs.prod.js:407:28"]});
  assert.equal(/secret|private|token=|@example/.test(JSON.stringify(records)), false);
});

test("only numeric song SSR routes are observed and difficulty is bounded", () => {
  const records: {difficulty:number|null;stack:string[]}[] = [];
  const observe = createSongSsrObserver(record => records.push(record), () => 0);
  for (const path of ["/api/content/songs/580", "/__nuxt_error", "/songs/private-user", "/songs/0", "/songs/580/ugc"]) observe(new Error("secret"), {path});
  assert.equal(records.length, 0);
  const error = new Error(); error.stack = "Error\n"+"    at render (/host/server/chunks/build/a.mjs:1:2)\n".repeat(10);
  observe(error, {path:"/songs/580?difficulty=5&difficulty=4"});
  assert.equal(records[0].difficulty, null);
  assert.equal(records[0].stack.length, 6);
});

test("observer caps each minute and never exceeds 100 per process", () => {
  let clock = 0;
  let count = 0;
  const observe = createSongSsrObserver(() => count++, () => clock);
  for (let minute = 0; minute < 22; minute++) {
    clock = minute * 60000;
    for (let i = 0; i < 8; i++) observe(new Error(), {path:"/songs/1454"});
    assert.equal(count, Math.min((minute + 1) * 5, 100));
  }
});
