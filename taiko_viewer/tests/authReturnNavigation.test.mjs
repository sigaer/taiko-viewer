import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { authReturnNavigationOptions } from "../utils/auth-return-navigation.ts";

test("server-only consent endpoint uses a full document request after login", () => {
  assert.deepEqual(authReturnNavigationOptions("/oidc/interaction/sj4klkXrQQhR54aPg56wnED6dlreBFNikqk0CRVvMk_"), {external:true});
  assert.deepEqual(authReturnNavigationOptions("/oidc/interaction/a-B_0"), {external:true});
});

test("normal Vue pages remain client-side; untrusted or ambiguous redirects are not escalated", () => {
  for (const url of [
    "/account/profile", "/my/growth", "/", "/oidc/auth",
    "//evil.example/oidc/interaction/abc", "/oidc/interaction/",
    "/oidc/interaction/a/b", "/oidc/interaction/abc?next=/",
    "/oidc/interaction/abc#fragment", "/oidc/interaction/%2fabc",
    "/oidc/interaction/abc%0a", "/oidc/interaction/../abc",
    "https://viewer.sakura-bot.cn/oidc/interaction/abc",
  ]) assert.deepEqual(authReturnNavigationOptions(url), {external:false}, url);
});

test("both first login and retry paths use server-route navigation options", () => {
  const vue = readFileSync(new URL("../pages/account/login.vue",import.meta.url), "utf8");
  assert.equal((vue.match(/navigateTo\(redirectAfterLogin\.value, authReturnNavigationOptions\(redirectAfterLogin\.value\)\)/g)||[]).length,2);
});
