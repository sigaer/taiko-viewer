import test from "node:test";
import assert from "node:assert/strict";
import { resolveDifficultyPresentation } from "../utils/difficulty.ts";

const song = { level_1: 3, level_2: 5, level_3: 7, level_4: 10, level_5: 10 };

test("difficulty type resolves its own catalog star level", () => {
  assert.deepEqual(resolveDifficultyPresentation(song, 1), { difficultyType: 1, difficultyKey: "difficulty.1", starLevel: 3 });
  assert.deepEqual(resolveDifficultyPresentation(song, 2), { difficultyType: 2, difficultyKey: "difficulty.2", starLevel: 5 });
  assert.deepEqual(resolveDifficultyPresentation(song, 3), { difficultyType: 3, difficultyKey: "difficulty.3", starLevel: 7 });
  assert.deepEqual(resolveDifficultyPresentation(song, 4), { difficultyType: 4, difficultyKey: "difficulty.4", starLevel: 10 });
  assert.deepEqual(resolveDifficultyPresentation(song, 5), { difficultyType: 5, difficultyKey: "difficulty.5", starLevel: 10 });
});

test("missing catalog level never falls back to the difficulty code", () => {
  assert.equal(resolveDifficultyPresentation({ level_4: undefined }, 4).starLevel, null);
  assert.equal(resolveDifficultyPresentation({ level_5: undefined }, 5).starLevel, null);
});
