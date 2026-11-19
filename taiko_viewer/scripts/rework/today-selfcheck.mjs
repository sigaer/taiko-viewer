// Windows development self-check for slice C (今日, /my/growth, /my/weekly, goals). NOT acceptance.
//   node scripts/rework/today-selfcheck.mjs --port=3573 --out=<dir> [--chrome=<exe>] [--only=<scenario prefix,…>]
// Dev server, browser and cleanup: scripts/rework/selfcheck-runner.mjs. The synthetic files of detail-data.mjs back
// the real song catalog, latest songs and song search; the guest home and the signed-out growth pages are real
// server renders. Everything that needs the database or a signed-in user, and the filled / empty Bilibili feed, is
// intercepted in the browser (today-fixtures.ts) and labelled so.
import { cliArg, runSelfcheck } from "./selfcheck-runner.mjs";
import { writeDetailFiles } from "./detail-data.mjs";
import { runTodayScenarios } from "./today-scenarios.mjs";

const label = "slice-c-selfcheck";
await runSelfcheck({
  name: "today",
  defaultPort: 3573,
  defaultOut: "today-selfcheck",
  label,
  readyPath: "/api/content/home",
  prepare: (data) => writeDetailFiles(data),
  async run({ base, browser, report, out }) {
    Object.assign(report, await runTodayScenarios({ browser, base, out, label, only: cliArg("only") || "" }));
  },
  summarize(report) {
    const failed = (report.results || []).filter((r) => !r.pass);
    return {
      line: {
        scenarios: report.total ? `${report.passed}/${report.total}` : "not run",
        failed: failed.map((r) => `${r.name} ${r.width} ${r.lang || "zh"} ${r.theme || "light"}: ${r.error?.slice(0, 220)}`),
        timings: report.timings
      },
      failed: failed.length > 0 || !report.total
    };
  }
});
