import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const {outputFiles}=await build({entryPoints:[root+'plugins/visit-beacon.client.ts'],bundle:true,write:false,format:'iife',platform:'browser',alias:{'~':root},logLevel:'silent'});
const flush=async()=>{for(let i=0;i<4;i++)await new Promise(r=>setImmediate(r));};
function client(send){
 const storage=new Map(),listeners=new Map(),timers=new Map(),watchers=[],hooks=new Map();let nextTimer=0,cleanup;
 const accountUser={value:null},route={value:{path:'/'}};
 let now=Date.parse('2026-11-20T04:00:00Z');
 class Clock extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
 const target={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
 const document={...target,visibilityState:'visible'};
 runInNewContext(outputFiles[0].text,{
  Date:Clock,performance:{now:()=>0},crypto:{randomUUID:()=> '3f2b8c1e-9a4d-4c7e-8b1a-2d3e4f5a6b7c'},AbortSignal,
  document,window:{...target,localStorage},navigator:{webdriver:false},fetch:send,
  setTimeout:(fn,delay)=>{timers.set(++nextTimer,{fn,delay});return nextTimer;},clearTimeout:id=>timers.delete(id),
  watch:(_source,fn)=>watchers.push(fn),useRouter:()=>({currentRoute:route}),useAccountAuthStatus:()=>({accountUser}),
  defineNuxtPlugin:fn=>fn({hook:(name,fn)=>hooks.set(name,fn),vueApp:{onUnmount:fn=>cleanup=fn}})
 });
 return {storage,timers,route,accountUser,
  interact:()=>listeners.get('pointerdown')?.({isTrusted:true}),
  syntheticInteract:()=>listeners.get('pointerdown')?.({isTrusted:false}),
  login:()=>{accountUser.value={id:42};for(const fn of watchers)fn(42,undefined);},
  navigate:()=>hooks.get('page:finish')?.(),
  nextDay:()=>{now+=86400000;listeners.get('visibilitychange')?.();},
  retry:()=>{const entry=[...timers].find(([,t])=>t.delay===15000);assert.ok(entry,'bounded retry scheduled');timers.delete(entry[0]);entry[1].fn();},
  cleanup:()=>cleanup?.()
 };
}

test('actual plugin retries failed persistence and only marks a confirmed visit',async()=>{
 let requests=0;const c=client(async()=>({status:++requests===1?503:204}));
 try{
  c.syntheticInteract();await flush();assert.equal(requests,0,'synthetic events do not qualify');
  c.interact();await flush();assert.equal(requests,1);assert.equal(c.storage.has('tv_visit_day'),false);
  c.retry();await flush();assert.equal(requests,2);assert.equal(c.storage.get('tv_visit_day'),'2026-11-20');
  c.interact();c.navigate();await flush();assert.equal(requests,2,'same-day duplicate suppressed');
  c.nextDay();await flush();assert.equal(requests,3,'returning to an open tab on a new day counts');
  assert.equal(c.storage.get('tv_visit_day'),'2026-11-21');
 }finally{c.cleanup();assert.equal(c.timers.size,0);}
});

test('login while an anonymous visit is in flight reattributes the same device',async()=>{
 let firstResolve;const requests=[];
 const c=client((_url,options)=>{requests.push(JSON.parse(options.body).d);return requests.length===1?new Promise(r=>firstResolve=r):Promise.resolve({status:204});});
 try{
  c.interact();c.login();await flush();assert.equal(requests.length,1);
  firstResolve({status:204});await flush();assert.equal(requests.length,2);
  assert.equal(requests[0],requests[1]);assert.equal(c.storage.get('tv_visit_day'),'2026-11-20:u');
 }finally{c.cleanup();}
});

test('offline retries are bounded and visiting the admin alone does not count',async()=>{
 let requests=0;const c=client(async()=>{requests++;throw new Error('offline');});
 try{
  c.route.value.path='/admin/taiko/dashboard';c.interact();await flush();assert.equal(requests,0);
  c.route.value.path='/';c.navigate();await flush();c.retry();await flush();c.retry();await flush();
  c.interact();c.navigate();await flush();assert.equal(requests,3);assert.equal(c.storage.has('tv_visit_day'),false);
  assert.equal([...c.timers.values()].filter(t=>t.delay===15000).length,0);
 }finally{c.cleanup();}
});
