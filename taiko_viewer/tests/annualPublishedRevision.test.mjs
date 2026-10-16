import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

test('actual saved-report reader preserves the old algorithm, identity and bytes after candidate upgrade',async()=>{
 const root=await mkdtemp('/var/tmp/annual-published-revision-');
 try{
  const source=await readFile(new URL('../server/services/account/annual-summary/index.ts',import.meta.url),'utf8');
  const start=source.indexOf('const safeReadSummary =');
  const end=source.indexOf('\n};',start)+3;
  assert.ok(start>=0&&end>start);
  const recovery=new URL('../server/services/account/annual-summary/build-recovery.ts',import.meta.url).href;
  const corrections=new URL('../server/services/account/annual-summary/manual-corrections.ts',import.meta.url).href;
  const version={startDate:'2025-10-09',endDate:'2026-09-30',effectiveEndDate:'2026-09-30',timezone:'Asia/Shanghai'};
  const modulePath=resolve(root,'reader.mjs');
  const code=`import {readFile} from 'node:fs/promises';
import {canReadAnnualSummary} from ${JSON.stringify(recovery)};
import {annualCorrectionsAreCurrent,annualManualEditTime} from ${JSON.stringify(corrections)};
const ANNUAL_SCHEMA_VERSION=4,ANNUAL_ALGORITHM_VERSION='annual-observation-v4.5.4';
const readAnnualSummary=async path=>JSON.parse(await readFile(path,'utf8'));
const findAnnualBinding=async(binding,user)=>binding===1&&user===1?{taiko_id:'synthetic'}:null;
const getRuntimePaths=()=>({userdataDir:${JSON.stringify(root)}});
const getAnnualVersion=()=>(${JSON.stringify(version)});
${source.slice(start,end)}
export {safeReadSummary};`;
  await writeFile(modulePath,ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
  const {safeReadSummary}=await import(pathToFileURL(modulePath).href);
  for(const algorithm of ['annual-observation-v4.5.2','annual-observation-v4.5.3','annual-observation-v4.5.4']){
   const path=resolve(root,algorithm+'.json');
   const report={summaryId:'published-'+algorithm,version,generatedAt:'2026-10-01T00:00:00Z',provenance:{algorithmVersion:algorithm}};
   const raw=JSON.stringify(report);await writeFile(path,raw);
   const row={schema_version:4,summary_path:path,binding_id:1,user_id:1};
   assert.deepEqual(await safeReadSummary(row),report);
   assert.equal(await safeReadSummary({...row,user_id:2}),null,'binding ownership remains required');
   assert.equal(await readFile(path,'utf8'),raw);
  }
 }finally{await rm(root,{recursive:true,force:true});}
});
