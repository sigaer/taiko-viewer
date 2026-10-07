import assert from "node:assert/strict";
import test from "node:test";
import { hasPracticeCourse, isPracticeMessage, playerMessage, PRACTICE_COURSES } from "../utils/ourTaikoView.ts";

test("Viewer difficulty IDs select TJA courses without an off-by-one", () => {
  for (let difficulty = 1; difficulty <= 5; difficulty++) {
    assert.equal(hasPracticeCourse(`COURSE:${difficulty - 1}\n#START\n0,\n#END`, difficulty), true);
    assert.equal(hasPracticeCourse(`COURSE:${PRACTICE_COURSES[difficulty - 1]}\n#START\n0,\n#END`, difficulty), true);
  }
  assert.equal(hasPracticeCourse("COURSE:Edit\n#START\n0,\n#END", 4), false);
  assert.equal(hasPracticeCourse("COURSE:Easy\n// #START", 1), false);
  assert.equal(hasPracticeCourse("TITLE:Example\n#START\n0,\n#END", 4), true);
  assert.equal(hasPracticeCourse("COURSE:Oni\n#START", 0), false);
});

test("player messages require the selected frame, origin and protocol version", () => {
  const source = {} as Window;
  const origin = "https://viewer.sakura-bot.cn";
  const event = { source, origin, data: playerMessage("ready", "request-1") } as MessageEvent;
  assert.equal(isPracticeMessage(event, source, origin), true);
  assert.equal(isPracticeMessage(event, {} as Window, origin), false);
  assert.equal(isPracticeMessage(event, null, origin), false);
  assert.equal(isPracticeMessage(event, source, "https://example.com"), false);
  assert.equal(isPracticeMessage({ ...event, data: { ...event.data, version: 2 } } as MessageEvent, source, origin), false);
});
