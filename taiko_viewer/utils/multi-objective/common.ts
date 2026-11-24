/** B4 offline/1 deterministic JSON and bounded validation helpers. */
import { createHash } from 'node:crypto';
import type { MultiObjectiveCandidate, Target, ValidationIssue, ValidationResult } from './contracts.ts';
export const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
export const unique = (xs: readonly string[]): string[] => [...new Set(xs)].sort(compare);
export const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
export function canonicalJSON(value: unknown): string {
  let nodes = 0;
  const seen = new Set<object>();
  function visit(v: unknown, depth: number): string {
    if (++nodes > 2000000 || depth > 40) throw new Error('JSON_BUDGET_EXCEEDED');
    if (v === null || typeof v === 'boolean' || typeof v === 'string') return JSON.stringify(v);
    if (typeof v === 'number' && Number.isFinite(v)) return JSON.stringify(v);
    if (!Array.isArray(v) && !isObject(v)) throw new Error('NON_JSON_VALUE');
    if (seen.has(v)) throw new Error('CYCLIC_JSON');
    seen.add(v);
    const result = Array.isArray(v) ? '[' + Array.from(v, x => visit(x, depth + 1)).join(',') + ']'
      : '{' + Object.keys(v).sort(compare).map(k => JSON.stringify(k) + ':' + visit(v[k], depth + 1)).join(',') + '}';
    seen.delete(v);
    return result;
  }
  return visit(value, 0);
}
export const hash = (value: unknown): string => createHash('sha256').update(canonicalJSON(value)).digest('hex');
export const targetHash = (target: Target): string => hash(target);
export function candidateId(c: Pick<MultiObjectiveCandidate, 'decisionId' | 'profileId' | 'chartId' | 'catalogRevision' | 'policyVersion' | 'intentType' | 'subtype' | 'targetHash'>): string {
  const { decisionId, profileId, chartId, catalogRevision, policyVersion, intentType, subtype, targetHash } = c;
  return hash({ decisionId, profileId, chartId, catalogRevision, policyVersion, intentType, subtype, targetHash });
}
export const DAY = 86400000;
export const isTime = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
export function result<T>(value: T, issues: ValidationIssue[]): ValidationResult<T> {
  const sorted = [...new Map(issues.map(i => [i.path + '\0' + i.code, i])).values()].sort((a, b) => compare(a.path, b.path) || compare(a.code, b.code));
  return sorted.length ? { ok: false, issues: sorted } : { ok: true, value, issues: [] };
}
export const same = (a: unknown, b: unknown): boolean => canonicalJSON(a) === canonicalJSON(b);
