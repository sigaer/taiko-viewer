import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Passport route is authenticated, private, bounded and has no profile selector", async () => {
  const source = await readFile(new URL("../server/api/account/growth/passport.get.ts", import.meta.url), "utf8");
  const range = await readFile(new URL("../server/services/growth-passport/range.ts", import.meta.url), "utf8");
  assert.match(source, /requireAccountUser/);
  assert.match(source, /private, no-store/);
  assert.match(source, /Vary/);
  assert.doesNotMatch(source + range, /profileId.*query|query.*profileId/);
  for (const days of [30, 90, 180, 365]) assert.match(range, new RegExp(String(days)));
});

test("Passport service uses persisted measurements, one canonical History call and at most one Overview", async () => {
  const service = await readFile(new URL("../server/services/growth-passport/service.ts", import.meta.url), "utf8");
  assert.equal((service.match(/getPlayerGrowthOverview\(/g) || []).length, 1);
  assert.equal((service.match(/getGrowthHistory\(/g) || []).length, 1);
  assert.equal((service.match(/readGrowthMeasurements\(/g) || []).length, 1);
  assert.doesNotMatch(service, /runGrowthPythonJson|web_skill_passport|CREATE TABLE|ALTER TABLE/);
  assert.match(service, /profile-changed/);
});

test("Passport page is localized, single-series, accessible and connected to Weekly/Home/My", async () => {
  const [page, weekly, home, my, sidebar, zh, ja] = await Promise.all([
    readFile(new URL("../pages/my/growth.vue", import.meta.url), "utf8"),
    readFile(new URL("../pages/my/weekly.vue", import.meta.url), "utf8"),
    readFile(new URL("../components/home/PlayerGrowthSurface.vue", import.meta.url), "utf8"),
    readFile(new URL("../pages/my.vue", import.meta.url), "utf8"),
    readFile(new URL("../components/SidebarNav.vue", import.meta.url), "utf8"),
    readFile(new URL("../locales/zh.json", import.meta.url), "utf8"),
    readFile(new URL("../locales/ja.json", import.meta.url), "utf8")
  ]);
  assert.match(page, /\/api\/account\/growth\/passport/);
  assert.match(page, /role="img"/);
  assert.match(page, /tabindex="0"/);
  assert.match(page, /aria-pressed/);
  assert.match(page, /passport-chart__segment/);
  assert.doesNotMatch(page, /modelRevision|algorithmVersion|scoreRevision/);
  assert.doesNotMatch(page, /passport-metric|kpi-grid/i);
  for (const source of [weekly, home, my, sidebar]) assert.match(source, /\/my\/growth/);
  for (const locale of [JSON.parse(zh), JSON.parse(ja)]) {
    assert.equal(typeof locale.passport.title, "string");
    assert.equal(typeof locale.passport.segmentUpdated, "string");
    assert.equal(typeof locale.passport.newRecordTitle, "string");
  }
});
