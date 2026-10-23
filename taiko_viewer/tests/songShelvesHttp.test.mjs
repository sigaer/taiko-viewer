// Real public catalog H3 handler/service with an owned synthetic file. No DB.
import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:http';import {once} from 'node:events';import {mkdtemp,writeFile,rm,utimes,readFile} from 'node:fs/promises';import {resolve} from 'node:path';import {createApp,defineEventHandler,getQuery,setHeader,toNodeListener} from 'h3';import {qaTempPrefix} from './fixtures/qaPaths.mjs';import {installGoalSqlRuntime} from './fixtures/goalSqlRuntime.mjs';
test('other and removed catalog HTTP independently preserve shelf classification, search, paging and read recovery',async()=>{
 const root=await mkdtemp(qaTempPrefix('shelf-http-')),file=resolve(root,'catalog.json');let server,uninstall;const old={defineEventHandler:globalThis.defineEventHandler,getQuery:globalThis.getQuery,setHeader:globalThis.setHeader};
 try{
  const songs=[0,1,2].flatMap(shelf=>Array.from({length:26},(_,i)=>({id:shelf*100+i+1,song_name:'Synthetic shelf '+shelf+' '+i,song_name_jp:'合成の長い楽曲タイトル '+shelf+' '+i,type:'游戏音乐',shelf_status:i%2?String(shelf):shelf,level_4:9})));
  await writeFile(file,JSON.stringify(songs));uninstall=installGoalSqlRuntime({query:()=>{throw Error('No SQL allowed');}},{repoRoot:root,songDataPath:file,public:{}},{withRealCatalog:true});Object.assign(globalThis,{defineEventHandler,getQuery,setHeader});
  const handler=(await import('../server/api/content/songs.get.ts')).default;server=createServer(toNodeListener(createApp().use(handler)));server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
  const ask=async(q,status=200)=>{const response=await fetch(base+'/?view=list&pageSize=12&'+q,{signal:AbortSignal.timeout(5000)});assert.equal(response.status,status);return response.json();};
  for(const shelf of [2,1]){
   const first=await ask('shelfStatus='+shelf+'&page=1'),second=await ask('shelfStatus='+shelf+'&page=2'),last=await ask('shelfStatus='+shelf+'&page=3');assert.equal(first.total,26);assert.equal(first.songs.length,12);assert.equal(second.songs.length,12);assert.equal(last.songs.length,2);assert.ok([...first.songs,...second.songs,...last.songs].every(s=>Number(s.shelf_status)===shelf));assert.equal(new Set([...first.songs,...second.songs,...last.songs].map(s=>s.id)).size,26);
   const exact=await ask('shelfStatus='+shelf+'&keyword='+encodeURIComponent('Synthetic shelf '+shelf+' 25'));assert.equal(exact.total,1);assert.equal(exact.songs[0].id,shelf*100+26);
   const empty=await ask('shelfStatus='+shelf+'&keyword=NO_MATCH');assert.equal(empty.total,0);assert.equal(empty.songs.length,0);
  }
  await writeFile(file,'invalid synthetic catalog');await utimes(file,new Date(),new Date(Date.now()+2000));await ask('shelfStatus=2',500);await writeFile(file,JSON.stringify(songs));await utimes(file,new Date(),new Date(Date.now()+4000));assert.equal((await ask('shelfStatus=1')).total,26);
  const component=await readFile(new URL('../components/SongListContent.vue',import.meta.url),'utf8');assert.match(component,/el-empty v-if="!songs.length"/);
 }finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}uninstall?.();Object.assign(globalThis,old);await rm(root,{recursive:true,force:true});}
});
