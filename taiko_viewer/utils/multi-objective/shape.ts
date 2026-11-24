/** B4 offline/1: strict JSON shapes; semantic checks live with their owning module. */
import { isObject, isTime } from './common.ts';
import type { ValidationIssue } from './contracts.ts';
export type Shape = (value: unknown, path: string, issues: ValidationIssue[]) => void;
const check = (test: (v: unknown) => boolean, code: string): Shape => (v, path, issues) => { if (!test(v)) issues.push({ path, code }); };
export const str = check(v => typeof v === 'string' && v.length > 0 && v.length <= 512, 'EXPECTED_STRING');
export const hex = check(v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v), 'EXPECTED_SHA256');
export const time = check(isTime, 'EXPECTED_UTC_TIMESTAMP');
export const bool = check(v => typeof v === 'boolean', 'EXPECTED_BOOLEAN');
export const integer = (min = 0, max = Number.MAX_SAFE_INTEGER): Shape => check(v => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max, 'INTEGER_RANGE');
export const number = (min: number, max: number): Shape => check(v => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max, 'NUMBER_RANGE');
export const one = (...values: readonly unknown[]): Shape => check(v => values.includes(v), 'ENUM_VALUE');
export const nullable = (shape: Shape): Shape => (v, p, i) => { if (v !== null) shape(v, p, i); };
export const array = (shape: Shape, max = 256, distinct = false): Shape => (v, p, i) => {
  if (!Array.isArray(v) || v.length > max) { i.push({ path: p, code: 'ARRAY_BUDGET_OR_TYPE' }); return; }
  if (distinct && new Set(v).size !== v.length) i.push({ path: p, code: 'DUPLICATE_ITEM' });
  v.forEach((x, n) => shape(x, `${p}[${n}]`, i));
};
export const strings = array(str, 256, true);
export const object = (fields: Record<string, Shape>): Shape => (v, p, i) => {
  if (!isObject(v)) { i.push({ path: p, code: 'EXPECTED_OBJECT' }); return; }
  for (const k of Object.keys(v)) if (!Object.hasOwn(fields, k)) i.push({ path: `${p}.${k}`, code: 'UNKNOWN_FIELD' });
  for (const [k, shape] of Object.entries(fields)) shape(v[k], `${p}.${k}`, i);
};
export const dictionary = (shape: Shape, max = 100): Shape => (v, p, i) => {
  if (!isObject(v) || Object.keys(v).length > max) { i.push({ path: p, code: 'DICTIONARY_BUDGET_OR_TYPE' }); return; }
  for (const [k, x] of Object.entries(v)) { str(k, p, i); shape(x, `${p}.${k}`, i); }
};
export function inspect(shape: Shape, v: unknown): ValidationIssue[] { const i: ValidationIssue[] = []; shape(v, '$', i); return i; }
