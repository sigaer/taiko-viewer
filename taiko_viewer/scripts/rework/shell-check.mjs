// Bounded integration against a production Nitro output, isolated public fixtures.
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile, realpath, open } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { scryptSync, randomBytes } from "node:crypto";
import { createServer as createTlsServer } from "node:https";
import { request as forwardHttp } from "node:http";
import mysql from "mysql2/promise";
import { chromium } from "playwright-core";
const web = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const output = process.argv[2];
const firefox = process.argv.includes("--firefox") ? await import("./firefox-android-scenarios.mjs") : null;
const rc = process.argv.includes("--rc") ? await import("./rc-scenarios.mjs") : null;
let prepared;
assert.ok(output?.startsWith("/var/tmp/"));
assert.ok(process.env.QA_RUN_TMPDIR && process.env.QA_EVIDENCE_DIR);
const data = resolve(process.env.QA_RUN_TMPDIR, rc ? "manual-source-sql-rc" : "viewer");
const out = process.env.QA_EVIDENCE_DIR;
await mkdir(data, { recursive: true });
for (const dir of ["userdata", "cache", "annual", "viewer-cache", "songs"])
  await mkdir(data + "/" + dir, { recursive: true });
await writeFile(data + "/config.json", "{}");
await writeFile(data + "/songs/rating_structured_with_ids.json", "[]");
await writeFile(data + "/songs/song_alias.json", "{}");
await writeFile(
  data + "/catalog.json",
  JSON.stringify(
    Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      song_name: "Synthetic Song " + (i + 1),
      song_name_jp: "テスト楽曲 " + (i + 1),
      type: "游戏音乐",
      shelf_status: 0,
      level_4: 10,
      level_5: 10,
      bpm: "120",
      open_day: "01/01/2026",
    })),
  ),
);
if (rc) prepared = await rc.prepareData(data, web);
// Reuse the Phase 0 empty-database guard; seed only this run's synthetic account.
assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION, "1");
const db = await mysql.createConnection(
  Object.fromEntries([
    ["host", process.env.TAIKO_DB_HOST],
    ["port", Number(process.env.TAIKO_DB_PORT)],
    ["user", process.env.TAIKO_DB_USER],
    ["password", process.env.TAIKO_DB_PASSWORD],
    ["database", process.env.TAIKO_DB_NAME],
  ]),
);
const password = randomBytes(24).toString("hex");
try {
  const [[proof]] = await db.query("SELECT DATABASE() name,@@datadir dir");
  assert.ok(proof.name.endsWith("_test"));
  assert.equal(
    await realpath(proof.dir),
    await realpath(process.env.TAIKO_TEST_MYSQL_DATADIR),
  );
  const { CREATE_FORUM_TABLES } = await import(
    "../../server/utils/forum-schema-definition.ts"
  );
  for (const sql of CREATE_FORUM_TABLES) await db.execute(sql);
  const { ACCOUNT_TITLE_TABLE_SQL } = await import(
    "../../server/services/account-titles/schema.ts"
  );
  await db.execute(ACCOUNT_TITLE_TABLE_SQL);
  const salt = randomBytes(16).toString("hex");
  await db.execute(
    "INSERT INTO web_user_accounts(id,username,email,password_hash,email_verified,created_at,updated_at) VALUES (990881,?,?,?,?,?,?)",
    [
      "stage1-synthetic",
      "stage1@example.invalid",
      salt + ":" + scryptSync(password, salt, 64).toString("hex"),
      1,
      "2026-01-01",
      "2026-01-01",
    ],
  );
  await db.execute(
    "INSERT INTO forum_user_profiles(user_id,role) VALUES (990881,'user')",
  );
  if (rc) await rc.seed(db, data);
} finally {
  await db.end();
}
const certificate = data + "/loopback-cert.pem",
  key = data + "/loopback-key.pem";
