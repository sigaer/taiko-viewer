import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp,defineEventHandler,toNodeListener,setResponseHeader} from 'h3';
import {createServer} from 'node:http';
import {mkdtemp,mkdir,writeFile,rm,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {captureCatalogAuthority} from '../server/services/content/catalogAuthority.ts';
import {getCatalogPythonEnv} from '../server/utils/taiko-python.ts';

test('actual H3 plugin pins HTTP headers and child environment across activation',async()=>{
 const root=await mkdtemp(join(process.env.QA_RUN_TMPDIR!,'catalog-http-'));
 const oldRoot=process.env.TAIKO_CATALOG_ROOT;process.env.TAIKO_CATALOG_ROOT=root;
 const a='c'.repeat(64),b='d'.repeat(64);
 const install=async(revision:string)=>{
  const body=JSON.stringify({schemaVersion:1,policyVersion:'wahlap-cn-1',catalogRevision:revision,songs:[],charts:{},aliases:{},searchAliases:[],sourceManifest:[]});
  await mkdir(join(root,'revisions',revision),{recursive:true});await writeFile(join(root,'revisions',revision,'catalog.json'),body);
  return {schemaVersion:1,policyVersion:'wahlap-cn-1',catalogRevision:revision,bytes:Buffer.byteLength(body),sha256:createHash('sha256').update(body).digest('hex')};
 };
 const first=await install(a),second=await install(b);
 await writeFile(join(root,'active.json'),JSON.stringify(first));await writeFile(join(root,'fetch-status.json'),'{}');
 const globals=globalThis as any;const previousPlugin=globals.defineNitroPlugin,previousHeader=globals.setResponseHeader;
 globals.defineNitroPlugin=(plugin:any)=>plugin;globals.setResponseHeader=setResponseHeader;
 const plugin=(await import('../server/plugins/catalog-revision.ts')).default;
 const app=createApp();let release!:()=>void;const changed=new Promise<void>(resolve=>{release=resolve;});
 app.use(defineEventHandler(async event=>{
  const before=await captureCatalogAuthority();
  if(event.path==='/first'){
   await writeFile(join(root,'next.json'),JSON.stringify(second));await rename(join(root,'next.json'),join(root,'active.json'));release();
   await new Promise(resolve=>setTimeout(resolve,15));
  }
  const after=await captureCatalogAuthority();const env=await getCatalogPythonEnv('/owned/runtime');
  return {before:before.data.catalogRevision,after:after.data.catalogRevision,childRevision:env.TAIKO_CATALOG_REVISION};
 }));
 plugin({h3App:app} as any);
 const server=createServer(toNodeListener(app));
 try{
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address() as {port:number};const url=`http://127.0.0.1:${address.port}`;
  const one=fetch(url+'/first');await changed;const two=fetch(url+'/second');
  for(const [response,revision] of [[await one,a],[await two,b]] as const){
   assert.equal(response.status,200);assert.equal(response.headers.get('x-catalog-revision'),revision);
   assert.equal(response.headers.get('x-catalog-policy-version'),'wahlap-cn-1');
   assert.deepEqual(await response.json(),{before:revision,after:revision,childRevision:revision});
  }
 }finally{
  server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
  globals.defineNitroPlugin=previousPlugin;globals.setResponseHeader=previousHeader;
  if(oldRoot===undefined)delete process.env.TAIKO_CATALOG_ROOT;else process.env.TAIKO_CATALOG_ROOT=oldRoot;
  await rm(root,{recursive:true,force:true});
 }
});
