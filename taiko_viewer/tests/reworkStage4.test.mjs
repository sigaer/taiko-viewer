// Slice E2 (sync, developer pages, support) adds its checks at the end of this file.
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

// ---------- Slice E2: sync, developer, support ----------
const E2_ORIGINAL = JSON.parse(await read("tests/fixtures/e2-copy-original.json"));
const E2_DROPPED = {
  sync: ["intro", "targetsDesc", "lastSyncDesc", "cooldownStatus"],
  developer: ["stateDesc", "historyDesc"],
  developerReview: ["pendingDesc", "historyDesc"],
  support: ["formDesc", "historyDesc", "loading"],
  supportReview: ["pendingDesc", "historyDesc", "selectTicket"],
  grants: []
};
const E2_PAGES = {
  "pages/account/sync.vue": ["SYNC_COPY_KEYS", "rework.account.sync"],
  "pages/account/developer/index.vue": ["DEVELOPER_COPY_KEYS", "rework.account.developer"],
  "pages/account/developer/review.vue": ["REVIEW_COPY_KEYS", "rework.account.developerReview"],
  "pages/account/developer/grants.vue": ["GRANTS_COPY_KEYS", "rework.account.grants"],
  "pages/support.vue": ["SUPPORT_COPY_KEYS", "rework.account.support"],
  "pages/account/support/review.vue": ["SUPPORT_REVIEW_COPY_KEYS", "rework.account.supportReview"],
  "pages/docs/score-token.vue": [null, "rework.account.scoreTokenDocs"]
};
const E2_COMPONENTS = [
  ...["Overview", "LastSync", "ScoreToken", "Kinoko", "GoalResult", "NextSteps", "IndicatorSource"].map((n) => `components/rework/sync/${n}.vue`),
  ...["Status", "ApplyForm", "Applications", "Review", "ApiGuide"].map((n) => `components/rework/developer/${n}.vue`),
  ...["Tickets", "Review"].map((n) => `components/rework/support/${n}.vue`),
  "components/rework/ScoreTokenDocs.vue"
];
const loadTs = async (path) => {
  const code = stripTypeScriptTypes(await read(path), { mode: "strip" });
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
};

test("E2 copy: the moved zh / ja tables are verbatim; only the listed explanatory subtitles were dropped", () => {
  for (const lang of ["zh", "ja"]) {
    const L = lang === "zh" ? zh : ja;
    const acc = L.rework.account;
    const o = E2_ORIGINAL;
    for (const [ns, table] of [["sync", o.sync[lang].copy], ["developer", o.developer[lang].copy], ["grants", o.grants[lang].copy], ["developerReview", o.developerReview[lang].copy], ["support", o.support[lang].copy], ["supportReview", o.supportReview[lang].copy]]) {
      for (const [key, text] of Object.entries(table)) {
        if (E2_DROPPED[ns].includes(key)) assert.equal(acc[ns][key], undefined, `${lang} ${ns}.${key} dropped`);
        else assert.equal(acc[ns][key], text, `${lang} ${ns}.${key}`);
      }
    }
    assert.deepEqual(acc.sync.goal, o.sync[lang].goalCopy);
    for (const { value, label } of o.support[lang].categoryOptions) assert.equal(acc.support.categories[value], label);
    assert.deepEqual(acc.support.categories, o.supportReview[lang].categoryLabels, "both support pages had the same category names");
    const docs = o.scoreTokenDocs[lang].copy;
    assert.deepEqual([1, 2, 3, 4].map((n) => acc.scoreTokenDocs[`step${n}`]), docs.steps);
    assert.deepEqual([1, 2, 3].map((n) => acc.scoreTokenDocs[`note${n}`]), docs.notes);
    for (const key of ["title", "lead", "userTitle", "safetyTitle", "safety", "devTitle", "requestTitle", "responseTitle", "responseNote", "errorsTitle", "notesTitle", "back"]) assert.equal(acc.scoreTokenDocs[key], docs[key], `${lang} docs.${key}`);
  }
  // Security wording, word for word
  assert.equal(zh.rework.account.sync.scoreTokenReveal, "明文只在本次生成后展示。刷新页面或再次生成后，无法找回当前明文。");
  assert.equal(zh.rework.account.sync.scoreTokenConfirm, "所有正在使用此 token 的网页和工具会立即失去访问权限。");
  assert.equal(ja.rework.account.sync.scoreTokenConfirm, "この token を使用中のすべてのサイトやツールから直ちにアクセスできなくなります。");
  assert.equal(zh.rework.account.sync.kinokoDesc, "使用 API 密钥从默认账号迁移当前最佳成绩或完整成绩历史，只允许写入 ID 相同的当前绑定账号。密钥不会保存。");
  assert.equal(zh.rework.account.scoreTokenDocs.safety, "token 等同于成绩读取密码。不要发到群聊、截图、前端源码或公开仓库。Viewer 和 bot 管理的是同一个 token，在任意一端重新生成都会让旧 token 失效。");
  assert.equal(zh.rework.account.scoreTokenDocs.error401, "token 无效、已轮换或已撤销");
});

