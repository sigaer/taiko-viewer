import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readInviteVault,availableInviteCodes} from '../server/services/annual-beta/invite-vault.ts';
import {hashBetaToken} from '../server/services/annual-beta/core.ts';

test('private vault accepts short/legacy codes and rejects unsafe or malformed files',async()=>{
 const dir=await fs.mkdtemp(join(tmpdir(),'beta-vault-'));const path=join(dir,'invites.csv');
 try{
  await fs.writeFile(path,'code,cohort,expires_at\nABCDEFGH,wave1,2030-01-01\n0123456789ABCDEF0123456789ABCDEF,wave2,2030-01-01\n',{mode:0o600});
  const vault=await readInviteVault(path);assert.equal(vault.size,2);assert.equal(vault.get(hashBetaToken('ABCDEFGH')).cohort,'wave1');
  await fs.chmod(path,0o644);await assert.rejects(readInviteVault(path));await fs.chmod(path,0o600);
  await fs.symlink(path,join(dir,'link'));await assert.rejects(readInviteVault(join(dir,'link')));
  for(const content of ['bad-header\n','code,cohort,expires_at\nABCDEFGH,wave3,2030-01-01\n','code,cohort,expires_at\nABCDEFGH,wave1,invalid\n','x'.repeat(131073)]){
   await fs.writeFile(path,content);await assert.rejects(readInviteVault(path));
  }
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('reveal requires a matching live formal unused DB invitation and returns no hashes',()=>{
 const code='ABCDEFGH';const code_hash=hashBetaToken(code);const vault=new Map([[code_hash,{code,cohort:'wave2'}]]);
 const row={id:'record-id',code_hash,cohort:'wave2',expires_at:'2030-01-01',used_count:0,max_uses:1,disabled_at:null,analysis_excluded:0};
 const now=Date.parse('2026-09-24');assert.equal(availableInviteCodes([row],vault,now)[0].code,code);
 assert.equal('code_hash' in availableInviteCodes([row],vault,now)[0],false);
 for(const patch of [{cohort:'wave1'},{code_hash:'unknown'},{disabled_at:'2026-01-01'},{used_count:1},{max_uses:0},{analysis_excluded:1},{expires_at:'2026-01-01'}]){
  assert.equal(availableInviteCodes([{...row,...patch}],vault,now).length,0);
 }
});
