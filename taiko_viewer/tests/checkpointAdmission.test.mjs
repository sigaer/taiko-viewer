import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {admitSyntheticCheckpoint} from '../../scripts/readiness/checkpoint-admission.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const clone=value=>JSON.parse(JSON.stringify(value));
function fixture(){
 const publication={source:'synthetic-owner',sequence:3,commitId:'a'.repeat(32)};
 const files={current:{'current.json':hash('score3')},history:{'history/observation3.json':hash('observation3')},dailyArchive:{'daily/measurement-v1.json':hash('historical measurement')},annual:{'annual/report-v4.5.3.json':hash('frozen report')}};
 const manifest={schema:1,checkpointId:'b'.repeat(32),committedAt:'2026-10-16T02:48:38.219Z',writerState:'QUIESCED_COMMITTED',sqlSha256:hash('SQL generation 3 including Goal/measurement/grant/Annual identities'),publication,sqlPublication:clone(publication),files,revocationContinuity:'PROVEN'};
 const observed=clone(manifest),manifestRaw=JSON.stringify(manifest);
 return {manifest,observed,manifestRaw,trustedManifestSha256:hash(manifestRaw)};
}
const reject=(f,code)=>{const result=admitSyntheticCheckpoint(f);assert.equal(result.status,'REJECT');assert.ok(result.failures.includes(code),code);};
test('trusted committed manifest binds exact SQL, publication and historical file inventory',()=>assert.equal(admitSyntheticCheckpoint(fixture()).status,'ADMIT_SCOPED'));
test('SQL from another checkpoint is rejected even when file inventory matches',()=>{const f=fixture();f.observed.sqlSha256=hash('SQL generation 4');reject(f,'SQL_HASH_MISMATCH');});
test('SQL and filesystem publication generation cannot disagree',()=>{const f=fixture();f.observed.sqlPublication.sequence=4;reject(f,'CROSS_GENERATION_PUBLICATION');});
test('same sequence with a different commit identity cannot pass',()=>{const f=fixture();f.observed.publication.commitId='c'.repeat(32);reject(f,'CROSS_GENERATION_PUBLICATION');});
for(const category of ['current','history','dailyArchive','annual'])test(`missing or substituted ${category} rejects the entire checkpoint`,()=>{
 const missing=fixture();missing.observed.files[category]={};reject(missing,'INVENTORY_MISMATCH_'+category);
 const altered=fixture();const key=Object.keys(altered.observed.files[category])[0];altered.observed.files[category][key]=hash('other generation');reject(altered,'INVENTORY_MISMATCH_'+category);
});
test('observed in-flight writer rejects an otherwise valid checkpoint',()=>{const f=fixture();f.observed.writerState='IN_FLIGHT';reject(f,'OBSERVED_WRITE_IN_FLIGHT');});
test('even a trusted draft manifest cannot claim an uncommitted checkpoint ready',()=>{const f=fixture();f.manifest.writerState='IN_FLIGHT';f.manifestRaw=JSON.stringify(f.manifest);f.trustedManifestSha256=hash(f.manifestRaw);reject(f,'WRITES_NOT_COMMITTED');});
test('three concurrent faults retain all reasons and never return partial admission',()=>{
 const f=fixture();f.observed.writerState='IN_FLIGHT';f.observed.sqlPublication.sequence=4;delete f.observed.files.current['current.json'];
 const result=admitSyntheticCheckpoint(f);assert.equal(result.status,'REJECT');
 for(const reason of ['OBSERVED_WRITE_IN_FLIGHT','CROSS_GENERATION_PUBLICATION','INVENTORY_MISMATCH_current'])assert.ok(result.failures.includes(reason));
});
test('replacing the entire manifest with an older self-consistent checkpoint fails its trusted digest',()=>{const f=fixture();f.manifest.publication.sequence=2;f.manifest.sqlPublication.sequence=2;f.manifestRaw=JSON.stringify(f.manifest);reject(f,'UNTRUSTED_MANIFEST');});
test('unproved revocation continuity requires invalidation before admission',()=>{const f=fixture();f.observed.revocationContinuity='UNKNOWN';reject(f,'REVOKE_ALL_BEFORE_ADMISSION');});
test('malformed manifest and unsafe inventory fail closed',()=>{const f=fixture();f.manifestRaw='null';f.trustedManifestSha256=hash(f.manifestRaw);reject(f,'INVALID_CHECKPOINT');const other=fixture();other.observed.files.current={'../current.json':hash('score3')};reject(other,'INVENTORY_MISMATCH_current');});
