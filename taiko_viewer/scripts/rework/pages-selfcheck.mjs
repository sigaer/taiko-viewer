// Windows development self-check for slice F (段位、攻略、称号、工具、关于、更多、别名记录、练习页). NOT acceptance.
//   node scripts/rework/pages-selfcheck.mjs --port=3577 --out=<dir> [--chrome=<exe>] [--only=<scenario prefix,…>]
//   node scripts/rework/pages-selfcheck.mjs --port=3577 --out=<dir> --capture=<before|after>   (tool outputs only)
// Dev server, browser and cleanup: scripts/rework/selfcheck-runner.mjs. Synthetic files and the local upstream for the
// remote sources: pages-data.mjs. Signed-in parts (the word cloud) are intercepted in the browser and labelled so.
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cliArg, runSelfcheck, web } from "./selfcheck-runner.mjs";
import { writePagesFiles } from "./pages-data.mjs";
import { captureTools } from "./pages-tools-capture.mjs";

const capture = cliArg("capture");
const label = capture ? `slice-f-tools-${capture}` : "slice-f-selfcheck";
let prepared;
await runSelfcheck({
  name: "pages",
  defaultPort: 3577,
  defaultOut: "pages-selfcheck",
  label,
  limitMs: 50 * 60 * 1000,
  readyPath: "/api/content/songs?view=list&page=1",
  async prepare(data) {
    prepared = await writePagesFiles(data, web);
    return prepared;
  },
  async run({ base, browser, report, out }) {
    try {
      if (capture) {
        const result = await captureTools({ browser, base, variant: capture });
        await writeFile(resolve(out, `tools-capture-${capture}.json`), JSON.stringify(result, null, 2));
        report.capture = { variant: capture, errors: result.errors, rtCases: Object.values(result.rt).flat().length, image: result.tja?.image };
        report.total = 1;
        report.passed = result.errors.length ? 0 : 1;
        report.results = [{ name: "capture", pass: !result.errors.length, error: result.errors.join(" | ") }];
        return;
      }
      const { runPagesScenarios } = await import("./pages-scenarios.mjs");
      Object.assign(report, await runPagesScenarios({ browser, base, out, label, only: cliArg("only") || "", prepared }));
    } finally {
      await prepared?.cleanup();
      report.upstreamCalls = prepared?.upstream.calls.length;
    }
  },
  summarize(report) {
    const failed = (report.results || []).filter((r) => !r.pass);
    return {
      line: {
        scenarios: report.total ? `${report.passed}/${report.total}` : "not run",
        failed: failed.map((r) => `${r.name} ${r.width || ""} ${r.lang || "zh"} ${r.theme || "light"} [${r.step || ""}]: ${r.error?.slice(0, 260)}`),
        capture: report.capture,
        timings: report.timings
      },
      failed: failed.length > 0 || !report.total
    };
  }
});
