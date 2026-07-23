import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const manifestPath = resolve(
  process.env.TAIKO_BRANCH_AUDIO_MANIFEST_PATH ||
    resolve(process.cwd(), "..", "..", "songs", "branch_audio_manifest.json")
);
const labels = new Set(["普通", "玄人", "达人"]);
const tracks = new Set(["EASY", "NORMAL", "HARD", "ONI", "EDIT"]);

const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
if (manifest.version !== 1 || !manifest.songs || typeof manifest.songs !== "object") {
  throw new Error("分歧音频清单结构无效");
}

let availableVariantCount = 0;
for (const [songId, songTracks] of Object.entries(manifest.songs)) {
  if (!/^\d+$/.test(songId) || !songTracks || typeof songTracks !== "object") {
    throw new Error(`分歧歌曲键无效: ${songId}`);
  }
  for (const [track, variants] of Object.entries(songTracks)) {
    if (!tracks.has(track) || !Array.isArray(variants) || variants.length === 0) {
      throw new Error(`分歧难度无效: ${songId}/${track}`);
    }
    const signatures = new Set();
    for (const variant of variants) {
      if (!labels.has(variant.label) || typeof variant.available !== "boolean") {
        throw new Error(`分歧变体无效: ${songId}/${track}`);
      }
      if (!Array.isArray(variant.aliases) || variant.aliases.some((alias) => !labels.has(alias))) {
        throw new Error(`分歧别名无效: ${songId}/${track}/${variant.label}`);
      }
      if (!variant.signature || signatures.has(variant.signature)) {
        throw new Error(`分歧谱面未正确去重: ${songId}/${track}`);
      }
      signatures.add(variant.signature);
      if (variant.available) availableVariantCount += 1;
    }
  }
}

const tetoris = manifest.songs["1401"]?.ONI?.filter((variant) => variant.available);
if (tetoris?.length !== 1 || tetoris[0].label !== "达人") {
  throw new Error("1401 Tetoris 应只暴露可达的达人谱面");
}

const madaSaitama = manifest.songs["627"];
if (
  Object.keys(madaSaitama || {}).join(",") !== "ONI" ||
  madaSaitama.ONI.filter((variant) => variant.available)
    .map((variant) => variant.label)
    .join(",") !== "普通,达人"
) {
  throw new Error("627 还是埼玉2000 应只暴露鬼难度的普通/达人谱面");
}

console.log(
  JSON.stringify(
    {
      manifestPath,
      branchSongCount: Object.keys(manifest.songs).length,
      availableVariantCount
    },
    null,
    2
  )
);