assert.equal(
  spawnSync(
    "/usr/bin/openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      key,
      "-out",
      certificate,
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=IP:127.0.0.1,DNS:localhost",
      "-days",
      "1",
    ],
    { stdio: "ignore", timeout: 15000 },
  ).status,
  0,
);
const tls = createTlsServer(
  { key: await readFile(key), cert: await readFile(certificate) },
  (req, res) => {
    const upstream = forwardHttp(
      {
        host: "127.0.0.1",
        port: 35322,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, "x-forwarded-proto": "https" },
      },
      (reply) => {
        res.writeHead(reply.statusCode, reply.headers);
        reply.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  },
);
await new Promise((r) => tls.listen(35323, "127.0.0.1", r));
const provider = rc ? await rc.startProvider({ key: await readFile(key), cert: await readFile(certificate) }) : null;
const env = {
  ...process.env,
  NODE_ENV: "production",
  NODE_EXTRA_CA_CERTS: certificate,
  NUXT_PUBLIC_API_BASE: "https://127.0.0.1:35323",
  NUXT_PUBLIC_GUIDE_API_BASE: "https://127.0.0.1:35323",
  NODE_OPTIONS:
    "--max-old-space-size=512 --import " + web + "/scripts/ds/no-egress.mjs",
  NITRO_HOST: "127.0.0.1",
  NITRO_PORT: "35322",
  NUXT_ANNUAL_STARTUP_MODE: "owned-qa",
  NUXT_REPO_ROOT: data,
  NUXT_USERDATA_DIR: data + "/userdata",
  NUXT_TAIKO_CONFIG_PATH: data + "/config.json",
  NUXT_ACCOUNT_CACHE_DIR: data + "/cache",
  NUXT_ANNUAL_CACHE_DIR: data + "/annual",
  NUXT_VIEWER_CACHE_DIR: data + "/viewer-cache",
  NUXT_SONG_DATA_PATH: data + "/catalog.json",
  TAIKO_RUNTIME_ENV_FILE: data + "/absent.env",
  NUXT_PUBLIC_GOOGLE_ANALYTICS_ID: "",
  NUXT_TAIKO_API_BASE: "http://127.0.0.1:1",
  NUXT_TAIKO_TITLE_API_BASE: "http://127.0.0.1:1",
  NUXT_TAIKO_ADMIN_API_BASE: "http://127.0.0.1:1",
  NUXT_VIEWER_ACCESS_LOG_PATH: data + "/access.log",
  NUXT_BILIBILI_SESS_DATA_FILE: data + "/absent-bili",
  BILIBILI_SESSDATA_FILE: data + "/absent-bili",
};
if (prepared) Object.assign(env, prepared.env);
if (provider) Object.assign(env, provider.env);
if (process.argv.includes("--scope")) env.NUXT_PUBLIC_API_BASE = "http://127.0.0.1:35322";
assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION, "1");
for (const prefix of ["NUXT_DB_", "NUXT_BOT_DB_"])
  for (const suffix of ["HOST", "PORT", "USER", "PASSWORD", "NAME"])
    env[prefix + suffix] = process.env["TAIKO_DB_" + suffix];
const log = await open(out + "/nitro.log", "w");
const server = spawn(process.execPath, [output + "/server/index.mjs"], {
  cwd: data,
  env,
  stdio: ["ignore", log.fd, log.fd],
});
await log.close();
let browser;
const results = [],
  errors = [];
