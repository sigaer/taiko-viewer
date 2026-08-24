import test from "node:test";
import assert from "node:assert/strict";
import { resolveHomePresentation } from "../utils/homePresentation.ts";

test("guest receives the new guest home", () => {
  assert.equal(resolveHomePresentation("ready", "guest"), "guest");
});

test("all authenticated states keep the existing fallback", () => {
  assert.equal(resolveHomePresentation("ready", "authenticated_unbound"), "existing");
  assert.equal(resolveHomePresentation("ready", "authenticated_bound_empty"), "existing");
  assert.equal(resolveHomePresentation("ready", "authenticated_ready"), "existing");
});

test("resolver errors use public fallback without becoming guest", () => {
  assert.equal(resolveHomePresentation("error", null), "public_error");
});

test("loading remains neutral", () => {
  assert.equal(resolveHomePresentation("loading", null), "loading");
});
