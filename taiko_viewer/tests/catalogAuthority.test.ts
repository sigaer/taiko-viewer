import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { captureCatalogAuthority, readCatalogAuthority, withCatalogRequest } from '../server/services/content/catalogAuthority.ts';

test('real frozen snapshot exposes one version and 1387 official Oni/Ura policy decisions', async () => {
  const { data, report } = await readCatalogAuthority('/var/tmp/taiko-batch21-20261124/catalog');
  assert.equal(report.catalogRevision, data.catalogRevision);
  assert.equal(report.policyVersion, 'wahlap-cn-1');
  assert.equal(data.songs.length, 2993);
  const selected = Object.values(data.charts).filter(chart => [4,5].includes(chart.difficulty) && chart.policies.cn_current_playable.eligible);
  assert.equal(selected.length, 1387);
  for (const id of [1210,226,197,1103,106,301,663]) {
    assert.equal(data.charts[`${id}:5`].policies.cn_current_playable.eligible, false);
    assert.equal(data.charts[`${id}:5`].policies.historical_score.eligible, true);
  }
  for (const song of data.songs) {
    assert.equal(song.catalog.catalogRevision, data.catalogRevision);
    assert.equal(song.catalog.policyVersion, data.policyVersion);
  }
});

test('parallel request scopes pin their generation through activation and stale health', async () => {
  const root = await mkdtemp(join(process.env.QA_RUN_TMPDIR!, 'catalog-node-'));
  const revisionA='a'.repeat(64), revisionB='b'.repeat(64);
  async function install(revision: string) {
    const data={schemaVersion:1,policyVersion:'wahlap-cn-1',catalogRevision:revision,songs:[],charts:{},aliases:{},searchAliases:[],sourceManifest:[]};
    const body=Buffer.from(JSON.stringify(data));
    await mkdir(join(root,'revisions',revision),{recursive:true});
    await writeFile(join(root,'revisions',revision,'catalog.json'),body);
    return {catalogRevision:revision,policyVersion:'wahlap-cn-1',schemaVersion:1,sha256:createHash('sha256').update(body).digest('hex'),bytes:body.length};
  }
  try {
    const a=await install(revisionA),b=await install(revisionB);
    await writeFile(join(root,'active.json'),JSON.stringify(a));
    await writeFile(join(root,'fetch-status.json'),JSON.stringify({state:'fresh'}));
    let release!: () => void;
    const activated=new Promise<void>(resolve=>{release=resolve;});
    const first=withCatalogRequest(async()=>{
      const before=await captureCatalogAuthority(root);
      await writeFile(join(root,'active.json'),JSON.stringify(b)); release();
      await new Promise(resolve=>setTimeout(resolve,10));
      assert.equal((await captureCatalogAuthority(root)).data.catalogRevision,before.data.catalogRevision);
      return before.data.catalogRevision;
    });
    const second=withCatalogRequest(async()=>{await activated;return (await captureCatalogAuthority(root)).data.catalogRevision;});
    assert.deepEqual(await Promise.all([first,second]),[revisionA,revisionB]);
    await writeFile(join(root,'fetch-status.json'),JSON.stringify({state:'stale',complete:false,reason:'API_FAILED'}));
    const stale=await readCatalogAuthority(root);
    assert.equal(stale.report.state,'stale');assert.equal(stale.data.catalogRevision,revisionB);
    assert.equal(JSON.parse(await readFile(join(root,'active.json'),'utf8')).catalogRevision,revisionB);
    const corrupt={...b,sha256:'0'.repeat(64)};
    await writeFile(join(root,'active.json'),JSON.stringify(corrupt));
    await assert.rejects(readCatalogAuthority(root),/HASH_MISMATCH/);
  } finally { await rm(root,{recursive:true,force:true}); }
});
