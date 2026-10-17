import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');
test('batch 1 exposes the intended API routes',async()=>{
 const [aliases,rating,b30,recommendations]=await Promise.all([read('../server/api/v1/taiko/catalog/aliases.get.ts'),read('../server/api/v1/taiko/players/[playerId]/rating.get.ts'),read('../server/api/v1/taiko/players/[playerId]/b30.get.ts'),read('../server/api/v1/taiko/players/[playerId]/recommendations.get.ts')]);
 assert.match(aliases,/publicRead\\(event,'aliases'\\)/);
 for(const source of [rating,b30,recommendations]){assert.match(source,/apiHandler/);assert.match(source,/privateAnalysis/);assert.match(source,/conditional\\(event/);}
});
test('analysis delegates to installed algorithm and rechecks live score grant',async()=>{
 const source=await read('../server/services/developer-api-v1/analytics.ts');
 assert.match(source,/build_player_rating_intelligence/);assert.match(source,/build_ordinary_recommendation_intelligence/);assert.match(source,/compute_all_from_userdata/);assert.ok((source.match(/proveGrant\\(/g)||[]).length>=4);assert.match(source,/withScoreRead/);assert.match(source,/publication-v1:/);assert.match(source,/TAIKO_COMPUTE_ONLY/);
});
test('aliases use bounded source bytes and no-follow open',async()=>{
 const [catalog,reader]=await Promise.all([read('../server/services/developer-api-v1/catalog.ts'),read('../server/services/developer-api-v1/read.ts')]);
 assert.match(catalog,/song_alias\\.json/);assert.match(catalog,/O_NOFOLLOW/);assert.match(catalog,/4\\*1024\\*1024/);assert.match(reader,/kind==='aliases'\\?await aliases\\(\\):null/);assert.match(reader,/a\\?\\.revision/);
});
