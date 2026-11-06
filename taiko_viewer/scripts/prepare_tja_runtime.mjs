import { build } from 'esbuild';
import { cp, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const vendor = resolve(root, 'vendor/tja');
const output = resolve(root, '.tja-runtime');
const manifest = JSON.parse(await readFile(resolve(vendor, 'sources.json'), 'utf8'));
for (const [name, source] of Object.entries(manifest)) {
  for (const [path, expected] of Object.entries(source.files)) {
    const bytes = await readFile(resolve(vendor, name, path));
    const actual = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if (actual !== expected) throw new Error(`TJA source identity mismatch: ${name}/${path}`);
  }
}
await mkdir(output, { recursive: true });
await build({
  entryPoints: [resolve(root, 'scripts/tja/analyze.ts')],
  bundle: true, platform: 'node', format: 'esm', outfile: resolve(output, 'analyze.mjs'),
  alias: { 'tja-renderer': resolve(root, 'scripts/tja/renderer.ts') }
});
await cp(resolve(vendor, 'Constants'), resolve(output, 'Constants'), { recursive: true, filter: p => !p.includes('__pycache__') });
await cp(resolve(vendor, 'sources.json'), resolve(output, 'sources.json'));
await cp(resolve(root, 'scripts/tja/calculate.py'), resolve(output, 'calculate.py'));
console.log('TJA offline runtime prepared (pinned sources verified)');
