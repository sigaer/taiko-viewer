// Windows development self-check for the song library. NOT acceptance.
//   node scripts/rework/catalog-selfcheck.mjs --port=3561 --out=<dir> [--chrome=<exe>] [--stub]
// Dev server, browser and cleanup: scripts/rework/selfcheck-runner.mjs (synthetic dataset as the song data file,
// unresolvable database hosts, no-egress preload, one system Chrome, at most two pages, a total time limit).
// Real here: legacy redirects as raw HTTP, SSR of /songs when the API fails, and the list API over the synthetic
// file. Client-side failures are injected by intercepting browser requests; --stub answers every browser
// /api/content/songs request from serveCatalog() instead of the dev server.
import { utimes, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildDataset, rawHttpChecks, runScenarios, ssrFailureCheck } from "./catalog-scenarios.mjs";
import { runSelfcheck, web } from "./selfcheck-runner.mjs";

const stub = process.argv.includes("--stub");
const label = stub ? "stubbed-http-selfcheck" : "stubbed-data-selfcheck";
const dataset = buildDataset();

await runSelfcheck({
  name: "catalog",
  defaultPort: 3561,
  defaultOut: "catalog-selfcheck",
  label,
  async prepare(data) {
    const songFile = resolve(data, "song_data.json");
    const writeSongs = async (content, offsetMs) => {
      await writeFile(songFile, content);
      const when = new Date(Date.now() + offsetMs);
      await utimes(songFile, when, when);
    };
    await writeSongs(JSON.stringify(dataset), 0);
    await writeFile(resolve(data, "rating.json"), JSON.stringify({ songs: [] }));
    await writeFile(resolve(data, "branch_audio_manifest.json"), "{}");
    return { writeSongs };
  },
  async run({ base, browser, prepared, report, out }) {
    report.stub = stub;
    report.http = await rawHttpChecks(base);
    report.ssrFailure = await ssrFailureCheck({
      browser,
      base,
      out,
      dataset,
      label: "real-ssr-selfcheck",
      breakData: () => prepared.writeSongs("not json", 2000),
      restoreData: () => prepared.writeSongs(JSON.stringify(dataset), 4000)
    });
    Object.assign(report, await runScenarios({ browser, base, out, dataset, stub, web, label }));
  },
  summarize(report) {
    const failedHttp = (report.http || []).filter((x) => !x.pass).length;
    return {
      line: {
        http: report.http ? `${report.http.length - failedHttp}/${report.http.length}` : "not run",
        ssrFailure: report.ssrFailure?.pass ?? "not run",
        scenarios: report.total ? `${report.passed}/${report.total}` : "not run",
        timings: report.timings
      },
      failed: Boolean(failedHttp) || report.ssrFailure?.pass === false || report.passed !== report.total
    };
  }
});
