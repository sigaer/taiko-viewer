// Windows development self-check for slice D (社区: /forum, sections, all discussions, threads, the composer, my
// community, notifications). NOT acceptance.
//   node scripts/rework/community-selfcheck.mjs --port=3574 --out=<dir> [--chrome=<exe>] [--only=<scenario prefix,…>]
// Dev server, browser and cleanup: scripts/rework/selfcheck-runner.mjs. The synthetic files of detail-data.mjs back
// the real song catalog (the composer's song picker); the signed-out server renders are real (the forum reads fail for
// real without a database). Every forum read and write and the signed-in user are intercepted in the browser
// (community-fixtures.ts) and labelled so.
import { cliArg, runSelfcheck } from "./selfcheck-runner.mjs";
import { writeDetailFiles } from "./detail-data.mjs";
import { runCommunityScenarios } from "./community-scenarios.mjs";

const label = "slice-d-selfcheck";
await runSelfcheck({
  name: "community",
  defaultPort: 3574,
  defaultOut: "community-selfcheck",
  label,
  limitMs: 40 * 60 * 1000,
  readyPath: "/api/content/songs?view=list&page=1",
  prepare: (data) => writeDetailFiles(data),
  async run({ base, browser, report, out }) {
    Object.assign(report, await runCommunityScenarios({ browser, base, out, label, only: cliArg("only") || "" }));
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
