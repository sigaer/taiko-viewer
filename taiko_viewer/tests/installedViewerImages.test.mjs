// Actual Viewer charts callsite -> installed wheel PNG -> real Sharp JPEG.
// Direct installed adapter oracle is callsite parity, not frozen algorithm parity.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
import {getTaikoPython,getTaikoPythonEnv} from '../server/utils/taiko-python.ts';
const execFileResult=promisify(execFile),nativeRequire=createRequire(import.meta.url);
async function execute(executable,args,options){
 try{return await execFileResult(executable,args,options);}
 catch(error){
  // Do not retain the execFile error: Node's test reporter prints cmd/stdout/
  // stderr Buffer objects. Slice bytes before decoding and report no cause.
  const stderr=Buffer.isBuffer(error?.stderr)?error.stderr.subarray(-2048).toString('utf8'):
   typeof error?.stderr==='string'?error.stderr.slice(-2048):'';
  const exit=Number.isInteger(error?.code)?error.code:'spawn-failure';
  const signal=typeof error?.signal==='string'?error.signal.slice(0,20):null;
  throw new Error(JSON.stringify({imageWorker:'failed',exit,signal,stderr}));
 }
}
const digest=value=>createHash('sha256').update(value).digest('hex');
const viewerRoot=new URL('../',import.meta.url);

test('Viewer B30, dimension and radar callsites match independent installed PNG adapter output',{timeout:240000},async()=>{
 const root=await mkdtemp('/var/tmp/viewer-installed-images-');
 const python=getTaikoPython();assert.ok(python.startsWith('/var/tmp/'),'Select installed QA role interpreter');
 const env={...getTaikoPythonEnv(root),TAIKO_USERDATA_DIR:join(root,'userdata'),TAIKO_RUNTIME_ENV_FILE:join(root,'absent.env'),MPLCONFIGDIR:join(root,'mpl')};
 const files=[],outputs=[];
 try{
  await execute(python,['-I',fileURLToPath(new URL('./fixtures/installedImageRoot.py',import.meta.url)),root,fileURLToPath(new URL('./fixtures/installedRuntimeCatalog.json',import.meta.url))],{cwd:root,env,timeout:30000,maxBuffer:32768});
  const shared={getCurrentBindingRow:async()=>({taiko_id:'111'}),getRuntimePaths:()=>({repoRoot:root,userdataDir:join(root,'userdata')}),getUserdataPath:()=>join(root,'userdata','111data.json'),
   execFileAsync:async(executable,args,options)=>{
    assert.equal(executable,python);assert.equal(args[0],'-I');assert.equal(options.env.PYTHONPATH,undefined);
    const result=await execute(executable,args,{...options,env:{...options.env,...env},maxBuffer:12*1024*1024});
    assert.equal(result.stdout.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    outputs.push(result.stdout);return result;
   }};
  const text=await readFile(new URL('server/services/account/charts.ts',viewerRoot),'utf8');
  const code=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const exports={};
  vm.runInNewContext(code,{exports,Buffer,console,createError:props=>Object.assign(new Error('Synthetic binding error'),props),require:name=>{
   if(name==='~/server/internal/account/shared')return shared;
   if(name==='~/server/utils/taiko-python')return {getTaikoPython,getTaikoPythonEnv};
   if(name==='sharp')return {default:sharp};
   if(name.startsWith('node:'))return nativeRequire(name);
   throw new Error('Unexpected charts dependency');
  }},{timeout:1000});
  for(const [name,options,expression] of [
   ['b30',{n:30},'v.render_b30_image(111,N=30)'],
   ['dimension',{n:20,dim:'精度'},"v.generate_dim_top_image(v.compute_all_from_userdata(111),N=20,dim='accuracy_power',user_id=111,font_path='assets/fonts/DDFont.ttf')"],
   ['radar',{n:20,dynamicOrigin:true},"v.generate_top_N_image(v.compute_all_from_userdata(111),20,user_id=111,dynamic_origin=True,font_path='assets/fonts/DDFont.ttf')"]
  ]){
   const jpeg=await exports.getB30ImageBuffer(1,options),actual=outputs.pop();
   assert.equal(jpeg.subarray(0,2).toString('hex'),'ffd8');
   const program=`import sys\nfrom contextlib import redirect_stdout\nfrom io import StringIO\nfrom taiko_bot.offline import viewer as v\nwith redirect_stdout(StringIO()):\n result=${expression}\nsys.stdout.buffer.write(result.getvalue() if hasattr(result,'getvalue') else result)`;
   const {stdout:expected}=await execute(python,['-I','-c',program],{cwd:root,env,encoding:'buffer',timeout:120000,maxBuffer:12*1024*1024});
   assert.equal(digest(actual),digest(expected),name+' installed PNG callsite mismatch');
   const metadata=await sharp(actual).metadata();assert.ok(metadata.width>100&&metadata.height>100);
   files.push({consumer:name,pngSha256:digest(actual),jpegSha256:digest(jpeg),width:metadata.width,height:metadata.height});
  }
  console.log(JSON.stringify({scope:'installed Viewer image callsite parity; synthetic assets; no frozen algorithm claim',outputs:files}));
 }finally{await rm(root,{recursive:true,force:true});}
});
