import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');
test('batch 1 exposes the intended API routes',async()=>{
 const [aliases,rating,b30,recommendations]=await Promise.all([read('../server/api/v1/taiko/catalog/aliases.get.ts'),read('../server/api/v1/taiko/players/[playerId]/rating.get.ts'),read('../server/api/v1/taiko/players/[playerId]/b30.get.ts'),read('../server/api/v1/taiko/players/[playerId]/recommendations.get.ts')]);
 assert.ok(aliases.includes("publicRead(event,'aliases')"));
 for(const source of [rating,b30,recommendations]){assert.ok(source.includes('apiHandler'));assert.ok(source.includes('privateAnalysis'));assert.ok(source.includes('conditional(event'));}
});
test('analysis delegates to installed algorithm and rechecks live score grant',async()=>{
 const source=await read('../server/services/developer-api-v1/analytics.ts');
 for(const name of ['build_player_rating_intelligence','build_ordinary_recommendation_intelligence','compute_all_from_userdata','withScoreRead','publication-v1:','TAIKO_COMPUTE_ONLY'])assert.ok(source.includes(name),name);
 assert.ok(source.split('proveGrant(').length-1>=4);
});
test('aliases use bounded source bytes and no-follow open',async()=>{
 const [catalog,reader]=await Promise.all([read('../server/services/developer-api-v1/catalog.ts'),read('../server/services/developer-api-v1/read.ts')]);
 for(const value of ['song_alias.json','O_NOFOLLOW','4*1024*1024'])assert.ok(catalog.includes(value),value);
 assert.ok(reader.includes("kind==='aliases'?await aliases():null"));
 assert.ok(reader.includes('a?.revision'));
});
