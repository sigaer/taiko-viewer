import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Weekly route is authenticated, private, bounded and has no profile selector", async () => {
  const source = await readFile(new URL("../server/api/account/growth/weekly.get.ts", import.meta.url), "utf8");
  assert.match(source, /requireAccountUser\(event\)/);
  assert.match(source, /private, no-store/);
  assert.match(source, /Vary/);
  assert.doesNotMatch(source, /bindingId|profileId|userId/);
  assert.match(source, /resolveWeeklyGrowthWindow/);
});

test("Weekly service composes one canonical History result and at most one Growth Overview", async () => {
  const source = await readFile(new URL("../server/services/growth-weekly/service.ts", import.meta.url), "utf8");
  assert.equal((source.match(/getGrowthHistory\(/g) || []).length, 1);
  assert.equal((source.match(/getPlayerGrowthOverview\(/g) || []).length, 1);
  assert.doesNotMatch(source, /deriveProgressForRange|runGrowthPythonJson/);
});

test("Weekly page presents the server DTO with localized state copy and light navigation entries", async () => {
  const [page, myPage, home, sidebar, zh, ja] = await Promise.all([
    readFile(new URL("../pages/my/weekly.vue", import.meta.url), "utf8"),
    readFile(new URL("../pages/my.vue", import.meta.url), "utf8"),
    readFile(new URL("../components/home/PlayerGrowthSurface.vue", import.meta.url), "utf8"),
    readFile(new URL("../components/SidebarNav.vue", import.meta.url), "utf8"),
    readFile(new URL("../locales/zh.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../locales/ja.json", import.meta.url), "utf8").then(JSON.parse)
  ]);
  assert.match(page, /\/api\/account\/growth\/weekly/);
  assert.doesNotMatch(page, /score-pb[^\n]*(?:filter|reduce)|goal-completed[^\n]*(?:filter|reduce)/);
  assert.match(page, /weekly-rhythm/);
  assert.match(myPage, /<NuxtPage v-if="isWeeklyRoute"/);
  assert.doesNotMatch(page, /grid-template-columns:\s*repeat\(3/);
  assert.match(home, /\/my\/weekly/);
  assert.match(sidebar, /\/my\/weekly/);
  for (const messages of [zh, ja]) {
    assert.equal(typeof messages.weekly.title, "string");
    for (const key of ["stability", "score-breakthrough", "new-crown", "rank-breakthrough", "goal-follow-through", "mixed-growth", "broad-activity", "focus-change", "balanced", "quiet", "no-play", "limited-coverage"])
      assert.equal(typeof messages.weekly.theme[key], "string", `missing theme ${key}`);
    for (const key of ["partial", "truncated", "unknown"])
      assert.equal(typeof messages.weekly.coverage[key], "string", `missing coverage ${key}`);
  }
});
