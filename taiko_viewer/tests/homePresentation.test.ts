import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveHomePresentation,
  shouldHideHomeChrome,
  shouldShowPersonalRecommendation
} from "../utils/homePresentation.ts";

test("guest receives the new guest home", () => {
  assert.equal(resolveHomePresentation("ready", "guest"), "guest");
});

test("all authenticated states use the personal home", () => {
  assert.equal(resolveHomePresentation("ready", "authenticated_unbound"), "authenticated");
  assert.equal(resolveHomePresentation("ready", "authenticated_bound_empty"), "authenticated");
  assert.equal(resolveHomePresentation("ready", "authenticated_ready"), "authenticated");
});

test("resolver errors use public fallback without becoming guest", () => {
  assert.equal(resolveHomePresentation("error", null), "public_error");
});

test("loading remains neutral", () => {
  assert.equal(resolveHomePresentation("loading", null), "loading");
});

test("all resolved root home presentations hide shared page chrome", () => {
  assert.equal(shouldHideHomeChrome("/", "guest"), true);
  assert.equal(shouldHideHomeChrome("/", "public_error"), true);
  assert.equal(shouldHideHomeChrome("/", "authenticated"), true);
  assert.equal(shouldHideHomeChrome("/", "loading"), false);
  assert.equal(shouldHideHomeChrome("/more", "guest"), false);
});

test("recommendation failure or empty result does not leave an empty card", () => {
  assert.equal(shouldShowPersonalRecommendation(true, false), true);
  assert.equal(shouldShowPersonalRecommendation(false, true), true);
  assert.equal(shouldShowPersonalRecommendation(false, false), false);
});
