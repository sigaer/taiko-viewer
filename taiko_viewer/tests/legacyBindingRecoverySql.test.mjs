// Actual authenticated HTTP + isolated SQL; no external network or production data.
import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { accountSourceFixture } from './fixtures/accountSourceHttp.mjs';

for (const keywordKind of ['Chinese nickname', 'numeric ID']) test(`legacy Chinese binding recovers through ${keywordKind} verification and authenticated reload`, {timeout: 45000}, () => accountSourceFixture(async c => {
  const alias = '中文旧绑定' + randomUUID().slice(0, 8);
  const nickname = '当前中文昵称🌸';
  await c.pool.execute('UPDATE web_taiko_bindings SET is_current=0 WHERE user_id=?', [c.user]);
  const [legacy]=await c.pool.execute("INSERT INTO web_taiko_bindings(user_id,taiko_id,source,is_current,verified_title) VALUES (?,?,'wahlap',1,'旧称号')", [c.user,alias]);
  const oldRaw = JSON.stringify({profile:{userid:c.taikoId,mydon_name:nickname},songs:[]});
  const oldPath = resolve(c.config.userdataDir,alias+'data.json');
  const oldHistory = resolve(c.config.userdataDir,alias,'data_2026-10-01_08_00_00.json');
  await writeFile(oldPath,oldRaw);
  await mkdir(resolve(c.config.userdataDir,alias));await writeFile(oldHistory,oldRaw);
  const previousFetch = globalThis.fetch;
  let changed = false, lookups = 0;
  const requests = [];
  try {
    globalThis.fetch = async (url,options) => {
      if (String(url) !== 'https://wl-taiko.wahlap.net/api/user/search/player') return previousFetch(url,options);
      const keyword = JSON.parse(options.body).keyword;requests.push(keyword);lookups++;
      assert.ok(keyword===nickname || keyword===c.taikoId);
      return new Response(JSON.stringify({data:{players:[{userid:c.taikoId,mydon_name:nickname,
        gameCostume:{title:changed?'更改后的称号':'验证前称号',titleplate_id:changed?0:1}}]}}),{status:201});
    };
    for (const [path,file] of [['/prepare','prepare'],['/confirm','confirm']]) {
      c.route('post',path,(await import(`../server/api/account/bindings/${file}.post.ts`)).default);
    }
    const profile=await c.read('/profile');
    assert.equal(profile.currentBinding.taikoId,alias);
    assert.equal(profile.currentBinding.requiresReverification,true);
    assert.equal(profile.currentBinding.canExternalSync,false);
    assert.equal(profile.verificationStatus.taikoVerified,false);
    assert.equal((await c.read('/bindings')).currentBinding.taikoId,alias);
    const sync=await c.read('/sync');assert.equal(sync.hasUserdata,false);assert.equal(sync.canSyncFromWahlap,false);assert.equal(sync.scoreTokenAvailable,false);
    assert.equal((await c.request('POST','/sync-submit',{targetIds:['sakura-bot']})).status,409);
    await assert.rejects(c.tokens.manageViewerScoreToken(c.user,'issue'),e=>e.statusCode===409);
    c.state.expectedSourceMode='none';
    const prepared=await c.request('POST','/prepare',{taikoId:keywordKind==='Chinese nickname'?nickname:c.taikoId});
    assert.equal(prepared.status,200);assert.equal((await prepared.json()).taikoId,c.taikoId);
    assert.equal(lookups,1,'Preparation resolves one upstream snapshot');
    const pending=(await c.read('/profile')).pendingBinding;
    assert.equal(pending.taikoId,c.taikoId);assert.equal(pending.originalTitle,'验证前称号');
    c.state.expectedSourceMode='write';
    assert.equal((await c.request('POST','/confirm',{taikoId:c.taikoId})).status,400);
    changed=true;
    assert.equal((await c.request('POST','/confirm',{taikoId:c.taikoId})).status,200);
    const recovered=await c.read('/profile');
    assert.equal(recovered.currentBinding.taikoId,c.taikoId);
    assert.equal(recovered.currentBinding.verifiedTitleplateId,0);
    assert.equal(recovered.currentBinding.requiresReverification,undefined);
    assert.equal(recovered.verificationStatus.taikoVerified,true);
    assert.equal(recovered.pendingBinding,null);
    assert.equal((await c.read('/sync')).canSyncFromWahlap,true);
    const optionsFile=resolve(c.root,'legacy-sync-options.json');
    await writeFile(optionsFile,JSON.stringify({root:c.root,userId:c.user,taikoId:c.taikoId,
      payload:{profile:{userid:c.taikoId,mydon_name:nickname,gameCostume:{title:'更改后的称号',titleplate_id:0}},songs:[],achievement:{},dojo:{}}}));
    globalThis.__goalSqlRuntime.syncLaunch=(executable,args,options)=>spawn(executable,
      ['-I',fileURLToPath(new URL('./fixtures/installed-workers/account_sync_sql_child.py',import.meta.url)),optionsFile],
      {...options,env:{...options.env,QA_RUN_DIR:process.env.QA_RUN_DIR,QA_RUN_TMPDIR:process.env.QA_RUN_TMPDIR,
        TAIKO_RUNTIME_ROOT:c.root,TAIKO_CENTER_ROOT:c.root,TAIKO_OFFLINE_ROOT:c.root,TAIKO_ALLOW_TEST_DB_MUTATION:'1'}});
    const requestId=randomUUID().replaceAll('-','');
    const synchronized=await c.request('POST','/sync-submit',{targetIds:['sakura-bot'],requestId});
    assert.equal(synchronized.status,200);const synced=await synchronized.json();assert.equal(synced.log.status,'success');
    const replay=await c.request('POST','/sync-submit',{targetIds:['sakura-bot'],requestId});
    assert.equal(replay.status,200);assert.equal((await replay.json()).log.id,synced.log.id);
    assert.equal((await c.read('/sync')).lastSync.id,synced.log.id);
    c.cookie=await c.login();assert.equal((await c.read('/profile')).currentBinding.taikoId,c.taikoId);
    assert.ok(requests.slice(1).every(id=>id===c.taikoId),'Confirmation rechecks exact numeric ID');
    c.state.expectedSourceMode='none';
    assert.equal((await c.request('POST','/remove',{bindingId:legacy.insertId})).status,200);
    assert.equal((await c.request('POST','/remove',{bindingId:legacy.insertId})).status,200);
    assert.equal((await c.read('/profile')).currentBinding.taikoId,c.taikoId);
    assert.equal(await readFile(oldPath,'utf8'),oldRaw);
    assert.equal(await readFile(oldHistory,'utf8'),oldRaw);
  } finally {globalThis.fetch=previousFetch;}
}));
