import test from 'node:test';
import assert from 'node:assert/strict';
import {createBetaInvite,normalizeInvite,hashBetaToken} from '../server/services/annual-beta/core.ts';

test('manual input accepts short codes case-insensitively and preserves legacy codes',()=>{
 assert.equal(normalizeInvite('  abcd-efgh  '),'ABCDEFGH');
 assert.equal(normalizeInvite('23yz6789'),'23YZ6789');
 const legacy='0123-4567-89AB-CDEF-0123-4567-89AB-CDEF';
 assert.equal(normalizeInvite(legacy.toLowerCase()),legacy.replaceAll('-',''));
 for(const invalid of ['ABCDEFG','ABCDEFGHJ','ABCD0FGH','ABCD1FGH','ABCDIFGH','ABCDOFGH','<script>'])assert.throws(()=>normalizeInvite(invalid),e=>e.code==='invalid_invite');
});

test('new bearer code is eight unambiguous characters, only its hash is stored; collision retries',async()=>{
 const writes=[];const db={execute:async(sql,args)=>{writes.push(args);if(writes.length===1)throw Object.assign(new Error('collision'),{code:'ER_DUP_ENTRY'});}};
 const result=await createBetaInvite(db,'wave1',new Date(Date.now()+60000));
 assert.match(result.code,/^[A-HJ-NP-Z2-9]{8}$/);assert.equal(writes.length,2);
 assert.equal(writes[1][1],hashBetaToken(result.code));assert.ok(!writes[1].includes(result.code));
 assert.notEqual(writes[0][0],writes[1][0]);
});

test('collision retry is bounded and unrelated storage failures are not retried',async()=>{
 let attempts=0;
 await assert.rejects(createBetaInvite({execute:async()=>{attempts++;throw Object.assign(new Error(),{code:'ER_DUP_ENTRY'});}},'wave1',new Date(Date.now()+60000)),e=>e.code==='invite_generation_failed');assert.equal(attempts,5);
 attempts=0;await assert.rejects(createBetaInvite({execute:async()=>{attempts++;throw Object.assign(new Error(),{code:'ER_ACCESS_DENIED_ERROR'});}},'wave1',new Date(Date.now()+60000)),e=>e.code==='ER_ACCESS_DENIED_ERROR');assert.equal(attempts,1);
});
