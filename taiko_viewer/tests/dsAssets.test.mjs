// P0-11 / P0-12: real game assets are byte-identical to the production originals, value ↔ file mappings hold,
// and the generated small icons are complete and reproducible.
//
// Expected bytes / md5 are the production files at origin/main f9b39e6, as recorded when they were copied into the
// design prototype (preview/redesign-v1/public/game/README.md). Any re-encode, recolour or replacement fails here.
// Text files (.json, .svg) are compared with LF line endings so a Windows checkout with autocrlf still passes.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { SCORE_RANK_DEFINITIONS } from "../utils/scoreRank.ts";
import { rankAssetName, smallSrc, diffIconSrc, crownIconSrc, titlePlateAsset, DS_PLATE_IDS, DS_SMALL_SIZES } from "../utils/ds/gameAssets.ts";
import { generate, SETS } from "../scripts/ds/generate_small_game_icons.mjs";

const pub = new URL("../public/", import.meta.url);
const bytesOf = (rel) => {
  const buf = readFileSync(new URL(rel, pub));
  return /\.(json|svg)$/.test(rel) ? Buffer.from(buf.toString("utf8").replace(/\r\n/g, "\n"), "utf8") : buf;
};
const md5 = (buf) => createHash("md5").update(buf).digest("hex");

export const ORIGINALS = {
  "icons/diff/1.png": [5998, "5a544189fb53b345d929316e559c267a"],
  "icons/diff/2.png": [6167, "6bdb8171438778ca6582ac42e7623700"],
  "icons/diff/3.png": [7494, "f25270386364a2409de9944d1ad96e87"],
  "icons/diff/4.png": [6128, "e35e1da93f0a8b2a0219697943dbacbf"],
  "icons/diff/5.png": [5996, "02a6158c1e1718499354228aa920175b"],
  "icons/crown/clear.png": [10082, "bdd523f9755ec6e6349fe94afbc3ea0b"],
  "icons/crown/full.png": [10106, "f8a3078297763a8a00913e64c9a3d02e"],
  "icons/crown/dondaful.png": [12811, "6a4f13b48c66e5dd96514f685051ce97"],
  "icons/rank/2.png": [18978, "5b63c33efdc0c175901b38bc8e672414"],
  "icons/rank/3.png": [29867, "4ea3887e3be73874850fc4029243f48c"],
  "icons/rank/4.png": [32184, "94b45e36574c2ff789d17c8ad14775dc"],
  "icons/rank/5.png": [33877, "492c61a9ebf6daa25641569a3d83f773"],
  "icons/rank/6.png": [37829, "0be53a8efeab6f90ce123f99d3dc5d03"],
  "icons/rank/7.png": [41690, "bcff16939a467c45e97488fbf4e9ab48"],
  "icons/rank/8.png": [34452, "b4a70c9f3673979cf80fdd8d71db78ef"],
  "assets/my-don/title-plate-slices/name_plate_0_slice.png": [3509, "fccdef744caaddc79761358d0b1ef05c"],
  "assets/my-don/title-plate-slices/name_plate_1_slice.png": [2205, "24f9bfe2af329092d2db00076b32fc3c"],
  "assets/my-don/title-plate-slices/name_plate_2_slice.png": [5989, "7c930646f6ca0d5114b16d5f425e8609"],
  "assets/my-don/title-plate-slices/name_plate_41_slice.png": [19984, "18279b673ff8a92086c1ac7930b3da01"],
  "assets/my-don/title-plate-slices/name_plate_42_slice.png": [23716, "0f03bd57bbd566e231f72eb4d9d2cc9e"],
  "assets/my-don/title-plate-slices/name_plate_43_slice.png": [25693, "647e2c5dd22fd21c73c0d6123d96ca0c"],
  "assets/my-don/title-plate-slices/name_plate_59_slice.png": [23944, "3a817b98f5d04a6c79d80c6ff02c75df"],
  "assets/my-don/title-plate-slices/name_plate_60_slice.png": [22979, "5d8dc43ef581501f72ac2663e2cb1090"],
  "assets/my-don/title-plate-slices/name_plate_61_slice.png": [28542, "1c1606a31a4f85860dd503ca409fffdd"],
  "assets/my-don/custom-title/name_plate_custom_gold.png": [25157, "9806fdf72034db48666b51acb6675930"],
  "assets/my-don/custom-title/name_plate_custom_rainbow.png": [23642, "cb4832bb3cc46aa983ec77da8a0fac32"],
  "assets/my-don/custom-title/name_plate_custom_sliver.png": [24250, "c91ae49e986c73519e29d5f73fc0c1ac"],
  "miku.png": [94392, "6d8d6ad42ced3b13ab5160ba602e3902"],
  "default-avatar.svg": [501, "4af34fa6aa1d988e50f051df0073d49b"]
};

