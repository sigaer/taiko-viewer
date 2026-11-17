import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { isRetiredAnnualPath } from '../server/utils/annual-retirement.ts';

test('retired public, authenticated, admin, bot and render routes resolve to retirement', () => {
  for (const path of ['/annual','/annual/share/token','/ja/annual/share/token','/account/version-summary','/account/annual-poster/id','/account/annual-share-card/id','/admin/taiko/annual-summaries','/api/annual/shares/token','/api/annual-beta/redeem','/api/account/annual-summaries/key/build','/api/account/annual-share-cards/id/image','/api/admin/annual-reactions/id','/api/internal/annual-posters/id','/api/taiko/internal/annual-card']) assert.equal(isRetiredAnnualPath(path),true,path);
});
test('unrelated account, rewards, history and community paths remain outside retirement', () => {
  for (const path of ['/','/ja','/my','/account/profile','/account/sync','/api/account/auth/me','/api/forum/threads','/api/account/titles','/api/account/my-taiko/overview','/api/admin/users','/annuality','/api/account/annual-summaries-other']) assert.equal(isRetiredAnnualPath(path),false,path);
});
test('retirement never imports a DB or mutates retained rewards and storage', async () => {
  const source=await readFile(new URL('../server/middleware/00-annual-retired.ts',import.meta.url),'utf8');
  assert.match(source,/setResponseStatus\(event, 410/);
  assert.doesNotMatch(source,/account-db|unlink|rmdir|DELETE|DROP|annual-summary\//);
  for(const file of ['server/services/account-titles/repository.ts','server/services/account-titles/annual-beta-grant.ts','server/utils/retired-annual-schema.ts']) await access(new URL('../'+file,import.meta.url));
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  const lifecycle=await readFile(new URL('../server/plugins/account-db.ts',import.meta.url),'utf8');assert.match(lifecycle,/assertAccountDbConfiguration/);assert.match(lifecycle,/closeAccountDb/);
  assert.equal(pkg.scripts.build,'nuxt build');assert.ok(pkg.scripts.prebuild.includes('prepare_tja_runtime'));
  assert.equal(pkg.dependencies.three,undefined);assert.equal(pkg.dependencies.gsap,undefined);assert.ok(pkg.dependencies.ajv);
});
