// Bounded, one-file-at-a-time audit of the candidate parser. No production writes.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createGzip} from 'node:zlib';
import {once} from 'node:events';
import {build} from '../../../taiko_viewer/node_modules/esbuild/lib/main.js';
const base='/var/tmp/taiko-batch2-20261124';
const viewer=base+'/integration/taiko_viewer';
const root='/home/sigaer/git/ESE_autosync';
const supplemental='/home/sigaer/taiko/assets/catalog_sources';
const out=base+'/integration/docs/catalog-release-batch2-20261124/timeline';
await fsp.mkdir(out,{recursive:true});
const bundle=process.env.QA_RUN_TMPDIR+'/parser.mjs';
await build({stdin:{contents:"export {parseTJA} from './vendor/tja/TJARenderer/src/tja-parser.ts'; export {barIntervalMs} from './vendor/tja/TJAAnalyzer/src/utils/bar-timeline.ts';",resolveDir:viewer,loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:bundle});
const {parseTJA,barIntervalMs}=await import('file://'+bundle);
const hash=b=>createHash('sha256').update(b).digest('hex');
const sourceFiles=['vendor/tja/TJARenderer/src/tja-parser.ts','vendor/tja/TJARenderer/src/primitives.ts','vendor/tja/TJAAnalyzer/src/utils/bar-timeline.ts'];
const version={viewerCandidate:'26930740',scannerVersion:'batch2-3',files:Object.fromEntries(sourceFiles.map(x=>[x,hash(fs.readFileSync(viewer+'/'+x))]))};
const known=new Set(['START','END','BPMCHANGE','BPM:','DELAY','MEASURE','SCROLL','GOGOSTART','GOGOEND','BARLINEON','BARLINEOFF','BRANCHSTART','BRANCHEND','N','E','M']);
function timeline(chart){
 let cursor=0;const events=[];let count=0,big=0,roll=0,balloon=0;let active=null;const diagnostics=[];
 for(let b=0;b<chart.bars.length;b++){
  const notes=chart.bars[b],params=chart.barParams[b],slots=Math.max(notes.length,1);
  for(const [kind,key] of [['BPM','bpmChanges'],['DELAY','delayChanges']])for(const change of params[key]??[]){
   const changesBefore=(params.delayChanges??[]).filter(d=>d.index<change.index);
   const changesThrough=(params.delayChanges??[]).filter(d=>d.index<=change.index);
   events.push({kind,bar:b,slot:change.index,timeMs:null,boundaryBeforeDelayMs:cursor+barIntervalMs({...params,delayChanges:changesBefore},slots,0,change.index,true),boundaryAfterDelayMs:cursor+barIntervalMs({...params,delayChanges:changesThrough},slots,0,change.index,true),ordering:'raw source command order retained separately; same-slot command instants unverified',...change});
  }
  events.push({kind:'MEASURE',bar:b,ratio:params.measureRatio,timeMs:cursor});
  for(let i=0;i<notes.length;i++){
   const type=notes[i];if(type==='0')continue;
   const timeMs=cursor+barIntervalMs(params,slots,0,i,true);
   events.push({kind:'NOTE',bar:b,slot:i,type,timeMs});
   if('1234'.includes(type)){count++;if('34'.includes(type))big++;}
   if('5679'.includes(type)){
    if(active)diagnostics.push('LONG_NOTE_OVERLAP');
    active={type,startMs:timeMs};if('56'.includes(type))roll++;else balloon++;
   }
   if(type==='8'){
    if(!active)diagnostics.push('ORPHAN_LONG_NOTE_END');else events.push({kind:'LONG_NOTE_SPAN',type:active.type,startMs:active.startMs,endMs:timeMs});
    active=null;
   }
  }
  cursor+=barIntervalMs(params,slots,0,slots,true);
 }
 if(active)diagnostics.push('UNCLOSED_LONG_NOTE');
 if(!Number.isFinite(cursor)||events.some(e=>e.timeMs!==undefined&&e.timeMs!==null&&!Number.isFinite(e.timeMs)))diagnostics.push('NONFINITE_TIMELINE');
 return {noteCount:count,bigNotes:big,rolls:roll,balloons:balloon,balloonMetadata:chart.balloonCounts,chartRelativeDurationMs:cursor,eventTimeline:events,diagnostics};
}
function scan(raw,source){
 const diagnostics=[];let text,encoding='utf-8';
 try{text=new TextDecoder('utf-8',{fatal:true}).decode(raw)}catch{
  try{text=new TextDecoder('shift_jis',{fatal:true}).decode(raw);encoding='shift_jis';diagnostics.push('LEGACY_ENCODING_NOT_INDEPENDENTLY_VERIFIED')}catch{return {source,sourceHash:hash(raw),status:'INVALID',diagnostics:['UNDECODABLE'],parserVersion:version}};
 }
 const commands=[];let starts=0,ends=0;const courses=[];
 for(const [index,original] of text.split(/\r?\n/).entries()){
  const line=original.split('//')[0].trim();
  if(/^COURSE:/i.test(line))courses.push({line:index+1,value:line.slice(7).trim()});
  if(line.startsWith('#')){const command=line.slice(1).split(/[\s,]+/)[0].toUpperCase();commands.push({line:index+1,command,args:line.slice(command.length+1).trim()});if(command==='START')starts++;if(command==='END')ends++;}
 }
 if(starts!==ends||starts===0)diagnostics.push('UNBALANCED_START_END');
 const unsupported=[...new Set(commands.map(x=>x.command).filter(x=>!known.has(x)))];
 if(unsupported.length)diagnostics.push('UNVERIFIED_COMMANDS:'+unsupported.join(','));
 if(commands.some(x=>x.command==='BRANCHSTART'))diagnostics.push('STATIC_BRANCH_PATHS_ONLY_DYNAMIC_SELECTION_UNVERIFIED');
 if(commands.some(x=>x.command==='LEVELHOLD'))diagnostics.push('DYNAMIC_LEVELHOLD_UNVERIFIED');
 const result={source,sourceHash:hash(raw),bytes:raw.length,encoding,parserVersion:version,courseHeaders:courses,rawCommands:commands.filter(x=>['BPMCHANGE','DELAY','MEASURE','BRANCHSTART','BRANCHEND','LEVELHOLD'].includes(x.command)),offsetHeaders:text.split(/\r?\n/).map((s,i)=>({s,i})).filter(x=>/^OFFSET:/i.test(x.s.trim())).map(x=>({line:x.i+1,value:x.s.trim().slice(7)})),absoluteMusicAlignment:{status:'UNVERIFIED',absoluteTimes:null},diagnostics,courses:{}};
 try{
  const parsed=parseTJA(text);const entries=Object.entries(parsed);
  if(!entries.length){diagnostics.push('NO_PARSED_COURSES');result.status=starts===ends&&starts>0?'UNSUPPORTED':'INVALID';return result;}
  for(const [course,chart] of entries){
   const paths=chart.branches??{unbranched:chart};const value={course:chart.course,level:chart.level,bpm:chart.bpm,offset:chart.headers.OFFSET??null,paths:{}};
   for(const [branch,p] of Object.entries(paths)){const t=timeline(p);value.paths[branch]=t;if(t.diagnostics.length)diagnostics.push(...t.diagnostics.map(x=>course+'/'+branch+':'+x));}
   if(chart.playerSides){diagnostics.push('PLAYER_SIDE_SEMANTICS_UNVERIFIED');value.playerSides=Object.keys(chart.playerSides);}
   result.courses[course]=value;
  }
  result.status=diagnostics.some(x=>x==='UNBALANCED_START_END'||x.endsWith('NONFINITE_TIMELINE'))?'INVALID':diagnostics.length?'PARTIAL':'COMPLETE';
 }catch(error){result.status='INVALID';diagnostics.push('PARSER_EXCEPTION:'+String(error.message).slice(0,180));}
 result.completeScope='candidate static chart-relative note/event representation only; absolute music alignment is never implied';
 return result;
}
const golden=[
 {name:'constant',body:'10001000,',expected:[0,1000]},
 {name:'mid-bar-bpm',body:'10\n#BPMCHANGE 240\n001000,',expected:[0,750]},
 {name:'delay',body:'10\n#DELAY 1\n001000,',expected:[0,2000]},
 {name:'fractional-negative-delay',body:'10\n#DELAY -.25\n001000,',expected:[0,750]},
 {name:'measure-three-quarter',body:'#MEASURE 3/4\n30004000,',expected:[0,750]},
 {name:'roll-balloon',headers:'BALLOON:5',body:'15008001,\n17008001,',expected:[0,1750,2000,3750]},
];
const goldenResults=[];
for(const g of golden){
 const text=`TITLE:Golden\nBPM:120\nOFFSET:1.5\n${g.headers??''}\nCOURSE:Oni\nLEVEL:1\n#START\n${g.body}\n#END`;
 const result=scan(Buffer.from(text),'synthetic:'+g.name);if(result.status!=='COMPLETE')throw new Error('Golden status mismatch '+g.name+' '+result.status);const actual=result.courses.oni.paths.unbranched.eventTimeline.filter(e=>e.kind==='NOTE'&&'1234'.includes(e.type)).map(e=>e.timeMs);
 if(JSON.stringify(actual)!==JSON.stringify(g.expected))throw new Error('Golden mismatch '+g.name+' '+JSON.stringify({actual,expected:g.expected}));
 goldenResults.push({...g,tja:text,result,oracle:'independent hand calculation; beat duration 60/BPM seconds, 4 beats per 4/4 bar'});
}
fs.writeFileSync(out+'/golden-corpus.json',JSON.stringify({parserVersion:version,cases:goldenResults,absoluteAlignment:'UNVERIFIED',dynamicLevelhold:'UNVERIFIED'},null,2)+'\n');
if(process.argv.includes('--golden-only'))process.exit(0);
const files=[];
async function walk(dir){for(const entry of await fsp.readdir(dir,{withFileTypes:true})){if(entry.name.startsWith('.'))continue;const p=path.join(dir,entry.name);if(entry.isDirectory())await walk(p);else if(entry.isFile()&&entry.name.toLowerCase().endsWith('.tja'))files.push(p);if(files.length>10000)throw Error('file count budget');}}
await walk(root);await walk(supplemental);files.sort();
const artifact=base+'/evidence/full-tja-scan.jsonl.gz';const target=fs.createWriteStream(artifact);const gzip=createGzip({level:6});gzip.pipe(target);
const index=[];const counts={COMPLETE:0,PARTIAL:0,UNSUPPORTED:0,INVALID:0};const diagnosticCounts={};const deadline=Date.now()+480000;
try{
 for(const file of files){
  if(Date.now()>deadline)throw Error('scan deadline');
  const info=await fsp.stat(file);if(info.size>2*1024*1024)throw Error('single TJA size budget');
  const raw=await fsp.readFile(file);const result=scan(raw,file.startsWith(root+'/')?'ESE/'+path.relative(root,file):'supplemental/'+path.relative(supplemental,file));
  const after=await fsp.stat(file);result.stableSource=info.size===after.size&&info.mtimeMs===after.mtimeMs&&info.ino===after.ino;
  if(!result.stableSource){result.status='PARTIAL';result.diagnostics.push('SOURCE_CHANGED_DURING_SCAN');}
  counts[result.status]++;
  for(const d of result.diagnostics)diagnosticCounts[d]=(diagnosticCounts[d]??0)+1;
  index.push({source:result.source,sourceHash:result.sourceHash,status:result.status,bytes:result.bytes,course:Object.keys(result.courses??{}),diagnostics:result.diagnostics});
  if(!gzip.write(JSON.stringify(result)+'\n'))await once(gzip,'drain');
 }
 gzip.end();await once(target,'finish');
}catch(error){gzip.destroy();target.destroy();throw error;}
const artifactHash=await new Promise((resolve,reject)=>{const h=createHash('sha256'),s=fs.createReadStream(artifact);s.on('data',c=>h.update(c));s.on('end',()=>resolve(h.digest('hex')));s.on('error',reject)});
fs.writeFileSync(out+'/file-index.json',JSON.stringify(index,null,2)+'\n');
const summary={qaRun:process.env.QA_RUN_ID,sourceRoots:[root,supplemental],files:files.length,expectedFiles:3003,expectedCountMatches:files.length===3003,counts,diagnosticCounts,parserVersion:version,artifact:{path:artifact,sha256:artifactHash,bytes:fs.statSync(artifact).size},goldenCases:goldenResults.length,completeDefinition:'Only static chart-relative semantics with no detected diagnostic; absolute audio alignment and dynamic branch selection excluded for every file'};
fs.writeFileSync(out+'/scan-summary.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
