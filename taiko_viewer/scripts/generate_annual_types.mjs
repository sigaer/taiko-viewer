#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const schemaCandidates = [
  resolve(root, "../../../schemas/annual-summary-v4.schema.json"),
  resolve(root, "../../schemas/annual-summary-v4.schema.json")
];
let schemaPath = schemaCandidates[0];
for (const candidate of schemaCandidates) {
  try { await readFile(candidate); schemaPath = candidate; break; } catch {}
}
const outputPath = resolve(root, "types/annual-summary-v4.generated.ts");
const schema = JSON.parse(await readFile(schemaPath, "utf8"));
const union = (values) => values.map((value) => JSON.stringify(value)).join(" | ");
const defs = schema.$defs;
const sectionKeys = schema.properties.sections.required;
const eventTypes = defs.annualObservationEvent.properties.type.enum;

const output = `// Generated from ../../schemas/annual-summary-v4.schema.json. Do not edit by hand.\n\n`
  + `export type AnnualMetricStatusV4 = ${union(defs.metricStatus.enum)};\n`
  + `export type AnnualDataModeV4 = ${union(schema.properties.mode.enum)};\n`
  + `export type AnnualTimePrecisionV4 = ${union(defs.timePrecision.enum)};\n`
  + `export type AnnualObservationEventTypeV4 = ${union(eventTypes)};\n`
  + `export type AnnualSectionKeyV4 = ${union(sectionKeys)};\n\n`
  + `export type AnnualMetricV4<T = unknown> = {\n  status: AnnualMetricStatusV4;\n  data: T | null;\n  reason?: string;\n};\n\n`
  + `export type AnnualSourceRefV4 = { file: string; sha256: string };\n\n`
  + `export type AnnualObservationEventV4 = {\n`
  + `  eventId: string;\n  type: AnnualObservationEventTypeV4;\n  source: string;\n  sourceAccount: string | null;\n`
  + `  mergeTopology: string[];\n  songNo: number;\n  level: number;\n`
  + `  observedBetween: { from: string; to: string };\n  representativeAt: string | null;\n`
  + `  representativeDate: string | null;\n  nightDate: string | null;\n  timePrecision: AnnualTimePrecisionV4;\n`
  + `  before: Record<string, unknown>;\n  after: Record<string, unknown>;\n  delta: Record<string, unknown>;\n`
  + `  warnings: string[];\n  sourceRef: { from: AnnualSourceRefV4; to: AnnualSourceRefV4 };\n};\n\n`
  + `export type AnnualSectionsV4 = { [K in AnnualSectionKeyV4]: AnnualMetricV4 };\n\n`
  + `export type AnnualSummaryV4Generated = {\n  schemaVersion: 4;\n  summaryId: string;\n  generatedAt: string;\n`
  + `  mode: AnnualDataModeV4;\n  version: Record<string, unknown>;\n  coverage: Record<string, unknown>;\n`
  + `  profileCard: Record<string, unknown>;\n  period: Record<string, unknown>;\n  overview: AnnualMetricV4;\n`
  + `  sections: AnnualSectionsV4;\n  achievements: unknown;\n  finalTitle: Record<string, unknown>;\n`
  + `  poster: Record<string, unknown>;\n  provenance: Record<string, unknown>;\n};\n`;

if (process.argv.includes("--check")) {
  const current = await readFile(outputPath, "utf8").catch(() => "");
  if (current !== output) {
    process.stderr.write("AnnualSummaryV4 generated types are stale. Run npm run generate:annual-types.\n");
    process.exitCode = 1;
  }
} else {
  await writeFile(outputPath, output, "utf8");
}
