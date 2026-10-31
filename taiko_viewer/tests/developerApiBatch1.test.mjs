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
test('My Taiko source check accepts a populated alias catalog but still rejects real song-source drift',async()=>{
 const {mkdtemp,writeFile,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{createRequire}=await import('node:module'),{pathToFileURL}=await import('node:url'),{createHash}=await import('node:crypto');
 const ts=(await import('typescript')).default,require=createRequire(import.meta.url),root=new URL('../',import.meta.url),saved=globalThis.useRuntimeConfig;
 const dir=await mkdtemp(join(process.env.QA_RUN_TMPDIR||tmpdir(),'my-catalog-'));
 const moduleUrl=async path=>{
  let code=await readFile(new URL(path,root),'utf8');
  code=code.replace("'../../infrastructure/runtime-paths'",JSON.stringify(new URL('server/infrastructure/runtime-paths.ts',root).href));
  if(code.includes("'./common'"))code=code.replace("'./common'",JSON.stringify(await moduleUrl('server/services/developer-api-v1/common.ts')));
  for(const spec of ['@sakura-taiko/contract/schema','@sakura-taiko/contract/catalog','h3'])code=code.replaceAll("'"+spec+"'",JSON.stringify(pathToFileURL(require.resolve(spec)).href));
  return 'data:text/javascript,'+encodeURIComponent(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
 };
 const load=async path=>import(await moduleUrl(path));
 try{
  const rows=[{id:100,song_name:'Fixture',level_4:9,shelf_status:0}],aliases=[{id:100,song_name_jp:'別名側の日本語名',aliases:['fixture alias']}];
  await writeFile(join(dir,'song_data.json'),JSON.stringify(rows));await writeFile(join(dir,'song_alias.json'),JSON.stringify(aliases));globalThis.useRuntimeConfig=()=>({repoRoot:dir,songDataPath:join(dir,'song_data.json')});
  const {catalog}=await load('server/services/developer-api-v1/catalog.ts'),{assertSongCatalogSource}=await load('server/services/my-taiko/catalog-consistency.ts');const current=await catalog();
  assert.deepEqual(current.songs[0].aliases,['fixture alias']);assert.equal(current.songs[0].song_name_jp,'別名側の日本語名');
  assert.doesNotThrow(()=>assertSongCatalogSource(rows,current));
  assert.throws(()=>assertSongCatalogSource([{...rows[0],level_4:10}],current),error=>error.statusCode===409);
  await writeFile(join(dir,'song_alias.json'),JSON.stringify([{...aliases[0],aliases:['changed alias']}]));const changed=await catalog();assert.notEqual(changed.revision,current.revision);assert.doesNotThrow(()=>assertSongCatalogSource(rows,changed));
  const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');assert.notEqual(hash(projectCatalog(rows,current.revision)),hash({songs:current.songs,charts:current.charts}),'old comparison reproduces alias mismatch');
 }finally{if(saved===undefined)delete globalThis.useRuntimeConfig;else globalThis.useRuntimeConfig=saved;await rm(dir,{recursive:true,force:true});}
});
