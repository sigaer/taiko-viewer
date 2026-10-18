import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {developerApis, developerApiExamples, developerGuideCopy, dimensionKeys} from '../utils/developer-api-guide.ts';
import {sanitizeDeveloperScores} from '../server/infrastructure/account/developer-score-dto.ts';
import {projectCatalog} from '@sakura-taiko/contract/catalog';
import {guideContract,validateGuideResponse} from './fixtures/developerGuideContract.mjs';

test('four static guides match OpenAPI paths, auth, response schemas and bilingual content',()=>{
 const contract=guideContract();assert.equal(contract.servers[0].url,'https://viewer.sakura-bot.cn');
 assert.deepEqual(developerApis.map(x=>x.id),['userdata','catalog','rating','recommendations']);
 for(const api of developerApis){
  const operation=contract.paths[api.path].get;
  assert.deepEqual(operation.security,api.protected?[{legacyDeveloperToken:[]}]:[]);
  assert.equal((operation.parameters||[]).length,api.protected?1:0);
  assert.equal(api.protected,api.id!=='catalog');
  validateGuideResponse(api.id,api.example);
  assert.deepEqual(operation.responses['200'].content['application/json'].example,api.example);
  for(const locale of ['zh','ja']){
   assert.ok(api.name[locale]&&api.purpose[locale]&&api.note[locale]&&api.errors[locale]);
   for(const field of api.fields)assert.ok(field.description[locale]);
   assert.ok(developerGuideCopy[locale].requiresApproval&&developerGuideCopy[locale].inactive);
  }
 }
 assert.deepEqual(developerApis[2].example.dimensions.map(x=>x.key),dimensionKeys);
});

test('JSON examples are real source projections, including nullable names and optional raw fields',()=>{
 const raw=developerApis[0].example;
 assert.deepEqual(sanitizeDeveloperScores({...raw,password:'synthetic',profile:{...raw.profile,token:'hidden'}}),raw);
 assert.deepEqual(sanitizeDeveloperScores({songs:null,dojo:null}),{songs:null,dojo:null});
 const catalog=developerApis[1].example;
 assert.deepEqual(projectCatalog([{id:10001,song_name:'合成歌曲',shelf_status:0}],catalog.versions.catalogRevision).songs,catalog.items);
});

test('curl and Python examples execute with placeholders, bounded waits and HTTP error handling',()=>{
 for(const api of developerApis){
  const {curl,python,json}=developerApiExamples(api);
  assert.deepEqual(JSON.parse(json),api.example);
  const expected='https://viewer.sakura-bot.cn'+api.path.replace('{userid}','SYNTHETIC_SOURCE');
  const shell=spawnSync('/bin/bash',['-euc','curl() { python3 -c \'import json,sys; print(json.dumps(sys.argv[1:]))\' "$@"; }; '+curl.replace("export TAIKO_SOURCE_ID='YOUR_SOURCE_ID'","export TAIKO_SOURCE_ID='SYNTHETIC_SOURCE'")],{env:{PATH:process.env.PATH,TAIKO_VIEWER_DEVELOPER_TOKEN:'SYNTHETIC_TOKEN'},encoding:'utf8',timeout:5000});
  assert.equal(shell.status,0);const args=JSON.parse(shell.stdout);assert.equal(args.at(-1),expected);assert.ok(args.includes(String(api.timeout)));
  assert.equal(args.includes('-H'),api.protected);if(api.protected)assert.ok(args.includes('Authorization: Bearer SYNTHETIC_TOKEN'));
  const harness=`import sys,types,os,json\nos.environ['TAIKO_SOURCE_ID']='SYNTHETIC_SOURCE'\nos.environ['TAIKO_VIEWER_DEVELOPER_TOKEN']='SYNTHETIC_TOKEN'\nclass HTTPError(Exception): pass\nclass RequestException(Exception): pass\nclass Reply:\n def raise_for_status(self):\n  if MODE=='http':\n   e=HTTPError(); e.response=types.SimpleNamespace(status_code=429);raise e\n def json(self):\n  if MODE=='json': raise ValueError()\n  return ${JSON.stringify({synthetic:true}).replace('true','True')}\ndef get(url,**kw):\n assert url==${JSON.stringify(expected)}\n assert kw['timeout']==(5,${api.timeout})\n assert kw.get('headers',{})==${api.protected?"{'Authorization':'Bearer SYNTHETIC_TOKEN'}":"{}"}\n if MODE=='network':raise RequestException()\n return Reply()\nsys.modules['requests']=types.SimpleNamespace(get=get,HTTPError=HTTPError,RequestException=RequestException)\n`;
  for(const mode of ['ok','http','network','json']){
   const run=spawnSync('/usr/bin/python3',['-c',`MODE=${JSON.stringify(mode)}\n`+harness+python],{encoding:'utf8',timeout:5000});
   assert.equal(run.status,mode==='ok'?0:1,api.id+' '+mode);
   if(mode==='ok')assert.deepEqual(JSON.parse(run.stdout),{synthetic:true});
   else assert.ok(run.stderr.length<200&& !run.stderr.includes('SYNTHETIC_TOKEN'));
  }
 }
});
