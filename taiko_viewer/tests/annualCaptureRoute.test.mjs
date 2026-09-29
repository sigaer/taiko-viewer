import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
const {code}=await transform(await readFile(new URL('../utils/annualCaptureRoute.ts',import.meta.url),'utf8'),{loader:'ts',format:'esm'});
const {isAnnualCapturePath}=await import(`data:text/javascript,${encodeURIComponent(code)}`);
test('only internal canonical capture pages omit site decoration',()=>{
 for(const prefix of ['','/ja'])for(const kind of ['share-card','poster'])assert.equal(isAnnualCapturePath(`${prefix}/account/annual-${kind}/annual_123`),true);
 for(const path of ['/','/ja','/account/version-summary','/ja/account/version-summary','/annual/share/token','/account/annual-share-card','/account/annual-share-card/id/other'])assert.equal(isAnnualCapturePath(path),false,path);
});
