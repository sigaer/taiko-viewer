import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createApp,toNodeListener,defineEventHandler,createError} from 'h3';
import ts from 'typescript';

const exec=promisify(execFile);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
const options={dani:[{version:'2025',grades:['六段']}],constants:{pass:['10'],comprehensive:['10']},stars:[9],named:['SS'],pages:{pass:{10:1},comprehensive:{10:1},star:{9:1},named:{SS:1}}};
let serial=0;
const data=source=>'data:text/javascript,'+encodeURIComponent(source);
async function fixture(task){
 const root=await mkdtemp('/var/tmp/progress-http-');const key=`__progress_test_${++serial}`;
 const state={root,binding:{taiko_id:'114514'},user:{id:1},readable:true,mode:'normal',children:[],logs:[],calls:[]};
 const original={error:console.error,createError:globalThis.createError,defineEventHandler:globalThis.defineEventHandler};
 globalThis[key]=state;globalThis.createError=createError;globalThis.defineEventHandler=defineEventHandler;
 console.error=(...args)=>state.logs.push(args);
 let server;
 try{
  state.execute=async(python,args,limits)=>{
   state.calls.push({args,limits});
   assert.equal(limits.timeout,120000);assert.equal(limits.killSignal,'SIGKILL');assert.equal(limits.maxBuffer,30*1024*1024);
   if(state.realPython){
    const guard=`import sys,os\ndef guard(event,args):\n if event in ('socket.connect','socket.getaddrinfo','sqlite3.connect'):raise AssertionError('External IO forbidden')\n if event=='open' and isinstance(args[0],(str,bytes)) and os.fsdecode(args[0]).startswith(('/home/sigaer/taiko/','/home/sigaer/git/','/etc/taiko','/root/.ossutil')):raise AssertionError('Production data forbidden')\nsys.addaudithook(guard)\n`;
    const command=exec(state.realPython,['-I','-c',guard+args[2],...args.slice(3)],{...limits,cwd:root,env:{...limits.env,TAIKO_RUNTIME_ENV_FILE:root+'/absent.env',TAIKO_COMPUTE_ONLY:'1',OPENBLAS_NUM_THREADS:'1',OMP_NUM_THREADS:'1'},timeout:15000});
    state.children.push(command.child);
    try{return await command;}catch(error){state.syntheticFailure=String(error.stderr||'').slice(-2000).replace(/\/(?:var\/tmp|home\/sigaer|opt\/taiko-bot)\/[^\s'"\n]+/g,'<fixture-path>');throw error;}
   }
   if(args[2].includes('available_pass_progress_keys')){
    if(state.mode==='bad-options')return {stdout:'not-json',stderr:''};
    return {stdout:JSON.stringify(options),stderr:''};
   }
   let output=png.toString('base64');
   if(state.mode==='bad-output')output=Buffer.from('private synthetic path /private/fixture').toString('base64');
   // The generated production Python dispatch runs unchanged, with only its
   // installed renderer dependency replaced by a tiny isolated recording port.
   const port=`import sys,types,base64\nm=types.ModuleType('taiko_bot.offline.viewer')\ndef render(*args,**kwargs):\n ${state.mode==='render-failure' ? "raise RuntimeError('synthetic-secret /private/fixture')" : state.mode==='timeout' ? "import time; time.sleep(10)" : `return base64.b64decode('${output}')`}\nfor n in ['render_dani_progress_image_bytes','render_pass_progress_image_bytes','render_progress_image_bytes','render_star_progress_image_bytes','render_progress_image_bytes_by_list']:setattr(m,n,render)\nsys.modules['taiko_bot']=types.ModuleType('taiko_bot');sys.modules['taiko_bot.offline']=types.ModuleType('taiko_bot.offline');sys.modules['taiko_bot.offline.viewer']=m\n`;
   const command=exec('/usr/bin/python3',['-I','-c',port+args[2],...args.slice(3)],{cwd:root,env:{PATH:process.env.PATH},encoding:'buffer',timeout:state.mode==='timeout'?80:3000,killSignal:'SIGKILL',maxBuffer:limits.maxBuffer});
   state.children.push(command.child);
   return await command;
  };
  const shared=data(`const s=globalThis[${JSON.stringify(key)}];export const getCurrentBindingRow=async()=>s.binding;export const getRuntimePaths=()=>({repoRoot:s.root,userdataDir:s.root+'/userdata'});export const getUserdataPath=()=>s.root+'/synthetic.json';export const execFileAsync=(...args)=>s.execute(...args);`);
  const fs=data(`export const access=async()=>{if(!globalThis[${JSON.stringify(key)}].readable)throw new Error('synthetic missing file');};`);
  let source=await readFile(new URL('../server/services/account/progress.ts',import.meta.url),'utf8');
  source=source.replace('"~/server/utils/taiko-python"',JSON.stringify(new URL('../server/utils/taiko-python.ts',import.meta.url).href))
   .replace('"node:fs/promises"',JSON.stringify(fs)).replace('"~/server/internal/account/shared"',JSON.stringify(shared))
   .replace('"./progress-errors"',JSON.stringify(new URL('../server/services/account/progress-errors.ts',import.meta.url).href));
  const service=await import(data(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText));
  const serviceKey=`${key}_service`;globalThis[serviceKey]=service;
  const account=data(`export const requireAccountUser=async()=>{const s=globalThis[${JSON.stringify(key)}];if(!s.user)throw globalThis.createError({statusCode:401,statusMessage:'Login required'});return s.user;};`);
  let route=await readFile(new URL('../server/api/account/progress/image.get.ts',import.meta.url),'utf8');
  route=route.replace('"h3"',JSON.stringify(import.meta.resolve('h3'))).replace('"~/server/utils/account"',JSON.stringify(account)).replace('"~/server/services/account/progress"',JSON.stringify(data(`export const getProgressImageBuffer=(...args)=>globalThis[${JSON.stringify(serviceKey)}].getProgressImageBuffer(...args);`)));
  const handler=(await import(data(ts.transpileModule(route,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText))).default;
  server=createServer(toNodeListener(createApp({onError:()=>{}}).use('/api/account/progress/image',handler)));
  server.listen(0,'127.0.0.1');await once(server,'listening');
  state.url=`http://127.0.0.1:${server.address().port}/api/account/progress/image`;
  state.request=query=>fetch(state.url+'?'+new URLSearchParams(query),{signal:AbortSignal.timeout(5000)});
  await task(state,service);
  delete globalThis[serviceKey];
 }finally{
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  for(const child of state.children){
   assert.ok(child.exitCode!==null||child.signalCode!==null,'worker must close before response settles');
   assert.throws(()=>process.kill(child.pid,0),{code:'ESRCH'});
  }
  console.error=original.error;globalThis.createError=original.createError;globalThis.defineEventHandler=original.defineEventHandler;delete globalThis[key];delete globalThis[`${key}_service`];
  await rm(root,{recursive:true,force:true});
 }
}

test('all progress families preserve returned PNG bytes and private response headers',{timeout:15000},()=>fixture(async s=>{
 for(const query of [{kind:'dani',version:'2025',grade:'六段'},{kind:'constant',mode:'pass',constant:'10'},{kind:'constant',mode:'comprehensive',constant:'10'},{kind:'star',star:9},{kind:'named',name:'SS'}]){
  const response=await s.request(query);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/image\/png/);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.ok(Buffer.from(await response.arrayBuffer()).equals(png),'PNG output changed');
 }
 assert.equal(s.logs.length,0);
}));
test('login, unbound source, missing data and invalid inputs retain distinct rejections',{timeout:15000},()=>fixture(async s=>{
 s.user=null;assert.equal((await s.request({kind:'star',star:9})).status,401);s.user={id:1};
 s.binding=null;assert.equal((await s.request({kind:'star',star:9})).status,400);s.binding={taiko_id:'114514'};
 s.readable=false;assert.equal((await s.request({kind:'star',star:9})).status,404);s.readable=true;
 for(const query of [{kind:'unknown'},{kind:'star',star:99},{kind:'dani',version:'2024',grade:'六段'},{kind:'constant',mode:'invalid',constant:'10'},...['1.5','NaN','Infinity','abc'].map(page=>({kind:'star',star:9,page}))])assert.equal((await s.request(query)).status,400);
 assert.equal(s.children.length,0,'business rejections must not launch renderers');
}));
test('renderer exception stays 500 with fixed diagnostics and no child details',{timeout:10000},()=>fixture(async s=>{
 s.mode='render-failure';const response=await s.request({kind:'star',star:9});assert.equal(response.status,500);
 const body=await response.text();assert.ok(!/synthetic-secret|\/private\/fixture|stderr|Traceback/.test(body));
 assert.ok(!/synthetic-secret|\/private\/fixture|Traceback/.test(JSON.stringify(s.logs)));
 assert.deepEqual(s.logs[0],['[progress-image]',{stage:'render-star',category:'worker_failure',exitCode:1}]);
}));
test('killed worker returns 503 only after process exit',{timeout:10000},()=>fixture(async s=>{
 s.mode='timeout';assert.equal((await s.request({kind:'star',star:9})).status,503);
 assert.equal(s.logs[0][1].category,'worker_killed');
}));
test('invalid image and invalid options output stay internal failures',{timeout:10000},async()=>{
 for(const mode of ['bad-output','bad-options'])await fixture(async s=>{
  s.mode=mode;const response=await s.request({kind:'star',star:9});assert.equal(response.status,500);
  assert.equal(s.logs[0][1].category,'invalid_output');assert.ok(!(await response.text()).includes('/private/fixture'));
 });
});
test('Python error categories never persist stderr, IDs or paths',async()=>{
 const {failProgressPython}=await import('../server/services/account/progress-errors.ts');
 const before=console.error,logs=[];console.error=(...args)=>logs.push(args);
 try{
  for(const [stderr,expected] of [["KeyError: 'fileName'",'history_contract'],['ModuleNotFoundError: secret','python_import'],['FileNotFoundError: /private/fixture','missing_input_or_asset'],['ValueError: synthetic-secret','python_value']]){
   assert.throws(()=>failProgressPython('render-dani',{code:1,stderr:Buffer.from(stderr)}),error=>error.statusCode===500&&!('stderr' in error)&&Object.keys(error.cause||{}).sort().join(',')==='message,statusCode,statusMessage');
   assert.equal(logs.at(-1)[1].category,expected);
  }
  assert.ok(!/synthetic-secret|\/private\/fixture/.test(JSON.stringify(logs)));
 }finally{console.error=before;}
});
test('HTTP route renders an installed wheel over synthetic canonical history, empty data and absent charts',
 {timeout:60000,skip:!process.env.TAIKO_PROGRESS_TEST_PYTHON||!process.env.TAIKO_PROGRESS_TEST_FIXTURE},()=>fixture(async s=>{
  await exec(process.env.TAIKO_PROGRESS_TEST_PYTHON,['-I',process.env.TAIKO_PROGRESS_TEST_FIXTURE,'--prepare-fixture',s.root],{timeout:10000,maxBuffer:1024*1024});
  s.realPython=process.env.TAIKO_PROGRESS_TEST_PYTHON;
  for(const [identity,version,grade] of [['114514','2025','六段'],['114516','2026','六段'],['114516','2026','五級']]){
   s.binding={taiko_id:identity};
   const response=await s.request({kind:'dani',version,grade});assert.equal(response.status,200,JSON.stringify({diagnostic:s.logs,syntheticFailure:s.syntheticFailure}));
   const bytes=Buffer.from(await response.arrayBuffer());assert.ok(bytes.length>1000);assert.ok(bytes.subarray(0,8).equals(png.subarray(0,8)));
  }
  assert.equal(s.logs.length,0);
 }));
