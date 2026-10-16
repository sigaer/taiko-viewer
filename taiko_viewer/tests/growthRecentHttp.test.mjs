import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = path => readFile(new URL(path, import.meta.url), "utf8");

test("Recent GET is authenticated, private and read-only", async () => {
  const [route, service] = await Promise.all([source("../server/api/account/growth/recent.get.ts"), source("../server/services/growth-recent/service.ts")]);
  assert.match(route, /requireAccountUser\(event\)/);
  assert.match(route, /private, no-store/);
  assert.match(route, /Vary/);
  assert.doesNotMatch(route, /readBody|profileId|bindingId|userId/);
  const getBody = service.slice(service.indexOf("export async function getRecentGrowth"), service.indexOf("type AcknowledgeInput"));
  assert.doesNotMatch(getBody, /writeRecentCursor|INSERT|UPDATE|DELETE/);
});

test("Recent acknowledgement is a separate authenticated CAS POST", async () => {
  const [route, service] = await Promise.all([source("../server/api/account/growth/recent/ack.post.ts"), source("../server/services/growth-recent/service.ts")]);
  assert.match(route, /requireAccountUser\(event\)/);
  assert.match(route, /readBody\(event\)/);
  assert.match(route, /private, no-store/);
  assert.match(service, /stored\?\.token \|\| null\) !== expectedBoundary/);
  assert.match(service, /current\.token !== acknowledgeToken/);
  assert.match(service, /FOR UPDATE/);
});

test("Home acknowledges only after Recent Growth has rendered", async () => {
  const [component, composable, service, zh] = await Promise.all([source("../components/home/RecentGrowth.vue"), source("../composables/useRecentGrowth.ts"), source("../server/services/growth-recent/service.ts"), source("../locales/zh.json")]);
  assert.match(component, /await nextTick\(\)/);
  assert.match(component, /requestAnimationFrame/);
  assert.match(component, /emit\("presented", token\)/);
  assert.match(composable, /method: "POST"/);
  assert.match(composable, /expectedBoundary/);
  assert.match(service, /"ng-reduced", "combo-improved"/);
  assert.match(component, /recent\.ngReduced/);
  assert.match(component, /recent\.combo/);
  assert.doesNotMatch(zh, /这次游玩|这一轮/);
});

test("generic history writer preserves its actual writer provenance", async () => {
  // shared.ts now re-exports the single Publication writer. Assert the persisted
  // contract instead of looking for a removed function body at its former path.
  const {mkdtemp, rm} = await import('node:fs/promises');
  const {join} = await import('node:path');
  const {execFile} = await import('node:child_process');
  const {promisify} = await import('node:util');
  const {getPublicationPython} = await import('../server/infrastructure/taiko-publication/python.ts');
  const {withPublicationLease} = await import('../server/infrastructure/taiko-publication/client.ts');
  const {writeUserdataWithHistory} = await import('../server/infrastructure/taiko-publication/writer.ts');
  const root = await mkdtemp('/var/tmp/history-writer-oracle-');
  const previous = globalThis.useRuntimeConfig;
  try {
    globalThis.useRuntimeConfig = () => ({repoRoot:root,userdataDir:root});
    const probe = await promisify(execFile)(getPublicationPython(), ['-I','-c',
      "import sys,json,pathlib,taiko_store.bridge as b; assert sys.flags.isolated==1; assert pathlib.Path(b.__file__).resolve().is_relative_to(pathlib.Path(sys.prefix).resolve()); print(json.dumps({'isolated':sys.flags.isolated,'origin':b.__file__}))"], {cwd:root,timeout:10000,maxBuffer:8192});
    assert.equal(JSON.parse(probe.stdout).isolated,1);
    const payload = {songs:[],_meta:{writer_source:'untrusted-input',source:'untrusted-input',custom:'preserved'}};
    await writeUserdataWithHistory('synthetic',payload,'manual-score');
    await withPublicationLease({root,repoRoot:root,identity:'synthetic',mode:'read'},async lease=>{
      const entries=Object.entries(lease.view.files).filter(([key])=>key.startsWith('history/'));
      assert.equal(entries.length,1);
      const history=JSON.parse(await readFile(join(root,'.taiko-publications','synthetic','objects',entries[0][1].sha256),'utf8'));
      assert.equal(history._meta.writer_source,'manual-score');
      assert.equal(history._meta.source,'manual-score');
      assert.equal(history._meta.custom,'preserved');
      assert.equal(payload._meta.writer_source,'untrusted-input');
    });
  } finally {
    if (previous === undefined) delete globalThis.useRuntimeConfig;
    else globalThis.useRuntimeConfig=previous;
    await rm(root,{recursive:true,force:true});
  }
});