test("E2 copy: every key a page lists or a component reads exists in zh and ja; no inline bilingual tables remain", async () => {
  const has = (key) => typeof get(zh, key) === "string" && typeof get(ja, key) === "string";
  for (const [file, [listName, base]] of Object.entries(E2_PAGES)) {
    const src = await read(file);
    if (listName) {
      const list = JSON.parse(src.match(new RegExp(`const ${listName}\\s*=\\s*(\\[[^\\]]*\\])`))[1]);
      for (const key of list) assert.ok(has(`${base}.${key}`), `${file}: ${base}.${key}`);
      for (const [, key] of src.matchAll(/\bcopy(?:\.value)?\.(\w+)/g)) assert.ok(list.includes(key) || key === "replace", `${file}: copy.${key} is listed`);
    }
    for (const [, key] of src.matchAll(/\bt\(\s*["'](rework\.account\.[\w.-]+)["']/g)) assert.ok(has(key), `${file}: ${key}`);
    assert.doesNotMatch(src, /(?:locale(?:\.value)?\s*===\s*["']ja["']|ja\.value)\s*\?\s*(?:\{|\(\s*\{|["'`][^"'`]*[぀-ヿ一-鿿])/, `${file}: no inline bilingual tables or strings`);
  }
  const prefixes = { "components/rework/sync/": "rework.account.sync", "components/rework/developer/Review.vue": "rework.account.developerReview", "components/rework/developer/": "rework.account.developer", "components/rework/support/Tickets.vue": "rework.account.support", "components/rework/support/Review.vue": "rework.account.supportReview" };
  for (const file of E2_COMPONENTS) {
    const src = await read(file);
    const base = file.endsWith("GoalResult.vue") ? "rework.account.sync.goal" : Object.entries(prefixes).find(([p]) => file.startsWith(p))?.[1];
    for (const [, key] of src.matchAll(/\bt\(\s*["'](rework\.[\w.-]+)["']/g)) assert.ok(has(key), `${file}: ${key}`);
    if (base) for (const [, key] of src.matchAll(/\b[kg]\(\s*["']([\w.-]+)["']/g)) assert.ok(has(`${base}.${key}`), `${file}: ${base}.${key}`);
    assert.doesNotMatch(src, /(?:locale(?:\.value)?\s*===\s*["']ja["']|ja\.value)\s*\?\s*(?:\{|\(\s*\{|["'`][^"'`]*[぀-ヿ一-鿿])/, `${file}: no inline bilingual tables or strings`);
  }
  for (const kind of ["running", "unbound", "attention", "never", "failed", "partial", "ok", "manual"]) assert.ok(has(`rework.account.sync.indicator.${kind}`));
  for (const outcome of ["success", "partial", "failed"]) assert.ok(has(`rework.account.sync.outcome.${outcome}`));
  for (const code of ["400", "401", "404", "502"]) assert.ok(has(`rework.account.scoreTokenDocs.error${code}`));
});

test("E2 sync: readiness follows the start button's own disabled condition; the shell indicator only reflects what the page read", async () => {
  const { syncReadiness, syncIndicatorKind, syncIndicatorMark, syncOutcome } = await loadTs("utils/rework/sync.ts");
  const page = await read("pages/account/sync.vue");
  const DISABLED = "pending || !overview.currentBinding || overview.canSyncFromWahlap === false || cooldown > 0 || !overview.targets.length";
  assert.ok(page.includes(`:start-disabled="${DISABLED}"`), "the start button keeps the original disabled expression");
  const binding = (extra = {}) => ({ id: 1, taikoId: "A", isManual: false, requiresReverification: false, ...extra });
  const cases = [];
  for (const currentBinding of [null, binding(), binding({ requiresReverification: true })])
    for (const canSyncFromWahlap of [true, false])
      for (const cooldown of [0, 5])
        for (const targets of [[], [{ id: "t" }]]) cases.push({ overview: { currentBinding, canSyncFromWahlap, targets, lastSync: null }, cooldown });
  for (const { overview, cooldown } of cases) {
    const disabled = !overview.currentBinding || overview.canSyncFromWahlap === false || cooldown > 0 || !overview.targets.length;
    assert.equal(syncReadiness(overview, cooldown) === "ready", !disabled, JSON.stringify({ overview, cooldown }));
  }
  assert.equal(syncReadiness({ currentBinding: binding({ isManual: true }), canSyncFromWahlap: false, targets: [], lastSync: null }, 0), "manual");
  assert.equal(syncReadiness({ currentBinding: binding({ requiresReverification: true }), canSyncFromWahlap: false, targets: [{}], lastSync: null }, 0), "reverify");
  assert.equal(syncReadiness({ currentBinding: binding(), canSyncFromWahlap: false, targets: [{}], lastSync: null }, 0), "unavailable");
  assert.deepEqual(["success", "partial", "failed", "unknown", "running", ""].map(syncOutcome), ["success", "partial", "failed", "failed", "failed", "failed"]);
  const ov = (extra) => ({ currentBinding: binding(), canSyncFromWahlap: true, targets: [{}], lastSync: null, ...extra });
  assert.equal(syncIndicatorKind(null, false), null, "nothing read yet: the plain control");
  assert.equal(syncIndicatorKind(null, true), "running");
  assert.equal(syncIndicatorKind(ov({ currentBinding: null }), false), "unbound");
  assert.equal(syncIndicatorKind(ov({ currentBinding: binding({ isManual: true }) }), false), "manual");
  assert.equal(syncIndicatorKind(ov({ canSyncFromWahlap: false }), false), "attention");
  assert.equal(syncIndicatorKind(ov({}), false), "never");
  for (const [status, kind] of [["success", "ok"], ["partial", "partial"], ["failed", "failed"], ["unknown", "failed"]]) assert.equal(syncIndicatorKind(ov({ lastSync: { status } }), false), kind);
  assert.deepEqual(["ok", "manual", "running", null, "never", "unbound", "attention", "partial", "failed"].map(syncIndicatorMark), [null, null, null, null, "warn", "warn", "warn", "warn", "danger"]);
  // The shell reads the shared state only; it never fetches the sync API.
  const shell = await read("components/rework/Shell.vue");
  assert.doesNotMatch(shell, /\/api\/account\/sync/);
  assert.match(shell, /SYNC_INDICATOR_KEY/);
  assert.match(shell, /s\.userId === user\.id && s\.generation === bindingGeneration\.value/);
  const source = await read("components/rework/sync/IndicatorSource.vue");
  assert.doesNotMatch(source, /apiFetch|useViewerApiFetch|setInterval|setTimeout/);
});

test("E2 sync: handlers, request bodies, the revoke confirmation and the one-time token display are unchanged", async () => {
  const page = await read("pages/account/sync.vue");
  for (const needle of [
    '"/api/account/sync", {\n      method: "POST",\n      body: {\n        profileId: String(overview.value?.currentBinding?.id || ""),\n        targetIds: selectedTargetIds.value\n      }',
    '"/api/account/sync/kinoko-import", {\n      method: "POST",\n      body: {\n        apiKey: kinokoApiKey.value.trim()\n      }',
    '"/api/account/sync/kinoko-history-import", {\n      method: "POST",\n      body: {\n        apiKey: kinokoApiKey.value.trim()\n      }',
    '"/api/account/score-token", {\n      method: "POST",\n      body: { action }',
    "if (submitting.value || pending.value || evaluatingGoal.value) return;",
    "if (importingKinoko.value || importingKinokoHistory.value || pending.value) return;",
    "if (scoreTokenBusy.value || scoreTokenDialogOwner || pending.value) return;",
    'issuedScoreToken.value = action === "issue" ? String(response.token || "") : "";',
    "await navigator.clipboard.writeText(issuedScoreToken.value);",
    'kinokoApiKey.value = "";'
  ]) assert.ok(page.includes(needle), needle.slice(0, 60));
  // Revoke: confirmation first (warning dialog), then the request
  const revoke = page.indexOf('if (action === "revoke") {');
  assert.ok(revoke > 0 && page.indexOf("ElMessageBox.confirm(copy.value.scoreTokenConfirm, copy.value.scoreTokenConfirmTitle", revoke) > revoke);
  assert.ok(page.indexOf('type: "warning"', revoke) < page.indexOf('"/api/account/score-token"', revoke));
  // The plaintext token goes to the token section only, and is not part of the shell indicator
  const template = page.slice(page.indexOf("<template>"));
  assert.equal(template.match(/issuedScoreToken/g)?.length, 1);
  assert.match(template, /:issued="issuedScoreToken"/);
  const token = await read("components/rework/sync/ScoreToken.vue");
  assert.equal(token.match(/\{\{ issued \}\}/g)?.length, 1, "rendered once, in the one-time block");
  assert.match(token, /<div v-if="issued" class="rs-token__reveal token-reveal" role="status">/);
  assert.match(token, /class="rw-btn rw-btn--danger rs-token__revoke"/);
  assert.match(token, /:disabled="pending \|\| busy"/);
  const kinoko = await read("components/rework/sync/Kinoko.vue");
  assert.match(kinoko, /:type="show \? 'text' : 'password'"/);
  assert.match(kinoko, /autocomplete="off"/);
  assert.match(kinoko, /:disabled="!hasBinding \|\| cooldown > 0 \|\| importingHistory \|\| importing"/);
  assert.match(kinoko, /:disabled="!hasBinding \|\| cooldown > 0 \|\| importing \|\| importingHistory"/);
  const overview = await read("components/rework/sync/Overview.vue");
  assert.match(overview, /<fieldset class="rs-over__targets" :disabled="pending \|\| submitting">/);
  assert.match(overview, /:disabled="startDisabled \|\| submitting"/);
  assert.match(overview, /class="target-item"/, "Linux training-loop script hook");
  assert.match(await read("components/rework/sync/GoalResult.vue"), /class="goal-sync-result rs-goal"[\s\S]*class="goal-return rw-link"/);
});

test("E2 developer, grants and review: request bodies, prompts, confirmations and guards are unchanged; destructive actions are outlined danger", async () => {
  const index = await read("pages/account/developer/index.vue");
  for (const needle of ['body.append("reason", form.value.reason.trim());', 'body.append("replyEmail", form.value.replyEmail.trim());', 'body.append("images", file);', '"/api/account/developer/apply"', "imageFiles.value = files.slice(0, 4);", "if (submitting.value || !canSubmitApplication.value) return;"]) assert.ok(index.includes(needle), needle);
  assert.ok(index.includes('import DeveloperApiGuide from "~/components/rework/developer/ApiGuide.vue";'));
  assert.doesNotMatch(index, /developer\/grants/, "the developer page has no link to grants (developerApiGuideUi)");
  const form = await read("components/rework/developer/ApplyForm.vue");
  assert.match(form, /type="file" accept="image\/\*" multiple/);
  assert.match(form, /maxlength="4000"/);
  const guide = await read("components/rework/developer/ApiGuide.vue");
  for (const hook of ["data-developer-guide", 'class="api-overview-item"', ':data-api="api.id"', "data-token-help", "data-examples", ':data-example="kind"', 'data-example="json"', "data-common", '<el-tabs v-model="activeExamples[api.id]"', 'role="status"']) assert.ok(guide.includes(hook), hook);
  assert.match(guide, /pre \{[\s\S]*?overflow-x: auto;[\s\S]*?white-space: pre;/, "code blocks scroll inside themselves");
  const review = await read("pages/account/developer/review.vue");
  for (const needle of ["ElMessageBox.prompt(\n      copy.value.approvePrompt", "ElMessageBox.prompt(\n      copy.value.rejectPrompt", 'inputValidator: (value) => (String(value || "").trim() ? true : copy.value.rejectValidation)', 'action: "approve",', 'action: "reject",', "if (processingId.value || reviewDialogOwner) return;", "`Token: ${result.issuedToken}\\n"]) assert.ok(review.includes(needle), needle);
  const reviewView = await read("components/rework/developer/Review.vue");
  assert.match(reviewView, /class="rw-btn rw-btn--danger"[\s\S]*?:disabled="processingId !== null"/);
  const grants = await read("pages/account/developer/grants.vue");
  for (const needle of ["window.confirm(copy.value.disableConfirm+' '+client.displayName)", "body:{bindingId:bindingId.value,clientId:clientId.value,consent:true,consentVersion:data.consentVersion,audience:data.audience}", "'/api/account/developer/grants/'+grantId,{method:'DELETE'}", 'id="grant-app"', 'id="grant-binding"', 'id="client-name"', ":data-grant-id=\"grant.grantId\"", ":data-client-id=\"client.clientId\"", 'data-grants-page :aria-busy="pending||busy"']) assert.ok(grants.includes(needle), needle);
  assert.doesNotMatch(grants.slice(grants.indexOf("<template>")), /<Rework|<Ds|<el-/, "native markup only (the Linux checks compile this file alone)");
  assert.doesNotMatch(grants.slice(grants.indexOf("<style")), /var\(--(?!el-)/, "only Element Plus variables in a page");
  assert.equal(grants.match(/rw-btn--danger/g)?.length, 2, "revoke grant, disable app");
});

test("E2 support: fields, limits, request bodies and every moderator action are unchanged", async () => {
  const page = await read("pages/support.vue");
  for (const needle of ['category: form.category,\n        title: form.title,\n        contact: form.contact,\n        content: form.content', "`/api/support/tickets/${ticketId}/messages`", "body: { content }", 'maxlength="120"', 'maxlength="255"', 'maxlength="8000"', "if (submitting.value) return;", "if (followUpSubmittingId.value) return;"]) assert.ok(page.includes(needle), needle);
  assert.match(page, /<button\s+type="button"\s+class="rw-btn rw-btn--primary"[\s\S]*?@click="submit"/, "no implicit submission (as before)");
  const tickets = await read("components/rework/support/Tickets.vue");
  assert.match(tickets, /:disabled="followUpSubmittingId === ticket\.id"/);
  assert.match(tickets, /:disabled="loadingDetailId === ticket\.id"/);
  assert.match(tickets, /white-space: pre-wrap;\s*overflow-wrap: anywhere;/);
  const review = await read("pages/account/support/review.vue");
  for (const needle of ["`/api/account/support/review/${selectedTicketId.value}/reply`", "body: { content, close }", "`/api/account/support/review/${selectedTicketId.value}/close`", "if (!selectedTicketId.value || submitting.value) return;", '@reply="submitReply(false)"', '@reply-close="submitReply(true)"', '@close="closeTicket"']) assert.ok(review.includes(needle), needle);
  const view = await read("components/rework/support/Review.vue");
  assert.equal(view.match(/:disabled="submitting"/g)?.length, 3);
});

test("E2 score-token docs: public, server-rendered, code blocks scroll in place, no real token in the examples", async () => {
  const page = await read("pages/docs/score-token.vue");
  assert.doesNotMatch(page, /middleware/);
  assert.match(page, /hidePageHeader: true/);
  assert.match(page, /\{ labelKey: "account.sync", to: "\/account\/sync" \}/);
  const docs = await read("components/rework/ScoreTokenDocs.vue");
  assert.match(docs, /\.rtd-code \{[\s\S]*?overflow-x: auto;[\s\S]*?white-space: pre;/);
  assert.equal(docs.match(/<pre class="rtd-code" tabindex="0"/g)?.length, 2);
  assert.doesNotMatch(page, /[0-9a-f]{48}/i, "no 48-character token in the examples");
});
