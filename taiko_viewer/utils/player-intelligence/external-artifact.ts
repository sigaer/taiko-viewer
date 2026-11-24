/** Viewer-owned draft envelope. Not a claim about any external project's schema. */
export type ExternalArtifact = {
  envelopeVersion: 'viewer-analysis-artifact-draft/1';
  chart: { namespace: string; id: string; difficultyType: number };
  catalogRevision: string; sourceHash: string;
  analysis: { producer: string; version: string; schema: string };
  featureCoverage: { available: string[]; missing: string[] };
  featurePayload: Record<string, unknown>;
  evidenceReferences: string[];
  diagnostics: { code: string; severity: 'info' | 'warning' | 'error' }[];
};
type Scope = { chart: ExternalArtifact['chart']; catalogRevision: string; sourceHash: string };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 128 && v.every(x => typeof x === 'string' && x.length > 0 && x.length <= 512) && new Set(v).size === v.length;

/** Bounded local inspection only. No filesystem, network, execution, or runtime registration. */
export function inspectExternalArtifact(json: string, expected: Scope) {
  const reject = (reason: string) => ({ status: 'rejected' as const, reason, artifact: null, usableForMatching: false as const });
  if (json.length > 262144) return reject('size-limit');
  let a: unknown;
  try { a = JSON.parse(json); } catch { return reject('invalid-json'); }
  if (!record(a) || a.envelopeVersion !== 'viewer-analysis-artifact-draft/1') return reject('envelope-version');
  const c = a.chart, analysis = a.analysis, coverage = a.featureCoverage;
  if (!record(c) || !record(analysis) || !record(coverage) || !record(a.featurePayload)) return reject('shape');
  if (typeof c.namespace !== 'string' || typeof c.id !== 'string' || ![1,2,3,4,5].includes(Number(c.difficultyType)) || typeof c.difficultyType !== 'number') return reject('chart-identity');
  if (c.namespace !== expected.chart.namespace || c.id !== expected.chart.id || c.difficultyType !== expected.chart.difficultyType) return reject('chart-mismatch');
  if (typeof a.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(a.sourceHash) || a.sourceHash !== expected.sourceHash || a.catalogRevision !== expected.catalogRevision) return reject('stale-or-mismatched-source');
  if (!['producer', 'version', 'schema'].every(k => typeof analysis[k] === 'string' && (analysis[k] as string).length > 0 && (analysis[k] as string).length <= 128)) return reject('analysis-identity');
  if (!strings(coverage.available) || !strings(coverage.missing) || coverage.available.some(k => (coverage.missing as string[]).includes(k))) return reject('coverage');
  const available = coverage.available;
  const keys = Object.keys(a.featurePayload);
  if (keys.some(k => !available.includes(k)) || available.some(k => !Object.hasOwn(a.featurePayload!, k))) return reject('payload-coverage');
  if (!strings(a.evidenceReferences) || !a.evidenceReferences.length) return reject('evidence');
  if (!Array.isArray(a.diagnostics) || a.diagnostics.length > 128 || a.diagnostics.some(d => !record(d) || typeof d.code !== 'string' || d.code.length > 128 || !['info','warning','error'].includes(String(d.severity)))) return reject('diagnostics');
  if (a.diagnostics.some(d => (d as Record<string, unknown>).severity === 'error')) return reject('producer-error');
  // Formal exports require owner-provided schema and a separately reviewed adapter.
  return { status: 'quarantined' as const, reason: 'formal-export-compatibility-review-required', artifact: a as ExternalArtifact, usableForMatching: false as const };
}
