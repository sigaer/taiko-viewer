#!/usr/bin/env node
// P0-12 / D0-5 = A: small rank and crown icons, generated with sharp from the untouched originals.
//
//   node scripts/ds/generate_small_game_icons.mjs            write public/icons/{rank/{56,80},crown/{36,60,96}}/*.{webp,png}
//                                                            and scripts/ds/spec/small-icons.json (byte table)
//   node scripts/ds/generate_small_game_icons.mjs --check    regenerate in memory and compare with the committed files; writes nothing
//   node scripts/ds/generate_small_game_icons.mjs --sheets <dir>
//                                                            also write side-by-side review sheets (1× and 2×) into <dir>
//
// Rules (19 G5, 22 D10, D0-5): proportional downscale only — no crop, recolour, sharpening or metadata;
// WebP is lossless (with alpha) and each size also has a PNG; originals are read, never written.
// Output depends only on the originals, sharp's version and the fixed settings below.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..", "..");
const ICONS = join(ROOT, "public", "icons");
export const TABLE = join(here, "spec", "small-icons.json");

export const SETS = [
  { dir: "rank", files: ["2", "3", "4", "5", "6", "7", "8"], sizes: [56, 80] },
  { dir: "crown", files: ["clear", "full", "dondaful"], sizes: [36, 60, 96] }
];
/** Fixed encoder settings; changing any of them changes every output byte. */
export const SETTINGS = Object.freeze({
  kernel: "lanczos3",
  webp: { lossless: true, effort: 6, exact: false },
  png: { compressionLevel: 9, adaptiveFiltering: true, palette: false }
});

const md5 = (buf) => createHash("md5").update(buf).digest("hex");
const rel = (p) => p.slice(ROOT.length + 1).replace(/\\/g, "/");

async function render(srcBuf, size) {
  const base = sharp(srcBuf, { failOn: "error" }).resize(size, size, { fit: "contain", kernel: SETTINGS.kernel, background: { r: 0, g: 0, b: 0, alpha: 0 } });
  const [webp, png] = await Promise.all([base.clone().webp(SETTINGS.webp).toBuffer(), base.clone().png(SETTINGS.png).toBuffer()]);
  return { webp, png };
}

