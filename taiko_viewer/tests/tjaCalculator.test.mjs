// Run through scripts/memory/run_qa.sh after prepare_tja_runtime.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { createApp, toNodeListener } from 'h3';

const root = new URL('..', import.meta.url).pathname;
process.chdir(root);
process.env.NODE_ENV = 'test';
const simple = 'TITLE:Viewer test\nBPM:180\nCOURSE:Oni\nLEVEL:8\n#START\n12121212,\n11221122,\n#END\n';
const payload = (text, headers = {}) => ({ method: 'POST', headers: { 'Content-Type': 'application/octet-stream', ...headers }, body: text });

test('offline HTTP calculator: dimensions, encodings, branches, boundaries and rate limiting', { timeout: 120_000 }, async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'tja-test-'));
  let server;
  try {
    const bundle = resolve(dir, 'endpoint.mjs');
    await build({ entryPoints: [resolve(root, 'server/api/tools/tja-constants.post.ts')], bundle: true, platform: 'node', format: 'esm', banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" }, outfile: bundle });
    const { default: endpoint } = await import(pathToFileURL(bundle));
    const app = createApp(); app.use('/calculate', endpoint);
    server = createServer(toNodeListener(app));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}/calculate`;
    let ip = 10;
    const request = (text, headers = {}) => fetch(url, payload(text, { 'x-real-ip': `192.0.2.${ip++}`, ...headers }));
    const res = await request(simple); const result = await res.json();
    assert.equal(res.status, 200, JSON.stringify(result));
    assert.equal(result.charts[0].totalNotes, 16);
    assert.equal(Object.keys(result.charts[0].constants).length, 8);
    assert.ok(Object.values(result.charts[0].constants).every(Number.isFinite));
    assert.equal(result.title, 'Viewer test');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const repeat = await request(simple); assert.equal((await repeat.json()).charts[0].constants.main_constant, result.charts[0].constants.main_constant);
    for (const [encoding, title, expected] of [['cp932', Buffer.from('836583588367', 'hex'), 'テスト'], ['gb18030', Buffer.from('d6d0cec4', 'hex'), '中文']]) {
      const bytes = Buffer.concat([Buffer.from('TITLE:'), title, Buffer.from(simple.slice(simple.indexOf('\n')))]);
      const encoded = await (await request(bytes, { 'x-tja-encoding': encoding })).json();
      assert.equal(encoded.title, expected);
      assert.equal(encoded.charts[0].constants.main_constant, result.charts[0].constants.main_constant);
    }
    const branched = simple.replace('12121212,\n11221122,', '1212,\n#BRANCHSTART p,50,80\n#N\n1111,\n#E\n12121212,\n#M\n1212121212121212,\n#BRANCHEND');
    const branches = await (await request(branched)).json();
    assert.equal(branches.charts.length, 3); assert.ok(branches.charts.every(c => c.constants));
    const sparse = await (await request(simple.replace('12121212,\n11221122,', '1000,'))).json();
    assert.equal(sparse.charts[0].error, 'too_few_notes');
    assert.equal((await request('not a tja')).status, 422);
    assert.equal((await request(simple + 'COURSE:Hard\n#START\n1111,')).status, 422);
    const simultaneous = await Promise.all([request(simple.replace('Viewer test', 'Concurrent A')), request(simple.replace('Viewer test', 'Concurrent B'))]);
    assert.deepEqual(simultaneous.map(r => r.status).sort(), [200, 503]);
    assert.equal((await request(Buffer.alloc(512 * 1024 + 1, 49))).status, 413);
    assert.equal((await request(simple, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await request(simple, { 'x-tja-encoding': '../../evil' })).status, 400);
    for (let i = 0; i < 6; i++) assert.equal((await request(simple, { 'x-real-ip': '192.0.2.250' })).status, 200);
    const limited = await request(simple, { 'x-real-ip': '192.0.2.250' }); assert.equal(limited.status, 429); assert.ok(limited.headers.get('retry-after'));
    // Reference parity uses checked local business data, without changing it or contacting any database.
    const dataset = JSON.parse(await readFile(resolve(root, 'assets/data/v2_console_constants.json'), 'utf8'));
    const localTjaRoot = process.env.TJA_REFERENCE_ROOT;
    let referenceCharts = 0;
    if (localTjaRoot) {
      for (const id of Object.keys(dataset.constants).filter(id => Object.keys(dataset.constants[id]).length).slice(0, 3)) {
        const source = await readFile(resolve(localTjaRoot, dataset.provenance[id].tjaPath));
        const response = await request(source); const actual = await response.json();
        assert.equal(response.status, 200);
        for (const [course, expected] of Object.entries(dataset.constants[id])) {
          const selection = dataset.provenance[id].charts[course];
          const match = actual.charts.find(c => c.course === selection.course && c.branch === selection.branch);
          assert.equal(match.totalNotes, expected.totalNotes);
          for (const [key, value] of Object.entries(expected)) if (key !== 'totalNotes') assert.ok(Math.abs(match.constants[key] - value) < 1e-9, `${id}/${course}/${key}`);
          referenceCharts++;
        }
      }
    }
    console.log(`TJA real isolated worker / HTTP passed; reference charts checked: ${referenceCharts}`);
  } finally { if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } await rm(dir, { recursive: true, force: true }); }
});
