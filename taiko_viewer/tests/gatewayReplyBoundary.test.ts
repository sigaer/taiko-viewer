import assert from "node:assert/strict";
import test from "node:test";
import { readBoundedGatewayJson } from "../server/infrastructure/local-gateway/json.ts";

test("gateway accepts chunked UTF-8 within the byte budget", async () => {
  const encoded = new TextEncoder().encode('{"title":"太鼓"}');
  const body = new ReadableStream({ start(controller) { controller.enqueue(encoded.slice(0, 12)); controller.enqueue(encoded.slice(12)); controller.close(); } });
  assert.deepEqual(await readBoundedGatewayJson(new Response(body), 64), { title: "太鼓" });
});
test("gateway rejects oversized headers and streamed bytes", async () => {
  await assert.rejects(readBoundedGatewayJson(new Response("{}", { headers: { "content-length": "65" } }), 64));
  await assert.rejects(readBoundedGatewayJson(new Response("x".repeat(65)), 64));
});
test("gateway rejects malformed JSON and invalid UTF-8", async () => {
  await assert.rejects(readBoundedGatewayJson(new Response("{")));
  await assert.rejects(readBoundedGatewayJson(new Response(new Uint8Array([0xff]))));
});
test("gateway body deadline does not await an uncooperative cancellation", { timeout: 1000 }, async () => {
  const body = new ReadableStream({ pull() { return new Promise(() => {}); }, cancel() { return new Promise(() => {}); } });
  const started = performance.now();
  await assert.rejects(readBoundedGatewayJson(new Response(body), 64, 20), /deadline/);
  assert.ok(performance.now() - started < 500);
});
