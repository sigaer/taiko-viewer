// Windows development self-check for slice B (the signed-in player's score pages). NOT acceptance.
//   node scripts/rework/scores-selfcheck.mjs --port=3572 --out=<dir> [--chrome=<exe>] [--only=<scenario prefix,…>]
// Dev server, browser and cleanup: scripts/rework/selfcheck-runner.mjs. The synthetic files of detail-data.mjs back
// the real song catalog read; the signed-out server render and the sign-in redirect are real. Everything that needs
// the database or a signed-in user is intercepted in the browser (scores-fixtures.ts) and labelled so.
import { cliArg, runSelfcheck } from "./selfcheck-runner.mjs";
import { writeDetailFiles } from "./detail-data.mjs";
import { runScoresScenarios } from "./scores-scenarios.mjs";

const label = "slice-b-selfcheck";
await runSelfcheck({
  name: "scores",
  defaultPort: 3572,
  defaultOut: "scores-selfcheck",
  label,
  readyPath: "/api/content/songs/1",
  prepare: (data) => writeDetailFiles(data),
  async run({ base, browser, report, out }) {
    Object.assign(report, await runScoresScenarios({ browser, base, out, label, only: cliArg("only") || "" }));
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
