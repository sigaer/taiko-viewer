#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const manifestPath = resolve(process.cwd(), ".nuxt", "dist", "server", "client.manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const targets = ["pages/index.vue", "pages/songs/available.vue", "pages/songs/removed.vue", "pages/songs/[id].vue"];
const forbidden = ["/admin/", "version-summary", "/annual/", "echarts", "gsap", "qrcode"];

const collect = (entryKey, visited = new Set()) => {
  if (!entryKey || visited.has(entryKey)) return visited;
  visited.add(entryKey);
  const entry = manifest[entryKey];
  if (!entry) return visited;
  for (const dependency of entry.imports || []) {
    collect(dependency, visited);
  }
  return visited;
};

let failed = false;
for (const target of targets) {
  const entryKey = Object.keys(manifest).find((key) => key.endsWith(target));
  if (!entryKey) {
    process.stderr.write(`route entry missing: ${target}\n`);
    failed = true;
    continue;
  }
  const keys = [...collect(entryKey)];
  const files = keys.flatMap((key) => {
    const entry = manifest[key];
    return [entry?.file, ...(entry?.css || [])].filter(Boolean);
  });
  const leaks = keys.filter((key) => forbidden.some((needle) => key.toLowerCase().includes(needle)));
  process.stdout.write(`${JSON.stringify({ target, entryKey, files, leaks })}\n`);
  if (leaks.length) failed = true;
}

if (failed) process.exitCode = 1;