async function rgba(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export async function generate({ write = false, check = false } = {}) {
  const rows = [];
  const problems = [];
  const notes = [];
  for (const set of SETS) {
    for (const name of set.files) {
      const srcPath = join(ICONS, set.dir, `${name}.png`);
      const srcBuf = readFileSync(srcPath);
      const srcMd5 = md5(srcBuf);
      const meta = await sharp(srcBuf).metadata();
      for (const size of set.sizes) {
        const out = await render(srcBuf, size);
        const dir = join(ICONS, set.dir, String(size));
        for (const ext of ["webp", "png"]) {
          const file = join(dir, `${name}.${ext}`);
          if (check) {
            if (!existsSync(file)) problems.push(`missing ${rel(file)}`);
            else {
              const committed = readFileSync(file);
              if (!committed.equals(out[ext])) {
                const [a, b] = await Promise.all([rgba(committed), rgba(out[ext])]);
                if (a.width === b.width && a.height === b.height && a.data.equals(b.data)) notes.push(`${rel(file)}: pixels identical, encoded bytes differ (encoder build)`);
                else problems.push(`${rel(file)} differs from a fresh render`);
              }
            }
          } else if (write) {
            mkdirSync(dir, { recursive: true });
            writeFileSync(file, out[ext]);
          }
        }
        rows.push({
          file: `${set.dir}/${size}/${name}`,
          src: `${set.dir}/${name}.png`,
          srcSize: `${meta.width}x${meta.height}`,
          srcBytes: srcBuf.length,
          srcMd5,
          size,
          webpBytes: out.webp.length,
          pngBytes: out.png.length
        });
      }
      // Originals must be byte-identical after the run.
      if (md5(readFileSync(srcPath)) !== srcMd5) problems.push(`original changed: ${rel(srcPath)}`);
    }
  }
  const table = { generator: "scripts/ds/generate_small_game_icons.mjs", sharp: sharp.versions, settings: SETTINGS, files: rows };
  if (write) {
    mkdirSync(dirname(TABLE), { recursive: true });
    writeFileSync(TABLE, JSON.stringify(table, null, 1) + "\n");
  }
  if (check && existsSync(TABLE)) {
    const committed = JSON.parse(readFileSync(TABLE, "utf8"));
    const strip = (t) => JSON.stringify(t.files.map(({ webpBytes, pngBytes, ...r }) => r));
    if (strip(committed) !== strip(table)) problems.push("small-icons.json source table differs from the originals");
  }
  return { rows, problems, notes, table };
}

/* ---------------- review sheets ---------------- */

const label = (text, w, h, color) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><text x="2" y="${h - 4}" font-family="Arial, sans-serif" font-size="11" fill="${color}">${text}</text></svg>`);

/**
 * One sheet per scale. Each row: the original scaled to the cell (reference, sharp "mitchell" kernel — no ringing),
 * then every generated size of that icon at its native pixels; the 2× sheet magnifies everything with nearest
 * neighbour so edges, halos and outline thickness can be inspected. Light and dark backgrounds side by side.
 */
export async function sheets(outDir) {
  mkdirSync(outDir, { recursive: true });
  const written = [];
  for (const scale of [1, 2]) {
    for (const set of SETS) {
      const max = Math.max(...set.sizes);
      const cell = (max + 16) * scale;
      const labelH = 16;
      const cols = 1 + set.sizes.length * 2; // reference + (webp, png) per size
      const backgrounds = [
        { name: "light", color: { r: 249, g: 253, b: 252, alpha: 1 }, ink: "#203f43" },
        { name: "dark", color: { r: 26, g: 56, b: 61, alpha: 1 }, ink: "#e4f4f1" }
      ];
      const width = cols * cell * backgrounds.length + 8;
      const height = set.files.length * (cell + labelH) + labelH;
      const layers = [];
      for (const [bi, bg] of backgrounds.entries()) {
        const x0 = bi * (cols * cell + 8);
        layers.push({ input: { create: { width: cols * cell, height, channels: 4, background: bg.color } }, left: x0, top: 0 });
        const heads = ["orig→max", ...set.sizes.flatMap((s) => [`${s} webp`, `${s} png`])];
        heads.forEach((h, i) => layers.push({ input: label(`${h}${scale > 1 ? " ×2" : ""}`, cell, labelH, bg.ink), left: x0 + i * cell, top: 0 }));
        for (const [ri, name] of set.files.entries()) {
          const top = labelH + ri * (cell + labelH);
          const src = readFileSync(join(ICONS, set.dir, `${name}.png`));
          const ref = await sharp(src).resize(max, max, { fit: "contain", kernel: "mitchell", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
          const place = async (buf, size, col) => {
            const img = scale > 1 ? await sharp(buf).resize(size * scale, size * scale, { kernel: "nearest" }).png().toBuffer() : buf;
            const off = Math.round((cell - size * scale) / 2);
            layers.push({ input: img, left: x0 + col * cell + off, top: top + off });
          };
          await place(ref, max, 0);
          let col = 1;
          for (const size of set.sizes) {
            for (const ext of ["webp", "png"]) {
              const file = join(ICONS, set.dir, String(size), `${name}.${ext}`);
              const buf = ext === "webp" ? await sharp(readFileSync(file)).png().toBuffer() : readFileSync(file);
              await place(buf, size, col++);
            }
          }
          layers.push({ input: label(`${set.dir}/${name}`, cell, labelH, bg.ink), left: x0, top: top + cell });
        }
      }
      const outFile = join(outDir, `small-icons-${set.dir}-${scale}x.png`);
      await sharp({ create: { width, height, channels: 4, background: { r: 128, g: 128, b: 128, alpha: 1 } } }).composite(layers).png().toFile(outFile);
      written.push(outFile);
    }
  }
  return written;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const result = await generate({ write: !check, check });
  if (!check) {
    console.log("file".padEnd(20) + "src".padStart(12) + "webp".padStart(8) + "png".padStart(8));
    for (const r of result.rows) console.log(r.file.padEnd(20) + String(r.srcBytes).padStart(12) + String(r.webpBytes).padStart(8) + String(r.pngBytes).padStart(8));
    console.log(`\nwrote ${result.rows.length * 2} files and ${rel(TABLE)} (sharp ${sharp.versions.sharp}, libvips ${sharp.versions.vips})`);
  }
  if (args.includes("--sheets")) {
    const dir = resolve(args[args.indexOf("--sheets") + 1]);
    for (const f of await sheets(dir)) console.log(`sheet ${f}`);
  }
  for (const n of result.notes) console.log(`note  ${n}`);
  for (const p of result.problems) console.log(`FAIL  ${p}`);
  if (check) console.log(result.problems.length ? `\n${result.problems.length} problem(s)` : `\nsmall icons OK: ${result.rows.length * 2} files match a fresh render; originals unchanged`);
  process.exitCode = result.problems.length ? 1 : 0;
}
