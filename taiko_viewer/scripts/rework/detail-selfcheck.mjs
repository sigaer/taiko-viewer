// Windows development self-check for slice A (song detail, constants, Element Plus switch). NOT acceptance.
//   node scripts/rework/detail-selfcheck.mjs --port=3571 --out=<dir> [--chrome=<exe>] [--only=<scenario prefix,…>]
// Dev server, browser and cleanup: scripts/rework/selfcheck-runner.mjs. The synthetic files of detail-data.mjs back
// the real APIs and the real SSR (song detail, rating, branch audio, chart images, TJA bundle, V2 constants);
// account scores, chart UGC and related threads need the database or a signed-in user and are intercepted in the
// browser (detail-fixtures.ts). Then the library scenarios are not rerun here: use catalog-selfcheck.mjs.
import { cliArg, runSelfcheck } from "./selfcheck-runner.mjs";
import { writeDetailFiles } from "./detail-data.mjs";
import { detailSsrFailureCheck, runDetailScenarios } from "./detail-scenarios.mjs";

const label = "slice-a-selfcheck";
await runSelfcheck({
  name: "detail",
  defaultPort: 3571,
  defaultOut: "detail-selfcheck",
  label,
  readyPath: "/api/content/songs/1",
  prepare: (data) => writeDetailFiles(data),
  async run({ base, browser, prepared, report, out }) {
    const only = cliArg("only") || "";
    Object.assign(report, await runDetailScenarios({ browser, base, out, label, only }));
    // Last: breaking the song file changes its mtime, which invalidates the TJA bundle index the scenarios rely on.
    if (!only) {
      report.ssrFailure = await detailSsrFailureCheck({ browser, base, out, label, breakData: prepared.breakSongs, restoreData: prepared.restoreSongs });
    }
  },
  summarize(report) {
    const failed = (report.results || []).filter((r) => !r.pass);
    return {
      line: {
        ssrFailure: report.ssrFailure?.pass ?? "not run",
        scenarios: report.total ? `${report.passed}/${report.total}` : "not run",
        failed: failed.map((r) => `${r.name} ${r.width} ${r.lang || "zh"} ${r.theme || "light"}: ${r.error?.slice(0, 160)}`),
        timings: report.timings
      },
      failed: failed.length > 0 || report.ssrFailure?.pass === false || !report.total
    };
  }
});
