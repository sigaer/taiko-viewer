// Windows development self-check for slice E2 (同步、开发者、工单). NOT acceptance.
//   node scripts/rework/account2-selfcheck.mjs --port=3576 --out=<dir> [--chrome=<exe>] [--only=<scenario prefix,…>]
// Dev server, browser and cleanup: scripts/rework/selfcheck-runner.mjs. The synthetic files of detail-data.mjs back the
// song catalog the shell needs. The public /docs/score-token page and every signed-out redirect are real; every
// /api/account/* and /api/support/* read and write of a signed-in user is intercepted (account2-fixtures.ts) and
// labelled so. Tokens and keys are synthetic.
import { cliArg, runSelfcheck } from "./selfcheck-runner.mjs";
import { writeDetailFiles } from "./detail-data.mjs";
import { runAccount2Scenarios } from "./account2-scenarios.mjs";

const label = "slice-e2-selfcheck";
await runSelfcheck({
  name: "account2",
  defaultPort: 3576,
  defaultOut: "account2-selfcheck",
  label,
  limitMs: 45 * 60 * 1000,
  readyPath: "/api/content/songs?view=list&page=1",
  async prepare(data) {
    return (await writeDetailFiles(data)) || {};
  },
  async run({ base, browser, report, out }) {
    Object.assign(report, await runAccount2Scenarios({ browser, base, out, label, only: cliArg("only") || "" }));
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
