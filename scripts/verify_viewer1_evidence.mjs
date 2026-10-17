// Offline audit freshness only. This does not grant release or security approval.
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile, readdir, realpath} from 'node:fs/promises';
import {resolve, relative, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const audit = resolve(root, 'docs/platform-architecture-audit');
const matrix = JSON.parse(await readFile(resolve(audit, 'api-auth-matrix.json'), 'utf8'));
const expected = [];
async function walk(directory) {
  for (const entry of await readdir(resolve(root, directory), {withFileTypes:true})) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await walk(file);
    else if (entry.isFile() && /\.(get|post|put|patch|delete|head|options)\.ts$/.test(file)) expected.push(file);
  }
}
await walk('taiko_viewer/server/api/developer');
await walk('taiko_viewer/server/api/taiko');
await walk('taiko_viewer/server/api/internal');
const failures = [];
const routes = new Map();
for (const row of matrix.routes || []) {
  if (routes.has(row.file)) failures.push(`duplicate route: ${row.file}`);
  routes.set(row.file, row);
  for (const key of ['file','method','route','sourceSha256','owner','visibility','authentication','grantScope','sideEffects','cachePolicy','statusCodes','callers','status']) {
    if (row[key] == null || row[key] === '') failures.push(`missing ${key}: ${row.file}`);
  }
  const match = /^taiko_viewer\/server(\/api\/.*)\.(get|post|put|patch|delete|head|options)\.ts$/.exec(row.file || '');
  if (!match || row.method !== match[2].toUpperCase() || row.route !== match[1]) failures.push(`route/method mismatch: ${row.file}`);
}
for (const file of expected) if (!routes.has(file)) failures.push(`unreviewed route: ${file}`);
for (const file of routes.keys()) if (!expected.includes(file)) failures.push(`stale/out-of-scope route: ${file}`);
for (const row of [...routes.values(), ...(matrix.dependencies || [])]) {
  try {
    const path = await realpath(resolve(root, row.file));
    const local = relative(root, path);
    if (local === '..' || local.startsWith(`..${sep}`) || !/^[a-f0-9]{64}$/.test(row.sourceSha256)) throw new Error('invalid evidence reference');
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path)) hash.update(chunk);
    if (hash.digest('hex') !== row.sourceSha256) failures.push(`source changed; re-review required: ${row.file}`);
  } catch { failures.push(`invalid/missing evidence: ${row.file}`); }
}
// A reviewed inventory, not automatic transitive dependency analysis.
for (const file of [
  'taiko_viewer/server/services/account/source-access.ts',
  'taiko_viewer/server/services/account/merged-source-read.ts',
  'taiko_viewer/server/infrastructure/account/source-service-schema.ts',
  'taiko_viewer/server/infrastructure/account/private-source-response.ts',
  'taiko_viewer/server/middleware/private-cache.ts',
]) {
  if (!matrix.dependencies?.some(row => row.file === file)) failures.push(`missing critical dependency: ${file}`);
}
if (failures.length) {
  for (const failure of failures.slice(0, 40)) console.error(failure);
  console.error(`audit freshness FAIL (${failures.length} issues)`);
  process.exitCode = 1;
} else {
  console.log(`audit freshness PASS: ${routes.size} routes, ${matrix.dependencies.length} dependencies; security/release gates unchanged`);
}
