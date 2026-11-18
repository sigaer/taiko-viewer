// Slice E1 (account: sign-in, registration, recovery, profile, settings) — source-level checks that the rework kept the
// behaviour: request bodies, guards and confirmations, autofill attributes, the moved copy, the showcase labels.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const zh = JSON.parse(await read("locales/zh.json"));
const ja = JSON.parse(await read("locales/ja.json"));
const get = (obj, key) => key.split(".").reduce((o, k) => o?.[k], obj);
const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, `${p}${k}.`) : [`${p}${k}`]));

const PAGES = ["pages/account/login.vue", "pages/account/register.vue", "pages/account/forgot-password.vue", "pages/account/profile.vue", "pages/settings.vue"];
const COMPONENTS = ["AuthFrame", "OidcOptions", "ProfileLayout", "ProfileSection", "ProfileIdentity", "ProfileBindings", "ProfileQq", "ProfileSignIn", "ProfileMyDon", "Settings"].map((n) => `components/rework/account/${n}.vue`);

test("rework.account copy: same key paths in zh and ja, every static key used by the pages and components exists", async () => {
  assert.deepEqual(flat(zh.rework.account).sort(), flat(ja.rework.account).sort());
  for (const file of [...PAGES, ...COMPONENTS]) {
    const src = await read(file);
    for (const [, key] of src.matchAll(/\bt\(\s*["'`](rework\.account\.[\w.]+)["'`]/g)) {
      assert.equal(typeof get(zh, key), "string", `${file}: zh ${key}`);
      assert.equal(typeof get(ja, key), "string", `${file}: ja ${key}`);
    }
    for (const [, prefix, name] of src.matchAll(/\b([pskfr])\(\s*["'](\w+(?:\.\w+)?)["']/g)) {
      const base = { p: "rework.account.profile", s: "rework.account.settings", k: "rework.account.oidc", f: "rework.account.forgot", r: "rework.account.register" }[prefix];
      if (!base) continue;
      assert.equal(typeof get(zh, `${base}.${name}`), "string", `${file}: zh ${base}.${name}`);
      assert.equal(typeof get(ja, `${base}.${name}`), "string", `${file}: ja ${base}.${name}`);
    }
    assert.doesNotMatch(src, /locale(?:\.value)?\s*===\s*["']ja["']\s*\?/, `${file}: no inline bilingual tables`);
  }
});

test("security and destructive wording kept its exact text (zh / ja)", () => {
  const p = (l, k) => get(l, `rework.account.profile.${k}`);
  assert.equal(p(zh, "lastBindingConfirm"), "这是你最后一个鼓众 ID。删除后，网页中的当前绑定、我的小咚和歌曲数据入口都会失去关联，请再次确认。");
  assert.equal(p(ja, "lastBindingConfirm"), "これは最後のドンダーひろば ID です。削除すると現在の連携、マイドン、楽曲データ入口が未連携になります。削除しますか？");
  assert.equal(p(zh, "deleteManualConfirm"), "将删除两端绑定和全部成绩历史，此操作无法在页面中撤销。");
  assert.equal(p(ja, "deleteManualConfirm"), "両端の連携と全スコア履歴を削除します。この操作は通常の画面から元に戻せません。");
  assert.equal(p(zh, "detachConfirm"), "只解除 viewer 端绑定，bot 端和成绩会保留。");
  assert.equal(p(zh, "deleteConfirm"), "确定删除绑定的鼓众 ID {id} 吗？");
  assert.equal(p(zh, "qqUnbindConfirm"), "确定解除 QQ {qq} 的绑定吗？");
  assert.equal(get(zh, "rework.account.oidc.conflict"), "该邮箱已注册。请先登录原账号，再主动关联。");
  assert.equal(get(zh, "rework.account.completion.sessionChanged"), "登录会话已变化，请重新输入密码。");
});

test("sign-in pages: request bodies, autofill attributes, the submit class and the guards are unchanged", async () => {
  const login = await read("pages/account/login.vue");
  assert.match(login, /apiFetch<\{user: \{id: number\}\}>\("\/api\/account\/auth\/login", \{method: "POST", body: \{identifier: form\.identifier, password: form\.password\}\}\)/);
  assert.match(login, /name="username" autocomplete="username"/);
  assert.match(login, /name="password" autocomplete="current-password"/);
  assert.match(login, /class="rw-btn rw-btn--primary rw-btn--block submit-btn"[^>]*:disabled="submitting"/);
  assert.match(login, /middleware: "account-guest"/);
  assert.match(login, /target\.startsWith\("\/"\) && !target\.startsWith\("\/\/"\) && !\/\[\\\\\\r\\n\]\/\.test\(target\)/);
  const register = await read("pages/account/register.vue");
  assert.match(register, /body: \{\s*email: form\.email,\s*purpose: "register",\s*\}/);
  assert.match(register, /\{method: "POST", body: \{username: form\.username, email: form\.email, code: form\.code, password: form\.password\}\}/);
  assert.match(register, /:disabled="sendingCode \|\| cooldown > 0 \|\| registered"/);
  assert.match(register, /cooldown\.value = 60;/);
  assert.equal((register.match(/autocomplete="one-time-code"/g) || []).length, 1);
  const forgot = await read("pages/account/forgot-password.vue");
  assert.match(forgot, /body: \{\s*email: form\.email,\s*purpose: "reset"\s*\}/);
  assert.match(forgot, /\{method: "POST", body: \{email: form\.email, code: form\.code, password: form\.password\}\}/);
  assert.match(forgot, /:disabled="sendingCode \|\| cooldown > 0 \|\| completed"/);
  for (const src of [register, forgot]) {
    // the mismatch check still runs before any request, and only adds presentation (touched flag, focus)
    assert.match(src, /form\.password !== form\.confirmPassword\) \{ ElMessage\.error\(copy\.value\.passwordMismatch\); confirmTouched\.value = true; confirmInput\.value\?\.focus\(\); return; \}/);
    assert.match(src, /role="alert">\{\{ codeError \}\}/);
  }
});

test("OIDC options: moved component, same start request, outbound assignment and error codes", async () => {
  const src = await read("components/rework/account/OidcOptions.vue");
  await assert.rejects(read("components/account/OidcOptions.vue"));
  assert.match(src, /method: "POST", body: \{ purpose: props\.purpose, redirect: props\.redirect, locale: locale\.value, recover: provider\.recoveryAvailable === true \}/);
  assert.match(src, /if \(scope\.current\(ticket\)\) window\.location\.assign\(result\.authorizationUrl\);/);
  for (const code of ["ourtaiko_email_unverified", "ourtaiko_rate_limited", "existing_viewer_required", "email_conflict", "email_required", "session_changed", "identity_conflict"]) assert.ok(src.includes(`code === "${code}"`), code);
  assert.match(src, /:disabled="Boolean\(busy\)"/);
  // the provider label keeps the original word order
  const fill = (l, k, provider) => get(l, `rework.account.oidc.${k}`).replace("{provider}", provider);
  assert.equal(fill(zh, "loginWith", "OurTaiko"), "登录 OurTaiko");
  assert.equal(fill(ja, "loginWith", "OurTaiko"), "OurTaikoでログイン");
  assert.equal(fill(zh, "linkWith", "OurTaiko"), "关联 OurTaiko");
  assert.equal(fill(ja, "linkWith", "OurTaiko"), "OurTaikoを連携");
});

test("profile: confirmations, their order and the request bodies are unchanged; destructive actions are outlined danger", async () => {
  const page = await read("pages/account/profile.vue");
  const remove = page.slice(page.indexOf("const deleteBinding = async"), page.indexOf("const prepareQqBinding"));
  assert.ok(remove.indexOf("ElMessageBox.confirm(") < remove.indexOf("if (isLastBinding)"));
  assert.ok(remove.indexOf("copy.value.lastBindingConfirm") < remove.indexOf('apiFetch("/api/account/bindings/remove"'));
  assert.match(remove, /body: \{\s*bindingId: binding\.id,\s*force: isLastBinding\s*\}/);
  for (const [fn, request] of [["detachManual", 'action: "detach"'], ["permanentlyDeleteManual", 'action: "delete-account"'], ["removeQqBinding", '"/api/account/qq/remove"']]) {
    const body = page.slice(page.indexOf(`const ${fn} = async`));
    assert.ok(body.indexOf("ElMessageBox.confirm(") >= 0 && body.indexOf("ElMessageBox.confirm(") < body.indexOf(request), `${fn}: confirmation first`);
  }
  assert.match(page, /confirmed: true/);
  assert.match(page, /const \{ data, pending, refresh \} = useAsyncData<ProfilePayload>/);
  assert.match(page, /body: \{ taikoId: bindingInput\.value\.trim\(\) \}/);
  const bindings = await read("components/rework/account/ProfileBindings.vue");
  for (const key of ["manualDetach", "manualDelete", "deleteBinding"]) assert.match(bindings, new RegExp(`rw-btn--danger"[^>]*>\\{\\{ p\\("${key}"\\) \\}\\}`), key);
  assert.match(bindings, /:disabled="deletingId === binding\.id"/);
  assert.match(bindings, /:disabled="switchingId === binding\.id"/);
  assert.match(bindings, /:disabled="manualLoading \|\| !manualNickname\.trim\(\)"/);
  assert.ok(bindings.indexOf('class="pending-box"') < bindings.indexOf('class="manual-account-panel"'));
  const qq = await read("components/rework/account/ProfileQq.vue");
  assert.equal((qq.match(/rw-btn--danger/g) || []).length, 2);
  assert.match(qq, /:disabled="confirming \|\| !verifyCode\.trim\(\)"/);
  for (const file of COMPONENTS) assert.doesNotMatch(await read(file), /DanBadge|dan_?name|got_dan|\bdan\b/i, `${file}: no dan data`);
});

test("profile: section navigation writes no URL state; identity uses the DS avatar, plate and site title", async () => {
  const layout = await read("components/rework/account/ProfileLayout.vue");
  assert.match(layout, /@click\.prevent="go\(section\.id\)"/);
  assert.doesNotMatch(layout, /history\.|router\.|location\.hash/);
  assert.match(layout, /@media \(min-width: 1100px\)/);
  const identity = await read("components/rework/account/ProfileIdentity.vue");
  for (const tag of ["DsPlayerAvatar", "DsTitlePlate", "DsSiteTitle"]) assert.ok(identity.includes(`<${tag}`), tag);
  const ids = await read("utils/rework/account.ts");
  assert.match(ids, /bindings: "account-bindings"/);
});

test("showcase option labels: same text as the former inline tables (zh and ja)", async () => {
  const original = `${await readFile(new URL("./fixtures/profile-showcase-labels-original.txt", import.meta.url), "utf8")}`;
  const page = await read("pages/account/profile.vue");
  const current = page.slice(page.indexOf("const formatShowcaseRequirement"), page.indexOf("const getShowcaseSlotOptions"));
  const { showcaseRequirementKey, showcaseScopeKey } = await import("../utils/rework/account.ts");
  const options = [];
  for (const requirementType of ["all_perfect", "full_combo", "clear", "other"])
    for (const difficultyScope of ["inner_oni", "oni_or_inner_oni", "oni", "hard", "normal", "easy", "any", "x"])
      for (const source of ["official", "custom"]) options.push({ titleName: "称号", requirementType, difficultyScope, source, songNames: source === "custom" ? ["曲A", "曲B"] : [], constValue: difficultyScope === "oni" ? 9.25 : 0 });
  for (const [lang, messages] of [["zh", zh], ["ja", ja]]) {
    const t = (key) => get(messages, key);
    const copy = { value: { customPrefix: t("rework.account.profile.customPrefix"), songPrefix: t("rework.account.profile.songPrefix") } };
    const make = (code, extra) => new Function("locale", "t", "copy", "showcaseRequirementKey", "showcaseScopeKey", stripTypeScriptTypes(code, { mode: "strip" }) + extra);
    const before = make(original, ";return formatShowcaseOptionLabel;")({ value: lang }, t, copy, showcaseRequirementKey, showcaseScopeKey);
    const after = make(current, ";return formatShowcaseOptionLabel;")({ value: lang }, t, copy, showcaseRequirementKey, showcaseScopeKey);
    for (const option of options) assert.equal(after(option), before(option), `${lang} ${JSON.stringify(option)}`);
  }
});

test("settings: the site's cookie theme (no system option), the shell's language links, cache clear unchanged", async () => {
  const page = await read("pages/settings.vue");
  assert.match(page, /const \{ theme \} = useViewerTheme\(\);/);
  assert.match(page, /switchLocalePath\("zh"\)/);
  assert.match(page, /localStorage\.clear\(\);/);
  const view = await read("components/rework/account/Settings.vue");
  assert.doesNotMatch(view.slice(view.indexOf("<template>")), /system|prefers-color-scheme/);
  assert.equal((view.match(/emit\('update:theme', '(light|dark)'\)/g) || []).length, 2, "two choices: light, dark");
  assert.match(view, /emit\('update:theme', 'dark'\)/);
});
