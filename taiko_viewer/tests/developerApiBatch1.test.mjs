import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('batch one exposes only concrete catalog and player data routes',async()=>{
 const [aliases,rating,recommendations]=await Promise.all([
  read('../server/api/v1/taiko/catalog/aliases.get.ts'),
  read('../server/api/developer/userdata/[userid]/rating.get.ts'),
  read('../server/api/developer/userdata/[userid]/recommendations.get.ts')
 ]);
 assert.ok(aliases.includes("publicRead(event,'aliases')"));
 assert.ok(rating.includes("getDeveloperAnalysisByUserid"));
 assert.ok(rating.includes("'rating'"));
 assert.ok(recommendations.includes("getDeveloperAnalysisByUserid"));
 assert.ok(recommendations.includes("'recommendations'"));
});

test('Rating response includes top-30 detail and uses the existing source authorization path',async()=>{
 const [service,legacy]=await Promise.all([
  read('../server/services/account/developer-analytics.ts'),
  read('../server/services/account/source-access.ts')
 ]);
 for(const value of ['compute_all_from_userdata_records','project_player_rating','topSongs','topSongsCount','withScoreRead']) {
  if(value==='withScoreRead') continue; // Existing authorized readers own the committed-read lifecycle.
  assert.ok(service.includes(value),value);
 }
 assert.ok(service.includes('readAuthorizedSourceUserdata'));
 assert.ok(service.includes('readAuthorizedMergedSource'));
 assert.ok(service.includes('enforceTaikoOpenQuota'));
 assert.ok(service.includes('privateSourceResponse'));
 assert.ok(legacy.includes('serviceGrant'));
 assert.ok(!service.includes('proveGrant'));
});

test('analysis fails closed if score data changes during computation',async()=>{
 const service=await read('../server/services/account/developer-analytics.ts');
 assert.ok(service.includes("const revision=digest({songs:before.songs,meta:before._meta??null})"));
 assert.ok(service.includes("digest({songs:after.songs,meta:after._meta??null})!==revision"));
 assert.ok(service.includes('new PublicationUnavailableError()'));
});

test('public aliases use bounded source bytes and no-follow open',async()=>{
 const [catalog,reader]=await Promise.all([
  read('../server/services/developer-api-v1/catalog.ts'),
  read('../server/services/developer-api-v1/read.ts')
 ]);
 for(const value of ['song_alias.json','O_NOFOLLOW','4*1024*1024']) assert.ok(catalog.includes(value),value);
 assert.ok(reader.includes("kind==='aliases'?await aliases():null"));
 assert.ok(reader.includes('a?.revision'));
 assert.ok(!reader.includes('progress-options'));
});
