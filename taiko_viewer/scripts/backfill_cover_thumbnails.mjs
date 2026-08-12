#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import OSS from "ali-oss";
import sharp from "sharp";

const args = new Set(process.argv.slice(2));
const upload = args.has("--upload");
const check = args.has("--check");
const force = args.has("--force");
const concurrencyArg = process.argv.find((arg) => arg.startsWith("--concurrency="));
const concurrency = Math.min(12, Math.max(1, Number(concurrencyArg?.split("=")[1] || 4)));
const coverDirArg = process.argv.find((arg) => arg.startsWith("--cover-dir="));
const coverDir = resolve(coverDirArg?.slice("--cover-dir=".length) || "/home/sigaer/taiko/assets/cover");
const sizes = [200, 400];

const parseIni = (content) => Object.fromEntries(content.split(/\r?\n/).map((line) => {
  const index = line.indexOf("=");
  return index > 0 ? [line.slice(0, index).trim(), line.slice(index + 1).trim()] : ["", ""];
}).filter(([key]) => key));

const fallback = await readFile("/root/.ossutilconfig", "utf8").then(parseIni).catch(() => ({}));
const client = (upload || check) ? new OSS({
  endpoint: process.env.OSS_ENDPOINT || fallback.endpoint,
  region: process.env.OSS_REGION || undefined,
  bucket: process.env.OSS_BUCKET || "sigaer",
  accessKeyId: process.env.OSS_ACCESS_KEY_ID || fallback.accessKeyID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || fallback.accessKeySecret
}) : null;

const names = (await readdir(coverDir)).filter((name) => /^\d+\.png$/i.test(name)).sort((a, b) => Number(a.split(".")[0]) - Number(b.split(".")[0]));
let cursor = 0;
let generated = 0;
let uploaded = 0;
let skipped = 0;
let missing = 0;

const exists = async (key) => {
  try { await client.head(key); return true; } catch (error) {
    if (Number(error?.status || error?.statusCode || 0) === 404) return false;
    throw error;
  }
};

const processCover = async (name) => {
  const songId = Number(name.replace(/\.png$/i, ""));
  const source = resolve(coverDir, name);
  for (const size of sizes) {
    const key = `cover/thumb/${size}/${songId}.webp`;
    if (check) {
      if (!(await exists(key))) missing += 1;
      else skipped += 1;
      continue;
    }
    if (upload && !force && await exists(key)) {
      skipped += 1;
      continue;
    }
    const buffer = await sharp(source).resize(size, size, { fit: "cover" }).webp({ quality: 78 }).toBuffer();
    generated += 1;
    if (upload) {
      await client.put(key, buffer, { headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable"
      }});
      uploaded += 1;
    }
  }
};

const worker = async () => {
  while (cursor < names.length) {
    const index = cursor++;
    await processCover(names[index]);
    if ((index + 1) % 50 === 0) process.stdout.write(`processed ${index + 1}/${names.length}\n`);
  }
};

await Promise.all(Array.from({ length: concurrency }, worker));
process.stdout.write(JSON.stringify({ covers: names.length, generated, uploaded, skipped, missing, mode: check ? "check" : upload ? "upload" : "dry-run" }, null, 2) + "\n");
if (check && missing > 0) process.exitCode = 1;
