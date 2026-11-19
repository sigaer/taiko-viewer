// Windows development self-check for slice G (finishing pass). NOT acceptance.
//   node scripts/rework/sweep-selfcheck.mjs --port=3578 --out=<dir> --mode=colour --variant=<before|after>
//   node scripts/rework/sweep-selfcheck.mjs --port=3578 --out=<dir> --mode=pages [--only=<route name prefix,…>]
//   node scripts/rework/sweep-selfcheck.mjs --port=3578 --out=<dir> --mode=outofscope
//       (runs scripts/ds/existing-pages.mjs capture against this dev server for the out-of-scope pages that render
//        without a database; the runner launches no browser of its own in this mode, so there is still one browser)
// Dev server, browser and cleanup: selfcheck-runner.mjs. Data: pages-data.mjs (superset of detail-data.mjs, with the
// local upstream for the guide and titles sources) plus the synthetic OIDC provider of the account slice.
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { cliArg, runSelfcheck, web } from "./selfcheck-runner.mjs";
import { writePagesFiles } from "./pages-data.mjs";
import { OIDC_PROVIDER } from "./account-scenarios.mjs";

// /annual renders only for phones (middleware/annual-mobile.global.ts); on a desktop user agent it redirects to the home
// page, which is reworked. The capture therefore presents itself as a phone for every page (same in both runs).
export const ANNUAL_PHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
export const OUT_OF_SCOPE_PAGES = ["/annual", "/ja/annual", "/annual/share/selfcheck-token", "/ja/annual/share/selfcheck-token", "/admin/taiko/login"];
const mode = cliArg("mode") || "pages";
const label = `slice-g-${mode}${cliArg("variant") ? "-" + cliArg("variant") : ""}`;
let prepared;
await runSelfcheck({
  name: "sweep",
  defaultPort: 3578,
  defaultOut: "sweep-selfcheck",
  label,
  limitMs: 90 * 60 * 1000,
  launchBrowser: !["outofscope", "stage0"].includes(mode),
  async prepare(data) {
    prepared = await writePagesFiles(data, web);
    return {
      ...prepared,
      env: {
        ...prepared.env,
        NUXT_OIDC_ENABLED: "1",
        NUXT_OIDC_PROVIDERS_JSON: JSON.stringify([
          { ...OIDC_PROVIDER, enabled: true, issuer: "https://127.0.0.1:1", clientId: "viewer-selfcheck", redirectUri: `https://viewer.example.invalid/api/account/oidc/${OIDC_PROVIDER.id}/callback` }
        ])
      }
    };
  },
  async run({ base, browser, report, out, chrome }) {
    try {
      if (mode === "outofscope") {
        const dir = resolve(out, cliArg("variant") || "capture");
        const code = await new Promise((done) => {
          const child = spawn(process.execPath, [resolve(web, "scripts/ds/existing-pages.mjs"), "capture", "--base", base, "--out", dir, "--pages", OUT_OF_SCOPE_PAGES.join(","), "--widths", "1440,390"], {
            cwd: web,
            env: { ...process.env, DS_BROWSER: chrome, DS_USER_AGENT: ANNUAL_PHONE_UA },
            stdio: "inherit",
            windowsHide: true
          });
          child.on("exit", (c) => done(c));
        });
        report.total = 1;
        report.passed = code === 0 ? 1 : 0;
        report.results = [{ name: "existing-pages capture", pass: code === 0, error: code ? `exit ${code}` : undefined }];
        return;
      }
      if (mode === "stage0") {
        // The Stage 0 sample-page checks (tokens and charts changed): one child at a time, each with its own browser.
        const run = (args) => new Promise((done) => {
          const child = spawn(process.execPath, args, { cwd: web, env: { ...process.env, DS_BROWSER: chrome, ...(args[0].endsWith("browser-check.mjs") ? { DS_USER_AGENT: ANNUAL_PHONE_UA } : {}) }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
          let text = "";
          child.stdout.on("data", (d) => (text += d));
          child.stderr.on("data", (d) => (text += d));
          child.on("exit", (code) => done({ code, tail: text.slice(-1500) }));
        });
        report.results = [];
        for (const [name, args] of [
          ["browser-check", [resolve(web, "scripts/ds/browser-check.mjs"), "--base", base, "--out", resolve(out, "browser-check"), "--browser", chrome, "--existing", "/annual"]],
          ["samples-matrix", [resolve(web, "scripts/ds/samples-matrix.mjs"), "--base", base, "--out", resolve(out, "samples-matrix")]],
          ["charts-check", [resolve(web, "scripts/ds/charts-check.mjs"), base, resolve(out, "charts-check")]]
        ]) {
          const r = await run(args);
          report.results.push({ name, pass: r.code === 0, error: r.code ? `exit ${r.code}` : undefined, tail: r.tail });
        }
        report.total = report.results.length;
        report.passed = report.results.filter((r) => r.pass).length;
        return;
      }
      const { runColour, runSweep } = await import("./sweep-scenarios.mjs");
      if (mode === "colour") Object.assign(report, await runColour({ browser, base, out, variant: cliArg("variant") || "after", prepared, ...(cliArg("routes") ? { routes: cliArg("routes").split(",") } : {}) }));
      else Object.assign(report, await runSweep({ browser, base, out, prepared, only: cliArg("only") || "" }));
    } finally {
      await prepared?.cleanup();
    }
  },
  summarize(report) {
    const failed = (report.results || []).filter((r) => !r.pass);
    return {
      line: { mode, checks: report.total ? `${report.passed}/${report.total}` : "not run", failed: failed.slice(0, 40).map((r) => `${r.name} ${r.width || ""} ${r.lang || ""} ${r.theme || ""}: ${r.error?.slice(0, 200) || JSON.stringify({ overflow: r.m?.overflow, h1: r.m?.h1Count, red: r.m?.redPrimary, faults: r.faults?.slice(0, 2) })}`) },
      failed: failed.length > 0 || !report.total
    };
  }
});
