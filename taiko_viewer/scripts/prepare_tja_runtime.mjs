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
const imageVendor = resolve(root, 'vendor/tja-tools');
const imageManifest = JSON.parse(await readFile(resolve(imageVendor, 'sources.json'), 'utf8'));
for (const [path, expected] of Object.entries(imageManifest.files)) {
  const bytes = await readFile(resolve(imageVendor, path));
  if (createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') !== expected)
    throw new Error(`TJA Tools source identity mismatch: ${path}`);
}
await build({ entryPoints: { 'chart-image': resolve(root, 'scripts/tja/chart-image.ts'), 'image-frame': resolve(root, 'scripts/tja/image-frame.ts') }, bundle: true, platform: 'browser',
  format: 'iife', globalName: 'CatalogChartImage', outdir: output,
  loader: { '.png': 'dataurl', '.ttf': 'dataurl' },
  plugins: [{ name: 'tja-tools-format-only', setup(builder) {
    // Upstream uses webpack's require('sprite.png').default convention.
    builder.onLoad({ filter: /\.png$/ }, async args => ({
      contents: `export default ${JSON.stringify('data:image/png;base64,' + (await readFile(args.path)).toString('base64'))}`,
      loader: 'js'
    }));
    // drawChart imports one formatting helper from the interactive app entry.
    // Extract it from the pinned source without bundling the app or editing it.
    builder.onResolve({ filter: /^\.\/main$/ }, args => args.importer === resolve(imageVendor, 'src/js/drawChart.js')
      ? { path: 'format-only', namespace: 'tja-tools-format' } : undefined);
    builder.onLoad({ filter: /.*/, namespace: 'tja-tools-format' }, async () => {
      const source = await readFile(resolve(imageVendor, 'src/js/main.js'), 'utf8');
      const contents = source.match(/export function toFixedZero\(num\) \{[\s\S]*?\r?\n\}/)?.[0];
      if (!contents) throw new Error('Pinned number formatter missing');
      return { contents, loader: 'js' };
    });
  } }] });
await cp(resolve(vendor, 'Constants'), resolve(output, 'Constants'), { recursive: true, filter: p => !p.includes('__pycache__') });
await cp(resolve(vendor, 'sources.json'), resolve(output, 'sources.json'));
await cp(resolve(root, 'scripts/tja/calculate.py'), resolve(output, 'calculate.py'));
console.log('TJA offline runtime prepared (pinned sources verified)');
