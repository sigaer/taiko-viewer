import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile, mkdir, mkdtemp, rm, utimes } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import ts from 'typescript';

// Execute the actual fingerprint functions, injecting only their runtime ports.
const source = await readFile(new URL('../server/services/account/annual-summary/runtime.ts', import.meta.url), 'utf8');
const inputSource = source.slice(source.indexOf('const addFileToHash ='), source.indexOf('export type AnnualRatingRankDistribution'));
const ratingSource = source.slice(source.indexOf('let ratingFingerprintMemo:'), source.indexOf('const runAnnualRatingsCli'));
const executable = ts.transpileModule((inputSource+ratingSource).replaceAll('export const ', 'const '), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }
}).outputText;

test('annual fingerprints detect Source and algorithm changes without rewriting reports', async () => {
  const root = await mkdtemp('/var/tmp/taiko-fingerprint-');
  try {
    const userdataDir=join(root,'userdata');await mkdir(userdataDir);
    await mkdir(join(root,'songs'));await mkdir(join(root,'ratings'));
    for (const name of ['song_data.json','rating_structured_with_ids.json']) await writeFile(join(root,'songs',name),'[]');
    const current=join(userdataDir,'123data.json');await writeFile(current,'{"source":"wahlap"}');
    const persisted=join(root,'persisted-report.json');await writeFile(persisted,'{"fingerprint":"legacy","summaryId":"immutable"}');
    let identity='a'.repeat(64);
    const getAnnualCacheRoot=()=>root;
    const atomicWriteJson=(p,v)=>writeFile(p,JSON.stringify(v));
    const readAnnualJson=async p=>JSON.parse(await readFile(p,'utf8'));
    const ports={createHash,createReadStream,...fs,...path,
      getRuntimePaths:()=>({repoRoot:root,userdataDir}),useRuntimeConfig:()=>({}),
      getTaikoArtifact:async()=>({identity}),createError:x=>Object.assign(new Error(x.statusMessage),x),
      ANNUAL_PRODUCER_REVISION:'fixture',ANNUAL_SCHEMA_VERSION:4,ANNUAL_VERSION_KEY:'fixture',
      ANNUAL_REPORTING_WINDOW:{start:'2026-01-01'},ANNUAL_ALGORITHM_VERSION:'fixture',
      getAnnualCacheRoot,atomicWriteJson,readAnnualJson};
    delete ports.default;
    const load=()=>new Function(...Object.keys(ports),executable+';return {getAnnualInputFingerprint,getAnnualRatingInputFingerprint}')( ...Object.values(ports));
    const api=load();
    const initial=await api.getAnnualInputFingerprint('123');
    const rating=await api.getAnnualRatingInputFingerprint();
    assert.equal(await api.getAnnualInputFingerprint('123'),initial);
    assert.equal(await api.getAnnualRatingInputFingerprint(),rating);
    assert.equal(await load().getAnnualRatingInputFingerprint(),rating,'persisted fingerprint reuse');
    const info=await fs.stat(current);
    await writeFile(current,'{"source":"hiroba"}');await utimes(current,info.atime,info.mtime);
    assert.notEqual(await api.getAnnualInputFingerprint('123'),initial);
    assert.notEqual(await api.getAnnualRatingInputFingerprint(),rating,'Source changes with the same file size/mtime');
    const sourceChanged=await api.getAnnualInputFingerprint('123');
    const ratingChanged=await api.getAnnualRatingInputFingerprint();
    identity='b'.repeat(64);
    assert.notEqual(await api.getAnnualInputFingerprint('123'),sourceChanged);
    assert.notEqual(await api.getAnnualRatingInputFingerprint(),ratingChanged);
    assert.equal(await readFile(persisted,'utf8'),'{"fingerprint":"legacy","summaryId":"immutable"}');
  } finally {await rm(root,{recursive:true,force:true});}
});
