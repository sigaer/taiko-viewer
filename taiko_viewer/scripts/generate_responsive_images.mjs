#!/usr/bin/env node

import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const outputDir = resolve(root, "public", "optimized");
await mkdir(outputDir, { recursive: true });

const jobs = [
  ["logo.png", "logo-168.webp", 168, 82],
  ["logo.png", "logo-256.webp", 256, 82],
  ["nijiiro_2026_dan_overview.png", "nijiiro-2026-640.webp", 640, 78],
  ["nijiiro_2026_dan_overview.png", "nijiiro-2026-960.webp", 960, 78],
  ["touhou-2026.png", "touhou-2026-800.webp", 800, 78],
  ["rewards-winter-2026.png", "rewards-winter-2026-800.webp", 800, 78],
  ["Makina.png", "guide-makina-160.webp", 160, 80],
  ["miku.png", "guide-miku-160.webp", 160, 80]
];

for (const [input, output, width, quality] of jobs) {
  await sharp(resolve(root, "public", input))
    .resize({ width, withoutEnlargement: true })
    .webp({ quality })
    .toFile(resolve(outputDir, output));
}

process.stdout.write(`generated ${jobs.length} responsive images in ${outputDir}\n`);
