import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('batch one exposes concrete catalog and player data routes',async()=>{
 const [songs,rating,recommendations]=await Promise.all([
  read('../server/api/v1/taiko/catalog/songs.get.ts'),
  read('../server/api/developer/userdata/[userid]/rating.get.ts'),
  read('../server/api/developer/userdata/[userid]/recommendations.get.ts')
 ]);
 assert.ok(songs.includes("publicRead(event,\"songs\")"));
 assert.ok(rating.includes("getDeveloperAnalysisByUserid"));
 assert.ok(rating.includes("'rating'"));
 assert.ok(recommendations.includes("getDeveloperAnalysisByUserid"));
 assert.ok(recommendations.includes("'recommendations'"));
 await assert.rejects(access(new URL('../server/api/v1/taiko/catalog/aliases.get.ts',import.meta.url)));
});

test('song metadata and aliases are joined by song ID in one revisioned catalog',async()=>{
 const [catalog,reader]=await Promise.all([
  read('../server/services/developer-api-v1/catalog.ts'),
  read('../server/services/developer-api-v1/read.ts')
 ]);
 for(const value of ['song_data.json','song_alias.json','song_name','song_name_jp','aliases','songDataSha256','songAliasSha256']) assert.ok(catalog.includes(value),value);
 assert.ok(catalog.includes('projectCatalog(songSource.rows,revision,aliasSource.rows)'));
 assert.ok(catalog.includes('songAliasSha256'));
 assert.ok(!catalog.includes('title:'));
 assert.ok(reader.includes("items:kind==='songs'?c.songs:c.charts"));
 assert.ok(reader.includes('versions:versions(c.revision)'));
 assert.ok(!reader.includes("kind==='aliases'"));
});

test('Rating response includes top-30 detail and uses the existing source authorization path',async()=>{
 const [service,legacy]=await Promise.all([
  read('../server/services/account/developer-analytics.ts'),
  read('../server/services/account/source-access.ts')
 ]);
 for(const value of ['compute_all_from_userdata_records','project_player_rating','topSongs','topSongsCount']) assert.ok(service.includes(value),value);
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

test('public Song Contract 1.1 has no duplicate title alias',async()=>{
 const schema=JSON.parse(await read('../packages/sakura-taiko-contract/schema/contract-v1.json'));
 assert.equal(schema.$id,'urn:sakura-taiko:contract:1.1');
 assert.deepEqual(Object.keys(schema.$defs.Song.properties),['songId','song_name','song_name_jp','aliases','catalogRevision','availability']);
 assert.equal(Object.hasOwn(schema.$defs.Song.properties,'title'),false);
 assert.equal(schema.$defs.ApiReadVersions.properties.contractVersion.enum[0],'1.1');
});
