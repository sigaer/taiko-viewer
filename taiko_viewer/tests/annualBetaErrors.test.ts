import assert from "node:assert/strict";
import test from "node:test";
import { annualBetaInviteErrorMessage } from "../utils/annualBetaErrors.ts";

test("annual beta invite errors explain the next action in Chinese", () => {
  assert.equal(
    annualBetaInviteErrorMessage({ data: { data: { code: "used_invite" } } }, "zh"),
    "此邀请码已被使用，请联系发放者获取新的邀请码。"
  );
  assert.equal(
    annualBetaInviteErrorMessage({ data: { data: { code: "invalid_invite" } } }, "zh"),
    "邀请码无效，请确认输入完整且没有多余字符。"
  );
});

test("annual beta invite errors support Japanese and flat error payloads", () => {
  assert.equal(
    annualBetaInviteErrorMessage({ data: { code: "expired_invite" } }, "ja"),
    "この招待コードは期限切れです。新しいコードを発行元にお問い合わせください。"
  );
});

test("annual beta invite errors preserve an unknown server message", () => {
  assert.equal(
    annualBetaInviteErrorMessage({ data: { statusMessage: "请稍后再试" } }, "zh"),
    "请稍后再试"
  );
  assert.equal(annualBetaInviteErrorMessage(new Error("network"), "zh"), "");
});
