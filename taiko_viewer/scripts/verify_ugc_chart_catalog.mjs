#!/usr/bin/env node
import { loadUgcCatalogAudit } from "./lib/ugc-catalog.mjs";

const jsonOutput = process.argv.includes("--json");
const audit = await loadUgcCatalogAudit();

if (jsonOutput) {
  process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);
} else {
  const { summary } = audit;
  process.stdout.write([
    "UGC chart catalog audit",
    `catalog revision: ${audit.catalog.revision}`,
    `songs scanned: ${summary.songsScanned}`,
    `charts discovered: ${summary.chartsDiscovered}`,
    `active charts: ${summary.activeCharts}`,
    `inactive charts: ${summary.inactiveCharts}`,
    `removed songs: ${summary.removedSongs}`,
    `EDIT / URA charts: ${summary.editCharts}`,
    `duplicate pairs: ${summary.duplicatePairs}`,
    `warnings: ${summary.warnings}`,
    `errors: ${summary.errors}`,
    ""
  ].join("\n"));
  for (const issue of audit.issues) {
    process.stdout.write(`${issue.severity} ${issue.code}: ${issue.count}`);
    if (issue.samples.length) process.stdout.write(` ${JSON.stringify(issue.samples)}`);
    process.stdout.write("\n");
  }
}

if (audit.summary.errors > 0) process.exitCode = 1;