const base = "https://127.0.0.1:35323";
let fontSwapProof;
let authenticatedComposerProof = false;
const stopMonitoring = rc ? await (await import("../../tests/fixtures/goalAcceptanceResources.mjs")).monitorAcceptanceResources(out + "/rc-resources.json") : null;
const timer = setTimeout(() => server.kill("SIGTERM"), 600000);
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error("Nitro exited");
    try {
      if ((await fetch("http://127.0.0.1:35322/api/account/auth/me")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready);
  if (!process.argv.includes("--scope")) browser = await chromium.launch({
    headless: true,
    ...((rc || firefox) ? {args:["--ignore-certificate-errors"]} : {}),
    executablePath:
      "/root/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell",
  });
  if (firefox) {
    const report = await firefox.run({ browser, base, out });
    results.push(...report.results);
    errors.push(...report.results.filter(r => !r.pass).map(r => r.name + ": " + r.error));
  } else if (rc) {
    const report = process.argv.includes("--scope") ? await rc.runScope({web,out,base:"http://127.0.0.1:35322"}) : await rc.run({browser, base, out, data, password, prepared, coreOnly:process.argv.includes("--rc-core")});
    results.push(...report.results);
    errors.push(...report.results.filter(r => !r.pass).map(r => r.name + ": " + r.error));
  } else for (const lang of ["zh", "ja"])
    for (const theme of ["light", "dark"])
      for (const width of [1440, 1280, 820, 390, 360]) {
        const context = await browser.newContext({
          viewport: { width, height: width < 500 ? 844 : 900 },
          reducedMotion: "reduce",
          ignoreHTTPSErrors: true,
        });
        const page = await context.newPage();
        const faults = [];
        const fonts = new Map();
        page.setDefaultTimeout(15000);
        page.on("pageerror", (e) => faults.push(e.message));
        page.on("response", (r) => {
          if (r.request().resourceType() === "font")
            fonts.set(r.url(), Number(r.headers()["content-length"] || 0));
        });
        await context.addCookies([
          { name: "taiko_theme", value: theme, url: base },
          { name: "viewer_locale", value: lang, url: base },
        ]);
        await context.route("**/*", (r) =>
          new URL(r.request().url()).origin === base ? r.continue() : r.abort(),
        );
        let releaseFonts;
        try {
          let fontGate;
          let before;
          const geometry = () =>
            Array.from(
              document.querySelectorAll(
                ".rework-bar,.search-trigger,.bar-actions",
              ),
            ).map((el) => {
              const r = el.getBoundingClientRect();
              return [r.x, r.y, r.width, r.height];
            });
          if (width === 1440 && theme === "light" && lang === "zh") {
            fontGate = new Promise((r) => (releaseFonts = r));
            await context.route("**/*.woff2", async (r) => {
              await fontGate;
              await r.continue();
            });
          }
          const response = await page.goto(
            base + (lang === "ja" ? "/ja" : "") + "/about",
            { waitUntil: "domcontentloaded" },
          );
          assert.equal(response.status(), 200);
          if (releaseFonts) {
            await page.locator(".rework-bar").waitFor();
            await page.waitForFunction(
              () => document.fonts.status === "loading",
            );
            before = await page.evaluate(geometry);
            assert.ok(await page.locator(".search-trigger").innerText());
            const cdp = await context.newCDPSession(page);
            const fallback = await cdp.send("Page.captureScreenshot", {
              format: "png",
            });
            await writeFile(
              out + "/font-fallback.png",
              Buffer.from(fallback.data, "base64"),
            );
            await cdp.detach();
            releaseFonts();
          }
          await page.evaluate(() => document.fonts.ready);
          if (before) {
            const after = await page.evaluate(geometry);
            const shift = Math.max(
              ...before.flat().map((n, i) => Math.abs(n - after.flat()[i])),
            );
            assert.ok(shift <= 1, "font swap preserves navigation geometry");
            fontSwapProof = {
              blockedFontRequests: true,
              readableFallback: true,
              maxGeometryShiftPx: shift,
            };
          }
          assert.ok(await page.locator("html.viewer-rework").count());
          assert.equal(
            await page.evaluate(() => document.documentElement.dataset.theme),
            theme,
          );
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            "no horizontal overflow",
          );
          const visibleTabs = page.locator(
            width > 767 ? ".desktop-tabs" : ".mobile-tabs",
          );
          assert.equal(
            await visibleTabs.locator('a[aria-current="page"]').count(),
            1,
          );
          assert.ok(
            await visibleTabs.evaluate(
              (el) =>
                el.scrollWidth <= el.clientWidth ||
                getComputedStyle(el).overflowX === "auto",
            ),
            "tabs fit or scroll",
          );
          const trigger =
            width <= 767
              ? page.locator(".don-search")
              : page.locator(".search-trigger");
          await trigger.click();
          await page.locator("dialog[open] input").waitFor();
          assert.equal(
            await page
              .locator("dialog input")
              .evaluate((el) => el === document.activeElement),
            true,
          );
          await page.locator("dialog input").fill("Synthetic");
          await page.waitForFunction(
            () =>
              document.querySelectorAll("dialog [role=option]").length === 8,
          );
          assert.equal(await page.locator("dialog [role=option]").count(), 8);
          if (width === 1440 && theme === "light" && lang === "zh") {
            await page.keyboard.press("Tab");
            assert.ok(
              await page.evaluate(() =>
                document
                  .querySelector("dialog")
                  .contains(document.activeElement),
              ),
              "modal keeps focus inside",
            );
            await page.locator("dialog input").focus();
            await page.locator("dialog input").evaluate((el) =>
              el.dispatchEvent(
                new KeyboardEvent("keydown", {
                  key: "Enter",
                  isComposing: true,
                  bubbles: true,
                }),
              ),
            );
            assert.ok(
              page.url().endsWith("/about"),
              "IME Enter does not navigate",
            );
            await page.route("**/api/content/songs?**", async (route) => {
              const q = new URL(route.request().url()).searchParams.get(
                "keyword",
              );
              if (q === "failure")
                await route.fulfill({
                  status: 503,
                  contentType: "application/json",
                  body: "{}",
                });
              else await route.continue();
            });
            await page.locator("dialog input").fill("failure");
            await page
              .getByRole("button", { name: "重试", exact: true })
              .waitFor();
            await page.unroute("**/api/content/songs?**");
            await page
              .getByRole("button", { name: "重试", exact: true })
              .click();
            await page
              .getByRole("button", { name: "重试", exact: true })
              .waitFor({ state: "hidden" });
            await page.locator("dialog input").fill("Synthetic");
            await page.waitForFunction(
              () =>
                document.querySelectorAll("dialog [role=option]").length === 8,
            );
          }
          if (
            (width === 1440 && theme === "light" && lang === "zh") ||
            (width === 390 && theme === "dark" && lang === "ja")
          )
            await page.screenshot({
              path: out + `/search-${width}-${lang}-${theme}.png`,
            });
          await page.keyboard.press("ArrowDown");
          assert.ok(
            await page
              .locator("dialog input")
              .getAttribute("aria-activedescendant"),
          );
          await page.keyboard.press("End");
          assert.equal(
            await page.locator("[role=option][aria-selected=true]").count(),
            1,
          );
          await page.keyboard.press("Escape");
          await page.waitForFunction(
            () => !document.querySelector("dialog[open]"),
          );
          assert.ok(
            await trigger.evaluate((el) => el === document.activeElement),
            "focus returns to trigger",
          );
          await page.keyboard.press("Control+k");
          await page.locator("dialog[open]").waitFor();
          await page.keyboard.press("Control+k");
          await page.waitForFunction(
            () => !document.querySelector("dialog[open]"),
          );
          await page.keyboard.press("/");
          await page.locator("dialog[open]").waitFor();
          await page.locator("dialog input").fill("Synthetic");
          await page.waitForFunction(
            () =>
              document.querySelectorAll("dialog [role=option]").length === 8,
          );
          await page.keyboard.press("Home");
          await page.keyboard.press("Enter");
          await page.waitForURL("**/songs/1");
          await page.waitForFunction(
            () => document.activeElement?.id === "viewer-main",
          );
          assert.ok(
            await page
              .locator("#viewer-main")
              .evaluate((el) => el === document.activeElement),
            "navigation focuses content",
          );
          await page.goto(base + (lang === "ja" ? "/ja" : "") + "/about", {
            waitUntil: "networkidle",
          });
          if (
            (width === 1440 && lang === "zh" && theme === "light") ||
            (width === 390 && lang === "ja" && theme === "dark")
          )
            await page.screenshot({
              path: out + `/shell-${width}-${lang}-${theme}.png`,
            });
          assert.ok(
            fonts.size > 0 &&
              fonts.size <= 12 &&
              [...fonts.values()].reduce((a, b) => a + b, 0) <= 150 * 1024,
            "font budget",
          );
          assert.deepEqual(faults, []);
          await page.goto(
            base + (lang === "ja" ? "/ja" : "") + "/songs/available",
            { waitUntil: "networkidle" },
          );
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            "catalog shell fits",
          );
          assert.equal(
            await visibleTabs.locator('a[aria-current="page"]').count(),
            1,
            "catalog active tab",
          );
          assert.ok(
            await page
              .locator(".rework-bar")
              .evaluate((el) => el.getBoundingClientRect().right <= innerWidth),
            "header stays in viewport",
          );
          if (width === 1440 && theme === "light" && lang === "zh") {
            const login = await context.request.post(
              base + "/api/account/auth/login",
              { data: { identifier: "stage1-synthetic", password } },
            );
            assert.equal(login.status(), 200, "synthetic HTTPS login");
            const me = await (
              await context.request.get(base + "/api/account/auth/me")
            ).json();
            assert.equal(me.user.id, 990881);
            assert.ok(
              (await context.cookies()).some(
                (c) => c.name === "stv_session" && c.secure,
              ),
            );
            await page.goto(base + "/about", { waitUntil: "networkidle" });
            assert.equal(
              await page.locator(".account-link").getAttribute("href"),
              "/account/profile",
            );
            await page.goto(base + "/forum/new", { waitUntil: "networkidle" });
            await page.locator(".composer-panel__head").waitFor();
            assert.equal(
              await page.locator(".rework-bar,.rework-tabs").count(),
              0,
              "composer owns its sticky header",
            );
            await page.setViewportSize({ width: 390, height: 844 });
            assert.ok(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            );
            await page.keyboard.press("Control+k");
            await page.locator("dialog[open]").waitFor();
            await page.keyboard.press("Escape");
            assert.deepEqual(faults, []);
            authenticatedComposerProof = true;
          }
          results.push({
            lang,
            theme,
            width,
            pass: true,
            fontRequests: fonts.size,
            fontBytes: [...fonts.values()].reduce((a, b) => a + b, 0),
          });
        } catch (e) {
          releaseFonts?.();
          await page.screenshot({ path: out + "/failure.png" }).catch(() => {});
          results.push({
            lang,
            theme,
            width,
            pass: false,
            error: String(e.message).slice(0, 500),
            faults,
          });
          throw e;
        } finally {
          releaseFonts?.();
          await page.close();
          await context.close();
        }
      }
} catch (e) {
  errors.push(String(e.message).slice(0, 500));
} finally {
  clearTimeout(timer);
  await provider?.close();
  await prepared?.cleanup();
  await browser?.close();
  tls.closeAllConnections();
  await new Promise((r) => tls.close(r));
  server.kill("SIGTERM");
  await new Promise((r) => {
    if (server.exitCode !== null) return r();
    const timeout = setTimeout(() => server.kill("SIGKILL"), 5000);
    server.once("close", () => {
      clearTimeout(timeout);
      r();
    });
  });
  await stopMonitoring?.();
  await writeFile(
    out + "/shell-result.json",
    JSON.stringify(
      {
        results,
        errors,
        fontSwapProof,
        authenticatedComposerProof,
        productionNetwork: false,
        database: process.env.TAIKO_DB_NAME,
      },
      null,
      2,
    ),
  );
}
console.log(
  JSON.stringify({
    states: results.length,
    passed: results.filter((x) => x.pass).length,
    errors,
  }),
);
if (errors.length) process.exitCode = 1;
