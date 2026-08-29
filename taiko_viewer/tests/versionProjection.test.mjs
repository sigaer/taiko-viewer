import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("viewer version projects from package metadata into the More page", async () => {
  const [packageSource, lockSource, nuxtConfig, morePage] = await Promise.all([
    readProjectFile("package.json"),
    readProjectFile("package-lock.json"),
    readProjectFile("nuxt.config.ts"),
    readProjectFile("pages/more.vue")
  ]);
  const packageJson = JSON.parse(packageSource);
  const packageLock = JSON.parse(lockSource);

  assert.equal(packageLock.version, packageJson.version);
  assert.equal(packageLock.packages[""].version, packageJson.version);
  assert.match(nuxtConfig, /import packageJson from "\.\/package\.json"/);
  assert.match(nuxtConfig, /public:\s*\{[\s\S]*?appVersion/);
  assert.match(morePage, /runtimeConfig\.public\.appVersion/);
  assert.match(morePage, /v\{\{ appVersion \}\}/);
  assert.doesNotMatch(morePage, /v?\d+\.\d+\.\d+/);
});
