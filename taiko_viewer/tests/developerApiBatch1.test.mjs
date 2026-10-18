import '../../packages/sakura-taiko-contract/tests/api-v1.test.mjs';
// Run the documentation contract/example checks in the existing API CI job.
import './developerApiGuide.test.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {projectCatalog} from '@sakura-taiko/contract/catalog';
import {acquireDeveloperAnalysisSlot,activeDeveloperAnalyses,ANALYSIS_MAX_CONCURRENT,ANALYSIS_ADDRESS_SPACE_BYTES} from '../server/services/account/developer-analysis-limits.ts';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('batch one routes delegate to the intended service and removed aliases route is absent',async()=>{
 const [songs,rating,recommendations]=await Promise.all([
  read('../server/api/v1/taiko/catalog/songs.get.ts'),
  read('../server/api/developer/userdata/[userid]/rating.get.ts'),
  read('../server/api/developer/userdata/[userid]/recommendations.get.ts')
 ]);
 assert.match(songs,/publicRead\(event,\s*["']songs["']\)/);
 assert.match(rating,/getDeveloperAnalysisByUserid\(event,event\.context\.params\?\.userid,'rating'\)/);
 assert.match(recommendations,/getDeveloperAnalysisByUserid\(event,event\.context\.params\?\.userid,'recommendations'\)/);
 await assert.rejects(access(new URL('../server/api/v1/taiko/catalog/aliases.get.ts',import.meta.url)));
 await assert.rejects(access(new URL('../server/api/v1/taiko/catalog/charts.get.ts',import.meta.url)));
});

test('catalog adapter joins song names and aliases by ID using one fixture',async()=>{
 const [catalog,adapter,reader,fixtureSource]=await Promise.all([
  read('../server/services/developer-api-v1/catalog.ts'),
  read('../../packages/sakura-taiko-contract/src/catalog.mjs'),
  read('../server/services/developer-api-v1/read.ts'),
  read('../../packages/sakura-taiko-contract/fixtures/api-v1.json')
 ]);
 for(const value of ['song_data.json','song_alias.json','songDataSha256','songAliasSha256']) assert.ok(catalog.includes(value),value);
 for(const value of ['song_name','song_name_jp','aliases']) assert.ok(adapter.includes(value),value);
 assert.match(reader,/catalogSongsWithCharts\(c\)/);
 assert.ok(!reader.includes("kind==='aliases'"));
 const fixture=JSON.parse(fixtureSource);
 assert.deepEqual(projectCatalog(fixture.catalogInput,'synthetic-catalog-v1',fixture.aliasInput),fixture.catalogExpected);
});

test('Rating and recommendations reuse the existing authorized source read path',async()=>{
 const [service,legacy]=await Promise.all([
  read('../server/services/account/developer-analytics.ts'),
  read('../server/services/account/source-access.ts')
 ]);
 for(const value of ['compute_all_from_userdata_records','project_player_rating','topSongs','topSongsCount','readAuthorizedSourceUserdata','readAuthorizedMergedSource','enforceTaikoOpenQuota','privateSourceResponse']) assert.ok(service.includes(value),value);
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
 const schema=JSON.parse(await read('../../packages/sakura-taiko-contract/schema/contract-v1.json'));
 assert.equal(schema.$id,'urn:sakura-taiko:contract:1.1');
 assert.deepEqual(Object.keys(schema.$defs.Song.properties),['songId','song_name','song_name_jp','aliases','catalogRevision','availability']);
 assert.equal(Object.hasOwn(schema.$defs.Song.properties,'title'),false);
 assert.equal(schema.$defs.ApiReadVersions.properties.contractVersion.enum[0],'1.1');
});

test('analysis subprocess admission is bounded and memory-limited',()=>{
 assert.equal(ANALYSIS_MAX_CONCURRENT,1);
 assert.ok(ANALYSIS_ADDRESS_SPACE_BYTES<=1024*1024*1024);
 assert.equal(activeDeveloperAnalyses(),0);
 const release=acquireDeveloperAnalysisSlot();
 assert.equal(activeDeveloperAnalyses(),1);
 assert.throws(()=>acquireDeveloperAnalysisSlot(),error=>error.statusCode===503);
 release();release();
 assert.equal(activeDeveloperAnalyses(),0);
 const next=acquireDeveloperAnalysisSlot();next();
});
