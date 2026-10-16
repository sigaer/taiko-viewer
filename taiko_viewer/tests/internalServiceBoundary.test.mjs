// Production handler/guard execution with synthetic H3 and business adapters.
// No SQL, filesystem mutation, network, runtime config file or production token.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {timingSafeEqual} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
const root=new URL('../',import.meta.url);
const source=path=>readFileSync(new URL(path,root),'utf8');
function compile(text,globals,imports={}){
 const exports={};
 const code=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require:name=>{assert.ok(Object.hasOwn(imports,name),'Unexpected dependency');return imports[name];},...globals},{timeout:1000});
 return exports;
}
function fixture(route,configured='synthetic-service-key'){
 const state={bodyReads:0,effects:[],limits:0};
 const globals={Buffer,timingSafeEqual,process:{env:{}},useRuntimeConfig:()=>({botServiceToken:configured}),
  getHeader:(event,name)=>event.headers[name],createError:props=>Object.assign(new Error('Synthetic public error'),props),defineEventHandler:handler=>handler};
 // Extract the exact declared production guard, avoiding unrelated module startup.
 const text=source('server/utils/account/manual.ts'),ast=ts.createSourceFile('manual.ts',text,ts.ScriptTarget.Latest,true);
 const declarations=ast.statements.filter(ts.isVariableStatement).filter(node=>node.declarationList.declarations.some(d=>d.name.getText(ast)==='requireBotService'));
 assert.equal(declarations.length,1);
 const {requireBotService}=compile(declarations[0].getText(ast),globals);
 const business=new Proxy({requireBotService},{get(target,name){if(name in target)return target[name];return async(...args)=>{state.effects.push({name,args});return {ok:true};};}});
 const handler=compile(source('server/api/taiko/internal/'+route+'.post.ts'),globals,{
  h3:{readBody:async event=>{state.bodyReads++;return event.body;},setHeader:()=>{}},
  '~/server/utils/account':business,'~/server/utils/account/manual':business,
  '~/server/services/account/annual-summary/bot':business,
  '~/server/utils/rate-limit':{createMemoryRateLimiter:()=>()=>{state.limits++;}}
 }).default;
 return {state,ask:(headers={},body={action:'create',identityKey:'onebot_v11:12345'})=>handler({headers,body})};
}
for(const route of ['manual','annual-card']){
 test(route+' rejects anonymous, developer/session impersonation and wrong service keys before body or effects',async()=>{
  for(const headers of [{},{authorization:'Bearer synthetic-developer'},{cookie:'synthetic-session'},
   {'x-taiko-bot-token':'wrong'},{'x-taiko-bot-token':'synthetic-service-kez'}]){
   const c=fixture(route);await assert.rejects(c.ask(headers),error=>error.statusCode===401);
   assert.equal(c.state.bodyReads,0);assert.equal(c.state.effects.length,0);assert.equal(c.state.limits,0);
  }
 });
 test(route+' missing configuration denies even a supplied service token',async()=>{
  const c=fixture(route,'');await assert.rejects(c.ask({'x-taiko-bot-token':'synthetic-service-key'}),error=>error.statusCode===401);
  assert.equal(c.state.effects.length,0);assert.equal(c.state.bodyReads,0);
 });
 test(route+' configured service reaches only the intended business adapter',async()=>{
  const c=fixture(route);await c.ask({'x-taiko-bot-token':'synthetic-service-key'});
  assert.equal(c.state.bodyReads,1);assert.equal(c.state.effects.length,1);
  assert.equal(c.state.effects[0].name,route==='manual'?'createManualAccount':'getBotAnnualCard');
 });
}
test('authenticated manual unknown action cannot mutate business state',async()=>{
 const c=fixture('manual');await assert.rejects(c.ask({'x-taiko-bot-token':'synthetic-service-key'},{action:'unknown'}),error=>error.statusCode===400);
 assert.equal(c.state.effects.length,0);
});