test("every referenced original is byte-identical to production (size + md5)", () => {
  for (const [rel, [bytes, hash]] of Object.entries(ORIGINALS)) {
    assert.ok(existsSync(new URL(rel, pub)), `missing ${rel}`);
    const buf = bytesOf(rel);
    assert.equal(buf.length, bytes, `${rel} size`);
    assert.equal(md5(buf), hash, `${rel} md5`);
  }
});

test("legacy icons/difficulty copies are still present and identical to icons/diff (kept, not used by new code)", () => {
  for (let d = 1; d <= 5; d++) assert.ok(bytesOf(`icons/difficulty/${d}.png`).equals(bytesOf(`icons/diff/${d}.png`)));
});

test("every path the utilities produce exists", () => {
  for (let d = 1; d <= 5; d++) assert.ok(existsSync(new URL(diffIconSrc(d).slice(1), pub)));
  for (const s of ["dondaful", "full", "clear"]) assert.ok(existsSync(new URL(crownIconSrc(s).slice(1), pub)));
  for (const id of [...DS_PLATE_IDS, "custom_sliver", "custom_gold", "custom_rainbow"]) assert.ok(existsSync(new URL(titlePlateAsset(id).src.slice(1), pub)), String(id));
});

test("rank values 2–8 map to rank/{n}.png with production names; 0 and 1 have no image", () => {
  assert.deepEqual(
    SCORE_RANK_DEFINITIONS.map((d) => [d.value, d.zhName, d.jaName]),
    [
      [0, "未设置", "未設定"],
      [1, "未取得", "未取得"],
      [2, "白粹", "白粋"],
      [3, "铜粹", "銅粋"],
      [4, "银粹", "銀粋"],
      [5, "金雅", "金雅"],
      [6, "粉雅", "桃雅"],
      [7, "紫雅", "紫雅"],
      [8, "极", "極"]
    ],
    "names agree with 04 §7.6"
  );
  for (const def of SCORE_RANK_DEFINITIONS) {
    const name = rankAssetName(def.value);
    if (def.value <= 1) assert.equal(name, null);
    else {
      assert.equal(name, String(def.value));
      assert.ok(existsSync(new URL(`icons/rank/${name}.png`, pub)));
    }
  }
});

test("title-plate manifest: all numbered slices have verified bytes, dimensions and text bands", () => {
  const manifest = JSON.parse(bytesOf("assets/my-don/title-plate-slices/manifest.json").toString("utf8"));
  assert.equal(manifest.items.length, 73);
  assert.equal(manifest.cropRule.removeBottomPx, 45);
  for (const item of manifest.items) {
    const bytes = bytesOf(item.outputFile.slice(1));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), item.sha256, `plate ${item.plateId} digest`);
    assert.equal(bytes.readUInt32BE(16), item.width);
    assert.equal(bytes.readUInt32BE(20), item.height);
    assert.ok(item.textBand.top >= 0 && item.textBand.bottom <= item.height);
    assert.ok(item.textBand.bottom > item.textBand.top);
    assert.ok(item.textBand.art === null || item.textBand.art < item.width);
    assert.equal(titlePlateAsset(item.plateId).src, item.outputFile);
    assert.deepEqual(titlePlateAsset(item.plateId).textBand, item.textBand);
  }
});

test("small icons: every size has WebP and PNG, and every smallSrc candidate exists", () => {
  for (const set of SETS) {
    assert.deepEqual(set.sizes, [...DS_SMALL_SIZES[set.dir]]);
    for (const size of set.sizes) for (const name of set.files) for (const ext of ["webp", "png"]) assert.ok(existsSync(new URL(`icons/${set.dir}/${size}/${name}.${ext}`, pub)), `${set.dir}/${size}/${name}.${ext}`);
  }
  for (const draw of [16, 18, 22, 30, 48]) {
    const s = smallSrc("crown", "dondaful", draw);
    for (const url of [...s.webp.split(", "), ...s.png.split(", ")].map((x) => x.split(" ")[0])) assert.ok(existsSync(new URL(url.slice(1), pub)), url);
  }
});

test("small icons are reproducible (--check) and the originals stay unchanged", async () => {
  const result = await generate({ check: true });
  assert.deepEqual(result.problems, []);
  for (const rel of Object.keys(ORIGINALS).filter((r) => r.startsWith("icons/"))) assert.equal(md5(bytesOf(rel)), ORIGINALS[rel][1]);
});
