import assert from "node:assert/strict";
import test from "node:test";
import { zipSync, strToU8 } from "fflate";
import { decodePracticeBundle } from "../utils/practiceBundle.ts";

test("extracts the WAVE basename used by the existing ZIP download", async () => {
  const bytes = zipSync({
    "song.tja": strToU8("TITLE:Test\nWAVE:subfolder/music.ogg\nCOURSE:Oni\n#START\n0,\n#END"),
    "music.ogg": new Uint8Array([1, 2, 3]),
    "unrelated.mp3": new Uint8Array([9])
  });
  const result = await decodePracticeBundle(bytes, new AbortController().signal);
  assert.equal(result.audioType, "ogg");
  assert.equal(result.audioBlob.type, "audio/ogg");
  assert.equal(result.audioBlob.size, 3);
  assert.equal(Buffer.from(await result.audioBlob.arrayBuffer()).equals(Buffer.from([1, 2, 3])), true);
  assert.match(result.chartText, /COURSE:Oni/);
});

test("does not substitute unrelated audio when WAVE is missing", async () => {
  const bytes = zipSync({ "song.tja": strToU8("WAVE:missing.ogg"), "other.ogg": new Uint8Array([1]) });
  await assert.rejects(decodePracticeBundle(bytes, new AbortController().signal), /Matching WAVE/);
});

test("rejects ambiguous charts and canceled extraction", async () => {
  const bytes = zipSync({ "a.tja": strToU8("WAVE:a.ogg"), "b.tja": strToU8("WAVE:b.ogg") });
  await assert.rejects(decodePracticeBundle(bytes, new AbortController().signal), /one TJA/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(decodePracticeBundle(bytes, controller.signal), { name: "AbortError" });
});
