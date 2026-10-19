import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {publishRelease} from '../../scripts/release/publish-viewer-release.mjs';
import {validateGuideResponse} from './fixtures/developerGuideContract.mjs';
const require=createRequire(import.meta.url),yaml=require('yaml');
const commit='a'.repeat(40),version='0.85.0',notes='Reviewed synthetic release notes';
const options={repository:'sigaer/taiko-viewer',version,commit,token:'synthetic-ephemeral-key',notes};
const release={tag_name:version,body:notes,draft:false,prerelease:false,html_url:'https://github.com/sigaer/taiko-viewer/releases/tag/0.85.0'};
function transport({wrongTag=false,existing=404,lookupStatus=200}={}){
 const calls=[];
 const request=async(url,init)=>{
  const path=new URL(url).pathname;calls.push({path,method:init.method,body:init.body&&JSON.parse(init.body)});
  assert.equal(init.headers.authorization,'Bearer '+options.token);
  if(path.includes('/git/ref/'))return Response.json({object:{type:'tag',sha:'b'.repeat(40)}});
  if(path.includes('/git/tags/'))return Response.json({object:{type:'commit',sha:wrongTag?'c'.repeat(40):commit}});
  if(path.includes('/releases/tags/'))return typeof existing==='number'?new Response(null,{status:existing}):Response.json(existing,{status:lookupStatus});
  assert.equal(path,'/repos/sigaer/taiko-viewer/releases');assert.equal(init.method,'POST');
  return Response.json(release,{status:201});
 };
 return {request,calls};
}
test('stable publisher verifies annotated tag then creates a non-prerelease on the verified commit',async()=>{
 const t=transport();assert.deepEqual(await publishRelease({...options,request:t.request}),release);
 const post=t.calls.at(-1);assert.deepEqual(post.body,{tag_name:version,target_commitish:commit,name:'Viewer 0.85.0',body:notes,draft:false,prerelease:false,make_latest:'true'});
 assert.equal(t.calls.length,4);
});
test('stable publisher rejects wrong tag targets before any release mutation',async()=>{
 const t=transport({wrongTag:true});await assert.rejects(publishRelease({...options,request:t.request}),/verified release commit/);
 assert.equal(t.calls.length,2);assert.ok(t.calls.every(x=>x.method==='GET'));
});
test('matching existing release is idempotent without rewriting it',async()=>{
 const t=transport({existing:release});assert.deepEqual(await publishRelease({...options,request:t.request}),release);assert.ok(t.calls.every(x=>x.method==='GET'));
});
for(const changed of [{prerelease:true},{draft:true},{body:'Unreviewed notes'}])test('existing release mismatch is never overwritten: '+Object.keys(changed)[0],async()=>{
 const t=transport({existing:{...release,...changed}});await assert.rejects(publishRelease({...options,request:t.request}));assert.ok(t.calls.every(x=>x.method==='GET'));
});
test('publisher fails closed for lookup authorization errors and candidate versions',async()=>{
 const t=transport({existing:403});await assert.rejects(publishRelease({...options,request:t.request}),/403/);assert.ok(t.calls.every(x=>x.method==='GET'));
 await assert.rejects(publishRelease({...options,version:'0.85.0-rc.8',request:t.request}));
});
test('reviewed release JSON, examples, workflow and current documentation metadata agree',async()=>{
 const read=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
 const text=await read('docs/releases/0.85.0.md');
 const json=[...text.matchAll(/```json\n([\s\S]*?)\n```/g)].map(x=>JSON.parse(x[1]));assert.equal(json.length,1);validateGuideResponse('catalog',json[0]);
 for(const song of json[0].items)for(const chart of song.charts)assert.deepEqual(Object.keys(chart),['difficulty','level']);
 for(const script of [...text.matchAll(/```sh\n([\s\S]*?)\n```/g)])execFileSync('/bin/bash',['-n'],{input:script[1]});
 for(const script of [...text.matchAll(/```python\n([\s\S]*?)\n```/g)])execFileSync('/usr/bin/python3',['-c','import ast,sys;ast.parse(sys.stdin.read())'],{input:script[1]});
 const pkg=JSON.parse(await read('taiko_viewer/package.json'));
 for(const file of ['docs/developer-api-batch1-openapi.yaml','docs/083-developer-api-openapi.yaml']){
  const doc=yaml.parse(await read(file));assert.equal(doc.info.version,pkg.version);assert.equal(doc.servers[0].url,'https://viewer.sakura-bot.cn');
  assert.equal(doc.paths['/api/v1/taiko/catalog/charts'],undefined);
 }
 const workflow=yaml.parse(await read('.github/workflows/viewer-stable-release.yml'));
 assert.deepEqual(workflow.on.push.tags,['0.85.0']);assert.equal(workflow.permissions.contents,'write');assert.equal(workflow.on.pull_request,undefined);
 assert.ok(workflow.jobs.release.steps.some(x=>x.env?.GITHUB_TOKEN==='${{ github.token }}'));
});
