import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = path => readFile(new URL(path, import.meta.url), "utf8");

test("Recent GET is authenticated, private and read-only", async () => {
  const [route, service] = await Promise.all([source("../server/api/account/growth/recent.get.ts"), source("../server/services/growth-recent/service.ts")]);
  assert.match(route, /requireAccountUser\(event\)/);
  assert.match(route, /private, no-store/);
  assert.match(route, /Vary/);
  assert.doesNotMatch(route, /readBody|profileId|bindingId|userId/);
  const getBody = service.slice(service.indexOf("export async function getRecentGrowth"), service.indexOf("type AcknowledgeInput"));
  assert.doesNotMatch(getBody, /writeRecentCursor|INSERT|UPDATE|DELETE/);
});

test("Recent acknowledgement is a separate authenticated CAS POST", async () => {
  const [route, service] = await Promise.all([source("../server/api/account/growth/recent/ack.post.ts"), source("../server/services/growth-recent/service.ts")]);
  assert.match(route, /requireAccountUser\(event\)/);
  assert.match(route, /readBody\(event\)/);
  assert.match(route, /private, no-store/);
  assert.match(service, /stored\?\.token \|\| null\) !== expectedBoundary/);
  assert.match(service, /current\.token !== acknowledgeToken/);
  assert.match(service, /FOR UPDATE/);
});

test("Home acknowledges only after Recent Growth has rendered", async () => {
  const [component, composable, service, zh] = await Promise.all([source("../components/home/RecentGrowth.vue"), source("../composables/useRecentGrowth.ts"), source("../server/services/growth-recent/service.ts"), source("../locales/zh.json")]);
  assert.match(component, /await nextTick\(\)/);
  assert.match(component, /requestAnimationFrame/);
  assert.match(component, /emit\("presented", token\)/);
  assert.match(composable, /method: "POST"/);
  assert.match(composable, /expectedBoundary/);
  assert.match(service, /"ng-reduced", "combo-improved"/);
  assert.match(component, /recent\.ngReduced/);
  assert.match(component, /recent\.combo/);
  assert.doesNotMatch(zh, /这次游玩|这一轮/);
});

test("generic history writer preserves its actual writer provenance", async () => {
  const writer = await source("../server/internal/account/shared.ts");
  const block = writer.slice(writer.indexOf("export const writeUserdataWithHistory"), writer.indexOf("export const getLockMap"));
  assert.match(block, /\.\.\.payload,[\s\S]*_meta:[\s\S]*\.\.\.payloadMeta,[\s\S]*writer_source: source/);
});
