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
  ["2026_autumn.png", "2026-autumn-800.webp", 800, 78],
  ["banner_16_9.png", "huali-esports-800.webp", 800, 78]
];

for (const [input, output, width, quality] of jobs) {
  await sharp(resolve(root, "public", input))
    .resize({ width, withoutEnlargement: true })
    .webp({ quality })
    .toFile(resolve(outputDir, output));
}

process.stdout.write(`generated ${jobs.length} responsive images in ${outputDir}\n`);
