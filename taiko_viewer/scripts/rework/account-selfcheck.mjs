// Windows development self-check for slice E1 (账号: sign-in, registration, recovery, profile, settings).
// NOT acceptance.
//   node scripts/rework/account-selfcheck.mjs --port=3575 --out=<dir> [--chrome=<exe>] [--only=<scenario prefix,…>]
// Dev server, browser and cleanup: scripts/rework/selfcheck-runner.mjs. The dev server gets one synthetic OIDC
// provider (configuration only: an issuer on 127.0.0.1:1 that nothing answers), so the provider list is rendered by
// the real server; the authorization start is intercepted in the browser and its outbound address is recorded and
// aborted. The synthetic files of detail-data.mjs back the song catalog the shell needs. Every /api/account/* read and
// write of a signed-in user is intercepted (account-fixtures.ts) and labelled so.
import { cliArg, runSelfcheck } from "./selfcheck-runner.mjs";
import { writeDetailFiles } from "./detail-data.mjs";
import { OIDC_PROVIDER, runAccountScenarios } from "./account-scenarios.mjs";

const label = "slice-e1-selfcheck";
await runSelfcheck({
  name: "account",
  defaultPort: 3575,
  defaultOut: "account-selfcheck",
  label,
  limitMs: 40 * 60 * 1000,
  readyPath: "/api/content/songs?view=list&page=1",
  async prepare(data) {
    const prepared = (await writeDetailFiles(data)) || {};
    return {
      ...prepared,
      env: {
        ...(prepared.env || {}),
        NUXT_OIDC_ENABLED: "1",
        NUXT_OIDC_PROVIDERS_JSON: JSON.stringify([
          { ...OIDC_PROVIDER, enabled: true, issuer: "https://127.0.0.1:1", clientId: "viewer-selfcheck", redirectUri: `https://viewer.example.invalid/api/account/oidc/${OIDC_PROVIDER.id}/callback` }
        ])
      }
    };
  },
  async run({ base, browser, report, out }) {
    Object.assign(report, await runAccountScenarios({ browser, base, out, label, only: cliArg("only") || "" }));
  },
  summarize(report) {
    const failed = (report.results || []).filter((r) => !r.pass);
    return {
      line: {
        scenarios: report.total ? `${report.passed}/${report.total}` : "not run",
        failed: failed.map((r) => `${r.name} ${r.width} ${r.lang || "zh"} ${r.theme || "light"} [${r.step || ""}]: ${r.error?.slice(0, 260)}`),
        timings: report.timings
      },
      failed: failed.length > 0 || !report.total
    };
  }
});
