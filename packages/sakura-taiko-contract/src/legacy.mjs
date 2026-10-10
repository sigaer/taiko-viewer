/** Value-only lossless read adapter. Host adapters supply source, clock and catalog. */
export { legacyScoreReader, legacyScoreValue, legacyCrown, legacyJudgmentTotal, legacyScoreInstant, hasLegacyScoreEvidence } from './read-values.mjs';
const MAX = Number.MAX_SAFE_INTEGER;
export const CONTRACT_VERSION = '1.0';
const secretKeys = new Set(['cookie', 'password', 'token', 'authorization', 'secret', 'credentials', 'accesskeysecret']);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const assertValue = (value, depth = 0) => {
  if (depth > 8) throw new Error('score extension nesting exceeds contract limit');
  if (Array.isArray(value)) {
    if (value.length > 128) throw new Error('score extension array exceeds contract limit');
    for (const item of value) assertValue(item, depth + 1);
  } else if (object(value)) {
    if (Object.keys(value).length > 128) throw new Error('score extension field count exceeds contract limit');
    for (const [key, item] of Object.entries(value)) {
      if (secretKeys.has(key.toLowerCase())) throw new Error('score extension contains a credential field');
      assertValue(item, depth + 1);
    }
  } else if (typeof value === 'string') {
    if (value.length > 4096) throw new Error('score extension string exceeds contract limit');
  } else if (typeof value === 'number') {
    if (!Number.isFinite(value) || Math.abs(value) > MAX) throw new Error('score extension number is not JSON interoperable');
  } else if (value !== null && typeof value !== 'boolean') throw new Error('score extension is not a JSON value');
};
const count = (value, field) => {
  if (value === null || value === undefined || value === '') return null;
  if (!['number', 'string'].includes(typeof value)) throw new Error(`invalid score field: ${field}`);
  if (typeof value === 'string' && !/^[+-]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(value.trim())) throw new Error(`invalid score field: ${field}`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0 || (typeof value === 'string' && !value.trim())) throw new Error(`invalid score field: ${field}`);
  return number;
};
const equivalent = (a, b) => {
  if (a === b) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((v, i) => equivalent(v, b[i]));
  if (!object(a) || !object(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(k => own(b, k) && equivalent(a[k], b[k]));
};

export function fromLegacyScore(record, { source, capturedAt, chartLevel = null, chartType = 'unknown', catalogRevision = null }) {
  if (!object(record)) throw new Error('score record must be an object');
  assertValue(record);
  const songId = count(record.song_no, 'song_no'), difficulty = count(record.level, 'level');
  if (!songId || difficulty === null || difficulty < 1 || difficulty > 5) throw new Error('score record requires a valid song and difficulty');
  if (typeof source !== 'string' || !source.trim()) throw new Error('score source is required');
  if (capturedAt !== null && (typeof capturedAt !== 'string' || !capturedAt)) throw new Error('capturedAt must be an explicit instant or null');
  if (!['single', 'double', 'unknown'].includes(chartType)) throw new Error('invalid chart type');
  if (chartLevel !== null && (typeof chartLevel !== 'number' || !Number.isFinite(chartLevel) || chartLevel < 0)) throw new Error('invalid chart star level');
  if (catalogRevision !== null && (typeof catalogRevision !== 'string' || !catalogRevision)) throw new Error('invalid catalog revision');
  const counts = Object.fromEntries([['clear', 'clear_cnt'], ['fullCombo', 'full_combo_cnt'], ['dondafulCombo', 'dondaful_combo_cnt'], ['stage', 'stage_cnt'], ['roll', 'pound_cnt']].map(([key, field]) => [key, count(record[field], field)]));
  const flag = key => counts[key] === null ? null : counts[key] > 0;
  const identity = String(record.song_no);
  for (const field of ['highscore_datetime', 'update_datetime']) {
    if (record[field] !== null && record[field] !== undefined && typeof record[field] !== 'string') throw new Error(`invalid score timestamp: ${field}`);
  }
  const timestamp = field => record[field] === null || record[field] === undefined || record[field] === '' ? null : String(record[field]);
  return {
    song: { songId: identity, title: null, catalogRevision },
    chart: { songId: identity, chartId: `${identity}:${difficulty}:${chartType}`, difficulty, level: chartLevel, type: chartType, variant: null, catalogRevision },
    score: count(record.high_score, 'high_score'), good: count(record.good_cnt, 'good_cnt'), ok: count(record.ok_cnt, 'ok_cnt'), ng: count(record.ng_cnt, 'ng_cnt'), combo: count(record.combo_cnt, 'combo_cnt'),
    clear: flag('clear'), fullCombo: flag('fullCombo'), dondafulCombo: flag('dondafulCombo'), rank: count(record.best_score_rank, 'best_score_rank'),
    capturedAt, source, counts, highscoreAt: timestamp('highscore_datetime'), updatedAt: timestamp('update_datetime'), legacy: structuredClone(record)
  };
}

export function toLegacyScore(score) {
  if (!own(score, 'legacy')) throw new Error('legacy evidence is required for a lossless read roundtrip');
  const projected = fromLegacyScore(score.legacy, { source: score.source, capturedAt: score.capturedAt, chartLevel: score.chart.level, chartType: score.chart.type, catalogRevision: score.chart.catalogRevision });
  if (!equivalent(projected, score)) throw new Error('read contract cannot publish edited score evidence');
  return structuredClone(score.legacy);
}
