// Real guarded SQL, actual Python processes and configured private canonical root.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {manualSqlFixture as fixture,manualSourceSnapshot} from './fixtures/manualSqlRuntime.mjs';

const guard=`import os,sys
from pathlib import Path
owned=Path(os.environ["OWNED_PERSONAL_QA_ROOT"]).resolve()
def guard(event,args):
 if event=="socket.connect":raise PermissionError("Offline Python compute forbids network")
 if event in ("open","os.mkdir","os.remove","os.rmdir","os.rename"):
  for value in args[:2] if event=="os.rename" else args[:1]:
   if not isinstance(value,(str,bytes)):continue
   path=Path(os.fsdecode(value)).resolve()
   if any(path==Path(root) or Path(root) in path.parents for root in ("/home/sigaer/taiko/userdata","/home/sigaer/taiko-bot/userdata")):raise PermissionError("Production score access forbidden")
   mutation=event!="open" or (len(args)>2 and isinstance(args[2],int) and args[2]&(os.O_WRONLY|os.O_RDWR|os.O_CREAT|os.O_TRUNC|os.O_APPEND))
   if mutation and path!=Path("/dev/null") and path!=owned and owned not in path.parents:raise PermissionError("Write outside owned QA root forbidden")
sys.addaudithook(guard)
`;
async function ownedPython(c,task){
 const values={PYTHONPATH:c.root+':'+c.config.repoRoot,OWNED_PERSONAL_QA_ROOT:c.root,PYTHONDONTWRITEBYTECODE:'1',MPLCONFIGDIR:resolve(c.root,'mpl')};
 const prior=Object.fromEntries(Object.keys(values).map(key=>[key,process.env[key]]));
 await writeFile(resolve(c.root,'sitecustomize.py'),guard);
 Object.assign(process.env,values);
 try{return await task();}finally{for(const [key,value] of Object.entries(prior))value===undefined?delete process.env[key]:process.env[key]=value;}
}
async function populate(c){
 const config=JSON.parse(await readFile(resolve(c.config.repoRoot,'songs/rating_structured_with_ids.json'),'utf8'));
 const songs=Object.values(config.songs).slice(0,40).filter(chart=>Number(chart.combo)>0).map(chart=>{
  const total=Number(chart.combo),good=Math.floor(total*.96);
  return {song_no:Number(chart.id),level:Number(chart.level),good_cnt:good,ok_cnt:total-good-1,ng_cnt:1,high_score:900000,clear_cnt:1,stage_cnt:1,full_combo_cnt:0,dondaful_combo_cnt:0};
 });
 await c.shared.writeUserdataWithHistory(c.taikoId,{profile:{userid:c.taikoId,mydon_name:'Synthetic manual'},songs},'manual');
}
async function snapshot(c){return c.scopeModule.withDomainScoreRead(c.taikoId,async()=>({source:await manualSourceSnapshot(c),publication:c.scopeModule.scorePublication(c.taikoId)}));}

test('all four personal products and Growth run actual Python over the configured canonical root',{timeout:120000},()=>fixture(async c=>ownedPython(c,async()=>{
 await populate(c);
 const personal=await import('../server/services/account/personal.ts');
 const operations=[()=>personal.getPersonalRatingSummary(c.user),()=>personal.getPersonalRecommendations(c.user),()=>personal.getPersonalDimensionRecommendations(c.user,'stamina'),()=>personal.getTargetRecommendations(c.user,'full_combo','10'),
  ()=>c.scopeModule.withDomainScoreRead(c.taikoId,()=>personal.runGrowthPythonJson(c.taikoId,'FULL_HISTORY',3))];
 const before=await snapshot(c),expected=[];
 for(const operation of operations){const payload=await operation();delete payload.timing;expected.push(payload);}
 assert.ok(expected[0].sampleCount>20);assert.equal(expected[0].current,expected[0].overallRating);assert.equal(expected[0].scoreCount,expected[0].sampleCount);
 for(const payload of expected.slice(1,3))for(const item of payload.items){assert.equal(item.song_id,item.songId);assert.equal(item.is_unplayed,item.isUnplayed);}
 assert.ok(expected[4].playerState.sampleCount>20);
 const projection=resolve(c.config.userdataDir,c.taikoId+'data.json');
 await unlink(projection);
 for(let index=0;index<operations.length;index++){const payload=await operations[index]();delete payload.timing;assert.ok(JSON.stringify(payload)===JSON.stringify(expected[index]),'Actual Python DTO changed after projection loss');}
 await writeFile(projection,'{"songs":[]}');
 const payload=await operations[0]();assert.deepEqual(payload,expected[0]);
 assert.deepEqual(await snapshot(c),before);
}),{withPersonal:true,withRealPython:true}));

test('canonical corruption and child parse failures produce bounded public errors without paths or stderr',{timeout:60000},()=>fixture(async c=>ownedPython(c,async()=>{
 await populate(c);
 const personal=await import('../server/services/account/personal.ts');
 await assert.rejects(personal.runPythonJson(['invalid']),error=>error.statusCode===502&&error.statusMessage==='个人数据计算结果无效'&&Object.keys(error.cause||{}).sort().join(',')==='statusCode,statusMessage');
 const directory=resolve(c.config.userdataDir,'.taiko-publications',c.taikoId);
 const manifest=JSON.parse(await readFile(resolve(directory,'committed.json'),'utf8'));
 await writeFile(resolve(directory,'objects',manifest.files.current.sha256),'corrupt');
 for(const operation of [()=>personal.getPersonalRatingSummary(c.user),()=>personal.getTargetRecommendations(c.user,'full_combo'),()=>personal.runGrowthPythonJson(c.taikoId,'FULL_HISTORY')]){
  await assert.rejects(operation(),error=>error.statusCode===503&&error.statusMessage==='成绩数据暂不可用，请稍后重试'&&!('stderr' in error)&&!('cause' in error)&&!error.message.includes(c.root));
 }
}),{withPersonal:true,withRealPython:true}));
