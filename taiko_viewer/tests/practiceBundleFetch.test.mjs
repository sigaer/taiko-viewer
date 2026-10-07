import assert from "node:assert/strict";
import test from "node:test";
import { createBundleFetch } from "../public/practice-player/bundle-fetch.mjs";

test("only the exact virtual audio URL is handled from memory", async () => {
  const url = "https://viewer.sakura-bot.cn/practice-player/audio/test";
  let forwarded = 0;
  const fetch = createBundleFetch(url, new Blob(["test"], { type: "audio/ogg" }), async () => {
    forwarded++; return new Response("network");
  });
  const response = await fetch(new Request(url));
  assert.equal(await response.text(), "test");
  assert.equal(response.headers.get("Content-Type"), "audio/ogg");
  assert.equal(await (await fetch(`${url}-other`)).text(), "network");
  assert.equal(forwarded, 1);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(fetch(url, { signal: controller.signal }), { name: "AbortError" });
});
