// P0-20 DsPlayerAvatar: uploaded → default /default-avatar.svg; server default URL = no avatar; failures → default.
import test from "node:test";
import assert from "node:assert/strict";
import { attrs, loadDs, render } from "./dsHarness.mjs";
import { SERVER_DEFAULT_AVATAR_URL } from "../utils/ds/avatar.ts";

const { avatarSrc, failedBeforeListener, DS_AVATAR_SIZES } = await loadDs("PlayerAvatar");

test("avatar: source selection", () => {
  assert.equal(avatarSrc("/pwa-192x192.png", false), "/pwa-192x192.png");
  assert.equal(avatarSrc("/pwa-192x192.png", true), "/default-avatar.svg");
  assert.equal(avatarSrc(SERVER_DEFAULT_AVATAR_URL, false), "/default-avatar.svg");
  assert.equal(avatarSrc("https://forum.sakura-bot.cn/miku.png", false), "/default-avatar.svg");
  assert.equal(avatarSrc("/miku.png", false), "/miku.png", "the local file is an ordinary image, not the server placeholder");
  assert.equal(avatarSrc(null, false), "/default-avatar.svg");
  assert.equal(avatarSrc("  ", false), "/default-avatar.svg");
});

test("avatar: an image that finished without decoding counts as failed (SSR before hydration)", () => {
  assert.equal(failedBeforeListener({ complete: true, naturalWidth: 0 }), true);
  assert.equal(failedBeforeListener({ complete: true, naturalWidth: 64 }), false);
  assert.equal(failedBeforeListener({ complete: false, naturalWidth: 0 }), false);
  assert.equal(failedBeforeListener(null), false);
});

test("avatar SSR: sizes 24–96, fixed box, decorative unless labelled", async () => {
  assert.deepEqual([...DS_AVATAR_SIZES], [24, 32, 44, 72, 96]);
  for (const size of DS_AVATAR_SIZES) {
    for (const [src, expected, kind] of [
      ["/pwa-192x192.png", "/pwa-192x192.png", "user"],
      [SERVER_DEFAULT_AVATAR_URL, "/default-avatar.svg", "default"],
      [null, "/default-avatar.svg", "default"]
    ]) {
      const html = await render("PlayerAvatar", { src, size });
      const [root] = attrs(html, "span");
      assert.equal(root.style, `width:${size}px;height:${size}px;`);
      assert.equal(root["aria-hidden"], "true");
      assert.equal(root["data-avatar"], kind);
      const [img] = attrs(html, "img");
      assert.deepEqual([img.src, img.width, img.height, img.alt], [expected, String(size), String(size), ""]);
    }
  }
  const labelled = attrs(await render("PlayerAvatar", { src: null, label: "x" }), "span")[0];
  assert.deepEqual([labelled.role, labelled["aria-label"], labelled["aria-hidden"]], ["img", "x", undefined]);
});
