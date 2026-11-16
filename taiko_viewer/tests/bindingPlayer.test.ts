import assert from "node:assert/strict";
import test from "node:test";
import { selectBindingPlayer } from "../server/internal/account/binding-player.ts";

test("Chinese, Japanese and emoji nicknames resolve to numeric IDs", () => {
  for (const nickname of ["星之卡比咚", "どんちゃん", "小咚 🌸"]) {
    const player = selectBindingPlayer([{ userid: "12345678", mydon_name: nickname }], nickname, true);
    assert.equal(player.userid, "12345678");
    assert.equal(player.mydon_name, nickname);
  }
});

test("numeric verification uses exact IDs even when another nickname matches", () => {
  const rows = [{ userid: "8", mydon_name: "123" }, { userid: 123, mydon_name: "中文昵称" }];
  assert.equal(selectBindingPlayer(rows, "123", true).userid, "123");
  assert.throws(() => selectBindingPlayer(rows, "中文昵称"), { statusCode: 404 });
});

test("ambiguous or fuzzy nickname matches never select the first player", () => {
  assert.throws(() => selectBindingPlayer([
    { userid: "1", mydon_name: "小咚" }, { userid: "2", mydon_name: "小咚" }
  ], "小咚", true), { statusCode: 409 });
  assert.throws(() => selectBindingPlayer([{ userid: "1", mydon_name: "小咚咚" }], "小咚", true), { statusCode: 404 });
});

test("unsafe numeric and nonnumeric upstream IDs never become binding identities", () => {
  for (const id of [Number.MAX_SAFE_INTEGER + 1, "../private", "中文ID", "9".repeat(26), null]) {
    assert.throws(() => selectBindingPlayer([{ userid: id, mydon_name: "小咚" }], "小咚", true), { statusCode: 404 });
  }
});
