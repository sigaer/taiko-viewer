// Real HTTP handlers and service validation; auth/storage dependencies are fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {createApp,toNodeListener,createError,getCookie,defineEventHandler} from 'h3';
import ts from 'typescript';
import {goalServiceHarness} from './fixtures/goalServiceHarness.mjs';
test('HTTP goal handlers require authentication and mark successes/errors private no-store',async()=>{
 const fixture=await goalServiceHarness();globalThis.__goalHttp={write:fixture.write,auth:async event=>{if(getCookie(event,'goal_test')!=='session')throw createError({statusCode:401});return {id:1}}};
 globalThis.defineEventHandler=defineEventHandler;
 const data=code=>`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
 const app=createApp();
 for(const suffix of ['post','delete']){
 const file=new URL(`../server/api/account/growth/goal.${suffix}.ts`,import.meta.url);
 let code=ts.transpileModule(await readFile(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 code=code.replace(/from ['"]([^'"]+)['"]/g,(_,name)=>`from ${JSON.stringify(name==='h3'?import.meta.resolve('h3'):data(name.includes('/utils/account')?'export const requireAccountUser=globalThis.__goalHttp.auth;':'export const writePlayerGoal=globalThis.__goalHttp.write;'))}`);
 app.use(`/${suffix}`,(await import(data(code))).default);
 }
 const server=createServer(toNodeListener(app));server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
 try{
 const call=(method,body,auth=true)=>fetch(`${base}/${method.toLowerCase()}`,{method,headers:{'Content-Type':'application/json',...(auth?{Cookie:'goal_test=session'}:{})},body:JSON.stringify(body)});
 const input={profileId:'1',expectedActiveGoalId:null,songId:100,difficultyType:4,goalType:'score-pb',scoreRevision:'revision'};
 for(const [payload,auth,status] of [[input,false,401],[{...input,ownerUserId:2},true,400],[{...input,songId:999},true,409],[input,true,200]]){
 const response=await call('POST',payload,auth);assert.equal(response.status,status);assert.match(response.headers.get('cache-control'),/private, no-store/);assert.equal(response.headers.get('vary'),'Cookie');await response.arrayBuffer();
 }
 const response=await call('DELETE',{profileId:'1',expectedActiveGoalId:fixture.state.active.id});assert.equal(response.status,200);assert.equal((await response.json()).activeGoal,null);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));fixture.cleanup();delete globalThis.__goalHttp;delete globalThis.defineEventHandler}
});
